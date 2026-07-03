#!/usr/bin/env node
/**
 * Mermaid to ASCII/SVG converter using beautiful-mermaid library
 *
 * Usage:
 *   node convert.js <input-file> [options]
 *   echo "graph TD; A-->B" | node convert.js [options]
 *   node convert.js --inline "graph TD; A-->B" [options]
 *
 * Options:
 *   --ascii           Use ASCII characters instead of Unicode box-drawing
 *   --svg             Output SVG via beautiful-mermaid (auto layout)
 *   --layout          Output SVG via layout engine (precise coordinate control)
 *   --to-json         Convert Mermaid to layout JSON (for manual editing)
 *   --theme <name>    Use built-in theme (tokyo-night, dracula, nord, etc.)
 *   --bg <color>      Background color for SVG
 *   --fg <color>      Foreground color for SVG
 *   --padding <n>     ASCII padding (default: 5)
 *   --width <n>       Canvas width for --layout mode (default: 680)
 *   --help, -h        Show help
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let beautifulMermaid = null;

async function loadBeautifulMermaid() {
  if (beautifulMermaid) return beautifulMermaid;

  const strategies = [
    async () => await import('beautiful-mermaid'),
    async () => {
      const modulePath = path.join(__dirname, '..', '..', 'node_modules', 'beautiful-mermaid', 'dist', 'index.js');
      return await import(modulePath);
    },
    async () => {
      const { execFileSync } = await import('child_process');
      const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
      return await import(path.join(globalRoot, 'beautiful-mermaid', 'dist', 'index.js'));
    },
  ];

  for (const strategy of strategies) {
    try {
      beautifulMermaid = await strategy();
      return beautifulMermaid;
    } catch {
      // Try next strategy
    }
  }

  console.error('Error: beautiful-mermaid is not installed.');
  console.error('Install with: npm install -g beautiful-mermaid');
  process.exit(1);
}

// ── Mermaid → Layout JSON Parser ──

function mermaidToLayoutSpec(mermaidCode, options = {}) {
  const lines = mermaidCode.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%'));

  // This parser understands flowchart/graph syntax only. Other diagram types
  // would silently produce a bogus spec, so fail loudly instead.
  if (!/^(graph|flowchart)\s/i.test(lines[0] || '')) {
    throw new Error(
      '--to-json/--layout support flowchart/graph syntax only; '
      + 'use --svg (beautiful-mermaid) for sequence/state/class/er diagrams');
  }
  const spec = {
    theme: options.theme || 'tokyo-night',
    canvas: { width: options.width || 680, padding: 30 },
    layers: [],
    edges: [],
  };

  // Parse direction
  const firstLine = lines[0] || '';
  const dirMatch = firstLine.match(/^(graph|flowchart)\s+(TD|TB|LR|RL|BT)/i);
  const direction = dirMatch ? dirMatch[2].toUpperCase() : 'TD';

  // Subgraph stack
  const layerStack = [{ sublayers: spec.layers, nodes: [] }];
  const nodeMap = new Map();
  const colors = ['#7aa2f7', '#bb9af7', '#f7768e', '#9ece6a', '#e0af68', '#73daca', '#7dcfff', '#ff007c'];
  let colorIdx = 0;

  for (const line of lines) {
    // Skip graph/flowchart declaration
    if (/^(graph|flowchart)\s/i.test(line)) continue;
    if (line === 'end') {
      if (layerStack.length > 1) layerStack.pop();
      continue;
    }

    // Subgraph
    const subMatch = line.match(/^subgraph\s+(\S+?)(?:\["(.+?)"\])?$/i);
    if (subMatch) {
      const layer = {
        label: subMatch[2] || subMatch[1],
        color: colors[colorIdx++ % colors.length],
        nodes: [],
        sublayers: [],
      };
      const parent = layerStack[layerStack.length - 1];
      if (parent.sublayers) {
        parent.sublayers.push(layer);
      }
      layerStack.push(layer);
      continue;
    }

    // Direction inside subgraph
    if (/^direction\s+(LR|RL|TD|TB|BT)$/i.test(line)) {
      const dir = line.split(/\s+/)[1].toUpperCase();
      const current = layerStack[layerStack.length - 1];
      current.direction = (dir === 'LR' || dir === 'RL') ? 'row' : 'column';
      continue;
    }

    // Style lines — skip
    if (/^style\s/i.test(line) || /^classDef\s/i.test(line) || /^class\s/i.test(line)) continue;

    // Edges: A --> B, A -->|label| B, A --> B --> C
    const edgeParts = line.split(/\s*(-->|==>|-.->|---)\s*/);
    if (edgeParts.length >= 3) {
      // Parse nodes from edge chain
      const parsedNodes = [];
      for (let i = 0; i < edgeParts.length; i += 2) {
        let part = edgeParts[i].trim();
        // Handle label on arrow: |"label"| prefix or suffix
        const labelMatch = part.match(/^\|"?(.+?)"?\|\s*(.+)$/);
        if (labelMatch) part = labelMatch[2];

        const node = parseNode(part);
        if (node) {
          parsedNodes.push(node);
          if (!nodeMap.has(node.id)) {
            nodeMap.set(node.id, node);
            const current = layerStack[layerStack.length - 1];
            current.nodes.push(node);
          }
        }
      }

      // Extract edge labels
      for (let i = 0; i < edgeParts.length - 2; i += 2) {
        const arrow = edgeParts[i + 1];
        const fromNode = parseNode(edgeParts[i].trim());
        let toRaw = edgeParts[i + 2].trim();
        let edgeLabel = undefined;

        // Check for |label| pattern
        const lblMatch = toRaw.match(/^\|"?(.+?)"?\|\s*(.+)$/);
        if (lblMatch) {
          edgeLabel = lblMatch[1];
          toRaw = lblMatch[2];
        }

        const toNode = parseNode(toRaw);
        if (fromNode && toNode) {
          spec.edges.push({ from: fromNode.id, to: toNode.id, label: edgeLabel });
        }
      }
      continue;
    }

    // Standalone node definition
    const node = parseNode(line);
    if (node && !nodeMap.has(node.id)) {
      nodeMap.set(node.id, node);
      const current = layerStack[layerStack.length - 1];
      current.nodes.push(node);
    }
  }

  // Promote root-level nodes into a single layer if not in any subgraph
  const rootCtx = layerStack[0];
  if (rootCtx.nodes.length > 0) {
    spec.layers.unshift({
      label: '',
      color: '#7aa2f7',
      nodes: rootCtx.nodes,
    });
  }

  return spec;
}

function parseNode(raw) {
  if (!raw) return null;
  raw = raw.trim().replace(/;$/, '');
  if (!raw) return null;

  // id + optional shaped label. Label text may be quoted ["text"] or bare [text].
  const m = raw.match(/^(\w[\w-]*)(.*)$/);
  if (!m) return null;
  const id = m[1];
  const rest = m[2].trim();

  let text = id;
  if (rest) {
    // Strip one layer of shape delimiters; double-bracket shapes first so
    // [[..]] / [(..)] / ((..)) are not mis-matched by the single forms.
    const shapes = [
      /^\[\[(.*)\]\]$/, /^\[\((.*)\)\]$/, /^\(\((.*)\)\)$/,
      /^\[(.*)\]$/, /^\((.*)\)$/, /^\{(.*)\}$/,
    ];
    let inner = null;
    for (const re of shapes) {
      const mm = rest.match(re);
      if (mm) { inner = mm[1]; break; }
    }
    if (inner === null) {
      return /^\w[\w-]*$/.test(raw) ? { id, title: id } : null;
    }
    inner = inner.trim().replace(/^"([\s\S]*)"$/, '$1');  // drop optional quotes
    text = inner || id;
  }

  // Split on <br/> or \n
  const parts = text.split(/<br\s*\/?>/i);
  return {
    id,
    title: parts[0].trim(),
    subtitle: parts.length > 1 ? parts.slice(1).join(' ').trim() : undefined,
  };
}

// ── Mermaid → Graph Spec Parser (flat nodes + edges + clusters, for dagre) ──
// Reuses parseNode; where mermaidToLayoutSpec nests nodes into stacked layers,
// this flattens them and tags each with its subgraph so graph.js (dagre) ranks
// by topology. Subgraphs become single-level clusters; a node in a nested
// subgraph is tagged with its innermost group.

function mermaidToGraphSpec(mermaidCode, options = {}) {
  const lines = mermaidCode.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%'));
  if (!/^(graph|flowchart)\s/i.test(lines[0] || '')) {
    throw new Error(
      '--to-graph/--dagre support flowchart/graph syntax only; '
      + 'use --svg (beautiful-mermaid) for sequence/state/class/er diagrams');
  }

  const dirMatch = (lines[0] || '').match(/^(graph|flowchart)\s+(TD|TB|LR|RL|BT)/i);
  const direction = dirMatch ? dirMatch[2].toUpperCase().replace('TD', 'TB') : 'TB';
  const spec = { theme: options.theme || 'tokyo-night', direction, nodes: [], groups: [], edges: [] };
  const colors = ['#7aa2f7', '#bb9af7', '#f7768e', '#9ece6a', '#e0af68', '#73daca', '#7dcfff', '#ff007c'];
  let colorIdx = 0;
  const nodeMap = new Map();
  const groupStack = [];

  const addNode = (n) => {
    if (!n || nodeMap.has(n.id)) return;
    const node = { id: n.id, title: n.title, subtitle: n.subtitle };
    const group = groupStack[groupStack.length - 1];
    if (group) node.group = group;
    nodeMap.set(n.id, node);
    spec.nodes.push(node);
  };

  for (const line of lines) {
    if (/^(graph|flowchart)\s/i.test(line)) continue;
    if (line === 'end') { if (groupStack.length) groupStack.pop(); continue; }

    const subMatch = line.match(/^subgraph\s+(\S+?)(?:\["(.+?)"\])?$/i);
    if (subMatch) {
      const id = subMatch[1];
      spec.groups.push({ id, label: subMatch[2] || subMatch[1], color: colors[colorIdx++ % colors.length] });
      groupStack.push(id);
      continue;
    }
    if (/^direction\s/i.test(line)) continue;   // dagre uses one global rankdir
    if (/^style\s/i.test(line) || /^classDef\s/i.test(line) || /^class\s/i.test(line)) continue;

    const edgeParts = line.split(/\s*(-->|==>|-.->|---)\s*/);
    if (edgeParts.length >= 3) {
      for (let i = 0; i < edgeParts.length; i += 2) {
        let part = edgeParts[i].trim();
        const labelMatch = part.match(/^\|"?(.+?)"?\|\s*(.+)$/);
        if (labelMatch) part = labelMatch[2];
        addNode(parseNode(part));
      }
      for (let i = 0; i < edgeParts.length - 2; i += 2) {
        const fromNode = parseNode(edgeParts[i].trim());
        let toRaw = edgeParts[i + 2].trim();
        let edgeLabel;
        const lblMatch = toRaw.match(/^\|"?(.+?)"?\|\s*(.+)$/);
        if (lblMatch) { edgeLabel = lblMatch[1]; toRaw = lblMatch[2]; }
        const toNode = parseNode(toRaw);
        if (fromNode && toNode) spec.edges.push({ from: fromNode.id, to: toNode.id, label: edgeLabel });
      }
      continue;
    }

    addNode(parseNode(line));
  }

  // Drop clusters that ended up with no members so dagre has no dangling parent.
  const used = new Set(spec.nodes.filter(n => n.group).map(n => n.group));
  spec.groups = spec.groups.filter(g => used.has(g.id));
  return spec;
}

// ── CLI ──

function parseArgs(args) {
  const options = {
    inputFile: null,
    inline: null,
    useAscii: false,
    outputSvg: false,
    useLayout: false,
    useDagre: false,
    toJson: false,
    toGraph: false,
    theme: null,
    bg: null,
    fg: null,
    padding: 5,
    width: 680,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--ascii') options.useAscii = true;
    else if (arg === '--svg') options.outputSvg = true;
    else if (arg === '--layout') options.useLayout = true;
    else if (arg === '--dagre') options.useDagre = true;
    else if (arg === '--to-json') options.toJson = true;
    else if (arg === '--to-graph') options.toGraph = true;
    else if (arg === '--theme' && args[i + 1]) options.theme = args[++i];
    else if (arg === '--bg' && args[i + 1]) options.bg = args[++i];
    else if (arg === '--fg' && args[i + 1]) options.fg = args[++i];
    else if (arg === '--padding' && args[i + 1]) options.padding = parseInt(args[++i], 10);
    else if (arg === '--width' && args[i + 1]) options.width = parseInt(args[++i], 10);
    else if (arg === '--inline' && args[i + 1]) options.inline = args[++i];
    else if (!arg.startsWith('-')) options.inputFile = arg;
  }

  return options;
}

function showHelp() {
  console.log(`
Mermaid to ASCII/SVG Converter

Usage:
  node convert.js <input-file> [options]
  node convert.js --inline "code" [options]
  echo "graph TD; A-->B" | node convert.js [options]

Output Modes:
  (default)     Unicode ASCII text
  --ascii       Pure ASCII (+-|) text
  --svg         SVG via beautiful-mermaid (auto layout)
  --layout      SVG via layered layout engine (stacked layers)
  --dagre       SVG via dagre graph engine (topology, no extra install)
  --to-json     Convert Mermaid to layered layout JSON (for editing)
  --to-graph    Convert Mermaid to dagre graph JSON (for editing)

Layout Options (--layout / --to-json):
  --width <n>   Canvas width (default: 680)
  --theme <name> Theme: tokyo-night, dracula, nord

Graph Options (--dagre / --to-graph):
  --theme <name> Theme: tokyo-night, dracula, nord

SVG Options (--svg):
  --theme <name> Built-in theme
  --bg <color>  Background color
  --fg <color>  Foreground color

Examples:
  # ASCII output
  node convert.js diagram.mmd

  # SVG with auto layout (beautiful-mermaid)
  node convert.js diagram.mmd --svg --theme tokyo-night

  # SVG with layered layout engine
  node convert.js diagram.mmd --layout --theme tokyo-night

  # SVG with dagre graph engine (topology layout, no extra install)
  node convert.js diagram.mmd --dagre --theme tokyo-night

  # Export to JSON, edit, then render
  node convert.js diagram.mmd --to-json > diagram.json
  # edit diagram.json...
  node layout.js diagram.json -o diagram.svg

  # Export a graph spec, edit, then render via dagre
  node convert.js diagram.mmd --to-graph > graph.json
  # edit graph.json...
  node graph.js graph.json -o diagram.svg

  # Inline with layout engine
  node convert.js --inline "graph TD; A-->B-->C" --layout
`);
}

async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  let mermaidCode = '';

  if (options.inline) {
    mermaidCode = options.inline;
  } else if (options.inputFile) {
    const filePath = path.resolve(options.inputFile);
    if (!fs.existsSync(filePath)) {
      console.error(`Error: File not found: ${filePath}`);
      process.exit(1);
    }
    mermaidCode = fs.readFileSync(filePath, 'utf8').trim();
  } else {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    mermaidCode = Buffer.concat(chunks).toString('utf8').trim();
  }

  if (!mermaidCode) {
    console.error('Error: No Mermaid code provided');
    console.error('Use --help for usage information');
    process.exit(1);
  }

  try {
    if (options.toJson) {
      // Mermaid → JSON
      const spec = mermaidToLayoutSpec(mermaidCode, {
        theme: options.theme || 'tokyo-night',
        width: options.width,
      });
      console.log(JSON.stringify(spec, null, 2));

    } else if (options.useLayout) {
      // Mermaid → JSON → layout engine → SVG
      const spec = mermaidToLayoutSpec(mermaidCode, {
        theme: options.theme || 'tokyo-night',
        width: options.width,
      });
      const { computeLayout, renderSVG } = await import(path.join(__dirname, 'layout.js'));
      const layout = computeLayout(spec);
      const svg = renderSVG(spec, layout);
      console.log(svg);

    } else if (options.toGraph) {
      // Mermaid → graph spec (flat nodes+edges+clusters, for dagre)
      const spec = mermaidToGraphSpec(mermaidCode, { theme: options.theme || 'tokyo-night' });
      console.log(JSON.stringify(spec, null, 2));

    } else if (options.useDagre) {
      // Mermaid → graph spec → dagre engine → SVG
      const spec = mermaidToGraphSpec(mermaidCode, { theme: options.theme || 'tokyo-night' });
      const { computeGraphLayout, renderGraphSVG } = await import(path.join(__dirname, 'graph.js'));
      const layout = computeGraphLayout(spec);
      console.log(renderGraphSVG(spec, layout));

    } else if (options.outputSvg) {
      // SVG via beautiful-mermaid
      const lib = await loadBeautifulMermaid();
      let svgOptions = {};
      if (options.theme && lib.THEMES && lib.THEMES[options.theme]) {
        svgOptions = { ...lib.THEMES[options.theme] };
      }
      if (options.bg) svgOptions.bg = options.bg;
      if (options.fg) svgOptions.fg = options.fg;
      const svg = await lib.renderMermaid(mermaidCode, svgOptions);
      console.log(svg);

    } else {
      // ASCII output
      const lib = await loadBeautifulMermaid();
      const asciiOptions = {
        useAscii: options.useAscii,
        paddingX: options.padding,
        paddingY: options.padding,
      };
      const ascii = lib.renderMermaidAscii(mermaidCode, asciiOptions);
      console.log(ascii);
    }
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

main();
