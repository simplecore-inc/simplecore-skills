#!/usr/bin/env node
// The one command line a board has. Every artifact and every check is a subcommand here, so a
// flag means the same thing whichever one it is asked for, and a board adds no script of its own.
//
//   node wf.mjs build [--no-pdf]        the board, and the PDF beside it
//   node wf.mjs catalog                 the component storybook → _catalog.html
//   node wf.mjs check [--frames <pfx>]  visual sweep of the built board
//   node wf.mjs gates                   every gate against the defect it exists to catch
//   node wf.mjs coverage                board ⇄ code — the frames no route reaches
//   node wf.mjs pdf [--mask 40%] [--watermark [logo]] [--to "<recipient>"] [--in f] [--out f]
//   node wf.mjs shots <outDir> [idPfx]  one PNG per frame
//   node wf.mjs doctor                  what this board is on, and what it owes
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
import { LATEST, migrationReport, MIGRATIONS } from '../core/migrations.mjs';

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

const HELP = `wireframe-boards — 보드를 빌드하고 점검하는 명령
  build [--no-pdf]                보드와 PDF를 함께 만듭니다
  catalog                         컴포넌트 스토리북 → _catalog.html
  check [--frames <접두>]          빌드된 보드의 레이아웃 점검 — 넘침·가로 스크롤·폴드
  gates                           게이트가 제 결함을 잡는지 검증합니다
  coverage                        보드 ⇄ 코드 — 라우트가 없는 프레임
  pdf [--mask 40%] [--watermark [로고]] [--to <수신자>] [--in f] [--out f]
                                  --to를 주면 로고 아래에 만든 시각과 수신자를 적습니다
  shots <디렉터리> [id접두]         프레임마다 PNG 한 장을 저장합니다
  doctor                          이 보드의 계약 버전과 남은 작업
  patterns                        쓸 수 있는 공통패턴
  init --pattern <이름> --name <제품>   새 보드를 세웁니다 (킷에서 직접 실행)
공통: --board <디렉터리> (기본값은 현재 디렉터리)`;

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
  process.exit(0);
}

if (cmd === 'init') {
  const { initBoard } = await import('../core/init.mjs');
  const report = initBoard(boardDir, {
    pattern: opt('pattern', 'simplix-basic'),
    name: opt('name', '<PRODUCT>'),
    examples: !flag('no-examples'),
  });
  console.log(`${report.pattern} 패턴으로 보드를 세웠습니다 — ${boardDir}`);
  for (const p of report.written) console.log(`  + ${p.slice(boardDir.length + 1)}`);
  for (const p of report.kept) console.log(`  · 그대로 둠 ${p.slice(boardDir.length + 1)}`);
  console.log('\n다음: node wf.mjs build --no-pdf 로 시작 프레임이 그려지는지 봅니다.');
  process.exit(0);
}

if (!existsSync(join(boardDir, 'board.config.mjs'))) {
  die(`${boardDir}에 board.config.mjs가 없습니다 — 보드 폴더에서 실행하거나 --board로 지정합니다.`);
}

switch (cmd) {
  case 'build': {
    const { buildBoard } = await import('../core/build.mjs');
    await buildBoard(boardDir, { pdf: !flag('no-pdf') });
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
    const { config } = await loadBoard(boardDir, { screens: false });
    const htmlPath = resolve(boardDir, opt('in', 'board.html'));
    // `--mask` takes `40%` or `0.4`; a bare `40` is refused rather than guessed at — the two
    // readings differ by a factor of a hundred and one of them hands over the whole board.
    const maskRaw = opt('mask');
    let maskRatio = 0;
    if (maskRaw !== undefined) {
      if (/^\d+(\.\d+)?%$/.test(maskRaw)) maskRatio = parseFloat(maskRaw) / 100;
      else if (/^0?\.\d+$/.test(maskRaw)) maskRatio = parseFloat(maskRaw);
      else die(`--mask 값은 40% 또는 0.4 형식입니다 (받은 값: ${maskRaw})`);
    }
    const suffix = maskRatio ? `-share${Math.round(maskRatio * 100)}` : '';
    const outArg = opt('out');
    const pdfPath = outArg
      ? resolve(boardDir, outArg)
      : pdfPathFor({ ...config, pdfName: `${config.pdfName}${suffix}` }, boardDir);
    await renderPdf({ htmlPath, pdfPath, config, maskRatio, maskSeed: opt('mask-seed', '') });
    if (flag('watermark')) {
      const logo = opt('watermark') ?? config.watermark?.logo;
      if (!logo) die('--watermark: 로고 경로를 지정하거나 board.config.mjs의 watermark.logo를 채웁니다');
      // Written beside the plain PDF, never over it: a copy stamped for one recipient must not
      // become the only copy the folder holds.
      const stamped = pdfPath.replace(/\.pdf$/, '-watermarked.pdf');
      stampWatermark({
        src: pdfPath,
        out: stamped,
        logo: isAbsolute(logo) ? logo : join(boardDir, logo),
        opacity: config.watermark?.opacity,
        widthRatio: config.watermark?.widthRatio,
        to: opt('to', ''),
      });
    }
    break;
  }
  case 'shots': {
    const outDir = positional[0];
    if (!outDir) die('shots: 내보낼 디렉터리를 지정합니다 — node wf.mjs shots _shots [id접두]');
    const { shootFrames } = await import('../core/export/shot.mjs');
    await shootFrames(boardDir, resolve(boardDir, outDir), positional[1]);
    break;
  }
  case 'doctor': {
    const { loadBoard } = await import('../core/context.mjs');
    console.log(`킷      ${dirname(dirname(fileURLToPath(import.meta.url)))}`);
    console.log(`계약    킷 ${BOARD_CONTRACT} · 마이그레이션 기록 ${LATEST}`);
    let ctx;
    try {
      ctx = await loadBoard(boardDir, { screens: false });
    } catch (e) {
      console.error(`\n${e.message}`);
      process.exit(1);
    }
    const { config, pattern } = ctx;
    console.log(`보드    ${config.boardName} · 계약 ${config.contract}`);
    console.log(`패턴    ${pattern.name} — ${pattern.title}`);
    const missing = Object.entries(pattern.requires ?? {})
      .filter(([p]) => !existsSync(join(boardDir, p)));
    for (const [p, why] of missing) console.log(`  ✖ 없음  ${p} — ${why}`);
    for (const [p, why] of Object.entries(pattern.optional ?? {})) {
      if (!existsSync(join(boardDir, p))) console.log(`  · 선택  ${p} — ${why}`);
    }
    const report = migrationReport(config.contract, BOARD_CONTRACT);
    if (report) console.log(`\n${report}`);
    else console.log('\n계약은 최신입니다.');
    if (missing.length) process.exit(1);
    break;
  }
  case 'migrations': {
    // What every version changed, for a person deciding whether a move is worth making.
    for (const m of MIGRATIONS) {
      console.log(`\n계약 ${m.contract} — ${m.title}${m.breaking ? ' (빌드가 멈춥니다)' : ''}`);
      for (const c of m.changed) console.log(`  바뀐 것 · ${c}`);
      for (const s of m.steps) console.log(`  할 일   · ${s}`);
    }
    break;
  }
  default:
    die(`알 수 없는 명령 「${cmd}」\n\n${HELP}`);
}
