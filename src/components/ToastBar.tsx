import type { CSSProperties } from "react";
import type { Toast } from "../hooks/useToast";
import { controlStyle } from "../ui";

// The app's single transient toast surface — a message plus an optional action button (e.g. the PWA
// "Refresh now" prompt). Purely presentational: `useToast` owns the one toast state, its auto-dismiss
// timer, and `showToast`; this component just renders whatever's there. It is mounted in BOTH the
// editor and the Start screen so a toast — notably the self-update prompt — is never silently
// swallowed depending on which view happens to be on screen.
//
// `variant` picks the placement: "inline" is the in-flow banner under the editor toolbar (unchanged
// look); "floating" is a fixed top-centre overlay for the Start screen, which has no banner stack.
// It sits above the Start content but below the ⌘K palette / modal backdrops (z-index 50).

const BASE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "8px 16px",
  color: "var(--ed-toast-ink, #26215c)",
  fontSize: 13,
};

const FLOATING: CSSProperties = {
  position: "fixed",
  top: 12,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 40,
  maxWidth: "calc(100% - 24px)",
  borderRadius: 10,
  border: "1px solid var(--ed-toast-border, #cecbf6)",
  boxShadow: "0 6px 24px rgba(38, 33, 92, 0.18)",
};

export function ToastBar({
  toast,
  onDismiss,
  variant = "inline",
}: {
  toast: Toast | null;
  onDismiss: () => void;
  variant?: "inline" | "floating";
}) {
  if (!toast) return null;
  const background =
    toast.kind === "success"
      ? "var(--ed-toast-success-bg, #eafaf0)"
      : "var(--ed-toast-info-bg, #eef2fc)";
  const style: CSSProperties =
    variant === "floating"
      ? { ...BASE, ...FLOATING, background }
      : { ...BASE, background, borderBottom: "1px solid var(--ed-toast-border, #cecbf6)" };
  return (
    <output aria-live="polite" style={style}>
      <span>{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.run();
            onDismiss();
          }}
          style={{ ...controlStyle, padding: "4px 12px" }}
        >
          {toast.action.label}
        </button>
      )}
    </output>
  );
}
