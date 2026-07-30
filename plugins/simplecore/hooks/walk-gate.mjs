#!/usr/bin/env node
/**
 * Walk gate — a session that walked frames off the parity list does not end without the walking
 * having happened in a subagent.
 *
 * This is the one rule the board-parity-walk skill names as its reason for existing: the walk is
 * screenshots, logs, and browser turns, and run in the coordinating context it dries that context
 * out before a section is done, leaving half-built code behind. The other checks in this plugin
 * hold the two documents to their shape; this one holds the walk to its shape, because the failure
 * it prevents costs a whole session rather than a paragraph.
 *
 * Wired as three modes on one command:
 *   PostToolUse  matcher "Task|Agent"            : walk-gate.mjs mark-agent
 *   PostToolUse  matcher "Write|Edit|MultiEdit"  : walk-gate.mjs touch
 *   Stop                                         : walk-gate.mjs check
 *
 * "mark-agent" records that a subagent ran. "touch" records that frames were REMOVED from the
 * parity list — which is what walking a frame does, and what neither filling the list from the
 * board nor settling a parked decision does. "check" blocks once when frames left the list and no
 * subagent ever ran.
 *
 * It blocks AT MOST ONCE per session, and only for a project that opted into a walk by writing
 * `.claude/board-parity-walk.json`. A project turns it off with `{"walkGate": false}` in
 * `.claude/simplecore.json`.
 *
 * Exit codes: 0 always. The block travels as JSON on stdout, not as an exit code.
 */
import {readFileSync} from 'node:fs';
import {dirname, relative, resolve} from 'node:path';
import {documentPath, findParityConfig} from './parity-config.mjs';
import {gateEnabled} from './project-config.mjs';
import {hasMarker, readMarker, setMarker} from './session-marker.mjs';

function readInput() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return null;
  }
}

/** How many list items a chunk of markdown holds. */
function countItems(text) {
  return (String(text ?? '').match(/^[^\S\n]*[-*+]\s+\S/gm) ?? []).length;
}

/**
 * Net list items removed by one edit, or by every edit of a MultiEdit.
 *
 * @remarks
 * The list only shrinks when a frame is walked. It grows from the other side — a route that did
 * not exist when the list was written, a frame back-filled while syncing the board — and it is
 * edited in place when a parked decision is recorded. Counting the net change is what separates
 * the one case this gate cares about from the three it must not fire on. A whole-file `Write`
 * carries no before-state, so it never counts as walking.
 */
function itemsRemoved(toolInput) {
  const edits = Array.isArray(toolInput?.edits)
    ? toolInput.edits
    : toolInput?.old_string !== undefined
      ? [{old_string: toolInput.old_string, new_string: toolInput.new_string}]
      : [];

  return edits.reduce((sum, e) => sum + countItems(e.old_string) - countItems(e.new_string), 0);
}

const mode = process.argv[2];
const input = readInput();
if (!input?.session_id) process.exit(0);

if (mode === 'mark-agent') {
  setMarker('walk-agent', input.session_id);
  process.exit(0);
}

if (mode === 'touch') {
  const filePath = String(input.tool_input?.file_path ?? '');
  if (!filePath) process.exit(0);

  const abs = resolve(input.cwd || process.cwd(), filePath);
  const found = findParityConfig(dirname(abs));
  if (!found?.config) process.exit(0);
  if (abs !== documentPath(found, 'parityList')) process.exit(0);
  if (itemsRemoved(input.tool_input) <= 0) process.exit(0);

  // The marker carries the list's path, so the block can name the document it is about.
  setMarker('walk-shrunk', input.session_id, '', relative(found.root, abs));
  process.exit(0);
}

if (mode === 'check') {
  if (input.stop_hook_active) process.exit(0);
  if (hasMarker('walk-warned', input.session_id)) process.exit(0);
  if (hasMarker('walk-agent', input.session_id)) process.exit(0);

  const list = readMarker('walk-shrunk', input.session_id);
  if (!list) process.exit(0);
  if (!gateEnabled(input.cwd || process.cwd(), 'walkGate')) process.exit(0);

  setMarker('walk-warned', input.session_id);
  process.stdout.write(
    JSON.stringify({
      decision: 'block',
      reason:
        `Frames were removed from ${list} this session and no subagent ever ran. Walking a cluster ` +
        `in the coordinating context is the failure the simplecore:board-parity-walk skill exists ` +
        `to prevent: screenshots and logs fill this context, and the walk dries out mid-section ` +
        `leaving half-built code behind. Either hand each remaining cluster to its own subagent ` +
        `(one cluster, one agent, a fresh agent after each) and let it return conclusions only, or ` +
        `state plainly that this session removed lines for another reason — a settled parked ` +
        `decision, a frame that turned out to have no route, a list corrected while syncing the ` +
        `board. This gate does not fire again in this session.`,
    }),
  );
  process.exit(0);
}

process.exit(0);
