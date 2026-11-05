"use client";

import { Suspense } from "react";
import { StockManagementView } from "@/components/stock/stock-management-view";
import { LoadingScreen } from "@/components/layout/hydration-gate";

export default function StockManagementPage() {
  return (
    <Suspense fallback={<LoadingScreen label="Loading stock…" />}>
      <StockManagementView />
    </Suspense>
  );
}
