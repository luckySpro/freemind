// Single source of truth for the editor's keyboard shortcuts + canvas gestures. The in-app cheat
// sheet (ShortcutsDialog) and the tooltips both read from here, so they can't drift from the actual
// bindings. Those bindings live in: src/mindmap/FlowMindMap.tsx (canvas keydown + pan/zoom props),
// src/App.tsx (⌘K / "/" / Escape), and src/mindmap/flow/TopicNode.tsx (B/I/U while editing).

import { t } from "./i18n";

export interface Shortcut {
  /** Display form of the keys/gesture, e.g. "Tab" or "Ctrl/⌘ + Z". */
  keys: string;
  action: string;
}

export interface ShortcutGroup {
  /** Stable identity — the React key. Never the title, which follows the locale. */
  id: string;
  title: string;
  items: Shortcut[];
}

// Cross-platform display: the canvas handles Ctrl OR ⌘ for the same bindings, so show both.
export function shortcutGroups(): ShortcutGroup[] {
  return [
    {
      id: "editing",
      title: t("shortcuts.group.editing"),
      items: [
        { keys: "Enter", action: t("shortcuts.action.addASiblingTopic") },
        { keys: "Tab", action: t("shortcuts.action.addAChildTopic") },
        { keys: "Ctrl/⌘ + Enter", action: t("shortcuts.action.addAChildTopic") },
        { keys: "Shift + Tab", action: t("shortcuts.action.outdentPromoteOneLevel") },
        { keys: "F2", action: t("shortcuts.action.renameTheSelectedTopic") },
        { keys: "Type a letter", action: t("shortcuts.action.startEditingTheSelectedTopic") },
        { keys: "Ctrl/⌘ + T", action: t("shortcuts.action.openTheSelectedTopicSNote") },
        {
          keys: "Delete / Backspace",
          action: t("shortcuts.action.deleteTheTopicItsBranchUndoable"),
        },
        { keys: "Ctrl/⌘ + C", action: t("shortcuts.action.copyTheSelectedBranch") },
        { keys: "Ctrl/⌘ + D", action: t("shortcuts.action.duplicateTheSelectedBranchAsA") },
        { keys: "Ctrl/⌘ + V", action: t("shortcuts.action.pasteAnImageOrTextAs") },
        { keys: "Ctrl/⌘ + Shift + V", action: t("shortcuts.action.pasteACopiedBranchUnderThe") },
        {
          keys: "Ctrl/⌘ + B / I / U",
          action: t("shortcuts.action.boldItalicUnderlineWhileEditing"),
        },
        { keys: "Ctrl/⌘ + Z", action: t("cmd.undo") },
        { keys: "Ctrl/⌘ + Shift + Z", action: t("cmd.redo") },
        { keys: "Ctrl/⌘ + Y", action: t("shortcuts.action.redoAlternative") },
        {
          keys: "Ctrl/⌘ + Shift + 1…9",
          action: t("shortcuts.action.setTheSelectedTopicSPriority"),
        },
      ],
    },
    {
      id: "selectionMoving",
      title: t("shortcuts.group.selectionMoving"),
      items: [
        { keys: "Arrow keys", action: t("shortcuts.action.moveTheSelectionThroughTheTree") },
        {
          keys: "Ctrl/⌘ + Shift + ↑ / ↓",
          action: t("shortcuts.action.reorderTheTopicAmongItsSiblings"),
        },
        {
          keys: "Alt + Shift + ← / →",
          action: t("shortcuts.action.outdentIndentTheSelectedTopic"),
        },
        { keys: "Ctrl/⌘ + arrow keys", action: t("shortcuts.action.nudgeTheTopicSPositionFree") },
        { keys: "Shift + drag", action: t("shortcuts.action.rubberBandSelectSeveralTopics") },
        {
          keys: "Ctrl/⌘ + Shift + L",
          action: t("shortcuts.action.startARelationshipArrowToA"),
        },
      ],
    },
    {
      id: "file",
      title: t("shortcuts.group.file"),
      items: [
        { keys: "Ctrl/⌘ + S", action: t("shortcuts.action.saveToTheLinkedFile") },
        { keys: "Ctrl/⌘ + Shift + S", action: t("shortcuts.action.saveToAFileAs") },
        { keys: "Ctrl/⌘ + O", action: t("shortcuts.action.openAFile") },
      ],
    },
    {
      id: "navigation",
      title: t("shortcuts.group.navigation"),
      items: [
        { keys: "Ctrl/⌘ + K", action: t("shortcuts.action.openTheCommandPaletteDoAnything") },
        { keys: "Ctrl/⌘ + ,", action: t("shortcuts.action.openSettingsPreferences") },
        { keys: "Ctrl/⌘ + .", action: t("shortcuts.action.focusOnTheSelectedTopicEsc") },
        { keys: "Ctrl/⌘ + F", action: t("shortcuts.action.openFindReplaceOrPress") },
        { keys: "/", action: t("shortcuts.action.openFindReplace") },
        { keys: "Alt + ←", action: t("shortcuts.action.goBackToThePreviousTopic") },
        { keys: "Alt + →", action: t("shortcuts.action.goForwardAgain") },
        { keys: "Esc", action: t("shortcuts.action.cancelClearTheCurrentSelection") },
      ],
    },
    {
      id: "view",
      title: t("common.view"),
      items: [
        { keys: "Drag the background", action: t("shortcuts.action.panTheCanvas") },
        { keys: "Space + drag", action: t("shortcuts.action.panTheCanvasEvenOverA") },
        { keys: "Scroll / ⌘ + scroll", action: t("shortcuts.action.zoomInAndOut") },
        { keys: "Ctrl/⌘ + + / −", action: t("shortcuts.action.zoomInOut") },
        { keys: "Ctrl/⌘ + 0", action: t("shortcuts.action.resetZoomTo100") },
        { keys: "Shift + 1", action: t("shortcuts.action.fitTheWholeMapToView") },
        { keys: "Shift + 2", action: t("shortcuts.action.fitTheSelectionToView") },
        { keys: "Double-click a topic", action: t("shortcuts.action.renameIt") },
        { keys: "Double-click the canvas", action: t("shortcuts.action.addAFloatingTopic") },
        {
          keys: "Drag a topic's grip",
          action: t("shortcuts.action.drawARelationshipToAnotherTopic"),
        },
      ],
    },
  ];
}

// Display bindings keyed by command id (the ids in editorCommands.ts), so menus + the ⌘K palette can
// show a shortcut hint at the point of use. ONLY commands that actually have a global key binding are
// listed — never invent one. Each value MUST appear verbatim as a `keys` string in shortcutGroups() above;
// `test/shortcut-bindings.test.ts` enforces that, so this map can't drift from the documented cheat-sheet.
export const SHORTCUT_BINDINGS: Record<string, string> = {
  undo: "Ctrl/⌘ + Z",
  redo: "Ctrl/⌘ + Shift + Z",
  "open-file": "Ctrl/⌘ + O",
  "save-file": "Ctrl/⌘ + S",
  "save-file-as": "Ctrl/⌘ + Shift + S",
  "nav-back": "Alt + ←",
  "nav-forward": "Alt + →",
  settings: "Ctrl/⌘ + ,",
  "start-relationship": "Ctrl/⌘ + Shift + L",
};
