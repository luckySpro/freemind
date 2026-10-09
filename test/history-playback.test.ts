import { describe, expect, it } from "vitest";
import { clampIndex, nextPlaybackIndex, togglePlay } from "../src/historyPlayback";

describe("clampIndex", () => {
  it("keeps an in-range index", () => {
    expect(clampIndex(2, 5)).toBe(2);
  });

  it("clamps below 0 and above count-1", () => {
    expect(clampIndex(-3, 5)).toBe(0);
    expect(clampIndex(9, 5)).toBe(4);
  });

  it("truncates fractions and handles an empty timeline", () => {
    expect(clampIndex(2.9, 5)).toBe(2);
    expect(clampIndex(3, 0)).toBe(0);
  });
});

describe("nextPlaybackIndex", () => {
  it("advances one frame", () => {
    expect(nextPlaybackIndex(0, 4)).toBe(1);
    expect(nextPlaybackIndex(2, 4)).toBe(3);
  });

  it("returns null at (or past) the last frame — stop, don't loop", () => {
    expect(nextPlaybackIndex(3, 4)).toBeNull();
    expect(nextPlaybackIndex(0, 0)).toBeNull();
  });
});

describe("togglePlay", () => {
  it("pauses when playing", () => {
    expect(togglePlay(2, 5, true)).toEqual({ index: 2, playing: false });
  });

  it("plays from where it is when stopped mid-timeline", () => {
    expect(togglePlay(2, 5, false)).toEqual({ index: 2, playing: true });
  });

  it("rewinds to the start when pressing play at the end", () => {
    expect(togglePlay(4, 5, false)).toEqual({ index: 0, playing: true });
  });
});
