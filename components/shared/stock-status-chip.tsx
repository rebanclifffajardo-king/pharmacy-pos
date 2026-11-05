import type { StockStatus } from "@/lib/types";
import { STOCK_STATUS_META } from "@/lib/services/stock";
import { Chip } from "./chip";

export function StockStatusChip({ status, label, className }: { status: StockStatus; label?: string; className?: string }) {
  const meta = STOCK_STATUS_META[status];
  return (
    <Chip tone={meta.tone} dot className={className}>
      {label ?? meta.label}
    </Chip>
  );
}
