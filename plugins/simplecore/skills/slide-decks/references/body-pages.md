# Writing a body page

`SKILL.md` decides what a page may look like - the palette, the rule budget, the running-head
contract, the fill target. This file decides how a **document deck's** body page gets written
(a slide is in [landscape-slides.md](landscape-slides.md)): the procedure from a manuscript
page to a deck page, the anatomy of a chapter file, which component carries which kind of content,
how the headings stack, how a run of pages is kept from reading as one page repeated, and where a
figure goes.

Read it before typesetting the first page of a chapter, and again when a stretch of finished pages
starts to look the same.

## The procedure

A manuscript page-file (one section file under the deck's `manuscript` directory) becomes one
chapter file holding one or more deck pages. In this order:

1. **Read the page-file and its figure(s).** Note the claim each `##` section makes; a section that
   is a table stays a table, a section that argues becomes a region of cards.
2. **Decide how many deck pages it is.** The manuscript's page budget gives the chapter its pages;
   divide by the chapter's page-files. On an A4 text block a deck page holds about 650 characters
   beside a full-width figure and about 1,150 across two columns with a table, and a sentence
   never continues onto the next page.
3. **Write `sub` for each deck page first** - one claim per page - then `title`, a name.
4. **Pick the figure's placement from its claim**, then check the rotation (below). A page whose
   claim wants a column placement needs a figure drawn on the column board; if the manuscript's
   figure is on the full board, redraw it there, keeping its number and caption.
5. **Map each `##` section to a region**, choose the component by the content's shape, and write
   the page.
6. **Build, render, read the PNG, measure.** The page is done when its content reaches the
   bottom of the text block; the parity check's `--coverage` lists the declared manuscript the
   page does not show yet, and that is what fills the rest. Then run the deck checks. Only then
   the next page.

A figure that does not exist yet is added to the manuscript first - the `![…]` line, the caption
line and the row in the manuscript's figure list - and to the deck second. The figure-numbering
check fails a deck page whose number the manuscript does not carry, so the two cannot drift.

## The anatomy of a chapter file

One chapter file per manuscript page-file, holding as many `<Use template="page">` blocks as that
page-file needs, in printed order, and nothing else.

**A section that needs a page gets that page in its own chapter file, at its own place in the
import order.** The tempting shortcut is to append it to a chapter file already open - the
neighbouring section, the one the page cites - and the page then reads fine on its own while the
deck's order no longer follows the manuscript's. Figure numbers are what say so first: a figure
belonging to the manuscript's fourth section, printed inside the file that draws the first, makes
the chapter's figures come out `1 4 2 3` and `fignum.py` fails the whole chapter. Renumbering is
the wrong repair - it moves four figure files, the manuscript's own captions and every reference
to them, to hide a page that is simply in the wrong file. Move the page.

```xml
<Fragment>
  <!-- Ⅳ-2 02 · 수집과 정규화 - 세로 도식 + 단 -->
  <!-- md: <part>/<chapter>/<nn>-<page-file>.md -->
  <Use template="page" p="4"
       part="기술 및 기능"
       chapter="2. 기능 요구사항 · 정보수집"
       title="수집 값의 정규화와 원본 보존"
       sub="장치가 무엇을 돌려주든 같은 판정에 이르고, 해석하지 못한 값은 원본 그대로 남는다."
       evalItem="기능 요구사항" reqs="SFR-004 · 005">
    <Slot name="default">
      …
    </Slot>
  </Use>
</Fragment>
```

Above every page, in this order:

- **A layout comment** - the page's identity and the placement it uses, in the names of the
  placement table below (`세로 도식 + 단`, `전면 도식 + 3단`, `표 한 장`). `rhythm.py`
  reads the placement from the templates, not from this line; the line is for the person scanning
  the file.
- **An `md:` comment** naming every manuscript file the page draws from, comma-separated.
  The parity check reads it: a page with no `md:` line is invisible to the parity check, and
  a manuscript file no page claims is reported as unplaced. When one page-file becomes three deck
  pages, all three carry the same `md:` line.
- **The head values.** `p` · `part` · `chapter` · `title` · `sub` and the deck's two meta fields. Never drop one - pass `해당 없음` or ` - `. The deck's instructions hold what each means. `chapter` is
  「장 번호. 장 이름 · 이 쪽의 주제」, and it stays the same across the deck pages of one
  page-file while `title` and `sub` change.

### How a manuscript parity check reads a page, and what that costs

Where the deck runs a parity check against its manuscript, three strings on a page are compared
three different ways, and every 없음 comes from mixing them up.

- **A `<Text>` body** is split into sentences and each sentence must be a **substring of the
  manuscript**. Copy them; never paraphrase, never trim a clause out of the middle, and never put
  two non-adjacent manuscript sentences in one `<Text>` - the check reads them as one and finds
  neither. A shorter substring of one sentence is fine.
- **An attribute** - `head` · `bodyText` · `valueText` · `label`, and a `<Td text>` - is matched as
  one loose string with the separators stripped, so it may be shortened to fit a column and two
  *adjacent* manuscript sentences may be joined. Skipping a clause in the middle still fails.
  Anything under six characters is not checked at all, which is what makes a short card head or a
  two-glyph label free. **「shortened」 means a contiguous run of the manuscript's own characters,
  not a phrase rebuilt from its words**: 「결재선 확정」 fails beside a manuscript that says
  「결재선을 확정한다」, because dropping the particle out of the middle leaves 「결재선확정」, which
  the manuscript nowhere holds. A coined head of two words is the shape that keeps hitting this -
  either take a run the manuscript actually prints, or keep the head under six characters.
- **The deck's own punctuation conventions are normalised away, on both sides.** A full stop is
  one of them: this deck closes a sentence with 「.」 and its manuscript tables do not, so leaving
  the stop in the comparison made every cell the convention touched report as a claim with no
  source. The same holds for a separator swapped to fit a column.
- **A printed URL and a manuscript link are the same string.** The manuscript writes
  `[개인정보 보호법](https://law.go.kr/…)` and the page prints 「개인정보 보호법 (law.go.kr/…)」,
  because the deck drops the scheme and the `www.` from a printed address. `parity.py`
  unwraps the link and strips the scheme on both sides before comparing; before it did, the
  bibliography annex reported 43 correctly typeset citations as claims with no source. A
  finding that lands on a whole annex at once is the check, not the page.
- **A heading** - the `text` of `section-bar` · `section-bar-req` · `h2` · `item` - is checked word
  by word against the manuscript's tokens. 「사업 특성 · 제안 대응」 passes where
  「사업 특성과 제안 대응」 fails, because 「특성과」 is not a token the manuscript holds. Separators
  are not words, so `·` joins two manuscript phrases for free. **A `section`'s `text` is not checked
  at all** - reach for it when no wording that says the right thing survives the word check.

**A head that carries the subject and a body that carries the predicate is one claim, and
`--coverage` cannot see it.** The manuscript writes 「운영자는 배치·연계·에이전트·저장공간의
이상을 확인한다」; the card names the role in its head and opens the body at 「배치·연계…」, which
is what stops the page reading the name twice. `parity.py` passes, because the body is still a run
of the manuscript's own characters - but `--coverage` compares whole sentences and lists that one
as untypeset. **That listing is not a defect and the manuscript is not what to fix.** Never edit a
manuscript sentence to make a coverage line disappear: the claim is on the page, split across two
attributes the way the deck's own components are built to split it.

`title` · `sub` · `caption` are deck furniture and are not checked against the manuscript.

`title` is a name, not a sentence, and `sub` is the one claim the page proves. Write `sub` first:
it is the sentence the whole page has to earn, and the page is finished when a reader who reads
only `sub` and looks only at the figure has the argument.

## The page opens with something that is not a paragraph

A body page that begins with prose reads as the continuation of the page before it, and a hundred
of them read as one long document with no landmarks. A page opens with a figure or with a shaped
block, and which one is a decision, not a habit:

| Opener | Use it when |
| --- | --- |
| a figure | the claim is a structure, a sequence, a boundary or a quantity |
| `fact-band` | the claim is a number with three supporting numbers around it |
| `col2` of two `item`s | the page argues two principles that hold over everything below |
| `proof-strip` | the page exists to prove one statement and name the evidence |
| a `section` whose first child is `transform-lane` or a card | the page is one mechanism, explained at once |

After the opener, the page is regions. A region is a heading plus its body. Two or three regions
is the usual page; one is right when that region is a table that fills the page; five is a page
that should have been two.

## Three heading levels, and they never compete

| Level | Template | What it opens | Carries |
| --- | --- | --- | --- |
| region | `section-bar` · `section-bar-req` · `bar-ink` · `bar-quiet` | a whole region, spanning the text block | `text` and `keyText` (a citation) or `ids` (requirement numbers) |
| sub-section | `section` · `section-req` (an `h2` with a body) | a division inside a region, or a region without a bar | `icon` and `text` |
| item | a card's head (`card`, `pair-card`, `trio-card`, …) | one item | `head` |

**One bar per region, headings beneath it.** A `section-bar` immediately followed by an `h2` with
nothing between them means one of the two is carrying nothing - drop the bar and let the heading
open the region, or give the bar a body.

**Every `section` and `h2` passes an `icon`; a bar never does.** The bar's coloured edge is its
mark. The icon names what the heading is about, so it is chosen per heading - a page whose four
headings all carry `check-circle` has four headings that say nothing to each other. Check the name
against `<deck>/node_modules/@slideglance/builder/dist/icons/iconData.js` before using it; an
unknown name fails the build rather than drawing the wrong glyph.

**A requirement number inside the body is a badge**: `section-bar-req` at the end of a bar,
`h2-req` at the end of a sub-section heading, `reqbadge` standing alone. Never a bare number on a
line of its own.

## Choosing the shape of a region's body

`SKILL.md` carries the judgment test - a row of 4+ short attributes scanned by column stays a
table; 1-3 prose attributes answering what/why/how becomes a labelled card.

**The index of what to reach for is the server's, read with `definition_find` from the
declaration each template carries** - the table below is the entry set every deck starts with, and
it is not the deck's inventory. A hand-kept index is complete on the day it is written and shorter
than the templates on every day after: one deck's covered twenty of its ninety-nine, and the
seventy-nine outside it were the ones nobody used. Read the generated catalogue for the deck in
hand, and `render_definition` to see a shape rather than its name.

The parameter list is exact - every one is required, because `<Use>` has no defaults and a missing
one fails the build naming the placeholder.

| The content is | Reach for | Parameters |
| --- | --- | --- |
| a quiet label/value list | `keyrow` | `label` `valueText` |
| one item, an icon earning its place | `item` · `detail-card` | `icon` `head` `bodyText` |
| two labelled rows under one head | `pair-card` | `head` `aLabel` `aText` `bLabel` `bText` |
| three rows closing on a verdict | `trio-card` | `head` `aLabel` `aText` `bLabel` `bText` `cLabel` `cText` |
| an ordered sequence, one line each | `step-row` | `no` `head` `bodyText` `keyText` |
| an ordered sequence in a strip | `num-step` · `flow-step` (+ `flow-arrow`) | `stepW` `no` `head` `note` / `stepW` `head` `note` |
| an ordered sequence with a judgement each | `ladder-step` · `verdict-row` | `no` `head` `subText` `midLabel` `midText` `endLabel` `endText` |
| a demand facing its answer | `card-split` | `icon` `head` `keyText` `leftLabel` `leftText` `rightLabel` `rightText` |
| a requirement and how it is met | `ledger-row` | `reqId` `demand` `answerLabel` `answer` |
| a choice among alternatives | `choice-card` | `head` `chipText` `aLabel` `aText` `bLabel` `bText` `tailText` |
| one measured figure among three | `fact-band` | `inkLabel` `inkValue` `inkNote` `labelA` `headA` `noteA` … `noteC` |
| a row of measured figures | `stat-cell` | `value` `unit` `label` `source` |
| input → operation → output | `transform-lane` | `inLabel` `inHead` `inNote` `opLabel` `opHead` `opNote` `outLabel` `outHead` `outNote` |
| one fixed source and what reads it | `col-rail` (slots `rail` · `body`) + `anchor-cell` + `paired-note` | `label` `value` `head` `subText` / `labelW` `head` `subText` `aText` `bText` - `labelW` is 105 across the text block and, in a column, the longest label of the stack plus 6 |
| a stage with a time on it | `stage` | `icon` `head` `when` `bodyText` |
| a claim and its evidence | `proof-strip` · `proof-line` · `asset-card` | `head` `proof` `bodyText` `tailLabel` `tailText` / `head` `bodyText` `tailText` / + `form` |
| an aside a region needs | `note` · `ruled-note` | `mark` `bodyText` / `head` `bodyText` |
| rows falling into subsystem groups | a `Table` with a lane column | `lane-collect` · `lane-core` · `lane-tool`, `rowspan` |

The full signature of every component is the placeholder list in the deck's
`templates/components.xml` (the kit ships the same set); this table is the ones a body page
reaches for.

### Taking a page out - the figure is the lever

A deck that has to lose pages loses them fastest where a figure and its prose are both
carrying the same content. Work in this order, and measure after each:

1. **The prose a figure already draws.** `figtext.py` fails only at three verbatim runs of
   ten characters or more, which is the flagrant case; the ordinary case is a paragraph
   that walks the reader through the boxes the figure beside it already shows. Cut it, and
   keep the caption doing the naming.
2. **The second copy of an explanation.** `mdtwice.py` names the manuscript sections that
   say the same thing in almost the same words. Delete one and let the other stand; both
   the manuscript and the pages carrying it get shorter at once.
3. **A prose region that would be a figure.** A sequence, a matrix of who-does-what, a set
   of boundaries between things - each of these is shorter drawn than written, and the
   figure generator already knows how to draw them.
4. **Only then, sentences.** And never the exception, the threshold, the acceptance
   criterion or the wording the requirement uses - those are what the page is scored on.

What never comes down: a type size, a page's fill, or a figure's scale.

**When two page-files become one page, that page declares both manuscripts.** The `md:`
comment takes both paths, comma-separated, with the earlier section first - the parity check
reads it to know what the page may print, the carry check reads it the other way to see that
both sections still reach a page, and the order check reads its first path. Drop one and the
section it named is reported as carried by nothing. The emptied chapter file is deleted, its
running-head `(n/m)` markers disappear with the topic that is now a single page, and **the
`<Import>` line is removed by whoever owns the deck's import list** - when several people are
cutting at once that list is the one file their edits collide in, so it has a single owner who
strips every retired import in one pass before the next build.

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
the content's nature and the arrangement between a full-width stack, a two-column grid
(`col2` · `col2-top` · `equal-pair`) and a rail (`col-rail`). `rhythm.py` fails two
consecutive pages that share both their placement and their most-used component.

**A page needs a shape that is not a paragraph and not a list.** `pageshape.py` fails a body page
whose body is prose and bullets under every heading, and a 「list」 of one row - both of which read
as deliberate on the page and as one page repeated over a run. Its `--simulate` reads every list
run and names what the content's own form asks for, then picks under the rhythm rules so the deck
does not trade bullets for one card used everywhere. Run it before rewriting a page.

**And it counts the whole set.** The same script prints a census per 부 and fails a 부 where one
component carries more than a third of the card uses, or that uses fewer kinds than it has pages
(capped at ten); it also lists the components no page has reached for yet. Five cards over fifty
pages is the failure this catches - every page passes its own review and the run still reads as
one page repeated.

Three of these need the parent to be right. `key-panel` and `badge-panel` are `flexGrow` columns
and resolve to zero height unless an `equal-pair` or a `col2` gives them a row. `ruled-note`'s
`head` sits in a fixed 72px column, so it holds about six glyphs and wraps past that. And a card's
`head` must not repeat the heading of the section it sits under - rename the heading, which is
deck furniture, not the head, which traces to the manuscript.

## Reading rhythm

Rhythm is what a reader feels turning eight pages in a row, and it is not visible while writing
one. Two scales.

**Inside a page.** Three registers and no more: a picture, a measured thing, prose in cards. A page
of nothing but cards is a wall; a page of nothing but prose is a report; a page carrying a figure,
a table and four card kinds is noise. The dark surfaces - `fact-band`'s ink panel, `bar-ink`,
`card-ink` - are where the eye stops, and a page carries at most one of them; a figure is not one
of them and may stand beside one.

**Across a run of pages.** A document deck that places a figure on **every** body page - 150 figures over about 180 pages
is the case this rule came from - carries the whole risk: a hundred pages of *landscape figure across the top, cards
underneath* is one page printed a hundred times, and no individual page will look wrong, which is
why page-by-page review never catches it.

So the placement rotates, and `rhythm.py` enforces it: **no placement runs three pages
in a row; two consecutive vertical figures do not stand on the same side; two consecutive pages do
not share both placement and most-used component.** Ten placements are available, and each is the
natural home of a particular claim - pick by the claim first and check the rotation second.

| # | Placement | Built from | The claim is |
| --- | --- | --- | --- |
| 1 | 전면 도식 | `fig-<id>` first in the default slot | a structure the page then explains |
| 2 | 하단 도식 | `fig-<id>` after the last region | the conclusion the page reached |
| 3 | 세로 도식 · 왼쪽 | `fig-col-left` | a sequence or a descent, explained beside itself |
| 4 | 세로 도식 · 오른쪽 | `fig-col-right` | the same, mirrored |
| 5 | 세로 도식 + 표 | `fig-col-*` whose text column carries a `table-sm` | a sequence whose steps each have a row of attributes |
| 6 | 세로 도식 2장 | `fig-pair` + `fig-<id>-pair` | two paths compared step for step |
| 7 | 전면 도식 2장 | `fig-stack` + `fig-bridge` | a derivation: the first figure's result is the second's input |
| 8 | 전면 도식 + 3단 | `fig-<id>` then `col3` | one structure whose three parts each need a sentence |
| 9 | 레일 + 본문 | `col-rail` | one fixed thing on the left and everything that reads it |
| 10 | 도식 없는 쪽 | a table or a matrix | the content is a record set; the chapter's figure sits on the facing page |

**Placements 3–6 exist only for a figure drawn on the column board**, so a chapter's rotation is
decided when its figures are reviewed, not page by page: read the chapter's figures, pick the ones whose claim is a sequence or
a descent, and redraw those. A chapter of landscape figures alone still rotates across 1, 2, 7, 8,
9 and 10.

Four rules, all learned from the facing page rather than from the single page:

- **Alternate the side.** Two consecutive `fig-col-left` pages tip the whole spread one way.
- **A figure that opens a page and a figure that closes one are different arguments.** At the top
  it is the structure the page then explains; at the foot it is the conclusion the page reached.
  Do not move a figure to the foot for rhythm alone - move the argument.
- **A page with two figures owes the reader the link between them.** In `fig-pair` that is the
  `claim` slot's one heading; in `fig-stack` it is `fig-bridge`'s one line. Two figures with no
  stated relation is a page the reader has to assemble.
- **Placement 10 is not a gap in the set.** A chapter whose every page carries a picture has no
  page where the picture matters. Where a page-file's content is a record set - a requirement
  table, a schedule, a matrix - leave it as the table and let the neighbouring page carry the
  figure.

### The two-figure placements

```xml
<!-- 6 · 세로 도식 2장 - 같은 높이의 판 2장을 327px씩 나란히 -->
<Use template="fig-pair">
  <Slot name="claim">
    <Use template="h2" icon="arrow-left-right" text="같은 네 단계, 다른 판단 근거" />
  </Slot>
  <Slot name="left">
    <Use template="fig-02-01-01-pair" no="그림 Ⅱ-1-1" caption="경험으로 판단하는 지금" />
  </Slot>
  <Slot name="right">
    <Use template="fig-02-01-02-pair" no="그림 Ⅱ-1-2" caption="임계치가 판단하는 목표" />
  </Slot>
  <Slot name="default">…</Slot>
</Use>

<!-- 7 · 전면 도식 2장 - 앞 그림의 결과가 뒤 그림의 입력일 때만 -->
<Use template="fig-stack">
  <Slot name="top"><Use template="fig-02-02-01" no="그림 Ⅱ-2-1" caption="…" /></Slot>
  <Slot name="bridge">
    <Use template="fig-bridge" text="구간을 지날 때마다 다음 구간이 근거로 삼을 기록이 하나씩 남는다" />
  </Slot>
  <Slot name="bottom"><Use template="fig-02-02-02" no="그림 Ⅱ-2-2" caption="…" /></Slot>
</Use>
```

- **`fig-pair` takes the `-pair` variant of the template, not the plain one.** Every column-board
  figure gets both: `fig-<id>` places it at 300px, `fig-<id>-pair` at 327px. The pair prints its
  labels at about 7.1pt against the lone column figure's 6.5pt - inside the band, and a pair is
  read against its partner, not against the page's other figures. The full board has no pair
  variant, because 1200 units at 327px prints the smallest label at 3pt.
- **The two figures in a pair are drawn to the same board height.** Different heights leave the
  two captions on different lines and the pair stops reading as a pair.
- **A pair compares; it does not merely fit two pictures on a page.** Two unrelated figures side
  by side make the reader hunt for a correspondence that is not there.
- **`fig-stack` is for a derivation, not for a page that happens to have two figures.** Two
  full-width figures with no bridge is a page that got longer, not clearer.

## Placing a figure

Every figure is placed at one of two widths, and **the board it was drawn on decides which**.
`build.ts` reads the width out of the SVG; the chapter file cannot override it, which is what
stops a landscape drawing being squeezed into a column at 3pt.

| Board | Placed at | Height: target · review | The claim is |
| --- | --- | --- | --- |
| 1200 (`STANDARD_WIDTH`) | 682px, the whole text block | 720 · 840 units (840 ≈ 478px) | a comparison, a matrix, a timeline, a fan-out, a wide row |
| 520 (`COLUMN_WIDTH`) | 300px, one column | - · 1400 units (≈ 808px) | a sequence, a rail of states, a stack of layers, a descent |

Both ratios are about 0.57, so the smallest step of the type ladder prints at roughly 6.5pt on
either board and two figures on facing pages read at the same size. The generator directory's own `AGENTS.md`
carries the drawing rules for both.

The call is always the generated template plus a number and a caption:

```xml
<Use template="fig-04-02-02" no="그림 Ⅳ-2-2"
     caption="장치가 무엇을 돌려주든 같은 판정에 이르는 경로" />
```

- **`no` is 부-장-순번**, and it is the manuscript's number. The figure-numbering check fails a deck
  number the manuscript does not carry, a number repeated in the deck, and a chapter whose deck
  numbers run out of order; the manuscript itself has to run 1..n with no gap.
- **The caption states what the picture shows, not what the section argues.** The argument is
  `sub`; a caption that repeats it makes the reader read the same sentence twice, and
  the echo check reports the overlap.
- **A figure never carries a document section number in its own text** - the number moves when a
  page is inserted. The figure verifier catches the Arabic shape (`3.4`, `3.4.1`); a Roman
  reference (`Ⅳ-2 참조`) it does not catch, so that one is on the author.

## The column layout

The layout the vertical board exists for. A tall figure stands in one column with body text beside
it, which is the only placement on the page that reads as a *spread* rather than as a stack.

**A numbered sequence is never dealt evenly into the columns.** Two columns holding the same
number of items pair them into rows, and a reader takes the row before the column - so 1·2 on
the left beside 3·4 on the right is read 1 3 / 2 4, and the order the page is about arrives
shuffled. Nothing on the page looks wrong: each card is right, the layout is right, and the
numbers are in order in the source. An **uneven** split does not pair up and reads down the
columns as written, which is why five beside two is fine and two beside two is not. A sequence
that will not fit one column goes across the block as a `stage-strip`, where the chevrons carry
the order and the reading direction is the order. `pageshape.py` fails on the even split.

```xml
<Use template="fig-col-left">
  <Slot name="figure">
    <Use template="fig-04-02-01" no="그림 Ⅳ-2-1"
         caption="장치 등록에서 청구까지의 아홉 상태와 상태마다 남는 기록" />
  </Slot>
  <Slot name="default">
    <Use template="section" icon="git-branch" text="상태마다 두는 네 가지">
      <Slot name="default">
        <Use template="keyrow" label="진입 조건" valueText="앞 상태의 종료 조건을 충족한 건만 받는다" />
        …
      </Slot>
    </Use>
    …
  </Slot>
</Use>
```

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
  the caption inside the same slot; a card there turns the column into a second body column and
  the layout stops reading.
- **The text column takes the page's ordinary regions.** `section` with an icon, cards, a
  `footnote` to close - the components do not change, only their width. A three-column `table-sm`
  fits (placement 5); a wider table is what the full-width placements are for.
- **Alternate `fig-col-left` and `fig-col-right`** across consecutive pages.

### Widths a component needs

A component that fits the full 682px does not necessarily fit a column, and the failure is a
`TEXT_OVERFLOW_H` warning naming a box a few pixels too narrow - never an error, and never the
name of the component. What has been rendered in each slot:

| Slot | Width | Rendered there |
| --- | --- | --- |
| full text block | 682 | every component, a seven-column `Table` |
| column layout's text column | 354 | `section`, `keyrow`, `pair-card`, `note`, `footnote`, a three-column `table-sm` |
| a `fig-pair` half | 327 | a column-board figure with its caption |
| a `col2` half | 325 | `pair-card`, `trio-card`, `item` |
| a `col3` third | 211 | `detail-card`; `keyrow` fails here |

**`keyrow`'s value is one line and never wraps** - the value box is `w="max"`, which sizes to the
content. Its budget is the row's width minus 106 (the 92px label and the 14px gap): 248px in the
354 column, 105px in a third. A value past the budget spills into the margin with a
`TEXT_OVERFLOW_H` warning; in a third, reach for `detail-card` instead.

## Where the layouts live

The layout templates are in the deck's `templates/page.xml` - `fig-col-left`, `fig-col-right`,
`fig-pair`, `fig-stack`, `fig-bridge` alongside the older `col2` · `col2-top` · `col3` ·
`col-rail` · `equal-pair`. They are the deck's own, so a width may be changed there without
asking anyone.

The same geometry has been contributed upstream as `@slideglance/layouts` (`packages/layouts` in
the slideglance checkout): `xml/primitives.xml` holds the rows with every width as a parameter,
and `xml/a4-portrait.xml` binds them to this page geometry as `sg-a4-fig-left`, `sg-a4-fig-right`,
`sg-a4-fig-pair`, `sg-a4-fig-stack`, `sg-a4-cols2`, `sg-a4-cols3` and `sg-a4-rail`. All seven
bindings were rendered from this deck against the published builder 0.4.0.

**Until that package is published, this deck uses its own templates.** When it ships, the swap is
two `<Import>` lines in `main.sgx` and a rename at the call sites; keep the two sets' geometry
identical in the meantime so the swap stays a rename.

## Before the page is done

1. `npm run render` returns `error 0 · warn 0`.
2. The PNG has been looked at - not the file count, not the clean build.
3. `sub` is one claim, the figure shows it, and the caption does not repeat it.
4. The page has one opener, two or three regions (or one table), one bar per region, an icon on
   every `section` and `h2`.
5. Content reaches the bottom of the text block (about 95% of the page height in the
   measurement); in a column layout both columns do.
6. `rhythm.py` reports 어긋남 0.
7. `layout_check` (every kind, `ink` and `package` named) reports no finding, `rules_check`
   reports 0 failed, and every check the deck declares under `checks.after` is clean.
8. The Korean audit reports zero over the deck's sources.
