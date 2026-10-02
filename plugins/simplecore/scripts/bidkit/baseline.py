"""A check's baseline: findings retired by a judgement, each with its reason.

A finding retired on the strength of having been seen turns a check into a
record of what somebody once looked at, so every entry carries the reason it
was retired, and an entry whose reason is blank still fails. Retiring
(`--bless`) writes today's findings with a blank reason, keeping the reason of
an entry that is unchanged, so the reason has to be typed before the check
goes quiet.

File: `<checks.baselines>/<check>.json`, an object of `finding: entry`:

    "finding": "reason"                                  a judged finding
    "finding": {"reason": "...", "measure": 0.71}        judged at this measure
    "finding": ""                                        retired, reason still owed: fails
    "finding": null  /  {"measure": 0.71}                legacy, predates the rule: retired

Entries that predate the reason rule are grandfathered: a top-level list of
findings, a bare measure (`"finding": 0.71`, `"finding": ["1", "8"]`), and an
object without a reason. They stay retired while their measure is unchanged,
and only a new or changed finding demands a reason. A check whose legacy file
used another key shape passes `migrate` to translate each raw entry.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from .config import ConfigError, DeckConfig

LIVE = "live"                # not in the baseline, or its measure changed
RETIRED = "retired"          # judged, with a reason, or grandfathered
UNREASONED = "unreasoned"    # retired with a blank reason: still fails

_NO_MEASURE = object()


def _canon(value: Any) -> Any:
    """A measure as JSON would store it, so a tuple and a list compare equal."""
    return json.loads(json.dumps(value, ensure_ascii=False, sort_keys=True))


@dataclass
class Entry:
    reason: str | None                 # None: a legacy entry, grandfathered
    measure: Any = _NO_MEASURE

    @property
    def has_measure(self) -> bool:
        return self.measure is not _NO_MEASURE

    def to_json(self) -> Any:
        if not self.has_measure:
            return self.reason
        if self.reason is None:
            return {"measure": self.measure}
        return {"reason": self.reason, "measure": self.measure}


def parse_entry(value: Any) -> Entry:
    if value is None:
        return Entry(None)
    if isinstance(value, str):
        return Entry(value)
    if isinstance(value, dict):
        reason = value.get("reason", value.get("사유"))
        if reason is not None and not isinstance(reason, str):
            raise ConfigError(f"a baseline reason must be a string, not {reason!r}")
        if "measure" in value:
            return Entry(reason, _canon(value["measure"]))
        if "값" in value:
            return Entry(reason, _canon(value["값"]))
        return Entry(reason)
    # A bare number or list: a legacy measure with no reason.
    return Entry(None, _canon(value))


Migrate = Callable[[str, Any], "tuple[str, Entry] | None"]


class Baseline:
    def __init__(self, path: Path, entries: dict[str, Entry]):
        self.path = path
        self.entries = entries

    @classmethod
    def load(cls, path: Path, migrate: Migrate | None = None) -> "Baseline":
        if not path.exists():
            return cls(path, {})
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            raise ConfigError(f"{path}: not valid JSON: {e}") from e
        items: list[tuple[str, Any]]
        if isinstance(raw, list):
            items = [(str(k), None) for k in raw]
        elif isinstance(raw, dict):
            items = list(raw.items())
        else:
            raise ConfigError(f"{path}: a baseline is an object of finding: reason")
        entries: dict[str, Entry] = {}
        for key, value in items:
            moved = migrate(key, value) if migrate else None
            if moved is not None:
                entries[moved[0]] = moved[1]
            else:
                entries[key] = parse_entry(value)
        return cls(path, entries)

    @classmethod
    def for_check(cls, deck: DeckConfig, check: str, migrate: Migrate | None = None) -> "Baseline":
        """The baseline of `check` in the directory `checks.baselines` names."""
        directory = deck.path("checks.baselines", "the directory the checks' baselines live in")
        if not directory.is_dir():
            raise ConfigError(f"deck `{deck.name}` `checks.baselines` is not a directory: {directory}")
        return cls.load(directory / f"{check}.json", migrate)

    def verdict(self, finding: str, measure: Any = _NO_MEASURE) -> str:
        entry = self.entries.get(finding)
        if entry is None:
            return LIVE
        if entry.has_measure and measure is not _NO_MEASURE and entry.measure != _canon(measure):
            return LIVE
        if entry.reason is None:
            return RETIRED
        return RETIRED if entry.reason.strip() else UNREASONED

    def unreasoned(self) -> list[str]:
        return sorted(k for k, e in self.entries.items() if e.reason is not None and not e.reason.strip())

    def bless(self, findings: dict[str, Any]) -> list[str]:
        """Write `findings` ({finding: measure or None}); return those still owing a reason.

        An entry that is still found at the same measure keeps its reason, or
        stays a legacy entry; a new or changed finding is written blank.
        """
        out: dict[str, Entry] = {}
        for key, measure in sorted(findings.items()):
            old = self.entries.get(key)
            m = _NO_MEASURE if measure is None else _canon(measure)
            same = old is not None and (not old.has_measure or m is _NO_MEASURE or old.measure == m)
            if same and old is not None:
                out[key] = Entry(old.reason, m if m is not _NO_MEASURE else old.measure)
            else:
                out[key] = Entry("", m)
        self.entries = out
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps({k: e.to_json() for k, e in out.items()},
                                        ensure_ascii=False, indent=2, sort_keys=True) + "\n",
                             encoding="utf-8")
        return self.unreasoned()


def judge(baseline: Baseline, findings: list, key_of: Callable[[Any], str],
          measure_of: Callable[[Any], Any] | None = None) -> tuple[list, list]:
    """(live findings, findings retired with a blank reason), in the order given."""
    live, owed = [], []
    for item in findings:
        verdict = (baseline.verdict(key_of(item), measure_of(item)) if measure_of
                   else baseline.verdict(key_of(item)))
        if verdict == LIVE:
            live.append(item)
        elif verdict == UNREASONED:
            owed.append(item)
    return live, owed
