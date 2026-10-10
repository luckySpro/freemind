import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";
import {
  type UpdateInfo,
  type UpdateProgress,
  checkForUpdate,
  installUpdate,
  restartAfterUpdate,
} from "../update/desktopUpdater";
import { OrganizationInfo } from "./OrganizationInfo";

interface UpdateGateProps {
  checkNonce: number;
  beforeInstall: () => Promise<void>;
  onBackup: () => Promise<void>;
  onCheckResult: (result: "current" | "failed") => void;
}

/** Only a verified newer release blocks editing. Offline and first-run check failures stay usable. */
export default function UpdateGate({
  checkNonce,
  beforeInstall,
  onBackup,
  onCheckResult,
}: UpdateGateProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [phase, setPhase] = useState<"ready" | "saving" | "downloading" | "restarting">("ready");
  const [progress, setProgress] = useState<UpdateProgress>({ downloaded: 0 });
  const [error, setError] = useState("");
  const [manualOpened, setManualOpened] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [accelerated, setAccelerated] = useState(true);
  const busy = useRef(false);
  const callbacks = useRef({ beforeInstall, onBackup, onCheckResult });
  callbacks.current = { beforeInstall, onBackup, onCheckResult };

  useEffect(() => {
    let live = true;
    let checking = false;
    async function check(manual = false) {
      if (checking || busy.current) return;
      checking = true;
      try {
        const result = await checkForUpdate();
        if (!live) return;
        if (result) setUpdate(result);
        else if (manual) callbacks.current.onCheckResult("current");
      } catch {
        if (live && manual) callbacks.current.onCheckResult("failed");
      } finally {
        checking = false;
      }
    }
    void check(checkNonce > 0);
    const timer = window.setInterval(() => void check(), 60 * 60 * 1000);
    const resumed = () => void check();
    window.addEventListener("online", resumed);
    window.addEventListener("focus", resumed);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener("online", resumed);
      window.removeEventListener("focus", resumed);
    };
  }, [checkNonce]);

  useEffect(() => {
    if (update && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [update]);

  async function install() {
    if (!update || busy.current) return;
    busy.current = true;
    setError("");
    setProgress({ downloaded: 0 });
    setPhase("saving");
    try {
      await callbacks.current.beforeInstall();
      setPhase("downloading");
      await installUpdate(update, setProgress, accelerated);
      if (update.kind === "manual") {
        setManualOpened(true);
        setPhase("ready");
      } else {
        setPhase("restarting");
        await restartAfterUpdate();
      }
    } catch (cause) {
      setError(
        t("updates.installFailed", {
          error: cause instanceof Error ? cause.message : String(cause),
        }),
      );
      setPhase("ready");
    } finally {
      busy.current = false;
    }
  }

  if (!update) return null;
  const percent = progress.total
    ? Math.min(100, Math.round((progress.downloaded / progress.total) * 100))
    : null;
  return (
    <dialog
      ref={dialog}
      aria-labelledby="required-update-title"
      onCancel={(event) => event.preventDefault()}
      onKeyDown={(event) => event.stopPropagation()}
      style={{
        border: "none",
        borderRadius: 16,
        padding: 28,
        width: "min(480px, calc(100vw - 48px))",
        color: "var(--ed-ink, #23211c)",
        background: "var(--ed-card, #fff)",
        boxShadow: "0 18px 70px #0005",
      }}
    >
      <h2 id="required-update-title" style={{ margin: "0 0 10px", fontSize: 22 }}>
        {t("updates.required")}
      </h2>
      <p>{t("updates.requiredBody", { current: update.currentVersion, next: update.version })}</p>
      <p style={{ fontSize: 13 }}>{t("updates.offlineHelp")}</p>
      {update.notes && (
        <details>
          <summary>{t("updates.releaseNotes")}</summary>
          <p style={{ whiteSpace: "pre-wrap", maxHeight: 180, overflow: "auto", fontSize: 13 }}>
            {update.notes}
          </p>
        </details>
      )}
      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          margin: "18px 0 6px",
          fontSize: 13,
        }}
      >
        <input
          type="checkbox"
          checked={accelerated}
          disabled={phase !== "ready"}
          onChange={(event) => setAccelerated(event.target.checked)}
        />
        {t("updates.acceleration")}
      </label>
      <p style={{ fontSize: 12, opacity: 0.75, margin: "0 0 16px" }}>
        {t("updates.accelerationHelp")}
      </p>
      {phase !== "ready" && (
        <output style={{ display: "block", margin: "16px 0" }}>
          {phase === "saving"
            ? t("updates.saving")
            : phase === "restarting"
              ? t("updates.restarting")
              : t("updates.downloading", {
                  progress:
                    percent === null
                      ? `${(progress.downloaded / 1048576).toFixed(1)} MB`
                      : `${percent}%`,
                })}
        </output>
      )}
      {phase === "downloading" && (
        <progress max={100} value={percent ?? undefined} style={{ width: "100%" }} />
      )}
      {manualOpened && (
        <output style={{ display: "block", margin: "16px 0" }}>{t("updates.manualHelp")}</output>
      )}
      {error && (
        <p role="alert" style={{ color: "var(--ed-danger, #b42318)", fontSize: 13 }}>
          {error}
        </p>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "18px 0" }}>
        <button
          type="button"
          className="mm-map-control"
          disabled={phase !== "ready" || backupBusy}
          onClick={() => void install()}
        >
          {error
            ? t("updates.retry")
            : update.kind === "manual"
              ? t("updates.manualInstall")
              : t("updates.install")}
        </button>
        <button
          type="button"
          className="mm-map-control"
          disabled={phase !== "ready" || backupBusy}
          onClick={async () => {
            setBackupBusy(true);
            try {
              await callbacks.current.onBackup();
            } catch (cause) {
              setError(
                t("updates.backupFailed", {
                  error: cause instanceof Error ? cause.message : String(cause),
                }),
              );
            } finally {
              setBackupBusy(false);
            }
          }}
        >
          {t("updates.backup")}
        </button>
      </div>
      <OrganizationInfo />
    </dialog>
  );
}
