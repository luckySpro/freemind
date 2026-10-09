import type { MindMapDoc } from "../../model/types";
import type { SelectedEdge, SelectedNode, SelectedOverlay } from "../contract";
import { findAnyNode, findNode } from "./ops";
import { CROSSLINK_COLOR, CROSSLINK_WIDTH } from "./style";

// The PURE "resolve a selection to the inspector payload" logic lifted out of FlowMindMap's fire*
// callbacks: given the live doc + an id/descriptor, find the model object and fill the inspector
// defaults. The component keeps the React-coupled part (the setState + the mutual-exclusivity clears).
// Pure → unit-testable (the default-filling was previously only exercised through the canvas).

/** The selected node surfaced to the Notes/Details inspector, or null. */
export function resolveSelectedNode(doc: MindMapDoc, id: string | null): SelectedNode | null {
  const n = id ? findNode(doc, id) : null;
  return n ? { id: n.id, topic: n.topic, note: n.note ?? "" } : null;
}

/** A selected relationship resolved with every inspector default filled, or null when the id is absent
 *  or no longer in the doc. */
export function resolveSelectedEdge(doc: MindMapDoc, id: string | null): SelectedEdge | null {
  const l = id ? (doc.links ?? []).find((x) => x.id === id) : null;
  if (!l) return null;
  return {
    id: l.id,
    label: l.label ?? "",
    arrow: l.arrow ?? "to",
    color: l.color ?? CROSSLINK_COLOR,
    width: l.width ?? CROSSLINK_WIDTH,
    dash: l.dash ?? "dashed",
    curve: l.curve,
    type: l.type ?? "relates-to",
    showTypes: !!doc.meta?.showLinkTypes,
  };
}

/** A selection descriptor (kind + id, plus the owning node for callouts) before it's resolved. */
export interface OverlaySelect {
  kind: SelectedOverlay["kind"];
  id: string;
  nodeId?: string;
}

/** Resolve a boundary/summary/callout descriptor to the OverlayInspector payload, or null when the
 *  object is gone (the caller leaves the current selection untouched on null). */
export function resolveSelectedOverlay(
  doc: MindMapDoc,
  sel: OverlaySelect | null,
): SelectedOverlay | null {
  if (!sel) return null;
  let label: string | undefined;
  let color: string | undefined;
  let shape: SelectedOverlay["shape"];
  let dash: SelectedOverlay["dash"];
  if (sel.kind === "boundary") {
    const b = (doc.boundaries ?? []).find((x) => x.id === sel.id);
    label = b?.label;
    color = b?.color;
    shape = b?.shape;
    dash = b?.dash;
  } else if (sel.kind === "summary") {
    const s = (doc.summaries ?? []).find((x) => x.id === sel.id);
    label = s?.label;
    color = s?.color;
  } else {
    const node = sel.nodeId ? findAnyNode(doc, sel.nodeId) : null;
    const found = node?.callouts?.find((c) => c.id === sel.id);
    if (!found) return null; // callout gone
    label = found.text;
    color = found.color;
  }
  // boundary/summary may legitimately have no label; only bail if the object itself is missing.
  if (sel.kind !== "callout") {
    const exists =
      sel.kind === "boundary"
        ? (doc.boundaries ?? []).some((b) => b.id === sel.id)
        : (doc.summaries ?? []).some((s) => s.id === sel.id);
    if (!exists) return null;
  }
  return {
    kind: sel.kind,
    id: sel.id,
    nodeId: sel.nodeId,
    label: label ?? "",
    deletable: true,
    color,
    shape,
    dash,
  };
}
