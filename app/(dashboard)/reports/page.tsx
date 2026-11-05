"use client";

import { Suspense } from "react";
import { PageShell } from "@/components/layout/app-shell";
import { ReportsView } from "@/components/reports/reports-view";

export default function ReportsPage() {
  return (
    <PageShell permission="reports.view" title="Reports & Analytics" subtitle="Print-friendly, exportable reports for owners and auditors">
      <Suspense fallback={<div className="card-surface h-96 animate-pulse" />}>
        <ReportsView />
      </Suspense>
    </PageShell>
  );
}
