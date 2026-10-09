import { BRANCH_PALETTE } from "./nodeStats";

// A small schematic radial-map thumbnail (SVG). When the card knows the map's real branch colours
// (`branches`), it draws one spoke per actual branch so two maps look different at a glance; otherwise
// it falls back to a stable seed-hashed glyph (e.g. a childless map). Branch colours use the canvas
// palette identity; the central node uses currentColor so it stays visible on light + dark cards.

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function MiniMap({ seed, branches }: { seed: string; branches?: string[] }) {
  const size = 120;
  const cx = size / 2;
  const cy = size / 2;
  let nodes: { x: number; y: number; c: string }[];
  if (branches && branches.length > 0) {
    // Real structure: one evenly-spaced spoke per branch (capped for legibility), in its real colour.
    const n = Math.min(branches.length, 8);
    const start = -Math.PI / 2; // first spoke points up
    nodes = Array.from({ length: n }, (_, i) => {
      const ang = start + (i / n) * Math.PI * 2;
      return { x: cx + Math.cos(ang) * 36, y: cy + Math.sin(ang) * 36, c: branches[i] };
    });
  } else {
    // Fallback: a deterministic glyph from the seed (no branches to draw, e.g. a bare-root map).
    const h = hash(seed);
    const n = 4 + (h % 3); // 4..6 branches
    const start = ((h >> 4) % 360) * (Math.PI / 180);
    nodes = Array.from({ length: n }, (_, i) => {
      const ang = start + (i / n) * Math.PI * 2;
      const r = 30 + ((h >> (i * 3)) & 7) * 3;
      return {
        x: cx + Math.cos(ang) * r,
        y: cy + Math.sin(ang) * r,
        c: BRANCH_PALETTE[(h + i) % BRANCH_PALETTE.length],
      };
    });
  }
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" aria-hidden="true">
      {nodes.map((p) => (
        <line
          key={`l${Math.round(p.x)}-${Math.round(p.y)}`}
          x1={cx}
          y1={cy}
          x2={p.x}
          y2={p.y}
          stroke={p.c}
          strokeWidth="2"
          opacity="0.5"
        />
      ))}
      {nodes.map((p) => (
        <circle
          key={`c${Math.round(p.x)}-${Math.round(p.y)}`}
          cx={p.x}
          cy={p.y}
          r="5.5"
          fill={p.c}
        />
      ))}
      <circle cx={cx} cy={cy} r="10" fill="currentColor" />
    </svg>
  );
}
