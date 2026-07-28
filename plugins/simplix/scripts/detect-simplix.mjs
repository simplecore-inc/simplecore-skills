#!/usr/bin/env node
/**
 * SimpliX stack detector — decides whether a directory tree holds a SimpliX
 * Spring Boot backend, a simplix-react frontend, or both, and where.
 *
 * Detection is marker-based and cheap: it reads directory entries down to a
 * bounded depth, skipping dependency and build output directories, and opens
 * only the few manifest files a marker points at. Nothing is scanned
 * recursively through sources, and a directory that matches is never
 * descended into — the subproject root is the answer, not its modules.
 *
 * Usage:
 *   node "${CLAUDE_PLUGIN_ROOT}/scripts/detect-simplix.mjs"          # human-readable
 *   node "${CLAUDE_PLUGIN_ROOT}/scripts/detect-simplix.mjs" --json   # machine-readable
 *   node "${CLAUDE_PLUGIN_ROOT}/scripts/detect-simplix.mjs" --root=<dir>
 *
 * Exit codes: 0 = at least one SimpliX subproject found, 1 = none found.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SKIP_DIRS = new Set([
  "node_modules", "dist", "build", "out", "target", "coverage", "vendor",
  "generated", "tmp", "temp", "logs", "uploads", "data", "env",
]);

// How far below the root a subproject may sit. Depth 2 covers the common
// monorepo shapes (<repo>/<subproject> and <repo>/apps/<subproject>) without
// walking whole source trees.
const MAX_DEPTH = 2;

const FRONTEND_CONFIGS = [
  "simplix.config.ts", "simplix.config.mts", "simplix.config.js", "simplix.config.mjs",
];

const GRADLE_FILES = [
  "settings.gradle", "settings.gradle.kts", "build.gradle", "build.gradle.kts", "gradle.properties",
];

// The framework's own npm scope. A workspace publishing under it IS
// simplix-react, so the consumer handbooks do not apply there.
const FRAMEWORK_SCOPE = "@simplix-react/";

function readIfPresent(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

function readJson(file) {
  const raw = readIfPresent(file);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function subdirs(dir) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith(".") && !SKIP_DIRS.has(e.name))
      .map((e) => path.join(dir, e.name));
  } catch {
    return [];
  }
}

/** Backend markers, strongest first. Empty when the directory is not one. */
function backendMarkers(dir) {
  const found = [];

  if (fs.existsSync(path.join(dir, ".simplix", "entity")) || fs.existsSync(path.join(dir, ".simplix", "templates"))) {
    found.push(".simplix/ generator directory");
  }

  const settings = GRADLE_FILES.slice(0, 2).find((n) => fs.existsSync(path.join(dir, n)));
  if (settings) {
    // Only a Gradle ROOT (one that carries settings.gradle) counts, so the
    // submodules below it are never reported as separate subprojects.
    const declaresSimplix = GRADLE_FILES.some((n) => /simplix/i.test(readIfPresent(path.join(dir, n)) ?? ""));
    if (declaresSimplix) found.push(`${settings} declares a simplix dependency`);
  }

  return found;
}

/** Frontend markers, strongest first. Empty when the directory is not one. */
function frontendMarkers(dir) {
  const found = [];

  const config = FRONTEND_CONFIGS.find((name) => fs.existsSync(path.join(dir, name)));
  if (config) found.push(config);

  const pkg = readJson(path.join(dir, "package.json"));
  if (pkg && !String(pkg.name ?? "").startsWith(FRAMEWORK_SCOPE)) {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
    if (Object.keys(deps).some((d) => d.startsWith(FRAMEWORK_SCOPE))) {
      found.push("package.json depends on @simplix-react/*");
    }
  }

  return found;
}

/** True when the tree IS simplix-react rather than a project consuming it. */
function isFrameworkRepo(root) {
  for (const dir of [root, ...subdirs(root)]) {
    for (const child of subdirs(dir)) {
      const pkg = readJson(path.join(child, "package.json"));
      if (pkg && String(pkg.name ?? "").startsWith(FRAMEWORK_SCOPE)) return true;
    }
  }
  return false;
}

/** Walk root and its subdirectories to MAX_DEPTH, stopping at each match. */
function detect(root) {
  const results = [];

  const visit = (dir, depth) => {
    const backend = backendMarkers(dir);
    const frontend = frontendMarkers(dir);

    // A directory that matched both is reported as two entries — a repository
    // can hold one subproject that is genuinely both, but keeping the kinds
    // separate reads more honestly than merging them.
    if (backend.length) results.push({ kind: "backend", dir, markers: backend });
    if (frontend.length) results.push({ kind: "frontend", dir, markers: frontend });

    // A matched directory is the subproject root; its modules are not separate
    // subprojects, so stop here.
    if (backend.length || frontend.length) return;

    if (depth >= MAX_DEPTH) return;
    for (const child of subdirs(dir)) visit(child, depth + 1);
  };

  visit(root, 0);
  return results;
}

/** The first CLAUDE.md/AGENTS.md at or under root that already routes to the skills. */
function routingDocument(root, matchedDirs) {
  const candidates = new Set();
  for (const dir of [root, ...matchedDirs]) {
    candidates.add(path.join(dir, "CLAUDE.md"));
    candidates.add(path.join(dir, ".claude", "CLAUDE.md"));
    candidates.add(path.join(dir, "AGENTS.md"));
  }
  for (const file of candidates) {
    const content = readIfPresent(file);
    if (content && /simplix:(backend|frontend)/.test(content)) return file;
  }
  return null;
}

/**
 * Analyze a directory tree. Returns
 * `{ root, frameworkRepo, matches: [{kind, dir, markers}], skills, routedBy }`
 * with every `dir` relative to `root`.
 */
export function analyze(root) {
  const resolved = path.resolve(root);
  const frameworkRepo = isFrameworkRepo(resolved);
  const matches = frameworkRepo ? [] : detect(resolved);
  const routing = matches.length
    ? routingDocument(resolved, [...new Set(matches.map((m) => m.dir))])
    : null;

  const skills = [...new Set(matches.map((m) => `simplix:${m.kind}`))];
  if (skills.includes("simplix:frontend")) skills.push("simplix:frontend-e2e");

  return {
    root: resolved,
    frameworkRepo,
    matches: matches.map((m) => ({ ...m, dir: path.relative(resolved, m.dir) || "." })),
    skills,
    routedBy: routing ? path.relative(resolved, routing) : null,
  };
}

function main() {
  const root = process.argv.find((a) => a.startsWith("--root="))?.slice("--root=".length) ?? process.cwd();
  const report = analyze(root);

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else if (report.frameworkRepo) {
    console.log(
      `${report.root} is the simplix-react framework itself, not a project using it — ` +
        "the simplix handbooks describe consumer conventions and do not apply here.",
    );
  } else if (!report.matches.length) {
    console.log(`No SimpliX subproject found under ${report.root}.`);
  } else {
    console.log(`SimpliX subprojects under ${report.root}:`);
    for (const m of report.matches) {
      console.log(`  ${m.kind.padEnd(8)} ${m.dir.padEnd(28)} ${m.markers.join("; ")}`);
    }
    console.log(`\nSkills that apply: ${report.skills.join(", ")}`);
    console.log(
      report.routedBy
        ? `Routed from: ${report.routedBy}`
        : "No CLAUDE.md routes to these skills yet — run /simplix:init to add the routing block.",
    );
  }

  process.exit(report.matches.length ? 0 : 1);
}

// Compare through realpath: a plugin linked into ~/.claude/skills resolves
// import.meta.url to the working tree while argv[1] keeps the link path, and a
// naive comparison would silently skip main().
function isMain() {
  if (!process.argv[1]) return false;
  try {
    return import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
}

if (isMain()) main();
