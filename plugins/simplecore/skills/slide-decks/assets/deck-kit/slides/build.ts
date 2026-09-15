// Build the presentation .pptx from pptx-presentation/main.sgx.
//
//   1. generate templates/parts.xml · master.xml from the PARTS palette
//   2. generate templates/figures.xml from ../proposal/diagrams and ./diagrams and
//      templates/screens.xml from assets/screens/*.png
//   3. compile main.sgx -> out/제안발표.pptx with lint enabled
//   4. (--render) render every slide to out/png/ for visual review
//
// The deck is A4 landscape (1123 x 794 px at 96 dpi). It is the proposal
// deck's environment (../pptx) turned on its side: the same two families, the
// same palette, the same component set, with a slide-sized page shell. It
// reads nothing from ../pptx at build time; only tools/refpages.py and
// tools/coverage.py read the proposal deck and the presentation plan to check
// what the slides cite.
//
//   npm run build                    # pptx
//   npm run render                   # the above + slide PNGs
//   npm run build -- --figures=png   # rasterize SVG figures instead of embedding them

import {
  promises as fs,
  readFileSync,
  readdirSync,
  existsSync,
  statSync,
} from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildPptx, type ImportResolver } from "@slideglance/builder";
import { Resvg } from "@resvg/resvg-js";
import JSZip from "jszip";

const HERE = path.dirname(fileURLToPath(import.meta.url));
/**
 * Two figure sources. The proposal's figures are read from where the proposal
 * keeps them and never copied — a figure corrected there reaches this deck on
 * the next build. The deck's own figures (re-laid or new, drawn by
 * tools/diagrams/*.py) land in ./diagrams.
 */
const DIAGRAM_DIRS = [
  path.resolve(HERE, "..", "proposal", "diagrams"),
  path.join(HERE, "diagrams"),
];
const FIGURE_DIR = path.join(HERE, "assets", "figures-png");
const SCREEN_DIR = path.join(HERE, "assets", "screens");
const OUT_DIR = path.join(HERE, "out");
const PPTX_PATH = path.join(OUT_DIR, "제안발표.pptx");

/**
 * The fonts the deck is set in, carried in the repository. KoPub Batang and
 * Pretendard are the two families styles/typography.xml names. A preview
 * rendered on one checkout and one rendered on another have to break their
 * lines in the same places.
 */
const FONT_DIR = path.join(HERE, "fonts");
const FONT_FILES = [
  "Pretendard-Regular.otf",
  "Pretendard-Bold.otf",
  "Pretendard-SemiBold.otf",
  "KoPubBatang-Bold.ttf",
  "KoPubBatang-Light.ttf",
].map((name) => path.join(FONT_DIR, name));

/** A4 landscape at 96 dpi — 297 x 210 mm. Matches <Document w h>. */
const SLIDE_SIZE = { w: 1123, h: 794 };
/** The preview PNG width: 1.5 x the page, the same 144 dpi as the proposal's previews. */
const PREVIEW_WIDTH = 1685;

/** Raster width for SVG figures in --figures=png mode. */
const FIGURE_WIDTH = 2400;

/**
 * Where an SVG figure is placed, chosen by the board it was drawn on (the
 * boards are documented in tools/diagrams/common.py):
 *
 *   1800  the slide board — across the whole text block (1027px, scale 0.57)
 *   1200  the proposal's full board — `fig-<id>` across the text block
 *         (0.86) or `fig-<id>-wide` in the 660px wide column (0.55)
 *    880  the half board — one column of a two-column slide (499px, 0.57)
 *    520  the proposal's column board — `fig-<id>` in the narrow 326px column
 *         (0.63) or `fig-<id>-half` at 499px (0.96)
 *
 * Every scale prints the ladder's smallest step at 6.5pt or more. The chapter
 * file cannot override the width: a landscape drawing put in a narrow column
 * would print its labels at 3pt, and nothing in the page source could report it.
 */
const TEXT_BLOCK = 1027;
const FIGURE_PLACEMENT: Record<number, number> = { 1800: TEXT_BLOCK, 1200: TEXT_BLOCK, 880: 499, 520: 326 };
const FIGURE_VARIANTS: Record<number, { suffix: string; w: number }[]> = {
  1200: [
    { suffix: "-wide", w: 660 },
    { suffix: "-rail", w: 763 },
  ],
  520: [{ suffix: "-half", w: 499 }],
};
/** A figure's template id: the proposal's `부-장-순번` or this deck's `sNN[a-z]`. */
const FIGURE_ID = /^(\d+-\d+-\d+|s\d{2}[a-z]?)/;

/**
 * The boxes a screen capture is fitted into, one template per box. The
 * capture keeps its ratio; the box caps the width and the height so a tall
 * frame never pushes the page's text off the foot.
 */
const SCREEN_BOXES: Record<string, { w: number; h: number }> = {
  full: { w: TEXT_BLOCK, h: 540 },
  side: { w: 640, h: 400 },
  half: { w: 499, h: 520 },
  third: { w: 326, h: 400 },
};

process.chdir(HERE);

const args = process.argv.slice(2);
const force = args.includes("--force");
const wantRender = args.includes("--render")
  || args.some((a) => a === "--pages" || a.startsWith("--pages="));
const figureMode = args.includes("--figures=png") ? "png" : "svg";

/** Every SVG figure the deck may place, with the directory it lives in. */
function svgFiles(): { dir: string; name: string }[] {
  return DIAGRAM_DIRS.filter((d) => existsSync(d)).flatMap((dir) =>
    readdirSync(dir).filter((n) => n.endsWith(".svg")).sort().map((name) => ({ dir, name })),
  );
}

/** Rasterize the SVG figures the deck references. */
async function renderFigures(): Promise<number> {
  await fs.mkdir(FIGURE_DIR, { recursive: true });
  let built = 0;
  for (const { dir, name } of svgFiles()) {
    const src = path.join(dir, name);
    const out = path.join(FIGURE_DIR, name.replace(/\.svg$/, ".png"));
    if (!force && existsSync(out) && statSync(out).mtimeMs >= statSync(src).mtimeMs) continue;
    const resvg = new Resvg(readFileSync(src, "utf8"), {
      fitTo: { mode: "width", value: FIGURE_WIDTH },
      font: {
        fontFiles: FONT_FILES,
        loadSystemFonts: true,
        defaultFontFamily: "Pretendard",
        sansSerifFamily: "Pretendard",
      },
    });
    await fs.writeFile(out, resvg.render().asPng());
    built += 1;
  }
  return built;
}

/**
 * One image template. A slide carries no figure caption — the slide's title and
 * claim say what the picture shows, and a caption under a projected figure is a
 * line nobody reads — so the template is the picture alone, centred in its box.
 */
function figureTemplate(name: string, src: string, boxW: number, w: number, h: number): string {
  return (
    `    <Template name="${name}">\n` +
    `      <VStack w="${boxW}" alignItems="center" flexShrink="0">\n` +
    `        <Image src="${src}" w="${w}" h="${h}" altText="${path.basename(src)}" />\n` +
    `      </VStack>\n` +
    `    </Template>`
  );
}

/**
 * Emit templates/figures.xml — one template per SVG diagram with the placed
 * height computed from the board's ratio. Paths are absolute: <Image src> is
 * read relative to the process directory and the VS Code preview runs from
 * its own, which is why this file is generated and never committed.
 */
async function writeFigureTemplates(): Promise<void> {
  const rows: string[] = [];
  const seen = new Set<string>();
  for (const { dir, name } of svgFiles()) {
    const head = readFileSync(path.join(dir, name), "utf8").slice(0, 2000);
    const m = /<svg[^>]*?width="(\d+(?:\.\d+)?)"[^>]*?height="(\d+(?:\.\d+)?)"/.exec(head);
    if (!m) {
      console.warn(`figures: ${name} — width/height를 읽지 못해 건너뛴다`);
      continue;
    }
    const board = Math.round(Number(m[1]));
    const placed = FIGURE_PLACEMENT[board];
    if (!placed) {
      console.warn(`figures: ${name} — 판 폭 ${board}은 놓을 자리가 없어 건너뛴다`);
      continue;
    }
    const id = FIGURE_ID.exec(name)?.[1];
    if (!id) {
      console.warn(`figures: ${name} — 파일 이름이 부-장-순번도 sNN도 아니어서 건너뛴다`);
      continue;
    }
    if (seen.has(id)) throw new Error(`figures: 도식 아이디 ${id} 가 두 파일에 있다`);
    seen.add(id);
    const ratio = Number(m[2]) / Number(m[1]);
    const src =
      figureMode === "png"
        ? path.join(FIGURE_DIR, name.replace(/\.svg$/, ".png"))
        : path.join(dir, name);
    rows.push(figureTemplate(`fig-${id}`, src, placed, placed, Math.round(placed * ratio)));
    for (const variant of FIGURE_VARIANTS[board] ?? []) {
      rows.push(figureTemplate(`fig-${id}${variant.suffix}`, src, variant.w, variant.w,
        Math.round(variant.w * ratio)));
    }
  }
  const out =
    `<Fragment>\n` +
    `  <!-- 생성 파일 — build.ts가 proposal/diagrams 와 diagrams/ 의 SVG 치수에서 만든다. 직접 고치지 않는다.\n` +
    `       1800·1200판은 본문 폭 ${TEXT_BLOCK}px(1200판은 -wide 660px · -rail 763px도), 880판은 499px,\n` +
    `       520판은 좁은 단 326px(-half는 499px)에 놓인다.\n` +
    `       이번 빌드가 참조한 형식: ${figureMode.toUpperCase()} -->\n` +
    `  <Templates>\n${rows.join("\n\n")}\n  </Templates>\n` +
    `</Fragment>\n`;
  await fs.writeFile(path.join(HERE, "templates", "figures.xml"), out);
  console.log(`figures: templates/figures.xml — 도식 ${rows.length}종`);
}

/**
 * The numbered markers a speaker points at, per capture, read from
 * assets/screens/callouts.json: `{ "<capture id>": [{ n, x, y }, ...] }` with
 * x and y as fractions of the capture, measuring the marker's centre. A
 * capture listed there also gets `-callout` variants of its box templates, so
 * the coordinates survive a re-crop and a chapter file names one template
 * instead of placing shapes by hand.
 */
type Callout = { n: number | string; x: number; y: number };

function readCallouts(): Record<string, Callout[]> {
  const file = path.join(SCREEN_DIR, "callouts.json");
  if (!existsSync(file)) return {};
  const raw = JSON.parse(readFileSync(file, "utf8")) as Record<string, Callout[]>;
  for (const [id, marks] of Object.entries(raw)) {
    for (const m of marks) {
      if (!(m.x >= 0 && m.x <= 1 && m.y >= 0 && m.y <= 1)) {
        throw new Error(`callouts: ${id} 의 마커 ${m.n} 좌표가 0~1 밖이다`);
      }
    }
  }
  return raw;
}

/** The marker itself: an accent disc with the number reversed out. */
const CALLOUT_D = 17;

function calloutTemplate(
  name: string, src: string, boxW: number, w: number, h: number, marks: Callout[],
): string {
  const r = CALLOUT_D / 2;
  const discs = marks.map((m) =>
    `        <Text x="${Math.round(m.x * w - r)}" y="${Math.round(m.y * h - r)}"` +
    ` w="${CALLOUT_D}" h="${CALLOUT_D}" fontFamily="Pretendard" fontSize="10.67"` +
    ` bold="true" color="FFFFFF" backgroundColor="1B4A9C" borderRadius="9"` +
    ` border.color="FFFFFF" border.width="1"` +
    ` textAlign="center" textVAlign="middle" lineHeight="1.0">${m.n}</Text>`,
  ).join("\n");
  return (
    `    <Template name="${name}">\n` +
    `      <VStack w="${boxW}" alignItems="center" flexShrink="0">\n` +
    `        <Layer w="${w}" h="${h}">\n` +
    `          <Image x="0" y="0" src="${src}" w="${w}" h="${h}" altText="${path.basename(src)}" />\n` +
    `${discs.replace(/^ {8}/gm, "          ")}\n` +
    `        </Layer>\n` +
    `      </VStack>\n` +
    `    </Template>`
  );
}

/**
 * Emit templates/screens.xml — for every capture under assets/screens, one
 * template per box in SCREEN_BOXES (`scr-<id>-full` · `-side` · `-half` ·
 * `-third`), the bitmap fitted inside with its ratio kept, plus a `-callout`
 * variant of each box for the captures callouts.json names. The size is read
 * from the PNG header, so a re-cropped capture needs no chapter-file edit.
 */
async function writeScreenTemplates(): Promise<void> {
  const rows: string[] = [];
  const callouts = readCallouts();
  const names = existsSync(SCREEN_DIR)
    ? readdirSync(SCREEN_DIR).filter((n) => n.endsWith(".png")).sort()
    : [];
  for (const name of names) {
    const buf = readFileSync(path.join(SCREEN_DIR, name));
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    const id = name.replace(/\.png$/, "");
    const marks = callouts[id];
    for (const [box, size] of Object.entries(SCREEN_BOXES)) {
      let pw = size.w;
      let ph = pw * (h / w);
      if (ph > size.h) {
        ph = size.h;
        pw = ph * (w / h);
      }
      const src = path.join(SCREEN_DIR, name);
      rows.push(figureTemplate(`scr-${id}-${box}`, src, size.w, Math.round(pw), Math.round(ph)));
      if (marks?.length) {
        rows.push(calloutTemplate(`scr-${id}-${box}-callout`, src, size.w,
          Math.round(pw), Math.round(ph), marks));
      }
    }
  }
  const unknown = Object.keys(callouts)
    .filter((id) => !names.includes(`${id}.png`));
  if (unknown.length) {
    throw new Error(`callouts: assets/screens에 없는 캡처를 가리킨다 — ${unknown.join(", ")}`);
  }
  const boxes = Object.entries(SCREEN_BOXES)
    .map(([k, v]) => `${k} ${v.w}×${v.h}`).join(" · ");
  const out =
    `<Fragment>\n` +
    `  <!-- 생성 파일 — build.ts가 assets/screens의 PNG 치수에서 만든다. 직접 고치지 않는다.\n` +
    `       캡처마다 상자별 템플릿이 하나씩 나온다(${boxes}). -->\n` +
    `  <Templates>\n${rows.join("\n\n")}\n  </Templates>\n` +
    `</Fragment>\n`;
  await fs.writeFile(path.join(HERE, "templates", "screens.xml"), out);
  console.log(`screens: templates/screens.xml — 캡처 ${names.length}장 · 템플릿 ${rows.length}종`);
}

/**
 * The nine 부 colours — the proposal deck's palette, copied so the two decks
 * cannot disagree about a part's colour. One table, two emitted files:
 * templates/parts.xml (styles and the running head's part line) and
 * templates/master.xml (the masters, which carry absolute asset paths).
 */
const BRAND_DIR = path.join(HERE, "assets", "brand");
const MASTHEAD = "<사업명> 제안발표";
const PROJECT_LINES = ["<사업명 앞줄>", "<사업명 뒷줄>"];
const CLIENT = "한국전력공사 ICT운영처 ICT서비스부";

const PARTS: { p: number; label: string; accent: string; deep: string }[] = [
  { p: 0, label: "no 부 — 차례 · 마지막 쪽", accent: "1B4A9C", deep: "0F326F" },
  { p: 1, label: "Ⅰ. 일반현황",             accent: "303792", deep: "21216C" },
  { p: 2, label: "Ⅱ. 제안개요",             accent: "1970B8", deep: "0C4C82" },
  { p: 3, label: "Ⅲ. 전략 및 방법론",        accent: "18A5DF", deep: "1077A1" },
  { p: 4, label: "Ⅳ. 기술 및 기능",          accent: "0E8FCB", deep: "0A6796" },
  { p: 5, label: "Ⅴ. 성능 및 품질",          accent: "00A89E", deep: "007E76" },
  { p: 6, label: "Ⅵ. 프로젝트 관리",         accent: "2AB673", deep: "158353" },
  { p: 7, label: "Ⅶ. 프로젝트 지원",         accent: "168A91", deep: "0E5D62" },
  { p: 8, label: "Ⅷ. 상생협력 및 하도급",     accent: "6E8CA8", deep: "4F6880" },
  { p: 9, label: "Ⅸ. 기타사항",             accent: "7C9FA0", deep: "5F7C7E" },
];

function brand(name: string): string {
  const abs = path.join(BRAND_DIR, name);
  if (!existsSync(abs)) throw new Error(`brand: ${path.relative(HERE, abs)} 가 없다`);
  return abs;
}

/** The head band: full-bleed, the part colour, the deck name reversed out of its deep end. */
const HEAD_H = 36;
/** The foot band: full-bleed, a light neutral; the page passes what stands on it. */
const FOOT_Y = 760;
const FOOT_H = 34;

/** The folio — the slide number at the foot band's right (발표 계획 1절). */
function folioObject(color = "6B7280"): string {
  return (
    `    <SlideNumber x="1027" y="${FOOT_Y + 9}" w="48" h="16"\n` +
    `                 fontFamily="Pretendard" fontSize="10.67" color="${color}" textAlign="right"\n` +
    `                 count="numbered" startAt="1" />`
  );
}

async function writeParts(): Promise<void> {
  const style = (name: string, body: string) => `    <Style name="${name}" ${body} />`;
  const styles = PARTS.map((q) =>
    `    <!-- ${q.label} -->\n` +
    [
      style(`t-p${q.p}`, `color="${q.accent}"`),
      style(`bar-${q.p}`, `backgroundColor="${q.accent}" padding="0 14" h="28" w="max"`),
      style(`mark-${q.p}`, `backgroundColor="${q.accent}" h="2" w="120"`),
      style(`dot-${q.p}`, `backgroundColor="${q.accent}" h="10" w="10" flexShrink="0"`),
      style(`chip-${q.p}`, `backgroundColor="${q.accent}" color="FFFFFF" fontFamily="Pretendard" fontSize="10.67" bold="true" padding="6 8" borderRadius="2"`),
    ].join("\n")).join("\n");

  const branch = (q: { p: number; accent: string }) =>
    `        <When test="p == '${q.p}'"><Text class="runhead-part" w="236" lineHeight="1.0" textVAlign="middle">` +
    `<Span color="B9CBE6">0</Span>${q.p}　{part}</Text></When>`;

  const out =
`<Fragment>
  <!-- 생성 파일 — build.ts의 PARTS 표에서 만든다. 직접 고치지 않는다.

       부 하나에 스타일이 다섯 나온다.
         t-pN   글자 색. 차례의 부 행, 러닝헤드의 숫자.
         bar-N  제목 바의 바탕. 높이 32에 좌우 여백만 두고 세로 가운데는 textVAlign이 맞춘다.
         mark-N 120px 짜리 획.
         dot-N  차례 그룹 행의 10px 표시.
         chip-N 표지 발표 순서의 칩.

       bar-ink · bar-stub · bar-stub-key 는 부와 무관하다. 러닝헤드 첫 줄 partline 은
       폭을 236 으로 고정해 옆의 참조 줄과 메타 칸이 자기 폭을 갖게 한다. -->
  <Styles>
${styles}

${style("bar-ink", 'backgroundColor="14161C" padding="0 14" h="28" w="max"')}
${style("bar-stub", 'backgroundColor="F5F6F8" padding="0 14" h="28" w="180"')}
${style("bar-stub-key", 'backgroundColor="F5F6F8" padding="0 14" h="28" w="240"')}
  </Styles>

  <Templates>
    <Template name="partline">
      <Choose>
${PARTS.filter((q) => q.p > 0).map(branch).join("\n")}
        <Otherwise><Text class="runhead-part" w="236" lineHeight="1.0" textVAlign="middle">{part}</Text></Otherwise>
      </Choose>
    </Template>
  </Templates>
</Fragment>
`;
  await fs.writeFile(path.join(HERE, "templates", "parts.xml"), out);
}

/**
 * Emit templates/master.xml. Nothing on a master names the proposer: the
 * evaluation is blind, so the foot carries the slide number and the client's
 * own CI — the mark of who the deck is addressed to, never of who bids.
 */
async function writeMasters(): Promise<void> {
  const projectBlock = (x: number, y: number, lineH: number, size: number, color: string) =>
    PROJECT_LINES.map(
      (line, i) =>
        `    <MasterText x="${x}" y="${y + i * lineH}" w="440" h="${lineH}" text="${line}"\n` +
        `                fontFamily="Pretendard" fontSize="${size}" bold="true" color="${color}"\n` +
        `                textAlign="right" letterSpacing="-0.015" />`,
    ).join("\n");

  const body = PARTS.filter((q) => q.p > 0).map((q) => `  <!-- ${q.label} -->
  <Master name="BODY-${q.p}" backgroundColor="FFFFFF">
    <MasterRect x="0" y="0" w="1123" h="${HEAD_H}" fill.color="${q.accent}" />
    <MasterRect x="843" y="0" w="280" h="${HEAD_H}" fill.color="${q.deep}" />
    <MasterText x="843" y="11" w="280" h="14" text="${MASTHEAD}"
                fontFamily="Pretendard" fontSize="10.67" bold="true" color="FFFFFF" textAlign="center" />
    <MasterRect x="0" y="${FOOT_Y}" w="1123" h="${FOOT_H}" fill.color="F3F4F6" />
${folioObject(q.accent)}
  </Master>`).join("\n");

  const out = `<Fragment>
  <!-- 생성 파일 — build.ts의 PARTS 표에서 만든다. 직접 고치지 않는다.
       그림 경로가 절대 경로여야 해서 만들어 쓴다(빌드마다 다시 쓴다).

         COVER      브랜드 표지 그림(가로 재단). 쪽 번호를 단다 — 표지가 발표 01쪽이다.
         TOC        브랜드 차례 그림. 쪽 번호가 없다 — 계획의 쪽 번호에 차례는 없다.
         PLAIN      흰 바탕. 마스터를 지정하지 않은 쪽의 기본값.
         END        마지막 쪽 그림. 오른쪽 위 남색 판에 사업명을 흰 글자로 얹는다.
         BODY-1..9  전면 머리 띠(부 색, 오른쪽 끝 짙은 판에 발표 이름), 전면 발치 띠(중립색),
                    발치 띠 오른쪽의 쪽 번호. 본문 모든 쪽. 발표본은 인쇄용이 아니므로 두 띠는
                    여백 없이 재단선까지 간다.

       머리 띠에는 쪽 틀이 부 번호 · 부 이름 · 본 제안서 참조를 흰 글자로 얹고, 발치 띠에는
       평가항목 · 요구사항을 얹는다. 쪽 번호는 count="numbered" 로 번호가 있는 쪽만 센다. -->

  <Master name="COVER" backgroundPath="${brand("cover.png")}">
${folioObject()}
  </Master>

  <Master name="TOC" backgroundPath="${brand("toc.png")}" />

  <Master name="PLAIN" backgroundColor="FFFFFF" />

  <!-- 그림의 남색 판은 x 556~1123 · y 32~413 이다. 흰 글자는 그 안에만 둔다. -->
  <Master name="END" backgroundPath="${brand("end.png")}">
${projectBlock(600, 150, 50, 40, "FFFFFF")}
    <MasterText x="600" y="262" w="440" h="20" text="${CLIENT}"
                fontFamily="Pretendard" fontSize="13" bold="true" color="FFFFFF"
                textAlign="right" />
${folioObject()}
  </Master>

${body}
</Fragment>
`;
  await fs.writeFile(path.join(HERE, "templates", "master.xml"), out);
}

async function writeBrand(): Promise<void> {
  await writeParts();
  await writeMasters();
  console.log(`brand: templates/parts.xml · templates/master.xml — 부 ${PARTS.length - 1}색`);
}

/**
 * Fail the build when a source file's tags do not balance. The builder's
 * parser accepts a close tag that does not match the open one and silently
 * re-shapes the tree; a page can compile, render, and be wrong.
 */
function assertWellFormed(files: string[]): void {
  const TAG = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<(\/?)([A-Za-z][\w.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
  const problems: string[] = [];
  for (const file of files) {
    const code = readFileSync(file, "utf8");
    const stack: { tag: string; line: number }[] = [];
    let m: RegExpExecArray | null;
    TAG.lastIndex = 0;
    while ((m = TAG.exec(code)) !== null) {
      if (m[2] === undefined) continue;
      const [, closing, tag, , selfClosing] = m;
      const line = code.slice(0, m.index).split("\n").length;
      if (selfClosing) continue;
      if (closing) {
        const open = stack.pop();
        if (!open) {
          problems.push(`${path.basename(file)}:${line} — 여는 태그 없이 </${tag}>`);
        } else if (open.tag !== tag) {
          problems.push(`${path.basename(file)}:${line} — <${open.tag}>(${open.line}행)를 </${tag}>로 닫았다`);
        }
      } else {
        stack.push({ tag, line });
      }
    }
    for (const open of stack) {
      problems.push(`${path.basename(file)}:${open.line} — <${open.tag}>가 닫히지 않았다`);
    }
  }
  if (problems.length > 0) {
    throw new Error(["태그가 맞지 않는다:", ...problems.map((p) => `  ${p}`)].join("\n"));
  }
}

/**
 * Source rules the schema cannot express — each a defect that shipped once in
 * the proposal deck and was only caught by eye.
 *
 * 1. KoPub Batang has no U+2014 EM DASH glyph: the character vanishes from a
 *    display slot (cover, page title, contents, closing).
 * 2. justifyContent="spaceBetween" between content-sized siblings renders the
 *    trailing sibling near the middle of the row.
 * 3. The inline format tags take no `class`; the emphasis is simply absent.
 */
function assertSourceRules(files: string[]): void {
  const problems: string[] = [];
  const DISPLAY_TEMPLATES = ["page", "toc", "cover", "closing", "toc-group", "toc-line", "quote"];
  const DISPLAY_CLASSES = ["hero", "hero-sub", "page-title", "toc-part", "toc-row", "quote", "end-mark"];
  const lineOf = (code: string, index: number) => code.slice(0, index).split("\n").length;

  for (const file of files) {
    const code = readFileSync(file, "utf8");
    const base = path.basename(file);

    if (/&#(?:10|x0*a);/i.test(code)) {
      problems.push(`${base} — 숫자 줄바꿈 엔터티는 문자로 출력된다. SlideGlance의 \\n 표기를 사용한다`);
    }

    const useRe = /<Use\s+template="([^"]+)"((?:"[^"]*"|'[^']*'|[^>"'])*?)\/?>/g;
    let m: RegExpExecArray | null;
    while ((m = useRe.exec(code)) !== null) {
      if (!DISPLAY_TEMPLATES.includes(m[1])) continue;
      const attr = /\b(?:title|text|line1|subText)="([^"]*)"/g;
      let a: RegExpExecArray | null;
      while ((a = attr.exec(m[2])) !== null) {
        if (a[1].includes("—")) {
          problems.push(`${base}:${lineOf(code, m.index)} — 표제 서체 자리(${m[1]})에 U+2014(—)가 있다. KoPub Batang에 그 글리프가 없어 조용히 사라진다`);
        }
      }
    }
    const textRe = /<Text\b([^>]*)>([\s\S]*?)<\/Text>/g;
    while ((m = textRe.exec(code)) !== null) {
      const cls = /class="([^"]*)"/.exec(m[1]);
      if (!cls || !DISPLAY_CLASSES.includes(cls[1].split(" ")[0])) continue;
      if (m[2].includes("—")) {
        problems.push(`${base}:${lineOf(code, m.index)} — 표제 서체 글줄(class=${cls[1]})에 U+2014(—)가 있다`);
      }
    }

    const INLINE_FORMAT = ["B", "I", "U", "S", "Mark", "A", "Span"];
    const inlineRe = new RegExp(`<(${INLINE_FORMAT.join("|")})\\b[^>]*\\bclass="([^"]*)"`, "g");
    while ((m = inlineRe.exec(code)) !== null) {
      problems.push(`${base}:${lineOf(code, m.index)} — <${m[1]} class="${m[2]}">의 class는 빌더가 읽지 않는다. color와 <B>로 직접 적는다`);
    }

    const TAG = /<!--[\s\S]*?-->|<(\/?)([A-Za-z][\w.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
    type Open = { tag: string; line: number; spaceBetween: boolean; childHasWidth: boolean };
    const stack: Open[] = [];
    TAG.lastIndex = 0;
    while ((m = TAG.exec(code)) !== null) {
      if (m[2] === undefined) continue;
      const [, closing, tag, attrs, selfClosing] = m;
      const sized = /\b(?:w|flexGrow)="/.test(attrs ?? "");
      if (closing) {
        const open = stack.pop();
        if (open?.spaceBetween && !open.childHasWidth) {
          problems.push(`${base}:${open.line} — spaceBetween의 형제가 전부 내용 크기다. w="max" 하나와 명시 폭으로 정렬한다`);
        }
        continue;
      }
      const parent = stack[stack.length - 1];
      if (parent && sized) parent.childHasWidth = true;
      if (!selfClosing) {
        stack.push({
          tag,
          line: lineOf(code, m.index),
          spaceBetween: /justifyContent="spaceBetween"/.test(attrs ?? ""),
          childHasWidth: false,
        });
      }
    }
  }
  if (problems.length > 0) {
    throw new Error(["소스 규칙 위반:", ...problems.map((p) => `  ${p}`)].join("\n"));
  }
}

const resolveImport: ImportResolver = (src, fromPath) => {
  const baseDir = fromPath ? path.dirname(fromPath) : HERE;
  const absolute = path.resolve(baseDir, src);
  return { content: readFileSync(absolute, "utf8"), path: absolute };
};

/** The checks the build runs before compiling; each fails the build on exit 1. */
const PRE_CHECKS = ["typefloor", "refpages", "coverage"];

/**
 * The Korean audit, run as part of the build.
 *
 * The repository-wide sweep reads `.md` and `.svg` only, so a deck's own
 * sources are audited by naming them — and a check that has to be remembered
 * is a check that gets skipped. One round of this deck reported a clean audit,
 * added a heading afterwards that collided with the glossary, and carried the
 * error to the next review. Reading the paths from the deck declaration keeps
 * the two lists from drifting apart.
 */
const L10N = path.join(
  process.env.HOME ?? "",
  ".claude/skills/simplecore/skills/korean-docs/scripts/l10n.mjs",
);

function auditKorean(): void {
  const declaration = path.join(HERE, "..", ".claude", "slide-decks.json");
  if (!existsSync(declaration) || !existsSync(L10N)) {
    console.log("한국어 감사: 건너뛴다 — 덱 선언 또는 감사 도구가 없다");
    return;
  }
  const raw = readFileSync(declaration, "utf8").replace(/^\s*\/\/.*$/gm, "");
  const decks = (JSON.parse(raw) as { decks: Record<string, any> }).decks ?? {};
  const deck = Object.values(decks).find(
    (d: any) => path.resolve(path.join(HERE, "..", d.dir)) === HERE,
  ) as any;
  const paths: string[] | undefined = deck?.korean?.audit;
  if (!paths?.length) {
    throw new Error("한국어 감사: 덱 선언에 `korean.audit` 이 없다 — 이 검사는 경로를 추측하지 않는다");
  }
  // The declared paths carry shell globs; spawnSync runs no shell, so expand
  // them here rather than handing the audit a literal `*` it cannot open.
  const root = path.join(HERE, "..");
  const files = paths.flatMap((pattern) => {
    if (!pattern.includes("*")) return [pattern];
    const dir = path.dirname(pattern);
    const rule = new RegExp(`^${path.basename(pattern).replace(/[.]/g, "\\.").replace(/[*]/g, ".*")}$`);
    const abs = path.join(root, dir);
    if (!existsSync(abs)) return [];
    return readdirSync(abs).filter((n) => rule.test(n)).sort().map((n) => path.join(dir, n));
  });
  if (!files.length) throw new Error("한국어 감사: 선언한 경로에 파일이 없다");
  const result = spawnSync("node", [L10N, "check", ...files], {
    cwd: path.join(HERE, ".."),
    encoding: "utf8",
    shell: false,
  });
  const out = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  const summary = out.split("\n").filter((l) => l.includes("검사 완료")).pop();
  if (result.status !== 0) {
    throw new Error(`한국어 감사에 오류가 있다\n${out}`);
  }
  console.log(`한국어 감사: ${summary ?? "통과"}`);
}

async function buildDeck(): Promise<void> {
  const entry = path.join(HERE, "main.sgx");
  const sources = [
    entry,
    ...["styles", "templates", "chapters"].flatMap((dir) =>
      readdirSync(path.join(HERE, dir))
        .filter((f) => f.endsWith(".xml"))
        .map((f) => path.join(HERE, dir, f)),
    ),
  ];
  assertWellFormed(sources);
  assertSourceRules(sources);
  for (const check of PRE_CHECKS) {
    const result = spawnSync("python3", [path.join(HERE, "tools", `${check}.py`)], { encoding: "utf8" });
    if (result.stdout) console.log(result.stdout.trim());
    if (result.error || result.status !== 0) {
      throw new Error(result.stderr || result.error?.message || `${check} 검사에 실패했다`);
    }
  }
  auditKorean();
  const xml = await fs.readFile(entry, "utf8");
  const { pptx, diagnostics, lintReport } = await buildPptx(xml, SLIDE_SIZE, {
    textMeasurement: "auto",
    resolveImport,
    sourcePath: entry,
    trackSourcePos: true,
    equalize: false,
    lint: {
      enabled: true,
      ruleset: "recommended",
      overrides: {
        // False positive for a local-path <Image>: the builder fills its data
        // cache for http(s) only and embeds a file path at write time.
        IMAGE_MISSING: "off",
      },
    },
  });

  for (const d of diagnostics) {
    // A post-layout diagnostic carries no source position; its nodeId and
    // measured context are the only handle on the offending element.
    const at = d.sourcePos?.line
      ? ` ${path.relative(HERE, d.sourcePos.file ?? "")}:${d.sourcePos.line}`
      : d.nodeId
        ? ` @ ${d.nodeId}`
        : "";
    const ctx = d.context ? ` ${JSON.stringify(d.context)}` : "";
    console.log(`  [${d.severity ?? "warn"}] ${d.code}${at} — ${d.message}${ctx}`);
  }
  if (lintReport) {
    const s = lintReport.summary;
    console.log(`lint: error ${s.error} · warn ${s.warn} · info ${s.info}`);
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  const raw = (await pptx.write({ outputType: "uint8array" })) as Uint8Array;
  const bytes = await withShapeAutoFit(raw);
  await fs.writeFile(PPTX_PATH, bytes);
  console.log(`pptx: ${path.relative(HERE, PPTX_PATH)} (${(bytes.byteLength / 1024).toFixed(0)} KB)`);
}

/**
 * Post-process the OOXML the way the proposal deck does: zero the master
 * text insets, turn on 「도형을 텍스트 크기에 맞춤」 for every text box, drop
 * the builder's invisible hit-area rectangles, renumber shape ids, move
 * <p:notesMasterIdLst> to its schema position, and collapse repeated
 * paragraph properties. Every one of these is a PowerPoint repair prompt or
 * an editing defect that shipped once.
 */
async function withShapeAutoFit(bytes: Uint8Array): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(bytes);

  for (const name of Object.keys(zip.files).filter((n) => /^ppt\/slide(Layouts|Masters)\/[^/]+\.xml$/.test(n))) {
    const xml = await zip.file(name)!.async("string");
    const patched = xml.replace(
      /<a:bodyPr([^>]*?)(\/?)>/g,
      (tag, attrs: string, selfClose: string) =>
        attrs.includes("lIns") ? tag : `<a:bodyPr${attrs} lIns="0" tIns="0" rIns="0" bIns="0"${selfClose}>`,
    );
    if (patched !== xml) zip.file(name, patched);
  }

  const slides = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
  slides.sort((a, b) => Number(/(\d+)/.exec(a)![1]) - Number(/(\d+)/.exec(b)![1]));

  for (const name of slides) {
    const xml = await zip.file(name)!.async("string");
    const patched = xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g, (sp) => {
      if (!/<a:t>[^<]*[^\s<][^<]*<\/a:t>/.test(sp)) return sp;
      if (sp.includes("<a:spAutoFit/>")) return sp;
      return sp
        .replace(/<a:bodyPr([^>]*)\/>/, "<a:bodyPr$1><a:spAutoFit/></a:bodyPr>")
        .replace(/<a:bodyPr([^>]*[^/])><\/a:bodyPr>/, "<a:bodyPr$1><a:spAutoFit/></a:bodyPr>");
    });
    zip.file(name, patched);
  }
  for (const name of slides) {
    const xml = await zip.file(name)!.async("string");
    const patched = xml.replace(
      /<p:sp>(?:(?!<\/p:sp>).)*?<a:solidFill><a:srgbClr val="FFFFFF"><a:alpha val="0"\/><\/a:srgbClr><\/a:solidFill><a:ln><\/a:ln><\/p:spPr><\/p:sp>/gs,
      "",
    );
    if (patched !== xml) zip.file(name, patched);
  }
  for (const name of Object.keys(zip.files).filter((n) =>
    /^ppt\/(slides|slideLayouts|slideMasters|notesSlides)\/[^/]+\.xml$/.test(n),
  )) {
    const xml = await zip.file(name)!.async("string");
    let next = 1;
    const patched = xml.replace(/<p:cNvPr\s+id="\d+"/g, () => `<p:cNvPr id="${next++}"`);
    if (patched !== xml) zip.file(name, patched);
  }
  {
    const name = "ppt/presentation.xml";
    const file = zip.file(name);
    if (file) {
      const xml = await file.async("string");
      const m = xml.match(/<p:notesMasterIdLst>[\s\S]*?<\/p:notesMasterIdLst>/);
      if (m && !/<\/p:sldMasterIdLst><p:notesMasterIdLst>/.test(xml)) {
        const moved = xml.replace(m[0], "").replace("</p:sldMasterIdLst>", `</p:sldMasterIdLst>${m[0]}`);
        zip.file(name, moved);
      }
    }
  }
  for (const name of slides) {
    const xml = await zip.file(name)!.async("string");
    const patched = xml.replace(/<a:p>[\s\S]*?<\/a:p>/g, (para) => {
      const pPr = para.match(/<a:pPr(?:[^>"']|"[^"]*"|'[^']*')*?(?:\/>|>[\s\S]*?<\/a:pPr>)/g);
      if (!pPr || (pPr.length === 1 && para.startsWith(`<a:p>${pPr[0]}`))) return para;
      const rest = pPr.reduce((acc, one) => acc.replace(one, ""), para);
      return rest.replace("<a:p>", `<a:p>${pPr[0]}`);
    });
    if (patched !== xml) zip.file(name, patched);
  }
  return (await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" })) as Uint8Array;
}

/** Render every slide to PNG so the layout can be reviewed by eye. */
/**
 * The pages a `--render` should draw, from `--pages 12,16,86-90`.
 *
 * A full render of a long deck costs minutes, and most of the time the reason
 * to look is one page that just changed. The renderer takes `--slide N` and
 * `--range LO-HI`; this parses the deck-side spec and hands them over.
 *
 * A partial render leaves every other PNG as it was, so it is for looking at a
 * page, never for the checks that measure the rendered images. Run the full
 * render before those.
 */
function pageSelection(): string[] {
  const flag = args.find((a) => a.startsWith("--pages="))
    ?? (args.includes("--pages") ? args[args.indexOf("--pages") + 1] : undefined);
  const spec = flag?.startsWith("--pages=") ? flag.slice("--pages=".length) : flag;
  if (!spec) return [];
  const argv: string[] = [];
  for (const part of spec.split(",").map((s) => s.trim()).filter(Boolean)) {
    const range = /^(\d+)\s*-\s*(\d+)$/.exec(part);
    if (range) argv.push("--range", `${range[1]}-${range[2]}`);
    else if (/^\d+$/.test(part)) argv.push("--slide", part);
    else throw new Error(`--pages: 「${part}」 를 쪽 번호나 범위로 읽지 못했다`);
  }
  return argv;
}

function renderPreview(): void {
  const cli = process.env.SLIDEGLANCE_CLI ?? "slideglance";
  const pngDir = path.join(OUT_DIR, "png");
  const found = FONT_FILES.filter((p) => existsSync(p));
  for (const f of FONT_FILES) {
    if (!found.includes(f)) {
      console.error(`render: 글꼴이 없어 해당 글자가 미리보기에서 빠진다 — ${path.relative(HERE, f)}`);
    }
  }
  const argv = ["convert", PPTX_PATH, "--output", pngDir, "--format", "png", "--width", String(PREVIEW_WIDTH)];
  for (const f of found) argv.push("--font", f);
  const pages = pageSelection();
  argv.push(...pages);
  const r = spawnSync(cli, argv, { encoding: "utf8" });
  if (r.error) {
    console.error(`render: ${cli} 실행에 실패했다. slideglance CLI 경로를 SLIDEGLANCE_CLI로 지정한다.`);
    process.exitCode = 1;
    return;
  }
  if (r.stderr?.trim()) console.error(r.stderr.trim());
  console.log(`render: ${path.relative(HERE, pngDir)}/`);
}

async function main(): Promise<void> {
  if (figureMode === "png") await renderFigures();
  await writeFigureTemplates();
  await writeScreenTemplates();
  await writeBrand();
  await buildDeck();
  if (wantRender) renderPreview();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
