import { useState } from "react";
import { DateChip } from "./Badge";
import { ProgressPie } from "./ProgressPie";
import {
  type BoardColumn,
  type BoardSource,
  CARD_DND_TYPE,
  bucketDueDate,
  buildBoard,
  reMarkForMove,
  retagForMove,
} from "./board";
import { t } from "./i18n";
import { MARKER_GROUPS } from "./icons";
import type { MindMapDoc } from "./model/types";
import { isOverdue, todayISO } from "./taskDate";
import { controlStyle } from "./ui";

// A Kanban board: the map's topics grouped into columns by a chosen SOURCE — tags, a single-select
// marker group (Priority/Status/Mood/Vote), or a schedule of date buckets. Click a card to jump to
// that topic on the canvas; DRAG a card between columns to re-tag / re-mark / re-schedule the topic
// (one undoable edit). Rendered in place of the canvas while open; themed via --ed-*.

/** The column-source options shown in the header selector.
 *
 *  A FUNCTION, not a module-level const. The spread over MARKER_GROUPS reads `g.name` once — and
 *  `g.name` is now a getter precisely so it follows the locale, which a module-scope materialisation
 *  would undo. The frozen-t() detector cannot see that: it counts `t(` calls, and this file has none
 *  in the spread, so the re-freeze would have been silent and scored 0. */
function sources(): { value: string; label: string; source: BoardSource }[] {
  return [
    { value: "tag", label: t("common.tags"), source: { kind: "tag" } },
    ...MARKER_GROUPS.map((g) => ({
      value: `marker:${g.id}`,
      label: g.name,
      source: { kind: "marker" as const, group: g.id },
    })),
    { value: "schedule", label: t("app.scheduleDates"), source: { kind: "schedule" } },
  ];
}

/** A card's payload carried on the drag (its full tag/marker set, so the drop can compute the change). */
interface DragPayload {
  id: string;
  tags: string[];
  icons: string[];
}

export function Kanban({
  doc,
  onPick,
  onRetag,
  onSetMarkers,
  onSetDue,
  onClose,
}: {
  doc: MindMapDoc;
  /** Focus a topic on the canvas (and close the board). */
  onPick: (id: string) => void;
  /** Replace a topic's tags (tag board drop). */
  onRetag: (id: string, tags: string[]) => void;
  /** Replace a topic's markers (marker board drop). */
  onSetMarkers: (id: string, icons: string[]) => void;
  /** Set / clear a topic's due date (schedule board drop). */
  onSetDue: (id: string, due: string | undefined) => void;
  onClose: () => void;
}) {
  const [sourceValue, setSourceValue] = useState("tag");
  const source = sources().find((s) => s.value === sourceValue)?.source ?? { kind: "tag" };
  const today = todayISO();
  const columns = buildBoard(doc, source, today);

  // Resolve a drop on `col` into the right model change for the active source.
  const onDrop = (payload: DragPayload, col: BoardColumn) => {
    if (source.kind === "tag") {
      // `col.key` is the target tag; the source tag is whichever of the card's tags this came from —
      // but retagForMove only needs the target set, so recompute from the card's current tags.
      const from = payload.tags.length === 0 ? "" : (payload.tags.find(() => true) ?? "");
      onRetag(payload.id, retagForMove(payload.tags, from, col.key));
    } else if (source.kind === "marker") {
      onSetMarkers(payload.id, reMarkForMove(payload.icons, source.group, col.key));
    } else {
      onSetDue(payload.id, bucketDueDate(col.key, today));
    }
  };

  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--ed-page)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          padding: "8px 14px",
          borderBottom: "1px solid var(--ed-border)",
        }}
      >
        <strong style={{ color: "var(--ed-ink)" }}>▦ {t("panel.board")}</strong>
        <label style={{ display: "flex", alignItems: "center", gap: 6, marginRight: "auto" }}>
          <span style={{ color: "var(--ed-muted)", fontSize: 12 }}>{t("app.groupBy")}</span>
          <select
            className="mm-select"
            value={sourceValue}
            onChange={(e) => setSourceValue(e.target.value)}
            aria-label={t("app.groupTheBoardBy")}
          >
            {sources().map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={onClose} style={controlStyle}>
          {t("app.closeBoard")}
        </button>
      </div>
      {columns.length === 0 ? (
        <div style={{ padding: 24, color: "var(--ed-muted)", fontSize: 14 }}>
          {t("app.noTopicsYet")}
        </div>
      ) : (
        <div
          style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", gap: 12, padding: 14 }}
        >
          {columns.map((col) => (
            <Column
              key={col.key || "__none"}
              col={col}
              today={today}
              onPick={onPick}
              onDrop={onDrop}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Column({
  col,
  today,
  onPick,
  onDrop,
}: {
  col: BoardColumn;
  today: string;
  onPick: (id: string) => void;
  onDrop: (payload: DragPayload, col: BoardColumn) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div
      style={{
        width: 240,
        flexShrink: 0,
        background: dragOver ? "var(--ed-accent-tint)" : "var(--ed-sidebar)",
        border: `1px solid ${dragOver ? "var(--ed-accent)" : "var(--ed-border)"}`,
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        maxHeight: "100%",
        transition: "background 0.1s ease, border-color 0.1s ease",
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(CARD_DND_TYPE)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setDragOver(true);
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        setDragOver(false);
        const raw = e.dataTransfer.getData(CARD_DND_TYPE);
        if (!raw) return;
        e.preventDefault();
        onDrop(JSON.parse(raw) as DragPayload, col);
      }}
    >
      <div
        style={{
          padding: "8px 10px",
          fontSize: 13,
          fontWeight: 700,
          color: "var(--ed-ink)",
          borderBottom: "1px solid var(--ed-border)",
        }}
      >
        {col.label}{" "}
        <span style={{ color: "var(--ed-muted)", fontWeight: 400 }}>· {col.cards.length}</span>
      </div>
      <div
        style={{ overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 6 }}
      >
        {col.cards.map((card) => {
          const overdue = isOverdue(
            card.due,
            card.progress === undefined ? undefined : card.progress / 100,
            today,
          );
          return (
            <button
              key={card.id}
              type="button"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  CARD_DND_TYPE,
                  JSON.stringify({ id: card.id, tags: card.tags, icons: card.icons }),
                );
                e.dataTransfer.effectAllowed = "move";
              }}
              onClick={() => onPick(card.id)}
              title={t("app.dragToAnotherColumnTo")}
              style={{
                textAlign: "left",
                background: "var(--ed-card)",
                border: "1px solid var(--ed-border)",
                borderRadius: 8,
                padding: "6px 8px",
                cursor: "grab",
                color: "var(--ed-ink)",
                fontSize: 13,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <span>{card.topic || t("common.untitled")}</span>
              {card.progress !== undefined || card.due ? (
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                  {card.progress !== undefined ? (
                    <ProgressPie fraction={card.progress / 100} size={14} />
                  ) : null}
                  {card.due ? <DateChip due={card.due} overdue={overdue} variant="text" /> : null}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
