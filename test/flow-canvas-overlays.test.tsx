// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CoachMark, DropLabel } from "../src/mindmap/flow/CanvasOverlays";
import type { MindMapDoc } from "../src/model/types";

// The rendered overlays use NodeToolbar/MiniMap (a live ReactFlow store), so they're exercised by the
// flowmindmap smoke suite (coachmark + minimap cases). Here we pin the cheap guards that run first.

const doc: MindMapDoc = {
  schemaVersion: 1,
  id: "d",
  title: "R",
  root: { id: "r", topic: "R", children: [] },
};

describe("CanvasOverlays guards", () => {
  it("CoachMark renders nothing while hidden", () => {
    const { container } = render(<CoachMark show={false} rootId="r" />);
    expect(container.firstChild).toBeNull();
  });

  it("DropLabel renders nothing without a drop target", () => {
    const { container } = render(<DropLabel dropTargetId={null} doc={doc} />);
    expect(container.firstChild).toBeNull();
  });
});
