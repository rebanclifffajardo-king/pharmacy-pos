"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import type { DemoDatabase, RxVerification } from "@/lib/types";
import { hasPermission } from "@/lib/auth/permissions";
import { medicineName } from "@/lib/services/stock";
import { todayKey } from "@/lib/utils/format";
import type { CartLine } from "@/hooks/use-pos";
import { AuthorizeFields } from "@/components/shared/authorize-fields";
import { Field, TextInput } from "@/components/shared/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/**
 * Simulated pharmacist verification for prescription-only items.
 * Not a substitute for real dispensing compliance (Rx validity, FDA/DOH rules, records).
 */
export function RxVerifyDialog({
  open,
  onOpenChange,
  db,
  lines,
  onVerified,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  db: DemoDatabase;
  lines: CartLine[];
  onVerified: (v: RxVerification) => void;
}) {
  const [prescriber, setPrescriber] = useState("");
  const [prc, setPrc] = useState("");
  const [rxDate, setRxDate] = useState(todayKey());
  const [pharmacist, setPharmacist] = useState("");
  const [pin, setPin] = useState("");
  const rxLines = lines.filter((l) => db.medicines.find((m) => m.id === l.medicineId)?.rxRequired);

  const authorize = () => {
    if (!prescriber.trim() || !prc.trim()) return void toast.error("Enter the prescribing physician and PRC license number.");
    if (!rxDate || rxDate > todayKey()) return void toast.error("Prescription date can't be in the future.");
    const u = db.users.find((x) => x.id === pharmacist);
    if (!u || u.status !== "active" || !hasPermission(u.role, "rx.authorize")) return void toast.error("Choose the pharmacist on duty.");
    if (u.pin !== pin) return void toast.error(`Incorrect PIN for ${u.name}.`);
    onVerified({ pharmacistId: u.id, pharmacistName: u.name, prescriber: prescriber.trim(), prcLicense: prc.trim(), rxDate, verifiedAt: new Date().toISOString() });
    setPin("");
    onOpenChange(false);
    toast.success(`Dispensing authorized by ${u.name}`, { description: "Simulated verification · logged with the sale" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-[18px] overflow-y-auto rounded-[20px] p-7 sm:max-w-[520px]">
        <div className="flex flex-col gap-1 pr-8">
          <DialogTitle className="font-heading text-[22px] font-semibold">Pharmacist verification</DialogTitle>
          <DialogDescription className="text-sm text-ink-500">Check the prescription, then authorize with a pharmacist PIN. A label on screen is not authorization.</DialogDescription>
        </div>
        <div className="flex flex-col gap-1.5 rounded-xl bg-canvas p-3">
          {rxLines.map((l) => {
            const m = db.medicines.find((x) => x.id === l.medicineId)!;
            return (
              <div key={l.key} className="flex justify-between gap-3 text-sm font-medium">
                <span>
                  {medicineName(m)} <span className="text-ink-500">({m.genericName})</span>
                </span>
                <span className="text-ink-500">
                  × {l.qty}
                  {l.packMultiplier > 1 ? ` ${l.packLabel.toLowerCase()}` : ""}
                </span>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Prescribing physician">
            <TextInput value={prescriber} onChange={(e) => setPrescriber(e.target.value)} placeholder="Dr. Ana Villanueva" />
          </Field>
          <Field label="PRC license no.">
            <TextInput value={prc} onChange={(e) => setPrc(e.target.value)} placeholder="0123456" />
          </Field>
          <Field label="Prescription date" className="sm:col-span-2">
            <TextInput type="date" value={rxDate} max={todayKey()} onChange={(e) => setRxDate(e.target.value)} />
          </Field>
        </div>
        <AuthorizeFields permission="rx.authorize" userId={pharmacist} onUserId={setPharmacist} pin={pin} onPin={setPin} label="Pharmacist on duty" />
        <p className="flex gap-2 rounded-xl border border-warn-line bg-warn-bg p-3 text-xs leading-relaxed text-warn">
          <ShieldAlert className="size-4 shrink-0" aria-hidden />
          Demo simulation only. It does not replace real dispensing compliance — prescription validity checks, the pharmacist’s professional judgement, and FDA/DOH record-keeping requirements.
        </p>
        <div className="flex justify-end gap-2.5">
          <Button variant="outline" size="touch" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="brand" size="touch" onClick={authorize} disabled={pin.length < 4 || !pharmacist}>
            Authorize dispensing
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
