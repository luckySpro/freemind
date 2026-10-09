import { ViewportPortal, useNodes } from "@xyflow/react";
import { EXPORT_MARGIN } from "./exportSvg";

// The per-map canvas background image, drawn in flow space via ViewportPortal so it pans/zooms with
// the map and sits behind every node/edge/boundary. It covers the node bounds plus the same margin
// the SVG exporter uses, so the screen and the export (an <image> over the map bounds) match —
// canvas == export. The data: URL lives in doc.meta.backgroundImage. On top of the background
// colour (which the wrapper div paints), so the colour shows only where the image is transparent.

export function BackgroundImage({ url }: { url: string | undefined }) {
  const nodes = useNodes();
  if (!url) return null;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const n of nodes) {
    const w = n.measured?.width ?? 0;
    const h = n.measured?.height ?? 0;
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + w);
    maxY = Math.max(maxY, n.position.y + h);
  }
  if (!Number.isFinite(minX)) return null; // nodes not measured yet

  const x = minX - EXPORT_MARGIN;
  const y = minY - EXPORT_MARGIN;
  const width = maxX - minX + 2 * EXPORT_MARGIN;
  const height = maxY - minY + 2 * EXPORT_MARGIN;

  return (
    <ViewportPortal>
      <img
        src={url}
        alt=""
        aria-hidden="true"
        draggable={false}
        style={{
          position: "absolute",
          left: x,
          top: y,
          width,
          height,
          objectFit: "cover",
          pointerEvents: "none",
          // ViewportPortal content paints above the node/edge panes by DOM order; a negative z drops
          // this opaque backdrop behind them (the translucent backdrop/boundary overlays don't need
          // this). The image still sits above the canvas dot-grid + background colour.
          zIndex: -1,
        }}
      />
    </ViewportPortal>
  );
}
