import { describe, expect, it } from "vitest";
import {
  WRAP_MAX,
  WRAP_MIN,
  snapWrapWidth,
  styleToWrapWidth,
  wrapWidthLabel,
  wrapWidthToStyle,
} from "../src/wrapWidth";

// The wrap-width scale behind the inspector's Wrap slider — parse/serialise round-trips, snap-to-preset,
// clamping, and the "None" (max-end) mapping. Pure, so it pins the slider's behaviour exactly.

describe("styleToWrapWidth", () => {
  it("parses a px string and clamps to the slider range", () => {
    expect(styleToWrapWidth("160px")).toBe(160);
    expect(styleToWrapWidth("220px")).toBe(220);
    expect(styleToWrapWidth("100px")).toBe(WRAP_MIN); // below floor → clamp
    expect(styleToWrapWidth("999px")).toBe(WRAP_MAX); // above cap → clamp
  });
  it("treats empty / unset / unparseable as None (the max end)", () => {
    expect(styleToWrapWidth("")).toBe(WRAP_MAX);
    expect(styleToWrapWidth(undefined)).toBe(WRAP_MAX);
    expect(styleToWrapWidth("auto")).toBe(WRAP_MAX);
  });
});

describe("wrapWidthToStyle", () => {
  it("serialises a width, with the max end clearing the cap (None)", () => {
    expect(wrapWidthToStyle(160)).toBe("160px");
    expect(wrapWidthToStyle(300)).toBe("300px");
    expect(wrapWidthToStyle(WRAP_MAX)).toBe("");
    expect(wrapWidthToStyle(340)).toBe(""); // at/over the cap → None
  });
  it("round-trips style → px → style", () => {
    for (const s of ["160px", "220px", "300px", ""]) {
      expect(wrapWidthToStyle(styleToWrapWidth(s))).toBe(s);
    }
  });
});

describe("snapWrapWidth", () => {
  it("snaps to the nearest preset (or None) within tolerance", () => {
    expect(snapWrapWidth(162)).toBe(160);
    expect(snapWrapWidth(218)).toBe(220);
    expect(snapWrapWidth(305)).toBe(300);
    expect(snapWrapWidth(316)).toBe(WRAP_MAX); // near the None end
    expect(snapWrapWidth(152)).toBe(160); // exactly on the 8px boundary
  });
  it("leaves a free value when no tick is within tolerance", () => {
    expect(snapWrapWidth(240)).toBe(240);
    expect(snapWrapWidth(191)).toBe(191);
    expect(snapWrapWidth(151)).toBe(151); // 9px from 160 → free
  });
  it("clamps out-of-range input", () => {
    expect(snapWrapWidth(50)).toBe(WRAP_MIN);
    expect(snapWrapWidth(500)).toBe(WRAP_MAX);
  });
});

describe("wrapWidthLabel", () => {
  it("names the presets, None at the max, and raw px in between", () => {
    expect(wrapWidthLabel(160)).toBe("Narrow");
    expect(wrapWidthLabel(220)).toBe("Medium");
    expect(wrapWidthLabel(300)).toBe("Wide");
    expect(wrapWidthLabel(WRAP_MAX)).toBe("None");
    expect(wrapWidthLabel(184)).toBe("184px");
  });
});
