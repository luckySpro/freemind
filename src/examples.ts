// The example map INDEX — id and display name only, and nothing else.
//
// This module is imported by the eager toolbar, so anything it references ships on first load. It
// deliberately does NOT hold the builders: the array used to carry `build:` function references,
// which pulled every example body into the entry chunk (measured 6.7 kB gz). The bodies, the one-line
// descriptions and `buildExample` all live in `./exampleBuilders`, which loads on demand.
//
// Keep it that way: importing exampleBuilders from here, or from any eager module, silently undoes it.
// `test/bundle-locality` in test/i18n.test.ts is not what guards this — scripts/size-budget.mjs is.

export interface MapExample {
  id: string;
  name: string;
}

// Order roughly: work, then strategy/learning, then personal, then meta.
export const examples: MapExample[] = [
  { id: "launch", name: "Product launch plan" },
  { id: "meeting", name: "Meeting notes (filled)" },
  { id: "decision", name: "Decision log" },
  { id: "okrs", name: "Quarterly OKRs" },
  { id: "retro", name: "Team retrospective" },
  { id: "swot", name: "SWOT (worked)" },
  { id: "flowchart", name: "Flowchart (shapes + flow)" },
  { id: "concept", name: "Concept map (linked ideas)" },
  { id: "whiteboard", name: "Whiteboard (free layout)" },
  { id: "onion", name: "Onion diagram (rings)" },
  { id: "funnel", name: "Funnel diagram (stages)" },
  { id: "venn", name: "Venn diagram (3 circles)" },
  { id: "runbook", name: "Incident runbook" },
  { id: "gtd", name: "GTD natural planning" },
  { id: "gtd-areas", name: "GTD Areas of Focus" },
  { id: "outline", name: "Talk / content outline" },
  { id: "pkm", name: "Personal knowledge map" },
  { id: "study", name: "Study / revision map" },
  { id: "trip", name: "Trip plan (with image)" },
  { id: "atlas", name: "Cross-map atlas" },
];
