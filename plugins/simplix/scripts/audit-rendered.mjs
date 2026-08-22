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

  /** What a drawn row looks like. A header row is excluded by the selectors themselves. */
  rowSelectors: [
    "tbody tr",
    '[role="row"]',
    '[role="listitem"]',
    "[data-row]",
    "[data-row-id]",
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
    const rows = [...document.querySelectorAll(o.rowSelectors.join(","))].filter(visible);
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

export const checks = [
  countedListDrawsNoRows,
  textBoxesOverlap,
  blockInsideParagraph,
  pressableControlsTakeThePress,
  openPaneDrawsNothing,
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
    },
    quiet: {
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

function selfTest(session, options) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-rendered-"));
  const rows = [];
  try {
    for (const check of checks) {
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
      ? `\n✔ ${checks.length} checks, ${rows.length} pages, both directions`
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
const BOOLEAN_FLAGS = ["--list", "--selftest"];
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
  if (process.argv.includes("--selftest")) return selfTest(session, options);

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
