import { describe, expect, it } from "vitest";
import { buildPrintDoc, wrapSvgHtml } from "../src/io/html";

describe("wrapSvgHtml", () => {
  it("embeds the svg in a self-contained html document", () => {
    const html = wrapSvgHtml("<svg><rect /></svg>", "My Map");
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<svg><rect /></svg>");
    expect(html).toContain("<title>My Map</title>");
  });

  it("escapes the title", () => {
    expect(wrapSvgHtml("<svg/>", "A & B <plan>")).toContain(
      "<title>A &amp; B &lt;plan&gt;</title>",
    );
  });
});

describe("buildPrintDoc", () => {
  it("embeds the svg and a landscape @page for print-to-PDF", () => {
    const html = buildPrintDoc("<svg><rect /></svg>", "My Map");
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<svg><rect /></svg>");
    expect(html).toContain("<title>My Map</title>");
    expect(html).toContain("@page { size: landscape;");
  });

  it("escapes the title", () => {
    expect(buildPrintDoc("<svg/>", "A & B <plan>")).toContain(
      "<title>A &amp; B &lt;plan&gt;</title>",
    );
  });
});
