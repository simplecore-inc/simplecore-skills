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
 */

import fs from "node:fs";
import path from "node:path";

// Project root: --root=<dir> wins, else the current working directory. The script
// ships inside a plugin, so it must never resolve the root from its own location.
const ROOT = path.resolve(
  process.argv.find((a) => a.startsWith("--root="))?.slice("--root=".length) ?? process.cwd(),
);
const SRC_ROOTS = ["modules", "apps"];
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

function blockHits(content, re) {
  const hits = [];
  for (const m of content.matchAll(re)) {
    hits.push({ line: lineOfIndex(content, m.index), excerpt: m[0].replace(/\s+/g, " ").slice(0, 140) });
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Rules — { id, invariant, level: "error"|"review", desc, appliesTo(relPath), check(content, relPath) }
// ---------------------------------------------------------------------------

const inModules = (p) => p.startsWith("modules/");
const inPages = (p) => /\/src\/pages\//.test(p);
const isListWidget = (p) => /\/widgets\/.*list.*\.tsx$|\/widgets\/[^/]+\/list\.tsx$/.test(p);
const isTsx = (p) => p.endsWith(".tsx");

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
  const root = path.join(file.slice(0, at + marker.length), "__root.tsx");
  if (!fs.existsSync(root)) return false;
  return /beforeLoad\s*:/.test(fs.readFileSync(root, "utf8"));
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
    id: "unresolved-boot-enum-label",
    invariant: "#10 / #36",
    level: "error",
    desc: "enumLabel() called on a DTO field straight from the row — a boot enum arrives as an object, so the key becomes `Enum.[object Object]` and the screen prints the key",
    appliesTo: isTsx,
    check: (c) =>
      lineHits(
        c,
        /enumLabel\(\s*"[^"]+"\s*,\s*(?:String\(\s*)?(?:displayData|row|values)\.\w+/,
        (line) => !line.includes("resolveBootEnum"),
      ),
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
    id: "hand-typed-id",
    invariant: "#34 / census 4",
    level: "error",
    desc: "Text input bound to an *Id value — entity references come from a picker, files from the file field",
    appliesTo: isTsx,
    check: (c) => blockHits(c, /<FormFields\.(TextField|TextareaField)(?:(?!\/>)[\s\S]){0,250}?value=\{[^}]*Id[a-z]*\s*\}/g),
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
    check: (c) => lineHits(c, /fieldLabel\("(id|sortOrder|displayOrder)"\)/),
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
    id: "full-enum-options",
    invariant: "#38",
    level: "review",
    desc: "Object.values(<Enum>).map as WRITE-surface select options — check whether the server narrows the set per record (filters over the full set are fine)",
    appliesTo: (p) => isTsx(p) && /form|dialog|editor|wizard/.test(p),
    check: (c) => lineHits(c, /Object\.values\([A-Z]\w+\)\.map/),
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

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
if (args.includes("--list")) {
  for (const r of RULES) console.log(`${r.level.padEnd(6)} ${r.id.padEnd(26)} ${r.invariant.padEnd(22)} ${r.desc}`);
  console.log(`error  locale-missing-sections    audit: scaffold locale   ko/ja locale file or top-level section missing vs en`);
  console.log(`review locale-untranslated        audit: scaffold locale   camelCase English defaults left untranslated in ko/ja`);
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

console.log(`\n${files.length} source files scanned — ${errorCount} error hit(s), ${reviewCount} review candidate(s).`);
if (reviewCount && !errorsOnly) {
  console.log("Review candidates need human judgment against the invariant's stated exceptions — fix or justify, do not bulk-rewrite.");
}
process.exit(errorCount > 0 ? 1 : 0);
