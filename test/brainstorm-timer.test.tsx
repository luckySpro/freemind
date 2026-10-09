import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrainstormTimer } from "../src/BrainstormTimer";

// BrainstormTimer — a self-contained timebox widget. Fake timers drive the countdown; fireEvent
// (sync) avoids the userEvent+fake-timer interplay. Covers open → pick preset → tick → finish, and
// the pause/reset controls.

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("BrainstormTimer", () => {
  it("starts at idle and opens a preset menu", () => {
    render(<BrainstormTimer />);
    expect(screen.getByRole("button", { name: /timer/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /timer/i }));
    for (const m of ["3m", "5m", "10m", "15m"]) {
      expect(screen.getByRole("button", { name: m })).toBeTruthy();
    }
  });

  it("counts down after picking a preset and announces time's up", () => {
    render(<BrainstormTimer />);
    fireEvent.click(screen.getByRole("button", { name: /timer/i }));
    fireEvent.click(screen.getByRole("button", { name: "3m" }));
    expect(screen.getByRole("button", { name: /3:00/ })).toBeTruthy();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole("button", { name: /2:59/ })).toBeTruthy();
    act(() => vi.advanceTimersByTime(3 * 60 * 1000));
    expect(screen.getByRole("button", { name: /time's up/i })).toBeTruthy();
  });

  it("pauses and resets a running timer", () => {
    render(<BrainstormTimer />);
    fireEvent.click(screen.getByRole("button", { name: /timer/i }));
    fireEvent.click(screen.getByRole("button", { name: "5m" }));
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByRole("button", { name: /4:58/ })).toBeTruthy();
    // reopen the menu and pause (the menu stays open, so Reset is then visible without reopening)
    fireEvent.click(screen.getByRole("button", { name: /4:58/ }));
    fireEvent.click(screen.getByRole("button", { name: /pause/i }));
    act(() => vi.advanceTimersByTime(5000)); // paused → no further countdown
    expect(screen.getByRole("button", { name: /4:58/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    expect(screen.getByRole("button", { name: /timer/i })).toBeTruthy();
  });
});
