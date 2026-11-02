#!/usr/bin/env node
/**
 * Counting audit of the plugin's own instruction files.
 *
 * Every line counts one defect class over the skills, agents, commands, templates and scripts of
 * the plugin and exits non-zero while any gating line is above 0. Each class is proven by
 * `--self-test` on a planted hit and a planted miss before a 0 is trusted.
 *
 *   node scripts/skill-audit.mjs                      the table and the first findings per class
 *   node scripts/skill-audit.mjs --all                every finding
 *   node scripts/skill-audit.mjs --only <id>[,<id>]   one or more classes, every finding
 *   node scripts/skill-audit.mjs --project <dir>      also diff the `simplix` commands and flags the
 *                                                     text names against the CLI installed in <dir>
 *   node scripts/skill-audit.mjs --generator <dir>    also diff the `yo simplix:` names and flags against the
 *                                                     generator checkout <dir> (the folder holding generators/)
 *   node scripts/skill-audit.mjs --source <a,b>       also list PascalCase names in backticks that none of the
 *                                                     comma-separated source roots spells anywhere
 *   node scripts/skill-audit.mjs --json               the findings as JSON, for another tool
 *   node scripts/skill-audit.mjs --self-test          hit and miss cases for every class
 *
 * Classes marked `review` are candidates for a reader and never fail the run; the rest gate it.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, lstatSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN = resolve(HERE, "..");
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const value = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

/* ------------------------------------------------------------------ file walking */

const SKIP_DIRS = new Set(["node_modules", ".git", "dist"]);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

const isMarkdown = (p) => p.endsWith(".md");
const isText = (p) => /\.(md|mjs|js|json|hbs|sh|ya?ml)$/.test(p);

/* ------------------------------------------------------------------ text helpers */

/** Lines of a markdown file with code fences, frontmatter and quoted spans blanked out. */
function proseLines(text) {
  const lines = text.split("\n");
  const out = [];
  let fence = false;
  let frontmatter = lines[0]?.trim() === "---";
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (frontmatter) {
      if (i > 0 && raw.trim() === "---") frontmatter = false;
      out.push("");
      continue;
    }
    if (/^\s*(```|~~~)/.test(raw)) {
      fence = !fence;
      out.push("");
      continue;
    }
    out.push(fence ? "" : raw);
  }
  return out;
}

const stripQuoted = (line) =>
  line
    .replace(/`[^`]*`/g, "")
    .replace(/「[^」]*」/g, "")
    .replace(/"[^"]*"/g, "")
    .replace(/\[[^\]]*\]\([^)]*\)/g, "");

/* ------------------------------------------------------------------ per-file classes */

// The dash is built from its code point so this file never holds the character it counts.
const DASH = String.fromCharCode(0x2014);
const DASH_ESCAPE = "\\" + "u2014";
const HANGUL = /[가-힣㄰-㆏]/;
const PROJECT_TOKENS =
  /stagevoice|accesscore|smart-safety|macbookpro|\.ts\.net|e2e-admin|\/Users\/[A-Za-z]|taehwan/i;
const HISTORY =
  /\b(used to be|used to (?:be|have|read|say|call)|previously|formerly|was renamed|has been renamed|we (?:fixed|added|removed|changed|moved)|in this (?:change|round|pass)|round \d|(?:fixed|added|removed|introduced) (?:in|by|on) (?:v?\d|20\d\d)|as of 20\d\d|20\d\d-\d\d-\d\d|since v?\d+\.\d+)/i;
const COUNTED =
  /(?<!#)\b(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+)\s+(?:steps|rules|invariants|pillars|phases|checks|screens|chapters|kinds|ways|lenses|personas|censuses|categories|layers|principles|stages|items)\b/i;

/** Each class judges one line (or the file text) and returns a finding string or null. */
const FILE_CLASSES = [
  {
    id: "hangul-prose",
    gate: true,
    desc: "Hangul carrying a sentence outside backticks, quotes or code (instruction files are English)",
    files: (p) => isMarkdown(p),
    scan(text) {
      // A quotation may run across a line break, so each paragraph is judged whole and the finding
      // is reported on the first line that holds Hangul. A table cell (a locale column) is data, not a sentence.
      const found = [];
      const lines = proseLines(text);
      let start = 0;
      const flush = (end) => {
        const block = lines.slice(start, end);
        const joined = block
          .map((l) => (/^\s*\|\s*`/.test(l) ? l.split("|").filter((cell) => !HANGUL.test(cell)).join("|") : l))
          .map((l) => l.replace(/`[^`]*`/g, ""))
          .join("\n");
        const rest = stripQuoted(joined);
        if (HANGUL.test(rest)) {
          const offset = block.findIndex((l) => HANGUL.test(l));
          found.push({ line: start + Math.max(offset, 0) + 1, text: (block[Math.max(offset, 0)] ?? "").trim().slice(0, 140) });
        }
      };
      lines.forEach((line, i) => {
        if (line.trim() === "") {
          flush(i);
          start = i + 1;
        }
      });
      flush(lines.length);
      return found;
    },
    hit: "Use this when the reader asks 이렇게 하세요 for the screen.\n",
    miss: "A label reads `보기` and the title is 「새로 만들기」.\n```\n한글 in code\n```\n",
  },
  {
    id: "em-dash",
    gate: true,
    desc: "the em dash character anywhere in the plugin",
    files: (p) => isText(p),
    scan(text) {
      const found = [];
      text.split("\n").forEach((line, i) => {
        if (line.includes(DASH) || line.includes(DASH_ESCAPE)) found.push({ line: i + 1, text: line.trim().slice(0, 140) });
      });
      return found;
    },
    hit: `The folio ${DASH} the page number.\n`,
    miss: "The folio (the page number) - at the foot.\n",
  },
  {
    id: "project-token",
    gate: true,
    desc: "a project, host, account, port or user path that is true of one checkout only",
    files: (p) => isText(p) && basename(p) !== "skill-audit.mjs",
    scan(text) {
      const found = [];
      text.split("\n").forEach((line, i) => {
        if (PROJECT_TOKENS.test(line)) found.push({ line: i + 1, text: line.trim().slice(0, 140) });
      });
      return found;
    },
    hit: "Open https://host.example.ts.net/users as e2e-admin.\n",
    miss: "Open http://localhost:3000 at the port its own output prints.\n",
  },
  {
    id: "history-trace",
    gate: false,
    desc: "process, history or session traces in an instruction file (final state only)",
    files: (p) => isMarkdown(p),
    scan(text) {
      const found = [];
      proseLines(text).forEach((line, i) => {
        if (HISTORY.test(stripQuoted(line))) found.push({ line: i + 1, text: line.trim().slice(0, 140) });
      });
      return found;
    },
    hit: "This rule was added in the 2026-06-23 refactor.\n",
    miss: "The rule holds for every screen.\n",
  },
  {
    id: "counted-copy",
    gate: false,
    desc: "a count of the items a list shows (names the things instead)",
    files: (p) => isMarkdown(p),
    scan(text) {
      const found = [];
      proseLines(text).forEach((line, i) => {
        if (COUNTED.test(stripQuoted(line))) found.push({ line: i + 1, text: line.trim().slice(0, 140) });
      });
      return found;
    },
    hit: "The audit has five steps.\n",
    miss: "The audit runs the steps below, and invariant #32 rules out the old form.\n",
  },
];

/* ------------------------------------------------------------------ cross-file classes */

const POINTER_ROOTS = ["references", "scripts", "customize", "audit", "scaffold", "framework", "generator", "entity", "review", "convention"];
const POINTER = new RegExp(
  "`((?:" + POINTER_ROOTS.join("|") + ")/[A-Za-z0-9_./-]*\\.(?:md|mjs))`",
  "g",
);

function skillDirOf(file, plugin) {
  const rel = relative(plugin, file).split("/");
  return rel[0] === "skills" && rel.length > 2 ? join(plugin, "skills", rel[1]) : plugin;
}

function resolvesPointer(token, file, plugin) {
  const skillDir = skillDirOf(file, plugin);
  const bases = [dirname(file), skillDir, join(skillDir, "references"), plugin, join(plugin, "scripts")];
  for (const other of existsSync(join(plugin, "skills")) ? readdirSync(join(plugin, "skills")) : []) {
    bases.push(join(plugin, "skills", other), join(plugin, "skills", other, "references"));
  }
  return bases.some((base) => existsSync(join(base, token)));
}

function deadPointers(files, plugin) {
  const found = [];
  for (const file of files.filter(isMarkdown)) {
    const lines = proseLines(readFileSync(file, "utf8"));
    lines.forEach((line, i) => {
      for (const m of line.matchAll(POINTER)) {
        if (!resolvesPointer(m[1], file, plugin)) found.push({ file, line: i + 1, text: m[1] });
      }
    });
  }
  return found;
}

/** Invariant numbers a skill defines: `N. **` lines under its Non-Negotiable Invariants heading. */
function definedInvariants(skillMd) {
  const defined = new Set();
  let inside = false;
  for (const line of skillMd.split("\n")) {
    if (/^## /.test(line)) inside = /Non-Negotiable Invariants/i.test(line);
    const m = inside && /^(\d+)\. \*\*/.exec(line);
    if (m) defined.add(Number(m[1]));
  }
  return defined;
}

function deadInvariantCites(files, plugin) {
  const found = [];
  const bySkill = new Map();
  for (const name of existsSync(join(plugin, "skills")) ? readdirSync(join(plugin, "skills")) : []) {
    const md = join(plugin, "skills", name, "SKILL.md");
    if (existsSync(md)) bySkill.set(name, definedInvariants(readFileSync(md, "utf8")));
  }
  for (const file of files.filter(isMarkdown)) {
    const skill = relative(plugin, file).split("/")[1];
    const defined = bySkill.get(skill);
    if (!defined || defined.size === 0) continue;
    // Invariants of the other skills are cited by `simplix:<skill>` or in prose naming the skill;
    // only the file's own skill is judged here, and a citation naming another skill is skipped.
    proseLines(readFileSync(file, "utf8")).forEach((line, i) => {
      if (/frontend skill|backend skill|simplix:(frontend|backend)|handbook's|other skill/i.test(line)) return;
      for (const m of line.matchAll(/(?:invariants?\s+|\binvariant\s+)#(\d+)|\((?:see\s+)?#(\d+)\)/gi)) {
        const n = Number(m[1] ?? m[2]);
        if (!defined.has(n)) found.push({ file, line: i + 1, text: `#${n} is not defined in ${skill}/SKILL.md` });
      }
    });
  }
  return found;
}

function paragraphs(text) {
  const out = [];
  let fence = false;
  let buf = [];
  const flush = () => {
    const joined = buf.join(" ").replace(/\s+/g, " ").trim();
    if (joined.length >= 240 && !/^\|/.test(joined) && !/^(```|~~~)/.test(joined)) out.push(joined);
    buf = [];
  };
  for (const line of text.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      fence = !fence;
      flush();
      continue;
    }
    if (fence) continue;
    if (line.trim() === "") flush();
    else buf.push(line);
  }
  flush();
  return out;
}

function duplicateParagraphs(files, plugin) {
  const seen = new Map();
  for (const file of files.filter(isMarkdown)) {
    for (const p of paragraphs(readFileSync(file, "utf8"))) {
      const key = p.toLowerCase();
      const list = seen.get(key) ?? [];
      if (!list.includes(file)) list.push(file);
      seen.set(key, list);
    }
  }
  const found = [];
  for (const [key, list] of seen) {
    if (list.length > 1) found.push({ file: list[0], line: 0, text: `${key.slice(0, 90)}... also in ${list.slice(1).map((f) => relative(plugin, f)).join(", ")}` });
  }
  return found;
}

/** A reference file no SKILL.md or other reference points at is unreachable for a reader. */
function orphanReferences(files, plugin) {
  const refs = files.filter((f) => isMarkdown(f) && relative(plugin, f).split("/")[2] === "references");
  const corpus = files.filter(isMarkdown).map((f) => ({ f, t: readFileSync(f, "utf8") }));
  const found = [];
  for (const ref of refs) {
    const rel = relative(join(skillDirOf(ref, plugin), "references"), ref);
    const base = basename(ref);
    const cited = corpus.some(({ f, t }) => f !== ref && (t.includes(rel) || t.includes(`/${base}`) || t.includes(`\`${base}\``)));
    if (!cited) found.push({ file: ref, line: 0, text: "no instruction file points at this reference" });
  }
  return found;
}

/**
 * Each defined invariant is enforced by an audit rule that cites it, or its reference section
 * carries a line `Enforcement: review - <reason>` saying a machine cannot judge it.
 */
function unenforcedInvariants(files, plugin) {
  const found = [];
  const specs = [
    { skill: "frontend", script: "audit-frontend.mjs", registry: join(plugin, "skills", "frontend", "references", "audit"), sections: join(plugin, "skills", "frontend", "references", "invariants.md") },
    { skill: "backend", script: "audit-backend.mjs", registry: join(plugin, "skills", "backend", "references"), sections: join(plugin, "skills", "backend", "references") },
  ];
  for (const spec of specs) {
    const md = join(plugin, "skills", spec.skill, "SKILL.md");
    const script = join(plugin, "scripts", spec.script);
    if (!existsSync(md) || !existsSync(script)) continue;
    const defined = [...definedInvariants(readFileSync(md, "utf8"))].sort((a, b) => a - b);
    const cited = new Set();
    const ruleText = readFileSync(script, "utf8");
    for (const m of ruleText.matchAll(/invariant:\s*"([^"]*)"/g)) for (const n of m[1].matchAll(/#(\d+)/g)) cited.add(Number(n[1]));
    for (const f of walk(spec.registry).filter(isMarkdown)) {
      for (const m of readFileSync(f, "utf8").matchAll(/audit rule[^\n]*#(\d+)/gi)) cited.add(Number(m[1]));
    }
    const reviewed = new Set();
    const sectionFiles = statSync(spec.sections).isDirectory() ? walk(spec.sections).filter(isMarkdown) : [spec.sections];
    for (const f of sectionFiles) {
      const text = readFileSync(f, "utf8");
      for (const m of text.matchAll(/^## #(\d+)\b[\s\S]*?(?=^## #|$(?![\s\S]))/gm)) {
        if (/^Enforcement: review\b/m.test(m[0])) reviewed.add(Number(m[1]));
      }
    }
    for (const n of defined) {
      if (!cited.has(n) && !reviewed.has(n)) found.push({ file: md, line: 0, text: `${spec.skill} invariant #${n} has no audit rule citing it and no "Enforcement: review" line` });
    }
  }
  return found;
}

const CROSS_CLASSES = [
  {
    id: "dead-pointer",
    gate: true,
    desc: "a reference or script path the text names that does not exist",
    run: deadPointers,
  },
  {
    id: "dead-invariant",
    gate: true,
    desc: "an invariant number cited that its skill does not define",
    run: deadInvariantCites,
  },
  {
    id: "duplicate-paragraph",
    gate: false,
    desc: "the same long paragraph in two or more files (one home, a pointer elsewhere)",
    run: duplicateParagraphs,
  },
  {
    id: "orphan-reference",
    gate: true,
    desc: "a reference file nothing points at",
    run: orphanReferences,
  },
  {
    id: "unenforced-invariant",
    gate: false,
    desc: "an invariant no audit rule or registry entry cites (a rule held by prose alone)",
    run: unenforcedInvariants,
  },
];

/* ------------------------------------------------------------------ CLI drift (needs a project) */

function cliRegistry(project) {
  const run = (args) => execFileSync("pnpm", ["exec", "simplix", ...args], { cwd: project, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60000 });
  const top = run(["--help"]);
  const commands = [...top.matchAll(/^ {2}([a-z][a-z0-9-]*)\b/gm)].map((m) => m[1]).filter((c) => c !== "help");
  const registry = {};
  for (const c of commands) {
    const help = run([c, "--help"]);
    const flags = new Set([...help.matchAll(/(?:^|\s|,)(--[a-z][a-z0-9-]*)/gm)].map((m) => m[1]));
    registry[c] = flags;
  }
  return registry;
}

function cliDrift(files, registry) {
  const found = [];
  const mentioned = new Set();
  for (const file of files.filter(isMarkdown)) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const m of line.matchAll(/\bsimplix\s+([a-z][a-z0-9-]*)((?:\s+[^`|)]*)?)/g)) {
        const cmd = m[1];
        if (!/^(init|add-app|add-domain|add-module|validate|i18n-codegen|openapi|init-ui|scaffold|add-page|generated|kit-fence|meta|meta-diff|meta-info|meta-removals|check-screen|cycles|help)$/.test(cmd) && !registry[cmd]) {
          // Words after `simplix` that are not commands (the project name, the plugin name) are prose.
          if (/^(react|plugin|skill|handbook|framework|cli|config|meta|screen|project|backend|frontend|stack|ui|kit|template|templates|codegen|domain|module|package|packages|docs|sdk)$/.test(cmd)) continue;
          if (m[0].includes("`") || /`simplix\s/.test(line)) found.push({ file, line: i + 1, text: `unknown command: simplix ${cmd}` });
          continue;
        }
        if (!registry[cmd]) continue;
        mentioned.add(cmd);
        for (const f of m[2].matchAll(/(--[a-z][a-z0-9-]*)/g)) {
          mentioned.add(`${cmd} ${f[1]}`);
          if (!registry[cmd].has(f[1])) found.push({ file, line: i + 1, text: `simplix ${cmd} has no ${f[1]}` });
        }
      }
    });
  }
  const unnamed = [];
  const corpus = files.filter(isMarkdown).map((f) => readFileSync(f, "utf8")).join("\n");
  for (const [cmd, flags] of Object.entries(registry)) {
    if (!mentioned.has(cmd) && !new RegExp(`simplix\\s+${cmd}\\b`).test(corpus)) unnamed.push({ file: PLUGIN, line: 0, text: `command never named: simplix ${cmd}` });
    // A flag counts as named when the text spells it anywhere; a flag named only in another command's
    // sentence is still a pointer the reader can find.
    for (const f of flags) if (f !== "--help" && f !== "--version" && !corpus.includes(f)) unnamed.push({ file: PLUGIN, line: 0, text: `flag never named: simplix ${cmd} ${f}` });
  }
  return { drift: found, unnamed };
}


/* ------------------------------------------------------------------ yo drift (needs the generator checkout) */

function yoRegistry(dir) {
  const registry = {};
  const gens = join(dir, "generators");
  for (const name of readdirSync(gens)) {
    const index = join(gens, name, "index.js");
    if (!existsSync(index)) continue;
    const source = readFileSync(index, "utf8");
    registry[name] = new Set([...source.matchAll(/this\.option\(\s*['"]([a-z][a-z0-9-]*)['"]/g)].map((m) => `--${m[1]}`));
    // An alias generator re-exports another one and takes its options.
    const alias = /export\s*\{\s*default\s*\}\s*from\s*['"]\.\.\/([a-z-]+)\/index\.js['"]/.exec(source);
    if (alias) registry[name].aliasOf = alias[1];
  }
  for (const [name, set] of Object.entries(registry)) {
    if (set.aliasOf && registry[set.aliasOf]) for (const f of registry[set.aliasOf]) set.add(f);
  }
  return registry;
}

function yoDrift(files, registry) {
  const drift = [];
  const named = new Set();
  for (const file of files.filter(isMarkdown)) {
    readFileSync(file, "utf8").split("\n").forEach((line, i) => {
      for (const m of line.matchAll(/\byo\s+simplix:([a-z][a-z0-9-]*)((?:\s+[^`|)]*)?)/g)) {
        named.add(m[1]);
        if (!registry[m[1]]) {
          drift.push({ file, line: i + 1, text: `unknown generator: yo simplix:${m[1]}` });
          continue;
        }
        for (const f of m[2].matchAll(/(--[a-z][a-z0-9-]*)/g)) {
          if (!registry[m[1]].has(f[1])) drift.push({ file, line: i + 1, text: `yo simplix:${m[1]} has no ${f[1]}` });
        }
      }
    });
  }
  const unnamed = Object.keys(registry).filter((g) => !named.has(g)).map((g) => ({ file: PLUGIN, line: 0, text: `generator never named: yo simplix:${g}` }));
  return { drift, unnamed };
}


/* ------------------------------------------------------------------ named code symbols (needs source roots) */

const SOURCE_EXT = /\.(ts|tsx|mts|mjs|js|jsx|java|kt|hbs|json)$/;

function identifierSet(roots) {
  const known = new Set();
  const visit = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name.startsWith(".") || name === "node_modules" || name === "dist" || name === "build" || name === "target") continue;
      const path = join(dir, name);
      let st;
      try {
        st = lstatSync(path);
        if (st.isSymbolicLink()) continue;
      } catch (error) {
        if (error.code === "ENOENT") continue;
        throw error;
      }
      if (st.isDirectory()) visit(path);
      else if (SOURCE_EXT.test(name) && st.size < 2_000_000) {
        for (const m of readFileSync(path, "utf8").matchAll(/[A-Za-z_][A-Za-z0-9_]{3,}/g)) known.add(m[0]);
      }
    }
  };
  for (const root of roots) if (existsSync(root)) visit(root);
  return known;
}

/** A PascalCase compound named in backticks that no source root spells anywhere. */
function unknownSymbols(files, known) {
  const found = [];
  for (const file of files.filter(isMarkdown)) {
    proseLines(readFileSync(file, "utf8")).forEach((line, i) => {
      for (const m of line.matchAll(/`([A-Z][a-z0-9]+(?:[A-Z][a-z0-9]*)+)`/g)) {
        if (!known.has(m[1])) found.push({ file, line: i + 1, text: m[1] });
      }
    });
  }
  return found;
}

/* ------------------------------------------------------------------ run */

function collect(plugin) {
  return walk(plugin).filter((p) => isText(p));
}

function audit(plugin, options = {}) {
  const files = collect(plugin);
  const results = [];
  for (const cls of FILE_CLASSES) {
    const findings = [];
    for (const file of files.filter(cls.files)) {
      for (const f of cls.scan(readFileSync(file, "utf8"))) findings.push({ file, ...f });
    }
    results.push({ id: cls.id, gate: cls.gate, desc: cls.desc, findings });
  }
  for (const cls of CROSS_CLASSES) {
    results.push({ id: cls.id, gate: cls.gate, desc: cls.desc, findings: cls.run(files, plugin) });
  }
  if (options.registry) {
    const { drift, unnamed } = cliDrift(files, options.registry);
    results.push({ id: "cli-drift", gate: true, desc: "a simplix command or flag the text names that the installed CLI does not have", findings: drift });
    results.push({ id: "cli-unnamed", gate: false, desc: "a command or flag the installed CLI has that no instruction file names", findings: unnamed });
  }
  if (options.known) {
    results.push({ id: "unknown-symbol", gate: false, desc: "a PascalCase name in backticks that no given source root spells (a renamed or invented part)", findings: unknownSymbols(files, options.known) });
  }
  if (options.yo) {
    const { drift, unnamed } = yoDrift(files, options.yo);
    results.push({ id: "yo-drift", gate: true, desc: "a yo simplix generator or flag the text names that the installed generator does not have", findings: drift });
    results.push({ id: "yo-unnamed", gate: false, desc: "a generator the checkout has that no instruction file names", findings: unnamed });
  }
  return results;
}

/* ------------------------------------------------------------------ self-test */

function selfTest() {
  let bad = 0;
  const check = (name, ok) => {
    if (!ok) bad++;
    console.log(`  ${ok ? "ok  " : "FAIL"} ${name}`);
  };
  for (const cls of FILE_CLASSES) {
    check(`${cls.id}: hit is found`, cls.scan(cls.hit).length > 0);
    check(`${cls.id}: miss stays quiet`, cls.scan(cls.miss).length === 0);
  }
  const root = mkdtempSync(join(tmpdir(), "skill-audit-"));
  try {
    const skill = join(root, "skills", "demo");
    mkdirSync(join(skill, "references"), { recursive: true });
    mkdirSync(join(root, "scripts"), { recursive: true });
    const para = "A paragraph that repeats word for word so the duplicate check has something to find across two files at once. ".repeat(3);
    writeFileSync(join(root, "scripts", "audit-frontend.mjs"), "// rule\n{ invariant: \"#1\" }\n");
    writeFileSync(
      join(skill, "SKILL.md"),
      "## Non-Negotiable Invariants\n\n1. **One** - rule.\n2. **Two** - rule.\n\nSee `references/ok.md`, `references/missing.md` and invariant #9 and (#1).\n\n" + para + "\n",
    );
    writeFileSync(join(skill, "references", "ok.md"), "# ok\n\n" + para + "\n");
    writeFileSync(join(skill, "references", "lonely.md"), "# lonely\n");
    mkdirSync(join(skill, "references", "audit"), { recursive: true });
    const files = collect(root);
    const pointers = deadPointers(files, root);
    check("dead-pointer: hit is found", pointers.some((f) => f.text === "references/missing.md"));
    check("dead-pointer: miss stays quiet", !pointers.some((f) => f.text === "references/ok.md"));
    const cites = deadInvariantCites(files, root);
    check("dead-invariant: hit is found", cites.some((f) => f.text.startsWith("#9 ")));
    check("dead-invariant: miss stays quiet", !cites.some((f) => f.text.startsWith("#1 ")));
    check("duplicate-paragraph: hit is found", duplicateParagraphs(files, root).length === 1);
    const orphans = orphanReferences(files, root);
    check("orphan-reference: hit is found", orphans.some((f) => f.file.endsWith("lonely.md")));
    check("orphan-reference: miss stays quiet", !orphans.some((f) => f.file.endsWith("ok.md")));
    const registry = { scaffold: new Set(["--module", "--help"]) };
    writeFileSync(join(skill, "references", "cli.md"), "Run `simplix scaffold x --module m --bogus` then `simplix nonesuch y`.\n");
    const drift = cliDrift(collect(root), registry);
    check("cli-drift: unknown flag found", drift.drift.some((f) => f.text === "simplix scaffold has no --bogus"));
    check("cli-drift: known flag quiet", !drift.drift.some((f) => f.text.includes("--module")));
    check("cli-drift: unknown command found", drift.drift.some((f) => f.text === "unknown command: simplix nonesuch"));
    const yoReg = { generate: new Set(["--force"]) };
    writeFileSync(join(skill, "references", "yo.md"), "Run `yo simplix:generate X --force --bogus` and `yo simplix:nonesuch`.\n");
    const yoResult = yoDrift(collect(root), yoReg);
    check("yo-drift: unknown flag found", yoResult.drift.some((f) => f.text === "yo simplix:generate has no --bogus"));
    check("yo-drift: known flag quiet", !yoResult.drift.some((f) => f.text.includes("--force")));
    check("yo-drift: unknown generator found", yoResult.drift.some((f) => f.text === "unknown generator: yo simplix:nonesuch"));
    const fe = join(root, "skills", "frontend");
    mkdirSync(join(fe, "references"), { recursive: true });
    writeFileSync(join(fe, "SKILL.md"), "## Non-Negotiable Invariants\n\n1. **A** - a.\n2. **B** - b.\n3. **C** - c.\n4. **D** - d.\n");
    writeFileSync(
      join(fe, "references", "invariants.md"),
      "## #2 B\n\nUses Zod here.\nEnforcement: review - a person reads it.\n\n## #3 C\n\nEnforcement: review - last section of the file.\n",
    );
    const unenforced = unenforcedInvariants(collect(root), root).map((f) => f.text);
    check("unenforced-invariant: marker after a capital Z is seen", !unenforced.some((t) => t.includes("#2 ")));
    check("unenforced-invariant: marker in the last section is seen", !unenforced.some((t) => t.includes("#3 ")));
    check("unenforced-invariant: an uncited, unmarked invariant is found", unenforced.some((t) => t.includes("#4 ")));
    const symbolRoot = join(root, "src");
    mkdirSync(symbolRoot);
    writeFileSync(join(symbolRoot, "a.ts"), "export function RealWidget() {}\n");
    writeFileSync(join(skill, "references", "sym.md"), "Use `RealWidget` and `GhostWidget`.\n");
    const symbols = unknownSymbols(collect(root), identifierSet([symbolRoot]));
    check("unknown-symbol: hit is found", symbols.some((f) => f.text === "GhostWidget"));
    check("unknown-symbol: miss stays quiet", !symbols.some((f) => f.text === "RealWidget"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  console.log(bad === 0 ? "self-test: all cases pass" : `self-test: ${bad} case(s) failed`);
  process.exit(bad === 0 ? 0 : 1);
}

if (flag("--self-test")) selfTest();

const registry = value("--project") ? cliRegistry(resolve(value("--project"))) : undefined;
const yo = value("--generator") ? yoRegistry(resolve(value("--generator"))) : undefined;
const known = value("--source") ? identifierSet(value("--source").split(",").map((p) => resolve(p))) : undefined;
const results = audit(PLUGIN, { registry, yo, known });
const only = value("--only")?.split(",");
const shown = only ? results.filter((r) => only.includes(r.id)) : results;

if (flag("--json")) {
  console.log(JSON.stringify(shown.map((r) => ({ ...r, findings: r.findings.map((f) => ({ ...f, file: relative(PLUGIN, f.file) })) })), null, 2));
} else {
  console.log(`${String(shown.length).padStart(3)} classes over ${collect(PLUGIN).length} files\n`);
  for (const r of shown) {
    console.log(`${String(r.findings.length).padStart(5)}  ${r.gate ? "gate  " : "review"}  ${r.id}  ${r.desc}`);
  }
  const limit = flag("--all") || only ? Infinity : 6;
  for (const r of shown) {
    if (r.findings.length === 0) continue;
    console.log(`\n${r.id}`);
    for (const f of r.findings.slice(0, limit)) {
      console.log(`  ${relative(PLUGIN, f.file)}${f.line ? `:${f.line}` : ""}  ${f.text}`);
    }
    if (r.findings.length > limit) console.log(`  ... ${r.findings.length - limit} more (--only ${r.id})`);
  }
}

const failing = results.filter((r) => r.gate && r.findings.length > 0 && (!only || only.includes(r.id)));
if (!flag("--json")) console.log(`\ngating classes above 0: ${failing.length}`);
process.exit(failing.length === 0 ? 0 : 1);
