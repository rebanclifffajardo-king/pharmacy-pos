"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import type { SaleTransaction } from "@/lib/types";
import { useDb } from "@/lib/store/app-store";
import { actions } from "@/lib/store/actions";
import { buildReceiptLines } from "@/lib/services/receipt-service";
import { ThermalReceipt } from "./thermal-receipt";
import { PrintStatusPanel, usePrintFlow } from "./print-flow";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDateTime, peso } from "@/lib/utils/format";
import { PAYMENT_LABEL } from "@/lib/services/report-service";

/** Print / reprint controls with the animated status panel for a saved sale. */
export function ReceiptPrintControls({ tx, className, compact, autoStart }: { tx: SaleTransaction; className?: string; compact?: boolean; autoStart?: boolean }) {
  const db = useDb();
  const settings = db.settings;
  const flow = usePrintFlow();
  const [simulateFailure, setSimulateFailure] = useState(false);
  const isReprint = tx.printCount > 0;

  const print = async () => {
    const reprint = tx.printCount > 0;
    const lines = buildReceiptLines(tx, settings, { reprint, copyNo: tx.printCount });
    const res = await flow.run(lines, settings, { simulateFailure });
    if (!res) return;
    if (res.status !== "failed") {
      actions.recordPrint({ transactionId: tx.id, reprint });
      toast.success(res.status === "printed" ? "Receipt printed" : "Print request sent", { description: `${tx.receiptNo} · ${res.status === "printed" ? "confirmed by printer" : "via browser print dialog"}` });
    } else {
      toast.error("Print failed", { description: res.message });
    }
    if (simulateFailure) setSimulateFailure(false);
  };

  // Settings › Printer › "Auto-print after sale": start once when the sale dialog opens.
  const autoStarted = useRef(false);
  const printRef = useRef(print);
  useEffect(() => {
    printRef.current = print;
  });
  useEffect(() => {
    if (!autoStart || autoStarted.current || tx.printCount > 0) return;
    autoStarted.current = true;
    const t = setTimeout(() => void printRef.current(), 400);
    return () => clearTimeout(t);
  }, [autoStart, tx.printCount]);

  const printerLabel = `${settings.printer.model.split("(")[0].trim()} · ${settings.printer.connection === "browser" ? "Browser print" : "ESC/POS bridge"}`;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <PrintStatusPanel phase={flow.phase} outcome={flow.outcome} printerLabel={printerLabel} onRetry={print} className={compact ? "min-h-[210px]" : undefined} />
      <div className="flex flex-wrap gap-2.5">
        <Button onClick={print} disabled={flow.busy} className="h-12 flex-1 basis-36 rounded-xl bg-brand-50 text-[15px] font-semibold text-brand-700 hover:bg-brand-100">
          <Printer className="size-4" aria-hidden />
          {flow.phase === "failed" ? "Retry print" : isReprint ? "Reprint receipt" : "Print receipt"}
        </Button>
      </div>
      <label className="flex min-h-8 items-center gap-2 text-xs font-medium text-ink-500">
        <input type="checkbox" checked={simulateFailure} onChange={(e) => setSimulateFailure(e.target.checked)} className="size-4 accent-[var(--red)]" />
        Demo: simulate paper-out on next print
      </label>
    </div>
  );
}

export function ReceiptPreviewPane({ tx, className, reprint }: { tx: SaleTransaction; className?: string; reprint?: boolean }) {
  const settings = useDb().settings;
  const lines = useMemo(() => buildReceiptLines(tx, settings, { reprint: reprint ?? tx.printCount > 0, copyNo: tx.printCount }), [tx, settings, reprint]);
  return (
    <div className={cn("flex flex-col items-center gap-2.5 bg-[#EEF0F4] px-5 py-7 dark:bg-[#0F1530]", className)}>
      <span className="label-caps">{settings.printer.paperWidthMm}mm receipt preview · {settings.printer.charsPerLine} cols</span>
      <ThermalReceipt lines={lines} settings={settings} />
    </div>
  );
}

/** Dialog used by Sales history and anywhere a saved receipt needs preview / reprint. */
export function ReceiptDialog({ transactionId, open, onOpenChange }: { transactionId: string | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const db = useDb();
  const tx = transactionId ? db.transactions.find((t) => t.id === transactionId) : undefined;
  return (
    <Dialog open={open && !!tx} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-[880px]">
        {tx && (
          <div className="flex flex-wrap">
            <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-4 p-6">
              <div className="flex flex-col gap-1">
                <DialogTitle className="font-heading text-xl font-semibold">Receipt {tx.receiptNo}</DialogTitle>
                <DialogDescription className="text-[13px] text-ink-500">
                  {formatDateTime(tx.createdAt)} · {tx.cashierName} · {PAYMENT_LABEL[tx.payment.method]} · {peso(tx.total)}
                </DialogDescription>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-1 rounded-[14px] bg-canvas p-3.5">
                  <span className="text-xs text-ink-500">Times printed</span>
                  <span className="font-heading text-xl font-bold">{tx.printCount}</span>
                </div>
                <div className="flex flex-col gap-1 rounded-[14px] bg-canvas p-3.5">
                  <span className="text-xs text-ink-500">Status</span>
                  <span className="font-heading text-xl font-bold capitalize">{tx.status.replace("_", " ")}</span>
                </div>
              </div>
              <ReceiptPrintControls tx={tx} compact />
              <p className="text-xs leading-relaxed text-ink-500">Reprints are marked “REPRINT” with the original receipt number and are written to the activity log.</p>
            </div>
            <ReceiptPreviewPane tx={tx} className="flex-[1_1_300px]" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
