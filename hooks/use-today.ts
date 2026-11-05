"use client";

import { useEffect, useState } from "react";
import { todayKey } from "@/lib/utils/format";

/** Today's date key (Asia/Manila); re-renders when the day rolls over. */
export function useToday(): string {
  const [today, setToday] = useState(todayKey);
  useEffect(() => {
    const t = setInterval(() => {
      const k = todayKey();
      setToday((prev) => (prev === k ? prev : k));
    }, 60_000);
    return () => clearInterval(t);
  }, []);
  return today;
}

/** Ticking clock for headers. */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
