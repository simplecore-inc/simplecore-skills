#!/usr/bin/env node
/**
 * PostToolUse hook: hold a wireframe board to the parts of its output contract a machine can see.
 *
 * A board reaches its reader stripped of the conversation that produced it, so the contract is
 * what makes it readable at all: it renders offline, it carries the implementation contract that
 * stops a reader reproducing the greyboxes as a design, every frame says which route and state it
 * is, and every responsive pair has both halves. Each of those fails silently — a missing font
 * loads as a fallback, a dropped label reads as a frame nobody labelled, an unpaired `.narrow`
 * simply never appears.
 *
 * Scope guard: only an HTML file that IS a board is checked, recognized by the class vocabulary
 * boards are authored in. A project turns the check off with `{"boardCheck": false}` in
 * `.claude/simplecore.json`.
 *
 * @remarks
 * A kit-built board is written by its own `build.mjs`, not by a tool call, so this fires on
 * hand-written boards and on hand-edits of a built one. The kit's build is where the same rules
 * hold for the generated path.
 *
 * Exit codes: 0 = silent pass (not a board, or no errors),
 *             2 = findings reported on stderr, fed back to Claude.
 */
import {existsSync, readFileSync} from 'node:fs';
import {dirname, extname, relative, resolve} from 'node:path';
import {gateEnabled} from './project-config.mjs';

/** Colours below this saturation are the board's greyscale, however cool their tint. */
const CHROMATIC_SATURATION = 0.3;

/** Hue bucket width in degrees. A tint and its base land in one bucket; a second accent does not. */
const HUE_BUCKET = 30;

const FRAME_OPEN = /<article[^>]*\bclass="([^"]*\bframe\b[^"]*)"/g;

function countMatches(text, re) {
  return (text.match(re) ?? []).length;
}

/** Every frame's class list, in document order. */
function frameClasses(html) {
  const found = [];
  for (const match of html.matchAll(FRAME_OPEN)) found.push(match[1]);
  return found;
}

/** Parse `#rgb`, `#rrggbb`, `rgb()` and `rgba()` into `[r,g,b]` triples. */
function colorTriples(html) {
  const triples = [];

  for (const [, hex] of html.matchAll(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g)) {
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
    triples.push({
      literal: `#${hex}`,
      rgb: [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)),
    });
  }
  for (const match of html.matchAll(/rgba?\(([^)]*)\)/g)) {
    const parts = match[1].split(/[,/\s]+/).filter(Boolean).slice(0, 3).map(Number);
    if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
      triples.push({literal: match[0], rgb: parts});
    }
  }
  return triples;
}

/** HSL saturation and hue for an RGB triple, on 0..1 and 0..360. */
function saturationAndHue([r, g, b]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return {saturation: 0, hue: 0};

  const lightness = (max + min) / 2;
  const saturation = lightness > 127.5 ? delta / (510 - max - min) : delta / (max + min);

  let hue;
  if (max === r) hue = 60 * (((g - b) / delta + 6) % 6);
  else if (max === g) hue = 60 * ((b - r) / delta + 2);
  else hue = 60 * ((r - g) / delta + 4);

  return {saturation, hue};
}

/**
 * Distinct accent hues in the board, each with the literals that produced it.
 *
 * @remarks
 * The contract allows one accent, and an accent legitimately appears as a tint and a shade of
 * itself — so hues are bucketed rather than compared exactly. Two buckets means two accents, and
 * a board with two accents gets reviewed for its colours instead of its flows.
 */
function accentHues(html) {
  const buckets = new Map();
  for (const {literal, rgb} of colorTriples(html)) {
    const {saturation, hue} = saturationAndHue(rgb);
    if (saturation < CHROMATIC_SATURATION) continue;
    const bucket = Math.floor(hue / HUE_BUCKET);
    if (!buckets.has(bucket)) buckets.set(bucket, new Set());
    buckets.get(bucket).add(literal);
  }
  return [...buckets.values()].map((set) => [...set]);
}

function audit(html) {
  const errors = [];
  const reviews = [];

  if (!/class="[^"]*\breadme\b/.test(html)) {
    errors.push(
      'the `.readme` implementation contract is missing — without it a reader (person or model) ' +
        'reproduces the greyboxes as a design. It ships on every board and is never trimmed.',
    );
  }

  const externals = [
    [/<img\b/i, 'an `<img>`'],
    [/<iframe\b/i, 'an `<iframe>`'],
    [/<link\b(?![^>]*\brel="?(?:canonical|alternate)\b)/i, 'a `<link>`'],
    [/@import\b/i, 'a CSS `@import`'],
    [/url\(\s*['"]?(?:https?:)?\/\//i, 'a remote `url()`'],
    [/\bsrc=['"](?:https?:)?\/\//i, 'a remote `src`'],
  ];
  for (const [re, what] of externals) {
    if (re.test(html)) {
      errors.push(
        `${what} loads a resource from outside the file — the board must render identically ` +
          'offline, attached to a document, or as a thumbnail. Use the system font stack and ' +
          'greybox placeholders instead.',
      );
    }
  }

  const scripts = countMatches(html, /<script\b/gi);
  if (/<script\b[^>]*\bsrc=/i.test(html)) {
    errors.push('a `<script src=…>` — the only script a board may carry is the inline scroll-spy.');
  } else if (scripts > 1) {
    errors.push(
      `${scripts} \`<script>\` blocks — a board carries at most one, the inline scroll-spy that ` +
        'highlights the table-of-contents entry in view. Layout, content, and states are ' +
        'HTML/CSS and must render with scripts off.',
    );
  }

  const frames = frameClasses(html);
  const labels = countMatches(html, /class="[^"]*\bframe-label\b/g);
  if (frames.length > labels) {
    errors.push(
      `${frames.length} frames but ${labels} \`.frame-label\` elements — every frame says its ` +
        'route, screen, and state, or the reader cannot tell which frame they are looking at.',
    );
  }

  const narrow = frames.filter((c) => /\bnarrow\b/.test(c)).length;
  const wide = frames.filter((c) => /\bwide\b/.test(c)).length;
  if (narrow !== wide) {
    errors.push(
      `${narrow} \`.narrow\` frames and ${wide} \`.wide\` frames — a narrow/wide pair is ONE ` +
        'responsive screen, so each half needs its twin adjacent. An unpaired half never renders ' +
        'in one of the two toggle states.',
    );
  }
  if (narrow + wide > 0 && !/type="checkbox"/i.test(html)) {
    errors.push(
      'the board has narrow/wide pairs but no viewport toggle — the pure-CSS checkbox is what ' +
        'shows exactly one half of each pair.',
    );
  }
  if (narrow + wide === 0 && /type="checkbox"/i.test(html)) {
    reviews.push(
      'a viewport toggle is present but no frame is tagged `.narrow` / `.wide` — delete the ' +
        'toggle on a board with no pairs.',
    );
  }

  // A frame nobody can name is a frame nobody can report on. The id is what a plan, a parity
  // list, and a message to a person all use, and it is meant to outlive every reorder — so a
  // board whose labels carry only a position is one where every reference goes stale silently.
  const idChips = countMatches(html, /class="[^"]*\bfnum\b/g);
  const seqChips = countMatches(html, /class="[^"]*\bfseq\b/g);
  if (frames.length > 0 && idChips < frames.length) {
    reviews.push(
      `${frames.length} frames but ${idChips} permanent ids in the labels — every frame's label ` +
        'reads `[position] ID route — screen — state`. The id (`A-02`) never changes and is what ' +
        'everything outside the board refers to; the bracketed position is recomputed and moves.',
    );
  } else if (frames.length > 0 && seqChips < idChips) {
    reviews.push(
      `${idChips} frames carry a permanent id but only ${seqChips} show their bracketed position ` +
        '— the position is what lets a reader scanning the board find the frame they were given.',
    );
  }

  const desktop = frames.filter((c) => /\bdesktop\b/.test(c)).length;
  const folds = countMatches(html, /class="[^"]*\bfold\b/g);
  if (desktop > folds) {
    reviews.push(
      `${desktop} desktop frames but ${folds} \`.fold\` markers — a desktop frame draws its fold ` +
        "with the reference size, and the screen's primary action sits above it.",
    );
  }

  const hues = accentHues(html);
  if (hues.length > 1) {
    reviews.push(
      `${hues.length} accent colours (${hues.map((set) => set.join(' ')).join(' | ')}) — the ` +
        'board is greyscale plus exactly ONE accent, reserved for connectors, pins, stickies, ' +
        'folds, and `OPEN:` markers. With a second accent, reviewers critique colours instead of flows.',
    );
  }

  return {errors, reviews};
}

function main() {
  let payload;
  try {
    payload = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return 0; // no parseable hook input; nothing to audit
  }

  const filePath = payload?.tool_input?.file_path;
  if (typeof filePath !== 'string' || filePath.length === 0) return 0;
  if (!['.html', '.htm'].includes(extname(filePath).toLowerCase())) return 0;

  const abs = resolve(payload.cwd || process.cwd(), filePath);
  if (!existsSync(abs)) return 0;

  let html;
  try {
    html = readFileSync(abs, 'utf8');
  } catch {
    return 0;
  }

  // A board, not just any HTML: the frame vocabulary is the signature.
  if (!/class="[^"]*\bframe\b/.test(html)) return 0;
  if (!gateEnabled(dirname(abs), 'boardCheck')) return 0;

  const {errors, reviews} = audit(html);
  if (errors.length === 0 && reviews.length === 0) return 0;

  const rel = relative(payload.cwd || process.cwd(), abs) || abs;
  const lines = [
    ...errors.map((f) => `  [error]  ${f}`),
    ...reviews.map((f) => `  [review] ${f}`),
  ];
  process.stderr.write(
    `Wireframe board contract — ${rel}\n${lines.join('\n')}\n\n` +
      `The contract and the full self-check are in the simplecore:wireframe-boards skill. ` +
      `[review] findings need a judgment call, not a bulk rewrite.\n`,
  );
  return errors.length ? 2 : 0;
}

process.exit(main());
