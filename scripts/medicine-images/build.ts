/**
 * Merges image search results into lib/mock-data/medicine-images.json.
 *   result-*.json         Wikimedia Commons (free-licensed)   → kind "commons"
 *   round2-result-*.json  manufacturer / retailer images       → kind "retail"
 * Commons entries win when a SKU appears in both.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(__dirname);
const out: Record<string, Record<string, unknown>> = {};
const counts = { commons: 0, retail: 0, missingFile: 0 };
const load = (name: string) => (existsSync(join(dir, name)) ? (JSON.parse(readFileSync(join(dir, name), "utf8")) as Record<string, unknown>[]) : []);

for (const kind of ["commons", "retail"] as const) {
  for (let i = 1; i <= 4; i++) {
    for (const r of load(kind === "commons" ? `result-${i}.json` : `round2-result-${i}.json`)) {
      const sku = r.sku as string;
      if (!r.file || !r.match || out[sku]) continue;
      if (!existsSync(join(dir, "../../public", r.file as string))) {
        counts.missingFile++;
        continue;
      }
      out[sku] =
        kind === "commons"
          ? { kind, ...r }
          : {
              kind,
              sku,
              file: r.file,
              match: r.match,
              commonsTitle: "",
              author: (r.owner as string) || "",
              license: "© " + ((r.owner as string) || "owner"),
              licenseUrl: null,
              sourceUrl: r.sourceUrl,
              note: r.note ?? "",
              owner: r.owner,
              sourceName: r.sourceName,
            };
      counts[kind]++;
    }
  }
}
const ordered = Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k]]));
writeFileSync(join(dir, "../../lib/mock-data/medicine-images.json"), JSON.stringify(ordered, null, 1) + "\n");
console.log({ ...counts, total: Object.keys(out).length });
