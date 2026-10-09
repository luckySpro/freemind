import { useEffect, useState } from "react";
import type { NamedStyle } from "../Panels";
import type { MapNode } from "../model/types";

// Named styles ("styles organizer"): a small app-wide library of saved looks, persisted in
// localStorage so a style is reusable across maps. "Save style" captures the *selected* node's style;
// lifted out of App so the shell isn't carrying the persistence + capture logic inline.

const KEY = "mindmap-named-styles";

interface Options {
  /** The currently-selected node — its `style` is what "Save style" captures. */
  selectedNode: MapNode | null;
  /** Surface a transient hint (e.g. when there's nothing styled to save). */
  showHint: (message: string) => void;
}

export function useNamedStyles({ selectedNode, showHint }: Options) {
  const [namedStyles, setNamedStyles] = useState<NamedStyle[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(namedStyles));
    } catch {
      // preference is best-effort
    }
  }, [namedStyles]);

  // Capture the selected node's style under `name` (replacing any same-named entry). A node with no
  // style is a no-op with a hint — there's nothing to save.
  const saveNamedStyle = (name: string) => {
    const style = selectedNode?.style;
    if (!style || Object.keys(style).length === 0) {
      showHint("Select a styled topic first (style it, then save it as a named style).");
      return;
    }
    setNamedStyles((prev) => [
      ...prev.filter((s) => s.name !== name),
      { id: crypto.randomUUID(), name, style },
    ]);
  };

  const deleteNamedStyle = (id: string) =>
    setNamedStyles((prev) => prev.filter((s) => s.id !== id));

  return { namedStyles, saveNamedStyle, deleteNamedStyle };
}
