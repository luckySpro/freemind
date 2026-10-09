import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Per-map version history hook (useVersionHistory) — its orchestration over the mapStore: the
// throttled auto-snapshot, on-demand save (incl. the no-change short-circuit), restore (confirm +
// checkpoint + remount nonce), and playback (min-2 guard + the play tick). mapStore is mocked so the
// test drives the logic without IndexedDB.

const store = vi.hoisted(() => ({
  listVersions: vi.fn(async () => []),
  loadAllVersions: vi.fn(async () => []),
  loadVersion: vi.fn(async () => null as unknown),
  latestVersionDoc: vi.fn(async () => null as unknown),
  saveVersion: vi.fn(async () => {}),
  saveMap: vi.fn(async () => {}),
  setLastOpened: vi.fn(async () => {}),
}));
vi.mock("../src/store/mapStore", () => store);

import type { RefObject } from "react";
import { useVersionHistory } from "../src/hooks/useVersionHistory";
import type { MindMapDoc } from "../src/model/types";

const doc = (over: Partial<MindMapDoc> = {}): MindMapDoc => ({
  schemaVersion: 1,
  id: "m1",
  title: "M",
  root: { id: "r", topic: "M", children: [] },
  ...over,
});

function setup(initial = doc()) {
  const liveDocRef = { current: initial } as RefObject<MindMapDoc>;
  const setLiveDoc = vi.fn((d: MindMapDoc) => {
    liveDocRef.current = d;
  });
  const setDoc = vi.fn();
  const refreshMaps = vi.fn(async () => {});
  const showHint = vi.fn();
  const hook = renderHook(() =>
    useVersionHistory({ liveDocRef, setLiveDoc, setDoc, refreshMaps, showHint }),
  );
  return { hook, liveDocRef, setLiveDoc, setDoc, refreshMaps, showHint };
}

beforeEach(() => {
  for (const fn of Object.values(store)) fn.mockClear();
  store.listVersions.mockResolvedValue([]);
  store.loadAllVersions.mockResolvedValue([]);
  store.latestVersionDoc.mockResolvedValue(null);
  store.loadVersion.mockResolvedValue(null);
});
afterEach(() => vi.useRealTimers());

describe("useVersionHistory", () => {
  it("maybeSnapshot saves once, then throttles rapid repeats", () => {
    const { hook } = setup();
    act(() => hook.result.current.maybeSnapshot(doc()));
    expect(store.saveVersion).toHaveBeenCalledTimes(1);
    act(() => hook.result.current.maybeSnapshot(doc())); // within throttle window
    expect(store.saveVersion).toHaveBeenCalledTimes(1);
  });

  it("saveVersionNow short-circuits when nothing changed since the last version", async () => {
    const current = doc();
    store.latestVersionDoc.mockResolvedValue(structuredClone(current));
    const { hook, showHint } = setup(current);
    await act(async () => {
      await hook.result.current.saveVersionNow();
    });
    expect(store.saveVersion).not.toHaveBeenCalled();
    expect(showHint).toHaveBeenCalledWith("No changes since the last version.");
  });

  it("saveVersionNow writes a version + refreshes when the doc differs", async () => {
    store.latestVersionDoc.mockResolvedValue(doc({ title: "OLD" }));
    store.listVersions.mockResolvedValue([{ id: "v1", at: 1 } as never]);
    const { hook, showHint } = setup(doc({ title: "NEW" }));
    await act(async () => {
      await hook.result.current.saveVersionNow();
    });
    expect(store.saveVersion).toHaveBeenCalledTimes(1);
    expect(showHint).toHaveBeenCalledWith("Version saved.");
    expect(hook.result.current.versions).toHaveLength(1);
  });

  it("restoreVersion checkpoints the current doc, swaps in the restore, and bumps the remount nonce", async () => {
    const restored = doc({ title: "From history", id: "OTHER" });
    store.loadVersion.mockResolvedValue(restored);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { hook, setLiveDoc, setDoc } = setup(doc({ title: "Live" }));
    const rev0 = hook.result.current.restoreRev;
    await act(async () => {
      await hook.result.current.restoreVersion("v1");
    });
    expect(store.saveVersion).toHaveBeenCalled(); // checkpoint before replace
    expect(setLiveDoc).toHaveBeenCalled();
    expect(setDoc).toHaveBeenCalled();
    // restored doc keeps the LIVE map id (not the snapshot's)
    expect(setLiveDoc.mock.calls.at(-1)?.[0].id).toBe("m1");
    expect(setLiveDoc.mock.calls.at(-1)?.[0].title).toBe("From history");
    expect(hook.result.current.restoreRev).toBe(rev0 + 1);
  });

  it("restoreVersion aborts when the user cancels the confirm", async () => {
    store.loadVersion.mockResolvedValue(doc({ title: "X" }));
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const { hook, setLiveDoc } = setup();
    await act(async () => {
      await hook.result.current.restoreVersion("v1");
    });
    expect(setLiveDoc).not.toHaveBeenCalled();
    expect(store.saveVersion).not.toHaveBeenCalled();
  });

  it("startPlayback needs 2+ snapshots, then enters playing state", async () => {
    store.loadAllVersions.mockResolvedValue([{ at: 1 } as never]);
    const { hook, showHint } = setup();
    await act(async () => {
      await hook.result.current.startPlayback();
    });
    expect(hook.result.current.playback).toBeNull();
    expect(showHint).toHaveBeenCalledWith("Save at least two versions to play the timeline.");

    store.loadAllVersions.mockResolvedValue([{ at: 1 } as never, { at: 2 } as never]);
    await act(async () => {
      await hook.result.current.startPlayback();
    });
    expect(hook.result.current.playback).toMatchObject({ index: 0, playing: true });
  });

  it("the play tick advances the frame and stops at the newest snapshot", async () => {
    vi.useFakeTimers();
    store.loadAllVersions.mockResolvedValue([{ at: 1 } as never, { at: 2 } as never]);
    const { hook } = setup();
    await act(async () => {
      await hook.result.current.startPlayback();
    });
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });
    expect(hook.result.current.playback?.index).toBe(1);
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });
    // at the last frame it stops playing (doesn't loop)
    expect(hook.result.current.playback?.playing).toBe(false);
  });
});
