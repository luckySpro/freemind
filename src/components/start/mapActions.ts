import { downloadBlob } from "../../io/download";
import { safeFileStem } from "../../io/fileName";
import type { MindMapDoc } from "../../model/types";
import { loadMap, saveMap } from "../../store/mapStore";
import type { MapEntry } from "./MapCard";
import type { StartContext } from "./types";

// The MapCard kebab actions, wired to the store. Shared by Home / All maps / Recent.

function download(doc: MindMapDoc): void {
  const name = safeFileStem(doc.title, "map");
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
  downloadBlob(blob, `${name}.json`);
}

export async function handleMapAction(
  action: string,
  entry: MapEntry,
  ctx: StartContext,
): Promise<void> {
  const doc = await loadMap(entry.id);
  if (!doc) return;
  switch (action) {
    case "open":
      ctx.onOpen(doc);
      return;
    case "rename":
      // Hand off to the themed rename dialog (StartScreen owns it) instead of a raw window.prompt.
      ctx.requestRename?.(entry.id, doc.title);
      return;
    case "pin": {
      doc.meta = { ...doc.meta, pinned: !doc.meta?.pinned };
      await saveMap(doc);
      ctx.onLibraryChange();
      return;
    }
    case "duplicate": {
      const copy: MindMapDoc = { ...structuredClone(doc), id: crypto.randomUUID() };
      copy.title = `${doc.title} (copy)`;
      copy.root = { ...copy.root, topic: copy.title };
      await saveMap(copy);
      ctx.onLibraryChange();
      return;
    }
    case "export":
      download(doc);
      return;
    case "delete":
      // Hand off to the themed confirm dialog (StartScreen owns it) instead of a raw window.confirm.
      ctx.requestDelete?.(entry.id, doc.title);
      return;
  }
}

/** Apply a rename to the stored map — updates the title + the root topic, then saves. The UI lives in
 *  the themed rename dialog (StartScreen / MapDialogs); this is the store op it calls on confirm. */
export async function renameMapTitle(id: string, title: string): Promise<void> {
  const name = title.trim();
  if (!name) return;
  const doc = await loadMap(id);
  if (!doc) return;
  doc.title = name;
  doc.root = { ...doc.root, topic: name };
  await saveMap(doc);
}
