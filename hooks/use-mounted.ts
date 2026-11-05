"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** True only on the client after hydration — avoids SSR/client mismatches without setState-in-effect. */
export function useMounted(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}
