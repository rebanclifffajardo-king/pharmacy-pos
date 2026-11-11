"use client";

import { PageShell } from "@/components/layout/app-shell";
import { ImageCreditsView } from "@/components/shared/image-credits-view";

export default function ImageCreditsPage() {
  return (
    <PageShell permission="dashboard.view" title="Image Credits" subtitle="Free-licensed medicine photos and their authors">
      <ImageCreditsView />
    </PageShell>
  );
}
