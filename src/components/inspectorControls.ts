import type { CSSProperties } from "react";
import { colors } from "../design/tokens";

// Shared control vocabulary for the relationship + overlay inspectors (EdgeInspector +
// OverlayInspector): the colour swatch set, the field-label style, and the segmented-control row +
// button styles. Both panels present the same themed controls, so this keeps them visually identical
// and lets a tweak land once instead of twice.

/** Accent-aware relationship/overlay colour swatches; an empty pick resets to the shared default.
 *  Sourced from the one palette in design/tokens so every inspector stays in sync (P5). */
export const SWATCHES: readonly string[] = colors.strokeSwatches;

/** The small uppercase field-label above each inspector control group. */
export const fieldLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--ed-faint)",
  margin: "12px 0 5px",
};

/** A wrapping row of segmented-control buttons. */
export const segRow: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 4 };

/** A segmented-control button's style; `active` highlights it with the accent. */
export function seg(active: boolean): CSSProperties {
  return {
    border: `1px solid ${active ? "var(--ed-accent)" : "var(--ed-border)"}`,
    background: active ? "var(--ed-accent-tint)" : "var(--ed-card)",
    color: active ? "var(--ed-accent)" : "var(--ed-ink)",
    borderRadius: 7,
    cursor: "pointer",
    fontSize: 12.5,
    fontWeight: 600,
    padding: "3px 9px",
  };
}
