// The defect each core gate exists to catch, and a project with nothing wrong with it.
//
// Both halves for every gate: a rule that fires on everything is as useless as one that fires
// on nothing, and neither announces itself from a green run.
import { cleanProject } from './harness.mjs';

/** Merge an override into the clean project without mutating it. */
function variant(over = {}) {
  const base = cleanProject();
  return {
    config: { ...base.config, ...(over.config ?? {}) },
    files: { ...base.files, ...(over.files ?? {}) },
    commits: over.commits ?? null,
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

  // configGate — the gate that makes "never guess a path" mechanical.
  add('configGate', 'a required key is not declared', { config: { boardRoot: undefined } }, true);
  add('configGate', 'a declared path that is not there', { config: { stateLedger: 'chapters/GONE.md' } }, true);
  add('configGate', 'a heading map missing a role', { config: { chapterHeadings: { prerequisites: 'Before' } } }, true);
  add('configGate', 'a key nobody reads', { config: { handOverFile: 'notes/HANDOVER.md' } }, true);
  add('configGate', 'an exception with no reason', { config: { disabledGates: [{ id: 'ledgerGate' }] } }, true);
  add('configGate', 'everything declared and everything there', {}, false);
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

  // capturesGate — the name is not the project's to choose.
  const shots = { config: { capturesDir: 'shots' } };
  add(
    'capturesGate',
    'a picture with no language folder',
    { ...shots, files: { 'shots/A-01.png': '' } },
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
}
