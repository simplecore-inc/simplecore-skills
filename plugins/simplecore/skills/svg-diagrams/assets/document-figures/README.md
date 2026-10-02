# Wiring a project to the document-figure library

The drawing layer, the build and the checks live in this skill at
`scripts/docfigures/` and are imported, never copied. A project keeps two kinds
of file and nothing else:

```
.claude/document-figures.json   every value this document decides
tools/diagrams/<chapter>.py     one figure module per chapter or topic
docs/assets/diagrams/           generated SVGs, committed so the document
                                renders without running the build
```

## Setting a project up

1. Copy `document-figures.json` from this folder to the project's
   `.claude/document-figures.json` and set its values: the output folder, the
   module glob, the boards and their placement, the type ladder derived from the
   body size, and the vocabularies. The schema is in
   `references/document-figures.md`.
2. Copy `figures_example.py` to the module folder under a chapter name
   (`ch01.py`) and draw from it.
3. Add two lines to the project's instruction file (`AGENTS.md`, `CLAUDE.md`):
   figures are drawn by the modules the config lists, with the svg-diagrams
   library, and the library's `verify.py` runs after any figure change.

## Working on a figure

Run from the project, with `<skill>` the svg-diagrams skill directory:

```bash
python3 <skill>/scripts/docfigures/build.py ch01            # regenerate one module
python3 <skill>/scripts/docfigures/verify.py                # every check
python3 <skill>/scripts/docfigures/verify.py --render /tmp/figs   # PNGs to read
python3 <skill>/scripts/docfigures/figplans.py              # plans against figures
```

Edit the module, never the SVG. A hand-edited SVG is overwritten by the next
build, and the edit is lost without a trace.

A file the module glob reaches is not run when it is a test (`test_*.py`), a
helper listed under `helpers`, or named after a library module (`common.py`);
a project that still carries an old copy of `common.py` can delete it.
