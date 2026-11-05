"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, ChevronDown, ChevronRight, LogOut, MapPin, Menu, Moon, Pill, ReceiptText, Search, Sun, Truck, UserRoundCog, ClipboardList } from "lucide-react";
import { useTheme } from "next-themes";
import { useDb } from "@/lib/store/app-store";
import { actions } from "@/lib/store/actions";
import { useCurrentUser, usePermissions } from "@/hooks/use-session";
import { useStockIndex } from "@/hooks/use-inventory";
import { useNow } from "@/hooks/use-today";
import { useMounted } from "@/hooks/use-mounted";
import { navItemFor } from "@/lib/nav";
import { ROLE_LABEL } from "@/lib/auth/permissions";
import { medicineName } from "@/lib/services/stock";
import { peso, TIMEZONE } from "@/lib/utils/format";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function Topbar({ title, subtitle, onOpenMobileNav, actions: right }: { title?: string; subtitle?: string; onOpenMobileNav?: () => void; actions?: React.ReactNode }) {
  const pathname = usePathname();
  const nav = navItemFor(pathname);
  return (
    <header className="no-print sticky top-0 z-30 flex min-h-[72px] flex-wrap items-center gap-x-4 gap-y-3 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-surface/85 sm:px-6">
      {onOpenMobileNav && (
        <button type="button" onClick={onOpenMobileNav} aria-label="Open navigation" className="grid size-11 place-items-center rounded-xl border border-line text-ink-700 md:hidden">
          <Menu className="size-5" />
        </button>
      )}
      <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
        <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1 overflow-hidden text-[11px] font-medium whitespace-nowrap text-ink-400 sm:flex">
          <Link href="/dashboard" className="hover:text-brand-700">YasMar</Link>
          {nav && (
            <>
              <ChevronRight className="size-3" aria-hidden />
              <span>{nav.group}</span>
              <ChevronRight className="size-3" aria-hidden />
              <Link href={nav.href} aria-current="page" className="text-ink-500 hover:text-brand-700">{nav.label}</Link>
            </>
          )}
        </nav>
        <h1 className="truncate font-heading text-xl font-semibold tracking-[-0.01em]">{title ?? nav?.title}</h1>
        <span className="truncate text-xs text-ink-500">{subtitle ?? nav?.subtitle}</span>
      </div>
      {right}
      <GlobalSearch />
      <BranchButton />
      <Clock />
      <div className="flex items-center gap-2">
        <Notifications />
        <ThemeToggle />
      </div>
      <UserMenu />
    </header>
  );
}

function Clock() {
  const now = useNow(1000);
  const mounted = useMounted();
  if (!mounted) return <div className="hidden w-[120px] xl:block" />;
  return (
    <div className="hidden flex-col items-end gap-px px-1 xl:flex">
      <span className="text-sm font-semibold tabular">{now.toLocaleTimeString("en-PH", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
      <span className="text-[11px] whitespace-nowrap text-ink-500">{now.toLocaleDateString("en-PH", { timeZone: TIMEZONE, weekday: "short", month: "short", day: "numeric", year: "numeric" })} · PHT</span>
    </div>
  );
}

function BranchButton() {
  const db = useDb();
  return (
    <Popover>
      <PopoverTrigger className="hidden h-[42px] items-center gap-2 rounded-xl border border-line bg-surface px-3 text-[13px] font-medium text-ink hover:bg-canvas lg:flex">
        <MapPin className="size-4 text-brand" aria-hidden />
        {db.settings.pharmacy.branch}
        <ChevronDown className="size-3.5 text-ink-500" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 rounded-xl p-4">
        <span className="text-sm font-semibold">{db.settings.pharmacy.name}</span>
        <span className="text-xs text-ink-500">{db.settings.pharmacy.branch} · {db.settings.pharmacy.address}, {db.settings.pharmacy.city}</span>
        <span className="rounded-lg bg-warn-bg px-2.5 py-2 text-xs text-warn">This demo has a single branch. Multi-branch records are branch-scoped in the Supabase design.</span>
      </PopoverContent>
    </Popover>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const dark = mounted && resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="grid size-11 place-items-center rounded-xl border border-line bg-surface text-ink-700 hover:bg-canvas"
    >
      {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  );
}

function Notifications() {
  const db = useDb();
  const index = useStockIndex();
  const can = usePermissions();
  const alerts = useMemo(() => {
    let low = 0,
      out = 0,
      expiring = 0,
      expiring30 = 0;
    for (const s of index.values()) {
      if (s.isLow) low++;
      if (s.isOut) out++;
      if (s.isExpiring) expiring++;
      if (s.isExpiring && (s.daysToExpiry ?? 999) <= 30) expiring30++;
    }
    const today = new Date().toISOString().slice(0, 10);
    const expiredBatches = db.batches.filter((b) => b.quantity > 0 && b.expiryDate <= today).length;
    const openPos = db.purchaseOrders.filter((p) => p.status === "ordered" || p.status === "partially_received").length;
    const list: { tone: string; text: string; href: string }[] = [];
    if (expiredBatches) list.push({ tone: "bg-red-700", text: `${expiredBatches} expired batch${expiredBatches === 1 ? "" : "es"} quarantined — blocked from sale`, href: "/stock-management?tab=expired" });
    if (expiring30) list.push({ tone: "bg-danger-dot", text: `${expiring30} medicine${expiring30 === 1 ? "" : "s"} expiring within 30 days`, href: "/stock-management?tab=30" });
    if (expiring) list.push({ tone: "bg-orange-dot", text: `${expiring} medicines expiring within 90 days`, href: "/stock-management?tab=90" });
    if (out) list.push({ tone: "bg-danger-dot", text: `${out} medicines out of stock`, href: "/inventory?filter=out" });
    if (low) list.push({ tone: "bg-warn-dot", text: `${low} medicines at or below reorder level`, href: "/inventory?filter=low" });
    if (openPos && can("po.view")) list.push({ tone: "bg-brand", text: `${openPos} purchase orders awaiting delivery`, href: "/purchase-orders?status=ordered" });
    if (db.heldSales.length) list.push({ tone: "bg-teal-dot", text: `${db.heldSales.length} held sale${db.heldSales.length === 1 ? "" : "s"} waiting at the POS`, href: "/pos" });
    return list;
  }, [db, index, can]);
  return (
    <Popover>
      <PopoverTrigger aria-label={`Notifications, ${alerts.length} alerts`} className="relative grid size-11 place-items-center rounded-xl border border-line bg-surface text-ink-700 hover:bg-canvas">
        <Bell className="size-5" />
        {alerts.length > 0 && (
          <span className="absolute top-1.5 right-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-surface bg-red px-1 text-[10px] font-bold text-white">{alerts.length}</span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] gap-1 rounded-xl p-2">
        <span className="px-2 pt-1 pb-1.5 text-xs font-semibold tracking-[0.06em] text-ink-500 uppercase">Alerts</span>
        {alerts.length === 0 && <span className="px-2 py-4 text-sm text-ink-500">All clear — no alerts right now.</span>}
        {alerts.map((a) => (
          <Link key={a.text} href={a.href} className="flex items-start gap-2.5 rounded-lg px-2 py-2 text-[13px] hover:bg-canvas">
            <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", a.tone)} aria-hidden />
            <span>{a.text}</span>
          </Link>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function GlobalSearch() {
  const db = useDb();
  const router = useRouter();
  const can = usePermissions();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return [];
    const out: { key: string; icon: typeof Pill; label: string; meta: string; href: string }[] = [];
    if (can("inventory.view"))
      for (const m of db.medicines) {
        if (`${m.brandName} ${m.genericName} ${m.sku} ${m.barcode}`.toLowerCase().includes(term))
          out.push({ key: m.id, icon: Pill, label: medicineName(m), meta: `${m.genericName} · ${m.sku}`, href: `/inventory?medicine=${m.id}` });
        if (out.length >= 6) break;
      }
    if (can("sales.view")) {
      let n = 0;
      for (let i = db.transactions.length - 1; i >= 0 && n < 4; i--) {
        const t = db.transactions[i];
        if (t.receiptNo.toLowerCase().includes(term)) {
          out.push({ key: t.id, icon: ReceiptText, label: t.receiptNo, meta: `${peso(t.total)} · ${t.cashierName}`, href: `/sales?tx=${t.id}` });
          n++;
        }
      }
    }
    if (can("suppliers.view"))
      for (const s of db.suppliers) if (`${s.name} ${s.contactPerson} ${s.city}`.toLowerCase().includes(term)) out.push({ key: s.id, icon: Truck, label: s.name, meta: s.city, href: `/suppliers?supplier=${s.id}` });
    if (can("po.view"))
      for (const p of db.purchaseOrders) if (p.poNumber.toLowerCase().includes(term)) out.push({ key: p.id, icon: ClipboardList, label: p.poNumber, meta: p.status.replace("_", " "), href: `/purchase-orders?po=${p.id}` });
    return out.slice(0, 12);
  }, [q, db, can]);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div ref={wrapRef} className="relative hidden min-w-0 flex-[1_1_260px] md:block md:max-w-[380px]">
      <label className="flex h-[42px] items-center gap-2.5 rounded-xl border border-line bg-canvas px-3 focus-within:border-brand">
        <Search className="size-[18px] shrink-0 text-ink-500" aria-hidden />
        <span className="sr-only">Global search</span>
        <input
          ref={inputRef}
          type="search"
          value={q}
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls="global-search-results"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) go(results[0].href);
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Search medicines, receipts, suppliers…"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-400 [&::-webkit-search-cancel-button]:hidden"
        />
        <kbd className="rounded-md border border-line-strong bg-surface px-1.5 py-0.5 text-[11px] font-semibold text-ink-500">⌘K</kbd>
      </label>
      {open && q.trim().length >= 2 && (
        <div id="global-search-results" role="listbox" className="absolute top-[calc(100%+6px)] left-0 z-50 flex w-[min(420px,calc(100vw-2rem))] animate-rise flex-col gap-0.5 rounded-xl border border-line bg-surface p-1.5 shadow-lg">
          {results.length === 0 && <span className="px-2.5 py-3 text-[13px] text-ink-500">No matches for “{q.trim()}”.</span>}
          {results.map((r) => (
            <button key={r.key} type="button" role="option" aria-selected={false} onClick={() => go(r.href)} className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-canvas">
              <r.icon className="size-4 shrink-0 text-brand" aria-hidden />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[13px] font-semibold">{r.label}</span>
                <span className="truncate text-xs text-ink-500 capitalize">{r.meta}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const user = useCurrentUser();
  const router = useRouter();
  if (!user) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-xl border-l border-line py-1 pr-1 pl-3 text-left hover:bg-canvas">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand font-heading text-sm font-semibold text-white">{user.initials}</span>
        <span className="hidden flex-col gap-0.5 sm:flex">
          <span className="text-[13px] font-semibold whitespace-nowrap">{user.name}</span>
          <span className="inline-flex h-[18px] items-center self-start rounded-full bg-brand-50 px-[7px] text-[10px] font-bold tracking-[0.04em] text-brand-700 uppercase">{ROLE_LABEL[user.role]}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5 py-2">
            <span className="text-sm font-semibold text-ink">{user.name}</span>
            <span className="text-xs font-normal text-ink-500">{user.email} · Demo Mode</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/login")}>
          <UserRoundCog className="size-4" /> Switch demo user / role
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            actions.signOut();
            router.replace("/login");
          }}
        >
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
