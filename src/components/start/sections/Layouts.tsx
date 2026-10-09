import { tNodes } from "../../../i18n/nodes";
import { t } from "../../../i18n/registry";
import "../messages";
import type { BackdropKind, MindMapDoc } from "../../../model/types";
import { blankDoc } from "../docBuilders";
import type { StartContext } from "../types";

// Structural layouts + diagram backdrops. Each opens a BLANK map in that view — and the copy makes
// clear a layout is just a view you can switch any time; your topics don't move.

// `label` is a getter: a plain `label: t("…")` in these module-scope arrays would resolve ONCE at
// import and never follow a later `setLocale`. `kind` (the React key) stays a plain literal.
const LAYOUTS: { kind: string; label: string }[] = [
  {
    kind: "side",
    get label() {
      return t("start.twoSided");
    },
  },
  {
    kind: "right",
    get label() {
      return t("start.allRight");
    },
  },
  {
    kind: "left",
    get label() {
      return t("start.allLeft");
    },
  },
  {
    kind: "radial",
    get label() {
      return t("cmd.layout.radial");
    },
  },
  {
    kind: "org-down",
    get label() {
      return t("toolbar.orgChart");
    },
  },
  {
    kind: "org-up",
    get label() {
      return t("toolbar.orgChart2");
    },
  },
  {
    kind: "timeline",
    get label() {
      return t("cmd.layout.timeline");
    },
  },
  {
    kind: "fishbone",
    get label() {
      return t("cmd.layout.fishbone");
    },
  },
  {
    kind: "grid",
    get label() {
      return t("cmd.layout.grid");
    },
  },
  {
    kind: "swimlane",
    get label() {
      return t("cmd.layout.swimlane");
    },
  },
  {
    kind: "brace",
    get label() {
      return t("cmd.layout.brace");
    },
  },
];

const BACKDROPS: { kind: BackdropKind; label: string }[] = [
  {
    kind: "onion",
    get label() {
      return t("start.onion");
    },
  },
  {
    kind: "funnel",
    get label() {
      return t("start.funnel");
    },
  },
  {
    kind: "venn2",
    get label() {
      return t("start.venn2");
    },
  },
  {
    kind: "venn3",
    get label() {
      return t("start.venn3");
    },
  },
];

function backdropDoc(kind: BackdropKind): MindMapDoc {
  const d = blankDoc();
  return { ...d, meta: { ...d.meta, freeform: true }, backdrop: { kind } };
}

export function Layouts({ ctx }: { ctx: StartContext }) {
  return (
    <div className="st-content">
      <section>
        <h2 className="st-section-title">{t("start.layouts")}</h2>
        <p className="st-section-sub">
          {tNodes("start.layoutExplain", { view: <strong>{t("start.viewWord")}</strong> })}
        </p>
      </section>

      <section>
        <h3 className="st-section-title" style={{ fontSize: 13, color: "var(--st-muted)" }}>
          {t("start.structuralLayouts")}
        </h3>
        <div className="st-grid" style={{ marginTop: 10 }}>
          {LAYOUTS.map((l) => (
            <button
              key={l.kind}
              type="button"
              className="st-card st-card-hover st-tile"
              style={{ padding: 16, alignItems: "center", gap: 8 }}
              onClick={() => ctx.onOpen(blankDoc(), l.kind)}
            >
              <span aria-hidden="true" style={{ fontSize: 22, color: "var(--st-accent)" }}>
                ❖
              </span>
              <span className="st-card-title">{l.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="st-section-title" style={{ fontSize: 13, color: "var(--st-muted)" }}>
          {t("start.diagramBackdrops")}
        </h3>
        <p className="st-section-sub">{t("start.aGeometricFrameBehindFree")}</p>
        <div className="st-grid" style={{ marginTop: 10 }}>
          {BACKDROPS.map((b) => (
            <button
              key={b.kind}
              type="button"
              className="st-card st-card-hover st-tile"
              style={{ padding: 16, alignItems: "center", gap: 8 }}
              onClick={() => ctx.onOpen(backdropDoc(b.kind))}
            >
              <span aria-hidden="true" style={{ fontSize: 22, color: "var(--st-accent)" }}>
                ◎
              </span>
              <span className="st-card-title">{b.label}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
