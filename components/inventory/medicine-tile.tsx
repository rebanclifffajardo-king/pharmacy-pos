import type { Medicine, StockStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getMedicineImage } from "@/lib/mock-data/medicine-images";
import { MedicineImage } from "@/components/shared/medicine-image";

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

/** Product photo, or the two-letter tile tinted by stock status when no photo exists (design: Inventory table). */
export function MedicineTile({ medicine, status, big }: { medicine: Pick<Medicine, "sku" | "brandName" | "genericName" | "strength" | "dosageForm" | "imageDataUrl">; status: StockStatus; big?: boolean }) {
  if (medicine.imageDataUrl || getMedicineImage(medicine.sku)) {
    return <MedicineImage medicine={medicine} size={big ? 96 : 40} fit={big ? "contain" : "cover"} dim={status === "inactive"} />;
  }
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
