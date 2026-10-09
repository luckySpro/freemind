// Shared helpers for the hand-written OOXML exporters (.docx / .pptx / .xlsx). Each format
// is an Open Packaging Conventions ZIP of XML parts; this centralises the two cross-cutting
// rules — XML escaping and the deterministic OPC zip — so they can't drift between formats.

import { strToU8, zipSync } from "fflate";
// OOXML text lands inside element bodies (<w:t> / <a:t> / <t>), so content escaping (& < >) is what
// the .docx / .pptx / .xlsx builders need; re-exported under the existing name they import.
export { escapeXmlContent as escapeXml } from "./xml";

// ZIP's DOS timestamp can't predate 1980; pin every entry so the same input always produces
// byte-identical output instead of carrying wall-clock time.
const FIXED_MTIME = Date.parse("1980-01-01T00:00:00Z");

// Zip a set of named parts into a deterministic OPC package. Key order is preserved, so callers
// control entry order; every entry's mtime is pinned for reproducible output. String parts are XML
// (UTF-8 encoded); Uint8Array parts are pre-encoded binary media (e.g. embedded PNG slide images).
export function zipOoxml(parts: Record<string, string | Uint8Array>): Uint8Array {
  const files: Record<string, [Uint8Array, { mtime: number }]> = {};
  for (const [name, part] of Object.entries(parts)) {
    files[name] = [typeof part === "string" ? strToU8(part) : part, { mtime: FIXED_MTIME }];
  }
  return zipSync(files, { level: 6 });
}
