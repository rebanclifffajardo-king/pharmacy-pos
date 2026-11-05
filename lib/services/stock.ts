import type { Batch, BatchAllocation, DemoDatabase, Medicine, StockInfo, StockStatus } from "@/lib/types";
import { daysBetween, round2, todayKey } from "@/lib/utils/format";

/** Display name used across the app, matching the design ("Biogesic 500 mg", "Generic Amlodipine 10 mg"). */
export function medicineName(m: Pick<Medicine, "brandName" | "genericName" | "strength">): string {
  return m.brandName === "Generic" ? `Generic ${m.genericName} ${m.strength}` : `${m.brandName} ${m.strength}`;
}

/** Short name for receipts (brand or generic + strength). */
export function medicineShortName(m: Pick<Medicine, "brandName" | "genericName" | "strength">): string {
  return m.brandName === "Generic" ? `${m.genericName} ${m.strength}` : `${m.brandName} ${m.strength}`;
}

/** A batch is expired on (and after) its expiry date — it is blocked from sale that day. */
export function isBatchExpired(b: Pick<Batch, "expiryDate">, today = todayKey()): boolean {
  return b.expiryDate <= today;
}

export function isBatchSellable(b: Batch, today = todayKey()): boolean {
  return b.status === "saleable" && b.quantity > 0 && !isBatchExpired(b, today);
}

/** FEFO order: earliest expiry first, then earliest received. */
export function fefoSort(a: Batch, b: Batch): number {
  if (a.expiryDate !== b.expiryDate) return a.expiryDate < b.expiryDate ? -1 : 1;
  if (a.receivedDate !== b.receivedDate) return a.receivedDate < b.receivedDate ? -1 : 1;
  return a.batchNo < b.batchNo ? -1 : 1;
}

export function batchesFor(db: Pick<DemoDatabase, "batches">, medicineId: string): Batch[] {
  return db.batches.filter((b) => b.medicineId === medicineId).sort(fefoSort);
}

export function sellableBatches(db: Pick<DemoDatabase, "batches">, medicineId: string, today = todayKey()): Batch[] {
  return batchesFor(db, medicineId).filter((b) => isBatchSellable(b, today));
}

export function computeStockInfo(m: Medicine, batches: Batch[], expiryWarningDays: number, today = todayKey()): StockInfo {
  let saleable = 0;
  let blocked = 0;
  let expiredUnits = 0;
  let valueAtCost = 0;
  let nearest: Batch | undefined;
  for (const b of batches) {
    if (b.quantity <= 0) continue;
    const expired = isBatchExpired(b, today);
    if (b.status === "saleable" && !expired) {
      saleable += b.quantity;
      valueAtCost += b.quantity * b.unitCost;
      if (!nearest || fefoSort(b, nearest) < 0) nearest = b;
    } else {
      blocked += b.quantity;
      if (expired) expiredUnits += b.quantity;
    }
  }
  const daysToExpiry = nearest ? daysBetween(today, nearest.expiryDate) : undefined;
  const inactive = m.status === "inactive";
  const isOut = !inactive && saleable <= 0;
  const isLow = !inactive && saleable > 0 && saleable <= m.minStock;
  const isExpiring = !inactive && daysToExpiry !== undefined && daysToExpiry <= expiryWarningDays;
  const hasExpired = expiredUnits > 0;

  let status: StockStatus = "in";
  if (inactive) status = "inactive";
  else if (isOut && hasExpired) status = "expired";
  else if (isOut) status = "out";
  else if (isLow) status = "low";
  else if (isExpiring) status = "expiring";

  return {
    medicineId: m.id,
    saleable,
    blocked,
    expiredUnits,
    nearestExpiry: nearest?.expiryDate,
    nearestBatchNo: nearest?.batchNo,
    daysToExpiry,
    isLow,
    isOut,
    isExpiring,
    hasExpired,
    status,
    valueAtCost: round2(valueAtCost),
  };
}

const indexCache = new WeakMap<DemoDatabase, { day: string; map: Map<string, StockInfo> }>();

/**
 * Stock info for every medicine, memoised per database snapshot + calendar day.
 * Because the store replaces `db` immutably on every change, the cache is always fresh.
 */
export function getStockIndex(db: DemoDatabase, today = todayKey()): Map<string, StockInfo> {
  const hit = indexCache.get(db);
  if (hit && hit.day === today) return hit.map;
  const byMed = new Map<string, Batch[]>();
  for (const b of db.batches) {
    const list = byMed.get(b.medicineId);
    if (list) list.push(b);
    else byMed.set(b.medicineId, [b]);
  }
  const map = new Map<string, StockInfo>();
  for (const m of db.medicines) {
    map.set(m.id, computeStockInfo(m, byMed.get(m.id) ?? [], db.settings.pos.expiryWarningDays, today));
  }
  indexCache.set(db, { day: today, map });
  return map;
}

export function getStockInfo(db: DemoDatabase, medicineId: string, today = todayKey()): StockInfo | undefined {
  return getStockIndex(db, today).get(medicineId);
}

export class InsufficientStockError extends Error {}

/**
 * Plans a FEFO allocation of `qty` units across sellable batches. Throws when stock is
 * insufficient. Does not mutate anything.
 */
export function planFefoAllocation(batches: Batch[], qty: number, today = todayKey()): BatchAllocation[] {
  const usable = batches.filter((b) => isBatchSellable(b, today)).sort(fefoSort);
  const allocations: BatchAllocation[] = [];
  let remaining = qty;
  for (const b of usable) {
    if (remaining <= 0) break;
    const take = Math.min(b.quantity, remaining);
    allocations.push({ batchId: b.id, batchNo: b.batchNo, expiryDate: b.expiryDate, qty: take });
    remaining -= take;
  }
  if (remaining > 0) {
    const available = qty - remaining;
    throw new InsufficientStockError(`Only ${available} sellable unit${available === 1 ? "" : "s"} available.`);
  }
  return allocations;
}

export const STOCK_STATUS_META: Record<StockStatus, { label: string; tone: "ok" | "warn" | "danger" | "orange" | "neutral" | "solid-danger" }> = {
  in: { label: "In stock", tone: "ok" },
  low: { label: "Low stock", tone: "warn" },
  out: { label: "Out of stock", tone: "danger" },
  expiring: { label: "Expiring soon", tone: "orange" },
  expired: { label: "Expired · quarantined", tone: "solid-danger" },
  inactive: { label: "Inactive", tone: "neutral" },
};
