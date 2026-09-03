# Device frames — classes, height, and viewport pairs

Read when choosing a device class, deciding whether a frame is fixed or fluid,
or authoring a screen that reflows between two viewports.

## Device classes

| Class | Width | `--vh` | Height |
| --- | --- | --- | --- |
| `.frame` (phone) | 390 | 844 | fixed device viewport |
| `.frame.phone.wide` | 844 | 390 | fixed — author only if the product rotates |
| `.frame.tablet` | 768 | 1024 | fixed device viewport (portrait) |
| `.frame.tablet.wide` | 1024 | 768 | fixed device viewport (landscape) |
| `.frame.desktop` | 1440 | 900 | fluid — grows with the page |
| `.frame.desktop.narrow` | 1024 | 720 | fluid — grows with the page |

`--vh` is the frame's reference viewport height: `.screen` never shrinks below
it and grows when the page is longer. One board may mix phone, tablet, and
desktop sections freely.

## Height: fixed on touch devices, fluid on the web

- **Phone and tablet viewports are fixed in both dimensions.** The frame is the
  device. Bottom-pinned chrome (`.tabbar`, `.cta`) belongs to the viewport, so a
  frame carrying it MUST fit inside `--vh` — when the content needs more room,
  author a second `— scrolled` state frame rather than letting the frame grow and
  drag the tabbar to the bottom of a page-length box.
- **A desktop window has a fixed width and no fixed height.** Desktop frames pin
  the width and let the page run as long as it needs. Every desktop frame carries
  a `.fold` line — drawn automatically at `--vh`, so it lands on the viewport
  bottom however far the content pushes the frame — labelled with the reference
  size (`fold · 1440×900`). The fold marks the *smallest supported window*, not a
  page height: everything the user must act on (primary action, the reason to
  scroll) belongs above it, and content below it is the reader's cue that the
  page scrolls.
- A phone or tablet frame may also carry a `.fold` when the page is a long scroll
  with no pinned chrome — the line then marks exactly where the device viewport
  ends.
- **What kind of window a desktop frame sits in is declared, not assumed.** `chrome:
  'browser'` is the default and shows the address bar; `chrome: 'app'` is an
  installed program's own window and shows `appTitle` where the address would be;
  `chrome: 'none'` draws no window at all — a bare desktop, an installer, a screen
  that IS the machine. Drawing an address bar over a program somebody installed
  tells every reader it is a web page. Any other value refuses the build rather
  than falling back, and the kit never smuggles the choice through the URL: a
  board that wrote `app:<title>` into the address field drew its three frames
  correctly and made every reader parse a string to find out why.

## Viewport pairs and the toggle

- A screen that reflows between two viewports is authored **twice** — a `.narrow`
  frame and a `.wide` frame, adjacent in the same row, sharing one `.frame-label`
  suffixed with the human name (`· portrait` / `· landscape`, `· 1024 breakpoint`
  / `· 1440`). The pair counts as ONE inventory item and describes ONE responsive
  screen.
- **`board.config.mjs` `viewportPairs` decides what the board does with a pair**, and the choice
  is about how much of the board is paired.
  - `narrow-first` (the default) · `wide-first` — one member on screen, the header's toggle (a
    checkbox as the FIRST element of `<body>` plus the `.view-toggle` label) switching between
    them. Connectors sit between pairs, so the flow reads correctly in both views without duplicate
    arrows. Which one opens is the board's PRIMARY width, not a preference: get it wrong on a board
    that is mostly one width and the other member of every pair is hidden on arrival, and a reader
    who follows an index entry to a frame that is not on the page reports it as **missing**, not as
    hidden, because nothing there says a toggle is why.
  - `stacked` — both members on the page, the narrow one directly under its wide twin, and no
    toggle emitted at all. Right wherever pairs are the exception rather than the rule: the reader
    meets the two widths of one screen together, which is what a pair is for, and there is no
    control to discover before the board is complete. A desktop frame fills its row, so the narrow
    twin lands on the next line by itself — the stacking is the row wrap, not a special case.
- **Only frames tagged `.narrow` / `.wide` participate.** A screen authored at a
  single viewport carries no tag and stays visible in both toggle states — that is
  how orientation-locked products (kiosk mounts, vehicle docks) and single-width
  admin consoles are drawn. A board with no pairs at all deletes the toggle input
  and label; a control that does nothing erodes trust in the ones that do.
- **The board opens on its PRIMARY width, and that is a decision, not a preference.**
  `board.config.mjs` `defaultViewport` takes `'narrow'` (the default) or `'wide'`, and the build
  stamps the checkbox accordingly. Get it wrong on a board that is mostly one width and the wide
  member of every pair is hidden on arrival — a reader who follows an index entry to a frame that
  is not on the page reports it as **missing**, not as hidden, because nothing on the page says a
  toggle is why. A console of a hundred desktop screens with one phone pair sets `'wide'`; a
  product drawn phone-first leaves it alone.
- **Wide is a reflow, not a stretch.** A single phone-shaped column at 1024px is
  itself a wireframe finding: use `.split` master-detail panes, `.grid-2` /
  `.grid-3` / `.grid-4` card grids, a full `.sidebar` where the narrow view showed
  a `.sidebar.rail`, or extra table columns. If the two viewports genuinely share
  an identical structure, record that as an `OPEN:` note instead of silently
  copying.
