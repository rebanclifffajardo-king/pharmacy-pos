import type { PharmacyProfile } from "@/lib/types";
import type { ReportData } from "./report-definitions";

/** Black-on-white A4 layout used for Print and "Save as PDF". Plain HTML so it prints reliably. */
export function PrintableReport({ data, pharmacy, generatedAt, categoryLabel }: { data: ReportData; pharmacy: PharmacyProfile; generatedAt: string; categoryLabel?: string }) {
  const max = Math.max(1, ...(data.chart?.data.map((d) => Math.abs(d.value)) ?? [1]));
  const cell: React.CSSProperties = { padding: "4px 6px", borderBottom: "1px solid #ccc", textAlign: "left", fontSize: "9pt", verticalAlign: "top" };
  return (
    <div style={{ color: "#000", background: "#fff", fontFamily: "Inter, Arial, sans-serif", fontSize: "10pt", lineHeight: 1.35 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #000", paddingBottom: "6px", marginBottom: "10px" }}>
        <div>
          <div style={{ fontSize: "14pt", fontWeight: 700 }}>{pharmacy.name}</div>
          <div style={{ fontSize: "9pt" }}>
            {pharmacy.branch} · {pharmacy.address}, {pharmacy.city}
          </div>
          <div style={{ fontSize: "9pt" }}>TIN: {pharmacy.tin}</div>
        </div>
        <div style={{ textAlign: "right", fontSize: "9pt" }}>
          <div style={{ fontSize: "13pt", fontWeight: 700 }}>{data.meta.name}</div>
          <div>{data.rangeLabel}</div>
          {categoryLabel && <div>Category: {categoryLabel}</div>}
          <div>Generated {generatedAt}</div>
        </div>
      </div>
      <p style={{ margin: "0 0 8px", fontSize: "9pt" }}>{data.meta.description}</p>

      <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
        {data.kpis.map((k) => (
          <div key={k.label} style={{ border: "1px solid #000", padding: "5px 8px", minWidth: "110px", flex: "1 1 0" }}>
            <div style={{ fontSize: "8pt" }}>{k.label}</div>
            <div style={{ fontSize: "11pt", fontWeight: 700 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {data.chart && data.chart.data.length > 0 && (
        <div style={{ marginBottom: "12px", breakInside: "avoid" }}>
          <div style={{ fontWeight: 700, marginBottom: "4px" }}>{data.chart.title}</div>
          {data.chart.data.slice(0, 20).map((d, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "38% 1fr 22%", gap: "6px", alignItems: "center", fontSize: "8.5pt", marginBottom: "2px" }}>
              <span style={{ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{d.label}</span>
              <span style={{ height: "8px", background: "#eee", display: "block" }}>
                <span style={{ display: "block", height: "8px", width: `${(Math.abs(d.value) / max) * 100}%`, background: "#333" }} />
              </span>
              <span style={{ textAlign: "right" }}>{data.chart!.format(d.value)}</span>
            </div>
          ))}
        </div>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {data.columns.map((c) => (
              <th key={c.label} style={{ ...cell, borderBottom: "1.5px solid #000", textAlign: c.align ?? "left", fontWeight: 700 }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r, i) => (
            <tr key={i} style={{ breakInside: "avoid" }}>
              {r.map((v, j) => (
                <td key={j} style={{ ...cell, textAlign: data.columns[j]?.align ?? "left" }}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
          {data.rows.length === 0 && (
            <tr>
              <td colSpan={data.columns.length} style={cell}>
                {data.emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
        {data.totals && data.rows.length > 0 && (
          <tfoot>
            <tr>
              {data.totals.map((v, j) => (
                <td key={j} style={{ ...cell, borderTop: "1.5px solid #000", fontWeight: 700, textAlign: data.columns[j]?.align ?? "left" }}>
                  {v}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
      <p style={{ marginTop: "10px", fontSize: "8pt" }}>Demo Mode · fictional sample data. Gross profit is an estimate, not an accounting statement.</p>
    </div>
  );
}
