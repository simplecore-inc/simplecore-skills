#!/usr/bin/env node
/**
 * SessionStart hook: tell Claude which simplecore skills bind to this working directory, where
 * the project's own contents live, and which wiring is missing.
 *
 * Without this, every one of these skills depends on its description firing — which it does when
 * the user names the work in the right words, and does not when they ask for a screen. A board
 * nobody is routed to goes stale, a build or a walk nobody can find is restarted from scratch, and
 * a Korean answer written without the style baseline reads as a translation.
 *
 * A directory that matches no marker produces no output at all — projects that use none of these
 * skills never see this hook.
 *
 * Exit codes: 0 always. A detector failure is silent — a broken hook must not be the reason a
 * session cannot start.
 */

import {analyze} from '../scripts/detect-simplecore.mjs';

function buildContext(report) {
  const lines = [];
  const binds = (skill) => report.skills.includes(`simplecore:${skill}`);

  // A project can have wiring worth reporting while no skill binds — a parity walk configured
  // against a board that does not exist, for one. Say that on its own rather than announcing
  // skills that do not apply.
  if (!report.skills.length) {
    return (
      `This project has simplecore wiring that does not hold together: ${report.missing.join('; ')}. ` +
      `Say so once, early in the session, and offer \`/simplecore:init\`. Then continue with the ` +
      `user's task, and do not raise it again this session.`
    );
  }

  lines.push('simplecore skills bind to this working directory:');
  lines.push('');

  if (report.board) {
    const how =
      report.board.kind === 'built'
        ? `read \`${report.board.file}\` to find a screen, then that one screen file — NEVER the built HTML`
        : `read \`${report.board.file}\``;
    lines.push(
      `- \`${report.board.dir}/\` holds a wireframe board (${report.board.kind}) → invoke \`simplecore:wireframe-boards\` before implementing a screen from it, checking code against it, syncing it, or drawing frames. To locate a screen, ${how}.`,
    );
  }
  if (binds('board-to-app')) {
    const docs = [report.build.chapterDir, report.build.stateLedger].filter(Boolean);
    lines.push(
      `- that board is built chapter by chapter in dependency order${docs.length ? ` (\`${docs.join('`, `')}\`)` : ''} → invoke \`simplecore:board-to-app\` before building a chapter, running its persona tests, deciding what may run alongside, or resuming. The state ledger says which chapter is open; a chapter runs in a subagent, never in this context.`,
    );
  }
  if (binds('board-parity-walk')) {
    const docs = [report.parityWalk.parityList, report.parityWalk.handoverFile].filter(Boolean);
    lines.push(
      `- a board-parity walk is wired against that board${docs.length ? ` (\`${docs.join('`, `')}\`)` : ''} → invoke \`simplecore:board-parity-walk\` before starting or resuming one. It runs in a subagent per cluster, never in this context.`,
    );
  }
  if (binds('korean-docs')) {
    lines.push(
      `- this project's documents are written in Korean${report.glossary ? ` and it keeps a glossary (\`${report.glossary}\`)` : ''} → invoke \`simplecore:korean-docs\` for Korean output, ordinary answers included.`,
    );
  }

  lines.push('');
  lines.push(
    'Invoke the matching skill with the Skill tool on the FIRST task that touches its subject — before the first edit, not after. Once invoked in a session it does not need re-invoking.',
  );

  const routed = Object.values(report.routedBy);
  if (routed.length) {
    lines.push(
      `Project routing lives in \`${[...new Set(routed)].join('`, `')}\`; follow it where it is more specific than this note.`,
    );
  }

  if (report.missing.length) {
    lines.push('');
    lines.push(
      `This project is only partly wired for these skills: ${report.missing.join('; ')}. Say this once, early in the session, one short sentence per missing piece, and offer \`/simplecore:init\` — it reports what exists and writes only what is missing, showing each file first. Then continue with the user's task. Do not write anything without being asked, and do not raise it again this session.`,
    );
  }

  return lines.join('\n');
}

function main() {
  // The SessionStart payload carries nothing this hook needs, so stdin is left unread — reading
  // it would block when the hook is run by hand from a TTY.
  let report;
  try {
    report = analyze(process.cwd());
  } catch {
    process.exit(0);
  }

  if (!report.skills.length && !report.missing.length) process.exit(0);

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: buildContext(report),
      },
    }),
  );
  process.exit(0);
}

main();
