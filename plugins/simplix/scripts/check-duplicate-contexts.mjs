#!/usr/bin/env node
/**
 * Duplicate React-context package audit.
 *
 * A package that calls `createContext` at module scope has one context object per physical
 * copy of that package. When pnpm answers two importers with two copies — an app declaring
 * `simplix-react` and a module declaring `@simplix-react/ui`, say — the provider one side
 * renders is not the context the other side reads. Nothing throws. The provider stays empty,
 * the consumer falls back to its default, and the screen renders with a piece silently
 * missing: a page with no title and no create button, a query client that "is not set", a
 * translation that never arrives.
 *
 * Vite's `resolve.dedupe` is the fix, so this audit reports a duplicated context-owning
 * package that the dedupe list does not name. The list is read from the project rather than
 * assumed, and the packages are judged by what their code actually does, so nothing here is
 * specific to one repository.
 *
 * Usage:
 *   node scripts/check-duplicate-contexts.mjs             # audits the working directory
 *   node scripts/check-duplicate-contexts.mjs --root=<dir>
 *   node scripts/check-duplicate-contexts.mjs --dedupe=config/vite/dedupe.js
 *   node scripts/check-duplicate-contexts.mjs --json
 *   node scripts/check-duplicate-contexts.mjs --warn-only   # report, never fail
 *
 * Exit code 1 when a duplicated context-owning package is missing from the dedupe list,
 * unless --warn-only is passed. The post-switch check uses --warn-only: a link-profile switch
 * should say what it changed without failing over a finding in a toolchain it does not own.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const rootArg = process.argv.slice(2).find((a) => a.startsWith("--root="))?.slice(7);
// The audit reads the project it is pointed at, never the directory it is installed in, so one
// copy serves a repository's own scripts/ and a shared toolchain alike.
const ROOT = path.resolve(rootArg ?? process.cwd());
const PNPM_DIR = path.join(ROOT, "node_modules", ".pnpm");

/** Where a project keeps its Vite dedupe list, in the order they are tried. */
const DEDUPE_CANDIDATES = ["config/vite/dedupe.js", "config/vite/dedupe.mjs", "vite.dedupe.js"];

/** Files worth reading when deciding whether a package creates a context. */
const CODE_FILE = /\.(js|mjs|cjs|jsx|ts|tsx)$/;

/** Directories inside a package that never hold its shipped code. */
const SKIP_DIRS = new Set(["node_modules", "__tests__", "test", "tests", "coverage"]);

/** Read budget per package, so a large dist cannot stall the audit. */
const MAX_BYTES_PER_PACKAGE = 8 * 1024 * 1024;

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const warnOnly = args.includes("--warn-only");
const dedupeArg = args.find((a) => a.startsWith("--dedupe="))?.slice(9);

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
function collectDirectDependencies() {
  const names = new Set();
  const manifests = [path.join(ROOT, "package.json")];

  const workspaceFile = path.join(ROOT, "pnpm-workspace.yaml");
  let roots = ["packages", "modules", "apps", "config"];
  if (fs.existsSync(workspaceFile)) {
    const declared = fs
      .readFileSync(workspaceFile, "utf8")
      .split("\n")
      .map((line) => /^\s*-\s*["']?([^"'\s]+)["']?\s*$/.exec(line)?.[1])
      .filter(Boolean)
      .filter((glob) => glob.endsWith("/*"))
      .map((glob) => glob.slice(0, -2));
    if (declared.length) roots = declared;
  }

  for (const root of roots) {
    let entries;
    try {
      entries = fs.readdirSync(path.join(ROOT, root), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const manifest = path.join(ROOT, root, e.name, "package.json");
      if (fs.existsSync(manifest)) manifests.push(manifest);
    }
  }

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

/** The dedupe list the project's bundler config declares, and where it was found. */
async function loadDedupe() {
  const candidates = dedupeArg ? [dedupeArg] : DEDUPE_CANDIDATES;
  for (const rel of candidates) {
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
  return { list: [], source: null };
}

const byName = collectCopies();
if (!byName) {
  console.error("✖ node_modules/.pnpm not found — run the audit from a pnpm workspace after install.");
  process.exit(1);
}

const { list: dedupe, source: dedupeSource, error: dedupeError } = await loadDedupe();
const deduped = new Set(dedupe);

const directDeps = collectDirectDependencies();

const errors = [];
const reviews = [];

for (const [name, copies] of [...byName].sort(([a], [b]) => a.localeCompare(b))) {
  // Two copies of DIFFERENT versions is an ordinary resolution — a dependency asked for a
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

if (asJson) {
  console.log(JSON.stringify({ dedupeSource, dedupe, errors, reviews }, null, 2));
  process.exit(errors.length > 0 && !warnOnly ? 1 : 0);
}

if (dedupeError) {
  console.log(`⚠ dedupe list at ${dedupeSource} could not be read — treating it as empty (${dedupeError})`);
} else if (dedupeSource) {
  console.log(`dedupe list: ${dedupeSource} (${dedupe.length} entries)`);
} else {
  console.log("⚠ no dedupe list found — every duplicated context package below is reported");
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

const total = [...byName.values()].filter((c) => c.length > 1).length;
console.log(
  `\n${byName.size} packages installed — ${total} with more than one copy, ${errors.length} context-owning and not deduped.`,
);
if (!errors.length && !reviews.length) console.log("✔ no duplicated packages.");
process.exit(errors.length > 0 && !warnOnly ? 1 : 0);
