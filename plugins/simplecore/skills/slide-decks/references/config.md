# What the project declares - `.claude/slide-decks.json`

**This skill carries the discipline, not the contents.** Every path, command, board and
check it needs is a project's own choice, and the project declares all of them in
`.claude/slide-decks.json` at its root. Copy `assets/slide-decks.json` and fill it in.

**Read that file first, on every invocation.** It costs one read, and a page typeset
against a guessed path is a page nobody can rebuild.

**Edit it as text, never through a JSON encoder.** The file carries `//` notes above the
keys they explain and a per-key layout; a `load`/`dump` round-trip drops both silently.
Insert and replace by string, then parse (comments stripped) only to check it is valid.

**A required key that is absent is an error the skill reports, never a path it guesses.**
Name the key, say what it names and what it buys, and offer to fill it in. A declared path
that does not exist is the same error. The shared checks (`scripts/check.py` and the checks
it runs, [checks.md](checks.md#the-shared-checks-and-the-runner)) read this file through one
loader and refuse the same way: a missing key exits 2 with the key's name, never 0.

How the deck itself is written in the deck tool is that tool's own authoring guide (for
SlideGlance: the slideglance-pptx skill and the server's sg://guide).

## Shape

```jsonc
{
  "decks": {
    "<name>": {
      "dir": "pptx",                        // the deck directory
      "kind": "document",                   // "document" (A4 portrait) or "slides" (landscape)
      // The deck tool, the skill that teaches its authoring, and the server
      // that owns this deck, so the deck is reached rather than guessed at
      "tool": { "name": "<deck tool>", "skill": "<authoring skill>", "server": "<server name>",
                "entry": "main.sgx",              // the deck's entry file inside `dir`
                "appConnection": null,            // the host app's connection file, when not the tool's default
                "binary": null },                 // the tool binary the checks start when no app holds the deck
      // The kit vocabulary the shared checks read: which components carry a name, a
      // prose block or a caption, and the master names of each page kind
      "vocabulary": "simplecore-proposal-01",
      // How the checks compute page ids and folios, over the vocabulary's defaults
      "pages": { "numerals": ["Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ", "Ⅵ", "Ⅶ", "Ⅷ"], "id": "{part}-{chapter} {ordinal:02}" },
      "page": { "w": 794, "h": 1123, "textBlock": 682 },
      // The sizes this deck is set at, in points. `floor` is what prose is
      // held to: the absolute minimum on a document deck, the body size on a
      // projected one. `heading` is a projected deck's region heading.
      // `codeLabel` is the lower floor a looked-up code value may print at,
      // or null where that class is not measured at all.
      "type": { "floor": 8.25, "heading": 9.75, "codeLabel": 6 },
      // Item numbers for headings, outermost first, and where each level restarts
      "numbering": { "ladder": ["가.", "1)", "가)", "①", "□", "○", "-"], "levels": ["pageTitle", "regionHead", "nestedRegionHead"], "restart": { "pageTitle": "chapter", "regionHead": "page", "nestedRegionHead": "parentRegion" } },
      // What the tender calls the annex, so the deck writes its word
      "annex": { "term": "별첨" },
      // document deck: the prose the pages are set from, and its conventions
      "manuscript": { "dir": "proposal", "printed": "## 인쇄 원고", "page": "### ",
                      "declaration": "<!--\\s*md:", "caption": "^캡션: ",
                      "exclude": ["README.md"], "annex": ["10-별첨/**"] },
      // the requirement digest whose headings issue the ids, and the id shape
      "requirements": { "source": "docs/requirements.md", "id": { "prefix": "[A-Z]{3}[-_]", "digits": 3 },
                        "notAnId": [], "absence": "제안요청서에 (?:없다|없음|없습니다)" },
      // the evidence notation and the table that defines its items; null when unused
      "evidence": { "tag": "증빙", "table": "proposal/00-서식/07-평가항목-조견표.md", "pagesColumn": -1 },
      // the numbered-page ceiling, the tender clause it comes from, and the page plan
      "budget": { "maxNumbered": 100, "clause": "제안요청서 「나. 서류 제출방법 3)」", "plan": "docs/page-plan.md" },
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
      "renderer": { "command": "<preview renderer>", "minVersion": "1.4.0" },
      // what this deck is in the submission, and the share of the preview
      // resolution its PDF pages are written at (1.0 for scanned evidence)
      "deliverable": { "label": "비계량", "pdfScale": 1.0 },
      "screens": "slides/assets/screens",   // slide deck: captures placed as figures
      "figures": {
        "sources": ["proposal/diagrams"],   // every directory whose SVGs the build may place
        "generator": "tools/diagrams",      // the modules that draw this deck's own figures
        "verify": "tools/diagrams/verify",
        "boards": { "1200": 682, "520": 300, "520-pair": 327 }   // units -> placed px
      },
      "checks": {
        // Only what the deck tool's own checks do not judge. Each phase lists check
        // names; a name resolves to <local>/<name>.py first, then to the shared check.
        "preflight": ["typefloor"],                  // run by the build; a failure stops it
        "after": ["coltotal", "samecol", "proof", "reqid"],   // run after every render
        "local": "tools/deck",                       // the project's own checks
        "baselines": "tools/deck/baselines",         // <check>.json per check, {finding: reason}
        "excluded": { "deckio": "a library the local checks import, not a check" },
        "coltotal": { "totalLabels": ["합계", "소계", "계", "총계", "누계"] },
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
            "trigger-card": { "blockSlot": "aLabel", "passSlot": "bLabel" },
            "verdict-row": { "blockSlot": "endLabel", "passSlot": "midLabel" }
          },
          "blockWords": ["차단", "오류", "통제", "제한", "보류", "반려", "실패", "위반", "누락"],
          "passWords": ["통과", "허용", "처리", "보존", "적합", "충족", "완료", "승인", "정상"]
        },
        // Every hex a hand-written source may write, and the one file that
        // carries the deck's third system. A deck that sanctions no judgement
        // pair declares this instead of `verdict`: the check then reports the
        // pair the moment a component grows one back.
        "palette": {
          "scan": ["templates", "chapters"],
          "allowed": ["14161C", "6B7280", "1B4A9C", "EEF2FA", "FFFFFF", "F5F6F8"],
          "lane": { "file": "styles/typography", "colors": ["087EA4", "EAF6F8"] }
        }
      },
      "korean": { "audit": ["pptx/chapters"] },
      "review": { "prompt": "docs/persona-review.md", "records": "docs/reviews/persona" }
    }
  },
  // The submission the decks make together: one folder, one copy per reader,
  // every volume named `<title>(<copy>_<label>)` under `<dir>/<copy>/pptx` and
  // `<dir>/<copy>/pdf`. A copy lists the decks it carries; `identity` is what
  // the copies print differently, filled into every `{{identity.<field>}}`
  // a source carries when the build makes that copy (the first copy declared
  // that names no proposer is the default the checks read).
  "submission": {
    "dir": "제출물",
    "title": "<사업명>_제안서",
    "date": "2026년 9월 15일",         // every cover's {{submission.date}}
    "deliver": "tools/deck/deliver",   // the project's command that builds every copy
    "pdfLimitMB": { "file": 50, "total": 180 },   // ceilings the delivery command measures the folder against
    "pdf": { "engine": "<deck tool>", "imageDpi": 150, "jpegQuality": 88 },  // vector pages, pictures resampled
    "copies": {
      "원본":   { "volumes": ["quantitative", "proposal", "presentation"] },
      "평가본": { "volumes": ["proposal", "presentation"] }
    },
    "identity": {
      "원본":   { "name": "<제안사 상호>", "label": "제안사", "logo": "docs/reference/logo.svg" },
      "평가본": { "name": " ", "label": " " }   // the blind copy prints nothing there: a no-break space where a deck tool refuses empty text; no logo
    }
  }
}
```

## Keys

| Key | Names | What its absence costs |
| --- | --- | --- |
| `dir` | the deck directory | required: nothing else resolves without it |
| `kind` | `document` (A4 portrait, prose pages, part dividers, a manuscript) or `slides` (landscape, one plan section per slide, speaker notes) | required: the page shell, the layouts and the fill rule differ by kind |
| `tool.name` · `skill` · `server` | the deck tool that builds this deck, the skill that teaches authoring in it, and the server that owns this deck where the tool edits through one, so the deck is reached rather than guessed at. Where a host application holds the deck open and serves it over its own connection, that connection replaces the server for as long as it does, and every call then names the deck | required wherever a deck is edited: three decks and three servers is three chances to write the wrong one, and the only report is the picture |
| `page` | page size in CSS px at 96 dpi and the text-block width | required: every width in the layout templates is derived from it |
| `type.floor` · `heading` · `codeLabel` | the sizes in points. `floor` is what prose is held to: the absolute minimum on a document deck, the body size on a projected one, since a slide is set for the room; `heading` is a projected deck's region heading; `codeLabel` is the lower floor a looked-up code value (a requirement id in a badge, an evidence number, a frame id) may print at, or `null` where that class is not measured. Where the tool lays out in CSS pixels and writes points as units × 0.75, 8pt is 10.67 units | the floor becomes a number in the skill rather than a judgement about one deck's room and audience, and the type-floor check has nothing to hold prose to |
| `annex.term` | the word the tender uses for the annex (`별첨` · `부록` · `첨부`), so the deck answers in the panel's own word | the deck names the annex whatever the author happened to type, and the references check has no word to read against |
| `manuscript` | the directory of page-files a document deck is set from | a document deck without it cannot run parity or coverage against its prose; report it |
| `plan` | the plan file a slide deck is set from: one section per slide with what the slide shows, what it answers and its script | a slide deck without it cannot check coverage; report it |
| `sourceDocument` | the issued PDF a reproducing volume carries, one source page per deck page | the volume's body pages have no source to be generated from |
| `references.deck` | the document deck a slide deck cites in its running head; the page references are computed from that deck's import order | the head's page reference cannot be computed and stays ` - ` |
| `references.evalAliases` | optional; evaluation item name → the title of the document-deck chapter that scores it, for an item the slide deck names in its own words (`{"사업의 이해": "사업이해도"}`) | the citation check matches item and chapter by name alone |
| `instructions` | the deck's own working rules and file map, read in full before the first edit | the deck contract (palette values, head fields, folio rules) is unknown; report it |
| `render` · `output` · `previews` | the render command, the built file, the preview PNG directory | required: the loop cannot run |
| `renderer.command` · `minVersion` | the command that draws the previews and the version the deck is measured against | the builder is pinned and the renderer is not, so the previews, the PDF made from them and every check that reads an image are drawn by a tool nobody declared; a deck ran three minor versions behind for months that way |
| `deliverable.label` · `pdfScale` | what this deck is called inside the submission's file name, and, for a raster route only, the share of the preview resolution its pages are written at | the deck cannot be named in the submission folder; the render is the last step |
| `submission.pdf.engine` · `imageDpi` · `jpegQuality` | how the deliverable PDF is made. `engine` names what draws the pages (the deck tool, or an office application's own export); the pages stay vector with their text searchable and a figure placed as an SVG stays vector with its labels as text, the deck's own faces are embedded, and every embedded picture is resampled to `imageDpi` where it is placed and re-encoded at `jpegQuality`, so the document keeps its quality and the pictures pay for the size. The delivery command refuses to fall back to a picture-per-page PDF on its own; a raster route is chosen explicitly | the delivery command cannot make a PDF the panel can search, and stops |
| `submission.dir` · `title` · `date` · `deliver` · `pdfLimitMB` · `copies` · `identity` | the one folder every deliverable is built into, the file title, the day the submission goes in (every cover prints `{{submission.date}}`, so one value moves every volume), the project's command that builds every copy of every volume, which decks each copy carries, the ceilings every PDF and all of them together may not pass (the delivery command measures the folder after every run and fails past either), and the proposer identity each copy prints. Printed fields are tokens, and `logo` is a file the build places on the foot of every content page of the copy that declares it. A tender that scores blind takes two copies, an original that names the proposer and an evaluation copy that does not, and the company-identifying evidence volume belongs to the original only. A chapter writes `{{identity.<field>}}` where the copies differ and the build fills it per copy. An identity field left empty fails the build for every copy but the blind one, where the blank is the point: a blank where the proposer's name belongs is not an original | one deck is delivered at a time, by hand, under a name nobody declared, and the blind copy and the original drift apart as two sets of sources |
| `screens` | a slide deck's screen captures; the build fits each into the boxes the layouts define | screen-only slides cannot be set |
| `figures.sources` | every directory whose SVGs the build turns into figure templates; a slide deck lists the document deck's figures first, its own second | no figure templates; a page cannot place a figure |
| `figures.generator` | the modules that draw this deck's own figures (a slide deck's extends the document deck's toolkit) | a figure cannot be redrawn; the SVGs go stale silently |
| `figures.verify` | the command that runs the figure checks | figures are placed unverified |
| `figures.upstream` | the document deck's figure directory a slide deck snapshots from; `figures.sources` then names only directories the slide deck owns | which document a slide deck summarises is the project's arrangement, and the snapshot check refuses to guess where to sync from |
| `figures.placeScale` | the share of its board placement a document figure prints at, centred in a box that keeps the placed width; 0.9 when absent | figures print at the full measure and read heavier than the page around them, or a typesetter lowers one figure to make a page fit |
| `figures.boards` (· `figures.scale`) | drawing-unit board width → placed px. A document deck, whose boards differ little, may add `-<variant>` entries for a board's second placement; a slide deck declares one `scale` and no variants, so a label drawn at 15 units is the same size on every slide | the build cannot place a figure; report the board it met |
| `checks.preflight` · `checks.after` | the pre-flight group the build runs before compiling and the after group run after every render, each a list of check names. `scripts/check.py` resolves a name to `<checks.local>/<name>.py` first and then to the shared check of that name, so a project overrides a shared check by writing its own under the same name. A map of name → command is accepted as well: an entry with a command runs that command from the project root, an entry with an empty command resolves by name. Declare names rather than commands for the shared checks, since a command would carry the skill's installed path | a check nobody runs is a defect nobody finds; a declared name that resolves to nothing fails the run |
| `checks.local` | the directory of the project's own checks, relative to the root. Every `.py` in it that is not `_`-prefixed or `test_` is expected in a phase or in `checks.excluded` | a project check has nowhere to resolve from, and `check.py undeclared` cannot name the scripts nobody runs |
| `checks.baselines` | the directory every check's baseline lives in, one `<check>.json` each, never beside the check's script (a shared check's directory belongs to the skill) | a check that keeps a baseline exits 2: a finding cannot be retired, and a retired one cannot be read |
| `checks.excluded` | a local script left out of both phases, and the reason (a library the checks import, a generator) | the script is reported as undeclared on every `list` |
| `checks.coltotal.totalLabels` · `tolerance` · `checks.samecol.minRows` | the words a total row opens with (default 「합계」 · 「소계」 · 「계」 · 「총계」 · 「누계」), the arithmetic slack (0.5), and the fewest body rows a uniform column is judged on (3) | the defaults apply |
| `tool.entry` · `tool.appConnection` · `tool.binary` | the entry file inside `dir` (`main.sgx` when absent); the host application's connection file when it is not the tool's default location (`$SLIDEGLANCE_APP_MCP` overrides it); the tool binary a check starts over stdio when no application holds the deck (`$SLIDEGLANCE_BIN` overrides it, `slideglance` on PATH otherwise) | the checks look in the default places; a check that finds neither an application holding the deck nor a binary exits 2 |
| `vocabulary` | the kit whose component vocabulary the checks read (`assets/kits/<kit>.json`: name slots, prose slots, captions, argument classes, the running head, master name prefixes), or `{"kit": …, "override": "<file>"}` to replace the components a project adds, or `{"file": "<file>"}` for a deck on no shared kit. Slot syntax: `arg`, `arg[].key` (each item of a JSON list), `arg[0][]` (the first row of a JSON grid) | a check that reads components cannot tell a title from a paragraph, and the reader cannot find the running head |
| `pages.numerals` · `pages.id` (· `pages.head` · `pages.masters`) | the part numerals in order (part 1 is the first) and the page-id format over `part`, `chapter` and `ordinal` (`"{part}-{chapter} {ordinal:02}"` prints 「Ⅲ-1 02」); `head` and `masters` override the vocabulary's running head (`component`, `part`, `chapter`, `title` arguments) and master prefixes (`body`, `divider`, `folioless`, `annex`, `fullBleed`). Folios count every page except annex pages and the folioless pages before the first folio; ids count a chapter's body pages in printed order. Two pages computing one id is an error | no page id and no folio, so no check that reports by page can run |
| `manuscript` | the manuscript directory, alone or as an object: `printed` (the heading that opens a file's printed part), `page` (the heading prefix of one printed page), `declaration` (how a deck source names its manuscript in a comment), `caption` (the caption line), `exclude` and `annex` (globs relative to `dir`, `*` crossing directories) | a document deck without it cannot run parity, coverage or the id check against its prose; a helper that needs an undeclared convention refuses rather than guessing it |
| `requirements.source` · `id` · `notAnId` · `absence` | the requirement digest whose headings (`#### PER-002 …`) issue the ids; the id shape (`{"prefix": <pattern>, "digits": <n>}`, the separator inside the prefix, so `QUR_001` and `PER-001` both read); prefixes that share the shape and are model or standard names (cipher and standard names are always excluded); and the pattern of a sentence that names an id to say the tender lacks it | the id check exits 2: it cannot tell an issued id from a fabricated one |
| `evidence.tag` · `table` · `pagesColumn` · `countUnits` | the word an evidence citation opens with; the Markdown table that defines the items (a row opening `\| 증빙 1 \|`); optionally the table cell listing the pages that will cite each item (an index, `-1` for the last), so an item whose pages are all in chapters not yet typeset is pending rather than a defect; and the units that make the tag a count (「증빙 3건」). `"evidence": null` declares the notation unused | the evidence check exits 2 rather than reading an absent notation as clean |
| `budget.maxNumbered` · `clause` · `plan` | the numbered-page ceiling, the tender clause it comes from (printed beside every over-budget finding), and the page plan that allocates pages per part | a page budget has no ceiling and no source the panel can check it against |
| `checks.census.sequences` · `sequenceRows` · `maxShare` | the sequence shapes a slide deck uses (containers that hold a whole sequence, shapes that stand once per item) and the share of body slides one may stand on | the shapes are the deck's own templates; the skill cannot name them |
| `checks.census.closers` · `maxCloserShare` | the rows a slide closes a region on, and the share of body slides one of them may stand on | which shapes read as a closing row is the deck's own component vocabulary |
| `checks.density.maxChars` · `maxShapes` (· `skipSlots` · `layoutPrefixes` · `itemTemplates`) | the character and shape ceilings of a body slide, set when the deck's author called a slide too dense; the optional lists widen what is not counted | a ceiling is a judgement about one deck's audience and room, never a constant of the skill |
| `checks.verdict.block` · `pass` · `templates` · `blockWords` · `passWords` | the deck's judgement pair: the two hexes, the shapes allowed to carry them with the slot that holds each side (`blockSlot` · `passSlot`), and the vocabulary each slot may print | which shapes carry a judgement and what a pass is called are the deck's own decisions; the check refuses to guess either |
| `checks.palette.scan` · `allowed` · `lane` | the hand-written sources, every hex they may write, and the one file the deck's third system lives in | an undeclared colour family arrives through a component's fixed slot rather than through anybody's decision, and no page-by-page review sees it: each page shows one of the colours and looks deliberate |
| `checks.colfill.maxGap` · `minFill` · `textBlock` · `layouts` | how far two columns of one page may end apart, how high the shortest column may end on its own (a gap rule alone passes two equally short columns), the text block's edges, and each column layout's column x ranges | the geometry is the deck's page and templates; the skill cannot derive it |
| `numbering.ladder` · `levels` · `restart` | the item-number markers from the outermost heading inward (a Korean public-document ladder is `가.` · `1)` · `가)` · `①` · `□` · `○` · `-`), which heading levels take them (page title, region head, a region nested in a region), and where each level starts again (page titles per chapter, region heads per page, nested heads per parent region; a part with no chapters runs its page titles across the part). Detail items (a card's head, a table row, a list row) take none | headings are numbered by whoever typesets the page, so the same level reads `가.` in one chapter and `1.` in the next, and a part typeset later invents its own |
| `korean.audit` | the deck's Korean sources, as directories, since a repository-wide sweep reads `.md` and `.svg` only | the deck's Korean is never audited |
| `review.prompt` · `review.records` | the canonical evaluator-persona review prompt and where rounds are recorded | a persona review has no rubric and no place to write; the generic workflow needs both |

Two decks in one repository declare both. A slide deck names the document deck it
summarises under `references.deck`, and lists that deck's `figures.sources` before its own
so a figure corrected in the document reaches the slides on the next build.

## The deck tool's own declaration

A deck tool may read a declaration of its own beside the deck: its build options, and what
the deck expects of an agent (instruction files, rules, checks). **The two files say
different things and must not drift**: this skill's config names the deck to the project
(paths, boards, checks, submission), and the tool's declaration names the deck to the
tool. Where both name one thing (the instruction files, the rules, the check commands),
one of them points at the other rather than repeating it.

- **Everything the tool's declaration references resolves inside the deck folder.** A host
  may scope its file access to the deck, so a reference above it works on one host and is
  refused on another for a deck nobody touched.
- **Declare the check groups, not only a single-check command.** With a single-check
  command alone the tool can run one check at a time, and the group a person runs by hand
  stops being the group the tool reaches.
- **The checks' working directory is inside the deck**, and a check command names no deck
  file, where the project guards its deck sources against writes from the shell.
