import { t } from "../../i18n/registry";
import "./messages";
// "Learn the app" — four cards teaching editor mechanics (distinct from sections/Learn.tsx, which
// teaches mind-mapping principles). Static, render-only; reuses the .st-principles grid + .st-principle
// card styling from the Learn section so it themes with the rest of the Start screen.

const TIPS: { id: string; icon: string; title: string; body: string; action?: "cmdk" }[] = [
  {
    id: "cmdk",
    icon: "⌘",
    get title() {
      return t("start.cmdkForAnyCommand");
    },
    get body() {
      return t("start.pressCtrlKAnywhereTo");
    },
    action: "cmdk",
  },
  {
    id: "context-menu",
    icon: "✦",
    get title() {
      return t("start.rightClickATopic");
    },
    get body() {
      return t("start.openTheContextMenuFor");
    },
  },
  {
    id: "relate",
    icon: "↬",
    get title() {
      return t("start.dragATopicSDot");
    },
    get body() {
      return t("start.pullFromANodeS");
    },
  },
  {
    id: "export",
    icon: "⤓",
    get title() {
      return t("start.exportToPowerpointPdf");
    },
    get body() {
      return t("start.shareAMapAsPptx");
    },
  },
];

export function AppTips({ onOpenCommandPalette }: { onOpenCommandPalette?: () => void }) {
  return (
    <section>
      <h2 className="st-section-title">{t("start.learnTheApp")}</h2>
      <p className="st-section-sub">{t("start.fourShortcutsThatMakeThe")}</p>
      <div className="st-principles" style={{ marginTop: 12 }}>
        {/* `tip`, not `t` — a local named `t` shadows the translation function, making t("…")
            uncallable in this scope. The ninth instance of that trap in this migration. */}
        {TIPS.map((tip) => {
          const inner = (
            <>
              <div style={{ fontSize: 22, color: "var(--st-accent)" }} aria-hidden="true">
                {tip.icon}
              </div>
              <h3>{tip.title}</h3>
              <p>{tip.body}</p>
            </>
          );
          // The ⌘K card opens the palette right here — show, don't just tell. Others stay static.
          if (tip.action === "cmdk" && onOpenCommandPalette) {
            return (
              <button
                key={tip.id}
                type="button"
                className="st-card st-card-hover st-principle"
                style={{ font: "inherit", textAlign: "left", width: "100%", cursor: "pointer" }}
                aria-label={t("start.openTheCommandPalette")}
                onClick={onOpenCommandPalette}
              >
                {inner}
              </button>
            );
          }
          return (
            <div key={tip.id} className="st-card st-principle">
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}
