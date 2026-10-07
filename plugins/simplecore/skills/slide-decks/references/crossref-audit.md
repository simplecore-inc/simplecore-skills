# Cross-reference audit

How to check every reference that sends a reader to another page of a document deck and its
companion volumes: the contents folios, the scoring lookup table, page-id citations
(「Ⅳ-1 15 외부 장치 요청 처리」), annex folios and sections (「별첨3 - 18~23」, 「별첨 1 9절」),
evidence items (「증빙 5」), frame ids (「화면 B-05」) and a summary deck's pointers into the
main volume. The machine checks run first; Jev judges only what a machine cannot, which is
whether the cited page carries what the citation promises.

## Order

1. **Machine checks, all of them**: `contents`, `chapter_pages`, `secref`, `evaluation`,
   `annexref` (or the deck's local annex check), `proof`, `fignum`, `reqid`. A deck that does
   not declare `evaluation` has an unchecked lookup table: transcribe the tender's scoring table
   into a Markdown file and declare `evaluation.scoring` and `evaluation.lookup`.
2. **Range ends and counts by machine**: a range (「별첨3 - 12~18」) is checked by its two ends
   against the annex's own index, never page by page through Jev. Two ranges sharing an end page
   are correct when that page carries the end of one item and the start of the next; read the
   annex index before reporting an overlap.
3. **Requirement-id rows by machine**: for every table row whose first cell is a requirement id
   and which cites a page, the cited page (or range) must carry the id in its head or body.
   This found the one wrong row the semantic pass had only flagged as uncertain.
4. **Jev for meaning**, in two stages (below).
5. **Read every remaining item yourself**, and sample the confident matches.

## Jev, stage 1: does the cited page carry it

One choice question per (citation, cited page) pair, asked in two phrasings, labels
`match` / `partial` / `mismatch`. State: the citing unit, the reference, and the cited page's
printed text with its title.

- **The citing unit is the table row or the sentence, never a character window.** A window of
  ±110 characters around a citation inside a table pulled in the neighbouring row; 122 pairs came
  back `mismatch` in both phrasings. Re-asked with the whole row (header included) or the
  sentence, 2 did.
- **Do not expand a range into one pair per page.** 「Ⅳ-1 02~22」 asked page by page reads as 21
  partial answers; a range is a machine check (step 2), or one question with every page title in
  the range.
- Keep a pair as confirmed only when both phrasings say `match` at 0.7 or more.

## Jev, stage 2: choose among candidates

Every pair stage 1 did not confirm is asked again as a choice among candidate pages: the cited
page, the two pages either side in reading order, and the pages whose running head carries a
requirement id the citing unit names. Each candidate's full text goes in the state, the labels
are the page ids with their titles, and `none` stays a label. Two phrasings again.

- **Leave the citing page out of the candidates.** With it in, Jev picked the page the citation
  stands on for 9 of 54 items.
- **Put the figure's text in the state.** A page whose claim lives in its figure (a staffing
  band 「한시 증원 5~12개월」 drawn in a schedule chart) reads as not carrying it when only the
  body text is given.
- Answers that agree on the cited page confirm it; answers that agree on another page are a
  candidate fix; split or `none` answers go to a person. The person reads the cited page and its
  figure before changing anything.

## The deck reader is the evidence

Every pass above reads the pages through `bidkit.deckread`. When a search in the deck tool finds
a string the reader's page text does not contain, the reader is wrong, not the deck: a kit
component that prints its own argument arrives as a leaf `use` node carrying `text` or `runs`,
and those were once dropped (headings, prose paragraphs, notes, stat lines). Compare one page's
reader text against the tool's own search before trusting an absence.

## Numbers from the run that set this procedure

One proposal deck with annexes and its summary deck: 580 pairs in the first pass (character
windows, ranges expanded) and 297 in the second (rows and sentences, ranges by machine).
Stage 1 on 297 pairs: 594 questions, 0 errors, 37 s, $0.033; 228 confirmed. Stage 2 on 119:
238 questions, 18 s, $0.050; 65 confirmed. Of the 54 read by a person, 2 were wrong citations;
the requirement-id row check found the same 1 of them directly. Confident matches sampled: 8 of 8
correct.
