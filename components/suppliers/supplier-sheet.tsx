"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ClipboardList, Mail, MapPin, Pencil, Phone, Plus, Power } from "lucide-react";
import type { Supplier } from "@/lib/types";
import { useDb } from "@/lib/store/app-store";
import { useStockIndex } from "@/hooks/use-inventory";
import { useCan } from "@/hooks/use-session";
import { medicineName } from "@/lib/services/stock";
import { purchaseOrderTotal } from "@/lib/services/purchase-order-service";
import { formatDate, peso } from "@/lib/utils/format";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/shared/chip";
import { StockStatusChip } from "@/components/shared/stock-status-chip";
import { LinkButton } from "@/components/shared/link-button";
import { PO_STATUS_META } from "@/components/purchasing/po-meta";
import { supplierInitials, type SupplierStats } from "./supplier-stats";

export function SupplierSheet({
  supplier,
  stats,
  open,
  onOpenChange,
  onEdit,
  onToggleStatus,
}: {
  supplier: Supplier | null;
  stats?: SupplierStats;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onEdit: () => void;
  onToggleStatus: () => void;
}) {
  const db = useDb();
  const index = useStockIndex();
  const canManage = useCan("suppliers.manage");
  const canPo = useCan("po.view");
  const canCreatePo = useCan("po.manage");
  const canInventory = useCan("inventory.view");

  const meds = useMemo(() => (supplier ? db.medicines.filter((m) => m.supplierId === supplier.id).sort((a, b) => medicineName(a).localeCompare(medicineName(b))) : []), [db.medicines, supplier]);
  const pos = useMemo(() => (supplier ? db.purchaseOrders.filter((p) => p.supplierId === supplier.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) : []), [db.purchaseOrders, supplier]);

  return (
    <Sheet open={open && !!supplier} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-[520px]">
        {supplier && (
          <div className="flex flex-col gap-5 p-5">
            <div className="flex items-center gap-3 pr-8">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-50 font-heading text-[15px] font-bold text-brand-700">{supplierInitials(supplier.name, supplier.code)}</span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <SheetTitle className="font-heading text-lg font-semibold">{supplier.name}</SheetTitle>
                <SheetDescription className="text-xs text-ink-500">
                  {supplier.code} · {supplier.city} · since {formatDate(supplier.createdAt)}
                </SheetDescription>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Chip tone={supplier.status === "active" ? "ok" : "neutral"} dot>
                {supplier.status === "active" ? "Active" : "Inactive"}
              </Chip>
              <Chip tone="brand">{supplier.paymentTerms}</Chip>
              <Chip tone="neutral">Lead time {supplier.leadTimeDays} day{supplier.leadTimeDays === 1 ? "" : "s"}</Chip>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-0.5 rounded-xl bg-canvas p-3">
                <span className="text-xs text-ink-500">SKUs</span>
                <span className="font-heading text-lg font-bold">{stats?.skus ?? 0}</span>
              </div>
              <div className="flex flex-col gap-0.5 rounded-xl bg-canvas p-3">
                <span className="text-xs text-ink-500">Received YTD</span>
                <span className="font-heading text-sm leading-7 font-bold">{peso(stats?.ytdReceived ?? 0)}</span>
              </div>
              <div className="flex flex-col gap-0.5 rounded-xl bg-canvas p-3">
                <span className="text-xs text-ink-500">Open POs</span>
                <span className="font-heading text-lg font-bold">{stats?.openPos ?? 0}</span>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-3 text-[13px] sm:grid-cols-2">
              <Info label="Contact person">{supplier.contactPerson}</Info>
              <Info label="TIN">{supplier.tin || "—"}</Info>
              <Info label="Phone">
                <a href={`tel:${supplier.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1.5 hover:text-brand-700">
                  <Phone className="size-3.5" aria-hidden /> {supplier.phone || "—"}
                </a>
              </Info>
              <Info label="E-mail">
                {supplier.email ? (
                  <a href={`mailto:${supplier.email}`} className="inline-flex items-center gap-1.5 break-all hover:text-brand-700">
                    <Mail className="size-3.5 shrink-0" aria-hidden /> {supplier.email}
                  </a>
                ) : (
                  "—"
                )}
              </Info>
              <Info label="Address" className="sm:col-span-2">
                <span className="inline-flex items-start gap-1.5">
                  <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {[supplier.address, supplier.city].filter(Boolean).join(", ") || "—"}
                </span>
              </Info>
              {supplier.notes && (
                <Info label="Notes" className="sm:col-span-2">
                  {supplier.notes}
                </Info>
              )}
            </dl>

            <div className="flex flex-wrap gap-2">
              {canCreatePo && supplier.status === "active" && (
                <LinkButton href={`/purchase-orders?new=1&supplier=${supplier.id}`} variant="brand" size="md">
                  <Plus className="size-4" aria-hidden /> New PO for this supplier
                </LinkButton>
              )}
              {canManage && (
                <>
                  <Button variant="outline" size="md" onClick={onEdit}>
                    <Pencil className="size-4" aria-hidden /> Edit
                  </Button>
                  <Button variant={supplier.status === "active" ? "danger-soft" : "soft"} size="md" onClick={onToggleStatus}>
                    <Power className="size-4" aria-hidden /> {supplier.status === "active" ? "Deactivate" : "Reactivate"}
                  </Button>
                </>
              )}
            </div>

            <section className="flex flex-col gap-2">
              <h3 className="font-heading text-sm font-semibold">Supplied medicines · {meds.length}</h3>
              <div className="flex flex-col overflow-hidden rounded-xl border border-line">
                {meds.length === 0 && <span className="px-3 py-4 text-[13px] text-ink-500">No medicines are assigned to this supplier.</span>}
                {meds.map((m) => {
                  const info = index.get(m.id);
                  const body = (
                    <>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-[13px] font-semibold">{medicineName(m)}</span>
                        <span className="truncate text-xs text-ink-500">
                          {m.sku} · {info?.saleable.toLocaleString() ?? 0} {m.unit} on hand · reorder at {m.minStock}
                        </span>
                      </span>
                      {info && <StockStatusChip status={info.status} />}
                    </>
                  );
                  return canInventory ? (
                    <Link key={m.id} href={`/inventory?medicine=${m.id}`} className="flex items-center justify-between gap-3 border-b border-line-soft px-3 py-2.5 last:border-b-0 hover:bg-canvas">
                      {body}
                    </Link>
                  ) : (
                    <div key={m.id} className="flex items-center justify-between gap-3 border-b border-line-soft px-3 py-2.5 last:border-b-0">
                      {body}
                    </div>
                  );
                })}
              </div>
            </section>

            {canPo && (
              <section className="flex flex-col gap-2">
                <h3 className="font-heading text-sm font-semibold">Purchase orders · {pos.length}</h3>
                <div className="flex flex-col overflow-hidden rounded-xl border border-line">
                  {pos.length === 0 && (
                    <span className="flex items-center gap-2 px-3 py-4 text-[13px] text-ink-500">
                      <ClipboardList className="size-4" aria-hidden /> No purchase orders yet.
                    </span>
                  )}
                  {pos.map((p) => (
                    <Link key={p.id} href={`/purchase-orders?po=${p.id}`} className="flex items-center justify-between gap-3 border-b border-line-soft px-3 py-2.5 last:border-b-0 hover:bg-canvas">
                      <span className="flex min-w-0 flex-col">
                        <span className="font-mono text-[13px] font-bold">{p.poNumber}</span>
                        <span className="text-xs text-ink-500">
                          {formatDate(p.orderedAt ?? p.createdAt)} · {p.lines.length} line(s) · {peso(purchaseOrderTotal(p))}
                        </span>
                      </span>
                      <Chip tone={PO_STATUS_META[p.status].tone}>{PO_STATUS_META[p.status].label}</Chip>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Info({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex min-w-0 flex-col gap-0.5 ${className ?? ""}`}>
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className="font-medium text-ink">{children}</dd>
    </div>
  );
}
