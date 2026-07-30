#!/usr/bin/env node
/**
 * SessionStart hook: detect whether the session's working directory holds a
 * SimpliX backend, a simplix-react frontend, or both, and tell Claude which
 * handbook skills bind before it touches a file.
 *
 * A repository with no SimpliX marker produces no output at all — projects
 * that do not use the stack never see this hook.
 *
 * When nothing in the project's own instruction files routes to the skills,
 * the injected context also asks Claude to offer `/simplix:init` once, so the
 * routing ends up written down instead of depending on this hook firing.
 *
 * Exit codes: 0 always. A detector failure is silent — a broken hook must not
 * be the reason a session cannot start.
 */

import { analyze } from "../scripts/detect-simplix.mjs";

function buildContext(report) {
  const lines = [];

  lines.push("SimpliX stack detected in this working directory. The `simplix` plugin's handbooks are MANDATORY gates for the matched subprojects:");
  lines.push("");
  for (const m of report.matches) {
    const where = m.dir === "." ? "this directory" : `\`${m.dir}/\``;
    lines.push(`- ${where} — ${m.kind} (${m.markers.join("; ")}) → invoke the \`simplix:${m.kind}\` skill`);
  }
  lines.push("");
  lines.push(
    "Invoke the matching skill with the Skill tool on the FIRST read, write, review, or explanation of a file in that subproject — before the first edit, not after. Once invoked in a session it does not need re-invoking.",
  );

  if (report.skills.includes("simplix:frontend-e2e")) {
    lines.push(
      "Before declaring a frontend feature complete, drive its screens in a browser under the `simplix:frontend-e2e` skill.",
    );
  }

  if (report.routedBy) {
    lines.push(`Project routing lives in \`${report.routedBy}\`; follow it where it is more specific than this note.`);
  }

  if (!report.wired) {
    const missing = [];
    if (!report.routedBy) missing.push("no CLAUDE.md or AGENTS.md routes to these skills");
    for (const m of report.matches) {
      const where = m.dir === "." ? "this directory" : `\`${m.dir}/\``;
      if (!m.skillGate) missing.push(`${where} has no skill gate armed, so an edit written from memory is not refused`);
      if (m.kind === "frontend" && !m.e2eGate) {
        missing.push(`${where} has no e2e gate armed, so a session can change screens and end without any of them being opened in a browser`);
      }
    }
    lines.push("");
    lines.push(
      `This project is only partly wired for these skills: ${missing.join("; ")}. Say this once, early in the session, in one sentence per missing piece, and offer \`/simplix:init\` — it writes the routing block and arms the gates. Then continue with the user's task. Do not write anything without being asked, and do not raise it again this session.`,
    );
  }

  return lines.join("\n");
}

function main() {
  // The SessionStart payload carries nothing this hook needs, so stdin is left
  // unread — reading it would block when the hook is run by hand from a TTY.
  let report;
  try {
    report = analyze(process.cwd());
  } catch {
    process.exit(0);
  }

  if (!report.matches.length) process.exit(0);

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: buildContext(report),
      },
    }),
  );
  process.exit(0);
}

main();
