import type { ReceiptLine } from "@/lib/services/receipt-service";

/**
 * Minimal ESC/POS encoder for 58mm thermal printers (XPrinter XP-58 family).
 * Not used by browser printing — it prepares bytes for a future native bridge
 * (Android WebView JavaScript interface, local print service or WebUSB/Web Serial).
 *
 * Note: most XPrinter firmware uses code page PC437/PC850; "₱" is not available and is
 * replaced with "P". Configure the bridge's code page to match the device.
 */
const ESC = 0x1b;
const GS = 0x1d;

export function encodeReceipt(lines: ReceiptLine[], opts: { cut?: boolean; feedLines?: number } = {}): Uint8Array {
  const bytes: number[] = [ESC, 0x40]; // initialize
  const text = (s: string) => {
    for (const ch of s.replace(/₱/g, "P").replace(/[^\x20-\x7e]/g, "?")) bytes.push(ch.charCodeAt(0));
  };
  for (const l of lines) {
    bytes.push(ESC, 0x45, l.bold ? 1 : 0); // emphasis on/off
    bytes.push(GS, 0x21, l.large ? 0x01 : 0x00); // double height
    text(l.text);
    bytes.push(0x0a);
  }
  bytes.push(GS, 0x21, 0x00, ESC, 0x45, 0);
  for (let i = 0; i < (opts.feedLines ?? 4); i++) bytes.push(0x0a);
  if (opts.cut !== false) bytes.push(GS, 0x56, 0x42, 0x00); // partial cut (ignored by printers without cutter)
  return new Uint8Array(bytes);
}

export function toBase64(bytes: Uint8Array): string {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return typeof btoa === "function" ? btoa(bin) : "";
}
