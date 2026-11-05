import type { Medicine, StockStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const TILE: Record<StockStatus, string> = {
  in: "bg-brand-50 text-brand-700",
  low: "bg-warn-bg text-warn",
  out: "bg-danger-bg text-danger",
  expiring: "bg-orange-bg text-orange",
  inactive: "bg-neutral-bg text-neutral",
  expired: "bg-danger-bg text-danger",
};

export function abbrOf(m: Pick<Medicine, "brandName" | "genericName">) {
  const src = m.brandName === "Generic" ? m.genericName : m.brandName;
  return src.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase();
}

/** Two-letter product tile tinted by stock status (design: Inventory table). */
export function MedicineTile({ medicine, status, big }: { medicine: Pick<Medicine, "brandName" | "genericName">; status: StockStatus; big?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center font-heading font-bold",
        big ? "size-14 rounded-[14px] text-base" : "size-9 rounded-[9px] text-xs",
        TILE[status]
      )}
    >
      {abbrOf(medicine)}
    </span>
  );
}
