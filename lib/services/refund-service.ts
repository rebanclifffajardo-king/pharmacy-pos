import type { DemoDatabase, Refund, RefundLine, SaleTransaction } from "@/lib/types";
import { DomainError, addMovement, logActivity, mutate, verifyPin, type CommandContext } from "./context";
import { refundAmountFor } from "./pricing";
import { isBatchExpired } from "./stock";
import { peso, round2, todayKey } from "@/lib/utils/format";
import { padNumber, uid } from "@/lib/utils/id";
import { hasPermission } from "@/lib/auth/permissions";

export interface RefundLineInput {
  saleLineId: string;
  /** Base units to refund. */
  qty: number;
  /** Only true when the pharmacist confirms the returned item is sealed and saleable. */
  restock: boolean;
}

export interface CreateRefundInput {
  transactionId: string;
  lines: RefundLineInput[];
  reason: string;
  /** User authorizing the refund (must hold `sales.refund`) and their demo PIN. */
  authorizedById: string;
  pin: string;
}

/** Remaining refundable base units for a sale line. */
export function refundableQty(line: SaleTransaction["lines"][number]): number {
  return Math.max(0, line.baseQty - line.refundedQty);
}

export function createRefund(db: DemoDatabase, ctx: CommandContext, input: CreateRefundInput) {
  const tx = db.transactions.find((t) => t.id === input.transactionId);
  if (!tx) throw new DomainError("Sale not found.");
  if (tx.status === "voided") throw new DomainError("Voided sales cannot be refunded.");
  if (tx.status === "refunded") throw new DomainError("This sale has already been fully refunded.");
  if (!input.reason.trim()) throw new DomainError("A refund reason is required.");
  const approver = verifyPin(db, input.authorizedById, input.pin);
  if (!hasPermission(approver.role, "sales.refund")) throw new DomainError(`${approver.name} is not allowed to authorize refunds.`);

  const lines = input.lines.filter((l) => l.qty > 0);
  if (!lines.length) throw new DomainError("Choose at least one item and quantity to refund.");
  const today = todayKey();

  const planned: RefundLine[] = [];
  for (const l of lines) {
    const line = tx.lines.find((x) => x.id === l.saleLineId);
    if (!line) throw new DomainError("Sale line not found.");
    if (!Number.isInteger(l.qty)) throw new DomainError("Refund quantities must be whole units.");
    const max = refundableQty(line);
    if (l.qty > max) throw new DomainError(`Only ${max} ${line.unit} of ${line.name} can still be refunded.`);
    let restockBatchId: string | undefined;
    let restockBatchNo: string | undefined;
    if (l.restock) {
      // Return to the latest-expiring original batch that is still saleable.
      const candidates = line.allocations
        .map((a) => db.batches.find((b) => b.id === a.batchId))
        .filter((b): b is NonNullable<typeof b> => !!b && b.status === "saleable" && !isBatchExpired(b, today))
        .sort((a, b) => (a.expiryDate < b.expiryDate ? 1 : -1));
      const fallback = db.batches
        .filter((b) => b.medicineId === line.medicineId && b.status === "saleable" && !isBatchExpired(b, today))
        .sort((a, b) => (a.expiryDate < b.expiryDate ? 1 : -1));
      const target = candidates[0] ?? fallback[0];
      if (!target) throw new DomainError(`${line.name}: no saleable batch to restock into — mark it as not saleable.`);
      restockBatchId = target.id;
      restockBatchNo = target.batchNo;
    }
    planned.push({
      saleLineId: line.id,
      medicineId: line.medicineId,
      name: line.name,
      qty: l.qty,
      amount: refundAmountFor(line, l.qty, tx),
      restock: l.restock,
      restockBatchId,
      restockBatchNo,
    });
  }
  const amount = round2(planned.reduce((s, l) => s + l.amount, 0));

  return mutate(db, (d) => {
    const t = d.transactions.find((x) => x.id === tx.id)!;
    const seq = d.settings.pos.nextRefundNo;
    d.settings.pos.nextRefundNo = seq + 1;
    const refund: Refund = {
      id: uid("rfd"),
      refundNo: d.settings.pos.refundPrefix + padNumber(seq, 6),
      transactionId: t.id,
      receiptNo: t.receiptNo,
      createdAt: ctx.now.toISOString(),
      lines: planned,
      amount,
      reason: input.reason.trim(),
      method: t.payment.method,
      processedById: ctx.user.id,
      processedByName: ctx.user.name,
      authorizedById: approver.id,
      authorizedByName: approver.name,
    };
    for (const p of planned) {
      const line = t.lines.find((x) => x.id === p.saleLineId)!;
      line.refundedQty += p.qty;
      if (p.restock && p.restockBatchId) {
        const b = d.batches.find((x) => x.id === p.restockBatchId)!;
        b.quantity += p.qty;
        addMovement(d, ctx, {
          medicineId: p.medicineId,
          batchId: b.id,
          batchNo: b.batchNo,
          type: "refund_restock",
          qty: p.qty,
          reference: refund.refundNo,
          reason: "Refund — returned to saleable stock",
          authorizedById: approver.id,
          authorizedByName: approver.name,
        });
      }
    }
    t.refundedAmount = round2(t.refundedAmount + amount);
    t.refundIds.push(refund.id);
    t.status = t.lines.every((l) => l.refundedQty >= l.baseQty) ? "refunded" : "partially_refunded";
    d.refunds.unshift(refund);
    logActivity(d, ctx, {
      kind: "refund",
      tone: "warning",
      message: `Refund ${refund.refundNo} · ${peso(amount)} for ${t.receiptNo} — authorized by ${approver.name}`,
      reference: refund.refundNo,
    });
    return refund as Refund;
  });
}
