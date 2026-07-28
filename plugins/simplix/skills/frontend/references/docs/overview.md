> **DOCUMENT** (cross-cutting) category reference inside this skill. Loaded whenever the task produces or modifies any documentation surface — README, TSDoc on public exports, tutorials, how-to guides, reference docs, explanations, CONTRIBUTING, CHANGELOG, or any `*.md` artifact. Sibling files: `document-templates.md`, `tsdoc-patterns.md`, `quality-checklist.md`.

# simplix-react Documentation Guidelines (DOCUMENT overview)

Principle: "Define once, derive everything" — applies to documentation too.

## Document Classification (Diataxis)

Classify every document into exactly ONE type. Never mix types.

| Type | Reader State | Purpose | Example |
| --- | --- | --- | --- |
| **Tutorial** | Learning | Step-by-step success experience | "Build a Project Manager" |
| **How-to Guide** | Working | Solve specific problem | "Add parent-child entities" |
| **Reference** | Looking up | Precise API info | `defineApi()` signature |
| **Explanation** | Understanding | Architecture/design intent | "Contract Derivation internals" |

## Workflow

1. **Identify document type** → select template from [document-templates.md](document-templates.md)
2. **Write content** following style rules below
3. **For TSDoc** → follow patterns in [tsdoc-patterns.md](tsdoc-patterns.md)
4. **Validate** using [quality-checklist.md](quality-checklist.md)

## Terminology (strict — no synonyms)

| Official Term | DO NOT use |
| --- | --- |
| contract | schema definition, API definition, spec |
| entity | model, resource, table |
| operation | action, procedure, endpoint |
| derive | generate, create, produce |
| hook | query hook, mutation hook (only when specifying) |
| mock handler | fake handler, stub, interceptor |

## Writing Style

- **2nd person**: "You define a contract" not "The developer defines a contract"
- **Result first, mechanism later**: "Generates type-safe hooks for all entities" not "Iterates config.entities and..."
- **Active voice**: "defineApi returns a client" not "A client is returned by defineApi"
- **No colloquial language**: Formal but approachable

## Language Policy

| Target | Language |
| --- | --- |
| README.md (root + packages) | English |
| docs/ documents | English |
| TSDoc comments | English |
| Inline code comments | English |
| CONTRIBUTING.md, CHANGELOG.md | English |
| Internal docs (CLAUDE.md, .plans/) | Korean |

## Markdown Rules

- Blank line required between headings and tables
- Language tag required on all code blocks (`ts`, `tsx`, `bash`, `json`)
- Use allowed symbols only (no emojis): ✔ ✖ ⚠ ℹ → ← etc.
- Relative paths for links (`./guides/parent-child.md`)
- Left-align table headers by default

## Cross-Package Navigation

- Tutorials show the full pipeline (contract → react → mock), never split by package
- Only API Reference is split by package
- Each package doc has "Prerequisites" at top and "Next Step" at bottom:

```markdown
> **Prerequisites:** This package requires a contract defined with `@simplix-react/contract`.
> See [Defining Contracts](../contract/README.md) first.
```

```markdown
> **Next Step:** Pass this contract to `deriveEntityHooks()` from `@simplix-react/react`.
> See [Deriving Hooks](../react/README.md).
```

## Diagrams

1. Write Mermaid syntax first
2. Convert with `mermaid-to-ascii` agent
3. Preserve Mermaid source as HTML comment above the ASCII diagram

## References

- **Templates for each document type**: [document-templates.md](document-templates.md)
- **TSDoc patterns and priority**: [tsdoc-patterns.md](tsdoc-patterns.md)
- **Quality checklists and code example standards**: [quality-checklist.md](quality-checklist.md)
