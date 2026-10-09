import type { MindMapDoc } from "../../model/types";
import { findAnyNode } from "./ops";

/** A read-only, screen-reader-only list of the map's relationships (cross-links), always present in the
 *  canvas region. Cross-links render as non-focusable SVG edges that are invisible to assistive tech and
 *  appear nowhere else (the Outline panel only lists the topic hierarchy), so this is the one place a
 *  screen-reader user can discover "what connects to what". Visually clipped (.mm-sr-only); the topic
 *  hierarchy itself stays reachable via the canvas nodes + the Outline panel's role="tree", so it isn't
 *  duplicated here. (UI-5 a11y tail.) */
export function CanvasRelationshipsSR({ doc }: { doc: MindMapDoc }) {
  const links = doc.links ?? [];
  if (links.length === 0) return null;
  return (
    <nav className="mm-sr-only" aria-label={`Relationships (${links.length})`}>
      <ul>
        {links.map((l) => {
          const from = findAnyNode(doc, l.from)?.topic || "(untitled)";
          const to = findAnyNode(doc, l.to)?.topic || "(untitled)";
          return <li key={l.id}>{`${from} → ${to}${l.label ? `: ${l.label}` : ""}`}</li>;
        })}
      </ul>
    </nav>
  );
}
