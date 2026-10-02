#!/usr/bin/env python3
"""Run the checks a deck declares; the declaration is the only list.

A check list written in several places is several lists: a build script, a
package script and the declaration drift apart, and a check that only runs
when somebody types its name prints no zero in a round nobody typed it, which
reads exactly like a round in which it passed. So the lists are read from the
deck's `checks.preflight` and `checks.after` in `.claude/slide-decks.json`,
and from nowhere else.

    check.py preflight [--deck NAME]   # before the build; a failure stops it
    check.py after [--deck NAME]       # after every render
    check.py run NAME... [--deck NAME] # named checks, resolved the same way
    check.py list [--deck NAME]        # what is declared and where each resolves
    check.py undeclared [--deck NAME]  # local scripts no list names and no reason excuses

A phase is either a list of check names or a map of name -> command. A name
(or a map entry whose command is empty) resolves to `<checks.local>/<name>.py`
first, then to the shared check of that name under this skill's
`scripts/checks/` or proposal-writing's `scripts/`. A map entry with a command
runs that command from the project root, as declared.

Every check is run from the project root with `SLIDE_DECK` set to the deck's
name, and is timed. A declared name that resolves to nothing fails; a check
that prints nothing is reported, because silence cannot be told from a pass.
"""
from __future__ import annotations

import os
import subprocess
import sys
import time
from argparse import ArgumentParser
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[3] / "scripts"
sys.path.insert(0, str(SCRIPTS))
from bidkit.config import DECK_ENV, ConfigError, DeckConfig, Project  # noqa: E402

SKILLS = Path(__file__).resolve().parents[2]
SHARED_DIRS = [SKILLS / "slide-decks" / "scripts" / "checks", SKILLS / "proposal-writing" / "scripts"]
PHASES = ("preflight", "after")


def _is_check(path: Path) -> bool:
    return path.suffix == ".py" and not path.name.startswith(("_", "test_"))


def shared_checks() -> dict[str, Path]:
    out: dict[str, Path] = {}
    for d in SHARED_DIRS:
        for p in sorted(d.glob("*.py")) if d.is_dir() else []:
            if _is_check(p):
                out.setdefault(p.stem, p)
    return out


def local_dir(deck: DeckConfig) -> Path | None:
    if not deck.has("checks.local"):
        return None
    return deck.path("checks.local", "the directory of the project's own checks")


def declared(deck: DeckConfig, phase: str) -> list[tuple[str, str | None]]:
    """[(name, command or None)] for one phase."""
    value = deck.require(f"checks.{phase}", f"the {phase} check group")
    if isinstance(value, list):
        if not all(isinstance(n, str) for n in value):
            raise ConfigError(f"deck `{deck.name}` `checks.{phase}` must list check names")
        return [(n, None) for n in value]
    if isinstance(value, dict):
        out = []
        for name, cmd in value.items():
            if cmd is not None and not isinstance(cmd, str):
                raise ConfigError(f"deck `{deck.name}` `checks.{phase}.{name}` must be a command or empty")
            out.append((name, cmd or None))
        return out
    raise ConfigError(f"deck `{deck.name}` `checks.{phase}` must be a list of names or a map of name -> command")


def resolve(deck: DeckConfig, name: str, command: str | None) -> tuple[str, list[str] | str] | None:
    """('command', shell line) | ('local'|'shared', argv) | None."""
    if command:
        return "command", command
    local = local_dir(deck)
    if local is not None and (local / f"{name}.py").is_file():
        return "local", [sys.executable, str(local / f"{name}.py")]
    shared = shared_checks().get(name)
    if shared is not None:
        return "shared", [sys.executable, str(shared), "--deck", deck.name]
    return None


def excluded(deck: DeckConfig) -> dict[str, str]:
    table = deck.get("checks.excluded", {}) or {}
    if not isinstance(table, dict) or not all(isinstance(v, str) for v in table.values()):
        raise ConfigError(f"deck `{deck.name}` `checks.excluded` must map a script name to its reason")
    blank = [k for k, v in table.items() if not v.strip()]
    if blank:
        raise ConfigError(f"deck `{deck.name}` `checks.excluded` gives no reason for: {', '.join(blank)}")
    return table


def run_checks(deck: DeckConfig, items: list[tuple[str, str | None]], title: str) -> int:
    env = {**os.environ, DECK_ENV: deck.name,
           "PYTHONPATH": os.pathsep.join(filter(None, [str(SCRIPTS), os.environ.get("PYTHONPATH")]))}
    failed: list[str] = []
    times: list[tuple[float, str]] = []
    for name, command in items:
        target = resolve(deck, name, command)
        if target is None:
            print(f"  ✖ {name}: no {name}.py under checks.local and no shared check of that name; "
                  "remove it from the declaration or write the check")
            failed.append(name)
            continue
        kind, argv = target
        start = time.monotonic()
        result = subprocess.run(argv, shell=isinstance(argv, str), cwd=deck.root, env=env,
                                capture_output=True, text=True)
        elapsed = time.monotonic() - start
        times.append((elapsed, name))
        out, err = (result.stdout or "").rstrip(), (result.stderr or "").rstrip()
        print(f"▶ {name} ({kind}, {elapsed:.1f}s, exit {result.returncode})")
        if out:
            print(out)
        # stderr is printed whatever the exit code: a check that writes its
        # findings there and exits 0 would otherwise leave no mark.
        if err:
            print(err)
        if not out and not err:
            print(f"  ⚠ {name} printed nothing; a check states what it read and what it found")
        if result.returncode != 0:
            failed.append(name)
    longest = max(times) if times else None
    tail = f" · longest {longest[1]} {longest[0]:.1f}s" if longest else ""
    print(f"{title}: {len(items)} checks · failed {len(failed)}"
          + (f" ({', '.join(failed)})" if failed else "") + tail)
    return 1 if failed else 0


def undeclared(deck: DeckConfig) -> tuple[list[str], list[str]]:
    """(local scripts no phase names and no exclusion excuses, exclusions naming no script)."""
    local = local_dir(deck)
    named = {n for phase in PHASES if deck.has(f"checks.{phase}") for n, _ in declared(deck, phase)}
    skip = excluded(deck)
    scripts = {p.stem for p in local.glob("*.py") if _is_check(p)} if local else set()
    loose = sorted(scripts - named - set(skip))
    dead = sorted(n for n in skip if n not in scripts and n not in shared_checks())
    return loose, dead


def list_checks(deck: DeckConfig) -> int:
    for phase in PHASES:
        if not deck.has(f"checks.{phase}"):
            print(f"{phase}: not declared")
            continue
        print(f"{phase}:")
        for name, command in declared(deck, phase):
            target = resolve(deck, name, command)
            where = "UNRESOLVED" if target is None else (
                f"command: {target[1]}" if target[0] == "command" else f"{target[0]}: {target[1][1]}")
            print(f"  {name} -> {where}")
    for name, why in excluded(deck).items():
        print(f"excluded: {name}: {why}")
    named = {n for phase in PHASES if deck.has(f"checks.{phase}") for n, _ in declared(deck, phase)}
    unused = sorted(set(shared_checks()) - named)
    if unused:
        print("shared checks this deck does not declare: " + ", ".join(unused))
    return report_undeclared(deck)


def report_undeclared(deck: DeckConfig) -> int:
    loose, dead = undeclared(deck)
    if loose:
        print(f"✖ local scripts no list declares: {', '.join(loose)}; declare each in a phase, "
              "or name it in checks.excluded with the reason it does not run")
    if dead:
        print(f"✖ exclusions naming no script: {', '.join(dead)}; remove them from checks.excluded")
    if not loose and not dead:
        print("undeclared: every local script is declared or excluded with a reason")
    return 1 if loose or dead else 0


def main(argv: list[str] | None = None) -> int:
    ap = ArgumentParser(description="Run the checks a deck declares in .claude/slide-decks.json.")
    ap.add_argument("command", choices=["preflight", "after", "run", "list", "undeclared"])
    ap.add_argument("names", nargs="*", help="check names, for `run`")
    ap.add_argument("--deck", help="the deck's name in .claude/slide-decks.json")
    args = ap.parse_args(argv)
    try:
        deck = Project.load().deck(args.deck)
        if args.command in PHASES:
            if args.names:
                ap.error(f"{args.command} takes no check names; use `run`")
            return run_checks(deck, declared(deck, args.command), args.command)
        if args.command == "run":
            if not args.names:
                ap.error("run needs at least one check name")
            commands = {n: c for phase in PHASES if deck.has(f"checks.{phase}")
                        for n, c in declared(deck, phase)}
            return run_checks(deck, [(n, commands.get(n)) for n in args.names], "run")
        if args.command == "list":
            return list_checks(deck)
        return report_undeclared(deck)
    except ConfigError as e:
        print(f"✖ {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
