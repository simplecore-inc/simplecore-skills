// Build the proposal .pptx from pptx/main.sgx.
//
//   1. rasterize every proposal/diagrams/*.svg into assets/figures/*.png
//   2. compile main.sgx -> out/제안서.pptx with lint enabled
//   3. (--render) render every page to out/png/ for visual review
//
// Figures go in as vector by default: <Image src="....svg"> makes pptxgenjs
// emit an `asvg:svgBlip`, so PowerPoint 2019+ draws the real vector and the
// picture stays sharp at any zoom. The SVG referenced is the one under
// proposal/diagrams — nothing is transformed, so a diagram is edited in one
// place and the deck picks the edit up on the next build.
//
// Two things this costs, both verified:
//   · The SVG keeps its <text> elements, so the viewer's own fonts draw the
//     labels. The generator's font stack names no Hangul family, so Korean
//     falls back per machine and the label metrics shift.
//   · slideglance's CLI (and the VS Code preview) rasterize an embedded SVG
//     without a font database, so the page previews show the boxes and
//     arrows with no labels. The .pptx is unaffected.
//
// `--figures=png` rasterizes instead, with the system fonts attached: the
// labels are then baked in and identical everywhere, at 1800 px across the
// text block (about 250 dpi in print).
//
//   npm run build                    # figures as SVG + pptx
//   npm run render                   # the above + page PNGs
//   npm run build -- --figures=png   # rasterize the figures instead
//   npm run build -- --figures=png --force

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
const DIAGRAM_DIR = path.resolve(HERE, "..", "proposal", "diagrams");
const FIGURE_DIR = path.join(HERE, "assets", "figures");
/** The implementation-case captures of the running Workbench, placed like full-board diagrams. */
const CASE_DIR = path.resolve(HERE, "..", "proposal", "screenshots", "workbench-cases");
const STANDARD_BOARD = 1200;
const OUT_DIR = path.join(HERE, "out");
const PPTX_PATH = path.join(OUT_DIR, "제안서.pptx");

/**
 * The fonts the deck is set in, carried in the repository instead of taken
 * from the machine. A preview rendered on one checkout and one rendered on
 * another have to break their lines in the same places, and a system font
 * database differs per machine.
 *
 * KoPub Batang and Pretendard are the two families styles/typography.xml
 * names. The mono pair backs the diagrams' MONO stack — its only Hangul
 * families — without which the CLI drops those labels.
 */
const FONT_DIR = path.join(HERE, "fonts");
const FONT_FILES = [
  "Pretendard-Regular.otf",
  "Pretendard-Bold.otf",
  "Pretendard-SemiBold.otf",
  "KoPubBatang-Bold.ttf",
  "KoPubBatang-Light.ttf",
  "NotoSansMonoCJKkr-Regular.otf",
  "NotoSansMonoCJKkr-Bold.otf",
  "D2Coding-Ver1.3.2-20180524-all.ttc",
].map((name) => path.join(FONT_DIR, name));

/** A4 portrait at 96 dpi — 210 x 297 mm. Matches <Document size="A4">. */
const SLIDE_SIZE = { w: 794, h: 1123 };

/** Raster width for figures. 1800 px across a 184 mm text block is ~248 dpi. */
const FIGURE_WIDTH = 1800;

/**
 * Where a figure is placed, chosen by the board it was drawn on.
 *
 * A 1200-unit board goes across the whole text block; a 520-unit board goes in
 * a column beside body text (`fig-col-left` / `fig-col-right` in
 * templates/page.xml). Both ratios are about 0.57, so the smallest label on
 * `tools/diagrams/common.py`'s ladder prints at roughly 6.5pt either way and
 * two figures on facing pages read at the same size.
 *
 * The board decides the slot, not the chapter file: a landscape drawing put in
 * a column would print its labels at 3pt, and nothing in the page source could
 * report that.
 */
const FIGURE_PLACEMENT: Record<number, number> = { 1200: 682, 520: 300 };
/**
 * How a capture is sized. The captures are taken at two device pixels per dp,
 * so half the pixel width is the window's own size; a capture is placed at
 * 0.9 of that so it never reads larger than the application, fitted to the
 * text block where that would overflow it, and never taller than a whole
 * window placed across the text block — a tall crop shrinks to that height
 * rather than pushing the page's text off the foot.
 */
const CAPTURE_DPR = 2;
const CAPTURE_SCALE = 0.9;
const CAPTURE_MAX_H = 390;

/**
 * The column board's second placement: two figures side by side, 327 + 28 +
 * 327 = 682. Only the column board gets it — 1200 units at 327px would print
 * the smallest label at 3pt. The ratio here is 0.63 against the single
 * placement's 0.58, so the pair prints at about 7.1pt where a lone column
 * figure prints at 6.5pt; both sit inside the band the page can carry, and a
 * pair is read as a pair rather than against the page's other figures.
 */
const COLUMN_PAIR_W = 327;

/** The column board, in drawing units. Mirrors COLUMN_WIDTH in common.py. */
const COLUMN_WIDTH_UNITS = 520;

/** The full text block. */
const FIGURE_INNER_W = 682;


// <Image src> is read with fs.readFileSync relative to the process
// directory, so the deck can use paths relative to pptx/ regardless of
// where npm was invoked from.
process.chdir(HERE);

const args = process.argv.slice(2);
const force = args.includes("--force");
const wantRender = args.includes("--render");
const figureMode = args.includes("--figures=png") ? "png" : "svg";

/** Rasterize the SVG diagrams that the deck references. */
async function renderFigures(): Promise<number> {
  await fs.mkdir(FIGURE_DIR, { recursive: true });
  const names = (await fs.readdir(DIAGRAM_DIR)).filter((n) => n.endsWith(".svg"));
  let built = 0;

  for (const name of names) {
    const src = path.join(DIAGRAM_DIR, name);
    const out = path.join(FIGURE_DIR, name.replace(/\.svg$/, ".png"));
    if (!force && existsSync(out) && statSync(out).mtimeMs >= statSync(src).mtimeMs) {
      continue;
    }
    const svg = readFileSync(src, "utf8");
    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: FIGURE_WIDTH },
      font: {
        // The repository's copies first. System fonts stay on as a fallback
        // so a glyph outside these eight still finds a face.
        fontFiles: FONT_FILES,
        loadSystemFonts: true,
        defaultFontFamily: "Pretendard",
        sansSerifFamily: "Pretendard",
        monospaceFamily: "D2Coding",
      },
    });
    await fs.writeFile(out, resvg.render().asPng());
    built += 1;
  }
  console.log(
    `figures: ${names.length}개 중 ${built}개 생성 (폭 ${FIGURE_WIDTH}px)`,
  );
  return built;
}


/**
 * Emit templates/figures.xml — one template per diagram, with the placed
 * height already computed.
 *
 * <Image> measures the bitmap's natural size and Yoga then applies `w`
 * alone, so a width without a matching height stretches the picture. The
 * ratio lives in the SVG, so it is read here rather than copied into a
 * chapter file by hand. Every diagram is placed at one width — the full
 * text block — so each has exactly one height.
 */
async function writeFigureTemplates(): Promise<void> {
  const names = (await fs.readdir(DIAGRAM_DIR)).filter((n) => n.endsWith(".svg")).sort();
  const rows: string[] = [];

  for (const name of names) {
    const head = readFileSync(path.join(DIAGRAM_DIR, name), "utf8").slice(0, 2000);
    const m = /<svg[^>]*?width="(\d+(?:\.\d+)?)"[^>]*?height="(\d+(?:\.\d+)?)"/.exec(head);
    if (!m) {
      console.warn(`figures: ${name} — width/height를 읽지 못해 건너뛴다`);
      continue;
    }
    const board = Math.round(Number(m[1]));
    const placed = FIGURE_PLACEMENT[board];
    if (!placed) {
      console.warn(
        `figures: ${name} — 판 폭 ${board}은 놓을 자리가 없어 건너뛴다 ` +
        `(${Object.keys(FIGURE_PLACEMENT).join(" 또는 ")})`,
      );
      continue;
    }
    const ratio = Number(m[2]) / Number(m[1]);
    const h = Math.round(placed * ratio);
    const id = /^(\d+-\d+-\d+)/.exec(name)?.[1];
    if (!id) continue;
    // Absolute: <Image src> is read relative to the process directory, and
    // the VS Code preview runs from its own. figures.xml is generated, so an
    // absolute path never reaches the repository.
    const src =
      figureMode === "png"
        ? path.join(FIGURE_DIR, name.replace(/\.svg$/, ".png"))
        : path.join(DIAGRAM_DIR, name);
    rows.push(
      `    <Template name="fig-${id}" form="figure" tags="generated,figure"\n` +
      `             doc="the drawn figure ${id} at its board's placed width, with a numbered caption"\n` +
      `             use="in a page slot; not cap-${id}, which places a screen capture">\n` +
      `      <VStack gap="6" w="${placed}" flexShrink="0">\n` +
      `        <Image src="${src}" w="${placed}" h="${h}" altText="{caption}" />\n` +
      // The caption sits under a figure that spans the whole text block, so it
      // centres under the picture rather than starting at the left margin.
      // The figure number and the caption are one centred line, so they are
      // one <Text> with an inline <Span> for the number. Two texts in an
      // HStack cannot do this: giving both `flexBasis="max"` makes each
      // measure at its natural width and both report OUT_OF_PARENT the
      // moment the page is tight, and giving one `w="max"` starves the
      // other (behaviour 7). A single Text has neither failure mode.
      `        <Text class="caption" flexShrink="0" textAlign="center" lineHeight="1.2">` +
      `<Span color="1B4A9C"><B>{no}</B></Span>　{caption}</Text>\n` +
      `      </VStack>\n` +
      `    </Template>`,
    );

    // The column board's pair placement. Emitted for every column figure, so
    // the same drawing can stand alone or beside its counterpart without
    // being redrawn.
    if (board === COLUMN_WIDTH_UNITS) {
      const ph = Math.round(COLUMN_PAIR_W * ratio);
      rows.push(
        `    <Template name="fig-${id}-pair" form="figure" tags="generated,figure,column"\n` +
        `             doc="the drawn figure ${id} at the paired-column width"\n` +
        `             use="in a column of a two-column page; not fig-${id}, which spans the text block">\n` +
        `      <VStack gap="6" w="${COLUMN_PAIR_W}" flexShrink="0">\n` +
        `        <Image src="${src}" w="${COLUMN_PAIR_W}" h="${ph}" altText="{caption}" />\n` +
        `        <Text class="caption" flexShrink="0" textAlign="center" lineHeight="1.2">` +
        `<Span color="1B4A9C"><B>{no}</B></Span>　{caption}</Text>\n` +
        `      </VStack>\n` +
        `    </Template>`,
      );
    }
  }

  // The implementation-case captures: PNGs of the running Workbench, placed
  // across the whole text block like a full-board diagram. The size is read
  // from the PNG header, so a re-cropped capture needs no chapter-file edit.
  const captures = (await fs.readdir(CASE_DIR)).filter((n) => /^wc-\d+-.*\.png$/.test(n)).sort();
  for (const name of captures) {
    const buf = readFileSync(path.join(CASE_DIR, name));
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    const id = /^(wc-\d+)/.exec(name)![1];
    const block = FIGURE_PLACEMENT[STANDARD_BOARD];
    let pw = Math.min(block, (w / CAPTURE_DPR) * CAPTURE_SCALE);
    let ph = pw * (h / w);
    if (ph > CAPTURE_MAX_H) {
      ph = CAPTURE_MAX_H;
      pw = ph * (w / h);
    }
    pw = Math.round(pw);
    ph = Math.round(ph);
    rows.push(
      `    <Template name="cap-${id}" form="figure" tags="generated,capture"\n` +
      `             doc="the screen capture ${id}, centred with a numbered caption"\n` +
      `             use="in a page slot; not fig-${id}, which places a drawn figure">\n` +
      `      <VStack gap="6" w="${block}" alignItems="center" flexShrink="0">\n` +
      `        <Image src="${path.join(CASE_DIR, name)}" w="${pw}" h="${ph}" altText="{caption}" />\n` +
      `        <Text class="caption" flexShrink="0" textAlign="center" lineHeight="1.2">` +
      `<Span color="1B4A9C"><B>{no}</B></Span>　{caption}</Text>\n` +
      `      </VStack>\n` +
      `    </Template>`,
    );
  }

  const out =
    `<Fragment>\n` +
    `  <!-- 생성 파일 — build.ts가 proposal/diagrams의 SVG 치수에서 만든다. 직접 고치지 않는다.\n` +
    `       도식은 그린 판에 따라 자리가 하나로 정해지므로(1200판→본문 폭 682px,\n` +
    `       520판→단 폭 300px) 도식마다 높이도 하나로 정해진다.\n` +
    `       이번 빌드가 참조한 형식: ${figureMode.toUpperCase()} -->\n` +
    `  <Templates>\n${rows.join("\n\n")}\n  </Templates>\n` +
    `</Fragment>\n`;
  await fs.writeFile(path.join(HERE, "templates", "figures.xml"), out);
  console.log(
    `figures: templates/figures.xml — 도식 ${rows.length}종 (${figureMode.toUpperCase()})`,
  );
}


/**
 * The nine 부 colours, and everything generated from them.
 *
 * One table, two emitted files. The colour of a 부 shows up in three places —
 * the masthead band on its body pages, the section bars inside them, and the
 * divider that opens it — and a palette written out three times drifts. It is
 * written here, and `styles/parts.xml` and `templates/master.xml` come out of
 * it.
 *
 * `deep` is the same hue taken down about a third. It backs the masthead's
 * right end so the white project name separates from the band without a rule
 * and without a second hue.
 *
 * Index 0 is "no 부": the third contents page, every 별첨 page. It resolves to
 * the document's own navy, the same one the inline accent uses.
 *
 * The masters are generated rather than written by hand for one reason: they
 * reference images, and a relative <MasterImage src> is read against the
 * process directory. The VS Code preview runs from its own, so a committed
 * relative path fails there with "Unable to read media". Absolute paths cannot
 * be committed, so the file that carries them is produced at build time — the
 * same reason templates/figures.xml is generated.
 */
const BRAND_DIR = path.join(HERE, "assets", "brand");
const MASTHEAD = "<사업명> 제안서";

/** The project name, broken where the display slots break it. */
const PROJECT_LINES = ["<사업명 앞줄>", "<사업명 뒷줄>"];
/** The ordering department, as the RFP cover names it. */
const CLIENT = "한국전력공사 ICT운영처 ICT서비스부";

const PARTS: { p: number; label: string; accent: string; deep: string }[] = [
  { p: 0, label: "no 부 — 차례 3/3 · 별첨", accent: "1B4A9C", deep: "0F326F" },
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

/** Absolute path to a brand asset, and a hard failure if it is missing. */
function brand(name: string): string {
  const abs = path.join(BRAND_DIR, name);
  if (!existsSync(abs)) throw new Error(`brand: ${path.relative(HERE, abs)} 가 없다`);
  return abs;
}

/** The folio block — "- n -" (RFP 유의사항 12), identical on BODY and PART. */
function folioObjects(dashY: number, numY: number): string {
  return (
    `    <MasterText x="369" y="${dashY}" w="12" h="16" text="-"\n` +
    `                fontFamily="Pretendard" fontSize="10.67" color="6B7280" textAlign="right" />\n` +
    `    <SlideNumber x="374" y="${numY}" w="46" h="16"\n` +
    `                 fontFamily="Pretendard" fontSize="10.67" color="6B7280" textAlign="center"\n` +
    `                 count="numbered" startAt="1" />\n` +
    `    <MasterText x="413" y="${dashY}" w="12" h="16" text="-"\n` +
    `                fontFamily="Pretendard" fontSize="10.67" color="6B7280" textAlign="left" />`
  );
}

/**
 * Emit templates/parts.xml — everything a 부's colour is used for that a
 * chapter file must be able to reach by index alone.
 *
 * Styles: `t-pN` (text colour), `bar-N` (section-bar fill) and `mark-N` (the
 * divider's stroke). A `<Text class="bar-{p} bar-text">` picks its 부 up from
 * the index the page passed and nothing else.
 *
 * One template: `partline`, the running head's first row. It has to be here
 * because the row is one text with two colours in it — a light zero, then the
 * numeral in the 부's colour — and `<Span>` reads a hex, not a class. Written
 * as three boxes instead, the numerals wander: an HStack shares its width out
 * among children that declare none.
 */
async function writeParts(): Promise<void> {
  const style = (name: string, body: string) => `    <Style name="${name}" ${body} />`;
  const styles = PARTS.map((q) =>
    `    <!-- ${q.label} -->\n` +
    [
      style(`t-p${q.p}`, `color="${q.accent}"`),
      style(`bar-${q.p}`, `backgroundColor="${q.accent}" padding="0 16" h="32" w="max"`),
      style(`mark-${q.p}`, `backgroundColor="${q.accent}" h="2" w="120"`),
    ].join("\n")).join("\n");

  const branch = (q: { p: number; accent: string }) =>
    `        <When test="p == '${q.p}'"><Text class="runhead-part" w="max" textVAlign="middle">` +
    `<Span color="DCDDDC">0</Span><Span color="${q.accent}">${q.p}</Span>　{part}</Text></When>`;

  const out =
`<Fragment>
  <!-- 생성 파일 — build.ts의 PARTS 표에서 만든다. 직접 고치지 않는다.

       부 하나에 스타일이 셋 나온다.
         t-pN   글자 색. 간지의 로마 숫자·제목, 차례의 부 행, 간지 발치의 장 이름.
         bar-N  제목 바의 바탕. 높이 32에 좌우 여백만 두고, 세로 가운데는
                textVAlign 이 맞춘다 — 옆 칸과 높이가 같아야 하는데 글자 크기가
                다르기 때문이다.
         mark-N 간지의 표시. 부 이름 밑 120px 짜리 획이다.

       bar-ink 와 bar-stub 은 부와 무관하다 — 한 쪽에 하나만 쓰는 역상 바와,
       모든 바의 오른쪽에 붙는 중립색 칸이다. bar-stub-key 는 핵심 문구와
       요구사항 번호를 두 줄로 담는 칸이라 200 이 아니라 264 다 — 두 줄 모두
       한 줄로 서야 32px 안에 들어간다.

       partline 은 러닝헤드 첫 줄이다. 「0」은 옅은 회색, 뒤 숫자는 부 색, 그다음이
       부 이름이며 셋이 한 글줄이어야 한다. <Span>은 class 를 읽지 않고 색만
       읽으므로 부마다 가지를 하나씩 둔다. -->
  <Styles>
${styles}

${style("bar-ink", 'backgroundColor="14161C" padding="0 16" h="32" w="max"')}
${style("bar-stub", 'backgroundColor="F5F6F8" padding="0 16" h="32" w="200"')}
${style("bar-stub-key", 'backgroundColor="F5F6F8" padding="0 16" h="32" w="264"')}
  </Styles>

  <Templates>
    <Template name="partline"
              form="row" tags="generated,runhead"
              doc="the running head's part line: the leading zero, the part numeral in that part's colour, and its name"
              use="in the page template's head panel; not a heading - it names where the reader is, not what the page says">
      <Choose>
${PARTS.filter((q) => q.p > 0).map(branch).join("\n")}
        <Otherwise><Text class="runhead-part" w="max" textVAlign="middle">{part}</Text></Otherwise>
      </Choose>
    </Template>
  </Templates>
</Fragment>
`;
  await fs.writeFile(path.join(HERE, "templates", "parts.xml"), out);
}

/**
 * Emit templates/master.xml — every master, with absolute asset paths.
 *
 * Nothing on a master names the proposer. The evaluation is blind (제안요청서
 * Ⅳ-5): a proposer name, a logo or a mark on a master is one point off the
 * total score and it would be on every page at once. The client's own CI is a
 * different thing and belongs here — it says who the document is addressed to.
 * Place it once per master family at a fixed coordinate and keep the rest of
 * the foot (the folio) where it is.
 */
async function writeMasters(): Promise<void> {
  const projectBlock = (
    x: number,
    y: number,
    lineH: number,
    size: number,
    color: string,
  ) =>
    PROJECT_LINES.map(
      (line, i) =>
        `    <MasterText x="${x}" y="${y + i * lineH}" w="300" h="${lineH}" text="${line}"\n` +
        `                fontFamily="Pretendard" fontSize="${size}" bold="true" color="${color}"\n` +
        `                textAlign="right" letterSpacing="-0.015" />`,
    ).join("\n");

  const body = PARTS.filter((q) => q.p > 0).map((q) => `  <!-- ${q.label} -->
  <Master name="BODY-${q.p}" backgroundColor="FFFFFF">
    <MasterRect x="56" y="45" w="680" h="18" fill.color="${q.accent}" />
    <MasterRect x="540" y="45" w="196" h="18" fill.color="${q.deep}" />
    <MasterText x="540" y="45" w="196" h="18" text="${MASTHEAD}"
                fontFamily="Pretendard" fontSize="10.67" bold="true" color="FFFFFF" textAlign="center" />
    <MasterRect x="56" y="63" w="680" h="53" fill.color="F6F6F6" />
${folioObjects(1077, 1081)}
  </Master>`).join("\n");

  const part = PARTS.filter((q) => q.p > 0).map((q) => `  <!-- ${q.label} -->
  <Master name="PART-${q.p}" backgroundColor="FFFFFF">
    <MasterRect x="106" y="147" w="416" h="4" fill.color="${q.accent}" />
    <MasterText x="436" y="94" w="300" h="14" text="${CLIENT}"
                fontFamily="Pretendard" fontSize="10.67" bold="true" color="${q.accent}"
                textAlign="right" letterSpacing="-0.015" />
${projectBlock(436, 119, 28, 21.5, q.accent)}
${folioObjects(1062, 1066)}
    <MasterRect x="0" y="1096" w="794" h="26" fill.color="${q.accent}" />
  </Master>`).join("\n");

  const out = `<Fragment>
  <!-- 생성 파일 — build.ts의 PARTS 표에서 만든다. 직접 고치지 않는다.
       그림 경로가 절대 경로여야 해서 만들어 쓴다(빌드마다 다시 쓴다).

       마스터는 아홉 갈래이고, 본문과 간지는 부마다 하나씩이다 — 쪽 테두리가
       부 색을 들기 때문이다.

         COVER-ART  브랜드 그림 전면. 테두리도 쪽 번호도 없다 — 표지는 쪽수에
                    넣지 않는다(유의사항 14). 제안사 표장을 얹지 않는다 —
                    평가는 블라인드다.
         COVER      서식 1 표지. 머리와 발치에 남색 띠를 깔고, 발치 띠가
                    제안사·제출일 묶음을 흰 글자로 받는 바탕이 된다.
         TOC-A/B    차례 두 쪽. 브랜드 그림이 왼쪽 가장자리(A)와 오른쪽(B)에
                    도형을 두므로 「toc」 템플릿이 글 상자를 빈 쪽으로 옮긴다.
                    차례도 쪽수에 넣지 않는다.
         PLAIN      머리 띠만 있고 쪽 번호가 없다. 차례 3/3, 별첨 간지와 색인
                    (부록자료는 쪽수에서 빠진다, 유의사항 13).
         ANNEX      PLAIN 에 러닝헤드 판을 더한 것. 별첨 본문 쪽은 본문과 같은
                    머리를 쓰므로 같은 바탕이 있어야 한다.
         END        마지막 쪽의 그림.
         BODY-1..9  머리 띠, 러닝헤드 판, 쪽 번호. 본문 모든 쪽. 발치에는
                    쪽 번호만 둔다 — 제안사명도 표장도 넣지 않는다.
         PART-1..9  사업명 묶음과 그 왼쪽 획, 발치 전면 띠, 쪽 번호. 부 간지는
                    쪽수에 넣는다.

       머리 띠는 사업명만 싣는다. 그 아래 러닝헤드가 이미 부·장·쪽을 적으므로
       오른쪽에 항목을 추가하면 러닝헤드의 정보와 중복된다.

       y=63 의 회색 판이 러닝헤드의 바탕이다. 본문 쪽에 평가항목·요구사항을
       가두는 상자도 그 아래 괘선도 없는 까닭이 이것이다 — 판이 이미 둘 다
       가둔다.

       쪽 번호는 「- n -」 형식이다(유의사항 12). <SlideNumber>는 숫자만 내므로
       줄표를 양쪽에 따로 놓는다.

       count="numbered" 는 쪽 번호가 붙는 쪽만 세어 1부터 매긴다. 표지·차례와
       별첨은 쪽수에서 빠지므로(유의사항 13·14) 슬라이드 위치를 그대로 쓰면
       첫 본문 쪽이 6을 찍는다. 이 값으로 세면 파워포인트와 미리보기가 같은
       번호를 낸다. -->

  <Master name="COVER-ART" backgroundPath="${brand("cover.png")}" />

  <Master name="COVER" backgroundColor="FFFFFF">
    <MasterRect x="0" y="0" w="794" h="23" fill.color="1B4A9C" />
    <MasterRect x="0" y="956" w="794" h="167" fill.color="1B4A9C" />
  </Master>

  <Master name="TOC-A" backgroundPath="${brand("toc-left.png")}" />
  <Master name="TOC-B" backgroundPath="${brand("toc-right.png")}" />

  <Master name="PLAIN" backgroundColor="FFFFFF">
    <MasterRect x="56" y="45" w="680" h="18" fill.color="1B4A9C" />
    <MasterRect x="540" y="45" w="196" h="18" fill.color="0F326F" />
    <MasterText x="540" y="45" w="196" h="18" text="${MASTHEAD}"
                fontFamily="Pretendard" fontSize="10.67" bold="true" color="FFFFFF" textAlign="center" />
  </Master>

  <Master name="ANNEX" backgroundColor="FFFFFF">
    <MasterRect x="56" y="45" w="680" h="18" fill.color="1B4A9C" />
    <MasterRect x="540" y="45" w="196" h="18" fill.color="0F326F" />
    <MasterText x="540" y="45" w="196" h="18" text="${MASTHEAD}"
                fontFamily="Pretendard" fontSize="10.67" bold="true" color="FFFFFF" textAlign="center" />
    <MasterRect x="56" y="63" w="680" h="53" fill.color="F6F6F6" />
  </Master>

  <!-- 그림의 남색 판은 x 395~793 · y 336~627 이다. 흰 글자는 그 안에만 둔다 —
       판 밖은 옅은 청회색이라 흰 글자가 묻힌다. -->
  <Master name="END" backgroundPath="${brand("end.png")}">
${projectBlock(336, 390, 50, 40, "FFFFFF")}
    <MasterText x="336" y="512" w="400" h="20" text="${CLIENT}"
                fontFamily="Pretendard" fontSize="13" bold="true" color="FFFFFF"
                textAlign="right" />
  </Master>

${body}

${part}
</Fragment>
`;
  await fs.writeFile(path.join(HERE, "templates", "master.xml"), out);
}

/** Emit both brand-derived files and say what they hold. */
async function writeBrand(): Promise<void> {
  await writeParts();
  await writeMasters();
  console.log(
    `brand: templates/parts.xml · templates/master.xml — 부 ${PARTS.length - 1}색`,
  );
}

/**
 * Fail the build when a source file's tags do not balance.
 *
 * The builder's parser accepts a close tag that does not match the open one
 * (`</VStack>` closing a `<Use>`), silently re-shaping the tree; the only
 * report is an XSD error in the VS Code preview, which a headless build never
 * sees. A page can therefore compile, render, and be wrong.
 *
 * This is a tag-balance scan, not a schema check — it catches the mismatch and
 * the unclosed tag, which is the failure that actually happens when a block is
 * moved between files.
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
      if (m[2] === undefined) continue; // comment or processing instruction
      const [, closing, tag, , selfClosing] = m;
      const line = code.slice(0, m.index).split("\n").length;
      if (selfClosing) continue;
      if (closing) {
        const open = stack.pop();
        if (!open) {
          problems.push(`${path.basename(file)}:${line} — 여는 태그 없이 </${tag}>`);
        } else if (open.tag !== tag) {
          problems.push(
            `${path.basename(file)}:${line} — <${open.tag}>(${open.line}행)를 </${tag}>로 닫았다`,
          );
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
 * Source rules the schema cannot express. Each entry here is a defect that
 * shipped once and was only caught by eye.
 *
 * 1. KoPub Batang (every display slot: cover, part, page title, contents,
 *    quote) has no U+2014 EM DASH glyph, so the character silently vanishes
 *    from the rendered page. Body text is Pretendard and keeps its em dashes.
 * 2. justifyContent="spaceBetween" between content-sized siblings renders the
 *    trailing sibling near the middle of the row, not at the far edge
 *    (verified against @slideglance/builder 0.1.3). End-alignment needs one
 *    w="max" sibling beside explicit widths.
 * 3. The inline format tags (<B> <I> <U> <S> <Mark> <A> <Span>) take no
 *    `class`. <Span> reads `color`, `highlight` and `lang` and nothing else,
 *    so `<Span class="kw">` splits the paragraph into runs and applies none
 *    of the style — the emphasis is simply absent and the page still looks
 *    finished. Write the weight and the colour out: `<Span color="1B4A9C">
 *    <B>…</B></Span>`.
 */
function assertSourceRules(files: string[]): void {
  const problems: string[] = [];
  const DISPLAY_TEMPLATES = ["toc-part", "toc-row", "page", "toc", "part", "quote", "wf-page", "wf-head", "annex-part", "annex-index", "annex-page", "annex-head", "annex-end"];
  const DISPLAY_CLASSES = [
    "hero", "hero-sub", "part-no", "part-title", "page-title", "toc-part", "toc-row", "quote",
  ];

  const lineOf = (code: string, index: number) => code.slice(0, index).split("\n").length;

  for (const file of files) {
    const code = readFileSync(file, "utf8");
    const base = path.basename(file);

    // Numeric newline entities survive template substitution as visible text.
    // The SGX text grammar uses a literal backslash-n escape instead.
    if (/&#(?:10|x0*a);/i.test(code)) {
      problems.push(`${base} — 숫자 줄바꿈 엔터티는 문자로 출력된다. SlideGlance의 \\n 표기를 사용한다`);
    }

    // 1 — em dash in a display-face slot
    const useRe = /<Use\s+template="([^"]+)"((?:"[^"]*"|'[^']*'|[^>"'])*?)\/?>/g;
    let m: RegExpExecArray | null;
    while ((m = useRe.exec(code)) !== null) {
      if (!DISPLAY_TEMPLATES.includes(m[1])) continue;
      const attr = /\b(?:title|text)="([^"]*)"/g;
      let a: RegExpExecArray | null;
      while ((a = attr.exec(m[2])) !== null) {
        if (a[1].includes("\u2014")) {
          problems.push(
            `${base}:${lineOf(code, m.index)} — 표제 서체 자리(${m[1]})에 U+2014(—)가 있다. ` +
              `KoPub Batang에 그 글리프가 없어 조용히 사라진다`,
          );
        }
      }
    }
    const textRe = /<Text\b([^>]*)>([\s\S]*?)<\/Text>/g;
    while ((m = textRe.exec(code)) !== null) {
      const cls = /class="([^"]*)"/.exec(m[1]);
      if (!cls || !DISPLAY_CLASSES.includes(cls[1])) continue;
      if (m[2].includes("\u2014")) {
        problems.push(
          `${base}:${lineOf(code, m.index)} — 표제 서체 글줄(class=${cls[1]})에 U+2014(—)가 있다. ` +
            `KoPub Batang에 그 글리프가 없어 조용히 사라진다`,
        );
      }
    }

    // 3 — class on an inline format tag, which the builder never reads
    const INLINE_FORMAT = ["B", "I", "U", "S", "Mark", "A", "Span"];
    const inlineRe = new RegExp(
      `<(${INLINE_FORMAT.join("|")})\\b[^>]*\\bclass="([^"]*)"`,
      "g",
    );
    while ((m = inlineRe.exec(code)) !== null) {
      problems.push(
        `${base}:${lineOf(code, m.index)} — <${m[1]} class="${m[2]}">의 class는 빌더가 읽지 않는다. ` +
          `글줄만 런으로 갈리고 강조는 적용되지 않는다. color와 <B>로 직접 적는다`,
      );
    }

    // 2 — spaceBetween with only content-sized children
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
          problems.push(
            `${base}:${open.line} — spaceBetween의 형제가 전부 내용 크기다. ` +
              `뒤 형제가 끝이 아니라 가운데쯤에 그려진다(0.1.3 검증). w="max" 하나와 명시 폭으로 정렬한다`,
          );
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
  for (const check of ["evaluation", "contents", "chapter_pages", "typefloor"]) {
    const result = spawnSync("python3", [path.join(HERE, `../tools/deck/${check}.py`)], {
      encoding: "utf8",
    });
    if (result.stdout) console.log(result.stdout.trim());
    if (result.error || result.status !== 0) {
      throw new Error(result.stderr || result.error?.message || `Failed ${check} check`);
    }
  }
  const xml = await fs.readFile(entry, "utf8");
  const { pptx, diagnostics, lintReport } = await buildPptx(xml, SLIDE_SIZE, {
    textMeasurement: "auto",
    resolveImport,
    sourcePath: entry,
    trackSourcePos: true,
    // Off: equalize widens every unsized sibling in an <HStack> to the same
    // width, which stretches the running head's 배점 / 요구 pair across the
    // page instead of keeping it tight to the right margin.
    equalize: false,
    lint: {
      enabled: true,
      ruleset: "recommended",
      overrides: {
        // False positive for a local-path <Image>. The builder only fills
        // imageDataCache for http(s) sources; a file path is handed to
        // pptxgenjs as `path:` and embedded at write time. Verified: the
        // figures are present under ppt/media/ in the output. Existence is
        // guaranteed here anyway — writeFigureTemplates only emits paths for
        // files it just rasterized.
        IMAGE_MISSING: "off",
      },
    },
  });

  for (const d of diagnostics) {
    const at = d.sourcePos?.line
      ? ` ${path.relative(HERE, d.sourcePos.file ?? "")}:${d.sourcePos.line}`
      : d.path
        ? ` @ ${d.path}`
        : "";
    console.log(`  [${d.severity ?? "warn"}] ${d.code}${at} — ${d.message}${process.env.DECK_NODE ? " @" + (d.nodeId ?? "") : ""}`);
  }
  if (lintReport) {
    const s = lintReport.summary;
    console.log(`lint: error ${s.error} · warn ${s.warn} · info ${s.info}`);
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  const raw = (await pptx.write({ outputType: "uint8array" })) as Uint8Array;
  const bytes = await withShapeAutoFit(raw);
  await fs.writeFile(PPTX_PATH, bytes);
  console.log(
    `pptx: ${path.relative(HERE, PPTX_PATH)} (${(bytes.byteLength / 1024).toFixed(0)} KB)`,
  );
}

/**
 * Turn on "도형을 텍스트 크기에 맞춤" for every text box.
 *
 * The builder emits `<a:bodyPr>` with no autofit child, which PowerPoint reads
 * as 「자동 맞춤 안 함」: the frame keeps the height the layout gave it while the
 * text runs past its edge, so a box a reader clicks is the wrong size and an
 * edit makes it worse. `<a:spAutoFit/>` is the OOXML for the option, and it
 * belongs first inside `bodyPr`. Table cells are left alone — a cell grows its
 * row instead, and `spAutoFit` means nothing there.
 */
async function withShapeAutoFit(bytes: Uint8Array): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(bytes);

  // The masthead and the folio come from `<MasterText>`, which the builder
  // writes without text insets — so PowerPoint applies the OOXML default of
  // 0.1in and the masthead starts 9.6px right of the text block every other
  // line on the page lines up with. Zero them: the layouts and the master hold
  // nothing but this deck's own furniture.
  for (const name of Object.keys(zip.files).filter((n) =>
    /^ppt\/slide(Layouts|Masters)\/[^/]+\.xml$/.test(n),
  )) {
    const xml = await zip.file(name)!.async("string");
    const patched = xml.replace(
      /<a:bodyPr([^>]*?)(\/?)>/g,
      (tag, attrs: string, selfClose: string) =>
        attrs.includes("lIns")
          ? tag
          : `<a:bodyPr${attrs} lIns="0" tIns="0" rIns="0" bIns="0"${selfClose}>`,
    );
    if (patched !== xml) zip.file(name, patched);
  }

  const slides = Object.keys(zip.files).filter((n) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(n),
  );
  slides.sort(
    (a, b) => Number(/(\d+)/.exec(a)![1]) - Number(/(\d+)/.exec(b)![1]),
  );

  // The folio is the builder's: the generated masters carry
  // `<SlideNumber count="numbered" startAt="1">`, which counts only the pages
  // that show a folio and writes the number as text. The cover, the two 차례
  // pages (유의사항 14) and the 별첨 (유의사항 13) stay out of the count, and
  // the preview reads the same number the file does because nothing here
  // rewrites it afterwards.
  for (const name of slides) {
    const xml = await zip.file(name)!.async("string");
    // Only shapes that actually carry text. A fill-only rectangle still has a
    // `txBody` with an empty paragraph, and `spAutoFit` on that resizes it to
    // the height of nothing — the card, the bar and the rule would collapse.
    // Table cells are left alone too: a cell grows its row instead, and the
    // element means nothing there.
    const patched = xml.replace(
      /<p:sp>[\s\S]*?<\/p:sp>/g,
      (sp) => {
        if (!/<a:t>[^<]*[^\s<][^<]*<\/a:t>/.test(sp)) return sp;
        if (sp.includes("<a:spAutoFit/>")) return sp;
        return sp
          .replace(/<a:bodyPr([^>]*)\/>/, "<a:bodyPr$1><a:spAutoFit/></a:bodyPr>")
          .replace(/<a:bodyPr([^>]*[^/])><\/a:bodyPr>/, "<a:bodyPr$1><a:spAutoFit/></a:bodyPr>");
      },
    );
    zip.file(name, patched);
  }
  // The builder emits an invisible hit-area rectangle for every container —
  // a fill-only shape at 100% transparency with no text body, there so the
  // VS Code preview can click through to the container's source. PowerPoint
  // reads that exact shape as unreadable content: repair strips every one
  // (dozens per slide) and reports 「읽을 수 없는 내용을 제거했습니다」. They
  // serve nothing in the shipped file, so drop them before it ships.
  for (const name of slides) {
    const xml = await zip.file(name)!.async("string");
    const patched = xml.replace(
      /<p:sp>(?:(?!<\/p:sp>).)*?<a:solidFill><a:srgbClr val="FFFFFF"><a:alpha val="0"\/><\/a:srgbClr><\/a:solidFill><a:ln><\/a:ln><\/p:spPr><\/p:sp>/gs,
      "",
    );
    if (patched !== xml) zip.file(name, patched);
  }

  // Every shape in one part needs its own `<p:cNvPr id>`.
  //
  // pptxgenjs numbers shapes and graphic frames from separate counters and
  // gives the slide-number placeholder a fixed id, so a page with enough
  // blocks on it hands the same id to two shapes. The file still opens —
  // which is why nothing reported it — but PowerPoint treats a duplicate id
  // as damage and offers to repair the presentation every time it is opened.
  // Renumber in document order, per part; nothing in this deck references a
  // shape id (there are no connectors and no animations), so the numbers are
  // free to change.
  for (const name of Object.keys(zip.files).filter((n) =>
    /^ppt\/(slides|slideLayouts|slideMasters|notesSlides)\/[^/]+\.xml$/.test(n),
  )) {
    const xml = await zip.file(name)!.async("string");
    let next = 1;
    const patched = xml.replace(/<p:cNvPr\s+id="\d+"/g, () => `<p:cNvPr id="${next++}"`);
    if (patched !== xml) zip.file(name, patched);
  }

  // pptxgenjs appends `<p:notesMasterIdLst>` after `<p:sldIdLst>`, but
  // CT_Presentation fixes its place right after `<p:sldMasterIdLst>`. Every
  // other part in the file passes the ECMA-376 schema; this one element out
  // of order is what makes PowerPoint offer to repair the presentation on
  // every open — and the repaired save reorders exactly this.
  {
    const name = "ppt/presentation.xml";
    const file = zip.file(name);
    if (file) {
      const xml = await file.async("string");
      const m = xml.match(/<p:notesMasterIdLst>[\s\S]*?<\/p:notesMasterIdLst>/);
      if (m && !/<\/p:sldMasterIdLst><p:notesMasterIdLst>/.test(xml)) {
        const moved = xml
          .replace(m[0], "")
          .replace("</p:sldMasterIdLst>", `</p:sldMasterIdLst>${m[0]}`);
        zip.file(name, moved);
      }
    }
  }

  // A paragraph carrying an emphasis span comes out of pptxgenjs with its
  // paragraph properties repeated in front of every run:
  //
  //     <a:p><a:r>…</a:r><a:pPr …/><a:r>…</a:r><a:pPr …/><a:r>…</a:r></a:p>
  //
  // `CT_TextParagraph` allows one `<a:pPr>` and requires it first, so those
  // paragraphs are schema-invalid. PowerPoint reads them anyway, which is
  // exactly why nothing reports it — the deck opens, renders, and only a
  // stricter reader on the client's side would balk. Keep the first, drop
  // the copies, and put it where the schema says.
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
  return (await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
  })) as Uint8Array;
}

/** Render every page to PNG so the layout can be reviewed by eye. */
function renderPreview(): void {
  const cli = process.env.SLIDEGLANCE_CLI ?? "slideglance";
  const pngDir = path.join(OUT_DIR, "png");
  const found = FONT_FILES.filter((p) => existsSync(p));
  for (const f of FONT_FILES) {
    if (!found.includes(f)) {
      console.error(
        `render: 글꼴이 없어 해당 글자가 미리보기에서 빠진다 — ${path.relative(HERE, f)}`,
      );
    }
  }

  const argv = [
    "convert", PPTX_PATH,
    "--output", pngDir,
    "--format", "png",
    "--width", "1191",
  ];
  for (const f of found) argv.push("--font", f);

  const r = spawnSync(cli, argv, { encoding: "utf8" });
  if (r.error) {
    console.error(
      `render: ${cli} 실행에 실패했다. slideglance CLI 경로를 SLIDEGLANCE_CLI로 지정한다.`,
    );
    process.exitCode = 1;
    return;
  }
  if (r.stderr?.trim()) console.error(r.stderr.trim());
  console.log(`render: ${path.relative(HERE, pngDir)}/`);
}

async function main(): Promise<void> {
  if (figureMode === "png") await renderFigures();
  await writeFigureTemplates();
  await writeBrand();
  await buildDeck();
  if (wantRender) renderPreview();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
