// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { sanitizeNotePaste } from "../src/components/notePaste";
import { readNoteImage } from "../src/io/noteImage";

describe("offline note paste", () => {
  it("preserves rich text and tables while stripping active markup and external images", () => {
    const html = sanitizeNotePaste(
      '<p onclick="bad()"><strong>重点</strong></p><table><tr><td>数据</td></tr></table><img src="https://remote.invalid/x.png" onerror="bad()"><script>bad()</script><a href="javascript:bad()">危险</a>',
    );
    expect(html).toContain("<strong>重点</strong>");
    expect(html).toContain("<td>数据</td>");
    expect(html).not.toMatch(/onclick|onerror|script|javascript:|remote.invalid/);
    expect(html).toContain("Image has no local data");
  });
  it("uses clipboard image bytes once in mixed HTML and avoids duplicate images", () => {
    const data = "data:image/png;base64,AA==";
    const html = sanitizeNotePaste('<p>前文<img src="file:///clipboard/image.png">后文</p>', [
      data,
    ]);
    expect(html.match(/<img/g)).toHaveLength(1);
    expect(html).toContain(data);
    expect(html.indexOf("前文")).toBeLessThan(html.indexOf("<img"));
    expect(html.indexOf("后文")).toBeGreaterThan(html.indexOf("<img"));
  });
  it("keeps original PNG bytes portable, rejecting unsupported and oversized images", async () => {
    const url = await readNoteImage(
      new File([new Uint8Array([137, 80, 78, 71])], "screenshot.png", { type: "image/png" }),
    );
    expect(url).toBe("data:image/png;base64,iVBORw==");
    await expect(
      readNoteImage(new File(["<svg/>"], "active.svg", { type: "image/svg+xml" })),
    ).rejects.toThrow("PNG");
    await expect(
      readNoteImage(
        new File([new Uint8Array(11 * 1024 * 1024)], "large.png", { type: "image/png" }),
      ),
    ).rejects.toThrow("10 MB");
  });
});
