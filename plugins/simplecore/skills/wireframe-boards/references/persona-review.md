# Persona review

A board that passes the self-check is *correct*; it is not yet *usable*. The
self-check verifies the artifact — labels present, folds drawn, pairs matched,
nothing overflowing. The persona review asks a different question, once per
flow: **could this person finish their job here?** The defects it catches are
the ones no checklist reaches — a state with no way out, a term the reader does
not know, a field only an insider could fill, a screen that answers a question
nobody asked. Catching them on a board costs a frame; catching them in code
costs a rebuild.

## Offer it — do not run it silently, and do not skip it

**After authoring a new board, adding frames, or changing a screen's structure,
states, flow, or fixed wording, ask the user whether to run a persona review
before calling the work done.** Name the personas you would play, in one line
each, and let the user cut the list, add to it, or name a real reviewer instead —
they know who actually uses the thing. *Why ask rather than assume:* the review
rewrites frames, and the board is a contract; and the persona list is the one
part of this the user knows better than you do.

Skip the ask only for a change that touches no screen — a typo in a note, a TOC
entry, a build tweak.

## The standing three, plus whoever else the board has

| Persona | Asks | Counts as a defect |
| --- | --- | --- |
| **UI/UX reviewer** | Does the eye land where the task starts? Is the same thing in the same place on every frame that shows it? Is every state drawn, and does each have an exit? | Hierarchy that buries the primary action; two frames solving the same problem differently; a state with no way forward or back; a screen carrying more than its job needs |
| **The operator** — the person whose work these screens carry (a desk agent, an administrator, an approver) | Can I finish the transaction here without asking anyone? Is the value I decide on actually on screen? Do I repeat this fifty times a day? | A decision the screen does not give them the data for; a lookup they must leave the screen to do; a repeated task that costs an extra step every time; a field they cannot know the value of |
| **The end user** — the person the service is for | Do I understand these words? Do I know what happens next? Is something here that should never be shown to me? | Internal vocabulary, codes, or identifiers on a subject-facing screen; an action whose consequence is unstated; an error with no way out; a step that asks for something the user does not have |

The board names the rest. A flow with an approver, a first-time visitor, a kiosk
walk-up, a screen-reader user, or a reviewer working on a phone gets that persona
too — derive them from the flow sections, the way `AUTH:` notes already name who
may enter a screen.

## Delegate it — one agent per persona, in parallel

A persona review reads every frame of every flow, several times over. On a board of
any size that is the single most context-expensive thing this skill does, and it is
also the most parallel: each persona is independent, none of them edits the board,
and their findings are compared afterwards rather than during. So run them as
concurrent subagents, one per persona, and let each return findings only.

Give each agent: the persona (its question and what counts as a defect for it), the
flow sections in scope, and how to read the board — `src/manifest.mjs` then the one
screen file per frame on a built board, **never the built HTML**. Ask it back for two
things and nothing else: **which flows it walked**, then a list of `frame id · state ·
what this person could not do`.

The first is there because a flow this person could finish and a flow the agent never
reached arrive identically — as no lines. An agent that runs out of room after two flows
of four returns findings that read as complete, and the flows nobody reviewed are the
ones nothing will ever say anything about.

Two rules keep this honest:

- **No agent edits the board.** They report; the findings are folded in afterwards,
  once, by the session that owns the board. Several agents rewriting frames in
  parallel produces a board nobody authored.
- **One persona per agent.** Handing two personas to one agent is how the
  administrator's knowledge rescues the end user's screen — the exact failure the
  in-character rule below exists to prevent.

A board small enough to hold in view — a few frames, one flow — is reviewed in
place. The delegation is for the case where reading the board is itself the cost.

## How the review runs

1. **One persona, one flow, in character.** Walk a whole `<section class="flow">`
   as that person, frame by frame in step order, before switching. Do not let the
   administrator's knowledge rescue the end user's screen.
2. **Read the board, do not recall it.** Open the frames — the source screen
   files on a built board, the rendered HTML in a browser when tooling is
   available. A review from memory reviews the intent, not the board.
3. **Anchor every finding** to a frame number (`A-03`), the state it is in, and
   what the persona could not do. A finding that names no frame and no blocked
   action is an opinion — it may go to the user as a proposal, never into the
   board as a defect.
4. **Report before you edit.** Group findings by persona, then by flow; state
   what each would change. The user decides which land — some findings are
   product decisions, not board errors.

## Where a finding lands

The board is where the review lives; nothing goes into a side document that will
drift away from it.

- A missing state or unreachable exit → **a new frame**, adjacent to its base,
  with its own `.frame-label`, and a connector if it joins the flow.
- A question the review raises that the source document does not settle → an
  **`OPEN:` note** on the frame. Never an invented answer.
- Wording the persona misread → the **fixed wording in the frame**, since
  structural text is real text.
- An intent-level judgment ("this screen must answer 'am I done' in 3s") → a
  **`.sticky`**, sparingly.
- A finding that belongs to the spec, not the screens → report it and stop.
  Changing the board to paper over a spec gap hides the gap.

## Out of scope for this review

The `.readme` contract reserves color, type, spacing, components, and motion to
the design system, and the persona review honors the same line — a UI/UX persona
critiquing palette or corner radius is reviewing the wrong artifact. Judge
structure, content, states, flow, and wording. Everything else waits for the
design.
