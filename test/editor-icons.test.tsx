// Editor chrome icon set + brand mark — render every glyph to static SVG markup (node env, no DOM)
// so the whole name→glyph switch in EditorIcons is exercised and stays well-formed. Pure
// presentational components; the point is to lock the icon vocabulary the redesigned chrome relies on.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BrandMark } from "../src/components/BrandMark";
import { EditorIcon, type EditorIconName } from "../src/components/EditorIcons";

const NAMES: EditorIconName[] = [
  "home",
  "pointer",
  "hand",
  "text",
  "image",
  "search",
  "help",
  "settings",
  "plus",
  "minus",
  "child",
  "trash",
  "note",
  "link",
  "bold",
  "palette",
  "dots",
  "balance",
  "layers",
  "fit",
  "chevron",
  "check",
  "star",
  "export",
  "import",
  "zoomin",
  "zoomout",
  "moon",
  "present",
  "filter",
  "board",
  "history",
  "grid",
  "copy",
  "paste",
];

describe("EditorIcon", () => {
  it("renders every named glyph as a well-formed <svg> (24-grid, aria-hidden)", () => {
    for (const name of NAMES) {
      const svg = renderToStaticMarkup(<EditorIcon name={name} />);
      expect(svg, name).toMatch(/^<svg/);
      expect(svg, name).toContain('viewBox="0 0 24 24"');
      expect(svg, name).toContain('aria-hidden="true"');
      // currentColor so the chrome tokens drive the colour.
      expect(svg, name).toContain('stroke="currentColor"');
      expect(svg, name).not.toMatch(/NaN|undefined/);
    }
  });

  it("honours size + stroke props", () => {
    const svg = renderToStaticMarkup(<EditorIcon name="plus" size={28} stroke={2.4} />);
    expect(svg).toContain('width="28"');
    expect(svg).toContain('height="28"');
    expect(svg).toContain('stroke-width="2.4"');
  });

  it("falls back to a circle glyph for an unknown name", () => {
    // The default switch arm — cast through unknown since the type guards real callers.
    const svg = renderToStaticMarkup(<EditorIcon name={"does-not-exist" as EditorIconName} />);
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain("<circle");
  });

  it("renders distinct markup per glyph (no accidental duplication)", () => {
    const a = renderToStaticMarkup(<EditorIcon name="plus" />);
    const b = renderToStaticMarkup(<EditorIcon name="trash" />);
    expect(a).not.toBe(b);
  });
});

describe("BrandMark", () => {
  it("renders the node-link glyph with the emerald accent by default", () => {
    const svg = renderToStaticMarkup(<BrandMark />);
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain('viewBox="0 0 24 24"');
    expect(svg).toContain("var(--ed-accent");
    expect((svg.match(/<circle/g) ?? []).length).toBe(3); // one hub + two satellites
  });

  it("accepts an explicit size + colour", () => {
    const svg = renderToStaticMarkup(<BrandMark size={40} color="#123456" />);
    expect(svg).toContain('width="40"');
    expect(svg).toContain("#123456");
  });
});
