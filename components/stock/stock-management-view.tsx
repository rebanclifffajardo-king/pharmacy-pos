"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, Download, History, PackageCheck, Plus, SlidersHorizontal } from "lucide-react";
import type { ActivityKind, Batch, MovementType } from "@/lib/types";
import { useDb } from "@/lib/store/app-store";
import { useCan } from "@/hooks/use-session";
import { useLookups } from "@/hooks/use-inventory";
import { useToday } from "@/hooks/use-today";
import { fefoSort, medicineName } from "@/lib/services/stock";
import type { AdjustmentType } from "@/lib/services/inventory-service";
import { daysBetween, formatDate, formatDateTime, formatRelative, peso, round2 } from "@/lib/utils/format";
import { downloadCsv } from "@/lib/utils/csv";
import { PageShell } from "@/components/layout/app-shell";
import { Segmented } from "@/components/shared/segmented";
import { SearchInput } from "@/components/shared/search-input";
import { NativeSelect } from "@/components/shared/field";
import { Chip, type ChipTone } from "@/components/shared/chip";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { ExpiryChip, BatchStatusChip, batchStatusInfo } from "./batch-chips";
import { StockAdjustmentDialog } from "./stock-adjustment-dialog";
import { StockAdjustmentForm, type AdjustmentInitial } from "./stock-adjustment-form";
import { cn } from "@/lib/utils";

type Tab = "all" | "90" | "60" | "30" | "expired" | "movements" | "activity";
const TABS: Tab[] = ["all", "90", "60", "30", "expired", "movements", "activity"];
const parseTab = (v: string | null): Tab => (TABS.includes(v as Tab) ? (v as Tab) : "all");

const MOVEMENT_META: Record<MovementType, { label: string; tone: ChipTone }> = {
  sale: { label: "Sale", tone: "brand" },
  refund_restock: { label: "Refund restock", tone: "teal" },
  void_restock: { label: "Void restock", tone: "neutral" },
  stock_in: { label: "Stock in", tone: "ok" },
  stock_out: { label: "Stock out", tone: "warn" },
  adjustment: { label: "Adjustment", tone: "orange" },
  po_receipt: { label: "PO receipt", tone: "ok" },
  write_off: { label: "Write-off", tone: "danger" },
  quarantine: { label: "Quarantine", tone: "solid-danger" },
  release: { label: "Release", tone: "teal" },
};

const TONE_DOT: Record<string, string> = { info: "bg-brand", success: "bg-ok-dot", warning: "bg-warn-dot", danger: "bg-red-700", neutral: "bg-neutral-dot" };
const PAGE = 50;

export function StockManagementView() {
  const db = useDb();
  const today = useToday();
  const reduce = useReducedMotion();
  const { medicines, suppliers } = useLookups();
  const canAdjust = useCan("stock.adjust");
  const params = useSearchParams();
  const paramTab = params.get("tab");

  const [tab, setTab] = useState<Tab>(() => parseTab(paramTab));
  const [seenTab, setSeenTab] = useState(paramTab);
  if (seenTab !== paramTab) {
    setSeenTab(paramTab);
    setTab(parseTab(paramTab));
  }
  const [query, setQuery] = useState("");
  const [moveType, setMoveType] = useState<"all" | MovementType>("all");
  const [activityKind, setActivityKind] = useState<"all" | ActivityKind>("all");
  const [page, setPage] = useState(0);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustInitial, setAdjustInitial] = useState<AdjustmentInitial | undefined>();

  const onHand = useMemo(() => db.batches.filter((b) => b.quantity > 0).sort(fefoSort), [db.batches]);

  const buckets = useMemo(() => {
    const mk = () => ({ count: 0, units: 0, value: 0 });
    const r = { expired: mk(), d30: mk(), d60: mk(), d90: mk() };
    for (const b of onHand) {
      const d = daysBetween(today, b.expiryDate);
      const k = d <= 0 ? "expired" : d <= 30 ? "d30" : d <= 60 ? "d60" : d <= 90 ? "d90" : null;
      if (!k) continue;
      r[k].count++;
      r[k].units += b.quantity;
      r[k].value += b.quantity * b.unitCost;
    }
    return r;
  }, [onHand, today]);

  const batchRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return onHand.filter((b) => {
      const d = daysBetween(today, b.expiryDate);
      if (tab === "expired" && d > 0) return false;
      if ((tab === "90" || tab === "60" || tab === "30") && (d <= 0 || d > Number(tab))) return false;
      if (!q) return true;
      const m = medicines.get(b.medicineId);
      return `${m ? medicineName(m) : ""} ${m?.genericName ?? ""} ${b.batchNo} ${m?.sku ?? ""}`.toLowerCase().includes(q);
    });
  }, [onHand, tab, query, today, medicines]);

  const moveRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.movements.filter((mv) => {
      if (moveType !== "all" && mv.type !== moveType) return false;
      if (!q) return true;
      const m = medicines.get(mv.medicineId);
      return `${m ? medicineName(m) : ""} ${mv.batchNo ?? ""} ${mv.reference ?? ""} ${mv.userName} ${mv.reason ?? ""}`.toLowerCase().includes(q);
    });
  }, [db.movements, moveType, query, medicines]);

  const activityRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.activity.filter((a) => (activityKind === "all" || a.kind === activityKind) && (!q || `${a.message} ${a.userName}`.toLowerCase().includes(q)));
  }, [db.activity, activityKind, query]);

  const totalRows = tab === "movements" ? moveRows.length : tab === "activity" ? activityRows.length : batchRows.length;
  const pages = Math.max(1, Math.ceil(totalRows / PAGE));
  const curPage = Math.min(page, pages - 1);
  const slice = <T,>(arr: T[]) => arr.slice(curPage * PAGE, curPage * PAGE + PAGE);

  const firstExpired = onHand.find((b) => daysBetween(today, b.expiryDate) <= 0);

  const openAdjust = (initial?: AdjustmentInitial) => {
    setAdjustInitial(initial);
    setAdjustOpen(true);
  };

  const rowAction = (b: Batch): { label: string; initial: AdjustmentInitial } => {
    const d = daysBetween(today, b.expiryDate);
    if (d <= 0) return { label: "Write off", initial: { medicineId: b.medicineId, batchId: b.id, type: "write_off", quantity: b.quantity } };
    if (b.status === "quarantined" || b.status === "recalled") return { label: "Release", initial: { medicineId: b.medicineId, batchId: b.id, type: "release" as AdjustmentType } };
    if (d <= 30) return { label: "Return", initial: { medicineId: b.medicineId, batchId: b.id, type: "stock_out", quantity: b.quantity, reason: "Return to supplier" } };
    if (d <= 90) return { label: "Quarantine", initial: { medicineId: b.medicineId, batchId: b.id, type: "quarantine" } };
    return { label: "Adjust", initial: { medicineId: b.medicineId, batchId: b.id, type: "adjustment" } };
  };

  const exportCsv = () => {
    if (tab === "movements") {
      downloadCsv(`yasmar-stock-movements-${today}.csv`, ["Date", "Medicine", "Batch", "Type", "Qty", "Balance after", "Reference", "Reason", "User", "Authorized by"], moveRows.map((mv) => [formatDateTime(mv.createdAt), medicines.get(mv.medicineId) ? medicineName(medicines.get(mv.medicineId)!) : mv.medicineId, mv.batchNo ?? "", MOVEMENT_META[mv.type].label, mv.qty, mv.balanceAfter ?? "", mv.reference ?? "", mv.reason ?? "", mv.userName, mv.authorizedByName ?? ""]));
    } else if (tab === "activity") {
      downloadCsv(`yasmar-activity-log-${today}.csv`, ["Date", "Type", "Message", "User"], activityRows.map((a) => [formatDateTime(a.createdAt), a.kind, a.message, a.userName]));
    } else {
      downloadCsv(
        `yasmar-expiry-report-${tab}-${today}.csv`,
        ["Medicine", "SKU", "Batch", "Supplier", "Received", "Expiry", "Days to expiry", "Initial", "Remaining", "Unit cost", "Value at cost", "Location", "Status"],
        batchRows.map((b) => {
          const m = medicines.get(b.medicineId);
          return [m ? medicineName(m) : b.medicineId, m?.sku ?? "", b.batchNo, suppliers.get(b.supplierId)?.name ?? "", b.receivedDate, b.expiryDate, daysBetween(today, b.expiryDate), b.initialQty, b.quantity, b.unitCost.toFixed(2), round2(b.quantity * b.unitCost).toFixed(2), b.location, batchStatusInfo(b, today).label];
        })
      );
    }
    toast.success("CSV exported", { description: `${totalRows} rows · demo data` });
  };

  const tabLabel: Record<Tab, string> = {
    all: "All batches",
    "90": "Expiring ≤ 90 days",
    "60": "≤ 60 days",
    "30": "≤ 30 days",
    expired: "Expired",
    movements: "Movement history",
    activity: "Activity log",
  };
  const tabCount: Partial<Record<Tab, number>> = {
    all: onHand.length,
    "90": buckets.d30.count + buckets.d60.count + buckets.d90.count,
    "60": buckets.d30.count + buckets.d60.count,
    "30": buckets.d30.count,
    expired: buckets.expired.count,
  };

  return (
    <PageShell permission="stock.view" title="Stock Management" subtitle="Batches, expiry monitoring and adjustments">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <Bucket
          className="bg-red-700 text-white"
          title="Expired · quarantined"
          value={buckets.expired.count}
          note={`${buckets.expired.units.toLocaleString()} units · ${peso(buckets.expired.value)} at cost · excluded from sale`}
          onClick={() => { setTab("expired"); setPage(0); }}
        />
        <Bucket className="border border-red-100 bg-danger-bg text-danger" title="Within 30 days" value={buckets.d30.count} note={`${buckets.d30.units.toLocaleString()} units · ${peso(buckets.d30.value)} · sell first, consider supplier return`} onClick={() => { setTab("30"); setPage(0); }} />
        <Bucket className="border border-orange-line bg-orange-bg text-orange" title="31 – 60 days" value={buckets.d60.count} note={`${buckets.d60.units.toLocaleString()} units · ${peso(buckets.d60.value)} · FEFO prioritized at POS`} onClick={() => { setTab("60"); setPage(0); }} />
        <Bucket className="border border-warn-line bg-warn-bg text-warn" title="61 – 90 days" value={buckets.d90.count} note={`${buckets.d90.units.toLocaleString()} units · ${peso(buckets.d90.value)} · monitor`} onClick={() => { setTab("90"); setPage(0); }} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          variant="dark"
          ariaLabel="Stock views"
          value={tab}
          onChange={(t) => { setTab(t); setPage(0); }}
          options={TABS.map((t) => ({ value: t, label: tabLabel[t], count: tabCount[t] }))}
        />
        {canAdjust && (
          <Button variant="brand" size="md" onClick={() => openAdjust(undefined)}>
            <Plus className="size-4" aria-hidden /> New adjustment
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div className="card-surface min-w-0 flex-[999_1_640px] overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2.5 p-4">
            <div className="flex min-w-0 flex-col gap-0.5">
              <h2 className="font-heading text-[17px] font-semibold">
                {tab === "movements" ? "Stock movement history" : tab === "activity" ? "Inventory activity log" : tab === "all" ? "All batches on hand" : "Batches nearing or past expiry"}
              </h2>
              <span className="text-xs text-ink-500">
                {tab === "movements"
                  ? "Every sale, receipt, adjustment, refund and quarantine — newest first."
                  : tab === "activity"
                    ? "Audit trail of user actions across the system."
                    : "Sorted by expiry date (FEFO). Quarantined, recalled and expired batches never count as saleable stock."}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput value={query} onChange={(v) => { setQuery(v); setPage(0); }} placeholder={tab === "activity" ? "Search activity" : "Medicine, batch, reference"} className="w-full sm:w-[230px]" />
              {tab === "movements" && (
                <NativeSelect value={moveType} onChange={(e) => { setMoveType(e.target.value as typeof moveType); setPage(0); }} aria-label="Movement type" className="h-[42px] w-full sm:w-[170px]">
                  <option value="all">All types</option>
                  {(Object.keys(MOVEMENT_META) as MovementType[]).map((t) => (
                    <option key={t} value={t}>
                      {MOVEMENT_META[t].label}
                    </option>
                  ))}
                </NativeSelect>
              )}
              {tab === "activity" && (
                <NativeSelect value={activityKind} onChange={(e) => { setActivityKind(e.target.value as typeof activityKind); setPage(0); }} aria-label="Activity type" className="h-[42px] w-full capitalize sm:w-[150px]">
                  <option value="all">All activity</option>
                  {(["sale", "refund", "void", "inventory", "purchase", "supplier", "user", "settings", "auth", "print"] as ActivityKind[]).map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </NativeSelect>
              )}
              <Button variant="outline" size="md" onClick={exportCsv}>
                <Download className="size-4" aria-hidden /> {tab === "movements" || tab === "activity" ? "Export CSV" : "Export expiry report"}
              </Button>
            </div>
          </div>

          {totalRows === 0 ? (
            <EmptyState icon={tab === "movements" || tab === "activity" ? History : PackageCheck} title="Nothing to show" description={query ? "No rows match your search." : tab === "expired" ? "No expired stock on hand." : "No batches in this window."} />
          ) : tab === "movements" ? (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Medicine</th>
                    <th>Batch</th>
                    <th>Type</th>
                    <th className="text-right!">Qty</th>
                    <th className="text-right!">Balance after</th>
                    <th>Reference</th>
                    <th>Reason</th>
                    <th>User</th>
                    <th>Authorized by</th>
                  </tr>
                </thead>
                <tbody>
                  {slice(moveRows).map((mv) => {
                    const m = medicines.get(mv.medicineId);
                    return (
                      <tr key={mv.id}>
                        <td className="text-ink-500">{formatRelative(mv.createdAt)}</td>
                        <td className="font-semibold">{m ? medicineName(m) : mv.medicineId}</td>
                        <td className="font-mono text-xs">{mv.batchNo ?? "—"}</td>
                        <td>
                          <Chip tone={MOVEMENT_META[mv.type].tone}>{MOVEMENT_META[mv.type].label}</Chip>
                        </td>
                        <td className={cn("text-right font-bold tabular", mv.qty < 0 ? "text-danger" : "text-ok")}>
                          {mv.qty > 0 ? "+" : mv.qty < 0 ? "−" : ""}
                          {Math.abs(mv.qty).toLocaleString()}
                        </td>
                        <td className="text-right text-ink-500 tabular">{mv.balanceAfter ?? "—"}</td>
                        <td className="font-mono text-xs">{mv.reference ?? "—"}</td>
                        <td className="max-w-[240px] truncate text-ink-700" title={mv.reason}>
                          {mv.reason ?? "—"}
                        </td>
                        <td>{mv.userName}</td>
                        <td className="text-ink-500">{mv.authorizedByName ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : tab === "activity" ? (
            <ul className="flex flex-col px-4 pb-2">
              {slice(activityRows).map((a) => (
                <li key={a.id} className="grid grid-cols-[12px_minmax(0,1fr)_auto] items-start gap-3 border-b border-line-soft py-2.5 last:border-0">
                  <span className={cn("mt-1 block size-2.5 rounded-full", TONE_DOT[a.tone])} aria-hidden />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[13px] font-medium">{a.message}</span>
                    <span className="text-xs text-ink-500 capitalize">
                      {a.kind} · {a.userName}
                    </span>
                  </span>
                  <span className="text-xs whitespace-nowrap text-ink-500">{formatRelative(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Batch</th>
                    <th>Supplier</th>
                    <th>Received</th>
                    <th>Expiry</th>
                    <th className="text-right!">Initial</th>
                    <th className="text-right!">Remaining</th>
                    <th className="text-right!">Value at cost</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {slice(batchRows).map((b) => {
                    const m = medicines.get(b.medicineId);
                    const act = rowAction(b);
                    const st = batchStatusInfo(b, today);
                    return (
                      <tr key={b.id}>
                        <td className="font-semibold">{m ? medicineName(m) : b.medicineId}</td>
                        <td className="font-mono text-xs">{b.batchNo}</td>
                        <td>{suppliers.get(b.supplierId)?.name ?? "—"}</td>
                        <td className="text-ink-500">{formatDate(b.receivedDate)}</td>
                        <td>
                          <ExpiryChip expiryDate={b.expiryDate} today={today} />
                        </td>
                        <td className="text-right text-ink-500 tabular">{b.initialQty.toLocaleString()}</td>
                        <td className="text-right font-bold tabular">{b.quantity.toLocaleString()}</td>
                        <td className="text-right tabular">{peso(b.quantity * b.unitCost)}</td>
                        <td className="font-mono text-xs">{b.location}</td>
                        <td>
                          <motion.span key={st.label} initial={reduce ? false : { opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.22 }} className="inline-flex">
                            <BatchStatusChip batch={b} today={today} />
                          </motion.span>
                        </td>
                        <td>
                          {canAdjust && (
                            <span className="flex gap-1">
                              <button type="button" onClick={() => openAdjust(act.initial)} className="h-8 rounded-lg border border-line bg-surface px-2.5 text-xs font-semibold hover:bg-canvas">
                                {act.label}
                              </button>
                              {act.label !== "Adjust" && (
                                <button
                                  type="button"
                                  aria-label={`Adjust batch ${b.batchNo}`}
                                  title="Other adjustment"
                                  onClick={() => openAdjust({ medicineId: b.medicineId, batchId: b.id, type: "adjustment" })}
                                  className="grid size-8 place-items-center rounded-lg border border-line bg-surface text-ink-700 hover:bg-canvas"
                                >
                                  <SlidersHorizontal className="size-3.5" />
                                </button>
                              )}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {totalRows > PAGE && (
            <div className="flex items-center justify-between gap-2 px-4 py-3 text-[13px] font-medium text-ink-500">
              <span>
                {curPage * PAGE + 1}–{Math.min(totalRows, (curPage + 1) * PAGE)} of {totalRows.toLocaleString()}
              </span>
              <span className="flex items-center gap-2">
                <Button variant="outline" size="icon" aria-label="Previous page" disabled={curPage === 0} onClick={() => setPage(curPage - 1)}>
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="tabular">
                  {curPage + 1} / {pages}
                </span>
                <Button variant="outline" size="icon" aria-label="Next page" disabled={curPage >= pages - 1} onClick={() => setPage(curPage + 1)}>
                  <ChevronRight className="size-4" />
                </Button>
              </span>
            </div>
          )}
        </div>

        {canAdjust && (
          <aside aria-label="Inventory adjustment" className="card-surface flex min-w-0 flex-[1_1_340px] flex-col gap-3.5 p-5">
            <div className="flex flex-col gap-0.5">
              <h2 className="font-heading text-[17px] font-semibold">{firstExpired ? "Write off expired stock" : "Quick stock adjustment"}</h2>
              <span className="text-xs text-ink-500">Inventory adjustment · needs an authorized approver</span>
            </div>
            {firstExpired && (
              <div className="flex flex-col gap-0.5 rounded-xl bg-danger-bg p-3">
                <span className="text-sm font-semibold text-danger">
                  {medicines.get(firstExpired.medicineId) ? medicineName(medicines.get(firstExpired.medicineId)!) : ""} · {firstExpired.batchNo}
                </span>
                <span className="text-xs font-medium text-danger">
                  Expired {formatDate(firstExpired.expiryDate)} · {firstExpired.quantity} {medicines.get(firstExpired.medicineId)?.unit} in {firstExpired.location}
                </span>
              </div>
            )}
            <StockAdjustmentForm
              key={firstExpired ? `wo-${firstExpired.id}-${firstExpired.quantity}` : "quick"}
              initial={
                firstExpired
                  ? { medicineId: firstExpired.medicineId, batchId: firstExpired.id, type: "write_off", quantity: firstExpired.quantity, reason: "Expired — dispose per DOH/FDA guidance" }
                  : { type: "adjustment" }
              }
              submitLabel={firstExpired ? "Write off batch" : "Apply adjustment"}
            />
          </aside>
        )}
      </div>

      <StockAdjustmentDialog open={adjustOpen} onOpenChange={setAdjustOpen} initial={adjustInitial} />
    </PageShell>
  );
}

function Bucket({ title, value, note, className, onClick }: { title: string; value: number; note: string; className?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex flex-col gap-1.5 rounded-2xl p-[18px] text-left transition-transform duration-150 hover:-translate-y-0.5", className)}>
      <span className="text-[13px] font-semibold opacity-90">{title}</span>
      <span className="font-heading text-[30px] leading-tight font-semibold tabular">
        {value} batch{value === 1 ? "" : "es"}
      </span>
      <span className="text-xs font-medium opacity-90">{note}</span>
    </button>
  );
}
