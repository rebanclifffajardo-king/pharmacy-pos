"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "./animated-number";

export type KpiTone = "brand" | "ok" | "warn" | "danger" | "orange" | "solid-danger" | "teal";

const ICON_TONE: Record<KpiTone, string> = {
  brand: "bg-brand-50 text-brand",
  ok: "bg-ok-bg text-ok-dot",
  warn: "bg-warn-bg text-warn-dot",
  danger: "bg-danger-bg text-danger",
  orange: "bg-orange-bg text-orange-dot",
  "solid-danger": "bg-red-700 text-white",
  teal: "bg-teal-bg text-teal-dot",
};

/** KPI card from the design: label + tinted icon, Poppins value, footnote / link. */
export function KpiCard({
  label,
  value,
  format,
  icon: Icon,
  tone = "brand",
  footnote,
  footnoteClassName,
  href,
  className,
}: {
  label: string;
  value: number;
  format?: (n: number) => string;
  icon: LucideIcon;
  tone?: KpiTone;
  footnote?: ReactNode;
  footnoteClassName?: string;
  href?: string;
  className?: string;
}) {
  const foot = footnote ? (
    href ? (
      <Link href={href} className={cn("text-xs font-medium hover:underline", footnoteClassName)}>
        {footnote} →
      </Link>
    ) : (
      <span className={cn("text-xs font-medium text-ink-500", footnoteClassName)}>{footnote}</span>
    )
  ) : null;
  return (
    <div className={cn("card-surface flex flex-col gap-2 p-5", className)}>
      <div className="flex items-center justify-between gap-2 text-[13px] font-medium text-ink-500">
        <span>{label}</span>
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-[10px]", ICON_TONE[tone])}>
          <Icon className="size-[18px]" aria-hidden />
        </span>
      </div>
      <AnimatedNumber value={value} format={format} className="font-heading text-[26px] font-semibold tracking-[-0.01em] tabular" />
      {foot}
    </div>
  );
}
