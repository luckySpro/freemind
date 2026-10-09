import { describe, expect, it } from "vitest";
import { safeFileStem } from "../src/io/fileName";

// One filename policy for every save-to-disk path. The Start-screen download used to run titles
// through an ASCII-only slug, which destroyed any title that wasn't English.
describe("safeFileStem", () => {
  it("keeps non-ASCII titles intact", () => {
    // The regression: /[^a-z0-9]+/g turned these into "rsplan-for-teamet", "produkt-bersicht",
    // and (with nothing left at all) the bare fallback.
    expect(safeFileStem("Årsplan for Ø-teamet")).toBe("Årsplan for Ø-teamet");
    expect(safeFileStem("Produktübersicht")).toBe("Produktübersicht");
    expect(safeFileStem("プロジェクト計画")).toBe("プロジェクト計画");
    expect(safeFileStem("خطة المشروع")).toBe("خطة المشروع");
  });

  it("replaces only characters the filesystem rejects", () => {
    expect(safeFileStem('a<b>c:d"e/f\\g|h?i*j')).toBe("a_b_c_d_e_f_g_h_i_j");
  });

  it("collapses whitespace and trims", () => {
    expect(safeFileStem("  spaced   out  ")).toBe("spaced out");
  });

  it("drops a leading dot so the file isn't hidden or extension-only", () => {
    expect(safeFileStem(".gitignore")).toBe("gitignore");
  });

  it("caps length at 80 characters", () => {
    expect(safeFileStem("x".repeat(200))).toHaveLength(80);
  });

  it("falls back when nothing usable survives", () => {
    expect(safeFileStem("")).toBe("mindmap");
    expect(safeFileStem("   ")).toBe("mindmap");
    expect(safeFileStem("///", "map")).toBe("_");
    expect(safeFileStem("", "map")).toBe("map");
  });
});
