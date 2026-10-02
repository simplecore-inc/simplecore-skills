#!/usr/bin/env python3
"""A generated file that somebody edited by hand, or a generator nobody re-ran.

Some page files and manuscripts are written by a generator, and each says so in
its opening comment by naming the generator's path. Nothing stops a hand edit:
the page renders, every check passes, and the next regeneration deletes the
work without a word. The reverse is as quiet: a generator patched and never run
leaves the deck printing the old page while the source says otherwise.

So both sides are recorded right after a regeneration (`--bless`) and compared
afterwards: the file's digest and its generator's. The check never runs a
generator, because a check that writes files is not a check.

Read: the deck's own sources as the server holds them (the model may be ahead
of the disk), and the files `checks.generated.scan` names (globs from the
project root) from disk. A file is generated when its first `head` characters
name a path the `checks.generated.generator` pattern matches.

Record: `<checks.baselines>/generated.json`, `{file: {generator, output, source}}`.

Config (`checks.generated`): `generator` (required: a pattern over the
project's generator paths), `scan` (globs), `head` (400).
"""
from __future__ import annotations

import hashlib
import json
import re
from json import JSONDecodeError
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.config import ConfigError, DeckConfig  # noqa: E402
from bidkit.deckread import DeckReader  # noqa: E402

HEAD = 400


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()[:16]


def generated(reader: DeckReader, deck: DeckConfig) -> dict[str, dict]:
    """{file: {generator, output, source}} for every file whose opening names a generator."""
    cfg = deck.section("checks.generated")
    pattern = cfg.get("generator")
    if not pattern:
        raise ConfigError(f"deck `{deck.name}` declares no `checks.generated.generator`: the pattern a "
                          "generated file's opening comment names its generator with")
    gen = re.compile(pattern)
    head = int(cfg.get("head", HEAD))
    deck_rel = deck.dir.relative_to(deck.root) if deck.dir.is_relative_to(deck.root) else deck.dir
    files: list[tuple[str, bytes]] = [(str(Path(deck_rel) / p), t.encode("utf-8"))
                                      for p, t in reader.markup().items() if not p.startswith("kit:")]
    seen = {name for name, _ in files}
    for glob in cfg.get("scan", []):
        for path in sorted(deck.root.glob(glob)):
            rel = str(path.relative_to(deck.root))
            if path.is_file() and rel not in seen:
                files.append((rel, path.read_bytes()))
                seen.add(rel)
    out = {}
    for name, data in files:
        m = gen.search(data[:head * 4].decode("utf-8", errors="ignore")[:head])
        if not m:
            continue
        source = deck.root / m.group(0)
        out[name] = {"generator": m.group(0), "output": digest(data),
                     "source": digest(source.read_bytes()) if source.is_file() else ""}
    return out


def compare(now: dict, was: dict) -> list[tuple[str, str]]:
    out = []
    for name, cur in now.items():
        old = was.get(name)
        if old is None:
            out.append((name, f"not in the record; regenerate with {cur['generator']} and --bless"))
        elif old.get("output") != cur["output"]:
            out.append((name, f"differs from the record: edited by hand, or regenerated and not "
                              f"recorded ({cur['generator']})"))
        elif old.get("source") != cur["source"]:
            out.append((name, f"its generator {cur['generator']} changed and the file did not: "
                              "not regenerated"))
    out += [(name, "in the record and gone") for name in sorted(set(was) - set(now))]
    return out


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    args = cli.parser(__doc__.splitlines()[0], bless=True).parse_args(argv)
    deck = cli.deck_config(args)
    record = deck.path("checks.baselines", "the directory the checks' records live in") / "generated.json"
    with cli.open_reader(deck) as reader:
        now = generated(reader, deck)
    if args.bless:
        record.write_text(json.dumps(now, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
                          encoding="utf-8")
        print(f"generated: recorded {len(now)} generated files in {record}")
        return 0
    try:
        was = json.loads(record.read_text(encoding="utf-8")) if record.exists() else {}
    except JSONDecodeError as e:
        raise ConfigError(f"{record}: not valid JSON: {e}") from e
    bad = compare(now, was)
    print(f"generated: {len(now)} generated files tracked, {len(bad)} disagree with the record")
    for name, why in bad:
        print(f"  ✖ {name}: {why}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
