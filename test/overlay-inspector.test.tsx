// Component test for OverlayInspector — the right panel for a selected boundary / summary / callout.
// Asserts each control fires the right callback (label/text commit, delete) and the header reflects
// the kind + caption. Visible-text/role/label assertions.
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OverlayInspector } from "../src/components/OverlayInspector";
import type { SelectedOverlay } from "../src/mindmap";

const noop = () => {};

function setup(overlay: SelectedOverlay, caption = "3 topics") {
  const onSetLabel = vi.fn();
  const onSetColor = vi.fn();
  const onDelete = vi.fn();
  render(
    <OverlayInspector
      overlay={overlay}
      caption={caption}
      onSetLabel={onSetLabel}
      onSetColor={onSetColor}
      onDelete={onDelete}
      onMinimize={noop}
    />,
  );
  return { onSetLabel, onSetColor, onDelete };
}

describe("OverlayInspector", () => {
  it("shows the kind eyebrow + caption for a boundary", () => {
    setup({ kind: "boundary", id: "b", label: "Scope", deletable: true }, "2 topics");
    expect(screen.getByLabelText("Overlay info")).toBeTruthy();
    expect(screen.getByText("Boundary")).toBeTruthy();
    expect(screen.getByText("2 topics")).toBeTruthy();
    // Faint context line under the title, matching the node + edge inspectors (P5).
    expect(screen.getByText("Boundary around 2 topics")).toBeTruthy();
  });

  it("commits a boundary/summary label on Enter (trimmed)", async () => {
    const { onSetLabel } = setup({ kind: "summary", id: "s", label: "Phase 1", deletable: true });
    const input = screen.getByLabelText("Summary label");
    await userEvent.clear(input);
    await userEvent.type(input, "  Phase 2  {Enter}");
    expect(onSetLabel).toHaveBeenCalledWith("Phase 2");
  });

  it("uses a textarea for a callout and commits its text on blur", async () => {
    const { onSetLabel } = setup({
      kind: "callout",
      id: "c",
      nodeId: "n",
      label: "old",
      deletable: true,
    });
    const ta = screen.getByLabelText("Callout text");
    await userEvent.clear(ta);
    await userEvent.type(ta, "new note");
    await userEvent.tab();
    expect(onSetLabel).toHaveBeenCalledWith("new note");
  });

  it("fires onDelete from the danger button, and hides it when not deletable", async () => {
    const { onDelete } = setup({ kind: "boundary", id: "b", label: "Scope", deletable: true });
    await userEvent.click(screen.getByRole("button", { name: /Delete boundary/ }));
    expect(onDelete).toHaveBeenCalled();
  });

  it("hides Delete when the overlay is not deletable", () => {
    setup({ kind: "boundary", id: "b", label: "Scope", deletable: false });
    expect(screen.queryByRole("button", { name: /Delete/ })).toBeNull();
  });

  it("picks a swatch colour and resets to the default", async () => {
    const { onSetColor } = setup({ kind: "boundary", id: "b", label: "Scope", deletable: true });
    await userEvent.click(screen.getByRole("button", { name: "Colour #e0697f" }));
    expect(onSetColor).toHaveBeenCalledWith("#e0697f");
    await userEvent.click(screen.getByRole("button", { name: "Default" }));
    expect(onSetColor).toHaveBeenCalledWith("");
  });

  it("applies a custom colour from the native picker", () => {
    const { onSetColor } = setup({ kind: "boundary", id: "b", label: "Scope", deletable: true });
    fireEvent.change(screen.getByLabelText("Custom colour"), { target: { value: "#123456" } });
    expect(onSetColor).toHaveBeenCalledWith("#123456");
  });

  it("pre-selects the current swatch + presses Default when no colour is set", () => {
    const { rerender } = render(
      <OverlayInspector
        overlay={{ kind: "summary", id: "s", label: "Phase 1", deletable: true }}
        caption="3 topics"
        onSetLabel={noop}
        onSetColor={noop}
        onDelete={noop}
      />,
    );
    // No override → the Default chip is pressed; no swatch is pressed.
    const reset = () => screen.getByRole("button", { name: "Default" });
    const green = () => screen.getByRole("button", { name: "Colour #3f9e6e" });
    expect(reset().getAttribute("aria-pressed")).toBe("true");
    expect(green().getAttribute("aria-pressed")).toBe("false");
    rerender(
      <OverlayInspector
        overlay={{ kind: "summary", id: "s", label: "Phase 1", deletable: true, color: "#3f9e6e" }}
        caption="3 topics"
        onSetLabel={noop}
        onSetColor={noop}
        onDelete={noop}
      />,
    );
    expect(green().getAttribute("aria-pressed")).toBe("true");
    expect(reset().getAttribute("aria-pressed")).toBe("false");
  });
});
