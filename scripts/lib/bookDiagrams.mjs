/**
 * Diagrams for the book, generated from source constants — never hand-drawn —
 * so they can't drift from what MindMap Studio actually produces. Each diagram
 * is a small data model; one layout function turns it into positioned boxes +
 * connectors, and two renderers consume that layout:
 *
 *   - diagramSvg(name)    → inline SVG for the HTML/EPUB builds
 *   - diagramLayout(name) → the geometry the PDF builder draws with pdf-lib
 *     (pdf-lib can't embed SVG, so it draws the same boxes/lines natively)
 *
 * The manuscript embeds a diagram with a `<!-- DIAGRAM:name -->` placeholder;
 * each builder replaces it. Add a diagram: add a model to DIAGRAMS.
 */

// Branch palette — the same hues MindMap Studio assigns to first-level branches.
export const BRANCH_PALETTE = ["#6366f1", "#0d9488", "#d97706", "#e11d48", "#7c3aed", "#0284c7"];
const ROOT_FILL = "#26215c";
const ROOT_INK = "#ffffff";
const NODE_FILL = "#ffffff";
const NODE_INK = "#1f2933";

/**
 * Diagram registry. Each entry mirrors the shape of one of MindMap Studio's
 * built-in templates (see src/templates.ts) so the book's pictures match what the
 * app actually produces: `first-map` = Brainstorm, `swot` = SWOT.
 */
export const DIAGRAMS = {
  "first-map": {
    caption: "A mind map: one central idea, six branches — the Brainstorm template.",
    alt: "A mind map with the central idea 'New idea' connected to six branches: Who, What, Why, How, When, Where.",
    model: {
      root: "New idea",
      children: ["Who", "What", "Why", "How", "When", "Where"],
    },
  },
  swot: {
    caption: "A SWOT map: a subject in the centre, four branches to fill in — the SWOT template.",
    alt: "A mind map with the central subject 'Our product' connected to four branches: Strengths, Weaknesses, Opportunities, Threats.",
    model: {
      root: "Our product",
      children: ["Strengths", "Weaknesses", "Opportunities", "Threats"],
    },
  },
};

export function hasDiagram(name) {
  return Object.hasOwn(DIAGRAMS, name);
}

export function diagramCaption(name) {
  return DIAGRAMS[name]?.caption ?? "";
}

/**
 * Lay a diagram's model out into absolute geometry. Two-sided: the root sits in
 * the centre, children split half-right / half-left, each side stacked
 * vertically. Coordinates are SVG-style (origin top-left, y grows downward);
 * the PDF builder flips y when it draws.
 */
export function diagramLayout(name) {
  const def = DIAGRAMS[name];
  if (!def) throw new Error(`Unknown diagram: ${name}`);
  const { root, children } = def.model;

  const width = 560;
  const height = 320;
  const cx = width / 2;
  const cy = height / 2;

  const rootNode = { cx, cy, w: 130, h: 46, label: root, root: true, color: ROOT_FILL };
  const nodes = [rootNode];
  const edges = [];

  const half = Math.ceil(children.length / 2);
  const sides = [
    { list: children.slice(0, half), dir: 1, x: width - 80 }, // right
    { list: children.slice(half), dir: -1, x: 80 }, // left
  ];

  let colorIdx = 0;
  for (const side of sides) {
    const n = side.list.length;
    side.list.forEach((label, i) => {
      const y = n === 1 ? cy : 46 + (i * (height - 92)) / (n - 1);
      const color = BRANCH_PALETTE[colorIdx % BRANCH_PALETTE.length];
      colorIdx++;
      const node = { cx: side.x, cy: y, w: 112, h: 36, label, root: false, color };
      nodes.push(node);
      edges.push({
        x1: cx + side.dir * (rootNode.w / 2),
        y1: cy,
        x2: side.x - side.dir * (node.w / 2),
        y2: y,
        color,
      });
    });
  }

  return { width, height, nodes, edges };
}

function escapeXml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Render a diagram to a standalone, XHTML-safe inline SVG string. */
export function diagramSvg(name) {
  const { width, height, nodes, edges } = diagramLayout(name);
  const def = DIAGRAMS[name];

  const edgeMarkup = edges
    .map((e) => {
      const mx = (e.x1 + e.x2) / 2;
      return `<path d="M${e.x1},${e.y1} C${mx},${e.y1} ${mx},${e.y2} ${e.x2},${e.y2}" fill="none" stroke="${e.color}" stroke-width="2.5" />`;
    })
    .join("");

  const nodeMarkup = nodes
    .map((nd) => {
      const x = nd.cx - nd.w / 2;
      const y = nd.cy - nd.h / 2;
      const fill = nd.root ? ROOT_FILL : NODE_FILL;
      const stroke = nd.root ? ROOT_FILL : nd.color;
      const ink = nd.root ? ROOT_INK : NODE_INK;
      const weight = nd.root ? 700 : 500;
      return (
        `<rect x="${x}" y="${y}" width="${nd.w}" height="${nd.h}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="2" />` +
        `<text x="${nd.cx}" y="${nd.cy + 5}" text-anchor="middle" font-family="sans-serif" font-size="15" font-weight="${weight}" fill="${ink}">${escapeXml(nd.label)}</text>`
      );
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escapeXml(def.alt)}">${edgeMarkup}${nodeMarkup}</svg>`;
}
