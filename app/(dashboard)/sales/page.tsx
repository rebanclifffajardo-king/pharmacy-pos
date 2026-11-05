"use client";

import { Suspense } from "react";
import { PageShell } from "@/components/layout/app-shell";
import { SalesView } from "@/components/sales/sales-view";

export default function SalesPage() {
  return (
    <PageShell permission="sales.view" subtitle="Immutable sales history · refunds and voids need authorization">
      <Suspense fallback={null}>
        <SalesView />
      </Suspense>
    </PageShell>
  );
}
