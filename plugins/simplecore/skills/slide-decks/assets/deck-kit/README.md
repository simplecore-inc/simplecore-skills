# Deck kit

Two starting kits, one per deck kind. Copy the one you need into the project as the deck
directory, then set the few constants that name the project:

**The copy is the only time these `.sgx` and `.xml` files are written as files.** Copy the
directory (`cp -R <kit> <deck>`), never a deck file by name, or the project's write guard
refuses it; then register the deck's MCP server, declare it under the deck's `mcp` key, and
make every change after that through the server. The deck also needs its own
`slideglance.json` - `build` for the fonts and build options, `project` for the instruction
files, the rules and the check commands the server runs.

| Kind | Copy to | Set in `build.ts` | Add |
| --- | --- | --- | --- |
| `document/` | `<deck>/` | `PARTS` (the part colours), `MASTHEAD`, `PROJECT_LINES`, `CLIENT`, `FONT_FILES`, the manuscript and figure directories | `assets/brand/*.png`, `fonts/`, `chapters/` |
| `slides/` | `<deck>/` | the same, plus `SCREEN_BOXES` and `FIGURE_PLACEMENT` if the page geometry changes | `assets/brand/*.png` (landscape crops), `assets/screens/`, `fonts/`, `chapters/`, `diagrams/` |

Both kits generate `templates/parts.xml`, `templates/master.xml` and `templates/figures.xml`
(the slide kit also `templates/screens.xml`) at build time; never commit or edit those.
`gitignore` is the `.gitignore` to install (`node_modules/`, `out/`).

The slide kit's `tools/` are the checks the skill's `references/checks.md` describes;
`deckconfig.py` reads `.claude/slide-decks.json` for the plan file and the referenced
document deck, so copy `../slide-decks.json` to the project's `.claude/` and fill it in.
`tools/diagrams/common.py` expects the document deck's figure toolkit at
`<root>/tools/diagrams/common.py` (the `simplecore:svg-diagrams` skill's
`assets/document-figures/`) and adds the slide boards on top of it.

A document deck's manuscript checks (parity, numbering, echo, rhythm …) are written
against that manuscript's conventions and are not in the kit; the `checks.md` reference
says what each has to catch.
