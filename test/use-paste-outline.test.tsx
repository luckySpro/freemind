import { act, renderHook } from "@testing-library/react";
import type { RefObject } from "react";
import { describe, expect, it, vi } from "vitest";
import { usePasteOutline } from "../src/hooks/usePasteOutline";
import type { MindMapHandle } from "../src/mindmap";
import type { MindMapDoc } from "../src/model/types";

// usePasteOutline — parse a pasted outline into a topic forest, then place it as a new map or under
// the selection. The parse itself (parsePaste) has its own tests; this covers the placement wiring.

function setup(handle: Partial<MindMapHandle> = {}) {
  const load = vi.fn();
  const showHint = vi.fn();
  const mapRef = { current: handle as MindMapHandle } as RefObject<MindMapHandle | null>;
  const hook = renderHook(() => usePasteOutline({ load, mapRef, showHint }));
  return { hook, load, showHint };
}

describe("usePasteOutline", () => {
  it("counts the parsed topics live as the text changes", () => {
    const { hook } = setup();
    expect(hook.result.current.count).toBe(0);
    act(() => hook.result.current.setText("- A\n  - B\n- C"));
    expect(hook.result.current.count).toBe(3);
  });

  it("addAsNewMap loads a new doc and resets the dialog", () => {
    const { hook, load, showHint } = setup();
    act(() => {
      hook.result.current.setOpen(true);
      hook.result.current.setText("- One\n- Two");
    });
    act(() => hook.result.current.addAsNewMap());
    expect(load).toHaveBeenCalledTimes(1);
    const doc = load.mock.calls[0][0] as MindMapDoc;
    expect(doc.meta?.source).toBe("paste");
    expect(doc.root.children.map((c) => c.topic)).toEqual(["One", "Two"]); // multi-root → wrapped
    expect(hook.result.current.open).toBe(false);
    expect(hook.result.current.text).toBe("");
    expect(showHint).toHaveBeenCalledWith("Created a map from the pasted text.");
  });

  it("addAsNewMap uses a single root directly (no synthetic wrapper)", () => {
    const { hook, load } = setup();
    act(() => hook.result.current.setText("Root\n  Child"));
    act(() => hook.result.current.addAsNewMap());
    const doc = load.mock.calls[0][0] as MindMapDoc;
    expect(doc.root.topic).toBe("Root");
    expect(doc.root.children.map((c) => c.topic)).toEqual(["Child"]);
  });

  it("hints and does nothing when the text is empty", () => {
    const { hook, load, showHint } = setup();
    act(() => hook.result.current.addAsNewMap());
    expect(load).not.toHaveBeenCalled();
    expect(showHint).toHaveBeenCalledWith("Nothing to add — paste an outline first.");
  });

  it("addUnderSelected routes to the handle and reports the count", () => {
    const addSubtreeToSelected = vi.fn(() => true);
    const { hook, showHint } = setup({ addSubtreeToSelected });
    act(() => hook.result.current.setText("- A\n- B"));
    act(() => hook.result.current.addUnderSelected());
    expect(addSubtreeToSelected).toHaveBeenCalledOnce();
    expect(showHint).toHaveBeenCalledWith("Added 2 topics under the selection.");
    expect(hook.result.current.open).toBe(false);
  });

  it("addUnderSelected hints to pick a node when nothing is selected", () => {
    const { hook, showHint } = setup({ addSubtreeToSelected: () => false });
    act(() => hook.result.current.setText("- A"));
    act(() => hook.result.current.addUnderSelected());
    expect(showHint).toHaveBeenCalledWith("Select a node first, or use New map.");
  });
});
