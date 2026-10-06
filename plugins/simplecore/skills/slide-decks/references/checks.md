# The checks, and what each one catches

The geometry of a page is judged by the deck tool's own checks over its live model, and the
deck's declared checks hold what the tool cannot know. The checks true of any deck ship with
the skills ([the shared checks](#the-shared-checks-and-the-runner)); a check true of one
project only lives in that project's `checks.local` directory. Both are declared by name in
`.claude/slide-decks.json` ([config.md](config.md)) and run by `scripts/check.py`: the
pre-flight group runs inside the build and stops it, the after group runs after every
render, and either group can be run on demand. A check that fails is fixed at the source,
never by relaxing the check or its baseline.

How any of this is written in the deck tool is that tool's own authoring guide (for
SlideGlance: the slideglance-pptx skill and the server's sg://guide).

## What the deck tool judges

Measured geometry comes from the deck tool's own checks and is never re-measured by a
project script. The shared `layout` check is how a phase asks for it: it runs the tool's
`layout_check` over the open deck with every kind named and reads the tool's summary. That
covers:

| Property | Fails when |
| --- | --- |
| overlap | two siblings share their area |
| overflow | a node passes the edge of the page or of its parent, a container is empty, a node has collapsed |
| ink outside a box | text is drawn outside the box that holds it, read from a render |
| row heights | a table row or a text box is drawn taller than its layout reserved |
| type floor in the built model | a font in the built deck sits under the declared floor |
| page count | the sheet count, cover and annex included, passes the declared maximum |
| palette in the built model | a colour the built deck carries is outside the declared inventory |
| the package | the file as it ships fails the tool's own verification |

Every diagnostic is traced to the node behind it, with its rectangle, its runs and its
source line, through the tool's own inspection.

A project script that re-measured the built file for one of these (a row or a text box
drawn taller than its layout reserved, ink past the text block, a value wider than its
fixed slot, a colour outside the inventory, the sheet count) is not declared beside the
tool's reading. The measurement it carried lives on only where a generator needs it, for
example to size an annex's rows before they are written.

## Where each property is held

Each property is held by one shared check, by the deck tool, or, where no shared check
holds it yet, by a check the project writes under `checks.local`. The shared checks read the
deck through the server and the kit vocabulary, so none of them reads page files from disk.

| Property | Held by | Deck kind |
| --- | --- | --- |
| measured geometry: overlap, overflow, escape, empty and tiny boxes, small type, ink, rows spread apart to fill a height | `layout`, which runs the deck tool's own check | both |
| tag balance: a close tag that does not match its open tag, which a lenient parser accepts and re-shapes silently | no shared check; a project whose tool accepts the mismatch writes it under `checks.local` | both |
| source rules: an em dash in a display face with no glyph for it, space-between distribution between content-sized siblings, a style class on an inline format tag, a numeric newline entity | the deck tool's declared rules where it carries them; otherwise `checks.local` | both |
| type floor | `typefloor`, on the printed size of every text box, so a size set in a style or scaled with the page is read where it prints | both |
| absolute paths | `abspath`, in pre-flight, because the deck builds and renders on the machine whose home directory is in the path and nowhere else | both |
| equal row height | `rowheight`, over the built `.pptx` | both |
| a narrow column wrapping inside a word (「학 / 력」, 「R / HEL」) or stranding a scrap of a short label (「전 / 구간」) | `wordbreak`, the renderer's wrap replayed over the built `.pptx` with the server's measurer | both |
| renderer version | `renderer`, in the pre-flight group and first in the after group, so the version is read before the render and again after it | both |
| catalogue | the kit: its `<Template kind doc use>` declarations, its generated components document and the tool's library search. A deck on templates of its own writes a catalogue check under `checks.local` | both |
| list rows, typed bullets, an index in a label column, a page that draws its own stack | `listrow` | both |
| label column: a caveat row in one slot beside a key row, starting its value left of the key-row values above it | no shared check; `checks.local` | both |
| label/value runs: two label/value components in one run, so the value column steps sideways mid-list | no shared check; `checks.local` (`listrow` reads an index in a label column, not the mix) | both |
| page shape | `pageshape`. Its simulate mode, which recommended a shape from one deck's templates, is not shared: a kit needs its own recommendation table | both |
| rhythm and the per-part component census | `rhythm` | document |
| a figure box the size of the picture it prints | `figbox` | both |
| a body page ending well above its folio | `foothole` | document |
| foot-band values: the ink height of every rendered foot band, where a value that wraps prints over the band's edge | no shared check; `checks.local` (`foothole` measures the paper above the band, not the band's own values) | both |
| a column ending well above its neighbour, or a hole inside a column | `colgap` | both |
| a speaker note a voice would misread: a digit joined to a native-numeral counter, a Latin letter | `notespeech` | slides |
| figure numbering, and a figure drawn and never placed | `fignum`, the second with `checks.fignum.idle` | document |
| manuscript parity | `parity` | document |
| section carry, the coverage direction of parity | `carry` | document |
| page grade | `grade` | document |
| mark echo | `markecho` | both |
| sentence stop | `period` | both |
| dangling predicate | `dangle` | both |
| a name slot that holds a question or a sentence | `naming` | both |
| contents and lookup pages | `contents` for the contents page (`--write` sets the folios); `evaluation` for the lookup table's printed folios | document |
| a topic split over pages carries `(n/total)` | `chapter_pages` | document |
| fine type | `finetype`, over the built `.pptx` | document |
| generated sources | `generated` | document |
| manuscript repeats | `mdtwice` | document |
| manuscript order | `mdorder` | document |
| deck repeats: caption echo, twice, same fact, figure text | `echo`, `twice`, `samefact`, `figtext` | document |
| a value quoted from another part | `figures` | document |
| page-id citations | `secref` | document |
| requirement ids: issued, nested, named in the panel's own nouns | `reqid`, `reqbadge`, `rfpwords` | both |
| tender citations, annex references, evidence items | `rfpcite`, `annexref`, `proof` | document |
| table totals and uniform columns | `coltotal`, `samecol` | both |
| page budget and volume | `budget`, `volume` | document |
| shared facts and scoring coverage | `sharedvalues`, `evaluation` | document |
| cross-deck citation: a slide deck's head cites a document chapter or section the document deck no longer has | no shared check; `checks.local` | slides |
| plan coverage: an evaluation item or requirement id a slide deck's plan does not know | no shared check; `checks.local`. A document deck's coverage of the scoring table is `evaluation` | slides |
| sequence census, verdict, density | no shared check; `checks.local`, declared under `checks.census`, `checks.verdict`, `checks.density` | slides |
| fill and column fill | on a document deck, `grade` measures both on the server's layout; a slide deck's preview-image fill and column fill (`checks.colfill`) are `checks.local` | both |
| figure snapshot: a document figure copied into the slide deck's own figure directories, where [figures.md](figures.md#a-document-figure-on-a-slide-is-redrawn-never-reused) expects none | no shared check; `checks.local` (`figures.upstream`) | slides |
| reproduced volume: one picture per body page at the offset and extent measured from the source, and a page count equal to the front matter plus the source's pages | no shared check; `checks.local` | document |
| capture floor: a screen capture placed so small its text falls under the figure floor | no shared check; `checks.local`. A project that reads a capture as evidence a screen exists, not as text the room reads, leaves it out and says so in the deck's instructions | slides |
| figure verify | the figure checks of `simplecore:svg-diagrams` (`scripts/docfigures/verify.py`), run by the `figures.verify` command | both |
| Korean audit | `simplecore:korean-docs` over the paths in `korean.audit`, wired into the project's build | both |

**A line count is measured by wrapping, never by dividing widths.** A generator that
asks how tall a cell or a paragraph will be is tempted to divide the run's total
width by the line's width, which is one expression and looks exact. It assumes
the text packs with no gaps: Korean and English both break at spaces, so every
line whose last word will not fit ends short and the block takes a line more than
the division says. One deck's annex generator under-counted three rows of a
thirteen-row table this way, and the rows below them were drawn over. Wrap greedily
(take words until one does not fit, break a word wider than the line inside itself) and
read the deck's own font file rather than a system copy of the family, since a
different version of the same family measures a different document. Two places that
measure the same thing must share the code that measures it, or one of them ships the
bug the other fixed; and where the deck tool already measures it, nothing else does. The
shared wrap is `bidkit.textko`, and the shared glyph widths are `bidkit.glyphwidth`, which
reads the deck's own face.

**A declaration copied between decks names neighbours the other deck does not
have.** Where a deck writes templates of its own and notes them with neighbours, a
second deck's set is a clone with its own layout names, so a neighbour named in the
first deck's notes points at nothing in the second; sixteen of one deck's declarations
did on the first run. Read the names a note cites against the deck's own definitions and
fail on a dangling one. **An index kept beside the templates by hand ends up shorter than
the templates**: what it names is what gets used, so the shapes outside it fall out of the
vocabulary while every page still passes its own review. Generate it from a declaration
each template carries and fail on a template that has none. A kit does this for every
deck bound to it.

**Pin the tool that draws the previews, not only the one that builds the deck.**
The builder was pinned and the renderer sat nowhere: one deck ran
three minor versions behind for months while every preview, the deliverable PDF
stitched from those previews, and every check that measures an image went through
it. It surfaces as a measurement that will not settle: a marker tuned until it
looks right, then wrong again on another machine. Declare the version beside the
deck, read it before the render and again after, and refuse rather than warn.

**A row whose text box ends on the text block's edge needs a pixel of clearance.**
A line that fills its measure draws its last glyph on the boundary, and the
renderer puts a fraction of it past, enough that the tool's ink check sees text outside
its box. Seven pages of one deck did, all of them the same list row, and every one of
them was a line that fit. One pixel of right padding on the shape holds the glyph inside
and moves no line break; a wider inset re-wraps the deck and trades one set of over-long
lines for another.

**A check measures one thing, so a defect between two measurements needs its own.**
When a check's report reads clean and a page still looks wrong, the question is which
measurement nobody is taking, and the first place to look is the deck tool's own checks
with every kind named, since a default run may stop short of the ink and package
readings.

**A check that reads the render needs a full render.** A check that reads the preview
images (a slide deck's fill and column fill) sees the pages a partial render left exactly
as they were, so running it after rendering one page reads one fresh page and every other
page stale and reports nothing. `finetype`, `rowheight` and `wordbreak` read the built `.pptx` and
refuse one older than the deck's sources. Render the pages while editing, render
everything before the checks.

**The Korean audit belongs in the build, not in a habit.** It is the one check a
person has to remember to run, so it is the one that goes stale: a deck reported a
clean audit, took an edit afterwards that collided with the glossary, and carried the
error through a whole review round. The project's build runs the audit over the paths in
`korean.audit` before compiling and fails on an error, reading the list from the
declaration so the build and the manual command cannot disagree; no shared script runs it.
The declared paths carry globs, and a build that spawns the audit without a shell expands
them itself rather than handing the audit a literal `*`. A directory is read as
`simplecore:korean-docs` expands one, which decides whether the deck's own source files are
among what it reads.

A post-layout diagnostic (an overflow past the parent, a horizontal text overflow) may
carry no source line, so the build prints its node path and measured context (box width,
natural width, font size): the path names the template nesting and the font size names
the style that overflowed, which is usually enough to find the string.

## The shared checks and the runner

The library every shared check reads through is `plugins/simplecore/scripts/bidkit/`:
`config` (the declaration, found by walking up from the working directory, comments
stripped with string state so a URL survives), `sgmcp` (the connection to whichever server
holds the deck: the application that has it open, else a private `slideglance mcp` over the
files on disk), `deckread` (source files in import order, slides as printed, page ids,
folios and tables), `srctree` (the source tree, where a component keeps its arguments and
its slot), `vocab` (the kit vocabulary in `assets/kits/<kit>.json`), `layout` (the server's
measured boxes), `pptxread` and `glyphwidth` (the built `.pptx` and the deck's own face),
`baseline`, `textko`, `mdtable` and `manuscript`. A check reads the deck from the server,
never from disk, because the application's model runs ahead of the disk until the deck is
saved.

| Check | Lives in | Reads | Fails when | Declares |
| --- | --- | --- | --- | --- |
| `layout` | `slide-decks/scripts/checks/` | the deck tool's own `layout_check` over the open deck | the tool reports any overlap, spill, escape, empty or tiny box, small type, diagnostic, ink or spread finding (rows of a stack standing two lines or more apart because the height was spread between them); a summary missing a requested kind is exit 2, never a pass | `type.floor`, `checks.layout` (optional) |
| `typefloor` | `slide-decks/scripts/checks/` | every text box's printed size from the server's layout | a text prints below `type.floor`, or a code label (`roles.codeLabels`) below `type.codeLabel`, beyond `checks.typefloor.tolerance`; table cells are one box in that reading and are not measured | `type`, `checks.typefloor` (optional) |
| `abspath` | `slide-decks/scripts/checks/` | the deck's sources from the server (path attributes, `<Import src>`, JSON string values of the build file) and the `checks.abspath.scan` files from disk | a path begins at `/`, `~/` or a drive letter; a file `checks.abspath.generated` names as build output is tracked by git | `checks.abspath` (optional) |
| `generated` | `slide-decks/scripts/checks/` | every source whose opening names a generator, from the server and from `checks.generated.scan` | a generated file or its generator differs from the record `--bless` wrote; the check never runs a generator | `checks.generated.generator`, `checks.baselines` |
| `renderer` | `slide-decks/scripts/checks/` | the renderer's own `--version` | the renderer is older than `renderer.minVersion`, or cannot be run | `renderer.command`, `renderer.minVersion` |
| `rowheight` | `slide-decks/scripts/checks/` | the built `.pptx` (`output`), refusing one older than the sources | framed boxes on one top edge differ in height by more than the tolerance | `output`, `page.w`, `checks.rowheight` (optional) |
| `finetype` | `slide-decks/scripts/checks/` | the built `.pptx`, measured with the deck's own face | a text box printed only in the fine-print inks at the floor wraps to more than `lines` lines; a face that cannot be found or read is an error | `output`, `type.floor`, `palette.fine` (kit), `checks.finetype` (optional) |
| `wordbreak` | `slide-decks/scripts/checks/` | the built `.pptx` (`output`), refusing one older than the sources; page labels and `text_measure` from the deck server | a table cell or wrapping text box whose replayed wrap cuts a word (a word wider than its column, or two syllables of a non-Korean run) other than after `breakAfter` or before `breakBefore`, or a label of at most `labelWords` words that strands a one-character or id-fragment line | `output`, `checks.wordbreak` (optional) |
| `contents` | `slide-decks/scripts/checks/` | the printed contents rows (nodes bound to the vocabulary's `contents` fields) and the folios | a part's number differs from its divider's folio or a chapter's from its first body page; an untypeset part or chapter is pending. `--write` sets the folios through `set_texts`, never a file | vocabulary `contents`, `pages` |
| `chapter_pages` | `slide-decks/scripts/checks/` | every body page's running head | a topic set on several pages lacks `(n/total)` or carries the wrong numbers, or a lone page keeps a marker; topics group by part, chapter and the marked argument | `checks.chapter_pages.slot` (optional; default `pages.head.title`) |
| `mdorder` | `slide-decks/scripts/checks/` | the import order and every body page's declared manuscript | a body page's declared source comes before the source of the page in front of it | `manuscript.declaration` |
| `pageshape` | `slide-decks/scripts/checks/` | the kind each component declares on its `<Template>`, and the source tree for column slots | a body page has no shape and no table, a list outruns its shapes, a list has one row, or a numbered sequence is dealt evenly into the columns of a column layout | vocabulary `kinds`, `roles`, `checks.pageshape` (optional) |
| `rhythm` | `slide-decks/scripts/checks/` | each body page's layout family, read from where its figure stands, and the content components per part | the same family three pages in a row, a side figure on the same side twice, the same family with the same dominant component twice; a plain stack of full-width blocks (no columns, side figure, pair or rail) three pages in a row or on more than half a part; one component past a share of a part's uses, or fewer kinds than the part has pages | vocabulary `kinds`, `roles`, `checks.rhythm` (optional) |
| `figbox` | `slide-decks/scripts/checks/` | every figure use (`roles.figures`) whose `src` is an `.svg` or a `.png` capture | a box whose `w` or `h` differs, past `tolerance` (1.5px), from the placed width × `placeScale` and the viewBox height scaled the same (any placement of the board: `520` or `520-pair`), or, for a figure whose box at placeScale does not fit its slot (`figures.slots`), from the same × `oversizeScale`; a placed file that does not exist, an SVG with no viewBox or on no declared board, a capture it cannot read. A file named in `exceptions` is skipped, a use with no `w` and `h` is counted as not measured, and the summary names how many figures were measured | `figures.boards`, `kind`, `figures.placeScale`, `figures.oversizeScale`, `figures.slots`, `dir`, `checks.figbox.tolerance` · `exceptions` (optional) |
| `foothole` | `slide-decks/scripts/checks/` | the PNG of every page the reader counts as body or annex (`pages.masters`, or the `checks.foothole.masters` regex) in the full render (`previews`) | an empty band above the foot band taller than `max` (0.08 of the page height), or no ink above it at all; judged pages retire in `foothole.json` with the hole as measure. A deck on which no page is measured exits 2 | `previews`, `pages`, `checks.foothole` (optional: `masters`, `footBand`, `footBands`, `max`, `ink`, `pattern`) |
| `colgap` | `slide-decks/scripts/checks/` | every slide's layout tree (`slide_tree`) | in a row of two or more boxes at least `minColumn` (0.2) of the page wide on one line, a column whose drawn content ends more than `max` (0.08 of the page height) above the lowest column's (`bottom`), an uncovered run taller than `max` inside a column (`hole`), or every column stopping more than `max` above the box the row was given (`foot`); judged slides retire in `colgap.json` with the gap as measure | `checks.colgap` (optional: `masters`, `max`, `minColumn`) |
| `notespeech` | `slide-decks/scripts/checks/` | every slide's speaker notes (`sg://deck/content`) | a digit joined to a counter read with a native Korean numeral (`11대`, `6명`, `4시간`; a ratio `1 대 3` and `개월` are exempt) or any Latin letter, both of which a voice reads wrongly | `checks.notespeech` (optional: `counters`, `latin`) |
| `grade` | `slide-decks/scripts/checks/` | every body page's composition and its fill on the server's layout (`sg://slide/{n}/space`), and the findings of the checks it folds in | a page still has a reason, in tiers: a defect, a page to look at, or a judgement recorded with its reason (printed, never failing) | `grade.tableOfRecord`, `checks.grade` (optional), `checks.baselines` |
| `listrow` | `slide-decks/scripts/checks/` | the deck's sources as a tree | a list row outside the list container, a container inside a container, a typed bullet in a mark, an index in a label row's label column, a page file that draws its own stack | vocabulary `roles`, `checks.listrow.composed` (optional) |
| `period` | `slide-decks/scripts/checks/` | the vocabulary's sentence slots and the printed table cells | a sentence without its stop, or a stop on a string that is not a sentence, after trailing references are set aside | vocabulary `sentences`, `lang.sentenceEnd`, `checks.baselines` |
| `dangle` | `slide-decks/scripts/checks/` | the sentence slots in reading order and the printed table cells | a claim's last present row ends on a connective | vocabulary `sentences`, `checks.dangle` (optional), `checks.baselines` |
| `naming` | `slide-decks/scripts/checks/` | the deck's sources, the kit's `slots.name` | a name slot ends as a question, on the register's sentence ending, or on a subordinate clause; opt-in: unlisted components' head arguments, a region title repeated by its first head | vocabulary, `lang.sentenceEnd`, `checks.naming` (optional) |
| `markecho` | `slide-decks/scripts/checks/` | the printed components' label and prose pairs (kit `marks`) and printed table rows below the header | a label repeats its prose's first words, its second word onward, or the closing word of its items; a retired place that no longer repeats | `marks` (kit), `checks.baselines` |
| `echo` | `slide-decks/scripts/checks/` | each printed page carrying the running head: its explanation, captions, prose blocks (card rows with `checks.echo.cards`) | two blocks of different components on one page share at least `threshold` of the shorter one's words, unless retired with a reason at that overlap | `pages.head.sub` (kit), `checks.echo` (optional), `checks.baselines` |
| `twice` | `slide-decks/scripts/checks/` | every printed string of every slide | a string of `minLen` characters or more (default 42) is printed on two pages; with `checks.twice.sentences`, a sentence | `checks.twice` (optional), `checks.baselines` |
| `samefact` | `slide-decks/scripts/checks/` | every printed string of the body pages, cell by cell | one noun-phrase key with one unit carries different values on different pages, unless that value set is retired with a reason | `checks.samefact` (optional), `checks.baselines` |
| `figures` | `slide-decks/scripts/checks/` | the printed pages | a sentence quoting a value from a part (「Ⅰ에서 인용한 … 462건」) names a value no body page of that part prints | `pages.numerals`, `checks.figures` (optional) |
| `figtext` | `slide-decks/scripts/checks/` | each placed figure's SVG labels and the printed strings of every slide from the same source file | `limit` or more labels of `minLen` letters stand in the text beside the figure; a placed figure whose file is missing | vocabulary `roles.figures`, `roles.figureSrc`, `checks.figtext` (optional), `checks.baselines` |
| `parity` | `slide-decks/scripts/checks/` | each page file holding a body page, its declared manuscripts | a printed string traces to none of them (prose as written, heads word by word, the rest as a fragment); a declared manuscript does not exist | `manuscript.dir`, `manuscript.declaration`, vocabulary `args`, `checks.parity` (optional) |
| `carry` | `slide-decks/scripts/checks/` | each declared manuscript's printed prose and the printed text of the pages declaring it | the share of a declared section that reaches its pages falls under `floor`; opt-in (`checks.carry.undeclared`): a manuscript file with printed prose that no page declares, retired under `<file><TAB>undeclared` | `manuscript`, `lang.sentenceEnd`, `checks.carry` (optional), `checks.baselines` |
| `fignum` | `slide-decks/scripts/checks/` | the figure components' number argument in printed order, the manuscript's caption lines, both sides' citations | a series does not run 1..n (deck: or does not rise, with `deckOrder: monotonic`), a citation names a number its side lacks; opt-in: a deck number no caption carries, an idle figure | `figures.numbering`, `manuscript.caption`, `roles.figureNumber` (kit), `checks.fignum` (optional) |
| `secref` | `slide-decks/scripts/checks/` | the deck's sources (comments out, escapes undone) and the printed body pages | a named page-id citation's name is not on the cited page, or none of the anchors just before a citation is (a folio of the cited chapter beside the id is not an anchor, but must be the cited page's own folio); a citation of an untypeset chapter is pending | `pages.id`, `requirements.id` (optional), `checks.secref` (optional), `checks.baselines` |
| `reqbadge` | `slide-decks/scripts/checks/` | every body page's head ids, region and badge ids, and with `requirements.manuscriptLine` the declared manuscripts | a head id the tender never issued, a region or badge id the head does not name, a head id missing from the manuscript's requirement line or a sub-section line not badged; opt-in: unbadged region heads, an id written bare in a sentence slot | `requirements`, `pages.head.reqs` (kit), `roles.regionIds`, `roles.badgeIds`, `checks.reqbadge` (optional) |
| `proof` | `slide-decks/scripts/checks/` | the deck's source files and the evidence table | a cited item is not defined, a defined item is cited by no page (pending while every page listed for it is in a chapter not yet typeset), a cell cites by number without the tag, or pages cite while the table is missing. A count (「증빙 3건」) and a range (「증빙 1~9」) are not citations | `evidence`, `pages.numerals` with `evidence.pagesColumn` |
| `coltotal` | `slide-decks/scripts/checks/` | every printed table, a table continued onto the next page read as one | a total row's number differs from the sum of the numeric column above it | `checks.coltotal` (optional) |
| `samecol` | `slide-decks/scripts/checks/` | every printed table, continued tables joined | every body cell of a column holds one value, judged over the whole table so a column that varies on its first page is not reported for its last; a retired column whose value changes fires again | `checks.baselines`, `checks.samecol` (optional) |
| `deliver` | `slide-decks/scripts/checks/` | `submission`, each deck's `output`, `render`, `previews`, `page.w`, `deliverable` | not a check: builds and writes the deliverables at the paths `submission.name` and `submission.layout` give, clears the blind copy's `dc:creator`, `cp:lastModifiedBy`, PDF author and XMP `dc:creator`, then reads its properties; exit 1 when the folder passes `submission.pdfLimitMB` or the blind copy's document properties (the pptx's `docProps`, the PDF's information and XMP) still carry a proposer name another copy's `identity` declares, 2 when a step cannot be completed | `submission` |
| `reqid` | `proposal-writing/scripts/` | the deck's source files (comments stripped) and every manuscript file; with `--manuscript-only` the manuscript alone | an id the digest's headings do not issue is cited, a range included (`PER-001~008` over a never-issued `PER-007`); a sentence matching `requirements.absence` may name a missing id | `requirements`, `manuscript` |
| `rfpwords` | `proposal-writing/scripts/` | each requirement's quoted detail and the manuscript (or the deck with `--against-deck`) | a noun the requirement names is written nowhere, unless retired with a reason | `requirements`, `checks.rfpwords` (optional), `checks.baselines` |
| `rfpcite` | `proposal-writing/scripts/` | the transcribed tender and the manuscript (and `rfp.scan`) | a cited tender chapter or section does not exist, or a cited section name is in another chapter; a name in no chapter is a warning | `rfp.dir` |
| `annexref` | `proposal-writing/scripts/` | the deck's sources, the manuscript outside the annex, and the files that define each kind of annex item; with `--manuscript-only` no deck | a reference names an annex item its definition does not carry | `annex.references` |
| `evaluation` | `proposal-writing/scripts/` | the scoring table, the lookup table (Markdown or as the deck prints it), the deck's folios and heads, and an optional requirement lookup; with `--manuscript-only` the rows alone | a scoring item or element has no row, a row answers nothing scored, rows run out of scoring order, a printed folio differs from the page id beside it, a head names an unscored item or one whose row does not cite the page, a requirement row is unissued, repeated, misnamed, or cites a page that does not print the id | `evaluation.scoring`, `evaluation.lookup` |
| `budget` | `proposal-writing/scripts/` | the deck's folios | more numbered pages than `budget.maxNumbered`; the finding cites `budget.clause` | `budget.maxNumbered`, `pages` |
| `volume` | `proposal-writing/scripts/` | every printed manuscript page, its figure links and their SVG widths | a printed page holds more than its capacity (`budget.charsPerPage.figure` with a full-width figure, else `.text`) times `budget.pageTolerance`; a part prints more pages than `budget.parts` gives it; a figure link resolves to no file | `manuscript`, `budget.charsPerPage` |
| `mdtwice` | `proposal-writing/scripts/` | the printed prose of every manuscript file | two sentences in different files share at least `threshold` of the shorter one's words, unless retired with a reason | `manuscript`, `checks.mdtwice` (optional), `checks.baselines` |
| `sharedvalues` | `proposal-writing/scripts/` | the shared-facts table and the printed pages (manuscript markers or the deck) | a distinctive value is missing from a page its row assigns, or printed on a page it does not | `manuscript.sharedValues` |
| `claims` | `proposal-writing/scripts/` | every manuscript line with a digit (annex and exclusions left out) | never a gate: prints FLAG (both Jev phrasings say measured, no evidence in the line's block) and SPLIT lines and the statistics line; exit 1 only when a question went unanswered. `--dry-run` sends nothing | `jev.claims.evidence` |

**The text checks read the deck one way.** `echo`, `twice`, `samefact`, `figures` and `markecho` read
the printed model (`sg://deck/content?format=json`), where a component's arguments, its JSON item
lists and a table's cells are already expanded, and key their findings by page id. `naming`,
`secref` and `parity` read the sources (`sg://deck/markup`), where a citation keeps its position next
to the words it points at and an argument keeps its class; their findings are keyed by file. A
baseline keyed by a chapter file in an older form does not match a page-id key and is written again
with `--bless` on migration.

**The checks that read how a page is composed group components by kind, not by name.**
`pageshape`, `rhythm`, `grade` and `listrow` group components by the `kind` each declares on its
`<Template>` (read from the server through `DeckReader.templates()`). The kit vocabulary says which
kinds count as a shape (`kinds.shape`) and as content (`kinds.content`), and names the component
roles a rule needs (`roles.*`). A deck overrides a role with `checks.<check>.<role>`. A role neither
declares is printed as `⚠ ... the rule that needs it was not judged`, never passed silently.

- `pageshape`: a body page with no shape and no table; a list that outruns its shapes
  (`listCeiling` rows, fewer than one shape per `rowsPerShape`); a one-row list; a numbered sequence
  dealt evenly into the slots of a column layout (read from the source tree, where the slots are).
- `rhythm`: the layout of each body page is a family read from where its figure stands (full,
  bottom, left, right, pair, rail, none). Near-identical layouts are one family: a full-width figure
  with columns under it is the same layout as one with cards under it. The census fails a part
  where one content component passes a third of its uses or where fewer kinds are used than it has
  pages, and lists the unused vocabulary.
- `grade`: per body page, every reason it still fails, in tiers. The fill is measured on the
  server's layout, not a PNG: the lowest drawn box of the body against the body's inner box, and
  the columns of the row that closes the page against each other. Pages in `grade.tableOfRecord`
  of the deck being checked are tier 3. `checks.grade.include` names checks whose `by_page()`
  findings are folded in (default `rhythm`). A reason retired with a written reason prints at tier
  3; a blank reason still fails. **A page whose every reason is a recorded judgement is finished
  work and does not colour the exit code**: counting one as a failure puts the check's own goal out
  of reach, and 「run until the grader exits 0」 then never arrives.
- `listrow`: a list row outside the list container, a container inside a container, a typed bullet
  in a mark (a row's or a list item's), an index in a label row's fixed label column, and a page
  file that draws its own `<VStack>` or `<HStack>` (outside `checks.listrow.composed` globs).

**The checks over the printed words read the vocabulary's sentence slots.** `period` and `dangle`
read the kit vocabulary's `sentences` (component to sentence slots in reading order; `arg[].key`
items are rows of their own) and the printed table cells. `period` reports a sentence without its
stop and a stop on a string that is not a sentence, after setting aside any number of trailing
references (`(…)`, `[…]`); the closing syllable and stop come from `lang.sentenceEnd` (default
「다.」). `dangle` reports a claim whose last present row ends on a connective. `reqbadge` checks
that ids nest: head ids are issued (the proposal-writing `reqid` reader), region and badge ids are
the head's, and, with `requirements.manuscriptLine`, head ids are on the manuscript's requirement
line and its sub-section lines are badged; `checks.reqbadge.regions` and `bareIds` are policies a
deck opts into. `figtext` compares a figure's SVG labels with the printed strings of every slide
from the same source file. `carry` measures how much of a declared manuscript's printed part the
declaring pages print: one deck declared a section on its opening page and typeset none of its
seventeen sentences while the page itself was full, shaped and passing, which no page-level check
reaches.

**The checks over files, tools and the built deck read each input where it lives.**
`typefloor` reads every text's printed size from the server's layout and holds it to `type.floor`
(code labels, `roles.codeLabels`, to `type.codeLabel`, unmeasured when null), within
`checks.typefloor.tolerance` because a page-relative size resolves a few hundredths of a point off.
`abspath` reads the deck's sources from the server and `checks.abspath.scan` files from disk,
generated ones included, and fails on build output git tracks (`checks.abspath.generated`).
`generated` compares generated files and their generators with the record `--bless` wrote, because
a hand edit to a generated file renders, passes every check, and is deleted by the next
regeneration. `mdorder` reports a body page whose declared source precedes the previous page's;
the repair is to move the page, never to renumber its figures. `renderer` compares the renderer's
`--version` with `renderer.minVersion`. `finetype` and `rowheight` read the built `.pptx`
(`output`), refusing one older than the deck's sources; `finetype` measures with the deck's own
face (`bidkit.glyphwidth`, standard-library TrueType reading, faces found among the server's build
fonts by the vocabulary's `fonts.sans`), and a face that cannot be found or read is an error.
`wordbreak` takes each cell's width (grid columns less the cell margins) and each run's size, weight,
language and explicit breaks from the built file, and fits every line with the server's
`text_measure`, whose `lines` answer is the wrap's own verdict (its `width` field is not what the
wrap compares). It replays the renderer's units: a Korean run keeps a word whole until the word alone
is wider than its column, which opens a line and is cut at the longest prefix that fits; a closing
mark the cut would strand hangs instead. Each line is fitted in its column plus `slack` (0.5 px), because the
column is EMU rounded in the file and a word short of it by a fraction of a pixel prints whole. Type sizes go to the server in the deck's CSS px (pt × 4/3);
a size derived from the slide's EMU per px is off by the page's rounding and moves cuts by a
character.

**A check that writes goes through the deck server.** `contents --write` sets each number with the
server's `set_texts`, keyed by the printed node it read and addressed with the generation and
revision `sg://deck` reported, so the open deck takes the change as an edit with a history line. A
node drawn from a JSON item list is routed by the server to the list item (`setForeachItem`), and
the item's value is then a string (`"7"` where the source held `7`). Writing the page file instead
would put the disk ahead of a model the application is still holding.

**Each opt-in behaviour is off by default, and a key turns it on.**
`twice` compares whole printed strings of 42 characters or more; `checks.twice.sentences` splits
them into sentences first and is used with a lower `minLen` (28 found six repeated instructions of
31 to 35 characters in one deck). `echo` reads the explanation, captions and prose; `checks.echo.cards`
adds the vocabulary's other sentence slots. `fignum` holds the deck's series to 1..n;
`checks.fignum.deckOrder: "monotonic"` is for a deck typeset a part of a chapter at a time, and
`deckInManuscript` and `idle` are for a deck whose figures are numbered by the manuscript. `naming`
reads the kit's name slots; `checks.naming.fallback` and `regionEcho` add the head arguments of
unlisted components and the region-title rule. `parity` compares the furniture only when
`manuscript.furnitureSource` names the file it is written in, and loosens short attributes only
with `checks.parity.accentLen`. `carry` reads the manuscripts the pages declare;
`checks.carry.undeclared` adds every manuscript file with printed prose that no page declares, the
one gap no other check reads.

**A figure number and a page id are read back from the format that writes them.** `fignum` builds
its pattern from `figures.numbering.caption` (fields `part`, optional `chapter`, `n`) and
`figures.numbering.annex` (`a`, `n`), and `secref` from `pages.id`, through
`bidkit.deckread.format_pattern`. A series is everything before the number, so 「그림 Ⅲ-」 and
「그림 별첨2-」 count apart and a chapter format counts per chapter. The manuscript side runs in path
order over `manuscript.files()`, so a deck declares `manuscript.exclude` for a README that shows the
caption format as an example.

**parity's manuscript reading is deterministic.** Cells and headings are joined in document order
with a separator, so two cells of different rows never read as one phrase and the same deck gives
the same verdicts on every run.

**markecho's baseline is keyed by place.** `page<TAB>component<TAB>label slot<TAB>n`, so rewording
the prose keeps the judgement; a retired place that no longer repeats is reported and fails until
the baseline is written again, because an exemption that matches nothing reads as one that applies.

**A volume capacity is an estimate.** `volume` reports every printed page over its declared capacity
and every part over its planned pages; a finding is a page to look at before typesetting, not a
number of characters to delete. A project that stops condensing short of 1.0 declares the ratio it
stops at as `budget.pageTolerance`. The page title is not body copy and is not counted.

**Claims triage reports its own cost.** The statistics line is counted from the answers, never
estimated: questions sent, answers received, errors, seconds, the rate, and the sum of
`providerMetadata.gateway.cost` the gateway returned with each answer
(「질문 828 · 답 828 · 오류 0 · 68초(초당 12건) · $0.02」). `--dry-run` prints how many questions a run
would send and sends none. The client is injected, so the tests make no call.

**The delivery keeps the type as text and never rasterises on its own.** `deliver` makes the PDF
from text-mode SVG with every figure inlined as vector in the kit's sans face, binds it with
rsvg-convert with the deck's faces, then resamples the pictures to `submission.pdf.imageDpi`. The
raster route stitches the previews and is chosen only with `--raster` or `engine: "raster"`. The PDF
steps need PyMuPDF (resampling), and the raster route Pillow and img2pdf; a missing module is exit 2
naming it. `deliver` sits under `scripts/checks/` and so appears in the runner's list of shared
checks; it is run with `check.py run deliver` and never declared in `checks.after`.

**Not shared.** A catalogue generated from `@kind` comments on a deck's own template files is the
kit's in a kit deck: its `<Template kind doc use>` declarations, its generated components document
and the tool's library search, and a kit deck adds no templates of its own. `pageshape --simulate`
named one deck's templates in its candidate table; a kit would need its own recommendation table.
The `.pptx` text reader and the glyph widths are libraries (`bidkit.pptxread`,
`bidkit.glyphwidth`), not checks.

**Run them through the runner**, from anywhere inside the project:

```bash
python3 <skills>/slide-decks/scripts/check.py after        # or preflight
python3 <skills>/slide-decks/scripts/check.py run reqid    # named checks
python3 <skills>/slide-decks/scripts/check.py list         # what each name resolves to
python3 <skills>/slide-decks/scripts/check.py undeclared   # local scripts nobody runs
```

A name resolves to `<checks.local>/<name>.py` first, then to the shared check of that name under
`slide-decks/scripts/checks/`, then under `proposal-writing/scripts/`, so a project overrides a
shared check by writing its own under the same name. Every check runs from the project root with
`SLIDE_DECK` set to the deck's name and is timed; its standard error is printed whatever its exit
code, a check that prints nothing is reported, a declared name that resolves to nothing fails, and
the summary names the longest check. `list` also names the shared checks the deck does not declare.
Exit codes are 0 clean, 1 findings, 2 a check that could not reach its input (a missing key, no
server holding the deck, a deck that contradicts the declaration). Every shared check prints one
line saying what it read and what it found.

**The runner passes a check `--deck` and nothing else**, so a check's own options are given by
running its script directly from inside the project (`python3 <skills>/slide-decks/scripts/checks/<name>.py`
or `<skills>/proposal-writing/scripts/<name>.py`): `--bless` on a check that keeps a baseline,
`contents --write`, `figtext --condense`, `grade --queue` · `--page <id>` · `--json <file>`,
`rfpwords --against-deck`, `mdtwice --same`, `claims --dry-run`, `layout --slides <range>`,
`deliver --copy` · `--volume` · `--no-build` · `--raster` · `--scale`, and `--help` on any of them.
**Before the deck exists**, while a bid writes its manuscript, `reqid`, `annexref` and `evaluation`
run that way with `--manuscript-only`, which opens no deck server; every other check reads the deck
and waits for it.

A shared check is added with tests that build its broken form and its fixed form
(`scripts/bidkit/tests/`, `slide-decks/scripts/checks/tests/`,
`proposal-writing/scripts/tests/`, standard-library `unittest`), and fire on the first and
stay quiet on the second. The deck reader is tested on a recording of a live deck
(`RecordedTransport`) whose wording is replaced, since the skill repository is public. Every
suite, the figure library's included, runs with `plugins/simplecore/scripts/test.sh`, which starts
each from the directory its imports expect, prints one count line per suite and exits non-zero
when any fails or finds no tests.

## A baseline entry carries the reason, not just the finding

A baseline retires a finding, and a finding retired on the strength of having
been seen is the one thing a baseline must never do: it turns the check into a
record of what somebody once looked at. Every baseline is
`{finding: reason}`, an entry with an empty reason still fails, and retiring a finding
writes the entry blank so the reason has to be typed before the check goes
quiet. Where a baseline predates the rule, its existing entries stay retired and only
a new or changed one demands a reason; a flag day that fails forty entries at
once teaches nobody anything.

Baselines live in the directory `checks.baselines` names, one `<check>.json` per check,
never beside a check's script. An entry is `"finding": "reason"`, or
`{"reason": …, "measure": …}` when the judgement holds only at one measure (an overlap
ratio, a set of values); `""` is retired with the reason still owed and fails. A legacy file
(a list of findings, a bare measure, an object without a reason) loads as grandfathered entries
that stay retired while their measure is unchanged. The shared loader reads `reason` and
`measure` and no other key names; a check whose legacy file named them otherwise translates it on
load, as `samecol` does for its `page<TAB>table<TAB>head` keys (a bare value, or the reason under
「사유」 and the value under 「값」). `--bless` rewrites the file
with today's findings, keeps the reason of every entry found unchanged, writes the rest
blank, and prints the ones that still owe a reason. The shared checks that keep a baseline
take `--bless`: `period`, `dangle`, `markecho`, `echo`, `twice`, `samefact`, `figtext`,
`carry`, `fignum`, `secref`, `samecol`, `finetype`, `wordbreak`, `grade`, `colgap`, `foothole`,
`mdtwice` and `rfpwords`; `generated` keeps its record of digests in the same directory.

## A check that cannot reach its input says so instead of passing

A zero is the same shape whether the deck is clean or the check never looked. One check
read every figure's SVG to compare its labels against the prose beside it, resolved
the figure path against the process's own directory instead of the deck's, found nothing
where it looked, and reported 「0건」 on every run it had ever made. The deck could have
been drawing its own paragraphs on every page and the line would have read the same.

- **A missing input is an error, not an empty result.** Raise on it. Returning an empty
  list when a path does not exist is the shape to look for, and it is always wrong in a
  check.
- **Distinguish 「no such thing」 from 「a thing with nothing in it」.** A layout shell that
  draws no figure and a figure name nothing defines are different, and mapping both to an
  empty list is how the first one hides the second.
- **A generator that copies a string out of a source the check cannot read couples two files
  with nothing watching them.** One deck's annex generator held a divider lede as a
  constant, copied verbatim from a manuscript line, and that line was a `>` blockquote, which
  the parity check drops before comparing. The two could drift apart forever and every check
  stayed green. Where a generator needs a manuscript's words, it reads them; a constant is
  only for what the manuscript does not say.
- **Prove a new check on both sides before believing its zero**: build the broken form,
  watch it fire, build the fixed form, watch it go quiet. A check nobody has seen fire is
  a check nobody has seen.

## A check reports what it is unsure about; it never filters it out

The tempting move when a new check fires on something that turns out to be fine is to
exclude that shape in the code: a mark that is an acronym, a component a sequence
repeats on purpose, a page that is a table of record. It reads as making the check
precise. It is the one change that cannot be reviewed: the excluded case never appears
again, so nobody learns that the exclusion also swallowed the case it was not meant to.
One deck dropped a whole check for two findings that turned out to be clean, and with it
the only mechanical way it had to catch a silent overlap.

**Missing a defect costs more than reading a finding that turns out to be fine**, so the
bar for a check is what it catches, not how quiet it is.

**Read the exit code, not the last line.** A check prints a summary and exits non-zero, and
the natural way to sweep a dozen of them, piping each into `tail -1`, reports `tail`'s
status, not the check's. One deck ran that sweep for three review rounds while one of its
checks failed every time: the summary line it printed was a component census that reads
the same whether or not there are findings, and the findings were printed above it.
Capture the output and the exit status separately and print both, or the sweep will tell
you what you hoped rather than what happened. The runner does this for every declared check.

**A template's declaration is the comment above it, so inserting a template between a
comment and its template reassigns it.** In a deck that declares its own templates by
comment, adding two variants immediately before the component they vary took the
component's own annotation block with them, and the component was left undeclared. The
catalogue check is what caught it: the shape of this mistake is invisible in a diff that
looks like a pure addition.

**A check that measures a container measures only that container.** A deck that had a
table-row overlap check ran it for weeks with the same defect sitting on a body slide
outside a table: a label/value row's Hangul wrapped to a third line, the builder had
reserved two, and shapes carry absolute positions, so the third line printed on top of
the row beneath and the two strings shared their pixels. The build linted clean, the row
check reported zero because it reads tables, and five evaluators read the slide before
one saw it. **When a defect has a cause rather than a location (here the builder's
0.6-em-per-character wrap estimate against a full-em script), the check belongs to the
cause, and every container that cause reaches needs measuring.**

**Wrap where the renderer wraps.** The same check, written to break per character
because Hangul may wrap mid-word, packed every line perfectly full and reported the
defective slide as clean: 77 characters measured 1.997 lines of advance and came out as
two, while the renderer broke at the last space that fit and needed three. Break at the
space and fall back to the character walk only for a word wider than the measure.

**And size the tolerance to the unit the defect comes in.** A table row's height is a sum
of many small estimates, so a few pixels of slack is right there. A wrapped line is a
whole line or nothing, so the same slack suppresses a real collision that reaches two
pixels into the row below, which is exactly what it did until the tolerance was cut to
one pixel.

- **A shape that is usually right is still reported**, with what makes it defensible in
  the message (「순서형이라 되풀이가 옳을 수 있다」), so the reader judges it instead of
  never seeing it.
- **A judged finding is retired in the baseline with its reason**, never in the code.
  Retiring writes today's findings and the reason goes beside each one; an entry with no
  reason still fails. The judgement is then visible to the next reader and dies when the
  page changes.
- **A measurement that disagrees with the builder's is a candidate, not a false
  positive.** Font metrics taken outside the builder differ from it by a couple of
  percent, so a value near a line boundary can go either way; report it and settle it
  against a PDF made from the built deck.
- **An exemption declared in the project's config is printed too**, at a tier of its own,
  so a page nobody has looked at since the exemption was written is not silently counted
  as finished.

## Running them

The order is fixed:

1. **Pre-flight**, inside the build: `abspath`, `renderer`, `typefloor`, `contents`,
   `chapter_pages`, the source rules the project declares, the Korean audit, and on a slide deck
   the project's cross-deck citation, plan coverage and figure snapshot checks. A failure stops
   the build.
2. **The render**, all pages. Error 0, and every warning accounted for as SKILL.md (「The loop is
   not optional」) defines it, is the bar.
3. **`layout`**, the deck tool's own checks with every kind named, ink and package included,
   and the deck's declared rules.
4. **The after group**: `renderer` first, then `rowheight` and every other declared check; on a
   slide deck the project's own sequence census, density, verdict and column fill checks.
5. **Figure verify**, over the figure directory.
6. **The delivery**, `check.py run deliver`, when the deliverables are due.

The shared checks read the deck from the server that holds it, so an edit applied in the
application is checked before it is saved. A project check that reads files on disk reads
the deck as it was last saved; save the deck before running such a check.

**A check run by hand names a directory, never a deck file**, where the project guards its
deck sources against writes from the shell: a script handed a deck file may write it, so
such a guard refuses the line whatever the script does. Hand the Korean audit the chapter
directory, not the files inside it, and give a probe its deck through an environment
variable.

**Measure the fill rather than eyeballing it.** On a document deck `grade` measures it on the
server's layout: the lowest drawn box of the body against the body's inner box, and each
column of the row that closes the page against the others, because the lowest box on the page
belongs to whichever column runs longest and a tall figure in one column reports the page as
full while the other stops halfway. A slide deck's preview-image fill check finds the lowest
row that carries ink, excluding the folio band, and reads a column layout per column for the
same reason. Covers, dividers, contents pages and a closing slide are exempt; their whitespace
is the composition.
