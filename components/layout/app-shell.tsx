"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { useAppStore } from "@/lib/store/app-store";
import { useCurrentUser, usePermissions } from "@/hooks/use-session";
import type { Permission } from "@/lib/auth/permissions";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { HydrationGate, LoadingScreen } from "./hydration-gate";
import { RestrictedNotice } from "@/components/shared/restricted";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const ShellContext = createContext<{ openMobileNav: () => void }>({ openMobileNav: () => {} });

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useCurrentUser();
  const collapsedPref = useAppStore((s) => s.sidebarCollapsed);
  const setCollapsed = useAppStore((s) => s.setSidebarCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isPos = pathname.startsWith("/pos");
  // The design shows the POS with a collapsed rail to maximise selling space.
  const collapsed = isPos ? true : collapsedPref;

  useEffect(() => {
    if (!user) router.replace("/login?next=" + encodeURIComponent(pathname));
  }, [user, router, pathname]);

  if (!user) return <LoadingScreen label="Redirecting to demo sign-in…" />;

  return (
    <ShellContext.Provider value={{ openMobileNav: () => setMobileOpen(true) }}>
      <div className={cn("flex min-h-dvh bg-canvas text-ink", isPos && "md:h-dvh md:overflow-hidden")}>
        <div className="no-print sticky top-0 hidden h-dvh shrink-0 md:block">
          <Sidebar collapsed={collapsed} onToggle={isPos ? undefined : () => setCollapsed(!collapsedPref)} showToggle={!isPos} />
        </div>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-[248px] p-0 sm:max-w-[248px]" showCloseButton={false}>
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <Sidebar collapsed={false} onNavigate={() => setMobileOpen(false)} showToggle={false} className="border-r-0" />
          </SheetContent>
        </Sheet>
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </ShellContext.Provider>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <HydrationGate>
      <Shell>{children}</Shell>
    </HydrationGate>
  );
}

export function useShell() {
  return useContext(ShellContext);
}

/**
 * Page frame: header (title, breadcrumbs, search, alerts, user) + animated content area.
 * Pass `permission` to show a restricted notice for roles without access.
 */
export function PageShell({
  title,
  subtitle,
  permission,
  children,
  className,
  bare,
  headerActions,
}: {
  title?: string;
  subtitle?: string;
  permission?: Permission;
  children: ReactNode;
  className?: string;
  /** Skip the header and padding (used by the POS full-height layout). */
  bare?: boolean;
  headerActions?: ReactNode;
}) {
  const { openMobileNav } = useShell();
  const can = usePermissions();
  const reduce = useReducedMotion();
  const allowed = !permission || can(permission);
  const body = allowed ? children : <RestrictedNotice what={title ? `“${title}”` : undefined} />;

  if (bare && allowed) return <>{children}</>;
  return (
    <>
      <Topbar title={title} subtitle={subtitle} onOpenMobileNav={openMobileNav} actions={headerActions} />
      <motion.main
        id="main"
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
        className={cn("mx-auto flex w-full max-w-[1440px] min-w-0 flex-col gap-4 p-4 sm:p-6", className)}
      >
        {body}
      </motion.main>
    </>
  );
}
