"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { motion, useReducedMotion } from "motion/react";
import { Archive, ArchiveRestore, ChevronLeft, ChevronRight, Download, FileUp, PackageSearch, Pencil, Plus, SlidersHorizontal } from "lucide-react";
import type { Medicine, StockInfo } from "@/lib/types";
import { useDb } from "@/lib/store/app-store";
import { actions } from "@/lib/store/actions";
import { useCan } from "@/hooks/use-session";
import { useLookups, useStockIndex } from "@/hooks/use-inventory";
import { useToday } from "@/hooks/use-today";
import { STOCK_STATUS_META, medicineName } from "@/lib/services/stock";
import { daysBetween, formatDate, formatMonthYear, peso, todayKey } from "@/lib/utils/format";
import { downloadCsv } from "@/lib/utils/csv";
import { PageShell } from "@/components/layout/app-shell";
import { SearchInput } from "@/components/shared/search-input";
import { FilterPills } from "@/components/shared/segmented";
import { NativeSelect } from "@/components/shared/field";
import { RxChip } from "@/components/shared/chip";
import { StockStatusChip } from "@/components/shared/stock-status-chip";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MedicineTile } from "./medicine-tile";
import { MedicineDetailPanel } from "./medicine-detail-panel";
import { MedicineFormDialog } from "./medicine-form-dialog";
import { CsvImportDialog } from "./csv-import-dialog";
import { StockAdjustmentDialog } from "@/components/stock/stock-adjustment-dialog";
import type { AdjustmentInitial } from "@/components/stock/stock-adjustment-form";
import { cn } from "@/lib/utils";

export type InventoryFilter = "all" | "in" | "low" | "out" | "expiring" | "expired" | "inactive";
const FILTERS: InventoryFilter[] = ["all", "in", "low", "out", "expiring", "expired", "inactive"];
const PAGE_SIZE = 25;

function matches(f: InventoryFilter, m: Medicine, s: StockInfo): boolean {
  switch (f) {
    case "all":
      return true;
    case "in":
      return m.status === "active" && !s.isOut && !s.isLow;
    case "low":
      return s.isLow;
    case "out":
      return s.isOut;
    case "expiring":
      return s.isExpiring;
    case "expired":
      return s.hasExpired;
    case "inactive":
      return m.status === "inactive";
  }
}

const FILTER_META: Record<InventoryFilter, { label: string; dot?: string }> = {
  all: { label: "All" },
  in: { label: "In stock", dot: "bg-ok-dot" },
  low: { label: "Low stock", dot: "bg-warn-dot" },
  out: { label: "Out of stock", dot: "bg-danger-dot" },
  expiring: { label: "Expiring soon", dot: "bg-orange-dot" },
  expired: { label: "Expired", dot: "bg-red-700" },
  inactive: { label: "Inactive", dot: "bg-neutral-dot" },
};

function parseFilter(v: string | null): InventoryFilter {
  return FILTERS.includes(v as InventoryFilter) ? (v as InventoryFilter) : "all";
}

function expiryLabel(info: StockInfo, today: string) {
  if (!info.nearestExpiry) return info.hasExpired ? "Expired (quarantined)" : "—";
  const d = daysBetween(today, info.nearestExpiry);
  return d <= 120 ? `${formatDate(info.nearestExpiry)}` : formatMonthYear(info.nearestExpiry);
}

export function InventoryView() {
  const db = useDb();
  const index = useStockIndex();
  const today = useToday();
  const { categories, suppliers } = useLookups();
  const canEdit = useCan("inventory.edit");
  const canAdjust = useCan("stock.adjust");
  const reduce = useReducedMotion();
  const params = useSearchParams();
  const paramMedicine = params.get("medicine");
  const paramFilter = params.get("filter");

  const sorted = useMemo(() => [...db.medicines].sort((a, b) => medicineName(a).localeCompare(medicineName(b))), [db.medicines]);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [filter, setFilter] = useState<InventoryFilter>(() => parseFilter(paramFilter));
  const [page, setPage] = useState(() => {
    const i = paramMedicine ? sorted.findIndex((m) => m.id === paramMedicine) : -1;
    return i > 0 ? Math.floor(i / PAGE_SIZE) : 0;
  });
  const [selectedId, setSelectedId] = useState<string | null>(paramMedicine);

  // Respond to query-param navigation (global search, alerts) without effects.
  const [seenParams, setSeenParams] = useState({ m: paramMedicine, f: paramFilter });
  if (seenParams.m !== paramMedicine || seenParams.f !== paramFilter) {
    setSeenParams({ m: paramMedicine, f: paramFilter });
    if (paramFilter !== seenParams.f) setFilter(parseFilter(paramFilter));
    if (paramMedicine && paramMedicine !== seenParams.m) {
      setQuery("");
      setCategory("all");
      setFilter("all");
      setSelectedId(paramMedicine);
      const i = sorted.findIndex((m) => m.id === paramMedicine);
      setPage(i > 0 ? Math.floor(i / PAGE_SIZE) : 0);
    } else if (paramFilter !== seenParams.f) setPage(0);
  }

  useEffect(() => {
    if (!paramMedicine) return;
    const id = requestAnimationFrame(() => document.getElementById(`med-row-${paramMedicine}`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
    return () => cancelAnimationFrame(id);
  }, [paramMedicine]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Medicine | undefined>();
  const [importOpen, setImportOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustInitial, setAdjustInitial] = useState<AdjustmentInitial | undefined>();
  const [archiveTarget, setArchiveTarget] = useState<Medicine | null>(null);
  const detailRef = useRef<HTMLElement>(null);

  const base = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sorted.filter(
      (m) => (category === "all" || m.categoryId === category) && (!q || `${m.brandName} ${m.genericName} ${m.strength} ${m.sku} ${m.barcode}`.toLowerCase().includes(q))
    );
  }, [sorted, query, category]);

  const counts = useMemo(() => {
    const c = Object.fromEntries(FILTERS.map((f) => [f, 0])) as Record<InventoryFilter, number>;
    for (const m of base) {
      const s = index.get(m.id);
      if (!s) continue;
      for (const f of FILTERS) if (matches(f, m, s)) c[f]++;
    }
    return c;
  }, [base, index]);

  const list = useMemo(() => base.filter((m) => matches(filter, m, index.get(m.id)!)), [base, filter, index]);
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const curPage = Math.min(page, pages - 1);
  const rows = list.slice(curPage * PAGE_SIZE, curPage * PAGE_SIZE + PAGE_SIZE);
  const selected = db.medicines.find((m) => m.id === selectedId) ?? rows[0];
  const selectedInfo = selected ? index.get(selected.id) : undefined;
  const totalSaleable = useMemo(() => [...index.values()].reduce((s, i) => s + i.saleable, 0), [index]);

  const select = (id: string) => {
    setSelectedId(id);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }));
    }
  };
  const openEdit = (m?: Medicine) => {
    setEditing(m);
    setFormOpen(true);
  };
  const openAdjust = (m: Medicine) => {
    setAdjustInitial({ medicineId: m.id, type: "adjustment" });
    setAdjustOpen(true);
  };

  const exportCsv = () => {
    const headers = ["ID", "SKU", "Barcode", "Brand", "Generic", "Category", "Dosage form", "Strength", "Packaging", "Unit", "Pack size", "Strip size", "Cost price", "Selling price", "Saleable stock", "Blocked units", "Reorder level", "Reorder qty", "Supplier", "Manufacturer", "Rx required", "Record status", "Stock status", "Nearest batch", "Nearest expiry", "Location"];
    const data = list.map((m) => {
      const s = index.get(m.id)!;
      return [m.id, m.sku, m.barcode, m.brandName, m.genericName, categories.get(m.categoryId)?.name, m.dosageForm, m.strength, m.packaging, m.unit, m.packSize, m.stripSize ?? "", m.costPrice.toFixed(2), m.sellingPrice.toFixed(2), s.saleable, s.blocked, m.minStock, m.reorderQty, suppliers.get(m.supplierId)?.name, m.manufacturer, m.rxRequired ? "yes" : "no", m.status, STOCK_STATUS_META[s.status].label, s.nearestBatchNo ?? "", s.nearestExpiry ?? "", m.location];
    });
    downloadCsv(`yasmar-inventory-${todayKey()}.csv`, headers, data);
    toast.success("Inventory exported", { description: `${data.length} medicines · demo data` });
  };

  const confirmArchive = () => {
    if (!archiveTarget) return;
    const next = archiveTarget.status === "active" ? "inactive" : "active";
    const res = actions.setMedicineStatus({ id: archiveTarget.id, status: next });
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    toast.success(next === "inactive" ? "Medicine archived" : "Medicine restored", { description: `${medicineName(archiveTarget)} ${next === "inactive" ? "is hidden from the POS" : "can be sold again"}` });
  };

  return (
    <PageShell permission="inventory.view" title="Medicine Inventory" subtitle={`${db.medicines.length} SKUs · ${totalSaleable.toLocaleString()} saleable units · batch-tracked`}>
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex min-w-0 flex-[1_1_420px] flex-wrap items-center gap-2">
          <SearchInput value={query} onChange={(v) => { setQuery(v); setPage(0); }} placeholder="Generic, brand, SKU or barcode" ariaLabel="Search inventory" className="w-full sm:w-[280px]" />
          <NativeSelect value={category} onChange={(e) => { setCategory(e.target.value); setPage(0); }} aria-label="Category" className="h-[42px] w-full font-semibold sm:w-[200px]">
            <option value="all">All categories</option>
            {db.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button variant="outline" size="md" onClick={() => setImportOpen(true)}>
              <FileUp className="size-4" aria-hidden /> Import CSV
            </Button>
          )}
          <Button variant="outline" size="md" onClick={exportCsv}>
            <Download className="size-4" aria-hidden /> Export
          </Button>
          {canEdit && (
            <Button variant="brand" size="md" onClick={() => openEdit(undefined)}>
              <Plus className="size-4" aria-hidden /> Add medicine
            </Button>
          )}
        </div>
      </div>

      <FilterPills
        value={filter}
        onChange={(f) => { setFilter(f); setPage(0); }}
        options={FILTERS.map((f) => ({ value: f, label: FILTER_META[f].label, count: counts[f], dotClass: FILTER_META[f].dot }))}
      />

      <div className="flex flex-wrap items-start gap-4">
        <div className="card-surface min-w-0 flex-[999_1_640px] overflow-hidden">
          {rows.length === 0 ? (
            <EmptyState icon={PackageSearch} title="No medicines match" description="Try a different search, category or status filter." action={<Button variant="soft" size="md" onClick={() => { setQuery(""); setCategory("all"); setFilter("all"); }}>Clear filters</Button>} />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>SKU / Barcode</th>
                    <th className="text-right!">Stock</th>
                    <th>Unit</th>
                    <th className="text-right!">Price</th>
                    <th className="text-right!">Reorder</th>
                    <th>Nearest expiry</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((m) => {
                    const s = index.get(m.id)!;
                    const isSel = selected?.id === m.id;
                    return (
                      <tr key={m.id} id={`med-row-${m.id}`} className={cn(isSel && "bg-brand-50! hover:bg-brand-50!", m.status === "inactive" && !isSel && "opacity-60")}>
                        <td>
                          <button type="button" onClick={() => select(m.id)} aria-label={`Show details for ${medicineName(m)}`} aria-pressed={isSel} className="flex items-center gap-2.5 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                            <MedicineTile medicine={m} status={s.status} />
                            <span className="flex flex-col gap-0.5">
                              <span className="flex items-center gap-1.5 text-[13px] font-semibold">
                                {medicineName(m)} {m.rxRequired && <RxChip size="sm" />}
                              </span>
                              <span className="max-w-[260px] truncate text-xs font-normal text-ink-500">
                                {m.genericName} · {m.dosageForm}
                              </span>
                            </span>
                          </button>
                        </td>
                        <td>{categories.get(m.categoryId)?.name}</td>
                        <td>
                          <span className="flex flex-col gap-0.5 font-mono text-xs">
                            <span>{m.sku}</span>
                            <span className="text-ink-500">{m.barcode}</span>
                          </span>
                        </td>
                        <td className="text-right font-bold tabular">{s.saleable.toLocaleString()}</td>
                        <td className="text-ink-500">{m.unit}</td>
                        <td className="text-right tabular">{peso(m.sellingPrice)}</td>
                        <td className="text-right text-ink-500 tabular">{m.minStock}</td>
                        <td className={cn(s.isExpiring && "font-semibold text-orange")}>{expiryLabel(s, today)}</td>
                        <td>
                          <motion.span key={s.status} initial={reduce ? false : { opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.22 }} className="inline-flex">
                            <StockStatusChip status={s.status} />
                          </motion.span>
                        </td>
                        <td>
                          <span className="flex gap-1">
                            {canEdit && <RowAction label="Edit medicine" onClick={() => openEdit(m)} icon={<Pencil className="size-4" />} />}
                            {canAdjust && <RowAction label="Adjust stock" onClick={() => openAdjust(m)} icon={<SlidersHorizontal className="size-4" />} />}
                            {canEdit && (
                              <RowAction
                                label={m.status === "active" ? "Archive medicine" : "Restore medicine"}
                                onClick={() => setArchiveTarget(m)}
                                icon={m.status === "active" ? <Archive className="size-4" /> : <ArchiveRestore className="size-4" />}
                              />
                            )}
                            {!canEdit && !canAdjust && <span className="text-xs text-ink-400">View only</span>}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[13px] font-medium text-ink-500">
            <span>
              {list.length ? `${curPage * PAGE_SIZE + 1}–${curPage * PAGE_SIZE + rows.length} of ${list.length} shown` : "0 shown"} · {db.medicines.length} SKUs total
            </span>
            <span className="flex items-center gap-2">
              Rows per page: {PAGE_SIZE}
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
        </div>

        <aside ref={detailRef} aria-label="Medicine details" className="card-surface flex min-w-0 flex-[1_1_360px] scroll-mt-24 flex-col p-5 lg:sticky lg:top-[88px]">
          {selected && selectedInfo ? (
            <MedicineDetailPanel medicine={selected} info={selectedInfo} canEdit={canEdit} canAdjust={canAdjust} onEdit={() => openEdit(selected)} onAdjust={() => openAdjust(selected)} />
          ) : (
            <EmptyState icon={PackageSearch} title="Select a medicine" description="Choose a row to see batches, pricing and stock movement." />
          )}
        </aside>
      </div>

      <MedicineFormDialog open={formOpen} onOpenChange={setFormOpen} medicine={editing} onSaved={(m) => setSelectedId(m.id)} />
      <CsvImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <StockAdjustmentDialog open={adjustOpen} onOpenChange={setAdjustOpen} initial={adjustInitial} />
      <ConfirmDialog
        open={!!archiveTarget}
        onOpenChange={(o) => !o && setArchiveTarget(null)}
        title={archiveTarget?.status === "active" ? `Archive ${archiveTarget ? medicineName(archiveTarget) : ""}?` : `Restore ${archiveTarget ? medicineName(archiveTarget) : ""}?`}
        description={
          archiveTarget?.status === "active"
            ? "Archived medicines are hidden from the POS and can no longer be sold. Batches, sales history and movements are kept, and you can restore it anytime."
            : "The medicine becomes sellable again at the POS (only unexpired, saleable batches)."
        }
        confirmLabel={archiveTarget?.status === "active" ? "Archive medicine" : "Restore medicine"}
        tone={archiveTarget?.status === "active" ? "danger" : "brand"}
        onConfirm={confirmArchive}
      />
    </PageShell>
  );
}

function RowAction({ label, onClick, icon }: { label: string; onClick: () => void; icon: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button type="button" onClick={onClick} aria-label={label} className="inline-grid size-9 place-items-center rounded-[9px] border border-line bg-surface text-ink-700 hover:bg-canvas">
            {icon}
          </button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
