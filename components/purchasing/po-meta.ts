import type { PurchaseOrderStatus } from "@/lib/types";
import type { ChipTone } from "@/components/shared/chip";

export const PO_STATUS_META: Record<PurchaseOrderStatus, { label: string; tone: ChipTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  ordered: { label: "Ordered", tone: "brand" },
  partially_received: { label: "Partially received", tone: "warn" },
  received: { label: "Received", tone: "ok" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

export const PO_STATUS_ORDER: PurchaseOrderStatus[] = ["draft", "ordered", "partially_received", "received", "cancelled"];
