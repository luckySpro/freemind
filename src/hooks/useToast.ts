import { useCallback, useEffect, useRef, useState } from "react";
import type { ToastAction, ToastKind, ToastOptions } from "../pwa/pwaUpdate";

// Transient toast/hint banner — a message + optional action button (e.g. PWA "Refresh now"), auto-
// dismissed after a few seconds. Lifted out of App (where it was a useState + a stray timer ref + two
// callbacks used ~50×) so the shell isn't carrying it and it's unit-testable. The auto-dismiss timer
// is cleared on unmount, so no setState fires after teardown.

export interface Toast {
  kind: ToastKind;
  message: string;
  action?: ToastAction;
}

export interface UseToast {
  /** The current toast, or null when none is showing. */
  toast: Toast | null;
  /** Show a toast of `kind` (auto-dismisses after `opts.durationMs`, default 4000ms). Stable identity
   *  so it can be handed to a one-time registrant (the PWA updater). */
  showToast: (kind: ToastKind, message: string, opts?: ToastOptions) => void;
  /** Message-only `info` shorthand used across the toolbar handlers. Stable identity. */
  showHint: (message: string) => void;
  /** Dismiss the current toast immediately (e.g. after running its action). */
  dismiss: () => void;
}

export function useToast(): UseToast {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((kind: ToastKind, message: string, opts?: ToastOptions) => {
    setToast({ kind, message, action: opts?.action });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), opts?.durationMs ?? 4000);
  }, []);

  const showHint = useCallback((message: string) => showToast("info", message), [showToast]);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setToast(null);
  }, []);

  // Clear a pending auto-dismiss on unmount so the timer can't fire setState after teardown.
  useEffect(() => () => clearTimeout(timer.current ?? undefined), []);

  return { toast, showToast, showHint, dismiss };
}
