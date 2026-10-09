import { useEffect, useState } from "react";

// App-wide motion preference. "system" follows the OS `prefers-reduced-motion`; "reduced"/"full"
// force it. Persisted best-effort (localStorage), mirroring useAppearance. The resolved boolean drives
// the JS-animated sites that CSS can't reach — canvas viewport tweens (fit/center/setViewport) and the
// guided walk's cinematic zoom — making them instant when motion is reduced. CSS transitions are
// already handled by an `@media (prefers-reduced-motion)` rule; the `reduce-motion` body class lets the
// in-app toggle (not just the OS) disable them too.

export type MotionPref = "system" | "reduced" | "full";
const KEY = "mindmap-reduce-motion";

function prefersReducedNow(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function useReducedMotion(): {
  motionPref: MotionPref;
  setMotionPref: (p: MotionPref) => void;
  /** Final resolved value: the user's forced choice, or the live OS preference under "system". */
  reducedMotion: boolean;
} {
  const [motionPref, setMotionPrefState] = useState<MotionPref>(() => {
    try {
      const v = localStorage.getItem(KEY);
      return v === "reduced" || v === "full" || v === "system" ? v : "system";
    } catch {
      return "system";
    }
  });
  const [prefersReduced, setPrefersReduced] = useState(prefersReducedNow);

  // Track the OS preference so "system" updates live when the user flips it.
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setPrefersReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const reducedMotion = motionPref === "reduced" || (motionPref === "system" && prefersReduced);

  // Mirror the resolved value onto a body class so CSS (including the in-app toggle, not just the OS
  // media query) can drop transitions/animations.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("reduce-motion", reducedMotion);
  }, [reducedMotion]);

  const setMotionPref = (p: MotionPref) => {
    setMotionPrefState(p);
    try {
      localStorage.setItem(KEY, p);
    } catch {
      // preference is best-effort
    }
  };

  return { motionPref, setMotionPref, reducedMotion };
}
