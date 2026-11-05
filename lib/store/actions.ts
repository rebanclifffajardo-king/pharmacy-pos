"use client";

import { useAppStore } from "./app-store";
import { usePosStore } from "@/hooks/use-pos";
import * as tx from "@/lib/services/transaction-service";
import * as refund from "@/lib/services/refund-service";
import * as inv from "@/lib/services/inventory-service";
import * as po from "@/lib/services/purchase-order-service";
import * as admin from "@/lib/services/admin-service";
import type { ActionResult } from "@/lib/types";
import type { CommandContext, CommandResult } from "@/lib/services/context";
import type { DemoDatabase } from "@/lib/types";

type Cmd<I, T> = (db: DemoDatabase, ctx: CommandContext, input: I) => CommandResult<T>;

function bind<I, T>(fn: Cmd<I, T>) {
  return (input: I): ActionResult<T> => useAppStore.getState().run((db, ctx) => fn(db, ctx, input));
}

/**
 * Store actions — the only way UI code mutates demo data. Each returns
 * `{ ok: true, data } | { ok: false, error }` so components can toast the outcome.
 */
export const actions = {
  // Sales
  finalizeSale: bind(tx.finalizeSale),
  voidSale: bind(tx.voidSale),
  recordPrint: bind(tx.recordPrint),
  holdSale: bind(tx.holdSale),
  removeHeldSale: bind(tx.removeHeldSale),
  logCancelledSale: bind(tx.logCancelledSale),
  createRefund: bind(refund.createRefund),

  // Inventory
  addMedicine: bind(inv.addMedicine),
  updateMedicine: bind(inv.updateMedicine),
  setMedicineStatus: bind(inv.setMedicineStatus),
  adjustStock: bind(inv.adjustStock),
  importMedicines: bind(inv.importMedicines),

  // Purchasing
  savePurchaseOrder: bind(po.savePurchaseOrder),
  submitPurchaseOrder: bind(po.submitPurchaseOrder),
  cancelPurchaseOrder: bind(po.cancelPurchaseOrder),
  receivePurchaseOrder: bind(po.receivePurchaseOrder),

  // Admin
  saveSupplier: bind(admin.saveSupplier),
  setSupplierStatus: bind(admin.setSupplierStatus),
  saveUser: bind(admin.saveUser),
  setUserStatus: bind(admin.setUserStatus),
  updateSettings: bind(admin.updateSettings),

  // Session
  signIn(userId: string): ActionResult<string> {
    const s = useAppStore.getState();
    const user = s.db?.users.find((u) => u.id === userId);
    if (!user) return { ok: false, error: "User not found." };
    if (user.status === "inactive") return { ok: false, error: `${user.name}'s account is inactive.` };
    s.setSession(user.id);
    s.runAs(user, (db, ctx) => admin.recordLogin(db, ctx));
    return { ok: true, data: user.id };
  },
  signOut() {
    useAppStore.getState().setSession(null);
  },
  resetDemo() {
    const s = useAppStore.getState();
    const keepUser = s.sessionUserId;
    s.resetDemo();
    usePosStore.getState().clear();
    const db = useAppStore.getState().db;
    if (!db?.users.some((u) => u.id === keepUser && u.status === "active")) s.setSession(null);
  },
};
