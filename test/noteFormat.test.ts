import { describe, expect, it } from "vitest";
import { htmlToNote, noteCounts, renderNote } from "../src/noteFormat";

describe("noteCounts", () => {
  it("counts words + chars, treating whitespace-only as zero words", () => {
    expect(noteCounts("")).toEqual({ words: 0, chars: 0 });
    expect(noteCounts("   \n ")).toEqual({ words: 0, chars: 5 });
    expect(noteCounts("hello world")).toEqual({ words: 2, chars: 11 });
    expect(noteCounts("  two   spaced  words ")).toEqual({ words: 3, chars: 22 });
  });
});

describe("renderNote", () => {
  it("renders headings, bold, italic, and code", () => {
    expect(renderNote("# Title")).toBe("<h1>Title</h1>");
    expect(renderNote("**bold** and *italic* and `code`")).toBe(
      "<p><strong>bold</strong> and <em>italic</em> and <code>code</code></p>",
    );
  });

  it("renders strikethrough", () => {
    expect(renderNote("~~gone~~")).toBe("<p><del>gone</del></p>");
  });

  it("renders bullet lists", () => {
    expect(renderNote("- one\n- two")).toBe("<ul>\n<li>one</li>\n<li>two</li>\n</ul>");
  });

  it("renders numbered lists as an <ol> (auto-numbered)", () => {
    expect(renderNote("1. one\n2. two")).toBe("<ol>\n<li>one</li>\n<li>two</li>\n</ol>");
  });

  it("keeps bullet and numbered lists as separate blocks", () => {
    expect(renderNote("- a\n1. b")).toBe("<ul>\n<li>a</li>\n</ul>\n<ol>\n<li>b</li>\n</ol>");
  });

  it("renders only http(s) links", () => {
    expect(renderNote("[site](https://x.test)")).toContain(
      '<a href="https://x.test" target="_blank" rel="noopener noreferrer">site</a>',
    );
  });

  it("renders in-app note links (#node= / #map=) as marked, non-navigating anchors", () => {
    expect(renderNote("[topic](#node=n3)")).toContain(
      '<a href="#node=n3" class="mm-inote-link">topic</a>',
    );
    // A cross-map link's & is escaped to &amp; in the href; the DOM decodes it back on read.
    expect(renderNote("[plan](#map=m7&node=n3)")).toContain(
      '<a href="#map=m7&amp;node=n3" class="mm-inote-link">plan</a>',
    );
    // A javascript: target is NOT matched (only #node= / #map=), so it stays inert text.
    expect(renderNote("[x](#javascript=alert(1))")).not.toContain("<a ");
  });

  it("renders images, only for http(s) / data:image URLs (#11)", () => {
    expect(renderNote("![cat](https://x.test/c.png)")).toContain(
      '<img src="https://x.test/c.png" alt="cat" />',
    );
    expect(renderNote("![](data:image/png;base64,AAAA)")).toContain(
      '<img src="data:image/png;base64,AAAA" alt="" />',
    );
    // a non-image / dangerous scheme is left as text, never an <img>
    expect(renderNote("![x](javascript:alert(1))")).not.toContain("<img");
    expect(renderNote("![x](ftp://h/f.png)")).not.toContain("<img");
  });

  it("renders a pipe table as a <table> with a header row (#11)", () => {
    // Segments are newline-joined like the rest of renderNote's output; the browser ignores the
    // whitespace, so assert on the structural pieces rather than one concatenated string.
    const flat = renderNote("| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |").replace(/\n/g, "");
    expect(flat).toContain("<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody>");
    expect(flat).toContain("<tr><td>1</td><td>2</td></tr>");
    expect(flat).toContain("<tr><td>3</td><td>4</td></tr>");
    expect(flat).toContain("</tbody></table>");
  });

  it("treats a pipe row with no separator as a normal paragraph (#11)", () => {
    expect(renderNote("| not | a table |")).toBe("<p>| not | a table |</p>");
  });

  it("renders ==highlight== as <mark> (#10)", () => {
    expect(renderNote("a ==big== deal")).toBe("<p>a <mark>big</mark> deal</p>");
  });

  it("renders a ```fenced``` code block verbatim, no inline transforms (#10)", () => {
    const html = renderNote("```\nconst x = **not bold**;\n<b>raw</b>\n```");
    expect(html).toBe("<pre><code>const x = **not bold**;\n&lt;b&gt;raw&lt;/b&gt;</code></pre>");
  });

  it("renders - [ ] / - [x] as checklist items with checkboxes (#10)", () => {
    const html = renderNote("- [ ] todo\n- [x] done");
    expect(html).toContain('<li><input type="checkbox" disabled> todo</li>');
    expect(html).toContain('<li><input type="checkbox" disabled checked> done</li>');
  });

  it("escapes HTML so notes can't inject markup", () => {
    expect(renderNote("<script>alert(1)</script>")).toBe(
      "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>",
    );
    // a javascript: link is not turned into an anchor
    expect(renderNote("[x](javascript:alert(1))")).not.toContain("<a ");
  });

  it("escapes quotes so a link URL can't break out of the href attribute", () => {
    // Regression: `"` used to pass through escapeHtml, so a markdown link URL
    // containing a quote broke out of href="…" and injected a live attribute
    // (e.g. an event handler) — a stored XSS, since notes render via
    // dangerouslySetInnerHTML and can arrive from an imported map.
    const styled = renderNote('[c](https://a"style=color:red)');
    expect(styled).not.toContain('"style=');
    expect(styled).toContain("&quot;style=color:red");
    expect(renderNote('[h](https://x"onmouseover=alert)')).not.toMatch(/"onmouseover/i);
  });
});

describe("htmlToNote", () => {
  const roundTrip = (md: string) => htmlToNote(renderNote(md));

  it("round-trips the markdown subset (md → html → md)", () => {
    for (const md of [
      "plain text",
      "**bold**",
      "*italic*",
      "~~gone~~",
      "`code`",
      "# Title",
      "## Sub",
      "- one\n- two",
      "1. one\n2. two",
      "[site](https://x.test)",
      "para one\n\npara two",
      "![cat](https://x.test/c.png)",
    ]) {
      expect(roundTrip(md)).toBe(md);
    }
  });

  it("round-trips a pipe table (md → html → md) (#11)", () => {
    const md = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    expect(roundTrip(md)).toBe(md);
  });

  it("serialises a pasted/typed <table> back to pipe markdown (#11)", () => {
    const html =
      "<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>";
    expect(htmlToNote(html)).toBe("| A | B |\n| --- | --- |\n| 1 | 2 |");
  });

  it("serialises an <img> back to markdown (#11)", () => {
    expect(htmlToNote('<img src="https://x.test/c.png" alt="cat" />')).toBe(
      "![cat](https://x.test/c.png)",
    );
  });

  it("round-trips highlight + checklist (md → html → md) (#10)", () => {
    expect(roundTrip("a ==big== deal")).toBe("a ==big== deal");
    expect(roundTrip("- [ ] todo\n- [x] done")).toBe("- [ ] todo\n- [x] done");
  });

  it("serialises <mark> and a <pre> code block back to markdown (#10)", () => {
    expect(htmlToNote("<p>a <mark>hot</mark> take</p>")).toBe("a ==hot== take");
    expect(htmlToNote("<pre>const x = 1;</pre>")).toBe("```\nconst x = 1;\n```");
  });

  it("serialises a checklist <li> with an <input> checkbox back to task markdown (#10)", () => {
    const html =
      '<ul><li><input type="checkbox"> open</li><li><input type="checkbox" checked> shut</li></ul>';
    expect(htmlToNote(html)).toBe("- [ ] open\n- [x] shut");
  });

  it("normalises the tag soup execCommand emits (b/i/s/strike/div)", () => {
    expect(htmlToNote("<b>x</b>")).toBe("**x**");
    expect(htmlToNote("<i>x</i>")).toBe("*x*");
    expect(htmlToNote("<s>x</s>")).toBe("~~x~~");
    expect(htmlToNote("<strike>x</strike>")).toBe("~~x~~");
    expect(htmlToNote("<div>line one</div><div>line two</div>")).toBe("line one\n\nline two");
  });

  it("serialises an empty / whitespace editor to an empty string", () => {
    expect(htmlToNote("")).toBe("");
    expect(htmlToNote("<br>")).toBe("");
    expect(htmlToNote("<div><br></div>")).toBe("");
  });
});
