"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Menu, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import type { Medicine, RxVerification, SaleTransaction } from "@/lib/types";
import { useDb } from "@/lib/store/app-store";
import { actions } from "@/lib/store/actions";
import { computeTotals } from "@/lib/services/pricing";
import { medicineName } from "@/lib/services/stock";
import type { PaymentInput } from "@/lib/services/transaction-service";
import { padNumber, uid } from "@/lib/utils/id";
import { int, peso } from "@/lib/utils/format";
import { ROLE_LABEL } from "@/lib/auth/permissions";
import { addToCart, rxKeyFor, usePosStore, type CartLine } from "@/hooks/use-pos";
import { useStockIndex } from "@/hooks/use-inventory";
import { useCurrentUser } from "@/hooks/use-session";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import { useShell } from "@/components/layout/app-shell";
import { CategoryChips, PosSearchBar, ProductGrid, filterProducts } from "./product-grid";
import { CartPanel } from "./cart-panel";
import { RxVerifyDialog } from "./rx-verify-dialog";
import { HeldSalesButton } from "./held-sales";
import { SaleCompleteDialog } from "./sale-complete-dialog";
import { PaymentDialog } from "@/components/payments/payment-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DemoChip } from "@/components/shared/chip";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Field, TextInput } from "@/components/shared/field";

export function PosScreen() {
  const db = useDb();
  const index = useStockIndex();
  const user = useCurrentUser();
  const { openMobileNav } = useShell();
  const lines = usePosStore((s) => s.lines);
  const discount = usePosStore((s) => s.discount);
  const rx = usePosStore((s) => s.rx);
  const heldSaleId = usePosStore((s) => s.heldSaleId);

  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [stage, setStage] = useState<"browse" | "rx" | "pay" | "done">("browse");
  const [idemKey, setIdemKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [doneTx, setDoneTx] = useState<SaleTransaction | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [holdOpen, setHoldOpen] = useState(false);
  const [holdLabel, setHoldLabel] = useState("");
  const [cartSheet, setCartSheet] = useState(false);
  const finalizing = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Restore an unfinished cart after refresh.
  useEffect(() => {
    void usePosStore.persist.rehydrate();
  }, []);

  // Drop cart lines whose medicine no longer exists (e.g. after Reset Demo Data).
  useEffect(() => {
    const valid = lines.filter((l) => db.medicines.some((m) => m.id === l.medicineId));
    if (valid.length !== lines.length) usePosStore.getState().set({ lines: valid });
  }, [db.medicines, lines]);

  const used = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lines) m.set(l.medicineId, (m.get(l.medicineId) ?? 0) + l.qty * l.packMultiplier);
    return m;
  }, [lines]);

  const products = useMemo(() => filterProducts(db.medicines, index, used, query, cat, inStockOnly), [db.medicines, index, used, query, cat, inStockOnly]);

  const pricedLines = useMemo(
    () => lines.map((l) => ({ lineTotal: (db.medicines.find((m) => m.id === l.medicineId)?.sellingPrice ?? 0) * l.packMultiplier * l.qty })),
    [lines, db.medicines]
  );
  const totals = useMemo(() => computeTotals(pricedLines, discount, db.settings.pos), [pricedLines, discount, db.settings.pos]);
  const rxKey = useMemo(() => rxKeyFor(db, lines), [db, lines]);
  const rxCount = rxKey ? rxKey.split(",").length : 0;
  const needsRx = rxCount > 0 && rx?.key !== rxKey;
  const itemCount = lines.reduce((s, l) => s + l.qty, 0);
  const nextRef = db.settings.pos.receiptPrefix + padNumber(db.settings.pos.nextReceiptNo, db.settings.pos.receiptPadding);

  const canManualOk = discount.type !== "manual" || !db.settings.pos.manualDiscountRequiresApproval || !!discount.approvedById;
  const idMissing = (discount.type === "senior" || discount.type === "pwd") && !discount.idNumber?.trim();
  const blockReason = !lines.length
    ? ""
    : needsRx
      ? "Pharmacist verification required before payment"
      : idMissing
        ? `Enter the ${discount.type === "senior" ? "Senior Citizen" : "PWD"} ID number to apply the discount`
        : !canManualOk
          ? "Manual discount needs approval"
          : totals.total <= 0
            ? "Total must be above zero"
            : "";

  const add = useCallback(
    (m: Medicine): boolean => {
      const r = addToCart(db, m.id);
      if (!r.ok) {
        if (r.tone === "bad") toast.error(r.error);
        else toast.warning(r.error);
        return false;
      }
      if (r.warning) toast.warning(r.warning, { id: "fefo-" + m.id });
      return true;
    },
    [db]
  );

  const lookup = useCallback(
    (code: string): Medicine | undefined => {
      const v = code.trim().toLowerCase();
      return db.medicines.find((p) => p.barcode === v || p.sku.toLowerCase() === v);
    },
    [db.medicines]
  );

  const onSearchEnter = () => {
    const v = query.trim();
    if (!v) return;
    const hit = lookup(v) ?? (products.length === 1 ? products[0].m : undefined);
    if (hit) {
      add(hit);
      setQuery("");
    } else if (/^\d{8,}$/.test(v)) {
      // Unknown scanned barcode: clear so the next scan doesn't append to it.
      setQuery("");
      toast.error(`Barcode ${v} not found in the catalog.`);
    } else toast.warning(`No exact match for “${v}”. Keep typing or tap a medicine.`);
  };

  useBarcodeScanner(
    (code) => {
      const hit = lookup(code);
      if (hit) {
        if (add(hit)) toast.success(`Scanned ${medicineName(hit)}`, { id: "scan" });
      } else toast.error(`Barcode ${code} not found in the catalog.`);
    },
    { enabled: stage === "browse" }
  );

  // Keyboard: "/" focuses search, F2 opens payment.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const inField = t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT";
      if (e.key === "/" && !inField && stage === "browse") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage]);

  const openPay = () => {
    if (blockReason || !lines.length) return;
    setIdemKey(uid("idem"));
    setCartSheet(false);
    setStage("pay");
  };

  const complete = (payment: PaymentInput) => {
    if (finalizing.current) return; // guards double clicks before React re-renders
    finalizing.current = true;
    setSubmitting(true);
    const res = actions.finalizeSale({
      idempotencyKey: idemKey,
      lines: lines.map((l) => ({ medicineId: l.medicineId, packMultiplier: l.packMultiplier, packLabel: l.packLabel, qty: l.qty })),
      discount,
      payment,
      rxVerification: rx?.key === rxKey ? rx.verification : undefined,
      heldSaleId: heldSaleId ?? undefined,
    });
    setSubmitting(false);
    if (!res.ok) {
      finalizing.current = false;
      toast.error("Sale not completed", { description: res.error });
      return;
    }
    usePosStore.getState().clear();
    setDoneTx(res.data.transaction);
    setStage("done");
    toast.success(`Sale ${res.data.transaction.receiptNo} recorded`, { description: `${peso(res.data.transaction.total)} · stock deducted (FEFO)` });
  };

  const newSale = () => {
    finalizing.current = false;
    setDoneTx(null);
    setStage("browse");
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  const hold = () => {
    const r = actions.holdSale({
      lines: lines.map(({ medicineId, packMultiplier, packLabel, qty }) => ({ medicineId, packMultiplier, packLabel, qty })),
      discount,
      label: holdLabel,
    });
    if (!r.ok) return void toast.error(r.error);
    if (heldSaleId) actions.removeHeldSale({ id: heldSaleId });
    usePosStore.getState().clear();
    setHoldOpen(false);
    setHoldLabel("");
    toast.info(`${r.data.label} held`, { description: "Resume it from “Held sales”." });
  };

  const resume = (id: string) => {
    const h = db.heldSales.find((x) => x.id === id);
    if (!h) return;
    const s = usePosStore.getState();
    if (s.lines.length) {
      const r = actions.holdSale({ lines: s.lines.map(({ medicineId, packMultiplier, packLabel, qty }) => ({ medicineId, packMultiplier, packLabel, qty })), discount: s.discount, label: "Swapped sale" });
      if (!r.ok) return void toast.error(r.error);
      if (s.heldSaleId) actions.removeHeldSale({ id: s.heldSaleId });
    }
    const restored: CartLine[] = h.lines
      .filter((l) => db.medicines.some((m) => m.id === l.medicineId))
      .map((l) => ({ key: uid("cl"), ...l }));
    s.set({ lines: restored, discount: h.discount, rx: null, heldSaleId: h.id, lastAddedKey: null });
    // Removing from the held list happens when the sale completes or is re-held.
    toast.info(`Resumed ${h.label}`, { description: "Stock is re-checked at payment." });
  };

  const cancelSale = () => {
    actions.logCancelledSale({ items: itemCount, total: totals.total });
    if (heldSaleId) actions.removeHeldSale({ id: heldSaleId });
    usePosStore.getState().clear();
    toast.info("Sale cancelled · recorded in the activity log");
  };

  const cart = (
    <CartPanel
      db={db}
      totals={totals}
      nextRef={nextRef}
      needsRx={needsRx}
      rxCount={rxCount}
      blockReason={blockReason}
      onHold={() => setHoldOpen(true)}
      onCancel={() => setConfirmCancel(true)}
      onVerifyRx={() => setStage("rx")}
      onCharge={openPay}
      className="h-full"
    />
  );

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:flex-row lg:overflow-hidden">
      <section aria-label="Medicine selection" className="flex min-w-0 flex-1 flex-col lg:h-full">
        <div className="flex flex-col gap-3 border-b border-line bg-surface px-4 pt-4 pb-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={openMobileNav} aria-label="Open navigation" className="grid size-[52px] place-items-center rounded-xl border border-line text-ink-700 md:hidden">
              <Menu className="size-5" />
            </button>
            <Image src="/brand/yasmar-logo.png" alt="YasMar Pharmacy" width={140} height={32} className="h-8 w-auto md:hidden" />
            <PosSearchBar ref={searchRef} value={query} onChange={setQuery} onEnter={onSearchEnter} />
            <div className="flex items-center gap-2">
              <HeldSalesButton
                db={db}
                onResume={resume}
                onDelete={(id) => {
                  actions.removeHeldSale({ id });
                  if (heldSaleId === id) usePosStore.getState().set({ heldSaleId: null });
                  toast.info("Held sale discarded");
                }}
              />
              <div className="hidden flex-col items-end px-1.5 sm:flex">
                <span className="text-sm font-semibold">{user?.name}</span>
                <span className="text-[11px] font-medium text-ink-500">
                  {user ? ROLE_LABEL[user.role] : ""} · {db.settings.pos.counterName}
                </span>
              </div>
            </div>
          </div>
          <CategoryChips categories={db.categories} value={cat} onChange={setCat} inStockOnly={inStockOnly} onInStockOnly={setInStockOnly} />
        </div>
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-28 sm:px-5 lg:pb-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] font-medium text-ink-500">
              {int(products.length)} medicines{cat !== "all" ? ` in ${db.categories.find((c) => c.id === cat)?.name}` : ""}
              {query ? ` matching “${query}”` : ""}
            </span>
            <DemoChip>Demo catalog · fictional prices &amp; barcodes</DemoChip>
          </div>
          <ProductGrid products={products} onAdd={add} query={query} />
        </div>
      </section>

      <div className="hidden w-full max-w-[460px] min-w-[380px] flex-[0_1_440px] border-l border-line lg:block">{cart}</div>

      {/* Mobile / tablet: sticky "View cart" bar (MobilePOS design) */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setCartSheet(true)}
          className="flex h-[58px] w-full items-center justify-between rounded-2xl bg-brand px-[18px] text-white shadow-[0_10px_24px_rgba(34,60,255,.30)]"
        >
          <span className="flex items-center gap-2.5">
            <span className="grid h-7 min-w-7 place-items-center rounded-full bg-white/20 px-1.5 text-[13px] font-bold">{itemCount}</span>
            <span className="flex items-center gap-1.5 text-[15px] font-semibold">
              <ShoppingCart className="size-4" aria-hidden /> View cart
            </span>
          </span>
          <span className="font-heading text-lg font-bold tabular">{peso(totals.total)}</span>
        </button>
      </div>
      <Sheet open={cartSheet} onOpenChange={setCartSheet}>
        <SheetContent side="bottom" className="h-[92dvh] gap-0 rounded-t-2xl p-0">
          <SheetTitle className="sr-only">Current sale</SheetTitle>
          {cart}
        </SheetContent>
      </Sheet>

      <RxVerifyDialog
        open={stage === "rx"}
        onOpenChange={(o) => setStage(o ? "rx" : "browse")}
        db={db}
        lines={lines}
        onVerified={(v: RxVerification) => usePosStore.getState().set({ rx: { key: rxKey, verification: v } })}
      />
      <PaymentDialog
        open={stage === "pay"}
        onOpenChange={(o) => setStage(o ? "pay" : "browse")}
        totals={totals}
        itemCount={itemCount}
        reference={nextRef}
        idempotencyKey={idemKey}
        submitting={submitting}
        onComplete={complete}
      />
      <SaleCompleteDialog tx={doneTx} open={stage === "done"} onNewSale={newSale} />
      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel this sale?"
        description={`${itemCount} item${itemCount === 1 ? "" : "s"} · ${peso(totals.total)} will be cleared. No stock moves; the cancellation is written to the activity log.`}
        confirmLabel="Cancel sale"
        onConfirm={cancelSale}
      />
      <ConfirmDialog open={holdOpen} onOpenChange={setHoldOpen} title="Hold this sale?" description="Park the cart and serve the next customer. Stock is re-checked when you resume." confirmLabel="Hold sale" tone="brand" onConfirm={hold}>
        <Field label="Label (optional)">
          <TextInput value={holdLabel} onChange={(e) => setHoldLabel(e.target.value)} placeholder="e.g. Customer in red shirt" autoFocus />
        </Field>
      </ConfirmDialog>
    </div>
  );
}
