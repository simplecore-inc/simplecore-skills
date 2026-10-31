#!/usr/bin/env node
/**
 * Duplicate React-context package audit.
 *
 * A package that calls `createContext` at module scope has one context object per physical
 * copy of that package. When pnpm answers two importers with two copies - an app declaring
 * `simplix-react` and a module declaring `@simplix-react/ui`, say - the provider one side
 * renders is not the context the other side reads. Nothing throws. The provider stays empty,
 * the consumer falls back to its default, and the screen renders with a piece silently
 * missing: a page with no title and no create button, a query client that "is not set", a
 * translation that never arrives.
 *
 * Vite's `resolve.dedupe` is the fix, so this audit reports a duplicated context-owning
 * package that the dedupe list does not name. The list is read from the project rather than
 * assumed, and the packages are judged by what their code actually does.
 *
 * Where the list is read from, first match wins: the module `--dedupe=<file>` names; a module
 * at one of DEDUPE_MODULES exporting it (`DEDUPE` or the default export); otherwise every
 * `resolve.dedupe: [...]` written as a literal list of strings in a Vite config at the root or
 * one level inside a workspace directory, merged. A Vite config that declares `dedupe` in any
 * other form - an identifier, a spread, a call - cannot be read as text, and the run stops with
 * exit 2 rather than judge against a list it could not see.
 *
 * The same split happens without pnpm's help when a UI kit is installed from a checkout of its
 * own: the kit's `node_modules` links `@simplix-react/ui` to one framework checkout and the app's
 * links another, so the kit's screens are type-checked and bundled against a framework the app
 * never runs. Each kit package the app resolves (`@simplix-react-ui-kits/*`, found through the
 * app's own `node_modules`, never through a path written here) is followed to where it lives, and
 * the `@simplix-react/ui` it resolves from there, the way Node walks up from the file, is compared
 * by real path with the one the app resolves. A difference is an error, whatever the dedupe list
 * says: a bundler's dedupe settles which copy is bundled, and the type checker still reads the
 * kit's.
 *
 * Usage:
 *   node scripts/check-duplicate-contexts.mjs             # audits the working directory
 *   node scripts/check-duplicate-contexts.mjs --root=<dir>
 *   node scripts/check-duplicate-contexts.mjs --dedupe=config/vite/dedupe.js
 *   node scripts/check-duplicate-contexts.mjs --json
 *   node scripts/check-duplicate-contexts.mjs --warn-only   # report, never fail
 *   node scripts/check-duplicate-contexts.mjs --selftest    # hit and miss cases on temp trees
 *
 * Exit code 1 when a duplicated context-owning package is missing from the dedupe list, or a kit
 * resolves the framework to a different copy than the app, unless --warn-only is passed. The post-switch check uses --warn-only: a link-profile switch
 * should say what it changed without failing over a finding in a toolchain it does not own.
 * Exit code 2 when the run cannot decide: an unrecognised option, or a dedupe list that is
 * declared but unreadable.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { parseOptions, reportUnknown } from "./lib/cli-options.mjs";

// Every option this script knows, so an unrecognised one stops the run instead of falling
// through to an audit of the wrong tree or with the wrong grade.
const OPTION_SPEC = { flags: ["--json", "--warn-only", "--selftest"], valued: ["root", "dedupe"] };
const { flags, values: options, unknown } = parseOptions(process.argv.slice(2), OPTION_SPEC);
if (reportUnknown(unknown, OPTION_SPEC)) process.exit(2);
const args = [...flags];

/** The scope the UI kits are published under. */
const KIT_SCOPE = "@simplix-react-ui-kits";

/** Framework packages the app and every kit it resolves must reach as one copy. */
const SHARED_FRAMEWORK_PACKAGES = ["@simplix-react/ui"];

if (flags.has("--selftest")) process.exit(selfTest());

// The audit reads the project it is pointed at, never the directory it is installed in, so one
// copy serves a repository's own scripts/ and a shared toolchain alike.
const ROOT = path.resolve(options.root ?? process.cwd());
const PNPM_DIR = path.join(ROOT, "node_modules", ".pnpm");

/** Modules a project may keep its Vite dedupe list in, tried in order before the Vite configs. */
const DEDUPE_MODULES = ["config/vite/dedupe.js", "config/vite/dedupe.mjs", "vite.dedupe.js"];

/** The file names a Vite config takes. */
const VITE_CONFIG = /^vite\.config\.(?:js|mjs|cjs|ts|mts|cts)$/;

/** Files worth reading when deciding whether a package creates a context. */
const CODE_FILE = /\.(js|mjs|cjs|jsx|ts|tsx)$/;

/** Directories inside a package that never hold its shipped code. */
const SKIP_DIRS = new Set(["node_modules", "__tests__", "test", "tests", "coverage"]);

/** Read budget per package, so a large dist cannot stall the audit. */
const MAX_BYTES_PER_PACKAGE = 8 * 1024 * 1024;

const asJson = args.includes("--json");
const warnOnly = args.includes("--warn-only");
const dedupeArg = options.dedupe;

/**
 * Decodes a `.pnpm` directory name into the package it holds.
 *
 * `@simplix-react+ui@0.3.2_9ed1cad9…` → `{ name: "@simplix-react/ui", version: "0.3.2" }`.
 * The peer-hash suffix after `_` is what distinguishes two copies of one version, which is
 * exactly the case this audit exists for.
 */
function decodeEntry(entry) {
  const scoped = entry.startsWith("@");
  const at = entry.indexOf("@", scoped ? 1 : 0);
  if (at <= 0) return null;
  const name = entry.slice(0, at).replace("+", "/");
  const rest = entry.slice(at + 1);
  const version = rest.split("_")[0];
  return { name, version, dir: path.join(PNPM_DIR, entry, "node_modules", ...name.split("/")) };
}

/** Every physical copy present, grouped by package name. */
function collectCopies() {
  let entries;
  try {
    entries = fs.readdirSync(PNPM_DIR);
  } catch {
    return null;
  }
  const byName = new Map();
  for (const entry of entries) {
    const decoded = decodeEntry(entry);
    if (!decoded || !fs.existsSync(decoded.dir)) continue;
    const list = byName.get(decoded.name) ?? [];
    list.push(decoded);
    byName.set(decoded.name, list);
  }
  return byName;
}

/** Whether the package's shipped code creates a React context at module scope. */
function createsContext(dir) {
  let budget = MAX_BYTES_PER_PACKAGE;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(current, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) stack.push(full);
        continue;
      }
      if (!CODE_FILE.test(e.name)) continue;
      let size = 0;
      try {
        size = fs.statSync(full).size;
      } catch {
        continue;
      }
      if (size > budget) return false;
      budget -= size;
      let content;
      try {
        content = fs.readFileSync(full, "utf8");
      } catch {
        continue;
      }
      if (/\bcreateContext\s*[(<]/.test(content)) return true;
    }
  }
  return false;
}

/**
 * Every package name a workspace manifest depends on directly.
 *
 * Read from the manifests rather than from a list, so the audit follows the workspace as it
 * grows. Workspace globs come from `pnpm-workspace.yaml` when it is there; otherwise the
 * conventional directories are scanned.
 */
/**
 * The workspace directories that hold packages, from `pnpm-workspace.yaml` when it declares
 * them, else the conventional ones.
 */
function workspaceRoots() {
  const workspaceFile = path.join(ROOT, "pnpm-workspace.yaml");
  if (fs.existsSync(workspaceFile)) {
    const declared = fs
      .readFileSync(workspaceFile, "utf8")
      .split("\n")
      .map((line) => /^\s*-\s*["']?([^"'\s]+)["']?\s*$/.exec(line)?.[1])
      .filter(Boolean)
      .filter((glob) => glob.endsWith("/*"))
      .map((glob) => glob.slice(0, -2));
    if (declared.length) return declared;
  }
  return ["packages", "modules", "apps", "config"];
}

/** Every workspace package directory that has a manifest, under the workspace directories. */
function workspacePackageDirs() {
  const dirs = [];
  for (const root of workspaceRoots()) {
    let entries;
    try {
      entries = fs.readdirSync(path.join(ROOT, root), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (e.isDirectory() && fs.existsSync(path.join(ROOT, root, e.name, "package.json"))) {
        dirs.push(path.join(ROOT, root, e.name));
      }
    }
  }
  return dirs;
}

function collectDirectDependencies() {
  const names = new Set();
  const manifests = [path.join(ROOT, "package.json")];
  for (const dir of workspacePackageDirs()) manifests.push(path.join(dir, "package.json"));

  for (const manifest of manifests) {
    let pkg;
    try {
      pkg = JSON.parse(fs.readFileSync(manifest, "utf8"));
    } catch {
      continue;
    }
    for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
      for (const name of Object.keys(pkg[field] ?? {})) names.add(name);
    }
  }
  return names;
}

/** The real path of `file`, or `null` when nothing is there. */
function realpathOrNull(file) {
  try {
    return fs.realpathSync(file);
  } catch {
    return null;
  }
}

/**
 * Where Node would find `name` for a file in `fromDir`: the first `node_modules` on the way up
 * that holds it, as a real path.
 */
function resolveFrom(fromDir, name) {
  for (let dir = fromDir; ; dir = path.dirname(dir)) {
    const found = realpathOrNull(path.join(dir, "node_modules", ...name.split("/")));
    if (found) return found;
    if (path.dirname(dir) === dir) return null;
  }
}

/**
 * The kit packages the app resolves, as the directories they really live in, found through the
 * `node_modules` of the root and of each workspace package.
 *
 * @returns {Map<string, string>} real directory → the name it is installed under
 */
function installedKits() {
  const found = new Map();
  for (const dir of [ROOT, ...workspacePackageDirs()]) {
    const scopeDir = path.join(dir, "node_modules", KIT_SCOPE);
    let names;
    try {
      names = fs.readdirSync(scopeDir);
    } catch {
      continue;
    }
    for (const name of names) {
      const real = realpathOrNull(path.join(scopeDir, name));
      if (real && !found.has(real)) found.set(real, `${KIT_SCOPE}/${name}`);
    }
  }
  return found;
}

/**
 * The framework copy the app resolves for `name`: the root's, else the first workspace package
 * that has one.
 */
function appFrameworkCopy(name) {
  for (const dir of [ROOT, ...workspacePackageDirs()]) {
    const real = realpathOrNull(path.join(dir, "node_modules", ...name.split("/")));
    if (real) return real;
  }
  return null;
}

/**
 * Compares, for each shared framework package, the copy the app resolves with the copy each
 * installed kit resolves from where it lives.
 *
 * @returns {{ kits: string[], compared: number, skipped: string[], mismatches: object[] }}
 */
function compareKitFrameworkCopies() {
  const kits = installedKits();
  const result = { kits: [...kits.values()].sort(), compared: 0, skipped: [], mismatches: [] };
  for (const name of SHARED_FRAMEWORK_PACKAGES) {
    const app = appFrameworkCopy(name);
    if (!app) {
      result.skipped.push(`the app resolves no ${name}`);
      continue;
    }
    for (const [dir, kit] of kits) {
      const resolved = resolveFrom(dir, name);
      if (!resolved) {
        result.skipped.push(`${kit} reaches no ${name}`);
        continue;
      }
      result.compared += 1;
      if (resolved !== app) result.mismatches.push({ package: name, kit, kitDir: dir, app, resolved });
    }
  }
  return result;
}

/** Every Vite config at the root and one level inside each workspace directory. */
function viteConfigs() {
  const found = [];
  const look = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) if (e.isFile() && VITE_CONFIG.test(e.name)) found.push(path.join(dir, e.name));
  };
  look(ROOT);
  for (const root of workspaceRoots()) {
    let entries;
    try {
      entries = fs.readdirSync(path.join(ROOT, root), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) if (e.isDirectory()) look(path.join(ROOT, root, e.name));
  }
  return found;
}

/**
 * The `dedupe` lists one Vite config declares, read as text: a config is TypeScript more often
 * than not, and importing it would need the project's own resolution.
 *
 * <p>Returns `null` for a config that names no dedupe at all, and `unreadable: true` when a
 * `dedupe` key holds anything but a literal list of strings - a list this audit cannot see is
 * not an empty list, and judging against it would report every package the project did name.
 */
function readViteDedupe(file) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
  const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const keys = [...code.matchAll(/\bdedupe\s*:/g)];
  if (keys.length === 0) return null;
  const names = [];
  for (const k of keys) {
    const rest = code.slice(k.index + k[0].length);
    const literal = /^\s*\[([^\]]*)\]/.exec(rest);
    if (!literal) return { names, unreadable: true };
    const body = literal[1];
    const strings = [...body.matchAll(/["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
    // Anything left once the string literals and their separators are taken out - a spread, an
    // identifier, a call - is a part of the list the text does not show.
    if (body.replace(/["'`][^"'`]+["'`]/g, "").replace(/[\s,]/g, "") !== "") {
      return { names, unreadable: true };
    }
    names.push(...strings);
  }
  return { names, unreadable: false };
}

/** The dedupe list the project's bundler config declares, and where it was found. */
async function loadDedupe() {
  const modules = dedupeArg ? [dedupeArg] : DEDUPE_MODULES;
  for (const rel of modules) {
    const abs = path.resolve(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    try {
      const mod = await import(pathToFileURL(abs).href);
      const list = mod.DEDUPE ?? mod.default;
      if (Array.isArray(list)) return { list, source: path.relative(ROOT, abs) };
    } catch (error) {
      return { list: [], source: path.relative(ROOT, abs), error: String(error) };
    }
  }
  // A module named on the command line is the only place looked: the caller said where it is.
  if (dedupeArg) return { list: [], source: null, missing: dedupeArg };

  const list = [];
  const sources = [];
  const unreadable = [];
  for (const file of viteConfigs()) {
    const read = readViteDedupe(file);
    if (!read) continue;
    const rel = path.relative(ROOT, file);
    if (read.unreadable) unreadable.push(rel);
    else {
      list.push(...read.names);
      sources.push(rel);
    }
  }
  return { list, source: sources.length ? sources.join(", ") : null, unreadable };
}

// ---------------------------------------------------------------------------
// Self-test
// ---------------------------------------------------------------------------

/**
 * Builds two trees, an app and a kit, in a temporary directory and runs this script against the
 * app: the real command line, so the exit code and the output are what a caller sees.
 *
 * <p>The kit is found through the app's `node_modules`, never by a path the script was given, so
 * each case wires the app's `@simplix-react-ui-kits/*` link to wherever its kit lives. Two layouts
 * are built: a kit checkout (`<kit>/packages/<name>`, the framework linked at `<kit>/node_modules`)
 * and a kit installed into a package store (the framework a sibling in the store entry).
 */
function selfTest() {
  const script = fileURLToPath(import.meta.url);
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "check-duplicate-contexts-")));

  const write = (file, text) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  };
  const link = (target, at) => {
    fs.mkdirSync(path.dirname(at), { recursive: true });
    fs.symlinkSync(target, at, "dir");
  };
  /** A framework copy: a directory holding the package, returned by its real path. */
  const framework = (name) => {
    const dir = path.join(tmp, "frameworks", name, "ui");
    write(path.join(dir, "package.json"), JSON.stringify({ name: "@simplix-react/ui" }));
    return dir;
  };
  /** An app whose `node_modules` links the framework copy and the kit packages given. */
  const app = (name, { ui, kitDir, at = "." }) => {
    const root = path.join(tmp, name);
    write(path.join(root, "package.json"), JSON.stringify({ name }));
    fs.mkdirSync(path.join(root, "node_modules", ".pnpm"), { recursive: true });
    if (ui) link(ui, path.join(root, "node_modules", "@simplix-react", "ui"));
    if (kitDir) {
      const holder = path.join(root, at);
      write(path.join(holder, "package.json"), JSON.stringify({ name: `${name}-holder` }));
      link(kitDir, path.join(holder, "node_modules", KIT_SCOPE, "console-x"));
    }
    return root;
  };
  /** A kit checkout: the package under `packages/`, the framework linked at the kit's root. */
  const checkoutKit = (name, { ui }) => {
    const root = path.join(tmp, name);
    const pkg = path.join(root, "packages", "console-x");
    write(path.join(pkg, "package.json"), JSON.stringify({ name: `${KIT_SCOPE}/console-x` }));
    if (ui) link(ui, path.join(root, "node_modules", "@simplix-react", "ui"));
    return pkg;
  };
  /** A kit installed into a package store: the framework is a sibling of the kit in the entry. */
  const storeKit = (name, { ui }) => {
    const entry = path.join(tmp, name, "node_modules", ".pnpm", "kit-console-x@1", "node_modules");
    const pkg = path.join(entry, KIT_SCOPE, "console-x");
    write(path.join(pkg, "package.json"), JSON.stringify({ name: `${KIT_SCOPE}/console-x` }));
    if (ui) link(ui, path.join(entry, "@simplix-react", "ui"));
    return pkg;
  };

  const run = (root, extra = []) => {
    const r = spawnSync(process.execPath, [script, "--json", `--root=${root}`, ...extra], { encoding: "utf8" });
    let json = null;
    try {
      json = JSON.parse(r.stdout).kitCopies;
    } catch {
      // A run that printed no JSON fails the case below through its exit code and `json` of null.
    }
    return { status: r.status, json, out: r.stdout, err: r.stderr };
  };

  const a = framework("a");
  const b = framework("b");
  const cases = [
    {
      name: "hit: a kit checkout resolves a different framework copy than the app",
      root: () => app("hit-checkout", { ui: a, kitDir: checkoutKit("kit-hit-checkout", { ui: b }) }),
      status: 1,
      mismatches: 1,
      compared: 1,
      holds: (r) => r.json.mismatches[0].app === a && r.json.mismatches[0].resolved === b,
    },
    {
      name: "hit: a kit installed into a package store resolves a different copy than the app",
      root: () => app("hit-store", { ui: a, kitDir: storeKit("kit-hit-store", { ui: b }) }),
      status: 1,
      mismatches: 1,
      compared: 1,
    },
    {
      name: "hit: the kit is found through a workspace package's node_modules, not the root's",
      root: () => app("hit-workspace", { ui: a, kitDir: checkoutKit("kit-hit-workspace", { ui: b }), at: "apps/web" }),
      status: 1,
      mismatches: 1,
      compared: 1,
    },
    {
      name: "hit: --warn-only reports the difference and exits 0",
      root: () => app("hit-warn", { ui: a, kitDir: checkoutKit("kit-hit-warn", { ui: b }) }),
      extra: ["--warn-only"],
      status: 0,
      mismatches: 1,
      compared: 1,
    },
    {
      name: "miss: a kit checkout and the app resolve the same framework copy",
      root: () => app("miss-checkout", { ui: a, kitDir: checkoutKit("kit-miss-checkout", { ui: a }) }),
      status: 0,
      mismatches: 0,
      compared: 1,
    },
    {
      name: "miss: a store-installed kit and the app resolve the same framework copy",
      root: () => app("miss-store", { ui: a, kitDir: storeKit("kit-miss-store", { ui: a }) }),
      status: 0,
      mismatches: 0,
      compared: 1,
    },
    {
      name: "miss: a kit that reaches no framework copy has nothing to differ from",
      root: () => app("miss-unreached", { ui: a, kitDir: checkoutKit("kit-miss-unreached", {}) }),
      status: 0,
      mismatches: 0,
      compared: 0,
      holds: (r) => r.json.skipped.some((line) => line.includes("reaches no")),
    },
    {
      name: "miss: an app that installs no kit compares nothing",
      root: () => app("miss-nokit", { ui: a }),
      status: 0,
      mismatches: 0,
      compared: 0,
      holds: (r) => r.json.kits.length === 0,
    },
  ];

  let failed = 0;
  try {
    for (const c of cases) {
      const r = run(c.root(), c.extra);
      const ok =
        r.status === c.status &&
        r.json !== null &&
        r.json.mismatches.length === c.mismatches &&
        r.json.compared === c.compared &&
        (c.holds ? c.holds(r) : true);
      if (!ok) failed += 1;
      console.log(
        `${ok ? "✔" : "✖"} ${c.name}` +
          (ok
            ? ""
            : `\n   exit ${r.status} (wanted ${c.status}), ` +
              `${r.json ? `${r.json.mismatches.length} differing, ${r.json.compared} compared` : `no result: ${r.err.trim() || r.out.trim()}`}`),
      );
    }

    // The text a person reads names both copies and the kit, so the fix is where to look.
    const root = app("text", { ui: a, kitDir: checkoutKit("kit-text", { ui: b }) });
    const r = spawnSync(process.execPath, [script, `--root=${root}`], { encoding: "utf8" });
    const named = [a, b, `${KIT_SCOPE}/console-x`, "kit-framework-copy"].every((needle) => r.stdout.includes(needle));
    if (!named) failed += 1;
    console.log(`${named ? "✔" : "✖"} the report names the app's copy, the kit's copy and the kit`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(failed === 0 ? `\n✔ ${cases.length + 1} cases` : `\n✖ ${failed} of ${cases.length + 1} cases came out wrong`);
  return failed === 0 ? 0 : 1;
}

const byName = collectCopies();
if (!byName) {
  console.error("✖ node_modules/.pnpm not found — run the audit from a pnpm workspace after install.");
  process.exit(1);
}

const {
  list: dedupe,
  source: dedupeSource,
  error: dedupeError,
  missing: dedupeMissing,
  unreadable = [],
} = await loadDedupe();
const deduped = new Set(dedupe);

if (dedupeMissing) {
  console.error(`\u2716 --dedupe=${dedupeMissing}: no module there exports a dedupe list (\`DEDUPE\` or the default export)`);
  process.exit(2);
}

const directDeps = collectDirectDependencies();

const errors = [];
const reviews = [];

for (const [name, copies] of [...byName].sort(([a], [b]) => a.localeCompare(b))) {
  // Two copies of DIFFERENT versions is an ordinary resolution - a dependency asked for a
  // major this workspace does not use. The accident this audit is about is one version split
  // into several physical copies by differing peer sets, which no manifest asked for.
  const splitVersions = [...new Set(copies.map((c) => c.version))].filter(
    (v) => copies.filter((c) => c.version === v).length > 1,
  );
  if (!splitVersions.length) continue;

  // A context only matters when this workspace imports the package itself. A context deep in
  // a transitive dependency is that dependency's own business, and it renders its provider
  // and its consumer from the same copy.
  if (!directDeps.has(name)) continue;

  const entry = { name, copies: copies.length, versions: splitVersions.sort() };
  if (!copies.some((c) => createsContext(c.dir))) {
    reviews.push(entry);
  } else if (!deduped.has(name)) {
    errors.push(entry);
  }
}

const kitCopies = compareKitFrameworkCopies();
const failing = errors.length > 0 || kitCopies.mismatches.length > 0;

// A declared list the text does not show decides nothing about the packages it may name. With
// nothing to report the run is still clean; with findings it cannot tell real from false.
const undecided = unreadable.length > 0 && errors.length > 0;

if (asJson) {
  console.log(JSON.stringify({ dedupeSource, dedupe, unreadable, errors, reviews, kitCopies }, null, 2));
  process.exit(undecided && !warnOnly ? 2 : failing && !warnOnly ? 1 : 0);
}

for (const file of unreadable) {
  console.log(
    `\u26a0 ${file} declares resolve.dedupe in a form this audit cannot read as text (an identifier, a spread, a call) - move the list into a module and name it with --dedupe=<file>`,
  );
}

if (dedupeError) {
  console.log(`⚠ dedupe list at ${dedupeSource} could not be read — treating it as empty (${dedupeError})`);
} else if (dedupeSource) {
  console.log(`dedupe list: ${dedupeSource} (${dedupe.length} entries)`);
} else if (!unreadable.length) {
  console.log(
    "\u26a0 no dedupe list found - every duplicated context package below is reported. A list kept in a module this audit does not look for is named with --dedupe=<file>",
  );
}

if (errors.length) {
  console.log("\n✖ [error] duplicate-context-package — a package that creates a React context resolves to more than one copy");
  console.log("  Each copy carries its own context object, so a provider rendered from one copy is invisible to a");
  console.log("  consumer that imported the other. Add the name to the bundler's resolve.dedupe list.");
  for (const e of errors) {
    console.log(`  ${e.name}  ${e.copies} copies  (version${e.versions.length > 1 ? "s" : ""}: ${e.versions.join(", ")})`);
  }
}

if (reviews.length) {
  console.log("\n◐ [review] duplicate-package — more than one copy, no module-scope context found");
  console.log("  Usually harmless. It matters when the package holds any other module-level singleton");
  console.log("  (a registry, a global store, an instanceof check).");
  for (const e of reviews) {
    console.log(`  ${e.name}  ${e.copies} copies  (version${e.versions.length > 1 ? "s" : ""}: ${e.versions.join(", ")})`);
  }
}

if (kitCopies.mismatches.length) {
  console.log("\n✖ [error] kit-framework-copy - a UI kit resolves the framework to a different copy than the app");
  console.log("  The kit's screens are type-checked and bundled against a framework the app does not run, and a");
  console.log("  context created by one copy is invisible to the other. Install the kit with the app's framework");
  console.log("  checkout (the same SIMPLIX_FRAMEWORK_PATH), then run the install again.");
  for (const m of kitCopies.mismatches) {
    console.log(`  ${m.kit}  (${m.kitDir})`);
    console.log(`    ${m.package}  app: ${m.app}`);
    console.log(`    ${" ".repeat(m.package.length)}  kit: ${m.resolved}`);
  }
}
if (kitCopies.kits.length === 0) {
  console.log(`ℹ no ${KIT_SCOPE}/* package resolves from the app, so no kit's framework copy was compared.`);
} else {
  console.log(
    `ℹ kit framework copies: ${kitCopies.compared} compared across ${kitCopies.kits.length} kit package(s), ` +
      `${kitCopies.mismatches.length} differing` +
      (kitCopies.skipped.length ? `; skipped: ${kitCopies.skipped.join(", ")}` : "") +
      ".",
  );
}

const total = [...byName.values()].filter((c) => c.length > 1).length;
console.log(
  `\n${byName.size} packages installed — ${total} with more than one copy, ${errors.length} context-owning and not deduped.`,
);
if (!failing && !reviews.length) console.log("✔ no duplicated packages.");
if (undecided) {
  console.log("\u2716 the findings above were judged against a dedupe list this audit could not read - not decided.");
}
process.exit(undecided && !warnOnly ? 2 : failing && !warnOnly ? 1 : 0);
