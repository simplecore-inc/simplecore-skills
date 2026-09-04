// Build the board from data: read the manifest, import each screen's bespoke body, wrap it in the
// pattern's chrome, number it, and write the self-contained HTML humans review — plus the PDF
// that gets sent on.
//
// **One file, unless the board declares an axis to split along.** A second «preview» file used to
// be written by default, on the theory that work in progress needs somewhere lenient to land — but
// the two came out byte-identical, so all that produced was a second copy going stale beside the
// real one. What a board MAY ask for is different in kind: `split` in `board.config.mjs` names a
// module that answers which part a frame belongs to, and the build writes one file per part plus
// an entry page carrying the index of every frame. A board that declares nothing writes
// `board.html` and nothing else, exactly as before. `core/split.mjs` holds the declaration.
//
// Every gate refuses this build; nothing is written until they all pass.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadBoard } from './context.mjs';
import { runGates } from './gates/index.mjs';
import { renderIntro } from './contract.mjs';
import { renderOverview } from './overview.mjs';
import { renderPdf, pdfPathFor } from './export/pdf.mjs';
import { renderVolumes } from './export/volume.mjs';
import { textFor } from './text.mjs';

/**
 * Assemble a board's documents without writing anything.
 *
 * <p>Apart from `buildBoard` because the PDF of a split board is not a copy of any file on disk:
 * a volume gathers several parts and a PDF is one document, so `wf.mjs pdf` has to assemble the
 * same pages the build did. Two assemblers would be two answers to what the board says.
 *
 * @returns `{ ctx, documents, volumeDocs }` — `documents` in write order, entry page first
 */
export async function assembleBoard(boardDir) {
  const ctx = await loadBoard(boardDir);
  const { config, partials, split } = ctx;
  const { frame, sidebar, nav, entry, page } = partials;
  const text = textFor(config.boardLang);

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
  //
  // It resolves to the id as TEXT and never to a link, which is what makes it right on a split
  // board too: the frame it names may be in another file, and an id is found from any of them.
  const { idOf } = await import('./ids.mjs');
  const resolveRefs = (text_) => (text_ || '').replace(/\{\{([a-z0-9-]+)\}\}/g,
    (_, slug) => (idOf(slug) && byId.has(idOf(slug)) ? idOf(slug) : `{{${slug}?}}`));

  // ── Every frame, once, in board order ───────────────────────────────────────
  // The anchor and the two inherited axes are settled here rather than while rendering a section,
  // because a split board renders the same frame list into different groupings and all three have
  // to come out the same however it is grouped. The anchor especially: it is derived from the
  // permanent id, so a link into the board survives a reorder — and now a split as well.
  const flat = [];
  const anchored = new Set();
  for (const sec of ctx.sections) {
    for (const e of sec.entries) {
      const base = `s-${e.id.toLowerCase()}`;
      const anchor = anchored.has(base) ? `${base}-${e.mod.variant ?? 'b'}` : base;
      anchored.add(base);
      // A screen's own `phase` wins over its section's, so a deferred frame parked in a phase-1
      // cluster still carries the mark and a phase-1 frame could sit in a deferred one.
      const phaseKey = e.phase ?? sec.phase ?? null;
      if (phaseKey && !config.phases?.[phaseKey]) {
        throw new Error(`${e.id}: phase '${phaseKey}' is not in board.config.mjs phases`);
      }
      // The same inheritance as `phase`, and for the same reason: a cluster declares what opens
      // all of it, and a screen that departs from its cluster says so itself.
      const featureKey = e.feature ?? sec.feature ?? null;
      if (featureKey && !config.features?.[featureKey]) {
        throw new Error(`${e.id}: feature '${featureKey}' is not in board.config.mjs features`);
      }
      flat.push({
        ...e,
        anchor,
        section: sec,
        phase: phaseKey ? { key: phaseKey, ...config.phases[phaseKey] } : null,
        feature: featureKey ? { key: featureKey, ...config.features[featureKey] } : null,
        // The chips the sidebar shows are the frame's OWN declarations, never the inherited ones:
        // the group heading already carries what the group declared.
        phaseTag: e.phase ? config.phases[e.phase].tag : '',
        featureTag: e.feature ? config.features[e.feature].tag : '',
        reviewTags: Array.isArray(e.badges) ? e.badges.map(String) : [],
        // A third axis the split's module knows, shown per frame rather than used to arrange
        // anything. Null on a board that declares no `tag`.
        axisTag: split?.tagOf ? split.tagOf(e.id) : null,
      });
    }
  }

  /**
   * Render one group of frames — a section on the page and a group in the index.
   *
   * <p>The sequence counts SCREENS, not frames: a responsive pair occupies one position because
   * it is one screen. Assigned by first appearance, so it always reads in the order drawn.
   *
   * @param g `{ letter, title, id, entries, phaseTag, featureTag, count }`
   */
  function renderGroup(g) {
    const seqOf = new Map();
    for (const e of g.entries) {
      if (!seqOf.has(e.id)) seqOf.set(e.id, String(seqOf.size + 1).padStart(2, '0'));
    }
    const frames = [];
    const scList = [];
    const seen = new Set();
    for (const e of g.entries) {
      const seq = seqOf.get(e.id);
      frames.push(frame(
        { ...e.mod, notes: resolveRefs(e.mod.notes), phase: e.phase, feature: e.feature, axisTag: e.axisTag },
        e.id, seq, e.file, e.anchor,
      ));
      // One sidebar entry per screen: a reader looking up T-01 wants the screen, not each half.
      if (!seen.has(e.id)) {
        seen.add(e.id);
        scList.push({
          id: e.id, seq, label: e.label, file: e.file, anchor: e.anchor,
          phaseTag: e.phaseTag, featureTag: e.featureTag, reviewTags: e.reviewTags,
          axisTag: e.axisTag,
        });
      }
    }
    const screenCount = seqOf.size;
    const frameCount = g.entries.length;
    // A section a split has cut in two is still a section, and its heading is still the honest
    // name of what is under it — but the count beside that heading would read as the section's
    // size when it is the size of the part in view. Naming the whole is what stops a reader
    // taking a fragment for the lot; nothing else about the section changes.
    const caption = g.count
      || (g.whole && g.whole > frameCount
        ? ctx.text.framesOfWhole(frameCount, g.whole)
        : screenCount === frameCount
          ? ctx.text.frames(frameCount)
          : ctx.text.screensAndFrames(screenCount, frameCount));
    const block =
      `<section class="flow" id="flow-${g.id}">
  <div class="flow-title">${g.letter ? `${g.letter}. ` : ''}${g.title} ` +
      `${g.phaseTag ? `<span class="fph">${g.phaseTag}</span>` : ''}` +
      `<span class="count">${caption}</span></div>
  <div class="row">
${frames.join('\n')}
  </div>
</section>`;
    return {
      block,
      sidebarSection: {
        letter: g.letter, title: g.title, screens: scList,
        phaseTag: g.phaseTag, featureTag: g.featureTag,
      },
    };
  }

  /** The board's own clusters, as groups — what an unsplit board has always drawn. */
  const clusterGroups = (entries) => {
    const out = [];
    for (const sec of ctx.sections) {
      const mine = entries.filter((e) => e.section === sec);
      if (!mine.length) continue;
      out.push({
        letter: sec.letter, title: sec.title, id: sec.letter.toLowerCase(), entries: mine,
        count: sec.count,
        // What the section holds on the whole board, so a file holding part of it can say so.
        whole: sec.entries.length,
        phaseTag: sec.phase ? config.phases[sec.phase].tag : '',
        featureTag: sec.feature ? config.features[sec.feature].tag : '',
      });
    }
    return out;
  };

  /**
   * The groups a declared second axis forms.
   *
   * <p><b>The index and the page are built from one ordered list</b>, whichever order that is: a
   * reader scrolling the board watches the entry beside it light up, and an index in some other
   * order than the page makes that jump about.
   *
   * <p>The order is the declared one where the axis has an order to declare, and first appearance
   * otherwise. A frame the axis places nowhere keeps its cluster, so nothing can fall out of the
   * file it belongs to — `splitPlacementGate` is what reports it.
   */
  const axisGroups = (entries) => {
    const seen = [];
    const byKey = new Map();
    for (const e of entries) {
      const g = ctx.split.groupOf(e.id);
      const key = g ? g.key : `~${e.section.letter}`;
      if (!byKey.has(key)) {
        byKey.set(key, {
          letter: g ? g.mark : e.section.letter,
          title: g ? g.label : e.section.title,
          id: key.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          order: g ? g.order : null,
          entries: [], phaseTag: '', featureTag: '',
        });
        seen.push(key);
      }
      byKey.get(key).entries.push(e);
    }
    const groups = seen.map((k) => byKey.get(k));
    if (groups.every((g) => g.order)) groups.sort((a, b) => a.order.localeCompare(b.order));
    return groups;
  };

  /** Assemble one document out of a list of groups. */
  const renderDoc = (groups) => {
    const rendered = groups.map(renderGroup);
    return {
      sectionsHtml: rendered.map((r) => r.block).join('\n\n'),
      sidebarSections: rendered.map((r) => r.sidebarSection),
    };
  };

  // The toggle is drawn only where a pair exists — a control that changes nothing reads as a
  // broken one, and a board draws its first pair long after it is started. Asked of the FILE
  // rather than of the board: on a split board a pair may live entirely in one part, and the
  // other parts would otherwise carry a switch that flips nothing they draw.
  const pairsIn = (entries) => entries.some((e) => e.mod.variant === 'narrow' || e.mod.variant === 'wide');
  const introFor = (entries) => renderIntro({ config, ...ctx.introParts, hasPairs: pairsIn(entries), split });
  const { readme } = introFor(flat);
  const overviewHtml = renderOverview(ctx);
  // Only what was actually drawn: a link to a card the overview did not render is a dead entry,
  // and a board with no role matrix legitimately has no 사용자 구성 card. On a split board the
  // overview sits on the entry page alone — it is the map of the WHOLE board, and one copy per
  // file would be four copies of the same drawing saying different things about where the reader
  // is — so the jumps to it cross files, which is what `doc` is for.
  const overviewDoc = split ? split.entry.file : '';
  const jumps = [
    ...(overviewHtml.includes('id="ov-ia"') ? [{ href: 'ov-ia', tag: 'IA', label: ctx.text.jumpIa, doc: overviewDoc }] : []),
    ...(overviewHtml.includes('id="ov-user"') ? [{ href: 'ov-user', tag: 'USER', label: ctx.text.jumpUser, doc: overviewDoc }] : []),
    { href: 'readme', tag: 'READ', label: ctx.text.jumpReadme },
  ];

  const documents = [];
  // One per declared volume: the parts it gathers, assembled back into a single document that
  // exists only to be paginated. A volume is several files and a PDF is one, so there is nothing
  // on disk to render it from.
  const volumeDocs = [];
  if (!split) {
    const doc = renderDoc(clusterGroups(flat));
    documents.push({
      file: 'board.html',
      title: config.title,
      navHtml: '',
      headerHtml: introFor(flat).header,
      overviewHtml,
      ...doc,
      sidebarHtml: sidebar(doc.sidebarSections, { boardName: config.boardName, jumps, file: 'board.html' }),
    });
  } else {
    // One file per declared part, then the entry page — in that order, because the entry page's
    // index is the parts' own index entries rather than a second listing computed beside them.
    // Two listings of one board is how the position beside a frame comes to differ between the
    // page a reader searched and the page they landed on.
    const navItems = [
      { file: split.entry.file, label: split.entry.nav ?? text.navEntry, count: flat.length },
    ];
    const partDocs = [];
    for (const part of split.parts) {
      const mine = flat.filter((e) => ctx.split.partOf(e.id) === part.key);
      const doc = renderDoc(ctx.split.groupOf ? axisGroups(mine) : clusterGroups(mine));
      partDocs.push({ part, mine, ...doc });
      navItems.push({ file: part.file, label: part.nav ?? part.key, count: mine.length });
    }
    for (const { part, mine, sectionsHtml, sidebarSections } of partDocs) {
      documents.push({
        file: part.file,
        title: `${config.title} — ${part.nav ?? part.key}`,
        navHtml: nav(navItems, part.file),
        headerHtml: introFor(mine).header,
        overviewHtml: '',
        sectionsHtml,
        sidebarSections,
        screens: new Set(mine.map((e) => e.id)).size,
        sidebarHtml: sidebar(sidebarSections, { boardName: config.boardName, jumps, file: part.file }),
      });
    }
    // The entry page. It draws no frame, so what it owes a reader is the two things a frame list
    // cannot give them: that these files are one board, and which file holds what. The index of
    // EVERY frame is its sidebar, where the filter is — which is what keeps 「one search finds any
    // frame」 true of a board that has been split.
    const indexSections = partDocs.map(({ part, sidebarSections }) => ({
      letter: '',
      title: part.nav ?? part.key,
      phaseTag: '', featureTag: '',
      screens: sidebarSections.flatMap((s) => s.screens.map((sc) => ({ ...sc, doc: part.file }))),
    }));
    const cards = partDocs.map(({ part, mine, sidebarSections }) => {
      const screens = new Set(mine.map((e) => e.id)).size;
      return {
        file: part.file,
        label: part.nav ?? part.key,
        // Screens and frames differ only where a responsive pair exists, and saying both when
        // they are the same number reads as two facts where there is one.
        count: screens === mine.length
          ? ctx.text.frames(mine.length)
          : ctx.text.screensAndFrames(screens, mine.length),
        groups: sidebarSections.map((s) => s.title).join(' · '),
      };
    });
    documents.push({
      file: split.entry.file,
      title: config.title,
      navHtml: nav(navItems, split.entry.file),
      // The entry page draws no frame, so it never carries the viewport toggle.
      headerHtml: introFor([]).header,
      overviewHtml,
      sectionsHtml: entry(text.oneSet(split.files.length), cards),
      sidebarSections: indexSections,
      screens: new Set(flat.map((e) => e.id)).size,
      sidebarHtml: sidebar(indexSections, {
        boardName: config.boardName,
        jumps: jumps.map((j) => ({ ...j, doc: j.href === 'readme' ? '' : split.entry.file })),
        file: split.entry.file,
      }),
    });

    for (const volume of split.volumes) {
      const mine = partDocs.filter(({ part }) => volume.parts.includes(part.key));
      const sections = mine.flatMap((d) => d.sidebarSections);
      volumeDocs.push({
        volume,
        title: volume.title ? `${config.title} — ${volume.title}` : config.title,
        navHtml: '',
        headerHtml: introFor(mine.flatMap((d) => d.mine)).header,
        overviewHtml,
        sectionsHtml: mine.map((d) => d.sectionsHtml).join('\n\n'),
        // Anchors inside the volume, so the paginator's table of contents — which it reads off
        // this index — finds every frame on a page of its own document.
        sidebarHtml: sidebar(sections, { boardName: config.boardName, jumps: [], file: '' }),
      });
    }
  }

  const html = (doc) => page({
    title: doc.title,
    sidebarHtml: doc.sidebarHtml,
    navHtml: doc.navHtml,
    headerHtml: doc.headerHtml,
    // Between the header and the first frame: the map a reader needs before a wall of screens
    // means anything. Unlike the reading contract it also goes into the PDF, because most
    // readers meet the board as the PDF.
    overviewHtml: doc.overviewHtml,
    sectionsHtml: doc.sectionsHtml,
    readmeHtml: readme,
    styles: ctx.styles,
    viewportPairs: ctx.config.viewportPairs ?? 'narrow-first',
  });
  for (const doc of documents) doc.html = html(doc);
  for (const doc of volumeDocs) doc.html = html(doc);

  // What the `built` gates read. Every gate that reads it walks the board's frames one article at
  // a time, so the whole board is every file's frames end to end — a gate must not go quiet on a
  // frame because of which file it was written into.
  ctx.html = documents.map((d) => d.html).join('\n');
  await runGates(ctx, 'built');

  // Entry page first, whatever order they were assembled in — it is the one a reader opens.
  const ordered = split
    ? [documents[documents.length - 1], ...documents.slice(0, -1)]
    : documents;
  return { ctx, documents: ordered, volumeDocs };
}

/**
 * Build one board: assemble it, write every file, and render the PDF beside them.
 *
 * @param boardDir the board folder
 * @param pdf write the PDF beside the HTML. False while iterating on a screen
 * @returns `{ html, out, outs, screens, sections }` — `out` is the entry page and `outs` every
 *   file written, which are the same single name on a board that declares no split
 */
export async function buildBoard(boardDir, { pdf = true } = {}) {
  const { ctx, documents, volumeDocs } = await assembleBoard(boardDir);
  const { config, split } = ctx;

  const outs = [];
  for (const doc of documents) {
    writeFileSync(join(boardDir, doc.file), doc.html);
    outs.push(doc.file);
  }
  const out = documents[0].file;
  const total = ctx.manifest.reduce((n, s) => n + s.screens.length, 0);
  if (split) {
    console.log(`built ${total} screens across ${ctx.manifest.length} section(s) → ${outs.length} files`);
    for (const doc of documents) {
      console.log(`  ${doc.file}${doc.screens === undefined ? '' : `  ${doc.screens}`}`);
    }
  } else {
    console.log(`built ${total} screens across ${ctx.manifest.length} section(s) → ${out}`);
  }

  // The PDF is built from the pages that were just written, so the two can never disagree. A
  // failure here fails the build, because a build that quietly stops producing one of its two
  // artifacts is how a stale PDF ends up being the copy somebody reads.
  if (pdf && config.pdfName) {
    if (volumeDocs.length) {
      await renderVolumes({ config, boardDir, volumeDocs });
    } else {
      await renderPdf({
        htmlPath: join(boardDir, out),
        pdfPath: pdfPathFor(config, boardDir),
        config,
      });
    }
  }
  return { html: ctx.html, out, outs, screens: total, sections: ctx.manifest.length, ctx };
}
