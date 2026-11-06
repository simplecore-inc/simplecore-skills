# Screen playbook: the traps a screen move meets, and the step that avoids each

Read before moving or building a screen, or running a multi-agent screen job. Each line is a trial
and error that cost a round once; the step beside it is the whole fix. The method (preflight,
simulate one screen at a time) is `screen-preflight.md`; the rules a screen follows are
`screen-workflow.md`. Project-specific values (ports, account names, environment variables) belong
in the project's `CLAUDE.md`, never here.

## Moving a screen from the template

| Trap | Step |
| --- | --- |
| `simplix add-page` / `scaffold` run the project's `generated.after` commands (a project puts its design check and typechecks there); they exit non-zero while the tree is half renamed, although the page is written | take the page as written, finish the rename, then run the checks; do not read the exit code of the scaffold as "nothing happened"; a step that fails ends the later steps unless it states `onFailure: "continue"` (a gate no later step depends on), so read which one failed |
| A design check that reads a screen's `page.blocks.tsx` refuses a moved screen whose entry still names the removed file | repoint the screen's design entry before scaffolding, then scaffold |
| A deleted generated file leaves its base under `.simplix/generated/`, and `generated --all` keeps a deleted file deleted while it keeps the base | delete the base by absolute path with the file (screen-workflow rule 22) |
| A story merge that fails midway leaves the generated base overwritten with the fresh render; the next merge compares fresh against fresh and keeps the old frame silently | take the base from `git show HEAD:<path>` and merge again; never rerun a failed merge |
| A blocks file equal to its base was read as a stub and deleted although its base had been recorded after the customisation | a stub is a blocks file whose every hook returns `{}`; test the rule on a real stub and on a customised file |
| A page template change makes every moved screen stale at once | stale is the normal state of an edited page; `simplix generated` fails only on a page that did not start from its template; re-scaffold one screen when its own change needs it |
| Hand-editing the menu file after the scaffold leaves the board's console menu red | decide the group and icon in the design entry before scaffolding and pass `--menu-group` and `--menu-icon`; a menu edit made any other way is followed by the board's menu generator |
| A module or entity locale file edited by hand leaves the board's catalogs stale, and copying the file across by hand drifts again | the board's catalog generator writes module and entity catalogs from the packages' own files; run it after the edit and let the board check confirm |
| A server label is reworded (audit labels to sentence case) and `simplix meta` rewrites most catalogs but leaves entity blocks whose DTOs no longer declare the field with the old wording | the merge keeps keys the generator no longer writes, so compare each entity block's audit labels with the Meta document after a label wave; reword a stale key in the locale file only (the board follows through its catalog generator) and report the stale keys as a CLI gap |
| Board files edited by hand fail the formatter only when it runs from the apps project | the board's check runs the formatter first; fix with the formatter's write mode from the apps project |
| A route path is guessed (`/audit-events` against `/audit-log`) | the entity's plural in kebab case is the default; a path override in `routes.<group>.paths` is written before the scaffold, and only where the menu word differs from the entity's plural |
| A generated list or detail draws a field with a masked twin, or a decrypted personal field | `scaffold.maskedSuffix` makes the generator leave the unmasked field out; a personal field with no masked twin is a backend gap, raised and not drawn |
| A reference column draws the raw id as the name although typecheck, lint and the board agree | the nested record lists every property of its entity and the serializer writes fewer: the name path comes from the entity's declared `nameFields`, not from the field names; `simplix check-screen` fails any other path, and the board's sample rows nest the name |
| The scaffolded form cannot create a record, or its first save is refused | the create body's required fields are all in the table and marked; a required reference needs `scaffold.referencePickers` for its entity; a required list of records or nested record has no generated control, so the form builds it in its submit (the scaffold warns and `check-screen` fails a form file that never names it); `check-screen` reports each |
| A list row carries a key the create body requires (`...Id`) and the list shows no column for it | Meta declares no reference for the key, so the scaffold draws no name; `check-screen` warns when the list file has no `key:` or `name:` column for it; raise the reference in the backend, or draw the name through a lookup |
| A status badge draws neutral on the screen and in its tone on the board frame | the screen has no tone map for its enum; compare the computed badge colours of both under the same label (screen-workflow rule 6) |
| A text field with a long contract is drawn on one line | the kind follows the contract's length (500 and up); where the live Meta states none, refresh the snapshot after the backend rebuilds before writing the kind by hand |
| A list can only be filtered by a user's id | a reference key gets the entity-facet filter (`facet` in `scaffold.referencePickers`), leading the filters; without a configured facet the id filter is left out, not offered |
| A list's facet over a person's key labels each option with the person's name alone, so two people of one name are two identical options and the exact narrowing the facet exists for cannot be chosen | label a directory option as the form picker does: the name, then the sign-in name (`Name · username`), from one shared label function |
| A tab or sub-list reuses a list's contract columns filtered to a few keys, and a drawer draws only its first two columns | the contract gives each column the drop width of the table up to it, counted over the full list's field order, so a subset keeps widths that count columns it never draws; hand the contract the subset's own field order (a column hook that takes an `order`), never filter the full set |
| A regeneration starts importing a package (the facet's `from` in `scaffold.referencePickers`) into a module older than the project's `modules.dependencies` setting; the `generated.after` typecheck fails with TS2307 but the files are written, and the running dev server draws a resolve error on every route | before `generated --all` over screens of several modules, check that each module's `package.json` declares the packages the new render imports; declare and install first. A Vite dev server that already failed the bare import keeps the failed lookup after the install (touching the importer does not clear it): restart it, the way the project documents |
| A conflict between a template change and a screen's own content | read the printed diff; where the screen is the intended one, `simplix generated --rebase -y --adopt <path>` records the base; where the template change is wanted, take the hunk by hand first; a hunk that differs from the backend's current contract comes from committed Meta older than the running server, so refresh Meta and run `generated` again instead of adopting (`scaffold/overview.md`) |
| The screen draws no description line | the scaffold writes no description key; add `screen.<entity>.description` to the module's `widgets` catalog in every language before the scaffold runs (screen-workflow rule 0), and let the board's design check confirm it |
| A board frame is the scaffold's output as generated: placeholder rows (`name 1`, `name 2`), every row in one standing, every optional value filled | the frame's sample rows are part of the design: one record for every standing the screen words, one with every optional value empty, and one for each notice the screen draws; a row reading `<field> 1` is a frame not yet drawn, and the frame is drawn by hand from the step-0 entry (screen-workflow rule 0) |
| A probe that finds nothing reports a clean 0 | prove every counting check on a known hit before trusting a 0; a command whose failure is swallowed reports 0 for the wrong reason |

## Regions, figures and filters

- A figure tile that counts rows presses a filter; the list must carry a filter for that field (the
  template adds a faceted one) so the press shows as an active badge and clears from the bar. A
  value a tab forces beats a filter-bar value over the same field: link such a tile to the tab.
  A folded figure chip does what its card does (narrows the list with the pressed state shown,
  leads to its list, or stays a figure) and never unfolds the row; the handle at the end of the
  strip is the one control for that. A card or chip that does nothing when pressed is drawn with a
  not-allowed cursor and no press reaction (the `pressable` variant of the kit's tile and chip
  slots), so a figure that leads nowhere does not teach the reader to stop trying the others. The
  half of the figure row that is folded away is `inert` while hidden, so Tab never lands on a
  card or chip behind a folded strip.
- Status counts are the census over every row; sum cards follow the list's committed filters, its
  search text and its forced scope. Both are computed under the parameters the caller sends, so
  "today", "last 24 hours", "granted only" and "held above zero" are parameters the screen adds,
  never new backend figures.
- Act-now tiles state their tone per status value (`status.tones`); a tile takes it only above zero.
- The time range is a slot on the list-detail page, switched on with data (`field`, presets); the
  per-slice counts come from the generated bucket read published in Meta, and the heatmap is drawn
  in theme tokens (a ramp from the muted to the primary colour), never a named fixed palette.
- A list keeps the leading column, the column its default sort names and the row-action column
  drawn at any width; the columns menu offers every declared column. A default sort that names an
  audit stamp (an event log read by `createdAt`) keeps the stamp as that column and as the period
  filter; the generator does it (#54), so the author adds neither by hand.
- A label in the backend bundle never names a unit the kind draws itself (cents, ms): the kind
  owns the unit, the label names the quantity.
- A verb the backend has and no type names takes its own kind and glyph in the kit; a borrowed
  type or a labelled-button flag per screen is a second way to draw one region. The kit names
  `retry`, `reset`, `test`, `reprocess`, `enable`, `disable`, `suspend`, `reinstate`, `cancel`,
  `revoke` and `upload` (`RecordVerbType`); a screen picks one of them and never borrows an
  unrelated type (`duplicate` for a retry), and a verb outside that set is added to the kit.
- A verb pair that flips with the row (enable or disable, suspend or reinstate) is one row action
  whose `type` and `label` are functions of the row, with one confirmation whose words follow the
  record (screen-workflow rule 31); two actions of which one is always disabled is the form to
  leave. A status with more than two values keeps one disabled reason for the states outside the
  pair.
- A verb the record panel offers is reachable from the row and the card with the same availability
  rule and the same disabled reason, or the entry says why not. A verb the record's state refuses
  is disabled with its reason, never hidden.
- A head figure and a column take their label from the field they draw (`contract.headFigures(fields,
  row)` and the column's own header); a figure or column that is not a field of the record (a share
  of two fields, a value computed from several) carries its own key. A new catalog key for a field
  that already has a label gives one value two names. One state is worded by one key: the badge,
  the notice title, the timeline step and the field read the same word, spelled as the Meta label
  spells it.
- A filter on a key the page or the service forces answers one value: a forced value wins over a
  filter on the same key, so choosing another value changes nothing on screen. The filter is
  dropped with its detail field, and the measurement is stated in the entry. A list over a bounded
  set (a handful of cards, one row per month) carries no range filters. An axis the persona's
  question names ("per provider") gets its filter, a text filter where the field is text
  (`--text-filter <field,field>`, `scaffold/overview.md`).
- A list drawn as cards always offers the switch to the table, and the reader's choice is remembered.
  The kit derives the offer from the presentation (`offersViewSwitch`: a cards list is always
  offered it, a table list when it asks) and stores the last view under the list's `viewKey`, or
  under a key derived from the column keys when the screen names none. The design entry carries
  `list.viewToggle: true` for a cards list; a table list sets it only with `list.toggleReason`, the
  reason its rows are also read as units. The columns follow the list's own width and the one
  `--card-min-width` layout token, so every card of every card list has the same column width, a
  detail panel opening beside the list reflows the cards, and the cards stand side by side from the
  left with only the grid's gap between them and no empty track. A screen sets no card width,
  maximum width or column count of its own; a different width is a change to the token or the grid
  (`customize/framework-components.md`).
  Enforcement: the mockup board's design check (`screen-design`) refuses a cards entry without
  `viewToggle`, a table entry with `viewToggle` and no `toggleReason`, and a list file or board
  frame whose `<RecordList>` declares another presentation, switch or card title than its entry;
  the scaffold renders the switch for every cards list without a flag and refuses `--view-toggle`
  beside `--list-presentation cards` (`--view-toggle` is for a table list); `compareCardGrid` in
  the kit's `regions-rendered.mjs` measures the grid in the rendered run: the column count is
  `max(1, floor((listWidth + gap) / (cardMin + gap)))`, every card is the column width and the
  first card's width, the first card starts at the list's left padding, neighbours stand one gap
  apart and rows one row gap apart.
- A card's labelled lines are read in both languages at the narrow and the wide width. A label that
  wraps (the label column is as wide as the longest label up to the `--console-card-label-max`
  token), a line drawn as a dash on most cards (`cardKeep: false` draws it only on the cards that
  have a value) and a figure row that pushes the list below the fold are findings.
- A person's name is drawn through one interface-language helper; a name field read directly, or a
  server-composed display name, draws the same person in one language whatever the language menu
  says. A name the server composes into a row is localized on the server (the entity declares its
  per-language family, described in the backend skill's `entity/yml-configuration.md`), and the screen draws that
  field as the contract gives it with no name code of its own. A list over a reference key that
  draws the name sorts and searches through it, and a text search finds the person by every name
  they carry (native, English and sign-in name).
  Enforcement: review - which field of a record is a person's name is a fact of the product's
  contract, so a source rule cannot tell it from any other text field; a project that has the
  helper adds its own source check against a direct read.
- A holder tab (a list inside a record's detail) draws the columns of the holder's own list, never
  every field of the DTO.
- Two holders of one entity (notes held by their subject and by their author) share a list hook
  and an access rule, so the detail imports them once: the CLI hands the template `holderImports`,
  one statement per package with each name once, and a detail template iterates it rather than
  writing an import per holder. A detail rendered before that shape holds the same import twice
  and does not compile (TS2300); `simplix generated --all <detail path>` re-renders it.
- A history rail (the kit's `screen/history-rail`) draws each step as a dot with a line to the next.
  The line is absolutely positioned, 2px wide, stands 4px under its own dot and stops 4px above the
  next one at any row height, and is dashed where the next step was skipped. A screen draws no rail
  of its own and sets no spacing on the kit's.

## Rendered checks

- Write one product runner that signs a test account in, resolves the board frame's story id from the board's
  story index (printing the stories that exist on a miss), opens a route (a route behind a tab at the tab's URL),
  asserts the screen's root slot or the document title before a capture is read (a sign-in page or an overlay
  measures like a screen), runs the kit's region probe for the page
  type, the kit's focus ring probe and every rendered audit check (`audit-rendered.mjs --print-all` prints them as
  JSON for a driver that holds a signed-in page), and prints a short result; an agent that writes its own loop per screen re-derives the
  sign-in, the root selector and the board frame's story id each time. The region signature is compared without
  the row count, and a list that draws no rows is reported as not judged. The run signs in whether or
  not a shell is drawn, because the shell draws for any stored session: tokens a deleted account or
  another agent left at the origin open it with no identity-provider session behind them, and a pass
  that trusts the shell measures the wrong account. A rendered run clears the tokens that do not belong
  to its own account before it measures (the app's stored tokens and the identity realm's cookies), and
  fails unless the token it holds names its own account after the sign-in. A frame's story id comes from the
  story file's id and export name, not from the entity's name.
- The board frame and the live page differ in content (a row count sets a list's height, a record sets a badge's
  variant): control metrics between them are read, the region signature and the audit checks gate.
- A region-signature difference that follows the data (a notice or figure the live data does not
  raise, a page-button count, a section hidden when empty, a status tone under a different label) is
  reported as data and not changed on the screen. The comparison runs against the frame state the
  live record is in; where the frame draws one state only, the difference is named and the state
  the live data lacks is listed as not verified live.
- A state the product cannot create (a read-only entity, rows a provider writes, a sum derived from
  other events) is drawn in the frame and reported as not verified live; it is never reached by
  writing rows into the database.

## Several agents in one checkout

- Commit by pathspec through a private index, and build the commit from the HEAD read at the start
  with a compare-and-swap on the branch; a commit landed meanwhile is otherwise reverted file by
  file (`~/.claude/references/shared-checkout-git.md`). After parallel work read `git show --stat`
  of each commit: only that agent's paths.
- A browser sign-in of a test account replaces the stored session of whoever is signed in at that
  origin in the same browser profile, and the identity provider returns a sign-in only to the origin
  its client registers; the project's reference names that origin and the account script.
- A scripted run that moves state restores it in a `finally`. It re-reads the token before cleanup,
  closes every page before it deletes its account (a page left open keeps saving its language to a
  deleted identity, and the identity provider answers 404; the product must report a missing
  identity there, never an outage), names its browser space by its account (a name shared
  between runs ends the other run's task), deletes only names and prefixes it owns, and prints one
  real response of a create call before it builds on the response's shape. A language switched
  through the app's menu is followed by in-app navigation only, since a reload resets the language
  to the account's setting.
- A root typecheck stops at the first failing package of a shared tree, so the module that changed
  is checked on its own; a board check that stops at its first failing step hides the later ones, so
  its steps run one by one when the first fails (screen-workflow Cases, "A checks chain stopped at
  a known failure").
- A shared test-account sign-in helper that resets the password on expiry signs other agents out:
  every agent creates and deletes its own account. A deleted identity's username cannot be reused,
  so pick a fresh name.
- A dev server restarted by an agent without the environment the project's tunnel needs breaks the
  user's address; whoever restarts a server starts it the way the project documents.
- A session restart ends the servers and agents it started; after a restart check the API, the
  database containers and the dev servers before judging a screen (an empty menu is usually the
  permissions read failing, not a missing role).
- A volume that fills stops shell calls, containers and builds together; check free space before a
  multi-agent job, keep scratch copies out of the scratch folder and delete what an agent made once
  it is finished.
