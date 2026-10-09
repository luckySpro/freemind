import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CaptureCard } from "../src/components/start/CaptureCard";
import { Examples } from "../src/components/start/sections/Examples";
import { ImportView } from "../src/components/start/sections/ImportView";
import { Layouts } from "../src/components/start/sections/Layouts";
import type { StartContext } from "../src/components/start/types";

// Start-screen sections — leaf views driven by a StartContext / explicit callbacks. Tests assert each
// affordance lands its callback (open a doc, import files) without needing the store.

const mkCtx = (over: Partial<StartContext> = {}): StartContext => ({
  onOpen: vi.fn(),
  onImportFiles: vi.fn(),
  go: vi.fn(),
  libraryRev: 0,
  onLibraryChange: vi.fn(),
  ...over,
});

const u = userEvent.setup();

describe("CaptureCard", () => {
  it("grows a map from a typed topic (button + Enter + example pill)", async () => {
    const onTopic = vi.fn();
    render(<CaptureCard onTopic={onTopic} onPaste={vi.fn()} onBlank={vi.fn()} />);
    const input = screen.getByPlaceholderText(/launch plan/i);
    // disabled until there's text
    expect(screen.getByRole("button", { name: /grow the map/i })).toHaveProperty("disabled", true);
    await u.type(input, "My idea");
    await u.click(screen.getByRole("button", { name: /grow the map/i }));
    expect(onTopic).toHaveBeenCalledWith("My idea");
    await u.clear(input);
    await u.type(input, "Again{Enter}");
    expect(onTopic).toHaveBeenCalledWith("Again");
    await u.click(screen.getByRole("button", { name: /plan a product launch/i }));
    expect(onTopic).toHaveBeenCalledWith("Plan a product launch");
  });

  it("turns a pasted outline into a map", async () => {
    const onPaste = vi.fn();
    render(<CaptureCard onTopic={vi.fn()} onPaste={onPaste} onBlank={vi.fn()} />);
    await u.click(screen.getByRole("tab", { name: /paste an outline/i }));
    await u.type(screen.getByRole("textbox"), "# A\n  B");
    await u.click(screen.getByRole("button", { name: /turn into a map/i }));
    expect(onPaste).toHaveBeenCalledWith("# A\n  B");
  });

  it("opens a blank canvas with or without a starting layout", async () => {
    const onBlank = vi.fn();
    render(<CaptureCard onTopic={vi.fn()} onPaste={vi.fn()} onBlank={onBlank} />);
    await u.click(screen.getByRole("tab", { name: /blank canvas/i }));
    await u.click(screen.getByRole("button", { name: /radial/i }));
    expect(onBlank).toHaveBeenCalledWith("radial");
    await u.click(screen.getByRole("button", { name: /open canvas/i }));
    expect(onBlank).toHaveBeenCalledWith();
  });
});

describe("Examples section", () => {
  it("lists the worked examples (the same set as the editor's New menu) and opens one", async () => {
    const ctx = mkCtx();
    render(<Examples ctx={ctx} />);
    expect(screen.getByRole("button", { name: /Product launch plan/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Quarterly OKRs/i })).toBeTruthy();
    await u.click(screen.getByRole("button", { name: /Product launch plan/i }));
    expect(ctx.onOpen).toHaveBeenCalledTimes(1);
    const [doc] = (ctx.onOpen as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(doc.meta?.source).toBe("example"); // a built example map, not an empty template
  });

  it("filters examples by a search query", async () => {
    const ctx = mkCtx();
    render(<Examples ctx={ctx} />);
    await u.type(screen.getByPlaceholderText(/search examples/i), "okr");
    expect(screen.getByRole("button", { name: /Quarterly OKRs/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Product launch plan/i })).toBeNull();
  });
});

describe("Layouts section", () => {
  it("opens a blank map in the chosen layout", async () => {
    const ctx = mkCtx();
    render(<Layouts ctx={ctx} />);
    await u.click(screen.getByRole("button", { name: /radial \/ hub/i }));
    expect(ctx.onOpen).toHaveBeenCalledWith(
      expect.objectContaining({ root: expect.anything() }),
      "radial",
    );
  });

  it("opens a backdrop map", async () => {
    const ctx = mkCtx();
    render(<Layouts ctx={ctx} />);
    await u.click(screen.getByRole("button", { name: /onion/i }));
    expect(ctx.onOpen).toHaveBeenCalledTimes(1);
    const [doc] = (ctx.onOpen as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(doc.backdrop).toEqual({ kind: "onion" });
  });
});

describe("ImportView section", () => {
  it("lists the supported formats", () => {
    render(<ImportView ctx={mkCtx()} />);
    expect(screen.getByText(".mmap")).toBeTruthy();
    expect(screen.getByText("MindManager")).toBeTruthy();
    expect(screen.getByText("Mermaid")).toBeTruthy();
  });

  it("keeps the drop highlight while dragging over its own children (no flicker)", () => {
    render(<ImportView ctx={mkCtx()} />);
    const zone = screen.getByRole("button", { name: /drop a file here/i });
    // Enter the zone, then enter a child (depth 2): still highlighted.
    fireEvent.dragEnter(zone);
    expect(zone.style.borderColor).toBe("var(--st-accent)"); // highlighted
    fireEvent.dragEnter(zone); // crossing onto an inner child fires a second enter
    // Leaving the child (depth back to 1) must NOT clear the highlight — this is the anti-flicker.
    fireEvent.dragLeave(zone);
    expect(zone.style.borderColor).toBe("var(--st-accent)");
    // Leaving the zone entirely (depth 0) clears it.
    fireEvent.dragLeave(zone);
    expect(zone.style.borderColor).toBe("");
  });

  it("hands dropped files to the import pipeline", () => {
    const ctx = mkCtx();
    render(<ImportView ctx={ctx} />);
    const zone = screen.getByRole("button", { name: /drop a file here/i });
    const file = new File(["x"], "map.mm", { type: "text/xml" });
    fireEvent.drop(zone, { dataTransfer: { files: [file], types: ["Files"] } });
    expect(ctx.onImportFiles).toHaveBeenCalledTimes(1);
    expect((ctx.onImportFiles as ReturnType<typeof vi.fn>).mock.calls[0][0]).toHaveLength(1);
  });
});
