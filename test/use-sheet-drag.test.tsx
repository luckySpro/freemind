// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { snapOrDismiss, useSheetDrag } from "../src/hooks/useSheetDrag";

// The mobile bottom-sheet drag: snap-to-detent + drag-down-to-dismiss. The release decision is pure
// (snapOrDismiss); the hook wires a pointer/keyboard drag to a live dvh height. Feel verifies on-device.

describe("snapOrDismiss", () => {
  it("snaps to the nearest detent (62 / 90)", () => {
    expect(snapOrDismiss(62)).toEqual({ vh: 62, dismiss: false });
    expect(snapOrDismiss(90)).toEqual({ vh: 90, dismiss: false });
    expect(snapOrDismiss(70)).toEqual({ vh: 62, dismiss: false }); // 70 closer to 62
    expect(snapOrDismiss(80)).toEqual({ vh: 90, dismiss: false }); // 80 closer to 90
  });
  it("dismisses when dragged at/below the threshold", () => {
    expect(snapOrDismiss(42)).toEqual({ vh: 62, dismiss: true });
    expect(snapOrDismiss(30)).toEqual({ vh: 62, dismiss: true });
  });
});

function Harness({ onDismiss }: { onDismiss: () => void }) {
  // 1000px viewport → 1dvh = 10px, so drag math is exact in the test.
  const drag = useSheetDrag(onDismiss, () => 1000);
  return (
    <div>
      <button type="button" data-testid="handle" {...drag.handleProps} />
      <output data-testid="h">{drag.heightVh ?? "default"}</output>
      <output data-testid="dragging">{String(drag.dragging)}</output>
    </div>
  );
}

const h = () => screen.getByTestId("h").textContent;

describe("useSheetDrag", () => {
  it("grows on an upward drag and snaps to the tall detent on release", () => {
    render(<Harness onDismiss={vi.fn()} />);
    const handle = screen.getByTestId("handle");
    fireEvent.pointerDown(handle, { clientY: 500 });
    expect(screen.getByTestId("dragging").textContent).toBe("true");
    fireEvent.pointerMove(window, { clientY: 200 }); // +300px ≈ +30dvh → 92 (clamped)
    expect(h()).toBe("92");
    fireEvent.pointerUp(window);
    expect(h()).toBe("90"); // snapped to the nearest detent
    expect(screen.getByTestId("dragging").textContent).toBe("false");
  });

  it("dismisses when dragged down past the threshold", () => {
    const onDismiss = vi.fn();
    render(<Harness onDismiss={onDismiss} />);
    const handle = screen.getByTestId("handle");
    fireEvent.pointerDown(handle, { clientY: 500 });
    fireEvent.pointerMove(window, { clientY: 900 }); // -400px → 62-40=22 → clamp 30
    expect(h()).toBe("30");
    fireEvent.pointerUp(window);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(h()).toBe("default"); // height reset
  });

  it("resizes with the arrow keys and closes on Escape", () => {
    const onDismiss = vi.fn();
    render(<Harness onDismiss={onDismiss} />);
    const handle = screen.getByTestId("handle");
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    expect(h()).toBe("70"); // 62 + 8
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    expect(h()).toBe("62");
    fireEvent.keyDown(handle, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
