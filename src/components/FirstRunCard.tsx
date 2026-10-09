import { t } from "../i18n";
import { tNodes } from "../i18n/nodes";
// First-run "3 things to try" card (#13). A one-time, dismissible overlay for a brand-new user;
// App gates it on a localStorage flag and auto-dismisses it permanently after the first real edit.
// Theme-reactive via the .mm-firstrun* classes (offline-safe — no network, no web fonts).

export function FirstRunCard({ onDismiss }: { onDismiss: () => void }) {
  // A phone/tablet has no Tab key, no reliable double-click, and no Ctrl/⌘+K — telling a touch user
  // to do those three things is useless. Detect a coarse pointer and show gestures that actually work.
  const touch = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  return (
    <aside className="mm-firstrun" aria-label={t("settings.gettingStarted")}>
      <button
        type="button"
        className="mm-firstrun-close"
        aria-label={t("app.dismissGettingStartedTips")}
        onClick={onDismiss}
      >
        ×
      </button>
      <strong className="mm-firstrun-title">{t("app.firstRun.title")}</strong>
      <ol className="mm-firstrun-list">
        {touch ? (
          <>
            <li>{tNodes("app.firstRun.tapSelect", { tap: <strong>{t("app.tap")}</strong> })}</li>
            <li>{tNodes("app.firstRun.tapAdd", { plus: <strong>＋</strong> })}</li>
            <li>{t("app.dragTheBackgroundToPan")}</li>
          </>
        ) : (
          <>
            <li>
              {tNodes("app.firstRun.doubleClickRename", {
                doubleClick: <strong>{t("app.doubleClick")}</strong>,
              })}
            </li>
            <li>{tNodes("app.firstRun.tabChild", { tab: <kbd>Tab</kbd> })}</li>
            <li>
              {tNodes("app.firstRun.paletteAnything", {
                palette: <kbd>{t("app.ctrlK")}</kbd>,
              })}
            </li>
          </>
        )}
      </ol>
    </aside>
  );
}
