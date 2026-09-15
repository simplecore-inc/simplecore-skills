# Figures - boards, placement, reuse and re-layout

A figure is drawn by code in the project (`figures.generator`), lands as an SVG in one of
`figures.sources`, and is placed by the build at a width the board it was drawn on decides.
The drawing discipline itself - claim first, visual type by the claim, content-first
boxes, the type ladder, the badges, the lint - is the `simplecore:svg-diagrams` skill and
the generator directory's own `AGENTS.md`; invoke the skill before drawing. This file is
what the deck adds: where a figure may stand, at what size, and how a document figure
becomes a slide figure.

## Look for the figure before writing the content

**The first move on a block is to search the drawn set for what that block is about** -
every block, every time, before a word of it is written, not a thing to remember once the
prose is already on the page. A summary deck built from a
document deck inherits everything that document drew: one proposal had drawn 146 named
figures and its 43-slide summary placed 18 of them, while thirteen of its body slides
answered a relation in words alone - and four of those relations were sitting drawn,
finished and unplaced upstream. The cost is paid twice: the panel loses the picture, and
the page spends on a table the room the picture would have taken.

- **A slide may carry several figures.** One per page is a habit, not a rule. Where two
  relations belong on a page, two drawings go on it.
- **A portrait board counts.** A column figure stands inside a column; a column about to
  be filled with a label/value table is very often exactly that shape, and the deck that
  forgets portrait boards exist fills every column with rows.
- **A figure is the first candidate for space that opens up** - a block deleted for
  repeating its neighbour, a column short of the fill floor, the half page under a
  timeline. Reaching for prose there is how a deck ends up with a hole *and* an unused
  drawing.
- **On a slide near the density ceiling it is the only candidate.** The fill floor asks
  for more ink in the short column and the density ceiling caps the characters on the
  page, so the two rules meet head-on and rows cannot satisfy both: one slide sat at
  1274 characters against a ceiling of 1300 with its narrow column at 70 %, and the
  three rows that filled the column put it 145 characters over. A figure resolves it
  because the density check counts the strings the deck writes and a drawing carries
  none - it adds height and one shape. Check the character count *before* reaching for
  rows on a column that is short, and where the column's rows already spell out a
  sequence, draw that sequence and delete them: the page then loses characters and
  gains height at the same time.
- **A capture cropped down does not lose the relation it carried**; the relation moves to
  a drawing beside it.
- **Keep an inventory rather than reading the chapter files.** Generate a table of every
  figure with its number, subject, board size, orientation and the page that places it;
  a blank placement column is the list of what is available. Regenerate it when either
  deck changes - a stale inventory is what makes an author write the prose.

## A figure prints proposal Korean

The panel reads a figure's strings the way it reads the proposal's headings, so every
drawn string is a 개조식 noun phrase: no relative clause (「보드로 앞당기는 설계 확정」 →
「와이어프레임 기반 설계 조기 확정」), no particle inside a label (「승인된 설계 단위마다
확인」 → 「승인 설계 단위별 확인」), no connective ending between items (「…를 제출해 종속성
방지」 → 「… 제출 - 종속성 방지」), and none of the authors' working vocabulary (보드 ·
프레임 · 이 사업 → 와이어프레임 · 화면 · 본 사업). One deck had nearly every drawn string
rewritten in a single round on this rule alone, so a figure module is written in this
register from its first string and the deck's figure check fails a drawn string outside it
(`[figure register]`). **And a technical term is explained technically**: a label names
the mechanism and what it does, never a broad verb standing in for it. Compressing the
broad verb into a noun does not fix it - 「확장 지점」 written as 「확장 지점 확보」 says no
more than before; what fixes it is naming the thing and the mechanism
(「제품 · 규격 차이 처리 위치 - 프로파일 · 어댑터 · SPI」). The Korean rule pack reads the
broad verbs in that position, so run the figure's strings through
`simplecore:korean-docs` like any other copy. The body register of the slide beside the
figure follows: a slide's own rows do not rename what the document calls 와이어프레임.

## The figure's column is the width its board places at

A drawing placed in a column wider than itself leaves paper on both sides of it, and that
band does not read as a margin - it reads as a figure too small for its box, which is the
one thing a reader is not supposed to notice about a figure. **So the column layout is
chosen from the board**, not the figure fitted into whatever column the page already had:
one layout per board width, each with a mirrored variant so consecutive asymmetric pages
do not tip the same way, and whatever width the figure does not need goes to the column
that reads it. A deck that has only one figure layout ends up placing every board in it,
and the narrow boards float in the middle of a column drawn for the widest one.

## The board decides the placement

`build.ts` reads the width out of each SVG and emits one template per placement
(`fig-<id>`, plus a `-<variant>` for boards that have a second slot). A chapter file cannot
override the width: a landscape drawing put in a narrow column would print its labels at
3pt, and nothing in the page source could report it.

| Deck | Board (units) | Placed at (px) | Scale | The claim is |
| --- | --- | --- | --- | --- |
| document | 1200 | the text block (682) | 0.57 | a comparison, a matrix, a timeline, a fan-out, a wide row |
| document | 520 | a column (300) · a pair (327) | 0.58 · 0.63 | a sequence, a rail of states, a stack, a descent |
| slides | 1488 | across the page (1091) | 0.73 | a structure the whole slide is about |
| slides | 1400 | the text block (1027) | 0.73 | a schedule or a timeline that runs the whole measure under a section bar |
| slides | 873 | the wide column (640) | 0.73 | one relation in a few boxes beside its rows |
| slides | 640 | the 469 px column | 0.73 | a figure drawn for half a slide |
| slides | 378 | the 277 px column | 0.73 | a rail of states or a stack beside its text |

A slide board is the placed width divided by the scale that prints the ladder's smallest
step at the slide's declared body size (a 11-unit body against a 15-unit ladder minimum is
0.7333);
the document's boards are for paper and are not placed on a slide. **A slide figure uses
the ladder's three lowest steps** - MICRO and BODY for labels, LEAD for its headings -
because the slide's own region heading is one step over its body and a figure heading at
SECTION prints larger than anything on the page; the deck's `common.py` defaults
`heading()` to LEAD and its verify script fails text over LEAD. **And it runs across the board before it stacks**:
the rows beside a figure pay for its height, so a relation that reads left to right is laid
that way, and a figure taller than it is wide is re-laid before it is placed.

**And the column is the board's placed width, not whatever column the page already
had.** A 600px drawing standing in a 680px column leaves 40px of paper down each side,
and a reader takes that band as the figure being too small for its box rather than as a
margin - one deck's author stopped on exactly that. So the layout is chosen from the
board: one asymmetric layout per board width, each with a fixed figure column and the
rest of the measure going to the text (600 · 440 · 260 against 399 · 559 · 739 on a
1027px block), and a mirror of each so a run of slides does not all tip the same way.
The mirror is for the run, not for one page: flipping puts the text column first, and a
slide whose own title names the figure's subject reads worse that way, so check the
title and the two neighbours before flipping.

**Two consequences worth stating, because both cost a rebalance.** Widening the text
column shortens its content, so a column that met the fill floor at 319px will miss it
at 399px - expect to refill every slide the change touches, and measure rather than
assume. And **a slide gets one figure column**: a second figure on a different board has
nowhere of its own and stands inside the text column, where the same band reappears. A
slide that needs two drawings wants them on the same board, or the second one is the
page's evidence that the first should have been drawn differently.

**A slide deck places every figure at one scale**, so a label drawn at 15 units is the
same size on every page - a reader who sees a 1200-board figure across a whole slide and
another in a column is reading the same drawing at two sizes, and the second one looks
like a different deck. The scale is the largest that still lets each board fit the slot it
belongs in (the widest board across the text block, the next in the wide column of an
asymmetric layout, and so on), and a figure is placed at `board × scale`, never at the
width of the slot; the wide column is sized to the placed width, not the other way round.
A document deck, whose boards differ less, keeps its own near-uniform pair. The scale is
chosen so the ladder's smallest step prints at 6.4pt or more (15 units × 0.57 × 0.75);
the project's `figures.boards` carries the widths. **Height is the
only dimension a figure may spend**: on the document's full board stay under 720 units
(840 for review); on a slide board the height budget is what the slide leaves after its
head, so a slide figure is short and wide - 380 to 600 units on the 1800 board.

## A page whose body is one figure

A slide may put its whole body into one drawing, and a part's opening page is
where that earns its place: the page has one argument to make and the picture is
the argument. Such a page is not the case the width cap was written for - that
cap exists because a stack of full-width bands has no composition, and a page
carrying a single drawing *is* the composition. Four things follow, and all four
have to be arranged before the first line is drawn.

- **The board is placed across the page, not inside the text measure.** Held to
  two thirds it prints a white strip down both sides of a page whose only
  content is the picture. Give the board its own placement scale beside the
  deck's ordinary one, and say in the deck's instructions which board that is.
- **Its margins are the smallest the trim can hold.** A figure standing beside a
  column of text can afford air; on a drawing that fills a page every unit of
  margin is a unit the drawing does not get.
- **Its height ceiling is the page's body region**, in board units: the region's
  height divided by the placement scale. Write that number into the figure lint's
  height review for that board, because the review's usual number - a figure
  sharing its page - is not the number here.
- **The column-fill check measures it; it is not exempt.** A drawing that stops
  short leaves exactly the hole the check exists for, and the figure is the only
  thing on the page that could have filled it. Measure it as one column across
  the block.

**Bind the registers with one device or the page is four pictures.** A body-wide
figure carries more than one kind of block - a transformation row, a bounded
architecture, a row of ribs, a measurement strip - and stacked without a
connector they read as separate drawings that happen to share a page. One accent
rail down the left edge, with a mark at each block's heading and an arrow between
marks, makes the page one object and gives the speaker a reading order. Keep the
rail identical across a deck's opening pages and **vary what hangs off it**: the
rail is what makes them a set, and the blocks are what keep the set from reading
as one page printed five times.

## A wrapped run whose last line is a stub

A figure module writes a sentence and the column decides where it splits, so a
word ends up alone on a line and nobody sees it - the eye reads the card, not its
ragged edge, and a page-by-page review passes every one of them. It is
mechanically visible: group the finished SVG's text elements into wrapped runs
(same x, same size, one step apart) and report every run whose last line is under
about 42 % of its longest. The fix is a shorter string or a wider column; an
explicit line break belongs only where the wording cannot move, as in a formula.
Run it beside the figure lint, from the same command, so a figure is never
regenerated without it.

## Connector labels, lanes and separators

**A connector label is small type on a tight plate, and it never lands on a box.** The toolkit's own pill
spreads 8 units a side and a third of an em above and below the letters; on a slide
board that plate is taller than the gap the arrow runs in, and three figures in one
round printed it over the cards either side. The generator's `common.py` carries
`edge_label()` with the plate fitted to the glyph box (6 a side, 3 above and below),
and the deck's `verify.py` fails a module that calls the canvas method instead. The
type size does not move: the ladder's smallest step is already the deck's body size
and the 8pt floor leaves no room under it, so a label that reads too large is made
**shorter** - 「업무 DB 직접 접속 없음」 → 「DB 직접 접속 없음」 next to the DB it names,
「준공 수량 · 청구 확정 단가」 → 「준공 수량 · 확정 단가」 on the lane that leaves 청구 -
and a label in a channel narrower than its words is set **one word a line** (「배치」 over
「mTLS」 in a 62-unit channel), never squeezed. A name standing in open paper beside its
line takes no plate at all.

- **A plate never straddles a box border.** A label laid on a lane between two blocks
  needs the gap to hold the plate with paper either side of it - grow the gap
  (`GAP`), not the plate's opacity.
- **Labels of one kind stand at one height.** Two return paths under a rail whose
  spans do not overlap share one lane; the second lane is for a path that would cross
  one already there, never a lane per path.
- **Lines that share a channel take lanes.** Five connectors bent at one middle x
  print as a trunk with branches, and the reader cannot tell which socket feeds which
  layer; each takes its own bend coordinate (`ortho(..., lane=)`), ordered so none
  crosses, with a bend and an 18-unit straight run inset from either edge. The toolkit
  lint reports the shared run as `COLLINEAR-CONNECTORS`.
- **A separator between two boxes sits in the middle of the gap.** `chevron()` in the
  generator's `common.py` anchors the 「›」 on the midpoint of the two boxes' edges; a
  glyph placed a fixed distance before the next box drifts toward it on every row with
  a wider gap. The lint reports it as `SEPARATOR-OFF-CENTRE`.

## A document figure on a slide is redrawn, never reused

**A document figure placed on a slide as it is prints its labels under the slide's body
size, so it is not placed.** Every figure
on a slide is drawn for the slide on the slide's board, with the document figure as its
source - the same relation, the same labels where they fit, and the content cut to what
the board carries at the body size. The module docstring names the source
(재구성 원본: `03-01-01-…`); the chapter file's comment names the document figure the drawing
was made from (「본 제안서 그림 Ⅲ-1-1 재구성」); a slide prints no caption. A snapshot
directory of reused copies, where a deck keeps one, is expected to be empty and its sync
tool reports a copy that slips back in.

**The reused figures are a snapshot the slide deck owns, not a live read of the
document's directory.** Reading them where the document keeps them looks like the
tidy arrangement - one copy, and a correction reaches the slide on the next
build. What it actually builds is a deck that moves when somebody else's deck
moves: the document's authors redraw a figure for the document's own reasons, it
grows twenty pixels, and a column of the slide deck overflows in a build those
authors never run, with nothing in their checks to report it. So the slide deck
keeps its own copy under its assets, one tool is the only writer of that copy,
and running that tool is a layout change - followed by a render and the deck's
checks in the same breath. Without the flag that tool reports the drift, so the
link between the two decks stays visible instead of silent. It also reports a
copy no page places any more, because a snapshot nobody prunes is the next
thing to rot.

**The type floor is the deck's own floor, and a figure has a second one.** The floor a
deck enforces is over the strings *it* draws - a check that reads the styles, templates
and chapter files cannot see inside a bitmap or an SVG, and should not try. A figure's
smallest label is set by the figure's own type ladder times the placement scale, and
that product is the number to hold: pick the scale so the ladder's smallest step still
clears the figure floor, and say in the deck's instructions what that floor is. Without
it a reviewer measures a diagram label, finds it under the deck's floor, and reports a
violation of a rule that never applied to it.

**A reused figure brings its own palette, and that palette is not a page colour.** A figure
generator has a named theme of its own - a colour per category, a mark colour for one kind
of item, the per-figure legends a drawing needs - and those colours arrive inside the
picture. A reader takes them against the figure's own legend, which is why the same orange
can mean one thing in one drawing and another in the next without confusing anybody. What
they must never do is leak outward: no card, bar, chip, label or rule outside a figure
takes a hex from the generator's theme, and the deck's own third system is still the only
one the pages carry. Say this in the deck's instructions, because a reviewer looking at a
render cannot tell a figure's legend from a page colour and will report it as an undeclared
colour every round until the boundary is written down.

**Inside the figure, a colour either carries a legend or comes out.** The paragraph above
protects a figure's palette from being read as a page colour; it says nothing about a
figure whose own colours sort nothing. Four cards in four accents down one column, five
category pills each a different hue, a bar drawn in a second colour with the reason only
in a key at the far edge - each of those states a difference the drawing never defines,
and a panel is left deciding whether the colour means something. Where the column head,
the label or the tag already tells the boxes apart, the colour is the part to drop: one
accent per column, one grey step for a sequence, and the distinction stays in words.

**And where the deck declares a judgement pair, no box that is not a verdict takes those
hues.** The pass green is learned from the first page that uses it, so a green box on an
earlier slide meaning 「사후 확인」 or 「인도 대조」 teaches the panel the colour is
decoration before the verdict rows ever appear. A generator's palette is not an exemption
here: the check that guards the pair reads chapter files and templates and cannot look
inside an SVG, so the figure modules are where this is enforced by hand. When a
non-verdict box needs an accent, take one the pair does not use.

**Re-lay it when it does not.** A figure that is too tall for the slot it should take -
a mapping ladder whose rows would stand 300 px tall in a 660 px column - is redrawn on
a slide board **with its concept intact**:

- **Same claim, same register, same labels.** The redrawn figure says what the original
  says (a mapping over a timing strip stays a mapping over a timing strip); it turns a
  vertical ladder into a row of cards, a stacked sequence into a strip, a two-column
  table-figure into a band. It adds no relation the original lacks and drops none to
  save height - a relation that will not fit is the sign the slide wants two figures or
  a table instead.
- **The module docstring names the source figure** (`재구성 원본: 02-01-02-…`) and the
  claim, so the next author sees the pair and keeps them in step when the original
  changes.
- **The slide deck's generator extends the document's toolkit**, importing its helpers,
  ladder and badges, and adds only the slide boards and its own output directory
  (`assets/deck-kit/slides/tools/diagrams/common.py` is that file). One ladder, one icon
  size, one badge set across both decks.
- **Naming.** A slide figure is `s<NN>[a-z]-<name>.svg`, `NN` the slide it was drawn
  for; the build reads the id from that prefix, and a document id and a slide id never
  collide.
- **Renaming one leaves an orphan that breaks the build for everybody.** The id comes
  from the prefix, not from the file, so a module that starts writing
  `s02-<new name>.svg` while `s02-<old name>.svg` is still in the output directory
  gives two files one id, and the build stops with 「도식 아이디 s02 가 두 파일에
  있다」 - not on that slide, but on every render anybody runs, including the agents
  working on other chapters. The generator writes; it never deletes. So a rename is
  three steps in one change: rename the `save()` name, delete the old SVG, and repoint
  the chapter file - and if the two drawings are both wanted, the second takes the next
  letter (`s02a`) rather than the same number.

**Replace prose with a figure when the prose is a relation.** A paragraph that lists
stages with what enters and leaves each, a set of conditions that gate one another, a
loop - those are drawings, and on a slide a drawing is read in the time a paragraph is
skipped. A paragraph that is a list of attributes stays a table or a card; drawing it
adds a page and says nothing. The claim test from the drawing skill decides: cover the
labels, and the shape alone must still say the claim.

## What a figure may not do

- **Repeat the words beside it.** A document caption states what the picture shows and a
  slide's title and claim do; the argument is the page's `sub`. Ten or more characters standing verbatim in both the figure and
  the block beside it is the figure redrawing that block; fix whichever side is weaker.
- **Carry a document section number.** Numbers move when a page is inserted; the figure
  verifier fails the Arabic shape, and a Roman reference is on the author.
- **Carry a title.** The figure's name and its one line belong to the document caption,
  or on a slide to the title and the claim above it.
- **Draw a shadow.** PowerPoint drops every element that references a `<filter>`.
- **Be scaled to fit.** Re-lay out the primitives on the board the slot wants.

## Screen captures on a slide

A capture is a figure the build sizes from the PNG header into the boxes the layouts
define (`full` · `side` · `half` · `third`), ratio kept, never taller than the box. A
screen-only slide keeps the capture as the main content and puts around it only the
title, the requirement it answers, the pointing notes and the source line; the slide
still names the functions and the judgement conditions the capture shows, because a
picture alone answers nothing. Identifying detail - addresses, users, certificate
names - is masked in the copy the slide uses; the raw capture stays where it was taken.

## A figure's title names the process, never a journey

A process drawing invites a travel metaphor - 「지나가는 길」, 「거쳐 가는 자리」,
「남기는 것」 - because the picture really is a line moving down a page, and the
module's `register` field rewards evocative phrasing. The line is the drawing;
the title is prose, and prose does not replace a real name
with a metaphor (`길` · `자리` · `갈래` · `관문` are named in the global rules).
Title the figure with the thing it draws: 「한 회차의 수집 실행 순서」,
「회차 종료 시 나누어 보존하는 값」. The same test applies to a station's heading
and a lane's label, which are read at full size on a projected slide.
