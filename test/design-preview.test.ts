import { describe, expect, it } from "vitest";
import { designPreviewModel } from "../src/designPreview";
import { designById } from "../src/designs";
import { themeById } from "../src/mindmap/theme";

// designPreviewModel is the pure thumbnail model for the design gallery (#5): themed colours + three
// branches drawn with the design's connector style.

describe("designPreviewModel", () => {
  it("uses the design's theme background, root colour, and palette", () => {
    const classic = designById("classic");
    if (!classic) throw new Error("classic design missing");
    const m = designPreviewModel(classic);
    const t = themeById(classic.themeId).theme;
    expect(m.bg).toBe(t.cssVar["--bgcolor"]);
    expect(m.rootBg).toBe(t.cssVar["--root-bgcolor"]);
    expect(m.branches).toHaveLength(3);
    expect(m.branches.map((b) => b.color)).toEqual(t.palette.slice(0, 3));
  });

  it("draws connector paths matching the design's connector style", () => {
    const organic = designById("classic"); // organic → quadratic curve
    const elbow = designById("blueprint"); // elbow → right-angle
    const straight = designById("diagram"); // straight → line
    if (!organic || !elbow || !straight) throw new Error("designs missing");
    expect(designPreviewModel(organic).branches[0].d).toContain("Q");
    const e = designPreviewModel(elbow).branches[0].d;
    expect(e).toContain("H");
    expect(e).toContain("V");
    expect(designPreviewModel(straight).branches[0].d).toContain("L");
  });
});
