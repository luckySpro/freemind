import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Kanban } from "../src/Kanban";
import type { MindMapDoc } from "../src/model/types";

// Kanban — the board overlay. Renders columns from buildBoard(doc, source); the header selector picks
// the column source (tags / a marker group / schedule dates). Clicking a card jumps to that topic; the
// close button dismisses the board; dragging a card to another column re-files the topic per the source.

/** A minimal DataTransfer stand-in (jsdom's drag events don't carry one) shared across a drag. */
function fakeDataTransfer() {
  const store = new Map<string, string>();
  return {
    setData: (t: string, v: string) => store.set(t, v),
    getData: (t: string) => store.get(t) ?? "",
    types: ["application/x-mm-card"],
    dropEffect: "",
    effectAllowed: "",
  };
}

const doc: MindMapDoc = {
  schemaVersion: 1,
  id: "d",
  title: "Board doc",
  root: {
    id: "root",
    topic: "Root",
    children: [
      {
        id: "a",
        topic: "Task A",
        tags: ["work"],
        icons: ["🔴"],
        task: { progress: 0.5, due: "2026-01-01" },
        children: [],
      },
      { id: "b", topic: "Idea B", children: [] },
    ],
  },
};

function setup(over: Partial<Parameters<typeof Kanban>[0]> = {}) {
  const props = {
    doc,
    onPick: vi.fn(),
    onRetag: vi.fn(),
    onSetMarkers: vi.fn(),
    onSetDue: vi.fn(),
    onClose: vi.fn(),
    ...over,
  };
  render(<Kanban {...props} />);
  return props;
}

describe("Kanban board", () => {
  it("renders a column per tag plus an Untagged column (default source)", () => {
    setup();
    expect(screen.getByText("work")).toBeTruthy();
    expect(screen.getByText("Untagged")).toBeTruthy();
    expect(screen.getByText("Task A")).toBeTruthy();
    expect(screen.getByText("Idea B")).toBeTruthy();
  });

  it("jumps to a topic when its card is clicked", async () => {
    const p = setup();
    await userEvent.click(screen.getByText("Task A"));
    expect(p.onPick).toHaveBeenCalledWith("a");
  });

  it("closes via the close button", async () => {
    const p = setup();
    await userEvent.click(screen.getByRole("button", { name: /close board/i }));
    expect(p.onClose).toHaveBeenCalledTimes(1);
  });

  it("re-tags a topic when its card is dropped on another column (tag source)", () => {
    const p = setup();
    const dt = fakeDataTransfer();
    fireEvent.dragStart(screen.getByText("Task A").closest("button") as HTMLElement, {
      dataTransfer: dt,
    });
    const untaggedColumn = screen.getByText("Untagged").parentElement as HTMLElement;
    fireEvent.drop(untaggedColumn, { dataTransfer: dt });
    // Dropped on Untagged → the "work" tag is removed, leaving no tags.
    expect(p.onRetag).toHaveBeenCalledWith("a", []);
  });

  it("switches the column source to a marker group and re-marks on drop (item 4)", async () => {
    const p = setup();
    await userEvent.selectOptions(screen.getByLabelText("Group the board by"), "marker:status");
    // Status columns appear (red is where Task A lives), plus a None column.
    const dt = fakeDataTransfer();
    fireEvent.dragStart(screen.getByText("Task A").closest("button") as HTMLElement, {
      dataTransfer: dt,
    });
    // Drop onto the "None" column (label "None") → clears the status marker.
    const noneColumn = screen.getByText("None").parentElement as HTMLElement;
    fireEvent.drop(noneColumn, { dataTransfer: dt });
    expect(p.onSetMarkers).toHaveBeenCalledWith("a", []); // 🔴 removed, no other markers
  });

  it("switches to schedule and sets a due date on drop (item 5)", async () => {
    const p = setup();
    await userEvent.selectOptions(screen.getByLabelText("Group the board by"), "schedule");
    const dt = fakeDataTransfer();
    fireEvent.dragStart(screen.getByText("Idea B").closest("button") as HTMLElement, {
      dataTransfer: dt,
    });
    // Drop onto the "Today" column → writes a due date (exact date depends on today; just assert it ran).
    const todayColumn = screen.getByText("Today").parentElement as HTMLElement;
    fireEvent.drop(todayColumn, { dataTransfer: dt });
    expect(p.onSetDue).toHaveBeenCalledWith("b", expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
  });
});
