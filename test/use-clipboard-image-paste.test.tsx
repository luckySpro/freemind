import { act, renderHook } from "@testing-library/react";
import type { RefObject } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const image = vi.hoisted(() => ({ fileToMapImage: vi.fn() }));
vi.mock("../src/io/image", () => image);

import { useClipboardImagePaste } from "../src/hooks/useClipboardImagePaste";
import type { MindMapHandle } from "../src/mindmap";

// Clipboard image paste onto the selected topic — guarded by focus + the enabled flag, routed through
// the (mocked) node-image pipeline.

const flush = () => act(() => new Promise((r) => setTimeout(r, 0)));

/** Dispatch a window 'paste' carrying one image item (jsdom's ClipboardEvent has no items, so attach). */
function pasteImage() {
  const file = new File(["x"], "p.png", { type: "image/png" });
  const e = new Event("paste") as Event & { clipboardData: unknown };
  e.clipboardData = { items: [{ type: "image/png", getAsFile: () => file }], getData: () => "" };
  act(() => {
    window.dispatchEvent(e);
  });
}

/** Dispatch a window 'paste' carrying plain text (no image item). */
function pasteText(text: string) {
  const e = new Event("paste") as Event & { clipboardData: unknown };
  e.clipboardData = { items: [], getData: (t: string) => (t === "text/plain" ? text : "") };
  act(() => {
    window.dispatchEvent(e);
  });
}

function setup(enabled: boolean, handle: Partial<MindMapHandle> = {}) {
  const showHint = vi.fn();
  const mapRef = { current: handle as MindMapHandle } as RefObject<MindMapHandle | null>;
  renderHook(() => useClipboardImagePaste(enabled, mapRef, showHint));
  return { showHint };
}

beforeEach(() => {
  image.fileToMapImage.mockReset().mockResolvedValue({ url: "data:image/png;base64,AA==" });
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  document.body.innerHTML = "";
});
afterEach(() => vi.restoreAllMocks());

describe("useClipboardImagePaste", () => {
  it("pastes a clipboard image onto the selected topic", async () => {
    const setSelectedImage = vi.fn(() => true);
    const { showHint } = setup(true, { setSelectedImage });
    pasteImage();
    await flush();
    expect(image.fileToMapImage).toHaveBeenCalledOnce();
    expect(setSelectedImage).toHaveBeenCalledWith({ url: "data:image/png;base64,AA==" });
    expect(showHint).toHaveBeenCalledWith("Image pasted onto the selected topic.");
  });

  it("hints to select a topic first when nothing is selected", async () => {
    const { showHint } = setup(true, { setSelectedImage: () => false });
    pasteImage();
    await flush();
    expect(showHint).toHaveBeenCalledWith("Select a topic first, then paste an image.");
  });

  it("does nothing while focus is in a text field", async () => {
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    const setSelectedImage = vi.fn(() => true);
    setup(true, { setSelectedImage });
    pasteImage();
    await flush();
    expect(image.fileToMapImage).not.toHaveBeenCalled();
    expect(setSelectedImage).not.toHaveBeenCalled();
  });

  it("attaches no listener when disabled", async () => {
    const setSelectedImage = vi.fn(() => true);
    setup(false, { setSelectedImage });
    pasteImage();
    await flush();
    expect(image.fileToMapImage).not.toHaveBeenCalled();
  });

  it("routes pasted text into topics under the selection (no dialog) — item 13", async () => {
    const addSubtreeToSelected = vi.fn((_nodes: unknown) => true);
    const { showHint } = setup(true, { addSubtreeToSelected });
    pasteText("Parent\n\tChild A\n\tChild B");
    await flush();
    // parsePaste turns the outline into a forest; the hook grafts it under the selection.
    expect(addSubtreeToSelected).toHaveBeenCalledOnce();
    const forest = addSubtreeToSelected.mock.calls[0][0] as unknown as { topic: string }[];
    expect(forest[0].topic).toBe("Parent");
    expect(showHint).toHaveBeenCalledWith("Pasted 3 topics under the selection.");
  });

  it("turns a single pasted URL into one linked topic", async () => {
    const addSubtreeToSelected = vi.fn((_nodes: unknown) => true);
    setup(true, { addSubtreeToSelected });
    pasteText("https://example.com/blog/my-great-post");
    await flush();
    const forest = addSubtreeToSelected.mock.calls[0][0] as unknown as {
      topic: string;
      hyperlink?: string;
    }[];
    expect(forest).toHaveLength(1);
    expect(forest[0].hyperlink).toBe("https://example.com/blog/my-great-post");
  });

  it("hints to select a topic first when text paste has no selection", async () => {
    const { showHint } = setup(true, { addSubtreeToSelected: (_nodes: unknown) => false });
    pasteText("Some topic");
    await flush();
    expect(showHint).toHaveBeenCalledWith(
      "Select a topic first to paste text under it (or use Paste text → map).",
    );
  });

  it("ignores empty/whitespace text (nothing pasted)", async () => {
    const addSubtreeToSelected = vi.fn((_nodes: unknown) => true);
    setup(true, { addSubtreeToSelected });
    pasteText("   \n  ");
    await flush();
    expect(addSubtreeToSelected).not.toHaveBeenCalled();
  });
});
