#!/usr/bin/env node
/**
 * Skill gate — refuse a source edit until the handbook skill for that subproject has been
 * invoked in this session.
 *
 * The handbooks encode conventions that diverge from the stock framework, so an edit written
 * from memory produces defects a reviewer then has to catch. The instruction file already says
 * "invoke the skill first"; this makes it hold when the instruction is skimmed.
 *
 * Wired as two modes on one command:
 *   PostToolUse  matcher "Skill"                : skill-gate.mjs mark
 *   PreToolUse   matcher "Write|Edit|MultiEdit" : skill-gate.mjs check
 *
 * "mark" records every skill invoked this session, for this gate and for the e2e gate beside
 * it. "check" denies an edit under a guarded directory when no gating skill has been recorded.
 *
 * Scope guard: nothing is gated until a project declares `skillGate` in `.claude/simplix.json`:
 *
 *   { "skillGate": { "skills": ["simplix:frontend"], "sourceDirs": ["modules/", "apps/"] } }
 *
 * Escape hatch: SIMPLIX_SKILL_GATE=off, for a mechanical migration driven by a script rather
 * than by hand-editing.
 */
import {readFileSync} from 'node:fs';
import {dirname, relative, resolve} from 'node:path';
import {findProjectConfig, underAny} from './project-config.mjs';
import {hasMarker, setMarker} from './session-marker.mjs';

const SOURCE_EXT = /\.(tsx|ts|css|java|kt)$/;
const ALWAYS_EXEMPT = ['/.claude/', '/generated/', '/node_modules/', '/dist/', '/build/', '.gen.ts', '.d.ts'];

function readInput() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return null;
  }
}

const mode = process.argv[2];
const input = readInput();
if (!input?.session_id) process.exit(0);

if (mode === 'mark') {
  const skill = String(input.tool_input?.skill ?? '');
  if (skill) setMarker('skill', input.session_id, skill);
  process.exit(0);
}

if (mode === 'check') {
  if (process.env.SIMPLIX_SKILL_GATE === 'off') process.exit(0);

  const filePath = String(input.tool_input?.file_path ?? '');
  if (!filePath || !SOURCE_EXT.test(filePath)) process.exit(0);
  if (ALWAYS_EXEMPT.some((p) => filePath.includes(p))) process.exit(0);

  const abs = resolve(input.cwd || process.cwd(), filePath);
  const found = findProjectConfig(dirname(abs));
  const gate = found?.config?.skillGate;
  if (!Array.isArray(gate?.skills) || gate.skills.length === 0) process.exit(0);

  const rel = relative(found.root, abs);
  if (rel.startsWith('..') || !underAny(rel, gate.sourceDirs)) process.exit(0);
  if (gate.skills.some((s) => hasMarker('skill', input.session_id, s))) process.exit(0);

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
          `Source edit blocked: none of ${gate.skills.join(' / ')} has been invoked this session. ` +
          `Invoke the handbook skill first, then retry the edit. File: ${rel}`,
      },
    }),
  );
  process.exit(0);
}

process.exit(0);
