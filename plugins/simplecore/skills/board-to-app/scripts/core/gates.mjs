// Every gate that holds on any project built from a board, and the resolver that adds a
// project's own.
//
// A gate is `{ id, title, needs, run(ctx) → string[] }`. It finds and describes; it never
// prints and never exits, so the same gate runs from the command line, from a case in the
// harness, and from anywhere else that has a context.
//
// **Which level a gate belongs to is the design decision, and there are two levels here:**
//
//   core     — true of any project that builds from a board: the config's own shape, the two
//              documents' discipline, the fixed capture name, the commit trailers
//   project  — true of this product only: a gate that parses a document format this project
//              chose, or knows its own data shapes → the module `projectGates` names
//
// A gate put one level too high fires on projects it does not describe; one level too low is
// rewritten by the next project that needs it. The test is whether it would still be right in
// somebody else's repository.
import { pathToFileURL } from 'node:url';
import { HEADING_ROLES, SCHEMA, isPathKey } from './context.mjs';
import { NARRATIVE_PHRASES, hasHeading, onlyQuoted, proseLines, sectionUnder } from './prose.mjs';

const TYPE_OF = {
  dir: 'a path',
  file: 'a path',
  outdir: 'a path',
  outfile: 'a path',
  command: 'a command line',
  text: 'a non-empty string',
  list: 'an array',
  headings: 'an object of role → heading',
  exceptions: 'an array of { id, reason }',
  deferrals: 'an object of key → { chapter, whenExists }',
};

/**
 * The config is complete, well typed, and every path it declares is there.
 *
 * <p>This is the gate that makes 「never guess a path」 mechanical: a required key that is
 * absent, or a declared path that does not exist, is reported here rather than discovered
 * halfway through a chapter.
 */
export const configGate = {
  id: 'configGate',
  title: 'the declared config is incomplete, mistyped, or points at nothing',
  needs: [],
  run: (ctx) => {
    if (ctx.parseError) return [`${ctx.rel(ctx.configPath)}: not valid JSON — ${ctx.parseError}`];
    if (!ctx.config || typeof ctx.config !== 'object' || Array.isArray(ctx.config)) {
      return [`${ctx.rel(ctx.configPath)}: the config must be a JSON object`];
    }

    const findings = [];
    for (const [key, spec] of Object.entries(SCHEMA)) {
      const raw = ctx.config[key];
      const value = ctx.declared(key);

      if (value === null) {
        if (spec.required) {
          findings.push(`${key} is required and is not declared — name what it points at, never a guessed path`);
        } else if (spec.requiredWith && ctx.declared(spec.requiredWith) !== null) {
          findings.push(`${key} is required once ${spec.requiredWith} is set — the config is incomplete`);
        }
        if (raw !== undefined && raw !== null && raw !== '') {
          findings.push(`${key}: declared as ${JSON.stringify(raw)}, which declares nothing`);
        }
        continue;
      }

      if (spec.kind === 'list') {
        if (!Array.isArray(value)) findings.push(`${key} must be ${TYPE_OF.list}`);
        continue;
      }
      if (spec.kind === 'exceptions') {
        if (!Array.isArray(value)) {
          findings.push(`${key} must be ${TYPE_OF.exceptions}`);
          continue;
        }
        value.forEach((entry, i) => {
          if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || typeof entry.reason !== 'string' || !entry.reason.trim()) {
            findings.push(`${key}[${i}] must name an id and the reason it is off — an exception a reader cannot question is an omission`);
          }
        });
        continue;
      }
      if (spec.kind === 'deferrals') {
        if (typeof value !== 'object' || Array.isArray(value)) {
          findings.push(`${key} must be ${TYPE_OF.deferrals}`);
          continue;
        }
        for (const [name, entry] of Object.entries(value)) {
          if (!(name in SCHEMA)) {
            findings.push(`${key}.${name} is not a key this skill reads — a deferral for a key nobody reads is never due`);
            continue;
          }
          if (SCHEMA[name].required) {
            findings.push(`${key}.${name} is required — a required key is declared before the build starts, never promised to a chapter`);
            continue;
          }
          if (ctx.declared(name) !== null) {
            findings.push(`${key}.${name} is declared and still listed as deferred — the promise is deleted in the change that keeps it`);
            continue;
          }
          const ok =
            entry && typeof entry === 'object' && !Array.isArray(entry) &&
            typeof entry.chapter === 'string' && entry.chapter.trim() &&
            typeof entry.whenExists === 'string' && entry.whenExists.trim();
          if (!ok) {
            findings.push(
              `${key}.${name} names the chapter that creates its subject and the path whose appearance makes it due — { "chapter": …, "whenExists": … }`
            );
          }
        }
        continue;
      }
      if (spec.kind === 'headings') {
        if (typeof value !== 'object' || Array.isArray(value)) {
          findings.push(`${key} must be ${TYPE_OF.headings}`);
          continue;
        }
        for (const role of HEADING_ROLES) {
          const heading = value[role];
          if (typeof heading !== 'string' || !heading.trim()) {
            findings.push(`${key}.${role} names no heading — a section named by role that no heading matches stops an agent`);
          }
        }
        for (const role of Object.keys(value)) {
          if (!HEADING_ROLES.includes(role)) findings.push(`${key}.${role} is not a role this skill knows`);
        }
        continue;
      }
      if (typeof value !== 'string') {
        findings.push(`${key} must be ${TYPE_OF[spec.kind]}`);
        continue;
      }

      if (isPathKey(key)) {
        const path = ctx.at(key);
        if (spec.kind === 'dir' && !ctx.isDir(path)) {
          findings.push(`${key} → ${value}: no such directory`);
        } else if (spec.kind === 'file' && !ctx.exists(path)) {
          findings.push(`${key} → ${value}: no such file`);
        } else if (spec.kind === 'outfile') {
          const parent = path.slice(0, path.lastIndexOf('/'));
          if (!ctx.isDir(parent)) findings.push(`${key} → ${value}: the directory it is written into does not exist`);
        }
      }
    }

    for (const key of Object.keys(ctx.config)) {
      if (key in SCHEMA || key.startsWith('//')) continue;
      findings.push(`${key} is not a key this skill reads — a mistyped key is silent; a note starts with //`);
    }
    return findings;
  },
};

/**
 * A key the config promised to a chapter is declared once that chapter has created its subject.
 *
 * <p>An optional key left out because there is nothing to point at yet reads exactly like one
 * the project decided against, and the moment the subject appears is not announced by anything:
 * the cost in that key's row starts being paid in silence, chapter after chapter. The deferral
 * names the path whose appearance makes the key due, so the moment is a fact on disk rather
 * than something somebody has to remember.
 */
export const deferredKeyGate = {
  id: 'deferredKeyGate',
  title: 'a key whose subject now exists and is still not declared',
  needs: ['deferredKeys'],
  run: (ctx) => {
    const deferrals = ctx.declared('deferredKeys');
    if (typeof deferrals !== 'object' || Array.isArray(deferrals)) return [];
    const findings = [];
    for (const [key, entry] of Object.entries(deferrals)) {
      // Anything malformed here is configGate's finding, and reporting it twice helps nobody.
      if (!(key in SCHEMA) || SCHEMA[key].required || ctx.declared(key) !== null) continue;
      const when = entry && typeof entry === 'object' ? entry.whenExists : null;
      if (typeof when !== 'string' || !when.trim()) continue;
      if (!ctx.exists(ctx.inRoot(when))) continue;
      findings.push(
        `${key}: ${when} is there, so ${entry.chapter} has created what the key names — declare it now; while it is absent the build runs as though the subject does not exist`
      );
    }
    return findings;
  },
};

/**
 * The handover file states facts, not somebody's account of finding them.
 *
 * <p>It is the one document every agent reads at the start, and it survives many authors only
 * while nothing in it is written from a point of view.
 */
export const handoverGate = {
  id: 'handoverGate',
  title: 'the handover file carries a point of view',
  needs: ['handoverFile'],
  run: (ctx) => {
    const text = ctx.read(ctx.at('handoverFile'));
    if (text === null) return [`handoverFile → ${ctx.declared('handoverFile')}: cannot be read`];
    const extra = Array.isArray(ctx.declared('narrativePhrases')) ? ctx.declared('narrativePhrases') : [];
    const phrases = [...NARRATIVE_PHRASES, ...extra.filter((p) => typeof p === 'string' && p)];
    const findings = [];
    for (const { line, no } of proseLines(text)) {
      for (const phrase of phrases) {
        if (line.includes(phrase) && !onlyQuoted(line, phrase)) {
          findings.push(`${ctx.declared('handoverFile')}:${no}: "${phrase}" — state the fact, and correct it in place when it changes`);
        }
      }
    }
    return findings;
  },
};

/**
 * A parked decision is on the list, under the heading the project named, in the shape the
 * next session can act on.
 *
 * <p>A line missing the part that says which side looks stale sends the next session back to
 * re-derive it, which is the cost parking exists to avoid.
 */
export const openItemsGate = {
  id: 'openItemsGate',
  title: 'the open items are missing their heading or their shape',
  needs: ['openItemsFile', 'openItemsHeading'],
  run: (ctx) => {
    const file = ctx.declared('openItemsFile');
    const heading = ctx.declared('openItemsHeading');
    const text = ctx.read(ctx.at('openItemsFile'));
    if (text === null) return [`openItemsFile → ${file}: cannot be read`];
    if (!hasHeading(text, heading)) {
      return [`${file}: the "${heading}" heading is missing — it is where a decision nobody can settle is written`];
    }
    const findings = [];
    for (const { line, no } of sectionUnder(text, heading) ?? []) {
      if (!/^\s*[-*+]\s+\S/.test(line)) continue;
      const body = line.replace(/^\s*[-*+]\s+/, '');
      if (!/^\S+\s+[—-]{1,2}\s+\S/.test(body)) {
        findings.push(`${file}:${no}: a parked line reads "<frame> — <the choice or blocker> — <which side looks stale>"`);
      }
    }
    return findings;
  },
};

/**
 * Every chapter is named in the state ledger.
 *
 * <p>The ledger is the only place the build's progress lives, so a chapter it does not name
 * is one the next session cannot see — it will be built again, or skipped.
 */
export const ledgerGate = {
  id: 'ledgerGate',
  title: 'a chapter the state ledger does not name',
  needs: ['chapterDir', 'stateLedger'],
  run: (ctx) => {
    const ledger = ctx.read(ctx.at('stateLedger'));
    if (ledger === null) return [`stateLedger → ${ctx.declared('stateLedger')}: cannot be read`];
    const files = (ctx.list(ctx.at('chapterDir')) ?? []).filter(
      (f) => f.endsWith('.md') && !f.includes('/') && !/^(00|_|README)/i.test(f)
    );
    const haystack = ledger.toLowerCase();
    const findings = [];
    for (const file of files) {
      const stem = file.replace(/\.md$/, '');
      const token = stem.split('-')[0];
      if (!haystack.includes(stem.toLowerCase()) && !haystack.includes(token.toLowerCase())) {
        findings.push(`${file}: no row in ${ctx.declared('stateLedger')} — a chapter the ledger does not name is built twice or not at all`);
      }
    }
    return findings;
  },
};

const CAPTURE_NAME = /^\d{8}-\d{4}-[A-Za-z]{1,4}-\d{1,3}(-[a-z0-9-]+)?\.png$/;

/**
 * Captures are named the one way, in one folder per language.
 *
 * <p>The shape is not the project's to choose: a picture nobody can place, or a place with no
 * picture, is discovered months after the agent who took it has gone.
 */
export const capturesGate = {
  id: 'capturesGate',
  title: 'a capture nobody can place',
  needs: ['capturesDir'],
  run: (ctx) => {
    const dir = ctx.at('capturesDir');
    const entries = ctx.list(dir);
    if (entries === null) return [];
    const findings = [];
    for (const entry of entries) {
      const parts = entry.split('/');
      if (parts.length === 1) {
        findings.push(`${entry}: the language is the only folder — a capture sits in <language>/`);
        continue;
      }
      if (parts.length > 2) {
        findings.push(`${entry}: one folder deep — everything else that tells two pictures apart is a variant on the name`);
        continue;
      }
      const [, name] = parts;
      if (!CAPTURE_NAME.test(name)) {
        findings.push(`${entry}: the name is <YYYYMMDD-HHMM>-<frame-id>[-<variant>].png`);
      }
    }
    return findings;
  },
};

/**
 * Every commit says which chapter it belongs to, and a cross-chapter change says which
 * chapters it reached.
 *
 * <p>Without the trailers the history is a flat list: a diff shows which files changed, never
 * which chapter's contract moved.
 */
export const trailerGate = {
  id: 'trailerGate',
  title: 'a commit that does not say which chapter it belongs to',
  needs: [],
  run: (ctx) => {
    const range = ctx.options.range ?? null;
    const args = ['log', '--no-merges', '--format=%H%x1e%B%x1f', ...(range ? [range] : ['-n', '1'])];
    const { ok, out } = ctx.git(args);
    if (!ok) return [`git log failed — ${out.trim().split('\n')[0]}`];
    const findings = [];
    for (const record of out.split('\u001f')) {
      const [hash, body] = record.split('\u001e');
      if (!hash || !hash.trim()) continue;
      const short = hash.trim().slice(0, 8);
      const lines = (body ?? '').split(/\r?\n/);
      const chapter = lines.find((l) => /^Chapter:\s*\S/.test(l));
      if (!chapter) {
        findings.push(`${short}: no "Chapter:" trailer — the build's history is read as a tree or not at all`);
      }
      const touches = lines.find((l) => /^Touches:/.test(l));
      if (touches && !/^Touches:\s*\S+( \S+)*$/.test(touches.trim())) {
        findings.push(`${short}: "Touches:" names the chapters this change reached, separated by spaces`);
      }
    }
    return findings;
  },
};

/** The gates that hold on any project that builds from a board. */
export const CORE_GATES = [
  configGate,
  deferredKeyGate,
  handoverGate,
  openItemsGate,
  ledgerGate,
  capturesGate,
  trailerGate,
];

/**
 * The gates that apply to one project: the core set, minus what it turned off with a reason,
 * plus whatever `projectGates` exports.
 */
export async function gatesFor(ctx) {
  const off = new Map(
    (Array.isArray(ctx.declared('disabledGates')) ? ctx.declared('disabledGates') : [])
      .filter((e) => e && typeof e.id === 'string')
      .map((e) => [e.id, e.reason])
  );
  const core = CORE_GATES.filter((g) => !off.has(g.id));
  const modulePath = ctx.at('projectGates');
  let project = [];
  if (modulePath && ctx.exists(modulePath)) {
    const mod = await import(pathToFileURL(modulePath).href);
    project = Array.isArray(mod.gates) ? mod.gates : [];
  }
  return { gates: [...core, ...project], disabled: off, projectModule: modulePath };
}

/** Whether every key a gate needs is declared — a gate with nothing to read is skipped, not failed. */
export function applies(gate, ctx) {
  return (gate.needs ?? []).every((key) => ctx.declared(key) !== null);
}
