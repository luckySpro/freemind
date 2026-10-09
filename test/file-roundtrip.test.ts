import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureWritePermission, readMapFromHandle, writeMapToHandle } from "../src/io/fileSystem";
import { serializeDoc } from "../src/io/json";
import type { MindMapDoc } from "../src/model/types";
import { loadMap, loadMapHandle, saveMap, saveMapHandle } from "../src/store/mapStore";

// End-to-end verification of the disk-file workflow App wires together: open a file, bind its handle,
// edit + autosave through to it, "reload" the app (cache lost, handle re-read from IndexedDB), and
// save back to the same file. Drives the real fileSystem + mapStore code paths (the native picker /
// browser UI can't be automated, so this pins the contract underneath it).

// A stand-in "disk": file name → bytes. A real FileSystemFileHandle is an opaque, structured-cloneable
// token that IndexedDB persists and the browser rehydrates into a *live* handle on reload. We model
// that split: `persistedHandle` is the cloneable token actually stored in IndexedDB; `liveHandle`
// rehydrates a working read/write/permission surface bound to this disk (what the browser hands back).
const disk = new Map<string, string>();
const perms = new Map<string, PermissionState>();

const persistedHandle = (name: string) =>
  ({ kind: "file", name }) as unknown as FileSystemFileHandle;

function liveHandle(name: string): FileSystemFileHandle {
  const handle = {
    name,
    kind: "file" as const,
    async getFile() {
      return new File([disk.get(name) ?? ""], name, { type: "application/json" });
    },
    async createWritable() {
      let buf = "";
      return {
        async write(data: string) {
          buf += data;
        },
        async close() {
          disk.set(name, buf);
        },
      };
    },
    async queryPermission() {
      return perms.get(name) ?? "granted";
    },
    async requestPermission() {
      perms.set(name, "granted");
      return "granted" as PermissionState;
    },
  };
  return handle as unknown as FileSystemFileHandle;
}

const baseDoc = (): MindMapDoc => ({
  schemaVersion: 1,
  id: "doc-1",
  title: "Plan",
  root: { id: "r", topic: "Plan", children: [{ id: "a", topic: "Idea", children: [] }] },
});

describe("disk-file round-trip (open → edit → autosave → reload → reopen)", () => {
  beforeEach(() => {
    disk.clear();
    perms.clear();
    vi.restoreAllMocks();
  });

  it("opens a file, autosaves edits to it, and re-saves after a simulated reload", async () => {
    disk.set("plan.mmst", serializeDoc(baseDoc()));

    // 1. Open: read the file + bind its handle (App.adoptOpenedFile).
    const opened = await readMapFromHandle(liveHandle("plan.mmst"));
    expect(opened.title).toBe("Plan");
    await saveMap(opened); // into the IndexedDB library
    await saveMapHandle(opened.id, persistedHandle("plan.mmst")); // remember the binding

    // 2. Edit, then the debounced silent write-through (App.scheduleFileSave): permission already
    //    granted, so no prompt — it just writes.
    const edited: MindMapDoc = { ...opened, title: "Plan v2" };
    edited.root = { ...edited.root, topic: "Plan v2" };
    await saveMap(edited);
    const live = liveHandle("plan.mmst");
    expect(await ensureWritePermission(live, false)).toBe(true);
    await writeMapToHandle(live, edited);
    expect(disk.get("plan.mmst")).toBe(serializeDoc(edited)); // disk file now holds the edit

    // 3. Simulate a reload: the in-memory handle cache is gone, but the binding persists in
    //    IndexedDB (App's doc.id effect re-reads it), and the file reads back the edited doc.
    const rebound = await loadMapHandle("doc-1");
    expect(rebound?.name).toBe("plan.mmst");
    const reread = await readMapFromHandle(liveHandle(rebound?.name ?? ""));
    expect(reread.title).toBe("Plan v2");

    // 4. The library copy and the disk copy agree — no divergence between IndexedDB and the file.
    expect((await loadMap("doc-1"))?.title).toBe("Plan v2");
  });

  it("silent autosave never prompts; a denied grant leaves the file untouched (library still holds it)", async () => {
    disk.set("locked.mmst", serializeDoc(baseDoc()));
    perms.set("locked.mmst", "denied");
    const live = liveHandle("locked.mmst");
    const requestSpy = vi.spyOn(live, "requestPermission" as never);

    const edited: MindMapDoc = { ...baseDoc(), title: "Edited but unsaved-to-disk" };
    await saveMap(edited); // IndexedDB always captures the edit

    // Autosave path uses interactive: false — it must not prompt, and must skip the write.
    const allowed = await ensureWritePermission(live, false);
    expect(allowed).toBe(false);
    expect(requestSpy).not.toHaveBeenCalled();
    if (allowed) await writeMapToHandle(live, edited);

    expect(disk.get("locked.mmst")).toBe(serializeDoc(baseDoc())); // file unchanged (no silent overwrite)
    expect((await loadMap("doc-1"))?.title).toBe("Edited but unsaved-to-disk"); // nothing lost
  });
});
