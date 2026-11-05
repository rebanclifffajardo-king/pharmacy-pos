import type { SaleTransaction, Settings } from "@/lib/types";
import { money, TIMEZONE } from "@/lib/utils/format";

/**
 * Builds a monospace thermal receipt as text lines. The same line model can later be
 * encoded to ESC/POS bytes (see lib/printing/escpos.ts) so preview and hardware output match.
 *
 * Layout targets ~32 characters per line (58mm paper, Font A). 42/48 columns are supported
 * for condensed fonts or 80mm printers via Settings › Printer.
 */
export interface ReceiptLine {
  text: string;
  bold?: boolean;
  /** Double-height emphasis (rendered larger in preview). */
  large?: boolean;
}

export interface ReceiptOptions {
  reprint?: boolean;
  /** Copy number for reprints. */
  copyNo?: number;
}

function makeLayout(width: number) {
  const W = width;
  const center = (s: string) => {
    s = s.slice(0, W);
    const p = Math.floor((W - s.length) / 2);
    return " ".repeat(p) + s;
  };
  const lr = (a: string, b: string) => {
    const space = W - a.length - b.length;
    if (space >= 1) return a + " ".repeat(space) + b;
    return a.slice(0, Math.max(0, W - b.length - 1)) + " " + b;
  };
  const wrap = (s: string, indent = "") => {
    const words = s.split(/\s+/).filter(Boolean);
    const out: string[] = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? cur + " " + w : w;
      if (next.length <= W - (out.length ? indent.length : 0)) cur = next;
      else {
        if (cur) out.push((out.length ? indent : "") + cur);
        cur = w.length > W ? w.slice(0, W) : w;
      }
    }
    if (cur) out.push((out.length ? indent : "") + cur);
    return out;
  };
  const wrapCenter = (s: string) => wrap(s).map(center);
  const dash = "-".repeat(W);
  return { W, center, lr, wrap, wrapCenter, dash };
}

function headerLines(settings: Settings, L: ReturnType<typeof makeLayout>): ReceiptLine[] {
  const p = settings.pharmacy;
  const out: ReceiptLine[] = [{ text: L.center(p.name.toUpperCase()), bold: true, large: true }];
  for (const s of [p.branch, p.address, p.city]) if (s) out.push(...L.wrapCenter(s).map((text) => ({ text })));
  if (p.phone) out.push({ text: L.center("Tel: " + p.phone) });
  if (p.tin) out.push(...L.wrapCenter("TIN: " + p.tin).map((text) => ({ text })));
  if (p.ltoNumber) out.push(...L.wrapCenter("FDA LTO: " + p.ltoNumber).map((text) => ({ text })));
  return out;
}

function footerLines(settings: Settings, L: ReturnType<typeof makeLayout>): ReceiptLine[] {
  const pr = settings.printer;
  const p = settings.pharmacy;
  const out: ReceiptLine[] = [];
  if (pr.footerMessage) out.push(...L.wrapCenter(pr.footerMessage).map((text) => ({ text, bold: true })));
  if (pr.footerMessage2) out.push(...L.wrapCenter(pr.footerMessage2).map((text) => ({ text })));
  out.push({ text: L.dash });
  if (p.birPermit) out.push(...L.wrapCenter(p.birPermit).map((text) => ({ text })));
  if (p.serialNo) out.push(...L.wrapCenter(p.serialNo).map((text) => ({ text })));
  out.push(...L.wrapCenter("DEMO - NOT AN OFFICIAL RECEIPT").map((text) => ({ text, bold: true })));
  return out;
}

export function receiptDateParts(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { timeZone: TIMEZONE, month: "2-digit", day: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit" });
  return { date, time };
}

export function buildReceiptLines(tx: SaleTransaction, settings: Settings, opts: ReceiptOptions = {}): ReceiptLine[] {
  const L = makeLayout(settings.printer.charsPerLine);
  const out: ReceiptLine[] = [...headerLines(settings, L)];
  const push = (text: string, bold = false) => out.push({ text, bold });
  const { date, time } = receiptDateParts(tx.createdAt);
  const vatPct = settings.pos.vatRate;

  push(L.dash);
  push(L.center(opts.reprint ? "SALES RECEIPT - REPRINT" : "SALES RECEIPT"), true);
  push(L.dash);
  push("Receipt No: " + tx.receiptNo);
  push(L.lr("Date: " + date, time));
  for (const s of L.wrap("Cashier: " + tx.cashierName, "  ")) push(s);
  push("Terminal: " + settings.pos.counterName);
  push(L.dash);
  push(L.lr("ITEM", "AMOUNT"), true);
  push(L.dash);
  for (const l of tx.lines) {
    for (const s of L.wrap(l.name + (l.rxRequired ? " (Rx)" : ""), "  ")) push(s);
    const unitPrice = l.unitPrice * l.packMultiplier;
    const qtyLabel = l.packMultiplier > 1 ? `${l.qty} ${l.packLabel.replace(/\s*×.*$/, "").toLowerCase()}` : String(l.qty);
    push(L.lr(`  ${qtyLabel} x ${money(unitPrice)}`, money(l.lineTotal)));
  }
  push(L.dash);
  push(L.lr("SUBTOTAL", money(tx.subtotal)));
  if (tx.discountType === "senior" || tx.discountType === "pwd") {
    const lbl = tx.discountType === "senior" ? "SC" : "PWD";
    if (tx.lessVat) push(L.lr(`LESS VAT ${vatPct}%`, "-" + money(tx.lessVat)));
    push(L.lr(`${lbl} DISC ${Math.round(tx.discountRate * 100)}%`, "-" + money(tx.discountAmount)));
  } else if (tx.discountType === "manual") {
    push(L.lr(`DISCOUNT ${(tx.discountRate * 100).toFixed(tx.discountRate * 100 % 1 ? 1 : 0)}%`, "-" + money(tx.discountAmount)));
  }
  out.push({ text: L.lr("TOTAL", money(tx.total)), bold: true, large: true });
  push(L.dash);
  push(L.lr("VATABLE SALES", money(tx.vatableSales)));
  push(L.lr(`VAT ${vatPct}%`, money(tx.vatAmount)));
  push(L.lr("VAT-EXEMPT SALES", money(tx.vatExemptSales)));
  push(L.lr("ZERO-RATED SALES", money(0)));
  push(L.dash);

  const p = tx.payment;
  if (p.method === "cash") {
    push("PAYMENT: CASH", true);
    push(L.lr("CASH", money(p.tendered ?? tx.total)));
    push(L.lr("CHANGE", money(p.change ?? 0)));
  } else if (p.method === "qrph") {
    push("PAYMENT: QR PH (DEMO)", true);
    push(L.lr("REF", p.reference ?? "-"));
  } else {
    push("PAYMENT: CARD (DEMO)", true);
    if (p.cardLast4) push(L.lr("CARD", "**** " + p.cardLast4));
    push(L.lr("APPROVAL", p.approvalCode ?? "-"));
  }
  if (p.simulated && p.method !== "cash") push(L.center("SIMULATED PAYMENT"));

  if (tx.discountType === "senior" || tx.discountType === "pwd") {
    push(L.dash);
    push(tx.discountType === "senior" ? "SC/OSCA ID:" : "PWD ID:");
    push("  " + (tx.discountIdNumber ?? "-"));
    push("Name: " + (tx.customerName ?? "_______________"));
    push("Signature: _____________");
  }
  if (tx.rxVerification) {
    push(L.dash);
    for (const s of L.wrap("Rx verified by " + tx.rxVerification.pharmacistName, "  ")) push(s);
    for (const s of L.wrap("Prescriber: " + tx.rxVerification.prescriber, "  ")) push(s);
  }
  if (tx.refundedAmount > 0) {
    push(L.dash);
    push(L.lr("REFUNDED", "-" + money(tx.refundedAmount)), true);
    push(L.lr("NET AFTER REFUND", money(tx.total - tx.refundedAmount)));
  }
  if (tx.status === "voided") {
    push(L.dash);
    push(L.center("*** VOIDED ***"), true);
  }
  push(L.dash);
  out.push(...footerLines(settings, L));
  if (opts.reprint) out.push({ text: L.center(`REPRINT COPY #${opts.copyNo ?? 1}`), bold: true });
  return out;
}

export function buildTestReceiptLines(settings: Settings, now = new Date()): ReceiptLine[] {
  const L = makeLayout(settings.printer.charsPerLine);
  const { date, time } = receiptDateParts(now.toISOString());
  const ruler = Array.from({ length: L.W }, (_, i) => String((i + 1) % 10)).join("");
  return [
    ...headerLines(settings, L),
    { text: L.dash },
    { text: L.center("TEST PRINT"), bold: true, large: true },
    { text: L.dash },
    { text: L.lr("Date: " + date, time) },
    { text: "Printer: " + settings.printer.model.slice(0, L.W - 9) },
    { text: `Paper: ${settings.printer.paperWidthMm}mm · ${L.W} cols` },
    { text: L.dash },
    { text: ruler },
    { text: L.lr("LEFT", "RIGHT") },
    { text: L.center("CENTER") },
    { text: "Bold sample: ₱1,234.56", bold: true },
    { text: "ABCDEFGHIJKLMNOPQRSTUVWXYZ".slice(0, L.W) },
    { text: "abcdefghijklmnopqrstuvwxyz".slice(0, L.W) },
    { text: L.dash },
    ...footerLines(settings, L),
  ];
}
