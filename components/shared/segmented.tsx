"use client";

import { cn } from "@/lib/utils";

/** Pill segmented control (design: grey track, white selected pill). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  variant = "track",
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; count?: number }[];
  className?: string;
  /** "track" = grey track with white pill · "dark" = white track with ink pill. */
  variant?: "track" | "dark";
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex max-w-full flex-wrap gap-1 rounded-xl p-1",
        variant === "track" ? "bg-chip" : "border border-line bg-surface",
        className
      )}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-[34px] rounded-[9px] px-3 text-xs font-semibold whitespace-nowrap transition-colors duration-150",
              variant === "track"
                ? on
                  ? "bg-surface text-brand-700 shadow-[0_1px_3px_rgba(15,23,51,.12)]"
                  : "text-ink-500 hover:text-ink"
                : on
                  ? "bg-ink text-surface"
                  : "text-ink-700 hover:bg-chip",
              variant === "dark" && "h-9 text-[13px]"
            )}
          >
            {o.label}
            {o.count !== undefined && <span className="ml-1 opacity-70">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Filter pills with optional status dot (design: inventory / PO filters). */
export function FilterPills<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number; dotClass?: string }[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-[38px] items-center gap-[7px] rounded-full border px-3 text-[13px] font-semibold transition-colors",
              on ? "border-ink bg-ink text-surface" : "border-line bg-surface text-ink-700 hover:bg-surface-2"
            )}
          >
            {o.dotClass && <i className={cn("block size-2 rounded-full", o.dotClass)} aria-hidden />}
            {o.label}
            {o.count !== undefined && <span className="opacity-75">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
