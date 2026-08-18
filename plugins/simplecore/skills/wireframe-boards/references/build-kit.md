# Scaling: the kit in the skill, a pattern, and a board of pure content

Read past roughly twenty frames, or once the same nav / titlebar / status bar would be
hand-copied into every frame.

One file becomes a wall of grey that neither a person nor an LLM can navigate, and every chrome
edit is a find-replace across the whole board. At that size, the board is authored as a small
**source tree that builds into the same deliverable** — the output invariant never changes: one
self-contained, offline, no-JS (bar the index navigation aids) HTML file. Splitting is a *source*
concern, not a *deliverable* one.

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
    templates/            wf.mjs and AGENTS.md, as a new board receives them
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
src/manifest.mjs   the table of contents and build order
src/screens/       one file per screen
src/chrome.mjs     THIS product's tabs, menu tree, roles, purchase → the shell factories
src/components.mjs one line re-exporting the pattern
src/crud.mjs       the CRUD ledger                                               (optional)
src/roles.mjs      who reaches which cluster                                     (optional)
src/intro.html     the reading-contract items that are this product's own        (optional)
src/styles.css     what this board adds to the pattern's stylesheet              (optional)
```

## A common pattern is what a new board chooses

A pattern bundles the components, the app shells, the stylesheet, the reading-contract items and
the gates that hold a way of drawing. Choosing one is the first question `/simplecore:board-init`
asks, because it decides what every frame is composed from and held to; changing it later means
redrawing the board.

`simplix-basic` covers desktop, phone and tablet **in one pattern** — a console, the phone app its
users carry, and the shared terminal are one product, sharing components, copy register, control
vocabulary and CRUD discipline. Splitting them would mean deciding, per gate, which of the three
it belongs to: a boundary the product itself does not have.

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
