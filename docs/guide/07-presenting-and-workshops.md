# Presenting and workshops

### The library, templates, walk-through mode, and running a room

A map is often built to be shown. This chapter covers the features that turn a private
canvas into a shared session: managing many maps, starting from the right template,
presenting branch by branch, and the offline reliability that lets you do it anywhere.

## The library: many maps, one app

MindMap Studio keeps a **library** of named maps in your browser. The map switcher in
the toolbar moves between them; **+ New...** starts another; you can **duplicate** the
current map (to try a variation without risking the original) and delete ones you're
done with. Because each map is independent and locally stored, the library is your filing
cabinet -- one map per project, per meeting, per idea -- with cross-map links (Chapter 5)
tying related ones together.

As the cabinet fills, the Start screen's **All maps** view keeps it navigable: a **search box**
filters by title, **pinned** maps float to the top of every list (star the handful you live in),
and named **folders** group the rest -- a map lives in one folder or none, and deleting a folder
releases its maps rather than taking them down with it. Deleting a *map* is just as forgiving:
it's a soft delete into the **Trash**, where it waits until you restore it or empty the trash for
good. Two commands keep the maps themselves well-factored: **New map from this topic** promotes
an overgrown branch into its own map, and **Insert map as branch** grafts a small map back into a
bigger one.

## Templates: a running start

A blank canvas is the right start for a freeform brainstorm. For everything else, **+
New...** offers templates:

- **Blank** -- a single root, for when the structure is entirely yours.
- **Brainstorm** -- the central idea with the six question-branches from Chapter 2.
- **SWOT** -- Strengths, Weaknesses, Opportunities, Threats, ready to fill in.
- **Project plan** -- Goals, Scope, Milestones, Risks, Team.
- **5 Whys** -- a nested root-cause chain; **Decision** -- pros and cons side by side;
  **Retrospective** -- Start / Stop / Continue; **Meeting notes**; and **Pre-mortem** --
  "it failed: why?"

A template is just a starting structure you then make your own; its value is saving you
the first thirty seconds of "what were the boxes again?" and nudging you toward a
complete frame. (Mid-map, the same frames are available as **map parts** -- **Insert -> Map
parts** drops a SWOT, a pros-and-cons pair, a 5W1H, or a meeting agenda *under the selected
topic*, so a framework can be a branch, not only a map.)

Where a template is an *empty* frame, the **Examples** group in the same **+ New…** menu
gives you twenty *complete*, worked maps -- a filled launch plan, a sprint retro, a worked SWOT,
a flowchart, a whiteboard, a trip itinerary, a study map, a **GTD Areas of Focus** overview
(Chapter 8 builds its atlas pattern on it) -- to open and adapt rather than build
from scratch. They're the fastest way to see what a finished map looks like, and to learn a
feature by reading one that uses it.

## Time-boxing a brainstorm

Ideas come faster under a gentle clock. The **brainstorm timer** in the toolbar is a small
time-box: pick a length -- a few minutes -- start it, and generate hard until it rings. A divergent
sprint ("every idea, no judging, go") works far better with a visible countdown than an open-ended
"let's brainstorm", and a workshop gets a shared rhythm from it: sprint to capture, stop to cluster
and prune, repeat. It's a nudge rather than a rule -- but the nudge is most of why time-boxing
works.

## Walk-through presentation mode

When it's time to present, **Present** enters a focused **walk-through** mode. Instead of
showing the whole map at once and asking the room to find the thread, walk-through moves
through the map branch by branch, framing each in turn, so attention follows you. Combined
with a dark theme (Chapter 4) and a collapsed starting view (Chapter 5), it turns a dense
canvas into a guided tour: open the branch under discussion, talk to it, move on.

Presenting from the map itself -- rather than a deck exported from it -- keeps the
single source of truth live. A question sends you to a different branch; an idea from the
room becomes a node on the spot. The map is the slides *and* the working document.

Two stagecraft keys are worth knowing before the lights come up: **B** drops a black curtain
over everything and **W** a white one -- the classic "eyes on me, not the screen" move -- and any
key or click lifts it.

### The guided walk: touring the live canvas

Present turns the map into slides; the **guided walk** keeps you *on the canvas*. Start it
(**Guided walk** in the menu, or from the command palette) and a small bar appears: each step
spotlights one topic in reading order, dimming the rest, with that topic's **note** shown as your
talking points and the arrow keys stepping forward and back. Because it's the live canvas, you
can stop mid-walk, edit the node under discussion, and walk on. A **cinematic** toggle on the bar
swaps the flat step for an animated zoom that frames each branch as it arrives -- the difference
between a laser pointer and a camera move; the app remembers which you prefer. Reach for the walk
in working sessions, where the map must stay editable; reach for Present when the room expects
slides.

### Presenter view: what only you see

A slide is for the room. But you, the presenter, usually want more in front of you: the
point you meant to make, where you are in the running order, and what's coming next. Press
**P** (or click **Presenter view** in the control bar) and a sidebar opens beside the slide
with exactly that -- visible to you, invisible to the audience, who still see only the slide.

Four things live in that sidebar. Your **speaker notes** come first: whatever you wrote in
the current branch's note (Chapter 4) shows here, formatted, so your talking points travel
with the map instead of on a separate sheet -- and if a slide has no note, it simply says so.
Below that, **Next up** names the slide you're about to advance to, so you can set up the
transition before you make it -- or see "End of map" and know to land the close. A **Timer**
keeps you honest: an elapsed clock runs in the footer for the room, and here you can give the
talk a **budget** in five-minute steps -- the clock stays green while you're comfortably inside
it, turns amber in the final stretch, and red once you're over, with a "-2:30 left" readout that
makes pacing a glance rather than arithmetic. Last is the
**Agenda**: the map of your whole talk, every slide in order with the current one lit and a
"3 / 8" marker for your place in it. It's not just a readout -- click any line to jump
straight there, which is how you handle the question that belongs three branches away and the
"can you go back to that one?" without losing your footing.

It all sits on one screen -- there's no second window to wrangle -- and toggling it changes
nothing for the room. Press **P** again to hide it. The habit worth forming: before you
present, drop a sentence or two into the note on each branch you'll speak to. When the lights
are on you, your script is already there.

## It works offline, and it installs

MindMap Studio is a **progressive web app**. The first time you load it, it caches its
own shell, so afterwards it opens and runs with **no network at all** -- on a plane, in a
basement meeting room, anywhere. You can also **install** it to your desktop or home
screen, where it launches in its own window like a native app. For a tool you might open
to capture a thought the instant you have it, "always available, never loading" matters.

Because it caches itself, it also **updates itself politely**: when a new version ships, the
running app shows a small "new version available -- Refresh now" prompt rather than reloading
under you mid-thought. Click it when you're ready; an in-flight edit is never lost.

## On the device in your hand

Because it's a web app, it goes where you do. On a **phone or tablet** the layout adapts -- the
toolbar compacts to a scrollable strip and the side panels rise as a **bottom sheet** instead of
squeezing the canvas -- so you can capture an idea or pull up a map on the move and open it on a
laptop later. Same app, same maps, sized for the screen you're holding; paired with the offline
caching above, it makes "the map is wherever I am" simply true.

Two switches make a small screen work harder. **Full screen** (the ⛶ button in the phone's top
bar, or **View → Full screen** anywhere) hides every toolbar, tab and breadcrumb so the map gets the
whole window; one button in the corner brings them back, and on Android and desktop the browser's
own bars go too. And the **🔒 lock** puts the app in **read-only mode**: you can pan, zoom, fold
branches, search, present and export, but not change anything -- the editing menus and the buttons
on topics disappear, and a stray tap or drag can't move or retype a topic. Turn it on before handing
your phone across the table, or when you're reading a map rather than building it; it stays on as
you switch maps until you unlock it.

## A room you can't choose

Present often enough and you'll meet the projector that washes colour out, the huge screen where
every animated pan swings like a camera crane, and the colleague for whom motion is genuinely
unpleasant rather than slick. Two settings (**Ctrl+,**, under Appearance) exist for exactly this.
**Reduce motion** makes zoom, fit, and the guided walk *instant* instead of animated -- set it to
**On** for the big screen or a motion-sensitive audience, or leave it on **System** and it follows
each viewer's own operating-system preference. **High contrast** strengthens borders, dividers,
text and focus rings the same way -- **On** for the washed-out projector, **System** to respect
the reader's setting.

The canvas also carries its structure where sight doesn't reach: the overlays that exist only as
drawings for sighted readers -- relationships, boundaries, summaries, callouts -- are exposed to
**screen readers** as navigable lists ("from Budget to Risk", with the label), so the map's
cross-links survive the trip into assistive tech. None of this needs to matter until the day it's
the only thing that does; it's the difference between a map you can present and a map anyone can
be presented to.

## Back up the whole library

Individual maps export as JSON (Chapter 6). The whole **library** can be backed up and
restored in one operation -- a single file with every map in it. Run a backup before a
big reorganisation, before switching machines, or just on a schedule you trust. It's the
belt to local storage's braces: your maps live on your machine, and a backup means a
machine is not a single point of failure.

## Running a session: a short playbook

1. **Before:** build or open the map; **collapse all** so it opens at altitude; pick a
   theme that suits the room.
2. **Open:** **Fit**, then enter **Present**.
3. **During:** walk branch by branch; capture new ideas as nodes as they come; use `/`
   to jump when the conversation does.
4. **After:** export to **PNG** or **PDF** for the recap; export **JSON** or run a
   **library backup** to keep the working map safe.

## Now you try

Start a new map from the **SWOT** template. It opens with four branches ready to fill:

<!-- DIAGRAM:swot -->

Pick something real -- a product, a project, a decision -- put it in the centre, and spend
ten minutes filling each branch. (Start the **brainstorm timer** for those ten minutes -- a visible
countdown makes the sprint sharper than an open-ended "let's fill it in".) Don't aim for a long
list; aim for the *honest* three
items per branch. Then look across the four: does an Opportunity answer a Weakness? Does a
Threat undercut a Strength? Those cross-links are where a SWOT stops being four lists and
starts being analysis -- draw a **relationship** arrow for each one you find. That move,
more than the lists themselves, is the thinking.

Then rehearse the room. **Duplicate** the map so you can experiment freely, switch back to
the original from the map switcher, and hit **Present**: walk-through frames each branch in
turn -- arrow keys to move, the room's attention following yours, one branch at a time. Press **P**
to flip on the **presenter view** -- your speaker notes, the next slide, and the agenda on your side
of the screen only, the room still seeing just the slide. When you're done, run a **library backup** -- one file holding every map, the belt to local
storage's braces -- and, if you haven't already, **install** the app to your desktop so it's
one click away and runs with no network.

Before you leave the stage, try the other one. Start a **guided walk** and step the spotlight
through your SWOT with the arrow keys -- edit a node mid-walk to feel that the map stays live --
then flip the **cinematic** toggle and watch the step become a camera move. Back in **Present**,
open presenter view and give yourself a ten-minute **budget**: the clock runs green, amber, red
as you talk, and **B** blanks the screen when you want the room's eyes on you.

And once, before a real session, open **Settings** and flip **Reduce motion** to On, then step
three slides -- the spotlight now *cuts* instead of glides. Some rooms want the glide; some
want the cut; know which switch gives you each.

Prefer a running start over a blank SWOT? Open an **Example** instead (**+ New… → Examples**)
-- a filled launch plan, a retro, a trip, a worked SWOT -- and adapt it. Same skills, less
blank page; it's also the quickest way to see a feature used in anger.

That's the whole tool, end to end -- from a single node in Chapter 1 to a map you can
think with, enrich, navigate, share and present. One chapter remains, and it's about
none of the buttons: Chapter 8 takes the method itself and applies it, job by job, to
the work you'll actually bring to a map.
