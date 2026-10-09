import { describe, expect, it } from "vitest";
import {
  SLASH_COMMANDS,
  matchSlashCommands,
  slashMenuKey,
  slashQuery,
} from "../src/mindmap/flow/slashCommands";

describe("slashQuery (trigger detection)", () => {
  it("triggers only on a LEADING slash and returns the text after it", () => {
    expect(slashQuery("/")).toBe("");
    expect(slashQuery("/due")).toBe("due");
    expect(slashQuery("/add child")).toBe("add child");
  });

  it("does not trigger when the slash isn't first (a path/fraction is a normal topic)", () => {
    expect(slashQuery("etc/hosts")).toBeNull();
    expect(slashQuery("1/2 done")).toBeNull();
    expect(slashQuery("")).toBeNull();
    expect(slashQuery("plain topic")).toBeNull();
  });
});

describe("matchSlashCommands", () => {
  it("lists every command for an empty query", () => {
    expect(matchSlashCommands("")).toEqual(SLASH_COMMANDS);
    expect(matchSlashCommands("   ")).toEqual(SLASH_COMMANDS);
  });

  it("filters by label or keyword, case-insensitively", () => {
    expect(matchSlashCommands("child").map((c) => c.id)).toEqual(["child"]);
    // "task" is a keyword of the to-do command (not in its label).
    expect(matchSlashCommands("task").map((c) => c.id)).toEqual(["todo"]);
    expect(matchSlashCommands("PRIORITY").map((c) => c.id)).toEqual(["priority-high"]);
  });

  it("returns [] when nothing matches (caller closes the menu)", () => {
    expect(matchSlashCommands("zzzznope")).toEqual([]);
  });
});

describe("slashMenuKey (key routing while open)", () => {
  it("wraps the highlight with ArrowDown / ArrowUp", () => {
    expect(slashMenuKey("ArrowDown", 0, 3)).toEqual({ index: 1, action: "move" });
    expect(slashMenuKey("ArrowDown", 2, 3)).toEqual({ index: 0, action: "move" }); // wraps to top
    expect(slashMenuKey("ArrowUp", 0, 3)).toEqual({ index: 2, action: "move" }); // wraps to bottom
  });

  it("selects on Enter / Tab, closes on Escape, passes everything else through", () => {
    expect(slashMenuKey("Enter", 1, 3).action).toBe("select");
    expect(slashMenuKey("Tab", 1, 3).action).toBe("select");
    expect(slashMenuKey("Escape", 1, 3).action).toBe("close");
    expect(slashMenuKey("a", 1, 3).action).toBe("passthrough");
    expect(slashMenuKey("Backspace", 1, 3).action).toBe("passthrough");
  });
});
