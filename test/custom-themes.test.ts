import { beforeEach, describe, expect, it } from "vitest";
import {
  type CustomTheme,
  customToCanvasTheme,
  getCustomThemes,
  newCustomTheme,
  saveCustomThemes,
} from "../src/store/customThemes";

const ct = (over: Partial<CustomTheme> = {}): CustomTheme => ({
  id: "custom-1",
  name: "Test",
  palette: ["#111111", "#222222", "#333333", "#444444", "#555555", "#666666"],
  background: "#ffffff",
  nodeFill: "#eeeeee",
  fontFamily: "",
  branchGrowth: "regular",
  ...over,
});

describe("customToCanvasTheme (C3)", () => {
  it("derives the cssVar block + palette from the knobs", () => {
    const t = customToCanvasTheme(ct());
    expect(t.id).toBe("custom-1");
    expect(t.name).toBe("Test");
    expect(t.theme.palette[0]).toBe("#111111");
    expect(t.theme.cssVar["--main-bgcolor"]).toBe("#ffffff"); // background
    expect(t.theme.cssVar["--bgcolor"]).toBe("#eeeeee"); // node fill
    expect(t.theme.cssVar["--root-bgcolor"]).toBe("#111111"); // palette[0] = root accent
    expect(t.theme.type).toBe("light"); // white background → light mode
    expect(t.theme.cssVar["--main-color"]).toBe("#23211c"); // dark ink on a light background
  });

  it("switches to dark mode + light ink on a dark background", () => {
    const t = customToCanvasTheme(ct({ background: "#101018" }));
    expect(t.theme.type).toBe("dark");
    expect(t.theme.cssVar["--main-color"]).toBe("#f4f2ea"); // light ink on a dark background
  });
});

describe("get / save custom themes (C3)", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips and tolerates a missing / corrupt entry", () => {
    expect(getCustomThemes()).toEqual([]);
    saveCustomThemes([ct()]);
    expect(getCustomThemes().map((t) => t.id)).toEqual(["custom-1"]);
    localStorage.setItem("mindmap-custom-themes", "{not json");
    expect(getCustomThemes()).toEqual([]);
    localStorage.setItem("mindmap-custom-themes", JSON.stringify({ nope: true }));
    expect(getCustomThemes()).toEqual([]);
  });
});

describe("newCustomTheme (C3)", () => {
  it("seeds a fresh, id-prefixed six-colour theme", () => {
    const t = newCustomTheme("Mine");
    expect(t.id.startsWith("custom-")).toBe(true);
    expect(t.name).toBe("Mine");
    expect(t.palette).toHaveLength(6);
    expect(newCustomTheme("  ").name).toBe("My theme"); // blank falls back
  });
});
