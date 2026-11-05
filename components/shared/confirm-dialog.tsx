"use client";

import type { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/** Confirmation for destructive or irreversible actions. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  tone = "danger",
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "brand";
  onConfirm: () => void | boolean | Promise<void | boolean>;
  children?: ReactNode;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="gap-5 rounded-2xl p-6 sm:max-w-md">
        <AlertDialogHeader className="items-start text-left">
          <AlertDialogTitle className="font-heading text-lg font-semibold">{title}</AlertDialogTitle>
          {description && <AlertDialogDescription className="text-left text-sm text-ink-500">{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter className="flex-row justify-end gap-2">
          <AlertDialogCancel render={<Button variant="outline" size="md" />}>Cancel</AlertDialogCancel>
          <Button
            size="md"
            variant={tone === "danger" ? "danger-soft" : "brand"}
            onClick={async () => {
              const r = await onConfirm();
              if (r !== false) onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
