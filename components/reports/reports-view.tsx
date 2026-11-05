"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange, Download, FileText, Printer } from "lucide-react";
import { toast } from "sonner";
import { useDb } from "@/lib/store/app-store";
import { useStockIndex } from "@/hooks/use-inventory";
import { useToday } from "@/hooks/use-today";
import { presetRange, type DateRange } from "@/lib/services/report-service";
import { downloadCsv } from "@/lib/utils/csv";
import { formatDateTime } from "@/lib/utils/format";
import { usePrinter } from "@/components/receipts/print-provider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Field, NativeSelect, TextInput } from "@/components/shared/field";
import { StatTile } from "@/components/shared/card";
import { ColumnChart, RankedBarChart } from "@/components/charts/chart-kit";
import { buildReport, rangeText, REPORTS, type ReportGroup, type ReportKey } from "./report-definitions";
import { PrintableReport } from "./printable-report";
import { cn } from "@/lib/utils";

type Preset = "today" | "yesterday" | "7d" | "30d" | "month" | "lastMonth" | "90d" | "year" | "12m" | "custom";

const PRESETS: { value: Preset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "lastMonth", label: "Last month" },
  { value: "90d", label: "Last 90 days" },
  { value: "year", label: "This year" },
  { value: "12m", label: "Last 12 months" },
  { value: "custom", label: "Custom range…" },
];

const DEFAULT_PRESET: Record<ReportKey, Preset> = {
  daily: "7d",
  weekly: "90d",
  monthly: "12m",
  medicine: "30d",
  category: "month",
  cashier: "month",
  payment: "month",
  valuation: "month",
  low: "month",
  expiry: "month",
  purchase: "90d",
  profit: "month",
  refunds: "90d",
};

const GROUPS: ReportGroup[] = ["Sales", "Inventory", "Finance"];

export function ReportsView() {
  const db = useDb();
  const index = useStockIndex();
  const today = useToday();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { printNode } = usePrinter();

  const initial = (params.get("report") as ReportKey | null) ?? "monthly";
  const [current, setCurrent] = useState<ReportKey>(REPORTS.some((r) => r.key === initial) ? initial : "monthly");
  const [preset, setPreset] = useState<Preset>(DEFAULT_PRESET[current]);
  const [custom, setCustom] = useState<DateRange>(() => presetRange("30d", today));
  const [categoryId, setCategoryId] = useState("all");

  const range: DateRange = useMemo(() => {
    if (preset !== "custom") return presetRange(preset, today);
    const from = custom.from <= custom.to ? custom.from : custom.to;
    const to = custom.from <= custom.to ? custom.to : custom.from;
    return { from, to: to > today ? today : to };
  }, [preset, custom, today]);

  const data = useMemo(() => buildReport(current, db, range, categoryId, index, today), [current, db, range, categoryId, index, today]);
  const meta = data.meta;
  const categoryLabel = categoryId === "all" ? undefined : db.categories.find((c) => c.id === categoryId)?.name;

  const pick = (key: ReportKey) => {
    setCurrent(key);
    setPreset(DEFAULT_PRESET[key]);
    const sp = new URLSearchParams(params.toString());
    sp.set("report", key);
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  };

  const fileBase = `${meta.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}_${meta.usesRange ? `${range.from}_to_${range.to}` : today}`;

  const exportCsv = () => {
    downloadCsv(`${fileBase}.csv`, data.csv.headers, data.csv.rows);
    toast.success("CSV exported", { description: `${fileBase}.csv · ${data.csv.rows.length} rows` });
  };

  const print = async (pdf: boolean) => {
    if (pdf) toast.info("Choose “Save as PDF” as the printer", { description: "The print dialog creates the PDF — no upload or server needed." });
    try {
      await printNode("report", <PrintableReport data={data} pharmacy={db.settings.pharmacy} generatedAt={formatDateTime(new Date())} categoryLabel={categoryLabel} />);
    } catch (e) {
      toast.error("Could not open the print dialog", { description: e instanceof Error ? e.message : undefined });
    }
  };

  return (
    <div className="flex flex-wrap items-start gap-4">
      {/* Report catalog */}
      <nav aria-label="Report catalog" className="card-surface hidden w-full max-w-[320px] flex-[1_1_260px] flex-col gap-0.5 p-3 lg:flex">
        {GROUPS.map((g) => (
          <div key={g} className="flex flex-col gap-0.5">
            <p className="mx-2.5 mt-3 mb-1.5 text-[11px] font-bold tracking-[0.08em] text-ink-400 uppercase">{g}</p>
            {REPORTS.filter((r) => r.group === g).map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => pick(r.key)}
                aria-current={r.key === current ? "page" : undefined}
                className={cn(
                  "min-h-[42px] rounded-[10px] px-3 py-2.5 text-left text-sm transition-colors",
                  r.key === current ? "bg-brand-50 font-semibold text-brand-700" : "font-medium text-ink-700 hover:bg-canvas"
                )}
              >
                {r.name}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <section className="card-surface flex min-w-0 flex-[999_1_560px] flex-col gap-5 p-4 sm:p-6">
        {/* Mobile report picker */}
        <Field label="Report" className="lg:hidden">
          <NativeSelect value={current} onChange={(e) => pick(e.target.value as ReportKey)}>
            {GROUPS.map((g) => (
              <optgroup key={g} label={g}>
                {REPORTS.filter((r) => r.group === g).map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </NativeSelect>
        </Field>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="font-heading text-[22px] font-semibold">{meta.name}</h2>
            <span className="text-[13px] text-ink-500">{meta.description}</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-700">
              <CalendarRange className="size-3.5 text-brand" aria-hidden />
              {data.rangeLabel}
              {categoryLabel && ` · ${categoryLabel}`}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="md" onClick={exportCsv}>
              <Download className="size-4" aria-hidden /> CSV
            </Button>
            <Button variant="soft" size="md" onClick={() => print(false)}>
              <Printer className="size-4" aria-hidden /> Print
            </Button>
            <Tooltip>
              <TooltipTrigger render={<Button variant="outline" size="md" onClick={() => print(true)} />}>
                <FileText className="size-4" aria-hidden /> PDF
              </TooltipTrigger>
              <TooltipContent>Opens the print dialog — choose Save as PDF</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Filters */}
        {(meta.usesRange || meta.usesCategory) && (
          <div className="flex flex-wrap items-end gap-3 rounded-xl bg-canvas p-3">
            {meta.usesRange && (
              <Field label="Date range" className="w-[190px]">
                <NativeSelect value={preset} onChange={(e) => setPreset(e.target.value as Preset)}>
                  {PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
            {meta.usesRange && preset === "custom" && (
              <>
                <Field label="From" className="w-[160px]">
                  <TextInput type="date" value={custom.from} max={today} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, from: e.target.value }))} />
                </Field>
                <Field label="To" className="w-[160px]">
                  <TextInput type="date" value={custom.to} max={today} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, to: e.target.value }))} />
                </Field>
              </>
            )}
            {meta.usesCategory && (
              <Field label="Category" className="w-[200px]">
                <NativeSelect value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="all">All categories</option>
                  {db.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
            {!meta.usesRange && <span className="pb-3 text-xs text-ink-500">Inventory snapshot — current stock, not affected by dates.</span>}
            {meta.usesRange && <span className="pb-3 text-xs text-ink-500">{rangeText(range)}</span>}
          </div>
        )}

        <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
          {data.kpis.map((k) => (
            <StatTile key={k.label} label={k.label} value={k.value} valueClassName="truncate text-xl" />
          ))}
        </div>

        {data.chart && (
          <div className="flex flex-col gap-2.5">
            <span className="font-heading text-sm font-semibold">{data.chart.title}</span>
            {data.chart.data.length === 0 ? (
              <span className="rounded-xl bg-canvas py-10 text-center text-sm text-ink-500">{data.emptyMessage}</span>
            ) : data.chart.kind === "columns" ? (
              <ColumnChart data={data.chart.data} format={data.chart.format} highlightLast={false} color={data.chart.color} ariaLabel={`${data.chart.title}, ${data.rangeLabel}`} />
            ) : (
              <RankedBarChart data={data.chart.data} format={data.chart.format} color={data.chart.color} ariaLabel={`${data.chart.title}, ${data.rangeLabel}`} />
            )}
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="data-table">
            <thead>
              <tr>
                {data.columns.map((c) => (
                  <th key={c.label} className={c.align === "right" ? "text-right" : undefined}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((v, j) => (
                    <td key={j} className={cn(data.columns[j]?.align === "right" && "text-right tabular", j === 0 && "font-semibold", data.columns[j]?.label === "Items" && "max-w-[340px] truncate")} title={v}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
              {data.rows.length === 0 && (
                <tr>
                  <td colSpan={data.columns.length} className="py-10 text-center text-ink-500">
                    {data.emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
            {data.totals && data.rows.length > 0 && (
              <tfoot>
                <tr className="bg-surface-2">
                  {data.totals.map((v, j) => (
                    <td key={j} className={cn("border-t border-line font-bold", data.columns[j]?.align === "right" && "text-right tabular")}>
                      {v}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <span className="text-xs text-ink-500">
          {data.rows.length} row{data.rows.length === 1 ? "" : "s"} · Generated {formatDateTime(new Date())} · {db.settings.pharmacy.branch} · Demo Mode sample data
        </span>
      </section>
    </div>
  );
}
