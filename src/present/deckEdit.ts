import type { SlideRef } from "../model/types";

// Pure list operations for the custom slide-deck editor: reorder, add, remove, and set a per-slide
// speaker note. Each returns a new array (never mutates) so the editor stays a controlled component
// and the ops are trivially unit-testable. The editor seeds its list from the resolved deck and
// commits the result via `setSlides`.

/** Move the slide at `from` to `to`, clamping both indices; out-of-range or no-op moves return the
 *  list unchanged (a new array only when something actually moved). */
export function reorderSlides(slides: SlideRef[], from: number, to: number): SlideRef[] {
  if (from < 0 || from >= slides.length) return slides;
  const target = Math.min(Math.max(to, 0), slides.length - 1);
  if (target === from) return slides;
  const next = [...slides];
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved);
  return next;
}

/** Append a slide for `nodeId` to the end of the deck. */
export function addSlide(slides: SlideRef[], nodeId: string): SlideRef[] {
  return [...slides, { nodeId }];
}

/** Remove the slide at `index` (out-of-range → unchanged). */
export function removeSlide(slides: SlideRef[], index: number): SlideRef[] {
  if (index < 0 || index >= slides.length) return slides;
  return slides.filter((_, i) => i !== index);
}

/** Set (or clear) the speaker note on the slide at `index`; a blank note is stored as `undefined`
 *  so it falls back to the topic's own note. Out-of-range → unchanged. */
export function setSlideNote(slides: SlideRef[], index: number, note: string): SlideRef[] {
  if (index < 0 || index >= slides.length) return slides;
  const trimmed = note.trim();
  return slides.map((s, i) => (i === index ? { ...s, note: trimmed ? note : undefined } : s));
}
