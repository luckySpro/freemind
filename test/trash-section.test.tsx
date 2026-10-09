// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Trash } from "../src/components/start/sections/Trash";
import type { StartContext } from "../src/components/start/types";

// The Trash section over a mocked store: empty state + restore / delete-forever / empty-trash wiring.

const restoreMapFromTrash = vi.fn();
const deleteMap = vi.fn();
const emptyTrash = vi.fn();
let trash: { id: string; title: string; trashedAt: number }[] = [];

vi.mock("../src/components/start/useLibrary", () => ({
  useTrashMaps: () => trash,
}));
vi.mock("../src/store/mapStore", () => ({
  restoreMapFromTrash: (id: string) => restoreMapFromTrash(id),
  deleteMap: (id: string) => deleteMap(id),
  emptyTrash: () => emptyTrash(),
}));

const mkCtx = (over: Partial<StartContext> = {}): StartContext => ({
  onOpen: vi.fn(),
  onImportFiles: vi.fn(),
  go: vi.fn(),
  libraryRev: 0,
  onLibraryChange: vi.fn(),
  ...over,
});

describe("Trash section", () => {
  it("shows the empty state when nothing is trashed", () => {
    trash = [];
    render(<Trash ctx={mkCtx()} />);
    expect(screen.getByText(/Trash is empty/i)).toBeTruthy();
  });

  it("lists trashed maps and wires restore / delete-forever / empty (each refreshes the library)", async () => {
    trash = [{ id: "a", title: "Gone", trashedAt: 1 }];
    const onLibraryChange = vi.fn();
    render(<Trash ctx={mkCtx({ onLibraryChange })} />);
    expect(screen.getByText("Gone")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(restoreMapFromTrash).toHaveBeenCalledWith("a");
    await userEvent.click(screen.getByRole("button", { name: "Delete forever" }));
    expect(deleteMap).toHaveBeenCalledWith("a");
    await userEvent.click(screen.getByRole("button", { name: /Empty Trash/i }));
    expect(emptyTrash).toHaveBeenCalled();

    expect(onLibraryChange).toHaveBeenCalledTimes(3); // every action refreshes the library
  });
});
