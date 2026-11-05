import type { DemoDatabase, StockInfo } from "@/lib/types";
import type { CsvValue } from "@/lib/utils/csv";
import {
  byCashier,
  byCategory,
  byPaymentMethod,
  expiryRows,
  hourlySeries,
  inventoryValuation,
  lowStockRows,
  salesInRange,
  summarize,
  topMedicines,
  txCogs,
  txDate,
  txNet,
  type DateRange,
} from "@/lib/services/report-service";
import { addDays, dateKey, daysBetween, formatDate, formatDateTime, formatMonthKey, int, manilaHour, monthKey, peso, percent, round2, startOfWeek } from "@/lib/utils/format";

export type ReportKey =
  | "daily"
  | "weekly"
  | "monthly"
  | "medicine"
  | "category"
  | "cashier"
  | "payment"
  | "valuation"
  | "low"
  | "expiry"
  | "purchase"
  | "profit"
  | "refunds";

export type ReportGroup = "Sales" | "Inventory" | "Finance";

export interface ReportMeta {
  key: ReportKey;
  group: ReportGroup;
  name: string;
  description: string;
  /** Uses the date range filter (inventory snapshots are "as of today"). */
  usesRange: boolean;
  /** Supports the category filter. */
  usesCategory: boolean;
}

export const REPORTS: ReportMeta[] = [
  { key: "daily", group: "Sales", name: "Daily Sales Report", description: "Net sales day by day (hour by hour for a single day).", usesRange: true, usesCategory: false },
  { key: "weekly", group: "Sales", name: "Weekly Sales Report", description: "Net sales grouped by week (Monday start).", usesRange: true, usesCategory: false },
  { key: "monthly", group: "Sales", name: "Monthly Sales Report", description: "Calendar-month totals for the selected range.", usesRange: true, usesCategory: false },
  { key: "medicine", group: "Sales", name: "Sales by Medicine", description: "Top medicines by revenue, net of discounts and refunds.", usesRange: true, usesCategory: true },
  { key: "category", group: "Sales", name: "Sales by Category", description: "Revenue share by medicine category.", usesRange: true, usesCategory: false },
  { key: "cashier", group: "Sales", name: "Sales by Cashier", description: "Per-cashier totals with refunds and voids.", usesRange: true, usesCategory: false },
  { key: "payment", group: "Sales", name: "Sales by Payment Method", description: "Cash, QR Ph and card totals (QR Ph / card are simulated in Demo Mode).", usesRange: true, usesCategory: false },
  { key: "valuation", group: "Inventory", name: "Inventory Valuation", description: "Saleable stock at acquisition cost (FEFO batches) and at retail.", usesRange: false, usesCategory: true },
  { key: "low", group: "Inventory", name: "Low-Stock Report", description: "Active medicines at or below their reorder level, including out of stock.", usesRange: false, usesCategory: true },
  { key: "expiry", group: "Inventory", name: "Expiry Report", description: "Batches expiring within 90 days, or already expired / quarantined.", usesRange: false, usesCategory: true },
  { key: "purchase", group: "Inventory", name: "Purchase Report", description: "Stock received from purchase orders, by supplier.", usesRange: true, usesCategory: false },
  { key: "profit", group: "Finance", name: "Gross Profit Estimate", description: "Net revenue minus FEFO batch cost. An estimate — not an accounting statement.", usesRange: true, usesCategory: true },
  { key: "refunds", group: "Finance", name: "Refunds Report", description: "Authorized refunds processed in the range, linked to the original sale.", usesRange: true, usesCategory: false },
];

export interface ReportColumn {
  label: string;
  align?: "right";
}

export interface ReportData {
  meta: ReportMeta;
  rangeLabel: string;
  kpis: { label: string; value: string }[];
  chart: {
    title: string;
    kind: "columns" | "ranked";
    data: { label: string; value: number; sub?: string; color?: string }[];
    format: (n: number) => string;
    color: string;
  } | null;
  columns: ReportColumn[];
  rows: string[][];
  totals?: string[];
  csv: { headers: string[]; rows: CsvValue[][] };
  emptyMessage: string;
}

const BLUE = "var(--chart-1)";
const TEAL = "#14A38B";
const AMBER = "#C98300";
const GREEN = "#12805C";

const shortDay = (k: string) => formatDate(k).replace(/, \d{4}$/, "");

export function rangeText(r: DateRange): string {
  return r.from === r.to ? formatDate(r.from) : `${formatDate(r.from)} – ${formatDate(r.to)}`;
}

export function buildReport(key: ReportKey, db: DemoDatabase, range: DateRange, categoryId: string, index: Map<string, StockInfo>, today: string): ReportData {
  const meta = REPORTS.find((r) => r.key === key)!;
  const rangeLabel = meta.usesRange ? rangeText(range) : `As of ${formatDate(today)}`;
  const medCat = new Map(db.medicines.map((m) => [m.id, m.categoryId]));
  const catName = new Map(db.categories.map((c) => [c.id, c.name]));
  const catOk = (medicineId: string) => categoryId === "all" || medCat.get(medicineId) === categoryId;
  const txs = salesInRange(db, range);
  const sum = summarize(txs);
  const base = { meta, rangeLabel, emptyMessage: "No records in this range." };

  switch (key) {
    // ---------------------------------------------------------------- time series
    case "daily":
    case "weekly":
    case "monthly": {
      type Row = { key: string; label: string; count: number; gross: number; refunds: number; net: number; profit: number };
      const single = key === "daily" && range.from === range.to;
      const buckets = new Map<string, Row>();
      const ensure = (k: string, label: string) => {
        if (!buckets.has(k)) buckets.set(k, { key: k, label, count: 0, gross: 0, refunds: 0, net: 0, profit: 0 });
        return buckets.get(k)!;
      };
      if (single) {
        for (const p of hourlySeries(txs)) ensure(p.key.padStart(2, "0"), p.label);
      } else if (key === "daily") {
        for (let i = 0; i <= daysBetween(range.from, range.to); i++) {
          const k = addDays(range.from, i);
          ensure(k, shortDay(k));
        }
      } else if (key === "weekly") {
        for (let w = startOfWeek(range.from); w <= range.to; w = addDays(w, 7)) ensure(w, `Wk of ${shortDay(w)}`);
      } else {
        for (let m = monthKey(range.from); m <= monthKey(range.to); ) {
          const [y, mo] = m.split("-").map(Number);
          ensure(m, `${formatMonthKey(m, "long")} ${y}`);
          m = new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 7);
        }
      }
      for (const t of txs) {
        const d = txDate(t);
        const k = single ? String(manilaHour(t.createdAt)).padStart(2, "0") : key === "daily" ? d : key === "weekly" ? startOfWeek(d) : monthKey(d);
        const b = buckets.get(k);
        if (!b) continue;
        const net = txNet(t);
        b.count++;
        b.gross += t.total;
        b.refunds += t.refundedAmount;
        b.net += net;
        b.profit += net - txCogs(t);
      }
      const rows = [...buckets.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
      const unit = single ? "Hour" : key === "daily" ? "Day" : key === "weekly" ? "Week" : "Month";
      const best = rows.reduce<Row | null>((m, r) => (!m || r.net > m.net ? r : m), null);
      return {
        ...base,
        kpis: [
          { label: "Net sales", value: peso(sum.net) },
          { label: "Transactions", value: int(sum.count) },
          { label: "Avg basket", value: peso(sum.avgBasket) },
          { label: `Best ${unit.toLowerCase()}`, value: best && best.net > 0 ? best.label : "—" },
        ],
        chart: {
          title: `Net sales by ${unit.toLowerCase()}`,
          kind: "columns",
          data: rows.map((r) => ({ label: r.label, value: round2(r.net), sub: `${int(r.count)} transactions` })),
          format: peso,
          color: BLUE,
        },
        columns: [{ label: unit }, { label: "Transactions", align: "right" }, { label: "Gross", align: "right" }, { label: "Refunds", align: "right" }, { label: "Net sales", align: "right" }, { label: "Gross profit (est.)", align: "right" }],
        rows: rows.map((r) => [r.label, int(r.count), peso(r.gross), r.refunds ? "−" + peso(r.refunds) : "—", peso(r.net), peso(r.profit)]),
        totals: ["Total", int(sum.count), peso(sum.gross), sum.refunds ? "−" + peso(sum.refunds) : "—", peso(sum.net), peso(sum.grossProfit)],
        csv: {
          headers: [unit, "Transactions", "Gross", "Refunds", "Net sales", "Gross profit (est.)"],
          rows: rows.map((r) => [r.label, r.count, round2(r.gross), round2(r.refunds), round2(r.net), round2(r.profit)]),
        },
      };
    }

    case "medicine": {
      const all = topMedicines(db, txs, 10000).filter((m) => catOk(m.medicineId));
      const units = all.reduce((s, m) => s + m.units, 0);
      const revenue = all.reduce((s, m) => s + m.revenue, 0);
      const byRevenue = [...all].sort((a, b) => b.revenue - a.revenue);
      return {
        ...base,
        kpis: [
          { label: "Medicines sold", value: `${int(all.length)} SKUs` },
          { label: "Units sold", value: int(units) },
          { label: "Revenue", value: peso(revenue) },
          { label: "Top by revenue", value: byRevenue[0]?.name ?? "—" },
        ],
        chart: { title: "Revenue by medicine (top 10)", kind: "ranked", data: byRevenue.slice(0, 10).map((m) => ({ label: m.name, value: m.revenue, sub: `${int(m.units)} units` })), format: peso, color: BLUE },
        columns: [{ label: "Medicine" }, { label: "Category" }, { label: "Units", align: "right" }, { label: "Revenue", align: "right" }, { label: "Gross profit (est.)", align: "right" }],
        rows: byRevenue.map((m) => [m.name, catName.get(medCat.get(m.medicineId) ?? "") ?? "—", int(m.units), peso(m.revenue), peso(m.profit)]),
        totals: ["Total", "", int(units), peso(revenue), peso(all.reduce((s, m) => s + m.profit, 0))],
        csv: { headers: ["Medicine", "Category", "Units", "Revenue", "Gross profit (est.)"], rows: byRevenue.map((m) => [m.name, catName.get(medCat.get(m.medicineId) ?? "") ?? "", m.units, m.revenue, m.profit]) },
      };
    }

    case "category": {
      const cats = byCategory(db, txs).filter((c) => c.revenue > 0 || c.units > 0);
      const total = cats.reduce((s, c) => s + c.revenue, 0);
      const top3 = cats.slice(0, 3).reduce((s, c) => s + c.revenue, 0);
      return {
        ...base,
        kpis: [
          { label: "Categories sold", value: int(cats.length) },
          { label: "Largest", value: cats[0]?.name ?? "—" },
          { label: "Share of top 3", value: total ? percent(top3 / total, 0) : "—" },
          { label: "Revenue", value: peso(total) },
        ],
        chart: { title: "Revenue by category", kind: "ranked", data: cats.map((c) => ({ label: c.name, value: c.revenue, sub: `${total ? percent(c.revenue / total) : "0%"} · ${int(c.units)} units` })), format: peso, color: TEAL },
        columns: [{ label: "Category" }, { label: "Units", align: "right" }, { label: "Share", align: "right" }, { label: "Revenue", align: "right" }, { label: "Gross profit (est.)", align: "right" }],
        rows: cats.map((c) => [c.name, int(c.units), total ? percent(c.revenue / total) : "—", peso(c.revenue), peso(c.profit)]),
        totals: ["Total", int(cats.reduce((s, c) => s + c.units, 0)), "100%", peso(total), peso(cats.reduce((s, c) => s + c.profit, 0))],
        csv: { headers: ["Category", "Units", "Share", "Revenue", "Gross profit (est.)"], rows: cats.map((c) => [c.name, c.units, total ? round2((c.revenue / total) * 100) : 0, c.revenue, c.profit]) },
      };
    }

    case "cashier": {
      const rows = byCashier(txs, db, range);
      const voids = rows.reduce((s, r) => s + r.voids, 0);
      return {
        ...base,
        kpis: [
          { label: "Active cashiers", value: int(rows.filter((r) => r.count > 0).length) },
          { label: "Net sales", value: peso(sum.net) },
          { label: "Refunds", value: peso(sum.refunds) },
          { label: "Voided sales", value: int(voids) },
        ],
        chart: { title: "Net sales by cashier", kind: "ranked", data: rows.map((r) => ({ label: r.name, value: r.net, sub: `${int(r.count)} transactions` })), format: peso, color: BLUE },
        columns: [{ label: "Cashier" }, { label: "Transactions", align: "right" }, { label: "Avg basket", align: "right" }, { label: "Refunds", align: "right" }, { label: "Voids", align: "right" }, { label: "Net sales", align: "right" }],
        rows: rows.map((r) => [r.name, int(r.count), r.count ? peso(r.net / r.count) : "—", r.refunds ? peso(r.refunds) : "—", int(r.voids), peso(r.net)]),
        totals: ["Total", int(sum.count), peso(sum.avgBasket), peso(sum.refunds), int(voids), peso(sum.net)],
        csv: { headers: ["Cashier", "Transactions", "Refunds", "Voids", "Net sales"], rows: rows.map((r) => [r.name, r.count, r.refunds, r.voids, r.net]) },
      };
    }

    case "payment": {
      const rows = byPaymentMethod(txs);
      const color = { cash: BLUE, qrph: TEAL, card: AMBER } as const;
      return {
        ...base,
        kpis: rows.map((r) => ({ label: `${r.label} share`, value: percent(r.share, 0) })).concat([{ label: "Net sales", value: peso(sum.net) }]),
        chart: { title: "Net sales by payment method", kind: "ranked", data: rows.map((r) => ({ label: r.label, value: r.value, color: color[r.method], sub: `${int(r.count)} transactions · ${percent(r.share)}` })), format: peso, color: BLUE },
        columns: [{ label: "Method" }, { label: "Transactions", align: "right" }, { label: "Share", align: "right" }, { label: "Net sales", align: "right" }],
        rows: rows.map((r) => [r.label + (r.method === "cash" ? "" : " (simulated)"), int(r.count), percent(r.share), peso(r.value)]),
        totals: ["Total", int(sum.count), "100%", peso(sum.net)],
        csv: { headers: ["Method", "Transactions", "Share %", "Net sales"], rows: rows.map((r) => [r.label, r.count, round2(r.share * 100), r.value]) },
      };
    }

    // ---------------------------------------------------------------- inventory snapshots
    case "valuation": {
      const v = inventoryValuation(db, index);
      const rows = v.rows.filter((r) => categoryId === "all" || r.categoryId === categoryId);
      const cost = rows.reduce((s, r) => s + r.cost, 0);
      const retail = rows.reduce((s, r) => s + r.retail, 0);
      const units = rows.reduce((s, r) => s + r.units, 0);
      return {
        ...base,
        kpis: [
          { label: "Stock at cost", value: peso(cost) },
          { label: "At retail", value: peso(retail) },
          { label: "Potential margin", value: retail ? percent((retail - cost) / retail) : "—" },
          { label: "Saleable units", value: int(units) },
        ],
        chart: { title: "Stock value at cost by category", kind: "ranked", data: rows.map((r) => ({ label: r.name, value: r.cost, sub: `${int(r.units)} units · ${r.skus} SKUs` })), format: peso, color: TEAL },
        columns: [{ label: "Category" }, { label: "SKUs in stock", align: "right" }, { label: "Units", align: "right" }, { label: "Value at cost", align: "right" }, { label: "Value at retail", align: "right" }],
        rows: rows.map((r) => [r.name, int(r.skus), int(r.units), peso(r.cost), peso(r.retail)]),
        totals: ["Total", int(rows.reduce((s, r) => s + r.skus, 0)), int(units), peso(cost), peso(retail)],
        csv: { headers: ["Category", "SKUs in stock", "Units", "Value at cost", "Value at retail"], rows: rows.map((r) => [r.name, r.skus, r.units, r.cost, r.retail]) },
      };
    }

    case "low": {
      const rows = lowStockRows(db, index).filter((r) => catOk(r.medicineId));
      const sup = new Map(db.suppliers.map((s) => [s.id, s.name]));
      return {
        ...base,
        emptyMessage: "No medicines are at or below reorder level.",
        kpis: [
          { label: "Low stock", value: int(rows.filter((r) => !r.out).length) },
          { label: "Out of stock", value: int(rows.filter((r) => r.out).length) },
          { label: "On open POs", value: int(rows.filter((r) => r.onOrder).length) },
          { label: "Suggested reorder", value: `${int(rows.reduce((s, r) => s + r.reorderQty, 0))} units` },
        ],
        chart: {
          title: "Units on hand as % of reorder level (lowest first)",
          kind: "ranked",
          data: rows.slice(0, 15).map((r) => ({ label: r.name, value: round2((r.saleable / Math.max(1, r.minStock)) * 100), sub: `${int(r.saleable)} of ${int(r.minStock)} ${r.unit}`, color: r.out ? "#DE1339" : AMBER })),
          format: (n) => `${Math.round(n)}%`,
          color: AMBER,
        },
        columns: [{ label: "Medicine" }, { label: "SKU" }, { label: "On hand", align: "right" }, { label: "Reorder level", align: "right" }, { label: "Suggested order", align: "right" }, { label: "Supplier" }, { label: "Status" }],
        rows: rows.map((r) => [r.name, r.sku, `${int(r.saleable)} ${r.unit}`, int(r.minStock), int(r.reorderQty), sup.get(r.supplierId) ?? "—", r.out ? (r.onOrder ? "Out · on order" : "Out of stock") : r.onOrder ? "Low · on order" : "Low stock"]),
        csv: { headers: ["Medicine", "SKU", "On hand", "Unit", "Reorder level", "Suggested order", "Supplier", "Out of stock", "On order"], rows: rows.map((r) => [r.name, r.sku, r.saleable, r.unit, r.minStock, r.reorderQty, sup.get(r.supplierId) ?? "", r.out, r.onOrder]) },
      };
    }

    case "expiry": {
      const rows = expiryRows(db, 90, today).filter((r) => catOk(r.medicineId));
      const expired = rows.filter((r) => r.days <= 0);
      const d30 = rows.filter((r) => r.days > 0 && r.days <= 30);
      const atRisk = rows.filter((r) => r.days > 0).reduce((s, r) => s + r.valueAtCost, 0);
      return {
        ...base,
        emptyMessage: "No batches expire within 90 days.",
        kpis: [
          { label: "Expired / quarantined", value: `${expired.length} batches` },
          { label: "≤ 30 days", value: `${d30.length} batches` },
          { label: "31 – 90 days", value: `${rows.length - expired.length - d30.length} batches` },
          { label: "Saleable value at risk", value: peso(atRisk) },
        ],
        chart: {
          title: "Value at cost by batch (expired in red)",
          kind: "ranked",
          data: rows.slice(0, 15).map((r) => ({ label: `${r.name} · ${r.batchNo}`, value: r.valueAtCost, sub: r.days <= 0 ? `Expired ${formatDate(r.expiryDate)}` : `${r.days} days left · ${int(r.quantity)} units`, color: r.days <= 0 ? "#DE1339" : r.days <= 30 ? "#EA580C" : AMBER })),
          format: peso,
          color: AMBER,
        },
        columns: [{ label: "Medicine" }, { label: "Batch" }, { label: "Expiry" }, { label: "Days left", align: "right" }, { label: "Units", align: "right" }, { label: "Value at cost", align: "right" }, { label: "Location" }, { label: "Status" }],
        rows: rows.map((r) => [r.name, r.batchNo, formatDate(r.expiryDate), r.days <= 0 ? "Expired" : String(r.days), int(r.quantity), peso(r.valueAtCost), r.location, r.days <= 0 ? r.status : "Saleable (FEFO first)"]),
        csv: { headers: ["Medicine", "Batch", "Expiry", "Days left", "Units", "Value at cost", "Location", "Status"], rows: rows.map((r) => [r.name, r.batchNo, r.expiryDate, r.days, r.quantity, r.valueAtCost, r.location, r.status]) },
      };
    }

    case "purchase": {
      const supName = new Map(db.suppliers.map((s) => [s.id, s.name]));
      const map = new Map<string, { supplier: string; receipts: number; pos: Set<string>; units: number; value: number }>();
      const detail: CsvValue[][] = [];
      for (const po of db.purchaseOrders) {
        for (const rc of po.receipts) {
          const d = dateKey(rc.receivedAt);
          if (d < range.from || d > range.to) continue;
          const cur = map.get(po.supplierId) ?? { supplier: supName.get(po.supplierId) ?? "—", receipts: 0, pos: new Set<string>(), units: 0, value: 0 };
          cur.receipts++;
          cur.pos.add(po.id);
          for (const l of rc.lines) {
            const line = po.lines.find((x) => x.id === l.lineId);
            if (!line) continue;
            cur.units += l.qty * line.packSize;
            cur.value += l.qty * line.unitCost;
            detail.push([po.poNumber, cur.supplier, formatDateTime(rc.receivedAt), line.name, l.qty, line.packSize, l.batchNo, l.expiryDate, round2(l.qty * line.unitCost)]);
          }
          map.set(po.supplierId, cur);
        }
      }
      const rows = [...map.values()].sort((a, b) => b.value - a.value);
      const value = rows.reduce((s, r) => s + r.value, 0);
      const open = db.purchaseOrders.filter((p) => p.status === "ordered" || p.status === "partially_received").length;
      return {
        ...base,
        emptyMessage: "No purchase orders were received in this range.",
        kpis: [
          { label: "POs received", value: int(new Set(rows.flatMap((r) => [...r.pos])).size) },
          { label: "Received value", value: peso(value) },
          { label: "Units received", value: int(rows.reduce((s, r) => s + r.units, 0)) },
          { label: "Open POs (now)", value: int(open) },
        ],
        chart: { title: "Received value by supplier", kind: "ranked", data: rows.map((r) => ({ label: r.supplier, value: round2(r.value), sub: `${r.receipts} deliveries · ${int(r.units)} units` })), format: peso, color: BLUE },
        columns: [{ label: "Supplier" }, { label: "POs", align: "right" }, { label: "Deliveries", align: "right" }, { label: "Units", align: "right" }, { label: "Received value", align: "right" }],
        rows: rows.map((r) => [r.supplier, int(r.pos.size), int(r.receipts), int(r.units), peso(r.value)]),
        totals: ["Total", "", int(rows.reduce((s, r) => s + r.receipts, 0)), int(rows.reduce((s, r) => s + r.units, 0)), peso(value)],
        csv: { headers: ["PO", "Supplier", "Received at", "Medicine", "Packs", "Units per pack", "Batch", "Expiry", "Value"], rows: detail },
      };
    }

    // ---------------------------------------------------------------- finance
    case "profit": {
      const cats = byCategory(db, txs).filter((c) => (categoryId === "all" || c.categoryId === categoryId) && (c.revenue || c.profit));
      const revenue = categoryId === "all" ? sum.net : cats.reduce((s, c) => s + c.revenue, 0);
      const profit = categoryId === "all" ? sum.grossProfit : cats.reduce((s, c) => s + c.profit, 0);
      const ordered = [...cats].sort((a, b) => b.profit - a.profit);
      return {
        ...base,
        kpis: [
          { label: "Net revenue", value: peso(revenue) },
          { label: "Cost of goods (est.)", value: peso(revenue - profit) },
          { label: "Gross profit (est.)", value: peso(profit) },
          { label: "Margin", value: revenue ? percent(profit / revenue) : "—" },
        ],
        chart: { title: "Gross profit by category", kind: "ranked", data: ordered.map((c) => ({ label: c.name, value: c.profit, sub: `Revenue ${peso(c.revenue)} · margin ${c.revenue ? percent(c.profit / c.revenue) : "—"}` })), format: peso, color: GREEN },
        columns: [{ label: "Category" }, { label: "Revenue", align: "right" }, { label: "Cost (est.)", align: "right" }, { label: "Gross profit", align: "right" }, { label: "Margin", align: "right" }],
        rows: ordered.map((c) => [c.name, peso(c.revenue), peso(c.revenue - c.profit), peso(c.profit), c.revenue ? percent(c.profit / c.revenue) : "—"]),
        totals: ["Total", peso(revenue), peso(revenue - profit), peso(profit), revenue ? percent(profit / revenue) : "—"],
        csv: { headers: ["Category", "Revenue", "Cost (est.)", "Gross profit", "Margin %"], rows: ordered.map((c) => [c.name, c.revenue, round2(c.revenue - c.profit), c.profit, c.revenue ? round2((c.profit / c.revenue) * 100) : 0]) },
      };
    }

    case "refunds": {
      const list = db.refunds.filter((r) => {
        const d = dateKey(r.createdAt);
        return d >= range.from && d <= range.to;
      });
      const total = list.reduce((s, r) => s + r.amount, 0);
      const restocked = list.reduce((s, r) => s + r.lines.filter((l) => l.restock).reduce((a, l) => a + l.qty, 0), 0);
      const byReason = new Map<string, { count: number; amount: number }>();
      for (const r of list) {
        const c = byReason.get(r.reason) ?? { count: 0, amount: 0 };
        c.count++;
        c.amount += r.amount;
        byReason.set(r.reason, c);
      }
      const reasons = [...byReason.entries()].sort((a, b) => b[1].amount - a[1].amount);
      const sorted = [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      return {
        ...base,
        emptyMessage: "No refunds were processed in this range.",
        kpis: [
          { label: "Refunds", value: int(list.length) },
          { label: "Amount refunded", value: peso(total) },
          { label: "Units restocked", value: int(restocked) },
          { label: "Share of gross sales", value: sum.gross ? percent(total / sum.gross, 2) : "—" },
        ],
        chart: { title: "Refunded amount by reason", kind: "ranked", data: reasons.map(([reason, v]) => ({ label: reason, value: round2(v.amount), sub: `${v.count} refund${v.count === 1 ? "" : "s"}` })), format: peso, color: "#EA580C" },
        columns: [{ label: "Refund" }, { label: "Date" }, { label: "Original receipt" }, { label: "Items" }, { label: "Reason" }, { label: "Authorized by" }, { label: "Amount", align: "right" }],
        rows: sorted.map((r) => [r.refundNo, formatDateTime(r.createdAt), r.receiptNo, r.lines.map((l) => `${l.name} × ${l.qty}${l.restock ? " (restocked)" : ""}`).join("; "), r.reason, r.authorizedByName, peso(r.amount)]),
        totals: ["Total", "", "", "", "", "", peso(total)],
        csv: {
          headers: ["Refund", "Date", "Original receipt", "Items", "Reason", "Authorized by", "Amount"],
          rows: sorted.map((r) => [r.refundNo, r.createdAt, r.receiptNo, r.lines.map((l) => `${l.name} x ${l.qty}`).join("; "), r.reason, r.authorizedByName, r.amount]),
        },
      };
    }
  }
}

