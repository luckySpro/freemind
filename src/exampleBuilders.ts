// The example map BODIES — deliberately in their own module so they stay OUT of the entry chunk.
//
// Toolbar's "+ New…" dropdown needs only the example NAMES, but importing the array that held
// `build:` function references dragged every builder into the eager bundle: measured at 6.7 kB gz,
// carried on first load by every user whether or not they ever open an example.
//
// `src/examples.ts` now holds the name index and is the only thing eager code imports. Anything that
// actually BUILDS a map reaches this module — statically from the (lazy) Start screen, dynamically
// from the (eager) toolbar.
// THIS COPY STAYS ENGLISH (owner decision, 2026-07-26) — but it must stay TRUE when the chrome around
// it is translated, which is a separate obligation and the reason for the rule below.
//
// Do not quote a chrome LABEL in a note. "Open the Outline panel" names a control that will not be
// called that in a Danish UI, so the sentence stops being untranslated and starts being WRONG — and
// wrong in example content reads as the app lying to a new user, not as a missing translation.
//
// Describe the action, and keep the GLYPH as the finding aid: 🔗, 🧲, 📝, 🏷 and ↓ are not translated,
// so they still point at the right control in every locale. "Use 🔗 to point this topic at your
// Strategy map" survives; "🔗 Link" does not.
//
// Gestures ("drag", "double-click") and generic nouns ("topic", "layout") are fine — they describe
// what the user does, not what the button is called. Deliberately NOT reworded: "switch the layout to
// right-only" (describes the result; the label is "Right") and the four "Link me to your … map" topic
// texts (ordinary verb, not a quoted label).
import type { MapNode, MindMapDoc } from "./model/types";

// Pre-built example maps for the "Examples" group in the New menu. Unlike the
// (empty) templates, these are complete, concrete maps that show the tool off
// across domains and features — somewhere for a new user to land and explore.
// Each is plain canonical-model data, so they cost ~nothing at runtime and
// round-trip like any other map. Markers are emoji strings (see sampleMap.ts).

const leaf = (id: string, topic: string, extra: Partial<MapNode> = {}): MapNode => ({
  id,
  topic,
  children: [],
  ...extra,
});

const node = (
  id: string,
  topic: string,
  children: MapNode[],
  extra: Partial<MapNode> = {},
): MapNode => ({ id, topic, children, ...extra });

function doc(title: string, root: MapNode, extra: Partial<MindMapDoc> = {}): MindMapDoc {
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    title,
    root,
    meta: { source: "example" },
    ...extra,
  };
}

// A tiny Japan-flag PNG (42×28, ~190 bytes) for the trip example's root node —
// the one image in the gallery, kept small on purpose.
const JAPAN_FLAG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACoAAAAcCAIAAACYgrq8AAAAhUlEQVR42u3VwQ2AIAwF0EKYpAO4hHO7hPd2Fb14MCiG/qA92N4wkVcw/SYRIb8qRMTMLraqZnKt4P/LF/jNJU3n5byt352+sm+fvMW3JKCDPMrGOsgDbaCDmPvg+6onW0z5Yz798+7W7EMuv2UAuQt++6uEZT7+y8G8GLzggz8GT1W9+B1aZSWF2iNgtgAAAABJRU5ErkJggg==";

// 1 — Product launch plan: boundaries (go-live), relationships (dependencies), status markers.
const launch = (): MindMapDoc =>
  doc(
    "Launch: Acme App v2",
    node(
      "root",
      "Launch: Acme App v2",
      [
        node("prod", "Product", [
          leaf("p1", "Feature freeze", { icons: ["✅"] }),
          leaf("p2", "Public beta", {
            icons: ["⏳"],
            note: "2-week beta with 50 design partners.",
          }),
          leaf("p3", "Bug bash"),
        ]),
        node("mkt", "Marketing", [
          leaf("k1", "Landing page"),
          leaf("k2", "Launch email"),
          leaf("k3", "Press kit"),
        ]),
        node("sal", "Sales", [
          leaf("a1", "Enablement deck"),
          leaf("a2", "Pricing page", { icons: ["🎯"] }),
        ]),
        node("sup", "Support", [
          leaf("u1", "Help docs"),
          leaf("u2", "Incident drill", { icons: ["⏳"] }),
        ]),
        node("week", "Go-live week", [
          leaf("w1", "T-7 announce"),
          leaf("w2", "T-0 ship it", { icons: ["❗"] }),
          leaf("w3", "T+7 retro"),
        ]),
      ],
      { note: "Cross-functional launch. Markers: ✅ done · ⏳ in progress · 🚩 risk · 🎯 goal." },
    ),
    {
      boundaries: [{ id: "b1", nodeIds: ["week", "w1", "w2", "w3"], label: "Launch window" }],
      links: [
        { id: "r1", from: "p2", to: "u2", label: "readiness" },
        { id: "r2", from: "a2", to: "k2", label: "GTM" },
      ],
    },
  );

// 2 — Meeting notes (filled): action markers, a parking-lot floating topic, notes.
const meeting = (): MindMapDoc =>
  doc(
    "Sprint planning — Mar 14",
    node(
      "root",
      "Sprint planning — Mar 14",
      [
        node("ag", "Agenda", [
          leaf("ag1", "Review last sprint"),
          leaf("ag2", "Capacity check"),
          leaf("ag3", "Commit"),
        ]),
        node("dec", "Decisions", [
          leaf("d1", "Cut search scope this sprint", { icons: ["✅"] }),
          leaf("d2", "Defer dark mode to next"),
        ]),
        node("act", "Action items", [
          leaf("c1", "Spike on caching — Sam", { icons: ["⏳"] }),
          leaf("c2", "Update the board — Lee"),
        ]),
        node("risk", "Risks", [leaf("rk1", "Two people on holiday", { icons: ["🚩"] })]),
      ],
      { note: "Attendees: whole team. 60 min, timeboxed." },
    ),
    {
      floatingTopics: [
        node("pl", "Parking lot", [
          leaf("pl1", "Revisit notifications design"),
          leaf("pl2", "Tech-debt week in Q3?"),
        ]),
      ],
    },
  );

// 3 — Decision log: rationale notes, a relationship, status markers.
const decision = (): MindMapDoc =>
  doc(
    "Decision: choose a CI provider",
    node(
      "root",
      "Decision: choose a CI provider",
      [
        node("ctx", "Context", [
          leaf("x1", "Current CI is slow and flaky", {
            note: "~25 min builds, ~1 in 5 fails for no reason.",
          }),
        ]),
        node("opt", "Options", [
          leaf("o1", "GitHub Actions", { icons: ["✅"] }),
          leaf("o2", "CircleCI"),
          leaf("o3", "Self-hosted runners"),
        ]),
        node("crit", "Criteria", [
          leaf("cr1", "Speed", { icons: ["🎯"] }),
          leaf("cr2", "Cost"),
          leaf("cr3", "Maintenance"),
        ]),
        node("dec", "Decision", [
          leaf("dc1", "GitHub Actions", {
            note: "Cheapest at our scale, no infra to babysit, good caching. Revisit if minutes blow up.",
          }),
        ]),
      ],
      { note: "Status: decided · Owner: Alex · Date: Mar 2026." },
    ),
    { links: [{ id: "r1", from: "cr3", to: "o1", label: "wins on" }] },
  );

// 4 — Quarterly OKRs: hierarchy, on-track / at-risk markers, per-objective styling.
const okrs = (): MindMapDoc =>
  doc(
    "Q3 OKRs — Growth team",
    node("root", "Q3 OKRs — Growth team", [
      node(
        "o1",
        "Grow activation",
        [
          leaf("k11", "Signup→active 30% → 45%", { icons: ["⏳"] }),
          leaf("k12", "Onboarding NPS > 40", { icons: ["✅"] }),
          leaf("k13", "Ship new welcome flow"),
        ],
        { icons: ["🎯"], style: { fontWeight: "700", background: "#eef" } },
      ),
      node(
        "o2",
        "Reduce churn",
        [
          leaf("k21", "Monthly churn 5% → 3.5%", { icons: ["🚩"], note: "At risk — behind plan." }),
          leaf("k22", "Win-back campaign live", { icons: ["⏳"] }),
        ],
        { icons: ["🎯"], style: { fontWeight: "700", background: "#eef" } },
      ),
    ]),
  );

// 5 — Team retrospective: fixed frame, vote markers, a relationship (action addresses a problem).
const retro = (): MindMapDoc =>
  doc(
    "Sprint 23 retro",
    node("root", "Sprint 23 retro", [
      node("start", "Start", [leaf("st1", "Pairing on the hard tickets", { icons: ["⭐"] })]),
      node("stop", "Stop", [leaf("sp1", "Scope changes mid-sprint", { icons: ["🚩"] })]),
      node("cont", "Continue", [leaf("co1", "Async daily standup", { icons: ["⭐"] })]),
      node("act", "Actions", [leaf("ac1", "Freeze scope after day 2", { icons: ["✅"] })]),
    ]),
    { links: [{ id: "r1", from: "sp1", to: "ac1", label: "addresses" }] },
  );

// 6 — SWOT worked: the analysis lives in the cross-quadrant relationships, not the lists.
const swot = (): MindMapDoc =>
  doc(
    "SWOT: launch a paid tier",
    node(
      "root",
      "SWOT: launch a paid tier",
      [
        node("s", "Strengths", [leaf("s1", "Loyal free users"), leaf("s2", "Low infra cost")]),
        node("w", "Weaknesses", [
          leaf("w1", "No billing system", { icons: ["🚩"] }),
          leaf("w2", "Small team"),
        ]),
        node("o", "Opportunities", [
          leaf("o1", "A competitor just raised prices"),
          leaf("o2", "Inbound enterprise interest"),
        ]),
        node("t", "Threats", [
          leaf("t1", "Cannibalising the free tier"),
          leaf("t2", "Mispricing drives churn"),
        ]),
      ],
      { note: "The analysis is in the arrows across the quadrants, not the four lists." },
    ),
    {
      links: [
        { id: "r1", from: "o1", to: "s1", label: "leverage" },
        { id: "r2", from: "t1", to: "w1", label: "mitigate" },
        { id: "r3", from: "o2", to: "w2", label: "blocked by" },
      ],
    },
  );

// 7 — Personal knowledge map: deep nesting, prose notes, a hyperlink.
const pkm = (): MindMapDoc =>
  doc(
    "What I know about coffee",
    node("root", "What I know about coffee", [
      node("beans", "Beans", [
        node("ar", "Arabica", [leaf("ar1", "Ethiopia"), leaf("ar2", "Colombia")], {
          note: "Sweeter, more acidic; most specialty coffee.",
        }),
        leaf("ro", "Robusta", { note: "Bitter, more caffeine; espresso blends." }),
      ]),
      node("brew", "Brewing", [
        node("po", "Pour-over", [leaf("po1", "1:16 ratio"), leaf("po2", "Medium grind")], {
          hyperlink: "https://example.com/pour-over-guide",
        }),
        node("es", "Espresso", [leaf("es1", "9 bar"), leaf("es2", "Fine grind")]),
        leaf("fp", "French press"),
      ]),
      node("gear", "Gear", [leaf("g1", "Burr grinder", { icons: ["⭐"] }), leaf("g2", "Scale")]),
    ]),
  );

// 8 — Study / revision map: a confidence-marker vocabulary, notes.
const study = (): MindMapDoc =>
  doc(
    "GCSE Biology — Cells",
    node(
      "root",
      "GCSE Biology — Cells",
      [
        node("types", "Cell types", [
          leaf("ty1", "Prokaryotic", { icons: ["✅"] }),
          leaf("ty2", "Eukaryotic", { icons: ["⏳"] }),
        ]),
        node("org", "Organelles", [
          leaf("or1", "Nucleus", { icons: ["✅"] }),
          leaf("or2", "Mitochondria", { icons: ["⏳"], note: "Site of aerobic respiration." }),
          leaf("or3", "Ribosomes", { icons: ["❓"] }),
          leaf("or4", "Chloroplast", { icons: ["❓"] }),
        ]),
        node("trans", "Transport", [
          leaf("tr1", "Diffusion", { icons: ["✅"] }),
          leaf("tr2", "Osmosis", { icons: ["❓"], note: "Water, high → low concentration." }),
          leaf("tr3", "Active transport", { icons: ["❓"] }),
        ]),
      ],
      { note: "Confidence markers: ✅ solid · ⏳ revising · ❓ shaky — revise the ❓ first." },
    ),
  );

// 9 — Trip plan: legs as a boundary, notes, and the gallery's one image.
const trip = (): MindMapDoc =>
  doc(
    "Japan trip — 2 weeks",
    node(
      "root",
      "Japan trip — 2 weeks",
      [
        node("before", "Before you go", [
          leaf("bf1", "Flights", { icons: ["✅"] }),
          leaf("bf2", "JR Pass", { icons: ["⏳"] }),
          leaf("bf3", "eSIM"),
        ]),
        node("tokyo", "Tokyo · 5 days", [
          leaf("tk1", "Shibuya & Shinjuku"),
          leaf("tk2", "Asakusa"),
          leaf("tk3", "Day trip: Hakone", { note: "Ryokan + onsen, book early." }),
        ]),
        node("kyoto", "Kyoto · 4 days", [
          leaf("ky1", "Fushimi Inari", { icons: ["⭐"] }),
          leaf("ky2", "Arashiyama"),
          leaf("ky3", "Gion"),
        ]),
        node("osaka", "Osaka · 3 days", [leaf("os1", "Dotonbori"), leaf("os2", "Day trip: Nara")]),
        node("budget", "Budget", [
          leaf("bd1", "Flights"),
          leaf("bd2", "Hotels"),
          leaf("bd3", "Food & trains"),
        ]),
      ],
      {
        image: { url: JAPAN_FLAG, width: 42, height: 28 },
        note: "2 weeks in March. Target ~£3k pp.",
      },
    ),
    {
      boundaries: [{ id: "b1", nodeIds: ["tokyo", "kyoto", "osaka"], label: "On the ground" }],
    },
  );

// 10 — Talk / content outline: deep, leaf-heavy — built for the Outline view and Markdown export.
const outline = (): MindMapDoc =>
  doc(
    "Talk: Focus in a noisy world",
    node(
      "root",
      "Talk: Focus in a noisy world",
      [
        leaf("hook", "Hook: the cost of a single interruption"),
        node("p1", "1 · Why focus is rare", [
          leaf("p1a", "Always-on tools"),
          leaf("p1b", "Open-plan everything"),
          leaf("p1c", "Busy ≠ productive"),
        ]),
        node("p2", "2 · Habits that protect it", [
          leaf("p2a", "Time-blocking"),
          leaf("p2b", "A shutdown ritual"),
          leaf("p2c", "Single-tasking"),
        ]),
        node("p3", "3 · Tools & traps", [
          leaf("p3a", "Notifications off by default"),
          leaf("p3b", "One screen, one task"),
        ]),
        leaf("close", "Close: one change to make tomorrow"),
      ],
      {
        note: "Reads top to bottom as a script. Export Markdown to get the speaker notes.",
      },
    ),
  );

// 11 — Incident runbook: a top-to-bottom flow, stages grouped by a boundary, step notes.
const runbook = (): MindMapDoc =>
  doc(
    "Runbook: API latency spike",
    node(
      "root",
      "Runbook: API latency spike",
      [
        node("detect", "Detect", [
          leaf("de1", "Alert: p99 > 1s for 5 min"),
          leaf("de2", "Open the latency dashboard"),
        ]),
        node("triage", "Triage", [
          leaf("tr1", "Recent deploy?", { icons: ["🚩"] }),
          leaf("tr2", "Slow DB queries?"),
          leaf("tr3", "Traffic spike?"),
        ]),
        node("mitigate", "Mitigate", [
          leaf("mi1", "Roll back the deploy", {
            icons: ["❗"],
            note: "Fastest fix if a deploy is the cause.",
          }),
          leaf("mi2", "Scale out"),
          leaf("mi3", "Enable the cache"),
        ]),
        node("recover", "Recover", [leaf("re1", "Confirm p99 back to normal", { icons: ["✅"] })]),
        node("review", "Review", [leaf("rv1", "Write the postmortem", { icons: ["⏳"] })]),
      ],
      {
        note: "Work top to bottom. Tip: switch the layout to right-only for a flow you read in order.",
      },
    ),
    { boundaries: [{ id: "b1", nodeIds: ["mitigate", "mi1", "mi2", "mi3"], label: "Act fast" }] },
  );

// 12 — Cross-map atlas: the "doorways" pattern. Built as the shape + guidance, since live
// cross-map links point at specific map ids (which you wire to your own maps).
const atlas = (): MindMapDoc =>
  doc(
    "Company atlas",
    node(
      "root",
      "Company atlas",
      [
        leaf("st", "Strategy ▸", {
          note: "Select me, then use 🔗 to point this topic at your Strategy map.",
        }),
        leaf("lp", "Product launch ▸", { note: "Link me to your launch map." }),
        leaf("ok", "OKRs ▸", { note: "Link me to your OKRs map." }),
        leaf("rm", "Roadmap ▸", { note: "Link me to your roadmap." }),
        leaf("hr", "Hiring ▸", { note: "Link me to your hiring plan." }),
      ],
      {
        note: "An atlas is a high-level map whose topics are doorways into detailed maps. Wire each topic to its own map with 🔗, then click to hop between them.",
      },
    ),
  );

// 13 — GTD Natural Planning Model: David Allen's five steps, applied to a real plan.
const gtd = (): MindMapDoc =>
  doc(
    "Offsite in Lisbon — natural planning",
    node(
      "root",
      "Offsite in Lisbon — natural planning",
      [
        node("purpose", "1 · Purpose & principles", [
          leaf("pu1", "Why: re-align the team on H2"),
          leaf("pu2", "Principle: everyone contributes"),
        ]),
        node("vision", "2 · Outcome / vision", [
          leaf("vi1", "Success: a shared H2 plan + 3 decisions made"),
        ]),
        node("brain", "3 · Brainstorm", [
          leaf("br1", "Venue ideas"),
          leaf("br2", "Session topics"),
          leaf("br3", "Social / dinner"),
        ]),
        node("org", "4 · Organise", [
          leaf("og1", "Day 1: strategy"),
          leaf("og2", "Day 2: planning"),
          leaf("og3", "Assign owners"),
        ]),
        node("actions", "5 · Next actions", [
          leaf("na1", "Book the venue — me", { icons: ["❗"] }),
          leaf("na2", "Send the invite", { icons: ["⏳"] }),
          leaf("na3", "Draft the agenda"),
        ]),
      ],
      {
        note: "David Allen's Natural Planning Model: purpose → vision → brainstorm → organise → next actions.",
      },
    ),
  );

// 13b — GTD Areas of Focus (Horizon 2, the "20,000 ft" view): the standing roles and
// responsibilities you maintain — not projects or next actions, but the buckets you keep "current
// and complete". Reviewing them surfaces projects to add and ones to drop. Markers flag where each
// area stands right now (❗ needs attention · ⏳ in progress · ✅ on track).
const gtdAreas = (): MindMapDoc =>
  doc(
    "Areas of Focus — GTD (20,000 ft)",
    node(
      "root",
      "Areas of Focus — GTD (20,000 ft)",
      [
        node("prof", "Professional", [
          leaf("af-team", "Team & people", {
            icons: ["❗"],
            note: "Two 1:1s overdue; one report wants a growth conversation.",
          }),
          leaf("af-delivery", "Product delivery", { icons: ["⏳"] }),
          leaf("af-career", "Own career & skills", {
            note: "Maintain one learning goal per quarter — currently none chosen.",
          }),
          leaf("af-budget", "Budget & vendors", { icons: ["✅"] }),
          leaf("af-stake", "Stakeholders & comms"),
        ]),
        node("pers", "Personal", [
          leaf("af-health", "Health & fitness", {
            icons: ["⏳"],
            note: "3× gym/week; annual check-up booked for next month.",
          }),
          leaf("af-family", "Family & relationships", { icons: ["❗"] }),
          leaf("af-finance", "Finances", { icons: ["✅"] }),
          leaf("af-home", "Home & admin"),
          leaf("af-grow", "Learning & hobbies"),
        ]),
        node("civic", "Community & service", [
          leaf("af-volunteer", "Volunteering", { icons: ["⏳"] }),
          leaf("af-mentor", "Mentoring & network"),
        ]),
      ],
      {
        note: "GTD Horizon 2 — your Areas of Focus / Responsibility: the 4–7 (work) + few (personal) hats you wear that must stay 'current and complete'. Unlike projects, these never finish; you review them (weekly/monthly) to spot projects to start or stop. Keep each area's standard high enough that nothing important quietly slips.",
      },
    ),
  );

// 14 — Flowchart: node shapes carry the step type, directional links label the branches.
// Best read in the Org chart ↓ layout (a top-down flow).
const flowchart = (): MindMapDoc =>
  doc(
    "Flowchart: support ticket",
    node(
      "fc-start",
      "New ticket",
      [
        node(
          "fc-triage",
          "Triage & label",
          [
            node(
              "fc-urgent",
              "Urgent?",
              [
                leaf("fc-esc", "Escalate to on-call", { style: { shape: "rect" } }),
                leaf("fc-queue", "Add to backlog", { style: { shape: "rect" } }),
                node(
                  "fc-resolve",
                  "Resolve & verify",
                  [
                    node(
                      "fc-notify",
                      "Notify customer",
                      [leaf("fc-end", "Closed", { style: { shape: "ellipse" } })],
                      { style: { shape: "parallelogram" } },
                    ),
                  ],
                  { style: { shape: "rect" } },
                ),
              ],
              { style: { shape: "diamond" } },
            ),
          ],
          { style: { shape: "rect" } },
        ),
      ],
      {
        style: { shape: "ellipse" },
        note: "Shapes mark step types: oval = start/end, diamond = decision, parallelogram = I/O. Pick the top-down ↓ layout for a classic flow.",
      },
    ),
    {
      links: [
        { id: "fl1", from: "fc-urgent", to: "fc-esc", label: "yes" },
        { id: "fl2", from: "fc-urgent", to: "fc-queue", label: "no" },
        { id: "fl3", from: "fc-esc", to: "fc-resolve", label: "fixed" },
        { id: "fl4", from: "fc-queue", to: "fc-resolve", label: "picked up" },
      ],
    },
  );

// 15 — Concept map: ideas linked across branches by labelled, directional arrows (the defining
// concept-map move). Built around a cycle so the arrows tell a story. Try the Radial layout.
const concept = (): MindMapDoc =>
  doc(
    "Concept map: the water cycle",
    node(
      "cm-root",
      "Water cycle",
      [
        leaf("cm-sun", "The Sun", { style: { shape: "ellipse" }, icons: ["⭐"] }),
        leaf("cm-evap", "Evaporation", { style: { shape: "ellipse" } }),
        leaf("cm-cond", "Condensation", { style: { shape: "ellipse" } }),
        leaf("cm-prec", "Precipitation", { style: { shape: "ellipse" } }),
        leaf("cm-coll", "Collection", { style: { shape: "ellipse" } }),
      ],
      {
        note: "A concept map links ideas across branches with labelled arrows — follow them around the cycle. The arrowheads show direction.",
      },
    ),
    {
      links: [
        { id: "cl1", from: "cm-sun", to: "cm-evap", label: "drives" },
        { id: "cl2", from: "cm-evap", to: "cm-cond", label: "vapour rises & cools" },
        { id: "cl3", from: "cm-cond", to: "cm-prec", label: "forms clouds" },
        { id: "cl4", from: "cm-prec", to: "cm-coll", label: "falls as rain / snow" },
        { id: "cl5", from: "cm-coll", to: "cm-evap", label: "warms & repeats" },
      ],
    },
  );

// 16 — Whiteboard: free-canvas mode. Every box carries its own position (meta.freeform = true),
// so it opens as a place-anywhere brainstorm wall — drag any box, shapes + arrows give it meaning.
const whiteboard = (): MindMapDoc => {
  const d = doc(
    "Whiteboard: feature kickoff",
    node(
      "wb-root",
      "Feature kickoff",
      [
        leaf("wb-prob", "Problem: slow onboarding", {
          pos: { x: -260, y: 150 },
          style: { shape: "rect", background: "#fde2e2" },
        }),
        leaf("wb-goal", "Goal: setup < 5 min", {
          pos: { x: 320, y: 150 },
          style: { shape: "ellipse", background: "#e2fbe8" },
        }),
        leaf("wb-tour", "Idea: guided tour", { pos: { x: -360, y: 320 } }),
        leaf("wb-tmpl", "Idea: starter templates", { pos: { x: -120, y: 320 } }),
        leaf("wb-wiz", "Idea: import wizard", { pos: { x: 140, y: 320 } }),
        leaf("wb-risk", "Risk: scope creep", {
          pos: { x: 400, y: 320 },
          style: { shape: "parallelogram", background: "#fdf3e2" },
        }),
      ],
      {
        pos: { x: 60, y: 0 },
        note: "Free placement is ON (🧲) — drag any box anywhere. Mix shapes + arrows to make a flowchart, concept map, or brainstorm wall.",
      },
    ),
    {
      links: [
        { id: "wl1", from: "wb-prob", to: "wb-goal", label: "we want" },
        { id: "wl2", from: "wb-goal", to: "wb-tour", label: "via" },
        { id: "wl3", from: "wb-goal", to: "wb-tmpl", label: "via" },
        { id: "wl4", from: "wb-goal", to: "wb-wiz", label: "via" },
        { id: "wl5", from: "wb-wiz", to: "wb-risk", label: "watch" },
      ],
    },
  );
  d.meta = { ...d.meta, freeform: true };
  return d;
};

// 17 — Onion diagram: a dedicated backdrop (concentric rings) with the ring labels as topics placed
// on each band. Free-canvas mode is on so you can drag topics between rings.
const onionDiagram = (): MindMapDoc => {
  const d = doc(
    "Onion: stakeholders",
    node(
      "on-root",
      "Stakeholder onion",
      [
        leaf("on-core", "Core team", { pos: { x: -34, y: -58 } }),
        leaf("on-mid", "Close partners", { pos: { x: -48, y: -158 } }),
        leaf("on-out", "Wider community", { pos: { x: -56, y: -258 } }),
      ],
      {
        pos: { x: -52, y: 24 },
        note: "Concentric rings = degrees of involvement. Drag topics between rings; use −/+ to add rings.",
      },
    ),
  );
  d.meta = { ...d.meta, freeform: true };
  d.backdrop = { kind: "onion", rings: 3 };
  return d;
};

// 18 — Funnel: stacked stages narrowing toward conversion (a backdrop), stage labels as topics.
const funnelDiagram = (): MindMapDoc => {
  const d = doc(
    "Funnel: sales pipeline",
    node(
      "fn-root",
      "Sales funnel",
      [
        leaf("fn-1", "Awareness", { pos: { x: -40, y: -166 } }),
        leaf("fn-2", "Interest", { pos: { x: -30, y: -62 } }),
        leaf("fn-3", "Decision", { pos: { x: -34, y: 42 } }),
        leaf("fn-4", "Action", { pos: { x: -26, y: 148 } }),
      ],
      {
        pos: { x: -46, y: -252 },
        note: "Stages narrow toward conversion. Use −/+ to change the number of stages.",
      },
    ),
  );
  d.meta = { ...d.meta, freeform: true };
  d.backdrop = { kind: "funnel", rings: 4 };
  return d;
};

// 19 — Venn (3 circles): the classic trade-off triangle, one topic per region.
const venn3Diagram = (): MindMapDoc => {
  const d = doc(
    "Venn: fast · good · cheap",
    node(
      "v3-root",
      "Pick two",
      [
        leaf("v3-a", "Fast", { pos: { x: -20, y: -182 } }),
        leaf("v3-b", "Good", { pos: { x: -178, y: 104 } }),
        leaf("v3-c", "Cheap", { pos: { x: 112, y: 104 } }),
        leaf("v3-ab", "Rushed", { pos: { x: -86, y: -34 } }),
        leaf("v3-ac", "Pricey", { pos: { x: 28, y: -34 } }),
        leaf("v3-bc", "Slow", { pos: { x: -28, y: 44 } }),
        leaf("v3-all", "Unicorn", { pos: { x: -38, y: -8 } }),
      ],
      {
        pos: { x: -54, y: -300 },
        note: "Three sets, seven regions. Drag a topic into the region it belongs to.",
      },
    ),
  );
  d.meta = { ...d.meta, freeform: true };
  d.backdrop = { kind: "venn3" };
  return d;
};

const BUILDERS: Record<string, () => MindMapDoc> = {
  launch: launch,
  meeting: meeting,
  decision: decision,
  okrs: okrs,
  retro: retro,
  swot: swot,
  flowchart: flowchart,
  concept: concept,
  whiteboard: whiteboard,
  onion: onionDiagram,
  funnel: funnelDiagram,
  venn: venn3Diagram,
  runbook: runbook,
  gtd: gtd,
  "gtd-areas": gtdAreas,
  outline: outline,
  pkm: pkm,
  study: study,
  trip: trip,
  atlas: atlas,
};

/** One-line use-case shown on the Start-screen example cards (keyed by example id). */
export const EXAMPLE_DESCRIPTIONS: Record<string, string> = {
  launch: "A worked go-to-market plan with dependencies and status.",
  meeting: "A filled meeting note with decisions and action markers.",
  decision: "A logged decision with options weighed and chosen.",
  okrs: "A quarter's objective broken into measured key results.",
  retro: "A team retro turning reflections into action items.",
  swot: "A completed SWOT with real strengths and threats.",
  flowchart: "A process drawn with shapes and directional flow.",
  concept: "Linked ideas in a non-hierarchical concept web.",
  whiteboard: "A free-layout whiteboard of loosely-placed notes.",
  onion: "Nested layers shown on an onion-ring backdrop.",
  funnel: "Stages narrowing through a funnel backdrop.",
  venn: "Overlapping sets on a three-circle Venn backdrop.",
  runbook: "Step-by-step incident response, ready to follow.",
  gtd: "GTD natural planning, from purpose to next actions.",
  "gtd-areas": "GTD areas of focus across work and life.",
  outline: "A talk or article outlined section by section.",
  pkm: "A personal knowledge map linking notes and topics.",
  study: "A revision map built for learning and recall.",
  trip: "A trip plan with an embedded image.",
  atlas: "A hub map that links out to several other maps.",
};

/** Build an example map by id, falling back to the first example for an unknown id. */
export function buildExample(id: string): MindMapDoc {
  return (BUILDERS[id] ?? BUILDERS.launch)();
}
