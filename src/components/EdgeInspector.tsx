import { t } from "../i18n";
import type { SelectedEdge } from "../mindmap";
import type { RelationshipType } from "../model/types";
import { InspectorResizer } from "./InspectorResizer";
import { EDGE_PRESETS } from "./edgePresets";
import { SWATCHES, fieldLabel, seg, segRow } from "./inspectorControls";

// EdgeInspector — the right-panel shown when a relationship (cross-link) edge is selected, in place of
// the node InfoPanel / MapPanel. Styled via .mm-inspector* + --ed-* tokens (matching MapPanel) so it
// re-themes with the chrome. Edits go through the canvas's edge mutators (setLinkLabel/Arrow/Style,
// deleteLink); the `edge` prop is the resolved SelectedEdge (every field has a concrete value).

// Every label/title below is a getter, not a plain field: a plain `label: t("…")` in a module-scope
// array literal resolves ONCE at import and never follows a later `setLocale` (the identity fields —
// w/d/a/t — are plain literals on purpose; they're what the buttons key and compare on).
const WIDTHS: { w: number; label: string }[] = [
  {
    w: 1,
    get label() {
      return t("panel.thin");
    },
  },
  {
    w: 1.5,
    get label() {
      return t("panel.medium");
    },
  },
  {
    w: 3,
    get label() {
      return t("panel.thick");
    },
  },
];
const DASHES: { d: SelectedEdge["dash"]; label: string }[] = [
  {
    d: "dashed",
    get label() {
      return t("panel.dashed");
    },
  },
  {
    d: "solid",
    get label() {
      return t("panel.solid");
    },
  },
  {
    d: "dotted",
    get label() {
      return t("panel.dotted");
    },
  },
];
const ARROWS: { a: SelectedEdge["arrow"]; glyph: string; title: string }[] = [
  {
    a: "to",
    glyph: "→",
    get title() {
      return t("panel.arrowAtTheTargetEnd");
    },
  },
  {
    a: "from",
    glyph: "←",
    get title() {
      return t("panel.arrowAtTheSourceEnd");
    },
  },
  {
    a: "both",
    glyph: "↔",
    get title() {
      return t("panel.arrowsAtBothEnds");
    },
  },
  {
    a: "none",
    glyph: "—",
    get title() {
      return t("panel.noArrowheadsAPlainLine");
    },
  },
];
const TYPES: { t: RelationshipType; label: string }[] = [
  {
    t: "relates-to",
    get label() {
      return t("panel.relates");
    },
  },
  {
    t: "depends-on",
    get label() {
      return t("panel.depends");
    },
  },
  {
    t: "causes",
    get label() {
      return t("panel.causes");
    },
  },
  {
    t: "supports",
    get label() {
      return t("panel.supports");
    },
  },
  {
    t: "blocks",
    get label() {
      return t("panel.blocks");
    },
  },
];

export function EdgeInspector({
  edge,
  fromTopic,
  toTopic,
  onSetLabel,
  onSetArrow,
  onSetStyle,
  onToggleShowTypes,
  onDelete,
  onMinimize,
  width,
  onResize,
}: {
  edge: SelectedEdge;
  fromTopic: string;
  toTopic: string;
  onSetLabel: (label: string) => void;
  onSetArrow: (arrow: SelectedEdge["arrow"]) => void;
  onSetStyle: (patch: {
    color?: string;
    width?: number;
    dash?: SelectedEdge["dash"];
    curve?: number;
    arrow?: SelectedEdge["arrow"];
    type?: RelationshipType;
  }) => void;
  /** Toggle the map-wide on-canvas type pills (edge.showTypes reflects the current state). */
  onToggleShowTypes: (on: boolean) => void;
  onDelete: () => void;
  onMinimize?: () => void;
  width?: number;
  onResize?: (next: number) => void;
}) {
  return (
    <aside
      className="mm-inspector"
      aria-label={t("panel.relationshipInfo")}
      style={width ? { width } : undefined}
    >
      {width && onResize ? <InspectorResizer width={width} onResize={onResize} /> : null}
      <div
        className="mm-inspector-head"
        style={{ display: "flex", alignItems: "flex-start", gap: 8 }}
      >
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div style={{ fontSize: 11.5, color: "var(--ed-muted)", marginBottom: 5 }}>
            {t("panel.relationship")}
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={`${fromTopic} → ${toTopic}`}
          >
            {fromTopic || t("common.untitled")} <span style={{ color: "var(--ed-faint)" }}>→</span>{" "}
            {toTopic || t("common.untitled")}
          </div>
          {/* Faint context line under the title, mirroring the node inspector's breadcrumb (P5). */}
          {edge.label ? (
            <div
              className="mm-inspector-path"
              title={t("panel.relationshipNamed", { label: edge.label })}
            >
              {t("panel.relationshipNamed", { label: edge.label })}
            </div>
          ) : null}
        </div>
        {onMinimize && (
          <button
            type="button"
            className="mm-inspector-min"
            title={t("panel.minimize")}
            aria-label={t("panel.minimizeRelationshipInfo")}
            onClick={onMinimize}
          >
            ›
          </button>
        )}
      </div>
      <div className="mm-inspector-body">
        {/* Presets — one click sets the whole look (dash + width + curve + arrowhead). */}
        <div style={fieldLabel}>{t("panel.presets")}</div>
        <div style={segRow}>
          {EDGE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              title={p.title}
              onClick={() => onSetStyle(p.patch)}
              style={seg(false)}
            >
              {p.name}
            </button>
          ))}
        </div>

        {/* Label */}
        <div style={fieldLabel}>{t("panel.label")}</div>
        <input
          key={`${edge.id}:label`}
          defaultValue={edge.label}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSetLabel((e.target as HTMLInputElement).value.trim());
          }}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== edge.label) onSetLabel(v);
          }}
          placeholder={t("panel.relationshipLabel")}
          aria-label={t("panel.relationshipLabel")}
          style={{
            width: "100%",
            boxSizing: "border-box",
            border: "1px solid var(--ed-border)",
            background: "var(--ed-card)",
            color: "var(--ed-ink)",
            borderRadius: 7,
            fontSize: 13,
            padding: "4px 7px",
          }}
        />

        {/* Direction / arrowheads */}
        <div style={fieldLabel}>{t("panel.direction")}</div>
        <div style={segRow}>
          {ARROWS.map(({ a, glyph, title }) => (
            <button
              key={a}
              type="button"
              title={title}
              aria-pressed={edge.arrow === a}
              onClick={() => onSetArrow(a)}
              style={{ ...seg(edge.arrow === a), minWidth: 34, textAlign: "center" }}
            >
              {glyph}
            </button>
          ))}
        </div>

        {/* Type — a semantic category (B3), independent of the free label above. */}
        <div style={fieldLabel}>{t("panel.type")}</div>
        <div style={segRow}>
          {/* `type`, not `t` — a destructured local shadows the translation function just as a
              plain one does, and this shape is invisible to the migration tool's shadow check. */}
          {TYPES.map(({ t: type, label }) => (
            <button
              key={type}
              type="button"
              title={t("panel.markRelationshipAs", { type })}
              aria-pressed={edge.type === type}
              onClick={() => onSetStyle({ type })}
              style={seg(edge.type === type)}
            >
              {label}
            </button>
          ))}
        </div>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 6,
            fontSize: 12,
            color: "var(--ed-muted)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={edge.showTypes}
            onChange={(e) => onToggleShowTypes(e.target.checked)}
          />
          {t("panel.showTypeLabelsOnThe")}
        </label>

        {/* Line colour */}
        <div style={fieldLabel}>{t("panel.colour")}</div>
        <div style={segRow}>
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              aria-label={t("common.colourNamed", { colour: c })}
              aria-pressed={edge.color.toLowerCase() === c.toLowerCase()}
              onClick={() => onSetStyle({ color: c })}
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                background: c,
                cursor: "pointer",
                border:
                  edge.color.toLowerCase() === c.toLowerCase()
                    ? "2px solid var(--ed-ink)"
                    : "1px solid var(--ed-border)",
                padding: 0,
              }}
            />
          ))}
          {/* Custom colour — apply an exact brand/accent hue beyond the preset swatches. */}
          <input
            type="color"
            value={edge.color || "#888888"}
            onChange={(e) => onSetStyle({ color: e.target.value })}
            aria-label={t("panel.customRelationshipColour")}
            title={t("panel.customColour")}
            style={{
              width: 24,
              height: 22,
              padding: 1,
              borderRadius: 6,
              border: "1px solid var(--ed-border)",
              background: "var(--ed-card)",
              cursor: "pointer",
            }}
          />
          <button
            type="button"
            title={t("panel.resetToTheDefaultColour")}
            onClick={() => onSetStyle({ color: "" })}
            style={seg(false)}
          >
            {t("panel.default")}
          </button>
        </div>

        {/* Width */}
        <div style={fieldLabel}>{t("panel.width")}</div>
        <div style={segRow}>
          {WIDTHS.map(({ w, label }) => (
            <button
              key={w}
              type="button"
              aria-pressed={edge.width === w}
              onClick={() => onSetStyle({ width: w })}
              style={seg(edge.width === w)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Dash */}
        <div style={fieldLabel}>{t("panel.tab.style")}</div>
        <div style={segRow}>
          {DASHES.map(({ d, label }) => (
            <button
              key={d}
              type="button"
              aria-pressed={edge.dash === d}
              onClick={() => onSetStyle({ dash: d })}
              style={seg(edge.dash === d)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Curve — reshape the arc to route around clutter (perpendicular bow). */}
        <div style={fieldLabel}>{t("panel.curve")}</div>
        <div style={segRow}>
          <button
            type="button"
            title={t("panel.gentleAutomaticBow")}
            aria-pressed={edge.curve == null}
            onClick={() => onSetStyle({ curve: undefined })}
            style={seg(edge.curve == null)}
          >
            {t("panel.auto")}
          </button>
          <button
            type="button"
            title={t("panel.aStraightLine")}
            aria-pressed={edge.curve === 0}
            onClick={() => onSetStyle({ curve: 0 })}
            style={seg(edge.curve === 0)}
          >
            {t("panel.straight")}
          </button>
          <button
            type="button"
            title={t("panel.bowMoreOneWay")}
            onClick={() => onSetStyle({ curve: (edge.curve ?? 0) - 25 })}
            style={seg(false)}
          >
            {t("panel.bow")}
          </button>
          <button
            type="button"
            title={t("panel.bowMoreTheOtherWay")}
            onClick={() => onSetStyle({ curve: (edge.curve ?? 0) + 25 })}
            style={seg(false)}
          >
            {t("panel.bow2")}
          </button>
        </div>

        {/* Delete */}
        <button
          type="button"
          onClick={onDelete}
          style={{
            marginTop: 16,
            width: "100%",
            border: "1px solid var(--ed-danger)",
            background: "transparent",
            color: "var(--ed-danger)",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            padding: "6px 0",
          }}
        >
          {t("panel.deleteRelationship")}
        </button>
      </div>
    </aside>
  );
}
