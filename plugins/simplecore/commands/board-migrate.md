---
description: Migrate an existing wireframe board to the current board contract — permanent frame ids and a no-sideways-scroll layout
argument-hint: "[board directory]"
---

# Migrate a wireframe board

Bring a board built against an older contract up to the current one. The board keeps its frames,
its content, and its flows; what changes is how frames are numbered and how they are laid out.

Invoke `simplecore:wireframe-boards` first and follow it. **Nothing here is written without the
user agreeing to it**, and two of the steps are decisions only they can make.

## 1. Read what the board is on

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/detect-simplecore.mjs" --json
```

Pass `--root=<path>` when `$ARGUMENTS` names a directory other than the current one.

- `needsMigration: false` → say the board is already on contract `boardContractExpected` and stop.
- `board: null` → there is no board to migrate. Offer `/simplecore:board-init` instead.
- `board.stamped: false` → the board predates stamping. Treat it as contract 1 and continue.

## 2. Measure the drift before proposing anything

The migration's cost is not the code change; it is that **frame numbers people have written down
may move**. Measure it and put the number in front of the user. For a kit-built board:

```bash
node --input-type=module -e '
const m = (await import("./src/manifest.mjs")).default;
let total = 0; const drift = [];
for (const sec of m) sec.screens.forEach((sc, i) => {
  total++;
  const shows = `${sec.letter}-${String(i + 1).padStart(2, "0")}`;
  const mm = /^([a-z])-(\d{2,}[a-z]?)-/.exec(sc.file);
  const fileId = mm ? `${mm[1].toUpperCase()}-${mm[2]}` : null;
  if (fileId !== shows) drift.push({ shows, fileId, file: sc.file });
});
console.log(`${drift.length} of ${total} screens display a number that differs from their file name`);
for (const d of drift) console.log(`  board shows ${d.shows}  file says ${d.fileId}  ${d.file}`);
'
```

Also list what would block the new build outright:

- **duplicate ids** — two screens whose file names start with the same `<letter>-<nn>`
- **file names carrying no id** — anything not matching `<letter>-<nn>[a-z]-<slug>`
- **a responsive pair authored as two ids** — a `-narrow` and a `-wide` file on different numbers

## 3. Ask which numbering becomes permanent — the one decision that matters

Both answers are defensible and they cost different people different things. Present both with the
measured numbers, and let the user choose:

| | What it means | What it costs |
| --- | --- | --- |
| **Keep the file-name ids** | `c-01a-product-detail` becomes `C-01a` | no files move, but every drifted frame's *displayed* number changes, so numbers already circulated in tickets, plans, and review notes point at the wrong frame |
| **Freeze what the board displays today** | the frame showing `C-17` keeps `C-17`, and its file is renamed to `c-17-…` | every number anyone has seen stays correct, but the drifted files are renamed and their `{{slug}}` references rewritten |

Say plainly which one preserves outside references — usually the second, when the board has been
reviewed by anyone — and recommend it in that case. Neither is reversible cheaply once the board
is rebuilt and re-circulated, so do not choose for the user.

## 4. Ask about each blocker found in step 2

One question per group, with the file names and what each screen draws:

- **A duplicate id**: which screen keeps the number, and what the other becomes. Prefer giving the
  new number to the screen that is *less* likely to have been referenced (added later, a variant,
  a dialog), and prefer a suffixed neighbour (`D-05a`) over a number from the end of the section.
- **A pair on two ids**: confirm they are one responsive screen, then collapse them onto the lower
  id with `variant: 'narrow'` / `'wide'`. The freed id is NOT reused — a gap costs nothing and
  reusing a number breaks the reference that pointed at it.

## 5. Apply it

The board's kit is usually a *fork* — the project has added its own chrome, screens, and scripts —
so patch the fork rather than copying the plugin's kit over it. Compare against
`${CLAUDE_PLUGIN_ROOT}/skills/wireframe-boards/assets/build-kit/` and carry over exactly these:

1. **`build.mjs`** — derive each screen's id from its file name; refuse to build on a missing id,
   a section-letter mismatch, or a duplicate that is not one screen's two viewport halves; assign
   the bracketed position per *screen* (a pair counts once); anchor from the id; resolve `{{slug}}`
   references to ids.
2. **`src/partials.mjs`** — `frame(s, id, seq, file, anchor)` renders `[02]A-20`; the sidebar shows
   one entry per screen; `page()` stamps `<meta name="wireframe-board-contract">`.
3. **`src/styles.css`** — `.row` wraps with `max-width: var(--row-max)` instead of scrolling
   sideways; the `--frame-zoom` steps; `.scroll-x` keeps the permanent scrollbar; `.fseq` and the
   sidebar `.seq`. **Re-derive the zoom breakpoints** when the fork's sidebar width or body padding
   differs from the kit's — they are computed from the width a row needs, not copied.
4. **`src/intro.html`** — the reading-contract item that explains the id and the position, so a
   reader who opens the board knows which number to quote.
5. **File renames**, when step 3 chose to freeze the displayed numbers: rename the screen file,
   update its `manifest.mjs` entry, and rewrite every `{{old-slug}}` reference across `src/`.

Keep every other local customization untouched. Do not reformat files you are only patching.

## 6. Verify, and prove the numbers held

1. `node build.mjs` — it must build. A refusal names the id problem; fix that, do not weaken the check.
2. **Re-run the drift measurement**: it must now report zero, because the id and the displayed
   number are the same value.
3. **Confirm the promise in a browser** at a wide window and at a laptop width: nothing scrolls
   sideways, neither the page nor any row; a phone row holds three frames per line; the labels read
   `[position] ID route — screen — state`.
4. `node build.mjs --release`, then check the stamp landed:
   `grep -o 'wireframe-board-contract[^>]*' board.html`
5. Re-run the detector — `needsMigration` must be false.

## 7. Report

- which numbering was chosen, and how many frames' displayed numbers changed as a result
- every id that was reassigned, old → new, so the user can update what they have circulated
- every pair collapsed, and which id was freed and left unused
- what the verification showed

Do not commit. Report; the user commits.
