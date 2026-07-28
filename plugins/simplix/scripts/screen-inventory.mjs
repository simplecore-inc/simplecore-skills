#!/usr/bin/env node
/**
 * Screen inventory — scans modules/ and apps/ sources and classifies every
 * screen-bearing file into the shape taxonomy of the `simplix:frontend` skill's
 * customize/precedent-check.md (Step 1). Output: a markdown table per shape,
 * newest-modified first, so precedent selection (Step 2) starts from data
 * instead of ad-hoc greps.
 *
 * Run from the frontend project root, or point at it with --root=<dir>.
 *
 * Usage:
 *   node "${CLAUDE_PLUGIN_ROOT}/scripts/screen-inventory.mjs"                 # full inventory
 *   node "${CLAUDE_PLUGIN_ROOT}/scripts/screen-inventory.mjs" --shape=board   # one shape
 *   node "${CLAUDE_PLUGIN_ROOT}/scripts/screen-inventory.mjs" --module=<module>
 *
 * Classification is marker-based (framework composition signatures), never a
 * hand-maintained list — a new screen appears here as soon as it exists.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Project root: --root=<dir> wins, else the current working directory. The script
// ships inside a plugin, so it must never resolve the root from its own location.
const ROOT = path.resolve(
  process.argv.find((a) => a.startsWith("--root="))?.slice("--root=".length) ?? process.cwd(),
);
const EXCLUDE_DIRS = new Set(["node_modules", "dist", "generated", ".turbo", "build"]);

// Ordered by specificity — the FIRST matching shape wins.
const SHAPES = [
  { id: "board", label: "Always-open master-detail board", test: (c) => c.includes('activePanel="detail"') },
  { id: "tree", label: "Tree CRUD", test: (c) => c.includes("CrudTree") },
  { id: "map", label: "Map page", test: (c) => c.includes("MapProvider") },
  { id: "calendar", label: "Calendar board", test: (c) => /<Calendar(Shell|Provider)\b/.test(c) },
  { id: "editor", label: "Custom editor", test: (c) => c.includes("EditorFooter") },
  { id: "report", label: "Report / aggregation", test: (c) => c.includes("useFilterBarState") },
  { id: "tabbed-list", label: "Tabbed status list", test: (c) => c.includes("useCrudList") && /<Tabs\b|TabsContent/.test(c) },
  { id: "crud-list", label: "Standard CRUD list", test: (c) => c.includes("useCrudList") },
  { id: "list-detail", label: "List-detail composition (no CrudList)", test: (c) => c.includes("<ListDetail") },
  { id: "wizard", label: "Wizard / dialog flow", test: (c) => /[Ww]izard|useHistoryViewState/.test(c) && /step|Step/.test(c) },
];

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
    } else if (e.name.endsWith(".tsx")) {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

function gitDate(rel) {
  try {
    return execFileSync("git", ["log", "-1", "--format=%cs", "--", rel], { cwd: ROOT, encoding: "utf8" }).trim() || "-";
  } catch {
    return "-";
  }
}

const args = process.argv.slice(2);
const shapeFilter = args.find((a) => a.startsWith("--shape="))?.slice(8);
const moduleFilter = args.find((a) => a.startsWith("--module="))?.slice(9);

const files = [];
for (const base of ["modules", "apps"]) walk(path.join(ROOT, base), files);

const rows = [];
for (const abs of files) {
  const rel = path.relative(ROOT, abs);
  if (!rel.includes(`${path.sep}src${path.sep}`)) continue;
  if (moduleFilter && !rel.split(path.sep)[1]?.includes(moduleFilter)) continue;
  const content = fs.readFileSync(abs, "utf8");
  const shape = SHAPES.find((s) => s.test(content));
  if (!shape) continue;
  if (shapeFilter && shape.id !== shapeFilter) continue;
  rows.push({ shape: shape.id, label: shape.label, module: rel.split(path.sep)[1], rel });
}

for (const r of rows) r.date = gitDate(r.rel);

const byShape = new Map();
for (const r of rows) {
  if (!byShape.has(r.shape)) byShape.set(r.shape, []);
  byShape.get(r.shape).push(r);
}

console.log(`# Screen inventory — ${rows.length} screen file(s), shapes per customize/precedent-check.md\n`);
for (const s of SHAPES) {
  const group = byShape.get(s.id);
  if (!group) continue;
  group.sort((a, b) => (a.date < b.date ? 1 : -1));
  console.log(`## ${s.label} (${s.id}) — ${group.length}\n`);
  console.log(`| Last commit | Module | File |`);
  console.log(`| --- | --- | --- |`);
  for (const r of group) console.log(`| ${r.date} | ${r.module} | ${r.rel} |`);
  console.log("");
}
console.log(
  "Precedent selection (precedent-check.md Step 2): nearest same-module row + the newest same-shape row repo-wide.",
);
