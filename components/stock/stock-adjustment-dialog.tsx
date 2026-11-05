"use client";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { StockAdjustmentForm, type AdjustmentInitial } from "./stock-adjustment-form";

export function StockAdjustmentDialog({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (o: boolean) => void; initial?: AdjustmentInitial }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto rounded-2xl p-6 sm:max-w-[620px]">
        <div className="flex flex-col gap-1 pr-8">
          <DialogTitle className="font-heading text-xl font-semibold">Stock adjustment</DialogTitle>
          <DialogDescription className="text-[13px] text-ink-500">Medicine, batch, type, quantity, reason and an authorized approver. Totals update immediately.</DialogDescription>
        </div>
        {open && <StockAdjustmentForm key={JSON.stringify(initial ?? {})} initial={initial} onDone={() => onOpenChange(false)} onCancel={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
