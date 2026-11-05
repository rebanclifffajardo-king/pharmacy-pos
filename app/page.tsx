"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store/app-store";
import { ROLE_HOME } from "@/lib/auth/permissions";
import { LoadingScreen } from "@/components/layout/hydration-gate";

/** Entry: route to the signed-in role's home, or to the demo login. */
export default function Home() {
  const router = useRouter();
  const ready = useAppStore((s) => s.hydrated && !!s.db);
  const role = useAppStore((s) => s.db?.users.find((u) => u.id === s.sessionUserId)?.role);
  useEffect(() => {
    if (!ready) return;
    router.replace(role ? ROLE_HOME[role] : "/login");
  }, [ready, role, router]);
  return <LoadingScreen />;
}
