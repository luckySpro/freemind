import { describe, expect, it } from "vitest";
import { escapeHtmlAttr, escapeHtmlContent, escapeHtmlScriptSafe } from "../src/io/htmlEscape";

// The shared HTML escapers are security-critical (used by the deck / standalone-HTML / interactive-HTML /
// notes-appendix exporters). Lock the per-context escape set + the widening content < attr < scriptSafe
// ladder so nobody weakens one.

describe("HTML escapers", () => {
  it("escapeHtmlContent escapes & < > only (quotes + slash pass through)", () => {
    expect(escapeHtmlContent("a & b < c > d")).toBe("a &amp; b &lt; c &gt; d");
    expect(escapeHtmlContent(`"'/`)).toBe(`"'/`);
    expect(escapeHtmlContent("")).toBe("");
    // each original char is replaced once — the emitted entities aren't re-escaped
    expect(escapeHtmlContent("<&>")).toBe("&lt;&amp;&gt;");
  });

  it("escapeHtmlAttr adds \" and ' on top of the content set (but not /)", () => {
    expect(escapeHtmlAttr(`& < > " '`)).toBe("&amp; &lt; &gt; &quot; &#39;");
    expect(escapeHtmlAttr("/")).toBe("/");
  });

  it("escapeHtmlScriptSafe also escapes / so an embedded </script> can't break out", () => {
    expect(escapeHtmlScriptSafe("</script>")).toBe("&lt;&#47;script&gt;");
    expect(escapeHtmlScriptSafe(`& < > " ' /`)).toBe("&amp; &lt; &gt; &quot; &#39; &#47;");
  });

  it("the three form a widening ladder — each escapes a superset of the previous", () => {
    const s = `& < > " ' /`;
    const escaped = (out: string) => (out.match(/&[a-z#0-9]+;/gi) ?? []).length;
    const content = escaped(escapeHtmlContent(s));
    const attr = escaped(escapeHtmlAttr(s));
    const script = escaped(escapeHtmlScriptSafe(s));
    expect(content).toBe(3); // & < >
    expect(attr).toBe(5); // + " '
    expect(script).toBe(6); // + /
    expect(content).toBeLessThanOrEqual(attr);
    expect(attr).toBeLessThanOrEqual(script);
  });
});
