"use client";

import * as React from "react";
import { SearchIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";

/**
 * Search box with a leading icon and a clear button. Escape clears the text,
 * or leaves the field when it's already empty. `onClear` defaults to
 * `onValueChange("")`.
 */
function SearchInput({
  ref,
  value,
  onValueChange,
  onClear = () => onValueChange(""),
  onKeyDown,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
  onClear?: () => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useImperativeHandle(ref, () => inputRef.current!, []);
  return (
    <div className={cn("relative", className)}>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.defaultPrevented || e.key !== "Escape") return;
          e.preventDefault();
          if (value) onClear();
          else e.currentTarget.blur();
        }}
        className="pr-8 pl-8"
        {...props}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            onClear();
            inputRef.current?.focus();
          }}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export { SearchInput };
