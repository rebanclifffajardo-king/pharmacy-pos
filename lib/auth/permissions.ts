import type { Role } from "@/lib/types";

/**
 * Demo role-based UI permissions.
 *
 * IMPORTANT: These checks run in the browser only. They shape the demo UI and are NOT a
 * security boundary. In production every rule here must be enforced server-side
 * (Supabase Row Level Security + checks inside database functions).
 */
export type Permission =
  | "dashboard.view"
  | "pos.sell"
  | "pos.manualDiscount"
  | "rx.authorize"
  | "sales.view"
  | "sales.reprint"
  | "sales.refund"
  | "sales.void"
  | "inventory.view"
  | "inventory.edit"
  | "inventory.price"
  | "stock.view"
  | "stock.adjust"
  | "stock.approve"
  | "po.view"
  | "po.manage"
  | "po.receive"
  | "suppliers.view"
  | "suppliers.manage"
  | "reports.view"
  | "users.view"
  | "users.manage"
  | "settings.view"
  | "settings.manage";

const ALL: Permission[] = [
  "dashboard.view",
  "pos.sell",
  "pos.manualDiscount",
  "rx.authorize",
  "sales.view",
  "sales.reprint",
  "sales.refund",
  "sales.void",
  "inventory.view",
  "inventory.edit",
  "inventory.price",
  "stock.view",
  "stock.adjust",
  "stock.approve",
  "po.view",
  "po.manage",
  "po.receive",
  "suppliers.view",
  "suppliers.manage",
  "reports.view",
  "users.view",
  "users.manage",
  "settings.view",
  "settings.manage",
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: ALL,
  manager: ALL.filter((p) => !["users.manage", "settings.manage", "sales.void"].includes(p)),
  pharmacist: [
    "dashboard.view",
    "pos.sell",
    "rx.authorize",
    "sales.view",
    "sales.reprint",
    "sales.refund",
    "inventory.view",
    "inventory.edit",
    "stock.view",
    "stock.adjust",
    "po.view",
    "suppliers.view",
    "reports.view",
  ],
  cashier: ["dashboard.view", "pos.sell", "sales.view", "sales.reprint", "inventory.view"],
  inventory: [
    "dashboard.view",
    "inventory.view",
    "inventory.edit",
    "stock.view",
    "stock.adjust",
    "po.view",
    "po.manage",
    "po.receive",
    "suppliers.view",
    "suppliers.manage",
  ],
};

export function hasPermission(role: Role | undefined | null, p: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(p);
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrator",
  pharmacist: "Pharmacist",
  cashier: "Cashier",
  inventory: "Inventory Staff",
  manager: "Manager",
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  admin: "Full access, approvals, users and settings",
  pharmacist: "Rx verification, dispensing, refunds and batches",
  cashier: "Point of sale, held sales and reprints",
  inventory: "Stock, batches, purchase orders and suppliers",
  manager: "Operations, reports, purchasing and approvals",
};

/** Default landing page after demo sign-in. */
export const ROLE_HOME: Record<Role, string> = {
  admin: "/dashboard",
  manager: "/dashboard",
  pharmacist: "/inventory",
  cashier: "/pos",
  inventory: "/stock-management",
};

/** Matrix shown on the User Management page: F full · A approval/limited · N none. */
export const PERMISSION_MATRIX: { capability: string; note: string; marks: Record<Role, "F" | "A" | "N"> }[] = [
  { capability: "Process sales at POS", note: "Scan, cart, take payment", marks: { admin: "F", manager: "F", pharmacist: "F", cashier: "F", inventory: "N" } },
  { capability: "Hold, resume and cancel sales", note: "Cancel is logged", marks: { admin: "F", manager: "F", pharmacist: "F", cashier: "F", inventory: "N" } },
  { capability: "Authorize Rx dispensing", note: "Pharmacist PIN required", marks: { admin: "A", manager: "A", pharmacist: "F", cashier: "N", inventory: "N" } },
  { capability: "Apply SC / PWD discount", note: "ID number recorded", marks: { admin: "F", manager: "F", pharmacist: "F", cashier: "F", inventory: "N" } },
  { capability: "Apply manual discount", note: "Admin PIN at the counter", marks: { admin: "F", manager: "F", pharmacist: "A", cashier: "A", inventory: "N" } },
  { capability: "Refund a sale", note: "Restocks to a saleable batch", marks: { admin: "F", manager: "F", pharmacist: "F", cashier: "N", inventory: "N" } },
  { capability: "Void a sale", note: "Same-day only", marks: { admin: "F", manager: "N", pharmacist: "N", cashier: "N", inventory: "N" } },
  { capability: "Reprint receipt", note: "Marked REPRINT", marks: { admin: "F", manager: "F", pharmacist: "F", cashier: "F", inventory: "N" } },
  { capability: "Add / edit medicines", note: "Catalog details", marks: { admin: "F", manager: "F", pharmacist: "F", cashier: "N", inventory: "A" } },
  { capability: "Change selling prices", note: "Old price kept in history", marks: { admin: "F", manager: "F", pharmacist: "A", cashier: "N", inventory: "N" } },
  { capability: "Manage batches & expiry", note: "Quarantine, recall", marks: { admin: "F", manager: "F", pharmacist: "F", cashier: "N", inventory: "A" } },
  { capability: "Stock adjustments", note: "Needs authorized user + PIN", marks: { admin: "F", manager: "F", pharmacist: "A", cashier: "N", inventory: "A" } },
  { capability: "Purchase orders & receiving", note: "Batch + expiry required", marks: { admin: "F", manager: "F", pharmacist: "A", cashier: "N", inventory: "F" } },
  { capability: "Suppliers", note: "Contacts, terms", marks: { admin: "F", manager: "F", pharmacist: "A", cashier: "N", inventory: "F" } },
  { capability: "Reports & analytics", note: "Exports and print", marks: { admin: "F", manager: "F", pharmacist: "F", cashier: "N", inventory: "N" } },
  { capability: "Users, roles & settings", note: "Printer, receipt, branch", marks: { admin: "F", manager: "A", pharmacist: "N", cashier: "N", inventory: "N" } },
];
