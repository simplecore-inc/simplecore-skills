#!/usr/bin/env node
/**
 * PostToolUse hook: lint an SVG the moment it is written.
 *
 * Valid SVG XML is not a correct picture. A marker that resolves to nothing, an arrowhead buried
 * inside the box it points at, a Korean label overflowing a box sized for Latin — none of these
 * are visible in the source, and all of them survive a careful read of the diff. The svg-diagrams
 * skill says to run the lint before delivering; this is what makes that hold when the file looks
 * finished.
 *
 * It runs the same static scan the skill documents (`audit.py lint`), so a project gets one
 * verdict whether the lint was run by hand or by this hook. The lint is a screen, not the whole
 * audit — render and hotspot passes still belong to the skill.
 *
 * Scope guard: a PostToolUse write is by definition a file this session authored or edited, which
 * is exactly the file worth linting. A project turns the check off with
 * `{"svgLint": false}` in `.claude/simplecore.json`. A tree without python3, or a file too large
 * to be a diagram, is skipped in silence.
 *
 * Exit codes: 0 = silent pass (not applicable, or clean),
 *             2 = findings reported on stderr, fed back to Claude.
 */
import {spawnSync} from 'node:child_process';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {dirname, extname, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gateEnabled} from './project-config.mjs';

const LINT_SCRIPT = fileURLToPath(
  new URL('../skills/svg-diagrams/scripts/audit.py', import.meta.url),
);

// A diagram this toolchain produces is tens of kilobytes. Anything far past that is a traced
// illustration or an icon sprite, where these checks describe the wrong kind of picture.
const MAX_BYTES = 2 * 1024 * 1024;

function main() {
  let payload;
  try {
    payload = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return 0; // no parseable hook input; nothing to lint
  }

  const filePath = payload?.tool_input?.file_path;
  if (typeof filePath !== 'string' || filePath.length === 0) return 0;
  if (extname(filePath).toLowerCase() !== '.svg') return 0;

  const abs = resolve(payload.cwd || process.cwd(), filePath);
  if (!existsSync(abs)) return 0;
  if (!existsSync(LINT_SCRIPT)) return 0;

  try {
    if (statSync(abs).size > MAX_BYTES) return 0;
  } catch {
    return 0;
  }

  if (!gateEnabled(dirname(abs), 'svgLint')) return 0;

  const run = spawnSync('python3', [LINT_SCRIPT, 'lint', abs], {encoding: 'utf8', timeout: 20_000});
  // No python3, a timeout, or a crashed lint must never block a write; the skill's own pass covers
  // the case where this could not run.
  if (run.error || run.status === null || run.status === 0) return 0;

  const output = `${run.stdout ?? ''}${run.stderr ?? ''}`.trim();
  if (!output) return 0;

  const rel = relative(payload.cwd || process.cwd(), abs) || abs;
  process.stderr.write(
    `SVG render defects — ${rel}\n${output}\n\n` +
      `Fix these, then re-lint. The defect catalog, the fixes, and the render/hotspot passes that ` +
      `catch what a static scan cannot are in the simplecore:svg-diagrams skill ` +
      `(references/render-audit.md).\n`,
  );
  return 2;
}

process.exit(main());
