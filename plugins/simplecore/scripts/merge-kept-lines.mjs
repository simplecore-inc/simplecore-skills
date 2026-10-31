#!/usr/bin/env node
/**
 * Report the lines one side of a merge added that the merged result no longer holds.
 *
 * A clean "Auto-merging" can still drop the other side's hunks, and nothing in git's output says
 * so. Run this right after a merge, before committing it or before building on it:
 *
 *   node merge-kept-lines.mjs [<other>] [<result>]
 *
 * `<other>` is the side merged in (default `MERGE_HEAD`, else `HEAD^2`); `<result>` is the tree
 * to check (default: the working tree). For every file the other side changed since the merge
 * base, each non-blank line it added must appear somewhere in the result's copy of that file.
 * A miss is either a line a resolution deliberately replaced, or a dropped hunk: read each one.
 * Exit 1 when anything is missing, 2 on a usage error.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
}

function resolve(ref) {
  try {
    return git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]).trim();
  } catch {
    return "";
  }
}

const [otherArg, resultArg] = process.argv.slice(2);
const other = otherArg ? resolve(otherArg) : resolve("MERGE_HEAD") || resolve("HEAD^2");
if (!other) {
  console.error("merge-kept-lines: no side to check; name it (a branch, or the merge's second parent)");
  process.exit(2);
}
// With no MERGE_HEAD the merge is committed and HEAD is the result, so its first parent is ours.
const ours = resolve("MERGE_HEAD") ? resolve("HEAD") : resolve("HEAD^1");
const base = git(["merge-base", ours, other]).trim();

function resultText(file) {
  if (resultArg) {
    try {
      return git(["show", `${resultArg}:${file}`]);
    } catch {
      return null;
    }
  }
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
}

const diff = git(["diff", "--no-color", "--unified=0", "--no-renames", base, other]);
let file = null;
let missing = 0;
let checked = 0;
const cache = new Map();
for (const line of diff.split("\n")) {
  if (line.startsWith("+++ ")) {
    file = line === "+++ /dev/null" ? null : line.slice(6);
    continue;
  }
  if (!file || !line.startsWith("+") || line.startsWith("+++")) continue;
  const added = line.slice(1).trim();
  if (added.length === 0) continue;
  if (!cache.has(file)) cache.set(file, resultText(file));
  const text = cache.get(file);
  checked += 1;
  if (text === null) {
    console.log(`✖ ${file}: file missing from the result`);
    missing += 1;
    cache.set(file, "");
    continue;
  }
  if (text !== "" && !text.includes(added)) {
    console.log(`✖ ${file}: ${added}`);
    missing += 1;
  }
}
console.log(`${checked} added lines checked, ${missing} missing from the result`);
process.exit(missing === 0 ? 0 : 1);
