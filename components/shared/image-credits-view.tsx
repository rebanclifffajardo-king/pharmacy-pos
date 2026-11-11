"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useDb } from "@/lib/store/app-store";
import { getMedicineImage, MATCH_LABEL } from "@/lib/mock-data/medicine-images";
import { medicineName } from "@/lib/services/stock";
import { MedicineImage } from "./medicine-image";
import { Chip } from "./chip";
import { StatTile } from "./card";

export function ImageCreditsView() {
  const db = useDb();
  const rows = useMemo(() => db.medicines.map((m) => ({ m, img: getMedicineImage(m.sku) })), [db.medicines]);
  const withPhoto = rows.filter((r) => r.img);
  const pending = rows.filter((r) => !r.img);
  const exact = withPhoto.filter((r) => r.img!.match !== "generic").length;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile className="card-surface bg-surface" label="Medicines in catalog" value={rows.length} />
        <StatTile className="card-surface bg-surface" label="With a photo" value={withPhoto.length} />
        <StatTile className="card-surface bg-surface" label="Brand product photos" value={exact} />
        <StatTile className="card-surface bg-surface" label="Photo pending" value={pending.length} />
      </div>
      <p className="card-surface p-4 text-[13px] leading-relaxed text-ink-700">
        All product photos come from{" "}
        <a href="https://commons.wikimedia.org" target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">
          Wikimedia Commons
        </a>{" "}
        under public-domain, CC0, CC BY or CC BY-SA licenses and are credited below as those licenses require. Brand names and packaging belong to their respective owners and
        appear only to identify the products; their use does not imply endorsement. Generic items use a representative photo of the same active ingredient and dosage form.
        Items marked “Photo pending” had no accurate free-licensed photo and should be photographed in-store before going live.
      </p>
      <div className="card-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Medicine</th>
                <th>Match</th>
                <th>Author</th>
                <th>License</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {withPhoto.map(({ m, img }) => (
                <tr key={m.id}>
                  <td>
                    <MedicineImage medicine={m} size={48} />
                  </td>
                  <td className="whitespace-normal">
                    <Link href={`/inventory?medicine=${m.id}`} className="font-semibold hover:text-brand-700">
                      {medicineName(m)}
                    </Link>
                    <div className="text-xs text-ink-500">{m.sku}</div>
                  </td>
                  <td>
                    <Chip tone={img!.match === "generic" ? "neutral" : "ok"}>{MATCH_LABEL[img!.match]}</Chip>
                  </td>
                  <td className="max-w-[220px] whitespace-normal">{img!.author || "Unknown"}</td>
                  <td>
                    <a href={img!.licenseUrl || img!.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">
                      {img!.license}
                    </a>
                  </td>
                  <td className="max-w-[260px] whitespace-normal">
                    <a href={img!.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-700 hover:underline">
                      {img!.commonsTitle.replace(/^File:/, "")}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {pending.length > 0 && (
        <div className="card-surface flex flex-col gap-3 p-5">
          <h3 className="font-heading text-base font-semibold">Photo pending ({pending.length})</h3>
          <div className="flex flex-wrap gap-2">
            {pending.map(({ m }) => (
              <Link key={m.id} href={`/inventory?medicine=${m.id}`} className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface py-1 pr-3 pl-1 text-xs font-medium hover:bg-canvas">
                <MedicineImage medicine={m} size={28} />
                {medicineName(m)}
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
