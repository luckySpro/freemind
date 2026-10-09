# Enriching nodes

### Notes, markers, images, and making a map look like it means it

A bare tree of labels is often enough. But a node can carry far more than its topic,
and used with restraint, that extra detail turns a sketch into a document you can hand
to someone else.

## Notes: the prose behind the bubble

A topic should stay short. The paragraph it deserves goes in a **note**. Select a node,
open the **Notes** panel, and write. Notes accept **Markdown** -- headings, bold and
italic, bullet lists, inline `code`, and links -- and the panel shows a live preview, so
the formatting you type is the formatting you get.

Notes are where a map stops being a brainstorm and becomes a brief. The node says
*Vendor decision*; the note records the three options, the criteria, and why you chose
the one you did. The canvas stays scannable; the detail is one click away on whichever
node owns it.

Less than a click, in fact. A node with a note grows a small **📝** indicator, and merely
*hovering* it peeks the note in a small card -- enough to check a detail without opening the
panel; clicking it opens the editor. The same trick works elsewhere: hover a collapsed branch's
**+N** count and it peeks the first few hidden children, and a node's **📎** attachment chip
lists its file names. The map keeps its depth behind the labels, but the depth answers to a
glance.

## Markers: status at a glance

A **marker** is a small icon or tag pinned to a node. Open the **Markers** palette -- it sits in
the topic inspector, which the **ⓘ** in a selected topic's action bar opens (or turn on *Settings
→ Open topic info on select* to have it open on every click) -- and click to toggle one on the
selected node: a priority flag, a tick, a question mark, a face. Each chip also **drags** -- pull a marker from the palette onto any topic on the
canvas, selected or not, and it lands where you drop it, which is the natural motion when
you're triaging a whole map rather than dressing one node. Markers are how a map carries
*state* without words -- a row of green ticks and one red flag tells a reviewer where to
look before they've read a single label.

Pick a small vocabulary and stick to it. "Red flag means blocked, tick means done,
question mark means undecided" is a convention a whole team can read at a glance; fifteen
different icons used once each is just clutter.

The palette shows a curated starter set; a **search box** above it reaches the full library of
forty-five by name ("done", "warning", "idea"). Four of the sets are **single-select groups** --
Priority (1-9), Status (coloured dots), Mood, and Vote -- so applying one member clears any other
from the same group and a topic never carries two priorities at once. And the app makes small
suggestions of its own: a **Suggested** row under the palette offers markers inferred from the
topic's text -- write "urgent" and the ❗ is one click away. The suggestions never apply
themselves; the vocabulary stays yours.

Tags get housekeeping to match. The tag field **autocompletes** from every tag already in the
map, and the **Markers &amp; tags** index panel can **rename** a tag everywhere, **merge** two by
renaming one onto the other, **delete** one from every topic, or give it a **colour** that tints
every topic carrying it -- a view-only wash that a node's own styling still overrides. Fastest of
all, don't visit a panel at all: type **#** while editing a topic and the tag picker pops up
mid-keystroke -- pick an existing tag or mint a new one, and keep typing.

> Markers imported from a MindManager `.mmap` file are mapped to the closest emoji, so a
> map you bring in from elsewhere keeps its visual cues rather than arriving as bare text.

When you select several nodes at once, the Markers palette switches to **bulk** mode and works across the whole selection. A marker chip reads its state from the group: it shows **lit** when every selected topic already carries that marker, and **dashed** when only some of them do. Clicking follows the obvious rule -- a lit chip *removes* the marker from all the nodes; a dashed or empty chip *adds* it to every node that lacks it, in a single undo step. So to flag a dozen blocked topics, lasso them, click the flag once, and it lands on all twelve; click it again and it's gone from all twelve. Tags behave the same way in bulk: select the cluster, type or click a tag, and `risk` is on every node in the group at once -- which is exactly what a conditional rule (below) is waiting for.

## Tasks: when a topic is also a job

A marker says *this is urgent*; a **task** says *this is work, and here's where it stands*.
Open the **ℹ Info** panel and a node can carry three task fields: a **progress** slider (0 to
100%), a **priority** (the full 1-9 ladder MindManager uses -- 1 reads as High, 2 as Med, 3 as
Low, and 4-9 as their number), and **start** and **due** dates -- fields that understand plain
language, so `tomorrow`, `next fri`, or `+7d` resolve to real dates as you leave the field.
Together they turn a
branch of a plan into something you can actually track.

Progress **rolls up**: set the leaves and a parent shows the average of its children, so the top
of a branch reports how far the whole thing has come without your doing the sum. Due dates work
the same way -- a topic past its date is flagged **overdue** on the canvas, so a plan that's
slipping says so out loud. None of this turns MindMap Studio into a project planner; it makes a
*map* enough of one that you don't have to leave it to see what's done, what's next, and what's
late. (Chapter 5's filter and board then let you ask the whole map "what's overdue?" at once.)

Day to day you rarely need the panel. Hover a topic's left edge and a small **checkbox**
appears: click it to cycle *not a task -> to-do -> done* -- the fastest way to run a checklist
straight on the canvas. And when a plan slips wholesale, don't edit dates one at a time:
**right-click** the branch's top node and the **Shift task dates** row moves every start and due
date beneath it by **-1w / -1d / +1d / +1w / +1mo** in one undo step, relative gaps preserved.
The deadline moved a week; the map takes one click to agree.

## Images

A node can hold an **image** -- a screenshot, a logo, a photographed whiteboard, a chart.
Attach one to the selected node and it renders inline on the canvas -- and getting one in is as
direct as **Ctrl+V**: copy a screenshot anywhere and paste it straight onto the selected topic.
An image is worth a paragraph of note when the thing you're describing is itself visual.

An image usually sits *beside* the label. For a stronger statement, the Style tab's **Fill
image...** puts a picture *behind* it instead -- covering the whole card, the topic text over it,
one per node, with **Clear fill image** to lift it off. It reads like a small poster: right for
the handful of nodes that *are* their picture (a person, a place, a product), wrong for twenty.

Sometimes you don't have a file to hand -- you just want a small visual cue: a **star** on the
idea you're proudest of, a **warning** triangle on the risk, a **flag** on the decision still
open. For that, the **ℹ Info** panel keeps a built-in grid of **stickers**: twenty clean little
illustrations -- star, heart, check and cross badges, lightbulb, target, rocket, lock, clock, fire,
and more -- in one quiet accent colour so they read as a set rather than a circus. Click one and it
lands on the selected node. Behind the scenes a sticker simply *becomes* that node's image, which is
the whole trick: it renders on the canvas and travels into every export exactly like a picture you
supplied yourself, with nothing new to learn. A node holds one image at a time, so picking a new
sticker (or a real photo) swaps out the last. Used sparingly -- one or two on the nodes that carry
the most weight -- a sticker pulls the eye to what matters without a word.

## Attachments: files that travel with the node

An image renders *on* the node; an **attachment** rides along *with* it. From the **ℹ Info**
panel you can attach a file to the selected topic -- a spec, a contract, a spreadsheet -- and
it's stored inside the map itself, so it travels in the JSON export and is there even offline,
one click from downloading again. Reach for an attachment when the source document matters but
doesn't belong on the canvas: the node says *Vendor contract*, the file *is* the contract, kept
with the idea it backs up.

## Styling: shape, fill, border, font

Beyond markers, individual nodes can be **styled**: change a node's shape, fill colour, border,
or weight; bump a topic's font size or colour; and switch its **font family** from the **Font**
picker -- the default sans-serif, a **serif** for a quieter, document-like topic, or **monospace**
for code, IDs, and anything that should line up. Two fill options go beyond a flat swatch: a
**branch-colour tint** (◧) washes the node in a soft version of its own branch's colour --
structure restated as colour, no palette decisions required -- and a **gradient** (◨) adds a
gentle fade for the one node that should read as a header. And a topic that has outgrown its line
doesn't have to stretch the layout: set its **wrap width** -- the snap slider in the Style tab, or
the width grip on the selected node itself -- and long text folds into a tidy block instead of a
banner. Styling earns its keep when it
*encodes* something -- the three "decision" nodes all share a fill, the headline branch
is bolder than the rest -- and costs you readability when it's merely decorative. Style
to create a pattern the reader can rely on, not to make the map "pop".

## Styles you can reuse, formatting that follows the data

Hand-styling one node at a time is a scalpel; two features in the **🎨 Styles** panel (the toolbar
button, not the per-node Style bar above) make styling *systematic*.

A **named style** saves a look so you can reuse it. Dress one node the way you want -- fill,
border, font, weight -- save it under a name, and from then on a click applies that exact look to
any selected topic, in this map or any other. "Our decision nodes look like *this*" stops being
something you redo by hand; the styles you save are kept app-wide, so a visual language you settle
on follows you across the whole library.

**Conditional formatting** goes further and styles nodes *by what they are*. Write a rule --
"anything tagged `risk` gets a red border", "anything 100% complete goes grey", "every node with a
❗ marker turns amber" -- and the map applies it everywhere, live, and keeps applying it as you
edit. The triggers reach well past tags: a rule can fire on a marker, on completion, on being
**overdue** or **due soon**, on a **priority** threshold, on the topic's **text**, on carrying an
**attachment**, or on having a **relationship** of a given type -- and conditions can be chained
with **AND** and inverted with **NOT** ("tagged `q3` and *not* completed"). A rule can also apply
a **marker** or a **branch colour**, not just a fill. Where a named style is a look you *apply*, a
conditional rule is a look that *follows the data*: tag a new node `risk` and it goes red without
your touching the Style bar. On a big, changing map that's the difference between formatting you
maintain and formatting that maintains itself.

Two smaller tools round out the systematic kit. The **Format painter** copies one topic's look
and pastes it onto any selection -- reuse without the ceremony of naming a style. And
**Auto-colour branches** repaints every top-level branch a distinct colour from the current
theme's palette in one click, the fastest way to give a grown map a legible colour structure.

## Rich text: emphasis inside a topic

Styling paints the whole node; sometimes you want to stress just a word or two *inside* the
label. While editing a topic, **Ctrl+B**, **Ctrl+I**, and **Ctrl+U** bold, italicise, or
underline the selection -- the same muscle memory as any editor -- and a small **floating bar**
above the topic offers the same three plus a row of **text colours** for the mouse path. Reach
for it sparingly: one bold word that names the decision, an italicised term you're defining. The
plain text is kept underneath, so your outline and every flat export stay clean even when the
canvas is dressed up. (A **Spell-check** toggle in the View menu turns the editors' squiggles on
or off map-wide -- off is a mercy on a map full of product codenames.)

## Callouts: a note that points

A **callout** is a small sticky note pinned beside a node -- a caveat, an open question, a
"revisit this" -- without promoting it to a child topic. Right-click a node, choose **Add
callout**, then double-click the bubble to write in it. Unlike a note, which lives *behind* the
node one click away, a callout sits *on the canvas*, visible at a glance and drawn into your
image exports -- the right tool for the one remark a reader must not miss. Like markers, their
power is in scarcity: a map speckled with callouts has none.

A boundary, a summary bracket, and a callout each carry their own **colour**. Select one and the inspector offers a small row of swatches plus a **Default** button; the colour you pick re-tints the whole object -- its outline, fill, and label together -- on the canvas and in every export, and **Default** drops it back to the theme's accent. Use it the way you use everything else here: to *encode*. Tint the "out of scope" boundary grey and the "this release" one green and a reader sees the split before reading a word; leave the rest on the default accent so the two coloured ones carry the meaning.

## Themes: the whole canvas at once

Where per-node styling is a scalpel, a **theme** is a coat of paint for the entire map.
The theme gallery offers a few presets -- **Light**, **Dark**, **Ocean**, **Sunset** --
each a coordinated palette for the background, branches and text. Dark themes read well
on a projector in a dim room; light themes print cleanly. Switching theme never touches
your content, so try a few and keep whichever helps you see the map. When the presets
aren't yours, **Manage themes...** opens a small designer: name a theme, pick its
six-colour branch palette, background, font and branch weight, and it joins the gallery --
exportable as a file, so a house style travels between machines. (The canvas theme is
separate from the *app's* chrome, which follows your operating system's light/dark setting
-- or force it in Settings.)

One level up again, the Map panel's **Design gallery** applies a whole coordinated look --
theme, connector style, branch weight, accent -- in one click: the "make it presentable" button
for when the content is done and the meeting is soon. The same panel's **More styling** section
sets the map's **typography**: a base **font** (Sans, Serif, or Mono) and a **text size**
(Compact, Comfortable, Large) for the whole map, which any per-topic font or size still
overrides. A serif base reads like a document; Compact buys a large plan another dozen visible
topics.

The **Canvas** colour control sits one notch below a theme: it overrides just the background of
*this one map*, leaving the theme's branch and text palette intact. It's a quiet but useful signal
when you keep many maps -- a faint green wash on the "ideas" map, a warm one on "risks" -- so you
know which map you're in at a glance. The colour saves with the map and follows it into an image or
PDF export; the **✕** clears it back to the theme.

Right beside it, the **🖼** button goes a step further and lets you drop a whole **image** behind the
map -- a faint grid, a watermark, a photograph of the whiteboard you're rebuilding, your team's brand
backdrop. Pick a file and it fills the canvas behind every topic, sitting on top of the background
colour (so a transparent PNG lets that colour glow through the gaps). The picture is shrunk to a sane
size and tucked inside the map itself, so the map stays a single portable file you can open offline --
and, like everything else here, what you see is what you get: the backdrop travels into your SVG, PNG,
PDF and HTML exports unchanged. Use it sparingly, though; a busy photo behind your topics fights the
words for attention, and the map is there for the words. The second **✕** lifts the image back off.

## A note on restraint

Every feature in this chapter can be overused. The test is always the same: *does this
make the map easier to think with?* A note that captures a decision -- yes. A marker
convention a team shares -- yes. Six fonts and a gradient on every node -- no. The most
useful maps are usually the plainest ones with enrichment applied exactly where it
carries meaning.

One quiet piece of bookkeeping needs no decision from you at all. Select a node and open its inspector -- the **ⓘ** in the small action bar above it -- and the header shows, in faint text under the breadcrumb, when the topic was **created** and last **modified** -- "created 3 d ago, modified 2 h ago", and a plain date once a change is more than a week old. You never set these; the map keeps them. They earn their place when a map outlives the meeting that made it: glancing at a branch and seeing it hasn't been touched in a month tells you whether it's settled or stale before you reopen the argument.

## Now you try

Take a node that's carrying too much in its label and move the detail into a **note** (open
the Notes panel and write a sentence or two in Markdown). Shorten the topic to a handful of
words. Then agree a tiny **marker** convention with yourself -- say, a flag for "blocked"
and a tick for "done" -- and apply it to three or four nodes. Read the map again: the canvas
should be more scannable than before, with the depth one click away. If you reach for a
fifth marker colour, stop -- the small vocabulary is the point.

Now add a layer of meaning. Attach an **image** to one node -- a screenshot or a logo -- and
watch it render inline. Pick three related nodes (say, the ones that represent decisions) and
give them a shared **fill** from the Style bar so the pattern reads at a glance; bump your
headline branch's **font** up a size so the eye starts there. Finally, open the **theme**
gallery and switch between Light and Dark -- your content doesn't change, only its coat of
paint, so keep whichever helps you see the map. The rule throughout: styling that *encodes*
something earns its place; styling that merely decorates doesn't.

Finally, dress one topic up *inside* its label -- bold the single word that names what it is
(**Ctrl+B** while editing) -- and pin a **callout** to the node you're least sure about,
holding the question you still need to answer. Notice how differently the two read: the bold
word is part of the idea; the callout hovers beside it, plainly a comment on the work rather
than the work itself.

Finally, make a node carry *work*, not just words. In the **ℹ Info** panel give a topic a **due
date** and drag its **progress** to half-done -- watch the parent branch show the rolled-up total
and the canvas flag anything overdue. Then open the **🎨 Styles** panel, write one **conditional
rule** (tag a node `risk`, have the rule paint it red), and add that tag to a second node: it turns
red on its own. That's the chapter in miniature -- a node that tracks its own status, and
formatting that follows the data instead of waiting for your hand.

Two more passes turn a handsome map into a working one. Give a topic a **priority** -- 1 for
High, down to 9 for the barely-urgent -- then switch on the priority filter and watch
everything below your cut-off fade; that is triage in two clicks. Pick a font that suits the map's register -- the Styles bar
offers **Sans, Serif, or Mono** per topic -- and, once a node looks exactly right, **save its look
as a named style** and drop that style onto its siblings so the set moves as one. Hang a real
**file** off a topic -- a spec, a slide deck -- and it travels inside the map, downloadable
whenever you reopen it. Reach into the **sticker** library when a small picture says more than a
label would. And if the canvas itself wants a mood, give the whole map a **background colour**, or
a faint background **image** behind everything -- it renders the same in every export, so what you
arrange is what you ship.

One more pass, this time on a group. Select three or four nodes at once -- the Markers palette switches to **bulk** mode. Click a marker and watch it land on the whole selection; notice that a chip already on *all* of them reads **lit** (click to clear all) while one on only *some* reads **dashed** (click to add to all). Add a **tag** across the same selection the same way. Then pin a **callout** and open its inspector: give it a **colour** from the swatch row so the remark reads as deliberately set-apart, and try **Default** to drop it back. Finally, just look at a node's inspector header -- the faint **created** and **modified** line is there without your having lifted a finger, and on an old map that one glance tells you what's still alive and what has gone quiet.

A last pass for this chapter's quieter tools, in one loop. Hover a noted topic's **📝** and peek
the note without opening anything; **drag** a marker from the palette onto a topic you haven't
even selected; give one node a **branch-colour tint** and set a **wrap width** on your longest
label so it folds instead of stretching. Then run a checklist from the canvas: hover three topics'
left edges and click the **checkbox** through to-do and done. Finally, right-click your plan's
top node and **shift its task dates +1w** -- the whole branch slips together, gaps preserved --
and **Ctrl+Z** the slip away again. None of these needed a panel; the canvas was the interface.

The next chapter is about the opposite problem: when a map gets big, how do you keep
finding your way around it?
