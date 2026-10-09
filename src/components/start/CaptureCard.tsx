import { tNodes } from "../../i18n/nodes";
import { t } from "../../i18n/registry";
import "./messages";
import { useState } from "react";

// The hero capture card: three segmented tabs that are the three ways into a new map. Presentational
// — the parent (StartHome) turns a topic / outline / blank choice into a real MindMapDoc and opens it.

type Tab = "topic" | "paste" | "blank";

// A plain `t("…")` array here would resolve ONCE at import and never follow a later `setLocale`, so
// this is a function re-run on every render instead of a frozen module-scope constant. Each entry also
// needs a stable identity distinct from its (now locale-live) text: the render below used to key its
// buttons on the example text itself, which is exactly the "translated label used as identity" bug
// already fixed elsewhere in this codebase (Toolbar's last-export id, Recent's date buckets) — a
// locale switch while this screen is open would have changed the key out from under React mid-render.
function suggestedExamples(): { id: string; text: string }[] {
  return [
    { id: "launch", text: t("start.suggestionLaunch") },
    { id: "research", text: t("start.organizeMyResearch") },
    { id: "onboarding", text: t("start.mapTheNewOnboarding") },
  ];
}

// `label` is a getter: a plain `label: t("…")` here resolves ONCE at import and never follows a later
// `setLocale`. `kind` (the React key) stays a plain literal.
const BLANK_LAYOUTS: { kind: string; label: string }[] = [
  {
    kind: "side",
    get label() {
      return t("start.twoSided");
    },
  },
  {
    kind: "org-down",
    get label() {
      return t("start.orgChart");
    },
  },
  {
    kind: "radial",
    get label() {
      return t("toolbar.layoutGroupRadial");
    },
  },
  {
    kind: "grid",
    get label() {
      return t("common.grid");
    },
  },
];

export function CaptureCard({
  onTopic,
  onPaste,
  onBlank,
}: {
  onTopic: (text: string) => void;
  onPaste: (text: string) => void;
  onBlank: (layout?: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("topic");
  const [topic, setTopic] = useState("");
  const [outline, setOutline] = useState("");

  return (
    <section className="st-card st-hero">
      <div className="st-eyebrow">{t("start.localFirstMindMapping")}</div>
      <h1>{t("start.whatSOnYourMind")}</h1>
      <p className="st-hero-sub">{t("start.heroSub")}</p>

      <div className="st-tabs" role="tablist" aria-label={t("common.newMap")}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "topic"}
          className="st-tab"
          onClick={() => setTab("topic")}
        >
          {t("start.typeATopic")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "paste"}
          className="st-tab"
          onClick={() => setTab("paste")}
        >
          {t("start.pasteAnOutline")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "blank"}
          className="st-tab"
          onClick={() => setTab("blank")}
        >
          {t("start.blankCanvas")}
        </button>
      </div>

      {tab === "topic" ? (
        <div>
          <div className="st-capture-row">
            <input
              className="st-input"
              placeholder={t("start.eGLaunchPlanFor")}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && topic.trim()) onTopic(topic.trim());
              }}
            />
            <button
              type="button"
              className="st-btn-primary st-btn"
              disabled={!topic.trim()}
              onClick={() => onTopic(topic.trim())}
            >
              {t("start.growTheMap")}
            </button>
          </div>
          <div className="st-try">
            <span>{t("start.try")}</span>
            {suggestedExamples().map((ex) => (
              <button
                key={ex.id}
                type="button"
                className="st-pill"
                onClick={() => onTopic(ex.text)}
              >
                {ex.text}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "paste" ? (
        <div>
          <textarea
            className="st-textarea"
            placeholder={t("start.pasteAnOutlineIndentationOr")}
            value={outline}
            onChange={(e) => setOutline(e.target.value)}
          />
          <div className="st-capture-row" style={{ marginTop: 10 }}>
            <button
              type="button"
              className="st-btn-primary st-btn"
              disabled={!outline.trim()}
              onClick={() => onPaste(outline)}
            >
              {t("start.turnIntoAMap")}
            </button>
          </div>
        </div>
      ) : null}

      {tab === "blank" ? (
        <div>
          <p className="st-explain">
            {tNodes("start.keyboardFirst", {
              sibling: <kbd>Enter</kbd>,
              child: <kbd>Tab</kbd>,
            })}
          </p>
          <div className="st-layout-row">
            {BLANK_LAYOUTS.map((l) => (
              <button
                key={l.kind}
                type="button"
                className="st-layout-chip"
                onClick={() => onBlank(l.kind)}
              >
                <span aria-hidden="true" style={{ fontSize: 18, color: "#26215c" }}>
                  ❖
                </span>
                {l.label}
              </button>
            ))}
          </div>
          <button type="button" className="st-btn-primary st-btn" onClick={() => onBlank()}>
            {t("start.openCanvas")}
          </button>
        </div>
      ) : null}
    </section>
  );
}
