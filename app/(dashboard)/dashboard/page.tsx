"use client";

import { PageShell } from "@/components/layout/app-shell";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { useDb } from "@/lib/store/app-store";

export default function DashboardPage() {
  const db = useDb();
  return (
    <PageShell permission="dashboard.view" subtitle={`${db.settings.pharmacy.branch} · Today’s pharmacy operations`}>
      <DashboardView />
    </PageShell>
  );
}
