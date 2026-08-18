// What a gate's two cases are written against.
//
// Every gate gets two: one board that must trip it, one that must not. A gate that has gone
// quiet is indistinguishable from a board with nothing wrong with it, which is the whole reason
// the gates exist — so the cases are the only thing standing between «the gate works» and
// «nobody has looked».
//
// **The cases live beside the gates they test**, in three files that mirror the three places a
// gate can come from:
//
//   core/check/cases.mjs                  the kit's own gates
//   patterns/<name>/gates/cases.mjs       that pattern's gates
//   <board>/board.gates.mjs → CASES       that board's gates
//
// A case file exports `cases(t)` and calls `t.add(...)`; `t` carries the builders below. Passing
// them in rather than importing them keeps a pattern or a board from reaching into the kit by
// path, which is the coupling this whole layout exists to remove.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { idOf } from '../ids.mjs';

/**
 * The settings every case is judged against.
 *
 * <p>**A gate's own test may not read the board's settings.** A case built on `config.today` or
 * on the site's language list passes on the board that happened to declare those values and
 * fails on every other — so `node wf.mjs gates` would answer a different question in each
 * repository, which is the opposite of what a self-test is for. The fixture states what the
 * cases need; a case that wants something else overrides it in its own `over`.
 */
export const FIXTURE_CONFIG = {
  today: '2026-08-12',
  site: { languages: ['한국어', 'English', 'Tiếng Việt', 'ភាសាខ្មែរ'], offLanguages: ['中文'] },
  phases: { 2: { tag: '2단계', why: '뒤에 만든다' } },
  features: {
    PACK_CONSTRUCTION: { tag: '건설 팩', why: '건설 규제' },
    CONNECTED: { tag: 'Connected', why: '연동' },
  },
  documents: {},
};

/**
 * The builders a case file composes its fixtures from.
 *
 * @param boardConfig the board's own settings. Handed through as `boardConfig` for the rare case
 *   that genuinely wants them; `config` is the fixture above, which is what `base()` uses
 */
export function makeBuilders(boardConfig = {}) {
  const config = FIXTURE_CONFIG;
  const docRoots = [];
  // The document gates read real files, so their fixtures are a real tree — a throwaway one
  // whose paths the ctx points at. Faking the reader instead would test the fake.
  const docCtx = (files, over = {}) => {
    const dir = mkdtempSync(join(tmpdir(), 'board-docs-'));
    docRoots.push(dir);
    for (const [rel, body] of Object.entries(files)) {
      const p = join(dir, rel);
      mkdirSync(join(p, '..'), { recursive: true });
      writeFileSync(p, body);
    }
    return { boardDir: dir, ...over };
  };

  const base = (over = {}) => ({
    boardDir: '/tmp', config, manifest: [{ letter: 'X', title: 't', screens: [] }],
    sections: [], screens: [], loaded: [], byId: new Map(),
    srcOf: () => '', componentsSrc: '', html: '', crud: null, roles: null, ...over,
  });

  const screen = (file, src, mod = {}) => ({ file, src, mod });

  const ctxWith = (files, over = {}) => {
    const map = new Map(files.map((f) => [f.file, f.src]));
    return base({
      screens: files.map((f) => ({ file: f.file, label: f.label ?? '화면' })),
      loaded: files.map((f) => ({
        num: idOf(f.file) ?? f.file,
        file: f.file, label: f.label ?? '화면', mod: f.mod,
      })),
      srcOf: (name) => map.get(name) ?? '',
      ...over,
    });
  };

  // Fixtures more than one case file needs. A fixture defined in whichever file happened to use
  // it first is a fixture the other file cannot see, and that is exactly how a case ends up
  // silently not running.
  const DOCS = { frameManifest: 'fm.md', appIa: 'ia.md', personas: 'p.md',
    statutoryForms: 'sf.md', pricing: 'pr.md', roadmap: 'rm.md', parity: 'pa.md', scan: ['.'] };
  const withDocs = (files, over = {}) => ({
    ...docCtx(files),
    config: { ...config, documents: DOCS },
    manifest: [{ letter: 'X', title: 't', screens: [{ file: 'x-01-a' }, { file: 'x-02-b' }] }],
    screens: [{ file: 'x-01-a' }, { file: 'x-02-b' }],
    srcOf: (n) => (over.src ?? {})[n] ?? '',
    ...over,
  });
  const PARITY_OK = '### X 구역 (2장)\n- X-01 `x-01-a` — 하나\n- X-02 `x-02-b` — 둘\n';
  const ROADMAP_OK = '- **화면 2장**\n  - (X) **X-01** 하나 / **X-02** 둘\n';
  const CHROME_SRC = "const MENU = {\n  X: { title: '구역', items: ['하나', '둘'] },\n};\n";
  const ROLES_SRC = "export const ROLES = { sys: '시스템 관리자', gate: '문지기' };\n";

  const cleanup = () => docRoots.forEach((d) => rmSync(d, { recursive: true, force: true }));
  return { config, boardConfig, base, screen, ctxWith, docCtx, withDocs, cleanup, DOCS, PARITY_OK, ROADMAP_OK, CHROME_SRC, ROLES_SRC };
}

/**
 * Run a list of cases against a list of gates.
 *
 * @returns the number of failures
 */
export async function runCases(cases, gates) {
  const byId = Object.fromEntries(gates.map((g) => [g.id, g]));
  let bad = 0;
  for (const { gate, name, ctx, shouldFire } of cases) {
    const g = byId[gate];
    if (!g) { console.log(`✖ ${gate} — 그런 게이트가 없다`); bad += 1; continue; }
    let msgs;
    try {
      msgs = (await g.run(ctx)) ?? [];
    } catch (e) {
      console.log(`✖ ${gate} / ${name} — 던졌다: ${e.message}`);
      bad += 1;
      continue;
    }
    const fired = msgs.length > 0;
    if (fired === shouldFire) {
      console.log(`✔ ${gate} / ${name}${fired ? ` → ${msgs[0].slice(0, 60)}` : ''}`);
    } else {
      console.log(`✖ ${gate} / ${name} — ${shouldFire ? '잡아야 하는데 조용하다' : `잡으면 안 되는데 걸렸다: ${msgs[0]}`}`);
      bad += 1;
    }
  }
  return bad;
}

/**
 * Which gates have no case at all.
 *
 * <p>The rule is that a new gate gets its two cases in the same change, and this is what makes
 * that rule visible rather than remembered. An untested gate is reported, not tolerated: it is
 * the state every gate decays into, and it looks exactly like a gate that works.
 */
export function untested(cases, gates) {
  const tested = new Set(cases.map((c) => c.gate));
  return gates.map((g) => g.id).filter((id) => !tested.has(id));
}
