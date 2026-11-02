# Scope Guards Reference

What a static rule can judge about a read that takes a workplace, organisation, or tenant identifier from the caller (SKILL.md #20).

> **Scope (canonical):** the design of a static rule over scope guards: why it is comparative, the exclusions it needs, the read side's own vocabulary, and the blind spot it reports as a warning. The rule and the javadoc that names the guard are SKILL.md #20; the requests that verify it are in § #20 below. This plugin's audit carries no such rule; a project that wants one writes it in its own gates.

---

## The rule is comparative

**Where a static rule CAN reach a missing scope guard, it is comparative - two neighbours over one subject disagreeing about whether to check.** An absolute rule (「a read taking a scope identifier must check it」) drowns, because whether a given read should be scoped is a product question: a shared catalogue is the installation's and everyone reads all of it. But a class that already narrows one read has imported the range, named it, and decided which axis the subject sits on - so a second read in the same class taking the same kind of identifier and never mentioning it is one decision left half-applied. That rule judges nothing about what is legitimate; it only asks why two neighbours disagree, which is why it can be written at all.

**Its exclusions make the difference between usable and useless**, and each is a false-positive class somebody will otherwise re-derive by widening the rule: overloads (a name-keyed call graph resolves a short form's call to its long form back to the caller itself), controllers (they reach the range through the service by design), and the scope classes themselves (they define the vocabulary rather than call it).

## The read side has its own vocabulary

**Give the read side its own vocabulary rather than the write side's.** A write refuses ONE record, so it always ends at a `require…`; a read far more often BOUNDS A SET and lets the caller's identifier narrow inside it. A rule that inherits the write vocabulary calls every correctly bounded count a defect. And drop any bare `narrow*`-shaped word from the read list: on a write path it is nearly always the range, while on a read path it is routinely a filter resolver, and a class holding one reads as scope-aware while it resolves every value against a caller-named identifier with no range anywhere in the file.

## The blind spot is reported as a warning

**The blind spot ships with the rule, as its own warning.** A rule comparing a class against itself is silent on a class that never heard of scope - and that is where the worst instance lives, because there is no neighbour to disagree with. Report it separately and grade it a warning, since a legitimate class produces the same finding and only a person settles it. Green over the hole the rule cannot see is worse than no rule at all: everybody stops looking.

---

## #20 Verification and what a count leaks

Enforcement: review - the guard is usually a helper call one or two frames down, so a regex over the method body is all false positives; the check is a request per endpoint from a scoped account, and the audit enumerates nothing for it.

**The second half is the half that pays.** This defect is an ABSENCE - a guard line missing where nothing marks its place - so it is invisible to any audit script, and its neighbours make it worse rather than better: a guarded method and an unguarded one over the same subject are identical in signature, annotations, and repository calls, differing only in a line that is not there. Naming the guard in the javadoc (`the workplace is judged by {@code requireVisible} before anything is read`, or `scoped through {@code range()}`) is what makes a reviewer able to see the absence, and it costs one line. Where the method is deliberately installation-wide, say so in the same place with the reason - a bare absence and a considered exemption must not read the same.

**Verify it with a request, not a rule.** The guard is usually one or two frames down a private helper, so a regex over the method body has a false-positive rate that makes it useless, and following the calls is a call-graph analysis with the same floor. But the ENUMERATOR is exact where the guard is not: `@RequestParam … String <scopeField>` on a controller method is lexically obvious and mechanically complete. So list the endpoints mechanically and ask each one with real requests from a scoped account - the answer is unambiguous in a way no source read is. **Assert both directions**: an out-of-scope value is refused AND an in-scope value is answered, because a suite proving only the refusal passes a build whose guard refuses everybody, and the next person "fixes" that by deleting the check. Where a surface narrows within an already-bounded set instead of refusing, assert that its answer for an out-of-scope value is identical to its answer for a value that does not exist - and that an in-scope value differs from it, or the assertion is also satisfied by an endpoint that ignores the parameter.

**A count leaks as much as a record.** Judge by what the answer tells the caller, not by whether entities cross the boundary: 「220 people are registered at that workplace」 is information about a workplace the caller was not granted, and no list-scoping test on any screen will ever see it. The figure that hides longest is the one on a tile whose neighbours are all correctly narrowed - a number right in five places and wrong in the sixth reads as a scoped screen.
