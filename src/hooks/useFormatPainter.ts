import { type RefObject, useCallback, useState } from "react";
import { t } from "../i18n";
import type { MindMapHandle } from "../mindmap";
import type { NodeStyle } from "../model/types";

// Format Painter — copy the selected topic's style, then paste it across a (multi-)selection. The
// copied style is held here so the "Paste format" affordance can enable/disable reactively. Lifted out
// of App; behaviour is unchanged (same hint copy, same handle calls).

export interface UseFormatPainter {
  copyFormat: () => void;
  pasteFormat: () => void;
  /** True once a style has been copied — gates the "Paste format" control. */
  canPasteFormat: boolean;
}

export function useFormatPainter(
  mapRef: RefObject<MindMapHandle | null>,
  showHint: (message: string) => void,
): UseFormatPainter {
  const [copiedStyle, setCopiedStyle] = useState<NodeStyle | null>(null);

  const copyFormat = useCallback(() => {
    const style = mapRef.current?.copySelectedStyle();
    if (!style) {
      showHint(t("app.selectATopicFirstThen2"));
      return;
    }
    setCopiedStyle(style);
    showHint(
      Object.keys(style).length > 0
        ? t("app.formatCopiedSelectTopicS")
        : t("app.thatTopicHasNoCustom"),
    );
  }, [mapRef, showHint]);

  const pasteFormat = useCallback(() => {
    if (!copiedStyle) return;
    if (!mapRef.current?.setSelectedStyle(copiedStyle)) showHint(t("hint.selectTopicFirst"));
  }, [mapRef, showHint, copiedStyle]);

  return { copyFormat, pasteFormat, canPasteFormat: copiedStyle !== null };
}
