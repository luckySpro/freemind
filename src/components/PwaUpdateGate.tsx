import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";
import { OrganizationInfo } from "./OrganizationInfo";

/** A waiting service worker has already downloaded the new app; preserve edits before activating it. */
export default function PwaUpdateGate({
  beforeInstall,
  onBackup,
  refresh,
}: {
  beforeInstall: () => Promise<void>;
  onBackup: () => Promise<void>;
  refresh: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const preventCancel = (event: Event) => event.preventDefault();
    const restore = () => {
      if (!element.open && element.isConnected) element.showModal();
    };
    element.addEventListener("cancel", preventCancel);
    element.addEventListener("close", restore);
    restore();
    return () => {
      element.removeEventListener("cancel", preventCancel);
      element.removeEventListener("close", restore);
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="pwa-update-title"
      onCancel={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === "Escape") event.preventDefault();
        event.stopPropagation();
      }}
      style={{
        border: "none",
        borderRadius: 16,
        padding: 28,
        width: "min(440px, calc(100vw - 48px))",
        background: "var(--ed-card, #fff)",
        color: "var(--ed-ink, #23211c)",
      }}
    >
      <h2 id="pwa-update-title">{t("updates.required")}</h2>
      <p>{t("updates.pwaBody")}</p>
      <p style={{ fontSize: 13 }}>{t("updates.offlineHelp")}</p>
      {error && <p role="alert">{error}</p>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "18px 0" }}>
        <button
          type="button"
          className="mm-map-control"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await beforeInstall();
              await refresh();
            } catch (cause) {
              setError(
                t("updates.installFailed", {
                  error: cause instanceof Error ? cause.message : String(cause),
                }),
              );
              setBusy(false);
            }
          }}
        >
          {busy ? t("updates.saving") : t("updates.install")}
        </button>
        <button
          type="button"
          className="mm-map-control"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await onBackup();
            } catch (cause) {
              setError(
                t("updates.backupFailed", {
                  error: cause instanceof Error ? cause.message : String(cause),
                }),
              );
            } finally {
              setBusy(false);
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
