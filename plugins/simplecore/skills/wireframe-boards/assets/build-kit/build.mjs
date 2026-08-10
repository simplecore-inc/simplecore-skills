// Build the wireframe board from data: read the manifest, import each screen's
// bespoke body, wrap it in shared chrome (nav/titlebar/statusbar), number it, and
// write one self-contained HTML — the artifact humans review.
//
//   node build.mjs            → writes _proof.html
//   node build.mjs --release  → writes board.html (the human-facing board)
//
// --release is refused while the manifest is empty, so a half-built board can never
// clobber the deliverable. For a stricter gate, list the sections you require below.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import manifest from './src/manifest.mjs';
import { frame, sidebar, page } from './src/partials.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(join(here, 'src/styles.css'), 'utf8');
const intro = existsSync(join(here, 'src/intro.html'))
  ? readFileSync(join(here, 'src/intro.html'), 'utf8')
  : '';

const sidebarSections = [];
const sectionBlocks = [];
const loaded = [];

// A screen has TWO numbers, and conflating them is what makes a board unusable to talk about.
//
//   - Its ID (A-20) is PERMANENT. It comes from the file name, is assigned once when the screen
//     is born, and never changes — not when a screen is inserted above it, not when the board is
//     reordered, not when a neighbour is deleted. It is what a person, a note, a parity list, and
//     an agent all address the screen by.
//   - Its SEQUENCE ([02]) is the frame's position in the board's visual order, recomputed on every
//     build. It exists so a reader scanning the board left to right can see where they are.
//
// The label prints both, as `[02]A-20`. Deriving the id from the file name leaves exactly one
// source for it, so the two can never disagree the way a position-derived number does.
const ID_FROM_FILE = /^([a-z])-(\d{2,}[a-z]?)-/;

const idOf = (file) => {
  const m = ID_FROM_FILE.exec(file);
  return m ? `${m[1].toUpperCase()}-${m[2]}` : null;
};

// Load every screen module up front: validating the numbering needs each frame's `variant`, and
// a narrow/wide pair is ONE screen sharing ONE id.
const sections = [];
for (const sec of manifest) {
  const entries = [];
  for (const sc of sec.screens) {
    const mod = (await import(`./src/screens/${sc.file}.mjs`)).default;
    entries.push({ ...sc, mod, id: idOf(sc.file) });
    loaded.push({ num: idOf(sc.file) ?? sc.file, file: sc.file, label: sc.label, mod });
  }
  sections.push({ ...sec, entries });
}

// A permanent id has to be present, belong to its section, and be shared by nothing except the
// two halves of one responsive screen. Each failure produces a board whose numbers cannot be
// trusted, so the build refuses rather than emitting one.
const idErrors = [];
const byId = new Map();
for (const sec of sections) {
  for (const e of sec.entries) {
    if (!e.id) {
      idErrors.push(`${e.file}: file name carries no permanent id — name it <letter>-<nn>-<slug>.mjs`);
      continue;
    }
    if (!e.id.startsWith(`${sec.letter}-`)) {
      idErrors.push(`${e.file}: id ${e.id} does not belong to section ${sec.letter}`);
    }
    if (!byId.has(e.id)) byId.set(e.id, []);
    byId.get(e.id).push(e);
  }
}
for (const [id, group] of byId) {
  if (group.length === 1) continue;
  const files = group.map((e) => e.file).join(', ');
  // Two files may share an id only as one screen's narrow and wide halves — the viewport toggle
  // shows one at a time, so they are one screen×state, not two.
  const variants = group.map((e) => e.mod.variant);
  const isPair =
    group.length === 2 && variants.includes('narrow') && variants.includes('wide');
  if (!isPair) {
    idErrors.push(
      `id ${id} is used by ${group.length} screens (${files}) — an id is shared only by the narrow and wide halves of one responsive screen`
    );
  }
}
if (idErrors.length) {
  console.error(`refusing to build:\n  ${idErrors.join('\n  ')}`);
  process.exit(1);
}

// Notes reference a screen by its FILE NAME — `{{d-04-contract-detail}}` — and the build resolves
// that to the screen's permanent id. An unknown slug is left visible as `{{slug?}}` rather than
// dropped, so a bad reference fails loudly instead of disappearing.
const resolveRefs = (text) => (text || '').replace(/\{\{([a-z0-9-]+)\}\}/g,
  (_, slug) => (idOf(slug) && byId.has(idOf(slug)) ? idOf(slug) : `{{${slug}?}}`));

for (const sec of sections) {
  const scList = [];
  const frames = [];
  // The sequence counts SCREENS, not frames: a responsive pair occupies one position because it
  // is one screen. Assigned by first appearance, so it always reads in board order.
  const seqOf = new Map();
  for (const e of sec.entries) {
    if (!seqOf.has(e.id)) seqOf.set(e.id, String(seqOf.size + 1).padStart(2, '0'));
  }
  const anchored = new Set();
  for (const e of sec.entries) {
    const seq = seqOf.get(e.id);
    // The anchor comes from the permanent id, so a link into the board survives a reorder. The
    // second half of a pair takes a suffix, because two elements cannot carry one id.
    const base = `s-${e.id.toLowerCase()}`;
    const anchor = anchored.has(base) ? `${base}-${e.mod.variant ?? 'b'}` : base;
    anchored.add(base);
    frames.push(frame({ ...e.mod, notes: resolveRefs(e.mod.notes) }, e.id, seq, e.file, anchor));
    // One sidebar entry per screen: a reader looking up T-01 wants the screen, not each half.
    if (anchor === base) scList.push({ id: e.id, seq, label: e.label, file: e.file, anchor });
  }
  sidebarSections.push({ letter: sec.letter, title: sec.title, screens: scList });
  const screenCount = seqOf.size;
  const frameCount = sec.entries.length;
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const caption =
    sec.count ||
    (screenCount === frameCount
      ? plural(frameCount, 'frame')
      : `${plural(screenCount, 'screen')} · ${plural(frameCount, 'frame')}`);
  sectionBlocks.push(
    `<section class="flow" id="flow-${sec.letter.toLowerCase()}">
  <div class="flow-title">${sec.letter}. ${sec.title} <span class="count">${caption}</span></div>
  <div class="row">
${frames.join('\n')}
  </div>
</section>`
  );
}

const html = page({
  title: 'Wireframe — product name',
  sidebarHtml: sidebar(sidebarSections),
  introHtml: intro,
  sectionsHtml: sectionBlocks.join('\n\n'),
  styles,
});

const release = process.argv.includes('--release');
// Coverage gate: refuse --release until the board is complete. The default check is
// "manifest is non-empty"; for a real product, replace REQUIRED with your section
// letters so a missing section is named rather than silently shipped.
const REQUIRED = []; // e.g. ['A', 'B', 'C']
const present = new Set(manifest.map((s) => s.letter));
const missing = REQUIRED.filter((l) => !present.has(l));
if (release && (manifest.length === 0 || missing.length)) {
  console.error(`refusing --release: ${manifest.length === 0 ? 'manifest is empty' : 'sections not present: ' + missing.join(', ')}. Build stays in _proof.html.`);
  process.exit(1);
}

// Content gate: a section can be present while a frame has quietly lost what it promises —
// a refactor or a bad merge leaves the label intact and the drawing gone, and a gate that
// counts sections passes it. The manifest label is the frame's contract, so a frame the
// label calls a dialog has to draw one. Checked against the screen module rather than the
// rendered HTML so a failure names the source file. Add your own label conventions here.
const DIALOG_LABEL = /dialog|다이얼로그/i;
const hollow = loaded.filter(
  (s) => DIALOG_LABEL.test(s.label) && !/class="(modal|sheet)\b/.test(s.mod.overlay ?? '')
);
if (hollow.length) {
  const named = hollow.map((s) => `${s.num} (${s.file})`).join(', ');
  console.error(
    release
      ? `refusing --release: labelled a dialog but draws none: ${named}. Build stays in _proof.html.`
      : `warning: labelled a dialog but draws none: ${named}`
  );
  if (release) process.exit(1);
}
// Structure gate: one unclosed tag inside a component silently swallows everything after it —
// a status bar lands inside a pane, a fixed height stops applying, panes nest inside each
// other. The frame still renders, still counts, and still reads as covered, so nothing but a
// person looking at the board catches it. That is precisely the failure a gate exists for.
// Checked per frame so the message names the screen; void elements never close, so they are
// skipped. This refuses every build, not just --release: a board with nested panes is not
// something to iterate on.
const VOID = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i;
const unbalanced = [];
for (const [, aid, frameHtml] of html.matchAll(/<article class="frame[^"]*" id="([^"]+)">([\s\S]*?)<\/article>/g)) {
  const stack = [];
  // The tail is captured so a self-closing tag can be recognised by its slash. SVG is drawn with
  // them (`<polyline …/>`, `<rect …/>`) and they close nothing, so counting them as opened tags
  // would refuse a perfectly balanced frame.
  for (const [, close, name, tail] of frameHtml.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*?)>/g)) {
    if (VOID.test(name)) continue;
    if (tail.trimEnd().endsWith('/')) continue;
    if (!close) { stack.push(name); continue; }
    if (stack[stack.length - 1] === name) stack.pop();
    else {
      unbalanced.push(`${aid}: </${name}> closes <${stack[stack.length - 1] ?? 'nothing'}>`);
      break;
    }
  }
  if (stack.length) unbalanced.push(`${aid}: ${stack.length} tag(s) left open — <${stack.join('>, <')}>`);
}
if (unbalanced.length) {
  console.error(`refusing to build — unbalanced markup:\n  ${unbalanced.join('\n  ')}`);
  process.exit(1);
}

// Empty-value gate: a missing argument does not throw in a template literal — it is coerced
// and printed. `undefined` lands in the frame as visible text, reads as a screen label, and
// survives every other gate here because the markup around it is perfectly well formed.
const LEAKED = /\bundefined\b|\[object Object\]|\bNaN\b/;
const leaked = [];
for (const [, aid, frameHtml] of html.matchAll(/<article class="frame[^"]*" id="([^"]+)">([\s\S]*?)<\/article>/g)) {
  const text = frameHtml.replace(/<[^>]*>/g, ' ');
  const hit = text.match(LEAKED);
  if (hit) leaked.push(`${aid}: "${hit[0]}" printed as screen text`);
}
if (leaked.length) {
  console.error(`refusing to build — a value leaked into the board:\n  ${leaked.join('\n  ')}`);
  process.exit(1);
}

const out = release ? 'board.html' : '_proof.html';
writeFileSync(join(here, out), html);
const total = manifest.reduce((n, s) => n + s.screens.length, 0);
console.log(`built ${total} screens across ${manifest.length} section(s) → ${out}`);
