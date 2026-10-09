import { type ReactElement, Suspense, lazy } from "react";
import type { MindMapProps } from "./contract";

// Canvas entry point. The app imports the canvas component + its contract from here, never from
// the engine file directly, so the renderer stays swappable behind this one seam. The React Flow
// canvas is lazy-loaded so the heavy engine never sits in the entry bundle (size-budget gates the
// entry only) — the same code-split pattern useMapExports uses for the opml/docx/… formats.
export * from "./contract";

const Canvas = lazy(() => import("./FlowMindMap").then((m) => ({ default: m.FlowMindMap })));

export function MindMap(props: MindMapProps): ReactElement {
  return (
    <Suspense fallback={null}>
      <Canvas {...props} />
    </Suspense>
  );
}
