import { checkPath, piePath, toPercent } from "./progress";

// A small task-completion pie (MindManager-style): an outlined circle that fills clockwise to the
// given fraction — empty at 0%, a wedge in between, a solid disc at 100%. Shared by the on-canvas
// node badge and the Info panel so they look identical; the SVG exporter mirrors it via piePath().

const TRACK = "rgba(0,0,0,0.35)";
const PARTIAL = "#3b8bd4";
const DONE = "#27852f";

export function ProgressPie({
  fraction,
  size = 16,
  title,
}: {
  fraction: number;
  size?: number;
  title?: string;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 1;
  const pct = toPercent(fraction);
  const full = pct >= 100;
  const fill = full ? DONE : PARTIAL;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={title ?? `${pct}% complete`}
      style={{ flexShrink: 0, display: "block" }}
    >
      {title ? <title>{title}</title> : null}
      <circle cx={cx} cy={cy} r={r} fill="#fff" stroke={TRACK} strokeWidth="1" />
      {full ? <circle cx={cx} cy={cy} r={r} fill={fill} /> : null}
      {!full && pct > 0 ? <path d={piePath(cx, cy, r, fraction)} fill={fill} /> : null}
      {full ? (
        <path
          d={checkPath(cx, cy, r)}
          fill="none"
          stroke="#fff"
          strokeWidth={Math.max(1.2, r * 0.3)}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
    </svg>
  );
}
