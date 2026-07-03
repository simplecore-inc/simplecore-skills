# Vendored dependencies

Third-party code committed to the repository so the skill runs with zero install
(the Claude Code plugin installer copies files but runs no package manager).

## dagre.esm.js

- Source: `@dagrejs/dagre` (npm), `dist/dagre.esm.js`
- Version: 3.0.0
- License: MIT — full notice in `dagre.esm.js.LEGAL.txt`
- Used by: `../graph.js` (directed-graph auto-layout backend)

Self-contained ESM bundle (includes graphlib); no runtime dependencies. Update by
reinstalling the package and copying the new `dist/dagre.esm.js` plus its
`.LEGAL.txt` over the files here:

```bash
npm install @dagrejs/dagre
cp node_modules/@dagrejs/dagre/dist/dagre.esm.js       ./dagre.esm.js
cp node_modules/@dagrejs/dagre/dist/dagre.esm.js.LEGAL.txt ./dagre.esm.js.LEGAL.txt
```
