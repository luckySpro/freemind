import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import type { MindMapDoc } from "../src/model/types";
import {
  MAX_VERSIONS,
  deleteMap,
  deleteVersionsForMap,
  latestVersionDoc,
  listVersions,
  loadAllVersions,
  loadVersion,
  saveVersion,
} from "../src/store/mapStore";

const docOf = (id: string, title: string): MindMapDoc => ({
  schemaVersion: 1,
  id,
  title,
  root: { id: "r", topic: title, children: [{ id: "c", topic: "child", children: [] }] },
});

describe("version store", () => {
  it("saves snapshots and lists them newest-first with metadata", async () => {
    await saveVersion(docOf("v1", "First"), 1000);
    await saveVersion(docOf("v1", "Second"), 2000);
    const list = await listVersions("v1");
    expect(list.map((v) => v.ts)).toEqual([2000, 1000]); // newest first
    expect(list[0]).toMatchObject({ title: "Second", nodeCount: 2 }); // root + 1 child
  });

  it("loads a snapshot's full doc by id, and reports the latest", async () => {
    await saveVersion(docOf("v2", "Old"), 1000);
    await saveVersion(docOf("v2", "New"), 2000);
    const id = (await listVersions("v2"))[0].id;
    expect((await loadVersion(id))?.title).toBe("New");
    expect((await latestVersionDoc("v2"))?.title).toBe("New");
    expect(await loadVersion("v2:9999")).toBeNull();
  });

  it(`prunes to the newest ${MAX_VERSIONS} snapshots`, async () => {
    for (let i = 0; i < MAX_VERSIONS + 5; i++) await saveVersion(docOf("v3", `r${i}`), 1000 + i);
    const list = await listVersions("v3");
    expect(list.length).toBe(MAX_VERSIONS);
    expect(list[0].ts).toBe(1000 + MAX_VERSIONS + 4); // newest kept
    expect(list.at(-1)?.ts).toBe(1005); // the 5 oldest were dropped
  });

  it("normalizes a malformed snapshot on load (restore/playback can't white-screen)", async () => {
    // A snapshot predating a normalize rule: a child node missing its children array. saveVersion
    // must not throw computing nodeCount, and the load boundary must repair it.
    const malformed = {
      schemaVersion: 1,
      id: "v6",
      title: "Legacy",
      root: { id: "r", topic: "Legacy", children: [{ id: "c", topic: "child" }] },
    } as unknown as MindMapDoc;
    await saveVersion(malformed, 1000);
    expect((await listVersions("v6"))[0].nodeCount).toBe(2); // counted despite missing children

    const id = (await listVersions("v6"))[0].id;
    const loaded = await loadVersion(id);
    expect(loaded?.root.children[0].children).toEqual([]); // repaired to a projectable shape
    const [snap] = await loadAllVersions("v6");
    expect(snap.doc.root.children[0].children).toEqual([]); // playback path repaired too
  });

  it("deletes a map's history, and deleting the map cascades", async () => {
    await saveVersion(docOf("v4", "A"), 1000);
    await deleteVersionsForMap("v4");
    expect(await listVersions("v4")).toEqual([]);

    await saveVersion(docOf("v5", "B"), 1000);
    await deleteMap("v5");
    expect(await listVersions("v5")).toEqual([]);
  });
});
