import Link from "next/link";
import { Camera } from "lucide-react";
import { getMedicineImage, MATCH_LABEL } from "@/lib/mock-data/medicine-images";

/** One-line attribution for a medicine photo (required by CC BY / BY-SA licenses). */
export function PhotoCredit({ sku }: { sku: string }) {
  const img = getMedicineImage(sku);
  if (!img) {
    return (
      <p className="flex items-center gap-1.5 text-[11px] text-ink-400">
        <Camera className="size-3.5 shrink-0" aria-hidden /> Photo pending — no free-licensed photo of this exact product yet.
      </p>
    );
  }
  return (
    <p className="flex items-start gap-1.5 text-[11px] leading-snug text-ink-500">
      <Camera className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>
        {MATCH_LABEL[img.match]} · Photo: {img.author || "Unknown"},{" "}
        <a href={img.licenseUrl || img.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
          {img.license}
        </a>
        , via{" "}
        <a href={img.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
          Wikimedia Commons
        </a>{" "}
        ·{" "}
        <Link href="/image-credits" className="text-brand-700 underline-offset-2 hover:underline">
          All credits
        </Link>
      </span>
    </p>
  );
}
