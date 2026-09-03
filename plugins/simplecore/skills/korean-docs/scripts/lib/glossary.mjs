/**
 * Shared glossary rule layer for the korean-docs tools.
 *
 * Both entry points — check-glossary.mjs (document audit, also run by the
 * write-time hook) and l10n.mjs (locale-resource engine) — load their banned
 * terms from here, so a term registered once in a project glossary is enforced
 * on documents and screen copy alike, with identical merge semantics.
 *
 * Rule sources, merged in this order:
 *   1. The base glossary bundled with the skill (../GLOSSARY.base.md).
 *   2. The project glossary, discovered by walking up from a start directory
 *      and checking <dir>/.claude/GLOSSARY.md then <dir>/GLOSSARY.md. The
 *      directory that holds it becomes the project root.
 *
 * Project-glossary customization (row replacement by 영어 key or 금지 pattern,
 * screen-only rules, the 기본 규칙 예외 table) is implemented here once.
 */

import {readFileSync, existsSync, statSync} from 'node:fs';
import {join, resolve, dirname, basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {homedir} from 'node:os';

export const SKILL_DIR = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
export const BASE_GLOSSARY_PATH = join(SKILL_DIR, 'GLOSSARY.base.md');
export const BASE_RULE_PACK_PATH = join(SKILL_DIR, 'RULES.base.json');
export const TEMPLATE_PATH = join(SKILL_DIR, 'templates', 'GLOSSARY.md');

// ---------------------------------------------------------------------------
// Glossary discovery
// ---------------------------------------------------------------------------

export function discoverGlossary(startDir = process.cwd()) {
  const home = homedir();
  let dir = resolve(startDir);
  while (true) {
    for (const candidate of [join(dir, '.claude', 'GLOSSARY.md'), join(dir, 'GLOSSARY.md')]) {
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        // The root comes from where the glossary sits, not from where the walk stopped. A file
        // being edited inside `.claude/` starts the walk there, and `<repo>/.claude/GLOSSARY.md`
        // then matches the second candidate with `dir` already inside `.claude` — taking `dir` as
        // the root resolves every `audit.*` glob against `.claude/`, so the declared screen copy
        // reports "directory missing" and the write is blocked on a finding about nothing.
        return {path: candidate, root: rootFromGlossaryPath(candidate)};
      }
    }
    // A .git directory marks the project root, and the home directory is
    // never part of a project above cwd — stop ascending there so an
    // unrelated ancestor glossary (monorepo sibling, ~/GLOSSARY.md) is not
    // silently adopted as this project's standard.
    if (existsSync(join(dir, '.git')) || dir === home) return null;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function rootFromGlossaryPath(glossaryPath) {
  const dir = dirname(glossaryPath);
  return basename(dir) === '.claude' ? dirname(dir) : dir;
}

// ---------------------------------------------------------------------------
// Front matter (minimal YAML subset: the `audit:` block only)
// ---------------------------------------------------------------------------

function unquote(value) {
  const m = value.match(/^(['"])(.*)\1$/);
  return m ? m[2] : value;
}

function parseInlineArray(value) {
  const inner = value.replace(/^\[/, '').replace(/\]$/, '');
  return inner.split(',').map((s) => unquote(s.trim())).filter(Boolean);
}

// A flow sequence is one shape however it is wrapped. A formatter reflows a long one across
// lines the moment it stops fitting — `localeResources: [` then an item per line then `]` — and
// a parser that only knows the single-line form reads the opening bracket as the whole value.
//
// **The result is not an error but a silent narrowing**, which is the worst thing a declaration
// can do: the audit went on reporting 「오류 0건」 while its file count fell from 407 to 86,
// and nothing on screen distinguished that from a clean run. Adding a glob you never notice is
// missing is the same failure the project config warns about, arriving through the formatter.
//
// So the value is gathered to its closing bracket, and an unterminated one is refused rather
// than half-read.
function gatherFlowSequence(first, lines, from, where) {
  let value = first;
  let i = from;
  while (!value.trimEnd().endsWith(']')) {
    if (i >= lines.length) {
      throw new Error(`${where}: '[' 로 연 목록이 닫히지 않았습니다`);
    }
    value += ' ' + lines[i++].trim();
  }
  return {value, next: i};
}

export function parseGlossaryConfig(markdown) {
  const config = {paths: [], exclude: [], localeResources: [], localeAnnotationKeys: [], resolvedPlaceholders: [], untranslated: false};
  const lines = markdown.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return {config, body: markdown};
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') { end = i; break; }
  }
  if (end === -1) return {config, body: markdown};

  let inAudit = false;
  let listKey = null;
  const fm = lines.slice(1, end);
  for (let i = 0; i < fm.length; i++) {
    const line = fm[i].replace(/(^|\s)#.*$/, '$1');
    if (!line.trim()) continue;
    if (!/^\s/.test(line)) {
      inAudit = /^audit:\s*$/.test(line.trim());
      listKey = null;
      continue;
    }
    if (!inAudit) continue;
    const kv = line.match(/^\s+(paths|exclude|localeResources|localeAnnotationKeys|resolvedPlaceholders|untranslated)\s*:\s*(.*)$/);
    if (kv) {
      const [, key, rest] = kv;
      let value = rest.trim();
      listKey = null;
      if (key === 'untranslated') {
        config.untranslated = value === 'true';
      } else if (value === '' && fm[i + 1]?.trim().startsWith('[')) {
        // A formatter may also push the whole sequence onto the following lines, leaving the
        // key bare — which reads exactly like the block form until the '[' is looked at.
        const gathered = gatherFlowSequence(fm[i + 1].trim(), fm, i + 2, `audit.${key}`);
        i = gathered.next - 1;
        config[key] = parseInlineArray(gathered.value);
      } else if (value.startsWith('[')) {
        const gathered = gatherFlowSequence(value, fm, i + 1, `audit.${key}`);
        i = gathered.next - 1;
        config[key] = parseInlineArray(gathered.value);
      } else if (value === '') {
        listKey = key;
      } else {
        config[key] = [unquote(value)];
      }
      continue;
    }
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && listKey) config[listKey].push(unquote(item[1].trim()));
  }
  return {config, body: lines.slice(end + 1).join('\n')};
}

// ---------------------------------------------------------------------------
// Glossary table parsing
// ---------------------------------------------------------------------------

/** Splits a markdown table row into trimmed cells (no escaped-pipe support by design). */
function splitRow(line) {
  const cells = line.split('|').map((c) => c.trim());
  if (cells.length && cells[0] === '') cells.shift();
  if (cells.length && cells[cells.length - 1] === '') cells.pop();
  return cells;
}

function isSeparatorRow(cells) {
  // GitHub markdown accepts a single dash per column in the separator row.
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));
}

/**
 * Extracts data rows of the table under the given "## heading". Returns null
 * when the section is absent (all sections are optional in a project
 * glossary). Fenced code blocks are skipped so glossaries can show example
 * rows inside ``` fences without them becoming live rules.
 */
export function tableRowsUnderHeading(markdown, heading) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === `## ${heading}`);
  if (start === -1) return null;
  const rows = [];
  let headerSeen = false;
  let inFence = false;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    if (/^##\s/.test(line)) break;
    if (!line.trim().startsWith('|')) continue;
    const cells = splitRow(line);
    if (!headerSeen) { headerSeen = true; continue; }
    if (isSeparatorRow(cells)) continue;
    rows.push(cells);
  }
  return rows;
}

/**
 * Compiles one banned-cell item into a pattern. Items wrapped in /slashes/
 * are regexes; anything else is a literal. Commas separate items, so
 * patterns must not contain commas; alternation needs separate items.
 */
export function compilePattern(item, sourceName) {
  const m = item.match(/^\/(.+)\/$/);
  try {
    return m ? new RegExp(m[1], 'g') : new RegExp(escapeRegExp(item), 'g');
  } catch (err) {
    throw new Error(`${sourceName}: 잘못된 패턴 "${item}": ${err.message}`);
  }
}

export function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitItems(cell) {
  return cell.split(',').map((s) => s.trim()).filter(Boolean);
}

function parseLevel(cell, sourceName) {
  if (cell === '오류') return {level: 'error', threshold: 1};
  if (cell === '경고') return {level: 'warn', threshold: 1};
  const m = cell.match(/^경고\((\d+)\+\)$/);
  if (m) return {level: 'warn', threshold: Number(m[1])};
  throw new Error(`${sourceName}: 알 수 없는 수준 "${cell}" (오류 | 경고 | 경고(N+))`);
}

/**
 * Both rule tables have exactly 4 columns. More cells means a stray '|'
 * inside a cell, which silently shifts columns and drops banned items —
 * surface it instead of parsing garbage quietly.
 */
function warnExtraColumns(cells, sourceName, heading) {
  if (cells.length > 4) {
    console.error(`경고: ${sourceName} "${heading}" 표의 행 "${cells[0]}"에 열이 ${cells.length}개입니다 — 셀 안에 '|'가 있는지 확인하세요 (항목 분리는 ','를 씁니다)`);
  }
}

/**
 * Parses one glossary document into terms (keyed by lowercase English),
 * expression rules (keyed by pattern text), base-rule exceptions, and the
 * keep-original terms of the 원문 유지 용어 table.
 */
export function parseGlossary(body, origin, sourceName) {
  const terms = new Map();
  const expressions = new Map();
  const exceptions = [];
  const keepOriginal = [];

  for (const cells of tableRowsUnderHeading(body, '용어 대역표') ?? []) {
    warnExtraColumns(cells, sourceName, '용어 대역표');
    const [english, korean = '', banned = ''] = cells;
    if (!english) continue;
    const rules = splitItems(banned).map((item) => ({
      pattern: compilePattern(item, sourceName),
      source: item,
      suggestion: korean,
      label: `용어: ${english}`,
      level: 'error',
      threshold: 1,
      origin,
    }));
    terms.set(english.toLowerCase(), {english, korean, rules});
  }

  for (const cells of tableRowsUnderHeading(body, '금지 표현') ?? []) {
    warnExtraColumns(cells, sourceName, '금지 표현');
    const [banned, replacement = '', levelCell = '', note = ''] = cells;
    if (!banned || !levelCell) continue;
    const {level, threshold} = parseLevel(levelCell, sourceName);
    for (const item of splitItems(banned)) {
      expressions.set(item, {
        pattern: compilePattern(item, sourceName),
        source: item,
        suggestion: replacement,
        label: note || '금지 표현',
        level,
        threshold,
        origin,
      });
    }
  }

  for (const cells of tableRowsUnderHeading(body, '화면 금지 표현') ?? []) {
    warnExtraColumns(cells, sourceName, '화면 금지 표현');
    const [banned, replacement = '', levelCell = '', note = ''] = cells;
    if (!banned || !levelCell) continue;
    const {level, threshold} = parseLevel(levelCell, sourceName);
    for (const item of splitItems(banned)) {
      expressions.set(`screen:${item}`, {
        pattern: compilePattern(item, sourceName),
        source: item,
        suggestion: replacement,
        label: note || '화면 금지 표현',
        level,
        threshold,
        screenOnly: true,
        origin,
      });
    }
  }

  for (const cells of tableRowsUnderHeading(body, '기본 규칙 예외') ?? []) {
    if (cells[0]) exceptions.push(cells[0].trim());
  }

  // The keep-original table is reference prose for a reader, but its plain
  // ASCII items double as proper nouns for the untranslated-value check: a
  // Korean catalogue value made only of them is finished copy. Items that
  // carry Hangul or parentheses are category descriptions, not terms.
  for (const cells of tableRowsUnderHeading(body, '원문 유지 용어') ?? []) {
    for (const item of splitItems(cells[0] ?? '')) {
      if (/^[A-Za-z0-9][A-Za-z0-9 .+_/-]*$/.test(item)) keepOriginal.push(item);
    }
  }

  return {terms, expressions, exceptions, keepOriginal};
}

export function emptyGlossary() {
  return {terms: new Map(), expressions: new Map(), exceptions: [], keepOriginal: []};
}

// ---------------------------------------------------------------------------
// Built-in checks the audit engine runs beside the glossary rules
// ---------------------------------------------------------------------------
//
// A glossary rule is a banned spelling; these are checks written in code because no table
// can express them. Both are rules a repository lives under, so both answer to the same
// door — `## 기본 규칙 예외` in the project glossary — rather than to a second mechanism
// nobody remembers exists.
//
// **What separates the two halves is the level, not the subject.** A warning names a line
// somebody has to judge, and judgement is exactly what a project can settle once for its
// whole corpus: a rulebook whose headings ARE its rules is not a rulebook with 53 defects.
// An error names something wrong in every context — a particle disagreeing with the syllable
// before it is not a house style — so those have no door, and naming one is refused rather
// than honoured, because an exception that reads as accepted and disables nothing is the
// failure this file already carries a dead-exception report for.
export const EXEMPTABLE_CHECKS = new Map([
  ['heading-form', '제목이 서술문이다'],
  ['repeat', '같은 말이 잇달아 나옴'],
  ['untranslated', '번역 미완 가능성'],
]);
export const FIXED_CHECKS = new Map([
  ['particle', '조사 어긋남'],
  ['interpolated-particle', '치환값 뒤의 조사'],
  ['reference-particle', '참조 뒤의 조사'],
]);

/** Merges base and project rules into a flat, deduplicated rule list. */
export function mergeGlossaries(base, project) {
  const terms = new Map(base.terms);
  const expressions = new Map(base.expressions);

  // **An exception is matched by the rule's pattern TEXT, so editing a base pattern silently
  // kills every project exception keyed to it.** The project reads as if the rule were still
  // off and the finding comes back under a new name — indistinguishable from a fresh defect.
  // So an exception that disabled nothing is reported rather than dropped.
  const deadExceptions = [];
  const disabledChecks = new Map();
  if (project) {
    for (const raw of project.exceptions) {
      if (EXEMPTABLE_CHECKS.has(raw)) {
        disabledChecks.set(raw, EXEMPTABLE_CHECKS.get(raw));
        continue;
      }
      if (FIXED_CHECKS.has(raw)) {
        throw new Error(
          `기본 규칙 예외로 끌 수 없는 검사입니다: ${raw} (${FIXED_CHECKS.get(raw)}) — ` +
            `오류 수준의 내장 검사는 문맥이 갈리지 않아 예외를 두지 않습니다. ` +
            `끌 수 있는 것: ${[...EXEMPTABLE_CHECKS.keys()].join(' · ')}`,
        );
      }
      const key = raw.toLowerCase();
      const before = terms.size + expressions.size;
      let disabledSomething = terms.has(key);
      terms.delete(key);
      for (const [src, rule] of [...expressions]) {
        // Compared on the rule's own pattern text rather than the map key, so an exception
        // reaches a screen-only rule as well — its key carries a scope prefix.
        if (rule.source === raw || rule.source.toLowerCase() === key) expressions.delete(src);
      }
      for (const [tKey, term] of terms) {
        const filtered = term.rules.filter((r) => r.source !== raw);
        if (filtered.length !== term.rules.length) {
          terms.set(tKey, {...term, rules: filtered});
          disabledSomething = true;
        }
      }
      if (!disabledSomething && terms.size + expressions.size === before) deadExceptions.push(raw);
    }
    for (const [key, term] of project.terms) terms.set(key, term);
    for (const [src, rule] of project.expressions) expressions.set(src, rule);
  }

  // Deduplicated by pattern AND scope, so one word may be a warning everywhere and an error on
  // screen without either rule swallowing the other.
  const scoped = (rule) => `${rule.screenOnly ? 'screen:' : ''}${rule.source}`;
  const rules = [];
  const seen = new Set();
  for (const term of terms.values()) {
    for (const r of term.rules) {
      if (seen.has(scoped(r))) continue;
      seen.add(scoped(r));
      rules.push(r);
    }
  }
  for (const rule of expressions.values()) {
    if (seen.has(scoped(rule))) continue;
    seen.add(scoped(rule));
    rules.push(rule);
  }
  return {rules, terms, deadExceptions, disabledChecks};
}

// ---------------------------------------------------------------------------
// Rule set loading — one call that both tools share
// ---------------------------------------------------------------------------

/**
 * Loads and merges the base and project glossaries.
 *
 * Returns {rules, terms, config, root, glossaryPath, keepOriginal}:
 *   rules        — flat merged rule list (pattern, source, suggestion, label,
 *                  level, threshold, screenOnly?, origin)
 *   terms        — merged 용어 대역표 map (english → {english, korean, rules})
 *   config       — audit config from the project glossary's front matter
 *   root         — project root (directory holding the glossary, or startDir)
 *   glossaryPath — project glossary path, or null when none was found
 *   keepOriginal — plain-ASCII terms of the merged 원문 유지 용어 tables
 *   disabledChecks — built-in checks the project turned off (id → label)
 */
export function loadRuleSet({glossaryPath = null, noBase = false, startDir = process.cwd()} = {}) {
  let discovered = null;
  if (glossaryPath) {
    const p = resolve(glossaryPath);
    if (!existsSync(p)) throw new Error(`용어사전을 찾을 수 없습니다: ${glossaryPath}`);
    discovered = {path: p, root: rootFromGlossaryPath(p)};
  } else {
    discovered = discoverGlossary(startDir);
  }

  let project = null;
  let config = {paths: [], exclude: [], localeResources: [], localeAnnotationKeys: [], untranslated: false};
  let root = resolve(startDir);
  if (discovered) {
    const parsed = parseGlossaryConfig(readFileSync(discovered.path, 'utf8'));
    config = parsed.config;
    project = parseGlossary(parsed.body, 'project', discovered.path);
    root = discovered.root;
  }

  let base = emptyGlossary();
  if (!noBase) {
    if (!existsSync(BASE_GLOSSARY_PATH)) throw new Error(`기본 용어사전이 없습니다: ${BASE_GLOSSARY_PATH}`);
    base = parseGlossary(readFileSync(BASE_GLOSSARY_PATH, 'utf8'), 'base', BASE_GLOSSARY_PATH);
  }

  const {rules, terms, deadExceptions, disabledChecks} = mergeGlossaries(base, project);
  const keepOriginal = [...base.keepOriginal, ...(project?.keepOriginal ?? [])];
  return {rules, terms, config, root, glossaryPath: discovered?.path ?? null, keepOriginal, deadExceptions, disabledChecks};
}

// ---------------------------------------------------------------------------
// Style rule packs (RULES.base.json + optional project pack)
// ---------------------------------------------------------------------------

/**
 * Loads the skill's base style-rule pack, plus the project's own pack when
 * one exists at <root>/.claude/l10n-rules.json.
 *
 * A pack rule states sentence-level patterns a glossary table cannot express
 * safely — each carries hit/miss examples that `rules --test` verifies. Rules
 * are advisory sweeps (the finds-only loop), never write-time gates.
 *
 * `scopes` filters by rule scope: 'universal' rules always apply; any other
 * scope applies only when listed (a project opts into its domains).
 */
export function loadRulePacks({root = process.cwd(), scopes = []} = {}) {
  const packs = [];
  if (existsSync(BASE_RULE_PACK_PATH)) {
    packs.push({origin: 'base', path: BASE_RULE_PACK_PATH, ...JSON.parse(readFileSync(BASE_RULE_PACK_PATH, 'utf8'))});
  }
  const projectPack = join(root, '.claude', 'l10n-rules.json');
  if (existsSync(projectPack)) {
    packs.push({origin: 'project', path: projectPack, ...JSON.parse(readFileSync(projectPack, 'utf8'))});
  }
  // A base rule can be true everywhere and still be wrong for one domain — the glossary has
  // `## 기본 규칙 예외` for exactly that, and without the same door here a project's only
  // choices are editing the shared base pack (forbidden: it would break other projects) or
  // carrying a permanent false positive, which is how a count stops meaning anything.
  // `{"disable": {"rule-id": "왜 끄는가"}}` in the project pack, reason required.
  const disabled = new Map();
  for (const pack of packs) {
    if (pack.origin !== 'project') continue;
    for (const [id, why] of Object.entries(pack.disable ?? {})) {
      if (!String(why ?? '').trim()) {
        throw new Error(`${pack.path}: disable["${id}"]에 끄는 까닭을 적어야 한다 — 까닭 없는 예외는 다음 사람이 되살릴 수 없다.`);
      }
      disabled.set(id, why);
    }
  }
  const known = new Set(packs.flatMap((p) => (p.rules ?? []).map((r) => r.id)));
  for (const id of disabled.keys()) {
    if (!known.has(id)) throw new Error(`알 수 없는 규칙을 끄려 한다: ${id}`);
  }
  // Killing a rule is not the only thing a project needs. A base rule can be right about
  // sixteen words and wrong about one PLACE — a requirement title quoted from a client's
  // document keeps that document's spelling, and correcting it makes it no longer a
  // quotation. `disable` there would drop the other sixteen spellings with it, which is how
  // a project ends up choosing between a permanent false positive and a check that stopped
  // looking. So a project may also NARROW a base rule:
  //
  //   "except": { "<rule-id>": [{ "find": "/…/", "why": "…", "sample": "…" }] }
  //
  // A hit is released when an exception's match COVERS the place the rule fired — not merely
  // appears in the same segment, which would excuse a real defect standing next to a quotation.
  // `why` and `sample` are both required, and `rules --test` proves each one: the rule has to
  // catch the sample and the exception has to release it. An exception that proves nothing is
  // a rule switched off in a shape that reads as switched on.
  const except = new Map();
  for (const pack of packs) {
    if (pack.origin !== 'project') continue;
    for (const [id, list] of Object.entries(pack.except ?? {})) {
      if (!known.has(id)) throw new Error(`알 수 없는 규칙에 예외를 걸려 한다: ${id}`);
      const items = (Array.isArray(list) ? list : [list]).map((it) => {
        for (const field of ['find', 'why', 'sample']) {
          if (!String(it?.[field] ?? '').trim()) {
            throw new Error(`${pack.path}: except["${id}"]의 ${field}가 비었다 — ` +
              'find(무엇을 놓아 주는가) · why(왜) · sample(그 예외가 실제로 놓아 주는 문장)이 다 있어야 한다.');
          }
        }
        const raw = it.find;
        const delimited = raw.length > 2 && raw.startsWith('/') && raw.endsWith('/');
        return {...it, re: new RegExp(delimited ? raw.slice(1, -1) : raw, 'g')};
      });
      except.set(id, [...(except.get(id) ?? []), ...items]);
    }
  }

  const active = [];
  const all = [];
  for (const pack of packs) {
    for (const rule of pack.rules ?? []) {
      const tagged = {...rule, origin: pack.origin, disabledWhy: disabled.get(rule.id), except: except.get(rule.id)};
      all.push(tagged);
      if (disabled.has(rule.id)) continue;
      // A project pack is opted in by existing; its scopes are the project's own.
      if (rule.scope === 'universal' || pack.origin === 'project' || scopes.includes(rule.scope)) {
        active.push(tagged);
      }
    }
  }
  return {active, all, disabled, except};
}
