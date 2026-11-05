"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import type { Role, User } from "@/lib/types";
import { useDb } from "@/lib/store/app-store";
import { actions } from "@/lib/store/actions";
import { useCan, useCurrentUser } from "@/hooks/use-session";
import { PERMISSION_MATRIX, ROLE_DESCRIPTION, ROLE_HOME, ROLE_LABEL } from "@/lib/auth/permissions";
import { formatRelative } from "@/lib/utils/format";
import { Chip, type ChipTone } from "@/components/shared/chip";
import { Field, NativeSelect, TextInput } from "@/components/shared/field";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SearchInput } from "@/components/shared/search-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const ROLES: Role[] = ["admin", "manager", "pharmacist", "cashier", "inventory"];
const ROLE_TONE: Record<Role, ChipTone> = { admin: "ink", manager: "orange", pharmacist: "brand", cashier: "teal", inventory: "warn" };
const ROLE_AVATAR: Record<Role, string> = { admin: "bg-ink text-surface", manager: "bg-red text-white", pharmacist: "bg-brand text-white", cashier: "bg-teal-dot text-white", inventory: "bg-warn-dot text-white" };
const STATUS_TONE: Record<User["status"], ChipTone> = { active: "ok", invited: "brand", inactive: "neutral" };

export function UsersView() {
  const db = useDb();
  const me = useCurrentUser();
  const canManage = useCan("users.manage");
  const router = useRouter();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<User | "new" | null>(null);
  const [toggle, setToggle] = useState<User | null>(null);
  const [signInAs, setSignInAs] = useState<User | null>(null);

  const users = useMemo(() => {
    const term = q.trim().toLowerCase();
    const order: Record<Role, number> = { admin: 0, manager: 1, pharmacist: 2, cashier: 3, inventory: 4 };
    return db.users
      .filter((u) => !term || `${u.name} ${u.email} ${ROLE_LABEL[u.role]}`.toLowerCase().includes(term))
      .sort((a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name));
  }, [db.users, q]);

  const counts = {
    active: db.users.filter((u) => u.status === "active").length,
    invited: db.users.filter((u) => u.status === "invited").length,
    inactive: db.users.filter((u) => u.status === "inactive").length,
  };

  const doToggle = () => {
    if (!toggle) return;
    const next = toggle.status === "active" ? "inactive" : "active";
    const res = actions.setUserStatus({ id: toggle.id, status: next });
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    toast.success(`${toggle.name} ${next === "active" ? "activated" : "deactivated"}`);
  };

  const doSignIn = () => {
    if (!signInAs) return;
    const res = actions.signIn(signInAs.id);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    toast.success(`Signed in as ${signInAs.name}`, { description: `${ROLE_LABEL[signInAs.role]} · Demo Mode` });
    router.replace(ROLE_HOME[signInAs.role]);
  };

  return (
    <>
      <section className="card-surface min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <h2 className="font-heading text-[17px] font-semibold">Staff accounts</h2>
            <span className="text-xs text-ink-500">
              {counts.active} active · {counts.invited} invited{counts.inactive ? ` · ${counts.inactive} inactive` : ""} · {db.settings.pharmacy.branch}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <SearchInput value={q} onChange={setQ} placeholder="Search staff…" className="w-full sm:w-56" />
            {canManage && (
              <Button variant="brand" size="md" onClick={() => setEditing("new")}>
                <UserPlus className="size-4" aria-hidden /> Invite staff
              </Button>
            )}
          </div>
        </div>
        {!canManage && <p className="mx-4 mb-3 rounded-xl bg-warn-bg px-3 py-2 text-xs text-warn">Read-only — only an Administrator can add, edit or deactivate users.</p>}
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Email</th>
                <th>PRC license</th>
                <th>Last sign-in</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={cn(u.status === "inactive" && "opacity-60")}>
                  <td>
                    <span className="flex items-center gap-2.5">
                      <span className={cn("grid size-8 shrink-0 place-items-center rounded-full font-heading text-xs font-semibold", ROLE_AVATAR[u.role])}>{u.initials}</span>
                      <span className="font-semibold">
                        {u.name}
                        {me?.id === u.id && <span className="ml-1.5 text-xs font-medium text-ink-500">(you)</span>}
                      </span>
                    </span>
                  </td>
                  <td>
                    <Chip tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Chip>
                  </td>
                  <td className="text-ink-700">{u.email}</td>
                  <td className="font-mono text-xs text-ink-500">{u.prcLicense ?? "—"}</td>
                  <td className="text-ink-500">{u.lastLoginAt ? formatRelative(u.lastLoginAt) : "—"}</td>
                  <td>
                    <Chip tone={STATUS_TONE[u.status]} dot>
                      {u.status[0].toUpperCase() + u.status.slice(1)}
                    </Chip>
                  </td>
                  <td>
                    <span className="flex justify-end gap-1.5">
                      {u.status !== "inactive" && me?.id !== u.id && (
                        <Button variant="ghost" size="sm" onClick={() => setSignInAs(u)} title={`Sign in as ${u.name}`}>
                          <LogIn className="size-3.5" aria-hidden /> Sign in as
                        </Button>
                      )}
                      {canManage && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => setEditing(u)}>
                            Manage
                          </Button>
                          {me?.id !== u.id && (
                            <Button variant={u.status === "active" ? "danger-soft" : "soft"} size="sm" onClick={() => setToggle(u)}>
                              {u.status === "active" ? "Deactivate" : "Activate"}
                            </Button>
                          )}
                        </>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-wrap items-start gap-4">
        <section className="card-surface min-w-0 flex-[999_1_640px] overflow-hidden">
          <div className="p-4">
            <h2 className="font-heading text-[17px] font-semibold">Role permissions</h2>
            <span className="text-xs text-ink-500">
              <span className="font-bold text-ok-dot">●</span> full · <span className="font-bold text-warn-dot">◐</span> needs approval or limited · <span className="text-ink-200">—</span> no access
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Capability</th>
                  {ROLES.map((r) => (
                    <th key={r} className="!text-center" title={ROLE_DESCRIPTION[r]}>
                      {ROLE_LABEL[r]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_MATRIX.map((p) => (
                  <tr key={p.capability}>
                    <td className="!whitespace-normal">
                      <span className="font-semibold">{p.capability}</span>
                      <br />
                      <span className="text-xs font-normal text-ink-500">{p.note}</span>
                    </td>
                    {ROLES.map((r) => {
                      const m = p.marks[r];
                      return (
                        <td key={r} className="text-center">
                          {m === "F" ? (
                            <span className="text-base font-bold text-ok-dot" title="Full access">●</span>
                          ) : m === "A" ? (
                            <span className="text-base font-bold text-warn-dot" title="Needs approval or limited">◐</span>
                          ) : (
                            <span className="text-sm font-semibold text-ink-200" title="No access">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <aside className="card-surface flex min-w-0 flex-[1_1_320px] flex-col gap-3 p-5">
          <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <h2 className="font-heading text-[17px] font-semibold">Demo permissions vs. production</h2>
          <p className="text-[13px] leading-relaxed text-ink-700">
            In this demo, roles only shape the interface in the browser — hiding a button is not a permission, and anyone with the browser’s developer tools could bypass it. For production, each rule here maps to Supabase Row Level Security policies and checks inside database functions, so a cashier’s session cannot void a sale or change a price even through the API.
          </p>
          <ul className="flex list-disc flex-col gap-1.5 pl-[18px] text-[13px] leading-normal text-ink-700">
            <li>Sales finalize through one transactional function (stock deduction + receipt) with an idempotency key.</li>
            <li>Approvals (refunds, voids, adjustments, manual discounts) record who approved, when and why.</li>
            <li>Demo PINs are visible on screen on purpose; real deployments use Supabase Auth and hashed PINs.</li>
            <li>The service-role key never reaches the browser, and records are branch-scoped.</li>
          </ul>
        </aside>
      </div>

      {editing && <UserDialog key={editing === "new" ? "new" : editing.id} user={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!toggle}
        onOpenChange={(o) => !o && setToggle(null)}
        title={toggle ? `${toggle.status === "active" ? "Deactivate" : "Activate"} ${toggle.name}?` : ""}
        description={toggle?.status === "active" ? "They will no longer be able to sign in or authorize actions. Their sales history is kept." : "They will be able to sign in and authorize actions for their role."}
        confirmLabel={toggle?.status === "active" ? "Deactivate" : "Activate"}
        tone={toggle?.status === "active" ? "danger" : "brand"}
        onConfirm={doToggle}
      />
      <ConfirmDialog
        open={!!signInAs}
        onOpenChange={(o) => !o && setSignInAs(null)}
        title={signInAs ? `Sign in as ${signInAs.name}?` : ""}
        description={signInAs ? `You’ll switch to the ${ROLE_LABEL[signInAs.role]} demo role and see what that role can do.` : undefined}
        confirmLabel="Switch user"
        tone="brand"
        onConfirm={doSignIn}
      />
    </>
  );
}

function UserDialog({ user, onClose }: { user: User | null; onClose: () => void }) {
  const me = useCurrentUser();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<Role>(user?.role ?? "cashier");
  const [prc, setPrc] = useState(user?.prcLicense ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [pin, setPin] = useState(() => user?.pin ?? String(1000 + Math.floor(Math.random() * 9000)));
  const [invite, setInvite] = useState(true);

  const save = () => {
    const res = actions.saveUser({ id: user?.id, user: { name, email, role, pin, prcLicense: prc, phone }, invite: user ? undefined : invite });
    if (!res.ok) return void toast.error(res.error);
    toast.success(user ? `${res.data.name} updated` : `${res.data.name} ${res.data.status === "invited" ? "invited" : "added"}`, {
      description: user ? undefined : "Demo only — no e-mail is sent.",
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto rounded-2xl p-6 sm:max-w-lg">
        <div className="flex flex-col gap-1">
          <DialogTitle className="font-heading text-lg font-semibold">{user ? `Manage ${user.name}` : "Invite staff"}</DialogTitle>
          <DialogDescription className="text-sm text-ink-500">{user ? "Update details, role and demo PIN." : "Creates a demo account. No invitation e-mail is sent in Demo Mode."}</DialogDescription>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Full name" className="sm:col-span-2">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ana Cruz, RPh" />
          </Field>
          <Field label="Email" className="sm:col-span-2">
            <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@yasmar.demo" />
          </Field>
          <Field label="Role" hint={ROLE_DESCRIPTION[role]}>
            <NativeSelect value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={user?.id === me?.id}>
              {ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABEL[r]}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Demo PIN" hint="4–6 digits · used for simulated approvals">
            <TextInput inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field label="PRC license" hint={role === "pharmacist" ? "Required for pharmacists in production" : "Optional"}>
            <TextInput value={prc} onChange={(e) => setPrc(e.target.value)} placeholder="0000000 (demo)" />
          </Field>
          <Field label="Mobile">
            <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09XX XXX XXXX" />
          </Field>
        </div>
        {!user && (
          <label className="flex items-center gap-2 text-[13px] font-medium text-ink-700">
            <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={invite} onChange={(e) => setInvite(e.target.checked)} />
            Mark as invited (becomes active on first demo sign-in)
          </label>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="brand" size="md" onClick={save} disabled={!name.trim() || !email.trim()}>
            {user ? "Save changes" : "Invite"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
