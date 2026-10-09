import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MindMapDoc } from "../src/model/types";
import { Presentation } from "../src/present/Presentation";

// Presentation — the ▶ Present overlay. A prop-driven component (its slide/presenter logic lives in
// the already-covered slides.ts / presenter.ts), so the test mounts it and drives the controls,
// keyboard, and the presenter sidebar.

const doc: MindMapDoc = {
  schemaVersion: 1,
  id: "m1",
  title: "Talk",
  root: {
    id: "root",
    topic: "My Talk",
    note: "intro",
    children: [
      {
        id: "a",
        topic: "First branch",
        note: "say something about first",
        children: [
          { id: "a1", topic: "Point A", children: [{ id: "a1a", topic: "Sub A", children: [] }] },
          { id: "a2", topic: "Point B", children: [] },
        ],
      },
      { id: "b", topic: "Second branch", children: [{ id: "b1", topic: "Point C", children: [] }] },
    ],
  },
};
// slides = [overview, "First branch", "Second branch"]  → length 3

const heading = () => screen.getByRole("heading", { level: 1 }).textContent;

describe("Presentation overlay", () => {
  it("renders the overview slide then navigates branches via the buttons", () => {
    render(<Presentation doc={doc} onExit={vi.fn()} />);
    // Overview slide: root heading + each branch listed.
    expect(heading()).toBe("My Talk");
    expect(screen.getByText("First branch")).toBeTruthy();
    expect(screen.getByText("Second branch")).toBeTruthy();
    expect(screen.getByText("1 / 3")).toBeTruthy();

    const prev = screen.getByRole("button", { name: /Prev/ });
    const next = screen.getByRole("button", { name: /Next/ });
    expect((prev as HTMLButtonElement).disabled).toBe(true); // at the start

    fireEvent.click(next);
    expect(heading()).toBe("First branch"); // branch slide → Bullets
    expect(screen.getByText("Point A")).toBeTruthy();
    expect(screen.getByText("Sub A")).toBeTruthy(); // recursive Bullets

    fireEvent.click(next);
    expect(heading()).toBe("Second branch");
    expect((screen.getByRole("button", { name: /Next/ }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /Prev/ }));
    expect(heading()).toBe("First branch");
  });

  it("supports keyboard navigation, presenter toggle, and Escape-to-exit", () => {
    const onExit = vi.fn();
    render(<Presentation doc={doc} onExit={onExit} />);

    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(heading()).toBe("First branch");
    fireEvent.keyDown(document, { key: " " }); // Space also advances
    expect(heading()).toBe("Second branch");
    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(heading()).toBe("First branch");

    // Home jumps back to the first slide (the overview) (I10).
    fireEvent.keyDown(document, { key: "ArrowRight" });
    fireEvent.keyDown(document, { key: "Home" });
    expect(heading()).toBe("My Talk");

    // 'p' toggles the presenter sidebar.
    expect(screen.queryByRole("complementary", { name: "Presenter view" })).toBeNull();
    fireEvent.keyDown(document, { key: "p" });
    expect(screen.getByRole("complementary", { name: "Presenter view" })).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("is a focusable modal dialog and restores focus to the opener on unmount", () => {
    // A button stands in for whatever was focused when Present was opened (e.g. a menu item).
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    expect(document.activeElement).toBe(opener);

    const { unmount } = render(<Presentation doc={doc} onExit={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { name: "Presentation" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(dialog); // focus moved into the overlay on enter

    unmount();
    expect(document.activeElement).toBe(opener); // focus restored to the opener on exit
    opener.remove();
  });

  it("presenter sidebar shows notes / no-notes, agenda, and jumps on click", () => {
    render(<Presentation doc={doc} onExit={vi.fn()} />);
    // Turn on presenter view via the button (covers aria-pressed + ctrlOnStyle path).
    fireEvent.click(screen.getByRole("button", { name: /Presenter view/ }));
    const aside = screen.getByRole("complementary", { name: "Presenter view" });
    expect(within(aside).getByText("Speaker notes")).toBeTruthy();
    expect(within(aside).getByText(/Agenda/)).toBeTruthy();
    expect(within(aside).getByText("Next up")).toBeTruthy();

    // Jump to the "Second branch" agenda row → it has no note → "No notes" branch renders.
    fireEvent.click(within(aside).getByRole("button", { name: /Second branch/ }));
    expect(heading()).toBe("Second branch");
    expect(within(aside).getByText("No notes for this slide.")).toBeTruthy();
  });

  it("ticks a presenter elapsed clock that pauses and resets", () => {
    vi.useFakeTimers();
    try {
      render(<Presentation doc={doc} onExit={vi.fn()} />);
      const clock = () => screen.getByLabelText(/Elapsed/).textContent;
      expect(clock()).toBe("0:00");
      act(() => vi.advanceTimersByTime(3000));
      expect(clock()).toBe("0:03");
      // Pause → the clock stops advancing.
      fireEvent.click(screen.getByRole("button", { name: "Pause timer" }));
      act(() => vi.advanceTimersByTime(5000));
      expect(clock()).toBe("0:03");
      // Resume then reset → back to zero, ticking again.
      fireEvent.click(screen.getByRole("button", { name: "Resume timer" }));
      fireEvent.click(screen.getByRole("button", { name: "Reset timer" }));
      expect(clock()).toBe("0:00");
      act(() => vi.advanceTimersByTime(1000));
      expect(clock()).toBe("0:01");
    } finally {
      vi.useRealTimers();
    }
  });

  it("blacks out on B and whites out on W, and any key (or click) resumes", () => {
    render(<Presentation doc={doc} onExit={vi.fn()} />);
    fireEvent.keyDown(document, { key: "b" });
    expect(screen.getByRole("button", { name: /Black screen/ })).toBeTruthy();
    // The B keypress went to the curtain, not slide navigation.
    expect(heading()).toBe("My Talk");
    fireEvent.keyDown(document, { key: "x" }); // any key resumes
    expect(screen.queryByRole("button", { name: /Black screen/ })).toBeNull();

    fireEvent.keyDown(document, { key: "W" });
    const white = screen.getByRole("button", { name: /White screen/ });
    fireEvent.click(white); // clicking the curtain also resumes
    expect(screen.queryByRole("button", { name: /White screen/ })).toBeNull();
  });

  it("Escape still exits Present while blacked out", () => {
    const onExit = vi.fn();
    render(<Presentation doc={doc} onExit={onExit} />);
    fireEvent.keyDown(document, { key: "B" });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("sets a talk budget via the presenter stepper (drives pacing colour)", () => {
    render(<Presentation doc={doc} onExit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Presenter view/ }));
    const aside = screen.getByRole("complementary", { name: "Presenter view" });
    expect(within(aside).getByText("off")).toBeTruthy(); // budget starts off → neutral pacing
    fireEvent.click(within(aside).getByRole("button", { name: "Increase budget" }));
    fireEvent.click(within(aside).getByRole("button", { name: "Increase budget" }));
    expect(within(aside).getByText("10 min")).toBeTruthy();
    fireEvent.click(within(aside).getByRole("button", { name: "Decrease budget" }));
    expect(within(aside).getByText("5 min")).toBeTruthy();
  });
});
