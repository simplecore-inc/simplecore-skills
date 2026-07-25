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

for (const sec of manifest) {
  const scList = [];
  const frames = [];
  for (let i = 0; i < sec.screens.length; i++) {
    const sc = sec.screens[i];
    const mod = (await import(`./src/screens/${sc.file}.mjs`)).default;
    const num = `${sec.letter}-${String(i + 1).padStart(2, '0')}`;
    frames.push(frame(mod, num));
    scList.push({ num, label: sc.label, anchor: `s-${num.toLowerCase()}` });
    loaded.push({ num, file: sc.file, label: sc.label, mod });
  }
  sidebarSections.push({ letter: sec.letter, title: sec.title, screens: scList });
  const caption = sec.count || `${sec.screens.length} frames`;
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
const out = release ? 'board.html' : '_proof.html';
writeFileSync(join(here, out), html);
const total = manifest.reduce((n, s) => n + s.screens.length, 0);
console.log(`built ${total} screens across ${manifest.length} section(s) → ${out}`);
