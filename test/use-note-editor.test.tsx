import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNoteEditor } from "../src/hooks/useNoteEditor";
import type { MindMapHandle } from "../src/mindmap";

// useNoteEditor owns the note-editing surface: a debounced draft committed to the selected node via
// the canvas handle, plus the "switch to Notes tab" nonce. Driven in isolation with a stub handle.

function setup() {
  const setSelectedNote = vi.fn();
  const mapRef = { current: { setSelectedNote } as unknown as MindMapHandle };
  const hook = renderHook(() => useNoteEditor(mapRef));
  return { setSelectedNote, ...hook };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useNoteEditor", () => {
  it("updates the draft immediately and commits the note after the debounce", () => {
    const { result, setSelectedNote } = setup();
    act(() => result.current.onNoteChange("hel"));
    expect(result.current.noteDraft).toBe("hel"); // draft is live
    expect(setSelectedNote).not.toHaveBeenCalled(); // but not committed yet
    act(() => vi.advanceTimersByTime(400));
    expect(setSelectedNote).toHaveBeenCalledWith("hel");
  });

  it("coalesces rapid edits into a single commit (only the last value)", () => {
    const { result, setSelectedNote } = setup();
    act(() => result.current.onNoteChange("a"));
    act(() => vi.advanceTimersByTime(200));
    act(() => result.current.onNoteChange("ab")); // resets the debounce
    act(() => vi.advanceTimersByTime(399));
    expect(setSelectedNote).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(setSelectedNote).toHaveBeenCalledTimes(1);
    expect(setSelectedNote).toHaveBeenCalledWith("ab");
  });

  it("flushNote commits the current draft now and cancels any pending debounce", () => {
    const { result, setSelectedNote } = setup();
    act(() => result.current.setNoteDraft("final"));
    act(() => result.current.onNoteChange("typing")); // schedules a debounce
    act(() => result.current.flushNote()); // commit immediately + cancel
    expect(setSelectedNote).toHaveBeenLastCalledWith("typing"); // flush uses the live draft...
    const calls = setSelectedNote.mock.calls.length;
    act(() => vi.advanceTimersByTime(400)); // ...and the cancelled debounce must NOT fire again
    expect(setSelectedNote.mock.calls.length).toBe(calls);
  });

  it("bumpNoteNonce increments the Notes-tab nonce", () => {
    const { result } = setup();
    expect(result.current.noteNonce).toBe(0);
    act(() => result.current.bumpNoteNonce());
    act(() => result.current.bumpNoteNonce());
    expect(result.current.noteNonce).toBe(2);
  });
});
