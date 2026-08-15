#!/usr/bin/env node
/**
 * SimpleCORE detector — decides which of this plugin's skills bind to a directory tree, and
 * which of the wiring each one needs is already in place.
 *
 * The skills carry discipline; the project carries the contents. Between the two sits wiring
 * the user has no reason to know about: a pointer in an instruction file, a board folder's
 * reading contract, a glossary, the config that says how the board reaches code. Without it a
 * session that starts anywhere in the repository never learns any of this exists. This script is what lets a
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

// The board contract this skill currently writes. A board on a lower contract needs migrating.
// Kept here as the "what the skill expects now" side; the kit copied into a project carries the
// "what this board is" side in its own partials.mjs. Two values by necessity, not duplication.
//
// **A board with no stamp is not the same thing as a board with no built HTML.** The first is
// genuinely contract 1 — stamping did not exist when it was made. The second is a kit-built board
// that has not been released yet, which is most of a board's life, and its contract is whatever
// its kit writes. Collapsing the two told every board still being drawn to migrate away from the
// contract it was already on.
//   3  the kit lives in the skill and the board holds only its own content: a declared pattern
//      supplies the components, the shells and the styles, and the board's own `tools/` is gone
//
// What each contract changed, and the steps to cross it, are the kit's `core/migrations.mjs`.
// This number only has to say WHICH contract a board is on.
const BOARD_CONTRACT = 3;
const CONTRACT_META = /<meta\s+name=["']wireframe-board-contract["']\s+content=["'](\d+)["']/i;
const KIT_CONTRACT_DECL = /BOARD_CONTRACT\s*=\s*(\d+)/;
const KIT_SOURCE_BYTES = 16 * 1024;

const PARITY_CONFIG = path.join(".claude", "board-parity-walk.json");
const BUILD_CONFIG = path.join(".claude", "board-to-app.json");
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
 * Two shapes count. A kit-built board is a directory holding `wf.mjs` (or, before contract 3,
 * `build.mjs`) beside
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
  // `undefined` and `null` mean different things here and the difference is the whole point:
  // `undefined` no released board exists yet · `null` one exists and carries no stamp, which is a
  // genuine contract-1 board. Returning one value for both is what made a board mid-authoring
  // indistinguishable from a board authored before stamping existed.
  const stampIn = (dir) => {
    let released = false;
    for (const entry of entries(dir)) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".html")) continue;
      if (entry.name.startsWith("_")) continue; // _proof / _catalog are byproducts, not the board
      released = true;
      const head = readIfPresent(path.join(dir, entry.name), HTML_HEAD_BYTES) ?? "";
      const m = CONTRACT_META.exec(head);
      if (m) return Number(m[1]);
    }
    return released ? null : undefined;
  };

  /**
   * The contract a kit-built board's own build writes, read from the kit's sources.
   *
   * @remarks
   * The stamp in the built board is the better answer and is tried first. But `board.html` appears
   * only once the build's coverage gate is satisfied — every required cluster drawn — which is late
   * in a board's life, and `_proof.html` is a byproduct {@link stampIn} deliberately skips. So a
   * board that is halfway through being drawn has no stamped artifact at all, and reading its
   * absence as "unstamped, therefore contract 1" is wrong in the one direction that costs work: it
   * proposes a migration away from the contract the board is already on.
   */
  const kitContractIn = (dir) => {
    // Contract 3 moved the kit out of the board, so the number is DECLARED there instead of
    // being read out of a copied source file — which is the better answer anyway: it says what
    // the board has been brought up to rather than what happens to be sitting beside it.
    const cfg = readIfPresent(path.join(dir, "board.config.mjs"), KIT_SOURCE_BYTES) ?? "";
    const declared = /\bcontract:\s*(\d+)/.exec(cfg);
    if (declared) return Number(declared[1]);
    // Contract 2 and earlier: the board carried its own `partials.mjs`.
    const src = readIfPresent(path.join(dir, "src", "partials.mjs"), KIT_SOURCE_BYTES) ?? "";
    const m = KIT_CONTRACT_DECL.exec(src);
    return m ? Number(m[1]) : null;
  };

  const visit = (dir, depth) => {
    // A kit-built board is a directory holding `src/manifest.mjs` beside the thing that builds
    // it — which is `wf.mjs` from contract 3 on, and was `build.mjs` before. Both are looked for,
    // because a board that has not been migrated yet still has to be FOUND in order to be told
    // that it needs migrating.
    const buildsHere = fs.existsSync(path.join(dir, "wf.mjs")) || fs.existsSync(path.join(dir, "build.mjs"));
    if (buildsHere && fs.existsSync(path.join(dir, "src", "manifest.mjs"))) {
      const stamped = stampIn(dir);
      // A released board answers for itself, whatever the sources now say — it is the artifact
      // people open. The kit stands in only when there is nothing released to ask.
      const fromKit = stamped === undefined ? kitContractIn(dir) : null;
      return {
        dir,
        kind: "built",
        file: path.join(dir, "src", "manifest.mjs"),
        contract: stamped ?? fromKit,
        // Where the answer came from, because the three cases are told apart nowhere else:
        // `built` a released board says so itself · `kit` no release yet, so the kit's own
        // declaration stands in · `null` neither, which is a genuine contract-1 board.
        contractFrom: typeof stamped === "number" ? "built" : fromKit != null ? "kit" : null,
      };
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
          // A hand-written board has no kit to fall back on: the file in hand IS the board, so an
          // unstamped one is genuinely contract 1.
          contractFrom: m ? "built" : null,
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

/**
 * The chapter-build config and whether the two files a session resumes from exist.
 *
 * @remarks
 * A board reaches code one of two ways, and they are alternatives rather than stages: a build in
 * dependency order, chapter by chapter, or a walk over the frames of a running app. Only the two
 * files a session needs to answer 「what is open」 are resolved here — the chapter directory and
 * the state ledger. Every other declared path is the build skill's own gate to check
 * (`bta.mjs doctor`), and duplicating that here would put the same rule in two places.
 */
function findBuild(root) {
  const configFile = path.join(root, BUILD_CONFIG);
  const raw = readIfPresent(configFile);
  if (raw === null) return null;

  let config;
  try {
    config = JSON.parse(raw);
  } catch {
    return { config: BUILD_CONFIG, valid: false, chapterDir: null, stateLedger: null };
  }

  const resolve = (key) =>
    typeof config[key] === "string" && fs.existsSync(path.join(root, config[key])) ? config[key] : null;

  return {
    config: BUILD_CONFIG,
    valid: true,
    chapterDir: resolve("chapterDir"),
    stateLedger: resolve("stateLedger"),
    declaredChapterDir: typeof config.chapterDir === "string" ? config.chapterDir : null,
    declaredStateLedger: typeof config.stateLedger === "string" ? config.stateLedger : null,
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
    for (const skill of ["wireframe-boards", "board-to-app", "board-parity-walk", "korean-docs", "svg-diagrams"]) {
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
  if (!content) return { file, present: false, card: false };
  // `present` is the routing — a line that names the skill or its style file. `card` is the
  // habits block itself. The two are different things and the second is the one that works:
  // a pointer survives a long session while the file it points at does not, so a global
  // instruction can route correctly and still produce the register it forbids. The marker is
  // written by the block; the heading is accepted too, for a file that was edited by hand.
  return {
    file,
    present: /korean-docs|response-style\.md/.test(content),
    card: /simplecore:korean-habits|#### The Korean habits/.test(content),
  };
}

/**
 * Analyze a directory tree.
 *
 * @returns `{root, board, build, parityWalk, glossary, korean, routedBy, globalKorean, skills, missing, wired}`
 * with every path relative to `root`. `missing` holds one plain-language line per piece of
 * wiring that is absent, which is what a session reads out to the user before offering to fix it.
 */
export function analyze(root) {
  const resolved = path.resolve(root);
  const board = findBoard(resolved);
  const parityWalk = findParityWalk(resolved);
  const build = findBuild(resolved);
  const glossary = findGlossary(resolved);
  const korean = writesKorean(resolved, glossary);
  const routedBy = routing(resolved, board ? [board.dir] : []);
  const globalKorean = globalKoreanInstruction();

  const rel = (p) => (p ? path.relative(resolved, p) || "." : null);

  // Both ways of reaching code from a board bind ONLY where a board exists. Config alone is not
  // enough: without a board there is nothing to build or walk against, and reporting the skill as
  // applicable would send a session looking for frames that were never drawn.
  const skills = [];
  if (board) skills.push("simplecore:wireframe-boards");
  if (board && build) skills.push("simplecore:board-to-app");
  if (board && parityWalk) skills.push("simplecore:board-parity-walk");
  if (korean) skills.push("simplecore:korean-docs");

  const boardContract = board
    ? {
        agentsMd: fs.existsSync(path.join(board.dir, "AGENTS.md")),
        folderClaudeMd: fs.existsSync(path.join(board.dir, "CLAUDE.md")),
      }
    : null;

  // A board that answers neither way is an original-contract board: stamping did not exist when it
  // was made, and it has no kit whose sources could say otherwise.
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
  // A board reaches code one of two ways, and a project picks one. Naming only the walk here told
  // a project that had picked the other that it was missing wiring, and pointed a fresh session at
  // a skill that project had deliberately retired.
  if (board && !parityWalk && !build) {
    missing.push(
      "the board is wired to nothing that builds it, so neither the order its frames are built in nor which of them still disagree with the code is written anywhere — `simplecore:board-to-app` builds it chapter by chapter in dependency order (a chapter set and `" +
        BUILD_CONFIG +
        "`), and `/simplecore:parity-walk-init` walks it frame by frame against a running app",
    );
  }
  if (board && parityWalk && build) {
    missing.push(
      `both \`${BUILD_CONFIG}\` and \`${PARITY_CONFIG}\` are declared — a project runs one of the two, and with both in place two documents claim to say what is left. Delete the config of the one this project is leaving`,
    );
  }
  if (!board && build) {
    missing.push(
      `a chapter build is configured (\`${BUILD_CONFIG}\`) but this project has no wireframe board — the build renders a board's frames as screens, so it has nothing to build. Draw the board first, or remove the config`,
    );
  }
  if (build && !build.valid) {
    missing.push(`\`${BUILD_CONFIG}\` is not valid JSON, so nothing routes to the build and its gates are off`);
  }
  if (build && build.valid && (!build.chapterDir || !build.stateLedger)) {
    const absent = [
      !build.chapterDir ? `the chapter set (\`${build.declaredChapterDir ?? "chapterDir not declared"}\`)` : null,
      !build.stateLedger ? `the state ledger (\`${build.declaredStateLedger ?? "stateLedger not declared"}\`)` : null,
    ].filter(Boolean);
    missing.push(
      `${absent.join(" and ")} named by \`${BUILD_CONFIG}\` ${absent.length > 1 ? "do" : "does"} not exist, so a session cannot tell which chapter is open — \`bta.mjs doctor\` reports every declared path`,
    );
  }
  // Only asked for where the build actually applies, on the same reasoning as the walk below.
  if (board && build && !routedBy["board-to-app"]) {
    missing.push(
      "no instruction file points at the chapter build, so a session that starts elsewhere builds screens without it",
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
  } else if (korean && !globalKorean.card) {
    missing.push(
      "the global instruction file points at the Korean standard but does not carry the habits block, " +
        "so the rules are only in force while the file it points at is still in context",
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
          stamped: board.contractFrom === "built",
          contractFrom: board.contractFrom,
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
    build,
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
      const stamp = {
        built: `contract ${report.board.contract}`,
        kit: `contract ${report.board.contract} (kit says so — no released board.html yet)`,
      }[report.board.contractFrom] ?? `contract ${report.board.contract} (unstamped)`;
      console.log(`\nBoard: ${report.board.dir} (${report.board.kind}, ${stamp}) — read ${report.board.file}`);
      if (report.needsMigration) {
        console.log(`  ⚠ needs migration to contract ${report.boardContractExpected} → /simplecore:board-migrate`);
      }
    }
    if (report.build) {
      console.log(
        `Chapter build: ${report.build.chapterDir ?? "chapters MISSING"} / ${report.build.stateLedger ?? "ledger MISSING"}`,
      );
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
