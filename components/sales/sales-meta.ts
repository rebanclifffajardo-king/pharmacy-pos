import type { ChipTone } from "@/components/shared/chip";
import type { PaymentMethod, TransactionStatus } from "@/lib/types";

export const PAY_TONE: Record<PaymentMethod, ChipTone> = { cash: "brand", qrph: "teal", card: "warn" };

export const STATUS_META: Record<TransactionStatus, { label: string; tone: ChipTone }> = {
  completed: { label: "Paid", tone: "ok" },
  partially_refunded: { label: "Partially refunded", tone: "orange" },
  refunded: { label: "Refunded", tone: "orange" },
  voided: { label: "Voided", tone: "neutral" },
};

export const DISCOUNT_LABEL: Record<string, string> = { none: "—", senior: "SC", pwd: "PWD", manual: "Manual" };
