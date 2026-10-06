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
 *
 * A repository drawing two products gives each board its own pair under `boards` and keeps the
 * rest shared:
 *
 *   {
 *     "boards": {
 *       "<board>": { "parityList": "<path>", "handoverFile": "<path>" }
 *     },
 *     "parkedSection": "Parked decisions"
 *   }
 */
import {existsSync, readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {dirname, join, resolve} from 'node:path';

const CONFIG_NAME = join('.claude', 'board-parity-walk.json');

/** The two documents a walk keeps, by the key each is declared under. */
const DOCUMENT_KEYS = ['parityList', 'handoverFile'];

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
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        return {file: candidate, root: dir, config: null};
      }
    }
    if (existsSync(join(dir, '.git')) || dir === home) return null;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Absolute path of a top-level config-declared document, or null when the key is absent. */
export function documentPath(found, key) {
  const value = found?.config?.[key];
  return typeof value === 'string' ? resolve(found.root, value) : null;
}

/**
 * Every pair of documents the config declares.
 *
 * @remarks
 * The top-level pair is the one-board case; each entry of `boards` is one board of a repository
 * drawing two products. Both shapes may sit in one file, and every pair declared is held to the
 * walk's rules - a pair the reader skipped would leave one product's list unchecked while every
 * write to it looked clean.
 *
 * @returns `[{board, parityList, handoverFile, declared: {parityList, handoverFile}}]` - `board`
 *   is null for the top-level pair, the paths are absolute, and a key the pair does not declare
 *   is null. Empty when the config is absent or unparseable.
 */
export function documentSets(found) {
  const config = found?.config;
  if (!config || typeof config !== 'object') return [];
  const pairOf = (board, entry) => {
    const declared = Object.fromEntries(
      DOCUMENT_KEYS.map((key) => [key, typeof entry[key] === 'string' && entry[key] ? entry[key] : null]),
    );
    return {
      board,
      ...Object.fromEntries(DOCUMENT_KEYS.map((key) => [key, declared[key] ? resolve(found.root, declared[key]) : null])),
      declared,
    };
  };
  const sets = [];
  if (DOCUMENT_KEYS.some((key) => typeof config[key] === 'string')) sets.push(pairOf(null, config));
  const boards = config.boards;
  if (boards && typeof boards === 'object' && !Array.isArray(boards)) {
    for (const [board, entry] of Object.entries(boards)) {
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) sets.push(pairOf(board, entry));
    }
  }
  return sets;
}

/**
 * Which declared document an absolute path is.
 *
 * @returns `{key, board}` - `key` is `parityList` or `handoverFile`, `board` the board it belongs
 *   to or null for the top-level pair - or null when the path is none of them.
 */
export function documentRole(found, absPath) {
  for (const set of documentSets(found)) {
    for (const key of DOCUMENT_KEYS) {
      if (set[key] && set[key] === absPath) return {key, board: set.board};
    }
  }
  return null;
}

export {CONFIG_NAME};
