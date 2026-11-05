"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Ban, ChevronLeft, ChevronRight, Download, Printer, ReceiptText, Undo2 } from "lucide-react";
import { toast } from "sonner";
import type { SaleTransaction } from "@/lib/types";
import { useDb } from "@/lib/store/app-store";
import { actions } from "@/lib/store/actions";
import { useCan, useCurrentUser } from "@/hooks/use-session";
import { useToday } from "@/hooks/use-today";
import { PAYMENT_LABEL, presetRange, summarize, txDate, type DateRange } from "@/lib/services/report-service";
import { addDays, dateKey, formatDateTime, formatShortDateTime, formatTime, peso } from "@/lib/utils/format";
import { downloadCsv } from "@/lib/utils/csv";
import { Chip } from "@/components/shared/chip";
import { Segmented } from "@/components/shared/segmented";
import { SearchInput } from "@/components/shared/search-input";
import { NativeSelect, Field, TextInput, TextArea } from "@/components/shared/field";
import { StatTile } from "@/components/shared/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ReceiptDialog } from "@/components/receipts/receipt-print-panel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { DISCOUNT_LABEL, PAY_TONE, STATUS_META } from "./sales-meta";

type RangeKey = "today" | "yesterday" | "7d" | "month" | "custom";
const PAGE_SIZE = 15;

function rangeFor(t: SaleTransaction | undefined, today: string): RangeKey {
  if (!t) return "today";
  const k = txDate(t);
  if (k === today) return "today";
  if (k === addDays(today, -1)) return "yesterday";
  if (k >= addDays(today, -6)) return "7d";
  if (k >= today.slice(0, 8) + "01") return "month";
  return "custom";
}

function customFor(t: SaleTransaction | undefined, today: string): DateRange {
  const k = t ? txDate(t) : addDays(today, -13);
  return { from: k, to: t ? k : today };
}

export function SalesView() {
  const db = useDb();
  const today = useToday();
  const router = useRouter();
  const params = useSearchParams();
  const paramTx = params.get("tx");
  const paramTxRecord = paramTx ? db.transactions.find((t) => t.id === paramTx) : undefined;

  const [range, setRange] = useState<RangeKey>(() => rangeFor(paramTxRecord, today));
  const [custom, setCustom] = useState<DateRange>(() => customFor(paramTxRecord, today));
  const [q, setQ] = useState("");
  const [pay, setPay] = useState("all");
  const [cashier, setCashier] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(paramTx);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [lastParam, setLastParam] = useState(paramTx);
  if (paramTx !== lastParam) {
    setLastParam(paramTx);
    if (paramTx) {
      setSelectedId(paramTx);
      setRange(rangeFor(paramTxRecord, today));
      setCustom(customFor(paramTxRecord, today));
      setPage(0);
    }
  }

  const dateRange: DateRange = range === "custom" ? custom : presetRange(range, today);

  const inRange = useMemo(
    () => db.transactions.filter((t) => {
      const k = txDate(t);
      return k >= dateRange.from && k <= dateRange.to;
    }),
    [db.transactions, dateRange.from, dateRange.to]
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return inRange
      .filter((t) => (pay === "all" || t.payment.method === pay) && (cashier === "all" || t.cashierId === cashier) && (status === "all" || t.status === status))
      .filter((t) => !term || t.receiptNo.toLowerCase().includes(term) || t.cashierName.toLowerCase().includes(term) || t.lines.some((l) => l.name.toLowerCase().includes(term) || l.genericName.toLowerCase().includes(term)))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [inRange, q, pay, cashier, status]);

  const summary = useMemo(() => {
    const counted = filtered.filter((t) => t.status !== "voided");
    const s = summarize(counted);
    const voided = filtered.filter((t) => t.status === "voided").reduce((a, t) => a + t.total, 0);
    return { ...s, voided, voidCount: filtered.length - counted.length };
  }, [filtered]);

  const cashiers = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of db.transactions) m.set(t.cashierId, t.cashierName);
    return [...m.entries()];
  }, [db.transactions]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const selIdx = selectedId ? filtered.findIndex((t) => t.id === selectedId) : -1;
  const [jumped, setJumped] = useState<string | null>(null);
  if (paramTx && selIdx >= 0 && jumped !== paramTx) {
    setJumped(paramTx);
    setPage(Math.floor(selIdx / PAGE_SIZE));
  }
  const curPage = Math.min(page, pages - 1);
  const rows = filtered.slice(curPage * PAGE_SIZE, curPage * PAGE_SIZE + PAGE_SIZE);
  const selected = (selectedId && filtered.find((t) => t.id === selectedId)) || rows[0] || null;

  const resetPage = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setPage(0);
  };

  const exportCsv = () => {
    downloadCsv(
      `sales_${dateRange.from}_to_${dateRange.to}.csv`,
      ["Receipt", "Date", "Time", "Cashier", "Items", "Units", "Subtotal", "Discount type", "Discount", "Less VAT", "VAT", "Total", "Refunded", "Payment", "Reference", "Status"],
      filtered.map((t) => [
        t.receiptNo,
        dateKey(t.createdAt),
        formatTime(t.createdAt),
        t.cashierName,
        t.lines.length,
        t.lines.reduce((a, l) => a + l.baseQty, 0),
        t.subtotal.toFixed(2),
        t.discountType,
        t.discountAmount.toFixed(2),
        t.lessVat.toFixed(2),
        t.vatAmount.toFixed(2),
        t.total.toFixed(2),
        t.refundedAmount.toFixed(2),
        PAYMENT_LABEL[t.payment.method],
        t.payment.reference ?? t.payment.approvalCode ?? "",
        STATUS_META[t.status].label,
      ])
    );
    toast.success("CSV exported", { description: `${filtered.length} transactions` });
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          variant="dark"
          ariaLabel="Date range"
          value={range}
          onChange={resetPage(setRange)}
          options={[
            { value: "today", label: "Today" },
            { value: "yesterday", label: "Yesterday" },
            { value: "7d", label: "Last 7 days" },
            { value: "month", label: "This month" },
            { value: "custom", label: "Custom range" },
          ]}
        />
        <div className="flex flex-wrap gap-2">
          <SearchInput value={q} onChange={resetPage(setQ)} placeholder="Receipt no., cashier, medicine…" className="h-11 w-full min-w-[240px] sm:w-auto" ariaLabel="Search transactions" />
          <Button variant="outline" size="md" className="h-11" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="size-4" aria-hidden /> Export CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {range === "custom" && (
          <>
            <Field label="From" className="w-40">
              <TextInput type="date" value={custom.from} max={custom.to} onChange={(e) => e.target.value && resetPage(setCustom)({ ...custom, from: e.target.value })} />
            </Field>
            <Field label="To" className="w-40">
              <TextInput type="date" value={custom.to} min={custom.from} max={today} onChange={(e) => e.target.value && resetPage(setCustom)({ ...custom, to: e.target.value })} />
            </Field>
          </>
        )}
        <Field label="Payment" className="w-40">
          <NativeSelect value={pay} onChange={(e) => resetPage(setPay)(e.target.value)}>
            <option value="all">All payments</option>
            <option value="cash">Cash</option>
            <option value="qrph">QR Ph</option>
            <option value="card">Card</option>
          </NativeSelect>
        </Field>
        <Field label="Cashier" className="w-48">
          <NativeSelect value={cashier} onChange={(e) => resetPage(setCashier)(e.target.value)}>
            <option value="all">All cashiers</option>
            {cashiers.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Status" className="w-48">
          <NativeSelect value={status} onChange={(e) => resetPage(setStatus)(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="completed">Paid</option>
            <option value="partially_refunded">Partially refunded</option>
            <option value="refunded">Refunded</option>
            <option value="voided">Voided</option>
          </NativeSelect>
        </Field>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        <StatTile className="card-surface bg-surface" label="Gross sales" value={peso(summary.gross)} />
        <StatTile className="card-surface bg-surface" label="Transactions" value={summary.count.toLocaleString("en-PH")} />
        <StatTile className="card-surface bg-surface" label="SC / PWD & discounts" value={peso(summary.discounts)} />
        <StatTile className="card-surface bg-surface" label={`Refunds & voids${summary.voidCount ? ` · ${summary.voidCount} void` : ""}`} value={peso(summary.refunds + summary.voided)} valueClassName="text-danger" />
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div className="card-surface min-w-0 flex-[2_1_560px] overflow-hidden">
          {rows.length === 0 ? (
            <EmptyState icon={ReceiptText} title="No transactions" description="No sales match these filters. Try a wider date range or clear the search." />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Receipt</th>
                    <th>Date &amp; time</th>
                    <th>Cashier</th>
                    <th>Items</th>
                    <th>Discount</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => {
                    const on = selected?.id === t.id;
                    return (
                      <tr
                        key={t.id}
                        onClick={() => setSelectedId(t.id)}
                        className={cn("cursor-pointer", on && "!bg-brand-50", t.status === "voided" && !on && "opacity-70")}
                      >
                        <td>
                          <button type="button" onClick={() => setSelectedId(t.id)} className="font-mono text-xs font-semibold" aria-pressed={on}>
                            {t.receiptNo}
                          </button>
                        </td>
                        <td>{formatShortDateTime(t.createdAt)}</td>
                        <td>{t.cashierName}</td>
                        <td className="tabular">{t.lines.reduce((a, l) => a + l.baseQty, 0)}</td>
                        <td className="text-ink-500">{t.discountType === "none" ? "—" : `${DISCOUNT_LABEL[t.discountType]} ${Math.round(t.discountRate * 100)}%`}</td>
                        <td>
                          <Chip tone={PAY_TONE[t.payment.method]}>{PAYMENT_LABEL[t.payment.method]}</Chip>
                        </td>
                        <td>
                          <Chip tone={STATUS_META[t.status].tone}>{STATUS_META[t.status].label}</Chip>
                        </td>
                        <td className="text-right font-bold tabular">{peso(t.total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[13px] font-medium text-ink-500">
            <span>
              Showing {rows.length ? curPage * PAGE_SIZE + 1 : 0}–{curPage * PAGE_SIZE + rows.length} of {filtered.length.toLocaleString("en-PH")}
            </span>
            <span className="flex items-center gap-2">
              <Button variant="outline" size="icon-sm" aria-label="Previous page" disabled={curPage === 0} onClick={() => setPage(curPage - 1)}>
                <ChevronLeft />
              </Button>
              Page {curPage + 1} of {pages}
              <Button variant="outline" size="icon-sm" aria-label="Next page" disabled={curPage >= pages - 1} onClick={() => setPage(curPage + 1)}>
                <ChevronRight />
              </Button>
            </span>
          </div>
        </div>

        {selected ? (
          <TransactionDetail
            tx={selected}
            onReceipt={() => setReceiptOpen(true)}
            onRefund={() => router.push(`/refunds?tx=${selected.id}`)}
            onVoid={() => setVoidOpen(true)}
          />
        ) : (
          <aside className="card-surface flex-[1_1_340px]">
            <EmptyState icon={ReceiptText} title="Select a transaction" description="Choose a sale to see its items, payment and audit trail." />
          </aside>
        )}
      </div>

      <ReceiptDialog transactionId={selected?.id ?? null} open={receiptOpen} onOpenChange={setReceiptOpen} />
      {selected && <VoidDialog tx={selected} open={voidOpen} onOpenChange={setVoidOpen} />}
    </>
  );
}

function TransactionDetail({ tx, onReceipt, onRefund, onVoid }: { tx: SaleTransaction; onReceipt: () => void; onRefund: () => void; onVoid: () => void }) {
  const db = useDb();
  const canRefund = useCan("sales.refund");
  const canVoid = useCan("sales.void");
  const canReprint = useCan("sales.reprint");
  const refunds = db.refunds.filter((r) => r.transactionId === tx.id);
  const sameDay = dateKey(tx.createdAt) === dateKey(new Date());
  const refundable = tx.status === "completed" || tx.status === "partially_refunded";
  const voidable = tx.status === "completed" && sameDay;
  const p = tx.payment;

  const audit: { t: string; e: string }[] = [{ t: tx.createdAt, e: `Sale finalized by ${tx.cashierName} · ${PAYMENT_LABEL[p.method]}${p.simulated && p.method !== "cash" ? " (simulated)" : ""}` }];
  if (tx.rxVerification) audit.push({ t: tx.rxVerification.verifiedAt, e: `Rx verified by ${tx.rxVerification.pharmacistName} · ${tx.rxVerification.prescriber}` });
  if (tx.discountIdNumber) audit.push({ t: tx.createdAt, e: `${DISCOUNT_LABEL[tx.discountType]} ID ${tx.discountIdNumber} recorded and discount applied` });
  if (tx.lastPrintedAt) audit.push({ t: tx.lastPrintedAt, e: `Receipt printed ${tx.printCount}× (last print request)` });
  for (const r of refunds) audit.push({ t: r.createdAt, e: `Refund ${r.refundNo} · ${peso(r.amount)} · ${r.lines.map((l) => `${l.qty} × ${l.name}`).join(", ")} · authorized by ${r.authorizedByName}` });
  if (tx.voidedAt) audit.push({ t: tx.voidedAt, e: `Voided by ${tx.voidedByName} — ${tx.voidReason}; stock returned to batch` });
  audit.sort((a, b) => (a.t < b.t ? -1 : 1));

  const discountText =
    tx.discountType === "none"
      ? "₱0.00"
      : `−${peso(tx.discountAmount + tx.lessVat)} (${DISCOUNT_LABEL[tx.discountType]}${tx.lessVat ? ", VAT-exempt" : ""})`;

  return (
    <aside aria-label="Transaction details" className="card-surface flex min-w-0 flex-[1_1_340px] flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-lg font-bold">{tx.receiptNo}</span>
          <span className="text-xs text-ink-500">
            {formatDateTime(tx.createdAt)} · {tx.cashierName}
          </span>
        </div>
        <Chip tone={STATUS_META[tx.status].tone}>{STATUS_META[tx.status].label}</Chip>
      </div>

      <div className="flex flex-col gap-2.5 rounded-xl bg-canvas p-3.5">
        {tx.lines.map((l) => (
          <div key={l.id} className="flex justify-between gap-2.5 text-[13px] font-medium">
            <span className="min-w-0">
              {l.name}
              {l.rxRequired && <span className="ml-1 text-[11px] font-semibold text-brand-700">Rx</span>} <span className="text-ink-500">× {l.qty}{l.packMultiplier > 1 ? ` ${l.packLabel}` : ""}</span>
              {l.refundedQty > 0 && <span className="block text-xs text-orange">{l.refundedQty} {l.unit} refunded</span>}
            </span>
            <span className="font-semibold tabular">{peso(l.lineTotal)}</span>
          </div>
        ))}
        <div className="flex flex-col gap-1.5 border-t border-dashed border-line-strong pt-2.5 text-[13px] font-medium text-ink-700">
          <Row label="Subtotal" value={peso(tx.subtotal)} />
          <Row label="Discount" value={discountText} />
          <Row label="VATable sales" value={peso(tx.vatableSales)} />
          <Row label="VAT" value={peso(tx.vatAmount)} />
          {tx.vatExemptSales > 0 && <Row label="VAT-exempt sales" value={peso(tx.vatExemptSales)} />}
          <div className="flex justify-between text-base font-bold text-ink">
            <span>Total</span>
            <span className="tabular">{peso(tx.total)}</span>
          </div>
          {tx.refundedAmount > 0 && <Row label="Refunded" value={`−${peso(tx.refundedAmount)}`} className="text-danger" />}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 text-[13px] font-medium">
        <Info label="Payment" value={PAYMENT_LABEL[p.method] + (p.method === "cash" && p.tendered !== undefined ? ` · tendered ${peso(p.tendered)}` : "")} />
        <Info
          label={p.method === "cash" ? "Change" : p.method === "qrph" ? "Provider ref (demo)" : "Approval (demo)"}
          value={p.method === "cash" ? peso(p.change ?? 0) : (p.reference ?? p.approvalCode ?? "—") + (p.cardLast4 ? ` · ****${p.cardLast4}` : "")}
          mono={p.method !== "cash"}
        />
        <Info label="Receipt" value={tx.printCount ? `Printed ${tx.printCount}×` : "Not printed yet"} />
        <Info label="Branch" value={tx.branch} />
        {tx.rxVerification && <Info label="Rx verified by" value={tx.rxVerification.pharmacistName} />}
        {tx.discountIdNumber && <Info label={`${DISCOUNT_LABEL[tx.discountType]} ID`} value={tx.discountIdNumber} />}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="soft" size="md" className="h-11 flex-[1_1_100px]" onClick={onReceipt} disabled={!canReprint}>
          <Printer className="size-4" aria-hidden /> {tx.printCount ? "Reprint" : "Receipt"}
        </Button>
        {canRefund && (
          <Button variant="outline" size="md" className="h-11 flex-[1_1_100px]" onClick={onRefund} disabled={!refundable} title={refundable ? undefined : "Nothing left to refund"}>
            <Undo2 className="size-4" aria-hidden /> Refund…
          </Button>
        )}
        {canVoid && (
          <Button variant="danger-soft" size="md" className="h-11 flex-[1_1_100px]" onClick={onVoid} disabled={!voidable} title={voidable ? undefined : "Voids are same-day only for sales without refunds"}>
            <Ban className="size-4" aria-hidden /> Void…
          </Button>
        )}
      </div>
      <span className="text-xs leading-relaxed text-ink-500">
        Refunds need a Pharmacist or Administrator PIN and restock only to a saleable batch. Voids are same-day, Administrator only. Neither edits the original record — each adds a linked reversing entry.
      </span>

      <div className="flex flex-col gap-2">
        <span className="label-caps">Audit trail</span>
        {audit.map((a, i) => (
          <div key={i} className="flex gap-2.5 text-xs text-ink-700">
            <span className="font-mono whitespace-nowrap text-ink-500">{formatTime(a.t)}</span>
            <span>{a.e}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("flex justify-between gap-3", className)}>
      <span>{label}</span>
      <span className="text-right tabular">{value}</span>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs text-ink-500">{label}</span>
      <span className={cn("break-words", mono && "font-mono text-xs")}>{value}</span>
    </div>
  );
}

function VoidDialog({ tx, open, onOpenChange }: { tx: SaleTransaction; open: boolean; onOpenChange: (o: boolean) => void }) {
  const user = useCurrentUser();
  const [reason, setReason] = useState("");
  const [pin, setPin] = useState("");
  const submit = () => {
    const res = actions.voidSale({ transactionId: tx.id, reason, pin });
    if (!res.ok) return void toast.error("Void not completed", { description: res.error });
    toast.success(`${tx.receiptNo} voided`, { description: "Stock returned to the original batches." });
    setReason("");
    setPin("");
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-4 rounded-2xl p-6 sm:max-w-md">
        <div className="flex flex-col gap-1">
          <DialogTitle className="font-heading text-lg font-semibold">Void {tx.receiptNo}?</DialogTitle>
          <DialogDescription className="text-sm text-ink-500">
            {peso(tx.total)} · {formatDateTime(tx.createdAt)}. The sale is kept and marked VOIDED; sold units return to their batches. This cannot be undone.
          </DialogDescription>
        </div>
        <Field label="Reason">
          <TextArea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Wrong item scanned" rows={2} />
        </Field>
        <Field label={`Your PIN (${user?.name ?? ""})`} hint={user ? `Demo PIN: ${user.pin} · simulated authorization` : undefined}>
          <TextInput type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="md" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="danger-soft" size="md" onClick={submit} disabled={!reason.trim() || pin.length < 4}>
            <Ban className="size-4" aria-hidden /> Void sale
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
