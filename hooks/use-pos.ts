"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { DemoDatabase, DiscountInput, Medicine, RxVerification } from "@/lib/types";
import { safeStorage } from "@/lib/storage/safe-storage";
import { getStockIndex, medicineName, planFefoAllocation, sellableBatches } from "@/lib/services/stock";
import { uid } from "@/lib/utils/id";
import { formatDate } from "@/lib/utils/format";

/** Cart for the in-progress sale. Persisted separately from the database so a refresh keeps it. */
export interface CartLine {
  key: string;
  medicineId: string;
  packMultiplier: number;
  packLabel: string;
  qty: number;
}

export interface PackOption {
  multiplier: number;
  label: string;
}

interface PosState {
  lines: CartLine[];
  discount: DiscountInput;
  rx: { key: string; verification: RxVerification } | null;
  heldSaleId: string | null;
  lastAddedKey: string | null;
  set: (patch: Partial<Omit<PosState, "set" | "clear">>) => void;
  clear: () => void;
}

export const usePosStore = create<PosState>()(
  persist(
    (set) => ({
      lines: [],
      discount: { type: "none" },
      rx: null,
      heldSaleId: null,
      lastAddedKey: null,
      set: (patch) => set(patch),
      clear: () => set({ lines: [], discount: { type: "none" }, rx: null, heldSaleId: null, lastAddedKey: null }),
    }),
    {
      name: "yasmar-pos-cart",
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      skipHydration: true,
      partialize: (s) => ({ lines: s.lines, discount: s.discount, rx: s.rx, heldSaleId: s.heldSaleId }),
    }
  )
);

const PACKABLE = new Set(["Tablet", "Capsule", "Softgel", "Sachet", "Nebule", "Lozenge"]);

export function packOptions(m: Medicine): PackOption[] {
  const base: PackOption = { multiplier: 1, label: m.dosageForm === "Softgel" ? "Softgel" : m.dosageForm === "Device" ? "Pack" : m.dosageForm };
  const opts: PackOption[] = [base];
  if (m.stripSize && m.stripSize > 1) opts.push({ multiplier: m.stripSize, label: `Strip ×${m.stripSize}` });
  if (PACKABLE.has(m.dosageForm) && m.packSize > 1 && m.packSize !== m.stripSize) opts.push({ multiplier: m.packSize, label: `Box ×${m.packSize}` });
  return opts;
}

export function unitsInCart(lines: CartLine[], medicineId: string, exceptKey?: string): number {
  return lines.filter((l) => l.medicineId === medicineId && l.key !== exceptKey).reduce((s, l) => s + l.qty * l.packMultiplier, 0);
}

export type AddResult = { ok: true; key: string; warning?: string } | { ok: false; error: string; tone: "warn" | "bad" };

/** Validates against sellable (unexpired, unquarantined) stock and adds one base unit. */
export function addToCart(db: DemoDatabase, medicineId: string, pack?: PackOption): AddResult {
  const s = usePosStore.getState();
  const m = db.medicines.find((x) => x.id === medicineId);
  if (!m) return { ok: false, error: "Medicine not found.", tone: "bad" };
  const name = medicineName(m);
  if (m.status !== "active") return { ok: false, error: `${name} is archived and can't be sold.`, tone: "bad" };
  const info = getStockIndex(db).get(m.id)!;
  if (info.saleable <= 0) {
    return info.hasExpired
      ? { ok: false, error: `${name} — all batches on hand are expired or quarantined. Blocked from sale.`, tone: "bad" }
      : { ok: false, error: `${name} is out of stock.`, tone: "bad" };
  }
  const p = pack ?? packOptions(m)[0];
  const used = unitsInCart(s.lines, m.id);
  if (used + p.multiplier > info.saleable) return { ok: false, error: `Only ${info.saleable} ${m.unit} of ${name} available.`, tone: "warn" };
  const lines = s.lines.slice();
  const i = lines.findIndex((l) => l.medicineId === m.id && l.packMultiplier === p.multiplier);
  let key: string;
  if (i >= 0) {
    lines[i] = { ...lines[i], qty: lines[i].qty + 1 };
    key = lines[i].key;
  } else {
    key = uid("cl");
    lines.push({ key, medicineId: m.id, packMultiplier: p.multiplier, packLabel: p.label, qty: 1 });
  }
  s.set({ lines, lastAddedKey: key });
  const warning =
    info.isExpiring && info.nearestExpiry ? `${name}: nearest batch ${info.nearestBatchNo} expires ${formatDate(info.nearestExpiry)} — dispensed first (FEFO).` : undefined;
  return { ok: true, key, warning };
}

/** Sets a line's quantity / pack, validating stock. Returns an error message when blocked. */
export function updateLine(db: DemoDatabase, key: string, patch: Partial<Pick<CartLine, "qty" | "packMultiplier" | "packLabel">>): string | null {
  const s = usePosStore.getState();
  const idx = s.lines.findIndex((l) => l.key === key);
  if (idx < 0) return null;
  const next = { ...s.lines[idx], ...patch };
  if (!Number.isFinite(next.qty)) return "Enter a valid quantity.";
  next.qty = Math.floor(next.qty);
  if (next.qty <= 0) {
    s.set({ lines: s.lines.filter((l) => l.key !== key) });
    return null;
  }
  const m = db.medicines.find((x) => x.id === next.medicineId)!;
  const info = getStockIndex(db).get(m.id)!;
  const need = unitsInCart(s.lines, m.id, key) + next.qty * next.packMultiplier;
  if (need > info.saleable) return `Not enough stock — ${info.saleable} ${m.unit} of ${medicineName(m)} available.`;
  // Merge with an existing line of the same pack.
  const dup = s.lines.findIndex((l, j) => j !== idx && l.medicineId === next.medicineId && l.packMultiplier === next.packMultiplier);
  const lines = s.lines.slice();
  if (dup >= 0) {
    lines[dup] = { ...lines[dup], qty: lines[dup].qty + next.qty };
    lines.splice(idx, 1);
  } else lines[idx] = next;
  s.set({ lines });
  return null;
}

/** FEFO preview for a cart line (which batches the sale will be taken from). */
export function fefoPreview(db: DemoDatabase, lines: CartLine[], line: CartLine): string {
  const m = db.medicines.find((x) => x.id === line.medicineId);
  if (!m) return "";
  // Units requested by earlier lines of the same medicine are allocated first.
  const before = lines.slice(0, lines.indexOf(line)).filter((l) => l.medicineId === m.id).reduce((s, l) => s + l.qty * l.packMultiplier, 0);
  try {
    const all = planFefoAllocation(sellableBatches(db, m.id), before + line.qty * line.packMultiplier);
    let skip = before;
    const mine = [];
    for (const a of all) {
      if (skip >= a.qty) {
        skip -= a.qty;
        continue;
      }
      mine.push({ ...a, qty: a.qty - skip });
      skip = 0;
    }
    const first = mine[0];
    if (!first) return "";
    return `Batch ${first.batchNo} · Exp ${formatDate(first.expiryDate)}${mine.length > 1 ? ` + ${mine.length - 1} more batch${mine.length > 2 ? "es" : ""}` : ""} · FEFO`;
  } catch {
    return "Insufficient sellable stock";
  }
}

/** Sorted ids of prescription items in the cart — verification is tied to this exact set. */
export function rxKeyFor(db: DemoDatabase, lines: CartLine[]): string {
  const ids = new Set(lines.filter((l) => db.medicines.find((m) => m.id === l.medicineId)?.rxRequired).map((l) => l.medicineId));
  return [...ids].sort().join(",");
}
