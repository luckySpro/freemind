import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FindReplaceOverlay } from "../src/components/FindReplaceOverlay";
import type { ToolbarFind } from "../src/components/Toolbar";

afterEach(cleanup);

function makeFind(over: Partial<ToolbarFind> = {}): ToolbarFind {
  return {
    query: "",
    setQuery: vi.fn(),
    replaceWith: "",
    setReplaceWith: vi.fn(),
    replaceScope: "topics",
    setReplaceScope: vi.fn(),
    useRegex: false,
    setUseRegex: vi.fn(),
    matchCase: false,
    setMatchCase: vi.fn(),
    matchInfo: "",
    matches: [],
    activeId: null,
    goTo: vi.fn(),
    runSearch: vi.fn((e: { preventDefault: () => void }) => e.preventDefault()),
    findNext: vi.fn(),
    findPrev: vi.fn(),
    runReplace: vi.fn(),
    ...over,
  };
}

describe("FindReplaceOverlay", () => {
  it("submits the find form and runs replace", async () => {
    const u = userEvent.setup();
    const find = makeFind();
    render(<FindReplaceOverlay find={find} onClose={vi.fn()} />);
    const input = screen.getByLabelText("Find node");
    // The find row is a <form> with no submit button (implicit submit), so submit it directly.
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    expect(find.runSearch).toHaveBeenCalled();
    await u.click(screen.getByRole("button", { name: /replace all/i }));
    expect(find.runReplace).toHaveBeenCalled();
  });

  it("records the query into a recent-searches datalist on submit (item 18)", () => {
    localStorage.clear();
    const find = makeFind({ query: "budget" });
    render(<FindReplaceOverlay find={find} onClose={vi.fn()} />);
    const input = screen.getByLabelText("Find node");
    // The input offers a history datalist, empty until a search runs.
    expect(input.getAttribute("list")).toBe("mm-search-history");
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    expect(find.runSearch).toHaveBeenCalled();
    // The submitted query is now persisted and rendered as a datalist option.
    expect(localStorage.getItem("mindmap-search-history")).toContain("budget");
    expect(document.querySelector('#mm-search-history option[value="budget"]')).not.toBeNull();
  });

  it("toggles match-case and regex", async () => {
    const u = userEvent.setup();
    const find = makeFind();
    render(<FindReplaceOverlay find={find} onClose={vi.fn()} />);
    await u.click(screen.getByRole("button", { name: /match case/i }));
    expect(find.setMatchCase).toHaveBeenCalledWith(true);
    await u.click(screen.getByRole("button", { name: /regular expression/i }));
    expect(find.setUseRegex).toHaveBeenCalledWith(true);
  });

  it("cycles matches via the Next / Prev buttons and Shift+Enter", async () => {
    const u = userEvent.setup();
    const find = makeFind({ matchInfo: "2/5" });
    render(<FindReplaceOverlay find={find} onClose={vi.fn()} />);
    await u.click(screen.getByRole("button", { name: /next match/i }));
    expect(find.findNext).toHaveBeenCalled();
    await u.click(screen.getByRole("button", { name: /previous match/i }));
    expect(find.findPrev).toHaveBeenCalled();
    // Shift+Enter in the query box steps backwards (plain Enter submits the form → next).
    fireEvent.keyDown(screen.getByLabelText("Find node"), { key: "Enter", shiftKey: true });
    expect(find.findPrev).toHaveBeenCalledTimes(2);
    // The match counter is a live region so AT announces "2/5".
    expect(screen.getByRole("status").textContent).toBe("2/5");
  });

  it("discloses the 'all matches' list and jumps to a clicked row", async () => {
    const u = userEvent.setup();
    const goTo = vi.fn();
    const find = makeFind({
      matchInfo: "1/2",
      activeId: "a",
      goTo,
      matches: [
        { nodeId: "a", topic: "Apple", path: ["Fruit"] },
        { nodeId: "b", topic: "Apricot", path: ["Fruit"] },
      ],
    });
    render(<FindReplaceOverlay find={find} onClose={vi.fn()} />);
    // The list is collapsed until you open it.
    expect(screen.queryByText("Apricot")).toBeNull();
    await u.click(screen.getByRole("button", { name: /List all \(2\)/ }));
    expect(screen.getByText("Apple")).toBeTruthy();
    // The active match is marked for AT + styling.
    expect(screen.getByText("Apple").closest("button")?.getAttribute("aria-current")).toBe("true");
    await u.click(screen.getByText("Apricot"));
    expect(goTo).toHaveBeenCalledWith("b");
  });

  it("offers no match list when there are no matches", () => {
    render(<FindReplaceOverlay find={makeFind()} onClose={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /List all/ })).toBeNull();
  });

  it("closes on the × button and on Escape", async () => {
    const u = userEvent.setup();
    const onClose = vi.fn();
    render(<FindReplaceOverlay find={makeFind()} onClose={onClose} />);
    await u.click(screen.getByRole("button", { name: /close find/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    // Escape on the Find input bubbles to the overlay's keydown handler.
    fireEvent.keyDown(screen.getByLabelText("Find node"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
