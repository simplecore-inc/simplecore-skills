# One story feeds the sample data and the captures

A board tells you what each screen holds. It does not tell you *whose* front gate
is on the list, or how many people are behind the number, or what happened before
this screen. Left to each frame, those get invented at the screen — and the
moment they are, the front gate on the list and the front gate on the detail page
quietly become different machines. Nothing fails; the two just disagree.

So one document carries the story: from an empty device to a site in operation,
as numbered steps, each step naming the frames it feeds. **Sample data is derived
from it, and captures are taken against it.**

That one document then does two jobs at once: it is the source every fixture
derives from, and it is the script the final capture run follows. Once its steps
can actually be executed it does a third — a capture taken at step four is a
capture of a system that genuinely went through steps one to three.

## Keep the story honest as the product grows

The story is not an appendix. When a frame changes what came before it — a screen
that registers people changes where the existing people came from — **fix the
earlier step there and then.** Appending only, with the earlier steps untouched,
leaves the story contradicting itself, and the contradiction is invisible until
somebody puts two screens side by side. Ask both questions per frame: which moment
does this show, and which already-written moment does this change?

**This skill ships no checker for any of it, and 「a checker could hold that」 is not one.**
Coverage — every frame the story feeds appearing in the document, every step naming frames that
exist — is a check a project can write as a gate of its own, against its own board and its own
document format; until it writes one, nothing is holding it, and a story document naming no frame
at all stands there saying nothing. Whether the steps still add up is nobody's check: that is the
agent's judgement. Both halves are marked in the skill's *Held by eyes* table, because a sentence
saying what a checker *could* do is read as one somebody already wrote — which is the third
category this skill spends a section refusing.

## A value a capture shows is produced by the path the product uses

**Typing a value into a fixture so the screen matches the board is never allowed.** Not as a
shortcut, not for one state nobody can otherwise reach, not while the real path is being built.
This is the rule the rest of this file assumes, and it is stated first because breaking it costs
more than every other mistake here combined.

**Why it is absolute.** A capture exists to show what the product does. A capture of a screen fed
hand-written values shows what somebody wrote down, arranged to look like what the board drew — and
it is indistinguishable from the real thing in every check, in the result document, and to whoever
opens it a year later. It does not merely fail to prove the product works. **It produces evidence
that the product works when nothing has been shown to**, and that evidence outlives the session
that made it.

**And every check stays green while it happens**, which is what makes this the most expensive proxy
in the set: the seed makes the numbers the board draws, and the numbers came from the same hand that
drew the board. 「the seed produces the figure the board draws」 passes while the figure describes
nothing → `../SKILL.md` § *Waste does not announce itself*.

### Where the fake is allowed to sit

**At the wire it is a test instrument. Past the decoder it is a forged reading.** That single line
decides every case, and it is the only judgment this rule needs:

| | What it is | Allowed |
| --- | --- | --- |
| a recorded or edited response from the device or service the product reads — an SNMP walk, an HTTP fixture, a message on a queue | a test double for the world | ✔ |
| a row written straight into the store, or a domain object composed and handed to the layer above the collector | a forged reading | ✖ |

**The product's own decoding, mapping, arithmetic and parsing must run.** They are usually most of
what the screen displays: a device detail page is that decoding, rendered. Bypass them and the
capture shows values nobody has shown the product could produce.

### The three ways a state is legitimately produced

Every device, record and state in a fleet is one of these, and a result document says which:

1. **A replayed capture of the real thing** — a recorded walk, a saved response, a captured payload,
   decoded by the product's own path. Deterministic, because the recording is fixed.
2. **An edited capture** — the same recording with the value that state needs changed **at the
   source**: the OID that carries the supply level, the field in the saved response. Still a test
   instrument; the product still decodes it.
3. **An action taken on collected data** — excluding a device, letting a walk time out, stopping an
   agent. The state is produced by doing the thing, never by writing the row the thing would have
   produced.

**A state that fits none of the three is reported as unproduced**, and its demand is answered by
saying so. That is a smaller loss than it sounds and an honest one: a fleet recorded as 「17 replayed,
2 edited, 1 by exclusion」 is worth more than 20 composed silently, because a reader can weigh it.

### When the real path is awkward to reach

**Make it reachable.** Move the fixtures, add a shared test module, invert the dependency that is
backwards. Report the cost if it is large — that is a real finding and somebody may decide
differently — but **do not route around it**, because routing around it produces exactly the
evidence this rule exists to prevent, and produces it silently.

**Most projects already have the path and are not using it.** The recorded responses were captured
for the collector's own tests, the replay harness exists in another module, and nobody connected
them to the screens. Look before concluding it has to be built.

## A seed that only inserts stops being true, and says nothing about it

**The seed that skips a row it already finds is the default shape, and it has one property
that undoes it: a value corrected in the source never reaches a database that already
exists.** New machines are right, working machines are wrong, and **neither says anything** —
a skipped insert leaves a row indistinguishable from a correctly planted one. The story
document, the source and the board then all state one value while the screen draws another,
and whoever reads them has no way to tell which is stale.

**So the seed converges on every start** — it reads what is stored, compares it with what it
declares, and rewrites what has drifted, naming what it rewrote in one log line. Four rules
keep that from becoming a different kind of damage:

- **Converge what the seed declares as data; never touch what the product moves.** A site's
  industry code and its headcount are the seed's; that site being *closed* and its onboarding
  being *finished* are things the product did. Converge the second kind and a persona test
  that closed a site finds it open again on the next start.
- **Look at whether it deletes a hand-fixed row before writing it.** A seed that rewrites
  everything quietly undoes repairs somebody made deliberately.
- **Passwords converge too, and only outside production.** An account created before the
  configured password changed keeps the old hash for ever, and nothing announces it. Converge
  only on the profiles where **every** account was written by the seed — elsewhere a hash that
  differs is somebody's decision, not drift. Two limits: skip accounts with no hash at all
  (writing one accepts an invitation the product was supposed to test), and converge only the
  accounts that actually sign in, because a password comparison is expensive per row.
- **Never write a clock-derived value through an insert-only path.** `now() − 41 days`
  computed because the board draws 「running 41 days」 is calculated once, on the first start,
  and is an absolute moment from then on: the screen's number drifts one day per day away from
  the board, and **reading the source shows nothing** — it says 41 and it means 41. Only the
  calendar makes it wrong. A literal date recording something that actually happened is not
  this: it means the same thing on any day. **The test is where the value came from, not what
  it looks like.**
- **A seed reads the installation's timezone, never the machine's.** "Today" taken from the
  host shifts by a day around midnight and by a year around new year, and the board's drawn
  figures are the seed's specification — so a zone the deployment did not choose moves every
  derived date off the contract. Resolve the zone from the installation's own setting, fall
  back explicitly and log the fallback, and pin fixed past dates through the same resolver so
  the start of that day is the installation's. A stack that already holds this rule for its
  application code usually does not hold it for its seeds, and that is where it is most often
  forgotten — a seed reads like setup rather than like domain logic.

### Some numbers cannot be pinned, and then the seed declares what it does pin

**A figure the product appends to cannot be held at the board's number.** Sign-in history is
the clean case: every sign-in writes a real row, that row is nobody's to delete, and the
count only grows. Three shapes come out of that, and telling them apart is the whole
difficulty.

| The product's rows are | The seed | What the board draws |
| --- | --- | --- |
| its own to remove (a session ends) | converges to the drawn number, deleting **abandoned real rows first and its own last** | the number, as a badge |
| not its to remove (an append-only log) | pins the **ratio** the screen is about and lets the total grow | the ratio; **no badge for the total** |
| not its to remove, and nothing observes the total | plants the initial rows and stops | nothing |

**The deletion order in the first row matters and is easy to get backwards.** The seed's own
rows carry the distribution the screens draw ("38 users"), so removing those first leaves the
count right and the composition wrong.

**A machine cannot tell the second shape from a defect.** A seed that pins a total and a seed
that pins a ratio are the same code — a target constant and a convergence that deletes what it
planted. What separates them is **which number the screen exists to show**, and that answer is
in the frame. All a checker can see is that a target constant exists, and from there the
correct case and the broken one look identical.

Two consequences worth stating outright, because both get argued the other way:

- **A screen showing an unpinned total disagreeing with the board is not a defect.** It is the
  declaration working. 「the tab draws 1,204 and the screen shows 3,113」 is the expected
  reading of an append-only record on a machine that has been signed into many times.
- **Evidence writes a pinned number and explains an unpinned one.** 「1,317 sign-ins in the
  last 30 days」 is stale the moment it is written; 「the ratio is fixed and the total grows
  with this machine's sign-ins」 never is.

## Record what a unit of work cost, or the number is gone

The log format and the watches the coordinator arms on it are in the main document; what
that log does not carry is the price. Duration, tokens, commits, lines, file sizes — none
of it can be reconstructed afterwards, and all of it is asked for eventually ("how long did
this take?", "was the rewrite worth it?"). Work that spans weeks and several sessions is
exactly the case where nobody remembers.

Append the cheap facts as you go, in a machine-readable file this work owns:
per unit of work, the wall-clock span and whatever the runtime can tell you about
consumption. Derive the rest from git when it is asked for, rather than
maintaining it — commits, lines changed and file counts are already recorded
there. **What git cannot recover is time and consumption**, so those are the two
worth writing down at the moment they are known.
