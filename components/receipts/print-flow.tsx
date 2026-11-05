"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, CircleDashed, Loader2, Printer, RotateCcw } from "lucide-react";
import type { Settings } from "@/lib/types";
import type { ReceiptLine } from "@/lib/services/receipt-service";
import { resolveDriver, type PrintOutcome } from "@/lib/printing/drivers";
import { ThermalReceipt } from "./thermal-receipt";
import { usePrinter } from "./print-provider";
import { cn } from "@/lib/utils";

export type PrintPhase = "idle" | "preparing" | "printing" | "submitted" | "printed" | "failed";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Drives the honest four-state print animation:
 *   preparing → printing (paper feed while the print request is sent) → submitted | printed | failed
 * "printed" is only reachable through a driver that receives hardware acknowledgement.
 */
export function usePrintFlow() {
  const { printNode } = usePrinter();
  const [phase, setPhase] = useState<PrintPhase>("idle");
  const [outcome, setOutcome] = useState<PrintOutcome | null>(null);
  const running = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async (lines: ReceiptLine[], settings: Settings, opts: { kind?: "receipt" | "test"; simulateFailure?: boolean } = {}): Promise<PrintOutcome | null> => {
      if (running.current) return null;
      running.current = true;
      const fast = prefersReducedMotion();
      const set = (p: PrintPhase) => mounted.current && setPhase(p);
      try {
        setOutcome(null);
        set("preparing");
        await wait(fast ? 50 : 700);
        if (!lines.length) throw new Error("Receipt has no content.");
        set("printing");
        await wait(fast ? 50 : 1500);
        let result: PrintOutcome;
        if (opts.simulateFailure) {
          result = { status: "failed", hardwareConfirmed: false, message: "Simulated: printer out of paper. Load a new 58mm roll and close the cover — the sale is already saved, retrying only reprints." };
        } else {
          const driver = resolveDriver(settings.printer.connection);
          result = await driver.print({
            kind: opts.kind ?? "receipt",
            lines,
            openBrowserDialog: () =>
              printNode("receipt", <ThermalReceipt lines={lines} settings={settings} variant="print" />, { paperWidthMm: settings.printer.paperWidthMm }),
          });
        }
        if (mounted.current) {
          setOutcome(result);
          set(result.status);
        }
        return result;
      } catch (e) {
        const result: PrintOutcome = { status: "failed", hardwareConfirmed: false, message: e instanceof Error ? e.message : "Printing failed." };
        if (mounted.current) {
          setOutcome(result);
          set("failed");
        }
        return result;
      } finally {
        running.current = false;
      }
    },
    [printNode]
  );

  const reset = useCallback(() => {
    if (running.current) return;
    setPhase("idle");
    setOutcome(null);
  }, []);

  return { phase, outcome, run, reset, busy: phase === "preparing" || phase === "printing" };
}

/** Visual panel for the print states (matches the design's printer illustration). */
export function PrintStatusPanel({
  phase,
  outcome,
  printerLabel,
  onRetry,
  className,
}: {
  phase: PrintPhase;
  outcome: PrintOutcome | null;
  printerLabel: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-[250px] flex-col items-center justify-center gap-3 rounded-2xl border border-line p-5 text-center", className)} aria-live="polite">
      {phase === "idle" && (
        <>
          <Printer className="size-10 text-ink-400" strokeWidth={1.6} aria-hidden />
          <span className="text-[15px] font-semibold">{printerLabel}</span>
          <span className="max-w-[300px] text-[13px] text-ink-500">Ready. Printing reads the saved receipt — it never creates a second sale.</span>
        </>
      )}
      {phase === "preparing" && (
        <>
          <span className="relative grid size-16 place-items-center rounded-2xl bg-brand-50 text-brand">
            <Printer className="size-8 animate-pulse-soft" aria-hidden />
            <Loader2 className="absolute -right-1 -bottom-1 size-5 animate-spin rounded-full bg-surface text-brand" aria-hidden />
          </span>
          <span className="text-[15px] font-semibold">Preparing receipt…</span>
          <span className="text-xs text-ink-500">Formatting {printerLabel}</span>
        </>
      )}
      {phase === "printing" && (
        <div className="flex w-[220px] flex-col items-center">
          <div className="relative h-16 w-[220px] rounded-t-2xl rounded-b-[10px] bg-[#1B2140] shadow-[inset_0_-6px_0_#0F1430]">
            <span className="absolute top-3.5 left-4 size-2 animate-pulse-soft rounded-full bg-[#3BD38A]" />
            <span className="absolute top-3 left-[30px] text-[10px] font-bold tracking-[0.1em] text-[#8E97C8]">XPRINTER</span>
            <span className="absolute inset-x-6 bottom-2.5 h-1 rounded-sm bg-[#05081A]" />
          </div>
          <div className="h-[140px] w-[168px] overflow-hidden">
            <div className="flex h-[140px] w-[168px] animate-feed flex-col gap-[5px] border border-t-0 border-line bg-white px-3 py-2.5 shadow-[0_6px_14px_rgba(15,23,51,.12)]">
              <span className="h-1.5 w-3/5 self-center rounded-sm bg-[#0F1733]" />
              <span className="h-1 w-2/5 self-center rounded-sm bg-[#9AA0B8]" />
              <span className="my-0.5 h-px bg-[repeating-linear-gradient(90deg,#9AA0B8_0_3px,transparent_3px_6px)]" />
              <span className="h-1 w-4/5 rounded-sm bg-[#9AA0B8]" />
              <span className="h-1 w-[70%] rounded-sm bg-[#9AA0B8]" />
              <span className="h-1 w-[85%] rounded-sm bg-[#9AA0B8]" />
              <span className="my-0.5 h-px bg-[repeating-linear-gradient(90deg,#9AA0B8_0_3px,transparent_3px_6px)]" />
              <span className="h-1.5 w-1/2 self-end rounded-sm bg-[#0F1733]" />
            </div>
          </div>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-brand-50">
            <div className="h-full animate-grow bg-brand" />
          </div>
          <span className="mt-2 text-sm font-semibold">Printing… opening print dialog</span>
        </div>
      )}
      {(phase === "submitted" || phase === "printed") && (
        <>
          <span className="grid size-14 animate-pop place-items-center rounded-full bg-ok-bg text-ok-dot">
            <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12.5l4.5 4.5L19 7.5" className="animate-draw" style={{ strokeDasharray: 40 }} />
            </svg>
          </span>
          <span className="text-[15px] font-semibold">{phase === "printed" ? "Receipt printed — confirmed by printer" : "Print request submitted"}</span>
          <ul className="flex flex-col gap-1 text-left text-xs text-ink-700">
            <Step done>Receipt prepared (58mm layout)</Step>
            <Step done>{phase === "printed" ? "Sent to ESC/POS bridge" : "Browser print dialog opened"}</Step>
            <Step done>Print request submitted</Step>
            <Step done={phase === "printed"}>
              {phase === "printed" ? "Hardware confirmed completion" : "Hardware completion not confirmed (browser printing can't report it)"}
            </Step>
          </ul>
        </>
      )}
      {phase === "failed" && (
        <>
          <span className="grid size-14 animate-pop place-items-center rounded-full bg-danger-bg text-danger-dot">
            <AlertTriangle className="size-7" aria-hidden />
          </span>
          <span className="text-[15px] font-semibold text-danger">Print failed</span>
          <span className="max-w-[320px] text-[13px] leading-relaxed text-ink-500">{outcome?.message ?? "The printer did not respond."}</span>
          {onRetry && (
            <button type="button" onClick={onRetry} className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-brand-50 px-4 text-[13px] font-semibold text-brand-700">
              <RotateCcw className="size-4" aria-hidden /> Retry
            </button>
          )}
        </>
      )}
    </div>
  );
}

function Step({ done, children }: { done?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      {done ? <Check className="mt-0.5 size-3.5 shrink-0 text-ok-dot" aria-hidden /> : <CircleDashed className="mt-0.5 size-3.5 shrink-0 text-ink-300" aria-hidden />}
      <span className={done ? "" : "text-ink-500"}>{children}</span>
    </li>
  );
}
