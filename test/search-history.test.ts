// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { loadHistory, pushHistory, recordSearch } from "../src/io/searchHistory";

// Recent-searches history for Find & Replace (item 18): pure list logic + the localStorage round-trip.

describe("pushHistory", () => {
  it("adds a query to the front, most-recent-first", () => {
    expect(pushHistory(["a", "b"], "c")).toEqual(["c", "a", "b"]);
  });

  it("de-duplicates (moving a repeated query back to the front)", () => {
    expect(pushHistory(["a", "b", "c"], "b")).toEqual(["b", "a", "c"]);
  });

  it("ignores a blank / whitespace query", () => {
    expect(pushHistory(["a"], "   ")).toEqual(["a"]);
    expect(pushHistory(["a"], "")).toEqual(["a"]);
  });

  it("trims the query and caps the list at the limit", () => {
    expect(pushHistory(["a"], "  x  ")).toEqual(["x", "a"]);
    expect(pushHistory(["1", "2", "3"], "0", 3)).toEqual(["0", "1", "2"]);
  });
});

describe("recordSearch / loadHistory (localStorage round-trip)", () => {
  beforeEach(() => localStorage.clear());

  it("persists and reads back the history most-recent-first", () => {
    recordSearch("first");
    recordSearch("second");
    expect(loadHistory()).toEqual(["second", "first"]);
    // A repeat moves it to the front without duplicating.
    recordSearch("first");
    expect(loadHistory()).toEqual(["first", "second"]);
  });

  it("returns [] for an empty or corrupt store", () => {
    expect(loadHistory()).toEqual([]);
    localStorage.setItem("mindmap-search-history", "{not json");
    expect(loadHistory()).toEqual([]);
  });
});
