# Sample data for screens attached to a proposal

A wireframe, a mock-up or an entity diagram attached to a proposal is read by the panel as a
statement about whether the proposer understood the work. Its data is what carries that
statement: a screen filled with `홍길동` · `테스트1` · `AAA` says the proposer read the
requirement list and stopped there, while a screen filled with the tender's own organisation
names, equipment identifiers and totals says the proposer read the reference screens.

**Take the values from the tender.** A tender's reference screens, statistics tables and form
specimens print real values: organisation names and codes, equipment identifiers, line names,
manufacturer names, dates, document numbers, per-unit quantities and their totals. Collect them
before designing a screen, because the collection is also an inventory of what the screen has to
be able to show.

## The collection is a quotation

The values are the tender's, character for character, so the collected file lives under the
declared quotation path with the transcription and the statutes (`references/rfp-transcription.md`),
and the rules for using them live outside it and are audited. Keeping them apart is what stops a
prose paragraph from escaping the language check by sitting next to a quoted table.

Collect by kind rather than by screen, because one identifier appears on several screens and has
to be the same on all of them: organisations, equipment identifiers, master-data attributes,
example rows as the tender printed them, statistics totals, progress rates, dates and document
numbers.

## What has to be invented, and how

A screen needs more rows than the tender prints. Write down the **format** of each invented value
next to the real ones, derived from the real ones, and keep the invented values out of the range
real records occupy where that can be told.

- Reproduce the tender's own masking. Where it prints a document number as `0000-2025-3063`, the
  invented ones keep the `0000`.
- Mix invented rows with quoted rows and make sure every screen shows at least one quoted row, so
  a panel member can hold the page against the tender's reference screen.
- Never invent a number the requirement depends on. A count, a rate or a threshold comes from the
  tender or it does not appear.

## Consistency the screen will expose

A screen recomputes what the data says, so an inconsistent sample contradicts itself in front of
the panel. Check these before drawing:

1. A total row equals the sum of its detail rows, at every level of aggregation.
2. A rate equals its numerator over its denominator, rounded the way the tender rounds it.
3. A status is consistent with its history: a record carrying results has passed the approval that
   unlocks result entry.
4. Dates run in their business order across the whole chain.
5. Where the tender's own printed figures do not add up, keep them as printed and say in the
   working notes that the figure is the tender's. Never silently correct a tender's number into a
   proposal's screen.

## Blind evaluation reaches the attachments

Where the tender runs a blind technical evaluation, the attached screens and diagrams are part of
the document it applies to, and the deduction is taken from the technical score however many times
it is breached.

- Every place a person's name would appear is masked in the tender's own convention (`OOO`,
  `***`). Writers, approvers, operators and inspectors all count.
- No proposer name or logo in a header, a footer, a browser tab, a file name, a diagram caption or
  a document property. Export metadata carries the author's name by default; clear it.
- Names the **client** printed - its own organisations, its equipment manufacturers - are not the
  proposer's identity and stay as printed.
