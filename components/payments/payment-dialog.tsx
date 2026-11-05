"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Banknote, CreditCard, Loader2, QrCode, RotateCcw, Smartphone, X } from "lucide-react";
import type { PaymentMethod } from "@/lib/types";
import type { PaymentInput } from "@/lib/services/transaction-service";
import type { Totals } from "@/lib/services/pricing";
import { quickCashOptions } from "@/lib/services/pricing";
import { demoCardTerminal, demoQrModules, demoQrPhProvider, type QrPhIntent } from "@/lib/services/payment-service";
import { peso, round2 } from "@/lib/utils/format";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/shared/chip";
import { cn } from "@/lib/utils";

/**
 * Checkout dialog (design: dark "Amount due" panel + method tabs).
 * QR Ph and card flows are SIMULATED and labeled "Demo Payment"; nothing contacts a provider.
 * `onComplete` may be called more than once (double-click) — the sale service is idempotent.
 */
export function PaymentDialog({
  open,
  onOpenChange,
  totals,
  itemCount,
  reference,
  idempotencyKey,
  submitting,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  totals: Totals;
  itemCount: number;
  reference: string;
  idempotencyKey: string;
  submitting: boolean;
  onComplete: (payment: PaymentInput) => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent showCloseButton={false} className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto rounded-[22px] p-0 sm:max-w-[880px]">
        <div className="flex flex-wrap">
          <div className="flex flex-[1_1_280px] flex-col gap-[18px] bg-ink-panel p-7 text-white">
            <span className="text-xs font-semibold tracking-[0.08em] text-[#A9B4FF] uppercase">Amount due</span>
            <span className="font-heading text-[44px] leading-none font-bold tracking-[-0.02em] tabular">{peso(totals.total)}</span>
            <div className="flex flex-col gap-2 text-sm text-[#C9CEE6]">
              <div className="flex justify-between">
                <span>{itemCount} items</span>
                <span className="tabular">{peso(totals.subtotal)}</span>
              </div>
              {totals.discountType !== "none" && (
                <div className="flex justify-between">
                  <span>{totals.discountLabel}</span>
                  <span className="tabular">−{peso(totals.discountAmount + totals.lessVat)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>{totals.vatAmount > 0 ? "VAT included" : "VAT-exempt sale"}</span>
                <span className="tabular">{peso(totals.vatAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Reference</span>
                <span className="font-mono">{reference}</span>
              </div>
            </div>
            <div className="mt-auto rounded-xl bg-white/[.08] p-3 text-xs leading-relaxed text-[#C9CEE6]">
              Demo Mode: every payment confirmation here is simulated and labeled. Live mode only completes on a provider-verified reference.
            </div>
          </div>

          <div className="flex min-w-0 flex-[2_1_420px] flex-col gap-[18px] px-7 pt-6 pb-7">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="font-heading text-xl font-semibold">Payment method</DialogTitle>
                <DialogDescription className="sr-only">Choose cash, QR Ph or card and confirm the payment.</DialogDescription>
              </div>
              <Button variant="outline" size="icon-touch" onClick={() => onOpenChange(false)} disabled={submitting} aria-label="Close payment">
                <X className="size-5" />
              </Button>
            </div>
            <div role="tablist" className="grid grid-cols-3 gap-2">
              {(
                [
                  ["cash", "Cash", Banknote],
                  ["qrph", "QR Ph", QrCode],
                  ["card", "Card", CreditCard],
                ] as const
              ).map(([k, label, Icon]) => {
                const on = method === k;
                return (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    disabled={submitting}
                    onClick={() => setMethod(k)}
                    className={cn(
                      "flex h-[52px] items-center justify-center gap-2 rounded-xl text-sm font-semibold",
                      on ? "border-[1.5px] border-brand bg-brand-50 text-brand-700" : "border border-line bg-surface text-ink-700 hover:bg-canvas"
                    )}
                  >
                    <Icon className="size-[18px]" aria-hidden />
                    {label}
                  </button>
                );
              })}
            </div>
            {method === "cash" && <CashPanel key={idempotencyKey} total={totals.total} submitting={submitting} onComplete={onComplete} />}
            {method === "qrph" && <QrPanel key={idempotencyKey} total={totals.total} reference={reference} submitting={submitting} onComplete={onComplete} />}
            {method === "card" && <CardPanel key={idempotencyKey} total={totals.total} submitting={submitting} onComplete={onComplete} />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CompleteButton({ label, disabled, submitting, onClick }: { label: string; disabled: boolean; submitting: boolean; onClick: () => void }) {
  return (
    <Button variant="brand" size="touch" className="h-14 w-full text-[17px]" disabled={disabled || submitting} onClick={onClick} aria-busy={submitting}>
      {submitting ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
      {submitting ? "Recording sale…" : label}
    </Button>
  );
}

function CashPanel({ total, submitting, onComplete }: { total: number; submitting: boolean; onComplete: (p: PaymentInput) => void }) {
  const [cash, setCash] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);
  const tendered = Number(cash) || 0;
  const change = round2(tendered - total);
  const short = tendered + 0.0001 < total;
  const quick = quickCashOptions(total);
  const submit = () => !short && onComplete({ method: "cash", tendered: round2(tendered) });
  return (
    <div className="flex animate-rise flex-col gap-3.5">
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink-700">
        Amount received
        <span className="flex h-[60px] items-center gap-2 rounded-[14px] border-[1.5px] border-brand px-4 shadow-[0_0_0_4px_rgba(34,60,255,.10)]">
          <span className="font-heading text-2xl font-semibold text-ink-500">₱</span>
          <input
            ref={inputRef}
            inputMode="decimal"
            value={cash}
            onChange={(e) => setCash(e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1"))}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="0.00"
            className="min-w-0 flex-1 bg-transparent font-heading text-[26px] font-semibold text-ink outline-none tabular"
          />
        </span>
      </label>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {quick.map((v, i) => (
          <button key={v} type="button" onClick={() => setCash(v.toFixed(2))} className="h-12 rounded-xl border border-line-strong bg-surface text-sm font-semibold text-ink hover:bg-canvas">
            {i === 0 ? "Exact" : "₱" + v.toLocaleString("en-PH")}
          </button>
        ))}
      </div>
      <div
        className={cn(
          "flex items-center justify-between rounded-[14px] px-[18px] py-3.5 transition-colors duration-200",
          !cash ? "bg-canvas text-ink-700" : short ? "bg-danger-bg text-danger" : "bg-ok-bg text-ok"
        )}
        aria-live="polite"
      >
        <span className="text-sm font-semibold">{cash && short ? "Short by" : "Change due"}</span>
        <span className="font-heading text-[30px] font-bold tabular">{cash ? peso(Math.abs(change)) : "₱0.00"}</span>
      </div>
      <CompleteButton label={short && cash ? "Insufficient cash" : "Complete cash sale"} disabled={short} submitting={submitting} onClick={submit} />
    </div>
  );
}

function DemoQr({ payload }: { payload: string }) {
  const cells = useMemo(() => demoQrModules(payload), [payload]);
  return (
    <div role="img" aria-label="Demonstration QR code — not payable" className="relative box-content size-[200px] rounded-2xl border border-line bg-white p-3">
      <div className="grid grid-cols-[repeat(25,8px)] auto-rows-[8px]">
        {cells.map((on, i) => (
          <span key={i} className={on ? "bg-[#0F1733]" : ""} />
        ))}
      </div>
      <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md border border-line bg-white px-2 py-1 text-[13px] font-extrabold text-[#223CFF]">QR Ph</span>
    </div>
  );
}

function QrPanel({ total, reference, submitting, onComplete }: { total: number; reference: string; submitting: boolean; onComplete: (p: PaymentInput) => void }) {
  const [intent, setIntent] = useState<QrPhIntent>(() => demoQrPhProvider.createIntent(total, reference));
  const [status, setStatus] = useState<"pending" | "checking" | "paid" | "failed" | "expired">("pending");
  const [message, setMessage] = useState("");
  const [providerRef, setProviderRef] = useState<string | undefined>();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const remaining = Math.max(0, intent.expiresAt - now);
  const expired = status === "pending" && remaining === 0;
  const effective = expired ? "expired" : status;

  const simulate = async (outcome: "approved" | "declined") => {
    setStatus("checking");
    const res = await demoQrPhProvider.simulate(intent, outcome);
    setMessage(res.message);
    setProviderRef(res.reference);
    setStatus(res.paid ? "paid" : "failed");
  };
  const regenerate = () => {
    setIntent(demoQrPhProvider.createIntent(total, reference));
    setStatus("pending");
    setMessage("");
    setProviderRef(undefined);
  };
  const box = {
    pending: ["bg-brand-50 text-brand-700", "Waiting for customer to pay…"],
    checking: ["bg-brand-50 text-brand-700", "Checking with provider (simulated)…"],
    paid: ["bg-ok-bg text-ok", message],
    failed: ["bg-danger-bg text-danger", message],
    expired: ["bg-danger-bg text-danger", "QR expired. Generate a new QR for the customer."],
  }[effective];
  const mm = String(Math.floor(remaining / 60000)).padStart(1, "0");
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");

  return (
    <div className="flex animate-rise flex-wrap gap-5">
      <div className="flex flex-col items-center gap-2">
        <div className={cn("transition-opacity", effective === "expired" && "opacity-30")}>
          <DemoQr payload={intent.payload} />
        </div>
        <Chip tone="demo" size="lg">
          DEMO PAYMENT · QR not payable
        </Chip>
        <span className="text-xs text-ink-500 tabular">{effective === "pending" || effective === "checking" ? `Expires in ${mm}:${ss}` : " "}</span>
      </div>
      <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-3">
        <div className="flex items-baseline justify-between rounded-xl bg-canvas px-3.5 py-2.5">
          <span className="text-[13px] font-semibold text-ink-700">Amount payable</span>
          <span className="font-heading text-xl font-bold tabular">{peso(total)}</span>
        </div>
        <div className={cn("flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-sm font-semibold", box[0])} aria-live="polite">
          {(effective === "pending" || effective === "checking") && (
            <span className="relative flex size-5 items-center justify-center">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-30" />
              <Smartphone className="relative size-4" aria-hidden />
            </span>
          )}
          <span>{box[1]}</span>
        </div>
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-700">
          Payment reference (from provider)
          <input readOnly value={providerRef ?? ""} placeholder={`Pending · intent ${intent.reference}`} className="h-[42px] rounded-xl border border-line-strong bg-canvas px-3 font-mono text-[13px] text-ink outline-none" />
        </label>
        <span className="text-xs leading-relaxed text-ink-500">QR Ph is the interoperability standard; confirmation comes from your acquiring bank or payment provider — never from the QR being shown or scanned.</span>
        <div className="flex flex-wrap gap-2">
          {effective === "expired" || effective === "failed" ? (
            <Button variant="outline" size="md" onClick={regenerate}>
              <RotateCcw className="size-4" /> New QR
            </Button>
          ) : (
            <>
              <Button variant="demo" size="md" onClick={() => simulate("approved")} disabled={effective !== "pending"}>
                Simulate paid (demo)
              </Button>
              <Button variant="demo" size="md" onClick={() => simulate("declined")} disabled={effective !== "pending"}>
                Simulate failed (demo)
              </Button>
            </>
          )}
        </div>
        <CompleteButton label="Complete QR Ph sale" disabled={effective !== "paid"} submitting={submitting} onClick={() => onComplete({ method: "qrph", reference: providerRef })} />
      </div>
    </div>
  );
}

function CardPanel({ total, submitting, onComplete }: { total: number; submitting: boolean; onComplete: (p: PaymentInput) => void }) {
  const [state, setState] = useState<"idle" | "waiting" | "processing" | "approved" | "declined">("idle");
  const [result, setResult] = useState<{ approvalCode?: string; cardLast4?: string; message: string } | null>(null);
  const simulate = async (outcome: "approved" | "declined") => {
    setState("processing");
    const r = await demoCardTerminal.simulate(outcome);
    setResult(r);
    setState(r.approved ? "approved" : "declined");
  };
  const map = {
    idle: ["Terminal ready", "Connected · Demo terminal T-01", "bg-canvas text-ink"],
    waiting: ["Waiting for payment", "Customer taps, inserts or swipes on the terminal", "bg-brand-50 text-brand-700"],
    processing: ["Processing…", "Contacting the acquiring bank (simulated)", "bg-brand-50 text-brand-700"],
    approved: ["Approved", `Approval ${result?.approvalCode ?? ""} · card •••• ${result?.cardLast4 ?? ""} (simulated)`, "bg-ok-bg text-ok"],
    declined: ["Declined", result?.message ?? "Issuer declined (simulated).", "bg-danger-bg text-danger"],
  }[state];
  const steps = ["Waiting", "Processing", state === "declined" ? "Declined" : "Approved"];
  const cur = state === "idle" ? -1 : state === "waiting" ? 0 : state === "processing" ? 1 : 2;
  return (
    <div className="flex animate-rise flex-col gap-3.5">
      <div className="flex flex-wrap gap-2">
        {steps.map((s, i) => (
          <span
            key={s}
            className={cn(
              "inline-flex h-7 items-center rounded-full px-2.5 text-xs font-semibold",
              cur >= i ? (s === "Declined" ? "bg-danger-bg text-danger" : "bg-brand-50 text-brand-700") : "bg-canvas text-ink-400"
            )}
          >
            {i + 1} · {s}
          </span>
        ))}
        <Chip tone="demo" size="lg" className="ml-auto">
          DEMO PAYMENT
        </Chip>
      </div>
      <div className={cn("flex items-center gap-3.5 rounded-[14px] px-[18px] py-4", map[2])} aria-live="polite">
        <CreditCard className={cn("size-7 shrink-0", (state === "waiting" || state === "processing") && "animate-pulse-soft")} aria-hidden />
        <div className="flex flex-col gap-0.5">
          <span className="text-base font-semibold">{map[0]}</span>
          <span className="text-[13px] opacity-85">{map[1]}</span>
        </div>
        {state === "processing" && <Loader2 className="ml-auto size-5 animate-spin" aria-hidden />}
      </div>
      <span className="text-xs leading-relaxed text-ink-500">Card details are entered on the external terminal only. This system never sees or stores card numbers, CVV or PIN — only the provider’s approval reference.</span>
      <div className="flex flex-wrap gap-2">
        {state === "idle" && (
          <Button variant="ink" size="touch" onClick={() => setState("waiting")}>
            Send {peso(total)} to terminal
          </Button>
        )}
        {state === "waiting" && (
          <>
            <Button variant="demo" size="md" className="h-11" onClick={() => simulate("approved")}>
              Simulate approved (demo)
            </Button>
            <Button variant="demo" size="md" className="h-11" onClick={() => simulate("declined")}>
              Simulate declined (demo)
            </Button>
            <Button variant="ghost" size="md" className="h-11" onClick={() => setState("idle")}>
              Cancel on terminal
            </Button>
          </>
        )}
        {state === "declined" && (
          <Button variant="outline" size="touch" onClick={() => setState("waiting")}>
            <RotateCcw className="size-4" /> Retry on terminal
          </Button>
        )}
      </div>
      <CompleteButton
        label="Complete card sale"
        disabled={state !== "approved"}
        submitting={submitting}
        onClick={() => onComplete({ method: "card", approvalCode: result?.approvalCode, cardLast4: result?.cardLast4 })}
      />
    </div>
  );
}
