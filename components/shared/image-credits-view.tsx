"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useDb } from "@/lib/store/app-store";
import { getMedicineImage, MATCH_LABEL, type MedicineImageCredit } from "@/lib/mock-data/medicine-images";
import type { Medicine } from "@/lib/types";
import { medicineName } from "@/lib/services/stock";
import { MedicineImage } from "./medicine-image";
import { Chip } from "./chip";
import { StatTile } from "./card";

export function ImageCreditsView() {
  const db = useDb();
  const rows = useMemo(() => db.medicines.map((m) => ({ m, img: getMedicineImage(m.sku) })), [db.medicines]);
  const withPhoto = rows.filter((r) => r.img);
  const pending = rows.filter((r) => !r.img);
  const commons = withPhoto.filter((r) => r.img!.kind === "commons");
  const retail = withPhoto.filter((r) => r.img!.kind === "retail");

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile className="card-surface bg-surface" label="Medicines in catalog" value={rows.length} />
        <StatTile className="card-surface bg-surface" label="With a photo" value={withPhoto.length} />
        <StatTile className="card-surface bg-surface" label="Free-licensed / © owner" value={`${commons.length} / ${retail.length}`} />
        <StatTile className="card-surface bg-surface" label="Photo pending" value={pending.length} />
      </div>
      <p className="card-surface p-4 text-[13px] leading-relaxed text-ink-700">
        Free-licensed photos come from{" "}
        <a href="https://commons.wikimedia.org" target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">
          Wikimedia Commons
        </a>{" "}
        under public-domain, CC0, CC BY or CC BY-SA licenses and are credited as those licenses require. Product images marked “© owner” are the copyright of the
        brand owners and are shown only to identify the products in this demonstration; obtain the owners’ permission before using them in production or
        promotional material. Brand names and packaging belong to their respective owners and do not imply endorsement. Generic items show a pack of the same
        active ingredient, strength and dosage form.
      </p>
      {commons.length > 0 && (
        <CreditTable
          title={`Free-licensed photos (${commons.length})`}
          rows={commons}
          head={["Author", "License", "Source"]}
          cells={(img) => [
            <span key="a">{img.author || "Unknown"}</span>,
            <a key="l" href={img.licenseUrl || img.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">
              {img.license}
            </a>,
            <a key="s" href={img.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-700 hover:underline">
              {img.commonsTitle.replace(/^File:/, "")}
            </a>,
          ]}
        />
      )}
      {retail.length > 0 && (
        <CreditTable
          title={`Manufacturer / retailer product images (${retail.length})`}
          rows={retail}
          head={["Copyright", "Source", "Page"]}
          cells={(img) => [
            <span key="o">© {img.owner || "Owner"}</span>,
            <span key="n">{img.sourceName || "—"}</span>,
            <a key="u" href={img.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs break-all text-brand-700 hover:underline">
              {img.sourceUrl.replace(/^https?:\/\//, "").slice(0, 60)}
            </a>,
          ]}
        />
      )}
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

function CreditTable({
  title,
  rows,
  head,
  cells,
}: {
  title: string;
  rows: { m: Medicine; img?: MedicineImageCredit }[];
  head: string[];
  cells: (img: MedicineImageCredit) => React.ReactNode[];
}) {
  return (
    <div className="card-surface overflow-hidden">
      <h3 className="px-5 pt-5 pb-3 font-heading text-base font-semibold">{title}</h3>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Photo</th>
              <th>Medicine</th>
              <th>Match</th>
              {head.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ m, img }) => (
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
                {cells(img!).map((c, i) => (
                  <td key={i} className="max-w-[260px] whitespace-normal">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
