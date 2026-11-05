"use client";

import { Suspense, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, Truck } from "lucide-react";
import { toast } from "sonner";
import type { Supplier } from "@/lib/types";
import { PageShell } from "@/components/layout/app-shell";
import { LoadingScreen } from "@/components/layout/hydration-gate";
import { useDb } from "@/lib/store/app-store";
import { actions } from "@/lib/store/actions";
import { useCan } from "@/hooks/use-session";
import { peso } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/shared/chip";
import { FilterPills } from "@/components/shared/segmented";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PurchasingTabs } from "@/components/purchasing/purchasing-tabs";
import { SupplierFormDialog } from "@/components/suppliers/supplier-form-dialog";
import { SupplierSheet } from "@/components/suppliers/supplier-sheet";
import { supplierInitials, supplierStats } from "@/components/suppliers/supplier-stats";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "active" | "inactive";

export default function SuppliersPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <PageShell permission="suppliers.view" title="Suppliers" subtitle="Purchase orders, receiving and suppliers">
        <SuppliersView />
      </PageShell>
    </Suspense>
  );
}

function SuppliersView() {
  const db = useDb();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const canManage = useCan("suppliers.manage");
  const canPo = useCan("po.view");

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [confirm, setConfirm] = useState<Supplier | null>(null);

  // Deep link: ?supplier=<id> opens that supplier (from global search / other pages).
  const paramKey = params.toString();
  const [seenKey, setSeenKey] = useState<string | null>(null);
  if (seenKey !== paramKey) {
    setSeenKey(paramKey);
    const sid = params.get("supplier");
    if (sid) setOpenId(sid);
  }

  const stats = useMemo(() => supplierStats(db), [db]);
  const base = useMemo(() => {
    const term = q.trim().toLowerCase();
    return db.suppliers
      .filter((s) => !term || `${s.name} ${s.code} ${s.contactPerson} ${s.city} ${s.email} ${s.phone}`.toLowerCase().includes(term))
      .sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === "active" ? -1 : 1));
  }, [db.suppliers, q]);
  const list = status === "all" ? base : base.filter((s) => s.status === status);
  const openSupplier = db.suppliers.find((s) => s.id === openId) ?? null;

  const closeSheet = (o: boolean) => {
    if (o) return;
    setOpenId(null);
    if (params.get("supplier")) router.replace(pathname);
  };

  const toggleStatus = (s: Supplier) => {
    const next = s.status === "active" ? "inactive" : "active";
    const res = actions.setSupplierStatus({ id: s.id, status: next });
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    toast.success(`${s.name} ${next === "active" ? "reactivated" : "deactivated"}`);
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PurchasingTabs active="suppliers" supplierCount={db.suppliers.length} canPo={canPo} />
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Name, contact, city or e-mail" className="w-[280px] max-w-full" />
          {canManage && (
            <Button
              variant="brand"
              size="md"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" aria-hidden /> Add supplier
            </Button>
          )}
        </div>
      </div>

      <FilterPills
        value={status}
        onChange={setStatus}
        options={[
          { value: "all", label: "All", count: base.length },
          { value: "active", label: "Active", count: base.filter((s) => s.status === "active").length, dotClass: "bg-ok-dot" },
          { value: "inactive", label: "Inactive", count: base.filter((s) => s.status === "inactive").length, dotClass: "bg-neutral-dot" },
        ]}
      />

      {list.length === 0 ? (
        <div className="card-surface">
          <EmptyState icon={Truck} title="No suppliers found" description="Try a different search or status filter." />
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-3.5">
          {list.map((s) => {
            const st = stats.get(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setOpenId(s.id)}
                aria-label={`Open supplier ${s.name}`}
                className={cn(
                  "card-surface flex flex-col gap-3 p-[18px] text-left transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:border-brand-200 hover:shadow-[0_6px_18px_rgba(34,60,255,.10)] focus-visible:outline-2 focus-visible:outline-brand",
                  s.status === "inactive" && "opacity-70"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 font-heading text-sm font-bold text-brand-700">{supplierInitials(s.name, s.code)}</span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-semibold">{s.name}</span>
                    <span className="text-xs text-ink-500">{s.city}</span>
                  </div>
                  {s.status === "inactive" && <Chip tone="neutral">Inactive</Chip>}
                </div>
                <div className="flex flex-col gap-1 text-[13px] font-medium text-ink-700">
                  <span>{s.contactPerson}</span>
                  <span className="truncate">
                    {s.phone} · {s.email}
                  </span>
                </div>
                <div className="flex justify-between gap-2 border-t border-line-soft pt-2.5 text-xs font-medium text-ink-500">
                  <span>{st?.skus ?? 0} SKUs supplied</span>
                  <span>{peso(st?.ytdReceived ?? 0)} YTD</span>
                  <span className={cn(st?.openPos ? "text-brand-700" : "")}>{st?.openPos ?? 0} open POs</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <SupplierSheet
        supplier={openSupplier}
        stats={openSupplier ? stats.get(openSupplier.id) : undefined}
        open={!!openSupplier}
        onOpenChange={closeSheet}
        onEdit={() => {
          if (!openSupplier) return;
          setEditing(openSupplier);
          setFormOpen(true);
        }}
        onToggleStatus={() => openSupplier && setConfirm(openSupplier)}
      />

      <SupplierFormDialog open={formOpen} onOpenChange={setFormOpen} supplier={editing} onSaved={(s) => setOpenId(s.id)} />

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.status === "active" ? `Deactivate ${confirm?.name}?` : `Reactivate ${confirm?.name}?`}
        description={
          confirm?.status === "active"
            ? "Inactive suppliers can’t receive new purchase orders. Existing orders and history are kept."
            : "The supplier will be available again for new purchase orders."
        }
        confirmLabel={confirm?.status === "active" ? "Deactivate" : "Reactivate"}
        tone={confirm?.status === "active" ? "danger" : "brand"}
        onConfirm={() => (confirm ? toggleStatus(confirm) : false)}
      />
    </>
  );
}
