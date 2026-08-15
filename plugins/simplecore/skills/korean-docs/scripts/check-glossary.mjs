#!/usr/bin/env node
/**
 * Korean glossary audit for Markdown/MDX documents and SVG diagrams.
 *
 * Thin CLI over the shared engine in lib/ — the write-time hook runs this
 * entry point, and l10n.mjs's `check` subcommand runs the same engine, so the
 * two report identically. Rule loading and merge semantics live in
 * lib/glossary.mjs; target resolution, content masking and the audit itself
 * live in lib/doc-audit.mjs.
 *
 * Markdown/MDX are audited as prose. SVG files are audited on the text content
 * of <text>/<tspan> elements only — markup, attributes, styles, and path data
 * are ignored — so diagram labels follow the same orthography and
 * translation-ese rules as the documents they illustrate.
 *
 * Files matching audit.localeResources are i18n resource files: they are
 * audited on the values of quoted string literals only. Keys, comments and
 * surrounding code are ignored, so the strings a user actually reads on screen
 * are held to the same standard as the documents.
 *
 * Rule sources, merged before auditing:
 *   1. The base glossary bundled with this skill (../GLOSSARY.base.md) —
 *      project-independent orthography and translation-ese rules.
 *   2. The project glossary, discovered by walking up from cwd and checking
 *      <dir>/.claude/GLOSSARY.md (default location) then <dir>/GLOSSARY.md
 *      in each directory. The directory that holds the glossary becomes the
 *      project root for path resolution.
 *
 * A project glossary customizes the base rules:
 *   - A "용어 대역표" row whose 영어 key matches a base row replaces it.
 *   - A "금지 표현" row whose 금지 pattern matches a base item replaces it.
 *   - A "화면 금지 표현" row bans a word ON SCREEN ONLY — it is applied to
 *     audit.localeResources files and to nothing else. Internal vocabulary is
 *     the case it exists for: a design document has to say "chunk" to specify
 *     chunking, and the same word on a screen is a leak of an implementation
 *     detail the product decided never to show. One table banning it
 *     everywhere makes the specification unwritable; no table at all leaves
 *     the ban as prose that no run enforces.
 *   - A "기본 규칙 예외" table disables base rules by 영어 key (whole row)
 *     or by exact pattern text (single rule).
 *
 * The project glossary may carry audit configuration in YAML front matter:
 *   ---
 *   audit:
 *     paths: [docs]              # default audit targets, relative to project root
 *     exclude: ["**\/legacy/**"]  # glob patterns removed from any scan
 *     localeResources: []        # globs of i18n resource files, audited on
 *                                # quoted string values only
 *     localeAnnotationKeys: []   # keys in those files whose values are notes
 *                                # to the maintainer rather than screen copy;
 *                                # exempt from 화면 금지 표현, audited otherwise
 *     resolvedPlaceholders: []   # '<regex over the placeholder name> => <render>'
 *                                # for placeholders a build resolves to a fixed
 *                                # string; the particle after one is judged
 *                                # against that string instead of reported
 *     untranslated: false        # true = warn about remaining English prose
 *   ---
 *
 * Usage:
 *   check-glossary.mjs [paths...]  files or directories; default = audit.paths,
 *                                  else a project-wide scan
 *   --all             project-wide scan even when audit.paths is configured
 *   --strict          warnings also fail (exit 1)
 *   --untranslated    warn about English prose lines (translation projects)
 *   --glossary <p>    use an explicit project glossary instead of discovery
 *   --no-base         skip the bundled base glossary
 *   --list-rules      print the merged rule set and exit
 *   --init            create .claude/GLOSSARY.md from the bundled template
 *
 * Exit codes: 0 = clean, 1 = violations (errors, or warnings with --strict),
 * 2 = usage or parse failure.
 */

import {fileURLToPath} from 'node:url';
import {initGlossary, runDocAudit} from './lib/doc-audit.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);

function parseArgs(argv) {
  const args = {all: false, strict: false, untranslated: false, noBase: false, listRules: false, init: false, glossary: null, paths: []};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--all') args.all = true;
    else if (a === '--strict') args.strict = true;
    else if (a === '--untranslated') args.untranslated = true;
    else if (a === '--no-base') args.noBase = true;
    else if (a === '--list-rules') args.listRules = true;
    else if (a === '--init') args.init = true;
    else if (a === '--glossary') {
      args.glossary = argv[++i];
      if (!args.glossary) throw new Error('--glossary 뒤에 경로가 필요합니다');
    } else if (a.startsWith('--')) throw new Error(`알 수 없는 플래그: ${a}`);
    else args.paths.push(a);
  }
  return args;
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.init) initGlossary(SCRIPT_PATH);
  else process.exitCode = runDocAudit(args, SCRIPT_PATH);
} catch (err) {
  console.error(String(err.message || err));
  process.exitCode = 2;
}
