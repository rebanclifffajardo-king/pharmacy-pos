"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import type { Batch } from "@/lib/types";
import { useDb } from "@/lib/store/app-store";
import { actions } from "@/lib/store/actions";
import { useCurrentUser } from "@/hooks/use-session";
import { useStockIndex } from "@/hooks/use-inventory";
import { useToday } from "@/hooks/use-today";
import { hasPermission } from "@/lib/auth/permissions";
import { ADJUSTMENT_LABELS, type AdjustmentType, type AdjustStockInput } from "@/lib/services/inventory-service";
import { batchesFor, isBatchExpired, medicineName } from "@/lib/services/stock";
import { daysBetween, formatDate, peso, round2 } from "@/lib/utils/format";
import { Field, MoneyInput, NativeSelect, TextArea, TextInput } from "@/components/shared/field";
import { AuthorizeFields } from "@/components/shared/authorize-fields";
import { Button } from "@/components/ui/button";
import { batchStatusInfo, expiryTone } from "./batch-chips";
import { Chip } from "@/components/shared/chip";
import { cn } from "@/lib/utils";

export interface AdjustmentInitial {
  medicineId?: string;
  batchId?: string;
  type?: AdjustmentType;
  quantity?: number;
  reason?: string;
}

export const ADJUSTMENT_REASONS: Record<AdjustmentType, string[]> = {
  stock_in: ["Delivery without purchase order", "Transfer in from another branch", "Customer return — sealed & saleable", "Opening stock"],
  stock_out: ["Return to supplier", "Transfer out to another branch", "Sample / internal use"],
  adjustment: ["Physical count variance", "Encoding error correction"],
  write_off: ["Expired — dispose per DOH/FDA guidance", "Damaged / broken packaging", "Recalled by manufacturer"],
  quarantine: ["Expired — moved to quarantine", "Recall notice received", "Damaged — pending inspection", "Temperature excursion"],
  release: ["Inspection passed — saleable", "Recall lifted by manufacturer"],
};

const TYPES = Object.keys(ADJUSTMENT_LABELS) as AdjustmentType[];

function batchOptions(batches: Batch[], type: AdjustmentType, today: string): Batch[] {
  switch (type) {
    case "stock_in":
      return batches.filter((b) => b.status === "saleable" && !isBatchExpired(b, today));
    case "stock_out":
    case "write_off":
      return batches.filter((b) => b.quantity > 0 && b.status !== "written_off");
    case "adjustment":
      return batches.filter((b) => b.status !== "written_off");
    case "quarantine":
      return batches.filter((b) => b.status === "saleable" && b.quantity > 0);
    case "release":
      return batches.filter((b) => (b.status === "quarantined" || b.status === "recalled") && !isBatchExpired(b, today));
  }
}

/**
 * Stock adjustment form: medicine → batch (FEFO) → type → quantity → reason → authorized user + PIN.
 * Every successful submit writes a stock movement and an activity entry; nothing is deleted.
 */
export function StockAdjustmentForm({
  initial,
  onDone,
  onCancel,
  submitLabel = "Apply adjustment",
  className,
}: {
  initial?: AdjustmentInitial;
  onDone?: () => void;
  onCancel?: () => void;
  submitLabel?: string;
  className?: string;
}) {
  const db = useDb();
  const user = useCurrentUser();
  const index = useStockIndex();
  const today = useToday();

  const [medQuery, setMedQuery] = useState("");
  const [medicineId, setMedicineId] = useState(initial?.medicineId ?? "");
  const [type, setType] = useState<AdjustmentType>(initial?.type ?? "adjustment");
  const [batchId, setBatchId] = useState(initial?.batchId ?? "");
  const [quantity, setQuantity] = useState(initial?.quantity !== undefined ? String(initial.quantity) : "");
  const [reasonPreset, setReasonPreset] = useState(() => {
    const t = initial?.type ?? "adjustment";
    if (initial?.reason && ADJUSTMENT_REASONS[t].includes(initial.reason)) return initial.reason;
    return initial?.reason ? "__other" : ADJUSTMENT_REASONS[t][0];
  });
  const [notes, setNotes] = useState(initial?.reason && !ADJUSTMENT_REASONS[initial?.type ?? "adjustment"].includes(initial.reason) ? initial.reason : "");
  const [newBatchNo, setNewBatchNo] = useState("");
  const [newExpiry, setNewExpiry] = useState("");
  const [newCost, setNewCost] = useState("");
  const canSelfApprove = (t: AdjustmentType) => !!user && (hasPermission(user.role, "stock.approve") || (user.role === "pharmacist" && (t === "quarantine" || t === "release")));
  const [approverId, setApproverId] = useState(() => (canSelfApprove(initial?.type ?? "adjustment") && user ? user.id : ""));
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  const medicine = db.medicines.find((m) => m.id === medicineId);
  const medOptions = useMemo(() => {
    const q = medQuery.trim().toLowerCase();
    const list = db.medicines
      .filter((m) => !q || `${m.brandName} ${m.genericName} ${m.strength} ${m.sku} ${m.barcode}`.toLowerCase().includes(q))
      .sort((a, b) => medicineName(a).localeCompare(medicineName(b)));
    if (medicine && !list.includes(medicine)) list.unshift(medicine);
    return list;
  }, [db.medicines, medQuery, medicine]);

  const allBatches = useMemo(() => (medicineId ? batchesFor(db, medicineId) : []), [db, medicineId]);
  const options = useMemo(() => batchOptions(allBatches, type, today), [allBatches, type, today]);
  const effectiveBatchId = options.some((b) => b.id === batchId) ? batchId : type === "stock_in" ? (batchId === "new" || !options.length ? "new" : options[0].id) : (options[0]?.id ?? "");
  const batch = options.find((b) => b.id === effectiveBatchId);
  const wholeBatch = type === "quarantine" || type === "release";
  const qtyNum = wholeBatch ? (batch?.quantity ?? 0) : Number(quantity);
  const info = medicine ? index.get(medicine.id) : undefined;

  let preview: { from: number; to: number } | null = null;
  if (batch && Number.isFinite(qtyNum)) {
    if (type === "stock_in") preview = { from: batch.quantity, to: batch.quantity + qtyNum };
    else if (type === "stock_out" || type === "write_off") preview = { from: batch.quantity, to: batch.quantity - qtyNum };
    else if (type === "adjustment") preview = { from: batch.quantity, to: qtyNum };
  }
  const unitCost = batch?.unitCost ?? medicine?.costPrice ?? 0;
  const valueImpact = round2((type === "adjustment" && preview ? preview.to - preview.from : qtyNum || 0) * unitCost);

  const changeType = (t: AdjustmentType) => {
    setType(t);
    setReasonPreset(ADJUSTMENT_REASONS[t][0]);
    setBatchId("");
    if (!approverId && canSelfApprove(t) && user) setApproverId(user.id);
  };

  const submit = () => {
    if (!medicine) return void toast.error("Choose a medicine.");
    if (!effectiveBatchId) return void toast.error(type === "release" ? "No quarantined batch can be released." : "Choose a batch.");
    if (reasonPreset === "__other" && !notes.trim()) return void toast.error("Describe the reason.");
    if (!approverId) return void toast.error("Choose the authorizing user.");
    const reason = reasonPreset === "__other" ? notes.trim() : notes.trim() ? `${reasonPreset} — ${notes.trim()}` : reasonPreset;
    const input: AdjustStockInput = {
      medicineId: medicine.id,
      type,
      batchId: effectiveBatchId === "new" ? undefined : effectiveBatchId,
      quantity: wholeBatch ? (batch?.quantity ?? 0) : Number(quantity),
      reason,
      authorizedById: approverId,
      pin,
      newBatch: effectiveBatchId === "new" ? { batchNo: newBatchNo, expiryDate: newExpiry, unitCost: newCost ? Number(newCost) : undefined } : undefined,
    };
    if (!wholeBatch && (!quantity.trim() || !Number.isFinite(input.quantity))) return void toast.error("Enter a quantity.");
    setBusy(true);
    const res = actions.adjustStock(input);
    setBusy(false);
    if (!res.ok) return void toast.error("Adjustment not applied", { description: res.error });
    toast.success(ADJUSTMENT_LABELS[type].replace(/ \(.*\)$/, "") + " applied", {
      description: `${medicineName(medicine)} · ${res.data.saleable.toLocaleString()} ${medicine.unit} saleable now`,
    });
    setPin("");
    setQuantity("");
    setNotes("");
    onDone?.();
  };

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Medicine" className="sm:col-span-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <TextInput placeholder="Filter by name, SKU or barcode" value={medQuery} onChange={(e) => setMedQuery(e.target.value)} className="sm:max-w-[220px]" aria-label="Filter medicines" />
            <NativeSelect
              value={medicineId}
              onChange={(e) => {
                setMedicineId(e.target.value);
                setBatchId("");
              }}
              aria-label="Medicine"
            >
              <option value="">Choose medicine… ({medOptions.length})</option>
              {medOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {medicineName(m)} · {m.sku}
                  {m.status === "inactive" ? " (archived)" : ""}
                </option>
              ))}
            </NativeSelect>
          </div>
        </Field>
        <Field label="Adjustment type" className="sm:col-span-2">
          <NativeSelect value={type} onChange={(e) => changeType(e.target.value as AdjustmentType)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {ADJUSTMENT_LABELS[t]}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      {medicine && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-ink-700">Batch · FEFO order</span>
            <span className="text-xs text-ink-500">{info?.saleable.toLocaleString() ?? 0} {medicine.unit} saleable</span>
          </div>
          <div role="radiogroup" aria-label="Batch" className="flex max-h-[220px] flex-col overflow-y-auto rounded-xl border border-line">
            {options.map((b, i) => {
              const st = batchStatusInfo(b, today);
              const days = daysBetween(today, b.expiryDate);
              const on = b.id === effectiveBatchId;
              return (
                <button
                  key={b.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setBatchId(b.id)}
                  className={cn("flex items-center justify-between gap-3 px-3 py-2.5 text-left", i > 0 && "border-t border-line-soft", on ? "bg-brand-50 shadow-[inset_3px_0_0_var(--brand)]" : "hover:bg-surface-2")}
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-mono text-xs font-semibold">{b.batchNo}</span>
                    <span className="text-xs text-ink-500">
                      {b.location} · rcvd {formatDate(b.receivedDate)}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <span className="text-[13px] font-bold tabular">
                      {b.quantity.toLocaleString()} {medicine.unit}
                    </span>
                    <span className="flex gap-1">
                      {st.label !== "Saleable" && <Chip tone={st.tone} size="sm">{st.label}</Chip>}
                      <Chip tone={expiryTone(days)} size="sm">
                        {formatDate(b.expiryDate)}
                      </Chip>
                    </span>
                  </span>
                </button>
              );
            })}
            {type === "stock_in" && (
              <button
                type="button"
                role="radio"
                aria-checked={effectiveBatchId === "new"}
                onClick={() => setBatchId("new")}
                className={cn("px-3 py-2.5 text-left text-[13px] font-semibold text-brand-700", options.length > 0 && "border-t border-line-soft", effectiveBatchId === "new" ? "bg-brand-50 shadow-[inset_3px_0_0_var(--brand)]" : "hover:bg-surface-2")}
              >
                + New batch
              </button>
            )}
            {!options.length && type !== "stock_in" && <span className="px-3 py-4 text-center text-[13px] text-ink-500">No batches eligible for this adjustment type.</span>}
          </div>
        </div>
      )}

      {medicine && effectiveBatchId === "new" && (
        <div className="grid grid-cols-1 gap-3 rounded-xl bg-canvas p-3 sm:grid-cols-3">
          <Field label="New batch no.">
            <TextInput value={newBatchNo} onChange={(e) => setNewBatchNo(e.target.value.toUpperCase())} placeholder="e.g. BG26-1105" />
          </Field>
          <Field label="Expiry date">
            <TextInput type="date" value={newExpiry} min={today} onChange={(e) => setNewExpiry(e.target.value)} />
          </Field>
          <Field label="Unit cost">
            <MoneyInput value={newCost} placeholder={medicine.costPrice.toFixed(2)} onChange={(e) => setNewCost(e.target.value.replace(/[^0-9.]/g, ""))} />
          </Field>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {wholeBatch ? (
          <Field label="Quantity">
            <TextInput value={batch ? `${batch.quantity} ${medicine?.unit ?? ""} (whole batch)` : "—"} readOnly disabled />
          </Field>
        ) : (
          <Field label={type === "adjustment" ? "Counted quantity (new on-hand)" : "Quantity"} hint={medicine ? `In ${medicine.unit}` : undefined}>
            <TextInput inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ""))} placeholder="0" />
          </Field>
        )}
        <Field label="Value at cost">
          <TextInput value={peso(Math.abs(valueImpact))} readOnly disabled />
        </Field>
      </div>

      {preview && (
        <div className={cn("flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium", preview.to < 0 ? "bg-danger-bg text-danger" : "bg-canvas text-ink-700")}>
          Batch {batch?.batchNo}: <span className="font-bold tabular">{preview.from}</span>
          <ArrowRight className="size-3.5" aria-hidden />
          <span className="font-bold tabular">{preview.to}</span> {medicine?.unit}
          {preview.to < 0 && <span className="ml-auto">Stock cannot go negative</span>}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        <Field label="Reason">
          <NativeSelect value={reasonPreset} onChange={(e) => setReasonPreset(e.target.value)}>
            {ADJUSTMENT_REASONS[type].map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
            <option value="__other">Other (describe below)</option>
          </NativeSelect>
        </Field>
        <Field label={reasonPreset === "__other" ? "Reason details" : "Notes (optional)"}>
          <TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Segregated on Nov 1; disposal slip to be attached." />
        </Field>
      </div>

      <AuthorizeFields
        permission="stock.approve"
        extraRoles={type === "quarantine" || type === "release" ? ["pharmacist"] : undefined}
        userId={approverId}
        onUserId={setApproverId}
        pin={pin}
        onPin={setPin}
      />

      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && (
          <Button variant="outline" size="md" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button variant="brand" size="md" onClick={submit} disabled={busy || !medicine}>
          {submitLabel}
        </Button>
      </div>
      <span className="text-xs leading-relaxed text-ink-500">Every adjustment writes a stock movement and an audit log entry — nothing is deleted.</span>
    </div>
  );
}
