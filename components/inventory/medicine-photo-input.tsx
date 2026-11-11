"use client";

import { useRef, useState } from "react";
import { ImagePlus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { DosageForm } from "@/lib/types";
import { getMedicineImage } from "@/lib/mock-data/medicine-images";
import { MedicineImage } from "@/components/shared/medicine-image";
import { Button } from "@/components/ui/button";

const MAX_SIDE = 480;
const MAX_INPUT_BYTES = 10 * 1024 * 1024;

/** Reads an image file, scales it to ≤480 px and returns a compact JPEG data URL. */
async function toResizedDataUrl(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp|gif|heic|heif)$/.test(file.type) && !file.type.startsWith("image/")) throw new Error("Choose an image file (JPEG, PNG or WebP).");
  if (file.size > MAX_INPUT_BYTES) throw new Error("That file is over 10 MB. Choose a smaller photo.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("This image format can't be read by the browser. Try a JPEG or PNG."));
      i.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process the image.");
    ctx.fillStyle = "#ffffff"; // flatten transparent PNGs onto white
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Photo field for Add / Edit medicine.
 * `value`: undefined = unchanged, "" = remove uploaded photo, data URL = new photo.
 */
export function MedicinePhotoInput({
  sku,
  current,
  value,
  onChange,
  preview,
}: {
  sku: string;
  /** Photo already saved on the record (edit). */
  current?: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  preview: { brandName: string; genericName: string; strength: string; dosageForm: DosageForm };
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const effective = value === undefined ? current : value || undefined;
  const catalog = sku ? getMedicineImage(sku) : undefined;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const data = await toResizedDataUrl(file);
      onChange(data);
      toast.success("Photo ready", { description: `Resized to ${MAX_SIDE}px · saved when you click Save.` });
    } catch (e) {
      toast.error("Photo not added", { description: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-dashed border-line-strong bg-surface-2 p-3">
      <MedicineImage medicine={{ sku: sku || "__new__", imageDataUrl: effective, ...preview }} size={96} fit="contain" showPending />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="text-xs font-semibold text-ink-700">Product photo</span>
        <span className="text-xs text-ink-500">
          {effective
            ? "Uploaded photo — shown on the POS, inventory and receipts preview."
            : catalog
              ? "Using the catalog photo. Upload to replace it with your own shelf photo."
              : "No photo yet. A clear photo of the pack on a plain background works best."}
        </span>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/*"
            capture="environment"
            className="sr-only"
            aria-label="Upload product photo"
            onChange={(e) => void pick(e.target.files?.[0])}
          />
          <Button type="button" variant="soft" size="md" disabled={busy} onClick={() => fileRef.current?.click()}>
            <ImagePlus className="size-4" aria-hidden />
            {busy ? "Processing…" : effective ? "Replace photo" : "Upload photo"}
          </Button>
          {effective && (
            <Button type="button" variant="ghost" size="md" className="text-red-700 hover:bg-red-50 hover:text-red-700" onClick={() => onChange(current ? "" : undefined)}>
              <Trash2 className="size-4" aria-hidden /> Remove
            </Button>
          )}
          {value !== undefined && current !== undefined && (
            <Button type="button" variant="ghost" size="md" onClick={() => onChange(undefined)}>
              <RotateCcw className="size-4" aria-hidden /> Undo
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
