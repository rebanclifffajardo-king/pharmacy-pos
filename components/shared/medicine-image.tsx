"use client";

import { useState } from "react";
import { FlaskConical, Pill, Syringe } from "lucide-react";
import type { Medicine } from "@/lib/types";
import { getMedicineImage } from "@/lib/mock-data/medicine-images";
import { cn } from "@/lib/utils";

const PILL_FORMS = new Set(["Tablet", "Capsule", "Softgel", "Lozenge"]);
const BOTTLE_FORMS = new Set(["Syrup", "Suspension", "Drops", "Solution", "Spray"]);

/**
 * Product photo for a medicine (free-licensed, see Image Credits) with a tinted
 * dosage-form placeholder when no accurate photo is available yet.
 */
export function MedicineImage({
  medicine,
  size = 44,
  className,
  fit = "cover",
  showPending,
  dim,
}: {
  medicine: Pick<Medicine, "sku" | "brandName" | "genericName" | "strength" | "dosageForm" | "imageDataUrl">;
  size?: number;
  className?: string;
  fit?: "cover" | "contain";
  /** Show a "Photo pending" caption inside the placeholder (large sizes). */
  showPending?: boolean;
  /** Grey out (archived / blocked items). */
  dim?: boolean;
}) {
  const catalog = getMedicineImage(medicine.sku);
  const src = medicine.imageDataUrl || catalog?.file;
  const [broken, setBroken] = useState(false);
  const radius = size >= 72 ? 16 : size >= 48 ? 12 : 10;
  const alt = `${medicine.brandName === "Generic" ? "Generic " + medicine.genericName : medicine.brandName} ${medicine.strength}`;

  if (src && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        onError={() => setBroken(true)}
        className={cn("shrink-0 border border-line bg-white", fit === "cover" ? "object-cover" : "object-contain p-1", dim && "opacity-60 grayscale", className)}
        style={{ width: size, height: size, borderRadius: radius }}
      />
    );
  }

  const kind = PILL_FORMS.has(medicine.dosageForm) ? "pill" : BOTTLE_FORMS.has(medicine.dosageForm) ? "bottle" : "other";
  const Icon = kind === "pill" ? Pill : kind === "bottle" ? FlaskConical : Syringe;
  return (
    <span
      role="img"
      aria-label={`${alt} — photo pending`}
      title="Photo pending"
      className={cn(
        "flex shrink-0 flex-col items-center justify-center gap-1",
        dim ? "bg-neutral-bg text-ink-300" : kind === "pill" ? "bg-brand-50 text-brand" : kind === "bottle" ? "bg-ok-bg text-ok-dot" : "bg-orange-bg text-orange-dot",
        className
      )}
      style={{ width: size, height: size, borderRadius: radius }}
    >
      <Icon style={{ width: Math.round(size * 0.45), height: Math.round(size * 0.45) }} aria-hidden />
      {showPending && size >= 72 && <span className="text-[10px] font-semibold tracking-[0.04em] uppercase opacity-80">Photo pending</span>}
    </span>
  );
}
