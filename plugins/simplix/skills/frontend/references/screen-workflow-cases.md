# Screen workflow: cases behind invariant #79

Read this before planning a screen through the template, scaffold, customise and board steps,
and before dispatching agents to do it. Each case names what went wrong, why it was easy to miss,
and the check that now prevents it. Add a case whenever the workflow produces a mistake.

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
