---
name: slide-decks
description: The typesetting standard for a deck compiled to PowerPoint - a portrait document volume such as a proposal, a technical document or an annex, and a landscape presentation summary. Carries the design contract, the page and slide rhythm, components and their catalogue, the running head, page fill and budget, figure boards and placement, the checks a deck must pass, and how editorial judgments are made and confirmed. Tool-independent; how a deck is written in its tool (markup, server, builder) is that tool's own skill, for SlideGlance the slideglance-pptx skill and its MCP server. Reads every path, board and check from the project's `.claude/slide-decks.json`. Use before editing anything under a deck directory, adding or allocating pages or slides, placing or redrawing a figure, fixing a cluttered or repetitive deck, or setting a new deck up. Triggers - 조판, 제안서, 발표본, 슬라이드, 요약본, 페이지 배분, 러닝헤드, 레이아웃, 도식 삽입, 발표자 노트, PPTX, sgx, slideglance.
---

# Slide decks

A deck here is one `.pptx` compiled by a deck tool from sources: styles, masters,
components and chapter files, with prose from a manuscript and figures from a generator.
Two kinds share everything but their page shell:

| Kind | Page | Set from | Reads as |
| --- | --- | --- | --- |
| `document` | portrait, part dividers, contents, annexes | a manuscript of page-files, one section per page | a document read at print size |
| `slides` | landscape, no dividers, speaker notes | a plan, one section per slide, with the script | a presentation projected and also submitted on paper |

The page size is the project's (`page` in the config; A4 at 96 dpi is 794×1123 portrait
and 1123×794 landscape), and every width in the layout components is derived from it.

**Invoke `simplecore:proposal-writing` for every reader-facing string.** What a page
claims, how a requirement is answered in the panel's own words, the controlled language
of a title, a table cell, a figure label and a speaker note, enumerations, references and
annex naming, and the evaluator-persona review are that skill's; this one decides where
the string is set and how the page reads. A deck is typeset from copy that skill has
already settled, and a wording-only pass runs under its scope rule, not this one's.

**Invoke `simplecore:korean-docs` for the Korean sentence standard and the glossary** -
a label in a bar is body text as far as the glossary is concerned.

**This skill carries the discipline, not the contents.** Every path, command, board and
check comes from the project's `.claude/slide-decks.json` - read it first, on every
invocation, and read the deck's own `instructions` (its working rules and file map) in
full before the first edit. A required key that is absent is reported, never guessed.
[references/config.md](references/config.md) holds the schema; `assets/slide-decks.json`
is an example.

**Invoke `simplecore:svg-diagrams` before drawing or redrawing a figure.**

## The deck tool owns the mechanics

This skill says what a page must be; the deck tool's own skill says how it is written.
Markup, component syntax, the editing server and its operations, the builder's
behaviours, starter files and the tool's own checks belong there, and this skill never
restates them, because a restatement goes stale the day the tool changes and is then
followed with confidence. The config names the tool and its authoring skill (`tool`);
for SlideGlance that is the `slideglance-pptx` skill, and the server's own guide
(`sg://guide`) read once per connection. Read it before the first edit and take every
operation from it.

What carries over from tool to tool, and so stays here:

- **A deck is changed through its tool, never as files behind its back.** Where the tool
  offers an editing server, every read and write goes through it; a file edited around it
  is a write the tool cannot check, and a deck edited by hand stops being evidence of what
  the tool writes. A generated file is changed in its generator and regenerated.
- **Which host holds which deck is declared, never guessed.** One host per deck; when an
  application has the deck open, work through the connection it offers rather than a
  second host on the same files.
- **A write is made against the state it was read at.** Handles and node numbers from an
  earlier answer are stale after a structural edit; read again before the next write, and
  read the result's diff after it.
- **Measured geometry comes from the tool's checks, and no project script re-measures
  it.** Overflow, overlap, text outside its box, a row taller than reserved, the type
  floor and the sheet count are the tool's readings over the built file. Two
  measurements of one thing is how a deck ships the bug one of them fixed. What the
  project's own checks hold is what the tool cannot know: the manuscript, the tender, the
  deck's component vocabulary and rhythm, a floor that exempts a class of label, the
  Korean audit ([references/checks.md](references/checks.md)).

## The loop is not optional

A page is not typeset until a picture of it has been looked at. File count is not
evidence, and neither is a clean build.

**The tool's quick render is the editing loop and the project's full render is the
evidence.** A quick render answers 「did this land」 in one call; the checks that measure
images (column fill, page fill) and the deliverable PDF read the rendered page
directory, which only the project's render fills. So render through the tool while
editing, and run the project's render before those checks and before shipping.

**Render the whole deck only when the whole deck is the question.** A long deck takes
minutes to rasterise, and most edits are one page that just changed, so a loop of full
renders spends its time on 296 pages nobody is going to open. Reach for the full render
when the change moves pagination (a page added or removed, a chapter reordered), before
the checks that measure the rendered images, and before shipping - a partial render
leaves every other page image as it was, which is exactly what makes it cheap and exactly
why a check reading that directory would be reading yesterday's page.

**Ship at `error 0`, and with every warning accounted for.** A diagnostic is a real
layout defect until it is proved otherwise - the overflow warnings in particular are the
only thing standing between a sentence and a page break in the middle of it, so the
default is to fix the page, not to explain the warning away. **Accounted for means the
built PDF was looked at and a check reads the same measurement independently**; a warning
class the tool over-measures is settled that way once, recorded with the number that
settles it in the tool's own skill, and never re-argued from memory. A warning nobody has
taken to the PDF is a defect, whatever its size. Then the declared checks
([references/checks.md](references/checks.md)) and the Korean audit over the deck's own
sources.

**A blind tender is delivered as two copies from one source.** The panel reads an
evaluation copy that names no proposer and the client keeps an original that does; a
second set of sources for the original drifts from the first within a day. So the project
declares the submission once (`submission` in the config: the folder, the title, which
decks each copy carries, the identity each copy prints), a chapter writes a placeholder at
every string the copies differ on, and the build fills it per copy - the blind copy by
default, because that is the copy every check and review reads. The delivery builds every
copy of every volume into the one folder, blind copy last so the previews are left holding
what the panel sees; the volume of company-identifying evidence belongs to the original
only. An identity field left empty fails the build of every copy but the blind one, whose
blank is the point, rather than printing a blank where the proposer's name belongs.

## Everything repeated lives in a component

A chapter file never draws a rule, a caption, a label or a margin. It calls a component.
When the same shape appears on a second page, it becomes a component before it appears on
a third.

**A component carries shape only - never content.** Every visible string (headings, row
labels, figures, tail lines) is a parameter the page passes; a component named after one
page's story with that page's words baked in stops being reusable and lies about what the
next page will render. Name components after their form (`num-card`, `ink-band`,
`ladder-step`, `fact-band` are examples), keep one shared parameter vocabulary across the
set (a head, a body, a key, a labelled pair, a tail), and write component comments in
English. The running head is the one documented exception: its two field labels are fixed
so every page reads the same.

**The sources split by job**: tokens (colours, type, spacing) in one place, structure (the
page, the components) in another, generated files (part masters, figure placements)
marked as generated, assets (brand artwork, screens, fonts) apart, and chapter files that
hold one call per page and nothing else.

**Some chapter files are generated too, and editing one loses the work.** A deck whose
annex is built from a board or a table writes those chapter files - and often the
manuscript beside them - from a generator, and the file says so in its first comment.
Nothing stops a hand edit: the page renders, every check passes, and the next
regeneration deletes it without a word. So **before editing a chapter file, read its
first two lines**, and when it names a generator, the edit goes into the generator and the
file is regenerated. A brief that hands an agent a file to edit says which of the two it
is, because an agent told to work on one file will work on that file.

**One component is one object in PowerPoint.** A component that draws a single thing out
of several shapes is grouped into one object; layout wrappers (the page, a section, the
column shells) are not. **A surface carries its own text**: when a container would hold
nothing but a text run, the fill and the border go on the text box. **Spacing is set in
one place**: the section components own the gap above a region and between its head and
its body, the page the gap between regions; a chapter file that reaches for a margin is
working around a component that should have done it.

## The design contract

**One paper, one ink, one inline accent, one neutral ramp - and one colour per part.**

| Role | Used for |
| --- | --- |
| paper | every page, cover and divider included |
| ink | titles, headings, table labels |
| accent | one thing at a time: a keyword, a figure number, an icon, a requirement badge, a table's answer column |
| body / muted / soft | the whole grey ramp |
| part colour | page chrome only - the masthead band, the running head's numeral, the section bars, the divider, the contents row, the cover's order chips |

**The part colour and the inline accent do different jobs and never trade places.** Chrome
says which part the reader is in; the accent says which word matters. Give the accent to
chrome and every page turns into a banner; give the part colour to a keyword and the page
carries two colour systems at once. Outside those two, a second coloured family on white
reads as dirt. A deck may sanction **one** third system - a subsystem code carried by a
layered table's lane cells, or a judgement pair carried by a handful of named shapes - and
declares it in its own instructions; a block about one of those subsystems takes its pair
from the code and never invents a fourth.

**A third system's colour follows the meaning, not the slot.** A component that paints one
label green and one red at a fixed position hands those colours to whatever the page puts
in the slots, so a page that reached for the *shape* ends up printing a neutral word in the
colour the deck taught the panel to read as a verdict - and the same word can come out red
on one page and green on the next. Two things stop it. The deck names, beside the shapes,
the vocabulary each slot may print, and a check reads every use against it. And every such
shape gets a neutral twin - same box, same badge, the labels in the inline accent and the
grey ramp - so a pair that is not a judgement has somewhere to go. A conclusion, an
outcome, a chosen option and a deliverable are not passes.

**A chapter file writes no hex.** It writes a part number, and the part's bar, text and
body styles resolve from it. The palette lives in one table that emits the part styles and
the masters - a palette written out twice drifts.

**Nothing prints below 8pt, ever.** At 96 dpi a point is 4/3 of a pixel, so the floor is
**10.67 px**, for every reader-facing string. The sizes
above it carry the hierarchy - never reach below it to win a line back, never lower a
size to fit a page; a page that will not fit is split, rebalanced, or has a block moved.
The one exception is a code value standing as a label (a requirement id in a badge or a
bar's stub, an evidence number, a frame id), looked up rather than read. The type-floor
check reads the floor by style class, so that exemption does not drown its findings. **A slide deck is set for the room, not for paper**, and the sizes it is set
at are a judgement about one deck's audience and one room, so the deck declares them
(`type` in the config: the floor prose is held to, the region heading, and the lower floor
a looked-up code value may print at) and the type-floor check reads them rather than
carrying numbers of its own. Settle
them by reading the deck on the screen it will be shown on: one deck could not be read at
7.2pt and read as too large for what a slide carries at 10pt, and settled at 8.25pt body
with 9.75pt region headings. A slide then carries about half the characters a document
page does, so its content is cut to what the size allows - the density ceilings are re-set
with the size - never re-spaced tighter. **A figure's smallest label prints at the body size on a slide**: the boards are
derived from the placed widths (board = placed px ÷ (body px ÷ ladder minimum)), a
document figure is never placed on a slide as it is, and a figure that will not fit its
board at that size is simplified - fewer boxes, shorter labels, one relation - rather
than drawn smaller.

**And nothing written at the floor runs longer than the line the floor exists for.** The
smallest type carries the line that closes a region - a source, a legend, the condition the
claim above it holds under - and a page with more to say than it has room for puts the rest
there instead: three sentences of its own argument, 8pt grey at the foot of a 329px column,
five lines of fine print that a panel reads as an aside. It is the same move as lowering a
size to fit a page, made one step earlier, and every other check stays quiet through it -
the box does not overflow, the page measures full, the words are the manuscript's own.
A check measures it on the rendered box, because the same string is two lines at the
full measure and five in a column.

**Two families.** A Korean serif for display (cover, dividers, page title, contents), a
sans for everything else; the sans is the one the tool measures with, so wrap widths come
from real metrics. A third family is noise in every check that reads fonts.
The font files travel in the deck (`fonts/`) and are handed to the preview renderer and
the figure rasterizer, so two checkouts break their lines in the same places.

**One rule.** The hairline that closes the running head. Columns are divided by the
gutter; ticks before headings, dots between meta pairs, accent stubs over the masthead, an
underline under every row of a list, a line down the middle of a card - each marks a
boundary something else already marks, and together they are what turns a dense page
into a noisy one.

**Cards and bars carry the fills, and nothing else does.** A card is a discrete item (one
requirement, one device, one stage) with a border and a title bar; a bar is the head of a
whole region; a `metabox` is the running head's label/value pair; a `reqbadge` is one
requirement number standing in the body; `th` is a table's header row. A card never sits
inside another card; a page carries at most one `-ink` variant; there is no `bg-card`, no
`panel`, no `mat` - each surface carries its fill inside the one style that defines it,
so adding a box means writing a new style and having to justify it. A slide deck is the
one exception: some of its column regions stand in a hairline frame (`col-panel`,
`frame`) so neighbouring columns read as separate surfaces, and never all of them
([references/landscape-slides.md](references/landscape-slides.md#the-layouts-and-what-each-is-for)).

**A bar is two blocks, not one**: a part-coloured block with the heading reversed out,
and a neutral stub carrying whatever the region cites. The stub stops the colour running
the full measure and bounds the citation, so a requirement number in a bar needs no badge
of its own. Both blocks are one filled text box of fixed height with horizontal padding
only. A column of a multi-column layout takes a narrower stub.

**Every filled surface carrying one line is centred that way, not only a bar.** A filled
text box whose height comes from vertical padding and a line height sets the *line box*
evenly and the letters unevenly, because the line box carries descender space that Hangul
does not fill - the words then sit low inside their own colour, and the page reads as a
band with its text dropped. Nothing reports it: the box does not overflow, the page
measures full, and a bar drawn the right way two inches above it looks identical at a
glance. So a one-line filled surface - a band, a phrase, a plate, a stub - takes a fixed
height, middle vertical alignment, a line height of 1.0 and horizontal padding only; one
deck's ink phrase shipped with vertical padding and a 1.3 line height and printed its
words three rendered pixels below centre while the column bar beside it was square.
Where the text may run to two lines the surface is not this shape - give it a card.

**A requirement number inside the page body is a badge, never bare text**, and a page
whose running head names requirement ids nests them: every region bar and sub-section
heading carries the ids that block answers, a badge's ids are a subset of the page's, the
page's a subset of the manuscript section's. A region that answers none of the page's ids
does not belong on the page. **A requirement is answered in the panel's own words, on the
page** - a requirement answered in different words reads as unanswered; where the deck
writes a word differently on purpose, the pair goes into a baseline with the reason.

**A card's two rows split one claim, and the row the reader finishes on closes on a
predicate.** A row ending in 「~하고」 · 「~하며」 hands the predicate to a clause that never
comes. The same holds for a lone accent line, a `keyrow`'s value, a paragraph and a
table cell.

**A sentence closes with a full stop and a name never takes one.** A card row, a table
cell, a note and a paragraph carry both kinds of string, and the deck has to write them
the same way on every page - one deck ran 185 values with the stop and 192 without, so
the same shape read as finished on one page and unfinished on the next while every page
passed its own review. The test is the ending, not a judgement: a string that closes on
a predicate is a sentence and takes the stop, with the stop outside a trailing reference
(「~확인한다(부록 C).」); a head, a label, a bar's key and a column head are names
whatever they end in. A name that closes on a predicate is a different defect and belongs
in the name check, not this one. A check reads it and can write the missing stops.

**A figure never draws the words the page already prints.** Ten or more characters
standing verbatim in both, three times on one page, is the figure redrawing the block
beside it; cut whichever side is weaker, never both.

**A list is one shape, and the deck has one of it.** Its mark is drawn, not typed - a
`•` or a `-` in the text run is the same thing as a `·` standing in for a bullet. The
row is indented a little from the block's left edge, and the mark sits close to its
text: a mark parked in a wide fixed column reads as two columns rather than as a list,
and one deck ran 26px of white between a 2px bullet and its sentence on 749 rows.
**An ordered list written as a label/value list is the same defect wearing a
different component.** A label/value row fixes its label column so the labels
align down the page - which is what a one-glyph number does not want: 92px spent
on 「1」 prints 100px of white before the sentence, and nine such rows read as two
columns. An index goes in the list row whose mark column is as wide as the mark,
and a check reads every label/value row for a bare index. **The
row gap belongs to the list container and to nothing else** - a run of rows dropped
straight into a section's slot takes that section's gap, so the same list stands at 2px
on one page and 13px on the next while every page passes its own review. Two list
appearances for one job (a drawn dot in half the chapters, a typed bullet in the other
half) is the same defect at the scale of the document.

**A label/value row's label sits on a plate that fills its column, and one run uses one
component.** Two defects live here and they look like one. A label left-aligned in a fixed
column parks the rest of that column as white between the label and the thing it labels, so
a two-syllable label leaves 70px of paper inside its own row; right-aligning it only moves
the hole to the other side, where a run of ten rows turns it into an empty left margin. What
closes it is a filled plate the width of the column, the label centred on it - and the plate
is one line tall and top-aligned, never stretched to the row, or its text floats away from
the body's first line in every row whose body wraps. Give the plate no vertical padding and
no horizontal padding it cannot afford: padding is what makes the longest labels wrap, and a
wrapped label grows every row it is in until a column overflows its parent. The second defect
is mixing: two label/value components in one run set their label columns at different widths,
so the value column steps sideways mid-list and the minority row reads as one the layout
dropped. Write the whole run as one component, and let a check read it.

**A caveat or a note standing in a run of label/value rows takes the rows' label column.**
A plain caveat or note sets its mark in a column of their own, narrower than a
label/value row's, so one of them dropped under a run of keyrows starts its value 30px to the left
of the values above it and the column reads ragged - invisible page by page, because each
row is right on its own. An aligned twin of each is the form for that
place, and a check reads every caveat beside a label/value row.

**Two things on one row share a line, not a bounding box.** A box model has no baseline
alignment, so centring a 24px numeral against its 10.67px unit floats the unit seven
pixels above the digits and it reads as a superscript; bottom-aligning the two boxes
lands their baselines within a pixel, and a numeral set larger than the heading beside
it is lifted onto that heading's line by a margin measured off the render. **A round
plate is round and a square plate is square**: a plate needs `h` as well as `w`, because
a plate with only `w` takes the line box for its height, and `w` and `h` drifting apart
turns the circle the deck uses for a number into an oval. **A marker beside text centres
on the first line's letters, not on its line box** - the box carries leading above and
below, so a dot centred in it reads as raised. **And a column is one axis**: a contents
page whose part numeral is left-aligned and whose chapter number is right-aligned in the
same 40px column puts the two 47px apart and the column stops reading as one.

**Hierarchy is size and weight.** Colour is the accent, spent once per block. **Three
heading levels, and they do not compete**: a bar opens a region, an `h2` opens a
sub-section inside it, a card's title bar names one item; two of the three on the same
block means one is carrying nothing. **A heading's bullet is an icon - except on a bar.**
Section headings and item heads carry a Lucide glyph in the accent, chosen per heading;
a bar's accent edge is its mark. Every heading names its icon; there is no default, because
an unnamed icon fails the build rather than drawing the wrong thing. **A section heading
and the head of the first card under it must differ.**

**Headings carry the deck's item numbers, and the deck declares them once.** Where the
tender or the client's convention numbers items, every page title and every region head
takes its marker from the ladder in the config (`numbering`), restarting where the config
says; a card's head, a table row and a list row take none. The number is part of the
heading string, so a renumbering pass strips an existing marker before it writes one,
and a page moved between chapters is renumbered with its chapter rather than by hand.
The contents and the dividers already number the chapters; the ladder starts one level
below them.

**A table is an open-side grid with a centred header**; a column that reads as a grid
(marks, codes, names) centres, a prose column stays left. A table whose rows fall into
groups takes a lane column - one merged cell per group in the group's tint - when the
grouping is real. **A table's value column is the one systematic accent**: where a table
works a calculation or states a design figure, the answer column carries the accent on
every row. **De-tabling has a judgment test**: a row of four or more short attributes
scanned by column stays a table; one to three prose attributes answering what/why/how
becomes a labelled-row card, chosen by the content's shape
([references/body-pages.md](references/body-pages.md#choosing-the-shape-of-a-regions-body)).
**One replacement pattern applied everywhere is the table monotony reborn.**

## The running head is identical on every page

A document page carries a masthead band, a grey panel with the part line and the section
path on the left and two label/value rows on the right, the page title, one claim, and the
hairline. A slide compresses the panel to one row and adds the cross-reference to the
document it summarises; and because a slide deck is projected, not printed, its chrome is
two full-bleed bands with no border and no margin - the head naming the part and the
document cross-reference, the foot the evaluation items, the requirement ids and the
folio.

**The head's bands run the page's width and start at its edge.** A band inset to the text
measure leaves a strip of paper above it that carries nothing, and the reader's eye starts
below that strip on every page; taking it back is the cheapest room a deck has - this one
gained 45px on 291 pages, about 5% of the text block, without moving a single word. The
type inside is the exception: **the masthead's own text stays on the text measure's right
axis**, because a band may bleed and a letter may not - the deck's first attempt put the
masthead one pixel from the trim. Give the band enough height that the type has air above
and below it rather than filling it edge to edge.

**The client's mark belongs on the chrome; the proposer's belongs nowhere on the blind
copy.** A blind evaluation bars the bidder's name, logo and people - it says nothing about the
organisation the work is for, whose CI a bid deck carries the way any document
addressed to somebody carries their letterhead. So the mark is a master's, not a
page's, and it stands at one fixed place per master family: the cover and the closing
artwork share a coordinate, and every body master takes the end of the foot band that
the page's own foot row stops short of. A family that shows no page to the panel (the
contents artwork) carries none. The masters are generated, so the placement is one line
in the generator and the deck's instructions name the coordinate - an image added by
hand to the generated `master.xml` is gone at the next build, silently and with every
check still green. **The original is the one copy that carries the proposer's mark**, at
the other end of the same foot on every content page, rasterised at build time from the
file the copy's identity declares; the copy that declares none draws nothing there.

**A page that borrows the contents' shell but is not the contents carries no locator.**
「차 례 · n / n」 tells a reader where they are inside the contents; a lookup table on the
same ground says something false by carrying it, and the contents' own count then has to
be read without it.

**The foot band's pairs are sized per page, and a check reads the render.** The band
carries two label/value pairs to the left of the folio, and the two longest values
never share a page - one deck's longest item is 206px and its longest id list 228px,
against 370px of band after the labels. Give the first pair the width its own value
needs (measured in the deck's face and written into the chapter as `evalW`) and let the
second take the rest; fixed columns wide enough for each longest value do not fit
together, and a value that wraps prints its second line over the band's edge where the
panel reads it as a caption that slipped. The tool's width estimate is not the
verdict either way - it over-measures Hangul and under-measures a run of ids - so a
check reads the ink height of every rendered band.

Either way **a page passes its head values and nothing else**, and
a field the page has nothing for takes 「해당 없음」 or 「 - 」 - a head that changes shape
between pages is the thing the component exists to prevent.

- **The first row is `0` + the part number + the part's name.** The leading zero is the
  lightest neutral and the digit is that part's colour, so the character that changes
  between parts is the one the eye lands on. `part` is the name without the numeral.
- **The meta pair carries no box.** The panel already bounds it.
- **What the two rows name is the deck's decision** - an evaluation item and the
  requirement ids, a screen id and its requirements - and the deck's instructions say so.
  A score or a weight is never printed: the deck answers the item, it does not quote
  the weight back at the panel.
- **A cross-reference is computed, never typed.** A page number in a contents page or a
  조견표 is derived from the deck's own import order by a check that fails when it is
  stale.
- **A cross-reference into *another* deck names its chapter and section, never its
  page.** Computing the page number does not save it: the other deck is still being
  written, and a page added anywhere before the target moves every reference after it.
  One presentation had its 41 body slides rewritten from the proposal's import order and
  38 of them were stale again an hour later, because the proposal had gained a page - so
  the deck would have printed page numbers landing a page or two off every time a panel
  member followed one. A chapter number and a section name survive a repagination, and
  go stale only when the other deck renames or drops the section, which is exactly when
  the check should fail.
  **Carry the section name, not the chapter number alone.** A contents page that lists
  parts and chapters and stops there leaves a chapter number pointing seven slides at
  one 45-page span; the section name is printed in the other deck's own running head on
  every page, so the reader opens the chapter and stops at the right spread. The
  chapter's *title* is still computed - read it from the cited deck rather than typing
  it, so a renamed chapter cannot leave a stale title behind.

## One page, one thing - and that page is full

A sentence or a paragraph never continues onto the next page. There is no text flow: what
lands on a page is decided in the chapter file. When a section outgrows its page, split it
into sub-sections and give each its own page with its own title.

**When the page count has to come down, the figure stays and the prose goes.** A figure
carries a relation, a sequence, a distribution or a boundary in a fraction of the height
the same content takes as sentences, and it is already drawn and already paid for. So a
deck over its limit is condensed **around its figures**: the page's claim is given to the
figure, and the prose that survives is only what a figure cannot carry - the exception,
the threshold, the acceptance criterion, the number the panel checks against, the sentence
the RFP demands in its own words. A sentence that restates what the figure draws is not a
summary of it; it is the same content bought twice, and cutting it costs the reader
nothing. Where a section has no figure and is being asked to shrink, drawing one and
deleting the paragraph it replaces is a smaller job than rewriting the paragraph.

**A submission has a sheet count it may not exceed, and every page fills toward it.** The
fill rule below and the parity checks both push work onto the page; nothing pushes back,
so a deck that starts under the cap walks past it one justified page at a time. Declare
the cap in the deck's rules and let the tool's sheet count read cover, contents,
dividers, body and annex against it on every pass. When it fires, the page count comes down by condensing
the manuscript or by re-packing the annex - never by lowering a type size, and never by
leaving a page half full.

**A body page is filled to the bottom of the text block.** A page that ends early reads
as a page the author had nothing to say on, and in a bid document that is the impression
the panel takes away. Measure it ([references/checks.md](references/checks.md#running-them));
anything short of the bottom needs more on it, in this order and never by padding:

1. bring back what the manuscript already has (the parity check's `--coverage`);
2. merge two thin pages into one;
3. restore what volume trimming took out (the commits are per part);
4. split a wide table into two narrower ones.

**The material is often a whole section the deck declared and never typeset.** A page
names its manuscript in a `<!-- md: -->` comment above itself, and that declaration is a
promise; a page may declare two sections and carry one of them, and nothing on the page
shows it, because the page that results is full, shaped and passing every check. So the
short page beside it is filled from a section already assigned to it - a check names
the sections and the pages that owe them. Where the section is too big for the page's
remainder, it gets a page of its own rather than a paragraph of itself.

**A page whose content is one picture is filled by the picture.** The fill rule
forbids inflating a figure to cover a hole in a page of prose; a page whose
subject *is* the capture is the opposite case, and a capture read at print size
is the whole point of such a page. Measure the foot of the rendered page and
grow the capture into what is left, up to the text block's width - a script that
reads the lowest ink on each PNG converges in one pass, because the capture is
the only thing that moves.

**A section whose body is a table opens a page of its own.** Two tables of
different content sharing a page read as one table with a heading dropped into
the middle of it, and the reader carries the first table's column meanings into
the second. The break is forced before the section bar, and nothing that
rebalances pages afterwards may undo it. **The exception is an appendix whose
sections are one list cut into groups** - a bibliography, a glossary, a
traceability matrix. The reader reads it as one run, the columns mean the same
thing in every group, and a page per group buys nothing and costs pages; one
such appendix ran to eight pages and reads better in four.

**A table that will not fit is shortened by what it prints, not by what it
says.** Two moves recover most of it. A printed URL drops the scheme and the
`www.` every address carries - the manuscript keeps the real link, and
`https://www.law.go.kr/…` printed as `law.go.kr/…` is two characters short of a
line on every row. And a column whose values are two or three repeats is a
sentence, not a column: 「확인일」 holding one of two dates becomes the line that
opens the section (「기술 근거 1~6은 …에, 7~36은 …에 확인했다」), which keeps every
date and gives its width to the columns that wrap. Measure the alternatives
before choosing widths - the arrangement that reads as balanced is often not the
one that fits.

**And a table that runs past one page fills that page before it starts the
next.** Evening two page heights across a table looks like care and reads as a
mistake: white space under the rows says the table has ended, so the reader
turns the page expecting the next section and finds the same table with its
header printed again. A table that fits one page is never cut for balance
either. Fill, spill, and let the last page carry three rows - that is the
honest picture of how long the table is.

**Never fill with spacers, blank rows, inflated line-height or a bigger figure.** A column
layout is measured per column: both columns reach the bottom - **and measured means
measured, by a check that reads the columns' own x ranges.** A page-level fill number is
met by whichever column runs longest, so a page whose wide column is full and whose
narrow column stops half way passes every reading of that number; one deck carried ten
such pages while its page fill read 90 % at worst, and each of them reads to a panel as
a page the author had nothing more to say on. **A hole in the middle of a
page is not normal** - no `class="fill"` pinning a trailing block on a body page; the
cover and the divider are the exception, where the bottom cluster is the composition.
Covers, dividers, contents pages and a closing slide are exempt from the fill rule.

**A long annex is bound in groups, and each group opens with a divider.** An
annex of eight appendices behind one divider gives the panel no way in: the
reader who wants the screen design and the reader who wants the evidence open
the same undifferentiated run. Group the appendices that answer each other
(requirements with the screens that implement them, an owned asset with what is
additionally offered), open each group with a divider carrying the group's
letters, its name and a foot naming the appendices inside, and let the appendices
that carry real bulk keep a divider of their own behind it. The annex's own
contents then reads by group - one merged lane cell per group - and the deck's
contents lists the group ranges rather than one annex row.

**The part dividers of a document deck hold one shape** - a kicker, the numeral, the
title, an accent rule, a lede and a footer that is that part's chapter list in the
contents' own words and order - and the footer is an even grid whose cell width the
chapter file passes. A numeral set in a serif needs a per-part left correction from the
font's own side bearing; the deck's instructions carry the values.

## A volume that reproduces a document is placed whole, never typeset

A submission often carries a second volume that is not written at all: issued
evidence, a signed form, an annex the tender supplies as its own file. It is
still a deck - it needs the submission's cover, a list of what is inside and the
folio the tender asks for - but its body is somebody else's document, and **the
only correct treatment of a page of it is the whole page, unedited.** No running head
over it, no caption, no crop, no highlight, no redaction: each of those alters a
document another body issued, and a panel that spots one has to wonder what else
moved.

- **The pages are generated from the source, never listed by hand.** Declare the
  file (`sourceDocument`), lift one picture per page out of it, and write the
  body chapter from what was written. A page count typed into a chapter file
  goes stale the moment the source is reissued, and nothing reports it.
- **Take the embedded image byte for byte where the page holds exactly one.**
  These volumes are scans, and re-encoding one costs sharpness on the seals,
  issue numbers and barcodes that are the entire reason the page is submitted.
  Rasterize only the pages shaped some other way, and record which of the two
  each page was.
- **Measure `w` and `h` from the file's own pixels.** `<Image>` does not
  preserve aspect, so an assumed pair stretches a certificate silently. Fit the
  page by height, fall back to width where its proportions are wider than the
  box, and centre it in what is left.
- **One check reads the built file, because nothing else can.** A media path
  that fails to resolve prints a page with a hole where the picture was and the
  build stays green. Read the `.pptx`: one picture per body page, at the offset
  and extent that were measured, and a page count matching the front matter plus
  the source.
- **The fill rule does not apply to these pages** - the picture is the page -
  and neither does the shape census, the component rhythm or the running-head
  contract. What does apply is the deck's own two pages, which follow the design
  contract exactly, because the panel reads the volumes as one submission.
- **The contents is written by hand and points at this volume's folios**, not at
  the source's own page numbers, and it names each document exactly as the
  issuing body prints it - a shortened name is a name nobody can look up. It
  changes in the same commit the source does. **A volume of a few dozen sheets
  puts that list on the cover rather than on a page of its own** - a contents
  page carrying a dozen rows and half a page of paper reads as a page that lost
  its second half, and the cover has the room. Where one group runs to many
  near-identical documents, the group's own line is the entry and the documents
  under it are not listed.
- **Where the tender's blind rule binds only the evaluation copy**, this volume
  is usually the 원본 and names the proposer. Never carry that habit back into
  the copy that is scored blind.

## Every component says what it is for, in its own declaration

A deck grows a hundred components and keeps a prose table naming twenty of them.
The table is what an author reads, so the deck uses twenty: the page that needed
a numbered identity band gets another bullet list, and no review catches it
because each page is fine on its own. One deck reached 199 body pages of which
**135 carried at most one card kind and 67 carried none**, while 22 of its
components had never been used - and the chapters somebody had filled with
bullets carried 0.68 card kinds per page against 1.17 for the ones set by hand.

So the index is not a file kept beside the components. **A component declares
itself where it is defined**, and the tool's catalogue reads those declarations:
what it is in one line, when to use it, its shape (card, row, grid of three, strip,
chip, figure, page) and the words it is found by. Styles and masters declare the
same where their name does not already say it. None of it is applied to anything
drawn. How a declaration is written is the tool's grammar.

- **What it is, phrased as the *content's* shape, not the component's** -
  「two labelled rows under one head」 and, for when to use it, 「a demand facing
  the answer to it」, not 「a split card」 - because the author has a manuscript
  page open, not a component list. It is unique across the live set: two
  components that answer the same sentence are one component and a decision
  nobody made.
- **When to use it names the neighbour a wrong choice lands on.** It is the
  field that does the work; a catalogue of what each shape *is* still leaves the
  author guessing which of four they meant.
- **The tags also say what is not vocabulary.** `reserved` is held back by a rule
  the deck already has (one dark surface per page, one of two covers);
  `deprecated` is superseded and waiting to be removed. Listing those beside the
  shapes nobody has reached for is what made a census's unused list unreadable.
- **A fact a rule reads is verified, and a description is not.** 「one dark
  surface per page」 needs to know which components stand on an ink ground, and a
  tag is a claim until something reads the component's own ground and fails when
  the two disagree. It says nothing where the ground cannot be resolved exactly (a
  class the page substitutes into, a style the build generates): a checker that
  guessed there would call a part-coloured bar dark, and one wrong verdict is
  enough for everybody to stop reading the check.

**The tool holds the index, so the deck does not generate one.** Search the
tool's catalogue by purpose, shape and tags before writing a component, and give
every new component its declaration - one without it is found by its name alone,
which is how a shape falls out of the vocabulary. A generated catalogue file
beside the components starts complete and stops being complete on the next one.

**And a shape is chosen by looking, because nobody picks one from a name.** Draw
the candidate alone with the page's own arguments before choosing it, so choosing
becomes looking, which is the part a table could never do.

**What the tool does not judge stays a check of the deck's own**: that every live
component carries a declaration, that no two claim the same purpose, and that a
neighbour named in one is one the deck actually has. The last fires the moment a
component set is copied between decks - the second deck's set is a clone with its
own layout names, so a neighbour named in the first points at nothing in the
second, and sixteen of one deck's declarations did on the first run.

**A body page needs a shape that is not a paragraph and not a list**, and the
page-shape check measures it: a page whose body is prose and bullets under every
heading, and a 「list」 of one row, both fail. Run as a simulation, it reads every
list run, says what the content's own form asks for - 「라벨: 값」 twice is a
labelled pair, an ordinal in half the rows is a numbered row - and then **picks
under the rhythm rules**, so the deck does not trade one monotony for another: no
component the page before it leaned on, none past a third of its 부, one dark
surface per page. Run it before rewriting a page, never after.

## Every judgment step has a first pass and a confirmation

Choosing a component, judging a page monotonous, finding a block that restates its figure,
picking a fill remedy and choosing what a condensed page drops are judgments, not measurements.
**Where Jev is available it makes the first pass and the agent confirms; where it is not, the
agent makes both**, with the same questions, the same shortlists and the same confirmation.
Before the first such step in a session, read
[references/decisions.md](references/decisions.md): how availability is checked, the steps and
their candidates, why a shortlist and not the catalogue, and how the report names who decided.

## A run of pages must not read as one page repeated

A hundred pages of *landscape figure across the top, cards underneath* is one page
printed a hundred times, and no individual page looks wrong, which is why it survives
page-by-page review. **The shape a page closes on is part of that rhythm**: a deck
whose every region ends on the same labelled row reads as one page mirrored even when
its layouts alternate correctly, and no sequence rule reaches it because a closing row
is not a sequence. Give the closing shapes a ceiling of their own and vary the ones
over it - a verdict closes on a verdict row, a measured figure on a stat row, a
label/value pair on a plain key row. So the placement rotates and the rhythm check enforces it: no placement
three pages in a row, two consecutive vertical figures not on the same side, two
consecutive pages not sharing both placement and most-used component. The whole
component set is in use - the census per part fails when one component carries more
than a third of the card uses. The placements, the component index by content shape, the
column layout and the procedure from manuscript page to deck page are in
[references/body-pages.md](references/body-pages.md); the slide layouts and their rhythm
are in [references/landscape-slides.md](references/landscape-slides.md). A slide deck
has a sequence census instead - one sequence shape per slide, none on two consecutive
slides, none on more than a third of the body slides - and a density check, which keeps a
full slide from becoming a crammed one.

## Figures

Every figure is drawn by code in the project, saved on one of a few fixed board widths,
and placed by the build at the width the board decides; the chapter file cannot squeeze a
landscape drawing into a column. A slide deck reads the document deck's figures as they
are and adds its own re-laid or new ones on slide boards; the rules for reuse, re-layout
and replacing prose with a drawing are in [references/figures.md](references/figures.md).
Diagrams are drawn on the paper theme; a dark figure on a white page reads as a block
that arrived from somewhere else.

## Slides

A slide is a page with less height and more reading distance: a one-row head, two- and
three-column layouts, asymmetric ones for an argument beside its measures, a rail for an
index beside its body, a screen layout for a capture beside its notes, and a stack for
two full-width regions. **Prose stays in the head - the title, the one-line claim and a
note or source line; the body is short phrases in shapes** (a flow, a chip row, a matrix,
a tile, a schedule, a pillar), and a figure or a capture stands without a caption. Every
scored item and every requirement the plan assigns appears on the slide it is assigned
to, in the panel's words, not only as an id; a function slide shows the demand, the
implementation, the verification and the deliverable together; the script goes into the
slide's notes. A slide is compact and full: paddings, gaps and bars one step tighter than
the document's, and the room that buys is spent on content. [references/landscape-slides.md](references/landscape-slides.md)
carries the geometry, the layouts, the rhythm across slides, the cover, contents and
closing shells, and the per-slide checklist.

## A guideline the user gives is written down in the same change

When the user states a rule for a deck - a register, a shape, a spacing, a size, what a
slide may or may not carry - it is written down **in the same change** that applies it to
the deck. A rule that lives only in the conversation is gone next session, and the next
deck breaks it while reading as compliant. Two places take it, and which one is not a
matter of taste:

- **A value or a list one deck chose** - a type size, a palette, a density ceiling, a
  judgement pair, the word the tender uses for its annex, a check's threshold - goes into
  that project's `.claude/slide-decks.json`, never into this skill. A number written here
  is a number some other project silently inherits.
- **A rule that would be true of the next deck too** - why a shape reads wrong, what a
  page may not do - goes into this skill, in the reference it belongs to and in the page
  or slide checklist.
- **A trap the deck tool sets** - a write it refuses, a value it mis-measures, a
  behaviour of its builder - goes into the tool's own skill, not this one.

Say in the reply which file received it.

## Reviewing the document as its evaluators

A deck written for a panel is reviewed by a mock panel. The workflow, its rubric and its
stopping conditions belong to `simplecore:proposal-writing`; what this skill contributes
is the rendered verification each round ends on.

## Tell checklist

Adapted from tasteskill §9 (MIT, © 2026 Leonxlnx), the entries that transfer to a dense
printed deck.

- **No section-number eyebrows.** `01 / 02 / 03` in front of step headings.
- **Ration the middle dot.** `·` separates parts of a domain compound; it does not
  separate list items and never appears twice in one meta line.
- **No decorative hairlines.** A line that does not separate two things is decoration.
- **No border above and below every row** of a label/value list. Spacing.
- **No three equal cards.** Two columns of three, or an asymmetric split.
- **No pure black**, no glow, no gradient text, no oversaturated accent.
- **Control hierarchy with weight and colour, not raw size.**
- **No bare abbreviation list.** A row of term-and-expansion pairs under a figure or at a
  page's foot, standing on its own as a 「범례」, reads as filler and is cut even when the
  manuscript carries it. Expand an abbreviation at its first use in the page's text and keep the
  full list in the annex glossary.
- **No fake-perfect numbers.** Every figure is traceable to the source or to a
  measurement; an invented round number is worse than no number.

**The em dash is never written**, in a deck's copy or in these files: the Korean
standard's rule pack bans the character outright, and a Korean serif has no U+2014
glyph anyway, so a title, contents row or quote carrying one loses the character
silently. Cause, contrast and condition take a connective, a gloss takes a comma or
parentheses, an itemisation takes a middle dot, and where none fits a spaced hyphen
stands in; the build still fails on one it finds in a display slot.

## Pre-flight

Run every line. A failure means the page is not done.

1. The deck is saved, the tool reports no problem, the project render returns
   `error 0 · warn 0`, and the tool's catalogue names no live component without a
   declaration.
2. Every page PNG has been looked at, from a project render of the whole deck rather
   than from the pages the editing loop happened to draw.
3. No sentence continues onto the next page; no page has a hole in the middle; every
   body page reaches the bottom of the text block, both columns of a column layout.
4. The running head is present and the same shape on every content page, its fields
   filled and no score number anywhere.
5. Rules on the page: the running-head hairline. Count them.
6. Tinted surfaces on the page: the masthead band, the head panel, each section bar with
   its stub, table header rows, a layered table's lane cells. Nothing else. Every heading
   and item head carries an icon; no `·`, `-` or `•` stands in as a bullet. Every coloured
   surface is that part's colour or the declared third system's, and no other - and a
   check reads every hex a hand-written source writes against the declared inventory,
   because an undeclared family arrives through a component's fixed slot rather than
   through anybody's decision. Every list row sits in the list container at one indent,
   one mark gap and one row gap; every plate is the shape its name says; two sizes on
   one row stand on one baseline.
7. Every figure is at a placed width its board decides, with its own height, and its
   caption carries a number.
8. The Korean audit reports zero errors over the deck's sources.
9. The tool's layout checks (overflow, overlap, text outside its box, row height, the
   package as shipped) report no finding, and its rules check (sheet count, palette,
   type floor, notes) reports 0 failed.
10. The rhythm check (document) reports 0 on both counts; for a slide deck, the coverage
    check names nothing the plan does not know, the cross-reference check reports no
    stale reference, and the sequence census and the density check report 0.
11. Enumerations are checked in the manuscript, typesetting source and rendered page.
    Independent items are not buried in a long paragraph. Set them as a simple list
    in one or two columns; use numbered items when order affects the result.
12. For a wording-only review, compare the source changes against the starting version:
    only text and notes change; diagrams, layout attributes, styles and slide order do
    not. Apply item 11 through wording within existing slots, without rearranging them.
