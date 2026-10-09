// @vitest-environment jsdom
//
// The selection-based replacements for document.execCommand (backlog item 25). These assert the
// contract that actually matters: the markup each command leaves behind must serialise to the same
// markdown the old execCommand output did, since both editors round-trip through htmlToNote. DOM
// shape is an implementation detail; the markdown is the observable behaviour.
import { beforeEach, describe, expect, it } from "vitest";
import { htmlToNote } from "../src/noteFormat";
import {
  applyColor,
  createLink,
  formatBlock,
  insertText,
  rangeWithin,
  toggleInline,
  toggleList,
} from "../src/richTextCommands";

let root: HTMLDivElement;

beforeEach(() => {
  document.body.innerHTML = "";
  root = document.createElement("div");
  root.contentEditable = "true";
  document.body.appendChild(root);
});

/** Select `text` inside the root's first text node (or the whole contents when omitted). */
function selectAll(el: Node = root): void {
  const sel = window.getSelection();
  const r = document.createRange();
  r.selectNodeContents(el);
  sel?.removeAllRanges();
  sel?.addRange(r);
}

function selectSubstring(needle: string): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const i = (node.textContent ?? "").indexOf(needle);
    if (i >= 0) {
      const r = document.createRange();
      r.setStart(node, i);
      r.setEnd(node, i + needle.length);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(r);
      return;
    }
    node = walker.nextNode();
  }
  throw new Error(`no text node containing ${needle}`);
}

describe("toggleInline", () => {
  it("wraps the selection in a semantic tag that serialises to markdown", () => {
    for (const [tag, md] of [
      ["b", "**word**"],
      ["i", "*word*"],
      ["s", "~~word~~"],
    ] as const) {
      root.innerHTML = "word";
      selectAll();
      toggleInline(root, tag);
      expect(htmlToNote(root.innerHTML)).toBe(md);
    }
  });

  it("toggles off when the selection is already wholly inside the tag", () => {
    root.innerHTML = "<b>word</b>";
    selectSubstring("word");
    toggleInline(root, "b");
    expect(htmlToNote(root.innerHTML)).toBe("word");
  });

  it("toggles off a select-all over fully formatted content (Ctrl+A, Ctrl+B)", () => {
    // Found in a real browser, not jsdom: selectNodeContents(root) puts commonAncestorContainer at
    // the ROOT, so an ancestor-only lookup finds no <b> and double-wraps to <b><b>word</b></b>.
    root.innerHTML = "<b>word</b>";
    selectAll();
    toggleInline(root, "b");
    expect(root.querySelectorAll("b")).toHaveLength(0);
    expect(htmlToNote(root.innerHTML)).toBe("word");
  });

  it("toggles off across several separately wrapped runs", () => {
    root.innerHTML = "<b>one</b> <b>two</b>";
    selectAll();
    toggleInline(root, "b");
    expect(root.querySelectorAll("b")).toHaveLength(0);
    expect(root.textContent).toBe("one two");
  });

  it("formats when only part of the selection is already formatted, without nesting the tag", () => {
    root.innerHTML = "<b>one</b> two";
    selectAll();
    toggleInline(root, "b");
    expect(root.textContent).toBe("one two");
    // One <b> around the lot — not <b><b>one</b> two</b>, which would pile up over repeated use.
    expect(root.querySelectorAll("b")).toHaveLength(1);
    expect(htmlToNote(root.innerHTML)).toBe("**one two**");
  });

  it("formats a selection that PARTIALLY crosses elements, where surroundContents throws", () => {
    // The boundaries must land mid-element: a range that merely *contains* whole elements is fine for
    // surroundContents, so a whole-contents selection wouldn't exercise this at all.
    root.innerHTML = "<span>one</span><span>two</span>";
    const [a, b] = Array.from(root.querySelectorAll("span"));
    const r = document.createRange();
    r.setStart(a.firstChild as Text, 1); // inside "one"
    r.setEnd(b.firstChild as Text, 2); // inside "two"
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(r);
    // Prove the precondition: this is exactly the range surroundContents refuses.
    expect(() => r.cloneRange().surroundContents(document.createElement("b"))).toThrow();
    toggleInline(root, "b");
    expect(root.querySelector("b")?.textContent).toBe("netw");
    expect(root.textContent).toBe("onetwo");
  });

  it("keeps the text selected so formats can be stacked", () => {
    root.innerHTML = "word";
    selectAll();
    toggleInline(root, "b");
    toggleInline(root, "i");
    // Both applied to the same word, in either nesting order.
    expect(htmlToNote(root.innerHTML)).toBe("***word***");
  });

  it("no-ops on a collapsed selection (the one deliberate behaviour change)", () => {
    root.innerHTML = "word";
    const r = document.createRange();
    r.setStart(root.firstChild as Node, 2);
    r.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(r);
    toggleInline(root, "b");
    expect(root.innerHTML).toBe("word");
  });

  it("ignores a selection outside the editor", () => {
    const outside = document.createElement("div");
    outside.textContent = "elsewhere";
    document.body.appendChild(outside);
    root.innerHTML = "word";
    selectAll(outside);
    toggleInline(root, "b");
    expect(root.innerHTML).toBe("word");
    expect(outside.innerHTML).toBe("elsewhere");
  });
});

describe("applyColor", () => {
  it("wraps the selection in a coloured span", () => {
    root.innerHTML = "word";
    selectAll();
    applyColor(root, "#ff0000");
    expect(root.querySelector("span")?.style.color).toBe("rgb(255, 0, 0)");
    expect(root.textContent).toBe("word");
  });

  it("recolours an existing span instead of nesting a second one", () => {
    root.innerHTML = "word";
    selectAll();
    applyColor(root, "#ff0000");
    selectSubstring("word");
    applyColor(root, "#0000ff");
    expect(root.querySelectorAll("span")).toHaveLength(1);
    expect(root.querySelector("span")?.style.color).toBe("rgb(0, 0, 255)");
  });
});

describe("insertText", () => {
  it("replaces the selection with plain text (the paste path)", () => {
    root.innerHTML = "hello world";
    selectSubstring("world");
    insertText(root, "there");
    expect(root.textContent).toBe("hello there");
  });

  it("inserts markup as literal text, never as live DOM", () => {
    root.innerHTML = "x";
    selectAll();
    insertText(root, "<img onerror=alert(1)>");
    expect(root.querySelector("img")).toBeNull();
    expect(root.textContent).toBe("<img onerror=alert(1)>");
  });
});

describe("createLink", () => {
  it("wraps the captured range in an anchor that serialises to a markdown link", () => {
    root.innerHTML = "click me";
    selectSubstring("click me");
    const range = rangeWithin(root) as Range;
    createLink(range, "https://example.com");
    expect(htmlToNote(root.innerHTML)).toBe("[click me](https://example.com)");
  });
});

// The last commands off execCommand. Tractable here because the markdown subset is flat (serializeList
// reads only direct <li> children, so nesting isn't representable) and because Enter/Backspace inside
// an item is native contentEditable behaviour, not something execCommand provided.
describe("toggleList", () => {
  it("turns loose text into a bulleted list", () => {
    root.innerHTML = "milk";
    selectAll();
    toggleList(root, false);
    expect(htmlToNote(root.innerHTML)).toBe("- milk");
  });

  it("turns loose text into a numbered list", () => {
    root.innerHTML = "first";
    selectAll();
    toggleList(root, true);
    expect(htmlToNote(root.innerHTML)).toBe("1. first");
  });

  it("makes one item per block across a multi-block selection", () => {
    root.innerHTML = "<div>milk</div><div>eggs</div><div>bread</div>";
    selectAll();
    toggleList(root, false);
    expect(root.querySelectorAll("li")).toHaveLength(3);
    expect(htmlToNote(root.innerHTML)).toBe("- milk\n- eggs\n- bread");
  });

  it("numbers items in document order", () => {
    root.innerHTML = "<div>one</div><div>two</div>";
    selectAll();
    toggleList(root, true);
    expect(htmlToNote(root.innerHTML)).toBe("1. one\n2. two");
  });

  it("toggles a whole list back off", () => {
    root.innerHTML = "<ul><li>milk</li><li>eggs</li></ul>";
    selectAll();
    toggleList(root, false);
    expect(root.querySelectorAll("li")).toHaveLength(0);
    expect(root.querySelector("ul")).toBeNull();
    expect(root.textContent).toBe("milkeggs");
  });

  it("switches a bulleted list to numbered without losing items", () => {
    root.innerHTML = "<ul><li>one</li><li>two</li></ul>";
    selectAll();
    toggleList(root, true);
    expect(root.querySelector("ol")).toBeTruthy();
    expect(root.querySelector("ul")).toBeNull();
    expect(htmlToNote(root.innerHTML)).toBe("1. one\n2. two");
  });

  it("switches numbered back to bulleted", () => {
    root.innerHTML = "<ol><li>one</li></ol>";
    selectAll();
    toggleList(root, false);
    expect(htmlToNote(root.innerHTML)).toBe("- one");
  });

  it("lifts a block's contents into the item rather than nesting the wrapper", () => {
    // <li><div>x</div></li> serialises with a stray blank line, and the flat markdown subset has no
    // use for the wrapper.
    root.innerHTML = "<div>milk</div>";
    selectAll();
    toggleList(root, false);
    expect(root.querySelector("li > div")).toBeNull();
    expect(htmlToNote(root.innerHTML)).toBe("- milk");
  });

  it("keeps inline formatting inside an item", () => {
    root.innerHTML = "<div>buy <b>milk</b></div>";
    selectAll();
    toggleList(root, false);
    expect(htmlToNote(root.innerHTML)).toBe("- buy **milk**");
  });

  it("ignores a selection outside the editor", () => {
    const outside = document.createElement("div");
    outside.textContent = "elsewhere";
    document.body.appendChild(outside);
    root.innerHTML = "milk";
    selectAll(outside);
    toggleList(root, false);
    expect(root.innerHTML).toBe("milk");
  });
});

describe("formatBlock", () => {
  it("wraps loose text in the requested block", () => {
    root.innerHTML = "Title";
    selectAll();
    formatBlock(root, "h1");
    expect(htmlToNote(root.innerHTML)).toBe("# Title");
  });

  it("retags an existing block", () => {
    root.innerHTML = "<p>Title</p>";
    selectSubstring("Title");
    formatBlock(root, "h2");
    expect(htmlToNote(root.innerHTML)).toBe("## Title");
  });

  it("toggles back to a paragraph when the same tag is re-applied", () => {
    root.innerHTML = "<h3>Title</h3>";
    selectSubstring("Title");
    formatBlock(root, "h3");
    expect(htmlToNote(root.innerHTML)).toBe("Title");
  });

  it("tolerates the angle-bracket form execCommand accepted", () => {
    root.innerHTML = "<p>Title</p>";
    selectSubstring("Title");
    formatBlock(root, "<h1>");
    expect(htmlToNote(root.innerHTML)).toBe("# Title");
  });
});
