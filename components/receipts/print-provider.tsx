"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renders print-only content into a dedicated `#print-root` element appended to <body>,
 * then opens the browser print dialog. Global print CSS (app/globals.css) hides every
 * other body child, so only the receipt (or report) prints — never the app chrome.
 */
type PrintKind = "receipt" | "report";

interface PrintContextValue {
  /** Mounts `node`, opens the print dialog and resolves when the dialog returns. */
  printNode: (kind: PrintKind, node: ReactNode, opts?: { paperWidthMm?: number }) => Promise<void>;
}

const PrintContext = createContext<PrintContextValue | null>(null);

function nextFrame() {
  return new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

async function waitForImages(root: HTMLElement) {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((r) => {
            img.onload = () => r();
            img.onerror = () => r();
            setTimeout(r, 1500);
          })
    )
  );
}

export function PrintProvider({ children }: { children: ReactNode }) {
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const [content, setContent] = useState<ReactNode>(null);
  const busy = useRef(false);

  const printNode = useCallback<PrintContextValue["printNode"]>(
    async (kind, node, opts) => {
      let root = document.getElementById("print-root");
      if (!root) {
        root = document.createElement("div");
        root.id = "print-root";
        document.body.appendChild(root);
      }
      setRoot(root);
      if (busy.current) throw new Error("A print job is already open.");
      busy.current = true;
      const style = document.createElement("style");
      style.setAttribute("data-print-page", kind);
      style.textContent =
        kind === "receipt"
          ? `@page { size: ${opts?.paperWidthMm ?? 58}mm auto; margin: 0; } :root { --receipt-width: ${opts?.paperWidthMm ?? 58}mm; }`
          : `@page { size: A4; margin: 12mm; }`;
      try {
        setContent(node);
        await nextFrame();
        await waitForImages(root);
        document.head.appendChild(style);
        document.body.classList.add(kind === "receipt" ? "printing-receipt" : "printing-report");
        await new Promise<void>((resolve) => {
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            window.removeEventListener("afterprint", finish);
            resolve();
          };
          window.addEventListener("afterprint", finish);
          window.print(); // blocks in most desktop browsers until the dialog closes
          setTimeout(finish, 400); // browsers that return immediately / never fire afterprint
        });
      } finally {
        document.body.classList.remove("printing-receipt", "printing-report");
        style.remove();
        setContent(null);
        busy.current = false;
      }
    },
    []
  );

  return (
    <PrintContext.Provider value={{ printNode }}>
      {children}
      {root && content ? createPortal(content, root) : null}
    </PrintContext.Provider>
  );
}

export function usePrinter() {
  const ctx = useContext(PrintContext);
  if (!ctx) throw new Error("usePrinter must be used inside <PrintProvider>.");
  return ctx;
}
