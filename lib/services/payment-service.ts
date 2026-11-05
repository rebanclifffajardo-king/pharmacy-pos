/**
 * Demo payment providers.
 *
 * Nothing here talks to a real QR Ph acquirer or card terminal. Each provider exposes the
 * same small interface a live integration would implement (create intent → wait for a
 * provider-verified result), and every result is flagged `simulated: true`.
 *
 * Live replacements must confirm payments server-side (webhook / acquirer API) — a QR
 * being displayed or scanned is never proof of payment, and this app never collects
 * card numbers, CVV or PIN.
 */
import { padNumber } from "@/lib/utils/id";

export type DemoOutcome = "approved" | "declined";

export interface QrPhIntent {
  reference: string;
  amount: number;
  /** Payload encoded in the on-screen demo QR (not a valid QR Ph / EMVCo payload). */
  payload: string;
  expiresAt: number;
}

export interface CardResult {
  approved: boolean;
  approvalCode?: string;
  cardLast4?: string;
  message: string;
}

function rand(n: number) {
  const a = new Uint32Array(1);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(a);
  else a[0] = Math.floor(Math.random() * 2 ** 32);
  return a[0] % n;
}

export const demoQrPhProvider = {
  name: "Demo QR Ph (simulated)",
  createIntent(amount: number, receiptHint: string): QrPhIntent {
    const reference = "DEMO-QR-" + padNumber(rand(1e8), 8);
    return {
      reference,
      amount,
      payload: `DEMO|QRPH|YASMAR|${receiptHint}|${amount.toFixed(2)}|${reference}`,
      expiresAt: Date.now() + 5 * 60 * 1000,
    };
  },
  /** Simulates the acquirer's callback. */
  async simulate(intent: QrPhIntent, outcome: DemoOutcome, delayMs = 900): Promise<{ paid: boolean; reference?: string; message: string }> {
    await new Promise((r) => setTimeout(r, delayMs));
    return outcome === "approved"
      ? { paid: true, reference: intent.reference, message: "Paid — confirmed by provider (simulated)" }
      : { paid: false, message: "Payment failed or expired (simulated). Ask the customer to retry." };
  },
};

export const demoCardTerminal = {
  name: "Demo terminal T-01 (simulated)",
  async simulate(outcome: DemoOutcome, delayMs = 1200): Promise<CardResult> {
    await new Promise((r) => setTimeout(r, delayMs));
    if (outcome === "declined") return { approved: false, message: "Issuer declined (simulated). Try again or use another method." };
    return {
      approved: true,
      approvalCode: "DEMO-AUTH-" + padNumber(rand(1e6), 6),
      cardLast4: padNumber(rand(1e4), 4),
      message: "Approved (simulated)",
    };
  },
};

/** Deterministic pseudo-QR module grid for the on-screen demo code (25×25). */
export function demoQrModules(payload: string, size = 25): boolean[] {
  let seed = 0;
  for (let i = 0; i < payload.length; i++) seed = (seed * 31 + payload.charCodeAt(i)) >>> 0;
  const cells: boolean[] = [];
  const finder = (r: number, c: number): boolean | null => {
    const box = (r0: number, c0: number) => {
      const y = r - r0,
        x = c - c0;
      if (y < 0 || x < 0 || y > 6 || x > 6) return null;
      return y === 0 || y === 6 || x === 0 || x === 6 || (y >= 2 && y <= 4 && x >= 2 && x <= 4);
    };
    const a = box(0, 0),
      b = box(0, size - 7),
      d = box(size - 7, 0);
    return a ?? b ?? d;
  };
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++) {
      const f = finder(r, c);
      seed = (seed * 9301 + 49297) % 233280;
      cells.push(f !== null ? f : r === 7 || c === 7 || r === size - 8 || c === size - 8 ? false : seed / 233280 > 0.52);
    }
  return cells;
}
