"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, FileUp, CheckCircle2, AlertTriangle } from "lucide-react";
import { actions } from "@/lib/store/actions";
import type { ImportRow } from "@/lib/services/inventory-service";
import { downloadCsv, parseCsv } from "@/lib/utils/csv";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const SAMPLE_HEADERS = ["SKU", "Barcode", "Brand name", "Generic name", "Category", "Dosage form", "Strength", "Selling price", "Cost price", "Reorder level", "Rx required", "Supplier"];
const SAMPLE_ROWS = [
  ["", "", "Generic", "Cetirizine", "Allergy", "Tablet", "5 mg", 2.5, 1.5, 100, "no", "Pacific Generics Inc."],
  ["", "", "Sample Brand", "Losartan + Hydrochlorothiazide", "Hypertension", "Tablet", "50/12.5 mg", 14, 9.8, 60, "yes", "Metro Rx Wholesale"],
  ["YM-1001", "", "Biogesic", "Paracetamol", "Pain & Fever", "Tablet", "500 mg", 5.75, 3.9, 200, "no", "Luzon MedSupply Co."],
];

const norm = (h: string) => h.toLowerCase().replace(/[^a-z]/g, "");
const ALIASES: Record<keyof ImportRow, string[]> = {
  sku: ["sku"],
  barcode: ["barcode", "ean"],
  brandName: ["brand", "brandname"],
  genericName: ["generic", "genericname"],
  category: ["category"],
  dosageForm: ["dosageform", "form"],
  strength: ["strength"],
  sellingPrice: ["sellingprice", "price", "srp"],
  costPrice: ["costprice", "cost"],
  minStock: ["reorderlevel", "minstock", "minimumstock"],
  rxRequired: ["rxrequired", "rx", "prescription"],
  supplier: ["supplier"],
};

function toRows(table: string[][]): { rows: ImportRow[]; missing: string[] } {
  const [header, ...body] = table;
  const idx: Partial<Record<keyof ImportRow, number>> = {};
  header.forEach((h, i) => {
    const n = norm(h);
    for (const [k, al] of Object.entries(ALIASES)) if (al.includes(n)) idx[k as keyof ImportRow] = i;
  });
  const required: (keyof ImportRow)[] = ["brandName", "genericName", "category", "dosageForm", "strength", "sellingPrice"];
  const missing = required.filter((k) => idx[k] === undefined);
  const get = (r: string[], k: keyof ImportRow) => (idx[k] !== undefined ? (r[idx[k]!] ?? "").trim() : "");
  const rows = body.map((r) => ({
    sku: get(r, "sku") || undefined,
    barcode: get(r, "barcode") || undefined,
    brandName: get(r, "brandName"),
    genericName: get(r, "genericName"),
    category: get(r, "category"),
    dosageForm: get(r, "dosageForm"),
    strength: get(r, "strength"),
    sellingPrice: Number(get(r, "sellingPrice").replace(/[₱,]/g, "")) || 0,
    costPrice: Number(get(r, "costPrice").replace(/[₱,]/g, "")) || 0,
    minStock: Number(get(r, "minStock")) || 0,
    rxRequired: /^(y|yes|true|1|rx)$/i.test(get(r, "rxRequired")),
    supplier: get(r, "supplier") || undefined,
  }));
  return { rows, missing };
}

export function CsvImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<{ file: string; created: number; updated: number; errors: string[] } | null>(null);

  const onFile = async (file: File) => {
    const text = await file.text();
    const table = parseCsv(text.replace(/^﻿/, ""));
    if (table.length < 2) return void toast.error("The file has no data rows.");
    const { rows, missing } = toRows(table);
    if (missing.length) return void toast.error("Missing columns", { description: missing.join(", ") + ". Download the sample CSV for the expected headers." });
    const res = actions.importMedicines({ rows });
    if (!res.ok) return void toast.error("Import failed", { description: res.error });
    setResult({ file: file.name, ...res.data });
    toast.success("CSV imported", { description: `${res.data.created} added · ${res.data.updated} updated${res.data.errors.length ? ` · ${res.data.errors.length} skipped` : ""}` });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setResult(null);
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto rounded-2xl p-6 sm:max-w-[560px]">
        <div className="flex flex-col gap-1 pr-8">
          <DialogTitle className="font-heading text-xl font-semibold">Import medicines from CSV</DialogTitle>
          <DialogDescription className="text-[13px] text-ink-500">Rows with an existing SKU update that medicine; other rows are added. Stock is not imported — receive it through a purchase order or stock-in.</DialogDescription>
        </div>
        <div className="flex flex-col gap-2 rounded-xl bg-canvas p-3 text-xs text-ink-700">
          <span className="font-semibold">Expected columns</span>
          <span className="font-mono leading-relaxed text-ink-500">{SAMPLE_HEADERS.join(", ")}</span>
          <span className="text-ink-500">Category and dosage form must match existing names (e.g. “Pain & Fever”, “Tablet”).</span>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = "";
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="brand" size="md" onClick={() => fileRef.current?.click()}>
            <FileUp className="size-4" aria-hidden /> Choose CSV file
          </Button>
          <Button variant="outline" size="md" onClick={() => downloadCsv("yasmar-medicine-import-sample.csv", SAMPLE_HEADERS, SAMPLE_ROWS)}>
            <Download className="size-4" aria-hidden /> Download sample CSV
          </Button>
        </div>
        {result && (
          <div className="flex animate-rise flex-col gap-2 rounded-xl border border-line p-3">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 className="size-4 text-ok-dot" aria-hidden /> {result.file}: {result.created} added · {result.updated} updated
            </span>
            {result.errors.length > 0 && (
              <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto text-xs text-danger">
                {result.errors.map((e) => (
                  <li key={e} className="flex gap-1.5">
                    <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
                    {e}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
