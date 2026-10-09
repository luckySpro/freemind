import { t } from "../../i18n/registry";
import "./messages";
// Slim top bar for the start screen: the active section title + a ⌘K command trigger.

const IS_MAC = typeof navigator !== "undefined" && /Mac|iP(hone|ad|od)/.test(navigator.platform);

export function StartHeader({ title, onCommand }: { title: string; onCommand: () => void }) {
  return (
    <header className="st-header">
      <h2>{title}</h2>
      <button
        type="button"
        className="st-cmdk-trigger"
        onClick={onCommand}
        aria-label={t("start.searchAndCommands")}
      >
        <span>{t("start.searchCommands")}</span>
        <span className="st-kbd">{IS_MAC ? "⌘K" : t("start.ctrlK")}</span>
      </button>
    </header>
  );
}
