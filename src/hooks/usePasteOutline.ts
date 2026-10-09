import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useMemo,
  useState,
} from "react";
import { t } from "../i18n";
import { parsePaste } from "../io/pasteTable";
import type { MindMapHandle } from "../mindmap";
import type { MapNode, MindMapDoc } from "../model/types";

// "Paste text → map": parse a pasted outline / bullet list / Markdown / spreadsheet selection into a
// topic forest, then drop it in as a NEW map or UNDER the current selection. Lifted out of App; the
// parse + both placements are behaviour-identical. The dialog's live "N topics" count comes from
// `count` (memoised on the text).

/** Total nodes in a forest (recursive). */
function countForest(nodes: MapNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countForest(n.children), 0);
}

export interface UsePasteOutline {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  text: string;
  setText: Dispatch<SetStateAction<string>>;
  /** Live topic count of the current text (for the dialog footer). */
  count: number;
  /** Parse the text into a new map (single root, or a synthetic "Pasted map" wrapping a multi-root). */
  addAsNewMap: () => void;
  /** Append the parsed forest under the selected topic (false → hints to select one). */
  addUnderSelected: () => void;
}

export function usePasteOutline(opts: {
  load: (doc: MindMapDoc) => void;
  mapRef: RefObject<MindMapHandle | null>;
  showHint: (message: string) => void;
}): UsePasteOutline {
  const { load, mapRef, showHint } = opts;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const count = useMemo(() => countForest(parsePaste(text)), [text]);

  const addAsNewMap = useCallback(() => {
    const forest = parsePaste(text);
    if (forest.length === 0) {
      showHint(t("app.nothingToAddPasteAn"));
      return;
    }
    const root: MapNode =
      forest.length === 1 ? forest[0] : { id: "root", topic: "Pasted map", children: forest };
    load({
      schemaVersion: 1,
      id: crypto.randomUUID(),
      title: root.topic,
      root,
      meta: { source: "paste" },
    });
    setOpen(false);
    setText("");
    showHint(t("app.createdAMapFromThe"));
  }, [text, load, showHint]);

  const addUnderSelected = useCallback(() => {
    const forest = parsePaste(text);
    if (forest.length === 0) {
      showHint(t("app.nothingToAddPasteAn"));
      return;
    }
    if (!mapRef.current?.addSubtreeToSelected(forest)) {
      showHint(t("app.selectANodeFirstOr"));
      return;
    }
    setOpen(false);
    setText("");
    showHint(t("hint.addedTopics", { n: forest.length }));
  }, [text, mapRef, showHint]);

  return { open, setOpen, text, setText, count, addAsNewMap, addUnderSelected };
}
