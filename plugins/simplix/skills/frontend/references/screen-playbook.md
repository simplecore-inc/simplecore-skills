# Screen playbook: the traps a screen move meets, and the step that avoids each

Read before moving or building a screen, or running a multi-agent screen job. Each line is a trial
and error that cost a round once; the step beside it is the whole fix. The method (preflight,
simulate one screen at a time) is `screen-preflight.md`; the rules a screen follows are
`screen-workflow.md`. Project-specific values (ports, account names, environment variables) belong
in the project's `CLAUDE.md`, never here.

## Moving a screen from the template

| Trap | Step |
| --- | --- |
| `simplix add-page` / `scaffold` run the project's `generated.after` commands (a project puts its design check and typechecks there); they exit non-zero while the tree is half renamed, although the page is written | take the page as written, finish the rename, then run the checks; do not read the exit code of the scaffold as "nothing happened"; a step that fails ends the later steps, so read which one failed |
| A design check that reads a screen's `page.blocks.tsx` refuses a moved screen whose entry still names the removed file | repoint the screen's design entry before scaffolding, then scaffold |
| A deleted generated file leaves its base under `.simplix/generated/`, and `generated --all` keeps a deleted file deleted while it keeps the base | delete the base by absolute path with the file (screen-workflow rule 22) |
| A story merge that fails midway leaves the generated base overwritten with the fresh render; the next merge compares fresh against fresh and keeps the old frame silently | take the base from `git show HEAD:<path>` and merge again; never rerun a failed merge |
| A blocks file equal to its base was read as a stub and deleted although its base had been recorded after the customisation | a stub is a blocks file whose every hook returns `{}`; test the rule on a real stub and on a customised file |
| A page template change makes every moved screen stale at once | stale is the normal state of an edited page; `simplix generated` fails only on a page that did not start from its template; re-scaffold one screen when its own change needs it |
| Hand-editing the menu file after the scaffold leaves the board's console menu red | decide the group and icon in the design entry before scaffolding and pass `--menu-group` and `--menu-icon`; a menu edit made any other way is followed by the board's menu generator |
| A module or entity locale file edited by hand leaves the board's catalogs stale, and copying the file across by hand drifts again | the board's catalog generator writes module and entity catalogs from the packages' own files; run it after the edit and let the board check confirm |
| Board files edited by hand fail the formatter only when it runs from the apps project | the board's check runs the formatter first; fix with the formatter's write mode from the apps project |
| A route path is guessed (`/audit-events` against `/audit-log`) | the entity's plural in kebab case is the default; a path override in `routes.<group>.paths` is written before the scaffold, and only where the menu word differs from the entity's plural |
| A generated list or detail draws a field with a masked twin, or a decrypted personal field | `scaffold.maskedSuffix` makes the generator leave the unmasked field out; a personal field with no masked twin is a backend gap, raised and not drawn |
| A reference column draws the raw id as the name although typecheck, lint and the board agree | the nested record lists every property of its entity and the serializer writes fewer: the name path comes from the entity's declared `nameFields`, not from the field names; `simplix check-screen` fails any other path, and the board's sample rows nest the name |
| The scaffolded form cannot create a record, or its first save is refused | the create body's required fields are all in the table and marked; a required reference needs `scaffold.referencePickers` for its entity; `check-screen` reports each |
| A text field with a long contract is drawn on one line | the kind follows the contract's length (500 and up); where the live Meta states none, refresh the snapshot after the backend rebuilds before writing the kind by hand |
| A list can only be filtered by a user's id | a reference key gets the entity-facet filter (`facet` in `scaffold.referencePickers`), leading the filters; without a configured facet the id filter is left out, not offered |
| A conflict between a template change and a screen's own content | read the printed diff; where the screen is the intended one, `simplix generated --rebase -y --adopt <path>` records the base; where the template change is wanted, take the hunk by hand first |
| The screen draws no description line | the scaffold writes no description key; add `screen.<entity>.description` to the module's `widgets` catalog in every language, and let the board's design check confirm it |
| A probe that finds nothing reports a clean 0 | prove every counting check on a known hit before trusting a 0; a command whose failure is swallowed reports 0 for the wrong reason |

## Regions, figures and filters

- A figure tile that counts rows presses a filter; the list must carry a filter for that field (the
  template adds a faceted one) so the press shows as an active badge and clears from the bar. A
  value a tab forces beats a filter-bar value over the same field: link such a tile to the tab.
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
  type or a labelled-button flag per screen is a second way to draw one region.

## Rendered checks

- Write one product runner that signs a test account in, opens a route, runs the kit's region probe for the page
  type and every rendered audit check (`audit-rendered.mjs --print-all` prints them as JSON for a driver that holds
  a signed-in page), and prints a short result; an agent that writes its own loop per screen re-derives the
  sign-in, the root selector and the board frame's story id each time. The region signature is compared without
  the row count, and a list that draws no rows is reported as not judged.
- The board frame and the live page differ in content (a row count sets a list's height, a record sets a badge's
  variant): control metrics between them are read, the region signature and the audit checks gate.

## Several agents in one checkout

- Commit by pathspec through a private index, and build the commit from the HEAD read at the start
  with a compare-and-swap on the branch; a commit landed meanwhile is otherwise reverted file by
  file (`~/.claude/references/shared-checkout-git.md`). After parallel work read `git show --stat`
  of each commit: only that agent's paths.
- A browser sign-in of a test account replaces the stored session of whoever is signed in at that
  origin in the same browser profile, and the identity provider returns a sign-in only to the origin
  its client registers; the project's reference names that origin and the account script.
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
