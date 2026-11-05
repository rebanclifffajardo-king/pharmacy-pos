"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { motion } from "motion/react";
import { useAppStore } from "@/lib/store/app-store";
import { actions } from "@/lib/store/actions";
import { DEMO_LOGIN_USER_IDS } from "@/lib/mock-data/users";
import { hasPermission, ROLE_DESCRIPTION, ROLE_HOME, ROLE_LABEL } from "@/lib/auth/permissions";
import { navItemFor } from "@/lib/nav";
import { HydrationGate } from "./hydration-gate";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Demo Login from the design: brand panel + role picker. No real credentials are used. */
export function LoginScreen() {
  return (
    <HydrationGate>
      <LoginInner />
    </HydrationGate>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const db = useAppStore((s) => s.db)!;
  const current = useAppStore((s) => s.sessionUserId);
  const demoUsers = DEMO_LOGIN_USER_IDS.map((id) => db.users.find((u) => u.id === id)).filter((u) => !!u && u.status !== "inactive");
  const [selected, setSelected] = useState<string>(current && demoUsers.some((u) => u!.id === current) ? current : "usr_cashier");
  const user = demoUsers.find((u) => u!.id === selected) ?? demoUsers[0];

  const enter = () => {
    if (!user) return;
    const res = actions.signIn(user.id);
    if (!res.ok) return void toast.error(res.error);
    toast.success(`Signed in as ${user.name}`, { description: `${ROLE_LABEL[user.role]} · Demo Mode` });
    const next = params.get("next");
    const nav = next ? navItemFor(next) : undefined;
    router.replace(next && nav && hasPermission(user.role, nav.permission) ? next : ROLE_HOME[user.role]);
  };

  return (
    <div className="flex min-h-dvh flex-wrap bg-canvas text-ink">
      <section className="relative flex min-h-[420px] flex-[1_1_480px] flex-col justify-between gap-10 overflow-hidden bg-[#223CFF] px-6 py-12 text-white sm:px-[clamp(24px,5vw,72px)]">
        <div aria-hidden className="absolute -right-40 -bottom-40 size-[520px] rounded-full border-[56px] border-white/[.07]" />
        <div aria-hidden className="absolute -top-[90px] right-[120px] size-[220px] rounded-full border-[28px] border-[rgba(222,19,57,.35)]" />
        <div className="relative flex items-center gap-3">
          <span className="inline-flex h-7 items-center rounded-full bg-white/[.14] px-3 text-xs font-semibold tracking-[0.04em]">Pharmacy POS &amp; Inventory</span>
        </div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }} className="relative flex max-w-[520px] flex-col gap-7">
          <div className="grid size-[168px] place-items-center rounded-full bg-white shadow-[0_20px_50px_rgba(5,12,80,.35)]">
            <Image src="/brand/yasmar-seal.png" alt="YasMar Pharmacy seal" width={150} height={150} priority />
          </div>
          <h2 className="font-heading text-[40px] leading-[1.15] font-semibold tracking-[-0.02em]">
            Affordable medicine,
            <br />
            right next door.
          </h2>
          <p className="text-base leading-relaxed text-white/[.86]">
            Fast checkout for cashiers, batch-level expiry control for pharmacists, and clear numbers for owners — in one system built for Philippine pharmacies.
          </p>
        </motion.div>
        <div className="relative flex flex-wrap gap-6 text-[13px] font-medium text-white/[.86]">
          <span>FEFO batch dispensing</span>
          <span>SC / PWD discounts</span>
          <span>Cash · QR Ph · Card</span>
          <span>58mm receipts</span>
        </div>
      </section>

      <section className="flex flex-[1_1_480px] items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-[440px] flex-col gap-7">
          <Image src="/brand/yasmar-logo.png" alt="YasMar Pharmacy — Affordable Medicine, Right Nextdoor" width={280} height={64} priority className="h-auto w-[280px] max-w-full" />
          <div className="flex flex-col gap-1.5">
            <h1 className="font-heading text-[28px] font-semibold tracking-[-0.01em]">Demo sign in</h1>
            <p className="text-[15px] text-ink-500">Choose a staff role for the {db.settings.pharmacy.branch}. No password is needed in Demo Mode.</p>
          </div>

          <div className="flex flex-col gap-3">
            <div role="radiogroup" aria-label="Demo role" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {demoUsers.map((u) => {
                const on = u!.id === selected;
                return (
                  <button
                    key={u!.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setSelected(u!.id)}
                    onDoubleClick={enter}
                    className={cn(
                      "flex min-h-11 flex-col gap-0.5 rounded-xl px-3 py-2.5 text-left transition-all duration-150",
                      on ? "border-[1.5px] border-brand bg-brand-50 text-brand-700" : "border border-line bg-surface text-ink hover:border-brand-200",
                      u!.role === "manager" && "sm:col-span-2"
                    )}
                  >
                    <span className="text-sm font-semibold">{ROLE_LABEL[u!.role]}</span>
                    <span className="text-xs text-ink-500">{u!.name}</span>
                    <span className="text-[11px] text-ink-400">{ROLE_DESCRIPTION[u!.role]}</span>
                  </button>
                );
              })}
            </div>
            <Button variant="brand" size="touch" className="h-[52px] text-base" onClick={enter}>
              <span className="size-2 rounded-full bg-[#F6C55A]" aria-hidden />
              Enter Demo Mode as {user ? ROLE_LABEL[user.role] : "…"}
            </Button>
            <p className="text-center text-xs leading-relaxed text-ink-500">
              Demo Mode runs on fictional sample data saved in this browser. No Supabase account, payment provider or printer is needed. Role permissions here are a UI simulation — not production security.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
