/** Currency, number and date formatting fixed to PHP / Asia/Manila. */

export const TIMEZONE = "Asia/Manila";
export const LOCALE = "en-PH";

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const pesoFmt = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const intFmt = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });

/** ₱1,234.50 */
export function peso(n: number): string {
  const v = round2(n);
  return (v < 0 ? "−₱" : "₱") + pesoFmt.format(Math.abs(v));
}

/** 1,234.50 (no symbol) — used on receipts. */
export function money(n: number): string {
  const v = round2(n);
  return (v < 0 ? "-" : "") + pesoFmt.format(Math.abs(v));
}

/** Compact peso for chart axes: ₱48k, ₱1.2M */
export function pesoShort(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e6) return "₱" + (n / 1e6).toFixed(a >= 1e7 ? 0 : 1) + "M";
  if (a >= 1e3) return "₱" + (n / 1e3).toFixed(a >= 1e4 ? 0 : 1) + "k";
  return "₱" + Math.round(n);
}

export function int(n: number): string {
  return intFmt.format(Math.round(n));
}

export function percent(n: number, digits = 1): string {
  return (n * 100).toFixed(digits) + "%";
}

function toDate(d: string | Date): Date {
  return typeof d === "string" ? new Date(d) : d;
}

/** Nov 5, 2026 */
export function formatDate(d: string | Date): string {
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, day, 4)).toLocaleDateString(LOCALE, {
      timeZone: TIMEZONE,
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  return toDate(d).toLocaleDateString(LOCALE, { timeZone: TIMEZONE, month: "short", day: "numeric", year: "numeric" });
}

/** 3:41 PM */
export function formatTime(d: string | Date): string {
  return toDate(d).toLocaleTimeString("en-US", { timeZone: TIMEZONE, hour: "numeric", minute: "2-digit" });
}

/** Nov 5, 2026 · 3:41 PM */
export function formatDateTime(d: string | Date): string {
  return formatDate(d) + " · " + formatTime(d);
}

/** Nov 5 · 3:41 PM (no year) */
export function formatShortDateTime(d: string | Date): string {
  const date = toDate(d).toLocaleDateString(LOCALE, { timeZone: TIMEZONE, month: "short", day: "numeric" });
  return date + " · " + formatTime(d);
}

/** Relative: "Today, 3:41 PM", "Yesterday", "Nov 2" */
export function formatRelative(d: string | Date, now: Date = new Date()): string {
  const key = dateKey(toDate(d));
  const today = dateKey(now);
  if (key === today) return "Today, " + formatTime(d);
  if (key === addDays(today, -1)) return "Yesterday, " + formatTime(d);
  return toDate(d).toLocaleDateString(LOCALE, { timeZone: TIMEZONE, month: "short", day: "numeric" }) + ", " + formatTime(d);
}

/** Expiry label: "Dec 2027" style for far dates. */
export function formatMonthYear(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString(LOCALE, { month: "short", year: "numeric", timeZone: "UTC" });
}

// ---------------------------------------------------------------------------
// Date keys (calendar dates in Asia/Manila)
// ---------------------------------------------------------------------------

const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });

/** YYYY-MM-DD for the instant in Asia/Manila. */
export function dateKey(d: Date | string = new Date()): string {
  return keyFmt.format(toDate(d));
}

export function todayKey(): string {
  return dateKey(new Date());
}

/** Adds days to a YYYY-MM-DD key. */
export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

/** ISO instant for a Manila wall-clock time on a given date key. */
export function manilaInstant(key: string, hour: number, minute = 0, second = 0): string {
  const [y, m, d] = key.split("-").map(Number);
  // Asia/Manila is UTC+8 with no DST.
  return new Date(Date.UTC(y, m - 1, d, hour - 8, minute, second)).toISOString();
}

/** Hour of day (0–23) in Manila for an instant. */
export function manilaHour(d: string | Date): number {
  return Number(
    toDate(d).toLocaleString("en-US", { timeZone: TIMEZONE, hour: "numeric", hour12: false }).replace(/\D/g, "")
  ) % 24;
}

/** Monday-based ISO week key for a date key, e.g. "2026-W45". */
export function weekKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Monday date key of the week containing `key`. */
export function startOfWeek(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
  return addDays(key, 1 - day);
}

export function monthKey(key: string): string {
  return key.slice(0, 7);
}

export function formatMonthKey(mk: string, style: "short" | "long" = "short"): string {
  const [y, m] = mk.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString(LOCALE, { month: style, timeZone: "UTC" });
}
