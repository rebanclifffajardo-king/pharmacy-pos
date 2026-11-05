"use client";

import { PageShell } from "@/components/layout/app-shell";
import { PosScreen } from "@/components/pos/pos-screen";

export default function PosPage() {
  return (
    <PageShell permission="pos.sell" title="Point of Sale" bare>
      <PosScreen />
    </PageShell>
  );
}
