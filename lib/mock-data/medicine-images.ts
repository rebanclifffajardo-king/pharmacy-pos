import data from "./medicine-images.json";

/**
 * Product photos for the demo catalog, keyed by SKU.
 *
 * Two kinds of images, all stored under /public/medicines and credited on the Image
 * Credits page:
 *   kind "commons"  free-licensed photo from Wikimedia Commons (PD, CC0, CC BY, CC BY-SA)
 *   kind "retail"   manufacturer / retailer product image — copyright of its owner,
 *                   used for this demonstration with the project owner's approval;
 *                   obtain permission before commercial or public production use.
 *
 *   match "exact"   same brand and strength
 *   match "brand"   same brand, different strength or market pack
 *   match "generic" representative photo of the same active ingredient and dosage form
 *
 * Regenerate with: npx tsx scripts/medicine-images/build.ts
 */
export interface MedicineImageCredit {
  kind: "commons" | "retail";
  sku: string;
  file: string;
  match: "exact" | "brand" | "generic";
  commonsTitle: string;
  author: string;
  license: string;
  licenseUrl: string | null;
  sourceUrl: string;
  note: string;
  /** retail only: brand owner / manufacturer and the site the image came from. */
  owner?: string;
  sourceName?: string;
}

export const MEDICINE_IMAGES = data as unknown as Record<string, MedicineImageCredit>;

export function getMedicineImage(sku: string): MedicineImageCredit | undefined {
  return MEDICINE_IMAGES[sku];
}

export const MATCH_LABEL: Record<MedicineImageCredit["match"], string> = {
  exact: "Actual product",
  brand: "Same brand · pack may differ",
  generic: "Generic · same ingredient & form",
};
