import { ViewportPortal, useNodes } from "@xyflow/react";
import { memo, useMemo } from "react";
import { type BraceGeometry, type BraceGroup, braceGeometry } from "./brace";
import type { Rect } from "./geometry";
import { BRACE_STROKE } from "./style";

// Brace-map connectors: a "{" fork per parent, drawn in flow space via ViewportPortal so it
// pans/zooms with the map. Lines are plain bordered divs (like the summary bracket), positioned
// from the shared braceGeometry — so the SVG export matches exactly.

const line = (style: React.CSSProperties): React.CSSProperties => ({
  position: "absolute",
  pointerEvents: "none",
  ...style,
});

/** A brace group resolved to its drawable geometry from the live node rects. */
interface ResolvedBrace {
  parentId: string;
  g: BraceGeometry;
}

function BraceConnectors({ braces }: { braces: BraceGroup[] }) {
  const nodes = useNodes();
  // Resolve each "{" fork's geometry once per node/brace change rather than on every parent
  // re-render. `nodes` is a fresh reference whenever a member moves, so the forks still track drags
  // live — same geometry, just not recomputed when nothing geometric changed.
  const resolved = useMemo<ResolvedBrace[]>(() => {
    if (braces.length === 0) return [];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const rectOf = (id: string): Rect | null => {
      const n = byId.get(id);
      if (!n) return null;
      return {
        x: n.position.x,
        y: n.position.y,
        w: n.measured?.width ?? 0,
        h: n.measured?.height ?? 0,
      };
    };
    const out: ResolvedBrace[] = [];
    for (const { parentId, childIds } of braces) {
      const parent = rectOf(parentId);
      if (!parent) continue;
      const kids = childIds.map(rectOf).filter((r): r is Rect => r !== null);
      if (kids.length === 0) continue;
      out.push({ parentId, g: braceGeometry(parent, kids) });
    }
    return out;
  }, [nodes, braces]);

  if (resolved.length === 0) return null;
  const border = `2px solid ${BRACE_STROKE}`;

  return (
    <ViewportPortal>
      {resolved.map(({ parentId, g }) => (
        <div key={parentId} style={line({ left: 0, top: 0 })}>
          {/* parent tee (horizontal) */}
          <div
            style={line({
              left: g.spineX,
              top: g.parentTeeY,
              width: g.parentRightX - g.spineX,
              borderTop: border,
            })}
          />
          {/* spine (vertical) */}
          <div
            style={line({
              left: g.spineX,
              top: g.spineTop,
              height: g.spineBottom - g.spineTop,
              borderLeft: border,
            })}
          />
          {/* child stubs (horizontal) */}
          {g.stubs.map((s) => (
            <div
              key={`${parentId}:${s.toX},${s.y}`}
              style={line({ left: s.fromX, top: s.y, width: s.toX - s.fromX, borderTop: border })}
            />
          ))}
        </div>
      ))}
    </ViewportPortal>
  );
}

const MemoBraceConnectors = memo(BraceConnectors);
export { MemoBraceConnectors as BraceConnectors };
