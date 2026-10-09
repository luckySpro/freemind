import { createContext, useContext } from "react";

// Inline relationship-label editing: double-clicking a cross-link begins an in-place edit of its
// label on the canvas (vs the inspector field). The context lets the edge component (CrosslinkEdge)
// render an input + commit, while FlowMindMap owns the state + the setLinkLabel op. Mirrors the
// EditingContext pattern for topics.

export interface LinkEditApi {
  /** The cross-link currently being label-edited inline, or null. */
  editingId: string | null;
  /** Commit a new label for the link ("" clears it) and end editing. */
  commit: (id: string, label: string) => void;
  /** Abandon the inline edit without changing the label. */
  cancel: () => void;
  /** Set a relationship's perpendicular bow (the draggable midpoint reshape handle). One undo step. */
  setCurve: (id: string, curve: number) => void;
}

export const LinkEditContext = createContext<LinkEditApi | null>(null);

export function useLinkEdit(): LinkEditApi | null {
  return useContext(LinkEditContext);
}
