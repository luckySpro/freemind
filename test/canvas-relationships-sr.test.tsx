// @vitest-environment jsdom
//
// CanvasRelationshipsSR is the always-present, read-only screen-reader list of the map's cross-links —
// the one place a relationship (a non-focusable SVG edge, invisible to AT) is exposed by name. Pins
// that both endpoints + the label are announced, and that the section is absent with no links.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CanvasRelationshipsSR } from "../src/mindmap/flow/CanvasRelationshipsSR";
import type { MindMapDoc } from "../src/model/types";

const base: MindMapDoc = {
  schemaVersion: 1,
  id: "d",
  title: "Root",
  root: {
    id: "r",
    topic: "Root",
    children: [
      { id: "a", topic: "Alpha", children: [] },
      { id: "b", topic: "Beta", children: [] },
    ],
  },
};

describe("CanvasRelationshipsSR", () => {
  it("lists each relationship with both endpoints + the label, in a labelled landmark", () => {
    render(
      <CanvasRelationshipsSR
        doc={{ ...base, links: [{ id: "l1", from: "a", to: "b", label: "supports" }] }}
      />,
    );
    expect(screen.getByRole("navigation", { name: /relationships \(1\)/i })).toBeTruthy();
    expect(screen.getByText(/Alpha → Beta: supports/)).toBeTruthy();
  });

  it("falls back to the endpoint names when a link has no label", () => {
    render(<CanvasRelationshipsSR doc={{ ...base, links: [{ id: "l1", from: "a", to: "b" }] }} />);
    expect(screen.getByText("Alpha → Beta")).toBeTruthy();
  });

  it("renders nothing when there are no relationships", () => {
    const { container } = render(<CanvasRelationshipsSR doc={{ ...base, links: [] }} />);
    expect(container.firstChild).toBeNull();
  });
});
