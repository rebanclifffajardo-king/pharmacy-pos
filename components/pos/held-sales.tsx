"use client";

import { History, Trash2 } from "lucide-react";
import type { DemoDatabase } from "@/lib/types";
import { formatRelative, peso } from "@/lib/utils/format";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function HeldSalesButton({ db, onResume, onDelete }: { db: DemoDatabase; onResume: (id: string) => void; onDelete: (id: string) => void }) {
  const held = db.heldSales;
  return (
    <Popover>
      <PopoverTrigger
        disabled={!held.length}
        className="inline-flex h-[52px] items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        <History className="size-[18px]" aria-hidden />
        Held sales
        <span className="inline-grid h-[22px] min-w-[22px] place-items-center rounded-full bg-brand-50 px-1 text-xs font-bold text-brand-700">{held.length}</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] gap-1 rounded-xl p-2">
        <span className="px-2 pt-1 pb-1 text-xs font-semibold tracking-[0.06em] text-ink-500 uppercase">Held sales · tap to resume</span>
        {held
          .slice()
          .reverse()
          .map((h) => {
            const total = h.lines.reduce((s, l) => s + (db.medicines.find((m) => m.id === l.medicineId)?.sellingPrice ?? 0) * l.packMultiplier * l.qty, 0);
            const items = h.lines.reduce((s, l) => s + l.qty, 0);
            return (
              <div key={h.id} className="flex items-center gap-1 rounded-lg hover:bg-canvas">
                <button type="button" onClick={() => onResume(h.id)} className="flex min-w-0 flex-1 flex-col items-start px-2.5 py-2 text-left">
                  <span className="text-[13px] font-semibold">{h.label}</span>
                  <span className="text-xs text-ink-500">
                    {items} item{items === 1 ? "" : "s"} · {peso(total)} · {formatRelative(h.createdAt)}
                  </span>
                </button>
                <button type="button" onClick={() => onDelete(h.id)} aria-label={`Discard ${h.label}`} className="grid size-9 place-items-center rounded-lg text-red-700 hover:bg-red-50">
                  <Trash2 className="size-4" />
                </button>
              </div>
            );
          })}
      </PopoverContent>
    </Popover>
  );
}
