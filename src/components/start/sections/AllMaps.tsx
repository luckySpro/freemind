import { t } from "../../../i18n/registry";
import "../messages";
import { useState } from "react";
import { Button, Input } from "../../../design/primitives";
// `/i18n/registry`, not the barrel: this file is in the lazy Start chunk, and the barrel
// side-effect-imports the EAGER core catalogue, which would drag every chrome string in with it.
import { compareText } from "../../../i18n/registry";
import { createFolder, deleteFolder, moveMapToFolder, renameFolder } from "../../../store/mapStore";
import { timeAgo } from "../../../ui";
import { Dialog } from "../../Dialog";
import { MapCard, type MapEntry } from "../MapCard";
import { handleMapAction } from "../mapActions";
import type { StartContext } from "../types";
import { useFolders, useLibrary } from "../useLibrary";
import { EmptyMaps } from "./EmptyMaps";

// The full library — now organised into folders (C2). At the top level: folder cards + the unfiled
// maps; click a folder to drill in (breadcrumb back). Cards carry a "Move to folder…" kebab action; a
// "＋ New folder" button + a rename/delete on the open folder. Grid ↔ list toggle + sort + search all
// scope to the current view. Additive — a library with no folders reads exactly as before.

type Sort = "edited" | "name" | "nodes";

export function AllMaps({ ctx }: { ctx: StartContext }) {
  const entries = useLibrary(ctx.libraryRev);
  const folders = useFolders(ctx.libraryRev);
  const [folderId, setFolderId] = useState<string | null>(null); // null = top level
  const [sort, setSort] = useState<Sort>("edited");
  const [list, setList] = useState(false);
  const [q, setQ] = useState("");
  // A themed name prompt for New / Rename folder, and the map being moved (its folder picker).
  const [namePrompt, setNamePrompt] = useState<{ id?: string; value: string } | null>(null);
  const [moveEntry, setMoveEntry] = useState<MapEntry | null>(null);

  const folderIds = new Set(folders.map((f) => f.id));
  const openFolder = folderId ? folders.find((f) => f.id === folderId) : null;
  // A map is "in" the current view if: at the top level, it has no folder (or a since-deleted one);
  // inside a folder, its folderId matches. Keeps orphaned maps reachable at the top.
  const inView = (e: MapEntry) =>
    folderId ? e.folderId === folderId : !e.folderId || !folderIds.has(e.folderId);

  const sorted = [...entries.filter(inView)].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    if (sort === "name") return compareText(a.title, b.title);
    if (sort === "nodes") return b.nodeCount - a.nodeCount;
    return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
  });
  const query = q.trim().toLowerCase();
  const shown = query
    ? sorted.filter((e) => (e.title || t("common.untitled")).toLowerCase().includes(query))
    : sorted;
  const countIn = (fid: string) => entries.filter((e) => e.folderId === fid).length;

  const onAction = (action: string, entry: MapEntry) => {
    if (action === "move") setMoveEntry(entry);
    else handleMapAction(action, entry, ctx);
  };

  const submitName = async () => {
    const name = namePrompt?.value ?? "";
    if (!name.trim()) return;
    if (namePrompt?.id) await renameFolder(namePrompt.id, name);
    else await createFolder(name);
    setNamePrompt(null);
    ctx.onLibraryChange();
  };

  const removeFolder = async () => {
    if (!openFolder) return;
    await deleteFolder(openFolder.id);
    setFolderId(null);
    ctx.onLibraryChange();
  };

  const doMove = async (target: string | null) => {
    if (moveEntry) await moveMapToFolder(moveEntry.id, target);
    setMoveEntry(null);
    ctx.onLibraryChange();
  };

  return (
    <div className="st-content">
      <div className="st-row">
        <div>
          <h2 className="st-section-title">
            {openFolder ? (
              <>
                <button
                  type="button"
                  className="st-link"
                  onClick={() => setFolderId(null)}
                  style={{ color: "var(--st-muted)", fontWeight: 600 }}
                >
                  {t("toolbar.allMaps")}
                </button>{" "}
                <span style={{ color: "var(--st-muted)" }}>/</span> {openFolder.name}
              </>
            ) : (
              t("toolbar.allMaps")
            )}
          </h2>
          <p className="st-section-sub">
            {openFolder
              ? `${shown.length} map${shown.length === 1 ? "" : "s"} in this folder.`
              : `${entries.length} map${entries.length === 1 ? "" : "s"} in your library${folders.length ? ` · ${folders.length} folder${folders.length === 1 ? "" : "s"}` : ""}.`}
          </p>
        </div>
        <div className="st-toolbar">
          {openFolder ? (
            <>
              <button
                type="button"
                className="st-btn"
                onClick={() => setNamePrompt({ id: openFolder.id, value: openFolder.name })}
              >
                {t("start.renameFolder")}
              </button>
              <button type="button" className="st-btn" onClick={removeFolder}>
                {t("start.deleteFolder")}
              </button>
            </>
          ) : (
            <button type="button" className="st-btn" onClick={() => setNamePrompt({ value: "" })}>
              {t("start.newFolder2")}
            </button>
          )}
          <input
            className="st-input"
            style={{ width: 160 }}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("start.searchYourMaps")}
            aria-label={t("start.searchYourMaps2")}
          />
          <select
            className="st-select"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            aria-label={t("start.sortMaps")}
          >
            <option value="edited">{t("start.recentlyEdited")}</option>
            <option value="name">{t("start.nameAZ")}</option>
            <option value="nodes">{t("start.mostNodes")}</option>
          </select>
          <button type="button" className="st-btn" onClick={() => setList((v) => !v)}>
            {list ? "▦ Grid" : "☰ List"}
          </button>
        </div>
      </div>

      {/* Folder cards — only at the top level and only when not filtering by text. */}
      {!openFolder && !query && folders.length > 0 ? (
        <div className="st-grid" style={{ marginBottom: 18 }}>
          {folders.map((f) => (
            <button
              key={f.id}
              type="button"
              className="st-card st-card-hover st-tile"
              onClick={() => setFolderId(f.id)}
              style={{ textAlign: "left", cursor: "pointer" }}
              title={t("start.openFolder", { name: f.name })}
            >
              <div
                className="st-thumb"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 34,
                }}
              >
                📁
              </div>
              <div className="st-tile-body">
                <div className="st-card-title">{f.name}</div>
                <div className="st-card-meta">{t("count.maps", { n: countIn(f.id) })}</div>
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {entries.length === 0 ? (
        <EmptyMaps ctx={ctx} />
      ) : shown.length === 0 ? (
        <div className="st-empty">
          {query ? t("start.noMapsMatch", { query: q }) : t("start.noMapsHereYetMove")}
        </div>
      ) : list ? (
        <div className="st-list">
          {shown.map((e) => (
            <div key={e.id} className="st-list-row">
              <button
                type="button"
                className="st-link"
                style={{ flex: 1, textAlign: "left", color: "var(--st-ink)", fontWeight: 600 }}
                onClick={() => handleMapAction("open", e, ctx)}
              >
                {e.title || t("common.untitled")}
              </button>
              <span className="st-card-meta">
                {t("count.nodes", { n: e.nodeCount })}
                {e.updatedAt ? ` · ${timeAgo(e.updatedAt)}` : ""}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="st-grid">
          {shown.map((e) => (
            <MapCard key={e.id} entry={e} onAction={onAction} />
          ))}
        </div>
      )}

      {/* New / rename folder — a themed name prompt (the Start screen has no DialogHost). */}
      <Dialog
        open={namePrompt != null}
        onClose={() => setNamePrompt(null)}
        title={namePrompt?.id ? t("start.renameFolder") : t("start.newFolder")}
        style={{ width: "min(92vw, 320px)", padding: 20 }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitName();
          }}
        >
          <Input
            value={namePrompt?.value ?? ""}
            onChange={(e) => setNamePrompt((p) => (p ? { ...p, value: e.target.value } : p))}
            placeholder={t("start.folderName")}
            aria-label={t("start.folderName")}
            style={{ width: "100%", marginBottom: 12 }}
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button type="button" onClick={() => setNamePrompt(null)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit">{namePrompt?.id ? t("common.rename") : t("start.create")}</Button>
          </div>
        </form>
      </Dialog>

      {/* Move a map to a folder. */}
      <Dialog
        open={moveEntry != null}
        onClose={() => setMoveEntry(null)}
        title={t("start.moveNamedTo", { name: moveEntry?.title || t("common.untitled") })}
        style={{ width: "min(92vw, 320px)", padding: 20 }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <Button
            onClick={() => void doMove(null)}
            style={{ justifyContent: "flex-start", width: "100%" }}
          >
            {t("start.topLevelNoFolder")}
          </Button>
          {folders.map((f) => (
            <Button
              key={f.id}
              onClick={() => void doMove(f.id)}
              style={{ justifyContent: "flex-start", width: "100%" }}
            >
              📁 {f.name}
            </Button>
          ))}
          <Button
            onClick={async () => {
              const f = await createFolder(`Folder ${folders.length + 1}`);
              if (f) await doMove(f.id);
            }}
            style={{ justifyContent: "flex-start", width: "100%", opacity: 0.85 }}
          >
            {t("start.newFolderMoveHere")}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
