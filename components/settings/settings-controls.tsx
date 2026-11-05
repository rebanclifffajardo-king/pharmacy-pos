"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Accessible toggle row built on a native checkbox (works inside a disabled <fieldset>). */
export function ToggleRow({ label, description, checked, onChange }: { label: ReactNode; description?: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 has-[:disabled]:cursor-not-allowed">
      <span className="flex flex-col gap-0.5">
        <span className="text-[13px] font-semibold text-ink-700">{label}</span>
        {description && <span className="text-xs text-ink-500">{description}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span
          aria-hidden
          className={cn(
            "h-6 w-11 rounded-full bg-line-strong transition-colors peer-checked:bg-brand peer-focus-visible:ring-3 peer-focus-visible:ring-brand/30 peer-disabled:opacity-50"
          )}
        />
        <span aria-hidden className="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export function NumberInput({ value, onChange, min, max, step = 1, suffix, className, ariaLabel }: { value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; suffix?: string; className?: string; ariaLabel?: string }) {
  return (
    <span className={cn("flex h-11 items-center gap-1.5 rounded-xl border border-line-strong bg-surface px-3 focus-within:border-brand focus-within:shadow-[0_0_0_4px_rgba(34,60,255,.12)] has-[:disabled]:bg-chip", className)}>
      <input
        type="number"
        inputMode="decimal"
        aria-label={ariaLabel}
        value={Number.isFinite(value) ? value : ""}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
        className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none disabled:text-ink-500"
      />
      {suffix && <span className="text-sm font-semibold text-ink-500">{suffix}</span>}
    </span>
  );
}

export function SectionHead({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-heading text-[17px] font-semibold">{title}</h2>
        {description && <span className="text-xs text-ink-500">{description}</span>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
