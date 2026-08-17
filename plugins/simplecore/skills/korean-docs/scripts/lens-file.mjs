#!/usr/bin/env node
// The reading lens, pointed at one file instead of at the declared resources.
//
// `l10n.mjs suspects` scans what `.claude/l10n.json` declares, which is the right default and
// leaves one surface uncovered: a draft that is not a project file yet. A chat reply is written,
// read by nobody, and sent — and the habits the lens exists to catch survive there long after the
// repository is clean, because every mechanical check runs over files.
//
// So: write the draft to a scratch file and run this over it before it goes out.
//
//   node lens-file.mjs <file>
//
// It reports and judges nothing. Each hit is a word the lens has learned to suspect; whether it is
// wrong depends on the sentence, and `references/reading-lens.md` says what each family is about.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const target = process.argv[2];
if (!target) {
  console.error('용법: node lens-file.mjs <파일>');
  process.exit(2);
}

const pattern = fs.readFileSync(path.join(here, '..', 'references', 'lens.txt'), 'utf8').trim();
const lens = new RegExp(pattern, 'gu');
const lines = fs.readFileSync(target, 'utf8').split('\n');

let total = 0;
lines.forEach((line, i) => {
  const hits = [...new Set([...line.matchAll(lens)].map((m) => m[0]))];
  if (!hits.length) return;
  total += hits.length;
  console.log(`${String(i + 1).padStart(4)}: ${hits.join(' · ')}`);
  console.log(`      ${line.trim().slice(0, 100)}`);
});

console.log(total ? `\n${total}건 — 판정이 아니라 신호다. 문장마다 판단한다.` : '깨끗함');
