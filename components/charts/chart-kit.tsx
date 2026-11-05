"use client";

import { useReducedMotion } from "motion/react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PaymentMethod } from "@/lib/types";
import { pesoShort } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

/**
 * Chart palette, validated with the dataviz validator (light surface): blue, teal and a
 * deepened amber pass lightness, CVD and 3:1 contrast. The design's lighter amber
 * (#F2A93B) fails contrast on white, so marks use #C98300 instead.
 */
export const CHART = {
  blue: "var(--chart-1)",
  blueSoft: "var(--brand-300)",
  teal: "#14A38B",
  amber: "#C98300",
  green: "#12805C",
  danger: "#DE1339",
  axis: "var(--ink-500)",
  grid: "var(--line)",
};

export const PAYMENT_CHART_COLOR: Record<PaymentMethod, string> = {
  cash: CHART.blue,
  qrph: CHART.teal,
  card: CHART.amber,
};

export interface ChartDatum {
  label: string;
  value: number;
  /** Optional secondary value shown in the tooltip (e.g. transactions). */
  sub?: string;
  color?: string;
}

interface TipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: ChartDatum }>;
  format: (n: number) => string;
}

/** Hover tooltip shared by every chart: label, formatted value, optional sub-line. */
export function ChartTooltip({ active, payload, format }: TipProps) {
  const d = active ? payload?.[0]?.payload : undefined;
  if (!d) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="font-semibold text-ink">{d.label}</div>
      <div className="mt-0.5 flex items-center gap-1.5 font-semibold text-ink tabular">
        {d.color && <i className="block size-2 rounded-[3px]" style={{ background: d.color }} aria-hidden />}
        {format(d.value)}
      </div>
      {d.sub && <div className="mt-0.5 text-ink-500">{d.sub}</div>}
    </div>
  );
}

/** Vertical column chart (sales over time). Last column is highlighted in brand blue. */
export function ColumnChart({
  data,
  format,
  height = 260,
  highlightLast = true,
  color = CHART.blueSoft,
  ariaLabel,
}: {
  data: ChartDatum[];
  format: (n: number) => string;
  height?: number;
  highlightLast?: boolean;
  color?: string;
  ariaLabel: string;
}) {
  const reduce = useReducedMotion();
  const dense = data.length > 16;
  return (
    <div style={{ height }} role="img" aria-label={ariaLabel} className="w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap={dense ? "12%" : "22%"}>
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: CHART.grid }}
            tick={{ fill: CHART.axis, fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={8}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={52}
            tick={{ fill: CHART.axis, fontSize: 11 }}
            tickFormatter={(v: number) => pesoShort(v)}
          />
          <Tooltip cursor={{ fill: "var(--brand-50)" }} content={(p) => <ChartTooltip active={p.active} payload={p.payload as TipProps["payload"]} format={format} />} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={!reduce} animationDuration={600}>
            {data.map((d, i) => (
              <Cell key={d.label + i} fill={d.color ?? (highlightLast && i === data.length - 1 ? CHART.blue : color)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal bar chart for ranked categories (reports). */
export function RankedBarChart({
  data,
  format,
  color = CHART.blue,
  ariaLabel,
  labelWidth = 170,
}: {
  data: ChartDatum[];
  format: (n: number) => string;
  color?: string;
  ariaLabel: string;
  labelWidth?: number;
}) {
  const reduce = useReducedMotion();
  const height = Math.max(120, data.length * 34 + 24);
  return (
    <div style={{ height }} role="img" aria-label={ariaLabel} className="w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 0 }} barCategoryGap="22%">
          <CartesianGrid horizontal={false} stroke={CHART.grid} />
          <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: CHART.axis, fontSize: 11 }} tickFormatter={(v: number) => format(v).replace(/\.\d\d$/, "")} />
          <YAxis
            type="category"
            dataKey="label"
            width={labelWidth}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--ink-700)", fontSize: 12 }}
            tickFormatter={(v: string) => (v.length > 26 ? v.slice(0, 25) + "…" : v)}
          />
          <Tooltip cursor={{ fill: "var(--brand-50)" }} content={(p) => <ChartTooltip active={p.active} payload={p.payload as TipProps["payload"]} format={format} />} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={!reduce} animationDuration={600}>
            {data.map((d, i) => (
              <Cell key={d.label + i} fill={d.color ?? (d.value < 0 ? CHART.danger : color)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Donut with a centre caption; slices separated by a 2px surface gap. */
export function DonutChart({
  data,
  format,
  centerLabel,
  centerValue,
  size = 160,
  ariaLabel,
}: {
  data: ChartDatum[];
  format: (n: number) => string;
  centerLabel: string;
  centerValue: string;
  size?: number;
  ariaLabel: string;
}) {
  const reduce = useReducedMotion();
  const hasData = data.some((d) => d.value > 0);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={hasData ? data : [{ label: "No sales", value: 1, color: "var(--chip)" }]}
            dataKey="value"
            nameKey="label"
            innerRadius="68%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
            stroke="var(--surface)"
            strokeWidth={2}
            isAnimationActive={!reduce}
            animationDuration={700}
          >
            {(hasData ? data : [{ label: "", value: 1, color: "var(--chip)" }]).map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
          {hasData && <Tooltip content={(p) => <ChartTooltip active={p.active} payload={p.payload as TipProps["payload"]} format={format} />} />}
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-heading text-lg font-semibold tabular">{centerValue}</span>
        <span className="text-[11px] text-ink-500">{centerLabel}</span>
      </div>
    </div>
  );
}

/** Lightweight HTML bar row (design's top-sellers / category lists). Native title acts as tooltip. */
export function BarRow({
  label,
  value,
  display,
  max,
  color = CHART.blue,
  rank,
  height = 8,
  labelWidth,
}: {
  label: string;
  value: number;
  display: string;
  max: number;
  color?: string;
  rank?: number;
  height?: number;
  labelWidth?: number;
}) {
  const pct = max > 0 ? Math.max(1.5, (Math.abs(value) / max) * 100) : 0;
  return (
    <div
      className={cn("group grid items-center gap-2.5", rank !== undefined ? "grid-cols-[22px_minmax(0,1fr)_72px]" : "grid-cols-[minmax(0,var(--lw))_minmax(0,1fr)_76px]")}
      style={{ ["--lw" as string]: `${labelWidth ?? 110}px` }}
      title={`${label}: ${display}`}
    >
      {rank !== undefined ? (
        <>
          <span className="text-xs font-semibold text-ink-400">{rank}</span>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate text-[13px] font-medium">{label}</span>
            <div className="rounded bg-chip" style={{ height }}>
              <div className="h-full rounded transition-[width] duration-500 ease-brand group-hover:opacity-80" style={{ width: `${pct}%`, background: color }} />
            </div>
          </div>
        </>
      ) : (
        <>
          <span className="truncate text-[13px] font-medium">{label}</span>
          <div className="rounded bg-chip" style={{ height }}>
            <div className="h-full rounded transition-[width] duration-500 ease-brand group-hover:opacity-80" style={{ width: `${pct}%`, background: color }} />
          </div>
        </>
      )}
      <span className="text-right text-[13px] font-semibold tabular">{display}</span>
    </div>
  );
}
