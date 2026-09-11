#!/usr/bin/env node
/**
 * PostToolUse hook: audit a file touched by Write/Edit against the Korean
 * glossary rules AND the sentence-rule pack bundled with the korean-docs skill.
 * SVG files are checked on their <text>/<tspan> content so diagram labels stay
 * consistent with the documents they illustrate.
 *
 * Two runs, because the two engines answer different questions. The glossary
 * check judges words — spellings, transliterations, banned phrases — and the
 * rule pack judges sentences: personification, metaphors standing in for real
 * names, AI tells. For a long time only the first ran here, and every sentence
 * rule bit only when somebody asked for an audit; a document could be written
 * clean of banned words and full of the habits the pack exists to catch. The
 * rule pack honours `audit.exclude` on a named file, so an edit to a catalogue
 * that quotes the banned sentences on purpose is reported as skipped, not blocked.
 *
 * Scope guard: the audit runs only when the edited file belongs to a project
 * that has a project glossary (<dir>/.claude/GLOSSARY.md or <dir>/GLOSSARY.md,
 * discovered by walking up from the file). Projects that do not opt into
 * Korean documentation standards never see any output from this hook.
 *
 * **What counts as auditable is the project's answer, not an extension list.**
 * A project declaring audit.localeResources says those files hold screen copy,
 * and screen copy is what this hook exists to catch at the moment it is typed.
 * Gating on the extension list first meant the declared resources — a whole
 * board's worth of Korean strings — had no write-time gate at all, and the
 * silence read exactly like a pass. So the glossary is discovered first and its
 * declaration widens what is auditable.
 *
 * Exit codes: 0 = silent pass (not applicable, or clean),
 *             2 = findings reported on stderr, fed back to Claude.
 */
import {spawnSync} from 'node:child_process';
import {existsSync, readFileSync, realpathSync} from 'node:fs';
import {homedir} from 'node:os';
import {basename, dirname, extname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseGlossaryConfig, rootFromGlossaryPath} from '../skills/korean-docs/scripts/lib/glossary.mjs';
import {makeLocaleResourceMatcher} from '../skills/korean-docs/scripts/lib/doc-audit.mjs';

const AUDIT_SCRIPT = fileURLToPath(
  new URL('../skills/korean-docs/scripts/check-glossary.mjs', import.meta.url),
);
const L10N_SCRIPT = fileURLToPath(new URL('../skills/korean-docs/scripts/l10n.mjs', import.meta.url));
const AUDIT_EXTENSIONS = new Set(['.md', '.mdx', '.markdown', '.svg']);

/** Whether the project's audit.localeResources declaration covers this file. */
function isDeclaredResource(glossaryPath, abs) {
  let config;
  try {
    ({config} = parseGlossaryConfig(readFileSync(glossaryPath, 'utf8')));
  } catch {
    // A malformed declaration is the audit's finding to report, not the hook's
    // reason to drop the file — leave it to the extension list this time.
    return false;
  }
  if (config.localeResources.length === 0) return false;
  return makeLocaleResourceMatcher(config.localeResources, rootFromGlossaryPath(glossaryPath))(abs);
}

/**
 * Whether `.claude/l10n.json` at the glossary root declares this file as a resource kind.
 *
 * The sentence rules read a kind's files by that kind's format and register, and a project that
 * declared its kinds there — and not in the glossary's `audit.localeResources` — had no
 * write-time run of the sentence rules on any of them. The two declarations answer different
 * commands (`check` reads the first, `rules` the second), so the hook reads both. `{lang}` is a
 * wildcard here as it is there.
 */
function isDeclaredKind(glossaryPath, abs) {
  const root = rootFromGlossaryPath(glossaryPath);
  const layout = join(root, '.claude', 'l10n.json');
  if (!existsSync(layout)) return false;
  let config;
  try {
    config = JSON.parse(readFileSync(layout, 'utf8'));
  } catch {
    return false;
  }
  const patterns = Object.values(config?.kinds ?? {})
    .flatMap((kind) => [...(kind.patterns ?? []), ...(kind.basePatterns ?? [])])
    .map((p) => p.replaceAll('{lang}', '*'));
  if (patterns.length === 0) return false;
  return makeLocaleResourceMatcher(patterns, root)(abs);
}

/** Mirrors the glossary discovery in check-glossary.mjs: walk up from
 * startDir, stop at the git boundary or the home directory. */
function findProjectGlossary(startDir) {
  const home = homedir();
  let dir = resolve(startDir);
  for (;;) {
    for (const candidate of [join(dir, '.claude', 'GLOSSARY.md'), join(dir, 'GLOSSARY.md')]) {
      if (existsSync(candidate)) return candidate;
    }
    if (existsSync(join(dir, '.git')) || dir === home) return null;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function main() {
  let payload;
  try {
    payload = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return 0; // no parseable hook input; nothing to audit
  }

  const filePath = payload?.tool_input?.file_path;
  if (typeof filePath !== 'string' || filePath.length === 0) return 0;

  const given = resolve(payload.cwd || process.cwd(), filePath);
  if (!existsSync(given)) return 0;
  // Canonical, because the two runs decide "inside the project" with relative() against a
  // physical cwd — a logical spelling through a symlink (/tmp on macOS, a linked workspace)
  // reads as outside, and a screen file loses the kind that gives it its register.
  const abs = realpathSync(given);

  const glossary = findProjectGlossary(dirname(abs));
  if (!glossary) return 0;
  // The glossary itself contains banned forms by definition; never audit it.
  if (resolve(glossary) === abs || basename(abs) === 'GLOSSARY.md') return 0;
  // The glossary check reads documents and the resources the glossary declares; the sentence
  // rules read those and every kind `.claude/l10n.json` declares. A resource file known only to
  // the second gets the second run alone — the word check would read its keys as prose.
  const auditable = AUDIT_EXTENSIONS.has(extname(abs).toLowerCase()) || isDeclaredResource(glossary, abs);
  if (!auditable && !isDeclaredKind(glossary, abs)) return 0;

  // Run both from the file's directory so each discovers the same project
  // glossary. process.execPath avoids PATH/.cmd-shim issues on Windows.
  const runs = [];
  if (auditable) runs.push(['glossary', [AUDIT_SCRIPT, abs]]);
  runs.push(['sentence rules', [L10N_SCRIPT, 'rules', abs]]);
  const reports = [];
  for (const [name, argv] of runs) {
    const result = spawnSync(process.execPath, argv, {
      cwd: dirname(abs),
      encoding: 'utf8',
      timeout: 12_000,
      env: {...process.env, NO_COLOR: '1'},
    });
    if (result.error || result.status === null) {
      // An infrastructure failure must not block the session — but it is said, so a
      // silent run is never mistaken for a clean one.
      process.stderr.write(`korean-docs hook: the ${name} check did not run (${result.error?.message ?? 'timeout'})\n`);
      continue;
    }
    if (result.status === 0) continue;
    // status 1 = findings, status 2 = glossary/config error — both actionable.
    reports.push(`[${name}]\n${`${result.stdout ?? ''}${result.stderr ?? ''}`.trim()}`);
  }
  if (reports.length === 0) return 0;

  process.stderr.write(
    `Korean audit found problems in ${abs}. Fix the errors (or justify warnings), then continue.\n${reports.join('\n\n')}\n`,
  );
  return 2;
}

process.exit(main());
