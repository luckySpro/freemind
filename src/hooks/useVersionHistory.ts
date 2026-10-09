import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { editorConfirm } from "../components/editorDialogs";
import { nextPlaybackIndex } from "../historyPlayback";
import { t } from "../i18n";
import type { MindMapDoc } from "../model/types";
import {
  type VersionMeta,
  type VersionSnapshot,
  latestVersionDoc,
  listVersions,
  loadAllVersions,
  loadVersion,
  saveMap,
  saveVersion,
  setLastOpened,
} from "../store/mapStore";

// Coalesce rapid edits into roughly one auto-saved version every few minutes per map.
const SNAPSHOT_THROTTLE_MS = 3 * 60 * 1000;

interface PlaybackState {
  snaps: VersionSnapshot[];
  index: number;
  playing: boolean;
}

interface Options {
  /** The live (uncommitted) doc — read by ref so the handlers always see the latest without re-binding. */
  liveDocRef: RefObject<MindMapDoc>;
  setLiveDoc: (d: MindMapDoc) => void;
  setDoc: (d: MindMapDoc) => void;
  refreshMaps: () => Promise<void> | void;
  showHint: (message: string) => void;
}

/**
 * Per-map version history: the snapshot list, an on-demand + throttled auto-save, an in-place
 * restore (bumping a remount nonce so the canvas re-inits even though the map id is unchanged), and
 * timeline playback. Lifted out of App so the shell isn't carrying the whole subsystem.
 *
 * App wires `maybeSnapshot` into its autosave (`persist`) path — edit-driven saves feed the throttled
 * auto-snapshot — and renders `versions` / `playback` / `restoreRev`. The two playback effects (the
 * play tick and the Esc-to-exit handler) live here since they only touch playback state.
 */
export function useVersionHistory({
  liveDocRef,
  setLiveDoc,
  setDoc,
  refreshMaps,
  showHint,
}: Options) {
  const [versions, setVersions] = useState<VersionMeta[]>([]);
  const [restoreRev, setRestoreRev] = useState(0);
  // Timeline playback: when non-null, the canvas shows snaps[index] read-only instead of the live
  // doc, stepped/scrubbed via the PlaybackBar.
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const lastSnapshotByMap = useRef<Map<string, number>>(new Map());

  const refreshVersions = useCallback(async () => {
    try {
      setVersions(await listVersions(liveDocRef.current.id));
    } catch {
      // best-effort
    }
  }, [liveDocRef]);

  // Throttled auto-snapshot for version history (best-effort, never blocks the save). App calls this
  // from persist() on edit-driven saves only; the throttle keeps pure reloads from spamming history.
  const maybeSnapshot = useCallback((d: MindMapDoc) => {
    const last = lastSnapshotByMap.current.get(d.id) ?? 0;
    if (Date.now() - last >= SNAPSHOT_THROTTLE_MS) {
      lastSnapshotByMap.current.set(d.id, Date.now());
      saveVersion(d, Date.now()).catch(() => {});
    }
  }, []);

  async function saveVersionNow() {
    const d = liveDocRef.current;
    try {
      const latest = await latestVersionDoc(d.id);
      if (latest && JSON.stringify(latest) === JSON.stringify(d)) {
        showHint(t("app.noChangesSinceTheLast"));
        return;
      }
      await saveVersion(d, Date.now());
      lastSnapshotByMap.current.set(d.id, Date.now());
      await refreshVersions();
      showHint(t("app.versionSaved"));
    } catch {
      showHint(t("app.couldnTSaveAVersion"));
    }
  }

  async function restoreVersion(id: string) {
    const v = await loadVersion(id);
    if (!v) return;
    const ok = await editorConfirm({
      title: t("app.restoreThisVersion"),
      body: t("app.yourCurrentMapIsSaved"),
      confirmText: t("common.restore"),
    });
    if (!ok) return;
    try {
      await saveVersion(liveDocRef.current, Date.now()); // checkpoint current before replacing
      const next: MindMapDoc = { ...structuredClone(v), id: liveDocRef.current.id };
      liveDocRef.current = next;
      setLiveDoc(next);
      setDoc(next);
      setRestoreRev((r) => r + 1); // remount the canvas (same map id won't otherwise re-init)
      lastSnapshotByMap.current.set(next.id, Date.now());
      await saveMap(next);
      await setLastOpened(next.id);
      await refreshMaps();
      await refreshVersions();
      showHint(t("app.versionRestoredThePreviousState"));
    } catch {
      showHint(t("app.couldnTRestoreTheVersion"));
    }
  }

  async function startPlayback() {
    try {
      const snaps = await loadAllVersions(liveDocRef.current.id);
      if (snaps.length < 2) {
        showHint(t("app.saveAtLeastTwoVersions"));
        return;
      }
      setPlayback({ snaps, index: 0, playing: true });
    } catch {
      showHint(t("app.couldnTLoadTheHistory"));
    }
  }

  // Advance one frame per tick while playing; stop at the newest snapshot (don't loop).
  useEffect(() => {
    if (!playback?.playing) return;
    const t = setInterval(() => {
      setPlayback((p) => {
        if (!p) return p;
        const nxt = nextPlaybackIndex(p.index, p.snaps.length);
        return nxt === null ? { ...p, playing: false } : { ...p, index: nxt };
      });
    }, 1100);
    return () => clearInterval(t);
  }, [playback?.playing]);

  // Esc exits playback (matching the presentation overlay).
  useEffect(() => {
    if (!playback) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPlayback(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playback]);

  return {
    versions,
    restoreRev,
    playback,
    setPlayback,
    refreshVersions,
    saveVersionNow,
    restoreVersion,
    startPlayback,
    maybeSnapshot,
  };
}
