/** Merges result-*.json from the Commons search into lib/mock-data/medicine-images.json. */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(__dirname);
const out: Record<string, unknown> = {};
let found = 0;
let missingFile = 0;
for (let i = 1; i <= 4; i++) {
  const p = join(dir, `result-${i}.json`);
  if (!existsSync(p)) continue;
  for (const r of JSON.parse(readFileSync(p, "utf8")) as { sku: string; file: string | null; match: string | null }[]) {
    if (!r.file || !r.match) continue;
    if (!existsSync(join(dir, "../../public", r.file))) {
      missingFile++;
      continue;
    }
    out[r.sku] = r;
    found++;
  }
}
writeFileSync(join(dir, "../../lib/mock-data/medicine-images.json"), JSON.stringify(out, null, 1) + "\n");
console.log({ found, missingFile });
