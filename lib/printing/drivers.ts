import type { ReceiptLine } from "@/lib/services/receipt-service";
import { encodeReceipt, toBase64 } from "./escpos";

/**
 * Print drivers. The UI only reports what a driver can actually confirm:
 *
 *   browser        → "submitted": the browser print dialog was opened and returned.
 *                    Browsers cannot report whether paper actually came out.
 *   escpos-bridge  → "printed" / "failed": only when a native bridge acknowledges the job.
 */
export type PrintOutcome =
  | { status: "submitted"; hardwareConfirmed: false; message: string }
  | { status: "printed"; hardwareConfirmed: true; message: string }
  | { status: "failed"; hardwareConfirmed: false; message: string };

export interface PrintJob {
  kind: "receipt" | "test";
  lines: ReceiptLine[];
  /** Opens the browser print dialog for the receipt node mounted in #print-root. */
  openBrowserDialog: () => Promise<void>;
}

export interface PrinterDriver {
  id: "browser" | "escpos-bridge";
  label: string;
  isAvailable(): boolean;
  print(job: PrintJob): Promise<PrintOutcome>;
}

export const browserPrintDriver: PrinterDriver = {
  id: "browser",
  label: "Browser print dialog",
  isAvailable: () => typeof window !== "undefined" && typeof window.print === "function",
  async print(job) {
    if (!this.isAvailable()) return { status: "failed", hardwareConfirmed: false, message: "Printing is not supported in this browser." };
    await job.openBrowserDialog();
    return {
      status: "submitted",
      hardwareConfirmed: false,
      message: "Print request submitted through the browser dialog. The browser cannot confirm the receipt physically printed.",
    };
  },
};

/** Shape a future Android WebView / local service would inject as `window.YasmarPrinter`. */
interface NativePrinterBridge {
  printEscPos(base64: string): string | Promise<string>; // returns JSON: { ok: boolean, error?: string }
  status?(): string;
}

function getBridge(): NativePrinterBridge | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { YasmarPrinter?: NativePrinterBridge };
  return w.YasmarPrinter && typeof w.YasmarPrinter.printEscPos === "function" ? w.YasmarPrinter : null;
}

export const escPosBridgeDriver: PrinterDriver = {
  id: "escpos-bridge",
  label: "ESC/POS bridge (Android WebView / local service)",
  isAvailable: () => getBridge() !== null,
  async print(job) {
    const bridge = getBridge();
    if (!bridge) return { status: "failed", hardwareConfirmed: false, message: "ESC/POS bridge not detected on this device." };
    try {
      const raw = await bridge.printEscPos(toBase64(encodeReceipt(job.lines)));
      const res = JSON.parse(raw) as { ok: boolean; error?: string };
      return res.ok
        ? { status: "printed", hardwareConfirmed: true, message: "Printer confirmed the receipt was printed." }
        : { status: "failed", hardwareConfirmed: false, message: res.error || "Printer reported an error." };
    } catch (e) {
      return { status: "failed", hardwareConfirmed: false, message: e instanceof Error ? e.message : "Printer bridge error." };
    }
  },
};

export function resolveDriver(connection: "browser" | "escpos-bridge"): PrinterDriver {
  if (connection === "escpos-bridge" && escPosBridgeDriver.isAvailable()) return escPosBridgeDriver;
  return browserPrintDriver;
}
