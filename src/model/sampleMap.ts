import type { MapNode, MindMapDoc } from "./types";

const leaf = (id: string, topic: string, extra: Partial<MapNode> = {}): MapNode => ({
  id,
  topic,
  children: [],
  ...extra,
});

// A relatable retail sample that also shows off the tool: notes, markers, a
// relationship arrow, and a boundary. New users see these features in action.
export const sampleDoc: MindMapDoc = {
  schemaVersion: 1,
  id: "sample",
  title: "Q3 Retail Plan",
  root: {
    id: "root",
    topic: "Q3 Retail Plan",
    note: "Welcome! Select a topic, then use 📝 for notes or 🏷 for markers in the toolbar.",
    children: [
      {
        id: "merch",
        topic: "Merchandising",
        icons: ["⭐"],
        children: [
          leaf("m1", "Autumn drop", { note: "Launch week 36." }),
          leaf("m2", "Markdown cadence", { icons: ["⏳"] }),
          leaf("m3", "Range width −8%"),
        ],
      },
      {
        id: "ecom",
        topic: "E-commerce",
        children: [
          leaf("e1", "PDP redesign", { icons: ["🎯"] }),
          leaf("e2", "Checkout A/B"),
          leaf("e3", "App push"),
        ],
      },
      {
        id: "stores",
        topic: "Stores",
        children: [leaf("s1", "Nordics refit", { icons: ["🚩"] }), leaf("s2", "Staff training")],
      },
      {
        id: "supply",
        topic: "Supply Chain",
        children: [
          leaf("sc1", "Lead-time −2wk"),
          leaf("sc2", "DC automation", { note: "Capex approved." }),
        ],
      },
      {
        id: "people",
        topic: "People",
        children: [leaf("p1", "Seasonal hiring", { icons: ["❗"] }), leaf("p2", "Retention plan")],
      },
    ],
  },
  links: [{ id: "rel1", from: "e1", to: "s1", label: "omni-channel" }],
  boundaries: [{ id: "bd1", nodeIds: ["ecom", "e1", "e2", "e3"], label: "Digital" }],
  meta: { source: "sample" },
};
