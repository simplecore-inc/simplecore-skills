// Every gate that holds on any project built from a board, and the resolver that adds a
// project's own.
//
// A gate is `{ id, title, needs, grade, run(ctx) → string[] }`. It finds and describes; it never
// prints and never exits, so the same gate runs from the command line, from a case in the
// harness, and from anywhere else that has a context.
//
// **`grade` says what a finding of this gate is, and it sits on the gate rather than on the
// finding.** `error` is a defect and is what a gate that declares nothing is judged at; `warning`
// is a prompt to re-read something, printed under its own marker and ignored by the exit status.
// A gate answers one question, so the kind of its findings is a property of the rule: a gate whose
// findings differ in kind is two rules sharing an id, and it is split into two gates that each
// carry their own pair of cases. Grading each returned string instead would leave the harness
// nothing to hold — a case is judged per gate, so a gate that quietly downgraded one finding among
// nine would pass both its cases and no case could be written that pins it.
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
//
// **A worked example of the test, because the line is easy to draw in the wrong place.** The
// checks over a chapter's evidence came up together, and only three of the five moved. What a
// result document has to look like — a section per demanded line, three labels, a picture or what
// was run, a quote that is part of the chapter's own sentence, one capture per frame a closed
// chapter placed — is true wherever chapters are built from a board, so `evidence.mjs` holds it
// and the project declares the words. Two stayed behind:
//
//   · one asks whether the frame a picture shows can be pointed at again, and it can only ask
//     that where the project keeps a table of frames and addresses. A project that reaches its
//     screens by clicking has no such table and no such question, so a skill carrying the check
//     would be carrying one console's capture arrangement everywhere.
//   · one hunts the phrasings that hand a check to human eyes, and those phrasings are one
//     repository's sentences. It moves when they become a declared list rather than a constant.
//
// **The test that separated them was not size and not usefulness** — both are useful anywhere in
// the abstract. It was whether the check can be RUN in a repository that declares this skill's
// keys and nothing more. Three can; two need a file the skill has no name for.
import { pathToFileURL } from 'node:url';
import { COLOR_SCHEMES, HEADING_ROLES, SCHEMA, STANDARD_FIELDS, isPathKey } from './context.mjs';
import { NARRATIVE_PHRASES, hasHeading, onlyQuoted, proseLines, sectionUnder } from './prose.mjs';
import { EVIDENCE_GATES } from './evidence.mjs';
import { EYES_GATES } from './eyes.mjs';
import { VOCABULARY_GATES } from './vocabulary.mjs';

/** What a finding of a gate is: a defect to fix, or a line to go and re-read. */
export const GRADES = ['error', 'warning'];

/** What a gate that declares no grade is judged at — a rule is a defect unless it says otherwise. */
export const DEFAULT_GRADE = 'error';

/**
 * The grade a gate's findings are counted at.
 *
 * <p>An unknown grade is returned exactly as declared rather than quietly corrected to the
 * default: `ungraded` in the harness reports it and the run fails, because a grade nobody reads
 * would otherwise land in whichever channel the reader happened to assume — and the author of a
 * gate that says `advisory` reads the word in the source and believes it is advisory.
 */
export function gradeOf(gate) {
  return gate?.grade ?? DEFAULT_GRADE;
}

const TYPE_OF = {
  dir: 'a path',
  file: 'a path',
  path: 'a path',
  outdir: 'a path',
  outfile: 'a path',
  command: 'a command line',
  text: 'a non-empty string',
  list: 'an array',
  headings: 'an object of role → heading',
  phrases: 'an object of role → a non-empty array of phrases',
  exceptions: 'an array of { id, reason }',
  artefacts: 'an array of { path, by }, each carrying `neverCommitted` with its reason where the artefact must not be committed',
  deferrals: 'an object of key → { chapter, whenExists }',
  standard: `an object of { ${STANDARD_FIELDS.join(', ')} }, or an array of them where the board draws at several device widths`,
};

/**
 * What is wrong with one declared path, given the kind its key was declared as.
 *
 * <p>`label` is what the finding calls it — the key, or the key and the index when the key
 * was declared several times over. A `path` key is satisfied by a file or a directory: it
 * names where the thing is, and whether that is one file or the folder its family lives in
 * is the project's to decide.
 */
function pathFindings(label, value, spec, ctx) {
  const path = ctx.inRoot(value);
  if (spec.kind === 'dir' && !ctx.isDir(path)) return [`${label} → ${value}: no such directory`];
  if (spec.kind === 'file' && !ctx.exists(path)) return [`${label} → ${value}: no such file`];
  if (spec.kind === 'path' && !ctx.exists(path)) return [`${label} → ${value}: no such file or directory`];
  if (spec.kind === 'outfile') {
    const parent = path.slice(0, path.lastIndexOf('/'));
    if (!ctx.isDir(parent)) return [`${label} → ${value}: the directory it is written into does not exist`];
  }
  return [];
}

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
      if (spec.kind === 'artefacts') {
        if (!Array.isArray(value)) {
          findings.push(`${key} must be ${TYPE_OF.artefacts}`);
          continue;
        }
        value.forEach((entry, i) => {
          const named =
            entry && typeof entry === 'object' && !Array.isArray(entry) &&
            typeof entry.path === 'string' && entry.path.trim() &&
            typeof entry.by === 'string' && entry.by.trim();
          if (!named) {
            findings.push(
              `${key}[${i}] must name the path and the command that writes it — an entry with no `
              + 'producing command is a file a person edits, and this census is of the ones nobody does'
            );
            return;
          }
          // The escape carries its reason for the same cause `disabledGates` does, and the cause is
          // sharper here: a lock file rewritten by a local-link step is the entry somebody adds, and
          // with the reason missing the next reader deletes the row and commits the file.
          if ('neverCommitted' in entry && (typeof entry.neverCommitted !== 'string' || !entry.neverCommitted.trim())) {
            findings.push(
              `${key}[${i}] → ${entry.path}: exempted with no reason — an exception nobody can question is an omission`
            );
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
      if (spec.kind === 'phrases') {
        if (typeof value !== 'object' || Array.isArray(value)) {
          findings.push(`${key} must be ${TYPE_OF.phrases}`);
          continue;
        }
        // `roles: null` says the roles are the PROJECT's to name. A vocabulary a project's own
        // gate reads has no role this skill could know — it is the reason such a vocabulary was
        // homeless, and a schema that can only describe its own roles pushes every project into
        // keeping one somewhere the config gate never reads.
        const open = spec.roles === null;
        for (const role of open ? Object.keys(value) : spec.roles ?? []) {
          const list = value[role];
          if (!Array.isArray(list) || !list.length || list.some((p) => typeof p !== 'string' || !p.trim())) {
            findings.push(
              `${key}.${role} names no phrases — a vocabulary with an empty role matches nothing, and a `
              + 'check that matches nothing reports the same zero as one with nothing to find'
            );
          }
        }
        // An open vocabulary still has to name something: an empty object is a declaration that
        // reads as made and matches nothing, which is the failure this whole kind exists to stop.
        if (open && !Object.keys(value).length) {
          findings.push(`${key} names no roles at all — declare the vocabulary or leave the key out`);
        }
        if (!open) {
          for (const role of Object.keys(value)) {
            if (!(spec.roles ?? []).includes(role)) findings.push(`${key}.${role} is not a role this skill knows`);
          }
        }
        continue;
      }
      if (spec.kind === 'headings') {
        if (typeof value !== 'object' || Array.isArray(value)) {
          findings.push(`${key} must be ${TYPE_OF.headings}`);
          continue;
        }
        for (const role of spec.roles ?? HEADING_ROLES) {
          // A role declared `null` is a project saying it writes no such line, which is a
          // different statement from leaving the role out and has to be readable as one. It costs
          // a reason: `disabledGates` already settles that an exception a reader cannot question
          // is an omission wearing a decision's clothes.
          if (role in value && value[role] === null) {
            const why = value[`//${role}`];
            if (typeof why !== 'string' || !why.trim()) {
              findings.push(
                `${key}.${role} is declared absent and says nothing about why. A project that `
                + 'genuinely writes no such line says so here and puts the reason in '
                + `"//${role}" beside it — an absence nobody explained reads the same as one nobody noticed`
              );
            }
            continue;
          }
          const heading = value[role];
          if (typeof heading !== 'string' || !heading.trim()) {
            findings.push(`${key}.${role} names no heading — a section named by role that no heading matches stops an agent`);
          } else if (spec.bare && /[*_`#]/.test(heading)) {
            // The silence this catches: a label carrying its own emphasis is written `**X**` into
            // every document and looked for as `****X****`, so every check over those documents
            // finds nothing and reports nothing.
            findings.push(
              `${key}.${role} is 「${heading}」 and carries markdown. This key is the WORD alone — `
              + 'the checks write the emphasis themselves, so a label declared with it is looked '
              + 'for with the markers twice over and matches no line in any document'
            );
          }
        }
        for (const role of Object.keys(value)) {
          if (role.startsWith('//')) continue;
          if (!(spec.roles ?? HEADING_ROLES).includes(role)) findings.push(`${key}.${role} is not a role this skill knows`);
        }
        continue;
      }
      if (spec.kind === 'standard') {
        const many = Array.isArray(value);
        if (many && !value.length) {
          findings.push(
            `${key} is an empty array, which declares nothing while looking like a decision — `
            + 'delete the key and pay the cost its row states, or name the standard'
          );
          continue;
        }
        (many ? value : [value]).forEach((entry, i) => {
          const label = many ? `${key}[${i}]` : key;
          if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            findings.push(`${label} must be ${TYPE_OF.standard}`);
            return;
          }
          for (const side of ['width', 'height']) {
            if (!Number.isInteger(entry[side]) || entry[side] <= 0) {
              findings.push(
                `${label}.${side} is ${JSON.stringify(entry[side] ?? null)} and must be a whole number of CSS `
                + 'pixels — a run reads it back with innerWidth/innerHeight, which never answer in anything else'
              );
            }
          }
          if (!COLOR_SCHEMES.includes(entry.colorScheme)) {
            findings.push(
              `${label}.colorScheme is ${JSON.stringify(entry.colorScheme ?? null)} and must be `
              + `${COLOR_SCHEMES.join(' or ')}. A third word is a scheme nothing can be set to and `
              + 'nothing can be read back as, so every capture would confirm against a value no browser reports'
            );
          }
          for (const field of Object.keys(entry)) {
            if (field.startsWith('//') || STANDARD_FIELDS.includes(field)) continue;
            findings.push(`${label}.${field} is not a field this skill reads — a mistyped field is silent`);
          }
        });
        continue;
      }
      // A `many` key is declared once or several times — a project with more than one
      // migration lineage names them all under the one key, and each is held to the same kind.
      if (spec.many && Array.isArray(value)) {
        value.forEach((entry, i) => {
          if (typeof entry !== 'string' || !entry.trim()) {
            findings.push(`${key}[${i}] must be ${TYPE_OF[spec.kind]}`);
            return;
          }
          findings.push(...pathFindings(`${key}[${i}]`, entry, spec, ctx));
        });
        continue;
      }
      if (typeof value !== 'string') {
        findings.push(`${key} must be ${TYPE_OF[spec.kind]}${spec.many ? ', or an array of them' : ''}`);
        continue;
      }

      if (isPathKey(key)) findings.push(...pathFindings(key, value, spec, ctx));
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

/** The three answers a build knows how to follow, and what each one lets it do. */
export const COMMIT_POLICIES = new Map([
  ['ask', 'stop before each commit and ask'],
  ['commit', 'commit as the work lands; pushing still waits for the user'],
  ['commitAndPush', 'commit as the work lands and push'],
]);

/**
 * The commit policy is one of the words the build knows how to act on.
 *
 * <p>A project answers "may this build commit?" once, and a word outside the three is worse than
 * an undeclared key: `commitPolicy: "yes"` reads to every person who opens the config as a
 * decision that was made, while the build falls back to asking and nobody finds out why it keeps
 * stopping. An undeclared key at least reads as undeclared.
 */
export const commitPolicyGate = {
  id: 'commitPolicyGate',
  title: 'the commit policy is a word the build cannot follow',
  needs: ['commitPolicy'],
  run: (ctx) => {
    const declared = ctx.declared('commitPolicy');
    if (typeof declared !== 'string') return [];
    if (COMMIT_POLICIES.has(declared)) return [];
    return [
      `commitPolicy is 「${declared}」, which is not one of ${[...COMMIT_POLICIES.keys()].join(' · ')} — `
      + 'a word outside those reads as a decision and is followed by nobody, so the build goes on '
      + 'asking before every commit while the config says it was settled',
    ];
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
    const declared = ctx.declared('handoverFile');
    const text = ctx.read(ctx.at('handoverFile'));
    if (text === null) return [`handoverFile → ${declared}: cannot be read`];
    const extra = Array.isArray(ctx.declared('narrativePhrases')) ? ctx.declared('narrativePhrases') : [];
    const phrases = [...NARRATIVE_PHRASES, ...extra.filter((p) => typeof p === 'string' && p)];

    // **The handover file may be an index that routes**, and then the facts this rule was written
    // for are not in it — they are in `references/` beside it. Reading the declared file alone
    // there covers a table of contents and reports the same clean result it reported while it was
    // reading facts, which is the one failure mode a split introduces → *A handover file grows,
    // and the answer is not another trim*. So the sweep follows the routing where there is any.
    const dir = declared.includes('/') ? declared.slice(0, declared.lastIndexOf('/')) : '';
    const beside = (ctx.list(`${dir}/references`) ?? [])
      .filter((name) => name.endsWith('.md'))
      .map((name) => `${dir}/references/${name}`);
    const documents = [[declared, text]];
    for (const rel of beside) {
      const body = ctx.read(rel);
      if (body !== null) documents.push([rel, body]);
    }

    const findings = [];
    for (const [where, body] of documents) {
      for (const { line, no } of proseLines(body)) {
        for (const phrase of phrases) {
          if (line.includes(phrase) && !onlyQuoted(line, phrase)) {
            findings.push(`${where}:${no}: "${phrase}" — state the fact, and correct it in place when it changes`);
          }
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
    // The finding names the declaration, not the document, because the declaration is the likelier
    // of the two to be wrong: `openItemsHeading` takes the heading's text, and a value written with
    // its markdown markers on it (`## …`) matches no heading in any document. A message pointing at
    // the document sends the reader to a heading that is plainly there, and it reads as the file
    // being at fault.
    if (!hasHeading(text, heading)) {
      return [
        `openItemsHeading → ${JSON.stringify(heading)}: no heading in ${file} matches it — declare the heading's text only, with no "#" markers on it`,
      ];
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

/**
 * `<YYYYMMDD-HHMM>-<frame>[-<variant>]` in whatever container the project's encoder writes.
 *
 * <p><b>The shape of the name is this gate's to hold; the format is not.</b> A project that fits
 * its pictures under a size bound encodes to `webp`, and naming one container refuses the pictures
 * of every project that chose another — reporting a whole round as unplaceable over the three
 * letters after the dot. `evidence.mjs` accepts `.webp` for the same pictures once they are
 * curated, so a single container here made one skill demand two names for one file.
 */
const CAPTURE_NAME = /^\d{8}-\d{4}-[A-Za-z]{1,4}-\d{1,3}(-[a-z0-9-]+)?\.(?:png|webp|jpe?g|avif)$/;

/**
 * Captures are placed the one way: one folder per language, and a name a reader can parse.
 *
 * <p>The shape is not the project's to choose: a picture nobody can place is discovered months
 * after the agent who took it has gone.
 *
 * <p><b>This holds where a picture sits and the SHAPE of its name. It holds nothing about what
 * the parts of that name mean.</b> The variant is 「lower case, digits and hyphens」 and that is
 * the whole of it, so every word a project layers on top of it — a theme, a width, a state —
 * passes here whatever it says. That boundary is real and it is also the way this gate gets
 * misread: its title promises placeability and a reader takes it for the naming rule entire.
 *
 * <p>The case that made it worth writing down: a project declared 「a picture with no theme in its
 * name is the console's own scheme and one ending `-light` is the other」, and a run wrote
 * `-dark-` into a name. Three spellings for two states, the document describing it wrong, and this
 * gate green over both — because `dark` is lower case, digits and hyphens. **A convention that
 * names a project's own vocabulary is the project's checker to hold**, and one whose default can
 * change has to be read off the product rather than written down, or a flipped default leaves
 * every picture named for the state it is not with nothing disagreeing.
 *
 * <p>What IS held here beyond the shape: the folder is one of the languages the project declared.
 * Those are already in the config, so a picture under a folder that is not a language — a width, a
 * frame, a date — is placeable-looking and unfindable, and no project should have to write that
 * check itself.
 */
/**
 * A chapter, with whatever a sweep of it was narrowed to.
 *
 * <p>`w02`, and `w02-n` where one sweep covered the N cluster of it — the suffix says which part,
 * the same way a capture's own name carries a variant.
 */
const CHAPTER_FOLDER = /^[a-z]\d{2}(?:-[a-z0-9-]+)?$/;

export const capturesGate = {
  id: 'capturesGate',
  title: 'a capture nobody can place',
  needs: ['capturesDir'],
  run: (ctx) => {
    const dir = ctx.at('capturesDir');
    const entries = ctx.list(dir);
    if (entries === null) return [];
    // Read rather than required: a project that declares no languages still gets the shape held,
    // and adding them to `needs` would skip the whole gate for it.
    const spoken = ctx.declared('locales');
    const pseudo = ctx.declared('pseudoLocale');
    const languages = Array.isArray(spoken)
      ? new Set([...spoken, ...(pseudo ? [pseudo] : [])])
      : null;
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
      const [folder, name] = parts;
      // A language OR a chapter — the two things a capture is grouped by, and the two the config
      // already knows. `capturesDir` is a generic key: a project sweeping one screen in ten
      // languages groups by language, and one sweeping a chapter's frames groups by chapter, and
      // both are placeable. Holding it to languages alone reported every capture in a repository
      // whose own handover reference says `.captures/<chapter>/`, which is a rule failing correct
      // work rather than finding anything.
      const placeable =
        (languages !== null && languages.has(folder))
        || CHAPTER_FOLDER.test(folder);
      if (languages !== null && !placeable) {
        findings.push(`${entry}: '${folder}' is neither one of the declared languages (${[...languages].join(' · ')}) nor a chapter — a capture is grouped by one of the two, and anything else is placeable-looking and unfindable`);
        continue;
      }
      if (!CAPTURE_NAME.test(name)) {
        findings.push(`${entry}: the name is <YYYYMMDD-HHMM>-<frame-id>[-<variant>].png`);
      }
    }
    return findings;
  },
};

/**
 * A trailer line as git recognises one — a token with no whitespace in it, then the separator.
 *
 * <p>Used to SAY WHY git rejected a block, never to decide whether it did. The decision is git's,
 * taken from `%(trailers)` in the same `log` call; a second implementation of the rule here would
 * agree with git right up until the day one of them changed, and on that day the gate would be
 * reporting about a parse nothing else performs.
 */
const TRAILER_LINE = /^[^\s:]+:(\s|$)/;

/**
 * The one thing git reads past inside a trailer block: a line that begins with whitespace.
 *
 * <p>Which is the whole of the defect. A census, a list of names, a measurement — anything long
 * enough to wrap — is written on one line or folded under an indent, and folded at column 0 it ends
 * the block for git while looking, to a person and to any line-by-line pattern, exactly like a
 * trailer block that parses.
 */
const CONTINUATION = /^\s/;

/**
 * Why git reads no trailer out of a message that plainly carries one.
 *
 * <p>Both answers name a line, because 「git cannot read it」 with nothing to act on sends the
 * reader off to re-derive git's rules from the documentation. The block is the message's LAST
 * paragraph — a `Chapter:` line above one is outside the block altogether, which is the other way
 * this fails and is indistinguishable from the first by any line-by-line search.
 */
function whyGitReadsNoTrailers(body, key) {
  const lines = String(body ?? '').replace(/\s+$/, '').split(/\r?\n/);
  let from = 0;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i].trim() === '') {
      from = i + 1;
      break;
    }
  }
  const block = lines.slice(from);
  const named = new RegExp(`^${key}:\\s*\\S`);
  if (!block.some((line) => named.test(line))) {
    return `the "${key}:" line is above the message's last paragraph, so it is outside the trailer block`;
  }
  for (const [at, line] of block.entries()) {
    if (at > 0 && CONTINUATION.test(line)) continue;
    if (TRAILER_LINE.test(line)) continue;
    return (
      `"${line.trim()}" is inside the trailer block and is neither a trailer nor an indented `
      + 'continuation of the one above it, and ONE such line makes git discard the whole block. '
      + 'Write that line on one line however long it runs, or indent what it wrapped onto'
    );
  }
  return 'git reads no trailer block out of this message';
}

/**
 * Every commit says which chapter it belongs to, and a cross-chapter change says which
 * chapters it reached.
 *
 * <p>Without the trailers the history is a flat list: a diff shows which files changed, never
 * which chapter's contract moved.
 *
 * <p><b>Read the way git reads, not the way the message looks.</b> The trailer exists so that
 * `git log --format='%(trailers:key=Chapter)'` answers, and git reads a trailer block only where it
 * is the message's last paragraph and consists entirely of trailers and indented continuations. One
 * line wrapped at column 0 — a census whose names ran past the margin, a measurement folded onto a
 * second line — makes git discard <b>the whole block</b>, silently. A gate matching `^Chapter:`
 * line by line is green over exactly that commit, which is the one commit whose trailer answers
 * nobody: two in one repository carried a `Chapter:` line any person could read while
 * `%(trailers:key=Chapter)` came back empty for both, and every gate in that repository was green.
 */
export const trailerGate = {
  id: 'trailerGate',
  title: 'a commit git reads no chapter out of',
  needs: [],
  run: (ctx) => {
    const range = ctx.options.range ?? null;
    // git parses; this reads what git made of it. `unfold` joins an indented continuation back onto
    // its trailer, so a legitimately folded `Touches:` reaches the shape check as one line.
    // `only=true` for Touches keeps the KEY in the output, which is the one way to tell 「git read
    // the trailer and its value is empty」 from 「git read no trailer block at all」 — two different
    // defects that `valueonly` returns the same empty string for.
    const format =
      '--format=%H%x1e%B%x1e%(trailers:key=Chapter,valueonly=true,unfold=true)'
      + '%x1e%(trailers:key=Touches,only=true,unfold=true)%x1f';
    const args = ['log', '--no-merges', format, ...(range ? [range] : ['-n', '1'])];
    const { ok, out } = ctx.git(args);
    if (!ok) return [`git log failed \u2014 ${out.trim().split('\n')[0]}`];
    const findings = [];
    for (const record of out.split('\u001f')) {
      const [hash, body, chapterRead, touchesRead] = record.split('\u001e');
      if (!hash || !hash.trim()) continue;
      const short = hash.trim().slice(0, 8);
      const lines = (body ?? '').split(/\r?\n/);
      const chapter = (chapterRead ?? '').trim();
      if (!chapter) {
        // The two states a line-by-line reader cannot tell apart: no trailer was written at all,
        // and one was written that git cannot see. Only the second needs a diagnosis, and it is the
        // one whose author believes the job is done.
        const written = lines.find((l) => /^Chapter:\s*\S/.test(l));
        findings.push(
          written
            ? `${short}: "${written.trim()}" is in the message and git reads no chapter out of it \u2014 `
              + `${whyGitReadsNoTrailers(body, 'Chapter')}. \`git log --format='%(trailers:key=Chapter)'\` `
              + 'comes back empty, which is the one thing the trailer exists to answer'
            : `${short}: no "Chapter:" trailer \u2014 the build's history is read as a tree or not at all`
        );
      }
      // A `Touches:` git DID read, judged on its shape — including the empty one, which claims an
      // edge and names none. A `Touches:` git could NOT read is the wrapping defect above and is
      // named separately: a commit whose `Chapter:` is fine and whose `Touches:` fell outside the
      // block keeps its node in the tree and loses its edges.
      const readTouches = (touchesRead ?? '').trim() !== '';
      const touches = (touchesRead ?? '').replace(/^\s*Touches:/, '').trim();
      if (readTouches && !/^\S+( \S+)*$/.test(touches)) {
        findings.push(`${short}: "Touches:" names the chapters this change reached, separated by spaces`);
      }
      if (!readTouches && lines.some((l) => /^Touches:\s*\S/.test(l))) {
        findings.push(
          `${short}: a "Touches:" line is in the message and git reads no chapters out of it \u2014 `
          + `${whyGitReadsNoTrailers(body, 'Touches')}`
        );
      }
    }
    return findings;
  },
};

/**
 * A whole number anywhere in a line, with where it sits — the census is read by position.
 *
 * <p><b>By position rather than by word</b>, because the words are the project's. A gate that
 * anchored on 「through」 and 「outside」 would read every English census and nothing else, and a
 * project writing its commits in another language would get a run that compared nothing and
 * reported the same zero as a repository whose every census counted both sides.
 */
const WHOLE_NUMBER = /\d+/g;

/**
 * A census that counted both sides, and named the sites that fall outside the mechanism.
 *
 * <p>A change reaching many screens is verified by a sample plus a census — the sample because a
 * global change has one mechanism, and the census because <b>a sample cannot prove that every site
 * goes through that mechanism</b>. A dialog that hand-rolls its own close button is untouched by a
 * fix to the shared dialog component: the mechanism is sound, the site still says the wrong thing,
 * and sampling looks at instances of a mechanism this site has none of.
 *
 * <p><b>So a census that reports one number is not a census.</b> 「26 reach it」 and 「26 reach it,
 * 2 do not」 are one line to an exit status and two different sentences to a reader — only the
 * second says the search looked for the negative, which is the whole reason the census was worth
 * taking. And where the second is not zero the names are the finding: 「2 do not reach it」 gives
 * nobody anything to do.
 *
 * <p><b>Whether a change owed a census stays with eyes</b>, because nothing in a diff says a
 * change was verified by sample rather than screen by screen. This holds the shape of the answer
 * where one was given, which is what a machine can see.
 */
export const censusCountsBothSides = {
  id: 'censusCountsBothSides',
  title: 'a census that counted only the sites it expected to find',
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
      for (const line of (body ?? '').split(/\r?\n/)) {
        if (!/^Census:/.test(line)) continue;
        const stated = line.slice('Census:'.length).trim();
        if (!stated) {
          findings.push(`${short}: "Census:" states the mechanism and both counts — an empty one claims a search nobody made`);
          continue;
        }
        const counts = [...stated.matchAll(WHOLE_NUMBER)];
        if (counts.length < 2) {
          findings.push(
            `${short}: "Census: ${stated}" carries ${counts.length === 1 ? 'one count' : 'no count'} — a census states `
            + 'how many sites reach the mechanism AND how many do not, in that order. One number is a search that '
            + 'only looked for what it expected to find, and the sites with no instance of the mechanism are exactly '
            + 'the ones a sample can never reach'
          );
          continue;
        }
        const outside = Number(counts[1][0]);
        if (outside === 0) continue;
        const after = stated.slice(counts[1].index + counts[1][0].length);
        const named = after.includes(':') && after.slice(after.indexOf(':') + 1).trim();
        if (!named) {
          findings.push(
            `${short}: "Census: ${stated}" says ${outside} site(s) do not reach the mechanism and names none of them. `
            + '「2 do not reach it」 gives nobody anything to do; the two names do. Write them after a colon'
          );
        }
      }
    }
    return findings;
  },
};

/**
 * The extensions a relative specifier may be resolved to, in the order a bundler tries them.
 *
 * <p>The extensionless form is what makes this a resolution rather than a lookup: `./util` is
 * `util.ts` in one project and `util/index.js` in another, and a rule that demanded the literal
 * path would report every TypeScript import in the repository.
 */
const RESOLVES_TO = ['', '.mjs', '.js', '.cjs', '.ts', '.tsx', '.jsx', '.mts', '.cts', '.json'];

/** Source a relative import can be written in. Everything else here is somebody else's rule. */
const SOURCE = /\.(?:mjs|cjs|js|jsx|mts|cts|ts|tsx)$/;

/** A relative specifier, in each of the four ways one is written. */
const RELATIVE_IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)(['"])(\.[^'"]*)\1/g;

/** Every path the tree holds at one commit. */
function treeAt(ctx, hash) {
  const { ok, out } = ctx.git(['ls-tree', '-r', '--name-only', hash]);
  return ok ? new Set(out.split('\n').filter(Boolean)) : null;
}

/** `a/b/../c` → `a/c`, with no filesystem touched — the commit is not checked out. */
function resolveFrom(file, specifier) {
  const parts = file.split('/').slice(0, -1).concat(specifier.split('/'));
  const out = [];
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

/** Whether anything the specifier could mean is in the tree. */
function resolves(tree, base) {
  return RESOLVES_TO.some((ext) => tree.has(base + ext) || tree.has(`${base}/index${ext}`));
}

/**
 * The same source with its comments and its TEMPLATE literals blanked, length preserved.
 *
 * <p><b>Backticks and not quotes.</b> The specifier this rule reads sits inside quotes, so blanking
 * those would erase the very thing it looks for; a template literal is the opposite case, and it is
 * where a false finding comes from. A file holding specimen source — a gate's own case fixtures, a
 * scaffold's templates, a documentation example — writes it in backticks, and the import inside
 * that specimen names a file the repository has no reason to have. Read raw, this rule reports the
 * file that teaches it, which is the fastest way to teach everybody to scroll past a gate. It
 * happened on the first run: a case fixture holding `import … from "./detail-body"` came back
 * beside the five real ones.
 */
function withoutTemplatesOrComments(text) {
  const out = [...text];
  const strings = [];
  const blank = (from, to) => {
    for (let k = from; k < Math.min(out.length, to); k += 1) if (out[k] !== '\n') out[k] = ' ';
  };
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '/' && text[i + 1] === '/') {
      let j = i + 2;
      while (j < text.length && text[j] !== '\n') j += 1;
      blank(i, j);
      i = j;
    } else if (ch === '/' && text[i + 1] === '*') {
      let j = i + 2;
      while (j < text.length && !(text[j] === '*' && text[j + 1] === '/')) j += 1;
      blank(i, Math.min(text.length, j + 2));
      i = Math.min(text.length, j + 2);
    } else if (ch === '`') {
      let j = i + 1;
      while (j < text.length && text[j] !== '`') j += text[j] === '\\' ? 2 : 1;
      blank(i, Math.min(text.length, j + 1));
      i = Math.min(text.length, j + 1);
    } else if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < text.length && text[j] !== ch && text[j] !== '\n') j += text[j] === '\\' ? 2 : 1;
      // Kept rather than blanked: the specifier of a real import IS a quoted string, and blanking
      // it would leave nothing to resolve. The interior is recorded instead, so a `from` written
      // INSIDE a string can be told from one written in code — see `quoted` below.
      strings.push([i + 1, j]);
      i = j + 1;
    } else {
      i += 1;
    }
  }
  return { code: out.join(''), strings };
}

/**
 * Whether an offset falls inside the contents of a quoted string.
 *
 * <p><b>What this separates, and why nothing else can.</b> A case fixture is source written as a
 * string — `'x.ts': "import { y } from './y';"` — and every character of that import is inside a
 * string literal of the file that carries it. Read as code it is a commit importing a module the
 * repository does not have, which is exactly this gate's finding and exactly wrong: the fixture
 * imports nothing, it describes a file that will be written into a temporary directory.
 *
 * <p>The keyword is the discriminant. A real import writes `from` · `import(` · `require(` in
 * code and its specifier in quotes; a fixture writes both inside one string. So a match whose
 * KEYWORD begins inside a string is not an import — and a real specifier is never mistaken for
 * one, because the keyword before it is not in a string.
 */
const quoted = (strings, at) => strings.some(([from, to]) => at >= from && at < to);

/** Which lines of which file a commit ADDED, read off a diff carrying no context lines. */
function addedLines(diff) {
  const byFile = new Map();
  let file = null;
  let at = 0;
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ ')) {
      const path = line.slice(4).trim();
      file = path === '/dev/null' ? null : path.replace(/^b\//, '');
      if (file && !byFile.has(file)) byFile.set(file, new Set());
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(line);
    if (hunk) {
      at = Number(hunk[1]);
      continue;
    }
    if (!file || !line.startsWith('+') || line.startsWith('+++')) continue;
    byFile.get(file).add(at);
    at += 1;
  }
  return byFile;
}

/**
 * A commit that adds an import of a file the commit does not carry.
 *
 * <p><b>This is the one defect that nobody involved caused.</b> Two people edit a registry — a
 * barrel, an index, a table of modules — because that is what a registry is for. The first writes
 * its entry and has not yet committed the module it points at; the second commits the registry to
 * land their own entry, correctly, by explicit path. The commit is now a file importing a module
 * the repository does not have, and **`--only` cannot prevent it**: what that flag holds back is a
 * file nobody named, not somebody else's edit inside a file that was named. **Nor does checking
 * for stray untracked files afterwards find it**, because the missing file belongs to the other
 * person. Whoever pulls gets a tree that cannot load its own registry.
 *
 * <p><b>Only ADDED lines are read.</b> An import that was already there and already resolved is
 * not this defect, and reading whole files would report a repository's standing state on the first
 * commit that touched any part of it. That an import can also break because its target was deleted
 * is a different rule with a different fix, and it is not this one.
 *
 * <p><b>The tree is the authority, not the commit's own file list.</b> A module committed an hour
 * earlier resolves and should; what must not resolve is a path that exists only in somebody's
 * working directory. `git ls-tree` at the commit answers exactly that.
 */
export const importsTravelWithTheirCommit = {
  id: 'importsTravelWithTheirCommit',
  title: 'a commit adding an import of a file the repository does not have',
  needs: [],
  run: (ctx) => {
    const range = ctx.options.range ?? null;
    const listed = ctx.git(['log', '--no-merges', '--format=%H', ...(range ? [range] : ['-n', '1'])]);
    if (!listed.ok) return [`git log failed — ${listed.out.trim().split('\n')[0]}`];

    const findings = [];
    for (const hash of listed.out.split('\n').filter(Boolean)) {
      const short = hash.slice(0, 8);
      const shown = ctx.git(['show', '--format=', '--unified=0', '--no-renames', '--no-color', hash]);
      if (!shown.ok) continue;
      // Only source files are read back, so an ordinary commit costs one `git show` and no more.
      const touched = [...addedLines(shown.out)].filter(([file]) => SOURCE.test(file));
      if (!touched.length) continue;
      const tree = treeAt(ctx, hash);
      if (!tree) continue;

      for (const [file, lines] of touched) {
        const source = ctx.git(['show', `${hash}:${file}`]);
        if (!source.ok) continue;
        const { code, strings } = withoutTemplatesOrComments(source.out);
        let line = 1;
        for (let i = 0; i < code.length; i += 1) {
          if (code[i] === '\n') {
            line += 1;
            continue;
          }
          if (!lines.has(line)) continue;
          RELATIVE_IMPORT.lastIndex = i;
          const found = RELATIVE_IMPORT.exec(code);
          if (!found || found.index !== i) continue;
          i = RELATIVE_IMPORT.lastIndex - 1;
          // The keyword, not the specifier: a fixture writes both inside one string literal.
          if (quoted(strings, found.index)) continue;
          if (resolves(tree, resolveFrom(file, found[2]))) continue;
          findings.push(
            `${short}: ${file}:${line} imports \`${found[2]}\` and the commit does not carry it — `
            + 'whoever pulls this gets a file that cannot load. A registry is edited by everybody, '
            + 'so the entry somebody else wrote for a module they have not committed yet rides '
            + 'along on a `--only` of that one path, and looking for untracked files afterwards '
            + 'finds nothing because the missing file is theirs. Commit the module with the entry, '
            + 'or leave the entry out of this commit'
          );
        }
      }
    }
    return findings;
  },
};

/**
 * One `git status --porcelain=v1 -z` record per path, with a rename's source folded away.
 *
 * <p>`-z` rather than the quoted form: a path with a space or a non-ASCII byte in it comes back
 * wrapped in quotes and C-escaped otherwise, and every catalogue this gate is pointed at is full
 * of both. A rename writes the path it came from as a record of its own, which is one dirty file
 * rather than two.
 */
function porcelain(out) {
  const records = out.split('\0');
  const entries = [];
  for (let i = 0; i < records.length; i += 1) {
    // `XY p` is the shortest a record can be, and the split's last element is the empty string
    // after the trailing NUL.
    if (records[i].length < 4) continue;
    const code = records[i].slice(0, 2);
    entries.push({ code, file: records[i].slice(3) });
    if (code.includes('R') || code.includes('C')) i += 1;
  }
  return entries;
}

/**
 * A generated artefact the working tree holds and HEAD does not.
 *
 * <p><b>Every gate a chapter closes on reads the working tree, and the close is about the
 * commit.</b> Those are different questions and nothing in a gate's output tells them apart —
 * which is what makes this invisible rather than merely unchecked. A pseudo-locale catalogue was
 * regenerated, `pseudo:locale:check` answered 「every catalogue is current」, and the regenerated
 * file was never committed; a board build passed because `wf.mjs build` rebuilds before it checks,
 * over a built board no commit carried; twenty generated client files sat modified for a day,
 * stale from a run against an older backend, ready to ride into whatever commit next named a
 * directory. In all three the gate was right, its answer was honest, and the reader had no way to
 * see the difference.
 *
 * <p><b>The subject is what a command writes, never every dirty file.</b> A tree with uncommitted
 * work in it is what an agent mid-task always has, so a gate over all of it fires on ordinary work
 * — and under a write-time hook that fails a write when an error names the file just written, it
 * would fail every write the moment it happened. `generatedArtefacts` is therefore a census a
 * project keeps by hand: nothing on disk says which files a command wrote.
 *
 * <p><b>It runs at every gate run rather than at a close, because a close is not a moment a gate
 * can see.</b> The ledger's closed word is a standing set and not an event, so conditioning on it
 * would fire from the first closed chapter onward — every bit as often — while staying silent on a
 * project that has closed nothing, which is exactly the project forming the habit. And the state
 * is unrecoverable afterwards: what a tree held at a past commit leaves no trace anywhere, which
 * is the whole reason nobody has ever caught this in review.
 */
export const generatedArtefactsMatchHead = {
  id: 'generatedArtefactsMatchHead',
  title: 'a generated artefact the working tree holds and HEAD does not',
  needs: ['generatedArtefacts'],
  run: (ctx) => {
    const declared = ctx.declared('generatedArtefacts');
    if (!Array.isArray(declared)) return [];

    const findings = [];
    for (const entry of declared) {
      // Shape is `configGate`'s question. Reading past what it would refuse rather than restating
      // it keeps one mistyped entry from being reported twice under two ids.
      const named =
        entry && typeof entry === 'object' && !Array.isArray(entry) &&
        typeof entry.path === 'string' && entry.path.trim() &&
        typeof entry.by === 'string' && entry.by.trim();
      if (!named) continue;
      if (typeof entry.neverCommitted === 'string' && entry.neverCommitted.trim()) continue;
      const { path, by } = entry;

      // The pathspec goes to git rather than being matched here. A second implementation of
      // wildmatch would agree with git right up until the day one of them changed, and on that day
      // the gate would go quiet rather than wrong.
      const status = ctx.git(['status', '--porcelain=v1', '-z', '--', path]);
      if (!status.ok) return [`git status failed — ${status.out.trim().split('\n')[0]}`];

      const dirty = porcelain(status.out);
      if (!dirty.length) {
        // Silence has two meanings and git says them the same way: the artefact is committed and
        // current, or the pathspec matches nothing git has ever carried — a typo, a generator that
        // writes somewhere else now, or output that is ignored and never travels in a commit. The
        // second is a row that reads as coverage and holds nothing, which is the state this whole
        // key exists to end, so it is separated here rather than inherited as a pass.
        const tracked = ctx.git(['ls-files', '-z', '--', path]);
        if (tracked.ok && !tracked.out.replace(/\0/g, '')) {
          findings.push(
            `${path}: no file git tracks matches it and nothing under it is dirty — the row reads as `
            + `coverage and holds nothing. Either \`${by}\` writes somewhere else now, or its output `
            + 'is ignored and never travels in a commit, in which case the row comes out'
          );
        }
        continue;
      }

      for (const { code, file } of dirty) {
        const what = code.includes('?')
          ? 'is in the working tree and in no commit'
          : code.includes('D')
            ? 'is in HEAD and not in the working tree'
            : 'differs from what HEAD carries';
        findings.push(
          `${file}: ${what} — \`${by}\` writes it, so every gate that reads it is answering about `
          + 'this tree while the chapter closes on the commit. Commit it, or regenerate from a '
          + 'clean tree and commit that'
        );
      }
    }
    return findings;
  },
};

/** The gates that hold on any project that builds from a board. */
export const CORE_GATES = [
  configGate,
  deferredKeyGate,
  commitPolicyGate,
  handoverGate,
  openItemsGate,
  ledgerGate,
  capturesGate,
  trailerGate,
  censusCountsBothSides,
  importsTravelWithTheirCommit,
  generatedArtefactsMatchHead,
  // What a closed chapter leaves behind. They sit in a module of their own because they are the
  // longest thing here and they read documents rather than configuration.
  ...EVIDENCE_GATES,
  ...EYES_GATES,
  // The words the project declared, against the documents that write them. It sits after the
  // gates that READ those words, because it is the one that says whether they read anything.
  ...VOCABULARY_GATES,
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
  // A project gate answering to a core gate's id is refused, not merged.
  //
  // **Two gates under one id is a gate that has gone quiet without anybody choosing it.** Both run,
  // so a finding cannot be attributed to either; and every lookup by id — the self-test's above all
  // — takes the last one written, which is the project's. A project that copied a core gate before
  // the core owned it therefore proves its own stale copy while reporting the core gate's name, and
  // the report says the gate passed. Three of them sat like that in one repository, each reporting
  // ✔ against an implementation the skill had already replaced.
  //
  // **Replacing a core gate is allowed and has a door**: turn it off in `disabledGates` with the
  // reason, and the id is free. That is the same act made visible, which is the whole difference.
  const shadowed = project
    .map((g) => g?.id)
    .filter((id) => CORE_GATES.some((g) => g.id === id) && !off.has(id));
  if (shadowed.length) {
    throw new Error(
      `${modulePath}: ${shadowed.join(' · ')} — 코어 게이트와 같은 아이디입니다.\n`
      + '  둘이 함께 돌고 아이디로 찾으면 프로젝트 것이 잡히므로, 코어 게이트가 조용해진 것을\n'
      + '  아무도 알 수 없습니다. 코어 것을 대신하려면 disabledGates에 까닭과 함께 적어\n'
      + '  아이디를 비우고, 그냥 옛 사본이라면 지웁니다.'
    );
  }

  return { gates: [...core, ...project], disabled: off, projectModule: modulePath };
}

/** Whether every key a gate needs is declared — a gate with nothing to read is skipped, not failed. */
export function applies(gate, ctx) {
  return (gate.needs ?? []).every((key) => ctx.declared(key) !== null);
}
