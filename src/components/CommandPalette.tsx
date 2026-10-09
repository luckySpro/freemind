import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { t } from "../i18n";
import "./CommandPalette.css";

// A generic ⌘K command palette: fuzzy (subsequence) search over a list of commands, arrow-key nav,
// Enter to run, Esc / click-outside to close. The Start screen and the editor both build a
// `Command[]` and render this — the shared substrate behind both palettes. Styled with the `.st-cmdk*`
// classes in the co-located CommandPalette.css (imported above) so they load wherever the palette
// renders — the editor's lazy Start chunk no longer owns them (that left ⌘K unstyled in the editor).

export interface Command {
  id: string;
  label: string;
  /** A short category badge shown on the right (e.g. "view", "export", "panel"). */
  kind: string;
  run: () => void;
  /** When false, the command is hidden (e.g. a selection-dependent action with nothing selected). */
  enabled?: boolean;
  /** Extra text folded into the fuzzy match but NOT displayed — e.g. a topic's note, so "jump to a
   *  topic" finds it by note text too. */
  keywords?: string;
  /** Optional key-binding hint shown inline (e.g. "Ctrl/⌘ + Z"), for commands that have one. */
  shortcut?: string;
}

/** Subsequence match (typo-tolerant enough for a small command set). */
function matches(text: string, q: string): boolean {
  if (!q) return true;
  let i = 0;
  for (const ch of text) {
    if (ch === q[i]) i++;
    if (i === q.length) return true;
  }
  return false;
}

// A small most-recently-used list (commands + jumped-to topics) so reopening ⌘K surfaces what you
// just did. Best-effort localStorage, like the theme + panel prefs.
const RECENT_KEY = "mindmap-cmdk-recent";
const RECENT_MAX = 5;
function loadRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string").slice(0, RECENT_MAX)
      : [];
  } catch {
    return [];
  }
}
function pushRecent(id: string) {
  try {
    const next = [id, ...loadRecent().filter((x) => x !== id)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // best-effort — recents just don't persist
  }
}

/** Forget the most-recently-used command list (the Settings "clear command history" action). */
export function clearRecents() {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    // best-effort
  }
}

export function CommandPalette({
  commands,
  onClose,
  placeholder = "Search commands…",
  makeQueryCommand,
  contextKinds,
  contextLabel,
}: {
  commands: Command[];
  onClose: () => void;
  placeholder?: string;
  /** Optional command derived from the live query, prepended to the list (e.g. "New map: <q>"). */
  makeQueryCommand?: (query: string) => Command | null;
  /** Command kinds that are scoped to the current selection (e.g. "node" / "marker" / "priority"). When
   *  any such command is enabled (= something is selected), the empty-query list leads with them under a
   *  "For the selected topic" header. Omit for generic palettes (e.g. the Start screen). */
  contextKinds?: string[];
  /** Header shown above the context-kind commands (default "For the selected topic"). */
  contextLabel?: string;
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // Restore focus to whatever opened the palette when it's *cancelled* (Esc / click-outside), so
  // keyboard control isn't dropped to <body>. NOT restored after running a command — a command often
  // moves focus on purpose (opens a dialog, focuses a topic), and we mustn't yank it back.
  const openerRef = useRef<HTMLElement | null>(null);
  const ranRef = useRef(false);
  const listId = useId();
  const optionId = (i: number) => `${listId}-opt-${i}`;

  // Focus management — own effect so the save/restore runs exactly once per open (not on every onClose
  // identity change). Capture the opener + focus the input on mount; restore on a cancel unmount.
  useEffect(() => {
    openerRef.current = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => {
      if (!ranRef.current) openerRef.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement)?.closest?.(".st-cmdk")) onClose();
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [onClose]);

  // Snapshot the recents once per open (they're rewritten on run, but we don't want the list to
  // reshuffle under the cursor mid-session).
  const recentIds = useMemo(() => loadRecent(), []);

  const { items, sections } = useMemo<{
    items: Command[];
    sections: { at: number; label: string }[];
  }>(() => {
    const query = q.trim().toLowerCase();
    const enabled = commands.filter((c) => c.enabled !== false);
    if (!query) {
      // Empty query: lead with selection-scoped commands (when something's selected → those kinds are
      // enabled), then the recently-used, then everything else — each under its own section header.
      const context = contextKinds?.length
        ? enabled.filter((c) => contextKinds.includes(c.kind))
        : [];
      const contextSet = new Set(context.map((c) => c.id));
      const recent = recentIds
        .map((id) => enabled.find((c) => c.id === id))
        .filter((c): c is Command => !!c && !contextSet.has(c.id));
      const recentSet = new Set(recent.map((c) => c.id));
      const rest = enabled.filter((c) => !contextSet.has(c.id) && !recentSet.has(c.id));
      const sections: { at: number; label: string }[] = [];
      if (context.length)
        sections.push({ at: 0, label: contextLabel ?? t("app.forTheSelectedTopic") });
      if (recent.length) sections.push({ at: context.length, label: t("toolbar.recent") });
      // "All commands" only earns a header when something sits above it.
      if (rest.length && (context.length || recent.length))
        sections.push({ at: context.length + recent.length, label: t("app.allCommands") });
      return { items: [...context, ...recent, ...rest], sections };
    }
    const matched = enabled.filter((c) =>
      matches(`${c.label} ${c.keywords ?? ""}`.toLowerCase(), query),
    );
    const qc = makeQueryCommand?.(q.trim());
    if (qc) matched.unshift(qc);
    return { items: matched, sections: [] };
  }, [q, commands, makeQueryCommand, recentIds, contextKinds, contextLabel]);

  // Section headers keyed by the item index they precede (Recent / All commands / context group).
  const sectionAt = useMemo(() => {
    const m = new Map<number, string>();
    for (const s of sections) m.set(s.at, s.label);
    return m;
  }, [sections]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset highlight to top when the result set changes.
  useEffect(() => setActive(0), [items.length]);

  // Keep the highlighted row scrolled into view — arrow/Home/End/Page nav can move `active` off-screen
  // in a long list (every export, layout, marker + a jump entry per topic), and aria-activedescendant
  // alone doesn't scroll the listbox.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on each active change.
  useEffect(() => {
    // Optional-call the method too — jsdom (tests) doesn't implement Element.scrollIntoView.
    document.getElementById(optionId(active))?.scrollIntoView?.({ block: "nearest" });
  }, [active]);

  const run = (c: Command | undefined) => {
    if (!c) return;
    ranRef.current = true; // a command ran — don't restore focus to the opener (the command owns focus now)
    // Record only real registry commands (not the synthetic query-derived one) as recent.
    if (commands.some((x) => x.id === c.id)) pushRecent(c.id);
    c.run();
    onClose();
  };

  const sectionStyle = {
    padding: "7px 12px 3px",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.6px",
    textTransform: "uppercase",
    opacity: 0.5,
  } as const;
  // Visually-hidden live region so screen-reader users hear the result count change as they type.
  const srOnly = {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clip: "rect(0,0,0,0)",
    whiteSpace: "nowrap",
    border: 0,
  } as const;

  return (
    <div className="st-cmdk-backdrop" role="presentation">
      <div className="st-cmdk" role="dialog" aria-modal="true" aria-label={t("app.commandPalette")}>
        <input
          ref={inputRef}
          className="st-cmdk-input"
          placeholder={placeholder}
          aria-label={placeholder}
          role="combobox"
          aria-expanded={items.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={items.length ? optionId(active) : undefined}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, items.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Home") {
              e.preventDefault();
              setActive(0);
            } else if (e.key === "End") {
              e.preventDefault();
              setActive(items.length - 1);
            } else if (e.key === "PageDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 8, items.length - 1));
            } else if (e.key === "PageUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 8, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              run(items[active]);
            } else if (e.key === "Tab") {
              // aria-modal promises focus containment. The options are navigated via
              // aria-activedescendant (they're tabIndex=-1), so the input owns focus — keep Tab /
              // Shift+Tab inside the modal instead of escaping to the page behind it.
              e.preventDefault();
            }
          }}
        />
        <div
          className="st-cmdk-list"
          id={listId}
          role="listbox"
          aria-label={t("app.commands")}
          tabIndex={-1}
        >
          {items.length === 0 ? (
            <div className="st-cmdk-empty">{t("app.noMatches2")}</div>
          ) : (
            items.map((c, i) => (
              <Fragment key={c.id}>
                {sectionAt.has(i) ? (
                  <div style={sectionStyle} role="presentation">
                    {sectionAt.get(i)}
                  </div>
                ) : null}
                <button
                  type="button"
                  className="st-cmdk-item"
                  id={optionId(i)}
                  role="option"
                  // Navigated via aria-activedescendant, not real focus — keep them out of the tab
                  // order so the input stays the single focus stop inside the modal.
                  tabIndex={-1}
                  aria-selected={i === active}
                  data-active={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => run(c)}
                >
                  <span>{c.label}</span>
                  {/* Inline key-binding hint (when the command has one) — sits next to the label so a
                      shortcut is discoverable at the point of use. */}
                  {c.shortcut ? <kbd className="st-cmdk-kbd">{c.shortcut}</kbd> : null}
                  {/* Show the kind badge only at the start of each same-kind run, so a long cluster
                      of one kind (e.g. "map") doesn't repeat the label down every row. */}
                  {i === 0 || items[i - 1]?.kind !== c.kind ? (
                    <span className="st-cmdk-kind">{c.kind}</span>
                  ) : null}
                </button>
              </Fragment>
            ))
          )}
        </div>
        <div aria-live="polite" style={srOnly}>
          {items.length === 0
            ? t("app.noMatches")
            : `${items.length} command${items.length === 1 ? "" : "s"}`}
        </div>
      </div>
    </div>
  );
}
