#!/usr/bin/env node
/**
 * PostToolUse hook: audit a Markdown file touched by Write/Edit against the
 * Korean glossary rules bundled with the korean-docs skill.
 *
 * Scope guard: the audit runs only when the edited file belongs to a project
 * that has a project glossary (<dir>/.claude/GLOSSARY.md or <dir>/GLOSSARY.md,
 * discovered by walking up from the file). Projects that do not opt into
 * Korean documentation standards never see any output from this hook.
 *
 * Exit codes: 0 = silent pass (not applicable, or clean),
 *             2 = findings reported on stderr, fed back to Claude.
 */
import {spawnSync} from 'node:child_process';
import {existsSync, readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {basename, dirname, extname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const AUDIT_SCRIPT = fileURLToPath(
  new URL('../skills/korean-docs/scripts/check-glossary.mjs', import.meta.url),
);
const MARKDOWN_EXTENSIONS = new Set(['.md', '.mdx', '.markdown']);

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
  if (!MARKDOWN_EXTENSIONS.has(extname(filePath).toLowerCase())) return 0;

  const abs = resolve(payload.cwd || process.cwd(), filePath);
  if (!existsSync(abs)) return 0;

  const glossary = findProjectGlossary(dirname(abs));
  if (!glossary) return 0;
  // The glossary itself contains banned forms by definition; never audit it.
  if (resolve(glossary) === abs || basename(abs) === 'GLOSSARY.md') return 0;

  // Run the audit from the file's directory so the script discovers the same
  // project glossary. process.execPath avoids PATH/.cmd-shim issues on Windows.
  const result = spawnSync(process.execPath, [AUDIT_SCRIPT, abs], {
    cwd: dirname(abs),
    encoding: 'utf8',
    timeout: 25_000,
  });

  if (result.error || result.status === null) {
    process.stderr.write(`glossary hook: audit did not run (${result.error?.message ?? 'timeout'})\n`);
    return 0; // infrastructure failure must not block the session
  }
  if (result.status === 0) return 0;

  // status 1 = violations, status 2 = glossary/config error — both actionable.
  const report = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  process.stderr.write(
    `Korean glossary audit found problems in ${abs}. Fix the errors (or justify warnings), then continue.\n${report}\n`,
  );
  return 2;
}

process.exit(main());
