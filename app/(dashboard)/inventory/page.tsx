"use client";

import { Suspense } from "react";
import { InventoryView } from "@/components/inventory/inventory-view";
import { LoadingScreen } from "@/components/layout/hydration-gate";

export default function InventoryPage() {
  return (
    <Suspense fallback={<LoadingScreen label="Loading inventory…" />}>
      <InventoryView />
    </Suspense>
  );
}
