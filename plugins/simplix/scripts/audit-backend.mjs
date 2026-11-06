#!/usr/bin/env node
/**
 * Backend convention audit - machine-checkable subset of the `simplix:backend`
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
 * Exit code 1 when any error-level rule has hits, 2 when no Java main source was found (a scan
 * that read nothing would print what a clean project prints). "review"-level rules print
 * candidates that need human judgment and never fail the run.
 *
 * Sources: `src/main/java` at the root and under `modules/`, `packages/`, `apps/` and `tools/`.
 * Product policies come from the `audit` section of the root's `.claude/simplix.json`.
 *
 * **--selftest is the half that keeps this file honest.** Every rule carries a `broken` and a
 * `fixed` sample; the selftest asserts the rule fires on the first and stays silent on the
 * second. A rule proved in one direction has not been proved - a check that can never fire is
 * indistinguishable from a clean tree, and it is the reading that a green run invites. Add no
 * rule without both samples; the selftest fails on a rule that omits either.
 *
 * **This audit reads source files.** Two facts it would like are not in the Java source: whether
 * a given searchable id is an endpoint's OWN primary key, and whether a list filter resolves
 * selections against it. The first is recovered here by reading the entity's `@Id` field and
 * matching the DTO container's name, which is exact rather than approximate. The second lives in
 * the frontend and stays out. What genuinely needs a started server - the two verification
 * requests in `review/searchable-field-patterns.md` - is not attempted here and is still run by
 * hand against the published OpenAPI document.
 *
 * Scope: a project that CONSUMES SimpliX. Pointing it at the framework's own repository reports
 * its base classes as violations - the module that defines SimpliXBaseRepository cannot extend it.
 */

import fs from "node:fs";
import os from "node:os";
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

/**
 * Every main-source Java file of the backend at `root`: its own `src/` (a single-module build)
 * and every module under the multi-module source roots.
 *
 * @param root the backend project root
 * @returns absolute paths of the `src/main/java` sources
 */
function collectSources(root = ROOT) {
  const files = [];
  walk(path.join(root, "src"), files);
  for (const dir of SRC_ROOTS) walk(path.join(root, dir), files);
  // Test sources are exempt from every invariant here (the handbook says so for logging,
  // exceptions and constructors alike), so they never enter the scan.
  return files.filter((f) => f.includes(`${path.sep}src${path.sep}main${path.sep}java${path.sep}`));
}

/**
 * The `audit` section of the project's `.claude/simplix.json`: the product's own policies, which
 * this script never guesses. A missing file or section is the empty policy.
 *
 * @example
 * { "audit": { "scopeForcingCalls": ["<scopeHelper>", "<ScopedParamsType>"], "rereadCalls": ["<RereadHelper.method>"] } }
 *
 * @param root the backend project root
 * @returns the declared `audit` object, or `{}`
 */
function auditSettings(root = ROOT) {
  const file = path.join(root, ".claude", "simplix.json");
  if (!fs.existsSync(file)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return parsed && typeof parsed.audit === "object" && parsed.audit !== null ? parsed.audit : {};
  } catch (e) {
    if (!(e instanceof SyntaxError)) throw e;
    console.error(`⚠ ${file} is not valid JSON - auditing with the empty policy.`);
    return {};
  }
}

/**
 * The pattern that marks a search body as forced to the caller's scope.
 *
 * A call to a `force*` method is the one name that says so in any project. Every other forcing
 * helper is named by the product, in `audit.scopeForcingCalls`, because a list of one project's
 * helper names written here reads every other project's forced search as unforced, and the rule
 * built on it as silent.
 *
 * @param names identifiers the project declares as forcing a scope
 * @returns a pattern matching the generic call or any declared name
 */
function forcingPattern(names) {
  const declared = (Array.isArray(names) ? names : [])
    .filter((n) => typeof n === "string" && /^[A-Za-z_$][\w$]*$/.test(n));
  return declared.length
    ? new RegExp(`\\bforce\\w*\\(|\\b(?:${declared.join("|")})\\b`)
    : /\bforce\w*\(/;
}

// ---------------------------------------------------------------------------
// Java-aware helpers
// ---------------------------------------------------------------------------

/**
 * Blank out comment and string bodies, preserving offsets and newlines.
 *
 * Without this, a JavaDoc `<pre>{@code @RequiredArgsConstructor ...}</pre>` example reads as the
 * annotation it documents, and the file that explains a convention is reported for breaking it.
 * That false positive is not hypothetical - it is the first thing this audit hit.
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

/** Same as above but keeps string CONTENTS - for rules that read a literal (zone ids, tags). */
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
  // A negated profile ("!prod") is an exclusion, not a dev binding - it still loads elsewhere.
  if (profiles.some((p) => p.startsWith("!"))) return false;
  const DEV = new Set(["local", "dev", "test", "development", "it", "integration"]);
  return profiles.every((p) => DEV.has(p));
}

/**
 * Line numbers a `simplix-audit-ignore` marker suppresses for this rule.
 *
 * Shape: `// simplix-audit-ignore[<rule-id>]: <reason>` - the reason is required, because a bare
 * opt-out is how a gate quietly stops holding anything.
 *
 * The marker suppresses its own line and the whole STATEMENT that follows it - skipping the
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

/**
 * The text of the method parameter that the annotation at `at` belongs to: annotations, type and
 * name, bounded by the commas and parentheses of the signature. Generic arguments and annotation
 * arguments are balanced, so `Map<String, X>` and `@Size(min = 1, max = 2)` stay whole.
 */
function parameterAround(src, at) {
  let start = at;
  for (let depth = 0, k = at - 1; k >= 0; k--) {
    const ch = src[k];
    if (ch === ")" || ch === ">") depth++;
    else if (ch === "(" || ch === "<") { if (depth === 0) break; depth--; }
    else if (ch === "," && depth === 0) break;
    start = k;
  }
  let end = at;
  for (let depth = 0, k = at; k < src.length; k++) {
    const ch = src[k];
    if (ch === "(" || ch === "<") depth++;
    else if (ch === ")" || ch === ">") { if (depth === 0) break; depth--; }
    else if (ch === "," && depth === 0) break;
    end = k + 1;
  }
  return src.slice(start, end);
}

/**
 * Every use of the annotation `@<name>` in `clean` (comments and strings blanked), with the text of
 * its parenthesised arguments (empty when it has none) and the line it starts on.
 */
function annotationUses(clean, name) {
  const out = [];
  const rx = new RegExp(`@(?:[\\w.]+\\.)?${name}\\b`, "g");
  let m;
  while ((m = rx.exec(clean))) {
    let k = m.index + m[0].length;
    while (k < clean.length && /\s/.test(clean[k])) k++;
    let args = "";
    if (clean[k] === "(") {
      let depth = 0;
      for (let j = k; j < clean.length; j++) {
        if (clean[j] === "(") depth++;
        else if (clean[j] === ")") { depth--; if (depth === 0) { args = clean.slice(k + 1, j); break; } }
      }
    }
    const line = clean.slice(0, m.index).split("\n").length;
    out.push({ line, args, excerpt: clean.split("\n")[line - 1].trim().slice(0, 150) });
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

/**
 * True when the method whose signature sits on line `lineIndex` (0-based) of `src` is a fire-and-poll
 * command: its body answers 202 Accepted AND sets a Location header. That is the one shape in which
 * a controller may return `ResponseEntity<SimpliXApiResponse<T>>` (handbook invariant #1).
 *
 * `src` keeps string contents (comments blanked) so a literal "Location" header name still reads.
 */
function answersAcceptedWithLocation(src, lineIndex) {
  const lines = src.split("\n");
  let from = 0;
  for (let k = 0; k < lineIndex; k++) from += lines[k].length + 1;
  const body = braceBody(src, from);
  const accepted = /ResponseEntity\s*\.\s*accepted\s*\(|\.\s*status\s*\(\s*(?:HttpStatus(?:Code)?\s*\.\s*ACCEPTED|202)\s*\)|new\s+ResponseEntity\s*<[^>]*>?\s*\([^;]*HttpStatus\s*\.\s*ACCEPTED/.test(body);
  const location = /\.\s*location\s*\(|\.\s*setLocation\s*\(|HttpHeaders\s*\.\s*LOCATION|["']Location["']/i.test(body);
  return accepted && location;
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
let _formulaEntityIndex = null;
/**
 * The entities that declare a Hibernate {@code @Formula} field, by simple name.
 *
 * <p>A formula is a column Hibernate computes in the select it writes itself, so a native query
 * mapped onto such an entity has to carry that column too; {@code select *} never does.
 */
function formulaEntityIndex(files) {
  if (_formulaEntityIndex) return _formulaEntityIndex;
  const set = new Set();
  for (const abs of files) {
    let src;
    try { src = fs.readFileSync(abs, "utf8"); } catch { continue; }
    if (!src.includes("@Entity") || !src.includes("@Formula")) continue;
    if (/@Formula\s*\(/.test(stripComments(src))) set.add(path.basename(abs, ".java"));
  }
  _formulaEntityIndex = set;
  return set;
}
let _encryptedFieldIndex = null;
/**
 * Which fields of each entity are stored encrypted, by the entity's simple name.
 *
 * <p>A field counts as encrypted when its own annotations carry a JPA converter whose class name
 * contains "Encrypt". The converters in use encrypt with a fresh IV each time, so the stored value
 * of the same input differs from row to row and from the search value.
 */
function encryptedFieldIndex(files) {
  if (_encryptedFieldIndex) return _encryptedFieldIndex;
  const map = new Map();
  for (const abs of files) {
    let src;
    try { src = fs.readFileSync(abs, "utf8"); } catch { continue; }
    if (!src.includes("@Entity") || !/Encrypt/.test(src)) continue;
    // Strings go too: a column comment such as "(encrypted - LDAP DN, etc.)" holds a parenthesis
    // that would otherwise end the annotation early and hide the converter.
    const clean = stripCommentsAndStrings(src);
    const held = new Set();
    for (const f of clean.matchAll(/((?:@[\w.]+(?:\([^)]*\))?\s*)+)private\s+[\w<>,\s[\]]+?\s+(\w+)\s*;/g)) {
      if (/@Convert\s*\(\s*converter\s*=\s*\w*Encrypt\w*\.class/.test(f[1])) held.add(f[2]);
    }
    if (held.size) map.set(path.basename(abs, ".java"), held);
  }
  _encryptedFieldIndex = map;
  return map;
}
let _jsonValueEnumIndex = null;
/**
 * Which value types declared in this repository hold a labelled enum their JSON would write as the
 * label object, by the type's simple name.
 *
 * <p>A type counts when a record component or a field of it is typed by an enum that implements
 * `LabeledEnum` and carries no `@JsonSerialize` of its own. Enums and value types are matched by
 * simple name across the whole tree, as a JSON-mapped field names its value type bare.
 *
 * @param files every Java source in the repository
 * @returns value type name -> the components or fields that would be stored as label objects
 */
function jsonValueEnumIndex(files) {
  if (_jsonValueEnumIndex) return _jsonValueEnumIndex;
  const sources = [];
  const labeled = new Set();
  for (const abs of files) {
    let src;
    try { src = fs.readFileSync(abs, "utf8"); } catch { continue; }
    const clean = stripCommentsAndStrings(src);
    sources.push(clean);
    for (const m of clean.matchAll(/\benum\s+(\w+)\s+implements\s+[^{]*\bLabeledEnum\b/g)) labeled.add(m[1]);
  }
  _jsonValueEnumIndex = jsonValueEnumsIn(sources, labeled);
  return _jsonValueEnumIndex;
}

/** The value types of `sources` whose components or fields hold one of `labeled` without a serializer. */
function jsonValueEnumsIn(sources, labeled) {
  const map = new Map();
  const unguarded = (segment) => {
    const typed = segment.trim().match(/^((?:@[\w.]+(?:\([^)]*\))?\s*)*)(?:final\s+)?(\w+)\s+(\w+)$/);
    return typed && labeled.has(typed[2]) && !/@JsonSerialize\b/.test(typed[1]) ? typed[3] : null;
  };
  for (const clean of sources) {
    for (const m of clean.matchAll(/\brecord\s+(\w+)\s*\(/g)) {
      let depth = 1;
      let i = m.index + m[0].length;
      let part = "";
      const parts = [];
      for (; i < clean.length && depth > 0; i++) {
        const ch = clean[i];
        if (ch === "(") depth++;
        if (ch === ")") depth--;
        if (depth === 0) break;
        if (ch === "," && depth === 1) { parts.push(part); part = ""; } else part += ch;
      }
      parts.push(part);
      const held = parts.map(unguarded).filter(Boolean);
      if (held.length) map.set(m[1], held);
    }
    for (const m of clean.matchAll(/\bclass\s+(\w+)[^{]*\{/g)) {
      if (/\b@Entity\b/.test(clean)) break;
      const held = [];
      for (const f of clean.slice(m.index).matchAll(/((?:@[\w.]+(?:\([^)]*\))?\s*)*)private\s+(?:final\s+)?(\w+)\s+(\w+)\s*[;=]/g)) {
        if (labeled.has(f[2]) && !/@JsonSerialize\b/.test(f[1])) held.push(f[3]);
      }
      if (held.length) map.set(m[1], held);
      break;
    }
  }
  return map;
}
let _fieldIndex = null;
/**
 * Which fields each class in this repository declares, by its simple name.
 *
 * <p>Nested classes are indexed under their own simple name rather than `Outer.Inner`, because that
 * is how a mapper writes them - a DTO container's inner class is imported and used bare. Two
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
      // A declaration with an initializer (`= false;`) is a field too; a builder default is written that way.
      for (const f of body.matchAll(/(?:^|\n)\s{4,8}private\s+(?:final\s+)?[\w<>,\s[\]]+?\s+(\w+)\s*(?:=[^;\n]*)?;/g)) {
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
 * @returns one entry per set - the field name with its first letter lowered, and the argument text
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
 * something - 「every workplace」 for a scope key, 「no pack raised it」 for a provenance id. The
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
    // itself while `= "x"` becomes `= " "` - the match below therefore reads the empty default
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
 * fills in itself - a caller forced onto the record, a state read off two dates, a name looked up
 * from an account - is one the form has no control for and no way to grow one. Nothing in the DTO
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
 * path, not in the body) can still be a field the UPDATE path reads and compares - merging the two
 * reports that one as unrequirable, and it is the shape a scaffolded `UpdateDTO` takes.
 *
 * @returns entity simple name → `{ create, update, hasUpdate }` - the fields each write path
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

/** The class the SimpliX starter's auto-configured ModelMapper installs to keep create defaults. */
const FRAMEWORK_CREATE_SKIP_ENTRY = "dev/simplecore/simplix/web/mapping/CreateRequestNullSkipCondition.class";

/**
 * Whether the `spring-boot-starter-simplix` the project declares already skips an absent create
 * field. The version comes from the project's own build files (a `simplix` entry in
 * `gradle/libs.versions.toml`, or `simplixVersion` in `gradle.properties`); the jar of that version
 * is looked up in the local Maven repository and the Gradle cache, and its central directory is
 * read for the condition class, whose name a zip stores uncompressed. A version that cannot be
 * found resolves to false, so the rule keeps reporting until the fix is provably on the classpath.
 *
 * @param root the backend project root
 * @returns true when a resolved starter jar of the declared version carries the condition
 */
function frameworkSkipsCreateNulls(root = ROOT) {
  const read = (f) => { try { return fs.readFileSync(path.join(root, f), "utf8"); } catch { return ""; } };
  const version = read("gradle/libs.versions.toml").match(/^\s*simplix\s*=\s*"([^"]+)"/m)?.[1]
    ?? read("gradle.properties").match(/^\s*simplixVersion\s*=\s*(\S+)/m)?.[1];
  if (!version) return false;
  const dirs = [
    path.join(os.homedir(), ".m2", "repository", "dev", "simplecore", "simplix", "spring-boot-starter-simplix", version),
  ];
  const cache = path.join(os.homedir(), ".gradle", "caches", "modules-2", "files-2.1", "dev.simplecore.simplix", "spring-boot-starter-simplix", version);
  try { for (const h of fs.readdirSync(cache)) dirs.push(path.join(cache, h)); } catch { /* not cached */ }
  for (const dir of dirs) {
    let names = [];
    try { names = fs.readdirSync(dir).filter((n) => n.endsWith(".jar") && !/-(sources|javadoc)\.jar$/.test(n)); } catch { continue; }
    for (const n of names) {
      try { if (fs.readFileSync(path.join(dir, n)).includes(FRAMEWORK_CREATE_SKIP_ENTRY)) return true; } catch { /* unreadable */ }
    }
  }
  return false;
}

let _createMappingIndex = null;
/**
 * What decides whether a create request can overwrite the default its entity starts with.
 *
 * <p>A service creates with `new Entity()` and `modelMapper.map(createDTO, entity)`. The entity's
 * defaults are in place before the copy, and a mapper that copies absent values too replaces each
 * with null: a NOT NULL column then refuses the insert, any other column stores a value nobody
 * chose. The defect needs two facts in the project, both read here, and one fix, which is a
 * decision about the mapper rather than a line in any service:
 *
 * <ul>
 *   <li>`entitiesWithDefaults` - the `@Entity` classes declaring an `@Builder.Default`;</li>
 *   <li>`mapperSkipsNulls` - some main source configures the mapper with `setSkipNullEnabled(true)`,
 *       `setPropertyCondition(...)` or `Conditions.isNotNull()`. Which of them is right for
 *       update requests is the project's call; any of them means the call was made - or the
 *       SimpliX starter the project resolves ships `CreateRequestNullSkipCondition`, which its
 *       auto-configured mapper installs (`frameworkSkipsCreateNulls`).</li>
 * </ul>
 *
 * @param files every Java source in the project
 * @returns `{ entitiesWithDefaults: Set<string>, mapperSkipsNulls: boolean }`
 */
function createMappingIndex(files) {
  if (_createMappingIndex) return _createMappingIndex;
  const entitiesWithDefaults = new Set();
  let mapperSkipsNulls = false;
  for (const abs of files) {
    let src;
    try { src = fs.readFileSync(abs, "utf8"); } catch { continue; }
    const clean = stripCommentsAndStrings(src);
    if (/\bsetSkipNullEnabled\s*\(\s*true\s*\)|\bsetPropertyCondition\s*\(|\bConditions\s*\.\s*isNotNull\b/.test(clean)) {
      mapperSkipsNulls = true;
    }
    if (/@Entity\b/.test(clean) && /@Builder\s*\.\s*Default\b/.test(clean)) {
      const cls = clean.match(/\bclass\s+(\w+)/);
      if (cls) entitiesWithDefaults.add(cls[1]);
    }
  }
  if (!mapperSkipsNulls && frameworkSkipsCreateNulls()) mapperSkipsNulls = true;
  _createMappingIndex = { entitiesWithDefaults, mapperSkipsNulls };
  return _createMappingIndex;
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
 * @returns `entityBases` - entity class simple name to the base names IT declares the map for,
 *          kept per class because two entities sharing a field name do not share its translation;
 *          `dtoCarries` - DTO class simple name to the base names that class declares the map for
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


// --- Generator inputs and entity bundles -----------------------------------

let _generatorInputIndex = null;
/**
 * The entities that have generator input, by name, each with the controller class names its ymls
 * name (`controllerName`, or the generator's default `<yml name>RestController`). An entity has
 * more than one when a second surface is generated over it from its own yml, whose file name is the
 * class prefix and whose `entity` key names the entity.
 *
 * <p>Read from `.simplix/entity/*.yml` at the backend root. Only the two top-level keys are read,
 * so no yml parser is needed: `entity:` and `controllerName:` are plain scalars at column 0.
 *
 * @param root the backend project root
 * @returns entity name -> the controller class names its ymls expect
 */
function generatorInputIndex(root = ROOT) {
  if (_generatorInputIndex) return _generatorInputIndex;
  const map = new Map();
  const dir = path.join(root, ".simplix", "entity");
  const names = fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => /\.ya?ml$/.test(n)) : [];
  for (const n of names) {
    const src = fs.readFileSync(path.join(dir, n), "utf8");
    const prefix = n.replace(/\.ya?ml$/, "");
    const entity = src.match(/^entity:\s*["']?(\w+)["']?\s*$/m)?.[1] ?? prefix;
    const controller = src.match(/^controllerName:\s*["']?(\w+)["']?\s*$/m)?.[1];
    map.set(entity, [...(map.get(entity) ?? []), controller || `${prefix}RestController`]);
  }
  _generatorInputIndex = map;
  return map;
}

/**
 * The generator inputs themselves, `.simplix/entity/*.yml` at the backend root, as absolute paths.
 * They join the scan beside the Java sources so a rule can judge a yml; the Java indexes never
 * read them.
 *
 * @param root the backend project root
 * @returns absolute paths of the generator ymls
 */
function generatorInputFiles(root = ROOT) {
  const dir = path.join(root, ".simplix", "entity");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((n) => /\.ya?ml$/.test(n)).map((n) => path.join(dir, n));
}

/**
 * The Gradle settings script at the backend root, as an absolute path, so a rule can judge the
 * subprojects it includes. Empty for a build without one.
 *
 * @param root the backend project root
 * @returns the settings script, when there is one
 */
function gradleSettingsFiles(root = ROOT) {
  return ["settings.gradle", "settings.gradle.kts"].map((n) => path.join(root, n)).filter((f) => fs.existsSync(f));
}

/**
 * Whether the build gives each subproject a group derived from its own path, which keeps two
 * subprojects of one name apart. Read from the root build script and the convention plugins
 * (`buildSrc/`, `gradle/build-logic/`): a `group =` assignment that reads the project's path or
 * parent counts.
 *
 * @param root the backend project root
 * @returns true when such an assignment exists
 */
function gradleGroupFromPath(root = ROOT) {
  const scripts = [];
  for (const n of ["build.gradle", "build.gradle.kts"]) scripts.push(path.join(root, n));
  const visit = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory() && e.name !== "build" && e.name !== ".gradle") visit(path.join(dir, e.name));
      else if (/\.gradle(\.kts)?$/.test(e.name)) scripts.push(path.join(dir, e.name));
    }
  };
  visit(path.join(root, "buildSrc"));
  visit(path.join(root, "gradle", "build-logic"));
  return scripts.some((f) => {
    let c;
    try { c = fs.readFileSync(f, "utf8"); } catch { return false; }
    return GRADLE_GROUP_FROM_PATH.test(c);
  });
}

/** A `group` assignment whose value is built from the project's path or its parent. */
const GRADLE_GROUP_FROM_PATH = /\bgroup\s*=[^\n]*\b(path|parent|parentPath)\b|\b(path|parent)\b[^\n]*\n[^\n]*\bgroup\s*=/;

/**
 * The module groups of a grouped multi-module backend (`modules/<group>/<module>`), as the project
 * lists them in `.claude/simplix.json` `audit.moduleGroups`. Which directories are groups is the
 * project's layout to state, so with no list every rule reading this stays silent.
 *
 * @param settings the project's `audit` settings
 * @returns the group directory names
 */
function moduleGroupIndex(settings) {
  const groups = settings?.moduleGroups;
  return new Set(Array.isArray(groups) ? groups.filter((g) => typeof g === "string" && g) : []);
}

let _entityBundleIndex = null;
/**
 * Every `.properties` bundle under a `src/main/resources` of the backend, as
 * `{ file, keys }`, where `file` is relative to the root and `keys` is the set of keys it defines.
 *
 * @param root the backend project root
 * @returns the bundles found
 */
function entityBundleIndex(root = ROOT) {
  if (_entityBundleIndex) return _entityBundleIndex;
  const bundles = [];
  const visit = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!EXCLUDE_DIRS.has(e.name)) visit(abs);
      } else if (e.name.endsWith(".properties")
          && abs.includes(`${path.sep}src${path.sep}main${path.sep}resources${path.sep}`)) {
        let src;
        try { src = fs.readFileSync(abs, "utf8"); } catch { continue; }
        const keys = new Set();
        for (const m of src.matchAll(/^[ \t]*([^#!\s=:][^=:\s]*)[ \t]*[=:]/gm)) keys.add(m[1]);
        bundles.push({ file: path.relative(root, abs), keys });
      }
    }
  };
  visit(path.join(root, "src"));
  for (const d of SRC_ROOTS) visit(path.join(root, d));
  _entityBundleIndex = bundles;
  return bundles;
}

/**
 * The constant names an enum body declares, read from the text after its opening brace up to the
 * first `;` (or the closing brace). Annotations and constructor arguments are dropped first, since
 * either may hold commas.
 *
 * @param body comment- and string-blanked source starting just inside the enum's `{`
 * @returns the constant names in declaration order
 */
function enumConstants(body) {
  let list = body.slice(0, body.search(/[;}]/) < 0 ? body.length : body.search(/[;}]/));
  list = list.replace(/@[\w.]+/g, " ");
  for (let prev = ""; prev !== list;) { prev = list; list = list.replace(/\([^()]*\)/g, " "); }
  return list.split(",").map((s) => s.trim()).filter((s) => /^[A-Z][A-Z0-9_]*$/.test(s));
}

/**
 * The `enums.*` keys each locale ships, keyed by the locale a bundle's file name carries
 * (`_ko`, `_pt_BR`; none is `default`). Only bundles holding at least one `enums.` key count, so
 * the locales come from the project's own enum bundles and are never a list written here.
 *
 * @param bundles the `{ file, keys }` index of every main-resources bundle
 * @returns locale -> union of the enum keys its bundles define
 */
function enumBundleLocales(bundles) {
  const byLocale = new Map();
  for (const b of bundles) {
    const enumKeys = [...b.keys].filter((k) => k.startsWith("enums."));
    if (!enumKeys.length) continue;
    const locale = path.basename(b.file).match(/_([a-z]{2,3}(?:_[A-Z]{2})?)\.properties$/)?.[1] ?? "default";
    if (!byLocale.has(locale)) byLocale.set(locale, new Set());
    for (const k of enumKeys) byLocale.get(locale).add(k);
  }
  return byLocale;
}

/** Field-name suffixes that mark display text in any project; `audit.i18nDisplayText.namePattern` replaces them. */
const DISPLAY_TEXT_NAME = "^(?:name|title|label|description|summary|message|subject|body)$|[a-z0-9](?:Name|Title|Label|Description|Summary|Message|Subject|Body)$";
/** Column-comment words that mark display text; `audit.i18nDisplayText.commentPattern` replaces them. */
const DISPLAY_TEXT_COMMENT = "\\b(?:display name|display text|shown as|title|label|caption|headline)\\b";

/**
 * What `display-text-without-i18n` reads as display text, and which fields a project has judged
 * to stay in one language. Both come from the `audit` section of `.claude/simplix.json`:
 *
 * @example
 * { "audit": {
 *     "i18nDisplayText": { "namePattern": "<regex>", "commentPattern": "<regex>" },
 *     "i18nAllow": [{ "entity": "<Entity>", "field": "<field>", "reason": "<why it stays single-language>" }]
 * } }
 *
 * An allow entry with an empty reason suppresses nothing, as with the line marker.
 *
 * @param audit the project's `audit` settings
 * @returns the two patterns and an allow-list lookup
 */
function displayTextPolicy(audit = {}) {
  const cfg = audit?.i18nDisplayText ?? {};
  const allow = (Array.isArray(audit?.i18nAllow) ? audit.i18nAllow : [])
    .filter((a) => a && typeof a.reason === "string" && a.reason.trim());
  return {
    name: new RegExp(cfg.namePattern ?? DISPLAY_TEXT_NAME),
    comment: new RegExp(cfg.commentPattern ?? DISPLAY_TEXT_COMMENT, "i"),
    allowed: (entity, field) => allow.some((a) => a.entity === entity && a.field === field),
  };
}

/** The entity type argument of `extends SimpliXBaseController<E, ...>`, or null. */
function baseControllerEntity(clean) {
  return clean.match(/\bclass\s+(\w+)\s+extends\s+SimpliXBaseController\s*<\s*(\w+)\s*,/) ?? null;
}

// --- Duplicate DTO simple names ------------------------------------------------

// SimpliX Meta keys every DTO it reaches from a controller by the Java SIMPLE name of the class
// (`MetaTypeRegistry.typeName` is `getSimpleName`, and `register` throws on a second class with
// the same name), so two DTOs named alike in different packages, or as inner classes of two DTO
// containers, make `GET /api/v1/dev/meta/dto` answer 409 and stop the frontend codegen.
const DTO_NAME = /D(?:TO|to)$/;
const DTO_CONTAINER_FILE = /D(?:TO|to)s\.java$/;
const BODY_NAME = /(?:Request|Response|Body|Payload)$/;

/**
 * Every class, record and interface a source declares, with its extent and nesting depth.
 *
 * @param clean the source with comments and strings blanked
 * @returns one entry per declaration: simple name, 1-based line, offsets, and how many other
 *          declarations of this file contain it
 */
function declaredTypes(clean) {
  const out = [];
  for (const m of clean.matchAll(/\b(?:class|interface|record)\s+([A-Z]\w*)/g)) {
    if (m.index > 0 && clean[m.index - 1] === ".") continue; // `Thing.class`
    const open = clean.indexOf("{", m.index);
    if (open < 0) continue;
    let depth = 0;
    let end = clean.length;
    for (let j = open; j < clean.length; j += 1) {
      if (clean[j] === "{") depth += 1;
      else if (clean[j] === "}") { depth -= 1; if (depth === 0) { end = j + 1; break; } }
    }
    out.push({ name: m[1], start: m.index, end, line: clean.slice(0, m.index).split("\n").length });
  }
  for (const d of out) d.depth = out.filter((o) => o !== d && o.start < d.start && o.end >= d.end).length;
  return out;
}

/**
 * Whether a declaration is a type SimpliX Meta can register: a name ending in `DTO`, or a direct
 * member of a `*DTOs` container; or, as a weaker signal, a request or response body name.
 *
 * @param rel the declaring file's path
 * @param type an entry of `declaredTypes`
 * @returns "dto", "body", or null for a type this rule leaves alone
 */
function dtoKind(rel, type) {
  if (DTO_NAME.test(type.name)) return "dto";
  if (DTO_CONTAINER_FILE.test(rel) && type.depth === 1) return "dto";
  if (BODY_NAME.test(type.name)) return "body";
  return null;
}

/**
 * The DTO-shaped declarations of the backend by simple name, and which of those names a controller
 * reaches.
 *
 * <p>Reachability is read from identifiers, not resolved: a name is reached when a controller
 * mentions it, or when a DTO-shaped type that is reached mentions it. A name that two classes
 * share counts as reached when either is. The spread is toward reaching more, which is why a
 * duplicate that nothing reaches is reported as a review candidate and not as an error.
 *
 * @param sources `{ rel, src }` for every main-source Java file
 * @returns `decls` (name to `{ rel, line, kind }` entries) and `reachable` (a set of names)
 */
function buildDtoNameIndex(sources) {
  const decls = new Map();
  const mentions = new Map();
  const controllerWords = new Set();
  for (const { rel, src } of sources) {
    const clean = stripCommentsAndStrings(src);
    const types = declaredTypes(clean);
    for (const t of types) {
      const kind = dtoKind(rel, t);
      if (!kind) continue;
      // Words in the type's own text, without the types nested inside it: a container that holds
      // twenty DTOs mentions none of them by being mentioned.
      let own = "";
      let at = t.start;
      for (const c of types.filter((o) => o !== t && o.start > t.start && o.end <= t.end).sort((a, b) => a.start - b.start)) {
        if (c.start < at) continue;
        own += clean.slice(at, c.start);
        at = c.end;
      }
      own += clean.slice(at, t.end);
      const list = decls.get(t.name) ?? [];
      list.push({ rel, line: t.line, kind });
      decls.set(t.name, list);
      const words = mentions.get(t.name) ?? new Set();
      for (const w of own.matchAll(/[A-Za-z_$][\w$]*/g)) words.add(w[0]);
      mentions.set(t.name, words);
    }
    if (isController(rel) || /@(?:Rest)?Controller\b/.test(clean)) {
      for (const w of clean.matchAll(/[A-Za-z_$][\w$]*/g)) controllerWords.add(w[0]);
    }
  }
  const reachable = new Set([...controllerWords].filter((w) => decls.has(w)));
  const queue = [...reachable];
  while (queue.length) {
    for (const w of mentions.get(queue.pop()) ?? []) {
      if (decls.has(w) && !reachable.has(w)) { reachable.add(w); queue.push(w); }
    }
  }
  return { decls, reachable };
}

/** The index over the repository's main sources, with paths relative to the audited root. */
function dtoNameIndex(files, root = ROOT) {
  const sources = [];
  for (const abs of files) {
    try { sources.push({ rel: path.relative(root, abs), src: fs.readFileSync(abs, "utf8") }); } catch { /* unreadable: skipped like every other index */ }
  }
  return buildDtoNameIndex(sources);
}

/**
 * The DTO declarations of one file whose simple name another declaration already holds.
 *
 * <p>Only the later declaration of a pair is reported, naming the first, so one collision is one
 * hit. A DTO-shaped name that a controller reaches is an error; one nothing reaches, and a
 * request or response body name that a controller reaches, are review candidates, because
 * neither is known to be registered by Meta.
 *
 * @param content the file's source
 * @param rel the file's path relative to the audited root
 * @param ctx carries `dtoNames`
 * @param level the level of the rule asking
 * @returns the hits of that level
 */
function duplicateDtoNameHits(content, rel, ctx, level) {
  const index = ctx?.dtoNames;
  if (!index) return [];
  const out = [];
  for (const t of declaredTypes(stripCommentsAndStrings(content))) {
    const kind = dtoKind(rel, t);
    if (!kind) continue;
    const others = (index.decls.get(t.name) ?? []).filter((e) => e.kind === kind && !(e.rel === rel && e.line === t.line));
    if (!others.length) continue;
    const all = [...others, { rel, line: t.line }].sort((a, b) => a.rel.localeCompare(b.rel) || a.line - b.line);
    const first = all[0];
    if (first.rel === rel && first.line === t.line) continue;
    const reached = index.reachable.has(t.name);
    const asked = kind === "dto" ? (reached ? "error" : "review") : (reached ? "review" : null);
    if (asked !== level) continue;
    out.push({ line: t.line, excerpt: `${t.name} is also declared at ${first.rel}:${first.line}` });
  }
  return out;
}

/**
 * What each controller declares at class level for the entity it serves, keyed by entity: the
 * declarations SimpliX Meta keeps one value of per entity, so two controllers that differ flip it.
 *
 * <p>The entity is read from `extends SimpliXBaseController<Entity, ...>`; a controller without the
 * declaration `of` reads is left out.
 *
 * @param sources `{ rel, src }` of the main sources
 * @param of reads one source to `{ entity, line, value }`, or null
 * @returns entity name to `[{ rel, line, value }]`, in path order
 */
function buildEntityDeclarationIndex(sources, of) {
  const byEntity = new Map();
  for (const { rel, src } of [...sources].sort((a, b) => a.rel.localeCompare(b.rel))) {
    const own = of(src);
    if (!own) continue;
    if (!byEntity.has(own.entity)) byEntity.set(own.entity, []);
    byEntity.get(own.entity).push({ rel, line: own.line, value: own.value });
  }
  return byEntity;
}

/** The default sort index: `@SimpliXDefaultSort(field = ..., direction = ...)` per controller. */
function buildDefaultSortIndex(sources) {
  return buildEntityDeclarationIndex(sources, defaultSortOf);
}

/** The list figures index: `@SimpliXListFigures(statusCounts = ..., aggregates = ...)` per controller. */
function buildListFiguresIndex(sources) {
  return buildEntityDeclarationIndex(sources, listFiguresOf);
}

/** The entity and the default sort one controller source declares, or null. */
function defaultSortOf(src) {
  const base = /extends\s+SimpliXBaseController\s*<\s*(\w+)\s*,/.exec(src);
  const sort = /@SimpliXDefaultSort\s*\(([^)]*)\)/.exec(src);
  if (!base || !sort) return null;
  const field = /field\s*=\s*"([^"]*)"/.exec(sort[1])?.[1] ?? "";
  const direction = (/direction\s*=\s*"([^"]*)"/.exec(sort[1])?.[1] ?? "desc").toLowerCase();
  return { entity: base[1], line: src.slice(0, sort.index).split("\n").length, value: `${field} ${direction}` };
}

/**
 * The entity and the entity-level list figures one controller source declares, or null: the status
 * counts and the aggregates, in declared order, which is the order Meta writes them. The time axis is
 * published per operation only, so it is not read.
 */
function listFiguresOf(src) {
  const base = /extends\s+SimpliXBaseController\s*<\s*(\w+)\s*,/.exec(src);
  const open = /@SimpliXListFigures\s*\(/.exec(src);
  if (!base || !open) return null;
  let depth = 0;
  let end = open.index + open[0].length - 1;
  for (; end < src.length; end++) {
    if (src[end] === "(") depth++;
    else if (src[end] === ")" && --depth === 0) break;
  }
  const body = src.slice(open.index + open[0].length, end);
  const counted = /statusCounts\s*=\s*(\{[^}]*\}|"[^"]*")/.exec(body)?.[1] ?? "";
  const statusCounts = [...counted.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
  const aggregates = [...body.matchAll(/Figure\s*\(([^)]*)\)/g)].map((m) =>
    `${/field\s*=\s*"([^"]*)"/.exec(m[1])?.[1] ?? ""} ${/op\s*=\s*"([^"]*)"/.exec(m[1])?.[1] ?? ""}`.trim());
  return {
    entity: base[1],
    line: src.slice(0, open.index).split("\n").length,
    value: `status counts [${statusCounts.join(", ")}], aggregates [${aggregates.join(", ")}]`,
  };
}

/** Reads every main source once, with paths relative to the audited root. */
function mainSources(files, root = ROOT) {
  const sources = [];
  for (const abs of files) {
    try { sources.push({ rel: path.relative(root, abs), src: fs.readFileSync(abs, "utf8") }); } catch { /* unreadable: skipped like every other index */ }
  }
  return sources;
}

/**
 * The entity fields a stored file's path is written into: every `.x(<expr>.storedPath())` builder
 * call and `setX(<expr>.storedPath())` setter in a main source, by field name. The SimpliX file
 * store's path is its group, the date folders and a UUID name with the extension, so it runs to
 * 66 characters with a short group and grows with the group's name.
 */
function buildStoredPathIndex(sources) {
  const fields = new Set();
  for (const { src } of sources) {
    for (const m of stripCommentsAndStrings(src).matchAll(/\.(\w+)\(\s*[\w.()]*?\bstoredPath\(\)\s*\)/g)) {
      const name = m[1].startsWith("set") && m[1].length > 3 ? m[1][3].toLowerCase() + m[1].slice(4) : m[1];
      fields.add(name);
    }
  }
  return fields;
}

/** The stored path index over the repository's main sources. */
function storedPathIndex(files, root = ROOT) {
  return buildStoredPathIndex(mainSources(files, root));
}

/** The default sort index over the repository's main sources. */
function defaultSortIndex(files, root = ROOT) {
  return buildDefaultSortIndex(mainSources(files, root));
}

/** The list figures index over the repository's main sources. */
function listFiguresIndex(files, root = ROOT) {
  return buildListFiguresIndex(mainSources(files, root));
}

/**
 * The later of two controllers over one entity whose declarations differ, as a hit naming the
 * first; nothing for the first controller in path order, for a controller that declares nothing,
 * and for one that declares what the first does.
 */
function entityDeclarationDiffers(c, rel, index, of, describe) {
  if (!index) return [];
  const own = of(c);
  if (!own) return [];
  const all = index.get(own.entity) ?? [];
  const first = all.find((e) => e.rel !== rel);
  if (!first || first.value === own.value) return [];
  const firstIndex = all.findIndex((e) => e.rel === first.rel);
  const ownIndex = all.findIndex((e) => e.rel === rel);
  if (ownIndex >= 0 && ownIndex < firstIndex) return [];
  return [{ line: own.line, excerpt: describe(own, first) }];
}

/** The two files of the incident shape, as sources for `buildDtoNameIndex`. */
function twinDtoSources(secondName) {
  return [
    { rel: "modules/admin/thing/src/main/java/app/web/thing/dto/AdminThingDTOs.java", src: `public class AdminThingDTOs {\n    public static class ThingListDTO { private String name; }\n}\n` },
    { rel: "modules/portal/thing/src/main/java/app/web/thing/dto/PortalThingDTOs.java", src: `public class PortalThingDTOs {\n    public static class ${secondName} { private String name; }\n}\n` },
    { rel: "modules/admin/thing/src/main/java/app/web/thing/AdminThingController.java", src: `public class AdminThingController { ThingListDTO list() { return null; } }\n` },
  ];
}

function resetIndexes() { _createMappingIndex = null; _entityIdIndex = null; _i18nIndex = null; _generatorInputIndex = null; _entityBundleIndex = null; }

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
    id: "entity-without-generator-input",
    invariant: "#15",
    level: "error",
    desc: "A controller extends SimpliXBaseController<E, ...> while E has no .simplix/entity/E.yml - the surface is maintained by hand, so the generator can never regenerate it and every contract gap has to be closed in Java. Write the yml (`yo simplix:config E`), generate, diff and promote; an internalized child has no controller at all",
    appliesTo: isController,
    check: (c, _rel, ctx) => {
      const inputs = ctx?.generatorInputs;
      if (!inputs) return [];
      const clean = stripCommentsAndStrings(c);
      const m = baseControllerEntity(clean);
      if (!m || inputs.has(m[2])) return [];
      return [{ line: clean.slice(0, m.index).split("\n").length, excerpt: `${m[1]} serves ${m[2]}, and .simplix/entity/${m[2]}.yml does not exist` }];
    },
    samples: {
      file: "modules/user/src/main/java/app/web/user/controller/AdminThingRestController.java",
      ctx: { generatorInputs: new Map([["Other", ["OtherRestController"]]]) },
      broken: `public class AdminThingRestController extends SimpliXBaseController<Thing, String> {\n}`,
      fixed: `public class AdminThingRestController extends SimpliXBaseController<Other, String> {\n}`,
      miss: [
        {
          note: "a non-CRUD controller that extends no SimpliX base",
          source: `@SimpliXStandardApi\npublic class ThingReportRestController {\n}`,
          ctx: { generatorInputs: new Map() },
        },
      ],
    },
  },
  {
    id: "gradle-subprojects-share-a-name",
    invariant: "build/module-coordinates",
    level: "error",
    desc: "Two included Gradle subprojects end in the same name (`:modules:admin:<x>` and `:modules:common:<x>`) while every subproject takes one shared group. Their coordinates (group:name) are equal, so Gradle resolves them as a single module and the application's classpath carries only one of them: the other compiles and passes its own tests while its controllers answer 404 on the running server. Derive the group from the project's path in the convention plugin (`group = rootGroup + parentPath`), name library jars after the full path so the boot archive does not overwrite one with the other, or rename one subproject",
    appliesTo: (p) => /^settings\.gradle(\.kts)?$/.test(p.split(path.sep).join("/")),
    check: (c, _rel, ctx) => {
      if (ctx?.gradleGroupFromPath) return [];
      const seen = new Map();
      const out = [];
      c.split("\n").forEach((l, i) => {
        if (/^\s*\/\//.test(l) || !/^\s*include\b/.test(l)) return;
        for (const m of l.matchAll(/["'](:?[\w.-]+(?::[\w.-]+)*)["']/g)) {
          const projectPath = m[1].startsWith(":") ? m[1] : `:${m[1]}`;
          const name = projectPath.split(":").pop();
          const first = seen.get(name);
          if (first && first.path !== projectPath) {
            out.push({ line: i + 1, excerpt: `${projectPath} and ${first.path} (line ${first.line}) are both named "${name}"` });
          } else if (!first) {
            seen.set(name, { path: projectPath, line: i + 1 });
          }
        }
      });
      return out;
    },
    samples: {
      file: "settings.gradle",
      ctx: { gradleGroupFromPath: false },
      broken: `rootProject.name = 'shop'\ninclude ':modules:admin:order'\ninclude ':modules:common:order'\n`,
      fixed: `rootProject.name = 'shop'\ninclude ':modules:admin:order'\ninclude ':modules:common:order-feed'\n`,
      hit: [
        { note: "Kotlin DSL with several projects on one line", source: `include(":a:report", ":b:report")\n` },
      ],
      miss: [
        {
          note: "a build whose convention plugin derives the group from the path",
          source: `include ':modules:admin:order'\ninclude ':modules:common:order'\n`,
          ctx: { gradleGroupFromPath: true },
        },
        { note: "a commented-out include", source: `include ':a:order'\n// include ':b:order'\n` },
      ],
    },
  },
  {
    id: "generator-module-outside-the-groups",
    invariant: "generator/promote-workflow",
    level: "error",
    desc: "A generator yml's `modulePath` or `promoteModule` starts with a segment that is not one of the module groups the project lists in `.claude/simplix.json` `audit.moduleGroups`. Nothing refuses it: generate and promote create `modules/<that segment>` beside the groups, a module no group owns and no fence sees. Name the group first (`promoteModule: <group>/<module>`, not `<module>`); with no list the rule is silent",
    appliesTo: (p) => /(^|\/)\.simplix\/entity\/[^/]+\.ya?ml$/.test(p.split(path.sep).join("/")),
    check: (c, _rel, ctx) => {
      const groups = ctx?.moduleGroups;
      if (!groups || groups.size === 0) return [];
      const out = [];
      const lines = c.split("\n");
      lines.forEach((l, i) => {
        const m = l.match(/^(modulePath|promoteModule):\s*["']?([\w./-]+)["']?\s*(?:#.*)?$/);
        if (!m) return;
        const first = m[2].split("/")[0];
        if (!groups.has(first)) {
          out.push({ line: i + 1, excerpt: `${m[1]}: ${m[2]} - "${first}" is not a module group (${[...groups].sort().join(", ")})` });
        }
      });
      return out;
    },
    samples: {
      file: ".simplix/entity/Order.yml",
      ctx: { moduleGroups: new Set(["internal", "public"]) },
      broken: `entity: Order\nmodulePath: sales\npromoteModule: sales\nthymeleafBaseDir: internal/sales/order\n`,
      fixed: `entity: Order\nmodulePath: internal/sales\npromoteModule: internal/sales\nthymeleafBaseDir: internal/sales/order\n`,
      hit: [
        { note: "a quoted value whose first segment is no group", source: `promoteModule: "catalog/item"\n` },
      ],
      miss: [
        {
          note: "a project that lists no module groups",
          source: `modulePath: sales\npromoteModule: sales\n`,
          ctx: { moduleGroups: new Set() },
        },
        {
          note: "a deeper path inside a group",
          source: `modulePath: public/main/audit\npromoteModule: public/main\n`,
        },
      ],
    },
  },
  {
    id: "date-search-field-with-exclusive-bounds",
    invariant: "review/searchable-field-patterns",
    level: "error",
    desc: "A temporal SearchDTO field offers GREATER_THAN / LESS_THAN without GREATER_THAN_OR_EQUAL_TO / LESS_THAN_OR_EQUAL_TO - the frontend's date range filter writes the inclusive pair, so every ranged read answers SEARCH_INVALID_PARAMETER and the list shows a load failure. Declare `greaterThanOrEqual, lessThanOrEqual, between` in the yml and regenerate (the generator's default for Instant, LocalDate, LocalTime and the datetime types); where the bounds really are exclusive, mark the field with `simplix-audit-ignore[date-search-field-with-exclusive-bounds]` and the reason",
    appliesTo: isDtoContainer,
    check: (c) => {
      const clean = stripCommentsAndStrings(c);
      const hits = [];
      const field = /@SearchableField\s*\(([^)]*)\)\s*(?:@[\w.]+(?:\([^)]*\))?\s*)*private\s+(?:Instant|LocalDate|LocalTime|LocalDateTime|OffsetDateTime|ZonedDateTime)\s+(\w+)/g;
      for (const m of clean.matchAll(field)) {
        const operators = m[1];
        const exclusive = /\b(?:GREATER_THAN|LESS_THAN)\b(?!_)/.test(operators);
        const inclusive = /\bGREATER_THAN_OR_EQUAL_TO\b/.test(operators) && /\bLESS_THAN_OR_EQUAL_TO\b/.test(operators);
        if (!exclusive || inclusive) continue;
        hits.push({ line: clean.slice(0, m.index).split("\n").length, excerpt: `${m[2]} offers exclusive bounds only` });
      }
      return hits;
    },
    samples: {
      file: "modules/order/src/main/java/app/web/order/dto/OrderDTOs.java",
      broken: `public class OrderDTOs {\n    public static class OrderSearchDTO {\n        @FieldLabel("{entities.Order.placedAt}")\n        @SearchableField(entityField = "placedAt", operators = {GREATER_THAN, LESS_THAN, BETWEEN}, sortable = true)\n        private Instant placedAt;\n    }\n}`,
      fixed: `public class OrderDTOs {\n    public static class OrderSearchDTO {\n        @FieldLabel("{entities.Order.placedAt}")\n        @SearchableField(entityField = "placedAt", operators = {GREATER_THAN_OR_EQUAL_TO, LESS_THAN_OR_EQUAL_TO, BETWEEN}, sortable = true)\n        private Instant placedAt;\n    }\n}`,
      hit: [
        {
          note: "a LocalDate field with the exclusive pair",
          source: `public class RoleDTOs {\n    public static class RoleSearchDTO {\n        @SearchableField(entityField = "validFrom", operators = {BETWEEN, GREATER_THAN, LESS_THAN}, sortable = true)\n        private LocalDate validFrom;\n    }\n}`,
        },
        {
          note: "a LocalTime field with the exclusive pair",
          source: `public class ShiftDTOs {\n    public static class ShiftSearchDTO {\n        @SearchableField(entityField = "startsAt", operators = {GREATER_THAN, LESS_THAN})\n        private LocalTime startsAt;\n    }\n}`,
        },
        {
          note: "only one inclusive bound beside an exclusive one",
          source: `public class OrderDTOs {\n    public static class OrderSearchDTO {\n        @SearchableField(entityField = "placedAt", operators = {GREATER_THAN_OR_EQUAL_TO, LESS_THAN, BETWEEN})\n        private Instant placedAt;\n    }\n}`,
        },
      ],
      miss: [
        {
          note: "a number field with exclusive bounds",
          source: `public class OrderDTOs {\n    public static class OrderSearchDTO {\n        @SearchableField(entityField = "total", operators = {GREATER_THAN, LESS_THAN, BETWEEN})\n        private Long total;\n    }\n}`,
        },
        {
          note: "a date field offering both kinds of bound",
          source: `public class OrderDTOs {\n    public static class OrderSearchDTO {\n        @SearchableField(operators = {GREATER_THAN, LESS_THAN, GREATER_THAN_OR_EQUAL_TO, LESS_THAN_OR_EQUAL_TO})\n        private LocalDate dueOn;\n    }\n}`,
        },
      ],
    },
  },
  {
    id: "controller-name-not-from-yml",
    invariant: "#15",
    level: "error",
    desc: "The controller of a yml-backed entity is not the class the yml names (`controllerName`, default `<Entity>RestController`) - promote moves the generated file of the yml's name, so a second controller lands on the same @RequestMapping, or the live one is renamed and every operation id the frontend is keyed on changes. Set `controllerName` to the live class name",
    appliesTo: isController,
    check: (c, _rel, ctx) => {
      const inputs = ctx?.generatorInputs;
      if (!inputs) return [];
      const clean = stripCommentsAndStrings(c);
      const m = baseControllerEntity(clean);
      if (!m || !inputs.has(m[2])) return [];
      const expected = inputs.get(m[2]);
      if (expected.includes(m[1])) return [];
      return [{ line: clean.slice(0, m.index).split("\n").length, excerpt: `${m[1]} serves ${m[2]}, whose yml names ${expected.join(" or ")}` }];
    },
    samples: {
      file: "modules/user/src/main/java/app/web/user/controller/AdminThingRestController.java",
      ctx: { generatorInputs: new Map([["Thing", ["ThingRestController"]]]) },
      broken: `public class AdminThingRestController extends SimpliXBaseController<Thing, String> {\n}`,
      fixed: `public class ThingRestController extends SimpliXBaseController<Thing, String> {\n}`,
      miss: [
        {
          note: "a yml that names the Admin controller through controllerName",
          source: `public class AdminThingRestController extends SimpliXBaseController<Thing, String> {\n}`,
          ctx: { generatorInputs: new Map([["Thing", ["AdminThingRestController"]]]) },
        },
        {
          note: "a second surface generated over the same entity from its own yml",
          source: `public class MyThingRestController extends SimpliXBaseController<Thing, String> {\n}`,
          ctx: { generatorInputs: new Map([["Thing", ["AdminThingRestController", "MyThingRestController"]]]) },
        },
      ],
    },
  },
  {
    id: "json-value-labeled-enum-stored-as-label",
    invariant: "field-types",
    level: "error",
    desc: "An entity's JSON column holds a value type whose labelled-enum component or field carries no `@JsonSerialize` - the column is written through the application's ObjectMapper, whose enum serializer writes each constant as the API's `{label, value}` object in the storing request's language. Serialize the component by name (`@JsonSerialize(using = ToStringSerializer.class)`) and answer the API with a DTO of its own (entity/field-types.md § An enum inside a JSON value)",
    appliesTo: (p) => /\/entity\/[^/]+\.java$/.test(p.split(path.sep).join("/")),
    check: (c, rel, ctx) => {
      const values = ctx?.jsonValueEnums;
      const clean = stripCommentsAndStrings(c);
      if (!values || !values.size || !/@Entity\b/.test(clean)) return [];
      const hits = [];
      for (const m of clean.matchAll(/\bprivate\s+([\w<>,\s?]+?)\s+(\w+)\s*[;=]/g)) {
        const before = clean.slice(0, m.index);
        const start = Math.max(before.lastIndexOf(";"), before.lastIndexOf("{"), before.lastIndexOf("}"));
        const annotations = before.slice(start + 1);
        if (!/@JdbcTypeCode\s*\(\s*SqlTypes\.JSON\b|@Type\s*\(\s*JsonType\.class/.test(annotations)) continue;
        for (const name of m[1].match(/\b[A-Z]\w*\b/g) ?? []) {
          const held = values.get(name);
          if (held) hits.push({ line: before.split("\n").length, excerpt: `${m[2]} stores ${name}, whose ${held.join(", ")} would be written as label objects` });
        }
      }
      return hits;
    },
    samples: {
      file: "packages/domain-user/src/main/java/app/domain/user/entity/Report.java",
      ctx: { jsonValueEnums: jsonValueEnumsIn([
        "public record CheckResult(@FieldLabel(\"{entities.CheckResult.check}\") Check check, Status status) {}",
        "public enum Check implements LabeledEnum { NETWORK }",
        "public enum Status implements LabeledEnum { PASSED }",
      ], new Set(["Check", "Status"])) },
      broken: `@Entity\npublic class Report {\n    @JdbcTypeCode(SqlTypes.JSON)\n    @Column(name = "checks", nullable = false)\n    private List<CheckResult> checks;\n}`,
      fixed: `@Entity\npublic class Report {\n    @JdbcTypeCode(SqlTypes.JSON)\n    @Column(name = "labels")\n    private Map<String, String> labels;\n}`,
      hit: [
        {
          note: "a class-shaped value type mapped with the Hypersistence JsonType",
          source: `@Entity\npublic class Report {\n    @Type(JsonType.class)\n    private Settings settings;\n}`,
          ctx: { jsonValueEnums: jsonValueEnumsIn([
            "public class Settings {\n    private Check check;\n    private String note;\n}",
          ], new Set(["Check"])) },
        },
      ],
      miss: [
        {
          note: "the components serialize by name",
          source: `@Entity\npublic class Report {\n    @JdbcTypeCode(SqlTypes.JSON)\n    private List<CheckResult> checks;\n}`,
          ctx: { jsonValueEnums: jsonValueEnumsIn([
            "public record CheckResult(@JsonSerialize(using = ToStringSerializer.class) Check check,\n        @FieldLabel(\"{x}\") @JsonSerialize(using = ToStringSerializer.class) Status status) {}",
          ], new Set(["Check", "Status"])) },
        },
        {
          note: "the value type held in a field that is not a JSON column",
          source: `@Entity\npublic class Report {\n    @Transient\n    private CheckResult last;\n}`,
        },
        {
          note: "an enum that is not labelled",
          source: `@Entity\npublic class Report {\n    @JdbcTypeCode(SqlTypes.JSON)\n    private List<Plain> rows;\n}`,
          ctx: { jsonValueEnums: jsonValueEnumsIn(["public record Plain(Kind kind) {}"], new Set(["Check"])) },
        },
      ],
    },
  },
  {
    id: "id-collection-without-references",
    invariant: "reference-field-patterns",
    level: "error",
    desc: "An @ElementCollection of id strings named `*Ids` carries no @References(Target.class) - JPA maps no relation for it, so SimpliX Meta cannot say what the ids point at and a screen has to hand-write the peek labels and the picker",
    appliesTo: (p) => /\/entity\/[^/]+\.java$/.test(p.split(path.sep).join("/")),
    check: (c) => {
      const clean = stripCommentsAndStrings(c);
      const hits = [];
      // The field's annotations are everything since the previous statement or block end:
      // annotation arguments nest parentheses (@CollectionTable(joinColumns = @JoinColumn(...))),
      // which a parenthesis-free pattern cannot step over.
      for (const m of clean.matchAll(/\bprivate\s+(?:List|Set|Collection)\s*<\s*String\s*>\s+(\w+Ids)\b/g)) {
        const before = clean.slice(0, m.index);
        const start = Math.max(before.lastIndexOf(";"), before.lastIndexOf("{"), before.lastIndexOf("}"));
        const annotations = before.slice(start + 1);
        if (!/@ElementCollection\b/.test(annotations) || /@References\b/.test(annotations)) continue;
        hits.push({ line: before.split("\n").length, excerpt: `${m[1]} is an @ElementCollection of ids without @References` });
      }
      return hits;
    },
    samples: {
      file: "packages/domain-user/src/main/java/app/domain/user/entity/Account.java",
      broken: `public class Account {\n    @ElementCollection\n    @CollectionTable(name = "account_roles")\n    private Set<String> roleIds = new HashSet<>();\n}`,
      fixed: `public class Account {\n    @ElementCollection\n    @CollectionTable(name = "account_roles")\n    @References(Role.class)\n    private Set<String> roleIds = new HashSet<>();\n}`,
      hit: [
        {
          note: "annotation arguments that nest parentheses",
          source: `public class Account {\n    @ElementCollection\n    @CollectionTable(\n        name = "account_roles",\n        joinColumns = @JoinColumn(name = "account_id",\n                foreignKey = @ForeignKey(name = "fk"))\n    )\n    @Column(name = "role_id", length = 36)\n    @Builder.Default\n    private Set<String> roleIds = new HashSet<>();\n}`,
        },
      ],
      miss: [
        {
          note: "nested annotation arguments with @References present",
          source: `public class Account {\n    @ElementCollection\n    @CollectionTable(\n        name = "account_roles",\n        joinColumns = @JoinColumn(name = "account_id")\n    )\n    @References(Role.class)\n    private Set<String> roleIds = new HashSet<>();\n}`,
        },
        {
          note: "an element collection of values that are not ids",
          source: `public class Account {\n    @ElementCollection\n    private Set<String> notificationOptOuts = new HashSet<>();\n}`,
        },
      ],
    },
  },
  {
    id: "entity-bundle-without-plural",
    invariant: "#16",
    level: "error",
    desc: "A label bundle names the entity (`entities.<E>=`) but not its plural (`entities.<E>._plural=`) - SimpliX Meta then publishes no plural for that locale, and the empty-state, not-found and tile copy a template draws from it falls back to the singular or to nothing",
    appliesTo: (p) => /\/entity\/[^/]+\.java$/.test(p.split(path.sep).join("/")),
    check: (c, rel, ctx) => {
      const bundles = ctx?.bundles;
      const clean = stripCommentsAndStrings(c);
      if (!bundles || !/@Entity\b/.test(clean)) return [];
      const entity = clean.match(/\bclass\s+(\w+)/)?.[1] ?? path.basename(rel, ".java");
      return bundles
        .filter((b) => b.keys.has(`entities.${entity}`) && !b.keys.has(`entities.${entity}._plural`))
        .map((b) => ({ line: 1, excerpt: `${b.file} defines entities.${entity} without entities.${entity}._plural` }));
    },
    samples: {
      file: "packages/domain-user/src/main/java/app/domain/user/entity/Account.java",
      ctx: { bundles: [{ file: "x/src/main/resources/messages/entities-account_ko.properties", keys: new Set(["entities.Account", "entities.Account.email"]) }] },
      broken: `@Entity\npublic class Account {\n}`,
      fixed: `@Entity\npublic class Other {\n}`,
      hit: [
        {
          note: "the plural present in one locale and missing in another",
          source: `@Entity\npublic class Account {\n}`,
          ctx: { bundles: [
            { file: "x/src/main/resources/messages/entities-account.properties", keys: new Set(["entities.Account", "entities.Account._plural"]) },
            { file: "x/src/main/resources/messages/entities-account_ko.properties", keys: new Set(["entities.Account"]) },
          ] },
        },
      ],
      miss: [
        {
          note: "every locale carries the plural",
          source: `@Entity\npublic class Account {\n}`,
          ctx: { bundles: [{ file: "x/src/main/resources/messages/entities-account.properties", keys: new Set(["entities.Account", "entities.Account._plural"]) }] },
        },
      ],
    },
  },
  {
    id: "not-blank-on-a-meaningfully-empty-field",
    invariant: "validation-patterns / frontend #34",
    level: "error",
    desc: "A create/update DTO field carrying `@NotBlank` whose entity counterpart is a non-null column initialised to `\"\"`: the empty string is one of that field's values, not the absence of one. A scope key whose empty case means 「the whole installation」 is the shape this takes, and the constraint then refuses every write of exactly those records while every workplace-scoped one saves: the screen works on some rows and not others, and the refusal names a field no form draws. `@NotNull` is the constraint that was meant, since the column still refuses null",
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
          note: "a required field whose entity has no empty default - blank really is absent there",
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
    invariant: "validation-patterns / frontend #34",
    level: "error",
    desc: "A create/update DTO field carrying `@NotNull` or `@NotBlank` that the entity's own service writes over whatever the request sent: the caller forced onto the record, a state read off the dates, a name looked up from an account. Bean validation runs BEFORE the service is entered, so the constraint refuses every request the form can send while the field it names has no control on the screen and cannot grow one: the reader is told to correct something that is not there. It typechecks, it passes the service's own unit tests (they call the service directly and never meet validation), and the save can never succeed. Drop the constraint: the field stays, tolerated and ignored, and the service's tests keep proving it is overwritten",
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
        // unrequirable when BOTH write paths overwrite it - one that create forces and update
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
          note: "an id the CREATE path takes from the URL and the UPDATE path reads and compares - found as a false positive in a real repository, which is why the index keeps the two write paths apart",
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
    id: "create-request-overwrites-entity-default",
    invariant: "framework/runtime-behaviour / canonical-service",
    level: "error",
    desc: "A service copies a create request onto a new entity with `modelMapper.map(createDto, entity)` while entities in the project declare defaults (`@Builder.Default`) and neither the project nor the SimpliX starter it resolves makes the mapper skip what a request leaves out. ModelMapper copies an absent field as null by default, so the null replaces the default the entity was built with: a NOT NULL column refuses the insert (a 409 on a form that sent every field it has), any other column silently stores null. The entity default and the request's absence both look right alone; the unit tests mock the mapper and never see it. The fix is the framework's: a SimpliX starter whose auto-configured mapper installs `CreateRequestNullSkipCondition` skips a null in a `*CreateDTO` (`framework/runtime-behaviour.md` § A create request overwrites the entity's defaults with null); upgrade to it rather than patching a service, and keep the classpath test that maps every empty CreateDTO onto a new entity",
    appliesTo: (p) => isService(p) && !/src\/test\//.test(p),
    check: (c, _rel, ctx) => {
      const idx = ctx?.createMapping;
      if (!idx || idx.mapperSkipsNulls || idx.entitiesWithDefaults.size === 0) return [];
      const clean = stripCommentsAndStrings(c);
      const requests = new Set([...clean.matchAll(/\b\w+CreateDTO\s+(\w+)\b/g)].map((m) => m[1]));
      if (requests.size === 0) return [];
      const hits = [];
      for (const m of clean.matchAll(/\b\w*[mM]apper\s*\.\s*map\s*\(\s*(\w+)\s*,\s*([\w.]+?)\s*\)/g)) {
        if (!requests.has(m[1])) continue;
        hits.push({
          line: clean.slice(0, m.index).split("\n").length,
          excerpt: `${m[0].replace(/\s+/g, " ")} copies a create request onto a new entity, and no mapper in the project skips an absent field (${[...idx.entitiesWithDefaults].slice(0, 3).join(", ")} declare defaults)`,
        });
      }
      return hits;
    },
    samples: {
      file: "modules/<module>/src/main/java/<pkg>/web/<feature>/service/ThingService.java",
      ctx: { createMapping: { entitiesWithDefaults: new Set(["Thing"]), mapperSkipsNulls: false } },
      broken: `public class ThingService extends SimpliXBaseService<Thing, String> {

    @Transactional
    public ThingDetailDTO create(ThingCreateDTO createDTO) {
        Thing entity = new Thing();
        modelMapper.map(createDTO, entity);
        return saveAndGetProjection(entity);
    }
}`,
      fixed: `public class ThingService extends SimpliXBaseService<Thing, String> {

    @Transactional
    public ThingDetailDTO create(ThingCreateDTO createDTO) {
        Thing entity = Thing.builder().label(createDTO.getLabel()).build();
        return saveAndGetProjection(entity);
    }
}`,
      hit: [
        {
          note: "the mapper builds the entity itself from the type",
          source: `public class ThingService extends SimpliXBaseService<Thing, String> {

    @Transactional
    public ThingDetailDTO create(ThingCreateDTO request) {
        Thing entity = modelMapper.map(request, Thing.class);
        return saveAndGetProjection(entity);
    }
}`,
        },
      ],
      miss: [
        {
          note: "the project configures the mapper to skip what a create request leaves out",
          ctx: { createMapping: { entitiesWithDefaults: new Set(["Thing"]), mapperSkipsNulls: true } },
          source: `public class ThingService extends SimpliXBaseService<Thing, String> {

    @Transactional
    public ThingDetailDTO create(ThingCreateDTO createDTO) {
        Thing entity = new Thing();
        modelMapper.map(createDTO, entity);
        return saveAndGetProjection(entity);
    }
}`,
        },
        {
          note: "no entity in the project declares a default, so there is nothing to overwrite",
          ctx: { createMapping: { entitiesWithDefaults: new Set(), mapperSkipsNulls: false } },
          source: `public class ThingService extends SimpliXBaseService<Thing, String> {

    @Transactional
    public ThingDetailDTO create(ThingCreateDTO createDTO) {
        Thing entity = new Thing();
        modelMapper.map(createDTO, entity);
        return saveAndGetProjection(entity);
    }
}`,
        },
        {
          note: "an update request mapped onto the loaded entity, where null is how a field is cleared",
          source: `public class ThingService extends SimpliXBaseService<Thing, String> {

    @Transactional
    public ThingDetailDTO update(Thing entity, ThingUpdateDTO updateDto) {
        modelMapper.map(updateDto, entity);
        return saveAndGetProjection(entity);
    }
}`,
        },
        {
          note: "an entity mapped out to a projection, which no request reaches",
          source: `public class ThingService extends SimpliXBaseService<Thing, String> {

    public ThingDetailDTO detail(Thing entity, ThingCreateDTO template) {
        return modelMapper.map(entity, ThingDetailDTO.class);
    }
}`,
        },
      ],
    },
  },
  {
    id: "empty-page-with-no-pageable",
    invariant: "#15\u2462 / canonical-service",
    level: "error",
    desc: "`new PageImpl<>(List.of())`, a Page built with no `Pageable`. The one-argument constructor fills in `Pageable.unpaged()`, whose `getPageNumber()` and `getPageSize()` THROW `UnsupportedOperationException`, so Jackson cannot serialize the response and the caller gets a 500 where the screen was expecting an empty list. The branch that builds it is the early return for 「this caller has nothing」, which is exactly the path nobody exercises while developing against seeded data and every new account takes on its first request. Pass the request being answered: `new PageImpl<>(List.of(), pageRequest, 0)`",
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
    invariant: "i18n-field-patterns",
    level: "error",
    desc: "A hand-assembled DTO takes its name from the plain column while the entity carries a `<name>I18n` map: the caller is answered in the language the record was seeded in, whatever language they asked for. Resolve the map (the project's `LocalizedNames.pick`-style helper), or declare the map on the DTO and let `@I18nTrans` serialize it",
    appliesTo: (p) => /\.java$/.test(p) && !isDtoContainer(p),
    check: (c, _rel, ctx) => {
      const index = ctx?.i18n;
      if (!index || !index.entityBases.size) return [];
      const clean = stripCommentsAndStrings(c);
      // What each local was constructed as, so the target's own type decides the exemption.
      const declared = new Map();
      for (const m of clean.matchAll(/\b(\w+DTO)\s+(\w+)\s*=\s*new\s+\1\s*\(/g)) declared.set(m[2], m[1]);
      if (!declared.size) return [];
      // The SOURCE's own type decides whether that field is translated at all - two entities can
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
          excerpt: `${target}.set${setter}(${source}.get${getter}()) - ${type} does not declare ${targetBase}I18n, and ${sourceType} keeps ${sourceBase}I18n`,
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
    desc: "Endpoint carries no @PreAuthorize - the method is reachable by anyone the filter chain lets through. Public is written `permitAll()` and user-self `isAuthenticated()`; an absent annotation says neither, and a dev/test profile is not a substitute",
    appliesTo: isController,
    check: (c) => {
      const clean = stripCommentsAndStrings(c);
      if (!/@RestController/.test(clean)) return [];
      return endpointsOf(clean)
        .filter((e) => !/@PreAuthorize/.test(e.text))
        .map((e) => ({ line: e.startLine, excerpt: `${e.name}() - ${e.excerpt}` }));
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
    desc: "Endpoint carries no @Operation - it reaches the OpenAPI document with no summary, and the frontend's generated client names it from the path",
    appliesTo: isController,
    check: (c) => {
      const clean = stripCommentsAndStrings(c);
      if (!/@RestController/.test(clean)) return [];
      return endpointsOf(clean)
        .filter((e) => !/@Operation/.test(e.text))
        .map((e) => ({ line: e.startLine, excerpt: `${e.name}() - ${e.excerpt}` }));
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
    desc: "Endpoint annotations are out of order - the shape is @XxxMapping → @Operation → (@SimpliXStandardApi) → @PreAuthorize. Order is how a reader finds the guard without reading the method",
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
          out.push({ line: e.startLine, excerpt: `${e.name}() - mapping/@Operation/@PreAuthorize out of order` });
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
    desc: "hasPermission target is not an UPPER_SNAKE feature-area group - a per-entity PascalCase target splits one feature area into as many permissions as it has tables, and none of them is the one an administrator was granted",
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
    desc: "hasPermission action is not one the evaluator resolves - only list/view/create/edit/delete/export/import/approve/manage can ever be granted, so any other verb is a permission nobody can hold and an endpoint nobody can reach",
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
    desc: "@Tag name is built from the Java package instead of the domain - the OpenAPI namespace then leaks the base package, and the frontend's generated client is grouped by folder rather than by subject",
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
    desc: "@RequestMapping carries an /api/v1/ prefix - the servlet context already supplies it, so the endpoint lands at /api/v1/api/v1/... and every generated client calls an address that is not there",
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
    desc: "@PathVariable is typed something other than String - every entity id in this stack is a UUID v7 stored as VARCHAR, and a UUID/Long parameter refuses ids the database accepts",
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
    id: "request-body-without-validated",
    invariant: "#13",
    level: "error",
    desc: "A @RequestBody parameter carries no @Validated (or @Valid) - its Bean Validation constraints are never evaluated, so a blank or malformed body reaches the service. A body with no constraints to evaluate stays bare: a `Set<...>` multi-update body (validated per element), a `Map<...>`, a raw `String` or `byte[]`",
    appliesTo: isController,
    check: (c) => {
      const clean = stripCommentsAndStrings(c);
      if (!/@RestController\b/.test(clean)) return [];
      const hits = [];
      // OpenAPI's @RequestBody documents a body; only Spring's binds one. A file that imports the
      // OpenAPI one and not Spring's binds none, and an annotation attribute value
      // (`requestBody = @RequestBody(...)` inside @Operation) is never a parameter.
      const openApiOnly = /import\s+io\.swagger\.v3\.oas\.annotations\.parameters\.RequestBody\s*;/.test(clean)
        && !/import\s+org\.springframework\.web\.bind\.annotation\.(?:RequestBody|\*)\s*;/.test(clean);
      if (openApiOnly) return [];
      for (const m of clean.matchAll(/@RequestBody\b/g)) {
        if (/=\s*$/.test(clean.slice(Math.max(0, m.index - 40), m.index))) continue;
        const p = parameterAround(clean, m.index);
        if (/@Validated\b|@Valid\b/.test(p)) continue;
        const type = p.replace(/@\w+(?:\.\w+)*(?:\s*\([^)]*\))?/g, "").trim().replace(/^final\s+/, "");
        // Bodies that carry no constraints to evaluate: a Set multi-update body (validated per
        // element), an untyped map, a raw string or byte array (a signed webhook is read raw).
        if (/^(?:Set|Map)\s*</.test(type) || /^(?:String|byte\[\]|Object|JsonNode)\s+\w+$/.test(type)) continue;
        hits.push({ line: clean.slice(0, m.index).split("\n").length, excerpt: p.replace(/\s+/g, " ").trim().slice(0, 150) });
      }
      return hits;
    },
    samples: {
      file: "modules/site/src/main/java/app/web/site/controller/AreaRestController.java",
      broken: `@RestController
public class AreaRestController {
    @PostMapping("/create")
    public SimpliXApiResponse<AreaDetailDTO> create(@RequestBody AreaCreateDTO createDto) { return null; }
}`,
      fixed: `@RestController
public class AreaRestController {
    @PostMapping("/create")
    public SimpliXApiResponse<AreaDetailDTO> create(@RequestBody @Validated AreaCreateDTO createDto) { return null; }
}`,
      hit: [
        {
          note: "a list body is validated like a single DTO, so a bare List<...> fires",
          source: `@RestController
public class AreaRestController {
    @PatchMapping("/order")
    public SimpliXApiResponse<Void> updateOrder(@RequestBody List<AreaOrderUpdateDTO> orders) { return null; }
}`,
        },
        {
          note: "the parameter after a path variable, on a signature split over lines",
          source: `@RestController
public class AreaRestController {
    @PutMapping("/{areaId}")
    public SimpliXApiResponse<AreaDetailDTO> update(
            @PathVariable String areaId,
            @RequestBody AreaUpdateDTO updateDto) { return null; }
}`,
        },
      ],
      miss: [
        {
          note: "OpenAPI's @RequestBody as an @Operation attribute, on an endpoint that reads the body as a stream",
          source: `import io.swagger.v3.oas.annotations.parameters.RequestBody;
@RestController
public class UploadRestController {
    @PostMapping
    @Operation(operationId = "send", requestBody = @RequestBody(required = true, content = @Content(schema = @Schema(implementation = BundleDTO.class))))
    public ReceiptDTO send(HttpServletRequest request) { return null; }
}`,
        },
        {
          note: "an attribute value next to a Spring-bound, validated body",
          source: `import org.springframework.web.bind.annotation.*;
@RestController
public class UploadRestController {
    @PostMapping
    @Operation(operationId = "send", requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(required = true))
    public ReceiptDTO send(@RequestBody @Validated BundleDTO bundle) { return null; }
}`,
        },
        {
          note: "a bare Set<...> multi-update body is the generator's own shape",
          source: `@RestController
public class AreaRestController {
    @PatchMapping
    public SimpliXApiResponse<List<AreaDetailDTO>> multiUpdate(@RequestBody Set<AreaUpdateDTO> updateDtos) { return null; }
}`,
        },
        {
          note: "a raw String body (a signed webhook) and an untyped Map body have no constraints to evaluate",
          source: `@RestController
public class HookRestController {
    @PostMapping("/hook")
    public void hook(@RequestBody String rawBody) { }
    @PostMapping("/probe")
    public void probe(@RequestBody Map<String, Object> payload) { }
}`,
        },
        {
          note: "@Valid in front of @RequestBody counts as validation",
          source: `@RestController
public class AreaRestController {
    @PostMapping("/create")
    public SimpliXApiResponse<AreaDetailDTO> create(@Valid @RequestBody AreaCreateDTO createDto) { return null; }
}`,
        },
        {
          note: "the word in a Javadoc line is not a parameter",
          source: `@RestController
public class AreaRestController {
    /** Reads the {@code @RequestBody} once. */
    @GetMapping("/{areaId}")
    public SimpliXApiResponse<AreaDetailDTO> get(@PathVariable String areaId) { return null; }
}`,
        },
      ],
    },
  },
  {
    id: "api-responses-block",
    invariant: "#17g",
    level: "error",
    desc: "@ApiResponses block on an endpoint - the envelope is uniform and the generator emits none, so a hand-written block documents a response shape the framework does not produce",
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
    desc: "Repository extends a JpaRepository base that is not SimpliX's (plain `JpaRepository`, `SearchableJpaRepository`) instead of SimpliXBaseRepository / SimpliXTreeRepository: the searchable/projection machinery every list endpoint relies on lives on the SimpliX base, so the entity gets no search surface",
    appliesTo: isRepository,
    check: (c) => {
      const clean = stripCommentsAndStrings(c);
      if (!/\binterface\s+\w+/.test(clean)) return [];
      if (/SimpliXBaseRepository|SimpliXTreeRepository/.test(clean)) return [];
      // Any `*JpaRepository` base: a library's own searchable base is as far from the SimpliX
      // one as Spring's plain interface is.
      return lineHits(clean, /\binterface\s+\w+\s+extends\s+[\w<>, ]*?\b\w*JpaRepository\b/);
    },
    samples: {
      file: "packages/domain-site/src/main/java/app/domain/site/AreaRepository.java",
      broken: `public interface AreaRepository extends JpaRepository<Area, String> {
}`,
      fixed: `public interface AreaRepository extends SimpliXBaseRepository<Area, String> {
}`,
      hit: [
        {
          note: "a searchable-JPA base that is not the SimpliX one",
          source: `public interface AreaTreeRepository extends SearchableJpaRepository<Area, String> {
}`,
        },
      ],
      miss: [
        {
          note: "a tree entity on the SimpliX tree base",
          source: `public interface AreaTreeRepository extends SimpliXTreeRepository<Area, String> {
}`,
        },
      ],
    },
  },
  {
    id: "native-select-star-into-formula-entity",
    invariant: "#4",
    level: "error",
    desc: "A native query selects `*` and maps the rows onto an entity that declares a `@Formula` field. A formula is computed in the select Hibernate writes itself, so the native result set has no column for it and every call fails at runtime with 「Unable to find column position by name」 - the method compiles, and the job or endpoint calling it fails on each run. Select the ids natively (keeping the lock) and load the entities through the repository, or name every column including the formula",
    appliesTo: isRepository,
    check: (c, rel, ctx) => {
      const formulas = ctx?.formulas;
      if (!formulas?.size) return [];
      const clean = stripComments(c);
      const out = [];
      for (const m of clean.matchAll(/@Query\s*\(([\s\S]*?)\)\s*(?:@[\w.]+(?:\([^)]*\))?\s*)*(?:List|Optional|Stream|Page|Slice|Set|Collection)?\s*<?\s*(\w+)\s*>?\s+\w+\s*\(/g)) {
        const args = m[1];
        if (!/nativeQuery\s*=\s*true/.test(args)) continue;
        const sql = [...args.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => x[1]).join("");
        if (!/\bselect\s+(?:\w+\.)?\*/i.test(sql)) continue;
        if (!formulas.has(m[2])) continue;
        out.push({ line: clean.slice(0, m.index).split("\n").length,
          excerpt: `native select * onto ${m[2]}, which declares a @Formula column` });
      }
      return out;
    },
    samples: {
      file: "packages/domain-order/src/main/java/app/domain/order/OrderRepository.java",
      broken: `public interface OrderRepository extends SimpliXBaseRepository<Order, String> {
    @Query(value = "select * from orders where expires_at <= :now "
            + "order by expires_at limit :limit for update skip locked", nativeQuery = true)
    List<Order> lockExpired(@Param("now") Instant now, @Param("limit") int limit);
}`,
      fixed: `public interface OrderRepository extends SimpliXBaseRepository<Order, String> {
    @Query(value = "select order_id from orders where expires_at <= :now "
            + "order by expires_at limit :limit for update skip locked", nativeQuery = true)
    List<String> lockExpiredIds(@Param("now") Instant now, @Param("limit") int limit);

    default List<Order> lockExpired(Instant now, int limit) {
        return findAllById(lockExpiredIds(now, limit));
    }
}`,
      ctx: { formulas: new Set(["Order"]) },
      hit: [
        {
          note: "an aliased star returning one entity",
          source: `public interface OrderRepository extends SimpliXBaseRepository<Order, String> {
    @Query(value = "select o.* from orders o where o.code = :code", nativeQuery = true)
    Optional<Order> findByCodeNative(@Param("code") String code);
}`,
        },
      ],
      miss: [
        {
          note: "a native star onto an entity with no formula",
          source: `public interface HoldRepository extends SimpliXBaseRepository<Hold, String> {
    @Query(value = "select * from holds where expires_at <= :now", nativeQuery = true)
    List<Hold> lockExpired(@Param("now") Instant now);
}`,
        },
        {
          note: "a JPQL query onto the formula entity",
          source: `public interface OrderRepository extends SimpliXBaseRepository<Order, String> {
    @Query("select o from Order o where o.expiresAt <= :now")
    List<Order> findExpired(@Param("now") Instant now);
}`,
        },
      ],
    },
  },
  {
    id: "searchdto-data-annotation",
    invariant: "#6",
    level: "error",
    desc: "SearchDTO annotated @Data - it generates equals/hashCode over a large search-condition container, which the framework compares internally. @Getter @Setter is the shape",
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
    desc: "DTO field declared primitive `boolean` - Lombok then emits isXxx() where the framework's field lookups expect getXxx(), and an absent field in a request body silently reads as false instead of null. Declare the wrapper `Boolean`",
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
    id: "validation-getter-on-dto",
    invariant: "validation-patterns",
    level: "error",
    desc: "A DTO declares a bean-validation getter (`@AssertTrue`/`@AssertFalse` on an `isX()`/`getX()` method) to judge several fields together. SimpliX Meta and the OpenAPI document read every getter as a property, so the request publishes a required field `x` that no client has and a generated form or client must send. Judge the combination in the service (a `SimpliXGeneralException` with `VAL_INVALID_PARAMETER` and a message key) or with a class-level constraint, and keep the DTO's published fields the request's own",
    appliesTo: isDtoContainer,
    check: (c) => {
      const clean = stripCommentsAndStrings(c);
      const hits = [];
      // The annotations usually stand on lines of their own above the method, so match across lines.
      for (const m of clean.matchAll(/@Assert(?:True|False)\b(?:\s*\([^)]*\))?\s*(?:@\w+(?:\s*\([^)]*\))?\s*)*(?:public\s+)?(?:boolean|Boolean)\s+((?:is|get)\w+)\s*\(/g)) {
        hits.push({ line: clean.slice(0, m.index).split("\n").length, excerpt: `${m[1]}() is published as a request field` });
      }
      return hits;
    },
    samples: {
      file: "modules/portal/thing/src/main/java/app/web/thing/dto/ThingDTOs.java",
      broken: `public class ThingDTOs {
    public record ThingRequestDTO(String via, String phone) {
        @AssertTrue public boolean isOneShape() { return phone != null; }
    }
}`,
      fixed: `public class ThingDTOs {
    public record ThingRequestDTO(@NotNull @AssertTrue Boolean agreed, String phone) {
    }
}`,
      hit: [
        {
          note: "the annotations on lines of their own above the method, with another annotation between",
          source: `public class ThingDTOs {
    public record ThingRequestDTO(String via, String phone) {

        @AssertTrue
        @Schema(hidden = true)
        public boolean isOneShape() {
            return phone != null;
        }
    }
}`,
        },
      ],
    },
  },
  {
    id: "stored-path-column-narrower-than-the-path",
    invariant: "field-types",
    level: "error",
    desc: "An entity column receives a stored file's path (`storedPath()` is written into it) but is declared shorter than 255 characters. The SimpliX file store writes `<group>/<yyyy>/<MM>/<dd>/<uuid>.<ext>`, 66 characters with a short group, so a 64-character column refuses every write with `value too long` and the request answers 409; a provider-backed path that tests never reach ships it untested. Give the column the width the stored file record gives its own path (and the migration that widens it)",
    appliesTo: (p) => /\/entity\/\w+\.java$/.test(p) && !/src\/test\//.test(p),
    check: (c, file, ctx) => {
      const paths = ctx?.storedPaths;
      if (!paths || paths.size === 0) return [];
      const clean = stripCommentsAndStrings(c);
      const hits = [];
      for (const m of clean.matchAll(/@Column\s*\(([^)]*)\)\s*(?:@\w+(?:\s*\([^)]*\))?\s*)*private\s+String\s+(\w+)\s*;/g)) {
        const length = /\blength\s*=\s*(\d+)/.exec(m[1]);
        const width = length ? Number(length[1]) : 255;
        if (!paths.has(m[2]) || width >= 255) continue;
        hits.push({ line: clean.slice(0, m.index).split("\n").length, excerpt: `${m[2]} keeps a stored path in ${width} characters` });
      }
      return hits;
    },
    samples: {
      file: "packages/domain-thing/src/main/java/app/domain/thing/entity/Thing.java",
      ctx: { storedPaths: new Set(["recordingFileId"]) },
      broken: `@Entity
public class Thing {
    @Column(name = "recording_file_id", length = 64)
    @Comment("The recording in file storage")
    private String recordingFileId;
}`,
      fixed: `@Entity
public class Thing {
    @Column(name = "recording_file_id", length = 1000)
    @Comment("The recording in file storage")
    private String recordingFileId;
}`,
      hit: [
        {
          note: "the index reads a setter as well as a builder call",
          source: `@Entity
public class Thing {
    @Column(name = "sample_path", length = 36)
    private String samplePath;
}`,
          ctx: { storedPaths: buildStoredPathIndex([{ rel: "S.java", src: "class S { void f(StoredFileInfo s, Thing t) { t.setSamplePath(s.storedPath()); } }" }]) },
        },
      ],
      miss: [
        {
          note: "a narrow column nothing writes a stored path into, such as a file record's id",
          source: `@Entity
public class Thing {
    @Column(name = "file_id", length = 36)
    private String fileId;
}`,
          ctx: { storedPaths: new Set(["recordingFileId"]) },
        },
      ],
    },
  },
  {
    id: "sortable-boolean-searchable-field",
    invariant: "AP-38",
    level: "error",
    desc: "A Boolean SearchDTO field declared `sortable = true` - the paging query aggregates the sort column as max(<column>), and there is no max(boolean) on PostgreSQL, so the endpoint answers 500 the moment anybody sorts by it. `sortable = true` is what puts the sort arrow in the list header, so the defect ships as a control that exists in order to fail; where the column is the list's default sort the screen breaks on open. Filter on a boolean, never sort",
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
    desc: "@Autowired field injection or @RequiredArgsConstructor on a web-layer controller/service - the generator emits an explicit constructor calling super(...), and Lombok's cannot. Infrastructure (config, scheduler, listener, factory, helper, stream) is exempt",
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
    id: "lazy-relation-with-wide-json-include",
    invariant: "#5 (entity-to-DTO mapping)",
    level: "error",
    desc: "A LAZY @ManyToOne/@OneToOne whose @JsonIncludeProperties names more than the id - a detail read through findById(id, DetailDTO.class) serializes the uninitialized proxy with its id alone, while a search that joins the relation answers every named property, so the detail draws the raw id where the list draws the name. Load the relation EAGER, or include only the id",
    appliesTo: (p) => p.endsWith(".java"),
    check: (c) =>
      lineHits(stripCommentsAndStrings(c), /@(?:ManyToOne|OneToOne)\b.*FetchType\.LAZY/, (_line, lines, i) => {
        // The annotations stacked on the same field, up to its declaration.
        for (let j = i; j < lines.length && j < i + 12; j++) {
          if (j > i && !/^\s*(@|\}|\)|"|,|$)/.test(lines[j]) && /;\s*$/.test(lines[j])) break;
          const include = lines.slice(j).join("\n").match(/^\s*@JsonIncludeProperties\s*\(\s*\{([^}]*)\}/);
          if (include) return include[1].includes(",");
        }
        return false;
      }),
    samples: {
      file: "packages/domain-billing/src/main/java/app/domain/billing/entity/Subscription.java",
      broken: `@Entity
public class Subscription extends BaseEntity<String> {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plan_id", insertable = false, updatable = false)
    @JsonIncludeProperties({"planId", "name"})
    private Plan plan;
}`,
      fixed: `@Entity
public class Subscription extends BaseEntity<String> {
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "plan_id", insertable = false, updatable = false)
    @JsonIncludeProperties({"planId", "name"})
    private Plan plan;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", insertable = false, updatable = false)
    @JsonIncludeProperties({"ownerId"})
    private Owner owner;
}`,
    },
  },
  {
    id: "scheduler-lock-on-primitive-return",
    invariant: "Scope (scheduler jobs)",
    level: "error",
    desc: "A @SchedulerLock method returns a primitive - ShedLock's proxy refuses to lock it (LockingNotSupportedException) when the tick fires, so the job fails on every run while it compiles, starts and passes any test that calls the method directly. Return void, or an object or Optional the proxy can answer null for when another server holds the lock",
    appliesTo: (p) => p.endsWith(".java"),
    // Read as text, not as lines: the annotation's arguments may wrap, further annotations may sit
    // between it and the signature, and the whole declaration may share one line.
    check: (c) => {
      const clean = stripCommentsAndStrings(c);
      const args = "(?:\\s*\\((?:[^()]|\\([^()]*\\))*\\))?";
      const re = new RegExp(
        `@SchedulerLock\\b${args}(?:\\s*@[\\w.]+${args})*\\s*(?:(?:public|protected|private|static|final|synchronized)\\s+)*`
          + "(?:int|long|boolean|double|float|short|byte|char)\\s+\\w+\\s*\\(",
        "g",
      );
      const hits = [];
      for (const m of clean.matchAll(re)) {
        const line = clean.slice(0, m.index).split("\n").length;
        hits.push({ line, excerpt: clean.split("\n")[line - 1].trim().slice(0, 150) });
      }
      return hits;
    },
    samples: {
      file: "modules/common/worker/src/main/java/app/web/common/worker/scheduler/TickScheduler.java",
      broken: `    @Scheduled(cron = "30 * * * * *")
    @SchedulerLock(name = "TickScheduler_judge", lockAtMostFor = "50s")
    public int judge() {
        return breakers.judgeAll();
    }`,
      fixed: `    @Scheduled(cron = "30 * * * * *")
    @SchedulerLock(name = "TickScheduler_judge", lockAtMostFor = "50s")
    public void judge() {
        breakers.judgeAll();
    }`,
      hit: [
        { note: "a boolean return with a further annotation between", source: `    @SchedulerLock(name = "TickScheduler_sweep")\n    @SchedulerName("sweep")\n    public boolean sweep() {\n        return true;\n    }` },
        { note: "annotation arguments wrapping onto a second line", source: `    @SchedulerLock(name = "TickScheduler_sweep",\n            lockAtMostFor = "50s")\n    public int sweep() {\n        return queue.sweep();\n    }` },
        { note: "annotation and declaration on one line", source: `    @SchedulerLock(name = "TickScheduler_sweep") public long sweep() { return 1L; }` },
        { note: "a further annotation with wrapped arguments between", source: `    @SchedulerLock(name = "TickScheduler_sweep")\n    @Scheduled(cron = "0 * * * * *",\n            zone = "UTC")\n    protected final int sweep() {\n        return 1;\n    }` },
      ],
      miss: [
        { note: "an Optional return, which the proxy answers with null when the lock is held elsewhere", source: `    @SchedulerLock(name = "TickScheduler_enqueue")\n    public Optional<String> enqueue() {\n        return queue.enqueue();\n    }` },
        { note: "a boxed Integer return, which the proxy answers with null when the lock is held elsewhere", source: `    @SchedulerLock(name = "TickScheduler_count")\n    public Integer count() {\n        return 0;\n    }` },
        { note: "a void method locked next to an unlocked primitive one", source: `    @SchedulerLock(name = "TickScheduler_sweep")\n    public void sweep() {\n    }\n\n    public int size() {\n        return 0;\n    }` },
        { note: "a primitive return on a method without a lock", source: `    @Scheduled(cron = "0 * * * * *")\n    public int count() {\n        return 0;\n    }` },
      ],
    },
  },
  {
    id: "banned-exception-type",
    invariant: "#3",
    level: "error",
    desc: "A web-layer controller/service throws IllegalArgumentException / RuntimeException / ResponseStatusException - the global handler only builds the standard envelope from SimpliXGeneralException, so the client gets an untranslated 500 with a stack-trace message",
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
    id: "throw-time-english-default",
    invariant: "#3",
    level: "error",
    desc: "A service resolves an argument-less error message at throw time with an English default: `getMessage(\"error.x\", null, \"<English text>\", locale)`. The exception carries the resolved text, so the HTTP layer cannot translate it again, the default hides a key missing from a bundle, and the translation-coverage test cannot see a bare key passed to a MessageSource. Throw the `{error.<domain>.<key>}` placeholder, which the HTTP layer resolves to the request locale. A message that carries arguments (a count, a name) is the one case resolved at throw time",
    appliesTo: (p) => p.endsWith(".java"),
    check: (c) => {
      // An exception advice is the HTTP layer, where a message is meant to be resolved.
      if (/@(?:Rest)?ControllerAdvice\b|@ExceptionHandler\b/.test(stripCommentsAndStrings(c))) return [];
      const clean = stripComments(c);
      const lines = clean.split("\n");
      const hits = [];
      for (const m of clean.matchAll(/\bgetMessage\(\s*"error\.[^"]+"\s*,\s*null\s*,\s*"/g)) {
        const line = clean.slice(0, m.index).split("\n").length;
        hits.push({ line, excerpt: lines[line - 1].trim().slice(0, 150) });
      }
      return hits;
    },
    samples: {
      file: "modules/site/src/main/java/app/web/site/service/AreaService.java",
      broken: `        if (!Objects.equals(entity.getAreaId(), updateDto.getAreaId())) {
            String message = messageSource.getMessage("error.id.cannot.change", null, "ID cannot be changed", LocaleContextHolder.getLocale());
            throw new SimpliXGeneralException(ErrorCode.GEN_CONFLICT, message, null);
        }`,
      fixed: `        if (!Objects.equals(entity.getAreaId(), updateDto.getAreaId())) {
            throw new SimpliXGeneralException(ErrorCode.GEN_CONFLICT, "{error.id.cannot.change}", null);
        }`,
      hit: [
        {
          note: "the call wrapped onto several lines, as the tree template wrapped it",
          source: `            String message = messageSource.getMessage("error.area.cannot.change", null,
                "Area cannot be changed after creation", LocaleContextHolder.getLocale());`,
        },
        {
          note: "a receiver under another name",
          source: `            String message = messages.getMessage("error.id.cannot.change", null, "ID cannot be changed", locale);`,
        },
      ],
      miss: [
        {
          note: "a message that carries arguments, the case resolved at throw time",
          source: `            String message = messageSource.getMessage("error.entity.not.found",
                new Object[]{"Area", areaId}, "Area not found", LocaleContextHolder.getLocale());`,
        },
        {
          note: "a key that is not an error key",
          source: `            String label = messageSource.getMessage("entities.Area.areaCode", null, "Area code", locale);`,
        },
        {
          note: "the call written inside a comment",
          source: `            // messageSource.getMessage("error.id.cannot.change", null, "ID cannot be changed", locale)`,
        },
        {
          note: "an exception advice, which is the HTTP layer where the message is resolved",
          source: `@RestControllerAdvice
public class ApiExceptionAdvice {
    @ExceptionHandler(Exception.class)
    SimpliXApiResponse<Void> internal() {
        return SimpliXApiResponse.failure(null, messageSource.getMessage("error.internal.server", null, "Internal error", LocaleContextHolder.getLocale()));
    }
}`,
        },
      ],
    },
  },
  {
    id: "throw-time-message-utils",
    invariant: "#3",
    level: "error",
    desc: "A statement that throws resolves an argument-less error message with `MessageUtils.get(\"error.x\")`: a `throw`, an `orElseThrow` supplier, or any `new <Name>Exception(...)`. The exception then carries the resolved text, so the HTTP layer cannot translate it again, and the text follows the thread's locale at throw time. Throw the `{error.<domain>.<key>}` placeholder, which the HTTP layer resolves to the request locale. A call that passes arguments (a count, a name) is the one case resolved at throw time, and a failure envelope built in a controller is not thrown through the handler, so neither is flagged. A message resolved into a local variable first and thrown afterwards is not followed",
    appliesTo: (p) => p.endsWith(".java"),
    check: (c) => {
      const bare = stripCommentsAndStrings(c);
      // An exception advice is the HTTP layer, where a message is meant to be resolved.
      if (/@(?:Rest)?ControllerAdvice\b|@ExceptionHandler\b/.test(bare)) return [];
      const clean = stripComments(c);
      const lines = clean.split("\n");
      const hits = [];
      for (const m of clean.matchAll(/\bMessageUtils\.get\(\s*"error\.[^"]+"\s*\)/g)) {
        // Both strip functions blank what they remove and never delete it, so an index into one
        // text is the same index into the other. The literal is read from `clean` and the
        // statement around it from `bare`, where a `;` or a brace inside a string cannot end it.
        let start = m.index;
        while (start > 0 && !";{}".includes(bare[start - 1])) start--;
        if (!/\bthrow\b|\borElseThrow\s*\(|\bnew\s+\w*Exception\s*\(/.test(bare.slice(start, m.index))) continue;
        const line = clean.slice(0, m.index).split("\n").length;
        hits.push({ line, excerpt: lines[line - 1].trim().slice(0, 150) });
      }
      return hits;
    },
    samples: {
      file: "modules/site/src/main/java/app/web/site/service/AreaService.java",
      broken: `        if (entity == null) {
            throw new SimpliXGeneralException(ErrorCode.GEN_NOT_FOUND, MessageUtils.get("error.area.notFound"), null);
        }`,
      fixed: `        if (entity == null) {
            throw new SimpliXGeneralException(ErrorCode.GEN_NOT_FOUND, "{error.area.notFound}", null);
        }`,
      hit: [
        {
          note: "an orElseThrow supplier, where the exception is constructed with no throw keyword",
          source: `        Area entity = repository.findById(areaId)
            .orElseThrow(() -> new SimpliXGeneralException(ErrorCode.GEN_NOT_FOUND, MessageUtils.get("error.area.notFound"), null));`,
        },
        {
          note: "the call wrapped onto the line after the constructor, as a long line is wrapped",
          source: `            throw new SimpliXGeneralException(ErrorCode.GEN_CONFLICT,
                MessageUtils.get("error.area.cannotDeleteSelf"), null);`,
        },
        {
          note: "a switch arm, which throws with no brace or semicolon before it",
          source: `            default -> throw new SimpliXGeneralException(ErrorCode.BIZ_INVALID_STATE, MessageUtils.get("error.area.kindUnknown"), null);`,
        },
        {
          note: "a string holding a brace and a semicolon ahead of the call in the same statement",
          source: `            throw new SimpliXGeneralException(ErrorCode.GEN_CONFLICT, "{error.area.a};" + MessageUtils.get("error.area.b"), null);`,
        },
      ],
      miss: [
        {
          note: "a call that carries arguments, the case resolved at throw time",
          source: `            throw new SimpliXGeneralException(ErrorCode.GEN_NOT_FOUND, MessageUtils.get("error.area.notFoundWithId", areaId), null);`,
        },
        {
          note: "a failure envelope returned from a controller, which never passes through the handler",
          source: `        return repository.findById(areaId).map(SimpliXApiResponse::ok)
            .orElse(SimpliXApiResponse.failure(null, MessageUtils.get("error.area.notFound")));`,
        },
        {
          note: "a lookup in the statement after a throw",
          source: `        if (blank) { throw new SimpliXGeneralException(ErrorCode.GEN_CONFLICT, "{error.area.blank}", null); }
        String label = MessageUtils.get("error.area.label");`,
        },
        {
          note: "a key that is not an error key",
          source: `            throw new SimpliXGeneralException(ErrorCode.GEN_CONFLICT, MessageUtils.get("entities.Area.areaCode"), null);`,
        },
        {
          note: "a key that is not a literal",
          source: `            throw new SimpliXGeneralException(ErrorCode.GEN_CONFLICT, MessageUtils.get(definition.errorKey()), null);`,
        },
        {
          note: "the call written inside a comment",
          source: `            // throw new SimpliXGeneralException(ErrorCode.GEN_NOT_FOUND, MessageUtils.get("error.area.notFound"), null);`,
        },
        {
          note: "an exception advice, which is the HTTP layer where the message is resolved",
          source: `@RestControllerAdvice
public class ApiExceptionAdvice {
    @ExceptionHandler(Exception.class)
    SimpliXApiResponse<Void> internal() {
        throw new IllegalStateException(MessageUtils.get("error.internal.server"));
    }
}`,
        },
      ],
    },
  },
  {
    id: "debug-log-in-web-layer",
    invariant: "#14",
    level: "error",
    desc: "log.debug/info in a web-layer controller or service - the global handler logs errors and these do not, so the line is noise at best. A credential-adjacent flow logging an identifier or a length is a data leak even at DEBUG. Business events are recorded as an AuditEvent, not a log line",
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
    desc: "Timezone-dependent value read from the JVM default zone: argless LocalDate.now() / LocalDateTime.now() / LocalTime.now() / OffsetDateTime.now() / ZonedDateTime.now() / Year.now() / YearMonth.now(), ZoneId.systemDefault() or TimeZone.getDefault(). The answer then depends on the machine the server happens to run on: near midnight the day, and near New Year the year, differ from the installation's. Resolve the zone explicitly from the narrowest owner the project models (a site's own timezone, for example), falling back to the configured app timezone, and pass it in",
    appliesTo: (p) => p.endsWith(".java"),
    check: (c) =>
      lineHits(
        stripCommentsAndStrings(c),
        /\b(?:LocalDate|LocalDateTime|LocalTime|OffsetDateTime|ZonedDateTime|Year|YearMonth)\.now\(\s*\)|\bZoneId\.systemDefault\s*\(\s*\)|\bTimeZone\.getDefault\s*\(\s*\)/,
      ),
    samples: {
      file: "apps/safety-server/src/main/java/app/safetyserver/seed/InstallationSeed.java",
      broken: `        int year = LocalDate.now().getYear();`,
      fixed: `        int year = LocalDate.now(zone.resolve()).getYear();`,
      hit: [
        { note: "an argless OffsetDateTime.now()", source: `        OffsetDateTime stamp = OffsetDateTime.now();` },
        { note: "an argless ZonedDateTime.now()", source: `        ZonedDateTime stamp = ZonedDateTime.now();` },
        { note: "the legacy default-zone accessor", source: `        TimeZone tz = TimeZone.getDefault();` },
      ],
      miss: [
        { note: "OffsetDateTime.now with the injected clock", source: `        OffsetDateTime stamp = OffsetDateTime.now(clock);` },
        { note: "ZonedDateTime.now with a resolved zone", source: `        ZonedDateTime stamp = ZonedDateTime.now(zone.resolve());` },
        { note: "Instant.now(), which is zone-free", source: `        Instant stamp = Instant.now();` },
      ],
    },
  },
  {
    id: "hardcoded-zone-literal",
    invariant: "#18",
    level: "error",
    desc: "A zone id written as a literal - ZoneId.of(\"Asia/Seoul\") and friends. The installation's zone is configuration, so a literal is right for one deployment and silently wrong for the next, and the value it shifts is a date somebody reads off a screen",
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
    desc: "Entity/DTO field typed LocalDateTime / OffsetDateTime / ZonedDateTime - SimpliX's auto-applied converters UTC-normalize these, so the offset the field appears to carry is not the one that comes back. An absolute instant is `Instant`; a calendar date is `LocalDate`; a wall-clock time is `LocalTime`",
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
    desc: "SearchDTO's entity-ID field is missing `sortable = true` or the `IN` operator. Without sortable the scaffolded list's FIRST request fails, because the frontend's default sort is `<entityId>.desc`. Without IN the list's own filter is dead the moment a value is picked, since it resolves selected labels with `<entityId>.in=a,b,c` - and it is dead on every list that offers the filter, including other modules'. The scaffold emits neither half",
    appliesTo: isDtoContainer,
    check: (c, rel, ctx) => {
      const entity = path.basename(rel).replace(/DTOs?\.java$/, "");
      const pk = ctx?.entityIds?.get(entity);
      if (!pk) return []; // no entity of that name in this project - nothing to assert against
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
      return miss.length ? [{ line, excerpt: `${pk}: missing ${miss.join(" + ")} - ${head.slice(0, 90)}` }] : [];
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
    id: "unique-field-soft-delete-on-hard-entity",
    invariant: "#15②",
    level: "error",
    desc: "A @UniqueField names `softDeleteField` on an entity that declares no such field. The uniqueness check then queries an attribute Hibernate cannot resolve, so every create through that DTO answers 500 before anything is saved. The generator's DTO template wrote the soft-delete pair on every entity; name it only where the entity declares the flag (implements the project's soft-delete contract)",
    appliesTo: isDtoContainer,
    check: (c, _rel, ctx) => {
      const clean = stripComments(c);
      const hits = [];
      for (const m of clean.matchAll(/@UniqueField\(\s*entity\s*=\s*(\w+)\.class[^)]*?softDeleteField\s*=\s*"(\w+)"/g)) {
        const fields = ctx?.fields?.get(m[1]);
        if (!fields) continue; // the entity is not in this project's sources - nothing to assert against
        if (fields.has(m[2])) continue;
        hits.push({ line: clean.slice(0, m.index).split("\n").length, excerpt: `${m[1]} declares no ${m[2]} field` });
      }
      return hits;
    },
    samples: {
      file: "modules/site/src/main/java/app/web/site/dto/AreaDTOs.java",
      broken: `public class AreaDTOs {
    @UniqueFields({
        @UniqueField(entity = Area.class, field = "code", property = "code",
                idField = "areaId", idProperty = "areaId",
                softDeleteField = "deleted", softDeleteType = SoftDeleteType.BOOLEAN)
    })
    public static class AreaCreateDTO {
    }
}`,
      fixed: `public class AreaDTOs {
    @UniqueFields({
        @UniqueField(entity = Area.class, field = "code", property = "code",
                idField = "areaId", idProperty = "areaId")
    })
    public static class AreaCreateDTO {
    }
}`,
      // The rule needs the field index to know Area declares no \`deleted\`.
      ctx: { fields: new Map([["Area", new Set(["areaId", "code"])]]) },
    },
  },
  {
    id: "keyword-search-field-without-contains",
    invariant: "#15",
    level: "error",
    desc: "A SearchDTO field joins the keyword search (`keyword = true`) without CONTAINS among its operators. The searchable layer refuses the whole keyword query (SEARCH_INVALID_QUERY_SYNTAX, 「Keyword field ... must be a String that allows the CONTAINS operator」), so every word typed into the list's search box empties the list behind an error, on every field, not only this one. Give the field CONTAINS (in the generator input's searchOperators and on the DTO) or take it out of the keyword search",
    appliesTo: isDtoContainer,
    check: (c) => {
      const clean = stripComments(c);
      const out = [];
      for (const m of clean.matchAll(/@SearchableField\s*\(([^)]*)\)/g)) {
        const args = m[1];
        if (!/keyword\s*=\s*true/.test(args)) continue;
        const ops = (args.match(/operators\s*=\s*\{([^}]*)\}/) ?? [null, ""])[1];
        if (/\bCONTAINS\b/.test(ops)) continue;
        const field = (args.match(/entityField\s*=\s*"([\w.]+)"/) ?? [null, "?"])[1];
        out.push({ line: clean.slice(0, m.index).split("\n").length, excerpt: `${field} is a keyword field without CONTAINS` });
      }
      return out;
    },
    samples: {
      file: "modules/catalog/src/main/java/app/web/catalog/dto/VoiceDTOs.java",
      broken: `public class VoiceDTOs {
    public static class VoiceSearchDTO {
        @SearchableField(entityField = "code", operators = {EQUALS, IN}, sortable = true, keyword = true)
        private String code;
    }
}`,
      fixed: `public class VoiceDTOs {
    public static class VoiceSearchDTO {
        @SearchableField(entityField = "code", operators = {EQUALS, IN, CONTAINS}, sortable = true, keyword = true)
        private String code;

        @SearchableField(entityField = "status", operators = {EQUALS, IN}, sortable = true)
        private String status;
    }
}`,
    },
  },
  {
    id: "search-on-encrypted-column",
    invariant: "#15③",
    level: "error",
    desc: "A SearchDTO field searches or sorts a column the entity stores encrypted. The converter encrypts with a fresh IV, so EQUALS, IN, CONTAINS and every other value operator compare ciphertexts that never match, and sorting orders by ciphertext: the filter answers with an empty page and the sort scrambles the list, with no error anywhere. Only IS_NULL and IS_NOT_NULL mean something there; search an exact value through a hash column instead",
    appliesTo: isDtoContainer,
    check: (c, rel, ctx) => {
      const entity = path.basename(rel).replace(/DTOs?\.java$/, "");
      const encrypted = ctx?.encrypted?.get(entity);
      if (!encrypted) return [];
      const clean = stripComments(c);
      const out = [];
      for (const m of clean.matchAll(/@SearchableField\s*\(([^)]*)\)\s*(?:@[\w.]+(?:\([^)]*\))?\s*)*private\s+[\w<>,\s[\]]+?\s+(\w+)\s*;/g)) {
        const args = m[1].replace(/\s+/g, " ");
        const target = (args.match(/entityField\s*=\s*"([\w.]+)"/) ?? [null, m[2]])[1];
        if (!encrypted.has(target)) continue;
        const ops = (args.match(/operators\s*=\s*\{([^}]*)\}/) ?? [null, ""])[1]
          .split(",").map((o) => o.trim().replace(/^SearchOperator\./, "")).filter(Boolean);
        const bad = ops.filter((o) => o !== "IS_NULL" && o !== "IS_NOT_NULL");
        if (/sortable\s*=\s*true/.test(args)) bad.push("sortable");
        if (!bad.length) continue;
        out.push({ line: clean.slice(0, m.index).split("\n").length,
          excerpt: `${target} is encrypted: ${bad.join(", ")} can never match or order` });
      }
      return out;
    },
    samples: {
      file: "modules/member/src/main/java/app/web/member/dto/MemberDTOs.java",
      broken: `public class MemberDTOs {
    public static class MemberSearchDTO {
        @SearchableField(entityField = "email", operators = {EQUALS, CONTAINS}, sortable = true)
        private String email;
    }
}`,
      fixed: `public class MemberDTOs {
    public static class MemberSearchDTO {
        @SearchableField(entityField = "emailHashed", operators = {EQUALS})
        private String email;

        @SearchableField(entityField = "phone", operators = {IS_NULL, IS_NOT_NULL})
        private String phone;
    }
}`,
      // The rule needs to know which of Member's fields are encrypted.
      ctx: { encrypted: new Map([["Member", new Set(["email", "phone"])]]) },
    },
  },
  {
    id: "hand-written-row-drops-a-field",
    invariant: "#17 / canonical-service",
    level: "review",
    desc: "A hand-written mapper that skips a field BOTH sides declare - the source has it, the DTO has it, and the method that carries one into the other does not mention it. Nothing fails: the column is written, the DTO serializes, and the field is simply absent from the answer, so the screen draws a value that is there as a value that is not. This is where a field added to an entity goes missing, because the mapper is the one place the addition does not reach and the compiler has nothing to say about it",
    appliesTo: isService,
    check: (c, _file, ctx) => {
      const known = ctx?.fields;
      if (!known) return [];
      const clean = stripCommentsAndStrings(c);
      const out = [];
      // `Dto row = new Dto(); row.setX(src.getX()); … return row;` - the shape a promoted service
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
    id: "action-answer-mapped-before-flush",
    invariant: "canonical-service",
    level: "review",
    desc: "A write method maps its answer with `findById(id, Dto.class)` after another component wrote the row (a ledger, a guard, a reprocessing step), with no flush or refresh between. `findById` maps the instance the persistence context already holds: the columns the write set by hand are current, but a `@Formula` field keeps the value it was loaded with and the auditing fields (`updatedAt`, `updatedBy`) are set only at flush, so the answer reports the row as it was before the write. Flush and refresh the row before mapping it (`entityManager.flush()` then `entityManager.refresh(...)`), or name the project's own re-read helper in `.claude/simplix.json` `audit.rereadCalls`. A method whose own write is `saveAndFlush` keeps its audit fields current and is not reported; a formula over a column it changed would still be stale there. A mapping behind a helper of the service's own (`return detail(id)`) is not seen, so census those by hand",
    appliesTo: isService,
    check: (c, _rel, ctx) => {
      const clean = stripCommentsAndStrings(c);
      const declared = (Array.isArray(ctx?.audit?.rereadCalls) ? ctx.audit.rereadCalls : [])
        .filter((n) => typeof n === "string" && /^[A-Za-z_$][\w$.]*$/.test(n))
        .map((n) => n.replace(/\./g, "\\."));
      const REREAD = new RegExp(`\\bsaveAndFlush\\s*\\(|\\.flush\\s*\\(|\\brefresh\\s*\\(${declared.length ? `|\\b(?:${declared.join("|")})\\s*\\(` : ""}`);
      const hits = [];
      const re = /@Transactional\b(\s*\(([^)]*)\))?\s*(?:@\w+(?:\s*\([^)]*\))?\s*)*public\s+[\w<>,\s?]+?\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+[\w.,\s]+)?\{/g;
      let m;
      while ((m = re.exec(clean))) {
        if (m[2] && /readOnly\s*=\s*true/.test(m[2])) continue;
        const body = braceBody(clean, m.index + m[0].length - 1);
        const mapped = body.search(/\bfindById\s*\(\s*[^,()]+,\s*\w+\.class\s*\)/);
        if (mapped < 0) continue;
        const before = body.slice(0, mapped);
        if (REREAD.test(before)) continue;
        // A collaborator wrote first: a call on a field other than the service's own repository.
        if (!/\b(?!repository\b|modelMapper\b|entityManager\b|this\b)[a-z]\w*\s*\.\s*\w+\s*\(/.test(before)) continue;
        hits.push({ line: clean.slice(0, m.index).split("\n").length, excerpt: `${m[3]}() maps the row another component wrote without flushing or refreshing it` });
      }
      return hits;
    },
    samples: {
      file: "modules/admin/thing/src/main/java/app/web/admin/thing/service/AccountService.java",
      broken: `public class AccountService {
    @Transactional
    public AccountDetailDTO adjust(String accountId, AdjustDTO adjustDTO) {
        ledger.adjust(accountId, adjustDTO.getAmount());
        return findById(accountId, AccountDetailDTO.class).orElseThrow();
    }
}`,
      fixed: `public class AccountService {
    @Transactional
    public AccountDetailDTO adjust(String accountId, AdjustDTO adjustDTO) {
        ledger.adjust(accountId, adjustDTO.getAmount());
        entityManager.flush();
        repository.findById(accountId).ifPresent(entityManager::refresh);
        return findById(accountId, AccountDetailDTO.class).orElseThrow();
    }
}`,
      hit: [
        {
          note: "a re-read helper the project has but did not declare in audit.rereadCalls",
          ctx: {},
          source: `public class AccountService {
    @Transactional
    public AccountDetailDTO adjust(String accountId, AdjustDTO adjustDTO) {
        ledger.adjust(accountId, adjustDTO.getAmount());
        return findById(accountId, AccountDetailDTO.class).orElseThrow();
    }
}`,
        },
      ],
      miss: [
        {
          note: "a re-read helper the project declares in audit.rereadCalls",
          ctx: { audit: { rereadCalls: ["Rows.reread"] } },
          source: `public class AccountService {
    @Transactional
    public AccountDetailDTO adjust(String accountId, AdjustDTO adjustDTO) {
        ledger.adjust(accountId, adjustDTO.getAmount());
        Rows.reread(entityManager, Account.class, accountId);
        return findById(accountId, AccountDetailDTO.class).orElseThrow();
    }
}`,
        },
        {
          note: "the generated save-and-project shape, whose own write flushes",
          source: `public class AccountService {
    @Transactional
    public AccountDetailDTO create(AccountCreateDTO createDTO) {
        Account saved = saveAndFlush(mapper.map(createDTO));
        return findById(saved.getAccountId(), AccountDetailDTO.class).orElseThrow();
    }
}`,
        },
        {
          note: "a read-only method",
          source: `public class AccountService {
    @Transactional(readOnly = true)
    public AccountDetailDTO detail(String accountId) {
        policy.requireVisible(accountId);
        return findById(accountId, AccountDetailDTO.class).orElseThrow();
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
    desc: "A service forces its scope in search(Map) but not in the search(SearchCondition) overload: the controller opens GET /search and POST /search over the same list, so posting the same query returns rows the GET refuses. The two are one door and are narrowed the same way. A body reads as forced when it calls a `force*` method or a name the project lists in `.claude/simplix.json` `audit.scopeForcingCalls`",
    appliesTo: isService,
    check: (c, _rel, ctx) => {
      const clean = stripCommentsAndStrings(c);
      const FORCE = forcingPattern(ctx?.audit?.scopeForcingCalls);
      // Handing the whole call to the overload that IS narrowed is the third way to be narrowed,
      // and it is the shape a service reaches for when the two doors answer the same question -
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
      hit: [
        {
          note: "a scope helper the project declares in audit.scopeForcingCalls",
          ctx: { audit: { scopeForcingCalls: ["requireVisible"] } },
          source: `public class UserNoteService {
    public Page<UserNoteListDTO> search(Map<String, String> params) {
        Map<String, String> scoped = sites.requireVisible(params, "siteId");
        return findAllWithSearch(parse(scoped), UserNoteListDTO.class);
    }

    public Page<UserNoteListDTO> search(SearchCondition<UserNoteSearchDTO> searchCondition) {
        return findAllWithSearch(searchCondition, UserNoteListDTO.class);
    }
}`,
        },
      ],
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
        {
          note: "a project's own scope helper with no audit.scopeForcingCalls entry - the default knows only force*( and no product's names",
          ctx: {},
          source: `public class UserNoteService {
    public Page<UserNoteListDTO> search(Map<String, String> params) {
        Map<String, String> scoped = sites.requireVisible(params, "siteId");
        return findAllWithSearch(parse(scoped), UserNoteListDTO.class);
    }

    public Page<UserNoteListDTO> search(SearchCondition<UserNoteSearchDTO> searchCondition) {
        return findAllWithSearch(searchCondition, UserNoteListDTO.class);
    }
}`,
        },
        {
          note: "both overloads narrowed through the declared helper",
          ctx: { audit: { scopeForcingCalls: ["requireVisible"] } },
          source: `public class UserNoteService {
    public Page<UserNoteListDTO> search(Map<String, String> params) {
        Map<String, String> scoped = sites.requireVisible(params, "siteId");
        return findAllWithSearch(parse(scoped), UserNoteListDTO.class);
    }

    public Page<UserNoteListDTO> search(SearchCondition<UserNoteSearchDTO> searchCondition) {
        return findAllWithSearch(sites.requireVisible(searchCondition, "siteId"), UserNoteListDTO.class);
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
    desc: "A SearchDTO/CreateDTO field carries no @FieldLabel - a validation error on it then names the Java field instead of the translated label, in every locale. Audit fields (createdBy/createdAt/updatedBy/updatedAt) are BaseEntity-managed and exempt",
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
              excerpt: `${name}.${fm[1]} - no @FieldLabel`,
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
    desc: "Endpoint returns ResponseEntity<SimpliXApiResponse<...>> - the envelope is already the response, so this wraps it twice and the client reads a body whose fields are one level deeper than the contract says. Legitimate only for a 202-Accepted async command returning a Location header",
    appliesTo: isController,
    // The documented async command (invariant #1) is exempt: 202 Accepted plus a Location header
    // naming the polling endpoint. A 202 without the header, or a header on another status, is not.
    check: (c) => {
      const keep = stripComments(c);
      return lineHits(stripCommentsAndStrings(c), /ResponseEntity<\s*SimpliXApiResponse\s*</,
        (_line, _lines, i) => !answersAcceptedWithLocation(keep, i));
    },
    samples: {
      file: "modules/site/src/main/java/app/web/site/controller/AreaRestController.java",
      broken: `    public ResponseEntity<SimpliXApiResponse<AreaDetailDTO>> get(@PathVariable String areaId) { return null; }`,
      fixed: `    public SimpliXApiResponse<AreaDetailDTO> get(@PathVariable String areaId) { return null; }`,
      hit: [
        { note: "a 202 without a Location header is not the fire-and-poll shape", source: `    public ResponseEntity<SimpliXApiResponse<JobDTO>> start(@RequestBody StartDTO body) {
        return ResponseEntity.accepted().body(SimpliXApiResponse.success(service.start(body)));
    }` },
        { note: "a Location header on a 200 is not the fire-and-poll shape", source: `    public ResponseEntity<SimpliXApiResponse<JobDTO>> start(@RequestBody StartDTO body) {
        return ResponseEntity.ok().location(URI.create("/jobs/1")).body(SimpliXApiResponse.success(service.start(body)));
    }` },
        { note: "the exemption stops at the method: a second wrapped method after an async one still fires", source: `    public ResponseEntity<SimpliXApiResponse<JobDTO>> start(@RequestBody StartDTO body) {
        return ResponseEntity.accepted().location(URI.create("/jobs/1")).body(SimpliXApiResponse.success(service.start(body)));
    }

    public ResponseEntity<SimpliXApiResponse<JobDTO>> get(@PathVariable String id) {
        return ResponseEntity.ok(SimpliXApiResponse.success(service.get(id)));
    }` },
      ],
      miss: [
        { note: "fire-and-poll command: ResponseEntity.accepted() with a Location header", source: `    public ResponseEntity<SimpliXApiResponse<JobDTO>> start(@RequestBody StartDTO body) {
        JobDTO job = service.start(body);
        return ResponseEntity.accepted().location(URI.create("/jobs/" + job.getId())).body(SimpliXApiResponse.success(job));
    }` },
        { note: "fire-and-poll command: status(HttpStatus.ACCEPTED) with the header set through HttpHeaders.LOCATION", source: `    public ResponseEntity<SimpliXApiResponse<JobDTO>> start(@RequestBody StartDTO body) {
        JobDTO job = service.start(body);
        return ResponseEntity.status(HttpStatus.ACCEPTED).header(HttpHeaders.LOCATION, "/jobs/" + job.getId()).body(SimpliXApiResponse.success(job));
    }` },
        { note: "fire-and-poll command: status(202) with a literal Location header name", source: `    public ResponseEntity<SimpliXApiResponse<JobDTO>> start(@RequestBody StartDTO body) {
        return ResponseEntity.status(202).header("Location", "/jobs/1").body(SimpliXApiResponse.success(service.start(body)));
    }` },
      ],
    },
  },
  {
    id: "message-converters-replaced",
    invariant: "#1",
    level: "error",
    desc: "A WebMvcConfigurer overrides configureMessageConverters(List): adding anything there makes Spring MVC skip its default converters, so no Resource converter is registered and every ResponseEntity<Resource> answers 500. Change converters in extendMessageConverters(List), which receives the defaults (framework/runtime-behaviour.md)",
    appliesTo: (p) => /\.java$/.test(p) && !/src\/test\//.test(p),
    check: (c) => lineHits(stripCommentsAndStrings(c), /\bvoid\s+configureMessageConverters\s*\(\s*(?:@\w+\s+)*(?:final\s+)?(?:java\.util\.)?List\s*</),
    samples: {
      file: "app/config/WebConfig.java",
      broken: `public class WebConfig implements WebMvcConfigurer {
    @Override
    public void configureMessageConverters(@NonNull List<HttpMessageConverter<?>> converters) {
        converters.add(new StringHttpMessageConverter());
    }
}`,
      fixed: `public class WebConfig implements WebMvcConfigurer {
    @Override
    public void extendMessageConverters(@NonNull List<HttpMessageConverter<?>> converters) {
        converters.add(0, new StringHttpMessageConverter());
    }
}`,
      miss: [
        {
          note: "the Spring 7 ServerBuilder form keeps the defaults and only swaps the converters it names",
          source: `public class WebConfig implements WebMvcConfigurer {
    @Override
    public void configureMessageConverters(HttpMessageConverters.ServerBuilder builder) {
        builder.withStringConverter(new StringHttpMessageConverter(StandardCharsets.UTF_8));
    }
}`,
        },
      ],
      hit: [
        {
          note: "a final parameter with a qualified List",
          source: `public class WebConfig implements WebMvcConfigurer {
    @Override
    public void configureMessageConverters(final java.util.List<HttpMessageConverter<?>> converters) {
        converters.add(new MappingJackson2HttpMessageConverter());
    }
}`,
        },
      ],
    },
  },
  {
    id: "undocumented-response-entity",
    invariant: "#1",
    level: "review",
    desc: "Endpoint returns a bare ResponseEntity with no class-level JavaDoc saying why - binary streaming is the documented exception, and an undocumented one reads the same from outside. Confirm it streams bytes and record the reason, or return SimpliXApiResponse",
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
  {
    id: "labeled-enum-without-labels",
    invariant: "#16",
    level: "error",
    desc: "A LabeledEnum constant has no `enums.{SimpleName}.{CONSTANT}` key in one of the locales the enums bundles ship - SimpliX Meta then publishes the key with no text for that locale, and the screen prints the constant name (or the English label under another language)",
    appliesTo: (p) => /\.java$/.test(p) && !/src\/test\//.test(p),
    check: (c, rel, ctx) => {
      const clean = stripCommentsAndStrings(c);
      const decl = clean.match(/\benum\s+(\w+)\s+implements\s+[\w.,\s]*\bLabeledEnum\b[^{]*\{/);
      if (!decl || !ctx?.bundles) return [];
      const constants = enumConstants(clean.slice(decl.index + decl[0].length));
      const byLocale = enumBundleLocales(ctx.bundles);
      const hits = [];
      for (const [locale, keys] of byLocale) {
        const missing = constants.filter((k) => !keys.has(`enums.${decl[1]}.${k}`));
        if (missing.length) {
          hits.push({ line: clean.slice(0, decl.index).split("\n").length,
            excerpt: `${decl[1]}: no ${locale} label for ${missing.join(", ")}` });
        }
      }
      return hits;
    },
    samples: {
      file: "packages/domain-site/src/main/java/app/domain/site/enums/AreaStatus.java",
      ctx: { bundles: [
        { file: "x/src/main/resources/messages/enums/enums-site-messages.properties", keys: new Set(["enums.AreaStatus.OPEN", "enums.AreaStatus.CLOSED"]) },
        { file: "x/src/main/resources/messages/enums/enums-site-messages_ko.properties", keys: new Set(["enums.AreaStatus.OPEN"]) },
      ] },
      broken: `public enum AreaStatus implements LabeledEnum {\n    OPEN,\n    CLOSED\n}`,
      fixed: `public enum AreaStatus implements LabeledEnum {\n    OPEN\n}`,
      hit: [
        {
          note: "an enum with no labels in any bundle, constants carrying annotations and constructor arguments",
          source: `public enum Standing implements LabeledEnum {\n    @Tone(ToneKind.SUCCESS)\n    ACTIVE(" AND a.enabled = true"),\n    SUSPENDED(" AND a.enabled = false");\n    private final String predicate;\n}`,
        },
      ],
      miss: [
        {
          note: "every constant labelled in every locale, the labels living in another module's bundle",
          source: `public enum AreaStatus implements LabeledEnum {\n    @Tone(ToneKind.SUCCESS) OPEN,\n    CLOSED;\n    public boolean open() { return this == OPEN; }\n}`,
          ctx: { bundles: [
            { file: "a/src/main/resources/messages/enums/enums-a-messages.properties", keys: new Set(["enums.AreaStatus.OPEN", "enums.AreaStatus.CLOSED"]) },
            { file: "b/src/main/resources/messages/enums/enums-b-messages_ko.properties", keys: new Set(["enums.AreaStatus.OPEN", "enums.AreaStatus.CLOSED"]) },
          ] },
        },
      ],
    },
  },
  {
    id: "api-enum-not-labeled",
    invariant: "#16",
    level: "review",
    desc: "An enum documented with @Schema for a request or response is not a LabeledEnum - SimpliX Meta publishes it with no label keys, so every locale shows the constant names. Implement LabeledEnum and add its `enums.*` keys, or mark the line when the values are machine codes nobody reads",
    appliesTo: (p) => /\.java$/.test(p) && !/src\/test\//.test(p),
    check: (c) => {
      const clean = stripCommentsAndStrings(c);
      const decl = clean.match(/@Schema\b[^;{}]*?\benum\s+(\w+)\s*(implements\s+[^{]*)?\{/);
      if (!decl || /\bLabeledEnum\b/.test(decl[2] ?? "")) return [];
      return [{ line: clean.slice(0, decl.index).split("\n").length, excerpt: `${decl[1]} is exposed through @Schema without LabeledEnum` }];
    },
    samples: {
      file: "modules/user-admin/src/main/java/app/web/user/admin/dto/Standing.java",
      broken: `@Schema(description = "Where an account stands")\npublic enum Standing {\n    ACTIVE, SUSPENDED\n}`,
      fixed: `@Schema(description = "Where an account stands")\npublic enum Standing implements LabeledEnum {\n    ACTIVE, SUSPENDED\n}`,
      miss: [
        { note: "an internal enum no contract documents", source: `public enum Realm {\n    STAFF, CUSTOMER\n}` },
      ],
    },
  },
  {
    id: "display-text-without-i18n",
    invariant: "i18n-field-patterns",
    level: "review",
    desc: "A String entity column whose name or @Comment marks display text has no `<field>I18n` sibling - text an operator or the product writes once and people read in several languages is stored in one language. Convert it (entity/field-types.md § Multilingual text: which columns), or record it in `audit.i18nAllow` of `.claude/simplix.json` with the reason it stays single-language",
    appliesTo: (p) => /\/entity\/[^/]+\.java$/.test(p.split(path.sep).join("/")),
    check: (c, rel, ctx) => {
      const clean = stripCommentsAndStrings(c);
      if (!/@Entity\b/.test(clean)) return [];
      const entity = clean.match(/\bclass\s+(\w+)/)?.[1] ?? path.basename(rel, ".java");
      const policy = displayTextPolicy(ctx?.audit);
      const declared = new Set([...clean.matchAll(/\b(?:private|protected)\s+[\w<>,.?\s]+?\s+(\w+)\s*[;=]/g)].map((m) => m[1]));
      const hits = [];
      for (const m of clean.matchAll(/\b(?:private|protected)\s+String\s+(\w+)\s*[;=]/g)) {
        const field = m[1];
        const before = clean.slice(0, m.index);
        const start = Math.max(before.lastIndexOf(";"), before.lastIndexOf("{"), before.lastIndexOf("}"));
        if (/@Transient\b/.test(before.slice(start + 1))) continue;
        // A @Formula field has no column of its own: it reads another table's text, and is
        // translated where that text is stored, never here.
        if (/@Formula\b/.test(before.slice(start + 1))) continue;
        // The raw source at the same offsets: comment and string bodies are blanked in `clean`.
        const comment = c.slice(start + 1, m.index).match(/@Comment\s*\(\s*"([^"]*)"/)?.[1] ?? "";
        if (declared.has(`${field}I18n`)) continue;
        // Derived columns of a localized field (`nameSearch`, `nameSortEn`) follow their base.
        const base = field.match(/^(\w+?)(?:Search|Sort[A-Z][a-z])$/)?.[1];
        if (base && declared.has(`${base}I18n`)) continue;
        if (!policy.name.test(field) && !(comment && policy.comment.test(comment))) continue;
        if (policy.allowed(entity, field)) continue;
        hits.push({ line: before.split("\n").length, excerpt: `${entity}.${field}${comment ? ` (${comment})` : ""} has no ${field}I18n` });
      }
      return hits;
    },
    samples: {
      file: "packages/domain-site/src/main/java/app/domain/site/entity/Area.java",
      broken: `@Entity\npublic class Area {\n    @Column(name = "area_name")\n    private String areaName;\n}`,
      fixed: `@Entity\npublic class Area {\n    @Column(name = "area_name")\n    private String areaName;\n    @JdbcTypeCode(SqlTypes.JSON)\n    private Map<String, String> areaNameI18n;\n    private String areaNameSearch;\n    private String areaNameSortEn;\n}`,
      hit: [
        { note: "marked by its comment, not its name", source: `@Entity\npublic class Notice {\n    @Comment("Text shown as the banner title")\n    private String headline;\n}` },
        {
          note: "an allow entry without a reason suppresses nothing",
          source: `@Entity\npublic class Area {\n    private String areaName;\n}`,
          ctx: { audit: { i18nAllow: [{ entity: "Area", field: "areaName", reason: "" }] } },
        },
      ],
      miss: [
        { note: "a code, an id and a username are not display text", source: `@Entity\npublic class Area {\n    @Comment("Stable code clients refer to")\n    private String areaCode;\n    private String areaId;\n    private String username;\n}` },
        {
          note: "a derived name read through @Formula has no column to translate",
          source: `@Entity\npublic class Order {\n    @Formula("(select u.display_name from users u where u.user_id = owner_id)")\n    private String ownerName;\n}`,
        },
        {
          note: "allow-listed with its reason",
          source: `@Entity\npublic class Team {\n    private String name;\n}`,
          ctx: { audit: { i18nAllow: [{ entity: "Team", field: "name", reason: "the customer names their own team" }] } },
        },
        {
          note: "a project that narrows the name pattern",
          source: `@Entity\npublic class Mail {\n    private String subject;\n}`,
          ctx: { audit: { i18nDisplayText: { namePattern: "(?:Name|Title)$" } } },
        },
      ],
    },
  },
  {
    id: "filter-def-applied-to-load-by-key",
    invariant: "base-entity-patterns / soft delete",
    level: "error",
    desc: "A @FilterDef sets applyToLoadByKey = true. Hibernate then also applies the filter to every to-one association that targets the entity and throws EntityFilterException when the target row is filtered out, so a row that refers to a soft-deleted parent (a note under a deleted account) fails to load in a find and in every list query. SimpliXJpaRepository already applies an entity's enabled filters to findById, so leave the attribute at its default",
    appliesTo: (p) => /\.java$/.test(p) && !/src\/test\//.test(p),
    check: (c) => annotationUses(stripCommentsAndStrings(c), "FilterDef")
      .filter((u) => /\bapplyToLoadByKey\s*=\s*true\b/.test(u.args))
      .map(({ line, excerpt }) => ({ line, excerpt })),
    samples: {
      file: "packages/domain-core/src/main/java/app/domain/core/entity/BaseEntity.java",
      broken: `@MappedSuperclass
@FilterDef(
        name = SoftDeletable.FILTER_NAME,
        parameters = @ParamDef(name = SoftDeletable.PARAM_IS_DELETED, type = Boolean.class),
        defaultCondition = "deleted = false",
        applyToLoadByKey = true
)
public abstract class BaseEntity<K> {
}`,
      fixed: `@MappedSuperclass
@FilterDef(
        name = SoftDeletable.FILTER_NAME,
        parameters = @ParamDef(name = SoftDeletable.PARAM_IS_DELETED, type = Boolean.class),
        defaultCondition = "deleted = false"
)
public abstract class BaseEntity<K> {
}`,
      hit: [
        {
          note: "fully qualified, on one line",
          source: `@org.hibernate.annotations.FilterDef(name = "f", applyToLoadByKey=true)\npublic class Item {}`,
        },
      ],
      miss: [
        {
          note: "the attribute set to its default",
          source: `@FilterDef(name = "f", applyToLoadByKey = false)\npublic class Item {}`,
        },
        {
          note: "the attribute named only in a comment",
          source: `// never set applyToLoadByKey = true here\n@FilterDef(name = "f")\npublic class Item {}`,
        },
      ],
    },
  },
  {
    id: "jpa-repositories-without-simplix-factory",
    invariant: "#4 / repository-patterns",
    level: "error",
    desc: "@EnableJpaRepositories without repositoryFactoryBeanClass = SimpliXRepositoryFactoryBean.class. Declaring it replaces the starter's own repository configuration, so the repositories are built on Spring Data's SimpleJpaRepository: findById then reads through EntityManager.find, which no Hibernate session filter reaches, and a soft-deleted row stays readable by id (detail, edit and update) while the list drops it; tree repositories lose their implementation too",
    appliesTo: (p) => /\.java$/.test(p) && !/src\/test\//.test(p),
    check: (c) => annotationUses(stripCommentsAndStrings(c), "EnableJpaRepositories")
      .filter((u) => !/\brepositoryFactoryBeanClass\s*=\s*(?:[\w.]+\.)?SimpliXRepositoryFactoryBean\.class\b/.test(u.args))
      .map(({ line, excerpt }) => ({ line, excerpt })),
    samples: {
      file: "apps/app-server/src/main/java/app/server/config/DataSourceConfig.java",
      broken: `@Configuration
@EnableJpaRepositories(
    basePackages = "app.domain",
    entityManagerFactoryRef = "entityManagerFactory"
)
public class DataSourceConfig {
}`,
      fixed: `@Configuration
@EnableJpaRepositories(
    basePackages = "app.domain",
    repositoryFactoryBeanClass = SimpliXRepositoryFactoryBean.class,
    entityManagerFactoryRef = "entityManagerFactory"
)
public class DataSourceConfig {
}`,
      hit: [
        {
          note: "no arguments at all",
          source: `@Configuration\n@EnableJpaRepositories\npublic class DataSourceConfig {}`,
        },
        {
          note: "another factory bean",
          source: `@EnableJpaRepositories(basePackages = "app", repositoryFactoryBeanClass = JpaRepositoryFactoryBean.class)\npublic class C {}`,
        },
      ],
      miss: [
        {
          note: "the factory named by its qualified name",
          source: `@EnableJpaRepositories(repositoryFactoryBeanClass = dev.simplecore.simplix.core.tree.factory.SimpliXRepositoryFactoryBean.class)\npublic class C {}`,
        },
      ],
    },
  },
  {
    id: "labeled-enum-label-bypass",
    invariant: "#16",
    level: "error",
    desc: "A LabeledEnum overrides getLabel(), or declares a constant with a class body. LabeledEnum's own getLabel() resolves enums.{SimpleName}.{CONSTANT} from the enums bundles in the request locale; an override bypasses the bundles, and a constant with a body resolves against its anonymous subclass's name, so either way every locale shows the same text and no translation test notices",
    appliesTo: (p) => /\.java$/.test(p) && !/src\/test\//.test(p),
    check: (c) => {
      const clean = stripCommentsAndStrings(c);
      if (!/\benum\s+\w+\s+implements\s+[\w.,\s]*\bLabeledEnum\b/.test(clean)) return [];
      const override = lineHits(clean, /\bString\s+getLabel\s*\(/);
      // A constant with a class body: an UPPER_SNAKE name, optional constructor arguments, then `{`.
      const body = lineHits(clean, /^\s*[A-Z][A-Z0-9_]*\s*(?:\([^)]*\))?\s*\{/);
      return [...override, ...body].sort((a, b) => a.line - b.line);
    },
    samples: {
      file: "packages/domain-site/src/main/java/app/domain/site/enums/AreaStatus.java",
      broken: `public enum AreaStatus implements LabeledEnum {
    OPEN,
    CLOSED;

    @Override
    public String getLabel() {
        return name();
    }
}`,
      fixed: `public enum AreaStatus implements LabeledEnum {
    OPEN,
    CLOSED
}`,
      hit: [
        {
          note: "a constant with a class body",
          source: `public enum AreaStatus implements LabeledEnum {
    OPEN {
        boolean accepts() { return true; }
    },
    CLOSED;
}`,
        },
        {
          note: "an override of the locale-taking form",
          source: `public enum AreaStatus implements LabeledEnum {
    OPEN, CLOSED;
    @Override
    public String getLabel(Locale locale) { return name(); }
}`,
        },
      ],
      miss: [
        {
          note: "constants with constructor arguments and a field, no class body",
          source: `public enum AreaStatus implements LabeledEnum {
    OPEN("O"),
    CLOSED("C");

    private final String code;

    AreaStatus(String code) { this.code = code; }

    public String getCode() { return code; }
}`,
        },
        {
          note: "an enum that is not a LabeledEnum",
          source: `public enum Direction {
    UP {
        Direction flip() { return DOWN; }
    },
    DOWN;
    public String getLabel() { return name(); }
}`,
        },
        {
          note: "a call to getLabel(), not a declaration",
          source: `public enum AreaStatus implements LabeledEnum {
    OPEN, CLOSED;
    public String describe() { return "status " + getLabel(); }
}`,
        },
      ],
    },
  },
  {
    id: "validated-properties-record",
    invariant: "runtime",
    level: "error",
    desc: "@Validated on a @ConfigurationProperties record - a record cannot be proxied, so a slice test that never binds it passes and the full context fails to start. Check the values in the record's compact constructor instead",
    appliesTo: () => true,
    check: (c) => {
      const code = stripCommentsAndStrings(c);
      if (!/@ConfigurationProperties\b/.test(code) || !/\brecord\s+\w+\s*[(<]/.test(code)) {
        return [];
      }
      return lineHits(code, /^\s*@Validated\b/);
    },
    samples: {
      file: "packages/billing/src/main/java/app/billing/LedgerProperties.java",
      broken: `@Validated
@ConfigurationProperties(prefix = "app.ledger")
public record LedgerProperties(@Min(1) int limit) {
}`,
      hit: [
        {
          note: "@Validated below the properties annotation",
          source: `@ConfigurationProperties(prefix = "app.ledger")
@Validated
public record LedgerProperties(@Min(1) int limit) {
}`,
        },
      ],
      fixed: `@ConfigurationProperties(prefix = "app.ledger")
public record LedgerProperties(int limit) {
    public LedgerProperties {
        if (limit < 1) {
            throw new IllegalArgumentException("app.ledger.limit must be at least 1");
        }
    }
}`,
      miss: [
        {
          note: "@Validated on a properties class, which Spring can proxy",
          source: `@Validated
@ConfigurationProperties(prefix = "app.ledger")
public class LedgerProperties {
    @Min(1) private int limit;
}`,
        },
      ],
    },
  },
  {
    id: "duplicate-dto-simple-name",
    invariant: "dto/simple-name",
    level: "error",
    desc: "Two DTO classes that a controller exposes share one Java simple name (`<Entity>ListDTO` in two packages, or the same inner class name in two `*DTOs` containers). SimpliX Meta keys every type by the simple name of the Java class, inner classes included (`Outer.Inner` is registered as `Inner`), and refuses the second one: `GET /api/v1/dev/meta/dto` answers 409 \"Duplicate DTO simple name\" at the next restart, which stops the frontend codegen, while the build, the tests and the API itself stay green. A DTO simple name is unique across the whole backend: rename one (`Portal<Entity>ListDTO`). Declarations in test sources are not read. A name no controller is seen to reach is reported as review by duplicate-dto-simple-name-unreached",
    appliesTo: (p) => p.endsWith(".java"),
    check: (c, rel, ctx) => duplicateDtoNameHits(c, rel, ctx, "error"),
    samples: {
      file: "modules/portal/thing/src/main/java/app/web/thing/dto/PortalThingDTOs.java",
      ctx: { dtoNames: buildDtoNameIndex(twinDtoSources("ThingListDTO")) },
      broken: `public class PortalThingDTOs {\n    public static class ThingListDTO { private String name; }\n}\n`,
      fixed: `public class PortalThingDTOs {\n    public static class PortalThingListDTO { private String name; }\n}\n`,
      hit: [
        {
          note: "two top-level DTO files in different packages",
          file: "modules/portal/thing/src/main/java/app/web/thing/ThingListDTO.java",
          source: `public class ThingListDTO { private String name; }\n`,
        },
      ],
      miss: [
        {
          note: "the first of the two declarations (the later one is the one reported)",
          file: "modules/admin/thing/src/main/java/app/web/thing/dto/AdminThingDTOs.java",
          source: `public class AdminThingDTOs {\n    public static class ThingListDTO { private String name; }\n}\n`,
        },
        {
          note: "a plain helper class nested in a DTO container's DTO, which Meta does not register by being a member of the container",
          source: `public class PortalThingDTOs {\n    public static class PortalThingListDTO {\n        public static class Builder { }\n    }\n}\n`,
          ctx: { dtoNames: buildDtoNameIndex([{ rel: "modules/admin/thing/src/main/java/app/web/thing/dto/AdminThingDTOs.java", src: `public class AdminThingDTOs {\n    public static class ThingListDTO {\n        public static class Builder { }\n    }\n}\n` }, { rel: "modules/admin/thing/src/main/java/app/web/thing/AdminThingController.java", src: `class C { Builder b; ThingListDTO d; }` }]) },
        },
        {
          note: "a duplicate that no controller reaches belongs to the review rule",
          ctx: { dtoNames: buildDtoNameIndex(twinDtoSources("ThingListDTO").slice(0, 2).map((s) => ({ ...s }))) },
          source: `public class PortalThingDTOs {\n    public static class ThingListDTO { private String name; }\n}\n`,
        },
      ],
    },
  },
  {
    id: "entity-default-sort-differs-across-controllers",
    invariant: "controller/class-level-list-metadata",
    level: "review",
    desc: "Two controllers over one entity declare different `@SimpliXDefaultSort` values (an admin list by `name asc`, the customer's own list by `createdAt desc`). SimpliX Meta writes one `defaultSort` per entity, so which controller wins depends on registration order: every `simplix meta` run can flip the entity's default sort in `meta.json` and the generated list config with no source change, and the diff shows a hunk nobody wrote. Give both controllers the same default sort where the lists mean the same order (a record table read by its own time stamp), or keep the difference on purpose and restore that hunk after each regeneration until Meta carries a sort per endpoint. Only the later controller in path order is reported, naming the first",
    appliesTo: (p) => p.endsWith(".java"),
    check: (c, rel, ctx) => entityDeclarationDiffers(c, rel, ctx?.defaultSorts, defaultSortOf,
      (own, first) => `${own.entity} sorts by ${own.value} here and by ${first.value} at ${first.rel}:${first.line}`),
    samples: {
      file: "modules/portal/thing/src/main/java/app/web/portal/thing/controller/MyThingRestController.java",
      ctx: { defaultSorts: buildDefaultSortIndex([
        { rel: "modules/admin/thing/src/main/java/app/web/admin/thing/controller/AdminThingRestController.java", src: `@SimpliXDefaultSort(field = "name", direction = "asc")\npublic class AdminThingRestController extends SimpliXBaseController<Thing, String> { }\n` },
        { rel: "modules/portal/thing/src/main/java/app/web/portal/thing/controller/MyThingRestController.java", src: `@SimpliXDefaultSort(field = "createdAt", direction = "desc")\npublic class MyThingRestController extends SimpliXBaseController<Thing, String> { }\n` },
      ]) },
      broken: `@SimpliXDefaultSort(field = "createdAt", direction = "desc")\npublic class MyThingRestController extends SimpliXBaseController<Thing, String> { }\n`,
      fixed: `@SimpliXDefaultSort(field = "name", direction = "asc")\npublic class MyThingRestController extends SimpliXBaseController<Thing, String> { }\n`,
      miss: [
        {
          note: "the first controller in path order (the later one is the one reported)",
          file: "modules/admin/thing/src/main/java/app/web/admin/thing/controller/AdminThingRestController.java",
          source: `@SimpliXDefaultSort(field = "name", direction = "asc")\npublic class AdminThingRestController extends SimpliXBaseController<Thing, String> { }\n`,
        },
        {
          note: "a controller over another entity",
          source: `@SimpliXDefaultSort(field = "createdAt", direction = "desc")\npublic class MyOtherRestController extends SimpliXBaseController<Other, String> { }\n`,
        },
        {
          note: "the same sort written with the default direction (desc) left out",
          ctx: { defaultSorts: buildDefaultSortIndex([
            { rel: "modules/admin/thing/src/main/java/app/web/admin/thing/controller/AdminThingRestController.java", src: `@SimpliXDefaultSort(field = "name")\npublic class AdminThingRestController extends SimpliXBaseController<Thing, String> { }\n` },
            { rel: "modules/portal/thing/src/main/java/app/web/portal/thing/controller/MyThingRestController.java", src: `@SimpliXDefaultSort(field = "name", direction = "DESC")\npublic class MyThingRestController extends SimpliXBaseController<Thing, String> { }\n` },
          ]) },
          source: `@SimpliXDefaultSort(field = "name", direction = "DESC")\npublic class MyThingRestController extends SimpliXBaseController<Thing, String> { }\n`,
        },
      ],
    },
  },
  {
    id: "entity-list-figures-differ-across-controllers",
    invariant: "controller/class-level-list-metadata",
    level: "review",
    desc: "Two controllers over one entity declare different `@SimpliXListFigures` status counts or aggregates (an operators' ledger counted by entry type and summed by amount, the customer's own summed by remaining amount and amount). Each controller's operations carry their own figures, but SimpliX Meta also writes one `statusCounts` and one `aggregates` on the entity, and which controller wins depends on registration order: a `simplix meta` run can flip that entity block in `meta.json` with no source change, and the diff shows a hunk nobody wrote. Give both controllers the same figures where the lists mean the same summary, or keep the difference on purpose and leave that hunk out of each regeneration's commit until Meta keys entity figures per endpoint. Only the later controller in path order is reported, naming the first",
    appliesTo: (p) => p.endsWith(".java"),
    check: (c, rel, ctx) => entityDeclarationDiffers(c, rel, ctx?.listFigures, listFiguresOf,
      (own, first) => `${own.entity} declares ${own.value} here and ${first.value} at ${first.rel}:${first.line}`),
    samples: {
      file: "modules/portal/thing/src/main/java/app/web/portal/thing/controller/MyThingRestController.java",
      ctx: { listFigures: buildListFiguresIndex([
        { rel: "modules/admin/thing/src/main/java/app/web/admin/thing/controller/AdminThingRestController.java", src: `@SimpliXListFigures(statusCounts = {"kind"}, aggregates = {@SimpliXListFigures.Figure(field = "amount", op = "sum")})\npublic class AdminThingRestController extends SimpliXBaseController<Thing, String> { }\n` },
        { rel: "modules/portal/thing/src/main/java/app/web/portal/thing/controller/MyThingRestController.java", src: `@SimpliXListFigures(statusCounts = {}, aggregates = {@SimpliXListFigures.Figure(field = "left", op = "sum"), @SimpliXListFigures.Figure(field = "amount", op = "sum")})\npublic class MyThingRestController extends SimpliXBaseController<Thing, String> { }\n` },
      ]) },
      broken: `@SimpliXListFigures(statusCounts = {}, aggregates = {@SimpliXListFigures.Figure(field = "left", op = "sum"), @SimpliXListFigures.Figure(field = "amount", op = "sum")})\npublic class MyThingRestController extends SimpliXBaseController<Thing, String> { }\n`,
      fixed: `@SimpliXListFigures(statusCounts = {"kind"}, aggregates = {@SimpliXListFigures.Figure(field = "amount", op = "sum")})\npublic class MyThingRestController extends SimpliXBaseController<Thing, String> { }\n`,
      hit: [
        {
          note: "the same aggregates and a status count only one of them declares, the single-value form",
          source: `@SimpliXListFigures(statusCounts = "status", aggregates = {@SimpliXListFigures.Figure(field = "amount", op = "sum")})\npublic class MyThingRestController extends SimpliXBaseController<Thing, String> { }\n`,
        },
      ],
      miss: [
        {
          note: "the first controller in path order (the later one is the one reported)",
          file: "modules/admin/thing/src/main/java/app/web/admin/thing/controller/AdminThingRestController.java",
          source: `@SimpliXListFigures(statusCounts = {"kind"}, aggregates = {@SimpliXListFigures.Figure(field = "amount", op = "sum")})\npublic class AdminThingRestController extends SimpliXBaseController<Thing, String> { }\n`,
        },
        {
          note: "a controller over another entity",
          source: `@SimpliXListFigures(statusCounts = {}, aggregates = {@SimpliXListFigures.Figure(field = "left", op = "sum")})\npublic class MyOtherRestController extends SimpliXBaseController<Other, String> { }\n`,
        },
        {
          note: "a controller that declares no figures publishes none on the entity",
          source: `public class MyThingRestController extends SimpliXBaseController<Thing, String> { }\n`,
        },
      ],
    },
  },
  {
    id: "duplicate-dto-simple-name-unreached",
    invariant: "dto/simple-name",
    level: "review",
    desc: "A DTO-shaped simple name is declared twice, but no controller is seen to reach it, or two request or response body classes (`*Request`, `*Response`, `*Body`, `*Payload`) share a name that a controller does reach. SimpliX Meta refuses a duplicate simple name only for a class it registers, which follows controller signatures and the fields of the DTOs they carry. This audit reads identifiers rather than resolving types, so it cannot tell whether the second class is registered: rename one if it can ever be exposed, and leave the name when it is an internal type that no endpoint carries",
    appliesTo: (p) => p.endsWith(".java"),
    check: (c, rel, ctx) => duplicateDtoNameHits(c, rel, ctx, "review"),
    samples: {
      file: "modules/portal/thing/src/main/java/app/web/thing/dto/PortalThingDTOs.java",
      ctx: { dtoNames: buildDtoNameIndex(twinDtoSources("ThingListDTO").slice(0, 2)) },
      broken: `public class PortalThingDTOs {\n    public static class ThingListDTO { private String name; }\n}\n`,
      fixed: `public class PortalThingDTOs {\n    public static class PortalThingListDTO { private String name; }\n}\n`,
      miss: [
        {
          note: "a duplicate that a controller reaches is an error, not a review candidate",
          ctx: { dtoNames: buildDtoNameIndex(twinDtoSources("ThingListDTO")) },
          source: `public class PortalThingDTOs {\n    public static class ThingListDTO { private String name; }\n}\n`,
        },
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// Self-test - every rule against the broken form and the fixed form
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
    {
      name: "collection: a single-module src/main/java and a module's are both read, test sources are not",
      pass: () => withTree({
        "src/main/java/app/web/AreaRestController.java": "class A {}",
        "modules/site/src/main/java/app/web/SiteRestController.java": "class B {}",
        "src/test/java/app/web/AreaRestControllerTest.java": "class C {}",
      }, (dir) => {
        const found = collectSources(dir).map((f) => path.relative(dir, f)).sort();
        return found.length === 2
          && found[0] === path.join("modules", "site", "src", "main", "java", "app", "web", "SiteRestController.java")
          && found[1] === path.join("src", "main", "java", "app", "web", "AreaRestController.java");
      }),
    },
    {
      name: "collection: a directory holding no backend reads as zero sources, which the runner refuses",
      pass: () => withTree({ "README.md": "not a backend" }, (dir) => collectSources(dir).length === 0),
    },
    {
      name: "duplicate DTO names: a whole tree reports the incident shape once, from the files on disk",
      pass: () => {
        const hits = dtoTreeHits({
          "modules/admin/thing/src/main/java/app/AdminThingDTOs.java": `public class AdminThingDTOs {\n    public static class ThingListDTO { }\n}\n`,
          "modules/portal/thing/src/main/java/app/PortalThingDTOs.java": `public class PortalThingDTOs {\n    public static class ThingListDTO { }\n}\n`,
          "modules/admin/thing/src/main/java/app/AdminThingController.java": `class AdminThingController { ThingListDTO list() { return null; } }\n`,
        });
        return hits.error.length === 1 && hits.error[0].includes("PortalThingDTOs.java") && hits.error[0].includes("AdminThingDTOs.java:2") && hits.review.length === 0;
      },
    },
    {
      name: "duplicate DTO names: distinct names are silent",
      pass: () => {
        const hits = dtoTreeHits({
          "modules/admin/thing/src/main/java/app/AdminThingDTOs.java": `public class AdminThingDTOs {\n    public static class ThingListDTO { }\n}\n`,
          "modules/portal/thing/src/main/java/app/PortalThingDTOs.java": `public class PortalThingDTOs {\n    public static class PortalThingListDTO { }\n}\n`,
          "modules/admin/thing/src/main/java/app/AdminThingController.java": `class AdminThingController { ThingListDTO list() { return null; } }\n`,
        });
        return hits.error.length === 0 && hits.review.length === 0;
      },
    },
    {
      name: "duplicate DTO names: a copy in test sources is never read",
      pass: () => {
        const hits = dtoTreeHits({
          "modules/admin/thing/src/main/java/app/AdminThingDTOs.java": `public class AdminThingDTOs {\n    public static class ThingListDTO { }\n}\n`,
          "modules/admin/thing/src/test/java/app/ThingFixtures.java": `public class ThingFixtures {\n    public static class ThingListDTO { }\n}\n`,
          "modules/admin/thing/src/main/java/app/AdminThingController.java": `class AdminThingController { ThingListDTO list() { return null; } }\n`,
        });
        return hits.error.length === 0 && hits.review.length === 0;
      },
    },
    {
      name: "duplicate DTO names: a DTO reached only through another DTO's field still counts as reached",
      pass: () => {
        const hits = dtoTreeHits({
          "modules/a/src/main/java/app/ADTOs.java": `public class ADTOs {\n    public static class OuterDTO { private InnerDTO inner; }\n    public static class InnerDTO { }\n}\n`,
          "modules/b/src/main/java/app/BDTOs.java": `public class BDTOs {\n    public static class InnerDTO { }\n}\n`,
          "modules/a/src/main/java/app/AController.java": `class AController { OuterDTO get() { return null; } }\n`,
        });
        return hits.error.length === 1;
      },
    },
    {
      name: "duplicate DTO names: a duplicate no controller mentions is a review candidate, never an error",
      pass: () => {
        const hits = dtoTreeHits({
          "modules/a/src/main/java/app/ADTOs.java": `public class ADTOs {\n    public static class ThingListDTO { }\n}\n`,
          "modules/b/src/main/java/app/BDTOs.java": `public class BDTOs {\n    public static class ThingListDTO { }\n}\n`,
        });
        return hits.error.length === 0 && hits.review.length === 1;
      },
    },
    {
      name: "duplicate DTO names: two plain inner classes that share a name in two DTOs are not DTO-shaped",
      pass: () => {
        const hits = dtoTreeHits({
          "modules/a/src/main/java/app/ADTOs.java": `public class ADTOs {\n    public static class AListDTO { public static class Builder { } }\n}\n`,
          "modules/b/src/main/java/app/BDTOs.java": `public class BDTOs {\n    public static class BListDTO { public static class Builder { } }\n}\n`,
          "modules/a/src/main/java/app/AController.java": `class AController { AListDTO a; BListDTO b; Builder c; }\n`,
        });
        return hits.error.length === 0 && hits.review.length === 0;
      },
    },
    {
      name: "settings: the audit section of .claude/simplix.json is read, and a missing file is the empty policy",
      pass: () =>
        withTree({ ".claude/simplix.json": `{ "audit": { "scopeForcingCalls": ["requireVisible"] } }` },
          (dir) => auditSettings(dir).scopeForcingCalls?.[0] === "requireVisible")
        && withTree({}, (dir) => Object.keys(auditSettings(dir)).length === 0),
    },
    {
      name: "scheduler-lock-on-primitive-return: over a scratch tree it reports the int sweep, not the void one, and a marker with a reason mutes it",
      pass: () => {
        const rule = RULES.find((r) => r.id === "scheduler-lock-on-primitive-return");
        const hitsIn = (files) => withTree(files, (dir) => {
          const out = [];
          for (const abs of collectSources(dir)) {
            const rel = path.relative(dir, abs);
            const content = fs.readFileSync(abs, "utf8");
            const muted = suppressedLines(content, rule.id);
            if (rule.appliesTo(rel)) out.push(...rule.check(content, rel, {}).filter((h) => !muted.has(h.line)));
          }
          return out;
        });
        const job = (declaration, marker = "") => ({
          "modules/common/worker/src/main/java/app/Job.java": `package app;\nclass Job {\n${marker}    @Scheduled(cron = "0 * * * * *")\n    @SchedulerLock(name = "Job_sweep", lockAtMostFor = "50s")\n    ${declaration} {\n    }\n}\n`,
        });
        return hitsIn(job("public int sweep()")).length === 1
          && hitsIn(job("public void sweep()")).length === 0
          && hitsIn(job("public int sweep()", "    // simplix-audit-ignore[scheduler-lock-on-primitive-return]: invoked by hand only, never by the tick\n")).length === 0;
      },
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

/**
 * Run `fn` against a scratch directory holding `files`, then remove that directory.
 *
 * @param files relative path to contents
 * @param fn called with the directory's absolute path
 * @returns what `fn` returned
 */
function withTree(files, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-backend-selftest-"));
  try {
    for (const [rel, body] of Object.entries(files)) {
      const abs = path.join(dir, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, body);
    }
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Run both duplicate-DTO rules over a scratch tree, the way the runner does: collect the main
 * sources, index them, check every file.
 *
 * @param files relative path to contents
 * @returns the `file:line excerpt` lines each rule reported
 */
function dtoTreeHits(files) {
  return withTree(files, (dir) => {
    const sources = collectSources(dir);
    const ctx = { dtoNames: dtoNameIndex(sources, dir) };
    const out = { error: [], review: [] };
    for (const [level, id] of [["error", "duplicate-dto-simple-name"], ["review", "duplicate-dto-simple-name-unreached"]]) {
      const rule = RULES.find((r) => r.id === id);
      for (const abs of sources) {
        const rel = path.relative(dir, abs);
        for (const h of rule.check(fs.readFileSync(abs, "utf8"), rel, ctx)) out[level].push(`${rel}:${h.line} ${h.excerpt}`);
      }
    }
    return out;
  });
}

function selftest() {
  let failed = selftestMechanisms();
  let passed = 0;
  let nearby = 0;
  let further = 0;
  console.log("");
  for (const rule of RULES) {
    const s = rule.samples;
    const problems = [];
    if (!s || typeof s.broken !== "string" || typeof s.fixed !== "string" || !s.file) {
      console.log(`✖ ${rule.id}: no broken/fixed samples - a rule with one direction proved is not proved`);
      failed++;
      continue;
    }
    if (!rule.appliesTo(s.file)) {
      problems.push(`appliesTo() rejects the sample path ${s.file} - the rule could never run on it`);
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
          problems.push(`fired on a near-neighbour that is not the defect: ${near.note}`);
        }
      }
      nearby += (s.miss ?? []).length;
      // The other shapes of the defect a rule claims. A rule widened to a second broken form is
      // proved on the first alone unless the second is written down here and asserted to fire.
      for (const extra of s.hit ?? []) {
        const hits = rule.check(extra.source, extra.file ?? s.file, extra.ctx ?? sampleCtx);
        if (!hits.length) problems.push(`did NOT fire on another broken form: ${extra.note}`);
      }
      further += (s.hit ?? []).length;
    }
    if (problems.length) {
      console.log(`✖ ${rule.id}\n    ${problems.join("\n    ")}`);
      failed++;
    } else {
      passed++;
      const misses = (rule.samples.miss ?? []).length;
      const extras = (rule.samples.hit ?? []).length;
      console.log(
        `✔ ${rule.id.padEnd(34)} fires on broken, silent on fixed`
          + (extras ? `  · fires on ${extras} further broken form(s)` : "")
          + (misses ? `  · silent on ${misses} near-neighbour(s)` : ""),
      );
    }
  }
  console.log(
    `\n${passed} rule(s) proved both ways, ${failed} not proved`
      + (further ? `, ${further} further broken form(s) caught` : "")
      + (nearby ? `, ${nearby} near-neighbour(s) left silent.` : "."),
  );
  return failed === 0 ? 0 : 1;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

// An unrecognised option stops the run rather than falling through to a scan. A misspelt
// `--selftest` that scanned instead printed "0 file(s) scanned - 0 error hit(s)", which is
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
// A scan that read nothing prints what a clean project prints, so it stops instead: the usual
// cause is a run from the directory above the backend.
if (files.length === 0) {
  console.error(`✖ no Java main source under ${ROOT}`);
  console.error(`  looked in src/main/java and in ${SRC_ROOTS.map((d) => `${d}/**/src/main/java`).join(", ")}`);
  console.error("  run from the backend project root, or pass --root=<dir>");
  process.exit(2);
}
const ctx = { entityIds: entityIdIndex(files), encrypted: encryptedFieldIndex(files), formulas: formulaEntityIndex(files), fields: fieldIndex(files), i18n: i18nIndex(files), overwrites: serviceOverwriteIndex(files), createMapping: createMappingIndex(files), emptyDefaults: emptyDefaultIndex(files), audit: auditSettings(), generatorInputs: generatorInputIndex(), bundles: entityBundleIndex(), moduleGroups: moduleGroupIndex(auditSettings()), gradleGroupFromPath: gradleGroupFromPath(), dtoNames: dtoNameIndex(files), defaultSorts: defaultSortIndex(files), listFigures: listFiguresIndex(files), storedPaths: storedPathIndex(files), jsonValueEnums: jsonValueEnumIndex(files) };
// The generator ymls are scanned too, after the Java indexes are built from the Java files alone.
const scanned = [...files, ...generatorInputFiles(), ...gradleSettingsFiles()];
const results = new Map();
let suppressedCount = 0;

for (const rule of RULES) {
  if (ruleFilter && !ruleFilter.includes(rule.id)) continue;
  const bucket = { rule, hits: [] };
  for (const abs of scanned) {
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
  console.log(`\n${mark} [${rule.level}] ${rule.id} (${rule.invariant}) - ${rule.desc}`);
  for (const h of hits) console.log(`  ${h.file}${h.line ? `:${h.line}` : ""}  ${h.excerpt}`);
  if (rule.level === "error") errorCount += hits.length;
  else reviewCount += hits.length;
}

console.log(
  `\n${files.length} Java source file(s) scanned, ${ctx.entityIds.size} entity id(s) indexed`
  + ` - ${errorCount} error hit(s), ${reviewCount} review candidate(s)`
  + `, ${suppressedCount} suppressed by an in-file marker.`,
);
if (suppressedCount) {
  console.log("A suppressed line carries its reason beside it - read those before trusting a clean run.");
}
if (reviewCount && !errorsOnly) {
  console.log("Review candidates need judgment against the invariant's stated exceptions - fix or justify, do not bulk-rewrite.");
}
process.exit(errorCount > 0 ? 1 : 0);
