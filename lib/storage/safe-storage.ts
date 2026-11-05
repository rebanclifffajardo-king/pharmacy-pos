import type { StateStorage } from "zustand/middleware";

/**
 * localStorage wrapper that is safe during Next.js server rendering and never throws:
 * private windows, blocked storage and quota errors degrade to in-memory state and are
 * reported through `onStorageError`.
 */
const memory = new Map<string, string>();
let errorListener: ((message: string) => void) | null = null;

export function onStorageError(fn: ((message: string) => void) | null) {
  errorListener = fn;
}

function ls(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    const s = window.localStorage;
    const probe = "__yasmar_probe__";
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export const safeStorage: StateStorage = {
  getItem(name) {
    const s = ls();
    if (!s) return memory.get(name) ?? null;
    try {
      return s.getItem(name);
    } catch {
      return memory.get(name) ?? null;
    }
  },
  setItem(name, value) {
    memory.set(name, value);
    const s = ls();
    if (!s) {
      errorListener?.("Browser storage is unavailable — demo changes will be lost on refresh.");
      return;
    }
    try {
      s.setItem(name, value);
    } catch (e) {
      const quota = e instanceof DOMException && (e.name === "QuotaExceededError" || e.code === 22);
      errorListener?.(
        quota
          ? "Browser storage is full — recent demo changes may not survive a refresh. Reset demo data in Settings."
          : "Could not save demo data to this browser."
      );
    }
  },
  removeItem(name) {
    memory.delete(name);
    const s = ls();
    try {
      s?.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

export const STORAGE_KEY = "yasmar-pos-demo";
