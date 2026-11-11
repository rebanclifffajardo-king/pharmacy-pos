"use client";

import Link from "next/link";

import Image from "next/image";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Database, ImageUp, Lock, Printer, RotateCcw, Save, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import type { PharmacyProfile, PosSettings, PrinterSettings, Settings } from "@/lib/types";
import { useAppStore, useDb } from "@/lib/store/app-store";
import { actions } from "@/lib/store/actions";
import { useCan } from "@/hooks/use-session";
import { useMounted } from "@/hooks/use-mounted";
import { buildTestReceiptLines } from "@/lib/services/receipt-service";
import { escPosBridgeDriver } from "@/lib/printing/drivers";
import { formatDateTime, peso } from "@/lib/utils/format";
import { padNumber } from "@/lib/utils/id";
import { Segmented } from "@/components/shared/segmented";
import { Field, NativeSelect, TextInput } from "@/components/shared/field";
import { Chip } from "@/components/shared/chip";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ThermalReceipt } from "@/components/receipts/thermal-receipt";
import { PrintStatusPanel, usePrintFlow } from "@/components/receipts/print-flow";
import { Button } from "@/components/ui/button";
import { NumberInput, SectionHead, ToggleRow } from "./settings-controls";

type Tab = "profile" | "pos" | "printer" | "demo";
const TABS: Tab[] = ["profile", "pos", "printer", "demo"];

export function SettingsView() {
  const db = useDb();
  const params = useSearchParams();
  const initial = params.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(initial && TABS.includes(initial) ? initial : "profile");
  const canManage = useCan("settings.manage");
  const k = db.seededAt; // re-key drafts after a demo reset

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          variant="dark"
          ariaLabel="Settings section"
          value={tab}
          onChange={setTab}
          options={[
            { value: "profile", label: "Pharmacy profile" },
            { value: "pos", label: "POS & tax" },
            { value: "printer", label: "Receipt printer" },
            { value: "demo", label: "Demo data" },
          ]}
        />
        {!canManage && (
          <Chip tone="warn" size="lg" dot>
            <Lock className="size-3" aria-hidden /> Read-only for your role
          </Chip>
        )}
      </div>
      {tab === "profile" && <ProfileSection key={k} settings={db.settings} canManage={canManage} />}
      {tab === "pos" && <PosSection key={k} settings={db.settings} canManage={canManage} />}
      {tab === "printer" && <PrinterSection key={k} settings={db.settings} canManage={canManage} />}
      {tab === "demo" && <DemoSection canManage={canManage} />}
    </>
  );
}

function useDraft<T>(source: T) {
  const [draft, setDraft] = useState<T>(source);
  const dirty = JSON.stringify(draft) !== JSON.stringify(source);
  const set = <K extends keyof T>(key: K, v: T[K]) => setDraft((d) => ({ ...d, [key]: v }));
  return { draft, set, dirty, reset: () => setDraft(source), setDraft };
}

function SaveBar({ dirty, canManage, onSave, onReset }: { dirty: boolean; canManage: boolean; onSave: () => void; onReset: () => void }) {
  if (!canManage) return null;
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
      {dirty && <span className="mr-auto text-xs font-medium text-warn">Unsaved changes</span>}
      <Button variant="outline" size="md" onClick={onReset} disabled={!dirty}>
        <RotateCcw className="size-4" aria-hidden /> Discard
      </Button>
      <Button variant="brand" size="md" onClick={onSave} disabled={!dirty}>
        <Save className="size-4" aria-hidden /> Save changes
      </Button>
    </div>
  );
}

function save(patch: Parameters<typeof actions.updateSettings>[0]["patch"], section: string) {
  const res = actions.updateSettings({ patch, section });
  if (!res.ok) {
    toast.error("Settings not saved", { description: res.error });
    return false;
  }
  toast.success(`${section[0].toUpperCase() + section.slice(1)} settings saved`, { description: "New receipts use these settings immediately." });
  return true;
}

function Card({ children }: { children: ReactNode }) {
  return <section className="card-surface flex min-w-0 flex-col gap-5 p-5 sm:p-6">{children}</section>;
}

// ---------------------------------------------------------------------------- profile

function ProfileSection({ settings, canManage }: { settings: Settings; canManage: boolean }) {
  const { draft, set, dirty, reset } = useDraft<PharmacyProfile>(settings.pharmacy);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(f.type)) return void toast.error("Use a PNG, JPG, WebP or SVG image.");
    if (f.size > 300 * 1024) return void toast.error("Logo is too large", { description: "Keep it under 300 KB so demo data fits in browser storage." });
    const reader = new FileReader();
    reader.onload = () => set("logoDataUrl", String(reader.result));
    reader.readAsDataURL(f);
  };

  const text = (key: keyof PharmacyProfile, label: string, opts: { hint?: string; placeholder?: string; wide?: boolean } = {}) => (
    <Field label={label} hint={opts.hint} className={opts.wide ? "sm:col-span-2" : undefined}>
      <TextInput value={(draft[key] as string) ?? ""} placeholder={opts.placeholder} onChange={(e) => set(key, e.target.value as never)} />
    </Field>
  );

  return (
    <Card>
      <SectionHead title="Pharmacy profile" description="Printed on every receipt header and used across reports." />
      <fieldset disabled={!canManage} className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-4 rounded-xl bg-canvas p-4">
          <span className="grid size-20 shrink-0 place-items-center rounded-2xl border border-line bg-white p-1.5">
            {draft.logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={draft.logoDataUrl} alt="Custom pharmacy logo" className="max-h-full max-w-full object-contain" />
            ) : (
              <Image src="/brand/yasmar-seal.png" alt="YasMar Pharmacy logo" width={68} height={68} />
            )}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-sm font-semibold">Receipt &amp; header logo</span>
            <span className="text-xs text-ink-500">{draft.logoDataUrl ? "Custom upload — printed in monochrome on receipts." : "Using the YasMar brand seal."} PNG/JPG/SVG up to 300 KB.</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} aria-label="Upload logo" />
            <Button variant="outline" size="md" onClick={() => fileRef.current?.click()}>
              <ImageUp className="size-4" aria-hidden /> Upload logo
            </Button>
            {draft.logoDataUrl && (
              <Button variant="ghost" size="md" onClick={() => set("logoDataUrl", null)}>
                Use brand logo
              </Button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {text("name", "Pharmacy name")}
          {text("branch", "Branch name")}
          {text("address", "Address", { wide: true })}
          {text("city", "City / province")}
          {text("phone", "Contact number")}
          {text("email", "Email")}
          {text("tin", "TIN", { hint: "As registered with the BIR" })}
          {text("businessPermit", "Business / Mayor’s permit no.")}
          {text("ltoNumber", "FDA License to Operate (LTO)")}
          {text("birPermit", "BIR permit / PTU (receipt footer)", { hint: "Placeholder until the pharmacy’s BIR registration is configured" })}
          {text("serialNo", "Machine / terminal serial no. (receipt footer)")}
        </div>
      </fieldset>
      <p className="rounded-xl bg-warn-bg px-3 py-2.5 text-xs leading-relaxed text-warn">
        TIN, permit and serial fields are demo placeholders. A generic receipt template is not automatically BIR-compliant — confirm the required receipt/invoice fields with the pharmacy’s accountant.
      </p>
      <SaveBar dirty={dirty} canManage={canManage} onReset={reset} onSave={() => save({ pharmacy: draft }, "pharmacy profile")} />
    </Card>
  );
}

// ---------------------------------------------------------------------------- POS

function PosSection({ settings, canManage }: { settings: Settings; canManage: boolean }) {
  const { draft, set, dirty, reset } = useDraft<PosSettings>(settings.pos);
  const num = (key: keyof PosSettings, label: string, opts: { suffix?: string; min?: number; max?: number; step?: number; hint?: string } = {}) => (
    <Field label={label} hint={opts.hint}>
      <NumberInput value={draft[key] as number} onChange={(n) => set(key, n as never)} suffix={opts.suffix} min={opts.min} max={opts.max} step={opts.step} ariaLabel={label} />
    </Field>
  );
  const txt = (key: keyof PosSettings, label: string, hint?: string) => (
    <Field label={label} hint={hint}>
      <TextInput value={draft[key] as string} onChange={(e) => set(key, e.target.value as never)} />
    </Field>
  );
  const sample = 245;
  const vat = Number.isFinite(draft.vatRate) ? draft.vatRate / 100 : 0;
  const net = sample / (1 + vat);
  const scRate = Number.isFinite(draft.seniorDiscountRate) ? draft.seniorDiscountRate / 100 : 0;
  const scTotal = draft.scPwdVatExempt ? net - net * scRate : sample - sample * scRate;

  const onSave = () => {
    const nums: (keyof PosSettings)[] = ["vatRate", "seniorDiscountRate", "pwdDiscountRate", "maxManualDiscountPercent", "expiryWarningDays", "receiptPadding", "nextReceiptNo"];
    if (nums.some((k) => !Number.isFinite(draft[k] as number))) return void toast.error("Fill in every number field.");
    save({ pos: { ...draft, receiptPadding: Math.max(3, Math.min(10, Math.round(draft.receiptPadding))), nextReceiptNo: Math.round(draft.nextReceiptNo), expiryWarningDays: Math.round(draft.expiryWarningDays) } }, "POS");
  };

  return (
    <Card>
      <SectionHead title="POS, tax & numbering" description="Configurable demo rules used by checkout, receipts and alerts." />
      <p className="flex items-start gap-2 rounded-xl bg-warn-bg px-3 py-2.5 text-xs leading-relaxed text-warn">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        These are configurable demonstration calculations — not a legally verified implementation of Philippine VAT or Senior Citizen / PWD discount rules. Validate with the pharmacy’s accountant before production use.
      </p>
      <fieldset disabled={!canManage} className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <span className="label-caps">Tax &amp; discounts</span>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Currency">
              <TextInput value="PHP — Philippine peso (₱)" disabled readOnly />
            </Field>
            <Field label="Timezone">
              <TextInput value="Asia/Manila (PHT, UTC+8)" disabled readOnly />
            </Field>
            {num("vatRate", "VAT rate", { suffix: "%", min: 0, max: 30, step: 0.5 })}
            {num("maxManualDiscountPercent", "Max manual discount", { suffix: "%", min: 0, max: 100 })}
            {num("seniorDiscountRate", "Senior citizen discount", { suffix: "%", min: 0, max: 100 })}
            {num("pwdDiscountRate", "PWD discount", { suffix: "%", min: 0, max: 100 })}
            {num("expiryWarningDays", "Expiry warning window", { suffix: "days", min: 1, max: 365, hint: "Batches inside this window show as “Expiring soon”." })}
          </div>
          <div className="grid grid-cols-1 gap-x-8 gap-y-1 rounded-xl bg-canvas px-4 py-2 sm:grid-cols-2">
            <ToggleRow label="Prices include VAT" description="Selling prices are VAT-inclusive." checked={draft.pricesVatInclusive} onChange={(v) => set("pricesVatInclusive", v)} />
            <ToggleRow label="SC / PWD sales are VAT-exempt" description="Remove VAT first, then apply the discount." checked={draft.scPwdVatExempt} onChange={(v) => set("scPwdVatExempt", v)} />
            <ToggleRow label="Manual discounts need approval" description="Non-admin cashiers need an Administrator PIN." checked={draft.manualDiscountRequiresApproval} onChange={(v) => set("manualDiscountRequiresApproval", v)} />
          </div>
          <span className="text-xs text-ink-500">
            Example: a {peso(sample)} sale → regular VAT {peso(sample - net)}; Senior citizen total {peso(scTotal)}.
          </span>
        </div>
        <div className="flex flex-col gap-3">
          <span className="label-caps">Numbering &amp; counter</span>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {txt("receiptPrefix", "Receipt prefix")}
            {num("receiptPadding", "Receipt number digits", { min: 3, max: 10 })}
            {num("nextReceiptNo", "Next receipt number", { min: 1, hint: "Must be above the last issued number." })}
            <Field label="Next receipt preview">
              <TextInput readOnly disabled value={draft.receiptPrefix + padNumber(Number.isFinite(draft.nextReceiptNo) ? draft.nextReceiptNo : 0, Number.isFinite(draft.receiptPadding) ? draft.receiptPadding : 6)} className="font-mono" />
            </Field>
            {txt("refundPrefix", "Refund prefix")}
            {txt("poPrefix", "Purchase order prefix")}
            {txt("counterName", "Counter / terminal name")}
          </div>
        </div>
      </fieldset>
      <SaveBar dirty={dirty} canManage={canManage} onReset={reset} onSave={onSave} />
    </Card>
  );
}

// ---------------------------------------------------------------------------- printer

function PrinterSection({ settings, canManage }: { settings: Settings; canManage: boolean }) {
  const { draft, set, dirty, reset } = useDraft<PrinterSettings>(settings.printer);
  const mounted = useMounted();
  const bridge = mounted && escPosBridgeDriver.isAvailable();
  const previewSettings: Settings = useMemo(() => ({ ...settings, printer: { ...draft, fontSizePx: Number.isFinite(draft.fontSizePx) ? draft.fontSizePx : 11.5 } }), [settings, draft]);
  const lines = useMemo(() => buildTestReceiptLines(previewSettings), [previewSettings]);
  const flow = usePrintFlow();
  const [simFail, setSimFail] = useState(false);

  const testPrint = async () => {
    const res = await flow.run(buildTestReceiptLines(previewSettings), previewSettings, { kind: "test", simulateFailure: simFail });
    if (!res) return;
    setSimFail(false);
    if (res.status === "failed") toast.error("Test print failed", { description: res.message });
    else toast.success(res.status === "printed" ? "Test receipt printed" : "Test print sent to the browser dialog");
  };

  const pill = (on: boolean) =>
    `h-11 rounded-[10px] text-[13px] font-semibold transition-colors ${on ? "border-[1.5px] border-brand bg-brand-50 text-brand-700" : "border border-line bg-surface text-ink-700 hover:bg-canvas"}`;

  return (
    <div className="flex flex-wrap items-start gap-4">
      <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-4">
        <Card>
          <SectionHead
            title="Receipt printer"
            description="XPrinter 58mm thermal · settings apply to new receipt previews immediately."
            actions={<Chip tone={bridge ? "ok" : "warn"} size="lg" dot>{bridge ? "ESC/POS bridge detected" : "ESC/POS bridge not detected"}</Chip>}
          />
          <fieldset disabled={!canManage} className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Printer model">
                <TextInput value={draft.model} onChange={(e) => set("model", e.target.value)} />
              </Field>
              <Field label="Connection" hint={draft.connection === "browser" ? "Opens the browser print dialog — can’t confirm paper output." : bridge ? "Native bridge confirms printed / failed." : "Bridge missing — falls back to browser print."}>
                <NativeSelect value={draft.connection} onChange={(e) => set("connection", e.target.value as PrinterSettings["connection"])}>
                  <option value="browser">Browser print dialog (fallback)</option>
                  <option value="escpos-bridge">ESC/POS bridge (Android WebView / local service)</option>
                </NativeSelect>
              </Field>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-ink-700">Paper width</span>
              <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
                {([58, 80] as const).map((w) => (
                  <button key={w} type="button" aria-pressed={draft.paperWidthMm === w} className={pill(draft.paperWidthMm === w)} onClick={() => set("paperWidthMm", w)}>
                    {w} mm{w === 58 ? " · XPrinter" : ""}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-ink-700">Characters per line</span>
              <div className="grid grid-cols-3 gap-2">
                {([
                  [32, "32 · Font A (default)"],
                  [42, "42 · Font B (condensed)"],
                  [48, "48 · 80mm paper"],
                ] as const).map(([c, l]) => (
                  <button key={c} type="button" aria-pressed={draft.charsPerLine === c} className={pill(draft.charsPerLine === c)} onClick={() => set("charsPerLine", c)}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={`Side margin · ${draft.sideMarginMm} mm`}>
                <input type="range" min={0} max={4} step={1} value={draft.sideMarginMm} onChange={(e) => set("sideMarginMm", Number(e.target.value))} aria-label="Side margin in millimetres" className="h-11 accent-[var(--brand)]" />
              </Field>
              <Field label="Preview font size" hint="Screen preview only; print size auto-fits the columns.">
                <NumberInput value={draft.fontSizePx} onChange={(n) => set("fontSizePx", n)} min={9} max={14} step={0.5} suffix="px" ariaLabel="Receipt font size" />
              </Field>
              <Field label="Footer message (bold)">
                <TextInput value={draft.footerMessage} maxLength={48} onChange={(e) => set("footerMessage", e.target.value)} />
              </Field>
              <Field label="Footer line 2">
                <TextInput value={draft.footerMessage2} maxLength={48} onChange={(e) => set("footerMessage2", e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-x-8 rounded-xl bg-canvas px-4 py-2 sm:grid-cols-2">
              <ToggleRow label="Print logo on receipt" description="Dithered to monochrome." checked={draft.showLogo} onChange={(v) => set("showLogo", v)} />
              <ToggleRow label="Auto-print after sale" description="Start printing when payment succeeds." checked={draft.autoPrintAfterSale} onChange={(v) => set("autoPrintAfterSale", v)} />
            </div>
          </fieldset>
          <SaveBar
            dirty={dirty}
            canManage={canManage}
            onReset={reset}
            onSave={() => {
              if (!Number.isFinite(draft.fontSizePx)) return void toast.error("Enter a font size.");
              save({ printer: draft }, "printer");
            }}
          />
        </Card>
        <Card>
          <SectionHead title="Test print" description="Prints the sample on the right. Available to every role." />
          <PrintStatusPanel phase={flow.phase} outcome={flow.outcome} printerLabel={`${draft.model.split("(")[0].trim()} · ${draft.connection === "browser" ? "Browser print" : "ESC/POS bridge"}`} onRetry={testPrint} className="min-h-[210px]" />
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="brand" size="touch" onClick={testPrint} disabled={flow.busy}>
              <Printer className="size-4" aria-hidden /> Print test receipt
            </Button>
            <label className="flex items-center gap-2 text-xs font-medium text-ink-500">
              <input type="checkbox" className="size-4 accent-[var(--red)]" checked={simFail} onChange={(e) => setSimFail(e.target.checked)} />
              Demo: simulate printer failure
            </label>
          </div>
          <ul className="flex list-disc flex-col gap-1.5 pl-[18px] text-xs leading-relaxed text-ink-700">
            <li>58mm paper, ~48mm printable — {draft.charsPerLine} monospace columns; amounts right-aligned and long names wrap.</li>
            <li>Print CSS hides the sidebar, header, buttons and dialogs — only the receipt prints.</li>
            <li>Browser printing can only report “submitted”. “Printed” appears only when the ESC/POS bridge acknowledges the job.</li>
          </ul>
        </Card>
      </div>
      <aside className="flex min-w-0 flex-[1_1_340px] flex-col items-center gap-3 rounded-2xl bg-[#E4E7F0] px-4 py-6 dark:bg-[#0F1530]">
        <span className="label-caps">Live preview · {draft.paperWidthMm}mm · {draft.charsPerLine} cols{dirty ? " · unsaved" : ""}</span>
        <div className="w-full overflow-x-auto pb-3">
          <ThermalReceipt lines={lines} settings={previewSettings} />
        </div>
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------- demo

function DemoSection({ canManage }: { canManage: boolean }) {
  const db = useDb();
  const router = useRouter();
  const storageError = useAppStore((s) => s.storageError);
  const [confirm, setConfirm] = useState(false);
  const sizeKb = useMemo(() => Math.round(JSON.stringify(db).length / 1024), [db]);
  const counts: [string, number][] = [
    ["Medicine SKUs", db.medicines.length],
    ["Categories", db.categories.length],
    ["Batches", db.batches.length],
    ["Suppliers", db.suppliers.length],
    ["Sales transactions", db.transactions.length],
    ["Refunds", db.refunds.length],
    ["Purchase orders", db.purchaseOrders.length],
    ["Users", db.users.length],
    ["Stock movements", db.movements.length],
    ["Held sales", db.heldSales.length],
  ];

  const doReset = () => {
    actions.resetDemo();
    const signedIn = !!useAppStore.getState().sessionUserId;
    toast.success("Demo data reset", { description: "All sample records were restored to their original state." });
    router.replace(signedIn ? "/dashboard" : "/login");
  };

  return (
    <div className="flex flex-wrap items-start gap-4">
      <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-4">
        <Card>
          <SectionHead
            title="Demo Mode"
            description="Everything runs on fictional sample data stored in this browser."
            actions={<Chip tone="demo" size="lg" dot>Demo Mode active</Chip>}
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {counts.map(([l, v]) => (
              <div key={l} className="flex flex-col gap-1 rounded-[14px] bg-canvas p-3.5">
                <span className="text-xs text-ink-500">{l}</span>
                <span className="font-heading text-xl font-semibold tabular">{v.toLocaleString("en-PH")}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 text-[13px] sm:grid-cols-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-ink-500">Seeded</span>
              <span className="font-medium">{formatDateTime(db.seededAt)}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-ink-500">Storage used</span>
              <span className="font-medium">~{sizeKb.toLocaleString("en-PH")} KB of ~5 MB (localStorage)</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-ink-500">Schema version</span>
              <span className="font-medium">v{db.schemaVersion}</span>
            </div>
          </div>
          {storageError && <p className="rounded-xl bg-danger-bg px-3 py-2.5 text-xs text-danger">{storageError}</p>}
          <ul className="flex list-disc flex-col gap-1.5 pl-[18px] text-xs leading-relaxed text-ink-700">
            <li>Medicines, prices, barcodes, batches and suppliers are fictional sample values — not verified pharmaceutical, regulatory or pricing information.</li>
            <li>Changes survive page refreshes in this browser only. Other browsers and devices keep their own copy.</li>
            <li>QR Ph and card payments are simulated and labeled; no payment provider is connected.</li>
            <li>Seed data is deterministic: a reset restores the same records, re-dated to today.</li>
            <li>
              Medicine photos are free-licensed Wikimedia Commons images or manufacturer product images (© their owners) —{" "}
              <Link href="/image-credits" className="font-medium text-brand-700 hover:underline">
                see Image Credits
              </Link>
              .
            </li>
          </ul>
        </Card>
      </div>
      <aside className="card-surface flex min-w-0 flex-[1_1_320px] flex-col gap-3 p-5">
        <span className="grid size-11 place-items-center rounded-xl bg-danger-bg text-danger">
          <Database className="size-5" aria-hidden />
        </span>
        <h2 className="font-heading text-[17px] font-semibold">Reset demo data</h2>
        <p className="text-[13px] leading-relaxed text-ink-700">
          Restores the original 100 medicines, batches, sales history, purchase orders, users and settings. Sales, refunds, stock adjustments and setting changes made in this browser are discarded.
        </p>
        <Button variant="danger-soft" size="touch" onClick={() => setConfirm(true)} disabled={!canManage}>
          <RotateCcw className="size-4" aria-hidden /> Reset Demo Data
        </Button>
        {!canManage && <span className="text-xs text-ink-500">Only an Administrator can reset demo data.</span>}
      </aside>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Reset all demo data?"
        description="Every change made in this browser — sales, refunds, stock adjustments, purchase orders, users and settings — will be replaced by the original sample data. This can’t be undone."
        confirmLabel="Reset demo data"
        onConfirm={doReset}
      />
    </div>
  );
}
