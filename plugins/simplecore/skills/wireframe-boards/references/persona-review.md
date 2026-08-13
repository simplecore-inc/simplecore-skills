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

## The standing four, plus whoever else the board has

| Persona | Asks | Counts as a defect |
| --- | --- | --- |
| **UI/UX reviewer** | Does the eye land where the task starts? Is the same thing in the same place on every frame that shows it? Is every state drawn, and does each have an exit? | Hierarchy that buries the primary action; two frames solving the same problem differently; a state with no way forward or back; a screen carrying more than its job needs |
| **The operator** — the person whose work these screens carry (a desk agent, an administrator, an approver) | Can I finish the transaction here without asking anyone? Is the value I decide on actually on screen? Do I repeat this fifty times a day? | A decision the screen does not give them the data for; a lookup they must leave the screen to do; a repeated task that costs an extra step every time; a field they cannot know the value of |
| **The end user** — the person the service is for | Do I understand these words? Do I know what happens next? Is something here that should never be shown to me? | Internal vocabulary, codes, or identifiers on a subject-facing screen; an action whose consequence is unstated; an error with no way out; a step that asks for something the user does not have |

| **The language reader** — a professional reader of the board's own language, who judges *only* the words | Is the same thing called by two names anywhere on this board? Is each register right — product copy speaking to a user, notes speaking about the screen? Does any sentence read as translated, mis-cased, or ambiguous in this position? | The same entity or action named two ways across frames; a register flipped (product copy written as board prose, or the reverse); a word that reads as a different thing in this context; a label a native reader would not write |

The language reader is the one persona that **takes no section**. Every other
persona walks a journey and asks whether their work completes; this one reads the
words and nothing else, so a per-section assignment would hide the defect it exists
to find — one name in section B and a different name for the same thing in section
G. Give it the whole board, or one wave at a time carrying the previous wave's
vocabulary list forward. It is worth its own agent precisely because it is cheap:
it never has to reason about a flow.

**Its mechanically-checkable findings are registered, not just fixed.** A spelling,
a banned phrasing, a term with a settled translation — those go into the project's
glossary or lint rules in the same change, then the whole board is re-swept for what
that new rule now catches. A finding fixed on one frame and left unregistered comes
back on the next frame somebody writes.

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

Give each agent: the persona (its question and what counts as a defect for it), **the
journeys to walk as ordered lists of frame ids**, and how to read the board —
`src/manifest.mjs` then the one screen file per frame on a built board, **never the built
HTML** (name the captures directory too, when one exists, so it can look rather than only
read). Ask it back for two things and nothing else: **which flows it walked**, then a list
of `frame id · state · what this person could not do`.

The first is there because a flow this person could finish and a flow the agent never
reached arrive identically — as no lines. An agent that runs out of room after two flows
of four returns findings that read as complete, and the flows nobody reviewed are the
ones nothing will ever say anything about.

Three rules keep this honest:

- **No agent edits the board.** They report; the findings are folded in afterwards,
  once, by the session that owns the board. Several agents rewriting frames in
  parallel produces a board nobody authored.
- **One persona per agent.** Handing two personas to one agent is how the
  administrator's knowledge rescues the end user's screen — the exact failure the
  in-character rule below exists to prevent.
- **Spawn them unnamed.** Where the harness turns a *named* subagent into a teammate, it
  waits for messages instead of returning a report, and its idle pings are indistinguishable
  from work in progress. A full set of named persona agents can return nothing at all while
  looking busy, and asking them again just produces more pings. **An empty review is this
  before it is a clean board** — check how the agents were spawned before believing it.

A board small enough to hold in view — a few frames, one flow — is reviewed in
place. The delegation is for the case where reading the board is itself the cost.

## How the review runs

1. **One persona, one journey, in character.** A journey is what this person does end to
   end — arrive, find the record, act on it, leave a trace — and it **crosses sections**.
   Walking a `<section class="flow">` top to bottom instead walks the manifest, which is
   an authoring order, not anybody's day, and it hides the whole class of defect that
   lives *between* frames: a summary tile counting one thing while every screen downstream
   of it counts another, one person given a different role on the frame that introduces
   them than on the frames that use them, a `back` that lands where this reader never came
   from. Each costs a line to fix on a board and none is visible to a per-section read.
   - **Write the journeys before spawning anyone**, as ordered frame-id lists
     (`<entry> → <list> → <detail> → <action> → <record>`), and hand each persona the ones
     that are its work. The coordinating session knows the board; the agent does not.
   - Do not let the administrator's knowledge rescue the end user's screen.
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
- **A finding on a frame the change never touched → report it, do not fold it in.** A
  journey crosses sections, so a review of one change always turns up defects in the
  screens around it — a dashboard that cannot open what it counts, a read-only screen with
  live destructive buttons. Fixing them silently turns a scoped change into an unreviewable
  one. Group them separately, say they are out of scope, and let the user decide whether
  they land now or become their own change.
- **A finding on a frame the change DID touch is the author's own work coming back**, and it
  is fixed in that change. The commonest shape is a `notes` line promising something the
  frame does not draw — a claim that some gap is visible here, on a frame that marks one
  case of the four it counts. Prose and drawing are written minutes apart and only somebody
  reading them against each other catches the drift, which is exactly what a persona does
  and no gate can.

## Out of scope for this review

The `.readme` contract reserves color, type, spacing, components, and motion to
the design system, and the persona review honors the same line — a UI/UX persona
critiquing palette or corner radius is reviewing the wrong artifact. Judge
structure, content, states, flow, and wording. Everything else waits for the
design.
