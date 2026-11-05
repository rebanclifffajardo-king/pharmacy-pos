import { cn } from "@/lib/utils";
import { forwardRef, type ReactNode } from "react";

/** Labelled form field (design: 12–13px semibold label above a 44–46px input). */
export function Field({ label, hint, error, children, className, htmlFor }: { label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-xs font-semibold text-ink-700">
        {label}
      </label>
      {children}
      {error ? <span className="text-xs font-medium text-danger">{error}</span> : hint ? <span className="text-xs text-ink-500">{hint}</span> : null}
    </div>
  );
}

const base =
  "h-11 w-full min-w-0 rounded-xl border border-line-strong bg-surface px-3 text-sm font-medium text-ink outline-none transition-shadow placeholder:font-normal placeholder:text-ink-400 focus:border-brand focus:shadow-[0_0_0_4px_rgba(34,60,255,.12)] disabled:cursor-not-allowed disabled:bg-chip disabled:text-ink-500 aria-invalid:border-danger-dot";

export const TextInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function TextInput({ className, ...props }, ref) {
  return <input ref={ref} className={cn(base, className)} {...props} />;
});

export const TextArea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(base, "h-auto min-h-[84px] py-2.5 font-normal", className)} {...props} />;
});

/** Native select styled to the design — reliable on touch devices and in dialogs. */
export const NativeSelect = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function NativeSelect({ className, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        base,
        "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2214%22 height=%2214%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23555C78%22 stroke-width=%222%22 stroke-linecap=%22round%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:14px] bg-[right_12px_center] bg-no-repeat pr-9",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});

/** Peso-prefixed numeric input. */
export const MoneyInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function MoneyInput({ className, ...props }, ref) {
  return (
    <span className={cn("flex h-11 items-center gap-1.5 rounded-xl border border-line-strong bg-surface px-3 focus-within:border-brand focus-within:shadow-[0_0_0_4px_rgba(34,60,255,.12)]", className)}>
      <span className="text-sm font-semibold text-ink-500">₱</span>
      <input ref={ref} inputMode="decimal" className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none" {...props} />
    </span>
  );
});
