#!/usr/bin/env node
/**
 * Korean copy tool for a whole project — documents and locale resources alike.
 *
 * One entry point for the korean-docs workflow. `check` audits documents the
 * same way the write-time hook does (same engine, same verdicts); the resource
 * commands find the translated text a product ships — front-end i18n
 * catalogues, back-end message bundles, mail templates, manuals, wireframe
 * sources — and let one term be searched or audited across all of them in a
 * single pass.
 *
 *   node l10n.mjs check    [paths...] [--all] [--strict] [--untranslated]
 *   node l10n.mjs list     [--kind K] [--lang L]
 *   node l10n.mjs grep     <pattern> [--regex] [--kind K] [--lang L]
 *   node l10n.mjs rules    [--test] [--scope S] [--kind K]
 *   node l10n.mjs audit    [--kind K]
 *   node l10n.mjs suspects [--min N] [--limit N] [--kind K]
 *   node l10n.mjs apply    --patch <file> [--write]
 *   node l10n.mjs stats
 *
 * Rule sources — the same ones for every command, so a term registered once in
 * the project glossary is enforced on documents and screen copy alike:
 *   1. The glossary pair: GLOSSARY.base.md bundled with the skill, merged with
 *      the project glossary (.claude/GLOSSARY.md), replacement and exception
 *      semantics included. This feeds `check` and `audit`.
 *   2. The style-rule packs: RULES.base.json bundled with the skill (universal
 *      rules always, domain scopes when the project opts in) plus the
 *      project's own .claude/l10n-rules.json. These feed `rules` and are
 *      verified against their own hit/miss examples by `rules --test`.
 *
 * The resource commands edit *values only*. A JSON key, a properties key, an
 * HTML tag, a Thymeleaf attribute, a placeholder, a markdown code fence — none
 * of them are text a reader sees, and a blind file-wide `sed` corrupts every
 * one of them. Each format below yields the byte ranges that are genuinely
 * reader-facing, and every command works on those ranges alone.
 *
 * Every command here finds; none of them rewrites on a rule's say-so. A rule
 * knows where a word sits, never what it means there — the same 허용 수량 is a
 * contract's seat count on one line and a quota's ceiling on the next, and two
 * rules that each match correctly can still leave one sentence reading
 * 라이선스 수량 라이선스 하나가. Sentences are rewritten by whoever reads them and come
 * back through `apply --patch`, which refuses any item whose stored original
 * no longer matches the file.
 *
 * Apply is a dry run until `--write` is passed.
 *
 * Project layout config: `.claude/l10n.json` at the project root declares the
 * resource kinds (path globs per language), proper nouns, sample patterns and
 * rule scopes — beside the glossary and the project rule pack it belongs with.
 * The skill ships no kind defaults — a project's layout is data, never an
 * assumption baked into shared code.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverGlossary, loadRuleSet, loadRulePacks } from "./lib/glossary.mjs";
import { initGlossary, initL10n, runDocAudit, annotationRanges } from "./lib/doc-audit.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);

/**
 * Project to operate on. Defaults to the root of the project holding the
 * current directory (the directory whose glossary discovery succeeds, else the
 * current directory itself); `--root <dir>` points it elsewhere so the rule
 * packs can be checked against another project. Reading another repository is
 * fine; writing to one is not what this flag is for, and `apply` refuses it.
 */
const ROOT_OVERRIDE = (() => {
  const i = process.argv.indexOf("--root");
  if (i >= 0 && process.argv[i + 1]) return resolve(process.argv[i + 1]);
  const inline = process.argv.find((a) => a.startsWith("--root="));
  return inline ? resolve(inline.slice(7)) : null;
})();

const START = ROOT_OVERRIDE ?? process.cwd();
const ROOT = discoverGlossary(START)?.root ?? START;

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generic defaults only. Everything project-shaped — which paths hold locale
 * resources, which nouns stay English, which sample values placeholders use —
 * comes from `.claude/l10n.json` at the project root. A kind names a family of
 * locale resources: `patterns` are globs passed to `git ls-files`, with
 * `{lang}` standing in for the language code, and `register` states the copy's
 * voice — "screen" (UI copy, 합니다체), "manual" (reader-facing 합니다체 prose) or
 * absent for plain -다체 working documents. Style smells that only make sense
 * for one register are gated on it.
 */
const DEFAULT_CONFIG = {
  languages: ["ko"],
  defaultLanguage: "ko",
  /** Extra names that stay in their original spelling, beyond the glossary's 원문 유지 용어. */
  properNouns: [],
  /** Sample values shown as placeholders in mockups and mail previews. */
  samplePatterns: [],
  /** Files whose English is deliberate, so the missing-translation check skips them. */
  untranslatedExclude: [],
  /** Domain scopes of RULES.base.json the project opts into (universal always applies). */
  ruleScopes: [],
  /** Names the domain in the suspects guidance, e.g. "라이선스·구독·결제". */
  domainHint: null,
  kinds: {},
};

function loadConfig() {
  const path = join(ROOT, ".claude", "l10n.json");
  if (!existsSync(path)) return DEFAULT_CONFIG;
  const override = JSON.parse(readFileSync(path, "utf8"));
  return {
    ...DEFAULT_CONFIG,
    ...override,
    kinds: { ...(override.kinds ?? {}) },
  };
}

const CONFIG = loadConfig();

function requireKinds() {
  if (Object.keys(CONFIG.kinds).length) return;
  throw new Error(
    "자원 부류가 선언되지 않았다 — 프로젝트의 .claude/l10n.json에 kinds를 적어야 한다.\n" +
      "  예: { \"languages\": [\"ko\",\"en\"], \"kinds\": { \"frontend\": {\n" +
      "        \"label\": \"프론트엔드 i18n\", \"patterns\": [\"apps/**/locales/{lang}.json\"],\n" +
      "        \"format\": \"json\", \"register\": \"screen\" } } }\n" +
      "  문서 감사는 부류 선언 없이도 된다: l10n.mjs check [경로...]",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// File discovery
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Files matching a glob, from git when the root is a repository.
 *
 * Falls back to the filesystem when it is not — a monorepo whose subprojects each carry
 * their own `.git` has no index at the top, and `git ls-files` there returns nothing at
 * all rather than erroring. Without the fallback such a tree scans as empty and reads as
 * "no problems found", which is the most misleading result this tool can produce.
 *
 * `-z` is not optional. Without it git quotes any path holding a byte outside ASCII —
 * a Korean document file name comes back as `"docs/\355\225\234.md"`, quotes and octal
 * escapes included — and every such file is then opened at a path that does not exist.
 * A repository that writes its documents in its own language is exactly the one this
 * tool exists for, so that spelling has to survive the round trip intact.
 */
function gitFiles(pattern) {
  try {
    const out = execFileSync("git", ["ls-files", "-z", "--", pattern], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
    const files = out.split("\0").filter(Boolean);
    if (files.length) return files;
  } catch {
    /* not a repository — fall through */
  }
  return findFiles(pattern);
}

const PRUNED = new Set([".git", "node_modules", "build", "dist", "target", ".gradle", ".next", "vendor"]);

/** Glob against the filesystem, honouring only the subset of glob syntax used here. */
function findFiles(pattern) {
  // `**/` spans zero or more directories; a lone `*` stops at a separator.
  const source = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\//g, "@@ANY_DIRS@@")
    .replace(/\*\*/g, "@@ANY@@")
    .replace(/\*/g, "[^/]*")
    .replace(/@@ANY_DIRS@@/g, "(?:[^/]+/)*")
    .replace(/@@ANY@@/g, ".*")
    .replace(/\?/g, "[^/]");
  const re = new RegExp(`^${source}$`);

  const out = [];
  const walk = (dir, rel) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".") && e.name !== ".claude" && e.name !== ".plans") continue;
      if (PRUNED.has(e.name)) continue;
      const child = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(join(dir, e.name), child);
      else if (re.test(child)) out.push(child);
    }
  };
  walk(ROOT, "");
  return out;
}

function formatOf(kind, file) {
  const declared = kind ? CONFIG.kinds[kind]?.format : "auto";
  if (declared && declared !== "auto") return declared;
  if (file.endsWith(".mjs") || file.endsWith(".js")) return "wireframe";
  if (file.endsWith(".ts") || file.endsWith(".tsx")) return "ts";
  if (file.endsWith(".json")) return "json";
  if (file.endsWith(".properties")) return "properties";
  if (file.endsWith(".md")) return "markdown";
  if (file.endsWith(".html") || file.endsWith(".htm")) return "html";
  return "text";
}

/** Every resource file, as `{ kind, lang, file, format }`, deduplicated across globs. */
function discover({ kind, lang } = {}) {
  requireKinds();
  const kinds = kind ? [kind] : Object.keys(CONFIG.kinds).filter((k) => !CONFIG.kinds[k].optIn);
  const langs = lang ? [lang] : [CONFIG.defaultLanguage];
  const found = new Map();
  for (const k of kinds) {
    const spec = CONFIG.kinds[k];
    if (!spec) throw new Error(`알 수 없는 부류: ${k}`);
    for (const l of langs) {
      // A kind whose globs name no language is single-language: it belongs to the
      // default language and must not be reported under any other.
      const languageless = spec.patterns.every((p) => !p.includes("{lang}"));
      if (languageless && l !== CONFIG.defaultLanguage) continue;
      // A base-language bundle has no language suffix; its files are the ones the
      // suffixed globs do NOT match.
      const isBase = spec.baseLanguage === l;
      const globs = isBase ? (spec.basePatterns ?? []) : spec.patterns;
      const suffixed = isBase
        ? new Set(CONFIG.languages.flatMap((x) => spec.patterns.flatMap((p) => gitFiles(p.replaceAll("{lang}", x)))))
        : null;
      for (const glob of globs) {
        for (const file of gitFiles(glob.replaceAll("{lang}", l))) {
          if (suffixed?.has(file)) continue;
          if ((spec.exclude ?? []).some((p) => file.startsWith(p))) continue;
          found.set(`${k}:${l}:${file}`, { kind: k, lang: l, file, format: formatOf(k, file) });
        }
      }
    }
  }
  return [...found.values()].sort((a, b) => a.file.localeCompare(b.file));
}

// ─────────────────────────────────────────────────────────────────────────────
// Segment extraction — the reader-facing ranges of each format
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A segment is one span of reader-facing text.
 *
 * `start`/`end` are byte offsets into the raw file, so a rewrite can be applied to the
 * original source without reserializing it — reserializing a JSON catalogue reorders
 * nothing but reformats everything, and the diff becomes unreadable.
 */
function segment(start, end, text, key) {
  return { start, end, text, key };
}

/** JSON: string values only, never keys. */
function segmentsJson(src) {
  const segments = [];
  // Walk the raw text so offsets stay exact. A key is the string that a `:` follows.
  const path = [];
  let i = 0;
  let pendingKey = null;

  while (i < src.length) {
    const ch = src[i];
    if (ch === '"') {
      const start = i;
      i += 1;
      let value = "";
      while (i < src.length && src[i] !== '"') {
        if (src[i] === "\\") {
          value += src[i] + src[i + 1];
          i += 2;
        } else {
          value += src[i];
          i += 1;
        }
      }
      i += 1; // closing quote
      // Look ahead: a `:` means this string was a key.
      let j = i;
      while (j < src.length && /\s/.test(src[j])) j += 1;
      if (src[j] === ":") {
        pendingKey = value;
      } else {
        const key = [...path, pendingKey].filter(Boolean).join(".");
        segments.push(segment(start + 1, i - 1, value, key || "(값)"));
        pendingKey = null;
      }
      continue;
    }
    if (ch === "{" || ch === "[") {
      if (pendingKey) path.push(pendingKey);
      else if (ch === "{") path.push(null);
      pendingKey = null;
    } else if (ch === "}" || ch === "]") {
      path.pop();
      pendingKey = null;
    }
    i += 1;
  }
  return segments;
}

/** Java properties: everything right of the first unescaped `=` or `:`. */
function segmentsProperties(src) {
  const segments = [];
  let offset = 0;
  for (const rawLine of src.split("\n")) {
    const line = rawLine;
    const trimmed = line.trimStart();
    const lead = line.length - trimmed.length;
    if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("!")) {
      let sep = -1;
      for (let i = 0; i < line.length; i += 1) {
        if (line[i] === "\\") {
          i += 1;
          continue;
        }
        if (line[i] === "=" || line[i] === ":") {
          sep = i;
          break;
        }
      }
      if (sep >= 0) {
        const key = line.slice(lead, sep).trim();
        let vs = sep + 1;
        while (vs < line.length && (line[vs] === " " || line[vs] === "\t")) vs += 1;
        const value = line.slice(vs);
        if (value) segments.push(segment(offset + vs, offset + line.length, value, key));
      }
    }
    offset += line.length + 1;
  }
  return segments;
}

/**
 * HTML: text nodes only.
 *
 * Attributes are skipped wholesale. That is deliberate for Thymeleaf — `th:text="${x}"`
 * is an expression, and a `title` attribute that does hold prose is rare enough that
 * catching it is not worth the risk of rewriting an expression by accident.
 */
function segmentsHtml(src) {
  const segments = [];
  const skip = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;
  const blocked = [];
  let m;
  while ((m = skip.exec(src))) blocked.push([m.index, m.index + m[0].length]);
  const isBlocked = (pos) => blocked.some(([a, b]) => pos >= a && pos < b);

  const between = /> *([^<>]*?) *</g;
  while ((m = between.exec(src))) {
    const text = m[1];
    if (!text.trim()) continue;
    if (isBlocked(m.index)) continue;
    const start = m.index + m[0].indexOf(text);
    // The nearest preceding tag name gives the reader a hint about where this sits.
    const before = src.slice(Math.max(0, m.index - 200), m.index + 1);
    const tag = [...before.matchAll(/<([a-zA-Z][\w-]*)/g)].pop()?.[1] ?? "text";
    segments.push(segment(start, start + text.length, text, tag));
  }

  const title = /<title>([\s\S]*?)<\/title>/i.exec(src);
  if (title && title[1].trim()) {
    const start = title.index + title[0].indexOf(title[1]);
    if (!segments.some((s) => s.start === start)) {
      segments.push(segment(start, start + title[1].length, title[1], "title"));
    }
  }
  return segments.sort((a, b) => a.start - b.start);
}

/** Markdown: prose only — code fences, inline code, link targets and HTML are held out. */
function segmentsMarkdown(src) {
  const blocked = [];
  const hold = (re) => {
    let m;
    while ((m = re.exec(src))) blocked.push([m.index, m.index + m[0].length]);
  };
  hold(/```[\s\S]*?```/g);
  hold(/~~~[\s\S]*?~~~/g);
  hold(/`[^`\n]+`/g);
  hold(/\]\([^)\s]+\)/g); // link/image target, not the label
  hold(/^ {4,}\S.*$/gm); // indented code
  hold(/<[^>\n]+>/g);
  hold(/^---$[\s\S]*?^---$/gm); // front matter

  blocked.sort((x, y) => x[0] - y[0]);
  let blockIdx = 0;

  const segments = [];
  let offset = 0;
  for (const line of src.split("\n")) {
    const end = offset + line.length;
    if (line.trim()) {
      // Trim the markdown prefix (heading marks, list bullets, quote marks) so a
      // replacement can never eat the structure. A bullet requires whitespace after it —
      // without that, the first `*` of a `**bold**` run is mistaken for a bullet and the
      // segment starts one character late, so `**Files:**` can never be matched whole.
      const prefix = /^(\s*(?:#{1,6}\s+|>+\s*|[-*+](?=\s)\s*|\d+\.\s+)?)/.exec(line)[1];
      let cursor = offset + prefix.length;

      // Emit the prose AROUND each blocked span rather than dropping the whole line.
      // Skipping the line outright hid every sentence that merely mentions a code
      // identifier — and worse, it let a two-line sentence be rewritten on one line
      // only, leaving the other half stranded without a predicate.
      // `blocked` is scanned once per line, so a per-line filter over the whole array
      // is quadratic — on a long document that turned a sub-second run into minutes.
      // The array is pre-sorted below, so advance a cursor through it instead.
      while (blockIdx < blocked.length && blocked[blockIdx][1] <= cursor) blockIdx += 1;
      const spans = [];
      for (let k = blockIdx; k < blocked.length && blocked[k][0] < end; k += 1) {
        if (blocked[k][1] > cursor) spans.push(blocked[k]);
      }
      const emit = (from, to) => {
        const text = src.slice(from, to);
        if (!text.trim()) return;
        const lead = text.length - text.trimStart().length;
        const tail = text.length - text.trimEnd().length;
        segments.push(segment(from + lead, to - tail, text.slice(lead, text.length - tail), `L${segments.length + 1}`));
      };
      for (const [a, b] of spans) {
        if (a > cursor) emit(cursor, a);
        cursor = Math.max(cursor, b);
      }
      if (cursor < end) emit(cursor, end);
    }
    offset = end + 1;
  }
  return segments;
}

/**
 * Wireframe board sources: JavaScript modules whose string literals hold HTML.
 *
 * Three things are interleaved here — JS syntax, HTML markup, and the Korean a reviewer
 * reads — and only the third may be rewritten. The filter that makes this safe is that a
 * segment must contain Hangul: a class name, a route, a CSS declaration and an enum-ish
 * option value never do, so they are excluded by construction rather than by a blocklist
 * of things to avoid.
 */
function segmentsWireframe(src) {
  const segments = [];

  // Pass 1 — locate every string literal, tracking line comments so a commented-out
  // apostrophe cannot desynchronize the scanner.
  const literals = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "/" && src[i + 1] === "/") {
      const nl = src.indexOf("\n", i);
      i = nl === -1 ? src.length : nl;
      continue;
    }
    if (ch === "/" && src[i + 1] === "*") {
      const close = src.indexOf("*/", i + 2);
      i = close === -1 ? src.length : close + 2;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      const start = i + 1;
      i += 1;
      while (i < src.length) {
        if (src[i] === "\\") {
          i += 2;
          continue;
        }
        if (src[i] === quote) break;
        // A template literal's `${...}` holds code, not prose — skip it wholesale.
        if (quote === "`" && src[i] === "$" && src[i + 1] === "{") {
          let depth = 1;
          i += 2;
          while (i < src.length && depth > 0) {
            if (src[i] === "{") depth += 1;
            else if (src[i] === "}") depth -= 1;
            i += 1;
          }
          continue;
        }
        i += 1;
      }
      if (i < src.length) literals.push([start, i]);
      i += 1;
      continue;
    }
    i += 1;
  }

  // Pass 2 — inside each literal, keep the runs that sit outside HTML tags and carry
  // Hangul. Splitting on tags also keeps `${...}` interpolations intact, since the
  // scanner above never let them into a literal's interior.
  for (const [ls, le] of literals) {
    const body = src.slice(ls, le);
    let cursor = 0;
    const emit = (from, to) => {
      const text = body.slice(from, to);
      if (!HANGUL.test(text)) return;
      // Trim surrounding whitespace so a rewrite cannot swallow layout.
      const lead = text.length - text.trimStart().length;
      const tail = text.length - text.trimEnd().length;
      const inner = text.slice(lead, text.length - tail);
      if (!inner) return;
      segments.push(segment(ls + from + lead, ls + to - tail, inner, "text"));
    };
    const tag = /<[^<>]*>/g;
    let m;
    while ((m = tag.exec(body))) {
      emit(cursor, m.index);
      cursor = m.index + m[0].length;
    }
    emit(cursor, body.length);
  }

  return segments.sort((a, b) => a.start - b.start);
}

/**
 * A locale catalogue written as a JavaScript or TypeScript object literal —
 * `'namespace.key': 'text',` — which is how a typed i18n package keeps its copy so the
 * key set can be a type. Values are read whole, including the ones a formatter wrapped
 * onto the next line and the ones split across concatenated pieces; a line-by-line
 * reader sees those as keys with no value and reports every one as a missing translation.
 *
 * Only quoted string values are returned. Keys, comments, imports and the `as const`
 * tail are not copy and must not reach a rule.
 */
function segmentsTsObject(src) {
  const segments = [];
  // 'key' or "key" or bareKey, then a colon, then the value that follows it.
  const keyAt = /(?:^|[\n,{])\s*(?:(['"])((?:[^\\]|\\.)*?)\1|([A-Za-z_$][\w$]*))\s*:/g;
  let m;
  while ((m = keyAt.exec(src))) {
    const key = m[2] ?? m[3];
    let at = m.index + m[0].length;
    // Skip whitespace and comments between the colon and the value.
    for (;;) {
      while (at < src.length && /\s/.test(src[at])) at += 1;
      if (src.startsWith("//", at)) {
        const nl = src.indexOf("\n", at);
        at = nl === -1 ? src.length : nl + 1;
        continue;
      }
      if (src.startsWith("/*", at)) {
        const end = src.indexOf("*/", at);
        at = end === -1 ? src.length : end + 2;
        continue;
      }
      break;
    }
    // A value is one or more adjacent string literals; anything else is not copy.
    while (at < src.length && (src[at] === "'" || src[at] === '"' || src[at] === "`")) {
      const quote = src[at];
      const from = at + 1;
      let i = from;
      while (i < src.length && src[i] !== quote) i += src[i] === "\\" ? 2 : 1;
      if (i >= src.length) break;
      segments.push(segment(from, i, src.slice(from, i), key));
      at = i + 1;
      while (at < src.length && /\s/.test(src[at])) at += 1;
      if (src[at] === "+") {
        at += 1;
        continue;
      }
      break;
    }
    keyAt.lastIndex = Math.max(keyAt.lastIndex, at);
  }
  return segments;
}

function segmentsText(src) {
  const segments = [];
  let offset = 0;
  for (const line of src.split("\n")) {
    if (line.trim()) segments.push(segment(offset, offset + line.length, line, "line"));
    offset += line.length + 1;
  }
  return segments;
}

const EXTRACTORS = {
  json: segmentsJson,
  properties: segmentsProperties,
  ts: segmentsTsObject,
  html: segmentsHtml,
  markdown: segmentsMarkdown,
  wireframe: segmentsWireframe,
  text: segmentsText,
};

/**
 * Keys whose values are commentary addressed to whoever maintains the file rather
 * than copy a user reads — a wireframe frame's design notes beside the labels it
 * draws. The glossary's front matter names them, and `check` already exempts them
 * from screen-only bans; `audit` reads the same list so the two agree. Without it a
 * note that says 청크 because it documents chunking is reported as screen copy, and
 * the only way to clear it is to make the note say the wrong thing.
 */
function annotationKeys() {
  return new Set(ruleSet().config?.localeAnnotationKeys ?? []);
}

function readSegments(entry) {
  const src = readFileSync(join(ROOT, entry.file), "utf8");
  const segments = EXTRACTORS[entry.format](src);
  const ranges = annotationRanges(src, annotationKeys());
  if (ranges.length) {
    for (const seg of segments) {
      seg.annotation = ranges.some(([start, end]) => seg.start >= start && seg.start < end);
    }
  }
  return { src, segments };
}

// ─────────────────────────────────────────────────────────────────────────────
// Korean particle agreement
// ─────────────────────────────────────────────────────────────────────────────

/** True when the last character is a Hangul syllable with a final consonant (받침). */
function hasFinalConsonant(word) {
  const chars = [...word];
  for (let i = chars.length - 1; i >= 0; i -= 1) {
    const code = chars[i].codePointAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
    if (/[0-9A-Za-z]/.test(chars[i])) {
      // A Latin/digit tail agrees by how it is read aloud; these are the endings that
      // are pronounced with a final consonant in Korean.
      return /[013678lmnLMN]$/.test(chars[i]) || /[a-zA-Z]/.test(chars[i]);
    }
    if (/[)\]}"'’”]/.test(chars[i])) continue;
    return false;
  }
  return false;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule loading — the merged glossary and the style-rule packs
// ─────────────────────────────────────────────────────────────────────────────

const HANGUL = /[가-힣]/;
const PLACEHOLDER = /\{\{[^}]+\}\}|\{[0-9A-Za-z_.]+\}|\$\{[^}]+\}|%[sd]/g;

let RULE_SET = null;

/** Merged glossary rule set (base + project), loaded once. */
function ruleSet() {
  RULE_SET ??= loadRuleSet({ startDir: ROOT });
  return RULE_SET;
}

let RULE_PACKS = null;

/** Style-rule packs (skill base pack + project pack), loaded once. */
function rulePacks() {
  RULE_PACKS ??= loadRulePacks({ root: ROOT, scopes: CONFIG.ruleScopes ?? [] });
  return RULE_PACKS;
}

/**
 * The glossary rules as audit bans. Levels and per-file thresholds carry over
 * from the glossary tables; `screenOnly` rules apply only to kinds whose
 * register is "screen" — a design document has to be able to name the thing it
 * specifies.
 */
function glossaryBans() {
  return ruleSet().rules.map((r) => ({
    re: r.pattern,
    term: r.source,
    correct: r.suggestion || "(대체어 없음)",
    label: r.label,
    level: r.level,
    threshold: r.threshold,
    screenOnly: r.screenOnly === true,
  }));
}

/**
 * Every Korean word this tool's rule sources are capable of writing into a file.
 *
 * A particle after one of these can be judged exactly: the word is a noun the rules put
 * there, so the syllable before the particle is a word boundary by construction. That
 * removes the ambiguity that forces the general check to stay narrow — 경로 and 초과 are
 * unjudgeable in running text, but 아이디 followed by 은 is unambiguously wrong when the
 * rules are what produced 아이디.
 *
 * This is the check that catches 사용자명은 → 아이디은.
 */
function replacementNouns() {
  const words = new Set();
  const add = (v) => {
    if (typeof v !== "string") return;
    // A replacement may be a phrase ("시스템 내역") or a slash-separated pair
    // ("대행사 내역 / 시스템 내역"). Both carry particles on their final syllable, so
    // split the alternatives and keep each — skipping phrases outright is what let
    // `시스템 내역를` through: the swap changed 장부(vowel-final) to 내역(consonant-final)
    // and nothing re-checked the particle.
    for (const part of v.split(/[/·,]/)) {
      const w = part.trim();
      if (!w || !/[가-힣]$/.test(w)) continue;
      if (w.length < 2) continue;
      words.add(w);
    }
  };
  for (const r of rulePacks().active) add(r.replace);
  for (const r of ruleSet().rules) add(r.suggestion);
  for (const t of ruleSet().terms.values()) add(t.korean);
  return [...words].sort((a, b) => b.length - a.length);
}

// All wrong noun+particle forms are literal strings, so they compile into ONE
// alternation tested once per segment. Compiling a regex per noun per particle
// inside the segment loop made the audit's runtime quadratic in the rule count,
// and the merged glossary carries several times the nouns the old term file did.
let WRONG_FORMS = null; // wrong form → corrected form
let WRONG_FORMS_RE = null;

function buildWrongForms() {
  WRONG_FORMS = new Map();
  for (const noun of replacementNouns()) {
    const hasFinal = hasFinalConsonant(noun);
    for (const { afterConsonant, afterVowel } of PARTICLE_CHECKS) {
      const wrong = hasFinal ? afterVowel : afterConsonant;
      const right = hasFinal ? afterConsonant : afterVowel;
      if (wrong === right) continue;
      // ㄹ-final nouns take 로, not 으로 — the pair above already has that backwards.
      if (afterConsonant === "으로" && (noun.codePointAt(noun.length - 1) - 0xac00) % 28 === 8) continue;
      WRONG_FORMS.set(noun + wrong, noun + right);
    }
  }
  // Longest alternative first, so a phrase noun wins over a bare noun it contains.
  const alts = [...WRONG_FORMS.keys()].sort((a, b) => b.length - a.length).map(escapeRegex);
  WRONG_FORMS_RE = alts.length ? new RegExp(`(?:${alts.join("|")})(?![가-힣])`, "g") : null;
}

/** Particles disagreeing with a noun the rules wrote. */
function replacedWordParticleErrors(text) {
  if (WRONG_FORMS === null) buildWrongForms();
  if (!WRONG_FORMS_RE) return [];
  const found = [];
  WRONG_FORMS_RE.lastIndex = 0;
  let m;
  while ((m = WRONG_FORMS_RE.exec(text))) {
    found.push({ wrong: m[0], correct: WRONG_FORMS.get(m[0]) });
  }
  return found;
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit checks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A value that carries no Hangul at all in a Korean catalogue is an untranslated
 * leftover — unless it is a proper noun, an identifier, or pure punctuation/markup,
 * which this filter lets through. Proper nouns come from the glossary's
 * 원문 유지 용어 tables plus the project config's own list.
 */
function properNouns() {
  return [...ruleSet().keepOriginal, ...(CONFIG.properNouns ?? [])];
}

function looksUntranslated(text) {
  // A JSON catalogue may store Hangul as `\uXXXX`; decode before judging or every such
  // value reads as untranslated English.
  const decoded = text.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  if (HANGUL.test(decoded)) return false;
  for (const p of CONFIG.samplePatterns ?? []) if (new RegExp(p).test(decoded.trim())) return false;
  let bare = decoded.replace(PLACEHOLDER, "").trim();
  for (const noun of properNouns()) bare = bare.replaceAll(noun, "");
  bare = bare.replace(/©\s*\d{4}/g, "").trim();
  if (!bare) return false;
  if (!/[A-Za-z]/.test(bare)) return false;
  if (bare.length < 2) return false;
  // Identifiers, URLs, codes and single tokens are legitimately left in English.
  if (/^[A-Z][A-Z0-9_]*$/.test(bare)) return false;
  if (/^[a-z][a-zA-Z0-9]*$/.test(bare) && !bare.includes(" ")) return false;
  if (/^https?:\/\//.test(bare)) return false;
  if (/^[\w.-]+@[\w.-]+$/.test(bare)) return false;
  if (/^[A-Za-z0-9\s.+#/-]{1,3}$/.test(bare)) return false;
  return true;
}

/**
 * Particles that disagree with the counter word in front of them.
 *
 * Scope is deliberately narrow: only a particle directly after a **number and a counter
 * word** is judged. Korean writes particles attached to the preceding word with no
 * space, so in general text there is no way to tell a particle from a noun that merely
 * ends in the same syllable — `경로`, `초과`, `차이`, `국가`, `단가` all end in one, and
 * checking every value flagged them by the hundred while finding two real defects.
 * A checker that is wrong nine times out of ten trains its reader to skip the output,
 * and the real defect goes with it.
 *
 * After a counter the reading is unambiguous, which is also where the defects are: a
 * quantity gets edited, the counter changes, and the particle is left behind.
 */
const COUNTERS = ["대", "개", "명", "건", "일", "원", "회", "번", "줄", "칸", "행", "쪽", "곳", "장", "부"];

const PARTICLE_CHECKS = [
  { afterConsonant: "이", afterVowel: "가" },
  { afterConsonant: "을", afterVowel: "를" },
  { afterConsonant: "과", afterVowel: "와" },
  { afterConsonant: "으로", afterVowel: "로" },
  { afterConsonant: "은", afterVowel: "는" },
];

function particleErrors(text) {
  const found = [...replacedWordParticleErrors(text)];
  const counters = COUNTERS.join("");
  for (const { afterConsonant, afterVowel } of PARTICLE_CHECKS) {
    for (const [particle, expectFinal] of [
      [afterConsonant, true],
      [afterVowel, false],
    ]) {
      // A digit or a closed placeholder, then a counter, then the particle.
      const re = new RegExp(`(?:[0-9]|\\}\\})\\s*([${counters}])${particle}(?![가-힣])`, "g");
      let m;
      while ((m = re.exec(text))) {
        const code = m[1].codePointAt(0) - 0xac00;
        const hasFinal = code % 28 !== 0;
        if (afterConsonant === "으로" && code % 28 === 8) continue; // ㄹ-final takes 로
        if (hasFinal !== expectFinal) {
          found.push({ wrong: m[1] + particle, correct: m[1] + (hasFinal ? afterConsonant : afterVowel) });
        }
      }
    }
  }
  return found;
}

// ─────────────────────────────────────────────────────────────────────────────
// Commands
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};

function cmdList(opts) {
  const entries = discover(opts);
  if (opts.json) {
    console.log(JSON.stringify(entries, null, 2));
    return 0;
  }
  let current = null;
  for (const e of entries) {
    if (e.kind !== current) {
      current = e.kind;
      console.log(`\n${C.bold(CONFIG.kinds[e.kind].label ?? e.kind)} ${C.dim(`(${e.kind})`)}`);
    }
    console.log(`  ${e.file}`);
  }
  console.log(`\n${entries.length}개 파일`);
  return 0;
}

function cmdStats(opts) {
  requireKinds();
  const rows = [];
  for (const kind of Object.keys(CONFIG.kinds)) {
    for (const lang of CONFIG.languages) {
      const entries = discover({ kind, lang });
      if (!entries.length) continue;
      let segments = 0;
      let chars = 0;
      for (const entry of entries) {
        const { segments: segs } = readSegments(entry);
        segments += segs.length;
        chars += segs.reduce((a, s) => a + s.text.length, 0);
      }
      rows.push({ kind, lang, files: entries.length, segments, chars });
    }
  }
  if (opts.json) {
    console.log(JSON.stringify(rows, null, 2));
    return 0;
  }
  console.log(`\n${"부류".padEnd(12)}${"언어".padEnd(6)}${"파일".padStart(6)}${"문구".padStart(8)}${"글자".padStart(10)}`);
  console.log("─".repeat(42));
  for (const r of rows) {
    console.log(
      `${(CONFIG.kinds[r.kind].label ?? r.kind).padEnd(12)}${r.lang.padEnd(6)}${String(r.files).padStart(6)}${String(r.segments).padStart(8)}${String(r.chars).padStart(10)}`,
    );
  }
  return 0;
}

function buildMatcher(pattern, useRegex) {
  return useRegex ? new RegExp(pattern, "g") : new RegExp(escapeRegex(pattern), "g");
}

function cmdGrep(pattern, opts) {
  const re = buildMatcher(pattern, opts.regex);
  const entries = discover(opts);
  const hits = [];
  for (const entry of entries) {
    const { src, segments } = readSegments(entry);
    for (const seg of segments) {
      re.lastIndex = 0;
      if (!re.test(seg.text)) continue;
      hits.push({
        file: entry.file,
        kind: entry.kind,
        key: seg.key,
        text: seg.text,
        line: src.slice(0, seg.start).split("\n").length,
      });
    }
  }
  if (opts.json) {
    console.log(JSON.stringify(hits, null, 2));
    return hits.length ? 0 : 1;
  }
  let currentFile = null;
  for (const hit of hits) {
    if (hit.file !== currentFile) {
      currentFile = hit.file;
      console.log(`\n${C.cyan(hit.file)}`);
    }
    re.lastIndex = 0;
    const shown = hit.text.replace(re, (m) => C.yellow(m));
    console.log(`  ${C.dim(`${hit.line}:`)} ${C.bold(hit.key)}  ${shown}`);
  }
  console.log(`\n${hits.length}건 · ${new Set(hits.map((h) => h.file)).size}개 파일`);
  return hits.length ? 0 : 1;
}

/** A rewrite must carry every placeholder through untouched. */
function placeholdersIntact(before, after) {
  const a = (before.match(PLACEHOLDER) ?? []).sort();
  const b = (after.match(PLACEHOLDER) ?? []).sort();
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Style-rule pack commands — portable Korean copy rules with self-verification
// ─────────────────────────────────────────────────────────────────────────────

function ruleMatchers(rule) {
  // Pack files may write bare regex source or `/…/` delimiters; both compile to the
  // same matcher, so a rule behaves identically in `rules`, `rules --test` and `audit`.
  return rule.find.map((p) => {
    const delimited = p.length > 2 && p.startsWith("/") && p.endsWith("/");
    return new RegExp(delimited ? p.slice(1, -1) : p, "g");
  });
}

/**
 * Verify every pack rule against its own examples.
 *
 * A sweep rule is only as safe as the near-misses it refuses. `텀` must catch a bare
 * term but never 커스텀 / 시스템 / 아이템, and the only way to keep that true as rules
 * accumulate is to make each rule state its own counter-examples and check them.
 * All pack rules are tested, opted-in or not — a broken rule is broken for the
 * next project even when this one does not run it.
 */
function cmdRulesTest(opts) {
  const rules = rulePacks().all;
  let failures = 0;
  for (const rule of rules) {
    const res = ruleMatchers(rule);
    const problems = [];
    for (const ex of rule.hit ?? []) {
      if (!res.some((re) => ((re.lastIndex = 0), re.test(ex)))) problems.push(["잡아야 하는데 놓침", ex]);
    }
    for (const ex of rule.miss ?? []) {
      const caught = res.find((re) => ((re.lastIndex = 0), re.test(ex)));
      if (caught) problems.push([`잡으면 안 되는데 잡음 (/${caught.source}/)`, ex]);
    }
    if (!(rule.hit ?? []).length) problems.push(["hit 예문이 없음", "규칙이 무엇을 잡는지 증명되지 않는다"]);
    if (!(rule.miss ?? []).length) problems.push(["miss 예문이 없음", "오탐을 막는 근거가 없다"]);

    if (problems.length) {
      failures += 1;
      console.log(`\n${C.red("✖")} ${C.bold(rule.id)} ${C.dim(rule.scope)}`);
      for (const [what, ex] of problems) console.log(`    ${what}: ${C.yellow(ex)}`);
    } else if (opts.verbose) {
      console.log(`${C.green("✔")} ${rule.id} ${C.dim(`(hit ${rule.hit.length} · miss ${rule.miss.length})`)}`);
    }
  }
  console.log(
    `\n검증한 규칙 ${rules.length}개 · ${failures ? C.red(`실패 ${failures}개`) : C.green("전부 통과")}` +
      C.dim("\n용어사전 규칙은 예문 검증 대상이 아니다 — 등재 후 check --list-rules 출력으로 대조한다"),
  );
  return failures ? 1 : 0;
}

/** Report every pack-rule hit across the resources, without changing anything. */
function cmdRulesScan(opts) {
  // An explicit --scope reaches rules the project did not opt into; the default
  // sweep runs universal rules plus the project's declared scopes.
  const active = opts.scope ? rulePacks().all.filter((r) => r.scope === opts.scope) : rulePacks().active;
  const entries = discover(opts);
  const byRule = new Map();

  for (const entry of entries) {
    const { src, segments } = readSegments(entry);
    const perFile = new Map();
    for (const seg of segments) {
      for (const rule of active) {
        for (const re of ruleMatchers(rule)) {
          re.lastIndex = 0;
          if (!re.test(seg.text)) continue;
          if (!perFile.has(rule.id)) perFile.set(rule.id, []);
          perFile.get(rule.id).push({
            file: entry.file,
            key: seg.key,
            text: seg.text,
            line: src.slice(0, seg.start).split("\n").length,
          });
          break;
        }
      }
    }
    // A frequency rule only fires when the file crosses its threshold. `~를 통해` once
    // is fine Korean; six times in one document is the tic the rule is after.
    for (const [id, hits] of perFile) {
      const rule = active.find((r) => r.id === id);
      if (rule.minPerFile && hits.length < rule.minPerFile) continue;
      if (!byRule.has(id)) byRule.set(id, []);
      byRule.get(id).push(...hits);
    }
  }

  if (opts.json) {
    console.log(JSON.stringify(Object.fromEntries(byRule), null, 2));
    return byRule.size ? 1 : 0;
  }
  let total = 0;
  for (const rule of active) {
    const hits = byRule.get(rule.id) ?? [];
    if (!hits.length) continue;
    total += hits.length;
    console.log(`\n${C.bold(rule.id)} ${C.dim(`${rule.scope} · ${hits.length}건`)} — ${rule.reason}`);
    for (const h of hits.slice(0, opts.all ? hits.length : 5)) {
      console.log(`  ${C.cyan(h.file.split("/").pop())}${C.dim(":" + h.line)} ${C.bold(h.key)}  ${h.text.slice(0, 76)}`);
    }
    if (!opts.all && hits.length > 5) console.log(`  ${C.dim(`… 외 ${hits.length - 5}건 (--all로 전부)`)}`);
  }
  console.log(`\n${total ? C.yellow(`${total}건`) : C.green("0건")} · 규칙 ${active.length}개 적용`);
  // A rule the project turned off has to be named. Silently short a sweep and the zero it
  // prints is indistinguishable from a zero that was earned.
  const off = rulePacks().disabled;
  if (off?.size) {
    console.log(C.dim(`끈 규칙 ${off.size}개 — .claude/l10n-rules.json의 disable`));
    for (const [id, why] of off) console.log(C.dim(`  ${id} — ${why}`));
  }
  return total ? 1 : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Suspect detection — what a rule cannot fix
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Smells that suggest a sentence reads as translated rather than written.
 *
 * None of these is a defect on its own, and none can be repaired by substitution: the
 * fix is to rewrite the sentence, which needs a reader. So this scores instead of
 * replacing, and `suspects` hands the ranked list to whoever does the rewriting.
 *
 * Each entry returns a count; the score is the weighted sum. `registers` limits
 * a smell to kinds of that voice — a screen reads differently from a design
 * document, and judging one by the other's smells only produces noise.
 */
const SMELLS = [
  {
    id: "metaphor-verb",
    weight: 3,
    why: "사물을 사람처럼 다루는 비유 동사 — 영어 원문의 은유를 그대로 옮긴 자리일 때가 많다",
    // Left boundaries matter as much here as in the rule pack: 품은 lives inside 제품은,
    // 서다 inside 위해서다, 문다 inside 물문다. Without them this smell fires on half
    // the corpus and the score stops meaning anything.
    test: (t) =>
      (t.match(
        /(?<![가-힣])(?:서다|섭니다|선다|돕니다|도는|품고|품은|들고 있|앉는다|눕는다|닿는다|닿지|씌운다|씌우는|떨어진다|떨어지는|던진다|집는다)/g,
      ) ?? []).length,
  },
  {
    id: "nominal-ending",
    weight: 2,
    why: "'~것' 종결 — 화면 문구에서는 어색하게 읽힌다. 설계 문서의 -다체에서는 정상이라 화면 문구에서만 센다",
    registers: ["screen"],
    test: (t) => (t.match(/(?:하는 것|되는 것|인 것|한 것|은 것|는 것)(?:이다|입니다|\.|$)/g) ?? []).length,
  },
  {
    id: "dash-pileup",
    weight: 2,
    why: "한 문장에 줄표가 둘 이상 — 영어의 삽입절을 그대로 옮기면 이렇게 된다",
    test: (t) => ((t.match(/—/g) ?? []).length >= 2 ? 1 : 0),
  },
  {
    id: "long-unbroken",
    weight: 2,
    why: "끊어 읽을 자리 없이 긴 문장 — 읽는 사람이 숨 쉴 곳을 찾지 못한다",
    // An em dash and a middle dot break a sentence as effectively as a comma does, and
    // Korean design prose uses both heavily. Counting a sentence that has them as
    // unbroken flagged well-formed design notes by the dozen.
    test: (t) =>
      t.length >= 70 && !/[,·—:;]/.test(t) && !/다\.\s/.test(t) ? 1 : 0,
  },
  {
    id: "same-ending-run",
    weight: 1,
    why: "같은 어미가 잇달아 반복 — 기계 번역이 남기는 자국",
    test: (t) => ((t.match(/(습니다|입니다)[^가-힣]*(습니다|입니다)[^가-힣]*(습니다|입니다)/g) ?? []).length ? 1 : 0),
  },
  {
    id: "heavy-nominalization",
    weight: 2,
    why: "명사화 과다(~함/~됨/~임) — 동사로 풀어 쓰면 읽기 쉬워진다",
    // `해제됨·폐기됨·취소됨` is a list of status labels, and a status label is a noun by
    // design. Strip those runs before counting, or every screen that lists its states
    // scores as heavily nominalized prose.
    test: (t) =>
      ((t.replace(/[가-힣]+(?:됨|함)(?:\s*·\s*[가-힣]+(?:됨|함))+/g, "") ?? "").match(
        /[가-힣](?:함|됨)(?=[\s.,·]|$)/g,
      ) ?? []).length,
  },
  {
    id: "passive-stack",
    weight: 2,
    why: "이중 피동 — 행위자를 주어로 세우면 대개 사라진다",
    // Only genuine double passives. `만들어지는`/`곤란해지는` are ordinary Korean, and
    // counting them made this smell fire on well-written sentences.
    test: (t) => (t.match(/(?:되어지|지게 되|되게 되)/g) ?? []).length,
  },
  {
    id: "colloquial",
    weight: 2,
    why: "구어체 — 업무 화면·문서의 문체와 어긋난다",
    // Each needs a left boundary: 막 lives inside 마지막, 좀 inside 조좀, 뭐 inside 뭐라도.
    test: (t) => (t.match(/(?<![가-힣])(?:그냥|좀 |뭐 |되게 |엄청 |잘 안 |막 )/g) ?? []).length,
  },
  {
    id: "spatial-metaphor",
    weight: 2,
    why: "공간 비유(층·자리·길·칸)를 추상 개념에 씀 — 영어 layer/slot/path의 직역일 때가 많다",
    test: (t) => (t.match(/(?:받는 층|위층|아래층|그 층|이 층|나가는 길|들어가는 길|다른 길|길을 두|자리가 없|자리를 두)/g) ?? []).length,
  },
  {
    id: "have-translation",
    weight: 3,
    why: "영어 have의 직역 — 「A는 B를 가지고 있다」보다 「A에는 B가 있다」가 한국어다",
    test: (t) => (t.match(/(?:가지고 있|갖고 있|를 가진다|을 가진다)/g) ?? []).length,
  },
  {
    id: "haedang-overuse",
    weight: 2,
    why: "「해당」 남용 — 기계 번역과 AI 문장의 대표 표지다. 대개 「그」로 충분하거나 빼도 뜻이 산다",
    test: (t) => (t.match(/해당\s*[가-힣]/g) ?? []).length,
  },
  {
    id: "it-pronoun",
    weight: 2,
    why: "영어 it의 직역 — 한국어는 대명사를 생략하거나 「이는·이것」으로 받는다",
    test: (t) => (t.match(/(?<![가-힣])그것[은이을를의]/g) ?? []).length,
  },
  {
    id: "one-of",
    weight: 2,
    why: "영어 one of·a의 직역 — 「~중 하나」와 「하나의 ~」는 대개 빼거나 풀어 쓴다",
    test: (t) => (t.match(/(?:중\s*하나|하나의\s*[가-힣])/g) ?? []).length,
  },
  {
    id: "about-through-by",
    weight: 2,
    why: "전치사 직역(about·through·by) — 목적격 조사 직결이나 행위자 주어로 바꾼다",
    test: (t) => (t.match(/(?:에 대한|에 대해|에 대하여|을 통해|를 통해|을 통하여|에 의해|에 의하여|에 있어서)/g) ?? []).length,
  },
  {
    id: "hedging-claim",
    weight: 2,
    why: "헤징 상투구 — 확인한 사실은 단언한다",
    test: (t) => (t.match(/(?:라고 할 수 있|라고 볼 수 있|할 수 있을 것입니다|일 수 있습니다만)/g) ?? []).length,
  },
  {
    id: "bare-subject-drop",
    weight: 1,
    why: "'~는다/~ㄴ다' 서술이 화면·독자용 문구에 섞임 — 그 자리는 '~합니다'로 쓴다. 설계 문서와 보드는 -다체가 정상이라 세지 않는다",
    registers: ["screen", "manual"],
    test: (t) => ((/(?:한다|된다|본다|쓴다|넣는다|만든다)$/.test(t.trim()) ? 1 : 0)),
  },
];

function scoreSuspect(text, register) {
  const hits = [];
  let score = 0;
  for (const s of SMELLS) {
    if (s.registers && !s.registers.includes(register ?? "plain")) continue;
    const n = s.test(text);
    if (!n) continue;
    score += n * s.weight;
    hits.push(s.id);
  }
  return { score, hits };
}

/**
 * Rank the sentences most likely to read as translated, so a reader can rewrite them.
 *
 * Output is deliberately machine-readable (`--json`): the intended loop is
 * `suspects --json` → rewrite → `apply --patch`, which keeps the rewriting where
 * judgement is and the editing where precision is.
 */
function cmdSuspects(opts) {
  // 3 is where the signal starts. At 2 the list fills with correct Korean — status
  // labels (저장됨), settled idioms (막다른 길 · 나가는 길), and -다체 design prose — so a
  // lower threshold trains its reader to skim past the findings that matter.
  const min = Number(opts.min ?? 3);
  const entries = discover(opts);
  const found = [];
  for (const entry of entries) {
    const { src, segments } = readSegments(entry);
    for (const seg of segments) {
      if (!HANGUL.test(seg.text)) continue;
      if (seg.text.length < 12) continue;
      // A status label is a noun phrase by design — `해제됨 · 라이선스 반환됨` is correct
      // Korean for a badge and wrong as a sentence, so judging it by sentence smells
      // only produces noise. Same for a markdown table row, which is a grid of cells.
      if (seg.text.trim().startsWith("|")) continue;
      if (!/[.!?]|습니다|입니다|한다|이다|된다/.test(seg.text) && seg.text.length < 40) continue;
      const { score, hits } = scoreSuspect(seg.text, CONFIG.kinds[entry.kind]?.register);
      if (score < min) continue;
      found.push({
        file: entry.file,
        kind: entry.kind,
        key: seg.key,
        line: src.slice(0, seg.start).split("\n").length,
        score,
        smells: hits,
        text: seg.text,
      });
    }
  }
  found.sort((a, b) => b.score - a.score);
  const shown = opts.all ? found : found.slice(0, Number(opts.limit ?? 40));

  /**
   * The rewriting instruction travels with the findings.
   *
   * `suspects` is read by whoever rewrites — often an agent that sees only this output.
   * A smell name is a hint, not a verdict: the tool cannot know what the sentence is
   * supposed to say, and guessing at domain vocabulary is how a plausible-but-wrong
   * phrase gets committed. So the instruction to go and check is part of the result.
   */
  const domain = CONFIG.domainHint ? `이 도메인(${CONFIG.domainHint})` : "이 도메인";
  const guidance = [
    "이 목록은 '문체가 어색할 수 있다'는 신호일 뿐 판정이 아니다. 문장마다 아래를 따른다.",
    "1. 원문이 무엇을 말하려 했는지 먼저 파악한다 — 뜻을 바꾸지 않는다.",
    "2. 자연스러운 한국어로 다시 쓴다. 어휘만 바꾸지 말고 문장 구조를 바꾼다.",
    `3. ${domain}에서 그 표현이 실제로 쓰이는지 확신이 서지 않으면`,
    "   반드시 인터넷에서 신뢰할 수 있는 출처(그 업계 사업자의 공식 문서, 표준 문서,",
    "   업계 매뉴얼)를 찾아 실제 예문을 확인한 뒤 정한다. 짐작으로 용어를 만들지 않는다.",
    "4. 정한 표현이 되풀이될 만하면 용어사전(.claude/GLOSSARY.md)에, 문장 패턴이면",
    "   .claude/l10n-rules.json에 hit/miss 예문과 함께 올린다.",
    "5. 다시 쓴 결과는 [{file, key, from, to}] 형태로 모아 `apply --patch`로 되돌려 넣는다.",
  ];

  if (opts.json) {
    console.log(JSON.stringify({ guidance, count: found.length, suspects: shown }, null, 2));
    return 0;
  }
  for (const f of shown) {
    console.log(
      `\n${C.yellow(String(f.score).padStart(2))} ${C.cyan(f.file.split("/").pop())}${C.dim(":" + f.line)} ${C.bold(f.key)} ${C.dim(f.smells.join(" · "))}`,
    );
    console.log(`   ${f.text.slice(0, 160)}`);
  }
  console.log(`\n${found.length}건 의심 (${shown.length}건 표시) · 점수 ${min} 이상\n`);
  console.log(C.bold("다시 쓰는 사람에게"));
  for (const line of guidance) console.log(`  ${line}`);
  return 0;
}

/**
 * Apply a rewrite list produced by a reader.
 *
 * Patch shape: `[{ file, key, from, to }]`. `from` must still match exactly, so a patch
 * written against stale text is refused rather than applied to the wrong span.
 */
function cmdApply(opts) {
  const patch = JSON.parse(readFileSync(opts.patch, "utf8"));
  const byFile = new Map();
  for (const p of patch) {
    if (!byFile.has(p.file)) byFile.set(p.file, []);
    byFile.get(p.file).push(p);
  }
  let applied = 0;
  let refused = 0;
  for (const [file, items] of byFile) {
    const full = join(ROOT, file);
    if (!existsSync(full)) {
      console.log(`${C.red("✖ 없는 파일")} ${file}`);
      refused += items.length;
      continue;
    }
    // Read inside the same step that writes so a concurrent edit is not reverted.
    const entry = { file, format: formatOf(guessKind(file), file) };
    const src = readFileSync(full, "utf8");
    const segments = EXTRACTORS[entry.format](src);
    const edits = [];
    for (const item of items) {
      const seg = segments.find((s) => s.text === item.from && (!item.key || s.key === item.key));
      if (!seg) {
        console.log(`${C.red("✖ 원문 불일치")} ${file} ${C.dim(item.key ?? "")} ${item.from.slice(0, 48)}`);
        refused += 1;
        continue;
      }
      if (!placeholdersIntact(item.from, item.to)) {
        console.log(`${C.red("✖ 자리표시자 손상")} ${file} ${item.key ?? ""}`);
        refused += 1;
        continue;
      }
      edits.push({ seg, next: item.to });
    }
    if (!edits.length) continue;
    let out = src;
    for (const { seg, next } of [...edits].sort((a, b) => b.seg.start - a.seg.start)) {
      out = out.slice(0, seg.start) + next + out.slice(seg.end);
    }
    if (opts.write) {
      if (ROOT_OVERRIDE) throw new Error("--root로 연 저장소에는 쓰지 않는다. 읽기 전용으로만 쓴다");
      writeFileSync(full, out, "utf8");
    }
    applied += edits.length;
    console.log(`${C.green("✔")} ${C.cyan(file)} ${C.dim(`${edits.length}건`)}`);
  }
  console.log(
    `\n${applied}건 ${opts.write ? C.green("적용함") : C.yellow("미리보기 (--write로 적용)")}` +
      (refused ? ` · ${C.red(`${refused}건 거절`)}` : ""),
  );
  return refused ? 1 : 0;
}

/** The kind whose patterns could have produced this file, or null — format falls back to the extension. */
function guessKind(file) {
  for (const [k, spec] of Object.entries(CONFIG.kinds)) {
    if ((spec.exclude ?? []).some((p) => file.startsWith(p))) continue;
    const roots = spec.patterns.map((p) => p.split("*")[0]);
    if (roots.some((r) => file.startsWith(r))) return k;
  }
  return null;
}

function cmdAudit(opts) {
  const bans = glossaryBans();
  const findings = { untranslated: [], banned: [], bannedWarn: [], particles: [], missingPair: [] };

  const koEntries = discover({ ...opts, lang: "ko" });
  for (const entry of koEntries) {
    const { src, segments } = readSegments(entry);
    const isScreen = CONFIG.kinds[entry.kind]?.register === "screen";
    // Level and per-file threshold semantics carry over from the glossary: a
    // 경고(N+) rule only reports when the file crosses N hits.
    const perRule = new Map();
    for (const seg of segments) {
      const line = () => src.slice(0, seg.start).split("\n").length;
      // Markdown has no untranslated concept: a Korean document legitimately carries
      // English identifiers, table cells, link text and code, and every one of them
      // reads as a missing translation. Reporting them buries the findings that matter
      // — 132 such hits once drowned the real ones in `_plans`.
      const skipUntranslated =
        CONFIG.kinds[entry.kind]?.format === "markdown" ||
        (CONFIG.untranslatedExclude ?? []).some((p) => entry.file === p || entry.file.startsWith(p));
      if (!skipUntranslated && looksUntranslated(seg.text)) {
        findings.untranslated.push({ file: entry.file, key: seg.key, text: seg.text, line: line() });
      }
      for (const p of particleErrors(seg.text)) {
        findings.particles.push({ file: entry.file, key: seg.key, text: seg.text, ...p, line: line() });
      }
      for (const ban of bans) {
        if (ban.screenOnly && (!isScreen || seg.annotation)) continue;
        ban.re.lastIndex = 0;
        if (ban.re.test(seg.text)) {
          if (!perRule.has(ban.term)) perRule.set(ban.term, []);
          perRule.get(ban.term).push({
            file: entry.file,
            key: seg.key,
            text: seg.text,
            term: ban.term,
            correct: ban.correct,
            level: ban.level,
            threshold: ban.threshold,
            line: line(),
          });
        }
      }
    }
    for (const hits of perRule.values()) {
      if (hits.length < hits[0].threshold) continue;
      const bucket = hits[0].level === "error" ? findings.banned : findings.bannedWarn;
      bucket.push(...hits);
    }
  }

  // A Korean catalogue with no counterpart in another language is a gap the reader of
  // that language hits as a raw key on screen. Only the languages a kind actually ships
  // are compared — a board may be Korean-only and a manual a two-language pair, so
  // checking those against the full language list reports gaps that do not exist.
  for (const kind of opts.kind ? [opts.kind] : Object.keys(CONFIG.kinds).filter((k) => !CONFIG.kinds[k].optIn)) {
    const spec = CONFIG.kinds[kind];
    const langs = spec.languages ?? CONFIG.languages;
    if (langs.length < 2) continue;

    /** Reduce a path to a language-independent stem so counterparts line up. */
    const stemOf = (file, lang) => {
      if (spec.baseLanguage === lang) {
        // A base bundle has no suffix at all; give it the one its siblings carry.
        return file.replace(/(\.[^.]+)$/, `_{lang}$1`);
      }
      return file
        .replaceAll(`/${lang}/`, "/{lang}/")
        .replace(new RegExp(`/${lang}(\\.[^.]+)$`), "/{lang}$1")
        .replace(new RegExp(`_${lang}(\\.[^.]+)$`), "_{lang}$1");
    };

    const byLang = {};
    for (const lang of langs) {
      byLang[lang] = new Set(discover({ kind, lang }).map((e) => stemOf(e.file, lang)));
    }
    for (const stem of byLang[CONFIG.defaultLanguage] ?? []) {
      for (const lang of langs) {
        if (lang === CONFIG.defaultLanguage) continue;
        if (!byLang[lang].has(stem)) findings.missingPair.push({ kind, stem, lang });
      }
    }
  }

  if (opts.json) {
    console.log(JSON.stringify(findings, null, 2));
    return findings.untranslated.length || findings.banned.length || findings.particles.length ? 1 : 0;
  }

  const section = (title, rows, render) => {
    if (!rows.length) return;
    console.log(`\n${C.bold(title)} ${C.dim(`${rows.length}건`)}`);
    let file = null;
    for (const row of rows) {
      if (row.file && row.file !== file) {
        file = row.file;
        console.log(`  ${C.cyan(file)}`);
      }
      console.log(render(row));
    }
  };

  section(`✖ 번역 누락 (한국어 값에 한글이 없음)`, findings.untranslated, (r) =>
    `    ${C.dim(`${r.line}:`)} ${C.bold(r.key)}  ${C.red(r.text)}`,
  );
  section(`✖ 용어사전 금지 표기`, findings.banned, (r) =>
    `    ${C.dim(`${r.line}:`)} ${C.bold(r.key)}  ${C.red(r.term)} → ${C.green(r.correct)}  ${C.dim(r.text)}`,
  );
  section(`✖ 조사 어긋남`, findings.particles, (r) =>
    `    ${C.dim(`${r.line}:`)} ${C.bold(r.key)}  ${C.red(r.wrong)} → ${C.green(r.correct)}  ${C.dim(r.text.slice(0, 60))}`,
  );
  section(`⚠ 용어사전 경고 표기`, findings.bannedWarn, (r) =>
    `    ${C.dim(`${r.line}:`)} ${C.bold(r.key)}  ${C.yellow(r.term)} → ${C.green(r.correct)}  ${C.dim(r.text.slice(0, 60))}`,
  );
  section(`⚠ 짝 언어 파일 없음`, findings.missingPair, (r) => `    ${r.stem} ${C.dim(`(${r.lang} 없음)`)}`);

  const errors = findings.untranslated.length + findings.banned.length + findings.particles.length;
  console.log(
    `\n${errors ? C.red(`오류 ${errors}건`) : C.green("오류 0건")} · 경고 ${findings.bannedWarn.length + findings.missingPair.length}건`,
  );
  return errors ? 1 : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Document audit (the same engine the hook runs)
// ─────────────────────────────────────────────────────────────────────────────

function cmdCheck(rest) {
  const args = { all: false, strict: false, untranslated: false, noBase: false, listRules: false, init: false, initL10n: false, glossary: null, paths: [] };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--all") args.all = true;
    else if (a === "--strict") args.strict = true;
    else if (a === "--untranslated") args.untranslated = true;
    else if (a === "--no-base") args.noBase = true;
    else if (a === "--list-rules") args.listRules = true;
    else if (a === "--init") args.init = true;
    else if (a === "--init-l10n") args.initL10n = true;
    else if (a === "--glossary") {
      args.glossary = rest[++i];
      if (!args.glossary) throw new Error("--glossary 뒤에 경로가 필요합니다");
    } else if (a.startsWith("--")) throw new Error(`알 수 없는 플래그: ${a}`);
    else args.paths.push(a);
  }
  const cliHint = `${SCRIPT_PATH} check`;
  if (args.init) {
    initGlossary(cliHint);
    return process.exitCode ?? 0;
  }
  if (args.initL10n) {
    initL10n(cliHint);
    return process.exitCode ?? 0;
  }
  return runDocAudit(args, cliHint);
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

const USAGE = `
${C.bold("l10n.mjs")} — 프로젝트의 한국어를 문서와 자원 가리지 않고 한 규칙으로 검사한다

  ${C.bold("check")}    [경로...] [--all] [--strict]              문서를 감사한다 (훅과 같은 엔진·판정)
           [--untranslated] [--list-rules] [--init]
  ${C.bold("list")}     [--kind K] [--lang L] [--json]           자원 파일을 열거한다
  ${C.bold("stats")}    [--json]                                 부류·언어별 문구 수를 센다
  ${C.bold("grep")}     <패턴> [--regex] [--kind K] [--lang L]   문구 값에서 찾는다
  ${C.bold("audit")}    [--kind K] [--json]                      자원의 번역 누락·금지 표기·짝 언어를 검사한다
  ${C.bold("rules")}    --test [--verbose]                       규칙 팩이 제 예문을 통과하는지 검증한다
  ${C.bold("rules")}    [--scope S] [--all] [--kind K] [--json]  규칙 팩으로 훑는다 (고치지 않는다)
  ${C.bold("suspects")} [--min N] [--limit N] [--kind K] [--json] 문체가 어색한 문장을 점수순으로 뽑는다
  ${C.bold("apply")}    --patch <파일> [--write]                  다시 쓴 문장 목록을 적용한다

${C.bold("규칙 원천은 하나다.")} 용어사전(스킬의 GLOSSARY.base.md + 프로젝트의 .claude/GLOSSARY.md)이
check와 audit 양쪽의 금지 표기를 대고, 문장 패턴 규칙 팩(스킬의 RULES.base.json + 프로젝트의
.claude/l10n-rules.json)이 rules 훑기를 댄다. 용어사전에 등재하면 문서와 화면 문구가 함께 걸린다.

${C.bold("이 도구는 찾기만 한다.")} 고치는 것은 문맥을 읽는 쪽의 일이다 — 규칙은 낱말이 어디 있는지
알지만 그 자리에서 무엇을 가리키는지는 모른다. 같은 「허용 수량」이 한 줄에서는 계약이 파는 수량이고
다른 줄에서는 한도 항목의 상한이며, 두 규칙이 각자 옳게 걸린 한 문장이 「라이선스 수량 라이선스
하나가」로 끝나기도 한다. 어느 것도 정규식이 가릴 수 없다.

  1. ${C.bold("rules --test")}      규칙이 오탐을 내지 않는지 먼저 확인한다
  2. ${C.bold("check")} · ${C.bold("audit")}    고칠 자리를 뽑는다 — 도구가 하는 일은 여기까지다
  3. ${C.bold("rules")} · ${C.bold("suspects --json")}   번역투·어색한 문장을 함께 뽑는다
  4. ${C.bold("문맥을 보고 다시 쓴다")} — 낱말만 갈아 끼우면 문장이 조용히 뜻을 잃는다
  5. ${C.bold("apply --patch")}     다시 쓴 결과를 되돌려 넣는다 (원문이 어긋나면 거절한다)
  6. ${C.bold("check")} · ${C.bold("audit")} · ${C.bold("suspects")} 다시 훑는다 — 고친 것이 새 어색함을 만들지 않았는지 본다

${C.bold("apply 옵션")}
  --write        실제로 파일에 쓴다 (없으면 미리보기)
  --kind K       한 부류만

${C.dim("apply 는 (파일, 키)로 자리를 찾는다. 키가 유일한 부류 — i18n JSON · properties · 마크다운(줄 번호) —")}
${C.dim("에서만 쓸 수 있고, 키가 태그 이름(td · strong · text)이라 한 파일에 여럿인 형식(HTML · 보드)은")}
${C.dim("거절된다. 그쪽은 audit 이 준 줄 번호로 자리를 좁혀 고친다.")}

${C.dim("자원 부류는 프로젝트의 .claude/l10n.json이 선언한다. 키·태그·자리표시자·코드는 건드리지")}
${C.dim("않는다. 값만 다룬다. --root <dir> 는 다른 프로젝트를 읽기 전용으로 검사한다.")}
`;

function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--write") opts.write = true;
    else if (a === "--regex") opts.regex = true;
    else if (a === "--json") opts.json = true;
    else if (a === "--test") opts.test = true;
    else if (a === "--all") opts.all = true;
    else if (a === "--verbose") opts.verbose = true;
    else if (a === "--scope") opts.scope = argv[++i];
    else if (a.startsWith("--scope=")) opts.scope = a.slice(8);
    else if (a === "--root") opts.root = argv[++i];
    else if (a.startsWith("--root=")) opts.root = a.slice(7);
    else if (a === "--kind") opts.kind = argv[++i];
    else if (a === "--lang") opts.lang = argv[++i];
    else if (a === "--patch") opts.patch = argv[++i];
    else if (a.startsWith("--patch=")) opts.patch = a.slice(8);
    else if (a === "--min") opts.min = argv[++i];
    else if (a.startsWith("--min=")) opts.min = a.slice(6);
    else if (a === "--limit") opts.limit = argv[++i];
    else if (a.startsWith("--limit=")) opts.limit = a.slice(8);
    else if (a.startsWith("--kind=")) opts.kind = a.slice(7);
    else if (a.startsWith("--lang=")) opts.lang = a.slice(7);
    else opts._.push(a);
  }
  return opts;
}

function main() {
  const argv = process.argv.slice(2);
  // `check` owns its own flag set (the document audit's), so it is routed on the
  // raw argv before the resource-side parser sees the flags. Its exit codes match
  // check-glossary.mjs: 0 clean, 1 violations, 2 usage or glossary-format failure.
  if (argv[0] === "check") {
    try {
      return cmdCheck(argv.slice(1));
    } catch (err) {
      console.error(String(err.message || err));
      return 2;
    }
  }
  const opts = parseArgs(argv);
  const [command, ...rest] = opts._;
  try {
    switch (command) {
      case "list":
        return cmdList(opts);
      case "stats":
        return cmdStats(opts);
      case "grep":
        if (!rest[0]) throw new Error("검색할 패턴을 적어야 한다");
        return cmdGrep(rest[0], opts);
      // Refuse loudly rather than fall through to the usage text: an agent that reaches
      // for a sweep needs to read why it is not here, not to guess the flag was renamed.
      case "replace":
        throw new Error(
          "치환 명령은 없다 — 규칙은 자리를 찾을 뿐이고 고치는 것은 문맥을 읽는 쪽이 한다.\n" +
            "  rules · audit으로 자리를 뽑고, 문장을 다시 써서 apply --patch로 되돌려 넣는다.",
        );
      case "audit":
        return cmdAudit(opts);
      case "rules":
        if (opts.test) return cmdRulesTest(opts);
        return cmdRulesScan(opts);
      case "suspects":
        return cmdSuspects(opts);
      case "apply":
        if (!opts.patch) throw new Error("--patch <파일>로 수정안 목록을 지정해야 한다");
        return cmdApply(opts);
      default:
        console.log(USAGE);
        // Asking for help is not a failed run; only an unknown command is.
        return command && !["--help", "-h", "help"].includes(command) ? 1 : 0;
    }
  } catch (err) {
    console.error(C.red(`✖ ${err.message}`));
    return 1;
  }
}

process.exit(main());
