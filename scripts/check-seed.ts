import { buildSeedDatabase } from "../lib/mock-data/seed";
import { getStockIndex } from "../lib/services/stock";

const db = buildSeedDatabase(new Date());
const idx = getStockIndex(db);
const infos = [...idx.values()];
const json = JSON.stringify(db);
const report = {
  medicines: db.medicines.length,
  categories: db.categories.length,
  suppliers: db.suppliers.length,
  users: db.users.length,
  batches: db.batches.length,
  transactions: db.transactions.length,
  today: db.transactions.filter((t) => t.createdAt.slice(0, 10) === new Date().toISOString().slice(0, 10)).length,
  refunds: db.refunds.length,
  voided: db.transactions.filter((t) => t.status === "voided").length,
  purchaseOrders: db.purchaseOrders.length,
  poStatuses: db.purchaseOrders.map((p) => p.status).join(","),
  low: infos.filter((i) => i.isLow).length,
  out: infos.filter((i) => i.isOut).length,
  expiring: infos.filter((i) => i.isExpiring).length,
  expiredBatches: db.batches.filter((b) => b.expiryDate <= new Date().toISOString().slice(0, 10) && b.quantity > 0).length,
  inactive: db.medicines.filter((m) => m.status === "inactive").length,
  negative: db.batches.filter((b) => b.quantity < 0).length,
  movements: db.movements.length,
  sizeKB: Math.round(json.length / 1024),
  overlapLowExp: infos.filter((i) => i.isLow && i.isExpiring).length,
};
console.log(report);
// Determinism check
const db2 = buildSeedDatabase(new Date());
console.log("deterministic:", JSON.stringify(db2.medicines) === JSON.stringify(db.medicines) && db2.transactions.length === db.transactions.length);
