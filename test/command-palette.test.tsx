import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type Command, CommandPalette } from "../src/components/CommandPalette";

// The generic ⌘K palette (shared by the Start screen + the editor): fuzzy search, arrow/Enter nav,
// Esc/click-outside close, disabled commands hidden, optional query-derived command.

const u = userEvent.setup();

function cmds(over: Partial<Command>[] = []): Command[] {
  const base: Command[] = [
    { id: "fit", label: "Fit map to screen", kind: "view", run: () => {} },
    { id: "present", label: "Present", kind: "map", run: () => {} },
    { id: "group", label: "Group branch", kind: "insert", run: () => {}, enabled: false },
  ];
  return [...base, ...(over as Command[])];
}

describe("CommandPalette (generic)", () => {
  beforeEach(() => localStorage.clear()); // isolate the Recent MRU between tests

  it("lists enabled commands, hides disabled ones, and runs + closes on click", async () => {
    const onClose = vi.fn();
    const run = vi.fn();
    render(
      <CommandPalette
        commands={[
          { id: "a", label: "Alpha", kind: "view", run },
          { id: "b", label: "Bravo", kind: "view", run: () => {}, enabled: false },
        ]}
        onClose={onClose}
      />,
    );
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(screen.queryByText("Bravo")).toBeNull(); // disabled → hidden
    await u.click(screen.getByText("Alpha"));
    expect(run).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("filters by a subsequence query", async () => {
    render(<CommandPalette commands={cmds()} onClose={vi.fn()} />);
    await u.type(screen.getByPlaceholderText(/search commands/i), "prsnt");
    expect(screen.getByText("Present")).toBeTruthy();
    expect(screen.queryByText("Fit map to screen")).toBeNull();
  });

  it("runs the active result with ArrowDown + Enter", async () => {
    const run = vi.fn();
    render(
      <CommandPalette
        commands={[
          { id: "a", label: "Alpha", kind: "view", run: () => {} },
          { id: "b", label: "Bravo", kind: "view", run },
        ]}
        onClose={vi.fn()}
      />,
    );
    const input = screen.getByPlaceholderText(/search commands/i);
    fireEvent.keyDown(input, { key: "ArrowDown" }); // active: Bravo
    fireEvent.keyDown(input, { key: "Enter" });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("prepends a query-derived command", async () => {
    const run = vi.fn();
    render(
      <CommandPalette
        commands={cmds()}
        onClose={vi.fn()}
        makeQueryCommand={(q) =>
          q ? { id: "q", label: `Create "${q}"`, kind: "create", run } : null
        }
      />,
    );
    await u.type(screen.getByPlaceholderText(/search commands/i), "xyz");
    await u.click(screen.getByText('Create "xyz"'));
    expect(run).toHaveBeenCalled();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<CommandPalette commands={cmds()} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("renders an inline shortcut chip for a command that has a binding", () => {
    render(
      <CommandPalette
        commands={[
          { id: "undo", label: "Undo", kind: "edit", run: () => {}, shortcut: "Ctrl/⌘ + Z" },
          { id: "x", label: "No shortcut", kind: "edit", run: () => {} },
        ]}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Ctrl/⌘ + Z").tagName).toBe("KBD");
    // The command without a shortcut shows no chip.
    expect(screen.getAllByText(/^Ctrl\/⌘/)).toHaveLength(1);
  });

  it("traps Tab inside the aria-modal and keeps options out of the tab order", () => {
    render(<CommandPalette commands={cmds()} onClose={vi.fn()} />);
    // Options are navigated via aria-activedescendant, so they're not in the tab order…
    for (const opt of screen.getAllByRole("option")) {
      expect(opt.getAttribute("tabindex")).toBe("-1");
    }
    // …and Tab on the input is prevented, so focus can't escape to the page behind the modal.
    const input = screen.getByRole("combobox");
    const ev = createEvent.keyDown(input, { key: "Tab" });
    fireEvent(input, ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it("matches hidden keywords and surfaces a Recent section after use (#12)", async () => {
    const run = vi.fn();
    const topicCmds: Command[] = [
      { id: "j1", label: "Go to: Alpha", kind: "topic", run, keywords: "interview users" },
      { id: "other", label: "Other", kind: "view", run: () => {} },
    ];
    const { unmount } = render(<CommandPalette commands={topicCmds} onClose={vi.fn()} />);
    // "interview" is only in the keywords, not the label — still matches.
    await u.type(screen.getByPlaceholderText(/search commands/i), "interview");
    await u.click(screen.getByText("Go to: Alpha"));
    expect(run).toHaveBeenCalled();
    unmount();
    // Reopening surfaces the just-run command under a Recent header.
    render(
      <CommandPalette
        commands={[
          { id: "j1", label: "Go to: Alpha", kind: "topic", run: () => {} },
          { id: "other", label: "Other", kind: "view", run: () => {} },
        ]}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Recent")).toBeTruthy();
  });

  it("leads the empty-query list with selection-scoped commands under a context header (Phase 11d)", () => {
    localStorage.removeItem("mindmap-cmdk-recent");
    const run = vi.fn();
    render(
      <CommandPalette
        commands={[
          { id: "v-fit", label: "Fit to view", kind: "view", run: () => {} },
          { id: "node-del", label: "Delete selected topic", kind: "node", run },
          { id: "mk-flag", label: "Marker: flag", kind: "marker", run: () => {} },
        ]}
        onClose={vi.fn()}
        contextKinds={["node", "marker", "priority"]}
      />,
    );
    expect(screen.getByText("For the selected topic")).toBeTruthy();
    // The node-scoped command leads; the generic "view" command falls under "All commands".
    expect(screen.getAllByRole("option")[0].textContent).toContain("Delete selected topic");
    expect(screen.getByText("All commands")).toBeTruthy();
  });

  it("restores focus to the opener on Escape, but not after running a command", () => {
    // Opener stands in for whatever had focus when ⌘K opened (a toolbar button, the canvas, …).
    const opener = document.createElement("button");
    document.body.appendChild(opener);

    // Cancel path: Escape → focus returns to the opener.
    opener.focus();
    const a = render(<CommandPalette commands={cmds()} onClose={vi.fn()} />);
    expect(document.activeElement).toBe(screen.getByRole("combobox")); // input focused on open
    a.unmount(); // simulate the parent unmounting the palette after onClose
    expect(document.activeElement).toBe(opener);

    // Run path: a command ran → focus is left for the command to own (NOT yanked back to the opener).
    opener.focus();
    const run = vi.fn();
    const b = render(
      <CommandPalette commands={[{ id: "x", label: "X", kind: "view", run }]} onClose={vi.fn()} />,
    );
    fireEvent.click(screen.getByText("X"));
    expect(run).toHaveBeenCalledTimes(1);
    const elsewhere = document.createElement("input"); // pretend the command moved focus somewhere
    document.body.appendChild(elsewhere);
    elsewhere.focus();
    b.unmount();
    expect(document.activeElement).toBe(elsewhere); // not restored to opener
    opener.remove();
    elsewhere.remove();
  });

  it("exposes dialog + combobox/listbox/option roles with the active descendant wired", () => {
    render(
      <CommandPalette
        commands={[
          { id: "a", label: "Alpha", kind: "view", run: () => {} },
          { id: "b", label: "Bravo", kind: "view", run: () => {} },
        ]}
        onClose={vi.fn()}
      />,
    );
    screen.getByRole("dialog"); // throws if absent
    const list = screen.getByRole("listbox");
    const input = screen.getByRole("combobox");
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    // First option highlighted; the input points at it so a screen reader announces it.
    expect(options[0].getAttribute("aria-selected")).toBe("true");
    expect(options[1].getAttribute("aria-selected")).toBe("false");
    expect(input.getAttribute("aria-controls")).toBe(list.id);
    expect(input.getAttribute("aria-activedescendant")).toBe(options[0].id);
    // Arrowing moves both the selection and the active descendant.
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const after = screen.getAllByRole("option");
    expect(after[1].getAttribute("aria-selected")).toBe("true");
    expect(input.getAttribute("aria-activedescendant")).toBe(after[1].id);
  });
});
