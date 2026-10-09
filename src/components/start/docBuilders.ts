import { parseOutline } from "../../io/pasteOutline";
import type { MapNode, MindMapDoc } from "../../model/types";
import { buildTemplate } from "../../templates";

// Turn the start screen's capture inputs into real MindMapDocs (mirrors App's paste-text flow). The
// store assigns persistence; these just shape the doc. Each gets a fresh id so opening makes a map.

/** A one-topic map (the "Type a topic" path). */
export function topicDoc(topic: string): MindMapDoc {
  const t = topic.trim() || "New map";
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    title: t,
    root: { id: "root", topic: t, children: [] },
    meta: { source: "start" },
  };
}

/** Parse a pasted outline into a map (the "Paste an outline" path); null if there's nothing to add. */
export function outlineDoc(text: string): MindMapDoc | null {
  const forest = parseOutline(text);
  if (forest.length === 0) return null;
  const root: MapNode =
    forest.length === 1 ? forest[0] : { id: "root", topic: "Pasted map", children: forest };
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    title: root.topic,
    root,
    meta: { source: "paste" },
  };
}

/** A fresh blank map (the "Blank canvas" path + the New-map button). */
export function blankDoc(): MindMapDoc {
  return buildTemplate("blank");
}
