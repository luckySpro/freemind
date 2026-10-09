// The canvas keydown handler, split into a PURE key→intent mapping (this file) + the listener wiring +
// dispatch (FlowMindMap). Same keys, same guards as before — but now unit-testable without a DOM.

export type KeyIntent =
  | { kind: "clearLinking" }
  | { kind: "clearDropTarget" }
  | { kind: "undo" }
  | { kind: "redo" }
  | { kind: "addChild"; id: string }
  | { kind: "addSibling"; id: string }
  | { kind: "outdent"; id: string }
  | { kind: "indent"; id: string }
  | { kind: "moveUp"; id: string }
  | { kind: "moveDown"; id: string }
  | { kind: "delete"; id: string }
  | { kind: "openNote"; id: string }
  | { kind: "rename"; id: string }
  | { kind: "typeEdit"; id: string; seed: string }
  | { kind: "selectDir"; id: string; dir: "up" | "down" | "left" | "right" }
  | { kind: "copyBranch"; id: string }
  | { kind: "duplicateBranch"; id: string }
  | { kind: "pasteBranch"; id: string }
  | { kind: "startLinking"; id: string }
  | { kind: "completeLink"; id: string }
  | { kind: "nudge"; id: string; dir: "up" | "down" | "left" | "right" }
  | { kind: "setPriority"; id: string; level: number }
  | { kind: "zoomIn" }
  | { kind: "zoomOut" }
  | { kind: "zoomReset" }
  | null;

export interface KeyState {
  /** A node is being inline-edited (typing should go to the editor, not trigger shortcuts). */
  editing: boolean;
  /** The selected (anchor) node id, or null. */
  selectedId: string | null;
  /** A relationship link is being drawn (Escape cancels it). */
  linking: boolean;
  /** The map is in free-canvas (freeform) mode, where nodes carry manual positions — enables the
   *  Ctrl/⌘+arrow keyboard nudge (a non-drag way to reposition, for WCAG 2.5.7). */
  freeform: boolean;
  /** Running as an installed PWA (standalone). Gates browser-reserved shortcuts like Ctrl/⌘+T, which
   *  only reach the page in standalone mode (a normal tab hands them to the browser). */
  pwa: boolean;
}

/** The minimal event shape keyIntent reads (a real KeyboardEvent satisfies it; tests pass a literal). */
export interface KeyEventLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  target: { tagName?: string; isContentEditable?: boolean } | null;
}

const FIELD = /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/;

/** Map a keydown to the editor intent it triggers (or null for "ignore"). All `kind`s except the two
 *  `clear*` ones are dispatched with preventDefault by the caller. Order matters: Escape is handled
 *  before the inline-editing guard (it must still clear a stray drag indicator while editing). */
export function keyIntent(e: KeyEventLike, state: KeyState): KeyIntent {
  if (e.key === "Escape" && state.linking) return { kind: "clearLinking" };
  if (e.key === "Escape") return { kind: "clearDropTarget" };
  if (state.editing) return null;
  const t = e.target;
  if (t && (t.isContentEditable || (t.tagName ? FIELD.test(t.tagName) : false))) return null;
  // Undo/redo work regardless of selection.
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z")
    return e.shiftKey ? { kind: "redo" } : { kind: "undo" };
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") return { kind: "redo" };
  // Keyboard zoom (Ctrl/⌘ + / − / 0) — selection-free, like undo/redo. Claims the browser's own
  // page-zoom bindings while the canvas has focus (the dispatcher preventDefaults). "=" is the
  // unshifted plus key on most layouts, so accept it (and the shifted "+") for zoom-in.
  if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "+" || e.key === "="))
    return { kind: "zoomIn" };
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key === "-") return { kind: "zoomOut" };
  if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key === "0")
    return { kind: "zoomReset" };
  const id = state.selectedId;
  if (!id) return null;
  // While drawing a relationship, Enter links the source to the currently-selected target (Esc cancels,
  // handled above). Keyboard parity for the mouse "click a target to finish" step.
  if (state.linking && e.key === "Enter" && !e.ctrlKey && !e.metaKey)
    return { kind: "completeLink", id };
  // Reorder among siblings (Ctrl/⌘+Shift+↑/↓) and promote/demote (Alt+Shift+←/→) — MindManager-style
  // restructuring without the mouse. Checked before the single-char type-edit guard (arrows are multi-char).
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "ArrowUp") return { kind: "moveUp", id };
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "ArrowDown")
    return { kind: "moveDown", id };
  if (e.altKey && e.shiftKey && e.key === "ArrowLeft") return { kind: "outdent", id };
  if (e.altKey && e.shiftKey && e.key === "ArrowRight") return { kind: "indent", id };
  // Branch clipboard: copy (Ctrl/⌘+C), duplicate-as-sibling (Ctrl/⌘+D), paste under the selection
  // (Ctrl/⌘+Shift+V). NOT Ctrl/⌘+V — that's the window-level image paste (useClipboardImagePaste).
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "c")
    return { kind: "copyBranch", id };
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "d")
    return { kind: "duplicateBranch", id };
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "v")
    return { kind: "pasteBranch", id };
  // Start drawing a relationship from the selected topic — keyboard parity for the mouse "Link to…"
  // menu + drag grip. Ctrl/⌘+Shift+L, then arrow to a target and Enter to complete (Esc cancels).
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "l")
    return { kind: "startLinking", id };
  // Set the selected topic's priority (MindManager's Ctrl+Shift+1..9 — 1 = highest, 9 = lowest).
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && /^[1-9]$/.test(e.key))
    return { kind: "setPriority", id, level: Number(e.key) };
  // Free-canvas mode: Ctrl/⌘+arrow nudges the selected node's position by a step (a keyboard / non-drag
  // alternative to drag-positioning — WCAG 2.5.7). Only in freeform; the auto-layouts ignore node.pos.
  if (state.freeform && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
    if (e.key === "ArrowUp") return { kind: "nudge", id, dir: "up" };
    if (e.key === "ArrowDown") return { kind: "nudge", id, dir: "down" };
    if (e.key === "ArrowLeft") return { kind: "nudge", id, dir: "left" };
    if (e.key === "ArrowRight") return { kind: "nudge", id, dir: "right" };
  }
  // Bare arrows move the selection through the tree (left=parent, right=child, up/down=siblings).
  if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
    if (e.key === "ArrowUp") return { kind: "selectDir", id, dir: "up" };
    if (e.key === "ArrowDown") return { kind: "selectDir", id, dir: "down" };
    if (e.key === "ArrowLeft") return { kind: "selectDir", id, dir: "left" };
    if (e.key === "ArrowRight") return { kind: "selectDir", id, dir: "right" };
  }
  if (e.key === "Enter")
    return e.ctrlKey || e.metaKey ? { kind: "addChild", id } : { kind: "addSibling", id };
  if (e.key === "Tab" && !e.shiftKey) return { kind: "addChild", id };
  if (e.key === "Tab" && e.shiftKey) return { kind: "outdent", id };
  // Backspace = Delete (Mac keyboards lack forward-Delete; overlays already accept both). Safe from
  // the type-to-edit branch below — its guard only catches single-character keys.
  if (e.key === "Delete" || e.key === "Backspace") return { kind: "delete", id };
  // Ctrl/⌘+T → open the selected topic's note. Only in the installed PWA: a normal browser tab
  // reserves Ctrl+T for "new tab" (the page can't intercept it), so we don't claim it there.
  if (state.pwa && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "t")
    return { kind: "openNote", id };
  if (e.key === "F2") return { kind: "rename", id };
  // Type-to-edit (MindManager-style): a single printable char starts editing with that char as the seed.
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey)
    return { kind: "typeEdit", id, seed: e.key };
  return null;
}
