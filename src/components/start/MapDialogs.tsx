import { t } from "../../i18n/registry";
import "./messages";
import { useRef, useState } from "react";
import { typeScale } from "../../design/tokens";
import { softDeleteMap } from "../../store/mapStore";
import { Dialog } from "../Dialog";
import { renameMapTitle } from "./mapActions";

// The themed rename + delete-confirm dialogs for a library map — replacing the jarring native
// window.prompt / window.confirm (which ignore the app theme and, in some PWAs, return null silently).
// StartScreen owns the `pending` state (set by the MapCard kebab via StartContext) and renders this; on
// confirm we run the store op and refresh. Styled with the --st-* tokens so it follows the Start theme
// (the editor Dialog's --ed-* fallbacks would be light-only here).

export type PendingMapAction =
  | { kind: "rename"; id: string; title: string }
  | { kind: "delete"; id: string; title: string }
  | null;

const SURFACE = {
  background: "var(--st-card)",
  color: "var(--st-ink)",
  boxShadow: "var(--st-shadow, 0 20px 60px rgba(0, 0, 0, 0.3))",
  maxWidth: 380,
  width: "calc(100% - 32px)",
  padding: 20,
} as const;

export function MapDialogs({
  pending,
  onClose,
  onDone,
}: {
  pending: PendingMapAction;
  /** Close the dialog (clear the pending action). */
  onClose: () => void;
  /** A store op completed (rename/delete) — refresh the library. */
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const renaming = pending?.kind === "rename";
  const deleting = pending?.kind === "delete";

  const confirmRename = async () => {
    const next = name.trim();
    if (pending?.kind === "rename" && next) {
      await renameMapTitle(pending.id, next);
      onDone();
    }
    onClose();
  };
  const confirmDelete = async () => {
    if (pending?.kind === "delete") {
      await softDeleteMap(pending.id); // to the Trash (recoverable), not destroyed
      onDone();
    }
    onClose();
  };

  // Mount only the active dialog (not both always-on) so there's a single Cancel/confirm pair in the
  // tree at a time. Each is `open` from mount, so the wrapper's effect runs showModal() immediately.
  return (
    <>
      {renaming ? (
        <Dialog
          open
          onClose={onClose}
          ariaLabel={t("start.renameMap")}
          onOpen={() => {
            setName(pending?.kind === "rename" ? pending.title : "");
            inputRef.current?.focus();
          }}
          style={SURFACE}
        >
          <h3 style={{ ...typeScale.title, margin: "0 0 12px" }}>{t("start.renameMap")}</h3>
          <input
            ref={inputRef}
            className="st-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmRename();
            }}
            placeholder={t("start.mapName")}
            aria-label={t("start.newMapName")}
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
            <button type="button" className="st-btn" onClick={onClose}>
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="st-btn st-btn-primary"
              disabled={!name.trim()}
              onClick={confirmRename}
            >
              {t("common.rename")}
            </button>
          </div>
        </Dialog>
      ) : null}

      {deleting ? (
        <Dialog open onClose={onClose} ariaLabel={t("cmd.delete-map")} style={SURFACE}>
          <h3 style={{ ...typeScale.title, margin: "0 0 8px" }}>{t("start.moveMapToTrash")}</h3>
          <p style={{ margin: "0 0 4px", color: "var(--st-ink2)" }}>
            {t("start.moveMapToTrashConfirm", {
              name: pending?.kind === "delete" ? pending.title || t("common.untitled") : "",
            })}
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
            <button type="button" className="st-btn" onClick={onClose}>
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="st-btn"
              style={{
                background: "var(--st-danger, #b23b3a)",
                borderColor: "var(--st-danger, #b23b3a)",
                color: "#fff",
              }}
              onClick={confirmDelete}
            >
              {t("start.moveToTrash")}
            </button>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
