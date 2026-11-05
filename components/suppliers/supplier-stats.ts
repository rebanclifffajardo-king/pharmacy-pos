import type { DemoDatabase } from "@/lib/types";
import { dateKey, round2, todayKey } from "@/lib/utils/format";

export interface SupplierStats {
  skus: number;
  ytdReceived: number;
  openPos: number;
  totalPos: number;
}

/** Per-supplier figures derived from medicines and purchase-order receipts. */
export function supplierStats(db: DemoDatabase): Map<string, SupplierStats> {
  const year = todayKey().slice(0, 4);
  const map = new Map<string, SupplierStats>(db.suppliers.map((s) => [s.id, { skus: 0, ytdReceived: 0, openPos: 0, totalPos: 0 }]));
  for (const m of db.medicines) {
    const s = map.get(m.supplierId);
    if (s && m.status === "active") s.skus++;
  }
  for (const po of db.purchaseOrders) {
    const s = map.get(po.supplierId);
    if (!s) continue;
    s.totalPos++;
    if (po.status === "ordered" || po.status === "partially_received") s.openPos++;
    for (const r of po.receipts) {
      if (dateKey(r.receivedAt).slice(0, 4) !== year) continue;
      for (const rl of r.lines) {
        const line = po.lines.find((l) => l.id === rl.lineId);
        if (line) s.ytdReceived += rl.qty * line.unitCost;
      }
    }
  }
  for (const s of map.values()) s.ytdReceived = round2(s.ytdReceived);
  return map;
}

export function supplierInitials(name: string, code?: string): string {
  if (code && code.length <= 3) return code.toUpperCase();
  return name
    .replace(/[^A-Za-z ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
