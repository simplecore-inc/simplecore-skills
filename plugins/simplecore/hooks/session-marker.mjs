/**
 * Per-session markers shared by this plugin's gate hooks.
 *
 * A gate has to know what already happened in the session — which skill was invoked, whether a
 * subagent was ever launched, whether the parity list was edited — and hooks are separate
 * processes with no memory between them. A file in the temp directory, keyed by session, is the
 * whole mechanism.
 *
 * A marker never outlives its usefulness in a way that matters: a stale one only means a gate
 * stays open for a session id that will not come back.
 *
 * @remarks
 * The `simplix` plugin carries the same mechanism under its own prefix. Plugins install
 * independently and cannot import across each other, so the two copies are deliberate; the
 * prefix keeps their marker files from colliding in a shared temp directory.
 */
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const PREFIX = 'simplecore-gate';

/** Path of one marker. `name` is free-form; anything unsafe for a filename is folded to `_`. */
export function markerPath(kind, sessionId, name = '') {
  const safe = `${kind}-${name}`.replace(/[^\w.-]/g, '_');
  return join(tmpdir(), `${PREFIX}-${safe}-${sessionId}`);
}

export function setMarker(kind, sessionId, name = '', body = '1') {
  try {
    writeFileSync(markerPath(kind, sessionId, name), body);
  } catch {
    // A failed marker write must never break the session; the gate simply stays as it was.
  }
}

export function hasMarker(kind, sessionId, name = '') {
  return existsSync(markerPath(kind, sessionId, name));
}

export function readMarker(kind, sessionId, name = '') {
  try {
    return readFileSync(markerPath(kind, sessionId, name), 'utf8');
  } catch {
    return null;
  }
}
