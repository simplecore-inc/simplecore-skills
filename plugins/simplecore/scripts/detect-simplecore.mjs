#!/usr/bin/env node
/**
 * SimpleCORE detector - decides which of this plugin's skills bind to a directory tree, and
 * which of the wiring each one needs is already in place.
 *
 * The skills carry discipline; the project carries the contents. Between the two sits wiring
 * the user has no reason to know about: a pointer in an instruction file, a glossary, the global
 * Korean habits block. Without it a session that starts anywhere in the repository never learns
 * any of this exists. This script is what lets a session say which half is missing instead of
 * assuming.
 *
 * Detection is marker-based, so nothing has to be configured before it works: a glossary at one
 * of the two documented locations, or Hangul in the instruction file or the README - never a
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
import { fileURLToPath, pathToFileURL } from "node:url";

// How much of an instruction file or README is read when looking for Hangul.
const HEAD_BYTES = 64 * 1024;

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
  } catch (error) {
    // Absent or unreadable is an answer here; anything that is not a filesystem error is a fault.
    if (typeof error?.code === "string") return null;
    throw error;
  }
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
    const head = readIfPresent(path.join(root, rel), HEAD_BYTES);
    if (head && HANGUL.test(head)) return true;
  }
  return false;
}

/** Which skills an instruction file at or under root already routes to. */
function routing(root) {
  const routed = {};
  const candidates = new Set();
  for (const rel of INSTRUCTION_FILES) candidates.add(path.join(root, rel));

  for (const file of candidates) {
    const content = readIfPresent(file);
    if (!content) continue;
    for (const skill of ["korean-docs", "svg-diagrams"]) {
      if (!routed[skill] && content.includes(`simplecore:${skill}`)) routed[skill] = file;
    }
  }
  return routed;
}

/**
 * Whether the user's global instruction file already carries the Korean style baseline.
 *
 * @remarks
 * Ordinary answers never invoke the korean-docs skill; they follow the habits block the global
 * instruction file carries, so that block is what a session needs before its first Korean reply.
 * A routing line there sends document work to the skill. Checked read-only, and absence is
 * reported rather than acted on.
 */
const KOREAN_CARD_MARKER = "<!-- simplecore:korean-habits -->";
const KOREAN_CARD_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "skills",
  "korean-docs",
  "references",
  "global-korean-card.md",
);

/**
 * The habits block as one comparable string: from the marker to the next heading of level one
 * to three (the block's own heading is level four), whitespace collapsed. Null where there is
 * no marker.
 */
function koreanCardBlock(text) {
  const start = text.indexOf(KOREAN_CARD_MARKER);
  if (start < 0) return null;
  const rest = text.slice(start);
  const next = /\n#{1,3} (?!#)/.exec(rest);
  return rest.slice(0, next ? next.index : rest.length).replace(/\s+/g, " ").trim();
}

function globalKoreanInstruction() {
  const file = path.join(os.homedir(), ".claude", "CLAUDE.md");
  const content = readIfPresent(file);
  if (!content) return { file, present: false, card: false, cardStale: false };
  // `present` is the routing - a line that names the skill or its style file. `card` is the
  // habits block itself. The two are different things and the second is the one that works:
  // a pointer survives a long session while the file it points at does not, so a global
  // instruction can route correctly and still produce the register it forbids. The marker is
  // written by the block; the heading is accepted too, for a file that was edited by hand.
  //
  // `cardStale` compares the block with the skill's copy. The card grows as the skill learns,
  // and a pasted copy keeps the habits of the day it was pasted - with nothing else reporting
  // it, the global file drifts from the skill and the drift reads as compliance.
  const card = /simplecore:korean-habits|#### The Korean habits/.test(content);
  const skillCard = readIfPresent(KOREAN_CARD_FILE);
  const pasted = koreanCardBlock(content);
  const current = skillCard ? koreanCardBlock(skillCard) : null;
  return {
    file,
    present: /korean-docs|response-style\.md/.test(content),
    card,
    cardStale: Boolean(card && pasted && current && pasted !== current),
  };
}

/**
 * Analyze a directory tree.
 *
 * @returns `{root, glossary, korean, routedBy, globalKorean, skills, missing, wired}` with every
 * path relative to `root`. `missing` holds one plain-language line per piece of wiring that is
 * absent, which is what a session reads out to the user before offering to fix it.
 */
export function analyze(root) {
  const resolved = path.resolve(root);
  const glossary = findGlossary(resolved);
  const korean = writesKorean(resolved, glossary);
  const routedBy = routing(resolved);
  const globalKorean = globalKoreanInstruction();

  const rel = (p) => (p ? path.relative(resolved, p) || "." : null);

  const skills = [];
  if (korean) skills.push("simplecore:korean-docs");

  const missing = [];
  if (korean && !glossary) {
    missing.push(
      "there is no project glossary, so the same term is translated differently from one document to the next and the write-time audit stays off",
    );
  }
  if (korean && !globalKorean.card) {
    missing.push(
      "the global instruction file does not carry the Korean habits block, so ordinary answers are written without the reply standard",
    );
  } else if (korean && !globalKorean.present) {
    missing.push(
      "the global instruction file does not route Korean document work to korean-docs, so documents are written without the glossary and the audit",
    );
  } else if (korean && globalKorean.cardStale) {
    missing.push(
      "the habits block in the global instruction file is behind the skill's copy " +
        "(skills/korean-docs/references/global-korean-card.md), so replies follow habits the skill has since revised — " +
        "replace the block from its marker to the next heading with the file, whole",
    );
  }

  return {
    root: resolved,
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
  } catch (error) {
    if (typeof error?.code === "string") return false;
    throw error;
  }
}

if (isMain()) main();
