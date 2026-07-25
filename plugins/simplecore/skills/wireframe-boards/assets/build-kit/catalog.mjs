// Build the component catalog (storybook): render every entry in CATALOG with its
// name, live example, and note, grouped by category. This is the reference an author
// consults BEFORE writing a screen — the kit they compose from. Adding a component in
// components.mjs (and registering it in CATALOG) makes it show up here automatically.
//
//   node catalog.mjs   → writes _catalog.html
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CATALOG } from './src/components.mjs';
import { page } from './src/partials.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(join(here, 'src/styles.css'), 'utf8');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const cats = [];
const byCat = {};
for (const c of CATALOG) { if (!byCat[c.cat]) { byCat[c.cat] = []; cats.push(c.cat); } byCat[c.cat].push(c); }

const sidebar = `<nav class="wf-sidebar"><h2>component catalog</h2><div class="sb-sub">shared components · building blocks</div>
  <div class="sb-sec">C. categories</div>
  ${cats.map((c, i) => `<a href="#cat-${i}"><span class="num">C-${String(i + 1).padStart(2, '0')}</span><span class="lbl">${c}</span></a>`).join('\n  ')}
</nav>`;

const intro = `<header class="board-header"><h1>component catalog</h1><span class="tag">COMPONENTS · building blocks</span></header>
<section class="readme"><h2>How to read this catalog</h2><ol>
  <li>Screens are made by <em>composing</em> the components below — never by hand-writing raw HTML. Each is a function in <code>src/components.mjs</code> mapped to a class in <code>styles.css</code>.</li>
  <li>Onboarding starts <strong>here</strong>: stand up the shared components — content plus the device chrome (appbar/tabbar/shell/sidebarNav/topbar/browserbar) — and a sample screen before drawing product screens.</li>
  <li>Add a component → register it in <code>CATALOG</code> and it appears on this page automatically.</li>
  <li>Grey and the single accent are lo-fi notation — color, type, and spacing are the design system's call.</li>
</ol></section>`;

const sections = cats.map((cat, i) => {
  const items = byCat[cat].map((c) => `<article class="frame" id="comp-${c.name.replace(/[^a-zA-Z0-9]+/g, '-')}" style="width:auto">
      <div class="card" style="min-width:340px;max-width:520px">
        <div style="display:flex;align-items:baseline;gap:8px"><span class="t-title mono">${esc(c.name)}</span>${c.name2 ? `<span class="mono faint">+ ${esc(c.name2)}</span>` : ''}</div>
        <div class="t-sub" style="font-size:11px">${c.note}</div>
        <div style="border:1px dashed var(--line); border-radius:6px; padding:12px; background:var(--paper)">${c.ex}</div>
      </div>
    </article>`).join('\n');
  return `<section class="flow" id="cat-${i}">
  <div class="flow-title">C-${String(i + 1).padStart(2, '0')}. ${cat} <span class="count">${byCat[cat].length} components</span></div>
  <div class="row" style="flex-wrap:wrap; overflow-x:visible">
${items}
  </div>
</section>`;
}).join('\n\n');

const html = page({ title: 'component catalog', sidebarHtml: sidebar, introHtml: intro, sectionsHtml: sections, styles });
writeFileSync(join(here, '_catalog.html'), html);
console.log(`catalog: ${CATALOG.length} components across ${cats.length} categories → _catalog.html`);
