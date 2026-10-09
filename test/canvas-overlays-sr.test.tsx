// @vitest-environment jsdom
//
// CanvasOverlaysSR is the always-present, read-only screen-reader list of the map's canvas overlays —
// boundaries, summary brackets, and callout bubbles — which are otherwise non-focusable SVG/HTML that
// AT can't reach and that appear nowhere else. Mirrors CanvasRelationshipsSR.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CanvasOverlaysSR } from "../src/mindmap/flow/CanvasOverlaysSR";
import type { MindMapDoc } from "../src/model/types";

const base: MindMapDoc = {
  schemaVersion: 1,
  id: "d",
  title: "Root",
  root: {
    id: "r",
    topic: "Root",
    children: [
      {
        id: "a",
        topic: "Alpha",
        callouts: [{ id: "c1", text: "remember this", dx: 0, dy: 0 }],
        children: [],
      },
      { id: "b", topic: "Beta", children: [] },
    ],
  },
};

describe("CanvasOverlaysSR", () => {
  it("lists boundaries, summaries and callouts in labelled landmarks", () => {
    render(
      <CanvasOverlaysSR
        doc={{
          ...base,
          boundaries: [{ id: "bd1", nodeIds: ["a", "b"], label: "Phase 1" }],
          summaries: [{ id: "sm1", nodeIds: ["a"], label: "Outcome" }],
        }}
      />,
    );
    expect(screen.getByRole("navigation", { name: /boundaries \(1\)/i })).toBeTruthy();
    expect(screen.getByText("Phase 1: Alpha, Beta")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: /summaries \(1\)/i })).toBeTruthy();
    expect(screen.getByText("Outcome: Alpha")).toBeTruthy();
    // The callout on Alpha is announced with its host topic.
    expect(screen.getByRole("navigation", { name: /callouts \(1\)/i })).toBeTruthy();
    expect(screen.getByText("Alpha: remember this")).toBeTruthy();
  });

  it("renders nothing when there are no overlays", () => {
    const { container } = render(
      <CanvasOverlaysSR doc={{ ...base, root: { id: "r", topic: "R", children: [] } }} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
