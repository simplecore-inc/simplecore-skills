# Screen workflow (invariant #79)

Read this before planning a screen or dispatching agents for screen work.

## Rules

0. **A screen is designed for its purpose before it is scaffolded.** Decide, per screen, the
   persona and the one question they bring to it; whether it shows a description, cards and
   notices, each with its reason (none is a decision too); the list presentation, leading column,
   default sort (never the primary key) and filters; the detail sections in reading order. Write
   the decision where a machine can check it (a design manifest with one entry per routed screen,
   which the project's gate refuses a route without) and draw the board frame from it by hand.
   Two more facts are read before the entry is written. **What the backend offers the entity**
   (list access, default sort, keyword search, status counts, time range counts, export, actions,
   filters) is read with `simplix meta-info <Entity>`: a card, a time range, an export or a search
   box the entity does not offer is a backend or Meta gap to raise, never a region to draw from
   invented data. **Where the screen sits in the menu** (the group and the icon) is part of the
   decision, recorded in the entry as `menu: { group, icon }` and passed to the scaffold as
   `--menu-group` and `--menu-icon`; the board's menu check compares the entry with the product's
   menu.
   **A frame mirrored from the screen's own template is not a design, and agreement against such a
   frame proves nothing**: both sides come from one render, so zero differences says the template
   matches itself. A screen whose page holds only what the template drew while its design asks for
   more (a notice, a figure the template does not draw), or whose list still sorts by its primary
   key, has not been customised.
   - **The gate judges what the page draws, not whether it was edited.** A page laid down whole
     from the template draws the description its catalog states and, where the entity's Meta
     counts, the figure row; a design asking for only those passes before any edit. Notices, and
     figures the template does not draw, need the screen's own code, and a comment naming them
     does not count. A screen not yet customised is listed under the manifest's `acknowledged`
     with its reason, which the gate reports as stale once the page is customised.
   - **The description's catalog key exists before the scaffold runs.** Add
     `screen.<entity>.description` to the module's `widgets` catalog in every locale during step 0.
     A check run through `generated.after` that judges a page reading the key passes only once the
     key exists, so a key added after the scaffold makes the scaffold's first run exit 1 although
     the page is written.
   - Misreading: "the board frame was generated from the same template, so 0 differences was read
     as done".
   - **Description, cards and notices are present by design, never by accident.** A description
     appears where the task is first-time or rare, or a consequence must be understood, in one or
     two sentences in the page header. Cards appear where a state or a sum answers the persona's
     question, and pressing one filters the list. A notice is raised by a state (a limit reached, a
     provider missing, failures above zero), names its action, and sits directly under the cards:
     the page reads header, cards, notices, then the list. The card strip is collapsible to a
     one-line summary, so a persona who knows the figures gives the list the room. Misreading: a
     notice drawn above the cards because it is more urgent; urgency is its tone, not its place.
     The order and the fold belong to the page shell, which already has them: a screen passes
     its cards and notices as data and never composes the strip, the toggle or the order itself.
     Before building a fold, a toggle or a summary row, grep the kit for the one a page already
     uses; a second mechanism beside it is a defect even when it works. Rebuilding a part that exists
     needs a stated reason in its doc comment; when the existing one lacks a behaviour, the
     behaviour is added to it. The screen that already uses the part well is the reference the
     others are made identical to. Each screen type has one template that lays down a complete page of
     that type (header and its description from the screen catalog, figures, notices, tabs, the
     list or the type's body, panels), reused by every screen of that type. A screen starts from
     it and is then edited directly, and a later template change is merged into the edited file
     (rule 2); a blocks file holds a departure worth naming, never the whole screen, and departures
     many screens repeat are counted and lifted into the template.
     The cause of screens that diverge is an empty start: a template that lays down a stub (a file
     of `return {}` hooks) and leaves the author to build the screen from nothing, from a sibling
     or from memory. Misreading:
     forbidding hand edits after generation, or building merge machinery so that every screen can
     be regenerated; the aim is a common start, and a generated file edited by hand is the
     intended life of a screen. A census
     table of every screen with these three columns, as built and as designed, shows the drift.
   - **Invent a part when the purpose calls for one.** A presentation made for the screen's purpose
     (a trend in the header, a gauge, a flow bar, a timeline, a matrix) is preferred over bending
     the screen into the list-and-detail every scaffold gives. The part goes into the kit, generic
     and token-only, with its Storybook template and tests, so the next screen can reuse it.
   - Misreading: "most screens are a list and a detail, so the screens are finished" while the
     description, cards and notices were never decided.
   - **A detail draws each value once, and its notices above its body.** A value that stands in the
     head badge, a head figure, the title, the subtitle or the timeline is not also a section field.
     A section is named for what it adds to the head: one titled with its only field's label, or with
     the entity's own name, adds nothing and is merged into a neighbour or renamed. A head figure
     takes its label from the field it draws (`screen-playbook.md` § Regions, figures and filters).
     Notices stand between the head and the body whether the detail has tabs or not, because a notice
     explains the fields beneath it. The rendered outline compare reads head figure labels, section
     titles and field labels on the screen and on its frame, so a repeat shows in it only as a
     difference from the frame; read the outline for a value drawn twice.
   - **A reason in the entry is a checked fact.** A presentation reason that names a framework limit
     ("the list cannot sort by two keys") is verified against the framework source before it is
     written, and a sentence that states product behaviour ("the oldest credits are used first")
     names the code that does it; a claim with neither is rewritten as what the screen shows. A
     default sort over a column that is null for some rows is tried on the live data: the database
     (PostgreSQL) orders nulls first on a descending sort, so the rows with no value sit above the ones the
     persona came for. Where no sort option places nulls last, the sort names the state column the
     question asks about. A triage list opens on the state its question names (a list of jobs opens
     on the failed ones, not on the routine runs that outnumber them); where the kit has no option
     for it, that is a gap to raise in the kit, not a reason to open on every row.
1. **The steps run in order after step 0.** Template on the kit, then scaffold (which lays down
   the screen and the board frame as starting points), then draw the board frame as the design
   from the step-0 entry, then customise the screen to the frame's design direction. The board is
   the plan and the work runs from the board to the screen. A gap at any step is closed at that
   step's layer, not worked around in a later one.
2. **Customisation is tracked, not forbidden.** A scaffolded file or generated story may be
   edited. The CLI rewrites an untouched file, and merges a template change into an edited one
   three-way against the render it last wrote (kept in `.simplix/generated/`); a conflict is
   reported, never written unless `--write-conflicts` asks for markers. A page is laid down whole by
   its type's template and imports no blocks file. A departure file (`page.blocks.tsx`, written once
   when `scaffold` or `add-page` is given `--blocks`) holds the decisions that belong to one screen
   only, and is not rendered again.
   - `simplix generated` lists every generated file and story as `untouched`, `edited` or `stale`
     (untouched, but the current templates render something else). It fails only for a page file
     (page, crud-page or list-page under `src/pages/<page>/`, or the root layout) that lacks the
     generated marker, that is, a screen that did not start from its template; stale, conflict and
     no-base are reported and fail only under `--check`. Stale is the normal state of an edited
     page after a later template change. Each file records the command that made it after its
     `@simplix-render` fingerprint, which is what lets the report re-render it; a file stamped
     without one is `unchecked`.
   - `simplix generated --all` regenerates every recorded screen and page; an edited file is
     `merged`, `current`, `conflict` (left alone unless `--write-conflicts`) or `no base`, and a
     file deleted on purpose stays deleted (its base is kept). `--check` adds an exit code for
     stale, conflict and no-base files and for an edited file a clean merge would still move;
     `--json` prints the report as data; a path argument narrows any of them to those files or
     directories.
   - An edited file with no base is adopted after a reviewed diff: `simplix generated --adopt
     <path...>` prints the diff between the file and its current render, and records that render as
     the base once a person confirms every difference is a deliberate customisation. `--yes`
     records without asking once the diffs are printed (a run with no terminal needs it); `--rebase`
     also takes a file that already has a base, keeping its content as the intended one and
     declining a template change that conflicts with it. A file with no recorded origin gets one
     where it can be inferred.
   - Every scaffold option that changes the render (`--list-presentation`, `--view-toggle`,
     `--card-title`, `--text-filter`) is recorded in the file's origin, and a regeneration renders
     from the origin alone. A decision made by hand without its flag is invisible to the CLI: an
     untouched file regenerated from the origin (the board story) is drawn without it, and a template
     change over the same lines conflicts with the edited file. Scaffold with the flag. A cards list
     is the exception: its switch follows from `--list-presentation cards`, the origin records no
     `--view-toggle` for it, and the flag is refused beside it.
   - `simplix generated --origin '<command>' <paths>` rewrites the origin of generated files that
     the command renders, for a decision made by hand or recorded before its flag existed. Only
     the stamp line changes, so the files stay as edited and the next regeneration renders the new
     origin and merges it into them. `<command>` is the arguments after `simplix` (for example
     `scaffold <entity> --module <m> --list-presentation cards`); the paths are generated files or
     directories holding them, resolved against the working directory. A path the command does not
     render, or a file without a stamp line, is refused and nothing is written. The option stands
     alone: it takes no `--all`, `--check`, `--share`, `--rebase` or `--yes`.
   - `simplix generated --share` reports per screen the lines in blocks and edited files against
     the generated lines, and lists each customisation a second screen repeats (rule 6).
   - A kit ships `crud-page.stories.hbs` beside `crud-page.hbs`; with `templates.storiesDir` set in
     `simplix.config.ts`, `simplix scaffold` writes the board story from the same context, with
     sample rows, and tracks it like a screen file.
   - A board that already draws the screen under its own name is claimed through
     `templates.story.files` (`{ "<entity>": "<frame>.stories.tsx" }`, keyed by the entity's
     kebab name, or by an `add-page` story's default name). The scaffold then writes to that
     frame instead of laying a second one beside it, and `simplix generated --adopt <frame>` gives
     a hand-drawn frame the render's header and records its base. Two frames for one screen are
     the symptom.
   - A scaffold that routes a list also inserts its menu entry. `routes.<group>.menu.gate`
     (`{ subject: "SUBJECTS.{{entityCamel}}", table: { file: "<subjects file>" } }`) makes that
     entry read the project's subjects table (invariant #52) and adds the key the table lacks with
     the list endpoint's group; without it the gate carries the group as an inline literal.
   - `generated.after` (`[{ cwd, command, onFailure? }]`) runs once after `simplix scaffold`, `simplix add-page`
     and `simplix generated --all`, never for the report. A project sets it to refresh what the
     frames read from the generated files, such as the board's entity catalogs, so a new frame draws
     words instead of raw keys. A failing step skips the later ones and fails the command, unless
     the step states `onFailure: "continue"`: a gate no later step depends on (a design check
     beside the typechecks) states it so the steps after it still run; the command still exits 1
     when any step failed.
   - Regenerate a domain (`simplix meta`) only while the backend answers: the non-base locales
     take their words from the server's translations, and a run against a server that is down
     writes the base locale's words into every locale (the CLI warns `No server translations`).
3. **Existing screens are rewritten, never patched toward the workflow.** Read the old files as a
   list of behaviours to keep: data, filters, columns, actions, confirmations, permissions, copy.
   Re-apply them on the regenerated screen, then delete the old files.
4. **Where a change belongs:**
   - composition and wiring in the template
   - a look or behaviour that more than one screen reuses in the kit
   - behaviour independent of product and design (data, state, accessibility) in the framework
   - contract information the template lacks (field types, enums, permissions, labels) in the
     backend's SimpliX Meta. Start with screens whose backend is ready.
   - Whatever is fixed for one screen is lifted to one of these layers, or to a check, in the same
     change, so a screen created later gets it without a hand edit. The test: scaffold a throwaway
     screen of the same kind (delete it with its generated records, rule 22) and look for the fix
     on it. A fix that appears only after a hand edit has not been lifted.
5. **A requested change is lifted, then swept.** Once it works on the screen it was asked for,
   apply it at the first layer of 4 that owns it, census every screen it reaches, fix each, and
   check each before calling the request done.
6. **The board is the plan; its design direction carries into the screen.** A board frame is
   drawn before the backend exists, so its data (fields, counts, rows, text) differs from the
   screen and need not match. What must agree is the design direction: which regions the page
   has and in what order (description, figure tiles, notices, time range, tabs), the figure kinds,
   the list presentation (table or cards, leading column, default sort, row-action kinds), the
   detail layout (sections, order, header emphasis) and the tokens. The work runs from the board
   to the screen: the story is generated from the story template and customised as a design, the
   screen is generated from the page template, and the story's design decisions are brought into
   it. Compare the two by region signature (which regions and control kinds appear, in what order;
   no text, no counts, no pixels), on a sample of screens rather than on every one; a difference
   is a gap in the template (fixed there) or a deliberate difference with its reason. Beyond the
   signature, compare the computed colours of a status badge that the screen and its frame both
   draw under the same label: a screen with no tone map for its enum draws every badge neutral
   (the record value falls back to `neutral`), and no structural check sees it. Every
   rendered value also belongs to the design's token set; a computed value outside it is a
   defect, found by a rendered check and kept out by a source check on arbitrary values. An item
   customised on a second screen is the signal to lift it.
   - The project keeps one runner for this (sign in, open the route, region probe, every rendered
     audit check, signature against the frame); `screen-playbook.md` § Rendered checks. An agent
     does not write its own loop.
   - `node <plugin>/scripts/compare-rendered.mjs --app <url> --board <url> --root-slot <slot>`
     measures both pages and lists every role property that differs. It refuses (exit 2) when the
     root slot is missing on either side or the two roots carry different `data-design`.
   - `audit-rendered.mjs --check pageLanguageFollowsTheLocale` asserts `<html lang>` names the
     page's language; pass `--options '{"expectLang":"ko"}'` when the locale is known.
7. **The fence is mechanical.** The kit lists the framework parts that screens must not import
   directly (`simplix.fence` in its package.json), and the project lint refuses them.
   `simplix kit-fence` fails when an override of the lint config that holds `no-restricted-imports`
   differs from the kit's list, naming each override by its files; `simplix kit-fence --write`
   copies the list into every such override and keeps the `patterns` each one restricts. The lint
   file is `.oxlintrc.json` unless `--lint <file>` names another. The command needs
   `templates.from` in `simplix.config.ts` and an override that already holds the rule; a config
   that narrows imports per module group carries the fence in each group's override.
   Two more checks belong in the project lint beside it: `simplix cycles` (an import cycle makes
   a hot update reload the whole page) and `simplix meta-removals` (a Meta surface that left the
   snapshot while code still names it); their roots and files are the `checks` keys of
   `simplix.config.ts` (`framework/configuration.md`).
8. **A gap is closed in the generator.** A screen with no page kind or no overridable template
   gets a generic one in the CLI, with tests and no product names. A hand-built screen is the last
   resort, and a comment states why no generator change could serve it.
9. **The shell belongs to the app.** The kit gives the shell parts and a generic `app-shell`
   start. Each app generates it once and owns the result. A page the shell draws in place of
   itself for a refused self read (an identity the server will not let this app act as) is named
   in the root layout's own `refusalPages` (`SHELL_FRAME` of the wide shell, the parts of the
   top-bar shell), error code to page component; both `app-shell` templates return it through the
   kit's `useShellRefusalScreen`. The menu, the brand, the top bar and the account menu live in the
   same file (`useShellParts`) and are edited there; the shell has no blocks file. A root layout
   written by hand calls the same hook with the same map.
10. **The trap.** Hand-composing one screen from kit parts looks equivalent and is faster once.
    It is the drift #67 describes: the next screen copies the hand-built one, not the template.
11. **Every mistake the workflow produces becomes a case below, and a check where a machine can
    see it**, added in the same change, with every instance the check finds fixed.
12. **A focus style that removes the outline keeps one under forced colors.** A tint, a ring or a
    halo is invisible there: backgrounds are replaced and box-shadow is dropped. The framework's
    base stylesheet draws a 2px system-colour outline on every focused element in that mode, and
    declares it important, so a slot or screen that writes `outline-none` for its own look needs no
    second rule. An important outline removal would outrank it, and `audit-frontend.mjs` rule
    `important-outline-removal` refuses one. A keyboard cursor that moves without moving focus (a
    combobox or command item) is matched by the attribute that carries it, in the same base rule.
    The focus halo (`--focus-halo`, a box-shadow) is drawn outside the control, so a part that clips
    either leaves `--focus-gutter` around its content or, when it groups controls against an edge,
    draws the ring inset (`[--focus-halo:var(--focus-halo-inset)]` in its slot style); a control that
    draws no ring takes `focus-visible:shadow-[var(--focus-halo)]` from its slot style. Both tokens
    sit beside `--focus-halo`, and a theme a project generates carries them with it. The kit's
    rendered focus probe (`packages/console-clarity/scripts/focus-clip-rendered.mjs`: `probe` after
    one real Tab key press, `census` by clipping part) runs inside the project's rendered runner and
    reports a ring side an ancestor clips, a ring a sibling paints over and a control that draws the
    browser's default ring. The fix goes into the part the census names, never onto a screen.
    Enforcement: the rendered probe; no source rule judges it, because most `overflow` classes hold
    no focusable control and a source match would flag them all.
13. **The kit typechecks against the framework's built `dist`, the browser runs its `src`.** A
    new framework prop works in the dev server and fails the kit's `tsc` with "Property does not
    exist" until the framework package is rebuilt; rebuild it before a kit typecheck. A framework
    worktree has no `dist`, and an app config that loads a framework plugin from `dist` fails to
    start there: copy `dist` from the main checkout.
    A dev server that sets the `source` resolve condition reads a framework package from source;
    a build is needed only for the tools that read `dist` (type checks, server-render tests). An
    export that names only `dist` (the framework's theme stylesheet) has no `source` entry, so a
    change to it reaches the apps once the framework's build has copied it.
    A kit render test resolves the same `dist`, so a test of a framework change that is not built
    proves nothing about it (a label function reached `aria-label` as a function and was dropped);
    the proof of that behaviour goes in the framework package's own tests.
14. **A slot override is checked in the generated rule, not in the style file.** The merge keeps
    every base utility the override does not name, so an override that adds only a colour keeps
    the base `opacity-30` and its hover state; name both states. A slot that styles its direct
    children (a trigger's `span` as `flow-root`) beats a utility on that child, which then needs
    `!`. An axis a `*.style.ts` declares and its component does not pass is dead silently.
15. **A ref read inside a mount-only effect is read once.** A component that looked up its
    section at mount never observed it when the presentation changed later; observe on change,
    and prove it by switching presentation after a reload.
16. **One CSS custom property name carries one meaning.** An inline variable on a component that
    shared its name with a theme variable at `:root` overrode the theme's value; rename one.
17. **A kit test that reads files needs Node types its package does not have.** Check the
    package's `tsconfig` `include` before adding one: a test outside it is never typechecked, and
    one inside it fails on `node:fs`. The kit has no DOM test environment, so a hook is tested by
    pulling its pure parts out and through `renderToStaticMarkup`.
18. **A script binary is a dependency.** A package script that calls `oxlint` with no package
    declaring it fails with `command not found` on a clean install; declare the binary.
19. **The rendered audit takes the design's options file.** A caller of `snippet()` passes the
    kit's `<design>.audit.json` as the options argument; the script refuses an option name it
    does not know, so a misspelt key stops the run instead of leaving the check on its defaults.
20. **A list's minimum table width is measured, not declared.** A declared width below the drawn
    columns scrolled sideways; the framework list measures the drawn table and raises the tier.
    A width sweep reads after the list's layout animation ends.
21. **Every paged list screen is a generated list page, in every app.** A portal or self-service
    list is `simplix scaffold` over a paged searchable endpoint and then customised, the same as an
    operator list; a list placed by hand inside a static page or a record page (a cursor read, a
    list adapter, or a list hook asked for a page, feeding rows to a table) is a defect. Where the
    backend has no such endpoint, generate it first and force the caller's scope server-side; where
    the entity already has an operator surface, the second surface comes from its own yml whose
    `entity` key names the entity, so its class names, DTOs and tag stay apart. A growing set inside
    a record's tab is `adaptForcedList` on that record's generated detail.
    `paged-list-in-a-page-not-generated-as-a-list` in `audit-frontend.mjs` flags a page directory
    with no generated list page that draws a paged read.
    A customer-facing screen is written for its reader. It words its enums, field labels and
    headings from its own catalog (an enum label written for staff, such as a billing state's
    internal name, is not customer wording), draws no control that serves an operator, and drops what
    the generated detail adds for one: the audit strip (id, created, updated) and the edit and delete
    props. A page that both surfaces share draws staff wording to customers; it is split per
    audience or takes the audience as an input.
22. **A screen is removed with its generated record.** `simplix generated` re-renders every file
    its `.simplix/generated/` record names, so a page or story deleted without its record comes
    back on the next run (`pnpm lint` runs it), with its barrel export. Delete the record in the
    same change, by name.

23. **An install in a worktree writes the framework links at the worktree's depth.** A linked
    framework (`link:` paths in the lockfile) is resolved relative to where `pnpm install` ran, and
    a lockfile committed from a worktree counts as current in the main checkout while it resolves
    nothing there. Run the install that writes the committed lockfile from the main checkout.
    Example: `link:../../../../../../simplix-react/packages/mock` left `@simplix-react/mock` unresolved and no dev server started.
24. **A fence pattern names subpaths.** A `no-restricted-imports` group entry `<scope>/*` refuses
    `<scope>/api` and accepts `<scope>/api/core`, the usual import form. Write `<scope>/**`, and give
    the fence's self-test a hit case for a subpath.
    Example: `@<vendor>/*` let `import { x } from "@<vendor>/api/core"` through.
25. **An unbroken value inside a flex row wraps with `wrap-anywhere`.** `break-words` does not lower
    the min-content width, so a long token in a flex child runs past the edge (and is clipped by a
    dialog). A fit check that passed before such a fix is re-run after it.
    Example: a 40-character id in a detail section body overflowed with `break-words` and wrapped with `wrap-anywhere`.
26. **A moved directory leaves its recorded state behind.** The commands refuse a
    `templates.storiesDir` or a `generated.after[].cwd` that is not an existing directory, naming the
    option and the path it resolved to. The paths they do not read stay silent: after any move or
    rename, check that the template roots resolve and that the recorded bases under
    `.simplix/generated/` sit under paths that still exist (a base whose file moved is the record
    rule 22 deletes).
27. **A generator run is followed by a package and locale check.** After `add-module`, `scaffold` or
    `add-page`, compare the module's `package.json` with a sibling's: dependency versions use the
    workspace `catalog:`, and the module declares the kit and the domain its generated widgets
    import. A page reads `<module>/pages` strings, so the module has a `pages` locale catalogue
    registered in its `locales/index.ts`, and the route that imports the page also imports
    `<module>/locales`, or the strings render as keys. Each such gap is closed in the CLI when found.
    Example: `"react": "^19.2.4"` beside siblings' `"react": "catalog:"`, and a page drawing `pages.title` as its key.
28. **A lint warning in a generated page is a defect.** A warning never fails `pnpm lint`, so a
    template that emits unused variables survives on every screen it renders. Read the warnings of
    a fresh render, and fix the template.
    Example: `const canCreate = useAllowed(undefined) && false` in every read-only crud page.
29. **A template helper set has one source.** A kit test that renders templates registers the CLI's
    Handlebars helpers from the CLI, never a copied list, or a template using a helper the CLI ships
    fails only in the kit test.
    Example: a template using `or` passed in the CLI and failed `tests/template-typecheck.ts`.
30. **Generated hook names are read after a Meta refresh.** SimpliX Meta pluralises an operation
    tag that is already plural; name the tag in the singular in the backend before the frontend
    imports the hook.
    Example: tag `Orders` produced `useGetAllOrderss`.
31. **A command that confirms uses the kit's confirm, one per direction.** Panels in an app use the
    kit's `useActionConfirm` (the board refuses framework imports, so a framework dialog has no
    frame). Its title, description and button words are text or functions of the record the
    question is about, so a verb that flips with the record (grant and revoke, suspend and
    reinstate) takes one confirmation whose words follow the record, not one per direction.
    **An entity verb listed under `actions` in `simplix meta-info <Entity>` is written once, as the
    widget file `actions.tsx`.** It exports `use<Entity>Actions(canAct)` returning
    `{ rowActions, verbs, dialogs }`. A verb whose request carries a required reason opens the
    kit's `ActionDialog` (with the reason as a required field); every other verb confirms through
    `useActionConfirm`. `canAct` is false where the screen only reads (a peek dialog) and the three
    members then come back empty. The detail passes `actions={verbs(record)}` and renders
    `{actions.dialogs}`; the list page spreads `rowActions` into its row actions and renders the
    same `dialogs`. Each verb is disabled with its reason where the record's status or the
    reader's permission refuses it, never hidden. The project's own precedent file is named in its
    new-screen reference.
32. **A whole-project regeneration touches every agent's screens.** `simplix generated --all`
    re-renders every recorded screen in the tree, other agents' uncommitted ones included, and
    `--write-conflicts` writes markers into all of them. In a shared tree run it only when the
    generated files hold your own change, and resolve one conflicting file by hand rather than
    through the project-wide flag. A template change makes every screen rendered from the old
    template stale at once: the author tells whoever has an uncommitted screen to re-scaffold.
    Example: one agent's gate run reported a conflict on another agent's `<entity>.stories.tsx`.
33. **A list's columns are built from the fields the blocks draw.** `contract.columns(...)` over
    every field sums `minTableWidth` for columns that are never drawn, so the later columns never
    appear; pass only the drawn fields.
34. **A clean typecheck is proved from an export beside the checkout.** A `git archive` export in a
    scratch directory breaks the lockfile's relative framework links; extract it as a sibling of the
    checkout (same depth) and include every workspace package it imports.
35. **A Meta refresh takes its translations from a live server.** `simplix meta --offline` still
    reads labels from the meta source's origin, so a run against a stale or wrong server writes its
    labels (English in the Korean slot, say) into every locale. Refresh while the server built from
    your tree answers on the configured origin, and diff the label files before committing. A
    document fetched by hand is unwrapped from its `SimpliXApiResponse` envelope (`body`) before it
    is compared, and two snapshots are compared by name, never by lines.
    Example: a raw curl into `openapi/meta.json` read as 22k changed lines and false removals.
    Example: a refresh that only added one controller's operations read as 7198 inserted and 5714
    deleted lines under the default diff, because the new CRUD block resembles an existing one and
    the default algorithm aligns them as moves; `git diff --diff-algorithm=patience --numstat` read
    1484 inserted and 0 deleted, and the operation id sequences were identical. Read a refresh with
    the patience algorithm, and compare the id sequences, before reporting that operations reshuffled.
36. **A board frame draws every row action the generated page adds.** The list falls back to cards
    when its columns plus the row-action strip outgrow the pane, so a frame without the page's row
    actions draws a table where the app draws cards, and the comparison reports the whole table as
    missing.
37. **A record detail's tabs exist from its first render.** `RecordDetail` fixes its active tab at
    first render, so a blocks file that returns tabs only after the record loads opens on an empty
    pane with no tab active, which `openPaneDrawsNothing` cannot see because no pane is active.
    Return the tab list unconditionally and let each tab draw its own loading state.
38. **A create body field that is a list of records or a nested record has no generated control.**
    The scaffold prints a warning naming it, and `simplix check-screen` fails a form file that never
    names the field. Build it in the form's submit. A list row key (`...Id`) that the create body
    requires and that Meta declares no reference for gets a `check-screen` warning when the list
    file has no column for it (`screen-playbook.md` § Moving a screen from the template).

## Cases

## The app and the design reference ran on different copies of the same kit
- **What happened.** The app consumed the kit through a vendored submodule; the Storybook board
  linked a sibling checkout of the same repository. The two histories had drifted by dozens of
  commits, so screens built "on the same kit" differed from the board in tabs, lists, detail and
  form styles.
- **Why it was missed.** Both imported `@<scope>/<kit>`, so the package name matched and every
  import looked right. The difference lived in which commit each copy held.
- **Prevention.** One kit checkout for the app and the board. When two must exist, a check that
  compares their commits fails the lint. Compare the commits before judging any visual difference
  between app and board.

## A kit change passed in one copy and failed the kit's own design check in the other
- **What happened.** Commits made in the vendored copy put look classes directly on components.
  The vendored copy could not run the kit's design generator, so `design:check` never ran there,
  and the violation surfaced only when the commits were replayed onto the other checkout.
- **Prevention.** A kit commit is made where the kit's full gate runs (`design:css`,
  `design:check`, typecheck, tests). A copy that cannot run the gate is not a place to commit.

## One app used a different kit variant from the rest
- **What happened.** The admin app used the kit's `<design-a>` package while the portal still used
  `<design-b>`. The portal rendered shared modules drawn for `<design-a>` inside a `<design-b>`
  shell.
- **Why it was missed.** Both variants share one core, so nothing failed to compile.
- **Prevention.** Every app declares the same kit package the design reference names (the board's
  `uiKit`), and a check compares them.

## A plan assumed every file a screen needs could be drawn from a template
- **What happened.** The plan put the kit wiring into project templates, then found a file kind
  with no overridable template: it came from the bundled set and carried none of the kit's parts.
- **Prevention.** A feasibility review runs before the plan commits: for every screen, the command
  that generates it and the templates it reads (`.simplix/templates`, then the kit named by
  `templates.from`, then the bundled one). A gap found there is closed in the CLI before any
  screen work starts.

## A rule was invented that the user never set
- **What happened.** "A generated file is never edited outside its blocks" was written into the
  instructions and briefs as if decided. The user's actual rule was that a scaffolded screen is
  customised. Generated files and stories may both be customised, and the CLI tracks them.
- **Why it was easy.** The stricter reading looked like the careful one, and it fitted the
  "generated code is not edited" habit from contract codegen.
- **Prevention.** A workflow rule written into an instruction file quotes or paraphrases what the
  user decided. A constraint the agent adds on its own is proposed to the user, and is not written
  down as settled.

## A reference was measured while it was being rebuilt
- **What happened.** An agent was told to take control metrics from the running app while another
  agent was rebuilding that app's screens and while the app's kit was stale.
- **Prevention.** Metrics come from the design reference (the board), never from a screen under
  change. A brief that names a reference also says who else is changing it.

## Parallel agents mixed their changes into one shared file
- **What happened.** Three agents in one working tree each added entries to the frontend
  lockfile: a new app, a scratch module, and a module dependency. Committing one agent's result
  meant staging a hand-cut hunk.
- **Prevention.** Agents that change dependencies get their own worktree, or one agent owns the
  lockfile. A scratch module is created outside the workspace globs, or removed together with its
  lockfile entries before the agent reports.

## Screens composed the framework's parts by hand instead of the kit's
- **What happened.** Lists and details were assembled directly from the framework's
  `CrudList` and `ListDetail`, so they lacked the kit's list frame and its detail presentations
  and switch.
- **Prevention.** The kit publishes the list of framework parts that screens must not import, and
  the project lint refuses those imports. The count is driven to zero.

## A comparison measured two different designs
- **What happened.** The board was measured in the kit's first design while the app drew another,
  because the board toolbar defaults its design to the first one the kit lists. Every font, height
  and radius came out different, and none of it was a real defect.
- **Prevention.** The board starts in the design the app uses. A comparison records the design
  attribute of both sides and refuses to diff when they differ.

## A metrics round measured the sign-in page
- **What happened.** The session had expired, the app redirected to sign-in, and the script
  measured whatever page was on screen after a fixed wait.
- **Prevention.** A measurement asserts the screen's root slot first. It signs in and retries once
  if the slot is missing, and otherwise writes nothing.
  A shell that draws is not proof of whose session it shows: the run clears tokens that do not name
  its own account before it signs in, and checks the token names that account afterwards.

## Board tokens lost to the kit's own defaults
- **What happened.** The board wrote its design tokens on a bare `:root`. The kit sets the same
  tokens on `:root[data-design=...]`, which outranks it, so the board drew the kit's colours while
  the app, whose theme uses the same selector as the kit, drew the product's.
- **Prevention.** Board and app themes are written under the same selector the kit uses. A check
  compares one token on both sides under the same design.

## The page language never followed the locale
- **What happened.** `<html lang>` stayed `en` on board and app while the copy was Korean.
- **Prevention.** The i18n provider writes `documentElement.lang` on every locale change, and a
  rendered check asserts that it equals the active locale.

## A kit consumed by link resolved its dependencies from its own checkout
- **What happened.** Once the app linked the sibling kit checkout instead of holding it as
  workspace packages, the kit's source resolved its imports from the checkout's own
  `node_modules`: those linked a different framework checkout than the app did, and a stylesheet
  import the kit never declared (`tw-animate-css`) stopped resolving when that install was redone.
- **Prevention.** The kit checkout's install links the same framework checkout as the app
  (`SIMPLIX_FRAMEWORK_PATH`); compare `realpath` of one framework package from both trees. A kit
  declares every package its sources and stylesheets import.

## A checks chain stopped at a known failure before the new checks ran
- **What happened.** `pnpm lint` ran the workspace lint first; it failed on screens awaiting
  regeneration, so the generated-state and fence checks after it never ran.
- **Prevention.** Cheap whole-project checks run first in the chain, the per-package lint last.

## A long-running dev server kept the old build plugin
- **What happened.** A change to the board's Vite plugin (the design-token scoper) had no effect on
  the running Storybook, which kept refusing the new token file with the old error.
- **Prevention.** After changing a build plugin or a dependency's install, restart the dev server
  before reading any result from it.

## A blocks column that redeclares a field loses the contract's marks
- **What happened.** Users' list blocks wrote their own email column, so the code mark the template
  derived from the contract never reached it.
- **Prevention.** A blocks column spreads the generated column and overrides only what the screen
  decides, such as the header or the width. It never redeclares the field.

## An edited generated file froze against later template changes
- **What happened.** The CLI leaves an edited file alone, so the users list and detail missed a
  template improvement, and it had to be added by hand.
- **Prevention.** The CLI keeps each file's last render as a merge base, and carries template
  changes into edited files by a three-way merge. It reports a conflict instead of writing it.

## A hand branch in a generated root layout met the template's own branch
- **What happened.** A root layout generated from `app-shell` was edited by hand to return a page
  for one refusal. When that branch was lifted into the template as a key, regenerating merged the
  hand branch and the template's branch at the same lines and reported a conflict.
- **Prevention.** To lift a hand edit into the template its file came from, write the file back to
  its recorded base (`.simplix/generated/<path>`, once `git diff HEAD -- <path>` shows nothing that
  is not yours), put the hand branch's data in the template's key, then run the file's origin command
  (`add-page <kind> <name> ...`). `generated --all` is the wrong command in a shared checkout: it
  also rewrites every other screen whose template another change touched. The report must read
  untouched for the file afterwards.

## A focus tint was the only focus mark, and forced colors removed it
- **What happened.** The language selector, and every control written the same way, showed
  keyboard focus as a background tint or a box-shadow halo and set `outline-none`. Under Windows
  High Contrast (`forced-colors: active`) backgrounds are replaced and box-shadow is dropped, so
  focus left no mark at all.
- **Why it was missed.** Every control had a focus style, so a source check for "does this slot
  show focus" passed, and a screenshot in the normal palette showed it. Only the forced-colors
  palette removes it, and no test emulated that.
- **Prevention.** One base-stylesheet rule draws the outline on every `:focus-visible` element
  and on the rows that hold a keyboard cursor, important, outside every cascade layer, drawn
  inside the border box. Reach is proved by checking that no declaration in the shipped CSS can
  outrank it (an important outline removal), and in a browser with
  `emulateMedia({ forcedColors: "active" })` by tabbing every stop of several screens and reading
  each computed outline style and width. Read the style as well as the width: Chromium reports a
  width of 1px for `outline-style: none`. A computed outline is not a painted one: an outline
  drawn outside the box is cut off by every ancestor that clips (row action strips, tab lists,
  filter segments, menu rows), so the same sweep also walks each stop's ancestors for an overflow
  that clips the outline.

## A batch save built from the list read
- **What happened.** A settings page built its multi-update bodies from the list read. The list DTO
  does not carry `defaultValue`, the update writes an absent field as null, and the save cleared
  the stored default on every row it touched. Every screen read correctly; the loss showed only in
  the database.
- **Prevention.** An update body starts from that record's edit-form read
  (`get<Entity>ForEdit(id)`) and changes only the edited fields over it, for one record and for a
  batch alike. The rule sits on the side that builds the body, because the backend cannot tell an
  absent field from a null one. `batch-update-built-from-a-list-read` in `audit-frontend.mjs`
  flags a file that reads a list and sends a multi-update or batch update with no edit-form read.

## A portal list was hand-placed inside a static page
- **What happened.** A customer's usage history was built as a static page with a cursor list,
  because the backend served only the desktop app's cursor endpoint. The list had no filters, no
  sort, no total and no pager, and template changes never reached it. The generator could not make
  a second surface over the entity, which already had an operator surface, without colliding on the
  service bean and the DTO names.
- **Prevention.** Rule 21; the generator reads the yml's `entity` key apart from its file name, and
  the audit rule above fails the hand-placed form.

