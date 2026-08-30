#!/usr/bin/env node
/**
 * Type audit of the values a catalogue's formatted placeholders receive.
 *
 * A catalogue entry written `{{count, number}}` asks i18next to run the value through
 * `Intl.NumberFormat`. Handed anything that is not a number, `Intl` coerces, and the screen
 * reads `법정 NaN`. Nothing catches it on the way: the translator's options are typed as plain
 * values, so the call type-checks; the sentence is complete, so the build is green; and the
 * defect appears only where somebody looks at that one screen in that one state.
 *
 * Two shapes produce it and neither is visible in the entry alone. A value already turned into
 * words somewhere else — an inner `t(...)`, a `toLocaleString`, a `join`, a `toFixed` — and a
 * fallback for an absent value (`?? "—"`), which is the worse of the two because it only shows
 * on the empty record. `audit-frontend.mjs` carries a regex rule,
 * `number-format-on-a-value-that-is-not-a-number`, that catches the shapes visible in the
 * expression text. It cannot catch a value that reaches the call through a local helper or a
 * variable, and in the repository this was written for that was two thirds of them: six of
 * twelve arrived as `counted(n)`, a one-line local whose name says nothing.
 *
 * So this check asks the type checker instead, which is the only thing that can decide the
 * family. It is a separate script rather than a rule because it builds a TypeScript program
 * over the whole repository, which is a different cost from the regex pass.
 *
 * Usage:
 *   node scripts/check-interpolation-types.mjs             # audits the working directory
 *   node scripts/check-interpolation-types.mjs --root=<dir>
 *   node scripts/check-interpolation-types.mjs --json
 *   node scripts/check-interpolation-types.mjs --warn-only  # report, never fail
 *
 * Exit code 1 when a formatted placeholder is handed a value the checker types as anything but
 * a number, unless --warn-only is passed.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const args = process.argv.slice(2);
const ROOT = path.resolve(args.find((a) => a.startsWith("--root="))?.slice(7) ?? process.cwd());
const asJson = args.includes("--json");
const warnOnly = args.includes("--warn-only");

// TypeScript is resolved from the project being audited, never from wherever this script is
// installed: the checker has to be the one the repository itself compiles with, or a type it
// resolves differently is a finding nobody can reproduce.
const require = createRequire(path.join(ROOT, "package.json"));
let ts;
try {
  ts = require("typescript");
} catch {
  console.error(`✖ typescript is not resolvable from ${ROOT} — install it there, or point --root at the project.`);
  process.exit(warnOnly ? 0 : 1);
}

const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8", maxBuffer: 1e9 }).trim().split("\n").filter(Boolean);

/** Every `<base key>|<placeholder>` a catalogue asks a format for, plural suffixes folded away. */
function formattedPairs() {
  const PLURAL = /_(zero|one|two|few|many|other)$/;
  const pairs = new Set();
  const walk = (o, prefix, out) => {
    for (const [k, v] of Object.entries(o)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (typeof v === "string") out.push([key, v]);
      else if (v && typeof v === "object") walk(v, key, out);
    }
    return out;
  };
  for (const f of git("ls-files", "*/locales/**/*.json", "*/locales/*.json")) {
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
    } catch {
      continue;
    }
    for (const [key, value] of walk(parsed, "", [])) {
      for (const m of value.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*,\s*[^}]*\}\}/g)) {
        pairs.add(`${key.replace(PLURAL, "")}|${m[1]}`);
      }
    }
  }
  return pairs;
}

/**
 * Whether a type is one the number formatter can accept.
 *
 * <p>`number | undefined` passes: absent is how a caller says nothing counted, and the
 * interpolation is simply not performed. A union carrying a string does not — that is the
 * `?? "—"` shape, and it is a defect precisely in the arm nobody looks at.
 */
function isNumeric(type, ts) {
  if (type.flags & (ts.TypeFlags.Number | ts.TypeFlags.NumberLiteral)) return true;
  if (type.isUnion()) {
    return type.types.every(
      (t) => isNumeric(t, ts) || t.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null),
    );
  }
  return false;
}

const pairs = formattedPairs();
const files = git(
  "ls-files",
  "modules/**/*.ts", "modules/**/*.tsx",
  "packages/**/*.ts", "packages/**/*.tsx",
  "apps/**/*.ts", "apps/**/*.tsx",
  "src/**/*.ts", "src/**/*.tsx",
).filter((f) => !f.includes("/dist/")).map((f) => path.join(ROOT, f));

const program = ts.createProgram(files, {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.ReactJSX,
  noEmit: true,
  skipLibCheck: true,
  strict: true,
});
const checker = program.getTypeChecker();

const findings = [];
let judged = 0;
let unresolved = 0;
for (const sf of program.getSourceFiles()) {
  if (sf.isDeclarationFile || !files.includes(path.resolve(sf.fileName))) continue;
  const rel = path.relative(ROOT, sf.fileName).split(path.sep).join("/");
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      node.arguments.length >= 2 &&
      ts.isStringLiteralLike(node.arguments[0]) &&
      ts.isObjectLiteralExpression(node.arguments[1])
    ) {
      const key = node.arguments[0].text;
      for (const prop of node.arguments[1].properties) {
        let name = null;
        let valueNode = null;
        if (ts.isPropertyAssignment(prop) && (ts.isIdentifier(prop.name) || ts.isStringLiteralLike(prop.name))) {
          name = prop.name.text;
          valueNode = prop.initializer;
        } else if (ts.isShorthandPropertyAssignment(prop)) {
          name = prop.name.text;
          valueNode = prop.name;
        }
        if (!name || !pairs.has(`${key}|${name}`)) continue;
        judged++;
        const type = checker.getTypeAtLocation(valueNode);
        const typeText = checker.typeToString(type);
        // An unresolved type is reported as unjudged rather than as clean: a check that cannot
        // see a value has not cleared it, and the two are indistinguishable in a count.
        if (typeText === "any" || typeText === "error") {
          unresolved++;
          continue;
        }
        if (isNumeric(type, ts)) continue;
        findings.push({
          file: rel,
          line: sf.getLineAndCharacterOfPosition(prop.getStart()) .line + 1,
          key,
          placeholder: name,
          type: typeText,
          expression: valueNode.getText().replace(/\s+/g, " ").slice(0, 80),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

if (asJson) {
  console.log(JSON.stringify({ pairs: pairs.size, judged, unresolved, findings }, null, 2));
} else {
  if (findings.length) {
    console.log("\n✖ [error] number-format-on-a-value-that-is-not-a-number — a formatted placeholder handed something that is not a number");
    console.log("  Intl.NumberFormat coerces, so the screen draws NaN. Either the caller is the thing that formats,");
    console.log("  and the placeholder goes back to {{x}}; or the catalogue should format, and the caller hands over");
    console.log("  the raw number. Never both.");
    for (const f of findings) {
      console.log(`  ${f.file}:${f.line}`);
      console.log(`    {{${f.placeholder}, …}} in "${f.key}"  ←  ${f.expression}`);
      console.log(`    type: ${f.type}`);
    }
  }
  if (unresolved) {
    console.log(`\n◐ ${unresolved} value(s) whose type the checker could not resolve — not judged, and not cleared.`);
  }
  console.log(
    `\n${pairs.size} formatted placeholder(s) declared — ${judged} call-site value(s) judged, ${findings.length} not a number.`,
  );
  if (!findings.length && !unresolved) console.log("✔ every formatted placeholder receives a number.");
}

process.exit(findings.length > 0 && !warnOnly ? 1 : 0);
