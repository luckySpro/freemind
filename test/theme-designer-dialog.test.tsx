import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeDesignerDialog } from "../src/components/ThemeDesignerDialog";
import { getCustomThemes } from "../src/store/customThemes";

// The custom-theme designer (C3): edit → save (appears in storage + as a chip) → delete.

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

function setup() {
  const onChange = vi.fn();
  const onClose = vi.fn();
  render(<ThemeDesignerDialog onClose={onClose} onChange={onChange} />);
  return { onChange, onClose };
}

describe("ThemeDesignerDialog (C3)", () => {
  it("renders the editor with a name, colour inputs, and a live preview", () => {
    setup();
    expect(screen.getByText("Theme designer")).toBeTruthy();
    expect(screen.getByLabelText("Theme name")).toBeTruthy();
    expect(screen.getByLabelText("Branch colour 1")).toBeTruthy();
    expect(screen.getByLabelText("Background colour")).toBeTruthy();
    expect(screen.getByLabelText("Node fill colour")).toBeTruthy();
    expect(screen.getByLabelText("Theme preview")).toBeTruthy();
  });

  it("saves a named theme to storage and surfaces it, then deletes it", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    const name = screen.getByLabelText("Theme name");
    await user.clear(name);
    await user.type(name, "Forest");
    await user.click(screen.getByRole("button", { name: "Save theme" }));

    expect(onChange).toHaveBeenCalled();
    expect(getCustomThemes().map((t) => t.name)).toContain("Forest");
    // The saved theme now shows as a selectable chip; loading it re-populates the draft.
    const chip = screen.getByRole("button", { name: "Forest" });
    await user.click(chip);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(getCustomThemes()).toEqual([]);
  });

  it("edits the palette / colours and starts a fresh theme with ＋ New", async () => {
    const user = userEvent.setup();
    setup();
    // fireEvent for <input type=color> (userEvent can't "type" a colour).
    fireEvent.input(screen.getByLabelText("Branch colour 1"), { target: { value: "#123456" } });
    fireEvent.input(screen.getByLabelText("Background colour"), { target: { value: "#0a0a0a" } });
    fireEvent.input(screen.getByLabelText("Node fill colour"), { target: { value: "#fefefe" } });
    fireEvent.change(screen.getByLabelText("Theme font"), {
      target: { value: "Georgia, 'Times New Roman', serif" },
    });
    fireEvent.change(screen.getByLabelText("Theme branch weight"), { target: { value: "bold" } });
    await user.click(screen.getByRole("button", { name: "Save theme" }));
    const saved = getCustomThemes()[0];
    expect(saved.palette[0]).toBe("#123456");
    expect(saved.background).toBe("#0a0a0a");
    expect(saved.branchGrowth).toBe("bold");
  });

  it("exports the current theme as a .json download", async () => {
    const user = userEvent.setup();
    const created: string[] = [];
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => {
        created.push("blob");
        return "blob:x";
      }),
      revokeObjectURL: vi.fn(),
    });
    setup();
    await user.click(screen.getByRole("button", { name: /Download .json/ }));
    expect(created).toContain("blob");
    vi.unstubAllGlobals();
  });
});
