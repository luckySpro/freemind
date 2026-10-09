import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";
import { loadHistory, recordSearch } from "../io/searchHistory";
import { SearchResults } from "./SearchResults";
import type { ToolbarFind } from "./Toolbar";

/**
 * Find & Replace as a non-modal overlay anchored to the top-right of the canvas (opened with
 * Ctrl/⌘+F, the "/" key, or the toolbar's Find button). It owns no state — every input is wired
 * to the shared `useFind` hook via the `ToolbarFind` contract, so live highlighting and Replace
 * behave exactly as they did inline in the toolbar. Esc closes it.
 */
export function FindReplaceOverlay({ find, onClose }: { find: ToolbarFind; onClose: () => void }) {
  const queryRef = useRef<HTMLInputElement>(null);
  // The "all matches" list is a disclosure: collapsed by default to keep the panel compact.
  const [showList, setShowList] = useState(false);
  // Recent searches (item 18): offered as a datalist on the Find box; a search commits the query.
  const [history, setHistory] = useState<string[]>(() => loadHistory());

  // Focus the Find box on open so you can type immediately.
  useEffect(() => {
    queryRef.current?.focus();
    queryRef.current?.select();
  }, []);

  // Run a search AND remember the query in the recent-searches history.
  const runAndRecord = (e: React.FormEvent) => {
    setHistory(recordSearch(find.query));
    find.runSearch(e);
  };

  return (
    // A non-modal, labelled find panel (not a native <dialog>: it must not trap focus or dim the
    // canvas, and jsdom can't render <dialog open>). Esc closes it via the bubbled keydown below.
    <div
      className="mm-find-overlay"
      aria-label={t("panel.findAndReplace")}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="mm-find-head">
        <span className="mm-find-title">{t("panel.findReplace")}</span>
        <button
          type="button"
          className="mm-find-close"
          aria-label={t("panel.closeFind")}
          title={t("panel.closeEsc")}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <form onSubmit={runAndRecord} className="mm-find-body">
        <input
          ref={queryRef}
          className="mm-input"
          value={find.query}
          list="mm-search-history"
          onChange={(e) => find.setQuery(e.target.value)}
          onKeyDown={(e) => {
            // Enter (form submit) goes to the next match; Shift+Enter to the previous one.
            if (e.key === "Enter" && e.shiftKey) {
              e.preventDefault();
              find.findPrev();
            }
          }}
          placeholder={t("panel.findNextPrev")}
          aria-label={t("panel.findNode")}
          title={
            "Find by text, or use operators:\n" +
            'tag:foo  marker:flag-red  priority:1  due:overdue  has:note  level:>=2  -exclude  "exact phrase"'
          }
        />
        <datalist id="mm-search-history">
          {history.map((h) => (
            <option key={h} value={h} />
          ))}
        </datalist>
        <input
          className="mm-input"
          value={find.replaceWith}
          onChange={(e) => find.setReplaceWith(e.target.value)}
          placeholder={t("panel.replace")}
          aria-label={t("panel.replaceWith")}
        />
        <div className="mm-find-row">
          <select
            className="mm-input"
            value={find.replaceScope}
            onChange={(e) => find.setReplaceScope(e.target.value as "topics" | "notes" | "both")}
            aria-label={t("panel.replaceScope")}
            title={t("panel.whereToReplaceTopicsNotes")}
          >
            <option value="topics">{t("panel.topics")}</option>
            <option value="notes">{t("panel.tab.notes")}</option>
            <option value="both">{t("panel.both")}</option>
          </select>
          <button
            type="button"
            className={`mm-toggle-btn${find.matchCase ? " is-on" : ""}`}
            aria-pressed={find.matchCase}
            title={t("panel.matchCase")}
            aria-label={t("panel.matchCase")}
            onClick={() => find.setMatchCase(!find.matchCase)}
          >
            {t("panel.aa")}
          </button>
          <button
            type="button"
            className={`mm-toggle-btn${find.useRegex ? " is-on" : ""}`}
            aria-pressed={find.useRegex}
            title={t("panel.useRegularExpression")}
            aria-label={t("panel.useRegularExpression")}
            onClick={() => find.setUseRegex(!find.useRegex)}
          >
            .*
          </button>
          <button
            type="button"
            className="mm-tbtn mm-tbtn-ghost"
            title={t("panel.replaceTheFindTextIn")}
            onClick={find.runReplace}
          >
            {t("panel.replaceAll")}
          </button>
        </div>
        <div className="mm-find-row">
          <button
            type="button"
            className="mm-tbtn mm-tbtn-ghost"
            title={t("panel.previousMatchShiftEnter")}
            aria-label={t("panel.previousMatch")}
            onClick={find.findPrev}
          >
            ▴
          </button>
          <button
            type="button"
            className="mm-tbtn mm-tbtn-ghost"
            title={t("panel.nextMatchEnter")}
            aria-label={t("panel.nextMatch")}
            onClick={find.findNext}
          >
            ▾
          </button>
          {/* Always-present live region (<output> implies role=status + aria-live=polite) so
              screen-reader users hear "3/12" / "no matches" / "invalid regex" as they cycle — the
              count was previously a silent, button-less span. */}
          <output className="mm-find-info">{find.matchInfo}</output>
          {find.matches.length > 0 && (
            <button
              type="button"
              className="mm-tbtn mm-tbtn-ghost"
              aria-expanded={showList}
              title={t("panel.showEveryMatchAsA")}
              onClick={() => setShowList((v) => !v)}
            >
              {showList ? t("panel.hideList") : t("panel.listAll", { n: find.matches.length })}
            </button>
          )}
        </div>
        {showList && find.matches.length > 0 && (
          <SearchResults
            rows={find.matches.map((m) => ({
              key: m.nodeId,
              topic: m.topic,
              path: m.path,
              snippet: m.snippet,
              payload: m.nodeId,
            }))}
            onPick={find.goTo}
            activeKey={find.activeId}
          />
        )}
      </form>
    </div>
  );
}
