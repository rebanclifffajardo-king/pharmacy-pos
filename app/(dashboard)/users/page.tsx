"use client";

import { PageShell } from "@/components/layout/app-shell";
import { UsersView } from "@/components/users/users-view";

export default function UsersPage() {
  return (
    <PageShell permission="users.view" subtitle="Staff accounts, roles and what each role can do">
      <UsersView />
    </PageShell>
  );
}
