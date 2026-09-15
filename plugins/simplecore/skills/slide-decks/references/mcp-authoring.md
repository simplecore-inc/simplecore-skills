# Writing a deck through the SlideGlance MCP

The deck's source belongs to the server. A `.sgx` root and every `.xml` fragment under a
deck directory is read as a file and written only through the MCP - no `Edit`, no `Write`,
no shell redirect, no generator output an agent typed by hand.

**A page the server serves is read from the server, never stored here.** The grammar, the
loops, the handles, the response codes and the schema are `sg://guide` and the `sg://skills`
pages; a copy of any of them in a skill goes stale against the server that enforces it. What
this reference holds is what those pages do not say: which server owns which deck, what a
write costs when it is made against the wrong generation, the handful of edits whose
obvious form silently does nothing, what renders where, and what the project's write guard
refuses.

## What to read, and where it lives

| Read | For |
| --- | --- |
| `sg://guide` | once per session, before the first call: the loops, the handles, the block grammar, what each response code means |
| `sg://skills` (`skill_read`) | the index; then `grammar` before writing markup, `composition` for styles and templates, `layouts` and `recipes` for how a slide is built, `themes` for a palette, `lint` for what the build reports, `schema-gotchas` when markup is refused |
| `sg://schema/{tag}` | the attributes one tag takes |
| `sg://project` · `sg://project/instructions/{file}` | the deck's own declaration and its instruction files - the same files `.claude/slide-decks.json` names under `instructions`, so the two never disagree |
| this skill | the design contract, the page and slide rhythm, the Korean copy standard, and the checks a server cannot judge |

## One server per deck, and the deck is named on every call

The project registers one headless server per deck in `.mcp.json`, and the skill's config
declares which is which (`mcp` in [config.md](config.md)) so an agent looks the tool prefix
up rather than guessing it. Reaching the wrong server edits the wrong deck, and nothing
reports it but the picture.

- **A headless server is a one-deck host, so never `deck_open` another deck through it.**
  It puts the swap to the person, the client cannot answer, the tool times out, and the
  pending ask leaves that server hung for the rest of the session. Call the server that
  owns the deck.
- **The desktop app is the other host and holds several decks at once**, so `deck` names
  the deck on every call there; agents sharing one connection keep their edits apart only
  that way. Its bearer connection is what File → Copy MCP Connection hands over
  (`~/Library/Application Support/com.slideglance.editor/mcp.json` on macOS).
- **Never both hosts on one deck at once.** Two writers on one file is how a generation
  goes stale under an edit that was already correct.
- **The desktop app reads nothing above the deck folder.** A `rules` reference pointing
  out of it (`../.claude/slide-decks.json`) is out of scope there and `rules_check` fails,
  while the headless server reads it. Where both hosts have to judge the rules, the file
  they name lives inside the deck folder.
- **Slice a full-deck `layout_check`.** The server renders at most 40 slides per call for
  `ink` and answers with `continue with slides=41-296`; through the desktop app a
  whole-deck call can drop the connection, so ask for a range at a time.
- **After the app restarts, verify on disk.** Edits that had not been saved are gone, and
  a deck that looks right in the tab is not evidence.

## Read the generation you write against

`sg://guide` has the rule (`node#N` is per build, a `stale` refusal carries
`changes_since`). What it costs in practice is the part worth writing down: **keys renumber
after every `write_slide` and `write_deck`**, so the keys in the last answer are not the
keys for the next write and the slide is re-read between them. A batch of edits written
from one reading lands on whatever the renumbering put at those keys.

**The lines riding on a tool result are addressed to whoever holds the connection** - a
note the person left, where they are now, which slides they edited since the last call.
Read those slides again before writing over them, and answer a note with `note_resolve`
rather than silently.

## The edits whose obvious form does nothing

Each of these applies cleanly, reports success and changes nothing, or changes something
other than what was meant. None is in the server's own pages.

- **`set_texts` on a `<Use>` node answers `items: []` and changes nothing.** A use's
  arguments are strings on the use, not text nodes: `edit_apply setUseArg` with
  `use:<file>#N`.
- **`setNotes` on a slide whose `<Notes>{notes}</Notes>` comes from a page template writes
  into the template**, and every slide of that template then speaks it. Set the page use's
  `notes` argument with `setUseArg` instead.
- **A table cell is a part of the table**, not a node: `setAttr` with `targets: [<table>]`
  and `part: "cell:R.C"`.
- **`replaceDefinitionBody` refuses a template whose body is a `<Slide>`**, so a page
  template is changed through `write_deck`'s file form.
- **`write_definition` without `file` lands the template in the deck's first template
  file** - and where that file is generated, the next build deletes the template without a
  word. Always pass `file`.
- **`insertUse` into a slot container lands beside the columns**, not inside one. A row
  appended to a column is written by rewriting that column's `<Use>` with the row inside
  its slot, since `write_slide` with `scope` replaces exactly one element.
- **A line break inside a `<Use>` argument is the two characters `\n`**, the deck's own
  spelling; a real newline comes back as `&lt;br>` and a line break in the file.
- **A slot's fill is nested markup**: read it with `use_get` before rewriting it.

**`components only` is this skill's template rule, enforced by the server.** A write that
draws a shape or a `<Layer>` on a slide, or gives an element `x`/`y` outside a template
body, is refused with the element named; coordinates go in `write_definition`.

**A refusal that names the person is an answer, not an obstacle.** A locked node, a paused
connection, an edit the person turned down: leave it and say so. And every write carries a
`why`, because the person reads it in the history and on an edit held for review.

## Rendering: the server's pictures and the project's

**A page is still not typeset until a picture of it has been looked at**, and a server
render counts.

| Use | For |
| --- | --- |
| `render_preview` before, `edit_apply render:"thumb"` while applying | did this edit land where it was meant to |
| `render_slide` (`annotate`, `space`, `guides`, `clip`) | which node, where the space went, a rectangle read close up |
| `render_deck` | the sheet - 30 slides at thumb, 12 at review, then the next range |
| the project's `<render>` | the PNG directory every image-reading check measures, and the deliverable |

**The project's render is still the one that has to run before the checks that read
images.** `colfill`, the fill measurement and the deliverable PDF read the PNGs on disk; a
server render writes none of them, and a partial project render leaves the pages it did
not draw exactly as they were. Render the pages while editing, render everything before
the checks and before shipping.

**`deck_export` writes the server's last build** as `.pptx`, pages or a PDF. The
submission does not go out that way: the copies and the identity fields are the project's,
so the delivery script builds them.

## Saving, and the files the server does not own

- **`check_run` and every script and grep read the disk**, so `deck_save` first wherever
  autosave is off. The headless servers run `--autosave`; the desktop app has it as a
  setting; `sg://deck` says `dirty` when neither held.
- **A generated chapter file is the generator's output, not an edit of the deck.** Run the
  generator, then tell the server with `deck_reload` - until then a write is refused with
  `external_change`.
- **`slideglance.json` is the server's while it runs.** Change the build options with
  `build_options_get` · `build_options_set` rather than editing the file under it.
- **A new deck is scaffolded once by copying the kit directory**, and the copy names the
  directory rather than the `.sgx`, or the hook refuses it. Everything after that is the
  server's.

## The checks through the server

`check_run {}` runs the project's `list` command, `{phase}` runs a named group, `{name}`
runs one. **A deck that declares only `one` can run a single check at a time through the
server**, and the list a person runs by hand then drifts from the list the server can
reach - so declare `list` and `phases` in the deck's `slideglance.json` and let both read
the same commands. What each check catches, and what the server judges instead, is in
[checks.md](checks.md).

## The hook, and how to work beside it

A project arms `deny-sgx-writes.mjs` as a `PreToolUse` hook, naming each deck folder. It
refuses the write and lets the read through, but it reads a command line rather than a
program, so two ordinary reads are caught by it.

| Refused | Allowed |
| --- | --- |
| `Edit` · `Write` · `MultiEdit` on a `.sgx` or a deck `.xml` | `Read` on either |
| `python3 … <deck>/chapters/01.xml` - any `python3`/`node`/`ruby`/`php` line naming a deck file, **a read included** | `DECK=<deck>/chapters/01.xml python3 tool.py` |
| `grep -ln … <deck>/chapters/*.xml` - `-ln` matches the `ln` of the link command | `grep -n`, `grep -rl`, `cat`, `sed -n`, `ls` |
| `patch` and `git apply` as the command word - they write whatever the diff names | the word `patch` in an argument (`grep -rn patch docs/`) |
| `cp` · `mv` · `rm` · `tee` · `sed -i` · a redirect onto a deck file | `cd <deck> && npm run render` |

**Pass a deck path to a script through an environment variable or a file**, never on the
command line, and the checks the project runs from inside the deck folder need neither.
