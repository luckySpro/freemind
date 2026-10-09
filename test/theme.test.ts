import { describe, expect, it } from "vitest";
import { canvasThemes, themeById } from "../src/mindmap/theme";

describe("canvas theme gallery", () => {
  it("offers the four documented themes, each well-formed", () => {
    expect(canvasThemes.map((t) => t.id)).toEqual(["light", "dark", "ocean", "sunset"]);
    for (const t of canvasThemes) {
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.theme.palette.length).toBeGreaterThanOrEqual(6); // one hue per main branch
      expect(["light", "dark"]).toContain(t.theme.type);
      expect(t.theme.cssVar["--root-bgcolor"]).toMatch(/^#/);
    }
  });

  it("resolves themeById, falling back to the first theme on an unknown id", () => {
    expect(themeById("ocean").name).toBe("Ocean");
    expect(themeById("dark").theme.type).toBe("dark");
    expect(themeById("does-not-exist").id).toBe(canvasThemes[0].id);
  });
});
