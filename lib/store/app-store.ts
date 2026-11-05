"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ActionResult, DemoDatabase, User } from "@/lib/types";
import { buildSeedDatabase, SCHEMA_VERSION } from "@/lib/mock-data/seed";
import { DomainError, type CommandContext, type CommandResult } from "@/lib/services/context";
import { safeStorage, STORAGE_KEY } from "@/lib/storage/safe-storage";

/**
 * Single source of truth for the demo. `db` is an immutable snapshot replaced on every
 * command; services never touch the store directly, so swapping this local repository
 * for Supabase only changes how commands are executed, not the UI.
 */
export interface AppState {
  hydrated: boolean;
  db: DemoDatabase | null;
  sessionUserId: string | null;
  sidebarCollapsed: boolean;
  storageError: string | null;

  setHydrated: () => void;
  ensureSeeded: () => void;
  resetDemo: () => void;
  setSession: (userId: string | null) => void;
  setSidebarCollapsed: (v: boolean) => void;
  setStorageError: (msg: string | null) => void;
  /** Runs a service command as the signed-in user and commits the new snapshot. */
  run: <T>(command: (db: DemoDatabase, ctx: CommandContext) => CommandResult<T>) => ActionResult<T>;
  /** Runs a command as a specific user (used for sign-in bookkeeping). */
  runAs: <T>(user: User, command: (db: DemoDatabase, ctx: CommandContext) => CommandResult<T>) => ActionResult<T>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      db: null,
      sessionUserId: null,
      sidebarCollapsed: false,
      storageError: null,

      setHydrated: () => set({ hydrated: true }),
      ensureSeeded: () => {
        const db = get().db;
        if (!db || db.schemaVersion !== SCHEMA_VERSION) set({ db: buildSeedDatabase(new Date()) });
      },
      resetDemo: () => set({ db: buildSeedDatabase(new Date()), storageError: null }),
      setSession: (userId) => set({ sessionUserId: userId }),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      setStorageError: (msg) => set({ storageError: msg }),

      run: (command) => {
        const { db, sessionUserId } = get();
        const user = db?.users.find((u) => u.id === sessionUserId);
        if (!db || !user) return { ok: false, error: "Sign in to continue." };
        return get().runAs(user, command);
      },
      runAs: (user, command) => {
        const db = get().db;
        if (!db) return { ok: false, error: "Demo data is still loading." };
        try {
          const { db: next, result } = command(db, { user, now: new Date() });
          if (next !== db) set({ db: next });
          return { ok: true, data: result };
        } catch (e) {
          if (e instanceof DomainError) return { ok: false, error: e.message };
          console.error(e);
          return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
        }
      },
    }),
    {
      name: STORAGE_KEY,
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => safeStorage),
      skipHydration: true,
      partialize: (s) => ({ db: s.db, sessionUserId: s.sessionUserId, sidebarCollapsed: s.sidebarCollapsed }),
      migrate: () => ({ db: null, sessionUserId: null, sidebarCollapsed: false }) as unknown as AppState,
    }
  )
);

/** Non-null database accessor for components rendered inside <HydrationGate>. */
export function useDb(): DemoDatabase {
  const db = useAppStore((s) => s.db);
  if (!db) throw new Error("useDb() used before demo data was hydrated.");
  return db;
}
