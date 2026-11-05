import type {
  BatchAllocation,
  DemoDatabase,
  DiscountInput,
  HeldSale,
  HeldSaleLine,
  PaymentMethod,
  RxVerification,
  SaleLine,
  SaleTransaction,
} from "@/lib/types";
import { computeTotals } from "./pricing";
import { DomainError, addMovement, logActivity, mutate, verifyPin, type CommandContext } from "./context";
import { InsufficientStockError, medicineName, planFefoAllocation } from "./stock";
import { dateKey, peso, round2, todayKey } from "@/lib/utils/format";
import { padNumber, uid } from "@/lib/utils/id";
import { hasPermission } from "@/lib/auth/permissions";

export interface CartLineInput {
  medicineId: string;
  packMultiplier: number;
  packLabel: string;
  qty: number;
}

export interface PaymentInput {
  method: PaymentMethod;
  tendered?: number;
  reference?: string;
  approvalCode?: string;
  cardLast4?: string;
}

export interface FinalizeSaleInput {
  /** Generated when the payment dialog opens. Re-submitting the same key returns the same sale. */
  idempotencyKey: string;
  lines: CartLineInput[];
  discount: DiscountInput;
  payment: PaymentInput;
  rxVerification?: RxVerification;
  heldSaleId?: string;
}

export interface FinalizeSaleResult {
  transaction: SaleTransaction;
  /** True when the idempotency key matched an existing sale (nothing new was created). */
  duplicate: boolean;
}

/**
 * Validates and records a sale atomically:
 * stock check → FEFO batch allocation → totals → transaction → batch deduction →
 * stock movements → activity → receipt counter. Idempotent per `idempotencyKey`.
 */
export function finalizeSale(db: DemoDatabase, ctx: CommandContext, input: FinalizeSaleInput) {
  const existing = db.transactions.find((t) => t.idempotencyKey === input.idempotencyKey);
  if (existing) return { db, result: { transaction: existing, duplicate: true } as FinalizeSaleResult };

  if (!hasPermission(ctx.user.role, "pos.sell")) throw new DomainError("Your role cannot process sales.");
  if (!input.lines.length) throw new DomainError("The cart is empty.");
  const today = todayKey();
  const settings = db.settings;

  // Aggregate base units per medicine to validate stock across multiple pack lines.
  const needByMed = new Map<string, number>();
  for (const l of input.lines) {
    if (!Number.isFinite(l.qty) || l.qty <= 0 || !Number.isInteger(l.qty)) throw new DomainError("Quantities must be whole numbers above zero.");
    needByMed.set(l.medicineId, (needByMed.get(l.medicineId) ?? 0) + l.qty * l.packMultiplier);
  }

  // Plan allocations against a working copy of batch quantities.
  const working = new Map(db.batches.map((b) => [b.id, b.quantity]));
  const lines: SaleLine[] = [];
  let needsRx = false;
  for (const l of input.lines) {
    const m = db.medicines.find((x) => x.id === l.medicineId);
    if (!m) throw new DomainError("Medicine not found.");
    if (m.status !== "active") throw new DomainError(`${medicineName(m)} is archived and cannot be sold.`);
    if (m.rxRequired) needsRx = true;
    const baseQty = l.qty * l.packMultiplier;
    const batches = db.batches
      .filter((b) => b.medicineId === m.id)
      .map((b) => ({ ...b, quantity: working.get(b.id) ?? 0 }));
    let allocations: BatchAllocation[];
    try {
      allocations = planFefoAllocation(batches, baseQty, today);
    } catch (e) {
      if (e instanceof InsufficientStockError) {
        const avail = batches.filter((b) => b.status === "saleable" && b.expiryDate > today).reduce((s, b) => s + b.quantity, 0);
        throw new DomainError(`Not enough sellable stock for ${medicineName(m)} — ${avail} ${m.unit} available (expired and quarantined batches are excluded).`);
      }
      throw e;
    }
    let cost = 0;
    for (const a of allocations) {
      working.set(a.batchId, (working.get(a.batchId) ?? 0) - a.qty);
      cost += (db.batches.find((b) => b.id === a.batchId)?.unitCost ?? m.costPrice) * a.qty;
    }
    lines.push({
      id: uid("ln"),
      medicineId: m.id,
      name: medicineName(m),
      genericName: m.genericName,
      unit: m.unit,
      packLabel: l.packLabel,
      packMultiplier: l.packMultiplier,
      qty: l.qty,
      baseQty,
      unitPrice: m.sellingPrice,
      lineTotal: round2(m.sellingPrice * baseQty),
      unitCost: round2(cost / baseQty),
      rxRequired: m.rxRequired,
      allocations,
      refundedQty: 0,
    });
  }

  if (needsRx && !input.rxVerification) throw new DomainError("Pharmacist verification is required for prescription items.");

  const discount = input.discount;
  if ((discount.type === "senior" || discount.type === "pwd") && !discount.idNumber?.trim()) {
    throw new DomainError(`Enter the ${discount.type === "senior" ? "OSCA / Senior Citizen" : "PWD"} ID number.`);
  }
  if (discount.type === "manual") {
    if (settings.pos.manualDiscountRequiresApproval && !hasPermission(ctx.user.role, "pos.manualDiscount") && !discount.approvedById) {
      throw new DomainError("Manual discounts need Administrator approval.");
    }
  }
  const totals = computeTotals(lines, discount, settings.pos);
  if (totals.total <= 0) throw new DomainError("Total must be greater than zero.");

  const pay = input.payment;
  let tendered: number | undefined;
  let change: number | undefined;
  if (pay.method === "cash") {
    tendered = round2(pay.tendered ?? 0);
    if (tendered + 0.0001 < totals.total) throw new DomainError(`Insufficient cash — ${peso(totals.total - tendered)} short.`);
    change = round2(tendered - totals.total);
  } else if (pay.method === "qrph" && !pay.reference) {
    throw new DomainError("QR Ph payment has no confirmed provider reference.");
  } else if (pay.method === "card" && !pay.approvalCode) {
    throw new DomainError("Card payment has not been approved on the terminal.");
  }

  return mutate(db, (d) => {
    const seq = d.settings.pos.nextReceiptNo;
    d.settings.pos.nextReceiptNo = seq + 1;
    const receiptNo = d.settings.pos.receiptPrefix + padNumber(seq, d.settings.pos.receiptPadding);
    const tx: SaleTransaction = {
      id: uid("txn"),
      receiptNo,
      idempotencyKey: input.idempotencyKey,
      createdAt: ctx.now.toISOString(),
      cashierId: ctx.user.id,
      cashierName: ctx.user.name,
      branch: d.settings.pharmacy.branch,
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
      payment: {
        method: pay.method,
        amountDue: totals.total,
        tendered,
        change,
        reference: pay.reference,
        approvalCode: pay.approvalCode,
        cardLast4: pay.cardLast4,
        simulated: true,
      },
      status: "completed",
      discountIdNumber: discount.idNumber?.trim() || undefined,
      customerName: discount.customerName?.trim() || undefined,
      rxVerification: needsRx ? input.rxVerification : undefined,
      printCount: 0,
      refundedAmount: 0,
      refundIds: [],
    };
    // Deduct stock from the allocated batches.
    for (const line of lines) {
      for (const a of line.allocations) {
        const b = d.batches.find((x) => x.id === a.batchId)!;
        b.quantity = Math.max(0, b.quantity - a.qty);
      }
      for (const a of line.allocations) {
        addMovement(d, ctx, {
          medicineId: line.medicineId,
          batchId: a.batchId,
          batchNo: a.batchNo,
          type: "sale",
          qty: -a.qty,
          reference: receiptNo,
          reason: "POS sale (FEFO)",
        });
      }
    }
    d.transactions.push(tx);
    if (input.heldSaleId) d.heldSales = d.heldSales.filter((h) => h.id !== input.heldSaleId);
    const methodLabel = { cash: "Cash", qrph: "QR Ph (demo)", card: "Card (demo)" }[pay.method];
    logActivity(d, ctx, {
      kind: "sale",
      tone: "success",
      message: `Sale ${receiptNo} · ${peso(totals.total)} · ${methodLabel} · ${lines.length} item${lines.length === 1 ? "" : "s"}`,
      reference: receiptNo,
    });
    return { transaction: tx, duplicate: false } as FinalizeSaleResult;
  });
}

/** Same-day void: reverses the sale and returns units to their original batches. */
export function voidSale(db: DemoDatabase, ctx: CommandContext, input: { transactionId: string; reason: string; pin: string }) {
  if (!hasPermission(ctx.user.role, "sales.void")) throw new DomainError("Only an Administrator can void a sale.");
  verifyPin(db, ctx.user.id, input.pin);
  const tx = db.transactions.find((t) => t.id === input.transactionId);
  if (!tx) throw new DomainError("Transaction not found.");
  if (tx.status !== "completed") throw new DomainError("Only completed sales without refunds can be voided.");
  if (dateKey(tx.createdAt) !== dateKey(ctx.now)) throw new DomainError("Voids are allowed on the same business day only. Use a refund instead.");
  if (!input.reason.trim()) throw new DomainError("A reason is required.");

  return mutate(db, (d) => {
    const t = d.transactions.find((x) => x.id === tx.id)!;
    t.status = "voided";
    t.voidedAt = ctx.now.toISOString();
    t.voidedById = ctx.user.id;
    t.voidedByName = ctx.user.name;
    t.voidReason = input.reason.trim();
    for (const line of t.lines) {
      for (const a of line.allocations) {
        const b = d.batches.find((x) => x.id === a.batchId);
        if (!b) continue;
        b.quantity += a.qty;
        addMovement(d, ctx, { medicineId: line.medicineId, batchId: b.id, batchNo: b.batchNo, type: "void_restock", qty: a.qty, reference: t.receiptNo, reason: "Sale voided" });
      }
    }
    logActivity(d, ctx, { kind: "void", tone: "danger", message: `Voided ${t.receiptNo} (${peso(t.total)}) — ${t.voidReason}`, reference: t.receiptNo });
    return t as SaleTransaction;
  });
}

export function recordPrint(db: DemoDatabase, ctx: CommandContext, input: { transactionId: string; reprint: boolean }) {
  return mutate(db, (d) => {
    const t = d.transactions.find((x) => x.id === input.transactionId);
    if (!t) throw new DomainError("Transaction not found.");
    t.printCount += 1;
    t.lastPrintedAt = ctx.now.toISOString();
    logActivity(d, ctx, {
      kind: "print",
      tone: "info",
      message: `${input.reprint ? "Reprint" : "Print"} requested for ${t.receiptNo} (browser print dialog)`,
      reference: t.receiptNo,
    });
    return t.printCount;
  });
}

export function holdSale(db: DemoDatabase, ctx: CommandContext, input: { lines: HeldSaleLine[]; discount: DiscountInput; label?: string }) {
  if (!input.lines.length) throw new DomainError("Nothing to hold — the cart is empty.");
  return mutate(db, (d) => {
    const held: HeldSale = {
      id: uid("held"),
      label: input.label?.trim() || `Held sale ${d.heldSales.length + 1}`,
      createdAt: ctx.now.toISOString(),
      cashierId: ctx.user.id,
      lines: input.lines,
      discount: input.discount,
    };
    d.heldSales.push(held);
    return held as HeldSale;
  });
}

export function removeHeldSale(db: DemoDatabase, _ctx: CommandContext, input: { id: string }) {
  return mutate(db, (d) => {
    d.heldSales = d.heldSales.filter((h) => h.id !== input.id);
    return true;
  });
}

/** Audit entry when a cashier cancels an unfinished sale (nothing is deducted). */
export function logCancelledSale(db: DemoDatabase, ctx: CommandContext, input: { items: number; total: number }) {
  return mutate(db, (d) => {
    logActivity(d, ctx, { kind: "sale", tone: "neutral", message: `Cancelled an unfinished sale · ${input.items} item${input.items === 1 ? "" : "s"} · ${peso(input.total)} (no stock moved)` });
    return true;
  });
}
