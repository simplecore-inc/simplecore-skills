/**
 * The one project-declared config this plugin's gates read: `.claude/simplecore.json`.
 *
 * Every gate here is on by default, because a defect it catches is a defect in the artifact
 * regardless of which repository holds it. This file is where a project turns one off, or narrows
 * what it looks at — never where it has to opt in.
 *
 * Recognized keys:
 *
 *   {
 *     "svgLint": false,                      // stop linting SVG files at write time
 *     "boardCheck": false,                   // stop checking board HTML at write time
 *     "walkGate": false                      // stop the parity-walk delegation gate
 *   }
 */
import {existsSync, readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {dirname, join, resolve} from 'node:path';

const CONFIG_NAME = join('.claude', 'simplecore.json');

/**
 * Walk up from a directory to the nearest `.claude/simplecore.json`, stopping at the git boundary.
 *
 * @returns `{root, config}` for the project that owns the file, or null when there is none.
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
        return null; // an unreadable config never changes what a gate does
      }
    }
    if (existsSync(join(dir, '.git')) || dir === home) return null;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Whether a gate is enabled for the project owning `startDir`.
 *
 * @remarks
 * Absent config, absent key, and any value other than `false` all mean enabled. Only an explicit
 * `false` turns a gate off, so a typo in the config never silently disables a check.
 */
export function gateEnabled(startDir, key) {
  const found = findProjectConfig(startDir);
  return found?.config?.[key] !== false;
}

export {CONFIG_NAME};
