import { t } from "../i18n/registry";
import "./messages";
import { strFromU8, unzipSync } from "fflate";
import type { MindMapDoc } from "../model/types";
import { fromMarkmap } from "./markmap";

// TextBundle / TextPack (Bear, Ulysses, iA Writer) → canonical model. A `.textpack` is a ZIP of a
// `.textbundle` folder; its main file is `text.<md|markdown|txt>`. We read that and reuse the
// Markdown importer (headings / indentation → tree). The bundle's `assets/` + `info.json` are
// ignored — we only want the outline. fflate does the unzip.
export function fromTextBundle(bytes: Uint8Array): MindMapDoc {
  const files = unzipSync(bytes);
  // The text file sits at the zip root or one folder deep (e.g. "My Note.textbundle/text.md").
  const key = Object.keys(files).find((p) => /(^|\/)text\.(md|markdown|txt)$/i.test(p));
  if (!key) throw new Error(t("io.err.noTextBundle"));
  return fromMarkmap(strFromU8(files[key]));
}
