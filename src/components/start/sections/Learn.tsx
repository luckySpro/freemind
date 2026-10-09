import { tNodes } from "../../../i18n/nodes";
import { t } from "../../../i18n/registry";
import "../messages";
// Six short principles of mind mapping. Static content.

// `title`/`body` are getters: plain `title: t("…")` fields here would resolve ONCE at import and
// never follow a later `setLocale`. `id` (the React key) and `icon` stay plain literals.
const PRINCIPLES: { id: string; icon: string; title: string; body: string }[] = [
  {
    id: "p1",
    icon: "◎",
    get title() {
      return t("start.startCentral");
    },
    get body() {
      return t("start.putTheSubjectInThe");
    },
  },
  {
    id: "p2",
    icon: "✦",
    get title() {
      return t("start.oneKeywordPerBranch");
    },
    get body() {
      return t("start.aSingleWordOrShort");
    },
  },
  {
    id: "p3",
    icon: "❖",
    get title() {
      return t("start.radialHierarchy");
    },
    get body() {
      return t("start.mainBranchesNearTheCentre");
    },
  },
  {
    id: "p4",
    icon: "🎨",
    get title() {
      return t("start.colourByTheme");
    },
    get body() {
      return t("start.giveEachMainBranchIts");
    },
  },
  {
    id: "p5",
    icon: "↔",
    get title() {
      return t("start.crossLinks");
    },
    get body() {
      return t("start.drawARelationshipArrowBetween");
    },
  },
  {
    id: "p6",
    icon: "⚡",
    get title() {
      return t("start.captureThenTidy");
    },
    get body() {
      return t("start.getEverythingDownFirstRearrange");
    },
  },
];

export function Learn() {
  return (
    <div className="st-content">
      <section>
        <h2 className="st-section-title">{t("start.learnMindMapping")}</h2>
        <p className="st-section-sub">{t("start.aFewPrinciplesThatMake")}</p>
      </section>
      <div className="st-principles">
        {PRINCIPLES.map((p) => (
          <div key={p.id} className="st-card st-principle">
            <div style={{ fontSize: 22, color: "var(--st-accent)" }} aria-hidden="true">
              {p.icon}
            </div>
            <h3>{p.title}</h3>
            <p>{p.body}</p>
          </div>
        ))}
      </div>

      <div className="st-card" style={{ padding: 18 }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 15 }}>{t("start.goDeeperTheBook")}</h3>
        <p className="st-prose" style={{ marginTop: 0 }}>
          {tNodes("start.thinkingInMapsExplain", {
            book: <strong>{t("start.thinkingInMaps")}</strong>,
          })}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
          <a
            className="st-link"
            href="/Thinking-in-Maps.pdf"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("start.readPdf")}
          </a>
          <a
            className="st-link"
            href="/Thinking-in-Maps.epub"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("start.readEpub")}
          </a>
        </div>
      </div>
    </div>
  );
}
