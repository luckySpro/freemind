import { describe, expect, it } from "vitest";
import { DESIGNS, designById } from "../src/designs";
import { themeById } from "../src/mindmap/theme";

// Design presets are a curated bundle over the existing theme + connector controls — guard that each
// references a real theme and a valid connector style, and that lookup works.
describe("designs", () => {
  const CONNECTORS = new Set(["organic", "curved", "elbow", "straight"]);
  const GROWTHS = new Set(["fine", "regular", "bold"]);

  it("every design has a unique id, a real theme, a valid connector style + growth weight", () => {
    const ids = new Set<string>();
    for (const d of DESIGNS) {
      expect(ids.has(d.id), d.id).toBe(false);
      ids.add(d.id);
      expect(d.name.length).toBeGreaterThan(0);
      expect(CONNECTORS.has(d.connectorStyle), d.connectorStyle).toBe(true);
      expect(GROWTHS.has(d.branchGrowth), d.branchGrowth).toBe(true);
      // themeById falls back to the default theme for unknown ids — assert the id actually resolves.
      expect(themeById(d.themeId).id).toBe(d.themeId);
    }
  });

  it("designById finds a preset or returns null", () => {
    expect(designById("classic")?.name).toBe("Classic");
    expect(designById("nope")).toBeNull();
  });
});
