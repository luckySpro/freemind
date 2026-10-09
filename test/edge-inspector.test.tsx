// Component test for EdgeInspector — the right-panel for a selected relationship. Asserts each
// control fires the right callback (label commit, direction/arrow, colour/width/dash, delete) so the
// canvas's edge mutators get the correct args. Visible-text/role/label assertions, not structure.
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EdgeInspector } from "../src/components/EdgeInspector";
import type { SelectedEdge } from "../src/mindmap";

const edge: SelectedEdge = {
  id: "l",
  label: "rel",
  arrow: "to",
  color: "#8b87e0",
  width: 1.5,
  dash: "dashed",
  type: "relates-to",
  showTypes: false,
};

function setup(over: Partial<SelectedEdge> = {}) {
  const onSetLabel = vi.fn();
  const onSetArrow = vi.fn();
  const onSetStyle = vi.fn();
  const onToggleShowTypes = vi.fn();
  const onDelete = vi.fn();
  render(
    <EdgeInspector
      edge={{ ...edge, ...over }}
      fromTopic="Alpha"
      toTopic="Beta"
      onSetLabel={onSetLabel}
      onSetArrow={onSetArrow}
      onSetStyle={onSetStyle}
      onToggleShowTypes={onToggleShowTypes}
      onDelete={onDelete}
    />,
  );
  return { onSetLabel, onSetArrow, onSetStyle, onToggleShowTypes, onDelete };
}

describe("EdgeInspector", () => {
  it("renders the relationship shell with the From → To caption", () => {
    setup();
    expect(screen.getByLabelText("Relationship info")).toBeTruthy();
    expect(screen.getByTitle("Alpha → Beta")).toBeTruthy();
  });

  it("shows the relationship label as a faint context line (P5)", () => {
    setup({ label: "blocks" });
    expect(screen.getByText("Relationship: blocks")).toBeTruthy();
  });

  it("commits the label on Enter", async () => {
    const { onSetLabel } = setup();
    const input = screen.getByLabelText("Relationship label");
    await userEvent.clear(input);
    await userEvent.type(input, "blocks{Enter}");
    expect(onSetLabel).toHaveBeenCalledWith("blocks");
  });

  it("fires onSetArrow with the chosen direction", async () => {
    const { onSetArrow } = setup();
    // Exact title — the Direction button (the preset row has its own "…both ends" description).
    await userEvent.click(screen.getByTitle("Arrows at both ends"));
    expect(onSetArrow).toHaveBeenCalledWith("both");
  });

  it("fires onSetStyle for width, dash, and a colour reset", async () => {
    const { onSetStyle } = setup();
    // The segmented Width button carries aria-pressed; the "Thick" preset button doesn't — use the
    // pressed filter to target the Width control unambiguously.
    await userEvent.click(screen.getByRole("button", { name: "Thick", pressed: false }));
    expect(onSetStyle).toHaveBeenCalledWith({ width: 3 });
    await userEvent.click(screen.getByRole("button", { name: "Solid" }));
    expect(onSetStyle).toHaveBeenCalledWith({ dash: "solid" });
    await userEvent.click(screen.getByRole("button", { name: "Default" }));
    expect(onSetStyle).toHaveBeenCalledWith({ color: "" });
  });

  it("applies a custom colour from the native picker", () => {
    const { onSetStyle } = setup();
    fireEvent.change(screen.getByLabelText("Custom relationship colour"), {
      target: { value: "#123456" },
    });
    expect(onSetStyle).toHaveBeenCalledWith({ color: "#123456" });
  });

  it("a style preset fires onSetStyle with a full one-click patch", async () => {
    const { onSetStyle } = setup();
    await userEvent.click(screen.getByTitle("Solid line with arrowheads at both ends"));
    expect(onSetStyle).toHaveBeenCalledWith(
      expect.objectContaining({ arrow: "both", dash: "solid" }),
    );
  });

  it("fires onDelete from the danger button", async () => {
    const { onDelete } = setup();
    await userEvent.click(screen.getByRole("button", { name: /Delete relationship/ }));
    expect(onDelete).toHaveBeenCalled();
  });

  it("sets the relationship type from the Type control", async () => {
    const { onSetStyle } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Causes" }));
    expect(onSetStyle).toHaveBeenCalledWith({ type: "causes" });
  });

  it("toggles on-canvas type labels", async () => {
    const { onToggleShowTypes } = setup();
    await userEvent.click(screen.getByLabelText(/Show type labels/));
    expect(onToggleShowTypes).toHaveBeenCalledWith(true);
  });
});
