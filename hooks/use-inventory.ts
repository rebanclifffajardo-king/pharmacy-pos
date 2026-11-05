"use client";

import { useMemo } from "react";
import { useDb } from "@/lib/store/app-store";
import { getStockIndex } from "@/lib/services/stock";
import { useToday } from "./use-today";
import type { Category, Medicine, StockInfo, Supplier } from "@/lib/types";

/** Stock info for every medicine, recomputed only when data or the calendar day changes. */
export function useStockIndex(): Map<string, StockInfo> {
  const db = useDb();
  const today = useToday();
  return useMemo(() => getStockIndex(db, today), [db, today]);
}

export function useLookups() {
  const db = useDb();
  return useMemo(() => {
    const medicines = new Map<string, Medicine>(db.medicines.map((m) => [m.id, m]));
    const categories = new Map<string, Category>(db.categories.map((c) => [c.id, c]));
    const suppliers = new Map<string, Supplier>(db.suppliers.map((s) => [s.id, s]));
    return { medicines, categories, suppliers };
  }, [db.medicines, db.categories, db.suppliers]);
}

export function useSettings() {
  return useDb().settings;
}
