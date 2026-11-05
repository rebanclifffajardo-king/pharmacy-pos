import type { User } from "@/lib/types";

/**
 * Demo staff accounts. PINs are demo-only values shown on screen so the client can try
 * simulated authorizations; they are not credentials and must never be reused.
 */
export const DEMO_USERS: Omit<User, "createdAt" | "lastLoginAt">[] = [
  { id: "usr_admin", name: "Yasmin Marquez", initials: "YM", email: "admin@yasmar.demo", role: "admin", status: "active", pin: "1111", phone: "0917 000 0001" },
  { id: "usr_pharm", name: "Jose Reyes, RPh", initials: "JR", email: "pharmacist@yasmar.demo", role: "pharmacist", status: "active", pin: "2222", prcLicense: "0098765 (demo)", phone: "0917 000 0002" },
  { id: "usr_cashier", name: "Maria Santos", initials: "MS", email: "cashier@yasmar.demo", role: "cashier", status: "active", pin: "3333", phone: "0917 000 0003" },
  { id: "usr_stock", name: "Paolo Lim", initials: "PL", email: "stock@yasmar.demo", role: "inventory", status: "active", pin: "4444", phone: "0917 000 0004" },
  { id: "usr_manager", name: "Liza Aquino", initials: "LA", email: "manager@yasmar.demo", role: "manager", status: "active", pin: "5555", phone: "0917 000 0005" },
  { id: "usr_pharm2", name: "Kathleen Ong, RPh", initials: "KO", email: "kath@yasmar.demo", role: "pharmacist", status: "active", pin: "2323", prcLicense: "0087654 (demo)" },
  { id: "usr_cashier2", name: "Carlo Dizon", initials: "CD", email: "carlo@yasmar.demo", role: "cashier", status: "active", pin: "3434" },
  { id: "usr_cashier3", name: "Joy Bautista", initials: "JB", email: "joy@yasmar.demo", role: "cashier", status: "invited", pin: "3535" },
];

/** The five accounts offered on the Demo Login screen. */
export const DEMO_LOGIN_USER_IDS = ["usr_admin", "usr_pharm", "usr_cashier", "usr_stock", "usr_manager"] as const;
