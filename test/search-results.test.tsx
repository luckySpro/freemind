// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { type ResultRow, SearchResults } from "../src/components/SearchResults";

const row = (over: Partial<ResultRow<string>> = {}): ResultRow<string> => ({
  key: "n1",
  topic: "Ship it",
  path: [],
  payload: "n1",
  ...over,
});

const u = userEvent.setup();

describe("SearchResults", () => {
  it("shows 'No matches.' for an empty list", () => {
    render(<SearchResults rows={[]} onPick={vi.fn()} />);
    expect(screen.getByText("No matches.")).toBeTruthy();
  });

  it("renders topic, map, breadcrumb and snippet; picks the row's payload", async () => {
    const onPick = vi.fn();
    const r = row({
      key: "m1:b",
      topic: "Beta",
      path: ["Plan", "Marketing"],
      snippet: "…quota and pipeline notes…",
      mapTitle: "Roadmap",
      payload: "b",
    });
    render(<SearchResults rows={[r]} onPick={onPick} />);
    expect(screen.getByText("Beta")).toBeTruthy();
    expect(screen.getByText("— Roadmap")).toBeTruthy();
    expect(screen.getByText("Plan › Marketing")).toBeTruthy();
    expect(screen.getByText("…quota and pipeline notes…")).toBeTruthy();
    await u.click(screen.getByText("Beta"));
    expect(onPick).toHaveBeenCalledWith("b");
  });

  it("omits the map label and breadcrumb for a bare in-map row", () => {
    const { container } = render(<SearchResults rows={[row()]} onPick={vi.fn()} />);
    expect(container.querySelectorAll("li").length).toBe(1);
    expect(screen.queryByText(/—/)).toBeNull(); // no "— mapTitle"
    expect(screen.queryByText("›")).toBeNull();
  });

  it("marks the active row with aria-current", () => {
    render(
      <SearchResults
        rows={[
          row({ key: "a", topic: "A", payload: "a" }),
          row({ key: "b", topic: "B", payload: "b" }),
        ]}
        onPick={vi.fn()}
        activeKey="b"
      />,
    );
    expect(screen.getByText("A").closest("button")?.getAttribute("aria-current")).toBeNull();
    expect(screen.getByText("B").closest("button")?.getAttribute("aria-current")).toBe("true");
  });

  it("caps at 50 rows and shows an overflow hint", () => {
    const many = Array.from({ length: 63 }, (_, i) =>
      row({ key: `n${i}`, topic: `T${i}`, payload: `n${i}` }),
    );
    render(<SearchResults rows={many} onPick={vi.fn()} />);
    expect(screen.getByText(/\+13 more — refine your search/)).toBeTruthy();
  });
});
