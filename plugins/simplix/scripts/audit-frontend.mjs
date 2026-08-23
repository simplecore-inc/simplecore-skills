#!/usr/bin/env node
/**
 * Frontend convention audit — machine-checkable subset of the `simplix:frontend`
 * skill's invariants and audit checklist (its references/audit/).
 *
 * Run from the frontend project root, or point at it with --root=<dir>.
 *
 * Usage:
 *   node "${CLAUDE_PLUGIN_ROOT}/scripts/audit-frontend.mjs"             # run all rules
 *   node "${CLAUDE_PLUGIN_ROOT}/scripts/audit-frontend.mjs" --errors-only
 *   node "${CLAUDE_PLUGIN_ROOT}/scripts/audit-frontend.mjs" --rule=raw-layout-div,filterbar-maxbadges
 *   node "${CLAUDE_PLUGIN_ROOT}/scripts/audit-frontend.mjs" --list      # list rules
 *   node "${CLAUDE_PLUGIN_ROOT}/scripts/audit-frontend.mjs" --selftest  # prove every rule both ways
 *
 * An unrecognised flag stops the run. A misspelt `--selftest` that fell through to a scan
 * reported `0 files scanned, 0 findings`, which is what a clean tree reports — the one output an
 * audit must never produce for a reason other than cleanliness.
 *
 * Exit code 1 when any error-level rule has hits. "review"-level rules print
 * candidates that need human judgment and never fail the run.
 *
 * **--selftest is the half that keeps this file honest.** Every rule carries a `broken` sample
 * and a `fixed` sample, and the selftest asserts the rule fires on the first and stays silent on
 * the second. A rule proved in one direction has not been proved: a check that can never fire is
 * indistinguishable from a clean tree, and a clean tree is what a green run invites you to read.
 * Where the invariant states an exception, or the pattern has a legitimate near-neighbour, the
 * rule also carries `miss` samples — a rule that fires on its own exception is worse than no
 * rule, because the first reader to meet one learns that this audit cries wolf. Add no rule
 * without both directions; the selftest fails on a rule that omits either.
 *
 * Rules that need judgment (persona fit, precedent parity, lifecycle reachability)
 * stay in the audit checklist document — do not port them here.
 *
 * **This audit reads source files and never opens a browser.** A rule about what a page looks
 * like once it is painted — a list total stating N rows over a column that draws none, two
 * pieces of text in one rectangle — cannot be written here, however tempting the file's name
 * makes it: it would either need a runtime this script does not have, or it would answer from
 * the source and pass on every broken screen. Those rules live in `audit-rendered.mjs` beside
 * this file, which requires a browser and exits non-zero when it cannot reach one.
 *
 * Scope: a project that CONSUMES simplix-react. Most rules say "reach for the framework
 * rather than hand-rolling it" (use Flex/Stack/Grid, use the shared component, use the
 * derived hook), so pointing this at the framework's own repository reports its
 * implementations as violations — the package that defines Flex cannot import it. A large
 * hit count from such a run means the wrong repository, not a broken framework.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Project root: --root=<dir> wins, else the current working directory. The script
// ships inside a plugin, so it must never resolve the root from its own location.
//
// Reassignable because the self-test points the whole audit at a fixture tree it writes and
// throws away — a rule that reads a sibling file, a generated model or a locale catalogue can
// only be proved against a tree, and a rule proved against a hand-made stub of its own reader
// is proving the stub.
let ROOT = path.resolve(
  process.argv.find((a) => a.startsWith("--root="))?.slice("--root=".length) ?? process.cwd(),
);
// `packages` belongs here as much as the other two: a simplix-react project is package-first, and
// the conventions actively push shared UI out of `modules`/`apps` and into a package. Leaving it out
// made the audit blindest exactly where the rules send code — and blind to the framework's own
// packages when pointed at one. Codegen output is already excluded by name below, so widening the
// roots does not drag `src/generated` in.
const SRC_ROOTS = ["modules", "apps", "packages"];
const EXCLUDE_DIRS = new Set(["node_modules", "dist", "generated", ".turbo", "build"]);

// ---------------------------------------------------------------------------
// File collection
// ---------------------------------------------------------------------------

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (EXCLUDE_DIRS.has(e.name)) continue;
      walk(path.join(dir, e.name), out);
    } else if (/\.(tsx|ts)$/.test(e.name) && !/\.d\.ts$|\.gen\.ts$/.test(e.name)) {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

function collectSources() {
  const files = [];
  for (const root of SRC_ROOTS) walk(path.join(ROOT, root), files);
  return files.filter((f) => f.includes(`${path.sep}src${path.sep}`));
}

function lineOfIndex(content, index) {
  return content.slice(0, index).split("\n").length;
}

function lineHits(content, re, filter) {
  const hits = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i]) && (!filter || filter(lines[i], lines, i))) {
      hits.push({ line: i + 1, excerpt: lines[i].trim().slice(0, 140) });
    }
  }
  return hits;
}

/**
 * A `lineHits` filter that drops lines which are only a comment.
 *
 * Pass it to rules whose pattern is a piece of code that documentation about that code will also
 * contain — an anti-pattern named in a TSDoc block, a defect explained in the comment above the
 * fix. Without it those rules fire hardest on the files that took the trouble to explain
 * themselves, and the explanation is the thing that gets deleted to silence the audit.
 *
 * Not applied inside `lineHits` itself: one rule here is ABOUT comments (a `//` line between a
 * JSX tag and its children paints on screen), and filtering globally would blind it.
 *
 * <p><b>A block comment is tracked across the file, not guessed from the line.</b> Reading only
 * the line start misses the continuation of a wrapped block whose next line does not begin with
 * `*` — a JSX comment explaining a prop, which is exactly where an explained anti-pattern is
 * written out in full. `lineHits` hands the filter the whole file and the index, so the state is
 * available; scanning from the top is cheap beside reading the file at all.
 *
 * @param line the line under test
 * @param lines every line of the file, when the caller has them
 * @param i the index of `line` within `lines`
 * @returns false when the line is only a comment, or sits inside a block comment
 */
function notCommentLine(line, lines, i) {
  if (/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line)) return false;
  if (!lines || i == null) return true;
  // Walk from the top counting block-comment openers against closers. A line inside an open
  // block is comment whatever it starts with.
  let open = false;
  for (let n = 0; n < i; n++) {
    const text = lines[n];
    for (let k = 0; k < text.length - 1; k++) {
      if (!open && text[k] === "/" && text[k + 1] === "*") { open = true; k++; }
      else if (open && text[k] === "*" && text[k + 1] === "/") { open = false; k++; }
    }
  }
  return !open;
}

function blockHits(content, re) {
  const hits = [];
  for (const m of content.matchAll(re)) {
    hits.push({ line: lineOfIndex(content, m.index), excerpt: m[0].replace(/\s+/g, " ").slice(0, 140) });
  }
  return hits;
}

// ---------------------------------------------------------------------------
// JSX shape — a tag scanner for rules that must ask what an element CONTAINS
// ---------------------------------------------------------------------------

/**
 * The whole JSX open tag beginning at `start`, up to and including its `>`.
 *
 * <p>A regex cannot find that `>`: attribute values carry them routinely — inside a string
 * (`className="[&>svg]:h-4"`), inside an arrow body (`onClick={() => setOpen(true)}`), and inside a
 * whole element passed as a prop (`trigger={<button>…</button>}`). The scan therefore tracks quote
 * state and brace depth and accepts only a `>` that sits outside both.
 *
 * @param content the file source
 * @param start   index of the `<`
 * @returns the tag text and the index of its closing `>`
 */
function jsxOpenTag(content, start) {
  let i = start + 1;
  let depth = 0;
  let quote = null;
  while (i < content.length) {
    const ch = content[i];
    if (quote) {
      if (ch === quote && content[i - 1] !== "\\") quote = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      i++;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    else if (depth === 0 && ch === ">") break;
    i++;
  }
  return { tag: content.slice(start, i + 1), end: i };
}

/**
 * The children of the element named `name` whose open tag ends at `openEnd`, found by matching
 * close tags while counting same-named elements nested inside.
 *
 * @returns the child source, or null when no matching close tag exists in the file
 */
function jsxChildren(content, name, openEnd) {
  const escaped = name.replace(/\./g, "\\.");
  const openRe = new RegExp(`<${escaped}[\\s>/]`, "g");
  const closeRe = new RegExp(`</${escaped}\\s*>`, "g");
  let level = 1;
  let cursor = openEnd + 1;
  let guard = 0;
  while (level > 0 && guard++ < 5000) {
    openRe.lastIndex = cursor;
    closeRe.lastIndex = cursor;
    const open = openRe.exec(content);
    const close = closeRe.exec(content);
    if (!close) return null;
    if (open && open.index < close.index) {
      if (!/\/>$/.test(jsxOpenTag(content, open.index).tag)) level++;
      cursor = open.index + 1;
      continue;
    }
    level--;
    if (level === 0) return content.slice(openEnd + 1, close.index);
    cursor = close.index + close[0].length;
  }
  return null;
}

/**
 * The attribute region of an open tag: everything before the first element embedded in a prop.
 *
 * <p>`<Popover trigger={<button aria-label="x" />}>` carries an `aria-label` that belongs to the
 * trigger, not to the Popover. Asking about the Popover's own attributes means stopping at the
 * embedded element — and only at an element: `disabled={page <= 1}` has a `<` that opens nothing,
 * and cutting there would hide every attribute written after it.
 */
function tagAttrs(tag) {
  const nested = /<[A-Za-z/]/.exec(tag.slice(1));
  return nested ? tag.slice(0, nested.index + 1) : tag;
}

/** Component names that render a mark rather than words. */
const MARK_COMPONENT = /(?:Icon|Mark|Glyph|Spinner|Loader|Chevron|Caret|Arrow|Grip|Cross|Symbol)$/;

/**
 * What a control's children give a screen reader to announce.
 *
 * @returns `"empty"` when there are no children at all, `"marks"` when every child is a bare mark
 *          (an `<svg>` or an icon component), `"label"` when the children carry hidden label text,
 *          and null when they carry anything else — text, a slot, a nested element with content
 */
function childContent(children) {
  if (/\bsr-only\b|VisuallyHidden|ScreenReaderOnly/.test(children)) return "label";
  const source = children.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  if (source.trim() === "") return "empty";
  let marks = 0;
  let rest = "";
  let i = 0;
  while (i < source.length) {
    if (source[i] !== "<") {
      rest += source[i];
      i++;
      continue;
    }
    const name = /^<\s*([A-Za-z][\w.]*)/.exec(source.slice(i, i + 60))?.[1];
    if (!name) {
      rest += source[i];
      i++;
      continue;
    }
    const { tag, end } = jsxOpenTag(source, i);
    const isMark = name === "svg" || MARK_COMPONENT.test(name);
    if (/\/>$/.test(tag)) {
      if (isMark) marks++;
      else rest += "x";
      i = end + 1;
      continue;
    }
    const inner = jsxChildren(source, name, end);
    if (inner === null) return null;
    if (isMark) marks++;
    else rest += "x";
    const closeTag = source.indexOf(">", end + 1 + inner.length);
    i = closeTag < 0 ? source.length : closeTag + 1;
  }
  if (rest.trim() !== "") return null;
  return marks > 0 ? "marks" : "empty";
}

/**
 * The card slots of a `CrudList.Table` — everything a reader sees when the table falls back to
 * cards, which is the whole row for them.
 *
 * @param content the widget source
 * @returns the `cardTitle`/`cardContent` region, or an empty string when the table declares neither
 */
function cardSlots(content) {
  const start = content.search(/card(?:Title|Content)=\{/);
  if (start < 0) {
    return "";
  }
  const columns = content.indexOf("<CrudList.Column", start);
  return content.slice(start, columns < 0 ? content.length : columns);
}

/**
 * Each `CrudList.Column` block, with the field it is declared over.
 *
 * @param content the widget source
 * @returns one entry per column, in source order
 */
function columnBlocks(content) {
  const blocks = [];
  for (const m of content.matchAll(/<CrudList\.Column\b[\s\S]*?<\/CrudList\.Column>/g)) {
    const field = /\bfield="(\w+)"/.exec(m[0])?.[1];
    if (field) {
      blocks.push({ field, source: m[0], line: lineOfIndex(content, m.index) });
    }
  }
  return blocks;
}

// ---------------------------------------------------------------------------
// Rules — { id, invariant, level: "error"|"review", desc, appliesTo(relPath), check(content, relPath) }
// ---------------------------------------------------------------------------

const inModules = (p) => p.startsWith("modules/");
const inApps = (p) => p.startsWith("apps/");
const inPackages = (p) => p.startsWith("packages/");
const inPages = (p) => /\/src\/pages\//.test(p);
const isListWidget = (p) => /\/widgets\/.*list.*\.tsx$|\/widgets\/[^/]+\/list\.tsx$/.test(p);
const isTsx = (p) => p.endsWith(".tsx");
const isSource = (p) => p.endsWith(".ts") || p.endsWith(".tsx");

/**
 * Identifiers that end in `Id` and name something OUTSIDE this system.
 *
 * <p>Every rule that objects to a hand-typed id is objecting to a reference into this system's own
 * tables — the user cannot know a UUID, so typing one is a guess and the picker exists to prevent
 * it. An identifier issued somewhere else inverts that: the operator reads `clientId` off the
 * identity provider's console and `machineId` off the licence, this system holds no set for a
 * picker to list, and a text box is the only control that can exist. Excluded by name because the
 * vocabulary is small and stable — OAuth/OIDC registration, tenancy, licensing — where the internal
 * side grows an entity at a time.
 */
const FOREIGN_ID_NAMES =
  /\b(?:client|tenant|machine|application|external|vendor|device|correlation|request|trace|session|installation)Id\b/;

/**
 * Whether anything in this file could be holding a value the server sent.
 *
 * <p>Several rules here key on a variable NAME — `row`, `values`, `displayData` — as their evidence
 * that a value came off a DTO, because a regex cannot follow where a binding came from. That
 * heuristic is right in a widget and wrong in a file with no server data in it at all: a static
 * reference table rendered as rows binds `row` too, and its `row.type` is a string literal the
 * author wrote three lines above.
 *
 * <p>A generated DTO can only reach a file through a domain package, an Orval adapter, or the boot
 * envelope readers — so a file that names none of the three has no boot enum to mishandle, whatever
 * it calls its variables. Checked on the import surface rather than on the call site, which is the
 * part a rename cannot quietly move.
 *
 * @param content the file's source
 * @returns whether a server-sent value can be in scope anywhere in it
 */
function readsServerData(content) {
  return (
    /\bfrom\s+["'][^"']*\/?domain-[^"']*["']/.test(content) ||
    /\badaptOrval\w*\s*\(/.test(content) ||
    /\bboot(?:Body|Page)\s*[<(]/.test(content)
  );
}

/**
 * Property names of each generated DTO, keyed by its model file stem (e.g. `operatorScopeDetailDTO`).
 *
 * <p>Built on first use and kept, because the rule below asks about one entity per widget file and
 * the whole model directory is read either way.
 */
let generatedModelIndex = null;

function modelIndex() {
  if (generatedModelIndex) return generatedModelIndex;
  generatedModelIndex = new Map();
  const packagesDir = path.join(ROOT, "packages");
  if (!fs.existsSync(packagesDir)) return generatedModelIndex;
  for (const pkg of fs.readdirSync(packagesDir)) {
    const modelDir = path.join(packagesDir, pkg, "src/generated/model");
    if (!fs.existsSync(modelDir)) continue;
    for (const file of fs.readdirSync(modelDir)) {
      if (!file.endsWith(".ts")) continue;
      const src = fs.readFileSync(path.join(modelDir, file), "utf8");
      const props = new Set();
      for (const m of src.matchAll(/^ {2}(\w+)\??:/gm)) props.add(m[1]);
      generatedModelIndex.set(file.replace(/\.ts$/, ""), props);
    }
  }
  return generatedModelIndex;
}

/**
 * @param relPath a widget file, whose directory names the entity the scaffold generated it for
 * @returns every property the entity's detail and list projections carry, or null when neither
 *          model is present — an unknown contract is not evidence of a defect
 */
function projectionProps(relPath) {
  const dir = path.basename(path.dirname(relPath));
  const camel = dir.replace(/-(\w)/g, (_, c) => c.toUpperCase());
  const index = modelIndex();
  const props = new Set();
  let found = false;
  for (const suffix of ["DetailDTO", "ListDTO"]) {
    const model = index.get(camel + suffix);
    if (!model) continue;
    found = true;
    for (const p of model) props.add(p);
  }
  return found ? props : null;
}

/**
 * The source of every exported function in the project, keyed by name.
 *
 * <p>Built on first use. A detail panel routinely hands a whole record to a shared formatter
 * rather than reading each field itself, so a rule that asks "does the detail render this
 * field?" has to be able to follow the record into the helper.
 */
let exportedFunctionCache = null;
function exportedFunctionSources() {
  if (exportedFunctionCache) return exportedFunctionCache;
  exportedFunctionCache = new Map();
  const roots = ["packages", "modules", "apps"].map((d) => path.join(ROOT, d));
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const file of walk(root, [])) {
      if (!file.includes(`${path.sep}src${path.sep}`)) continue;
      const src = fs.readFileSync(file, "utf8");
      for (const m of src.matchAll(/export (?:async )?function (\w+)|export const (\w+)\s*=/g)) {
        exportedFunctionCache.set(m[1] ?? m[2], src);
      }
    }
  }
  return exportedFunctionCache;
}

/**
 * The source of every helper a detail panel hands the whole record to.
 *
 * <p>Only a call taking the record itself qualifies. `helper(displayData.field)` names the field
 * at the call site and is already visible in the panel's own source; `helper(displayData)` hides
 * which fields are consumed, and following it is the difference between catching a value the
 * operator cannot read back and flagging one the panel renders through a shared formatter.
 *
 * @param detailSource the detail widget's own source
 * @returns the source of each such helper, concatenated; empty when the panel delegates nothing
 */
function delegatedDetailSources(detailSource) {
  const exported = exportedFunctionSources();
  const seen = new Set();
  let corpus = "";
  for (const m of detailSource.matchAll(/\b([A-Za-z_]\w*)\(\s*displayData\s*[,)]/g)) {
    const name = m[1];
    if (seen.has(name)) continue;
    seen.add(name);
    const src = exported.get(name);
    if (src) corpus += "\n" + src;
  }
  return corpus;
}

const localeKeyCache = new Map();

/**
 * @param ns   a translation namespace as a call site names it
 * @param file the calling file, repository-relative — several deployables ship a catalogue under
 *             the same bare namespace, so the namespace alone does not say which one governs
 * @returns every key the governing catalogues define in any language, flattened to dotted paths,
 *          or null when the catalogue is not one this repository owns — a framework namespace is
 *          not ours to judge, and treating an absent file as an empty catalogue would flag every
 *          call
 *
 * @remarks
 * <b>Which catalogue answers is decided by the calling file, not by directory order.</b> Resolving
 * a bare namespace by taking the first app that happens to own one answers every app with whichever
 * sorts first: three deployables each ship a `common`, and the alphabetically first one had every
 * key, so the other two were reported clean while their screens printed raw keys. The resolution is
 * shared with `dropped-interpolation` so the two rules cannot disagree about which entry a call
 * site reads.
 *
 * <b>A key defined in any language counts as defined.</b> The defect this answers is i18next
 * printing the key itself, which happens when no catalogue carries it at all; where one language
 * has it and another does not, the locale fallback prints that language's sentence. Reading one
 * chosen language would also bake a source locale into a script that ships to projects that do not
 * share it.
 */
function localeKeys(ns, file = "") {
  const dirs = catalogueDirsFor(ns, file);
  if (!dirs.length) return null;
  const cacheKey = dirs.join("|");
  if (localeKeyCache.has(cacheKey)) return localeKeyCache.get(cacheKey);
  const out = new Set();
  let read = false;
  for (const dir of dirs) {
    for (const entries of catalogueLanguages(dir).values()) {
      read = true;
      for (const key of entries.keys()) {
        out.add(key);
        // `dutyCount_one` and `dutyCount_other` are one key to a caller, who writes
        // `t("unit.dutyCount", { count })` and lets i18next pick. Recording only the suffixed
        // forms would report every plural key in the repository as missing.
        const base = key.replace(/_(zero|one|two|few|many|other)$/, "");
        if (base !== key) out.add(base);
      }
    }
  }
  // A directory whose every language file failed to parse is unreadable, not empty — reporting it
  // as empty would name every key in the file that reads it.
  const result = read ? out : null;
  localeKeyCache.set(cacheKey, result);
  return result;
}

/**
 * @param content a source file
 * @returns which namespace each translator name in the file reads from
 *
 * @remarks
 * A file may hold several translators (`const { t } = …`, `const { t: tFeatures } = …`), so the
 * lookup is per name rather than per file: attributing every `t("…")` in such a file to whichever
 * namespace appeared last reports keys that resolve perfectly well.
 */
function translatorBindings(content) {
  const binds = new Map();
  for (const m of content.matchAll(
    /const\s*\{[^}]*\bt\b\s*(?::\s*(\w+))?[^}]*\}\s*=\s*useTranslation\(\s*"([^"]+)"/g,
  )) {
    binds.set(m[1] ?? "t", m[2]);
  }
  return binds;
}

/**
 * The top-level property names of the object literal whose `{` sits at `open`.
 *
 * <p><b>Why this cannot be a regex.</b> The obvious pattern — an identifier followed by a colon —
 * reads the middle of a ternary as a property: in `{ permission: ok ? a : b }` the run ` a :`
 * matches it exactly as well as `permission:` does, so a scanner built that way invents a value
 * named `a` and reports a placeholder nobody passed. The same pattern is defeated by a colon
 * inside a string (`{ hint: "note: x" }`) and by a nested object's own keys.
 *
 * <p>So the object is split the way a parser splits it: walk the text tracking quote, template and
 * nesting state, cut at commas that sit at the object's own depth, and read a name only where a
 * property can begin — at the start of a segment. A ternary then lives inside a segment and is
 * never mistaken for one.
 *
 * <p><b>A spread is reported rather than ignored.</b> `{ ...rest }` hides names this function
 * cannot know, so callers that need a complete list must treat `dynamic` as "do not judge this
 * call" rather than as "no further names".
 *
 * @param content the file source
 * @param open    index of the object literal's `{`
 * @returns the property names, whether anything hid names from the scan, and the index of the `}`
 */
function objectLiteralProperties(content, open) {
  const names = [];
  let dynamic = false;
  let i = open + 1;
  let depth = 1;
  let segStart = i;
  const segments = [];
  while (i < content.length && depth > 0) {
    const ch = content[i];
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      while (i < content.length && content[i] !== quote) {
        if (content[i] === "\\") i++;
        i++;
      }
      i++;
      continue;
    }
    if (ch === "`") {
      // A template's `${…}` holds ordinary code, braces and all, so it is tracked rather than
      // skipped to the next backtick — a nested object inside one would otherwise close the scan.
      i++;
      let inner = 0;
      while (i < content.length) {
        if (content[i] === "\\") {
          i += 2;
          continue;
        }
        if (inner === 0 && content[i] === "`") break;
        if (content[i] === "$" && content[i + 1] === "{") {
          inner++;
          i += 2;
          continue;
        }
        if (inner > 0 && content[i] === "{") inner++;
        else if (inner > 0 && content[i] === "}") inner--;
        i++;
      }
      i++;
      continue;
    }
    if (ch === "/" && content[i + 1] === "/") {
      while (i < content.length && content[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && content[i + 1] === "*") {
      i += 2;
      while (i < content.length && !(content[i] === "*" && content[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (ch === "{" || ch === "[" || ch === "(") depth++;
    else if (ch === "}" || ch === "]" || ch === ")") {
      depth--;
      if (depth === 0) {
        segments.push(content.slice(segStart, i));
        break;
      }
    } else if (ch === "," && depth === 1) {
      segments.push(content.slice(segStart, i));
      segStart = i + 1;
    }
    i++;
  }
  // An unbalanced literal means the scan ran off the end of the file. Reporting the names found
  // so far would be reporting half an object, so the call is marked unjudgeable instead.
  if (depth > 0) return { names: [], dynamic: true, end: content.length };
  for (let segment of segments) {
    const seg = segment
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/^\s*\/\/.*$/gm, " ")
      .trim();
    if (!seg) continue;
    if (seg.startsWith("...") || seg.startsWith("[")) {
      dynamic = true;
      continue;
    }
    const quoted = seg.match(/^(["'])((?:\\.|(?!\1).)*)\1\s*:/);
    if (quoted) {
      names.push(quoted[2]);
      continue;
    }
    // `name:` and the shorthand `name` alike — the shorthand is how most values are passed.
    const plain = seg.match(/^([A-Za-z_$][\w$]*)\s*(?::|$)/);
    if (plain) {
      names.push(plain[1]);
      continue;
    }
    dynamic = true;
  }
  return { names, dynamic, end: i };
}

let catalogueIndexCache = null;

/**
 * Every translation catalogue in the project, indexed by the namespace a call site names.
 *
 * <p>A namespace is resolved from the framework's own registration rather than guessed from the
 * directory name: a `locales/index.ts` that declares one (`buildModuleTranslations({ namespace })`,
 * conventionally through an exported constant) makes its sibling component directories
 * `<namespace>/<component>`, and a `locales/` with no such file — the shape an app uses — makes
 * them bare `<component>`. Both are in use in one repository, and a package's namespace is
 * frequently nothing like its folder.
 *
 * @returns namespace → the catalogue directories registered under it, which is more than one
 *          whenever several deployables ship their own copy of a shared namespace
 */
function localeCatalogues() {
  if (catalogueIndexCache) return catalogueIndexCache;
  const index = new Map();
  const add = (ns, dir) => {
    if (!index.has(ns)) index.set(ns, []);
    index.get(ns).push(dir);
  };
  const declaredNamespace = (dir) => {
    for (const name of ["index.ts", "index.tsx"]) {
      const file = path.join(dir, name);
      if (!fs.existsSync(file)) continue;
      const src = fs.readFileSync(file, "utf8");
      const direct = src.match(/\bnamespace\s*:\s*"([^"]+)"/);
      if (direct) return direct[1];
      // `namespace: PACKAGE_NAMESPACE` is the usual shape, so the constant beside it is read.
      const viaConst = src.match(/\bconst\s+[A-Z][A-Z0-9_]*\s*(?::[^=]+)?=\s*"([^"]+)"/);
      if (viaConst) return viaConst[1];
    }
    return null;
  };
  const seek = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (!e.isDirectory() || EXCLUDE_DIRS.has(e.name)) continue;
      const at = path.join(dir, e.name);
      if (e.name !== "locales") {
        seek(at);
        continue;
      }
      // Where nothing declares a namespace, the directory convention supplies one: a module's
      // catalogues are `<module>/<component>` and an app's are the bare `<component>`. Both shapes
      // are in use in one repository, and a package that declares its own overrides either.
      const segments = path.relative(ROOT, at).split(path.sep);
      const byConvention = segments[0] === "modules" && segments.length > 1 ? segments[1] : null;
      const prefix = declaredNamespace(at) ?? byConvention;
      for (const sub of fs.readdirSync(at, { withFileTypes: true })) {
        if (!sub.isDirectory()) continue;
        const componentDir = path.join(at, sub.name);
        if (!fs.readdirSync(componentDir).some((f) => f.endsWith(".json"))) continue;
        add(prefix ? `${prefix}/${sub.name}` : sub.name, componentDir);
      }
      // A catalogue whose language files sit directly in `locales/` is the namespace itself.
      if (prefix && fs.readdirSync(at).some((f) => f.endsWith(".json"))) add(prefix, at);
    }
  };
  for (const root of SRC_ROOTS) seek(path.join(ROOT, root));
  catalogueIndexCache = index;
  return index;
}

const catalogueLangCache = new Map();

/**
 * @param dir a catalogue directory
 * @returns language → every key it defines, flattened to dotted paths, with the text as written
 */
function catalogueLanguages(dir) {
  if (catalogueLangCache.has(dir)) return catalogueLangCache.get(dir);
  const langs = new Map();
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    const flat = new Map();
    const flatten = (obj, prefix) => {
      for (const [k, v] of Object.entries(obj)) {
        const at = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, at);
        else flat.set(at, Array.isArray(v) ? v.join(" ") : String(v));
      }
    };
    try {
      flatten(JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")), "");
    } catch {
      continue;
    }
    langs.set(file.replace(/\.json$/, ""), flat);
  }
  catalogueLangCache.set(dir, langs);
  return langs;
}

/**
 * The catalogue directories that govern a namespace as one file names it.
 *
 * <p>Several deployables ship a `common`, so a namespace alone does not say which catalogue a call
 * site reads. The one that shares the longest path with the calling file does: a screen inside an
 * app is answered by that app's copy, and only shared code — which shares no path with any of them
 * — is answered by all of them, because shared code really does render under each.
 *
 * @param ns   the namespace a translator is bound to
 * @param file the calling file, repository-relative
 */
function catalogueDirsFor(ns, file) {
  const all = localeCatalogues().get(ns);
  if (!all || !all.length) return [];
  const fileSegments = file.split("/");
  const shared = (dir) => {
    const segments = path.relative(ROOT, dir).split(path.sep);
    let n = 0;
    while (n < segments.length && n < fileSegments.length && segments[n] === fileSegments[n]) n++;
    return n;
  };
  const best = Math.max(...all.map(shared));
  return all.filter((dir) => shared(dir) === best);
}

/**
 * Which namespace each translator name in a file reads from, including the namespaces a package
 * composes rather than writes out.
 *
 * <p>{@link translatorBindings} reads a literal argument. A package that publishes its own
 * catalogue names it once as a constant and writes `useTranslation(PACKAGE_NAMESPACE + "/features")`
 * at every call site, which is not a literal — so a rule built on the literal form alone is blind
 * to whole shared packages, and shared packages are where one dropped value reaches every screen
 * that mounts the component.
 *
 * @param content the file source
 * @param file    the file's repository-relative path, used to follow a relative import
 */
function translatorNamespaces(content, file) {
  const binds = translatorBindings(content);
  const constValue = (ident) => {
    const inline = content.match(
      new RegExp(`\\b(?:export\\s+)?const\\s+${ident}\\s*(?::[^=]+)?=\\s*"([^"]+)"`),
    );
    if (inline) return inline[1];
    const imported = content.match(
      new RegExp(`import\\s*\\{[^}]*\\b${ident}\\b[^}]*\\}\\s*from\\s*"([^"]+)"`),
    );
    if (!imported || !imported[1].startsWith(".")) return null;
    const base = path.resolve(path.dirname(path.join(ROOT, file)), imported[1]);
    for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
      if (!fs.existsSync(candidate)) continue;
      const declared = fs
        .readFileSync(candidate, "utf8")
        .match(new RegExp(`export\\s+const\\s+${ident}\\s*(?::[^=]+)?=\\s*"([^"]+)"`));
      if (declared) return declared[1];
    }
    return null;
  };
  for (const m of content.matchAll(
    /const\s*\{[^}]*\bt\b\s*(?::\s*(\w+))?[^}]*\}\s*=\s*useTranslation\(\s*([^)]+?)\s*\)/g,
  )) {
    const alias = m[1] ?? "t";
    if (binds.has(alias)) continue;
    const expr = m[2].trim();
    const composed = expr.match(/^([A-Za-z_$][\w$]*)\s*\+\s*"([^"]+)"$/);
    if (composed) {
      const head = constValue(composed[1]);
      if (head) binds.set(alias, head + composed[2]);
      continue;
    }
    const bare = expr.match(/^([A-Za-z_$][\w$]*)$/);
    if (bare) {
      const value = constValue(bare[1]);
      if (value) binds.set(alias, value);
    }
  }
  return binds;
}

/**
 * The names i18next reads as instructions rather than substituting into the sentence.
 *
 * <p>The framework's translator declares its second argument as plain values
 * (`Record<string, string | number | boolean>`), but it hands that object straight to i18next, so
 * i18next's own option names keep their meaning at runtime and are legitimately absent from the
 * text. `count` is the one that matters in practice: it selects `key_one` against `key_other`, and
 * a sentence that pluralises without printing the number is correct.
 *
 * <p>Six of these are separately an error under `translator-options-arg`, which exists to say that
 * this translator takes no options at all. They stay listed here so one defect is reported by one
 * rule rather than by two under different names.
 */
const I18NEXT_RESERVED = new Set([
  "count",
  "context",
  "ordinal",
  "lng",
  "lngs",
  "ns",
  "keySeparator",
  "nsSeparator",
  "defaultValue",
  "defaultVariables",
  "replace",
  "interpolation",
  "skipInterpolation",
  "returnObjects",
  "returnDetails",
  "returnedObjectHandler",
  "joinArrays",
  "postProcess",
  "fallbackLng",
]);

/** Whether a name is i18next's rather than a value the sentence is meant to substitute. */
function isReservedTranslationOption(name) {
  // `defaultValue_one`, `defaultValue_other` — a default per plural form is still a default.
  return I18NEXT_RESERVED.has(name) || /^defaultValue_/.test(name);
}

/**
 * Route directories whose screens are reached without an account.
 *
 * A back-office screen declares the permission its server-side surface enforces, so a typed
 * address does not open a page the operator may not read. A customer-facing page has no
 * operator and no grants to check — the person it exists for is the licence server's customer,
 * not one of its users — so the guard that protects the rest of the app cannot apply to it.
 * Add a directory here only when nothing behind it is read on an operator's authority.
 */
/**
 * Project-declared settings for this plugin, read from `.claude/simplix.json` at the project
 * root. The `audit` section is this script's; the file's other sections belong to the plugin's
 * hooks.
 *
 * Which route directories are open to anybody is a property of the product, not of the
 * framework, so the project states it rather than the script guessing from a name.
 *
 * @example
 * { "audit": { "publicRouteDirs": ["checkout", "contact-change"] } }
 */
let settingsCache = null;
function settings() {
  if (settingsCache) return settingsCache;
  const file = path.join(ROOT, ".claude", "simplix.json");
  if (!fs.existsSync(file)) {
    settingsCache = {};
    return settingsCache;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    settingsCache = parsed.audit ?? {};
  } catch {
    console.error(`⚠ .claude/simplix.json is not valid JSON — auditing with defaults.`);
    settingsCache = {};
  }
  return settingsCache;
}


/**
 * Every enum the generated domain packages publish, by name.
 *
 * @remarks
 * A label lookup takes the enum's name as a string, so a name that no longer matches any model
 * fails silently — the screen falls back to printing the key. Reading the names off the codegen
 * output is what lets that be caught mechanically instead of by eye.
 */
/**
 * The apps whose providers raise a dialog for a mutation nobody handled.
 *
 * @remarks
 * Not every app in a workspace installs one — a public storefront reports its own failures inline
 * and mounts no such cache — and in those a screen catching its own refusal is the whole of the
 * reporting rather than half of it. Read from the code instead of asked of the project, because
 * the file that installs it is the fact and a setting would drift from it.
 *
 * @returns the directory names under `apps/` that install one, plus whether any app does
 */
let globalDialogCache = null;
function appsWithGlobalErrorDialog() {
  if (globalDialogCache) return globalDialogCache;
  const apps = new Set();
  const appsDir = path.join(ROOT, "apps");
  if (fs.existsSync(appsDir)) {
    for (const app of fs.readdirSync(appsDir)) {
      const walk = (dir) => {
        if (!fs.existsSync(dir)) return false;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) { if (walk(full)) return true; continue; }
          if (!/\.(t|j)sx?$/.test(entry.name)) continue;
          if (/new MutationCache\(/.test(fs.readFileSync(full, "utf8"))) return true;
        }
        return false;
      };
      if (walk(path.join(appsDir, app, "src"))) apps.add(app);
    }
  }
  globalDialogCache = { apps, any: apps.size > 0 };
  return globalDialogCache;
}

/**
 * @param rel the file's path relative to the project root
 * @returns whether a mutation in this file can raise the app-level error dialog
 */
function underGlobalErrorDialog(rel) {
  const { apps, any } = appsWithGlobalErrorDialog();
  const inApp = rel.match(/^apps\/([^/]+)\//);
  // Shared code is rendered by whichever app imports it, so it is in scope wherever any app has
  // the dialog. A file inside one app is judged by that app alone.
  return inApp ? apps.has(inApp[1]) : any;
}

let generatedEnumCache = null;
function generatedEnumNames() {
  if (generatedEnumCache) return generatedEnumCache;
  const names = new Set();
  const packagesDir = path.join(ROOT, "packages");
  if (fs.existsSync(packagesDir)) {
    for (const pkg of fs.readdirSync(packagesDir)) {
      const modelDir = path.join(packagesDir, pkg, "src", "generated", "model");
      if (!fs.existsSync(modelDir)) continue;
      for (const file of fs.readdirSync(modelDir)) {
        const src = fs.readFileSync(path.join(modelDir, file), "utf8");
        for (const m of src.matchAll(/export type (\w+) = \(typeof \1\)\[/g)) names.add(m[1]);
        for (const m of src.matchAll(/export const (\w+) = \{/g)) names.add(m[1]);
      }
    }
  }
  generatedEnumCache = names;
  return names;
}

function publicRouteDirs() {
  const declared = settings().publicRouteDirs;
  return Array.isArray(declared) ? declared : [];
}

/**
 * Whether the app owning this route already guards every address at its root.
 *
 * A root route with a `beforeLoad` redirect admits nobody without a session before a single
 * screen mounts, which is the stronger form of the same protection — flagging its children for
 * missing a per-route wrapper would be asking for the check to be written twice.
 */
function guardedAtRoot(file) {
  const marker = `${path.sep}src${path.sep}routes${path.sep}`;
  const at = file.lastIndexOf(marker);
  if (at < 0) return false;
  // Resolve against ROOT, not the process's directory: paths reach here relative to the
  // project root, so a run launched from elsewhere with --root would miss every __root.tsx
  // and report the whole app as unguarded.
  const root = path.resolve(ROOT, file.slice(0, at + marker.length), "__root.tsx");
  if (!fs.existsSync(root)) return false;
  return /beforeLoad\s*:/.test(fs.readFileSync(root, "utf8"));
}

/**
 * A waiting button that keeps its mark.
 *
 * `Button` composes the spinner AHEAD of its children and swaps them out only when `loadingText`
 * is supplied. A button that leads with an icon therefore draws two circles side by side the
 * moment it is pressed, and the pair is wider than the icon was — so a segmented row-action group
 * grows under the pointer at the instant of the click, moving its neighbours out from under it.
 * Handing the label to `loadingText` gives the spinner the mark's own seat and the width holds.
 *
 * An icon-size button is exempt: the framework drops the children there, so the spinner already
 * stands alone.
 *
 * @param content the widget source
 * @returns one hit per `<Button loading …>` that leads with a mark and names no `loadingText`
 */
function spinnerBesideMark(content) {
  const hits = [];
  for (const m of content.matchAll(/<Button\b/g)) {
    // Attribute values carry their own braces and ">" (`onClick={() => …}`), so the open tag ends
    // at the first ">" seen at brace depth zero rather than at the first ">".
    let depth = 0;
    let end = -1;
    for (let i = m.index; i < content.length; i++) {
      const ch = content[i];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      else if (ch === ">" && depth === 0) { end = i; break; }
    }
    if (end < 0 || content[end - 1] === "/") continue;
    const open = content.slice(m.index, end + 1);
    // `loadingText` also begins with "loading", so the flag is matched up to its delimiter.
    if (!/\bloading[=\s>]/.test(open) || /\bloadingText\b/.test(open)) continue;
    if (/size=\{?\s*["']icon/.test(open)) continue;
    const close = content.indexOf("</Button>", end);
    if (close < 0) continue;
    const children = content.slice(end + 1, close);
    const lead = children.match(/^\s*<([A-Za-z][\w.]*)([^>]*)>?/);
    if (!lead) continue;
    // A mark, not prose: an `<svg>`, a component named for one, or one sized by the icon
    // convention. A leading `<span>` of text is what the spinner is supposed to sit beside.
    const isMark =
      lead[1] === "svg" || /Icon\b/.test(lead[1]) || /className="[^"]*\bsize-/.test(lead[2] ?? "");
    if (!isMark) continue;
    hits.push({
      line: lineOfIndex(content, m.index),
      excerpt: open.replace(/\s+/g, " ").slice(0, 140),
    });
  }
  return hits;
}

const RULES = [
  {
    id: "unguarded-route",
    invariant: "audit: route permission",
    level: "error",
    desc: "Route mounts its screen directly — a typed address or an old bookmark opens a screen the operator's grants do not admit, and the denial only arrives when something is clicked",
    appliesTo: (p) =>
      /\/src\/routes\/[^/]+\/index\.tsx$/.test(p)
      && !publicRouteDirs().some((dir) => p.includes(`/src/routes/${dir}/`))
      && !guardedAtRoot(p),
    check: (c) => lineHits(c, /component:\s*\w+\s*,/, (line) => !line.includes("guarded(")),
    samples: {
      file: "apps/console/src/routes/areas/index.tsx",
      broken: `import { createFileRoute } from "@tanstack/react-router";
import { AreaListPage } from "@acme/site/pages";

export const Route = createFileRoute("/areas/")({
  component: AreaListPage,
});`,
      fixed: `import { createFileRoute } from "@tanstack/react-router";
import { AreaListPage } from "@acme/site/pages";
import { SUBJECTS } from "@acme/site/shared/auth/subjects";
import { guarded } from "~/lib/guarded";

export const Route = createFileRoute("/areas/")({
  component: guarded(AreaListPage, { action: "view", subject: SUBJECTS.area }),
});`,
      miss: [
        {
          note: "a route directory the product declares public — no operator, no grants to check",
          file: "apps/console/src/routes/checkout/index.tsx",
          source: `export const Route = createFileRoute("/checkout/")({
  component: CheckoutPage,
});`,
          files: { ".claude/simplix.json": `{ "audit": { "publicRouteDirs": ["checkout"] } }` },
        },
        {
          note: "an app whose root route admits nobody without a session — the stronger form of the same guard",
          source: `export const Route = createFileRoute("/areas/")({
  component: AreaListPage,
});`,
          files: {
            "apps/console/src/routes/__root.tsx": `export const Route = createRootRoute({
  beforeLoad: ({ context }) => {
    if (!context.auth.session) throw redirect({ to: "/sign-in" });
  },
});`,
          },
        },
      ],
    },
  },
  {
    id: "dead-dialog-width",
    invariant: "#8 / audit: dialog width",
    level: "error",
    desc: "A dialog asks for a width with a bare `max-w-*` utility — `DialogContent` already carries `sm:max-w-lg`, which wins at every viewport above 640px, so the wider width never takes effect and the dialog stays 512px. A three-column table inside then wraps one syllable to a line and reads as a broken screen while every string in it is right. Write the breakpoint variant (`sm:max-w-3xl`), which is what overrides the component's own",
    appliesTo: isTsx,
    // Only widths wider than the component's own default are dead in a way anybody notices;
    // `max-w-lg` and below resolve to the same box the dialog already had.
    check: (c) =>
      lineHits(
        c,
        /<(?:Bounded)?DialogContent\b[^>]*className="[^"]*\bmax-w-(?:xl|2xl|3xl|4xl|5xl|6xl|7xl|screen-\w+)\b/,
        // A doc comment showing the shape is not a dialog. Left in, the rule reports the very
        // file that documents the component, and the first person to read the report learns
        // that this rule cries wolf.
        (line) => !/\bsm:max-w-/.test(line) && !/^\s*(?:\*|\/\/|\/\*)/.test(line),
      ),
    samples: {
      file: "modules/site/src/widgets/area/assign-dialog.tsx",
      broken: `<DialogContent className="max-w-3xl">
  <AssignmentTable rows={rows} />
</DialogContent>`,
      fixed: `<DialogContent className="sm:max-w-3xl">
  <AssignmentTable rows={rows} />
</DialogContent>`,
      miss: [
        {
          note: "a width at or below the component's own sm:max-w-lg resolves to the box the dialog already had",
          source: `<DialogContent className="max-w-md">
  <ConfirmBody />
</DialogContent>`,
        },
        {
          note: "the doc comment that documents the component is not a dialog",
          source: `/**
 * <DialogContent className="max-w-3xl"> is the shape this component replaces.
 */
export function AssignDialog() { return null; }`,
        },
      ],
    },
  },
  {
    id: "unbounded-overlay-panel",
    invariant: "#58 / audit: dialog geometry",
    level: "error",
    desc: "A component draws its own centred overlay panel with a width and no height ceiling. Pinned at `top-1/2` and translated back by half its own height, such a panel grows in BOTH directions at once: the title leaves the top of the window and the confirm button leaves the bottom, and because nothing in the chain scrolls there is no way to reach either — Escape is the only exit, guessed. Whether it happens is decided by the data, not by the code, so it passes review on the day it is written. Give the panel `max-h-[calc(100dvh-2rem)]`, make it a flex column, and let the body scroll (`min-h-0 overflow-y-auto`) with the title and the footer `shrink-0`",
    appliesTo: isTsx,
    check: (c) => {
      const lines = c.split("\n");
      const hits = [];
      for (const m of c.matchAll(/<[A-Za-z][\w.]*/g)) {
        const { tag } = jsxOpenTag(c, m.index);
        if (!/\bfixed\b/.test(tag)) continue;
        if (!/\btop-1\/2\b|\btop-\[50%\]/.test(tag)) continue;
        if (!/-translate-y-1\/2\b|translate-y-\[-50%\]/.test(tag)) continue;
        // A panel has a width. Without this the rule also reports a centred spinner or a
        // decorative mark, neither of which has content that can outgrow the window.
        if (!/\bmax-w-|\bw-full\b/.test(tag)) continue;
        // The ceiling, wherever in the tag it is written — a literal class, a `cn(…)` argument,
        // or a template the wrapper interpolates. Any of the three bounds the panel.
        if (/\bmax-h-/.test(tag)) continue;
        const line = lineOfIndex(c, m.index);
        if (!notCommentLine(lines[line - 1] ?? "", lines, line - 1)) continue;
        hits.push({ line, excerpt: tag.replace(/\s+/g, " ").slice(0, 140) });
      }
      return hits;
    },
    samples: {
      file: "packages/ui/src/crud/shared/confirm-dialog.tsx",
      broken: `<AlertDialog.Content
  className={cn(
    "fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2",
    "rounded-lg border bg-background p-6 shadow-lg",
  )}
>
  <AlertDialog.Title className="text-lg font-semibold">{title}</AlertDialog.Title>
  <AlertDialog.Description className="mt-2 text-sm">{description}</AlertDialog.Description>
  <footer className="mt-6 flex w-full justify-end gap-2">{actions}</footer>
</AlertDialog.Content>`,
      fixed: `<AlertDialog.Content
  className={cn(
    "fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2",
    "flex max-h-[calc(100dvh-2rem)] flex-col",
    "rounded-lg border bg-background p-6 shadow-lg",
  )}
>
  <AlertDialog.Title className="shrink-0 text-lg font-semibold">{title}</AlertDialog.Title>
  <div className="-mx-6 mt-2 min-h-0 overflow-y-auto px-6">
    <AlertDialog.Description className="text-sm">{description}</AlertDialog.Description>
  </div>
  <footer className="mt-6 flex w-full shrink-0 justify-end gap-2">{actions}</footer>
</AlertDialog.Content>`,
      miss: [
        {
          note: "a wrapper that passes the ceiling down through the class it interpolates",
          source: `export function BoundedDialogContent({ className, ...props }) {
  return (
    <DialogPrimitive.Content
      className={\`fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 max-h-[calc(100dvh-2rem)] overflow-y-auto \${className ?? ""}\`}
      {...props}
    />
  );
}`,
        },
        {
          note: "a centred mark with no width, which has no content that can outgrow the window",
          source: `<div className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2">
  <Spinner />
</div>`,
        },
        {
          note: "an edge-anchored sheet, which is not centred and takes its height from the window already",
          source: `<DialogPrimitive.Content className="fixed inset-y-0 right-0 z-50 w-full max-w-lg border-l">
  {children}
</DialogPrimitive.Content>`,
        },
        {
          note: "the doc comment that shows the shape being replaced is not a panel",
          source: `/**
 * <AlertDialog.Content className="fixed left-1/2 top-1/2 w-full max-w-lg -translate-y-1/2">
 * is the unbounded shape this component replaces.
 */
export function AlertPanel() { return null; }`,
        },
      ],
    },
  },
  {
    id: "unpaged-table-without-reason",
    invariant: "#32 / audit: tables are lists",
    level: "error",
    desc: "A table draws rows with no paging under it and nothing saying why it needs none. A table that pages is a list wherever it sits and carries all four — a count, filters, sorting, paging; a table that does NOT page is the bounded kind, and bounded is a claim about the data that only a person can make. The component cannot tell a catalogue of eleven from a history of eleven-so-far, so the claim is written where the table is: a comment opening `Bounded:` and saying what fixes the count. A missing paged endpoint on the server is not a reason — building it is the work",
    appliesTo: isTsx,
    // Judged per table rather than per file: a screen with a bounded catalogue beside a growing
    // collection is the ordinary case here, and a file-level test would let the second one pass on
    // the first one's paging.
    check: (c) =>
      lineHits(
        c,
        /<Table[\s>]/,
        (line, lines, i) => {
          // The frame that pages this table, or the claim that it needs none, stands just above it.
          const above = lines.slice(Math.max(0, i - 15), i).join("\n");
          if (/\bBounded:/.test(above)) return false;
          if (/<CrudDetail\.(Table|List)\b|onPageChange=|<CrudList\b/.test(above)) return false;
          // A pager can also stand UNDER the table it pages, which is where `CrudList.Pagination`
          // goes inside a `TableCard` — the frame wraps both, so the paging is a sibling after the
          // rows rather than a parent around them. Reading only upward called that arrangement
          // unpaged and asked for a `Bounded:` claim that would have been false.
          const close = lines.findIndex((l, at) => at > i && /<\/Table>/.test(l));
          if (close !== -1) {
            const below = lines.slice(close + 1, close + 11).join("\n");
            if (/<CrudList\.Pagination\b|onPageChange=/.test(below)) return false;
          }
          return true;
        },
      ),
    samples: {
      file: "modules/<domain>/src/widgets/<entity>/history-tab.tsx",
      broken: `export function HistoryTab({ rows }: Props) {
  return (
    <Table>
      <TableBody>{rows.map((row) => <TableRow key={row.id} />)}</TableBody>
    </Table>
  );
}`,
      fixed: `export function HistoryTab({ rows }: Props) {
  return (
    // Bounded: the eleven states a record moves through, which is every row it will ever have.
    <Table>
      <TableBody>{rows.map((row) => <TableRow key={row.id} />)}</TableBody>
    </Table>
  );
}`,
      miss: [
        {
          note: "a pager standing under the table it pages is paging",
          source: `export function HistoryTab({ history }: Props) {
  return (
    <TableCard>
      <Table>
        <TableBody>{history.rows.map((row) => <TableRow key={row.id} />)}</TableBody>
      </Table>
      <CrudList.Pagination
        page={history.page}
        pageSize={history.pageSize}
        total={history.total}
        totalPages={history.totalPages}
        onPageChange={history.setPage}
      />
    </TableCard>
  );
}`,
        },
        {
          note: "a table the detail frame pages needs no such claim",
          source: `export function HistoryTab({ history }: Props) {
  return (
    <CrudDetail.Table page={history.page} total={history.total} onPageChange={history.setPage}>
      <Table>
        <TableBody>{history.rows.map((row) => <TableRow key={row.id} />)}</TableBody>
      </Table>
    </CrudDetail.Table>
  );
}`,
        },
        {
          note: "the header, body, row and cell elements are not the table",
          source: `// Bounded: the four sharing modes, which the enum fixes.
<Table>
  <TableHeader><TableRow><TableHead>Mode</TableHead></TableRow></TableHeader>
  <TableBody><TableRow><TableCell>Open</TableCell></TableRow></TableBody>
</Table>`,
        },
      ],
    },
  },
  {
    id: "paged-panel-collection-is-not-a-list",
    invariant: "#71 / audit: a tab's collection is a list",
    level: "error",
    desc: "A collection inside a detail panel or a tab is paged, and paging is the proof that it grows — yet it is drawn with `CrudDetail.List` / `CrudDetail.Table` and nothing else, so the reader gets pages and none of the three things they reach for when there are more rows than a page: the total, a way to search, a way to sort. A collection that grows is a list wherever it sits, and a list is `CrudList` — the same compound the list screen uses, bound to the parent record with a forced request parameter rather than a filter the reader can type away. What the two paged frames are for is the other half of the split: a set that does NOT grow, drawn as a bordered card with no pager at all",
    appliesTo: isTsx,
    // Judged per file rather than per tag: the chrome a paged collection is missing (the total,
    // the search box, the sortable header) is not written next to the pager, so a tag-local test
    // would have to guess how far to read. One tab body is one file here or one component in one,
    // and either way `CrudList` appearing anywhere in it is the shape being asked for.
    check: (c) => {
      // The list compound anywhere in the file means the shape is already what this asks for.
      if (/<CrudList\b/.test(c)) return [];
      const lines = c.split("\n");
      const hits = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // A pager on a panel frame, or the hook that computes one. `onPageChange` alone is not
        // enough — a bounded `CrudDetail.Table` takes none, and that is the case this rule leaves
        // alone.
        const framed = /<CrudDetail\.(?:List|Table)\b/.test(line);
        const paged = framed
          ? /onPageChange=|\{\s*\.\.\.\w*[Pp]ager/.test(lines.slice(i, i + 8).join("\n"))
          : /\b(?:usePanelPage|panelPager)\s*\(/.test(line);
        if (!framed && !/\b(?:usePanelPage|panelPager)\s*\(/.test(line)) continue;
        if (!paged) continue;
        hits.push({ line: i + 1, excerpt: line.trim().slice(0, 140) });
        break;
      }
      return hits;
    },
    samples: {
      file: "modules/<domain>/src/widgets/<entity>/holders-tab.tsx",
      broken: `export function HoldersTab({ positionId }: Props) {
  const page = usePanelPage();
  const holders = useListAccounts({ positionId, page: page.index });
  return (
    <CrudDetail.List {...page.pagerFor(20, holders.data)}>
      {rows.map((row) => <DetailListRow key={row.userId} primary={row.name} />)}
    </CrudDetail.List>
  );
}`,
      fixed: `export function HoldersTab({ positionId }: Props) {
  const list = useCrudList<AccountRow>({
    listHook: adaptForcedList(useListAccounts, { "positionId.equals": positionId }),
  });
  return (
    <CrudList>
      <CrudList.Toolbar>
        <CrudList.Search value={list.search} onChange={list.setSearch} />
        <CrudList.FilterBar filters={FILTERS} state={list.filters} maxBadges={3} count={list.total} />
      </CrudList.Toolbar>
      <CrudList.TableCard>
        <CrudList.Table rows={list.rows} sort={list.sort}>
          <CrudList.Column<AccountRow> field="name" header={fieldLabel("name")} sortable />
        </CrudList.Table>
      </CrudList.TableCard>
      <CrudList.Pagination {...list.pagination} />
    </CrudList>
  );
}`,
      miss: [
        {
          note: "a bounded set takes no pager, and this rule leaves it alone",
          source: `export function ModesTab() {
  return (
    // Bounded: the four sharing modes, which the enum fixes.
    <CrudDetail.Table>
      <Table><TableBody>{MODES.map((m) => <TableRow key={m} />)}</TableBody></Table>
    </CrudDetail.Table>
  );
}`,
        },
        {
          note: "the collection already renders as a list",
          source: `export function HoldersTab({ positionId }: Props) {
  const page = usePanelPage();
  return (
    <CrudList>
      <CrudList.TableCard><CrudList.Table rows={rows} /></CrudList.TableCard>
      <CrudList.Pagination {...page.pagerFor(20, holders.data)} />
    </CrudList>
  );
}`,
        },
      ],
    },
  },
  {
    id: "audit-strip-outside-the-first-tab",
    invariant: "#72 / audit: where the audit strip sits",
    level: "error",
    desc: "A record's audit strip — its identifier and its created / updated stamps — is drawn somewhere other than the first tab of the panel. On the `CrudDetail` root it stands under every tab, so the stamps of the RECORD sit beneath a tab listing other records and read as the stamps of those rows; in a later tab it is the same claim made once more in a place nobody looks for it. The strip belongs to the record, the first tab is where the record itself is, and one strip is all a panel has",
    appliesTo: isTsx,
    check: (c) => {
      const lines = c.split("\n");
      const panels = [];
      lines.forEach((line, i) => {
        if (/<(?:TabsContent|PageTabPanel)\b/.test(line)) panels.push(i);
      });
      // One panel is not a tabbed detail — there is no other tab for the strip to be under.
      if (panels.length < 2) return [];
      const hits = [];
      lines.forEach((line, i) => {
        if (!/\bauditData\s*=/.test(line)) return;
        // Before the first panel opens the strip is on the detail's own root, which draws it
        // under every tab; after the second opens it is in a tab that is not the first.
        if (i < panels[0] || i > panels[1]) {
          hits.push({ line: i + 1, excerpt: line.trim().slice(0, 140) });
        }
      });
      return hits;
    },
    samples: {
      file: "modules/<domain>/src/widgets/<entity>/detail.tsx",
      broken: `<CrudDetail auditData={{ id: row.code, createdAt: row.createdAt, updatedAt: row.updatedAt }}>
  <Tabs defaultValue="overview">
    <TabsContent value="overview"><Overview /></TabsContent>
    <TabsContent value="holders"><Holders /></TabsContent>
  </Tabs>
</CrudDetail>`,
      fixed: `<CrudDetail>
  <Tabs defaultValue="overview">
    <TabsContent value="overview">
      <Overview />
      <CrudDetail.AuditFooter
        auditData={{ id: row.code, createdAt: row.createdAt, updatedAt: row.updatedAt }}
      />
    </TabsContent>
    <TabsContent value="holders"><Holders /></TabsContent>
  </Tabs>
</CrudDetail>`,
      miss: [
        {
          note: "a panel with one tab has nowhere else for the strip to be",
          source: `<CrudDetail auditData={{ id: row.code, createdAt: row.createdAt, updatedAt: row.updatedAt }}>
  <Tabs defaultValue="overview">
    <TabsContent value="overview"><Overview /></TabsContent>
  </Tabs>
</CrudDetail>`,
        },
        {
          note: "a panel with no tabs at all",
          source: `<CrudDetail auditData={{ id: row.code, createdAt: row.createdAt, updatedAt: row.updatedAt }}>
  <Overview />
</CrudDetail>`,
        },
      ],
    },
  },
  {
    id: "tab-panel-repeats-its-tab-name",
    invariant: "#63 / audit: a tab said its name once",
    level: "error",
    desc: "A section inside a tab panel is titled with the same string the tab itself carries, so the reader who just pressed 「이력」 is told 「이력」 again at the top of what they opened. It costs a heading's height on a panel where the rows are what the tab was pressed for, and it says nothing the press did not. Delete the heading rather than move it — the tab is the title",
    appliesTo: isTsx,
    check: (c) => {
      const keysOf = (re) => {
        const found = new Set();
        for (const m of c.matchAll(re)) found.add(m[1]);
        return found;
      };
      const tabKeys = keysOf(/\blabel=\{t\("([^"]+)"\)\}/g);
      if (tabKeys.size === 0) return [];
      const hits = [];
      const lines = c.split("\n");
      // Only a SECTION's title, never any prop spelt `title` — a button's tooltip is `title` too,
      // and a header control called 「도움말」 beside a tab called 「도움말」 is two right answers.
      const SECTION = /<(?:\w+\.)?Section(?:Shell)?\b/;
      lines.forEach((line, i) => {
        const m = line.match(/\btitle=\{t\("([^"]+)"\)\}/);
        if (!m || !tabKeys.has(m[1])) return;
        const opening = lines.slice(Math.max(0, i - 4), i + 1).join("\n");
        if (!SECTION.test(opening)) return;
        hits.push({ line: i + 1, excerpt: line.trim().slice(0, 140) });
      });
      return hits;
    },
    samples: {
      file: "modules/<domain>/src/widgets/<entity>/detail.tsx",
      broken: `<TabsList>
  <CountedTab value="history" label={t("detail.tabHistory")} />
</TabsList>
<TabsContent value="history">
  <CrudDetail.Section title={t("detail.tabHistory")} variant="flat">
    <HistoryTable />
  </CrudDetail.Section>
</TabsContent>`,
      fixed: `<TabsList>
  <CountedTab value="history" label={t("detail.tabHistory")} />
</TabsList>
<TabsContent value="history">
  <HistoryTable />
</TabsContent>`,
      miss: [
        {
          note: "a section whose title is its own, not the tab's",
          source: `<TabsList>
  <CountedTab value="overview" label={t("detail.tabOverview")} />
</TabsList>
<TabsContent value="overview">
  <CrudDetail.Section title={t("detail.sectionPosition")} variant="flat" />
</TabsContent>`,
        },
        {
          note: "a button's tooltip is spelt `title` and is not a heading",
          source: `<TabsList>
  <CountedTab value="help" label={t("shell.help")} />
</TabsList>
<Button
  variant="ghost"
  title={t("shell.help")}
/>`,
        },
      ],
    },
  },
  {
    id: "per-screen-enum-badge",
    invariant: "#22 / #23 / audit: registry first",
    level: "error",
    desc: "A screen declares its own component to draw an enum as a badge — resolve the boot enum, look the label up, pick a tone. The framework already has that component twice over (`StatusBadge` takes a tone map keyed by the raw value, `EnumBadge` takes one tone for a categorical kind), and every screen that writes its own arrives at a slightly different answer for the absent value, the tone of the default case, and the size of the pill. Six of them in one module is six pills that do not match, and nothing compares them. Pass the module's variant map to the shared component instead",
    appliesTo: isTsx,
    check: (c) => {
      const lines = c.split("\n");
      const hits = [];
      for (let i = 0; i < lines.length; i += 1) {
        // A component declared in the screen, not exported and not the shared one being defined.
        if (!/^\s*function\s+[A-Z][\w$]*\s*\(/.test(lines[i])) continue;
        const body = lines.slice(i, i + 14).join("\n");
        if (!/<Badge\b/.test(body)) continue;
        if (!/\bresolveBootEnum\s*\(/.test(body)) continue;
        // A badge whose label comes from the enum catalogue is the shared component's whole job.
        if (!/\benumLabel\s*\(/.test(body)) continue;
        hits.push({ line: i + 1, excerpt: lines[i].trim().slice(0, 140) });
      }
      return hits;
    },
    samples: {
      file: "modules/<domain>/src/widgets/<entity>/list.tsx",
      broken: `function KindBadge({ row }: { readonly row: ThingListDTO }) {
  const { enumLabel } = useEntityTranslation("thing");
  const kind = resolveBootEnum(row.kind);
  return <Badge variant="warning">{kind ? enumLabel("ThingKind", kind) : "—"}</Badge>;
}`,
      fixed: `const KIND_VARIANTS: Record<string, StatusVariant> = { URGENT: "warning", ROUTINE: "outline" };

export function ThingList() {
  const { enumLabel } = useEntityTranslation("thing");
  return (
    <CrudList.Column<ThingListDTO> field="kind" header={fieldLabel("kind")}>
      {({ row }) => (
        <StatusBadge
          enumName="ThingKind"
          value={row.kind}
          enumLabel={enumLabel}
          variantMap={KIND_VARIANTS}
        />
      )}
    </CrudList.Column>
  );
}`,
      miss: [
        {
          note: "the shared component itself, which is where the resolving belongs",
          source: `export function StatusBadge({ enumName, value, enumLabel, variantMap }: StatusBadgeProps) {
  const resolved = resolveBootEnum(value);
  if (!resolved) return null;
  return <Badge variant={statusVariant(variantMap, resolved)}>{enumLabel(enumName, resolved)}</Badge>;
}`,
        },
        {
          note: "a component drawing a badge from a value that is not an enum",
          source: `function CountBadge({ row }: { readonly row: ThingListDTO }) {
  return <Badge variant="outline">{row.total ?? 0}</Badge>;
}`,
        },
      ],
    },
  },
  {
    id: "unfrozen-now-in-a-request",
    invariant: "#3 / #32",
    level: "error",
    desc: "「now」 read during render and put into a request parameter. The value differs on every pass, so the query key differs on every pass: the read never settles, the screen holds its loading rows for as long as it is open, and anything watching the parameters — a page reset, an invalidation — fires forever. Hold the instant in `useState(() => …)` or a `useMemo(…, [])`, which is what the window a reader asked about actually means: the moment they opened the screen",
    appliesTo: (path) => isTsx(path) || /\.ts$/.test(path),
    check: (c) => {
      const lines = c.split("\n");
      const hits = [];
      for (let i = 0; i < lines.length; i += 1) {
        if (!/new Date\(\)|Date\.now\(\)/.test(lines[i])) continue;
        // Held in state, a memo or a ref — the frozen forms. The opener may be a line or two above.
        const opener = lines.slice(Math.max(0, i - 2), i + 1).join("\n");
        if (/useState\(|useMemo\(|useRef\(|useCallback\(/.test(opener)) continue;
        const block = lines.slice(Math.max(0, i - 8), i + 9).join("\n");
        // A server filter key: what makes this a request parameter rather than a value.
        if (!/\.(equals|between|greaterThan|lessThan|greaterThanOrEqualTo|lessThanOrEqualTo)"\s*:/.test(block)) continue;
        // A READ built during render is what goes stale. The same parameter assembled inside a
        // callback — a save, a submit — is read once when the press happens, and a callback is
        // where a genuine 「지금」 belongs. The read path names the hook that will carry it.
        if (!/\badaptForcedList\b|\buseList\w+\s*\(|\buseCrudList\b/.test(block)) continue;
        hits.push({ line: i + 1, excerpt: lines[i].trim().slice(0, 120) });
      }
      return hits;
    },
    samples: {
      file: "modules/<domain>/src/widgets/<entity>/audit.ts",
      broken: `export function useWindowedAudit(record: RecordDTO | undefined) {
  const to = new Date().toISOString();
  const forced = { "actorId.equals": record?.holderId, "occurredAt.between": \`\${from},\${to}\` };
  return useCrudList<AuditEventListDTO>(adaptForcedList(useListAuditEvents, forced), {
    stateMode: "server",
  });
}`,
      fixed: `export function useWindowedAudit(record: RecordDTO | undefined) {
  const [openedAt] = useState(() => new Date().toISOString());
  const forced = { "actorId.equals": record?.holderId, "occurredAt.between": \`\${from},\${openedAt}\` };
  return useCrudList<AuditEventListDTO>(adaptForcedList(useListAuditEvents, forced), {
    stateMode: "server",
  });
}`,
      miss: [
        {
          note: "a window already frozen in a memo, with the call on its own line",
          source: `const since = useMemo(
  () => new Date(Date.now() - WINDOW_DAYS * DAY_MS).toISOString(),
  [],
);
const all = useListUserAccessLogs({ "loginAt.greaterThan": since, page: 0, size: 1 });`,
        },
        {
          note: "now read when a press happens rather than during render",
          source: `const submit = () => {
  save({ "closedAt.equals": new Date().toISOString() });
};`,
        },
      ],
    },
  },
  {
    id: "translation-frozen-at-mount",
    invariant: "#70",
    level: "review",
    desc: "A translated sentence resolved once at mount and kept — `useState(t(…))`, `useRef(t(…))`, `useMemo(() => t(…), [])`. `t` answers with the KEY until that namespace's resources have landed, and the first render of a screen is reliably that moment: the stored value stays the literal `<namespace>.<key>` for as long as the screen stands, while every other line on it reads correctly. Keep the KEY in state and call `t` where the sentence is drawn. The one legitimate shape is a seed value for a field the reader then edits",
    appliesTo: (path) => isTsx(path) || /\.ts$/.test(path),
    check: (c) => {
      const hits = [];
      // The compute-once hooks. `useMemo` counts only with an empty dependency list — a memo that
      // re-runs when its inputs move re-runs when the catalogue arrives too, because the render
      // that follows reads it again.
      const opener = /\b(useState|useRef|useMemo)\s*(?:<[^(]*?>)?\s*\(/g;
      let m;
      while ((m = opener.exec(c)) !== null) {
        // The hook's own argument list, read to its matching bracket rather than over a fixed
        // window — a `t(…)` three lines below an unrelated `useState(…)` is a different statement.
        let depth = 1;
        let end = m.index + m[0].length;
        while (end < c.length && depth > 0) {
          if (c[end] === "(") depth += 1;
          else if (c[end] === ")") depth -= 1;
          end += 1;
        }
        if (depth !== 0) continue;
        const args = c.slice(m.index + m[0].length, end - 1);
        if (m[1] === "useMemo" && !/,\s*\[\s*\]\s*$/.test(args.trimEnd())) continue;
        // A translation call, by any of the names this stack binds it to.
        if (!/(^|[^\w.$])(t|tc|tNav|tOr|translate)\s*\(/.test(args)) continue;
        hits.push({
          line: c.slice(0, m.index).split("\n").length,
          excerpt: c.slice(m.index, m.index + 120).split("\n")[0].trim(),
        });
      }
      return hits;
    },
    samples: {
      file: "modules/<domain>/src/widgets/sign-in/panel.tsx",
      broken: `export function Panel() {
  const { t } = useTranslation("<domain>/<namespace>");
  const [arrival] = useState<string | null>(() => refusalKey(window.location.search));
  const [banner, setBanner] = useState<string | null>(arrival ? t(arrival) : null);
  return banner ? <AlertBanner tone="danger" title={banner} /> : null;
}`,
      fixed: `export function Panel() {
  const { t } = useTranslation("<domain>/<namespace>");
  const [arrival] = useState<string | null>(() => refusalKey(window.location.search));
  const [cleared, setCleared] = useState(false);
  const banner = !cleared && arrival ? t(arrival) : null;
  return banner ? <AlertBanner tone="danger" title={banner} /> : null;
}`,
      miss: [
        {
          note: "a memo that re-runs when its inputs move, which the render after the catalogue lands does",
          source: `const label = useMemo(() => t(\`status.\${row.state}\`), [t, row.state]);`,
        },
        {
          note: "the sentence drawn where it is read",
          source: `const [key] = useState(() => refusalKey(window.location.search));
return key ? <AlertBanner title={t(key)} /> : null;`,
        },
        {
          note: "an instant frozen at mount, which carries no translation",
          source: `const [openedAt] = useState(() => new Date().toISOString());`,
        },
      ],
    },
  },
  {
    id: "row-action-that-reads-as-text",
    invariant: "#20 / #77",
    level: "error",
    desc: "An action inside a table cell drawn as a ghost button carrying words. With no border and no glyph it reads as a sentence rather than as something to press, and where two sit side by side — one available and one not — nothing but the tone tells them apart. A row action carries a border and its own glyph; ghost is for an icon-only control, where the glyph is the whole button",
    appliesTo: isTsx,
    check: (c) => {
      const lines = c.split("\n");
      const hits = [];
      for (let i = 0; i < lines.length; i += 1) {
        if (!/variant="ghost"/.test(lines[i])) continue;
        // Inside a table cell rather than in a footer or a toolbar.
        if (!/<TableCell\b/.test(lines.slice(Math.max(0, i - 12), i).join("\n"))) continue;
        const block = lines.slice(Math.max(0, i - 3), i + 7).join("\n");
        // An icon-only control is the case ghost is for.
        if (/size="icon/.test(block)) continue;
        // Words rather than a glyph alone: a translated label, or Korean written straight in.
        if (!/\{t\("[^"]+"\)\}|label=\{|>\s*[가-힣]/.test(block)) continue;
        hits.push({ line: i + 1, excerpt: "ghost row action carrying words" });
      }
      return hits;
    },
    samples: {
      file: "modules/<domain>/src/widgets/<entity>/table.tsx",
      broken: `<TableCell>
  <Button
    variant="ghost"
    size="xs"
    onClick={() => onView(row.key)}
  >
    {t("row.view")}
  </Button>
</TableCell>`,
      fixed: `<TableCell>
  <Button
    variant="outline"
    size="xs"
    onClick={() => onView(row.key)}
  >
    <Icon name="eye" className="size-3.5" />
    {t("row.view")}
  </Button>
</TableCell>`,
      miss: [
        {
          note: "an icon-only control, which is what ghost is for",
          source: `<TableCell>
  <Button
    variant="ghost"
    size="icon-xs"
    aria-label={t("row.view")}
    onClick={() => onView(row.key)}
  >
    <Icon name="eye" />
  </Button>
</TableCell>`,
        },
        {
          note: "a ghost button in a footer, where the surface itself is the border",
          source: `<CrudForm.Actions>
  <Button variant="ghost" size="sm" onClick={onCancel}>
    {t("common.cancel")}
  </Button>
</CrudForm.Actions>`,
        },
      ],
    },
  },
  {
    id: "bounded-table-without-its-border",
    invariant: "#71",
    level: "error",
    desc: "A bounded collection in a panel or a tab — the shapes invariant #71 sends to a bordered card — drawn as a bare `<Table>` standing on the page. The two shapes are how a reader tells a set that is finished from one that accrues: a bordered card says these are all of them, a list with a pager says there are more. A bare table is neither, so the reader cannot tell which they are looking at, and the same kind of content reads differently on adjacent screens. Wrap it in `TableCard`. A table inside a help dialog or a peek is already inside a border and is not this",
    appliesTo: isTsx,
    check: (c) => {
      // Anything drawn inside a dialog already has its border from the dialog.
      if (/<(HelpCard|BoundedDialogContent|DialogContent|PopoverContent|DetailPeekDialog)\b/.test(c)) return [];
      const lines = c.split("\n");
      const hits = [];
      for (let i = 0; i < lines.length; i += 1) {
        if (!/^\s*<Table>\s*$/.test(lines[i])) continue;
        const above = lines.slice(Math.max(0, i - 6), i).join("\n");
        if (/<(TableCard|Card)\b/.test(above)) continue;
        hits.push({ line: i + 1, excerpt: "<Table> with no border of its own" });
      }
      return hits;
    },
    samples: {
      file: "modules/<domain>/src/pages/<entity>/crud-page.tsx",
      broken: `<PageTabPanel value="shifts">
  <Stack gap="md">
    {/* Bounded: a workplace's shift definitions. */}
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("column.shift")}</TableHead>
        </TableRow>
      </TableHeader>
    </Table>
  </Stack>
</PageTabPanel>`,
      fixed: `<PageTabPanel value="shifts">
  <Stack gap="md">
    {/* Bounded: a workplace's shift definitions. */}
    <TableCard>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("column.shift")}</TableHead>
          </TableRow>
        </TableHeader>
      </Table>
    </TableCard>
  </Stack>
</PageTabPanel>`,
      miss: [
        {
          note: "a reference table inside a help dialog, which is already a border",
          source: `export function ScopeReference({ open, onOpenChange }: ScopeReferenceProps) {
  return (
    <HelpCard noticeKey="org.list.scopeReference" open={open} onOpenChange={onOpenChange}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("help.type")}</TableHead>
          </TableRow>
        </TableHeader>
      </Table>
    </HelpCard>
  );
}`,
        },
        {
          note: "a bounded table that already carries its card",
          source: `<TableCard>
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>{t("column.shift")}</TableHead>
      </TableRow>
    </TableHeader>
  </Table>
</TableCard>`,
        },
      ],
    },
  },
  {
    id: "forced-list-keeps-a-stale-page",
    invariant: "#32 / #76",
    level: "error",
    desc: "A list narrowed from outside — a tab, a chip row, a parent record — whose page index survives the narrowing. The page is state the list keeps and the narrowing changes how many pages there are without touching it, so a reader on page 5 of 활성 who presses 정지 asks the server for page 5 of three rows and is handed nothing. The total in the toolbar comes from the same response and is right, so the screen states 「전체 3건」 over an empty table — which reads as a broken list rather than as an empty one, and nothing on the screen contradicts it. Pass `scopeKey` alongside the forced parameters",
    appliesTo: (path) => isTsx(path) || /\.ts$/.test(path),
    check: (c) => {
      if (!/\badaptForcedList\s*\(/.test(c)) return [];
      const hits = [];
      for (const m of c.matchAll(/\badaptForcedList\s*\(/g)) {
        // The options object of the `useCrudList` this feeds — the narrowing and the page state
        // are declared in one call, so the whole thing is inside a few hundred characters.
        const window = c.slice(Math.max(0, m.index - 300), m.index + 900);
        if (/\bscopeKey\b/.test(window)) continue;
        // Not every forced list is paged: one feeding a combobox or an options list has no page
        // to go stale, and those never ask for a `stateMode`.
        if (!/\bstateMode\b/.test(window)) continue;
        hits.push({
          line: c.slice(0, m.index).split("\n").length,
          excerpt: "adaptForcedList feeding a paged list with no scopeKey",
        });
      }
      return hits;
    },
    samples: {
      file: "modules/<domain>/src/widgets/<entity>/list.tsx",
      broken: `export function useThingList(forced: Record<string, unknown>) {
  return useCrudList<ThingListDTO>(adaptForcedList(useListThings, forced), {
    stateMode: "server",
    defaultPageSize: 20,
    filterMode: "deferred",
  });
}`,
      fixed: `export function useThingList(forced: Record<string, unknown>) {
  return useCrudList<ThingListDTO>(adaptForcedList(useListThings, forced), {
    scopeKey: forcedScope(forced),
    stateMode: "server",
    defaultPageSize: 20,
    filterMode: "deferred",
  });
}`,
      miss: [
        {
          note: "a forced read with no page to go stale — a combobox's options",
          source: `export function useThingOptions(ownerId: string) {
  const query = adaptForcedList(useListThings, { "ownerId.equals": ownerId });
  return query({ pagination: { type: "offset", page: 1, limit: 200 } });
}`,
        },
        {
          note: "a paged forced list that already carries its scope",
          source: `export function useThingList(forced: Record<string, unknown>) {
  return useCrudList<ThingListDTO>(adaptForcedList(useListThings, forced), {
    scopeKey: forcedScope(forced),
    stateMode: "server",
    filterMode: "deferred",
  });
}`,
        },
      ],
    },
  },
  {
    id: "optional-select-cannot-be-emptied",
    invariant: "#34 / #75",
    level: "error",
    desc: "A select offers only its options, so a field the form itself declares optional — submitted as `X || undefined` — becomes permanent the moment somebody picks a value. The rank set on the wrong account, the parent chosen for a node that belongs at the top level, the zone type applied to an area that turned out not to be one: each can be changed to another value and never taken off, and the only route back is a column the screen does not offer. The DTO accepts absence and the control cannot produce it. Pass `clearable`, which puts an entry at the top of the list that hands `\"\"` back",
    appliesTo: isTsx,
    check: (c) => {
      // What the submit path declares optional: `X: values.X || undefined`, `X: X || undefined`.
      const optional = new Set();
      for (const m of c.matchAll(/(\w+):\s*(?:[\w.]+\.)?(\w+)\s*\|\|\s*undefined/g)) {
        optional.add(m[1]);
        optional.add(m[2]);
      }
      if (optional.size === 0) return [];
      const hits = [];
      for (const m of c.matchAll(/<(?:FormFields\.)?SelectField\b((?:[^<>]|\{[^{}]*\})*?)\/>/gs)) {
        const el = m[1];
        if (/\brequired\b/.test(el) || /\bclearable\b/.test(el)) continue;
        const value = /value=\{([\w.]+)\}/.exec(el);
        if (!value) continue;
        const field = value[1].split(".").pop();
        if (!optional.has(field)) continue;
        hits.push({
          line: c.slice(0, m.index).split("\n").length,
          excerpt: `SelectField value={${value[1]}} — the submit writes ${field} || undefined`,
        });
      }
      return hits;
    },
    samples: {
      file: "modules/<domain>/src/widgets/<entity>/form.tsx",
      broken: `const submit = () => save({ positionId: values.positionId || undefined });

return (
  <FormFields.SelectField
    label={t("field.position")}
    value={values.positionId}
    onChange={(value) => setField("positionId", value)}
    options={positions}
  />
);`,
      fixed: `const submit = () => save({ positionId: values.positionId || undefined });

return (
  <FormFields.SelectField
    label={t("field.position")}
    clearable
    value={values.positionId}
    onChange={(value) => setField("positionId", value)}
    options={positions}
  />
);`,
      miss: [
        {
          note: "a required select, which has no empty state to return to",
          source: `const submit = () => save({ roleId: values.roleId || undefined });

return (
  <FormFields.SelectField
    label={t("field.role")}
    value={values.roleId}
    onChange={(value) => setField("roleId", value)}
    options={roles}
    required
  />
);`,
        },
        {
          note: "a select whose value the submit path always sends",
          source: `const submit = () => save({ locale: values.locale });

return (
  <FormFields.SelectField
    label={t("field.locale")}
    value={values.locale}
    onChange={(value) => setField("locale", value)}
    options={locales}
  />
);`,
        },
      ],
    },
  },
  {
    id: "chip-filter-equality-field",
    invariant: "#15 / audit: chip filters",
    level: "error",
    desc: "A `ChipFilter`'s field is declared with an equality operator. A chip row narrows to several values at once and writes an ARRAY under that key, so the operator has to be the membership one — `status.in`, never `status.equals`. Under `.equals` the server is handed a comma-joined string it matches nothing against, or refuses outright, and neither side of the mistake can see the other: the caller declares the key as its own string constant and nothing ever compares it with what the component writes, so both halves type-check green while the row silently stops narrowing",
    appliesTo: isTsx,
    // Matched at the constant's declaration rather than at `field={...}`, because every call site
    // passes a constant and the string is nowhere near the tag. The filter is what keeps this from
    // firing on the many other filter keys a screen declares: only a constant this file actually
    // hands to a ChipFilter is a chip's field.
    check: (c) =>
      lineHits(
        c,
        /^\s*const\s+[A-Za-z_$][\w$]*\s*=\s*["'][^"']+\.equals["']\s*;/,
        (line, lines) => {
          const name = line.match(/const\s+([A-Za-z_$][\w$]*)/)?.[1];
          if (!name) return false;
          const whole = lines.join("\n");
          return whole.includes("<ChipFilter") && whole.includes(`field={${name}}`);
        },
      ),
    samples: {
      file: "modules/<domain>/src/pages/<entity>/crud-page.tsx",
      broken: `const SCOPE_FIELD = "orgScope.equals";

export function Page() {
  const filters = useFilterBarState();
  return <ChipFilter field={SCOPE_FIELD} state={filters} options={options} />;
}`,
      fixed: `const SCOPE_FIELD = "orgScope.in";

export function Page() {
  const filters = useFilterBarState();
  return <ChipFilter field={SCOPE_FIELD} state={filters} options={options} />;
}`,
      miss: [
        {
          note: "an equality key this file declares for something other than a chip row is right as it is",
          source: `const SITE_FIELD = "siteId.equals";
const SCOPE_FIELD = "orgScope.in";

export function Page() {
  const list = useCrudList(adaptForcedList(useListThings, { [SITE_FIELD]: siteId }));
  return <ChipFilter field={SCOPE_FIELD} state={list.filters} options={options} />;
}`,
        },
        {
          note: "a screen with no chip row at all",
          source: `const SCOPE_FIELD = "orgScope.equals";

export function Page() {
  const list = useCrudList(adaptForcedList(useListThings, { [SCOPE_FIELD]: scope }));
  return <CrudList list={list} />;
}`,
        },
      ],
    },
  },
  {
    id: "hand-rolled-detail-footer",
    invariant: "#31 / audit: page chrome",
    level: "error",
    desc: "CrudDetail footer built from raw layout instead of CrudDetail.DefaultActions / CrudDetail.ActionFooter — the panel's buttons drift in size, order and spacing from every other panel, and domain actions that should stay visible-but-disabled get hidden instead",
    appliesTo: isTsx,
    check: (c) =>
      blockHits(c, /footer=\{\s*\n\s*<(?!CrudDetail)(?:Stack|Flex|div|Box)\b/g),
    samples: {
      file: "modules/site/src/widgets/area/detail.tsx",
      broken: `<CrudDetail
  header={<Heading level={4}>{displayData.name}</Heading>}
  footer={
    <Flex gap="sm" justify="end">
      <Button variant="outline" onClick={onClose}>{t("common.close")}</Button>
      <Button variant="primary" onClick={onEdit}>{t("common.edit")}</Button>
    </Flex>
  }
>
  <CrudDetail.Section title={t("area.section")} variant="flat" />
</CrudDetail>`,
      fixed: `<CrudDetail
  header={<Heading level={4}>{displayData.name}</Heading>}
  footer={
    <CrudDetail.DefaultActions onClose={onClose} onEdit={onEdit} onDelete={del.requestDelete} isPending={del.isPending} />
  }
>
  <CrudDetail.Section title={t("area.section")} variant="flat" />
</CrudDetail>`,
      miss: [
        {
          note: "a form's own sanctioned footer component, which is not a CrudDetail one",
          file: "modules/site/src/widgets/area/form.tsx",
          source: `<CrudForm
  onSubmit={handleSubmit}
  footer={
    <CrudForm.Actions spread={!!onBack}>
      <Button type="submit" variant="primary">{t("area.save")}</Button>
    </CrudForm.Actions>
  }
/>`,
        },
      ],
    },
  },
  {
    id: "wrapping-value-in-fixed-row",
    invariant: "audit: layout",
    level: "error",
    desc: "DetailListRow given a trailing value that wraps — the row is a fixed-height line (h-10), so a second line of chips or badges leaves the row's box and crosses the card's border. A set that can wrap is a block: put it under the list with its own label, not in a row",
    appliesTo: isTsx,
    // Bounded to ONE element: a lazy span would run past this row's `/>` and pair the first
    // DetailListRow on the screen with a `wrap` belonging to something else entirely.
    check: (c) =>
      blockHits(c, /<DetailListRow\b(?:(?!<DetailListRow|\/>)[^])*?trailing=\{(?:(?!<DetailListRow|\/>)[^])*?\bwrap\b(?:(?!<DetailListRow)[^])*?\/>/g),
    samples: {
      file: "modules/site/src/widgets/area/detail.tsx",
      broken: `<DetailList>
  <DetailListRow
    primary={fieldLabel("tags")}
    trailing={
      <Flex gap="xs" wrap>
        {displayData.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}
      </Flex>
    }
  />
</DetailList>`,
      fixed: `<Stack gap="xs">
  <Text variant="caption" tone="muted">{fieldLabel("tags")}</Text>
  <Flex gap="xs" wrap>
    {displayData.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}
  </Flex>
</Stack>`,
      miss: [
        {
          note: "a row whose trailing is one badge, with a wrapping set below it as its own block",
          source: `<DetailList>
  <DetailListRow primary={fieldLabel("status")} trailing={<StatusBadge tone="success" />} />
</DetailList>
<Flex gap="xs" wrap>
  {displayData.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}
</Flex>`,
        },
      ],
    },
  },
  {
    id: "scope-filter-empty-state",
    invariant: "#32 / audit: empty state",
    level: "error",
    desc: "List sets defaultFilters but passes list.emptyReason straight through — a screen-forced scope counts as a filter, so an empty result tells the reader their filters matched nothing when they applied none, and offers to clear a scope the screen is supposed to hold",
    appliesTo: isTsx,
    check: (c) =>
      c.includes("defaultFilters")
        ? lineHits(c, /emptyReason=\{list\.emptyReason\}|list\.emptyReason\s*!==\s*"no-data"/)
        : [],
    samples: {
      file: "modules/site/src/widgets/area/list.tsx",
      broken: `const list = useCrudList({
  defaultFilters: { siteId },
});

return <CrudList.Table list={list} emptyReason={list.emptyReason} />;`,
      fixed: `const list = useCrudList({
  defaultFilters: { siteId },
});

// The site is forced by the screen, so an empty result is "no rows here", never
// "your filters matched nothing" — the reader applied none and can clear none.
const emptyReason = list.userFilterCount > 0 ? list.emptyReason : "no-data";

return <CrudList.Table list={list} emptyReason={emptyReason} />;`,
      miss: [
        {
          note: "a list with no screen-forced scope — every filter in it is one the reader applied",
          source: `const list = useCrudList({});

return <CrudList.Table list={list} emptyReason={list.emptyReason} />;`,
        },
      ],
    },
  },
  {
    id: "unknown-enum-name",
    invariant: "#10 / audit: enum labels",
    level: "error",
    desc: "Enum name has no generated model of that name — the label lookup misses and the screen prints the raw `Enum.VALUE` key instead of a translated word",
    appliesTo: isTsx,
    check: (c) =>
      lineHits(c, /(?:enumName=|enumLabel\()\s*"([A-Z]\w+)"/g, (line) => {
        const known = generatedEnumNames();
        if (known.size === 0) return false;
        const names = [...line.matchAll(/(?:enumName=|enumLabel\()\s*"([A-Z]\w+)"/g)].map((m) => m[1]);
        return names.some((n) => !known.has(n));
      }),
    samples: (() => {
      // The generated enum, as Orval writes it — both the const and the type alias, because the
      // index reads either shape.
      const codegen = {
        "packages/domain-site/src/generated/model/areaStatus.ts": `export const AreaStatus = {
  ACTIVE: "ACTIVE",
  CLOSED: "CLOSED",
} as const;

export type AreaStatus = (typeof AreaStatus)[keyof typeof AreaStatus];
`,
      };
      return {
        file: "modules/site/src/widgets/area/list.tsx",
        broken: {
          files: codegen,
          source: `<CrudList.Column field="status">
  {(row) => enumLabel("AreaState", resolveBootEnum(row.status))}
</CrudList.Column>`,
        },
        fixed: {
          files: codegen,
          source: `<CrudList.Column field="status">
  {(row) => enumLabel("AreaStatus", resolveBootEnum(row.status))}
</CrudList.Column>`,
        },
        miss: [
          {
            note: "the enumName= call shape, spelt with a name the codegen does publish",
            files: codegen,
            source: `<DetailEnumField enumName="AreaStatus" value={resolveBootEnum(displayData.status)} />`,
          },
          {
            note: "a project with no codegen output — an unread contract is not evidence of a wrong name",
            source: `{enumLabel("AreaState", resolveBootEnum(row.status))}`,
          },
        ],
      };
    })(),
  },
  {
    id: "translator-options-arg",
    invariant: "#44 / audit: scaffold locale",
    level: "error",
    desc: "t() is handed translator OPTIONS where it takes interpolation VALUES — the framework translator's second argument is `Record<string, string|number>` and has no options, so `{ defaultValue: x }` matches no placeholder, is dropped, and a missing entry prints the key itself (`auditEvent.entityType.LicenseSeat` on the screen). Look the key up first (`exists(key) ? t(key) : fallback`) or route it through the project's falling-back translator helper",
    appliesTo: (p) => (inModules(p) || inApps(p) || inPackages(p)) && isTsx(p),
    check: (c) => {
      // Only the option names no author would ever use as an interpolation placeholder.
      // `count`, `name`, `context` and friends are legitimate values and stay unflagged.
      const OPTIONS = "defaultValue|returnObjects|keySeparator|nsSeparator|fallbackLng|skipInterpolation";
      // The key is a quoted string OR a template literal, and the template is the half that
      // matters: the call most tempted by `defaultValue` is the one whose key is built from a
      // server value, and such a key routinely carries a quoted fallback inside its own
      // interpolation (`judgement.effect.${input.effect ?? "unknown"}`). A key pattern that
      // forbade inner quotes let exactly those through, which is every call this rule exists for.
      const KEY = "`[^`]*`|'[^']*'|\"[^\"]*\"";
      const hits = [];
      for (const alias of translatorBindings(c).keys()) {
        hits.push(
          ...blockHits(
            c,
            new RegExp(
              `\\b${alias}\\(\\s*(?:${KEY})\\s*,\\s*\\{[^{}]*\\b(?:${OPTIONS})\\b`,
              "g",
            ),
          ),
        );
      }
      return hits;
    },
    samples: {
      file: "modules/audit/src/widgets/audit-event/list.tsx",
      // A key built from a server value, carrying a quoted fallback inside its own interpolation.
      // This is the shape the rule exists for and the shape a key pattern forbidding inner quotes
      // silently let through, so it is the one the proof is taken on.
      broken: `const { t } = useTranslation("audit/widgets");

<CrudList.Column field="entityType">
  {(row) => t(\`auditEvent.entityType.\${row.entityType ?? "unknown"}\`, {
    defaultValue: row.entityType ?? "",
  })}
</CrudList.Column>`,
      fixed: `const { tOr } = useOptionalTranslation("audit/widgets");

<CrudList.Column field="entityType">
  {(row) => tOr(\`auditEvent.entityType.\${row.entityType ?? "unknown"}\`, row.entityType ?? "")}
</CrudList.Column>`,
      miss: [
        {
          note: "an ordinary interpolation value — the second argument is what it is for",
          source: `const { t } = useTranslation("audit/widgets");

<Text>{t("auditEvent.total", { count: rows.length })}</Text>`,
        },
        {
          note: "a name whose word happens to be a value the sentence interpolates",
          source: `const { t } = useTranslation("audit/widgets");

<Text>{t("auditEvent.actedBy", { name: row.actorName, context: row.channel })}</Text>`,
        },
      ],
    },
  },
  {
    id: "missing-translation-key",
    invariant: "audit: scaffold locale",
    level: "error",
    desc: "A key its namespace's catalogue does not define, whether named in `t(\"…\")` or handed to a helper alongside the translator — i18next falls back to printing the key, so the screen shows `product.selfServeHint` where the sentence should be and nothing errors",
    // An app's own screens are checked as well as a module's. Scoping this to `modules/` left every
    // hand-written app screen unread, and a deployable's error and empty-state pages are exactly
    // the screens written by hand and seen least often: two apps were printing ten raw `error.*`
    // keys apiece on their access-denied page, the same message a third app had already fixed.
    appliesTo: (p) => (inModules(p) || inApps(p)) && isTsx(p),
    check: (c, file) => {
      const binds = translatorBindings(c);
      if (binds.size === 0) return [];
      const hits = [];
      for (const [alias, ns] of binds) {
        const keys = localeKeys(ns, file);
        if (!keys) continue;
        const call = new RegExp(`\\b${alias}\\(\\s*"([a-zA-Z0-9_.]+)"`, "g");
        // A key handed to a helper is still a key. `countedFigure(t, value, "unit.accountCount")`
        // never writes `t("…")`, so a reader watching only for the translator's own call sees
        // nothing — and that is how a tile came to print `tile.unitAccount` on a screen until a
        // person noticed. The translator being passed as an argument is what marks the string
        // arguments beside it: a call that hands `t` to something is handing it keys.
        const viaHelper = new RegExp(
          `\\b[A-Za-z_$][\\w$]*\\(\\s*${alias}\\s*,[^)]*?"([a-zA-Z0-9_.]+\\.[a-zA-Z0-9_.]+)"`,
          "g",
        );
        for (const pattern of [call, viaHelper]) {
          hits.push(
            ...lineHits(c, pattern, (line) => {
              pattern.lastIndex = 0;
              return [...line.matchAll(pattern)].some((m) => !keys.has(m[1]));
            }),
          );
        }
      }
      return hits;
    },
    samples: (() => {
      const widgets = {
        "modules/site/src/locales/widgets/ko.json": `{
  "area": { "title": "구역", "status": "상태" }
}
`,
      };
      // Two deployables each shipping a `common`, the one that sorts FIRST carrying the key and the
      // one under test lacking it. Resolving a bare namespace by directory order answers the second
      // app with the first app's catalogue and calls it clean, which is how two apps came to print
      // ten raw `error.*` keys each while the audit was green. The broken sample is built this way
      // so that a resolution which reads the wrong app cannot pass it.
      const twoApps = (secondHasKey) => ({
        "apps/a-first/src/locales/common/ko.json": `{
  "error": { "accessDenied": "권한이 없습니다", "goHome": "홈으로" }
}
`,
        "apps/z-second/src/locales/common/ko.json": `{
  "error": ${secondHasKey ? `{ "accessDenied": "권한이 없습니다", "goHome": "홈으로" }` : `{ "accessDenied": "권한이 없습니다" }`}
}
`,
      });
      return {
        file: "modules/site/src/widgets/area/list.tsx",
        broken: {
          file: "apps/z-second/src/widgets/error/error-pages.tsx",
          files: twoApps(false),
          source: `const { t } = useTranslation("common");

return <ErrorPageLayout action={t("error.goHome")} />;`,
        },
        fixed: {
          files: widgets,
          source: `const { t } = useTranslation("site/widgets");

return <EmptyState title={t("area.title")} />;`,
        },
        miss: [
          {
            note: "the app under test owns the key while the app that sorts first does not — the owning catalogue answers, not the one directory order reaches",
            file: "apps/z-second/src/widgets/error/error-pages.tsx",
            files: {
              "apps/a-first/src/locales/common/ko.json": `{
  "error": { "accessDenied": "권한이 없습니다" }
}
`,
              "apps/z-second/src/locales/common/ko.json": `{
  "error": { "accessDenied": "권한이 없습니다", "goHome": "홈으로" }
}
`,
            },
            source: `const { t } = useTranslation("common");

return <ErrorPageLayout action={t("error.goHome")} />;`,
          },
          {
            note: "a namespace this repository does not own — an absent catalogue is not an empty one",
            source: `const { t } = useTranslation("framework/ui");

return <Button>{t("common.retry")}</Button>;`,
          },
          {
            note: "two translators in one file, each key resolving in its own catalogue",
            files: {
              ...widgets,
              "modules/site/src/locales/features/ko.json": `{
  "assignment": { "hint": "담당자를 지정하세요" }
}
`,
            },
            source: `const { t } = useTranslation("site/widgets");
const { t: tFeatures } = useTranslation("site/features");

return (
  <Stack>
    <Heading>{t("area.title")}</Heading>
    <Text>{tFeatures("assignment.hint")}</Text>
  </Stack>
);`,
          },
        ],
      };
    })(),
  },
  {
    id: "dropped-interpolation",
    invariant: "audit: scaffold locale",
    level: "error",
    desc: "t() passes a value the catalogue entry has no `{{placeholder}}` for — i18next drops it in silence, so the sentence reaches the screen with the word missing and reads as finished. Nothing errors: no console warning, no type error, a green build. Either add the placeholder to the entry in every language, or drop the value the sentence does not want",
    appliesTo: (p) => (inModules(p) || inApps(p) || inPackages(p)) && /\.tsx?$/.test(p),
    check: (c, file) => {
      const binds = translatorNamespaces(c, file);
      if (binds.size === 0) return [];
      const hits = [];
      for (const [alias, ns] of binds) {
        const dirs = catalogueDirsFor(ns, file);
        if (!dirs.length) continue;
        // A quoted key only. A key built in a template literal cannot be resolved without running
        // the component, and guessing at one would report calls whose entry is perfectly correct.
        const call = new RegExp(`\\b${alias}\\(\\s*"([a-zA-Z0-9_.\\-]+)"\\s*,\\s*\\{`, "g");
        for (const m of c.matchAll(call)) {
          const key = m[1];
          const { names } = objectLiteralProperties(c, m.index + m[0].length - 1);
          const values = [...new Set(names.filter((n) => !isReservedTranslationOption(n)))];
          if (!values.length) continue;
          let defined = false;
          const missing = new Map();
          for (const dir of dirs) {
            for (const [lang, entries] of catalogueLanguages(dir)) {
              const text = entries.get(key);
              // A language whose catalogue does not carry the key at all is a different defect and
              // `missing-translation-key` owns it. Reporting it here would name every untranslated
              // language on a call whose own language is right.
              if (text === undefined) continue;
              defined = true;
              for (const value of values) {
                if (new RegExp(`\\{\\{\\s*${value}\\b`).test(text)) continue;
                if (!missing.has(value)) missing.set(value, []);
                missing.get(value).push(`${path.relative(ROOT, dir).split(path.sep).join("/")}/${lang}`);
              }
            }
          }
          if (!defined) continue;
          for (const value of values) {
            if (!missing.has(value)) continue;
            hits.push({
              line: lineOfIndex(c, m.index),
              excerpt: `t("${key}", { ${value} }) — no {{${value}}} in ${missing.get(value).join(", ")}`,
            });
          }
        }
      }
      return hits;
    },
    samples: (() => {
      // Two languages, because a value carried in one and dropped in the other is the same defect
      // and is the half a single-language check calls clean.
      const catalogue = (koHasPlaceholder, enHasPlaceholder) => ({
        "modules/site/src/locales/index.ts": `export const PACKAGE_NAMESPACE = "site";\n`,
        "modules/site/src/locales/widgets/ko.json": `{
  "area": {
    "moved": ${JSON.stringify(koHasPlaceholder ? "{{name}} 구역을 옮겼습니다." : "구역을 옮겼습니다.")},
    "total": "구역 {{count}}개"
  }
}
`,
        "modules/site/src/locales/widgets/en.json": `{
  "area": {
    "moved": ${JSON.stringify(enHasPlaceholder ? "Moved {{name}}." : "Area moved.")},
    "total": "{{count}} areas"
  }
}
`,
      });
      return {
        file: "modules/site/src/widgets/area/detail.tsx",
        broken: {
          files: catalogue(false, false),
          source: `const { t } = useTranslation("site/widgets");

addToast({ message: t("area.moved", { name }) });`,
        },
        fixed: {
          files: catalogue(true, true),
          source: `const { t } = useTranslation("site/widgets");

addToast({ message: t("area.moved", { name }) });`,
        },
        miss: [
          {
            note: "count selects a plural form and is legitimately absent from the sentence",
            files: catalogue(true, true),
            source: `const { t } = useTranslation("site/widgets");

<Text>{t("area.total", { count: rows.length })}</Text>`,
          },
          {
            note: "a ternary value — the old scanner read ` fallback :` as a second property name",
            files: catalogue(true, true),
            source: `const { t } = useTranslation("site/widgets");

addToast({ message: t("area.moved", { name: row.name ? row.name : fallback }) });`,
          },
          {
            note: "a namespace this repository does not own — an absent catalogue is not an empty one",
            source: `const { t } = useTranslation("framework/ui");

<Button>{t("common.retry", { label })}</Button>;`,
          },
          {
            note: "a key no catalogue defines — missing-translation-key owns that, and reporting it here would name it twice",
            files: catalogue(true, true),
            source: `const { t } = useTranslation("site/widgets");

<Text>{t("area.selfServeHint", { name })}</Text>;`,
          },
          {
            note: "a key built in a template literal cannot be resolved without running the component",
            files: catalogue(false, false),
            source: `const { t } = useTranslation("site/widgets");

<Text>{t(\`area.\${row.state}\`, { name })}</Text>;`,
          },
        ],
      };
    })(),
  },
  {
    id: "write-only-form-field",
    invariant: "#34 / audit: page chrome",
    level: "review",
    desc: "Form edits a field its sibling detail never renders — the operator can set the value but has to reopen the form to see what it is, so the read surface stops being an answer to \"how does this record stand?\"",
    appliesTo: (p) => inModules(p) && /\/widgets\/[^/]+\/form\.tsx$/.test(p),
    check: (c, rel) => {
      const detail = path.join(ROOT, path.dirname(rel), "detail.tsx");
      if (!fs.existsSync(detail)) return [];
      const ds = fs.readFileSync(detail, "utf8");
      // A helper handed the whole record names the field against its own parameter, so the
      // delegated sources are searched for the bare name rather than for `displayData.<field>`.
      const delegated = delegatedDetailSources(ds);
      return lineHits(c, /updateField\(\s*"(\w+)"/, (line) => {
        const m = /updateField\(\s*"(\w+)"/.exec(line);
        if (!m) return false;
        // A locale map is edited under its own name and read back under the base field the
        // server resolves it into, so the detail is searched for the base.
        const f = m[1].replace(/I18n$/, "");
        // A credential is write-only on purpose, and a foreign key is the relation the detail
        // renders by name rather than by id — neither is a missing read.
        if (/^(password|secret|token|.*Secret|.*Password)$/i.test(f) || /Ids?$/.test(f)) return false;
        if (new RegExp(`displayData\\.${f}\\b|fieldLabel\\("${f}"\\)`).test(ds)) return false;
        return !new RegExp(`\\b${f}\\b`).test(delegated);
      });
    },
    samples: {
      file: "modules/site/src/widgets/area/form.tsx",
      broken: {
        files: {
          "modules/site/src/widgets/area/detail.tsx": `<DetailFields.DetailTextField label={fieldLabel("name")} value={displayData.name} />`,
        },
        source: `<FormFields.TextareaField
  label={fieldLabel("memo")}
  value={values.memo ?? ""}
  onChange={(v) => updateField("memo", v)}
/>`,
      },
      fixed: {
        files: {
          "modules/site/src/widgets/area/detail.tsx": `<DetailFields.DetailTextField label={fieldLabel("name")} value={displayData.name} />
<DetailFields.DetailTextField label={fieldLabel("memo")} value={displayData.memo} />`,
        },
        source: `<FormFields.TextareaField
  label={fieldLabel("memo")}
  value={values.memo ?? ""}
  onChange={(v) => updateField("memo", v)}
/>`,
      },
      miss: [
        {
          note: "a credential is write-only on purpose",
          files: {
            "modules/site/src/widgets/area/detail.tsx": `<DetailFields.DetailTextField label={fieldLabel("name")} value={displayData.name} />`,
          },
          source: `<FormFields.PasswordField
  label={fieldLabel("password")}
  value={values.password ?? ""}
  onChange={(v) => updateField("password", v)}
/>`,
        },
        {
          note: "a foreign key the detail renders by name rather than by id",
          files: {
            "modules/site/src/widgets/area/detail.tsx": `<DetailFields.DetailTextField label={fieldLabel("owner")} value={displayData.owner?.name} />`,
          },
          source: `<EntityCombobox
  label={fieldLabel("owner")}
  value={values.ownerId}
  onChange={(v) => updateField("ownerId", v)}
/>`,
        },
        {
          note: "a locale map edited under its own name and read back under the base field",
          files: {
            "modules/site/src/widgets/area/detail.tsx": `<DetailFields.DetailTextField label={fieldLabel("name")} value={displayData.name} />`,
          },
          source: `<FormFields.I18nTextField
  label={fieldLabel("name")}
  value={values.nameI18n}
  onChange={(v) => updateField("nameI18n", v)}
/>`,
        },
        {
          note: "a detail that hands the whole record to a shared formatter, which is where the field is read",
          files: {
            "modules/site/src/widgets/area/detail.tsx": `import { renderAreaSummary } from "@acme/site-ui";

<DetailFieldWrapper label={fieldLabel("summary")}>
  <Text>{renderAreaSummary(displayData)}</Text>
</DetailFieldWrapper>`,
            "packages/site-ui/src/summary.ts": `export function renderAreaSummary(record: AreaDetailDTO) {
  return [record.name, record.memo].filter(Boolean).join(" · ");
}
`,
          },
          source: `<FormFields.TextareaField
  label={fieldLabel("memo")}
  value={values.memo ?? ""}
  onChange={(v) => updateField("memo", v)}
/>`,
        },
      ],
    },
  },
  {
    id: "unresolved-boot-enum-label",
    invariant: "#10 / #36",
    level: "error",
    desc: "enumLabel() called on a DTO field straight from the row — a boot enum arrives as an object, so the key becomes `Enum.[object Object]` and the screen prints the key",
    appliesTo: isTsx,
    check: (c) =>
      // A file with no server data in it cannot be holding a boot enum, however it names its
      // variables — see `readsServerData`.
      readsServerData(c)
        ? lineHits(
            c,
            /enumLabel\(\s*"[^"]+"\s*,\s*(?:String\(\s*)?(?:displayData|row|values)\.\w+/,
            (line) => !line.includes("resolveBootEnum"),
          )
        : [],
    samples: {
      file: "modules/site/src/widgets/area/list.tsx",
      broken: `import { useListAreas } from "@acme/domain-site";

<CrudList.Column field="status">
  {(row) => enumLabel("AreaStatus", row.status)}
</CrudList.Column>`,
      fixed: `import { useListAreas } from "@acme/domain-site";

<CrudList.Column field="status">
  {(row) => enumLabel("AreaStatus", resolveBootEnum(row.status) ?? "")}
</CrudList.Column>`,
      miss: [
        {
          note: "a static reference table that binds `row` too — no server value can be in scope",
          source: `const ROWS = [
  { status: "ACTIVE" },
  { status: "CLOSED" },
];

{ROWS.map((row) => enumLabel("AreaStatus", row.status))}`,
        },
      ],
    },
  },
  {
    id: "phantom-projection-read",
    invariant: "audit: generated contract",
    level: "error",
    desc: "Widget reads a nested object its entity's generated projection does not carry — every row falls through to the `??` branch, so the screen shows a raw id and nobody sees an error",
    appliesTo: (p) => inModules(p) && /\/widgets\/[^/]+\/(detail|list|form)\.tsx$/.test(p),
    check: (c, rel) => {
      const own = projectionProps(rel);
      if (!own) return [];
      // A panel routinely embeds a list of ANOTHER entity — a grant table inside an account's
      // detail — and inside that column's render `row` is the other entity's row. So every DTO
      // this file names as a generic argument contributes its own projection; a property that is
      // on none of them is still phantom, and one that is on the embedded entity is not.
      const props = new Set(own);
      const index = modelIndex();
      for (const m of c.matchAll(/<\s*(\w+DTO)\s*>/g)) {
        const model = index.get(m[1][0].toLowerCase() + m[1].slice(1));
        if (model) for (const prop of model) props.add(prop);
      }
      return lineHits(c, /(?:displayData|row)\.(\w+)\?\./, (line) => {
        for (const m of line.matchAll(/(?:displayData|row)\.(\w+)\?\./g)) {
          if (!props.has(m[1])) return true;
        }
        return false;
      });
    },
    samples: (() => {
      const projection = {
        "packages/domain-site/src/generated/model/areaDetailDTO.ts": `import type { SiteRefDTO } from "./siteRefDTO";

export interface AreaDetailDTO {
  areaId?: string;
  name?: string;
  site?: SiteRefDTO;
}
`,
      };
      return {
        file: "modules/site/src/widgets/area/detail.tsx",
        broken: {
          files: projection,
          source: `<DetailFields.DetailTextField
  label={fieldLabel("building")}
  value={displayData.building?.name ?? displayData.buildingId}
/>`,
        },
        fixed: {
          files: projection,
          source: `<DetailFields.DetailTextField
  label={fieldLabel("site")}
  value={displayData.site?.name ?? "-"}
/>`,
        },
        miss: [
          {
            note: "an entity whose projection this project has not generated — an unknown contract is not a defect",
            source: `<DetailFields.DetailTextField value={displayData.building?.name ?? displayData.buildingId} />`,
          },
        ],
      };
    })(),
  },
  {
    id: "raw-layout-div",
    invariant: "#8",
    level: "error",
    desc: 'Raw layout <div> without a {/* raw layout: <reason> */} justification — use Flex/Stack/Grid',
    appliesTo: isTsx,
    check: (c) =>
      lineHits(
        c,
        /<div className="[^"]*\b(flex|grid|space-y-|space-x-|mx-auto|items-|justify-)/,
        (_line, lines, i) =>
          !lines.slice(Math.max(0, i - 2), i + 1).some((l) => l.includes("raw layout:")),
      ),
    samples: {
      file: "modules/site/src/widgets/area/detail.tsx",
      broken: `<div className="flex items-center gap-2">
  <StatusBadge tone="success" />
  <Text>{displayData.name}</Text>
</div>`,
      fixed: `<Flex align="center" gap="sm">
  <StatusBadge tone="success" />
  <Text>{displayData.name}</Text>
</Flex>`,
      miss: [
        {
          note: "a justified raw layout — the reason stands on the two lines above it",
          source: `{/* raw layout: the canvas measures this element's box, so it cannot be a Flex */}
<div className="flex items-center gap-2" ref={canvasBox}>
  <Handle />
</div>`,
        },
        {
          note: "a div carrying no layout utility at all",
          source: `<div className="text-sm text-muted-foreground">{displayData.name}</div>`,
        },
      ],
    },
  },
  {
    id: "unnamed-icon-button",
    invariant: "audit: accessible name on icon-only controls",
    level: "error",
    desc: "Control with nothing to announce — its children are bare marks, or it has no children at all, and it carries no aria-label, aria-labelledby, title, or sr-only text. Assistive technology reads it as an unlabelled button. A tooltip does not fix this: Radix describes an open tooltip's trigger, it never names it. Add aria-label with the same word the tooltip carries",
    appliesTo: isTsx,
    // Structural, not textual: the shape being judged is "what does this control CONTAIN", and the
    // markup that produces it varies far more than a pattern can enumerate — a raw <svg> instead of
    // an icon component, a <span role="button"> instead of a <button>, a design-system component
    // whose only cue is a tooltip, a control with no children at all. Each of those is the same
    // defect and none of them look alike in source.
    //
    // Known gaps, deliberately left uncaught rather than guessed at:
    //   · children that arrive through an expression — <Button>{icon}</Button>, <Button>{children}</Button>.
    //     What renders is not in this file.
    //   · a tag that spreads props ({...props}). The name may arrive from the caller, so a component
    //     definition is not evidence of a defect at its own definition site.
    //   · a mark component whose name ends in none of MARK_COMPONENT's words. It is read as content,
    //     which is the safe direction — a missed defect, never a false accusation.
    //   · an icon-only control assembled across files, where the wrapper renders <button> and the
    //     caller passes the mark.
    check: (c) => {
      const hits = [];
      for (const m of c.matchAll(/<([A-Za-z][\w.]*)[\s>]/g)) {
        const name = m[1];
        const { tag, end } = jsxOpenTag(c, m.index);
        const attrs = tagAttrs(tag);
        // A declared control — its name or its role says a screen reader will announce it as one.
        const declared =
          /(?:^|\.)(?:button|\w*Button|\w*Trigger|\w*Toggle|\w*Close)$/.test(name) ||
          /\brole=(?:"button"|'button'|\{"button"\})/.test(attrs);
        // A handler alone makes something clickable but says nothing about what it is; an empty one
        // is as likely an overlay or a canvas as a control, so only a mark-only body counts there.
        if (!declared && !/\bonClick=/.test(attrs)) continue;
        if (/\baria-label[=\s]|\baria-labelledby\b|\btitle=/.test(attrs)) continue;
        // A `label` prop is a name only where something can turn it into one. On a host element it
        // is inert markup; on a component it is the ordinary way this design system passes the word
        // an icon-only control announces.
        if (/^[A-Z]/.test(name) && /\blabel=/.test(attrs)) continue;
        const children = /\/>$/.test(tag) ? "" : jsxChildren(c, name, end);
        if (children === null) continue;
        const content = childContent(children);
        // Nothing at all inside is evidence only for a host element, and only when nothing arrives
        // from outside either. `<FieldClearButton label={…} />` is empty here and full on screen —
        // a component renders its own children — and a forwarder writes `<button {...props} />`
        // where both the name and the children come from its caller. A body of bare marks is
        // evidence regardless: no spread turns a mark into a word, and the spreads that reach a
        // control this way (drag listeners, Radix slot props) carry description, never a name.
        const bare =
          content === "empty" && declared && /^[a-z]/.test(name) && !/\{\.\.\./.test(attrs);
        if (content !== "marks" && !bare) continue;
        hits.push({
          line: lineOfIndex(c, m.index),
          excerpt: `<${name}> ${attrs.replace(/\s+/g, " ").slice(0, 100)}`,
        });
      }
      return hits;
    },
    samples: {
      file: "modules/site/src/widgets/area/list.tsx",
      broken: `<button type="button" onClick={() => del.requestDelete(row)}>
  <TrashIcon className="size-4" />
</button>`,
      fixed: `<button type="button" aria-label={t("common.delete")} onClick={() => del.requestDelete(row)}>
  <TrashIcon className="size-4" />
</button>`,
      miss: [
        {
          note: "hidden label text beside the mark",
          source: `<button type="button" onClick={() => del.requestDelete(row)}>
  <TrashIcon className="size-4" />
  <span className="sr-only">{t("common.delete")}</span>
</button>`,
        },
        {
          note: "a mark leading a button that also says a word",
          source: `<Button variant="primary" onClick={onSave}>
  <SaveIcon className="size-4" />
  {t("common.save")}
</Button>`,
        },
        {
          note: "a design-system control handed the word through its own label prop",
          source: `<IconButton label={t("common.delete")} onClick={() => del.requestDelete(row)}>
  <TrashIcon className="size-4" />
</IconButton>`,
        },
        {
          note: "a forwarder — both the name and the children arrive from its caller",
          source: `const FieldClearButton = forwardRef((props, ref) => <button {...props} ref={ref} />);`,
        },
        {
          note: "a title attribute names it too",
          source: `<button type="button" title={t("common.delete")} onClick={onDelete}>
  <TrashIcon className="size-4" />
</button>`,
        },
        {
          note: "a clickable surface that is not a control and carries its own words",
          source: `<Card onClick={() => onSelect(row.id)}>
  <Text>{row.name}</Text>
</Card>`,
        },
      ],
    },
  },
  {
    id: "jsx-child-line-comment",
    invariant: "audit: comments in JSX children render as text",
    level: "error",
    desc: "A `//` line comment sitting between an opening JSX tag and its children is not a comment — JSX treats it as a text child, so the comment paints on screen and becomes part of the element's accessible content. Move it above the opening tag, or write it as {/* ... */}",
    appliesTo: isTsx,
    check: (c) => {
      const lines = c.split("\n");
      const hits = [];
      for (let i = 0; i < lines.length; i++) {
        if (!/^\s*\/\//.test(lines[i])) continue;
        // The nearest real code above: an opening JSX tag ends with `>` but is
        // neither self-closing nor an arrow head.
        let prev = i - 1;
        while (prev >= 0 && (lines[prev].trim() === "" || /^\s*\/\//.test(lines[prev]))) prev--;
        if (prev < 0) continue;
        const before = lines[prev].trimEnd();
        if (!/>$/.test(before) || /\/>$/.test(before) || /=>$/.test(before)) continue;
        // And the nearest real code below opens or closes a tag, so the comment
        // is genuinely in child position rather than trailing a call argument.
        let next = i + 1;
        while (next < lines.length && (lines[next].trim() === "" || /^\s*\/\//.test(lines[next]))) next++;
        if (next >= lines.length || !/^\s*</.test(lines[next])) continue;
        hits.push({ line: i + 1, excerpt: lines[i].trim().slice(0, 140) });
      }
      return hits;
    },
    samples: {
      file: "modules/site/src/widgets/area/detail.tsx",
      broken: `<Stack gap="sm">
  // the summary row always leads
  <SummaryRow record={displayData} />
</Stack>`,
      fixed: `// the summary row always leads
const body = (
  <Stack gap="sm">
    {/* and the record's own fields come after it */}
    <SummaryRow record={displayData} />
  </Stack>
);`,
      miss: [
        {
          note: "a comment after a self-closing tag is between siblings, not in child position",
          source: `<Divider />
// the lifecycle actions follow the divider
<ActionRow record={displayData} />`,
        },
        {
          note: "a comment under an arrow head is the function's first line",
          source: `const cell = (row) =>
  // the badge tone is looked up by the raw value
  <StatusBadge value={resolveBootEnum(row.status)} />;`,
        },
        {
          note: "an ordinary comment between two statements",
          source: `const total = rows.length;
// the pager needs the total, not the page size
const pages = Math.ceil(total / size);`,
        },
      ],
    },
  },
  {
    id: "filterbar-maxbadges",
    invariant: "#13",
    level: "error",
    desc: "CrudList.FilterBar without maxBadges={3} anywhere in the file",
    appliesTo: isTsx,
    check: (c) => (c.includes("<CrudList.FilterBar") && !c.includes("maxBadges")
      ? lineHits(c, /<CrudList\.FilterBar/)
      : []),
    samples: {
      file: "modules/site/src/widgets/area/list.tsx",
      broken: `<CrudList.FilterBar list={list} filters={filters} count={list.pagination.total} />`,
      fixed: `<CrudList.FilterBar list={list} filters={filters} count={list.pagination.total} maxBadges={3} />`,
      miss: [
        {
          note: "the standard set passed as one object, with maxBadges inside it",
          source: `const filterBarProps = { maxBadges: 3, popoverColumns: 2 } as const;

<CrudList.FilterBar {...filterBarProps} list={list} filters={filters} />`,
        },
      ],
    },
  },
  {
    id: "boolean-faceted",
    invariant: "#14",
    level: "error",
    desc: 'Boolean field as faceted filter with true/false options — use type: "toggle"',
    appliesTo: isTsx,
    check: (c) => blockHits(c, /type:\s*"faceted"[\s\S]{0,300}?value:\s*("?(true|false)"?)/g),
    samples: {
      file: "modules/site/src/widgets/area/list.tsx",
      broken: `const filters = [
  {
    type: "faceted",
    field: "active",
    label: fieldLabel("active"),
    options: [
      { label: t("common.yes"), value: true },
      { label: t("common.no"), value: false },
    ],
  },
];`,
      fixed: `const filters = [
  { type: "toggle", field: "active", label: fieldLabel("active") },
];`,
      miss: [
        {
          note: "a faceted filter over an enum — the sanctioned use",
          source: `const filters = [
  {
    type: "faceted",
    field: "status",
    label: fieldLabel("status"),
    options: [
      { label: enumLabel("AreaStatus", "ACTIVE"), value: "ACTIVE" },
      { label: enumLabel("AreaStatus", "CLOSED"), value: "CLOSED" },
    ],
  },
];`,
        },
        {
          note: "a boolean option list living elsewhere in a file whose filters are toggles",
          source: `const filters = [
  { type: "toggle", field: "active", label: fieldLabel("active") },
];

const confirmOptions = [
  { label: t("common.yes"), value: true },
  { label: t("common.no"), value: false },
];`,
        },
      ],
    },
  },
  {
    id: "deleted-toggle-filter",
    invariant: "#39",
    level: "error",
    desc: "Soft-delete implementation flag exposed as an operator filter",
    appliesTo: isTsx,
    check: (c) => blockHits(c, /type:\s*"toggle",\s*field:\s*"deleted"/g),
    samples: {
      file: "modules/site/src/widgets/area/list.tsx",
      broken: `const filters = [
  { type: "toggle", field: "deleted", label: fieldLabel("deleted") },
  { type: "text", field: "name", label: fieldLabel("name") },
];`,
      fixed: `const filters = [
  { type: "text", field: "name", label: fieldLabel("name") },
];`,
      miss: [
        {
          note: "a lifecycle state the operator really does narrow by, which happens to read like a flag",
          source: `const filters = [
  { type: "toggle", field: "archived", label: fieldLabel("archived") },
];`,
        },
        {
          note: "a field whose name merely begins with the flag's",
          source: `const filters = [
  { type: "toggle", field: "deletedByOperator", label: fieldLabel("deletedByOperator") },
];`,
        },
      ],
    },
  },
  {
    id: "local-page-heading",
    invariant: "#31a",
    level: "review",
    desc: "Level 1/2 Heading in a pages/ file — page titles go through usePageHeader (header-slot Headings are OK)",
    appliesTo: (p) => inPages(p) && isTsx(p),
    // The exception the description names, implemented rather than only promised: a Heading handed
    // to a `header` slot is chrome the framework places, not a page title standing in for
    // `usePageHeader`. The slot's brace sits on the Heading's own line or on one of the two above
    // it, so the lookback matches the justification-comment idiom used elsewhere in this file.
    check: (c) =>
      lineHits(
        c,
        /<Heading level=\{[12]\}/,
        (_line, lines, i) =>
          !lines.slice(Math.max(0, i - 2), i + 1).some((l) => /\bheader\s*[=:]/.test(l)),
      ),
    samples: {
      file: "modules/site/src/pages/area-list.tsx",
      broken: `export function AreaListPage() {
  return (
    <Stack gap="md">
      <Heading level={1}>{t("area.pageTitle")}</Heading>
      <AreaList />
    </Stack>
  );
}`,
      fixed: `export function AreaListPage() {
  usePageHeader({ title: t("area.pageTitle"), description: t("area.pageDescription") });

  return <AreaList />;
}`,
      miss: [
        {
          note: "a Heading handed to a header slot, which the description already exempts",
          source: `<CrudDetail
  header={<Heading level={2}>{displayData.name}</Heading>}
  onClose={onClose}
/>`,
        },
        {
          note: "a header slot whose Heading sits on the line below the brace",
          source: `<CrudDetail
  header={
    <Heading level={2}>{displayData.name}</Heading>
  }
/>`,
        },
        {
          note: "a section heading below the page title",
          source: `<CrudDetail.Section title={t("area.section")}>
  <Heading level={3}>{t("area.subsection")}</Heading>
</CrudDetail.Section>`,
        },
        {
          note: "a widget is not a page — the page title rule is about routed pages",
          file: "modules/site/src/widgets/area/detail.tsx",
          source: `<Heading level={1}>{displayData.name}</Heading>`,
        },
      ],
    },
  },
  {
    id: "page-root-padding",
    invariant: "#31c",
    level: "review",
    desc: "Ad-hoc p-4 padding in a pages/ file — the app layout owns page padding (inner cards are OK)",
    appliesTo: (p) => inPages(p) && isTsx(p),
    check: (c) => lineHits(c, /className="[^"]*\bp-4\b/, (line) => !line.includes("<Card")),
    samples: {
      file: "modules/site/src/pages/area-list.tsx",
      broken: `<Stack gap="md" className="p-4">
  <AreaList />
</Stack>`,
      fixed: `<Stack gap="md">
  <AreaList />
</Stack>`,
      miss: [
        {
          note: "a card inside the page pads its own content",
          source: `<Card className="p-4">
  <AreaSummary />
</Card>`,
        },
        {
          note: "padding on one axis is not the page-root padding this rule is about",
          source: `<Stack gap="md" className="px-4 pt-4">
  <AreaList />
</Stack>`,
        },
      ],
    },
  },
  {
    id: "capped-embedded-list",
    invariant: "#32 / audit: embedded list paging",
    level: "error",
    desc: "Detail-panel list read with a hardcoded page size and no pager — the rows past the cap are dropped with nothing on screen saying so, and a detail tab is exactly where a reader assumes they are seeing everything that points at the record. Drive the read with useCrudList and render CrudList.Pagination beside the rows",
    appliesTo: (p) => isTsx(p) && /\/detail(?:-tabs)?\.tsx$/.test(p),
    check: (c) =>
      /CrudList\.Pagination/.test(c)
        ? []
        : lineHits(c, /\bsize:\s*(\d+)\s*,/g, (line) => {
            const size = Number(/\bsize:\s*(\d+)/.exec(line)?.[1]);
            // A read of one row is a count, not a list — the total is what it is after.
            return Number.isFinite(size) && size > 1;
          }),
    samples: {
      file: "modules/site/src/widgets/area/detail-tabs.tsx",
      broken: `const { data } = useListAreaVisits({ areaId, page: 0, size: 20, sort: "startedAt,desc" });

return <Table rows={data?.content ?? []} />;`,
      fixed: `const list = useCrudList({
  queryHook: useListAreaVisits,
  params: { areaId },
});

return (
  <Stack gap="sm">
    <CrudList.Table list={list} />
    <CrudList.Pagination list={list} />
  </Stack>
);`,
      miss: [
        {
          note: "a read of one row is a count, and the total beside it is the answer",
          source: `const { data } = useListAreaVisits({ areaId, page: 0, size: 1, sort: "startedAt,desc" });

return <Badge>{data?.totalElements ?? 0}</Badge>;`,
        },
        {
          note: "a list screen is paged by its own chrome — this rule is about a panel that embeds one",
          file: "modules/site/src/widgets/area/list.tsx",
          source: `const { data } = useListAreaVisits({ areaId, page: 0, size: 20, sort: "startedAt,desc" });`,
        },
      ],
    },
  },
  {
    id: "card-drops-status",
    invariant: "#21 / audit: card parity",
    level: "error",
    desc: "A column renders a status badge the card slots never show — below the card breakpoint, and inside every detail panel that embeds the list, a failed row reads exactly like one that succeeded and a handled row exactly like an untouched one. Repeat the badge in cardTitle or cardContent",
    appliesTo: isTsx,
    check: (c) => {
      const card = cardSlots(c);
      if (!card) {
        return [];
      }
      return columnBlocks(c)
        // A badge built from the whole row rather than from this field cannot be looked for by
        // name in the card, so it is left to the eye.
        .filter(({ field, source }) => /\w*Badge\b/.test(source) && source.includes(`row.${field}`))
        .filter(({ field }) => !card.includes(`row.${field}`))
        .map(({ field, line, source }) => ({
          line,
          excerpt: `column "${field}" — ${source.replace(/\s+/g, " ").slice(0, 110)}`,
        }));
    },
    samples: {
      file: "modules/site/src/widgets/area/list.tsx",
      broken: `<CrudList.Table
  list={list}
  cardTitle={(row) => row.name}
  cardContent={(row) => <Text>{row.code}</Text>}
>
  <CrudList.Column field="status">
    {(row) => <StatusBadge value={resolveBootEnum(row.status)} />}
  </CrudList.Column>
</CrudList.Table>`,
      fixed: `<CrudList.Table
  list={list}
  cardTitle={(row) => row.name}
  cardContent={(row) => (
    <Stack gap="xs">
      <Text>{row.code}</Text>
      <StatusBadge value={resolveBootEnum(row.status)} />
    </Stack>
  )}
>
  <CrudList.Column field="status">
    {(row) => <StatusBadge value={resolveBootEnum(row.status)} />}
  </CrudList.Column>
</CrudList.Table>`,
      miss: [
        {
          note: "a badge built from the whole row cannot be looked for by field name — left to the eye",
          source: `<CrudList.Table
  list={list}
  cardTitle={(row) => row.name}
  cardContent={(row) => <Text>{row.code}</Text>}
>
  <CrudList.Column field="status">
    {(row) => <AreaStatusBadge record={row} />}
  </CrudList.Column>
</CrudList.Table>`,
        },
        {
          note: "a column of plain text is not a status the card can lose",
          source: `<CrudList.Table
  list={list}
  cardTitle={(row) => row.name}
  cardContent={(row) => <Text>{row.code}</Text>}
>
  <CrudList.Column field="memo">
    {(row) => <Text>{row.memo}</Text>}
  </CrudList.Column>
</CrudList.Table>`,
        },
        {
          note: "a table that declares no card slots never falls back to cards",
          source: `<CrudList.Table list={list}>
  <CrudList.Column field="status">
    {(row) => <StatusBadge value={resolveBootEnum(row.status)} />}
  </CrudList.Column>
</CrudList.Table>`,
        },
      ],
    },
  },
  {
    id: "hand-typed-id",
    invariant: "#34 / census 4",
    level: "error",
    desc: "Text input bound to an *Id value — entity references come from a picker, files from the file field",
    appliesTo: isTsx,
    // What the invariant is about is an id naming a record in THIS system: the user cannot know a
    // UUID, so typing one is a guess and the picker exists to stop it. An identifier issued by
    // somebody else is the opposite case — an operator copies `clientId` out of the provider's
    // console and `machineId` off the licence, no picker can list them because this system does not
    // hold the set, and a text box is the only control there is. Excluded by name rather than by
    // guessing, because the vocabulary is small and stable.
    //
    // hits:  value={draft.userId} · value={form.siteId} · value={values.attachmentId}
    // quiet: value={draft.clientId} · value={draft.tenantId} · value={settings.machineId}
    check: (c) =>
      blockHits(
        c,
        /<FormFields\.(TextField|TextareaField)(?:(?!\/>)[\s\S]){0,250}?value=\{[^}]*Id[a-z]*\s*\}/g,
      ).filter((hit) => !FOREIGN_ID_NAMES.test(hit.excerpt)),
    samples: {
      file: "modules/site/src/widgets/area/form.tsx",
      broken: `<FormFields.TextField
  label={fieldLabel("owner")}
  value={draft.userId}
  onChange={(v) => updateField("userId", v)}
/>`,
      fixed: `<EntityCombobox
  label={fieldLabel("owner")}
  value={draft.userId}
  onChange={(v) => updateField("userId", v)}
  options={userOptions}
/>`,
      miss: [
        {
          note: "an identifier issued outside this system — the operator reads it off the provider's console",
          source: `<FormFields.TextField
  label={fieldLabel("clientId")}
  value={draft.clientId}
  onChange={(v) => updateField("clientId", v)}
/>`,
        },
        {
          note: "a licence's machine identifier, which no picker in this system can list",
          source: `<FormFields.TextField
  label={fieldLabel("machineId")}
  value={settings.machineId}
  onChange={(v) => updateField("machineId", v)}
/>`,
        },
        {
          note: "an ordinary text field over a value the user can actually type",
          source: `<FormFields.TextField
  label={fieldLabel("name")}
  value={draft.name}
  onChange={(v) => updateField("name", v)}
/>`,
        },
      ],
    },
  },
  {
    id: "native-time-input",
    invariant: "#37",
    level: "error",
    desc: 'Native time input or free-text HH:mm placeholder — use FormFields.TimeField',
    appliesTo: isTsx,
    check: (c) => lineHits(c, /type:\s*"time"|placeholder="HH:mm"/),
    samples: {
      file: "modules/site/src/widgets/area/form.tsx",
      broken: `<FormFields.TextField
  label={fieldLabel("opensAt")}
  inputProps={{ type: "time" }}
  value={values.opensAt}
  onChange={(v) => updateField("opensAt", v)}
/>`,
      fixed: `<FormFields.TimeField
  label={fieldLabel("opensAt")}
  value={values.opensAt}
  onChange={(v) => updateField("opensAt", v)}
/>`,
      miss: [
        {
          note: "the sanctioned picker, with a placeholder that is a sentence rather than a format",
          source: `<FormFields.TimeField
  label={fieldLabel("opensAt")}
  placeholder={t("area.opensAtHint")}
  value={values.opensAt}
/>`,
        },
        {
          note: "a date-range filter is a temporal axis, not a time-of-day input",
          source: `const filters = [
  { type: "dateRange", field: "openedAt", label: fieldLabel("openedAt") },
];`,
        },
      ],
    },
  },
  {
    id: "local-time-helper-copy",
    invariant: "#37",
    level: "error",
    desc: "Per-module copy of the LocalTime <-> TimeValue conversion — import the shared helper pair",
    appliesTo: isTsx,
    check: (c) =>
      lineHits(c, /function\s+\w*[Ll]ocalTime\s*\(|const\s+(parseLocalTime|formatLocalTime|displayLocalTime)\s*=\s*\(/),
    samples: {
      file: "modules/site/src/widgets/area/form.tsx",
      broken: `function parseLocalTime(value: string): TimeValue {
  const [hour, minute] = value.split(":").map(Number);
  return new Time(hour, minute);
}`,
      fixed: `import { formatLocalTime, parseLocalTime } from "@acme/site-ui";`,
      miss: [
        {
          note: "a domain label built from a time, which converts nothing",
          source: `function areaOpeningLabel(value: TimeValue) {
  return t("area.opensAtLabel", { time: formatLocalTime(value) });
}`,
        },
      ],
    },
  },
  {
    id: "forced-narrowing-in-transform-filters",
    invariant: "#32 / #3",
    level: "error",
    desc:
      "Forced narrowing (a tab, a chip row, a scope from the address) merged inside transformFilters — the list state machine only sends a `filters` object once the reader has committed one, so on the first view the transform never runs and the request goes out unnarrowed. Merge into the request params instead",
    appliesTo: isSource,
    check: (c) =>
      // A transform that only rewrites what it was handed (date formats, operator names — the
      // documented use) spreads its own parameter and nothing else. One that spreads anything
      // ELSE is carrying a narrowing in, and that narrowing is the half that silently disappears.
      //
      // KNOWN GAP: only the SPREAD form. A narrowing written as a plain key — `siteId,` or
      // `status: TAB_STATUS[tab],` beside the spread of the parameter — disappears on the first
      // view in exactly the same way and is not reported. Closing it means reading each key's
      // value and asking whether it mentions the transform's own parameter, which is a wider
      // change than a pattern: `sort:` and `size:` keys would start being reported too, and
      // whether that is right is a judgment about this rule's grade rather than about its regex.
      blockHits(
        c,
        /transformFilters:\s*\(\s*(\w+)\s*\)\s*=>\s*\(?\{[\s\S]{0,400}?\.\.\.(?!\1\b)[A-Za-z_$]/g,
      ),
    samples: {
      file: "modules/site/src/widgets/area/use-area-list.ts",
      broken: `export function useAreaList(siteId: string, tab: AreaTab) {
  const forcedScope = { siteId, status: TAB_STATUS[tab] };

  return useCrudList({
    queryHook: useListAreas,
    transformFilters: (filters) => ({
      ...filters,
      ...forcedScope,
    }),
  });
}`,
      fixed: `export function useAreaList(siteId: string) {
  return useCrudList({
    queryHook: useListAreas,
    params: { siteId },
    transformFilters: (filters) => ({
      ...filters,
      openedFrom: filters.openedAt?.from,
    }),
  });
}`,
      miss: [
        {
          note: "the documented use — the transform rewrites what it was handed and adds nothing",
          source: `export function useAreaList() {
  return useCrudList({
    queryHook: useListAreas,
    transformFilters: (filters) => ({
      ...filters,
      status: filters.status?.toUpperCase(),
    }),
  });
}`,
        },
        {
          note: "a transform that spreads nothing at all",
          source: `export function useAreaList() {
  return useCrudList({
    queryHook: useListAreas,
    transformFilters: (filters) => ({ name: filters.name }),
  });
}`,
        },
      ],
    },
  },
  {
    id: "callback-prop-names",
    invariant: "#12",
    level: "error",
    desc: "Ad-hoc save callback name onSaved — use onSuccess",
    appliesTo: isTsx,
    check: (c) => lineHits(c, /\bonSaved\s*[=:{]/),
    samples: {
      file: "modules/site/src/widgets/area/list.tsx",
      broken: `<AreaForm areaId={selected} onSaved={() => list.refetch()} onClose={close} />`,
      fixed: `<AreaForm areaId={selected} onSuccess={() => list.refetch()} onClose={close} />`,
      miss: [
        {
          note: "the sanctioned callback names, which this rule exists to steer towards",
          source: `<AreaForm areaId={selected} onSuccess={onSuccess} onDeleted={onDeleted} onCancel={close} />`,
        },
      ],
    },
  },
  {
    id: "callback-done-name",
    invariant: "#12",
    level: "review",
    desc: "onDone callback — use onSuccess for save/submit completion (non-CRUD completions like animation ends are OK)",
    appliesTo: isTsx,
    check: (c) => lineHits(c, /\bonDone\s*[=:{]/),
    // No `miss` sample: the exception this rule names — a non-CRUD completion such as an
    // animation end — is not visible in the prop name, which is why the rule is graded review
    // and hands the reader a candidate rather than a verdict.
    samples: {
      file: "modules/site/src/widgets/area/wizard.tsx",
      broken: `<AreaWizard onDone={() => close()} />`,
      fixed: `<AreaWizard onSuccess={() => close()} />`,
    },
  },
  {
    id: "wrap-string-prop",
    invariant: "#44",
    level: "error",
    desc: 'wrap="wrap" on Flex/Stack — wrap is a boolean prop',
    appliesTo: isTsx,
    check: (c) => lineHits(c, /wrap="wrap"/),
    samples: {
      file: "modules/site/src/widgets/area/detail.tsx",
      broken: `<Flex gap="xs" wrap="wrap">
  {displayData.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}
</Flex>`,
      fixed: `<Flex gap="xs" wrap>
  {displayData.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}
</Flex>`,
      miss: [
        {
          note: "a CSS property whose value really is the string",
          source: `const chipRow = { display: "flex", flexWrap: "wrap" } as const;`,
        },
      ],
    },
  },
  {
    id: "size-shorthand",
    invariant: "anti-pattern table",
    level: "review",
    desc: 'className "h-4 w-4" — use "size-4"',
    appliesTo: isTsx,
    check: (c) => lineHits(c, /className="[^"]*\bh-4 w-4\b/),
    samples: {
      file: "modules/site/src/widgets/area/list.tsx",
      broken: `<TrashIcon className="h-4 w-4" />`,
      fixed: `<TrashIcon className="size-4" />`,
      miss: [
        {
          note: "a box that is not square — the shorthand does not apply",
          source: `<Sparkline className="h-4 w-40" />`,
        },
      ],
    },
  },
  {
    id: "command-primitives",
    invariant: "registry: SearchPopover",
    level: "error",
    desc: "Command primitives imported in a module — use SearchPopover",
    appliesTo: (p) => inModules(p),
    check: (c) => lineHits(c, /import\s+\{[^}]*Command(Input|Item|List)/),
    samples: {
      file: "modules/site/src/widgets/area/assign-popover.tsx",
      broken: `import { Command, CommandInput, CommandItem, CommandList } from "@simplix-react/ui";`,
      fixed: `import { SearchPopover } from "@simplix-react/ui";`,
      miss: [
        {
          note: "the shared package that BUILDS the popover has to import the primitives",
          file: "packages/site-ui/src/search-popover.tsx",
          source: `import { Command, CommandInput, CommandItem, CommandList } from "@simplix-react/ui";`,
        },
      ],
    },
  },
  {
    id: "raw-select-import",
    invariant: "registry: SelectField compact",
    level: "error",
    desc: "Raw Select primitives imported in a module — use FormFields.SelectField",
    appliesTo: (p) => inModules(p),
    check: (c) => lineHits(c, /import\s+\{[^}]*Select(Trigger|Content|Item)\b/),
    samples: {
      file: "modules/site/src/widgets/area/list.tsx",
      broken: `import { Select, SelectContent, SelectItem, SelectTrigger } from "@simplix-react/ui";`,
      fixed: `import { FormFields } from "@simplix-react/ui";`,
      miss: [
        {
          note: "the field component itself is not a raw primitive",
          source: `import { FormFields, SelectField } from "@simplix-react/ui";`,
        },
        {
          note: "the shared package that wraps the primitives into the compact field",
          file: "packages/site-ui/src/compact-select.tsx",
          source: `import { SelectContent, SelectItem, SelectTrigger } from "@simplix-react/ui";`,
        },
      ],
    },
  },
  {
    id: "loader-spinner",
    invariant: "registry: Button loading",
    level: "review",
    desc: "Manual Loader2 / animate-spin — Button handles its own spinner (standalone overlays are OK)",
    appliesTo: (p) => inModules(p) && isTsx(p),
    check: (c) => lineHits(c, /\bLoader2\b|animate-spin/),
    // No `miss` for the exception the description names — a standalone overlay spinner looks
    // exactly like a hand-rolled button spinner in source. That is the judgment the review grade
    // hands to the reader.
    samples: {
      file: "modules/site/src/widgets/area/form.tsx",
      broken: `<Button disabled={isPending} onClick={onSave}>
  {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
  {isPending ? t("common.saving") : t("common.save")}
</Button>`,
      fixed: `<Button loading={isPending} loadingText={t("common.saving")} onClick={onSave}>
  {t("common.save")}
</Button>`,
      miss: [
        {
          note: "the shared package that owns the spinner",
          file: "packages/site-ui/src/loading-overlay.tsx",
          source: `<Loader2 className="size-8 animate-spin" />`,
        },
      ],
    },
  },
  {
    id: "status-map-resurrect",
    invariant: "registry: tone maps",
    level: "error",
    desc: "Resurrected local status/severity color map — use the shared tone maps + StatusBadge/StatusDot",
    appliesTo: (p) => inModules(p),
    check: (c) => lineHits(c, /\b(STATUS_COLORS|SEVERITY_COLORS|severityConfig)\b/),
    samples: {
      file: "modules/site/src/widgets/area/list.tsx",
      broken: `const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  CLOSED: "bg-red-100 text-red-800",
};`,
      fixed: `import { areaStatusToTone } from "@acme/site-ui";

<StatusBadge tone={areaStatusToTone[resolveBootEnum(row.status)]} />`,
      miss: [
        {
          note: "a categorical palette, which the registry says stays domain-local",
          source: `const CATEGORY_COLORS: Record<string, string> = {
  ENTRANCE: "bg-sky-100",
  STORAGE: "bg-violet-100",
};`,
        },
      ],
    },
  },
  {
    id: "inline-dark-tone-map",
    invariant: "registry: tone maps",
    level: "review",
    desc: "Inline Record<> map with dark: status colors — status/severity maps belong to the shared UI package (categorical palettes are OK)",
    appliesTo: (p) => inModules(p) && isTsx(p),
    check: (c) =>
      /Record</.test(c) ? lineHits(c, /dark:bg-(red|green|emerald|amber|blue|orange|slate)-\d/) : [],
    // No `miss` for the description's categorical-palette exception: what separates a status map
    // from a category palette is what the keys MEAN, and the words that would tell them apart are
    // each project's own vocabulary — which is exactly what must not be baked in here. The review
    // grade is where that judgment lives.
    samples: {
      file: "modules/site/src/widgets/area/list.tsx",
      broken: `const toneClass: Record<AreaStatus, string> = {
  ACTIVE: "bg-green-100 dark:bg-green-900",
  CLOSED: "bg-red-100 dark:bg-red-900",
};`,
      fixed: `import { areaStatusToTone } from "@acme/site-ui";

<StatusBadge tone={areaStatusToTone[resolveBootEnum(row.status)]} />`,
      miss: [
        {
          note: "a one-off tint on a single element is not a map",
          source: `<Callout className="bg-amber-50 dark:bg-amber-950">{t("area.hint")}</Callout>`,
        },
      ],
    },
  },
  {
    id: "drag-threshold-copy",
    invariant: "registry: ResizeHandle",
    level: "error",
    desc: "Local DRAG_THRESHOLD_PX redefinition — import it from the shared UI package",
    appliesTo: (p) => inModules(p),
    check: (c) => lineHits(c, /const DRAG_THRESHOLD_PX/),
    samples: {
      file: "modules/site/src/widgets/schedule/bar.tsx",
      broken: `const DRAG_THRESHOLD_PX = 4;`,
      fixed: `import { DRAG_THRESHOLD_PX, ResizeHandle } from "@acme/site-ui";`,
      miss: [
        {
          note: "a different threshold, in a different unit, is a different constant",
          source: `const DRAG_THRESHOLD_MS = 120;`,
        },
        {
          note: "the shared package is where the constant is defined",
          file: "packages/site-ui/src/resize-handle.tsx",
          source: `export const DRAG_THRESHOLD_PX = 4;`,
        },
      ],
    },
  },
  {
    id: "cursor-col-resize",
    invariant: "registry: ResizeHandle",
    level: "review",
    desc: "Inline cursor-col-resize edge grip — use <ResizeHandle /> (canvas vertex handles are OK)",
    appliesTo: (p) => inModules(p) && isTsx(p),
    check: (c) => lineHits(c, /cursor-col-resize/),
    // No `miss` for the canvas-vertex exception the description names — a vertex handle and an
    // edge grip carry the same class, and only what they sit on tells them apart.
    samples: {
      file: "modules/site/src/widgets/schedule/bar.tsx",
      broken: `<div
  className="absolute inset-y-0 right-0 w-2.5 cursor-col-resize hover:bg-white/20"
  onPointerDown={(e) => handlePointerDown(e, "resize-right")}
/>`,
      fixed: `<ResizeHandle side="right" disabled={disabled} onPointerDown={(e) => handlePointerDown(e, "resize-right")} />`,
      miss: [
        {
          note: "a row grip resizes the other axis",
          source: `<div className="cursor-row-resize" onPointerDown={onGrab} />`,
        },
        {
          note: "the shared package that defines the handle",
          file: "packages/site-ui/src/resize-handle.tsx",
          source: `<div className="w-2.5 cursor-col-resize" onPointerDown={onPointerDown} />`,
        },
      ],
    },
  },
  {
    id: "uuid-audit-filters",
    invariant: "#39",
    level: "review",
    desc: "Scaffold-emitted UUID / createdAt / updatedAt filters nobody searches by — prune, then add the persona's real axis",
    appliesTo: (p) => isListWidget(p),
    check: (c) =>
      lineHits(
        c,
        /field:\s*"([a-zA-Z]+Id|createdAt|updatedAt)",\s*label/,
        // FK faceted selects with options (dropdown) are the sanctioned user/entity filters,
        // and a preceding `// operator search axis:` comment records a judged exception.
        (line, lines, i) =>
          !line.includes("options:") &&
          !lines[Math.max(0, i - 1)].includes("operator search axis:"),
      ),
    samples: {
      file: "modules/site/src/widgets/area/list.tsx",
      broken: `const filters = [
  { type: "text", field: "areaId", label: fieldLabel("areaId") },
  { type: "dateRange", field: "createdAt", label: fieldLabel("createdAt") },
];`,
      fixed: `const filters = [
  { type: "text", field: "name", label: fieldLabel("name") },
  { type: "faceted", field: "status", label: fieldLabel("status"), options: statusOptions },
];`,
      miss: [
        {
          note: "a foreign key offered as a dropdown — the sanctioned entity filter",
          source: `const filters = [
  { type: "faceted", field: "ownerId", label: fieldLabel("owner"), options: userOptions },
];`,
        },
        {
          note: "an id the persona really does search by, with the judgment recorded above it",
          source: `const filters = [
  // operator search axis: support reads the ticket id back to the caller on the phone
  { type: "text", field: "ticketId", label: fieldLabel("ticketId") },
];`,
        },
      ],
    },
  },
  {
    id: "delete-confirm-id",
    invariant: "#46",
    level: "error",
    desc: "Delete confirmation named with a raw id — name the record with a human-readable value",
    appliesTo: isTsx,
    check: (c) => {
      const hits = [];
      for (const m of c.matchAll(/requestDelete\([\s\S]{0,200}?\)/g)) {
        if (/(\?\?|name:)\s*(String\()?\s*[a-zA-Z_.]*\.id\b/.test(m[0])) {
          hits.push({ line: lineOfIndex(c, m.index), excerpt: m[0].replace(/\s+/g, " ").slice(0, 140) });
        }
      }
      return hits;
    },
    samples: {
      file: "modules/site/src/widgets/area/list.tsx",
      broken: `del.requestDelete({ id: row.areaId, name: row.name ?? row.id })`,
      fixed: `del.requestDelete({ id: row.areaId, name: row.name ?? row.code })`,
      miss: [
        {
          note: "a record named by the value the operator reads on screen",
          source: `del.requestDelete({ id: row.areaId, name: row.name })`,
        },
        {
          note: "the record's own key passed as the id argument is what deletion needs",
          source: `del.requestDelete({ id: row.areaId })`,
        },
      ],
    },
  },
  {
    id: "header-id-title",
    invariant: "census 3",
    level: "error",
    desc: "detailHeader/editHeader interpolating an id — titles carry a name",
    appliesTo: isTsx,
    check: (c) => lineHits(c, /(detailHeader|editHeader)[^\n]*\bid:/),
    samples: {
      file: "modules/site/src/widgets/area/detail.tsx",
      broken: `<CrudDetail header={t("area.detailHeader", { id: displayData.areaId })} />`,
      fixed: `<CrudDetail header={t("area.detailHeader", { name: displayData.name })} />`,
      miss: [
        {
          note: "the key named on its own, with nothing interpolated into it",
          source: `const headerKey = "area.detailHeader";`,
        },
      ],
    },
  },
  {
    id: "description-as-filter",
    invariant: "e2e: Search Is Part of the Product",
    level: "review",
    desc: "A definition row's description offered as a list filter — the persona finds these by name or code, not by their prose (an event's 사유/목적/메모 is a different case and legitimately searchable)",
    appliesTo: (p) => isTsx(p) && /list\.tsx$/.test(p),
    check: (c) => lineHits(c, /type:\s*"text",\s*field:\s*"description"/),
    samples: {
      file: "modules/site/src/widgets/area/list.tsx",
      broken: `const filters = [
  { type: "text", field: "description", label: fieldLabel("description") },
];`,
      fixed: `const filters = [
  { type: "text", field: "name", label: fieldLabel("name") },
];`,
      miss: [
        {
          note: "an event's own prose — a reason is what the reader searches such a list by",
          source: `const filters = [
  { type: "text", field: "reason", label: fieldLabel("reason") },
];`,
        },
      ],
    },
  },
  {
    id: "visible-native-file-input",
    invariant: "e2e census 2",
    level: "error",
    desc: "Visible native file input — its label follows the browser's locale, not the app's; hide it and drive it from an app-owned button",
    appliesTo: isTsx,
    // A file input is exempt only when it is hidden behind a trigger the app labels.
    check: (c) =>
      blockHits(c, /<input\b[^>]*type="file"[^>]*>/g).filter((h) => !/className="[^"]*\bhidden\b/.test(h.excerpt)),
    samples: {
      file: "modules/site/src/widgets/area/attachment-field.tsx",
      broken: `<input type="file" accept="image/*" onChange={onPick} />`,
      fixed: `<input type="file" accept="image/*" className="hidden" ref={fileRef} onChange={onPick} />
<Button variant="outline" onClick={() => fileRef.current?.click()}>
  {t("area.chooseFile")}
</Button>`,
      miss: [
        {
          note: "the framework field, which owns its own trigger and its own label",
          source: `<FormFields.FileField label={fieldLabel("attachment")} value={values.attachmentFileId} onChange={onPick} />`,
        },
      ],
    },
  },
  {
    id: "comma-in-sort-token",
    invariant: "#3",
    level: "error",
    desc:
      "A sort token written `field,direction` — the separator is a dot. The generated client types `sort` as `string[]`, so the comma form typechecks; the server's parser then splits the element on the comma and refuses the request with a sort-format error. The screen shows nothing: the list hook reads the error envelope as an empty page and draws its empty state, and the network tab shows 200 because the envelope carried one",
    appliesTo: isSource,
    // Anchored on `sort` so an ordinary array of two strings is not reported. Only the
    // one-string-two-fields shape is the defect; `sort: ["a.asc", "b.desc"]` is two tokens
    // and correct.
    check: (c) => lineHits(c, /\bsort\b\s*[:=]\s*\[?\s*["'`][A-Za-z_$][\w.$]*,\s*(?:asc|desc)\b/i),
    samples: {
      file: "modules/site/src/widgets/shift/use-shift-list.ts",
      broken: `const params = { sort: ["sortOrder,asc"] };`,
      fixed: `const params = { sort: ["sortOrder.asc"] };`,
      miss: [
        {
          note: "two separate tokens in one array is the correct multi-field form",
          source: `const params = { sort: ["siteName.asc", "sortOrder.desc"] };`,
        },
        {
          note: "a comma inside an unrelated array of field names",
          source: `const columns = ["sortOrder", "ascendingLabel"];`,
        },
      ],
    },
  },
  {
    id: "hand-written-endpoint-url",
    invariant: "#30 / #3",
    level: "review",
    desc: "Endpoint path assembled by hand — the codegen emits a get<Op>Url helper, and a hand-written twin drifts silently the next time the route moves",
    appliesTo: isSource,
    // Cache-key prefixes are literal by contract (useInvalidateEntity takes the prefix, not a
    // URL), and a public asset endpoint with no generated operation has no helper to import.
    // What this catches is a literal path handed to fetch, an <a href>, or a transport.
    check: (c) =>
      lineHits(c, /["'`]\/api\/v\d+\/[^"'`]*["'`]/).filter(
        (h) => !/useInvalidateEntity|invalidateEntity|queryKey/.test(h.excerpt),
      ),
    samples: {
      file: "modules/site/src/widgets/area/export.ts",
      broken: `const response = await fetch("/api/v1/areas/" + areaId + "/export");`,
      fixed: `const response = await fetch(getExportAreaUrl({ areaId }));`,
      miss: [
        {
          note: "a cache-key prefix is a literal by contract, not a URL a helper could supply",
          source: `const invalidate = useInvalidateEntity("/api/v1/areas");`,
        },
        {
          note: "the same literal standing in a query key",
          source: `const options = { queryKey: ["/api/v1/areas", areaId] };`,
        },
      ],
    },
  },
  {
    id: "mock-seed-missing",
    invariant: "#30",
    level: "error",
    desc: "A mock handler names a seed export that seeds.ts does not have — codegen rewrites the handlers but PRESERVES seeds.ts, so an entity added by a later regeneration arrives with a reference to a seed nobody wrote. Nothing in the codegen run says so; the package simply stops building, and with it every app that depends on it. Add the seed by hand after regenerating a domain that gained an entity",
    appliesTo: (p) => p.endsWith(`${path.sep}src${path.sep}mock${path.sep}index.ts`),
    check: (c, rel) => {
      const seedsPath = path.join(ROOT, path.dirname(rel), "seeds.ts");
      if (!fs.existsSync(seedsPath)) return [];
      const seeds = fs.readFileSync(seedsPath, "utf8");
      const declared = new Set(
        [...seeds.matchAll(/export\s+const\s+(\w+Seeds)\b/g)].map((m) => m[1]),
      );
      // Every name on the line, not just the first: one import statement lists several seeds,
      // and stopping at the first hides a missing one behind a present one beside it.
      const seen = new Set();
      const hits = [];
      const lines = c.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (!notCommentLine(lines[i])) continue;
        for (const m of lines[i].matchAll(/\b(\w+Seeds)\b/g)) {
          const name = m[1];
          if (declared.has(name) || seen.has(name)) continue;
          seen.add(name);
          hits.push({ line: i + 1, excerpt: lines[i].trim().slice(0, 140) });
        }
      }
      return hits;
    },
    samples: {
      file: "packages/domain-site/src/mock/index.ts",
      broken: {
        files: {
          "packages/domain-site/src/mock/seeds.ts": `export const areaSeeds = [{ areaId: "a-1", name: "정문" }];
`,
        },
        source: `import { areaSeeds, visitSeeds } from "./seeds";

export const handlers = [
  ...makeHandlers("area", areaSeeds),
  ...makeHandlers("visit", visitSeeds),
];`,
      },
      fixed: {
        files: {
          "packages/domain-site/src/mock/seeds.ts": `export const areaSeeds = [{ areaId: "a-1", name: "정문" }];
export const visitSeeds = [{ visitId: "v-1", areaId: "a-1" }];
`,
        },
        source: `import { areaSeeds, visitSeeds } from "./seeds";

export const handlers = [
  ...makeHandlers("area", areaSeeds),
  ...makeHandlers("visit", visitSeeds),
];`,
      },
      miss: [
        {
          note: "a seed named only in a comment about why it is gone",
          files: {
            "packages/domain-site/src/mock/seeds.ts": `export const areaSeeds = [];
`,
          },
          source: `// visitSeeds moved out with the visit entity when it got its own domain package.
import { areaSeeds } from "./seeds";

export const handlers = [...makeHandlers("area", areaSeeds)];`,
        },
        {
          note: "a domain whose seeds file has not been generated yet — nothing to check against",
          source: `import { areaSeeds } from "./seeds";

export const handlers = [...makeHandlers("area", areaSeeds)];`,
        },
      ],
    },
  },
  {
    id: "silent-clipboard-copy",
    invariant: "#40 / e2e lens: persona",
    level: "review",
    desc: "clipboard.writeText with no failure path — the clipboard is refused outside a secure context and pending while the tab is hidden, so a copy that never happened looks identical to one that did",
    appliesTo: isSource,
    // A file that already branches on failure is exempt; what this catches is the bare await.
    check: (c) =>
      /catch\s*(\{|\()/.test(c)
        ? []
        : lineHits(c, /navigator\.clipboard\.writeText/, notCommentLine),
    samples: {
      file: "modules/site/src/widgets/area/copy-code.ts",
      broken: `export async function copyAreaCode(code: string) {
  await navigator.clipboard.writeText(code);
  addToast({ title: t("common.copied") });
}`,
      fixed: `export async function copyAreaCode(code: string) {
  try {
    await navigator.clipboard.writeText(code);
    addToast({ title: t("common.copied") });
  } catch {
    addToast({ tone: "danger", title: t("common.copyFailed") });
  }
}`,
      miss: [
        {
          note: "the call named in a comment explaining why this path exists",
          source: `// navigator.clipboard.writeText is refused outside a secure context, so kiosk builds
// reach the code through the print sheet instead.
export function printAreaCode(code: string) {
  openPrintSheet(code);
}`,
        },
      ],
    },
  },
  {
    id: "ungated-create-button",
    invariant: "#52",
    level: "error",
    desc: "Create button with no permission gate — a user without create sees it, fills the form, and gets a 403 on submit",
    appliesTo: isTsx,
    // The gate is a `useCan("create", …)` result the file reads on or around the button, so a
    // file that owns one is exempt; what this catches is the button standing alone.
    check: (c) =>
      /\buseCan\("create"/.test(c) ? [] : lineHits(c, /onClick=\{show(New|Create)\}/),
    samples: {
      file: "modules/site/src/pages/area-list.tsx",
      broken: `usePageHeader({
  title: t("area.pageTitle"),
  actions: <Button onClick={showNew}>{t("area.add")}</Button>,
});`,
      fixed: `const canCreate = useCan("create", SUBJECTS.area);

usePageHeader({
  title: t("area.pageTitle"),
  actions: canCreate ? <Button onClick={showNew}>{t("area.add")}</Button> : undefined,
});`,
      miss: [
        {
          note: "an edit affordance answers to a different permission and to a different rule",
          source: `<Button onClick={showEdit}>{t("common.edit")}</Button>`,
        },
      ],
    },
  },
  {
    id: "permission-blanked-tab",
    invariant: "#61",
    level: "review",
    desc: "A tab's count is blanked by a permission flag while the tab itself still renders — the affordance survives the gate and opens onto a panel that can only say the read was refused, which reads as a screen that failed rather than as a permission this account does not hold. Gate the tab and its panel on the same flag and explain the absence once, where the figure it replaces would have been",
    appliesTo: isTsx,
    // Anchored on the tab, not on the ternary: a readout blanking its own value behind the same
    // flag (a tile drawing an em dash, a column cell left empty) is the right shape — a count
    // nobody was allowed to take is absent rather than zero. What is wrong here is that the
    // control leading to it is still pressable.
    // `blockHits`, not `lineHits`: a tab with three attributes is written over four lines, and the
    // flag sits on a different line from the tag that makes it a tab. `[^<]*?` cannot cross into
    // the next element, so the tag name and the count stay bound to one another.
    check: (c) =>
      blockHits(
        c,
        /<(?:\w*Tab|TabsTrigger)\b[^<]*?\bcount=\{\s*(?:[\w.]*(?:[Rr]eadable|[Aa]llowed|[Vv]isible)|can[A-Z]\w*)[\w.?]*\s*\?/g,
      ),
    samples: {
      file: "modules/org/src/widgets/organization/detail-body.tsx",
      broken: `<CountedTab value="accounts" label={t("detail.tabAccounts")} count={data.accountsReadable ? held?.total : undefined} />`,
      fixed: `{data.accountsReadable && (
  <CountedTab value="accounts" label={t("detail.tabAccounts")} count={held?.total} />
)}`,
      miss: [
        {
          note: "a readout blanking its own value behind the gate is right — the control is not the thing being kept",
          file: "modules/org/src/widgets/organization/tiles.tsx",
          source: `<StatCard label={t("tiles.accounts")} value={census.readable ? census.total : undefined} />`,
        },
        {
          note: "a tab whose count is merely absent when there is nothing to count",
          file: "modules/org/src/widgets/organization/detail-body.tsx",
          source: `<CountedTab value="children" label={t("detail.tabChildren")} count={children.length > 0 ? children.length : undefined} />`,
        },
      ],
    },
  },
  {
    id: "inline-permission-group",
    invariant: "#52",
    level: "error",
    desc: "useCan names its permission group as a string literal instead of reading it from the module's SUBJECTS map — the screen's gate and the server's rule then move separately, and a group renamed on the backend leaves this affordance gated on a name nothing grants any more",
    appliesTo: isTsx,
    // Only a module's own screens have a SUBJECTS map to read from; an app-level surface
    // outside `modules/` has no registry and is left to the reviewer.
    check: (c, file) =>
      /(^|\/)modules\//.test(file)
        ? lineHits(c, /\buseCan\(\s*"[a-z]+"\s*,\s*"[A-Z][A-Z_]*"\s*\)/)
        : [],
    samples: {
      file: "modules/site/src/widgets/area/list.tsx",
      broken: `const canCreate = useCan("create", "SAFETY_SITE");`,
      fixed: `const canCreate = useCan("create", SUBJECTS.area);`,
      miss: [
        {
          note: "an app-level surface has no module registry to read the group from",
          file: "apps/console/src/pages/dashboard.tsx",
          source: `const canCreate = useCan("create", "SAFETY_SITE");`,
        },
      ],
    },
  },
  {
    id: "unsubscribed-access-policy-read",
    invariant: "#52",
    level: "error",
    desc: "A render decision reads a field off the object `useAccess()` returns — that object is the policy itself and is handed back unchanged on every render, so a component whose only subscription is `useCan` re-renders when its own answer flips and never when the grants merely arrive; for everyone the answer does not flip for, the field keeps the value it had before the policy resolved and the screen stays on that branch for ever. Subscribe with useSyncExternalStore(policy.subscribe, policy.getSnapshot, policy.getSnapshot) and decide from the snapshot",
    appliesTo: isTsx,
    check: (c) => {
      // A file that subscribes has made the value reactive, whichever way it then reads it.
      if (/useSyncExternalStore\s*\(/.test(c)) {
        return [];
      }
      // Only a read that DECIDES. Passing `policy.user` on to a child, or printing it, cannot
      // strand a screen — the branch is what does.
      const names = [...c.matchAll(/const\s+(\w+)\s*=\s*useAccess\(\)/g)].map((m) => m[1]);
      if (names.length === 0) {
        return [];
      }
      const reads = names
        .map((name) => new RegExp(
          `if\\s*\\(\\s*!?\\s*${name}\\.(user|roles|ability)\\b|` +
          `${name}\\.(user|roles|ability)\\b[^\\n]*\\?[^\\n]*:`,
          "g",
        ))
        .flatMap((re) => [...c.matchAll(re)]);
      return reads.map((m) => ({
        line: lineOfIndex(c, m.index),
        excerpt: m[0].replace(/\s+/g, " ").slice(0, 140),
      }));
    },
    samples: {
      file: "modules/site/src/widgets/area/detail.tsx",
      broken: `const policy = useAccess();

if (!policy.user) {
  return <SignInPrompt />;
}`,
      fixed: `const policy = useAccess();
const snapshot = useSyncExternalStore(policy.subscribe, policy.getSnapshot, policy.getSnapshot);

if (!snapshot.user) {
  return <SignInPrompt />;
}`,
      miss: [
        {
          note: "handing the value to a child decides nothing, so nothing can be stranded",
          source: `const policy = useAccess();

return <UserMenu user={policy.user} />;`,
        },
        {
          note: "printing it decides nothing either",
          source: `const policy = useAccess();

return <Text>{policy.user.displayName}</Text>;`,
        },
      ],
    },
  },
  {
    id: "ungated-entity-action",
    invariant: "#52",
    level: "review",
    desc: "Detail action footer fires a mutation and the file never calls useCan — an entity action (settle, charge, cancel, refund) is usually gated harder on the server than the read that opened the panel, so the button renders for an operator the call will refuse",
    appliesTo: isTsx,
    // The read that opens a detail panel and the action that leaves it are different permissions
    // (view vs manage/edit). A file that consults useCan at all has made that distinction and is
    // exempt; what this catches is a footer of actions with no gate anywhere in the file.
    check: (c) =>
      /\buseCan\(/.test(c) || !/\.mutateAsync\(/.test(c)
        ? []
        : lineHits(c, /<CrudDetail\.ActionFooter\b/),
    samples: {
      file: "modules/site/src/widgets/area/detail.tsx",
      broken: `const settle = useSettleArea();

<CrudDetail.ActionFooter
  actions={[{ label: t("area.settle"), onClick: () => settle.mutateAsync({ areaId }) }]}
/>`,
      fixed: `const settle = useSettleArea();
const canManage = useCan("manage", SUBJECTS.area);

<CrudDetail.ActionFooter
  actions={canManage ? [{ label: t("area.settle"), onClick: () => settle.mutateAsync({ areaId }) }] : []}
/>`,
      miss: [
        {
          note: "a footer that runs no mutation cannot render a button the server will refuse",
          source: `<CrudDetail.ActionFooter
  actions={[{ label: t("common.print"), onClick: () => window.print() }]}
/>`,
        },
      ],
    },
  },
  {
    id: "lowercase-enum-label",
    invariant: "#10",
    level: "error",
    desc: "enumLabel called with a lower-case enum name — the backend registers enums by their PascalCase simple name, so the key never resolves and the raw key renders",
    appliesTo: isTsx,
    check: (c) => lineHits(c, /enumLabel\(\s*"[a-z]/),
    samples: {
      file: "modules/site/src/widgets/area/list.tsx",
      broken: `{enumLabel("areaStatus", resolveBootEnum(row.status))}`,
      fixed: `{enumLabel("AreaStatus", resolveBootEnum(row.status))}`,
      miss: [
        {
          note: "a name held in a variable is not a literal this rule can read",
          source: `{enumLabel(enumName, resolveBootEnum(row.status))}`,
        },
      ],
    },
  },
  {
    id: "single-line-free-text",
    invariant: "#33",
    level: "error",
    desc: "Free-form prose (note / description / memo / remark / bio) in a single-line TextField — it is written on more than one line, so it takes a TextareaField on a row of its own",
    appliesTo: isTsx,
    check: (c) =>
      blockHits(
        c,
        /<FormFields\.TextField(?:(?!\/>)[\s\S]){0,400}?fieldLabel\("(?:note|description|memo|remark|bio)"\)(?:(?!\/>)[\s\S]){0,400}?\/>/g,
      ),
    samples: {
      file: "modules/site/src/widgets/area/form.tsx",
      broken: `<FormFields.TextField
  label={fieldLabel("memo")}
  value={values.memo ?? ""}
  onChange={(v) => updateField("memo", v)}
/>`,
      fixed: `<FormFields.TextareaField
  label={fieldLabel("memo")}
  rows={4}
  value={values.memo ?? ""}
  onChange={(v) => updateField("memo", v)}
/>`,
      miss: [
        {
          note: "a short value belongs on a single line",
          source: `<FormFields.TextField
  label={fieldLabel("code")}
  value={values.code ?? ""}
  onChange={(v) => updateField("code", v)}
/>`,
        },
      ],
    },
  },
  {
    id: "empty-slot-returns-nothing",
    invariant: "#22",
    level: "error",
    desc: "A table `empty` slot returning null/undefined for some reasons — the slot REPLACES the framework's empty state, error card and paused card, so those reasons render a blank table. Answer every reason, or pass the slot only for the reason it handles",
    appliesTo: isTsx,
    check: (c) =>
      blockHits(
        c,
        /empty:\s*\((?:\{[^}]*\}|\w+)?\)\s*=>(?:(?!\n\s*\}\s*\}|\n\s*\},\s*\n)[\s\S]){0,600}?[:?]\s*(?:null|undefined)\s*[,;)\n]/g,
      ),
    samples: {
      file: "modules/site/src/widgets/area/list.tsx",
      broken: `<CrudList.Table
  list={list}
  slots={{
    empty: ({ reason }) => reason === "no-data" ? <AreaEmptyState onCreate={showNew} /> : null,
  }}
/>`,
      fixed: `<CrudList.Table
  list={list}
  slots={{
    empty: ({ reason }) => reason === "no-data" ? <AreaEmptyState onCreate={showNew} /> : <CrudList.DefaultEmpty reason={reason} />,
  }}
/>`,
      miss: [
        {
          note: "the slot handed over only for the reason it answers, which the description offers as the other fix",
          source: `<CrudList.Table
  list={list}
  slots={{
    empty: list.emptyReason === "no-data" ? () => <AreaEmptyState onCreate={showNew} /> : undefined,
  }}
/>`,
        },
      ],
    },
  },
  {
    id: "system-field-exposure",
    invariant: "audit: system fields",
    level: "review",
    desc: "id / sortOrder / displayOrder surfaced as a visible field — system fields live in auditData only",
    appliesTo: (p) => inModules(p) && isTsx(p),
    // A field the entity's own form edits is a decision the operator makes, not a value the
    // system maintains — an order that ranks a storefront is chosen, and once it is chosen the
    // read surfaces have to say what it currently is. Flagging those would put this rule in
    // direct opposition to `write-only-form-field`, which demands exactly that read.
    check: (c, rel) => {
      const form = path.join(ROOT, path.dirname(rel), "form.tsx");
      const edits = fs.existsSync(form) ? fs.readFileSync(form, "utf8") : "";
      return lineHits(c, /fieldLabel\("(id|sortOrder|displayOrder)"\)/, (line) => {
        const m = /fieldLabel\("(id|sortOrder|displayOrder)"\)/.exec(line);
        return !new RegExp(`updateField\\(\\s*"${m[1]}"`).test(edits);
      });
    },
    samples: {
      file: "modules/site/src/widgets/area/detail.tsx",
      broken: {
        files: {
          "modules/site/src/widgets/area/form.tsx": `<FormFields.TextField label={fieldLabel("name")} value={values.name} onChange={(v) => updateField("name", v)} />`,
        },
        source: `<DetailFields.DetailTextField label={fieldLabel("sortOrder")} value={displayData.sortOrder} />`,
      },
      fixed: {
        files: {
          "modules/site/src/widgets/area/form.tsx": `<FormFields.TextField label={fieldLabel("name")} value={values.name} onChange={(v) => updateField("name", v)} />`,
        },
        source: `<DetailFields.DetailTextField label={fieldLabel("name")} value={displayData.name} />`,
      },
      miss: [
        {
          note: "an order the operator chooses has to be readable back — flagging it would contradict write-only-form-field",
          files: {
            "modules/site/src/widgets/area/form.tsx": `<FormFields.NumberField label={fieldLabel("sortOrder")} value={values.sortOrder} onChange={(v) => updateField("sortOrder", v)} />`,
          },
          source: `<DetailFields.DetailTextField label={fieldLabel("sortOrder")} value={displayData.sortOrder} />`,
        },
      ],
    },
  },
  {
    id: "enum-default-unresolved",
    invariant: "#10 / #36",
    level: "review",
    desc: "Enum-looking field defaulted with ?? and no resolveBootEnum on the line — boot enums are objects, ?? never fires",
    appliesTo: isTsx,
    check: (c) =>
      lineHits(
        c,
        /\.(?!is[A-Z])\w+(Status|Type|Kind|Unit|Mode|Channel)\b\s*\?\?/,
        (line) => !line.includes("resolveBootEnum"),
      ),
    samples: {
      file: "modules/site/src/widgets/area/form.tsx",
      broken: `const status = row.areaStatus ?? "ACTIVE";`,
      fixed: `const status = resolveBootEnum(row.areaStatus) ?? "ACTIVE";`,
      miss: [
        {
          note: "a boolean whose name merely ends in one of the enum words",
          source: `const locked = row.isStatusLocked ?? false;`,
        },
        {
          note: "a plain string field defaulted the ordinary way",
          source: `const name = row.name ?? "-";`,
        },
      ],
    },
  },
  {
    id: "enum-label-empty-fallback",
    invariant: "#36",
    level: "review",
    desc: "enumLabel(..., resolveBootEnum(x) ?? \"\") — an absent enum resolves to the empty string and the resolver prints the message key itself (\"<Enum>.\"); confirm the field can never be null",
    appliesTo: isTsx,
    check: (c) => lineHits(c, /enumLabel\([^)]*resolveBootEnum\([^)]*\)\s*\?\?\s*""/),
    samples: {
      file: "modules/site/src/widgets/area/detail.tsx",
      broken: `<Text>{enumLabel("AreaStatus", resolveBootEnum(displayData.status) ?? "")}</Text>`,
      fixed: `{displayData.status
  ? <Text>{enumLabel("AreaStatus", resolveBootEnum(displayData.status))}</Text>
  : <EmptyValueBadge />}`,
      miss: [
        {
          note: "a real default, which resolves to a word rather than to the key itself",
          source: `<Text>{enumLabel("AreaStatus", resolveBootEnum(displayData.status) ?? "ACTIVE")}</Text>`,
        },
      ],
    },
  },
  {
    id: "stringified-boot-enum",
    invariant: "#36",
    level: "error",
    desc: "Enum-looking field turned into text by String() or template interpolation with no resolveBootEnum on the line — a boot enum is an object, so the cell renders `[object Object]`",
    appliesTo: isTsx,
    check: (c) =>
      // A file holding no server data cannot be holding a boot enum, whatever it names its
      // fields — the same guard `unresolved-boot-enum-label` uses. Without it this fires on
      // every local literal union called `kind`, and a rule that cries wolf takes the real
      // ones beside it down.
      readsServerData(c)
        ? lineHits(
            c,
            // Anchored on the two ways a value becomes text without asking what it is. The
            // dotted path must start with a bare identifier, which keeps `${t("area.type")}`
            // out: that key sits inside quotes and never reaches the interpolation as a
            // property access.
            /(?:String\(\s*|\$\{\s*)(?:[A-Za-z_$][\w$]*\.)+(?!is[A-Z])\w*(?:[Ss]tatus|[Tt]ype|[Kk]ind|[Mm]ode|[Cc]hannel)\b/,
            (line) => !line.includes("resolveBootEnum"),
          )
        : [],
    samples: {
      file: "modules/user-admin/src/widgets/user-account/detail.tsx",
      broken: `import { useGetUserAccount } from "@acme/domain-user";

<TableCell>{String(grant.status ?? "")}</TableCell>`,
      fixed: `import { useGetUserAccount } from "@acme/domain-user";

<TableCell>
  <StatusBadge tone={toneOf(resolveBootEnum(grant.status))} label={enumLabel("ScopeGrantStatus", resolveBootEnum(grant.status))} />
</TableCell>`,
      miss: [
        {
          note: "a local literal union in a file that reads no server data — no boot enum can be in scope",
          source: `type ImpactKind = "automatic" | "rejudge" | "retained";

<Badge>{t(\`impact.\${group.kind}\`)}</Badge>`,
        },
        {
          note: "a translation key that merely contains a dot inside its string",
          source: `import { useGetUserAccount } from "@acme/domain-user";

<Text>{\`\${t("area.type")} — \${name}\`}</Text>`,
        },
        {
          note: "String() over a field that is not an enum",
          source: `import { useGetUserAccount } from "@acme/domain-user";

<TableRow key={String(grant.roleScopeGrantId)}>`,
        },
        {
          note: "a boolean whose name merely ends in one of the enum words",
          source: `import { useGetUserAccount } from "@acme/domain-user";

<Text>{String(row.isTypeLocked)}</Text>`,
        },
      ],
    },
  },
  {
    id: "full-enum-options",
    invariant: "#38",
    level: "review",
    desc: "Object.values(<Enum>).map as WRITE-surface select options — check whether the server narrows the set per record (filters over the full set are fine)",
    appliesTo: (p) => isTsx(p) && /form|dialog|editor|wizard/.test(p),
    check: (c) => lineHits(c, /Object\.values\([A-Z]\w+\)\.map/),
    samples: {
      file: "modules/site/src/widgets/area/form.tsx",
      broken: `<FormFields.SelectField
  label={fieldLabel("status")}
  options={Object.values(AreaStatus).map((v) => ({ value: v, label: enumLabel("AreaStatus", v) }))}
/>`,
      fixed: `<FormFields.SelectField
  label={fieldLabel("status")}
  options={readiness.allowedStatuses.map((v) => ({ value: v, label: enumLabel("AreaStatus", v) }))}
/>`,
      miss: [
        {
          note: "a filter over the full set is fine — the server narrows what may be WRITTEN, not what may be searched",
          file: "modules/site/src/widgets/area/list.tsx",
          source: `const statusOptions = Object.values(AreaStatus).map((v) => ({ value: v, label: enumLabel("AreaStatus", v) }));`,
        },
      ],
    },
  },
  {
    id: "unitless-rate-field",
    invariant: "#36",
    level: "review",
    desc: "Rate/percent field rendered or edited with no unit — confirm whether it is a percentage, then mark it (suffix=\"%\" on the input, format=\"percent\" on the read) so a fraction cannot be typed where a percentage is stored",
    appliesTo: isTsx,
    check: (c) => {
      // A percentage with no unit beside it is read as a fraction by half its readers and
      // written as one by the other half; the mismatch reaches an invoice before anyone sees it.
      const RATE_FIELD = /\b\w*(?:[Rr]ate|[Pp]ercent|[Pp]ct)\b/;
      const UNIT_MARKED = /suffix=|format="percent"|unit=|%/;
      const hits = [];
      const re = /<(?:FormFields\.NumberField|DetailFields\.DetailNumberField)\b(?:(?!\/>)[\s\S]){0,500}?\/>/g;
      for (const m of c.matchAll(re)) {
        const block = m[0];
        const label = block.match(/label=\{[^}]*\}|label="[^"]*"/)?.[0] ?? "";
        const value = block.match(/value=\{[\s\S]*?\}\s*\n/)?.[0] ?? "";
        if (!RATE_FIELD.test(label) && !RATE_FIELD.test(value)) continue;
        if (UNIT_MARKED.test(block)) continue;
        hits.push({ line: lineOfIndex(c, m.index), excerpt: block.replace(/\s+/g, " ").slice(0, 140) });
      }
      return hits;
    },
    samples: {
      file: "modules/site/src/widgets/area/form.tsx",
      broken: `<FormFields.NumberField
  label={fieldLabel("occupancyRate")}
  value={values.occupancyRate}
  onChange={(v) => updateField("occupancyRate", v)}
/>`,
      fixed: `<FormFields.NumberField
  label={fieldLabel("occupancyRate")}
  suffix="%"
  value={values.occupancyRate}
  onChange={(v) => updateField("occupancyRate", v)}
/>`,
      miss: [
        {
          note: "a count is a number with no unit to state",
          source: `<FormFields.NumberField
  label={fieldLabel("capacity")}
  value={values.capacity}
  onChange={(v) => updateField("capacity", v)}
/>`,
        },
        {
          note: "a read surface that already declares the unit",
          source: `<DetailFields.DetailNumberField
  label={fieldLabel("occupancyRate")}
  format="percent"
  value={displayData.occupancyRate}
/>`,
        },
      ],
    },
  },
  {
    id: "two-state-branching",
    invariant: "#38",
    level: "review",
    desc: "Two-state ternary on a status/presence value — the third state falls into the wrong arm",
    appliesTo: isTsx,
    check: (c) =>
      lineHits(c, /\b(presence|status)\s*===\s*"[A-Z_]+"\s*\?/, (line) => !line.includes("switch")),
    samples: {
      file: "modules/site/src/widgets/visit/detail.tsx",
      broken: `{visit.presence === "CHECKED_IN" ? <CheckOutButton visitId={visit.visitId} /> : <CheckInButton visitId={visit.visitId} />}`,
      fixed: `{(() => {
  switch (resolveBootEnum(visit.presence)) {
    case "CHECKED_IN":
      return <CheckOutButton visitId={visit.visitId} />;
    case "EXPECTED":
      return <CheckInButton visitId={visit.visitId} />;
    default:
      return null;
  }
})()}`,
      miss: [
        {
          note: "a comparison that names a state rather than branching a flow on two of them",
          source: `const isCheckedIn = visit.presence === "CHECKED_IN";`,
        },
      ],
    },
  },
  {
    id: "refusal-told-twice",
    invariant: "#40",
    level: "review",
    desc: "A screen catches a mutation's refusal and renders it itself, but its hook does not carry `meta.suppressErrorDialog` — so the app's global error dialog lands on top saying the same thing. The reader dismisses a modal to reach the sentence underneath it, and where the screen's own report IS the content (a bulk run's failed rows), the modal covers exactly what they opened it for",
    appliesTo: isTsx,
    check: (c, rel) => {
      // An app with no such dialog cannot tell anybody twice.
      if (!underGlobalErrorDialog(rel)) return [];
      // Only where the file both catches and reports: a `catch` that puts the message on screen.
      if (!/catch\s*\([\s\S]{0,400}?\bset(?:Error|SubmitError|Failure)\b|failures\.push\(/.test(c)) return [];
      if (/suppressErrorDialog|handledByForm|handlesConflict/.test(c)) return [];
      // And only the hook whose result is the one being awaited. Every other zero-argument hook
      // in the file — a navigator, a clipboard, a read — has nothing to do with this dialog, and
      // reporting them is how an audit stops being read.
      const awaited = new Set([...c.matchAll(/\b(\w+)\s*\.\s*mutateAsync\b/g)].map((m) => m[1]));
      if (awaited.size === 0) return [];
      const names = [...awaited].join("|");
      return lineHits(c, new RegExp(`\\bconst\\s+(?:${names})\\s*=\\s*use[A-Z]\\w*\\(\\s*\\)`));
    },
    samples: (() => {
      // An app that installs the cache is what makes a second telling possible; without one the
      // screen's own sentence is the whole of the reporting.
      const appWithDialog = {
        "apps/console/src/app/query-client.ts": `export const queryClient = new QueryClient({
  mutationCache: new MutationCache({ onError: (error) => openErrorDialog(error) }),
});
`,
      };
      return {
        file: "modules/site/src/widgets/area/bulk-settle.tsx",
        broken: {
          files: appWithDialog,
          source: `const settle = useSettleArea();

async function run() {
  for (const areaId of selected) {
    try {
      await settle.mutateAsync({ areaId });
    } catch (error) {
      failures.push({ areaId, message: toMessage(error) });
    }
  }
}`,
        },
        fixed: {
          files: appWithDialog,
          source: `const settle = useSettleArea({ meta: { suppressErrorDialog: true } });

async function run() {
  for (const areaId of selected) {
    try {
      await settle.mutateAsync({ areaId });
    } catch (error) {
      failures.push({ areaId, message: toMessage(error) });
    }
  }
}`,
        },
        miss: [
          {
            note: "an app that mounts no such cache cannot tell anybody twice",
            source: `const settle = useSettleArea();

async function run() {
  try {
    await settle.mutateAsync({ areaId });
  } catch (error) {
    failures.push({ areaId, message: toMessage(error) });
  }
}`,
          },
          {
            note: "a catch that logs rather than reports leaves the dialog as the only telling",
            files: appWithDialog,
            source: `const settle = useSettleArea();

async function run() {
  try {
    await settle.mutateAsync({ areaId });
  } catch (error) {
    console.error(error);
  }
}`,
          },
          {
            note: "the other zero-argument hooks in the file have nothing to do with the dialog",
            files: appWithDialog,
            source: `const navigate = useNavigate();
const copy = useClipboard();
const settle = useSettleArea({ meta: { suppressErrorDialog: true } });

async function run() {
  try {
    await settle.mutateAsync({ areaId });
  } catch (error) {
    failures.push({ areaId, message: toMessage(error) });
  }
}`,
          },
        ],
      };
    })(),
  },
  {
    id: "one-message-for-several-states",
    invariant: "#55",
    level: "review",
    desc: "One user-facing message serves a branch guarded on several statuses — the sentence names a cause only one of them had, so it is false for the rest (an order the buyer cancelled told 'the deadline passed and the account was withdrawn'). Split the key per cause and pick between them, or write a sentence true of every status in the guard",
    appliesTo: isTsx,
    check: (c) => {
      const hits = [];
      // A branch entered by two or more statuses whose body never mentions the status again:
      // every one of them is then handed the same sentence. A body that does look at the status
      // — a second comparison, a key chosen into a variable — is the fix, so it is not reported.
      const guard = /if\s*\([^)]*\b(?:status|state|phase)\s*===\s*"[A-Z_]+"[^)]*\|\|[^)]*===\s*"[A-Z_]+"[^)]*\)\s*\{([\s\S]{0,1200}?)\n\s{0,4}\}/g;
      for (const m of c.matchAll(guard)) {
        const body = m[1];
        if (!/\bt\(\s*"/.test(body)) continue;
        if (/\b(?:status|state|phase)\b/.test(body)) continue;
        hits.push({ line: lineOfIndex(c, m.index), excerpt: m[0].replace(/\s+/g, " ").slice(0, 140) });
      }
      return hits;
    },
    samples: {
      file: "modules/order/src/widgets/order/detail.tsx",
      broken: `if (order.status === "CANCELLED" || order.status === "EXPIRED") {
  return <AlertBanner tone="warning" title={t("order.closedDeadlinePassed")} />;
}`,
      fixed: `if (order.status === "CANCELLED" || order.status === "EXPIRED") {
  const key = order.status === "CANCELLED" ? "order.cancelledByBuyer" : "order.expired";
  return <AlertBanner tone="warning" title={t(key)} />;
}`,
      miss: [
        {
          note: "a branch that says nothing to the reader has no sentence to be wrong",
          source: `if (order.status === "CANCELLED" || order.status === "EXPIRED") {
  return null;
}`,
        },
      ],
    },
  },
  {
    id: "long-value-in-a-label-row",
    invariant: "#36",
    level: "error",
    desc: "A label-and-trailing row (DetailListRow / LabeledField) is handed a value that wraps on its own — `break-all`, `whitespace-pre`, or a `font-mono` URL or key. The row gives the width to the trailing slot and truncates the label away, leaving values with nothing saying which is which. Stack the pair instead: a caption for the label, the value under it",
    appliesTo: isTsx,
    check: (c) => {
      const hits = [];
      // The row element, then its own props — a value that declares it will wrap is a value the
      // row was never sized for. Bounded so the next element's props are not read as this one's.
      const row = /<(DetailListRow|LabeledField)\b([\s\S]{0,600}?)\/>/g;
      for (const m of c.matchAll(row)) {
        if (!/\b(?:break-all|break-words|whitespace-pre)\b/.test(m[2])) continue;
        hits.push({ line: lineOfIndex(c, m.index), excerpt: m[0].replace(/\s+/g, " ").slice(0, 140) });
      }
      return hits;
    },
    samples: {
      file: "modules/site/src/widgets/area/detail.tsx",
      broken: `<DetailListRow
  primary={fieldLabel("callbackUrl")}
  trailing={<Text className="font-mono break-all">{displayData.callbackUrl}</Text>}
/>`,
      fixed: `<Stack gap="xs">
  <Text variant="caption" tone="muted">{fieldLabel("callbackUrl")}</Text>
  <Text className="font-mono break-all">{displayData.callbackUrl}</Text>
</Stack>`,
      miss: [
        {
          note: "a trailing value the row was sized for",
          source: `<DetailListRow
  primary={fieldLabel("status")}
  trailing={<StatusBadge tone="success" />}
/>`,
        },
      ],
    },
  },
  {
    id: "read-failure-reads-as-loading",
    invariant: "#33",
    level: "error",
    desc: "A screen's only not-ready branch is `isLoading || !data` returning a skeleton, with no branch on that read failing — the read fails, `data` stays absent, and the screen holds the skeleton for as long as the reader waits, naming no reason and offering nothing to press",
    appliesTo: isTsx,
    check: (c) => {
      // Only the shape that traps. `isLoading || !data` is correct wherever the falling-through
      // case terminates in something — the framework's QueryFallback says "not found", an error
      // state says why. A raw skeleton says neither and never stops saying it.
      // The `<` is SHARED with the Skeleton rather than demanding one before it: written
      // `<[\s\S]{0,400}?<Skeleton`, the pattern needed a wrapper element and so could not see
      // `return <Skeleton />`, which is how the guard is most often written. The return must
      // still open with JSX, so `return null;` beside a Skeleton elsewhere stays silent.
      const trapping = [...c.matchAll(
        /if\s*\([^)]*\bisLoading\b[^)]*\|\|[^)]*\)\s*\{?\s*return\s*\(?\s*<(?:[\s\S]{0,400}?<)?Skeleton\b/g,
      )];
      if (trapping.length === 0) {
        return [];
      }
      // Any settled-failure branch anywhere in the file counts — the point is that the screen
      // stops drawing a wait it will never end, not which component says so.
      if (/isError|isLoadingError|QueryFallback|ErrorState|\.error\b/.test(c)) {
        return [];
      }
      return trapping.map((m) => ({
        line: lineOfIndex(c, m.index),
        excerpt: m[0].replace(/\s+/g, " ").slice(0, 140),
      }));
    },
    samples: {
      file: "modules/site/src/widgets/area/detail.tsx",
      broken: `const area = useGetArea(areaId);

if (area.isLoading || !area.data) {
  return (
    <Stack gap="sm">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-full" />
    </Stack>
  );
}

return <AreaPanel area={area.data} />;`,
      fixed: `const area = useGetArea(areaId);

if (area.isError) {
  return <ErrorState title={t("area.readFailed")} onRetry={area.refetch} />;
}

if (area.isLoading || !area.data) {
  return (
    <Stack gap="sm">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-full" />
    </Stack>
  );
}

return <AreaPanel area={area.data} />;`,
      miss: [
        {
          note: "the fall-through terminates in the framework's own fallback, which says why",
          source: `const area = useGetArea(areaId);

if (area.isLoading || !area.data) {
  return <Skeleton className="h-6 w-48" />;
}

return <QueryFallback query={area}><AreaPanel area={area.data} /></QueryFallback>;`,
        },
        {
          note: "a single-condition guard falls THROUGH rather than trapping — the next rule's business",
          source: `const area = useGetArea(areaId);

if (area.isLoading) {
  return <Skeleton className="h-6 w-48" />;
}

return <AreaPanel area={area.data} />;`,
        },
      ],
    },
  },
  {
    id: "read-failure-falls-through-loading-guard",
    invariant: "#33",
    level: "error",
    desc: "A screen guards only on ONE query's `isLoading` and never branches on THAT query's failure — the read fails, `isLoading` goes false, and the screen falls straight through into its loaded layout built from undefined, stating as fact whatever absent data spells out",
    appliesTo: isTsx,
    check: (c) => {
      // The single-condition guard specifically. `isLoading || !data` traps in the skeleton and
      // is the previous rule's business; a bare `isLoading` falls THROUGH, which is worse — the
      // screen answers confidently out of nothing instead of visibly waiting.
      const guards = [...c.matchAll(
        /if\s*\(\s*([A-Za-z_$][\w$]*)\.isLoading\s*\)\s*\{?\s*return\s*\(?\s*<(?:[\s\S]{0,500}?<)?Skeleton\b/g,
      )];
      if (guards.length === 0) {
        return [];
      }
      // Per query, not per file. A file-wide escape lets ONE read's failure branch vouch for
      // every other read in the file — which is exactly how a screen came to have a careful
      // "could not be read" line for its quota table and none for the verdict deciding whether
      // it announced the deployment had no licence at all.
      const aliases = (base) =>
        [...c.matchAll(/const\s+([\w$]+)\s*=\s*adaptOrval\w+(?:<[^>]*>)?\(\s*([\w$]+)/g)]
          .filter((m) => m[2] === base)
          .map((m) => m[1]);
      const handled = (name) =>
        [name, ...aliases(name)].some((n) =>
          new RegExp(`\\b${n}\\.(?:isError|isLoadingError|error)\\b`).test(c),
        );
      // A wrapper that owns the failure branch without naming the query still counts.
      if (/QueryFallback|ErrorState/.test(c)) {
        return [];
      }
      return guards
        .filter((m) => !handled(m[1]))
        .map((m) => ({
          line: lineOfIndex(c, m.index),
          excerpt: m[0].replace(/\s+/g, " ").slice(0, 140),
        }));
    },
    samples: {
      file: "modules/licence/src/widgets/deployment/verdict.tsx",
      // One read's careful failure branch standing in for another's is the whole point: the quota
      // table says it could not be read, and the verdict beside it announces out of undefined
      // that the deployment has no licence at all.
      broken: `const verdict = useGetLicenceVerdict(deploymentId);
const quota = useGetQuota(deploymentId);

if (verdict.isLoading) {
  return <Skeleton className="h-6 w-48" />;
}

if (quota.isError) {
  return <QuotaUnavailable onRetry={quota.refetch} />;
}

return <VerdictPanel verdict={verdict.data} quota={quota.data} />;`,
      fixed: `const verdict = useGetLicenceVerdict(deploymentId);
const quota = useGetQuota(deploymentId);

if (verdict.isLoading) {
  return <Skeleton className="h-6 w-48" />;
}

if (verdict.isError) {
  return <ErrorState title={t("licence.verdictUnreadable")} onRetry={verdict.refetch} />;
}

return <VerdictPanel verdict={verdict.data} quota={quota.data} />;`,
      miss: [
        {
          note: "the failure is branched on through the adapted alias rather than the raw query",
          source: `const raw = useGetAreaRaw(areaId);
const area = adaptOrvalDetail(raw);

if (raw.isLoading) {
  return <Skeleton className="h-6 w-48" />;
}

if (area.isError) {
  return <Text>{t("area.readFailed")}</Text>;
}

return <AreaPanel area={area.data} />;`,
        },
        {
          note: "a guard that traps in the skeleton is the previous rule's shape, not this one's",
          source: `const area = useGetArea(areaId);

if (area.isLoading || !area.data) {
  return <Skeleton className="h-6 w-48" />;
}

return <AreaPanel area={area.data} />;`,
        },
        {
          note: "a guard that returns nothing is not a guard that draws a wait it cannot end",
          source: `const area = useGetArea(areaId);

if (area.isLoading) {
  return null;
}

return (
  <Suspense fallback={<Skeleton className="h-6 w-48" />}>
    <AreaPanel area={area.data} />
  </Suspense>
);`,
        },
      ],
    },
  },
  {
    id: "read-failure-reads-as-empty",
    invariant: "#33",
    level: "review",
    desc: "Component reads a query's data and draws an emptiness without ever branching on failure — a read that failed renders the empty state, and the reader concludes they own nothing rather than that nothing was fetched",
    appliesTo: isTsx,
    check: (c) => {
      // Only components that actually draw an emptiness. A widget that renders whatever it got
      // and nothing else says nothing false when it gets nothing.
      const CLAIMS_EMPTY = /<EmptyState\b|emptyTitle|noOptions|\?\?\s*\[\]|\?\?\s*\{\}/;
      if (!CLAIMS_EMPTY.test(c)) {
        return [];
      }
      // Only a failure branch counts. A pending branch draws a skeleton and then falls into the
      // same empty state, so `isPending` protects nothing here — and matching it file-wide let a
      // mutation's own pending flag silence the rule for every read in the file.
      const HANDLES = /isError|isLoadingError|\.error\b|QueryFallback|ErrorState/;
      if (HANDLES.test(c)) {
        return [];
      }
      return lineHits(c, /=\s*use(?:Get|List|Search|Read)[A-Z]\w*\(|=\s*useQuery\(/);
    },
    samples: {
      file: "modules/site/src/widgets/area/panel.tsx",
      broken: `const areas = useListAreas({ siteId });
const rows = areas.data?.content ?? [];

if (rows.length === 0) {
  return <EmptyState title={t("area.noneYet")} />;
}

return <AreaRows rows={rows} />;`,
      fixed: `const areas = useListAreas({ siteId });
const rows = areas.data?.content ?? [];

if (areas.isError) {
  return <ErrorState title={t("area.readFailed")} onRetry={areas.refetch} />;
}

if (rows.length === 0) {
  return <EmptyState title={t("area.noneYet")} />;
}

return <AreaRows rows={rows} />;`,
      miss: [
        {
          note: "a widget that draws what it was given and claims no emptiness says nothing false when it gets nothing",
          source: `const areas = useListAreas({ siteId });

return (
  <Stack gap="xs">
    {areas.data?.content.map((area) => <AreaRow key={area.areaId} area={area} />)}
  </Stack>
);`,
        },
      ],
    },
  },
  {
    id: "form-seeded-from-read-without-error-branch",
    invariant: "#33",
    level: "error",
    desc: "A form copies a query's data into its own state and offers a save, with no branch on that read failing — the read fails, the form stands holding its initial values, and saving writes those over what was stored",
    appliesTo: isTsx,
    check: (c) => {
      // Only a form that seeds itself. An effect that copies a read into local state is the
      // shape that survives a failed read holding defaults; a field bound straight to
      // `query.data` renders empty instead, which is the emptiness rule's business.
      const seeding = [...c.matchAll(/useEffect\(\s*\(\s*\)\s*=>\s*\{[\s\S]{0,700}?\n\s*\}\s*,\s*\[/g)]
        .filter((m) => /\.data\b/.test(m[0]) && /\bset[A-Z]\w*\(/.test(m[0]));
      if (seeding.length === 0) {
        return [];
      }
      // Only a form that can write back. A seeded read-only panel says nothing false when it
      // says nothing at all.
      if (!/\.mutateAsync\(|\.mutate\(/.test(c)) {
        return [];
      }
      // Any failure branch counts, wherever it stands — the point is that the screen refuses to
      // draw a form it cannot fill, not which component says so.
      if (/isError|isLoadingError|ErrorState/.test(c)) {
        return [];
      }
      return seeding.map((m) => ({
        line: lineOfIndex(c, m.index),
        excerpt: m[0].replace(/\s+/g, " ").slice(0, 140),
      }));
    },
    samples: {
      file: "modules/site/src/widgets/area/settings-form.tsx",
      broken: `const area = useGetArea(areaId);
const update = useUpdateArea();
const [name, setName] = useState("");

useEffect(() => {
  if (area.data) {
    setName(area.data.name ?? "");
  }
}, [area.data]);

async function save() {
  await update.mutateAsync({ areaId, data: { name } });
}`,
      fixed: `const area = useGetArea(areaId);
const update = useUpdateArea();
const [name, setName] = useState("");

useEffect(() => {
  if (area.data) {
    setName(area.data.name ?? "");
  }
}, [area.data]);

if (area.isError) {
  return <ErrorState title={t("area.readFailed")} onRetry={area.refetch} />;
}

async function save() {
  await update.mutateAsync({ areaId, data: { name } });
}`,
      miss: [
        {
          note: "a seeded panel that cannot write back says nothing false when it says nothing",
          source: `const area = useGetArea(areaId);
const [name, setName] = useState("");

useEffect(() => {
  if (area.data) {
    setName(area.data.name ?? "");
  }
}, [area.data]);

return <Text>{name}</Text>;`,
        },
        {
          note: "a field bound straight to the query renders empty rather than holding defaults",
          source: `const area = useGetArea(areaId);
const update = useUpdateArea();

return (
  <FormFields.TextField
    value={area.data?.name ?? ""}
    onChange={(v) => update.mutateAsync({ areaId, data: { name: v } })}
  />
);`,
        },
      ],
    },
  },
  {
    id: "link-acts-before-it-reads",
    invariant: "#33",
    level: "review",
    desc: "Screen acts on a one-time link token without reading the link first — a spent, expired or unknown link is offered as live, the visitor agrees to something, and the refusal only arrives after the click; the same read is what lets the screen name whose record it is about instead of asking about \"this address\"",
    appliesTo: isTsx,
    check: (c) => {
      // Only a screen whose whole authority is a token that arrived from outside — in the
      // address or handed down from the route that read it. A token the app itself holds
      // (a session, a CSRF value) is not a link.
      const CARRIES_LINK_TOKEN = /\btoken\b\s*[:?]?\s*string|useSearch\(\)[\s\S]{0,80}\btoken\b|search\.token\b/;
      if (!CARRIES_LINK_TOKEN.test(c)) {
        return [];
      }
      // A route that hands the token to the screen below it is not the screen. Reading the link
      // is that component's job, and the acting call it finds here is a callback it will be
      // given rather than a button this file offers.
      if (/\btoken=\{/.test(c)) {
        return [];
      }
      // Only a screen that offers to spend it. A page that merely displays the token, or one
      // that redirects, promises nothing it cannot keep.
      const acting = [...c.matchAll(/\bmutateAsync\(\s*\{\s*data:\s*\{\s*token\b|\bact\(\s*token\s*\)/g)];
      if (acting.length === 0) {
        return [];
      }
      // Any read of the link before the action counts, whatever it is called. Two shapes do it,
      // and a rule that knows only the first calls the better one a defect.
      //
      // A mount effect that asks about the token and parks the answer is the first: a later
      // branch gates the button on what it parked, and a screen that only knows the token is
      // non-empty is the one that cannot tell a live link from a dead one.
      //
      // A hook the token is passed to is the second, and it is the shape to prefer — the answer
      // arrives as query state rather than as a piece of component state an effect has to keep in
      // step, and React's development double-mount cannot leave it unsettled. `useX(token)` is
      // unambiguous here because the acting call spends the token inside a `data:` payload, never
      // as a bare argument.
      const readsInEffect = [...c.matchAll(/useEffect\(\s*\(\s*\)\s*=>\s*\{[\s\S]{0,900}?\n\s*\}\s*,\s*\[/g)]
        .some((m) => /\btoken\b/.test(m[0]) && /\bset[A-Z]\w*\(/.test(m[0]));
      const readsThroughHook = /\buse[A-Z]\w*\(\s*token\s*[,)]/.test(c);
      if (readsInEffect || readsThroughHook) {
        return [];
      }
      return acting.map((m) => ({
        line: lineOfIndex(c, m.index),
        excerpt: m[0].replace(/\s+/g, " ").slice(0, 140),
      }));
    },
    samples: {
      file: "modules/account/src/widgets/contact-change/confirm.tsx",
      broken: `const search = Route.useSearch();
const token = search.token;
const confirm = useConfirmContactChange();

return (
  <Button onClick={() => confirm.mutateAsync({ data: { token } })}>
    {t("contactChange.confirm")}
  </Button>
);`,
      fixed: `const search = Route.useSearch();
const token = search.token;
const link = useContactChangeLink(token);
const confirm = useConfirmContactChange();

if (link.isError || link.data?.spent) {
  return <AlertBanner tone="warning" title={t("contactChange.linkNoLongerValid")} />;
}

return (
  <Button onClick={() => confirm.mutateAsync({ data: { token } })}>
    {t("contactChange.confirmFor", { address: link.data?.maskedAddress })}
  </Button>
);`,
      miss: [
        {
          note: "a route handing the token down — reading the link is the component below's job",
          source: `const search = Route.useSearch();

return (
  <ContactChangeConfirm
    token={search.token}
    act={(value) => confirm.mutateAsync({ data: { token: value } })}
  />
);`,
        },
        {
          note: "the link read parked by a mount effect, with the button gated on what it parked",
          source: `const search = Route.useSearch();
const token = search.token;
const [link, setLink] = useState(null);

useEffect(() => {
  readContactChangeLink(token).then((data) => setLink(data));
}, [token]);

if (!link?.live) {
  return <AlertBanner tone="warning" title={t("contactChange.linkNoLongerValid")} />;
}

return (
  <Button onClick={() => confirm.mutateAsync({ data: { token } })}>
    {t("contactChange.confirm")}
  </Button>
);`,
        },
        {
          note: "a token the app itself holds is not a link",
          source: `const { accessToken } = useSession();

return <Button onClick={() => refresh.mutateAsync({ data: { accessToken } })}>{t("common.refresh")}</Button>;`,
        },
      ],
    },
  },
  {
    id: "silent-mutation-outcome",
    invariant: "#33",
    level: "review",
    desc: "Action handler awaits a mutation and only invalidates — nothing tells the operator what happened, and a call that succeeded is not an operation that worked (a gateway charge the card refused returns 200 with false)",
    appliesTo: isTsx,
    check: (c) => {
      // The handler body from the awaited mutation to the end of the arrow function. A handler
      // that says nothing is indistinguishable, on screen, from a button that did nothing —
      // which is how an operator retries a charge they have already made.
      const hits = [];
      for (const m of c.matchAll(/onClick=\{[\s\S]{0,600}?\}\}/g)) {
        const body = m[0];
        if (!/\.mutateAsync\(/.test(body)) {
          continue;
        }
        // Anything that reaches the reader counts: a toast, a dialog closing, a route change,
        // or any state the handler writes for the surface to render (a saved flag, an error).
        if (/addToast|toast\(|onSuccess|onDone|onClose|navigate\(|Dialog|\bset[A-Z]\w*\(/.test(body)) {
          continue;
        }
        hits.push({ line: lineOfIndex(c, m.index), excerpt: body.replace(/\s+/g, " ").slice(0, 140) });
      }
      return hits;
    },
    samples: {
      file: "modules/order/src/widgets/order/detail.tsx",
      broken: `<Button
  onClick={async () => {
    await charge.mutateAsync({ orderId });
    await invalidate();
  }}
>
  {t("order.charge")}
</Button>`,
      fixed: `<Button
  onClick={async () => {
    await charge.mutateAsync({ orderId });
    await invalidate();
    addToast({ title: t("order.charged") });
  }}
>
  {t("order.charge")}
</Button>`,
      miss: [
        {
          note: "leaving the screen is itself the answer",
          source: `<Button
  onClick={async () => {
    await charge.mutateAsync({ orderId });
    navigate({ to: "/orders" });
  }}
>
  {t("order.charge")}
</Button>`,
        },
        {
          note: "state the handler writes for the surface to render",
          source: `<Button
  onClick={async () => {
    const receipt = await charge.mutateAsync({ orderId });
    setReceipt(receipt);
  }}
>
  {t("order.charge")}
</Button>`,
        },
      ],
    },
  },
  {
    id: "create-and-update-share-one-body",
    invariant: "#34",
    level: "error",
    desc: "One payload object is handed to both the create and the update, and it carries a create-time constant — a status, an order, an `active: true`. Editing an existing record therefore writes that constant over what the record had: the operator changes a name and the row silently goes back to its opening state. Nothing fails, and the damage is only visible in the database",
    appliesTo: isSource,
    check: (c) => {
      // Every identifier the `data:` of one call is built out of: a bare `data: body`, or each
      // `...body` spread inside the object. A create branch and an update branch that share the
      // fields a person typed are right; what is wrong is sharing the object that also holds what
      // creation decides.
      const sourcesOf = (text) => {
        const out = new Set();
        const bare = /data:\s*([A-Za-z_$][\w$]*)\s*[,)}]/.exec(text);
        if (bare) out.add(bare[1]);
        const brace = /data:\s*\{/.exec(text);
        if (brace) {
          for (const s of text.slice(brace.index).matchAll(/\.\.\.\s*([A-Za-z_$][\w$]*)/g)) {
            out.add(s[1]);
          }
        }
        return out;
      };
      // The call's own argument text, read to its balanced close paren — a fixed slice runs into
      // the next call and reports the two branches as one.
      const argsAt = (from) => {
        let depth = 0;
        for (let i = from; i < c.length && i < from + 4000; i++) {
          if (c[i] === "(") depth++;
          else if (c[i] === ")") {
            depth--;
            if (depth === 0) return c.slice(from, i + 1);
          }
        }
        return c.slice(from, from + 4000);
      };
      const grab = (re) => {
        const out = new Map();
        for (const m of c.matchAll(re)) {
          const open = c.indexOf("(", m.index + m[0].length - 1);
          for (const id of sourcesOf(argsAt(open))) {
            if (!out.has(id)) out.set(id, lineOfIndex(c, m.index));
          }
        }
        return out;
      };
      const creates = grab(/\b\w*[Cc]reate\w*\.mutateAsync\s*\(/g);
      const updates = grab(/\b\w*[Uu]pdate\w*\.mutateAsync\s*\(/g);
      const hits = [];
      for (const [id, line] of updates) {
        if (!creates.has(id)) continue;
        // The shared object is only a defect when creation's own answers are inside it. A literal
        // constant is what that looks like: an enum member, a boolean, a number.
        const decl = new RegExp(`\\b${id}\\s*=\\s*\\{`).exec(c);
        if (!decl) continue;
        // The declaration's own braces, not a slice — a fixed window runs past the object into
        // the create branch below it, where the create-time constants correctly are, and the rule
        // then fires on the very shape it exists to accept.
        const open = c.indexOf("{", decl.index);
        let depth = 0;
        let body = "";
        for (let i = open; i < c.length && i < open + 4000; i++) {
          if (c[i] === "{") depth++;
          else if (c[i] === "}") {
            depth--;
            if (depth === 0) { body = c.slice(open, i + 1); break; }
          }
        }
        if (!/\w+:\s*(?:true|false|-?\d+(?:\.\d+)?|[A-Z][\w$]*\.[A-Z][\w$]*)\s*[,\n}]/.test(body)) {
          continue;
        }
        hits.push({ line, excerpt: `\`${id}\` is the whole body of the create and of the update` });
      }
      return hits;
    },
    samples: {
      file: "modules/site/src/widgets/area/dialog.tsx",
      broken: `const commit = () => {
  const body = {
    siteId,
    areaName: areaName.trim(),
    sortOrder: 0,
    status: AreaStatus.ACTIVE,
  };
  const write = creating
    ? create.mutateAsync({ data: body })
    : update.mutateAsync({ areaId, data: { ...body, areaId } });
  return write;
};`,
      fixed: `const commit = () => {
  const edited = { areaName: areaName.trim() };
  const write = creating
    ? create.mutateAsync({ data: { siteId, ...edited, sortOrder: 0, status: AreaStatus.ACTIVE } })
    : update.mutateAsync({ areaId, data: { ...updateBody(loaded), areaId, siteId, ...edited } });
  return write;
};`,
      miss: [
        {
          note: "the create-time answers sit inside the create branch, where they belong",
          source: `const commit = () => {
  const edited = { areaName: areaName.trim() };
  const write = creating
    ? create.mutateAsync({ data: { ...edited, active: true, priority: 100 } })
    : update.mutateAsync({ areaId, data: { ...loaded, areaId, ...edited } });
  return write;
};`,
        },
        {
          note: "a shared object of what the person typed, with no constant of creation's own in it",
          source: `const commit = () => {
  const edited = { areaName: areaName.trim(), note: note.trim() || undefined };
  const write = creating
    ? create.mutateAsync({ data: { siteId, ...edited } })
    : update.mutateAsync({ areaId, data: { ...loaded, areaId, ...edited } });
  return write;
};`,
        },
      ],
    },
  },
  {
    id: "update-body-enumerated",
    invariant: "#34",
    level: "error",
    desc: "An update body names fewer fields than the endpoint's own DTO declares and never spreads the record the edit read answered with — spreading the form's own values is not the same thing, because those are the fields the screen shows and the missing ones are exactly the fields it does not — the endpoint takes the whole record, so every field the body leaves out is absent from the request and the server writes it away. A hand-kept list always falls behind the DTO, and what falls off first is the translations, which no screen displays. Spread the record the edit read answered with and put the edited fields on top of it",
    appliesTo: isSource,
    check: (c) => {
      // The contract, read from the generated model the update hook names. An endpoint whose DTO
      // is not on hand is an unknown contract, and an unknown contract is not evidence of a
      // defect — a body that names every field the DTO declares is complete and is left alone.
      const index = modelIndex();
      // The contract of ONE update hook, or null where this repository has no DTO of that name.
      const contractOf = (hookEntity) => {
        const entity = hookEntity.charAt(0).toLowerCase() + hookEntity.slice(1);
        if (!index.has(entity + "UpdateDTO")) return null;
        const shape = index.get(entity + "UpdateDTO");
        // What the endpoint's own read answers with. A field the write accepts and the read never
        // returns is written per save and stored nowhere — a reason, an idempotency key — so
        // leaving it out blanks nothing and is not this defect.
        const held =
          index.get(entity + "UpdateFormDTO")
          ?? index.get(entity + "DetailDTO")
          ?? index.get(entity + "DTO")
          ?? null;
        if (!shape || shape.size === 0 || !held) return null;
        return { dto: shape, stored: held };
      };
      // Which contract each `mutateAsync` receiver is bound to. One file routinely holds several
      // update endpoints over one record — a settings save, a security-sensitive save, a child
      // collection's save — and each takes a DTO of its own. Resolved file-wide, every body in
      // such a file is measured against whichever DTO happened to be found first, and a body that
      // is complete for its own endpoint is reported as blanking fields that endpoint never took.
      const byReceiver = new Map();
      for (const m of c.matchAll(
        /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*use[Uu]pdate([A-Z]\w*)\s*\(/g,
      )) {
        byReceiver.set(m[1], contractOf(m[2]));
      }
      let dto = null;
      let stored = null;
      for (const m of c.matchAll(/\buse[Uu]pdate([A-Z]\w*)\s*\(/g)) {
        const contract = contractOf(m[1]);
        if (!contract) continue;
        dto = contract.dto;
        stored = contract.stored;
        break;
      }
      if (!dto || dto.size === 0 || !stored) return [];
      // The object literal that starts at `from`, read to its balanced close brace.
      const objectAt = (from) => {
        let depth = 0;
        for (let i = from; i < c.length && i < from + 4000; i++) {
          if (c[i] === "{") depth++;
          else if (c[i] === "}") {
            depth--;
            if (depth === 0) return c.slice(from, i + 1);
          }
        }
        return c.slice(from, from + 4000);
      };
      // The body's own members, counted by the commas that separate them — a nested object's keys
      // are that value's business, and a shorthand property (`orgId,`) is a member with no colon
      // to count. Counting colons instead reads a complete body as one field short and fires on it.
      const topLevelMembers = (text) => {
        const inner = text.slice(1, -1);
        const members = [];
        let depth = 0;
        let quote = null;
        let current = "";
        for (let i = 0; i < inner.length; i++) {
          const ch = inner[i];
          if (quote) {
            current += ch;
            if (ch === quote && inner[i - 1] !== "\\") quote = null;
            continue;
          }
          if (ch === '"' || ch === "'" || ch === "`") { quote = ch; current += ch; continue; }
          if (ch === "{" || ch === "(" || ch === "[") depth++;
          else if (ch === "}" || ch === ")" || ch === "]") depth--;
          if (depth === 0 && ch === ",") { members.push(current); current = ""; continue; }
          current += ch;
        }
        members.push(current);
        return members
          .map((m) => m.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").trim())
          .filter((m) => m.length > 0);
      };
      /** The name each member writes, so the fields the body leaves out can be named. */
      const memberNames = (members) =>
        new Set(
          members
            .map((m) => /^([A-Za-z_$][\w$]*)\s*[:,]?/.exec(m)?.[1])
            .filter((name) => name !== undefined),
        );
      // What the edit read answered with, by the names this file bound it to. A body that spreads
      // form state (`...values`) spreads what the person typed, which is exactly the set that
      // leaves the rest of the record out — so the test is not "is there a spread" but "is the
      // RECORD spread".
      const recordNames = new Set();
      for (const m of c.matchAll(/^[^\n]*UpdateFormDTO[^\n]*$/gm)) {
        const line = m[0];
        const bound = /\bdata:\s*([A-Za-z_$][\w$]*)/.exec(line);
        if (bound) recordNames.add(bound[1]);
        const assigned = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/.exec(line);
        if (assigned) recordNames.add(assigned[1]);
        const prop = /\breadonly\s+([A-Za-z_$][\w$]*)\??\s*:/.exec(line);
        if (prop) recordNames.add(prop[1]);
      }
      const spreadsTheRecord = (body) =>
        [...body.matchAll(/\.\.\.\s*([^,}\n]+)/g)].some((m) =>
          [...recordNames].some((name) => new RegExp(`\\b${name}\\b`).test(m[1])),
        );
      const hits = [];
      const seen = new Set();
      const consider = (start, line, contract) => {
        if (seen.has(start)) return;
        seen.add(start);
        const shape = contract?.dto ?? dto;
        const held = contract?.stored ?? stored;
        const body = objectAt(start);
        const members = topLevelMembers(body);
        if (members.length >= shape.size) return;
        if (spreadsTheRecord(body)) return;
        const named = memberNames(members);
        // Only a field the read also carries is a field this save blanks.
        const dropped = [...shape].filter((field) => !named.has(field) && held.has(field));
        if (dropped.length === 0) return;
        // A body that also spreads form state carries fields this scan cannot see, so the report
        // names the ones the file never mentions at all — those are certainly gone, and a list
        // that includes a field the reader can point at in the same file reads as a false alarm.
        const certain = dropped.filter((field) => !new RegExp(`\\b${field}\\b`).test(c));
        const named4 = (certain.length ? certain : dropped).slice(0, 4);
        const rest = (certain.length ? certain : dropped).length - named4.length;
        hits.push({
          line,
          excerpt: `drops ${named4.join(", ")}${rest > 0 ? ` and ${rest} more` : ""}`,
        });
      };
      for (const m of c.matchAll(/\b(\w*[Uu]pdate\w*)\.mutateAsync\s*\(/g)) {
        // The receiver's own contract where this file bound it to a hook, and the file-wide one
        // where it did not. A receiver bound to a hook whose DTO is not on hand is an unknown
        // contract, which the rule leaves alone rather than measuring against somebody else's.
        const contract = byReceiver.has(m[1]) ? byReceiver.get(m[1]) : undefined;
        if (contract === null) continue;
        // The call's OWN arguments, read to the balanced close paren. A fixed window runs past
        // `data: body` into whatever call comes next — the create branch beside it — and the rule
        // then reports the create's literal as an update body.
        const open = c.indexOf("(", m.index + m[0].length - 1);
        let depth = 0;
        let end = open;
        for (let i = open; i < c.length && i < open + 4000; i++) {
          if (c[i] === "(") depth++;
          else if (c[i] === ")") {
            depth--;
            if (depth === 0) { end = i; break; }
          }
        }
        const args = c.slice(open, end + 1);
        const data = /data:\s*\{/.exec(args);
        if (data) {
          consider(open + data.index + data[0].length - 1, lineOfIndex(c, m.index), contract);
        }
      }
      // `useCrudFormSubmit` hands ONE body to both the create and the update, so an enumerated
      // body there is the same defect wearing the form helper's name.
      if (/adaptOrvalUpdate/.test(c)) {
        for (const m of c.matchAll(/handleSubmit\s*\(\s*\{/g)) {
          consider(m.index + m[0].length - 1, lineOfIndex(c, m.index));
        }
      }
      return hits;
    },
    samples: {
      file: "modules/org/src/widgets/organization/detail.tsx",
      broken: {
        files: {
          "packages/domain-org/src/generated/model/organizationUpdateDTO.ts": `export interface OrganizationUpdateDTO {
  orgId: string;
  orgCode: string;
  orgName: string;
  orgNameI18n?: StringMap;
  description?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
}`,
          "packages/domain-org/src/generated/model/organizationUpdateFormDTO.ts": `export interface OrganizationUpdateFormDTO {
  orgId: string;
  orgCode: string;
  orgName: string;
  orgNameI18n?: StringMap;
  description?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  updatedAt?: string;
}`,
        },
        source: `const setActive = async (active: boolean) => {
  const update = useUpdateOrganization();
  await update.mutateAsync({
    orgId,
    data: {
      orgId,
      orgCode: org.orgCode ?? "",
      orgName: org.orgName ?? "",
      description: org.description,
      phone: org.phone,
      isActive: active,
    },
  });
};`,
      },
      fixed: {
        files: {
          "packages/domain-org/src/generated/model/organizationUpdateDTO.ts": `export interface OrganizationUpdateDTO {
  orgId: string;
  orgCode: string;
  orgName: string;
  orgNameI18n?: StringMap;
  description?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
}`,
          "packages/domain-org/src/generated/model/organizationUpdateFormDTO.ts": `export interface OrganizationUpdateFormDTO {
  orgId: string;
  orgCode: string;
  orgName: string;
  orgNameI18n?: StringMap;
  description?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  updatedAt?: string;
}`,
        },
        source: `const { data: editable } = adaptOrvalGet<OrganizationUpdateFormDTO, typeof editQuery>(editQuery);

const setActive = async (active: boolean) => {
  const update = useUpdateOrganization();
  if (!editable) return;
  await update.mutateAsync({
    orgId,
    data: { ...updateBody(editable), orgId, isActive: active },
  });
};`,
      },
      miss: [
        {
          note: "a body that names every field the DTO declares is complete, however long the list",
        files: {
          "packages/domain-org/src/generated/model/organizationUpdateDTO.ts": `export interface OrganizationUpdateDTO {
  orgId: string;
  orgCode: string;
  orgName: string;
  orgNameI18n?: StringMap;
  description?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
}`,
          "packages/domain-org/src/generated/model/organizationUpdateFormDTO.ts": `export interface OrganizationUpdateFormDTO {
  orgId: string;
  orgCode: string;
  orgName: string;
  orgNameI18n?: StringMap;
  description?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  updatedAt?: string;
}`,
        },
          source: `const setActive = async (active: boolean) => {
  const update = useUpdateOrganization();
  await update.mutateAsync({
    orgId,
    data: {
      orgId,
      orgCode: org.orgCode ?? "",
      orgName: org.orgName ?? "",
      orgNameI18n: org.orgNameI18n,
      description: org.description,
      phone: org.phone,
      email: org.email,
      isActive: active,
    },
  });
};`,
        },
        {
          note: "a second update endpoint over the same record, whose own DTO is not on hand — the body is complete for the endpoint it is sent to, and measuring it against the neighbour's DTO reports a defect that is not there",
          files: {
            "packages/domain-org/src/generated/model/organizationUpdateDTO.ts": `export interface OrganizationUpdateDTO {
  orgId: string;
  orgCode: string;
  orgName: string;
  isActive: boolean;
}`,
            "packages/domain-org/src/generated/model/organizationUpdateFormDTO.ts": `export interface OrganizationUpdateFormDTO {
  orgId: string;
  orgCode: string;
  orgName: string;
  isActive: boolean;
  updatedAt?: string;
}`,
          },
          source: `const update = useUpdateOrganization();
const updateContacts = useUpdateContactsOrganization();

const saveContacts = async (contacts: ContactItemDTO[]) => {
  await updateContacts.mutateAsync({
    orgId,
    data: { orgId, contacts },
  });
};`,
        },
        {
          note: "an endpoint whose DTO is not on hand — an unknown contract is not evidence of a defect",
        files: {
          "packages/domain-org/src/generated/model/organizationUpdateDTO.ts": `export interface OrganizationUpdateDTO {
  orgId: string;
  orgCode: string;
  orgName: string;
  orgNameI18n?: StringMap;
  description?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
}`,
          "packages/domain-org/src/generated/model/organizationUpdateFormDTO.ts": `export interface OrganizationUpdateFormDTO {
  orgId: string;
  orgCode: string;
  orgName: string;
  orgNameI18n?: StringMap;
  description?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  updatedAt?: string;
}`,
        },
          source: `const setActive = async (active: boolean) => {
  const update = useUpdateFederationGateway();
  await update.mutateAsync({ gatewayId, data: { gatewayId, enabled: active } });
};`,
        },
      ],
    },
  },
  {
    id: "panel-record-from-list-page",
    invariant: "#36",
    level: "review",
    desc: "A panel's value is looked up in the rows the list happens to have loaded — a record opened by address, or one on another page, is not among them, so the field renders empty, the dialog names a UUID, or the lookup falls through to the first row on the page and the panel describes a different record. Resolve it from the record the panel itself fetched",
    appliesTo: isTsx,
    check: (c) => {
      if (!/renderDetail|ListDetail/.test(c)) return [];
      const hits = [];
      for (const m of c.matchAll(/\b\w+\.data\??\.find\s*\(/g)) {
        hits.push({ line: lineOfIndex(c, m.index), excerpt: c.slice(m.index, m.index + 120).replace(/\s+/g, " ") });
      }
      // The same lookup moved into a helper — the page hands its loaded rows across.
      for (const m of c.matchAll(/\w+\(\s*\w*[Ll]ist\.data\s*,/g)) {
        hits.push({ line: lineOfIndex(c, m.index), excerpt: m[0].replace(/\s+/g, " ") });
      }
      return hits;
    },
    samples: {
      file: "modules/user-admin/src/pages/job-position/crud-page.tsx",
      broken: `<ListDetail.ViewSwitch
  state={state}
  renderDetail={(id) => (
    <JobPositionDetail
      positionId={id}
      onDelete={() =>
        requestDelete({
          id,
          name: list.data.find((row) => String(row.positionId) === id)?.positionName ?? id,
        })
      }
    />
  )}
/>`,
      fixed: `<ListDetail.ViewSwitch
  state={state}
  renderDetail={(id) => (
    <JobPositionDetail positionId={id} onRequestDelete={requestDelete} />
  )}
/>`,
      miss: [
        {
          note: "a row action already holds its row — the lookup is not over the loaded page",
          source: `<ListDetail.ViewSwitch
  state={state}
  renderDetail={(id) => <JobPositionDetail positionId={id} onRequestDelete={requestDelete} />}
/>`,
        },
        {
          note: "a screen with no panel over a list has no record to resolve from",
          source: `export function Report() {
  const rows = useRows();
  const top = rows.data.find((row) => row.rank === 1);
  return <Text>{top?.label ?? ""}</Text>;
}`,
        },
      ],
    },
  },
  {
    id: "filter-category-order",
    invariant: "#16",
    level: "review",
    desc: "FilterBar filters out of category order (String/Number -> Date -> Attribute) — confirm before reordering (#19)",
    appliesTo: isTsx,
    check: (c) => {
      // Invariant #16 category order: String -> Date -> Number -> Attribute
      const CAT = { text: 0, dateRange: 1, number: 2, faceted: 3, toggle: 3, country: 3, timezone: 3 };
      const hits = [];
      for (const m of c.matchAll(/filters=\{\[([\s\S]*?)\]\}/g)) {
        const types = [...m[1].matchAll(/type:\s*"(\w+)"/g)].map((t) => t[1]);
        const cats = types.map((t) => CAT[t] ?? 9);
        const sorted = [...cats].sort((a, b) => a - b);
        if (cats.join() !== sorted.join()) {
          hits.push({ line: lineOfIndex(c, m.index), excerpt: `filter order: ${types.join(" > ")}` });
        }
      }
      return hits;
    },
    samples: {
      file: "modules/site/src/widgets/area/list.tsx",
      broken: `<CrudList.FilterBar
  list={list}
  maxBadges={3}
  filters={[
    { type: "faceted", field: "status", label: fieldLabel("status") },
    { type: "text", field: "name", label: fieldLabel("name") },
  ]}
/>`,
      fixed: `<CrudList.FilterBar
  list={list}
  maxBadges={3}
  filters={[
    { type: "text", field: "name", label: fieldLabel("name") },
    { type: "faceted", field: "status", label: fieldLabel("status") },
  ]}
/>`,
      miss: [
        {
          note: "the whole category order, in order",
          source: `<CrudList.FilterBar
  list={list}
  maxBadges={3}
  filters={[
    { type: "text", field: "name", label: fieldLabel("name") },
    { type: "dateRange", field: "openedAt", label: fieldLabel("openedAt") },
    { type: "number", field: "capacity", label: fieldLabel("capacity") },
    { type: "toggle", field: "active", label: fieldLabel("active") },
  ]}
/>`,
        },
      ],
    },
  },
  {
    id: "screen-picks-action-variant",
    invariant: "#31",
    level: "error",
    desc: "A screen names actionVariant as a literal — how dense a row action reads is one decision for the whole product, and it is already made: the shape the scaffold emits. A product that departs from it says so once on UIProvider's `defaults`; neither answer is repeated per screen, where the next screen forgets it",
    appliesTo: isTsx,
    // Only a literal is a decision being made here. `actionVariant={actionVariant}` is a widget
    // forwarding its own prop, which is the escape hatch a list with no width to spare uses.
    check: (c) =>
      lineHits(
        c,
        /\bactionVariant=(?:"(?:outline|ghost|icon)"|\{\s*"(?:outline|ghost|icon)"\s*\})/,
        (line, lines, i) =>
          notCommentLine(line, lines, i) &&
          // A file may justify its own exception in place, and then it owns the reason.
          !/actionVariant:\s*deliberate/.test(lines.slice(Math.max(0, i - 6), i).join("\n")),
      ),
    samples: {
      file: "apps/console/src/widgets/area/crud-page.tsx",
      broken: `<AreaList list={list} actionVariant="ghost" />`,
      fixed: `<AreaList list={list} />`,
      miss: [
        {
          note: "a widget forwarding the prop it was handed — the escape hatch, not a decision",
          source: `<CrudList.Table list={list} actions={actions} actionVariant={actionVariant} />`,
        },
        {
          note: "an exception the file states in place, and then owns",
          source: `{/* actionVariant: deliberate — eleven columns, and the labels push the last one off */}
<AreaList list={list} actionVariant="icon" />`,
        },
      ],
    },
  },
  {
    id: "screen-picks-detail-presentation",
    invariant: "#31",
    level: "error",
    desc: "A screen names ListDetail's `variant` as a literal — whether a record opens in a panel beside the list or in a drawer over it is one decision for the installation, declared once on UIProvider's `defaults.detailPresentation`. A screen that hardcodes it takes the choice away from every installation, and seventeen screens hardcoding it mean the setting does nothing at all",
    appliesTo: isTsx,
    // `variant={variant}` is a widget forwarding what it was handed, and `"dialog"` is a real
    // per-screen decision — a centred modal claims the record is an interruption rather than the
    // thing being worked on, which no installation-wide switch should be able to turn on.
    check: (c) =>
      lineHits(
        c,
        /<ListDetail\b[^>]*\bvariant=(?:"(?:panel|drawer)"|\{\s*"(?:panel|drawer)"\s*\})/,
        (line, lines, i) =>
          notCommentLine(line, lines, i) &&
          !/detailPresentation:\s*deliberate/.test(lines.slice(Math.max(0, i - 6), i).join("\n")),
      ),
    samples: {
      file: "apps/console/src/widgets/area/crud-page.tsx",
      broken: `<ListDetail variant="panel" activePanel={view} onClose={showList}>`,
      fixed: `<ListDetail activePanel={view} onClose={showList}>`,
      miss: [
        {
          note: "a centred modal, which is the screen's own claim and not an installation setting",
          source: `<ListDetail variant="dialog" activePanel={view} onClose={showList}>`,
        },
        {
          note: "a widget forwarding the variant it was handed",
          source: `<ListDetail variant={variant} activePanel={view} onClose={showList}>`,
        },
        {
          note: "an exception the file states in place, and then owns",
          source: `{/* detailPresentation: deliberate — the map fills the viewport and a drawer would cover it */}
<ListDetail variant="panel" activePanel={view} onClose={showList}>`,
        },
      ],
    },
  },
  {
    id: "row-actions-as-nameless-column",
    invariant: "#31",
    level: "error",
    desc: "Row actions declared as a CrudList.Column with an empty header — a nameless entry joins the column-visibility menu, and unchecking it silently removes every action on the list. Render them through the table's rowActions slot (slots={{ ...., rowActions }} + actionColumnWidth) so the framework's own _actions column carries them",
    appliesTo: isTsx,
    // The framework registers a declared column in the FilterBar's Columns dropdown by its
    // header text; an empty header therefore reaches that menu as a blank checkbox. Its own
    // action column (`_actions`) is excluded from the menu, which is why actions belong there.
    // The generic argument carries its own ">" (`<CrudList.Column<Row> …`), so the scan runs to
    // the header attribute rather than to the first ">", stopping at the next column's opening
    // tag so one nameless column cannot be blamed on its neighbour.
    check: (c) => lineHits(c, /<CrudList\.Column(?:(?!<CrudList\.Column)[\s\S]){0,300}?\sheader=""/),
    samples: {
      file: "modules/site/src/widgets/area/list.tsx",
      broken: `<CrudList.Column<AreaRow> field="_rowActions" header="" width={96}>
  {(row) => <AreaRowActions row={row} />}
</CrudList.Column>`,
      fixed: `<CrudList.Table list={list} slots={{ rowActions }} actionColumnWidth={96}>
  <CrudList.Column<AreaRow> field="name" header={fieldLabel("name")}>
    {(row) => row.name}
  </CrudList.Column>
</CrudList.Table>`,
      miss: [
        {
          note: "a column the visibility menu can name",
          source: `<CrudList.Column<AreaRow> field="name" header={fieldLabel("name")}>
  {(row) => row.name}
</CrudList.Column>`,
        },
      ],
    },
  },
  {
    id: "spinner-beside-mark",
    invariant: "#9 / audit: framework components",
    level: "error",
    desc: "Waiting button leads with an icon and names no loadingText — Button composes the spinner ahead of its children, so pressing it draws a spinner and the icon side by side and widens the button mid-click, shifting a segmented row-action group out from under the pointer. Pass the label as loadingText so the spinner takes the icon's seat",
    appliesTo: isTsx,
    check: spinnerBesideMark,
    samples: {
      file: "modules/site/src/widgets/area/list.tsx",
      broken: `<Button size="xs" variant="outline" loading={settle.isPending} onClick={onSettle}>
  <CheckIcon className="size-3.5" />
  {t("area.settle")}
</Button>`,
      fixed: `<Button size="xs" variant="outline" loading={settle.isPending} loadingText={t("area.settling")} onClick={onSettle}>
  <CheckIcon className="size-3.5" />
  {t("area.settle")}
</Button>`,
      miss: [
        {
          note: "an icon-size button — the framework drops the children, so the spinner already stands alone",
          source: `<Button size="icon" variant="ghost" loading={del.isPending} onClick={onDelete}>
  <TrashIcon className="size-4" />
</Button>`,
        },
        {
          note: "a button leading with prose is what the spinner is supposed to sit beside",
          source: `<Button loading={save.isPending} onClick={onSave}>
  {t("common.save")}
</Button>`,
        },
        {
          note: "a button that never waits draws no spinner",
          source: `<Button onClick={onSave}>
  <SaveIcon className="size-4" />
  {t("common.save")}
</Button>`,
        },
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// Package export rules (package.json-based, separate collection)
// ---------------------------------------------------------------------------

/**
 * Export entries of a workspace package that carry no `source` condition (invariant #5).
 *
 * <p><b>The dev server then serves that subpath from `dist/`, and a source edit reaches nothing.</b>
 * Vite resolves workspace packages through `resolve.conditions: ["source"]`; an entry without it
 * falls through to `import`, which is the built output. Nothing errors — the screen renders, HMR
 * reports a successful update, and the browser keeps showing the code as it was at the last build.
 * A session can spend an hour re-editing a file, re-reading it to confirm the change is there, and
 * measuring a page that never received it.
 *
 * <p><b>It is written this way by the generator, not by hand.</b> `simplix scaffold` appends the
 * `./pages` entry after generating a page, and it appends `types` and `import` only — so a module
 * whose other three entries are correct acquires exactly one that is not, at the moment somebody
 * adds the first page to it. That is why this is a rule rather than a note: the file it appears in
 * is one nobody edited.
 *
 * @returns one finding per export entry missing the condition
 */
function packageExportFindings() {
  const findings = [];
  for (const base of ["modules", "packages"]) {
    const root = path.join(ROOT, base);
    if (!fs.existsSync(root)) continue;
    for (const name of fs.readdirSync(root)) {
      const manifest = path.join(root, name, "package.json");
      if (!fs.existsSync(manifest)) continue;
      let parsed;
      try {
        parsed = JSON.parse(fs.readFileSync(manifest, "utf8"));
      } catch {
        continue;
      }
      const exports = parsed.exports;
      if (!exports || typeof exports !== "object") continue;
      // A package that declares `bin` is a command-line tool. Node resolves its exports and
      // Node has no `source` condition, so nothing about a dev server reaches it — the whole
      // failure this rule describes cannot happen there, and shipping `src` would grow the
      // tarball to satisfy a reader that never looks.
      if (parsed.bin) continue;
      // `files` decides what a publish carries. Absent, everything ships and nothing can be
      // missing; present, it is a whitelist and a `source` target outside it exists only in the
      // checkout.
      const published = Array.isArray(parsed.files)
        ? parsed.files.map((entry) => String(entry).replace(/^\.?\//, "").replace(/\/+$/, ""))
        : null;
      for (const [subpath, entry] of Object.entries(exports)) {
        // A string entry names one file for every condition, so there is nothing to fall through
        // to and nothing to declare. Only a conditional entry can omit the source condition.
        if (!entry || typeof entry !== "object") continue;
        if (!("source" in entry)) {
          findings.push({
            file: path.relative(ROOT, manifest),
            excerpt: `"${subpath}" resolves to ${entry.import ?? entry.default ?? "dist"} in dev — add "source"`,
          });
          continue;
        }
        if (!published || typeof entry.source !== "string") continue;
        const target = entry.source.replace(/^\.?\//, "");
        if (published.some((dir) => target === dir || target.startsWith(`${dir}/`))) continue;
        findings.push({
          file: path.relative(ROOT, manifest),
          excerpt: `"${subpath}" names source ${entry.source}, which "files" does not publish — `
            + `add "${target.split("/")[0]}" to files`,
        });
      }
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Locale rules (JSON-based, separate collection)
// ---------------------------------------------------------------------------

let localeFindingsCache = null;
/** Both locale rules read the same catalogues, so the walk happens once per root. */
function localeFindingsMemo() {
  localeFindingsCache ??= localeFindings();
  return localeFindingsCache;
}

function localeFindings() {
  const errors = [];
  const reviews = [];
  const dirs = new Set();
  for (const base of ["modules"]) {
    const moduleRoot = path.join(ROOT, base);
    if (!fs.existsSync(moduleRoot)) continue;
    for (const mod of fs.readdirSync(moduleRoot)) {
      for (const kind of ["widgets", "features"]) {
        const d = path.join(moduleRoot, mod, "src", "locales", kind);
        if (fs.existsSync(path.join(d, "en.json"))) dirs.add(d);
      }
    }
  }
  const hasCjk = (s) => /[가-힣ぁ-んァ-ヶ一-龯]/.test(s);
  for (const d of dirs) {
    const rel = path.relative(ROOT, d);
    const load = (loc) => {
      const p = path.join(d, `${loc}.json`);
      return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null;
    };
    const en = load("en");
    for (const loc of ["ko", "ja"]) {
      const data = load(loc);
      if (!data) {
        errors.push({ file: rel, line: 0, excerpt: `${loc}.json missing` });
        continue;
      }
      const missing = Object.keys(en ?? {}).filter((k) => !(k in data));
      if (missing.length) {
        errors.push({ file: `${rel}/${loc}.json`, line: 0, excerpt: `sections missing vs en.json: ${missing.join(", ")}` });
      }
      const walkJson = (obj, keyPath) => {
        if (typeof obj === "string") {
          if (/\b[a-z]+[A-Z][a-zA-Z]*s?\b/.test(obj) && !hasCjk(obj)) {
            reviews.push({ file: `${rel}/${loc}.json`, line: 0, excerpt: `${keyPath} = ${obj.slice(0, 80)}` });
          }
        } else if (obj && typeof obj === "object") {
          for (const [k, v] of Object.entries(obj)) walkJson(v, keyPath ? `${keyPath}.${k}` : k);
        }
      };
      walkJson(data, "");
    }
  }
  return { errors, reviews };
}

/** Every `ko.json` under a module's or an app's locales directory. */
function koCatalogues() {
  const found = [];
  for (const base of ["modules", "apps"]) {
    const root = path.join(ROOT, base);
    if (!fs.existsSync(root)) continue;
    for (const unit of fs.readdirSync(root)) {
      const locales = path.join(root, unit, "src", "locales");
      if (!fs.existsSync(locales)) continue;
      // Its own descent: the shared `walk` collects TypeScript sources only.
      const descend = (dir) => {
        let entries;
        try {
          entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const e of entries) {
          if (e.isDirectory()) {
            if (!EXCLUDE_DIRS.has(e.name)) descend(path.join(dir, e.name));
          } else if (e.name === "ko.json") {
            found.push(path.join(dir, e.name));
          }
        }
      };
      descend(locales);
    }
  }
  return found;
}

/**
 * Korean object/subject particles welded to an interpolated value.
 *
 * <p>Korean picks 을/를, 이/가, 은/는, 와/과 by whether the preceding syllable ends in a
 * consonant, so a particle written straight after `{{...}}` is right for some values and wrong
 * for the rest — "5을", "3.2를". The repair is to let the particle attach to a fixed noun
 * instead of to the value ("{{allowed}}대 중", "{{release}} 릴리스를"), which also supplies the
 * counter word a bare number is missing.
 */
function koParticleFindings() {
  const reviews = [];
  // The `이(가)` hedge spells both forms and is therefore already correct for every value;
  // only a single committed particle is a finding.
  //
  // `로` belongs in the set for the same reason as the rest: it is `으로` after a consonant that
  // is not ㄹ, so a sentence welding `로` to a value is wrong for most of the values it will ever
  // hold. Its hedge is written `(으)로`, where the bracket falls BEFORE the particle and so never
  // matches this pattern at all — no lookahead needed for it.
  //
  // A closing quote or bracket may sit between the value and the particle — a name is usually
  // wrapped before it is spoken about (`「{{plan}}」은`, `"{{name}}"이`). The wrapper is silent,
  // so the particle still has to agree with the VALUE's last syllable and the sentence is wrong
  // for half the values exactly as before. Skipping one such character is what makes the rule
  // see the quoted form, which is the form these sentences are actually written in.
  const particle = /\}\}\s*[」』〉》”’"'\)\]]?\s*(?:[을를이가은는와과](?!\s*\(\s*[을를이가은는와과]\s*\))|로(?![그긴깅]))/;
  for (const abs of koCatalogues()) {
    const rel = path.relative(ROOT, abs);
    const raw = fs.readFileSync(abs, "utf8");
    const lines = raw.split("\n");
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      continue;
    }
    const walkJson = (obj, keyPath) => {
      if (typeof obj === "string") {
        if (particle.test(obj)) {
          const at = lines.findIndex((l) => l.includes(obj.slice(0, 60)));
          reviews.push({ file: rel, line: at < 0 ? 0 : at + 1, excerpt: `${keyPath} = ${obj.slice(0, 90)}` });
        }
      } else if (obj && typeof obj === "object") {
        for (const [k, v] of Object.entries(obj)) walkJson(v, keyPath ? `${keyPath}.${k}` : k);
      }
    };
    walkJson(data, "");
  }
  return reviews;
}

/**
 * Scaffold placeholder copy left in a locale catalogue.
 *
 * <p>The CRUD scaffold emits a create-panel header it cannot name for you, and every locale gets
 * a bare "new". It survives translation passes because it IS translated — "신규" is a correct
 * rendering of a placeholder that should never have reached a screen. What the operator reads at
 * the top of the panel is then a word that names no entity, while the button that opened it and
 * the page it sits on both say what is being created.
 *
 * <p>The repair is the entity's own noun, the same one the create button uses — "운영자 추가" /
 * "Add operator".
 *
 * <p>Scoped to the create header on purpose. `detailHeader` / `editHeader` carry `{{id}}` from
 * the same scaffold, but those keys are usually left unreferenced (panels title themselves from
 * the record), so flagging them buries the live finding under dead catalogue entries; a header
 * that really does render an id is caught in the code by `header-id-title`.
 */
function scaffoldHeaderFindings() {
  const reviews = [];
  // The generator's untranslated defaults, in the locales the CLI ships templates for.
  const placeholderNew = /^(new|신규|新規|新規作成)$/i;
  const headerKeys = new Set(["newHeader"]);
  // The scaffold's page subtitle names the entity's table rather than the operator's job.
  // A screen still wearing it tells its reader nothing they could not read from the title.
  const placeholderDescription = /(마스터 데이터를 관리|master data|マスターデータを管理)/i;
  const isDescriptionKey = (key) => /Description$/.test(key);
  for (const abs of koCatalogues()) {
    const dir = path.dirname(abs);
    for (const loc of ["ko", "en", "ja"]) {
      const file = path.join(dir, `${loc}.json`);
      if (!fs.existsSync(file)) continue;
      const rel = path.relative(ROOT, file);
      const raw = fs.readFileSync(file, "utf8");
      const lines = raw.split("\n");
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        continue;
      }
      const walkJson = (obj, keyPath, key) => {
        if (typeof obj === "string") {
          const isPlaceholderHeader = headerKeys.has(key) && placeholderNew.test(obj.trim());
          const isPlaceholderDescription = isDescriptionKey(key) && placeholderDescription.test(obj);
          if (!isPlaceholderHeader && !isPlaceholderDescription) return;
          const at = lines.findIndex((l) => l.includes(`"${key}"`) && l.includes(obj.trim()));
          reviews.push({ file: rel, line: at < 0 ? 0 : at + 1, excerpt: `${keyPath} = ${obj.slice(0, 90)}` });
        } else if (obj && typeof obj === "object") {
          for (const [k, v] of Object.entries(obj)) walkJson(v, keyPath ? `${keyPath}.${k}` : k, k);
        }
      };
      walkJson(data, "", "");
    }
  }
  return reviews;
}

/**
 * A locale entry left empty, which does not render as nothing.
 *
 * <p>The adapter is configured not to return empty strings, so a key whose value is `""` is treated
 * as absent and resolved against the fallback locale instead. An English console then reads
 * 「31대」 — the Korean value, in the middle of an English screen — and nothing errors, because as
 * far as every check is concerned the key is present in both catalogues.
 *
 * <p><b>It is almost always a counter word.</b> A tile handed a figure and a separate unit needs
 * that unit in every language, and English has none for a machine or a case; the entry is left
 * empty and falls straight through. The repair is not a space — a space is a translation that says
 * the value is a space, and it satisfies every missing-translation check while rendering a stray
 * gap. It is to put the counter word inside the counted string, one per language
 * (`{{count}}대` · `{{count}}` · `{{count}}台`), so no entry is empty to fall back from.
 *
 * <p>Whitespace-only is the same finding and is reported the same way: it is what somebody writes
 * when the empty string was flagged and the shape was not changed.
 */
function emptyLocaleValueFindings() {
  const findings = [];
  for (const abs of koCatalogues()) {
    const dir = path.dirname(abs);
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".json")) continue;
      const full = path.join(dir, file);
      const rel = path.relative(ROOT, full);
      const raw = fs.readFileSync(full, "utf8");
      const lines = raw.split("\n");
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        continue;
      }
      const walkJson = (obj, keyPath, key) => {
        if (typeof obj === "string") {
          if (obj !== "" && obj.trim() !== "") return;
          const at = lines.findIndex((l) => l.includes(`"${key}"`));
          findings.push({
            file: rel,
            line: at < 0 ? 0 : at + 1,
            excerpt: `${keyPath} = ${JSON.stringify(obj)} — falls through to the fallback locale`,
          });
        } else if (obj && typeof obj === "object") {
          for (const [k, v] of Object.entries(obj)) walkJson(v, keyPath ? `${keyPath}.${k}` : k, k);
        }
      };
      walkJson(data, "", "");
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Collection rules — the ones that read a tree rather than a file
//
// Same shape as RULES minus `appliesTo`/`check`: `collect()` walks the project itself and
// returns findings. They were once wired straight into the runner, which is how four rules came
// to have no id anybody could pass to `--rule=` and no way to be proved at all.
// ---------------------------------------------------------------------------

const COLLECTION_RULES = [
  {
    id: "empty-locale-value",
    invariant: "audit: locale fallback",
    level: "error",
    desc: "A locale entry is an empty string. The adapter does not return empty strings, so the key resolves against the fallback locale and the other language's words render in the middle of this one's screen — with every catalogue reporting the key as present. Put the word inside the counted string, one per language, so no entry is empty to fall back from; a space is not the repair, it satisfies every check and renders a stray gap",
    collect: emptyLocaleValueFindings,
    samples: {
      broken: {
        files: {
          "modules/site/src/locales/widgets/ko.json": `{ "unit": { "machine": "대" } }`,
          "modules/site/src/locales/widgets/en.json": `{ "unit": { "machine": "" } }`,
        },
      },
      fixed: {
        files: {
          "modules/site/src/locales/widgets/ko.json": `{ "unit": { "machineCount": "{{count}}대" } }`,
          "modules/site/src/locales/widgets/en.json": `{ "unit": { "machineCount": "{{count}}" } }`,
        },
      },
      miss: [
        {
          note: "a word English does have — nothing falls through, so nothing is reported",
          files: {
            "modules/site/src/locales/widgets/ko.json": `{ "unit": { "days": "일" } }`,
            "modules/site/src/locales/widgets/en.json": `{ "unit": { "days": " days" } }`,
          },
        },
      ],
    },
  },
  {
    id: "locale-missing-sections",
    invariant: "audit: scaffold locale",
    level: "error",
    desc: "locale file/section missing vs en.json",
    collect: () => localeFindingsMemo().errors,
    samples: {
      broken: {
        files: {
          "modules/site/src/locales/widgets/en.json": `{ "area": { "title": "Area" } }`,
          "modules/site/src/locales/widgets/ko.json": `{ "area": { "title": "구역" } }`,
        },
      },
      fixed: {
        files: {
          "modules/site/src/locales/widgets/en.json": `{ "area": { "title": "Area" } }`,
          "modules/site/src/locales/widgets/ko.json": `{ "area": { "title": "구역" } }`,
          "modules/site/src/locales/widgets/ja.json": `{ "area": { "title": "エリア" } }`,
        },
      },
      miss: [
        {
          note: "a directory with no en.json to compare against is not a catalogue this rule reads",
          files: {
            "modules/site/src/locales/widgets/ko.json": `{ "area": { "title": "구역" } }`,
          },
        },
        {
          note: "a key missing inside a section — top-level sections are what this rule compares, and the keys under them are missing-translation-key's business",
          files: {
            "modules/site/src/locales/widgets/en.json": `{ "area": { "title": "Area", "status": "Status" } }`,
            "modules/site/src/locales/widgets/ko.json": `{ "area": { "title": "구역" } }`,
            "modules/site/src/locales/widgets/ja.json": `{ "area": { "title": "エリア" } }`,
          },
        },
      ],
    },
  },
  {
    id: "locale-untranslated",
    invariant: "audit: scaffold locale",
    level: "review",
    desc: "possible untranslated scaffold defaults",
    collect: () => localeFindingsMemo().reviews,
    samples: {
      broken: {
        files: {
          "modules/site/src/locales/widgets/en.json": `{ "area": { "title": "Area" } }`,
          "modules/site/src/locales/widgets/ko.json": `{ "area": { "title": "areaTitle" } }`,
          "modules/site/src/locales/widgets/ja.json": `{ "area": { "title": "エリア" } }`,
        },
      },
      fixed: {
        files: {
          "modules/site/src/locales/widgets/en.json": `{ "area": { "title": "Area" } }`,
          "modules/site/src/locales/widgets/ko.json": `{ "area": { "title": "구역" } }`,
          "modules/site/src/locales/widgets/ja.json": `{ "area": { "title": "エリア" } }`,
        },
      },
      miss: [
        {
          note: "a translated sentence that quotes an identifier is translated",
          files: {
            "modules/site/src/locales/widgets/en.json": `{ "area": { "hint": "Enter it as areaCode." } }`,
            "modules/site/src/locales/widgets/ko.json": `{ "area": { "hint": "areaCode 형식으로 입력합니다." } }`,
            "modules/site/src/locales/widgets/ja.json": `{ "area": { "hint": "areaCode の形式で入力します。" } }`,
          },
        },
      ],
    },
  },
  {
    id: "ko-particle-after-placeholder",
    invariant: "audit: locale wording",
    level: "review",
    desc: "Korean particle written straight after an interpolated value — 을/를 · 이/가 · 은/는 · 와/과 · (으)로 depend on the value's last syllable, so the sentence is wrong for half the values; attach the particle to a fixed noun instead, or end the clause on the value with 입니다",
    collect: koParticleFindings,
    samples: {
      broken: {
        files: {
          "modules/site/src/locales/widgets/ko.json": `{ "area": { "overCapacity": "{{allowed}}을 초과했습니다" } }`,
        },
      },
      fixed: {
        files: {
          "modules/site/src/locales/widgets/ko.json": `{ "area": { "overCapacity": "{{allowed}}대를 초과했습니다" } }`,
        },
      },
      miss: [
        {
          note: "the hedge spells both forms and is right for every value",
          files: {
            "modules/site/src/locales/widgets/ko.json": `{ "area": { "registered": "{{name}}이(가) 등록되었습니다" } }`,
          },
        },
        {
          note: "the bracket of (으)로 falls before the particle, so the value never carries one",
          files: {
            "modules/site/src/locales/widgets/ko.json": `{ "area": { "changed": "{{plan}}(으)로 변경되었습니다" } }`,
          },
        },
        {
          note: "a word that merely begins with the same syllable",
          files: {
            "modules/site/src/locales/widgets/ko.json": `{ "area": { "signedIn": "{{user}}로그인 기록" } }`,
          },
        },
      ],
    },
  },
  {
    id: "package-export-without-source",
    invariant: "#5",
    level: "error",
    desc: "A package's export entry carries no `source` condition — the dev server then serves that subpath from `dist/`, every source edit under it is invisible in the browser while HMR reports success, and the screen shows the code as it was at the last build (`simplix scaffold` writes the `./pages` entry this way) — or it names a `source` file that `files` does not publish, which resolves in this checkout and throws ERR_MODULE_NOT_FOUND for anyone who installs the package from a registry",
    collect: packageExportFindings,
    samples: {
      broken: {
        files: {
          "modules/site/package.json": `{
  "name": "@acme/site",
  "exports": {
    ".": { "source": "./src/index.ts", "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./pages": { "types": "./dist/pages.d.ts", "import": "./dist/pages.js" }
  }
}
`,
        },
      },
      fixed: {
        files: {
          "modules/site/package.json": `{
  "name": "@acme/site",
  "exports": {
    ".": { "source": "./src/index.ts", "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./pages": { "source": "./src/pages.ts", "types": "./dist/pages.d.ts", "import": "./dist/pages.js" }
  }
}
`,
        },
      },
      miss: [
        {
          note: "a command-line tool, whose exports Node resolves and Node has no source condition",
          files: {
            "packages/cli/package.json": `{
  "name": "@acme/cli",
  "bin": { "acme": "./dist/bin.js" },
  "files": ["dist"],
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  }
}
`,
          },
        },
        {
          note: "a source target inside a published directory",
          files: {
            "packages/ui/package.json": `{
  "name": "@acme/ui",
  "files": ["dist", "src"],
  "exports": {
    ".": { "source": "./src/index.ts", "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  }
}
`,
          },
        },
        {
          note: "no files whitelist, so the publish carries everything the exports name",
          files: {
            "packages/ui/package.json": `{
  "name": "@acme/ui",
  "exports": {
    ".": { "source": "./src/index.ts", "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  }
}
`,
          },
        },
        {
          note: "a string entry names one file for every condition — there is nothing to fall through to",
          files: {
            "modules/site/package.json": `{
  "name": "@acme/site",
  "exports": {
    ".": { "source": "./src/index.ts", "import": "./dist/index.js" },
    "./theme.css": "./dist/theme.css"
  }
}
`,
          },
        },
        {
          note: "a package that declares no exports map at all",
          files: {
            "modules/site/package.json": `{ "name": "@acme/site", "main": "./dist/index.js" }
`,
          },
        },
      ],
    },
  },
  {
    id: "scaffold-header-placeholder",
    invariant: "audit: scaffold locale",
    level: "review",
    desc: "Screen wording still carries the scaffold's placeholder — a bare \"new\" that names no entity, or a subtitle naming the table (\"master data\") instead of the operator's job",
    collect: scaffoldHeaderFindings,
    samples: {
      broken: {
        files: {
          "modules/site/src/locales/widgets/ko.json": `{
  "area": { "newHeader": "신규", "pageDescription": "구역 마스터 데이터를 관리합니다" }
}
`,
        },
      },
      fixed: {
        files: {
          "modules/site/src/locales/widgets/ko.json": `{
  "area": { "newHeader": "구역 추가", "pageDescription": "출입 구역을 등록하고 담당자를 지정합니다" }
}
`,
        },
      },
      miss: [
        {
          note: "the scaffold's detailHeader is usually left unreferenced — an id that really renders is caught in the code by header-id-title",
          files: {
            "modules/site/src/locales/widgets/ko.json": `{
  "area": { "newHeader": "구역 추가", "detailHeader": "{{id}}" }
}
`,
          },
        },
        {
          note: "a description that says what the operator does with the screen",
          files: {
            "modules/site/src/locales/widgets/ko.json": `{
  "area": { "newHeader": "구역 추가", "pageDescription": "구역별 출입 권한을 확인합니다" }
}
`,
          },
        },
      ],
    },
  },
];

const ALL_RULES = [...RULES, ...COLLECTION_RULES];

// ---------------------------------------------------------------------------
// Self-test — every rule against the broken form, the fixed form, and the near-neighbours it
// must stay silent on
// ---------------------------------------------------------------------------

/** Reset every index and cache built from the tree, so the next read sees the new root. */
function resetCaches() {
  settingsCache = null;
  generatedModelIndex = null;
  exportedFunctionCache = null;
  generatedEnumCache = null;
  globalDialogCache = null;
  localeFindingsCache = null;
  localeKeyCache.clear();
  catalogueIndexCache = null;
  catalogueLangCache.clear();
}

function setRoot(dir) {
  ROOT = dir;
  resetCaches();
}

function writeFixture(root, rel, body) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
}

/**
 * A sample is either a bare source string — the content of `samples.file` — or an object that
 * also lays down the neighbouring files the rule reads: a sibling `detail.tsx`, a generated
 * model, a locale catalogue, a `package.json`. A rule that reads a tree can only be proved
 * against a tree.
 */
function normalizeSample(sample, rule) {
  if (typeof sample === "string") {
    return { file: rule.samples?.file, source: sample, files: {}, note: "" };
  }
  return {
    file: sample.file ?? rule.samples?.file,
    source: sample.source,
    files: sample.files ?? {},
    note: sample.note ?? "",
  };
}

/**
 * Run one rule against one sample in a throwaway project tree.
 *
 * <p>`appliesTo` is asked inside that tree, never outside it: several of them read the project to
 * answer — the route directories a product declares public, an app that already guards every
 * address at its root — and asking from the real working directory answers about this repository
 * instead of about the sample.
 *
 * @returns whether the rule applied at all, its hits, and whether the scan's own file collection
 *          would have reached the sample — a rule whose sample sits where `collectSources` never
 *          looks is one the audit cannot fire in a real run, however well its regex matches.
 */
function runSample(rule, sample) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "simplix-audit-")));
  const previousRoot = ROOT;
  try {
    for (const [rel, body] of Object.entries(sample.files)) writeFixture(dir, rel, body);
    if (sample.source !== undefined) writeFixture(dir, sample.file, sample.source);
    setRoot(dir);
    if (rule.collect) return { applies: true, hits: rule.collect(), reachable: true };
    const reachable = collectSources().some(
      (abs) => path.relative(dir, abs).split(path.sep).join("/") === sample.file,
    );
    if (!rule.appliesTo(sample.file)) return { applies: false, hits: [], reachable };
    return { applies: true, hits: rule.check(sample.source, sample.file), reachable };
  } finally {
    setRoot(previousRoot);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * The shared machinery every rule leans on, proved on its own.
 *
 * A rule's samples prove the rule; they do not prove the tag scanner underneath it, and a
 * scanner that quietly mis-reads one shape takes a dozen rules with it in a way no single
 * rule's failure names.
 */
function selftestMechanisms() {
  const cases = [
    {
      name: "jsxOpenTag: a `>` inside an arrow body does not end the tag",
      pass: () => jsxOpenTag(`<Button onClick={() => setOpen(true)} disabled>x`, 0).tag
        === `<Button onClick={() => setOpen(true)} disabled>`,
    },
    {
      name: "jsxOpenTag: a `>` inside a class string does not end the tag",
      pass: () => jsxOpenTag(`<div className="[&>svg]:h-4">x`, 0).tag === `<div className="[&>svg]:h-4">`,
    },
    {
      name: "jsxChildren: a same-named element nested inside is counted, not mistaken for the close",
      pass: () => {
        const src = `<Card><Card>inner</Card>outer</Card>`;
        return jsxChildren(src, "Card", jsxOpenTag(src, 0).end) === `<Card>inner</Card>outer`;
      },
    },
    {
      name: "tagAttrs: an element passed as a prop takes its own attributes with it",
      pass: () => !/aria-label/.test(tagAttrs(`<Popover trigger={<button aria-label="x" />} open>`)),
    },
    {
      name: "tagAttrs: a `<` that is a comparison does not cut the attribute list short",
      pass: () => /aria-label/.test(tagAttrs(`<Pager disabled={page < 1} aria-label="paging">`)),
    },
    {
      name: "childContent: a lone icon component is a mark",
      pass: () => childContent(`<TrashIcon />`) === "marks",
    },
    {
      name: "childContent: sr-only text is a label",
      pass: () => childContent(`<TrashIcon /><span className="sr-only">삭제</span>`) === "label",
    },
    {
      name: "childContent: an icon beside words is neither empty nor marks",
      pass: () => childContent(`<TrashIcon />삭제`) === null,
    },
    {
      name: "childContent: a JSX comment alone is empty",
      pass: () => childContent(`{/* nothing here */}`) === "empty",
    },
    {
      name: "notCommentLine: a JSX comment line is not code",
      pass: () => !notCommentLine(`  {/* <div className="flex"> */}`) && notCommentLine(`  <div className="flex">`),
    },
    {
      name: "translatorBindings: two translators in one file keep their own namespaces",
      pass: () => {
        const binds = translatorBindings(
          `const { t } = useTranslation("site/widgets");\nconst { t: tf } = useTranslation("site/features");`,
        );
        return binds.get("t") === "site/widgets" && binds.get("tf") === "site/features";
      },
    },
    {
      name: "objectLiteralProperties: a ternary value is not read as a second property",
      pass: () => {
        const src = `t("k", { permission: ok ? allowed : denied })`;
        const { names } = objectLiteralProperties(src, src.indexOf("{", 5));
        return names.length === 1 && names[0] === "permission";
      },
    },
    {
      name: "objectLiteralProperties: a colon inside a string is not a property",
      pass: () => {
        const src = `t("k", { hint: "note: one, two", name })`;
        const { names } = objectLiteralProperties(src, src.indexOf("{", 5));
        return names.join(",") === "hint,name";
      },
    },
    {
      name: "objectLiteralProperties: a nested object's own keys stay nested",
      pass: () => {
        const src = `t("k", { a: { b: 1 }, c: 2 })`;
        return objectLiteralProperties(src, src.indexOf("{", 5)).names.join(",") === "a,c";
      },
    },
    {
      name: "objectLiteralProperties: a spread marks the call unjudgeable",
      pass: () => {
        const src = `t("k", { ...rest, a: 1 })`;
        return objectLiteralProperties(src, src.indexOf("{", 5)).dynamic === true;
      },
    },
    {
      name: "columnBlocks: each declared column is found with its field",
      pass: () => {
        const blocks = columnBlocks(
          `<CrudList.Column field="name">{(row) => row.name}</CrudList.Column>\n<CrudList.Column field="status">{(row) => row.status}</CrudList.Column>`,
        );
        return blocks.length === 2 && blocks[1].field === "status";
      },
    },
    {
      name: "cardSlots: the card region stops where the columns begin",
      pass: () => {
        const slots = cardSlots(
          `cardTitle={(row) => row.name}\ncardContent={(row) => row.code}\n<CrudList.Column field="status">{(row) => row.status}</CrudList.Column>`,
        );
        return slots.includes("row.code") && !slots.includes("row.status");
      },
    },
    {
      name: "readsServerData: a domain import puts server data in scope, a bare file does not",
      pass: () =>
        readsServerData(`import { useListAreas } from "@acme/domain-site";`)
        && !readsServerData(`const row = { type: "STATIC" };`),
    },
  ];
  let bad = 0;
  for (const c of cases) {
    let ok = false;
    try {
      ok = c.pass();
    } catch {
      ok = false;
    }
    console.log(`${ok ? "✔" : "✖"} ${c.name}`);
    if (!ok) bad++;
  }
  return bad;
}

function selftest() {
  let failed = selftestMechanisms();
  let passed = 0;
  console.log("");
  for (const rule of ALL_RULES) {
    const s = rule.samples;
    const problems = [];
    const notes = [];
    // Kept apart from `notes`: a neighbour the rule never looked at proves the path scoping, and
    // a neighbour the CHECK stayed quiet on proves the pattern. Counting them together lets the
    // second kind be quietly replaced by the first, which is a proof of nothing.
    const excluded = [];
    if (!s || s.broken === undefined || s.fixed === undefined) {
      console.log(`✖ ${rule.id}: no broken/fixed samples — a rule proved in one direction is not proved`);
      failed++;
      continue;
    }
    const broken = normalizeSample(s.broken, rule);
    const fixed = normalizeSample(s.fixed, rule);
    const onBroken = runSample(rule, broken);
    const onFixed = runSample(rule, fixed);
    if (!onBroken.applies) {
      problems.push(`appliesTo() rejects ${broken.file} — the rule could never run on the broken form`);
    } else if (!onBroken.hits.length) {
      problems.push("did NOT fire on the broken form");
    }
    if (!onBroken.reachable) {
      problems.push(`the scan never reaches ${broken.file} — collectSources() hands this file to no rule`);
    }
    if (!onFixed.applies) {
      problems.push(`appliesTo() rejects ${fixed.file} — silence on the fixed form would prove nothing`);
    } else if (onFixed.hits.length) {
      problems.push(`fired on the fixed form (${onFixed.hits.map((h) => h.excerpt).join("; ").slice(0, 140)})`);
    }
    for (const raw of s.miss ?? []) {
      const miss = normalizeSample(raw, rule);
      const out = runSample(rule, miss);
      if (out.hits.length) {
        problems.push(`fired on a near-neighbour — ${miss.note || miss.file} (${out.hits[0].excerpt.slice(0, 110)})`);
      } else if (out.applies) {
        notes.push(miss.note || miss.file);
      } else {
        excluded.push(miss.note || miss.file);
      }
    }
    if (problems.length) {
      console.log(`✖ ${rule.id}\n    ${problems.join("\n    ")}`);
      failed++;
    } else {
      passed++;
      const near = notes.length ? `  · silent on ${notes.length} near-neighbour(s)` : "";
      const scoped = excluded.length ? `${near ? "," : "  ·"} ${excluded.length} out of scope` : "";
      console.log(`✔ ${rule.id.padEnd(42)} fires on broken, silent on fixed${near}${scoped}`);
    }
  }
  console.log(`\n${passed} rule(s) proved both ways, ${failed} not proved.`);
  return failed === 0 ? 0 : 1;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

// An unrecognised option stops the run rather than falling through to a scan. `--self-test`
// against a script that only knows `--selftest` scanned nothing and printed
// "0 source files scanned — 0 error hit(s)", which is exactly what a clean project prints.
const FLAGS = ["--list", "--selftest", "--errors-only"];
const VALUED_FLAGS = ["--root=", "--rule="];
const unknownArgs = args.filter(
  (a) => !FLAGS.includes(a) && !VALUED_FLAGS.some((f) => a.startsWith(f)),
);
if (unknownArgs.length) {
  console.error(`✖ unrecognised option: ${unknownArgs.join(" ")}`);
  console.error(`  known options: ${FLAGS.join("  ")}  ${VALUED_FLAGS.map((f) => `${f}<value>`).join("  ")}`);
  process.exit(2);
}

if (args.includes("--list")) {
  for (const r of ALL_RULES) {
    console.log(`${r.level.padEnd(6)} ${r.id.padEnd(42)} ${r.invariant.padEnd(22)} ${r.desc}`);
  }
  process.exit(0);
}

if (args.includes("--selftest")) {
  process.exit(selftest());
}

const errorsOnly = args.includes("--errors-only");
const ruleFilter = args.find((a) => a.startsWith("--rule="))?.slice(7).split(",");

const files = collectSources();
const results = new Map(); // ruleId -> { rule, hits: [{file, line, excerpt}] }

for (const rule of RULES) {
  if (ruleFilter && !ruleFilter.includes(rule.id)) continue;
  const bucket = { rule, hits: [] };
  for (const abs of files) {
    const rel = path.relative(ROOT, abs);
    if (!rule.appliesTo(rel)) continue;
    const content = fs.readFileSync(abs, "utf8");
    for (const h of rule.check(content, rel)) bucket.hits.push({ file: rel, ...h });
  }
  if (bucket.hits.length) results.set(rule.id, bucket);
}

for (const rule of COLLECTION_RULES) {
  if (ruleFilter && !ruleFilter.includes(rule.id)) continue;
  const hits = rule.collect();
  if (hits.length) results.set(rule.id, { rule, hits });
}

let errorCount = 0;
let reviewCount = 0;

function printBucket(id, level, invariant, desc, hits) {
  if (errorsOnly && level !== "error") return;
  const mark = level === "error" ? "✖" : "◐";
  console.log(`\n${mark} [${level}] ${id} (${invariant}) — ${desc}`);
  for (const h of hits) console.log(`  ${h.file}${h.line ? `:${h.line}` : ""}  ${h.excerpt}`);
}

for (const { rule, hits } of results.values()) {
  printBucket(rule.id, rule.level, rule.invariant, rule.desc, hits);
  if (rule.level === "error") errorCount += hits.length;
  else reviewCount += hits.length;
}

console.log(`\n${files.length} source files scanned — ${errorCount} error hit(s), ${reviewCount} review candidate(s).`);
if (reviewCount && !errorsOnly) {
  console.log("Review candidates need human judgment against the invariant's stated exceptions — fix or justify, do not bulk-rewrite.");
}
process.exit(errorCount > 0 ? 1 : 0);
