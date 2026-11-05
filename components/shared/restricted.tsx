"use client";

import { Lock } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-session";
import { ROLE_LABEL } from "@/lib/auth/permissions";
import { LinkButton } from "./link-button";

/** Shown when the demo role lacks access to a page (UI-only restriction). */
export function RestrictedNotice({ what = "this page" }: { what?: string }) {
  const user = useCurrentUser();
  return (
    <div className="card-surface mx-auto my-10 flex max-w-lg flex-col items-center gap-3 p-8 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-warn-bg text-warn">
        <Lock className="size-6" aria-hidden />
      </span>
      <h2 className="font-heading text-xl font-semibold">Access restricted</h2>
      <p className="text-sm text-ink-500">
        The {user ? ROLE_LABEL[user.role] : "current"} role can’t open {what} in this demo. Switch to a role with access to try it.
      </p>
      <p className="text-xs text-ink-400">Demo permissions are enforced in the browser only — production must enforce them on the server.</p>
      <div className="mt-2 flex gap-2">
        <LinkButton size="md" variant="outline" href="/dashboard">Go to dashboard</LinkButton>
        <LinkButton size="md" variant="brand" href="/login">Switch demo user</LinkButton>
      </div>
    </div>
  );
}
