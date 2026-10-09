import { t } from "../i18n/registry";
import { normalizeDoc } from "../model/normalize";
import type { MindMapDoc } from "../model/types";
import type { Folder } from "../store/mapStore";

// Whole-library backup: every map bundled into one JSON file, and the inverse.
// Pure + deterministic (unit-tested). Used for "Backup" (export all) and restore.

const KIND = "mindmap-library";

export function serializeLibrary(docs: MindMapDoc[], folders: Folder[] = []): string {
  // `folders` records the folder LIST (C2); each map's membership already rides in its meta.folderId.
  return JSON.stringify({ schemaVersion: 1, kind: KIND, maps: docs, folders }, null, 2);
}

/** The folder list from a backup (C2), tolerant of an old backup with no `folders` key (→ []). */
export function parseLibraryFolders(text: string): Folder[] {
  try {
    const data = JSON.parse(text) as { folders?: unknown };
    if (!Array.isArray(data.folders)) return [];
    return data.folders.filter(
      (f): f is Folder =>
        !!f &&
        typeof (f as Folder).id === "string" &&
        typeof (f as Folder).name === "string" &&
        typeof (f as Folder).createdAt === "number",
    );
  } catch {
    return [];
  }
}

function isValidDoc(m: unknown): m is MindMapDoc {
  return (
    !!m &&
    typeof m === "object" &&
    (m as { schemaVersion?: unknown }).schemaVersion === 1 &&
    typeof (m as { root?: unknown }).root === "object" &&
    (m as { root?: unknown }).root !== null
  );
}

export function parseLibrary(text: string): MindMapDoc[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(t("io.err.notValidJson"));
  }
  if (
    !data ||
    typeof data !== "object" ||
    (data as { kind?: unknown }).kind !== KIND ||
    !Array.isArray((data as { maps?: unknown }).maps)
  ) {
    throw new Error(t("io.err.notStudioLibrary"));
  }
  const maps = (data as { maps: unknown[] }).maps;
  return maps.map((m) => {
    if (!isValidDoc(m)) throw new Error(t("io.err.libraryInvalidMap"));
    return normalizeDoc(m); // salvage a schema-drifted map to a projectable shape
  });
}

/** Like parseLibrary but returns null instead of throwing when it's not a backup. */
export function tryParseLibrary(text: string): MindMapDoc[] | null {
  try {
    return parseLibrary(text);
  } catch {
    return null;
  }
}
