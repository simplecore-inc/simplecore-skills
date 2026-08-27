#!/usr/bin/env node
/**
 * Rendered-screen audit — the defects that exist only once the page is painted.
 *
 * Its sibling `audit-frontend.mjs` reads source files and can therefore run with nothing
 * started. Everything here is a question about boxes and rows on a live page, so **it needs
 * a browser and it says so rather than answering without one.** A source audit cannot see a
 * list whose rows never arrived or two tables painted into the same rectangle: the component
 * is imported, the props type-check, the request answers 200, and the screen is unusable.
 *
 * Usage:
 *   node audit-rendered.mjs --url https://localhost:5173/frame/c-20
 *   node audit-rendered.mjs --url <u> --check countedListDrawsNoRows
 *   node audit-rendered.mjs --list                  # the checks and what each catches
 *   node audit-rendered.mjs --print <id>            # the snippet, to paste into any driver
 *   node audit-rendered.mjs --selftest              # both directions, against generated fixtures
 *
 * An unrecognised option stops the run. `--selftest` is spelt the same way in all three audit
 * scripts, and a misspelling that fell through to a normal run reported nothing wrong — which
 * is what a clean run reports.
 *
 * Exit code 1 when an error-grade check has findings, 2 when the browser could not be driven.
 * **A run that could not reach a browser never exits 0** — a check nobody can prove fired is
 * worth nothing, and a silent pass here is the exact substitution this file exists to stop.
 *
 * Driving: `agent-browser` (the default), or `--print` the snippet and evaluate it through
 * whatever the session already has open — Claude in Chrome's javascript_tool, Playwright's
 * `page.evaluate`, a devtools console. Each snippet is one self-contained expression that
 * returns `{ compared, findings }` and touches nothing on the page.
 *
 * Every check reports how many comparisons it made, not only how many failed. 「0 findings」
 * and 「compared 186 elements」 are one line to an exit status and two different sentences to
 * a reader — only the second shows a check that ran and reached nothing.
 *
 * Vocabulary (what counts as a row, what a total reads like, what an empty state says) is
 * options with documented defaults, never constants: a product that writes its totals
 * differently overrides them with --options <json> rather than editing this file.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// ---------------------------------------------------------------------------
// Defaults — the vocabulary, in one place, overridable per project
// ---------------------------------------------------------------------------

const DEFAULTS = {
  /**
   * How wide a clipping element has to be before it counts as a region. Narrower than this it is
   * a control, an icon well or a rule, and none of those is holding a screen the reader lost.
   */
  minRegionWidthPx: 240,

  /**
   * The height under which an open region is a sliver. A region that genuinely scrolls its own
   * content is hundreds of pixels tall; this is the band where a reader cannot work at all.
   */
  minRegionHeightPx: 64,

  /**
   * How much content has to be held before the clipping matters. A toolbar overflowing sideways
   * holds exactly its own height and is not this.
   */
  crushedContentPx: 240,

  /**
   * How many times over the content has to exceed what is shown. Below this the region is merely
   * tight, and a check that reports tight regions is one nobody runs twice.
   */
  crushedRatio: 4,

  /**
   * How far a region has to overflow before it counts as scrolling rather than as a box a
   * scrollbar shortened. A region scrolling sideways has its own horizontal bar taking height
   * off `clientHeight`, and on a platform that draws that bar inside the box the vertical
   * overflow it invents is about fifteen pixels — under this, and never near a real one.
   */
  strandedScrollSlackPx: 8,

  /** The same floor for a region that also scrolls sideways, where the bar is the likelier cause. */
  strandedSidewaysSlackPx: 24,

  /**
   * How tall a region has to be before the page's inability to move is the reader's problem. Under
   * this it is a panel inside a screen \u2014 a note, a picker, a log tail \u2014 and scrolling it
   * where it stands is what the reader expects. This is a floor and its neighbour
   * `minRegionHeightPx` is a ceiling; they measure the same dimension for opposite questions.
   */
  minStrandedRegionHeightPx: 120,

  /**
   * How tall something above the region has to be before it counts as chrome standing still. A
   * hairline rule and a 4px spacer are above it too, and neither is what the reader notices not
   * moving.
   */
  frozenChromeMinHeightPx: 24,

  /**
   * How much of a region's height something has to share before it counts as standing beside it.
   * A column half the height of its neighbour is still the neighbour; a strip crossing its top
   * edge is a toolbar.
   */
  besideOverlapRatio: 0.5,

  /**
   * What a list's own row total reads like. This is deliberately narrower than 「any number
   * on the page」: a stat tile drawing 「14」 under the label 「적용 법령」 is not claiming that
   * fourteen rows are about to be drawn, and a check that reads it as one fires on every
   * dashboard. A toolbar total names its own set — 「전체 14건」 — and that is the shape here.
   */
  totalPatterns: [
    "^\\s*(?:전체|총|합계)\\s*([\\d,]+)\\s*(?:건|개|명|행)\\s*$",
    "^\\s*([\\d,]+)\\s*(?:건|개|명|행)\\s*(?:전체|중)\\s*$",
    "^\\s*Total\\s*[:\\s]\\s*([\\d,]+)\\s*$",
    "^\\s*([\\d,]+)\\s*(?:results?|items?|rows?|entries)\\s*$",
  ],

  /**
   * What a drawn row looks like. A header row is excluded by the selectors themselves.
   *
   * A row stops being a `<tr>` below a list's card breakpoint: the same list draws each record as
   * a card, and every selector above it is written for a table. Left at those five, the check
   * reports 「states N rows and its column draws none」 on every list narrow enough to have gone to
   * cards — the one reading where the rows are most certainly there, because a card is what the
   * list drew on purpose. The framework marks both shapes with the same testid, so the last
   * selector is what makes this check mean the same thing at both widths.
   */
  rowSelectors: [
    "tbody tr",
    '[role="row"]',
    '[role="listitem"]',
    "[data-row]",
    "[data-row-id]",
    '[data-testid^="list-row-"]',
  ],

  /** What a screen says when it has nothing to draw. */
  emptyStatePatterns: [
    "없습니다",
    "없음",
    "비어",
    "결과가 없",
    "표시할",
    "No results",
    "No data",
    "Nothing to show",
    "empty",
  ],

  /**
   * How wide an ancestor has to be before it counts as the count's column. A toolbar total is
   * a small pill inside a bar that spans the list; three times its own width finds that bar
   * without climbing out into the page.
   */
  columnWidthFactor: 3,

  /**
   * What may not appear inside a `<p>`. Tag names rather than computed display, because
   * `display: inline` on a `<div>` makes the box behave and leaves the markup invalid all the
   * same — and because a flex child's computed display says nothing about what it is.
   */
  blockTags: [
    "div", "p", "section", "article", "header", "footer", "aside", "nav", "main",
    "ul", "ol", "li", "dl", "dt", "dd", "table", "form", "fieldset", "figure",
    "blockquote", "pre", "hr", "address", "h1", "h2", "h3", "h4", "h5", "h6",
  ],

  /** Two boxes touching by less than this in either axis is a border, not an overlap. */
  minOverlapPx: 4,

  /** …and an intersection smaller than this share of the smaller box is a rounding artefact. */
  minOverlapRatio: 0.25,

  /** Beyond this many text leaves the pairwise sweep reports what it sampled and stops. */
  maxLeaves: 1500,

  /** One finding per defect is a report; forty is a wall. */
  maxFindings: 25,

  /**
   * What counts as something a reader presses.
   *
   * <p>Roles as well as tags: a component library draws a button as a `div` carrying
   * `role="button"` often enough that a tag list alone walks past half of them.
   */
  pressableSelector:
    'button, a[href], input:not([type="hidden"]), select, textarea, summary,'
    + ' [role="button"], [role="tab"], [role="link"], [role="menuitem"], [role="switch"],'
    + ' [role="checkbox"], [role="radio"], [role="option"]',

  /** Below this a control is an icon hairline, and its centre probe is noise. */
  minControlPx: 8,

  /** How far in from a corner the edge probes sit. */
  probeInsetPx: 4,

  /** With the centre reachable, this many of the five probes is a control a reader can hit. */
  minProbesReached: 3,

  /**
   * How much of a control has to survive its ancestors' clipping before it is judged at all.
   *
   * <p>A control scrolled out of its panel still reports a rectangle on screen, and the hit test
   * at that spot answers with whatever is painted there instead — which reads exactly like being
   * covered. Below this share the control is not on screen to be pressed and is nobody's defect.
   *
   * <p><b>Setting this to 0 does not turn the clipping off.</b> A control an ancestor has cut away
   * entirely fails the empty-rectangle guard before any ratio is taken, so it stays excluded at
   * every value. Anybody comparing against the behaviour from before clipping was read has to
   * restore the old measurement, not lower this — the ratio route reports the same count twice and
   * reads as 「there were never any false positives here」.
   */
  minVisibleRatio: 0.5,

  /**
   * How long to keep re-measuring while the screen is still arriving.
   *
   * <p>A list, a census and a permission read all resolve after the document does, and the state
   * worth judging is the one they leave behind. Long enough for a local server answering a cold
   * query; a page that has not settled by then is reported as it stands.
   */
  settleMs: 8000,

  /** How long between two readings while waiting for the screen to settle. */
  settleIntervalMs: 400,

  /**
   * What counts as a pane — a region a reader reached by pressing something, which therefore
   * owes them content.
   *
   * <p>`tabpanel` is the whole of the default on purpose. It is the one region whose contract
   * is unambiguous: a tab strip promises that pressing a tab shows what is behind it, so a
   * panel that paints nothing has broken a promise the reader can see being made. A card, a
   * section or a sidebar may legitimately render nothing — a reference card with no rows is
   * supposed to disappear — and a check that read those as panes would fire on every screen
   * that hides an empty card correctly.
   *
   * <p>A product with its own pane primitive adds its selector here rather than editing the
   * check.
   */
  paneSelector: '[role="tabpanel"]',

  /**
   * What a pane may draw instead of words and still count as having drawn something.
   *
   * <p>A pane holding one chart, one map or one signature canvas has no text in it and is not
   * blank. Read as blank it would be the check's first false positive, and the report would
   * then be the thing nobody trusts.
   */
  wordlessContentSelector:
    'img, svg, canvas, video, iframe, object, embed, [role="img"], [role="progressbar"], input, select, textarea',

  /**
   * How wide a pane has to be laid out before its emptiness is judged.
   *
   * <p><b>Width and never height.</b> A blank pane's height IS the symptom — the one this check
   * was written from painted 16px of its own `pt-4` and nothing else — so a height floor would
   * skip exactly the defect. Width says something different: a pane the layout never gave a
   * column to has not been asked to draw anything yet.
   */
  minPaneWidthPx: 40,
};

// ---------------------------------------------------------------------------
// The checks. Each `page` runs in the browser and returns { compared, findings }.
// ---------------------------------------------------------------------------

/**
 * A list total that says N rows, over a column that draws none.
 *
 * The defect it exists to catch: a screen states 「전체 14건」 in its toolbar, repeats 14 in
 * its tab and 14 in a tile, and paints no row at all — while a record stays selected in the
 * detail panel beside it, so the screen looks populated. Every request answered 200 and the
 * numbers are honest; the rows are what never arrived.
 *
 * **Why the column and not the page.** A list-detail screen has rows on the right even when
 * the list on the left is empty, so counting rows anywhere in the document reads the detail
 * panel's table as the list's and goes quiet on exactly the screen this catches. The count's
 * own column is the bar it sits in, found by climbing until an ancestor is several times its
 * width; a row belongs to that column when its horizontal centre falls inside it and it is
 * drawn below the count.
 */
const countedListDrawsNoRows = {
  id: "countedListDrawsNoRows",
  grade: "error",
  title:
    "a list total stating N rows over a column that draws none — the numbers are right and the rows never arrived",
  page: (o) => {
    const findings = [];
    const totals = o.totalPatterns.map((p) => new RegExp(p));
    const empties = o.emptyStatePatterns.map((p) => new RegExp(p, "i"));

    const visible = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return false;
      const s = getComputedStyle(el);
      return s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) !== 0;
    };
    // The text this element owns, rather than everything under it. Counting element children
    // is the wrong test: a label with an inline icon — 「<svg/>전체 14건」, which is what every
    // badge and most buttons in a component library look like — has a child and would be read
    // as owning nothing, so the check walks past the totals it exists to find.
    const own = (el) => {
      let text = "";
      for (const node of el.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) text += node.nodeValue;
        else if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== "SVG"
                 && node.namespaceURI !== "http://www.w3.org/2000/svg") return "";
      }
      return text.trim();
    };
    const where = (el) => {
      const bits = [];
      for (let n = el; n && n !== document.body && bits.length < 4; n = n.parentElement) {
        bits.unshift(
          n.tagName.toLowerCase() +
            (n.id ? "#" + n.id : "") +
            (n.className && typeof n.className === "string"
              ? "." + n.className.trim().split(/\s+/).slice(0, 2).join(".")
              : ""),
        );
      }
      return bits.join(" > ");
    };

    const leaves = [...document.querySelectorAll("body *")].filter(
      (el) => own(el) && visible(el),
    );
    // A row painted where nothing can reach it is not a drawn row.
    //
    // An ancestor that CLIPS — `overflow: hidden` or `clip`, which no gesture undoes — and whose
    // box the row's rectangle falls entirely outside of hides that row from the reader as
    // completely as a row that never rendered: the rectangles are real, `visible()` says yes, and
    // the screen under the total is blank. That is how a list screen whose tiles, banners and
    // help cards outgrow the fold arrives — the framework hands the tab body the leftover height,
    // the leftover is thirty pixels, and forty-two rows lay themselves out below the clip.
    //
    // A SCROLLABLE ancestor is the opposite case and is left alone. Rows below the fold of an
    // `auto`/`scroll` box are one gesture away, which is what a long list is; reading them as
    // undrawn would fire on every list anybody has scrolled.
    const reachable = (el) => {
      const r = el.getBoundingClientRect();
      for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
        const s = getComputedStyle(p);
        const clipsY = s.overflowY === "hidden" || s.overflowY === "clip";
        const clipsX = s.overflowX === "hidden" || s.overflowX === "clip";
        if (!clipsY && !clipsX) continue;
        const b = p.getBoundingClientRect();
        if (clipsY && Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top) <= 0) return false;
        if (clipsX && Math.min(r.right, b.right) - Math.max(r.left, b.left) <= 0) return false;
      }
      return true;
    };

    const rows = [...document.querySelectorAll(o.rowSelectors.join(","))]
      .filter(visible)
      .filter(reachable);
    let compared = 0;

    for (const el of leaves) {
      const text = own(el);
      let n = null;
      for (const re of totals) {
        const m = re.exec(text);
        if (m) {
          n = Number(String(m[1]).replace(/,/g, ""));
          break;
        }
      }
      if (n === null || !(n >= 1)) continue;
      compared += 1;

      const cr = el.getBoundingClientRect();
      let column = el;
      while (
        column.parentElement &&
        column.parentElement !== document.body &&
        column.getBoundingClientRect().width < o.columnWidthFactor * cr.width
      ) {
        column = column.parentElement;
      }
      const col = column.getBoundingClientRect();
      const inColumn = (r) => {
        const cx = r.left + r.width / 2;
        return cx >= col.left && cx <= col.right && r.bottom >= cr.top - 4;
      };

      const drawn = rows.filter((row) => inColumn(row.getBoundingClientRect()));
      if (drawn.length > 0) continue;

      const emptyState = leaves.find(
        (other) =>
          other !== el &&
          empties.some((re) => re.test(own(other))) &&
          inColumn(other.getBoundingClientRect()),
      );
      findings.push(
        emptyState
          ? `「${text}」 states ${n} rows while its column shows the empty state 「${own(emptyState)}」 — ` +
            `the total and the screen disagree (${where(el)})`
          : `「${text}」 states ${n} rows and its column draws none — no row element inside ` +
            `${where(column)} below it, and no empty state either (${where(el)})`,
      );
      if (findings.length >= o.maxFindings) break;
    }
    return { compared, findings };
  },
};

/**
 * Two pieces of text painted into the same rectangle.
 *
 * The defect it exists to catch: two tables render into one area, so a section heading lands
 * on top of the filter bar, every row shows two records superimposed, and the pagination
 * control is drawn inside a table row. Nothing throws, nothing fails to type-check, every
 * string on the screen is correct — and the screen cannot be read.
 *
 * **What is deliberately not a finding.** Overlap is how a dialog, a tooltip, a popover and a
 * sticky header are supposed to work, so anything inside one, or positioned `fixed`/`sticky`,
 * is out. What remains is two leaves in ordinary flow occupying one box, which is never
 * intended.
 */
const textBoxesOverlap = {
  id: "textBoxesOverlap",
  grade: "error",
  title:
    "two pieces of text painted into one rectangle — every string is right and the screen cannot be read",
  page: (o) => {
    const findings = [];

    /**
     * Which raised layer the element sits on, as the element that raises it — `null` for text in
     * the ordinary flow.
     *
     * <p>A boolean is not enough: a sticky header and a modal are both raised and are two
     * different layers, so a flag makes them one and reports the header behind the dialog.
     */
    const layerOf = (el) => {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        if (n.matches('[role="dialog"], dialog, [role="tooltip"], [popover], [aria-hidden="true"]'))
          return n;
        const pos = getComputedStyle(n).position;
        if (pos === "fixed" || pos === "sticky") return n;
      }
      return null;
    };
    const visible = (el) => {
      const s = getComputedStyle(el);
      if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) === 0)
        return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    // The text this element owns, rather than everything under it. Counting element children
    // is the wrong test: a label with an inline icon — 「<svg/>전체 14건」, which is what every
    // badge and most buttons in a component library look like — has a child and would be read
    // as owning nothing, so the check walks past the totals it exists to find.
    const own = (el) => {
      let text = "";
      for (const node of el.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) text += node.nodeValue;
        else if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== "SVG"
                 && node.namespaceURI !== "http://www.w3.org/2000/svg") return "";
      }
      return text.trim();
    };
    const clip = (t) => (t.length > 40 ? t.slice(0, 40) + "…" : t);

    // What of an element a reader can actually see. `getBoundingClientRect` reports where the
    // layout put it, not what survives its ancestors' clipping — a table row scrolled past the
    // bottom of an `overflow: auto` panel still reports a rectangle down there, and two of those
    // intersect happily while the screen shows neither. Every page with a scrolling list under a
    // footer reports the same pair, so the check that is meant to find one real collision comes
    // back with a handful of them on every screen and stops being read.
    const onScreen = (el) => {
      const r = el.getBoundingClientRect();
      let x1 = r.left;
      let y1 = r.top;
      let x2 = r.right;
      let y2 = r.bottom;
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.overflowX === "visible" && cs.overflowY === "visible") continue;
        const box = n.getBoundingClientRect();
        if (cs.overflowX !== "visible") {
          x1 = Math.max(x1, box.left);
          x2 = Math.min(x2, box.right);
        }
        if (cs.overflowY !== "visible") {
          y1 = Math.max(y1, box.top);
          y2 = Math.min(y2, box.bottom);
        }
        if (x2 <= x1 || y2 <= y1) return null;
      }
      x1 = Math.max(x1, 0);
      y1 = Math.max(y1, 0);
      x2 = Math.min(x2, window.innerWidth || document.documentElement.clientWidth);
      y2 = Math.min(y2, window.innerHeight || document.documentElement.clientHeight);
      if (x2 <= x1 || y2 <= y1) return null;
      return { left: x1, top: y1, right: x2, bottom: y2, width: x2 - x1, height: y2 - y1 };
    };

    let leaves = [...document.querySelectorAll("body *")].filter((el) => own(el) && visible(el));
    const sampled = leaves.length > o.maxLeaves;
    if (sampled) leaves = leaves.slice(0, o.maxLeaves);

    const boxes = [];
    for (const el of leaves) {
      const r = onScreen(el);
      // Which layer the text belongs to, rather than whether it is on one. Dropping raised text
      // altogether was the safe-looking reading and it takes the dialogs with it — and a help
      // table with a squeezed column is exactly the kind of thing that only shows up inside one.
      // Comparing within a layer keeps the modal-over-page pair quiet and the two-texts-inside-
      // one-modal pair loud.
      if (r) boxes.push({ el, r, t: own(el), layer: layerOf(el) });
    }
    let compared = 0;

    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i];
        const b = boxes[j];
        compared += 1;
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        if (a.layer !== b.layer) continue;

        const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
        const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        if (w < o.minOverlapPx || h < o.minOverlapPx) continue;

        const areaA = a.r.width * a.r.height;
        const areaB = b.r.width * b.r.height;
        if (w * h < o.minOverlapRatio * Math.min(areaA, areaB)) continue;

        findings.push(
          `「${clip(a.t)}」 and 「${clip(b.t)}」 are painted into the same box — they overlap by ` +
            `${Math.round(w)}×${Math.round(h)}px at (${Math.round(Math.max(a.r.left, b.r.left))}, ` +
            `${Math.round(Math.max(a.r.top, b.r.top))})`,
        );
        if (findings.length >= o.maxFindings) return { compared, findings, sampled };
      }
    }
    return { compared, findings, sampled };
  },
};

/**
 * A block element rendered inside a paragraph.
 *
 * The defect it exists to catch: a component library's text primitive renders `<p>`, a screen
 * puts a composed label into its slot — a name, a badge and an icon button laid out with the
 * library's own row primitive, which renders `<div>` — and the paragraph now contains a block.
 * The className the primitive wrote on that paragraph (`flex-1`, `truncate`, a weight) stops
 * governing the content, so the label neither truncates nor shares the row's width, and a long
 * name pushes the trailing value off the row.
 *
 * **Why the DOM has it at all.** Writing `<p><div>` in an HTML file cannot produce this — the
 * parser closes the paragraph and the block becomes its sibling. A framework that builds the
 * tree with `createElement`/`appendChild` bypasses the parser, so the invalid nesting is really
 * there. That is also why the only warning is one line in a development console, next to the
 * hot-reload noise, and why it survives every other check: the strings are right, the requests
 * answered, and a screenshot shows a row that merely looks a little wide.
 *
 * **Where the fix belongs.** In the component that wraps the slot, not in the screen that filled
 * it — one element name there fixes every caller, and a screen that routes around it grows a
 * hand-rolled box the library exists to prevent.
 */
const blockInsideParagraph = {
  id: "blockInsideParagraph",
  grade: "error",
  title:
    "a block element nested inside a paragraph — the paragraph splits, and the width, weight and truncation written on it stop governing the content",
  page: (o) => {
    const findings = [];
    const blocks = o.blockTags.map((t) => t.toUpperCase());

    const where = (el) => {
      const bits = [];
      for (let n = el; n && n !== document.body && bits.length < 4; n = n.parentElement) {
        bits.unshift(
          n.tagName.toLowerCase() +
            (n.id ? "#" + n.id : "") +
            (n.className && typeof n.className === "string"
              ? "." + n.className.trim().split(/\s+/).slice(0, 2).join(".")
              : ""),
        );
      }
      return bits.join(" > ");
    };
    const clip = (s) => {
      const t = (s || "").replace(/\s+/g, " ").trim();
      return t.length > 40 ? t.slice(0, 39) + "…" : t;
    };

    const paragraphs = [...document.querySelectorAll("p")];
    let compared = 0;
    for (const p of paragraphs) {
      compared += 1;
      // The nearest offender only. A panel that nests three levels of layout inside one
      // paragraph is one defect with one fix, and listing every descendant buries the others.
      const offender = [...p.querySelectorAll("*")].find((el) => blocks.includes(el.tagName));
      if (!offender) continue;
      findings.push(
        `<${offender.tagName.toLowerCase()}> inside <p> — 「${clip(p.textContent)}」 ` +
          `(${where(offender)})`,
      );
      if (findings.length >= o.maxFindings) break;
    }
    return { compared, findings };
  },
};

/**
 * A control a reader cannot press, because something transparent is lying on top of it.
 *
 * The defect it exists to catch: a footer's three buttons are painted at their proper place and
 * an empty spacer in the same column is laid over them, so a press aimed at the middle of a
 * button lands on the spacer and nothing happens. The buttons take a press only in the few pixels
 * the spacer does not reach.
 *
 * **Why nothing else finds it.** The strings are right, the handlers are wired, the typecheck is
 * green, and the covering element is transparent — so it leaves no mark on a screenshot and no
 * mark on the eye. A verification round photographs the panel, reads the footer, and records that
 * the controls are there, because they are. It is found by pressing, and a round that presses
 * every control on every screen is not a round anybody runs. **This is the class of defect a
 * capture-based verification is structurally unable to see**, which is the whole reason it is
 * worth a check.
 *
 * **What the rule asks.** For each control, is the thing at the middle of its own rectangle the
 * control itself, or something inside it? When it is neither, the press goes elsewhere, and the
 * check says what caught it.
 *
 * **What it deliberately does not report.** A control behind an open dialog is inert on purpose —
 * that is a modal working. A disabled control is meant not to answer. A control whose coverer sets
 * `pointer-events: none` never comes up at all, because the browser's own hit test walks past it,
 * which is the same test a reader's finger takes.
 */
const pressableControlsTakeThePress = {
  id: "pressableControlsTakeThePress",
  grade: "error",
  title:
    "a control something transparent is lying on top of — it is drawn, it is labelled, and a press lands elsewhere",
  page: (o) => {
    const findings = [];

    const visible = (el) => {
      const s = getComputedStyle(el);
      if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) === 0)
        return false;
      const r = el.getBoundingClientRect();
      return r.width >= o.minControlPx && r.height >= o.minControlPx;
    };

    // What of the control a reader can actually see, after every ancestor that scrolls has cut
    // it down. `getBoundingClientRect` reports where the layout put it, not what survives the
    // clipping — a row action scrolled past the bottom of an `overflow: auto` panel still reports
    // a rectangle on screen, and `elementFromPoint` at that spot honestly answers with whatever
    // IS painted there. Read without this, the check calls every off-screen control covered and
    // buries the one real finding: a sweep of eight screens returned seventeen, and fourteen were
    // this. The same measurement `textBoxesOverlap` makes, for the same reason.
    const onScreen = (el) => {
      const r = el.getBoundingClientRect();
      let x1 = r.left;
      let y1 = r.top;
      let x2 = r.right;
      let y2 = r.bottom;
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.overflowX === "visible" && cs.overflowY === "visible") continue;
        const box = n.getBoundingClientRect();
        if (cs.overflowX !== "visible") {
          x1 = Math.max(x1, box.left);
          x2 = Math.min(x2, box.right);
        }
        if (cs.overflowY !== "visible") {
          y1 = Math.max(y1, box.top);
          y2 = Math.min(y2, box.bottom);
        }
        if (x2 <= x1 || y2 <= y1) return null;
      }
      x1 = Math.max(x1, 0);
      y1 = Math.max(y1, 0);
      x2 = Math.min(x2, window.innerWidth || document.documentElement.clientWidth);
      y2 = Math.min(y2, window.innerHeight || document.documentElement.clientHeight);
      if (x2 <= x1 || y2 <= y1) return null;
      const area = (x2 - x1) * (y2 - y1);
      const whole = r.width * r.height;
      if (!whole || area / whole < o.minVisibleRatio) return null;
      return { left: x1, top: y1, right: x2, bottom: y2, width: x2 - x1, height: y2 - y1 };
    };

    // A control the product has switched off, or one a modal has made inert, is not answering by
    // design. Reporting either teaches that the check does not know the difference.
    const inert = (el) => {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        if (n.hasAttribute?.("inert")) return true;
        if (n.getAttribute?.("aria-hidden") === "true") return true;
        if (n.matches?.("[disabled], [aria-disabled=\"true\"]")) return true;
      }
      return false;
    };

    /** The topmost open modal, if one is open — everything outside it is inert on purpose. */
    const modal = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"], dialog')]
      .filter((d) => visible(d) && d.getAttribute("aria-hidden") !== "true")
      .pop() ?? null;

    const label = (el) => {
      const t = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || "")
        .replace(/\s+/g, " ")
        .trim();
      return t.length > 40 ? t.slice(0, 40) + "…" : t || `<${el.tagName.toLowerCase()}>`;
    };
    const describe = (el) => {
      const cls = (el.getAttribute?.("class") || "").split(/\s+/).filter(Boolean).slice(0, 3);
      return `<${el.tagName.toLowerCase()}${cls.length ? ` class="${cls.join(" ")}"` : ""}>`;
    };

    const controls = [...document.querySelectorAll(o.pressableSelector)]
      .filter((el) => visible(el) && !inert(el))
      .filter((el) => !modal || modal.contains(el));

    let compared = 0;
    for (const el of controls) {
      const r = onScreen(el);
      if (r === null) continue;
      // Five probes rather than one, so the report can say whether the control is wholly buried
      // or merely clipped along one edge — which is the difference between a control nobody can
      // press and one that answers if you aim carefully.
      const inset = Math.max(2, Math.min(o.probeInsetPx, r.width / 4, r.height / 4));
      const points = [
        [r.left + r.width / 2, r.top + r.height / 2],
        [r.left + inset, r.top + inset],
        [r.right - inset, r.top + inset],
        [r.left + inset, r.bottom - inset],
        [r.right - inset, r.bottom - inset],
      ].filter(([x, y]) => x >= 0 && y >= 0 && x < window.innerWidth && y < window.innerHeight);
      if (points.length === 0) continue;
      compared += 1;

      let reached = 0;
      let blocker = null;
      for (const [x, y] of points) {
        const hit = document.elementFromPoint(x, y);
        if (hit && (hit === el || el.contains(hit) || hit.contains(el))) reached += 1;
        else if (!blocker && hit) blocker = hit;
      }
      if (reached === points.length) continue;

      const centreLost = (() => {
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !(hit && (hit === el || el.contains(hit) || hit.contains(el)));
      })();
      // A control whose edges are clipped but whose middle answers is where a reader aims anyway.
      if (!centreLost && reached >= o.minProbesReached) continue;

      findings.push(
        `「${label(el)}」 does not take a press` +
          (centreLost ? " at the middle of itself" : " across most of itself") +
          ` — ${reached} of ${points.length} points on it reach it, and ` +
          `${blocker ? describe(blocker) : "something else"} is what catches the press at ` +
          `(${Math.round(r.left + r.width / 2)}, ${Math.round(r.top + r.height / 2)}). ` +
          `Nothing shows this: the control is drawn where it belongs and whatever covers it is ` +
          `transparent, so a screenshot and a reader's eye both report a working footer.`,
      );
      if (findings.length >= o.maxFindings) break;
    }
    return { compared, findings };
  },
};

/**
 * An open pane that paints nothing — the reader pressed a tab and got a blank rectangle.
 *
 * The defect it exists to catch: a settings screen draws its header, its tiles, a notice and a
 * four-tab strip, and below the strip there is only the page footer. The pane's own component
 * ends in `if (!record) return null;`, so the one state where the reader most needs a sentence
 * is the state that renders nothing at all. Every string on the screen is correct, every
 * request answered, the build is green — and the tab the reader pressed answers with a gap.
 *
 * **Why it survives every other check.** `countedListDrawsNoRows` needs a total to compare
 * against and a blank pane states none; `textBoxesOverlap` needs two boxes and there is one;
 * a source audit sees a `return null` that is correct in a dozen other places — a cell with no
 * value, a badge with no enum, a banner nobody armed. What separates those from this is not the
 * statement, it is where the statement runs: **a region a reader reached by pressing something
 * owes them content, and nothing else does.** That is a fact about the painted page, so it is
 * only decidable here.
 *
 * **Read as blank means blank to a reader**, not merely textless: a pane holding one chart, one
 * map or one canvas is a pane that drew something. Hidden panes are already out — a tab set
 * hides the panes behind the tabs nobody pressed, and those are supposed to be empty.
 */
const openPaneDrawsNothing = {
  id: "openPaneDrawsNothing",
  grade: "error",
  title:
    "an open pane painting nothing — the reader pressed a tab and the region under it is a blank rectangle",
  page: (o) => {
    const findings = [];

    // Shown rather than merely present. A tab set keeps every pane in the tree and hides all but
    // one, so reading presence would report every screen's unopened tabs as blank — which is what
    // they are supposed to be.
    const shown = (el) => {
      if (el.hasAttribute("hidden")) return false;
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden") return false;
      if (el.getAttribute("aria-hidden") === "true") return false;
      return el.getBoundingClientRect().width >= o.minPaneWidthPx;
    };

    const where = (el) => {
      const bits = [];
      for (let n = el; n && n !== document.body && bits.length < 4; n = n.parentElement) {
        bits.unshift(
          n.tagName.toLowerCase() +
            (n.id ? "#" + n.id : "") +
            (n.className && typeof n.className === "string"
              ? "." + n.className.trim().split(/\s+/).slice(0, 2).join(".")
              : ""),
        );
      }
      return bits.join(" > ");
    };

    // What the tab said, so the report names the pane the way the reader reached it rather than
    // by a generated id nobody can look up. Radix and every library modelled on it point the
    // panel at its tab through `aria-labelledby`; a tab set that does not is named by its id.
    const openedBy = (el) => {
      const id = el.getAttribute("aria-labelledby");
      const tab = id ? document.getElementById(id) : null;
      const label = tab ? (tab.innerText || tab.textContent || "").replace(/\s+/g, " ").trim() : "";
      return label || el.getAttribute("data-value") || el.id || "(unnamed)";
    };

    const panes = [...document.querySelectorAll(o.paneSelector)].filter(shown);
    let compared = 0;

    for (const pane of panes) {
      compared += 1;
      if ((pane.innerText || "").trim().length > 0) continue;
      // A pane can be wordless and still full — one chart, one map, one signature canvas. Judged
      // on text alone those would be this check's first false positive, and a rendered audit that
      // cries once is a rendered audit nobody reads again.
      const drawn = [...pane.querySelectorAll(o.wordlessContentSelector)].some((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      if (drawn) continue;

      const r = pane.getBoundingClientRect();
      findings.push(
        `the pane behind 「${openedBy(pane)}」 is open and paints nothing — ` +
          `${Math.round(r.width)}×${Math.round(r.height)}px of its own padding, no text and no ` +
          `content of any other kind. Whatever renders it answers this state with nothing, so the ` +
          `reader pressed a tab and got a gap; the pane owes a title and a sentence saying what it ` +
          `holds and what makes it appear (${where(pane)})`,
      );
      if (findings.length >= o.maxFindings) break;
    }
    return { compared, findings };
  },
};

/**
 * A region crushed to a sliver of what it holds.
 *
 * <p><b>The list is there, the requests answered, every string right — and the reader sees
 * twenty-one pixels of it.</b> A page laid out as one column that must fit the fold hands its
 * flexible child whatever the fixed content above it left over, and `min-h-0` lets that be
 * almost nothing. Nothing errors, nothing is missing, and the page cannot be scrolled to reveal
 * the rest because nothing overflows — the child shrank instead.
 *
 * <p><b>It is invisible to every other check.</b> The rows are in the accessibility tree, so a
 * tree reading finds them all; the total says 31 and the column draws 31; the pane paints
 * plenty. Only the geometry says the reader can reach none of it.
 *
 * <p><b>Judged on the ratio and the height together.</b> A healthy internal scroller is hundreds
 * of pixels tall and holds two or three times that; a collapsed accordion is zero and is
 * collapsed on purpose; a toolbar that scrolls sideways holds exactly its own height. What is
 * left is a region that clips nearly everything it holds while still claiming to be open.
 */
const regionCrushedToASliver = {
  id: "regionCrushedToASliver",
  grade: "error",
  title:
    "a region painted as a sliver of what it holds — the content is there and the reader can reach almost none of it",
  page: (o) => {
    const findings = [];
    const seen = [];
    let compared = 0;

    for (const el of document.querySelectorAll("*")) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      // Only a region that clips can hide what it holds. An `overflow: visible` element paints
      // its content past its own box, so the reader sees it whatever the box measures.
      if (style.overflowY === "visible") continue;

      const rect = el.getBoundingClientRect();
      // A region, not a control or a rule: something wide enough to have been holding a screen.
      if (rect.width < o.minRegionWidthPx) continue;

      const shown = el.clientHeight;
      const held = el.scrollHeight;
      // Zero is a region deliberately closed — an accordion, a collapsed panel — and only when it
      // clips. A region that SCROLLS carries a promise the reader can reach what is in it, so zero
      // there is the worst crush this check exists to catch rather than an exemption from it: a
      // detail body measuring 0px over 1927px of a panel somebody just opened reported nothing,
      // because the one branch meant for a closed accordion swallowed it.
      const scrolls = style.overflowY === "auto" || style.overflowY === "scroll";
      if (shown < 0 || (shown === 0 && !scrolls)) continue;
      if (shown >= o.minRegionHeightPx) continue;
      if (held < o.crushedContentPx) continue;
      if (held < shown * o.crushedRatio) continue;

      // The outermost one only. A crushed region crushes everything inside it, and reporting the
      // whole chain buries the one element whose height decided it.
      if (seen.some((other) => other.contains(el))) continue;
      seen.push(el);
      compared += 1;

      const name = el.tagName.toLowerCase()
        + (el.id ? "#" + el.id : "")
        + (typeof el.className === "string" && el.className
          ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".")
          : "");
      findings.push(
        `${name} is ${Math.round(rect.width)}\u00d7${Math.round(shown)}px and holds ` +
          `${Math.round(held)}px, so the reader reaches about ` +
          `${Math.round((shown / held) * 100)}% of what is in it and no scrollbar says so — ` +
          `the region did not overflow, it shrank. A column told to fit the fold hands its ` +
          `flexible child whatever the fixed content above it left over, and \`min-h-0\` lets ` +
          `that be almost nothing: let the page own the scroll, or give the region a floor`,
      );
      if (findings.length >= o.maxFindings) break;
    }

    return { compared, findings };
  },
};

/**
 * A page that cannot move with a strip inside it that can.
 *
 * <p>A list panel is given `overflow-auto` so that a long list stays inside its column while a
 * detail stands beside it. **Beside an open detail that is right, and on its own it is the
 * defect** — the reader works down a 1769px list through a 690px window while the tiles, the tab
 * strip and the page's own header stand still around it, and nothing on the screen says the rest
 * of the page is not what is moving.
 *
 * <p><b>It is invisible to a source audit, and it is invisible to a screenshot.</b> The class is
 * on a framework component that every list in the console shares, so no screen file carries a
 * mark; and a picture of a scrolling list looks exactly like a picture of a scrolling page. What
 * separates them is one comparison — which box's `scrollHeight` exceeds its `clientHeight` — and
 * that is a question only the live page answers.
 *
 * <p><b>What makes it decidable is what stands beside the region, not what the region is called.</b>
 * A column with a wide neighbour sharing its vertical band is one track of a two-track layout and
 * scrolls in its own track by design. A region with nothing beside it is the page's content, and
 * the page is what should be scrolling it.
 *
 * <p>Quiet wherever the reader can still move something: a document that scrolls, an ancestor
 * that scrolls, anything inside a dialog, a drawer or a menu, and any form control that scrolls
 * its own value.
 */
const pageFrozenAroundAScrollingRegion = {
  id: "pageFrozenAroundAScrollingRegion",
  grade: "error",
  title:
    "a region scrolling its own content while the page around it cannot move \u2014 the reader works a strip inside a frozen screen",
  page: (o) => {
    const findings = [];
    let compared = 0;

    const canScroll = (el) => {
      const oy = getComputedStyle(el).overflowY;
      return oy === "auto" || oy === "scroll";
    };
    const overflows = (el) => {
      const over = el.scrollHeight - el.clientHeight;
      // A region that also scrolls sideways carries its own horizontal bar, and on a platform
      // that draws that bar inside the box it takes height off `clientHeight` and invents a
      // vertical overflow that was never content.
      const sideways = el.scrollWidth - el.clientWidth > 0;
      return over > (sideways ? o.strandedSidewaysSlackPx : o.strandedScrollSlackPx);
    };

    const de = document.documentElement;
    const pageMoves = de.scrollHeight - de.clientHeight > o.strandedScrollSlackPx;

    const OVERLAY = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [role="tooltip"], [aria-modal="true"]';

    for (const el of document.querySelectorAll("*")) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      if (style.overflowY !== "auto" && style.overflowY !== "scroll") continue;
      if (!overflows(el)) continue;

      const rect = el.getBoundingClientRect();
      // A region, not a control: something wide and tall enough to have been holding the screen.
      if (rect.width < o.minRegionWidthPx) continue;
      if (rect.height < o.minStrandedRegionHeightPx) continue;

      // A control that scrolls its own value, and a block that scrolls its own listing. Both are
      // the reader's to scroll and neither is the page's content.
      if (el.matches("textarea, select, pre, code, [contenteditable], [contenteditable] *")) continue;

      // Anything the reader opened over the page. A dialog, a drawer and a menu scroll their own
      // content by design, and the page behind them is meant to hold still.
      if (el.closest(OVERLAY)) continue;

      // **The page behind one, too.** A modal freezes the document and marks everything under it
      // `aria-hidden` or `inert`, so the screen's own regions become the only things that move and
      // every one of them reads as a strip in a frozen page — on a screen that passes this check
      // the moment the dialog closes. The reader cannot reach any of it, which is the point of a
      // modal and is why this is not a finding about the screen.
      if (el.closest('[aria-hidden="true"], [inert]')) continue;

      compared += 1;
      if (pageMoves) continue;

      // Something standing beside it makes this one track of a two-track layout, and a track
      // scrolls in its own box. Beside means sharing the vertical band and sitting clear of it
      // horizontally \u2014 a toolbar crossing the top edge is above, not beside.
      //
      // <b>The column it is in counts, not only the box it is in.</b> A detail panel is a strip of
      // chrome, a scrolling body and a footer, and the body's own siblings are that chrome \u2014 so
      // a test that stops at the parent finds nothing beside it and reports the panel, on every
      // list-and-detail screen the moment the detail is long enough to scroll. The list standing
      // next to that panel is four boxes further out, and it is what makes the body a track.
      const standsBeside = (box) => {
        const parent = box.parentElement;
        if (!parent) return false;
        const own = box.getBoundingClientRect();
        return Array.from(parent.children).some((sib) => {
          if (sib === box) return false;
          const r = sib.getBoundingClientRect();
          if (r.width < o.minRegionWidthPx) return false;
          const shared = Math.min(own.bottom, r.bottom) - Math.max(own.top, r.top);
          if (shared < own.height * o.besideOverlapRatio) return false;
          return r.right <= own.left + 1 || r.left >= own.right - 1;
        });
      };
      let beside = false;
      for (let box = el; box && box !== de && !beside; box = box.parentElement) {
        beside = standsBeside(box);
      }
      if (beside) continue;

      // **The box that was supposed to scroll.** Walking out, the first ancestor that CAN scroll is
      // either already scrolling \u2014 in which case the page moves after all, one box further out,
      // and the reader is not stuck \u2014 or it is not, in which case that is the box the region was
      // fitted into and the box a fix changes.
      //
      // <b>Quiet when no ancestor could ever have scrolled.</b> A shell clipping with
      // `overflow: hidden` all the way out leaves nothing to hand the scroll to, and the region's
      // own overflow is the only thing keeping the rows reachable at all. That is a shell to
      // change rather than a region, and this check does not pretend to have decided it.
      let port = null;
      let held = false;
      let up = el.parentElement;
      while (up && up !== de) {
        if (canScroll(up)) {
          if (overflows(up)) { held = true; break; }
          if (!port) port = up;
        }
        up = up.parentElement;
      }
      if (held) continue;
      if (!port) continue;

      // **Something has to be standing still for the reader to be stuck.** A region that fills its
      // scrollport with nothing above it is the page scrolling, whatever element the scrollbar
      // happens to hang off \u2014 and an app shell whose content area owns the scroll looks exactly
      // like this. What makes the defect is chrome INSIDE the same scrollport that the region's
      // scroll leaves behind: the page's own header, its tiles, its tab strip. Nothing above the
      // region is not a milder version of the defect, it is a different screen.
      //
      // It is looked for inside that box and nowhere else, which is what keeps a top bar and a
      // side navigation out of it \u2014 they sit outside the scroller and are meant to stay.
      let frozen = null;
      for (const other of port.querySelectorAll("*")) {
        if (other === el || el.contains(other) || other.contains(el)) continue;
        const cs = getComputedStyle(other);
        if (cs.display === "none" || cs.visibility === "hidden") continue;
        const r = other.getBoundingClientRect();
        if (r.height < o.frozenChromeMinHeightPx) continue;
        // Entirely above it, and over the same columns \u2014 a strip off to one side is beside the
        // region rather than over it, and stays in view either way.
        if (r.bottom > rect.top + 1) continue;
        if (r.right <= rect.left || r.left >= rect.right) continue;
        frozen = other;
        break;
      }
      // Nothing above it: the region IS the page's content, and its scrollbar is the page's.
      if (!frozen) continue;

      const frozenName = frozen.tagName.toLowerCase()
        + (typeof frozen.className === "string" && frozen.className
          ? "." + frozen.className.trim().split(/\s+/).slice(0, 2).join(".")
          : "");

      const name = el.tagName.toLowerCase()
        + (el.id ? "#" + el.id : "")
        + (typeof el.className === "string" && el.className
          ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".")
          : "");
      findings.push(
        `${name} is ${Math.round(rect.width)}\u00d7${Math.round(rect.height)}px, holds `
          + `${Math.round(el.scrollHeight)}px and is the only thing on this page that moves. `
          + `The document does not scroll, no ancestor of it scrolls, and nothing stands beside it \u2014 `
          + `while ${frozenName} sits above it inside the same scrollport and stays where it is. `
          + `So the reader works down a strip through a frozen screen, and no scrollbar anywhere `
          + `says the rest of the page was never the part that was stuck. A region with nothing beside it is the page's content: let the `
          + `page scroll it, and keep the region's own \`overflow\` for the state where a second `
          + `column stands next to it`,
      );
      if (findings.length >= o.maxFindings) break;
    }

    return { compared, findings };
  },
};

export const checks = [
  countedListDrawsNoRows,
  textBoxesOverlap,
  blockInsideParagraph,
  pressableControlsTakeThePress,
  openPaneDrawsNothing,
  regionCrushedToASliver,
  pageFrozenAroundAScrollingRegion,
];

/** One self-contained expression, ready for any driver's evaluate call. */
export function snippet(check, options = {}) {
  const o = { ...DEFAULTS, ...options };
  return `(${String(check.page)})(${JSON.stringify(o)})`;
}

// ---------------------------------------------------------------------------
// Driving a browser
// ---------------------------------------------------------------------------

/**
 * `agent-browser` is the driver of record. The session name is its own so a run here never
 * takes over the tab another agent is signed into — two runs sharing one profile produce
 * captures and readings of the wrong screen that look entirely correct.
 */
function agentBrowser(session, args) {
  return execFileSync("agent-browser", ["--session", session, ...args, "--json"], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
}

/** Waits without a timer, so the driver stays synchronous alongside `execFileSync`. */
function pause(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Whether a daemon is already serving this session name.
 *
 * <p>A named session holds a full browser between commands and ends only when something closes
 * it — not when this process exits. So the run has to know whether it opened the session or
 * joined one, because closing a session the caller is mid-audit in takes their signed-in state
 * with it, and leaving one this run opened leaves a browser resident with nobody to reclaim it.
 */
function sessionIsRunning(session) {
  try {
    const pid = Number(fs.readFileSync(path.join(os.homedir(), ".agent-browser", `${session}.pid`), "utf8").trim());
    if (!Number.isInteger(pid) || pid <= 0) return false;
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Closes one session by name.
 *
 * <p>Never `close --all`: the daemon is shared, so that flag ends every other agent's session
 * too. Failure here is reported and not thrown — a browser left open is worth a line on stderr
 * and never worth losing the audit's own result over.
 */
function closeSession(session) {
  try {
    agentBrowser(session, ["close"]);
  } catch (e) {
    console.error(`⚠ could not close browser session ${session}: ${e.message}`);
  }
}

function evaluateOnce(session, check, options) {
  const parsed = JSON.parse(agentBrowser(session, ["eval", snippet(check, options)]));
  if (!parsed.success) throw new Error(parsed.error || "eval failed");
  return parsed.data.result;
}

/**
 * Opens the page and measures it once the screen has stopped arriving.
 *
 * <p><b>A list fetches its rows after the document loads, so evaluating at `open` measures the
 * shell.</b> The total badge is not painted yet, the table body is empty, and every check reports
 * `compared 0` — which prints beside a `✔` and reads exactly like a screen with nothing wrong. The
 * defect this file exists to catch lives in the state that arrives a few hundred milliseconds
 * later, so the measurement waits for it.
 *
 * <p><b>Settled means two consecutive readings compared the same number of things</b>, not a fixed
 * sleep: a slow read costs the whole budget and a fast one costs one interval. The last reading is
 * the one reported even when nothing ever settles, because a page that never stops changing is a
 * finding a reader has to see rather than an error that hides it.
 */
function evaluate(session, url, check, options) {
  agentBrowser(session, ["open", url]);

  let previous = null;
  let result = evaluateOnce(session, check, options);
  for (let waited = 0; waited < options.settleMs; waited += options.settleIntervalMs) {
    if (result.compared > 0 && previous !== null && result.compared === previous) break;
    previous = result.compared;
    pause(options.settleIntervalMs);
    result = evaluateOnce(session, check, options);
  }
  return result;
}

// ---------------------------------------------------------------------------
// The fixtures the self-test drives — generated, never kept
// ---------------------------------------------------------------------------

/**
 * Per check: the defect it exists to catch, and the pages it must stay quiet on. They are
 * written to a temporary directory and deleted, because a fixture left on disk beside real
 * pages cannot be told from one — both are files, both look shot.
 *
 * **The clean side carries more than one page on purpose.** A check that fires on everything
 * and a check that fires on nothing both pass a single pair, and the way this family fires on
 * everything is specific and predictable: reading any number as a row total, or any overlap
 * as a collision. So each `quiet` page is a shape that tempts exactly that — a dashboard of
 * stat tiles, a list that is honestly empty, a dialog over a page, a sticky header scrolled
 * across content.
 */
const FIXTURES = {
  pageFrozenAroundAScrollingRegion: {
    broken: {
      // The shape this check was written from: a console page whose shell is the height of the
      // window, a strip of page chrome above the list, and the list given the leftovers with
      // `overflow-auto`. Nothing on the page moves except the rows.
      "a list scrolling itself under page chrome that cannot move":
        `<style>html,body{margin:0;height:100%;overflow:hidden;font:14px sans-serif}
        .page{display:flex;flex-direction:column;height:600px;width:1100px;overflow:auto}
        .chrome{flex:none;padding:12px;background:#f4f4f5}
        .list{flex:1;min-height:0;overflow:auto}
        table{width:100%;border-collapse:collapse}td{padding:12px;border-bottom:1px solid #ddd}</style>
        <div class=page><div class=chrome>전체 20건 · 비상 연락처</div>
        <div class=list><table><tbody><tr><td>119 종합상황실</td><td>02-000-1000</td></tr><tr><td>관할 소방서</td><td>02-000-1001</td></tr><tr><td>관할 경찰서</td><td>02-000-1002</td></tr><tr><td>협력 병원</td><td>02-000-1003</td></tr><tr><td>환경청 상황실</td><td>02-000-1004</td></tr><tr><td>안전보건공단</td><td>02-000-1005</td></tr><tr><td>한국가스안전공사</td><td>02-000-1006</td></tr><tr><td>한국전기안전공사</td><td>02-000-1007</td></tr><tr><td>관할 지방고용노동관서</td><td>02-000-1008</td></tr><tr><td>야간 당직 안전담당</td><td>02-000-1009</td></tr><tr><td>사업장 안전보건관리책임자</td><td>02-000-1010</td></tr><tr><td>협력사 현장대리인</td><td>02-000-1011</td></tr><tr><td>가스 공급사 비상연락</td><td>02-000-1012</td></tr><tr><td>전기 수전실 당직</td><td>02-000-1013</td></tr><tr><td>폐수처리 위탁사</td><td>02-000-1014</td></tr><tr><td>산업보건의</td><td>02-000-1015</td></tr><tr><td>보건관리자</td><td>02-000-1016</td></tr><tr><td>소방안전관리자</td><td>02-000-1017</td></tr><tr><td>방재실</td><td>02-000-1018</td></tr><tr><td>정문 경비</td><td>02-000-1019</td></tr></tbody></table></div></div>`,
      // The same defect in the layout a list-detail screen actually uses: one grid in both states,
      // with the detail's track at zero while it is closed. A neighbour test that counts elements
      // rather than the width they occupy reads that empty track as a column and goes quiet here.
      "a list scrolling beside a detail track collapsed to nothing":
        `<style>html,body{margin:0;height:100%;overflow:hidden;font:14px sans-serif}
        .page{display:flex;flex-direction:column;height:600px;width:1100px;overflow:auto}
        .chrome{flex:none;padding:12px;background:#f4f4f5}
        .split{flex:1;min-height:0;display:grid;grid-template-columns:1fr 0px 0px;overflow:hidden}
        .list{min-height:0;overflow:auto}
        .divider{width:0}.detail{width:0;overflow:hidden}
        table{width:100%;border-collapse:collapse}td{padding:12px;border-bottom:1px solid #ddd}</style>
        <div class=page><div class=chrome>전체 20건 · 비상 연락처</div>
        <div class=split><div class=list><table><tbody><tr><td>119 종합상황실</td><td>02-000-1000</td></tr><tr><td>관할 소방서</td><td>02-000-1001</td></tr><tr><td>관할 경찰서</td><td>02-000-1002</td></tr><tr><td>협력 병원</td><td>02-000-1003</td></tr><tr><td>환경청 상황실</td><td>02-000-1004</td></tr><tr><td>안전보건공단</td><td>02-000-1005</td></tr><tr><td>한국가스안전공사</td><td>02-000-1006</td></tr><tr><td>한국전기안전공사</td><td>02-000-1007</td></tr><tr><td>관할 지방고용노동관서</td><td>02-000-1008</td></tr><tr><td>야간 당직 안전담당</td><td>02-000-1009</td></tr><tr><td>사업장 안전보건관리책임자</td><td>02-000-1010</td></tr><tr><td>협력사 현장대리인</td><td>02-000-1011</td></tr><tr><td>가스 공급사 비상연락</td><td>02-000-1012</td></tr><tr><td>전기 수전실 당직</td><td>02-000-1013</td></tr><tr><td>폐수처리 위탁사</td><td>02-000-1014</td></tr><tr><td>산업보건의</td><td>02-000-1015</td></tr><tr><td>보건관리자</td><td>02-000-1016</td></tr><tr><td>소방안전관리자</td><td>02-000-1017</td></tr><tr><td>방재실</td><td>02-000-1018</td></tr><tr><td>정문 경비</td><td>02-000-1019</td></tr></tbody></table></div>
        <div class=divider></div><div class=detail></div></div></div>`,
    },
    quiet: {
      // The shape every list-and-detail screen takes once the detail is long enough to scroll: a
      // panel of tab strip, scrolling body and footer, standing beside the list. The body's own
      // siblings are that chrome, so a beside-test that stops at the parent finds nothing next to
      // it and reports the panel \u2014 while the list making it one track of two is four boxes out.
      "a detail panel's body scrolling between its tab strip and its footer, beside a list":
        `<style>html,body{margin:0;height:100%;overflow:hidden;font:14px sans-serif}
        .page{display:flex;flex-direction:column;height:600px;width:1100px;overflow:hidden}
        .chrome{flex:none;padding:12px;background:#f4f4f5}
        .split{flex:1;min-height:0;display:grid;grid-template-columns:520px 16px 1fr}
        .list{min-height:0;overflow:auto}
        .divider{background:#ddd}
        .panel{min-height:0;display:flex;flex-direction:column}
        .tabs{flex:none;padding:10px 12px;border-bottom:1px solid #eee}
        .panelbody{flex:1;min-height:0;overflow:auto}
        .panelfoot{flex:none;padding:10px 12px;border-top:1px solid #eee}
        table{width:100%;border-collapse:collapse}td{padding:12px;border-bottom:1px solid #ddd}
        p{margin:0;padding:10px;border-bottom:1px solid #eee}</style>
        <div class=page><div class=chrome>전체 20건 · 비상 연락처</div>
        <div class=split><div class=list><table><tbody><tr><td>119 종합상황실</td><td>02-000-1000</td></tr><tr><td>관할 소방서</td><td>02-000-1001</td></tr><tr><td>관할 경찰서</td><td>02-000-1002</td></tr><tr><td>협력 병원</td><td>02-000-1003</td></tr><tr><td>환경청 상황실</td><td>02-000-1004</td></tr><tr><td>안전보건공단</td><td>02-000-1005</td></tr><tr><td>한국가스안전공사</td><td>02-000-1006</td></tr><tr><td>한국전기안전공사</td><td>02-000-1007</td></tr><tr><td>관할 지방고용노동관서</td><td>02-000-1008</td></tr><tr><td>야간 당직 안전담당</td><td>02-000-1009</td></tr><tr><td>사업장 안전보건관리책임자</td><td>02-000-1010</td></tr><tr><td>협력사 현장대리인</td><td>02-000-1011</td></tr></tbody></table></div>
        <div class=divider></div>
        <div class=panel><div class=tabs>개요 · 반영 · 남은 오류 · 매핑</div>
        <div class=panelbody><p>01. 야간 당직 인수인계 사항</p><p>02. 야간 당직 인수인계 사항</p><p>03. 야간 당직 인수인계 사항</p><p>04. 야간 당직 인수인계 사항</p><p>05. 야간 당직 인수인계 사항</p><p>06. 야간 당직 인수인계 사항</p><p>07. 야간 당직 인수인계 사항</p><p>08. 야간 당직 인수인계 사항</p><p>09. 야간 당직 인수인계 사항</p><p>10. 야간 당직 인수인계 사항</p><p>11. 야간 당직 인수인계 사항</p><p>12. 야간 당직 인수인계 사항</p><p>13. 야간 당직 인수인계 사항</p><p>14. 야간 당직 인수인계 사항</p></div>
        <div class=panelfoot>닫기 · 되돌리기</div></div></div></div>`,
      // A modal over the page this check was written from. The document is frozen and the app
      // root is `aria-hidden`, so the page's own list becomes the only thing that moves — and it
      // is a region behind a modal, which the reader cannot reach at all. The same screen with
      // the modal closed is the `broken` page above, so a check that fires here is answering
      // 「is a dialog open」 rather than 「is this screen stuck」.
      "a frozen page behind an open modal, with its own list still scrolling":
        `<style>html,body{margin:0;height:100%;overflow:hidden;font:14px sans-serif}
        .page{display:flex;flex-direction:column;height:600px;width:1100px;overflow:auto}
        .chrome{flex:none;padding:12px;background:#f4f4f5}
        .list{flex:1;min-height:0;overflow:auto}
        table{width:100%;border-collapse:collapse}td{padding:12px;border-bottom:1px solid #ddd}
        .modal{position:fixed;top:60px;left:300px;width:420px;padding:20px;background:#fff;border:1px solid #ccc}</style>
        <div aria-hidden="true"><div class=page><div class=chrome>전체 20건 · 비상 연락처</div>
        <div class=list><table><tbody><tr><td>119 종합상황실</td><td>02-000-1000</td></tr><tr><td>관할 소방서</td><td>02-000-1001</td></tr><tr><td>관할 경찰서</td><td>02-000-1002</td></tr><tr><td>협력 병원</td><td>02-000-1003</td></tr><tr><td>환경청 상황실</td><td>02-000-1004</td></tr><tr><td>안전보건공단</td><td>02-000-1005</td></tr><tr><td>한국가스안전공사</td><td>02-000-1006</td></tr><tr><td>한국전기안전공사</td><td>02-000-1007</td></tr><tr><td>관할 지방고용노동관서</td><td>02-000-1008</td></tr><tr><td>야간 당직 안전담당</td><td>02-000-1009</td></tr><tr><td>사업장 안전보건관리책임자</td><td>02-000-1010</td></tr><tr><td>협력사 현장대리인</td><td>02-000-1011</td></tr><tr><td>가스 공급사 비상연락</td><td>02-000-1012</td></tr><tr><td>전기 수전실 당직</td><td>02-000-1013</td></tr><tr><td>폐수처리 위탁사</td><td>02-000-1014</td></tr><tr><td>산업보건의</td><td>02-000-1015</td></tr><tr><td>보건관리자</td><td>02-000-1016</td></tr><tr><td>소방안전관리자</td><td>02-000-1017</td></tr><tr><td>방재실</td><td>02-000-1018</td></tr><tr><td>정문 경비</td><td>02-000-1019</td></tr></tbody></table></div></div></div>
        <div class=modal role=dialog aria-modal=true>되돌리기 근거를 적습니다</div>`,
      // The state the region's own overflow exists for: a detail stands beside the list, the page
      // must hold still or the detail would slide away with it, and each column scrolls in its
      // own track. Both columns scroll here and neither may be reported.
      "a list and a detail each scrolling in their own track":
        `<style>html,body{margin:0;height:100%;overflow:hidden;font:14px sans-serif}
        .page{display:flex;flex-direction:column;height:600px;width:1100px;overflow:auto}
        .chrome{flex:none;padding:12px;background:#f4f4f5}
        .split{flex:1;min-height:0;display:grid;grid-template-columns:560px 17px 1fr;overflow:hidden}
        .list,.detail{min-height:0;overflow:auto}
        .divider{background:#ddd}
        table{width:100%;border-collapse:collapse}td{padding:12px;border-bottom:1px solid #ddd}
        p{margin:0;padding:10px;border-bottom:1px solid #eee}</style>
        <div class=page><div class=chrome>전체 20건 · 비상 연락처</div>
        <div class=split><div class=list><table><tbody><tr><td>119 종합상황실</td><td>02-000-1000</td></tr><tr><td>관할 소방서</td><td>02-000-1001</td></tr><tr><td>관할 경찰서</td><td>02-000-1002</td></tr><tr><td>협력 병원</td><td>02-000-1003</td></tr><tr><td>환경청 상황실</td><td>02-000-1004</td></tr><tr><td>안전보건공단</td><td>02-000-1005</td></tr><tr><td>한국가스안전공사</td><td>02-000-1006</td></tr><tr><td>한국전기안전공사</td><td>02-000-1007</td></tr><tr><td>관할 지방고용노동관서</td><td>02-000-1008</td></tr><tr><td>야간 당직 안전담당</td><td>02-000-1009</td></tr><tr><td>사업장 안전보건관리책임자</td><td>02-000-1010</td></tr><tr><td>협력사 현장대리인</td><td>02-000-1011</td></tr><tr><td>가스 공급사 비상연락</td><td>02-000-1012</td></tr><tr><td>전기 수전실 당직</td><td>02-000-1013</td></tr><tr><td>폐수처리 위탁사</td><td>02-000-1014</td></tr><tr><td>산업보건의</td><td>02-000-1015</td></tr><tr><td>보건관리자</td><td>02-000-1016</td></tr><tr><td>소방안전관리자</td><td>02-000-1017</td></tr><tr><td>방재실</td><td>02-000-1018</td></tr><tr><td>정문 경비</td><td>02-000-1019</td></tr></tbody></table></div>
        <div class=divider></div><div class=detail><h2>관할 소방서</h2><p>01. 야간 당직 인수인계 사항</p><p>02. 야간 당직 인수인계 사항</p><p>03. 야간 당직 인수인계 사항</p><p>04. 야간 당직 인수인계 사항</p><p>05. 야간 당직 인수인계 사항</p><p>06. 야간 당직 인수인계 사항</p><p>07. 야간 당직 인수인계 사항</p><p>08. 야간 당직 인수인계 사항</p><p>09. 야간 당직 인수인계 사항</p><p>10. 야간 당직 인수인계 사항</p><p>11. 야간 당직 인수인계 사항</p><p>12. 야간 당직 인수인계 사항</p><p>13. 야간 당직 인수인계 사항</p><p>14. 야간 당직 인수인계 사항</p><p>15. 야간 당직 인수인계 사항</p><p>16. 야간 당직 인수인계 사항</p><p>17. 야간 당직 인수인계 사항</p><p>18. 야간 당직 인수인계 사항</p><p>19. 야간 당직 인수인계 사항</p><p>20. 야간 당직 인수인계 사항</p><p>21. 야간 당직 인수인계 사항</p><p>22. 야간 당직 인수인계 사항</p><p>23. 야간 당직 인수인계 사항</p><p>24. 야간 당직 인수인계 사항</p><p>25. 야간 당직 인수인계 사항</p><p>26. 야간 당직 인수인계 사항</p><p>27. 야간 당직 인수인계 사항</p><p>28. 야간 당직 인수인계 사항</p><p>29. 야간 당직 인수인계 사항</p><p>30. 야간 당직 인수인계 사항</p><p>31. 야간 당직 인수인계 사항</p><p>32. 야간 당직 인수인계 사항</p><p>33. 야간 당직 인수인계 사항</p><p>34. 야간 당직 인수인계 사항</p><p>35. 야간 당직 인수인계 사항</p><p>36. 야간 당직 인수인계 사항</p><p>37. 야간 당직 인수인계 사항</p><p>38. 야간 당직 인수인계 사항</p><p>39. 야간 당직 인수인계 사항</p><p>40. 야간 당직 인수인계 사항</p></div></div></div>`,
      // A region that scrolls on a page that also scrolls. Two bars is a layout to tidy; it is not
      // a reader stuck in a strip, because the page moves under them.
      "a region scrolling on a page that scrolls as well":
        `<style>html,body{margin:0;font:14px sans-serif}
        .list{width:900px;height:300px;overflow:auto}
        .rest{height:2400px}
        table{width:100%;border-collapse:collapse}td{padding:12px;border-bottom:1px solid #ddd}</style>
        <div class=list><table><tbody><tr><td>119 종합상황실</td><td>02-000-1000</td></tr><tr><td>관할 소방서</td><td>02-000-1001</td></tr><tr><td>관할 경찰서</td><td>02-000-1002</td></tr><tr><td>협력 병원</td><td>02-000-1003</td></tr><tr><td>환경청 상황실</td><td>02-000-1004</td></tr><tr><td>안전보건공단</td><td>02-000-1005</td></tr><tr><td>한국가스안전공사</td><td>02-000-1006</td></tr><tr><td>한국전기안전공사</td><td>02-000-1007</td></tr><tr><td>관할 지방고용노동관서</td><td>02-000-1008</td></tr><tr><td>야간 당직 안전담당</td><td>02-000-1009</td></tr><tr><td>사업장 안전보건관리책임자</td><td>02-000-1010</td></tr><tr><td>협력사 현장대리인</td><td>02-000-1011</td></tr><tr><td>가스 공급사 비상연락</td><td>02-000-1012</td></tr><tr><td>전기 수전실 당직</td><td>02-000-1013</td></tr><tr><td>폐수처리 위탁사</td><td>02-000-1014</td></tr><tr><td>산업보건의</td><td>02-000-1015</td></tr><tr><td>보건관리자</td><td>02-000-1016</td></tr><tr><td>소방안전관리자</td><td>02-000-1017</td></tr><tr><td>방재실</td><td>02-000-1018</td></tr><tr><td>정문 경비</td><td>02-000-1019</td></tr></tbody></table></div>
        <div class=rest>이 아래로 페이지가 이어집니다.</div>`,
      // What the reader opened over the page. The page behind a dialog is meant to hold still, and
      // the dialog's own body is what they scroll.
      "a dialog body scrolling over a page that holds still":
        `<style>html,body{margin:0;height:100%;overflow:hidden;font:14px sans-serif}
        .dlg{width:600px;margin:40px auto;border:1px solid #ccc}
        .body{height:300px;overflow:auto}
        p{margin:0;padding:10px;border-bottom:1px solid #eee}</style>
        <div role=dialog aria-modal=true class=dlg><h2>야간 당직 인수인계</h2>
        <div class=body><p>01. 야간 당직 인수인계 사항</p><p>02. 야간 당직 인수인계 사항</p><p>03. 야간 당직 인수인계 사항</p><p>04. 야간 당직 인수인계 사항</p><p>05. 야간 당직 인수인계 사항</p><p>06. 야간 당직 인수인계 사항</p><p>07. 야간 당직 인수인계 사항</p><p>08. 야간 당직 인수인계 사항</p><p>09. 야간 당직 인수인계 사항</p><p>10. 야간 당직 인수인계 사항</p><p>11. 야간 당직 인수인계 사항</p><p>12. 야간 당직 인수인계 사항</p><p>13. 야간 당직 인수인계 사항</p><p>14. 야간 당직 인수인계 사항</p><p>15. 야간 당직 인수인계 사항</p><p>16. 야간 당직 인수인계 사항</p><p>17. 야간 당직 인수인계 사항</p><p>18. 야간 당직 인수인계 사항</p><p>19. 야간 당직 인수인계 사항</p><p>20. 야간 당직 인수인계 사항</p><p>21. 야간 당직 인수인계 사항</p><p>22. 야간 당직 인수인계 사항</p><p>23. 야간 당직 인수인계 사항</p><p>24. 야간 당직 인수인계 사항</p><p>25. 야간 당직 인수인계 사항</p><p>26. 야간 당직 인수인계 사항</p><p>27. 야간 당직 인수인계 사항</p><p>28. 야간 당직 인수인계 사항</p><p>29. 야간 당직 인수인계 사항</p><p>30. 야간 당직 인수인계 사항</p><p>31. 야간 당직 인수인계 사항</p><p>32. 야간 당직 인수인계 사항</p><p>33. 야간 당직 인수인계 사항</p><p>34. 야간 당직 인수인계 사항</p><p>35. 야간 당직 인수인계 사항</p><p>36. 야간 당직 인수인계 사항</p><p>37. 야간 당직 인수인계 사항</p><p>38. 야간 당직 인수인계 사항</p><p>39. 야간 당직 인수인계 사항</p><p>40. 야간 당직 인수인계 사항</p></div></div>`,
      // A navigation column. It is narrow, it is tall and it scrolls its own entries — and the
      // content area standing beside it is what says the reader is not stuck.
      "a navigation column scrolling beside the content":
        `<style>html,body{margin:0;height:100%;overflow:hidden;font:14px sans-serif}
        .shell{display:flex;height:600px;width:1100px}
        .nav{width:260px;overflow:auto;border-right:1px solid #ddd}
        .content{flex:1;padding:16px}
        p{margin:0;padding:10px}</style>
        <div class=shell><div class=nav><p>01. 야간 당직 인수인계 사항</p><p>02. 야간 당직 인수인계 사항</p><p>03. 야간 당직 인수인계 사항</p><p>04. 야간 당직 인수인계 사항</p><p>05. 야간 당직 인수인계 사항</p><p>06. 야간 당직 인수인계 사항</p><p>07. 야간 당직 인수인계 사항</p><p>08. 야간 당직 인수인계 사항</p><p>09. 야간 당직 인수인계 사항</p><p>10. 야간 당직 인수인계 사항</p><p>11. 야간 당직 인수인계 사항</p><p>12. 야간 당직 인수인계 사항</p><p>13. 야간 당직 인수인계 사항</p><p>14. 야간 당직 인수인계 사항</p><p>15. 야간 당직 인수인계 사항</p><p>16. 야간 당직 인수인계 사항</p><p>17. 야간 당직 인수인계 사항</p><p>18. 야간 당직 인수인계 사항</p><p>19. 야간 당직 인수인계 사항</p><p>20. 야간 당직 인수인계 사항</p><p>21. 야간 당직 인수인계 사항</p><p>22. 야간 당직 인수인계 사항</p><p>23. 야간 당직 인수인계 사항</p><p>24. 야간 당직 인수인계 사항</p><p>25. 야간 당직 인수인계 사항</p><p>26. 야간 당직 인수인계 사항</p><p>27. 야간 당직 인수인계 사항</p><p>28. 야간 당직 인수인계 사항</p><p>29. 야간 당직 인수인계 사항</p><p>30. 야간 당직 인수인계 사항</p><p>31. 야간 당직 인수인계 사항</p><p>32. 야간 당직 인수인계 사항</p><p>33. 야간 당직 인수인계 사항</p><p>34. 야간 당직 인수인계 사항</p><p>35. 야간 당직 인수인계 사항</p><p>36. 야간 당직 인수인계 사항</p><p>37. 야간 당직 인수인계 사항</p><p>38. 야간 당직 인수인계 사항</p><p>39. 야간 당직 인수인계 사항</p><p>40. 야간 당직 인수인계 사항</p></div>
        <div class=content>전체 20건 · 비상 연락처</div></div>`,
      // The shape any app shell has, and the shape the fix produces: the content area owns the
      // scroll, the top bar and the navigation outside it stay put because that is what chrome is
      // for, and nothing inside the scrollport is left behind. A check counting the top bar as
      // frozen chrome reports every screen of every console.
      "a content area owning the scroll under a fixed top bar":
        `<style>html,body{margin:0;height:100%;overflow:hidden;font:14px sans-serif}
        .shell{display:flex;flex-direction:column;height:600px;width:1100px}
        .top{flex:none;height:48px;background:#f4f4f5;padding:12px}
        .row{flex:1;min-height:0;display:flex;overflow:hidden}
        .nav{width:64px;background:#fafafa}
        main{flex:1;min-height:0;overflow:auto;padding:0 16px}
        table{width:100%;border-collapse:collapse}td{padding:12px;border-bottom:1px solid #ddd}</style>
        <div class=shell><div class=top>스마트 안전</div>
        <div class=row><div class=nav></div>
        <main><h1>비상 연락처</h1><table><tbody><tr><td>119 종합상황실</td><td>02-000-1000</td></tr><tr><td>관할 소방서</td><td>02-000-1001</td></tr><tr><td>관할 경찰서</td><td>02-000-1002</td></tr><tr><td>협력 병원</td><td>02-000-1003</td></tr><tr><td>환경청 상황실</td><td>02-000-1004</td></tr><tr><td>안전보건공단</td><td>02-000-1005</td></tr><tr><td>한국가스안전공사</td><td>02-000-1006</td></tr><tr><td>한국전기안전공사</td><td>02-000-1007</td></tr><tr><td>관할 지방고용노동관서</td><td>02-000-1008</td></tr><tr><td>야간 당직 안전담당</td><td>02-000-1009</td></tr><tr><td>사업장 안전보건관리책임자</td><td>02-000-1010</td></tr><tr><td>협력사 현장대리인</td><td>02-000-1011</td></tr><tr><td>가스 공급사 비상연락</td><td>02-000-1012</td></tr><tr><td>전기 수전실 당직</td><td>02-000-1013</td></tr><tr><td>폐수처리 위탁사</td><td>02-000-1014</td></tr><tr><td>산업보건의</td><td>02-000-1015</td></tr><tr><td>보건관리자</td><td>02-000-1016</td></tr><tr><td>소방안전관리자</td><td>02-000-1017</td></tr><tr><td>방재실</td><td>02-000-1018</td></tr><tr><td>정문 경비</td><td>02-000-1019</td></tr></tbody></table></main></div></div>`,
      // A control that scrolls its own value. It is wide, it is tall, and the page around it is
      // frozen — every test but the one that matters says this is the defect.
      "a long note in a text box the reader scrolls":
        `<style>html,body{margin:0;height:100%;overflow:hidden;font:14px sans-serif}</style>
        <textarea style="width:600px;height:300px">01. 야간 당직 인수인계 사항\n02. 야간 당직 인수인계 사항\n03. 야간 당직 인수인계 사항\n04. 야간 당직 인수인계 사항\n05. 야간 당직 인수인계 사항\n06. 야간 당직 인수인계 사항\n07. 야간 당직 인수인계 사항\n08. 야간 당직 인수인계 사항\n09. 야간 당직 인수인계 사항\n10. 야간 당직 인수인계 사항\n11. 야간 당직 인수인계 사항\n12. 야간 당직 인수인계 사항\n13. 야간 당직 인수인계 사항\n14. 야간 당직 인수인계 사항\n15. 야간 당직 인수인계 사항\n16. 야간 당직 인수인계 사항\n17. 야간 당직 인수인계 사항\n18. 야간 당직 인수인계 사항\n19. 야간 당직 인수인계 사항\n20. 야간 당직 인수인계 사항\n21. 야간 당직 인수인계 사항\n22. 야간 당직 인수인계 사항\n23. 야간 당직 인수인계 사항\n24. 야간 당직 인수인계 사항\n25. 야간 당직 인수인계 사항\n26. 야간 당직 인수인계 사항\n27. 야간 당직 인수인계 사항\n28. 야간 당직 인수인계 사항\n29. 야간 당직 인수인계 사항\n30. 야간 당직 인수인계 사항\n31. 야간 당직 인수인계 사항\n32. 야간 당직 인수인계 사항\n33. 야간 당직 인수인계 사항\n34. 야간 당직 인수인계 사항\n35. 야간 당직 인수인계 사항\n36. 야간 당직 인수인계 사항\n37. 야간 당직 인수인계 사항\n38. 야간 당직 인수인계 사항\n39. 야간 당직 인수인계 사항\n40. 야간 당직 인수인계 사항</textarea>`,
    },
  },
  countedListDrawsNoRows: {
    broken: {
      // A list-detail screen: the toolbar says fourteen, the list draws none, and the detail
      // panel on the right holds a table with rows in it. Counting rows anywhere in the page
      // would read that panel's rows as the list's and go quiet on exactly this screen.
      // The same defect with the total written the way a component library writes it — an inline
      // icon in front of the words. Reading 「owns text」 as 「has no element children」 walks past
      // this one, and the check then reports 「compared 0」 on every screen of such a product.
      "a total of 14 in a badge with a leading icon, over an empty column":
        `<style>body{margin:0;font:14px sans-serif}.pane{width:620px}
        .bar{display:flex;gap:12px;padding:8px 16px}
        .pill{display:inline-flex;align-items:center;gap:6px;padding:4px 10px}</style>
        <div class=pane><div class=bar>
          <span class=pill><svg width="12" height="12" viewBox="0 0 12 12"><path d="M1 3h10"/></svg>전체 14건</span>
        </div><div class=list></div></div>`,
      "a total of 14 over an empty column, beside a detail panel that has rows":
        `<style>body{margin:0;font:14px sans-serif}.split{display:flex}.pane{width:620px}
        .bar{display:flex;gap:12px;padding:8px 16px}.pill{padding:4px 10px}.detail{width:560px}</style>
        <div class=split>
          <div class=pane><div class=bar><span class=pill>전체 14건</span><span>검색</span></div>
            <div class=list></div></div>
          <div class="pane detail"><h2>산업안전보건법</h2>
            <table><thead><tr><th>의무</th></tr></thead>
            <tbody><tr><td>안전보건관리책임자 선임</td></tr><tr><td>위험성평가 실시</td></tr></tbody></table>
          </div>
        </div>`,
      "a total of 14 over a column that says it is empty":
        `<style>body{margin:0;font:14px sans-serif}.bar{padding:8px 16px}.empty{padding:40px}</style>
        <div style="width:620px"><div class=bar><span>전체 14건</span></div>
          <div class=empty>표시할 법령이 없습니다</div></div>`,
      // The narrow shape of the same defect. Below its card breakpoint the list draws cards
      // rather than a table, so a check looking only for table rows has to keep finding the
      // absence here too — otherwise it goes quiet on every phone-width list.
      "a total of 14 in card layout, over a column that draws no cards":
        `<style>body{margin:0;font:14px sans-serif}.pane{width:400px}
        .bar{padding:8px 16px}.cards{display:flex;flex-direction:column;gap:8px;padding:8px}</style>
        <div class=pane><div class=bar><span>전체 14건</span></div>
          <div class=cards></div></div>`,
      // The rows are all there and the reader can see none of them: the region that holds them is
      // squeezed to the height its siblings left over and clips what does not fit, with nothing in
      // the chain that scrolls. Every string is right, the request answered, the rectangles are
      // real — and the screen under 「전체 42건」 is a filter bar and white space.
      "a list clipped to nothing by a region that cannot scroll":
        `<style>body{margin:0;font:14px sans-serif}
        .page{height:120px;display:flex;flex-direction:column}
        .head{height:80px}.region{flex:1;min-height:0;overflow:hidden}
        .bar{padding:8px 16px}</style>
        <div class=page>
          <div class=head>타일과 배너가 여기를 차지합니다</div>
          <div class=region>
            <div class=bar><span>전체 42건</span></div>
            <table><thead><tr><th>규칙</th></tr></thead>
            <tbody><tr><td>중대재해 호출</td></tr><tr><td>작업중지 발령</td></tr>
            <tr><td>가스 임계 초과</td></tr></tbody></table>
          </div>
        </div>`,
    },
    quiet: {
      // The same squeeze, with the region allowed to scroll. The rows below the fold are one
      // gesture away, which is what every long list on every screen looks like — a check that
      // fired here would fire on all of them.
      "a list taller than its region, in a region that scrolls":
        `<style>body{margin:0;font:14px sans-serif}
        .page{height:120px;display:flex;flex-direction:column}
        .head{height:40px}.region{flex:1;min-height:0;overflow:auto}
        .bar{padding:8px 16px}</style>
        <div class=page>
          <div class=head>타일</div>
          <div class=region>
            <div class=bar><span>전체 42건</span></div>
            <table><thead><tr><th>규칙</th></tr></thead>
            <tbody><tr><td>중대재해 호출</td></tr><tr><td>작업중지 발령</td></tr>
            <tr><td>가스 임계 초과</td></tr><tr><td>법정 클록 신고 기한</td></tr>
            <tr><td>시정·예방조치 기한 임박</td></tr><tr><td>자격 만료 임박</td></tr></tbody></table>
          </div>
        </div>`,
      "the same screen with its rows drawn":
        `<style>body{margin:0;font:14px sans-serif}.split{display:flex}.pane{width:620px}
        .bar{display:flex;gap:12px;padding:8px 16px}.pill{padding:4px 10px}.detail{width:560px}</style>
        <div class=split>
          <div class=pane><div class=bar><span class=pill>전체 14건</span><span>검색</span></div>
            <table><thead><tr><th>법령</th></tr></thead>
            <tbody><tr><td>산업안전보건법</td></tr><tr><td>중대재해처벌법</td></tr></tbody></table></div>
          <div class="pane detail"><h2>산업안전보건법</h2>
            <table><thead><tr><th>의무</th></tr></thead>
            <tbody><tr><td>안전보건관리책임자 선임</td></tr></tbody></table>
          </div>
        </div>`,
      // The same list below its card breakpoint, drawing its records as cards. The rows are
      // there and not one of them is a `<tr>`; a check that fired here would fire on every list
      // a reader opens on a phone.
      "the same total in card layout, with its cards drawn":
        `<style>body{margin:0;font:14px sans-serif}.pane{width:400px}
        .bar{padding:8px 16px}.cards{display:flex;flex-direction:column;gap:8px;padding:8px}
        .card{border:1px solid #ddd;border-radius:8px;padding:12px}</style>
        <div class=pane><div class=bar><span>전체 14건</span></div>
          <div class=cards>
            <div class=card data-testid="list-row-a1"><div>대표이사</div><div>코드 EXEC-01</div></div>
            <div class=card data-testid="list-row-a2"><div>이사</div><div>코드 EXEC-02</div></div>
          </div></div>`,
      // Every tile on this page is a number with a unit. None of them is claiming rows are
      // about to be drawn, and a check that read them as totals would fire on every dashboard
      // in the product.
      "a dashboard of stat tiles and no list at all":
        `<style>body{margin:0;font:14px sans-serif}.tiles{display:flex;gap:16px;padding:24px}
        .tile{width:280px;padding:16px}</style>
        <div class=tiles>
          <div class=tile><div>적용 법령</div><div>14개</div><div>5개 부처</div></div>
          <div class=tile><div>의무</div><div>12건</div><div>법령 전체 합계</div></div>
          <div class=tile><div>담당 없는 의무</div><div>0건</div></div>
        </div>`,
      "a list that is honestly empty and says so, with a total of zero":
        `<style>body{margin:0;font:14px sans-serif}.bar{padding:8px 16px}.empty{padding:40px}</style>
        <div style="width:620px"><div class=bar><span>전체 0건</span></div>
          <div class=empty>표시할 법령이 없습니다</div></div>`,
    },
  },
  textBoxesOverlap: {
    broken: {
      // Two tables painted into one area: a heading lands on the filter bar and each row shows
      // two records superimposed.
      "two layers of rows in one rectangle":
        `<style>body{margin:0;font:14px sans-serif}.stack{position:relative;height:220px}
        .layer{position:absolute;top:0;left:0;width:600px}.bar{padding:8px 16px}
        .row{padding:10px 16px}header{position:sticky;top:0;padding:8px 16px}</style>
        <header>의무 대상 판정</header>
        <div class=stack>
          <div class=layer><div class=bar>전체 6건</div>
            <div class=row>공정안전보고서(PSM)</div><div class=row>안전보건관리책임자 선임</div></div>
          <div class=layer><div class=bar>제외된 의무</div>
            <div class=row>유해화학물질 취급시설 자체점검</div><div class=row>산업안전보건법 제15조</div></div>
        </div>
        <div role=dialog style="position:absolute;top:40px;left:40px;padding:20px">판정 근거</div>`,
      // Inside a dialog, where a squeezed help table puts one text on top of another.
      "two texts stacked inside one dialog":
        `<style>body{margin:0;font:14px sans-serif}</style>
        <div role=dialog style="position:absolute;top:20px;left:20px;width:400px;height:80px">
          <span style="position:absolute;left:0;top:0">메뉴 경로</span>
          <span style="position:absolute;left:0;top:3px">왼쪽 메뉴에 그대로 있는 말입니다</span></div>`,
      "a pagination control drawn inside a table row":
        `<style>body{margin:0;font:14px sans-serif}td{padding:10px 16px}
        .pager{position:absolute;top:52px;left:200px;padding:6px 10px}</style>
        <table style="width:600px"><tbody>
          <tr><td>휴게시설 설치·관리기준</td></tr><tr><td>위험성평가 실시</td></tr></tbody></table>
        <div class=pager>행: 10</div>`,
    },
    quiet: {
      "the same two tables, one under the other":
        `<style>body{margin:0;font:14px sans-serif}.bar{padding:8px 16px}.row{padding:10px 16px}
        header{position:sticky;top:0;padding:8px 16px}</style>
        <header>의무 대상 판정</header>
        <div><div class=bar>전체 6건</div>
          <div class=row>공정안전보고서(PSM)</div><div class=row>안전보건관리책임자 선임</div></div>
        <div><div class=bar>제외된 의무</div>
          <div class=row>유해화학물질 취급시설 자체점검</div><div class=row>산업안전보건법 제15조</div></div>
        <div role=dialog style="position:absolute;top:40px;left:40px;padding:20px">판정 근거</div>`,
      // Overlap is what all three of these are for. A check that read stacking as a collision
      // would report every modal in the product.
      "a modal, a tooltip and a sticky header over ordinary content":
        `<style>body{margin:0;font:14px sans-serif;height:1200px}.row{padding:10px 16px}
        header{position:sticky;top:0;padding:8px 16px;background:#fff}</style>
        <header>기준·서식</header>
        <div class=row>산업안전보건법</div><div class=row>중대재해처벌법</div>
        <dialog open style="position:absolute;top:10px;left:20px;padding:24px">판정 근거를 확인합니다</dialog>
        <div role=tooltip style="position:absolute;top:24px;left:40px">담당을 지정합니다</div>`,
      "adjacent cells whose borders touch":
        `<style>body{margin:0;font:14px sans-serif}td{padding:0;margin:0}
        table{border-collapse:collapse}</style>
        <table><tbody><tr><td>산업안전보건법</td><td>고용노동부</td></tr>
        <tr><td>중대재해처벌법</td><td>법무부</td></tr></tbody></table>`,
      // The row is below the panel's bottom edge and clipped away, so nothing is on screen where
      // the layout says it is. Reading the raw rectangle makes it collide with the footer under
      // the panel, which is what every list screen with a scroll looks like.
      // Two texts inside one dialog is the pair the layer rule has to keep loud. Dropping raised
      // text altogether would go quiet here, and a help table is where a squeezed column hides.
      "two lines inside one dialog, one under the other":
        `<style>body{margin:0;font:14px sans-serif}.row{padding:8px 12px}</style>
        <div class=row>산업안전보건법</div>
        <div role=dialog style="position:absolute;top:40px;left:40px;width:300px">
          <div class=row>메뉴 경로</div><div class=row>화면 안의 위치</div></div>`,
      "a row scrolled past the bottom of a panel, over the footer beneath it":
        `<style>body{margin:0;font:14px sans-serif}
        .panel{height:60px;overflow:auto;width:300px}.row{padding:10px 16px}
        .foot{padding:6px 16px}</style>
        <div class=panel>
          <div class=row>산업안전보건법</div><div class=row>중대재해처벌법</div>
          <div class=row>화학물질관리법</div><div class=row>고압가스안전관리법</div></div>
        <div class=foot>사업장 시간 GMT+9</div>`,
    },
  },
  blockInsideParagraph: {
    // Built with script rather than written as markup on purpose: the HTML parser closes a
    // paragraph in front of a block, so a fixture written the plain way produces siblings and
    // proves nothing. A framework builds its tree through the DOM API, which is why the invalid
    // nesting reaches a real screen — and the fixture has to arrive the same way.
    broken: {
      "a composed label appended into a paragraph slot":
        `<style>body{margin:0;font:14px sans-serif}.row{display:flex;gap:12px;padding:8px 16px}
        .primary{flex:1;font-weight:500;overflow:hidden;text-overflow:ellipsis}</style>
        <div class=row><p class=primary id=slot></p><span>11명</span></div>
        <script>
          const box = document.createElement('div');
          box.style.display = 'flex';
          box.textContent = '토목부';
          const btn = document.createElement('button');
          btn.setAttribute('aria-label', '토목부 보기');
          box.appendChild(btn);
          document.getElementById('slot').appendChild(box);
        <\/script>`,
      "a paragraph holding a list":
        `<style>body{margin:0;font:14px sans-serif}</style>
        <p id=note>적용 대상</p>
        <script>
          const ul = document.createElement('ul');
          for (const name of ['산업안전보건법', '중대재해처벌법']) {
            const li = document.createElement('li');
            li.textContent = name;
            ul.appendChild(li);
          }
          document.getElementById('note').appendChild(ul);
        <\/script>`,
    },
    // Phrasing content inside a paragraph is what a paragraph is for, and a block beside one or
    // inside another block is ordinary layout. A check that read either as a finding would fire
    // on every screen and be switched off within a day.
    quiet: {
      "a paragraph of inline content — spans, a link, an icon and a button":
        `<style>body{margin:0;font:14px sans-serif}</style>
        <p><span>토목부</span> <a href="#">보기</a>
        <svg width="12" height="12" viewBox="0 0 12 12"><path d="M1 3h10"/></svg>
        <button aria-label="토목부 보기"><span>↗</span></button></p>`,
      "a row of blocks, with the paragraph beside them rather than around them":
        `<style>body{margin:0;font:14px sans-serif}.row{display:flex;gap:12px;padding:8px 16px}
        .primary{flex:1;font-weight:500}</style>
        <div class=row><div class=primary><p>토목부</p></div><div><span>11명</span></div></div>`,
      "a paragraph appended into another paragraph's sibling, built the same way":
        `<style>body{margin:0;font:14px sans-serif}</style>
        <p id=first>남부현장</p><div id=host></div>
        <script>
          const p = document.createElement('p');
          p.textContent = '하위 부서를 포함한 활성 계정입니다';
          document.getElementById('host').appendChild(p);
        <\/script>`,
    },
  },
  pressableControlsTakeThePress: {
    broken: {
      // The defect this was written from: a footer's buttons and an empty spacer share a column,
      // the spacer is laid over them, and a press aimed at a button's middle lands on nothing.
      "an empty spacer laid over a footer's buttons":
        `<style>body{margin:0;font:14px sans-serif}
        .foot{position:relative;display:flex;gap:8px;padding:12px 16px}
        button{padding:8px 14px}
        .spacer{position:absolute;left:0;right:0;top:8px;height:40px}</style>
        <div class=foot>
          <button>닫기</button><button>사용자 보기</button><button>회수</button>
          <div class=spacer></div>
        </div>`,
      "a full-width overlay left mounted over the page":
        `<style>body{margin:0;font:14px sans-serif}
        .veil{position:fixed;inset:0}</style>
        <button style="margin:20px;padding:10px 16px">스코프 부여</button>
        <div class=veil></div>`,
    },
    quiet: {
      "the same footer with the spacer taken out":
        `<style>body{margin:0;font:14px sans-serif}
        .foot{display:flex;gap:8px;padding:12px 16px}button{padding:8px 14px}</style>
        <div class=foot><button>닫기</button><button>사용자 보기</button><button>회수</button></div>`,
      // A modal makes the page behind it inert on purpose. Reading that as a defect would report
      // every dialog in the product.
      "buttons behind an open dialog":
        `<style>body{margin:0;font:14px sans-serif}
        .veil{position:fixed;inset:0;background:rgba(0,0,0,.4)}</style>
        <button style="margin:20px;padding:10px 16px">스코프 부여</button>
        <div class=veil></div>
        <div role=dialog style="position:fixed;top:40px;left:40px;padding:20px;background:#fff">
          <button>취소</button><button>회수</button></div>`,
      "a disabled control under the same spacer":
        `<style>body{margin:0;font:14px sans-serif}
        .foot{position:relative;display:flex;gap:8px;padding:12px 16px}button{padding:8px 14px}
        .spacer{position:absolute;left:0;right:0;top:8px;height:40px}</style>
        <div class=foot><button disabled>연결 시험</button><div class=spacer></div></div>`,
      // The shape that made this check unusable before it read clipping: a row action scrolled
      // past the bottom of its panel still reports a rectangle on screen, and the hit test at
      // that spot honestly answers with the footer painted there. Fourteen of seventeen findings
      // in a sweep of eight screens were this, and the one real defect was buried under them.
      "a row action scrolled out of its panel, with a footer painted where its rectangle claims to be":
        `<style>body{margin:0;font:14px sans-serif}
        .panel{height:80px;overflow:auto;width:400px}.row{padding:12px 16px}
        .foot{padding:12px 16px}</style>
        <div class=panel>
          <div class=row>김안전 <button>보기</button></div>
          <div class=row>조보건 <button>보기</button></div>
          <div class=row>최감독 <button>보기</button></div>
          <div class=row>박총괄 <button>보기</button></div>
        </div>
        <div class=foot>전체 4건</div>`,
      // The coverer declares it is not there for the pointer, so the browser's own hit test walks
      // past it — which is the same test a reader's finger takes.
      "a decorative layer that lets the pointer through":
        `<style>body{margin:0;font:14px sans-serif}
        .foot{position:relative;display:flex;gap:8px;padding:12px 16px}button{padding:8px 14px}
        .glow{position:absolute;inset:0;pointer-events:none}</style>
        <div class=foot><button>저장</button><div class=glow></div></div>`,
    },
  },
  regionCrushedToASliver: {
    broken: {
      // The screen this check was written from: tiles, a banner, a reference table and a page note
      // above a list, all inside a column told to fit the fold. The list is the only child that can
      // give, so it gives everything — twenty-one pixels of a thirty-one-row list, and no scrollbar
      // anywhere, because nothing overflowed.
      "a list region left twenty-one pixels of six hundred":
        `<style>body{margin:0;font:14px sans-serif}
        .page{display:flex;flex-direction:column;height:400px;width:900px}
        .chrome{flex:none;height:379px;background:#f4f4f5}
        .list{flex:1;min-height:0;overflow:hidden}
        table{width:100%;border-collapse:collapse}td{padding:10px;border-bottom:1px solid #ddd}</style>
        <div class=page><div class=chrome>타일과 안내</div>
        <div class=list><table><tbody>
        <tr><td>119</td></tr><tr><td>관할 소방서</td></tr><tr><td>관할 경찰서</td></tr>
        <tr><td>협력 병원</td></tr><tr><td>환경청 상황실</td></tr><tr><td>안전보건공단</td></tr>
        <tr><td>한국가스안전공사</td></tr><tr><td>한국전기안전공사</td></tr>
        <tr><td>관할 지방고용노동관서</td></tr><tr><td>야간 당직 안전담당</td></tr>
        </tbody></table></div></div>`,
      // The same crush taken all the way. The panel's scrolling body is handed nothing at all, so
      // it measures zero over nineteen hundred pixels — and a scrolling region at zero is not a
      // closed accordion, it is the reader pressing a row and being shown a title and two buttons.
      "a scrolling panel body left nothing of nineteen hundred":
        `<style>body{margin:0;font:14px sans-serif}
        .panel{display:flex;flex-direction:column;height:127px;width:412px}
        .head{flex:none;height:37px;border-bottom:1px solid #ddd}
        .foot{flex:none;height:90px;border-top:1px solid #ddd}
        .body{flex:1;min-height:0;overflow:auto}
        p{margin:0;padding:10px;border-bottom:1px solid #eee}</style>
        <div class=panel><div class=head>작업중지 발령</div>
        <div class=body><p>전송 시점 · 작업중지 발령 즉시</p><p>수신 대상 · 해당 구역 재실자 전원</p>
        <p>등급 · 긴급</p><p>수신거부 · 해당 없음</p><p>카카오 알림톡 · 한국어</p><p>카카오 알림톡 · 영어</p>
        <p>앱 푸시 · 한국어</p><p>앱 푸시 · 영어</p><p>LINE · 한국어</p><p>LINE · 영어</p>
        <p>SMS · 한국어</p><p>SMS · 영어</p><p>등록 2026-02-11</p><p>수정 2026-07-14</p></div>
        <div class=foot><button>문안 편집</button><button>편집</button></div></div>`,
    },
    quiet: {
      // A panel that scrolls its own content, which is the shape this check must never report:
      // the reader can reach every row by scrolling the panel they are already looking at.
      "a panel scrolling six hundred pixels through four hundred":
        `<style>body{margin:0;font:14px sans-serif}
        .panel{height:400px;width:900px;overflow:auto}
        table{width:100%;border-collapse:collapse}td{padding:10px;border-bottom:1px solid #ddd}</style>
        <div class=panel><table><tbody>
        <tr><td>119</td></tr><tr><td>관할 소방서</td></tr><tr><td>관할 경찰서</td></tr>
        <tr><td>협력 병원</td></tr><tr><td>환경청 상황실</td></tr><tr><td>안전보건공단</td></tr>
        <tr><td>한국가스안전공사</td></tr><tr><td>한국전기안전공사</td></tr>
        <tr><td>관할 지방고용노동관서</td></tr><tr><td>야간 당직 안전담당</td></tr>
        </tbody></table></div>`,
      // A region closed on purpose. It measures nothing because the reader closed it, and it says
      // so — the control above it is the way back.
      "a collapsed accordion holding its content at zero":
        `<style>body{margin:0;font:14px sans-serif}
        .fold{height:0;width:900px;overflow:hidden}p{margin:0;padding:10px}</style>
        <button>연속 당직 안내 펼치기</button>
        <div class=fold><p>사흘 이상 이어진 당직이 둘 있습니다.</p><p>휴일이 끼어 있어 실제 부담은 더 큽니다.</p>
        <p>한도를 넘지는 않았습니다.</p><p>사업장 설정이 정합니다.</p><p>박관리 · 한설비</p>
        <p>금·토·일</p><p>이레 내내</p><p>연속 당직 한도 3일</p><p>토요일 야간</p><p>보건 당직</p></div>`,
      // A chip row that scrolls sideways. It is short because chips are short, and it holds
      // exactly its own height — the overflow is on the other axis.
      "a chip row scrolling sideways at its own height":
        `<style>body{margin:0;font:14px sans-serif}
        .chips{width:900px;height:36px;overflow-x:auto;overflow-y:hidden;white-space:nowrap}
        .chip{display:inline-block;padding:6px 14px;margin:2px;border:1px solid #ccc;border-radius:999px}</style>
        <div class=chips><span class=chip>전체</span><span class=chip>안전</span><span class=chip>보건</span>
        <span class=chip>설비</span><span class=chip>휴일</span><span class=chip>야간</span></div>`,
      // A region tight rather than crushed. The reader loses a row or two, which is a layout to
      // tidy and not a screen they cannot use.
      "a region showing most of what it holds":
        `<style>body{margin:0;font:14px sans-serif}
        .tight{width:900px;height:200px;overflow:hidden}
        table{width:100%;border-collapse:collapse}td{padding:10px;border-bottom:1px solid #ddd}</style>
        <div class=tight><table><tbody>
        <tr><td>119</td></tr><tr><td>관할 소방서</td></tr><tr><td>관할 경찰서</td></tr>
        <tr><td>협력 병원</td></tr><tr><td>환경청 상황실</td></tr><tr><td>안전보건공단</td></tr>
        </tbody></table></div>`,
    },
  },
  openPaneDrawsNothing: {
    broken: {
      // The screen this check was written from: four tabs, and the one that is open renders its
      // own `pt-4` and nothing else because the record behind it is absent and the pane answers
      // that with `return null`.
      "an open tab whose pane renders only its own padding":
        `<style>body{margin:0;font:14px sans-serif}.strip{display:flex;gap:16px;padding:8px 16px}
        .pane{padding-top:16px;width:900px}</style>
        <div class=strip role=tablist>
          <button role=tab id=t1 aria-selected=true>정책</button>
          <button role=tab id=t2>세션</button>
        </div>
        <div role=tabpanel aria-labelledby=t1 class=pane></div>
        <div role=tabpanel aria-labelledby=t2 class=pane hidden>전체 0건 · 열려 있는 세션이 없습니다</div>`,
      // The same gap with the pane's children present but every one of them rendering nothing —
      // a wrapper `Stack` around a conditional that took the branch with no arm.
      "an open pane whose children are all empty wrappers":
        `<style>body{margin:0;font:14px sans-serif}.pane{padding:16px;width:900px}</style>
        <div role=tablist><button role=tab id=h1 aria-selected=true>변경 이력</button></div>
        <div role=tabpanel aria-labelledby=h1 class=pane><div></div><div><span></span></div></div>`,
    },
    quiet: {
      "the same tab set with the open pane saying why it is empty":
        `<style>body{margin:0;font:14px sans-serif}.strip{display:flex;gap:16px;padding:8px 16px}
        .pane{padding-top:16px;width:900px}.card{padding:40px;text-align:center}</style>
        <div class=strip role=tablist>
          <button role=tab id=q1 aria-selected=true>정책</button>
          <button role=tab id=q2>세션</button>
        </div>
        <div role=tabpanel aria-labelledby=q1 class=pane>
          <div class=card><div>정책 값이 없습니다</div>
          <div>보안 정책 레코드가 만들어지면 여기에 편집할 수 있는 값이 표시됩니다.</div></div>
        </div>
        <div role=tabpanel aria-labelledby=q2 class=pane hidden></div>`,
      // A pane holding one chart and no words at all. Judged on text alone this is the check's
      // first false positive, and a rendered audit that cries once is one nobody runs again.
      "an open pane holding a chart and no text":
        `<style>body{margin:0;font:14px sans-serif}.pane{padding:16px;width:900px}</style>
        <div role=tablist><button role=tab id=c1 aria-selected=true>추이</button></div>
        <div role=tabpanel aria-labelledby=c1 class=pane>
          <svg width="640" height="220"><path d="M0 200 L120 140 L240 160 L360 60" /></svg>
        </div>`,
      // Every pane behind a tab nobody pressed. They are empty because they are hidden, which is
      // how a tab set works — a check reading presence rather than paint fires on every screen.
      "a tab set whose unopened panes are empty":
        `<style>body{margin:0;font:14px sans-serif}.pane{padding:16px;width:900px}</style>
        <div role=tablist>
          <button role=tab id=z1 aria-selected=true>정책</button>
          <button role=tab id=z2>세션</button>
          <button role=tab id=z3>잠긴 계정</button>
        </div>
        <div role=tabpanel aria-labelledby=z1 class=pane>비밀번호 최소 길이 · 잠금 시간</div>
        <div role=tabpanel aria-labelledby=z2 class=pane hidden></div>
        <div role=tabpanel aria-labelledby=z3 class=pane style="display:none"></div>`,
      // A screen with no tabs at all. Nothing here is a pane, and the check has to say it
      // compared nothing rather than invent a region out of the page body.
      "a plain page with no panes on it":
        `<style>body{margin:0;font:14px sans-serif}</style>
        <div><h1>보안 정책</h1><p>로그인·세션 정책을 확인합니다.</p></div>`,
    },
  },
};

/**
 * Both directions, against generated fixtures.
 *
 * <p>`selected` narrows to `--check <id>`, because iterating on one check should not mean sitting
 * through every other check's pages — and because a flag the run accepts and then ignores is the
 * thing this file refuses an unrecognised option in order to avoid.
 */
function selfTest(session, options, selected = checks) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-rendered-"));
  const rows = [];
  try {
    for (const check of selected) {
      const pages = FIXTURES[check.id];
      if (!pages?.broken || !pages?.quiet) {
        rows.push([check.id, "—", "no fixture pair — a check proved in one direction has not been added", false]);
        continue;
      }
      for (const direction of ["broken", "quiet"]) {
        for (const [name, html] of Object.entries(pages[direction])) {
          const file = path.join(dir, `${check.id}-${direction}-${rows.length}.html`);
          fs.writeFileSync(file, `<!doctype html><meta charset=utf-8>${html}`);
          const out = evaluate(session, `file://${file}`, check, options);
          const fired = out.findings.length > 0;
          rows.push([
            `${check.id} · ${direction}`,
            name,
            `compared ${out.compared}, ${out.findings.length} findings` +
              (fired ? ` — ${out.findings[0]}` : ""),
            fired === (direction === "broken"),
          ]);
        }
      }
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  let failed = 0;
  for (const [id, name, detail, ok] of rows) {
    if (!ok) failed += 1;
    console.log(`${ok ? "✔" : "✖"} ${id} — ${name}\n   ${detail}`);
  }
  console.log(
    failed === 0
      ? `\n✔ ${selected.length} checks, ${rows.length} pages, both directions`
      : `\n✖ ${failed} of ${rows.length} pages came out wrong — a check proved in one direction has not been added`,
  );
  return failed === 0 ? 0 : 1;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

// Every option this script knows, so an unrecognised one can stop the run instead of falling
// through to a normal one. A valued option is written either `--name value` or `--name=value`,
// so the walk has to skip the value that follows the first form.
const BOOLEAN_FLAGS = ["--list", "--selftest", "--keep-session"];
const VALUED_FLAGS = ["url", "check", "print", "session", "options"];

function unrecognisedArgs() {
  const argv = process.argv.slice(2);
  const bad = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (BOOLEAN_FLAGS.includes(a)) continue;
    const named = VALUED_FLAGS.find((n) => a === `--${n}` || a.startsWith(`--${n}=`));
    if (named) {
      if (a === `--${named}`) i++;
      continue;
    }
    bad.push(a);
  }
  return bad;
}

function main() {
  const unknown = unrecognisedArgs();
  if (unknown.length) {
    console.error(`\u2716 unrecognised option: ${unknown.join(" ")}`);
    console.error(
      `  known options: ${BOOLEAN_FLAGS.join("  ")}  ${VALUED_FLAGS.map((f) => `--${f} <value>`).join("  ")}`,
    );
    return 2;
  }
  const options = { ...DEFAULTS, ...JSON.parse(arg("options") ?? "{}") };
  const only = arg("check");
  const selected = only ? checks.filter((c) => c.id === only) : checks;
  const session = arg("session") ?? "simplix-audit-rendered";

  if (process.argv.includes("--list")) {
    for (const c of checks) console.log(`${c.id} [${c.grade}] — ${c.title}`);
    return 0;
  }
  if (arg("print")) {
    const c = checks.find((x) => x.id === arg("print"));
    if (!c) {
      console.error(`no such check: ${arg("print")}`);
      return 2;
    }
    console.log(snippet(c, options));
    return 0;
  }
  // Everything below here drives a browser. A session this run opens is this run's to close, on
  // every path out including a thrown one; a session that was already serving belongs to whoever
  // opened it and is left exactly as found. `--keep-session` holds one open on purpose — for a
  // caller that runs this script several times against the same screen and pays the browser
  // start-up once.
  const keepSession = process.argv.includes("--keep-session");
  const startedHere = !keepSession && !sessionIsRunning(session);
  try {
    return run(session, options, selected);
  } finally {
    if (startedHere) closeSession(session);
  }
}

function run(session, options, selected) {
  if (process.argv.includes("--selftest")) return selfTest(session, options, selected);

  const url = arg("url");
  if (!url) {
    console.error(
      "audit-rendered needs a page: --url <address>, or --print <id> to evaluate the snippet\n" +
        "through whatever driver the session already has open. There is no source-only mode —\n" +
        "every check here is a question about boxes on a painted page, and a run that could not\n" +
        "reach a browser has told you nothing.",
    );
    return 2;
  }

  let failed = 0;
  for (const check of selected) {
    let out;
    try {
      out = evaluate(session, url, check, options);
    } catch (e) {
      console.error(`✖ ${check.id} — could not be run: ${e.message}`);
      return 2;
    }
    // A check that compared nothing is not a check that passed. It reaches nothing on a screen
    // this check has no subject on — a form, a dashboard with no list — and it reaches nothing
    // just as silently when the screen it was pointed at never finished arriving. Both are the
    // reader's to judge, and neither is a `✔`.
    const reachedNothing = out.compared === 0;
    const marker = reachedNothing
      ? "○"
      : out.findings.length === 0
        ? "✔"
        : check.grade === "error"
          ? "✖"
          : "⚠";
    console.log(
      `${marker} ${check.id} — ${check.title}\n   compared ${out.compared}` +
        (reachedNothing ? " — reached nothing on this screen, so it proves nothing" : "") +
        (out.sampled ? ` (sampled the first ${options.maxLeaves})` : ""),
    );
    for (const f of out.findings) console.log(`   ${f}`);
    if (out.findings.length > 0 && check.grade === "error") failed += 1;
  }
  return failed === 0 ? 0 : 1;
}

// `realpathSync` on both sides, because the plugin is installed as a symlink into
// `~/.claude/skills/` — comparing the raw argv path against `import.meta.url` makes the
// script exit silently with status 0 when it is run through that link, which is the same
// picture on screen as a run that found nothing wrong.
const invokedDirectly =
  process.argv[1] &&
  fs.realpathSync(process.argv[1]) === fs.realpathSync(new URL(import.meta.url).pathname);
if (invokedDirectly) process.exit(main());
