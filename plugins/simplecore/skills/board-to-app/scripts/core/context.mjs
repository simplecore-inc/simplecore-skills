// The project a build runs in, as the gates see it: the declared config, resolved paths, and
// the few readers a gate is allowed to use.
//
// Everything a gate knows about a project comes through here, so a gate never joins paths
// itself and never guesses one. A key the project did not declare resolves to null, and the
// gate that needs it is skipped rather than run against an invented path.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { compileLine, compileLines } from './grammar.mjs';
import { evidenceReaders } from './evidence.mjs';

/** Where a project declares its build, relative to the project root. */
export const CONFIG_NAME = join('.claude', 'board-to-app.json');

/**
 * Every key the skill reads, what it names, and what the value has to be.
 *
 * <p>`kind` decides both the type check and what existence means:
 * `dir`/`file` must be there already, `path` is either of the two and must be there, `outdir`
 * is written on first use so it need not exist, `outfile` is appended to so only its parent
 * must exist, `command` is a shell line rather than a path, `list` is an array, `text` is a
 * non-empty string, `headings` is the role → heading map, and `deferrals` is the
 * key → { chapter, whenExists } map naming the optional keys whose subject does not exist yet.
 *
 * <p>`path` is for a key whose subject is one file in one project and, in the next, the
 * directory a family of them lives in — the key names where the thing is, and the project
 * decides whether that is a file or a folder.
 *
 * <p>`many` lets a key be declared once or several times: one string, or an array of them,
 * each held to the same `kind`. It is for a subject a project can genuinely have more than
 * one of, such as a database with several migration lineages.
 *
 * <p><b>`required` and `closing` are different questions and a key can want either.</b> `required`
 * is 「nothing here works without it」; `closing` is 「everything works and no chapter can finish」.
 * Reported as one blank they read the same, and a project reads a page of green while being unable
 * to end anything — which is what happened. An absence of the second kind is a finding rather than
 * a choice, and a project that genuinely does not want it says so in `deferredKeys` with the
 * chapter that will declare it.
 *
 * <p><b>`absent` is what the project pays for not declaring the key, and it lives here because
 * `doctor` has to print it.</b> A report that says only 「not declared」 tells a reader what they
 * already know; what decides whether to go and declare it is the sentence in the config table's
 * last column, and that sentence used to be reachable only by opening `SKILL.md` and finding the
 * row. It is one sentence in one place now: `doctor` prints this string, the config table's last
 * column carries the same string, and `proveKeysAreDocumented` fails the run when the two differ —
 * because two copies of a sentence is one sentence and one copy nobody is reading.
 *
 * <p><b>Each sentence stands alone.</b> `doctor` prints one key at a time, in whatever order the
 * absences fall, so a cost written as 「as above」 lands under a key whose neighbour is declared and
 * says nothing at all.
 */
/**
 * The lines a chapter writes that a check has to recognise, by role.
 *
 * <p>`persona` opens the line a named role has to prove, `verdict` the line a machine proves
 * instead, and `states` the sentence listing the states hanging off a screen. A project writes
 * each in its own words; nothing here may assume them.
 *
 * <p><b>Each is the line AS WRITTEN, markup and all</b> — `**Test · {text}**…`, not `Test · `.
 * The phrase is compiled straight into the reader that scans a chapter file, so anything the line
 * really starts with belongs in it. This is the opposite of `evidenceLabels` below, and the two
 * being opposite is why both say so here.
 *
 * <p><b>A project that writes no such line declares the role `null`</b>, with the reason in a
 * `//<role>` entry beside it. `states` is the one that is genuinely absent from some projects — a
 * board that gives every state a frame of its own has no sentence listing states — and without a
 * way to say so, the choice is between a config that fails validation and a line declared to
 * satisfy it that no chapter contains.
 */
export const CHAPTER_LINE_ROLES = ['persona', 'verdict', 'states'];

/**
 * The three labels one evidence section carries, by role.
 *
 * <p>`did` is what was run, `demanded` is the chapter's own sentence copied whole, and `saw` is
 * what was on the screen. `demanded` is the one a check compares against the chapter, so a project
 * that renames it renames what the comparison looks for.
 *
 * <p><b>Each is the WORD alone, with no markup on it</b> — `What was done`, never
 * `**What was done**`. The checks write the emphasis themselves, so a label declared with it
 * carries the markers twice and matches no line in any document — a silence, not an error, which
 * is why `configGate` refuses a label carrying markdown. This is the opposite of `chapterLines`
 * above, and being opposite is the whole reason both say so.
 */
export const EVIDENCE_LABEL_ROLES = ['did', 'demanded', 'saw'];

/**
 * The three vocabularies that decide whether a rule handed to eyes says who reads it and when.
 *
 * <p>`assigns` is how a sentence says no machine judges this, `reader` is who takes the reading,
 * and `moment` is when. Each is a list of literal phrases in the project's own language, matched
 * case-insensitively inside one statement.
 */
export const EYES_PHRASE_ROLES = ['assigns', 'reader', 'moment'];

/**
 * The three cases in which a picture is the only witness, as a project words each of them.
 *
 * <p><b>The roles are fixed because the cases are.</b> `firstSight` is a screen nobody has opened —
 * a route answering 200 with the chrome painted and nothing inside it passes every other check
 * there is. `presence` is a claim about what is drawn, where, and in what words that no response
 * body carries. `transient` is a state that exists only while something is open. Everything else a
 * demand can ask for is settled by what the server answered, and a fenced block is the evidence
 * for it.
 *
 * <p>Each is a list of literal phrases in the project's own language, matched case-insensitively
 * inside one clause of a demand line — the same arrangement as `eyesPhrases`, and for the same
 * reason: what the reason SAYS is the project's, and that one is given is the skill's.
 */
export const CAPTURE_REASON_ROLES = ['firstSight', 'presence', 'transient'];

/**
 * What one entry of `captureStandard` names: the window a capture is taken in, and the scheme.
 *
 * <p>`width` and `height` are CSS pixels, so a run reads them back out of the page with
 * `innerWidth`/`innerHeight` rather than off the file. The file's own width is `width` times the
 * device pixel ratio, which is why `everyCaptureIsAtADeclaredWidth` accepts a whole multiple.
 */
export const STANDARD_FIELDS = ['width', 'height', 'colorScheme'];

/**
 * The schemes a capture standard may name.
 *
 * <p>Two, and no `no-preference`: that is a browser saying it has not been told, which is the
 * state the key exists to end. A project that genuinely does not care declares no standard, and
 * pays the cost its row states.
 */
export const COLOR_SCHEMES = ['light', 'dark'];

/** The roles `chapterHeadings` maps, so nothing in the skill has to know one project's wording. */
export const SCHEMA = {
  boardRoot: { kind: 'dir', required: true, absent: 'the build cannot start' },
  boardManifest: { kind: 'file', required: true, absent: 'the build cannot start' },
  boardRoles: { kind: 'file', absent: 'personas come from each frame\'s own access notes; a chapter whose personas cannot be derived that way stops and reports' },
  chapterDir: { kind: 'dir', required: true, absent: 'the build cannot start' },
  chapterOverview: { kind: 'file', required: true, absent: 'the build cannot start' },
  chapterGenerator: { kind: 'command', absent: 'a chapter cannot be regenerated after a board fix; report that rather than hand-editing the chapter file' },
  chapterHeadings: { kind: 'headings', absent: 'a section is named by its role rather than by a heading, and an agent that cannot find one stops and reports' },
  // The words a chapter's own lines begin with, and the word its ledger writes for a closed
  // chapter. Every check over a chapter's evidence has to read these, and reading them from a
  // constant is what kept those checks in one repository.
  //
  // **No default, deliberately.** A default in this skill's own language is silently imposed on a
  // project working in another — it would run, find nothing, and report nothing, which is the exact
  // shape of failure the `closing` grade exists to make visible. Undeclared, everything still runs
  // and no chapter closes, and `doctor` says which key is why.
  chapterLines: { kind: 'headings', roles: CHAPTER_LINE_ROLES, closing: true, absent: 'every check that reads a chapter\'s own demands matches nothing, and reports the same zero as a chapter with nothing wrong' },
  evidenceLabels: { kind: 'headings', roles: EVIDENCE_LABEL_ROLES, bare: true, closing: true, absent: 'every check over a result document reads past every section, so a chapter cannot be shown to have closed on anything' },
  closedStatus: { kind: 'text', closing: true, absent: 'nothing is closed, and every check over a closed chapter stays silent' },
  // The role an evidence heading names where a persona would stand, for a check a machine proves.
  // Its own key rather than `chapterLines.verdict`: that one is a LINE and this is a WORD, and
  // stripping the markup off the line to guess the word is the kind of derivation that reads fine
  // and comes out wrong — it did, putting 「**판정**…」 into a heading a person has to match.
  verdictRole: { kind: 'text', closing: true, absent: 'a foundation chapter\'s sections cannot be matched to the lines they prove' },
  // The line an evidence section carries when a check RAN and this installation cannot decide it.
  // Compiled by the same grammar as `chapterLines`, and its `{text}` is the chapter that repays
  // the debt. Optional: a project that has never met the case declares nothing and the two checks
  // over it are skipped. **A project that HAS met it and declares nothing writes the marker in
  // prose, where the chapter it names closes with the debt still outstanding** — which is the
  // failure the key exists to stop, and the reason `references/evidence.md` names the key at the
  // moment the case first comes up rather than in a list of options.
  deferredLine: { kind: 'text', absent: 'a project that has met that case writes the marker in prose instead, and the chapter it names closes with the debt outstanding and nothing reading it' },
  // The line an evidence section carries in place of a picture, when the demand asked for one and
  // a picture is not the witness for it — the pane behind the tab is the same unbuilt placeholder
  // the section above already photographed. Its `{text}` is the capture that proves the component.
  //
  // **A demand a picture cannot answer is DISCHARGED, never skipped**, and this key is what makes
  // the difference visible. A taker that correctly shot one placeholder and left the other two is
  // right, and with nothing to write it leaves two sections showing nothing — which afterwards is
  // indistinguishable from two panes nobody opened. Compiled by the same grammar as `deferredLine`
  // and kept beside it, because a check reading a result document reads all of them together.
  placeholderLine: { kind: 'text', absent: 'a demand a picture cannot answer is met by silence, and afterwards a pane nobody opened and a pane correctly proved by the capture above it read exactly the same' },
  // Where a chapter's verification result and the captures it cites are written. **Not required to
  // configure and required to close** — a project builds screens without it and cannot finish a
  // chapter, which is the difference `required` alone could not express and `doctor` reported as an
  // ordinary blank. A board-to-app project that had every key green closed one chapter of
  // thirty-six, on five checks out of six, with no evidence folder at all.
  evidenceDir: { kind: 'dir', closing: true, absent: 'screens get built and no chapter can be shown to have closed on anything — the grounds die with the session' },
  stateLedger: { kind: 'file', required: true, absent: 'the build cannot start' },
  handoverFile: { kind: 'file', required: true, absent: 'the build cannot start' },
  openItemsFile: { kind: 'file', absent: 'parked lines go in the state ledger' },
  openItemsHeading: { kind: 'text', requiredWith: 'openItemsFile', absent: 'the config is incomplete — report it rather than choosing a heading' },
  gates: { kind: 'list', closing: true, absent: 'nothing mechanical holds a chapter closed; say so once per session and close on the persona runs alone' },
  // Whether the build may commit and push without asking. **No default beyond `ask`**, and `ask`
  // is what an undeclared key means: a skill that assumed permission would take it in every
  // repository that installed it, and the one thing a build must not do on its own initiative is
  // decide how somebody else's history is written. The three words are `commitPolicyGate`'s, not
  // this schema's — a value outside them is a decision the build cannot follow, which is a finding
  // rather than a type error.
  commitPolicy: { kind: 'text', absent: 'whatever the repository\'s own rules say; with neither, the build asks before every commit, cannot run unattended, and the two gates that read commits see nothing until somebody is present → *Whether the build may commit at all*' },
  auditScript: { kind: 'path', absent: 'a new rule has nowhere to land, so the project cannot ratchet — report the rule that should have been written rather than inventing a home for it' },
  migrationDir: { kind: 'dir', many: true, absent: 'nothing says where a migration goes or how two of them collide, so backend chapters run one at a time' },
  frameDeliverables: { kind: 'list', absent: 'a screen owes nothing beyond working code' },
  factSources: { kind: 'list', absent: 'a value the board draws is built as drawn and left marked, never asserted' },
  storyDocument: { kind: 'file', absent: 'sample data has no single source, and the screens disagree with each other silently → `references/scenario.md`' },
  locales: { kind: 'list', absent: 'the languages come from the project\'s own copy catalogue; where that cannot be read, report it rather than judging in one language' },
  pseudoLocale: { kind: 'text', absent: 'overflow is judged in the longest real language only, which covers less → `references/judging-frames.md`' },
  captureRoute: { kind: 'text', absent: 'captures are driven by navigation, which cannot reach the states that matter; report it as owed rather than hand-driving the board' },
  // The words a demand uses to say why a picture is the only witness for the capture it names.
  //
  // **A capture demanded with no reason is a habit rather than a judgment**, and it is emitted by
  // the thousand: a generator that writes one file name per pane per frame produces a chapter
  // demanding pictures nobody can give a reason for, and — where the panes are unbuilt
  // placeholders — pictures nobody can take at all. One chapter set asked for 1040 of them and
  // said of no single one why a picture was owed. Whether the reason is TRUE stays with eyes; that
  // one was given is what this key lets a machine see.
  captureReasons: { kind: 'phrases', roles: CAPTURE_REASON_ROLES, absent: 'a demand naming a capture is never asked to say why a picture is the witness for it, so a picture somebody judged to be the only witness and one a generator emitted per pane read exactly the same' },
  // The size and colour scheme every capture is taken at. **Declared rather than left to the
  // driver**, because both are wrong in a way that reads as a correct run: a window that came back
  // narrow files a frame with its lower half missing, and a console in the wrong scheme files a
  // screen nobody can hold against a sibling. Six captures were taken at 1280 wide in dark mode
  // where the board measures at 1440 in light, and the run reported nothing — the files were
  // written, the sizes were plausible, the transcription was complete, and every finding of the
  // judging that followed was 「no capture covers this」.
  //
  // **Both halves are checked, and they are checked differently.** The width is in the header, so
  // `everyCaptureIsAtADeclaredWidth` reads 64 bytes. The scheme is in the pixels and nowhere else,
  // so `everyCaptureIsInTheDeclaredScheme` decodes each capture small and reads its luma — which
  // does not settle a scheme with certainty and does not have to, because what separates the two
  // in an application UI is the whole range rather than a margin.
  //
  // **One standard, or an array of them where the board genuinely draws at more than one device
  // width.** The array is not a convenience: `everyCaptureIsAtADeclaredWidth` refuses a width it
  // was not given, so a board with tablet frames declares that width here or the gate reddens on
  // frames that are exactly right. It is the same statement `migrationDir` makes with `many` —
  // a subject a project can honestly have several of.
  captureStandard: { kind: 'standard', absent: 'every capture is taken at whatever size and colour scheme the driver happened to open with, and a picture records neither — so a run whose window came back narrow or dark files pictures with the frame\'s lower half missing and nothing in the run reports a problem' },
  // What drives a browser, and what drives a device, in the order the run takes them. A list
  // rather than one name, because the choice is per task: a driver that cannot express the task is
  // stepped past, and the run says which one it ended up on.
  //
  // **Undeclared is not a default order.** No name belongs in this skill — the tools available
  // differ per machine and per user — so an absence means the run picks and then has to record
  // what it picked, which `references/driving-the-product.md` says how to do.
  browserDrivers: { kind: 'list', absent: 'whoever opens a screen picks whatever the environment offers, so two runs of one frame can be shot through different instruments; the run must then name its driver in the return and write it into the handover file, because nothing else records the choice → `references/driving-the-product.md`' },
  deviceDrivers: { kind: 'list', absent: 'whoever opens a screen on a simulator or a handset picks whatever is installed, so two runs of one screen can be shot through different instruments; and where the project ships on a device and declares none, a sweep reaches for the platform\'s own commands with nothing saying that was a choice → `references/driving-the-product.md`' },
  // Which model each half of the capture split runs on. **The split itself is not configurable** —
  // whoever shot a picture cannot judge it — and these two say only where the work is procedure
  // and where it is judgement.
  //
  // Each requires the other: half a split named is a project that has thought about one side, and
  // applying it to one agent while the other inherits whatever the harness gives is the arrangement
  // silently costing more on the half that was supposed to be cheap.
  captureTakerModel: { kind: 'text', requiredWith: 'captureJudgeModel', absent: 'both halves run on whatever the harness defaults to. **The split is unaffected** — it is about who judges, not about cost — and what is lost is the saving it also buys' },
  captureJudgeModel: { kind: 'text', requiredWith: 'captureTakerModel', absent: 'half a split named is not a split named; the config is incomplete and is reported rather than half-applied' },
  // The documents that hand checks to human eyes, and the words they hand them in.
  //
  // **Not `closing`** — a project that declares NEITHER closes chapters perfectly well and simply
  // gets no check over its own eyes rules, which `doctor` shows as two undeclared keys.
  //
  // **But one without the other is refused.** A repository that names the documents has eyes
  // rules in them; with no vocabulary the check reads every one of those documents and matches
  // nothing, and «nothing to find» and «no idea what to look for» come out as the same zero. The
  // absence of the whole subject is said by declaring neither, which is a statement; half of it
  // is not a statement, it is a gap that reports as green.
  eyesDocuments: { kind: 'list', requiredWith: 'eyesPhrases', absent: 'the project\'s own eyes rules go unread — **declare these two together or neither**, because documents with no vocabulary read every one of them and match nothing' },
  eyesPhrases: { kind: 'phrases', roles: EYES_PHRASE_ROLES, requiredWith: 'eyesDocuments', absent: 'the project\'s own eyes rules go unread — **declare these two together or neither**, because 「nothing to find」 and 「no idea what to look for」 come out as the same zero' },
  logDir: { kind: 'outdir', absent: 'there is nothing to watch — say so once, and each agent reports its steps in its return' },
  capturesDir: { kind: 'outdir', absent: 'captures go to the session\'s scratch space and are forwarded by path; nothing is kept' },
  costLog: { kind: 'outfile', absent: 'what a chapter cost cannot be recovered afterwards; only what git holds survives — and with nowhere to stamp a start at the moment of dispatch, the span is gone by the close rather than merely unwritten' },
  narrativePhrases: { kind: 'list', absent: 'the built-in list stands alone' },
  projectGates: { kind: 'file', absent: 'only the generic gates run; anything true of this project alone is held by nobody' },
  // The words a project's OWN gates judge by. Its roles are the project's to name — this skill
  // cannot know them, which is precisely why a vocabulary like this had nowhere to live: every
  // other `phrases` key belongs to a generic gate and names roles from a fixed list, so a project
  // that needed one kept it in a file beside its gates where `configGate` never looked. A word
  // list nobody validates is a word list that can go empty without anybody hearing.
  projectVocabulary: { kind: 'phrases', roles: null, absent: 'a project gate that judges by a list of words carries that list in its own source, so a word the project stops using and a word it never had read the same — and widening it is an edit to a gate rather than a row in a config' },
  disabledGates: { kind: 'exceptions', absent: 'every generic gate runs — which is the default, and a gate is never turned off silently' },
  deferredKeys: { kind: 'deferrals', absent: 'an absence waiting on a chapter reads exactly like one the project decided against, and the cost in that key\'s row is paid silently from the day the subject appears' },
};

export const HEADING_ROLES = [
  'prerequisites',
  'parallelWith',
  'creates',
  'entities',
  'usedLater',
  'promises',
  'touchedEarlier',
];

const PATH_KINDS = new Set(['dir', 'file', 'path', 'outdir', 'outfile']);

/** Whether a declared value is a path this project expects to find on disk. */
export function isPathKey(key) {
  return PATH_KINDS.has(SCHEMA[key]?.kind);
}

/**
 * Find the config by walking up from a starting directory.
 *
 * @returns the absolute config path, or null when no ancestor declares one
 */
export function findConfig(from = process.cwd()) {
  let dir = resolve(from);
  for (;;) {
    const candidate = join(dir, CONFIG_NAME);
    if (existsSync(candidate)) return candidate;
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

function readJson(path) {
  try {
    return { config: JSON.parse(readFileSync(path, 'utf8')), error: null };
  } catch (err) {
    return { config: null, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Load a project from its config path.
 *
 * <p>A config that will not parse still produces a context — with `config: null` and the
 * parse error on `parseError` — because a gate reporting "this file is not JSON" is more use
 * than a stack trace.
 */
export function loadProject(configPath, options = {}) {
  const abs = resolve(configPath);
  const root = dirname(dirname(abs));
  const { config, error } = readJson(abs);

  const declared = (key) => {
    const value = config?.[key];
    return value === undefined || value === null || value === '' ? null : value;
  };

  const inRoot = (value) => {
    if (typeof value !== 'string' || !value) return null;
    return isAbsolute(value) ? value : join(root, value);
  };

  const at = (key) => inRoot(declared(key));

  const read = (path) => {
    if (!path) return null;
    const target = isAbsolute(path) ? path : join(root, path);
    try {
      return readFileSync(target, 'utf8');
    } catch {
      return null;
    }
  };

  const list = (dir) => {
    if (!dir || !existsSync(dir)) return null;
    const out = [];
    const walk = (current) => {
      for (const entry of readdirSync(current, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        const full = join(current, entry.name);
        if (entry.isDirectory()) walk(full);
        else out.push(relative(dir, full));
      }
    };
    walk(dir);
    return out.sort();
  };

  const git = (args) => {
    try {
      const out = execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      return { ok: true, out };
    } catch (err) {
      return { ok: false, out: err?.stderr ? String(err.stderr) : String(err) };
    }
  };

  return {
    root,
    configPath: abs,
    config,
    parseError: error,
    options,
    declared,
    // The project's line grammar, compiled once. A gate reads `ctx.lines.persona` and never
    // imports the compiler: a project's own gate file cannot reach into the skill by path — the
    // skill is installed somewhere else on every machine — so what a gate needs arrives here.
    get lines() {
      const lines = compileLines(declared('chapterLines'));
      // Compiled by the same grammar and kept beside the chapter's own lines, because a check
      // reading a document reads all of them together. Absent where the project declares none.
      const deferred = declared('deferredLine');
      if (deferred) lines.deferred = compileLine(deferred, 'deferredLine');
      const placeholder = declared('placeholderLine');
      if (placeholder) lines.placeholder = compileLine(placeholder, 'placeholderLine');
      return lines;
    },
    // The readers over the evidence folder, bound to this repository. A project's own gate over
    // the same documents reaches them here for the same reason it reaches the line grammar here —
    // it cannot import the skill by path, and a second copy of a reader is a copy that drifts.
    get evidence() {
      return evidenceReaders(this);
    },
    at,
    inRoot,
    read,
    list,
    git,
    exists: (path) => Boolean(path) && existsSync(path),
    isDir: (path) => Boolean(path) && existsSync(path) && statSync(path).isDirectory(),
    // The bytes a file takes. `read` decodes utf8, and the length of that decoding is not the size
    // of a binary file — a capture measured that way comes out under any ceiling worth setting.
    size: (path) => {
      try {
        return statSync(path).size;
      } catch {
        return null;
      }
    },
    // The first `n` bytes of a file, undecoded. `read` decodes utf8 and `size` counts — neither
    // answers what a picture's header says, and an image's own width is the one fact about a
    // capture that survives the run that took it.
    bytes: (path, n) => {
      try {
        const buf = readFileSync(path);
        return n === undefined || buf.length <= n ? buf : buf.subarray(0, n);
      } catch {
        return null;
      }
    },
    rel: (path) => (path ? relative(root, path) || '.' : ''),
  };
}
