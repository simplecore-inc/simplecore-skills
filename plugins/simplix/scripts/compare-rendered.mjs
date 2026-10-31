#!/usr/bin/env node
/**
 * Rendered agreement between a screen and its design-reference frame, by control role.
 *
 * A board frame and the screen built from it agree when every control role they both draw has
 * the same height, gap, radius, font and variant, and every kit part they both draw (each element
 * carrying a `data-slot` or a `data-part`) has the same box and type. This script measures both
 * pages and lists every role and part where they differ, so agreement is a number and never a
 * judgment by eye. Captures are evidence only; this is the check.
 *
 * Parts are keyed by name, by the nearest named ancestor and by variant and size
 * (`button@crud-filter-bar-trailing[outline/sm]`), so a header action, a row action and a toolbar
 * button are compared with their own counterparts rather than with whichever button came first.
 * A button-like part is compared on its variant, size, height, padding, gap, radius, border,
 * background, font, icon size and the gap between its icon and its label; any other part on its
 * padding, radius, border, background, gap, font, title and body typography, icon size and the
 * spacing between its items. A part one side draws and the other does not is reported missing.
 *
 * Usage:
 *   node compare-rendered.mjs --app <url> --board <url> --root-slot <data-slot>
 *   node compare-rendered.mjs --app-json <file> --board-json <file> --root-slot <data-slot>
 *   node compare-rendered.mjs --print                 # the measuring snippet, for any driver
 *   node compare-rendered.mjs --selftest              # hit and miss cases, no browser
 *
 * Options:
 *   --root-slot <slot>   the `data-slot` that proves the screen itself is painted (a list's root,
 *                        a dashboard's root); required, because a page measured without it may be
 *                        a sign-in page or an error page that looks like a result
 *   --roles <a,b,...>    the control roles to compare; defaults below
 *   --scope <data-slot>  compare parts only inside this slot (the page's content column, so the
 *                        shell around a board frame and around the app is left out); absent, the
 *                        whole document
 *   --skip <a,b,...>     part names never compared; defaults to the layout primitives below
 *   --no-parts           compare the control roles only
 *   --session <name>     the agent-browser session (a signed-in one, for an app behind sign-in)
 *   --out <file>         also write both measurements and the differences as JSON
 *
 * Refusals (exit 2, nothing compared):
 *   - the root slot is missing on either side: the page is not the screen
 *   - `data-design` differs between the two roots: two designs draw every role differently, and
 *     a comparison across them reports the design, not the screen
 *
 * Exit 0 when every shared role agrees, 1 when any differs, 2 on a refusal or when a page could
 * not be measured.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";

import { parseOptions, reportUnknown } from "./lib/cli-options.mjs";

/** Control roles compared by default: the kit's list, detail and form parts. */
export const DEFAULT_ROLES = [
  "heading",
  "console-record-list",
  "list-total-badge-figure",
  "input",
  "crud-filter-bar-trigger",
  "table-head",
  "table-row",
  "table-cell",
  "status-badge",
  "crud-card",
  "crud-list-pagination",
  "select-trigger",
  "tabs-trigger",
  "field-detail-label",
  "field-detail-value",
  "crud-detail-footer",
  "button",
  "alert-banner",
];

/** The properties a role is compared on. */
export const COMPARED = ["h", "gap", "radius", "font", "variant"];

/** Part names that are layout rather than look: their box follows their content. */
export const DEFAULT_SKIP = ["stack", "grid", "flex", "box", "text", "container", "table-body", "table-header"];

/** The properties a button-like part is compared on. */
export const BUTTON_COMPARED = ["variant", "size", "h", "padding", "gap", "radius", "border", "background", "font", "iconSize", "iconGap"];

/** The properties any other part is compared on. */
export const PART_COMPARED = ["padding", "radius", "border", "background", "gap", "font", "titleFont", "bodyFont", "iconSize", "itemGap"];

/**
 * The page side: one self-contained function, evaluated in the page, returning the design
 * attribute, the language, whether the root slot is painted, and per role the first painted
 * element's metrics.
 */
export function measure(o) {
  const out = {};
  for (const role of o.roles) {
    const all = [...document.querySelectorAll(`[data-slot="${role}"]`)].filter((e) => e.getBoundingClientRect().width > 0);
    if (all.length === 0) {
      out[role] = null;
      continue;
    }
    // A table's first row is its header row; the first body row is the one a reader compares.
    const e = role === "table-row" ? (all[1] ?? all[0]) : all[0];
    const r = e.getBoundingClientRect();
    const c = getComputedStyle(e);
    out[role] = {
      count: all.length,
      h: Math.round(r.height),
      gap: c.gap,
      radius: c.borderRadius,
      font: `${c.fontSize}/${c.lineHeight} ${c.fontWeight}`,
      variant: e.dataset.variant ?? e.dataset.tone ?? null,
    };
  }
  const parts = {};
  if (o.parts !== false) {
    const scope = o.scope ? document.querySelector(`[data-slot="${o.scope}"]`) : document.body;
    const skip = new Set(o.skip ?? []);
    const nameOf = (el) => el.getAttribute("data-slot") || el.getAttribute("data-part");
    const painted = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const fontOf = (el) => {
      if (!el) return null;
      const c = getComputedStyle(el);
      return `${c.fontSize}/${c.lineHeight} ${c.fontWeight}`;
    };
    for (const el of scope ? scope.querySelectorAll("[data-slot],[data-part]") : []) {
      const name = nameOf(el);
      if (!name || skip.has(name) || !painted(el)) continue;
      let up = el.parentElement;
      while (up && (!nameOf(up) || skip.has(nameOf(up)))) up = up.parentElement;
      const variant = el.dataset.variant ?? el.dataset.tone ?? "";
      const size = el.dataset.size ?? "";
      const key = `${name}@${up ? nameOf(up) : "-"}${variant || size ? `[${variant}/${size}]` : ""}`;
      if (parts[key]) {
        parts[key].count += 1;
        continue;
      }
      const c = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const button = el.tagName === "BUTTON" || el.getAttribute("role") === "button" || /button|trigger/.test(name);
      const icon = el.querySelector("svg");
      const iconRect = icon && painted(icon) ? icon.getBoundingClientRect() : null;
      let iconGap = null;
      if (iconRect) {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
        const text = walker.nextNode();
        if (text) {
          const range = document.createRange();
          range.selectNodeContents(text);
          const tr = range.getBoundingClientRect();
          if (tr.width > 0) iconGap = Math.round(tr.left >= iconRect.right ? tr.left - iconRect.right : iconRect.left - tr.right);
        }
      }
      const children = [...el.children].filter(painted);
      const itemGap = children.length >= 2 ? Math.round(children[1].getBoundingClientRect().top - children[0].getBoundingClientRect().bottom) : null;
      parts[key] = {
        count: 1,
        button,
        variant: variant || null,
        size: size || null,
        h: Math.round(r.height),
        padding: c.padding,
        gap: c.gap,
        radius: c.borderRadius,
        border: `${c.borderTopWidth} ${c.borderTopStyle} ${c.borderTopColor}`,
        background: c.backgroundColor,
        font: `${c.fontSize}/${c.lineHeight} ${c.fontWeight}`,
        titleFont: fontOf(el.querySelector('h1,h2,h3,h4,h5,h6,[data-slot$="title"],[data-part$="title"]')),
        bodyFont: fontOf(el.querySelector('p,[data-slot$="description"],[data-part$="description"],[data-slot$="body"],[data-part$="body"]')),
        iconSize: iconRect ? `${Math.round(iconRect.width)}x${Math.round(iconRect.height)}` : null,
        iconGap,
        itemGap,
      };
    }
  }
  const root = document.querySelector(`[data-slot="${o.rootSlot}"]`);
  return {
    parts,
    design: document.documentElement.dataset.design ?? null,
    lang: document.documentElement.lang || null,
    rootSlot: o.rootSlot,
    rootPainted: !!root && root.getBoundingClientRect().width > 0,
    roles: out,
  };
}

/**
 * Compares two measurements. Pure, so the self-test proves it without a browser.
 *
 * @returns `{ refused?: string, differences: string[], compared: number }`
 */
export function compare(app, board) {
  for (const [side, m] of [["app", app], ["board", board]]) {
    if (!m.rootPainted) {
      return { refused: `the ${side} page does not paint [data-slot="${m.rootSlot}"]: it is not the screen (sign-in, error or loading page)`, differences: [], compared: 0 };
    }
  }
  if (app.design !== board.design) {
    return { refused: `data-design differs (app ${app.design}, board ${board.design}): every role would differ by design, not by screen`, differences: [], compared: 0 };
  }
  const differences = [];
  let compared = 0;
  for (const role of Object.keys(board.roles)) {
    const a = app.roles[role];
    const b = board.roles[role];
    if (!a || !b) continue;
    for (const key of COMPARED) {
      compared += 1;
      if (String(a[key]) !== String(b[key])) differences.push(`${role}.${key}: app ${a[key]}, board ${b[key]}`);
    }
  }
  const appParts = app.parts ?? {};
  const boardParts = board.parts ?? {};
  for (const key of [...new Set([...Object.keys(appParts), ...Object.keys(boardParts)])].sort()) {
    const a = appParts[key];
    const b = boardParts[key];
    if (!a || !b) {
      differences.push(`${key}: missing on the ${a ? "board" : "app"}`);
      continue;
    }
    for (const prop of a.button || b.button ? BUTTON_COMPARED : PART_COMPARED) {
      compared += 1;
      if (String(a[prop]) !== String(b[prop])) differences.push(`${key}.${prop}: app ${a[prop]}, board ${b[prop]}`);
    }
  }
  return { differences, compared };
}

function agentBrowser(session, args) {
  return execFileSync("agent-browser", ["--session", session, ...args, "--json"], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
}

function pause(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Opens a page and measures it once the root slot is painted, or after the wait runs out. */
function measureUrl(session, url, o) {
  agentBrowser(session, ["open", url]);
  const expr = `(${String(measure)})(${JSON.stringify(o)})`;
  // Settled means the root is painted and two readings in a row agree on the design: a design's
  // stylesheet loads after the first paint, and a reading taken between the two reports none.
  let last;
  let previous;
  for (let waited = 0; waited <= o.settleMs; waited += 500) {
    const parsed = JSON.parse(agentBrowser(session, ["eval", expr]));
    if (!parsed.success) throw new Error(parsed.error || "eval failed");
    previous = last;
    last = parsed.data.result;
    if (last.rootPainted && previous?.rootPainted && previous.design === last.design && JSON.stringify(previous.roles) === JSON.stringify(last.roles) && JSON.stringify(previous.parts) === JSON.stringify(last.parts)) break;
    pause(500);
  }
  return last;
}

const buttonPart = (over = {}) => ({
  count: 2, button: true, variant: "outline", size: "sm", h: 32, padding: "0px 10px", gap: "6px", radius: "6px",
  border: "1px solid rgb(0, 0, 0)", background: "rgb(255, 255, 255)", font: "13px/20px 500", titleFont: null, bodyFont: null,
  iconSize: "14x14", iconGap: 6, itemGap: null, ...over,
});
const cardPart = (over = {}) => ({
  count: 1, button: false, variant: null, size: null, h: 80, padding: "16px", gap: "8px", radius: "8px",
  border: "1px solid rgb(0, 0, 0)", background: "rgb(255, 255, 255)", font: "14px/20px 400", titleFont: "14px/20px 600",
  bodyFont: "13px/18px 400", iconSize: "16x16", iconGap: 8, itemGap: 4, ...over,
});
const fixture = (over = {}) => ({
  design: "clarity",
  lang: "en",
  rootSlot: "console-record-list",
  rootPainted: true,
  roles: {
    "table-row": { count: 3, h: 44, gap: "normal", radius: "0px", font: "14px/20px 400", variant: null },
    button: { count: 2, h: 32, gap: "6px", radius: "6px", font: "13px/20px 500", variant: "outline" },
  },
  parts: {
    "button@crud-filter-bar-trailing[outline/sm]": buttonPart(),
    "console-explanation-card@console-content-column": cardPart(),
  },
  ...over,
});

function selfTest() {
  const cases = [
    ["identical measurements agree", compare(fixture(), fixture()), (r) => !r.refused && r.differences.length === 0 && r.compared > 0],
    [
      "a taller row is reported",
      compare(fixture({ roles: { ...fixture().roles, "table-row": { ...fixture().roles["table-row"], h: 48 } } }), fixture()),
      (r) => r.differences.length === 1 && r.differences[0].startsWith("table-row.h"),
    ],
    [
      "a different button variant is reported",
      compare(fixture({ roles: { ...fixture().roles, button: { ...fixture().roles.button, variant: "ghost" } } }), fixture()),
      (r) => r.differences.some((d) => d.startsWith("button.variant")),
    ],
    [
      "a button whose icon sits further from its label is reported",
      compare(fixture({ parts: { ...fixture().parts, "button@crud-filter-bar-trailing[outline/sm]": buttonPart({ iconGap: 8 }) } }), fixture()),
      (r) => r.differences.length === 1 && r.differences[0].startsWith("button@crud-filter-bar-trailing[outline/sm].iconGap"),
    ],
    [
      "a card with a different title type and padding is reported on both",
      compare(fixture({ parts: { ...fixture().parts, "console-explanation-card@console-content-column": cardPart({ titleFont: "15px/22px 600", padding: "12px" }) } }), fixture()),
      (r) => r.differences.length === 2 && r.differences.some((d) => d.endsWith(".titleFont: app 15px/22px 600, board 14px/20px 600")),
    ],
    [
      "a part only the board draws is reported missing on the app",
      compare(fixture({ parts: { "button@crud-filter-bar-trailing[outline/sm]": buttonPart() } }), fixture()),
      (r) => r.differences.length === 1 && r.differences[0] === "console-explanation-card@console-content-column: missing on the app",
    ],
    ["a card compares no button height, so content of another length is not a difference", compare(fixture({ parts: { ...fixture().parts, "console-explanation-card@console-content-column": cardPart({ h: 120 }) } }), fixture()), (r) => r.differences.length === 0],
    ["a role only one side draws is not a difference", compare(fixture({ roles: { button: fixture().roles.button } }), fixture()), (r) => r.differences.length === 0],
    ["different designs are refused", compare(fixture({ design: "classic" }), fixture()), (r) => typeof r.refused === "string" && r.refused.includes("data-design")],
    ["a missing root slot is refused", compare(fixture({ rootPainted: false }), fixture()), (r) => typeof r.refused === "string" && r.refused.includes("not the screen")],
  ];
  let failed = 0;
  for (const [name, result, ok] of cases) {
    const pass = ok(result);
    if (!pass) failed += 1;
    console.log(`${pass ? "✔" : "✖"} ${name}`);
  }
  console.log(failed === 0 ? `\n✔ ${cases.length} cases` : `\n✖ ${failed} of ${cases.length} cases came out wrong`);
  return failed === 0 ? 0 : 1;
}

const OPTION_SPEC = {
  flags: ["--selftest", "--print", "--no-parts"],
  valued: ["app", "board", "app-json", "board-json", "root-slot", "roles", "session", "out", "scope", "skip"],
};

function main() {
  const opts = parseOptions(process.argv.slice(2), OPTION_SPEC);
  if (reportUnknown(opts.unknown, OPTION_SPEC)) return 2;
  if (opts.flags.has("--selftest")) return selfTest();
  const v = (k) => opts.values[k];
  const o = {
    roles: v("roles") ? v("roles").split(",") : DEFAULT_ROLES,
    rootSlot: v("root-slot"),
    scope: v("scope"),
    skip: v("skip") ? v("skip").split(",") : DEFAULT_SKIP,
    parts: !opts.flags.has("--no-parts"),
    settleMs: 8000,
  };
  if (opts.flags.has("--print")) {
    console.log(`(${String(measure)})(${JSON.stringify(o)})`);
    return 0;
  }
  if (!o.rootSlot) {
    console.error("compare-rendered needs --root-slot <data-slot>: the slot that proves each page is the screen");
    return 2;
  }
  const session = v("session") ?? "simplix-compare-rendered";
  let app;
  let board;
  try {
    app = v("app-json") ? JSON.parse(fs.readFileSync(v("app-json"), "utf8")) : v("app") ? measureUrl(session, v("app"), o) : undefined;
    board = v("board-json") ? JSON.parse(fs.readFileSync(v("board-json"), "utf8")) : v("board") ? measureUrl(session, v("board"), o) : undefined;
  } catch (e) {
    console.error(`✖ could not measure: ${e.message}`);
    return 2;
  }
  if (!app || !board) {
    console.error("compare-rendered needs both sides: --app or --app-json, and --board or --board-json");
    return 2;
  }
  const result = compare(app, board);
  if (v("out")) fs.writeFileSync(v("out"), JSON.stringify({ app, board, ...result }, null, 1));
  if (result.refused) {
    console.error(`✖ refused: ${result.refused}`);
    return 2;
  }
  console.log(`${result.differences.length === 0 ? "✔" : "✖"} compared ${result.compared} role and part properties, ${result.differences.length} differ`);
  for (const d of result.differences) console.log(`   ${d}`);
  if (app.lang !== board.lang) console.log(`   ⚠ lang differs (app ${app.lang}, board ${board.lang}): the two pages were measured in different locales`);
  return result.differences.length === 0 ? 0 : 1;
}

const invokedDirectly =
  process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(new URL(import.meta.url).pathname);
if (invokedDirectly) process.exit(main());
