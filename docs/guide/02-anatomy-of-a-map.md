# The anatomy of a map

### The parts of a map, and why thinking in them works

You can use MindMap Studio without ever reading this chapter. But twenty minutes here
will make every later feature feel obvious instead of arbitrary, because they all act on
the same small set of parts -- and it will make your maps *better*, because the parts
come with a method. This chapter covers both: what a map is made of, and the handful of
disciplines that separate a map that helps you think from a decorated list.

## The shape: one centre, many branches

A mind map is a tree with a single root in the middle and branches radiating outward.
The classic starting point is a central idea surrounded by the six questions every
plan eventually has to answer:

<!-- DIAGRAM:first-map -->

This is exactly what the built-in **Brainstorm** template gives you (you'll meet the
other templates in Chapter 7). Each branch can grow its own children, and theirs can
grow more, as deep as the thought goes. The radial shape isn't decoration: putting the
subject in the centre keeps every branch equidistant from it, so no single line of
thinking dominates just because it happens to be at the top of a list.

## Why a map beats a list

It's worth being precise about what the shape buys you, because the answer explains most
of the method that follows.

**A map takes the load off your working memory.** You can hold perhaps four to seven
things in your head at once; a plan of any size has more parts than that. Written as a
list, the parts you aren't currently reading are gone -- you re-derive them every time
you scroll. Laid out as a map, *everything is visible at once, in its place*. Your eyes
do the remembering, and the headspace that was spent juggling is freed up for the actual
thinking: noticing what's missing, what clashes, what connects.

**A map keeps relationships visible.** A list has exactly one relationship: *comes
after*. A map has several at a glance -- *belongs under*, *sits beside*, *is far from*,
*points at*. When you notice that a risk on one branch is really the same issue as a
constraint on another, that noticing *is* the work, and it happens because the two were
on the same page in the first place. Linear notes hide those collisions; radial ones
invite them.

**A map defers order until you've earned it.** The cruellest thing about a blank
document is that it demands sequence immediately -- something has to be the first line.
But at the start of a piece of thinking you don't *know* what comes first; sequencing is
a conclusion, not a starting point. A map lets you put an idea down where it roughly
belongs and decide its rank later, which is why a map is the right first surface and the
finished document is better written *from* the map than instead of it.

**A word with a place is easier to recall than a word in a row.** You remember where
things are -- it's why you can find the mustard in your own fridge in the dark. A topic
that lives at the end of a particular branch, in a particular colour, in a particular
corner, gets that spatial memory for free. The same fact as the fourth bullet of the
second section has almost nothing to hang on to.

None of this is magic, and none of it requires believing any grand theory of the brain.
It's ergonomics: the map is a surface shaped like the problem -- part-whole structure
with exceptions -- instead of a surface shaped like a page.

## The node: the only real object

Everything on the canvas is a **node**. A node has:

- a **topic** -- the text you see;
- an optional set of **markers** -- small icons or tags (Chapter 4);
- an optional **note** -- longer prose attached behind the node (Chapter 4);
- an optional **image**;
- and **children** -- the nodes hanging off it.

The root is just a node that happens to have no parent. A leaf is just a node with no
children. There is no special "task" type or "milestone" type -- MindMap Studio keeps
the model deliberately small. That smallness is why import, export and undo all behave
predictably: there are fewer kinds of thing to get wrong.

## The things that aren't nodes

A small family of features draws on the canvas without being part of the tree:

- A **boundary** is a soft, shaded box drawn around a node and everything beneath it,
  grouping a branch visually ("everything in here is Phase 1").
- A **relationship** is an arrow drawn from one node to another, expressing a link
  that the tree structure can't -- a dependency, an influence, a "see also" across
  branches.
- A **summary** bracket, a **callout** bubble, and the free **background shapes** are
  the rest of the family -- annotations and frames you'll meet in Chapters 3 and 4.

The first two carry most of the weight and are covered in Chapter 3. The point for
now: the tree carries the *hierarchy*, and everything else carries the *exceptions*
and *commentary* around it.

## The canonical model

Under the surface, your map is a plain data structure -- a root node, its children,
each node's topic and notes and markers. MindMap Studio treats that structure as the
single source of truth. The colourful canvas is one *view* of it; the outline panel
(Chapter 5) is another; an exported Markdown file is a third. Edit the map on the
canvas and the underlying model updates; every other view follows.

This is worth internalising because it explains the app's most reassuring property:
**what you see is always backed by real data you can take with you.** A map is never
trapped in a proprietary blob. Chapter 6 shows you how to round-trip it through
Markdown, JSON, OPML and more -- losslessly, in the case of JSON.

## The method in five rules

Everything this book teaches about *technique* -- as opposed to the tool -- compresses
into five rules. They date back to the hand-drawn tradition of mind mapping, they
survive contact with real work, and every one of them exists to protect the advantages
of the shape described above.

**1. Keywords, not sentences.** A topic should be one to three words -- `Venue
shortlist`, not `We need to shortlist some venues by Friday`. This isn't a style
preference. A short label can be *read at a glance while looking at something else*,
which is what keeps the whole map scannable; a sentence has to be read on purpose, and
twenty of them turn your map back into the document you were escaping. Short labels also
stay *open* -- `Budget` invites more thoughts underneath it; a full sentence sounds
finished and quietly closes the branch. Put the sentence in a **note** behind the node
(Chapter 4) if it matters; the canvas gets the keyword.

**2. One idea per node.** If a label contains an "and", it's usually two nodes --
`Catering and AV` will want to grow in two directions, and can't. Splitting feels
pedantic for a second and pays off for the life of the map: single ideas can be moved,
marked, filtered, and connected independently. Compound ones can't.

**3. Let the branches ask questions.** The strongest first-level branches are the
questions the subject has to answer -- *who, what, when, where, why, how* for a plan;
*strengths, weaknesses, opportunities, threats* for a position; *start, stop, continue*
for a retrospective. A branch that names a question pulls answers out of you; a branch
that names a category just sits there. When a map stalls, check whether its branches
are still asking anything.

**4. Structure carries the logic; arrows carry the exceptions.** Put "is part of" in
the tree, by placement. Save relationship arrows (Chapter 3) for the handful of links
the hierarchy genuinely can't express -- the dependency, the tension, the "these two
collide". A map where placement means nothing and arrows do all the work has thrown
away its best instrument; a map with no arrows at all has usually just not been looked
at hard enough.

**5. Prune.** A finished map is the *smallest* one that still carries the argument.
Merge duplicates, delete the branch that turned out to be someone else's problem,
collapse the detail that only mattered while you were finding it. The discipline is the
same as editing prose: what you remove sharpens what remains. (Nothing is lost --
Chapter 6's version history keeps what you cut.)

Hold these loosely -- a map for your own eyes can break every one of them and still
work. But when a map goes to other people, or has to survive more than a week, the
rules are what keep it legible.

## Two gears: diverge, then converge

The rules above are about the *state* of a map. The method also has a *rhythm*, and it's
the same rhythm every creative discipline discovers: **generating and judging are
different modes, and doing both at once does both badly.**

In the **divergent** gear, the only goal is more: capture every idea as a node, put it
anywhere, don't evaluate, don't tidy, don't even parent things correctly -- floating
topics and misplaced branches are fine. Speed matters because judgement kills the
association chains that produce the non-obvious ideas; the moment you stop to fix a
label, the next thought escapes.

In the **convergent** gear, you switch loyalties from *more* to *true*: drag things
under the branch where they belong, merge the duplicates, prune the noise, name the
clusters that emerged, and only now decide what matters. Restructuring isn't overhead
-- it's the half of the thinking where conclusions form (Chapter 3 gives you the moves).

The practical habit: **name the gear you're in.** Alone, that can be as simple as a
timer -- ten minutes of pure capture, then shift. In a group it has to be said out loud,
because one person judging while others generate silences the room (Chapter 7 builds a
whole workshop rhythm on this). Most disappointing maps are the product of trying to do
both gears at once; most good ones are two clean passes.

## When not to map

A method you can't say "no" for isn't a method. Mind maps are the right surface for
thinking that is *part-whole shaped with exceptions* -- plans, analyses, decisions,
subjects being learned. They are the wrong surface for at least three jobs:

- **True sequences.** A checklist you execute top to bottom, a recipe, a runbook -- if
  the order *is* the content, a list is simply better. (If a map develops a long chain
  of single children, it's telling you it wants to be a list; the timeline layout in
  Chapter 5 is the halfway house.)
- **Heavy comparison.** Choosing between four options across six weighted criteria is a
  *table* -- rows, columns, and sums. Map the option space to discover the criteria,
  then move the scoring to a spreadsheet.
- **Finished prose.** A map is scaffolding. When the thinking is done, write the
  document *from* the map (Chapter 6's exports make that direct) -- don't ship the
  scaffolding and call it the building.

Knowing when to reach for a different tool is part of what makes the map trustworthy
when you do reach for it.

## Now you try

Open a worked example (**+ New... -> Examples** -- the *SWOT (worked)* or *Product launch
plan* both qualify) and name the parts out loud: which node is the **root**, which are
**branches**, where's the **boundary**, where's the **relationship** arrow. Then prove
the "one model, many views" idea to yourself -- open the **Outline** panel (Chapter 5) and watch
the same tree appear as an indented list, or export to **Markdown** (Chapter 6) and read your map
as plain text. Same data, three faces. Now **rename a node on the canvas** and look again: the
outline and the Markdown already show your edit, because the canvas writes straight to the one
model every view reads from -- nothing to "save", nothing to sync.

Then run the method's most valuable exercise once, deliberately. Take the map you built in
Chapter 1 and audit it against **rule 1**: find every label longer than three words and
compress it to a keyword, moving anything that mattered into a note. `Book the venue before
end of March` becomes `Venue booking` with the deadline in the note (or, later, as a real due
date -- Chapter 4). Now stand back and *feel* the difference: the map reads at a glance where
it used to need reading. Do the same audit for **rule 2** -- split any node hiding an "and" --
and watch the split halves immediately want different children. Ten minutes of this, once, and
the keyword habit sticks for good.

Finally, feel the **two gears**. Set a five-minute timer and add nodes about something you're
actually planning -- any branch, any order, no fixing, no judging. When it rings, switch: spend
five minutes only dragging, merging and pruning, adding nothing new. Notice how different the
two passes feel -- and how much better the map is for having kept them apart.

With the parts named and the rules in hand, the rest of the book is learning what you can
do with them -- and Chapter 8 returns to pure method, applying these rules to the six jobs
you'll most often bring to a map.
