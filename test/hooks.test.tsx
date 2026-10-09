// Hook tests (renderHook) for the app's small custom hooks. The DOM-backed bits — matchMedia for
// useIsMobile/useTheme, and the Blob/anchor download path for useMapExports — are mocked here so the
// hooks' real logic (query cycling, replace counts, format dispatch, persistence) is exercised.
import { act, renderHook } from "@testing-library/react";
import { type RefObject, createRef } from "react";
import { type MockInstance, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MindMapHandle } from "../src/mindmap";
import type { MindMapDoc } from "../src/model/types";
import { useFind } from "../src/useFind";
import { useIsMobile } from "../src/useIsMobile";
import { useMapExports } from "../src/useMapExports";
import { useTheme } from "../src/useTheme";

// A minimal doc whose topics are easy to match/replace.
const doc = (): MindMapDoc => ({
  schemaVersion: 1,
  id: "d",
  title: "Plan",
  root: {
    id: "r",
    topic: "Plan",
    children: [
      { id: "a", topic: "alpha task", children: [] },
      { id: "b", topic: "beta task", children: [] },
      { id: "c", topic: "gamma", children: [] },
    ],
  },
});

// A FormEvent stub whose preventDefault is a no-op (useFind.runSearch calls it).
const submit = () => ({ preventDefault: () => {} }) as unknown as React.FormEvent;

describe("useFind", () => {
  // A fake canvas handle that records focusNode calls and answers replaceTopics.
  function makeRef(replaceCount = 0): {
    ref: RefObject<MindMapHandle | null>;
    focused: string[];
  } {
    const focused: string[] = [];
    const handle = {
      focusNode: (id: string) => focused.push(id),
      replaceTopics: () => replaceCount,
    } as unknown as MindMapHandle;
    return { ref: { current: handle }, focused };
  }

  it("focuses the first match, then cycles + wraps on repeated runs of the same query", () => {
    const { ref, focused } = makeRef();
    const { result } = renderHook(() => useFind(ref, doc));
    act(() => result.current.setQuery("task")); // matches alpha + beta (2 hits)

    act(() => result.current.runSearch(submit()));
    expect(result.current.matchInfo).toBe("1/2");
    act(() => result.current.runSearch(submit()));
    expect(result.current.matchInfo).toBe("2/2");
    act(() => result.current.runSearch(submit())); // wraps back to the first
    expect(result.current.matchInfo).toBe("1/2");
    expect(focused).toEqual(["a", "b", "a"]);
  });

  it("restarts the cursor at the first hit when the query changes", () => {
    const { ref, focused } = makeRef();
    const { result } = renderHook(() => useFind(ref, doc));

    act(() => result.current.setQuery("task"));
    act(() => result.current.runSearch(submit()));
    act(() => result.current.runSearch(submit())); // now at 2/2
    expect(result.current.matchInfo).toBe("2/2");

    act(() => result.current.setQuery("gamma")); // new query → cursor resets
    act(() => result.current.runSearch(submit()));
    expect(result.current.matchInfo).toBe("1/1");
    expect(focused.at(-1)).toBe("c");
  });

  it("reports no matches for a query that hits nothing, and stays quiet for an empty query", () => {
    const { ref } = makeRef();
    const { result } = renderHook(() => useFind(ref, doc));

    act(() => result.current.setQuery("zzz"));
    act(() => result.current.runSearch(submit()));
    expect(result.current.matchInfo).toBe("no matches");

    act(() => result.current.setQuery("")); // empty → no message
    act(() => result.current.runSearch(submit()));
    expect(result.current.matchInfo).toBe("");
  });

  it("reports the replaced count from the canvas handle (and 'no matches' for zero)", () => {
    const hit = makeRef(3);
    const { result: r1 } = renderHook(() => useFind(hit.ref, doc));
    act(() => r1.current.setQuery("task"));
    act(() => r1.current.setReplaceWith("job"));
    act(() => r1.current.runReplace());
    expect(r1.current.matchInfo).toBe("replaced 3");

    const miss = makeRef(0);
    const { result: r2 } = renderHook(() => useFind(miss.ref, doc));
    act(() => r2.current.runReplace());
    expect(r2.current.matchInfo).toBe("no matches");
  });
});

describe("useIsMobile", () => {
  let original: typeof window.matchMedia;
  beforeEach(() => {
    original = window.matchMedia;
  });
  afterEach(() => {
    window.matchMedia = original;
  });

  // Install a controllable matchMedia that reports `matches` and remembers its change listener.
  function installMatchMedia(matches: boolean) {
    const listeners = new Set<() => void>();
    const mql = {
      matches,
      media: "",
      onchange: null,
      addEventListener: (_: string, cb: () => void) => listeners.add(cb),
      removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
      addListener: (cb: () => void) => listeners.add(cb),
      removeListener: (cb: () => void) => listeners.delete(cb),
      dispatchEvent: () => false,
    };
    window.matchMedia = (() => mql) as unknown as typeof window.matchMedia;
    return {
      setMatches(next: boolean) {
        mql.matches = next;
        for (const cb of listeners) cb();
      },
      listenerCount: () => listeners.size,
    };
  }

  it("returns true when the media query matches, false when it doesn't", () => {
    installMatchMedia(true);
    expect(renderHook(() => useIsMobile()).result.current).toBe(true);
    installMatchMedia(false);
    expect(renderHook(() => useIsMobile()).result.current).toBe(false);
  });

  it("updates live when the media query flips, and cleans up its listener on unmount", () => {
    const ctl = installMatchMedia(false);
    const { result, unmount } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
    act(() => ctl.setMatches(true));
    expect(result.current).toBe(true);
    expect(ctl.listenerCount()).toBe(1);
    unmount();
    expect(ctl.listenerCount()).toBe(0);
  });
});

describe("useTheme", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("defaults to light and persists a chosen theme id to localStorage", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme.id).toBe("light");
    act(() => result.current.setThemeId("dark"));
    expect(result.current.theme.id).toBe("dark");
    expect(localStorage.getItem("mindmap-theme")).toBe("dark");
  });

  it("restores a persisted theme id on mount", () => {
    localStorage.setItem("mindmap-theme", "dark");
    expect(renderHook(() => useTheme()).result.current.theme.id).toBe("dark");
  });
});

describe("useMapExports", () => {
  // jsdom implements neither URL.createObjectURL/revokeObjectURL nor a working anchor download. Since
  // they don't exist, assign vi.fn()s directly (spyOn can't wrap an absent method) and delete them
  // after — so we can assert a Blob was produced + an <a download> was clicked without real DOM nav.
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let clickSpy: MockInstance;

  beforeEach(() => {
    createObjectURL = vi.fn(() => "blob:mock");
    revokeObjectURL = vi.fn();
    (URL as unknown as { createObjectURL: unknown }).createObjectURL = createObjectURL;
    (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = revokeObjectURL;
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    (URL as unknown as { createObjectURL?: unknown }).createObjectURL = undefined;
    (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL = undefined;
  });

  // A canvas handle whose exportSvg returns a tiny valid SVG blob (the source for png/svg/html/pdf).
  const svgRef = (): RefObject<MindMapHandle | null> => ({
    current: {
      exportSvg: () =>
        new Blob(["<svg xmlns='http://www.w3.org/2000/svg'></svg>"], {
          type: "image/svg+xml",
        }),
    } as unknown as MindMapHandle,
  });

  const nullRef = createRef<MindMapHandle>();

  it("exports model-backed formats (json/markdown/mermaid) as a downloaded Blob", () => {
    const exports = renderHook(() => useMapExports(nullRef, doc)).result.current;
    act(() => exports.exportJson());
    act(() => exports.exportMarkdown());
    act(() => exports.exportMermaid());
    expect(createObjectURL).toHaveBeenCalledTimes(3);
    // each call gets a real Blob with content
    for (const call of createObjectURL.mock.calls) {
      expect(call[0]).toBeInstanceOf(Blob);
      expect((call[0] as Blob).size).toBeGreaterThan(0);
    }
    expect(clickSpy).toHaveBeenCalledTimes(3);
    expect(revokeObjectURL).toHaveBeenCalled();
  });

  it("exports a lazy-loaded model format (OPML) through the same download path", async () => {
    const exports = renderHook(() => useMapExports(nullRef, doc)).result.current;
    await act(async () => {
      await exports.exportOpml();
    });
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect((createObjectURL.mock.calls[0][0] as Blob).size).toBeGreaterThan(0);
  });

  it("exports the rendered SVG (svg format) when the canvas ref is live", async () => {
    const exports = renderHook(() => useMapExports(svgRef(), doc)).result.current;
    await act(async () => {
      await exports.exportSvg();
    });
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("image/svg+xml");
  });

  it("renderer-backed exports are a no-op when no canvas is mounted (ref is null)", async () => {
    const exports = renderHook(() => useMapExports(nullRef, doc)).result.current;
    await act(async () => {
      await exports.exportSvg();
      await exports.exportHtml();
    });
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("names the file from the doc title (falls back to 'mindmap' when blank)", () => {
    // Spy on anchor.download by capturing the created <a>.
    const created: HTMLAnchorElement[] = [];
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = realCreate(tag);
      if (tag === "a") created.push(el as HTMLAnchorElement);
      return el;
    });
    const titled = () => ({ ...doc(), title: "My Map" });
    const exports = renderHook(() => useMapExports(nullRef, titled)).result.current;
    act(() => exports.exportJson());
    expect(created.at(-1)?.download).toBe("My Map.json");

    const blank = () => ({ ...doc(), title: "" });
    const exports2 = renderHook(() => useMapExports(nullRef, blank)).result.current;
    act(() => exports2.exportMarkdown());
    expect(created.at(-1)?.download).toBe("mindmap.md");
  });
});
