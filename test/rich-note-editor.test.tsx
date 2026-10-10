// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RichNoteEditor from "../src/components/RichNoteEditor";

const image =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jbe0AAAAASUVORK5CYII=";

describe("rich note writing", () => {
  it("serialises mixed rich paste with table and embedded image to portable Markdown and reopens it", async () => {
    const onChange = vi.fn();
    const view = render(<RichNoteEditor value="" onChange={onChange} onBlur={() => {}} />);
    const editor = screen.getByRole("textbox", { name: "Rich notes" });
    fireEvent.paste(editor, {
      clipboardData: {
        files: [],
        getData: (type: string) =>
          type === "text/html"
            ? `<p><strong>设计说明</strong></p><table><tr><th>项目</th></tr><tr><td>离线</td></tr></table><img src="${image}" alt="截图">`
            : "",
      },
    });
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const markdown = String(onChange.mock.calls.at(-1)?.[0]);
    expect(markdown).toContain("**设计说明**");
    expect(markdown).toMatch(/\| 项目\s+\|/);
    expect(markdown).toContain(image);
    view.unmount();
    render(<RichNoteEditor value={markdown} onChange={vi.fn()} onBlur={() => {}} />);
    const reopened = screen.getByRole("textbox", { name: "Rich notes" });
    expect(reopened.querySelector("strong")?.textContent).toBe("设计说明");
    expect(reopened.querySelector("table")?.textContent).toContain("离线");
    expect(reopened.querySelector("img")?.getAttribute("src")).toBe(image);
  });

  it("pastes an image file into the body and retains its original bytes", async () => {
    const onChange = vi.fn();
    render(<RichNoteEditor value="已有正文" onChange={onChange} onBlur={() => {}} />);
    const bytes = Uint8Array.from(atob(image.split(",")[1]), (char) => char.charCodeAt(0));
    fireEvent.paste(screen.getByRole("textbox", { name: "Rich notes" }), {
      clipboardData: {
        files: [new File([bytes], "screenshot.png", { type: "image/png" })],
        getData: () => "",
      },
    });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.stringContaining(image)));
    expect(String(onChange.mock.calls.at(-1)?.[0])).toContain("已有正文");
    expect(
      screen.getByRole("textbox", { name: "Rich notes" }).querySelectorAll("img"),
    ).toHaveLength(1);
  });

  it("does not apply an in-flight image paste after its node editor is unmounted", async () => {
    const onChange = vi.fn();
    const view = render(<RichNoteEditor value="" onChange={onChange} onBlur={() => {}} />);
    fireEvent.paste(screen.getByRole("textbox", { name: "Rich notes" }), {
      clipboardData: {
        files: [new File(["pixels"], "screenshot.png", { type: "image/png" })],
        getData: () => "",
      },
    });
    view.unmount();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(onChange).not.toHaveBeenCalled();
  });
});
