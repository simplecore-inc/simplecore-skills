// Build the board from data: read the manifest, import each screen's bespoke body, wrap it in the
// pattern's chrome, number it, and write one self-contained HTML — the artifact humans review —
// plus the PDF that gets sent on.
//
// One output, always. A second «preview» file used to be written by default, on the theory that
// work in progress needs somewhere lenient to land — but the two came out byte-identical, so all
// the split produced was a second copy going stale beside the real one. Every gate refuses this
// build; nothing is written until they all pass.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadBoard } from './context.mjs';
import { runGates } from './gates/index.mjs';
import { renderIntro } from './contract.mjs';
import { renderOverview } from './overview.mjs';
import { renderPdf, pdfPathFor } from './export/pdf.mjs';

/**
 * Build one board.
 *
 * @param boardDir the board folder
 * @param pdf write the PDF beside the HTML. False while iterating on a screen
 * @returns `{ html, out, screens, sections }`
 */
export async function buildBoard(boardDir, { pdf = true } = {}) {
  const ctx = await loadBoard(boardDir);
  const { config, partials } = ctx;
  const { frame, sidebar, page } = partials;

  // The numbering is checked BEFORE anything is rendered: the anchors, the sequence and the
  // labels are all derived from the id, so rendering with a broken one produces a board whose
  // numbers cannot be trusted rather than an error.
  await runGates(ctx, 'preflight');

  const byId = new Map();
  for (const sec of ctx.sections) {
    for (const e of sec.entries) {
      if (!byId.has(e.id)) byId.set(e.id, []);
      byId.get(e.id).push(e);
    }
  }
  ctx.byId = byId;

  // Notes reference a screen by its FILE NAME — `{{d-04-contract-detail}}` — and the build
  // resolves that to the screen's permanent id. An unknown slug is left visible as `{{slug?}}`
  // rather than dropped, so a bad reference fails loudly instead of disappearing.
  const { idOf } = await import('./ids.mjs');
  const resolveRefs = (text) => (text || '').replace(/\{\{([a-z0-9-]+)\}\}/g,
    (_, slug) => (idOf(slug) && byId.has(idOf(slug)) ? idOf(slug) : `{{${slug}?}}`));

  const sidebarSections = [];
  const sectionBlocks = [];
  for (const sec of ctx.sections) {
    const scList = [];
    const frames = [];
    // The sequence counts SCREENS, not frames: a responsive pair occupies one position because
    // it is one screen. Assigned by first appearance, so it always reads in board order.
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
      // A screen's own `phase` wins over its section's, so a deferred frame parked in a phase-1
      // cluster still carries the mark and a phase-1 frame could sit in a deferred one.
      const phaseKey = e.phase ?? sec.phase ?? null;
      if (phaseKey && !config.phases?.[phaseKey]) {
        throw new Error(`${e.id}: phase '${phaseKey}' is not in board.config.mjs phases`);
      }
      const phase = phaseKey ? { key: phaseKey, ...config.phases[phaseKey] } : null;
      // The same inheritance as `phase`, and for the same reason: a cluster declares what opens
      // all of it, and a screen that departs from its cluster says so itself.
      const featureKey = e.feature ?? sec.feature ?? null;
      if (featureKey && !config.features?.[featureKey]) {
        throw new Error(`${e.id}: feature '${featureKey}' is not in board.config.mjs features`);
      }
      const feature = featureKey ? { key: featureKey, ...config.features[featureKey] } : null;
      frames.push(frame({ ...e.mod, notes: resolveRefs(e.mod.notes), phase, feature }, e.id, seq, e.file, anchor));
      // One sidebar entry per screen: a reader looking up T-01 wants the screen, not each half.
      if (anchor === base) {
        scList.push({
          id: e.id, seq, label: e.label, file: e.file, anchor,
          phaseTag: e.phase ? config.phases[e.phase].tag : '',
          featureTag: e.feature ? config.features[e.feature].tag : '',
        });
      }
    }
    sidebarSections.push({
      letter: sec.letter, title: sec.title, screens: scList,
      phaseTag: sec.phase ? config.phases[sec.phase].tag : '',
      featureTag: sec.feature ? config.features[sec.feature].tag : '',
    });
    const screenCount = seqOf.size;
    const frameCount = sec.entries.length;
    const caption =
      sec.count ||
      (screenCount === frameCount
        ? ctx.text.frames(frameCount)
        : ctx.text.screensAndFrames(screenCount, frameCount));
    sectionBlocks.push(
      `<section class="flow" id="flow-${sec.letter.toLowerCase()}">
  <div class="flow-title">${sec.letter}. ${sec.title} ` +
      `${sec.phase ? `<span class="fph">${config.phases[sec.phase].tag}</span>` : ''}` +
      `<span class="count">${caption}</span></div>
  <div class="row">
${frames.join('\n')}
  </div>
</section>`
    );
  }

  // The toggle is drawn only where a pair exists — a control that changes nothing reads as a
  // broken one, and a board draws its first pair long after it is started.
  const hasPairs = ctx.loaded.some((s) => s.mod.variant === 'narrow' || s.mod.variant === 'wide');
  const { header, readme } = renderIntro({ config, ...ctx.introParts, hasPairs });
  const overviewHtml = renderOverview(ctx);
  // Only what was actually drawn: a link to a card the overview did not render is a dead entry,
  // and a board with no role matrix legitimately has no 사용자 구성 card.
  const jumps = [
    ...(overviewHtml.includes('id="ov-ia"') ? [{ href: 'ov-ia', tag: 'IA', label: ctx.text.jumpIa }] : []),
    ...(overviewHtml.includes('id="ov-user"') ? [{ href: 'ov-user', tag: 'USER', label: ctx.text.jumpUser }] : []),
    { href: 'readme', tag: 'READ', label: ctx.text.jumpReadme },
  ];
  ctx.html = page({
    title: config.title,
    sidebarHtml: sidebar(sidebarSections, { boardName: config.boardName, jumps }),
    headerHtml: header,
    // Between the header and the first frame: the map a reader needs before a wall of screens
    // means anything. Unlike the reading contract it also goes into the PDF, because most
    // readers meet the board as the PDF.
    overviewHtml,
    sectionsHtml: sectionBlocks.join('\n\n'),
    readmeHtml: readme,
    styles: ctx.styles,
  });

  await runGates(ctx, 'built');

  const out = 'board.html';
  writeFileSync(join(boardDir, out), ctx.html);
  const total = ctx.manifest.reduce((n, s) => n + s.screens.length, 0);
  console.log(`built ${total} screens across ${ctx.manifest.length} section(s) → ${out}`);

  // The PDF is built from the HTML that was just written, so the two can never disagree. A
  // failure here fails the build, because a build that quietly stops producing one of its two
  // artifacts is how a stale PDF ends up being the copy somebody reads.
  if (pdf && config.pdfName) {
    await renderPdf({
      htmlPath: join(boardDir, out),
      pdfPath: pdfPathFor(config, boardDir),
      config,
    });
  }
  return { html: ctx.html, out, screens: total, sections: ctx.manifest.length, ctx };
}
