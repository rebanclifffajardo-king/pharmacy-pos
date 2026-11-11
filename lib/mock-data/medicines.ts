import type { DosageForm, Medicine } from "@/lib/types";

/**
 * 100 representative medicine SKUs commonly encountered in Philippine pharmacies.
 *
 * IMPORTANT: Prices, costs, barcodes, batch numbers and supplier assignments are FICTIONAL
 * sample values for a software demo. They are not verified pharmaceutical, regulatory or
 * pricing information.
 *
 * `profile` controls the seeded stock situation so the demo shows realistic alerts:
 *   ok        healthy stock
 *   low       at or below reorder level (25 SKUs)
 *   out       zero saleable units (9 SKUs + 1 expired-only SKU = 10 out of stock)
 *   exp:<d>   nearest saleable batch expires in <d> days (15 SKUs within 90 days)
 *   expired   only an expired, quarantined batch on hand
 *   inactive  archived SKU
 */
export type StockProfile = "ok" | "low" | "out" | "expired" | "inactive" | `exp:${number}`;

type Row = [
  brand: string,
  generic: string,
  strength: string,
  form: DosageForm,
  category: string,
  price: number,
  cost: number,
  packSize: number,
  stripSize: number,
  minStock: number,
  rx: 0 | 1,
  supplier: string,
  manufacturer: string,
  profile: StockProfile,
];

// prettier-ignore
const ROWS: Row[] = [
  // Pain & Fever
  ["Biogesic", "Paracetamol", "500 mg", "Tablet", "cat_pain", 5.5, 3.9, 100, 10, 200, 0, "sup_lm", "Unilab", "ok"],
  ["Advil", "Ibuprofen", "200 mg", "Softgel", "cat_pain", 9.75, 7.1, 100, 10, 100, 0, "sup_bo", "Pfizer", "ok"],
  ["Dolfenal", "Mefenamic Acid", "500 mg", "Tablet", "cat_pain", 18, 13.2, 100, 10, 80, 1, "sup_mr", "United American", "ok"],
  ["Alaxan FR", "Ibuprofen + Paracetamol", "200/325 mg", "Capsule", "cat_pain", 9, 6.5, 100, 10, 150, 0, "sup_lm", "Unilab", "ok"],
  ["Medicol Advance", "Ibuprofen", "400 mg", "Softgel", "cat_pain", 8.5, 6.1, 100, 10, 80, 0, "sup_lm", "Unilab", "out"],
  ["Tempra", "Paracetamol", "120 mg/5 mL · 60 mL", "Syrup", "cat_pain", 98, 72, 12, 0, 12, 0, "sup_pg", "Taisho", "exp:71"],
  ["Generic", "Paracetamol", "500 mg", "Tablet", "cat_pain", 1.5, 0.9, 100, 10, 300, 0, "sup_pg", "Pacific Generics", "ok"],
  ["Generic", "Mefenamic Acid", "500 mg", "Capsule", "cat_pain", 2.5, 1.4, 100, 10, 150, 1, "sup_pg", "Pacific Generics", "exp:9"],
  ["Flanax", "Naproxen Sodium", "550 mg", "Tablet", "cat_pain", 22, 16.5, 100, 10, 60, 0, "sup_bo", "Bayer", "low"],
  ["Rexidol", "Paracetamol + Caffeine", "500/65 mg", "Tablet", "cat_pain", 6.25, 4.4, 100, 10, 100, 0, "sup_lm", "Unilab", "ok"],

  // Cold & Flu
  ["Bioflu", "Phenylephrine + Chlorphenamine + Paracetamol", "10/2/500 mg", "Tablet", "cat_cold", 8.25, 6.1, 100, 10, 60, 0, "sup_lm", "Unilab", "low"],
  ["Neozep Z+ Forte", "Phenylephrine + Chlorphenamine + Paracetamol + Zinc", "10/2/325/10 mg", "Tablet", "cat_cold", 6.75, 4.9, 100, 10, 100, 0, "sup_lm", "Unilab", "ok"],
  ["Decolgen Forte", "Phenylpropanolamine + Chlorphenamine + Paracetamol", "25/2/500 mg", "Tablet", "cat_cold", 7, 5, 100, 10, 100, 0, "sup_lm", "Unilab", "ok"],
  ["Sinutab", "Phenylephrine + Paracetamol", "5/500 mg", "Tablet", "cat_cold", 12.5, 9.1, 100, 10, 60, 0, "sup_bo", "J&J", "low"],
  ["Tuseran Forte", "Dextromethorphan + Phenylpropanolamine + Paracetamol", "15/25/325 mg", "Capsule", "cat_cold", 9.5, 6.9, 100, 10, 80, 0, "sup_lm", "Unilab", "ok"],
  ["Disudrin", "Phenylephrine + Chlorphenamine", "5/1 mg per 5 mL · 60 mL", "Syrup", "cat_cold", 125, 92, 12, 0, 10, 0, "sup_lm", "Unilab", "ok"],
  ["Generic", "Phenylephrine + Chlorphenamine + Paracetamol", "10/2/500 mg", "Tablet", "cat_cold", 3, 1.8, 100, 10, 100, 0, "sup_pg", "Pacific Generics", "ok"],

  // Cough
  ["Solmux", "Carbocisteine", "500 mg", "Capsule", "cat_cough", 11.5, 8.4, 100, 10, 100, 0, "sup_lm", "Unilab", "ok"],
  ["Mucosolvan", "Ambroxol", "30 mg", "Tablet", "cat_cough", 14, 10.2, 100, 10, 60, 0, "sup_mr", "Boehringer", "low"],
  ["Ascof Lagundi", "Vitex negundo L. leaf", "600 mg", "Tablet", "cat_cough", 7.25, 5.1, 100, 10, 80, 0, "sup_vp", "Pascual Lab", "expired"],
  ["Ascof Lagundi", "Vitex negundo L. leaf", "300 mg/5 mL · 60 mL", "Syrup", "cat_cough", 112, 82, 12, 0, 8, 0, "sup_vp", "Pascual Lab", "exp:47"],
  ["Generic", "Carbocisteine", "500 mg", "Capsule", "cat_cough", 3.25, 2, 100, 10, 120, 0, "sup_pg", "Pacific Generics", "ok"],
  ["Generic", "Ambroxol", "30 mg", "Tablet", "cat_cough", 2, 1.2, 100, 10, 120, 0, "sup_pg", "Pacific Generics", "low"],
  ["Solmux Pediatric", "Carbocisteine", "200 mg/5 mL · 60 mL", "Suspension", "cat_cough", 145, 106, 12, 0, 10, 0, "sup_lm", "Unilab", "ok"],
  ["Strepsils", "Amylmetacresol + Dichlorobenzyl Alcohol", "Honey & Lemon", "Lozenge", "cat_cough", 10, 7.2, 96, 8, 64, 0, "sup_bo", "Reckitt", "exp:82"],

  // Allergy
  ["Allerta", "Loratadine", "10 mg", "Tablet", "cat_allergy", 15, 10.9, 100, 10, 80, 0, "sup_lm", "Unilab", "ok"],
  ["Claritin", "Loratadine", "10 mg", "Tablet", "cat_allergy", 38, 28.4, 100, 10, 40, 0, "sup_pg", "Bayer", "out"],
  ["Zyrtec", "Cetirizine", "10 mg", "Tablet", "cat_allergy", 42, 31, 100, 10, 40, 0, "sup_mr", "UCB", "out"],
  ["Generic", "Cetirizine", "10 mg", "Tablet", "cat_allergy", 3.5, 2.1, 100, 10, 150, 0, "sup_pg", "Pacific Generics", "ok"],
  ["Generic", "Loratadine", "10 mg", "Tablet", "cat_allergy", 4, 2.4, 100, 10, 120, 0, "sup_pg", "Pacific Generics", "low"],
  ["Benadryl", "Diphenhydramine", "12.5 mg/5 mL · 60 mL", "Syrup", "cat_allergy", 165, 120, 12, 0, 8, 0, "sup_bo", "J&J", "ok"],
  ["Iterax", "Hydroxyzine", "25 mg", "Tablet", "cat_allergy", 24, 17.5, 100, 10, 40, 1, "sup_mr", "UCB", "low"],
  ["Generic", "Cetirizine", "5 mg/5 mL · 60 mL", "Syrup", "cat_allergy", 68, 48, 12, 0, 10, 0, "sup_pg", "Pacific Generics", "exp:76"],

  // Digestive
  ["Diatabs", "Loperamide", "2 mg", "Capsule", "cat_digestive", 7.5, 5.2, 100, 10, 60, 0, "sup_lm", "Unilab", "exp:24"],
  ["Kremil-S", "Aluminum Hydroxide + Magnesium Hydroxide + Simeticone", "178/233/30 mg", "Tablet", "cat_digestive", 9.5, 6.9, 100, 10, 80, 0, "sup_lm", "Unilab", "ok"],
  ["Gaviscon Double Action", "Sodium Alginate + Sodium Bicarbonate + Calcium Carbonate", "10 mL", "Sachet", "cat_digestive", 32, 23.5, 24, 0, 48, 0, "sup_bo", "Reckitt", "low"],
  ["Hydrite", "Oral Rehydration Salts", "4.1 g", "Sachet", "cat_digestive", 12, 8.1, 50, 0, 40, 0, "sup_lm", "Unilab", "exp:86"],
  ["Buscopan", "Hyoscine N-butylbromide", "10 mg", "Tablet", "cat_digestive", 18.5, 13.6, 100, 10, 60, 0, "sup_mr", "Sanofi", "ok"],
  ["Generic", "Omeprazole", "20 mg", "Capsule", "cat_digestive", 6.5, 4.2, 100, 10, 100, 1, "sup_pg", "Pacific Generics", "ok"],
  ["Erceflora", "Bacillus clausii", "2 billion/5 mL", "Suspension", "cat_digestive", 42, 31, 20, 0, 20, 0, "sup_mr", "Sanofi", "exp:35"],
  ["Dulcolax", "Bisacodyl", "5 mg", "Tablet", "cat_digestive", 9, 6.4, 100, 10, 40, 0, "sup_mr", "Sanofi", "ok"],
  ["Generic", "Famotidine", "20 mg", "Tablet", "cat_digestive", 3.5, 2.2, 100, 10, 60, 1, "sup_pg", "Pacific Generics", "ok"],

  // Vitamins
  ["Ceelin", "Ascorbic Acid", "100 mg/5 mL · 120 mL", "Syrup", "cat_vitamins", 165, 121, 12, 0, 30, 0, "sup_lm", "Unilab", "low"],
  ["Generic", "Ascorbic Acid", "500 mg", "Tablet", "cat_vitamins", 3, 1.8, 100, 10, 200, 0, "sup_pg", "Pacific Generics", "ok"],
  ["Enervon", "Multivitamins + Minerals", "1 tablet", "Tablet", "cat_vitamins", 7.5, 5.4, 100, 10, 100, 0, "sup_lm", "Unilab", "ok"],
  ["Neurobion", "Vitamin B1 + B6 + B12", "100/200/0.2 mg", "Tablet", "cat_vitamins", 32, 23, 100, 10, 60, 0, "sup_mr", "Merck", "exp:88"],
  ["Centrum Advance", "Multivitamins + Minerals", "1 tablet", "Tablet", "cat_vitamins", 14.5, 10.8, 100, 10, 60, 0, "sup_bo", "Haleon", "ok"],
  ["Fern-C", "Sodium Ascorbate + Zinc", "568.18 mg", "Capsule", "cat_vitamins", 9, 6.5, 100, 10, 100, 0, "sup_bo", "Fern", "low"],
  ["Myra E", "Vitamin E", "400 IU", "Softgel", "cat_vitamins", 12, 8.7, 100, 10, 60, 0, "sup_lm", "Unilab", "ok"],
  ["Conzace", "Multivitamins + Zinc", "1 capsule", "Capsule", "cat_vitamins", 11, 8, 100, 10, 60, 0, "sup_lm", "Unilab", "ok"],
  ["Ceelin", "Ascorbic Acid", "100 mg/mL · 15 mL", "Drops", "cat_vitamins", 118, 86, 12, 0, 8, 0, "sup_lm", "Unilab", "exp:27"],
  ["Generic", "Ferrous Sulfate + Folic Acid", "325/1 mg", "Tablet", "cat_vitamins", 2.25, 1.4, 100, 10, 100, 0, "sup_pg", "Pacific Generics", "ok"],

  // Hypertension
  ["Norvasc", "Amlodipine", "5 mg", "Tablet", "cat_hypertension", 48, 36.2, 30, 10, 60, 1, "sup_mr", "Viatris", "low"],
  ["Cozaar", "Losartan", "50 mg", "Tablet", "cat_hypertension", 52, 39.5, 30, 10, 80, 1, "sup_mr", "Organon", "exp:41"],
  ["Generic", "Amlodipine", "5 mg", "Tablet", "cat_hypertension", 4.5, 2.7, 100, 10, 150, 1, "sup_pg", "Pacific Generics", "out"],
  ["Generic", "Amlodipine", "10 mg", "Tablet", "cat_hypertension", 6, 3.8, 100, 10, 150, 1, "sup_pg", "Pacific Generics", "ok"],
  ["Generic", "Losartan", "50 mg", "Tablet", "cat_hypertension", 7.5, 4.8, 100, 10, 150, 1, "sup_pg", "Pacific Generics", "ok"],
  ["Generic", "Losartan", "100 mg", "Tablet", "cat_hypertension", 11, 7.4, 100, 10, 80, 1, "sup_pg", "Pacific Generics", "low"],
  ["Generic", "Metoprolol", "50 mg", "Tablet", "cat_hypertension", 3.5, 2.2, 100, 10, 100, 1, "sup_st", "Southern Tagalog Pharma", "ok"],
  ["Concor", "Bisoprolol", "5 mg", "Tablet", "cat_hypertension", 26, 19.4, 30, 10, 40, 1, "sup_mr", "Merck", "low"],
  ["Generic", "Hydrochlorothiazide", "25 mg", "Tablet", "cat_hypertension", 2.5, 1.5, 100, 10, 100, 1, "sup_pg", "Pacific Generics", "ok"],
  ["Generic", "Captopril", "25 mg", "Tablet", "cat_hypertension", 3, 1.8, 100, 10, 80, 1, "sup_st", "Southern Tagalog Pharma", "low"],

  // Diabetes
  ["Glucophage", "Metformin", "500 mg", "Tablet", "cat_diabetes", 9, 6.4, 100, 10, 150, 1, "sup_mr", "Merck", "ok"],
  ["Generic", "Metformin", "500 mg", "Tablet", "cat_diabetes", 2.75, 1.7, 100, 10, 200, 1, "sup_pg", "Pacific Generics", "ok"],
  ["Generic", "Gliclazide", "80 mg", "Tablet", "cat_diabetes", 4.5, 2.9, 100, 10, 100, 1, "sup_pg", "Pacific Generics", "low"],
  ["Diamicron MR", "Gliclazide", "60 mg", "Tablet", "cat_diabetes", 28, 20.8, 30, 10, 40, 1, "sup_mr", "Servier", "ok"],
  ["Galvus", "Vildagliptin", "50 mg", "Tablet", "cat_diabetes", 38, 28.5, 28, 14, 28, 1, "sup_mr", "Novartis", "out"],
  ["Generic", "Glimepiride", "2 mg", "Tablet", "cat_diabetes", 5, 3.2, 100, 10, 80, 1, "sup_pg", "Pacific Generics", "low"],
  ["Accu-Chek Instant", "Blood Glucose Test Strips", "50 strips", "Device", "cat_diabetes", 1450, 1100, 10, 0, 4, 0, "sup_np", "Roche", "low"],

  // Cholesterol
  ["Lipitor", "Atorvastatin", "20 mg", "Tablet", "cat_cholesterol", 68, 51, 30, 10, 40, 1, "sup_mr", "Viatris", "ok"],
  ["Generic", "Atorvastatin", "20 mg", "Tablet", "cat_cholesterol", 8.5, 5.6, 100, 10, 150, 1, "sup_pg", "Pacific Generics", "ok"],
  ["Generic", "Atorvastatin", "40 mg", "Tablet", "cat_cholesterol", 12, 7.9, 100, 10, 80, 1, "sup_pg", "Pacific Generics", "low"],
  ["Crestor", "Rosuvastatin", "10 mg", "Tablet", "cat_cholesterol", 58, 43.5, 28, 14, 28, 1, "sup_mr", "AstraZeneca", "out"],
  ["Generic", "Rosuvastatin", "10 mg", "Tablet", "cat_cholesterol", 9.5, 6.3, 100, 10, 100, 1, "sup_pg", "Pacific Generics", "ok"],
  ["Generic", "Simvastatin", "20 mg", "Tablet", "cat_cholesterol", 5.5, 3.5, 100, 10, 80, 1, "sup_st", "Southern Tagalog Pharma", "ok"],
  ["Generic", "Fenofibrate", "200 mg", "Capsule", "cat_cholesterol", 14, 9.8, 100, 10, 40, 1, "sup_st", "Southern Tagalog Pharma", "low"],

  // Antibiotics
  ["Amoxil", "Amoxicillin", "500 mg", "Capsule", "cat_antibiotics", 14, 10.3, 100, 10, 100, 1, "sup_mr", "GSK", "low"],
  ["Generic", "Amoxicillin", "500 mg", "Capsule", "cat_antibiotics", 5, 3.1, 100, 10, 200, 1, "sup_pg", "Pacific Generics", "ok"],
  ["Augmentin", "Co-amoxiclav", "625 mg", "Tablet", "cat_antibiotics", 92, 71, 14, 7, 28, 1, "sup_mr", "GSK", "out"],
  ["Generic", "Cefalexin", "500 mg", "Capsule", "cat_antibiotics", 9.5, 6.8, 100, 10, 60, 1, "sup_mr", "Metro Rx Generics", "exp:16"],
  ["Generic", "Azithromycin", "500 mg", "Tablet", "cat_antibiotics", 48, 34, 30, 3, 30, 1, "sup_st", "Southern Tagalog Pharma", "ok"],
  ["Generic", "Ciprofloxacin", "500 mg", "Tablet", "cat_antibiotics", 9, 6.1, 100, 10, 60, 1, "sup_st", "Southern Tagalog Pharma", "low"],
  ["Generic", "Cefuroxime", "500 mg", "Tablet", "cat_antibiotics", 38, 27.5, 30, 10, 30, 1, "sup_st", "Southern Tagalog Pharma", "out"],
  ["Generic", "Amoxicillin", "250 mg/5 mL · 60 mL", "Suspension", "cat_antibiotics", 85, 58, 12, 0, 10, 1, "sup_pg", "Pacific Generics", "exp:58"],
  ["Generic", "Doxycycline", "100 mg", "Capsule", "cat_antibiotics", 7, 4.6, 100, 10, 60, 1, "sup_st", "Southern Tagalog Pharma", "ok"],

  // Respiratory
  ["Ventolin", "Salbutamol", "100 mcg · 200 doses", "Inhaler", "cat_respiratory", 455, 352, 6, 0, 10, 1, "sup_st", "GSK", "low"],
  ["Generic", "Salbutamol", "2 mg", "Tablet", "cat_respiratory", 2.5, 1.6, 100, 10, 100, 1, "sup_pg", "Pacific Generics", "exp:53"],
  ["Ventolin Nebules", "Salbutamol", "2.5 mg/2.5 mL", "Nebule", "cat_respiratory", 28, 20.5, 20, 0, 40, 1, "sup_st", "GSK", "ok"],
  ["Seretide", "Salmeterol + Fluticasone", "25/250 mcg · 120 doses", "Inhaler", "cat_respiratory", 1450, 1120, 6, 0, 3, 1, "sup_st", "GSK", "out"],
  ["Generic", "Montelukast", "10 mg", "Tablet", "cat_respiratory", 18, 12.5, 30, 10, 30, 1, "sup_st", "Southern Tagalog Pharma", "low"],
  ["Duavent", "Ipratropium + Salbutamol", "0.5/2.5 mg", "Nebule", "cat_respiratory", 42, 31, 20, 0, 30, 1, "sup_st", "Unilab", "ok"],
  ["Generic", "Salbutamol", "2 mg/5 mL · 60 mL", "Syrup", "cat_respiratory", 55, 38, 12, 0, 10, 1, "sup_pg", "Pacific Generics", "ok"],

  // First Aid
  ["Betadine", "Povidone-Iodine", "10% · 60 mL", "Solution", "cat_firstaid", 128, 94, 12, 0, 12, 0, "sup_mh", "Mundipharma", "ok"],
  ["Bactroban", "Mupirocin", "2% · 15 g", "Ointment", "cat_firstaid", 385, 290, 6, 0, 6, 1, "sup_pg", "GSK", "exp:63"],
  ["Generic", "Isopropyl Alcohol", "70% · 500 mL", "Solution", "cat_firstaid", 85, 62, 12, 0, 24, 0, "sup_mh", "Mindanao Health Trading", "low"],
  ["Band-Aid", "Adhesive Bandages", "Pack of 10", "Device", "cat_firstaid", 45, 32, 24, 0, 24, 0, "sup_mh", "J&J", "ok"],
  ["Generic", "Hydrogen Peroxide", "3% · 120 mL", "Solution", "cat_firstaid", 35, 24, 12, 0, 12, 0, "sup_mh", "Mindanao Health Trading", "ok"],
  ["Katinko", "Menthol + Camphor + Methyl Salicylate", "10 g", "Ointment", "cat_firstaid", 42, 30, 12, 0, 24, 0, "sup_vp", "Greenstone", "ok"],
  ["Generic", "Ibuprofen", "400 mg", "Tablet", "cat_pain", 4.25, 3, 100, 10, 100, 0, "sup_pg", "Pacific Generics", "inactive"],
  ["Generic", "Silver Sulfadiazine", "1% · 20 g", "Cream", "cat_firstaid", 165, 118, 6, 0, 6, 1, "sup_mh", "Mindanao Health Trading", "low"],
];

const UNIT_BY_FORM: Record<DosageForm, string> = {
  Tablet: "tab",
  Capsule: "cap",
  Softgel: "cap",
  Syrup: "bottle",
  Suspension: "bottle",
  Drops: "bottle",
  Sachet: "sachet",
  Inhaler: "inhaler",
  Nebule: "nebule",
  Solution: "bottle",
  Ointment: "tube",
  Cream: "tube",
  Lozenge: "lozenge",
  Spray: "bottle",
  Device: "pack",
};

export function unitForForm(form: DosageForm): string {
  return UNIT_BY_FORM[form] ?? "pc";
}

export function packagingFor(form: DosageForm, packSize: number, stripSize: number): string {
  if (stripSize > 0) return `Box of ${packSize} (${packSize / stripSize} × ${stripSize})`;
  if (form === "Sachet") return `Box of ${packSize} sachets`;
  if (form === "Nebule") return `Box of ${packSize} nebules`;
  if (form === "Device") return `Case of ${packSize}`;
  return `Case of ${packSize} · sold per ${unitForForm(form)}`;
}

/** EAN-13 style demo barcode: "20000000" + 4-digit id + check digit. */
export function demoBarcode(n: number): string {
  const body = "20000000" + String(n).padStart(4, "0");
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(body[i]) * (i % 2 === 0 ? 1 : 3);
  return body + ((10 - (sum % 10)) % 10);
}

export interface MedicineSeed {
  medicine: Omit<Medicine, "createdAt" | "updatedAt">;
  profile: StockProfile;
}

export function buildMedicineSeeds(): MedicineSeed[] {
  return ROWS.map((r, i) => {
    const n = i + 1;
    const [brand, generic, strength, form, categoryId, price, cost, packSize, stripSize, minStock, rx, supplierId, manufacturer, profile] = r;
    const aisle = "ABCDE"[i % 5];
    return {
      profile,
      medicine: {
        id: `med_${String(n).padStart(3, "0")}`,
        sku: `YM-${1000 + n}`,
        barcode: demoBarcode(n),
        brandName: brand,
        genericName: generic,
        categoryId,
        dosageForm: form,
        strength,
        packaging: packagingFor(form, packSize, stripSize),
        unit: unitForForm(form),
        packSize,
        stripSize: stripSize || undefined,
        costPrice: cost,
        sellingPrice: price,
        minStock,
        reorderQty: Math.max(packSize, minStock * 2),
        supplierId,
        manufacturer,
        rxRequired: rx === 1,
        status: profile === "inactive" ? "inactive" : "active",
        location: rx ? `Rx ${aisle}-${(i % 6) + 1}` : `Shelf ${aisle}-${(i % 6) + 1}`,
      },
    };
  });
}

export const MEDICINE_COUNT = ROWS.length;
