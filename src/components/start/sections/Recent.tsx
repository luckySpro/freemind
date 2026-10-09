import { t } from "../../../i18n/registry";
import "../messages";
import { MapCard, type MapEntry } from "../MapCard";
import { handleMapAction } from "../mapActions";
import type { StartContext } from "../types";
import { useLibrary } from "../useLibrary";
import { EmptyMaps } from "./EmptyMaps";

// Saved maps grouped by last-edited. Finer buckets than Today/Yesterday/Earlier so a returning user
// with weeks of history gets temporal landmarks instead of one undifferentiated "Earlier" wall.
// ("Not yet saved" covers any map without a timestamp.)

// Buckets are keyed by a STABLE ID, never by the rendered label.
//
// They used to be keyed by the label, and it was a data-loss bug waiting on a second locale rather
// than a cosmetic one. `GROUPS` held `t("start.earlierThisWeek")` while `groupOf()` returned the
// English literal `"Earlier this week"`; those agree only while the catalogue is English. Add a second
// locale and `byGroup.has(g)` stops matching for three of the six buckets, so those sections — and
// every map inside them — vanish from Recent entirely. The user would see maps disappear, not a
// translation glitch.
//
// The type system could not have caught it: `t()` returns `string`, so `(typeof GROUPS)[number]`
// collapsed to `string` and `groupOf()` was free to return anything. The ids below are real literals,
// so `GroupId` is a real union and a typo in `groupOf` now fails `tsc`.
//
// `label` is a getter so it resolves at RENDER time. A plain `t()` here would be evaluated once, when
// this module is imported, and freeze — the same defect this file is fixing, one level up.
const GROUPS = [
  {
    id: "today",
    get label() {
      return t("start.today");
    },
  },
  {
    id: "yesterday",
    get label() {
      return t("start.yesterday");
    },
  },
  {
    id: "week",
    get label() {
      return t("start.earlierThisWeek");
    },
  },
  {
    id: "month",
    get label() {
      return t("start.thisMonth");
    },
  },
  {
    id: "older",
    get label() {
      return t("start.older");
    },
  },
  {
    id: "unsaved",
    get label() {
      return t("start.notYetSaved");
    },
  },
] as const;
type GroupId = (typeof GROUPS)[number]["id"];

const DAY = 86_400_000;

function groupOf(ts: number | undefined): GroupId {
  if (!ts) return "unsaved";
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (ts >= startToday) return "today";
  if (ts >= startToday - DAY) return "yesterday";
  if (ts >= startToday - 7 * DAY) return "week";
  if (ts >= new Date(now.getFullYear(), now.getMonth(), 1).getTime()) return "month";
  return "older";
}

export function Recent({ ctx }: { ctx: StartContext }) {
  const entries = [...useLibrary(ctx.libraryRev)].sort(
    (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
  );
  const byGroup = new Map<GroupId, MapEntry[]>();
  for (const e of entries) {
    const g = groupOf(e.updatedAt);
    const arr = byGroup.get(g);
    if (arr) arr.push(e);
    else byGroup.set(g, [e]);
  }

  return (
    <div className="st-content">
      <section>
        <h2 className="st-section-title">{t("toolbar.recent")}</h2>
        <p className="st-section-sub">{t("start.yourMapsNewestFirst")}</p>
      </section>
      {entries.length === 0 ? (
        <EmptyMaps ctx={ctx} />
      ) : (
        GROUPS.filter((g) => byGroup.has(g.id)).map((g) => (
          // key on the id, not the label — a locale-dependent React key remounts the subtree on every
          // language change, and collides outright if two buckets translate to the same word.
          <section key={g.id}>
            <h3 className="st-section-title" style={{ fontSize: 13, color: "var(--st-muted)" }}>
              {g.label}
            </h3>
            <div className="st-grid" style={{ marginTop: 10 }}>
              {(byGroup.get(g.id) ?? []).map((e) => (
                <MapCard key={e.id} entry={e} onAction={(a, en) => handleMapAction(a, en, ctx)} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
