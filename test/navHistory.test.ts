import { beforeEach, describe, expect, it } from "vitest";
import { NavHistory, type NavPoint } from "../src/navHistory";

const p = (mapId: string, nodeId: string | null = null): NavPoint => ({ mapId, nodeId });

describe("NavHistory", () => {
  let h: NavHistory;
  beforeEach(() => {
    h = new NavHistory();
  });

  it("starts empty — nowhere to go", () => {
    expect(h.canBack).toBe(false);
    expect(h.canForward).toBe(false);
    expect(h.current()).toBeNull();
    expect(h.back()).toBeNull();
    expect(h.forward()).toBeNull();
  });

  it("walks back and forward through visited places", () => {
    h.visit(p("m", "a"));
    h.visit(p("m", "b"));
    h.visit(p("m", "c"));
    expect(h.current()).toEqual(p("m", "c"));
    expect(h.canBack).toBe(true);
    expect(h.canForward).toBe(false);

    expect(h.back()).toEqual(p("m", "b"));
    expect(h.back()).toEqual(p("m", "a"));
    expect(h.canBack).toBe(false);
    expect(h.back()).toBeNull();

    expect(h.forward()).toEqual(p("m", "b"));
    expect(h.forward()).toEqual(p("m", "c"));
    expect(h.canForward).toBe(false);
  });

  it("ignores a repeat visit to the current place", () => {
    h.visit(p("m", "a"));
    h.visit(p("m", "a"));
    expect(h.length).toBe(1);
    expect(h.canBack).toBe(false);
  });

  it("truncates forward history when visiting a new place after going back", () => {
    h.visit(p("m", "a"));
    h.visit(p("m", "b"));
    h.visit(p("m", "c"));
    h.back(); // at b
    h.visit(p("m", "d")); // branch: c is discarded
    expect(h.current()).toEqual(p("m", "d"));
    expect(h.canForward).toBe(false);
    expect(h.back()).toEqual(p("m", "b"));
  });

  it("tracks the map id too, so back can cross maps", () => {
    h.visit(p("m1", "a"));
    h.visit(p("m2", "x"));
    expect(h.back()).toEqual(p("m1", "a"));
    expect(h.forward()).toEqual(p("m2", "x"));
  });

  it("caps the stack at 100, dropping the oldest", () => {
    for (let i = 0; i < 150; i++) h.visit(p("m", `n${i}`));
    expect(h.length).toBe(100);
    // The current place is the newest; walking all the way back lands on n50, not n0.
    while (h.canBack) h.back();
    expect(h.current()).toEqual(p("m", "n50"));
  });
});
