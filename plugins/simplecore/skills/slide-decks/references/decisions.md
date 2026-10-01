# Editorial decisions: who judges first

Every judgment step of typesetting a deck has the same shape: a first pass that proposes, and a
confirmation that settles. **Where Jev is available, Jev makes the first pass and the agent
confirms. Where it is not, the agent makes both.** The questions, the candidates and the
confirmation are the same either way, so a deck typeset without Jev is held to the same standard
and the switch changes speed, not the result.

## Is Jev available

Run `zsh -c 'source ~/.zshenv; jev-decide setup'` once per session. `available.typesafe` or
`available.openrouter` true means Jev is available; call it with that provider by name. A
`decide` call that errors is reported with its message and retried after the cause is fixed. It is
never replaced silently by the agent's own judgment for the rest of the run: say which steps fell
back and why. Simulating Jev with another model is not the fallback either; the fallback is the
agent judging openly, without a probability.

## The decision steps

| Step | One question per | First pass asks | Candidates | Confirmed by |
| --- | --- | --- | --- | --- |
| Monotony | page | is the body only full-width blocks stacked vertically · does it repeat the previous page's placement and main component | yes / no each | the render, and the rhythm check where the deck declares one |
| Duplication | block beside a figure | does this block restate words the figure already draws | yes / no | reading both; cut the weaker side, never both |
| Component | manuscript block | which component typesets it | a shortlist of 5-8 from the tool's component search on the block's shape, never the whole catalogue | the pick drawn alone, then the page render and the tool's layout check |
| Fill remedy | page short of the text block | which remedy, in the order the fill rule gives | the manuscript sections the page declares, a merge with a neighbour, a split table | the fill measured again after the edit |
| Condense | page over the allocation | which block goes, keeping the figure | the page's blocks | the page count and the requirement ids still answered |

Measured things are never a decision step: fill, overflow, overlap, ink, type floor, page count
and sheet count come from the tool's checks and the deck's own checks.

## How a first pass is asked

- **A shortlist, not a catalogue.** Asked to pick from 92 components, two phrasings agreed on 4
  of 10 blocks; asked for a component family, it agreed on 17 of 20 and answered with the
  manuscript's own Markdown form (a table became `table`, bullets became `list`), which is the
  monotony the step exists to break. Narrow by shape with the tool's component search first.
- **Say that the generic shapes are the fallback.** The instruction names plain table, list and
  prose as what to pick only when no specific component fits.
- **Two phrasings per question, trust only agreement.** Where they disagree, or the top
  probability is under 0.6, the agent decides as it would without Jev and says so.
- **The evidence goes in the state**: the block text, the page's other blocks, the figure's
  labels when duplication is asked, each candidate's declared purpose and use.
- One statistics line per run: questions · answers · errors · time · cost, then flagged and
  confirmed counts.

## What the agent's confirmation is

The agent reads the first-pass answer against the render and the checks and either applies it or
overrules it with a one-line reason. A Jev answer is never applied without that read, and never
written into the deck or a document as a finding. The report names, per step, who decided:
「Jev 0.86 · 0.80, confirmed」, 「Jev split, agent chose `panel`」, or 「agent (Jev unavailable)」.
