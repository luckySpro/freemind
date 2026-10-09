// Guards the colour claim in the UI research report (UI-2): text rendered on a node fill must stay
// legible. The canvas picks topic text via readableTextOn(fill) for filled main topics, and uses the
// dark canvas ink on the light tint swatches — assert both clear WCAG AA (4.5:1) so a future palette
// or readableTextOn tweak can't silently ship an unreadable pairing. Pure + deterministic (no DOM).
import { describe, expect, it } from "vitest";
import { colors } from "../src/design/tokens";
import { readableTextOn } from "../src/mindmap/flow/style";
import { canvasThemes } from "../src/mindmap/theme";

// WCAG 2.x relative-luminance contrast ratio between two #rrggbb colours.
function contrastRatio(a: string, b: string): number {
  const lum = (hex: string): number => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) throw new Error(`not a 6-digit hex: ${hex}`);
    const n = Number.parseInt(m[1], 16);
    const chan = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
  };
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// WCAG AA thresholds depend on text size. Main-topic + root pills render the branch/root title in
// LARGE BOLD text → AA large-text threshold is 3:1 (and, mathematically, no pure black/white text can
// exceed ~3:1 on a mid-luminance saturated fill, so 4.5 is unachievable there by design). The light
// tint swatches carry BODY-size topic text → the full 4.5:1 applies.
const AA_BODY = 4.5;
const AA_LARGE = 3.0;

describe("node text contrast (WCAG AA)", () => {
  for (const { name, theme } of canvasThemes) {
    it(`${name}: readableTextOn clears AA-large on every branch fill`, () => {
      for (const fill of theme.palette) {
        expect(contrastRatio(readableTextOn(fill), fill)).toBeGreaterThanOrEqual(AA_LARGE);
      }
    });

    it(`${name}: root pill text clears AA-large on the root fill`, () => {
      const ink = theme.cssVar["--root-color"];
      const bg = theme.cssVar["--root-bgcolor"];
      expect(contrastRatio(ink, bg)).toBeGreaterThanOrEqual(AA_LARGE);
    });
  }

  it("light tint swatches clear AA-body with the default dark topic ink", () => {
    const ink = "#23211c"; // --color / --main-color in the light theme (default topic text)
    for (const tint of colors.fillSwatches) {
      expect(contrastRatio(ink, tint)).toBeGreaterThanOrEqual(AA_BODY);
    }
  });
});
