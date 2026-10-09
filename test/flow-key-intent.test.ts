import { describe, expect, it } from "vitest";
import {
  type KeyEventLike,
  type KeyIntent,
  type KeyState,
  keyIntent,
} from "../src/mindmap/flow/keyIntent";

// Pure key→intent mapping lifted out of the canvas keydown handler — table-driven over every branch.

const ev = (over: Partial<KeyEventLike>): KeyEventLike => ({
  key: "x",
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  target: null,
  ...over,
});
const st = (over: Partial<KeyState> = {}): KeyState => ({
  editing: false,
  selectedId: "n1",
  linking: false,
  freeform: false,
  pwa: true,
  ...over,
});

describe("keyIntent", () => {
  it("Escape cancels linking first, else clears the drag indicator — even while editing", () => {
    expect(keyIntent(ev({ key: "Escape" }), st({ linking: true }))).toEqual({
      kind: "clearLinking",
    });
    expect(keyIntent(ev({ key: "Escape" }), st({ linking: false }))).toEqual({
      kind: "clearDropTarget",
    });
    // Escape is handled BEFORE the editing guard (must still clear a stray indicator mid-edit).
    expect(keyIntent(ev({ key: "Escape" }), st({ editing: true }))).toEqual({
      kind: "clearDropTarget",
    });
  });

  it("maps the branch-clipboard combos (copy / duplicate / paste) only with a selection", () => {
    expect(keyIntent(ev({ key: "c", ctrlKey: true }), st())).toEqual({
      kind: "copyBranch",
      id: "n1",
    });
    expect(keyIntent(ev({ key: "C", metaKey: true }), st())).toEqual({
      kind: "copyBranch",
      id: "n1",
    });
    expect(keyIntent(ev({ key: "d", ctrlKey: true }), st())).toEqual({
      kind: "duplicateBranch",
      id: "n1",
    });
    expect(keyIntent(ev({ key: "v", ctrlKey: true, shiftKey: true }), st())).toEqual({
      kind: "pasteBranch",
      id: "n1",
    });
    // Plain Ctrl/⌘+V is left for the window-level image-paste hook (not handled here).
    expect(keyIntent(ev({ key: "v", ctrlKey: true }), st())).toBeNull();
    // None fire without a selection.
    expect(keyIntent(ev({ key: "c", ctrlKey: true }), st({ selectedId: null }))).toBeNull();
    expect(keyIntent(ev({ key: "d", ctrlKey: true }), st({ selectedId: null }))).toBeNull();
  });

  it("maps Ctrl/⌘+arrow to a freeform position nudge (only in freeform)", () => {
    // In freeform, Ctrl/⌘+arrow nudges the node's position (a non-drag reposition, WCAG 2.5.7).
    expect(keyIntent(ev({ key: "ArrowLeft", ctrlKey: true }), st({ freeform: true }))).toEqual({
      kind: "nudge",
      id: "n1",
      dir: "left",
    });
    expect(keyIntent(ev({ key: "ArrowUp", metaKey: true }), st({ freeform: true }))).toEqual({
      kind: "nudge",
      id: "n1",
      dir: "up",
    });
    // Not in freeform → Ctrl+arrow is unbound (the auto-layouts own positioning).
    expect(keyIntent(ev({ key: "ArrowLeft", ctrlKey: true }), st({ freeform: false }))).toBeNull();
    // Bare arrow still moves the selection, freeform or not.
    expect(keyIntent(ev({ key: "ArrowLeft" }), st({ freeform: true }))).toEqual({
      kind: "selectDir",
      id: "n1",
      dir: "left",
    });
  });

  it("maps relationship linking (keyboard parity for the mouse Link-to gesture)", () => {
    // Ctrl/⌘+Shift+L starts drawing a relationship from the selected topic.
    expect(keyIntent(ev({ key: "l", ctrlKey: true, shiftKey: true }), st())).toEqual({
      kind: "startLinking",
      id: "n1",
    });
    expect(keyIntent(ev({ key: "L", metaKey: true, shiftKey: true }), st())).toEqual({
      kind: "startLinking",
      id: "n1",
    });
    // No selection → nothing to link from.
    expect(
      keyIntent(ev({ key: "l", ctrlKey: true, shiftKey: true }), st({ selectedId: null })),
    ).toBeNull();
    // While linking, Enter completes the link to the selected target (instead of adding a sibling).
    expect(keyIntent(ev({ key: "Enter" }), st({ linking: true }))).toEqual({
      kind: "completeLink",
      id: "n1",
    });
    // Ctrl+Enter still adds a child even while linking (modifier path is unaffected).
    expect(keyIntent(ev({ key: "Enter", ctrlKey: true }), st({ linking: true }))).toEqual({
      kind: "addChild",
      id: "n1",
    });
    // Not linking → Enter is the usual add-sibling.
    expect(keyIntent(ev({ key: "Enter" }), st({ linking: false }))).toEqual({
      kind: "addSibling",
      id: "n1",
    });
  });

  it("maps Ctrl/⌘+Shift+1..9 to setPriority (MindManager's priority shortcuts)", () => {
    for (let level = 1; level <= 9; level++) {
      expect(keyIntent(ev({ key: String(level), ctrlKey: true, shiftKey: true }), st())).toEqual({
        kind: "setPriority",
        id: "n1",
        level,
      });
      expect(keyIntent(ev({ key: String(level), metaKey: true, shiftKey: true }), st())).toEqual({
        kind: "setPriority",
        id: "n1",
        level,
      });
    }
    // Ctrl+Shift+0 isn't a priority level — falls through (no selection-gated binding claims it).
    expect(keyIntent(ev({ key: "0", ctrlKey: true, shiftKey: true }), st())).toBeNull();
    // Without Shift, a bare Ctrl+digit is unbound.
    expect(keyIntent(ev({ key: "5", ctrlKey: true }), st())).toBeNull();
    // No selection → nothing to set priority on.
    expect(
      keyIntent(ev({ key: "1", ctrlKey: true, shiftKey: true }), st({ selectedId: null })),
    ).toBeNull();
  });

  it("maps Ctrl/⌘ +/−/0 to zoom intents, selection-free (like undo/redo)", () => {
    const noSel = st({ selectedId: null });
    // "=" is the unshifted plus key on most layouts; both it and shifted "+" zoom in.
    expect(keyIntent(ev({ key: "=", ctrlKey: true }), noSel)).toEqual({ kind: "zoomIn" });
    expect(keyIntent(ev({ key: "+", ctrlKey: true, shiftKey: true }), noSel)).toEqual({
      kind: "zoomIn",
    });
    expect(keyIntent(ev({ key: "-", metaKey: true }), noSel)).toEqual({ kind: "zoomOut" });
    expect(keyIntent(ev({ key: "0", ctrlKey: true }), noSel)).toEqual({ kind: "zoomReset" });
    // Ctrl+Shift+0 stays unbound (the digit row with Shift belongs to nothing here).
    expect(keyIntent(ev({ key: "0", ctrlKey: true, shiftKey: true }), noSel)).toBeNull();
    // Without a modifier the keys are ordinary typing (type-to-edit with a selection).
    expect(keyIntent(ev({ key: "-" }), st())).toEqual({ kind: "typeEdit", id: "n1", seed: "-" });
  });

  it("maps Backspace to delete, same as Delete (Mac keyboards lack forward-Delete)", () => {
    expect(keyIntent(ev({ key: "Backspace" }), st())).toEqual({ kind: "delete", id: "n1" });
    expect(keyIntent(ev({ key: "Delete" }), st())).toEqual({ kind: "delete", id: "n1" });
    // No selection → nothing to delete; while editing the guard already swallows it.
    expect(keyIntent(ev({ key: "Backspace" }), st({ selectedId: null }))).toBeNull();
    expect(keyIntent(ev({ key: "Backspace" }), st({ editing: true }))).toBeNull();
  });

  it("ignores keys while inline-editing or when a form field / link is focused", () => {
    expect(keyIntent(ev({ key: "Enter" }), st({ editing: true }))).toBeNull();
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"]) {
      expect(keyIntent(ev({ key: "Enter", target: { tagName } }), st())).toBeNull();
    }
    expect(keyIntent(ev({ key: "Enter", target: { isContentEditable: true } }), st())).toBeNull();
    // a non-field element does NOT block
    expect(keyIntent(ev({ key: "Enter", target: { tagName: "DIV" } }), st())).toEqual({
      kind: "addSibling",
      id: "n1",
    });
  });

  it("maps undo/redo regardless of selection", () => {
    const noSel = st({ selectedId: null });
    expect(keyIntent(ev({ key: "z", ctrlKey: true }), noSel)).toEqual({ kind: "undo" });
    expect(keyIntent(ev({ key: "Z", metaKey: true }), noSel)).toEqual({ kind: "undo" });
    expect(keyIntent(ev({ key: "z", ctrlKey: true, shiftKey: true }), noSel)).toEqual({
      kind: "redo",
    });
    expect(keyIntent(ev({ key: "y", ctrlKey: true }), noSel)).toEqual({ kind: "redo" });
  });

  it("returns null for node shortcuts when nothing is selected", () => {
    const noSel = st({ selectedId: null });
    for (const key of ["Enter", "Tab", "Delete", "F2", "a"]) {
      expect(keyIntent(ev({ key }), noSel), key).toBeNull();
    }
  });

  it("maps the node-building shortcuts when a node is selected", () => {
    const cases: [Partial<KeyEventLike>, KeyIntent][] = [
      [{ key: "Enter" }, { kind: "addSibling", id: "n1" }],
      [
        { key: "Enter", ctrlKey: true },
        { kind: "addChild", id: "n1" },
      ],
      [
        { key: "Enter", metaKey: true },
        { kind: "addChild", id: "n1" },
      ],
      [{ key: "Tab" }, { kind: "addChild", id: "n1" }],
      [
        { key: "Tab", shiftKey: true },
        { kind: "outdent", id: "n1" },
      ],
      [{ key: "Delete" }, { kind: "delete", id: "n1" }],
      [{ key: "F2" }, { kind: "rename", id: "n1" }],
      [
        { key: "t", ctrlKey: true },
        { kind: "openNote", id: "n1" },
      ],
      [
        { key: "T", metaKey: true },
        { kind: "openNote", id: "n1" },
      ],
      [{ key: "a" }, { kind: "typeEdit", id: "n1", seed: "a" }],
    ];
    for (const [e, want] of cases) expect(keyIntent(ev(e), st())).toEqual(want);
  });

  it("Ctrl/⌘+T opens the note ONLY in the installed PWA (a browser tab reserves it)", () => {
    expect(keyIntent(ev({ key: "t", ctrlKey: true }), st({ pwa: true }))).toEqual({
      kind: "openNote",
      id: "n1",
    });
    // Not a PWA → don't claim Ctrl+T; let the browser handle it (returns null here).
    expect(keyIntent(ev({ key: "t", ctrlKey: true }), st({ pwa: false }))).toBeNull();
  });

  it("maps reorder + promote/demote shortcuts (Ctrl/⌘+Shift+↑/↓, Alt+Shift+←/→)", () => {
    const cases: [Partial<KeyEventLike>, KeyIntent][] = [
      [
        { key: "ArrowUp", ctrlKey: true, shiftKey: true },
        { kind: "moveUp", id: "n1" },
      ],
      [
        { key: "ArrowDown", metaKey: true, shiftKey: true },
        { kind: "moveDown", id: "n1" },
      ],
      [
        { key: "ArrowLeft", altKey: true, shiftKey: true },
        { kind: "outdent", id: "n1" },
      ],
      [
        { key: "ArrowRight", altKey: true, shiftKey: true },
        { kind: "indent", id: "n1" },
      ],
    ];
    for (const [e, want] of cases) expect(keyIntent(ev(e), st())).toEqual(want);
  });

  it("type-to-edit only fires for an unmodified single printable char", () => {
    expect(keyIntent(ev({ key: "a", ctrlKey: true }), st())).toBeNull();
    expect(keyIntent(ev({ key: "a", metaKey: true }), st())).toBeNull();
    expect(keyIntent(ev({ key: "a", altKey: true }), st())).toBeNull();
    expect(keyIntent(ev({ key: "Home" }), st())).toBeNull(); // unhandled multi-char key name
  });

  it("maps bare arrows to logical selection movement (no modifiers)", () => {
    const cases: [Partial<KeyEventLike>, KeyIntent][] = [
      [{ key: "ArrowUp" }, { kind: "selectDir", id: "n1", dir: "up" }],
      [{ key: "ArrowDown" }, { kind: "selectDir", id: "n1", dir: "down" }],
      [{ key: "ArrowLeft" }, { kind: "selectDir", id: "n1", dir: "left" }],
      [{ key: "ArrowRight" }, { kind: "selectDir", id: "n1", dir: "right" }],
    ];
    for (const [e, want] of cases) expect(keyIntent(ev(e), st())).toEqual(want);
    // A modifier defers to the restructure shortcuts (not selectDir), and none fire without selection.
    expect(keyIntent(ev({ key: "ArrowUp", ctrlKey: true, shiftKey: true }), st())).toEqual({
      kind: "moveUp",
      id: "n1",
    });
    expect(keyIntent(ev({ key: "ArrowUp" }), st({ selectedId: null }))).toBeNull();
  });
});
