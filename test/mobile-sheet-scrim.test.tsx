// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileSheetScrim } from "../src/components/MobileSheetScrim";

describe("MobileSheetScrim", () => {
  it("renders the close-panel scrim and fires onClose when tapped", () => {
    const onClose = vi.fn();
    render(<MobileSheetScrim onClose={onClose} />);
    const btn = screen.getByRole("button", { name: /close panel/i });
    expect(btn.className).toContain("mm-sheet-scrim");
    fireEvent.click(btn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
