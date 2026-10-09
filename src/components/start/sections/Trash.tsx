import { t } from "../../../i18n/registry";
import "../messages";
import { deleteMap, emptyTrash, restoreMapFromTrash } from "../../../store/mapStore";
import type { StartContext } from "../types";
import { useTrashMaps } from "../useLibrary";

// The Trash: soft-deleted maps, recoverable until permanently removed. Restore puts a map back in the
// library; "Delete forever" / "Empty Trash" are the only permanent deletes (they drop the map + its
// version history + disk-file binding). Reads the store directly, like the other library sections.

export function Trash({ ctx }: { ctx: StartContext }) {
  const entries = useTrashMaps(ctx.libraryRev);
  const restore = async (id: string) => {
    await restoreMapFromTrash(id);
    ctx.onLibraryChange();
  };
  const purge = async (id: string) => {
    await deleteMap(id);
    ctx.onLibraryChange();
  };
  const empty = async () => {
    await emptyTrash();
    ctx.onLibraryChange();
  };

  return (
    <div className="st-content">
      <section>
        <h2 className="st-section-title">{t("start.trash")}</h2>
        <p className="st-section-sub">{t("start.trashBlurb")}</p>
      </section>
      {entries.length === 0 ? (
        <p style={{ color: "var(--st-muted)" }}>{t("start.trashIsEmpty")}</p>
      ) : (
        <section>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            <button
              type="button"
              className="st-btn"
              onClick={empty}
              style={{ color: "var(--st-danger, #b23b3a)" }}
            >
              {t("start.emptyTrashCount", { n: entries.length })}
            </button>
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
            {entries.map((e) => (
              <li
                key={e.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  border: "1px solid var(--st-border, #e2e0d8)",
                  borderRadius: 8,
                }}
              >
                <span
                  style={{
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {e.title || t("common.untitled")}
                </span>
                <button type="button" className="st-btn" onClick={() => restore(e.id)}>
                  {t("common.restore")}
                </button>
                <button
                  type="button"
                  className="st-btn"
                  onClick={() => purge(e.id)}
                  style={{ color: "var(--st-danger, #b23b3a)" }}
                >
                  {t("start.deleteForever")}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
