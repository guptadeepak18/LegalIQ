/**
 * SearchInput — Reusable admin search field.
 * Consistent height, icon alignment, clear button, light/dark theme.
 * Use size="sm" for compact contexts (dashboard table header).
 */
import { useRef } from "react";
import { Search, X } from "lucide-react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** "sm" = h-8 / text-xs  |  "md" = h-10 / text-sm (default) */
  size?: "sm" | "md";
  autoFocus?: boolean;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className = "",
  size = "md",
  autoFocus,
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isSmall = size === "sm";

  return (
    <div className={`relative flex items-center ${className}`}>
      {/* Icon — always perfectly centred */}
      <Search
        size={isSmall ? 13 : 14}
        className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none z-10 flex-shrink-0"
        style={{ color: "var(--liq-text-4)" }}
        aria-hidden
      />

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={[
          "liq-input w-full",
          isSmall ? "h-8 text-xs" : "h-10 text-sm",
          isSmall ? "pl-7.5" : "pl-8.5",
          value ? (isSmall ? "pr-6" : "pr-7") : "pr-3",
        ].join(" ")}
        style={{
          paddingLeft: isSmall ? "1.875rem" : "2.125rem",
          paddingRight: value ? (isSmall ? "1.5rem" : "1.75rem") : "0.75rem",
        }}
      />

      {/* Clear button — only when there's text */}
      {value && (
        <button
          type="button"
          onClick={() => { onChange(""); inputRef.current?.focus(); }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-80 flex items-center justify-center"
          style={{ color: "var(--liq-text-4)" }}
          aria-label="Clear search"
        >
          <X size={isSmall ? 11 : 12} />
        </button>
      )}
    </div>
  );
}
