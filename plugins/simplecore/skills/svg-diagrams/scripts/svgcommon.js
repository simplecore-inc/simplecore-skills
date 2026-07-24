/**
 * Shared SVG primitives for the JSON-spec layout engines (layout.js, graph.js).
 *
 * Centralizes theme palettes, CJK-aware text measurement, XML escaping, the SVG
 * preamble (style + arrowhead marker), and node-box rendering so the layered
 * engine and the dagre graph engine measure and draw identically. Keeping one
 * copy here is what lets a node sized by one engine be rendered by the other
 * without drift.
 */

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

// ── Text Width (CJK-aware) ──
// Hangul/Kana/CJK/fullwidth glyphs render ~1 em wide; Latin ~0.6 em. A
// Latin-only per-char constant makes Korean/Japanese titles overflow their
// boxes, so width estimation must count wide glyphs at wide width.
//
// Keep isWide in sync with svgkit._is_wide and audit.py._is_wide — the
// generators and the linter must measure text identically.

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

function escXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── SVG preamble ──
// Emits the <svg> open tag, the theme CSS variables, and the shared arrowhead
// marker (id="ah"). Both JSON engines route through this so a single marker
// convention holds across the family (never mix with svgkit's arr-<name>).

function svgHeader(canvasW, totalHeight, theme) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasW} ${totalHeight}" width="${canvasW}" height="${totalHeight}"`,
    `     style="--bg:${theme.bg};--fg:${theme.fg};--line:${theme.line};--accent:${theme.accent};--muted:${theme.muted};background:var(--bg)">`,
    `<style>`,
    `  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;display=swap');`,
    `  text { font-family: 'Inter', system-ui, sans-serif; }`,
    `  svg {`,
    `    --_text:        var(--fg);`,
    `    --_text-sec:    var(--muted);`,
    `    --_line:        var(--line);`,
    `    --_arrow:       var(--accent);`,
    `    --_node-fill:   color-mix(in srgb, var(--fg) 5%, var(--bg));`,
    `    --_node-stroke: color-mix(in srgb, var(--fg) 20%, var(--bg));`,
    `    --_group-fill:  var(--bg);`,
    `    --_group-hdr:   color-mix(in srgb, var(--fg) 6%, var(--bg));`,
    `    --_inner-stroke:color-mix(in srgb, var(--fg) 12%, var(--bg));`,
    `  }`,
    `</style>`,
    `<defs>`,
    `  <marker id="ah" markerWidth="8" markerHeight="5" refX="7" refY="2.5" orient="auto">`,
    `    <polygon points="0 0, 8 2.5, 0 5" fill="var(--_arrow)" stroke="var(--_arrow)" stroke-width="0.75" stroke-linejoin="round"/>`,
    `  </marker>`,
    `</defs>`,
  ];
}

// ── Node box ──
// Renders one node given TOP-LEFT geometry (x, y, w, h) plus its center
// (cx, cy). A `fill` makes it a solid colored node (pipeline style) with text
// in `color`; otherwise it draws a themed outline node. Callers that work in
// center coordinates (dagre) convert to top-left before calling.

function renderNodeBox(n) {
  const lines = [];
  if (n.fill) {
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
  return lines;
}

export { THEMES, isWide, textW, escXml, svgHeader, renderNodeBox };
