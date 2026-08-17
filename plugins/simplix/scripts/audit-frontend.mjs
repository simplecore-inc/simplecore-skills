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
 *
 * Exit code 1 when any error-level rule has hits. "review"-level rules print
 * candidates that need human judgment and never fail the run.
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
import path from "node:path";

// Project root: --root=<dir> wins, else the current working directory. The script
// ships inside a plugin, so it must never resolve the root from its own location.
const ROOT = path.resolve(
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
 * KNOWN LIMIT: this reads the start of the line only. A block comment that wraps onto a second
 * line whose continuation does not begin with `*` reads as code, so a pattern mentioned there
 * still counts as a hit. Meeting a false positive on such a line means fixing this, not the rule
 * that used it — track the open/close of block comments across the file instead.
 */
function notCommentLine(line) {
  return !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line);
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
 * @param ns a translation namespace as a call site names it, `<module>/<catalogue>`
 * @returns every key the namespace's catalogue defines, flattened to dotted paths, or null when
 *          the catalogue is not one this repository owns — a framework namespace is not ours to
 *          judge, and treating an absent file as an empty catalogue would flag every call
 */
function localeKeys(ns) {
  if (localeKeyCache.has(ns)) return localeKeyCache.get(ns);
  let out = null;
  const [mod, catalogue] = ns.split("/");
  if (mod && catalogue && !ns.includes("..")) {
    const file = path.join(ROOT, "modules", mod, "src", "locales", catalogue, "ko.json");
    if (fs.existsSync(file)) {
      out = new Set();
      const walkJson = (obj, prefix) => {
        for (const [k, v] of Object.entries(obj)) {
          const at = prefix ? `${prefix}.${k}` : k;
          if (v && typeof v === "object") walkJson(v, at);
          else out.add(at);
        }
      };
      try {
        walkJson(JSON.parse(fs.readFileSync(file, "utf8")), "");
      } catch {
        out = null;
      }
    }
  }
  localeKeyCache.set(ns, out);
  return out;
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
const SETTINGS = (() => {
  const file = path.join(ROOT, ".claude", "simplix.json");
  if (!fs.existsSync(file)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return parsed.audit ?? {};
  } catch {
    console.error(`⚠ .claude/simplix.json is not valid JSON — auditing with defaults.`);
    return {};
  }
})();


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

const PUBLIC_ROUTE_DIRS = Array.isArray(SETTINGS.publicRouteDirs) ? SETTINGS.publicRouteDirs : [];

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
      && !PUBLIC_ROUTE_DIRS.some((dir) => p.includes(`/src/routes/${dir}/`))
      && !guardedAtRoot(p),
    check: (c) => lineHits(c, /component:\s*\w+\s*,/, (line) => !line.includes("guarded(")),
  },
  {
    id: "hand-rolled-detail-footer",
    invariant: "#31 / audit: page chrome",
    level: "error",
    desc: "CrudDetail footer built from raw layout instead of CrudDetail.DefaultActions / CrudDetail.ActionFooter — the panel's buttons drift in size, order and spacing from every other panel, and domain actions that should stay visible-but-disabled get hidden instead",
    appliesTo: isTsx,
    check: (c) =>
      blockHits(c, /footer=\{\s*\n\s*<(?!CrudDetail)(?:Stack|Flex|div|Box)\b/g),
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
      const hits = [];
      for (const alias of translatorBindings(c).keys()) {
        hits.push(
          ...blockHits(
            c,
            new RegExp(
              `\\b${alias}\\(\\s*[\`'"][^\`'"]*[\`'"]\\s*,\\s*\\{[^{}]*\\b(?:${OPTIONS})\\b`,
              "g",
            ),
          ),
        );
      }
      return hits;
    },
  },
  {
    id: "missing-translation-key",
    invariant: "audit: scaffold locale",
    level: "error",
    desc: "t() names a key its namespace's catalogue does not define — i18next falls back to printing the key, so the screen shows `product.selfServeHint` where the sentence should be and nothing errors",
    appliesTo: (p) => inModules(p) && isTsx(p),
    check: (c) => {
      const binds = translatorBindings(c);
      if (binds.size === 0) return [];
      const hits = [];
      for (const [alias, ns] of binds) {
        const keys = localeKeys(ns);
        if (!keys) continue;
        const call = new RegExp(`\\b${alias}\\(\\s*"([a-zA-Z0-9_.]+)"`, "g");
        hits.push(
          ...lineHits(c, call, (line) => {
            call.lastIndex = 0;
            return [...line.matchAll(call)].some((m) => !keys.has(m[1]));
          }),
        );
      }
      return hits;
    },
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
  },
  {
    id: "phantom-projection-read",
    invariant: "audit: generated contract",
    level: "error",
    desc: "Widget reads a nested object its entity's generated projection does not carry — every row falls through to the `??` branch, so the screen shows a raw id and nobody sees an error",
    appliesTo: (p) => inModules(p) && /\/widgets\/[^/]+\/(detail|list|form)\.tsx$/.test(p),
    check: (c, rel) => {
      const props = projectionProps(rel);
      if (!props) return [];
      return lineHits(c, /(?:displayData|row)\.(\w+)\?\./, (line) => {
        for (const m of line.matchAll(/(?:displayData|row)\.(\w+)\?\./g)) {
          if (!props.has(m[1])) return true;
        }
        return false;
      });
    },
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
  },
  {
    id: "boolean-faceted",
    invariant: "#14",
    level: "error",
    desc: 'Boolean field as faceted filter with true/false options — use type: "toggle"',
    appliesTo: isTsx,
    check: (c) => blockHits(c, /type:\s*"faceted"[\s\S]{0,300}?value:\s*("?(true|false)"?)/g),
  },
  {
    id: "deleted-toggle-filter",
    invariant: "#39",
    level: "error",
    desc: "Soft-delete implementation flag exposed as an operator filter",
    appliesTo: isTsx,
    check: (c) => blockHits(c, /type:\s*"toggle",\s*field:\s*"deleted"/g),
  },
  {
    id: "local-page-heading",
    invariant: "#31a",
    level: "review",
    desc: "Level 1/2 Heading in a pages/ file — page titles go through usePageHeader (header-slot Headings are OK)",
    appliesTo: (p) => inPages(p) && isTsx(p),
    check: (c) => lineHits(c, /<Heading level=\{[12]\}/),
  },
  {
    id: "page-root-padding",
    invariant: "#31c",
    level: "review",
    desc: "Ad-hoc p-4 padding in a pages/ file — the app layout owns page padding (inner cards are OK)",
    appliesTo: (p) => inPages(p) && isTsx(p),
    check: (c) => lineHits(c, /className="[^"]*\bp-4\b/, (line) => !line.includes("<Card")),
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
  },
  {
    id: "native-time-input",
    invariant: "#37",
    level: "error",
    desc: 'Native time input or free-text HH:mm placeholder — use FormFields.TimeField',
    appliesTo: isTsx,
    check: (c) => lineHits(c, /type:\s*"time"|placeholder="HH:mm"/),
  },
  {
    id: "local-time-helper-copy",
    invariant: "#37",
    level: "error",
    desc: "Per-module copy of the LocalTime <-> TimeValue conversion — import the shared helper pair",
    appliesTo: isTsx,
    check: (c) =>
      lineHits(c, /function\s+\w*[Ll]ocalTime\s*\(|const\s+(parseLocalTime|formatLocalTime|displayLocalTime)\s*=\s*\(/),
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
      blockHits(
        c,
        /transformFilters:\s*\(\s*(\w+)\s*\)\s*=>\s*\(?\{[\s\S]{0,400}?\.\.\.(?!\1\b)[A-Za-z_$]/g,
      ),
  },
  {
    id: "callback-prop-names",
    invariant: "#12",
    level: "error",
    desc: "Ad-hoc save callback name onSaved — use onSuccess",
    appliesTo: isTsx,
    check: (c) => lineHits(c, /\bonSaved\s*[=:{]/),
  },
  {
    id: "callback-done-name",
    invariant: "#12",
    level: "review",
    desc: "onDone callback — use onSuccess for save/submit completion (non-CRUD completions like animation ends are OK)",
    appliesTo: isTsx,
    check: (c) => lineHits(c, /\bonDone\s*[=:{]/),
  },
  {
    id: "wrap-string-prop",
    invariant: "#44",
    level: "error",
    desc: 'wrap="wrap" on Flex/Stack — wrap is a boolean prop',
    appliesTo: isTsx,
    check: (c) => lineHits(c, /wrap="wrap"/),
  },
  {
    id: "size-shorthand",
    invariant: "anti-pattern table",
    level: "review",
    desc: 'className "h-4 w-4" — use "size-4"',
    appliesTo: isTsx,
    check: (c) => lineHits(c, /className="[^"]*\bh-4 w-4\b/),
  },
  {
    id: "command-primitives",
    invariant: "registry: SearchPopover",
    level: "error",
    desc: "Command primitives imported in a module — use SearchPopover",
    appliesTo: (p) => inModules(p),
    check: (c) => lineHits(c, /import\s+\{[^}]*Command(Input|Item|List)/),
  },
  {
    id: "raw-select-import",
    invariant: "registry: SelectField compact",
    level: "error",
    desc: "Raw Select primitives imported in a module — use FormFields.SelectField",
    appliesTo: (p) => inModules(p),
    check: (c) => lineHits(c, /import\s+\{[^}]*Select(Trigger|Content|Item)\b/),
  },
  {
    id: "loader-spinner",
    invariant: "registry: Button loading",
    level: "review",
    desc: "Manual Loader2 / animate-spin — Button handles its own spinner (standalone overlays are OK)",
    appliesTo: (p) => inModules(p) && isTsx(p),
    check: (c) => lineHits(c, /\bLoader2\b|animate-spin/),
  },
  {
    id: "status-map-resurrect",
    invariant: "registry: tone maps",
    level: "error",
    desc: "Resurrected local status/severity color map — use the shared tone maps + StatusBadge/StatusDot",
    appliesTo: (p) => inModules(p),
    check: (c) => lineHits(c, /\b(STATUS_COLORS|SEVERITY_COLORS|severityConfig)\b/),
  },
  {
    id: "inline-dark-tone-map",
    invariant: "registry: tone maps",
    level: "review",
    desc: "Inline Record<> map with dark: status colors — status/severity maps belong to the shared UI package (categorical palettes are OK)",
    appliesTo: (p) => inModules(p) && isTsx(p),
    check: (c) =>
      /Record</.test(c) ? lineHits(c, /dark:bg-(red|green|emerald|amber|blue|orange|slate)-\d/) : [],
  },
  {
    id: "drag-threshold-copy",
    invariant: "registry: ResizeHandle",
    level: "error",
    desc: "Local DRAG_THRESHOLD_PX redefinition — import it from the shared UI package",
    appliesTo: (p) => inModules(p),
    check: (c) => lineHits(c, /const DRAG_THRESHOLD_PX/),
  },
  {
    id: "cursor-col-resize",
    invariant: "registry: ResizeHandle",
    level: "review",
    desc: "Inline cursor-col-resize edge grip — use <ResizeHandle /> (canvas vertex handles are OK)",
    appliesTo: (p) => inModules(p) && isTsx(p),
    check: (c) => lineHits(c, /cursor-col-resize/),
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
  },
  {
    id: "header-id-title",
    invariant: "census 3",
    level: "error",
    desc: "detailHeader/editHeader interpolating an id — titles carry a name",
    appliesTo: isTsx,
    check: (c) => lineHits(c, /(detailHeader|editHeader)[^\n]*\bid:/),
  },
  {
    id: "description-as-filter",
    invariant: "e2e: Search Is Part of the Product",
    level: "review",
    desc: "A definition row's description offered as a list filter — the persona finds these by name or code, not by their prose (an event's 사유/목적/메모 is a different case and legitimately searchable)",
    appliesTo: (p) => isTsx(p) && /list\.tsx$/.test(p),
    check: (c) => lineHits(c, /type:\s*"text",\s*field:\s*"description"/),
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
  },
  {
    id: "lowercase-enum-label",
    invariant: "#10",
    level: "error",
    desc: "enumLabel called with a lower-case enum name — the backend registers enums by their PascalCase simple name, so the key never resolves and the raw key renders",
    appliesTo: isTsx,
    check: (c) => lineHits(c, /enumLabel\(\s*"[a-z]/),
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
  },
  {
    id: "enum-label-empty-fallback",
    invariant: "#36",
    level: "review",
    desc: "enumLabel(..., resolveBootEnum(x) ?? \"\") — an absent enum resolves to the empty string and the resolver prints the message key itself (\"<Enum>.\"); confirm the field can never be null",
    appliesTo: isTsx,
    check: (c) => lineHits(c, /enumLabel\([^)]*resolveBootEnum\([^)]*\)\s*\?\?\s*""/),
  },
  {
    id: "full-enum-options",
    invariant: "#38",
    level: "review",
    desc: "Object.values(<Enum>).map as WRITE-surface select options — check whether the server narrows the set per record (filters over the full set are fine)",
    appliesTo: (p) => isTsx(p) && /form|dialog|editor|wizard/.test(p),
    check: (c) => lineHits(c, /Object\.values\([A-Z]\w+\)\.map/),
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
  },
  {
    id: "two-state-branching",
    invariant: "#38",
    level: "review",
    desc: "Two-state ternary on a status/presence value — the third state falls into the wrong arm",
    appliesTo: isTsx,
    check: (c) =>
      lineHits(c, /\b(presence|status)\s*===\s*"[A-Z_]+"\s*\?/, (line) => !line.includes("switch")),
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
      const trapping = [...c.matchAll(
        /if\s*\([^)]*\bisLoading\b[^)]*\|\|[^)]*\)\s*\{?\s*return\s*\(?\s*<[\s\S]{0,400}?<Skeleton\b/g,
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
        /if\s*\(\s*([A-Za-z_$][\w$]*)\.isLoading\s*\)\s*\{?\s*return\s*\(?\s*<[\s\S]{0,500}?<Skeleton\b/g,
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
      // Any read of the link before the action counts, whatever it is called. The shape is a
      // mount effect that asks about the token and parks the answer, which is what a later
      // branch can gate the button on — a screen that only knows the token is non-empty is the
      // one that cannot tell a live link from a dead one.
      const readsFirst = [...c.matchAll(/useEffect\(\s*\(\s*\)\s*=>\s*\{[\s\S]{0,900}?\n\s*\}\s*,\s*\[/g)]
        .some((m) => /\btoken\b/.test(m[0]) && /\bset[A-Z]\w*\(/.test(m[0]));
      if (readsFirst) {
        return [];
      }
      return acting.map((m) => ({
        line: lineOfIndex(c, m.index),
        excerpt: m[0].replace(/\s+/g, " ").slice(0, 140),
      }));
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
  },
  {
    id: "spinner-beside-mark",
    invariant: "#9 / audit: framework components",
    level: "error",
    desc: "Waiting button leads with an icon and names no loadingText — Button composes the spinner ahead of its children, so pressing it draws a spinner and the icon side by side and widens the button mid-click, shifting a segmented row-action group out from under the pointer. Pass the label as loadingText so the spinner takes the icon's seat",
    appliesTo: isTsx,
    check: spinnerBesideMark,
  },
];

// ---------------------------------------------------------------------------
// Locale rules (JSON-based, separate collection)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
if (args.includes("--list")) {
  for (const r of RULES) console.log(`${r.level.padEnd(6)} ${r.id.padEnd(26)} ${r.invariant.padEnd(22)} ${r.desc}`);
  console.log(`error  locale-missing-sections    audit: scaffold locale   ko/ja locale file or top-level section missing vs en`);
  console.log(`review locale-untranslated        audit: scaffold locale   camelCase English defaults left untranslated in ko/ja`);
  console.log(`review ko-particle-after-placeholder audit: locale wording  Korean particle welded to {{value}} — right for some values, wrong for the rest`);
  console.log(`review scaffold-header-placeholder audit: scaffold locale   scaffold placeholder wording left on a screen — bare "new" header, or a "master data" subtitle`);
  process.exit(0);
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

let localeErr = [];
let localeRev = [];
if (!ruleFilter || ruleFilter.some((r) => r.startsWith("locale"))) {
  const lf = localeFindings();
  localeErr = lf.errors;
  localeRev = lf.reviews;
}

let koParticleRev = [];
if (!ruleFilter || ruleFilter.includes("ko-particle-after-placeholder")) {
  koParticleRev = koParticleFindings();
}

let scaffoldHeaderRev = [];
if (!ruleFilter || ruleFilter.includes("scaffold-header-placeholder")) {
  scaffoldHeaderRev = scaffoldHeaderFindings();
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
if (localeErr.length) {
  printBucket("locale-missing-sections", "error", "audit: scaffold locale", "locale file/section missing vs en.json", localeErr);
  errorCount += localeErr.length;
}
if (localeRev.length) {
  printBucket("locale-untranslated", "review", "audit: scaffold locale", "possible untranslated scaffold defaults", localeRev);
  reviewCount += localeRev.length;
}
if (koParticleRev.length) {
  printBucket(
    "ko-particle-after-placeholder",
    "review",
    "audit: locale wording",
    "Korean particle written straight after an interpolated value — 을/를 · 이/가 · 은/는 · 와/과 · (으)로 depend on the value's last syllable, so the sentence is wrong for half the values; attach the particle to a fixed noun instead, or end the clause on the value with 입니다",
    koParticleRev,
  );
  reviewCount += koParticleRev.length;
}
if (scaffoldHeaderRev.length) {
  printBucket(
    "scaffold-header-placeholder",
    "review",
    "audit: scaffold locale",
    "Screen wording still carries the scaffold's placeholder — a bare \"new\" that names no entity, or a subtitle naming the table (\"master data\") instead of the operator's job",
    scaffoldHeaderRev,
  );
  reviewCount += scaffoldHeaderRev.length;
}

console.log(`\n${files.length} source files scanned — ${errorCount} error hit(s), ${reviewCount} review candidate(s).`);
if (reviewCount && !errorsOnly) {
  console.log("Review candidates need human judgment against the invariant's stated exceptions — fix or justify, do not bulk-rewrite.");
}
process.exit(errorCount > 0 ? 1 : 0);
