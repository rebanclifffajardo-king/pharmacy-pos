"use client";

import { useMemo, useState } from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { PurchaseOrder } from "@/lib/types";
import { useDb } from "@/lib/store/app-store";
import { actions } from "@/lib/store/actions";
import { useStockIndex } from "@/hooks/use-inventory";
import { lowStockRows } from "@/lib/services/report-service";
import { medicineName, STOCK_STATUS_META } from "@/lib/services/stock";
import { addDays, peso, round2, todayKey } from "@/lib/utils/format";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, MoneyInput, NativeSelect, TextArea, TextInput } from "@/components/shared/field";
import { SearchInput } from "@/components/shared/search-input";
import { Chip } from "@/components/shared/chip";

interface DraftLine {
  key: string;
  medicineId: string;
  qty: string;
  unitCost: string;
  lineId?: string;
}

export interface PoPrefill {
  supplierId?: string;
  medicineId?: string;
}

export function PoFormDialog({
  open,
  onOpenChange,
  editing,
  prefill,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing?: PurchaseOrder | null;
  prefill?: PoPrefill;
  onSaved: (po: PurchaseOrder) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto rounded-2xl p-0 sm:max-w-[920px]">
        {open && <PoForm key={editing?.id ?? `new-${prefill?.supplierId ?? ""}-${prefill?.medicineId ?? ""}`} editing={editing} prefill={prefill} onDone={(po) => { onSaved(po); onOpenChange(false); }} onCancel={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

let keySeq = 0;
const nextKey = () => `l${++keySeq}`;

function PoForm({ editing, prefill, onDone, onCancel }: { editing?: PurchaseOrder | null; prefill?: PoPrefill; onDone: (po: PurchaseOrder) => void; onCancel: () => void }) {
  const db = useDb();
  const index = useStockIndex();
  const medById = useMemo(() => new Map(db.medicines.map((m) => [m.id, m])), [db.medicines]);
  const activeSuppliers = db.suppliers.filter((s) => s.status === "active");

  const prefillMed = prefill?.medicineId ? medById.get(prefill.medicineId) : undefined;
  const initialSupplier = editing?.supplierId ?? prefill?.supplierId ?? prefillMed?.supplierId ?? activeSuppliers[0]?.id ?? "";
  const defaultLine = (medicineId: string): DraftLine => {
    const m = medById.get(medicineId)!;
    return { key: nextKey(), medicineId, qty: String(Math.max(1, Math.ceil(m.reorderQty / m.packSize))), unitCost: (m.costPrice * m.packSize).toFixed(2) };
  };

  const [supplierId, setSupplierId] = useState(initialSupplier);
  const [expectedDate, setExpectedDate] = useState(editing?.expectedDate ?? addDays(todayKey(), db.suppliers.find((s) => s.id === initialSupplier)?.leadTimeDays ?? 3));
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [lines, setLines] = useState<DraftLine[]>(() =>
    editing
      ? editing.lines.map((l) => ({ key: nextKey(), lineId: l.id, medicineId: l.medicineId, qty: String(l.qty), unitCost: l.unitCost.toFixed(2) }))
      : prefillMed
        ? [defaultLine(prefillMed.id)]
        : []
  );
  const [q, setQ] = useState("");
  const [allSuppliers, setAllSuppliers] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inCart = useMemo(() => new Set(lines.map((l) => l.medicineId)), [lines]);
  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    return db.medicines
      .filter((m) => m.status === "active" && !inCart.has(m.id) && (allSuppliers || m.supplierId === supplierId))
      .filter((m) => !term || `${m.brandName} ${m.genericName} ${m.sku} ${m.strength}`.toLowerCase().includes(term))
      .slice(0, 8);
  }, [db.medicines, q, allSuppliers, supplierId, inCart]);

  const lowForSupplier = useMemo(() => lowStockRows(db, index).filter((r) => r.supplierId === supplierId && !inCart.has(r.medicineId)), [db, index, supplierId, inCart]);

  const total = round2(lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitCost) || 0), 0));

  const addLine = (medicineId: string) => {
    setLines((ls) => (ls.some((l) => l.medicineId === medicineId) ? ls : [...ls, defaultLine(medicineId)]));
    setQ("");
  };
  const update = (key: string, patch: Partial<DraftLine>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const save = (submit: boolean) => {
    setError(null);
    const res = actions.savePurchaseOrder({
      id: editing?.id,
      supplierId,
      expectedDate: expectedDate || undefined,
      notes,
      submit,
      lines: lines.map((l) => ({ id: l.lineId, medicineId: l.medicineId, qty: Math.round(Number(l.qty)), unitCost: Number(l.unitCost) })),
    });
    if (!res.ok) {
      setError(res.error);
      toast.error(res.error);
      return;
    }
    toast.success(submit ? `${res.data.poNumber} sent to supplier` : `${res.data.poNumber} saved as draft`, { description: `${res.data.lines.length} line(s) · ${peso(total)}` });
    onDone(res.data);
  };

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex flex-col gap-1 pr-8">
        <DialogTitle className="font-heading text-xl font-semibold">{editing ? `Edit draft ${editing.poNumber}` : "New purchase order"}</DialogTitle>
        <DialogDescription className="text-[13px] text-ink-500">Quantities are in packs. Unit cost is per pack. Stock only changes when goods are received with a batch number and expiry date.</DialogDescription>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.5fr_1fr]">
        <Field label="Supplier">
          <NativeSelect
            value={supplierId}
            onChange={(e) => {
              setSupplierId(e.target.value);
              const s = db.suppliers.find((x) => x.id === e.target.value);
              if (s && !editing) setExpectedDate(addDays(todayKey(), s.leadTimeDays));
            }}
          >
            {activeSuppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.city} · {s.paymentTerms}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Expected delivery">
          <TextInput type="date" value={expectedDate} min={todayKey()} onChange={(e) => setExpectedDate(e.target.value)} />
        </Field>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-ink-700">Add medicines</span>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs font-medium text-ink-500">
              <input type="checkbox" checked={allSuppliers} onChange={(e) => setAllSuppliers(e.target.checked)} className="size-4 accent-[var(--brand)]" />
              Show all suppliers’ medicines
            </label>
            <Button
              type="button"
              variant="soft"
              size="md"
              disabled={!lowForSupplier.length}
              onClick={() => setLines((ls) => [...ls, ...lowForSupplier.map((r) => defaultLine(r.medicineId))])}
            >
              <Sparkles className="size-4" aria-hidden /> Add low-stock items ({lowForSupplier.length})
            </Button>
          </div>
        </div>
        <div className="relative">
          <SearchInput value={q} onChange={setQ} placeholder="Search generic, brand or SKU" ariaLabel="Search medicines to add" />
          {(q.trim() || results.length > 0) && (
            <div className="mt-1.5 flex max-h-56 flex-col overflow-y-auto rounded-xl border border-line bg-surface">
              {results.length === 0 && <span className="px-3 py-3 text-[13px] text-ink-500">No matching medicines{allSuppliers ? "" : " from this supplier"}.</span>}
              {results.map((m) => {
                const info = index.get(m.id);
                return (
                  <button key={m.id} type="button" onClick={() => addLine(m.id)} className="flex items-center gap-3 border-b border-line-soft px-3 py-2 text-left last:border-b-0 hover:bg-canvas">
                    <Plus className="size-4 shrink-0 text-brand" aria-hidden />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[13px] font-semibold">{medicineName(m)}</span>
                      <span className="truncate text-xs text-ink-500">
                        {m.genericName} · {m.sku} · {m.packaging}
                      </span>
                    </span>
                    {info && (
                      <Chip tone={STOCK_STATUS_META[info.status].tone} dot>
                        {info.saleable.toLocaleString()} {m.unit}
                      </Chip>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="data-table">
          <thead>
            <tr>
              <th>Medicine</th>
              <th className="text-right!">Packs</th>
              <th className="text-right!">Unit cost / pack</th>
              <th className="text-right!">Line total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8! text-center text-ink-500">
                  No medicines yet — search above or add this supplier’s low-stock items.
                </td>
              </tr>
            )}
            {lines.map((l) => {
              const m = medById.get(l.medicineId);
              const info = index.get(l.medicineId);
              const lineTotal = (Number(l.qty) || 0) * (Number(l.unitCost) || 0);
              return (
                <tr key={l.key}>
                  <td>
                    <span className="flex flex-col gap-0.5">
                      <span className="font-semibold">{m ? medicineName(m) : l.medicineId}</span>
                      <span className="text-xs font-normal text-ink-500">
                        Pack of {m?.packSize} · on hand {info?.saleable.toLocaleString() ?? 0} {m?.unit} · reorder at {m?.minStock}
                        {m && m.supplierId !== supplierId ? " · other supplier" : ""}
                      </span>
                    </span>
                  </td>
                  <td className="text-right">
                    <TextInput type="number" min={1} step={1} inputMode="numeric" aria-label="Packs ordered" value={l.qty} onChange={(e) => update(l.key, { qty: e.target.value })} className="ml-auto h-9 w-20 text-right" />
                  </td>
                  <td className="text-right">
                    <MoneyInput aria-label="Unit cost per pack" value={l.unitCost} onChange={(e) => update(l.key, { unitCost: e.target.value.replace(/[^0-9.]/g, "") })} className="ml-auto h-9 w-32" />
                  </td>
                  <td className="text-right font-semibold tabular">{peso(lineTotal)}</td>
                  <td>
                    <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label={`Remove ${m ? medicineName(m) : "line"}`} className="grid size-9 place-items-center rounded-[9px] text-red-700 hover:bg-red-50">
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Field label="Notes (optional)">
        <TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Delivery instructions, terms, contact…" />
      </Field>

      {error && <span className="rounded-xl bg-danger-bg px-3 py-2 text-[13px] font-medium text-danger">{error}</span>}

      <div className="-mx-6 -mb-6 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-2 px-6 py-4">
        <div className="flex flex-col">
          <span className="text-xs text-ink-500">{lines.length} line(s) · order total</span>
          <span className="font-heading text-xl font-bold tabular">{peso(total)}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="md" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="soft" size="md" onClick={() => save(false)} disabled={!lines.length}>
            Save draft
          </Button>
          <Button variant="brand" size="md" onClick={() => save(true)} disabled={!lines.length}>
            Submit order
          </Button>
        </div>
      </div>
    </div>
  );
}
