#!/usr/bin/env node
/**
 * PostToolUse hook: keep a board-parity walk's two shared documents honest.
 *
 * The walk survives across many sessions only because two documents hold a
 * shape no single walker may bend:
 *
 *   - the parity list holds what is LEFT. A walked frame is deleted, never
 *     marked — a list that accumulates completion markers stops answering the
 *     one question it exists to answer, and it also keeps the parked decisions
 *     the next session must read first.
 *   - the handover file holds FACTS. A walker's impressions belong in its own
 *     log, because the next walker cannot tell somebody's impression from a
 *     confirmed fact.
 *
 * Both are prose rules a tired agent talks itself out of, so they are checked
 * mechanically here.
 *
 * Scope guard: the checks run only for a project that opted in by writing
 * `.claude/board-parity-walk.json` (discovered by walking up from the edited
 * file). Every other project never sees any output from this hook.
 *
 * Exit codes: 0 = silent pass (not applicable, or clean),
 *             2 = findings reported on stderr, fed back to Claude.
 */
import {existsSync, readFileSync} from 'node:fs';
import {dirname, relative, resolve} from 'node:path';
import {CONFIG_NAME, documentPath, findParityConfig} from './parity-config.mjs';

/**
 * A completion marker is a LIST STRUCTURE, never a word.
 *
 * @remarks
 * Words meaning "done" are ordinary state names on a wireframe frame — a setup wizard's last
 * step, a checkout success screen — so matching the vocabulary would flag the list's own
 * contents. What never belongs in a list of remaining work is a checked box, a struck-through
 * item, or a tick standing where the bullet goes.
 *
 * These glyphs are matched here, never printed.
 */
const TICKS = '✔\u2713\u2705'; // U+2713 and U+2705 stay escaped: neither is in the allowed symbol set
const CHECKED_BOXES = '☑☒';

const COMPLETION_MARKERS = [
  {re: /^\s*[-*+]\s*\[[xX]\]/, what: 'a checked checkbox'},
  {re: /^\s*[-*+]\s*~~/, what: 'a struck-through item'},
  {re: new RegExp(`^\\s*[-*+]\\s*[${TICKS}]`), what: 'an item bulleted with a tick'},
  {re: new RegExp(`^\\s*[${CHECKED_BOXES}]`), what: 'a checked box glyph'},
];

/**
 * Point-of-view phrasing that turns a facts file into somebody's diary.
 *
 * @remarks
 * Quoted and code-span occurrences are skipped, because the file states its own rule by
 * quoting the very phrases it bans.
 *
 * This list is the Korean/English default. A project whose documents are written in another
 * language adds its own phrases through `narrativePhrases` in the config — the two are
 * concatenated, so the defaults keep working for the mixed-language case.
 */
const NARRATIVE_PHRASES = [
  '내가 보기',
  '이번에',
  '예전에는',
  '해 보니',
  '했었다',
  'I found',
  'we found',
  'this time',
  'used to be',
];

/** Line numbers that sit inside a fenced code block, so examples are not audited. */
function fencedLines(lines) {
  const fenced = new Set();
  let open = false;
  lines.forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) {
      open = !open;
      fenced.add(i);
      return;
    }
    if (open) fenced.add(i);
  });
  return fenced;
}

/**
 * Whether the phrase appears on this line only as quoted or code-span text.
 *
 * @remarks
 * A rule stated about a phrase is not a use of it. Both ways of marking a phrase as being
 * talked about — quotation marks and a markdown code span — are removed before the check.
 */
function onlyQuoted(line, phrase) {
  const stripped = line
    .replace(/`[^`]*`/g, '')
    .replace(/["“”'『「][^"“”'』」]*["“”'』」]/g, '');
  return !stripped.includes(phrase);
}

function auditParityList(lines, parkedSection) {
  const findings = [];
  const fenced = fencedLines(lines);
  lines.forEach((line, i) => {
    if (fenced.has(i)) return;
    for (const {re, what} of COMPLETION_MARKERS) {
      if (re.test(line)) {
        findings.push(
          `${i + 1}: [error] ${what} — a walked item is deleted, not marked. ` +
            `This list holds only what is left.`,
        );
        break;
      }
    }
  });
  if (parkedSection && !lines.some((l) => /^#{1,6}\s/.test(l) && l.includes(parkedSection))) {
    findings.push(
      `[error] the "${parkedSection}" section is missing — it is where a decision nobody ` +
        `can settle is parked, and the first thing the next session reads. Keep the heading ` +
        `even when it is empty.`,
    );
  }
  return findings;
}

function auditHandoverFile(lines, extraPhrases) {
  const findings = [];
  const fenced = fencedLines(lines);
  const phrases = [...NARRATIVE_PHRASES, ...extraPhrases];
  lines.forEach((line, i) => {
    if (fenced.has(i)) return;
    for (const phrase of phrases) {
      if (!line.includes(phrase)) continue;
      if (onlyQuoted(line, phrase)) continue;
      findings.push(
        `${i + 1}: [error] "${phrase}" — the handover file holds only what is true now. ` +
          `What the walk felt like goes in that walker's own log.`,
      );
      break;
    }
  });
  return findings;
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
  if (!filePath.toLowerCase().endsWith('.md')) return 0;

  const abs = resolve(payload.cwd || process.cwd(), filePath);
  if (!existsSync(abs)) return 0;

  const found = findParityConfig(dirname(abs));
  if (!found) return 0;
  if (found.config === null) {
    process.stderr.write(`⚠ ${CONFIG_NAME} is not valid JSON — parity-walk checks skipped.\n`);
    return 0;
  }

  const {config} = found;
  const at = (key) => documentPath(found, key);
  const lines = readFileSync(abs, 'utf8').split('\n');

  let findings = [];
  let role = null;
  if (abs === at('parityList')) {
    role = 'parity list';
    findings = auditParityList(lines, config.parkedSection);
  } else if (abs === at('handoverFile')) {
    role = 'handover file';
    const extra = Array.isArray(config.narrativePhrases)
      ? config.narrativePhrases.filter((p) => typeof p === 'string' && p.length > 0)
      : [];
    findings = auditHandoverFile(lines, extra);
  } else {
    return 0;
  }

  if (findings.length === 0) return 0;

  const rel = relative(found.root, abs);
  process.stderr.write(
    `Board-parity walk discipline violated — ${rel} (${role})\n` +
      findings.map((f) => `  ${rel}:${f}`).join('\n') +
      `\n\nThe discipline lives in the simplecore:board-parity-walk skill.\n`,
  );
  return 2;
}

process.exit(main());
