import { ViewportPortal } from "@xyflow/react";
import { memo } from "react";
import type { Backdrop } from "../../model/types";
import { backdropGeometry } from "./backdrop";

// The dedicated-diagram backdrop (onion / funnel / Venn frame), drawn behind the topics in flow
// space via ViewportPortal so it pans/zooms with the map. Pure frame — region labels are ordinary
// topics. Geometry comes from ./backdrop so the SVG export matches.

// Memoised: the `backdrop` prop is a stable reference straight off the live doc, so this re-renders
// only when the backdrop actually changes — not on every pan/selection/menu re-render of the canvas.
function DiagramBackdrop({ backdrop }: { backdrop: Backdrop | undefined }) {
  if (!backdrop) return null;
  const { shapes, bbox } = backdropGeometry(backdrop);
  if (shapes.length === 0) return null;
  return (
    <ViewportPortal>
      <svg
        aria-hidden="true"
        viewBox={`${bbox.x} ${bbox.y} ${bbox.w} ${bbox.h}`}
        style={{
          position: "absolute",
          left: bbox.x,
          top: bbox.y,
          width: bbox.w,
          height: bbox.h,
          overflow: "visible",
          pointerEvents: "none",
        }}
      >
        {shapes.map((s) =>
          s.type === "circle" ? (
            <circle
              key={`c:${s.cx},${s.cy},${s.r}`}
              cx={s.cx}
              cy={s.cy}
              r={s.r}
              fill={s.fill}
              stroke={s.stroke}
              strokeWidth={2}
            />
          ) : (
            <path key={`p:${s.d}`} d={s.d} fill={s.fill} stroke={s.stroke} strokeWidth={2} />
          ),
        )}
      </svg>
    </ViewportPortal>
  );
}

const MemoDiagramBackdrop = memo(DiagramBackdrop);
export { MemoDiagramBackdrop as DiagramBackdrop };
