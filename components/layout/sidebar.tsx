"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useMemo } from "react";
import { NAV_GROUPS, NAV_ITEMS } from "@/lib/nav";
import { usePermissions } from "@/hooks/use-session";
import { useStockIndex } from "@/hooks/use-inventory";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Sidebar navigation from the design: logo, grouped links, live badges, Demo Mode card, collapse. */
export function Sidebar({
  collapsed,
  onToggle,
  onNavigate,
  className,
  showToggle = true,
}: {
  collapsed: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
  className?: string;
  showToggle?: boolean;
}) {
  const pathname = usePathname();
  const can = usePermissions();
  const index = useStockIndex();
  const badges = useMemo(() => {
    let low = 0;
    let expiring = 0;
    for (const s of index.values()) {
      if (s.isLow) low++;
      if (s.isExpiring) expiring++;
    }
    return { low, expiring };
  }, [index]);

  return (
    <nav
      aria-label="Main"
      className={cn(
        "flex h-full flex-col border-r border-line bg-surface text-ink transition-[width] duration-200 ease-brand",
        collapsed ? "w-[76px]" : "w-[248px]",
        className
      )}
    >
      <div className="flex h-[72px] shrink-0 items-center justify-center border-b border-line px-4">
        <Link href="/dashboard" onClick={onNavigate} aria-label="YasMar Pharmacy — Dashboard" className="dark:rounded-xl dark:bg-white dark:px-2 dark:py-1">
          {collapsed ? (
            <Image src="/brand/yasmar-seal.png" alt="YasMar Pharmacy" width={44} height={44} priority />
          ) : (
            <Image src="/brand/yasmar-logo.png" alt="YasMar Pharmacy — Affordable Medicine, Right Nextdoor" width={200} height={46} priority className="h-auto w-[200px]" />
          )}
        </Link>
      </div>

      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-3.5">
        {NAV_GROUPS.map((group) => {
          const items = NAV_ITEMS.filter((n) => n.group === group && can(n.permission));
          if (!items.length) return null;
          return (
            <div key={group} className="flex flex-col gap-0.5">
              <p className={cn("mx-3 mt-3.5 mb-1.5 text-[11px] font-bold tracking-[0.08em] text-ink-400 uppercase", collapsed && "invisible mx-0 my-1.5 h-1 overflow-hidden")}>{group}</p>
              {items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const count = item.badge === "low" ? badges.low : item.badge === "expiring" ? badges.expiring : 0;
                const link = (
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-sm font-medium transition-colors duration-150",
                      collapsed && "justify-center",
                      active ? "bg-brand-50 font-semibold text-brand-700 shadow-[inset_3px_0_0_var(--brand)]" : "text-ink-700 hover:bg-canvas"
                    )}
                  >
                    <item.icon className="size-5 shrink-0" aria-hidden />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {!collapsed && count > 0 && (
                      <span
                        className={cn(
                          "ml-auto inline-flex h-5 min-w-[22px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold",
                          item.badge === "low" ? "bg-warn-bg text-warn" : "bg-orange-bg text-orange"
                        )}
                        aria-label={`${count} ${item.badge === "low" ? "low-stock" : "expiring"}`}
                      >
                        {count}
                      </span>
                    )}
                    {collapsed && count > 0 && <span className={cn("absolute top-2 right-2.5 size-2 rounded-full", item.badge === "low" ? "bg-warn-dot" : "bg-orange-dot")} aria-hidden />}
                  </Link>
                );
                return collapsed ? (
                  <Tooltip key={item.href}>
                    <TooltipTrigger render={link} />
                    <TooltipContent side="right">{item.label}{count ? ` · ${count}` : ""}</TooltipContent>
                  </Tooltip>
                ) : (
                  <div key={item.href}>{link}</div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="flex shrink-0 flex-col gap-2.5 border-t border-line p-3">
        {!collapsed && (
          <div className="flex flex-col gap-0.5 rounded-xl border border-warn-line bg-warn-bg px-3 py-2.5">
            <span className="text-[11px] font-bold tracking-[0.06em] text-warn uppercase">Demo Mode</span>
            <span className="text-xs leading-snug text-warn">Sample data · no live payments or printer</span>
          </div>
        )}
        {showToggle && onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-11 items-center justify-center gap-2 rounded-[10px] border border-line bg-surface text-[13px] font-medium text-ink-700 hover:bg-canvas"
          >
            <ChevronLeft className={cn("size-[18px] transition-transform duration-200", collapsed && "rotate-180")} aria-hidden />
            {!collapsed && <span>Collapse</span>}
          </button>
        )}
      </div>
    </nav>
  );
}
