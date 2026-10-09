import { describe, expect, it } from "vitest";
import { buildTemplate, insertableTemplates, templateSubtree, templates } from "../src/templates";

// templates.ts was on the dashboard's least-covered list — pure logic, worth pinning.

describe("buildTemplate", () => {
  it("builds each catalogued template into a valid doc", () => {
    for (const t of templates) {
      const doc = buildTemplate(t.id);
      expect(doc.schemaVersion).toBe(1);
      expect(doc.id).toBeTruthy();
      expect(doc.root.id).toBe("root");
      expect(doc.meta?.source).toBe("new");
      expect(Array.isArray(doc.root.children)).toBe(true);
    }
  });

  it("gives the expected starter structure per template", () => {
    expect(buildTemplate("blank").root.children).toHaveLength(0);
    expect(buildTemplate("brainstorm").root.children.map((c) => c.topic)).toEqual([
      "Who",
      "What",
      "Why",
      "How",
      "When",
      "Where",
    ]);
    expect(buildTemplate("swot").root.children).toHaveLength(4);
    expect(buildTemplate("project").root.children).toHaveLength(5);
  });

  it("includes the analysis + knowledge/sharing templates", () => {
    const ids = templates.map((t) => t.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "pestle",
        "fishbone",
        "okrs",
        "essay",
        "presentation",
        "lean-canvas",
        "persona",
      ]),
    );
    expect(buildTemplate("pestle").root.children.map((c) => c.topic)).toEqual([
      "Political",
      "Economic",
      "Social",
      "Technological",
      "Legal",
      "Environmental",
    ]);
    expect(buildTemplate("fishbone").root.children).toHaveLength(6); // the 6M cause categories
    expect(buildTemplate("okrs").root.children.map((c) => c.topic)).toContain("Key result 1");
    expect(buildTemplate("lean-canvas").root.children).toHaveLength(9); // the 9 canvas blocks
    expect(buildTemplate("presentation").root.children.map((c) => c.topic)).toContain(
      "Call to action",
    );
  });

  it("includes the structured-thinking templates", () => {
    const ids = templates.map((t) => t.id);
    expect(ids).toEqual(
      expect.arrayContaining(["five-whys", "decision", "retrospective", "meeting", "pre-mortem"]),
    );
  });

  it("builds the 5 Whys template as a nested causal chain", () => {
    const root = buildTemplate("five-whys").root;
    let node = root.children[0];
    expect(node.topic).toBe("Problem statement");
    const chain: string[] = [];
    while (node.children.length > 0) {
      node = node.children[0];
      chain.push(node.topic);
    }
    expect(chain).toHaveLength(5);
    expect(chain[4]).toContain("root cause");
  });

  it("gives the expected top-level structure for the new flat templates", () => {
    expect(buildTemplate("decision").root.children.map((c) => c.topic)).toContain("Pros");
    expect(buildTemplate("retrospective").root.children.map((c) => c.topic)).toEqual([
      "Start",
      "Stop",
      "Continue",
      "Action items",
    ]);
    expect(buildTemplate("pre-mortem").root.children).toHaveLength(5);
  });

  it("falls back to the first template for an unknown id", () => {
    const fallback = buildTemplate("does-not-exist");
    const blank = buildTemplate(templates[0].id);
    expect(fallback.root.children).toHaveLength(blank.root.children.length);
    expect(fallback.title).toBe(blank.title);
  });

  it("mints a fresh id per build (no shared reference)", () => {
    expect(buildTemplate("blank").id).not.toBe(buildTemplate("blank").id);
  });
});

describe("insert-structure helpers (A4)", () => {
  it("templateSubtree returns a template's top branches (the root is dropped)", () => {
    expect(templateSubtree("swot").map((n) => n.topic)).toEqual(
      buildTemplate("swot").root.children.map((n) => n.topic),
    );
    expect(templateSubtree("swot")).toHaveLength(4);
  });

  it("insertableTemplates excludes the empty Blank template", () => {
    expect(insertableTemplates.some((t) => t.id === "blank")).toBe(false);
    expect(insertableTemplates.length).toBe(templates.length - 1);
  });
});
