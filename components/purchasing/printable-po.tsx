import type { PurchaseOrder, Settings, Supplier } from "@/lib/types";
import { purchaseOrderTotal } from "@/lib/services/purchase-order-service";
import { formatDate, formatDateTime, money } from "@/lib/utils/format";
import { PO_STATUS_META } from "./po-meta";

/** A4 black-on-white purchase order for the browser print dialog. */
export function PrintablePO({ po, supplier, settings }: { po: PurchaseOrder; supplier?: Supplier; settings: Settings }) {
  const p = settings.pharmacy;
  const cell: React.CSSProperties = { border: "1px solid #000", padding: "4px 6px", fontSize: "10pt" };
  return (
    <div style={{ color: "#000", background: "#fff", fontFamily: "Inter, Arial, sans-serif", fontSize: "10pt" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #000", paddingBottom: 8, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: "16pt", fontWeight: 700 }}>{p.name}</div>
          <div>{p.branch}</div>
          <div>{p.address}, {p.city}</div>
          <div>Tel: {p.phone} · {p.email}</div>
          <div>TIN: {p.tin}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "18pt", fontWeight: 700 }}>PURCHASE ORDER</div>
          <div style={{ fontFamily: "monospace", fontSize: "12pt" }}>{po.poNumber}</div>
          <div>Status: {PO_STATUS_META[po.status].label}</div>
          <div>Created: {formatDate(po.createdAt)}</div>
          {po.orderedAt && <div>Ordered: {formatDate(po.orderedAt)}</div>}
          {po.expectedDate && <div>Expected: {formatDate(po.expectedDate)}</div>}
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700 }}>Supplier</div>
        <div>{supplier?.name ?? po.supplierId}</div>
        {supplier && (
          <>
            <div>{supplier.address}, {supplier.city}</div>
            <div>Attn: {supplier.contactPerson} · {supplier.phone} · {supplier.email}</div>
            <div>Terms: {supplier.paymentTerms}</div>
          </>
        )}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["#", "Medicine", "Pack size", "Qty (packs)", "Unit cost / pack", "Line total", "Received"].map((h) => (
              <th key={h} style={{ ...cell, textAlign: "left", background: "#eee" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {po.lines.map((l, i) => (
            <tr key={l.id}>
              <td style={cell}>{i + 1}</td>
              <td style={cell}>{l.name}</td>
              <td style={cell}>{l.packSize}</td>
              <td style={{ ...cell, textAlign: "right" }}>{l.qty}</td>
              <td style={{ ...cell, textAlign: "right" }}>{money(l.unitCost)}</td>
              <td style={{ ...cell, textAlign: "right" }}>{money(l.qty * l.unitCost)}</td>
              <td style={{ ...cell, textAlign: "right" }}>{l.receivedQty}</td>
            </tr>
          ))}
          <tr>
            <td style={{ ...cell, fontWeight: 700, textAlign: "right" }} colSpan={5}>TOTAL (PHP)</td>
            <td style={{ ...cell, fontWeight: 700, textAlign: "right" }}>{money(purchaseOrderTotal(po))}</td>
            <td style={cell} />
          </tr>
        </tbody>
      </table>
      {po.notes && <p style={{ marginTop: 12 }}>Notes: {po.notes}</p>}
      <div style={{ display: "flex", gap: 40, marginTop: 40 }}>
        <div style={{ flex: 1, borderTop: "1px solid #000", paddingTop: 4 }}>Prepared by: {po.createdByName}</div>
        <div style={{ flex: 1, borderTop: "1px solid #000", paddingTop: 4 }}>Approved by</div>
        <div style={{ flex: 1, borderTop: "1px solid #000", paddingTop: 4 }}>Received by</div>
      </div>
      <p style={{ marginTop: 24, fontSize: "8pt" }}>Printed {formatDateTime(new Date())} · Demo Mode sample document — not a binding purchase order.</p>
    </div>
  );
}
