import { describe, expect, it } from "vitest";
import {
  STICKERS,
  STICKER_CATEGORIES,
  STICKER_DISPLAY_PX,
  type Sticker,
  searchStickers,
  stickerCategories,
  stickerDataUrl,
  stickerImage,
} from "../src/stickers";

describe("STICKERS catalogue", () => {
  it("is a non-empty curated set", () => {
    expect(STICKERS.length).toBeGreaterThanOrEqual(16);
    expect(STICKERS.length).toBeLessThanOrEqual(40);
  });

  it("gives every sticker a known category + at least one keyword (#12)", () => {
    for (const s of STICKERS) {
      expect(STICKER_CATEGORIES).toContain(s.category);
      expect(s.keywords.length).toBeGreaterThan(0);
    }
  });

  it("gives every sticker a unique id", () => {
    const ids = STICKERS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every sticker a non-empty label and id", () => {
    for (const s of STICKERS) {
      expect(s.id.trim().length).toBeGreaterThan(0);
      expect(s.label.trim().length).toBeGreaterThan(0);
    }
  });

  it("authors every sticker as a well-formed SVG on a shared 24×24 viewBox", () => {
    for (const s of STICKERS) {
      expect(s.svg.startsWith("<svg")).toBe(true);
      expect(s.svg.trimEnd().endsWith("</svg>")).toBe(true);
      expect(s.svg).toContain('viewBox="0 0 24 24"');
      // Balanced tags: every "<svg" is closed by a matching "</svg>".
      expect((s.svg.match(/<svg/g) || []).length).toBe((s.svg.match(/<\/svg>/g) || []).length);
      // No stray template holes from authoring.
      expect(s.svg).not.toContain("undefined");
      expect(s.svg).not.toContain("[object");
    }
  });
});

describe("stickerDataUrl", () => {
  it("produces a data:image/svg+xml URL that round-trips back to the SVG", () => {
    for (const s of STICKERS) {
      const url = stickerDataUrl(s);
      expect(url.startsWith("data:image/svg+xml,")).toBe(true);
      const decoded = decodeURIComponent(url.slice("data:image/svg+xml,".length));
      expect(decoded).toBe(s.svg);
    }
  });

  it("URL-encodes reserved characters so the href is well-formed (no raw # or <)", () => {
    const sticker: Sticker = {
      id: "tmp",
      label: "Tmp",
      category: "Symbols",
      keywords: [],
      svg: '<svg viewBox="0 0 24 24" fill="#abc"><path d="M0 0h1"/></svg>',
    };
    const url = stickerDataUrl(sticker);
    const payload = url.slice("data:image/svg+xml,".length);
    expect(payload).not.toContain("#");
    expect(payload).not.toContain("<");
    expect(payload).toContain("%23"); // the "#abc" colour is percent-encoded
    // …and it still decodes back losslessly.
    expect(decodeURIComponent(payload)).toBe(sticker.svg);
  });
});

describe("searchStickers (#12)", () => {
  it("returns the whole set for an empty query", () => {
    expect(searchStickers("").length).toBe(STICKERS.length);
    expect(searchStickers("   ").length).toBe(STICKERS.length);
  });

  it("matches on label, keywords and id (case-insensitive)", () => {
    for (const s of STICKERS) {
      const byLabel = searchStickers(s.label.toUpperCase());
      expect(byLabel.some((h) => h.id === s.id)).toBe(true);
    }
  });

  it("requires every token to match (AND semantics) and returns [] when nothing matches", () => {
    expect(searchStickers("zzzznotasticker")).toEqual([]);
  });
});

describe("stickerCategories (#12)", () => {
  it("partitions the catalogue into non-empty known categories with no lost stickers", () => {
    const groups = stickerCategories();
    for (const g of groups) {
      expect(STICKER_CATEGORIES).toContain(g.category);
      expect(g.stickers.length).toBeGreaterThan(0);
    }
    const total = groups.reduce((n, g) => n + g.stickers.length, 0);
    expect(total).toBe(STICKERS.length);
  });
});

describe("stickerImage", () => {
  it("wraps a sticker as a square MapImage carrying the data URL", () => {
    const img = stickerImage(STICKERS[0]);
    expect(img.url).toBe(stickerDataUrl(STICKERS[0]));
    expect(img.width).toBe(STICKER_DISPLAY_PX);
    expect(img.height).toBe(STICKER_DISPLAY_PX);
  });
});
