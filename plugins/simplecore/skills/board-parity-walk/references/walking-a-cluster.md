# Inside one cluster

The main document is the coordinator's: which cluster is next, what the two documents
hold, when a section closes. This is the other half — what the agent holding a cluster
does with it, and it is authoritative over any brief that disagrees.

## The application is stood up, not waited for

**A walk that has to ask before every restart cannot cover a section.** On the local
machine the dev server and its API are the walk's to operate — started, restarted and
stopped as the work needs, with the commands taken from the project and the port read
from the server's own output rather than assumed. The handover file carries both the
start and the stop commands precisely so no walker works them out twice.

1. **A stale build lies.** A missing translation, a vanished column, an unstyled control
   — each is more often a failed build than a defect. When the screen disagrees with the
   source, rebuild or restart and look again *before* writing anything down.
2. **Reclaim only a port you own.** A port held by a development server from an earlier
   session of this same project is stopped and replaced. A process that cannot be
   identified as this project's development server is left alone.
3. **Leave it as you found it.** Servers this session started are stopped when the work
   no longer needs them, and a walker says in its report what it left up.
4. **A browser session is left the same way, and it is the one that gets forgotten.** A
   named session holds a full browser between commands and ends only when something
   closes it by that name — not when the command returns, and not when the walker does.
   **One session for the cluster, not one per frame**, closed on every path out including
   the failing one. **Never the driver's 「close everything」**: the daemon is shared, so
   that ends every other agent's session. Where the name is unknown, leave it and report
   that rather than reaching for the flag that clears the lot.

Remote hosts of any kind — production, staging, shared development — are outside this
entirely. There, ask.

## A frame no code reaches yet

Every frame is in one of two conditions when a walker arrives, and the walker decides
which by trying to reach it — not by asking, and not by reading the parity list, which
says what is left rather than what exists.

| Condition | What walking it means |
| --- | --- |
| **Built** — the route renders something | Compare against the frame, judge, fix what diverges. |
| **Unbuilt** — no route, or a route that renders nothing the frame describes | Build it to the frame, then compare and judge it exactly as if somebody else had. |

**A frame whose data has no server yet is still built and still judged.** Most of a board
is walked ahead of the API — that is the point of drawing it first — so "the endpoint does
not exist" cannot be a reason to leave a frame on the list. It means the frame's state has
to be reached with sample data, and reaching it that way has to be possible.

That last clause is where this quietly fails. A screen that receives its state as
properties takes sample data trivially; a screen that FETCHES its own state does not, and
every real screen fetches. So a harness that only hands fixtures to components can open
the first kind and not the second — and the walk then parks frame after frame for a reason
that looks like the server's fault and is the harness's.

The fix is to put the sample answer where the screen will look for it — in the data
layer's cache, under the key the screen asks with, before the screen renders — rather than
to pass it in. **What is replaced is the server, not the screen**: a screen that had to be
altered to be photographed is no longer the screen being judged. Write the fixture in the
shape the SERVER sends, so it flows through the real mapping on its way in; a fixture
written in the shape the component wants passes while the endpoint it stands for could
never produce it.

Building is not a different job wearing the walk's clothes. It ends in the same place — a
frame that matches the board and survives the lenses — and it is subject to every rule in
the main document. Three things change, and only three:

1. **The board is the specification, not the reference.** When something a screen needs is
   not on the frame — a field, a state, an error, a way back — that is not licence to
   invent it. Small and obvious, build it and **back-fill the frame in the same change**
   (`simplecore:wireframe-boards`). A real gap in the product's behaviour is a parked line,
   because deciding it is designing, and designing from inside a build is how a board stops
   being a contract.
2. **A cluster gets smaller.** Building a screen costs several times the context of
   comparing one, so the cluster one walker can carry to its end is smaller — often a
   single screen with all its states. The seam rule does not change.
3. **The order inside a cluster is fixed.** Build every frame of the cluster, then walk the
   whole cluster as one. Judging each screen the moment it is written means judging it with
   nothing to be consistent *with*; the cross-screen findings only appear once the cluster
   stands together.

**A section built this way is not "done pending review".** It closes on the same gates as
any other section, and a walker that built but did not judge has walked nothing.

## Commit at every point that stands on its own

**Cut a commit wherever one would make sense to a reader on its own** — a table and its ids
exist, a migration runs, one endpoint answers and has a test, a screen calls it, a frame has
been seen with your own eyes. A finished frame — built, matching the board, owing nothing
further, deleted from the list — is the tightest of these and is committed **there**, before
the next frame is started; never at the end of the cluster, never at the end of the session.
A cluster that stands its server up first reaches no frame for hours, and a walker waiting
for one keeps the letter of that rule while committing nothing — cut on the server's grain
instead.

**A red gate is not a reason to hold a commit.** A server standing without its screens has no
frontend test yet, and that is the correct state — but **the message has to say which state
it is**, or "half of it stands" is read as "it stands". The gates go green when the cluster
closes. Otherwise the message says what changed and nothing else — no self-assessment, no
note about which pass produced it, no tool signature. What happened belongs to the history;
the artefact holds only its current state.

**Only what is committed survives.** A session ends for reasons that have nothing to do with
the work — a usage limit, a dropped connection — and whatever was in the tree becomes a
half-finished tree the next person meets as the state of the project and builds on top of.
Committing as you go is also what makes the revert unit a screen rather than a cluster, and
what keeps a shared tree from handing every other agent a broken build they cannot account
for.

**Stage by path, and commit in the same call.** A commit looks at the tree rather than at
the files anybody touched, so stage the paths the brief named and nothing else, and run
**`git add <paths> && git commit` in one call, after verification rather than before** —
the index is shared, so staging early to see what you have opens a window for somebody
else's commit to carry your files under a message that says nothing about them. Never
`git add -A`, never `git add .`, and never `git commit -a`.

**When the shared thing is a file rather than a directory, stage a blob instead.** Two
agents both adding a line to one manifest, barrel or catalogue cannot be separated by path
— `git add <that file>` takes their line too, and the moves that look obvious (wait for
them, ask them to commit first, commit both lines) each cost somebody their work or their
authorship. Build the content you want, put *that* in the index, and leave the working tree
alone:

```bash
git show HEAD:<file> > <scratch>/base        # the committed version, without their line
#  … apply only your own change to <scratch>/base …
blob=$(git hash-object -w <scratch>/base)
git update-index --cacheinfo 100644,"$blob",<file>
git commit -m "…"                            # commits the index, not the tree
```

Their edit stays in the working tree, unstaged and untouched, and neither of you blocks.
Know this before the first time it is needed; at the moment it happens every other option
is already expensive.

An agent that finds foreign changes and decides to skip committing altogether has read the
situation correctly and reached the wrong answer: its work now survives only as an
uncommitted diff that the next agent, or a stray `git checkout`, can take out entirely.
Stage yours, commit yours, and say in the report what you could not attribute.

**Measuring must not use commits.** Plant the probe in the working tree, run the check,
delete the probe. Nothing needs to be committed for a rule to fire, and `reset`, `stash`
and `checkout --` have no place in a measurement at all — in a shared tree they drop
somebody else's work while every file stays on disk and every check stays green.
`harness.md` carries what each of these costs.

**The temptation is a checker that disagrees with you, not a file you want to read.** Knowing
whether a complaint is yours or was already there means running the tool over the file *without*
your edit, and `git stash` is the reflex that produces one: a single word, famously reversible,
and the work it puts at risk is somebody else's rather than yours — which is exactly why it does
not feel like the destructive move it is. **Copy the committed version out and run the checker on
the copy.** Nothing in the tree moves:

```bash
git show HEAD:<path> > <scratch>/before.<ext>
<the checker> <scratch>/before.<ext>       # was it complaining before you touched it?
```

Where the tool insists on the real path — an import beside it, a config that names it — the answer
is still not `stash`: copy your version aside, put the committed one in place, run, and copy yours
back.

## Review scaffolding is not product copy

A board id is how a reviewer names a screen. It is not something the screen says about
itself, and it must never reach the product — printed as copy it goes to a user who has no
board, and into every capture anybody keeps, where it is the one thing on the page that
means nothing to the person reading. The same applies to everything else that exists for
whoever is building: a route printed above a title, a "which frame is this" label, a
fixture name, development chrome the framework floats over the screen. Captures show the
product and only the product — a dev-tools bubble in the bottom-right corner covers exactly
where a list's last row and a screen's primary action are.

This survives review because it looks deliberate, it is useful while the screens are being
built, and nobody deletes it because nobody is sure it was not meant to be there. Sweep for
it by defect type the moment one instance appears — on a board-first project, if one screen
carries its frame id, they all do.

## The log line

One file per walker under the config's `logDir`, named for the cluster, one line appended
as each step ends — never in a batch afterwards, which answers "where is the walk now" too
late to be an answer.

```text
<HH:MM> <frame id> <STATE> <what, in one clause>
14:22   B-04       FIXED   title showed the record id; now the person's name
```

`STATE` is a step (`START` · `BUILT` · `JUDGED` · `SHOT`) or a verdict (`MATCH` · `FIXED` ·
`PARKED` · `BLOCKED` · `DONE`), so the file can be grepped for what still needs a human
without being read. Nothing else goes in a log line — no reasoning, no page text, no image
paths.

**One line per step, not per frame.** A frame is half an hour of work, so a line at the end
of one is a heartbeat every thirty minutes, which from outside is indistinguishable from an
agent that has stalled or died. When a step takes markedly longer than its neighbours, say
so on the line; nobody is timing the walk from outside, so a step that quietly costs twenty
times what it should will go on costing it.

## Do not translate this vocabulary

**Walk. Stand. Feed. Live. Dry out. Owe.** Every load-bearing word in this skill is a figure
of speech, vivid in English and dead in a literal translation. That matters more here than
in most skills, because a walk produces prose continuously — a handover file, a parity list,
per-frame logs, commit messages — so one bad rendering of "walk" propagates
through hundreds of lines before anybody says it out loud.

**In a project that does not write in English, choose the natural term for what the word
*means*, not for what it says.** "Walk a frame" means to take one screen through to done; in
Korean that is 처리하다, never 걷다. A screen does not 서다 because English screens "stand";
it 있다 or 그려진다. A step does not 먹이다 a frame; it supplies its data.

**Fix it in the project's terminology, not sentence by sentence** — a glossary with a machine
check catches the next document at write time instead of after somebody winces at it. Two
things to watch when writing those rules: **aim at the metaphor, not the word**, since the
ordinary verb is innocent and only the pairing is wrong, and **record the exceptions you
deliberately allow** next to the rule, or the next person removes the rule instead of the
exception.
