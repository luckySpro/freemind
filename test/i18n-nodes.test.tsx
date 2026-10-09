// @vitest-environment jsdom
//
// `tNodes` — messages that interleave prose with markup.
//
// The point of this helper is REORDERING. Cutting `Press <kbd>Tab</kbd> for a child` into three JSX
// fragments also "works" in English, and would pass any test that only checks the rendered text. So
// the load-bearing case here is the one where a locale puts the placeholder somewhere else in the
// sentence: that is what fragments cannot do and this can. If that test is ever deleted, the helper
// has no reason to exist.
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { tNodes } from "../src/i18n/nodes";
import { type Catalogue, registerMessages } from "../src/i18n/registry";
import { CANVAS_EN } from "../src/mindmap/flow/messages";

// Overlay the real canvas catalogue, then put it back. `registerMessages` is later-wins global state.
const overlay = (messages: Record<string, string>) => registerMessages("en", messages as Catalogue);
afterEach(() => registerMessages("en", CANVAS_EN as Catalogue));

describe("tNodes", () => {
  it("renders the message with its placeholders as real nodes", () => {
    render(
      <div data-testid="out">
        {tNodes("canvas.coach.editKeys", { child: <kbd>Tab</kbd>, sibling: <kbd>Enter</kbd> })}
      </div>,
    );
    const out = screen.getByTestId("out");
    expect(out.textContent).toBe(
      "Press Tab for a child · Enter for a sibling · double-click to rename",
    );
    // The markup survived — this is the whole reason not to inline the key names into the message.
    expect([...out.querySelectorAll("kbd")].map((k) => k.textContent)).toEqual(["Tab", "Enter"]);
  });

  it("lets a locale REORDER the sentence around the placeholders", () => {
    // A word order no fragment-based approach can produce: the keys move to the front, and they swap.
    overlay({
      "canvas.coach.editKeys": "{sibling} laver en søskende, {child} laver et barn",
    });
    render(
      <div data-testid="out">
        {tNodes("canvas.coach.editKeys", { child: <kbd>Tab</kbd>, sibling: <kbd>Enter</kbd> })}
      </div>,
    );
    const out = screen.getByTestId("out");
    expect(out.textContent).toBe("Enter laver en søskende, Tab laver et barn");
    // Order follows the MESSAGE, not the order the nodes were passed in.
    expect([...out.querySelectorAll("kbd")].map((k) => k.textContent)).toEqual(["Enter", "Tab"]);
  });

  it("renders a placeholder used more than once", () => {
    overlay({ "canvas.coach.multiSelect": "{shift} then {shift} again" });
    render(
      <div data-testid="out">
        {tNodes("canvas.coach.multiSelect", { shift: <kbd>Shift</kbd> })}
      </div>,
    );
    expect(screen.getByTestId("out").querySelectorAll("kbd")).toHaveLength(2);
  });

  it("leaves an unknown placeholder as literal text, like t() does", () => {
    overlay({ "canvas.coach.multiSelect": "press {nope} now" });
    render(<div data-testid="out">{tNodes("canvas.coach.multiSelect", {})}</div>);
    expect(screen.getByTestId("out").textContent).toBe("press {nope} now");
  });

  it("falls back to vars for a placeholder that is not a node", () => {
    overlay({ "canvas.coach.multiSelect": "{shift} selects {count} topics" });
    render(
      <div data-testid="out">
        {tNodes("canvas.coach.multiSelect", { shift: <kbd>Shift</kbd> }, { count: 3 })}
      </div>,
    );
    expect(screen.getByTestId("out").textContent).toBe("Shift selects 3 topics");
  });

  it("does not re-read a var's VALUE as a placeholder", () => {
    // Interpolating everything up front would let user data inject markup: a topic named "{shift}"
    // would render a <kbd> element. Splitting the template before filling vars makes it impossible.
    overlay({ "canvas.coach.multiSelect": "renaming {name}" });
    render(
      <div data-testid="out">
        {tNodes("canvas.coach.multiSelect", { shift: <kbd>Shift</kbd> }, { name: "{shift}" })}
      </div>,
    );
    const out = screen.getByTestId("out");
    expect(out.textContent).toBe("renaming {shift}");
    expect(out.querySelectorAll("kbd")).toHaveLength(0);
  });

  it("selects a plural form and still substitutes nodes", () => {
    overlay({
      "canvas.bulk.deleteTopics": {
        one: "{icon} delete {n} topic",
        other: "{icon} delete {n} topics",
      } as unknown as string,
    });
    const { rerender } = render(
      <div data-testid="out">
        {tNodes("canvas.bulk.deleteTopics", { icon: <b>X</b> }, { n: 1 })}
      </div>,
    );
    expect(screen.getByTestId("out").textContent).toBe("X delete 1 topic");
    rerender(
      <div data-testid="out">
        {tNodes("canvas.bulk.deleteTopics", { icon: <b>X</b> }, { n: 4 })}
      </div>,
    );
    expect(screen.getByTestId("out").textContent).toBe("X delete 4 topics");
  });
});
