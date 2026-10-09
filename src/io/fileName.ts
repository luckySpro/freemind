// One filename policy, shared by every "save this map to disk" path.
//
// There used to be three: `fileSystem.suggestedFileName` (strip characters the OS rejects),
// `useMapExports` (use the raw title), and the Start-screen download (an ASCII-only slug,
// `/[^a-z0-9]+/g`). The third silently destroyed non-English titles — "Årsplan for Ø-teamet"
// downloaded as `rsplan-for-teamet.json`, and a Japanese or Arabic title collapsed to nothing and
// fell back to `map.json`. Nothing about a filename needs to be ASCII: every filesystem the app
// runs on stores Unicode names, so the only characters worth removing are the ones the OS rejects.

/** A filesystem-safe file stem (no extension) from a map title.
 *
 *  Unicode-preserving by design — a Danish, German, Japanese or Arabic title keeps its own script.
 *  Only characters that are illegal in Windows/macOS/Linux filenames are replaced; a leading dot is
 *  dropped (it would make the file hidden, or extension-only), and the stem is length-capped.
 *  Returns `fallback` when nothing usable survives. */
export function safeFileStem(title: string, fallback = "mindmap"): string {
  const cleaned = (title || fallback)
    .replace(/[<>:"/\\|?*]+/g, "_") // characters illegal in Windows/macOS/Linux filenames
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "") // a leading dot would make it a hidden / extension-only name
    .slice(0, 80)
    .trim();
  return cleaned || fallback;
}
