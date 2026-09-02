# Project figure scaffold

Copy these four files into the project — conventionally `tools/diagrams/` — so
the drawing code is versioned with the document it illustrates. **Do not author
figures in a scratch directory:** a figure is regenerated whenever its chapter
changes, and code that lives outside the repository cannot be rerun by the next
person or by CI.

```
tools/diagrams/
  common.py           shared width, type scale, output path, toolkit resolution
  build.py            regenerate every figure module
  verify.py           width · type scale · lint · height review
  <chapter>.py        one module per chapter or per topic
docs/assets/diagrams/ generated SVGs — build artifacts, but committed so the
                      document renders without running the build
```

## Wiring it up

1. Copy `common.py`, `build.py`, `verify.py` and rename `figures_example.py` to
   something meaningful (`ch01.py`, `architecture.py`).
2. Set the four constants at the top of `common.py`: `OUT`, `STANDARD_WIDTH`,
   `FONT_SCALE`, `THEME`.
3. Add two lines to the project's instruction file (`AGENTS.md`, `CLAUDE.md`):
   figures are generated through `tools/diagrams/common.py`, and
   `python3 tools/diagrams/verify.py` runs after any figure change.

## Working on a figure

```bash
python3 tools/diagrams/build.py ch01        # regenerate one module
python3 tools/diagrams/verify.py            # width · type scale · lint
python3 tools/diagrams/verify.py --render /tmp/figs   # PNGs to read
```

Edit the module, never the SVG. A hand-edited SVG is overwritten by the next
build, and the edit is lost without a trace.

The sizing discipline these files enforce — one width, one type scale, height
economy, composition variety — is in `references/document-figures.md`.
