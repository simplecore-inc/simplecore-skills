# Screen workflow (invariant #79)

Read this before planning a screen or dispatching agents for screen work.

## Rules

1. **Four steps, in order.** Template on the kit, then scaffold, then customise to the board, then
   bring the board into agreement. A gap at any step is closed at that step's layer, not worked
   around in a later one.
2. **Customisation is tracked, not forbidden.** A scaffolded file or generated story may be
   edited. The CLI rewrites a generated file only while it is untouched, and the generated-state
   report lists every edited one, so a template change is reviewed against each instead of being
   skipped. Block files hold the decisions that belong to one screen only.
3. **Existing screens are rewritten, never patched toward the workflow.** Read the old files as a
   list of behaviours to keep: data, filters, columns, actions, confirmations, permissions, copy.
   Re-apply them on the regenerated screen, then delete the old files.
4. **Where a change belongs:**
   - composition and wiring in the template
   - a look or behaviour that more than one screen reuses in the kit
   - behaviour independent of product and design (data, state, accessibility) in the framework
   - contract information the template lacks (field types, enums, permissions, labels) in the
     backend's SimpliX Meta. Start with screens whose backend is ready.
5. **A requested change is lifted, then swept.** Once it works on the screen it was asked for,
   apply it at the first layer of 4 that owns it, census every screen it reaches, fix each, and
   check each before calling the request done.
6. **Agreement is measured.** Compare app screen and board frame by rendered metrics per control
   role (height, gap, radius, font, variant). Report how much of each screen stays customised. An
   item customised on a second screen is the signal to lift it.
7. **The fence is mechanical.** The kit lists the framework parts that screens must not import
   directly, and the project lint refuses them.
8. **A gap is closed in the generator.** A screen with no page kind or no overridable template
   gets a generic one in the CLI, with tests and no product names. A hand-built screen is the last
   resort, and a comment states why no generator change could serve it.
9. **The shell belongs to the app.** The kit gives the shell parts and a generic `app-shell`
   start. Each app generates it once and owns the result.
10. **The trap.** Hand-composing one screen from kit parts looks equivalent and is faster once.
    It is the drift #67 describes: the next screen copies the hand-built one, not the template.
11. **Every mistake the workflow produces becomes a case below, and a check where a machine can
    see it**, added in the same change, with every instance the check finds fixed.

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

## Only page templates could be overridden, found after the plan assumed all could
- **What happened.** The plan put the kit wiring into project templates, then discovered the CLI
  let a project take over page templates only. List, detail and form widgets always came from the
  bundled set.
- **Prevention.** Step 0.4 runs a feasibility review first: for every screen, the command that
  generates it and the templates it reads. A gap found there is closed in the CLI before any
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

## Two screens composed the framework's parts by hand instead of the kit's
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
