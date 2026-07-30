/**
 * The opt-in config a board-parity walk declares: `.claude/board-parity-walk.json`.
 *
 * A walk's rules apply to two named documents, and only the project can say where they are. Every
 * gate that enforces those rules therefore starts here, and a project that has not declared the
 * file is never gated.
 *
 *   {
 *     "parityList": "_plans/SCREEN-PARITY.md",
 *     "handoverFile": "_plans/WALK-NOTES.md",
 *     "parkedSection": "Parked decisions",
 *     "logDir": ".walk-logs",
 *     "narrativePhrases": ["…"]
 *   }
 */
import {existsSync, readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {dirname, join, resolve} from 'node:path';

const CONFIG_NAME = join('.claude', 'board-parity-walk.json');

/**
 * Walk up from a directory for the opt-in config, stopping at the git boundary or home.
 *
 * @returns `{file, root, config}` for the project that owns it, or null. A config present but
 * unparseable returns `{file, root, config: null}`, so a caller can say so rather than acting as
 * though the project never opted in.
 */
export function findParityConfig(startDir) {
  const home = homedir();
  let dir = resolve(startDir);
  for (;;) {
    const candidate = join(dir, CONFIG_NAME);
    if (existsSync(candidate)) {
      try {
        return {file: candidate, root: dir, config: JSON.parse(readFileSync(candidate, 'utf8'))};
      } catch {
        return {file: candidate, root: dir, config: null};
      }
    }
    if (existsSync(join(dir, '.git')) || dir === home) return null;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Absolute path of a config-declared document, or null when the key is absent. */
export function documentPath(found, key) {
  const value = found?.config?.[key];
  return typeof value === 'string' ? resolve(found.root, value) : null;
}

export {CONFIG_NAME};
