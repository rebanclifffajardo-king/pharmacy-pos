"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { Supplier } from "@/lib/types";
import { actions } from "@/lib/store/actions";
import type { SupplierInput } from "@/lib/services/admin-service";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, NativeSelect, TextArea, TextInput } from "@/components/shared/field";

const TERMS = ["COD", "Net 7", "Net 15", "Net 30", "Net 45", "Net 60"];

export function SupplierFormDialog({
  open,
  onOpenChange,
  supplier,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  supplier?: Supplier | null;
  onSaved?: (s: Supplier) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto rounded-2xl p-0 sm:max-w-[640px]">
        {open && (
          <SupplierForm
            key={supplier?.id ?? "new"}
            supplier={supplier}
            onCancel={() => onOpenChange(false)}
            onDone={(s) => {
              onSaved?.(s);
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SupplierForm({ supplier, onCancel, onDone }: { supplier?: Supplier | null; onCancel: () => void; onDone: (s: Supplier) => void }) {
  const [form, setForm] = useState<SupplierInput>(() => ({
    code: supplier?.code ?? "",
    name: supplier?.name ?? "",
    contactPerson: supplier?.contactPerson ?? "",
    phone: supplier?.phone ?? "",
    email: supplier?.email ?? "",
    address: supplier?.address ?? "",
    city: supplier?.city ?? "",
    tin: supplier?.tin ?? "",
    paymentTerms: supplier?.paymentTerms ?? "Net 30",
    leadTimeDays: supplier?.leadTimeDays ?? 3,
    notes: supplier?.notes ?? "",
  }));
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof SupplierInput>(k: K, v: SupplierInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = actions.saveSupplier({ id: supplier?.id, supplier: { ...form, tin: form.tin?.trim() || undefined, notes: form.notes?.trim() || undefined } });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.success(supplier ? `Updated ${res.data.name}` : `Added supplier ${res.data.name}`);
    onDone(res.data);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 p-6">
      <div className="flex flex-col gap-1 pr-8">
        <DialogTitle className="font-heading text-xl font-semibold">{supplier ? `Edit ${supplier.name}` : "Add supplier"}</DialogTitle>
        <DialogDescription className="text-[13px] text-ink-500">Distributor details used on purchase orders. Demo records are fictional.</DialogDescription>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
        <Field label="Supplier name">
          <TextInput required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Luzon MedSupply Co." autoFocus />
        </Field>
        <Field label="Code" hint="Auto from name if blank">
          <TextInput value={form.code} maxLength={4} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="LM" />
        </Field>
        <Field label="Contact person">
          <TextInput required value={form.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} />
        </Field>
        <Field label="Phone">
          <TextInput value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(02) 8000-0000" />
        </Field>
        <Field label="E-mail" className="sm:col-span-2">
          <TextInput type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="orders@supplier.example" />
        </Field>
        <Field label="Address">
          <TextInput value={form.address} onChange={(e) => set("address", e.target.value)} />
        </Field>
        <Field label="City">
          <TextInput value={form.city} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label="TIN">
          <TextInput value={form.tin ?? ""} onChange={(e) => set("tin", e.target.value)} placeholder="000-000-000-000" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Payment terms">
            <NativeSelect value={form.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)}>
              {[...new Set([...TERMS, form.paymentTerms])].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Lead time (days)">
            <TextInput type="number" min={0} value={form.leadTimeDays} onChange={(e) => set("leadTimeDays", Number(e.target.value))} />
          </Field>
        </div>
        <Field label="Notes" className="sm:col-span-2">
          <TextArea rows={2} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} placeholder="Delivery days, product lines, account notes…" />
        </Field>
      </div>
      {error && <span className="rounded-xl bg-danger-bg px-3 py-2 text-[13px] font-medium text-danger">{error}</span>}
      <div className="-mx-6 -mb-6 flex justify-end gap-2 border-t border-line bg-surface-2 px-6 py-4">
        <Button type="button" variant="outline" size="md" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="brand" size="md">
          {supplier ? "Save changes" : "Add supplier"}
        </Button>
      </div>
    </form>
  );
}
