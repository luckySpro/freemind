import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OutlinePanel } from "../src/Panels";
import type { MapNode } from "../src/model/types";

// Touch drag-reorder (A6): HTML5 drag events never fire on touch, so the Outline runs its own
// long-press → pointer drag. jsdom has no layout (elementFromPoint / rects), so we mock those and drive
// the real handlers with fake timers to verify the wiring: hold → pick up → slide → drop → onMove.

function tree(): MapNode {
  return {
    id: "root",
    topic: "Root",
    children: [
      { id: "a", topic: "Alpha", children: [] },
      { id: "b", topic: "Beta", children: [] },
      { id: "c", topic: "Gamma", children: [] },
    ],
  };
}

// Dispatch a bare pointer event with the fields our handlers read (jsdom lacks a rich PointerEvent).
function pointer(
  el: Element,
  type: string,
  opts: { clientX?: number; clientY?: number; pointerType?: string; pointerId?: number } = {},
) {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(e, { clientX: 0, clientY: 0, pointerType: "touch", pointerId: 1, ...opts });
  el.dispatchEvent(e);
}

function renderOutline(onMove = vi.fn()) {
  const { container } = render(
    <OutlinePanel
      root={tree()}
      filter=""
      onFilterChange={() => {}}
      onPick={() => {}}
      onRename={() => {}}
      onIndent={() => {}}
      onMove={onMove}
    />,
  );
  const row = (id: string) => {
    const el = container.querySelector<HTMLElement>(`[data-outline-id="${id}"]`);
    if (!el) throw new Error(`outline row ${id} not found`);
    return el;
  };
  return { onMove, row };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Outline touch drag-reorder (A6)", () => {
  it("reorders after a long-press, slide, and lift", () => {
    vi.useFakeTimers();
    const { onMove, row } = renderOutline();
    const target = row("c");
    // Give the target a real rect so the drop zone is deterministic: clientY 10 of a 100px row → top
    // band → "before".
    target.getBoundingClientRect = () =>
      ({ top: 0, left: 0, right: 0, bottom: 100, width: 0, height: 100, x: 0, y: 0 }) as DOMRect;
    document.elementFromPoint = vi.fn(() => target);

    pointer(row("a"), "pointerdown", { clientY: 5, pointerType: "touch" });
    vi.advanceTimersByTime(400); // long-press fires → drag mode
    pointer(row("a"), "pointermove", { clientY: 10 });
    pointer(row("a"), "pointerup");

    expect(onMove).toHaveBeenCalledWith("a", "c", "before");
  });

  it("ignores a mouse pointer (the HTML5 drag path handles the mouse)", () => {
    vi.useFakeTimers();
    const { onMove, row } = renderOutline();
    document.elementFromPoint = vi.fn(() => row("c"));

    pointer(row("a"), "pointerdown", { pointerType: "mouse" });
    vi.advanceTimersByTime(400);
    pointer(row("a"), "pointermove", { clientY: 10 });
    pointer(row("a"), "pointerup");

    expect(onMove).not.toHaveBeenCalled();
  });

  it("treats a move before the long-press as a scroll, not a drag", () => {
    vi.useFakeTimers();
    const { onMove, row } = renderOutline();
    document.elementFromPoint = vi.fn(() => row("c"));

    pointer(row("a"), "pointerdown", { clientY: 5, pointerType: "touch" });
    pointer(row("a"), "pointermove", { clientY: 40 }); // moved before hold → scroll intent
    vi.advanceTimersByTime(400); // timer was cancelled
    pointer(row("a"), "pointerup");

    expect(onMove).not.toHaveBeenCalled();
  });
});
