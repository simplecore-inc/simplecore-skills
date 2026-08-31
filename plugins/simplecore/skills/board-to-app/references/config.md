<!-- Split out of SKILL.md so a session loads it only when its subject comes up. The skill's
     own section of this name is a routing stub pointing here. -->

# What the project declares — `.claude/board-to-app.json`

**This skill carries the discipline, not the contents.** Every path, command,
directory and heading it needs is a project's own choice, and the project declares
all of them in `.claude/board-to-app.json` at its root. Copy
`assets/board-to-app.json` and fill it in.

**Read that file first, on every invocation** — including a session that only means
to resume. It costs one read, and a build started on half-wiring is one nobody can
pick up later.

**Edit it as text, and never through a JSON encoder.** The file is hand-formatted per
key — some arrays on one line, some one entry per line, a `//` note above the key it
explains — and every one of those is a decision somebody made. A `load` / `dump`
round-trip overwrites all of them silently while changing no value, so a two-line
edit comes back as a two-hundred-line diff. **The damage is not the diff; it is what
the diff then hides.** Several sessions edit this file at once, and once a reformat
has tangled everybody's work into one unreadable change, the careful-looking recovery
— restore the original text, re-apply my own edits as targeted replacements — drops
whatever the other sessions had put there, leaving no mark at all. It happened here:
a session widening one key restored the file and took another session's whole key
with it, having written down neither that it existed nor that it was gone. Insert and
replace by string, and parse afterwards only to check the result is still valid JSON.

**A required key that is absent is an error the skill reports — never a path it
guesses.** Name the key, say what it names and what it buys, and offer to fill it
in; do not proceed with a substitute. A declared path that does not exist is the
same error: report the key and the path it points at, and stop. Most of the time the
user asked for screens to be built, not to configure a skill, so name what is
missing in plain terms.

**An optional key the project does not have is left out of the file**, and an empty
array declares none — the table's last column says what each absence costs, and the
build carries on knowing it. A placeholder left in the file is not an absence: it is
a path that does not exist, and it stops the build like any other.

**That cost is what `bta.mjs doctor` prints beside every key it reports as absent**,
because 「not declared」 on its own tells a reader the one thing they already knew.
The sentence lives once, in the schema, and this column carries the same string
under `bta.mjs gates` — so a cost corrected here reaches the report, which is the
only way a person meets it.

**So a cell in this column never says 「as above」, and the reason is worth more
than the rule.** A table is read top to bottom, so a row may lean on the row
before it and be perfectly clear; a per-item report prints one key at a time, in
whatever order the absences happen to fall, and the same words then land alone
under a key whose neighbour was declared. **That is a property of moving prose out
of a table and into a report, not a slip in the two cells it was found in** — the
next row added here will reach for 「as above」 for exactly the reason the last two
did, and it holds for any column this skill ever prints one item at a time.

**An optional key absent because its subject does not exist yet is a promise, not a
decision.** A project whose application has not been built has no migration directory to
name, no address that renders one frame, no generated locale. Such a key **is declared in
the chapter that creates its subject**, and that chapter does not close with the promise
unkept. Until then it is written down as owed — `deferredKeys` names the chapter and the
path whose appearance makes the key due.

**Writing it down is the whole point, because the moment it falls due announces
nothing.** An undeclared key reads identically whether the project decided against it or
is waiting for it, and the day the subject appears the cost in that key's row starts being
paid in silence: with `migrationDir` still absent, nothing in the wave says where a migration
goes or how two agents writing one avoid each other, so backends that were meant to run in
parallel run one at a time and nothing says why. A promise turns that into a fact on disk that
`bta.mjs check` reads.

Where an example path appears anywhere in this skill or its references it is written
as `<boardRoot>/manifest.mjs` — a shape, never a default. Keys the skill does not
know are ignored, so a project may keep a `"//"` note of its own in the file.

In the Required column: **●** the build cannot start without it · **○** optional, and
the last column says what its absence costs · **◐** required once another key is set ·
**◑** everything runs and no chapter can close. That fourth grade is its own because the
first three cannot express it: a project missing one of these reads a page of green while
being unable to finish anything, which is what `bta.mjs doctor` prints it apart for.

**Eight of these keys are not paths but this project's own words, and a word declared wrongly
does not fail** — `chapterLines`, `evidenceLabels`, `closedStatus`, `verdictRole`,
`deferredLine`, `placeholderLine`, `captureReasons` and `eyesPhrases`. Every check over a chapter file or a result document
compares against them, so a declaration that matches nothing leaves each of those checks
reporting the same zero as a repository with nothing wrong. **The two markup conventions are
opposite on purpose** — a `chapterLines` phrase is the line as written, markup and all, and an
`evidenceLabels` value is the word alone, because the checks write the emphasis themselves —
so the commonest way to get this wrong is to declare one of them the way the other is
declared. Two gates hold it, and they are two because the zero has two meanings:

- `declaredWordsMatchTheDocuments` (**error**) counts what each declared word matched in the
  documents that key governs and speaks when a declaration matched nothing **while something
  independent of it says the documents hold what it names** — the same declaration with its
  markdown ignored finding the line, a chapter file placing a frame, a result document written
  in bolded lead-ins. Each finding names the count and which of those established it.
- `declaredWordsHaveBeenCompared` (**warning**) speaks when there was nothing to compare against
  at all. A project that has just been wired has no chapter files and no result documents, and
  its zeros are correct — but a run that says nothing about them says only that nothing was read,
  which is indistinguishable from a run that read them and found them sound.

**Between the two, silence means compared and matched**, and that is the whole reason the second
one exists. `bta.mjs doctor` prints the census behind both, matched and unmatched alike, because
the count is what shows a comparison reached anything at all.

| Key | What the project names with it | Required | Absent means |
| --- | --- | --- | --- |
| `boardRoot` | the directory the board's frame sources live in — read the source, never the built HTML | ● | the build cannot start |
| `boardManifest` | the board's table of contents: every frame with its permanent id (`<boardRoot>/manifest.mjs`) | ● | the build cannot start |
| `boardRoles` | the role map — which persona reaches which frame | ○ | personas come from each frame's own access notes; a chapter whose personas cannot be derived that way stops and reports |
| `chapterDir` | the directory holding one file per chapter, whose file order is the build order | ● | the build cannot start |
| `chapterOverview` | the chapter table — order, what must close first, what may run alongside | ● | the build cannot start |
| `chapterGenerator` | the command that regenerates the chapter set from the board | ○ | a chapter cannot be regenerated after a board fix; report that rather than hand-editing the chapter file |
| `instructionBudget` | a ceiling in characters per instruction file, declared at what each measures the day it is declared — so nothing is red on arrival and the next append is the one that fails | ○ | nothing bounds how large the instructions grow, so they grow past what any agent can hold and every rule in them is one nobody read |
| `evidenceProvenance` | the labels a result document's provenance line carries — which build, which boot, which data | ○ | a result document says nothing about where its pictures came from, so a reading taken off a stale build, an empty fixture or one zoom level is indistinguishable from one that is right |
| `chapterHeadings` | the exact headings the chapter files use, per role (below) | ○ | a section is named by its role rather than by a heading, and an agent that cannot find one stops and reports |
| `chapterLines` | the lines a chapter writes that a check has to recognise, per role — **as written, markup and all**, with `{text}` captured and `{n}` not. A role this project writes no line for is declared `null` with the reason in `//<role>` beside it | ◑ | every check that reads a chapter's own demands matches nothing, and reports the same zero as a chapter with nothing wrong |
| `evidenceLabels` | the three labels one section of a result document carries — `did`, `demanded`, `saw` — **the word alone, with no markup**, because the checks write the emphasis themselves | ◑ | every check over a result document reads past every section, so a chapter cannot be shown to have closed on anything |
| `closedStatus` | the word the state ledger writes in a chapter's row when that chapter is closed | ◑ | nothing is closed, and every check over a closed chapter stays silent |
| `verdictRole` | the word an evidence heading uses where a persona name would stand, for a line a machine proves | ◑ | a foundation chapter's sections cannot be matched to the lines they prove |
| `deferredLine` | the line an evidence section carries when a check ran and **this installation** could not decide it — same grammar as `chapterLines`, and its `{text}` is the chapter that repays the debt | ○ | a project that has met that case writes the marker in prose instead, and the chapter it names closes with the debt outstanding and nothing reading it |
| `placeholderLine` | the line an evidence section carries **in place of a picture**, where the demand asked for one and a picture is not the witness for it — same grammar as `chapterLines`, and its `{text}` is the capture that already proves that component | ○ | a demand a picture cannot answer is met by silence, and afterwards a pane nobody opened and a pane correctly proved by the capture above it read exactly the same |
| `evidenceDir` | where a chapter's verification result is written, one document per chapter, with the captures it cites in a folder of the same name beside it → `references/evidence.md` | ◑ | screens get built and no chapter can be shown to have closed on anything — the grounds die with the session |
| `stateLedger` | the one file saying which chapter is open, in progress, awaiting its tests or closed — and which development account each persona signs in with | ● | the build cannot start |
| `handoverFile` | the facts a builder needs to start: how to stand the system up, known traps, what data is already standing. **It may be one document or an index that routes to them** → *A handover file grows, and the answer is not another trim* | ● | the build cannot start |
| `openItemsFile` | where a parked decision is written | ○ | parked lines go in the state ledger |
| `openItemsHeading` | the heading those lines live under — the heading's **text only**, with no `#` markers on it | ◐ with `openItemsFile` | the config is incomplete — report it rather than choosing a heading |
| `gates` | the commands a chapter must pass before it closes, each read by its exit status — `bta.mjs check` among them | ◑ | nothing mechanical holds a chapter closed; say so once per session and close on the persona runs alone |
| `generatedArtefacts` | the census of files no person writes — a build output, a generated client, a derived catalogue — as `{ path, by }`, the git pathspec and the command that writes it, plus `neverCommitted` with its reason where the artefact must not be committed → *A gate reads the tree; a chapter closes on the commit* | ○ | a generator's output is judged in the working tree and nowhere else, so an artefact a gate rebuilt and passed can be one no commit carries — and the regeneration that made the gate green is what hides it |
| `commitPolicy` | whether the build may commit and push without asking — `commit`, `commitAndPush`, or `ask`. It does not override a repository whose own rules already say | ○ | whatever the repository's own rules say; with neither, the build asks before every commit, cannot run unattended, and the two gates that read commits see nothing until somebody is present → *Whether the build may commit at all* |
| `auditScript` | where a mechanically visible defect becomes a detection rule — one script, or the directory a family of them lives in | ○ | a new rule has nowhere to land, so the project cannot ratchet — report the rule that should have been written rather than inventing a home for it |
| `migrationDir` | where migrations live, and with it how two agents adding one at the same time avoid colliding — one directory, or several where the database has more than one lineage | ○ | nothing says where a migration goes or how two of them collide, so backend chapters run one at a time |
| `frameDeliverables` | what each screen owes beyond working code, one checkable sentence each — and where a defect the running product showed that no frame can draw becomes a standing check, the list growing as such defects are found → `references/demands.md` | ○ | a screen owes nothing beyond working code, so a defect no frame can draw is fixed once on the screen it was found on and met again on every screen built afterwards |
| `factSources` | the tools a drawn value must be verified through before it is built — a statute server, a price list, a published table | ○ | a value the board draws is built as drawn and left marked, never asserted |
| `storyDocument` | the one document the sample data derives from and a final capture run follows | ○ | sample data has no single source, and the screens disagree with each other silently → `references/scenario.md` |
| `locales` | every language the interface ships in — each screen is judged in all of them | ○ | the languages come from the project's own copy catalogue; where that cannot be read, report it rather than judging in one language |
| `pseudoLocale` | the generated long-string locale that proves a layout survives any string | ○ | overflow is judged in the longest real language only, which covers less → `references/judging-frames.md` |
| `captureRoute` | the address that renders one frame, in one state, from named sample data | ○ | captures are driven by navigation, which cannot reach the states that matter; report it as owed rather than hand-driving the board |
| `journeyRoute` | where the running application itself opens — the address a demand with a **journey** in it is answered at, as against the frame route, which has one screen in it | ○ | a demand about pressing a way BETWEEN screens is answered wherever the run happens to be, and the frame route answers it without anybody navigating — so a control that leads nowhere and one that leads home leave the same record → `references/demands.md` |
| `captureReasons` | the words this project's demands say **why a picture is the only witness** in — `firstSight`, `presence`, `transient`, matched inside one clause of a demand line → `references/demands.md` | ○ | a demand naming a capture is never asked to say why a picture is the witness for it, so a picture somebody judged to be the only witness and one a generator emitted per pane read exactly the same |
| `captureStandard` | the window every capture is taken through and the scheme it is taken in — `{ width, height, colorScheme }`, or an array of them where the board draws at several device widths | ○ | every capture is taken at whatever size and colour scheme the driver happened to open with, and a picture records neither — so a run whose window came back narrow or dark files pictures with the frame's lower half missing and nothing in the run reports a problem |
| `browserDrivers` | what drives a browser here, **in order** — the run takes the first that can express the task | ○ | whoever opens a screen picks whatever the environment offers, so two runs of one frame can be shot through different instruments; the run must then name its driver in the return and write it into the handover file, because nothing else records the choice → `references/driving-the-product.md` |
| `deviceDrivers` | what drives a simulator or a real device here, in the same order | ○ | whoever opens a screen on a simulator or a handset picks whatever is installed, so two runs of one screen can be shot through different instruments; and where the project ships on a device and declares none, a sweep reaches for the platform's own commands with nothing saying that was a choice → `references/driving-the-product.md` |
| `captureTakerModel` | the model a `capture-taker` runs on — driving addresses and reading values out is procedure, so it is usually the cheaper one | ○ | both halves run on whatever the harness defaults to. **The split is unaffected** — it is about who judges, not about cost — and what is lost is the saving it also buys |
| `captureJudgeModel` | the model a `capture-judge` runs on — deciding whether a value is a defect is not procedure | ◐ with `captureTakerModel` | half a split named is not a split named; the config is incomplete and is reported rather than half-applied |
| `eyesDocuments` | the documents that hand a check to human eyes | ○ | the project's own eyes rules go unread — **declare these two together or neither**, because documents with no vocabulary read every one of them and match nothing |
| `eyesPhrases` | the words those documents hand it in — `assigns`, `reader`, `moment` | ◐ with `eyesDocuments` | the project's own eyes rules go unread — **declare these two together or neither**, because 「nothing to find」 and 「no idea what to look for」 come out as the same zero |
| `logDir` | one agreed, ignored directory for the builders' run logs | ○ | there is nothing to watch — say so once, and each agent reports its steps in its return |
| `capturesDir` | one agreed, ignored directory for judging captures | ○ | captures go to the session's scratch space and are forwarded by path; nothing is kept |
| `costLog` | a machine-readable file the wall-clock span and consumption are appended to, per chapter | ○ | what a chapter cost cannot be recovered afterwards; only what git holds survives — and with nowhere to stamp a start at the moment of dispatch, the span is gone by the close rather than merely unwritten |
| `narrativePhrases` | extra point-of-view phrasings the handover file must refuse, for a project writing in neither Korean nor English | ○ | the built-in list stands alone |
| `projectGates` | a module exporting this project's own gates and their cases | ○ | only the generic gates run; anything true of this project alone is held by nobody |
| `projectVocabulary` | the words this project's **own** gates judge by, as role → list — the roles are the project's to name, and this skill knows none of them | ○ | a project gate that judges by a list of words carries that list in its own source, so a word the project stops using and a word it never had read the same — and widening it is an edit to a gate rather than a row in a config |
| `disabledGates` | `{ id, reason }` per generic gate this project turns off | ○ | every generic gate runs — which is the default, and a gate is never turned off silently |
| `deferredKeys` | per optional key whose subject does not exist yet, `{ chapter, whenExists }` — the chapter that creates it, and the path whose appearance makes it due | ○ | an absence waiting on a chapter reads exactly like one the project decided against, and the cost in that key's row is paid silently from the day the subject appears |

`chapterHeadings` maps a role to the heading that project's chapter files actually
write, so nothing in this skill has to know one project's wording:

| Role | The section it names |
| --- | --- |
| `prerequisites` | the chapters that must close before this one starts |
| `parallelWith` | the chapters that may be built alongside it |
| `creates` | what this chapter brings into existence |
| `entities` | the tables and records it owns |
| `usedLater` | later chapters whose frames point at this chapter's screens |
| `promises` | screens this chapter's frames point at that do not exist yet |
| `touchedEarlier` | the hand-authored section where a change to a closed chapter is written |
