"use client";

import { Suspense } from "react";
import { PageShell } from "@/components/layout/app-shell";
import { RefundsView } from "@/components/refunds/refunds-view";

export default function RefundsPage() {
  return (
    <PageShell permission="sales.refund">
      <Suspense fallback={null}>
        <RefundsView />
      </Suspense>
    </PageShell>
  );
}
