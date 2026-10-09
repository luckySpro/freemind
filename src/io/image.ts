import { t } from "../i18n/registry";
import type { MapImage } from "../model/types";

// Turn a picked image file into a self-contained MapImage (a downscaled data URL
// plus a sensible on-canvas display size). Data URLs keep maps offline and
// portable — a .json export carries its images with it. Browser-only (FileReader
// + canvas), so this is verified in-browser rather than unit-tested.

const MAX_STORE_PX = 800; // cap the stored bitmap so saves/exports stay small
const MAX_DISPLAY_PX = 220; // cap the on-node display width so layout stays sane

interface ImageSizing {
  /** Stored-bitmap dimensions (downscaled when the long side exceeds MAX_STORE_PX). */
  storeW: number;
  storeH: number;
  /** True when the stored bitmap was downscaled and so needs re-encoding. */
  downscaled: boolean;
  /** On-canvas display dimensions (width capped at MAX_DISPLAY_PX). */
  displayW: number;
  displayH: number;
}

// Pure scale math behind fileToMapImage — extracted so it's unit-testable without a
// browser (the canvas/FileReader parts can't be). Aspect ratio is preserved at both
// the store and display caps, and every dimension is floored at 1px.
export function imageSizing(naturalW: number, naturalH: number): ImageSizing {
  const longSide = Math.max(naturalW, naturalH) || 1;
  const storeScale = Math.min(1, MAX_STORE_PX / longSide);
  const storeW = Math.max(1, Math.round(naturalW * storeScale));
  const storeH = Math.max(1, Math.round(naturalH * storeScale));
  const displayScale = Math.min(1, MAX_DISPLAY_PX / storeW);
  return {
    storeW,
    storeH,
    downscaled: storeScale < 1,
    displayW: Math.max(1, Math.round(storeW * displayScale)),
    displayH: Math.max(1, Math.round(storeH * displayScale)),
  };
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error(t("io.err.couldNotReadFile")));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(t("io.err.couldNotDecodeImage")));
    img.src = src;
  });
}

export async function fileToMapImage(file: File): Promise<MapImage> {
  const original = await readAsDataUrl(file);
  const img = await loadImage(original);
  const { storeW, storeH, downscaled, displayW, displayH } = imageSizing(
    img.naturalWidth,
    img.naturalHeight,
  );

  // Re-encode at the stored size only when we actually downscaled.
  let url = original;
  if (downscaled) {
    const canvas = document.createElement("canvas");
    canvas.width = storeW;
    canvas.height = storeH;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(img, 0, 0, storeW, storeH);
      url = canvas.toDataURL("image/png");
    }
  }

  return { url, width: displayW, height: displayH };
}
