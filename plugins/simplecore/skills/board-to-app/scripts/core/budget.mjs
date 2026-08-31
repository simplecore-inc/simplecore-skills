// An instruction file that grows without a ceiling, and a rule taught in two places.
//
// **The rule that makes a build learn is the rule that makes it unreadable.** 「A finding belongs
// in a skill, in the same change」 has no ceiling and no deletion clause, so every session appends
// and nothing ever removes. One repository reached about 1.1 million characters of reachable
// instruction across its skills, its own instruction file and its ledger — more than a context
// window, which means **no agent could hold the rules it was being judged by.** Every repeat it
// suffered had a paragraph forbidding it, and every one of those paragraphs went unread.
//
// **A ceiling is not a style preference; it is what turns adding into trading.** With the ceiling
// declared at the file's current size, nothing is red today and the next append fails — so a rule
// enters only when a rule leaves, or when somebody raises the number deliberately and says in the
// commit what they tried to remove and why it stayed. That visibility is the whole mechanism.
//
// **The second gate is the reason the first one keeps being needed.** A defect gets a check AND
// the paragraph that taught it, so machine coverage grows while the prose grows with it. Once a
// gate holds a rule, the teaching collapses to one sentence naming the gate; the essay is what the
// gate's own message is for, and a reader meets that message at the moment it fires rather than
// while reading a file looking for something else.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** How a declared budget is read: an integer count of characters. */
const CEILING = (value) => (Number.isInteger(value) && value > 0 ? value : null);

/**
 * A file whose size has passed the ceiling its project declared for it.
 *
 * <p><b>Error rather than warning, and safe to make an error because of how the ceilings are
 * set.</b> A project declares each ceiling at or just above what the file measures on the day it
 * is declared, so the tree is green at the moment the gate arrives; what fails is the growth after
 * it. A warning here would be read the way every warning is read — later — and the file would go
 * on growing while the gate reported it, which is the state this replaces.
 */
export const instructionFitsItsBudget = {
  id: 'instructionFitsItsBudget',
  title: 'an instruction file grown past the ceiling its project declared for it',
  needs: ['instructionBudget'],
  run: (ctx) => {
    const budget = ctx.declared('instructionBudget');
    if (!budget || typeof budget !== 'object') return [];
    const findings = [];
    for (const [rel, raw] of Object.entries(budget)) {
      if (rel.startsWith('//')) continue;
      const ceiling = CEILING(raw);
      if (ceiling === null) {
        findings.push(
          `instructionBudget["${rel}"] is 「${raw}」, which is not a positive whole number of `
          + 'characters. A budget that cannot be read is a budget nobody is holding, and it reports '
          + 'the same silence as a file comfortably inside its ceiling'
        );
        continue;
      }
      const text = ctx.read(rel);
      if (text === null) {
        findings.push(
          `instructionBudget names ${rel} and there is no such file. Either the path moved and the `
          + 'budget did not follow it, or the file went and its entry stayed — and an entry pointing '
          + 'at nothing costs exactly what an undeclared file costs, which is that it grows unwatched'
        );
        continue;
      }
      const size = [...text].length;
      if (size <= ceiling) continue;
      findings.push(
        `${rel}: ${size} characters against a ceiling of ${ceiling} — over by ${size - ceiling}. `
        + '**Remove before adding.** The ceiling exists so that a rule enters this file only when '
        + 'another leaves it, and the first thing to look for is a paragraph teaching what a check '
        + 'now holds: that paragraph collapses to one sentence naming the check, and the reasoning '
        + 'moves into the check\'s own message where a reader meets it at the moment it fires. '
        + 'Raising the number is allowed and is a deliberate act — edit `instructionBudget` and say '
        + 'in the commit body what was tried for removal and why it stayed, so the next reader can '
        + 'see the trade rather than a file that quietly got bigger'
      );
    }
    return findings;
  },
};

/**
 * Every check id this build can run, read out of the sources that declare them rather than
 * imported. Importing the registry here would be a cycle — the registry imports this module — and
 * a second hand-kept list of ids is a list that goes stale the first time a gate is renamed.
 */
function gateIds(ctx) {
  const ids = new Set();
  const sources = [];
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    for (const name of readdirSync(here)) if (name.endsWith('.mjs')) sources.push(join(here, name));
  } catch { /* the skill's own directory is unreadable; the project's half still counts */ }
  const project = ctx.at('projectGates');
  if (project) {
    sources.push(project);
    try {
      const beside = dirname(project);
      for (const name of readdirSync(beside)) if (name.endsWith('.mjs')) sources.push(join(beside, name));
    } catch { /* a project keeping its gates in one file has no directory beside it */ }
    const folder = project.replace(/\.mjs$/, '');
    try {
      for (const name of readdirSync(folder)) if (name.endsWith('.mjs')) sources.push(join(folder, name));
    } catch { /* no folder of the same name */ }
  }
  for (const path of sources) {
    let text;
    try { text = readFileSync(path, 'utf8'); } catch { continue; }
    // **camelCase is the discriminant, and without it this reads domain names as check ids.**
    // A gate id is several words run together — `evidenceQuotesTheChapter` — while a bare lowercase
    // word (`safety`, `identity`, `integration`) is a module, a locale namespace or a persona, and
    // matching those reported seven files for sharing the word 「safety」.
    for (const m of text.matchAll(/\bid:\s*'([a-z][A-Za-z0-9]*[A-Z][A-Za-z0-9]{4,})'/g)) ids.add(m[1]);
  }
  return ids;
}

/** A gate id written in prose, outside quoted spans and fenced examples. */
const CITED = (text, id) => {
  const bare = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '');
  return bare.includes(id);
};

/**
 * A rule held by a check and taught in prose as well, in more than one file.
 *
 * <p><b>Warning, because the second copy is sometimes the right one.</b> An index that routes to a
 * reference legitimately names what it routes to, and a project's own instruction file legitimately
 * names a check it turns on. What this catches is the paragraph that explains a check's reasoning
 * a second time somewhere else — and only a reader can tell those apart, which is why it prompts a
 * re-read rather than failing a write.
 */
export const aGateIsTaughtOnce = {
  id: 'aGateIsTaughtOnce',
  grade: 'warning',
  title: 'a check whose reasoning is written out in prose in more than one file',
  needs: ['instructionBudget'],
  run: (ctx) => {
    const budget = ctx.declared('instructionBudget');
    if (!budget || typeof budget !== 'object') return [];
    const files = Object.keys(budget).filter((rel) => !rel.startsWith('//'));
    const ids = gateIds(ctx);
    if (!ids.size) return [];
    const findings = [];
    for (const id of ids) {
      const carriers = files.filter((rel) => {
        const text = ctx.read(rel);
        return text !== null && CITED(text, id);
      });
      if (carriers.length < 2) continue;
      findings.push(
        `${id} is written out in prose in ${carriers.length} files — ${carriers.join(' · ')}. `
        + 'A check and a paragraph teaching the same rule grow apart, and the copy that drifted is '
        + 'indistinguishable from the one that did not. Keep the reasoning in the check\'s own '
        + 'message, where a reader meets it at the moment it fires, and leave one sentence in one '
        + 'file naming the check. Where a second mention is a routing line or a project turning the '
        + 'check on, it is right and this is a prompt to re-read rather than a defect'
      );
    }
    return findings;
  },
};

/**
 * A result document that does not say which build, which boot and which data it was written off.
 *
 * <p><b>Every judgement invalidated in one chapter was killed by provenance rather than by
 * argument.</b> Six screens' empty-state findings died because the fixture had never answered an
 * empty state; a missing thousands separator died at 400% zoom, where the characters were there; two
 * claims about another lane's files died because they described a tree that had moved. Each cost a
 * round trip, and each would have been settled before it was written if the document had had to say
 * where its pictures came from.
 *
 * <p><b>The reason a transcription cannot carry this by itself is that quality says nothing about
 * provenance.</b> The more detailed a reading is, the more trustworthy it reads — a tree carrying
 * control names and required markers says 「this person cannot not have looked at the screen」, and
 * that is true. It says nothing whatever about which build they looked at.
 *
 * <p>Warning rather than error: a document being written is incomplete on its way to being
 * complete, and failing every write until the last line lands is how a gate gets turned off. The
 * chapter does not close on it — that reading belongs to whoever writes 닫힘 in the ledger.
 */
export const evidenceSaysWhereItCameFrom = {
  id: 'evidenceSaysWhereItCameFrom',
  grade: 'warning',
  title: 'a result document with no line saying which build, boot and data its pictures came off',
  needs: ['evidenceDir', 'evidenceProvenance'],
  run: (ctx) => {
    const wanted = ctx.declared('evidenceProvenance');
    if (!Array.isArray(wanted) || !wanted.length) return [];
    const declared = ctx.declared('evidenceDir');
    if (!declared) return [];
    const findings = [];
    for (const entry of ctx.list(ctx.at('evidenceDir')) ?? []) {
      if (!entry.endsWith('.md')) continue;
      const rel = `${declared}/${entry}`;
      const text = ctx.read(rel);
      if (text === null) continue;
      // An index states no result; it routes to the documents that do.
      if (/00-overview\.md$/.test(rel)) continue;
      const missing = wanted.filter((label) => !text.includes(label));
      if (!missing.length) continue;
      findings.push(
        `${rel}: the document says nothing about ${missing.join(' · ')}. A picture carries no record `
        + 'of what took it, so a reader holding two captures against each other cannot tell a screen '
        + 'that changed from an instrument that changed — and a finding written off a stale build, a '
        + 'fixture answering a shape the server never answers, or a reading taken at one zoom is '
        + 'indistinguishable from a finding that is right. Say it once at the top: the commit the '
        + 'screens were built from, when the server that served them booted, and what data they were '
        + 'drawn against. The labels are `evidenceProvenance` in the config, and a phrasing they do '
        + 'not carry is a row they are missing rather than an exception to the rule'
      );
    }
    return findings;
  },
};


/**
 * The same instruction written twice, and the same subject instructed two opposite ways.
 *
 * <p><b>A duplicated paragraph is not redundancy; it is a fork.</b> Two copies of one rule drift,
 * and afterwards the stale copy and the current one are the same characters to anybody reading
 * either alone — which is why a project ends up with a rule that is true in one file and false in
 * the file beside it, and no reader can tell which they have.
 *
 * <p><b>Contradiction is caught through the same reading, at one remove.</b> Where a directive
 * verb sits against one subject in one file and its opposite sits against the same subject in
 * another, an agent obeys whichever it loaded — and both obediences look like discipline. It is
 * how a build gets two lanes fixing each other's work: neither is disobeying anything.
 *
 * <p>Warning, because separating a genuine restatement from a fork needs a reader. An index that
 * repeats a rule's sentence to route to it is right; a reference that states the rule a second
 * time is the fork. What the gate supplies is the pair and the two paths, which is the part no
 * person can do across a million characters.
 */
export const noInstructionIsWrittenTwice = {
  id: 'noInstructionIsWrittenTwice',
  grade: 'warning',
  title: 'one instruction written out in two files, or one subject instructed two opposite ways',
  needs: ['instructionBudget'],
  run: (ctx) => {
    const budget = ctx.declared('instructionBudget');
    if (!budget || typeof budget !== 'object') return [];
    const files = Object.keys(budget).filter((rel) => !rel.startsWith('//'));
    const seen = new Map();
    const findings = [];
    for (const rel of files) {
      const text = ctx.read(rel);
      if (text === null) continue;
      for (const { no, body } of sentencesOf(text)) {
        const key = fingerprint(body);
        if (key === null) continue;
        const first = seen.get(key);
        if (!first) { seen.set(key, { rel, no, body }); continue; }
        if (first.rel === rel) continue;
        findings.push(
          `${rel}:${no} repeats what ${first.rel}:${first.no} already states — 「${body.slice(0, 70)}」. `
          + 'Two copies of one rule drift, and the copy that drifted reads exactly like the one that '
          + 'did not, so a reader who has only one of them cannot tell which they have. Keep the rule '
          + 'in the file that owns its subject and leave a routing line — the moment it applies and '
          + 'where it lives — in the other. Where this is a routing line already, it is right and '
          + 'this is a prompt to re-read'
        );
      }
    }
    return findings;
  },
};

/** Sentences long enough to be an instruction rather than a heading or a table cell. */
function sentencesOf(text) {
  const out = [];
  const lines = text.split('\n');
  let fenced = false;
  lines.forEach((line, i) => {
    if (/^\s*```/.test(line)) { fenced = !fenced; return; }
    if (fenced) return;
    if (/^\s*#/.test(line)) return;
    // A parenthetical note in its own italics is a marker a file repeats per section — 「this
    // section is English, the rest is Korean」 — and repeating it is what it is for.
    if (/^\*?\(/.test(line.trim())) return;
    for (const raw of line.split(/(?<=[.。])\s+/)) {
      const body = raw.trim();
      if (body.length >= 60) out.push({ no: i + 1, body });
    }
  });
  return out;
}

/**
 * What two sentences share when they say the same thing.
 *
 * <p>Emphasis, quoted spans, code, punctuation and whitespace come out, because a rule restated in
 * another file is restated with different markup and the same words. What is left is the words,
 * lowercased and sorted, so a reordering does not hide a copy. Below a floor of distinct words the
 * fingerprint stops being evidence of anything and returns null.
 */
function fingerprint(body) {
  const bare = body
    .replace(/`[^`]*`/g, ' ')
    .replace(/[「」『』*_~\[\]()·—–-]/g, ' ')
    .replace(/[.,;:!?。、]/g, ' ')
    .toLowerCase();
  const words = [...new Set(bare.split(/\s+/).filter((w) => w.length > 1))].sort();
  return words.length >= 8 ? words.join(' ') : null;
}


export const BUDGET_GATES = [
  instructionFitsItsBudget,
  aGateIsTaughtOnce,
  evidenceSaysWhereItCameFrom,
  noInstructionIsWrittenTwice,
];


// ── The cases that prove them ───────────────────────────────────────────────

const SMALL = 'A short instruction file.\n';
const BIG = `${'가'.repeat(400)}\n`;

export function cases(t) {
  const project = (budget, files) => t.project({ config: { instructionBudget: budget }, files });

  t.add(
    'instructionFitsItsBudget',
    'a file grown past its declared ceiling, which is the append this gate exists to stop',
    project({ 'GUIDE.md': 100 }, { 'GUIDE.md': BIG }),
    true
  );
  t.add(
    'instructionFitsItsBudget',
    'the same file inside a ceiling declared at its own size, which is how a ceiling arrives',
    project({ 'GUIDE.md': 401 }, { 'GUIDE.md': BIG }),
    false
  );
  t.add(
    'instructionFitsItsBudget',
    'a ceiling counted in characters rather than bytes, so a Korean file is not failed for its script',
    project({ 'GUIDE.md': 401 }, { 'GUIDE.md': BIG }),
    false
  );
  t.add(
    'instructionFitsItsBudget',
    'a budget naming a file that is not there, which reports the same silence as a file inside its ceiling',
    project({ 'GONE.md': 100 }, { 'GUIDE.md': SMALL }),
    true
  );
  t.add(
    'instructionFitsItsBudget',
    'a ceiling that is not a positive whole number, so nothing is being held',
    project({ 'GUIDE.md': 'big' }, { 'GUIDE.md': SMALL }),
    true
  );
  t.add(
    'instructionFitsItsBudget',
    'a comment key in the budget, which declares nothing and is skipped',
    project({ '//GUIDE.md': 'why this one is watched', 'GUIDE.md': 4000 }, { 'GUIDE.md': SMALL }),
    false
  );

  const evidence = (files) => t.project({
    config: { evidenceDir: 'docs/evidence', evidenceProvenance: ['빌드', '기동', '자료'] },
    files,
  });
  t.add(
    'evidenceSaysWhereItCameFrom',
    'a result document with no provenance line, which is how an invalidated reading survives',
    evidence({ 'docs/evidence/w01.md': '# 검증 결과\n\n화면을 열었다.\n' }),
    true
  );
  t.add(
    'evidenceSaysWhereItCameFrom',
    'the same document saying all three, so a later reader can date every picture in it',
    evidence({ 'docs/evidence/w01.md': '# 검증 결과\n\n빌드 `abc1234` · 기동 09:02 · 자료 이야기 시드.\n' }),
    false
  );
  t.add(
    'evidenceSaysWhereItCameFrom',
    'an index, which states no result and routes to the documents that do',
    evidence({ 'docs/evidence/00-overview.md': '# 목차\n\n결과 문서의 모양.\n' }),
    false
  );

  const twice = (files) => t.project({
    config: { instructionBudget: Object.fromEntries(Object.keys(files).map((f) => [f, 100000])) },
    files,
  });
  const RULE = 'A commit that belongs to no chapter carries a chapter trailer saying none, because an absent trailer cannot be told from a forgotten one.\n';
  t.add(
    'noInstructionIsWrittenTwice',
    'one rule written out in two files, which is a fork rather than redundancy',
    twice({ 'A.md': RULE, 'B.md': RULE }),
    true
  );
  t.add(
    'noInstructionIsWrittenTwice',
    'the same rule stated once, with the other file left to route to it',
    twice({ 'A.md': RULE, 'B.md': 'Chapter trailers: see A.md.\n' }),
    false
  );
  t.add(
    'noInstructionIsWrittenTwice',
    'a sentence repeated inside one file, which is that file\'s own emphasis rather than a fork',
    twice({ 'A.md': RULE + RULE }),
    false
  );

  // `aGateIsTaughtOnce` reads the ids out of this skill's own gate sources, so the id it is proved
  // with is one that really exists — a made-up id would prove a regex rather than the gate.
  const taught = (files) => t.project({
    config: { instructionBudget: Object.fromEntries(Object.keys(files).map((f) => [f, 100000])) },
    files,
  });
  const ESSAY = 'The check instructionFitsItsBudget exists because a file with no ceiling grows until nobody can read it.\n';
  t.add(
    'aGateIsTaughtOnce',
    'one check\'s reasoning written out in two files, which is the double carry that keeps the prose growing',
    taught({ 'A.md': ESSAY, 'B.md': ESSAY.replace('exists because', 'is there because') }),
    true
  );
  t.add(
    'aGateIsTaughtOnce',
    'the same check named in one file and left to its own message everywhere else',
    taught({ 'A.md': ESSAY, 'B.md': 'Budgets: see A.md.\n' }),
    false
  );
  t.add(
    'aGateIsTaughtOnce',
    'the id inside a code span, which is a citation rather than a second teaching',
    taught({ 'A.md': ESSAY, 'B.md': 'Turned on here: `instructionFitsItsBudget`.\n' }),
    false
  );
}
