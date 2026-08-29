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

/**
 * Which code generator a frontend subproject runs, read from its `simplix.config.ts`.
 *
 * `meta`  — the config declares an `openapi[].meta` block. The project generates from SimpliX
 *           Meta: `simplix meta`, output in `src/generated-meta/`.
 * `orval` — it declares an `openapi` entry with a `spec` and no `meta` block. `simplix openapi`,
 *           output in `src/generated/`.
 * `both`  — it declares both, which is what a migration in progress looks like.
 * `none`  — no `openapi` entry at all; the domains are hand-written.
 *
 * Read as text rather than imported: the config is TypeScript and importing it would need the
 * project's own resolution. The two markers are unambiguous enough for a mode, and every command
 * this decides is one a person can check.
 */
function codegenMode(dir) {
  const config = FRONTEND_CONFIGS.map((name) => path.join(dir, name)).find((f) =>
    fs.existsSync(f),
  );
  if (!config) return "none";
  const raw = readIfPresent(config);
  if (!raw) return "none";

  const withoutComments = raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

  const hasOpenapi = /\bopenapi\s*:\s*\[/.test(withoutComments);
  if (!hasOpenapi) return "none";

  const hasMeta = /\bmeta\s*:\s*\{/.test(withoutComments);
  const hasSpec = /\bspec\s*:\s*["'`]/.test(withoutComments);

  if (hasMeta && hasSpec) return "both";
  if (hasMeta) return "meta";
  return "orval";
}

/**
 * What is left of the OpenAPI half in a project that generates from SimpliX Meta.
 *
 * Each of these keeps the old path alive after the switch, and each one fails quietly: a package
 * that still declares `orval` reinstalls it on the next lockfile change, a `src/generated/`
 * directory goes on being imported by whatever has not been repointed, and a `codegen` script
 * naming `simplix openapi` regenerates the half the project meant to leave.
 *
 * Reported, never acted on. Whether to finish the migration is the project's decision.
 */
function orvalLeftovers(dir) {
  const found = [];

  const packages = path.join(dir, "packages");
  for (const pkgDir of subdirs(packages)) {
    const name = path.basename(pkgDir);
    if (fs.existsSync(path.join(pkgDir, "src", "generated"))) {
      found.push(`packages/${name}/src/generated/`);
    }
    const pkg = readJson(path.join(pkgDir, "package.json"));
    if (!pkg) continue;
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps.orval) found.push(`packages/${name}/package.json declares orval`);
    const codegen = pkg.scripts?.codegen;
    if (typeof codegen === "string" && codegen.includes("simplix openapi")) {
      found.push(`packages/${name} codegen runs \`simplix openapi\``);
    }
  }

  const root = readJson(path.join(dir, "package.json"));
  const rootDeps = { ...root?.dependencies, ...root?.devDependencies };
  if (rootDeps.orval) found.push("package.json declares orval");

  const workspace = readIfPresent(path.join(dir, "pnpm-workspace.yaml"));
  if (workspace && /^\s*orval\s*:/m.test(workspace)) {
    found.push("pnpm-workspace.yaml catalogues orval");
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
 * Which gates a subproject has armed, read from its own `.claude/simplix.json`.
 *
 * @remarks
 * A routing block in an instruction file tells Claude to invoke the skill; these tell the
 * plugin's hooks to hold it to that. Reporting them separately is what lets a session say
 * which half is missing instead of assuming the project is wired because one half is.
 */
function gatesOf(dir) {
  const file = path.join(dir, ".claude", "simplix.json");
  const raw = readIfPresent(file);
  if (!raw) return { skillGate: false, e2eGate: false };
  try {
    const config = JSON.parse(raw);
    return {
      skillGate: Array.isArray(config.skillGate?.skills) && config.skillGate.skills.length > 0,
      e2eGate: Boolean(config.e2eGate?.skill),
    };
  } catch {
    return { skillGate: false, e2eGate: false };
  }
}

/**
 * Analyze a directory tree. Returns
 * `{ root, frameworkRepo, matches: [{kind, dir, markers, skillGate, e2eGate}], skills, routedBy, wired }`
 * with every `dir` relative to `root`. `wired` is true when the routing document exists and
 * every subproject has armed the gates that apply to it.
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

  const reported = matches.map((m) => {
    const mode = m.kind === "frontend" ? codegenMode(m.dir) : undefined;
    return {
      ...m,
      dir: path.relative(resolved, m.dir) || ".",
      ...gatesOf(m.dir),
      ...(mode ? { codegen: mode } : {}),
      // Only where the project has switched: in the other modes the OpenAPI half is the point.
      ...(mode === "meta" ? { orvalLeftovers: orvalLeftovers(m.dir) } : {}),
    };
  });

  // The e2e gate is a frontend concern; a backend subproject is fully wired without it.
  const wired =
    Boolean(routing) &&
    reported.every((m) => m.skillGate && (m.kind !== "frontend" || m.e2eGate));

  return {
    root: resolved,
    frameworkRepo,
    matches: reported,
    skills,
    routedBy: routing ? path.relative(resolved, routing) : null,
    wired,
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
      const mode = m.codegen ? `  [codegen: ${m.codegen}]` : "";
      console.log(`  ${m.kind.padEnd(8)} ${m.dir.padEnd(28)} ${m.markers.join("; ")}${mode}`);
    }

    for (const m of report.matches) {
      if (!m.orvalLeftovers?.length) continue;
      console.log(
        `\n${m.dir} generates from SimpliX Meta and still carries the OpenAPI half in ` +
          `${m.orvalLeftovers.length} place(s):`,
      );
      for (const one of m.orvalLeftovers) console.log(`  · ${one}`);
      console.log(
        "  Each one keeps the old path alive without saying so. Finishing the move is the " +
          "project's call — nothing here requires it.",
      );
    }
    console.log(`\nSkills that apply: ${report.skills.join(", ")}`);
    for (const m of report.matches) {
      const gates = [
        m.skillGate ? "skill gate armed" : "skill gate OFF",
        m.kind === "frontend" ? (m.e2eGate ? "e2e gate armed" : "e2e gate OFF") : null,
      ].filter(Boolean);
      console.log(`  ${m.dir.padEnd(28)} ${gates.join(", ")}`);
    }
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
