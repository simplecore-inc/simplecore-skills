# Writing a slide

A slide deck is a document deck turned on its side and read from farther away: the same
palette, the same two families, the same component set, the same rule that everything
repeated is a template - with a page that has less height, more width, a one-row head, a
speaker script, and a plan instead of a manuscript. This file is what changes.

## Geometry

The kit's slide shell is A4 landscape (1123×794 px at 96 dpi, `w`/`h` on `<Document>`
because the presets are portrait or screen). The content width is 1027 (48 px margins).
**A slide deck is projected, not printed, so its chrome is full-bleed**: a head band
(36 px, the part colour, with a deep block at the right carrying the deck's masthead) and
a foot band (34 px, the lightest neutral) run edge to edge with no border and no margin,
both drawn by the master. The page lays text on them and draws nothing else: the head
carries the part line and the reference to the document the deck summarises (「본 제안서
Ⅳ-2 기능 요구사항 · 57~101쪽」, its pages computed by `refpages.py` from the document
deck's import order); the foot carries the evaluation item, the requirement ids and, at
its right in the part colour, the folio, counted over the numbered slides only - a cover
is slide 1 and a contents page carries none. Under the head come the title, the
one-sentence claim and the hairline, and the body runs from about y=110 to y=748, roughly
**640 px**. That budget is the whole discipline of a slide: a document page holds three
regions and a figure, a slide holds two regions and a strip, or one region and a figure,
and a sentence that wraps once on a document page wraps twice here.

The shell is a `Layer`: the content column has a fixed height (758) so the Layer's sum of
child heights stays inside the page (behaviour 20), and the foot row sits at its absolute
y. When the column's content outgrows it, the builder shrinks the flexible rows and
reports the child that no longer fits as `OUT_OF_PARENT` on the row, not on the page
(behaviour 32) - the fix is less content on that slide, never a taller column.

## The layouts, and what each is for

| Layout | Columns (px) | The slide is |
| --- | --- | --- |
| `cols2` · `cols2-top` | 499 · 28 · 499 | two equal things - a target table beside its method, a demand beside its answer |
| `cols3` · `cols3-top` | 326 · 24 · 326 · 24 · 326 | three parallel regions - three requirement groups, 요구·구현·검증 |
| `cols3-wide` | 475 · 24 · 252 · 24 · 252 | one wide record (a table, a ledger) and two narrow answers |
| `cols-wide-left` | 680 · 28 · 319 | the argument or a figure on the left, its measures and conditions on the right |
| `cols-wide-right` | 319 · 28 · 680 | an index, a stat or a rail on the left, the record on the right |
| `cols-rail` | 236 · 28 · 763 | an index rail (`index-rail`) beside the body that reads it |
| `screen-side` | 640 · 28 · 359 | a capture and the notes that point into it |
| `stack` | full width, two regions | 상단·하단 - a display-only table over a card row, two parts on one slide |
| band + `cols3` | full width, then three | a `fact-band` of measured figures over the three things they support |

Two rules the document deck does not have:

- **Asymmetric layouts alternate sides.** Two consecutive `cols-wide-left` slides tip the
  run one way; the mirror exists for that.
- **A column bar heads a column, a section bar heads the slide.** `col-section` /
  `col-section-req` carry the narrow stub; a full-width `section-bar` inside a 326 px
  column leaves the heading 126 px.
- **Some column regions stand in a frame, never all.** A column whose body is a run of
  rows - arrow pairs, ruled notes, chips, a vertical flow - blends into its neighbour;
  `col-panel` / `col-panel-req` put the column bar flush on a hairline frame with a
  padded body under it, and `frame` draws the same border around a run of sections or
  rows that has no bar. One or two regions of a slide take it, chosen by the content
  that needs bounding; a table, a figure, a card stack or a lane is bounded already and
  stays open, and a slide with every column framed is a grid. A panel in a stretched
  column grows to the column's height, so framed regions side by side share a bottom.

The `-top` variants keep `alignItems="start"` for columns that hold a table (the renderer
scales a table to a stretched frame); the plain ones stretch so boxed cards standing side
by side share a bottom edge.

## Prose stays in the head; the body is short phrases in shapes

**A sentence belongs to the title, the one-line claim under it, and a source or note
line. Everything else on a slide is a short phrase standing in a shape** - a node of a
flow, a chip, a cell, a tile, a card's labelled row. A bullet list of sentences is a
document page projected, and the audience reads none of it while the speaker talks; a
phrase in a shape is read at a glance and the script says the sentence.

- **Distil, do not delete.** Every item the plan assigns to the slide is still on it -
  「등록·수정 시 중복과 기준정보 일치를 검사한다」 becomes `등록 · 수정 → 중복 검사 · 기준정보
  일치` in an `arrow-pair`; a five-sentence procedure becomes five `process-node`s with a
  three-word note each. A phrase that will not shorten without losing a condition keeps the
  condition and drops the verb; a claim that needs a sentence goes to `sub`.
- **The shape says the relation the sentences implied**: a sequence is a `process-strip` or
  a `flow-down`, a demand and its answer an `arrow-pair`, a set of attributes a `tag-row`, a
  measured figure a `kpi-tile` or a `stat-cell`, a grid of allowed and refused a matrix with
  `cell-on` / `cell-off`, a schedule a `gantt-row` stack, a judgement a `verdict-row` or a
  `ladder-step`, a group of three parallel things a row of `pillar`s.
- **No captions on a slide.** A figure or a capture stands alone; the slide's title and
  claim say what it shows, and a caption under a projected picture is a line nobody reads.
  The build's figure and screen templates carry no caption slot, so a chapter file cannot
  add one by accident. A source or a test run is a `delta-row` or a `note` beside the
  picture, not a caption under it.
- **Compact by default, at the room's type size.** The body and the region heading are
  the sizes the deck declares under `type`, and every padding, gap and bar is one step
  down from the document's:
  bars 30 px, region gaps 12, card paddings 8–10, table rows 26–28. Room on a slide is
  spent on content, never on air - and at this size a slide carries about half the
  characters a document page does, so **the content is cut to the size**: a region of
  eight rows becomes four, a paragraph becomes one phrase, a figure of twelve boxes
  becomes one of five. A slide that will not fit is simplified, never re-spaced tighter
  or set smaller.

## What a slide has to carry

The plan assigns every scored item and every requirement to a slide, and **each appears
on the slide it is assigned to** - in the running head's meta pair, and in the body in the
panel's own words rather than by id alone. `coverage.py` rejects a name or an id the plan
does not know and reports how much of each list the deck covers; `--complete` is the gate
for a finished deck. The plan's 배점 is never printed.

**The cross-reference cites a chapter for every evaluation item the slide is scored on.**
A slide answers two evaluation items out of two different chapters more often than it looks -
a Workbench slide scored on both 적용 기술 and 기능 요구사항, a mTLS slide on both 시스템
요구사항 and 보안 요구사항 - and the head that names one chapter leaves the panel scoring
the other with nowhere to open. **A check that only asks whether the cited chapter exists
passes every one of those pages**, which is how eight of them survived a full review round
here: the citation was true, it was just not complete. So the check reads the slide's
evaluation items too, matches each against the chapter of the same name (the RFP and the
proposal space the same name differently - 「제약 사항」 and 「제약사항」 - so they are matched
with the spaces removed), and fails on an item with no chapter. Citing more chapters than
the page has items is allowed; citing fewer is not.

**And the head band has a measured width, so adding a chapter can overrun it silently.**
The band's right end carries the deck's masthead and its left the part line, and what is
left is the room the citation gets - a body slide here has 545 px of a 795 px band, a
part's first slide the whole 795. A third chapter took one slide's head to 680 px with
nothing in the source to show it. **The renderer is what judges this**, exactly, as
`TEXT_OVERFLOW_H` with the natural width beside the box width; measuring it from the
font's advance widths instead came out 6% short of the renderer on one slide and right on
the next, which is worse than not checking. **Room is bought back by emptying the section
names of a chapter the page is not scored on, never by dropping a chapter** - the section
detail is a convenience, the chapter is the thing the panel needs.

**Never widen the band to make room.** It is the obvious move and it is invisible: the text
block is 1027 px wide, so 830 looks like slack, and the masthead the band runs into is
drawn by the *master*, so nothing in the page's own layout collides with it and no overlap
check reads it - the citation simply prints underneath the masthead. Where a deck fixes a
band's width against something the master draws, that pair of numbers belongs in a check:
one regex over each file, no false positives, and it blocks the one move a person reaches
for when a head line will not fit.

**A function or policy slide shows the demand, the implementation, the verification
criterion and the deliverable together** - the four are the shape the panel scores, so a
slide that shows the first two reads as half-answered. `trio-card` (요구 · 구현 · 검증),
`ledger-row` (demand → answer), a `delta-row` closing the slide with 「검증 · 산출물」, and a
table whose columns are those four are the components for it.

**Dense is the default.** The audience reads the slide while the script says one sentence
per region, so everything the plan lists for the slide is on the slide; the script goes
into `notes` and never replaces content. What keeps density readable is the same as on a
document page: three registers at most (a picture, a measured thing, prose in cards), one
dark surface, one accent per block, headings that differ from the head of the first card
under them.

**A screen-only slide keeps the capture as the main content.** The build fits a capture
into `full` · `side` · `half` · `third` boxes from its own pixel size (`scr-<id>-<box>`);
the slide adds the title, the requirement, numbered callouts that the speaker points at,
a `delta-row` naming the source and the test run, and under it - because a picture alone
answers nothing - the functions and judgement conditions the capture shows. Identifying
detail is masked in the copy the deck uses.

**A figure is centred in the region it is placed in, not in its own width.** The
obvious wrapper - the figure's own placed width with centring on it - is a no-op, and a
600px drawing then sits against the left edge of a 680px column while every reader reads
the gap on the right as a mistake. Give the wrapper the region's measure. The cost to
watch for is a figure sharing a row with a panel: it now claims the whole row unless the
chapter gives it a column of its own.

**A progress band under the head is three tones, in this order.** A deck that runs twenty
minutes can say where it is without the speaker saying it: a thin full-bleed strip under
the head band, its ground a shade *darker* than the band and the covered portion darker
still. Two tones will not do it - a strip in the band's own colour reads as the band
being taller, and a light ground under a dark band reads as a rule. Measure the progress
against the part the band names, not against the whole deck: that is the question the
band raises. **A part's opening page is the exception** - its deep band is the device
that says the part changed, and a bar under it reads as a rule closing that band.

**A full-page figure is the exception, and the board is what declares it.** A drawing
made on the slide's own board is one whose subject is the page - there is no second
column for it to leave room for, and redrawing it narrower to satisfy a width cap
destroys the thing it was drawn to be. So the cap applies to every board *except* the
slide board, and a figure on the slide board is not narrowed, not re-laid and not
replaced by prose. The mistake to avoid is reading a width rule as covering every figure
and sending someone to redraw the one figure the rule was never about.

**Nothing on a body slide runs the full measure.** A slide built as full-width bands
stacked down the page has no composition: a coloured bar across the block, a table across
the block, a figure across the block with white space either side of the drawing, another
bar, another table. Every block is fine on its own, every page passes its own review, and
the deck reads as a list. **A figure is placed at two thirds of the text block or less**,
and **a table and a region heading sit in a column, not across the page** - a bar opening
a column takes the narrow variant, and a table belongs to the column whose subject it is.
A figure over the cap is a figure drawn on too wide a board: redraw it narrower or stand
it in a column, never scale it down on the page, because the deck places every figure at
one scale so a label drawn at 15 units is the same size everywhere. A check reads both
rules off the chapter sources; the part-opening page's head-band slot is the one exemption,
being placed inside the head band at a width that band fixes. **Where a deck gives that
band a list rather than a figure**, the band carries the part's scored items as a list and
the body carries the drawing - one band that had held a work-cell diagram was cut to the
item names alone, because a band that says what the part covers and a body that draws it
read as one page, and two drawings do not.

**A wireframe is not a screenshot, and the deck must not treat them alike.** A capture
of running software is evidence that something works; a frame from the wireframe board
is evidence that something was drawn. Give a wireframe half a slide and the panel reads
a picture of a form nobody has run - one deck enlarged a wireframe dialog to fix a
legibility complaint and made the page less convincing, because the problem was never
the size. So: place a wireframe **small**, and only where the screen's own arrangement is
the point; and **move the mechanism it was carrying to a drawn figure**, which is the
persuasive form for a rule. A running-software capture is the opposite case and earns
its size.

**A capture is placed whole by default, and cut to one band only when the user names
that band.** A wireframe frame or a running-software capture goes on the slide as the
whole image the board or the program produced. A crop the deck chooses on its own, to the
one band that proves the point, reads to a panel as a picture nobody could reproduce and
hides what the screen's own arrangement says. The user may name the band - 「경보 부문만
크롭」 asked for the alert table of a device-detail tab on a notification slide - and a
named cut follows four rules: keep a thin band of context (the screen's header line and
its tab strip) so the panel reads which screen and which tab it is; cut from the raw
capture, never from a composite that already carries a document deck's dashed regions
and callout numbers; record the region in source pixels in the deck's capture register so
it can be retaken; and move the relation the rest of the screen carried to the figure
beside it. When the whole capture cannot be read at the width the slide leaves and no
band was named, the slide does without it - the relation it carried moves to a drawn
figure, and the document's figure set is searched first. A capture that stands whole and
still measures under the capture type floor is reported as that finding, with the band
that would clear the floor named so the user can decide the cut. **Reading the earlier
absolute rule as forbidding a cut the user asked for is the wrong reading**: the rule
exists to stop the deck cropping on its own judgement, not to overrule the author.

**A capture is placed at a size its own text survives, and the crop is what buys it.**
A picture placed as evidence and read at a third of the body size is not evidence, and
the type-floor check does not reach it: that check reads the strings the deck writes,
and a figure is exempt because it sets its own ladder. So a capture is measured
separately (`capfloor.py`) - its own line height times the placement scale, against the
floor the deck already accepts for a figure's smallest label. **A capture that fails is
never shrunk further**: the finding names the region the pointing order actually points
at, the scale rises with that cut, and the cut is made once the user names the band (the
rule above). Two captures of the same screen that differ only in a
warning row are one capture - at projection distance the pair reads as the same picture
printed twice, and the difference the slide is making has to be said in a row of text.

**An item that runs several slides says so, counting from its first slide.** 「(2/5)」
beside the chapter name. A part's opening slide has no title line to carry it, so it
prints the count in its first region bar's stub instead; counting from the second slide
tells the panel the item is one slide shorter than it is, and marking the run on one
item while leaving another unmarked breaks the reading path at that item.

**A bold mark in front of a sentence is a label, and a label needs a column.** 「**판정**
적합 · 조건부 적합」 set as one text run reads as 「판정 적합」 - one word, and the wrong
one, at the exact place a reader is looking for the qualification. Give the mark its own
fixed column in the row. A separator instead of a column only works where the body is
not itself a 「·」 list, which on a dense slide it usually is.

**One page carries one run of numbers.** A page with two captures that each start at
1 leaves the audience unable to answer "look at 3" - the numbers resolve on paper,
where the two pointing rows sit side by side, and not at all in a room. The second
capture continues the first's run (1·2·3 then 4·5·6) and its pointing row says so.

**A capture in a blind evaluation is masked before it is placed.** An address, a user
name, a certificate's organisation - a screen prints what the machine that took it
knew, and a deck that has stripped its own name from the cover can still be carrying
the company's name inside a picture. Read every capture at full size looking for it,
and mask the identity in the copy the deck uses while leaving the structure (`O=●●●●●`,
not a blank) so the row still reads as what it is.

**The callouts are fixed onto the capture, not listed beside it.** A numbered list next to
an un-marked picture leaves the audience hunting for the place the speaker means, and two
independent reviewers of one deck read the same page and made the same complaint. So the
markers live in a data file the build reads - one entry per capture, each marker a number
and an `x`/`y` pair as *fractions* of the capture - and the build emits a `-callout`
variant of every box template that layers accent discs over the image. Fractions rather
than pixels are what makes a re-cropped capture keep its markers. Two rules on placement:
a marker sits **beside** its target and never over the words it points at, and the slide
prints the same numbers in its pointing row so the list and the picture answer each other.

**A capture that needs its own frame to be read is the wrong crop.** A browser window
around a dialog spends most of the box on chrome and shrinks the type past reading size at
presentation distance. Crop to the thing the slide is about, with a thin band of context
around it, and re-crop rather than move the capture to a wider box - the box is chosen by
the layout, the crop by the claim.

## The speaker's script and the claim line are one sentence apart

**When the user asks for wording only, keep every existing text slot and diagram.**
Read the slide copy and notes together, then read the notes in presentation order.
Clarify actors, conditions, evidence status and technical terms through wording. Do not
change diagram labels, regenerate figures, rearrange blocks or modify layout properties.
Render to check the revised text fits; shorten the wording if it introduces overflow.

**A title carries its own subject.** A slide's title is read in the contents, in the running head
and again when someone flips back to it, and in none of those places is the chapter beside it
enough: 「전제조건 확정과 예방 통제」 leaves the panel asking whose prerequisites. Write the subject
into the title even at the cost of a few characters, and let the chapter line repeat rather than
carry it.


**The script has to stand without the slide.** A note that says 「왼쪽 도식은 … 이고, 오른쪽은
… 이며, 아래는 … 입니다」 tells the panel where to look and never tells them what it says - and a
panel given twenty minutes does not have time to read the page the presenter is pointing at. So
the note carries the substance: the fact, the number, the commitment, said in full. **Read every
note in order with the slides hidden and the argument must arrive complete**; where it does not,
the missing sentence goes into the note, not onto the slide. Positional narration (왼쪽 · 오른쪽 ·
아래 · 이 도식은) is deleted wherever it appears, because the words it spends are exactly the words
the substance needs.


**The printed line is written, and the spoken line is spoken.** 「먼저 전략과 방법론입니다 …
말씀드리겠습니다」 is a script, and a script on the slide reads as filler to a panel that is
reading, not listening: the claim line carries what the part shows (「이미 동작하는 수집
프로그램과 화면으로 착수 첫 주에 현황과 구현 기준을 확정해 계약 3개월 안에 시범운영까지 마치겠습니다」),
and the framing sentence that names the part and hands over to the next one lives in the note.
The two are one sentence apart, which is the point of the rule below, not the same sentence in
two places.


A slide prints one claim under its title - the line the panel is reading while the
presenter speaks - and the note is what the presenter says over it. **The note opens
from that claim line or closes on it**, so the first or last sentence a listener hears
is the sentence they are reading. Opening from it introduces the slide and the rest of
the note goes on to the detail; closing on it lets the note build and land on the line
printed above. Either way the note never restates the line word for word: spoken it is
a sentence with a subject and a natural ending, printed it is a claim in one breath.

The failure this prevents is a note that starts somewhere the slide does not - a
different fact, a different order, or the same fact in different numbers - leaving the
panel reading one sentence while hearing another. It is also what makes consecutive
slides connect: a note that lands on its own claim line hands the next slide's opening
sentence something to follow.

## The order and the page budget come from the evaluation table

A bid presentation is read against the tender's scoring table, so **that table is the
deck's contents**: its 평가부문 are the 부 (the big chapters), its 평가항목 the small
chapters, and the slides run in the table's own order - 부문 by 부문, and inside a 부문 in
the order its items are printed. Any chapter the table does not have (a 도입, a 제안개요)
is not a 부 of its own; its content moves into the scored item it belongs to.

**Pages are allocated in proportion to the score, not to how much has already been
written.** Divide the points the deck answers over the body slides, give every item at
least one page, and hand the remainder to the largest fractions first. A deck that gives
fourteen pages to a 15-point item and two to a 17-point 부문 is telling the panel the
wrong thing however good each page is. Items scored from submitted documents rather than
from the presentation (계량 항목) are left out of the deck, its plan tables and its
requirement count altogether.

**Select each page's content from what that item's 평가기준 asks**, not from what an
earlier draft happened to contain. The criterion sentence names what the panel is told to
judge - 확장성과 실현 가능성, 예상 문제와 대응 방안, 단계별 산출물, 오류 발생 시 처리
방안 - and the page answers those clauses first.

**One numbering system across the whole deck.** Pick Roman or Arabic and use it in the
running head, the contents, the foot band and the cover's order chips; a deck whose
contents says 「Ⅰ 도입」 over rows numbered 「1.1」 has two systems and reads as an error.
The small chapter's number is the part's numeral plus an index (Ⅰ-1 … Ⅴ-3), and the
coverage check strips the prefix before matching a name.

**A page title opens with the chapter it belongs to** - 「기능 요구사항 · 교체 통보와
결재선」. Several pages of one item repeat the chapter name and differ after the middle
dot, which is what lets a panel scanning for an item find all of its pages.

**After the chapter name, the title is built from the requirement's own words.** The
panel scores a slide against the RFP's requirement cards, so the title names what the
card names - 「시스템 관리 · 보안통신 · 백업·복원 · 연계방안」 out of SFR-013 and SIR-001 -
and not the deck's own phrasing of the same thing. A capability the RFP never asks for
directly (an exceptional collection path the proposer has ready, a tool it happens to
own) is neither the title nor the slide's leading region: it stands as one row inside
the region that answers the requirement it supports, and the figure and the wide column
go to what the card asks. A title in the deck's words sends the panel looking for the
requirement on another page.

## The first page of a part carries a deep band

A slide deck has no dividers, so the place a 부 changes has to be visible on the page that
opens it. Drop the head band to about 210px in the part colour and put inside it, reversed
out: the part numeral, **the part's own name as the title**, one sentence saying what that
부 claims, that 부's small chapters as outlined chips, and - at the right - a figure of the
부. The band is not decoration: it carries the part's own table of contents and its claim,
which is why it earns the height. The page's own subject then belongs to its first region
bar. Its body starts about 90px lower than a normal page's.

**The claim is a claim, not a summary of the contents**, and it names things rather than
likening them: 「범위·일정·산출물을 승인 항목으로 정하고 승인 없이 바꾸지 않는다」, not 「관리의
큰 줄기를 세운다」. A metaphor or a personified system reads as decoration exactly where the
panel is looking for a commitment.

**Do not use 「기준선」 in a presentation deck.** It makes an evaluator infer whether the
slide means a current-state measurement, an approved requirement, a fixed test condition,
or a configuration version. Name the object and the decision directly: 「도입 전 처리기간
측정값」, 「승인된 요구사항」, 「시험 조건」, 「형상 승인본」, or 「승인 항목」. Apply the
same replacement to diagram labels and speaker notes; do not leave the abstract term as a
shorter synonym.

**A figure inside the band is drawn for the band, not for paper.** White ink on the band
colour falls to about 2.5:1 and its small labels stop being readable; draw it on a panel of
the part's **deep** colour, where white clears 4.8:1, and let the figure paint that ground
itself so the contrast check measures what the reader sees. Give the band board a fixed
height - it is the one board whose height the layout, not the content, decides.

**Set the part numerals in the sans, not the display serif.** A serif Ⅰ or Ⅱ is a hairline
at any size, and the numeral is the one character on the page that has to be read at a
glance.

**The head band is one full-width strip.** A separate box floated at its right for the deck
name reads as an unfinished corner; the deck's name stands on the foot band beside the
client's mark, and the head band carries the part, then a white 「본제안서」 badge and the
proposal reference after it - the badge is what turns a string of chapter numbers into a
citation the panel can follow.

**When the deck is given brand artwork, the artwork is the master.** A designer's
reference deck usually arrives as this deck's own build with pictures pasted on its
masters: one picture per part opener (the deep band, an illustration at its right, a
rounded white card under the band), one for the page outside the score table, and the
cover, contents and closing grounds. Take the pictures into `assets/brand/` at 2× the
page and set them as `backgroundPath` on the masters the generator writes - nothing on
the page changes hands. Two things follow. The opener's right 400px are the
illustration's, so the part's item list comes off the band; the contents page and every
foot band already name the items. And the body stands on the card the picture draws, so
the first region's top margin is read off the card's edge (26px under a 224px band),
not off the band. A picture that carries the client's mark on a dark ground needs the
white version of the mark, rasterised from the designer's SVG - the standard mark is
navy on navy there and vanishes.

## A part's opening page may be one figure

The opening page's job is the whole part's argument, and a drawing makes it in
one look where a pair of tables makes it twice. Where a deck takes that option it
needs a second shell beside the ordinary opening page - same head band, same
title, same claim line, same foot - whose body slot is placed by the Layer at the
page's own measure rather than inside the text margins, because a body wider than
the padded stack overflows its parent and the renderer reports it. Declare it in
the catalogue with a `use` line naming the ordinary shell, and say in the deck's
instructions that the wide body is for one figure and nothing else: a card, a
table or a region heading still stands on the text measure, and the moment a
second block joins the figure the page is an ordinary opening page that happens
to be wider.

Every check that keys on the shell's name has to learn the new one - the page
reader, the folio list, the density and census counts, the shape check, the
running-head citation, the progress band and the width check each match a
template name, and the longer name goes first in an alternation or the shorter
claims the prefix. A shell nobody taught them about is a page measured by
nothing.

## Cover, contents, closing

- **The cover is a content slide.** On a landscape deck submitted on paper it carries the
  order of the presentation (one `order-chip` per part in the part's colour), the team's
  roles as codes when the evaluation is blind, and the opening claim - not only a title.
  It stands on the light half of the brand artwork; the artwork is cropped to landscape
  from the document deck's, never redrawn.
- **The contents page is two levels, not three.** The big chapters as group heads in the
  part colours, the small chapters as rows - **the chapter number at the left of the row
  and the page number at its right** - and nothing under them. A third level naming each
  page's subject turns the contents into a second deck and is not what a panel reads it
  for. It carries no folio. On branded artwork the five parts stand as five white cards
  (`toc-card`), three across and two centred under them, the part's head in its colour
  over a short rule; the page numbers stay on the rows, because `tocpages.py` reads them.
  The card's head is set in the display serif whole, so its numeral prints in the one
  shape the page uses (`roman.py`).
- **The closing slide is one promise row** on the closing artwork: the greeting centred
  between the artwork's two shapes, the project name in navy beside the artwork's bar at
  the top left (from the master), and three white promise cards along the foot, each
  head in the card's own colour.

## Rhythm across slides

The document's placement rotation does not transfer as such - a slide has no figure on
every page - but its two rules do: **no layout three slides in a row, and two consecutive
slides never share both their layout and their most-used component.** A run of function
slides that are all `cols3` of `trio-card`s is one slide printed fourteen times, and a
deck whose every body is bullet rows reads the same however the columns move. Vary the
form with the content's nature: a sequence is one of the seven sequence shapes below, a
judgement a `verdict-row` or a `ladder-step`, a measured figure a `kpi-tile` row, a
`stat-cell` row or a `fact-band`, a demand facing its answer an `arrow-pair` or a
`ledger-row`, a set of names a `tag-row`, a permission grid a matrix, a schedule a gantt,
a screen a `screen-side`, three parallel things a row of `pillar`s. Vary the arrangement
between symmetric, asymmetric (both sides), rail and stack - and within a slide keep
three registers at most: a picture, a measured thing, phrases in shapes.

**One sequence shape per slide, and not the same one twice in a row.** A sequence has
seven shapes here - the numbered circle strip (`process-strip`), the chevron row of
filled cells (`flow-row`), the plain-numbered stage strip (`stage-strip`), the vertical
flow (`flow-down`), numbered rows (`step-row`), ladder steps (`ladder-step`) and the
numbered detail (`stage-detail`) - and a deck that reaches for the circle strip on every
slide is the bullet list reborn with circles. `census.py` fails a container shape that
stands twice on one slide, any sequence shape on two consecutive body slides, and any
that stands on more than a third of the body slides; the project lists its sequence
shapes in `checks.census`.

**Every slide is full.** A slide that ends at three quarters of its body reads as a slide
with nothing more to say; measure the fill after every render (the ink of a body slide
reaches 90 % of the page height or more, the foot band excluded) and fill the room with
the plan's remaining items, the manuscript section the slide summarises, a figure the
document already has, or a second relation the slide implies - never with air, a larger
figure or a taller row. Fill per column: the short column takes the next shape, so a
2 : 1 layout's narrow column ends where the wide one does.

**Full is not crammed.** The fill rule is met with spacing and type, not with more
shapes: regions stand 18 px apart, sections 10, a row's padding is 7–10, a table row
22, and a slide carries what the plan assigns it plus what that room takes from the
manuscript - no more. `density.py` counts the characters a reader sees and the shapes
that carry them (a strip, a flow or a chip row is one shape) and fails a slide over
`checks.density.maxChars` / `maxShapes`, the ceilings the project set the day its author
called a slide too dense; a slide over either is trimmed, never re-spaced tighter.

**The contents page breathes.** Its rows are read down a column at a glance, so a row
stands 21 px apart and a part group opens with 10 px above it; a tighter list reads as one
grey block.

## A part's first page is its overview

A slide deck opens each part with a page of its own shell (`page-open`), and the user set
what that page is: **the part's overview, never page (1/n) of its first evaluation item.**
Three things follow. The head band prints no item and no count - it carries the part title,
the part's evaluation items as a list at the band's right edge behind a hairline rule, and an
claim, written to be read - what the part will show, in one or two sentences - in the room the
list leaves; the foot names the item range (「Ⅳ-1 ~ Ⅳ-3 · 프로젝트 관리 개요」) with no
requirement ids. The body carries the part's argument - one figure on one topic beside the
proposer's claim for each evaluation item, and a closing row of the part's strengths - built
from the same shapes as any body page; a four-storey figure that runs the whole slide is a
poster, and it was rejected. Detail that is not overview moves to the sub-chapter page that
owns it, and when no page does, a new one is added (34a · 39a here) and the contents ranges
are recomputed (`tocpages.py --write`). The citation and coverage checks read an opener's
`ref` as the part's chapters and skip the per-item rule.

## Figures on a slide

A document figure is never placed on a slide as it is: it is drawn for paper at its own
ladder, and on a slide its labels print under the body size. The slide's figure is redrawn
on the slide's board with the relation kept and the content cut to what the size carries,
and a paragraph that is a relation becomes a drawing - [figures.md](figures.md). **Every
figure on a slide prints at one scale, the one that puts the ladder's smallest step at the
body size** (11 ÷ 15 = 0.7333 here), so a board is the placed width divided by that
scale - 873 for a 640 px column, 640 for 469, 378 for 277, 1400 across the text block, 1488 across the page - and a
figure never fills a slot by being enlarged or fits one by being shrunk. The height a
figure may take on a slide is what the slide leaves after the rows beside it; re-lay it
sideways before cutting anything, and never leave a figure narrower than its column - the
blank strip beside it reads as a hole.

**A schedule is a figure, not a run of bar templates.** A week grid built from text boxes
prints its bar labels at the body weight, drifts off the week pitch by the gap arithmetic,
and reads as blocks of tint; the user asked for its type 「약간 더 작게」 and the chart
「좀더 알아보기 쉽게」. It is drawn on the text-block board (1400 here, placed at 1027 px)
under its section bar: alternate week columns washed as paper (a filled path, not a rect,
so the lint reads bars and not washes), one row per activity in a phase colour with a
stripe naming the phase, every label at the ladder's smallest step in regular weight, a
milestone on the week boundary each approval falls on, and a legend row. The smallest
step is the floor, so 「smaller」 is met by weight and by cutting the bar text to a phrase,
never by a size under the ladder.

## Before a slide is done

1. `error 0 · warn 0`, `layout_check` (every kind, `ink` and `package` named) clean,
   `rules_check` 0 failed, `rowheight.py` 0; `refpages.py` and `coverage.py`
   clean; `census.py` 어긋남 0 and `density.py` 초과 0.
2. The PNG has been looked at, and both columns reach the foot of the body; one or two
   column regions stand in a frame and the rest stand open.
3. The head names the part and the document section with its pages, the foot the items,
   the requirements and the folio; the title is a name and `sub` is one claim.
4. Everything the plan lists for the slide is on it as short phrases in shapes; a sentence
   stands only in the title, the claim and a note or source line; no caption stands under a
   figure or a capture; the four (demand, implementation, verification, deliverable) are on
   every function slide; the script is in the notes.
5. The layout differs from the two slides before it in layout or in most-used component;
   an asymmetric layout mirrors the last asymmetric one.
6. The Korean audit reports zero over the deck's sources.
7. The order still matches the evaluation table, the page counts still match the score
   allocation, and the numbering is one system in the head, the contents, the foot and the
   cover.
8. If the review is limited to wording, the diff changes only text and notes. Preserve
   the diagrams and every layout property, and distinguish existing diagnostics from
   any regression introduced by the revised wording.

**Two width limits that fail as a layout error rather than a warning.** A `step-row`-shaped
component (number plate + head cell + body + key cell) needs a column of about 600px; in a
507px half or a 319px rail it spills, and the fix is a label/value row or a numbered stage,
not a shorter string. A two-label card (`pair-req`, `pair-card`, `trigger-card`) gives its
labels a 34px column - two Korean characters; a three-character label overflows on every
use of that card.
