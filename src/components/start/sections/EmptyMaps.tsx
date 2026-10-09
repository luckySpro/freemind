import { t } from "../../../i18n/registry";
import "../messages";
import { blankDoc } from "../docBuilders";
import type { StartContext } from "../types";

// The library empty-state (All maps / Recent when you have no maps). An actionable empty state: a
// primary "New map" button that opens a blank canvas + a "Browse templates" path, instead of a
// dead-end. Reuses the sidebar's `.st-new` primary button styling.
//
// UI-7 note: this is the *returning-but-empty* state (you had maps, then cleared them — or you're
// browsing the library before creating). A starting-from-scratch user lands on Start's rich capture
// card ("What's on your mind?" + Try suggestions) and template gallery, which already cover intent
// selection — so a separate first-run "intent picker" modal would duplicate them (and add an overlay
// gate the progressive-disclosure guidance cautions against); it was deliberately not built. What this
// state needs is a guided path beyond a blank canvas, hence the templates link.
export function EmptyMaps({ ctx }: { ctx: StartContext }) {
  return (
    <div className="st-empty">
      <p style={{ margin: "0 0 14px" }}>{t("start.noMapsYetStartFresh")}</p>
      <button type="button" className="st-new st-empty-new" onClick={() => ctx.onOpen(blankDoc())}>
        <span aria-hidden="true">＋</span> {t("common.newMap")}
      </button>
      <button
        type="button"
        className="st-empty-templates"
        onClick={() => ctx.go("templates")}
        style={{
          display: "block",
          margin: "12px auto 0",
          padding: 0,
          border: "none",
          background: "none",
          color: "var(--st-accent, #1b8a5e)",
          font: "inherit",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {t("start.browseTemplates2")}
      </button>
    </div>
  );
}
