"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

/** Tab-like switcher between the two Purchasing routes (design: "Purchase orders | Suppliers · 8"). */
export function PurchasingTabs({ active, supplierCount, canPo = true, canSuppliers = true }: { active: "po" | "suppliers"; supplierCount: number; canPo?: boolean; canSuppliers?: boolean }) {
  const tab = (on: boolean) =>
    cn("inline-flex h-[38px] items-center rounded-[9px] px-3.5 text-[13px] font-semibold transition-colors", on ? "bg-ink text-surface" : "text-ink-700 hover:bg-chip");
  return (
    <nav aria-label="Purchasing" className="inline-flex gap-1 rounded-xl border border-line bg-surface p-1">
      {canPo && (
        <Link href="/purchase-orders" aria-current={active === "po" ? "page" : undefined} className={tab(active === "po")}>
          Purchase orders
        </Link>
      )}
      {canSuppliers && (
        <Link href="/suppliers" aria-current={active === "suppliers" ? "page" : undefined} className={tab(active === "suppliers")}>
          Suppliers · {supplierCount}
        </Link>
      )}
    </nav>
  );
}
