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
export function makeLocaleResourceMatcher(patterns, root) {
  if (patterns.length === 0) return () => false;
  const matchers = patterns.map(makeExcludeMatcher);
  return (file) => {
    const rel = relative(root, resolve(file)).split(sep).join('/');
    if (rel.startsWith('..')) return false;
    return matchers.some((matches) => matches(rel));
  };
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
const PARTICLE_WORD_SKIP = /(ㄴ가|[간-힣]?[는은른운한인]가|언젠가|누군가|어딘가|뭔가|무언가|선가)$/;
// Words that simply END in 이 or 가, where the tail is part of the word rather than a
// particle. Adverbs are the ones this rule keeps mistaking for a noun: `가까이 모인다` reads
// as 가까+이 and gets corrected to something that is not Korean.
const PARTICLE_TAIL_SKIP =
  /(레이|플레이|어레이|웨이|페이|메이|효과|초과|평가|전문가|국가|증가|참가|원가|단가|보이|사이|차이|넓이|길이|높이|깊이|먹이|놀이|쓰임새|가까이|같이|굳이|깊숙이|일찍이|나란히|틈틈이|샅샅이|곰곰이|번번이|낱낱이|고이|많이)$/;

function hasFinalConsonant(ch) {
  const code = ch.codePointAt(0);
  if (code < 0xac00 || code > 0xd7a3) return null;
  return (code - 0xac00) % 28 !== 0;
}

function checkParticles(lines) {
  const hits = [];
  lines.forEach((line, idx) => {
    for (const m of line.matchAll(PARTICLE_RE)) {
      const [, stem, particle] = m;
      const whole = stem + particle;
      if (PARTICLE_STEM_SKIP.test(stem)) continue;
      if (/[는은던]$/.test(stem)) continue;
      if (PARTICLE_WORD_SKIP.test(whole) || PARTICLE_TAIL_SKIP.test(whole)) continue;
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
// **Annotations are skipped, and the reason is the premise rather than tidiness.** A note
// addressed to whoever maintains the file (audit.localeAnnotationKeys) is prose, and the
// tokens in it are usually cross-references a build resolves to a fixed string — a value
// that IS known when the sentence is written, which is the one case this rule has nothing
// to say about. Screen copy is what it is for.
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

function checkInterpolatedParticles(lines, isAnnotation = () => false) {
  const hits = [];
  lines.forEach((line, idx) => {
    for (const m of line.matchAll(INTERPOLATION_PARTICLE_RE)) {
      if (m[1] === '}') {
        // `${` … `}` and `{` … `}` both end in `}`; requiring an opening brace before the
        // match on the same line keeps a stray closing brace in prose from firing.
        const open = line.lastIndexOf('{', m.index);
        if (open === -1) continue;
        if (BRACE_ENUMERATION.test(line.slice(open + 1, m.index))) continue;
      }
      if (isAnnotation(idx, m.index)) continue;
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

export function auditFile(filePath, rules, checkUntranslated, isLocaleResource = false, annotationKeys = new Set()) {
  const content = readFileSync(filePath, 'utf8');
  const isSvg = !isLocaleResource && /\.svg$/i.test(filePath);
  const isProse = !isSvg && !isLocaleResource;
  let lines;
  if (isLocaleResource) lines = stripCodeLinesToStringValues(content);
  else if (isSvg) lines = stripSvgLines(content);
  else lines = stripLines(content);
  const fm = isProse ? frontMatterRange(content.split(/\r?\n/)) : null;
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

  for (const rule of rules) {
    // A screen-only rule bans a word where a user reads it and nowhere else. A design document
    // has to be able to name the thing it specifies, and so does a note written beside a screen.
    if (rule.screenOnly && !isLocaleResource) continue;
    const hits = [];
    lines.forEach((line, idx) => {
      rule.pattern.lastIndex = 0;
      for (const m of line.matchAll(rule.pattern)) {
        if (rule.screenOnly && isAnnotation(idx, m.index)) continue;
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
  for (const hit of checkInterpolatedParticles(lines, isAnnotation)) {
    errors.push({...hit, count: 1, rule: {
      source: 'interpolated-particle', label: '치환값 뒤의 조사', level: 'error', threshold: 1,
      suggestion: '값의 받침을 알 수 없으므로 조사가 오지 않게 문장을 고친다',
    }});
  }
  for (const hit of checkRepeats(lines)) {
    warnings.push({...hit, count: 1, rule: {
      source: 'repeat', label: '같은 말이 잇달아 나옴', level: 'warn', threshold: 1,
      suggestion: '치환이 겹쳐 생긴 중복인지 확인한다',
    }});
  }

  // Untranslated-content heuristic: flag remaining English prose lines.
  // Markdown-only — the SVG mask leaves isolated short labels that would
  // misfire this prose detector, and an English locale resource is correct by
  // definition.
  if (checkUntranslated && isProse) {
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
    'register: "screen" = 화면 문구(합니다체), "manual" = 독자용 합니다체 산문,',
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
    discovered = discoverGlossary();
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

  const {rules} = mergeGlossaries(base, project);

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
  console.log('');

  const isLocaleResource = makeLocaleResourceMatcher(config.localeResources, root);
  const annotationKeys = new Set(config.localeAnnotationKeys);
  const {files: targets, excludedCount, glossarySkipped} = resolveTargets(args, config, root, discovered?.path, isLocaleResource);
  if (excludedCount > 0) console.log(`audit.exclude 패턴으로 파일 ${excludedCount}개 제외됨`);
  if (glossarySkipped) console.log('용어사전 파일 자체는 감사 대상에서 제외됩니다');
  if (targets.length === 0) {
    console.log('검사 대상 파일이 없습니다.');
    return 0;
  }

  const checkUntranslated = args.untranslated || config.untranslated;
  let errorCount = 0;
  let warningCount = 0;
  for (const file of targets) {
    const rel = relative(root, file);
    const relPath = rel.startsWith('..') ? file : rel;
    const {errors, warnings} = auditFile(file, rules, checkUntranslated, isLocaleResource(file), annotationKeys);
    errorCount += errors.length;
    warningCount += warnings.length;
    for (const f of errors) console.log(formatFinding(relPath, f, 'error'));
    for (const f of warnings) console.log(formatFinding(relPath, f, 'warn'));
  }

  console.log(`\n검사 완료: 파일 ${targets.length}개, 오류 ${errorCount}건, 경고 ${warningCount}건`);
  reportDarkCommands(root, cliPath);
  return errorCount > 0 || (args.strict && warningCount > 0) ? 1 : 0;
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
