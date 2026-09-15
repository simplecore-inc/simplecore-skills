# Transcribing a tender into Markdown

A proposal answers the tender in the panel's own words, so the copy of the tender the
authors work from has to be the tender's words. A transcription is a quotation of a whole
document: it changes the container and nothing else.

**The whole file is a quotation.** Nothing in it is the transcriber's sentence - no
summary, no gloss, no note on what a clause means, no judgement of what the tender asks
for. Where something has to be said about the transcription itself, it goes in the file's
head block, marked as the transcriber's, and never into the body.

## Reproduce, never rewrite

Every sentence, number, identifier, bullet marker, table cell, annex name and form name is
reproduced character for character.

- **Do not correct the tender's own spelling, spacing or inconsistency.** A tender that
  writes `어플리케이션` and `아키텍쳐`, or that calls one thing `데이터 이행` in the
  requirement table and `데이터 이관` in the scope section, is transcribed with both. The
  inconsistency is a fact the proposal has to answer, and a corrected transcription hides
  it.
- **Do not reorder, merge or split the tender's own items.** The order of the clauses is
  the order the panel reads.
- **Do not translate, expand or contract an abbreviation**, and do not gloss a term on
  first use. That discipline belongs to the proposal, not to the copy of the tender.
- **Carry the bullet markers as issued** - `□` · `○` · `❍` · `-` · `※` · `·` · `▪` ·
  circled numbers - as literal characters in the Markdown, because the tender's outline
  levels are what the requirement numbering hangs on. Where a level is expressed as a
  Markdown list, the marker still stays in the text.
- **Where the extraction is unreadable, say so in that place** rather than guessing the
  wording: mark it and name the page, so a person can open the source.

## The tender's outline decides the files

One file per top-level part of the tender, named by that part's own title. A part whose
requirements run long splits by the tender's own requirement categories, never by length
or by the transcriber's sense of a topic. The file order follows the tender's order, and
a numeric prefix keeps it.

Each file opens with a head block naming the source document, the pages it covers and the
part of the tender it holds. That block is the only place the transcriber writes.

## Identifiers and detail numbers are carried as issued

- The requirement's own id (`SFR-001`) and its name, character for character.
- The numbering inside a requirement's detail - the tender's `1.` · `○` · `-` levels -
  so a proposal page can cite a detail item and a reader can find it.
- Annex, form and table numbers in the tender's own naming, with its own distinctions
  intact where it keeps several families apart.

**A separate requirement index carries every requirement id, its name, its category and
its detail item numbers, and nothing else.** It is the checklist the proposal is traced
against, so it holds no prose: one row per requirement, and a count per category that can
be compared with the tender's own totals table.

## Nothing inside a requirement is dropped

A requirement's detail is the scored content. Conditions, exceptions, counts, dates,
system names, screen names, field lists, approval steps and the cases marked undecided are
all transcribed. A clause that looks like boilerplate is transcribed too.

**Compare the counts against the tender before calling the transcription done**: the
number of requirement ids per category against the tender's totals table, the number of
tables, and the number of figures.

## Figures are part of the requirement

A tender's requirement details carry reference screens, flow pictures and sample layouts,
and they often hold the field names and the buttons the requirement is actually asking
for. Losing them loses the requirement.

- **Extract the images and keep them beside the transcription**, named so the page they
  came from is in the name.
- **Place each one where it sits in the tender's text**, with the tender's own caption
  when it has one.
- **Write a description under every figure that carries content** - what the screen is, its
  regions, its condition fields, its buttons, its table columns and any annotation drawn on
  it. Where the image cannot be extracted at all, the description is what survives, so it is
  written from reading the image, in full, and it names what it could not resolve.
- **A description is not a second copy of the picture.** Where the image is beside the
  text, the description exists so a reader can find the figure by searching and know what
  it holds; the sample rows of a mock-up - invented names, dates and counts standing in for
  real data - are illustration, not requirement content, and are summarised rather than
  transcribed cell by cell. A number the requirement depends on is transcribed.
- A description is a description. It does not say whether the screen is good, what it
  implies, or how the proposer would build it.

## A transcription is excluded from the Korean audit

The glossary would report the tender's own spellings as errors, and correcting them would
break the transcription. Add the transcription's directory to `audit.exclude` in the
project glossary, and say in the glossary why it is excluded.

**Declare the exclusion before writing the first file.** `audit.exclude` reaches a named
file as well as a scanned one, and the write-time hook reports such a file as skipped
rather than blocking it, so the transcription is writable from the first line. Without the
declaration every write is refused on the tender's own spelling, and the only ways out are
to corrupt the transcription or to switch the check off.

**The tender's competing spellings are still registered** in the project glossary, as the
decision about what the proposal itself writes, with the tender passage each one departs
from recorded in the row. The transcription keeps both; the proposal keeps one.
