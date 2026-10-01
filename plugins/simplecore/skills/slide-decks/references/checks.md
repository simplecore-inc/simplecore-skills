# The checks, and what each one catches

The geometry of a page is judged by the deck tool's own checks over its live model, and a
deck carries its own checks for what the tool cannot know. A project implements those
checks in its own repository and declares them in `.claude/slide-decks.json`
([config.md](config.md)): the pre-flight group runs inside the build and stops it, the
after group runs after every render, and either group can be run on demand once the deck
is saved. A check that fails is fixed at the source, never by relaxing the check or its
baseline.

How any of this is written in the deck tool is that tool's own authoring guide (for
SlideGlance: the slideglance-pptx skill and the server's sg://guide).

## What the deck tool judges

Measured geometry comes from the deck tool's own checks and is never re-measured by a
project script. That covers:

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

## What a project check still reads

Each check is named by the property it holds. The deck kind says where it applies.

| Check | Reads | Fails when | Deck kind |
| --- | --- | --- | --- |
| tag balance | every source file | a close tag does not match its open tag; a lenient parser accepts it and re-shapes the tree silently | both |
| source rules | every source file | an em dash sits in a display-face slot whose face has no glyph for it, space-between distribution is set between content-sized siblings, a style class is put on an inline format tag, a numeric newline entity is written | both |
| type floor in the sources | styles, templates, chapters and build code | any font size under the deck's floor outside the code-label styles: the absolute floor on a document deck, the declared body size on a projected one, with code labels held to their own floor (`type` in the config) | both |
| equal row height | the built deck | framed boxes standing side by side have different heights | both |
| renderer version | the preview renderer's own version report | the renderer is older than the deck declares, or cannot be run. It goes first in the after group and in front of the render itself | both |
| catalogue | the deck's template files | a live definition carries no note, two of them claim the same purpose, or a note names a neighbour the deck does not have. The index itself is the deck tool's; what stays here is the failing, since the tool warns where a deck wants a build to stop | both |
| list rows | chapter files | a list row stands outside the deck's prose-list container (a run dropped into a section's slot takes that section's gap, so the same list stands at 2px on one page and 13px on the next); a typed 「•」 stands where the deck's bullet is a drawn shape; an index is written as a key-row label, which spends a 92px column on one glyph; **a chapter file draws its own stack**, which is a component nobody named holding a gap the styles cannot reach. The cover, the contents and the annex frames are compositions and are named as exempt | both |
| label column | chapter files | a caveat or note row stands in one slot beside a key row: its 62px mark column starts the value 30px left of the key-row values above it, so the list reads ragged and no page-by-page look reports it. The aligned twins belong there, and an aligned twin with no key-row sibling is the reverse mismatch. A fix mode rewrites the template names | slides |
| page shape | chapter files and the catalogue | a body page's body is prose and bullets with no figure, table, card, row or band; a page's list rows outrun its shapes (12 rows and fewer than one shape per six); a 「list」 has one row. A simulate mode reads every list run, takes the region heading's own word for the shape where it says one, names what the form asks for otherwise, and picks under the rhythm rules; read it before rewriting a page | both |
| rhythm | chapter files | no placement three pages running: a placement stands three pages in a row, two vertical figures stand on the same side, two consecutive pages share placement and most-used component. It also prints the per-part component census | document |
| figure numbering | chapters and manuscript | a deck figure number the manuscript does not carry, a repeat, an out-of-order run, a reference to a figure that does not exist, and **a figure drawn and never placed**: already paid for and the cheapest thing there is to fill a short page with, so it goes on the page of the section the manuscript draws it in. Where a section genuinely has no room for it, the finding is retired in the baseline with the measurement that says so | document |
| manuscript parity | chapters and manuscript | a sentence on the page is not in the manuscript; a coverage mode lists manuscript not yet placed | document |
| page grade | chapter files, the rendered previews and the writing checks | **the whole condition of a body page in one place**: its composition (a page that is only a table and a figure, only lists, no shape at all), its fill measured per column against the gutter found in the ink, its list rows against its shapes, and the writing and placement checks it folds in. It keeps no record of what has been worked on, so a page that passes cannot re-enter the queue and a page that regresses does; a queue mode prints what is left, and a judgement is retired into the grade baseline, where it fails until a reason is written beside it. **A page whose every reason is a recorded judgement is finished work and does not colour the exit code**: counting one as a failure puts the check's own goal out of reach, and 「run until the grader exits 0」 then never arrives | document |
| mark echo | chapter files | a mark, label or head repeats what its own sentence opens with: 「출입」 in front of 「출입은 …」, and 「코드 검토자」 in front of 「코드 검토자는 …」. **The mark is read against as many of the sentence's words as the mark itself has**: a rule that looked only at the first word let every multi-word mark through, and the page reads the name twice either way. A one-syllable mark counts too (「큐」 in front of 「큐에 …」 is the same defect), and only a one-character mark that is not Hangul (a number or a letter standing for a row) is skipped | both |
| sentence stop | chapter files | a sentence does not close with 「.」, or a name takes one, judged on the ending after a trailing parenthetical is stripped; a fix mode writes the missing stops | both |
| dangling predicate | chapter files | a card row, accent line or cell ends on 「~하고」 · 「~하며」: a predicate handed to a clause that never comes | both |
| lookup pages | the lookup-table (조견표) pages and the deck's import order | a lookup-table page number no longer matches where the page sits; a write mode recomputes | document |
| section carry | chapters and manuscript | a manuscript section a page declares is not carried: the share of that section's prose (its tables and headings left to manuscript parity) that reaches the pages declaring it falls under a floor below which 「condensed」 stops describing it. **No page-level check reaches this**, because the page it leaves behind is full, shaped and passing: one deck declared 「Ⅰ-1 일반현황 - 개요」 on its opening page and typeset none of that section's 17 sentences. A section carried at 0 % is a promise the deck made and nobody kept | document |
| fine type | the built deck | a text box printed in the deck's muted grey (its fine print) takes more than two lines. The floor exists for the line that closes a region (a source, a legend, the condition the claim above it holds under), and the type-floor check guards only the floor itself, so nothing watches what is written at it. A page that has more to say than it has room for puts the rest there: three sentences of its own argument, 8pt grey at the bottom of a 329px column, five lines of fine print. Every other check stays quiet: it does not overflow its box, it fills the page, it is the manuscript's own wording. Measured on the rendered box, because the same string is two lines at the full measure and five in a column. **Size alone says nothing where a deck sets its body at the floor**; the grey is what marks an aside. Two shapes wear that grey and are not asides, so both are excluded: a card's value row, which has a bold label plate immediately to its left and a border holding the two together, and a divider's lede, which is a named part of the divider's composition | document |
| generated sources | every source file whose opening comment names a generator | a generated chapter file or manuscript no longer matches the state recorded after the last regeneration (somebody edited it by hand, or ran the generator and did not record it), and the reverse, a generator changed and never run. A hand edit to a generated file is the quietest loss in the deck: the page renders, every check passes, and the next regeneration deletes the work without a word. It records both sides rather than running the generators, because a check that writes files is not a check; the state is recorded right after a regeneration. Outputs the render rewrites every time are not tracked, and neither is a file whose generated part is one section of a hand-written whole | document |
| manuscript repeats | the manuscript's own prose | the same explanation is written twice in two sections, matched by word overlap rather than string equality because the second copy is almost never the same string. The deck-repeat checks below stop the *deck* repeating itself and cannot see this: both pages are faithful to their own manuscript file. It is where a page count comes down from: condensing a second copy shortens the manuscript and the pages carrying it at once, the only cut that loses neither an answer nor a figure. It prints the pairs worst-first and the character volume per pair of sections | document |
| manuscript order | the deck's import order and every page's declared manuscript section | a body page's declared manuscript section comes before the section on the page in front of it. The manuscript's own order (its part directories, its chapter directories, its numbered page-files) is the deck's reading order, and a section that needed a page of its own gets one in its own chapter file at its own place in that order. The defect appears when the page is appended to a chapter file already open instead; the page reads fine on its own, so nothing else sees it until figure numbering reports the chapter's figures coming out `1 4 2 3` and the repair looks like a renumbering job. It is not: move the page. Annex pages are not read; an annex is ordered by its own letters | document |
| deck repeats: caption echo · twice · same fact · figure text | chapters (and figures) | a caption repeats the page's claim, a sentence is printed twice, the same fact is stated twice, a figure redraws the words beside it. **The twice check compares sentences and pages, not blocks and files**: the same claim standing alone in a card on one page and buried in a paragraph on another is two different blocks, and a chapter file holding several pages hid every repeat inside itself; three pages of one file carried four sentences word for word while every check passed | document |
| reference pages | a slide deck's chapters and the referenced document deck | a running-head page reference no longer matches the document's import order; a write mode recomputes | slides |
| plan coverage | a slide deck's chapters and its plan | an evaluation item or requirement id the plan does not know; it reports how much of each list the deck covers, and a completeness mode fails while any is missing. An id printed anywhere on a slide counts, not only the head's requirement list, because that is what the panel reads | slides |
| figure verify | the figure directory | board width, type ladder, arrowheads, section numbers, lint, layout width, line overlap, text contrast, height review | both |
| Korean audit | the paths in `korean.audit` | glossary and rule violations in the deck's Korean sources | both |
| sequence census | a slide deck's chapters | more than one sequence container stands on a slide (the same one twice or two different ones, because two sequences read as two slides printed on top of each other); a sequence shape stands on two consecutive slides or on more than the declared share of the body slides; a closing row stands on more than its declared share. It also prints the per-template census of the deck | slides |
| verdict | a slide deck's chapters and templates | a judgement-carrying shape's block slot holds a word that is not a block word, or its pass slot holds a word that is not a pass word (`checks.verdict`); either judgement hex appears in a chapter file or in a template that is not one of the declared carriers | slides |
| density | a slide deck's chapters | a slide is over the project's character or shape ceiling (`checks.density`); full is met with spacing, not with more shapes | slides |
| fill | the preview images | a body page's ink stops short of the text block's foot. **It cannot see the other end**: an over-full page reads as 100 %, the same as one that ends on the last pixel, so the deck tool's own overflow check is the only test for a page that grew past its block | both |
| figure snapshot | a slide deck's chapters, its figure snapshot and the document deck's figures | a snapshot figure the document has redrawn, a figure a chapter places that the snapshot does not hold, a snapshot figure no chapter places (`figures.upstream`); an update mode takes the new versions, which is a layout change | slides |
| column fill | a slide deck's chapters and preview images | a column layout's columns end at different heights: the page-level fill number is met by whichever column runs longest, so a column that stops half way hides behind its neighbour (`checks.colfill`). **A slide with no column layout at all is measured as one column across the text block**: one deck's worst hole was a Gantt that ended at 45 % of the page and printed the rest empty, and no column rule reached it because it had no columns | slides |
| capture floor | a slide deck's chapters and its screen captures | a screen capture is placed below the type floor. The type-floor check reads only the strings the deck writes and a figure is exempt by rule, so a capture is measured by nothing: six went out at placement scales of 0.26~0.45 with their text between 2.7 and 5.6pt while the pointing order beside them named words the panel could not see. It measures each capture's own line height from horizontal contrast (an ink threshold finds one run the height of a dark interface), multiplies by the placement scale, and holds it to the floor the deck already accepts for a figure's smallest label. A capture that fails is **cropped to the region the pointing order names**, never shrunk further. **A project may set this aside**: when the team reads a capture as evidence that a screen exists rather than as something the room reads, it leaves the check out of its after group and says so in the deck's instructions | slides |
| Korean audit, wired into the build | the paths in `korean.audit` | the same violations, but on every render rather than when somebody remembers; see below | both |
| absolute paths | every source reference in the deck (image sources, background paths, links, imports) | a path begins at `/` or at a drive letter. It runs in pre-flight, before anything is compiled, because the defect it catches is invisible afterwards: the deck builds and renders on the machine whose home directory is in the path, and nowhere else | both |

A document deck's manuscript checks are written against that manuscript's conventions and
stay with the project, like every other check.

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
bug the other fixed; and where the deck tool already measures it, nothing else does.

**A declaration copied between decks names neighbours the other deck does not
have.** The second deck's set is a clone with its own layout names, so a
neighbour named in the first deck's template notes points at nothing in the second;
sixteen of one deck's declarations did on the first run. Read the names a note cites
against the deck's own definitions and fail on a dangling one. It is the cheapest of the
checks and it fires the moment a set is copied rather than written.

**An index kept beside the templates ends up shorter than the templates.** The
one a deck writes by hand starts complete and stops being complete on the next
component; what it names is what gets used, so the shapes outside it fall out of
the vocabulary while every page still passes its own review. Generate it from a
declaration each template carries, fail the build on a template that has none,
and render a contact sheet. The last part matters most, because a name is not
something anybody chooses a shape from.

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

**A check that reads the rendered images needs a full render.** Column fill and the
fill measurement read the previews, and a partial render leaves the pages it did not
draw exactly as they were, so running them after rendering one page reads one fresh
page and 296 stale ones and reports nothing. Render the pages while editing,
render everything before the checks.

**The Korean audit belongs in the build, not in a habit.** It is the one check a
person has to remember to run, so it is the one that goes stale: a deck reported a
clean audit, took an edit afterwards that collided with the glossary, and carried the
error through a whole review round. The build runs the audit over the paths in
`korean.audit` before compiling and fails on an error, reading the list from the
declaration so the build and the manual command cannot disagree. The declared paths carry
globs, and a build that spawns the audit without a shell expands them itself rather than
handing the audit a literal `*`.

A post-layout diagnostic (an overflow past the parent, a horizontal text overflow) may
carry no source line, so the build prints its node path and measured context (box width,
natural width, font size): the path names the template nesting and the font size names
the style that overflowed, which is usually enough to find the string.

## A baseline entry carries the reason, not just the finding

A baseline retires a finding, and a finding retired on the strength of having
been seen is the one thing a baseline must never do: it turns the check into a
record of what somebody once looked at. Every baseline is
`{finding: reason}`, an entry with an empty reason still fails, and retiring a finding
writes the entry blank so the reason has to be typed before the check goes
quiet. Where a baseline predates the rule, its existing entries stay retired and only
a new or changed one demands a reason; a flag day that fails forty entries at
once teaches nobody anything.

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
you what you hoped rather than what happened.

**A template's declaration is the comment above it, so inserting a template between a
comment and its template reassigns it.** Adding two variants immediately before the
component they vary took the component's own annotation block with them, and the component
was left undeclared. The catalogue check is what caught it, which is the argument for
having one: the shape of this mistake is invisible in a diff that looks like a pure
addition.

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

1. **Pre-flight**, inside the build: the source checks (tag balance, source rules, type
   floor in the sources, absolute paths), the Korean audit, and on a slide deck the
   reference pages, plan coverage and figure snapshot. A failure stops the build.
2. **The render**, all pages. Error 0 and warning 0 is the bar.
3. **The deck tool's own checks** with every kind named, ink and package included, and the
   deck's declared rules.
4. **The after group**: renderer version first, then equal row height and every other
   declared check; on a slide deck the sequence census, density, verdict and column fill.
5. **Figure verify**, over the figure directory.

The checks read the files on disk, so a deck held open in an editor is saved before they
run, or it is checked as it was.

**A check run by hand names a directory, never a deck file**, where the project guards its
deck sources against writes from the shell: a script handed a deck file may write it, so
such a guard refuses the line whatever the script does. Hand the Korean audit the chapter
directory, not the files inside it, and give a probe its deck through an environment
variable.

**Measure the fill rather than eyeballing it.** For each preview, find the lowest row that
carries ink (a pixel darker than the paper), excluding the folio band at the foot, and
report it as a share of the page height. A column layout has to be measured per column:
the lowest ink on the page belongs to whichever column runs longest, so a tall figure in
one column reports the page as full while the other stops halfway. Read those pages'
columns separately. Covers, dividers, contents pages and a closing slide are exempt;
their whitespace is the composition.
