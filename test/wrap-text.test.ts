import { describe, expect, it } from "vitest";
import { widthUnits, wrapText } from "../src/mindmap/flow/text";

// Shared word-wrap used by the exporter + the layout estimate so a long label stays inside its box
// (canvas == export) and the reserved height matches the wrapped line count.
describe("wrapText", () => {
  it("keeps short text on one line", () => {
    expect(wrapText("Hi there", 200, 16)).toEqual(["Hi there"]);
  });

  it("wraps long text to multiple lines that fit the width", () => {
    const lines = wrapText("the quick brown fox jumps over the lazy dog", 80, 16);
    expect(lines.length).toBeGreaterThan(1);
    // ~9 chars per 80px line at 16px; allow a little slack for word boundaries
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(12);
  });

  it("respects explicit newlines", () => {
    expect(wrapText("a\nb", 200, 16)).toEqual(["a", "b"]);
  });

  it("hard-splits a single word longer than the line, losing no characters", () => {
    const lines = wrapText("supercalifragilistic", 40, 16);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join("")).toBe("supercalifragilistic");
  });

  it("always returns at least one (possibly empty) line", () => {
    expect(wrapText("", 100, 16)).toEqual([""]);
  });
});

// Non-Latin coverage. The width estimate is a character count times a constant, which silently
// assumed every glyph was Latin-width: CJK is ~1.8x that, so exported text overflowed its box by
// 38-75% and the layout reserved about half the height it needed.
describe("widthUnits", () => {
  it("counts a pure-ASCII string as exactly its length", () => {
    // Load-bearing: every width heuristic on the canvas + in the exporter is calibrated against
    // `string.length`, and the byte-identical export snapshots pin that calibration. If this drifts,
    // Latin geometry moves and the canvas == export invariant breaks.
    for (const s of ["", "a", "Hi there", "Quarterly objectives for the launch programme"])
      expect(widthUnits(s)).toBe(s.length);
  });

  it("charges a full-width CJK glyph ~1.8 narrow characters", () => {
    expect(widthUnits("第")).toBeCloseTo(1 / 0.55, 5);
    expect(widthUnits("日本語")).toBeCloseTo(3 / 0.55, 5);
    // kana and Hangul are full-width too
    expect(widthUnits("あ")).toBeCloseTo(widthUnits("第"), 5);
    expect(widthUnits("분")).toBeCloseTo(widthUnits("第"), 5);
  });

  it("counts an emoji once, not twice, and charges it its real 1.373em", () => {
    // "📅" is a surrogate pair: `.length` is 2, so it used to be charged 2 narrow characters.
    expect("📅".length).toBe(2);
    expect(widthUnits("📅")).toBeCloseTo(1.373 / 0.55, 5);
  });

  it("treats every alphabetic script as narrow", () => {
    // Cyrillic/Greek/Hebrew/Arabic/Thai prose all measure under 0.55em per character, so they share
    // the Latin class — no per-script table needed beyond full-width.
    for (const s of ["Квартальные", "Τριμηνιαίοι", "תוכנית", "خطة", "แผนการ"])
      expect(widthUnits(s)).toBe([...s].length);
  });
});

describe("wrapText with non-Latin text", () => {
  const budgetUnits = (maxWidth: number, fontSize: number) =>
    Math.max(1, Math.floor(maxWidth / (fontSize * 0.55)));

  it("keeps every wrapped CJK line inside the width budget", () => {
    const maxWidth = 220;
    const fontSize = 16;
    const lines = wrapText(
      "第三四半期の製品ローンチ計画とマーケティング戦略について",
      maxWidth,
      fontSize,
    );
    // The regression: charging CJK at the Latin rate produced 2 lines that each ran ~75% past the box.
    for (const l of lines)
      expect(widthUnits(l)).toBeLessThanOrEqual(budgetUnits(maxWidth, fontSize));
    expect(lines.length).toBeGreaterThan(2);
  });

  it("reserves more lines for CJK than for the same character count in Latin", () => {
    const cjk = wrapText("季度目标产品发布计划与市场营销战略的详细说明", 220, 16);
    const latin = wrapText("x".repeat(22), 220, 16);
    expect(cjk.length).toBeGreaterThan(latin.length);
  });

  it("splits space-free CJK text without losing characters", () => {
    const text = "季度目标产品发布计划与市场营销战略的详细说明";
    expect(wrapText(text, 120, 16).join("")).toBe(text);
  });

  it("never splits a surrogate pair when hard-splitting", () => {
    // Emoji markers ship with the app, so this path is reachable with real content. A code-unit
    // slice cut pairs in half and emitted lone surrogates (mojibake) into the SVG.
    const lines = wrapText("🎯🚀💡🔥🌟🎨🧠📊🔧⚡🎭🏆🌈🔮".repeat(2), 60, 16);
    const lone = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/;
    for (const l of lines) expect(lone.test(l)).toBe(false);
    expect(lines.join("")).toBe("🎯🚀💡🔥🌟🎨🧠📊🔧⚡🎭🏆🌈🔮".repeat(2));
  });

  it("terminates on a single glyph wider than the whole line", () => {
    expect(wrapText("第", 4, 16)).toEqual(["第"]);
  });
});
