"use client";

import type { Settings } from "@/lib/types";
import type { ReceiptLine } from "@/lib/services/receipt-service";
import { cn } from "@/lib/utils";

/**
 * Monochrome 58mm thermal receipt.
 *  - variant "preview": on-screen paper at ~1.4× with a torn bottom edge.
 *  - variant "print":   exact paper width in mm for the browser print dialog.
 */
export function ThermalReceipt({
  lines,
  settings,
  variant = "preview",
  className,
}: {
  lines: ReceiptLine[];
  settings: Settings;
  variant?: "preview" | "print";
  className?: string;
}) {
  const pr = settings.printer;
  const cols = pr.charsPerLine;
  const logo = settings.pharmacy.logoDataUrl || "/brand/yasmar-seal.png";

  if (variant === "print") {
    const printable = pr.paperWidthMm - 10 - pr.sideMarginMm * 2 + 4; // ≈48mm on 58mm paper
    const fontMm = printable / (cols * 0.6);
    return (
      <div
        className="receipt-print"
        style={{
          width: `${pr.paperWidthMm}mm`,
          padding: `2mm ${Math.max(1, pr.sideMarginMm + 3)}mm 6mm`,
          boxSizing: "border-box",
          color: "#000",
          background: "#fff",
          fontFamily: "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace",
        }}
      >
        {pr.showLogo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" style={{ display: "block", width: "18mm", height: "18mm", objectFit: "contain", margin: "0 auto 2mm", filter: "grayscale(1) contrast(1.6)" }} />
        )}
        <div style={{ fontSize: `${fontMm.toFixed(2)}mm`, lineHeight: 1.35, width: `${cols}ch`, margin: "0 auto" }}>
          {lines.map((l, i) => (
            <div key={i} style={{ whiteSpace: "pre", fontWeight: l.bold ? 700 : 400, fontSize: l.large ? "1.12em" : undefined }}>
              {l.text || " "}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Preview: paper 306px wide (58mm × ~1.4) with text auto-fitted to the column count.
  const paperPx = pr.paperWidthMm === 80 ? 400 : 306;
  const marginPx = 8 + pr.sideMarginMm * 5.3;
  const fontPx = Math.min(pr.fontSizePx * 1.2, (paperPx - 2 * marginPx) / (cols * 0.602));
  return (
    <div
      className={cn("relative mx-auto flex flex-col items-center gap-2 bg-white shadow-[0_10px_30px_rgba(15,23,51,.14)]", className)}
      style={{ width: paperPx, padding: `14px ${marginPx}px 22px` }}
      aria-label="58mm receipt preview"
    >
      {pr.showLogo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="Pharmacy logo, printed monochrome" className="size-[72px] object-contain" style={{ filter: "grayscale(1) contrast(1.6)" }} />
      )}
      <div className="font-mono text-[#111]" style={{ fontSize: fontPx, lineHeight: 1.45, width: `${cols}ch` }}>
        {lines.map((l, i) => (
          <div key={i} className="whitespace-pre" style={{ fontWeight: l.bold ? 700 : 400, fontSize: l.large ? "1.08em" : undefined }}>
            {l.text || " "}
          </div>
        ))}
      </div>
      <span
        aria-hidden
        className="absolute inset-x-0 -bottom-2 h-2"
        style={{
          background:
            "linear-gradient(-45deg, transparent 6px, #fff 0) 0 0/12px 8px repeat-x, linear-gradient(45deg, transparent 6px, #fff 0) 0 0/12px 8px repeat-x",
        }}
      />
    </div>
  );
}
