"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Medicine, StockInfo } from "@/lib/types";
import { useDb } from "@/lib/store/app-store";
import { useLookups } from "@/hooks/use-inventory";
import { useToday } from "@/hooks/use-today";
import { batchesFor, isBatchSellable, medicineName } from "@/lib/services/stock";
import { formatDate, formatRelative, peso } from "@/lib/utils/format";
import { StockStatusChip } from "@/components/shared/stock-status-chip";
import { Chip, RxChip } from "@/components/shared/chip";
import { Button } from "@/components/ui/button";
import { MedicineTile } from "./medicine-tile";
import { PhotoCredit } from "@/components/shared/photo-credit";
import { ExpiryChip, batchStatusInfo } from "@/components/stock/batch-chips";
import { cn } from "@/lib/utils";

const MOVE_LABEL: Record<string, string> = {
  sale: "Sold",
  refund_restock: "Refund restock",
  void_restock: "Void restock",
  stock_in: "Stock in",
  stock_out: "Stock out",
  adjustment: "Count adjustment",
  po_receipt: "Received",
  write_off: "Written off",
  quarantine: "Quarantined",
  release: "Released",
};

/** Right-hand medicine details (design: Inventory aside). */
export function MedicineDetailPanel({
  medicine,
  info,
  canEdit,
  canAdjust,
  onEdit,
  onAdjust,
}: {
  medicine: Medicine;
  info: StockInfo;
  canEdit: boolean;
  canAdjust: boolean;
  onEdit: () => void;
  onAdjust: () => void;
}) {
  const db = useDb();
  const today = useToday();
  const reduce = useReducedMotion();
  const { suppliers, categories } = useLookups();
  const batches = useMemo(() => batchesFor(db, medicine.id).filter((b) => b.quantity > 0), [db, medicine.id]);
  const nextOutId = batches.find((b) => isBatchSellable(b, today))?.id;
  const moves = useMemo(() => db.movements.filter((m) => m.medicineId === medicine.id).slice(0, 6), [db.movements, medicine.id]);
  const margin = medicine.sellingPrice > 0 ? Math.round((1 - medicine.costPrice / medicine.sellingPrice) * 100) : 0;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={medicine.id}
        initial={reduce ? false : { opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={reduce ? undefined : { opacity: 0, x: -8 }}
        transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
        className="flex flex-col gap-4"
      >
        <div className="flex items-center gap-3.5">
          <MedicineTile medicine={medicine} status={info.status} big />
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-heading text-lg leading-tight font-semibold">
              {medicineName(medicine)} {medicine.rxRequired && <RxChip size="sm" />}
            </span>
            <span className="text-[13px] text-ink-500">
              {medicine.genericName} · {medicine.dosageForm} · {medicine.manufacturer}
            </span>
            <span className="flex flex-wrap gap-1.5">
              <StockStatusChip status={info.status} />
              {info.status !== "expiring" && info.isExpiring && <Chip tone="orange">Expiring soon</Chip>}
              {info.hasExpired && info.status !== "expired" && <Chip tone="solid-danger">Expired batch on hand</Chip>}
            </span>
          </div>
        </div>

        <PhotoCredit sku={medicine.sku} />

        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col gap-0.5 rounded-xl bg-canvas p-3">
            <span className="text-xs text-ink-500">On hand</span>
            <span className="text-lg font-bold tabular">{info.saleable.toLocaleString()}</span>
            {info.blocked > 0 && <span className="text-[11px] text-danger">+{info.blocked} blocked</span>}
          </div>
          <div className="flex flex-col gap-0.5 rounded-xl bg-canvas p-3">
            <span className="text-xs text-ink-500">Cost / sell</span>
            <span className="text-sm leading-relaxed font-bold tabular">
              {peso(medicine.costPrice)} / {peso(medicine.sellingPrice)}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 rounded-xl bg-canvas p-3">
            <span className="text-xs text-ink-500">Margin</span>
            <span className="text-lg font-bold tabular">{margin}%</span>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px] font-medium">
          <Detail label="Packaging" value={medicine.packaging} />
          <Detail label="Supplier" value={suppliers.get(medicine.supplierId)?.name ?? "—"} />
          <Detail label="Prescription" value={medicine.rxRequired ? "Required — pharmacist verifies" : "Over the counter"} />
          <Detail label="Reorder level" value={`${medicine.minStock} ${medicine.unit} · reorder ${medicine.reorderQty}`} />
          <Detail label="Category" value={categories.get(medicine.categoryId)?.name ?? "—"} />
          <Detail label="Location" value={medicine.location} />
          <Detail label="SKU" value={<span className="font-mono text-xs">{medicine.sku}</span>} />
          <Detail label="Barcode" value={<span className="font-mono text-xs">{medicine.barcode}</span>} />
        </dl>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-heading text-sm font-semibold">Batches · FEFO order</span>
            <Link href="/stock-management" className="text-xs font-semibold text-brand-700 hover:underline">
              Manage batches
            </Link>
          </div>
          <div className="overflow-hidden rounded-xl border border-line">
            {batches.length === 0 && <span className="block px-3 py-4 text-center text-[13px] text-ink-500">No stock on hand.</span>}
            {batches.map((b, i) => {
              const st = batchStatusInfo(b, today);
              return (
                <div key={b.id} className={cn("flex items-center justify-between gap-2.5 px-3 py-2.5", i > 0 && "border-t border-line-soft", b.id === nextOutId && "bg-surface-2")}>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-mono text-xs font-semibold">{b.batchNo}</span>
                    <span className="text-xs text-ink-500">
                      Rcvd {formatDate(b.receivedDate)} · {b.location}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[13px] font-bold tabular">
                      {b.quantity.toLocaleString()} {medicine.unit}
                    </span>
                    <span className="flex flex-wrap justify-end gap-1">
                      {st.label !== "Saleable" && <Chip tone={st.tone} size="sm">{st.label}</Chip>}
                      <ExpiryChip expiryDate={b.expiryDate} today={today} prefix={b.id === nextOutId ? "Next out · " : undefined} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="font-heading text-sm font-semibold">Stock movement</span>
          {moves.length === 0 && <span className="text-xs text-ink-500">No movements recorded yet.</span>}
          {moves.map((m) => (
            <div key={m.id} className="flex justify-between gap-2 border-b border-line-soft py-1.5 text-xs font-medium">
              <span className="min-w-0 text-ink-700">
                {MOVE_LABEL[m.type] ?? m.type}
                {m.reference ? ` · ${m.reference}` : ""}
                {m.batchNo ? ` · ${m.batchNo}` : ""}
                <span className="block text-[11px] font-normal text-ink-400">
                  {formatRelative(m.createdAt)} · {m.userName}
                </span>
              </span>
              <span className={cn("font-bold tabular", m.qty < 0 ? "text-danger" : "text-ok")}>
                {m.qty > 0 ? "+" : "−"}
                {Math.abs(m.qty).toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        {(canAdjust || canEdit) && (
          <div className="flex gap-2">
            {canAdjust && (
              <Button variant="brand" size="md" className="flex-1" onClick={onAdjust}>
                Adjust stock
              </Button>
            )}
            {canEdit && (
              <Button variant="outline" size="md" className="flex-1" onClick={onEdit}>
                Edit details
              </Button>
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs font-normal text-ink-500">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}
