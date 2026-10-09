import { describe, expect, it } from "vitest";
import {
  parseLibrary,
  parseLibraryFolders,
  serializeLibrary,
  tryParseLibrary,
} from "../src/io/library";
import type { MindMapDoc } from "../src/model/types";

const map = (id: string, title: string): MindMapDoc => ({
  schemaVersion: 1,
  id,
  title,
  root: { id: "root", topic: title, children: [] },
});

describe("library backup I/O", () => {
  it("round-trips all maps", () => {
    const docs = [map("a", "Alpha"), map("b", "Beta")];
    expect(parseLibrary(serializeLibrary(docs))).toEqual(docs);
  });

  it("rejects a single-map .json (not a library backup)", () => {
    const single = JSON.stringify(map("a", "Alpha"));
    expect(() => parseLibrary(single)).toThrow(/library backup/);
    expect(tryParseLibrary(single)).toBeNull();
  });

  it("rejects a backup that contains an invalid map", () => {
    const bad = JSON.stringify({
      schemaVersion: 1,
      kind: "mindmap-library",
      maps: [{ nope: true }],
    });
    expect(() => parseLibrary(bad)).toThrow(/invalid map/);
  });

  it("rejects malformed JSON", () => {
    expect(() => parseLibrary("{not json")).toThrow(/Not valid JSON/);
    expect(tryParseLibrary("{not json")).toBeNull();
  });

  it("round-trips the folder list, and each map's folderId (C2)", () => {
    const folders = [{ id: "f1", name: "Work", createdAt: 100 }];
    const m = { ...map("m1", "M1"), meta: { folderId: "f1" } };
    const text = serializeLibrary([m], folders);
    expect(parseLibraryFolders(text)).toEqual(folders);
    expect(parseLibrary(text)[0].meta?.folderId).toBe("f1"); // membership rides in the map
  });

  it("tolerates an old backup with no folders key", () => {
    const text = serializeLibrary([map("m1", "M1")]); // no folders arg
    expect(parseLibraryFolders(text)).toEqual([]);
    expect(parseLibraryFolders('{"kind":"mindmap-library","maps":[]}')).toEqual([]);
    expect(parseLibraryFolders("{not json")).toEqual([]);
  });
});
