#!/usr/bin/env node
/**
 * Completion gate — a session that changed screens does not end without those screens having
 * been driven in a browser, nor without the convention audit having run.
 *
 * The other gate in this plugin guards the moment of editing. This one guards the moment of
 * claiming done, because that is where both checks are actually skipped: the build is green,
 * the diff reads correctly, and nobody opened the page or ran the audit. A screen whose states
 * have never been walked by hand is unverified no matter how green the build is, and the defects
 * that hides — a dead filter, an empty state that never renders, a dialog that cannot be
 * dismissed — are exactly the ones a type checker cannot see. The audit script covers the other
 * half: the machine-checkable conventions that a reviewer would otherwise catch by eye, one of
 * which (an ungated action affordance) is a permission hole rather than a style problem.
 *
 * Wired as three modes on one command:
 *   PostToolUse  matcher "Write|Edit|MultiEdit" : e2e-gate.mjs touch
 *   PostToolUse  matcher "Bash"                 : e2e-gate.mjs mark-audit
 *   Stop                                        : e2e-gate.mjs check
 *
 * "touch" records that a UI file changed this session. "mark-audit" records that the convention
 * audit script was run. "check" blocks the stop once, naming every omission at the same time so
 * a session is interrupted once rather than twice.
 *
 * It blocks AT MOST ONCE per session. The gate exists to make an omission visible, not to trap
 * a session that has a good reason — a pure refactor, a change with no reachable screen, a user
 * who asked for code only. Claude answers the objection and stops again.
 *
 * Scope guard: nothing is gated until a project declares `e2eGate` in `.claude/simplix.json`:
 *
 *   { "e2eGate": { "skill": "simplix:frontend-e2e", "uiDirs": ["modules/", "apps/"] } }
 *
 * Escape hatch: SIMPLIX_E2E_GATE=off.
 */
import {readFileSync} from 'node:fs';
import {dirname, relative, resolve} from 'node:path';
import {findProjectConfig, underAny} from './project-config.mjs';
import {hasMarker, readMarker, setMarker} from './session-marker.mjs';

const DEFAULT_UI_EXTENSIONS = ['.tsx'];

/** The convention audit this plugin ships. Recognized by script name, wherever it is invoked from. */
const AUDIT_SCRIPT = 'audit-frontend.mjs';

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

if (mode === 'mark-audit') {
  const command = String(input.tool_input?.command ?? '');
  if (command.includes(AUDIT_SCRIPT)) setMarker('audit-ran', input.session_id);
  process.exit(0);
}

if (mode === 'touch') {
  const filePath = String(input.tool_input?.file_path ?? '');
  if (!filePath) process.exit(0);

  const abs = resolve(input.cwd || process.cwd(), filePath);
  const found = findProjectConfig(dirname(abs));
  const gate = found?.config?.e2eGate;
  if (!gate?.skill) process.exit(0);

  const extensions = Array.isArray(gate.uiExtensions) ? gate.uiExtensions : DEFAULT_UI_EXTENSIONS;
  if (!extensions.some((e) => filePath.endsWith(e))) process.exit(0);

  const rel = relative(found.root, abs);
  if (rel.startsWith('..') || !underAny(rel, gate.uiDirs)) process.exit(0);

  // The marker carries the last screen file touched, so the block can name something concrete.
  setMarker('e2e-touched', input.session_id, '', `${gate.skill}\n${rel}`);
  process.exit(0);
}

if (mode === 'check') {
  if (process.env.SIMPLIX_E2E_GATE === 'off') process.exit(0);
  if (input.stop_hook_active) process.exit(0);
  if (hasMarker('e2e-warned', input.session_id)) process.exit(0);

  const touched = readMarker('e2e-touched', input.session_id);
  if (!touched) process.exit(0);

  const [skill, lastFile] = touched.split('\n');
  if (!skill) process.exit(0);

  // Both omissions are reported together: a session interrupted twice for one change learns to
  // treat the gate as noise, and the two checks answer the same question about the same change.
  const omissions = [];
  if (!hasMarker('skill', input.session_id, skill)) {
    omissions.push(
      `${skill} was never invoked, so no changed screen has been driven in a browser. A screen ` +
        `whose states have not been walked by hand is unverified, however green the build is. ` +
        `Either invoke ${skill} and walk the changed screens and the ones either side of them — ` +
        `anything past a single screen goes to one simplix:screen-auditor per cluster — or state ` +
        `plainly why this change needs no browser pass (a pure refactor with no reachable screen, ` +
        `or the user asked for code only).`,
    );
  }
  if (!hasMarker('audit-ran', input.session_id)) {
    omissions.push(
      `the convention audit never ran, so the machine-checkable rules are unverified — including ` +
        `the ungated action affordance, which is a permission hole rather than a style problem. ` +
        `Run \`node "\${CLAUDE_PLUGIN_ROOT}/scripts/${AUDIT_SCRIPT}"\` from the frontend project ` +
        `root and drive it to zero error-level hits.`,
    );
  }
  if (omissions.length === 0) process.exit(0);

  setMarker('e2e-warned', input.session_id);
  process.stdout.write(
    JSON.stringify({
      decision: 'block',
      reason:
        `UI files changed this session (most recently ${lastFile}) and this change is not verified:\n` +
        omissions.map((o, i) => `${i + 1}. ${o}`).join('\n') +
        `\nThis gate does not fire again in this session.`,
    }),
  );
  process.exit(0);
}

process.exit(0);
