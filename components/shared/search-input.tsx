"use client";

import { Search, X } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const SearchInput = forwardRef<
  HTMLInputElement,
  { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; ariaLabel?: string; autoFocus?: boolean; onKeyDown?: React.KeyboardEventHandler<HTMLInputElement> }
>(function SearchInput({ value, onChange, placeholder = "Search…", className, ariaLabel, autoFocus, onKeyDown }, ref) {
  return (
    <label className={cn("flex h-[42px] min-w-0 items-center gap-2 rounded-xl border border-line bg-surface px-3 focus-within:border-brand focus-within:shadow-[0_0_0_4px_rgba(34,60,255,.12)]", className)}>
      <Search className="size-4 shrink-0 text-ink-500" aria-hidden />
      <input
        ref={ref}
        type="search"
        value={value}
        autoFocus={autoFocus}
        onKeyDown={onKeyDown}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-400 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search" className="grid size-6 place-items-center rounded-md text-ink-400 hover:bg-chip">
          <X className="size-3.5" />
        </button>
      )}
    </label>
  );
});
