"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertOctagon,
  Boxes,
  CalendarClock,
  CalendarDays,
  PackageX,
  Pill,
  Plus,
  ReceiptText,
  TrendingUp,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { useDb } from "@/lib/store/app-store";
import { useStockIndex } from "@/hooks/use-inventory";
import { useCurrentUser } from "@/hooks/use-session";
import { useNow, useToday } from "@/hooks/use-today";
import {
  byCategory,
  byPaymentMethod,
  dailySeries,
  expiryRows,
  hourlySeries,
  inventoryValuation,
  lowStockRows,
  monthlySeries,
  PAYMENT_LABEL,
  pctChange,
  presetRange,
  salesInRange,
  summarize,
  topMedicines,
  weeklySeries,
  yearlySeries,
  type DateRange,
  type SeriesPoint,
} from "@/lib/services/report-service";
import { isBatchExpired } from "@/lib/services/stock";
import { addDays, dateKey, daysBetween, formatDate, formatTime, formatRelative, int, manilaHour, peso, pesoShort, percent } from "@/lib/utils/format";
import type { SaleTransaction, Tone } from "@/lib/types";
import { KpiCard } from "@/components/shared/kpi-card";
import { Segmented } from "@/components/shared/segmented";
import { SectionCard } from "@/components/shared/card";
import { Chip, type ChipTone } from "@/components/shared/chip";
import { LinkButton } from "@/components/shared/link-button";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { BarRow, CHART, ColumnChart, DonutChart, PAYMENT_CHART_COLOR, type ChartDatum } from "@/components/charts/chart-kit";
import { cn } from "@/lib/utils";

type Period = "daily" | "weekly" | "monthly" | "yearly";
type RangePreset = "today" | "7d" | "30d" | "month" | "90d" | "12m";

const RANGE_OPTIONS: { value: RangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "month", label: "This month" },
  { value: "90d", label: "90 days" },
  { value: "12m", label: "12 months" },
];

const PAY_CHIP: Record<SaleTransaction["payment"]["method"], ChipTone> = { cash: "brand", qrph: "teal", card: "warn" };
const STATUS_CHIP: Record<SaleTransaction["status"], { tone: ChipTone; label: string }> = {
  completed: { tone: "ok", label: "Paid" },
  partially_refunded: { tone: "orange", label: "Part. refunded" },
  refunded: { tone: "orange", label: "Refunded" },
  voided: { tone: "neutral", label: "Voided" },
};
const TONE_DOT: Record<Tone, string> = {
  success: "bg-ok-dot",
  danger: "bg-red-700",
  warning: "bg-warn-dot",
  info: "bg-brand",
  neutral: "bg-ink-400",
};

function changeLabel(change: number | null, suffix: string) {
  if (change === null) return { text: `No sales ${suffix} to compare`, cls: "text-ink-500" };
  const up = change >= 0;
  return { text: `${up ? "▲" : "▼"} ${percent(Math.abs(change))} ${suffix}`, cls: up ? "text-ok" : "text-danger" };
}

function greeting(firstName: string, now: Date) {
  const h = manilaHour(now);
  return `Magandang ${h < 12 ? "umaga" : h < 18 ? "hapon" : "gabi"}, ${firstName}`;
}

export function DashboardView() {
  const db = useDb();
  const index = useStockIndex();
  const today = useToday();
  const user = useCurrentUser();
  const now = useNow(60_000);
  const [period, setPeriod] = useState<Period>("daily");
  const [preset, setPreset] = useState<RangePreset>("30d");
  const [expTab, setExpTab] = useState<"30" | "60" | "90">("30");

  const range: DateRange = useMemo(() => presetRange(preset, today), [preset, today]);

  // ------------------------------------------------------------------ KPIs (always "today" / "this month")
  const kpi = useMemo(() => {
    const nowMs = now.getTime();
    const todayTx = salesInRange(db, { from: today, to: today });
    const yKey = addDays(today, -1);
    // Same-time comparison: yesterday's sales up to this time of day.
    const ySoFar = salesInRange(db, { from: yKey, to: yKey }).filter((t) => new Date(t.createdAt).getTime() <= nowMs - 86400000);
    const tSum = summarize(todayTx);
    const ySum = summarize(ySoFar);

    const monthFrom = today.slice(0, 8) + "01";
    const monthSum = summarize(salesInRange(db, { from: monthFrom, to: today }));
    const lastMonth = presetRange("lastMonth", today);
    const dayOfMonth = Number(today.slice(8, 10));
    const lastMonthSameEnd = addDays(lastMonth.from, Math.min(dayOfMonth, daysBetween(lastMonth.from, lastMonth.to) + 1) - 1);
    const lastMonthSum = summarize(salesInRange(db, { from: lastMonth.from, to: lastMonthSameEnd }));

    let units = 0,
      low = 0,
      out = 0,
      expiring = 0,
      expiring30 = 0;
    for (const s of index.values()) {
      units += s.saleable;
      if (s.isLow) low++;
      if (s.isOut) out++;
      if (s.isExpiring) {
        expiring++;
        if ((s.daysToExpiry ?? 999) <= 30) expiring30++;
      }
    }
    const lowRows = lowStockRows(db, index);
    const outOnOrder = lowRows.filter((r) => r.out && r.onOrder).length;
    const expiredBatches = db.batches.filter((b) => b.quantity > 0 && isBatchExpired(b, today));
    const activeMeds = db.medicines.filter((m) => m.status === "active");
    return {
      tSum,
      todayChange: pctChange(tSum.net, ySum.net),
      monthSum,
      monthChange: pctChange(monthSum.net, lastMonthSum.net),
      lastMonthLabel: formatDate(lastMonth.from).split(" ")[0],
      units,
      low,
      out,
      outOnOrder,
      expiring,
      expiring30,
      expiredBatches: expiredBatches.length,
      expiredUnits: expiredBatches.reduce((s, b) => s + b.quantity, 0),
      activeMeds: activeMeds.length,
      categories: new Set(activeMeds.map((m) => m.categoryId)).size,
      suppliers: db.suppliers.filter((s) => s.status === "active").length,
      lowRows,
    };
  }, [db, index, today, now]);

  // ------------------------------------------------------------------ range-driven sections
  const rangeTx = useMemo(() => salesInRange(db, range), [db, range]);
  const rangeSum = useMemo(() => summarize(rangeTx), [rangeTx]);
  const payments = useMemo(() => byPaymentMethod(rangeTx), [rangeTx]);
  const top = useMemo(() => topMedicines(db, rangeTx, 10), [db, rangeTx]);
  const categorySales = useMemo(() => byCategory(db, rangeTx).slice(0, 5), [db, rangeTx]);
  const valuation = useMemo(() => inventoryValuation(db, index), [db, index]);

  // ------------------------------------------------------------------ sales overview chart
  const overview = useMemo(() => {
    let points: SeriesPoint[];
    let note: string;
    if (period === "daily") {
      if (preset === "today") {
        points = hourlySeries(rangeTx);
        note = "Today, by hour";
      } else {
        const days = daysBetween(range.from, range.to) + 1;
        const r = days >= 7 && days <= 92 ? range : presetRange("30d", today);
        points = dailySeries(db, r);
        note = `${formatDate(r.from)} – ${formatDate(r.to)}, by day`;
      }
    } else if (period === "weekly") {
      points = weeklySeries(db, 12, today);
      note = "Last 12 weeks (week starting Monday)";
    } else if (period === "monthly") {
      points = monthlySeries(db, 12, today);
      note = "Last 12 months";
    } else {
      points = yearlySeries(db, today);
      note = "By calendar year (current year to date)";
    }
    const total = points.reduce((s, p) => s + p.value, 0);
    const data: ChartDatum[] = points.map((p) => ({ label: p.label, value: p.value, sub: `${int(p.count)} transaction${p.count === 1 ? "" : "s"} · GP ${peso(p.profit)}` }));
    return { data, note: `${note} · total ${peso(total)}` };
  }, [period, preset, range, rangeTx, db, today]);

  const recent = useMemo(() => [...db.transactions].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 7), [db.transactions]);

  const expList = useMemo(() => {
    const within = Number(expTab);
    return expiryRows(db, within, today).filter((r) => r.days > 0 && r.status === "Saleable");
  }, [db, expTab, today]);

  const firstName = (user?.name ?? "").split(/[\s,]+/)[0] || "there";
  const topMax = top[0]?.units ?? 0;
  const valMax = valuation.rows[0]?.cost ?? 0;
  const payTotalCount = payments.reduce((s, p) => s + p.count, 0);
  const rangeLabel = RANGE_OPTIONS.find((o) => o.value === preset)?.label ?? "";

  return (
    <div className="flex flex-col gap-5">
      {/* Greeting + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-[22px] font-semibold">{greeting(firstName, now)}</h2>
          <span className="text-[13px] text-ink-500">
            {kpi.expiredBatches} expired batch{kpi.expiredBatches === 1 ? " is" : "es are"} quarantined and {kpi.low} medicine{kpi.low === 1 ? " is" : "s are"} at or below reorder level.
          </span>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <LinkButton href="/reports" variant="outline" size="md" className="h-11">
            View reports
          </LinkButton>
          <LinkButton href="/pos" variant="brand" size="md" className="h-11 px-[18px]">
            <Plus className="size-4" aria-hidden /> New sale
          </LinkButton>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3.5">
        <KpiCard
          label="Today’s sales"
          value={kpi.tSum.net}
          format={peso}
          icon={TrendingUp}
          footnote={changeLabel(kpi.todayChange, "vs yesterday, same time").text}
          footnoteClassName={changeLabel(kpi.todayChange, "").cls}
        />
        <KpiCard label="Today’s transactions" value={kpi.tSum.count} icon={ReceiptText} footnote={`Avg basket ${peso(kpi.tSum.avgBasket)}`} />
        <KpiCard label="Medicines / SKUs" value={kpi.activeMeds} icon={Pill} footnote={`Across ${kpi.categories} categories · ${kpi.suppliers} suppliers`} />
        <KpiCard label="Available stock units" value={kpi.units} icon={Boxes} tone="ok" footnote="Saleable, unexpired batches only" />
        <KpiCard
          label="Monthly sales"
          value={kpi.monthSum.net}
          format={peso}
          icon={CalendarDays}
          footnote={changeLabel(kpi.monthChange, `vs ${kpi.lastMonthLabel}, same days`).text}
          footnoteClassName={changeLabel(kpi.monthChange, "").cls}
        />
        <KpiCard label="Low-stock medicines" value={kpi.low} icon={TriangleAlert} tone="warn" href="/inventory?filter=low" footnote="At or below reorder level" footnoteClassName="text-warn" />
        <KpiCard
          label="Out of stock"
          value={kpi.out}
          icon={PackageX}
          tone="danger"
          href="/inventory?filter=out"
          footnote={`${kpi.outOnOrder} already on order`}
          footnoteClassName="text-danger"
        />
        <KpiCard
          label="Expiring ≤ 90 days"
          value={kpi.expiring}
          icon={CalendarClock}
          tone="orange"
          href="/stock-management?tab=90"
          footnote={`${kpi.expiring30} within 30 days`}
          footnoteClassName="text-orange"
        />
        <KpiCard
          label="Expired batches"
          value={kpi.expiredBatches}
          icon={AlertOctagon}
          tone="solid-danger"
          footnote={`${int(kpi.expiredUnits)} units quarantined · blocked from sale`}
          footnoteClassName="text-danger"
        />
        <KpiCard
          label="Gross profit (est.)"
          value={kpi.monthSum.grossProfit}
          format={peso}
          icon={Wallet}
          tone="ok"
          footnote={`${percent(kpi.monthSum.margin)} margin · this month`}
        />
      </div>

      {/* Period filter */}
      <div className="card-surface flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
        <div className="flex flex-col gap-0.5">
          <span className="label-caps">Analysis period</span>
          <span className="text-xs text-ink-500">
            {formatDate(range.from)}
            {range.from !== range.to && ` – ${formatDate(range.to)}`} · drives the charts and lists below
          </span>
        </div>
        <Segmented value={preset} onChange={setPreset} options={RANGE_OPTIONS} ariaLabel="Analysis period" />
        <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Net sales" value={rangeSum.net} format={peso} />
          <MiniStat label="Transactions" value={rangeSum.count} />
          <MiniStat label="Avg basket" value={rangeSum.avgBasket} format={peso} />
          <MiniStat label="Gross profit (est.)" value={rangeSum.grossProfit} format={peso} />
        </div>
      </div>

      {/* Charts row */}
      <div className="flex flex-wrap gap-4">
        <SectionCard
          className="flex-[2_1_560px]"
          title="Sales overview"
          subtitle={overview.note}
          actions={
            <Segmented
              value={period}
              onChange={setPeriod}
              ariaLabel="Sales overview grouping"
              options={[
                { value: "daily", label: preset === "today" ? "Hourly" : "Daily" },
                { value: "weekly", label: "Weekly" },
                { value: "monthly", label: "Monthly" },
                { value: "yearly", label: "Yearly" },
              ]}
            />
          }
        >
          {overview.data.length ? (
            <ColumnChart data={overview.data} format={peso} ariaLabel={`Sales overview bar chart. ${overview.note}`} />
          ) : (
            <div className="grid h-[260px] place-items-center text-sm text-ink-500">No sales recorded in this period yet.</div>
          )}
        </SectionCard>

        <SectionCard className="flex-[1_1_300px]" title="Sales by payment method" subtitle={`${rangeLabel} · ${int(payTotalCount)} transactions`}>
          <div className="flex flex-wrap items-center gap-5">
            <DonutChart
              data={payments.map((p) => ({ label: p.label, value: p.value, color: PAYMENT_CHART_COLOR[p.method], sub: `${int(p.count)} transactions · ${percent(p.share)}` }))}
              format={peso}
              centerValue={pesoShort(rangeSum.net)}
              centerLabel="net sales"
              ariaLabel={`Payment split: ${payments.map((p) => `${p.label} ${percent(p.share, 0)}`).join(", ")}`}
            />
            <div className="flex min-w-[140px] flex-1 flex-col gap-3">
              {payments.map((p) => (
                <div key={p.method} className="flex items-center justify-between gap-2 text-[13px] font-medium">
                  <span className="flex items-center gap-2">
                    <i className="block size-2.5 rounded-[3px]" style={{ background: PAYMENT_CHART_COLOR[p.method] }} aria-hidden />
                    {p.label}
                  </span>
                  <span className="flex flex-col items-end">
                    <b className="tabular">{percent(p.share, 0)}</b>
                    <span className="text-[11px] font-normal text-ink-500 tabular">{peso(p.value)}</span>
                  </span>
                </div>
              ))}
              <span className="text-xs text-ink-500">QR Ph and card payments are simulated in Demo Mode.</span>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Top sellers + categories */}
      <div className="flex flex-wrap gap-4">
        <SectionCard className="flex-[1_1_420px]" title="Top 10 best-selling medicines" subtitle={`Units sold · ${rangeLabel.toLowerCase()}`}>
          {top.length ? (
            <div className="flex flex-col gap-2.5">
              {top.map((t, i) => (
                <BarRow key={t.medicineId} rank={i + 1} label={t.name} value={t.units} max={topMax} display={int(t.units)} color={i < 3 ? CHART.blue : "#7F8FFF"} />
              ))}
            </div>
          ) : (
            <span className="py-8 text-center text-sm text-ink-500">No units sold in this period.</span>
          )}
        </SectionCard>
        <SectionCard className="flex-[1_1_420px]" title="Inventory by category" subtitle={`Stock value at cost · ${peso(valuation.totalCost)} total`}>
          <div className="flex flex-col gap-2.5">
            {valuation.rows.slice(0, 10).map((c) => (
              <BarRow key={c.categoryId} label={c.name} value={c.cost} max={valMax} display={pesoShort(c.cost)} color={CHART.teal} height={14} />
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-1.5 border-t border-line-soft pt-3">
            <span className="label-caps">Top categories by sales · {rangeLabel.toLowerCase()}</span>
            <div className="flex flex-wrap gap-1.5">
              {categorySales.map((c) => (
                <Chip key={c.categoryId} tone="neutral">
                  {c.name} · {pesoShort(c.revenue)}
                </Chip>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Recent sales + low stock */}
      <div className="flex flex-wrap gap-4">
        <SectionCard className="flex-[2_1_520px]" title="Recent sales" actions={<Link href="/sales" className="text-[13px] font-semibold text-brand-700 hover:underline">View all</Link>} bodyClassName="px-0 pb-2">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Time</th>
                  <th>Cashier</th>
                  <th>Items</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link href={`/sales?tx=${t.id}`} className="font-mono text-xs font-semibold text-brand-700 hover:underline">
                        {t.receiptNo}
                      </Link>
                    </td>
                    <td className="text-ink-700">{formatRelative(t.createdAt)}</td>
                    <td>{t.cashierName}</td>
                    <td className="tabular">{t.lines.reduce((s, l) => s + l.qty, 0)}</td>
                    <td>
                      <Chip tone={PAY_CHIP[t.payment.method]}>{PAYMENT_LABEL[t.payment.method]}</Chip>
                    </td>
                    <td>
                      <Chip tone={STATUS_CHIP[t.status].tone}>{STATUS_CHIP[t.status].label}</Chip>
                    </td>
                    <td className={cn("text-right font-semibold tabular", t.status === "voided" && "text-ink-400 line-through")}>{peso(t.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          className="flex-[1_1_320px]"
          title="Low stock alerts"
          actions={
            <Chip tone="warn">
              {kpi.low} low · {kpi.out} out
            </Chip>
          }
          bodyClassName="pt-3"
        >
          <div className="flex flex-col">
            {kpi.lowRows.slice(0, 6).map((r) => (
              <Link key={r.medicineId} href={`/inventory?medicine=${r.medicineId}`} className="flex items-center justify-between gap-2.5 border-b border-line-soft py-2 hover:bg-surface-2">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[13px] font-semibold">{r.name}</span>
                  <span className="text-xs text-ink-500">
                    Reorder at {int(r.minStock)} {r.unit}
                    {r.onOrder && " · on order"}
                  </span>
                </span>
                <Chip tone={r.out ? "danger" : r.saleable <= r.minStock / 3 ? "danger" : "warn"}>{r.out ? "Out of stock" : `${int(r.saleable)} left`}</Chip>
              </Link>
            ))}
          </div>
          <Link href="/purchase-orders?new=1" className="mt-3 text-[13px] font-semibold text-brand-700 hover:underline">
            Create purchase order →
          </Link>
        </SectionCard>
      </div>

      {/* Expiry + activity */}
      <div className="flex flex-wrap gap-4">
        <SectionCard
          className="flex-[1_1_420px]"
          title="Medicines expiring soon"
          actions={
            <Segmented
              value={expTab}
              onChange={setExpTab}
              ariaLabel="Expiry window"
              options={[
                { value: "30", label: "≤ 30 days" },
                { value: "60", label: "≤ 60 days" },
                { value: "90", label: "≤ 90 days" },
              ]}
            />
          }
          bodyClassName="px-0 pb-2"
        >
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Batch</th>
                  <th>Expiry</th>
                  <th className="text-right">Units</th>
                </tr>
              </thead>
              <tbody>
                {expList.slice(0, 7).map((x) => (
                  <tr key={x.batchId}>
                    <td className="font-semibold">{x.name}</td>
                    <td className="font-mono text-xs">{x.batchNo}</td>
                    <td>
                      <Chip tone={x.days <= 30 ? "danger" : x.days <= 60 ? "orange" : "warn"}>
                        {formatDate(x.expiryDate)} · {x.days}d
                      </Chip>
                    </td>
                    <td className="text-right tabular">{int(x.quantity)}</td>
                  </tr>
                ))}
                {expList.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-ink-500">
                      No saleable batches expire within {expTab} days.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Link href={`/stock-management?tab=${expTab}`} className="mx-5 mt-2 text-[13px] font-semibold text-brand-700 hover:underline">
            {expList.length > 7 ? `View all ${expList.length} batches →` : "Manage batches →"}
          </Link>
        </SectionCard>

        <SectionCard className="flex-[1_1_420px]" title="Recent inventory activity" bodyClassName="pt-2">
          <div className="flex flex-col">
            {db.activity.slice(0, 7).map((a) => (
              <div key={a.id} className="grid grid-cols-[12px_minmax(0,1fr)_auto] items-start gap-3 py-2">
                <span className={cn("mt-1 block size-2.5 rounded-full", TONE_DOT[a.tone])} aria-hidden />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[13px] font-medium">{a.message}</span>
                  <span className="text-xs text-ink-500">{a.userName}</span>
                </span>
                <span className="text-xs whitespace-nowrap text-ink-500">{formatRelativeShort(a.createdAt, today)}</span>
              </div>
            ))}
            {db.activity.length === 0 && <span className="py-6 text-center text-sm text-ink-500">No activity yet.</span>}
          </div>
        </SectionCard>
      </div>

      <p className="text-center text-xs text-ink-500">Demo Mode · all figures are fictional sample data.</p>
    </div>
  );
}

function MiniStat({ label, value, format }: { label: string; value: number; format?: (n: number) => string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-canvas px-3.5 py-2.5">
      <span className="text-xs text-ink-500">{label}</span>
      <AnimatedNumber value={value} format={format} className="font-heading text-lg font-semibold tabular" />
    </div>
  );
}

function formatRelativeShort(iso: string, today: string) {
  const key = dateKey(iso);
  if (key === today) return formatTime(iso);
  if (key === addDays(today, -1)) return "Yesterday";
  return formatDate(iso);
}
