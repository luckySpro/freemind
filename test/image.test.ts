// @vitest-environment jsdom
//
// imageSizing is pure scale math (no browser) and is covered exhaustively below. fileToMapImage also
// needs a real FileReader (jsdom has one) plus an HTMLImageElement that reports naturalWidth/Height
// and a canvas 2D context — neither of which jsdom implements. We mock just those two seams (Image
// load + canvas getContext/toDataURL) so the function's own branching (no-downscale passthrough,
// downscale re-encode, decode error) is exercised honestly; the math itself is asserted via
// imageSizing directly.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fileToMapImage, imageSizing } from "../src/io/image";

// Pure scale math for node images: downscale the stored bitmap to <=800px on the long
// side, cap the on-canvas display width at 220px, preserve aspect ratio, floor at 1px.
describe("imageSizing", () => {
  it("leaves a small landscape image at full store size, caps display width", () => {
    expect(imageSizing(400, 300)).toEqual({
      storeW: 400,
      storeH: 300,
      downscaled: false,
      displayW: 220,
      displayH: 165,
    });
  });

  it("downscales a large image to 800px on the long side", () => {
    expect(imageSizing(1600, 1200)).toEqual({
      storeW: 800,
      storeH: 600,
      downscaled: true,
      displayW: 220,
      displayH: 165,
    });
  });

  it("downscales by the taller side for a portrait image", () => {
    expect(imageSizing(600, 1200)).toEqual({
      storeW: 400,
      storeH: 800,
      downscaled: true,
      displayW: 220,
      displayH: 440,
    });
  });

  it("never enlarges a tiny image (display caps width, doesn't upscale)", () => {
    expect(imageSizing(50, 50)).toEqual({
      storeW: 50,
      storeH: 50,
      downscaled: false,
      displayW: 50,
      displayH: 50,
    });
  });

  it("floors degenerate 0x0 dimensions at 1px instead of dividing by zero", () => {
    expect(imageSizing(0, 0)).toEqual({
      storeW: 1,
      storeH: 1,
      downscaled: false,
      displayW: 1,
      displayH: 1,
    });
  });

  it("preserves aspect ratio within rounding at the store cap", () => {
    const { storeW, storeH } = imageSizing(1000, 750); // 4:3
    expect(storeW).toBe(800);
    expect(storeH).toBe(600);
    expect(Math.abs(storeW / storeH - 4 / 3)).toBeLessThan(0.01);
  });

  it("a very wide panorama caps the long side and still floors the short side at >=1px", () => {
    const s = imageSizing(8000, 10); // 800:1 aspect
    expect(s.storeW).toBe(800);
    expect(s.storeH).toBe(1); // 10 * (800/8000) = 1, floored
    expect(s.downscaled).toBe(true);
    expect(s.displayW).toBe(220);
    expect(s.displayH).toBe(1);
  });
});

// --- fileToMapImage: mock the two browser seams (Image decode + canvas) -------------------------
describe("fileToMapImage", () => {
  let naturalW = 0;
  let naturalH = 0;
  let shouldError = false;

  beforeEach(() => {
    // A fake Image: setting `src` schedules onload (or onerror) on a microtask, reporting the
    // naturalW/H the test set. This stands in for jsdom's no-op image decode.
    class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 0;
      naturalHeight = 0;
      set src(_v: string) {
        queueMicrotask(() => {
          if (shouldError) {
            this.onerror?.();
          } else {
            this.naturalWidth = naturalW;
            this.naturalHeight = naturalH;
            this.onload?.();
          }
        });
      }
    }
    vi.stubGlobal("Image", FakeImage);

    // canvas 2D context: jsdom returns null. Provide a no-op ctx + a sentinel toDataURL so the
    // re-encode branch produces a distinguishable output.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: () => {},
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      "data:image/png;base64,RESIZED",
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    shouldError = false;
  });

  const pngFile = () => new File(["pretend-bytes"], "pic.png", { type: "image/png" });

  it("keeps the original data URL when the image is small enough (no downscale, no re-encode)", async () => {
    naturalW = 400;
    naturalH = 300;
    const img = await fileToMapImage(pngFile());
    expect(img.url.startsWith("data:image/png")).toBe(true);
    expect(img.url).not.toContain("RESIZED"); // canvas re-encode was skipped
    expect(img.width).toBe(220); // display width cap
    expect(img.height).toBe(165);
  });

  it("re-encodes through the canvas when the image is downscaled", async () => {
    naturalW = 1600;
    naturalH = 1200;
    const img = await fileToMapImage(pngFile());
    expect(img.url).toBe("data:image/png;base64,RESIZED"); // came from canvas.toDataURL
    expect(img.width).toBe(220);
    expect(img.height).toBe(165);
  });

  it("rejects when the image fails to decode", async () => {
    shouldError = true;
    await expect(fileToMapImage(pngFile())).rejects.toThrow(/decode/);
  });
});
