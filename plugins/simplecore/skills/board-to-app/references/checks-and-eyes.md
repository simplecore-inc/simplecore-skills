<!-- Split out of SKILL.md so a session loads it only when its subject comes up. The skill's
     own section of this name is a routing stub pointing here. -->

# Every rule here is held by a machine or marked as needing eyes

**There is no third category.** A rule that is neither checked nor marked reads as though
something is holding it, which is the state in which it decays — everybody assumes the gate
catches it, nobody looks, and it is broken for a month before a person notices.

So this skill ships the checks for its own mechanical rules, and marks the rest:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/board-to-app/scripts/bta.mjs" check
```

**Held by a gate** — nobody has to remember these:

| Rule | The gate |
| --- | --- |
| the config is complete, well typed, and every declared path is there | `configGate` |
| a key promised to a chapter is declared once that chapter has created its subject | `deferredKeyGate` |
| the commit policy is one of the three words the build knows how to follow | `commitPolicyGate` — a fourth word reads as a decision and is followed by nobody |
| the handover file states facts, never a point of view | `handoverGate` |
| a parked line sits under the declared heading — matched exactly, never by fragment — and carries its three parts, the first of them one unbroken token | `openItemsGate` |
| every chapter is named in the state ledger | `ledgerGate` |
| a capture sits under a declared language and its name parses | `capturesGate` — it holds the PLACE and the SHAPE. The variant is 「lower case, digits and hyphens」 and nothing more, so every word a project layers into it — a theme, a width, a state — passes here whatever it says. **A convention naming a project's own vocabulary is that project's checker to hold**, and one whose default can change is read off the product rather than written down: a project declaring 「bare means the default scheme」 had a run write `-dark-` into a name, and this gate was green over both spellings |
| a capture was taken through the window the project declared, and is a picture a reader can measure at all | `everyCaptureIsAtADeclaredWidth` — the file's own header states the canvas it was encoded from, which is the one half of the standard a picture still remembers; a whole multiple passes, because a device pixel ratio of two is a right window and a wide file |
| a capture was taken in the colour scheme the project declared | `everyCaptureIsInTheDeclaredScheme` — **a warning while a backlog stands**, promoted in the change that drives it to zero. The scheme is in the pixels and nowhere else, so it decodes each capture small and reads its luma; a scheme is not settled with certainty that way and does not have to be, because what separates the two in an application UI is the whole range rather than a margin. A decoder it cannot run is reported rather than passed |
| a result document says what was on the screen, not which run put it there | `evidenceStatesWhatWasSeen` — quoted spans are stripped first, which is what makes the family safe: a round is a real thing on some screens, so `「이번 회차 측정값」` is a field name and `이 회차에 만든` is a trace, in one repository → `ROUND_PHRASES` |
| a capture holds more than an empty canvas of its size would | `everyCaptureIsDenserThanAnEmptyCanvas` — **a warning**, because what it raises is 「open this one」, and the reading it narrows the pile for is the coordinator's row in the table below. It measures bytes against the canvas rather than bytes, since quality and device pixel ratio are both undeclared and an absolute count reads a blank 2×-ratio shot as a fuller screen; an empty canvas costs about 1,900 bytes per megapixel at any quality and any size, and the sparsest real screen 3,900. Failing on it would leave one way to green a correct picture — re-encode it larger — which silences the check for the next one that really is blank |
| every commit says which chapter it belongs to, and one that belongs to none says `setup` | `trailerGate` — it takes any word, so which word is fixed here rather than per project, and it takes its answer from `%(trailers)` rather than from the look of the message, because a block git discarded reads exactly like one it parsed |
| a census counts both sides, and names the sites that do not reach the mechanism | `censusCountsBothSides` — it reads the counts by position and not by word, so a project writes the line in its own language |
| every numbered section of a chapter carries the line that closes it — a persona's, or a machine's | `everySectionCarriesItsClosingLine` — the section is the unit, because a chapter whose other sections are fine reads as sound while one of them was never asked for anything, and every gate downstream takes its demands from the lines this one holds |
| a demand naming a capture says why a picture is the only witness for that one | `everyCaptureDemandGivesItsReason` — the words are the project's `captureReasons`, the clause is the unit, and whether the reason is true is the row below → `references/demands.md` |
| a demand discharged as 「the same component」 names a picture that is on disk and shown | `dischargedDemandNamesItsProof` — a discharge leaning on nothing reads in the file exactly like one that holds |
| a commit adding an import of a file the repository does not have | `importsTravelWithTheirCommit` — `--only` holds back a file nobody named, not somebody else's edit inside a file that was named |
| a parked line that says it blocks a chapter does not survive that chapter closing | the project's own gate — the marker is that project's word and so is its ledger's word for a closed chapter, so nothing generic can read either |
| the frames, counts and copy a chapter builds to | the board's own gates (`simplecore:wireframe-boards`) |
| a screen deliverable the project declares is one its chapter files actually demand | `everyFrameDeliverableReachesAChapter` — an **error**, because what it names is 「this sentence is asked of nobody」 rather than 「go and re-read this」. A declaration nothing emitted reads as coverage while every gate over the chapter set stays green: three sentences sat that way through eight green gates and a closed chapter, and the defects they describe were found afterwards by a person using the product. The comparison is verbatim against the project's own sentences, and it speaks only where a chapter file places a frame — a chapter set with no screen in it owes no deliverable |
| whatever `frameDeliverables` declares is TRUE of the screen | the project's own gate, one checkable sentence each — that the sentence reached a chapter at all is the row above, and a project that holds a deliverable some other way turns that one off in `disabledGates` with the reason |
| the code's own defect types | the project's `auditScript` — every new detection rule goes there, whether that key names one script or the directory a family of them lives in |
| every key this skill reads has a row in the config table above and a line in the copyable template, and the cost that row states is the sentence `doctor` prints | `bta.mjs gates` — a self-check rather than a gate, because its subject is this skill's own two documents rather than any project's → `references/checks.md` |
| a word the project declared as its own vocabulary is one its documents actually write | `declaredWordsMatchTheDocuments` — and `bta.mjs doctor` prints what every one of them matched, because the count is worth as much as the finding here |
| a declared vocabulary has been compared against something at all | `declaredWordsHaveBeenCompared` — a warning, because an empty corpus is a project that has not written the documents yet rather than a defect; it is the sentence that stops 「nothing to read」 and 「read it and it was sound」 arriving as the same silence |

**Held by eyes** — no machine can judge these, and saying so is the point. **Each row names
whose eyes and at which moment**, for the reason the next paragraph gives:

| Rule | Whose eyes, and when | Why no gate holds it |
| --- | --- | --- |
| the agents this skill's procedure names were dispatched, rather than the coordinator building in its own context | **the coordinator**, at the session's first unit of work and again at every chapter | a session's own tool use leaves no trace in the repository — a chapter built by six agents and one built by the coordinator alone produce the same tree, the same commits and the same ledger row, so the difference is visible only to the party making the choice |
| which driver took a capture, and that one instrument took every capture being compared | **whoever takes the capture**, naming it in the return, and **the coordinator** whenever it holds two runs against each other | a picture carries no record of what shot it, and two drivers differ in device pixel ratio, fonts and scrollbar width — so an instrument change and a screen change read identically → `references/driving-the-product.md` |
| the colour scheme a capture was painted in, and that the reading the taker reported is the one the picture shows | **the `capture-judge`**, before comparing a single value on the screen's first picture — never the taker, whose reading is the artifact under test | a scheme leaves nothing behind in the file: a dark capture is a perfectly good screen and its name says nothing about it, so a run that shot every frame in the wrong scheme is a folder of plausible pictures and a judging that spends every finding on 「no capture covers this」. The width is the half a file does record, and `everyCaptureIsAtADeclaredWidth` holds that one |
| the server signed into is this build's own development server | **whoever signs in**, reading the address before the first credential is typed | nothing in the repository records which host a run drove, and a capture of a staging screen and a capture of a local one are the same picture |
| a credential reached nothing but the process that signed in | **whoever writes a report, the handover file or a result document**, before it leaves their hands | a password has no shape that separates it from an account name or an identifier, so a pattern wide enough to catch one fires on every persona row in the ledger |
| a finding written back into this skill went into a checkout rather than an installed copy | **whoever writes it**, in the change that writes it | an installed copy and a checkout are the same bytes at the same path, and the difference shows only when the next install of the plugin deletes one of them |
| a screen matches the frame it was built from, and the capture shows that screen rather than an empty shell of it | **the coordinator**, opening each of the chapter's captures before writing the ledger row that closes it — never the agent that took them | a picture is the only witness, and the party that shot it is the party that cannot see past what it expected → `references/judging-frames.md` |
| what a verification record says was on the screen is what was on the screen, and it was written out of the run rather than before it | **the `capture-judge`**, sentence by sentence against the picture each one cites, for the screens it was dispatched to hold — and **the coordinator**, reading the document whole before writing the ledger row that closes the chapter, for what no per-screen reading reaches: a claim spanning screens, a section citing no picture at all, a reason given for writing a figure down | a sentence written from the DOM, the responses and the builder's memory of its own code is true of the data, false of the screen, and indistinguishable in the file from one written by looking. **The coordinator alone cannot hold it at a chapter's real size**: a chapter of forty captures is read by whoever opens forty pictures, and the party already opening them one screen at a time is the judge. A round that left the document out of every judge brief and left the coordinator to do it alone did not do it — and the tell was nothing, because the document was there and cited its captures |
| the reason a demand gives for a capture is true of that capture — that a picture really is the only witness for it | **the `capture-judge`**, holding the quoted demand against the picture for that screen, before it returns its disagreements | the gate sees that a reason was given and that it is one of the project's three; whether a pane's content is genuinely on no response body is a claim about the running application, which no chapter file carries. A wrong reason and a right one are the same string to a reader of the chapter |
| a discharge is still true — the component it called an unbuilt placeholder has not since been built | **the coordinator**, at the close of the chapter that builds that component, re-opening the sections that discharged against it | nothing in the repository records that a placeholder became a screen: the discharge line, the capture it names and every byte around them are unchanged on the day the component ships, so the file goes on reading as a correct discharge of a demand that is now answerable |
| a drifted quote is taken down rather than run again — the demand vanished whole, or the section already answered the question its rewording now asks | **whoever brings the quote down**, before the edit, quoting the removed demand's answering observation or the answering sentence in the commit | the check sees that a quote stopped matching, never which of the six paths out of that applies — and the two cheap paths are cheap in exactly the way that makes them the ones reached for. A `saw` entry paired to the wrong demand by its number, and one judged 「close enough」 to a question it never answered, both leave a section that reads as verified → `references/evidence.md` |
| a global change owed a census, and the sample was drawn from the rest rather than from the same context as the screens walked in full | **the coordinator**, before the commit that lands the change is written | which screens carry the context differences is a reading of what the change means; the census counts sites through a mechanism and cannot say which of them differ, and a sample drawn from the directly-related screens measures the mechanism twice and the rest never |
| a word a transcription reports is one the screen draws rather than one only the accessibility tree carries | **the `capture-judge`**, before it returns its disagreements, opening the picture for every sentence the taker marked `named` — never the taker, which read the tree | a `title` attribute and a text node are the same string in the tree, so 「보기」 over an eye icon and 「보기」 on a labelled button are one sentence in the transcription and two different screens in the picture |
| a screen holds up for the person whose work it carries | **the builder**, in character, during the persona run | that is what the persona run is |
| a chapter's scenario was re-reviewed against the sources it was generated from, rather than only read | **the coordinator**, before that chapter's first agent is dispatched | every source a chapter quotes — the board, the design chapters, the entity dictionary, the story, the parked lines — moves after the chapter is generated, and nothing in the regenerated file marks which of its sentences are quotations of something that has since changed |
| a prerequisite the derived graph did not name | **the agent that meets it**, at the moment it blocks | it surfaces while building; the agent that meets it stops and reports |
| a chapter's start was stamped as its first agent went out, rather than reconstructed at the close | **the coordinator**, in the turn that chapter's first agent is dispatched | a dispatch changes no file and lands no commit, so there is nothing in the repository for a gate to date — and by the close the start is recoverable from a builder's log at best and from nobody at worst |
| a deletion and a read over the same pile of files were sequenced rather than overlapped | **the coordinator**, before either instruction is sent — it is the only party holding both | the two are prompts, and neither leaves an artifact to hold against the other; an ignored directory has no reflog, so what the deletion took is unrecoverable and the reader returns findings that read as sound over files nobody can open |
| two chapters may run at once | **the coordinator**, before each dispatch | a resource judgment, made per dispatch against facts that change |
| what a wave shares outside the repository being built | **the agent it blocks**, in the turn it blocks them | no diff in this repository shows a plugin checkout, a global setting or a shared script — and the agent one of them blocks is the only agent that can unblock it |
| whether a brief carried what its own checks need, the design chapter that governs the work, and **through which channel each thing it asks for is to reach you** — a named agent sends its report, an unnamed subagent has only its run log | **the coordinator**, reading the brief back against itself before sending it | a prompt leaves no artifact, so the only reading of a brief is the one the coordinator takes before sending it — a gate can hold that a chapter file cites a design chapter, never that a brief did. Both ways of getting the channel wrong read as an agent that went quiet: one wrote its report into the void, the other was asked for step reports it had no way to send |
| a second coordinating position is on this checkout | **whoever opens a session**, reading the ledger's plan section at step 2 of *Opening a session* — the same reading that says which chapter is open | commits from another position read as 「somebody committed」, which is ordinary; what is not ordinary is a plan naming agents you did not dispatch, and only somebody who knows what they sent can see it |
| a rule that became a checker was reached in this run | **whoever added the checker**, in the same change | four ways it is not, all four reading as a passing run — a checker cannot report on the comparison it never made |
| how much a red gate command left unmeasured | **whoever ran it**, off its log, before reporting the result | the exit status is honest and says only that the run stopped; how far a chained command got is read off its log by somebody |
| which of two commands a step's proof is read off | **whoever writes the step down** | a report and a gate both exit zero on a healthy project, so only somebody who knows which one can fail can say whether a proof was taken → `references/checks.md` |
| a contract designed from the documents matches the code that will implement it | **whoever designs it**, before the contract is written | two documents agree with each other more easily than either agrees with the branches already in the code, and only reading those branches settles it |
| the story document covers the frames its steps feed, and its steps still add up | **the coordinator**, whenever a chapter is added or the story moves | this skill ships no checker for either — the first is one a project can write as a gate of its own, the second nobody can → `references/scenario.md` |
| an agent renaming a published shape is scoped by surface rather than by a file list | **the renaming agent**, after the rename and before it stands down | the readers surface while the work happens, so no list written beforehand is complete — and both sides type-check green while one of them draws `undefined` |
| how many agents may extend the migrations at once | **the coordinator**, when the wave is planned | it follows from the project's scheme — a range divides, a parent chain does not — and the scheme is read off `migrationDir` per wave |
| a sentence standing beside a chip filter is one the chip choice changes, or a page note in the wrong place | **the coordinator**, reading the frame before dispatching the chapter that builds it — never the agent that drew it | 「Does this sentence change when the chip changes?」 is answered by reading the sentence; the board's gate sees a block between the chip row and the list and cannot see which side of that question it falls on → `simplecore:wireframe-boards` |
| the documents, the board and the code agree in meaning | **whoever moves one of the three**, in the same change | a checker holds that a frame is referenced, never that two sentences say the same thing |
| an agent is stalled rather than inside something long | **the coordinator**, at each check on a quiet agent | the three readings, and they need somebody to take them |
| a parked decision genuinely qualifies | **whoever is about to honour the line**, against today's sources | the default is to decide, and only a person can say the design ran out |
| a path carried over from a retired arrangement still names it | **whoever opens the document** | only somebody who knows the project moved can tell a live document from a leftover → `references/migrating-from-a-walk.md` |
| a document about to be deleted is opened by a program | **whoever deletes it**, before deleting | this skill reads no path that is being retired; what holds it is the project's own gate, run after the deletion rather than before → `references/migrating-from-a-walk.md` |

**A rule added to this skill lands in one of those two tables in the same change.** Where it is
mechanical, the gate is written now — and proved in both directions before it counts, because a
gate that has never fired is indistinguishable from one that cannot. Where it needs eyes, the
second table says so, and nobody spends a session hunting for the check that was never there.

### A rule marked as needing eyes names whose eyes, and when

**「A person has to judge this」 with nobody named is the third category wearing the second
category's label.** It reads as covered, it survives every audit of the two tables, and the
reading it describes is taken by nobody — because a duty addressed to everyone is a duty
nobody's turn ever arrives for. So the middle column above is not decoration: a row without it
is not finished.

Two properties make the column worth the space, and both are load-bearing:

1. **A reader who is not the party being checked.** The agent that took a capture is the worst
   available judge of it — it knows what the screen was supposed to hold, so it reads the
   picture for confirmation and finds it. Where the rule checks an artifact, the eyes belong to
   somebody who did not produce that artifact; where no such party exists, that is the finding,
   and the answer is to arrange one rather than to write the row anyway.
2. **A moment that something else is waiting on.** 「Before the ledger row is written」 and
   「before the brief is sent」 are moments a run actually arrives at and cannot pass without.
   「Regularly」, 「as part of the review」 and 「when closing」 are not moments; nothing stops at
   them, and a reading with no moment is a reading that happens the first week and then never.

> **The case this now catches**: a chapter's captures declared correct by the agent that shot
> them, with the rule 「whether the capture shows the frame it is named after stays with eyes」
> sitting in the project's own documents, naming no reader and no moment. Two screens closed a
> chapter that way — one drawing a list total of fourteen over no rows at all, one painting two
> tables into the same rectangle — and every gate the repository had was green over both.

**A rule whose finding is a prompt rather than a defect is still held by a gate** — it declares
`grade: 'warning'`, prints under `⚠`, and leaves the exit status alone. That is for a rule that is
right to fire and wrong to fail on: a parked decision naming the article nobody could settle names a
source that may already answer it, and only a person re-reading the article can say. It is never a
way to keep a rule that fires wrongly, and the grade sits on the gate rather than on the finding —
both → `references/checks.md`.

**Generic checks live here; project-specific checks live in the project.** A heuristic true only
of one repository's layout — its document format, its stack's conventions, its own data shapes —
never enters this skill; it goes in the module the project declares as `projectGates`, and its
cases go beside it. Where a gate belongs, how to write one, and how a project wires and proves
its own → `references/checks.md`.

### The third category comes back as a checker that did not run

**A rule is held when the check reached it in this run, not when the check exists.** That is the
axis the two tables actually turn on, and 「is there a checker?」 is a proxy for it that agrees most
of the time and fails in one direction only. Four ways a checker exists and does not reach the
thing — and **all four come out of a run looking like a pass**:

| The shape | What it is |
| --- | --- |
| **no command runs it** | the checker is in the repository and in no entry of `gates`. Somebody greps, finds it, and reads the rule as covered |
| **an earlier failure in the same command hid it** | one `gates` entry is a chain, and the checkers after the one that failed did not run at all → *Closing a chapter* |
| **its own precondition did not hold** | it compares three things and skips, silently, whatever is missing one of them |
| **its pattern matches anything** | it runs, compares, and every comparison passes because the pattern it compiled accepts any string |

**The first three are indistinguishable from green; the fourth produces green.** And the first does
the most damage for a reason that has nothing to do with machines: a checker that exists is read as
a rule that is held, so nobody has a reason to look. A rule with no checker at all is the honest
version of the same coverage.

Two things narrow it, and the second is here because the first is not enough:

1. **A checker says how many comparisons it made, not only how many failed.** 「0 findings」 and
   「paired 186 of 193」 are one line to an exit status and two different sentences to a reader —
   only the second shows the seven it never reached. `bta.mjs doctor` prints that count for the
   one subject where it is the whole answer: what each declared word matched in the documents it
   governs, `✔ chapterLines.persona matched 1675 — 35 chapter files, 10286 compared` beside
   `○ evidenceLabels.did nothing to match against yet — 0 result documents`. The first says the
   comparison reached something; the second says a project has not written anything for it to
   reach; and a gate reporting nothing says neither.
2. **A pattern with a placeholder in it is tested for what it matches.** The count stays honest
   while the comparison behind it stops meaning anything: a vocabulary pattern whose slots compiled
   to 「any non-empty string」 and 「any two words」 read 556 buttons, reported 556, and passed seven
   that were wrong. One pattern that matches everything voids a whole checker and leaves its
   statistics untouched — which is why counting is a necessary condition and not a sufficient one.
3. **A board figure and a code figure are two different measurements until something says they are
   not.** Averaging what the board draws and averaging what the code declares produces two numbers
   that subtract cleanly and mean nothing: a board's header cells include the action column it
   draws with no name, and the code emits that column from an `actions` prop rather than as a
   column, so the board's 3.7 and the code's 1.9 are not 「half」 — they are 3.0 against 1.9 once the
   unit matches. **Write down what each side counts before putting the two in one sentence**, and
   prefer a code-to-code comparison against the replication source, where both sides are the same
   expression by construction. The gap that survives the unit check is the finding; the rest was
   arithmetic on two different things.

**The census is a gate, not a count somebody remembers to take.** How many checkers the repository
has and how many an entry of `gates` actually reaches is a number rather than a judgment — which
makes 「count it once, when the project is wired」 the third category in person form. A count taken
once is true on the day it is taken and decays from the next commit, and the shape it was meant to
catch is precisely a checker somebody adds later and wires to nothing.

**A project writes it, because only a project knows what one of its checkers looks like** — the
naming rule is local (`audit-*.mjs`, `check_*.py`, a `checks/` directory) and belongs in that
project's config or gate rather than here. **What is not local is how it judges**, and these three
are the whole of it:

1. **Start from the commands, never from the files.** The set that counts is what `gates` runs.
   Reading the repository for checker-shaped files and calling them covered inverts the question.
2. **Follow the import closure of each command.** A checker is reached when the entry point it
   sits behind reaches it — directly, or through a module that command imports. Matching on the
   command's own text finds the entry points and misses everything they pull in, which reports a
   wired checker as orphaned and teaches everybody to ignore the gate.
3. **Report the orphans by name.** 「7 of 9 reached」 gives nobody anything to do; the two names do.

> **Read it this way and it is wrong**: 「the checker exists, so the rule is held」. A manual
> checker sat in the repository and in no entry of the `check` chain; measured for the first time
> it had 232 findings, and not one of them had ever been seen.
