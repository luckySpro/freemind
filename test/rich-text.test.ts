// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { hasFormatting, richToPlain, sanitizeRich } from "../src/io/richText";
import { setTopicRich } from "../src/mindmap/flow/ops";
import type { MindMapDoc } from "../src/model/types";

describe("richText sanitiser", () => {
  it("keeps allowlisted inline formatting verbatim", () => {
    expect(sanitizeRich("<b>bold</b> <i>it</i> <u>u</u> <s>s</s>")).toBe(
      "<b>bold</b> <i>it</i> <u>u</u> <s>s</s>",
    );
  });

  it("keeps a span's safe style, drops disallowed props", () => {
    expect(sanitizeRich('<span style="font-weight: 700; color: #e23">x</span>')).toBe(
      '<span style="font-weight: 700; color: #e23">x</span>',
    );
    // position is not allowlisted; color:red is a safe keyword
    expect(sanitizeRich('<span style="color: red; position: fixed">x</span>')).toBe(
      '<span style="color: red">x</span>',
    );
  });

  it("drops a dangerous style value (url/expression), leaving a bare element", () => {
    expect(sanitizeRich('<span style="color: url(javascript:alert(1))">x</span>')).toBe(
      "<span>x</span>",
    );
  });

  it("drops scripts/styles with their content (no source leaks as text)", () => {
    expect(sanitizeRich("<script>alert(1)</script>hi")).toBe("hi");
    expect(sanitizeRich("<style>body{}</style>hi")).toBe("hi");
  });

  it("unwraps disallowed elements but keeps their text + nested formatting", () => {
    expect(sanitizeRich('<div onclick="x()">deep <b>bold</b></div>')).toBe("deep <b>bold</b>");
    expect(sanitizeRich('<a href="javascript:alert(1)">link</a>')).toBe("link");
    expect(sanitizeRich('<img src=x onerror="alert(1)">hi')).toBe("hi");
  });

  it("escapes text content", () => {
    expect(sanitizeRich("Tom & Jerry")).toBe("Tom &amp; Jerry");
  });

  it("richToPlain strips tags and normalises nbsp", () => {
    expect(richToPlain("<b>Hello</b>&nbsp;world")).toBe("Hello world");
    expect(richToPlain("plain")).toBe("plain");
  });

  it("hasFormatting distinguishes formatted from plain", () => {
    expect(hasFormatting("<b>x</b>")).toBe(true);
    expect(hasFormatting("plain text")).toBe(false);
  });
});

describe("setTopicRich op", () => {
  const doc: MindMapDoc = {
    schemaVersion: 1,
    id: "d",
    title: "Root",
    root: { id: "r", topic: "Root", children: [{ id: "a", topic: "A", children: [] }] },
  };

  it("sets the plain topic + the rich HTML together", () => {
    const a = setTopicRich(doc, "a", "<b>Bold</b> A", "Bold A").doc.root.children[0];
    expect(a.topic).toBe("Bold A");
    expect(a.topicRich).toBe("<b>Bold</b> A");
  });

  it("clears topicRich when rich is undefined (reverted to plain)", () => {
    const withRich = setTopicRich(doc, "a", "<b>x</b>", "x").doc;
    const reverted = setTopicRich(withRich, "a", undefined, "x").doc;
    expect(reverted.root.children[0].topicRich).toBeUndefined();
    expect(reverted.root.children[0].topic).toBe("x");
  });

  it("renaming the root via rich-text updates the doc title", () => {
    expect(setTopicRich(doc, "r", undefined, "Renamed").doc.title).toBe("Renamed");
  });
});
