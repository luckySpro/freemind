import { t } from "../i18n";

// Paste through a small inert DOM whitelist; no remote image loads or active attributes.
export function sanitizeNotePaste(html: string, images: string[] = []): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  const allowed = new Set([
    "P",
    "DIV",
    "BR",
    "STRONG",
    "B",
    "EM",
    "I",
    "U",
    "S",
    "DEL",
    "MARK",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "UL",
    "OL",
    "LI",
    "BLOCKQUOTE",
    "PRE",
    "CODE",
    "TABLE",
    "THEAD",
    "TBODY",
    "TR",
    "TH",
    "TD",
    "A",
    "IMG",
  ]);
  let imageIndex = 0;
  const clean = (parent: ParentNode) => {
    for (const child of Array.from(parent.children)) {
      if (
        ["SCRIPT", "STYLE", "IFRAME", "OBJECT", "SVG", "MATH", "TEMPLATE"].includes(child.tagName)
      ) {
        child.remove();
        continue;
      }
      clean(child);
      if (!allowed.has(child.tagName)) {
        child.replaceWith(...Array.from(child.childNodes));
        continue;
      }
      const src = child.getAttribute("src") ?? "";
      const alt = child.getAttribute("alt") ?? "";
      const href = child.getAttribute("href") ?? "";
      const spans = [child.getAttribute("colspan"), child.getAttribute("rowspan")];
      for (const attribute of Array.from(child.attributes)) child.removeAttribute(attribute.name);
      if (child.tagName === "IMG") {
        const local = images[imageIndex++] ?? src;
        if (/^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(local)) {
          child.setAttribute("src", local);
          child.setAttribute("alt", alt);
        } else
          child.replaceWith(
            document.createTextNode(
              t("writing.remotePaste", { alt: alt || t("writing.pasteScreenshot") }),
            ),
          );
      }
      if (child.tagName === "A" && /^(https?:\/\/|mailto:|#)/i.test(href))
        child.setAttribute("href", href);
      if (["TH", "TD"].includes(child.tagName)) {
        for (const [index, attribute] of ["colspan", "rowspan"].entries()) {
          const n = Number(spans[index]);
          if (Number.isInteger(n) && n > 1 && n <= 100) child.setAttribute(attribute, String(n));
        }
      }
    }
  };
  clean(template.content);
  // Clipboard HTML may contain no <img> despite carrying image files.
  for (const src of images.slice(imageIndex)) {
    const img = document.createElement("img");
    img.src = src;
    template.content.append(img);
  }
  return template.innerHTML;
}
