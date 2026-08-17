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
function resetIndexes() { _entityIdIndex = null; }

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
    id: "unforced-searchcondition-overload",
    invariant: "#15③",
    level: "error",
    desc: "A service forces its scope in search(Map) but not in the search(SearchCondition) overload — the controller opens GET /search and POST /search over the same list, so posting the same query returns rows the GET refuses. The two are one door and are narrowed the same way",
    appliesTo: isService,
    check: (c) => {
      const clean = stripCommentsAndStrings(c);
      const FORCE = /\bforce\w*\(|ScopedSearchParams|requireVisible|forceVisible/;
      const found = {};
      const re = /public\s+Page<[\w<>,\s]+>\s+search\s*\(([\s\S]{0,200}?)\)\s*\{/g;
      let m;
      while ((m = re.exec(clean))) {
        const arg = m[1].replace(/\s+/g, " ");
        const kind = arg.includes("Map<") ? "map" : arg.includes("SearchCondition") ? "cond" : null;
        if (!kind) continue;
        found[kind] = {
          forced: FORCE.test(braceBody(clean, m.index + m[0].length - 1)),
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
      const onBroken = rule.check(s.broken, s.file, s.ctx);
      const onFixed = rule.check(s.fixed, s.file, s.ctx);
      if (!onBroken.length) problems.push("did NOT fire on the broken form");
      if (onFixed.length) problems.push(`fired on the fixed form (${onFixed.map((h) => h.excerpt).join("; ").slice(0, 120)})`);
    }
    if (problems.length) {
      console.log(`✖ ${rule.id}\n    ${problems.join("\n    ")}`);
      failed++;
    } else {
      passed++;
      console.log(`✔ ${rule.id.padEnd(34)} fires on broken, silent on fixed`);
    }
  }
  console.log(`\n${passed} rule(s) proved both ways, ${failed} not proved.`);
  return failed === 0 ? 0 : 1;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

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
const ctx = { entityIds: entityIdIndex(files) };
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
