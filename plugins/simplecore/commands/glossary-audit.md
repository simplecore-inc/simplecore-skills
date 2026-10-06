---
description: Run the Korean audit sweep - glossary words, sentence rules, style smells, resources - and drive it to zero errors
argument-hint: "[paths...] [--all] [--strict] [--untranslated] [--explain]"
---

# Glossary Audit

Invoke the `simplecore:korean-docs` skill and carry out its **The audit** section for this request,
running the sweep with the user's arguments:

`node "${CLAUDE_PLUGIN_ROOT}/skills/korean-docs/scripts/l10n.mjs" sweep $ARGUMENTS`

The skill owns the procedure: which glossary is in force (with none, the base glossary alone, and no
offer to create one), reading the sweep's closing line and every lens candidate it lists, fixing
each finding before reporting, the in-order reading in
`${CLAUDE_PLUGIN_ROOT}/skills/korean-docs/references/ui-copy-sweep.md`, and the term-decision section
of the completion report. The flags and exit codes are in
`${CLAUDE_PLUGIN_ROOT}/skills/korean-docs/references/audit-tooling.md`.
