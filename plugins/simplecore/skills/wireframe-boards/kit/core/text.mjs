// Every word the kit writes onto a board that a READER reads.
//
// **Two kinds of English were mixed up here, and only one of them was right.** The reading contract
// is instruction — an implementer, human or otherwise, is told what a wireframe fixes and what it
// does not — so it is English wherever the board is drawn, the same as every other file an agent
// executes rather than reads as prose. The navigation chrome is not instruction: the index's legend,
// the filter's placeholder, the viewport toggle's two words and a section's frame count are labels
// on a document, and a Korean board that says `filter — id or name` over a Korean index is simply a
// board with English on it.
//
// So the chrome comes from here, keyed by the board's `boardLang`, and the contract does not. A
// board declares `boardLang: 'ko'` in `board.config.mjs`; anything else falls back to English
// rather than failing, because a board is worth building in a language nobody has translated yet.
//
// **`boardLang` is the language of the DRAWING, and it is not `site.languages`.** The second is what
// the product ships in — the list C-17 renders and a language switcher offers — and the two answer
// different questions: a board drawn in Korean can specify a product that runs in eleven languages,
// and a board drawn in English can specify one that runs only in Korean. The names are kept apart
// because a single word `lang` sitting beside `site.languages` reads as the same axis.
//
// **Adding a language means adding every key.** A partial table would render half a sidebar in one
// language and half in another, which reads as a bug in the board rather than a gap in the kit. The
// check is at the bottom of this file and throws when the module LOADS rather than when a board
// builds: a short table breaks every language equally, so there is nothing to be gained by letting
// one command run and refusing another.

/** English. The fallback, and the one language every key is guaranteed in. */
const en = {
  htmlLang: 'en',
  indexLegend: '[position] permanent id',
  filterPlaceholder: 'filter — id or name',
  filterLabel: 'Filter the table of contents',
  filterHint: 'Press / to focus · Enter opens the first match · Esc clears',
  filterClear: 'Clear the filter',
  viewportLabel: 'Viewport width',
  narrow: 'Narrow',
  wide: 'Wide',
  /** A section's caption. Frames and screens differ only where a responsive pair exists. */
  frames: (n) => `${n} frame${n === 1 ? '' : 's'}`,
  screensAndFrames: (s, f) => `${s} screen${s === 1 ? '' : 's'} · ${f} frame${f === 1 ? '' : 's'}`,
  /** A section a split has cut: what is in this file, and what the section holds in all. */
  framesOfWhole: (n, whole) => `${n} of ${whole} frames`,
  /** The day every dated frame is drawn against — `config.today`, said in the header. */
  asOf: (day) => `as of ${day}`,
  /** The three places outside the frame list a reader goes to. */
  jumpIa: 'Information architecture',
  jumpUser: 'Users and roles',
  jumpReadme: 'Reading contract',
  /** The index's width handle — a dimension of the reading tool, not of the board. */
  widthLabel: 'Index width',
  widthHint: 'Drag to resize · arrow keys adjust · double-click resets',
  /** A board written into several files: the way back to the entry page, and what it says. */
  navEntry: 'Whole board',
  oneSet: (n) => `This board is one set of ${n} files. Open another from the row above; `
    + 'find a single frame in the index on the left.',
};

/** Korean. */
const ko = {
  htmlLang: 'ko',
  indexLegend: '[위치] 영구 아이디',
  filterPlaceholder: '아이디 또는 이름으로 좁히기',
  filterLabel: '목차 좁히기',
  filterHint: '/ 를 누르면 입력칸으로 · Enter는 첫 항목 · Esc는 지우기',
  filterClear: '좁히기 지우기',
  viewportLabel: '화면 너비',
  narrow: '좁은 쪽',
  wide: '넓은 쪽',
  asOf: (day) => `기준일 ${day}`,
  frames: (n) => `프레임 ${n}개`,
  screensAndFrames: (s, f) => `화면 ${s}개 · 프레임 ${f}개`,
  framesOfWhole: (n, whole) => `프레임 ${n}개 · 전체 ${whole}개 가운데`,
  jumpIa: '정보 구조',
  jumpUser: '사용자 구성',
  jumpReadme: '읽기 규약',
  widthLabel: '색인 너비',
  widthHint: '끌어서 조절 · 화살표로 조금씩 · 두 번 누르면 기본값',
  navEntry: '보드 전체',
  oneSet: (n) => `이 보드는 파일 ${n}개가 한 벌입니다. 다른 파일은 위의 이동 줄에서 열고, `
    + '프레임 하나는 왼쪽 색인에서 찾습니다.',
};

export const LANGS = { en, ko };

/**
 * The chrome vocabulary for one board.
 *
 * @param lang the board's declared language. Unknown or absent → English
 * @returns every key, always
 */
export function textFor(lang) {
  return LANGS[lang] ?? en;
}

// A table short of a key renders that one label in English inside an otherwise translated sidebar,
// and the reader has no way to tell that from a board somebody half-translated by hand. Throwing on
// load is the cheapest place to catch it: the kit cannot be imported at all in that state.
for (const [name, table] of Object.entries(LANGS)) {
  const missing = Object.keys(en).filter((k) => !(k in table));
  if (missing.length) {
    throw new Error(`core/text.mjs: '${name}' 표에 없는 열쇠 — ${missing.join(' · ')}`);
  }
}
