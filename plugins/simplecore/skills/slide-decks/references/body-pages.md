# Writing a body page

`SKILL.md` decides what a page may look like - the palette, the rule budget, the running-head
contract, the fill target. This file decides how a **document deck's** body page gets written
(a slide is in [landscape-slides.md](landscape-slides.md)): the procedure from a manuscript
page to a deck page, what a page carries, which component carries which kind of content,
how the headings stack, how a run of pages is kept from reading as one page repeated, and where a
figure goes.

Read it before typesetting the first page of a chapter, and again when a stretch of finished pages
starts to look the same.

How any of this is written in the deck tool is that tool's own authoring guide (for SlideGlance:
the slideglance-pptx skill and the server's sg://guide). This file states the properties a page
must have, whatever tool compiles it.

## The procedure

A manuscript page-file (one section file under the deck's manuscript directory) becomes one
chapter of the deck holding one or more deck pages.

**The chapter is composed before any page is written, and the composition is a design input,
not a check run afterwards.** Typesetting page by page in manuscript order - each `##` section a
full-width region, each region the component its Markdown form suggests - produces pages that are
each correct and a chapter that is one page repeated: one chapter came out with `keyrow` carrying
17 of 21 component uses, 9 of 13 pages a plain stack of full-width blocks, and four component kinds
over thirteen pages while fifty sat unused. The rhythm check reported all of it and the chapter was
still reported done, because the rules sat at the end of the procedure as something to verify. So
before the first page, write the chapter's storyboard (in the working notes, not in a document):
one row per deck page with its claim, its composition (from the placement table below, the
non-figure compositions included), its grid (stack, two columns, asymmetric columns, rail) and its
lead component. Read the storyboard against the rhythm rules and the census first, and only then
write pages. **Consistency comes from the shared chrome, the type ladder and the component
grammar; monotony comes from repeating one arrangement, and the two are not traded.** Pick the
arrangement the content suggests most strongly that the neighbouring pages have not used.

In this order:

0. **Storyboard the chapter**, as above. Run the component search for each page's lead content
   and draw two or three candidates alone before choosing; a component no page in the part uses
   yet is preferred where it fits.
1. **Read the page-file and its figure(s).** Note the claim each `##` section makes and the
   content's kind - a record set, a sequence, a demand and its answer, a set of parallel items, a
   measured figure. **The manuscript's Markdown form is not the page's form**: a Markdown table may
   be a record set (stays a table) or a set of three parallel items (cards, a strip, a ladder), and
   a section that argues becomes a region of cards.
2. **Decide how many deck pages it is.** The manuscript's page budget gives the chapter its pages;
   divide by the chapter's page-files. On an A4 text block a deck page holds about 650 characters
   beside a full-width figure and about 1,150 across two columns with a table, and a sentence
   never continues onto the next page.
3. **Write the claim line for each deck page first** - one claim per page - then the title, a name.
4. **Pick the figure's placement from its claim**, then check the rotation (below). A page whose
   claim wants a column placement needs a figure drawn on the column board; if the manuscript's
   figure is on the full board, redraw it there, keeping its number and caption.
5. **Map each `##` section to a region**, choose the component by the content's shape under the
   storyboard, and write the page. Two regions side by side are as ordinary as two stacked: a long
   narrow list (requirement ids by topic, a register of names) runs down one column while the
   other column stacks the tables or cards it indexes.
6. **Build, render, look at the picture, measure.** The page is done when its content reaches the
   bottom of the text block; the parity check's coverage listing names the declared manuscript the
   page does not show yet, and that is what fills the rest. Then run the deck checks. Only then
   the next page.

A figure that does not exist yet is added to the manuscript first - the image line, the caption
line and the row in the manuscript's figure list - and to the deck second. The figure-numbering
check fails a deck page whose number the manuscript does not carry, so the two cannot drift.

## What a chapter holds

One deck chapter per manuscript page-file, holding as many pages as that page-file needs, in
printed order, and nothing else.

**A section that needs a page gets that page in its own chapter, at its own place in the deck's
order.** The tempting shortcut is to append it to a chapter already open - the neighbouring
section, the one the page cites - and the page then reads fine on its own while the deck's order
no longer follows the manuscript's. Figure numbers are what say so first: a figure belonging to the
manuscript's fourth section, printed inside the chapter that draws the first, makes the chapter's
figures come out `1 4 2 3` and the figure-numbering check fails the whole chapter. Renumbering is
the wrong repair - it moves four figure files, the manuscript's own captions and every reference
to them, to hide a page that is simply in the wrong place. Move the page.

Every page carries, beside its body:

- **A layout note** - the page's identity and the placement it uses, in the names of the
  placement table below (「세로 도식 + 단」, 「전면 도식 + 3단」, 「표 한 장」). The rhythm check
  reads the placement from the page's structure, not from this note; the note is for the person
  scanning the source.
- **A manuscript declaration** naming every manuscript file the page draws from. The parity check
  reads it: a page with no declaration is invisible to the parity check, and a manuscript file no
  page claims is reported as unplaced. When one page-file becomes three deck pages, all three
  carry the same declaration.
- **The head values**: the folio, the part, the chapter line, the title, the claim line and the
  deck's two meta fields. Never drop one - print 「해당 없음」 or a hyphen. The deck's instructions
  hold what each means. The chapter line is 「장 번호. 장 이름 · 이 쪽의 주제」, and it stays the
  same across the deck pages of one page-file while the title and the claim change.

### How a manuscript parity check reads a page, and what that costs

Where the deck runs a parity check against its manuscript, three kinds of string on a page are
compared three different ways, and every 「없음」 finding comes from mixing them up.

- **A body paragraph** is split into sentences and each sentence must be a **substring of the
  manuscript**. Copy them; never paraphrase, never trim a clause out of the middle, and never put
  two non-adjacent manuscript sentences in one paragraph - the check reads them as one and finds
  neither. A shorter substring of one sentence is fine.
- **A short field** - a card head, a card body, a value, a label, a table cell - is matched as
  one loose string with the separators stripped, so it may be shortened to fit a column and two
  *adjacent* manuscript sentences may be joined. Skipping a clause in the middle still fails.
  Anything under six characters is not checked at all, which is what makes a short card head or a
  two-glyph label free. **「shortened」 means a contiguous run of the manuscript's own characters,
  not a phrase rebuilt from its words**: 「결재선 확정」 fails beside a manuscript that says
  「결재선을 확정한다」, because dropping the particle out of the middle leaves 「결재선확정」, which
  the manuscript nowhere holds. A coined head of two words is the shape that keeps hitting this -
  either take a run the manuscript actually prints, or keep the head under six characters.
- **The deck's own punctuation conventions are normalised away, on both sides.** A full stop is
  one of them: a deck that closes a sentence with 「.」 beside manuscript tables that do not would
  otherwise report every cell the convention touches as a claim with no source. The same holds
  for a separator swapped to fit a column.
- **A printed URL and a manuscript link are the same string.** The manuscript writes
  `[개인정보 보호법](https://law.go.kr/…)` and the page prints 「개인정보 보호법 (law.go.kr/…)」,
  because the deck drops the scheme and the `www.` from a printed address. The check unwraps the
  link and strips the scheme on both sides before comparing; a check that does not reports a
  whole bibliography annex - 43 correctly typeset citations in one deck - as claims with no
  source. A finding that lands on a whole annex at once is the check, not the page.
- **A heading** - a region bar, a sub-section heading, an item heading - is checked word by word
  against the manuscript's tokens. 「사업 특성 · 제안 대응」 passes where 「사업 특성과 제안 대응」
  fails, because 「특성과」 is not a token the manuscript holds. Separators are not words, so `·`
  joins two manuscript phrases for free. **A plain section label that is deck furniture is not
  checked at all** - reach for it when no wording that says the right thing survives the word
  check.

**A head that carries the subject and a body that carries the predicate is one claim, and the
coverage listing cannot see it.** The manuscript writes 「운영자는 배치·연계·에이전트·저장공간의
이상을 확인한다」; the card names the role in its head and opens the body at 「배치·연계…」, which
is what stops the page reading the name twice. The parity check passes, because the body is still
a run of the manuscript's own characters - but the coverage listing compares whole sentences and
lists that one as untypeset. **That listing is not a defect and the manuscript is not what to
fix.** Never edit a manuscript sentence to make a coverage line disappear: the claim is on the
page, split across two fields the way the deck's own components are built to split it.

The title, the claim line and the caption are deck furniture and are not checked against the
manuscript.

The title is a name, not a sentence, and the claim line is the one claim the page proves. Write
the claim line first: it is the sentence the whole page has to earn, and the page is finished
when a reader who reads only the claim line and looks only at the figure has the argument.

## The page opens with something that is not a paragraph

A body page that begins with prose reads as the continuation of the page before it, and a hundred
of them read as one long document with no landmarks. A page opens with a figure or with a shaped
block, and which one is a decision, not a habit. The shape names below are one deck's vocabulary,
given as examples:

| Opener | Use it when |
| --- | --- |
| a figure | the claim is a structure, a sequence, a boundary or a quantity |
| a fact band (e.g. `fact-band`) | the claim is a number with three supporting numbers around it |
| two principle items side by side | the page argues two principles that hold over everything below |
| a proof strip (e.g. `proof-strip`) | the page exists to prove one statement and name the evidence |
| a section whose first child is an input-operation-output lane or a card | the page is one mechanism, explained at once |

After the opener, the page is regions. A region is a heading plus its body. Two or three regions
is the usual page; one is right when that region is a table that fills the page; five is a page
that should have been two.

## Three heading levels, and they never compete

| Level | Example shape | What it opens | Carries |
| --- | --- | --- | --- |
| region | a region bar (plain, with requirement badges, ink, quiet) | a whole region, spanning the text block | its text and a citation or requirement numbers |
| sub-section | a section heading with a body | a division inside a region, or a region without a bar | an icon and its text |
| item | a card's head | one item | the head |

**One bar per region, headings beneath it.** A region bar immediately followed by a sub-section
heading with nothing between them means one of the two is carrying nothing - drop the bar and let
the heading open the region, or give the bar a body.

**Every sub-section heading carries an icon; a bar never does.** The bar's coloured edge is its
mark. The icon names what the heading is about, so it is chosen per heading - a page whose four
headings all carry the same check-circle has four headings that say nothing to each other. Use
only icon names the deck tool's icon set holds; an unknown name should fail the build rather than
draw the wrong glyph.

**A requirement number inside the body is a badge**: at the end of a bar, at the end of a
sub-section heading, or standing alone. Never a bare number on a line of its own.

## Choosing the shape of a region's body

`SKILL.md` carries the judgment test - a row of 4+ short attributes scanned by column stays a
table; 1-3 prose attributes answering what/why/how becomes a labelled card.

**The index of what to reach for is the deck's own component catalogue, generated from the
components themselves** - the table below is the entry set every deck starts with, and it is not
the deck's inventory. A hand-kept index is complete on the day it is written and shorter than the
components on every day after: one deck's covered twenty of its ninety-nine, and the seventy-nine
outside it were the ones nobody used. Read the generated catalogue for the deck in hand, and look
at a rendered component rather than its name.

The shape names are one deck's vocabulary, given as examples; the deck in hand names its own.

| The content is | Example shape |
| --- | --- |
| a quiet label/value list | a key row (`keyrow`) |
| one item, an icon earning its place | an item or detail card |
| two labelled rows under one head | a pair card (`pair-card`) |
| three rows closing on a verdict | a trio card (`trio-card`) |
| an ordered sequence, one line each | a step row (`step-row`) |
| an ordered sequence in a strip | numbered steps or flow steps with arrows |
| an ordered sequence with a judgement each | ladder steps or verdict rows |
| a demand facing its answer | a split card |
| a requirement and how it is met, one to three of them on a page with room | a ledger row (it stacks the id over the name and the head over the answer, about twice a table row per item) |
| four or more requirement-to-answer rows, or any page short of height | a compact table or a one-line row with a badge |
| a choice among alternatives | a choice card |
| one measured figure among three | a fact band (`fact-band`) |
| a row of measured figures | stat cells |
| input → operation → output | a transform lane |
| one fixed source and what reads it | a rail (a fixed label column beside a body), an anchor cell and paired notes; the label column is about 105px across the text block and, in a column, the longest label of the stack plus 6 |
| a stage with a time on it | a stage card |
| a claim and its evidence | a proof strip, a proof line or an asset card |
| an aside a region needs | a note or a ruled note |
| rows falling into subsystem groups | a table with a lane column and row spans |

### Taking a page out - the figure is the lever

A deck that has to lose pages loses them fastest where a figure and its prose are both
carrying the same content. Work in this order, and measure after each:

1. **The prose a figure already draws.** The figure-echo check fails only at three verbatim runs
   of ten characters or more, which is the flagrant case; the ordinary case is a paragraph
   that walks the reader through the boxes the figure beside it already shows. Cut it, and
   keep the caption doing the naming.
2. **The second copy of an explanation.** A check that compares manuscript sections names the
   ones that say the same thing in almost the same words. Delete one and let the other stand;
   both the manuscript and the pages carrying it get shorter at once.
3. **A prose region that would be a figure.** A sequence, a matrix of who-does-what, a set
   of boundaries between things - each of these is shorter drawn than written, and the
   figure generator already knows how to draw them.
4. **Only then, sentences.** And never the exception, the threshold, the acceptance
   criterion or the wording the requirement uses - those are what the page is scored on.

What never comes down: a type size, a page's fill, or a figure's scale. **That includes a size the
build lowers on its own**: a deck tool that fits an overflowing page by scaling its content prints
every string on the page smaller while the source still says the base size, so a check reading the
source passes it. One chapter shipped body text at 6.75pt that way. Overflow is fixed in the
content; read the built sizes, never the declared ones, before calling a page fitted.

**When two page-files become one page, that page declares both manuscripts**, the earlier
section first - the parity check reads the declaration to know what the page may print, the carry
check reads it the other way to see that both sections still reach a page, and the order check
reads its first path. Drop one and the section it named is reported as carried by nothing. The
emptied chapter is deleted, its running-head `(n/m)` markers disappear with the topic that is now
a single page, and **the chapter's entry is removed from the deck's chapter list by whoever owns
that list** - when several people are cutting at once that list is the one file their edits
collide in, so it has a single owner who strips every retired entry in one pass before the next
build.

### Re-shaping a page that is already full

A page whose regions are bullets is at its densest form: a card costs about half again
the height of the rows it replaces, so converting a full page grows it past the block.
The room comes from the content, not from the layout - **when the user hands over a
chapter to redesign, ask whether repeated content may go, and cut it before reaching
for the shapes.** A part written page by page repeats itself across facing pages (a
condition stated in an overview and again in the detail, a figure's own labels written
out beside it, one rule enumerated twice under two headings), and each of those is a
card's worth of room. Say in the reply which sentences went and why.

The levers, in the order they cost least:

1. **A sentence the page's own figure already draws.** The figure carries it; the text
   does not need to.
2. **A sentence stated on the facing page.** Keep it where the region it belongs to is,
   and drop the other.
3. **Two adjacent rows saying one thing** - merge into one card row.
4. **A region heading over two rows** - fold the rows into the region above it.

Only then re-shape. And re-measure: a page at 92% has room for one card, not four.

**One replacement pattern applied everywhere is the table monotony reborn.** Vary the form with
the content's nature and the arrangement between a full-width stack, a two-column grid and a
rail. The rhythm check fails two consecutive pages that share both their placement and their
most-used component.

**A page needs a shape that is not a paragraph and not a list.** The page-shape check fails a body
page whose body is prose and bullets under every heading, and a 「list」 of one row - both of which
read as deliberate on the page and as one page repeated over a run. Its simulation mode reads
every list run and names what the content's own form asks for, then picks under the rhythm rules
so the deck does not trade bullets for one card used everywhere. Run it before rewriting a page.

**And it counts the whole set.** The same check prints a census per 부 and fails a 부 where one
component carries more than a third of the card uses, or that uses fewer kinds than it has pages
(capped at ten); it also lists the components no page has reached for yet. Five cards over fifty
pages is the failure this catches - every page passes its own review and the run still reads as
one page repeated.

Three things need the parent to be right. A panel that grows to fill its column resolves to zero
height unless a row container gives it a row to fill. A ruled note's head sits in a fixed 72px
column, so it holds about six glyphs and wraps past that. And a card's head must not repeat the
heading of the section it sits under - rename the heading, which is deck furniture, not the head,
which traces to the manuscript.

## Reading rhythm

Rhythm is what a reader feels turning eight pages in a row, and it is not visible while writing
one. Two scales.

**Inside a page.** Three registers and no more: a picture, a measured thing, prose in cards. A page
of nothing but cards is a wall; a page of nothing but prose is a report; a page carrying a figure,
a table and four card kinds is noise. The dark surfaces - a fact band's ink panel, an ink bar, an
ink card - are where the eye stops, and a page carries at most one of them; a figure is not one
of them and may stand beside one.

**Across a run of pages.** A document deck that places a figure on **every** body page - 150 figures over about 180 pages
is the case this rule came from - carries the whole risk: a hundred pages of *landscape figure across the top, cards
underneath* is one page printed a hundred times, and no individual page will look wrong, which is
why page-by-page review never catches it.

So the placement rotates, and the rhythm check enforces it: **no placement runs three pages
in a row; two consecutive vertical figures do not stand on the same side; two consecutive pages do
not share both placement and most-used component.** Ten placements are available, and each is the
natural home of a particular claim - pick by the claim first and check the rotation second.

| # | Placement | Built from | The claim is |
| --- | --- | --- | --- |
| 1 | 전면 도식 | a full-board figure first on the page | a structure the page then explains |
| 2 | 하단 도식 | a full-board figure after the last region | the conclusion the page reached |
| 3 | 세로 도식 · 왼쪽 | a column figure in the left column, text beside it | a sequence or a descent, explained beside itself |
| 4 | 세로 도식 · 오른쪽 | the same, figure on the right | the same, mirrored |
| 5 | 세로 도식 + 표 | a column figure whose text column carries a small table | a sequence whose steps each have a row of attributes |
| 6 | 세로 도식 2장 | two column figures side by side under one linking heading | two paths compared step for step |
| 7 | 전면 도식 2장 | two full-board figures joined by one bridging line | a derivation: the first figure's result is the second's input |
| 8 | 전면 도식 + 3단 | a full-board figure, then three columns | one structure whose three parts each need a sentence |
| 9 | 레일 + 본문 | a rail beside a body | one fixed thing on the left and everything that reads it |
| 10 | 도식 없는 쪽 | a table or a matrix | the content is a record set; the chapter's figure sits on the facing page |
| 11 | 세로 목록 + 본문 | a tall narrow table or list in one column, the page's other blocks stacked in the wider column | a register the other blocks are read against (requirements by topic, the items a matrix covers) |
| 12 | 표 2단 | two small tables or card stacks side by side under one heading | two record sets compared or read together |
| 13 | 비대칭 2단 | a wide column of the argument beside a narrow column of measures, badges or a verdict | an argument with its numbers or its acceptance criteria beside it |

Placements 11-13 carry no figure, so a chapter whose figures are few still has three ways to break
a stack. **The grid is a second axis beside the placement**: the rhythm check also fails three
plain stacks in a row and a part where plain stacks are more than half the pages, whatever the
figures do.

**Placements 3-6 exist only for a figure drawn on the column board**, so a chapter's rotation is
decided when its figures are reviewed, not page by page: read the chapter's figures, pick the ones whose claim is a sequence or
a descent, and redraw those. A chapter of landscape figures alone still rotates across 1, 2, 7, 8,
9 and 10.

Four rules, all learned from the facing page rather than from the single page:

- **Alternate the side.** Two consecutive left-column figure pages tip the whole spread one way.
- **A figure that opens a page and a figure that closes one are different arguments.** At the top
  it is the structure the page then explains; at the foot it is the conclusion the page reached.
  Do not move a figure to the foot for rhythm alone - move the argument.
- **A page with two figures owes the reader the link between them.** In a side-by-side pair that
  is one heading above both; in a stacked pair it is one bridging line between them. Two figures
  with no stated relation is a page the reader has to assemble.
- **Placement 10 is not a gap in the set.** A chapter whose every page carries a picture has no
  page where the picture matters. Where a page-file's content is a record set - a requirement
  table, a schedule, a matrix - leave it as the table and let the neighbouring page carry the
  figure.

### The two-figure placements

- **A side-by-side pair places each column-board figure at the pair width (327px), not the lone
  column width (300px).** Every column-board figure is placeable at both. The pair prints its
  labels at about 7.1pt against the lone column figure's 6.5pt - inside the band, and a pair is
  read against its partner, not against the page's other figures. The full board has no pair
  width, because 1200 units at 327px prints the smallest label at 3pt.
- **The two figures in a pair are drawn to the same board height.** Different heights leave the
  two captions on different lines and the pair stops reading as a pair.
- **A pair compares; it does not merely fit two pictures on a page.** Two unrelated figures side
  by side make the reader hunt for a correspondence that is not there.
- **A stacked pair is for a derivation, not for a page that happens to have two figures.** Two
  full-width figures with no bridge is a page that got longer, not clearer.

## Placing a figure

Every figure is placed at one of two widths, and **the board it was drawn on decides which**.
The build reads the width out of the figure; the page cannot override it, which is what stops a
landscape drawing being squeezed into a column at 3pt.

| Board | Placed at | Height: target · review | The claim is |
| --- | --- | --- | --- |
| 1200 (standard) | 682px, the whole text block | 720 · 840 units (840 ≈ 478px) | a comparison, a matrix, a timeline, a fan-out, a wide row |
| 520 (column) | 300px, one column | - · 1400 units (≈ 808px) | a sequence, a rail of states, a stack of layers, a descent |

Both ratios are about 0.57, so the smallest step of the type ladder prints at roughly 6.5pt on
either board and two figures on facing pages read at the same size. The figure generator's own
instructions carry the drawing rules for both.

A placed figure is the figure plus a number and a caption:

- **The number is 부-장-순번** (「그림 Ⅳ-2-2」), and it is the manuscript's number. The
  figure-numbering check fails a deck number the manuscript does not carry, a number repeated in
  the deck, and a chapter whose deck numbers run out of order; the manuscript itself has to run
  1..n with no gap.
- **The caption states what the picture shows, not what the section argues.** The argument is
  the claim line; a caption that repeats it makes the reader read the same sentence twice, and
  the echo check reports the overlap.
- **A figure never carries a document section number in its own text** - the number moves when a
  page is inserted. The figure verifier catches the Arabic shape (`3.4`, `3.4.1`); a Roman
  reference (「Ⅳ-2 참조」) it does not catch, so that one is on the author.

## The column layout

The layout the vertical board exists for. A tall figure stands in one column with body text beside
it, which is the only placement on the page that reads as a *spread* rather than as a stack.

**A numbered sequence is never dealt evenly into the columns.** Two columns holding the same
number of items pair them into rows, and a reader takes the row before the column - so 1·2 on
the left beside 3·4 on the right is read 1 3 / 2 4, and the order the page is about arrives
shuffled. Nothing on the page looks wrong: each card is right, the layout is right, and the
numbers are in order in the source. An **uneven** split does not pair up and reads down the
columns as written, which is why five beside two is fine and two beside two is not. A sequence
that will not fit one column goes across the block as a stage strip, where the chevrons carry
the order and the reading direction is the order. The page-shape check fails on the even split.

**The geometry is fixed and the numbers are dimensions, not preferences.** 300 figure + 28 gutter
+ 354 text = 682. The content area under the running head runs from about y=211 to y=1065, so a
column figure has 854px to stand in - a 1400-unit board fills 808 of it and leaves room for the
caption, which is why 1400 is the ceiling.

**The short column is this layout's one failure, and it is the reason to check the render.** A
1130-unit figure reaches y≈879 while four cards in the text column stop at y≈454 - the page then
has a 425px hole down its right side, and the measurement in `SKILL.md` reads the page as full
because the figure carried it. So:

- **Both columns reach the bottom of the text block.** The figure gets there by being drawn
  tall enough (up to 1400 units, 808px); the text column by carrying more of the manuscript.
  Where the page genuinely has less to say than that, the figure is too tall for what the page
  argues: put it on the full board and give the page a different shape.
- **Nothing but the figure and its caption goes in the figure column.** A short note may follow
  the caption in the same column; a card there turns the column into a second body column and
  the layout stops reading.
- **The text column takes the page's ordinary regions.** A section with an icon, cards, a
  footnote to close - the components do not change, only their width. A three-column small table
  fits (placement 5); a wider table is what the full-width placements are for.
- **Alternate the figure's side** across consecutive pages.

### Widths a component needs

A component that fits the full 682px does not necessarily fit a column, and the failure is a
horizontal text-overflow warning naming a box a few pixels too narrow - never an error, and never
the name of the component. What has been rendered in each slot (shape names are examples):

| Slot | Width | Rendered there |
| --- | --- | --- |
| full text block | 682 | every component, a seven-column table |
| column layout's text column | 354 | a section, a key row, a pair card, a note, a footnote, a three-column small table |
| a side-by-side pair half | 327 | a column-board figure with its caption |
| a two-column half | 325 | a pair card, a trio card, an item |
| a three-column third | 211 | a detail card; a key row fails here |

**A key row's value is one line and never wraps** - the value box sizes to its content. Its
budget is the row's width minus 106 (the 92px label and the 14px gap): 248px in the 354 column,
105px in a third. A value past the budget spills into the margin with a horizontal overflow
warning; in a third, reach for a detail card instead.

## Where the layouts live

The layouts - the column figure left and right, the side-by-side pair, the stacked pair with its
bridge, two columns, three columns, the rail - are the deck's own, so a width may be changed in
the deck without asking anyone. Where a shared layout library carries the same geometry, keep the
deck's layouts geometrically identical to it, so moving to the library is a rename at the call
sites and nothing more.

## Before the page is done

1. The build reports zero errors and zero warnings.
2. The rendered picture has been looked at - not the file count, not the clean build.
3. The claim line is one claim, the figure shows it, and the caption does not repeat it.
4. The page has one opener, two or three regions (or one table), one bar per region, an icon on
   every sub-section heading.
5. Content reaches the bottom of the text block (about 95% of the page height in the
   measurement); in a column layout both columns do.
6. The rhythm check reports no departure and the census for the part has no finding. **These are
   gates, not advisories**: a chapter with a rhythm or census finding is not reported done, the
   same as one with an overflow.
7. The layout check (overlap, overflow, ink and package findings) reports nothing, the rule check
   reports no failure, and every check the deck declares to run after a build is clean.
8. The Korean audit reports zero over the deck's sources.
