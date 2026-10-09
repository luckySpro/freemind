import { findAnyNode } from "../mindmap/flow/ops";
import type { MapNode, MindMapDoc, SlideRef } from "../model/types";

// A Walk-Through is an overview slide (the root + its branches) followed by one
// slide per top-level branch (its subtree). Pure + deterministic so it's unit
// testable; the overlay component just renders these.

export interface Slide {
  heading: string;
  node: MapNode;
  isOverview: boolean;
  /** Per-slide speaker note override (from a custom deck); falls back to the node's own `note`. */
  note?: string;
}

/** The sentinel `nodeId` selecting the root overview slide in a custom deck. */
export const OVERVIEW_SLIDE_ID = "overview";

/** The stable key identifying a slide's branch for per-slide image maps (item 1): the `"overview"`
 *  sentinel for the root overview slide, else the branch node's id. Shared by the deck/PPTX image
 *  exporters and the renderer that produces one map image per slide. Pure. */
export function slideKey(slide: Slide): string {
  return slide.isOverview ? OVERVIEW_SLIDE_ID : slide.node.id;
}

export function presentationSlides(doc: MindMapDoc): Slide[] {
  const overview: Slide = { heading: doc.root.topic, node: doc.root, isOverview: true };
  const branches: Slide[] = doc.root.children.map((child) => ({
    heading: child.topic,
    node: child,
    isOverview: false,
  }));
  return [overview, ...branches];
}

/** Whether the doc has a custom deck in effect (vs the auto walk-through). */
export function hasCustomDeck(doc: MindMapDoc): boolean {
  return (doc.meta?.slides?.length ?? 0) > 0;
}

/** The editor's seed: the current deck as `{ ref, heading }` rows — the custom `meta.slides` (each
 *  resolved to a display heading) when set, otherwise the auto walk-through expressed as refs (the
 *  `"overview"` sentinel + one ref per top branch). The first edit commits this explicit list, turning
 *  the map custom. Skips refs whose topic no longer resolves. Pure. */
export function deckRows(doc: MindMapDoc): { ref: SlideRef; heading: string }[] {
  const refs: SlideRef[] = doc.meta?.slides ?? [
    { nodeId: OVERVIEW_SLIDE_ID },
    ...doc.root.children.map((c) => ({ nodeId: c.id })),
  ];
  const rows: { ref: SlideRef; heading: string }[] = [];
  for (const ref of refs) {
    if (ref.nodeId === OVERVIEW_SLIDE_ID) {
      rows.push({ ref, heading: doc.root.topic });
      continue;
    }
    const node = findAnyNode(doc, ref.nodeId);
    if (node) rows.push({ ref, heading: node.topic });
  }
  return rows;
}

/** The deck to actually present/export: a custom `meta.slides` deck if set (mapping each entry to its
 *  topic, the `"overview"` sentinel → the root overview, carrying any per-slide note and skipping
 *  entries whose id no longer resolves), otherwise the auto walk-through. Pure + deterministic. */
export function resolveSlides(doc: MindMapDoc): Slide[] {
  const refs = doc.meta?.slides;
  if (!refs || refs.length === 0) return presentationSlides(doc);
  const slides: Slide[] = [];
  for (const ref of refs) {
    if (ref.nodeId === OVERVIEW_SLIDE_ID) {
      slides.push({ heading: doc.root.topic, node: doc.root, isOverview: true, note: ref.note });
      continue;
    }
    const node = findAnyNode(doc, ref.nodeId);
    if (!node) continue; // a since-deleted topic — skip rather than crash
    slides.push({ heading: node.topic, node, isOverview: false, note: ref.note });
  }
  // An all-invalid custom deck would present nothing; fall back to the auto deck so there's always
  // something to show.
  return slides.length > 0 ? slides : presentationSlides(doc);
}
