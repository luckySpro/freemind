// @vitest-environment jsdom
//
// DialogHost renders the editor's themed prompt/confirm (editorPrompt / editorConfirm), the drop-in
// replacement for the native window.prompt/confirm on the canvas + panels. The helpers are imperative
// and promise-based, so each test awaits the resolved value after driving the dialog.
//
// The request is fired INSIDE act() on purpose — don't unwrap it. editorPrompt/editorConfirm reach a
// module singleton to setState from outside React's event system, so with no act boundary the render
// AND the <Dialog> mount effect that calls showModal() land in later, unawaited scheduler tasks. Until
// showModal() sets [open], the UA stylesheet holds the whole <dialog> at display:none, so *byRole —
// which filters inaccessible nodes — cannot see the buttons even though they are in the DOM (and get
// printed in the failure dump, giving a baffling "can't find the button that's right there"). That is
// a real flake: it hit `resolves true on confirm` under a full-suite coverage run, and reproduces on
// demand under CPU load, because findBy*'s 1s waitFor budget is wall-clock and independent of the
// config's testTimeout. act() flushes the render and the effect, so the controls below are queried
// synchronously with getBy* — nothing polls and there is no timeout to race.
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { DialogHost, editorConfirm, editorPrompt } from "../src/components/editorDialogs";

afterEach(cleanup);

describe("editor dialogs", () => {
  it("opens the native dialog, so role queries can see its controls", async () => {
    render(<DialogHost />);
    let result!: Promise<boolean>;
    await act(async () => {
      result = editorConfirm({ title: "Delete this relationship?" });
    });
    // Guards the header's display:none trap directly: assert the dialog is OPEN rather than let a
    // regression here surface as an unrelated-looking "button not found" in every test in this file.
    const dialog = document.querySelector("dialog");
    expect(dialog?.open).toBe(true);
    expect(screen.getByRole("dialog")).toBe(dialog);
    await act(async () => {
      screen.getByRole("button", { name: "Cancel" }).click();
    });
    expect(await result).toBe(false);
  });

  it("editorConfirm resolves true on confirm", async () => {
    const u = userEvent.setup();
    render(<DialogHost />);
    let result!: Promise<boolean>;
    await act(async () => {
      result = editorConfirm({ title: "Delete this relationship?", confirmText: "Delete" });
    });
    await u.click(screen.getByRole("button", { name: "Delete" }));
    expect(await result).toBe(true);
  });

  it("editorConfirm resolves false on cancel", async () => {
    const u = userEvent.setup();
    render(<DialogHost />);
    let result!: Promise<boolean>;
    await act(async () => {
      result = editorConfirm({ title: "Delete this relationship?" });
    });
    await u.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await result).toBe(false);
  });

  it("editorPrompt resolves the entered text, seeded with the default value", async () => {
    const u = userEvent.setup();
    render(<DialogHost />);
    let result!: Promise<string | null>;
    await act(async () => {
      result = editorPrompt({ title: "Summary label", defaultValue: "Risks" });
    });
    const input = screen.getByLabelText("Summary label") as HTMLInputElement;
    expect(input.value).toBe("Risks"); // seeded from defaultValue
    await u.clear(input);
    await u.type(input, "Opportunities");
    await u.click(screen.getByRole("button", { name: "OK" }));
    expect(await result).toBe("Opportunities");
  });

  it("editorPrompt resolves null on cancel", async () => {
    const u = userEvent.setup();
    render(<DialogHost />);
    let result!: Promise<string | null>;
    await act(async () => {
      result = editorPrompt({ title: "Name this view" });
    });
    screen.getByLabelText("Name this view");
    await u.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await result).toBeNull();
  });
});
