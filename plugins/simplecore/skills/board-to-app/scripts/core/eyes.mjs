// A rule handed to human eyes, against one that says who takes the reading and when.
//
// A build states that every rule it holds is checked by a machine or marked as needing eyes, and
// that there is no third category. **A rule marked as needing eyes with no reader and no moment is
// that third category wearing the second category's label** — it reads as covered, it survives
// every audit of the two lists, and the reading it describes is taken by nobody, because a duty
// addressed to everyone is a duty whose turn never arrives.
//
// **The phrasings are the project's and the shape is the skill's.** What counts as saying 「no
// machine judges this」, who counts as a reader, and what counts as a moment are three lists a
// project declares in its own language; what this file fixes is that all three have to be
// satisfied, and that the reader and the moment have to appear in ONE statement.
import { proseLines } from './prose.mjs';

// ── A check handed to eyes, with nobody named and no moment ─────────────────
//
// This repository states that every rule is held by a script or marked as needing eyes, and
// that there is no third category. **A rule marked as needing eyes with no reader and no
// moment is that third category wearing the second category's label** — it reads as covered,
// it survives every audit of the two lists, and the reading it describes is taken by nobody,
// because a duty addressed to everyone is a duty whose turn never arrives.
//
// Two properties are what the columns are for, and both have already cost this repository a
// chapter closed over screens nobody looked at:
//
//   * **A reader who is not the party being checked.** The agent that took a capture knows
//     what the screen was supposed to hold, so it reads the picture for confirmation and
//     finds it. Where the rule checks an artifact, the reading belongs to somebody who did
//     not produce that artifact.
//   * **A moment the run cannot pass without.** 「닫힘으로 적기 전」 and 「보내기 전」 are
//     moments; 「정기적으로」 and 「검토할 때」 are not, and a reading with no moment happens
//     the first week and then never.
//
// **The window is the sentence's own paragraph and the block after it**, which is what makes
// the rule writable rather than merely true: say who and when in the same breath, either in
// the sentence or in the table or paragraph directly under it. A reader who has to hunt three
// screens away for the name has the same problem as one who finds no name at all.
//
// The three vocabularies below are the whole of the gate's judgment and are meant to be
// extended — a phrasing that assigns a check to eyes and is not in `ASSIGNS_TO_EYES` is not
// an exception to the rule, it is a row this list is missing.

/**
 * The three vocabularies, as this project declares them.
 *
 * <p><b>Literal phrases, matched case-insensitively inside a statement — not patterns.</b> A
 * project writes what its documents say, and a list of phrases is a thing a person adds a row to
 * without knowing a regex dialect. It also closed a hole: the pattern this replaced anchored one
 * Korean phrase with `\b`, and `\b` in JavaScript is ASCII-only, so that row matched nothing in
 * Korean prose for as long as it existed and reported the same zero either way.
 *
 * @returns the three lists, or null where the project has declared none
 */
function vocabularies(ctx) {
  const declared = ctx.declared('eyesPhrases');
  const ok = (list) => Array.isArray(list) && list.length && list.every((p) => typeof p === 'string' && p);
  if (!declared || !ok(declared.assigns) || !ok(declared.reader) || !ok(declared.moment)) return null;
  const lower = (list) => list.map((phrase) => phrase.toLowerCase());
  return { assigns: lower(declared.assigns), reader: lower(declared.reader), moment: lower(declared.moment) };
}

/** Whether one statement says any of what a vocabulary is a list of. */
const says = (list, text) => list.some((phrase) => text.toLowerCase().includes(phrase));

/** Which phrase made a block read as one that hands a check to eyes, for the finding to quote. */
const said = (list, text) => list.find((phrase) => text.toLowerCase().includes(phrase));

/**
 * One statement, as the unit both vocabularies have to be satisfied inside.
 *
 * **Window-wide matching is what a loose pattern walks through.** Asked only whether a reader
 * appears somewhere near a moment, this gate passed a paragraph that named the coordinator
 * with no moment at all, because the paragraph after it happened to contain 「before writing
 * one」 about something else — the comparison count stayed honest and the comparison stopped
 * meaning anything. Requiring both in one statement is also what the rule actually asks for:
 * say who and when in the same breath.
 *
 * A table row is a statement on its own, which is how the who/when table satisfies this.
 */
function statementsIn(lines) {
  const out = [];
  let wrapped = [];
  const flush = () => {
    if (wrapped.length === 0) return;
    out.push(...wrapped.join(' ').split(/(?<=[.。])\s+/));
    wrapped = [];
  };
  for (const line of lines) {
    if (/^\s*\|/.test(line)) {
      flush();
      out.push(line);
    } else {
      wrapped.push(line);
    }
  }
  flush();
  return out;
}

/**
 * A block is the run of non-blank prose lines between blank ones, carrying its first line
 * number. Fenced blocks and inline code are dropped first, because **the document that
 * teaches this rule is the one most likely to trip it** — a paragraph explaining that
 * `사람이 본다` needs a reader is not itself assigning anything, and a gate that reads its own
 * specimen as a violation trains everybody to ignore the gate. A specimen therefore goes in
 * backticks, which is where this repository's Korean standard already puts one.
 */
function blocks(text) {
  const out = [];
  let current = null;
  for (const { line, no } of proseLines(text)) {
    const prose = line.replace(/`[^`]*`/g, '');
    if (line.trim() === '') {
      current = null;
      continue;
    }
    if (!current) {
      current = { no, lines: [] };
      out.push(current);
    }
    current.lines.push(prose);
  }
  return out;
}

/** A block of nothing but headings signposts a rule; it never assigns one. */
const HEADING_ONLY = (block) => block.lines.every((line) => /^\s*#/.test(line));

export const eyesRuleNamesItsReader = {
  id: 'eyesRuleNamesItsReader',
  title: 'a check handed to eyes with nobody named to take the reading, or no moment to take it at',
  needs: ['eyesDocuments', 'eyesPhrases'],
  run: (ctx) => {
    const words = vocabularies(ctx);
    if (words === null) return [];
    const findings = [];
    for (const rel of ctx.declared('eyesDocuments')) {
      const text = ctx.read(rel);
      if (text === null) continue;

      const parts = blocks(text);
      parts.forEach((block, index) => {
        if (HEADING_ONLY(block)) return;
        const body = block.lines.filter((line) => !/^\s*#/.test(line)).join('\n');
        const assigning = said(words.assigns, body);
        if (!assigning) return;

        const window = [
          ...block.lines.filter((line) => !/^\s*#/.test(line)),
          ...(parts[index + 1] && !HEADING_ONLY(parts[index + 1]) ? parts[index + 1].lines : []),
        ];
        const statements = statementsIn(window);
        if (statements.some((s) => says(words.reader, s) && says(words.moment, s))) return;

        const reader = statements.some((s) => says(words.reader, s));
        const moment = statements.some((s) => says(words.moment, s));
        const missing = !reader && !moment
          ? 'who takes it and when they take it'
          : !reader
            ? 'who takes it'
            : !moment
              ? 'when they take it'
              : 'who takes it and when they take it in one statement, rather than in two';
        findings.push(
          `${rel}:${block.no}: this paragraph hands a check to eyes (${assigning}) and does not say `
          + `${missing}. A rule marked as needing eyes with nobody named is the third category `
          + 'wearing the second category\'s label — it reads as covered and the reading is taken by '
          + 'nobody. Name a reader who did not produce what is being read, and a moment the build '
          + 'cannot pass without (「닫힘으로 적기 전」, not 「검토할 때」), in one statement, in this '
          + 'paragraph or the one after it — a table row counts as a statement. The vocabularies '
          + 'are `eyesPhrases.reader` and `eyesPhrases.moment` in the config, and a phrasing they '
          + 'do not carry is a row they are missing rather than an exception to the rule'
        );
      });
    }
    return findings;
  },
};


export const EYES_GATES = [eyesRuleNamesItsReader];


/**
 * One project's three vocabularies, declared as a project declares them.
 *
 * <p>Korean and English rows side by side, because the documents these cases stand for are written
 * that way. Nothing in the gate knows either language.
 */
const PHRASES = {
  assigns: [
    '사람이 봐야', '사람이 본다', '사람이 보는', '사람이 읽', '사람이 판정', '사람에게 맡', '눈으로 판정',
    '어느 검사도 판정하지 못', '기계가 판정하지 못', '기계가 판정하지 않',
    'stay with eyes', 'stays with eyes', 'held by eyes', 'need eyes', 'needs eyes', 'not machine-visible',
  ],
  reader: [
    '조율자', '사용자', '읽는 쪽', '찍은 쪽', '보내는 쪽', '맡은 에이전트',
    'coordinator', 'the user', 'the builder', 'whoever',
  ],
  moment: [
    '기 전', '전에', '직전', '직후', '같은 시점', '같은 자리', '같은 변경', '때마다', '할 때',
    'before ', 'after ', 'in the same change', 'per dispatch', 'whenever ', 'at each', 'at the moment',
  ],
};

// ── A check handed to eyes, against one that says who and when ──────────────

/** The sentence as it read before this gate existed: three readings, nobody named. */
const EYES_UNNAMED = `# 검증 결과

## 검사가 판정하는 것과 사람이 보는 것

**사람이 봐야 하는 것은 셋이다.** 캡처의 화면이 그 프레임과 같은지, 「본 것」이 실제로 본
것인지, 그리고 문서가 검증보다 먼저 쓰이지 않았는지 — 이 셋은 어느 검사도 판정하지 못한다.
`;

/** The same three readings with a reader and a moment on each row. */
const EYES_NAMED = `# 검증 결과

## 검사가 판정하는 것과 사람이 보는 것

**사람이 봐야 하는 것은 셋이고, 누가 언제 보는지까지 정해 둔다.** 셋 다 어느 검사도 판정하지
못한다.

| 무엇을 | 누가 | 언제 |
| --- | --- | --- |
| 캡처의 화면이 그 프레임과 같은지 | 조율자 | 그 챕터를 「닫힘」으로 적기 전 |
| 「본 것」이 캡처에 있던 것인지 | 조율자 | 같은 시점에, 절마다 |
`;

/**
 * A reader and a moment that never meet. Both vocabularies are satisfied somewhere in the
 * window and no statement carries the pair, which is the shape a window-wide match walks
 * straight through — it is here because this gate did exactly that before it was narrowed.
 */
const EYES_SPLIT = `# 검증 결과

## 검사가 판정하는 것과 사람이 보는 것

**사람이 봐야 하는 것은 셋이다.** 조율자가 맡는다.

이 셋은 어느 검사도 판정하지 못한다. 챕터를 닫기 전에 무언가 남는 것이 있는지는 별개의 문제다.
`;

/** A paragraph explaining the rule, with its specimen in backticks where a specimen belongs. */
const EYES_SPECIMEN = `# 검증 결과

## 이름과 시점

**\`사람이 본다\`에 이름과 시점이 없으면 아무도 보지 않는다.** 모두의 일로 적힌 것은 아무의
차례도 오지 않는다.
`;

/** A heading that signposts the subject, with the assignment itself named and timed below it. */
const EYES_HEADING = `# 검증 결과

## 검사가 판정하는 것과 사람이 보는 것

**조율자가 캡처를 연다.** 그 챕터를 「닫힘」으로 적기 전에 한 장씩 읽는다.
`;

/** A document that hands nothing to eyes. */
const EYES_ABSENT = `# 검증 결과

## 파일 이름

챕터 파일과 같은 이름을 쓴다. 그 문서가 보여 주는 캡처는 같은 이름 폴더에 둔다.
`;

/** The instruction file the gate reads beside the evidence overview. */
const CLAUDE_UNNAMED = `# 프로젝트

**Three things stay with eyes** — whether the capture shows the frame it is named after,
whether the sentence is what was actually there, and whether the document was written out of
the verification.
`;

/** The same sentence with the reader and the moment in one statement. */
const CLAUDE_NAMED = `# 프로젝트

**Three things stay with eyes.** They are read by the coordinator before the chapter's row is
written 닫힘, never by the agent that took the captures.
`;

export function cases(t) {
  const project = (files) => t.project({
    config: { eyesDocuments: ['docs/evidence/00-overview.md', '.claude/CLAUDE.md'], eyesPhrases: PHRASES },
    files,
  });
  t.add(
    'eyesRuleNamesItsReader',
    'three readings handed to eyes with nobody named and no moment',
    project({ 'docs/evidence/00-overview.md': EYES_UNNAMED }),
    true
  );
  t.add(
    'eyesRuleNamesItsReader',
    'a reader and a moment that appear in the window but never in one statement',
    project({ 'docs/evidence/00-overview.md': EYES_SPLIT }),
    true
  );
  t.add(
    'eyesRuleNamesItsReader',
    'the same sentence in the instruction file, with nobody named',
    project({ '.claude/CLAUDE.md': CLAUDE_UNNAMED }),
    true
  );
  t.add(
    'eyesRuleNamesItsReader',
    'the three readings with a reader and a moment on every row of the table under them',
    project({ 'docs/evidence/00-overview.md': EYES_NAMED }),
    false
  );
  t.add(
    'eyesRuleNamesItsReader',
    'the instruction file naming the reader and the moment in one sentence',
    project({ '.claude/CLAUDE.md': CLAUDE_NAMED }),
    false
  );
  t.add(
    'eyesRuleNamesItsReader',
    'a paragraph teaching the rule, with its specimen in backticks rather than in 「」',
    project({ 'docs/evidence/00-overview.md': EYES_SPECIMEN }),
    false
  );
  t.add(
    'eyesRuleNamesItsReader',
    'a heading that signposts the subject, over a paragraph that names both',
    project({ 'docs/evidence/00-overview.md': EYES_HEADING }),
    false
  );
  t.add(
    'eyesRuleNamesItsReader',
    'a document that hands nothing to eyes',
    project({ 'docs/evidence/00-overview.md': EYES_ABSENT }),
    false
  );
}
