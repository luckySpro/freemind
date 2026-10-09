import type { MapNode } from "../model/types";

// A cross-map branch clipboard, backed by localStorage so copied branches survive switching maps
// (and a reload). That persistence is what makes "copy here, paste in another map" work — and lets
// you assemble a roll-up by pasting branches from several library maps into one. Holds one OR MORE
// subtrees (a multi-selection copies them all); each copy overwrites the previous one.

const KEY = "mindmap-branch-clipboard";

// Minimal shape guard: a node has a string id + topic and a children array.
function isNode(n: unknown): n is MapNode {
  return (
    !!n &&
    typeof (n as MapNode).id === "string" &&
    typeof (n as MapNode).topic === "string" &&
    Array.isArray((n as MapNode).children)
  );
}

/** Store one or more copied subtrees (overwriting any previous copy). Best-effort. */
export function setBranches(nodes: MapNode[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(nodes));
  } catch {
    // storage full or unavailable (e.g. private mode) — copy is best-effort
  }
}

/** Store a single copied subtree (overwriting any previous copy). */
export function setBranch(node: MapNode): void {
  setBranches([node]);
}

/** Empty the branch clipboard (the Settings "clear branch clipboard" action). */
export function clearBranch(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // best-effort
  }
}

/** Read the copied subtrees (empty when the clipboard is empty / unreadable). Back-compatible with the
 *  old single-node format (an object rather than an array). */
export function getBranches(): MapNode[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : [parsed]; // back-compat: old single-node payloads
    return arr.filter(isNode);
  } catch {
    return [];
  }
}

/** Read the first copied subtree, or null if the clipboard is empty / unreadable / malformed. */
export function getBranch(): MapNode | null {
  return getBranches()[0] ?? null;
}
