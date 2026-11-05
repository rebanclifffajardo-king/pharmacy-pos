import type { DemoDatabase, Role, Settings, Supplier, User, UserStatus } from "@/lib/types";
import { DomainError, logActivity, mutate, type CommandContext } from "./context";
import { hasPermission, ROLE_LABEL } from "@/lib/auth/permissions";
import { initialsOf, uid } from "@/lib/utils/id";

// ---------------------------------------------------------------------------- suppliers

export type SupplierInput = Omit<Supplier, "id" | "createdAt" | "status" | "code"> & { code?: string };

export function saveSupplier(db: DemoDatabase, ctx: CommandContext, input: { id?: string; supplier: SupplierInput }) {
  if (!hasPermission(ctx.user.role, "suppliers.manage")) throw new DomainError("Your role cannot manage suppliers.");
  const s = input.supplier;
  if (!s.name.trim()) throw new DomainError("Supplier name is required.");
  if (!s.contactPerson.trim()) throw new DomainError("Contact person is required.");
  if (s.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email.trim())) throw new DomainError("Enter a valid e-mail address.");
  if (db.suppliers.some((x) => x.name.toLowerCase() === s.name.trim().toLowerCase() && x.id !== input.id)) {
    throw new DomainError("A supplier with this name already exists.");
  }
  return mutate(db, (d) => {
    const clean = {
      ...s,
      name: s.name.trim(),
      contactPerson: s.contactPerson.trim(),
      email: s.email.trim(),
      phone: s.phone.trim(),
      leadTimeDays: Math.max(0, Math.round(s.leadTimeDays || 0)),
    };
    if (input.id) {
      const sup = d.suppliers.find((x) => x.id === input.id);
      if (!sup) throw new DomainError("Supplier not found.");
      Object.assign(sup, clean, { code: s.code?.trim() || sup.code });
      logActivity(d, ctx, { kind: "supplier", tone: "info", message: `Updated supplier ${sup.name}` });
      return sup as Supplier;
    }
    const code = (s.code?.trim() || clean.name.replace(/[^A-Za-z ]/g, "").split(/\s+/).map((w) => w[0]).join("").slice(0, 3)).toUpperCase();
    const sup: Supplier = { ...clean, id: uid("sup"), code, status: "active", createdAt: ctx.now.toISOString() };
    d.suppliers.push(sup);
    logActivity(d, ctx, { kind: "supplier", tone: "success", message: `Added supplier ${sup.name}` });
    return sup;
  });
}

export function setSupplierStatus(db: DemoDatabase, ctx: CommandContext, input: { id: string; status: Supplier["status"] }) {
  if (!hasPermission(ctx.user.role, "suppliers.manage")) throw new DomainError("Your role cannot manage suppliers.");
  return mutate(db, (d) => {
    const sup = d.suppliers.find((x) => x.id === input.id);
    if (!sup) throw new DomainError("Supplier not found.");
    sup.status = input.status;
    logActivity(d, ctx, { kind: "supplier", tone: input.status === "active" ? "success" : "warning", message: `${input.status === "active" ? "Reactivated" : "Deactivated"} supplier ${sup.name}` });
    return sup as Supplier;
  });
}

// ---------------------------------------------------------------------------- users

export interface UserInput {
  name: string;
  email: string;
  role: Role;
  pin: string;
  prcLicense?: string;
  phone?: string;
}

export function saveUser(db: DemoDatabase, ctx: CommandContext, input: { id?: string; user: UserInput; invite?: boolean }) {
  if (!hasPermission(ctx.user.role, "users.manage")) throw new DomainError("Only an Administrator can manage users.");
  const u = input.user;
  if (!u.name.trim()) throw new DomainError("Name is required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u.email.trim())) throw new DomainError("Enter a valid e-mail address.");
  if (!/^\d{4,6}$/.test(u.pin)) throw new DomainError("Demo PIN must be 4–6 digits.");
  if (db.users.some((x) => x.email.toLowerCase() === u.email.trim().toLowerCase() && x.id !== input.id)) {
    throw new DomainError("Another user already uses this e-mail.");
  }
  if (input.id === ctx.user.id && u.role !== ctx.user.role) throw new DomainError("You cannot change your own role.");
  return mutate(db, (d) => {
    if (input.id) {
      const usr = d.users.find((x) => x.id === input.id);
      if (!usr) throw new DomainError("User not found.");
      const roleChanged = usr.role !== u.role;
      Object.assign(usr, { ...u, name: u.name.trim(), email: u.email.trim(), initials: initialsOf(u.name) });
      logActivity(d, ctx, { kind: "user", tone: "info", message: `Updated ${usr.name}${roleChanged ? ` · role → ${ROLE_LABEL[u.role]}` : ""}` });
      return usr as User;
    }
    const usr: User = {
      id: uid("usr"),
      name: u.name.trim(),
      initials: initialsOf(u.name),
      email: u.email.trim(),
      role: u.role,
      status: input.invite === false ? "active" : "invited",
      pin: u.pin,
      prcLicense: u.prcLicense?.trim() || undefined,
      phone: u.phone?.trim() || undefined,
      createdAt: ctx.now.toISOString(),
    };
    d.users.push(usr);
    logActivity(d, ctx, { kind: "user", tone: "success", message: `${usr.status === "invited" ? "Invited" : "Added"} ${usr.name} as ${ROLE_LABEL[usr.role]}` });
    return usr;
  });
}

export function setUserStatus(db: DemoDatabase, ctx: CommandContext, input: { id: string; status: UserStatus }) {
  if (!hasPermission(ctx.user.role, "users.manage")) throw new DomainError("Only an Administrator can manage users.");
  if (input.id === ctx.user.id && input.status !== "active") throw new DomainError("You cannot deactivate your own account.");
  return mutate(db, (d) => {
    const usr = d.users.find((x) => x.id === input.id);
    if (!usr) throw new DomainError("User not found.");
    if (usr.role === "admin" && input.status !== "active" && d.users.filter((x) => x.role === "admin" && x.status === "active").length <= 1) {
      throw new DomainError("At least one active Administrator is required.");
    }
    usr.status = input.status;
    logActivity(d, ctx, { kind: "user", tone: input.status === "active" ? "success" : "warning", message: `${usr.name} is now ${input.status}` });
    return usr as User;
  });
}

export function recordLogin(db: DemoDatabase, ctx: CommandContext) {
  return mutate(db, (d) => {
    const usr = d.users.find((x) => x.id === ctx.user.id);
    if (usr) {
      usr.lastLoginAt = ctx.now.toISOString();
      if (usr.status === "invited") usr.status = "active";
    }
    logActivity(d, ctx, { kind: "auth", tone: "neutral", message: `Signed in (Demo Mode) as ${ROLE_LABEL[ctx.user.role]}` });
    return true;
  });
}

// ---------------------------------------------------------------------------- settings

export type SettingsPatch = { [K in keyof Settings]?: Partial<Settings[K]> };

export function updateSettings(db: DemoDatabase, ctx: CommandContext, input: { patch: SettingsPatch; section: string }) {
  if (!hasPermission(ctx.user.role, "settings.manage")) throw new DomainError("Only an Administrator can change settings.");
  const p = input.patch;
  if (p.pos) {
    const pos = { ...db.settings.pos, ...p.pos };
    if (pos.vatRate < 0 || pos.vatRate > 30) throw new DomainError("VAT rate must be between 0 and 30%.");
    if (pos.seniorDiscountRate < 0 || pos.seniorDiscountRate > 100 || pos.pwdDiscountRate < 0 || pos.pwdDiscountRate > 100) throw new DomainError("Discount rates must be 0–100%.");
    if (pos.nextReceiptNo < 1) throw new DomainError("Next receipt number must be at least 1.");
    const maxUsed = Math.max(0, ...db.transactions.filter((t) => t.receiptNo.startsWith(pos.receiptPrefix)).map((t) => Number(t.receiptNo.slice(pos.receiptPrefix.length)) || 0));
    if (pos.nextReceiptNo <= maxUsed) throw new DomainError(`Next receipt number must be above ${maxUsed} — receipt numbers can't be reused.`);
  }
  if (p.pharmacy && p.pharmacy.name !== undefined && !p.pharmacy.name.trim()) throw new DomainError("Pharmacy name is required.");
  return mutate(db, (d) => {
    if (p.pharmacy) Object.assign(d.settings.pharmacy, p.pharmacy);
    if (p.pos) Object.assign(d.settings.pos, p.pos);
    if (p.printer) Object.assign(d.settings.printer, p.printer);
    logActivity(d, ctx, { kind: "settings", tone: "info", message: `Updated ${input.section} settings` });
    return d.settings as Settings;
  });
}
