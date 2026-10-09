import type { MapNode, MindMapDoc } from "../../model/types";
import { findAnyNode } from "./ops";

const topicsOf = (doc: MindMapDoc, ids: string[]): string =>
  ids.map((id) => findAnyNode(doc, id)?.topic || "(untitled)").join(", ");

/** Screen-reader-only lists of the map's canvas overlays — boundaries, summary brackets, and callout
 *  bubbles — mirroring CanvasRelationshipsSR. These render as non-focusable SVG/HTML that assistive
 *  tech can't reach and that appear nowhere else, so this is the one place a screen-reader user can
 *  discover them. Visually clipped (.mm-sr-only). Returns null when there are none. (a11y tail.) */
export function CanvasOverlaysSR({ doc }: { doc: MindMapDoc }) {
  const boundaries = doc.boundaries ?? [];
  const summaries = doc.summaries ?? [];
  // Callouts are anchored to nodes, so gather them by walking the tree + floating topics.
  const callouts: { id: string; topic: string; text: string }[] = [];
  const walk = (n: MapNode) => {
    for (const c of n.callouts ?? []) callouts.push({ id: c.id, topic: n.topic, text: c.text });
    for (const ch of n.children) walk(ch);
  };
  walk(doc.root);
  for (const f of doc.floatingTopics ?? []) walk(f);

  if (boundaries.length === 0 && summaries.length === 0 && callouts.length === 0) return null;
  return (
    <>
      {boundaries.length > 0 && (
        <nav className="mm-sr-only" aria-label={`Boundaries (${boundaries.length})`}>
          <ul>
            {boundaries.map((b) => (
              <li key={b.id}>{`${b.label ? `${b.label}: ` : ""}${topicsOf(doc, b.nodeIds)}`}</li>
            ))}
          </ul>
        </nav>
      )}
      {summaries.length > 0 && (
        <nav className="mm-sr-only" aria-label={`Summaries (${summaries.length})`}>
          <ul>
            {summaries.map((s) => (
              <li key={s.id}>{`${s.label ? `${s.label}: ` : ""}${topicsOf(doc, s.nodeIds)}`}</li>
            ))}
          </ul>
        </nav>
      )}
      {callouts.length > 0 && (
        <nav className="mm-sr-only" aria-label={`Callouts (${callouts.length})`}>
          <ul>
            {callouts.map((c) => (
              <li key={c.id}>{`${c.topic}: ${c.text}`}</li>
            ))}
          </ul>
        </nav>
      )}
    </>
  );
}
