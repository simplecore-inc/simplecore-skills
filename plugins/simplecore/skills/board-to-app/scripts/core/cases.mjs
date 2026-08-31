// The defect each core gate exists to catch, and a project with nothing wrong with it.
//
// Both halves for every gate: a rule that fires on everything is as useless as one that fires
// on nothing, and neither announces itself from a green run.
import { cleanProject } from './harness.mjs';
import { cases as evidenceCases } from './evidence.mjs';
import { cases as eyesCases } from './eyes.mjs';
import { cases as vocabularyCases } from './vocabulary.mjs';
import { cases as budgetCases } from './budget.mjs';

/** Merge an override into the clean project without mutating it. */
function variant(over = {}) {
  const base = cleanProject();
  return {
    config: { ...base.config, ...(over.config ?? {}) },
    files: { ...base.files, ...(over.files ?? {}) },
    commits: over.commits ?? null,
    dirty: over.dirty ?? null,
    options: over.options ?? {},
  };
}

/**
 * Register every core case.
 *
 * @param t the registrar: `t.project(spec)` builds a fixture, `t.add(...)` records a case
 */
export function cases(t) {
  const add = (gate, name, spec, shouldFire) => t.add(gate, name, t.project(variant(spec)), shouldFire);
  evidenceCases(t);
  eyesCases(t);
  vocabularyCases(t);
  budgetCases(t);

  // configGate — the gate that makes "never guess a path" mechanical.
  add('configGate', 'a required key is not declared', { config: { boardRoot: undefined } }, true);
  add('configGate', 'a declared path that is not there', { config: { stateLedger: 'chapters/GONE.md' } }, true);
  add('configGate', 'a heading map missing a role', { config: { chapterHeadings: { prerequisites: 'Before' } } }, true);
  add('configGate', 'a key nobody reads', { config: { handOverFile: 'notes/HANDOVER.md' } }, true);
  add('configGate', 'an exception with no reason', { config: { disabledGates: [{ id: 'ledgerGate' }] } }, true);
  // A census entry naming no producing command is a file a person edits, and the whole reason the
  // subject is narrow is that such a file is dirty for ordinary reasons all day.
  add(
    'configGate',
    'a generated artefact with no command that writes it',
    { config: { generatedArtefacts: [{ path: 'build/board.html' }] } },
    true,
  );
  add(
    'configGate',
    'an artefact exempted from being committed with no reason given',
    { config: { generatedArtefacts: [{ path: 'pnpm-lock.yaml', by: 'pnpm install', neverCommitted: '' }] } },
    true,
  );
  add(
    'configGate',
    'a census naming each artefact and what writes it',
    {
      config: {
        generatedArtefacts: [
          { path: 'build/board.html', by: 'npm run build' },
          { path: 'pnpm-lock.yaml', by: 'pnpm install', neverCommitted: 'the local-link step rewrites it with absolute paths' },
        ],
      },
    },
    false,
  );
  // A vocabulary with an empty role matches nothing, and a check that matches nothing reports the
  // same zero as one with nothing to find — which is why an empty list is a finding rather than a
  // shorter list.
  // A label carrying its own emphasis is written into the documents with the markers and looked
  // for with them twice — every check over those documents then finds nothing and says nothing,
  // which is the silence the whole vocabulary arrangement exists to prevent.
  add(
    'configGate',
    'an evidence label declared with the markdown the checks add themselves',
    { config: { evidenceLabels: { did: '**What was done**', demanded: 'What was demanded', saw: 'What was seen' } } },
    true,
  );
  add(
    'configGate',
    'the same three labels as bare words',
    { config: { evidenceLabels: { did: 'What was done', demanded: 'What was demanded', saw: 'What was seen' } } },
    false,
  );
  // A project whose board gives every state a frame of its own writes no line listing states. It
  // says so rather than declaring a line no chapter contains — and it says why, because an
  // unexplained absence reads the same as one nobody noticed.
  add(
    'configGate',
    'a chapter line declared absent with no reason beside it',
    {
      config: {
        chapterLines: { persona: '**Test · {text}**…', verdict: '**Verdict**…', states: null },
      },
    },
    true,
  );
  add(
    'configGate',
    'the same role declared absent with the reason beside it',
    {
      config: {
        chapterLines: {
          persona: '**Test · {text}**…',
          verdict: '**Verdict**…',
          states: null,
          '//states': 'every state is a frame of its own here, so no line lists them',
        },
      },
    },
    false,
  );
  // Half of the eyes arrangement is a gap that reports as green: the documents are read and the
  // vocabulary that would find anything in them is not there, so the check matches nothing and
  // «nothing to find» and «no idea what to look for» come out as the same zero. Declaring neither
  // is the statement that the project has no such rules.
  add(
    'configGate',
    'the documents that hand checks to eyes, with no vocabulary to read them by',
    { config: { eyesDocuments: ['docs/OVERVIEW.md'] } },
    true,
  );
  add(
    'configGate',
    'the vocabulary with no documents to read',
    { config: { eyesPhrases: { assigns: ['stays with eyes'], reader: ['the coordinator'], moment: ['before '] } } },
    true,
  );
  add(
    'configGate',
    'both of them, together',
    {
      config: {
        eyesDocuments: ['docs/OVERVIEW.md'],
        eyesPhrases: { assigns: ['stays with eyes'], reader: ['the coordinator'], moment: ['before '] },
      },
    },
    false,
  );
  add(
    'configGate',
    'a phrase vocabulary with one of its roles empty',
    { config: { eyesDocuments: ['docs/OVERVIEW.md'], eyesPhrases: { assigns: ['stays with eyes'], reader: [], moment: ['before '] } } },
    true,
  );
  add(
    'configGate',
    'the same vocabulary with every role filled',
    { config: { eyesDocuments: ['docs/OVERVIEW.md'], eyesPhrases: { assigns: ['stays with eyes'], reader: ['the coordinator'], moment: ['before '] } } },
    false,
  );
  // An open vocabulary — the roles are the project's, so no name is refused, and the emptiness
  // checks still hold. Without the first of these a project's own words are refused one by one
  // as roles the skill does not know, which is what sent them to a file the config gate never read.
  add(
    'configGate',
    'a project names its own vocabulary roles',
    { config: { projectVocabulary: { failureWords: ['isError', 'refused'] } } },
    false,
  );
  add(
    'configGate',
    'an open vocabulary with an empty role',
    { config: { projectVocabulary: { failureWords: [] } } },
    true,
  );
  add(
    'configGate',
    'an open vocabulary that names no roles at all',
    { config: { projectVocabulary: {} } },
    true,
  );

  // The capture standard. The template ships its three fields as `<…>` placeholders on purpose:
  // a number left in place would become somebody's standard in silence, where a string is refused
  // here and named. A third colour scheme is refused for the same reason a fourth commit policy
  // is — it reads as a decision and nothing can be set to it or read back as it.
  add(
    'configGate',
    'the capture standard with its template placeholders still in it',
    { config: { captureStandard: { width: '<CSS pixels the board is drawn at>', height: '<CSS pixels>', colorScheme: '<light or dark>' } } },
    true,
  );
  add(
    'configGate',
    'the same standard filled in',
    { config: { captureStandard: { width: 1440, height: 1200, colorScheme: 'light' } } },
    false,
  );
  add(
    'configGate',
    'a colour scheme that is neither of the two',
    { config: { captureStandard: { width: 1440, height: 1200, colorScheme: 'no-preference' } } },
    true,
  );
  add(
    'configGate',
    'a second device width beside the first',
    {
      config: {
        captureStandard: [
          { width: 1440, height: 1200, colorScheme: 'light' },
          { width: 768, height: 1024, colorScheme: 'light' },
        ],
      },
    },
    false,
  );
  // An empty array is not «this project has no standard» — that is said by leaving the key out,
  // and the difference is a cost stated in a row against a cost paid in silence.
  add('configGate', 'the standard declared as an empty array', { config: { captureStandard: [] } }, true);
  add(
    'configGate',
    'a field of the standard nobody reads',
    { config: { captureStandard: { width: 1440, height: 1200, colorScheme: 'light', scale: 2 } } },
    true,
  );
  // Half a capture split named is a project that thought about one side of it. The taker runs on
  // the cheap model and the judge inherits whatever the harness gives, which is the arrangement
  // paying more on exactly the half that was supposed to cost less.
  add('configGate', 'the taker\'s model named and the judge\'s left out', { config: { captureTakerModel: 'sonnet' } }, true);
  add('configGate', 'the judge\'s model named and the taker\'s left out', { config: { captureJudgeModel: 'opus' } }, true);
  add(
    'configGate',
    'both halves of the capture split named',
    { config: { captureTakerModel: 'sonnet', captureJudgeModel: 'opus' } },
    false,
  );
  // What drives a browser is an ORDER, so it is a list — one name declared as a bare string is a
  // project that has named a driver and said nothing about what happens when it cannot express
  // the task, which is the whole reason the key is ordered.
  add('configGate', 'a driver order declared as one name rather than a list', { config: { browserDrivers: 'agent-browser' } }, true);
  add(
    'configGate',
    'the drivers declared in the order the run takes them',
    { config: { browserDrivers: ['agent-browser', 'playwright'], deviceDrivers: ['agent-device'] } },
    false,
  );
  add('configGate', 'everything declared and everything there', {}, false);

  // commitPolicyGate — whether the build may commit is the project's answer, and a word outside
  // the three reads as an answer while being followed by nobody.
  add('commitPolicyGate', 'a policy word the build cannot act on', { config: { commitPolicy: 'yes' } }, true);
  add('commitPolicyGate', 'a policy that only differs in case', { config: { commitPolicy: 'Commit' } }, true);
  add('commitPolicyGate', 'the build may commit as the work lands', { config: { commitPolicy: 'commit' } }, false);
  add('commitPolicyGate', 'the build stops and asks', { config: { commitPolicy: 'ask' } }, false);
  add('commitPolicyGate', 'the build commits and pushes', { config: { commitPolicy: 'commitAndPush' } }, false);
  add(
    'configGate',
    'every optional key declared, and well formed',
    {
      config: {
        boardRoles: 'board/roles.mjs',
        chapterGenerator: 'node tools/generate.mjs',
        chapterHeadings: {
          prerequisites: 'Before this',
          parallelWith: 'Alongside',
          creates: 'What this makes',
          entities: 'Entities',
          usedLater: 'Used later by',
          promises: 'Promised screens',
          touchedEarlier: 'Earlier chapters touched',
        },
        openItemsFile: 'notes/OPEN.md',
        openItemsHeading: 'Parked decisions',
        gates: ['npm test'],
        auditScript: 'tools/audit.mjs',
        migrationDir: 'db',
        frameDeliverables: ['a capture in every locale'],
        factSources: ['korean-law'],
        storyDocument: 'notes/STORY.md',
        locales: ['ko', 'en'],
        pseudoLocale: 'en-XA',
        captureRoute: '/frame/<id>',
        logDir: '.build-logs',
        capturesDir: 'shots',
        costLog: 'notes/cost.jsonl',
        narrativePhrases: ['ich fand'],
        disabledGates: [{ id: 'trailerGate', reason: 'this repository squashes on merge' }],
      },
      files: {
        'board/roles.mjs': 'export const roles = [];\n',
        'notes/OPEN.md': '# Open\n\n## Parked decisions\n',
        'notes/STORY.md': '# Story\n',
        'tools/audit.mjs': '// audit\n',
        'db/': '',
      },
    },
    false
  );

  // A key whose subject is one file in one project and a family of them in the next.
  add(
    'configGate',
    'the detection rules live in a directory of their own',
    {
      config: { auditScript: 'tools/checks' },
      files: { 'tools/checks/check-copy.mjs': '// one of a family\n' },
    },
    false
  );
  add(
    'configGate',
    'the detection rules point at neither a file nor a directory',
    { config: { auditScript: 'tools/checks' } },
    true
  );

  // A key a project can genuinely hold more than one of — a database with several lineages.
  add(
    'configGate',
    'every migration lineage declared, and every one of them there',
    {
      config: { migrationDir: ['db/main', 'db/audit', 'db/vault'] },
      files: { 'db/main/': '', 'db/audit/': '', 'db/vault/': '' },
    },
    false
  );
  add(
    'configGate',
    'one of the declared migration lineages is not there',
    {
      config: { migrationDir: ['db/main', 'db/vault'] },
      files: { 'db/main/': '' },
    },
    true
  );
  add(
    'configGate',
    'a migration lineage that is not a path at all',
    { config: { migrationDir: ['db/main', 7] }, files: { 'db/main/': '' } },
    true
  );

  add(
    'configGate',
    'a deferral for a key nobody reads',
    { config: { deferredKeys: { migrationsDir: { chapter: 'W02', whenExists: 'db' } } } },
    true
  );
  add(
    'configGate',
    'a required key promised to a chapter',
    { config: { deferredKeys: { chapterOverview: { chapter: 'W02', whenExists: 'db' } } } },
    true
  );
  add(
    'configGate',
    'a deferral that names no path',
    { config: { deferredKeys: { migrationDir: { chapter: 'W02' } } } },
    true
  );
  add(
    'configGate',
    'a key declared and still promised',
    {
      config: {
        migrationDir: 'db',
        deferredKeys: { migrationDir: { chapter: 'W02', whenExists: 'db' } },
      },
      files: { 'db/': '' },
    },
    true
  );
  add(
    'configGate',
    'a promise naming its chapter and the path that makes it due',
    { config: { deferredKeys: { migrationDir: { chapter: 'W02', whenExists: 'backend/db/migration' } } } },
    false
  );

  // deferredKeyGate — the subject exists, so the key is owed now.
  add(
    'deferredKeyGate',
    'the subject is on disk and the key is still absent',
    {
      config: { deferredKeys: { migrationDir: { chapter: 'W02', whenExists: 'backend/db/migration' } } },
      files: { 'backend/db/migration/': '' },
    },
    true
  );
  add(
    'deferredKeyGate',
    'the chapter that creates the subject has not run yet',
    { config: { deferredKeys: { migrationDir: { chapter: 'W02', whenExists: 'backend/db/migration' } } } },
    false
  );
  add(
    'deferredKeyGate',
    'the subject exists and the key was declared with it',
    {
      config: {
        migrationDir: 'backend/db/migration',
        deferredKeys: { captureRoute: { chapter: 'W04', whenExists: 'frontend/src/routes' } },
      },
      files: { 'backend/db/migration/': '' },
    },
    false
  );

  // handoverGate — facts, never somebody's account of finding them.
  add(
    'handoverGate',
    'a fact written from a point of view',
    { files: { 'notes/HANDOVER.md': '# Handover\n\n이번에 서버를 올려 보니 포트가 3000이었다.\n' } },
    true
  );
  add(
    'handoverGate',
    'the same phrase quoted as the rule about it',
    {
      files: {
        'notes/HANDOVER.md':
          '# Handover\n\nThe server starts on port 3000.\n\nNever write `이번에` here — state the fact.\n\n```\nI found the port was 3000\n```\n',
      },
    },
    false
  );

  // openItemsGate — a parked line the next session can act on.
  const parked = {
    config: { openItemsFile: 'notes/OPEN.md', openItemsHeading: 'Parked decisions' },
  };
  add(
    'openItemsGate',
    'the heading is gone',
    { ...parked, files: { 'notes/OPEN.md': '# Open\n\n- C-07 — the API reverses one at a time — board looks stale\n' } },
    true
  );
  add(
    'openItemsGate',
    'a line with no shape',
    { ...parked, files: { 'notes/OPEN.md': '# Open\n\n## Parked decisions\n\n- ask somebody about the bulk reverse\n' } },
    true
  );
  add(
    'openItemsGate',
    'the heading and the shape both there',
    {
      ...parked,
      files: {
        'notes/OPEN.md':
          '# Open\n\n## Parked decisions\n\n- C-07 — board draws a bulk reverse; the API reverses one at a time — board looks stale\n- D-02 — needs a role no environment has — blocked, not stale\n',
      },
    },
    false
  );
  // A file appended to without a closing newline fuses the new item onto the tail of the last
  // line. Every line that starts with a bullet still has its shape, so the shape check passes and
  // the item is simply not there.
  add(
    'openItemsGate',
    'an item fused onto the end of the line before it',
    {
      ...parked,
      files: {
        'notes/OPEN.md':
          '# Open\n\n## Parked decisions\n\n- C-07 — the API reverses one at a time — board looks stale- D-02 — needs a role no environment has — blocked, not stale\n',
      },
    },
    true
  );
  // A hyphen inside a parked line's own prose is not a stray item: what follows it is not a token,
  // a dash and text. Refusing this one would make the check unusable on the lines it guards.
  add(
    'openItemsGate',
    'a hyphen in the prose of a well-placed item',
    {
      ...parked,
      files: {
        'notes/OPEN.md':
          '# Open\n\n## Parked decisions\n\n- C-07 — the 2026-08-27 run and its no-tty-long-running rule — board looks stale\n',
      },
    },
    false
  );
  // The declaration carries the heading's text, and a fragment of it names no heading anybody
  // wrote — accepted, it would satisfy the gate while pointing at whichever heading happens to
  // contain the fragment.
  add(
    'openItemsGate',
    'the declaration is only part of the heading',
    {
      config: { openItemsFile: 'notes/OPEN.md', openItemsHeading: 'Parked' },
      files: {
        'notes/OPEN.md':
          '# Open\n\n## Parked decisions\n\n- C-07 — board draws a bulk reverse — board looks stale\n',
      },
    },
    true
  );
  // The same rule read from the other side: a document holding two headings, one of which
  // contains the other. The exact declaration reads the section it named, not the earlier
  // heading that merely spans it — which is the half `sectionUnder` decides rather than
  // `hasHeading`.
  add(
    'openItemsGate',
    'an earlier heading that contains the declared one',
    {
      ...parked,
      files: {
        'notes/OPEN.md':
          '# Open\n\n## Parked decisions, resolved\n\n- settled last week by the operator\n\n## Parked decisions\n\n- C-07 — board draws a bulk reverse — board looks stale\n',
      },
    },
    false
  );

  // ledgerGate — a chapter the ledger does not name is built twice or not at all.
  add('ledgerGate', 'a chapter with no row', { files: { 'chapters/w02-people.md': '# W02\n' } }, true);
  add(
    'ledgerGate',
    'every chapter named',
    {
      files: {
        'chapters/w02-people.md': '# W02\n',
        'chapters/STATE.md': '# State\n\n| w01 | closed |\n| w02 | open |\n',
      },
    },
    false
  );

  // capturesGate — where a picture sits and the shape of its name. Not what the name SAYS: the
  // variant's words are the project's own vocabulary and its own checker's to hold.
  const shots = { config: { capturesDir: 'shots' } };
  const spoken = { config: { capturesDir: 'shots', locales: ['ko', 'en'], pseudoLocale: 'en-XA' } };
  add(
    'capturesGate',
    'a folder that is not one of the declared languages',
    { ...spoken, files: { 'shots/wide/20260815-1130-A-01.png': '' } },
    true
  );
  add(
    'capturesGate',
    'a chapter is the other thing a capture is grouped by',
    { ...spoken, files: { 'shots/w02/20260815-1130-A-01.png': '' } },
    false
  );
  add(
    'capturesGate',
    'a chapter narrowed to one part of a sweep',
    { ...spoken, files: { 'shots/w02-n/20260815-1130-A-01.png': '' } },
    false
  );
  add(
    'capturesGate',
    'the pseudo locale is a language',
    { ...spoken, files: { 'shots/en-XA/20260815-1130-A-01.png': '' } },
    false
  );
  add(
    'capturesGate',
    'a variant naming anything at all passes — the words are the project\'s',
    { ...spoken, files: { 'shots/ko/20260815-1130-A-01-dark-scrolled-700.png': '' } },
    false
  );
  add(
    'capturesGate',
    'a picture with no language folder',
    { ...shots, files: { 'shots/A-01.png': '' } },
    true
  );
  // The container is the project's, not this gate's. A project encoding to fit a size bound writes
  // `webp`, and `evidence.mjs` accepts `webp` for the very same pictures once they are curated —
  // so naming one format here made one skill demand two names for one file.
  add(
    'capturesGate',
    'the same name in the container a size-bounded project encodes to',
    { ...spoken, files: { 'shots/w02/20260815-1130-A-01.webp': '' } },
    false
  );
  add(
    'capturesGate',
    'a container nobody encodes a capture to',
    { ...spoken, files: { 'shots/w02/20260815-1130-A-01.tiff': '' } },
    true
  );
  // The shape still holds whatever the container is: a picture named for its frame alone cannot say
  // which round took it, and a round taken before a fix looks exactly like one taken after.
  add(
    'capturesGate',
    'a frame id with no timestamp, in an accepted container',
    { ...spoken, files: { 'shots/w02/a-01-empty.webp': '' } },
    true
  );
  add(
    'capturesGate',
    'a name with no moment in it',
    { ...shots, files: { 'shots/ko/A-01.png': '' } },
    true
  );
  add(
    'capturesGate',
    'a folder inside the language folder',
    { ...shots, files: { 'shots/ko/wide/20260815-1130-A-01.png': '' } },
    true
  );
  add(
    'capturesGate',
    'named the one way',
    {
      ...shots,
      files: {
        'shots/ko/20260815-1130-A-01.png': '',
        'shots/en/20260815-1130-A-01-wide.png': '',
      },
    },
    false
  );

  // trailerGate — the history is read as a tree or not at all.
  add('trailerGate', 'a commit that names no chapter', { commits: ['feat(screens): the roster list'] }, true);
  add(
    'trailerGate',
    'a Touches line that names nothing',
    { commits: ['feat(screens): the roster list\n\nChapter: W15\nTouches:'] },
    true
  );
  add(
    'trailerGate',
    'both trailers well formed',
    { commits: ['feat(screens): the roster list\n\nChapter: W15\nTouches: W11 W12'] },
    false
  );
  // The defect a line-by-line reader is green over: a census whose names ran past the margin and
  // wrapped at column 0. git discards the WHOLE block, so `%(trailers:key=Chapter)` is empty for a
  // commit whose `Chapter:` line any person can read — and the trailer's one job is to answer that
  // query. Two commits in one repository sat this way with every gate green over both.
  add(
    'trailerGate',
    'a census wrapped onto a second line, which makes git discard the whole block',
    {
      commits: [
        'fix(copy): the sign-in identifier is a mail address\n\nChapter: W15\nTouches: W11\n'
        + 'Census: 4 board frames, 22 sites in 8 files outside them — the console catalogue and its\n'
        + 'tests, the server catalogue, the manual, the overview',
      ],
    },
    true
  );
  // The same census, wrapped under an indent — git folds it back onto its trailer, so the block
  // parses and the chapter is readable. Without this case the fix reads as 「refuse long censuses」,
  // which is the wrong lesson and the one both agents who met this reached for first.
  add(
    'trailerGate',
    'the same census folded under an indent, which git reads',
    {
      commits: [
        'fix(copy): the sign-in identifier is a mail address\n\nChapter: W15\nTouches: W11\n'
        + 'Census: 4 board frames, 22 sites in 8 files outside them — the console catalogue and its\n'
        + '  tests, the server catalogue, the manual, the overview',
      ],
    },
    false
  );
  // A line whose key carries a space is not a trailer either, and it ends the block exactly as a
  // column-0 wrap does — same defect, different-looking message.
  add(
    'trailerGate',
    'a measurement line whose key has spaces in it',
    {
      commits: [
        'fix(identity): a step-up refusal pays what a wrong password pays\n\nChapter: W15\n'
        + 'Measured and clean: invitation token 1.78ms, API key 7.92ms',
      ],
    },
    true
  );
  // The trailers below a closing paragraph: git reads the LAST paragraph, so they are outside the
  // block altogether. A line-by-line reader finds `Chapter:` and reports nothing.
  add(
    'trailerGate',
    'trailers written above the message\'s last paragraph',
    {
      commits: [
        'feat(screens): the roster list\n\nChapter: W15\nTouches: W11\n\nOne more thing worth saying.',
      ],
    },
    true
  );
  // A `Touches:` that fell outside the block while the `Chapter:` is fine — the node keeps its
  // place in the tree and loses its edges, which is the half a reader would otherwise not be told.
  add(
    'trailerGate',
    'a Touches line git reads no chapters out of',
    {
      commits: [
        'feat(screens): the roster list\n\nChapter: W15\n\nTouches: W11 W12\nand a wrapped tail',
      ],
    },
    true
  );

  // censusCountsBothSides — a global change is verified by a sample plus a census, and a census
  // that counted only the sites it expected to find is the half that never happened. The sample
  // proves the mechanism; only the census reaches a site that has no instance of the mechanism at
  // all, which is exactly the site a hand-rolled dialog is.
  add(
    'censusCountsBothSides',
    'a census stating how many sites reach the mechanism and not how many do not',
    { commits: ['fix(ui): label the dialog close button\n\nChapter: W22\nCensus: the shared confirm dialog — 26 through'] },
    true
  );
  add(
    'censusCountsBothSides',
    'a census that found sites outside the mechanism and named none of them',
    { commits: ['fix(ui): label the dialog close button\n\nChapter: W22\nCensus: the shared confirm dialog — 26 through, 2 outside'] },
    true
  );
  add(
    'censusCountsBothSides',
    'a census with nothing after the colon',
    { commits: ['fix(ui): label the dialog close button\n\nChapter: W22\nCensus:'] },
    true
  );
  add(
    'censusCountsBothSides',
    'both counts, with the sites outside the mechanism named',
    {
      commits: [
        'fix(ui): label the dialog close button\n\nChapter: W22\n'
        + 'Census: the shared confirm dialog — 26 through, 2 outside: DocumentPurgeDialog PermitRevokeDialog',
      ],
    },
    false
  );
  // Nothing outside the mechanism is a census that is finished at the second number. Requiring
  // names there would make the commonest correct answer the one shape nobody can write.
  add(
    'censusCountsBothSides',
    'both counts, with nothing outside the mechanism to name',
    { commits: ['fix(ui): label the dialog close button\n\nChapter: W22\nCensus: the shared confirm dialog — 26 through, 0 outside'] },
    false
  );
  add(
    'censusCountsBothSides',
    'a commit that claims no census',
    { commits: ['feat(screens): the roster list\n\nChapter: W15'] },
    false
  );

  // importsTravelWithTheirCommit — the registry two people edit, and the module only one of them
  // committed. The broken form is not hypothetical: it is what a real commit here did, and the
  // reason a pull could not load the gate set it had just been handed.
  const REGISTRY = "import * as one from './gates/one.mjs';\nexport const gates = [one];\n";
  const MODULE = 'export const gates = [];\n';
  add(
    'importsTravelWithTheirCommit',
    'a registry entry whose module the commit leaves behind',
    { commits: [{ message: 'feat: register the gate\n\nChapter: none', files: { 'gates.mjs': REGISTRY } }] },
    true
  );
  add(
    'importsTravelWithTheirCommit',
    'the same entry with its module beside it',
    {
      commits: [{
        message: 'feat: register the gate\n\nChapter: none',
        files: { 'gates.mjs': REGISTRY, 'gates/one.mjs': MODULE },
      }],
    },
    false
  );
  // A module committed earlier is in the tree and resolves — the rule reads the tree at the
  // commit, never the commit's own list of files.
  add(
    'importsTravelWithTheirCommit',
    'a module an earlier commit already carried',
    {
      commits: [
        { message: 'feat: the gate\n\nChapter: none', files: { 'gates/one.mjs': MODULE } },
        { message: 'feat: register it\n\nChapter: none', files: { 'gates.mjs': REGISTRY } },
      ],
    },
    false
  );
  // A specifier with no extension is a resolution, not a lookup: the same entry written the way a
  // TypeScript project writes it must not be reported for the extension it leaves off.
  add(
    'importsTravelWithTheirCommit',
    'an extensionless specifier resolving to a file the commit carries',
    {
      commits: [{
        message: 'feat: register the gate\n\nChapter: none',
        files: { 'gates.ts': "import { one } from './gates/one';\nexport const gates = [one];\n", 'gates/one.ts': MODULE },
      }],
    },
    false
  );
  // The file that teaches the rule is the one most likely to trip it: a case fixture holds
  // specimen source in backticks, and the import inside it names nothing the repository has.
  add(
    'importsTravelWithTheirCommit',
    'a specimen import inside a template literal',
    {
      commits: [{
        message: 'feat: a case for the gate\n\nChapter: none',
        files: { 'cases.mjs': 'export const BROKEN = `import { x } from "./nowhere";`;\n' },
      }],
    },
    false
  );
  // The same specimen in ordinary quotes, which is how a fixture map writes one file per key. The
  // template-literal form above was already skipped and this one was not, so a project writing its
  // first case for its own gates met a finding about an import it had not written.
  add(
    'importsTravelWithTheirCommit',
    'a specimen import inside a quoted string',
    {
      commits: [{
        message: 'feat: a case for the gate\n\nChapter: none',
        files: {
          'cases.mjs':
            'export const FIXTURES = {\n'
            + '  \'src/x.ts\': "import { y } from \'./y\';\\n",\n'
            + '  \'src/z.ts\': \'import { w } from "./w";\\n\',\n'
            + '};\n',
        },
      }],
    },
    false
  );
  // generatedArtefactsMatchHead — every gate reads the working tree, and a chapter closes on the
  // commit. The census is the subject, so the pair below is really two pairs: the artefact, and
  // the boundary that keeps the rule off every file a person is in the middle of editing.
  const ARTEFACT = [{ path: 'build/board.html', by: 'npm run build' }];
  const BUILT = 'feat: the built board\n\nChapter: none';
  // The pseudo-locale sighting, and the codegen one: somebody regenerated, the gate that reads the
  // output went green, and the output never reached a commit.
  add(
    'generatedArtefactsMatchHead',
    'an artefact regenerated in the tree and left out of the commit',
    {
      config: { generatedArtefacts: ARTEFACT },
      commits: [{ message: BUILT, files: { 'build/board.html': '<board>one</board>\n' } }],
      dirty: { 'build/board.html': '<board>two</board>\n' },
    },
    true,
  );
  add(
    'generatedArtefactsMatchHead',
    'an artefact the tree holds and no commit carries',
    {
      config: { generatedArtefacts: ARTEFACT },
      commits: [{ message: 'feat: the source\n\nChapter: none', files: { 'src/board.mjs': 'export const frames = [];\n' } }],
      dirty: { 'build/board.html': '<board/>\n' },
    },
    true,
  );
  add(
    'generatedArtefactsMatchHead',
    'an artefact HEAD carries and the tree no longer has',
    {
      config: { generatedArtefacts: ARTEFACT },
      commits: [{ message: BUILT, files: { 'build/board.html': '<board/>\n' } }],
      dirty: { 'build/board.html': null },
    },
    true,
  );
  // A row that matches nothing git has ever carried reads as coverage and holds nothing, which is
  // the state the whole key exists to end — so it is a finding rather than an inherited pass.
  add(
    'generatedArtefactsMatchHead',
    'a row naming a path git has never carried',
    {
      config: { generatedArtefacts: [{ path: 'build/moved-away.html', by: 'npm run build' }] },
      commits: [{ message: BUILT, files: { 'build/board.html': '<board/>\n' } }],
    },
    true,
  );
  add(
    'generatedArtefactsMatchHead',
    'the artefact committed and current',
    {
      config: { generatedArtefacts: ARTEFACT },
      commits: [{ message: BUILT, files: { 'build/board.html': '<board/>\n' } }],
    },
    false,
  );
  // The escape, exercised while the file is genuinely dirty — a lock file a local-link step
  // rewrites is dirty on every machine that ran it, and a gate with no way to say so is one
  // somebody turns off within a day.
  add(
    'generatedArtefactsMatchHead',
    'a dirty artefact the project says is never committed',
    {
      config: {
        generatedArtefacts: [{
          path: 'pnpm-lock.yaml',
          by: 'pnpm install',
          neverCommitted: 'the local-link step rewrites it with absolute paths under one machine home directory',
        }],
      },
      commits: [{ message: 'chore: the lock file\n\nChapter: none', files: { 'pnpm-lock.yaml': 'lockfileVersion: 9\n' } }],
      dirty: { 'pnpm-lock.yaml': 'lockfileVersion: 9\nlinked: true\n' },
    },
    false,
  );
  // The boundary, and the case that makes the gate affordable at all: an agent mid-task has
  // uncommitted work by construction. A rule over every dirty file would fire on all of it — and
  // under a write-time hook that fails a write when an error names the file just written, it would
  // fail every write the moment it happened.
  add(
    'generatedArtefactsMatchHead',
    'a source file being edited, which no command writes',
    {
      config: { generatedArtefacts: ARTEFACT },
      commits: [{
        message: BUILT,
        files: { 'build/board.html': '<board/>\n', 'src/board.mjs': 'export const frames = [];\n' },
      }],
      dirty: { 'src/board.mjs': "export const frames = ['a-01'];\n" },
    },
    false,
  );
}
