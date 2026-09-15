# What the project declares - `.claude/slide-decks.json`

**This skill carries the discipline, not the contents.** Every path, command, board and
check it needs is a project's own choice, and the project declares all of them in
`.claude/slide-decks.json` at its root. Copy `assets/slide-decks.json` and fill it in.

**Read that file first, on every invocation.** It costs one read, and a page typeset
against a guessed path is a page nobody can rebuild.

**Edit it as text, never through a JSON encoder.** The file carries `//` notes above the
keys they explain and a per-key layout; a `load`/`dump` round-trip drops both silently.
Insert and replace by string, then parse (comments stripped) only to check it is valid.

**A required key that is absent is an error the skill reports - never a path it guesses.**
Name the key, say what it names and what it buys, and offer to fill it in. A declared path
that does not exist is the same error. The check scripts shipped in the kit
(`deckconfig.py`) refuse the same way.

## Shape

```jsonc
{
  "decks": {
    "<name>": {
      "dir": "pptx",                        // the deck directory (main.sgx, build.ts, chapters/)
      "kind": "document",                   // "document" (A4 portrait) or "slides" (landscape)
      "mcp": "slideglance-proposal",        // the MCP server that owns this deck: mcp__slideglance-proposal__*
      "page": { "w": 794, "h": 1123, "textBlock": 682 },
      // The sizes this deck is set at, in points. `floor` is the absolute
      // minimum any reader-facing string may print at; `body` and `heading`
      // are what a projected deck is set for and what its type-floor check
      // holds prose to; `codeLabel` is the one class allowed at the floor.
      "type": { "floor": 8, "body": 8.25, "heading": 9.75, "codeLabel": 8 },
      // What the tender calls the annex, so the deck writes its word
      "annex": { "term": "별첨" },
      "manuscript": "proposal",             // document deck: the prose the pages are set from
      "plan": "docs/plan.md",               // slide deck: the plan, one section per slide
      // A volume that reproduces an issued document: the PDF it carries. Its
      // body pages are generated from this file, one source page per deck
      // page, and the deck typesets nothing from them.
      "sourceDocument": "docs/reference/evidence.pdf",
      "references": { "deck": "proposal" }, // slide deck: the document deck its head cites
      "instructions": ["pptx/AGENTS.md", "pptx/README.md"],
      "render": "cd pptx && npm run render",
      "output": "pptx/out/deck.pptx",
      "previews": "pptx/out/png",
      // what this deck is in the submission, and the share of the preview
      // resolution its PDF pages are written at (1.0 for scanned evidence)
      "deliverable": { "label": "비계량", "pdfScale": 1.0 },
      "screens": "slides/assets/screens",   // slide deck: captures placed as figures
      "figures": {
        "sources": ["proposal/diagrams"],   // every directory whose SVGs the build may place
        "generator": "tools/diagrams",      // the modules that draw this deck's own figures
        "verify": "python3 tools/diagrams/verify.py",
        "boards": { "1200": 682, "520": 300, "520-pair": 327 }   // units -> placed px
      },
      "checks": {
        "dir": "tools/deck",
        // Only what the SlideGlance MCP's layout_check and rules_check do not judge.
        "preflight": ["typefloor"],         // run by the build; a failure stops it
        "after": ["rowheight"],             // run after every render
        // slide decks add census and density, with their own keys:
        "census": { "sequences": ["process-strip", "flow-row", "stage-strip", "flow-down"],
                    "sequenceRows": ["step-row", "ladder-step", "stage-detail"], "maxShare": 0.34 },
        "density": { "maxChars": 1300, "maxShapes": 24 },
        // The judgement pair: the two hexes, the shapes that may carry them and
        // which slot of each holds the block and the pass label, and the words
        // each slot may print. A pair that is neither takes a neutral twin.
        "verdict": {
          "block": "B6382B",
          "pass": "507C39",
          "templates": {
            "trigger-card": { "blockAttr": "aLabel", "passAttr": "bLabel" },
            "verdict-row": { "blockAttr": "endLabel", "passAttr": "midLabel" }
          },
          "blockWords": ["차단", "오류", "통제", "제한", "보류", "반려", "실패", "위반", "누락"],
          "passWords": ["통과", "허용", "처리", "보존", "적합", "충족", "완료", "승인", "정상"]
        },
        // Every hex a hand-written source may write, and the one file that
        // carries the deck's third system. A deck that sanctions no judgement
        // pair declares this instead of `verdict`: the check then reports the
        // pair the moment a component grows one back.
        "palette": {
          "scan": ["templates/components.xml", "templates/page.xml", "chapters/*.xml"],
          "allowed": ["14161C", "6B7280", "1B4A9C", "EEF2FA", "FFFFFF", "F5F6F8"],
          "lane": { "file": "styles/typography.xml", "colors": ["087EA4", "EAF6F8"] }
        }
      },
      "korean": { "audit": ["pptx/chapters/*.xml"] },
      "review": { "prompt": "docs/persona-review.md", "records": "docs/reviews/persona" }
    }
  },
  // The submission the decks make together: one folder, one copy per reader,
  // every volume named `<title>(<copy>_<label>)` under `<dir>/<copy>/pptx` and
  // `<dir>/<copy>/pdf`. A copy lists the decks it carries; `identity` is what
  // the copies print differently, filled into every `{{identity.<field>}}`
  // a source carries by `build.ts --copy <name>` (the first copy declared
  // that names no proposer is the default the checks read).
  "submission": {
    "dir": "제출물",
    "title": "<사업명>_제안서",
    "date": "2026년 9월 15일",         // every cover's {{submission.date}}
    "pdfLimitMB": { "file": 50, "total": 180 },   // ceilings the delivery script measures the folder against
    "pdf": { "engine": "slideglance", "imageDpi": 150, "jpegQuality": 88 },  // text-mode SVG → PDF, pictures resampled
    "copies": {
      "원본":   { "volumes": ["quantitative", "proposal", "presentation"] },
      "평가본": { "volumes": ["proposal", "presentation"] }
    },
    "identity": {
      "원본":   { "name": "<제안사 상호>", "label": "제안사", "logo": "docs/reference/logo.svg" },
      "평가본": { "name": "\u00a0", "label": "\u00a0" }   // the blind copy prints nothing there - a no-break space, since the builder refuses an empty <Text>; no logo
    }
  }
}
```

## Keys

| Key | Names | What its absence costs |
| --- | --- | --- |
| `dir` | the deck directory | required - nothing else resolves without it |
| `kind` | `document` (A4 portrait, prose pages, part dividers, a manuscript) or `slides` (landscape, one plan section per slide, speaker notes) | required - the page shell, the layouts and the fill rule differ by kind |
| `mcp` | the MCP server that owns this deck, so its tools are `mcp__<name>__*` and the deck is reached rather than guessed at. It is the server `.mcp.json` registers on this deck's `main.sgx`; the desktop app's connection replaces it while the app holds the deck open, and then `deck` names the deck on every call | required wherever a deck is edited - three decks and three servers is three chances to write the wrong one, and the only report is the picture |
| `page` | page size in CSS px at 96 dpi and the text-block width | required - every width in the layout templates is derived from it |
| `type.floor` · `body` · `heading` · `codeLabel` | the sizes in points: the absolute floor, the body and region heading a projected deck is set for, and the code-label class held at the floor. Units are CSS pixels and the builder writes points as units × 0.75, so 8pt is 10.67 units | the floor becomes a number in the skill rather than a judgement about one deck's room, and the type-floor check has nothing to hold prose to |
| `annex.term` | the word the tender uses for the annex (`별첨` · `부록` · `첨부`), so the deck answers in the panel's own word | the deck names the annex whatever the author happened to type, and the references check has no word to read against |
| `manuscript` | the directory of page-files a document deck is set from | a document deck without it cannot run parity or coverage against its prose; report it |
| `plan` | the plan file a slide deck is set from - one section per slide with what the slide shows, what it answers and its script | a slide deck without it cannot check coverage; report it |
| `references.deck` | the document deck a slide deck cites in its running head; `refPages` is computed from that deck's import order | the head's page reference cannot be computed and stays ` - ` |
| `references.evalAliases` | optional; evaluation item name → the title of the document-deck chapter that scores it, for an item the slide deck names in its own words (`{"사업의 이해": "사업이해도"}`) | the citation check matches item and chapter by name alone |
| `instructions` | the deck's own working rules and file map, read in full before the first edit | the deck contract (palette values, head fields, folio rules) is unknown; report it |
| `render` · `output` · `previews` | the render command, the built file, the preview PNG directory | required - the loop cannot run |
| `renderer.command` · `minVersion` | the CLI that draws the previews and the version the deck is measured against | the builder is pinned and the renderer is not, so the previews, the PDF made from them and every check that reads an image are drawn by a tool nobody declared; a deck ran three minor versions behind for months that way |
| `deliverable.label` · `pdfScale` | what this deck is called inside the submission's file name, and - for the `--raster` route only - the share of the 144 dpi preview its pages are written at | the deck cannot be named in the submission folder; the render is the last step |
| `submission.pdf.engine` · `imageDpi` · `jpegQuality` | how the deliverable PDF is made. `slideglance` draws each slide as text-mode SVG (`convert --text`; a figure embedded as an SVG picture is inlined so it stays vector and its labels stay text), `rsvg-convert` binds the pages with the faces from the deck's `fonts/` embedded, and every embedded picture is resampled to `imageDpi` where it is placed and re-encoded at `jpegQuality` - the document keeps its quality and the pictures pay for the size. `powerpoint` exports through Microsoft PowerPoint on macOS instead. Either way the script refuses to fall back to a picture-per-page PDF on its own (`--raster` is explicit) | the delivery script cannot make a PDF the panel can search, and stops |
| `submission.dir` · `title` · `date` · `pdfLimitMB` · `copies` · `identity` | the one folder every deliverable is built into, the file title, the day the submission goes in (every cover prints `{{submission.date}}`, so one value moves every volume), which decks each copy carries, the ceilings every PDF and all of them together may not pass (the delivery script measures the folder after every run and fails past either), and the proposer identity each copy prints - printed fields are tokens, and `logo` is a file the build rasterises onto the foot of every content page of the copy that declares it. A tender that scores blind takes two copies - an original that names the proposer and an evaluation copy that does not - and the company-identifying evidence volume belongs to the original only. `tools/deck/deliver.py` builds every copy of every volume; a chapter writes `{{identity.<field>}}` where the copies differ and `build.ts --copy <name>` fills it. An identity field left empty fails the build for every copy but the blind one, where the blank is the point: a blank where the proposer's name belongs is not an original | one deck is delivered at a time, by hand, under a name nobody declared - and the blind copy and the original drift apart as two sets of sources |
| `screens` | a slide deck's screen captures; the build fits each into the boxes the layouts define | screen-only slides cannot be set |
| `figures.sources` | every directory whose SVGs the build turns into figure templates - a slide deck lists the document deck's figures first, its own second | no figure templates; a page cannot place a figure |
| `figures.generator` | the modules that draw this deck's own figures (a slide deck's extends the document deck's toolkit) | a figure cannot be redrawn; the SVGs go stale silently |
| `figures.verify` | the figure checks | figures are placed unverified |
| `figures.upstream` | the document deck's figure directory a slide deck snapshots from; `figures.sources` then names only directories the slide deck owns | which document a slide deck summarises is the project's arrangement, and the snapshot tool refuses to guess where to sync from |
| `figures.boards` (· `figures.scale`) | drawing-unit board width → placed px. A document deck, whose boards differ little, may add `-<variant>` entries for a board's second placement; a slide deck declares one `scale` and no variants, so a label drawn at 15 units is the same size on every slide | the build cannot place a figure; report the board it met |
| `checks.dir` · `checks.preflight` · `checks.after` | where the check scripts live, which the build runs before compiling, which run after a render | a check nobody runs is a defect nobody finds; the pre-flight lists what is missing |
| `checks.census.sequences` · `sequenceRows` · `maxShare` | the sequence shapes a slide deck uses - containers that hold a whole sequence, shapes that stand once per item - and the share of body slides one may stand on | the shapes are the deck's own templates; the skill cannot name them |
| `checks.density.maxChars` · `maxShapes` (· `skipAttrs` · `layoutPrefixes` · `itemTemplates`) | the character and shape ceilings of a body slide, set when the deck's author called a slide too dense; the optional lists widen what is not counted | a ceiling is a judgement about one deck's audience and room, never a constant of the skill |
| `checks.verdict.block` · `pass` · `templates` · `blockWords` · `passWords` | the deck's judgement pair: the two hexes, the shapes allowed to carry them with the slot that holds each side, and the vocabulary each slot may print | which shapes carry a judgement and what a pass is called are the deck's own decisions; the check refuses to guess either |
| `checks.palette.scan` · `allowed` · `lane` | the hand-written sources, every hex they may write, and the one file the deck's third system lives in | an undeclared colour family arrives through a component's fixed slot rather than through anybody's decision, and no page-by-page review sees it: each page shows one of the colours and looks deliberate |
| `checks.census.closers` · `maxCloserShare` | the rows a slide closes a region on, and the share of body slides one of them may stand on | which shapes read as a closing row is the deck's own component vocabulary |
| `checks.colfill.maxGap` · `minFill` · `textBlock` · `layouts` | how far two columns of one page may end apart, how high the shortest column may end on its own (a gap rule alone passes two equally short columns), the text block's edges, and each column layout's column x ranges | the geometry is the deck's page and templates; the skill cannot derive it |
| `korean.audit` | the deck's Korean sources, since a repository-wide sweep reads `.md` and `.svg` only | the deck's Korean is never audited |
| `review.prompt` · `review.records` | the canonical evaluator-persona review prompt and where rounds are recorded | a persona review has no rubric and no place to write; the generic workflow needs both |

Two decks in one repository declare both. A slide deck names the document deck it
summarises under `references.deck`, and lists that deck's `figures.sources` before its own
so a figure corrected in the document reaches the slides on the next build.

## The deck's own declaration - `slideglance.json`

The server reads a second file, `slideglance.json` beside the deck's root document: `build`
holds the build options (fonts, auto-fit, lint level, SVG text mode), and `project` is what
the deck expects of an agent - `instructions`, `rules`, `checks` and `libraries`, served as
`sg://project`. **The two files say different things and must not drift**: this skill's
config names the deck to the project (paths, boards, checks, submission), and
`slideglance.json` names the deck to the server. Where both name one thing - the
instruction files, the rules - one of them points at the other rather than repeating it.

```jsonc
"project": {
  "instructions": ["AGENTS.md", "README.md"],
  "rules": { "file": "rules.json", "path": "decks.proposal" },   // or the rules inline
  "checks": {
    "cwd": ".",
    "list":   "python3 tools/checks.py --list",                  // check_run {}
    "phases": { "preflight": "python3 tools/checks.py --preflight",
                "after":     "python3 tools/checks.py --after" },// check_run {phase}
    "one":    "python3 tools/{name}.py",                         // check_run {name}
    "timeoutMs": 300000
  },
  "libraries": [{ "name": "shared", "path": "../lib/templates" }]
}
```

- **`rules` resolves inside the deck folder.** A reference above it
  (`../.claude/slide-decks.json`) is read by the headless server and refused by the desktop
  app, whose file scope stops at the deck - so `rules_check` passes on one host and fails on
  the other for a deck nobody touched.
- **Declare `list` and `phases`, not only `one`.** With `one` alone the server can run a
  single check at a time, and the group a person runs by hand stops being the group the
  server reaches.
- **`checks.cwd` is inside the deck**, and a command reaches no deck file by name: the
  project's write-guard hook refuses a `python3` line that names a chapter, a read included.
