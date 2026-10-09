import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastBar } from "../src/components/ToastBar";
import { About } from "../src/components/start/sections/About";

// Regression cover for "on the Start screen, updating is not possible": the toast surface used to
// live only in the editor return, so the PWA "Refresh now" prompt (and every other toast) was
// silently swallowed on Start, and Start's About had no manual update trigger. These two tests pin
// (a) a toast renders independently of the editor, and (b) Start's About exposes a working trigger.

const u = userEvent.setup();

describe("ToastBar", () => {
  it("renders the message + action and fires run/onDismiss when clicked", async () => {
    const run = vi.fn();
    const onDismiss = vi.fn();
    render(
      <ToastBar
        toast={{
          kind: "info",
          message: "A new version is available.",
          action: { label: "Refresh now", run },
        }}
        onDismiss={onDismiss}
        variant="floating"
      />,
    );
    expect(screen.getByText("A new version is available.")).toBeTruthy();
    await u.click(screen.getByRole("button", { name: /refresh now/i }));
    expect(run).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when there is no toast", () => {
    const { container } = render(<ToastBar toast={null} onDismiss={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("Start About — update affordance", () => {
  it("exposes a Check for updates control that fires its callback", async () => {
    const onCheckForUpdates = vi.fn();
    render(<About onCheckForUpdates={onCheckForUpdates} />);
    await u.click(screen.getByRole("button", { name: /check for updates/i }));
    expect(onCheckForUpdates).toHaveBeenCalledTimes(1);
  });
});
