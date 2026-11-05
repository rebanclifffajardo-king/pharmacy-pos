import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({ icon: Icon, title, description, action, className }: { icon: LucideIcon; title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2.5 px-6 py-12 text-center", className)}>
      <span className="grid size-14 place-items-center rounded-full bg-brand-50 text-brand">
        <Icon className="size-6" aria-hidden />
      </span>
      <span className="text-[15px] font-semibold text-ink">{title}</span>
      {description && <span className="max-w-sm text-[13px] text-ink-500">{description}</span>}
      {action}
    </div>
  );
}
