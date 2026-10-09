import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NaturalDateInput } from "../src/Panels";
import { todayISO } from "../src/taskDate";

// The pure resolution logic is covered in taskDate.test.ts (parseNaturalDate); here we only assert the
// component wiring: commit on blur/Enter, clear on empty, and the unchanged-on-error path.
describe("NaturalDateInput", () => {
  it("resolves natural language on Enter and commits the ISO date", async () => {
    const user = userEvent.setup();
    const onSet = vi.fn();
    render(<NaturalDateInput value="" onSet={onSet} ariaLabel="Due date" />);
    const input = screen.getByLabelText("Due date") as HTMLInputElement;
    await user.type(input, "today{Enter}");
    expect(onSet).toHaveBeenCalledWith(todayISO());
    expect(input.value).toBe(todayISO());
  });

  it("passes an ISO date straight through on blur", async () => {
    const user = userEvent.setup();
    const onSet = vi.fn();
    render(
      <>
        <NaturalDateInput value="" onSet={onSet} ariaLabel="Due date" />
        <button type="button">elsewhere</button>
      </>,
    );
    const input = screen.getByLabelText("Due date");
    await user.type(input, "2026-07-01");
    await user.click(screen.getByText("elsewhere")); // blur
    expect(onSet).toHaveBeenCalledWith("2026-07-01");
  });

  it("leaves the field unchanged and flags invalid input", async () => {
    const user = userEvent.setup();
    const onSet = vi.fn();
    render(<NaturalDateInput value="2026-01-01" onSet={onSet} ariaLabel="Due date" />);
    const input = screen.getByLabelText("Due date") as HTMLInputElement;
    await user.clear(input);
    await user.type(input, "someday{Enter}");
    expect(onSet).not.toHaveBeenCalled();
    expect(input.value).toBe("2026-01-01"); // reverted to the current value
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  it("clears the date when emptied", async () => {
    const user = userEvent.setup();
    const onSet = vi.fn();
    render(<NaturalDateInput value="2026-01-01" onSet={onSet} ariaLabel="Due date" />);
    const input = screen.getByLabelText("Due date");
    await user.clear(input);
    await user.type(input, "{Enter}");
    expect(onSet).toHaveBeenCalledWith("");
  });
});
