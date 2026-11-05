import type { Batch, DemoDatabase, PurchaseOrder, PurchaseOrderLine } from "@/lib/types";
import { DomainError, addMovement, logActivity, mutate, type CommandContext } from "./context";
import { medicineName } from "./stock";
import { peso, round2, todayKey } from "@/lib/utils/format";
import { padNumber, uid } from "@/lib/utils/id";
import { hasPermission } from "@/lib/auth/permissions";

export interface PurchaseOrderLineInput {
  id?: string;
  medicineId: string;
  /** Packs ordered. */
  qty: number;
  /** Cost per pack. */
  unitCost: number;
}

export interface SavePurchaseOrderInput {
  id?: string;
  supplierId: string;
  expectedDate?: string;
  notes?: string;
  lines: PurchaseOrderLineInput[];
  /** When true the PO is sent to the supplier (status → ordered). */
  submit?: boolean;
}

export function purchaseOrderTotal(po: Pick<PurchaseOrder, "lines">): number {
  return round2(po.lines.reduce((s, l) => s + l.qty * l.unitCost, 0));
}

export function purchaseOrderReceivedValue(po: Pick<PurchaseOrder, "lines">): number {
  return round2(po.lines.reduce((s, l) => s + l.receivedQty * l.unitCost, 0));
}

export function savePurchaseOrder(db: DemoDatabase, ctx: CommandContext, input: SavePurchaseOrderInput) {
  if (!hasPermission(ctx.user.role, "po.manage")) throw new DomainError("Your role cannot create or edit purchase orders.");
  if (!db.suppliers.some((s) => s.id === input.supplierId && s.status === "active")) throw new DomainError("Choose an active supplier.");
  const lines = input.lines.filter((l) => l.medicineId);
  if (!lines.length) throw new DomainError("Add at least one medicine.");
  const seen = new Set<string>();
  for (const l of lines) {
    if (seen.has(l.medicineId)) throw new DomainError("Each medicine can appear only once per order.");
    seen.add(l.medicineId);
    if (!Number.isInteger(l.qty) || l.qty <= 0) throw new DomainError("Quantities must be whole packs above zero.");
    if (!(l.unitCost >= 0)) throw new DomainError("Unit cost cannot be negative.");
  }
  const existing = input.id ? db.purchaseOrders.find((p) => p.id === input.id) : undefined;
  if (input.id && !existing) throw new DomainError("Purchase order not found.");
  if (existing && existing.status !== "draft") throw new DomainError("Only draft purchase orders can be edited.");

  return mutate(db, (d) => {
    const buildLines = (): PurchaseOrderLine[] =>
      lines.map((l) => {
        const m = d.medicines.find((x) => x.id === l.medicineId)!;
        return {
          id: l.id ?? uid("pol"),
          medicineId: m.id,
          name: medicineName(m),
          packSize: m.packSize,
          qty: l.qty,
          unitCost: round2(l.unitCost),
          receivedQty: 0,
        };
      });
    let po: PurchaseOrder;
    if (existing) {
      po = d.purchaseOrders.find((p) => p.id === existing.id)!;
      po.supplierId = input.supplierId;
      po.expectedDate = input.expectedDate || undefined;
      po.notes = input.notes?.trim() || undefined;
      po.lines = buildLines();
    } else {
      const n = d.settings.pos.nextPoNo;
      d.settings.pos.nextPoNo = n + 1;
      po = {
        id: uid("po"),
        poNumber: d.settings.pos.poPrefix + padNumber(n, 4),
        supplierId: input.supplierId,
        status: "draft",
        createdAt: ctx.now.toISOString(),
        createdById: ctx.user.id,
        createdByName: ctx.user.name,
        expectedDate: input.expectedDate || undefined,
        notes: input.notes?.trim() || undefined,
        lines: buildLines(),
        receipts: [],
      };
      d.purchaseOrders.unshift(po);
    }
    const supplier = d.suppliers.find((s) => s.id === po.supplierId)!;
    if (input.submit) {
      po.status = "ordered";
      po.orderedAt = ctx.now.toISOString();
    }
    logActivity(d, ctx, {
      kind: "purchase",
      tone: input.submit ? "success" : "info",
      message: `${input.submit ? "Sent" : existing ? "Updated draft" : "Created draft"} ${po.poNumber} to ${supplier.name} · ${peso(purchaseOrderTotal(po))}`,
      reference: po.poNumber,
    });
    return po as PurchaseOrder;
  });
}

export function submitPurchaseOrder(db: DemoDatabase, ctx: CommandContext, input: { id: string }) {
  if (!hasPermission(ctx.user.role, "po.manage")) throw new DomainError("Your role cannot send purchase orders.");
  return mutate(db, (d) => {
    const po = d.purchaseOrders.find((p) => p.id === input.id);
    if (!po) throw new DomainError("Purchase order not found.");
    if (po.status !== "draft") throw new DomainError("Only drafts can be sent.");
    if (!po.lines.length) throw new DomainError("Add at least one medicine.");
    po.status = "ordered";
    po.orderedAt = ctx.now.toISOString();
    logActivity(d, ctx, { kind: "purchase", tone: "success", message: `Sent ${po.poNumber} to supplier`, reference: po.poNumber });
    return po as PurchaseOrder;
  });
}

export function cancelPurchaseOrder(db: DemoDatabase, ctx: CommandContext, input: { id: string; reason?: string }) {
  if (!hasPermission(ctx.user.role, "po.manage")) throw new DomainError("Your role cannot cancel purchase orders.");
  return mutate(db, (d) => {
    const po = d.purchaseOrders.find((p) => p.id === input.id);
    if (!po) throw new DomainError("Purchase order not found.");
    if (po.status === "received" || po.status === "cancelled") throw new DomainError("This purchase order can no longer be cancelled.");
    if (po.lines.some((l) => l.receivedQty > 0)) throw new DomainError("Stock was already received on this order. Close it by receiving the balance instead.");
    po.status = "cancelled";
    po.cancelledAt = ctx.now.toISOString();
    if (input.reason?.trim()) po.notes = `${po.notes ? po.notes + " · " : ""}Cancelled: ${input.reason.trim()}`;
    logActivity(d, ctx, { kind: "purchase", tone: "danger", message: `Cancelled ${po.poNumber}${input.reason ? " — " + input.reason : ""}`, reference: po.poNumber });
    return po as PurchaseOrder;
  });
}

export interface ReceiveLineInput {
  lineId: string;
  /** Packs received now. */
  qty: number;
  batchNo: string;
  expiryDate: string;
}

/**
 * Posts received goods: creates (or tops up) a batch per line with its expiry, records
 * stock movements and advances the PO to partially received / received.
 */
export function receivePurchaseOrder(db: DemoDatabase, ctx: CommandContext, input: { id: string; lines: ReceiveLineInput[] }) {
  if (!hasPermission(ctx.user.role, "po.receive")) throw new DomainError("Your role cannot receive stock.");
  const po = db.purchaseOrders.find((p) => p.id === input.id);
  if (!po) throw new DomainError("Purchase order not found.");
  if (po.status !== "ordered" && po.status !== "partially_received") throw new DomainError("Only sent orders can be received.");
  const today = todayKey();
  const rows = input.lines.filter((l) => l.qty > 0);
  if (!rows.length) throw new DomainError("Enter the quantity received for at least one line.");
  for (const r of rows) {
    const line = po.lines.find((l) => l.id === r.lineId);
    if (!line) throw new DomainError("Order line not found.");
    if (!Number.isInteger(r.qty)) throw new DomainError("Received quantities must be whole packs.");
    const remaining = line.qty - line.receivedQty;
    if (r.qty > remaining) throw new DomainError(`${line.name}: only ${remaining} pack(s) outstanding.`);
    if (!r.batchNo.trim()) throw new DomainError(`${line.name}: batch number is required.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.expiryDate)) throw new DomainError(`${line.name}: expiry date is required.`);
    if (r.expiryDate <= today) throw new DomainError(`${line.name}: expiry date must be in the future — expired goods cannot be received as saleable.`);
    const existingBatch = db.batches.find((x) => x.medicineId === line.medicineId && x.batchNo === r.batchNo.trim().toUpperCase());
    if (existingBatch && existingBatch.expiryDate !== r.expiryDate) {
      throw new DomainError(`${line.name}: batch ${existingBatch.batchNo} already exists with a different expiry (${existingBatch.expiryDate}).`);
    }
    if (existingBatch && existingBatch.status !== "saleable") throw new DomainError(`${line.name}: batch ${existingBatch.batchNo} is quarantined — use a new batch number.`);
  }

  return mutate(db, (d) => {
    const p = d.purchaseOrders.find((x) => x.id === po.id)!;
    const receipt = { id: uid("rcv"), receivedAt: ctx.now.toISOString(), receivedById: ctx.user.id, receivedByName: ctx.user.name, lines: [] as PurchaseOrder["receipts"][number]["lines"] };
    for (const r of rows) {
      const line = p.lines.find((l) => l.id === r.lineId)!;
      const m = d.medicines.find((x) => x.id === line.medicineId)!;
      const units = r.qty * line.packSize;
      const batchNo = r.batchNo.trim().toUpperCase();
      let b: Batch | undefined = d.batches.find((x) => x.medicineId === m.id && x.batchNo === batchNo);
      if (b) {
        b.quantity += units;
        b.initialQty += units;
      } else {
        b = {
          id: uid("bat"),
          medicineId: m.id,
          batchNo,
          expiryDate: r.expiryDate,
          receivedDate: today,
          supplierId: p.supplierId,
          initialQty: units,
          quantity: units,
          unitCost: round2(line.unitCost / line.packSize),
          location: m.location,
          status: "saleable",
          purchaseOrderId: p.id,
        };
        d.batches.push(b);
      }
      line.receivedQty += r.qty;
      receipt.lines.push({ lineId: line.id, qty: r.qty, batchNo, expiryDate: r.expiryDate, batchId: b.id });
      addMovement(d, ctx, { medicineId: m.id, batchId: b.id, batchNo, type: "po_receipt", qty: units, reference: p.poNumber, reason: "Purchase order received" });
    }
    p.receipts.push(receipt);
    const complete = p.lines.every((l) => l.receivedQty >= l.qty);
    p.status = complete ? "received" : "partially_received";
    if (complete) p.receivedAt = ctx.now.toISOString();
    const units = receipt.lines.reduce((s, l) => s + l.qty * (p.lines.find((x) => x.id === l.lineId)?.packSize ?? 1), 0);
    logActivity(d, ctx, {
      kind: "purchase",
      tone: "success",
      message: `Received ${p.poNumber} · ${units.toLocaleString()} units across ${receipt.lines.length} SKU${receipt.lines.length === 1 ? "" : "s"}${complete ? " · order complete" : " · partial"}`,
      reference: p.poNumber,
    });
    return p as PurchaseOrder;
  });
}
