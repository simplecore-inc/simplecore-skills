#!/usr/bin/env node
/**
 * Type-checks the files under the given paths of one package's program, with the package's own
 * tsconfig and TypeScript, and prints their syntactic and semantic diagnostics only.
 *
 *   node "${CLAUDE_PLUGIN_ROOT}/scripts/typecheck-paths.mjs" <packageDir> [path ...]
 *
 * Why it exists: `tsc --noEmit` reports only the syntax errors when any file of the program fails to
 * parse (a merge conflict marker another agent left in a sibling module the app imports), and skips
 * the semantic pass for every file. A run filtered to "errors not in that module" then shows nothing
 * and reads as green while a type error in the changed file goes unreported. This script asks the
 * program for the semantic diagnostics of the named files one by one, which TypeScript answers even
 * when another file of the program does not parse.
 *
 * Exit code: 0 when the named files have no diagnostic, 1 when they have some, 2 on a usage error.
 */
import { createRequire } from "node:module";
import path from "node:path";

const [packageArg, ...pathArgs] = process.argv.slice(2);
if (!packageArg) {
  console.error("usage: typecheck-paths.mjs <packageDir> [path ...]");
  process.exit(2);
}
const pkg = path.resolve(packageArg);
const ts = createRequire(path.join(pkg, "package.json"))("typescript");
// TypeScript 7 (the native compiler) ships no JavaScript compiler API, so there is no program to ask
// per file; `tsc --noEmit -p <packageDir>` is the check there.
if (!ts.sys || typeof ts.findConfigFile !== "function") {
  console.error(`typescript ${ts.version ?? "?"} resolved from ${pkg} has no compiler API; run \`tsc --noEmit -p ${packageArg}\` instead`);
  process.exit(2);
}
const prefixes = pathArgs.map((one) => path.resolve(one));
const configPath = ts.findConfigFile(pkg, ts.sys.fileExists, "tsconfig.json");
if (!configPath) {
  console.error(`no tsconfig.json at or above ${pkg}`);
  process.exit(2);
}
const parsed = ts.getParsedCommandLineOfConfigFile(configPath, {}, {
  ...ts.sys,
  onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
    console.error(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
    process.exit(2);
  },
});
const program = ts.createProgram({ rootNames: parsed.fileNames, options: { ...parsed.options, noEmit: true } });
const real = (file) => (ts.sys.realpath ? ts.sys.realpath(file) : file);

let checked = 0;
let found = 0;
for (const file of program.getSourceFiles()) {
  if (file.fileName.includes("/node_modules/")) continue;
  const at = real(file.fileName);
  if (prefixes.length > 0 && !prefixes.some((prefix) => at.startsWith(prefix) || file.fileName.startsWith(prefix))) continue;
  checked += 1;
  for (const diagnostic of [...program.getSyntacticDiagnostics(file), ...program.getSemanticDiagnostics(file)]) {
    const { line, character } = file.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
    console.log(`${path.relative(process.cwd(), file.fileName)}(${line + 1},${character + 1}): ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`);
    found += 1;
  }
}
console.log(`typecheck-paths: ${checked} file(s) checked, ${found} diagnostic(s)`);
process.exit(found > 0 ? 1 : 0);
