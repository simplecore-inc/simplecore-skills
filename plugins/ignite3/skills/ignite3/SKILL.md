---
name: ignite3
description: Use for any Apache Ignite 3 work — SQL (DDL/DML/grammar/data types/functions), Java/JDBC/.NET/C++ client APIs, table/transaction/compute/streaming APIs, cluster/storage/security configuration, CLI/REST tooling. Trigger this skill whenever Ignite 3 is involved even if the user doesn't say "Ignite 3" — e.g. writing or reviewing SQL against an Ignite cluster, designing schemas with distribution zones or colocation, picking data types, calling the Ignite Java client, configuring nodes, or debugging cluster behavior. Ignite 3 SQL and APIs differ significantly from Ignite 2 and from generic ANSI SQL, so consult the bundled references instead of guessing.
---

# Ignite 3 Reference Skill

The `references/` directory contains the full Apache Ignite 3 documentation set (SQL, client APIs, configuration, operations, architecture). Ignite 3 changed enough from Ignite 2 — and from generic SQL — that prior knowledge is unreliable. **Read the references first; do not guess.**

## Operating principles

1. **SQL work** — always open the relevant file under `references/sql/` before writing or reviewing a statement. DDL/DML grammar and data types differ from both Ignite 2 and ANSI SQL.
2. **Client-API work** — open the language-specific API page under `references/api-reference/native-clients/<lang>/` and confirm signatures rather than recalling them.
3. **Cluster/storage/security/monitoring configuration** — start in `references/configure-and-operate/`.
4. **Conceptual gaps** (colocation, distribution zones, MVCC, partitioning, compute) — go to `references/understand/core-concepts/`.

## References map

| Task | Where to start |
|------|----------------|
| **SQL grammar (DDL/DML/transactions)** | `references/sql/reference/language-definition/` (`ddl.mdx`, `dml.mdx`, `grammar-reference.mdx`, `distribution-zones.mdx`, `transactions.mdx`) |
| **SQL data types, functions, operators** | `references/sql/reference/data-types-and-functions/` |
| **Running queries, system views, EXPLAIN** | `references/sql/working-with-sql/`, `references/sql/advanced/`, `references/understand/performance/` |
| **SQL engine architecture** | `references/sql/fundamentals/engine-architecture.md` |
| **SQL conformance / reserved keywords** | `references/sql/reference/sql-conformance/` |
| **Java client API** (table, sql, tx, compute, streamer, catalog, criteria, security, server) | `references/api-reference/native-clients/java/` |
| **JDBC / ODBC / Python connectivity** | `references/api-reference/sql-only-apis/`, `references/develop/connect-to-ignite/` |
| **.NET client** (incl. ADO.NET, LINQ) | `references/api-reference/native-clients/dotnet/` |
| **C++ client** | `references/api-reference/native-clients/cpp/` |
| **Client setup guides (Java / .NET / C++)** | `references/develop/ignite-clients/` |
| **Working with data** (table API, transactions, streaming, compute, code deployment, events, serialization, java-to-tables) | `references/develop/work-with-data/` |
| **Spring Boot / Spring Data integration** | `references/develop/integrate/` |
| **Cluster, node, storage, auth, SSL/TLS, metrics config** | `references/configure-and-operate/configuration/` |
| **Installation** (zip / deb-rpm / Docker / Kubernetes) | `references/configure-and-operate/installation/` |
| **Operations** (colocation, disaster recovery, lifecycle, exception handling) | `references/configure-and-operate/operations/` |
| **Monitoring** (metrics, system views, available metrics) | `references/configure-and-operate/monitoring/` |
| **Configuration reference** (CLI, cluster, node, storage profiles) | `references/configure-and-operate/reference/` |
| **CLI commands / REST API / glossary** | `references/tools/` |
| **Architecture and storage engines** (aimem, aipersist, rocksdb) | `references/understand/architecture/` |
| **Core concepts** (partitioning, colocation, MVCC, compute, tables/schemas) | `references/understand/core-concepts/` |
| **Getting started, best practices, 2→3 and 3.0→3.1 migration** | `references/getting-started/` |

## Workflow

- **Before any Ignite-touching code change** — locate the matching row above and `Read` one or two specific files. The map is wide on purpose so you never have to search.
- **Writing SQL** — open `language-definition/ddl.mdx` or `dml.mdx` and verify exact syntax for `CREATE TABLE`, `PRIMARY KEY` placement, distribution zones, and `COLOCATE BY`. Don't reuse Ignite 2 patterns like `WITH "template=partitioned"` — they no longer apply.
- **Picking a data type** — go straight to `data-types-and-functions/data-types.md`.
- **Calling a Java client API** — read `native-clients/java/<api>.md` for the actual interface; do not invent method names.
- **Cluster failures or exceptions** — `operations/handle-exceptions.md` and `operations/disaster-recovery*.md` first.
- **Migrating from Ignite 2** — `getting-started/migrate-from-ignite-2.md`.

## Notes

- The bundled references are a snapshot of the official Apache Ignite 3 docs. They are self-contained — you don't need to look anything up elsewhere for routine Ignite 3 work.
- When quoting from a reference file, preserve the original wording so users can grep the source.
