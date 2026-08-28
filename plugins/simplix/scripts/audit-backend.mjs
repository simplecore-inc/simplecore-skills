#!/usr/bin/env node
/**
 * Backend convention audit — machine-checkable subset of the `simplix:backend`
 * skill's Non-Negotiable Invariants.
 *
 * Run from the backend project root, or point at it with --root=<dir>.
 *
 * Usage:
 *   node "${CLAUDE_PLUGIN_ROOT}/scripts/audit-backend.mjs"             # run all rules
 *   node "${CLAUDE_PLUGIN_ROOT}/scripts/audit-backend.mjs" --errors-only
 *   node "${CLAUDE_PLUGIN_ROOT}/scripts/audit-backend.mjs" --rule=jvm-default-zone
 *   node "${CLAUDE_PLUGIN_ROOT}/scripts/audit-backend.mjs" --list      # list rules
 *   node "${CLAUDE_PLUGIN_ROOT}/scripts/audit-backend.mjs" --selftest  # prove every rule both ways
 *
 * Exit code 1 when any error-level rule has hits. "review"-level rules print
 * candidates that need human judgment and never fail the run.
 *
 * **--selftest is the half that keeps this file honest.** Every rule carries a `broken` and a
 * `fixed` sample; the selftest asserts the rule fires on the first and stays silent on the
 * second. A rule proved in one direction has not been proved — a check that can never fire is
 * indistinguishable from a clean tree, and it is the reading that a green run invites. Add no
 * rule without both samples; the selftest fails on a rule that omits either.
 *
 * **This audit reads source files.** Two facts it would like are not in the Java source: whether
 * a given searchable id is an endpoint's OWN primary key, and whether a list filter resolves
 * selections against it. The first is recovered here by reading the entity's `@Id` field and
 * matching the DTO container's name, which is exact rather than approximate. The second lives in
 * the frontend and stays out. What genuinely needs a started server — the two verification
 * requests in `review/searchable-field-patterns.md` — is not attempted here and is still run by
 * hand against the published OpenAPI document.
 *
 * Scope: a project that CONSUMES SimpliX. Pointing it at the framework's own repository reports
 * its base classes as violations — the module that defines SimpliXBaseRepository cannot extend it.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(
  process.argv.find((a) => a.startsWith("--root="))?.slice("--root=".length) ?? process.cwd(),
);
const SRC_ROOTS = ["modules", "packages", "apps", "tools"];
const EXCLUDE_DIRS = new Set(["build", "out", ".gradle", "node_modules", "generated"]);

// ---------------------------------------------------------------------------
// File collection
// ---------------------------------------------------------------------------

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (EXCLUDE_DIRS.has(e.name)) continue;
      walk(path.join(dir, e.name), out);
    } else if (e.name.endsWith(".java")) {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

function collectSources() {
  const files = [];
  for (const root of SRC_ROOTS) walk(path.join(ROOT, root), files);
  // Test sources are exempt from every invariant here (the handbook says so for logging,
  // exceptions and constructors alike), so they never enter the scan.
  return files.filter((f) => f.includes(`${path.sep}src${path.sep}main${path.sep}java${path.sep}`));
}

// ---------------------------------------------------------------------------
// Java-aware helpers
// ---------------------------------------------------------------------------

/**
 * Blank out comment and string bodies, preserving offsets and newlines.
 *
 * Without this, a JavaDoc `<pre>{@code @RequiredArgsConstructor ...}</pre>` example reads as the
 * annotation it documents, and the file that explains a convention is reported for breaking it.
 * That false positive is not hypothetical — it is the first thing this audit hit.
 */
function stripCommentsAndStrings(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === "/" && d === "/") {
      while (i < n && src[i] !== "\n") { out += " "; i++; }
    } else if (c === "/" && d === "*") {
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) { out += src[i] === "\n" ? "\n" : " "; i++; }
      out += "  "; i += 2;
    } else if (c === '"' && src.slice(i, i + 3) === '"""') {
      out += "   "; i += 3;
      while (i < n && src.slice(i, i + 3) !== '"""') { out += src[i] === "\n" ? "\n" : " "; i++; }
      out += "   "; i += 3;
    } else if (c === '"' || c === "'") {
      const quote = c;
      out += quote; i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === "\\") { out += "  "; i += 2; continue; }
        out += src[i] === "\n" ? "\n" : " "; i++;
      }
      out += quote; i++;
    } else {
      out += c; i++;
    }
  }
  return out;
}

/** Same as above but keeps string CONTENTS — for rules that read a literal (zone ids, tags). */
function stripComments(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === "/" && d === "/") {
      while (i < n && src[i] !== "\n") { out += " "; i++; }
    } else if (c === "/" && d === "*") {
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) { out += src[i] === "\n" ? "\n" : " "; i++; }
      out += "  "; i += 2;
    } else {
      out += c; i++;
    }
  }
  return out;
}

function lineHits(content, re, filter) {
  const hits = [];
  const lines = content.split("\n");
  const flags = re.flags.includes("g") ? re.flags : re.flags + "g";
  for (let i = 0; i < lines.length; i++) {
    const rx = new RegExp(re.source, flags);
    if (rx.test(lines[i]) && (!filter || filter(lines[i], lines, i))) {
      hits.push({ line: i + 1, excerpt: lines[i].trim().slice(0, 150) });
    }
  }
  return hits;
}

/**
 * True when the class is bound to non-production Spring profiles only.
 *
 * A `@Profile` that names no production profile is a class production never loads, which is the
 * handbook's "dev/test-only controller" exception stated in code rather than in a path list. It
 * is used to exempt only the rules whose defect is "a production client receives a bad response";
 * a dev controller still needs its `@PreAuthorize`, so the security rules never consult this.
 *
 * Deliberately NOT a directory or class-name check: `modules/common-dev/` and `*TestController`
 * are one project's conventions, and a rule built on them would pass silently in the next.
 */
function isDevProfileOnly(src) {
  const m = stripComments(src).match(/@Profile\(\s*(\{[^}]*\}|"[^"]*")\s*\)/);
  if (!m) return false;
  const profiles = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1].trim());
  if (!profiles.length) return false;
  // A negated profile ("!prod") is an exclusion, not a dev binding — it still loads elsewhere.
  if (profiles.some((p) => p.startsWith("!"))) return false;
  const DEV = new Set(["local", "dev", "test", "development", "it", "integration"]);
  return profiles.every((p) => DEV.has(p));
}

/**
 * Line numbers a `simplix-audit-ignore` marker suppresses for this rule.
 *
 * Shape: `// simplix-audit-ignore[<rule-id>]: <reason>` — the reason is required, because a bare
 * opt-out is how a gate quietly stops holding anything.
 *
 * The marker suppresses its own line and the whole STATEMENT that follows it — skipping the
 * comment and blank lines between, then running to the line that ends it. Two windows are wrong
 * here and both fail silently, which is why neither is used: a window of literally two lines
 * stops covering the statement the moment the reason wraps onto a second line, and a window of
 * one code line misses a wrapped statement whose flagged token sits on the continuation
 * (`ZoneId.systemDefault()` under a `return LocalDate.ofInstant(`). Both read as a marker that
 * was ignored, and send the next reader hunting a bug in the rule instead.
 *
 * Read from the RAW source: the rules match against comment-stripped text, so by the time a
 * rule runs its own suppression comment is gone.
 */
function suppressedLines(rawSrc, ruleId) {
  const out = new Set();
  const lines = rawSrc.split("\n");
  const isCommentOrBlank = (l) => !l.trim() || /^\s*(?:\/\/|\/?\*)/.test(l);
  // A statement runs to its `;`, a declaration to its `{`. Capped so a marker above something
  // unterminated cannot swallow the rest of the file.
  const MAX_STATEMENT_LINES = 12;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/simplix-audit-ignore\[([^\]]+)\]\s*:\s*(\S.*)$/);
    if (!m) continue;
    const ids = m[1].split(",").map((x) => x.trim());
    if (!ids.includes(ruleId)) continue;
    out.add(i + 1);
    let j = i + 1;
    while (j < lines.length && isCommentOrBlank(lines[j])) j++;
    for (let k = j; k < lines.length && k < j + MAX_STATEMENT_LINES; k++) {
      out.add(k + 1);
      if (/[;{]\s*$/.test(lines[k])) break;
    }
  }
  return out;
}

function isController(p) { return /Controller\.java$/.test(p); }
function isService(p) { return /Service\.java$/.test(p); }
function isRepository(p) { return /Repository\.java$/.test(p); }
function isDtoContainer(p) { return /DTOs?\.java$/.test(p); }

const MAPPING_RE = /@(?:Get|Post|Put|Delete|Patch|Request)Mapping/;

/**
 * Split a controller into endpoints: the annotation block from a mapping annotation down to the
 * method signature it decorates. Class-level `@RequestMapping` is excluded by requiring a class
 * declaration to have been seen already.
 */
function endpointsOf(clean) {
  const lines = clean.split("\n");
  const out = [];
  let sawClass = false;
  for (let i = 0; i < lines.length; i++) {
    if (/\bclass\s+\w+/.test(lines[i])) sawClass = true;
    if (!sawClass || !MAPPING_RE.test(lines[i])) continue;
    // A mapping annotation always sits at member indentation; the class-level one does not.
    if (!/^\s+@/.test(lines[i])) continue;
    const block = [];
    let j = i;
    for (; j < lines.length && j < i + 60; j++) {
      block.push(lines[j]);
      if (/^\s*(?:public|protected|private)\s/.test(lines[j])) break;
    }
    const sig = lines[j] ?? "";
    out.push({
      startLine: i + 1,
      text: block.join("\n"),
      name: (sig.match(/\s(\w+)\s*\(/) || [, "?"])[1],
      excerpt: lines[i].trim().slice(0, 120),
    });
  }
  return out;
}

/** Body of a brace-balanced block starting at the first `{` at or after `from`. */
function braceBody(src, from) {
  const i = src.indexOf("{", from);
  if (i < 0) return "";
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") { depth--; if (depth === 0) return src.slice(i, j + 1); }
  }
  return src.slice(i);
}

// --- Project-wide indexes, built once and cached -----------------------------

let _entityIdIndex = null;
/** Entity simple name -> its `@Id` field name, read from the `@Entity` classes in this project. */
function entityIdIndex(files) {
  if (_entityIdIndex) return _entityIdIndex;
  const map = new Map();
  for (const abs of files) {
    let src;
    try { src = fs.readFileSync(abs, "utf8"); } catch { continue; }
    if (!src.includes("@Entity")) continue;
    const clean = stripCommentsAndStrings(src);
    if (!/@Entity\b/.test(clean)) continue;
    const m = clean.match(/@Id\b[\s\S]{0,600}?private\s+[\w<>]+\s+(\w+)\s*;/);
    if (m) map.set(path.basename(abs, ".java"), m[1]);
  }
  _entityIdIndex = map;
  return map;
}
let _fieldIndex = null;
/**
 * Which fields each class in this repository declares, by its simple name.
 *
 * <p>Nested classes are indexed under their own simple name rather than `Outer.Inner`, because that
 * is how a mapper writes them — a DTO container's inner class is imported and used bare. Two
 * classes sharing a simple name merge, which widens what a rule reading this considers "declared on
 * both sides" and never narrows it; the rules built on it fire only when a name is on both sides
 * and skipped, so a merge can hide a defect and cannot invent one.
 *
 * @param files every Java source in the repository
 * @returns simple class name → the fields it declares
 */
function fieldIndex(files) {
  if (_fieldIndex) return _fieldIndex;
  const map = new Map();
  for (const abs of files) {
    let src;
    try { src = fs.readFileSync(abs, "utf8"); } catch { continue; }
    const clean = stripCommentsAndStrings(src);
    for (const cls of clean.matchAll(/\b(?:public |protected |private )?(?:static |final |abstract )*class\s+(\w+)/g)) {
      const body = braceBody(clean, cls.index + cls[0].length);
      if (!body) continue;
      const held = map.get(cls[1]) ?? new Set();
      // Only this class's own fields: a nested class's are indexed under its own name, and the
      // brace walk hands back the whole body including them, so the depth is checked by counting
      // the braces before each match.
      for (const f of body.matchAll(/(?:^|\n)\s{4,8}private\s+(?:final\s+)?[\w<>,\s[\]]+?\s+(\w+)\s*;/g)) {
        held.add(f[1]);
      }
      if (held.size) map.set(cls[1], held);
    }
  }
  _fieldIndex = map;
  return map;
}
/**
 * The `entity.setX(...)` calls a method body makes at its own statement level.
 *
 * <p>Only the top level: a set inside `if (dto.getX() != null)` is a guarded write, which is what a
 * batch endpoint does and is not an overwrite. The argument text travels with each one so a caller
 * can ask where the value came from.
 *
 * @param body a brace-balanced method body, braces included
 * @returns one entry per set — the field name with its first letter lowered, and the argument text
 */
function topLevelSets(body) {
  const out = [];
  let depth = 0;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (ch === "{") { depth += 1; continue; }
    if (ch === "}") { depth -= 1; continue; }
    if (depth !== 1) continue;
    const m = /^\w+\.set([A-Z]\w*)\s*\(/.exec(body.slice(i, i + 80));
    if (!m) continue;
    let j = i + m[0].length;
    let paren = 1;
    for (; j < body.length && paren > 0; j += 1) {
      if (body[j] === "(") paren += 1;
      else if (body[j] === ")") paren -= 1;
    }
    out.push({
      field: m[1][0].toLowerCase() + m[1].slice(1),
      arg: body.slice(i + m[0].length, Math.max(i + m[0].length, j - 1)),
    });
    i = j - 1;
  }
  return out;
}

/**
 * The methods a body calls at its own statement level, handing the entity to them.
 *
 * @param body a brace-balanced method body
 * @returns the called method names
 */
function topLevelEntityHelpers(body) {
  const out = new Set();
  let depth = 0;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (ch === "{") { depth += 1; continue; }
    if (ch === "}") { depth -= 1; continue; }
    if (depth !== 1) continue;
    const m = /^(?:this\.)?(\w+)\s*\(\s*entity\s*[,)]/.exec(body.slice(i, i + 60));
    if (m) out.add(m[1]);
  }
  return out;
}

let _emptyDefaultIndex = null;
/**
 * Which of each entity's String fields hold the empty string as a real value.
 *
 * <p>A column declared `nullable = false` and initialised to `""` is one where empty MEANS
 * something — 「every workplace」 for a scope key, 「no pack raised it」 for a provenance id. The
 * field is not optional and it is not blank-forbidding; it is neither, and only the entity says so.
 *
 * @param files every Java source in the project
 * @returns entity simple name → the field names it initialises to the empty string
 */
function emptyDefaultIndex(files) {
  if (_emptyDefaultIndex) return _emptyDefaultIndex;
  const map = new Map();
  for (const abs of files) {
    let src;
    try { src = fs.readFileSync(abs, "utf8"); } catch { continue; }
    if (!src.includes('""')) continue;
    // The stripper blanks a literal's CONTENTS and keeps its quotes, so `= ""` survives as
    // itself while `= "x"` becomes `= " "` — the match below therefore reads the empty default
    // and nothing that merely looks like one.
    const clean = stripCommentsAndStrings(src);
    if (!/@Entity\b/.test(clean)) continue;
    const held = new Set();
    for (const m of clean.matchAll(/private\s+String\s+(\w+)\s*=\s*""\s*;/g)) held.add(m[1]);
    if (held.size) map.set(path.basename(abs, ".java"), held);
  }
  _emptyDefaultIndex = map;
  return map;
}

let _overwriteIndex = null;
/**
 * Which fields each entity's service writes over whatever the request sent.
 *
 * <p><b>Read from the service, because that is where the decision lives.</b> A field the service
 * fills in itself — a caller forced onto the record, a state read off two dates, a name looked up
 * from an account — is one the form has no control for and no way to grow one. Nothing in the DTO
 * says so, which is exactly why the constraint on it survives review.
 *
 * <p>A set whose argument reads the field's OWN value is a normalization rather than an overwrite
 * (`entity.setCode(dto.getCode().toUpperCase())`), so the submitted value still matters and the
 * field may be required. Guarded sets are skipped for the same reason: a batch endpoint writes
 * only what the request carried.
 *
 * <p>One level of private helper is followed, because `applyDerived(entity)` at the end of a
 * `create` is where half of these actually live.
 *
 * @param files every Java source in the project
 * <p>Kept per method rather than merged. A field the CREATE path forces (the account named in the
 * path, not in the body) can still be a field the UPDATE path reads and compares — merging the two
 * reports that one as unrequirable, and it is the shape a scaffolded `UpdateDTO` takes.
 *
 * @returns entity simple name → `{ create, update, hasUpdate }` — the fields each write path
 *          overwrites, and whether the service has an update path at all
 */
function serviceOverwriteIndex(files) {
  if (_overwriteIndex) return _overwriteIndex;
  const map = new Map();
  for (const abs of files) {
    const base = path.basename(abs, ".java");
    if (!base.endsWith("Service") || /src\/test\//.test(abs)) continue;
    let src;
    try { src = fs.readFileSync(abs, "utf8"); } catch { continue; }
    const clean = stripCommentsAndStrings(src);
    const entity = base.slice(0, -"Service".length);
    const written = { create: new Set(), update: new Set(), hasUpdate: false };
    for (const method of ["create", "update"]) {
      const sig = new RegExp(`\\b(?:public|protected)\\s+[\\w<>,\\s.\\[\\]]+\\s${method}\\s*\\(`, "g");
      let m;
      while ((m = sig.exec(clean)) !== null) {
        const body = braceBody(clean, m.index + m[0].length);
        if (!body) continue;
        if (method === "update") written.hasUpdate = true;
        const bodies = [body];
        for (const helper of topLevelEntityHelpers(body)) {
          const decl = new RegExp(`\\bprivate\\s+[\\w<>,\\s.\\[\\]]+\\s${helper}\\s*\\(`).exec(clean);
          if (decl) bodies.push(braceBody(clean, decl.index + decl[0].length));
        }
        for (const b of bodies) {
          for (const set of topLevelSets(b)) {
            const own = new RegExp(`\\bget${set.field[0].toUpperCase()}${set.field.slice(1)}\\s*\\(`);
            if (own.test(set.arg)) continue;
            written[method].add(set.field);
          }
        }
      }
    }
    if (written.create.size || written.update.size) map.set(entity, written);
  }
  _overwriteIndex = map;
  return map;
}

let _i18nIndex = null;
/**
 * Which field names carry a `<name>I18n` translation map, and which DTO classes declare one.
 *
 * <p>A value edited through its own screen lives in a locale map while the plain column keeps
 * whatever it was seeded with. A DTO that declares the map is serialized through the framework's
 * `@I18nTrans` and needs nothing; one assembled by hand has to resolve the map itself, and reading
 * the column instead answers every caller in the seed's language.
 *
 * @param files every Java source in the project
 * @returns `entityBases` — entity class simple name to the base names IT declares the map for,
 *          kept per class because two entities sharing a field name do not share its translation;
 *          `dtoCarries` — DTO class simple name to the base names that class declares the map for
 */
function i18nIndex(files) {
  if (_i18nIndex) return _i18nIndex;
  const entityBases = new Map();
  const dtoCarries = new Map();
  const FIELD = /private\s+Map<\s*String\s*,\s*String\s*>\s+(\w+)I18n\s*;/g;
  for (const abs of files) {
    let src;
    try { src = fs.readFileSync(abs, "utf8"); } catch { continue; }
    if (!src.includes("I18n")) continue;
    const clean = stripCommentsAndStrings(src);
    if (/@Entity\b/.test(clean)) {
      const bases = new Set([...clean.matchAll(FIELD)].map((m) => m[1]));
      if (bases.size) entityBases.set(path.basename(abs, ".java"), bases);
      continue;
    }
    // Split the container into its nested classes, so one DTO declaring the map does not exempt
    // its neighbours in the same file.
    const parts = clean.split(/\bclass\s+(\w+)/);
    for (let i = 1; i < parts.length; i += 2) {
      const name = parts[i];
      const body = parts[i + 1] ?? "";
      const bases = new Set([...body.matchAll(FIELD)].map((m) => m[1]));
      if (bases.size) dtoCarries.set(name, bases);
    }
  }
  _i18nIndex = { entityBases, dtoCarries };
  return _i18nIndex;
}

function resetIndexes() { _entityIdIndex = null; _i18nIndex = null; }

// ---------------------------------------------------------------------------
// Rules
//
// Each rule: { id, invariant, level, desc, appliesTo(relPath), check(content, relPath, ctx),
//              samples: { broken, fixed, file } }
// `samples.file` is the pretend relative path both samples are checked under, so `appliesTo`
// takes part in the proof rather than being assumed.
// ---------------------------------------------------------------------------

const RULES = [
  {
    id: "not-blank-on-a-meaningfully-empty-field",
    invariant: "#5 / frontend #34",
    level: "error",
    desc: "A create/update DTO field carrying `@NotBlank` whose entity counterpart is a non-null column initialised to `\"\"` — the empty string is one of that field's values, not the absence of one. A scope key whose empty case means 「the whole installation」 is the shape this takes, and the constraint then refuses every write of exactly those records while every workplace-scoped one saves: the screen works on some rows and not others, and the refusal names a field no form draws. `@NotNull` is the constraint that was meant — the column still refuses null",
    appliesTo: (p) => /DTOs?\.java$/.test(p) && !/src\/test\//.test(p),
    check: (c, file, ctx) => {
      const defaults = ctx?.emptyDefaults;
      if (!defaults || defaults.size === 0) return [];
      const clean = stripCommentsAndStrings(c);
      const hits = [];
      for (const cls of clean.matchAll(/\bclass\s+(\w+?)(Create|Update|BatchUpdate)DTO\b/g)) {
        const empties = defaults.get(cls[1]);
        if (!empties) continue;
        const body = braceBody(clean, cls.index + cls[0].length);
        if (!body) continue;
        for (const f of body.matchAll(/@NotBlank\b([\s\S]{0,300}?)private\s+String\s+(\w+)\s*;/g)) {
          if (/\bprivate\b/.test(f[1])) continue;
          if (!empties.has(f[2])) continue;
          const at = clean.indexOf(f[0], cls.index);
          const line = clean.slice(0, at < 0 ? cls.index : at).split("\n").length;
          hits.push({
            line,
            excerpt: `${cls[1]}${cls[2]}DTO.${f[2]} is @NotBlank and ${cls[1]}.${f[2]} defaults to ""`,
          });
        }
      }
      return hits;
    },
    samples: {
      file: "modules/<module>/src/main/java/<pkg>/web/<feature>/dto/ThingDTOs.java",
      ctx: { emptyDefaults: new Map([["Thing", new Set(["siteKey"])]]) },
      broken: `public class ThingDTOs {

    @Data
    public static class ThingCreateDTO {

        @Schema(description = "The workplace, empty for the whole installation")
        @FieldLabel("{entities.Thing.siteKey}")
        @NotBlank
        @Length(max = 36)
        private String siteKey;
    }
}`,
      fixed: `public class ThingDTOs {

    @Data
    public static class ThingCreateDTO {

        @Schema(description = "The workplace, empty for the whole installation")
        @FieldLabel("{entities.Thing.siteKey}")
        @NotNull
        @Length(max = 36)
        private String siteKey;
    }
}`,
      miss: [
        {
          note: "a required field whose entity has no empty default — blank really is absent there",
          ctx: { emptyDefaults: new Map([["Thing", new Set(["siteKey"])]]) },
          source: `public class ThingDTOs {

    @Data
    public static class ThingCreateDTO {

        @NotBlank
        private String label;
    }
}`,
        },
        {
          note: "a search DTO, which bean validation never refuses",
          ctx: { emptyDefaults: new Map([["Thing", new Set(["siteKey"])]]) },
          source: `public class ThingDTOs {

    @Getter
    @Setter
    public static class ThingSearchDTO {

        @NotBlank
        private String siteKey;
    }
}`,
        },
      ],
    },
  },
  {
    id: "required-field-the-service-overwrites",
    invariant: "#5 / frontend #34",
    level: "error",
    desc: "A create/update DTO field carrying `@NotNull` or `@NotBlank` that the entity's own service writes over whatever the request sent — the caller forced onto the record, a state read off the dates, a name looked up from an account. Bean validation runs BEFORE the service is entered, so the constraint refuses every request the form can send while the field it names has no control on the screen and cannot grow one: the reader is told to correct something that is not there. It typechecks, it passes the service's own unit tests (they call the service directly and never meet validation), and the save can never succeed. Drop the constraint — the field stays, tolerated and ignored, and the service's tests keep proving it is overwritten",
    appliesTo: (p) => /DTOs?\.java$/.test(p) && !/src\/test\//.test(p),
    check: (c, file, ctx) => {
      const overwrites = ctx?.overwrites;
      if (!overwrites || overwrites.size === 0) return [];
      const clean = stripCommentsAndStrings(c);
      const hits = [];
      for (const cls of clean.matchAll(/\bclass\s+(\w+?)(Create|Update)DTO\b/g)) {
        const paths = overwrites.get(cls[1]);
        if (!paths) continue;
        // A field declared on the CREATE DTO is inherited by the update body, so it is only
        // unrequirable when BOTH write paths overwrite it — one that create forces and update
        // reads is a field the request still decides.
        const written = cls[2] === "Update"
          ? paths.update
          : paths.hasUpdate
            ? new Set([...paths.create].filter((f) => paths.update.has(f)))
            : paths.create;
        if (written.size === 0) continue;
        const body = braceBody(clean, cls.index + cls[0].length);
        if (!body) continue;
        // The annotation and the field it sits above, with whatever else stands between them.
        for (const f of body.matchAll(/@(NotNull|NotBlank)\b([\s\S]{0,300}?)private\s+[\w<>,\s[\]]+?\s+(\w+)\s*;/g)) {
          // Only the field directly under the annotation: anything with its own `private` in
          // between belongs to a later field the annotation does not reach.
          if (/\bprivate\b/.test(f[2])) continue;
          if (!written.has(f[3])) continue;
          const at = clean.indexOf(f[0], cls.index);
          const line = clean.slice(0, at < 0 ? cls.index : at).split("\n").length;
          hits.push({
            line,
            excerpt: `${cls[1]}${cls[2]}DTO.${f[3]} is @${f[1]} and ${cls[1]}Service writes over it`,
          });
        }
      }
      return hits;
    },
    ctxSample: undefined,
    samples: {
      file: "modules/<module>/src/main/java/<pkg>/web/<feature>/dto/ThingDTOs.java",
      ctx: { overwrites: new Map([["Thing", { create: new Set(["ownerId", "thingStatus"]), update: new Set(["ownerId", "thingStatus"]), hasUpdate: true }]]) },
      broken: `public class ThingDTOs {

    @Data
    public static class ThingCreateDTO {

        @Schema(description = "Whose it is")
        @FieldLabel("{entities.Thing.ownerId}")
        @NotBlank
        @Length(max = 36)
        private String ownerId;

        @Schema(description = "What it is called")
        @FieldLabel("{entities.Thing.label}")
        @NotBlank
        @Length(max = 200)
        private String label;
    }
}`,
      fixed: `public class ThingDTOs {

    @Data
    public static class ThingCreateDTO {

        // Server-owned: forced to the caller, so a value sent here is ignored.
        @Schema(description = "Whose it is")
        @FieldLabel("{entities.Thing.ownerId}")
        @Length(max = 36)
        private String ownerId;

        @Schema(description = "What it is called")
        @FieldLabel("{entities.Thing.label}")
        @NotBlank
        @Length(max = 200)
        private String label;
    }
}`,
      miss: [
        {
          note: "a required field the service normalizes from its own submitted value",
          ctx: { overwrites: new Map([["Thing", { create: new Set(["label"]), update: new Set(["label"]), hasUpdate: true }]]) },
          source: `public class ThingDTOs {

    @Data
    public static class ThingCreateDTO {

        @NotBlank
        private String otherField;
    }
}`,
        },
        {
          note: "an entity whose service overwrites nothing",
          ctx: { overwrites: new Map() },
          source: `public class ThingDTOs {

    @Data
    public static class ThingCreateDTO {

        @NotBlank
        private String ownerId;
    }
}`,
        },
        {
          note: "an id the CREATE path takes from the URL and the UPDATE path reads and compares — found as a false positive in a real repository, which is why the index keeps the two write paths apart",
          ctx: { overwrites: new Map([["Thing", { create: new Set(["ownerId"]), update: new Set(), hasUpdate: true }]]) },
          source: `public class ThingDTOs {

    @Data
    @EqualsAndHashCode(callSuper = true)
    public static class ThingUpdateDTO extends ThingCreateDTO {

        @NotBlank(message = "ID is required")
        private String ownerId;
    }
}`,
        },
        {
          note: "a search DTO, which bean validation never refuses",
          ctx: { overwrites: new Map([["Thing", { create: new Set(["ownerId"]), update: new Set(["ownerId"]), hasUpdate: true }]]) },
          source: `public class ThingDTOs {

    @Getter
    @Setter
    public static class ThingSearchDTO {

        @NotBlank
        private String ownerId;
    }
}`,
        },
      ],
    },
  },
  {
    id: "empty-page-with-no-pageable",
    invariant: "#1 / #15\u2462",
    level: "error",
    desc: "`new PageImpl<>(List.of())` \u2014 a Page built with no `Pageable`. The one-argument constructor fills in `Pageable.unpaged()`, whose `getPageNumber()` and `getPageSize()` THROW `UnsupportedOperationException`, so Jackson cannot serialize the response and the caller gets a 500 where the screen was expecting an empty list. The branch that builds it is the early return for 「this caller has nothing」, which is exactly the path nobody exercises while developing against seeded data and every new account takes on its first request. Pass the request being answered \u2014 `new PageImpl<>(List.of(), pageRequest, 0)`",
    appliesTo: (p) => /\.java$/.test(p) && !/src\/test\//.test(p),
    check: (c) => {
      const clean = stripCommentsAndStrings(c);
      const hits = [];
      // One argument only. `new PageImpl<>(rows, request, total)` is the correct shape and the
      // two-argument form carries a Pageable too, so both stay silent.
      const call = /\bnew\s+PageImpl\s*<[^>]*>\s*\(/g;
      let m;
      while ((m = call.exec(clean)) !== null) {
        let depth = 1;
        let i = m.index + m[0].length;
        let commas = 0;
        for (; i < clean.length && depth > 0; i += 1) {
          const ch = clean[i];
          if (ch === "(" || ch === "[" || ch === "{" || ch === "<") depth += 1;
          else if (ch === ")" || ch === "]" || ch === "}" || ch === ">") depth -= 1;
          else if (ch === "," && depth === 1) commas += 1;
        }
        if (commas > 0) continue;
        const line = clean.slice(0, m.index).split("\n").length;
        hits.push({ line, excerpt: (c.split("\n")[line - 1] ?? "").trim() });
      }
      return hits;
    },
    samples: {
      file: "modules/<module>/src/main/java/<pkg>/web/<feature>/ThingService.java",
      broken: `public Page<ThingListDTO> search(Map<String, String> params) {
    List<String> mine = things.findIdsFor(currentUserId());
    if (mine.isEmpty()) {
        return new PageImpl<>(List.of());
    }
    return findAllWithSearch(parse(params), ThingListDTO.class);
}`,
      fixed: `public Page<ThingListDTO> search(Map<String, String> params) {
    SearchCondition<ThingSearchDTO> condition = parse(params);
    List<String> mine = things.findIdsFor(currentUserId());
    if (mine.isEmpty()) {
        return new PageImpl<>(List.of(), PageRequest.of(condition.getPage(), condition.getSize()), 0);
    }
    return findAllWithSearch(condition, ThingListDTO.class);
}`,
      miss: [
        {
          note: "the three-argument form, which carries the request it answers",
          source: `return new PageImpl<>(read.rows(), request, read.totalRows());`,
        },
        {
          note: "an empty page that still carries its request",
          source: `return new PageImpl<>(List.of(), request, request.getOffset());`,
        },
        {
          note: "a generic argument holding a comma, which is not a second constructor argument",
          source: `return new PageImpl<Map<String, String>>(rows, PageRequest.of(0, 10), 1);`,
        },
      ],
    },
  },
  {
    id: "i18n-label-read-from-column",
    invariant: "#36",
    level: "error",
    desc: "A hand-assembled DTO takes its name from the plain column while the entity carries a `<name>I18n` map — the caller is answered in the language the record was seeded in, whatever language they asked for. Resolve the map (the project's `LocalizedNames.pick`-style helper), or declare the map on the DTO and let `@I18nTrans` serialize it",
    appliesTo: (p) => /\.java$/.test(p) && !isDtoContainer(p),
    check: (c, _rel, ctx) => {
      const index = ctx?.i18n;
      if (!index || !index.entityBases.size) return [];
      const clean = stripCommentsAndStrings(c);
      // What each local was constructed as, so the target's own type decides the exemption.
      const declared = new Map();
      for (const m of clean.matchAll(/\b(\w+DTO)\s+(\w+)\s*=\s*new\s+\1\s*\(/g)) declared.set(m[2], m[1]);
      if (!declared.size) return [];
      // The SOURCE's own type decides whether that field is translated at all — two entities can
      // share a field name while only one of them keeps a map for it, and a rule keyed on the name
      // alone rewrites the other into a call that does not compile.
      const typeOf = (name) => {
        const d = clean.match(new RegExp(`\\b([A-Z]\\w*)(?:<[^>]*>)?\\s+${name}\\s*(?:=|:|\\)|,)`));
        return d?.[1];
      };
      const hits = [];
      for (const m of clean.matchAll(/\b(\w+)\.set(\w+)\(\s*(\w+)\.get(\w+)\(\)\s*\)/g)) {
        const [, target, setter, source, getter] = m;
        const type = declared.get(target);
        if (!type) continue;
        const sourceType = typeOf(source);
        const sourceBase = getter[0].toLowerCase() + getter.slice(1);
        if (!sourceType || !index.entityBases.get(sourceType)?.has(sourceBase)) continue;
        const targetBase = setter[0].toLowerCase() + setter.slice(1);
        if (index.dtoCarries.get(type)?.has(targetBase)) continue;
        hits.push({
          line: clean.slice(0, m.index).split("\n").length,
          excerpt: `${target}.set${setter}(${source}.get${getter}()) — ${type} does not declare ${targetBase}I18n, and ${sourceType} keeps ${sourceBase}I18n`,
        });
      }
      return hits;
    },
    ctxSample: {
      entityBases: new Map([["OrgType", new Set(["label"])]]),
      dtoCarries: new Map([["CarryingDTO", new Set(["label"])]]),
    },
    samples: {
      file: "modules/org/src/main/java/app/web/org/service/OrgTypeReadService.java",
      broken: `public class OrgTypeReadService {
    public OrgTypeDTO one(OrgType type) {
        OrgTypeDTO dto = new OrgTypeDTO();
        dto.setLabel(type.getLabel());
        return dto;
    }
}`,
      fixed: `public class OrgTypeReadService {
    public OrgTypeDTO one(OrgType type) {
        OrgTypeDTO dto = new OrgTypeDTO();
        dto.setLabel(LocalizedNames.pick(type.getLabelI18n(), type.getLabel()));
        return dto;
    }
}`,
    },
  },
  {
    id: "endpoint-without-preauthorize",
    invariant: "#2",
    level: "error",
    desc: "Endpoint carries no @PreAuthorize — the method is reachable by anyone the filter chain lets through. Public is written `permitAll()` and user-self `isAuthenticated()`; an absent annotation says neither, and a dev/test profile is not a substitute",
    appliesTo: isController,
    check: (c) => {
      const clean = stripCommentsAndStrings(c);
      if (!/@RestController/.test(clean)) return [];
      return endpointsOf(clean)
        .filter((e) => !/@PreAuthorize/.test(e.text))
        .map((e) => ({ line: e.startLine, excerpt: `${e.name}() — ${e.excerpt}` }));
    },
    samples: {
      file: "modules/site/src/main/java/app/web/site/controller/AreaRestController.java",
      broken: `@RestController
public class AreaRestController {
    @GetMapping("/{areaId}")
    @Operation(summary = "Get", description = "Get one")
    public SimpliXApiResponse<AreaDetailDTO> get(@PathVariable String areaId) { return null; }
}`,
      fixed: `@RestController
public class AreaRestController {
    @GetMapping("/{areaId}")
    @Operation(summary = "Get", description = "Get one")
    @PreAuthorize("hasPermission('SAFETY_SITE', 'view')")
    public SimpliXApiResponse<AreaDetailDTO> get(@PathVariable String areaId) { return null; }
}`,
    },
  },
  {
    id: "endpoint-without-operation",
    invariant: "#11",
    level: "error",
    desc: "Endpoint carries no @Operation — it reaches the OpenAPI document with no summary, and the frontend's generated client names it from the path",
    appliesTo: isController,
    check: (c) => {
      const clean = stripCommentsAndStrings(c);
      if (!/@RestController/.test(clean)) return [];
      return endpointsOf(clean)
        .filter((e) => !/@Operation/.test(e.text))
        .map((e) => ({ line: e.startLine, excerpt: `${e.name}() — ${e.excerpt}` }));
    },
    samples: {
      file: "modules/site/src/main/java/app/web/site/controller/AreaRestController.java",
      broken: `@RestController
public class AreaRestController {
    @GetMapping("/{areaId}")
    @PreAuthorize("hasPermission('SAFETY_SITE', 'view')")
    public SimpliXApiResponse<AreaDetailDTO> get(@PathVariable String areaId) { return null; }
}`,
      fixed: `@RestController
public class AreaRestController {
    @GetMapping("/{areaId}")
    @Operation(summary = "Get Area", description = "Retrieves Area by ID")
    @PreAuthorize("hasPermission('SAFETY_SITE', 'view')")
    public SimpliXApiResponse<AreaDetailDTO> get(@PathVariable String areaId) { return null; }
}`,
    },
  },
  {
    id: "endpoint-annotation-order",
    invariant: "#17b",
    level: "error",
    desc: "Endpoint annotations are out of order — the shape is @XxxMapping → @Operation → (@SimpliXStandardApi) → @PreAuthorize. Order is how a reader finds the guard without reading the method",
    appliesTo: isController,
    check: (c) => {
      const clean = stripCommentsAndStrings(c);
      if (!/@RestController/.test(clean)) return [];
      const out = [];
      for (const e of endpointsOf(clean)) {
        const iMap = e.text.search(MAPPING_RE);
        const iOp = e.text.indexOf("@Operation");
        const iPre = e.text.indexOf("@PreAuthorize");
        if (iOp < 0 || iPre < 0) continue; // absence is the two rules above, not this one
        if (!(iMap < iOp && iOp < iPre)) {
          out.push({ line: e.startLine, excerpt: `${e.name}() — mapping/@Operation/@PreAuthorize out of order` });
        }
      }
      return out;
    },
    samples: {
      file: "modules/site/src/main/java/app/web/site/controller/AreaRestController.java",
      broken: `@RestController
public class AreaRestController {
    @GetMapping("/{areaId}")
    @PreAuthorize("hasPermission('SAFETY_SITE', 'view')")
    @Operation(summary = "Get Area", description = "Retrieves Area by ID")
    public SimpliXApiResponse<AreaDetailDTO> get(@PathVariable String areaId) { return null; }
}`,
      fixed: `@RestController
public class AreaRestController {
    @GetMapping("/{areaId}")
    @Operation(summary = "Get Area", description = "Retrieves Area by ID")
    @PreAuthorize("hasPermission('SAFETY_SITE', 'view')")
    public SimpliXApiResponse<AreaDetailDTO> get(@PathVariable String areaId) { return null; }
}`,
    },
  },
  {
    id: "permission-target-not-group",
    invariant: "#9",
    level: "error",
    desc: "hasPermission target is not an UPPER_SNAKE feature-area group — a per-entity PascalCase target splits one feature area into as many permissions as it has tables, and none of them is the one an administrator was granted",
    appliesTo: isController,
    check: (c) =>
      lineHits(stripComments(c), /hasPermission\(\s*'([^']+)'/, (line) => {
        const targets = [...line.matchAll(/hasPermission\(\s*'([^']+)'/g)].map((m) => m[1]);
        return targets.some((t) => !/^[A-Z][A-Z0-9_]*$/.test(t));
      }),
    samples: {
      file: "modules/site/src/main/java/app/web/site/controller/AreaRestController.java",
      broken: `    @PreAuthorize("hasPermission('Area', 'view')")`,
      fixed: `    @PreAuthorize("hasPermission('SAFETY_SITE', 'view')")`,
    },
  },
  {
    id: "permission-action-unknown",
    invariant: "#9",
    level: "error",
    desc: "hasPermission action is not one the evaluator resolves — only list/view/create/edit/delete/export/import/approve/manage can ever be granted, so any other verb is a permission nobody can hold and an endpoint nobody can reach",
    appliesTo: isController,
    check: (c) => {
      const ACTIONS = new Set(["list", "view", "create", "edit", "delete", "export", "import", "approve", "manage"]);
      return lineHits(stripComments(c), /hasPermission\(\s*'[^']+'\s*,\s*'([^']+)'/, (line) => {
        const acts = [...line.matchAll(/hasPermission\(\s*'[^']+'\s*,\s*'([^']+)'/g)].map((m) => m[1]);
        return acts.some((a) => !ACTIONS.has(a));
      });
    },
    samples: {
      file: "modules/site/src/main/java/app/web/site/controller/AreaRestController.java",
      broken: `    @PreAuthorize("hasPermission('SAFETY_SITE', 'revoke')")`,
      fixed: `    @PreAuthorize("hasPermission('SAFETY_SITE', 'manage')")`,
    },
  },
  {
    id: "tag-java-package-namespace",
    invariant: "#10",
    level: "error",
    desc: "@Tag name is built from the Java package instead of the domain — the OpenAPI namespace then leaks the base package, and the frontend's generated client is grouped by folder rather than by subject",
    appliesTo: isController,
    check: (c) =>
      lineHits(stripComments(c), /@Tag\(\s*name\s*=\s*"([^"]+)"/, (line) => {
        const m = line.match(/@Tag\(\s*name\s*=\s*"([^"]+)"/);
        return !!m && /(^|\.)(web|controller|rest|dto|service)(\.|$)/.test(m[1]);
      }),
    samples: {
      file: "modules/site/src/main/java/app/web/site/controller/AreaRestController.java",
      broken: `@Tag(name = "app.web.site.Area", description = "Areas")`,
      fixed: `@Tag(name = "site.Area", description = "Areas")`,
    },
  },
  {
    id: "api-v1-prefix-on-mapping",
    invariant: "#17c",
    level: "error",
    desc: "@RequestMapping carries an /api/v1/ prefix — the servlet context already supplies it, so the endpoint lands at /api/v1/api/v1/... and every generated client calls an address that is not there",
    appliesTo: isController,
    check: (c) => lineHits(stripComments(c), /@RequestMapping\(\s*"[^"]*\/api\/v\d+\//),
    samples: {
      file: "modules/site/src/main/java/app/web/site/controller/AreaRestController.java",
      broken: `@RequestMapping("/api/v1/admin/area")`,
      fixed: `@RequestMapping("/admin/area")`,
    },
  },
  {
    id: "path-variable-not-string",
    invariant: "#17e",
    level: "error",
    desc: "@PathVariable is typed something other than String — every entity id in this stack is a UUID v7 stored as VARCHAR, and a UUID/Long parameter refuses ids the database accepts",
    appliesTo: isController,
    check: (c) =>
      lineHits(stripCommentsAndStrings(c), /@PathVariable(?:\([^)]*\))?\s+(?:final\s+)?([A-Za-z][\w.]*)\s+\w+/, (line) => {
        const m = line.match(/@PathVariable(?:\([^)]*\))?\s+(?:final\s+)?([A-Za-z][\w.]*)\s+\w+/);
        return !!m && m[1] !== "String";
      }),
    samples: {
      file: "modules/site/src/main/java/app/web/site/controller/AreaRestController.java",
      broken: `    public SimpliXApiResponse<AreaDetailDTO> get(@PathVariable UUID areaId) { return null; }`,
      fixed: `    public SimpliXApiResponse<AreaDetailDTO> get(@PathVariable String areaId) { return null; }`,
    },
  },
  {
    id: "api-responses-block",
    invariant: "#17g",
    level: "error",
    desc: "@ApiResponses block on an endpoint — the envelope is uniform and the generator emits none, so a hand-written block documents a response shape the framework does not produce",
    appliesTo: isController,
    check: (c) => lineHits(stripCommentsAndStrings(c), /@ApiResponses\b/),
    samples: {
      file: "modules/site/src/main/java/app/web/site/controller/AreaRestController.java",
      broken: `    @ApiResponses({@ApiResponse(responseCode = "200")})
    @GetMapping("/{areaId}")`,
      fixed: `    @GetMapping("/{areaId}")`,
    },
  },
  {
    id: "repository-not-simplix-base",
    invariant: "#4",
    level: "error",
    desc: "Repository extends plain JpaRepository instead of SimpliXBaseRepository — the searchable/projection machinery every list endpoint relies on lives on the SimpliX base, so the entity gets no search surface",
    appliesTo: isRepository,
    check: (c) => {
      const clean = stripCommentsAndStrings(c);
      if (!/\binterface\s+\w+/.test(clean)) return [];
      if (/SimpliXBaseRepository|SimpliXTreeRepository/.test(clean)) return [];
      return lineHits(clean, /\binterface\s+\w+\s+extends\s+[\w<>, ]*\bJpaRepository\b/);
    },
    samples: {
      file: "packages/domain-site/src/main/java/app/domain/site/AreaRepository.java",
      broken: `public interface AreaRepository extends JpaRepository<Area, String> {
}`,
      fixed: `public interface AreaRepository extends SimpliXBaseRepository<Area, String> {
}`,
    },
  },
  {
    id: "searchdto-data-annotation",
    invariant: "#6",
    level: "error",
    desc: "SearchDTO annotated @Data — it generates equals/hashCode over a large search-condition container, which the framework compares internally. @Getter @Setter is the shape",
    appliesTo: isDtoContainer,
    check: (c) => {
      const clean = stripCommentsAndStrings(c);
      const lines = clean.split("\n");
      const out = [];
      for (let i = 0; i < lines.length; i++) {
        if (!/\bclass\s+\w*SearchDTO\b/.test(lines[i])) continue;
        const back = lines.slice(Math.max(0, i - 8), i).join("\n");
        // Only the annotations attached to THIS class: after the previous member ends.
        const attached = back.split(/[;}]\s*$/m).pop() ?? back;
        if (/@Data\b/.test(attached)) out.push({ line: i + 1, excerpt: lines[i].trim().slice(0, 120) });
      }
      return out;
    },
    samples: {
      file: "modules/site/src/main/java/app/web/site/dto/AreaDTOs.java",
      broken: `public class AreaDTOs {
    @Data
    @Builder
    public static class AreaSearchDTO {
        private String areaId;
    }
}`,
      fixed: `public class AreaDTOs {
    @Getter
    @Setter
    public static class AreaSearchDTO {
        private String areaId;
    }
}`,
    },
  },
  {
    id: "primitive-boolean-dto",
    invariant: "#7",
    level: "error",
    desc: "DTO field declared primitive `boolean` — Lombok then emits isXxx() where the framework's field lookups expect getXxx(), and an absent field in a request body silently reads as false instead of null. Declare the wrapper `Boolean`",
    appliesTo: isDtoContainer,
    check: (c) => lineHits(stripCommentsAndStrings(c), /^\s*private\s+boolean\s+\w+\s*;/),
    samples: {
      file: "modules/common-email/src/main/java/app/web/email/dto/EmailTestDTOs.java",
      broken: `public class EmailTestDTOs {
    public static class EmailTestRequest {
        private boolean plainText;
    }
}`,
      fixed: `public class EmailTestDTOs {
    public static class EmailTestRequest {
        private Boolean plainText;
    }
}`,
    },
  },
  {
    id: "sortable-boolean-searchable-field",
    invariant: "AP-38",
    level: "error",
    desc: "A Boolean SearchDTO field declared `sortable = true` — the paging query aggregates the sort column as max(<column>), and there is no max(boolean) on PostgreSQL, so the endpoint answers 500 the moment anybody sorts by it. `sortable = true` is what puts the sort arrow in the list header, so the defect ships as a control that exists in order to fail; where the column is the list's default sort the screen breaks on open. Filter on a boolean, never sort",
    appliesTo: isDtoContainer,
    // Anchored on the annotation, then read forward to the declaration it belongs to, so a
    // sortable String standing beside a plain Boolean is not reported. Reading forward rather
    // than matching one line is what makes it work at all: the annotation and the field are
    // always on separate lines.
    //
    // KNOWN GAP: an annotation wrapped across lines is not seen, because the `sortable = true`
    // may land on a line the anchor does not match. Widening it means joining lines before
    // scanning, which would also join two fields' annotations into one.
    check: (c) =>
      lineHits(
        stripCommentsAndStrings(c),
        /@SearchableField\([^)]*sortable\s*=\s*true/,
        (_line, lines, i) => {
          for (let j = i + 1; j < lines.length && j < i + 8; j++) {
            const decl = lines[j].match(/^\s*private\s+([\w<>.]+)\s+\w+\s*;/);
            if (decl) return decl[1] === "Boolean";
            if (/^\s*(?:@|$)/.test(lines[j])) continue; // another annotation, or a blank line
            return false; // anything else means the declaration is not what follows
          }
          return false;
        },
      ),
    samples: {
      file: "modules/site/src/main/java/app/web/site/dto/AreaDTOs.java",
      broken: `public class AreaDTOs {
    public static class AreaSearchDTO {
        @SearchableField(operators = {EQUALS}, sortable = true)
        private Boolean restricted;
    }
}`,
      fixed: `public class AreaDTOs {
    public static class AreaSearchDTO {
        @SearchableField(operators = {EQUALS})
        private Boolean restricted;
    }
}`,
      miss: [
        {
          note: "a sortable String is the ordinary case and stays quiet",
          source: `public class AreaDTOs {
    public static class AreaSearchDTO {
        @SearchableField(operators = {EQUALS, LIKE}, sortable = true)
        private String areaName;
    }
}`,
        },
        {
          note: "a Boolean that is filtered but not sorted",
          source: `public class AreaDTOs {
    public static class AreaSearchDTO {
        @SearchableField(operators = {EQUALS})
        private Boolean restricted;
    }
}`,
        },
      ],
    },
  },
  {
    id: "field-injection-in-web",
    invariant: "#8",
    level: "error",
    desc: "@Autowired field injection or @RequiredArgsConstructor on a web-layer controller/service — the generator emits an explicit constructor calling super(...), and Lombok's cannot. Infrastructure (config, scheduler, listener, factory, helper, stream) is exempt",
    appliesTo: (p) =>
      p.includes(`${path.sep}web${path.sep}`)
      && (isController(p) || isService(p))
      && !/[\\/](config|scheduler|listener|factory|helper|stream)[\\/]/.test(p),
    check: (c) => lineHits(stripCommentsAndStrings(c), /^\s*@(?:Autowired|RequiredArgsConstructor|AllArgsConstructor)\b/),
    samples: {
      file: "modules/site/src/main/java/app/web/site/service/AreaService.java",
      broken: `@Service
@RequiredArgsConstructor
public class AreaService extends SimpliXBaseService<Area, String> {
}`,
      fixed: `@Service
public class AreaService extends SimpliXBaseService<Area, String> {
    public AreaService(AreaRepository repository, EntityManager em) { super(repository, em); }
}`,
    },
  },
  {
    id: "banned-exception-type",
    invariant: "#3",
    level: "error",
    desc: "A web-layer controller/service throws IllegalArgumentException / RuntimeException / ResponseStatusException — the global handler only builds the standard envelope from SimpliXGeneralException, so the client gets an untranslated 500 with a stack-trace message",
    appliesTo: (p) => p.includes(`${path.sep}web${path.sep}`) && (isController(p) || isService(p)),
    // A class production never loads cannot hand a production client a bad envelope, and a dev
    // fixture that exists to PRODUCE each error shape would otherwise be reported for doing its job.
    check: (c) =>
      isDevProfileOnly(c)
        ? []
        : lineHits(stripCommentsAndStrings(c), /throw\s+new\s+(?:IllegalArgumentException|RuntimeException|ResponseStatusException)\s*\(/),
    samples: {
      file: "modules/site/src/main/java/app/web/site/service/AreaService.java",
      broken: `        if (entity == null) {
            throw new IllegalArgumentException("Area not found");
        }`,
      fixed: `        if (entity == null) {
            throw new SimpliXGeneralException(ErrorCode.GEN_NOT_FOUND, "{error.area.notFound}", null);
        }`,
    },
  },
  {
    id: "debug-log-in-web-layer",
    invariant: "#14",
    level: "error",
    desc: "log.debug/info in a web-layer controller or service — the global handler logs errors and these do not, so the line is noise at best. A credential-adjacent flow logging an identifier or a length is a data leak even at DEBUG. Business events are recorded as an AuditEvent, not a log line",
    appliesTo: (p) =>
      p.includes(`${path.sep}web${path.sep}`)
      && (isController(p) || isService(p))
      && !/[\\/](config|scheduler|listener|factory|helper|stream)[\\/]/.test(p),
    check: (c) => lineHits(stripCommentsAndStrings(c), /\blog\.(?:debug|info)\s*\(/),
    samples: {
      file: "modules/site/src/main/java/app/web/site/service/AreaService.java",
      broken: `        log.info("Creating area {}", createDTO.getAreaCode());
        return saveAndGetProjection(entity);`,
      fixed: `        return saveAndGetProjection(entity);`,
    },
  },
  {
    id: "jvm-default-zone",
    invariant: "#18",
    level: "error",
    desc: "Timezone-dependent value read from the JVM default zone — argless LocalDate.now() / LocalDateTime.now() / LocalTime.now(), or ZoneId.systemDefault(). The answer then depends on the machine the server happens to run on: near midnight the day, and near New Year the year, differ from the installation's. Resolve a zone explicitly — site (Site.timezone) → domain operation-policy default → the configured app timezone — and pass it in",
    appliesTo: (p) => p.endsWith(".java"),
    check: (c) =>
      lineHits(
        stripCommentsAndStrings(c),
        /\b(?:LocalDate|LocalDateTime|LocalTime|Year|YearMonth)\.now\(\s*\)|\bZoneId\.systemDefault\s*\(\s*\)/,
      ),
    samples: {
      file: "apps/safety-server/src/main/java/app/safetyserver/seed/InstallationSeed.java",
      broken: `        int year = LocalDate.now().getYear();`,
      fixed: `        int year = LocalDate.now(zone.resolve()).getYear();`,
    },
  },
  {
    id: "hardcoded-zone-literal",
    invariant: "#18",
    level: "error",
    desc: "A zone id written as a literal — ZoneId.of(\"Asia/Seoul\") and friends. The installation's zone is configuration, so a literal is right for one deployment and silently wrong for the next, and the value it shifts is a date somebody reads off a screen",
    appliesTo: (p) => p.endsWith(".java"),
    check: (c) =>
      lineHits(stripComments(c), /\bZoneId\.of\(\s*"[A-Za-z]+\/[A-Za-z_+\-0-9]+"\s*\)/),
    samples: {
      file: "apps/safety-server/src/main/java/app/safetyserver/seed/InstallationSeed.java",
      broken: `                .separatedSince(day.atStartOfDay(ZoneId.of("Asia/Seoul")).toInstant())`,
      fixed: `                .separatedSince(day.atStartOfDay(zone.resolve()).toInstant())`,
    },
  },
  {
    id: "banned-temporal-entity-type",
    invariant: "#18",
    level: "error",
    desc: "Entity/DTO field typed LocalDateTime / OffsetDateTime / ZonedDateTime — SimpliX's auto-applied converters UTC-normalize these, so the offset the field appears to carry is not the one that comes back. An absolute instant is `Instant`; a calendar date is `LocalDate`; a wall-clock time is `LocalTime`",
    appliesTo: (p) => p.endsWith(".java"),
    check: (c) =>
      lineHits(stripCommentsAndStrings(c), /^\s*private\s+(?:LocalDateTime|OffsetDateTime|ZonedDateTime)\s+\w+\s*;/),
    samples: {
      file: "packages/domain-site/src/main/java/app/domain/site/Area.java",
      broken: `    private LocalDateTime inspectedAt;`,
      fixed: `    private Instant inspectedAt;`,
    },
  },
  {
    id: "searchdto-pk-contract",
    invariant: "#15③",
    level: "error",
    desc: "SearchDTO's entity-ID field is missing `sortable = true` or the `IN` operator. Without sortable the scaffolded list's FIRST request fails, because the frontend's default sort is `<entityId>.desc`. Without IN the list's own filter is dead the moment a value is picked, since it resolves selected labels with `<entityId>.in=a,b,c` — and it is dead on every list that offers the filter, including other modules'. The scaffold emits neither half",
    appliesTo: isDtoContainer,
    check: (c, rel, ctx) => {
      const entity = path.basename(rel).replace(/DTOs?\.java$/, "");
      const pk = ctx?.entityIds?.get(entity);
      if (!pk) return []; // no entity of that name in this project — nothing to assert against
      const clean = stripComments(c);
      const m = clean.match(/\bclass\s+\w*SearchDTO\b/);
      if (!m) return [];
      let body = clean.slice(m.index + m[0].length);
      const nx = body.search(/\n {4}public (?:static |abstract static )?class /);
      if (nx > 0) body = body.slice(0, nx);
      const fm = body.match(new RegExp(`private\\s+[\\w<>,\\s\\[\\]]+?\\s+${pk}\\s*;`));
      if (!fm) return [];
      const before = body.slice(0, fm.index);
      const line = clean.slice(0, clean.indexOf(m[0])).split("\n").length
        + before.split("\n").length;
      if (!before.includes("@SearchableField")) {
        return [{ line, excerpt: `${pk}: no @SearchableField on the entity's own id` }];
      }
      const ann = "@SearchableField" + before.split("@SearchableField").pop();
      const head = ann.split(")")[0].replace(/\s+/g, " ");
      const miss = [];
      if (!/sortable\s*=\s*true/.test(head)) miss.push("sortable = true");
      if (!/\bIN\b/.test(head)) miss.push("IN");
      return miss.length ? [{ line, excerpt: `${pk}: missing ${miss.join(" + ")} — ${head.slice(0, 90)}` }] : [];
    },
    samples: {
      file: "modules/site/src/main/java/app/web/site/dto/AreaDTOs.java",
      broken: `public class AreaDTOs {
    public static class AreaSearchDTO {
        @SearchableField(operators = {EQUALS})
        private String areaId;
    }
}`,
      fixed: `public class AreaDTOs {
    public static class AreaSearchDTO {
        @SearchableField(operators = {EQUALS, IN}, sortable = true)
        private String areaId;
    }
}`,
      // The rule needs the entity index to know Area's PK is `areaId`.
      ctx: { entityIds: new Map([["Area", "areaId"]]) },
    },
  },
  {
    id: "hand-written-row-drops-a-field",
    invariant: "#17",
    level: "review",
    desc: "A hand-written mapper that skips a field BOTH sides declare — the source has it, the DTO has it, and the method that carries one into the other does not mention it. Nothing fails: the column is written, the DTO serializes, and the field is simply absent from the answer, so the screen draws a value that is there as a value that is not. This is where a field added to an entity goes missing, because the mapper is the one place the addition does not reach and the compiler has nothing to say about it",
    appliesTo: isService,
    check: (c, _file, ctx) => {
      const known = ctx?.fields;
      if (!known) return [];
      const clean = stripCommentsAndStrings(c);
      const out = [];
      // `Dto row = new Dto(); row.setX(src.getX()); … return row;` — the shape a promoted service
      // reaches for when a projection cannot express the row.
      const re = /(\w+)\s+(\w+)\s*=\s*new\s+\1\s*\(\s*\)\s*;/g;
      let m;
      while ((m = re.exec(clean))) {
        const [dto, held] = [m[1], m[2]];
        const tail = clean.slice(m.index, m.index + 2000);
        const stop = tail.indexOf(`return ${held};`);
        if (stop < 0) continue;
        const body = tail.slice(0, stop);
        const sets = new Set([...body.matchAll(new RegExp(`\\b${held}\\.set(\\w+)\\s*\\(`, "g"))].map((x) => x[1].toLowerCase()));
        if (sets.size < 2) continue;
        // The one thing every setter reads from, which is the source type this row copies.
        const froms = [...body.matchAll(/\b(\w+)\.get\w+\s*\(\s*\)/g)].map((x) => x[1]).filter((n) => n !== held);
        if (!froms.length) continue;
        const source = froms[0];
        const decl = clean.match(new RegExp(`\\(\\s*(?:final\\s+)?(\\w+)\\s+${source}\\s*\\)`));
        if (!decl) continue;
        const onSource = known.get(decl[1]);
        const onDto = known.get(dto);
        if (!onSource || !onDto) continue;
        const missed = [...onDto].filter((f) => onSource.has(f) && !sets.has(f.toLowerCase()));
        if (missed.length) {
          out.push({
            line: clean.slice(0, m.index).split("\n").length,
            excerpt: `${decl[1]} → ${dto} carries neither ${missed.map((f) => `\`${f}\``).join(" nor ")}, which both declare`,
          });
        }
      }
      return out;
    },
    samples: {
      file: "modules/approval/src/main/java/app/web/approval/service/ApprovalInboxService.java",
      // The index the repository run builds from every source, written out for the sample: the
      // rule reads only what both sides declare, so the sample must declare both.
      ctx: {
        fields: new Map([
          ["ApprovalSnapshotField", new Set(["fieldLabel", "fieldValue", "referenceId", "referenceKind"])],
          ["ApprovalSnapshotFieldDTO", new Set(["fieldLabel", "fieldValue", "referenceId", "referenceKind"])],
        ]),
      },
      broken: `public class ApprovalSnapshotField {
    private String fieldLabel;
    private String fieldValue;
    private String referenceId;
    private String referenceKind;
}

public class ApprovalSnapshotFieldDTO {
    private String fieldLabel;
    private String fieldValue;
    private String referenceId;
    private String referenceKind;
}

public class ApprovalInboxService {
    private ApprovalSnapshotFieldDTO snapshotRow(ApprovalSnapshotField field) {
        ApprovalSnapshotFieldDTO row = new ApprovalSnapshotFieldDTO();
        row.setFieldLabel(field.getFieldLabel());
        row.setFieldValue(field.getFieldValue());
        row.setReferenceId(field.getReferenceId());
        return row;
    }
}`,
      fixed: `public class ApprovalSnapshotField {
    private String fieldLabel;
    private String fieldValue;
    private String referenceId;
    private String referenceKind;
}

public class ApprovalSnapshotFieldDTO {
    private String fieldLabel;
    private String fieldValue;
    private String referenceId;
    private String referenceKind;
}

public class ApprovalInboxService {
    private ApprovalSnapshotFieldDTO snapshotRow(ApprovalSnapshotField field) {
        ApprovalSnapshotFieldDTO row = new ApprovalSnapshotFieldDTO();
        row.setFieldLabel(field.getFieldLabel());
        row.setFieldValue(field.getFieldValue());
        row.setReferenceId(field.getReferenceId());
        row.setReferenceKind(field.getReferenceKind());
        return row;
    }
}`,
      miss: [
        {
          note: "a field the DTO does not declare, which the row is right not to carry",
          ctx: {
            fields: new Map([
              ["ApprovalAttachment", new Set(["attachmentLabel", "attachmentRef"])],
              ["ApprovalAttachmentDTO", new Set(["attachmentLabel", "attachmentMeta"])],
            ]),
          },
          source: `public class ApprovalAttachment {
    private String attachmentLabel;
    private String attachmentRef;
}

public class ApprovalAttachmentDTO {
    private String attachmentLabel;
    private String attachmentMeta;
}

public class ApprovalInboxService {
    private ApprovalAttachmentDTO attachmentRow(ApprovalAttachment attachment) {
        ApprovalAttachmentDTO row = new ApprovalAttachmentDTO();
        row.setAttachmentLabel(attachment.getAttachmentLabel());
        row.setAttachmentMeta(attachment.getAttachmentMeta());
        return row;
    }
}`,
        },
      ],
    },
  },
  {
    id: "unforced-searchcondition-overload",
    invariant: "#15③",
    level: "error",
    desc: "A service forces its scope in search(Map) but not in the search(SearchCondition) overload — the controller opens GET /search and POST /search over the same list, so posting the same query returns rows the GET refuses. The two are one door and are narrowed the same way",
    appliesTo: isService,
    check: (c) => {
      const clean = stripCommentsAndStrings(c);
      const FORCE = /\bforce\w*\(|ScopedSearchParams|requireVisible|forceVisible/;
      // Handing the whole call to the overload that IS narrowed is the third way to be narrowed,
      // and it is the shape a service reaches for when the two doors answer the same question —
      // `return search(Map.of());`. Read as a body with no marker in it, it fails a service that
      // cannot return an unscoped row, and the fix a reader then applies is to copy the narrowing
      // into the second overload, where it is a second copy of one rule.
      const DELEGATES = /\breturn\s+search\s*\(\s*(Map\.|new\s+(Linked)?HashMap|params\b|forced\b)/;
      const found = {};
      const re = /public\s+Page<[\w<>,\s]+>\s+search\s*\(([\s\S]{0,200}?)\)\s*\{/g;
      let m;
      while ((m = re.exec(clean))) {
        const arg = m[1].replace(/\s+/g, " ");
        const kind = arg.includes("Map<") ? "map" : arg.includes("SearchCondition") ? "cond" : null;
        if (!kind) continue;
        const body = braceBody(clean, m.index + m[0].length - 1);
        found[kind] = {
          forced: FORCE.test(body) || (kind === "cond" && DELEGATES.test(body)),
          line: clean.slice(0, m.index).split("\n").length,
        };
      }
      if (found.map?.forced && found.cond && !found.cond.forced) {
        return [{ line: found.cond.line, excerpt: "search(SearchCondition) does not force the scope that search(Map) forces" }];
      }
      return [];
    },
    samples: {
      file: "modules/user-admin/src/main/java/app/web/user/admin/service/UserNoteService.java",
      broken: `public class UserNoteService {
    public Page<UserNoteListDTO> search(Map<String, String> params) {
        return userAccountScope.forceVisible(params, "userId")
                .map(scoped -> findAllWithSearch(scoped, UserNoteListDTO.class))
                .orElseGet(() -> ScopedSearchParams.emptyPage(params));
    }

    public Page<UserNoteListDTO> search(SearchCondition<UserNoteSearchDTO> searchCondition) {
        return findAllWithSearch(searchCondition, UserNoteListDTO.class);
    }
}`,
      fixed: `public class UserNoteService {
    public Page<UserNoteListDTO> search(Map<String, String> params) {
        return userAccountScope.forceVisible(params, "userId")
                .map(scoped -> findAllWithSearch(scoped, UserNoteListDTO.class))
                .orElseGet(() -> ScopedSearchParams.emptyPage(params));
    }

    public Page<UserNoteListDTO> search(SearchCondition<UserNoteSearchDTO> searchCondition) {
        return userAccountScope.forceVisible(searchCondition, "userId")
                .map(scoped -> findAllWithSearch(scoped, UserNoteListDTO.class))
                .orElseGet(() -> userAccountScope.emptyPage(searchCondition));
    }
}`,
      miss: [
        {
          note: "the SearchCondition overload handing the whole call to the narrowed one",
          source: `public class UserNoteService {
    public Page<UserNoteListDTO> search(Map<String, String> params) {
        return userAccountScope.forceVisible(params, "userId")
                .map(scoped -> findAllWithSearch(scoped, UserNoteListDTO.class))
                .orElseGet(() -> ScopedSearchParams.emptyPage(params));
    }

    public Page<UserNoteListDTO> search(SearchCondition<UserNoteSearchDTO> searchCondition) {
        return search(Map.of());
    }
}`,
        },
      ],
    },
  },
  {
    id: "missing-field-label",
    invariant: "#12",
    level: "error",
    desc: "A SearchDTO/CreateDTO field carries no @FieldLabel — a validation error on it then names the Java field instead of the translated label, in every locale. Audit fields (createdBy/createdAt/updatedBy/updatedAt) are BaseEntity-managed and exempt",
    appliesTo: isDtoContainer,
    check: (c) => {
      const AUDIT = new Set(["createdBy", "createdAt", "updatedBy", "updatedAt", "deletedBy", "deletedAt"]);
      const clean = stripCommentsAndStrings(c);
      const out = [];
      const parts = clean.split(/\n {4}public (?:static |abstract static )?class (\w+)/);
      for (let i = 1; i < parts.length; i += 2) {
        const name = parts[i];
        const body = parts[i + 1] ?? "";
        if (!/(Search|Create)DTO$/.test(name)) continue;
        const offset = clean.indexOf(parts[i + 1]);
        for (const fm of body.matchAll(/\n {8}private\s+[\w<>,\s[\]]+?\s+(\w+)\s*;/g)) {
          if (AUDIT.has(fm[1])) continue;
          const seg = body.slice(0, fm.index).split(/[;{}]\s*\n/).pop() ?? "";
          if (!seg.includes("@FieldLabel")) {
            out.push({
              line: clean.slice(0, offset + fm.index).split("\n").length + 1,
              excerpt: `${name}.${fm[1]} — no @FieldLabel`,
            });
          }
        }
      }
      return out;
    },
    samples: {
      file: "modules/site/src/main/java/app/web/site/dto/AreaDTOs.java",
      broken: `public class AreaDTOs {
    public static class AreaCreateDTO {
        @NotBlank
        private String areaCode;
    }
}`,
      fixed: `public class AreaDTOs {
    public static class AreaCreateDTO {
        @FieldLabel("{entities.Area.areaCode}")
        @NotBlank
        private String areaCode;
    }
}`,
    },
  },
  {
    id: "double-wrapped-response",
    invariant: "#1",
    level: "error",
    desc: "Endpoint returns ResponseEntity<SimpliXApiResponse<...>> — the envelope is already the response, so this wraps it twice and the client reads a body whose fields are one level deeper than the contract says. Legitimate only for a 202-Accepted async command returning a Location header",
    appliesTo: isController,
    check: (c) => lineHits(stripCommentsAndStrings(c), /ResponseEntity<\s*SimpliXApiResponse\s*</),
    samples: {
      file: "modules/site/src/main/java/app/web/site/controller/AreaRestController.java",
      broken: `    public ResponseEntity<SimpliXApiResponse<AreaDetailDTO>> get(@PathVariable String areaId) { return null; }`,
      fixed: `    public SimpliXApiResponse<AreaDetailDTO> get(@PathVariable String areaId) { return null; }`,
    },
  },
  {
    id: "undocumented-response-entity",
    invariant: "#1",
    level: "review",
    desc: "Endpoint returns a bare ResponseEntity with no class-level JavaDoc saying why — binary streaming is the documented exception, and an undocumented one reads the same from outside. Confirm it streams bytes and record the reason, or return SimpliXApiResponse",
    appliesTo: isController,
    check: (c) => {
      const clean = stripCommentsAndStrings(c);
      if (/ResponseEntity<\s*SimpliXApiResponse/.test(clean)) return []; // the error rule above owns that
      if (isDevProfileOnly(c)) return [];
      const hits = lineHits(clean, /public\s+ResponseEntity</);
      if (!hits.length) return [];
      // A class JavaDoc mentioning the exception is the documentation the invariant asks for.
      if (/ResponseEntity<Resource>|binary|streams? the bytes|browsers? consume/i.test(c)) return [];
      return hits;
    },
    samples: {
      file: "modules/common-file/src/main/java/app/web/file/controller/PublicContentRestController.java",
      broken: `public class PublicContentRestController {
    public ResponseEntity<byte[]> stream(@PathVariable String id) { return null; }
}`,
      fixed: `/**
 * Returns {@code ResponseEntity<Resource>} because browsers consume it directly.
 */
public class PublicContentRestController {
    public ResponseEntity<Resource> stream(@PathVariable String id) { return null; }
}`,
    },
  },
];

// ---------------------------------------------------------------------------
// Self-test — every rule against the broken form and the fixed form
// ---------------------------------------------------------------------------

/**
 * The two escape hatches are proved here too. An untested exemption is the quietest way for an
 * audit to stop holding anything: it reports zero, and zero is what a clean tree also reports.
 */
function selftestMechanisms() {
  const cases = [
    {
      name: "suppression: marker with a reason mutes the next line",
      pass: () => suppressedLines(`// simplix-audit-ignore[jvm-default-zone]: legacy column, no site context\nLocalDate.now();`, "jvm-default-zone").has(2),
    },
    {
      name: "suppression: a reason wrapping onto more lines still reaches the code",
      pass: () => suppressedLines(`// simplix-audit-ignore[jvm-default-zone]: legacy column with\n// no zone, and no Spring context here to read the setting from.\n\nLocalDate.now();`, "jvm-default-zone").has(4),
    },
    {
      name: "suppression: a wrapped statement is covered to its last line",
      pass: () => {
        const s = suppressedLines(`// simplix-audit-ignore[jvm-default-zone]: legacy column\nreturn LocalDate.ofInstant(Instant.ofEpochMilli(v),\n        ZoneId.systemDefault());\nint other = 1;`, "jvm-default-zone");
        return s.has(2) && s.has(3) && !s.has(4);
      },
    },
    {
      name: "suppression: marker WITHOUT a reason mutes nothing",
      pass: () => suppressedLines(`// simplix-audit-ignore[jvm-default-zone]:\nLocalDate.now();`, "jvm-default-zone").size === 0,
    },
    {
      name: "suppression: a marker for another rule mutes nothing",
      pass: () => suppressedLines(`// simplix-audit-ignore[primitive-boolean-dto]: reason\nLocalDate.now();`, "jvm-default-zone").size === 0,
    },
    {
      name: "dev-profile: @Profile({\"local\",\"dev\"}) reads as dev-only",
      pass: () => isDevProfileOnly(`@Profile({"local", "dev"})\npublic class X {}`) === true,
    },
    {
      name: "dev-profile: a profile naming prod does NOT read as dev-only",
      pass: () => isDevProfileOnly(`@Profile({"local", "prod"})\npublic class X {}`) === false,
    },
    {
      name: "dev-profile: a negated profile (!prod) does NOT read as dev-only",
      pass: () => isDevProfileOnly(`@Profile("!prod")\npublic class X {}`) === false,
    },
    {
      name: "dev-profile: no @Profile at all does NOT read as dev-only",
      pass: () => isDevProfileOnly(`public class X {}`) === false,
    },
    {
      name: "comment stripping: an annotation inside a JavaDoc example is not code",
      pass: () => !/@RequiredArgsConstructor/.test(stripCommentsAndStrings(`/**\n * <pre>{@code\n * @RequiredArgsConstructor\n * }</pre>\n */\npublic class X {}`)),
    },
  ];
  let bad = 0;
  for (const c of cases) {
    let ok = false;
    try { ok = c.pass(); } catch { ok = false; }
    console.log(`${ok ? "✔" : "✖"} ${c.name}`);
    if (!ok) bad++;
  }
  return bad;
}

function selftest() {
  let failed = selftestMechanisms();
  let passed = 0;
  let nearby = 0;
  console.log("");
  for (const rule of RULES) {
    const s = rule.samples;
    const problems = [];
    if (!s || typeof s.broken !== "string" || typeof s.fixed !== "string" || !s.file) {
      console.log(`✖ ${rule.id}: no broken/fixed samples — a rule with one direction proved is not proved`);
      failed++;
      continue;
    }
    if (!rule.appliesTo(s.file)) {
      problems.push(`appliesTo() rejects the sample path ${s.file} — the rule could never run on it`);
    } else {
      const sampleCtx = rule.ctxSample ? { ...(s.ctx ?? {}), i18n: rule.ctxSample } : s.ctx;
      const onBroken = rule.check(s.broken, s.file, sampleCtx);
      const onFixed = rule.check(s.fixed, s.file, sampleCtx);
      if (!onBroken.length) problems.push("did NOT fire on the broken form");
      if (onFixed.length) problems.push(`fired on the fixed form (${onFixed.map((h) => h.excerpt).join("; ").slice(0, 120)})`);
      // The legitimate shapes that look like the defect. A rule proved on one broken form and one
      // fixed form is proved in the two directions it was written for and in no other: widening it
      // to accept a second legitimate shape leaves nothing behind that would catch the widening
      // going too far, and the next reader has only the description to go on.
      for (const near of s.miss ?? []) {
        const hits = rule.check(near.source, near.file ?? s.file, near.ctx ?? sampleCtx);
        if (hits.length) {
          problems.push(`fired on a near-neighbour that is not the defect — ${near.note}`);
        }
      }
      nearby += (s.miss ?? []).length;
    }
    if (problems.length) {
      console.log(`✖ ${rule.id}\n    ${problems.join("\n    ")}`);
      failed++;
    } else {
      passed++;
      const misses = (rule.samples.miss ?? []).length;
      console.log(
        `✔ ${rule.id.padEnd(34)} fires on broken, silent on fixed`
          + (misses ? `  · silent on ${misses} near-neighbour(s)` : ""),
      );
    }
  }
  console.log(
    `\n${passed} rule(s) proved both ways, ${failed} not proved`
      + (nearby ? `, ${nearby} near-neighbour(s) left silent.` : "."),
  );
  return failed === 0 ? 0 : 1;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

// An unrecognised option stops the run rather than falling through to a scan. A misspelt
// `--selftest` that scanned instead printed "0 file(s) scanned — 0 error hit(s)", which is
// what a clean project prints; the two are indistinguishable to whoever reads the tail.
const FLAGS = ["--list", "--selftest", "--errors-only"];
const VALUED_FLAGS = ["--root=", "--rule="];
const unknownArgs = args.filter(
  (a) => !FLAGS.includes(a) && !VALUED_FLAGS.some((f) => a.startsWith(f)),
);
if (unknownArgs.length) {
  console.error(`\u2716 unrecognised option: ${unknownArgs.join(" ")}`);
  console.error(`  known options: ${FLAGS.join("  ")}  ${VALUED_FLAGS.map((f) => `${f}<value>`).join("  ")}`);
  process.exit(2);
}

if (args.includes("--list")) {
  for (const r of RULES) {
    console.log(`${r.level.padEnd(6)} ${r.id.padEnd(34)} ${r.invariant.padEnd(8)} ${r.desc.slice(0, 90)}`);
  }
  process.exit(0);
}

if (args.includes("--selftest")) {
  resetIndexes();
  process.exit(selftest());
}

const errorsOnly = args.includes("--errors-only");
const ruleFilter = args.find((a) => a.startsWith("--rule="))?.slice(7).split(",");

const files = collectSources();
const ctx = { entityIds: entityIdIndex(files), fields: fieldIndex(files), i18n: i18nIndex(files), overwrites: serviceOverwriteIndex(files), emptyDefaults: emptyDefaultIndex(files) };
const results = new Map();
let suppressedCount = 0;

for (const rule of RULES) {
  if (ruleFilter && !ruleFilter.includes(rule.id)) continue;
  const bucket = { rule, hits: [] };
  for (const abs of files) {
    const rel = path.relative(ROOT, abs);
    if (!rule.appliesTo(rel)) continue;
    let content;
    try { content = fs.readFileSync(abs, "utf8"); } catch { continue; }
    const muted = suppressedLines(content, rule.id);
    for (const h of rule.check(content, rel, ctx)) {
      if (h.line && muted.has(h.line)) { suppressedCount++; continue; }
      bucket.hits.push({ file: rel, ...h });
    }
  }
  if (bucket.hits.length) results.set(rule.id, bucket);
}

let errorCount = 0;
let reviewCount = 0;

for (const { rule, hits } of results.values()) {
  if (errorsOnly && rule.level !== "error") continue;
  const mark = rule.level === "error" ? "✖" : "◐";
  console.log(`\n${mark} [${rule.level}] ${rule.id} (${rule.invariant}) — ${rule.desc}`);
  for (const h of hits) console.log(`  ${h.file}${h.line ? `:${h.line}` : ""}  ${h.excerpt}`);
  if (rule.level === "error") errorCount += hits.length;
  else reviewCount += hits.length;
}

console.log(
  `\n${files.length} Java source file(s) scanned, ${ctx.entityIds.size} entity id(s) indexed`
  + ` — ${errorCount} error hit(s), ${reviewCount} review candidate(s)`
  + `, ${suppressedCount} suppressed by an in-file marker.`,
);
if (suppressedCount) {
  console.log("A suppressed line carries its reason beside it — read those before trusting a clean run.");
}
if (reviewCount && !errorsOnly) {
  console.log("Review candidates need judgment against the invariant's stated exceptions — fix or justify, do not bulk-rewrite.");
}
process.exit(errorCount > 0 ? 1 : 0);
