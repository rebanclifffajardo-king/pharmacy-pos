import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type ChipTone = "ok" | "warn" | "danger" | "orange" | "neutral" | "brand" | "teal" | "solid-danger" | "ink" | "demo";

const TONES: Record<ChipTone, { box: string; dot: string }> = {
  ok: { box: "bg-ok-bg text-ok", dot: "bg-ok-dot" },
  warn: { box: "bg-warn-bg text-warn", dot: "bg-warn-dot" },
  danger: { box: "bg-danger-bg text-danger", dot: "bg-danger-dot" },
  orange: { box: "bg-orange-bg text-orange", dot: "bg-orange-dot" },
  neutral: { box: "bg-neutral-bg text-neutral", dot: "bg-neutral-dot" },
  brand: { box: "bg-brand-50 text-brand-700", dot: "bg-brand" },
  teal: { box: "bg-teal-bg text-teal", dot: "bg-teal-dot" },
  "solid-danger": { box: "bg-red-700 text-white", dot: "bg-white" },
  ink: { box: "bg-ink text-surface", dot: "bg-surface" },
  demo: { box: "bg-warn-bg text-warn", dot: "bg-warn-dot" },
};

/** Status pill from the design system (22px, 11px semibold). */
export function Chip({
  tone = "neutral",
  dot,
  children,
  className,
  size = "md",
  title,
}: {
  tone?: ChipTone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
  title?: string;
}) {
  const t = TONES[tone];
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap",
        size === "sm" && "h-[18px] px-[7px] text-[10px]",
        size === "md" && "h-[22px] px-2 text-[11px]",
        size === "lg" && "h-[26px] px-2.5 text-xs",
        t.box,
        className
      )}
    >
      {dot && <i className={cn("block size-1.5 shrink-0 rounded-full", t.dot)} aria-hidden />}
      {children}
    </span>
  );
}

export function RxChip({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <Chip tone="brand" size={size} title="Prescription required — pharmacist verification">
      Rx
    </Chip>
  );
}

export function DemoChip({ children = "Demo Mode", className }: { children?: ReactNode; className?: string }) {
  return (
    <Chip tone="demo" dot size="lg" className={className}>
      {children}
    </Chip>
  );
}
