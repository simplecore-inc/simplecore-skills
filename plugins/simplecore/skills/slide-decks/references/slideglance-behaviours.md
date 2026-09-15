# slideglance behaviours that cost a page each

Each of these fails quietly: the build is green, the page renders, and the defect is on
the paper. Read this once per deck, and again when a page renders differently from its
source.

**What the server documents is not copied here.** The grammar, the attribute surface, the
schema traps and what the medium cannot do are served by the MCP and are read there
(`sg://skills/grammar` · `composition` · `schema-gotchas` · `lint` · `limitations`), so a
copy in this file would go stale against the server that enforces it. What this file holds
is what those pages do not say: a measurement taken off a rendered page, a defect no
diagnostic reports, and the number that settled it. Every entry names how it was verified,
and one the server starts documenting is deleted from here rather than kept beside it.
The entries stay across builder versions because a deck pinned to an older one still meets
them, and because the number that settled each is not re-argued from memory.

**A line is `fontSize × lineHeight × the face's natural line`, as PowerPoint reads
`lnSpc`** - 1.193 for Pretendard, 1.094 for KoPub Batang (`text_measure` prints the
ratio). A deck written against the CSS reading (`fontSize × lineHeight`) grows every
line by that ratio under the current builder, and 296 pages overflow at once; the fix
is one transform of every `lineHeight` in the styles, templates and generators
(`value / ratio`), never a page-by-page re-flow. A table's model height can exceed the
rows the package writes by the rounding of its `Tr h` values (10-12px on two pages);
the written rows are the paper, and `layout_check`'s escape there is accounted for.

**The builder the decks compile with now measures with the deck's own faces** -
table rows and text boxes are wrapped by the same `wrap_paragraph` the renderer
breaks them with - so an entry below that rests on the builder estimating a
glyph at 0.6 em (a row grown short, a box sized for fewer lines than it draws,
a line packed past its frame) describes a build that no longer happens, and
the remedy it names (`overlap.py` · `boxfit.py` · `slotfit.py` · `bleed.py`) is
retired: the SlideGlance MCP's `layout_check` reads the same defect from the
live model. The entries stay because a deck pinned to an older builder still
meets them, and because the number that settled each one is not re-argued.

1. **`<Svg>` drops every `<text>`.** It rasterizes through `@resvg/resvg-wasm` with no
   font database, so boxes and arrows survive and the labels vanish. The picture still
   draws, so nothing reports it. Use `<Image>`.
2. **`<Image>` does not preserve aspect.** `w` alone is applied over the bitmap's natural
   height and the picture stretches. Always set `w` and `h` - which is why the figure
   templates are generated from the file's own dimensions.
3. **A relative `src` resolves against the process directory**, not `sourcePath` - so
   the build changes into the deck directory before compiling, and **every path a source
   or a generated template carries is written relative to that directory**. An absolute
   path is the trap here, not the fix: it bakes one machine's home directory into a file
   the repository keeps, so the deck builds there and nowhere else, and a second
   checkout, another person's machine or CI renders the page with a hole where the
   picture was - silently, because a missing image is not a layout error. Two ways it
   gets in, and a deck collects both: a generator that writes `path.join(HERE, …)`
   instead of `path.relative(HERE, …)`, and a chapter file that had a path pasted into
   it. Give the generator one helper that returns the deck-relative form, use it at every
   emit site (`src`, `backgroundPath`, `MasterImage`), and add a check that reads every
   path attribute in `main.sgx`, `chapters/`, `templates/` and `styles/` and fails on one
   that starts at the root or at a drive letter. A preview tool that runs from its own
   directory is the case to fix in the preview's configuration, not by making the
   repository unportable.
4. **`IMAGE_MISSING` is a false positive for a local path.** The builder fills the data
   cache only for `http(s)`; a file path is handed to pptxgenjs as `path:` and embedded
   at write time. Suppress it in the build and emit paths only for files that exist.
5. **`equalize: true` widens every unsized sibling of an `<HStack>` to the same width.**
   In a text document that stretches a tight meta pair across the page. Turn it off.
6. **An empty `<Text>` body fails the parse** with `Missing required attribute "text"`.
   Pass ` - `.
7. **A `w="max"` sibling starves the others** to zero, which surfaces as
   `TEXT_WRAP_TO_1CH`. Give every other sibling an explicit width.
   `justifyContent="spaceBetween"` is not the fix: between two content-sized siblings it
   renders the trailing one near the middle of the row, not at the far edge.
   End-alignment comes from one `w="max"` sibling beside explicit widths. Fail the build
   on a `spaceBetween` row whose children are all content-sized.

   **The same attribute also stops the text wrapping**, and that half is quieter:
   `w="max"` sizes the box to the content, so a sentence stays on one line and runs
   past the right edge instead of folding. `TEXT_OVERFLOW_H` reports it only once the
   overshoot passes the tolerance. Wherever the value is a sentence rather than a
   label, give the `<Text>` an explicit `w`. **A row that holds such a text must itself
   span its parent (`w="100%"`)** - a content-sized `HStack` grows to the one-line
   width of its `w="max"` child and overflows the column it stands in.
8. **A mismatched close tag is accepted.** `</VStack>` closing a `<Use>` re-shapes the
   tree silently; the only report is an XSD error in the VS Code preview, which a
   headless build never sees. Run a tag-balance scan over every source file before the
   build and fail with the file, the line and the mismatch.
9. **A table whose cells wrap renders taller than the builder lays out.**
   `resolveRowHeights` gives every row `defaultRowHeight` and never looks at a cell, so
   the builder places the next shape under a table that is one line tall per row. The
   renderer then grows each row to fit, and the difference is drawn over whatever
   follows. Nothing reports it. Re-measure every table with real font advance widths
   (the kit's `overlap.py`) and fail on the ones whose overrun reaches what is below.

   **The lever is `<Tr h="…">`** - a row that declares its own height is the only thing
   the builder reserves honestly, and `overlap.py --detail <slide>` prints the value to
   write. Adding it pushes everything below down, so re-render and read the overflow
   warnings; where the page cannot hold the honest height, move the block that follows
   onto the next page or end the page with the table. Keep the horizontal cell margin
   at 9–10 so a wrapped line overshoots into the border zone rather than the neighbour.
10. **PowerPoint drops every SVG element that references a `<filter>`.** A diagram drawn
    with drop shadows loses its cards and keeps its labels, and the preview PNG is
    perfect because the CLI renders the filter fine. Before reaching for a primitive
    that shadows by default, `grep -l 'filter="url(#' <figures>/*.svg`.
11. **The builder never writes an autofit into `<a:bodyPr>`**, which PowerPoint reads as
    「자동 맞춤 안 함」: the frame keeps its laid-out height while the text runs past the
    edge. Add `<a:spAutoFit/>` to every text-bearing `<p:sp>` after the file is written -
    never to a fill-only shape, whose empty paragraph would collapse it, and never
    inside a table.
12. **`letterSpacing` is points, not em** - 자간(pt) = `letterSpacing` × 100. The PNG
    renderer ignores the attribute, so a wrong value shows nothing in the preview and
    only tears the line apart in PowerPoint. Compute it as `목표em × 글자크기(pt) ÷ 100`.
13. **The inline format tags take no `class`.** `<B>` `<I>` `<U>` `<S>` `<Mark>` `<A>`
    `<Span>` are the only children a `<Text>` accepts, and `<Span>` reads `color`,
    `highlight` and `lang` - nothing else. A `<Span class="kw">` splits the paragraph
    into runs and applies none of the style. Write the weight and the colour out:
    `<Span color="1B4A9C"><B>…</B></Span>`. Fail the build on a `class` attribute on
    any of the seven tags.
14. **Boxes standing side by side share a bottom edge** only when the row stretches:
    `alignItems="stretch"` columns and `flexGrow="1"` on every boxed card. A column
    that holds a table takes `alignItems="start"` instead, because the renderer would
    scale the table to the stretched frame. A column whose card is followed by more
    blocks is split into two rows: the pair of boxes in a stretched row, the rest in a
    top-aligned one. `rowheight.py` reads the rendered pptx and reports every row of
    framed boxes whose heights differ.
15. **A diagram's board width sets its printed text size.** A figure drawn on a
    1200-unit board and placed at 682px prints the ladder's smallest step (15) at
    `15 × 0.568 × 0.75` = 6.4pt. That is the floor. **Make a crowded figure hold fewer
    boxes; never widen the board.**
16. **Three figure-lint rules decide a figure's spacing, and their thresholds are
    exact.** `SHORT-ARROW` fires under 18 units. `TIGHT-BOTTOM` fires when the last
    baseline sits less than 12 units above the box bottom. `EMPTY-STACK-GAP` fires when
    two stacked node rects are more than 96 units apart with nothing between them.
    Changing a figure's height re-flows the page that holds it, so re-render after
    every board change rather than at the end.
17. **The CLI drops `<text>` inside an embedded SVG image** unless the SVG's font stack
    names a family the renderer was handed. Pass the deck's font files to the CLI
    (`--font`), and give the diagram generator a stack that names those families. Drop
    a family from either side and only that stack's text goes blank: a legend with line
    samples and no words means the fonts stopped reaching the CLI, not that the SVG
    lost its labels.
18. **Height is the only dimension a figure may spend.** The board width is fixed, so a
    figure that will not fit loses boxes rather than gaining width; past the board's
    height limit the figure is split into two claims or folded sideways, never scaled.
19. **A cell that wraps to two lines costs a line height, and the builder pays for it by
    squeezing the whole table.** `overlap.py --detail <slide>` names the cell and the
    character count to cut. When a page is already full, shortening the offending cell
    is cheaper than declaring `<Tr h>` - the declaration makes the page taller.
20. **`h="max"` on the last block makes a page that fits measure as overflowing.**
    `calcContentHeight` takes the root's children as `max(top + height)` and then adds
    the root's `paddingBottom` - a `class="fill"` child already reaches the padding
    edge, so the bottom padding is counted twice and `AUTOFIT_OVERFLOW` fires. The page
    still renders, but autoFit has already run: it shrank the padding and the text block
    moved. `fill` belongs where something must be pushed to the foot (a cover's proposer
    block, a divider's chapter list) on a shell whose height is fixed a few px short of
    the page, and nowhere else - a contents page and a body page flow from the top and
    want a plain `VStack`.
21. **An `<HStack>` shares its width among children that declare none.** Three unsized
    `<Text>`s in one row came out a third of the row each. Give every child a width, or
    make the row one `<Text>` with spans.
22. **Two shapes in one part may not share a `<p:cNvPr id>`.** pptxgenjs numbers shapes
    and graphic frames from separate counters, so a page with enough blocks hands the
    same id out twice; PowerPoint offers to repair the presentation on every open.
    Renumber every `cNvPr` in document order after the file is written.
23. **A media path is read from the `.sgx`, and only the builder can make that true.**
    pptxgenjs opens a media path against the *process* directory, so a relative path
    builds from the deck (where `build.ts` chdirs) and fails in the VS Code preview,
    which runs from somewhere else. Builder 0.4.2 resolves them against the entry
    document before pptxgenjs sees them - **all three of them**: `<Image src>`,
    `<MasterImage src>` and `<Master backgroundPath>`. A tag missing from that table
    resolves nowhere and prints a hole while every other picture on the page arrives,
    which reads as a broken file rather than a broken path. Every path a deck writes -
    hand-written or generated - is therefore relative to the `.sgx`, and an absolute
    path or an inline `data:` URI is a workaround for a builder defect, not a fix.
    **Verify a path change by opening the deck from an unrelated directory**, never by
    rebuilding in place: `cd /tmp` and parse `main.sgx` with `sourcePath` set, then check
    every resolved media path exists. A rebuild in the deck directory passes whatever
    the cwd happens to make true.
24. **`borderRadius` does not draw the pixel value it names.** The builder normalises it
    to a 0-1 fraction of the shape's smaller dimension and pptxgenjs reads that fraction
    as inches, so the drawn radius is `borderRadius × 192 / min(w, h)` px. Design
    against the drawn radius. A defect report for the unit mismatch belongs upstream,
    never a local patch.
25. **An opaque child stretched over a rounded, bordered container erases the border.**
    Children draw after the container's shape, so a filled cell covers the stroke along
    its span. Leave trailing cells unfilled so the border shows through, and square an
    inner plate's rounded corners by tucking them under the next cell's straight edge.
26. **pptxgenjs writes `<p:notesMasterIdLst>` after `<p:sldIdLst>`.** CT_Presentation
    fixes its place right after `<p:sldMasterIdLst>`, so a deck with speaker notes
    fails PowerPoint's read and the program offers to repair the file. Move the element
    into place after the file is written; if the repair prompt ever returns, validate
    `ppt/presentation.xml` against `pml.xsd` before hunting anywhere else.
27. **PowerPoint strips the builder's invisible hit-area rectangles as unreadable
    content.** Every container emits a fill-only shape at 100% transparency with no text
    body so the VS Code preview can click through to its source. Delete the exact
    signature (white fill, `<a:alpha val="0"/>`, empty `<a:ln>`, no `<p:txBody>`)
    before the file ships. **The empty line is serialised two ways** - `<a:ln></a:ln>`
    up to builder 0.4.1 and `<a:ln/>` from 0.4.2 - and a pattern written for one strips
    nothing under the other while the build stays green: three decks shipped with
    8,148 · 1,920 · 27 hit areas each until PowerPoint offered to repair the summary
    deck. Match both forms, keep the pattern in one module every deck imports, and
    count what is left after stripping - a slide with any remaining fails the build.
    Diagnose a returning repair prompt by diffing a PowerPoint-repaired save against
    the build.
27a. **pptxgenjs declares a slide master part per slide in `[Content_Types].xml` and
    writes one master.** `/ppt/slideMasters/slideMaster2.xml` … `slideMasterN.xml` stand
    in the content types with no part behind them; every slide is schema-clean, the
    Open XML SDK validator reports nothing, and PowerPoint still opens the file with
    「프레젠테이션 복구가 시도될 수 있습니다」 - an Override for a part that is not in the
    package is a package defect, not a schema one. Drop every Override whose part the
    package does not hold before the file ships (`tools/deck/pptxfix.ts`,
    `pruneContentTypes`), and read the package, not only the slides, when a repair prompt
    returns: content types, relationship targets and part names are where the slide
    checks cannot see.
27b. **A figure placed from an SVG ships with the SVG's own bytes as its PNG fallback.**
    pptxgenjs under Node writes the SVG into `image-N-M.png` beside the `.svg` part, so
    the `<a:blip>` every reader opens first names a picture that is not a picture - and
    PowerPoint repairs the file even though it renders the SVG afterwards. Schema
    validation says nothing (a blip is a relationship, not bytes). Check every
    `ppt/media/*.png` for the PNG signature and rasterise the SVG into the fallback's
    place before the file ships (`tools/deck/pptxfix.ts`, `rasterizeSvgFallbacks`, at
    twice the drawing's width with the deck's own faces); a part still holding text fails
    the build.
27c. **The notes master shares the slide master's theme part, and PowerPoint repairs the
    file over it.** pptxgenjs relates both masters to one `ppt/theme/theme1.xml`; packaging
    allows it, the Open XML SDK validator passes it, and every deck that carries notes
    parts - which is every deck, since pptxgenjs writes a notes slide per slide whether
    or not a note was given - opens with 「프레젠테이션 복구가 시도될 수 있습니다」. The same
    file with the notes master related to a copy of the theme opens clean; it was the
    last of four causes, found by taking one feature out of the deck at a time (SVG
    figures, notes, pictures) and then one thing out of the notes at a time. Give every
    notes master a theme part of its own before the file ships
    (`tools/deck/pptxfix.ts`, `separateNotesTheme`). **When a repair prompt survives
    every validator, bisect the package with the reader itself**: build variants that
    each drop one feature, open them, and let the one that opens clean name the cause.
28. **A paragraph carrying an emphasis span repeats its `<a:pPr>` before every run.**
    `CT_TextParagraph` allows one, first. Keep the first, drop the copies, and put it
    where the schema says - a stricter reader than PowerPoint balks otherwise.
29. **`<Notes>` is the one child of `<Slide>` that is not the root.** It takes text
    only - no attributes, no elements - and a template's `{param}` inside it is
    substituted like any body text, so a page template can carry the speaker script
    as a parameter.
30. **The page size and the presets it accepts are the server's grammar**, and are read
    from `sg://skills/grammar` and `sg://skills/schema-gotchas` rather than from here.
    What a deck has to know beyond them is one line: a landscape page is `w`/`h` in
    pixels, because every preset is portrait or screen.
31. **A fixed-height component wraps into its own foot.** A card or row that declares
    `h` (a step strip cell, a ladder row, a marker band) holds one line per slot;
    a value that wraps draws past the box and reports as `TEXT_OVERFLOW_V` or as a
    child overflowing its parent. Shorten the value or take the component that grows.
32. **A fixed-height column shrinks its flexible rows before it overflows.** When the
    content of a `VStack h="…"` outgrows it, Yoga shrinks the `HStack` rows inside
    (their default `flexShrink` is 1) and the diagnostic lands on the row's child -
    `OUT_OF_PARENT … <vstack> overflows its hstack parent by 25px` - while the column
    itself reports nothing. The number is the overshoot of the whole page: cut that
    many pixels of content from the slide.

33. **The preview and PowerPoint place a line differently inside its box, so a drawn
    marker beside text cannot be right in both.** `lineHeight` reaches the `.pptx` as
    `<a:lnSpc><a:spcPct>` with `tIns="0"` and `anchor="t"`; the preview divides the
    extra leading half above the line and half below, the way CSS does, while
    PowerPoint puts all of it above the first line. At the deck's body size the two
    disagree by about 1.5px, which is invisible in prose and plain on any shape
    aligned to the text - a list's dot, a numbered plate, a connector arrow. It shows
    up as 「the marker is above the text」 in the .pptx while the PNG measures level.
    Neither renderer is wrong and nothing in the source can satisfy both: set the
    marker's offset between them, say so beside the value, and measure both - the
    PNG with a pixel probe, the .pptx by reading `<a:off>`/`<a:ext>` of the two
    shapes out of `ppt/slides/slideN.xml`.

34. **A card row the layout measured one line short is drawn over the row beneath it,
    and no check reports it.** `overlap.py` reads tables only, `rowheight.py` compares
    boxes standing side by side, and the lint's `TEXT_OVERFLOW_H` fires only when a
    line misses its box by a few pixels - a labelled row that needs four lines in a
    263px card column and got three passes all three, and the last line lands on the
    label under it. Two shapes of the same defect turned up in one part: a value
    carrying `→` (the arrow's advance is under-measured, so a 514px string was laid
    out as two lines and drawn as three) and an ordinary value long enough to need a
    fourth line. **Measure every card value against its column before trusting a clean
    build** - `wrapped_lines(text, 263 / 10.67)` with the deck's own advance widths -
    and move anything at four lines or more into a wider box: the full text block, a
    list row (313px in a half column), or its own region. Read the PNG of every page
    that carries a card in a column; the defect is plain there and nowhere else.

35. **Two boxed cards opening the two columns of a `col2-top` stand on the same top
    edge with different heights, and `rowheight.py` fails the row.** `col2-top` aligns
    to the top on purpose, so the cards do not share a bottom edge and the check reads
    them as a mismatched pair. Let one column open with something unboxed - a list, an
    `item`, a `branch-detail` - or use `col2`, whose `flexGrow` cards do share the edge.

36. **The preview PNG and the `.pptx` break a line differently, so a blank line under
    a row in the PNG proves nothing on its own.** The builder sizes the box from its
    own measurement and each renderer then wraps the text inside it, and the two
    disagree by a few pixels on a string that lands near a line boundary. Both
    directions occur, on the same page set: a full-width list row measured at two
    lines wrapped to one in the preview and to two in the `.pptx`, so the preview's
    gap was an artifact; a card row in a 440px column measured at two lines wrapped to
    one in both, so its gap was real. **Settle it against a PDF built from the `.pptx`,
    never by rewording on the strength of the preview** - a sentence trimmed to close
    a gap that does not exist is a manuscript edit spent on nothing.

    ```bash
    soffice --headless --convert-to pdf --outdir <scratch> out/<deck>.pptx
    pdftoppm -f <page> -l <page> -r 150 -png <scratch>/<deck>.pdf <scratch>/pg
    ```

36a. **A PDF stitched from the previews is sized by how each page is stored, not by its
    resolution.** Pillow's PDF writer turns every RGB page into a JPEG (about 200 KB a
    page at 144 dpi) and a palette page into uncompressed hex (a 56 MB volume became
    1.1 GB the moment pages were quantised), and MuPDF re-deflates a PNG without its
    predictors. What keeps both the type and the size is img2pdf: a typeset page -
    a few brand colours and anti-aliased type - quantised to 256 colours with no dither
    and embedded as its own PNG stream is 40% of the JPEG with no visible change, and
    a page with more colours than a threshold near 8,000 (cover artwork, scans,
    photographs, where a palette bands into steps) stays a JPEG at a quality above the
    default. Lowering the page scale is the one lever that is not on the table: a
    submission never trades quality for size. **And a stitched PDF has no text** - the
    renderer's SVG draws glyphs as paths whenever a face is at hand - so where the panel
    has to search or select the body, the pages come from `slideglance convert --text`
    (the renderer's text mode: `<text>` carrying the deck's face names, faces still in
    `<defs>`), a figure the renderer embedded as an SVG data URL is inlined as a nested
    `<svg>` (rsvg would rasterise the URL at 96 dpi), the figure's font chain is pinned to
    the deck's sans (rsvg resolves `Inter, SF Pro, system-ui …` to a system face for the
    digits), and `rsvg-convert` binds the pages with the faces from `fonts/` through a
    private `fonts.conf`. cairo then embeds a font subset per page - 22 MB on 296 pages -
    which `Document.subset_fonts()` cuts to 17 MB; the pictures are resampled with
    `rewrite_images` at 150 dpi. PowerPoint's own export (AppleScript) is the other
    text-preserving route and wraps a few Korean lines differently; LibreOffice
    substitutes the Korean faces and is not one.

37. **`TEXT_OVERFLOW_H` missing a box by a handful of pixels on ordinary wrapping text
    is the builder's width check disagreeing with its own wrap, and the PDF shows no
    spill.** The message reads 「natural single-line width ~316px exceeds box width
    313px by 3px. The box height (17px) only fits one line」 - but the row is a
    `dot-row` or a card value, the layout has already given it two lines, and the
    glyphs land inside. Check the page in a PDF (36) before touching the sentence; a
    confirmed false positive is reported as one and left alone rather than paid for in
    prose. The warning is real, and the fix is a shorter value, only where the box
    genuinely holds one line by construction - a `keyrow` value, a fixed-height cell
    (31), a bar's stub.

38. **A table row taller than its own glyphs is invisible to every check, and the
    fill rule counts the air as content.** `overlap.py` clamps both the drawn and
    the required height to the declared one, so a row at `h="80"` for text that
    needs 32 reports 「선언 80 · 그림 80 · 실제 80」 and passes; a page can meet
    the fill bar on padding rather than words. One page carried six rows at
    `h="54"` for two-line cells - 120px of it, a seventh of the text block.
    **`overlap.py --apply` is the remedy**: it drops a height the cell no longer
    needs as well as writing the one it does, and it says which rows it touched.
    Run it after any edit that shortens a table cell, because nothing else will
    ever mention the leftover.

39. **`OUT_OF_PARENT` by four or five pixels is the page overflowing its text
    block, and it is the only thing that says so.** The message names an
    innocent `<text>` or `<vstack>` inside an hstack - a card's value row, a
    table cell - so it reads as a width problem in that one component, and
    reshaping the component never clears it. What has happened is that the
    page's stack is taller than the block, and the renderer squeezes the last
    region to fit; the squeezed rows are what report. **Remove content or
    height anywhere on the page and every one of them goes at once.** One page
    reported eight of these from two cards that were themselves correct, and a
    page carrying four lines in a three-line row draws them on top of the row
    beneath - which is what a reader sees as 「the layout is strange」.

    The fill check cannot reach this: it measures the last ink as a share of the
    block, so an over-full page reads as 100 % - exactly like a page that ends
    on the last pixel. `error 0` is the only test for the difference, so a page
    that grew is rendered and its errors read before it is called finished.

40. **The preview renderer does not measure Hangul with the font the deck bundles,
    and a fixed column sized from the bundled metrics is about a quarter too
    narrow.** Its own warnings give the advance exactly: 「기준정보」 and
    「시나리오」 - four syllables, no space - come back as 47px against a 10.67
    unit size, and 「보고 내용」 as 49px. That is **1.1015 em per syllable**, where
    Pretendard's own advance is 0.864, and it is why a two-syllable label plate
    takes a four-syllable label without complaint in every source-side
    measurement and then prints past its own edge. Latin, digits and punctuation
    are measured from the font as written.

    So a check that measures a fixed column from the bundled font finds nothing
    and reads as a clean deck. `slotfit.py` measures Hangul at that advance
    instead and answers before the build; `boxfit.py` reads the built file and
    answers after it. Both are needed - the first is what an author editing one
    page can run.

41. **The builder's `TEXT_OVERFLOW_H` measures a string about one em wider than the
    embedded font needs, so an overshoot under that constant is the measurement,
    not the page.** The lint reports `naturalW` for the run and compares it with
    the box; on one deck that figure sat **10.09px above** what Pretendard's own
    advance gives at 10.67 units - 10.01 to 10.38 across twenty warnings whose
    strings ran from 46px to 389px, so it is an additive term and not a metric
    difference. The `.pptx` it emits sets `lIns`/`rIns` to 0, so nothing on the
    PowerPoint side accounts for it, and the PDF shows those lines sitting inside
    their columns with room to spare.

    Two consequences. **A warning whose `overshootPx` is under the constant is
    settled by `boxfit.py` and the PDF, never by shortening the sentence** -
    rewriting correct prose to satisfy a pessimistic measure is how a document
    gets worse one warning at a time. And **the constant has to be re-derived per
    deck rather than carried in a check**, because it is the builder's, not the
    deck's: measure it as `naturalW − <the font's own width>` over the warnings
    the deck already has, and confirm it is the same number at both ends of the
    range before trusting any of them.

    The lint's message carries no text, so the string behind a warning is found
    by matching the reported `boxW`/`boxH` against the built file's own
    rectangles. `build.ts` prints the whole diagnostic - `context` included -
    under `DECK_DUMP=1`, which is what makes that match possible;
    `DECK_NODE=1` prints the node path alone.

The kit's `build.ts` carries the post-processing for 11, 22, 26, 27 and 28 and the
source scans for 7, 8 and 13. Keep them when copying the kit; each one is a
PowerPoint repair prompt or an editing defect that shipped once.

27. **The head band's citation may reach the masthead's ink, not its box - and the
    PNG cannot prove it.** The masthead is a right-aligned master text whose box
    (`x=930 w=145`) is sized to its letters; the band ends 40px before that box
    (`w=890`), and `width.py` reads both so a wider band fails the build. The
    preview breaks lines with Pretendard's real advances while the PNG renderer
    breaks them slightly earlier, so a band that shows a gap in the PNG can still
    run under the masthead on screen - one did at `w=916`. Judge a band width by
    measuring the first line with `tools/overlap.text_width_em` against the
    chapter units kept whole (the NBSP inside a citation is what keeps them
    whole), never by looking at the PNG.
