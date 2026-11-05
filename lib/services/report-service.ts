import type { DemoDatabase, PaymentMethod, SaleTransaction, StockInfo } from "@/lib/types";
import {
  addDays,
  dateKey,
  daysBetween,
  formatMonthKey,
  manilaHour,
  monthKey,
  round2,
  startOfWeek,
  todayKey,
} from "@/lib/utils/format";
import { getStockIndex, medicineName } from "./stock";

/**
 * Read-only analytics shared by the Dashboard and Reports pages so every total is
 * computed the same way from the underlying transaction records.
 *
 * Definitions (demo):
 *   gross    = Σ transaction totals (after discounts), excluding voided sales
 *   refunds  = Σ refunded amounts on those sales
 *   net      = gross − refunds
 *   cogs     = Σ unit cost × units not refunded
 *   profit   = net − cogs (an estimate, not an accounting statement)
 */

export interface DateRange {
  from: string; // YYYY-MM-DD inclusive
  to: string; // YYYY-MM-DD inclusive
}

export const PAYMENT_LABEL: Record<PaymentMethod, string> = { cash: "Cash", qrph: "QR Ph", card: "Card" };
export const PAYMENT_COLOR: Record<PaymentMethod, string> = { cash: "#223CFF", qrph: "#14A38B", card: "#F2A93B" };

export function presetRange(preset: "today" | "yesterday" | "7d" | "30d" | "month" | "lastMonth" | "90d" | "year" | "12m", today = todayKey()): DateRange {
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "yesterday":
      return { from: addDays(today, -1), to: addDays(today, -1) };
    case "7d":
      return { from: addDays(today, -6), to: today };
    case "30d":
      return { from: addDays(today, -29), to: today };
    case "90d":
      return { from: addDays(today, -89), to: today };
    case "month":
      return { from: today.slice(0, 8) + "01", to: today };
    case "lastMonth": {
      const first = today.slice(0, 8) + "01";
      const lastPrev = addDays(first, -1);
      return { from: lastPrev.slice(0, 8) + "01", to: lastPrev };
    }
    case "year":
      return { from: today.slice(0, 4) + "-01-01", to: today };
    case "12m":
      return { from: addDays(today, -364), to: today };
  }
}

export function txDate(t: SaleTransaction): string {
  return dateKey(t.createdAt);
}

export function isCounted(t: SaleTransaction): boolean {
  return t.status !== "voided";
}

export function inRange(t: SaleTransaction, r: DateRange): boolean {
  const k = txDate(t);
  return k >= r.from && k <= r.to;
}

export function salesInRange(db: DemoDatabase, r: DateRange): SaleTransaction[] {
  return db.transactions.filter((t) => isCounted(t) && inRange(t, r));
}

export function txNet(t: SaleTransaction): number {
  return round2(t.total - t.refundedAmount);
}

export function txCogs(t: SaleTransaction): number {
  return t.lines.reduce((s, l) => s + l.unitCost * (l.baseQty - l.refundedQty), 0);
}

/** Net revenue attributed to a line (pro-rated discount, net of refunds). */
export function lineNet(t: SaleTransaction, l: SaleTransaction["lines"][number]): number {
  if (!t.subtotal || !l.baseQty) return 0;
  return (l.lineTotal * (t.total / t.subtotal) * (l.baseQty - l.refundedQty)) / l.baseQty;
}

export interface SalesSummary {
  count: number;
  gross: number;
  refunds: number;
  net: number;
  discounts: number;
  vat: number;
  cogs: number;
  grossProfit: number;
  margin: number;
  avgBasket: number;
  units: number;
}

export function summarize(txs: SaleTransaction[]): SalesSummary {
  let gross = 0,
    refunds = 0,
    discounts = 0,
    vat = 0,
    cogs = 0,
    units = 0;
  for (const t of txs) {
    gross += t.total;
    refunds += t.refundedAmount;
    discounts += t.discountAmount + t.lessVat;
    vat += t.vatAmount;
    cogs += txCogs(t);
    for (const l of t.lines) units += l.baseQty - l.refundedQty;
  }
  const net = gross - refunds;
  return {
    count: txs.length,
    gross: round2(gross),
    refunds: round2(refunds),
    net: round2(net),
    discounts: round2(discounts),
    vat: round2(vat),
    cogs: round2(cogs),
    grossProfit: round2(net - cogs),
    margin: net > 0 ? (net - cogs) / net : 0,
    avgBasket: txs.length ? round2(net / txs.length) : 0,
    units,
  };
}

export interface SeriesPoint {
  key: string;
  label: string;
  value: number;
  count: number;
  profit: number;
}

function bucketize(txs: SaleTransaction[], keys: { key: string; label: string }[], keyOf: (t: SaleTransaction) => string): SeriesPoint[] {
  const map = new Map(keys.map((k) => [k.key, { ...k, value: 0, count: 0, profit: 0 }]));
  for (const t of txs) {
    const b = map.get(keyOf(t));
    if (!b) continue;
    const net = txNet(t);
    b.value += net;
    b.count += 1;
    b.profit += net - txCogs(t);
  }
  return [...map.values()].map((b) => ({ ...b, value: round2(b.value), profit: round2(b.profit) }));
}

const shortDay = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 4)).toLocaleDateString("en-PH", { month: "short", day: "numeric", timeZone: "UTC" });
};

export function dailySeries(db: DemoDatabase, r: DateRange): SeriesPoint[] {
  const n = daysBetween(r.from, r.to);
  const today = todayKey();
  const keys = Array.from({ length: n + 1 }, (_, i) => {
    const k = addDays(r.from, i);
    return { key: k, label: k === today ? "Today" : shortDay(k) };
  });
  return bucketize(salesInRange(db, r), keys, txDate);
}

export function weeklySeries(db: DemoDatabase, weeks: number, today = todayKey()): SeriesPoint[] {
  const thisWeek = startOfWeek(today);
  const keys = Array.from({ length: weeks }, (_, i) => {
    const k = addDays(thisWeek, -7 * (weeks - 1 - i));
    return { key: k, label: i === weeks - 1 ? "This wk" : shortDay(k) };
  });
  return bucketize(salesInRange(db, { from: keys[0].key, to: today }), keys, (t) => startOfWeek(txDate(t)));
}

export function monthlySeries(db: DemoDatabase, months: number, today = todayKey()): SeriesPoint[] {
  const [y, m] = today.split("-").map(Number);
  const keys = Array.from({ length: months }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (months - 1 - i), 1));
    const k = d.toISOString().slice(0, 7);
    return { key: k, label: formatMonthKey(k) + (d.getUTCMonth() === 0 ? ` '${String(d.getUTCFullYear()).slice(2)}` : "") };
  });
  return bucketize(salesInRange(db, { from: keys[0].key + "-01", to: today }), keys, (t) => monthKey(txDate(t)));
}

export function yearlySeries(db: DemoDatabase, today = todayKey()): SeriesPoint[] {
  const years = [...new Set(db.transactions.map((t) => txDate(t).slice(0, 4)))].sort();
  const keys = years.map((yk) => ({ key: yk, label: yk === today.slice(0, 4) ? `${yk} YTD` : yk }));
  return bucketize(db.transactions.filter(isCounted), keys, (t) => txDate(t).slice(0, 4));
}

export function hourlySeries(txs: SaleTransaction[]): SeriesPoint[] {
  const keys = Array.from({ length: 24 }, (_, h) => ({
    key: String(h),
    label: `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`,
  }));
  return bucketize(txs, keys, (t) => String(manilaHour(t.createdAt))).filter((p) => p.count > 0);
}

export function byPaymentMethod(txs: SaleTransaction[]) {
  const methods: PaymentMethod[] = ["cash", "qrph", "card"];
  const total = txs.reduce((s, t) => s + txNet(t), 0);
  return methods.map((m) => {
    const list = txs.filter((t) => t.payment.method === m);
    const value = round2(list.reduce((s, t) => s + txNet(t), 0));
    return { method: m, label: PAYMENT_LABEL[m], color: PAYMENT_COLOR[m], value, count: list.length, share: total ? value / total : 0 };
  });
}

export function topMedicines(db: DemoDatabase, txs: SaleTransaction[], limit = 10) {
  const map = new Map<string, { medicineId: string; name: string; units: number; revenue: number; profit: number }>();
  for (const t of txs) {
    for (const l of t.lines) {
      const units = l.baseQty - l.refundedQty;
      if (units <= 0) continue;
      const cur = map.get(l.medicineId) ?? { medicineId: l.medicineId, name: l.name, units: 0, revenue: 0, profit: 0 };
      const rev = lineNet(t, l);
      cur.units += units;
      cur.revenue += rev;
      cur.profit += rev - l.unitCost * units;
      map.set(l.medicineId, cur);
    }
  }
  const m = new Map(db.medicines.map((x) => [x.id, x]));
  return [...map.values()]
    .map((x) => ({ ...x, name: m.get(x.medicineId) ? medicineName(m.get(x.medicineId)!) : x.name, revenue: round2(x.revenue), profit: round2(x.profit) }))
    .sort((a, b) => b.units - a.units)
    .slice(0, limit);
}

export function byCategory(db: DemoDatabase, txs: SaleTransaction[]) {
  const medCat = new Map(db.medicines.map((m) => [m.id, m.categoryId]));
  const map = new Map(db.categories.map((c) => [c.id, { categoryId: c.id, name: c.name, color: c.color, revenue: 0, profit: 0, units: 0 }]));
  for (const t of txs) {
    for (const l of t.lines) {
      const c = map.get(medCat.get(l.medicineId) ?? "");
      if (!c) continue;
      const units = l.baseQty - l.refundedQty;
      const rev = lineNet(t, l);
      c.revenue += rev;
      c.profit += rev - l.unitCost * units;
      c.units += units;
    }
  }
  return [...map.values()].map((c) => ({ ...c, revenue: round2(c.revenue), profit: round2(c.profit) })).sort((a, b) => b.revenue - a.revenue);
}

export function byCashier(txs: SaleTransaction[], db?: DemoDatabase, range?: DateRange) {
  const map = new Map<string, { cashierId: string; name: string; count: number; net: number; refunds: number; voids: number }>();
  for (const t of txs) {
    const c = map.get(t.cashierId) ?? { cashierId: t.cashierId, name: t.cashierName, count: 0, net: 0, refunds: 0, voids: 0 };
    c.count += 1;
    c.net += txNet(t);
    c.refunds += t.refundedAmount;
    map.set(t.cashierId, c);
  }
  if (db && range) {
    for (const t of db.transactions) {
      if (t.status === "voided" && inRange(t, range)) {
        const c = map.get(t.cashierId) ?? { cashierId: t.cashierId, name: t.cashierName, count: 0, net: 0, refunds: 0, voids: 0 };
        c.voids += 1;
        map.set(t.cashierId, c);
      }
    }
  }
  return [...map.values()].map((c) => ({ ...c, net: round2(c.net), refunds: round2(c.refunds) })).sort((a, b) => b.net - a.net);
}

export function inventoryValuation(db: DemoDatabase, index: Map<string, StockInfo> = getStockIndex(db)) {
  const cats = new Map(db.categories.map((c) => [c.id, { categoryId: c.id, name: c.name, color: c.color, cost: 0, retail: 0, units: 0, skus: 0 }]));
  for (const m of db.medicines) {
    const info = index.get(m.id);
    const c = cats.get(m.categoryId);
    if (!info || !c || m.status === "inactive") continue;
    c.cost += info.valueAtCost;
    c.retail += info.saleable * m.sellingPrice;
    c.units += info.saleable;
    if (info.saleable > 0) c.skus += 1;
  }
  const rows = [...cats.values()].map((c) => ({ ...c, cost: round2(c.cost), retail: round2(c.retail) })).sort((a, b) => b.cost - a.cost);
  return {
    rows,
    totalCost: round2(rows.reduce((s, r) => s + r.cost, 0)),
    totalRetail: round2(rows.reduce((s, r) => s + r.retail, 0)),
    totalUnits: rows.reduce((s, r) => s + r.units, 0),
  };
}

export interface ExpiryRow {
  batchId: string;
  medicineId: string;
  name: string;
  batchNo: string;
  expiryDate: string;
  days: number;
  quantity: number;
  valueAtCost: number;
  status: string;
  supplierId: string;
  location: string;
}

export function expiryRows(db: DemoDatabase, withinDays: number, today = todayKey()): ExpiryRow[] {
  const meds = new Map(db.medicines.map((m) => [m.id, m]));
  return db.batches
    .filter((b) => b.quantity > 0 && daysBetween(today, b.expiryDate) <= withinDays)
    .map((b) => {
      const m = meds.get(b.medicineId)!;
      const days = daysBetween(today, b.expiryDate);
      return {
        batchId: b.id,
        medicineId: b.medicineId,
        name: m ? medicineName(m) : b.medicineId,
        batchNo: b.batchNo,
        expiryDate: b.expiryDate,
        days,
        quantity: b.quantity,
        valueAtCost: round2(b.quantity * b.unitCost),
        status: days <= 0 ? (b.status === "saleable" ? "Expired" : b.status === "recalled" ? "Recalled" : "Quarantined") : b.status === "saleable" ? "Saleable" : b.status === "recalled" ? "Recalled" : "Quarantined",
        supplierId: b.supplierId,
        location: b.location,
      };
    })
    .sort((a, b) => (a.expiryDate < b.expiryDate ? -1 : 1));
}

export function lowStockRows(db: DemoDatabase, index: Map<string, StockInfo> = getStockIndex(db)) {
  const openPoMeds = new Set(
    db.purchaseOrders
      .filter((p) => p.status === "ordered" || p.status === "partially_received")
      .flatMap((p) => p.lines.filter((l) => l.receivedQty < l.qty).map((l) => l.medicineId))
  );
  return db.medicines
    .filter((m) => m.status === "active")
    .map((m) => ({ m, info: index.get(m.id)! }))
    .filter(({ info }) => info.isLow || info.isOut)
    .map(({ m, info }) => ({
      medicineId: m.id,
      name: medicineName(m),
      sku: m.sku,
      saleable: info.saleable,
      minStock: m.minStock,
      reorderQty: m.reorderQty,
      unit: m.unit,
      out: info.isOut,
      onOrder: openPoMeds.has(m.id),
      supplierId: m.supplierId,
    }))
    .sort((a, b) => a.saleable / Math.max(1, a.minStock) - b.saleable / Math.max(1, b.minStock));
}

/** Percentage change helper (returns null when the baseline is zero). */
export function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return (current - previous) / previous;
}
