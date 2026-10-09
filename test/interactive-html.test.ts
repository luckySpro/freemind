import { describe, expect, it } from "vitest";
import { buildInteractiveHtml } from "../src/io/interactiveHtml";
import type { MindMapDoc } from "../src/model/types";

const doc: MindMapDoc = {
  schemaVersion: 1,
  id: "d",
  title: "Plan",
  root: {
    id: "r",
    topic: "Plan",
    children: [
      {
        id: "a",
        topic: "Alpha",
        note: "a **bold** note",
        children: [{ id: "a1", topic: "Alpha One", children: [] }],
      },
      { id: "b", topic: "Beta", hyperlink: "https://example.com", children: [] },
    ],
  },
};

describe("buildInteractiveHtml", () => {
  it("produces a self-contained html document with the title", () => {
    const html = buildInteractiveHtml(doc);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<html");
    expect(html).toContain("<title>Plan</title>");
  });

  it("contains every topic's text", () => {
    const html = buildInteractiveHtml(doc);
    for (const topic of ["Plan", "Alpha", "Beta", "Alpha One"]) {
      expect(html).toContain(`>${topic}</span>`);
    }
  });

  it("inlines the runtime script and the styles (no external resources)", () => {
    const html = buildInteractiveHtml(doc);
    // Inlined CSS + a real (non-empty) inline runtime.
    expect(html).toContain("<style>");
    expect(html).toMatch(/<script>[\s\S]*addEventListener[\s\S]*<\/script>/);
    // Self-contained: no external stylesheet/script and no remote URLs at all.
    expect(html).not.toMatch(/<link\b/);
    expect(html).not.toMatch(/<script[^>]*\bsrc=/);
    expect(html).not.toContain("http://");
    // The only "https" allowed is inside an escaped, user-supplied hyperlink — never a
    // resource the document loads. Assert there is no protocol-bearing src/href/url() pull.
    expect(html).not.toMatch(/\b(?:src|href)\s*=\s*["']https?:\/\//);
    expect(html).not.toMatch(/url\(\s*["']?https?:/);
  });

  it("embeds the tree data as inline JSON", () => {
    const html = buildInteractiveHtml(doc);
    expect(html).toContain('<script type="application/json" id="map-data">');
    const m = html.match(/<script type="application\/json" id="map-data">(.*?)<\/script>/s);
    expect(m).toBeTruthy();
    const data = JSON.parse((m as RegExpMatchArray)[1].replace(/\\u003c/g, "<"));
    expect(data.title).toBe("Plan");
    expect(data.tree.topic).toBe("Plan");
    expect(data.tree.children.map((c: { topic: string }) => c.topic)).toEqual(["Alpha", "Beta"]);
  });

  it("gives parent nodes a toggle and leaves a leaf without one", () => {
    const html = buildInteractiveHtml(doc);
    // The runtime needs toggles to fold/unfold; leaves carry data-leaf instead.
    expect(html).toContain('class="toggle"');
    expect(html).toContain('data-leaf="1"');
  });

  it("renders a note through the safe Markdown subset", () => {
    const html = buildInteractiveHtml(doc);
    expect(html).toContain('<div class="note">');
    expect(html).toContain("<strong>bold</strong>");
  });

  it("emits only an http(s)/mailto hyperlink, with rel=noopener", () => {
    const html = buildInteractiveHtml(doc);
    expect(html).toContain('href="https:&#47;&#47;example.com"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("drops a dangerous hyperlink scheme", () => {
    const evil: MindMapDoc = {
      schemaVersion: 1,
      id: "e",
      title: "T",
      root: {
        id: "r",
        topic: "T",
        children: [{ id: "x", topic: "Click", hyperlink: "javascript:alert(1)", children: [] }],
      },
    };
    const html = buildInteractiveHtml(evil);
    expect(html).not.toContain("javascript:alert(1)");
    expect(html).not.toContain('class="link"');
  });

  it("escapes a topic containing <script> and quotes so it cannot inject markup", () => {
    const evil: MindMapDoc = {
      schemaVersion: 1,
      id: "e",
      title: "T",
      root: {
        id: "r",
        topic: "T",
        children: [
          {
            id: "x",
            topic: "<script>alert(\"xss\")</script> & 'quoted'",
            children: [],
          },
        ],
      },
    };
    const html = buildInteractiveHtml(evil);
    // No live script tag from map content survives anywhere in the document.
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("</script>alert");
    expect(html).toContain("&lt;script&gt;alert(&quot;xss&quot;)&lt;&#47;script&gt;");
    // And the JSON data block can't be broken out of either ("<" is <-escaped).
    const m = html.match(/<script type="application\/json" id="map-data">(.*?)<\/script>/s);
    expect((m as RegExpMatchArray)[1]).not.toContain("</script>");
  });

  it("uses the root topic as the title when the doc title is empty", () => {
    const untitled: MindMapDoc = {
      schemaVersion: 1,
      id: "u",
      title: "",
      root: { id: "r", topic: "Rooted", children: [] },
    };
    expect(buildInteractiveHtml(untitled)).toContain("<title>Rooted</title>");
  });

  it("stays outline-only (no visual layer / toggle) when no SVG is supplied (C1)", () => {
    const html = buildInteractiveHtml(doc);
    expect(html).toContain('class="mode-outline"');
    expect(html).not.toContain('id="visual"');
    expect(html).not.toContain('id="mode"');
  });

  it("embeds the visual map + a Visual/Outline toggle when an SVG is supplied (C1)", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>Plan</text></svg>';
    const html = buildInteractiveHtml(doc, svg);
    expect(html).toContain('class="mode-visual"'); // opens on the visual map
    expect(html).toContain('<div id="visual">');
    expect(html).toContain(svg); // the SVG is embedded verbatim (caller sanitises it)
    expect(html).toContain('id="mode"'); // the Visual/Outline toggle
    // The outline is still present (the other mode / fallback).
    expect(html).toContain('id="tree"');
    expect(html).toMatch(/setMode/); // the runtime toggle logic
  });
});
