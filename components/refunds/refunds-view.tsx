"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Minus, PackageCheck, Plus, ReceiptText, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import type { SaleTransaction } from "@/lib/types";
import { useDb } from "@/lib/store/app-store";
import { actions } from "@/lib/store/actions";
import { useCurrentUser } from "@/hooks/use-session";
import { useToday } from "@/hooks/use-today";
import { hasPermission } from "@/lib/auth/permissions";
import { refundAmountFor } from "@/lib/services/pricing";
import { refundableQty } from "@/lib/services/refund-service";
import { PAYMENT_LABEL, txDate } from "@/lib/services/report-service";
import { addDays, dateKey, formatDateTime, formatShortDateTime, peso, round2 } from "@/lib/utils/format";
import { downloadCsv } from "@/lib/utils/csv";
import { Chip } from "@/components/shared/chip";
import { SearchInput } from "@/components/shared/search-input";
import { Field, NativeSelect, TextArea } from "@/components/shared/field";
import { StatTile } from "@/components/shared/card";
import { EmptyState } from "@/components/shared/empty-state";
import { AuthorizeFields } from "@/components/shared/authorize-fields";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { STATUS_META } from "@/components/sales/sales-meta";

const REASONS = [
  "Customer returned unopened box",
  "Wrong item / strength dispensed",
  "Doctor changed prescription",
  "Duplicate purchase",
  "Product defect / damaged packaging",
  "Adverse reaction reported",
];

function isEligible(t: SaleTransaction) {
  return (t.status === "completed" || t.status === "partially_refunded") && t.lines.some((l) => refundableQty(l) > 0);
}

export function RefundsView() {
  const db = useDb();
  const today = useToday();
  const router = useRouter();
  const params = useSearchParams();
  const paramTx = params.get("tx");
  const [selectedId, setSelectedId] = useState<string | null>(paramTx);
  const [lastParam, setLastParam] = useState(paramTx);
  if (paramTx !== lastParam) {
    setLastParam(paramTx);
    setSelectedId(paramTx);
  }
  const [find, setFind] = useState("");
  const [histQ, setHistQ] = useState("");

  const selected = selectedId ? db.transactions.find((t) => t.id === selectedId) : undefined;

  const candidates = useMemo(() => {
    const term = find.trim().toLowerCase();
    const from = addDays(today, -90);
    const out: SaleTransaction[] = [];
    for (let i = db.transactions.length - 1; i >= 0 && out.length < 8; i--) {
      const t = db.transactions[i];
      if (term) {
        if (!t.receiptNo.toLowerCase().includes(term) && !t.lines.some((l) => l.name.toLowerCase().includes(term))) continue;
      } else if (txDate(t) < from) break;
      if (isEligible(t)) out.push(t);
    }
    return out;
  }, [db.transactions, find, today]);

  const exactMatch = useMemo(() => {
    const term = find.trim().toLowerCase();
    if (!term) return undefined;
    return db.transactions.find((t) => t.receiptNo.toLowerCase() === term);
  }, [db.transactions, find]);

  const stats = useMemo(() => {
    const month = today.slice(0, 7);
    let todayCount = 0,
      todayAmt = 0,
      monthCount = 0,
      monthAmt = 0,
      restocked = 0;
    for (const r of db.refunds) {
      const k = dateKey(r.createdAt);
      if (k === today) {
        todayCount++;
        todayAmt += r.amount;
      }
      if (k.startsWith(month)) {
        monthCount++;
        monthAmt += r.amount;
        restocked += r.lines.filter((l) => l.restock).reduce((s, l) => s + l.qty, 0);
      }
    }
    return { todayCount, todayAmt, monthCount, monthAmt, restocked };
  }, [db.refunds, today]);

  const history = useMemo(() => {
    const term = histQ.trim().toLowerCase();
    return db.refunds
      .filter(
        (r) =>
          !term ||
          r.refundNo.toLowerCase().includes(term) ||
          r.receiptNo.toLowerCase().includes(term) ||
          r.reason.toLowerCase().includes(term) ||
          r.authorizedByName.toLowerCase().includes(term) ||
          r.lines.some((l) => l.name.toLowerCase().includes(term))
      )
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [db.refunds, histQ]);

  const exportCsv = () => {
    downloadCsv(
      "refunds.csv",
      ["Refund no", "Date", "Original receipt", "Items", "Units", "Amount", "Restocked units", "Method", "Reason", "Processed by", "Authorized by"],
      history.map((r) => [
        r.refundNo,
        formatDateTime(r.createdAt),
        r.receiptNo,
        r.lines.map((l) => `${l.qty} x ${l.name}`).join("; "),
        r.lines.reduce((s, l) => s + l.qty, 0),
        r.amount.toFixed(2),
        r.lines.filter((l) => l.restock).reduce((s, l) => s + l.qty, 0),
        PAYMENT_LABEL[r.method],
        r.reason,
        r.processedByName,
        r.authorizedByName,
      ])
    );
    toast.success("CSV exported", { description: `${history.length} refunds` });
  };

  const pick = (id: string | null) => {
    setSelectedId(id);
    if (paramTx) router.replace("/refunds");
  };

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        <StatTile className="card-surface bg-surface" label={`Refunds today · ${stats.todayCount}`} value={peso(stats.todayAmt)} valueClassName="text-danger" />
        <StatTile className="card-surface bg-surface" label={`This month · ${stats.monthCount} refunds`} value={peso(stats.monthAmt)} valueClassName="text-danger" />
        <StatTile className="card-surface bg-surface" label="Units restocked this month" value={stats.restocked.toLocaleString("en-PH")} />
        <StatTile className="card-surface bg-surface" label="Refunds on record" value={db.refunds.length.toLocaleString("en-PH")} />
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <section className="card-surface flex min-w-0 flex-[1_1_320px] flex-col gap-3 p-5 lg:max-w-[400px]">
          <div>
            <h2 className="font-heading text-[17px] font-semibold">Start a refund</h2>
            <span className="text-xs text-ink-500">Find the original sale by receipt number or medicine.</span>
          </div>
          <SearchInput value={find} onChange={setFind} placeholder="Receipt no. e.g. RX-001020" ariaLabel="Find sale by receipt number" />
          {exactMatch && !isEligible(exactMatch) && (
            <div className="rounded-xl bg-warn-bg px-3 py-2.5 text-xs text-warn">
              {exactMatch.receiptNo} is {STATUS_META[exactMatch.status].label.toLowerCase()} — {exactMatch.status === "voided" ? "voided sales cannot be refunded." : "nothing is left to refund."}
            </div>
          )}
          <span className="label-caps mt-1">{find.trim() ? "Matching eligible sales" : "Recent eligible sales"}</span>
          <div className="flex flex-col gap-1">
            {candidates.length === 0 && <span className="py-4 text-center text-[13px] text-ink-500">No eligible sales found.</span>}
            {candidates.map((t) => {
              const on = t.id === selectedId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => pick(t.id)}
                  aria-current={on}
                  className={cn("flex flex-col gap-1 rounded-xl px-3.5 py-3 text-left transition-colors", on ? "bg-brand-50 shadow-[inset_3px_0_0_var(--brand)]" : "hover:bg-canvas")}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[13px] font-bold">{t.receiptNo}</span>
                    <span className="text-[13px] font-semibold tabular">{peso(t.total)}</span>
                  </span>
                  <span className="truncate text-xs text-ink-500">
                    {formatShortDateTime(t.createdAt)} · {t.lines.map((l) => l.name).join(", ")}
                  </span>
                  {t.status === "partially_refunded" && <Chip tone="orange" size="sm" className="self-start">Partially refunded</Chip>}
                </button>
              );
            })}
          </div>
        </section>

        <section className="card-surface flex min-w-0 flex-[999_1_520px] flex-col">
          {selected ? (
            isEligible(selected) ? (
              <RefundForm key={selected.id} tx={selected} onClose={() => pick(null)} />
            ) : (
              <EmptyState
                icon={Undo2}
                title={`${selected.receiptNo} can't be refunded`}
                description={selected.status === "voided" ? "This sale was voided — its stock was already returned." : "Every item on this sale has already been refunded."}
                action={
                  <Button variant="outline" size="md" onClick={() => pick(null)}>
                    Choose another sale
                  </Button>
                }
              />
            )
          ) : (
            <EmptyState icon={ReceiptText} title="Select a sale to refund" description="Refunds are linked to the original receipt, need an authorized PIN and never edit the original sale." />
          )}
        </section>
      </div>

      <section className="card-surface min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <h2 className="font-heading text-[17px] font-semibold">Refund history</h2>
            <span className="text-xs text-ink-500">Every refund stays linked to its original sale.</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <SearchInput value={histQ} onChange={setHistQ} placeholder="Refund, receipt, reason…" className="w-full sm:w-64" />
            <Button variant="outline" size="md" onClick={exportCsv} disabled={!history.length}>
              <Download className="size-4" aria-hidden /> Export CSV
            </Button>
          </div>
        </div>
        {history.length === 0 ? (
          <EmptyState icon={Undo2} title="No refunds found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Refund</th>
                  <th>Date</th>
                  <th>Original receipt</th>
                  <th>Items</th>
                  <th className="text-right">Amount</th>
                  <th>Restocked</th>
                  <th>Reason</th>
                  <th>Authorized by</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 50).map((r) => {
                  const restocked = r.lines.filter((l) => l.restock).reduce((s, l) => s + l.qty, 0);
                  return (
                    <tr key={r.id}>
                      <td className="font-mono text-xs font-semibold">{r.refundNo}</td>
                      <td>{formatShortDateTime(r.createdAt)}</td>
                      <td>
                        <Link href={`/sales?tx=${r.transactionId}`} className="font-mono text-xs font-semibold text-brand-700 hover:underline">
                          {r.receiptNo}
                        </Link>
                      </td>
                      <td className="max-w-[260px] truncate" title={r.lines.map((l) => `${l.qty} × ${l.name}`).join(", ")}>
                        {r.lines.map((l) => `${l.qty} × ${l.name}`).join(", ")}
                      </td>
                      <td className="text-right font-bold text-danger tabular">−{peso(r.amount)}</td>
                      <td>{restocked ? <Chip tone="ok">Yes · {restocked}</Chip> : <Chip tone="neutral">No</Chip>}</td>
                      <td className="max-w-[220px] truncate" title={r.reason}>{r.reason}</td>
                      <td>{r.authorizedByName}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {history.length > 50 && <p className="px-4 py-3 text-xs text-ink-500">Showing the 50 most recent of {history.length}. Export CSV for the full list.</p>}
          </div>
        )}
      </section>
    </>
  );
}

function RefundForm({ tx, onClose }: { tx: SaleTransaction; onClose: () => void }) {
  const user = useCurrentUser();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [restock, setRestock] = useState<Record<string, boolean>>({});
  const [reasonPreset, setReasonPreset] = useState("");
  const [notes, setNotes] = useState("");
  const [approver, setApprover] = useState(user && hasPermission(user.role, "sales.refund") ? user.id : "");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState(false);

  const lines = tx.lines.map((l) => {
    const max = refundableQty(l);
    const q = Math.min(qty[l.id] ?? 0, max);
    return { l, max, q, amount: q ? refundAmountFor(l, q, tx) : 0, restock: max > 0 && (restock[l.id] ?? !l.rxRequired) };
  });
  const total = round2(lines.reduce((s, x) => s + x.amount, 0));
  const units = lines.reduce((s, x) => s + x.q, 0);
  const reason = [reasonPreset, notes.trim()].filter(Boolean).join(" — ");
  const ready = units > 0 && !!reason && !!approver && pin.length >= 4;

  const setLineQty = (id: string, v: number, max: number) => setQty((s) => ({ ...s, [id]: Math.max(0, Math.min(max, Math.round(v) || 0)) }));

  const submit = () => {
    const res = actions.createRefund({
      transactionId: tx.id,
      lines: lines.filter((x) => x.q > 0).map((x) => ({ saleLineId: x.l.id, qty: x.q, restock: x.restock })),
      reason,
      authorizedById: approver,
      pin,
    });
    if (!res.ok) {
      toast.error("Refund not processed", { description: res.error });
      return false;
    }
    toast.success(`Refund ${res.data.refundNo} recorded`, {
      description: `${peso(res.data.amount)} via ${PAYMENT_LABEL[res.data.method]} · ${res.data.lines.some((l) => l.restock) ? "restocked to saleable batch" : "not restocked"}`,
    });
    onClose();
    return true;
  };

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-xl font-bold">{tx.receiptNo}</span>
            <Chip tone={STATUS_META[tx.status].tone}>{STATUS_META[tx.status].label}</Chip>
          </span>
          <span className="text-[13px] text-ink-500">
            {formatDateTime(tx.createdAt)} · {tx.cashierName} · {PAYMENT_LABEL[tx.payment.method]} · paid {peso(tx.total)}
            {tx.discountType !== "none" ? ` (${tx.discountType === "manual" ? "manual" : tx.discountType === "senior" ? "SC" : "PWD"} discount applied)` : ""}
          </span>
        </div>
        <Button variant="ghost" size="icon-touch" onClick={onClose} aria-label="Close refund">
          <X />
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="data-table">
          <thead>
            <tr>
              <th>Medicine</th>
              <th className="text-right">Sold</th>
              <th className="text-right">Refunded</th>
              <th>Refund qty</th>
              <th>Return to stock</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(({ l, max, q, amount, restock: rs }) => (
              <tr key={l.id} className={cn(max === 0 && "opacity-60")}>
                <td>
                  <span className="flex flex-col gap-0.5">
                    <span className="font-semibold">
                      {l.name} {l.rxRequired && <Chip tone="brand" size="sm">Rx</Chip>}
                    </span>
                    <span className="text-xs text-ink-500">{peso(l.unitPrice)} / {l.unit}</span>
                  </span>
                </td>
                <td className="text-right tabular">{l.baseQty} {l.unit}</td>
                <td className="text-right text-ink-500 tabular">{l.refundedQty}</td>
                <td>
                  {max === 0 ? (
                    <span className="text-xs text-ink-500">Fully refunded</span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Button variant="outline" size="icon-sm" aria-label={`Decrease ${l.name}`} onClick={() => setLineQty(l.id, q - 1, max)} disabled={q === 0}>
                        <Minus />
                      </Button>
                      <input
                        type="number"
                        min={0}
                        max={max}
                        value={q}
                        onChange={(e) => setLineQty(l.id, Number(e.target.value), max)}
                        aria-label={`Refund quantity for ${l.name}, max ${max}`}
                        className="h-8 w-14 rounded-lg border border-line-strong bg-surface text-center text-sm font-semibold tabular outline-none focus:border-brand"
                      />
                      <Button variant="outline" size="icon-sm" aria-label={`Increase ${l.name}`} onClick={() => setLineQty(l.id, q + 1, max)} disabled={q >= max}>
                        <Plus />
                      </Button>
                      <button type="button" className="ml-1 text-xs font-semibold text-brand-700" onClick={() => setLineQty(l.id, max, max)}>
                        All {max}
                      </button>
                    </span>
                  )}
                </td>
                <td>
                  <label className="flex items-center gap-2 text-xs font-medium">
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--brand)]"
                      checked={rs}
                      disabled={max === 0}
                      onChange={(e) => setRestock((s) => ({ ...s, [l.id]: e.target.checked }))}
                    />
                    Saleable
                  </label>
                </td>
                <td className="text-right font-semibold tabular">{amount ? peso(amount) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="flex items-start gap-2 rounded-xl bg-canvas px-3 py-2.5 text-xs leading-relaxed text-ink-700">
        <PackageCheck className="mt-0.5 size-4 shrink-0 text-ok-dot" aria-hidden />
        Tick “Saleable” only when the pharmacist confirms the item is sealed, undamaged and within expiry — it is returned to a saleable batch. Otherwise it is refunded without restocking. Rx items default to not restocked.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Reason">
          <NativeSelect value={reasonPreset} onChange={(e) => setReasonPreset(e.target.value)}>
            <option value="">Choose a reason…</option>
            {REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
            <option value="Other">Other</option>
          </NativeSelect>
        </Field>
        <Field label="Notes" hint={reasonPreset === "Other" ? "Describe the reason." : "Optional details for the audit log."}>
          <TextArea rows={1} className="min-h-11" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. box unopened, receipt presented" />
        </Field>
      </div>

      <AuthorizeFields permission="sales.refund" userId={approver} onUserId={setApprover} pin={pin} onPin={setPin} />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <div className="flex flex-col">
          <span className="text-xs text-ink-500">
            Refund to customer · {units} unit{units === 1 ? "" : "s"} · via {PAYMENT_LABEL[tx.payment.method]}
            {tx.payment.method !== "cash" ? " (simulated reversal)" : ""}
          </span>
          <span className="font-heading text-2xl font-bold text-danger tabular">{peso(total)}</span>
          {tx.discountType !== "none" && <span className="text-xs text-ink-500">Pro-rated for the discount on the original sale.</span>}
        </div>
        <Button variant="brand" size="touch" disabled={!ready || (reasonPreset === "Other" && !notes.trim())} onClick={() => setConfirm(true)}>
          <Undo2 className="size-4" aria-hidden /> Process refund
        </Button>
      </div>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Refund ${peso(total)} on ${tx.receiptNo}?`}
        description={`${lines
          .filter((x) => x.q)
          .map((x) => `${x.q} × ${x.l.name}${x.restock ? " (restock)" : ""}`)
          .join(", ")}. Reason: ${reason}. This is recorded as a separate refund linked to the original sale.`}
        confirmLabel="Confirm refund"
        tone="brand"
        onConfirm={submit}
      />
    </div>
  );
}
