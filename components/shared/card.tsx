import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** White rounded card from the design (16px radius, 1px line, soft shadow). */
export function SectionCard({ title, subtitle, actions, children, className, bodyClassName, as: As = "section" }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string; as?: "section" | "div" | "aside" }) {
  return (
    <As className={cn("card-surface flex min-w-0 flex-col", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
          <div className="flex min-w-0 flex-col gap-0.5">
            {title && <h3 className="font-heading text-base font-semibold">{title}</h3>}
            {subtitle && <span className="text-xs text-ink-500">{subtitle}</span>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn("flex min-w-0 flex-col p-5", bodyClassName)}>{children}</div>
    </As>
  );
}

export function StatTile({ label, value, className, valueClassName }: { label: ReactNode; value: ReactNode; className?: string; valueClassName?: string }) {
  return (
    <div className={cn("flex flex-col gap-1 rounded-[14px] bg-canvas p-4", className)}>
      <span className="text-xs text-ink-500">{label}</span>
      <span className={cn("font-heading text-[22px] font-semibold tabular", valueClassName)}>{value}</span>
    </div>
  );
}
