"use client";

import { useMemo } from "react";
import { KeyRound } from "lucide-react";
import { useDb } from "@/lib/store/app-store";
import { hasPermission, ROLE_LABEL, type Permission } from "@/lib/auth/permissions";
import { Field, NativeSelect, TextInput } from "./field";

/**
 * "Authorized user + PIN" fields used for refunds, stock adjustments, voids and
 * manual discounts. Demo PINs are shown on purpose so the client can try the flow —
 * this is a simulated authorization, not a security control.
 */
export function AuthorizeFields({
  permission,
  userId,
  onUserId,
  pin,
  onPin,
  extraRoles,
  label = "Authorized by",
}: {
  permission: Permission;
  userId: string;
  onUserId: (id: string) => void;
  pin: string;
  onPin: (pin: string) => void;
  /** Allow roles that don't hold `permission` (e.g. pharmacists for quarantine). */
  extraRoles?: string[];
  label?: string;
}) {
  const db = useDb();
  const approvers = useMemo(
    () => db.users.filter((u) => u.status === "active" && (hasPermission(u.role, permission) || extraRoles?.includes(u.role))),
    [db.users, permission, extraRoles]
  );
  const selected = approvers.find((u) => u.id === userId);
  return (
    <div className="flex flex-col gap-2.5 rounded-xl bg-canvas p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_1fr]">
        <Field label={label}>
          <NativeSelect value={userId} onChange={(e) => onUserId(e.target.value)}>
            <option value="">Choose approver…</option>
            {approvers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} · {ROLE_LABEL[u.role]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="PIN">
          <TextInput type="password" inputMode="numeric" autoComplete="off" maxLength={6} placeholder="4–6 digits" value={pin} onChange={(e) => onPin(e.target.value.replace(/\D/g, ""))} />
        </Field>
      </div>
      <span className="flex items-center gap-1.5 text-xs text-warn">
        <KeyRound className="size-3.5" aria-hidden />
        {selected ? `Demo PIN for ${selected.name}: ${selected.pin}` : "Demo PINs are shown here once an approver is chosen."} Simulated authorization — not a security control.
      </span>
    </div>
  );
}
