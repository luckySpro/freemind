import type { Slide } from "./slides";

// Presenter view (XMind "Pitch" style): the extra context a presenter needs
// while speaking, derived purely from the slide list + current index so it's
// unit-testable. The overlay renders this alongside the (unchanged) audience
// slide — speaker notes, a peek at what's next, and an agenda "map" of the talk.

export interface AgendaItem {
  /** The slide's heading (overview title or branch topic). */
  heading: string;
  /** Index into the slide list — clicking an agenda item jumps here. */
  index: number;
  /** True for the slide currently on screen. */
  current: boolean;
}

export interface PresenterContext {
  /** The current slide's speaker notes (its node's `note`), or undefined if none. */
  notes: string | undefined;
  /** Heading of the next slide, or undefined on the last slide ("End of map"). */
  nextHeading: string | undefined;
  /** Every slide as an agenda row, with the current one flagged. */
  agenda: AgendaItem[];
}

/** Derive the presenter sidebar's content for the slide at `index`. Pure +
 *  deterministic. `index` is clamped so an out-of-range value never throws. */
export function presenterContext(slides: Slide[], index: number): PresenterContext {
  const safe = slides.length === 0 ? 0 : Math.min(Math.max(index, 0), slides.length - 1);
  const current = slides[safe];
  const nextSlide = slides[safe + 1];
  return {
    // A custom deck's per-slide note overrides the topic's own note.
    notes: current?.note ?? current?.node.note,
    nextHeading: nextSlide?.heading,
    agenda: slides.map((s, i) => ({ heading: s.heading, index: i, current: i === safe })),
  };
}
