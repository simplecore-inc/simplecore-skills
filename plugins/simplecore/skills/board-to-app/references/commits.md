# What the history carries - the trailers, and whether the build may commit

Read this before the first commit of a session, and before writing a trailer that runs long.

## The dependency tree the history leaves behind

Every commit carries the chapter it belongs to, and every cross-chapter change carries
the chapters it reaches. That is enough to read the build afterwards as a tree: chapter
by chapter in order, with an edge wherever one chapter changed another's ground.

```
Chapter: W15
Touches: W11 W12
```

Two lines in the commit trailer, and the tree is recoverable with `git log`. Without
them it is not recoverable at all - a diff shows which files changed, never which
chapter's contract moved.

## The trailer block is the message's last paragraph

**A wrapped trailer line costs the chapter, not only the line it is on.** git reads a trailer block only where it is the message's last paragraph and consists entirely of trailers and lines indented under one, so **one line wrapped at column 0 makes git discard the whole block** - `Chapter:` included. `git log --format='%(trailers:key=Chapter)'` then comes back empty for a commit whose `Chapter:` line any person can read, which is the single thing the trailer exists to provide. `trailerGate` takes its answer from `%(trailers)` for that reason rather than matching `^Chapter:` itself; a line-by-line reader is green over exactly the commit whose trailer answers nobody. Two commits in one repository sat that way with every gate green, and two more had a blank line between `Chapter:` and `Touches:` - which puts `Chapter:` in a paragraph of its own, above the block, so the history kept the edges and lost the node. **Where a line genuinely has to wrap, indent what it wrapped onto**: git folds an indented continuation back onto its trailer and the block parses.

## Whether the build may commit at all is the project's answer, given once

Everything above assumes commits happen while the build runs - the trailers are read off them,
`trailerGate` fails a commit that carries none, and `importsTravelWithTheirCommit` reads what one
carried. **None of that reaches a build that stops to ask for permission at every close**, and
whether it may commit is genuinely not this skill's to decide: it is a standing decision about how
the repository is worked, and it differs per project and per user.

So it is settled once and the build never raises it again:

| `commitPolicy` | The build |
| --- | --- |
| `commit` | commits as the work lands, without asking. Pushing still waits for the user |
| `commitAndPush` | commits as the work lands and pushes, without asking |
| `ask` | stops before each commit and asks. Safe, and it costs the build its ability to run unattended: a chapter cannot close without somebody present, and the two gates that read commits see nothing until they land |

**A repository whose own rules already answer this has answered it**, and the key does not override
them - it is for the repository that says nothing, and for a project that would rather have the
answer in one machine-readable place than in a paragraph somebody has to find. **With neither, the
build asks**, because a skill installed in somebody else's repository must not take a standing
permission nobody granted.

**The policy settles permission and nothing else.** What a commit message says beyond the two
trailers - the subject convention, whose name is on it, what must not appear in it - is the
repository's own rule and is read there, not guessed from here.

**A commit that belongs to no chapter says `Chapter: setup`.** Wiring the project up is real work
and it is not a chapter - the config, the state ledger, the chapter set, the generator, this
arrangement itself - so there has to be a word for it, and the gate takes any non-empty one. That
is why the word is fixed here: a project left to invent its own invents a different one, and then
telling a chapter's commits from the setup's is a different `git log` incantation in every
repository, which is the single thing the trailer exists to prevent.
