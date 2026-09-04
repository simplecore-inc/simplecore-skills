# Scaling: the kit in the skill, a pattern, and a board of pure content

Read past roughly twenty frames, or once the same nav / titlebar / status bar would be
hand-copied into every frame.

One file becomes a wall of grey that neither a person nor an LLM can navigate, and every chrome
edit is a find-replace across the whole board. At that size, the board is authored as a small
**source tree that builds into the same deliverable** — every file it writes is self-contained,
offline, and no-JS bar the index's navigation aids and its width handle. Splitting the SOURCE
changes nothing a reader receives. Splitting the OUTPUT is a separate decision a board makes for
itself, several hundred frames later, and § Splitting a board along a declared axis is where it is
made.

## The board writes no tools

**The machinery lives in this skill, under `kit/`, and the board holds only its own content.**
That is the whole shape, and it is what stops every project from forking a build that then has to
be migrated by hand each time the skill moves.

```
kit/
  bin/wfb.mjs             one command line: build · catalog · check · gates · coverage ·
                          pdf · shots · doctor · migrations · patterns · init
  core/
    context.mjs           loads a board: settings, pattern, screens
    build.mjs             the build
    partials.mjs          frame() · sidebar() · page(), bound to a pattern by makePartials()
    contract.mjs          the standing reading-contract items — the layer nothing may drop
    migrations.mjs        what each contract changed, and the steps to cross it
    gates/                the gates true of ANY board
    check/                inspect · the gate self-tests and their cases
    export/               pdf · shot · watermark
    serve.mjs             build · watch · serve, for drawing with the board open in a browser
    templates/            wf.mjs, dev.sh and AGENTS.md, as a new board receives them
  patterns/<name>/
    pattern.mjs           what the pattern is, what it requires, which gates it adds
    components.mjs        the composition kit + CATALOG
    chrome.mjs            the app-shell FACTORIES
    styles.css            the class vocabulary
    intro.html            the reading-contract items true of every board drawn this way
    gates/                the gates true of every board drawn this way, with their cases
    examples/             a starter board — the frames `init` copies
```

A board, in full:

```
board.config.mjs   the pattern, the contract, the PDF name, phases, feature keys, documents
board.gates.mjs    gates true of this repository only, with their cases          (optional)
wf.mjs             twenty lines that find the kit and hand over
dev.sh             one line onto `wf.mjs serve` — the loop a board is drawn in
src/manifest.mjs   the table of contents and build order
src/screens/       one file per screen
src/chrome.mjs     THIS product's tabs, menu tree, roles, purchase → the shell factories
src/components.mjs one line re-exporting the pattern
src/crud.mjs       the CRUD ledger                                               (optional)
src/roles.mjs      who reaches which cluster                                     (optional)
src/intro.html     the reading-contract items that are this product's own        (optional)
src/styles.css     what this board adds to the pattern's stylesheet              (optional)
```

One manifest entry may declare `badges: ['mark', …]` for short review-only classifications that
belong in the screen-list sidebar but not in the product frame — for example, an RFP-external
proposal or an AI-assisted calculation. These marks do not mean `phase` (when it is built) or
`feature` (what must be bought), never appear inside the device, and must be derived from a named
project document rather than used as free-form decoration.

## Drawing with the board open: `./dev.sh`

`./dev.sh` (that is `node wf.mjs serve`) builds the board once, serves it at
`http://127.0.0.1:4173/`, and rebuilds it whenever `src/`, `board.config.mjs`, `board.gates.mjs`
or the pattern changes. The open page reloads itself and comes back to the scroll position it was
at, which on a several-hundred-frame board is the difference between iterating on a frame and
hunting for it again after every save. `--port` · `--host` · `--open` · `--no-watch` · `--pdf`
adjust it; the PDF is off by default because nothing the browser shows comes from it.

**Two properties are what make this safe to leave running.**

- **The live-reload client is spliced into the HTTP RESPONSE and written to no file.** `board.html`
  on disk stays the single self-contained file with no script beyond the index aids — open it from
  the file system, attach it to a mail, and it is exactly what the build wrote. A dev server that
  wrote its client into the artifact would put an external dependency into the one file that must
  not have one, and nothing in the board would show it.
- **Every rebuild is a child process.** A screen file is an ES module and Node caches modules by
  URL for the life of a process, so rebuilding in the server's own process would go on drawing
  whatever was on disk when it started — reporting the same screen count and the same success
  while showing yesterday's frame. That failure is invisible from the browser, which is why the
  spawn is worth more than the milliseconds it costs.

A build that fails reaches the browser as the build's own output — the gate that refused, the
screen file that would not parse — and the last good `board.html` stays on disk, so the reader is
never shown a stale frame as though it were current.

## A common pattern is what a new board chooses

A pattern bundles the components, the app shells, the stylesheet, the reading-contract items and
the gates that hold a way of drawing. Choosing one is the first question `/simplecore:board-init`
asks, because it decides what every frame is composed from and held to; changing it later means
redrawing the board.

`simplix-basic` covers desktop, phone and tablet **in one pattern** — a console, the phone app its
users carry, and the shared terminal are one product, sharing components, copy register, control
vocabulary and CRUD discipline. Splitting them would mean deciding, per gate, which of the three
it belongs to: a boundary the product itself does not have.

`penstock-console` draws an **application window** rather than a page: a fixed 1440×900 window
whose panes scroll inside themselves, with the penstock console's shell — title bar, navigator, work
pane, inspector (selection above, activity below), status bar — and the installed program's own
window (`url: 'app:<title>'`) and tray menu (`url: 'none:'`) in the same pattern. It was promoted out
of the RAG Studio board, where it was drawn first; every product-bound piece (brand, navigation tree,
palette, status bar, sample activity) comes from the board's `src/chrome.mjs` through `makeChrome`,
and the board's `src/components.mjs` re-exports the pattern's primitives and that bound chrome so a
screen imports both from one place. Pick it for a desktop tool or a browser app that behaves as one;
pick `simplix-basic` for a page-scrolling console with a phone app and a terminal beside it.

`node <kit>/bin/wfb.mjs patterns` lists what is installed.

### A board may carry its own pattern, and that is the last resort

**A component the pattern does not have goes INTO the pattern, never into a file inside the
board** — added to the pattern it reaches every board drawn that way, added to a board it reaches
one. That rule assumes the product and the pattern are the same shape.

**Where they are not, the rule has nowhere to send anybody.** A product whose component vocabulary
is mostly its own — most of its names in no shipped pattern — cannot put them in a shipped
pattern, because they would be dead weight in every other board on it. Without a third path such a
board stays outside the contract, where no gate reaches it and the kit cannot build it at all,
which is the worst of the three outcomes.

**So `pattern` in `board.config.mjs` takes a PATH as well as a name.** A name is a pattern the kit
ships; a path beginning with `.` is one the board carries and commits.

```js
pattern: 'simplix-basic'   // the kit's
pattern: './pattern'       // this board's own, committed beside src/
```

**Two procedures, and which one depends on where the board's components are now.**

| The board | Command | What happens |
| --- | --- | --- |
| already drawn in a shipped pattern | `node wf.mjs pattern fork` | copies that pattern — `pattern.mjs`, `components.mjs`, `styles.css`, `intro.html`, the gates — into the board, renames it, re-points the config and the shim, and rewrites what the copied files import from the kit so they reach it through the board's `.kit` link |
| from before the contract, drawing with its own `src/components.mjs` | `node wf.mjs pattern adopt` | moves `components.mjs`, `styles.css` and `intro.html` up out of `src/`, writes a `pattern.mjs` around them, leaves the one-line shim every screen already imports, and points the config at it |

**`adopt` is the one a migration needs**, and forking would be the wrong move there: a board with
94 primitives of its own would receive a hundred it does not draw and still have its own outside
the pattern. Nothing is rewritten and nothing is discarded — the files move up one level and a
`pattern.mjs` is written around them.

Either way the board builds and its gates run; what changed is who owns them.

**The cost, and why this is last rather than first.** A forked pattern stops receiving the kit's
improvements to the pattern it came from — a component added there, a gate tightened there, a
stylesheet fix there, none of them arrive. One or two missing components is not a reason to fork;
it is a reason to add them where the second product drawn that way will get them.

## What may enter the kit, and in the shape it enters

**Everything the kit gains is true of any board, or it does not enter the kit.** The gate table
below states this for gates; it holds for every other kind of addition — a second output file,
a piece of page chrome, an export format, a control the reader operates. Three questions, and a
capability that fails any of them is a board's own or a pattern's, never the kit's.

**① Would another board want the capability?** Not the values — the capability. A product that
splits its board along some axis of its own is one product; *splitting a board along a declared
axis* is something any board past a few hundred frames wants. Where the answer is genuinely no,
it belongs in `<board>/board.gates.mjs` or in a forked pattern, and the cost of forking is the
section above.

**② Does its shape carry the product's vocabulary?** This is where a general capability still
lands wrong. The kit learns `split` — a declaration naming a module that answers 「which part
does this screen belong to」, the parts' order, and each part's label — and it never learns what
those parts are called in any product. A field named after one product's concept, a default whose
values are that product's values, an enum of its parts: each of them is the project-specific
hardcoding rule one level up, and each produces a kit that reads wrong in the second product to
use it. **Write the capability with placeholders — `<part>`, `<axis>`, `<label>` — and let
`board.config.mjs` supply every word a reader will see.**

**③ Does a board that declares nothing keep building exactly as before?** Every addition is off
until a board switches it on. A default that changes an existing board's output is a migration,
and a migration is a `BOARD_CONTRACT` bump with an entry — not a quiet improvement. The board that
declares no split still builds one file, with the same name, at the same path.

**The same three questions decide where a value lives.** What the kit holds is the mechanism and
the interface; what `board.config.mjs` holds is every value a product chose — the axis, the part
names, which parts go in which volume, what the nav calls them. A value that reaches the kit is a
value the next project has to fork the kit to change.

### A reader that names helpers by hand cannot see one added later

**A helper added to the kit is invisible to every enumeration outside it.** The kit does not know
who reads what it draws — a project's generator deriving what each frame owes, a board's own gates,
a report counting what got drawn. Each of those holds a list of helper names, and a list typed by
hand is fixed on the day it is typed. The helper arrives, the list does not grow, and the reader
goes on reporting the number it reported before.

**The number is what makes this quiet.** A reader that says `366 matched` has said nothing about
the rest, because there is no other side to that count — a frame drawing a helper nobody named is
not unmatched, it is unseen. A language strip drawn across 38 frames asked no demand of any of
them, and the report that should have caught it read exactly like a clean one. **A checker that has
never met its case reports what a clean repository reports.**

**So a reader over kit helpers derives its list from the board's own sources and partitions it,
rather than matching against names somebody typed.** Enumerate the helper calls the frame sources
actually make, then split them three ways and print every name:

- **read** — which reader names it, and what it demands;
- **deliberately not read** — with the reason held as data in the file rather than as a comment, so
  the report prints it beside the name;
- **residue** — everything else.

A helper added tomorrow lands in the residue by itself, which is the point: nobody has to remember
to tell the reader. `366 read · 211 deliberately not read via <helper> · 0 unaccounted` is the
shape that could not have hidden the language strip; `366 matched` is the shape that did.

**It warns and never fails the build.** Most helpers draw something no demand should ask about, so
a new one is not a defect. Failing on residue teaches whoever meets it to add an exclusion entry
without reading it, which is the same silence wearing a different face. What must be impossible is
a helper going unmentioned.

**A reader that exists and does not reach is the same silence as one that is absent.** The
partition above says whether a helper is read; it says nothing about whether the reader that names
it ever comes back with anything. A reader keyed to three of a helper's four kinds runs on every
frame, matches the helper by name, returns empty on the fourth, and is counted as a reader the
whole time — 544 frames of 654 reached, and the 110 that drew a message whose title nothing
demanded look exactly like the 544 in every count that does not compare the two. **So the census
reports reach beside membership**: frames whose field came back non-empty over frames that draw the
helper, counted only over the frames that draw it, because a reader is not answerable for a frame
that never called it.

**A reader also has to walk where the helper is drawn.** A helper drawn only on state frames is
invisible to a walk over base frames, and the reader written the obvious way reaches zero — which
looks exactly like a reader nobody wrote. That is the same signature as a helper nobody named,
reached from a third direction, and the count that would distinguish them is the one the reader
does not print. **Say which frames a reader walks where it is not every frame**, and let its reach
be counted over the frames that draw the helper rather than over the frames it happened to visit.

**And the module list a census reads from is checked rather than assumed.** A frame taking a named
import from a fourth module is outside the whole partition, and the count of those is printed even
when it is zero — a population defined by three modules is a claim about the board, not a fact
about it.

**The reader lives with whoever holds the demands, never in the kit** — § *Three places a gate can
live, and the test that decides* settles which of the three. The kit knows what it draws; only the
reader knows what it meant to ask about.

## Splitting a board along a declared axis

**A board past a few hundred frames may be written as several files.** The kit knows only that a
board may name a module answering 「which part does this screen belong to」; what the parts are,
what they are called and which of them share a volume are the board's words, declared in
`board.config.mjs`. A board that declares nothing writes `board.html` and nothing else.

```js
split: {
  module: '../scripts/<placer>.mjs',       // the kit imports it; no placement is restated here
  part:  { call: '<export>' },             // frame id → a part key
  group: { call: '<export>', key: '<field>', label: '<field>', mark: '<field>', order: '<field>' },
  tag:   { call: '<export>', mark: '<field>', label: '<field>' },
  entry: { file: 'board.html', nav: '<what a reader calls the whole board>' },
  parts: [{ key: <key>, file: '<name>.html', nav: '<what a reader calls this part>' }, …],
  volumes: [{ parts: [<key>, …], name: '<marker in the PDF file name>', title: '<cover>' }, …],
}
```

- **`part` decides the file.** Every frame the board draws has to be placed and every declared
  part has to hold something — `splitPlacementGate` refuses a build where either fails, because
  an unplaced frame lands somewhere by fallback and an empty part ships a file promising screens
  that are not in it.
- **`group` decides the sections INSIDE one file**, and is optional — most boards want the
  default. **A reader navigates by what a screen is ABOUT**, and the board's own lettered clusters
  already are that axis, so with no `group` they are kept, filtered, and left in the manifest's
  order. What a split does to them is cut some in two, and the answer to that is the count: a
  section holding part of its whole says so beside its title, so nobody takes a fragment for the
  lot. Declare `group` only where a board's clusters are genuinely not what a reader looks by;
  the page and the index are built from one ordered list either way, so they can never disagree,
  and `order` names the field that sorts them.
- **`tag` puts an axis on the frame instead of arranging anything by it**, and is optional. A
  board splitting by one answer and grouping by another leaves a third that the placing module
  knows and neither shows — often the one a BUILDER needs rather than a reader. It rides beside
  the id, in the index and on the frame label both, the way the phase and feature chips already
  do; the index filter reaches it, so typing its mark gathers that axis's frames on a board
  arranged by something else.
- **The entry page draws no frame.** It carries the nav row, the opening overview, a card per
  part, and — as its sidebar, where the filter is — the index of every frame on the board, each
  row linking `<file>#<anchor>`. That is what keeps 「one search finds any frame」 true.
- **`volumes` decide the PDFs**, one per volume rather than one per file: a volume gathers several
  parts, so its pages are assembled from the same documents the build assembled and rendered from
  a scratch file. With no `volumes`, one PDF is rendered from the entry page.
- **The reading contract ships on every file**, entry page included, and gains one item naming how
  many files there are and where the index is. A reader handed one file is the whole reason.
- **`wf.mjs check` and `wf.mjs shots` open every file and report once.** A sweep that stopped at
  the first would go quiet on the rest, which reads exactly like a clean board.

## Three places a gate can live, and the test that decides

| | Holds | Lives in |
| --- | --- | --- |
| **core** | true of any board — the permanent id, balanced markup, a leaked value, reachability, a declared document disagreeing with the board | `kit/core/gates/` |
| **pattern** | true of any board drawn this way — the copy register, list-detail discipline, the control vocabulary | `kit/patterns/<name>/gates/`, or the board's own pattern folder where it forked one |
| **board** | true of this repository only — a document format this project chose, a data shape it invented | `<board>/board.gates.mjs` |

**`node wf.mjs gates` asks two questions about that set, not one.** A gate with no case is named,
and so is **a gate no list reaches** — written, greppable, and run by nothing. The second exists
because `CORE_GATES` is ordered by hand on purpose (cheapest refusals first, the three that read
the rendered HTML last), and the cost of a hand-written list is a gate that falls off it. Either
one fails the command.

**Ask whether it would still be right on somebody else's board.** A gate one level too high fires
on boards it does not describe; one level too low is rewritten by the next project that needs it.

Every finding refuses the build — no warn level, no lenient mode. **A gate gets its two cases in
the same change**, in the case file beside it, and `wf.mjs gates` names any gate that has none.
The cases are built from a **fixed fixture config**, never from the board's own settings: a case
that reads `config.today` passes on the board that declared it and fails everywhere else.

## The board carries the contract number; the kit carries what it means

`board.config.mjs` declares `contract:`, and `kit/core/migrations.mjs` records, per version, what
changed and the steps to cross it — written when the change is made, while the reason is still in
hand. `wf.mjs doctor` compares the two and prints the steps in between; a board that is behind is
**refused**, not warned, because the steps change what a screen file may say and where the
components live, and a build that keeps going draws half the board each way.

Add the migration entry in the same change that bumps `BOARD_CONTRACT`. A bump without an entry
leaves every board with a number it cannot act on.

## A permanent id, and a position that moves

A frame carries two numbers, and keeping them apart is what makes a board possible to talk about:

| | Where it comes from | When it changes |
| --- | --- | --- |
| **Id** — `A-20` | the file name (`a-20-contract-detail.mjs`) | never |
| **Position** — `[02]` | the manifest order, recomputed every build | on any reorder |

The label prints them together as `[02]A-20`: the position so a reader scanning the board can see
where they are, the id because that is what they were given. The sidebar and the anchor use the
id, so a link into the board survives a reorder.

**The id is permanent, and that is the whole point.** It is assigned once, when the screen is
born, and survives insertion above it, reordering, and the deletion of neighbours. Everything that
outlives a build — a plan, a parity list, a review note, a message to a person — names screens by
id and stays correct. Never renumber to close a gap: gaps cost nothing, and a renumber invalidates
every reference anyone wrote down.

Because the id lives in the file name there is exactly one source for it. The build refuses on a
missing id, a section-letter mismatch, or a duplicate that is not one screen's two viewport
halves. **A narrow/wide pair is one screen** — both halves share the id and the position and
differ only by `variant`.

Adding a screen is one file under `src/screens/` plus one line in the manifest. A note points at
another screen by FILE NAME (`{{a-01-sign-in}}`), which the build resolves to that screen's id.

**Within a section, the tail of the file name is unique** — the words after the number. Two screens
named `k-02-airgap` and `k-13-airgap` are both perfectly good frames, and neither a note nor a
person can say which one they mean: a note names the tail, and one tail reaching two screens leaves
the reference ambiguous in a way the build cannot resolve and the reader cannot see. `refTailGate`
refuses it. **Fix the NAME, never the number** — the id is permanent, so rename the file to what
that screen actually draws and carry the notes, the imports and anything else naming the tail
across in the same change. Two screens that genuinely draw the same thing are one screen.

## What the gates catch that reading would not

- **A component called with a key it does not know draws nothing and says nothing about it.** The
  build reads every component's own destructuring pattern out of the pattern's `components.mjs`
  and checks the calls against it, so a component written tomorrow is covered the day it is
  written. It found `fArea({ required: true })` on two frames the first time it ran.
- **A value leaked into a frame as text.** A template literal does not throw on a missing
  argument — it coerces and prints it, so an omitted parameter reaches the board as the visible
  word `undefined` sitting where a title belongs, inside perfectly well-formed markup.
- **A section present while a frame has quietly lost what it promises.** A refactor or a bad merge
  leaves the label intact and the drawing gone, and a gate that counts sections passes it.
- **A frame nothing points at.** It can then be found only by scrolling the board, which nobody
  does in the product.
- **The documents outside the board.** `docs/` decides what exists and plans decide the order, so
  both drift the moment a frame is added and nobody back-fills. Paths come from
  `board.config.mjs` `documents`, and they are paths rather than globs on purpose — a glob that
  stops matching reports nothing, and nothing looks exactly like a pass.

  `documents.scan` names the directories every `.md` under which is read for stale frame ids. Two
  keys beside it say what is NOT a frame id, because the shape `X-nn` belongs to other numbering
  schemes as well: `notFrames` lists individual ids (a guide number, a visa class), and
  `otherIdScheme` lists whole FILES whose own numbering collides — an entity model with tables
  `B-02 PrinterModel` · `E-08 ReplaceStatusHistory`. Name the file rather than its ids: a per-id
  list goes stale as that model grows, and it goes stale silently. Every other document gate still
  reads the file.

  **A citation without a state letter names the screen, not a frame.** On a board numbering frames
  `B-01a` · `B-01b`, `B-01` is the screen those are states of, and the inventory's headings and the
  menu tree cite it that way — the gate accepts it as long as the board draws at least one of its
  states. A citation that carries a letter has to be that exact frame.

## The LLM reads the manifest plus one screen, never the whole board

That is exactly what keeps a large board tractable. To touch a screen it opens `src/manifest.mjs`
to find the file, then that one screen file and the component kit it composes from. The built HTML
is for humans to review; the source is what the model edits.

## Wire the folder so the next agent reads the source, not the artifact

`/simplecore:board-init` writes both: an `AGENTS.md` holding the board-reading contract, the
source layout and the commands, and a folder `CLAUDE.md` pointing at it. Both say, in the
imperative: *do not open the built HTML — it is a thousands-of-lines artifact; read
`src/manifest.mjs` then the one target screen.* The model's default reflex on "show me screen X"
is to open the big HTML, which floods context and bypasses the contract.

**`AGENTS.md` carries a marked region at the end that is the board's own.** Everything above the
marker describes the kit and the pattern and is replaced wholesale on the next migration; a rule
written above it is a rule that will be lost. A rule a regex could enforce belongs in
`board.gates.mjs` instead — a rule a person has to remember is a rule that comes back next month.

**A repository drawing several boards keeps the kit rules once.** Put the rules above the marker in an `AGENTS.md` beside the board folders, and each board's own `AGENTS.md` carries a routing paragraph in their place and its marked region below; `/simplecore:board-init` writes that routed form by itself whenever the shared file already exists. Two boards each holding the full copy report every shared sentence as an instruction written twice, and the copy that drifts reads exactly like the one that did not.

## Photographing one frame off the built board

**Opening `board.html` in a browser is the one legitimate reason to touch the artifact**, and it
is not reading — a downstream skill that asks for a picture of a changed frame (board-to-app's
`frameDeliverables` is the case that keeps arriving) needs the frame as it actually renders, which
the source cannot give. Every frame carries an anchor named after its permanent id: `#s-a-01` for
`A-01`.

**A selector screenshot of that anchor comes back blank, and the blank is the size of a real
file.** `kit/core/chrome.css` sets `scroll-behavior: smooth` on the board, so a driver that scrolls
to the element and clips in one step photographs the frame mid-flight — agent-browser returns
about 2.8KB of empty canvas where the frame runs 80KB. Nothing errors, and a 2.8KB PNG in a
directory listing is indistinguishable from a small screen.

So: turn the smooth scroll off first, scroll the anchor into view, then take a **plain viewport**
shot rather than a selector one.

```bash
agent-browser --session <name> open "file://$PWD/<board>/board.html"
agent-browser --session <name> eval "(()=>{const s=document.createElement('style');\
s.textContent='*{scroll-behavior:auto !important}';document.head.appendChild(s);return 'ok';})()"
# then, per frame:
agent-browser --session <name> eval "(()=>{document.querySelector('#s-a-01')\
.scrollIntoView({block:'center'});return 'ok';})()"
agent-browser --session <name> screenshot ./board-a-01-after.png
# once every frame is shot — the session holds a full browser until this runs:
agent-browser --session <name> close
```

**That last line is not tidiness.** The session survives the command, the shell and the agent
that opened it, so a board shot without it leaves one whole Chrome resident with nobody to
reclaim it — and the cost is memory rather than CPU, so it surfaces as a slow machine long after
anyone connects it to a screenshot run. Shoot every frame through **one** session and close it by
name at the end, including when the run stops early. **Never `close --all`**: the daemon is
shared, so it ends every other agent's session too.

**Measure the frame's rectangle against the viewport before believing the shot.** A frame taller
than the window is cut, and a cut frame reads as a frame that ends there — `getBoundingClientRect()`
returning a `top` at or above 0 and a `bottom` at or below `innerHeight` is the check, and it has to
run in a call **after** the scroll, never the same one: the rect read in the scrolling call is the
pre-scroll layout.
