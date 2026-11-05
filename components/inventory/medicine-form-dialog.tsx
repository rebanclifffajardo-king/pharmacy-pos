"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { DosageForm, Medicine } from "@/lib/types";
import { useDb } from "@/lib/store/app-store";
import { actions } from "@/lib/store/actions";
import { useCan } from "@/hooks/use-session";
import { useToday } from "@/hooks/use-today";
import type { MedicineInput } from "@/lib/services/inventory-service";
import { medicineName } from "@/lib/services/stock";
import { packagingFor, unitForForm } from "@/lib/mock-data/medicines";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, MoneyInput, NativeSelect, TextInput } from "@/components/shared/field";
import { Button } from "@/components/ui/button";
import { round2 } from "@/lib/utils/format";

export const DOSAGE_FORMS: DosageForm[] = ["Tablet", "Capsule", "Softgel", "Syrup", "Suspension", "Drops", "Sachet", "Inhaler", "Nebule", "Solution", "Ointment", "Cream", "Lozenge", "Spray", "Device"];

type FormState = {
  brandName: string;
  genericName: string;
  categoryId: string;
  dosageForm: DosageForm;
  strength: string;
  packaging: string;
  packSize: string;
  stripSize: string;
  costPrice: string;
  sellingPrice: string;
  minStock: string;
  reorderQty: string;
  supplierId: string;
  manufacturer: string;
  rxRequired: boolean;
  location: string;
  sku: string;
  barcode: string;
  batchNo: string;
  batchExpiry: string;
  batchQty: string;
};

function initialState(m: Medicine | undefined, db: ReturnType<typeof useDb>): FormState {
  return {
    brandName: m?.brandName ?? "",
    genericName: m?.genericName ?? "",
    categoryId: m?.categoryId ?? db.categories[0]?.id ?? "",
    dosageForm: m?.dosageForm ?? "Tablet",
    strength: m?.strength ?? "",
    packaging: m?.packaging ?? "",
    packSize: String(m?.packSize ?? 100),
    stripSize: m?.stripSize ? String(m.stripSize) : m ? "" : "10",
    costPrice: m ? m.costPrice.toFixed(2) : "",
    sellingPrice: m ? m.sellingPrice.toFixed(2) : "",
    minStock: String(m?.minStock ?? 50),
    reorderQty: String(m?.reorderQty ?? 100),
    supplierId: m?.supplierId ?? db.suppliers.find((s) => s.status === "active")?.id ?? "",
    manufacturer: m?.manufacturer ?? "",
    rxRequired: m?.rxRequired ?? false,
    location: m?.location ?? "",
    sku: m?.sku ?? "",
    barcode: m?.barcode ?? "",
    batchNo: "",
    batchExpiry: "",
    batchQty: "",
  };
}

const num = (s: string) => (s.trim() === "" ? NaN : Number(s));

/** Add / edit a medicine record with every catalog field, plus an optional opening batch on add. */
export function MedicineFormDialog({ open, onOpenChange, medicine, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; medicine?: Medicine; onSaved?: (m: Medicine) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto rounded-2xl p-6 sm:max-w-[760px]">
        <div className="flex flex-col gap-1 pr-8">
          <DialogTitle className="font-heading text-xl font-semibold">{medicine ? `Edit ${medicineName(medicine)}` : "Add medicine"}</DialogTitle>
          <DialogDescription className="text-[13px] text-ink-500">
            {medicine ? `${medicine.sku} · changes are written to the activity log.` : "SKU and barcode are generated when left blank. Sample prices are fictional demo values."}
          </DialogDescription>
        </div>
        {open && <MedicineForm key={medicine?.id ?? "new"} medicine={medicine} onCancel={() => onOpenChange(false)} onSaved={(m) => { onSaved?.(m); onOpenChange(false); }} />}
      </DialogContent>
    </Dialog>
  );
}

function MedicineForm({ medicine, onCancel, onSaved }: { medicine?: Medicine; onCancel: () => void; onSaved: (m: Medicine) => void }) {
  const db = useDb();
  const today = useToday();
  const canPrice = useCan("inventory.price");
  const isEdit = !!medicine;
  const [f, setF] = useState<FormState>(() => initialState(medicine, db));
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));
  const priceLocked = isEdit && !canPrice;
  const price = num(f.sellingPrice);
  const cost = num(f.costPrice);
  const margin = price > 0 && cost >= 0 ? (1 - cost / price) * 100 : null;

  const submit = () => {
    const packSize = Math.round(num(f.packSize));
    const strip = f.stripSize.trim() ? Math.round(num(f.stripSize)) : 0;
    if (!Number.isFinite(packSize) || packSize < 1) return void toast.error("Pack size must be at least 1.");
    if (strip && (strip < 1 || packSize % strip !== 0)) return void toast.error("Strip size must divide the pack size evenly.");
    if (!Number.isFinite(price)) return void toast.error("Enter a selling price.");
    if (!Number.isFinite(cost)) return void toast.error("Enter a cost price.");
    const input: MedicineInput = {
      brandName: f.brandName.trim() || "Generic",
      genericName: f.genericName,
      categoryId: f.categoryId,
      dosageForm: f.dosageForm,
      strength: f.strength,
      costPrice: round2(cost),
      sellingPrice: round2(price),
      minStock: Math.round(num(f.minStock) || 0),
      reorderQty: Math.round(num(f.reorderQty) || 0),
      supplierId: f.supplierId,
      manufacturer: f.manufacturer,
      rxRequired: f.rxRequired,
      packSize,
      stripSize: strip || undefined,
      location: f.location,
      packaging: f.packaging.trim() || packagingFor(f.dosageForm, packSize, strip),
      unit: unitForForm(f.dosageForm),
      sku: f.sku.trim() || undefined,
      barcode: f.barcode.trim() || undefined,
    };
    if (isEdit) {
      const res = actions.updateMedicine({ id: medicine.id, changes: input });
      if (!res.ok) return void toast.error("Not saved", { description: res.error });
      toast.success("Medicine updated", { description: medicineName(res.data) });
      onSaved(res.data);
    } else {
      const qty = num(f.batchQty);
      const opening = Number.isFinite(qty) && qty > 0 ? { batchNo: f.batchNo, expiryDate: f.batchExpiry, quantity: Math.round(qty) } : undefined;
      const res = actions.addMedicine({ medicine: input, openingBatch: opening });
      if (!res.ok) return void toast.error("Not added", { description: res.error });
      toast.success("Medicine added", { description: `${medicineName(res.data)} · ${res.data.sku}${opening ? ` · ${opening.quantity} ${res.data.unit} opening stock` : ""}` });
      onSaved(res.data);
    }
  };

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <legend className="label-caps mb-2">Product</legend>
        <Field label="Generic name *">
          <TextInput value={f.genericName} onChange={(e) => set("genericName", e.target.value)} placeholder="e.g. Paracetamol" required />
        </Field>
        <Field label="Brand name" hint='Leave blank or type "Generic" for unbranded'>
          <TextInput value={f.brandName} onChange={(e) => set("brandName", e.target.value)} placeholder="e.g. Biogesic" />
        </Field>
        <Field label="Category *">
          <NativeSelect value={f.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
            {db.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dosage form *">
            <NativeSelect value={f.dosageForm} onChange={(e) => set("dosageForm", e.target.value as DosageForm)}>
              {DOSAGE_FORMS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Strength *">
            <TextInput value={f.strength} onChange={(e) => set("strength", e.target.value)} placeholder="500 mg" />
          </Field>
        </div>
        <Field label="Manufacturer">
          <TextInput value={f.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} placeholder="e.g. Unilab" />
        </Field>
        <Field label="Prescription">
          <label className="flex h-11 items-center gap-2.5 rounded-xl border border-line-strong bg-surface px-3 text-sm font-medium">
            <input type="checkbox" checked={f.rxRequired} onChange={(e) => set("rxRequired", e.target.checked)} className="size-[18px] accent-[var(--brand)]" />
            Rx required — pharmacist verifies at POS
          </label>
        </Field>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <legend className="label-caps mb-2">Packaging & identifiers</legend>
        <Field label="Pack size (units/box)">
          <TextInput inputMode="numeric" value={f.packSize} onChange={(e) => set("packSize", e.target.value.replace(/\D/g, ""))} />
        </Field>
        <Field label="Strip size" hint="Blank if not sold by strip">
          <TextInput inputMode="numeric" value={f.stripSize} onChange={(e) => set("stripSize", e.target.value.replace(/\D/g, ""))} />
        </Field>
        <Field label="Packaging" className="sm:col-span-2" hint={`Selling unit: ${unitForForm(f.dosageForm)}`}>
          <TextInput value={f.packaging} onChange={(e) => set("packaging", e.target.value)} placeholder={packagingFor(f.dosageForm, Number(f.packSize) || 1, Number(f.stripSize) || 0)} />
        </Field>
        <Field label="SKU" className="sm:col-span-2">
          <TextInput value={f.sku} onChange={(e) => set("sku", e.target.value)} placeholder="Auto (YM-####)" className="font-mono" />
        </Field>
        <Field label="Barcode" className="sm:col-span-2">
          <TextInput value={f.barcode} onChange={(e) => set("barcode", e.target.value.replace(/\s/g, ""))} placeholder="Auto (demo EAN-13)" className="font-mono" />
        </Field>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <legend className="label-caps mb-2">Pricing & reorder</legend>
        <Field label="Cost / unit" hint={priceLocked ? "Admin or Manager only" : undefined}>
          <MoneyInput value={f.costPrice} disabled={priceLocked} onChange={(e) => set("costPrice", e.target.value.replace(/[^0-9.]/g, ""))} />
        </Field>
        <Field label="Selling price / unit" hint={margin !== null ? `Margin ${margin.toFixed(0)}%` : "VAT-inclusive ₱"}>
          <MoneyInput value={f.sellingPrice} disabled={priceLocked} onChange={(e) => set("sellingPrice", e.target.value.replace(/[^0-9.]/g, ""))} />
        </Field>
        <Field label="Reorder level" hint="Low stock at or below">
          <TextInput inputMode="numeric" value={f.minStock} onChange={(e) => set("minStock", e.target.value.replace(/\D/g, ""))} />
        </Field>
        <Field label="Reorder quantity" hint="Suggested PO units">
          <TextInput inputMode="numeric" value={f.reorderQty} onChange={(e) => set("reorderQty", e.target.value.replace(/\D/g, ""))} />
        </Field>
        <Field label="Supplier" className="sm:col-span-2">
          <NativeSelect value={f.supplierId} onChange={(e) => set("supplierId", e.target.value)}>
            {db.suppliers.map((s) => (
              <option key={s.id} value={s.id} disabled={s.status !== "active"}>
                {s.name}
                {s.status !== "active" ? " (inactive)" : ""}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Shelf location" className="sm:col-span-2">
          <TextInput value={f.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. Shelf A-3 / Rx B-2" />
        </Field>
      </fieldset>

      {!isEdit && (
        <fieldset className="grid grid-cols-1 gap-3 rounded-xl bg-canvas p-3 sm:grid-cols-3">
          <legend className="label-caps float-left mb-2 w-full">Opening batch (optional)</legend>
          <Field label="Batch no.">
            <TextInput value={f.batchNo} onChange={(e) => set("batchNo", e.target.value.toUpperCase())} placeholder="e.g. BG26-1105" />
          </Field>
          <Field label="Expiry date">
            <TextInput type="date" min={today} value={f.batchExpiry} onChange={(e) => set("batchExpiry", e.target.value)} />
          </Field>
          <Field label="Quantity (units)">
            <TextInput inputMode="numeric" value={f.batchQty} onChange={(e) => set("batchQty", e.target.value.replace(/\D/g, ""))} placeholder="0" />
          </Field>
        </fieldset>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" size="md" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="brand" size="md">
          {isEdit ? "Save changes" : "Add medicine"}
        </Button>
      </div>
    </form>
  );
}
