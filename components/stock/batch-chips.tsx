"use client";

import type { Batch } from "@/lib/types";
import { Chip, type ChipTone } from "@/components/shared/chip";
import { daysBetween, formatDate, todayKey } from "@/lib/utils/format";

export function expiryTone(days: number): ChipTone {
  if (days <= 0) return "solid-danger";
  if (days <= 30) return "danger";
  if (days <= 60) return "orange";
  if (days <= 90) return "warn";
  return "ok";
}

/** Expiry pill: "Dec 16, 2026 · 41d" coloured by urgency (design: Expiry artboard). */
export function ExpiryChip({ expiryDate, today = todayKey(), prefix, className }: { expiryDate: string; today?: string; prefix?: string; className?: string }) {
  const days = daysBetween(today, expiryDate);
  return (
    <Chip tone={expiryTone(days)} className={className}>
      {prefix}
      {formatDate(expiryDate)} · {days <= 0 ? "expired" : `${days}d`}
    </Chip>
  );
}

export function batchStatusInfo(b: Pick<Batch, "status" | "expiryDate" | "quantity">, today = todayKey()): { label: string; tone: ChipTone } {
  const expired = b.expiryDate <= today;
  if (b.status === "written_off") return { label: "Written off", tone: "neutral" };
  if (b.status === "recalled") return { label: "Recalled", tone: "ink" };
  if (b.status === "quarantined") return { label: "Quarantined", tone: "solid-danger" };
  if (expired) return { label: "Expired · blocked", tone: "solid-danger" };
  if (b.quantity <= 0) return { label: "Depleted", tone: "neutral" };
  return { label: "Saleable", tone: "ok" };
}

export function BatchStatusChip({ batch, today }: { batch: Pick<Batch, "status" | "expiryDate" | "quantity">; today?: string }) {
  const s = batchStatusInfo(batch, today);
  return <Chip tone={s.tone}>{s.label}</Chip>;
}
