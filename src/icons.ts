import { t } from "./i18n";
// Marker palette shown in the UI; emoji render as node markers on the canvas.
export const MARKER_PALETTE = [
  "✅",
  "❗",
  "❓",
  "⭐",
  "🚩",
  "📌",
  "🔴",
  "🟡",
  "🟢",
  "⏳",
  "💡",
  "🎯",
  "👤",
  "📅",
  "🔥",
];

// The full, searchable marker library (a superset of MARKER_PALETTE). Each entry carries a name +
// keywords so the inspector's marker search can match by meaning ("done" → ✅, "warning" → ⚠️), not
// just the glyph. MARKER_PALETTE stays the curated default shown when no search is active; this catalog
// is what the search box filters over. Additive: markers without a flat vector (MARKER_BODY) fall back
// to their literal emoji on the canvas, same as any imported glyph.
export interface MarkerInfo {
  icon: string;
  name: string;
  keywords: readonly string[];
}

export const MARKER_CATALOG: readonly MarkerInfo[] = [
  { icon: "✅", name: "Check", keywords: ["done", "complete", "ok", "yes", "tick", "approved"] },
  { icon: "❗", name: "Important", keywords: ["urgent", "alert", "exclamation", "attention"] },
  { icon: "❓", name: "Question", keywords: ["help", "unknown", "ask", "unsure"] },
  { icon: "⭐", name: "Star", keywords: ["favorite", "favourite", "highlight", "best"] },
  { icon: "🚩", name: "Flag", keywords: ["mark", "milestone", "review"] },
  { icon: "📌", name: "Pin", keywords: ["pinned", "fixed", "location", "note"] },
  { icon: "🔴", name: "Red", keywords: ["status", "stop", "blocked", "high", "dot"] },
  { icon: "🟡", name: "Yellow", keywords: ["status", "caution", "medium", "wip", "dot"] },
  { icon: "🟢", name: "Green", keywords: ["status", "go", "ok", "low", "ready", "dot"] },
  { icon: "🔵", name: "Blue", keywords: ["status", "info", "dot"] },
  { icon: "🟠", name: "Orange", keywords: ["status", "warning", "dot"] },
  { icon: "🟣", name: "Purple", keywords: ["status", "dot"] },
  { icon: "⏳", name: "Pending", keywords: ["wait", "later", "time", "hourglass", "progress"] },
  { icon: "💡", name: "Idea", keywords: ["insight", "lightbulb", "suggestion", "tip"] },
  { icon: "🎯", name: "Target", keywords: ["goal", "objective", "focus", "aim"] },
  { icon: "❌", name: "Cross", keywords: ["no", "wrong", "cancel", "remove", "reject", "fail"] },
  { icon: "⚠️", name: "Warning", keywords: ["caution", "risk", "danger", "attention"] },
  { icon: "🔥", name: "Hot", keywords: ["urgent", "priority", "trending", "critical"] },
  { icon: "🏁", name: "Finish", keywords: ["done", "goal", "milestone", "end", "complete"] },
  { icon: "📅", name: "Calendar", keywords: ["date", "schedule", "deadline", "due", "time"] },
  { icon: "🔒", name: "Locked", keywords: ["secure", "private", "fixed", "protected"] },
  { icon: "🔑", name: "Key", keywords: ["access", "important", "secret", "critical"] },
  { icon: "💰", name: "Money", keywords: ["cost", "budget", "price", "revenue", "finance"] },
  { icon: "📞", name: "Call", keywords: ["phone", "contact", "follow up", "meeting"] },
  { icon: "✏️", name: "Edit", keywords: ["draft", "wip", "change", "revise", "todo"] },
  { icon: "📊", name: "Chart", keywords: ["data", "report", "metrics", "analysis", "stats"] },
  { icon: "👍", name: "Thumbs up", keywords: ["yes", "approve", "good", "like", "agree"] },
  { icon: "👎", name: "Thumbs down", keywords: ["no", "reject", "bad", "dislike", "disagree"] },
  { icon: "👤", name: "Person", keywords: ["owner", "assignee", "who", "user", "contact"] },
  { icon: "👥", name: "Team", keywords: ["people", "group", "stakeholders", "resources"] },
  { icon: "🏆", name: "Trophy", keywords: ["win", "award", "success", "achievement", "best"] },
  { icon: "⏰", name: "Reminder", keywords: ["alarm", "due", "deadline", "time", "alert"] },
  { icon: "🔗", name: "Link", keywords: ["url", "reference", "related", "connection"] },
  { icon: "📎", name: "Attachment", keywords: ["file", "attach", "clip", "document"] },
  { icon: "📁", name: "Folder", keywords: ["category", "group", "files", "project"] },
  { icon: "📝", name: "Note", keywords: ["memo", "write", "detail", "comment", "todo"] },
  { icon: "✉️", name: "Email", keywords: ["mail", "message", "contact", "send", "follow up"] },
  { icon: "🐞", name: "Bug", keywords: ["defect", "issue", "error", "fix", "problem"] },
  { icon: "🚀", name: "Launch", keywords: ["ship", "release", "go live", "start", "rocket"] },
  { icon: "⚙️", name: "Settings", keywords: ["config", "gear", "process", "system", "build"] },
  { icon: "⛔", name: "Blocked", keywords: ["stop", "blocker", "no entry", "halt", "risk"] },
  { icon: "🆕", name: "New", keywords: ["fresh", "added", "recent", "latest"] },
  { icon: "💬", name: "Comment", keywords: ["discuss", "feedback", "note", "chat", "question"] },
  { icon: "🏷️", name: "Tag", keywords: ["label", "category", "classify", "marker"] },
  { icon: "📈", name: "Trend up", keywords: ["growth", "increase", "metrics", "improve", "chart"] },
  { icon: "📉", name: "Trend down", keywords: ["decline", "decrease", "drop", "loss", "chart"] },
];

/** Markers matching a free-text query (name / keyword / glyph, case-insensitive, all tokens must hit).
 *  An empty query returns the whole catalog. Pure + deterministic — the inspector renders the result. */
export function searchMarkers(query: string): string[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return MARKER_CATALOG.map((m) => m.icon);
  return MARKER_CATALOG.filter((m) => {
    const hay = `${m.name} ${m.keywords.join(" ")} ${m.icon}`.toLowerCase();
    return tokens.every((t) => hay.includes(t));
  }).map((m) => m.icon);
}

// ── Marker groups (single-select sets) ──────────────────────────────────────────────────────────
// MindManager's Map Markers are grouped: a topic carries at most one marker from a group (one
// Priority, one Status, …), so picking another in the same group replaces it. Markers not in any
// group stay free multi-toggles. Pure data + helpers; the toggle op applies the semantics.
export interface MarkerGroup {
  id: string;
  name: string;
  members: readonly string[];
}

export const MARKER_GROUPS: readonly MarkerGroup[] = [
  // `name` is a getter: these are rendered as picker headings, and a plain t() at module scope
  // freezes at import. `id` is what everything else keys on, and stays a literal.
  {
    id: "priority",
    get name() {
      return t("common.priority");
    },
    members: ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"],
  },
  {
    id: "status",
    get name() {
      return t("common.status");
    },
    members: ["🔴", "🟡", "🟢", "🔵", "🟠", "🟣"],
  },
  {
    id: "mood",
    get name() {
      return t("common.mood");
    },
    members: ["🙂", "😐", "🙁"],
  },
  {
    id: "vote",
    get name() {
      return t("common.vote");
    },
    members: ["👍", "👎"],
  },
];

const GROUP_OF = new Map<string, string>();
for (const g of MARKER_GROUPS) for (const m of g.members) GROUP_OF.set(m, g.id);

/** The single-select group id a marker belongs to, or null when it's a free (multi-toggle) marker. */
export function markerGroupOf(marker: string): string | null {
  return GROUP_OF.get(marker) ?? null;
}

const NAME_OF = new Map(MARKER_CATALOG.map((m) => [m.icon, m.name]));

/** The human name for a marker (from the catalogue), or null for an unknown/imported glyph. */
export function markerName(marker: string): string | null {
  return NAME_OF.get(marker) ?? null;
}

/** Toggle a marker in an icons list with group semantics: toggling a present marker removes it;
 *  toggling a new one adds it AND drops any other member of its single-select group (so a topic keeps
 *  at most one Priority / Status / Mood / Vote marker). Free markers just toggle. Pure. */
export function toggleMarkerInList(icons: readonly string[], marker: string): string[] {
  if (icons.includes(marker)) return icons.filter((m) => m !== marker);
  const group = markerGroupOf(marker);
  const kept = group ? icons.filter((m) => markerGroupOf(m) !== group) : [...icons];
  return [...kept, marker];
}

// Map common MindManager stock-icon names (urn:mindjet:<Name>) to emoji so
// imported icons render as glyphs instead of literal text. Unknown names are
// kept as-is so no information is lost. Matched case-insensitively.
const MM_ICON_MAP: Record<string, string> = {
  priority1: "1️⃣",
  priority2: "2️⃣",
  priority3: "3️⃣",
  priority4: "4️⃣",
  priority5: "5️⃣",
  priority6: "6️⃣",
  priority7: "7️⃣",
  priority8: "8️⃣",
  priority9: "9️⃣",
  thumbsup: "👍",
  thumbsdown: "👎",
  flag: "🚩",
  flagred: "🚩",
  flaggreen: "🚩",
  flagblue: "🚩",
  flagorange: "🚩",
  flagpurple: "🚩",
  smileyhappy: "🙂",
  smileyneutral: "😐",
  smileysad: "🙁",
  check: "✅",
  tick: "✅",
  taskcomplete: "✅",
  yes: "✅",
  cross: "❌",
  no: "❌",
  cancel: "❌",
  star: "⭐",
  important: "❗",
  exclamation: "❗",
  question: "❓",
  help: "❓",
  idea: "💡",
  arrowup: "⬆️",
  arrowdown: "⬇️",
  arrowleft: "⬅️",
  arrowright: "➡️",
};

export function mindManagerIconToEmoji(name: string): string {
  return MM_ICON_MAP[name.trim().toLowerCase()] ?? name;
}

// Curated inverse for the `.mmap` writer: emoji -> a single canonical MindManager IconType (PascalCase,
// as MindManager emits `urn:mindjet:<Name>`). MM_ICON_MAP is many-to-one (🚩 has 6 source names, ✅ has
// 4), so the inverse must pick one canonical name per emoji — a colour-flag variant collapses to `Flag`,
// etc. Emoji with no MindManager stock-icon equivalent (📌 🔴 🟡 🟢 ⏳ 🎯) are intentionally absent and
// skipped by the writer rather than emitted as junk IconTypes. Round-trips via mindManagerIconToEmoji.
const EMOJI_TO_MM: Record<string, string> = {
  "1️⃣": "Priority1",
  "2️⃣": "Priority2",
  "3️⃣": "Priority3",
  "4️⃣": "Priority4",
  "5️⃣": "Priority5",
  "6️⃣": "Priority6",
  "7️⃣": "Priority7",
  "8️⃣": "Priority8",
  "9️⃣": "Priority9",
  "👍": "ThumbsUp",
  "👎": "ThumbsDown",
  "🚩": "Flag",
  "🙂": "SmileyHappy",
  "😐": "SmileyNeutral",
  "🙁": "SmileySad",
  "✅": "Check",
  "❌": "Cross",
  "⭐": "Star",
  "❗": "Important",
  "❓": "Question",
  "💡": "Idea",
  "⬆️": "ArrowUp",
  "⬇️": "ArrowDown",
  "⬅️": "ArrowLeft",
  "➡️": "ArrowRight",
};

/** A canonical MindManager IconType for an emoji marker, or null when MindManager has no equivalent
 *  (the `.mmap` writer then omits it). Pure + deterministic. */
export function emojiToMindManagerIcon(emoji: string): string | null {
  return EMOJI_TO_MM[emoji.trim()] ?? null;
}

// ── Flat vector marker icons ──────────────────────────────────────────────────────────────────────
// A flat, single-family icon set replacing the OS colour emoji — crisp at node size and IDENTICAL on
// every machine and in every export (emoji render differently per platform + rasterizer). Keyed by the
// SAME palette characters stored on nodes, so existing maps render unchanged; an unknown marker (an
// imported glyph not in the set) falls back to its literal character. Authored on a 0 0 16 16 viewBox
// and emitted as a `data:image/svg+xml` URL, so each flows through the proven node-image / sticker
// pipeline (canvas `<img>`, export `<image>`) — no new render path, and canvas == export.
const sq = (fill: string): string =>
  `<rect x="1" y="1" width="14" height="14" rx="3.5" fill="${fill}"/>`;
const dot = (fill: string): string => `<circle cx="8" cy="8" r="5.4" fill="${fill}"/>`;

const MARKER_BODY: Record<string, string> = {
  "✅": `${sq("#2e9e5b")}<path d="M4.4 8.3l2.2 2.2 4.9-5.1" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  "❗": `${sq("#e23b3b")}<rect x="7" y="3.4" width="2" height="5.7" rx="1" fill="#fff"/><circle cx="8" cy="11.9" r="1.15" fill="#fff"/>`,
  "❓": `${sq("#3b8bd4")}<text x="8" y="12.3" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="700" fill="#fff">?</text>`,
  "⭐": `<path d="M8 1.6L9.5 5.94 14.09 6.02 10.42 8.79 11.76 13.18 8 10.55 4.24 13.18 5.58 8.79 1.91 6.02 6.5 5.94Z" fill="#f4b400"/>`,
  "🚩": `<rect x="3.4" y="2" width="1.5" height="12" rx="0.7" fill="#7a5230"/><path d="M4.9 2.6h7.4l-2 2.5 2 2.5H4.9z" fill="#e23b3b"/>`,
  "📌": `<circle cx="8" cy="6" r="3.6" fill="#e0683b"/><circle cx="8" cy="6" r="1.4" fill="#fff" opacity="0.5"/><rect x="7.3" y="8.8" width="1.4" height="5.2" rx="0.7" fill="#9a4a28"/>`,
  "🔴": dot("#e23b3b"),
  "🟡": dot("#f4b400"),
  "🟢": dot("#2e9e5b"),
  "🔵": dot("#3b8bd4"),
  "🟠": dot("#e0832e"),
  "🟣": dot("#9b5cc4"),
  "❌": `<path d="M4.4 4.4l7.2 7.2M11.6 4.4l-7.2 7.2" fill="none" stroke="#e23b3b" stroke-width="2.2" stroke-linecap="round"/>`,
  "⚠️": `<path d="M8 2.2l6.2 11H1.8z" fill="#f4b400" stroke="#caa400" stroke-width="0.6" stroke-linejoin="round"/><rect x="7.1" y="6" width="1.8" height="4" rx="0.9" fill="#3a2e00"/><circle cx="8" cy="11.4" r="1.05" fill="#3a2e00"/>`,
  "⏳": `<path d="M4 3.2h8M4 12.8h8" stroke="#9a6b2f" stroke-width="1.5" stroke-linecap="round"/><path d="M5 3.6h6L8 8z" fill="#e0a72e"/><path d="M5 12.4h6L8 8z" fill="#e0a72e"/>`,
  "💡": `<circle cx="8" cy="6.5" r="4" fill="#f4c430"/><rect x="6.2" y="10" width="3.6" height="3.4" rx="1" fill="#9a8a5a"/><rect x="6.6" y="11.4" width="2.8" height="0.8" fill="#fff" opacity="0.55"/>`,
  "🎯": `<circle cx="8" cy="8" r="6" fill="#e23b3b"/><circle cx="8" cy="8" r="3.9" fill="#fff"/><circle cx="8" cy="8" r="1.8" fill="#e23b3b"/>`,
  "👤": `<circle cx="8" cy="5.4" r="2.7" fill="#5a7fa6"/><path d="M2.8 13.6c0-2.9 2.3-4.6 5.2-4.6s5.2 1.7 5.2 4.6z" fill="#5a7fa6"/>`,
  "📅": `<rect x="2.3" y="3.4" width="11.4" height="10.3" rx="1.3" fill="#fff" stroke="#c44" stroke-width="1.1"/><rect x="2.3" y="3.4" width="11.4" height="3.1" rx="1.3" fill="#e23b3b"/><rect x="4.7" y="1.8" width="1.3" height="2.6" rx="0.6" fill="#9a3030"/><rect x="10" y="1.8" width="1.3" height="2.6" rx="0.6" fill="#9a3030"/>`,
  "🔥": `<path d="M8 1.8c2.4 2.6 1 4.4 1.9 6 .7-.5.9-1.6.9-1.6 1.7 1.9 1.9 3.6 1.9 4.7A4.7 4.7 0 0 1 3.3 11c0-1.7 1-3.4 2.2-4.4-.2 1.3.5 2 .5 2C5.6 5.9 6.4 3.6 8 1.8z" fill="#e0682e"/>`,
};

/** The flat vector icon for a marker as a `data:` URL, or null if it has no vector (→ render the
 *  literal character). Pure + deterministic. */
export function markerImage(icon: string): string | null {
  const body = MARKER_BODY[icon];
  if (!body) return null;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">${body}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
