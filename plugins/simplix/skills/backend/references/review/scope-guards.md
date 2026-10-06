# Scope Guards Reference

What a static rule can judge about a read that takes a workplace, organisation, or tenant identifier from the caller (SKILL.md #20).

> **Scope (canonical):** the design of a static rule over scope guards: why it is comparative, the exclusions it needs, the read side's own vocabulary, and the blind spot it reports as a warning. The rule itself, the javadoc that names the guard, and the requests that verify it are SKILL.md #20. This plugin's audit carries no such rule; a project that wants one writes it in its own gates.

---

## The rule is comparative

**Where a static rule CAN reach a missing scope guard, it is comparative - two neighbours over one subject disagreeing about whether to check.** An absolute rule (「a read taking a scope identifier must check it」) drowns, because whether a given read should be scoped is a product question: a shared catalogue is the installation's and everyone reads all of it. But a class that already narrows one read has imported the range, named it, and decided which axis the subject sits on - so a second read in the same class taking the same kind of identifier and never mentioning it is one decision left half-applied. That rule judges nothing about what is legitimate; it only asks why two neighbours disagree, which is why it can be written at all.

**Its exclusions make the difference between usable and useless**, and each is a false-positive class somebody will otherwise re-derive by widening the rule: overloads (a name-keyed call graph resolves a short form's call to its long form back to the caller itself), controllers (they reach the range through the service by design), and the scope classes themselves (they define the vocabulary rather than call it).

## The read side has its own vocabulary

**Give the read side its own vocabulary rather than the write side's.** A write refuses ONE record, so it always ends at a `require…`; a read far more often BOUNDS A SET and lets the caller's identifier narrow inside it. A rule that inherits the write vocabulary calls every correctly bounded count a defect. And drop any bare `narrow*`-shaped word from the read list: on a write path it is nearly always the range, while on a read path it is routinely a filter resolver, and a class holding one reads as scope-aware while it resolves every value against a caller-named identifier with no range anywhere in the file.

## The blind spot is reported as a warning

**The blind spot ships with the rule, as its own warning.** A rule comparing a class against itself is silent on a class that never heard of scope - and that is where the worst instance lives, because there is no neighbour to disagree with. Report it separately and grade it a warning, since a legitimate class produces the same finding and only a person settles it. Green over the hole the rule cannot see is worse than no rule at all: everybody stops looking.
