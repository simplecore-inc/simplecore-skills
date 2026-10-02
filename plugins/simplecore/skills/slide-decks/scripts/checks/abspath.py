#!/usr/bin/env python3
"""No deck source carries an absolute path.

An absolute path bakes one machine's home directory into a file the repository
keeps, so the deck builds on that machine and nowhere else: a second checkout,
another person's machine or CI resolves nothing and renders the slide with a
hole where the picture was, and nothing fails, because a missing image is not
a layout error.

Read, every one the same way, generated files included:

- the deck's sources as the server holds them: every path attribute
  (`src`, `backgroundPath`, `href`, `fontPath`) and every `<Import src>`, and
  every string value of a JSON source (the deck's build file) that is a path
- the files `checks.abspath.scan` names (globs from the project root), for
  the same attributes and JSON values

Files that are build output must stay out of the repository: a committed one
goes stale the moment its source changes. `checks.abspath.generated` names
them (globs from the project root) and the check fails on any git tracks.

    abspath.py           # the absolute paths, with their files
    abspath.py --list    # every path the deck writes
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from subprocess import SubprocessError
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.config import ConfigError, DeckConfig, parse_jsonc  # noqa: E402
from bidkit.deckread import DeckReader, strip_comments  # noqa: E402

ATTR = re.compile(r'\b(src|backgroundPath|href|fontPath)=(?:"([^"]*)"|\'([^\']*)\')')
# A path is absolute when it starts at the root, at the home directory, or at a drive.
ABS = re.compile(r"^(?:/|~/|[A-Za-z]:[\\/])")
URL = re.compile(r"^[a-z][a-z0-9+.-]*://", re.I)


def json_paths(data, where: str = "") -> list[tuple[str, str]]:
    """(key path, value) for every string value of a JSON document."""
    out = []
    if isinstance(data, dict):
        for k, v in data.items():
            out += json_paths(v, f"{where}.{k}" if where else k)
    elif isinstance(data, list):
        for i, v in enumerate(data):
            out += json_paths(v, f"{where}[{i}]")
    elif isinstance(data, str):
        out.append((where, data))
    return out


def paths_in(name: str, text: str) -> list[tuple[str, str]]:
    """(where, path) for every path a source names."""
    if name.endswith(".json"):
        try:
            data = parse_jsonc(text, name)
        except ConfigError:
            return []
        return [(k, v) for k, v in json_paths(data) if v and not URL.match(v)
                and (ABS.match(v) or "/" in v)]
    body = strip_comments(text)
    return [(attr, a or b) for attr, a, b in ATTR.findall(body)]


def tracked(deck: DeckConfig, globs: list[str]) -> list[str]:
    if not globs:
        return []
    try:
        out = subprocess.run(["git", "ls-files", "--", *globs], cwd=deck.root,
                             capture_output=True, text=True, timeout=60)
    except (OSError, SubprocessError) as e:
        raise ConfigError(f"git could not list the tracked files under {deck.root}: {e}") from e
    if out.returncode != 0:
        raise ConfigError(f"git ls-files failed in {deck.root}: {out.stderr.strip()}")
    return out.stdout.split()


def find(reader: DeckReader, deck: DeckConfig) -> tuple[list[tuple[str, str, str]], list[str], int]:
    """([(file, where, path)] every path, [tracked generated files], files read)."""
    cfg = deck.section("checks.abspath")
    sources: list[tuple[str, str]] = [(p, t) for p, t in reader.markup().items()
                                      if not p.startswith("kit:")]
    for pattern in cfg.get("scan", []):
        for path in sorted(deck.root.glob(pattern)):
            if path.is_file():
                sources.append((str(path.relative_to(deck.root)), path.read_text(encoding="utf-8")))
    out = []
    for name, text in sources:
        out += [(name, where, value) for where, value in paths_in(name, text)]
    return out, tracked(deck, list(cfg.get("generated", []))), len(sources)


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    ap = cli.parser(__doc__.splitlines()[0])
    ap.add_argument("--list", action="store_true", help="print every path the deck writes")
    args = ap.parse_args(argv)
    deck = cli.deck_config(args)
    with cli.open_reader(deck) as reader:
        paths, committed, files = find(reader, deck)
    bad = [(n, w, v) for n, w, v in paths if ABS.match(v)]
    if args.list:
        for name, where, value in paths:
            print(f"{'✖' if ABS.match(value) else ' '} {name} {where}: {value}")
    print(f"abspath: {files} files, {len(paths)} paths, {len(bad)} absolute, "
          f"{len(committed)} generated files tracked")
    if not args.list:
        for name, where, value in bad:
            print(f"  ✖ {name} {where}: {value}")
    for name in committed:
        print(f"  ✖ {name}: build output tracked by git; ignore it and remove it from the index")
    return 1 if bad or committed else 0


if __name__ == "__main__":
    sys.exit(main())
