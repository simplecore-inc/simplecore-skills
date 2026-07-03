#!/usr/bin/env node
/**
 * JSON-based SVG layout engine for architecture diagrams.
 * Auto-calculates coordinates based on layout rules.
 *
 * Usage:
 *   node layout.js <input.json> [options]
 *   node layout.js <input.json> -o output.svg
 *   cat input.json | node layout.js
 *
 * Options:
 *   -o, --output <file>   Write SVG to file instead of stdout
 *   --help, -h            Show help
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ── Theme ──

const THEMES = {
  'tokyo-night': {
    bg: '#1a1b26', fg: '#c0caf5', line: '#3d59a1',
    accent: '#7aa2f7', muted: '#565f89',
  },
  'dracula': {
    bg: '#282a36', fg: '#f8f8f2', line: '#6272a4',
    accent: '#bd93f9', muted: '#6272a4',
  },
  'nord': {
    bg: '#2e3440', fg: '#d8dee9', line: '#4c566a',
    accent: '#88c0d0', muted: '#4c566a',
  },
};

// ── Layout Constants ──

const DEFAULTS = {
  canvasWidth: 680,
  canvasPadding: 30,
  layerGap: 40,
  sublayerGap: 35,
  nodeGapH: 20,
  nodeGapV: 28,
  nodeHeight1: 38,
  nodeHeight2: 54,
  subgroupHeaderH: 24,
  subgroupPadX: 20,
  subgroupPadTop: 38,
  subgroupPadBottom: 16,
  minBendGap: 40,
  minNodeWidth: 120,
  edgeLabelH: 20,
  edgeLabelPad: 8,
};

// ── Text Width (CJK-aware) ──
// Hangul/Kana/CJK/fullwidth glyphs render ~1 em wide; Latin ~0.6 em. A
// Latin-only per-char constant makes Korean/Japanese titles overflow their
// boxes, so width estimation must count wide glyphs at wide width.

// Keep in sync with svgkit._is_wide and audit.py._is_wide — the generator
// and the linter must measure text identically.
function isWide(ch) {
  const o = ch.codePointAt(0);
  return (o >= 0x1100 && o <= 0x11FF) || (o >= 0x3000 && o <= 0x303F)
    || (o >= 0x3040 && o <= 0x30FF) || (o >= 0x3130 && o <= 0x318F)
    || (o >= 0x31F0 && o <= 0x31FF) || (o >= 0x3200 && o <= 0x33FF)
    || (o >= 0x3400 && o <= 0x4DBF) || (o >= 0x4E00 && o <= 0x9FFF)
    || (o >= 0xA960 && o <= 0xA97F) || (o >= 0xAC00 && o <= 0xD7A3)
    || (o >= 0xD7B0 && o <= 0xD7FF) || (o >= 0xF900 && o <= 0xFAFF)
    || (o >= 0xFF00 && o <= 0xFFEF) || (o >= 0x20000 && o <= 0x3FFFD);
}

function textW(s, perLatin, perWide) {
  let w = 0;
  for (const ch of String(s || '')) w += isWide(ch) ? perWide : perLatin;
  return w;
}

// ── Layout Engine ──

function computeLayout(spec) {
  const C = { ...DEFAULTS, ...(spec.canvas || {}) };
  let canvasW = C.canvasWidth || C.width || 680;
  const pad = C.canvasPadding || C.padding || 30;

  // Auto-grow the canvas when a node label cannot fit at the requested
  // width — a clipped/overflowing label is worse than a wider picture.
  function maxTextNeed(layer, depth) {
    let need = 0;
    for (const n of layer.nodes || []) {
      const t = Math.max(textW(n.title, 8, 13.7), textW(n.subtitle, 6.2, 11.4));
      need = Math.max(need, t + 40 + pad * 2 + C.subgroupPadX * 2 * (depth + 1));
    }
    for (const s of layer.sublayers || []) {
      need = Math.max(need, maxTextNeed(s, depth + 1));
    }
    return need;
  }
  for (const l of spec.layers || []) {
    canvasW = Math.max(canvasW, Math.ceil(maxTextNeed(l, 0)));
  }
  const innerW = canvasW - pad * 2;

  const nodes = new Map(); // id -> { x, y, w, h, cx, cy }
  let curY = pad;

  function layoutLayer(layer, parentX, parentW, depth) {
    const x = parentX;
    const w = parentW;
    const startY = curY;

    // Subgroup header
    curY += C.subgroupPadTop;

    // Sublayers first
    if (layer.sublayers && layer.sublayers.length > 0) {
      for (let i = 0; i < layer.sublayers.length; i++) {
        if (i > 0) curY += C.sublayerGap;
        layoutLayer(layer.sublayers[i], x + C.subgroupPadX, w - C.subgroupPadX * 2, depth + 1);
      }
    }

    // Nodes
    if (layer.nodes && layer.nodes.length > 0) {
      const nodeArea = w - C.subgroupPadX * 2;
      const nCount = layer.nodes.length;
      const direction = layer.direction || (nCount * (C.minNodeWidth + C.nodeGapH) <= nodeArea ? 'row' : 'column');

      if (direction === 'row') {
        // Horizontal layout. Node width must fit the widest title AND
        // subtitle (CJK-aware) — wrap onto as many rows as that requires,
        // and never shrink below the text width even if the row overflows
        // (the audit lint reports the overflow; clipped text would hide it).
        const minNodeW = Math.max(C.minNodeWidth, ...layer.nodes.map(n =>
          Math.max(textW(n.title, 8, 13.7), textW(n.subtitle, 6.2, 11.4)) + 30));
        const maxPerRow = Math.max(1, Math.floor((nodeArea + C.nodeGapH) / (minNodeW + C.nodeGapH)));
        const rowCount = Math.ceil(nCount / maxPerRow);
        const perRow = Math.ceil(nCount / rowCount);
        const nodeW = Math.max(minNodeW,
          Math.floor((nodeArea - (perRow - 1) * C.nodeGapH) / perRow));
        const nodeH = layer.nodes.some(n => n.subtitle) ? C.nodeHeight2 : C.nodeHeight1;
        const startX = x + C.subgroupPadX;

        for (let i = 0; i < nCount; i++) {
          const row = Math.floor(i / perRow);
          const col = i % perRow;
          // Center partial last row
          const itemsInThisRow = Math.min(perRow, nCount - row * perRow);
          const rowStartX = startX + (nodeArea - itemsInThisRow * (nodeW + C.nodeGapH) + C.nodeGapH) / 2;
          const nx = rowStartX + col * (nodeW + C.nodeGapH);
          const ny = curY + row * (nodeH + C.nodeGapV);
          const node = layer.nodes[i];
          nodes.set(node.id, {
            x: nx, y: ny, w: nodeW, h: nodeH,
            cx: nx + nodeW / 2, cy: ny + nodeH / 2,
            title: node.title, subtitle: node.subtitle,
            fill: node.fill, color: node.color,
          });
        }
        curY += rowCount * nodeH + (rowCount - 1) * C.nodeGapV;
      } else {
        // Vertical layout — same width, centered
        const maxLabelLen = Math.max(...layer.nodes.map(n =>
          Math.max(textW(n.title, 8, 13.7), textW(n.subtitle, 6.2, 11.4)) + 40));
        const nodeW = Math.min(Math.max(maxLabelLen, C.minNodeWidth), nodeArea);
        const startX = x + (w - nodeW) / 2;

        for (let i = 0; i < nCount; i++) {
          if (i > 0) curY += C.nodeGapV;
          const node = layer.nodes[i];
          const nodeH = node.subtitle ? C.nodeHeight2 : C.nodeHeight1;
          nodes.set(node.id, {
            x: startX, y: curY, w: nodeW, h: nodeH,
            cx: startX + nodeW / 2, cy: curY + nodeH / 2,
            title: node.title, subtitle: node.subtitle,
            fill: node.fill, color: node.color,
          });
          curY += nodeH;
        }
      }
    }

    curY += C.subgroupPadBottom;
    const totalH = curY - startY;

    // Store layer bounds
    layer._bounds = { x, y: startY, w, h: totalH };
    return totalH;
  }

  // Process all top-level layers
  for (let i = 0; i < spec.layers.length; i++) {
    if (i > 0) curY += C.layerGap;
    layoutLayer(spec.layers[i], pad, innerW, 0);
  }

  curY += pad;

  return { nodes, totalHeight: curY, canvasW, pad, C };
}

// ── SVG Renderer ──

function renderSVG(spec, layout) {
  const { nodes, totalHeight, canvasW } = layout;
  if (spec.theme && !THEMES[spec.theme]) {
    // fail loudly: a silent fallback renders a plausible-but-wrong palette
    throw new Error(`Unknown theme '${spec.theme}' — valid: ${Object.keys(THEMES).join(', ')}`);
  }
  const theme = THEMES[spec.theme] || THEMES['tokyo-night'];
  const lines = [];

  // Header
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasW} ${totalHeight}" width="${canvasW}" height="${totalHeight}"`);
  lines.push(`     style="--bg:${theme.bg};--fg:${theme.fg};--line:${theme.line};--accent:${theme.accent};--muted:${theme.muted};background:var(--bg)">`);
  lines.push(`<style>`);
  lines.push(`  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;display=swap');`);
  lines.push(`  text { font-family: 'Inter', system-ui, sans-serif; }`);
  lines.push(`  svg {`);
  lines.push(`    --_text:        var(--fg);`);
  lines.push(`    --_text-sec:    var(--muted);`);
  lines.push(`    --_line:        var(--line);`);
  lines.push(`    --_arrow:       var(--accent);`);
  lines.push(`    --_node-fill:   color-mix(in srgb, var(--fg) 5%, var(--bg));`);
  lines.push(`    --_node-stroke: color-mix(in srgb, var(--fg) 20%, var(--bg));`);
  lines.push(`    --_group-fill:  var(--bg);`);
  lines.push(`    --_group-hdr:   color-mix(in srgb, var(--fg) 6%, var(--bg));`);
  lines.push(`    --_inner-stroke:color-mix(in srgb, var(--fg) 12%, var(--bg));`);
  lines.push(`  }`);
  lines.push(`</style>`);
  lines.push(`<defs>`);
  lines.push(`  <marker id="ah" markerWidth="8" markerHeight="5" refX="7" refY="2.5" orient="auto">`);
  lines.push(`    <polygon points="0 0, 8 2.5, 0 5" fill="var(--_arrow)" stroke="var(--_arrow)" stroke-width="0.75" stroke-linejoin="round"/>`);
  lines.push(`  </marker>`);
  lines.push(`</defs>`);

  // Render layers (subgroups)
  function renderLayer(layer, depth) {
    const b = layer._bounds;
    const strokeW = depth === 0 ? '1.2' : '1';
    const rx = depth === 0 ? '4' : '3';
    const color = layer.color || '#7aa2f7';

    lines.push(`<g class="subgraph">`);
    lines.push(`  <rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${rx}" fill="var(--_group-fill)" stroke="${color}" stroke-width="${strokeW}"/>`);
    if (layer.label) {
      lines.push(`  <rect x="${b.x}" y="${b.y}" width="${b.w}" height="${DEFAULTS.subgroupHeaderH}" rx="${rx}" fill="var(--_group-hdr)" stroke="${color}" stroke-width="${strokeW}"/>`);
      lines.push(`  <text x="${b.x + 12}" y="${b.y + 16}" font-size="${depth === 0 ? 11 : 10}" font-weight="600" fill="${color}">${escXml(layer.label)}</text>`);
    }
    lines.push(`</g>`);

    if (layer.sublayers) layer.sublayers.forEach(s => renderLayer(s, depth + 1));
  }
  spec.layers.forEach(l => renderLayer(l, 0));

  // Render nodes
  for (const [id, n] of nodes) {
    if (n.fill) {
      // Colored node (pipeline style)
      lines.push(`<g class="node">`);
      lines.push(`  <rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="3" fill="${n.fill}" stroke="${n.fill}" stroke-width="0.75"/>`);
      if (n.subtitle) {
        lines.push(`  <text x="${n.cx}" y="${n.y + 22}" text-anchor="middle" font-size="13" font-weight="500" fill="${n.color || '#1a1b26'}">${escXml(n.title)}</text>`);
        lines.push(`  <text x="${n.cx}" y="${n.y + 40}" text-anchor="middle" font-size="11" fill="${n.color || '#1a1b26'}" opacity="0.7">${escXml(n.subtitle)}</text>`);
      } else {
        lines.push(`  <text x="${n.cx}" y="${n.y + 24}" text-anchor="middle" font-size="13" font-weight="500" fill="${n.color || '#1a1b26'}">${escXml(n.title)}</text>`);
      }
      lines.push(`</g>`);
    } else {
      // Standard node
      lines.push(`<g class="node">`);
      lines.push(`  <rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="3" fill="var(--_node-fill)" stroke="var(--_node-stroke)" stroke-width="0.75"/>`);
      if (n.subtitle) {
        lines.push(`  <text x="${n.cx}" y="${n.y + 22}" text-anchor="middle" font-size="13" font-weight="500" fill="var(--_text)">${escXml(n.title)}</text>`);
        lines.push(`  <text x="${n.cx}" y="${n.y + 40}" text-anchor="middle" font-size="11" fill="var(--_text-sec)">${escXml(n.subtitle)}</text>`);
      } else {
        lines.push(`  <text x="${n.cx}" y="${n.y + 24}" text-anchor="middle" font-size="13" font-weight="500" fill="var(--_text)">${escXml(n.title)}</text>`);
      }
      lines.push(`</g>`);
    }
  }

  // Render edges — group fan-outs for clean routing
  if (spec.edges) {
    // Group edges by source node
    const fanOutGroups = new Map(); // fromId -> [{to, label}]
    const soloEdges = [];

    for (const edge of spec.edges) {
      if (!fanOutGroups.has(edge.from)) fanOutGroups.set(edge.from, []);
      fanOutGroups.get(edge.from).push(edge);
    }

    for (const [fromId, edges] of fanOutGroups) {
      const from = nodes.get(fromId);
      if (!from) continue;

      if (edges.length === 1) {
        // Single edge — render normally
        const to = nodes.get(edges[0].to);
        if (to) renderEdge(lines, from, to, edges[0].label);
      } else {
        // Fan-out group — shared trunk + individual branches
        renderFanOut(lines, from, edges, nodes);
      }
    }
  }

  lines.push(`</svg>`);
  return lines.join('\n');
}

function renderEdge(lines, from, to, label) {
  const gap = DEFAULTS.minBendGap;
  const dx = Math.abs(to.cx - from.cx);
  const dy = to.y - (from.y + from.h);

  if (dx < 10 && dy > 0) {
    // Straight vertical
    lines.push(`<line x1="${from.cx}" y1="${from.y + from.h}" x2="${to.cx}" y2="${to.y}" stroke="var(--_line)" stroke-width="1" marker-end="url(#ah)"/>`);
  } else if (Math.abs(from.cy - to.cy) < 10) {
    // Straight horizontal
    lines.push(`<line x1="${from.x + from.w}" y1="${from.cy}" x2="${to.x}" y2="${to.cy}" stroke="var(--_line)" stroke-width="1" marker-end="url(#ah)"/>`);
  } else {
    // L-shaped. Clamp the bend so the FINAL vertical segment into the target
    // is >=18px — otherwise a row-crossing edge with the default node gap
    // leaves only a head-length stub (SHORT-ARROW).
    const midY = Math.max(from.y + from.h + 4,
      Math.min(from.y + from.h + Math.max(gap / 2, (to.y - from.y - from.h) / 3),
               to.y - 18));
    lines.push(`<line x1="${from.cx}" y1="${from.y + from.h}" x2="${from.cx}" y2="${midY}" stroke="var(--_line)" stroke-width="1"/>`);
    lines.push(`<line x1="${from.cx}" y1="${midY}" x2="${to.cx}" y2="${midY}" stroke="var(--_line)" stroke-width="1"/>`);
    lines.push(`<line x1="${to.cx}" y1="${midY}" x2="${to.cx}" y2="${to.y}" stroke="var(--_line)" stroke-width="1" marker-end="url(#ah)"/>`);
  }

  // Edge label (single edge)
  if (label) {
    const lw = textW(label, 7, 10.6) + 16;
    const lx = (from.cx + to.cx) / 2 - lw / 2;
    const ly = from.y + from.h + 6;
    lines.push(`<rect x="${lx}" y="${ly}" width="${lw}" height="${DEFAULTS.edgeLabelH}" rx="2" fill="var(--bg)" stroke="var(--_inner-stroke)" stroke-width="0.75"/>`);
    lines.push(`<text x="${lx + lw / 2}" y="${ly + 14}" text-anchor="middle" font-size="10" fill="var(--_text-sec)">${escXml(label)}</text>`);
  }
}

function renderFanOut(lines, from, edges, nodes) {
  const gap = DEFAULTS.minBendGap;
  const targets = edges.map(e => nodes.get(e.to)).filter(Boolean);
  if (targets.length === 0) return;

  // Shared trunk: vertical line from source bottom to branch point.
  // Same >=18px final-drop clamp as renderEdge (SHORT-ARROW guard).
  const minTargetY = Math.min(...targets.map(t => t.y));
  const branchY = Math.max(from.y + from.h + 4,
    Math.min(from.y + from.h + Math.max(gap / 2, (minTargetY - from.y - from.h) / 3),
             minTargetY - 18));

  // Trunk line
  lines.push(`<line x1="${from.cx}" y1="${from.y + from.h}" x2="${from.cx}" y2="${branchY}" stroke="var(--_line)" stroke-width="1"/>`);

  // Horizontal rail connecting all branch points
  const targetXs = targets.map(t => t.cx).sort((a, b) => a - b);
  const railLeft = Math.min(from.cx, targetXs[0]);
  const railRight = Math.max(from.cx, targetXs[targetXs.length - 1]);
  lines.push(`<line x1="${railLeft}" y1="${branchY}" x2="${railRight}" y2="${branchY}" stroke="var(--_line)" stroke-width="1"/>`);

  // Individual drops to each target
  for (const to of targets) {
    lines.push(`<line x1="${to.cx}" y1="${branchY}" x2="${to.cx}" y2="${to.y}" stroke="var(--_line)" stroke-width="1" marker-end="url(#ah)"/>`);
  }

  // Labels
  for (const edge of edges) {
    if (edge.label) {
      const to = nodes.get(edge.to);
      if (!to) continue;
      const lw = textW(edge.label, 7, 10.6) + 16;
      const lx = to.cx - lw / 2;
      const ly = branchY + 4;
      lines.push(`<rect x="${lx}" y="${ly}" width="${lw}" height="${DEFAULTS.edgeLabelH}" rx="2" fill="var(--bg)" stroke="var(--_inner-stroke)" stroke-width="0.75"/>`);
      lines.push(`<text x="${lx + lw / 2}" y="${ly + 14}" text-anchor="middle" font-size="10" fill="var(--_text-sec)">${escXml(edge.label)}</text>`);
    }
  }
}

function escXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Public API (for import from convert.js) ──

export { computeLayout, renderSVG, THEMES, DEFAULTS };

// ── CLI (only when run directly) ──

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
JSON-based SVG Layout Engine

Usage:
  node layout.js <input.json> [-o output.svg]
  cat input.json | node layout.js [-o output.svg]

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
      const layout = computeLayout(spec);
      svg = renderSVG(spec, layout);
    } catch (e) { console.error('Error:', e.message); process.exit(1); }

    if (opts.outputFile) {
      fs.writeFileSync(path.resolve(opts.outputFile), svg, 'utf8');
      console.error(`Written to ${opts.outputFile}`);
    } else {
      console.log(svg);
    }
  })();
}
