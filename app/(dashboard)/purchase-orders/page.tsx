"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ClipboardList, Plus, X } from "lucide-react";
import type { PurchaseOrder, PurchaseOrderStatus } from "@/lib/types";
import { PageShell } from "@/components/layout/app-shell";
import { LoadingScreen } from "@/components/layout/hydration-gate";
import { useDb } from "@/lib/store/app-store";
import { useCan } from "@/hooks/use-session";
import { purchaseOrderTotal } from "@/lib/services/purchase-order-service";
import { formatDate, peso } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/shared/chip";
import { FilterPills } from "@/components/shared/segmented";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState } from "@/components/shared/empty-state";
import { PurchasingTabs } from "@/components/purchasing/purchasing-tabs";
import { PO_STATUS_META, PO_STATUS_ORDER } from "@/components/purchasing/po-meta";
import { PoDetail } from "@/components/purchasing/po-detail";
import { PoFormDialog, type PoPrefill } from "@/components/purchasing/po-form-dialog";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | PurchaseOrderStatus;

export default function PurchaseOrdersPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <PageShell permission="po.view" title="Purchase Orders" subtitle="Purchase orders, receiving and suppliers">
        <PurchaseOrdersView />
      </PageShell>
    </Suspense>
  );
}

function PurchaseOrdersView() {
  const db = useDb();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const canManage = useCan("po.manage");
  const canSuppliers = useCan("suppliers.view");
  const detailRef = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState<StatusFilter>("all");
  const [supplierFilter, setSupplierFilter] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [selId, setSelId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseOrder | null>(null);
  const [prefill, setPrefill] = useState<PoPrefill | undefined>();

  // Apply URL parameters whenever they change (deep links from global search, alerts, suppliers).
  const paramKey = params.toString();
  const [seenKey, setSeenKey] = useState<string | null>(null);
  if (seenKey !== paramKey) {
    setSeenKey(paramKey);
    const po = params.get("po");
    const st = params.get("status");
    const sup = params.get("supplier");
    if (po) setSelId(po);
    if (st && (st === "all" || (PO_STATUS_ORDER as string[]).includes(st))) setStatus(st as StatusFilter);
    if (params.get("new") === "1") {
      setEditing(null);
      setPrefill({ supplierId: sup ?? undefined, medicineId: params.get("medicine") ?? undefined });
      setFormOpen(true);
    } else if (sup) setSupplierFilter(sup);
  }

  const supplierById = useMemo(() => new Map(db.suppliers.map((s) => [s.id, s])), [db.suppliers]);
  const sorted = useMemo(() => db.purchaseOrders.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)), [db.purchaseOrders]);
  const base = useMemo(() => {
    const term = q.trim().toLowerCase();
    return sorted.filter(
      (p) =>
        (!supplierFilter || p.supplierId === supplierFilter) &&
        (!term || `${p.poNumber} ${supplierById.get(p.supplierId)?.name ?? ""} ${p.lines.map((l) => l.name).join(" ")}`.toLowerCase().includes(term))
    );
  }, [sorted, q, supplierFilter, supplierById]);
  const list = status === "all" ? base : base.filter((p) => p.status === status);
  const selected = list.find((p) => p.id === selId) ?? list[0];

  const pills = [
    { value: "all" as StatusFilter, label: "All", count: base.length },
    ...PO_STATUS_ORDER.map((s) => ({ value: s as StatusFilter, label: PO_STATUS_META[s].label, count: base.filter((p) => p.status === s).length })),
  ];

  const openNew = () => {
    setEditing(null);
    setPrefill(supplierFilter ? { supplierId: supplierFilter } : undefined);
    setFormOpen(true);
  };

  const select = (id: string) => {
    setSelId(id);
    if (typeof window !== "undefined" && window.innerWidth < 1024) setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PurchasingTabs active="po" supplierCount={db.suppliers.length} canSuppliers={canSuppliers} />
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="PO number, supplier or medicine" className="w-[280px] max-w-full" />
          {canManage && (
            <Button variant="brand" size="md" onClick={openNew}>
              <Plus className="size-4" aria-hidden /> New purchase order
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterPills value={status} onChange={setStatus} options={pills} />
        {supplierFilter && (
          <button
            type="button"
            onClick={() => {
              setSupplierFilter(null);
              if (params.get("supplier")) router.replace(pathname);
            }}
            className="inline-flex h-[38px] items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 text-[13px] font-semibold text-brand-700"
          >
            Supplier: {supplierById.get(supplierFilter)?.name ?? "Unknown"} <X className="size-3.5" aria-label="Clear supplier filter" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div className="card-surface flex w-full flex-[1_1_320px] flex-col gap-1 p-2 lg:max-w-[400px]" role="list" aria-label="Purchase orders">
          {list.length === 0 && <EmptyState icon={ClipboardList} title="No purchase orders" description={q || supplierFilter ? "Try a different search or filter." : "No purchase orders with this status."} className="py-8" />}
          {list.map((p) => {
            const cur = p.id === selected?.id;
            return (
              <button
                key={p.id}
                type="button"
                role="listitem"
                aria-current={cur ? "true" : undefined}
                onClick={() => select(p.id)}
                className={cn(
                  "flex w-full flex-col gap-1.5 rounded-xl p-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-brand",
                  cur ? "bg-brand-50 shadow-[inset_3px_0_0_var(--brand)]" : "bg-surface hover:bg-surface-2"
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[13px] font-bold">{p.poNumber}</span>
                  <Chip tone={PO_STATUS_META[p.status].tone}>{PO_STATUS_META[p.status].label}</Chip>
                </span>
                <span className="text-sm font-semibold">{supplierById.get(p.supplierId)?.name ?? p.supplierId}</span>
                <span className="text-xs text-ink-500">
                  {p.lines.length} line{p.lines.length === 1 ? "" : "s"} · {formatDate(p.orderedAt ?? p.createdAt)} · <b className="text-ink">{peso(purchaseOrderTotal(p))}</b>
                </span>
              </button>
            );
          })}
        </div>
        <div ref={detailRef} className="flex min-w-0 flex-[999_1_560px] scroll-mt-24">
          {selected ? (
            <PoDetail
              key={selected.id}
              po={selected}
              onEdit={() => {
                setEditing(selected);
                setPrefill(undefined);
                setFormOpen(true);
              }}
            />
          ) : (
            <div className="card-surface flex-1">
              <EmptyState icon={ClipboardList} title="Select a purchase order" description="Choose an order on the left to see its lines and receive stock." />
            </div>
          )}
        </div>
      </div>

      <PoFormDialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o && params.get("new")) router.replace(pathname);
        }}
        editing={editing}
        prefill={prefill}
        onSaved={(po) => {
          setStatus("all");
          setSupplierFilter(null);
          setQ("");
          setSelId(po.id);
        }}
      />
    </>
  );
}
