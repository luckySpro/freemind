// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useInbox } from "../src/hooks/useInbox";
import { getInbox, saveInbox } from "../src/store/mapStore";

// The fake IndexedDB is shared across this file, so clear the inbox before each test for isolation.
beforeEach(async () => {
  await saveInbox([]);
});

// Mount, then flush the async mount-load microtask so a later resolve can't clobber our mutations.
async function mounted() {
  const hook = renderHook(() => useInbox());
  await act(async () => {});
  return hook;
}

describe("useInbox", () => {
  it("captures, persists, and orders newest-first", async () => {
    const { result } = await mounted();
    act(() => result.current.add("first"));
    act(() => result.current.add("second"));
    expect(result.current.items.map((i) => i.text)).toEqual(["second", "first"]);
    await waitFor(async () => {
      expect((await getInbox()).map((i) => i.text)).toEqual(["second", "first"]);
    });
  });

  it("ignores a blank capture", async () => {
    const { result } = await mounted();
    act(() => result.current.add("   "));
    expect(result.current.items).toHaveLength(0);
  });

  it("removes one item and clears all", async () => {
    const { result } = await mounted();
    act(() => result.current.add("keep"));
    act(() => result.current.add("drop"));
    const dropId = result.current.items.find((i) => i.text === "drop")?.id;
    if (!dropId) throw new Error("missing item");
    act(() => result.current.remove(dropId));
    expect(result.current.items.map((i) => i.text)).toEqual(["keep"]);
    act(() => result.current.clear());
    expect(result.current.items).toHaveLength(0);
    await waitFor(async () => expect(await getInbox()).toHaveLength(0));
  });

  it("loads persisted items on mount", async () => {
    const first = await mounted();
    act(() => first.result.current.add("persisted"));
    await waitFor(async () => expect((await getInbox()).length).toBeGreaterThan(0));
    first.unmount();
    const second = await mounted();
    await waitFor(() =>
      expect(second.result.current.items.some((i) => i.text === "persisted")).toBe(true),
    );
  });
});
