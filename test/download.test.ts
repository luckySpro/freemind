import { isTauri } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadBlob, downloadBlobAwaited } from "../src/io/download";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: vi.fn(() => false) }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ save: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", () => ({ writeFile: vi.fn() }));

// The shared blob-download primitive (used by the export handlers, the map-card download, and the
// save-picker fallback). jsdom implements neither object-URL method nor a real anchor download, so stub.

describe("downloadBlob", () => {
  afterEach(() => {
    vi.mocked(isTauri).mockReturnValue(false);
    vi.clearAllMocks();
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
  it("awaits backup file persistence and propagates disk errors before an updater can restart", async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(save).mockResolvedValue("/tmp/library.json");
    let finish = () => {};
    vi.mocked(writeFile).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const bytes = new Uint8Array([1, 2, 3]);
    const blob = { arrayBuffer: async () => bytes.buffer } as Blob;
    let saved = false;
    const pending = downloadBlobAwaited(blob, "library.json").then(() => {
      saved = true;
    });
    await vi.waitFor(() => expect(writeFile).toHaveBeenCalledWith("/tmp/library.json", bytes));
    expect(saved).toBe(false);
    finish();
    await pending;
    expect(saved).toBe(true);
    vi.mocked(writeFile).mockRejectedValue(new Error("disk full"));
    await expect(downloadBlobAwaited(blob, "library.json")).rejects.toThrow("disk full");
  });
});
