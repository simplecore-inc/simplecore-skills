#!/usr/bin/env node
/**
 * PostToolUse hook: lint an SVG the moment it is written.
 *
 * Valid SVG XML is not a correct picture. A marker that resolves to nothing, an arrowhead buried
 * inside the box it points at, a Korean label overflowing a box sized for Latin - none of these
 * are visible in the source, and all of them survive a careful read of the diff. The svg-diagrams
 * skill says to run the lint before delivering; this is what makes that hold when the file looks
 * finished.
 *
 * It runs the same static scan the skill documents (`audit.py lint`), so a project gets one
 * verdict whether the lint was run by hand or by this hook. The lint is a screen, not the whole
 * audit - render and hotspot passes still belong to the skill.
 *
 * Scope guard: a PostToolUse write is a file this session wrote or edited through the Write,
 * Edit or MultiEdit tool; an SVG a script writes (svgkit, layout.js, graph.js, the document-figure
 * build) never reaches this hook, and the skill lints those itself. The checks describe a
 * diagram, so an SVG that carries neither a label nor an arrowhead - an icon, a logo, a traced
 * illustration - is skipped, as is a file too large to be a diagram. A project turns the check off
 * with `{"svgLint": false}` in `.claude/simplecore.json`. A tree without python3 is skipped in
 * silence.
 *
 * Exit codes: 0 = silent pass (not applicable, clean, or the lint could not run),
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

// A diagram labels its parts or draws connectors that arrive somewhere. An SVG with no `<text>`
// and no `<marker>` does neither, and the margin and spacing checks would report its own edges -
// a 24-unit icon's ink sits 2 units from each side by design - as defects to fix.
function isDiagram(markup) {
  return /<text\b/.test(markup) || /<marker\b/.test(markup);
}

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

  let markup;
  try {
    if (statSync(abs).size > MAX_BYTES) return 0;
    markup = readFileSync(abs, 'utf8');
  } catch {
    return 0;
  }
  if (!isDiagram(markup)) return 0;

  if (!gateEnabled(dirname(abs), 'svgLint')) return 0;

  const rel = relative(payload.cwd || process.cwd(), abs) || abs;
  const run = spawnSync('python3', [LINT_SCRIPT, 'lint', abs], {encoding: 'utf8', timeout: 20_000});
  // No python3 or a timeout must never block a write; the skill's own pass covers the case where
  // this could not run.
  if (run.error || run.status === null || run.status === 0) return 0;

  const stdout = run.stdout ?? '';
  // The lint prints a `=== lint` header for every file it finished and exits 1 when it found
  // something. A crash exits 1 as well, with a traceback and no header: that is a lint that could
  // not run, not a defect in the drawing, so it is noted in the transcript and the write goes on.
  if (!/^=== lint /m.test(stdout)) {
    const reason = (run.stderr ?? '').trim().split('\n').pop() || `exit ${run.status}`;
    process.stderr.write(`svg lint could not run on ${rel}: ${reason}\n`);
    return 0;
  }

  const output = `${stdout}${run.stderr ?? ''}`.trim();
  process.stderr.write(
    `SVG render defects: ${rel}\n${output}\n\n` +
      `Fix these, then re-lint. The defect catalog, the fixes, and the render/hotspot passes that ` +
      `catch what a static scan cannot are in the simplecore:svg-diagrams skill ` +
      `(references/render-audit.md).\n`,
  );
  return 2;
}

process.exit(main());
