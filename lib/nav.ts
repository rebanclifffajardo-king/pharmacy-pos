import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  Package,
  Pill,
  ReceiptText,
  Settings,
  ShoppingCart,
  Truck,
  Undo2,
  Users,
} from "lucide-react";
import type { Permission } from "@/lib/auth/permissions";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: Permission;
  group: "Operations" | "Inventory" | "Sales" | "Admin";
  title: string;
  subtitle: string;
  badge?: "low" | "expiring";
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard.view", group: "Operations", title: "Dashboard", subtitle: "Today’s pharmacy operations" },
  { href: "/pos", label: "Point of Sale", icon: ShoppingCart, permission: "pos.sell", group: "Operations", title: "Point of Sale", subtitle: "Checkout" },
  { href: "/inventory", label: "Medicine Inventory", icon: Pill, permission: "inventory.view", group: "Inventory", title: "Medicine Inventory", subtitle: "Catalog, pricing and batch-tracked stock", badge: "low" },
  { href: "/stock-management", label: "Stock Management", icon: Package, permission: "stock.view", group: "Inventory", title: "Stock Management", subtitle: "Batches, expiry monitoring and adjustments", badge: "expiring" },
  { href: "/purchase-orders", label: "Purchase Orders", icon: ClipboardList, permission: "po.view", group: "Inventory", title: "Purchase Orders", subtitle: "Ordering and receiving stock" },
  { href: "/suppliers", label: "Suppliers", icon: Truck, permission: "suppliers.view", group: "Inventory", title: "Suppliers", subtitle: "Distributor contacts, terms and supplied medicines" },
  { href: "/sales", label: "Sales & Transactions", icon: ReceiptText, permission: "sales.view", group: "Sales", title: "Sales & Transactions", subtitle: "Immutable sales history · receipts and reprints" },
  { href: "/refunds", label: "Returns & Refunds", icon: Undo2, permission: "sales.refund", group: "Sales", title: "Returns & Refunds", subtitle: "Authorized refunds linked to the original sale" },
  { href: "/reports", label: "Reports & Analytics", icon: BarChart3, permission: "reports.view", group: "Sales", title: "Reports & Analytics", subtitle: "Print-friendly, exportable reports" },
  { href: "/users", label: "User Management", icon: Users, permission: "users.view", group: "Admin", title: "User Management", subtitle: "Staff accounts, roles and permissions" },
  { href: "/settings", label: "Settings", icon: Settings, permission: "settings.view", group: "Admin", title: "Settings", subtitle: "Pharmacy profile, POS, receipt printer and demo data" },
];

export const NAV_GROUPS = ["Operations", "Inventory", "Sales", "Admin"] as const;

export function navItemFor(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((n) => pathname === n.href || pathname.startsWith(n.href + "/"));
}
