"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useAppStore } from "@/lib/store/app-store";

/** Renders children only once demo data has loaded from browser storage. */
export function HydrationGate({ children }: { children: ReactNode }) {
  const ready = useAppStore((s) => s.hydrated && !!s.db);
  if (!ready) return <LoadingScreen />;
  return <>{children}</>;
}

export function LoadingScreen({ label = "Loading demo data…" }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-canvas" role="status" aria-live="polite">
      <Image src="/brand/yasmar-seal.png" alt="" width={72} height={72} priority className="animate-pulse-soft" />
      <span className="text-sm font-medium text-ink-500">{label}</span>
    </div>
  );
}
