import type { Batch, DemoDatabase, DosageForm, Medicine } from "@/lib/types";
import { DomainError, addMovement, logActivity, mutate, saleableUnits, verifyPin, type CommandContext } from "./context";
import { isBatchExpired, medicineName } from "./stock";
import { demoBarcode, packagingFor, unitForForm } from "@/lib/mock-data/medicines";
import { peso, round2, todayKey } from "@/lib/utils/format";
import { uid } from "@/lib/utils/id";
import { hasPermission } from "@/lib/auth/permissions";

export type MedicineInput = Pick<
  Medicine,
  | "brandName"
  | "genericName"
  | "categoryId"
  | "dosageForm"
  | "strength"
  | "costPrice"
  | "sellingPrice"
  | "minStock"
  | "reorderQty"
  | "supplierId"
  | "manufacturer"
  | "rxRequired"
  | "packSize"
  | "location"
> &
  Partial<Pick<Medicine, "sku" | "barcode" | "packaging" | "unit" | "stripSize">> & {
    /** Data URL of an uploaded photo; "" removes an existing one. */
    imageDataUrl?: string;
  };

const MAX_IMAGE_CHARS = 600_000;

export interface OpeningBatchInput {
  batchNo: string;
  expiryDate: string;
  quantity: number;
}

function validateMedicine(db: DemoDatabase, input: MedicineInput, selfId?: string) {
  if (!input.genericName.trim()) throw new DomainError("Generic name is required.");
  if (!input.brandName.trim()) throw new DomainError('Brand name is required (use "Generic" for unbranded).');
  if (!input.strength.trim()) throw new DomainError("Strength is required.");
  if (!db.categories.some((c) => c.id === input.categoryId)) throw new DomainError("Choose a category.");
  if (!db.suppliers.some((s) => s.id === input.supplierId)) throw new DomainError("Choose a supplier.");
  if (!(input.sellingPrice > 0)) throw new DomainError("Selling price must be greater than zero.");
  if (input.costPrice < 0) throw new DomainError("Cost cannot be negative.");
  if (input.minStock < 0 || input.reorderQty < 0) throw new DomainError("Reorder values cannot be negative.");
  if (!(input.packSize >= 1)) throw new DomainError("Pack size must be at least 1.");
  if (input.imageDataUrl) {
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(input.imageDataUrl)) throw new DomainError("The photo must be a JPEG, PNG or WebP image.");
    if (input.imageDataUrl.length > MAX_IMAGE_CHARS) throw new DomainError("The photo is too large — use an image under about 400 KB.");
  }
  if (input.sku && db.medicines.some((m) => m.sku.toLowerCase() === input.sku!.toLowerCase() && m.id !== selfId)) {
    throw new DomainError(`SKU ${input.sku} is already used.`);
  }
  if (input.barcode && db.medicines.some((m) => m.barcode === input.barcode && m.id !== selfId)) {
    throw new DomainError(`Barcode ${input.barcode} is already used.`);
  }
}

export function addMedicine(db: DemoDatabase, ctx: CommandContext, input: { medicine: MedicineInput; openingBatch?: OpeningBatchInput }) {
  if (!hasPermission(ctx.user.role, "inventory.edit")) throw new DomainError("Your role cannot add medicines.");
  validateMedicine(db, input.medicine);
  const ob = input.openingBatch;
  if (ob && ob.quantity > 0) {
    if (!ob.batchNo.trim()) throw new DomainError("Opening batch number is required.");
    if (!ob.expiryDate || isBatchExpired({ expiryDate: ob.expiryDate })) throw new DomainError("Opening batch expiry must be in the future.");
  }
  return mutate(db, (d) => {
    const seqNo = Math.max(...d.medicines.map((m) => Number(m.sku.replace(/\D/g, "")) || 0), 1000) + 1;
    const nowIso = ctx.now.toISOString();
    const mi = input.medicine;
    const form = mi.dosageForm as DosageForm;
    const med: Medicine = {
      id: uid("med"),
      sku: mi.sku?.trim() || `YM-${seqNo}`,
      barcode: mi.barcode?.trim() || demoBarcode(seqNo - 1000),
      brandName: mi.brandName.trim(),
      genericName: mi.genericName.trim(),
      categoryId: mi.categoryId,
      dosageForm: form,
      strength: mi.strength.trim(),
      packaging: mi.packaging?.trim() || packagingFor(form, mi.packSize, mi.stripSize ?? 0),
      unit: mi.unit || unitForForm(form),
      packSize: mi.packSize,
      stripSize: mi.stripSize || undefined,
      costPrice: round2(mi.costPrice),
      sellingPrice: round2(mi.sellingPrice),
      minStock: Math.round(mi.minStock),
      reorderQty: Math.round(mi.reorderQty),
      supplierId: mi.supplierId,
      manufacturer: mi.manufacturer.trim(),
      rxRequired: mi.rxRequired,
      status: "active",
      location: mi.location.trim() || "Unassigned",
      imageDataUrl: mi.imageDataUrl || undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    d.medicines.push(med);
    if (ob && ob.quantity > 0) {
      const b: Batch = {
        id: uid("bat"),
        medicineId: med.id,
        batchNo: ob.batchNo.trim().toUpperCase(),
        expiryDate: ob.expiryDate,
        receivedDate: todayKey(),
        supplierId: med.supplierId,
        initialQty: Math.round(ob.quantity),
        quantity: Math.round(ob.quantity),
        unitCost: med.costPrice,
        location: med.location,
        status: "saleable",
      };
      d.batches.push(b);
      addMovement(d, ctx, { medicineId: med.id, batchId: b.id, batchNo: b.batchNo, type: "stock_in", qty: b.quantity, reason: "Opening stock" });
    }
    logActivity(d, ctx, { kind: "inventory", tone: "success", message: `Added medicine ${medicineName(med)} (${med.sku})` });
    return med as Medicine;
  });
}

export function updateMedicine(db: DemoDatabase, ctx: CommandContext, input: { id: string; changes: Partial<MedicineInput> }) {
  if (!hasPermission(ctx.user.role, "inventory.edit")) throw new DomainError("Your role cannot edit medicines.");
  const m = db.medicines.find((x) => x.id === input.id);
  if (!m) throw new DomainError("Medicine not found.");
  const priceChanged =
    (input.changes.sellingPrice !== undefined && round2(input.changes.sellingPrice) !== m.sellingPrice) ||
    (input.changes.costPrice !== undefined && round2(input.changes.costPrice) !== m.costPrice);
  if (priceChanged && !hasPermission(ctx.user.role, "inventory.price")) {
    throw new DomainError("Only an Administrator or Manager can change prices.");
  }
  const merged = { ...m, ...input.changes } as MedicineInput;
  validateMedicine(db, merged, m.id);
  return mutate(db, (d) => {
    const med = d.medicines.find((x) => x.id === m.id)!;
    const before = { price: med.sellingPrice, min: med.minStock };
    const c = input.changes;
    Object.assign(med, {
      ...c,
      ...(c.costPrice !== undefined ? { costPrice: round2(c.costPrice) } : {}),
      ...(c.sellingPrice !== undefined ? { sellingPrice: round2(c.sellingPrice) } : {}),
      ...(c.dosageForm && !c.unit ? { unit: unitForForm(c.dosageForm) } : {}),
      updatedAt: ctx.now.toISOString(),
    });
    if (c.imageDataUrl === "") delete med.imageDataUrl;
    const parts: string[] = [];
    if (c.sellingPrice !== undefined && before.price !== med.sellingPrice) parts.push(`price ${peso(before.price)} → ${peso(med.sellingPrice)}`);
    if (c.minStock !== undefined && before.min !== med.minStock) parts.push(`reorder level ${before.min} → ${med.minStock}`);
    if (c.imageDataUrl !== undefined && c.imageDataUrl !== m.imageDataUrl) parts.push(c.imageDataUrl ? "photo uploaded" : "photo removed");
    logActivity(d, ctx, {
      kind: "inventory",
      tone: "info",
      message: `Updated ${medicineName(med)}${parts.length ? " · " + parts.join(", ") : ""}`,
    });
    return med as Medicine;
  });
}

export function setMedicineStatus(db: DemoDatabase, ctx: CommandContext, input: { id: string; status: Medicine["status"] }) {
  if (!hasPermission(ctx.user.role, "inventory.edit")) throw new DomainError("Your role cannot archive medicines.");
  return mutate(db, (d) => {
    const med = d.medicines.find((x) => x.id === input.id);
    if (!med) throw new DomainError("Medicine not found.");
    med.status = input.status;
    med.updatedAt = ctx.now.toISOString();
    logActivity(d, ctx, {
      kind: "inventory",
      tone: input.status === "inactive" ? "warning" : "success",
      message: `${input.status === "inactive" ? "Archived" : "Restored"} ${medicineName(med)} (${med.sku})`,
    });
    return med as Medicine;
  });
}

export type AdjustmentType = "stock_in" | "stock_out" | "adjustment" | "write_off" | "quarantine" | "release";

export const ADJUSTMENT_LABELS: Record<AdjustmentType, string> = {
  stock_in: "Stock in (new batch)",
  stock_out: "Stock out",
  adjustment: "Count adjustment (set quantity)",
  write_off: "Write off (expired / damaged)",
  quarantine: "Quarantine batch",
  release: "Release from quarantine",
};

export interface AdjustStockInput {
  medicineId: string;
  type: AdjustmentType;
  /** Existing batch (required for everything except stock_in with a new batch). */
  batchId?: string;
  /** Units: added/removed, or the new counted quantity for `adjustment`. */
  quantity: number;
  reason: string;
  /** Authorizing user + demo PIN. */
  authorizedById: string;
  pin: string;
  newBatch?: { batchNo: string; expiryDate: string; unitCost?: number; location?: string };
}

export function adjustStock(db: DemoDatabase, ctx: CommandContext, input: AdjustStockInput) {
  if (!hasPermission(ctx.user.role, "stock.adjust")) throw new DomainError("Your role cannot adjust stock.");
  const approver = verifyPin(db, input.authorizedById, input.pin);
  if (!hasPermission(approver.role, "stock.approve") && !(approver.role === "pharmacist" && ["quarantine", "release"].includes(input.type))) {
    throw new DomainError(`${approver.name} cannot authorize stock adjustments. Choose an Administrator or Manager.`);
  }
  const m = db.medicines.find((x) => x.id === input.medicineId);
  if (!m) throw new DomainError("Choose a medicine.");
  if (!input.reason.trim()) throw new DomainError("A reason is required.");
  const qty = Math.round(input.quantity);
  if (!Number.isFinite(qty) || qty < 0) throw new DomainError("Quantity must be zero or more.");
  const today = todayKey();
  const batch = input.batchId ? db.batches.find((b) => b.id === input.batchId && b.medicineId === m.id) : undefined;

  if (input.type === "stock_in") {
    if (qty <= 0) throw new DomainError("Enter the quantity received.");
    if (!batch) {
      const nb = input.newBatch;
      if (!nb?.batchNo.trim()) throw new DomainError("Enter a batch number for the new stock.");
      if (!nb.expiryDate || nb.expiryDate <= today) throw new DomainError("Expiry date must be in the future.");
      if (db.batches.some((b) => b.medicineId === m.id && b.batchNo.toUpperCase() === nb.batchNo.trim().toUpperCase())) {
        throw new DomainError("That batch number already exists — select it instead.");
      }
    } else if (isBatchExpired(batch, today)) throw new DomainError("Cannot add stock to an expired batch.");
  } else {
    if (!batch) throw new DomainError("Choose a batch.");
    if (input.type === "stock_out" || input.type === "write_off") {
      if (qty <= 0) throw new DomainError("Enter a quantity to remove.");
      if (qty > batch.quantity) throw new DomainError(`Batch ${batch.batchNo} only has ${batch.quantity} ${m.unit}. Stock cannot go negative.`);
    }
    if (input.type === "quarantine" && batch.status !== "saleable") throw new DomainError("Batch is already blocked.");
    if (input.type === "release") {
      if (batch.status === "saleable") throw new DomainError("Batch is not quarantined.");
      if (isBatchExpired(batch, today)) throw new DomainError("Expired batches cannot be released for sale.");
    }
  }

  return mutate(db, (d) => {
    const auth = { authorizedById: approver.id, authorizedByName: approver.name };
    let message = "";
    let target: Batch | undefined = batch ? d.batches.find((b) => b.id === batch.id) : undefined;
    switch (input.type) {
      case "stock_in": {
        if (!target) {
          const nb = input.newBatch!;
          target = {
            id: uid("bat"),
            medicineId: m.id,
            batchNo: nb.batchNo.trim().toUpperCase(),
            expiryDate: nb.expiryDate,
            receivedDate: today,
            supplierId: m.supplierId,
            initialQty: qty,
            quantity: qty,
            unitCost: round2(nb.unitCost ?? m.costPrice),
            location: nb.location?.trim() || m.location,
            status: "saleable",
          };
          d.batches.push(target);
        } else {
          target.quantity += qty;
          target.initialQty += qty;
        }
        addMovement(d, ctx, { medicineId: m.id, batchId: target.id, batchNo: target.batchNo, type: "stock_in", qty, reason: input.reason.trim(), ...auth });
        message = `Stock in ${medicineName(m)} +${qty} ${m.unit} · batch ${target.batchNo}`;
        break;
      }
      case "stock_out":
      case "write_off": {
        target!.quantity -= qty;
        if (input.type === "write_off" && target!.quantity === 0 && target!.status !== "saleable") target!.status = "written_off";
        addMovement(d, ctx, { medicineId: m.id, batchId: target!.id, batchNo: target!.batchNo, type: input.type, qty: -qty, reason: input.reason.trim(), ...auth });
        message = `${input.type === "write_off" ? "Wrote off" : "Stock out"} ${medicineName(m)} −${qty} ${m.unit} · batch ${target!.batchNo}`;
        break;
      }
      case "adjustment": {
        const delta = qty - target!.quantity;
        target!.quantity = qty;
        addMovement(d, ctx, { medicineId: m.id, batchId: target!.id, batchNo: target!.batchNo, type: "adjustment", qty: delta, reason: input.reason.trim(), ...auth });
        message = `Count adjustment ${medicineName(m)} batch ${target!.batchNo}: ${delta >= 0 ? "+" : "−"}${Math.abs(delta)} ${m.unit}`;
        break;
      }
      case "quarantine": {
        target!.status = "quarantined";
        addMovement(d, ctx, { medicineId: m.id, batchId: target!.id, batchNo: target!.batchNo, type: "quarantine", qty: -target!.quantity, reason: input.reason.trim(), ...auth });
        message = `Quarantined batch ${target!.batchNo} (${medicineName(m)}) — ${target!.quantity} ${m.unit} blocked from sale`;
        break;
      }
      case "release": {
        target!.status = "saleable";
        addMovement(d, ctx, { medicineId: m.id, batchId: target!.id, batchNo: target!.batchNo, type: "release", qty: target!.quantity, reason: input.reason.trim(), ...auth });
        message = `Released batch ${target!.batchNo} (${medicineName(m)}) back to saleable stock`;
        break;
      }
    }
    logActivity(d, ctx, {
      kind: "inventory",
      tone: input.type === "stock_in" || input.type === "release" ? "success" : input.type === "adjustment" ? "info" : "warning",
      message: `${message} · authorized by ${approver.name}`,
    });
    return { batchId: target?.id, saleable: saleableUnits(d, m.id) };
  });
}

export interface ImportRow {
  sku?: string;
  barcode?: string;
  brandName: string;
  genericName: string;
  category: string;
  dosageForm: string;
  strength: string;
  sellingPrice: number;
  costPrice: number;
  minStock: number;
  rxRequired: boolean;
  supplier?: string;
}

/** Imports or updates medicines by SKU from parsed CSV rows. Returns counts. */
export function importMedicines(db: DemoDatabase, ctx: CommandContext, input: { rows: ImportRow[] }) {
  if (!hasPermission(ctx.user.role, "inventory.edit")) throw new DomainError("Your role cannot import medicines.");
  if (!input.rows.length) throw new DomainError("The file has no data rows.");
  const forms: DosageForm[] = ["Tablet", "Capsule", "Softgel", "Syrup", "Suspension", "Drops", "Sachet", "Inhaler", "Nebule", "Solution", "Ointment", "Cream", "Lozenge", "Spray", "Device"];
  return mutate(db, (d) => {
    let created = 0;
    let updated = 0;
    const errors: string[] = [];
    let seqNo = Math.max(...d.medicines.map((m) => Number(m.sku.replace(/\D/g, "")) || 0), 1000);
    input.rows.forEach((r, i) => {
      const rowNo = i + 2;
      const cat = d.categories.find((c) => c.name.toLowerCase() === r.category.trim().toLowerCase());
      const form = forms.find((f) => f.toLowerCase() === r.dosageForm.trim().toLowerCase());
      const sup = d.suppliers.find((s) => s.name.toLowerCase() === (r.supplier ?? "").trim().toLowerCase()) ?? d.suppliers[0];
      if (!r.genericName?.trim() || !r.brandName?.trim()) return void errors.push(`Row ${rowNo}: brand and generic name are required.`);
      if (!cat) return void errors.push(`Row ${rowNo}: unknown category "${r.category}".`);
      if (!form) return void errors.push(`Row ${rowNo}: unknown dosage form "${r.dosageForm}".`);
      if (!(r.sellingPrice > 0)) return void errors.push(`Row ${rowNo}: selling price must be greater than zero.`);
      const existing = r.sku ? d.medicines.find((m) => m.sku.toLowerCase() === r.sku!.trim().toLowerCase()) : undefined;
      if (existing) {
        Object.assign(existing, {
          brandName: r.brandName.trim(),
          genericName: r.genericName.trim(),
          categoryId: cat.id,
          dosageForm: form,
          strength: r.strength.trim(),
          sellingPrice: round2(r.sellingPrice),
          costPrice: round2(r.costPrice || existing.costPrice),
          minStock: Math.round(r.minStock || existing.minStock),
          rxRequired: r.rxRequired,
          updatedAt: ctx.now.toISOString(),
        });
        updated++;
      } else {
        seqNo++;
        const nowIso = ctx.now.toISOString();
        d.medicines.push({
          id: uid("med"),
          sku: r.sku?.trim() || `YM-${seqNo}`,
          barcode: r.barcode?.trim() || demoBarcode(seqNo - 1000),
          brandName: r.brandName.trim(),
          genericName: r.genericName.trim(),
          categoryId: cat.id,
          dosageForm: form,
          strength: r.strength.trim(),
          packaging: packagingFor(form, 100, form === "Tablet" || form === "Capsule" ? 10 : 0),
          unit: unitForForm(form),
          packSize: 100,
          stripSize: form === "Tablet" || form === "Capsule" ? 10 : undefined,
          costPrice: round2(r.costPrice || r.sellingPrice * 0.72),
          sellingPrice: round2(r.sellingPrice),
          minStock: Math.round(r.minStock || 20),
          reorderQty: Math.round((r.minStock || 20) * 2),
          supplierId: sup.id,
          manufacturer: "Imported",
          rxRequired: r.rxRequired,
          status: "active",
          location: "Unassigned",
          createdAt: nowIso,
          updatedAt: nowIso,
        });
        created++;
      }
    });
    if (created || updated) {
      logActivity(d, ctx, { kind: "inventory", tone: "success", message: `CSV import · ${created} added, ${updated} updated${errors.length ? `, ${errors.length} skipped` : ""}` });
    }
    return { created, updated, errors };
  });
}

/** Units on hand that are blocked (expired/quarantined/recalled) for a batch list. */
export function blockedUnits(batches: Batch[], today = todayKey()): number {
  return batches.filter((b) => b.quantity > 0 && (b.status !== "saleable" || isBatchExpired(b, today))).reduce((s, b) => s + b.quantity, 0);
}
