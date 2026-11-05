/** Collision-resistant client IDs. Swap for database-generated UUIDs when moving to Supabase. */
export function uid(prefix = ""): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
      : Math.random().toString(36).slice(2, 18);
  return prefix ? `${prefix}_${rand}` : rand;
}

export function padNumber(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

export function initialsOf(name: string): string {
  return name
    .replace(/,.*$/, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
