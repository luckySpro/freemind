import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IconRail } from "../src/components/IconRail";

// IconRail — the 56px left rail. Every button is wired to a real handler (no decorative no-ops), so
// the test asserts each affordance fires its callback, and that the image control is a real picker.

function setup(over: Partial<Parameters<typeof IconRail>[0]> = {}) {
  const props = {
    onHome: vi.fn(),
    onImage: vi.fn(),
    onPaste: vi.fn(),
    onShortcuts: vi.fn(),
    onSettings: vi.fn(),
    onGettingStarted: vi.fn(),
    onCommandPalette: vi.fn(),
    ...over,
  };
  render(<IconRail {...props} />);
  return props;
}

describe("IconRail", () => {
  it("fires onHome from the brand mark", async () => {
    const p = setup();
    await userEvent.click(screen.getByRole("button", { name: /back to start/i }));
    expect(p.onHome).toHaveBeenCalledTimes(1);
  });

  it("fires onPaste and onShortcuts from their buttons", async () => {
    const p = setup();
    await userEvent.click(screen.getByRole("button", { name: /paste text/i }));
    await userEvent.click(screen.getByRole("button", { name: /keyboard shortcuts/i }));
    expect(p.onPaste).toHaveBeenCalledTimes(1);
    expect(p.onShortcuts).toHaveBeenCalledTimes(1);
  });

  it("fires onSettings from the settings button", async () => {
    const p = setup();
    await userEvent.click(screen.getByRole("button", { name: /^settings$/i }));
    expect(p.onSettings).toHaveBeenCalledTimes(1);
  });

  it("fires onGettingStarted from the tips button (O8)", async () => {
    const p = setup();
    await userEvent.click(screen.getByRole("button", { name: /getting started/i }));
    expect(p.onGettingStarted).toHaveBeenCalledTimes(1);
  });

  it("fires onCommandPalette from the visible ⌘K trigger (item 19)", async () => {
    const p = setup();
    await userEvent.click(screen.getByRole("button", { name: /command palette/i }));
    expect(p.onCommandPalette).toHaveBeenCalledTimes(1);
  });

  it("exposes an image file picker wired to onImage", async () => {
    const p = setup();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.accept).toBe("image/*");
    const file = new File(["x"], "pic.png", { type: "image/png" });
    await userEvent.upload(input, file);
    expect(p.onImage).toHaveBeenCalledTimes(1);
  });

  it("the image picker is a real button (keyboard-operable) that opens the hidden file input", () => {
    setup();
    // A real <button>, not a <label> wrapping a hidden input — so it's natively keyboard-operable
    // (Enter/Space) like every other rail action (a11y SC 2.1.1).
    const btn = screen.getByRole("button", { name: /insert image/i });
    expect(btn.tagName).toBe("BUTTON");
    const input = btn.nextElementSibling as HTMLInputElement;
    expect(input.type).toBe("file");
    const click = vi.spyOn(input, "click").mockImplementation(() => {});
    fireEvent.click(btn);
    expect(click).toHaveBeenCalledTimes(1);
  });
});
