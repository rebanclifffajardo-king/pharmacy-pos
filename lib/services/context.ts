import { produce, type Draft } from "immer";
import type { ActivityLog, DemoDatabase, StockMovement, User } from "@/lib/types";
import { uid } from "@/lib/utils/id";
import { getStockIndex, isBatchSellable } from "./stock";
import { todayKey } from "@/lib/utils/format";

/**
 * Every mutating service is a pure function `(db, ctx, input) => { db, result }`.
 * The local demo store applies them to the persisted snapshot; a Supabase implementation
 * would run the same validations inside a Postgres function / RPC with RLS.
 */
export interface CommandContext {
  user: User;
  now: Date;
}

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export interface CommandResult<T> {
  db: DemoDatabase;
  result: T;
}

export function mutate<T>(db: DemoDatabase, fn: (draft: Draft<DemoDatabase>) => T): CommandResult<T> {
  let result!: T;
  const next = produce(db, (draft) => {
    result = fn(draft);
  });
  return { db: next, result };
}

export function logActivity(
  d: Draft<DemoDatabase>,
  ctx: CommandContext,
  entry: Pick<ActivityLog, "kind" | "message" | "tone"> & { reference?: string }
) {
  d.activity.unshift({
    id: uid("act"),
    userId: ctx.user.id,
    userName: ctx.user.name,
    createdAt: ctx.now.toISOString(),
    ...entry,
  });
  if (d.activity.length > 500) d.activity.length = 500;
}

/** Current saleable units for a medicine inside a draft. */
export function saleableUnits(d: Draft<DemoDatabase> | DemoDatabase, medicineId: string, today = todayKey()): number {
  let n = 0;
  for (const b of d.batches) if (b.medicineId === medicineId && isBatchSellable(b as never, today)) n += b.quantity;
  return n;
}

export function addMovement(
  d: Draft<DemoDatabase>,
  ctx: CommandContext,
  m: Omit<StockMovement, "id" | "createdAt" | "userId" | "userName" | "balanceAfter">
) {
  d.movements.unshift({
    id: uid("mov"),
    createdAt: ctx.now.toISOString(),
    userId: ctx.user.id,
    userName: ctx.user.name,
    balanceAfter: saleableUnits(d, m.medicineId),
    ...m,
  });
  if (d.movements.length > 3000) d.movements.length = 3000;
}

export function requireUser(db: DemoDatabase, userId: string | undefined, label = "User"): User {
  const u = db.users.find((x) => x.id === userId);
  if (!u) throw new DomainError(`${label} not found.`);
  return u;
}

/** Validates a demo PIN for a user. Demo only — not a security control. */
export function verifyPin(db: DemoDatabase, userId: string, pin: string): User {
  const u = requireUser(db, userId);
  if (u.status !== "active") throw new DomainError(`${u.name} is not an active user.`);
  if (u.pin !== pin.trim()) throw new DomainError("Incorrect PIN for " + u.name + ".");
  return u;
}

export { getStockIndex };
