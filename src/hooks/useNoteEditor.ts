import { type RefObject, useRef, useState } from "react";
import type { MindMapHandle } from "../mindmap";

// The note-editing surface: a debounced draft committed to the selected node via the canvas handle,
// plus a "switch to the Notes tab" nonce bumped when a node's 📝 indicator is clicked. Lifted out of
// App so the shell isn't carrying the debounce + draft plumbing inline.
//
// The draft is intentionally controlled from outside on selection change: App's selection handler calls
// `setNoteDraft(node.note)` when the *selected node changes* (a note commit re-fires selection for the
// same node, which must not clobber in-progress typing) — so this hook exposes `setNoteDraft`.

export function useNoteEditor(mapRef: RefObject<MindMapHandle | null>) {
  // Bumped when a node's 📝 indicator is clicked → the InfoPanel switches to its Notes tab.
  const [noteNonce, setNoteNonce] = useState(0);
  const [noteDraft, setNoteDraft] = useState("");
  const noteCommit = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce the model write so typing doesn't commit per keystroke.
  const onNoteChange = (value: string) => {
    setNoteDraft(value);
    if (noteCommit.current) clearTimeout(noteCommit.current);
    noteCommit.current = setTimeout(() => mapRef.current?.setSelectedNote(value), 400);
  };

  // Commit immediately (on blur) — cancel any pending debounce so it can't fire a stale value after.
  const flushNote = () => {
    if (noteCommit.current) clearTimeout(noteCommit.current);
    mapRef.current?.setSelectedNote(noteDraft);
  };

  const bumpNoteNonce = () => setNoteNonce((n) => n + 1);

  return { noteNonce, noteDraft, setNoteDraft, onNoteChange, flushNote, bumpNoteNonce };
}
