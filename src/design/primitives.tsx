import type { ButtonHTMLAttributes, CSSProperties, ReactNode, Ref } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { colors, fontSize, fontWeight, radius, space } from "./tokens";

// Reusable chrome primitives, built from the design tokens. Each one's *default* rendered output is
// pixel-identical to the inline styles it replaces (src/ui.ts, src/Panels.tsx) — this is an
// extraction, not a restyle. Every primitive accepts `style` (merged last, so callers can extend or
// override) and forwards the rest of its native props, so existing call-sites keep their titles,
// aria-*, onClick, etc.

/** The base "control" look — the toolbar button / pill (was `controlStyle` in ui.ts). Exported so
 *  ui.ts can re-export it for the App toolbar, which still consumes the raw style object. */
export const controlStyle = {
  fontSize: fontSize.md,
  fontWeight: fontWeight.semibold,
  color: colors.text,
  border: `1px solid ${colors.controlBorder}`,
  background: colors.controlBg,
  borderRadius: radius.lg,
  padding: `${space.md}px ${space.xl}px`,
  cursor: "pointer",
  // Keep size in the mobile single-row toolbar so it scrolls horizontally instead of squishing
  // (no-op on the desktop wrapping toolbar, where controls keep their size anyway).
  flexShrink: 0,
} as const satisfies CSSProperties;

/** The base text-input look (was `inputStyle` in ui.ts). White surface, control border. */
export const inputStyle = {
  fontSize: fontSize.md,
  color: colors.text,
  border: `1px solid ${colors.controlBorder}`,
  background: colors.white,
  borderRadius: radius.lg,
  padding: `${space.md}px ${space.xl}px`,
  width: 130,
  flexShrink: 0,
} as const satisfies CSSProperties;

// The active control look: a solid accent-on-white-text swatch. Several callers (progress steps,
// priority, history) override the colours per-control, but the default lit state is the deep-ink
// fill the toolbar/info panel uses for a pressed control.
const ACTIVE_CONTROL: CSSProperties = {
  background: colors.text,
  color: colors.white,
  border: `1px solid ${colors.text}`,
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** When true, renders the pressed look and sets `aria-pressed` (a toggle button). */
  active?: boolean;
  ref?: Ref<HTMLButtonElement>;
};

/** A control button with the toolbar look. `active` gives the pressed/aria-pressed variant; the
 *  native `disabled` attribute is forwarded (callers already rely on the browser default styling).
 *  `type` defaults to "button" so these never submit a form. */
export function Button({ active, style, type, className, ...rest }: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      aria-pressed={active ? true : rest["aria-pressed"]}
      className={className ? `mm-prim-btn ${className}` : "mm-prim-btn"}
      style={{ ...controlStyle, ...(active ? ACTIVE_CONTROL : null), ...style }}
      {...rest}
    />
  );
}

/** A text input with the chrome look. Forwards all native input props (value/onChange/placeholder/
 *  aria-label/type/defaultValue/onKeyDown/onBlur…). */
export function Input({
  style,
  ref,
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return (
    <input
      ref={ref}
      className={className ? `mm-prim-input ${className}` : "mm-prim-input"}
      style={{ ...inputStyle, ...style }}
      {...rest}
    />
  );
}

/** A select with the same control look as Input (the panels render selects at input width). */
export function Select({
  style,
  children,
  ref,
  className,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement> }) {
  return (
    <select
      ref={ref}
      className={className ? `mm-prim-select ${className}` : "mm-prim-select"}
      style={{ ...inputStyle, ...style }}
      {...rest}
    >
      {children}
    </select>
  );
}

// The toggle-chip look used by the Filter panel marker/tag chips: a rounded outline that fills with
// the accent when selected. (Distinct from `Badge` in src/Badge.tsx, a tiny read-only <span> badge.)
const CHIP_BASE: CSSProperties = {
  borderRadius: radius.md,
  cursor: "pointer",
  fontSize: fontSize.md,
  lineHeight: 1.4,
  padding: `${space.xxs}px ${space.md + 1}px`,
};

type ChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color"> & {
  /** Lit (selected) state — solid accent fill, sets aria-pressed. */
  selected?: boolean;
};

/** A selectable toggle chip (Filter panel). Selected = accent fill + white text + accent border;
 *  unselected = white fill, control border, ink text. */
export function Chip({ selected, style, type, className, children, ...rest }: ChipProps) {
  return (
    <button
      type={type ?? "button"}
      aria-pressed={selected}
      className={className ? `mm-prim-chip ${className}` : "mm-prim-chip"}
      style={{
        ...CHIP_BASE,
        border: `1px solid ${selected ? colors.accent : colors.controlBorder}`,
        background: selected ? colors.accent : colors.white,
        color: selected ? colors.white : colors.text,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

/** The left-rail panel shell — a fixed-width flex column with a right divider (was `PANEL_ASIDE`).
 *  Pass `width` to override the default 250 (the Info panel uses 280); `style` merges last. */
export function Panel({
  children,
  width = 250,
  style,
}: {
  children: ReactNode;
  width?: number;
  style?: CSSProperties;
}) {
  return (
    <aside
      style={{
        width,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        borderRight: `1px solid ${colors.border}`,
        background: colors.surface,
        ...style,
      }}
    >
      {children}
    </aside>
  );
}

/** A small-caps section header inside a panel (was `PANEL_GROUP_LABEL`). Used on its own as a label
 *  before a block of controls. */
export function PanelSection({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      className="mm-prim-section"
      style={{
        padding: `${space.lg}px ${space.xl}px ${space.xxs}px`,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
        color: colors.faint,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// A segmented tab strip — the start screen's `.st-tabs` pattern (CaptureCard) ported to the panel
// palette so the Info panel can group its sections into tabs. The container is a faint inset pill;
// the active tab gets a raised white card. Each button is role="tab"/aria-selected (matching the
// start-screen idiom); state lives in the caller.
const TABLIST_BASE: CSSProperties = {
  display: "flex",
  gap: 2,
  padding: 3,
  margin: `${space.md}px ${space.xl}px ${space.xs}px`,
  background: colors.surfaceBar,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.lg,
  flexShrink: 0,
};
const TAB_BASE: CSSProperties = {
  flex: 1,
  border: "none",
  background: "transparent",
  color: colors.muted,
  font: "inherit",
  fontWeight: fontWeight.semibold,
  fontSize: fontSize.sm,
  padding: `${space.md}px ${space.lg}px`,
  borderRadius: radius.md,
  cursor: "pointer",
};
const TAB_SELECTED: CSSProperties = {
  background: colors.white,
  color: colors.text,
  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.08)",
};

export interface TabItem {
  id: string;
  label: ReactNode;
  /** Optional tooltip / accessible hint for the tab button. */
  title?: string;
}

/** Stable id prefix for a tab/tabpanel pair (so a panel can set aria-labelledby back to its tab). */
export const tabId = (base: string, id: string) => `${base}-tab-${id}`;
export const tabPanelId = (base: string, id: string) => `${base}-panel-${id}`;

/** A segmented tab strip (WAI-ARIA tablist with roving tabindex + arrow/Home/End keys). `active` is
 *  the selected tab id; `onChange` fires with the chosen id. `idBase` ties each tab to its panel via
 *  aria-controls (the caller wraps each body in role="tabpanel" id={tabPanelId(idBase, id)}). The
 *  caller renders the matching tab body itself (this is just the selector). */
export function Tabs({
  tabs,
  active,
  onChange,
  ariaLabel,
  idBase,
  style,
}: {
  tabs: readonly TabItem[];
  active: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  idBase: string;
  style?: CSSProperties;
}) {
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const isArrow = e.key === "ArrowRight" || e.key === "ArrowLeft";
    if (!isArrow && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const idx = tabs.findIndex((x) => x.id === active);
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? tabs.length - 1
          : (idx + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    const nt = tabs[next];
    if (!nt) return;
    onChange(nt.id);
    (e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
  };
  return (
    <div
      className="mm-prim-tablist"
      role="tablist"
      aria-label={ariaLabel}
      style={{ ...TABLIST_BASE, ...style }}
    >
      {tabs.map((t) => {
        const selected = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={tabId(idBase, t.id)}
            aria-selected={selected}
            aria-controls={tabPanelId(idBase, t.id)}
            tabIndex={selected ? 0 : -1}
            title={t.title}
            onClick={() => onChange(t.id)}
            onKeyDown={onKeyDown}
            className="mm-prim-tab"
            style={{ ...TAB_BASE, ...(selected ? TAB_SELECTED : null) }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Menu (accessible dropdown) ────────────────────────────────────────────────
// One shared dropdown: a trigger button + an anchored popover with WAI-ARIA menu semantics and
// keyboard nav — the idiom the toolbar's five menus (and, later, the canvas context menu) share.
// The trigger advertises aria-haspopup/aria-expanded; the popup is role="menu" with roving
// Arrow/Home/End focus, Enter/Space activate (native button click), Escape closes AND restores focus
// to the trigger, Tab closes, click-outside closes. It emits the existing `.mm-menu*` classes so this
// is a behaviour extraction, not a restyle. Content is arbitrary (labels, items, even embedded
// selects), so roving targets every focusable descendant in DOM order. Items call `close()` via
// context (MenuItem auto-closes; MenuCheckboxItem stays open); the render-prop form `(close) => …`
// is also supported for leaf controls (file inputs, embedded selects) that close imperatively.

const FOCUSABLE_IN_MENU =
  'button:not([disabled]), a[href], select:not([disabled]), input:not([disabled]), [tabindex="0"]';

/** The roving-focus targets inside a menu popup, in DOM order (every focusable, incl. embedded
 *  selects). Shared by Menu + ContextMenu so their keyboard nav is identical. */
const menuItemsOf = (root: HTMLElement | null): HTMLElement[] =>
  root ? Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_IN_MENU)) : [];

/** The shared roving handler: Arrow/Home/End move focus among items (wrap, skip disabled); Tab
 *  closes. Returns true if it handled the key. */
function roveMenuKey(
  e: React.KeyboardEvent,
  menuRef: React.RefObject<HTMLElement | null>,
  closeOnTab: () => void,
): void {
  if (e.key === "Tab") {
    closeOnTab();
    return;
  }
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
  const list = menuItemsOf(menuRef.current);
  if (list.length === 0) return;
  e.preventDefault();
  const cur = list.indexOf(document.activeElement as HTMLElement);
  const next =
    e.key === "Home"
      ? 0
      : e.key === "End"
        ? list.length - 1
        : e.key === "ArrowDown"
          ? cur < 0
            ? 0
            : (cur + 1) % list.length
          : cur <= 0
            ? list.length - 1
            : cur - 1;
  list[next]?.focus();
}

const MenuCtx = createContext<{ close: () => void } | null>(null);

export function Menu({
  trigger,
  triggerClassName = "mm-tbtn mm-tbtn-ghost",
  triggerTitle,
  triggerAriaLabel,
  align = "left",
  menuAriaLabel,
  sheet = false,
  disabled = false,
  children,
}: {
  /** Inner content of the trigger button (icon + label + chevron). */
  trigger: ReactNode;
  triggerClassName?: string;
  triggerTitle?: string;
  triggerAriaLabel?: string;
  align?: "left" | "right";
  menuAriaLabel?: string;
  /** Phone layout: open as a full-width bottom sheet instead of an anchored popover. */
  sheet?: boolean;
  /** Disables the trigger button (native `disabled` — a disabled button never fires click/keydown, so
   *  the menu simply can't open). Matches a disabled native `<select>`'s behaviour for a Menu-based
   *  replacement. */
  disabled?: boolean;
  /** Popup content, or a render-prop given `close` for leaf controls that close imperatively. */
  children: ReactNode | ((close: () => void) => ReactNode);
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Anchor below the trigger, then clamp into the viewport: flip above if it would overflow the
  // bottom, and slide left if it would overflow the right edge. Uses the menu's measured size once
  // it's mounted (a no-op first pass before that), so a useLayoutEffect re-runs it after open.
  const reposition = useCallback(() => {
    if (sheet) return; // bottom-sheet mode is CSS-positioned, not anchored
    const b = btnRef.current;
    if (!b) return;
    const tr = b.getBoundingClientRect();
    const mr = menuRef.current?.getBoundingClientRect();
    const mw = mr?.width ?? 0;
    const mh = mr?.height ?? 0;
    const margin = 4;
    let top = tr.bottom + margin;
    if (mh && top + mh > window.innerHeight) {
      const above = tr.top - mh - margin;
      top = above >= margin ? above : Math.max(margin, window.innerHeight - mh - margin);
    }
    let left = align === "left" ? tr.left : tr.right - mw;
    if (mw && left + mw > window.innerWidth) left = window.innerWidth - mw - margin;
    if (left < margin) left = margin;
    setPos({ top, left });
  }, [align, sheet]);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) btnRef.current?.focus();
  }, []);

  // Outside-pointerdown + Escape close; reposition on resize/scroll while open.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, reposition, close]);

  // Once the menu is mounted, re-clamp using its real measured size (before paint, so no flicker).
  useLayoutEffect(() => {
    if (open) reposition();
  }, [open, reposition]);

  // On open, move focus into the menu (first focusable item) — keyboard users land inside.
  useEffect(() => {
    if (open) menuItemsOf(menuRef.current)[0]?.focus();
  }, [open]);

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      reposition();
      setOpen(true);
    }
  };

  // Tab from inside the menu closes it WITHOUT restoring focus (so focus moves out naturally).
  const onMenuKeyDown = (e: React.KeyboardEvent) => roveMenuKey(e, menuRef, () => setOpen(false));

  return (
    <div className="mm-menu-wrap" ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        className={triggerClassName}
        aria-haspopup="menu"
        aria-expanded={open}
        title={triggerTitle}
        aria-label={triggerAriaLabel}
        disabled={disabled}
        onClick={() => {
          if (!open) reposition();
          setOpen((o) => !o);
        }}
        onKeyDown={onTriggerKeyDown}
      >
        {trigger}
      </button>
      {open && (sheet || pos) && (
        <div
          className={sheet ? "mm-menu mm-menu-sheet" : "mm-menu"}
          role="menu"
          aria-label={menuAriaLabel}
          ref={menuRef}
          style={sheet ? undefined : (pos ?? undefined)}
          onKeyDown={onMenuKeyDown}
        >
          <MenuCtx.Provider value={{ close: () => close(true) }}>
            {typeof children === "function" ? children(() => close(true)) : children}
          </MenuCtx.Provider>
        </div>
      )}
    </div>
  );
}

/** A menu action. Auto-closes the menu on select (pass `closeOnSelect={false}` to keep it open). */
export function MenuItem({
  icon,
  label,
  children,
  danger,
  disabled,
  closeOnSelect = true,
  title,
  shortcut,
  onSelect,
}: {
  icon?: ReactNode;
  label?: string;
  children?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  closeOnSelect?: boolean;
  title?: string;
  /** Optional keyboard hint shown right-aligned (aria-hidden, so it doesn't alter the item's name). */
  shortcut?: string;
  onSelect: () => void;
}) {
  const ctx = useContext(MenuCtx);
  return (
    <button
      type="button"
      role="menuitem"
      title={title}
      disabled={disabled}
      className={danger ? "mm-menu-item mm-menu-item-danger" : "mm-menu-item"}
      onClick={() => {
        onSelect();
        if (closeOnSelect) ctx?.close();
      }}
    >
      {icon}
      {label}
      {children}
      {shortcut ? (
        <span className="mm-menu-shortcut" aria-hidden="true">
          {shortcut}
        </span>
      ) : null}
    </button>
  );
}

/** A checkbox menu item (a toggle). Stays open on select by default (toggle several in a row). */
export function MenuCheckboxItem({
  icon,
  label,
  checked,
  trailing,
  closeOnSelect = false,
  onSelect,
}: {
  icon?: ReactNode;
  label: string;
  checked: boolean;
  /** Optional trailing node (e.g. a check glyph) shown when `checked`. */
  trailing?: ReactNode;
  closeOnSelect?: boolean;
  onSelect: () => void;
}) {
  const ctx = useContext(MenuCtx);
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      className="mm-menu-item"
      onClick={() => {
        onSelect();
        if (closeOnSelect) ctx?.close();
      }}
      style={
        checked ? { color: "var(--ed-accent)", background: "var(--ed-accent-tint)" } : undefined
      }
    >
      {icon}
      {label}
      {checked && trailing}
    </button>
  );
}

/** A small uppercase section heading inside a menu. */
export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="mm-menu-label">{children}</div>;
}

/** A horizontal rule between menu groups (decorative, matching the original `.mm-menu-sep` div). */
export function MenuSeparator() {
  return <div className="mm-menu-sep" />;
}

/** A fly-out submenu row inside an open Menu/ContextMenu — e.g. "Map parts ▸" — so a long flat list can
 *  group related items behind one row instead of listing them all inline. Opens on hover or click/Enter/
 *  ArrowRight, closes on mouse-leave (a short grace delay to cross the gap), Escape, or an outside click
 *  (the enclosing Menu's own outside-click already covers "click elsewhere entirely"). Selecting a leaf
 *  `MenuItem` inside still closes the WHOLE chain — it reuses the parent's `MenuCtx`, only this row's own
 *  open/closed flyout state is local. Position is viewport-fixed (matches `.mm-menu`), flipping to the
 *  trigger's left edge when the flyout would overflow the right. */
export function MenuSub({
  icon,
  label,
  disabled,
  children,
}: {
  icon?: ReactNode;
  label: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const rowRef = useRef<HTMLButtonElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);

  const clearCloseTimer = () => {
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  // Anchor beside the trigger row, then clamp into the viewport (mirrors Menu's own reposition).
  // The FIRST call (from openNow, below, before the flyout div exists) necessarily guesses with
  // sw=0/sh=0 — no overflow clamp yet, since there's nothing to measure. The layout effect below
  // re-invokes this once the (now-mounted, guessed-position) div is real and measurable, correcting
  // the guess in a second pass — the same two-pass pattern Menu uses for its own popover.
  const reposition = useCallback(() => {
    const row = rowRef.current;
    if (!row) return;
    const tr = row.getBoundingClientRect();
    const sr = subRef.current?.getBoundingClientRect();
    const sw = sr?.width ?? 0;
    const sh = sr?.height ?? 0;
    const margin = 4;
    let left = tr.right + margin;
    if (sw && left + sw > window.innerWidth) left = Math.max(margin, tr.left - sw - margin);
    let top = tr.top;
    if (sh && top + sh > window.innerHeight)
      top = Math.max(margin, window.innerHeight - sh - margin);
    setPos({ top, left });
  }, []);

  const openNow = () => {
    clearCloseTimer();
    reposition(); // synchronous first-pass guess, so `pos` is already set when `open` flips true
    setOpen(true);
  };
  // A short grace delay so the pointer can travel diagonally from the row into the flyout without it
  // closing mid-move (the standard menu-hover pattern).
  const closeSoon = () => {
    clearCloseTimer();
    closeTimer.current = window.setTimeout(() => setOpen(false), 150);
  };

  // Second pass: now that `open` (and the first-guess `pos`) let the flyout div actually mount, this
  // runs AFTER that commit — subRef is populated with its real measured size, so reposition() can
  // correct the guess (clamp into the viewport) instead of the sw=0/sh=0 first pass.
  useLayoutEffect(() => {
    if (open) reposition();
  }, [open, reposition]);

  // No submenu-local Escape handling: the enclosing Menu/ContextMenu already closes the WHOLE popover
  // stack on Escape (its own document-capture listener runs first, having been registered when it
  // opened) — one Escape backs all the way out, which is simple and predictable rather than requiring
  // one Escape per nesting level.
  useEffect(() => {
    return () => {
      if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
    };
  }, []);

  return (
    <div
      onMouseEnter={disabled ? undefined : openNow}
      onMouseLeave={disabled ? undefined : closeSoon}
    >
      <button
        ref={rowRef}
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        className="mm-menu-item"
        // Opens (not toggles) — a real pointer click also fires onMouseEnter first, which already
        // opened it; toggling here would immediately flip it back closed.
        onClick={() => (disabled ? undefined : openNow())}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openNow();
          }
        }}
      >
        {icon}
        {label}
        <span className="mm-menu-sub-caret" aria-hidden="true">
          ▸
        </span>
      </button>
      {open && pos ? (
        <div
          className="mm-menu mm-menu-sub"
          role="menu"
          aria-label={label}
          ref={subRef}
          style={{ top: pos.top, left: pos.left }}
          onMouseEnter={openNow}
          onMouseLeave={closeSoon}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

// ── ContextMenu (point-anchored) ──────────────────────────────────────────────
// The right-click menu variant of the primitive: no trigger button — the caller renders it at a
// viewport point {x,y} and clears it via `onClose`. Same role="menu" + roving keyboard + focus-first
// + Escape/click-outside/Tab close as Menu, so the canvas context menu gets the dropdowns' a11y. It
// carries `data-mm-menu` so any host-side "click outside the menu" guard still recognises it. Items
// use MenuItem/MenuSeparator exactly as in a Menu (the close comes from `onClose`).
export function ContextMenu({
  x,
  y,
  onClose,
  menuAriaLabel,
  sheet = false,
  children,
}: {
  x: number;
  y: number;
  onClose: () => void;
  menuAriaLabel?: string;
  /** Phone layout: render as a full-width bottom sheet instead of a point-anchored popover. */
  sheet?: boolean;
  children: ReactNode | ((close: () => void) => ReactNode);
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  // Start at the requested point; clamp into the viewport once measured (below).
  const [pos, setPos] = useState({ top: y, left: x });

  // Focus the first item on mount so the menu is immediately keyboard-drivable.
  useEffect(() => {
    menuItemsOf(menuRef.current)[0]?.focus();
  }, []);

  // Clamp the point into the viewport using the menu's measured size — so a right-click near the
  // bottom/right edge stays fully on-screen (before paint, so it never flashes off-edge).
  useLayoutEffect(() => {
    if (sheet) return; // bottom-sheet mode is CSS-positioned
    const mr = menuRef.current?.getBoundingClientRect();
    const mw = mr?.width ?? 0;
    const mh = mr?.height ?? 0;
    const margin = 4;
    let top = y;
    let left = x;
    if (mh && top + mh > window.innerHeight)
      top = Math.max(margin, window.innerHeight - mh - margin);
    if (mw && left + mw > window.innerWidth)
      left = Math.max(margin, window.innerWidth - mw - margin);
    setPos({ top, left });
  }, [x, y, sheet]);

  // Close on Escape or a pointerdown outside the menu (capture, so it beats other handlers).
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  return (
    <div
      className={sheet ? "mm-menu mm-menu-sheet" : "mm-menu"}
      role="menu"
      aria-label={menuAriaLabel}
      data-mm-menu
      ref={menuRef}
      style={sheet ? undefined : { position: "fixed", top: pos.top, left: pos.left }}
      onKeyDown={(e) => roveMenuKey(e, menuRef, onClose)}
    >
      <MenuCtx.Provider value={{ close: onClose }}>
        {typeof children === "function" ? children(onClose) : children}
      </MenuCtx.Provider>
    </div>
  );
}
