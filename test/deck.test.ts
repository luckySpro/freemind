import { describe, expect, it } from "vitest";
import { buildDeckHtml } from "../src/io/deck";
import type { MindMapDoc } from "../src/model/types";

const doc: MindMapDoc = {
  schemaVersion: 1,
  id: "d",
  title: "Plan",
  root: {
    id: "r",
    topic: "Plan",
    children: [
      { id: "a", topic: "Alpha", children: [{ id: "a1", topic: "Alpha One", children: [] }] },
      { id: "b", topic: "Beta", children: [] },
    ],
  },
};

describe("buildDeckHtml", () => {
  it("produces a self-contained html document", () => {
    const html = buildDeckHtml(doc);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<title>Plan</title>");
    // Self-contained: no external stylesheet/script references.
    expect(html).not.toMatch(/<link\b/);
    expect(html).not.toMatch(/<script[^>]*\bsrc=/);
  });

  it("emits an overview slide plus one slide per top-level branch", () => {
    const html = buildDeckHtml(doc);
    const slides = html.match(/<section class="slide">/g) ?? [];
    expect(slides).toHaveLength(3); // overview + Alpha + Beta
    expect(html).toContain("<h1>Plan</h1>");
    expect(html).toContain("<h1>Alpha</h1>");
    expect(html).toContain("<h1>Beta</h1>");
  });

  it("renders nested bullets for a branch's subtree", () => {
    const html = buildDeckHtml(doc);
    expect(html).toContain("<li>Alpha One</li>");
  });

  it("collapses to a single overview slide for a childless map", () => {
    const lonely: MindMapDoc = {
      schemaVersion: 1,
      id: "x",
      title: "Solo",
      root: { id: "r", topic: "Solo", children: [] },
    };
    const html = buildDeckHtml(lonely);
    expect(html.match(/<section class="slide">/g) ?? []).toHaveLength(1);
  });

  it("escapes topic text so a malicious topic cannot inject markup", () => {
    const evil: MindMapDoc = {
      schemaVersion: 1,
      id: "e",
      title: "T",
      root: {
        id: "r",
        topic: "T",
        children: [{ id: "x", topic: '<img src=x onerror="alert(1)">', children: [] }],
      },
    };
    const html = buildDeckHtml(evil);
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("embeds hidden speaker notes (rendered Markdown) with an N-key toggle (B5)", () => {
    const withNotes: MindMapDoc = {
      ...doc,
      root: {
        ...doc.root,
        children: [
          { id: "a", topic: "Alpha", note: "**Bold** point to make", children: [] },
          { id: "b", topic: "Beta", children: [] }, // no note
        ],
      },
    };
    const html = buildDeckHtml(withNotes);
    expect(html).toContain('class="speaker-notes"');
    expect(html).toContain("<strong>Bold</strong> point to make"); // Markdown rendered
    expect(html).toContain('id="notes-toggle"');
    expect(html).toContain("notes-on"); // the toggle class the N key / button flips
    expect(html).toMatch(/toggleNotes/);
    // Exactly one slide carries notes (Alpha); the overview + Beta have none.
    expect(html.match(/class="speaker-notes"/g)?.length).toBe(1);
  });

  it("prefers a per-slide SlideRef note over the topic's own note (B5)", () => {
    const custom: MindMapDoc = {
      ...doc,
      root: {
        ...doc.root,
        children: [{ id: "a", topic: "Alpha", note: "topic note", children: [] }],
      },
      meta: { slides: [{ nodeId: "a", note: "override note" }] },
    };
    const html = buildDeckHtml(custom);
    expect(html).toContain("override note");
    expect(html).not.toContain("topic note");
  });

  describe("live-map slides — embedded branch SVGs (item 1)", () => {
    // slideKey: "overview" for the root overview, else the branch node id.
    const svgs = new Map<string, string>([
      ["overview", '<svg id="ov"><text>overview map</text></svg>'],
      ["a", '<svg id="branch-a"><text>alpha map</text></svg>'],
      // Beta ("b") deliberately absent → that slide falls back to bullets.
    ]);

    it("inlines a slide's branch SVG (as a figure) instead of its bullets when supplied", () => {
      const html = buildDeckHtml(doc, svgs);
      expect(html).toContain('<figure class="map"><svg id="ov">');
      expect(html).toContain('<figure class="map"><svg id="branch-a">');
      // Alpha's slide shows its map, not the bullet outline of its subtree.
      expect(html).not.toContain("<li>Alpha One</li>");
    });

    it("falls back to bullets for a slide with no captured image (partial capture)", () => {
      const html = buildDeckHtml(doc, svgs);
      // Beta had no SVG → its slide still renders (as a childless branch, an empty outline) with no figure
      // for that heading; the deck as a whole mixes map slides and bullet slides gracefully.
      expect(html).toContain("<h1>Beta</h1>");
      expect(html.match(/<figure class="map">/g)).toHaveLength(2); // only overview + Alpha
    });

    it("is unchanged (bullet deck) when no images are supplied", () => {
      expect(buildDeckHtml(doc)).not.toContain('<figure class="map">');
      expect(buildDeckHtml(doc)).toContain("<li>Alpha One</li>");
    });
  });
});
