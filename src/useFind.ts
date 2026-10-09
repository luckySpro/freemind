import { type FormEvent, type RefObject, useEffect, useMemo, useState } from "react";
import type { MindMapHandle } from "./mindmap";
import type { MindMapDoc } from "./model/types";
import { findDocHits } from "./search";

// Header "Find" behaviour: match nodes by topic/note, focus each on the canvas,
// and cycle through hits on repeated Enter. Kept out of App as a self-contained
// hook; the matching itself lives in the pure, unit-tested `findDocHits`.
export type ReplaceScope = "topics" | "notes" | "both";

export function useFind(mapRef: RefObject<MindMapHandle | null>, getDoc: () => MindMapDoc) {
  const [query, setQuery] = useState("");
  const [replaceWith, setReplaceWith] = useState("");
  const [replaceScope, setReplaceScope] = useState<ReplaceScope>("topics");
  const [useRegex, setUseRegex] = useState(false);
  const [matchCase, setMatchCase] = useState(false);
  const [matchInfo, setMatchInfo] = useState("");
  // The id currently focused by the cycler / list — drives the active-row highlight in the overlay.
  const [activeId, setActiveId] = useState<string | null>(null);

  // The full match list (topic + breadcrumb + snippet), recomputed when the query changes — shared by
  // the next/prev cycler AND the overlay's "all matches" list, so the two can't disagree on order.
  // Recomputed on query change; a live edit while the overlay is open is a rare edge we don't chase.
  // biome-ignore lint/correctness/useExhaustiveDependencies: getDoc is a stable ref-reader; keyed on query.
  const matches = useMemo(() => findDocHits(getDoc(), query), [query]);

  // A new query starts the cycle fresh: drop the old highlight (its node may not even be a match now)
  // so the next/prev step begins at the first/last hit rather than mid-list.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset-on-query-change; the body reads nothing.
  useEffect(() => setActiveId(null), [query]);

  // Focus a match by index, updating the cursor + counter + active highlight. Shared by the cycler
  // (step) and a direct list pick (goTo).
  function focusAt(i: number) {
    const id = matches[i].nodeId;
    setActiveId(id);
    mapRef.current?.focusNode(id);
    setMatchInfo(`${i + 1}/${matches.length}`);
  }

  // Move to the next (dir=1) or previous (dir=-1) match, cycling and restarting when the query
  // changes. Shared by Enter (next), the on-screen Next/Prev buttons, and Shift+Enter (prev).
  function step(dir: 1 | -1) {
    if (matches.length === 0) {
      setMatchInfo(query.trim() ? "no matches" : "");
      setActiveId(null);
      return;
    }
    const len = matches.length;
    const i =
      activeId !== null
        ? (matches.findIndex((m) => m.nodeId === activeId) + dir + len) % len
        : dir === 1
          ? 0
          : len - 1;
    focusAt(i);
  }

  /** Jump straight to a specific match id (an "all matches" list click). */
  function goTo(id: string) {
    const i = matches.findIndex((m) => m.nodeId === id);
    if (i >= 0) focusAt(i);
  }

  function runSearch(event: FormEvent) {
    event.preventDefault();
    step(1);
  }
  const findNext = () => step(1);
  const findPrev = () => step(-1);

  function runReplace() {
    const scope = {
      topics: replaceScope !== "notes",
      notes: replaceScope !== "topics",
      regex: useRegex,
      matchCase,
    };
    const n = mapRef.current?.replaceTopics(query, replaceWith, scope) ?? 0;
    // -1 signals a malformed regex pattern (only possible when `regex` is on).
    setMatchInfo(n < 0 ? "invalid regex" : n > 0 ? `replaced ${n}` : "no matches");
  }

  return {
    query,
    setQuery,
    replaceWith,
    setReplaceWith,
    replaceScope,
    setReplaceScope,
    useRegex,
    setUseRegex,
    matchCase,
    setMatchCase,
    matchInfo,
    matches,
    activeId,
    goTo,
    runSearch,
    findNext,
    findPrev,
    runReplace,
  };
}
