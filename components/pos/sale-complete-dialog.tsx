"use client";

import { Check, CircleCheck } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { SaleTransaction } from "@/lib/types";
import { peso } from "@/lib/utils/format";
import { useAppStore } from "@/lib/store/app-store";
import { ReceiptPreviewPane, ReceiptPrintControls } from "@/components/receipts/receipt-print-panel";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const METHOD = { cash: "Cash", qrph: "QR Ph (simulated)", card: "Card (simulated)" } as const;

export function SaleCompleteDialog({ tx: snapshot, open, onNewSale }: { tx: SaleTransaction | null; open: boolean; onNewSale: () => void }) {
  const reduce = useReducedMotion();
  // Read the live record so print counts / reprint labels stay current.
  const live = useAppStore((s) => (snapshot ? s.db?.transactions.find((t) => t.id === snapshot.id) : undefined));
  const tx = live ?? snapshot;
  const autoPrint = useAppStore((s) => !!s.db?.settings.printer.autoPrintAfterSale);
  if (!tx) return null;
  const p = tx.payment;
  const second =
    p.method === "cash"
      ? { label: "Change due", value: peso(p.change ?? 0) }
      : p.method === "qrph"
        ? { label: "Provider ref", value: p.reference ?? "—" }
        : { label: "Approval ref", value: p.approvalCode ?? "—" };
  const batches = tx.lines.flatMap((l) => l.allocations.map((a) => `${a.batchNo} (−${a.qty})`));
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onNewSale()}>
      <DialogContent showCloseButton={false} className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto rounded-[22px] p-0 sm:max-w-[900px]">
        <div className="flex flex-wrap">
          <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-[18px] p-7">
            <div className="flex items-center gap-4">
              <motion.span
                initial={reduce ? false : { scale: 0.6, opacity: 0 }}
                animate={{ scale: [0.6, 1.08, 1], opacity: 1 }}
                transition={{ duration: 0.38, ease: [0.2, 0.8, 0.2, 1] }}
                className="grid size-16 shrink-0 place-items-center rounded-full bg-ok-bg text-ok-dot"
              >
                <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12.5l4.5 4.5L19 7.5" className="animate-draw" style={{ strokeDasharray: 40 }} />
                </svg>
              </motion.span>
              <div className="flex flex-col gap-0.5">
                <DialogTitle className="font-heading text-[22px] font-semibold">Payment successful</DialogTitle>
                <DialogDescription className="font-mono text-[13px] font-medium text-ink-500">
                  {tx.receiptNo} · {METHOD[p.method]}
                </DialogDescription>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-1 rounded-[14px] bg-canvas p-3.5">
                <span className="text-xs font-medium text-ink-500">Total paid</span>
                <span className="font-heading text-[22px] font-bold tabular">{peso(tx.total)}</span>
              </div>
              <div className="flex min-w-0 flex-col gap-1 rounded-[14px] bg-canvas p-3.5">
                <span className="text-xs font-medium text-ink-500">{second.label}</span>
                <span className="truncate font-heading text-[22px] font-bold tabular" title={second.value}>
                  {second.value}
                </span>
              </div>
            </div>
            <ul className="flex flex-col gap-1.5 text-[13px] font-medium text-ok">
              <li className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0" aria-hidden /> Sale finalized once (idempotency key {tx.idempotencyKey.slice(0, 14)}…)
              </li>
              <li className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>Stock deducted from FEFO batches{batches.length ? `: ${batches.slice(0, 4).join(", ")}${batches.length > 4 ? "…" : ""}` : ""}</span>
              </li>
              <li className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0" aria-hidden /> Receipt record created · dashboard and sales history updated
              </li>
              {p.simulated && p.method !== "cash" && (
                <li className="flex gap-2 text-warn">
                  <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden /> Demo payment — no money was collected
                </li>
              )}
            </ul>

            <ReceiptPrintControls tx={tx} autoStart={autoPrint} />
            <Button variant="brand" size="touch" onClick={onNewSale} className="w-full">
              New sale
            </Button>
          </div>
          <ReceiptPreviewPane tx={tx} className="flex-[1_1_300px]" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
