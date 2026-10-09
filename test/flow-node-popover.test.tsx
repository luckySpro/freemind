// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NodePopover } from "../src/mindmap/flow/NodePopover";
import type { MindMapDoc } from "../src/model/types";

// The popover's rendered toolbar (NodeToolbar) needs a live ReactFlow store, so it's exercised by the
// flowmindmap smoke suite ("shows the quick-action popover"). Here we pin the cheap guard logic that
// runs BEFORE NodeToolbar — when the popover must render nothing at all.

const doc: MindMapDoc = {
  schemaVersion: 1,
  id: "d",
  title: "R",
  root: { id: "r", topic: "R", children: [] },
};
const noop = () => {};

describe("NodePopover", () => {
  it("renders nothing when no node is selected", () => {
    const { container } = render(
      <NodePopover
        selectedId={null}
        editingId={null}
        doc={doc}
        onToggleCollapse={noop}
        onOpenNote={noop}
        onCyclePriority={noop}
        onStartLink={noop}
        onMore={noop}
        onAddChild={noop}
        onAddSibling={noop}
        onOpenInfo={noop}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing while the selected node is being inline-edited", () => {
    const { container } = render(
      <NodePopover
        selectedId="r"
        editingId="r"
        doc={doc}
        onToggleCollapse={noop}
        onOpenNote={noop}
        onCyclePriority={noop}
        onStartLink={noop}
        onMore={noop}
        onAddChild={noop}
        onAddSibling={noop}
        onOpenInfo={noop}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
