# Precedent-First

How customization and hand-authored surfaces are cloned from a same-shape precedent.

> **Scope (canonical):** the procedure behind SKILL.md #19. The generator fixes the CRUD shape (#15, #17); this file covers everything past it.

---

## #19 Precedent-first

Enforcement: review - whether two surfaces are the same shape, and whether a divergence is justified by the domain, is a judgment about meaning that no pattern in the Java source can make.

**Precedent-first for everything past the generator - customization and hand-authored surfaces are cloned from the newest same-shape precedent, never designed from memory.** The generator fixes the CRUD shape (#15/#17); this invariant fixes everything the generator does not: trimming a generated controller into an action/read surface, adding lifecycle endpoints, a self-scoped searchable, a readiness/preview endpoint, an aggregation/report controller, an approval-flow integration, an SSE/activity channel. Before writing one, locate TWO precedent surfaces of the same shape in this codebase (grep the pattern: `@SimpliXStandardApi` non-CRUD controllers, forced-scope `search(params)` overrides, existing `/{id}/<action>` groups), prefer the most recently modified, read them end to end (controller + service + DTOs + messages), and clone their structure - naming, error keys, permission mapping, DTO roles, test shape. Divergence is justified only by a domain difference; a precedent that violates an invariant is fixed or flagged, never copied. The completion report names both precedent classes and every justified divergence. This mirrors the frontend skill's invariant #51 - the two ends of one contract must drift-proof the same way.
