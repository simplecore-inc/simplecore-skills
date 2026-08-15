#!/usr/bin/env node
// The one command line a build has. Every generic check is a subcommand here, so a project
// adds a script of its own only for what is true of that project alone.
//
//   node bta.mjs check [--range <rev-range>]   every gate against this project
//   node bta.mjs gates                          every gate against the defect it exists to catch
//   node bta.mjs doctor                         what this project declares, and what it owes
//
// The config is found by walking up from the current directory for `.claude/board-to-app.json`,
// unless `--config <path>` names one. The directory two levels above the config is the project
// root, and every declared path is resolved from there.
import { pathToFileURL } from 'node:url';
import { CORE_GATES, applies, gatesFor } from './core/gates.mjs';
import { HEADING_ROLES, SCHEMA, findConfig, loadProject } from './core/context.mjs';
import { makeBuilders, runCases, unproven } from './core/harness.mjs';
import { cases as coreCases } from './core/cases.mjs';

const argv = process.argv.slice(2);
const cmd = argv[0] ?? 'help';
const opt = (name, fallback = undefined) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};

const HELP = `board-to-app — the generic checks a build runs on
  check [--range <rev-range>]   every gate against this project (trailers: HEAD, or the range)
  gates                         every gate against the defect it exists to catch
  doctor                        what this project declares, and what it owes
common: --config <path> (default: .claude/board-to-app.json, found by walking up)`;

function context() {
  const declared = opt('config');
  const path = declared ?? findConfig();
  if (!path) {
    console.error(
      'no .claude/board-to-app.json in this directory or any above it — a build declares its paths there, and this skill never guesses one'
    );
    process.exit(2);
  }
  return loadProject(path, { range: opt('range') });
}

async function check() {
  const ctx = context();
  const { gates, disabled, projectModule } = await gatesFor(ctx);

  let total = 0;
  let skipped = 0;
  for (const gate of gates) {
    if (!applies(gate, ctx)) {
      skipped += 1;
      continue;
    }
    const findings = gate.run(ctx);
    total += findings.length;
    if (findings.length) {
      console.log(`\n✖ ${gate.id} — ${gate.title}`);
      for (const finding of findings) console.log(`   ${finding}`);
    }
  }

  for (const [id, reason] of disabled) console.log(`⚠ ${id} is off — ${reason}`);
  if (projectModule) console.log(`ℹ project gates from ${ctx.rel(projectModule)}`);
  console.log(
    total === 0
      ? `\n✔ ${gates.length - skipped} gates, nothing found${skipped ? ` (${skipped} skipped: the keys they read are not declared)` : ''}`
      : `\n${total} findings`
  );
  return total === 0;
}

async function proveGates() {
  const builders = makeBuilders();
  const collected = [];
  const registrar = {
    project: builders.project,
    add: (gate, name, ctx, shouldFire) => collected.push({ gate, name, ctx, shouldFire }),
  };

  coreCases(registrar);

  // A project's own gates are proved by the project's own cases, in the same module.
  const declaredConfig = opt('config') ?? findConfig();
  let gates = CORE_GATES;
  if (declaredConfig) {
    const ctx = loadProject(declaredConfig, {});
    const resolved = await gatesFor(ctx);
    gates = resolved.gates;
    if (resolved.projectModule && ctx.exists(resolved.projectModule)) {
      const mod = await import(pathToFileURL(resolved.projectModule).href);
      if (typeof mod.cases === 'function') mod.cases(registrar);
    }
  }

  const bad = runCases(collected, gates);
  builders.cleanup();

  const missing = unproven(collected, gates);
  if (missing.length) {
    console.log(`\n⚠ ${missing.length} gates are not fully proved — ${missing.join(', ')}`);
    console.log('   A gate lands with the case that fires and the case that stays quiet, in the same change.');
  }
  console.log(bad ? `\n✖ ${bad} of ${collected.length} cases came out the wrong way` : `\n✔ ${collected.length} cases, both directions`);
  return bad === 0 && missing.length === 0;
}

async function doctor() {
  const ctx = context();
  console.log(`config   ${ctx.configPath}`);
  console.log(`root     ${ctx.root}\n`);

  const deferrals = ctx.declared('deferredKeys');
  const owedBy = (key) => {
    if (!deferrals || typeof deferrals !== 'object' || Array.isArray(deferrals)) return null;
    const entry = deferrals[key];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    // A deferral missing either half is configGate's finding; here it is simply not a promise.
    return typeof entry.chapter === 'string' && typeof entry.whenExists === 'string' ? entry : null;
  };

  for (const [key, spec] of Object.entries(SCHEMA)) {
    const value = ctx.declared(key);
    if (value === null) {
      const owed = owedBy(key);
      if (owed && !spec.required) {
        // An absence somebody promised reads differently from one nobody owes, and an absence
        // whose subject is already on disk is being paid for right now.
        const due = typeof owed.whenExists === 'string' && ctx.exists(ctx.inRoot(owed.whenExists));
        console.log(
          due
            ? `● ${key.padEnd(18)} not declared — ${owed.whenExists} is already there, so ${owed.chapter} owes it now`
            : `◐ ${key.padEnd(18)} not declared — ${owed.chapter} declares it when ${owed.whenExists} exists`
        );
        continue;
      }
      console.log(`${spec.required ? '✖' : '○'} ${key.padEnd(18)} not declared${spec.required ? ' — required' : ''}`);
      continue;
    }
    const full = typeof value === 'string' ? value : JSON.stringify(value);
    const shown = full.length > 72 ? `${full.slice(0, 69)}…` : full;
    console.log(`✔ ${key.padEnd(18)} ${shown}`);
  }

  const headings = ctx.declared('chapterHeadings');
  const missingRoles = headings ? HEADING_ROLES.filter((r) => !headings[r]) : HEADING_ROLES;
  if (missingRoles.length) {
    console.log(`\nsections named by role only: ${missingRoles.join(', ')} — an agent that cannot find one stops and reports`);
  }

  const { gates, disabled } = await gatesFor(ctx);
  const inactive = gates.filter((g) => !applies(g, ctx)).map((g) => g.id);
  console.log(`\ngates    ${gates.length} resolved, ${gates.length - inactive.length} of them able to run here`);
  if (inactive.length) console.log(`skipped  ${inactive.join(', ')} — the keys they read are not declared`);
  for (const [id, reason] of disabled) console.log(`off      ${id} — ${reason}`);
  return true;
}

const RUN = { check, gates: proveGates, doctor };

if (cmd === 'help' || argv.includes('--help')) {
  console.log(HELP);
  process.exit(0);
}
if (!RUN[cmd]) {
  console.error(`unknown command: ${cmd}\n\n${HELP}`);
  process.exit(2);
}
process.exit((await RUN[cmd]()) ? 0 : 1);
