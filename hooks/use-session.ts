"use client";

import { useAppStore } from "@/lib/store/app-store";
import { hasPermission, type Permission } from "@/lib/auth/permissions";
import type { User } from "@/lib/types";

export function useCurrentUser(): User | null {
  return useAppStore((s) => s.db?.users.find((u) => u.id === s.sessionUserId) ?? null);
}

/** Demo-only UI permission check for the signed-in user. */
export function useCan(permission: Permission): boolean {
  const user = useCurrentUser();
  return hasPermission(user?.role, permission);
}

export function usePermissions() {
  const user = useCurrentUser();
  return (p: Permission) => hasPermission(user?.role, p);
}
