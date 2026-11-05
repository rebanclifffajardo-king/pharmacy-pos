"use client";

import { useEffect, type ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store/app-store";
import { onStorageError, STORAGE_KEY } from "@/lib/storage/safe-storage";
import { PrintProvider } from "@/components/receipts/print-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

/** Loads persisted demo data after mount (SSR-safe) and seeds it on first visit. */
function StoreHydrator() {
  useEffect(() => {
    onStorageError((msg) => {
      useAppStore.getState().setStorageError(msg);
      toast.error("Demo data not saved", { description: msg, id: "storage-error" });
    });
    const done = () => {
      const s = useAppStore.getState();
      s.ensureSeeded();
      s.setHydrated();
    };
    const unsub = useAppStore.persist.onFinishHydration(done);
    Promise.resolve(useAppStore.persist.rehydrate()).catch(() => done());
    // Keep multiple tabs in sync.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) void useAppStore.persist.rehydrate();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      unsub();
      onStorageError(null);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <TooltipProvider>
        <PrintProvider>
          <StoreHydrator />
          {children}
          <Toaster position="bottom-center" richColors closeButton />
        </PrintProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
