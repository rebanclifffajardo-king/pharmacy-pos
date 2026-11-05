"use client";

import { Suspense } from "react";
import { PageShell } from "@/components/layout/app-shell";
import { SettingsView } from "@/components/settings/settings-view";

export default function SettingsPage() {
  return (
    <PageShell permission="settings.view">
      <Suspense fallback={null}>
        <SettingsView />
      </Suspense>
    </PageShell>
  );
}
