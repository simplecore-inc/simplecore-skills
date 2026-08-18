// The project a build runs in, as the gates see it: the declared config, resolved paths, and
// the few readers a gate is allowed to use.
//
// Everything a gate knows about a project comes through here, so a gate never joins paths
// itself and never guesses one. A key the project did not declare resolves to null, and the
// gate that needs it is skipped rather than run against an invented path.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

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
 */
export const SCHEMA = {
  boardRoot: { kind: 'dir', required: true },
  boardManifest: { kind: 'file', required: true },
  boardRoles: { kind: 'file' },
  chapterDir: { kind: 'dir', required: true },
  chapterOverview: { kind: 'file', required: true },
  chapterGenerator: { kind: 'command' },
  chapterHeadings: { kind: 'headings' },
  // Where a chapter's verification result and the captures it cites are written. **Not required to
  // configure and required to close** — a project builds screens without it and cannot finish a
  // chapter, which is the difference `required` alone could not express and `doctor` reported as an
  // ordinary blank. A board-to-app project that had every key green closed one chapter of
  // thirty-six, on five checks out of six, with no evidence folder at all.
  evidenceDir: { kind: 'dir', closing: true },
  stateLedger: { kind: 'file', required: true },
  handoverFile: { kind: 'file', required: true },
  openItemsFile: { kind: 'file' },
  openItemsHeading: { kind: 'text', requiredWith: 'openItemsFile' },
  gates: { kind: 'list', closing: true },
  auditScript: { kind: 'path' },
  migrationDir: { kind: 'dir', many: true },
  frameDeliverables: { kind: 'list' },
  factSources: { kind: 'list' },
  storyDocument: { kind: 'file' },
  locales: { kind: 'list' },
  pseudoLocale: { kind: 'text' },
  captureRoute: { kind: 'text' },
  logDir: { kind: 'outdir' },
  capturesDir: { kind: 'outdir' },
  costLog: { kind: 'outfile' },
  narrativePhrases: { kind: 'list' },
  projectGates: { kind: 'file' },
  disabledGates: { kind: 'exceptions' },
  deferredKeys: { kind: 'deferrals' },
};

/** The roles `chapterHeadings` maps, so nothing in the skill has to know one project's wording. */
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
    at,
    inRoot,
    read,
    list,
    git,
    exists: (path) => Boolean(path) && existsSync(path),
    isDir: (path) => Boolean(path) && existsSync(path) && statSync(path).isDirectory(),
    rel: (path) => (path ? relative(root, path) || '.' : ''),
  };
}
