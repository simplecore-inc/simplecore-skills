#!/usr/bin/env node
/**
 * Graph auto-layout engine (dagre backend) for arbitrary directed graphs.
 *
 * Where layout.js stacks a hand-authored layer hierarchy, this engine takes a
 * flat node+edge spec and derives ranks from the edges themselves — so a graph
 * with branches, joins, and back-references places by topology instead of being
 * flattened into one column. Node sizes are measured CJK-aware and fed to dagre
 * as input, and the result is drawn through the shared svgcommon primitives, so
 * themes, glyph-width sizing, and the render audit all apply unchanged.
 *
 * Usage:
 *   node graph.js <input.json> [-o output.svg]
 *   cat input.json | node graph.js
 *
 * Spec shape:
 *   {
 *     "theme": "tokyo-night",            // tokyo-night | dracula | nord
 *     "direction": "TB",                 // TB | BT | LR | RL  (TD == TB)
 *     "canvas": { "padding": 30 },       // optional
 *     "nodesep": 45, "ranksep": 55,      // optional dagre spacing
 *     "nodes":  [{ "id", "title", "subtitle"?, "color"?, "fill"?, "group"? }],
 *     "groups": [{ "id", "label", "color"? }],   // optional compound clusters
 *     "edges":  [{ "from", "to", "label"? }]
 *   }
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dagre from './vendor/dagre.esm.js';
import { THEMES, textW, escXml, svgHeader, renderNodeBox } from './svgcommon.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Sizing constants (kept in step with layout.js DEFAULTS) ──
const MIN_NODE_W = 120;
const NODE_H1 = 38;         // no subtitle
const NODE_H2 = 54;         // with subtitle
const GROUP_HEADER_H = 24;
const EDGE_LABEL_H = 20;

function normalizeDir(dir) {
  const d = String(dir || 'TB').toUpperCase();
  if (d === 'TD') return 'TB';
  if (['TB', 'BT', 'LR', 'RL'].includes(d)) return d;
  throw new Error(`Unknown direction '${dir}' — valid: TB, BT, LR, RL (TD == TB)`);
}

// Force the final edge segment perpendicular to the entered node edge and at
// least 18px long. dagre routes the bulk of the path well but leaves ~30% of
// final approaches oblique; a slanted last segment lands the arrowhead at an
// angle (OBLIQUE-ARROW) instead of square on the border. Inserting a knee just
// before the endpoint fixes the approach without disturbing the earlier route.
function forcePerp(points, rankdir) {
  const pts = points.map(p => ({ x: p.x, y: p.y }));
  if (pts.length < 2) return pts;
  const end = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  let knee;
  if (rankdir === 'TB' || rankdir === 'BT') {
    const kneeY = rankdir === 'TB'
      ? Math.min(prev.y, end.y - 18)   // enter from top, descend into node
      : Math.max(prev.y, end.y + 18);  // enter from bottom, ascend into node
    knee = { x: end.x, y: kneeY };
  } else {
    const kneeX = rankdir === 'LR'
      ? Math.min(prev.x, end.x - 18)   // enter from left, advance into node
      : Math.max(prev.x, end.x + 18);  // enter from right, advance into node
    knee = { x: kneeX, y: end.y };
  }
  pts.splice(pts.length - 1, 0, knee);
  return pts;
}

// ── Layout ──

function computeGraphLayout(spec) {
  if (spec.theme && !THEMES[spec.theme]) {
    throw new Error(`Unknown theme '${spec.theme}' — valid: ${Object.keys(THEMES).join(', ')}`);
  }
  const theme = THEMES[spec.theme] || THEMES['tokyo-night'];
  const rankdir = normalizeDir(spec.direction);
  const pad = (spec.canvas && (spec.canvas.padding ?? spec.canvas.canvasPadding)) ?? 30;

  const g = new dagre.graphlib.Graph({ multigraph: true, compound: true });
  g.setGraph({
    rankdir,
    nodesep: spec.nodesep ?? 45,
    ranksep: spec.ranksep ?? 55,
    marginx: pad,
    marginy: pad,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Clusters first: a labeled cluster makes dagre reserve top space for the
  // header chip drawn later.
  const groupIds = new Set();
  for (const grp of spec.groups || []) {
    if (grp.id == null) throw new Error('group is missing "id"');
    g.setNode(grp.id, { label: grp.label || '' });
    groupIds.add(grp.id);
  }

  // Nodes, measured CJK-aware so dagre spaces them for the real glyph width.
  for (const n of spec.nodes || []) {
    if (n.id == null) throw new Error('node is missing "id"');
    const w = Math.max(MIN_NODE_W,
      Math.max(textW(n.title, 8, 13.7), textW(n.subtitle, 6.2, 11.4)) + 30);
    const h = n.subtitle ? NODE_H2 : NODE_H1;
    g.setNode(n.id, { width: w, height: h });
    if (n.group != null) {
      if (!groupIds.has(n.group)) {
        throw new Error(`node '${n.id}' references unknown group '${n.group}'`);
      }
      g.setParent(n.id, n.group);
    }
  }

  const edgeList = spec.edges || [];
  edgeList.forEach((e, i) => {
    if (e.from == null || e.to == null) throw new Error('edge needs both "from" and "to"');
    const cfg = {};
    if (e.label) {
      cfg.label = e.label;
      cfg.width = textW(e.label, 7, 10.6) + 16;
      cfg.height = EDGE_LABEL_H;
      cfg.labelpos = 'c';
    }
    g.setEdge(e.from, e.to, cfg, 'e' + i);
  });

  dagre.layout(g);

  const nodes = new Map();
  for (const n of spec.nodes || []) {
    const d = g.node(n.id);
    if (!d) continue;
    nodes.set(n.id, {
      x: d.x - d.width / 2, y: d.y - d.height / 2, w: d.width, h: d.height,
      cx: d.x, cy: d.y, title: n.title, subtitle: n.subtitle,
      fill: n.fill, color: n.color,
    });
  }

  const groups = [];
  for (const grp of spec.groups || []) {
    const d = g.node(grp.id);
    if (!d) continue;
    groups.push({
      x: d.x - d.width / 2, y: d.y - d.height / 2, w: d.width, h: d.height,
      label: grp.label, color: grp.color || theme.accent,
    });
  }

  const edges = [];
  edgeList.forEach((e, i) => {
    const d = g.edge(e.from, e.to, 'e' + i);
    if (!d || !d.points) return;
    edges.push({
      points: forcePerp(d.points, rankdir),
      label: e.label,
      lx: d.x, ly: d.y,
    });
  });

  const gg = g.graph();
  return {
    canvasW: Math.ceil(gg.width), canvasH: Math.ceil(gg.height),
    nodes, groups, edges, theme,
  };
}

// ── Render ──

function renderGraphSVG(spec, layout) {
  const { canvasW, canvasH, nodes, groups, edges, theme } = layout;
  const lines = [];
  lines.push(...svgHeader(canvasW, canvasH, theme));

  // Groups (underlay) — panel + a left-anchored label tab. A full-width header
  // band would be struck through by every edge dropping into a node inside the
  // group (ARROW-THROUGH-BOX); a tab sized to the label sits in the group's
  // left padding gutter, clear of the node columns.
  for (const grp of groups) {
    lines.push(`<g class="subgraph">`);
    lines.push(`  <rect x="${grp.x}" y="${grp.y}" width="${grp.w}" height="${grp.h}" rx="4" fill="var(--_group-fill)" stroke="${grp.color}" stroke-width="1.2"/>`);
    if (grp.label) {
      const tabW = Math.min(grp.w, textW(grp.label, 7.5, 12) + 22);
      lines.push(`  <rect x="${grp.x}" y="${grp.y}" width="${tabW.toFixed(1)}" height="${GROUP_HEADER_H}" rx="4" fill="var(--_group-hdr)" stroke="${grp.color}" stroke-width="1.2"/>`);
      lines.push(`  <text x="${grp.x + 11}" y="${grp.y + 16}" font-size="11" font-weight="600" fill="${grp.color}">${escXml(grp.label)}</text>`);
    }
    lines.push(`</g>`);
  }

  // Nodes.
  for (const [, n] of nodes) {
    lines.push(...renderNodeBox(n));
  }

  // Edges (on top so arrowheads stay visible), each followed by its label pill.
  for (const e of edges) {
    const d = e.points.map((p, i) =>
      `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    lines.push(`<path d="${d}" fill="none" stroke="var(--_line)" stroke-width="1" marker-end="url(#ah)"/>`);
    if (e.label) {
      const lw = textW(e.label, 7, 10.6) + 16;
      const lx = e.lx - lw / 2;
      const ly = e.ly - EDGE_LABEL_H / 2;
      lines.push(`<rect x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" width="${lw}" height="${EDGE_LABEL_H}" rx="2" fill="var(--bg)" stroke="var(--_inner-stroke)" stroke-width="0.75"/>`);
      lines.push(`<text x="${e.lx.toFixed(1)}" y="${(ly + 14).toFixed(1)}" text-anchor="middle" font-size="10" fill="var(--_text-sec)">${escXml(e.label)}</text>`);
    }
  }

  lines.push(`</svg>`);
  return lines.join('\n');
}

// ── Public API (for import from convert.js) ──

export { computeGraphLayout, renderGraphSVG };

// ── CLI ──

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const args = process.argv.slice(2);
  const opts = { inputFile: null, outputFile: null, help: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--help' || a === '-h') opts.help = true;
    else if ((a === '-o' || a === '--output') && args[i + 1]) opts.outputFile = args[++i];
    else if (!a.startsWith('-')) opts.inputFile = a;
  }

  if (opts.help) {
    console.log(`
Graph auto-layout engine (dagre backend)

Usage:
  node graph.js <input.json> [-o output.svg]
  cat input.json | node graph.js [-o output.svg]

Spec: { theme, direction (TB|BT|LR|RL), canvas:{padding}, nodesep, ranksep,
        nodes:[{id,title,subtitle?,color?,fill?,group?}],
        groups:[{id,label,color?}], edges:[{from,to,label?}] }

Options:
  -o, --output <file>   Write SVG to file (default: stdout)
  -h, --help            Show help
`);
    process.exit(0);
  }

  (async () => {
    let jsonStr = '';
    if (opts.inputFile) {
      const p = path.resolve(opts.inputFile);
      if (!fs.existsSync(p)) { console.error(`File not found: ${p}`); process.exit(1); }
      jsonStr = fs.readFileSync(p, 'utf8');
    } else {
      const chunks = [];
      for await (const chunk of process.stdin) chunks.push(chunk);
      jsonStr = Buffer.concat(chunks).toString('utf8');
    }
    if (!jsonStr.trim()) { console.error('No JSON input'); process.exit(1); }

    let spec;
    try { spec = JSON.parse(jsonStr); }
    catch (e) { console.error('Invalid JSON:', e.message); process.exit(1); }

    let svg;
    try {
      const layout = computeGraphLayout(spec);
      svg = renderGraphSVG(spec, layout);
    } catch (e) { console.error('Error:', e.message); process.exit(1); }

    if (opts.outputFile) {
      fs.writeFileSync(path.resolve(opts.outputFile), svg, 'utf8');
      console.error(`Written to ${opts.outputFile}`);
    } else {
      console.log(svg);
    }
  })();
}
