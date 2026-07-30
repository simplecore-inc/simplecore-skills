#!/usr/bin/env node
/**
 * SimpleCORE detector — decides which of this plugin's skills bind to a directory tree, and
 * which of the wiring each one needs is already in place.
 *
 * The skills carry discipline; the project carries the contents. Between the two sits wiring
 * the user has no reason to know about: a pointer in an instruction file, a board folder's
 * reading contract, a glossary, the parity-walk config. Without it a session that starts
 * anywhere in the repository never learns any of this exists. This script is what lets a
 * session say which half is missing instead of assuming.
 *
 * Detection is marker-based, so nothing has to be configured before it works. Every marker is
 * a structural signature of an artifact these skills produce (a board's own class vocabulary,
 * the build kit's file pair, a glossary at one of the two documented locations) — never a
 * directory name that happens to be this or that repository's habit.
 *
 * Usage:
 *   node "${CLAUDE_PLUGIN_ROOT}/scripts/detect-simplecore.mjs"          # human-readable
 *   node "${CLAUDE_PLUGIN_ROOT}/scripts/detect-simplecore.mjs" --json   # machine-readable
 *   node "${CLAUDE_PLUGIN_ROOT}/scripts/detect-simplecore.mjs" --root=<dir>
 *
 * Exit codes: 0 = at least one skill binds here, 1 = none.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SKIP_DIRS = new Set([
  "node_modules", "dist", "build", "out", "target", "coverage", "vendor",
  "tmp", "temp", "logs", "uploads", ".git", ".idea", ".vscode",
]);

// How far below the root a board may sit. Boards live with the planning documents, which in
// practice is one or two directories down (`_plans/board/`, `docs/wireframes/`).
const MAX_DEPTH = 3;

// Reading every HTML file in a repository would be the expensive way to find one board, so the
// scan is bounded on both axes: how many files it opens, and how much of each it reads. A
// board's signature sits in its head — the reading contract and the first frame labels.
const MAX_HTML_FILES = 40;
const HTML_HEAD_BYTES = 64 * 1024;

// The class vocabulary every board of this kind is authored in. Two of them together, because
// either alone is a plausible coincidence in unrelated markup.
const BOARD_SIGNATURES = ["frame-label", "readme"];

// The board contract this skill currently writes. A board stamped lower than this — or not
// stamped at all, which is every board authored before stamping existed — needs migrating.
// Kept here as the "what the skill expects now" side; the kit copied into a project carries the
// "what this board is" side in its own partials.mjs. Two values by necessity, not duplication.
const BOARD_CONTRACT = 2;
const CONTRACT_META = /<meta\s+name=["']wireframe-board-contract["']\s+content=["'](\d+)["']/i;

const PARITY_CONFIG = path.join(".claude", "board-parity-walk.json");
const GLOSSARY_LOCATIONS = [path.join(".claude", "GLOSSARY.md"), "GLOSSARY.md"];
const INSTRUCTION_FILES = ["CLAUDE.md", path.join(".claude", "CLAUDE.md"), "AGENTS.md"];

const HANGUL = /[가-힣]/;

function readIfPresent(file, maxBytes = 0) {
  try {
    if (maxBytes <= 0) return fs.readFileSync(file, "utf8");
    const fd = fs.openSync(file, "r");
    try {
      const buffer = Buffer.alloc(maxBytes);
      const read = fs.readSync(fd, buffer, 0, maxBytes, 0);
      return buffer.subarray(0, read).toString("utf8");
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return null;
  }
}

function entries(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function subdirs(dir) {
  return entries(dir)
    .filter((e) => e.isDirectory() && !e.name.startsWith(".") && !SKIP_DIRS.has(e.name))
    .map((e) => path.join(dir, e.name));
}

/**
 * Find the wireframe board in a tree, preferring the built kit over a single file.
 *
 * @remarks
 * Two shapes count. A kit-built board is a directory holding the kit's own `build.mjs` beside
 * `src/manifest.mjs` — that pair is the kit's signature and needs no file read. A hand-written
 * board is one HTML file carrying the board class vocabulary in its head.
 *
 * @returns `{dir, kind, file}` for the first board found, or null.
 */
function findBoard(root) {
  let htmlBudget = MAX_HTML_FILES;

  /**
   * The contract stamp of whichever built HTML sits in a board directory.
   *
   * @remarks
   * Read from the built board rather than the sources, because that is the artifact a reader
   * actually opens, and because a kit-built board's stamp comes from the kit that built it —
   * which is the version the board genuinely conforms to, whatever the sources now say.
   */
  const stampIn = (dir) => {
    for (const entry of entries(dir)) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".html")) continue;
      if (entry.name.startsWith("_")) continue; // _proof / _catalog are byproducts, not the board
      const head = readIfPresent(path.join(dir, entry.name), HTML_HEAD_BYTES) ?? "";
      const m = CONTRACT_META.exec(head);
      if (m) return Number(m[1]);
    }
    return null;
  };

  const visit = (dir, depth) => {
    if (fs.existsSync(path.join(dir, "build.mjs")) && fs.existsSync(path.join(dir, "src", "manifest.mjs"))) {
      return { dir, kind: "built", file: path.join(dir, "src", "manifest.mjs"), contract: stampIn(dir) };
    }

    for (const entry of entries(dir)) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".html")) continue;
      if (htmlBudget <= 0) break;
      htmlBudget -= 1;
      const head = readIfPresent(path.join(dir, entry.name), HTML_HEAD_BYTES) ?? "";
      if (BOARD_SIGNATURES.every((sig) => head.includes(sig))) {
        const m = CONTRACT_META.exec(head);
        return {
          dir,
          kind: "single-file",
          file: path.join(dir, entry.name),
          contract: m ? Number(m[1]) : null,
        };
      }
    }

    if (depth >= MAX_DEPTH) return null;
    for (const child of subdirs(dir)) {
      const found = visit(child, depth + 1);
      if (found) return found;
    }
    return null;
  };

  return visit(root, 0);
}

/** The parity-walk config and whether the two documents it names exist. */
function findParityWalk(root) {
  const configFile = path.join(root, PARITY_CONFIG);
  const raw = readIfPresent(configFile);
  if (raw === null) return null;

  let config;
  try {
    config = JSON.parse(raw);
  } catch {
    return { config: PARITY_CONFIG, valid: false, parityList: null, handoverFile: null };
  }

  const resolve = (key) =>
    typeof config[key] === "string" && fs.existsSync(path.join(root, config[key])) ? config[key] : null;

  return {
    config: PARITY_CONFIG,
    valid: true,
    parityList: resolve("parityList"),
    handoverFile: resolve("handoverFile"),
    declaredParityList: typeof config.parityList === "string" ? config.parityList : null,
    declaredHandoverFile: typeof config.handoverFile === "string" ? config.handoverFile : null,
  };
}

/** The project glossary, at whichever of the two documented locations holds it. */
function findGlossary(root) {
  return GLOSSARY_LOCATIONS.find((rel) => fs.existsSync(path.join(root, rel))) ?? null;
}

/**
 * Whether this project's own documents are written in Korean.
 *
 * @remarks
 * A glossary is a declaration. Absent one, the signal is the writing itself: Hangul in the
 * instruction file or the README. Reading content rather than matching a path is what keeps
 * this true of any repository instead of only the ones that name things a certain way.
 */
function writesKorean(root, glossary) {
  if (glossary) return true;
  for (const rel of [...INSTRUCTION_FILES, "README.md"]) {
    const head = readIfPresent(path.join(root, rel), HTML_HEAD_BYTES);
    if (head && HANGUL.test(head)) return true;
  }
  return false;
}

/** Which skills an instruction file at or under root already routes to. */
function routing(root, extraDirs) {
  const routed = {};
  const dirs = [root, ...extraDirs];
  const candidates = new Set();
  for (const dir of dirs) for (const rel of INSTRUCTION_FILES) candidates.add(path.join(dir, rel));

  for (const file of candidates) {
    const content = readIfPresent(file);
    if (!content) continue;
    for (const skill of ["wireframe-boards", "board-parity-walk", "korean-docs", "svg-diagrams"]) {
      if (!routed[skill] && content.includes(`simplecore:${skill}`)) routed[skill] = file;
    }
  }
  return routed;
}

/**
 * Whether the user's global instruction file already carries the Korean style baseline.
 *
 * @remarks
 * The korean-docs skill governs every Korean answer, not only document tasks, so its trigger
 * has to survive a session that never mentions documents — which is what a line in the global
 * instruction file buys. Checked read-only, and absence is reported rather than acted on.
 */
function globalKoreanInstruction() {
  const file = path.join(os.homedir(), ".claude", "CLAUDE.md");
  const content = readIfPresent(file);
  if (!content) return { file, present: false };
  return { file, present: /korean-docs|response-style\.md/.test(content) };
}

/**
 * Analyze a directory tree.
 *
 * @returns `{root, board, parityWalk, glossary, korean, routedBy, globalKorean, skills, missing, wired}`
 * with every path relative to `root`. `missing` holds one plain-language line per piece of
 * wiring that is absent, which is what a session reads out to the user before offering to fix it.
 */
export function analyze(root) {
  const resolved = path.resolve(root);
  const board = findBoard(resolved);
  const parityWalk = findParityWalk(resolved);
  const glossary = findGlossary(resolved);
  const korean = writesKorean(resolved, glossary);
  const routedBy = routing(resolved, board ? [board.dir] : []);
  const globalKorean = globalKoreanInstruction();

  const rel = (p) => (p ? path.relative(resolved, p) || "." : null);

  // A board-parity walk reconciles code against a board, so it binds ONLY where a board exists.
  // Config alone is not enough: without a board there is nothing to walk, and reporting the
  // skill as applicable would send a session looking for frames that were never drawn.
  const skills = [];
  if (board) skills.push("simplecore:wireframe-boards");
  if (board && parityWalk) skills.push("simplecore:board-parity-walk");
  if (korean) skills.push("simplecore:korean-docs");

  const boardContract = board
    ? {
        agentsMd: fs.existsSync(path.join(board.dir, "AGENTS.md")),
        folderClaudeMd: fs.existsSync(path.join(board.dir, "CLAUDE.md")),
      }
    : null;

  // An unstamped board is an original-contract board: stamping did not exist when it was made.
  const boardOn = board ? (board.contract ?? 1) : null;
  const needsMigration = board !== null && boardOn < BOARD_CONTRACT;

  const missing = [];
  if (needsMigration) {
    missing.push(
      `the board at \`${rel(board.dir)}\` was built against board contract ${boardOn} and this skill now writes ${BOARD_CONTRACT} — its frame numbers are derived from position, so they change under anyone who writes one down, and its rows scroll sideways where frames hide past the edge. \`/simplecore:board-migrate\` walks the upgrade`,
    );
  }
  if (board && !routedBy["wireframe-boards"]) {
    missing.push(
      `no instruction file points at the board at \`${rel(board.dir)}\`, so a session that starts elsewhere writes UI without it`,
    );
  }
  if (board && board.kind === "built" && !(boardContract.agentsMd && boardContract.folderClaudeMd)) {
    missing.push(
      `the board folder has no reading contract, so the next agent opens the built HTML and floods its context`,
    );
  }
  if (board && !parityWalk) {
    missing.push(
      "the board has no parity walk wired, so reconciling its frames with the running app has nothing to resume from",
    );
  }
  if (!board && parityWalk) {
    missing.push(
      `a parity walk is configured (\`${PARITY_CONFIG}\`) but this project has no wireframe board — the walk reconciles code against a board's frames, so it has nothing to walk. Draw the board first, or remove the config`,
    );
  }
  if (parityWalk && !parityWalk.valid) {
    missing.push(`\`${PARITY_CONFIG}\` is not valid JSON, so the parity-walk write-time checks are off`);
  }
  if (parityWalk && parityWalk.valid && !parityWalk.parityList) {
    missing.push(
      `the parity list the config names (\`${parityWalk.declaredParityList}\`) does not exist, so there is nothing to walk from`,
    );
  }
  if (parityWalk && parityWalk.valid && !parityWalk.handoverFile) {
    missing.push(
      `the handover file the config names (\`${parityWalk.declaredHandoverFile}\`) does not exist, so each session re-derives what the last one learned`,
    );
  }
  // Only asked for where the walk actually applies: complaining that nothing routes to a walk
  // that cannot run is noise on top of the real problem.
  if (board && parityWalk && !routedBy["board-parity-walk"]) {
    missing.push("no instruction file points at the parity walk, so a session cannot find it to resume");
  }
  if (korean && !glossary) {
    missing.push(
      "there is no project glossary, so the same term is translated differently from one document to the next and the write-time audit stays off",
    );
  }
  if (korean && !globalKorean.present) {
    missing.push(
      "the global instruction file does not load the Korean style baseline, so ordinary answers are written without it",
    );
  }

  return {
    root: resolved,
    boardContractExpected: BOARD_CONTRACT,
    needsMigration,
    board: board
      ? {
          dir: rel(board.dir),
          kind: board.kind,
          file: rel(board.file),
          contract: boardOn,
          stamped: board.contract !== null,
          ...boardContract,
        }
      : null,
    parityWalk: parityWalk
      ? {
          ...parityWalk,
          parityList: parityWalk.parityList,
          handoverFile: parityWalk.handoverFile,
        }
      : null,
    glossary,
    korean,
    routedBy: Object.fromEntries(Object.entries(routedBy).map(([k, v]) => [k, rel(v)])),
    globalKorean,
    skills,
    missing,
    wired: skills.length > 0 && missing.length === 0,
  };
}

function main() {
  const root = process.argv.find((a) => a.startsWith("--root="))?.slice("--root=".length) ?? process.cwd();
  const report = analyze(root);

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else if (!report.skills.length) {
    console.log(`No simplecore skill binds to ${report.root} by its markers.`);
  } else {
    console.log(`simplecore skills that bind to ${report.root}:`);
    for (const skill of report.skills) {
      console.log(`  ${skill.padEnd(32)} routed from ${report.routedBy[skill.split(":")[1]] ?? "nothing yet"}`);
    }
    if (report.board) {
      const stamp = report.board.stamped
        ? `contract ${report.board.contract}`
        : `contract ${report.board.contract} (unstamped)`;
      console.log(`\nBoard: ${report.board.dir} (${report.board.kind}, ${stamp}) — read ${report.board.file}`);
      if (report.needsMigration) {
        console.log(`  ⚠ needs migration to contract ${report.boardContractExpected} → /simplecore:board-migrate`);
      }
    }
    if (report.parityWalk) {
      console.log(
        `Parity walk: ${report.parityWalk.parityList ?? "list MISSING"} / ${report.parityWalk.handoverFile ?? "handover MISSING"}`,
      );
    }
    if (report.glossary) console.log(`Glossary: ${report.glossary}`);
    if (report.missing.length) {
      console.log("\nMissing wiring:");
      for (const line of report.missing) console.log(`  ✖ ${line}`);
      console.log("\nRun /simplecore:init to write what is missing.");
    } else {
      console.log("\n✔ Fully wired.");
    }
  }

  process.exit(report.skills.length ? 0 : 1);
}

// Compare through realpath: a plugin linked into ~/.claude/skills resolves import.meta.url to
// the working tree while argv[1] keeps the link path, and a naive comparison would skip main().
function isMain() {
  if (!process.argv[1]) return false;
  try {
    return import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
}

if (isMain()) main();
