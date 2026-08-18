/**
 * Document audit engine for the korean-docs tools.
 *
 * Audits Markdown/MDX prose, SVG <text>/<tspan> labels, and the quoted string
 * values of declared locale-resource files against the merged glossary rules.
 * Two callers share it: check-glossary.mjs (the CLI the write-time hook runs)
 * and l10n.mjs's `check` subcommand — one engine, so both report identically.
 */

import {readFileSync, readdirSync, existsSync, statSync, mkdirSync, writeFileSync} from 'node:fs';
import {join, relative, resolve, dirname, sep} from 'node:path';
import {
  BASE_GLOSSARY_PATH,
  TEMPLATE_PATH,
  discoverGlossary,
  rootFromGlossaryPath,
  parseGlossaryConfig,
  parseGlossary,
  emptyGlossary,
  mergeGlossaries,
  escapeRegExp,
} from './glossary.mjs';

// Directories never scanned by default. Dot-directories (.git, .claude,
// .docusaurus, ...) are skipped as well. Explicit path arguments bypass this
// for the argument itself, so any of these can still be audited on demand.
const DEFAULT_EXCLUDE_DIRS = new Set(['node_modules', 'dist', 'build', 'out', 'target', 'coverage', 'vendor']);

// ---------------------------------------------------------------------------
// Target file resolution
// ---------------------------------------------------------------------------

/**
 * Collects auditable files under `dir`. Markdown, MDX and SVG are auditable by
 * extension; locale resource files are auditable because the project declared
 * their paths, so `isLocaleResource` decides them regardless of extension.
 */
function walk(dir, isLocaleResource = () => false) {
  const found = [];
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || DEFAULT_EXCLUDE_DIRS.has(entry.name)) continue;
      found.push(...walk(full, isLocaleResource));
    } else if (/\.(md|mdx|svg)$/.test(entry.name) || isLocaleResource(full)) {
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

/**
 * Builds the audit.localeResources predicate over absolute paths. Patterns use
 * the same glob engine and the same relative-to-project-root semantics as
 * audit.exclude. With no patterns declared, nothing is a locale resource.
 */
/**
 * The directory a pattern can possibly match under: its leading segments up to
 * the first one carrying a glob metacharacter. `wireframes/src/*.mjs` can only
 * match inside `wireframes/src`, so that subtree is the whole search space.
 */
function patternBaseDir(pattern) {
  const segments = pattern.split('/');
  const literal = [];
  for (const seg of segments.slice(0, -1)) {
    if (/[*?]/.test(seg)) break;
    literal.push(seg);
  }
  return literal.join('/');
}

/** Every file under `dir`, with the same directory exclusions the audit walk uses. */
function walkAll(dir, out = []) {
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || DEFAULT_EXCLUDE_DIRS.has(entry.name)) continue;
      walkAll(join(dir, entry.name), out);
    } else {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

/**
 * What each declared audit.localeResources pattern matches **in the repository**,
 * independent of what this run happens to scan.
 *
 * The run's own target list cannot answer this. A run scoped to one Markdown file
 * scans no resources by definition, so counting resources among its targets reports
 * zero for a declaration that is perfectly correct — and the write-time hook scopes
 * every run to one file. Judging the patterns against the tree separates a narrowed
 * scope from a declaration that reaches nothing, which is the only one of the two
 * that anybody can act on.
 *
 * Only each pattern's base directory is walked, so validating a declaration costs
 * the subtree it names rather than the repository.
 */
export function localeResourceCoverage(patterns, root) {
  const cache = new Map();
  const filesUnder = (base) => {
    if (!cache.has(base)) {
      const dir = base ? join(root, base) : root;
      cache.set(base, existsSync(dir) && statSync(dir).isDirectory() ? walkAll(dir) : null);
    }
    return cache.get(base);
  };

  const matched = new Set();
  const perPattern = patterns.map((pattern) => {
    const base = patternBaseDir(pattern);
    const files = filesUnder(base);
    if (files === null) return {pattern, count: 0, reason: `${base || '.'} 디렉터리가 없습니다`};
    const matches = makeExcludeMatcher(pattern);
    let count = 0;
    for (const file of files) {
      const rel = relative(root, file).split(sep).join('/');
      if (!matches(rel)) continue;
      count++;
      matched.add(rel);
    }
    return {pattern, count, reason: count === 0 ? '이 패턴과 맞는 파일이 없습니다' : null};
  });
  return {perPattern, total: matched.size};
}

export function makeLocaleResourceMatcher(patterns, root) {
  if (patterns.length === 0) return () => false;
  const matchers = patterns.map(makeExcludeMatcher);
  return (file) => {
    const rel = relative(root, resolve(file)).split(sep).join('/');
    if (rel.startsWith('..')) return false;
    return matchers.some((matches) => matches(rel));
  };
}

/**
 * Where glossary discovery starts.
 *
 * **The glossary belongs to the audited file, not to the shell.** Starting from
 * cwd means naming a path outside the current directory's project — which every
 * caller passing an absolute path does — discovers no glossary at all: the
 * project's own rules fall away to the base set, its locale resources stop
 * being recognised, and the run still exits 0. Starting from the first target
 * that exists makes the audit the same whichever directory it is invoked from.
 */
function discoveryStart(paths = []) {
  for (const p of paths) {
    const abs = resolve(p);
    if (!existsSync(abs)) continue;
    return statSync(abs).isDirectory() ? abs : dirname(abs);
  }
  return process.cwd();
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
function resolveTargets(args, config, root, glossaryPath, isLocaleResource) {
  const direct = [];
  const scanned = [];
  if (args.paths.length > 0) {
    for (const p of args.paths) {
      const found = findPath(p, root, '지정한');
      if (statSync(found).isDirectory()) scanned.push(...walk(found, isLocaleResource));
      else direct.push(found);
    }
  } else if (!args.all && config.paths.length > 0) {
    for (const p of config.paths) {
      const found = findPath(p, root, 'audit.paths');
      if (statSync(found).isDirectory()) scanned.push(...walk(found, isLocaleResource));
      else scanned.push(found);
    }
  } else {
    scanned.push(...walk(root, isLocaleResource));
  }

  const excludes = config.exclude.map(makeExcludeMatcher);
  // A glossary is by definition a page of banned spellings, so it is never judged by them. The
  // project's own was already skipped; the base one sat inside the skill and was not, so a repo
  // that holds the skill got 163 findings that were every row of the table quoting itself.
  const glossaries = new Set([glossaryPath, BASE_GLOSSARY_PATH].filter(Boolean).map((p) => resolve(p)));
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
    if (glossaries.has(file)) {
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
  const lines = content.split(/\r?\n/);
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
// Literal values marked up in HTML rather than in backticks
// ---------------------------------------------------------------------------
//
// A code span is already exempt: `ACCESSCORE` in backticks is a value somebody types, not a
// spelling this standard judges. Screen copy cannot use backticks — they would be drawn on the
// screen — so a value shown on a screen is marked up instead, with `<code>` or with a class that
// sets it in a monospace face. Those are the same statement in a different notation, and the
// exemption follows the statement rather than the notation.
//
// **A span is a literal only when there is no Hangul in it.** The same monospace face carries
// dense Korean metadata lines — 「담당 자격 · 주기 · 기한 · 정원 제약」 — and those are prose
// whatever face they are set in; blanking them would silence hundreds of checkable sentences to
// quiet one DSN name. Text outside the span is never touched, so the sentence a value sits in is
// read in full.
//
// What this gives up is a misspelling inside a literal — a `AccessCore` written in a mono span
// goes unread, exactly as it does inside backticks today. That is the price of the code-span
// contract and not a new hole.

/** Elements that mean "literal" on their own, and the class names that say so on a generic one. */
const LITERAL_ELEMENT = /<(code|kbd|samp|tt)\b[^>]*>([^<]*)<\/\1>/gi;
const LITERAL_CLASS_ELEMENT =
  /<([a-z]+)\b[^>]*\bclass="[^"]*\b(?:mono|code)\b[^"]*"[^>]*>([^<]*)<\/\1>/gi;
const HANGUL = /[가-힣ᄀ-ᇿ㄰-㆏]/;

/** Blanks HTML-marked literal values in place, leaving the prose around them readable. */
export function blankLiteralMarkup(lines) {
  return lines.map((line) => {
    if (!line.includes('<')) return line;
    let l = line;
    for (const re of [LITERAL_ELEMENT, LITERAL_CLASS_ELEMENT]) {
      re.lastIndex = 0;
      l = l.replace(re, (m, _tag, inner) => (HANGUL.test(inner) ? m : blank(m)));
    }
    return l;
  });
}

// ---------------------------------------------------------------------------
// Contrast rows (the recommended side is quoted copy, not the author's prose)
// ---------------------------------------------------------------------------
//
// A style catalogue is written as `금지 → 대체` rows, so the phrasings it tells people to write
// are printed in it as many times as it has rows. A frequency rule counts them as the author
// repeating a tic and reports the file for saying the very thing it prescribes — one document
// here drew eleven warnings for 「수 있습니다」 and every one of them sat on the right of an
// arrow, line 281 being 「조회 가능합니다 → 조회할 수 있습니다」.
//
// Exempting that one file would leave the next catalogue somebody writes to hit it again, so
// the count is what changes: **the recommended side of a contrast row does not feed a frequency
// count, in any file.** Only a frequency rule is affected — an outright ban matching there is a
// catalogue teaching a banned form, which is a real finding and still reported.
//
// **The recognition is deliberately narrow, because over-suppression is the worse failure.** A
// rule that stops counting real repetition costs more than the warning it silences, so four
// things must all hold and a stray arrow in a sentence satisfies none of them:
//
//   1. The line is a row — a list item, a blockquote line, or a table row. Ordinary prose is
//      never masked, which is what keeps 「화면 문구 27,830개 → 2,000자리 안팎. 사람이 …」 and
//      「문장 원칙 → 금지 패턴 → 어휘 … 순으로 구성한다」 counted in full.
//   2. Within the row (a table cell, or one `·`-separated pair of a specimen line) there is
//      exactly one arrow, with text on both sides.
//   3. Neither side carries a sentence break — no `.` mid-string and none at the end. A
//      specimen is a fragment; a bullet that continues into prose after the pair is prose.
//   4. The block holds two or more such pairs. A catalogue comes in rows; a lone arrow inside
//      one bullet of an ordinary list is not a catalogue.
//
// Where these disagree with a real catalogue the mask simply does not apply and the phrase is
// counted — so the way this rule fails is a warning somebody re-reads, never a silence.

const ROW_MARKER = /^(\s*(?:[-*+]|\d+[.)]|>+)\s+)/;
const SENTENCE_BREAK = /[.。](\s|$)/;

/** Splits a row into the parts a contrast pair can occupy, each with its column offset. */
function contrastParts(line) {
  const parts = [];
  const pieces = (base, text) => {
    let at = base;
    for (const piece of text.split('·')) {
      parts.push([at, piece]);
      at += piece.length + 1;
    }
  };
  if (/^\s*\|/.test(line)) {
    let at = 0;
    for (const cell of line.split('|')) {
      pieces(at, cell);
      at += cell.length + 1;
    }
    return parts;
  }
  const marker = ROW_MARKER.exec(line);
  if (!marker) return parts;
  pieces(marker[1].length, line.slice(marker[1].length));
  return parts;
}

function isRowShaped(line) {
  return /^\s*\|/.test(line) || ROW_MARKER.test(line);
}

/**
 * Column ranges holding the recommended side of a contrast row, keyed by line index.
 * `lines` must already have code spans blanked in place, so offsets stay true to the source.
 */
export function contrastRecommendedRanges(lines) {
  const found = new Map();
  let block = [];
  const flush = () => {
    if (block.length >= 2) {
      for (const {line, start, end} of block) {
        if (!found.has(line)) found.set(line, []);
        found.get(line).push([start, end]);
      }
    }
    block = [];
  };
  lines.forEach((line, idx) => {
    if (!isRowShaped(line)) {
      flush();
      return;
    }
    for (const [base, piece] of contrastParts(line)) {
      const arrows = [...piece.matchAll(/→/g)];
      if (arrows.length !== 1) continue;
      const at = arrows[0].index;
      const left = piece.slice(0, at);
      const right = piece.slice(at + 1);
      if (!left.trim() || !right.trim()) continue;
      if (SENTENCE_BREAK.test(left.trim()) || SENTENCE_BREAK.test(right.trim())) continue;
      if (!/[가-힣]/.test(right)) continue; // only Korean copy can feed a Korean frequency count
      block.push({line: idx, start: base + at + 1, end: base + piece.length});
    }
  });
  flush();
  return found;
}

/**
 * Returns lines with every character blanked except the text content of
 * <text>/<tspan> elements, preserving line numbers and column offsets so
 * findings report accurate positions. SVG markup — tags, attribute values
 * (coordinates, colors, styles), <style>/<defs>/path data — carries no prose
 * and would produce false positives if matched, so only visible label text is
 * kept. Nested <tspan> inside <text> stays included; other children do not.
 */
function stripSvgLines(content) {
  const chars = content.split('');
  const blankRange = (start, end) => {
    for (let i = start; i < end; i++) {
      if (chars[i] !== '\n' && chars[i] !== '\r') chars[i] = ' ';
    }
  };
  const tagRe = /<[^>]*>/g;
  let inText = 0; // depth of open <text>/<tspan> elements
  let cursor = 0;
  let m;
  while ((m = tagRe.exec(content)) !== null) {
    const tag = m[0];
    if (inText === 0) blankRange(cursor, m.index); // content outside text elements
    blankRange(m.index, tagRe.lastIndex);          // the tag markup itself
    if (/^<[!?]/.test(tag)) {
      // declarations, comments, CDATA — no element nesting
    } else if (/^<\//.test(tag)) {
      const name = tag.match(/^<\/\s*([A-Za-z0-9:_-]+)/);
      if (name && (name[1] === 'text' || name[1] === 'tspan')) inText = Math.max(0, inText - 1);
    } else if (!/\/>\s*$/.test(tag)) {
      const name = tag.match(/^<\s*([A-Za-z0-9:_-]+)/);
      if (name && (name[1] === 'text' || name[1] === 'tspan')) inText++;
    }
    cursor = tagRe.lastIndex;
  }
  if (inText === 0) blankRange(cursor, content.length);
  return chars.join('').split(/\r?\n/);
}

/**
 * Returns lines with every character blanked except the values of quoted
 * string literals, preserving line numbers and column offsets so findings
 * report accurate positions. Identifiers, punctuation and comments carry no
 * screen copy; a literal that a ':' follows is an object key — a message id,
 * not something anyone reads — and is blanked too. Single, double and template
 * quotes are all recognised, escapes included, which covers .ts, .js, .json
 * and .jsonc resource files alike.
 */
function stripCodeLinesToStringValues(content) {
  const chars = content.split('');
  const blankRange = (start, end) => {
    for (let i = start; i < end; i++) {
      if (chars[i] !== '\n' && chars[i] !== '\r') chars[i] = ' ';
    }
  };
  const isKeyAfter = (index) => {
    for (let i = index; i < content.length; i++) {
      if (!/\s/.test(content[i])) return content[i] === ':';
    }
    return false;
  };

  let i = 0;
  let cursor = 0; // start of the not-yet-blanked non-string region
  while (i < content.length) {
    const ch = content[i];
    if (ch === '/' && content[i + 1] === '/') {
      const end = content.indexOf('\n', i);
      i = end === -1 ? content.length : end;
      continue;
    }
    if (ch === '/' && content[i + 1] === '*') {
      const end = content.indexOf('*/', i + 2);
      i = end === -1 ? content.length : end + 2;
      continue;
    }
    if (ch !== '"' && ch !== "'" && ch !== '`') { i++; continue; }
    const quote = ch;
    let j = i + 1;
    while (j < content.length) {
      if (content[j] === '\\') { j += 2; continue; }
      if (content[j] === quote) break;
      j++;
    }
    const valueEnd = Math.min(j, content.length); // closing quote, or EOF
    blankRange(cursor, i + 1);                    // code before, plus opening quote
    if (isKeyAfter(valueEnd + 1)) blankRange(i + 1, valueEnd);
    cursor = valueEnd;
    i = valueEnd + 1;
  }
  blankRange(cursor, content.length);
  return chars.join('').split(/\r?\n/);
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

// ── Korean particle agreement ───────────────────────────────────────────────
// 이/가 · 을/를 · 과/와 are chosen by whether the preceding syllable ends in a
// consonant. A wrong one is always a defect and is never a matter of taste, so
// it belongs in the machine pass. Bulk find-and-replace is what produces these:
// swapping a noun changes its final consonant and leaves the old particle behind.
//
// 은/는 is deliberately NOT checked in running text — it collides with the adnominal
// ending (있는, 없는, 받는), which would bury the real findings in false positives.
//
// It IS checked in one position: directly after a closing quotation mark. An adnominal
// ending cannot sit there — 「…」 closes a noun phrase, so what follows is a particle and
// nothing else. That narrow window catches the mistake bulk replacement leaves behind on
// quoted screen labels (「선택한 구역」는), which is otherwise invisible to every check.
// `true` means the particle belongs after a syllable that ENDS in a consonant.
const PARTICLE_NEEDS_FINAL = {이: true, 가: false, 을: true, 를: false, 과: true, 와: false};
// Verb and adjective stems that take -는/-은/-ㄴ가 endings, plus interrogatives,
// all of which end in a syllable that looks like a noun+particle but is not.
const PARTICLE_STEM_SKIP =
  /(하|되|있|없|않|같|받|모|찾|잡|접|읽|적|맞|묻|닿|주|보|쓰|가|오|넣|만들|생기|나오|바뀌|걸리|남|들|풀|막|열|끊|끝나|늘|줄|물|앉|서|섞|싣|얹|짚|채우|인|누구|언제|누|무엇)$/;
const PARTICLE_RE = /([가-힣]{2,})(이|가|을|를|과|와)(?=[\s.,·)\]'"]|$)/g;
// After a closing quote there is no adnominal reading to collide with, so 은/는 is safe here.
const QUOTED_PARTICLE_RE = /([가-힣])[」』](은|는)(?=[\s.,·)\]'"]|$)/g;
// A closing syllable that merely LOOKS like a particle. Two sources: the -ㄴ가
// interrogative ending (충분한가, 다른가, 언젠가) and loanwords that end in 이 or
// 가 (트레이, 디스플레이, 효과). Listing them is cheaper than trying to parse
// Korean morphology, and each entry is a word rather than a domain term.
//
// **The -ㄴ가 branch is decided by position, not by an enumeration of syllables.** It used
// to list 는·은·른·운·한·인 and let 아닌가 · 그런가 · 어떤가 through as particle errors — an
// enumeration standing in for a family, which is the defect this file exists to catch.
//
// Widening it to «every ㄴ-final syllable» is NOT the fix: 화면 · 조건 · 시간 · 사건 all end
// in ㄴ, so 「화면가 열린다」 would go quiet with it. What separates the two is where the
// token sits. The interrogative -ㄴ가 CLOSES a sentence; 명사 + 가 is a subject and something
// has to follow it. So the ending is accepted only at the end of a line, before a question
// mark, or before a closing quote — and a subject in mid-sentence is still judged.
const PARTICLE_WORD_SKIP = /(ㄴ가|[간-힣]?[는은른운한인]가|언젠가|누군가|어딘가|뭔가|무언가|선가)$/;
/** Nothing but closing punctuation left on the line — the interrogative -ㄴ가's position. */
const SENTENCE_CLOSE = /^[\s?!.」』"')\]]*$/;
/** True for 아닌가 · 그런가 · 어떤가 where they close a sentence, false for 「화면가 열린다」. */
function isNGaEnding(whole, rest) {
  if (!whole.endsWith('가') || whole.length < 2 || !SENTENCE_CLOSE.test(rest)) return false;
  const code = whole.codePointAt(whole.length - 2);
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 === 4;
}
// Words that simply END in 이 or 가, where the tail is part of the word rather than a
// particle. Adverbs are the ones this rule keeps mistaking for a noun: `가까이 모인다` reads
// as 가까+이 and gets corrected to something that is not Korean.
//
// **Transliterated place names are the third source**, and they are a family rather than a
// coincidence: a foreign name written in Hangul ends wherever the source language ends, and 이
// is a common one (하노이 · 상하이 · 뭄바이 · 두바이 · 하와이). A product written for foreign
// workers names their cities, so this arrives in ordinary screen copy — 「하노이 공장」 read as
// 하노+이 turns a factory into a subject particle. Only the bare name is skipped: 「하노이가」 ·
// 「하노이를」 are still judged, and they are already right, because the name is vowel-final.
const PARTICLE_TAIL_SKIP =
  /(레이|플레이|어레이|웨이|페이|메이|효과|초과|평가|전문가|국가|증가|참가|원가|단가|보이|사이|차이|넓이|길이|높이|깊이|먹이|놀이|쓰임새|가까이|같이|굳이|깊숙이|일찍이|나란히|틈틈이|샅샅이|곰곰이|번번이|낱낱이|고이|많이|파이|하노이|상하이|뭄바이|두바이|하와이|시드니)$/;

function hasFinalConsonant(ch) {
  const code = ch.codePointAt(0);
  if (code < 0xac00 || code > 0xd7a3) return null;
  return (code - 0xac00) % 28 !== 0;
}

// 과/와 joins two noun phrases, so it always stands BETWEEN them: a space and another Hangul word
// follow it. A word whose last syllable simply IS 과 can be followed by anything — a middle dot in
// a list, a closing paren, the end of the line.
//
// **That position is the family test, and it is here because the enumeration was losing.**
// `PARTICLE_TAIL_SKIP` already carried 효과 · 초과 for this one syllable, and the Sino-Korean -과
// vocabulary behind them has no end: 결과 · 성과 · 경과 · 통과 · 학과 · 교과 and every medical
// department (내과 · 외과 · 치과 · 정형외과 · 이비인후과). Adding them one at a time is the defect
// this file names elsewhere — an enumeration standing in for a family — and each miss is an error
// on a correct sentence, which is the finding that teaches people to stop reading the output.
//
// What is given up is 「내과 진료를」, where a noun does follow. What is kept is the shape bulk
// replacement actually leaves — 「회사과 협력사」 — and the other direction, 「사업장와」, is judged
// as before because no Korean word ends in 와 after a consonant.
const CONJUNCTION_FOLLOWS = /^\s+[가-힣]/;

function checkParticles(lines) {
  const hits = [];
  lines.forEach((line, idx) => {
    for (const m of line.matchAll(PARTICLE_RE)) {
      const [, stem, particle] = m;
      const whole = stem + particle;
      if (PARTICLE_STEM_SKIP.test(stem)) continue;
      if (/[는은던]$/.test(stem)) continue;
      if (PARTICLE_WORD_SKIP.test(whole) || PARTICLE_TAIL_SKIP.test(whole)) continue;
      const rest = line.slice(m.index + whole.length);
      if (isNGaEnding(whole, rest)) continue;
      if (particle === '과' && !CONJUNCTION_FOLLOWS.test(rest)) continue;
      const final = hasFinalConsonant(stem[stem.length - 1]);
      if (final === null) continue;
      if (PARTICLE_NEEDS_FINAL[particle] === final) continue;
      hits.push({line: idx + 1, text: stem + particle});
    }
    for (const m of line.matchAll(QUOTED_PARTICLE_RE)) {
      const [, last, particle] = m;
      const final = hasFinalConsonant(last);
      if (final === null) continue;
      if ((particle === '은') === final) continue;
      hits.push({line: idx + 1, text: `${last}」${particle}`});
    }
  });
  return hits;
}

// ── a particle after an interpolation ───────────────────────────────────────
// `버전 {{version}}이 되었습니다` is correct for version 3 and wrong for version 2, and
// nothing about the string says which. The value arrives at render time — a number, a
// name, a count, a word from another language — so its final consonant is unknown when
// the sentence is written, and 이/가 · 을/를 · 과/와 · 로/으로 all turn on exactly that.
//
// The rule above cannot see these: it matches a particle after Korean syllables, and what
// precedes this one is `}}`. Neither can a translator, a review, or any amount of care —
// the sentence is right in front of whoever wrote it, for the one value they had in mind.
//
// **Every hit is a real alternation and none of them is decided here.** Which values a
// placeholder can take is the caller's business, so the fix is the caller's too: rewrite
// the sentence so no particle follows the value (`버전 {{version}}입니다`), put the particle
// inside the value, or move the value away from the particle. The 「(가)」 written form is
// a form, not product copy.
//
// Interpolation shapes: {{name}} (i18next, Handlebars, Mustache), {name} (ICU, .NET,
// Python format), %s and %1$s (printf, Android). Listed rather than generalised to 「any
// punctuation」 — a particle after a closing bracket or quote is somebody quoting a label,
// which the rule above already decides correctly.
//
// **`${…}` is deliberately not among them.** A template literal is code, and what it
// substitutes is in the same file a few lines up — `${planted()}가` is decidable by
// reading, and it was right. This rule is about the placeholder a MESSAGE carries, whose
// value arrives from data the sentence never sees.
//
// **That exemption was one member of a family, written down as a single case.** What
// separates the two is not the punctuation but whether the author can know the final
// syllable, and a template literal is merely the shape in which that happens most often.
// A cross-reference is the other shape: `{{b-06-new}}` on a wireframe board resolves at
// BUILD time to `B-06`, so the author knows the syllable and chooses 이/가 correctly —
// and firing on those buries the genuine i18n case under a hundred false errors, which is
// how a checker teaches its reader to skip the output. See RESOLVED_PLACEHOLDERS below:
// a project declares the shape of its cross-references and how they render, and the
// particle after one is then JUDGED against the rendered value rather than excused.
//
// **Annotations are skipped only where the value is still unknown.** A note addressed to
// whoever maintains the file (audit.localeAnnotationKeys) is prose whose tokens are usually
// cross-references a build resolves to a fixed string, and skipping the whole note used to
// stand in for saying so — the same missing family, wearing a second disguise. Now that a
// resolved reference is judged rather than excused, the skip applies to the undecidable
// branch alone: declare the shape and a wrong particle inside a note is reported like any
// other, which is where most of them are.
const INTERPOLATION_PARTICLE_RE =
  /(?<!\$\{[^{}]{0,80})(\}\}|\}|%[sd]|%\d+\$[sd])(이|가|을|를|은|는|과|와|으로|로|이라|라)(?=[\s.,·)\]'"]|$)/g;

// A single-brace group that ENUMERATES rather than names is prose, not a placeholder. A
// design document writes the required fields of a form as a set — `{유해·위험요인, 위험성
// 결정의 내용, 조치의 내용}을 포함해야 한다` — and the particle there is decided by the last
// word inside the braces, which is right in front of whoever wrote it. A placeholder name
// never carries a comma or a space (`{count}`, `{userName}`, `{사업장명}`), so those two
// characters separate the two shapes without needing to guess at the content's language.
// `{{name}}` is untouched: doubled braces are always interpolation.
const BRACE_ENUMERATION = /[, ]/;

// ── a placeholder the build resolves to a constant ──────────────────────────
// The family the `${…}` exemption belongs to, named rather than enumerated. A project
// declares in its glossary front matter which placeholder names are cross-references and
// what they render as:
//
//   audit:
//     resolvedPlaceholders:
//       - '^([a-z])-(\d{2})(?:-[a-z0-9-]+)?$ => \U$1-$2'
//
// Left of `=>` is a regex over the placeholder's inner text; right of it is a replacement
// template producing the string the build puts on the page (`$1`…`$9`, and `\U$n` for a
// group the build uppercases). **Declaring one does not silence the check — it turns it
// into a real one**: the rendered value is known, so the particle after it is judged like
// any Korean noun, and `B-25과` is reported with the particle it should have been.
//
// The shape belongs in configuration rather than here because a cross-reference's spelling
// is a property of one project's build. A placeholder matching no declaration keeps the
// error above; its value is still data the sentence never sees.
const RESOLVED_RULE_RE = /^(.*?)\s+=>\s+(.*)$/;

export function parseResolvedPlaceholders(declarations) {
  const parsed = [];
  for (const decl of declarations ?? []) {
    const m = String(decl).match(RESOLVED_RULE_RE);
    if (!m) throw new Error(`audit.resolvedPlaceholders 항목에 " => "가 없습니다: ${decl}`);
    parsed.push({pattern: new RegExp(m[1]), template: m[2]});
  }
  return parsed;
}

/** Applies a `$n` / `\U$n` replacement template to a regex match. */
function renderTemplate(template, match) {
  return template.replace(/\\U\$(\d)|\$(\d)/g, (_, up, plain) =>
    up ? (match[Number(up)] ?? '').toUpperCase() : (match[Number(plain)] ?? ''));
}

// Digits and Latin letters are read aloud in Korean, and a particle after one follows that
// reading rather than the glyph. A NUMBER's reading is settled by its last digit under both
// the digit-by-digit reading (「이오」) and the sino-Korean one (「이십오」) — 0 is 공·영 and
// 십·백, all closed, and the other nine agree with themselves — so the last character is
// enough and no number parsing is needed. `r` is left out on purpose: 아르 and 알 are both
// current, and a checker that cannot tell which stays silent instead of demanding one.
const READING_FINAL = {
  '0': [true, false], '1': [true, true], '2': [false, false], '3': [true, false],
  '4': [false, false], '5': [false, false], '6': [true, false], '7': [true, true],
  '8': [true, true], '9': [false, false],
  a: [false, false], b: [false, false], c: [false, false], d: [false, false],
  e: [false, false], f: [false, false], g: [false, false], h: [false, false],
  i: [false, false], j: [false, false], k: [false, false], l: [true, true],
  m: [true, false], n: [true, false], o: [false, false], p: [false, false],
  q: [false, false], s: [false, false], t: [false, false], u: [false, false],
  v: [false, false], w: [false, false], x: [false, false], y: [false, false],
  z: [false, false],
};

/** `{final, rieul}` for a rendered value, or null when its reading is not settled. */
function readingOf(rendered) {
  const text = rendered.replace(/[\s.,·)\]'"」』]+$/, '');
  const last = text[text.length - 1];
  if (!last) return null;
  const hangul = hasFinalConsonant(last);
  if (hangul !== null) {
    const rieul = (last.codePointAt(0) - 0xac00) % 28 === 8;
    return {final: hangul, rieul};
  }
  const reading = READING_FINAL[last.toLowerCase()];
  return reading ? {final: reading[0], rieul: reading[1]} : null;
}

/** The particle each of the pair takes, keyed by the one that follows a final consonant. */
const PARTICLE_PAIRS = [['이', '가'], ['을', '를'], ['은', '는'], ['과', '와'], ['으로', '로'], ['이라', '라']];
const BY = ['으로', '로'];

/** Whichever of `pair` follows `word`'s reading, or null when that reading is not settled. */
function particleFor(word, pair) {
  const reading = readingOf(word);
  if (!reading) return null;
  // 으로/로 is the one pair a ㄹ-final does not follow: 서울로, not 서울으로.
  return reading.final && !(pair[0] === '으로' && reading.rieul) ? pair[0] : pair[1];
}

/** The particle `rendered` should take in place of `particle`, or null when it is right. */
function wrongParticle(rendered, particle) {
  const pair = PARTICLE_PAIRS.find(([c, v]) => c === particle || v === particle);
  if (!pair) return null;
  const correct = particleFor(rendered, pair);
  return correct && correct !== particle ? correct : null;
}

function checkInterpolatedParticles(lines, isAnnotation = () => false, resolved = []) {
  const hits = [];
  lines.forEach((line, idx) => {
    for (const m of line.matchAll(INTERPOLATION_PARTICLE_RE)) {
      const opener = m[1] === '}}' ? '{{' : m[1] === '}' ? '{' : null;
      let inner = null;
      if (opener) {
        // `${` … `}` and `{` … `}` both end in `}`; requiring an opening brace before the
        // match on the same line keeps a stray closing brace in prose from firing.
        const open = line.lastIndexOf(opener, m.index);
        if (open === -1) {
          if (opener === '{') continue;
        } else {
          inner = line.slice(open + opener.length, m.index);
          if (opener === '{' && BRACE_ENUMERATION.test(inner)) continue;
        }
      }
      const declaration = inner === null ? undefined : resolved.find((r) => r.pattern.test(inner));
      if (!declaration && isAnnotation(idx, m.index)) continue;
      if (declaration) {
        const rendered = renderTemplate(declaration.template, inner.match(declaration.pattern) ?? []);
        const correct = wrongParticle(rendered, m[2]);
        if (correct) {
          // The message chooses its own particles the same way: a diagnostic that misspells
          // the thing it is correcting is read as noise.
          hits.push({
            line: idx + 1,
            text: `${opener}${inner}${m[1]}${m[2]}`,
            suggestion: `참조가 「${rendered}」${particleFor(rendered, BY)} 표시되므로 `
              + `「${rendered}${correct}」${particleFor(correct, BY)} 고친다`,
          });
        }
        continue;
      }
      hits.push({line: idx + 1, text: m[0]});
    }
  });
  return hits;
}

// ── repeated word ───────────────────────────────────────────────────────────
// `작업작업`, `정비 정비` — the other thing bulk replacement leaves behind, when
// a phrase is substituted into text that already contained the replacement.
const REPEAT_RE = /(?<![가-힣])([가-힣]{2,4}) ?\1(?![가-힣])/g;
const REPEAT_OK = new Set([
  '하나하나', '가지가지', '이런저런', '곳곳', '따로따로', '차례차례', '조금조금',
  '그때그때', '번번이', '가끔가끔', '두고두고', '오래오래', '이것저것', '여기저기',
  '구석구석', '집집', '나날', '틈틈', '알알', '겹겹', '층층', '줄줄',
]);

function checkRepeats(lines) {
  const hits = [];
  lines.forEach((line, idx) => {
    for (const m of line.matchAll(REPEAT_RE)) {
      if (REPEAT_OK.has(m[0].replace(/ /g, ''))) continue;
      hits.push({line: idx + 1, text: m[0]});
    }
  });
  return hits;
}

// ── a heading written as a sentence ─────────────────────────────────────────
// A markdown heading is a name slot: a table of contents, a cross-reference and a
// breadcrumb all quote it as a noun. Ending it in a finite verb reads as a sentence cut
// short — `## 자료를 넣는다` where `## 자료 넣기` belongs.
//
// The style reference calls this hard to judge by machine, and for a sentence anywhere in
// a document it is: the same 「~한다」 is correct prose one line lower. **A heading is not
// anywhere** — `^#{1,6} ` is a position the file itself declares, so the ambiguity that
// made the rule undecidable is gone the moment the check reads the raw line instead of the
// extracted segment.
//
// **The raw line is what it reads, and that is not a detail.** Every other check runs over the
// masked lines, where inline code, link targets and comments are blanked to spaces; feeding the
// heading rule the same lines judged `### 반만 아는 계열은 \`rules --test\`가 검출한다` as
// 「반만 아는 계열은 　　가 검출한다」 and reported that back to the reader, a finding naming a
// heading nobody can find by searching for it. Worse, the quoting exemption below lists a
// backtick among the marks that make a heading somebody else's sentence — and a backtick cannot
// survive the mask, so the branch was dead for the one quoting style Markdown actually uses.
//
// What the mask WAS doing for it is refusing lines that only look like headings: `# 값을 넣는다`
// inside a shell fence is a comment, and a YAML front-matter line beginning `#` is a comment
// too. Those are positions, not spellings, so they are excluded by position — a line the mask
// emptied, and the front-matter block — while the text itself is read exactly as written.
//
// The ending is decided by jamo arithmetic rather than by a list of verbs. `-ㄴ다`/`-는다`
// is the productive plain-style finite ending, and every inflection of it puts ㄴ in the
// jongseong of the syllable before 다 — 한다 · 온다 · 짓는다 · 붙인다 · 않는다 all fall out
// of one test, where a list of verb forms would have to grow with every new verb.
const HEADING_RE = /^(#{1,6})\s+(.*\S)\s*$/;
/** Finite endings that jamo arithmetic does not reach: past, 합니다체, and the adjectives. */
const HEADING_FINITE_TAIL = /(했다|았다|었다|였다|ㅂ니다|습니다|입니다|아니다|없다|있다|다르다|같다)$/;

/** Whether `ch` is a Hangul syllable whose final jamo is ㄴ — the `-ㄴ다` ending. */
function endsInNieun(ch) {
  const code = ch?.codePointAt(0);
  if (code === undefined || code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 === 4;
}

function checkHeadingForm(rawLines, strippedLines, fm) {
  const hits = [];
  rawLines.forEach((line, idx) => {
    // A line the mask emptied is not prose — a fence and its contents, a JSX template, an
    // import. A `#` there is a shell comment or a colour.
    if (line.trim() !== '' && strippedLines[idx] === '') return;
    // Front matter is YAML, where a leading `#` opens a comment.
    if (fm && idx >= fm.start && idx <= fm.end) return;
    const m = HEADING_RE.exec(line);
    if (!m) return;
    const text = m[2];
    // A heading that is one word is a term being defined, not a sentence — `### 없다`
    // heads the entry for that word. A sentence needs something to predicate about.
    if (!/\s/.test(text)) return;
    // A quoted heading reproduces somebody else's sentence — a rule being cited, a screen
    // label, the title of another document. Fidelity outranks the name-slot rule there.
    if (/^([「"'`(\[]).*$/.test(text) && /[」"'`)\]]$/.test(text)) return;
    const finite =
      HEADING_FINITE_TAIL.test(text) || (text.endsWith('다') && endsInNieun(text[text.length - 2]));
    if (!finite) return;
    hits.push({line: idx + 1, text});
  });
  return hits;
}

// ── Annotation values inside a locale resource ──────────────────────────────
// Some resource files mix screen copy with commentary addressed to whoever
// maintains the file — a wireframe frame carries its design notes beside the
// labels it draws. Both are string values, so the string-value mask cannot
// tell them apart, and a screen-only ban would fire on prose that is allowed
// to name the implementation it documents. audit.localeAnnotationKeys names
// the keys whose values are commentary; ordinary rules still apply to them,
// because commentary is still Korean that has to be written correctly.

/** Advances past the string literal opening at `start`, returning the index after its close. */
function endOfString(content, start) {
  const quote = content[start];
  let i = start + 1;
  while (i < content.length) {
    if (content[i] === '\\') { i += 2; continue; }
    if (content[i] === quote) return i + 1;
    i++;
  }
  return content.length;
}

/**
 * End of the value expression that begins at `start`, i.e. the first `,` or
 * `;` reached at bracket depth zero, or the closer of the object holding it.
 * Strings and comments are skipped whole, so punctuation inside them cannot
 * end the value early — which is what lets a value built from several
 * concatenated literals across many lines be treated as one span.
 */
function endOfValue(content, start) {
  let depth = 0;
  let i = start;
  while (i < content.length) {
    const ch = content[i];
    if (ch === '/' && content[i + 1] === '/') {
      const nl = content.indexOf('\n', i);
      i = nl === -1 ? content.length : nl;
      continue;
    }
    if (ch === '/' && content[i + 1] === '*') {
      const close = content.indexOf('*/', i + 2);
      i = close === -1 ? content.length : close + 2;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { i = endOfString(content, i); continue; }
    if (ch === '(' || ch === '[' || ch === '{') { depth++; i++; continue; }
    if (ch === ')' || ch === ']' || ch === '}') {
      if (depth === 0) return i;
      depth--;
      i++;
      continue;
    }
    if (depth === 0 && (ch === ',' || ch === ';')) return i;
    i++;
  }
  return content.length;
}

/** Character ranges covered by the values of `keys`, as `[start, end)` pairs. */
export function annotationRanges(content, keys) {
  if (keys.size === 0) return [];
  const ranges = [];
  const afterSpace = (i) => {
    let j = i;
    while (j < content.length && /\s/.test(content[j])) j++;
    return j;
  };
  let i = 0;
  while (i < content.length) {
    const ch = content[i];
    if (ch === '/' && content[i + 1] === '/') {
      const nl = content.indexOf('\n', i);
      i = nl === -1 ? content.length : nl;
      continue;
    }
    if (ch === '/' && content[i + 1] === '*') {
      const close = content.indexOf('*/', i + 2);
      i = close === -1 ? content.length : close + 2;
      continue;
    }
    // A quoted key ("notes": ...) as well as a bare one — JSON and JS alike.
    if (ch === '"' || ch === "'" || ch === '`') {
      const end = endOfString(content, i);
      const colon = afterSpace(end);
      if (content[colon] === ':' && keys.has(content.slice(i + 1, end - 1))) {
        const stop = endOfValue(content, colon + 1);
        ranges.push([i, stop]);
        i = stop;
        continue;
      }
      i = end;
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i;
      while (j < content.length && /[\w$]/.test(content[j])) j++;
      const colon = afterSpace(j);
      if (content[colon] === ':' && keys.has(content.slice(i, j))) {
        const stop = endOfValue(content, colon + 1);
        ranges.push([i, stop]);
        i = stop;
        continue;
      }
      i = j;
      continue;
    }
    i++;
  }
  return ranges;
}

export function auditFile(filePath, rules, checkUntranslated, isLocaleResource = false, annotationKeys = new Set(), resolvedPlaceholders = [], disabledChecks = new Map()) {
  const content = readFileSync(filePath, 'utf8');
  const isSvg = !isLocaleResource && /\.svg$/i.test(filePath);
  const isProse = !isSvg && !isLocaleResource;
  const rawLines = content.split(/\r?\n/);
  let lines;
  if (isLocaleResource) lines = stripCodeLinesToStringValues(content);
  else if (isSvg) lines = stripSvgLines(content);
  else lines = stripLines(content);
  lines = blankLiteralMarkup(lines);
  const fm = isProse ? frontMatterRange(rawLines) : null;
  const errors = [];
  const warnings = [];

  const annotations = isLocaleResource ? annotationRanges(content, annotationKeys) : [];
  const lineStarts = [];
  for (let i = 0, at = 0; at <= content.length; i++) {
    lineStarts.push(at);
    const nl = content.indexOf('\n', at);
    if (nl === -1) break;
    at = nl + 1;
  }
  const isAnnotation = (lineIdx, column) => {
    const at = lineStarts[lineIdx] + column;
    return annotations.some(([start, end]) => at >= start && at < end);
  };

  // A catalogue's `금지 → 대체` rows are not its author repeating himself, so the copy on the
  // recommended side is kept out of the per-file counts a frequency rule thresholds on.
  const contrast = isProse ? contrastRecommendedRanges(lines) : new Map();
  const isRecommendedCopy = (lineIdx, column) =>
    (contrast.get(lineIdx) ?? []).some(([start, end]) => column >= start && column < end);

  for (const rule of rules) {
    // A screen-only rule bans a word where a user reads it and nowhere else. A design document
    // has to be able to name the thing it specifies, and so does a note written beside a screen.
    if (rule.screenOnly && !isLocaleResource) continue;
    const hits = [];
    lines.forEach((line, idx) => {
      rule.pattern.lastIndex = 0;
      for (const m of line.matchAll(rule.pattern)) {
        if (rule.screenOnly && isAnnotation(idx, m.index)) continue;
        // Only the frequency judgement is corrupted by a catalogue. A threshold-1 ban matching
        // recommended copy means the catalogue prescribes a banned form — that stays reported.
        if (rule.threshold > 1 && isRecommendedCopy(idx, m.index)) continue;
        hits.push({line: idx + 1, text: m[0]});
      }
    });
    if (hits.length === 0 || hits.length < rule.threshold) continue;
    const bucket = rule.level === 'error' ? errors : warnings;
    for (const hit of hits) {
      bucket.push({...hit, rule, count: hits.length});
    }
  }

  for (const hit of checkParticles(lines)) {
    errors.push({...hit, count: 1, rule: {
      source: 'particle', label: '조사 어긋남', level: 'error', threshold: 1,
      suggestion: '앞 글자의 받침에 맞춰 이/가 · 을/를 · 과/와를 고른다',
    }});
  }
  for (const hit of checkInterpolatedParticles(lines, isAnnotation, resolvedPlaceholders)) {
    // A resolved cross-reference carries its own suggestion: the value IS known there, so
    // the fix is the right particle rather than a rewrite that avoids one.
    const resolvedRef = hit.suggestion !== undefined;
    errors.push({...hit, count: 1, rule: {
      source: resolvedRef ? 'reference-particle' : 'interpolated-particle',
      label: resolvedRef ? '참조 뒤의 조사' : '치환값 뒤의 조사', level: 'error', threshold: 1,
      suggestion: hit.suggestion ?? '값의 받침을 알 수 없으므로 조사가 오지 않게 문장을 고친다',
    }});
  }
  if (!disabledChecks.has('repeat')) {
    for (const hit of checkRepeats(lines)) {
      warnings.push({...hit, count: 1, rule: {
        source: 'repeat', label: '같은 말이 잇달아 나옴', level: 'warn', threshold: 1,
        suggestion: '치환이 겹쳐 생긴 중복인지 확인한다',
      }});
    }
  }
  // Markdown only: an SVG label and a locale resource value have no heading syntax, and a
  // `#` there is a colour or a comment.
  if (isProse && !isSvg && !disabledChecks.has('heading-form')) {
    for (const hit of checkHeadingForm(rawLines, lines, fm)) {
      warnings.push({...hit, count: 1, rule: {
        source: 'heading-form', label: '제목이 서술문이다', level: 'warn', threshold: 1,
        suggestion: '이름 자리이므로 명사형으로 쓴다 — 「자료를 넣는다」가 아니라 「자료 넣기」',
      }});
    }
  }

  // Untranslated-content heuristic: flag remaining English prose lines.
  // Markdown-only — the SVG mask leaves isolated short labels that would
  // misfire this prose detector, and an English locale resource is correct by
  // definition.
  if (checkUntranslated && isProse && !disabledChecks.has('untranslated')) {
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

export function initGlossary(cliPath) {
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
  console.log(`  3. 감사 실행: node ${cliPath} [경로...]`);
}

/**
 * Writes the two declaration files the resource commands need, as scaffolds with the
 * project's own paths left to be filled. Nothing is guessed from the tree: a wrong glob
 * that matches nothing reads exactly like a clean run, which is the failure this whole
 * pair of files exists to prevent.
 */
export function initL10n(cliPath) {
  const dir = join(process.cwd(), '.claude');
  const layout = join(dir, 'l10n.json');
  const pack = join(dir, 'l10n-rules.json');
  if (existsSync(layout)) {
    console.log(`이미 선언이 있습니다: ${relative(process.cwd(), layout)}`);
    process.exitCode = 2;
    return;
  }
  mkdirSync(dir, {recursive: true});
  writeFileSync(layout, `${JSON.stringify(L10N_TEMPLATE, null, 2)}\n`, {flag: 'wx'});
  if (!existsSync(pack)) writeFileSync(pack, `${JSON.stringify(RULES_TEMPLATE, null, 2)}\n`, {flag: 'wx'});
  console.log(`자원 선언을 생성했습니다: ${relative(process.cwd(), layout)}`);
  console.log('다음 단계:');
  console.log('  1. kinds의 patterns를 이 저장소의 실제 경로로 바꿉니다. {lang}이 언어 코드 자리입니다.');
  console.log('  2. 언어가 부류마다 다르면 부류 안에 languages를 적습니다 (매뉴얼은 ko·en, 화면은 ko·en·ja처럼).');
  console.log(`  3. 선언이 맞는지 확인: node ${cliPath.replace(/ check$/, '')} list`);
  console.log(`  4. 문장 규칙 훑기: node ${cliPath.replace(/ check$/, '')} rules`);
  console.log('');
  console.log('※ git ls-files의 **는 경로 마디 하나 이상이라, locales/**/ko.json은');
  console.log('  locales/ko.json에 걸리지 않습니다. 두 모양이 다 있으면 glob을 둘 적으세요 —');
  console.log('  빠뜨린 파일은 오류가 아니라 침묵으로 나타납니다.');
}

const L10N_TEMPLATE = {
  $comment: [
    'korean-docs의 l10n 도구가 읽는 자원 선언. 이 파일은 번역된 문구가 어디 있는지만 말한다 —',
    '규칙은 용어사전 짝(.claude/GLOSSARY.md + 스킬의 GLOSSARY.base.md)과 규칙 팩',
    '(.claude/l10n-rules.json + 스킬의 RULES.base.json)에 있다.',
    '',
    'glob 함정: git ls-files의 **는 경로 마디 하나 이상이라 locales/**/ko.json은',
    'locales/ko.json에 걸리지 않는다. 두 모양이 다 있는 부류는 glob이 둘 필요하다.',
    '하나를 빠뜨리면 그 파일이 모든 명령에서 조용히 빠지고, 그것이 「문제 없음」으로 읽힌다.',
    '',
    'register: "screen" = 화면 문구(합니다체), "manual" = 독자용 합니다체 설명문,',
    '생략 = -다체 작업 문서. 한 문체에만 뜻이 있는 검사는 이 값으로 갈린다.',
  ],
  languages: ['ko', 'en'],
  defaultLanguage: 'ko',
  ruleScopes: [],
  domainHint: null,
  properNouns: [],
  samplePatterns: [],
  untranslatedExclude: [],
  kinds: {
    manual: {
      label: '사용설명서',
      patterns: ['docs/manual/{lang}/*.md'],
      languages: ['ko', 'en'],
      format: 'markdown',
      register: 'manual',
    },
  },
};

const RULES_TEMPLATE = {
  $comment: [
    '이 저장소에만 참인 문장 규칙 팩. 규칙마다 hit(걸려야 하는 예문)과 miss(걸리면 안 되는 예문)를',
    '반드시 달고 l10n.mjs rules --test로 검증한다. 낱말 금지는 .claude/GLOSSARY.md에 넣는다 —',
    '거기 넣어야 문서 감사와 자원 감사가 함께 읽는다. 이 저장소를 넘어 참인 규칙은',
    '스킬의 RULES.base.json으로 올린다.',
  ],
  version: 1,
  rules: [],
};

// ---------------------------------------------------------------------------
// The audit flow both CLIs run
// ---------------------------------------------------------------------------

/**
 * Runs the document audit end to end and prints the report.
 *
 * `args`: {all, strict, untranslated, noBase, listRules, glossary, paths}.
 * `cliPath` appears in the --init hint when no project glossary exists.
 * Returns the exit code (0 clean, 1 violations) rather than setting it.
 */
export function runDocAudit(args, cliPath) {
  let discovered = null;
  if (args.glossary) {
    const p = resolve(args.glossary);
    if (!existsSync(p)) throw new Error(`용어사전을 찾을 수 없습니다: ${args.glossary}`);
    discovered = {path: p, root: rootFromGlossaryPath(p)};
  } else {
    discovered = discoverGlossary(discoveryStart(args.paths));
  }

  let project = null;
  let config = {paths: [], exclude: [], localeResources: [], localeAnnotationKeys: [], untranslated: false};
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

  const {rules, deadExceptions, disabledChecks} = mergeGlossaries(base, project);

  if (args.listRules) {
    for (const r of rules) {
      console.log(`[${r.origin === 'base' ? '기본' : '프로젝트'}] [${r.level}${r.threshold > 1 ? ` ${r.threshold}+` : ''}] ${r.source} → ${r.suggestion} (${r.label})`);
    }
    console.log(`\n규칙 ${rules.length}개 로드됨.`);
    return 0;
  }

  if (discovered) {
    const shown = relative(process.cwd(), discovered.path) || discovered.path;
    console.log(`용어사전: ${shown}${args.noBase ? '' : ' + 기본 용어사전'} (규칙 ${rules.length}개)`);
  } else {
    console.log('프로젝트 용어사전이 없습니다 — 기본 용어사전만으로 검사합니다.');
    console.log('프로젝트 용어사전을 만들려면 (기본 위치: .claude/GLOSSARY.md):');
    console.log(`  node ${cliPath} --init`);
  }
  // **An exception names a base rule by its pattern TEXT, so editing that pattern in the base
  // glossary silently revives the rule in every project that had turned it off.** The revived
  // finding then reads as a fresh defect: the exception row is still there, still explains why
  // the rule is off, and disables nothing. It was reported by `audit` alone, which is not the
  // command a gate or the write-time hook runs — so the one place the silence mattered was the
  // one place it stayed silent, and three warnings sat in a repository whose exception row for
  // them was intact.
  if (deadExceptions.length > 0) {
    console.log(
      `\n죽은 예외 ${deadExceptions.length}개 — 아래 항목이 기본 용어사전의 어느 규칙과도 글자가 맞지 않아 아무것도 끄지 않습니다.` +
        ` 기본 규칙의 정규식이 바뀌면 그 규칙을 끈 예외가 조용히 되살아나므로, 지금 규칙의 글자로 고쳐 적으세요.`,
    );
    for (const row of deadExceptions) console.log(`  ${row}`);
  }
  // **A check that was switched off is named on every run.** Silence is what an exception buys,
  // and silence is indistinguishable from a check that passed — so the one line the reader needs
  // is which of the built-in checks did not look at this tree.
  if (disabledChecks.size > 0) {
    const off = [...disabledChecks].map(([id, label]) => `${id}(${label})`).join(' · ');
    console.log(`기본 규칙 예외로 끈 내장 검사: ${off}`);
  }
  console.log('');

  const isLocaleResource = makeLocaleResourceMatcher(config.localeResources, root);
  const annotationKeys = new Set(config.localeAnnotationKeys);
  const resolvedPlaceholders = parseResolvedPlaceholders(config.resolvedPlaceholders);
  const {files: targets, excludedCount, glossarySkipped} = resolveTargets(args, config, root, discovered?.path, isLocaleResource);
  if (excludedCount > 0) console.log(`audit.exclude 패턴으로 파일 ${excludedCount}개 제외됨`);
  // A declared glob that reaches nothing is a shorter run reporting 「오류 0건」 exactly like a
  // clean one, so the declaration is reported on the line where it is applied. Two numbers,
  // because they answer different questions and only one of them can be wrong: what the patterns
  // reach in the repository, and how much of that this run's scope covers. Reporting the second
  // alone made every single-file run — which is every run the write-time hook makes — accuse
  // correct globs of matching nothing.
  let deadPatterns = [];
  if (config.localeResources.length > 0) {
    const {perPattern, total} = localeResourceCoverage(config.localeResources, root);
    deadPatterns = perPattern.filter((p) => p.count === 0);
    const inScope = targets.filter((f) => isLocaleResource(f)).length;
    console.log(`audit.localeResources: 자원 파일 ${total}개 (이번 검사 범위 ${inScope}개)`);
  }
  // **A pattern reaching nothing fails the run rather than printing a line.** The declaration is
  // a promise that a corpus is being checked; when it reaches nothing, every later 「오류 0건」 is
  // true of the files that were read and says nothing about the files that were not, and no
  // output distinguishes the two. A line of warning is the shape that already failed here three
  // times, so this takes the shape the unterminated-list check took: a declaration that cannot do
  // what it says is refused. It is a configuration error, and it exits with the audit's error
  // code so a gate and the write-time hook both stop on it.
  if (deadPatterns.length > 0) {
    console.log(
      `\n[오류] audit.localeResources 패턴 ${deadPatterns.length}개가 아무 파일과도 맞지 않습니다 —` +
        ` 선언한 화면 문구가 검사에서 빠집니다.`,
    );
    for (const {pattern, reason} of deadPatterns) console.log(`  ${pattern} — ${reason}`);
    console.log(`  패턴은 저장소 루트(${root}) 기준입니다.`);
    console.log('  `*`는 `/`를 포함하지 않습니다 — 하위 디렉터리까지 훑으려면 `**/`를 씁니다.');
    console.log('  자원 파일이 옮겨졌거나 사라졌다면 선언에서 지우세요.');
  }
  if (glossarySkipped) console.log('용어사전 파일 자체는 감사 대상에서 제외됩니다');
  if (targets.length === 0) {
    console.log('검사 대상 파일이 없습니다.');
    return deadPatterns.length > 0 ? 1 : 0;
  }

  const checkUntranslated = args.untranslated || config.untranslated;
  let errorCount = 0;
  let warningCount = 0;
  for (const file of targets) {
    const rel = relative(root, file);
    const relPath = rel.startsWith('..') ? file : rel;
    const {errors, warnings} = auditFile(file, rules, checkUntranslated, isLocaleResource(file), annotationKeys, resolvedPlaceholders, disabledChecks);
    errorCount += errors.length;
    warningCount += warnings.length;
    for (const f of errors) console.log(formatFinding(relPath, f, 'error'));
    for (const f of warnings) console.log(formatFinding(relPath, f, 'warn'));
  }

  // The dead-pattern count rides in the total so the closing line can never read 「오류 0건」 while
  // a declared corpus went unread.
  const configErrors = deadPatterns.length;
  console.log(`\n검사 완료: 파일 ${targets.length}개, 오류 ${errorCount + configErrors}건, 경고 ${warningCount}건`);
  reportDarkCommands(root, cliPath);
  return errorCount + configErrors > 0 || (args.strict && warningCount > 0) ? 1 : 0;
}

/**
 * `check` reads the glossary alone. The sentence-rule sweep, the resource audit and the
 * suspects list all need `.claude/l10n.json`, and without it they refuse to start — so a
 * project that never declared its kinds gets a clean `check` and three silent commands.
 *
 * A count of zero is the most convincing output this tool produces, and it is exactly what
 * a project with no declaration gets. Saying which commands did NOT run is the difference
 * between "nothing is wrong" and "one of four checks looked".
 */
function reportDarkCommands(root, cliPath) {
  if (existsSync(join(root, '.claude', 'l10n.json'))) return;
  console.log('');
  console.log('⚠ .claude/l10n.json이 없어 이 저장소에서는 check만 돕니다.');
  console.log('  꺼져 있는 것: rules(문장 규칙 훑기) · audit(로케일 짝·조사) · suspects(문체 의심 문장)');
  console.log('  이 0건은 용어사전 낱말 검사의 0건이지, 문장 검사를 통과했다는 뜻이 아닙니다.');
  console.log(`  선언을 만들려면: node ${l10nCommand(cliPath)} --init-l10n`);
}

/**
 * The command that can actually write the declaration.
 *
 * `l10n.mjs` passes its own subcommand in as part of `cliPath`, so its hint is the path
 * itself. The hook entry point passes a bare script path and rejects the l10n flags, so a
 * hint built from it names a command that exits 2 — name the tool beside it instead.
 */
function l10nCommand(cliPath) {
  return cliPath.endsWith(' check') ? cliPath : `${join(dirname(cliPath), 'l10n.mjs')} check`;
}
