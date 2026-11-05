import type { DiscountInput, PosSettings } from "@/lib/types";
import { round2 } from "@/lib/utils/format";

/**
 * Demo pricing rules.
 *
 * DISCLAIMER: These are configurable demonstration calculations. They are NOT a legally
 * verified implementation of Philippine VAT, Senior Citizen (RA 9994) or PWD (RA 10754)
 * rules. A production system must be validated with the pharmacy's accountant / BIR.
 *
 * Prices are VAT-inclusive. Default rules:
 *   Regular:   total = subtotal; VATable = subtotal / (1 + VAT); VAT = subtotal − VATable
 *   Manual:    total = subtotal − discount; VAT is recomputed on the discounted total
 *   SC / PWD:  net = subtotal / (1 + VAT) (VAT removed), discount = net × rate, total = net − discount
 */

export interface TotalsInputLine {
  lineTotal: number;
}

export interface Totals {
  subtotal: number;
  discountType: DiscountInput["type"];
  discountRate: number;
  discountAmount: number;
  lessVat: number;
  vatableSales: number;
  vatAmount: number;
  vatExemptSales: number;
  total: number;
  /** Human label for the discount row, e.g. "Senior citizen 20%". */
  discountLabel: string;
}

export function computeTotals(lines: TotalsInputLine[], discount: DiscountInput, pos: PosSettings): Totals {
  const subtotal = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
  const vat = pos.vatRate / 100;

  if ((discount.type === "senior" || discount.type === "pwd") && subtotal > 0) {
    const rate = (discount.type === "senior" ? pos.seniorDiscountRate : pos.pwdDiscountRate) / 100;
    const label = (discount.type === "senior" ? "Senior citizen " : "PWD ") + Math.round(rate * 100) + "%";
    if (pos.scPwdVatExempt) {
      const net = round2(subtotal / (1 + vat));
      const lessVat = round2(subtotal - net);
      const discountAmount = round2(net * rate);
      const total = round2(net - discountAmount);
      return {
        subtotal,
        discountType: discount.type,
        discountRate: rate,
        discountAmount,
        lessVat,
        vatableSales: 0,
        vatAmount: 0,
        vatExemptSales: net,
        total,
        discountLabel: label,
      };
    }
    const discountAmount = round2(subtotal * rate);
    const total = round2(subtotal - discountAmount);
    const vatableSales = round2(total / (1 + vat));
    return {
      subtotal,
      discountType: discount.type,
      discountRate: rate,
      discountAmount,
      lessVat: 0,
      vatableSales,
      vatAmount: round2(total - vatableSales),
      vatExemptSales: 0,
      total,
      discountLabel: label,
    };
  }

  if (discount.type === "manual" && subtotal > 0) {
    let discountAmount = 0;
    let rate = 0;
    if (discount.manualPercent && discount.manualPercent > 0) {
      rate = Math.min(discount.manualPercent, pos.maxManualDiscountPercent) / 100;
      discountAmount = round2(subtotal * rate);
    } else if (discount.manualAmount && discount.manualAmount > 0) {
      discountAmount = round2(Math.min(discount.manualAmount, subtotal * (pos.maxManualDiscountPercent / 100)));
      rate = subtotal ? discountAmount / subtotal : 0;
    }
    const total = round2(subtotal - discountAmount);
    const vatableSales = round2(total / (1 + vat));
    return {
      subtotal,
      discountType: "manual",
      discountRate: rate,
      discountAmount,
      lessVat: 0,
      vatableSales,
      vatAmount: round2(total - vatableSales),
      vatExemptSales: 0,
      total,
      discountLabel: "Manual discount" + (rate ? ` ${(rate * 100).toFixed(rate * 100 % 1 ? 1 : 0)}%` : ""),
    };
  }

  const vatableSales = round2(subtotal / (1 + vat));
  return {
    subtotal,
    discountType: "none",
    discountRate: 0,
    discountAmount: 0,
    lessVat: 0,
    vatableSales,
    vatAmount: round2(subtotal - vatableSales),
    vatExemptSales: 0,
    total: subtotal,
    discountLabel: "",
  };
}

/** Peso amount refundable for `qty` base units of a sale line, pro-rated for transaction-level discounts. */
export function refundAmountFor(
  line: { lineTotal: number; baseQty: number },
  qty: number,
  tx: { subtotal: number; total: number }
): number {
  if (line.baseQty <= 0 || tx.subtotal <= 0) return 0;
  const ratio = tx.total / tx.subtotal;
  return round2((line.lineTotal / line.baseQty) * qty * ratio);
}

/** Quick cash denominations for a total (Exact, next ₱50, ₱100, ₱500, ₱1000). */
export function quickCashOptions(total: number): number[] {
  const t = round2(total);
  if (t <= 0) return [];
  const opts = [t, Math.ceil(t / 50) * 50, Math.ceil(t / 100) * 100, Math.ceil(t / 500) * 500, Math.ceil(t / 1000) * 1000];
  const unique = opts.filter((v, i, a) => a.indexOf(v) === i);
  while (unique.length < 5) unique.push(unique[unique.length - 1] + 1000);
  return unique.slice(0, 5);
}
