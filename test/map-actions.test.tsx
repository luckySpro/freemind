// @vitest-environment jsdom
//
// mapActions.handleMapAction is the MapCard kebab logic (Open / Rename / Duplicate / Export /
// Delete), wired to the store and shared by Home / All maps / Recent. It's pure action code (no
// JSX) yet was sitting at 0% — this covers each branch end-to-end against a real fake-indexeddb
// store, plus the cancel/guard paths (unknown id, cancelled prompt/confirm) that are easy to break.
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MapEntry } from "../src/components/start/MapCard";
import { handleMapAction, renameMapTitle } from "../src/components/start/mapActions";
import type { StartContext } from "../src/components/start/types";
import type { MindMapDoc } from "../src/model/types";
import { getAllMaps, loadMap, saveMap } from "../src/store/mapStore";

const docOf = (id: string, title: string): MindMapDoc => ({
  schemaVersion: 1,
  id,
  title,
  root: { id: "r", topic: title, children: [{ id: "c", topic: "child", children: [] }] },
});

const entryOf = (id: string, title: string): MapEntry => ({ id, title, nodeCount: 2 });

let ctx: StartContext;

beforeEach(() => {
  ctx = {
    onOpen: vi.fn(),
    onImportFiles: vi.fn(),
    go: vi.fn(),
    libraryRev: 0,
    onLibraryChange: vi.fn(),
    requestRename: vi.fn(),
    requestDelete: vi.fn(),
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("handleMapAction", () => {
  it("returns early (no callbacks) when the map id is unknown", async () => {
    await handleMapAction("open", entryOf("missing", "Gone"), ctx);
    expect(ctx.onOpen).not.toHaveBeenCalled();
    expect(ctx.onLibraryChange).not.toHaveBeenCalled();
  });

  it("open hands the loaded doc to onOpen", async () => {
    await saveMap(docOf("m-open", "Openable"));
    await handleMapAction("open", entryOf("m-open", "Openable"), ctx);
    expect(ctx.onOpen).toHaveBeenCalledTimes(1);
    expect((ctx.onOpen as ReturnType<typeof vi.fn>).mock.calls[0][0].id).toBe("m-open");
  });

  describe("rename", () => {
    it("requests the themed rename dialog with the map's current title (no native prompt)", async () => {
      const prompt = vi.spyOn(window, "prompt");
      await saveMap(docOf("m-ren", "Old"));
      await handleMapAction("rename", entryOf("m-ren", "Old"), ctx);
      expect(ctx.requestRename).toHaveBeenCalledWith("m-ren", "Old");
      expect(prompt).not.toHaveBeenCalled(); // no raw browser prompt
      expect(ctx.onLibraryChange).not.toHaveBeenCalled(); // the save happens on dialog confirm
    });
  });

  describe("renameMapTitle (the store op the dialog calls on confirm)", () => {
    it("persists the trimmed title to both doc.title and root.topic", async () => {
      await saveMap(docOf("m-ren2", "Old"));
      await renameMapTitle("m-ren2", "  New Name  ");
      const saved = await loadMap("m-ren2");
      expect(saved?.title).toBe("New Name");
      expect(saved?.root.topic).toBe("New Name");
    });

    it("is a no-op on a blank name or an unknown id", async () => {
      await saveMap(docOf("m-ren3", "Keep"));
      await renameMapTitle("m-ren3", "   ");
      expect((await loadMap("m-ren3"))?.title).toBe("Keep");
      await renameMapTitle("missing", "X"); // unknown id → no throw, no write
    });
  });

  describe("pin", () => {
    it("toggles meta.pinned and refreshes the library", async () => {
      await saveMap(docOf("m-pin", "Pinnable"));
      await handleMapAction("pin", entryOf("m-pin", "Pinnable"), ctx);
      expect((await loadMap("m-pin"))?.meta?.pinned).toBe(true);
      expect(ctx.onLibraryChange).toHaveBeenCalledTimes(1);
      // Toggling again unpins.
      await handleMapAction("pin", entryOf("m-pin", "Pinnable"), ctx);
      expect((await loadMap("m-pin"))?.meta?.pinned).toBe(false);
    });
  });

  describe("duplicate", () => {
    it("saves an independent copy with a fresh id and a (copy) title", async () => {
      await saveMap(docOf("m-dup", "Original"));
      const before = (await getAllMaps()).length;
      await handleMapAction("duplicate", entryOf("m-dup", "Original"), ctx);
      const maps = await getAllMaps();
      expect(maps.length).toBe(before + 1);
      const copy = maps.find((m) => m.id !== "m-dup" && m.title === "Original (copy)");
      expect(copy).toBeTruthy();
      expect(copy?.id).not.toBe("m-dup");
      expect(copy?.root.topic).toBe("Original (copy)");
      expect(ctx.onLibraryChange).toHaveBeenCalledTimes(1);
    });

    it("deep-clones so editing the copy can't mutate the original", async () => {
      await saveMap(docOf("m-dup2", "Source"));
      await handleMapAction("duplicate", entryOf("m-dup2", "Source"), ctx);
      const copy = (await getAllMaps()).find((m) => m.title === "Source (copy)");
      expect(copy?.root).not.toBe((await loadMap("m-dup2"))?.root);
    });
  });

  describe("delete", () => {
    it("requests the themed confirm dialog and doesn't delete until it's confirmed", async () => {
      const confirm = vi.spyOn(window, "confirm");
      await saveMap(docOf("m-del", "Doomed"));
      await handleMapAction("delete", entryOf("m-del", "Doomed"), ctx);
      expect(ctx.requestDelete).toHaveBeenCalledWith("m-del", "Doomed");
      expect(confirm).not.toHaveBeenCalled(); // no raw browser confirm
      expect(await loadMap("m-del")).not.toBeNull(); // still there until the dialog confirms
      expect(ctx.onLibraryChange).not.toHaveBeenCalled();
    });
  });

  describe("export", () => {
    // The download filename now follows the same policy as a native .mmst save (io/fileName): keep
    // the title, replace only what the filesystem rejects. It used to run through an ASCII-only slug,
    // which lower-cased and kebab-cased Latin titles but silently destroyed every other script.
    it("downloads a .json file named after the doc", async () => {
      await saveMap(docOf("m-exp", "My Great Map!"));
      let name = "";
      let blob: Blob | undefined;
      URL.createObjectURL = vi.fn((b: Blob | MediaSource) => {
        blob = b as Blob;
        return "blob:mock";
      });
      URL.revokeObjectURL = vi.fn();
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        name = this.download;
      });
      await handleMapAction("export", entryOf("m-exp", "My Great Map!"), ctx);
      expect(name).toBe("My Great Map!.json");
      expect(blob?.type).toBe("application/json");
      const parsed = JSON.parse(await (blob as Blob).text());
      expect(parsed.id).toBe("m-exp");
    });

    it("keeps a non-ASCII title in the filename", async () => {
      // The regression this replaced: "Årsplan for Ø-teamet" downloaded as "rsplan-for-teamet.json",
      // and a Japanese or Arabic title lost every character and fell back to "map.json".
      await saveMap(docOf("m-exp2", "Årsplan for Ø-teamet"));
      let name = "";
      URL.createObjectURL = vi.fn(() => "blob:mock");
      URL.revokeObjectURL = vi.fn();
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        name = this.download;
      });
      await handleMapAction("export", entryOf("m-exp2", "Årsplan for Ø-teamet"), ctx);
      expect(name).toBe("Årsplan for Ø-teamet.json");
    });

    it("falls back to 'map.json' when the title is empty", async () => {
      await saveMap(docOf("m-exp3", "   "));
      let name = "";
      URL.createObjectURL = vi.fn(() => "blob:mock");
      URL.revokeObjectURL = vi.fn();
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        name = this.download;
      });
      await handleMapAction("export", entryOf("m-exp3", "   "), ctx);
      expect(name).toBe("map.json");
    });
  });
});
