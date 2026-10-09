import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Breadcrumb } from "../src/components/Breadcrumb";

describe("Breadcrumb", () => {
  const crumbs = [
    { id: "r", topic: "Root" },
    { id: "a", topic: "Branch" },
    { id: "b", topic: "Leaf" },
  ];

  it("renders every crumb and marks the last as current", () => {
    render(<Breadcrumb crumbs={crumbs} onPick={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Root/ })).toBeTruthy();
    expect(screen.getByText("Leaf").getAttribute("aria-current")).toBe("true");
  });

  it("calls onPick with the crumb id when an ancestor is clicked", async () => {
    const onPick = vi.fn();
    render(<Breadcrumb crumbs={crumbs} onPick={onPick} />);
    await userEvent.click(screen.getByRole("button", { name: "Branch" }));
    expect(onPick).toHaveBeenCalledWith("a");
  });

  it("shows a placeholder for an untitled crumb", () => {
    render(<Breadcrumb crumbs={[{ id: "r", topic: "" }]} onPick={vi.fn()} />);
    expect(screen.getByText("(untitled)")).toBeTruthy();
  });
});
