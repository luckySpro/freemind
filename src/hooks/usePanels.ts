import { useEffect, useState } from "react";
import {
  type CompletionMode,
  type DueMode,
  type FilterCriteria,
  type RelDir,
  type SavedFilter,
  isFilterActive,
} from "../filter";

// Panel + filter UI state for the editor, extracted from App.tsx (behaviour-preserving). Owns:
//   • the eight side-panel open/close toggles (outline / index / info / filter / styles / history /
//     board / numbered) and the "mindmap-panels" persistence of the durable four,
//   • the read-only Power Filter (text / markers / tags / due / priority) and its clear/toggle rules,
//   • the saved Power-Filter presets ("mindmap-saved-filters", add / apply / delete).
// App calls this once and threads the grouped result into <Toolbar> and the panels. Keeping it here
// (a) shrinks App's body and (b) gives the upcoming UX redesign one place to own panel/filter state.

const PANELS_KEY = "mindmap-panels";
const SAVED_FILTERS_KEY = "mindmap-saved-filters";

/** Resizable inspector width bounds (px). Default matches the .mm-inspector CSS width. */
export const INSPECTOR_MIN = 240;
export const INSPECTOR_MAX = 560;
export const INSPECTOR_DEFAULT = 300;
/** Clamp a persisted/dragged width into range (and fall back to the default for junk values). */
export const clampInspectorWidth = (w: number | undefined): number =>
  typeof w === "number" && Number.isFinite(w)
    ? Math.min(INSPECTOR_MAX, Math.max(INSPECTOR_MIN, w))
    : INSPECTOR_DEFAULT;

/** Resizable left-dock width bounds (px). Default matches the .mm-dock CSS width. */
export const DOCK_MIN = 200;
export const DOCK_MAX = 600;
export const DOCK_DEFAULT = 280;
export const clampDockWidth = (w: number | undefined): number =>
  typeof w === "number" && Number.isFinite(w)
    ? Math.min(DOCK_MAX, Math.max(DOCK_MIN, w))
    : DOCK_DEFAULT;

/** The persisted slice of panel state (the durable panels — the rest are session-only). */
interface PersistedPanels {
  outlineOpen?: boolean;
  indexOpen?: boolean;
  infoOpen?: boolean;
  infoMinimized?: boolean;
  inspectorWidth?: number;
  dockWidth?: number;
  /** The dock tab that was active last (so a reload restores it instead of falling back to the last). */
  dockActive?: string | null;
  numbered?: boolean;
  spellcheck?: boolean;
  /** Open the inspector whenever a topic/edge/overlay is selected (the pre-2026-09 default). Absent in
   *  layouts saved before the setting existed — see the infoOpen migration in usePanels. */
  infoAutoOpen?: boolean;
}

function readPersistedPanels(): PersistedPanels {
  try {
    return JSON.parse(localStorage.getItem(PANELS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function readSavedFilters(): SavedFilter[] {
  try {
    return JSON.parse(localStorage.getItem(SAVED_FILTERS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

/** Toggle membership of `value` in `list` (used for the marker/tag multi-selects). */
function toggleIn(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export interface PanelsState {
  outlineOpen: boolean;
  setOutlineOpen: React.Dispatch<React.SetStateAction<boolean>>;
  indexOpen: boolean;
  setIndexOpen: React.Dispatch<React.SetStateAction<boolean>>;
  infoOpen: boolean;
  setInfoOpen: React.Dispatch<React.SetStateAction<boolean>>;
  /** Open the inspector on every selection (Settings; off by default — it opens on request). */
  infoAutoOpen: boolean;
  setInfoAutoOpen: React.Dispatch<React.SetStateAction<boolean>>;
  /** Inspector collapsed to the right-edge strip. Sticky: suppresses auto-open-on-select. */
  infoMinimized: boolean;
  setInfoMinimized: React.Dispatch<React.SetStateAction<boolean>>;
  /** Persisted inspector width (px), clamped to [INSPECTOR_MIN, INSPECTOR_MAX]. */
  inspectorWidth: number;
  setInspectorWidth: React.Dispatch<React.SetStateAction<number>>;
  /** Persisted left-dock width (px), clamped to [DOCK_MIN, DOCK_MAX]. */
  dockWidth: number;
  setDockWidth: React.Dispatch<React.SetStateAction<number>>;
  /** Persisted active dock tab key (restored on reload). */
  dockActive: string | null;
  setDockActive: React.Dispatch<React.SetStateAction<string | null>>;
  filterOpen: boolean;
  /** Toggle the Filter panel; closing it also clears the active filter (see `toggleFilter`). */
  toggleFilter: () => void;
  stylesOpen: boolean;
  setStylesOpen: React.Dispatch<React.SetStateAction<boolean>>;
  relationshipsOpen: boolean;
  setRelationshipsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  historyOpen: boolean;
  setHistoryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  boardOpen: boolean;
  setBoardOpen: React.Dispatch<React.SetStateAction<boolean>>;
  statsOpen: boolean;
  setStatsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  agendaOpen: boolean;
  setAgendaOpen: React.Dispatch<React.SetStateAction<boolean>>;
  mapsOpen: boolean;
  setMapsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  inboxOpen: boolean;
  setInboxOpen: React.Dispatch<React.SetStateAction<boolean>>;
  deckEditorOpen: boolean;
  setDeckEditorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  noteEditorOpen: boolean;
  setNoteEditorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  numbered: boolean;
  setNumbered: React.Dispatch<React.SetStateAction<boolean>>;
  /** Native browser spell-check in the topic + note editors (off by default, persisted). */
  spellcheck: boolean;
  setSpellcheck: React.Dispatch<React.SetStateAction<boolean>>;
}

export interface FilterState {
  text: string;
  setText: React.Dispatch<React.SetStateAction<string>>;
  markers: string[];
  setMarkers: React.Dispatch<React.SetStateAction<string[]>>;
  tags: string[];
  setTags: React.Dispatch<React.SetStateAction<string[]>>;
  due: DueMode;
  setDue: React.Dispatch<React.SetStateAction<DueMode>>;
  priority: number;
  setPriority: React.Dispatch<React.SetStateAction<number>>;
  completion: CompletionMode;
  setCompletion: React.Dispatch<React.SetStateAction<CompletionMode>>;
  /** "Has relationship" direction ("" = off); with relType it drives the relationship filter. */
  relDir: RelDir | "";
  setRelDir: React.Dispatch<React.SetStateAction<RelDir | "">>;
  /** Narrow the relationship filter to a type ("" = any). */
  relType: string;
  setRelType: React.Dispatch<React.SetStateAction<string>>;
  /** "Hide" mode: non-matches are removed from the canvas instead of dimmed. */
  hide: boolean;
  setHide: React.Dispatch<React.SetStateAction<boolean>>;
  /** Reset every Power-Filter field to its empty value (doesn't close the panel). */
  clear: () => void;
  /** Toggle a marker on/off in the marker multi-select. */
  toggleMarker: (marker: string) => void;
  /** Toggle a tag on/off in the tag multi-select. */
  toggleTag: (tag: string) => void;
  /** The live criteria object built from the current fields (a fresh object each call). */
  criteria: FilterCriteria;
}

export interface SavedFiltersState {
  list: SavedFilter[];
  /** Save the current filter under `name` (no-op for a blank name or an inactive filter). */
  save: (name: string) => void;
  /** Load a preset's criteria into the live filter fields. */
  apply: (criteria: FilterCriteria) => void;
  /** Delete the preset with this id. */
  remove: (id: string) => void;
}

export interface UsePanels {
  panels: PanelsState;
  filter: FilterState;
  savedFilters: SavedFiltersState;
}

/** Build the live Power-Filter criteria from the raw fields (priority 0 → undefined, as before). */
function buildCriteria(
  text: string,
  markers: string[],
  tags: string[],
  due: DueMode,
  priority: number,
  completion: CompletionMode,
  relDir: RelDir | "",
  relType: string,
): FilterCriteria {
  return {
    text,
    markers,
    tags,
    due,
    priority: priority || undefined,
    completion: completion || undefined,
    relDir: relDir || undefined,
    relType: (relType as FilterCriteria["relType"]) || undefined,
  };
}

export function usePanels(): UsePanels {
  // Durable panels restore from "mindmap-panels"; the rest start closed each session.
  const persisted = readPersistedPanels();
  const [outlineOpen, setOutlineOpen] = useState(!!persisted.outlineOpen);
  const [indexOpen, setIndexOpen] = useState(!!persisted.indexOpen);
  // The inspector used to auto-open on every selection, so nearly every saved layout says
  // infoOpen:true. A layout saved before infoAutoOpen existed therefore starts with the inspector
  // closed once — otherwise the new open-on-request default would be invisible to existing users.
  const [infoOpen, setInfoOpen] = useState(
    persisted.infoAutoOpen === undefined ? false : !!persisted.infoOpen,
  );
  const [infoAutoOpen, setInfoAutoOpen] = useState(!!persisted.infoAutoOpen);
  const [infoMinimized, setInfoMinimized] = useState(!!persisted.infoMinimized);
  const [inspectorWidth, setInspectorWidth] = useState(() =>
    clampInspectorWidth(persisted.inspectorWidth),
  );
  const [dockWidth, setDockWidth] = useState(() => clampDockWidth(persisted.dockWidth));
  const [dockActive, setDockActive] = useState<string | null>(persisted.dockActive ?? null);
  const [numbered, setNumbered] = useState(!!persisted.numbered);
  const [spellcheck, setSpellcheck] = useState(!!persisted.spellcheck);
  // Read-only Power Filter (session-only — never persisted, so a reload never starts dimmed).
  const [filterOpen, setFilterOpen] = useState(false);
  const [stylesOpen, setStylesOpen] = useState(false);
  const [relationshipsOpen, setRelationshipsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [agendaOpen, setAgendaOpen] = useState(false);
  const [mapsOpen, setMapsOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [deckEditorOpen, setDeckEditorOpen] = useState(false);
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);

  // Persist the open-panel layout (only the durable four) so the workspace restores next time.
  useEffect(() => {
    try {
      localStorage.setItem(
        PANELS_KEY,
        JSON.stringify({
          outlineOpen,
          indexOpen,
          infoOpen,
          infoMinimized,
          inspectorWidth,
          dockWidth,
          dockActive,
          numbered,
          spellcheck,
          infoAutoOpen,
        }),
      );
    } catch {
      // preference is best-effort
    }
  }, [
    outlineOpen,
    indexOpen,
    infoOpen,
    infoMinimized,
    inspectorWidth,
    dockWidth,
    dockActive,
    numbered,
    spellcheck,
    infoAutoOpen,
  ]);

  // --- Power Filter ---
  const [filterText, setFilterText] = useState("");
  const [filterMarkers, setFilterMarkers] = useState<string[]>([]);
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterDue, setFilterDue] = useState<DueMode>("");
  const [filterPriority, setFilterPriority] = useState(0);
  const [filterCompletion, setFilterCompletion] = useState<CompletionMode>("");
  const [filterRelDir, setFilterRelDir] = useState<RelDir | "">("");
  const [filterRelType, setFilterRelType] = useState("");
  const [filterHide, setFilterHide] = useState(false);

  const clearFilter = () => {
    setFilterText("");
    setFilterMarkers([]);
    setFilterTags([]);
    setFilterDue("");
    setFilterPriority(0);
    setFilterCompletion("");
    setFilterRelDir("");
    setFilterRelType("");
    setFilterHide(false);
  };
  // Toggling the panel off also clears the filter, so dimming can't outlive a visible control.
  const toggleFilter = () =>
    setFilterOpen((open) => {
      if (open) clearFilter();
      return !open;
    });

  // --- Saved Power-Filter presets (persisted app-wide, reusable across maps) ---
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(readSavedFilters);
  useEffect(() => {
    try {
      localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(savedFilters));
    } catch {
      // preference is best-effort
    }
  }, [savedFilters]);

  const saveCurrentFilter = (name: string) => {
    const criteria = buildCriteria(
      filterText,
      filterMarkers,
      filterTags,
      filterDue,
      filterPriority,
      filterCompletion,
      filterRelDir,
      filterRelType,
    );
    if (!name.trim() || !isFilterActive(criteria)) return;
    // Replace any existing preset with the same name, then add.
    setSavedFilters((prev) => [
      ...prev.filter((f) => f.name !== name.trim()),
      { id: crypto.randomUUID(), name: name.trim(), criteria },
    ]);
  };
  const applySavedFilter = (criteria: FilterCriteria) => {
    setFilterText(criteria.text);
    setFilterMarkers([...criteria.markers]);
    setFilterTags([...criteria.tags]);
    setFilterDue(criteria.due ?? "");
    setFilterPriority(criteria.priority ?? 0);
    setFilterCompletion(criteria.completion ?? "");
    setFilterRelDir(criteria.relDir ?? "");
    setFilterRelType(criteria.relType ?? "");
  };
  const deleteSavedFilter = (id: string) =>
    setSavedFilters((prev) => prev.filter((f) => f.id !== id));

  return {
    panels: {
      outlineOpen,
      setOutlineOpen,
      indexOpen,
      setIndexOpen,
      infoOpen,
      setInfoOpen,
      infoAutoOpen,
      setInfoAutoOpen,
      infoMinimized,
      setInfoMinimized,
      inspectorWidth,
      setInspectorWidth,
      dockWidth,
      setDockWidth,
      dockActive,
      setDockActive,
      filterOpen,
      toggleFilter,
      stylesOpen,
      setStylesOpen,
      relationshipsOpen,
      setRelationshipsOpen,
      historyOpen,
      setHistoryOpen,
      boardOpen,
      setBoardOpen,
      statsOpen,
      setStatsOpen,
      agendaOpen,
      setAgendaOpen,
      mapsOpen,
      setMapsOpen,
      inboxOpen,
      setInboxOpen,
      deckEditorOpen,
      setDeckEditorOpen,
      noteEditorOpen,
      setNoteEditorOpen,
      numbered,
      setNumbered,
      spellcheck,
      setSpellcheck,
    },
    filter: {
      text: filterText,
      setText: setFilterText,
      markers: filterMarkers,
      setMarkers: setFilterMarkers,
      tags: filterTags,
      setTags: setFilterTags,
      due: filterDue,
      setDue: setFilterDue,
      priority: filterPriority,
      setPriority: setFilterPriority,
      completion: filterCompletion,
      setCompletion: setFilterCompletion,
      relDir: filterRelDir,
      setRelDir: setFilterRelDir,
      relType: filterRelType,
      setRelType: setFilterRelType,
      hide: filterHide,
      setHide: setFilterHide,
      clear: clearFilter,
      toggleMarker: (marker) => setFilterMarkers((list) => toggleIn(list, marker)),
      toggleTag: (tag) => setFilterTags((list) => toggleIn(list, tag)),
      criteria: buildCriteria(
        filterText,
        filterMarkers,
        filterTags,
        filterDue,
        filterPriority,
        filterCompletion,
        filterRelDir,
        filterRelType,
      ),
    },
    savedFilters: {
      list: savedFilters,
      save: saveCurrentFilter,
      apply: applySavedFilter,
      remove: deleteSavedFilter,
    },
  };
}
