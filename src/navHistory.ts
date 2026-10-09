// Browser-style back/forward history for canvas navigation. A "place" is a map id + the focused
// node id; visiting a new place truncates any forward history (a new branch), and back/forward walk
// an index along the list. Pure + framework-free so it's unit-tested in isolation; App owns one
// instance and applies the returned place (switch map if needed, then focus the node).

export interface NavPoint {
  mapId: string;
  /** The focused topic, or null when the place is just "this map" (nothing selected). */
  nodeId: string | null;
}

/** How many places to remember before dropping the oldest. */
const CAP = 100;

const samePoint = (a: NavPoint | null, b: NavPoint): boolean =>
  !!a && a.mapId === b.mapId && a.nodeId === b.nodeId;

export class NavHistory {
  private stack: NavPoint[] = [];
  /** Index of the current place in `stack`; -1 when empty. */
  private index = -1;

  get canBack(): boolean {
    return this.index > 0;
  }
  get canForward(): boolean {
    return this.index < this.stack.length - 1;
  }
  current(): NavPoint | null {
    return this.stack[this.index] ?? null;
  }
  /** Test/inspection helper: the recorded places, oldest first. */
  get length(): number {
    return this.stack.length;
  }

  // Record arriving at a place. A no-op when it equals the current place (so re-selecting the same
  // node, or a redundant focus, doesn't pile up). Any forward history is discarded — you've branched.
  visit(point: NavPoint): void {
    if (samePoint(this.current(), point)) return;
    this.stack = this.stack.slice(0, this.index + 1);
    this.stack.push(point);
    if (this.stack.length > CAP) this.stack = this.stack.slice(this.stack.length - CAP);
    this.index = this.stack.length - 1;
  }

  /** Step back one place (or null if already at the oldest). */
  back(): NavPoint | null {
    if (!this.canBack) return null;
    this.index -= 1;
    return this.current();
  }

  /** Step forward one place (or null if already at the newest). */
  forward(): NavPoint | null {
    if (!this.canForward) return null;
    this.index += 1;
    return this.current();
  }
}
