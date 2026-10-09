// Render a small, safe Markdown subset for note previews. HTML is escaped first,
// then a handful of inline/block transforms are applied — so user notes can't
// inject markup. Pure + deterministic (unit-tested); the Notes panel feeds the
// result to dangerouslySetInnerHTML.

/** Word + character counts for a note string — the inspector's per-node facts line. Pure. */
export function noteCounts(text: string): { words: number; chars: number } {
  const trimmed = text.trim();
  return { words: trimmed ? trimmed.split(/\s+/).length : 0, chars: text.length };
}

function escapeHtml(s: string): string {
  // Quotes MUST be escaped too: the link transform drops the matched URL into a
  // double-quoted href="…", so a `"` in a markdown link would otherwise break
  // out of the attribute and inject live markup (e.g. an event handler). This
  // runs first on the whole note, so no user character survives as a raw quote.
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inline(s: string): string {
  return (
    s
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/~~([^~]+)~~/g, "<del>$1</del>")
      .replace(/==([^=]+)==/g, "<mark>$1</mark>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      // ![alt](url) images — only http(s) or data:image URLs, so no javascript:/other-scheme
      // injection. Runs BEFORE the link transform so the leading "!" isn't mistaken for link text.
      .replace(
        /!\[([^\]]*)\]\((https?:\/\/[^)\s]+|data:image\/[^)\s]+)\)/g,
        '<img src="$2" alt="$1" />',
      )
      // [text](http(s)://url) — only http(s) links, so no javascript: injection
      .replace(
        /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
      )
      // [text](#node=… / #map=…) — in-app links to a topic or another map. Marked with a class so the
      // note view can intercept the click and route it through the canvas, not the browser. (`&` in a
      // `#map=X&node=Y` target is `&amp;` after escaping; the DOM decodes it back on read.)
      .replace(
        /\[([^\]]+)\]\((#(?:node|map)=[^)\s]+)\)/g,
        '<a href="$2" class="mm-inote-link">$1</a>',
      )
  );
}

/** A `| a | b |` table row (after escaping). */
function isTableRow(line: string): boolean {
  return /^\|(.+)\|$/.test(line.trim());
}

/** The `| --- | :-: |` separator row under a table header. */
function isTableSeparator(line: string): boolean {
  const t = line.trim();
  return /^\|[\s:|-]+\|$/.test(t) && t.includes("-");
}

/** Split a `| a | b |` row into trimmed, inline-rendered cells. */
function tableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => inline(c.trim()));
}

export function renderNote(md: string): string {
  const lines = escapeHtml(md).split(/\r?\n/);
  const out: string[] = [];
  let listType: "ul" | "ol" | null = null;
  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };
  const openList = (type: "ul" | "ol") => {
    if (listType !== type) {
      closeList();
      out.push(`<${type}>`);
      listType = type;
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    // A ```fenced``` code block: everything until the closing fence is emitted verbatim (already
    // escaped), with no inline transforms. An unterminated fence runs to the end of the note.
    if (line.trim().startsWith("```")) {
      closeList();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        code.push(lines[i]);
        i++;
      }
      out.push(`<pre><code>${code.join("\n")}</code></pre>`); // outer ++ skips the closing fence
      continue;
    }
    // A GitHub-style pipe table: a header row immediately followed by a `---` separator, then any
    // number of body rows. Consumed as a block here (it spans lines, unlike the inline transforms).
    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      closeList();
      const headCells = tableCells(line);
      out.push("<table><thead><tr>");
      for (const c of headCells) out.push(`<th>${c}</th>`);
      out.push("</tr></thead><tbody>");
      i += 2; // skip the header + separator rows
      while (i < lines.length && isTableRow(lines[i].trimEnd())) {
        out.push("<tr>");
        for (const c of tableCells(lines[i].trimEnd())) out.push(`<td>${c}</td>`);
        out.push("</tr>");
        i++;
      }
      i--; // the outer loop will ++ past the last consumed row
      out.push("</tbody></table>");
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    // A task / checklist item ("- [ ] todo" / "- [x] done") — checked before the plain bullet so the
    // checkbox marker isn't swallowed into the item text.
    const task = line.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
    const bullet = line.match(/^[-*]\s+(.*)$/);
    const numbered = line.match(/^\d+\.\s+(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
    } else if (task) {
      openList("ul");
      const checked = task[1].toLowerCase() === "x";
      out.push(
        `<li><input type="checkbox" disabled${checked ? " checked" : ""}> ${inline(task[2])}</li>`,
      );
    } else if (bullet) {
      openList("ul");
      out.push(`<li>${inline(bullet[1])}</li>`);
    } else if (numbered) {
      openList("ol");
      out.push(`<li>${inline(numbered[1])}</li>`);
    } else if (line.trim() === "") {
      closeList();
    } else {
      closeList();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  return out.join("\n");
}

// Serialise the Notes editor's HTML back to the markdown subset renderNote understands — the inverse
// of renderNote, so the WYSIWYG editor stores plain markdown (keeping every export/search/presentation
// path that reads `note` as markdown working). Walks the DOM rather than regexing HTML so it tolerates
// the tag soup execCommand emits (b/strong, i/em, s/strike/del, ul/ol/li, h1-3, p/div, br, a).
function serializeChildren(node: Node): string {
  let s = "";
  for (const child of node.childNodes) s += serializeNode(child);
  return s;
}

function serializeList(listEl: Element, ordered: boolean): string {
  let s = "";
  let i = 0;
  for (const li of listEl.childNodes) {
    if (li.nodeType === 1 && (li as Element).tagName.toLowerCase() === "li") {
      // A checklist item carries a checkbox — emit "- [ ]" / "- [x]" and drop the input from the text
      // (remove it from this throwaway DOM copy so serializeChildren doesn't render it).
      const checkbox = !ordered
        ? ((li as Element).querySelector('input[type="checkbox"]') as HTMLInputElement | null)
        : null;
      let marker: string;
      if (checkbox) {
        marker = checkbox.checked ? "- [x] " : "- [ ] ";
        checkbox.remove();
      } else {
        marker = ordered ? `${++i}. ` : "- ";
      }
      s += `${marker}${serializeChildren(li).trim()}\n`;
    }
  }
  return s;
}

// Serialise a <table> back to a GitHub-style pipe table (header row + `---` separator + body rows).
// Tolerant of the markup execCommand / paste produce: it reads every <tr> and its td/th cells.
function serializeTable(table: Element): string {
  const rows = Array.from(table.querySelectorAll("tr"));
  if (rows.length === 0) return "";
  const cellsOf = (tr: Element) =>
    Array.from(tr.children)
      .filter((c) => ["td", "th"].includes(c.tagName.toLowerCase()))
      // collapse any inner newlines + escape pipes so a cell can't break the row structure
      .map((c) =>
        serializeChildren(c)
          .trim()
          .replace(/\s*\n\s*/g, " ")
          .replace(/\|/g, "\\|"),
      );
  const header = cellsOf(rows[0]);
  const md = [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...rows.slice(1).map((tr) => `| ${cellsOf(tr).join(" | ")} |`),
  ];
  return `${md.join("\n")}\n\n`;
}

function serializeNode(node: Node): string {
  if (node.nodeType === 3) return node.textContent ?? ""; // text
  if (node.nodeType !== 1) return "";
  const el = node as Element;
  if (el.tagName.toLowerCase() === "img")
    return `![${el.getAttribute("alt") ?? ""}](${el.getAttribute("src") ?? ""})`;
  if (el.tagName.toLowerCase() === "table") return serializeTable(el);
  // A code block: take the raw text (don't recurse — the inner <code> would become inline `code`).
  if (el.tagName.toLowerCase() === "pre") {
    const text = (el.textContent ?? "").replace(/\n+$/, "");
    return text.trim() ? `\`\`\`\n${text}\n\`\`\`\n\n` : "";
  }
  const inner = serializeChildren(el);
  switch (el.tagName.toLowerCase()) {
    case "strong":
    case "b":
      return inner.trim() ? `**${inner}**` : inner;
    case "em":
    case "i":
      return inner.trim() ? `*${inner}*` : inner;
    case "del":
    case "s":
    case "strike":
      return inner.trim() ? `~~${inner}~~` : inner;
    case "mark":
      return inner.trim() ? `==${inner}==` : inner;
    case "code":
      return inner.trim() ? `\`${inner}\`` : inner;
    case "a":
      return `[${inner}](${el.getAttribute("href") ?? ""})`;
    case "h1":
      return `# ${inner}\n\n`;
    case "h2":
      return `## ${inner}\n\n`;
    case "h3":
      return `### ${inner}\n\n`;
    case "ul":
      return `${serializeList(el, false)}\n`;
    case "ol":
      return `${serializeList(el, true)}\n`;
    case "li":
      return inner; // handled by serializeList
    case "br":
      return "\n";
    case "p":
    case "div":
      return `${inner}\n\n`;
    default:
      return inner;
  }
}

export function htmlToNote(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return serializeChildren(div)
    .replace(/[ \t]+\n/g, "\n") // trailing spaces before a newline
    .replace(/\n{3,}/g, "\n\n") // collapse blank-line runs
    .replace(/^\n+/, "")
    .trimEnd();
}
