import { type Catalogue, registerMessages } from "../i18n/registry";

// English messages for the THEME DESIGNER dialog. Chunk-local: the dialog is its own lazy chunk
// (ThemeDesignerDialog-*.js), so these cost the entry bundle nothing.
//
// Imports `registerMessages` from `../i18n/registry`, NOT the `../i18n` barrel — the barrel pulls in
// the eager core catalogue and would drag every chrome string into this chunk.

export const THEME_EN = {
  "theme.themeDesigner": "Theme designer",
  "theme.themeName": "Theme name",
  "theme.nodeFillColour": "Node fill colour",
  "theme.themeFont": "Theme font",
  "theme.themeBranchWeight": "Theme branch weight",
  "theme.themePreview": "Theme preview",
  "theme.myTheme": "My theme",
  "theme.branch": "Branch",
  "theme.yourThemes": "Your themes",
  "theme.name": "Name",
  "theme.palette": "Palette",
  "theme.nodeFill": "Node fill",
  "theme.saveTheme": "Save theme",
  "theme.downloadJson": "Download .json",
  "theme.importJson": "Import .json",
  "theme.branchColourN": "Branch colour {n}",
} as const satisfies Catalogue;

export type ThemeKey = keyof typeof THEME_EN;

registerMessages("en", THEME_EN);
