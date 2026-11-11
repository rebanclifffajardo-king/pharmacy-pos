import data from "./medicine-images.json";

/**
 * Product photos for the demo catalog, keyed by SKU.
 *
 * Every image is a free-licensed photograph from Wikimedia Commons (public domain,
 * CC0, CC BY or CC BY-SA), stored under /public/medicines and credited on the
 * Image Credits page as the licenses require. Medicines without an accurate
 * free-licensed photo intentionally show a "Photo pending" placeholder.
 *
 *   match "exact"   same brand and strength
 *   match "brand"   same brand, different strength or market pack
 *   match "generic" representative photo of the same active ingredient and dosage form
 *
 * Regenerate with: npx tsx scripts/medicine-images/build.ts
 */
export interface MedicineImageCredit {
  sku: string;
  file: string;
  match: "exact" | "brand" | "generic";
  commonsTitle: string;
  author: string;
  license: string;
  licenseUrl: string | null;
  sourceUrl: string;
  note: string;
}

export const MEDICINE_IMAGES = data as unknown as Record<string, MedicineImageCredit>;

export function getMedicineImage(sku: string): MedicineImageCredit | undefined {
  return MEDICINE_IMAGES[sku];
}

export const MATCH_LABEL: Record<MedicineImageCredit["match"], string> = {
  exact: "Actual product",
  brand: "Same brand · pack may differ",
  generic: "Representative photo of the generic",
};
