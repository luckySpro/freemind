import type { CSSProperties, ReactNode } from "react";
import { formatDateShort } from "./taskDate";

// Small read-only badges shown on topic nodes + board cards. Centralised here so the node and the
// Kanban card render identical badges (they had drifted) and the shape lives in one place. Named
// `Badge` (a <span>) to disambiguate from the interactive toggle `Chip` (a <button>) in
// design/primitives.tsx — they're different widgets that previously shared the bare name "Chip".

const BADGE: CSSProperties = {
  fontSize: 10.5,
  lineHeight: "16px",
  padding: "0 5px",
  borderRadius: 6,
  whiteSpace: "nowrap",
};

/** A small read-only badge. Neutral grey by default; pass bg/color/fontWeight for variants. */
export function Badge({
  children,
  bg = "rgba(0,0,0,0.06)",
  color = "inherit",
  fontWeight,
  title,
}: {
  children: ReactNode;
  bg?: string;
  color?: string;
  fontWeight?: number;
  title?: string;
}) {
  return (
    <span title={title} style={{ ...BADGE, background: bg, color, fontWeight }}>
      {children}
    </span>
  );
}

/** A due-date badge; red when overdue. `variant="badge"` = a full badge (on a node); `"text"` = plain
 *  coloured text (on a board card, where it inherits the card's font size). */
export function DateChip({
  due,
  overdue,
  variant = "badge",
}: {
  due: string;
  overdue: boolean;
  variant?: "badge" | "text";
}) {
  const label = `📅 ${formatDateShort(due)}`;
  const title = overdue ? `Overdue — was due ${due}` : `Due ${due}`;
  if (variant === "text") {
    return (
      <span
        style={{ color: overdue ? "#b42318" : "#8a8780", fontWeight: overdue ? 600 : 400 }}
        title={title}
      >
        {label}
      </span>
    );
  }
  return (
    <Badge
      title={title}
      bg={overdue ? "#fde2e2" : "rgba(0,0,0,0.06)"}
      color={overdue ? "#b42318" : "inherit"}
      fontWeight={overdue ? 600 : 400}
    >
      {label}
    </Badge>
  );
}
