import { buildMedicineSeeds } from "../../lib/mock-data/medicines";
const rows = buildMedicineSeeds().map(({ medicine: m }) => ({ sku: m.sku, brand: m.brandName, generic: m.genericName, strength: m.strength, form: m.dosageForm }));
console.log(JSON.stringify(rows));
