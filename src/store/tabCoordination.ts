import { useEffect } from "react";

// Cross-tab clobber guard. The library autosaves the active map to IndexedDB under its id; if the SAME
// map is open in two tabs, both autosave to that key and the last write silently wins (losing the other
// tab's edits). There's no true multi-writer lock in the browser, so we detect the collision and WARN:
// each editor tab heartbeats "I have map M open" on a BroadcastChannel; a tab that hears another tab
// holding its map surfaces a non-blocking notice so the user knows their edits may be overwritten.
//
// The detection logic (who holds a map, stale-heartbeat expiry) is a pure registry so it's unit-testable;
// the BroadcastChannel + interval wiring is a thin hook around it.

export const TAB_CHANNEL = "mindmap-tab-presence";
/** How often an open tab re-announces it holds its map. */
export const HEARTBEAT_MS = 2000;
/** A heartbeat older than this is treated as a closed/crashed tab and ignored. */
export const STALE_MS = 5000;

export interface PresenceMsg {
  mapId: string;
  tabId: string;
  ts: number;
}

/** Tracks which tabs hold which map open (by heartbeat); stale entries are ignored. Pure + testable. */
export class PresenceRegistry {
  private entries = new Map<string, PresenceMsg>(); // key = `${mapId}:${tabId}`

  note(msg: PresenceMsg): void {
    this.entries.set(`${msg.mapId}:${msg.tabId}`, msg);
  }

  /** Other tabs (≠ `selfTabId`) holding `mapId` with a non-stale heartbeat as of `now`. */
  othersHolding(mapId: string, selfTabId: string, now: number): string[] {
    const out: string[] = [];
    for (const m of this.entries.values()) {
      if (m.mapId !== mapId || m.tabId === selfTabId) continue;
      if (now - m.ts <= STALE_MS) out.push(m.tabId);
    }
    return out;
  }
}

/** Announce that this tab holds `mapId` open and warn (once) if another tab holds it too. No-op when
 *  `mapId` is null (not in the editor) or BroadcastChannel is unavailable. `onConflict` must be stable. */
export function useTabPresence(mapId: string | null, onConflict: (mapId: string) => void): void {
  useEffect(() => {
    if (!mapId || typeof BroadcastChannel === "undefined") return;
    const tabId = crypto.randomUUID();
    const channel = new BroadcastChannel(TAB_CHANNEL);
    const registry = new PresenceRegistry();
    let warned = false;
    const announce = () => channel.postMessage({ mapId, tabId, ts: Date.now() } as PresenceMsg);

    channel.onmessage = (e: MessageEvent) => {
      const msg = e.data as PresenceMsg;
      if (!msg || msg.mapId !== mapId || msg.tabId === tabId) return;
      registry.note(msg);
      if (!warned && registry.othersHolding(mapId, tabId, Date.now()).length > 0) {
        warned = true;
        onConflict(mapId);
      }
    };

    announce(); // say hello immediately so an already-open tab learns about us
    const interval = setInterval(announce, HEARTBEAT_MS);
    return () => {
      clearInterval(interval);
      channel.close();
    };
  }, [mapId, onConflict]);
}
