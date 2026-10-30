#!/usr/bin/env node
/**
 * Jev triage for SimpliX projects: the gate every Jev step goes through, and the two judgments
 * that earned a place in the skills.
 *
 * Usage:
 *   node "${CLAUDE_PLUGIN_ROOT}/scripts/jev-triage.mjs" check                     # is Jev configured?
 *   node "${CLAUDE_PLUGIN_ROOT}/scripts/jev-triage.mjs" catalog --root=<dir>      # locale pairs whose meaning drifts
 *   node "${CLAUDE_PLUGIN_ROOT}/scripts/jev-triage.mjs" errors --root=<backend>   # error messages that misstate their condition
 *   node "${CLAUDE_PLUGIN_ROOT}/scripts/jev-triage.mjs" --selftest                # prove the gate and both judgments
 *
 * **The gate.** Jev is configured when, after `source ~/.zshenv`, `jev-decide` is on PATH and
 * `jev-decide setup` (key presence only, no network) reports a provider whose key is present; the
 * TypeSafe route also needs `TYPESAFE_BASE_URL`, which the gateway wrapper refuses to run without.
 * When the gate fails, every subcommand prints one line naming the reason and exits 3 without
 * sending anything, so the skill step that called it is skipped and the rest of the skill runs.
 * Exit 3 is never a failure of the project.
 *
 * **What a run returns is a reading list, never a verdict.** Each item is asked in two
 * independent phrasings, and only the items both phrasings flag are printed. Each phrasing ends
 * with one statistics line (questions, answers, errors, seconds, cost). The flags are confirmed by
 * reading the item and its source before anything changes; nothing here edits a file.
 *
 * **What is sent.** `catalog` sends each key with its base-locale and other-locale text.
 * `errors` sends each message text with the ten source lines around the place that raises it.
 * Neither reads configuration, credentials or data files, and neither may be pointed at one.
 *
 * `--list` prints what would be sent, one state per line, and sends nothing; read it before the
 * first run on a project. `--json` prints the flagged items as JSON instead of lines. `--concurrency=<n>` bounds the
 * parallel calls (default 12). `--base=<locale>` names the JSON catalogue base locale (default
 * `en`); a `.properties` bundle's base is the file without a locale suffix.
 */

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { parseOptions, reportUnknown } from "./lib/cli-options.mjs";

const SKIP_EXIT = 3;
const UNIVERSAL_EXCLUDES = new Set(["node_modules", "dist", "build", ".git", ".turbo", "target", "out"]);

// ---------------------------------------------------------------------------------------------
// Gate

/**
 * Decide whether Jev is configured, the way the Jev docs detect it: the binary after
 * `source ~/.zshenv`, then `jev-decide setup` for key presence. No network call is made.
 *
 * @param {NodeJS.ProcessEnv} env the environment the check runs in (HOME decides which ~/.zshenv)
 * @returns {{ ok: true, provider: string } | { ok: false, reason: string }}
 */
export function jevGate(env = process.env) {
  const script = [
    "source ~/.zshenv >/dev/null 2>&1",
    "command -v jev-decide >/dev/null 2>&1 || { print -r -- NOBIN; exit 0 }",
    'print -r -- "BASE=${TYPESAFE_BASE_URL:+1}"',
    "jev-decide setup 2>/dev/null",
  ].join("; ");
  const r = spawnSync("zsh", ["-c", script], { env, encoding: "utf8", timeout: 20000 });
  if (r.error) return { ok: false, reason: `zsh could not run (${r.error.code ?? r.error.message})` };
  const out = r.stdout ?? "";
  if (out.startsWith("NOBIN")) return { ok: false, reason: "jev-decide is not on PATH after sourcing ~/.zshenv" };
  const base = /^BASE=1$/m.test(out);
  const jsonStart = out.indexOf("{");
  if (jsonStart < 0) return { ok: false, reason: "jev-decide setup printed no report" };
  let report;
  try {
    report = JSON.parse(out.slice(jsonStart));
  } catch (e) {
    if (!(e instanceof SyntaxError)) throw e;
    return { ok: false, reason: "jev-decide setup printed a report that is not JSON" };
  }
  const available = report?.available ?? {};
  if (available.typesafe === true && base) return { ok: true, provider: "typesafe" };
  if (available.openrouter === true) return { ok: true, provider: "openrouter" };
  if (available.typesafe === true) return { ok: false, reason: "a TypeSafe key is present but TYPESAFE_BASE_URL is not set" };
  return { ok: false, reason: "no Jev provider key is present" };
}

function skipLine(reason) {
  return `jev: not configured (${reason}); Jev step skipped, nothing sent`;
}

// ---------------------------------------------------------------------------------------------
// Readers

/** Parse a `.properties` file into key/value pairs (comments and blank lines dropped). */
export function readProperties(text) {
  const out = new Map();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("!")) continue;
    const eq = line.search(/[=:]/);
    if (eq < 0) continue;
    out.set(line.slice(0, eq).trim(), line.slice(eq + 1).trim());
  }
  return out;
}

/** Flatten a nested locale catalogue into dotted keys with string values. */
export function flattenCatalogue(obj, prefix = "", out = new Map()) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flattenCatalogue(v, key, out);
    else if (typeof v === "string") out.set(key, v);
  }
  return out;
}

function walk(dir, visit) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    if (e.code === "ENOENT" || e.code === "EACCES" || e.code === "ENOTDIR") return;
    throw e;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!UNIVERSAL_EXCLUDES.has(e.name)) walk(path.join(dir, e.name), visit);
    } else if (e.isFile()) visit(path.join(dir, e.name));
  }
}

/**
 * Every base/other locale pair under a root: `.properties` bundles (`x.properties` beside
 * `x_<locale>.properties`) and JSON catalogues (`<base>.json` beside `<locale>.json`).
 */
export function collectCatalogPairs(root, baseLocale = "en") {
  const items = [];
  const push = (file, key, base, other, locale) => {
    if (!base.trim() || !other.trim()) return;
    items.push({ id: `${path.relative(root, file)}:${key}`, key, base, other, locale });
  };
  walk(root, (file) => {
    const name = path.basename(file);
    const dir = path.dirname(file);
    const prop = /^(.+)_([a-z]{2}(?:_[A-Z]{2})?)\.properties$/.exec(name);
    if (prop) {
      const baseFile = path.join(dir, `${prop[1]}.properties`);
      if (!fs.existsSync(baseFile)) return;
      const base = readProperties(fs.readFileSync(baseFile, "utf8"));
      const other = readProperties(fs.readFileSync(file, "utf8"));
      for (const [k, v] of base) if (other.has(k)) push(file, k, v, other.get(k), prop[2]);
      return;
    }
    const json = /^([a-z]{2}(?:-[A-Z]{2})?)\.json$/.exec(name);
    if (json && json[1] !== baseLocale) {
      const baseFile = path.join(dir, `${baseLocale}.json`);
      if (!fs.existsSync(baseFile)) return;
      let base;
      let other;
      try {
        base = flattenCatalogue(JSON.parse(fs.readFileSync(baseFile, "utf8")));
        other = flattenCatalogue(JSON.parse(fs.readFileSync(file, "utf8")));
      } catch (e) {
        if (e instanceof SyntaxError) return;
        throw e;
      }
      for (const [k, v] of base) if (other.has(k)) push(file, k, v, other.get(k), json[1]);
    }
  });
  return items;
}

/**
 * Every place in `src/main/java` that names a key of a base `.properties` bundle under
 * `src/main/resources` (`"{error.x}"` or `"error.x"`), with the ten lines around it.
 */
export function collectErrorSites(root) {
  const messages = new Map();
  const javaFiles = [];
  walk(root, (file) => {
    const rel = file.split(path.sep).join("/");
    if (rel.includes("/src/main/resources/") && /\/[^/_]+\.properties$/.test(rel)) {
      for (const [k, v] of readProperties(fs.readFileSync(file, "utf8"))) if (k.includes(".")) messages.set(k, v);
    } else if (rel.includes("/src/main/java/") && rel.endsWith(".java")) javaFiles.push(file);
  });
  const sites = [];
  for (const file of javaFiles) {
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const m of line.matchAll(/"\{?([A-Za-z][\w-]*(?:\.[\w-]+)+)\}?"/g)) {
        const key = m[1];
        if (!messages.has(key)) continue;
        if (/^\s*(\*|\/\/|\/\*)/.test(line)) continue;
        if (!/\bthrow\b|Exception\(/.test(lines.slice(Math.max(0, i - 2), i + 1).join("\n"))) continue;
        const code = lines.slice(Math.max(0, i - 8), i + 2).map((l) => l.trim()).join("\n");
        sites.push({ id: `${path.relative(root, file)}:${i + 1}`, key, message: messages.get(key), code });
      }
    });
  }
  return sites;
}

// ---------------------------------------------------------------------------------------------
// The two judgments, each in two phrasings. Only an item both phrasings flag is reported.

export const JUDGMENTS = {
  catalog: {
    state: (it) => ({ message_key: it.key, base_text: it.base, translated_text: it.other, translated_locale: it.locale }),
    phrasings: [
      {
        questions: {
          drift: {
            type: "choice",
            instructions:
              "Does the translated text say the same thing as the base text? Register, politeness, sentence form (statement vs command) and word order do not count.",
            criteria: {
              same: "Same meaning; wording may differ.",
              drift:
                "The translation states a different fact, condition, number, actor, object or polarity than the base text, or drops or adds a condition or limit.",
              unclear: "Cannot tell from the texts.",
            },
          },
        },
        flagged: (a) => a.drift?.choice !== "same",
      },
      {
        questions: {
          faithful: {
            type: "noul",
            instructions:
              "The translated UI string is a translation of the base one. Answer true only if a user reading only the translation would come away with the same facts, limits and consequences as a user reading only the base text. Differences of tone and phrasing are fine.",
          },
        },
        flagged: (a) => !(a.faithful?.noul >= 0.5),
      },
    ],
    line: (it) => `${it.id}\n    base: ${it.base}\n    ${it.locale}: ${it.other}`,
  },
  errors: {
    state: (it) => ({ message: it.message, code: it.code }),
    phrasings: [
      {
        questions: {
          fit: {
            type: "choice",
            instructions:
              "The code throws an error whose user-facing message is given. Does the message describe the condition that makes this code throw?",
            criteria: {
              matches: "The message states the condition the code checks, or its consequence for the user.",
              mismatch: "The message describes a different condition than the one the code checks.",
              unclear: "The code shown does not reveal the condition.",
            },
          },
        },
        flagged: (a) => a.fit?.choice !== "matches",
      },
      {
        questions: {
          truthful: {
            type: "noul",
            instructions:
              "Answer true if a user who sees this message would correctly understand why the request was refused, given the code that raises it.",
          },
        },
        flagged: (a) => !(a.truthful?.noul >= 0.5),
      },
    ],
    line: (it) => `${it.id}  ${it.key}\n    message: ${it.message}`,
  },
};

// ---------------------------------------------------------------------------------------------
// Runner

function decideOnce(request, provider, env) {
  return new Promise((resolve) => {
    const child = spawn("zsh", ["-c", `source ~/.zshenv >/dev/null 2>&1; jev-decide decide - --provider ${provider}`], {
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => resolve({ error: e.message }));
    child.on("close", () => {
      try {
        const parsed = JSON.parse(out);
        const response = parsed.response;
        if (!response?.answers) return resolve({ error: (parsed.error ?? err ?? "no answers").toString().slice(0, 200) });
        const cost = Number(response.provider_metadata?.gateway?.cost ?? 0);
        resolve({ answers: response.answers, cost: Number.isFinite(cost) ? cost : 0 });
      } catch (e) {
        if (!(e instanceof SyntaxError)) throw e;
        resolve({ error: (err || out).slice(0, 200) });
      }
    });
    child.stdin.end(JSON.stringify(request));
  });
}

async function runPhrasing(items, judgment, phrasing, provider, env, concurrency) {
  const started = Date.now();
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await decideOnce({ state: judgment.state(items[i]), questions: phrasing.questions }, provider, env);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  const seconds = (Date.now() - started) / 1000;
  const asked = items.length * Object.keys(phrasing.questions).length;
  const answered = results.filter((r) => r.answers).length * Object.keys(phrasing.questions).length;
  const errors = results.filter((r) => r.error).length;
  const cost = results.reduce((s, r) => s + (r.cost ?? 0), 0);
  const rate = seconds > 0 ? (asked / seconds).toFixed(1) : String(asked);
  const stats = `questions ${asked} · answers ${answered} · errors ${errors} · ${seconds.toFixed(0)} s (${rate}/s) · $${cost.toFixed(4)}`;
  const flagged = new Set(results.map((r, i) => (r.answers && phrasing.flagged(r.answers) ? i : -1)).filter((i) => i >= 0));
  return { stats, flagged, errors };
}

/**
 * Ask every item both phrasings and keep what both flag.
 *
 * @returns {Promise<{ skipped: string } | { stats: string[], flagged: object[] }>}
 */
export async function triage(kind, items, { env = process.env, concurrency = 12 } = {}) {
  const gate = jevGate(env);
  if (!gate.ok) return { skipped: skipLine(gate.reason) };
  const judgment = JUDGMENTS[kind];
  const runs = [];
  for (const phrasing of judgment.phrasings) runs.push(await runPhrasing(items, judgment, phrasing, gate.provider, env, concurrency));
  const both = items.filter((_, i) => runs.every((r) => r.flagged.has(i)));
  return { stats: runs.map((r) => r.stats), flagged: both, provider: gate.provider };
}

// ---------------------------------------------------------------------------------------------
// Self-test: the gate on both forms, the skip, and each judgment against a fake jev-decide that
// answers from the item text. The fake stands outside this file in a temporary HOME, so the code
// under test is the same code a real run uses.

function makeHome({ binary, keys }) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "jev-triage-selftest-"));
  const bin = path.join(home, "bin");
  fs.mkdirSync(bin);
  const log = path.join(home, "calls.log");
  if (binary) {
    const fake = [
      "#!/bin/sh",
      `echo "$1" >> "${log}"`,
      'if [ "$1" = setup ]; then',
      `  echo '{"available":{"openrouter":false,"typesafe":${keys}}}'`,
      "  exit 0",
      "fi",
      "body=$(cat)",
      'case "$body" in',
      '  *PLANTED*) printf \'{"response":{"answers":{"drift":{"choice":"drift"},"faithful":{"noul":0.1},"fit":{"choice":"mismatch"},"truthful":{"noul":0.1}},"provider_metadata":{"gateway":{"cost":"0.00001"}}}}\' ;;',
      '  *) printf \'{"response":{"answers":{"drift":{"choice":"same"},"faithful":{"noul":0.9},"fit":{"choice":"matches"},"truthful":{"noul":0.9}},"provider_metadata":{"gateway":{"cost":"0.00001"}}}}\' ;;',
      "esac",
    ].join("\n");
    fs.writeFileSync(path.join(bin, "jev-decide"), fake, { mode: 0o755 });
  }
  const zshenv = binary
    ? `export PATH="${bin}:/usr/bin:/bin"\nexport TYPESAFE_BASE_URL="https://example.invalid"\n`
    : "";
  fs.writeFileSync(path.join(home, ".zshenv"), zshenv);
  return { home, log, env: { HOME: home, PATH: "/usr/bin:/bin" } };
}

async function selftest() {
  const failures = [];
  const expect = (name, cond) => {
    console.log(`${cond ? "✔" : "✖"} ${name}`);
    if (!cond) failures.push(name);
  };
  const homes = [];
  try {
    const hit = makeHome({ binary: true, keys: true });
    const noBinary = makeHome({ binary: false, keys: false });
    const noKey = makeHome({ binary: true, keys: false });
    homes.push(hit, noBinary, noKey);

    const g1 = jevGate(hit.env);
    expect("gate passes with the binary and a key", g1.ok && g1.provider === "typesafe");
    const g2 = jevGate(noBinary.env);
    expect("gate fails with no binary on PATH", !g2.ok && /not on PATH/.test(g2.reason));
    const g3 = jevGate(noKey.env);
    expect("gate fails with the binary but no key", !g3.ok && /no Jev provider key/.test(g3.reason));

    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "jev-triage-fixture-"));
    homes.push({ home: fixture });
    const res = path.join(fixture, "app/src/main/resources/messages");
    const java = path.join(fixture, "app/src/main/java/x");
    const loc = path.join(fixture, "web/src/locales");
    for (const d of [res, java, loc]) fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(res, "errors.properties"), "error.user.missing=User not found\nerror.file.big=PLANTED file too large\n");
    fs.writeFileSync(path.join(res, "errors_ko.properties"), "error.user.missing=사용자를 찾을 수 없습니다\n");
    fs.writeFileSync(
      path.join(java, "A.java"),
      'class A {\n  void a(Object u) {\n    if (u == null) {\n      throw new SimpliXGeneralException(ErrorCode.NOT_FOUND, "{error.user.missing}", null);\n    }\n    if (big()) throw new SimpliXGeneralException(ErrorCode.X, "{error.file.big}", null);\n  }\n}\n',
    );
    fs.writeFileSync(path.join(loc, "en.json"), JSON.stringify({ a: { ok: "Saved" }, b: "PLANTED Delete" }));
    fs.writeFileSync(path.join(loc, "ko.json"), JSON.stringify({ a: { ok: "저장했습니다" }, b: "저장" }));

    const pairs = collectCatalogPairs(fixture);
    expect("catalog reader pairs a .properties bundle and a JSON catalogue", pairs.length === 3);
    const sites = collectErrorSites(fixture);
    expect("error reader finds both throw sites with their message", sites.length === 2 && sites.every((s) => s.message));

    const skipped = await triage("catalog", pairs, { env: noKey.env });
    const calls = fs.existsSync(noKey.log) ? fs.readFileSync(noKey.log, "utf8") : "";
    expect("an unconfigured run skips with one line and sends nothing", typeof skipped.skipped === "string" && !/decide/.test(calls));

    const cat = await triage("catalog", pairs, { env: hit.env, concurrency: 2 });
    expect("catalog flags only the planted pair", cat.flagged?.length === 1 && cat.flagged[0].key === "b");
    expect("catalog prints one statistics line per phrasing", cat.stats?.length === 2 && cat.stats.every((s) => /^questions 3 · answers 3 · errors 0 ·/.test(s)));
    const err = await triage("errors", sites, { env: hit.env, concurrency: 2 });
    expect("errors flags only the planted site", err.flagged?.length === 1 && err.flagged[0].key === "error.file.big");
  } finally {
    for (const h of homes) fs.rmSync(h.home, { recursive: true, force: true });
  }
  console.log(failures.length ? `\n${failures.length} self-test case(s) failed` : "\nall self-test cases passed");
  return failures.length ? 1 : 0;
}

// ---------------------------------------------------------------------------------------------
// CLI

const OPTION_SPEC = { flags: ["--selftest", "--json", "--list"], valued: ["root", "base", "concurrency"] };

async function main() {
  const argv = process.argv.slice(2);
  const command = argv[0] && !argv[0].startsWith("--") ? argv.shift() : null;
  const { flags, values, unknown } = parseOptions(argv, OPTION_SPEC);
  if (reportUnknown(unknown, OPTION_SPEC)) return 2;
  if (flags.has("--selftest")) return selftest();
  if (command === "check") {
    const gate = jevGate();
    console.log(gate.ok ? `jev: configured (${gate.provider})` : skipLine(gate.reason));
    return gate.ok ? 0 : SKIP_EXIT;
  }
  if (command !== "catalog" && command !== "errors") {
    console.error("usage: jev-triage.mjs check | catalog --root=<dir> | errors --root=<backend> | --selftest");
    return 2;
  }
  const root = path.resolve(values.root ?? process.cwd());
  const concurrency = Number.parseInt(values.concurrency ?? "12", 10);
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    console.error(`--concurrency must be a positive integer, got ${values.concurrency}`);
    return 2;
  }
  const items = command === "catalog" ? collectCatalogPairs(root, values.base ?? "en") : collectErrorSites(root);
  if (items.length === 0) {
    console.error(`${command}: nothing to judge under ${root}`);
    return 2;
  }
  if (flags.has("--list")) {
    for (const it of items) console.log(JSON.stringify(JUDGMENTS[command].state(it)));
    console.log(`${items.length} item(s) would be sent; nothing was sent`);
    return 0;
  }
  const result = await triage(command, items, { concurrency });
  if (result.skipped) {
    console.log(result.skipped);
    return SKIP_EXIT;
  }
  if (flags.has("--json")) console.log(JSON.stringify({ stats: result.stats, flagged: result.flagged }, null, 2));
  else {
    for (const it of result.flagged) console.log(JUDGMENTS[command].line(it));
    console.log(`\n${result.flagged.length} of ${items.length} flagged by both phrasings (${result.provider}); read each before changing anything`);
    for (const s of result.stats) console.log(s);
  }
  return 0;
}

process.exitCode = await main();
