/**
 * The one project-declared config this plugin reads: `.claude/simplix.json`.
 *
 * Sections: `audit` (the convention audit script), `skillGate` (the handbook gate), `e2eGate`
 * (the browser-audit gate). A project that declares none of them is never gated — directory
 * layout, which skills bind, and what counts as a UI file are the project's to state, never
 * this plugin's to assume.
 */
import {existsSync, readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {dirname, join, resolve} from 'node:path';

const CONFIG_NAME = join('.claude', 'simplix.json');

/**
 * Walk up from a directory to the nearest `.claude/simplix.json`, stopping at the git boundary.
 *
 * @returns `{root, config}` for the subproject that owns the file, or null.
 */
export function findProjectConfig(startDir) {
  const home = homedir();
  let dir = resolve(startDir);
  for (;;) {
    const candidate = join(dir, CONFIG_NAME);
    if (existsSync(candidate)) {
      try {
        return {root: dir, config: JSON.parse(readFileSync(candidate, 'utf8'))};
      } catch {
        return null; // an unreadable config never blocks anything
      }
    }
    if (existsSync(join(dir, '.git')) || dir === home) return null;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Whether a project-relative path sits under one of the declared prefixes. */
export function underAny(relPath, prefixes) {
  return Array.isArray(prefixes) && prefixes.some((p) => relPath.startsWith(p));
}

export {CONFIG_NAME};
