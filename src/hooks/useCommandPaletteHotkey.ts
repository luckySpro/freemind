import { type Dispatch, type SetStateAction, useEffect, useState } from "react";

// ⌘/Ctrl-K opens the in-editor command palette (the Start screen has its own). Owns the open state and
// wires the document-level hotkey only while `enabled` (editor view); returns [open, setOpen] so the
// caller renders the palette + its onClose. Lifted out of App.

export function useCommandPaletteHotkey(
  enabled: boolean,
): [boolean, Dispatch<SetStateAction<boolean>>] {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [enabled]);
  return [open, setOpen];
}
