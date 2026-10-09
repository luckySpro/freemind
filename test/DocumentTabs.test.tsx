// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentTabs } from "../src/components/DocumentTabs";

afterEach(cleanup);

const docs = [
  { id: "a", title: "Alpha" },
  { id: "b", title: "Beta" },
];

describe("DocumentTabs", () => {
  it("renders one tab per doc with the active one selected", () => {
    render(
      <DocumentTabs
        docs={docs}
        activeId="b"
        onActivate={() => {}}
        onClose={() => {}}
        onNew={() => {}}
      />,
    );
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.getByRole("tab", { name: "Alpha" }).getAttribute("aria-selected")).toBe("false");
    expect(screen.getByRole("tab", { name: "Beta" }).getAttribute("aria-selected")).toBe("true");
  });

  it("fires onActivate on a tab click and onNew on the + button", () => {
    const onActivate = vi.fn();
    const onNew = vi.fn();
    render(
      <DocumentTabs
        docs={docs}
        activeId="a"
        onActivate={onActivate}
        onClose={() => {}}
        onNew={onNew}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Beta" }));
    expect(onActivate).toHaveBeenCalledWith("b");
    fireEvent.click(screen.getByLabelText("New document"));
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it("fires onClose from the × button and on middle-click", () => {
    const onClose = vi.fn();
    render(
      <DocumentTabs
        docs={docs}
        activeId="a"
        onActivate={() => {}}
        onClose={onClose}
        onNew={() => {}}
      />,
    );
    fireEvent.click(screen.getByLabelText("Close Beta"));
    expect(onClose).toHaveBeenCalledWith("b");
    fireEvent(
      screen.getByRole("tab", { name: "Alpha" }),
      new MouseEvent("auxclick", { button: 1, bubbles: true, cancelable: true }),
    );
    expect(onClose).toHaveBeenCalledWith("a");
  });

  // Minimal DataTransfer stand-in (jsdom doesn't implement one); shared across a drag's events.
  const makeDT = () => {
    const data: Record<string, string> = {};
    return {
      effectAllowed: "",
      get types() {
        return Object.keys(data);
      },
      setData(k: string, v: string) {
        data[k] = v;
      },
      getData(k: string) {
        return data[k] ?? "";
      },
    };
  };

  it("fires onReorder when a tab is dragged onto another", () => {
    const onReorder = vi.fn();
    render(
      <DocumentTabs
        docs={docs}
        activeId="a"
        onActivate={() => {}}
        onClose={() => {}}
        onNew={() => {}}
        onReorder={onReorder}
      />,
    );
    const containers = screen.getAllByRole("tab").map((b) => b.closest(".mm-doctab") as Element);
    const dt = makeDT(); // one transfer object for the whole drag (start → drop)
    fireEvent.dragStart(containers[0], { dataTransfer: dt });
    fireEvent.drop(containers[1], { dataTransfer: dt });
    expect(onReorder).toHaveBeenCalledWith(0, 1);
  });

  it("ignores a non-tab drop (e.g. a dragged link/text) — no spurious reorder", () => {
    const onReorder = vi.fn();
    render(
      <DocumentTabs
        docs={docs}
        activeId="a"
        onActivate={() => {}}
        onClose={() => {}}
        onNew={() => {}}
        onReorder={onReorder}
      />,
    );
    const containers = screen.getAllByRole("tab").map((b) => b.closest(".mm-doctab") as Element);
    const foreign = makeDT(); // a drag that never started on a tab (no TAB_DND payload)
    foreign.setData("text/plain", "hello");
    fireEvent.drop(containers[1], { dataTransfer: foreign });
    expect(onReorder).not.toHaveBeenCalled();
  });

  it("falls back to a placeholder label for an untitled map", () => {
    render(
      <DocumentTabs
        docs={[{ id: "x", title: "" }]}
        activeId="x"
        onActivate={() => {}}
        onClose={() => {}}
        onNew={() => {}}
      />,
    );
    expect(screen.getByRole("tab", { name: "Untitled map" })).toBeTruthy();
  });
});
