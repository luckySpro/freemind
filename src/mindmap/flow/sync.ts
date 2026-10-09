import { isDangerousUrl } from "../../io/urlSafety";
import type { Boundary, CrossLink, MapNode, MindMapDoc } from "../../model/types";
import type { FlowEdge, TopicNode } from "./types";

// fromFlow — the inverse of project(): rebuild the canonical MindMapDoc from React Flow
// nodes + edges. The flow engine is model-first (every edit is a pure op on the doc, then
// re-project + re-layout), so fromFlow is (1) the tested guarantee that project() is lossless
// and reversible — `fromFlow(project(doc)) ≈ doc` — and (2) the reconstruction path for any
// native RF gesture that mutates canvas state directly.
//
// Field provenance:
//  - Editable on the canvas (topic, note, hyperlink, image, icons, tags, style, collapsed):
//    read from the node's live `data`.
//  - Not touched by any RF gesture (task, side): preserved by id from the previous doc.
//  - A collapsed node's children are OMITTED from the projection (project drops them), so
//    they're restored verbatim from prevDoc.
//  - Boundaries aren't encoded in nodes/edges (they render from doc.boundaries via an
//    overlay), so they're carried from prevDoc and pruned of any members that no longer exist.
// Dangerous-scheme hyperlinks are stripped on capture (the app-wide XSS guard).

function indexById(node: MapNode, into: Map<string, MapNode>): void {
  into.set(node.id, node);
  for (const child of node.children) indexById(child, into);
}

export function fromFlow(nodes: TopicNode[], edges: FlowEdge[], prevDoc: MindMapDoc): MindMapDoc {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const order = new Map(nodes.map((n, i) => [n.id, i]));
  const prevById = new Map<string, MapNode>();
  indexById(prevDoc.root, prevById);
  for (const f of prevDoc.floatingTopics ?? []) indexById(f, prevById);

  // Parent → child ids from branch edges, ordered by node array position (project emits
  // siblings in order), so the rebuilt tree keeps its sibling ordering.
  const childrenByParent = new Map<string, string[]>();
  const hasIncoming = new Set<string>();
  for (const e of edges) {
    if (e.data?.crosslink) continue;
    hasIncoming.add(e.target);
    const arr = childrenByParent.get(e.source);
    if (arr) arr.push(e.target);
    else childrenByParent.set(e.source, [e.target]);
  }
  for (const arr of childrenByParent.values()) {
    arr.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  }

  const build = (id: string): MapNode => {
    const data = nodeById.get(id)?.data;
    const prev = prevById.get(id);
    const node: MapNode = { id, topic: data?.topic ?? prev?.topic ?? "", children: [] };
    if (data) {
      if (data.topicRich) node.topicRich = data.topicRich;
      if (data.icons?.length) node.icons = data.icons;
      if (data.tags?.length) node.tags = data.tags;
      if (data.hyperlink && !isDangerousUrl(data.hyperlink)) node.hyperlink = data.hyperlink;
      if (data.note) node.note = data.note;
      if (data.image) node.image = data.image;
      if (data.style && Object.keys(data.style).length > 0) node.style = data.style;
      if (data.collapsed) node.collapsed = true;
    }
    // Preserve by id the fields no RF gesture changes (freeform drags write `pos` via a model op,
    // not through fromFlow, so it's carried here like task/side).
    if (prev?.side) node.side = prev.side;
    if (prev?.task) node.task = prev.task;
    if (prev?.callouts) node.callouts = prev.callouts;
    if (prev?.pos) node.pos = prev.pos;
    if (prev?.layout) node.layout = prev.layout;
    // Connector colour / dash are set via model ops (not RF gestures), so carry by id like side/task.
    if (prev?.branchColor) node.branchColor = prev.branchColor;
    if (prev?.lineDash) node.lineDash = prev.lineDash;
    // Roll-up binding + attachments are model-only (not in TopicData / not RF-editable) — carry by id
    // so they survive the round-trip, like callouts/task. (project() only emits a derived count.)
    if (prev?.rollup) node.rollup = prev.rollup;
    if (prev?.attachments) node.attachments = prev.attachments;
    // Per-node timestamps aren't in TopicData (never rendered) — carry by id, only when present, so
    // a timestamp-free doc round-trips to itself (never invent them here).
    if (prev?.createdAt !== undefined) node.createdAt = prev.createdAt;
    if (prev?.modifiedAt !== undefined) node.modifiedAt = prev.modifiedAt;
    // Collapsed → its subtree isn't in the projection; restore it verbatim from prevDoc.
    node.children = data?.collapsed
      ? (prev?.children ?? [])
      : (childrenByParent.get(id) ?? []).map(build);
    return node;
  };

  const rootNode = nodes.find((n) => n.data?.isRoot) ?? nodeById.get(prevDoc.root.id);
  const root = rootNode ? build(rootNode.id) : prevDoc.root;

  // Floating topics: detached subtrees (flagged floating, with no incoming branch edge).
  const floating = nodes
    .filter((n) => n.data?.floating && !hasIncoming.has(n.id))
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map((n) => build(n.id));

  // Cross-links from the crosslink edges.
  const links: CrossLink[] = edges
    .filter((e) => e.data?.crosslink)
    .map((e) => {
      const d = e.data;
      return {
        id: e.id,
        from: e.source,
        to: e.target,
        ...(typeof e.label === "string" && e.label ? { label: e.label } : {}),
        // Per-link style + curve are carried through so a round-trip keeps the relationship's look.
        ...(d?.arrow ? { arrow: d.arrow } : {}),
        ...(d?.color ? { color: d.color } : {}),
        ...(d?.width ? { width: d.width } : {}),
        ...(d?.dash ? { dash: d.dash } : {}),
        ...(d?.curve != null ? { curve: d.curve } : {}),
      };
    });

  // Boundaries aren't represented in nodes/edges — carry from prevDoc, dropping any member
  // ids that no longer exist (and any boundary thereby emptied).
  const present = new Set<string>();
  const collect = (n: MapNode) => {
    present.add(n.id);
    n.children.forEach(collect);
  };
  collect(root);
  for (const f of floating) collect(f);
  const boundaries: Boundary[] = (prevDoc.boundaries ?? [])
    .map((b) => ({ ...b, nodeIds: b.nodeIds.filter((id) => present.has(id)) }))
    .filter((b) => b.nodeIds.length > 0);
  // Summaries (like boundaries) aren't in the nodes/edges graph — carry from prevDoc, pruning ids
  // that no longer exist (and any summary thereby emptied).
  const summaries = (prevDoc.summaries ?? [])
    .map((s) => ({ ...s, nodeIds: s.nodeIds.filter((id) => present.has(id)) }))
    .filter((s) => s.nodeIds.length > 0);

  const result: MindMapDoc = { ...prevDoc, title: root.topic, root };
  result.floatingTopics = floating.length > 0 ? floating : undefined;
  result.links = links.length > 0 ? links : undefined;
  result.boundaries = boundaries.length > 0 ? boundaries : undefined;
  result.summaries = summaries.length > 0 ? summaries : undefined;
  return result;
}
