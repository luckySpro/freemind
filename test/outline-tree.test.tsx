// @vitest-environment jsdom
//
// OutlinePanel is the screen-reader-primary tree (role="tree") for the map (UI-5). These tests pin the
// ARIA structure + roving-tabindex keyboard navigation so a regression can't quietly drop the tree
// semantics. Keyboard is driven via fireEvent.keyDown on the tree container (the handler lives there).
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OutlinePanel } from "../src/Panels";
import type { MapNode } from "../src/model/types";

const n = (id: string, topic: string, children: MapNode[] = []): MapNode => ({
  id,
  topic,
  children,
});
// Root ▸ A ▸ A1 ; Root ▸ B   → rows: Root(0) A(1) A1(2) B(1)
const root = n("root", "Root", [n("a", "A", [n("a1", "A1")]), n("b", "B")]);

const renderOutline = (selectedId: string | null = null, onPick = vi.fn()) => {
  render(
    <OutlinePanel
      root={root}
      filter=""
      selectedId={selectedId}
      onFilterChange={() => {}}
      onPick={onPick}
    />,
  );
  return { onPick };
};

const activeRowText = () =>
  screen
    .getAllByRole("treeitem")
    .find((el) => el.tabIndex === 0)
    ?.textContent?.trim();

describe("OutlinePanel accessible tree", () => {
  it("exposes role=tree with treeitems carrying aria-level and aria-expanded", () => {
    renderOutline();
    expect(screen.getByRole("tree")).toBeTruthy();
    const items = screen.getAllByRole("treeitem");
    expect(items).toHaveLength(4);
    const byText = (t: string) => items.find((el) => el.textContent?.trim() === t);
    expect(byText("Root")?.getAttribute("aria-level")).toBe("1");
    expect(byText("A")?.getAttribute("aria-level")).toBe("2");
    expect(byText("A1")?.getAttribute("aria-level")).toBe("3");
    // Parents (have children) are expanded; leaves carry no aria-expanded.
    expect(byText("Root")?.getAttribute("aria-expanded")).toBe("true");
    expect(byText("A")?.getAttribute("aria-expanded")).toBe("true");
    expect(byText("A1")?.getAttribute("aria-expanded")).toBeNull();
    expect(byText("B")?.getAttribute("aria-expanded")).toBeNull();
  });

  it("reflects the canvas selection via aria-selected", () => {
    renderOutline("b");
    const b = screen.getAllByRole("treeitem").find((el) => el.textContent?.trim() === "B");
    expect(b?.getAttribute("aria-selected")).toBe("true");
  });

  it("navigates the tree with arrow keys (roving tabindex) and activates with Enter", () => {
    const { onPick } = renderOutline();
    const tree = screen.getByRole("tree");
    // Roving focus defaults to the first row.
    expect(activeRowText()).toBe("Root");
    fireEvent.keyDown(tree, { key: "ArrowDown" });
    expect(activeRowText()).toBe("A");
    fireEvent.keyDown(tree, { key: "ArrowRight" }); // into the first child
    expect(activeRowText()).toBe("A1");
    fireEvent.keyDown(tree, { key: "ArrowLeft" }); // back out to the parent
    expect(activeRowText()).toBe("A");
    fireEvent.keyDown(tree, { key: "Enter" }); // activate → focus the canvas node
    expect(onPick).toHaveBeenCalledWith("a");
  });

  it("Home/End jump to the first/last row", () => {
    renderOutline();
    const tree = screen.getByRole("tree");
    fireEvent.keyDown(tree, { key: "End" });
    expect(activeRowText()).toBe("B");
    fireEvent.keyDown(tree, { key: "Home" });
    expect(activeRowText()).toBe("Root");
  });

  it("keeps exactly one treeitem in the tab order (single tab stop)", () => {
    renderOutline();
    const tabbable = screen.getAllByRole("treeitem").filter((el) => el.tabIndex === 0);
    expect(tabbable).toHaveLength(1);
    // Inner buttons are not separate tab stops.
    const firstRow = screen.getAllByRole("treeitem")[0];
    for (const btn of within(firstRow).queryAllByRole("button")) {
      expect(btn.tabIndex).toBe(-1);
    }
  });
});
