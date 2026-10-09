import { type RefObject, useEffect } from "react";
import { t } from "../i18n";
import { fileToMapImage } from "../io/image";
import { parsePaste } from "../io/pasteTable";
import type { MindMapHandle } from "../mindmap";

// Smart Ctrl/⌘+V on the canvas (not while focused in a text field / note editor, where ordinary paste
// wins). Routes by what's on the clipboard:
//   • an image → the selected topic's picture (the node-image pipeline);
//   • otherwise text → parsed into topics and grafted UNDER the selection with no dialog (a single
//     http(s) URL becomes one linked topic; an outline / bullet list / table becomes a subtree —
//     parsePaste already handles both). The Paste-text dialog stays for the no-selection / "as new
//     map" path; this is the fast in-place path Ctrl+V users expect.
// Copied branches still paste via Ctrl/⌘+Shift+V (the internal branch clipboard, keyIntent) — that's
// our own localStorage store, not the OS clipboard a paste event carries, so it stays on its own key.

export function useClipboardImagePaste(
  enabled: boolean,
  mapRef: RefObject<MindMapHandle | null>,
  showHint: (message: string) => void,
): void {
  useEffect(() => {
    if (!enabled) return;
    const onPaste = (e: ClipboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable))
        return;
      const data = e.clipboardData;
      if (!data) return;
      // Image first (a screenshot / copied picture): drop it onto the selected topic.
      const item = [...(data.items ?? [])].find((i) => i.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (file) {
        e.preventDefault();
        (async () => {
          try {
            const image = await fileToMapImage(file);
            const ok = mapRef.current?.setSelectedImage(image);
            showHint(ok ? t("app.imagePastedOntoTheSelected") : t("app.selectATopicFirstThen"));
          } catch (err) {
            showHint(err instanceof Error ? err.message : t("app.couldnTPasteThatImage"));
          }
        })();
        return;
      }
      // Otherwise, plain text → topics under the selection (URL → linked topic; outline → subtree).
      const text = data.getData("text/plain");
      if (!text.trim()) return;
      const forest = parsePaste(text);
      if (forest.length === 0) return;
      e.preventDefault();
      const ok = mapRef.current?.addSubtreeToSelected(forest);
      if (!ok) {
        showHint(t("app.selectATopicFirstTo"));
        return;
      }
      const n = forest.reduce((s, node) => s + 1 + countKids(node.children), 0);
      showHint(t("hint.pastedTopics", { n }));
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [enabled, mapRef, showHint]);
}

function countKids(nodes: { children: { children: unknown[] }[] }[]): number {
  return nodes.reduce((s, n) => s + 1 + countKids(n.children as never), 0);
}
