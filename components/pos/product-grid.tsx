"use client";

import { forwardRef, useMemo } from "react";
import { FlaskConical, Pill, Plus, ScanBarcode, Search, Syringe } from "lucide-react";
import type { Category, Medicine, StockInfo } from "@/lib/types";
import { medicineName } from "@/lib/services/stock";
import { formatDate, int, peso } from "@/lib/utils/format";
import { Chip, RxChip } from "@/components/shared/chip";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

const PILL_FORMS = new Set(["Tablet", "Capsule", "Softgel", "Lozenge"]);
const BOTTLE_FORMS = new Set(["Syrup", "Suspension", "Drops", "Solution", "Spray"]);

export interface ProductView {
  m: Medicine;
  info: StockInfo;
  left: number;
}

export function filterProducts(medicines: Medicine[], index: Map<string, StockInfo>, used: Map<string, number>, q: string, cat: string, inStockOnly: boolean): ProductView[] {
  const term = q.trim().toLowerCase();
  return medicines
    .filter((m) => m.status === "active")
    .filter((m) => cat === "all" || m.categoryId === cat)
    .filter((m) => !term || `${m.brandName} ${m.genericName} ${m.strength} ${m.sku} ${m.barcode}`.toLowerCase().includes(term))
    .map((m) => {
      const info = index.get(m.id)!;
      return { m, info, left: info.saleable - (used.get(m.id) ?? 0) };
    })
    .filter((p) => !inStockOnly || p.info.saleable > 0)
    .sort((a, b) => Number(b.info.saleable > 0) - Number(a.info.saleable > 0) || medicineName(a.m).localeCompare(medicineName(b.m)));
}

export const PosSearchBar = forwardRef<
  HTMLInputElement,
  { value: string; onChange: (v: string) => void; onEnter: () => void }
>(function PosSearchBar({ value, onChange, onEnter }, ref) {
  return (
    <label className="flex h-[52px] min-w-0 flex-[1_1_360px] items-center gap-2.5 rounded-[14px] border-[1.5px] border-brand bg-surface px-3.5 shadow-[0_0_0_4px_rgba(34,60,255,.10)]">
      <Search className="size-5 shrink-0 text-ink-500" aria-hidden />
      <span className="sr-only">Scan barcode or search medicines</span>
      <input
        ref={ref}
        type="search"
        value={value}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnter();
          }
          if (e.key === "Escape") onChange("");
        }}
        placeholder="Scan barcode or search generic, brand, SKU…"
        className="min-w-0 flex-1 bg-transparent text-base font-medium text-ink outline-none placeholder:font-normal placeholder:text-ink-400 [&::-webkit-search-cancel-button]:hidden"
      />
      <span className="hidden items-center gap-1 text-xs font-medium whitespace-nowrap text-ink-500 sm:flex">
        <ScanBarcode className="size-4" aria-hidden /> Enter ↵ to add
      </span>
    </label>
  );
});

export function CategoryChips({ categories, value, onChange, inStockOnly, onInStockOnly }: { categories: Category[]; value: string; onChange: (v: string) => void; inStockOnly: boolean; onInStockOnly: (v: boolean) => void }) {
  const all = [{ id: "all", name: "All" }, ...categories];
  return (
    <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
      <button
        type="button"
        aria-pressed={inStockOnly}
        onClick={() => onInStockOnly(!inStockOnly)}
        className={cn(
          "flex h-10 flex-none items-center gap-1.5 rounded-[10px] border px-3.5 text-[13px] font-semibold whitespace-nowrap",
          inStockOnly ? "border-ok-dot bg-ok-bg text-ok" : "border-line bg-surface text-ink-700"
        )}
      >
        <span className={cn("size-2 rounded-full", inStockOnly ? "bg-ok-dot" : "bg-ink-300")} aria-hidden />
        In stock only
      </button>
      <span className="my-1.5 w-px flex-none bg-line" aria-hidden />
      {all.map((c) => {
        const on = c.id === value;
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(c.id)}
            className={cn(
              "h-10 flex-none rounded-[10px] border px-3.5 text-[13px] whitespace-nowrap transition-colors",
              on ? "border-ink bg-ink font-semibold text-surface" : "border-line bg-surface font-medium text-ink-700 hover:bg-surface-2"
            )}
          >
            {c.name}
          </button>
        );
      })}
    </div>
  );
}

function statusFor(p: ProductView): { label: string; tone: "ok" | "warn" | "danger" | "orange" | "solid-danger" } {
  const { info, left } = p;
  if (info.saleable <= 0 && info.hasExpired) return { label: "Expired · blocked", tone: "solid-danger" };
  if (info.saleable <= 0) return { label: "Out of stock", tone: "danger" };
  if (left <= 0) return { label: "All in cart", tone: "warn" };
  if (info.isExpiring && info.nearestExpiry) return { label: `Exp. ${formatDate(info.nearestExpiry)}`, tone: "orange" };
  if (info.isLow) return { label: `Low · ${int(left)} left`, tone: "warn" };
  return { label: `${int(left)} in stock`, tone: "ok" };
}

export function ProductGrid({ products, onAdd, query }: { products: ProductView[]; onAdd: (m: Medicine) => void; query: string }) {
  if (!products.length) {
    return <EmptyState icon={Search} title={`No medicines match “${query}”`} description="Try the generic name, or scan the barcode again." />;
  }
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
      {products.map((p) => (
        <ProductTile key={p.m.id} p={p} onAdd={onAdd} />
      ))}
    </div>
  );
}

function ProductTile({ p, onAdd }: { p: ProductView; onAdd: (m: Medicine) => void }) {
  const { m } = p;
  const st = useMemo(() => statusFor(p), [p]);
  const blocked = p.info.saleable <= 0;
  const kind = PILL_FORMS.has(m.dosageForm) ? "pill" : BOTTLE_FORMS.has(m.dosageForm) ? "bottle" : "other";
  const Icon = kind === "pill" ? Pill : kind === "bottle" ? FlaskConical : Syringe;
  return (
    <button
      type="button"
      onClick={() => onAdd(m)}
      disabled={blocked}
      aria-label={`Add ${medicineName(m)}, ${peso(m.sellingPrice)} per ${m.unit}, ${st.label}`}
      className={cn(
        "group flex min-h-[150px] flex-col gap-2.5 rounded-[14px] border border-line bg-surface p-3 text-left transition-[transform,box-shadow,border-color] duration-150 ease-brand",
        "hover:-translate-y-px hover:border-brand-200 hover:shadow-[0_6px_18px_rgba(34,60,255,.10)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand active:scale-[.98]",
        "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:border-line disabled:hover:shadow-none"
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-xl",
            kind === "pill" && "bg-brand-50 text-brand",
            kind === "bottle" && "bg-ok-bg text-ok-dot",
            kind === "other" && "bg-orange-bg text-orange-dot"
          )}
        >
          <Icon className="size-[22px]" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm leading-tight font-semibold text-ink">{medicineName(m)}</span>
          <span className="line-clamp-2 text-xs leading-snug text-ink-500">
            {m.genericName} · {m.dosageForm}
          </span>
        </div>
        {m.rxRequired && <RxChip />}
      </div>
      <div className="mt-auto flex items-end justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-base font-bold text-brand-700 tabular">
            {peso(m.sellingPrice)}
            <span className="text-xs font-medium text-ink-500"> / {m.unit}</span>
          </span>
          <Chip tone={st.tone} dot>
            {st.label}
          </Chip>
        </div>
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-[10px] transition-transform group-active:scale-90", blocked ? "bg-neutral-bg text-ink-300" : "bg-brand text-white")} aria-hidden>
          <Plus className="size-5" />
        </span>
      </div>
    </button>
  );
}
