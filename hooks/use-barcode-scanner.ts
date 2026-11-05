"use client";

import { useEffect, useRef } from "react";

/**
 * Detects USB barcode scanners that behave like keyboards: a burst of characters typed
 * faster than a human (< ~40 ms apart) followed by Enter. Works while focus is anywhere
 * except text fields other than `allowInputs` (the POS search box handles Enter itself).
 */
export function useBarcodeScanner(onScan: (code: string) => void, { enabled = true, minLength = 6, maxGapMs = 45 } = {}) {
  const buffer = useRef("");
  const last = useRef(0);
  const cb = useRef(onScan);
  useEffect(() => {
    cb.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const inField = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (inField || e.metaKey || e.ctrlKey || e.altKey) return;
      const now = performance.now();
      if (now - last.current > maxGapMs) buffer.current = "";
      last.current = now;
      if (e.key === "Enter") {
        if (buffer.current.length >= minLength) {
          e.preventDefault();
          cb.current(buffer.current);
        }
        buffer.current = "";
        return;
      }
      if (e.key.length === 1) buffer.current += e.key;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, minLength, maxGapMs]);
}
