import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type RefObject, createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BranchExportDialog } from "../src/components/BranchExportDialog";
import type { MindMapHandle } from "../src/mindmap";
import type { MindMapDoc } from "../src/model/types";

// The "Export this branch…" format picker (B4). Renders + a model-backed export fires the download and
// closes. The renderer-backed (SVG-from-live-canvas) path is exercised via the handle's exportSvg(rootId)
// in the app; here we cover the picker's own wiring with a stub handle.

const doc: MindMapDoc = {
  schemaVersion: 1,
  id: "d",
  title: "Doc",
  root: {
    id: "r",
    topic: "R",
    children: [{ id: "a", topic: "Alpha", children: [{ id: "a1", topic: "A1", children: [] }] }],
  },
};

let created: string[];
beforeEach(() => {
  created = [];
  // downloadBlob() creates an object URL + clicks an <a download>; stub the URL bits jsdom lacks.
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => {
      created.push("blob");
      return "blob:x";
    }),
    revokeObjectURL: vi.fn(),
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function setup(onClose = vi.fn()) {
  const mapRef = createRef<MindMapHandle | null>() as RefObject<MindMapHandle | null>;
  mapRef.current = { exportSvg: vi.fn(() => null) } as unknown as MindMapHandle;
  render(
    <BranchExportDialog
      nodeId="a"
      mapRef={mapRef}
      getDoc={() => doc}
      numbered={() => false}
      showHint={vi.fn()}
      onClose={onClose}
    />,
  );
  return { onClose };
}

describe("BranchExportDialog (B4)", () => {
  it("titles the dialog with the branch and lists every format", () => {
    setup();
    expect(screen.getByText(/Export branch: Alpha/)).toBeTruthy();
    for (const label of [
      "PNG image",
      "SVG vector",
      "HTML (standalone picture)",
      "HTML (interactive)",
      "PDF (print)",
      ".json (lossless)",
      "Markdown",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    }
  });

  it("fires a model-backed export (scoped) and closes", async () => {
    const user = userEvent.setup();
    const { onClose } = setup();
    await user.click(screen.getByRole("button", { name: ".json (lossless)" }));
    expect(created).toContain("blob"); // a file was produced
    expect(onClose).toHaveBeenCalled();
  });
});
