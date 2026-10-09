import { t } from "../i18n/registry";
import "./messages";
import { unzipSync } from "fflate";

// Shared ZIP helper for the container-format importers (.docx / .xlsx / .smmx / .xmind / .itmz /
// .mind — all ZIP archives). Every one wrapped `unzipSync` in the same try/catch that rethrows a
// friendly "Not a valid <ext> file (could not unzip)" on a non-ZIP input; this is that one place.

/** Unzip `bytes`, or throw a friendly "Not a valid <ext> file (could not unzip)" if it isn't a ZIP.
 *  `ext` is the user-facing extension label (e.g. ".docx"). */
export function unzipOrThrow(bytes: Uint8Array, ext: string): Record<string, Uint8Array> {
  try {
    return unzipSync(bytes);
  } catch {
    throw new Error(t("io.err.notZip", { ext }));
  }
}
