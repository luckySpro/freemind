import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FirstRunCard } from "../src/components/FirstRunCard";

describe("FirstRunCard (#13)", () => {
  it("renders the three tips and dismisses on the close button", () => {
    const onDismiss = vi.fn();
    render(<FirstRunCard onDismiss={onDismiss} />);
    expect(screen.getByText("3 things to try")).toBeTruthy();
    expect(screen.getByText(/rename it/i)).toBeTruthy();
    expect(screen.getByText(/to add a child/i)).toBeTruthy();
    expect(screen.getByText(/for anything/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("shows touch gestures (not keyboard keys) on a coarse pointer", () => {
    vi.stubGlobal(
      "matchMedia",
      vi
        .fn()
        .mockReturnValue({ matches: true }), // (pointer: coarse) → true
    );
    render(<FirstRunCard onDismiss={vi.fn()} />);
    // Text is split by <strong>, so match the plain text-node parts.
    expect(screen.getByText(/a topic to select it/i)).toBeTruthy();
    expect(screen.getByText(/pinch to zoom/i)).toBeTruthy(); // touch-only tip
    expect(screen.queryByText(/for anything/i)).toBeNull(); // no Ctrl/⌘+K tip on touch
    vi.unstubAllGlobals();
  });
});
