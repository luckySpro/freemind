import { describe, expect, it } from "vitest";
import { PresenceRegistry, STALE_MS } from "../src/store/tabCoordination";

// The cross-tab presence registry: who holds a map open, excluding ourselves + stale (closed) tabs.
describe("PresenceRegistry", () => {
  it("reports other tabs holding the same map (excluding self)", () => {
    const reg = new PresenceRegistry();
    reg.note({ mapId: "m1", tabId: "self", ts: 1000 });
    reg.note({ mapId: "m1", tabId: "other", ts: 1000 });
    reg.note({ mapId: "m2", tabId: "elsewhere", ts: 1000 }); // different map
    expect(reg.othersHolding("m1", "self", 1000)).toEqual(["other"]);
    expect(reg.othersHolding("m2", "self", 1000)).toEqual(["elsewhere"]);
  });

  it("ignores stale heartbeats (a closed/crashed tab)", () => {
    const reg = new PresenceRegistry();
    reg.note({ mapId: "m1", tabId: "other", ts: 1000 });
    expect(reg.othersHolding("m1", "self", 1000 + STALE_MS)).toEqual(["other"]); // exactly at the edge
    expect(reg.othersHolding("m1", "self", 1000 + STALE_MS + 1)).toEqual([]); // just past → stale
  });

  it("keeps only the latest heartbeat per (map, tab)", () => {
    const reg = new PresenceRegistry();
    reg.note({ mapId: "m1", tabId: "other", ts: 1000 });
    reg.note({ mapId: "m1", tabId: "other", ts: 9000 }); // refreshed
    expect(reg.othersHolding("m1", "self", 9000)).toEqual(["other"]); // not double-counted, not stale
  });
});
