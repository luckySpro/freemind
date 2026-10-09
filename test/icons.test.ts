import { describe, expect, it } from "vitest";
import { mindManagerIconToEmoji } from "../src/icons";

describe("mindManagerIconToEmoji", () => {
  it("maps common stock-icon names to emoji (case-insensitive)", () => {
    expect(mindManagerIconToEmoji("ThumbsUp")).toBe("👍");
    expect(mindManagerIconToEmoji("priority1")).toBe("1️⃣");
    expect(mindManagerIconToEmoji("Flag")).toBe("🚩");
  });

  it("keeps unknown names as-is so nothing is lost", () => {
    expect(mindManagerIconToEmoji("SomeCustomIcon")).toBe("SomeCustomIcon");
  });
});
