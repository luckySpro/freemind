import { registerSW } from "virtual:pwa-register";

// A waiting worker has fully downloaded the new build. App supplies a required-update
// gate that saves the current map before activation; callers without that UI retain
// the original toast fallback. Registration remains "prompt": no silent reload can
// discard a debounced edit. Native clients use the signed installer updater instead.

export type ToastKind = "info" | "success";
export interface ToastAction {
  label: string;
  run: () => void;
}
export interface ToastOptions {
  action?: ToastAction;
  durationMs?: number;
}
export type ShowToast = (kind: ToastKind, message: string, opts?: ToastOptions) => void;

let registered = false;
let cachedUpdateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;
let toast: ShowToast | null = null;
let requiredUpdate: ((refresh: () => Promise<void>) => void) | null = null;

/** Canonical "New version… Refresh now" prompt. Shared by the plugin's
 *  onNeedRefresh callback and the manual-check already-waiting branch. */
const showUpdateAvailableToast = (): void => {
  const refresh = cachedUpdateSW;
  if (refresh && requiredUpdate) {
    requiredUpdate(() => refresh(true));
    return;
  }
  toast?.("info", "A new version is available.", {
    action: refresh
      ? {
          label: "Refresh now",
          run: () => {
            void refresh(true);
          },
        }
      : undefined,
    durationMs: 15000,
  });
};

/** Register the SW once and wire its update/offline callbacks to the app's toast. */
export const initPwaUpdateToast = (
  showToast: ShowToast,
  onRequiredUpdate?: (refresh: () => Promise<void>) => void,
): void => {
  if (registered || typeof window === "undefined") return;
  registered = true;
  toast = showToast;
  requiredUpdate = onRequiredUpdate ?? null;
  // registerSW() registers the generated SW and returns updateSW(reload?); we hoist
  // it to module scope so the manual "Check for updates" path can drive it too.
  cachedUpdateSW = registerSW({
    onNeedRefresh: () => showUpdateAvailableToast(),
    onOfflineReady: () => toast?.("success", "Ready to use offline."),
  });
};

/**
 * Outcomes of a manual update check:
 *  - 'unsupported'     no SW API / no registration yet (jsdom, plain http://, fresh
 *                      first visit before the SW lands)
 *  - 'already-pending' an update was already waiting; we re-surfaced the "Refresh now"
 *                      prompt, so the caller adds nothing
 *  - 'newly-found'     update() fetched a new SW (installing/waiting); the onNeedRefresh
 *                      hook will prompt when install completes
 *  - 'up-to-date'      check completed, no new worker
 */
export type UpdateCheckResult = "unsupported" | "already-pending" | "newly-found" | "up-to-date";

/** Force a SW update check (the browser otherwise checks on each load + ~24h). */
export const checkForUpdate = async (): Promise<UpdateCheckResult> => {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return "unsupported";
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return "unsupported";
  // Already waiting — the user likely dismissed the earlier prompt. Re-surface it
  // rather than firing a second, redundant "found an update" message.
  if (reg.waiting) {
    showUpdateAvailableToast();
    return "already-pending";
  }
  try {
    await reg.update();
  } catch {
    return "unsupported";
  }
  if (reg.installing || reg.waiting) return "newly-found";
  return "up-to-date";
};

// Test-only: clear the module guards so the first-call branch can be re-exercised.
export const __resetPwaUpdateForTest = (): void => {
  registered = false;
  cachedUpdateSW = null;
  toast = null;
  requiredUpdate = null;
};
