import type {
  ActivityLog,
  Batch,
  DemoDatabase,
  DiscountInput,
  Medicine,
  PaymentMethod,
  PurchaseOrder,
  PurchaseOrderLine,
  Refund,
  SaleLine,
  SaleTransaction,
  StockMovement,
  User,
} from "@/lib/types";
import { CATEGORIES } from "./categories";
import { SUPPLIERS } from "./suppliers";
import { DEMO_USERS } from "./users";
import { DEFAULT_SETTINGS } from "./settings";
import { buildMedicineSeeds, type StockProfile } from "./medicines";
import { createRng, type Rng } from "@/lib/utils/random";
import { addDays, dateKey, manilaInstant, round2 } from "@/lib/utils/format";
import { padNumber } from "@/lib/utils/id";
import { computeTotals, refundAmountFor } from "@/lib/services/pricing";
import { medicineName, planFefoAllocation, sellableBatches } from "@/lib/services/stock";

export const SCHEMA_VERSION = 1;
const SEED = 20261105;

/**
 * Builds the full demo database deterministically. Records are identical on every reset;
 * only their dates are anchored to "now" so today's dashboard and expiry alerts stay live.
 */
export function buildSeedDatabase(now: Date = new Date()): DemoDatabase {
  const rng = createRng(SEED);
  const T = dateKey(now);
  const nowIso = now.toISOString();
  const settings = structuredClone(DEFAULT_SETTINGS);

  const users: User[] = DEMO_USERS.map((u, i) => ({
    ...u,
    createdAt: manilaInstant(addDays(T, -400 + i * 7), 9),
    lastLoginAt: u.status === "invited" ? undefined : manilaInstant(addDays(T, i % 3 === 0 ? 0 : -1), 7 + (i % 4), 55 - i * 3),
  }));
  const userById = new Map(users.map((u) => [u.id, u]));
  const suppliers = SUPPLIERS.map((s, i) => ({ ...s, createdAt: manilaInstant(addDays(T, -700 + i * 11), 10) }));

  const seeds = buildMedicineSeeds();
  const medicines: Medicine[] = seeds.map((s, i) => ({
    ...s.medicine,
    createdAt: manilaInstant(addDays(T, -380 + (i % 30)), 10),
    updatedAt: manilaInstant(addDays(T, -20 - (i % 15)), 15),
  }));
  const profileOf = new Map(seeds.map((s) => [s.medicine.id, s.profile]));

  // ------------------------------------------------------------------ batches
  const batches: Batch[] = [];
  const usedBatchNos = new Set<string>();
  const batchPrefix = (m: Medicine) =>
    (m.brandName === "Generic" ? m.genericName : m.brandName).replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase();

  const makeBatch = (m: Medicine, qty: number, expiry: string, received: string, extra: Partial<Batch> = {}): Batch => {
    const yy = received.slice(2, 4);
    let no = `${batchPrefix(m)}${yy}-${received.slice(5, 7)}${received.slice(8, 10)}`;
    let k = 1;
    while (usedBatchNos.has(no)) no = `${batchPrefix(m)}${yy}-${received.slice(5, 7)}${received.slice(8, 10)}${String.fromCharCode(64 + k++)}`;
    usedBatchNos.add(no);
    const unitCost = round2(m.costPrice * (0.96 + rng.next() * 0.06));
    const b: Batch = {
      id: `bat_${String(batches.length + 1).padStart(4, "0")}`,
      medicineId: m.id,
      batchNo: no,
      expiryDate: expiry,
      manufactureDate: addDays(received, -rng.int(60, 200)),
      receivedDate: received,
      supplierId: m.supplierId,
      initialQty: Math.max(qty, roundToPack(m, qty * (1 + rng.next() * 1.5))),
      quantity: qty,
      unitCost,
      location: m.location,
      status: "saleable",
      ...extra,
    };
    batches.push(b);
    return b;
  };

  const roundToPack = (m: Medicine, q: number) => {
    const step = m.stripSize ?? 1;
    return Math.max(step, Math.round(q / step) * step);
  };

  for (const m of medicines) {
    const profile = profileOf.get(m.id) as StockProfile;
    const min = m.minStock;
    if (profile === "ok") {
      const total = roundToPack(m, min * (1.6 + rng.next() * 3.4));
      const parts = rng.int(1, 3);
      let left = total;
      let expiry = addDays(T, rng.int(150, 520));
      for (let p = 0; p < parts; p++) {
        const q = p === parts - 1 ? left : roundToPack(m, left * (0.3 + rng.next() * 0.3));
        if (q <= 0) continue;
        left -= q;
        makeBatch(m, q, expiry, addDays(T, -rng.int(8, 260)));
        expiry = addDays(expiry, rng.int(90, 300));
      }
    } else if (profile === "low") {
      const total = Math.max(1, roundToPack(m, min * (0.15 + rng.next() * 0.7)));
      const q = Math.min(total, min);
      makeBatch(m, q, addDays(T, rng.int(200, 700)), addDays(T, -rng.int(20, 200)));
    } else if (profile.startsWith("exp:")) {
      const d = Number(profile.slice(4));
      const first = Math.max(1, roundToPack(m, min * (0.4 + rng.next() * 0.5)));
      const second = Math.max(1, roundToPack(m, min * (1.3 + rng.next() * 1.2)));
      makeBatch(m, first, addDays(T, d), addDays(T, -rng.int(400, 640)));
      makeBatch(m, second, addDays(T, rng.int(320, 720)), addDays(T, -rng.int(10, 120)));
    } else if (profile === "expired") {
      makeBatch(m, 64, addDays(T, -12), addDays(T, -505), { status: "quarantined", location: "Quarantine Q-1" });
    }
    if (profile === "out" || profile === "inactive") {
      // A depleted batch keeps purchase history meaningful.
      makeBatch(m, 0, addDays(T, rng.int(120, 500)), addDays(T, -rng.int(90, 200)));
    }
  }

  // Additional expired / recalled batches (4 blocked batches in total with Ascof Lagundi).
  const byName = (brand: string, generic: string, strengthPart: string) =>
    medicines.find((m) => m.brandName === brand && m.genericName === generic && m.strength.includes(strengthPart))!;
  makeBatch(byName("Generic", "Cetirizine", "5 mg/5 mL"), 20, addDays(T, -6), addDays(T, -480), { status: "quarantined", location: "Quarantine Q-1" });
  makeBatch(byName("Hydrite", "Oral Rehydration Salts", "4.1"), 46, addDays(T, -5), addDays(T, -720), { status: "quarantined", location: "Quarantine Q-1" });
  makeBatch(byName("Tempra", "Paracetamol", "120 mg"), 12, addDays(T, -3), addDays(T, -660), { status: "recalled", location: "Quarantine Q-2" });

  // ------------------------------------------------------------------ transactions
  const cashiers = [
    { id: "usr_cashier", w: 0.58 },
    { id: "usr_cashier2", w: 0.32 },
    { id: "usr_pharm2", w: 0.1 },
  ];
  const pharmacists = ["usr_pharm", "usr_pharm2"];
  const prescribers = ["Dr. Ana Villanueva", "Dr. Paolo Mendoza", "Dr. Grace Salazar", "Dr. Miguel Torres", "Dr. Rosa Dimaculangan", "Dr. Ben Castillo"];

  const popularity = new Map<string, number>();
  const boost: Record<string, number> = {
    "Biogesic 500 mg": 10,
    "Neozep Z+ Forte 10/2/325/10 mg": 7,
    "Bioflu 10/2/500 mg": 6,
    "Generic Ascorbic Acid 500 mg": 6,
    "Generic Paracetamol 500 mg": 6,
    "Allerta 10 mg": 5,
    "Solmux 500 mg": 5,
    "Kremil-S 178/233/30 mg": 4,
    "Cozaar 50 mg": 4,
    "Glucophage 500 mg": 4,
    "Generic Amlodipine 10 mg": 4,
    "Generic Losartan 50 mg": 4,
    "Diatabs 2 mg": 4,
    "Alaxan FR 200/325 mg": 4,
    "Generic Metformin 500 mg": 3,
    "Enervon 1 tablet": 3,
    "Decolgen Forte 25/2/500 mg": 3,
    "Advil 200 mg": 3,
    "Generic Amoxicillin 500 mg": 3,
    "Generic Atorvastatin 20 mg": 3,
  };
  for (const m of medicines) {
    if (m.status === "inactive") continue;
    popularity.set(m.id, boost[medicineName(m)] ?? (m.sellingPrice > 300 ? 0.4 : 1));
  }
  const sellable = medicines.filter((m) => popularity.has(m.id));
  const weights = sellable.map((m) => popularity.get(m.id)!);
  const todayHealthy = medicines.filter((m) => profileOf.get(m.id) === "ok");
  const todayWeights = todayHealthy.map((m) => popularity.get(m.id) ?? 1);

  const isMaintenance = (m: Medicine) => ["cat_hypertension", "cat_diabetes", "cat_cholesterol"].includes(m.categoryId);
  const pickQty = (r: Rng, m: Medicine): number => {
    if (["bottle", "inhaler", "tube", "pack"].includes(m.unit)) return r.weighted([1, 2], [0.85, 0.15]);
    if (isMaintenance(m) && m.rxRequired) return r.weighted([10, 14, 30], [0.3, 0.2, 0.5]);
    if (m.categoryId === "cat_antibiotics" && m.unit !== "bottle") return r.weighted([14, 21, 7], [0.4, 0.4, 0.2]);
    if (m.unit === "sachet" || m.unit === "nebule") return r.int(1, 6);
    return r.weighted([1, 2, 3, 4, 6, 10, 20], [0.18, 0.24, 0.14, 0.14, 0.1, 0.14, 0.06]);
  };

  type Draft = { at: string; today: boolean };
  const drafts: Draft[] = [];
  for (let d = 364; d >= 1; d--) {
    const day = addDays(T, -d);
    const dow = new Date(day + "T00:00:00Z").getUTCDay();
    const count = rng.int(1, 4) + (d < 45 ? rng.int(0, 2) : 0) + (dow === 6 ? 1 : 0);
    for (let i = 0; i < count; i++) {
      drafts.push({ at: manilaInstant(day, rng.int(7, 21), rng.int(0, 59), rng.int(0, 59)), today: false });
    }
  }
  // Today: transactions up to a few minutes before "now".
  const nowMs = now.getTime();
  const openMs = new Date(manilaInstant(T, 7)).getTime();
  const startMs = nowMs - openMs > 60 * 60 * 1000 ? openMs : new Date(manilaInstant(T, 0)).getTime();
  const span = nowMs - 5 * 60 * 1000 - startMs;
  if (span > 0) {
    const todayCount = Math.min(26, Math.max(4, Math.round(span / (40 * 60 * 1000))));
    for (let i = 0; i < todayCount; i++) {
      drafts.push({ at: new Date(startMs + rng.next() * span).toISOString(), today: true });
    }
  }
  drafts.sort((a, b) => (a.at < b.at ? -1 : 1));

  const transactions: SaleTransaction[] = [];
  const movements: StockMovement[] = [];
  let lineSeq = 0;

  for (const draft of drafts) {
    const pool = draft.today ? todayHealthy : sellable;
    const poolW = draft.today ? todayWeights : weights;
    const nLines = rng.weighted([1, 2, 3, 4], [0.45, 0.3, 0.17, 0.08]);
    const chosen = new Set<Medicine>();
    for (let i = 0; i < nLines; i++) chosen.add(rng.weighted(pool, poolW));

    const cashierId = rng.weighted(cashiers.map((c) => c.id), cashiers.map((c) => c.w));
    const cashier = userById.get(cashierId)!;
    const lines: SaleLine[] = [];
    for (const m of chosen) {
      const qty = pickQty(rng, m);
      let allocations: SaleLine["allocations"] = [];
      let unitCost = m.costPrice;
      if (draft.today) {
        const avail = sellableBatches({ batches }, m.id, T);
        const total = avail.reduce((s, b) => s + b.quantity, 0);
        if (total - qty < m.minStock * 1.2) continue; // keep healthy items healthy
        allocations = planFefoAllocation(avail, qty, T);
        let cost = 0;
        for (const a of allocations) {
          const b = batches.find((x) => x.id === a.batchId)!;
          b.quantity -= a.qty;
          cost += b.unitCost * a.qty;
        }
        unitCost = round2(cost / qty);
      }
      lines.push({
        id: `ln_${String(++lineSeq).padStart(6, "0")}`,
        medicineId: m.id,
        name: medicineName(m),
        genericName: m.genericName,
        unit: m.unit,
        packLabel: m.dosageForm,
        packMultiplier: 1,
        qty,
        baseQty: qty,
        unitPrice: m.sellingPrice,
        lineTotal: round2(m.sellingPrice * qty),
        unitCost,
        rxRequired: m.rxRequired,
        allocations,
        refundedQty: 0,
      });
    }
    if (!lines.length) continue;

    const discType = rng.weighted(["none", "senior", "pwd"] as const, [0.85, 0.12, 0.03]);
    const discount: DiscountInput =
      discType === "none"
        ? { type: "none" }
        : { type: discType, idNumber: (discType === "senior" ? "SC-" : "PWD-") + padNumber(rng.int(100000, 999999), 6) + " (demo)" };
    const totals = computeTotals(lines, discount, settings.pos);
    const method: PaymentMethod = rng.weighted(["cash", "qrph", "card"] as const, [0.58, 0.29, 0.13]);
    const seq = transactions.length + 1;
    const receiptNo = settings.pos.receiptPrefix + padNumber(seq, settings.pos.receiptPadding);
    let payment: SaleTransaction["payment"];
    if (method === "cash") {
      const tendered = rng.weighted(
        [totals.total, Math.ceil(totals.total / 100) * 100, Math.ceil(totals.total / 500) * 500, Math.ceil(totals.total / 1000) * 1000],
        [0.2, 0.4, 0.25, 0.15]
      );
      payment = { method, amountDue: totals.total, tendered: round2(tendered), change: round2(tendered - totals.total), simulated: true };
    } else if (method === "qrph") {
      payment = { method, amountDue: totals.total, reference: "DEMO-QR-" + padNumber(rng.int(10000000, 99999999), 8), simulated: true };
    } else {
      payment = {
        method,
        amountDue: totals.total,
        approvalCode: "DEMO-AUTH-" + padNumber(rng.int(100000, 999999), 6),
        cardLast4: padNumber(rng.int(0, 9999), 4),
        simulated: true,
      };
    }
    const hasRx = lines.some((l) => l.rxRequired);
    const pharmacist = userById.get(rng.pick(pharmacists))!;
    const tx: SaleTransaction = {
      id: `txn_${String(seq).padStart(5, "0")}`,
      receiptNo,
      idempotencyKey: `seed-${seq}`,
      createdAt: draft.at,
      cashierId: cashier.id,
      cashierName: cashier.name,
      branch: settings.pharmacy.branch,
      lines,
      subtotal: totals.subtotal,
      discountType: totals.discountType,
      discountRate: totals.discountRate,
      discountAmount: totals.discountAmount,
      lessVat: totals.lessVat,
      vatableSales: totals.vatableSales,
      vatAmount: totals.vatAmount,
      vatExemptSales: totals.vatExemptSales,
      total: totals.total,
      payment,
      status: "completed",
      discountIdNumber: discount.idNumber,
      rxVerification: hasRx
        ? {
            pharmacistId: pharmacist.id,
            pharmacistName: pharmacist.name,
            prescriber: rng.pick(prescribers),
            prcLicense: padNumber(rng.int(10000, 999999), 7) + " (demo)",
            rxDate: dateKey(new Date(new Date(draft.at).getTime() - rng.int(0, 10) * 86400000)),
            verifiedAt: draft.at,
          }
        : undefined,
      printCount: 1,
      lastPrintedAt: draft.at,
      refundedAmount: 0,
      refundIds: [],
    };
    transactions.push(tx);

    if (draft.today) {
      for (const l of lines) {
        const balance = sellableBatches({ batches }, l.medicineId, T).reduce((s, b) => s + b.quantity, 0);
        for (const a of l.allocations) {
          movements.push({
            id: `mov_s${tx.id}_${a.batchId}`,
            medicineId: l.medicineId,
            batchId: a.batchId,
            batchNo: a.batchNo,
            type: "sale",
            qty: -a.qty,
            balanceAfter: balance,
            reference: receiptNo,
            reason: "POS sale (FEFO)",
            userId: cashier.id,
            userName: cashier.name,
            createdAt: draft.at,
          });
        }
      }
    }
  }
  settings.pos.nextReceiptNo = transactions.length + 1;

  // ------------------------------------------------------------------ refunds & voids (history)
  const refunds: Refund[] = [];
  const recentIdx = transactions
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.createdAt < manilaInstant(T, 0) && t.createdAt > manilaInstant(addDays(T, -60), 0));
  const refundTargets = [5, 13, 22, 31, 40, 52, 61, 77, 90, 104, 118, 131].map((k) => recentIdx[(k * 7) % recentIdx.length]?.t).filter(Boolean);
  const reasons = ["Customer returned unopened box", "Wrong strength dispensed", "Doctor changed prescription", "Duplicate purchase", "Allergic reaction reported — unopened"];
  for (const tx of refundTargets) {
    if (tx.status !== "completed") continue;
    const line = tx.lines[0];
    const qty = line.baseQty > 1 ? Math.max(1, Math.floor(line.baseQty / 2)) : 1;
    const amount = refundAmountFor(line, qty, tx);
    const auth = userById.get(rng.pick(["usr_pharm", "usr_admin"]))!;
    const refundNo = settings.pos.refundPrefix + padNumber(refunds.length + 1, 6);
    const at = new Date(new Date(tx.createdAt).getTime() + rng.int(20, 300) * 60000).toISOString();
    const restock = !line.rxRequired && rng.chance(0.6);
    refunds.push({
      id: `rfd_${String(refunds.length + 1).padStart(4, "0")}`,
      refundNo,
      transactionId: tx.id,
      receiptNo: tx.receiptNo,
      createdAt: at,
      lines: [{ saleLineId: line.id, medicineId: line.medicineId, name: line.name, qty, amount, restock }],
      amount,
      reason: rng.pick(reasons),
      method: tx.payment.method,
      processedById: tx.cashierId,
      processedByName: tx.cashierName,
      authorizedById: auth.id,
      authorizedByName: auth.name,
    });
    line.refundedQty = qty;
    tx.refundedAmount = amount;
    tx.refundIds = [refunds[refunds.length - 1].id];
    const allRefunded = tx.lines.every((l) => l.refundedQty >= l.baseQty);
    tx.status = allRefunded ? "refunded" : "partially_refunded";
  }
  settings.pos.nextRefundNo = refunds.length + 1;

  const voidTargets = [9, 27, 48, 70].map((k) => recentIdx[(k * 11 + 3) % recentIdx.length]?.t).filter(Boolean);
  for (const tx of voidTargets) {
    if (tx.status !== "completed") continue;
    tx.status = "voided";
    tx.voidedAt = new Date(new Date(tx.createdAt).getTime() + 6 * 60000).toISOString();
    tx.voidedById = "usr_admin";
    tx.voidedByName = "Yasmin Marquez";
    tx.voidReason = rng.pick(["Wrong item scanned", "Customer cancelled before leaving counter", "Duplicate scan"]);
  }

  // ------------------------------------------------------------------ purchase orders
  const purchaseOrders: PurchaseOrder[] = [];
  const medsBySupplier = (sid: string, profiles: StockProfile[]) =>
    medicines.filter((m) => m.supplierId === sid && profiles.includes(profileOf.get(m.id) as StockProfile));
  const makeLines = (meds: Medicine[], n: number): PurchaseOrderLine[] =>
    meds.slice(0, n).map((m, i) => ({
      id: `pol_${purchaseOrders.length + 1}_${i + 1}`,
      medicineId: m.id,
      name: medicineName(m),
      packSize: m.packSize,
      qty: Math.max(1, Math.ceil(m.reorderQty / m.packSize)),
      unitCost: round2(m.costPrice * m.packSize),
      receivedQty: 0,
    }));
  const admin = userById.get("usr_admin")!;
  const stock = userById.get("usr_stock")!;
  const addPo = (po: Omit<PurchaseOrder, "id" | "poNumber">) => {
    const n = settings.pos.nextPoNo++;
    purchaseOrders.push({ ...po, id: `po_${n}`, poNumber: settings.pos.poPrefix + padNumber(n, 4) });
    return purchaseOrders[purchaseOrders.length - 1];
  };

  // Received POs: link to the most recent batch of each line's medicine.
  const receivedPlans: [string, number][] = [
    ["sup_vp", 44],
    ["sup_mh", 38],
    ["sup_lm", 30],
    ["sup_pg", 21],
    ["sup_lm", 8],
  ];
  for (const [sid, ago] of receivedPlans) {
    const meds = medsBySupplier(sid, ["ok", "exp:24", "exp:86", "exp:47", "exp:66"]).filter((m) =>
      batches.some((b) => b.medicineId === m.id && b.status === "saleable" && !b.purchaseOrderId)
    );
    const pick = meds.filter((_, i) => (i + ago) % 2 === 0).slice(0, 4);
    if (!pick.length) continue;
    const created = addDays(T, -ago);
    const receivedDay = addDays(created, 3);
    const lines = makeLines(pick, 4);
    const po = addPo({
      supplierId: sid,
      status: "received",
      createdAt: manilaInstant(created, 9, 30),
      createdById: stock.id,
      createdByName: stock.name,
      orderedAt: manilaInstant(created, 10),
      expectedDate: receivedDay,
      receivedAt: manilaInstant(receivedDay, 14, 40),
      notes: "Regular replenishment",
      lines,
      receipts: [],
    });
    const receiptLines = [];
    for (const l of lines) {
      const b = batches
        .filter((x) => x.medicineId === l.medicineId && x.status === "saleable" && !x.purchaseOrderId)
        .sort((a, z) => (a.receivedDate > z.receivedDate ? -1 : 1))[0];
      if (!b) continue;
      l.qty = Math.max(1, Math.ceil(b.initialQty / l.packSize));
      l.receivedQty = l.qty;
      b.initialQty = Math.max(b.initialQty, l.qty * l.packSize);
      b.purchaseOrderId = po.id;
      b.receivedDate = receivedDay;
      receiptLines.push({ lineId: l.id, qty: l.qty, batchNo: b.batchNo, expiryDate: b.expiryDate, batchId: b.id });
    }
    po.receipts.push({ id: `rcv_${po.id}_1`, receivedAt: po.receivedAt!, receivedById: stock.id, receivedByName: stock.name, lines: receiptLines });
  }

  // Partially received: one line received with a fresh batch.
  for (const [sid, ago] of [["sup_mr", 6], ["sup_st", 4]] as [string, number][]) {
    const meds = medsBySupplier(sid, ["ok", "low", "out"]);
    const lines = makeLines(meds.filter((m) => profileOf.get(m.id) !== "ok").slice(0, 2).concat(meds.filter((m) => profileOf.get(m.id) === "ok").slice(0, 2)), 4);
    const created = addDays(T, -ago);
    const po = addPo({
      supplierId: sid,
      status: "partially_received",
      createdAt: manilaInstant(created, 10),
      createdById: stock.id,
      createdByName: stock.name,
      orderedAt: manilaInstant(created, 10, 20),
      expectedDate: addDays(T, 1),
      notes: "Partial delivery — balance to follow",
      lines,
      receipts: [],
    });
    const okLine = lines.find((l) => profileOf.get(l.medicineId) === "ok");
    if (okLine) {
      const m = medicines.find((x) => x.id === okLine.medicineId)!;
      const recvPacks = Math.max(1, Math.floor(okLine.qty / 2));
      okLine.receivedQty = recvPacks;
      const recvDay = addDays(T, -1);
      const b = makeBatch(m, recvPacks * m.packSize, addDays(T, 540 + ago), recvDay, { purchaseOrderId: po.id });
      b.initialQty = recvPacks * m.packSize;
      po.receipts.push({
        id: `rcv_${po.id}_1`,
        receivedAt: manilaInstant(recvDay, 15, 10),
        receivedById: stock.id,
        receivedByName: stock.name,
        lines: [{ lineId: okLine.id, qty: recvPacks, batchNo: b.batchNo, expiryDate: b.expiryDate, batchId: b.id }],
      });
    }
  }

  // Ordered (awaiting delivery) — covers out-of-stock and low items.
  for (const [sid, ago] of [["sup_pg", 3], ["sup_mr", 2], ["sup_lm", 1]] as [string, number][]) {
    const meds = medsBySupplier(sid, ["out", "low"]);
    const created = addDays(T, -ago);
    addPo({
      supplierId: sid,
      status: "ordered",
      createdAt: manilaInstant(created, 11),
      createdById: stock.id,
      createdByName: stock.name,
      orderedAt: manilaInstant(created, 11, 15),
      expectedDate: addDays(T, 5 - ago),
      notes: "Reorder for low / out-of-stock items",
      lines: makeLines(meds.slice(ago % 2, (ago % 2) + 3), 3),
      receipts: [],
    });
  }
  // Drafts
  for (const sid of ["sup_bo", "sup_np"]) {
    const meds = medsBySupplier(sid, ["low", "ok"]);
    addPo({
      supplierId: sid,
      status: "draft",
      createdAt: manilaInstant(T, 9, 5),
      createdById: admin.id,
      createdByName: admin.name,
      notes: "Draft — review quantities before sending",
      lines: makeLines(meds, 3),
      receipts: [],
    });
  }
  // Cancelled
  {
    const meds = medsBySupplier("sup_vp", ["ok", "exp:47", "expired"]);
    const created = addDays(T, -22);
    addPo({
      supplierId: "sup_vp",
      status: "cancelled",
      createdAt: manilaInstant(created, 13),
      createdById: stock.id,
      createdByName: stock.name,
      orderedAt: manilaInstant(created, 13, 30),
      cancelledAt: manilaInstant(addDays(created, 2), 9),
      notes: "Cancelled — supplier out of stock",
      lines: makeLines(meds, 2),
      receipts: [],
    });
  }
  purchaseOrders.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  // ------------------------------------------------------------------ batch receipt history
  for (const b of batches) {
    if (b.initialQty <= 0) continue;
    const m = medicines.find((x) => x.id === b.medicineId)!;
    const po = b.purchaseOrderId ? purchaseOrders.find((p) => p.id === b.purchaseOrderId) : undefined;
    movements.push({
      id: `mov_r${b.id}`,
      medicineId: m.id,
      batchId: b.id,
      batchNo: b.batchNo,
      type: po ? "po_receipt" : "stock_in",
      qty: b.initialQty,
      reference: po?.poNumber,
      reason: po ? "Purchase order received" : "Opening stock",
      userId: stock.id,
      userName: stock.name,
      createdAt: manilaInstant(b.receivedDate, 14, 30),
    });
    if (b.status !== "saleable") {
      movements.push({
        id: `mov_q${b.id}`,
        medicineId: m.id,
        batchId: b.id,
        batchNo: b.batchNo,
        type: "quarantine",
        qty: -b.quantity,
        balanceAfter: 0,
        reason: b.status === "recalled" ? "Manufacturer recall notice" : "Expired — moved to quarantine",
        userId: "usr_pharm",
        userName: "Jose Reyes, RPh",
        createdAt: manilaInstant(addDays(b.expiryDate, 1), 8, 15),
      });
    }
  }
  movements.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  // ------------------------------------------------------------------ activity
  const ascof = byName("Ascof Lagundi", "Vitex negundo L. leaf", "600 mg");
  const ascofBatch = batches.find((b) => b.medicineId === ascof.id)!;
  const lastReceived = purchaseOrders.find((p) => p.status === "received");
  const act = (offsetMin: number, kind: ActivityLog["kind"], message: string, userId: string, tone: ActivityLog["tone"], reference?: string): ActivityLog => ({
    id: `act_seed_${offsetMin}`,
    kind,
    message,
    userId,
    userName: userById.get(userId)!.name,
    tone,
    reference,
    createdAt: new Date(nowMs - offsetMin * 60000).toISOString(),
  });
  const activity: ActivityLog[] = [
    act(35, "purchase", `Received ${lastReceived?.poNumber ?? "PO"} · ${lastReceived?.lines.length ?? 0} SKUs posted to inventory`, "usr_stock", "success", lastReceived?.poNumber),
    act(95, "inventory", `Quarantined batch ${ascofBatch.batchNo} (Ascof Lagundi 600 mg) — expired`, "usr_pharm", "danger"),
    act(160, "inventory", "Adjusted Betadine 10% · 60 mL −2 · damaged bottle", "usr_stock", "warning"),
    act(230, "inventory", "Stock count Aisle B completed · 0 variance", "usr_stock", "info"),
    act(300, "inventory", "Reorder level for Norvasc 5 mg set to 60", "usr_admin", "info"),
    act(60 * 20, "refund", `Refund ${refunds[refunds.length - 1]?.refundNo ?? ""} processed for ${refunds[refunds.length - 1]?.receiptNo ?? ""}`, "usr_pharm", "neutral"),
    act(60 * 26, "settings", "Receipt footer message updated", "usr_admin", "info"),
    act(60 * 30, "auth", "Signed in · Counter 1", "usr_cashier", "neutral"),
  ];

  return {
    schemaVersion: SCHEMA_VERSION,
    seededAt: nowIso,
    categories: structuredClone(CATEGORIES),
    suppliers,
    medicines,
    batches,
    transactions,
    refunds,
    purchaseOrders,
    users,
    movements,
    activity,
    heldSales: [],
    settings,
  };
}
