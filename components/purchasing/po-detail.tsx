"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Ban, PackageCheck, Pencil, Printer, Send, Truck } from "lucide-react";
import { toast } from "sonner";
import type { PurchaseOrder, PurchaseOrderStatus } from "@/lib/types";
import { useDb } from "@/lib/store/app-store";
import { actions } from "@/lib/store/actions";
import { useCan } from "@/hooks/use-session";
import { purchaseOrderReceivedValue, purchaseOrderTotal } from "@/lib/services/purchase-order-service";
import { formatDate, formatDateTime, peso, todayKey } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Chip, type ChipTone } from "@/components/shared/chip";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Field, TextInput } from "@/components/shared/field";
import { usePrinter } from "@/components/receipts/print-provider";
import { cn } from "@/lib/utils";
import { PO_STATUS_META } from "./po-meta";
import { PrintablePO } from "./printable-po";

const STEPS: PurchaseOrderStatus[] = ["draft", "ordered", "partially_received", "received"];

interface ReceiveRow {
  qty: string;
  batchNo: string;
  expiryDate: string;
}

export function PoDetail({ po, onEdit }: { po: PurchaseOrder; onEdit: () => void }) {
  const db = useDb();
  const canManage = useCan("po.manage");
  const canReceive = useCan("po.receive");
  const { printNode } = usePrinter();
  const supplier = db.suppliers.find((s) => s.id === po.supplierId);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const receivable = po.status === "ordered" || po.status === "partially_received";
  const cancellable = (po.status === "draft" || po.status === "ordered") && po.lines.every((l) => l.receivedQty === 0);
  const idx = po.status === "cancelled" ? -1 : STEPS.indexOf(po.status);

  const printPo = async () => {
    try {
      await printNode("report", <PrintablePO po={po} supplier={supplier} settings={db.settings} />);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open the print dialog.");
    }
  };

  const send = () => {
    const res = actions.submitPurchaseOrder({ id: po.id });
    if (res.ok) toast.success(`${po.poNumber} sent to ${supplier?.name ?? "supplier"}`);
    else toast.error(res.error);
  };

  return (
    <section className="card-surface flex min-w-0 flex-[999_1_560px] flex-col gap-4 p-5" aria-label={`Purchase order ${po.poNumber}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-xl font-bold">{po.poNumber}</span>
            <Chip tone={PO_STATUS_META[po.status].tone}>{PO_STATUS_META[po.status].label}</Chip>
          </span>
          <span className="text-[13px] text-ink-500">
            {supplier ? (
              <Link href={`/suppliers?supplier=${supplier.id}`} className="font-medium text-ink-700 hover:text-brand-700 hover:underline">
                {supplier.name}
              </Link>
            ) : (
              po.supplierId
            )}{" "}
            · {po.orderedAt ? `ordered ${formatDate(po.orderedAt)}` : `created ${formatDate(po.createdAt)}`} · expected {po.expectedDate ? formatDate(po.expectedDate) : "—"}
          </span>
          <span className="text-xs text-ink-400">Created by {po.createdByName}{po.notes ? ` · ${po.notes}` : ""}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="md" onClick={printPo}>
            <Printer className="size-4" aria-hidden /> Print PO
          </Button>
          {po.status === "draft" && canManage && (
            <>
              <Button variant="outline" size="md" onClick={onEdit}>
                <Pencil className="size-4" aria-hidden /> Edit
              </Button>
              <Button variant="brand" size="md" onClick={send}>
                <Send className="size-4" aria-hidden /> Send to supplier
              </Button>
            </>
          )}
          {cancellable && canManage && (
            <Button variant="danger-soft" size="md" onClick={() => setConfirmCancel(true)}>
              <Ban className="size-4" aria-hidden /> Cancel PO
            </Button>
          )}
        </div>
      </div>

      <ol className="flex overflow-hidden rounded-xl border border-line" aria-label="Order progress">
        {STEPS.map((s, i) => {
          const done = i < idx;
          const cur = i === idx;
          const label = po.status === "cancelled" ? (i === 0 ? "Cancelled" : "—") : cur ? (s === "received" ? "Complete" : "Current") : done ? "Done" : "Pending";
          return (
            <li
              key={s}
              aria-current={cur ? "step" : undefined}
              className={cn(
                "flex min-w-0 flex-1 flex-col gap-0.5 px-3 py-2.5",
                i > 0 && "border-l border-line",
                po.status === "cancelled" ? (i === 0 ? "bg-danger-bg text-danger" : "bg-surface text-ink-400") : done || (cur && s === "received") ? "bg-ok-bg text-ok" : cur ? "bg-brand-50 text-brand-700" : "bg-surface text-ink-400"
              )}
            >
              <span className="truncate text-[11px] font-bold tracking-[0.06em] uppercase">{PO_STATUS_META[s].label}</span>
              <span className="text-xs font-medium">{label}</span>
            </li>
          );
        })}
      </ol>

      {receivable && canReceive ? (
        <ReceivingTable key={`${po.id}-${po.receipts.length}`} po={po} />
      ) : (
        <LinesTable po={po} />
      )}

      {po.receipts.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="font-heading text-sm font-semibold">Receiving history</span>
          <div className="flex flex-col gap-2">
            {po.receipts
              .slice()
              .reverse()
              .map((r) => (
                <div key={r.id} className="rounded-xl border border-line bg-surface-2 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                    <span className="flex items-center gap-2 font-semibold">
                      <PackageCheck className="size-4 text-ok-dot" aria-hidden /> Received {formatDateTime(r.receivedAt)}
                    </span>
                    <span className="text-xs text-ink-500">by {r.receivedByName}</span>
                  </div>
                  <ul className="mt-2 flex flex-col gap-1">
                    {r.lines.map((rl) => {
                      const line = po.lines.find((l) => l.id === rl.lineId);
                      return (
                        <li key={rl.batchId + rl.lineId} className="flex flex-wrap justify-between gap-2 text-xs text-ink-700">
                          <span>
                            {line?.name ?? "Line"} · {rl.qty} pack(s) = {(rl.qty * (line?.packSize ?? 1)).toLocaleString()} units
                          </span>
                          <span className="font-mono text-ink-500">
                            Batch {rl.batchNo} · exp {formatDate(rl.expiryDate)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={`Cancel ${po.poNumber}?`}
        description="The order is closed without any stock movement. This cannot be undone."
        confirmLabel="Cancel purchase order"
        onConfirm={() => {
          const res = actions.cancelPurchaseOrder({ id: po.id, reason: cancelReason });
          if (!res.ok) {
            toast.error(res.error);
            return false;
          }
          toast.success(`${po.poNumber} cancelled`);
          setCancelReason("");
        }}
      >
        <Field label="Reason (optional)">
          <TextInput value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="e.g. Supplier out of stock" />
        </Field>
      </ConfirmDialog>
    </section>
  );
}

function LinesTable({ po }: { po: PurchaseOrder }) {
  const total = purchaseOrderTotal(po);
  const received = purchaseOrderReceivedValue(po);
  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="data-table">
          <thead>
            <tr>
              <th>Medicine</th>
              <th className="text-right!">Ordered</th>
              <th className="text-right!">Unit cost</th>
              <th className="text-right!">Line total</th>
              <th className="text-right!">Received</th>
              <th>Check</th>
            </tr>
          </thead>
          <tbody>
            {po.lines.map((l) => {
              const chk: [string, ChipTone] =
                po.status === "cancelled" || po.status === "draft"
                  ? ["—", "neutral"]
                  : l.receivedQty >= l.qty
                    ? ["Posted", "ok"]
                    : l.receivedQty > 0
                      ? ["Partial", "warn"]
                      : ["Awaiting", "neutral"];
              return (
                <tr key={l.id}>
                  <td className="font-semibold">{l.name}</td>
                  <td className="text-right tabular">
                    {l.qty} × {l.packSize}
                  </td>
                  <td className="text-right tabular">{peso(l.unitCost)}</td>
                  <td className="text-right font-semibold tabular">{peso(l.qty * l.unitCost)}</td>
                  <td className="text-right tabular">
                    {l.receivedQty} / {l.qty}
                  </td>
                  <td>
                    <Chip tone={chk[1]}>{chk[0]}</Chip>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-heading text-lg font-bold tabular">{peso(total)}</span>
          <span className="text-xs text-ink-500">
            {po.status === "received"
              ? "Posted to inventory · batches created with expiry dates"
              : po.status === "cancelled"
                ? "Cancelled — no stock movement"
                : po.status === "draft"
                  ? "Draft — send to supplier to start receiving"
                  : `Received so far ${peso(received)} · receiving requires the po.receive permission`}
          </span>
        </div>
      </div>
    </>
  );
}

function ReceivingTable({ po }: { po: PurchaseOrder }) {
  const today = todayKey();
  const [rows, setRows] = useState<Record<string, ReceiveRow>>(() =>
    Object.fromEntries(po.lines.map((l) => [l.id, { qty: "", batchNo: "", expiryDate: "" }]))
  );
  const set = (id: string, patch: Partial<ReceiveRow>) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));

  const checks = useMemo(
    () =>
      Object.fromEntries(
        po.lines.map((l) => {
          const r = rows[l.id];
          const outstanding = l.qty - l.receivedQty;
          const qty = Number(r.qty) || 0;
          let chk: [string, ChipTone];
          if (outstanding <= 0) chk = ["Posted", "ok"];
          else if (qty <= 0) chk = [l.receivedQty > 0 ? "Partial · awaiting" : "Awaiting", "neutral"];
          else if (!Number.isInteger(qty) || qty > outstanding) chk = [`Max ${outstanding}`, "danger"];
          else if (!r.batchNo.trim()) chk = ["Batch missing", "danger"];
          else if (!r.expiryDate) chk = ["Expiry missing", "danger"];
          else if (r.expiryDate <= today) chk = ["Expired date", "danger"];
          else chk = ["Validated", "ok"];
          return [l.id, chk];
        })
      ) as Record<string, [string, ChipTone]>,
    [po.lines, rows, today]
  );
  const entered = po.lines.filter((l) => (Number(rows[l.id].qty) || 0) > 0);
  const bad = entered.filter((l) => checks[l.id][1] === "danger").length;
  const total = purchaseOrderTotal(po);

  const fillOutstanding = () =>
    setRows((r) => Object.fromEntries(po.lines.map((l) => [l.id, { ...r[l.id], qty: l.qty - l.receivedQty > 0 ? String(l.qty - l.receivedQty) : "" }])));

  const post = () => {
    const res = actions.receivePurchaseOrder({
      id: po.id,
      lines: entered.map((l) => ({ lineId: l.id, qty: Number(rows[l.id].qty), batchNo: rows[l.id].batchNo, expiryDate: rows[l.id].expiryDate })),
    });
    if (!res.ok) return void toast.error(res.error);
    const units = entered.reduce((s, l) => s + Number(rows[l.id].qty) * l.packSize, 0);
    toast.success(res.data.status === "received" ? `${po.poNumber} fully received` : `${po.poNumber} partially received`, {
      description: `${units.toLocaleString()} units posted to inventory as new batches.`,
    });
  };

  const cell = "h-[34px] rounded-lg border px-2 font-mono text-xs outline-none focus:border-brand";
  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="data-table">
          <thead>
            <tr>
              <th>Medicine</th>
              <th className="text-right!">Ordered</th>
              <th className="text-right!">Unit cost</th>
              <th className="text-right!">Line total</th>
              <th>Received</th>
              <th>Receive now</th>
              <th>Batch no.</th>
              <th>Expiry</th>
              <th>Check</th>
            </tr>
          </thead>
          <tbody>
            {po.lines.map((l) => {
              const r = rows[l.id];
              const outstanding = l.qty - l.receivedQty;
              const qty = Number(r.qty) || 0;
              const done = outstanding <= 0;
              const [label, tone] = checks[l.id];
              return (
                <tr key={l.id}>
                  <td className="font-semibold">{l.name}</td>
                  <td className="text-right tabular">
                    {l.qty} × {l.packSize}
                  </td>
                  <td className="text-right tabular">{peso(l.unitCost)}</td>
                  <td className="text-right font-semibold tabular">{peso(l.qty * l.unitCost)}</td>
                  <td className="tabular">
                    {l.receivedQty} / {l.qty}
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={outstanding}
                      step={1}
                      disabled={done}
                      aria-label={`Packs received now for ${l.name}`}
                      placeholder={done ? "—" : String(outstanding)}
                      value={r.qty}
                      onChange={(e) => set(l.id, { qty: e.target.value })}
                      className={cn(cell, "w-[70px] border-line-strong bg-surface disabled:bg-chip")}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      disabled={done}
                      aria-label={`Batch number for ${l.name}`}
                      placeholder={qty > 0 ? "Required" : ""}
                      value={r.batchNo}
                      onChange={(e) => set(l.id, { batchNo: e.target.value.toUpperCase() })}
                      className={cn(cell, "w-[120px] bg-surface disabled:bg-chip", qty > 0 && !r.batchNo.trim() ? "border-danger-dot bg-danger-bg" : "border-line-strong")}
                    />
                  </td>
                  <td>
                    <input
                      type="date"
                      disabled={done}
                      min={today}
                      aria-label={`Expiry date for ${l.name}`}
                      value={r.expiryDate}
                      onChange={(e) => set(l.id, { expiryDate: e.target.value })}
                      className={cn(cell, "w-[140px] bg-surface disabled:bg-chip", qty > 0 && (!r.expiryDate || r.expiryDate <= today) ? "border-danger-dot bg-danger-bg" : "border-line-strong")}
                    />
                  </td>
                  <td>
                    <Chip tone={tone}>{label}</Chip>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-heading text-lg font-bold tabular">{peso(total)}</span>
          <span className="text-xs text-ink-500">
            {bad
              ? `${bad} line(s) need a valid quantity, batch number and future expiry before stock can be posted`
              : entered.length
                ? `${entered.length} line(s) ready · partial receiving is allowed`
                : "Enter received quantities as goods arrive"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="md" onClick={fillOutstanding}>
            <Truck className="size-4" aria-hidden /> Fill outstanding
          </Button>
          <Button variant="success" size="touch" className="h-12 text-sm" disabled={!entered.length || bad > 0} onClick={post}>
            <PackageCheck className="size-4" aria-hidden /> Post received stock to inventory
          </Button>
        </div>
      </div>
    </>
  );
}
