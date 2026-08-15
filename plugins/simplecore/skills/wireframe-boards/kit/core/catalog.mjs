// Build the component catalog (storybook): render every entry in the pattern's CATALOG with its
// name, live example, and note, grouped by category. This is the reference an author consults
// BEFORE writing a screen — the kit they compose from. Adding a component to the pattern (and
// registering it in CATALOG) makes it show up here automatically.
//
//   node wf.mjs catalog   → writes _catalog.html
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadBoard } from './context.mjs';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Render the storybook for whichever pattern this board is drawn in.
 *
 * <p>The catalog is the pattern's, not the board's — two boards on one pattern get the same
 * page. It is written into the board folder anyway, because that is where somebody drawing a
 * screen is standing when they need it.
 */
export async function buildCatalog(boardDir) {
  // The screens are not needed and there may be hundreds of them; the catalog is about the
  // components. `screens: false` is the difference between reading one file and importing 747.
  const ctx = await loadBoard(boardDir, { screens: false });
  const { CATALOG } = ctx.components;
  if (!CATALOG) throw new Error(`패턴 '${ctx.pattern.name}'의 components.mjs에 CATALOG가 없습니다`);
  const { page } = ctx.partials;

  const cats = [];
  const byCat = {};
  for (const c of CATALOG) {
    if (!byCat[c.cat]) { byCat[c.cat] = []; cats.push(c.cat); }
    byCat[c.cat].push(c);
  }

  const sidebarHtml = `<nav class="wf-sidebar">
    <div class="sb-head">
      <h2>components<span class="sb-total">${CATALOG.length}</span></h2>
      <div class="sb-sub">${ctx.pattern.name} · building blocks</div>
    </div>
    <div class="sb-list">
    <div class="sb-group">
      <div class="sb-sec">C. categories<span class="sb-n">${cats.length}</span></div>
${cats.map((c, i) => `      <a href="#cat-${i}"><span class="num">C-${String(i + 1).padStart(2, '0')}</span><span class="lbl">${c}</span></a>`).join('\n')}
    </div>
    </div>
  </nav>`;

  const headerHtml = `<header class="board-header">
  <h1>${ctx.pattern.name} — component catalog</h1>
  <span class="tag">COMPONENTS · building blocks</span>
  <a class="to-readme" href="#readme">읽는 법</a>
</header>`;

  const readmeHtml = `<section class="readme" id="readme"><h2>How to read this catalog</h2><ol>
  <li>Screens are made by <em>composing</em> the components below — never by hand-writing raw HTML. Each is a function in the pattern's <code>components.mjs</code> mapped to a class in its <code>styles.css</code>.</li>
  <li>Onboarding starts <strong>here</strong>: read the kit — content primitives plus the device chrome — before drawing product screens.</li>
  <li>Add a component → register it in <code>CATALOG</code> and it appears on this page automatically.</li>
  <li>Grey and the single accent are lo-fi notation — color, type, and spacing are the design system's call.</li>
</ol></section>`;

  const sectionsHtml = cats.map((cat, i) => {
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

  const html = page({
    title: `${ctx.pattern.name} — component catalog`,
    sidebarHtml, headerHtml, sectionsHtml, readmeHtml, styles: ctx.styles,
  });
  writeFileSync(join(boardDir, '_catalog.html'), html);
  console.log(`catalog: ${CATALOG.length} components across ${cats.length} categories → _catalog.html`);
  return { components: CATALOG.length, categories: cats.length };
}
