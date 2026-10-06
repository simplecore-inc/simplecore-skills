// Gates that read the documents OUTSIDE the board folder. A design document decides what exists
// and a plan decides the order it is built in, so both drift the moment a frame is added and
// nobody back-fills. None of that drift can be seen from inside the board, and none of it makes a
// screen look wrong, which is why each of these refuses the build.
//
// **Only what is true of any board's documents lives here.** A gate that parses the prose of one
// project's document - its heading shapes, its tables, the words its plan uses for a phase - is
// that project's gate and belongs in its `board.gates.mjs`, reading the same `documents.<key>`.
// What stays here judges names the board itself declares (frame ids, roles, feature keys, file
// names) against whatever document the board names, in any format.
//
// Reading is by explicit path from `board.config.mjs`, never by glob: a glob that stops matching
// reports nothing, and nothing is indistinguishable from a pass.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

// A declared document may be one file or a directory of them - a plan that grew past one file is
// still one plan, and the gates that read it must not force it back into a single page.
const read = (ctx, key) => {
  const rel = ctx.config.documents?.[key];
  if (!rel) return null;
  const p = join(ctx.boardDir, rel);
  if (!existsSync(p)) return null;
  if (!statSync(p).isDirectory()) return { path: p, text: readFileSync(p, 'utf8') };
  const parts = readdirSync(p).filter((e) => e.endsWith('.md')).sort()
    .map((e) => readFileSync(join(p, e), 'utf8'));
  return { path: p, text: parts.join('\n\n') };
};

/** Every .md under the declared scan roots, so a link or an id anywhere is judged. */
const scanFiles = (ctx) => {
  const out = [];
  const walk = (d) => {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (e === 'node_modules' || e.startsWith('.')) continue;
      if (statSync(p).isDirectory()) walk(p);
      else if (e.endsWith('.md')) out.push(p);
    }
  };
  for (const r of ctx.config.documents?.scan ?? []) walk(join(ctx.boardDir, r));
  return out;
};

/** `a-07-dashboard` → `A-07`. The permanent id, which is what every document cites. */
const idOfFile = (f) => {
  const [l, n] = f.split('-');
  return `${l.toUpperCase()}-${n}`;
};

const boardIds = (ctx) => new Set(ctx.manifest.flatMap((s) => s.screens.map((e) => idOfFile(e.file))));

/**
 * The SCREEN ids behind those frames - a frame id with its state letter taken off.
 *
 * <p>A board may number its frames `B-01a` · `B-01b` · `B-01c`, in which case `B-01` is not a
 * frame but the screen those three are states of, and the documents name it constantly: an
 * inventory's section headings, a menu tree's screen column, a requirement citing the screen
 * rather than one of its states. Every one of those is a live reference to something the board
 * draws, so a gate that only knows frame ids refuses a build over the document being right.
 *
 * <p>On a board that numbers frames `A-07` with no suffix this set equals {@link boardIds}, so
 * nothing changes for it.
 */
const boardScreenIds = (ctx) => new Set([...boardIds(ctx)].map((id) => id.replace(/[a-z]$/, '')));

// The state letter is part of the id and has to be READ as part of it. Stopping at the digits
// turns every `B-01a` in a document into a citation of `B-01`, which on a suffixed board is not a
// frame - so the gate reports the document as wrong for writing the id correctly.
const FRAME_ID = /(?<![A-Za-z0-9-])([A-Z])-(\d{2,}[a-z]?)(?![0-9A-Za-z-])/g;

// ─────────────────────────────────────────────────────────────────────────────

// The parity list only ever shrinks: a walked frame is deleted from it, so a frame the board draws
// and the list does not name is a frame somebody walked, and nothing here can tell it from one
// nobody added. What the list must never do is name a frame the board does not draw - that is a
// walk aimed at nothing. The list's lines are its only count: a section heading carries none
// (`assets/parity-list.md` in `simplecore:board-parity-walk`), because every walk would have to
// edit it.
export const parityListGate = {
  id: 'parityListGate',
  title: 'the parity list names a frame the board does not draw',
  stage: 'built',
  run: (ctx) => {
    const doc = read(ctx, 'parity');
    if (!doc) return [];
    const ids = boardIds(ctx);
    const named = new Set([...doc.text.matchAll(FRAME_ID)].map((m) => `${m[1]}-${m[2]}`));
    const extra = [...named].filter((i) => !ids.has(i)).sort();
    return extra.length ? [`only in the list, not drawn on the board: ${extra.join(' ')}`] : [];
  },
};

// A document naming a frame that does not exist sends somebody looking for a screen. Ids are
// permanent and a deletion leaves a gap that is never reused, so a stale name never comes back.
export const docFrameRefGate = {
  id: 'docFrameRefGate',
  title: 'a document cites a frame the board does not draw',
  stage: 'built',
  run: (ctx) => {
    const ids = boardIds(ctx);
    const screens = boardScreenIds(ctx);
    const bad = [];
    // Some shapes read like a frame id and are not - a guide number, a visa class, a clause of
    // some other standard. The board names each one in `documents.notFrames`: they are followed
    // or preceded by their own context, and a pattern loose enough to exclude them would also
    // excuse a real defect.
    const NOT_A_FRAME = new Set(ctx.config.documents?.notFrames ?? []);
    // A WHOLE document may number things in a scheme that collides with this one - an entity model
    // whose tables are `B-02 <Entity>` · `E-08 <Entity>`. Listing its ids one by one is a list that
    // grows with the model and goes stale silently, so the board names the file instead:
    // everything in it belongs to the other scheme, and every OTHER document gate still reads it.
    const otherScheme = ctx.config.documents?.otherIdScheme ?? [];
    for (const f of scanFiles(ctx)) {
      if (otherScheme.some((p) => f.endsWith(p))) continue;
      const miss = new Set();
      for (const m of readFileSync(f, 'utf8').matchAll(FRAME_ID)) {
        const id = `${m[1]}-${m[2]}`;
        // A citation with no state letter names the SCREEN, and a screen the board draws states
        // of is a live reference. One that carries a letter has to be that exact frame.
        const known = ids.has(id) || (!/[a-z]$/.test(id) && screens.has(id));
        if (!known && !NOT_A_FRAME.has(id)) miss.add(id);
      }
      // The fix travels with the finding. A document asserting that an id is ABSENT trips this
      // gate identically to one citing it - the scan reads the id and cannot read the polarity of
      // the sentence around it - and the person who meets the refusal has no way to know that from
      // the message alone. Saying it here beats a rule in a file they have to already know about.
      if (miss.size) {
        bad.push(`${f.split('/').slice(-2).join('/')}: ${[...miss].sort().join(' ')} - a sentence about a missing number names the ids on either side instead; an id of another numbering scheme goes in documents.notFrames`);
      }
    }
    return bad;
  },
};

// A link to a file that moved is dead in the reader's hand and silent in every check that does not
// resolve it.
export const docLinkGate = {
  id: 'docLinkGate',
  title: 'a document link points at a file that does not exist',
  stage: 'built',
  run: (ctx) => {
    const bad = [];
    for (const f of scanFiles(ctx)) {
      for (const m of readFileSync(f, 'utf8').matchAll(/\]\(([^)\s#]+\.md)(?:#[^)]*)?\)/g)) {
        if (m[1].startsWith('http')) continue;
        if (!existsSync(resolve(dirname(f), m[1]))) {
          bad.push(`${f.split('/').slice(-2).join('/')} → ${m[1]}`);
        }
      }
    }
    return bad;
  },
};

// A document nobody registered is a document nobody maintains. The registry names every
// non-code document and what it is for, so the gate's whole job is to keep the two sides equal:
// a file that reached the tree without a row, and a row whose file is gone.
export const docRegistryGate = {
  id: 'docRegistryGate',
  title: 'the document registry and the documents disagree',
  stage: 'built',
  run: (ctx) => {
    const doc = read(ctx, 'registry');
    if (!doc) return [];                       // a board that declares no registry is not held to one
    const bad = [];
    const root = ctx.boardDir;
    const rel = (p) => p.replace(`${root}/`, '').replace(/^(\.\.\/)+/, '');
    // Every scanned document needs a row. The registry names files by path, in a link or in code.
    for (const f of scanFiles(ctx)) {
      const name = f.split('/').pop();
      if (name === doc.path.split('/').pop()) continue;
      if (!doc.text.includes(name)) bad.push(`not in the registry: ${rel(f)}`);
    }
    // And every path the registry names has to exist, or the table is describing a repository
    // that is no longer there.
    // A registry may name a file the scan roots do not cover (an instruction file beside the
    // board) and may hold a placeholder for documents not written yet. Neither is a dead row:
    // judge by whether the path resolves, and skip anything carrying a glob.
    const seen = new Set(scanFiles(ctx).map((f) => f.split('/').pop()));
    for (const m of doc.text.matchAll(/`([^`\s]+\.md)`|\]\(([^)\s]+\.md)\)/g)) {
      const path = m[1] ?? m[2];
      if (/[*{}]/.test(path)) continue;
      if (seen.has(path.split('/').pop())) continue;
      // A registry names paths as the repository sees them, and the board sits somewhere inside
      // that repository - so every ancestor of the board is a candidate base.
      const bases = [join(doc.path, '..'), root];
      for (let d = root; d !== dirname(d); d = dirname(d)) bases.push(d);
      if (bases.some((base) => existsSync(join(base, path)))) continue;
      bad.push(`the registry names a document that does not exist: ${path}`);
    }
    return [...new Set(bad)];
  },
};

// The visibility matrix is what says who reaches what. A role the board knows and the document
// does not is a role nobody signed off on.
export const roleDocGate = {
  id: 'roleDocGate',
  title: 'a board role is missing from the personas document',
  stage: 'built',
  run: async (ctx) => {
    const doc = read(ctx, 'personas');
    if (!doc) return [];
    const { ROLES } = await import(`${ctx.boardDir}/src/roles.mjs`);
    return Object.values(ROLES).filter((r) => !doc.text.includes(r))
      .map((r) => `「${r}」 - in src/roles.mjs, not in the personas document`);
  },
};

// A feature key is what a customer buys. One the board gates a screen on and the price list does
// not name cannot be sold, so the screen can never open.
export const featureKeyDocGate = {
  id: 'featureKeyDocGate',
  title: 'a feature key is missing from the pricing document',
  stage: 'built',
  run: (ctx) => {
    const doc = read(ctx, 'pricing');
    if (!doc) return [];
    return Object.keys(ctx.config.features ?? {}).filter((k) => !doc.text.includes(k))
      .map((k) => `${k} - board.config.mjs gates a frame on it and the pricing document does not name it`);
  },
};
