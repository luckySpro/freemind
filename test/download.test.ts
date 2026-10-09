// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadBlob } from "../src/io/download";

// The shared blob-download primitive (used by the export handlers, the map-card download, and the
// save-picker fallback). jsdom implements neither object-URL method nor a real anchor download, so stub.

describe("downloadBlob", () => {
  afterEach(() => {
    // biome-ignore lint/performance/noDelete: remove the test-only global so other files stay clean
    delete (URL as { createObjectURL?: unknown }).createObjectURL;
    // biome-ignore lint/performance/noDelete: remove the test-only global so other files stay clean
    delete (URL as { revokeObjectURL?: unknown }).revokeObjectURL;
  });

  it("opens an object URL, clicks a download anchor carrying the filename, then revokes the URL", () => {
    const createUrl = vi.fn(() => "blob:fake");
    const revokeUrl = vi.fn();
    URL.createObjectURL = createUrl as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeUrl as unknown as typeof URL.revokeObjectURL;
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockReturnValue();
    try {
      const blob = new Blob(["hi"], { type: "text/plain" });
      downloadBlob(blob, "note.txt");
      expect(createUrl).toHaveBeenCalledWith(blob);
      const a = click.mock.instances[0] as unknown as HTMLAnchorElement;
      expect(a.getAttribute("href")).toBe("blob:fake");
      expect(a.download).toBe("note.txt");
      expect(click).toHaveBeenCalledOnce();
      expect(revokeUrl).toHaveBeenCalledWith("blob:fake");
    } finally {
      click.mockRestore();
    }
  });
});
