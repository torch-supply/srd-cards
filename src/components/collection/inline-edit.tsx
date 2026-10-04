"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Text that turns into an input on click. Enter (or blur) saves; Escape cancels.
 * Multiline mode uses a textarea where Enter inserts a newline and Cmd/Ctrl+Enter saves.
 */
export function InlineEdit({
  value,
  onSave,
  placeholder,
  multiline,
  disabled,
  maxLength,
  className,
  inputClassName,
  ariaLabel,
}: {
  value: string;
  onSave: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  disabled?: boolean;
  maxLength?: number;
  className?: string;
  inputClassName?: string;
  ariaLabel: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };
  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className={cn(
          "block max-w-full cursor-text truncate rounded-md px-1 -mx-1 text-left hover:bg-muted/70 disabled:cursor-default disabled:hover:bg-transparent",
          multiline && "whitespace-pre-wrap",
          !value && "text-muted-foreground italic",
          className,
        )}
      >
        {value || placeholder}
      </button>
    );
  }

  const shared = {
    ref,
    value: draft,
    maxLength,
    "aria-label": ariaLabel,
    placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft(e.target.value),
    onBlur: commit,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      } else if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        commit();
      }
    },
    className: cn(
      "w-full rounded-md border border-input bg-background px-1.5 -mx-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
      className,
      inputClassName,
    ),
  };
  return multiline ? <textarea rows={3} {...shared} /> : <input {...shared} />;
}
