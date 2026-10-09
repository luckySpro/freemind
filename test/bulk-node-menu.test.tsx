// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ContextMenu } from "../src/design/primitives";
import { BulkNodeMenu } from "../src/mindmap/flow/BulkNodeMenu";
import type { MindMapDoc } from "../src/model/types";

const doc = (): MindMapDoc => ({
  schemaVersion: 1,
  id: "d",
  title: "T",
  root: {
    id: "r",
    topic: "R",
    children: [
      { id: "a", topic: "A", children: [] },
      { id: "b", topic: "B", children: [] },
    ],
  },
});

function renderMenu(over: Partial<Parameters<typeof BulkNodeMenu>[0]> = {}) {
  const apply = vi.fn();
  const onDelete = vi.fn();
  const props = { ids: ["a", "b"], getDoc: () => doc(), apply, onDelete, ...over };
  render(
    // MenuItem rows read the ContextMenu context.
    <ContextMenu x={0} y={0} onClose={vi.fn()} menuAriaLabel="Topic actions">
      <BulkNodeMenu {...props} />
    </ContextMenu>,
  );
  return { apply, onDelete };
}

const find = (d: MindMapDoc, id: string) => d.root.children.find((c) => c.id === id);

describe("BulkNodeMenu", () => {
  it("shows the selection count and calls onDelete from Delete-N", () => {
    const { onDelete } = renderMenu({ ids: ["a", "b"] });
    expect(screen.getByText("2 topics selected")).toBeTruthy();
    fireEvent.click(screen.getByText("Delete 2 topics"));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("wires group / markers / priority / colour through to apply across the selection", () => {
    const { apply } = renderMenu();
    const lastDoc = () => apply.mock.calls.at(-1)?.[0].doc as MindMapDoc;

    fireEvent.click(screen.getByText(/Group in a boundary/));
    expect(lastDoc().boundaries?.length).toBe(1);

    fireEvent.click(screen.getAllByRole("button", { name: /Toggle marker/ })[0]);
    expect(find(lastDoc(), "a")?.icons?.length).toBeGreaterThan(0); // applied to a member

    fireEvent.click(screen.getAllByRole("button", { name: /Set priority/ })[0]);
    expect(find(lastDoc(), "a")?.task?.priority).toBeDefined();
    expect(find(lastDoc(), "b")?.task?.priority).toBeDefined(); // …across the WHOLE selection

    fireEvent.click(screen.getAllByRole("button", { name: /Branch colour #/ })[0]);
    expect(find(lastDoc(), "a")?.branchColor).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Default branch colour/ }));
    expect(apply).toHaveBeenCalled(); // "" clears (no-op on unset → still committed)

    fireEvent.click(screen.getByRole("button", { name: /Clear priority/ }));
    expect(apply).toHaveBeenCalled();
  });
});
