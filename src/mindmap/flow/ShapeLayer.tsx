import { t } from "../../i18n/registry";
import "./messages";
import { ViewportPortal, useReactFlow } from "@xyflow/react";
import {
  type ReactElement,
  type PointerEvent as ReactPointerEvent,
  memo,
  useCallback,
  useRef,
  useState,
} from "react";
import type { CanvasShape, CanvasShapeKind } from "../../model/types";
import { type ShapeBox, type ShapePrim, canvasShapeGeometry, dragBox } from "./canvasShapes";

/** One drawing primitive as an SVG element, keyed by its content (positional + stable per shape). */
function primEl(p: ShapePrim): ReactElement {
  switch (p.t) {
    case "rect":
      return (
        <rect
          key={`r${p.x},${p.y},${p.w}`}
          x={p.x}
          y={p.y}
          width={p.w}
          height={p.h}
          rx={p.rx}
          fill={p.fill}
          stroke={p.stroke}
          strokeWidth={2}
          pointerEvents="none"
        />
      );
    case "ellipse":
      return (
        <ellipse
          key={`e${p.cx},${p.cy}`}
          cx={p.cx}
          cy={p.cy}
          rx={p.rx}
          ry={p.ry}
          fill={p.fill}
          stroke={p.stroke}
          strokeWidth={2}
          pointerEvents="none"
        />
      );
    case "path":
      return (
        <path
          key={`p${p.d.slice(0, 20)}`}
          d={p.d}
          fill={p.fill}
          stroke={p.stroke}
          strokeWidth={2}
          pointerEvents="none"
        />
      );
    case "line":
      return (
        <line
          key={`l${p.x1},${p.y1},${p.x2},${p.y2}`}
          x1={p.x1}
          y1={p.y1}
          x2={p.x2}
          y2={p.y2}
          stroke={p.stroke}
          strokeWidth={1.5}
          pointerEvents="none"
        />
      );
    default:
      return (
        <text
          key={`t${p.x},${p.y}`}
          x={p.x}
          y={p.y}
          fontFamily="sans-serif"
          fontSize={14}
          fontWeight={600}
          fill={p.fill}
          textAnchor={p.anchor}
          pointerEvents="none"
        >
          {p.s}
        </text>
      );
  }
}

// The free background shapes + smart containers (Tier 4 items 23 + 22), drawn behind the topics in flow
// space via ViewportPortal so they pan/zoom with the map. Interactive: click to select, drag the body to
// move, drag a corner grip to resize; a selected shape shows an inline toolbar (recolour / change kind /
// delete). Geometry comes from ./canvasShapes so the SVG export matches (canvas == export). A drag
// updates a LOCAL preview box for smooth feedback and commits to the model once on release — so the
// whole gesture is a single undo step (mirroring the topic drag). Rendering is ungated (a shape shows
// whenever the doc has one); adding a shape flips free-canvas mode on so it reads as a whiteboard object.

// The display name for a shape kind — a FUNCTION, not a lookup into SHAPE_KINDS below, because a
// fresh per-call resolution is simpler to reason about here and costs nothing extra. Reuses the same
// catalogue keys SHAPE_KINDS and Toolbar's SHAPE_ITEMS already use for these six kinds, so the three
// surfaces cannot drift.
function shapeKindLabel(kind: CanvasShapeKind): string {
  switch (kind) {
    case "rect":
      return t("toolbar.rectangle");
    case "ellipse":
      return t("toolbar.ellipse");
    case "blockArrow":
      return t("toolbar.blockArrow");
    case "chevron":
      return t("toolbar.chevron");
    case "swimlane":
      return t("cmd.layout.swimlane");
    default:
      return t("canvas.matrix");
  }
}

// `title` is a getter: a plain `title: t("…")` here resolves ONCE at import and never follows a later
// `setLocale`. `kind` (the React key) and `glyph` stay plain literals.
const SHAPE_KINDS: { kind: CanvasShapeKind; glyph: string; title: string }[] = [
  {
    kind: "rect",
    glyph: "▭",
    get title() {
      return t("toolbar.rectangle");
    },
  },
  {
    kind: "ellipse",
    glyph: "⬭",
    get title() {
      return t("toolbar.ellipse");
    },
  },
  {
    kind: "blockArrow",
    glyph: "➜",
    get title() {
      return t("toolbar.blockArrow");
    },
  },
  {
    kind: "chevron",
    glyph: "❯",
    get title() {
      return t("toolbar.chevron");
    },
  },
  {
    kind: "swimlane",
    glyph: "▥",
    get title() {
      return t("cmd.layout.swimlane");
    },
  },
  {
    kind: "matrix",
    glyph: "▦",
    get title() {
      return t("canvas.matrix");
    },
  },
];

const COLORS = ["#8a84c6", "#e23b3b", "#3b8bd4", "#27852f", "#d98a17", "#7a3fb0", "#555555"];

type Box = ShapeBox;

interface Props {
  shapes: CanvasShape[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Commit a moved shape (one undo step). */
  onMove: (id: string, x: number, y: number) => void;
  /** Commit a resized shape's box (one undo step). */
  onResize: (id: string, x: number, y: number, w: number, h: number) => void;
  onColor: (id: string, color: string) => void;
  onKind: (id: string, kind: CanvasShapeKind) => void;
  onDelete: (id: string) => void;
}

type Corner = "nw" | "ne" | "sw" | "se";

function ShapeLayer({
  shapes,
  selectedId,
  onSelect,
  onMove,
  onResize,
  onColor,
  onKind,
  onDelete,
}: Props) {
  const { screenToFlowPosition } = useReactFlow();
  // Live drag: the box the pointer is currently producing (local preview; not yet in the model).
  const [preview, setPreview] = useState<{ id: string; box: Box } | null>(null);
  const drag = useRef<{
    id: string;
    mode: "move" | Corner;
    start: { x: number; y: number };
    box: Box;
  } | null>(null);

  const computeBox = useCallback(
    (e: PointerEvent): Box | null => {
      const d = drag.current;
      if (!d) return null;
      const cur = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      return dragBox(d.box, d.mode, cur.x - d.start.x, cur.y - d.start.y);
    },
    [screenToFlowPosition],
  );

  const onPointerMove = useRef<(e: PointerEvent) => void>(() => {});
  const endDrag = useRef<(e: PointerEvent) => void>(() => {});
  onPointerMove.current = (e: PointerEvent) => {
    const box = computeBox(e);
    const d = drag.current;
    if (box && d) setPreview({ id: d.id, box });
  };
  endDrag.current = (e: PointerEvent) => {
    const box = computeBox(e);
    const d = drag.current;
    if (box && d) {
      if (d.mode === "move") onMove(d.id, box.x, box.y);
      else onResize(d.id, box.x, box.y, box.w, box.h);
    }
    drag.current = null;
    setPreview(null);
    window.removeEventListener("pointermove", moveListener);
    window.removeEventListener("pointerup", upListener);
  };
  const moveListener = useCallback((e: PointerEvent) => onPointerMove.current(e), []);
  const upListener = useCallback((e: PointerEvent) => endDrag.current(e), []);

  const beginDrag = useCallback(
    (e: ReactPointerEvent, shape: CanvasShape, mode: "move" | Corner) => {
      e.stopPropagation();
      e.preventDefault();
      onSelect(shape.id);
      drag.current = {
        id: shape.id,
        mode,
        start: screenToFlowPosition({ x: e.clientX, y: e.clientY }),
        box: { x: shape.pos.x, y: shape.pos.y, w: shape.size.w, h: shape.size.h },
      };
      window.addEventListener("pointermove", moveListener);
      window.addEventListener("pointerup", upListener);
    },
    [screenToFlowPosition, onSelect, moveListener, upListener],
  );

  if (shapes.length === 0) return null;

  // The shape's effective box (the live preview while dragging it, else its model box).
  const boxOf = (shape: CanvasShape): Box =>
    preview?.id === shape.id
      ? preview.box
      : { x: shape.pos.x, y: shape.pos.y, w: shape.size.w, h: shape.size.h };

  const selected = shapes.find((s) => s.id === selectedId);
  const selBox = selected ? boxOf(selected) : null;

  return (
    <ViewportPortal>
      {shapes.map((shape) => {
        const box = boxOf(shape);
        const { prims, bbox } = canvasShapeGeometry({
          ...shape,
          pos: { x: box.x, y: box.y },
          size: { w: box.w, h: box.h },
        });
        const isSel = shape.id === selectedId;
        const grip = (corner: Corner, cx: number, cy: number) => (
          <rect
            key={corner}
            x={cx - 6}
            y={cy - 6}
            width={12}
            height={12}
            rx={2}
            fill="#fff"
            stroke="var(--ed-accent, #4f46e5)"
            strokeWidth={2}
            style={{ cursor: `${corner}-resize`, pointerEvents: "all" }}
            onPointerDown={(e) => beginDrag(e, shape, corner)}
          />
        );
        return (
          <svg
            key={shape.id}
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
            <title>{t("canvas.shapeTitle", { kind: shapeKindLabel(shape.kind) })}</title>
            {/* An invisible hit-rect over the whole box: click to select, drag the body to move. */}
            <rect
              x={bbox.x}
              y={bbox.y}
              width={bbox.w}
              height={bbox.h}
              fill="transparent"
              style={{ pointerEvents: "all", cursor: "move" }}
              onPointerDown={(e) => beginDrag(e, shape, "move")}
            />
            {prims.map(primEl)}
            {isSel ? (
              <>
                <rect
                  x={bbox.x}
                  y={bbox.y}
                  width={bbox.w}
                  height={bbox.h}
                  fill="none"
                  stroke="var(--ed-accent, #4f46e5)"
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                  pointerEvents="none"
                />
                {grip("nw", bbox.x, bbox.y)}
                {grip("ne", bbox.x + bbox.w, bbox.y)}
                {grip("sw", bbox.x, bbox.y + bbox.h)}
                {grip("se", bbox.x + bbox.w, bbox.y + bbox.h)}
              </>
            ) : null}
          </svg>
        );
      })}
      {/* Inline toolbar for the selected shape (recolour / change kind / delete), pinned above it in
          flow space so it rides the pan/zoom. */}
      {selected && selBox ? (
        <div
          style={{
            position: "absolute",
            left: selBox.x,
            top: selBox.y - 42,
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 6px",
            background: "var(--ed-card, #fff)",
            border: "1px solid var(--ed-border, #ddd)",
            borderRadius: 8,
            boxShadow: "0 2px 8px rgba(0,0,0,0.14)",
            pointerEvents: "all",
            whiteSpace: "nowrap",
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              title={t("common.colourNamed", { colour: c })}
              aria-label={t("canvas.shapeColour", { colour: c })}
              onClick={() => onColor(selected.id, c)}
              style={{
                width: 16,
                height: 16,
                borderRadius: 4,
                border:
                  (selected.color ?? "#8a84c6") === c
                    ? "2px solid var(--ed-ink, #000)"
                    : "1px solid #ccc",
                background: c,
                cursor: "pointer",
                padding: 0,
              }}
            />
          ))}
          <span
            style={{ width: 1, height: 18, background: "var(--ed-divider, #eee)", margin: "0 2px" }}
          />
          {SHAPE_KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              title={k.title}
              aria-label={k.title}
              aria-pressed={selected.kind === k.kind}
              onClick={() => onKind(selected.id, k.kind)}
              style={{
                fontSize: 13,
                lineHeight: 1,
                padding: "3px 5px",
                border: "1px solid var(--ed-border, #ddd)",
                borderRadius: 6,
                background:
                  selected.kind === k.kind ? "var(--ed-ink, #000)" : "var(--ed-card, #fff)",
                color: selected.kind === k.kind ? "var(--ed-page, #fff)" : "var(--ed-ink, #000)",
                cursor: "pointer",
              }}
            >
              {k.glyph}
            </button>
          ))}
          <span
            style={{ width: 1, height: 18, background: "var(--ed-divider, #eee)", margin: "0 2px" }}
          />
          <button
            type="button"
            title={t("canvas.deleteShape")}
            aria-label={t("canvas.deleteShape")}
            onClick={() => onDelete(selected.id)}
            style={{
              fontSize: 13,
              lineHeight: 1,
              padding: "3px 6px",
              border: "1px solid var(--ed-border, #ddd)",
              borderRadius: 6,
              background: "var(--ed-card, #fff)",
              color: "#c0392b",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      ) : null}
    </ViewportPortal>
  );
}

const MemoShapeLayer = memo(ShapeLayer);
export { MemoShapeLayer as ShapeLayer };
