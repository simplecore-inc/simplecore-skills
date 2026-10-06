#!/usr/bin/env node
// The one command line a board has. Every artifact and every check is a subcommand here, so a
// flag means the same thing whichever one it is asked for, and a board adds no script of its own.
//
//   node wf.mjs build [--no-pdf]        the board, and the PDF beside it
//   node wf.mjs serve [--port 4173]     build, serve over HTTP, rebuild and reload on every change
//   node wf.mjs catalog                 the component storybook → _catalog.html
//   node wf.mjs check [--frames <pfx>]  visual sweep of the built board
//   node wf.mjs gates                   every gate against the defect it exists to catch
//   node wf.mjs coverage                board ⇄ code - the frames no route reaches
//   node wf.mjs pdf [--mask 40%] [--watermark [logo]] [--to "<recipient>"] [--in f] [--out f]
//   node wf.mjs shots <outDir> [idPfx] [--no-notes]  one PNG per frame
//   node wf.mjs doctor                  what this board is on, and what it owes
//   node wf.mjs where                   the plugin directory this kit belongs to
//
// One subcommand runs from the KIT rather than from a board, because it is what creates one:
//
//   node <kit>/bin/wfb.mjs init --board <dir> --pattern <name> --name "<PRODUCT>" [--no-examples]
//
// The board folder is the current directory unless `--board <dir>` says otherwise, so every
// command is run from the board and reads like it belongs to it.
import { existsSync } from 'node:fs';
import { resolve, join, isAbsolute, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BOARD_CONTRACT } from '../core/partials.mjs';
import { LATEST, migrationReport, MIGRATIONS, CONFIG_CHANGES, configChangesFor } from '../core/migrations.mjs';

const argv = process.argv.slice(2);
const cmd = argv[0] ?? 'help';
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback = undefined) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const positional = argv.slice(1).filter((a, i, all) =>
  !a.startsWith('--') && !(i > 0 && all[i - 1].startsWith('--')));

const boardDir = resolve(opt('board', process.cwd()));

const die = (msg) => { console.error(msg); process.exit(1); };

const HELP = `wireframe-boards - build and check a board
  build [--no-pdf]                build the board, and the PDF beside it
  serve [--port 4173] [--host 127.0.0.1] [--open] [--no-watch] [--pdf]
                                  build the board, serve it over HTTP, rebuild when a source
                                  changes and reload the open browser
  catalog                         the component storybook → _catalog.html
  check [--frames <prefix>]       layout sweep of the built board - overflow, sideways scroll, fold
  gates                           prove every gate still catches the defect it exists for
  coverage                        board ⇄ code - the frames no route reaches
  pdf [--mask 40%] [--watermark [logo]] [--to <recipient>] [--in f] [--out f]
                                  --to writes the time of making and the recipient under the logo
  shots <dir> [idPrefix] [--no-notes]
                                  one PNG per frame; --no-notes leaves the notes block out
  doctor                          this board's contract, what it owes, and the gates it has not configured
  migrations                      what each contract and each config change asks of a board (needs no board)
  where                           the directory of the plugin this kit belongs to (to call its other scripts)
  patterns                        the patterns the kit ships
  pattern fork [--into <dir>] [--name <name>]
                                  copy the current pattern into the board and point the board at it
  pattern adopt [--into <dir>] [--name <name>]
                                  promote the components and styles in src/ to this board's pattern
  init --pattern <name> --name <product>   start a new board (run from the kit)
common: --board <dir> (default: the current directory)`;

if (cmd === 'help' || flag('help')) {
  console.log(HELP);
  process.exit(0);
}

if (cmd === 'patterns') {
  const { readdirSync } = await import('node:fs');
  const dir = join(dirname(dirname(fileURLToPath(import.meta.url))), 'patterns');
  for (const name of readdirSync(dir)) {
    const p = (await import(pathToFileURL(join(dir, name, 'pattern.mjs')).href)).default;
    console.log(`${p.name}\n  ${p.title}\n  ${p.description}`);
    for (const [k, v] of Object.entries(p.devices ?? {})) console.log(`    ${k.padEnd(8)} ${v}`);
  }
  console.log(
    '\nA board may carry a pattern of its own, written as a path in board.config.mjs'
    + " (pattern: './pattern').\n  That is for a board whose components are mostly not in the patterns above;"
    + ' node wf.mjs pattern fork copies the current pattern and points the board at the copy.\n'
    + '  One or two missing components are an addition to the pattern, not a reason to fork - once'
    + ' forked, the kit\'s fixes to that pattern no longer reach the board.'
  );
  process.exit(0);
}

if (cmd === 'pattern') {
  const how = positional[0];
  if (how !== 'fork' && how !== 'adopt') {
    die('pattern takes fork or adopt.\n'
      + '  fork   copy a pattern the kit ships into the board - for a board already drawn in it\n'
      + '  adopt  promote the components and styles src/ holds to this board\'s pattern - for a board from before the contract');
  }
  // A refusal here is a sentence somebody has to read - which pattern is already there, which
  // folder is in the way. A stack trace buries it under twenty lines of node internals.
  const refuse = (err) => die(err instanceof Error ? err.message : String(err));

  if (how === 'adopt') {
    const { adoptPattern } = await import('../core/fork-pattern.mjs');
    let report;
    try {
      report = adoptPattern(boardDir, { into: opt('into', 'pattern'), name: opt('name', null) });
    } catch (err) { refuse(err); }
    console.log(`moved ${report.moved.join(' · ')} from src/ to ${report.into}/ as the '${report.name}' pattern.`);
    for (const f of report.moved) console.log(`  → ${report.into}/${f}`);
    console.log(`  + ${report.into}/pattern.mjs`);
    console.log(`  ~ src/components.mjs  re-exports ../${report.into}/components.mjs`);
    console.log(report.config
      ? `  ~ board.config.mjs  pattern: './${report.into}'`
      : `  ! no board.config.mjs - write pattern: './${report.into}' in it when it is made`);
    // Two things the promotion cannot do for anybody, said here because this is the only moment
    // somebody is looking at the board's `src/` and knows why it changed.
    if (report.introIsDocument) {
      console.log(`\n  ! ${report.into}/intro.html is a document, not a list of items`
        + '\n    The reading contract goes inside the kit\'s <ol>, so this file keeps only <li> elements.'
        + '\n    Delete the heading, the sections and the standing items: the kit and the pattern draw them, and written again they appear twice.');
    }
    for (const f of report.orphaned) {
      console.log(`\n  ! nothing reads src/${f} now - the kit's core/${f} builds the board`
        + `\n    Left in place, an edit to it changes nothing, and nothing says so.`
        + `\n    Move what it still holds to ${report.into}/, or delete it.`);
    }
    console.log('\nnext: node wf.mjs build --no-pdf shows whether the kit can build this board.');
    process.exit(0);
  }
  const { forkPattern } = await import('../core/fork-pattern.mjs');
  let report;
  try {
    report = forkPattern(boardDir, { into: opt('into', 'pattern'), name: opt('name', null) });
  } catch (err) { refuse(err); }
  console.log(`copied the ${report.from} pattern to ${report.into}/ and named it '${report.name}'.`);
  for (const f of report.files) console.log(`  + ${report.into}/${f}`);
  console.log(`  ~ board.config.mjs  pattern: './${report.into}'`);
  console.log(`  ~ src/components.mjs  re-exports ../${report.into}/components.mjs`);
  console.log(
    '\nThis board now owns that pattern - its components, gates and styles are fixed here.'
    + '\nA fix the kit makes to the original pattern does not reach this copy.'
    + '\nnext: node wf.mjs build --no-pdf shows whether it draws as before.'
  );
  process.exit(0);
}

if (cmd === 'init') {
  const { initBoard } = await import('../core/init.mjs');
  const report = initBoard(boardDir, {
    pattern: opt('pattern', 'simplix-basic'),
    name: opt('name', '<PRODUCT>'),
    examples: !flag('no-examples'),
  });
  console.log(`started a board in the ${report.pattern} pattern - ${boardDir}`);
  for (const p of report.written) console.log(`  + ${p.slice(boardDir.length + 1)}`);
  for (const p of report.kept) console.log(`  · kept ${p.slice(boardDir.length + 1)}`);
  console.log('\nnext: node wf.mjs build --no-pdf shows whether the starting frames draw.');
  process.exit(0);
}

// What every contract changed, for somebody deciding whether a move is worth making.
//
// **Above the config check on purpose.** A board being migrated has no `board.config.mjs` - that
// file arrives WITH the contract this command describes - so requiring one would refuse the
// command to exactly the board it is for. It reads nothing off the board and needs nothing from it.
if (cmd === 'migrations') {
  for (const m of MIGRATIONS) {
    console.log(`\ncontract ${m.contract} - ${m.title}${m.breaking ? ' (the build stops until it is crossed)' : ''}`);
    for (const c of m.changed) console.log(`  changed · ${c}`);
    for (const s of m.steps) console.log(`  step    · ${s}`);
  }
  console.log('\nConfig changes - none stops a build; doctor names the ones a board carries:');
  for (const m of CONFIG_CHANGES) {
    console.log(`\n${m.id} - ${m.title}`);
    for (const c of m.changed) console.log(`  changed · ${c}`);
    for (const s of m.steps) console.log(`  step    · ${s}`);
  }
  process.exit(0);
}

// Where the plugin this kit belongs to is installed. A board's instructions reach the plugin's
// other scripts through it (`$(node wf.mjs where)/skills/korean-docs/scripts/l10n.mjs`), so they
// hold on every install the bootstrap finds rather than on one machine's layout. Above the config
// check because it reads nothing off the board.
if (cmd === 'where') {
  console.log(resolve(dirname(dirname(fileURLToPath(import.meta.url))), '..', '..', '..'));
  process.exit(0);
}

if (!existsSync(join(boardDir, 'board.config.mjs'))) {
  die(`${boardDir} has no board.config.mjs - run from a board folder or name one with --board.`);
}

switch (cmd) {
  case 'build': {
    const { buildBoard } = await import('../core/build.mjs');
    await buildBoard(boardDir, { pdf: !flag('no-pdf') });
    break;
  }
  case 'serve': {
    const { serveBoard } = await import('../core/serve.mjs');
    const port = Number(opt('port', 4173));
    if (!Number.isInteger(port) || port < 1 || port > 65535) die(`--port takes a port number (got: ${opt('port')})`);
    await serveBoard(boardDir, {
      port,
      host: opt('host', '127.0.0.1'),
      open: flag('open'),
      watchSources: !flag('no-watch'),
      pdf: flag('pdf'),
    });
    break;
  }
  case 'catalog': {
    const { buildCatalog } = await import('../core/catalog.mjs');
    await buildCatalog(boardDir);
    break;
  }
  case 'check': {
    const { inspectBoard } = await import('../core/check/inspect.mjs');
    const findings = await inspectBoard(boardDir, { framePrefix: opt('frames') });
    process.exit(findings ? 1 : 0);
    break;
  }
  case 'gates': {
    const { runGateTests } = await import('../core/check/gates.mjs');
    process.exit((await runGateTests(boardDir)) ? 0 : 1);
    break;
  }
  case 'coverage': {
    const { reportCoverage } = await import('../core/check/coverage.mjs');
    await reportCoverage(boardDir);
    break;
  }
  case 'pdf': {
    const { renderPdf, pdfPathFor, stampWatermark } = await import('../core/export/pdf.mjs');
    const { loadBoard } = await import('../core/context.mjs');
    const { config, split } = await loadBoard(boardDir, { screens: false });
    // `--mask` takes `40%` or `0.4`; a bare `40` is refused rather than guessed at - the two
    // readings differ by a factor of a hundred and one of them hands over the whole board.
    const maskRaw = opt('mask');
    let maskRatio = 0;
    if (maskRaw !== undefined) {
      if (/^\d+(\.\d+)?%$/.test(maskRaw)) maskRatio = parseFloat(maskRaw) / 100;
      else if (/^0?\.\d+$/.test(maskRaw)) maskRatio = parseFloat(maskRaw);
      else die(`--mask takes 40% or 0.4 (got: ${maskRaw})`);
    }
    const suffix = maskRatio ? `-share${Math.round(maskRatio * 100)}` : '';
    const outArg = opt('out');
    // A logo stamped onto whatever was just written, never over it: a copy stamped for one
    // recipient must not become the only copy the folder holds.
    const stamp = (pdfPath) => {
      if (!flag('watermark')) return;
      const logo = opt('watermark') ?? config.watermark?.logo;
      if (!logo) die('--watermark: name a logo path, or fill watermark.logo in board.config.mjs');
      stampWatermark({
        src: pdfPath,
        out: pdfPath.replace(/\.pdf$/, '-watermarked.pdf'),
        logo: isAbsolute(logo) ? logo : join(boardDir, logo),
        opacity: config.watermark?.opacity,
        widthRatio: config.watermark?.widthRatio,
        to: opt('to', ''),
      });
    };

    // A board that declares volumes has no single file to render: a volume gathers several of the
    // files the split wrote, so the pages are assembled the way the build assembled them. `--in`
    // is still the explicit override - one named file in, one named file out - because that is
    // what somebody rendering a page by hand asked for.
    if (split?.volumes.length && !opt('in')) {
      if (outArg) die('--out names one file - on a board with several volumes it goes with --in');
      const { assembleBoard } = await import('../core/build.mjs');
      const { renderVolumes } = await import('../core/export/volume.mjs');
      const { volumeDocs } = await assembleBoard(boardDir);
      const written = await renderVolumes({
        config, boardDir, volumeDocs, suffix,
        pdfOptions: { maskRatio, maskSeed: opt('mask-seed', '') },
      });
      written.forEach(stamp);
      break;
    }

    const htmlPath = resolve(boardDir, opt('in', split?.entry.file ?? 'board.html'));
    const pdfPath = outArg
      ? resolve(boardDir, outArg)
      : pdfPathFor({ ...config, pdfName: `${config.pdfName}${suffix}` }, boardDir);
    await renderPdf({ htmlPath, pdfPath, config, maskRatio, maskSeed: opt('mask-seed', '') });
    stamp(pdfPath);
    break;
  }
  case 'shots': {
    const outDir = positional[0];
    if (!outDir) die('shots: name the output directory - node wf.mjs shots _shots [idPrefix]');
    const { shootFrames } = await import('../core/export/shot.mjs');
    await shootFrames(boardDir, resolve(boardDir, outDir), positional[1], { notes: !flag('no-notes') });
    break;
  }
  case 'doctor': {
    const { loadBoard } = await import('../core/context.mjs');
    console.log(`kit       ${dirname(dirname(fileURLToPath(import.meta.url)))}`);
    console.log(`contract  kit ${BOARD_CONTRACT} · migration record ${LATEST}`);
    let ctx;
    try {
      ctx = await loadBoard(boardDir, { screens: false });
    } catch (e) {
      console.error(`\n${e.message}`);
      process.exit(1);
    }
    const { config, pattern } = ctx;
    console.log(`board     ${config.boardName} · contract ${config.contract}`);
    console.log(`pattern   ${pattern.name} - ${pattern.title}`);
    const missing = Object.entries(pattern.requires ?? {})
      .filter(([p]) => !existsSync(join(boardDir, p)));
    for (const [p, why] of missing) console.log(`  ✖ missing   ${p} - ${why}`);
    for (const [p, why] of Object.entries(pattern.optional ?? {})) {
      if (!existsSync(join(boardDir, p))) console.log(`  · optional  ${p} - ${why}`);
    }
    // A gate whose vocabulary the board has not declared holds it to nothing. Named here so a
    // gate is never off without a line saying so.
    const { unconfiguredGates } = await import('../core/gates/index.mjs');
    const idle = unconfiguredGates(ctx);
    if (idle.length) {
      console.log('\ngates not configured - each runs once its key is declared in board.config.mjs:');
      for (const g of idle) console.log(`  · ${g.id}  ${g.configuredBy.key} - ${g.configuredBy.what}`);
    }
    const changes = configChangesFor(config);
    if (changes.length) {
      console.log('\nconfig changes this board carries a key for (none stops the build):');
      for (const m of changes) {
        console.log(`  ${m.id} - ${m.title}`);
        for (const s of m.steps) console.log(`    · ${s}`);
      }
      console.log('  node wf.mjs build names every declared document no gate read.');
    }
    const report = migrationReport(config.contract, BOARD_CONTRACT);
    if (report) console.log(`\n${report}`);
    else console.log('\nThe contract is current.');
    if (missing.length) process.exit(1);
    break;
  }
  default:
    die(`unknown command 「${cmd}」\n\n${HELP}`);
}
