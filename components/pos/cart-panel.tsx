"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, CircleCheck, Minus, PauseCircle, Plus, ScanBarcode, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import type { DemoDatabase, DiscountType } from "@/lib/types";
import type { Totals } from "@/lib/services/pricing";
import { medicineName } from "@/lib/services/stock";
import { hasPermission } from "@/lib/auth/permissions";
import { peso } from "@/lib/utils/format";
import { fefoPreview, packOptions, updateLine, usePosStore, type CartLine } from "@/hooks/use-pos";
import { useCurrentUser } from "@/hooks/use-session";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { RxChip } from "@/components/shared/chip";
import { MedicineImage } from "@/components/shared/medicine-image";
import { AuthorizeFields } from "@/components/shared/authorize-fields";
import { Field, TextInput } from "@/components/shared/field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CartPanel({
  db,
  totals,
  nextRef,
  needsRx,
  rxCount,
  blockReason,
  onHold,
  onCancel,
  onVerifyRx,
  onCharge,
  className,
}: {
  db: DemoDatabase;
  totals: Totals;
  nextRef: string;
  needsRx: boolean;
  rxCount: number;
  blockReason: string;
  onHold: () => void;
  onCancel: () => void;
  onVerifyRx: () => void;
  onCharge: () => void;
  className?: string;
}) {
  const lines = usePosStore((s) => s.lines);
  const rx = usePosStore((s) => s.rx);
  const itemCount = lines.reduce((s, l) => s + l.qty, 0);
  const empty = lines.length === 0;

  return (
    <aside aria-label="Current sale" className={cn("flex min-h-0 flex-col bg-surface", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-heading text-lg font-semibold">Current sale</h2>
          <span className="font-mono text-xs font-medium text-ink-500">
            {nextRef} · {itemCount} item{itemCount === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon-touch" onClick={onHold} disabled={empty} aria-label="Hold sale" title="Hold sale">
            <PauseCircle className="size-5" />
          </Button>
          <Button variant="outline" size="icon-touch" onClick={onCancel} disabled={empty} aria-label="Cancel sale" title="Cancel sale" className="text-red-700">
            <XCircle className="size-5" />
          </Button>
        </div>
      </div>

      <div className="min-h-40 flex-1 overflow-y-auto">
        {empty ? (
          <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-2.5 p-6 text-center text-ink-500">
            <span className="grid size-16 place-items-center rounded-full bg-brand-50 text-brand">
              <ScanBarcode className="size-7" aria-hidden />
            </span>
            <span className="text-[15px] font-semibold text-ink">Scan or tap a medicine to start</span>
            <span className="text-[13px]">
              Tip: type barcode <span className="font-mono">{db.medicines[0]?.barcode}</span> then press Enter.
            </span>
          </div>
        ) : (
          <ul>
            <AnimatePresence initial={false}>
              {lines.map((l) => (
                <CartRow key={l.key} db={db} line={l} lines={lines} />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-line bg-surface-2 px-5 pt-3.5 pb-[18px]">
        <AnimatePresence initial={false}>
          {needsRx && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="flex items-center gap-2.5 rounded-xl border border-brand-100 bg-brand-50 px-3 py-2.5"
            >
              <ShieldCheck className="size-5 shrink-0 text-brand" aria-hidden />
              <span className="flex-1 text-[13px] font-medium text-brand-700">{rxCount} prescription item{rxCount === 1 ? "" : "s"} need pharmacist verification</span>
              <Button variant="brand" size="sm" className="h-9 rounded-[10px] px-3 text-[13px] font-semibold shadow-none" onClick={onVerifyRx}>
                Verify
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
        {!needsRx && rx && rxCount > 0 && (
          <div className="flex items-center gap-2 text-xs font-medium text-ok">
            <CircleCheck className="size-4" aria-hidden /> Rx verified by {rx.verification.pharmacistName} · logged (simulated)
          </div>
        )}

        <DiscountControls db={db} totals={totals} />

        <div className="flex flex-col gap-1.5 text-sm font-medium text-ink-700">
          <Row label="Subtotal" value={peso(totals.subtotal)} />
          {totals.discountType === "senior" || totals.discountType === "pwd" ? (
            <>
              {totals.lessVat > 0 && <Row label={`Less VAT (${db.settings.pos.vatRate}%) — exempt`} value={"−" + peso(totals.lessVat)} tone="ok" />}
              <Row label={totals.discountLabel} value={"−" + peso(totals.discountAmount)} tone="ok" />
            </>
          ) : totals.discountType === "manual" ? (
            <>
              <Row label={totals.discountLabel} value={"−" + peso(totals.discountAmount)} tone="ok" />
              <Row label={`VAT (${db.settings.pos.vatRate}%) included`} value={peso(totals.vatAmount)} />
            </>
          ) : (
            <>
              <Row label="VATable sales" value={peso(totals.vatableSales)} />
              <Row label={`VAT (${db.settings.pos.vatRate}%)`} value={peso(totals.vatAmount)} />
            </>
          )}
          <div className="flex items-baseline justify-between border-t border-dashed border-line-strong pt-2 text-ink">
            <span className="text-base font-semibold">Total</span>
            <AnimatedNumber value={totals.total} format={peso} duration={0.24} className="font-heading text-[28px] font-bold tracking-[-0.01em] tabular" />
          </div>
        </div>

        {blockReason && <span className="text-center text-xs font-medium text-ink-500">{blockReason}</span>}
        <Button variant="brand" size="xl" onClick={onCharge} disabled={!!blockReason || empty} className="w-full shadow-[0_10px_24px_rgba(34,60,255,.30)] disabled:shadow-none">
          Charge {peso(totals.total)}
          <ArrowRight className="size-5" aria-hidden />
        </Button>
        <span className="text-center text-[11px] text-ink-400">Demo calculations — VAT and SC/PWD rules are configurable in Settings, not verified tax treatment.</span>
      </div>
    </aside>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "ok" }) {
  return (
    <div className="flex justify-between gap-3">
      <span>{label}</span>
      <span className={cn("tabular", tone === "ok" && "text-ok")}>{value}</span>
    </div>
  );
}

function CartRow({ db, line, lines }: { db: DemoDatabase; line: CartLine; lines: CartLine[] }) {
  const reduce = useReducedMotion();
  const lastAdded = usePosStore((s) => s.lastAddedKey);
  const m = db.medicines.find((x) => x.id === line.medicineId);
  const [draftQty, setDraftQty] = useState<string | null>(null);
  const highlighted = lastAdded === line.key;
  useEffect(() => {
    if (!highlighted) return;
    const t = setTimeout(() => usePosStore.getState().set({ lastAddedKey: null }), 700);
    return () => clearTimeout(t);
  }, [highlighted, line.qty]);
  if (!m) return null;
  const unitPrice = m.sellingPrice * line.packMultiplier;
  const change = (patch: Partial<CartLine>) => {
    const err = updateLine(db, line.key, patch);
    if (err) toast.warning(err);
  };
  const commitQty = () => {
    if (draftQty === null) return;
    const n = Number(draftQty);
    setDraftQty(null);
    if (draftQty.trim() === "" || !Number.isFinite(n)) return;
    change({ qty: n });
  };
  const packs = packOptions(m);
  return (
    <motion.li
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, x: -16, height: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      className={cn("flex flex-col gap-2.5 overflow-hidden border-b border-line-soft px-5 py-3.5 transition-colors duration-500", highlighted ? "bg-brand-50" : "bg-surface")}
    >
      <div className="flex justify-between gap-3">
        <MedicineImage medicine={m} size={40} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
            {medicineName(m)} {m.rxRequired && <RxChip size="sm" />}
          </span>
          <span className="text-xs text-ink-500">{fefoPreview(db, lines, line)}</span>
        </div>
        <span className="text-[15px] font-bold whitespace-nowrap tabular">{peso(unitPrice * line.qty)}</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Sell as">
          {packs.map((p) => {
            const on = p.multiplier === line.packMultiplier;
            return (
              <button
                key={p.multiplier}
                type="button"
                aria-pressed={on}
                disabled={packs.length === 1}
                onClick={() => !on && change({ packMultiplier: p.multiplier, packLabel: p.label })}
                className={cn(
                  "h-[30px] rounded-lg border px-2.5 text-[11px] font-semibold",
                  on ? "border-brand-200 bg-brand-50 text-brand-700" : "border-line bg-surface text-ink-500 hover:bg-canvas",
                  packs.length === 1 && "cursor-default border-line bg-canvas text-ink-500"
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="size-10 rounded-[10px]" onClick={() => change({ qty: line.qty - 1 })} aria-label="Decrease quantity">
            <Minus className="size-4" />
          </Button>
          <input
            aria-label={`Quantity of ${medicineName(m)}`}
            inputMode="numeric"
            value={draftQty ?? String(line.qty)}
            onChange={(e) => setDraftQty(e.target.value.replace(/[^\d]/g, ""))}
            onBlur={commitQty}
            onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
            className="h-10 w-12 rounded-lg border border-transparent bg-transparent text-center text-base font-bold tabular outline-none hover:border-line focus:border-brand"
          />
          <Button variant="outline" size="icon" className="size-10 rounded-[10px]" onClick={() => change({ qty: line.qty + 1 })} aria-label="Increase quantity">
            <Plus className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-10 rounded-[10px] text-red-700 hover:bg-red-50 hover:text-red-700" onClick={() => change({ qty: 0 })} aria-label={`Remove ${medicineName(m)}`}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      <span className="text-xs font-medium text-ink-500">
        {peso(unitPrice)} per {line.packMultiplier > 1 ? line.packLabel.toLowerCase() : m.unit}
        {line.packMultiplier > 1 ? ` (${line.packMultiplier} ${m.unit} deducted each)` : ""}
      </span>
    </motion.li>
  );
}

function DiscountControls({ db, totals }: { db: DemoDatabase; totals: Totals }) {
  const discount = usePosStore((s) => s.discount);
  const set = usePosStore((s) => s.set);
  const user = useCurrentUser();
  const canManual = hasPermission(user?.role, "pos.manualDiscount");
  const needsApproval = db.settings.pos.manualDiscountRequiresApproval && !canManual;
  const [approver, setApprover] = useState("");
  const [pin, setPin] = useState("");
  const pos = db.settings.pos;
  const opts: { k: DiscountType; label: string }[] = [
    { k: "none", label: "None" },
    { k: "senior", label: `Senior ${pos.seniorDiscountRate}%` },
    { k: "pwd", label: `PWD ${pos.pwdDiscountRate}%` },
    { k: "manual", label: "Manual" },
  ];
  const pick = (k: DiscountType) => {
    if (k === discount.type) return;
    set({ discount: k === "manual" ? { type: "manual", manualPercent: 5, approvedById: canManual ? user?.id : undefined } : { type: k } });
    setPin("");
  };
  const approve = () => {
    const u = db.users.find((x) => x.id === approver);
    if (!u || u.status !== "active" || !hasPermission(u.role, "pos.manualDiscount")) return void toast.error("Choose an approver who can authorize manual discounts.");
    if (u.pin !== pin) return void toast.error(`Incorrect PIN for ${u.name}.`);
    set({ discount: { ...discount, approvedById: u.id } });
    toast.success(`Manual discount approved by ${u.name}`);
  };
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-ink-700">Discount</span>
      <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Discount">
        {opts.map((o) => {
          const on = discount.type === o.k;
          return (
            <button
              key={o.k}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => pick(o.k)}
              className={cn("h-10 rounded-[10px] border text-[12px] font-semibold sm:text-[13px]", on ? "border-ink bg-ink text-surface" : "border-line bg-surface text-ink-700 hover:bg-canvas")}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {(discount.type === "senior" || discount.type === "pwd") && (
        <div className="grid animate-rise grid-cols-1 gap-2 sm:grid-cols-2">
          <Field label={`${discount.type === "senior" ? "OSCA / Senior Citizen" : "PWD"} ID no.`}>
            <TextInput
              className="h-[42px]"
              value={discount.idNumber ?? ""}
              onChange={(e) => set({ discount: { ...discount, idNumber: e.target.value } })}
              placeholder={discount.type === "senior" ? "e.g. OSCA-2024-001234" : "e.g. PWD-13-7604-000123"}
            />
          </Field>
          <Field label="Customer name">
            <TextInput className="h-[42px]" value={discount.customerName ?? ""} onChange={(e) => set({ discount: { ...discount, customerName: e.target.value } })} placeholder="As printed on the ID" />
          </Field>
          <span className="text-[11px] text-ink-500 sm:col-span-2">Eligibility is checked by the cashier against the physical ID (demo).</span>
        </div>
      )}
      {discount.type === "manual" && (
        <div className="flex animate-rise flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Field label={`Percent (max ${pos.maxManualDiscountPercent}%)`}>
              <TextInput
                className="h-[42px]"
                inputMode="decimal"
                value={discount.manualPercent ?? ""}
                onChange={(e) => {
                  const v = Math.min(pos.maxManualDiscountPercent, Math.max(0, Number(e.target.value.replace(/[^\d.]/g, "")) || 0));
                  set({ discount: { ...discount, manualPercent: v, manualAmount: undefined } });
                }}
              />
            </Field>
            <Field label="Discount value">
              <TextInput className="h-[42px]" readOnly value={peso(totals.discountAmount)} />
            </Field>
          </div>
          {needsApproval && !discount.approvedById ? (
            <div className="flex flex-col gap-2">
              <AuthorizeFields permission="pos.manualDiscount" userId={approver} onUserId={setApprover} pin={pin} onPin={setPin} label="Approver" />
              <Button variant="soft" size="md" onClick={approve} disabled={!approver || pin.length < 4}>
                Approve manual discount
              </Button>
            </div>
          ) : (
            <span className="text-xs font-medium text-ok">
              Approved by {db.users.find((u) => u.id === discount.approvedById)?.name ?? user?.name} · written to the activity log on sale
            </span>
          )}
        </div>
      )}
    </div>
  );
}
