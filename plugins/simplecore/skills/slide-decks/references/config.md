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
      // The register's closing syllable and stop; "다." when absent
      "lang": { "sentenceEnd": "다." },
      // What the tender calls the annex, so the deck writes its word, and each kind of
      // annex reference with where its items are defined
      "annex": { "term": "별첨",
                 "references": { "<kind>": { "cite": "<pattern with id (and to) or list, optional kind>",
                                             "notBefore": ["쪽", "건"],
                                             "defined": { "file": "<path>", "pattern": "<captures id>" } } } },
      // document deck: the prose the pages are set from, and its conventions
      "manuscript": { "dir": "proposal", "printed": "## 인쇄 원고", "page": "### ",
                      "declaration": "<!--\\s*md:", "caption": "^캡션: ",
                      "exclude": ["README.md"], "annex": ["10-별첨/**"],
                      "skipLines": ["^\\*\\*대응 요구사항[::]"],     // lines that are not printed copy
                      "furnitureSource": null,                       // where titles and captions are written
                      "figurePlan": "^#### 도식 .*? 계획",           // a heading whose block is not printed
                      "sharedValues": { "file": "docs/proposal/00-README.md",
                                        "section": "## 5. 장 사이에서 한 문구로 쓰는 사실",
                                        "columns": { "fact": "사실", "wording": "인쇄할 문구", "pages": "적는 쪽" },
                                        "pages": { "marker": "^> 쪽 (\\d+)\\b" } } },   // or "deck"
      // the requirement digest whose headings issue the ids, the id shape, where a
      // requirement's quoted detail starts and stops, and the manuscript's requirement line
      "requirements": { "source": "docs/requirements.md", "id": { "prefix": "[A-Z]{3}[-_]", "digits": 3 },
                        "notAnId": [], "absence": "제안요청서에 (?:없다|없음|없습니다)",
                        "quote": { "open": "<!--\\s*l10n:quote.*?-->", "close": "<!--\\s*l10n:/quote\\s*-->" },
                        "detailStop": "\\*\\*산출물\\*\\*",
                        "manuscriptLine": "^>\\s*대응 요구사항[::]\\s*(.*)$" },
      // the transcribed tender: its chapter and section headings and what else cites it
      "rfp": { "dir": "docs/rfp/md", "chapter": "^# ([Ⅰ-Ⅻ])\\. ", "section": "^## (\\d+)\\. (.+)$",
               "skipLines": ["^> 원본:"], "word": "제안요청서", "scan": ["docs/tech"], "skipDirs": ["review"] },
      // the evidence notation and the table that defines its items; null when unused
      "evidence": { "tag": "증빙", "table": "proposal/00-서식/07-평가항목-조견표.md", "pagesColumn": -1 },
      // the tender's scoring table, the proposal's lookup table, and an optional requirement lookup
      "evaluation": { "scoring": { "file": "docs/rfp/md/05-평가.md", "section": "## 평가 항목",
                                   "columns": { "item": "평가항목", "element": "평가요소" },
                                   "split": "<br>", "itemPattern": "^\\d\\.\\d" },
                      "lookup": { "file": "proposal/00-서식/07-평가항목-조견표.md", "section": "## 인쇄 원고",
                                  "columns": { "item": "평가항목", "pages": "관련 페이지" } },   // or "deck": true
                      "noneLabel": "해당 없음",
                      "requirements": { "file": "proposal/00-서식/08-요구사항-조견표.md", "complete": true,
                                        "columns": { "id": "ID", "name": "요구사항명", "pages": "쪽" } } },
      // the numbered-page ceiling, the tender clause it comes from, the page plan, and
      // the capacity estimate the volume check reads
      "budget": { "maxNumbered": 100, "clause": "제안요청서 「나. 서류 제출방법 3)」", "plan": "docs/page-plan.md",
                  "charsPerPage": { "figure": 650, "text": 1150 }, "pageTolerance": 1.0,
                  "parts": { "01-제안개요": 4, "02-일반현황": 6 }, "fullWidth": 1000 },
      // pages whose body is a table on purpose, by page id or source file
      "grade": { "tableOfRecord": [] },
      // the Jev gateway the claims triage asks
      "jev": { "url": "https://ai-gateway.vercel.sh/v1/evaluate", "model": "typesafe-ai/jev",
               "providers": ["typesafe-ai"], "keyEnv": "AI_GATEWAY_API_KEY",
               "claims": { "evidence": "별첨|증빙|실측|시험환경", "minChars": 8, "workers": 6 } },
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
        "boards": { "1200": 682, "520": 300, "520-pair": 327 },   // units -> placed px
        // how a figure number is printed: the body series and an annex's own series
        "numbering": { "caption": "그림 {part}-{n}", "annex": "그림 별첨{a}-{n}" }
      },
      "checks": {
        // Only what the deck tool's own checks do not judge. Each phase lists check
        // names; a name resolves to <local>/<name>.py first, then to the shared check.
        "preflight": ["abspath", "typefloor", "contents", "chapter_pages"],   // run by the build
        "after": ["renderer", "layout", "rowheight", "coltotal", "samecol", "proof", "reqid"],
        "local": "tools/deck",                       // the project's own checks
        "baselines": "tools/deck/baselines",         // <check>.json per check, {finding: reason}
        "excluded": { "deckio": "a library the local checks import, not a check" },
        // Each shared check's options. Every value shown is the code's default; a key
        // left out keeps it. A false or "strict" is the default, the other value opts in.
        "layout": { "kinds": ["overlap", "outside", "escape", "empty", "tiny", "font", "diagnostic", "ink"] },
        "typefloor": { "tolerance": 0.05 },
        "abspath": { "scan": [], "generated": [] },
        "generated": { "generator": "^tools/", "scan": [], "head": 400 },   // generator is required
        "rowheight": { "topTolerance": 1, "heightTolerance": 1.5, "markerSide": 16 },
        "finetype": { "lines": 2, "labelGap": 14 },
        "chapter_pages": { "slot": "title" },        // default: the vocabulary's pages.head.title
        "pageshape": { "listCeiling": 12, "rowsPerShape": 6 },
        "rhythm": { "run": 3, "topShare": 0.3333, "minUses": 9, "minKindsCap": 10, "stackRun": 3, "stackShare": 0.5 },
        "grade": { "include": ["rhythm"], "full": 0.93, "nearly": 0.90, "columnGap": 0.15, "monoMin": 4 },
        "listrow": { "composed": [] },
        "dangle": { "minLen": 6, "nounGo": [] },
        "naming": { "fallback": false, "regionEcho": false },
        "echo": { "threshold": 0.62, "minWords": 5,
                  "minChars": { "sub": 20, "caption": 12, "prose": 20, "card": 30 },
                  "cards": false, "exemptSub": [] },
        "twice": { "minLen": 42, "sentences": false },
        "samefact": { "sameCount": ["개", "장"], "unitGuard": "월치기", "maxPrefix": 24 },
        "figures": { "cite": "에서\\s*인용한", "units": ["건", "대", "종", "쪽", "개"], "reach": 40 },
        "figtext": { "minLen": 10, "limit": 3, "condenseMin": 40, "condenseShare": 0.5 },
        "parity": { "minLen": 6, "accentLen": 0 },
        "carry": { "floor": 0.25, "minUnits": 4, "minLen": 12 },
        "fignum": { "deckOrder": "strict", "deckInManuscript": false, "idle": false },
        "secref": { "lookback": 46 },
        "reqbadge": { "regions": false, "bareIds": false },
        "coltotal": { "totalLabels": ["합계", "소계", "계", "총계", "누계"], "tolerance": 0.5 },
        "samecol": { "minRows": 3 },
        "mdtwice": { "threshold": 0.75, "minWords": 6, "minChars": 20 },
        "rfpwords": { "stop": [], "minLen": 3 },
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
    "pdfLimitMB": { "file": 50, "total": 180 },   // ceilings `deliver` measures the folder against
    // vector pages, pictures resampled; engine "slideglance" (default), "powerpoint" or "raster"
    "pdf": { "engine": "slideglance", "imageDpi": 150, "jpegQuality": 88,
             "fonts": [],                // faces to embed; else slideglance.json build.fonts, else <deck dir>/fonts/
             "figureFont": null },       // a figure's face; else the kit vocabulary's fonts.sans
    "blindCopy": "평가본",              // built last, so each deck's output holds what the panel sees
    "build": "{render} --copy {copy}", // required with more than one copy: one render cannot print two
    // instead of copies: one versioned pair, older versions and legacy files removed
    // "versioned": { "deck": "proposal", "name": "<사업명> 제안서 v{version}",
    //                "versionFile": "tools/deck/version.txt", "dir": ".", "legacy": [] },
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
| `annex.references.<kind>` · `cite` · `notBefore` · `defined` | each kind of annex item the copy cites (a table, a form, a figure): the pattern of a citation (groups `id`, optionally `to` for a range, or `list`, and `kind`), the words after a number that make it something else (「쪽」, 「건」), and where the items are defined (`file` or `deck`, with a `pattern` capturing the id) | `annexref` exits 2: a reference to an annex item nobody defined cannot be told from one that resolves |
| `lang.sentenceEnd` | the register's closing syllable and stop, 「다.」 when absent; `period`, `carry`, `naming`, `parity`, `mdtwice` and `twice` (with `sentences`) read it | the -다체 default applies, which misreads a deck written in another register |
| `plan` | the plan file a slide deck is set from: one section per slide with what the slide shows, what it answers and its script | a slide deck without it cannot check coverage; report it |
| `sourceDocument` | the issued PDF a reproducing volume carries, one source page per deck page | the volume's body pages have no source to be generated from |
| `references.deck` | the document deck a slide deck cites in its running head; the page references are computed from that deck's import order | the head's page reference cannot be computed and stays ` - ` |
| `references.evalAliases` | optional; evaluation item name → the title of the document-deck chapter that scores it, for an item the slide deck names in its own words (`{"사업의 이해": "사업이해도"}`) | the citation check matches item and chapter by name alone |
| `instructions` | the deck's own working rules and file map, read in full before the first edit | the deck contract (palette values, head fields, folio rules) is unknown; report it |
| `render` · `output` · `previews` | the render command, the built file, the preview PNG directory | required: the loop cannot run |
| `renderer.command` · `minVersion` | the command that draws the previews and the version the deck is measured against | the builder is pinned and the renderer is not, so the previews, the PDF made from them and every check that reads an image are drawn by a tool nobody declared; a deck ran three minor versions behind for months that way |
| `deliverable.label` · `pdfScale` | what this deck is called inside the submission's file name, and, for a raster route only, the share of the preview resolution its pages are written at | the deck cannot be named in the submission folder; the render is the last step |
| `submission.pdf.engine` · `imageDpi` · `jpegQuality` · `fonts` · `figureFont` | how `deliver` makes the deliverable PDF. `engine` names what draws the pages: `slideglance` (the default, the deck tool's text-mode SVG bound by rsvg-convert), `powerpoint` (the office application's own export), or `raster` (the previews stitched, chosen only on purpose). `fonts` lists the faces to embed (else the deck's `slideglance.json` `build.fonts`, else `<deck dir>/fonts/`) and `figureFont` the face a placed figure's labels take (else the kit vocabulary's `fonts.sans`). The pages stay vector with their text searchable and a figure placed as an SVG stays vector with its labels as text, the deck's own faces are embedded, and every embedded picture is resampled to `imageDpi` where it is placed and re-encoded at `jpegQuality`, so the document keeps its quality and the pictures pay for the size. `deliver` refuses to fall back to a picture-per-page PDF on its own | `deliver` cannot make a PDF the panel can search, and stops |
| `submission.dir` · `title` · `date` · `pdfLimitMB` · `copies` · `identity` · `blindCopy` · `build` | the one folder every deliverable is built into, the file title, the day the submission goes in (every cover prints `{{submission.date}}`, so one value moves every volume), which decks each copy carries, the ceilings every PDF and all of them together may not pass (`deliver` measures the folder after every run and fails past either), and the proposer identity each copy prints. `blindCopy` is built last, so each deck's `output`, which every check and review reads, holds the copy the panel sees. `build` is a command template over `{render}`, `{copy}` and `{deck}`, required with more than one copy because one render command cannot print two copies; a single copy builds with the deck's `render`. The shared `deliver` (`check.py run deliver`) builds every copy of every volume. Printed fields are tokens, and `logo` is a file the build places on the foot of every content page of the copy that declares it. A tender that scores blind takes two copies, an original that names the proposer and an evaluation copy that does not, and the company-identifying evidence volume belongs to the original only. A chapter writes `{{identity.<field>}}` where the copies differ and the build fills it per copy. An identity field left empty fails the build for every copy but the blind one, where the blank is the point: a blank where the proposer's name belongs is not an original | one deck is delivered at a time, by hand, under a name nobody declared, and the blind copy and the original drift apart as two sets of sources |
| `submission.versioned.deck` · `name` · `versionFile` · `dir` · `legacy` | a submission that ships one versioned pair instead of copies: the deck, the file name with `{version}`, the file the version is read from, the folder the pair is written to (`.` when absent), and older file names to remove. Every file carrying the same name at another version is removed, so a bump leaves exactly one pair | the pair is named by hand, and an old version stays beside the new one |
| `screens` | a slide deck's screen captures; the build fits each into the boxes the layouts define | screen-only slides cannot be set |
| `figures.sources` | every directory whose SVGs the build turns into figure templates; a slide deck lists the document deck's figures first, its own second | no figure templates; a page cannot place a figure |
| `figures.generator` | the modules that draw this deck's own figures (a slide deck's extends the document deck's toolkit) | a figure cannot be redrawn; the SVGs go stale silently |
| `figures.verify` | the command that runs the figure checks | figures are placed unverified |
| `figures.upstream` | the document deck's figure directory a slide deck snapshots from; `figures.sources` then names only directories the slide deck owns | which document a slide deck summarises is the project's arrangement, and the snapshot check refuses to guess where to sync from |
| `figures.placeScale` | the share of its board placement a document figure prints at, centred, in a box as wide as the printed picture (placed width × the factor); 0.9 when absent | figures print at the full measure and read heavier than the page around them, or a typesetter lowers one figure to make a page fit |
| `figures.boards` (· `figures.scale`) | drawing-unit board width → placed px. A document deck, whose boards differ little, may add `-<variant>` entries for a board's second placement; a slide deck declares one `scale` and no variants, so a label drawn at 15 units is the same size on every slide | the build cannot place a figure; report the board it met |
| `checks.preflight` · `checks.after` | the pre-flight group the build runs before compiling and the after group run after every render, each a list of check names. `scripts/check.py` resolves a name to `<checks.local>/<name>.py` first and then to the shared check of that name, so a project overrides a shared check by writing its own under the same name. A map of name → command is accepted as well: an entry with a command runs that command from the project root, an entry with an empty command resolves by name. Declare names rather than commands for the shared checks, since a command would carry the skill's installed path | a check nobody runs is a defect nobody finds; a declared name that resolves to nothing fails the run |
| `checks.local` | the directory of the project's own checks, relative to the root. Every `.py` in it that is not `_`-prefixed or `test_` is expected in a phase or in `checks.excluded` | a project check has nowhere to resolve from, and `check.py undeclared` cannot name the scripts nobody runs |
| `checks.baselines` | the directory every check's baseline lives in, one `<check>.json` each, never beside the check's script (a shared check's directory belongs to the skill) | a check that keeps a baseline exits 2: a finding cannot be retired, and a retired one cannot be read |
| `checks.excluded` | a local script left out of both phases, and the reason (a library the checks import, a generator) | the script is reported as undeclared on every `list` |
| `checks.coltotal.totalLabels` · `tolerance` · `checks.samecol.minRows` | the words a total row opens with (default 「합계」 · 「소계」 · 「계」 · 「총계」 · 「누계」), the arithmetic slack (0.5), and the fewest body rows a uniform column is judged on (3) | the defaults apply |
| `checks.<check>.<option>` for the other shared checks | each shared check's options, with the defaults the Shape block shows: `layout.kinds` (every kind) and `tolerance` (the tool's own); `typefloor.tolerance` (0.05pt, also read by `finetype`); `abspath.scan` and `generated` (globs from the root); `generated.generator` (required), `scan`, `head` (400); `rowheight.topTolerance` (1pt), `heightTolerance` (1.5pt), `markerSide` (16pt); `finetype.lines` (2), `labelGap` (14px), `inks` (else the kit's `palette.fine`); `chapter_pages.slot` (the head's title argument); `pageshape.listCeiling` (12), `rowsPerShape` (6); `rhythm.run` (3), `topShare` (1/3), `minUses` (9), `minKindsCap` (10), `stackRun` (3), `stackShare` (1/2); `grade.include` (`["rhythm"]`), `full` (0.93), `nearly` (0.90), `columnGap` (0.15), `monoMin` (4); `listrow.composed` (globs of page files that may lay their own stacks); `dangle.minLen` (6), `nounGo`; `echo.threshold` (0.62), `minWords` (5), `minChars` (`sub` 20, `caption` 12, `prose` 20, `card` 30), `stopWords`, `captionPrefix` (none), `exemptSub` (none); `twice.minLen` (42); `samefact.units`, `sameCount` (개, 장), `unitGuard` (월치기), `maxPrefix` (24); `figures.cite` (「에서\s*인용한」), `units` (건 대 종 쪽 개), `reach` (40); `figtext.minLen` (10), `limit` (3), `condenseMin` (40), `condenseShare` (0.5); `parity.minLen` (6); `carry.floor` (0.25), `minUnits` (4), `minLen` (12); `secref.lookback` (46), `tails`, `notAName`; `mdtwice.threshold` (0.75), `minWords` (6), `minChars` (20); `rfpwords.stop`, `minLen` (3) | the defaults apply |
| `checks.twice.sentences` · `echo.cards` · `fignum.deckOrder` · `deckInManuscript` · `idle` · `naming.fallback` · `regionEcho` · `parity.accentLen` · `reqbadge.regions` · `bareIds` | the behaviours a deck opts into. The default is the reference bid's: `twice` compares whole strings (`sentences: false`), `echo` reads the explanation, captions and prose (`cards: false`), `fignum` holds the deck's series to 1..n (`deckOrder: "strict"`, the other value `"monotonic"` for a deck typeset a part of a chapter at a time), `naming` reads only the kit's name slots, `parity` loosens no short attribute (`accentLen: 0`), and `reqbadge` runs neither policy rule. Each is turned on by setting it | the default behaviour applies |
| `checks.<check>.<role>` | a deck's override of one kit vocabulary role for one check (`checks.pageshape.listRows`, `checks.typefloor.codeLabels`, `checks.fignum.figureNumber`, `checks.naming.regions`) | the kit's role applies; a role neither declares is printed as not judged, never passed |
| `tool.entry` · `tool.appConnection` · `tool.binary` | the entry file inside `dir` (`main.sgx` when absent); the host application's connection file when it is not the tool's default location (`$SLIDEGLANCE_APP_MCP` overrides it); the tool binary a check starts over stdio when no application holds the deck (`$SLIDEGLANCE_BIN` overrides it, `slideglance` on PATH otherwise) | the checks look in the default places; a check that finds neither an application holding the deck nor a binary exits 2 |
| `vocabulary` | the kit whose component vocabulary the checks read (`assets/kits/<kit>.json`: name slots, prose slots, captions, argument classes, the running head, master name prefixes), or `{"kit": …, "override": "<file>"}` to replace the components a project adds, or `{"file": "<file>"}` for a deck on no shared kit. Slot syntax: `arg`, `arg[].key` (each item of a JSON list), `arg[0][]` (the first row of a JSON grid). Besides `slots`, `args` and `pages`, a kit file holds `kinds` (`shape`, `content`, `held`: which declared template kinds count as a shape, as content, and never as vocabulary), `roles` (the components a rule needs: list rows and containers, figures and their side and pair, rails, column layouts, numbered and sequence components, region ids and badges, code labels, the figure number, regions and region heads), `sentences` (component to sentence slots in reading order), `marks` (component to label and prose slot pairs), `contents` (the contents rows' number and page fields), `palette.fine` (the fine-print inks) and `fonts.sans` · `serif` (the families a measurement and a delivered figure use) | a check that reads components cannot tell a title from a paragraph, and the reader cannot find the running head |
| `pages.numerals` · `pages.id` (· `pages.head` · `pages.masters` · `pages.components`) | the part numerals in order (part 1 is the first) and the page-id format over `part`, `chapter` and `ordinal` (`"{part}-{chapter} {ordinal:02}"` prints 「Ⅲ-1 02」); `head`, `masters` and `components` override the vocabulary's running head (`component`, `part`, `chapter`, `title`, `sub`, `evalItem`, `reqs` arguments), the page components by kind (`body`, `contents`, `divider`) and master prefixes (`body`, `divider`, `folioless`, `annex`, `fullBleed`). Folios count every page except annex pages and the folioless pages before the first folio; ids count a chapter's body pages in printed order. Two pages computing one id is an error | no page id and no folio, so no check that reports by page can run |
| `manuscript` | the manuscript directory, alone or as an object: `printed` (the heading that opens a file's printed part), `page` (the heading prefix of one printed page), `declaration` (how a deck source names its manuscript in a comment), `caption` (the caption line), `exclude` and `annex` (globs relative to `dir`, `*` crossing directories), `skipLines` (lines that are not printed copy, read by `parity` and `carry`), `furnitureSource` (the file titles, explanations and captions are written in; `parity` compares furniture only when it is declared), `figurePlan` (a heading whose block is a figure plan and is not printed, read by `volume`), and `sharedValues` (below) | a document deck without it cannot run parity, coverage or the id check against its prose; a helper that needs an undeclared convention refuses rather than guessing it |
| `requirements.source` · `id` · `notAnId` · `absence` | the requirement digest whose headings (`#### PER-002 …`) issue the ids; the id shape (`{"prefix": <pattern>, "digits": <n>}`, the separator inside the prefix, so `QUR_001` and `PER-001` both read); prefixes that share the shape and are model or standard names (cipher and standard names are always excluded); and the pattern of a sentence that names an id to say the tender lacks it | the id check exits 2: it cannot tell an issued id from a fabricated one |
| `requirements.quote` · `detailStop` · `manuscriptLine` | the comments that open and close a requirement's verbatim tender wording in the digest, and the pattern that ends its detail (`rfpwords` reads the nouns in between); the manuscript's requirement line, group 1 the ids (`reqbadge` then holds a page's head ids to it) | `rfpwords` reads the whole entry as the tender's words; `reqbadge` skips the manuscript rule |
| `rfp.dir` · `chapter` · `section` · `skipLines` · `word` · `scan` · `skipDirs` | the transcribed tender, its chapter and section heading patterns (defaults `^# ([Ⅰ-Ⅻ])\. ` and `^## (\d+)\. (.+)$`), lines that are not its text, the word a citation opens with (「제안요청서」), and further directories `rfpcite` reads besides the manuscript, less `skipDirs` | `rfpcite` exits 2: a citation of a tender section cannot be checked against nothing |
| `evaluation.scoring` · `lookup` · `noneLabel` · `requirements` | the tender's scoring table (`file`, `section`, `columns.item` and optional `element`, `split` for several elements in one cell, `itemPattern`), the proposal's lookup table (a Markdown `file` and `section`, or `"deck": true` to read it as the deck prints it, with `columns.item` and `pages`), the cell text that means no page, and an optional requirement lookup (`file`, `columns.id`, `name`, `pages`, and `complete` when every issued id must have a row) | `evaluation` exits 2: scoring coverage has no table to be read against |
| `jev.url` · `model` · `providers` · `keyEnv` · `claims` | the Jev gateway `claims` asks (defaults: the Vercel AI Gateway evaluate endpoint, `typesafe-ai/jev`, `["typesafe-ai"]`, the key in `$AI_GATEWAY_API_KEY`); `claims.evidence` (required) is what in a line cites evidence a reader can check, and `skipRow`, `note`, `xrefOnly`, `minChars` (8), `workers` (6) and `phrasings` tune what is asked | `claims` exits 2 without `jev.claims.evidence` |
| `evidence.tag` · `table` · `pagesColumn` · `countUnits` | the word an evidence citation opens with; the Markdown table that defines the items (a row opening `\| 증빙 1 \|`); optionally the table cell listing the pages that will cite each item (an index, `-1` for the last), so an item whose pages are all in chapters not yet typeset is pending rather than a defect; and the units that make the tag a count (「증빙 3건」). `"evidence": null` declares the notation unused | the evidence check exits 2 rather than reading an absent notation as clean |
| `budget.maxNumbered` · `clause` · `plan` | the numbered-page ceiling, the tender clause it comes from (printed beside every over-budget finding), and the page plan that allocates pages per part | a page budget has no ceiling and no source the panel can check it against |
| `budget.charsPerPage.figure` · `text` · `pageTolerance` · `parts` · `fullWidth` | what `volume` estimates a printed page against: the characters a page with a full-width figure holds and a text page holds (required), the ratio a page may run over before it is reported (1.0 when absent; a project that stops condensing short of 1.0 declares where it stops), the pages each part is planned for, and the SVG width from which a figure counts as full-width (else the widest declared board). `mdtwice` reads `charsPerPage.text` to print a pair's volume in pages | `volume` exits 2 without `charsPerPage`; without `parts` no part is held to a plan |
| `manuscript.sharedValues.file` · `section` · `columns` · `pages` · `distinctive` | the table of facts several pages print in one wording, its columns (`fact`, `wording`, `pages`), how a page is found (`{"marker": <pattern>}` in the manuscript, or `"deck"` for page ids), and the pattern of a value distinctive enough to search for | `sharedvalues` exits 2 |
| `grade.tableOfRecord` | page ids or page file names whose body is a table on purpose; `grade` reports them at tier 3 with that named | such a page is graded as a defect on every run |
| `figures.numbering.caption` · `annex` | the figure number format (「그림 {part}-{n}」 or 「그림 {part}-{chapter}-{n}」, required by `fignum`) and an annex's own series (「그림 별첨{a}-{n}」), read back as patterns so a series is everything before the number | `fignum` exits 2: it cannot tell one series from another |
| `checks.census.*` · `density.*` · `verdict.*` · `palette.*` · `colfill.*` | read by a project's own checks under `checks.local`; no shared check reads them. The rows below say what each holds | as below |
| `checks.census.sequences` · `sequenceRows` · `maxShare` | the sequence shapes a slide deck uses (containers that hold a whole sequence, shapes that stand once per item) and the share of body slides one may stand on | the shapes are the deck's own templates; the skill cannot name them |
| `checks.census.closers` · `maxCloserShare` | the rows a slide closes a region on, and the share of body slides one of them may stand on | which shapes read as a closing row is the deck's own component vocabulary |
| `checks.density.maxChars` · `maxShapes` (· `skipSlots` · `layoutPrefixes` · `itemTemplates`) | the character and shape ceilings of a body slide, set when the deck's author called a slide too dense; the optional lists widen what is not counted | a ceiling is a judgement about one deck's audience and room, never a constant of the skill |
| `checks.verdict.block` · `pass` · `templates` · `blockWords` · `passWords` | the deck's judgement pair: the two hexes, the shapes allowed to carry them with the slot that holds each side (`blockSlot` · `passSlot`), and the vocabulary each slot may print | which shapes carry a judgement and what a pass is called are the deck's own decisions; the check refuses to guess either |
| `checks.palette.scan` · `allowed` · `lane` | the hand-written sources, every hex they may write, and the one file the deck's third system lives in | an undeclared colour family arrives through a component's fixed slot rather than through anybody's decision, and no page-by-page review sees it: each page shows one of the colours and looks deliberate |
| `checks.colfill.maxGap` · `minFill` · `textBlock` · `layouts` | how far two columns of one page may end apart, how high the shortest column may end on its own (a gap rule alone passes two equally short columns), the text block's edges, and each column layout's column x ranges | the geometry is the deck's page and templates; the skill cannot derive it |
| `numbering.ladder` · `levels` · `restart` | the item-number markers from the outermost heading inward (a Korean public-document ladder is `가.` · `1)` · `가)` · `①` · `□` · `○` · `-`), which heading levels take them (page title, region head, a region nested in a region), and where each level starts again (page titles per chapter, region heads per page, nested heads per parent region; a part with no chapters runs its page titles across the part). Detail items (a card's head, a table row, a list row) take none. `naming` and `parity` set a title's marker aside before reading it, each sample standing for its series (`가.` · `1)` · `가)` · `①` when absent) | headings are numbered by whoever typesets the page, so the same level reads `가.` in one chapter and `1.` in the next, and a part typeset later invents its own |
| `korean.audit` | the deck's Korean sources, as directories, since a repository-wide sweep reads `.md` and `.svg` only | the deck's Korean is never audited |
| `review.prompt` · `review.records` | the canonical evaluator-persona review prompt and where rounds are recorded | a persona review has no rubric and no place to write; the generic workflow needs both |

Two decks in one repository declare both. A slide deck names the document deck it
summarises under `references.deck`, and lists that deck's `figures.sources` before its own
so a figure corrected in the document reaches the slides on the next build.

**The figure wrap is not declared here.** The figure library of `simplecore:svg-diagrams` reads
its own `.claude/document-figures.json`: `wrapListItems` is `false` by default, so a label breaks
at any space between words; `true` breaks a 「·」 list only between its items and fails the build
on a break inside one.

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
