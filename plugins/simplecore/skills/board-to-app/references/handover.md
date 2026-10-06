# Parked decisions and the handover file

A chapter build (`simplecore:board-to-app`) and a board-parity walk (`simplecore:board-parity-walk`)
both follow this file. A chapter build parks into the file `openItemsFile` names, under
`openItemsHeading`, or into the state ledger where no such file is declared; a walk parks into the
section `parkedSection` names in its parity list. Both keep their facts in the file `handoverFile`
names. Where the two arrangements differ, the paragraph names the one it holds for.

Read it before parking anything, before honouring a parked line, before writing to the handover
file, and before splitting one.

## Parking is a last resort, and most things do not qualify

**The default is to decide.** An open question is answered by designing the answer -
**architecture first, then consistency with what the product already does, then
stability, then performance** - and the decision is applied to the code and the board
in the same change. Those four are an order, not a list: a fast screen built on the
wrong shape is a rewrite, and a screen that disagrees with its neighbours is a defect
no benchmark can see. A build whose open items keep growing, or a walk whose parked
section does, is not being careful; it is deferring the design work, and every deferred
decision makes the next chapter or frame harder because it rests on nothing.

**These are never reasons to park:**

| "I can't decide this because…" | What to do instead |
| --- | --- |
| it would add screens or states | Add them. Draw the frames, then build them. Scope is not a reason to leave a product incoherent. |
| it is complex to implement | Complexity is the work. Design it properly and build it. |
| there are two reasonable options | Pick the one more consistent with the rest of the product, and say why. Two reasonable options is a decision, not a blocker. |
| the requirement is not written down | Derive it from the design documents and the personas the board names. Write down what you derived. |
| an external system's behaviour is unknown | Design so the answer does not matter - declare the capability, handle both, reject explicitly what is unsupported. A product that changes shape when a vendor's answer arrives was not designed. |

That last row is the one that hides. An unknown about somebody else's API is almost never
a reason to stop drawing a screen; parking it freezes a whole chapter or section behind a
fact nobody is chasing.

**These genuinely qualify**, and they share a property - no amount of design makes the
answer derivable:

- **A decision that changes what the product is or does.** In a chapter build, somebody
  owns it and it is not the build. In a walk, a behaviour the board does not draw and the
  spec does not settle is somebody's to decide, and that somebody is not the walk:
  deciding it from inside a cluster is designing, and designing from inside a walk is how a
  board stops being a contract. A small, obvious gap is not this - build it and back-fill
  the frame (`simplecore:board-parity-walk`'s `references/walking-a-cluster.md`).
- **A commercial or legal value nobody can derive** - a price, a contractual term, a
  retention period a regulator sets. Where `factSources` names a tool that can settle
  it, that is not parking, it is a lookup. Design everything around it so the value is
  the only thing missing.
- **A blocker in the world.** An environment that cannot reach a service, hardware
  nobody has yet. Build and judge everything that does not depend on it, and park only
  the part that does.

Even then, park the narrowest thing. "The whole chapter is blocked" is almost always
"one decision inside it is blocked, and nobody separated it from the rest".

When something does qualify: **do not stop, and do not guess.** Add one line to the
open items, or the walk's parked section, and move to the next screen - which frame ·
what the choice or blocker is · which side looks stale. A line missing the third part
sends the next session back to re-derive it, which is the cost parking exists to avoid.

**The first part is one unbroken token** - a frame id, a chapter number, whatever that project
names the subject with. It is what a reader's eye and the gate both key on, so a phrase there is
read as the second part having started before the separator arrived. A decision that hangs on a
chapter rather than on a frame is the case that tempts a phrase, and it is still one token.

```markdown
- C-07 - board draws a bulk reverse; the API reverses one record at a time.
  Board looks stale, but the operator does 40 a day. Product decision.
- D-02 - needs a role that does not exist in any environment yet. Blocked, not stale.
```

**Write the line before saying it is parked.** A decision announced in a message and
never written down is one the next session cannot find, and the coordinator is the
likeliest author of that gap: an agent reports something undecided, the reply
acknowledges it, and both sides then believe it is recorded. Nothing is. So when an
agent surfaces a parked decision, write it yourself in the same turn or tell the agent
to - then say which one happened. "Recorded" is a claim about a file, and the file is
the only place it is true.

Parked lines are read at the start of every session, which is what keeps parking from
becoming forgetting.

### One kind of parked line does hold a chapter, and it is not a park at all

**In a chapter build.**

A decision deferred **because a chapter that has not been built yet would settle it** is a
dependency written in prose, and prose is read by nobody. The case is concrete: a check that
cannot be made to hold on the current volume, whose only fix destroys accounts the product cannot
yet remake, because the chapter that builds the addresses for remaking them has not run.
「we will do it after 04」 is the right decision and is also a sentence with nothing behind it.

So such a line **names the chapter it blocks, on the line itself**, and the project's own gate
refuses that chapter's close while the line stands. **The marker is opt-in**, because blocking is
the rare case: a line without one is an ordinary park, and the default holds - a chapter closes
with its parked lines still open.

> **Read it this way and it is wrong**: 「it is agreed and it is written down, so it will be
> honoured」. Written down where? The line sits in the open items, the chapter closes on its tests,
> and between the sentence and that close there is nothing that reads the two against each other -
> the only thing that would have noticed is somebody re-opening a document they had no reason to
> open.

## Two kinds of leaving-behind, and only one is shared

Sequential agents must not re-derive what the last one learned. But left to append
freely they produce a diary with several authors, and the next agent cannot tell a
confirmed fact from somebody's impression.

| | Shared - facts | Not shared - narrative |
| --- | --- | --- |
| Where | `handoverFile` - there is exactly one | one file per agent under `logDir` |
| What | how to stand the system up, known traps, accounts and data standing | what was built or walked, what diverged |
| How | present state in plain declaratives; **overwrite** when wrong | one line appended per step |
| Read by | every agent, at the start | its own agent, and whoever is watching |

**The handover file has no room for a point of view.** No "I found that", no "this
time", no "it used to be". A fact that changes is corrected in place, with no history
left behind. That is what lets any number of authors maintain it. **Do not create a
shared narrative file** - several agents stacking their stories in one place produces
exactly the confusion this split prevents.

**A trap named only in a report is one the next agent walks into.** An agent that loses an hour
to something and works it out has produced two things - the fix, and the knowledge - and the
knowledge reaches the next chapter only through the handover file, never through the
coordinator's inbox. **So the coordinator asks where it landed before that agent stands down**,
and treats 「I told you」 as unwritten. The same hour is otherwise paid twice: a sign-in endpoint
that takes HTTP Basic rather than a JSON body was reported to one coordinator and written
nowhere, and the next agent hit it identically a chapter later - then, because a wrong request
shape and a wrong password answer with the same 401 and the same sentence, concluded the seed
was broken and built a task on that.

**A log written afterwards is not a log.** Its whole value is answering "where is this
now" while the answer is still changing; written at the end it answers a question
nobody still has, and every hour before that was spent looking silent. Silence reads as
a stall, and a stall gets a running agent killed - so the cost of skipping the line is
not tidiness, it is somebody stopping work that was fine. That lands hardest on an
agent that **dispatches** sub-work rather than building or walking screens itself: its own file
stays empty because it is not the one touching screens, and it is the only file anybody
watching can read. An agent that hands out work still writes one line per step it takes -
briefed, judged, committed - under its own name.

## A handover file grows, and the answer is not another trim

**In a chapter build.** A walk's write-time check reads only the file its config names, so a
walk keeps its handover file whole.

**Every chapter has a reason to add to it and none has a reason to take anything away.** That is
what the file is for - an agent holding a chapter must not work out again what the last one worked
out - so it grows by design, and it passes the size where anybody reads it whole without anything
announcing that it did. **A fact nobody reads is worth what an absent one is worth, with the
difference that it still looks like coverage.**

**Trimming buys one round and then it grows back.** By the time the file is long, most of what is
in it is true and cited; what is left to cut is the part that was already dead, and cutting that
leaves the shape untouched. The shape is the problem: **one file read by every chapter means every
agent pays for every other chapter's facts** - a chapter's backend map is dead weight to the six
chapters that load it and never open it.

**So a handover file is allowed to be an index that routes.** `handoverFile` may name a document
holding the facts, or a **skill's `SKILL.md` whose `references/` hold them by subject** - the
index says which file answers which question and restates none of it. A project splits when the
reading, not the writing, is what costs: the test is whether an agent opening it reads past the
part it needs.

**Two things have to move with the split, or it is worse than not splitting.**

- **The index restates nothing.** A fact in both the index and a reference is the duplication this
  arrangement bans everywhere else, and the copy that drifts is indistinguishable from the one that
  did not.
- **Whatever reads the handover file has to follow the routing.** A check that reads
  `handoverFile` as one document now reads a table of contents: it goes quiet on every fact in the
  references and reports the same clean result it reported when it was reading facts. **That
  silence is the failure mode**, so a gate over the handover file reads the index *and* what it
  routes to.

**Grouping is by who asks and when, never by where the fact came from.** 「what the migration
found」 is an origin; 「how a screen reaches its address」 is a question somebody has. Origin
groupings read fine to whoever wrote them and send everybody else through three files.

### Splitting one, in order

**Group from the file's own section list, not from a template.** Read the headings and ask what
question each answers; the groups a project needs are its own, and a borrowed set of topic names
puts a section in the file whose name is closest rather than the file its reader opens.

1. **Move the prose, do not rewrite it.** Each section keeps its own words; what changes is which
   file it sits in. A split that rewrites is a split nobody can check.
2. **Count in and count out, and check it by machine.** Re-split both sides, normalise whitespace,
   and compare every section body - 「61 in, 61 out」 is only worth saying when something compared
   them. A section that quietly went nowhere leaves no mark afterwards, so the sections are
   counted in and out before the old file is deleted.
3. **The index states no fact.** It says which file answers which question, and nothing a reference
   also says.
4. **Point `handoverFile` at the index.** That one line is what makes the build use it - the
   builder is already told to read the handover file, so nothing new has to be written to route it.
5. **Repoint everything that linked into the old file**, and change the project's own document
   index and instruction file in the same commit. The old file's deletion and the new files land
   together, so anything dropped shows in the diff.
6. **Widen every check that read the handover file** - the skill's own point-of-view sweep does
   this already; a project's gates over that file are the project's to widen.
7. **Bring the new tree inside the checks that scope by path.** A locale audit, a glossary check, a
   prose linter - each reads a declared set of paths, and a tree that has just been created is in
   none of them. **The references would stand there checked by nothing**, reporting the same clean
   result as a tree that passes. Declare the new path, then plant a violation and confirm it is
   reported before removing it.

**Step 7 is the one that gets skipped**, because everything else fails loudly and this fails
silently: the split lands, every gate is green, and the checks that used to hold the file now hold
nothing.
