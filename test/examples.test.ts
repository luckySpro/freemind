import { describe, expect, it } from "vitest";
import { buildExample } from "../src/exampleBuilders";
import { examples } from "../src/examples";
import type { MapNode, MindMapDoc } from "../src/model/types";

// The examples are hand-authored content, so the real risk is a typo'd id: a link or
// boundary pointing at a node that doesn't exist, or two nodes sharing an id. These tests
// build every example and check the structural invariants that keep them openable.

function collectIds(node: MapNode, into: string[]): void {
  into.push(node.id);
  for (const child of node.children) collectIds(child, into);
}

function allNodeIds(d: MindMapDoc): string[] {
  const ids: string[] = [];
  collectIds(d.root, ids);
  for (const f of d.floatingTopics ?? []) collectIds(f, ids);
  return ids;
}

function eachTopic(node: MapNode, visit: (n: MapNode) => void): void {
  visit(node);
  for (const child of node.children) eachTopic(child, visit);
}

describe("examples gallery", () => {
  it("offers at least 10 examples with unique ids and names", () => {
    expect(examples.length).toBeGreaterThanOrEqual(10);
    expect(new Set(examples.map((e) => e.id)).size).toBe(examples.length);
    expect(new Set(examples.map((e) => e.name)).size).toBe(examples.length);
  });

  for (const ex of examples) {
    describe(ex.name, () => {
      const d = buildExample(ex.id);

      it("builds a well-formed, example-sourced doc", () => {
        expect(d.schemaVersion).toBe(1);
        expect(d.id).toBeTruthy();
        expect(d.title.length).toBeGreaterThan(0);
        expect(d.root).toBeTruthy();
        expect(d.meta?.source).toBe("example");
      });

      it("has unique node ids and no empty topics", () => {
        const ids = allNodeIds(d);
        expect(new Set(ids).size).toBe(ids.length);
        eachTopic(d.root, (n) => expect(n.topic.trim().length).toBeGreaterThan(0));
      });

      it("only references node ids that exist (links + boundaries)", () => {
        const ids = new Set(allNodeIds(d));
        for (const link of d.links ?? []) {
          expect(ids.has(link.from)).toBe(true);
          expect(ids.has(link.to)).toBe(true);
        }
        for (const b of d.boundaries ?? []) {
          for (const nodeId of b.nodeIds) expect(ids.has(nodeId)).toBe(true);
        }
      });

      it("has unique link and boundary ids", () => {
        const linkIds = (d.links ?? []).map((l) => l.id);
        expect(new Set(linkIds).size).toBe(linkIds.length);
        const boundaryIds = (d.boundaries ?? []).map((b) => b.id);
        expect(new Set(boundaryIds).size).toBe(boundaryIds.length);
      });
    });
  }

  it("collectively demonstrates every major feature at least once", () => {
    const docs = examples.map((e) => buildExample(e.id));
    const anyTopic = (pred: (n: MapNode) => boolean) =>
      docs.some((d) => {
        let hit = false;
        eachTopic(d.root, (n) => {
          if (pred(n)) hit = true;
        });
        return hit || (d.floatingTopics ?? []).some((f) => pred(f));
      });
    expect(docs.some((d) => (d.links?.length ?? 0) > 0)).toBe(true); // relationships
    expect(docs.some((d) => (d.boundaries?.length ?? 0) > 0)).toBe(true); // boundaries
    expect(docs.some((d) => (d.floatingTopics?.length ?? 0) > 0)).toBe(true); // floating topics
    expect(anyTopic((n) => !!n.image)).toBe(true); // node image
    expect(anyTopic((n) => !!n.icons?.length)).toBe(true); // markers
    expect(anyTopic((n) => !!n.note)).toBe(true); // notes
    expect(anyTopic((n) => !!n.style)).toBe(true); // per-topic styling
    expect(anyTopic((n) => !!n.style?.shape)).toBe(true); // geometric node shapes (flowchart vocab)
    expect(anyTopic((n) => !!n.hyperlink)).toBe(true); // hyperlink
    expect(docs.some((d) => !!d.meta?.freeform)).toBe(true); // free-canvas (whiteboard) mode
    expect(anyTopic((n) => !!n.pos)).toBe(true); // free-canvas positions
    expect(docs.some((d) => !!d.backdrop)).toBe(true); // dedicated diagram backdrop
  });

  it("the trip example carries exactly one small embedded image", () => {
    const trip = buildExample("trip");
    let images = 0;
    eachTopic(trip.root, (n) => {
      if (n.image) {
        images += 1;
        expect(n.image.url.startsWith("data:image/")).toBe(true);
      }
    });
    expect(images).toBe(1);
  });

  it("buildExample returns the requested example and a stable fallback", () => {
    expect(buildExample("okrs").title).toBe("Q3 OKRs — Growth team");
    expect(buildExample("does-not-exist").title).toBe(buildExample(examples[0].id).title);
  });

  it("each build produces a fresh doc id (so opening twice makes two maps)", () => {
    expect(buildExample("launch").id).not.toBe(buildExample("launch").id);
  });
});
