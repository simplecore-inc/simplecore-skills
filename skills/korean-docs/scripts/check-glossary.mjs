#!/usr/bin/env node
/**
 * Korean glossary audit for markdown/MDX documents.
 *
 * Rule sources, merged before auditing:
 *   1. The base glossary bundled with this skill (../GLOSSARY.base.md) —
 *      project-independent orthography and translation-ese rules.
 *   2. The project glossary, discovered by walking up from cwd and checking
 *      <dir>/.claude/GLOSSARY.md (default location) then <dir>/GLOSSARY.md
 *      in each directory. The directory that holds the glossary becomes the
 *      project root for path resolution.
 *
 * A project glossary customizes the base rules:
 *   - A "용어 대역표" row whose 영어 key matches a base row replaces it.
 *   - A "금지 표현" row whose 금지 pattern matches a base item replaces it.
 *   - A "기본 규칙 예외" table disables base rules by 영어 key (whole row)
 *     or by exact pattern text (single rule).
 *
 * The project glossary may carry audit configuration in YAML front matter:
 *   ---
 *   audit:
 *     paths: [docs]              # default audit targets, relative to project root
 *     exclude: ["**\/legacy/**"]  # glob patterns removed from any scan
 *     untranslated: false        # true = warn about remaining English prose
 *   ---
 *
 * Usage:
 *   check-glossary.mjs [paths...]  files or directories; default = audit.paths,
 *                                  else a project-wide scan
 *   --all             project-wide scan even when audit.paths is configured
 *   --strict          warnings also fail (exit 1)
 *   --untranslated    warn about English prose lines (translation projects)
 *   --glossary <p>    use an explicit project glossary instead of discovery
 *   --no-base         skip the bundled base glossary
 *   --list-rules      print the merged rule set and exit
 *   --init            create .claude/GLOSSARY.md from the bundled template
 *
 * Exit codes: 0 = clean, 1 = violations (errors, or warnings with --strict),
 * 2 = usage or parse failure.
 */

import {readFileSync, readdirSync, existsSync, statSync, mkdirSync, writeFileSync} from 'node:fs';
import {join, relative, resolve, dirname, basename, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {homedir} from 'node:os';

const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const BASE_GLOSSARY_PATH = join(SKILL_DIR, 'GLOSSARY.base.md');
const TEMPLATE_PATH = join(SKILL_DIR, 'templates', 'GLOSSARY.md');
const SCRIPT_PATH = fileURLToPath(import.meta.url);

// Directories never scanned by default. Dot-directories (.git, .claude,
// .docusaurus, ...) are skipped as well. Explicit path arguments bypass this
// for the argument itself, so any of these can still be audited on demand.
const DEFAULT_EXCLUDE_DIRS = new Set(['node_modules', 'dist', 'build', 'out', 'target', 'coverage', 'vendor']);

// ---------------------------------------------------------------------------
// Glossary discovery
// ---------------------------------------------------------------------------

function discoverGlossary(startDir = process.cwd()) {
  const home = homedir();
  let dir = resolve(startDir);
  while (true) {
    for (const candidate of [join(dir, '.claude', 'GLOSSARY.md'), join(dir, 'GLOSSARY.md')]) {
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        return {path: candidate, root: dir};
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

function rootFromGlossaryPath(glossaryPath) {
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

function parseGlossaryConfig(markdown) {
  const config = {paths: [], exclude: [], untranslated: false};
  const lines = markdown.split('\n');
  if (lines[0]?.trim() !== '---') return {config, body: markdown};
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') { end = i; break; }
  }
  if (end === -1) return {config, body: markdown};

  let inAudit = false;
  let listKey = null;
  for (const raw of lines.slice(1, end)) {
    const line = raw.replace(/(^|\s)#.*$/, '$1');
    if (!line.trim()) continue;
    if (!/^\s/.test(line)) {
      inAudit = /^audit:\s*$/.test(line.trim());
      listKey = null;
      continue;
    }
    if (!inAudit) continue;
    const kv = line.match(/^\s+(paths|exclude|untranslated)\s*:\s*(.*)$/);
    if (kv) {
      const [, key, rest] = kv;
      const value = rest.trim();
      listKey = null;
      if (key === 'untranslated') {
        config.untranslated = value === 'true';
      } else if (value.startsWith('[')) {
        config[key] = parseInlineArray(value);
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
function tableRowsUnderHeading(markdown, heading) {
  const lines = markdown.split('\n');
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
function compilePattern(item, sourceName) {
  const m = item.match(/^\/(.+)\/$/);
  try {
    return m ? new RegExp(m[1], 'g') : new RegExp(escapeRegExp(item), 'g');
  } catch (err) {
    throw new Error(`${sourceName}: 잘못된 패턴 "${item}": ${err.message}`);
  }
}

function escapeRegExp(s) {
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
 * Parses one glossary document into terms (keyed by lowercase English),
 * expression rules (keyed by pattern text), and base-rule exceptions.
 */
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

function parseGlossary(body, origin, sourceName) {
  const terms = new Map();
  const expressions = new Map();
  const exceptions = [];

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
    terms.set(english.toLowerCase(), {english, rules});
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

  for (const cells of tableRowsUnderHeading(body, '기본 규칙 예외') ?? []) {
    if (cells[0]) exceptions.push(cells[0].trim());
  }

  return {terms, expressions, exceptions};
}

function emptyGlossary() {
  return {terms: new Map(), expressions: new Map(), exceptions: []};
}

/** Merges base and project rules into a flat, deduplicated rule list. */
function mergeGlossaries(base, project) {
  const terms = new Map(base.terms);
  const expressions = new Map(base.expressions);

  if (project) {
    for (const raw of project.exceptions) {
      const key = raw.toLowerCase();
      terms.delete(key);
      for (const src of [...expressions.keys()]) {
        if (src === raw || src.toLowerCase() === key) expressions.delete(src);
      }
      for (const [tKey, term] of terms) {
        const filtered = term.rules.filter((r) => r.source !== raw);
        if (filtered.length !== term.rules.length) terms.set(tKey, {...term, rules: filtered});
      }
    }
    for (const [key, term] of project.terms) terms.set(key, term);
    for (const [src, rule] of project.expressions) expressions.set(src, rule);
  }

  const rules = [];
  const seen = new Set();
  for (const term of terms.values()) {
    for (const r of term.rules) {
      if (seen.has(r.source)) continue;
      seen.add(r.source);
      rules.push(r);
    }
  }
  for (const [src, rule] of expressions) {
    if (seen.has(src)) continue;
    seen.add(src);
    rules.push(rule);
  }
  return rules;
}

// ---------------------------------------------------------------------------
// Target file resolution
// ---------------------------------------------------------------------------

function walk(dir) {
  const found = [];
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || DEFAULT_EXCLUDE_DIRS.has(entry.name)) continue;
      found.push(...walk(full));
    } else if (/\.(md|mdx)$/.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

function globToRegExp(glob) {
  let re = '';
  let i = 0;
  while (i < glob.length) {
    if (glob.startsWith('**/', i)) { re += '(?:.*/)?'; i += 3; }
    else if (glob.startsWith('**', i)) { re += '.*'; i += 2; }
    else if (glob[i] === '*') { re += '[^/]*'; i += 1; }
    else if (glob[i] === '?') { re += '[^/]'; i += 1; }
    else { re += escapeRegExp(glob[i]); i += 1; }
  }
  return new RegExp(`^${re}$`);
}

/** Patterns without a slash match any path segment; others match the whole relative path. */
function makeExcludeMatcher(pattern) {
  const re = globToRegExp(pattern);
  if (pattern.includes('/')) return (rel) => re.test(rel);
  return (rel) => rel.split('/').some((seg) => re.test(seg));
}

function findPath(p, root, label) {
  const found = [resolve(p), join(root, p)].find((c) => existsSync(c));
  if (!found) throw new Error(`${label} 경로를 찾을 수 없습니다: ${p}`);
  return found;
}

/**
 * Resolves audit targets. Explicitly named files are always audited —
 * audit.exclude applies only to files discovered by scanning (directory
 * walks, audit.paths, project-wide scan), so naming a file cannot silently
 * report "clean" because a glob filtered it out. The glossary file itself is
 * never audited (it lists banned terms by definition).
 */
function resolveTargets(args, config, root, glossaryPath) {
  const direct = [];
  const scanned = [];
  if (args.paths.length > 0) {
    for (const p of args.paths) {
      const found = findPath(p, root, '지정한');
      if (statSync(found).isDirectory()) scanned.push(...walk(found));
      else direct.push(found);
    }
  } else if (!args.all && config.paths.length > 0) {
    for (const p of config.paths) {
      const found = findPath(p, root, 'audit.paths');
      if (statSync(found).isDirectory()) scanned.push(...walk(found));
      else scanned.push(found);
    }
  } else {
    scanned.push(...walk(root));
  }

  const excludes = config.exclude.map(makeExcludeMatcher);
  const glossaryAbs = glossaryPath ? resolve(glossaryPath) : null;
  const files = [];
  let excludedCount = 0;
  let glossarySkipped = false;
  const seen = new Set();
  for (const {file, isDirect} of [
    ...direct.map((f) => ({file: resolve(f), isDirect: true})),
    ...scanned.map((f) => ({file: resolve(f), isDirect: false})),
  ]) {
    if (seen.has(file)) continue;
    seen.add(file);
    if (file === glossaryAbs) {
      glossarySkipped = true;
      continue;
    }
    if (!isDirect) {
      const rel = relative(root, file).split(sep).join('/');
      if (excludes.some((matches) => matches(rel))) {
        excludedCount++;
        continue;
      }
    }
    files.push(file);
  }
  files.sort();
  return {files, excludedCount, glossarySkipped};
}

// ---------------------------------------------------------------------------
// Content stripping (exclude code and link targets from matching)
// ---------------------------------------------------------------------------

function blank(match) {
  return ' '.repeat(match.length);
}

/** Returns lines with unmatchable regions blanked out, preserving line numbers and offsets. */
function stripLines(content) {
  const lines = content.split('\n');
  let inFence = false;
  let inJsxTemplate = false;
  let inJsxComment = false;
  return lines.map((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return '';
    }
    if (inFence) return '';
    // JSX components wrapping a template literal (e.g. <Mermaid chart={`...`}/>)
    // hold diagram/grammar source rather than prose.
    if (/^\s*<[A-Za-z][A-Za-z0-9]*[^{]*\{`\s*$/.test(line)) {
      inJsxTemplate = true;
      return '';
    }
    if (inJsxTemplate) {
      if (/^\s*`\}\s*(\/>|<\/[A-Za-z][A-Za-z0-9]*>)\s*$/.test(line)) inJsxTemplate = false;
      return '';
    }
    // {/* ... */} JSX comments (license headers etc.) are not prose.
    if (/^\s*\{\/\*\s*$/.test(line)) {
      inJsxComment = true;
      return '';
    }
    if (inJsxComment) {
      if (/^\s*\*\/\}\s*$/.test(line)) inJsxComment = false;
      return '';
    }
    let l = line;
    if (/^\s*(import|export)\s/.test(l)) return '';
    l = l.replace(/`[^`]*`/g, blank); // inline code
    l = l.replace(/\]\([^)]*\)/g, (m) => `](${' '.repeat(m.length - 3)})`); // link targets
    l = l.replace(/<!--.*?-->/g, blank); // single-line HTML comments
    l = l.replace(/https?:\/\/\S+/g, blank); // bare URLs
    return l;
  });
}

// ---------------------------------------------------------------------------
// Auditing
// ---------------------------------------------------------------------------

/** Returns the [start, end] line indexes of the front matter block, or null. */
function frontMatterRange(rawLines) {
  if (rawLines[0]?.trim() !== '---') return null;
  for (let i = 1; i < rawLines.length; i++) {
    if (rawLines[i].trim() === '---') return {start: 0, end: i};
  }
  return null;
}

function auditFile(filePath, rules, checkUntranslated) {
  const content = readFileSync(filePath, 'utf8');
  const lines = stripLines(content);
  const fm = frontMatterRange(content.split('\n'));
  const errors = [];
  const warnings = [];

  for (const rule of rules) {
    const hits = [];
    lines.forEach((line, idx) => {
      rule.pattern.lastIndex = 0;
      for (const m of line.matchAll(rule.pattern)) {
        hits.push({line: idx + 1, text: m[0]});
      }
    });
    if (hits.length === 0 || hits.length < rule.threshold) continue;
    const bucket = rule.level === 'error' ? errors : warnings;
    for (const hit of hits) {
      bucket.push({...hit, rule, count: hits.length});
    }
  }

  // Untranslated-content heuristic: flag remaining English prose lines.
  if (checkUntranslated) {
    const englishProse = [];
    lines.forEach((line, idx) => {
      // Inside front matter only title/description hold translatable prose.
      if (fm && idx >= fm.start && idx <= fm.end && !/^\s*(title|description)\s*:/.test(line)) return;
      const t = line.trim();
      if (t.length < 20) return;
      if (/^(\||:::|---|<|!\[|#{1,6}\s*$)/.test(t)) return;
      if (/[가-힣]/.test(t)) return;
      // A list item that is one bare identifier is an API/config reference,
      // not prose to translate.
      if (/^[-*]\s+\S+$/.test(t)) return;
      // Headings dominated by ALL-CAPS tokens are syntax or acronym titles.
      if (/^#{1,6}\s/.test(t)) {
        const capsTokens = t.match(/\b[A-Z][A-Z0-9_]+\b/g) || [];
        if (capsTokens.length >= 2) return;
      }
      const words = t.match(/[A-Za-z]{2,}/g) || [];
      if (words.length >= 4) englishProse.push(idx + 1);
    });
    if (englishProse.length > 0) {
      warnings.push({
        line: englishProse[0],
        text: `영문 문장 ${englishProse.length}줄 잔존 (줄: ${englishProse.slice(0, 10).join(', ')}${englishProse.length > 10 ? ' …' : ''})`,
        rule: {source: 'untranslated', suggestion: '번역 필요 여부 확인', label: '번역 미완 가능성', level: 'warn', threshold: 1},
        count: englishProse.length,
      });
    }
  }

  return {errors, warnings};
}

function formatFinding(relPath, f, kind) {
  const tag = kind === 'error' ? '오류' : '경고';
  const countInfo = f.rule.threshold > 1 ? ` [파일 내 ${f.count}회]` : '';
  return `${relPath}:${f.line}: [${tag}] "${f.text}" → ${f.rule.suggestion} (${f.rule.label})${countInfo}`;
}

// ---------------------------------------------------------------------------
// Init (project glossary bootstrap)
// ---------------------------------------------------------------------------

function initGlossary() {
  const existing = discoverGlossary();
  if (existing) {
    console.log(`이미 용어사전이 있습니다: ${existing.path}`);
    console.log('이 프로젝트에 별도 용어사전이 필요하면 templates/GLOSSARY.md를 직접 복사하세요.');
    process.exitCode = 2;
    return;
  }
  const target = join(process.cwd(), '.claude', 'GLOSSARY.md');
  mkdirSync(dirname(target), {recursive: true});
  writeFileSync(target, readFileSync(TEMPLATE_PATH, 'utf8'), {flag: 'wx'});
  console.log(`프로젝트 용어사전을 생성했습니다: ${relative(process.cwd(), target)}`);
  console.log('다음 단계:');
  console.log('  1. 파일 상단의 <프로젝트명>을 채우고, 작업하면서 용어를 등재합니다.');
  console.log('  2. front matter의 audit.paths에 기본 감사 대상을 지정합니다 (예: [docs]).');
  console.log(`  3. 감사 실행: node ${SCRIPT_PATH} [경로...]`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {all: false, strict: false, untranslated: false, noBase: false, listRules: false, init: false, glossary: null, paths: []};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--all') args.all = true;
    else if (a === '--strict') args.strict = true;
    else if (a === '--untranslated') args.untranslated = true;
    else if (a === '--no-base') args.noBase = true;
    else if (a === '--list-rules') args.listRules = true;
    else if (a === '--init') args.init = true;
    else if (a === '--glossary') {
      args.glossary = argv[++i];
      if (!args.glossary) throw new Error('--glossary 뒤에 경로가 필요합니다');
    } else if (a.startsWith('--')) throw new Error(`알 수 없는 플래그: ${a}`);
    else args.paths.push(a);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.init) return initGlossary();

  let discovered = null;
  if (args.glossary) {
    const p = resolve(args.glossary);
    if (!existsSync(p)) throw new Error(`용어사전을 찾을 수 없습니다: ${args.glossary}`);
    discovered = {path: p, root: rootFromGlossaryPath(p)};
  } else {
    discovered = discoverGlossary();
  }

  let project = null;
  let config = {paths: [], exclude: [], untranslated: false};
  let root = process.cwd();
  if (discovered) {
    const parsed = parseGlossaryConfig(readFileSync(discovered.path, 'utf8'));
    config = parsed.config;
    project = parseGlossary(parsed.body, 'project', discovered.path);
    root = discovered.root;
  }

  let base = emptyGlossary();
  if (!args.noBase) {
    if (!existsSync(BASE_GLOSSARY_PATH)) throw new Error(`기본 용어사전이 없습니다: ${BASE_GLOSSARY_PATH}`);
    base = parseGlossary(readFileSync(BASE_GLOSSARY_PATH, 'utf8'), 'base', BASE_GLOSSARY_PATH);
  }

  const rules = mergeGlossaries(base, project);

  if (args.listRules) {
    for (const r of rules) {
      console.log(`[${r.origin === 'base' ? '기본' : '프로젝트'}] [${r.level}${r.threshold > 1 ? ` ${r.threshold}+` : ''}] ${r.source} → ${r.suggestion} (${r.label})`);
    }
    console.log(`\n규칙 ${rules.length}개 로드됨.`);
    return;
  }

  if (discovered) {
    const shown = relative(process.cwd(), discovered.path) || discovered.path;
    console.log(`용어사전: ${shown}${args.noBase ? '' : ' + 기본 용어사전'} (규칙 ${rules.length}개)`);
  } else {
    console.log('프로젝트 용어사전이 없습니다 — 기본 용어사전만으로 검사합니다.');
    console.log('프로젝트 용어사전을 만들려면 (기본 위치: .claude/GLOSSARY.md):');
    console.log(`  node ${SCRIPT_PATH} --init`);
  }
  console.log('');

  const {files: targets, excludedCount, glossarySkipped} = resolveTargets(args, config, root, discovered?.path);
  if (excludedCount > 0) console.log(`audit.exclude 패턴으로 파일 ${excludedCount}개 제외됨`);
  if (glossarySkipped) console.log('용어사전 파일 자체는 감사 대상에서 제외됩니다');
  if (targets.length === 0) {
    console.log('검사 대상 파일이 없습니다.');
    return;
  }

  const checkUntranslated = args.untranslated || config.untranslated;
  let errorCount = 0;
  let warningCount = 0;
  for (const file of targets) {
    const rel = relative(root, file);
    const relPath = rel.startsWith('..') ? file : rel;
    const {errors, warnings} = auditFile(file, rules, checkUntranslated);
    errorCount += errors.length;
    warningCount += warnings.length;
    for (const f of errors) console.log(formatFinding(relPath, f, 'error'));
    for (const f of warnings) console.log(formatFinding(relPath, f, 'warn'));
  }

  console.log(`\n검사 완료: 파일 ${targets.length}개, 오류 ${errorCount}건, 경고 ${warningCount}건`);
  if (errorCount > 0 || (args.strict && warningCount > 0)) {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (err) {
  console.error(String(err.message || err));
  process.exitCode = 2;
}
