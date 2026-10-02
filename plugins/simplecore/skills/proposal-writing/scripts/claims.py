#!/usr/bin/env python3
"""Triage manuscript sentences whose numbers may be presented as measured.

Every line holding a digit is classified by Jev into the kind of number it
states (measured, requirement, target, plan, derived, assumption), in two
independent phrasings. The output is a review list, never a verdict:

- FLAG     both phrasings say measured, and neither the line nor its paragraph
           or table (with the two lines after it) cites evidence
- SPLIT    exactly one phrasing says measured

Each line carries both probabilities. A flagged sentence is confirmed by
reading it and its source before anything changes; this check edits nothing
and is not a gate, so it exits 0 whatever it flags and 1 only when a question
went unanswered. The run ends on one statistics line collected from the
answers themselves (questions sent, answers received, errors, seconds, rate,
and the cost the gateway reported):

    질문 694 · 답 694 · 오류 0 · 63초(초당 11건) · $0.03

Config (`jev` in the deck's entry):

    "jev": {
      "url": "https://ai-gateway.vercel.sh/v1/evaluate",   // optional
      "model": "typesafe-ai/jev",                          // optional
      "providers": ["typesafe-ai"],                        // optional: the zero-retention provider pin
      "keyEnv": "AI_GATEWAY_API_KEY",                      // optional: the variable holding the key
      "claims": {
        "evidence": "별첨|증빙|실측|시험환경",               // required: what cites evidence a reader can check
        "skipRow": "\\|\\s*(표시 문구|주장)\\s*\\|",         // optional: table rows that are plans, not claims
        "note": "^(상태|>\\s*러닝헤드)\\s*:",                // optional: working notes
        "xrefOnly": "^[A-Z]{3}[-_]\\d{3}[^:]*:\\s*[Ⅰ-Ⅻ]",   // optional: pure cross-reference rows
        "minChars": 8, "workers": 6,                       // optional
        "phrasings": { "A": [instructions, {kind: criterion}], "B": [...] }   // optional
      }
    }

With no path, the manuscript is read, its excluded and annex files left out
(the annex is the evidence). The key is read from the environment only and is
never printed.

    claims.py [path] [--json out.json] [--dry-run]
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
from argparse import Namespace
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Protocol
from urllib.error import URLError
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
from bidkit import cli  # noqa: E402
from bidkit.config import ConfigError, DeckConfig  # noqa: E402
from bidkit.manuscript import Manuscript  # noqa: E402

URL = "https://ai-gateway.vercel.sh/v1/evaluate"
MODEL = "typesafe-ai/jev"
PROVIDERS = ["typesafe-ai"]
KEY_ENV = "AI_GATEWAY_API_KEY"
RETRIES = 4

# The two phrasings. Their wording is the question, so it is data, kept in the
# language of the documents it classifies.
PHRASINGS = {
    "A": ("이 제안서 문장의 수치는 어떤 성격인가? 문장에 적힌 표현만 근거로 판단하라.", {
        "measured": "제안사가 이미 시험해서 얻은 실측 결과",
        "requirement": "제안요청서(발주사)가 정한 요구 기준값",
        "target": "제안사가 정한 설계 목표나 관리 목표",
        "plan": "앞으로 수행할 시험·일정·절차의 계획",
        "derived": "다른 값에서 계산한 산술 환산이나 산정값",
        "assumption": "확정되지 않은 가정이나 예시",
    }),
    "B": ("문장 속 숫자가 어디서 나왔는지 하나 고르라.", {
        "requirement": "발주 문서에 규정된 기준",
        "measured": "이미 수행한 시험에서 관측된 값",
        "derived": "계산으로 얻은 값",
        "target": "제안사가 스스로 세운 목표",
        "plan": "향후 수행 예정인 일의 조건이나 일정",
        "assumption": "아직 정해지지 않아 가정한 값",
    }),
}


class JevError(Exception):
    """A question that came back without an answer."""


@dataclass
class Answer:
    kind: str
    measured: float
    cost: float


class Client(Protocol):
    def ask(self, state: dict, instructions: str, criteria: dict) -> Answer: ...


class GatewayClient:
    """`POST /v1/evaluate` on the AI gateway, one choice question per call."""

    def __init__(self, key: str, url: str = URL, model: str = MODEL, providers: list | None = None,
                 sleep: Callable[[float], None] = time.sleep):
        self.key, self.url, self.model = key, url, model
        self.providers = PROVIDERS if providers is None else providers
        self.sleep = sleep

    def payload(self, state: dict, instructions: str, criteria: dict) -> dict:
        body: dict = {"model": self.model, "state": state,
                      "questions": {"kind": {"type": "choice", "instructions": instructions,
                                             "criteria": criteria}}}
        if self.providers:
            body["providerOptions"] = {"gateway": {"only": list(self.providers)}}
        return body

    def ask(self, state: dict, instructions: str, criteria: dict) -> Answer:
        data = json.dumps(self.payload(state, instructions, criteria)).encode()
        headers = {"Authorization": f"Bearer {self.key}", "Content-Type": "application/json"}
        last: Exception | None = None
        for attempt in range(RETRIES):
            try:
                with urlopen(Request(self.url, data, headers), timeout=20) as response:
                    return parse(json.load(response))
            except (URLError, TimeoutError, ValueError, JevError) as e:
                last = e
                self.sleep(2 ** attempt)
        raise JevError(str(last))


def parse(data: dict) -> Answer:
    """The choice, its measured probability and the cost the gateway reported."""
    try:
        answer = data["answers"]["kind"]
        kind = answer["choice"]
        measured = float(answer.get("probabilities", {}).get("measured", 0.0))
    except (KeyError, TypeError, ValueError) as e:
        raise JevError(f"an answer without a choice: {e}") from e
    cost = data.get("providerMetadata", {}).get("gateway", {}).get("cost", 0) or 0
    try:
        cost_value = float(cost)
    except (TypeError, ValueError):
        cost_value = 0.0
    return Answer(kind, measured, cost_value)


@dataclass
class Rules:
    evidence: re.Pattern
    skip_row: re.Pattern | None
    note: re.Pattern | None
    xref_only: re.Pattern | None
    caption: re.Pattern | None
    min_chars: int


def _rx(value: str | None, key: str, deck: DeckConfig, flags: int = 0) -> re.Pattern | None:
    if not value:
        return None
    try:
        return re.compile(value, flags)
    except re.error as e:
        raise ConfigError(f"deck `{deck.name}` `{key}` is not a valid pattern: {e}") from e


def rules(deck: DeckConfig) -> Rules:
    evidence = deck.require("jev.claims.evidence", "what in a line cites evidence a reader can check")
    caption = deck.get("manuscript.caption") if isinstance(deck.get("manuscript"), dict) else None
    return Rules(_rx(evidence, "jev.claims.evidence", deck),
                 _rx(deck.get("jev.claims.skipRow"), "jev.claims.skipRow", deck),
                 _rx(deck.get("jev.claims.note"), "jev.claims.note", deck),
                 _rx(deck.get("jev.claims.xrefOnly"), "jev.claims.xrefOnly", deck),
                 _rx(caption, "manuscript.caption", deck),
                 int(deck.get("jev.claims.minChars", 8)))


def blocks(lines: list[str]) -> list[str]:
    """For each line, the text of its paragraph or table plus the next two lines.

    A table row cites its evidence in a line under the table as often as in the
    row itself, so evidence is looked for in the whole block.
    """
    out, start = [], 0
    for i in range(len(lines) + 1):
        if i == len(lines) or not lines[i].strip():
            tail = "\n".join(lines[i:i + 3])
            text = "\n".join(lines[start:i]) + "\n" + tail
            out += [text] * (i - start) + ([""] if i < len(lines) else [])
            start = i + 1
    return out


@dataclass
class Item:
    file: str
    page: str
    text: str
    cited: bool
    answers: dict = field(default_factory=dict)    # phrasing -> Answer
    errors: dict = field(default_factory=dict)     # phrasing -> message


def items_of(path: Path, label: str, r: Rules) -> list[Item]:
    text = re.sub(r"<!--.*?-->", "", path.read_text(encoding="utf-8"), flags=re.S)
    lines = text.split("\n")
    out, page = [], ""
    for line, block in zip(lines, blocks(lines)):
        if line.startswith("#"):
            page = line.strip("# ").strip()
            continue
        if r.skip_row and r.skip_row.match(line):
            continue
        if line.startswith("![") or (r.caption and r.caption.match(line)):
            continue
        if line.startswith("|") and set(line.replace("|", "").strip()) <= set("-: "):
            continue
        body = line.strip().lstrip("-").strip()
        if len(body) < r.min_chars or not re.search(r"\d", body):
            continue
        if (r.xref_only and r.xref_only.match(body)) or (r.note and r.note.match(body)):
            continue
        out.append(Item(label, page, body, bool(r.evidence.search(block))))
    return out


def targets(deck: DeckConfig, path: str | None) -> list[tuple[Path, str]]:
    if path:
        p = Path(path).expanduser().resolve()
        if not p.exists():
            raise ConfigError(f"{path} does not exist")
        files = [p] if p.is_file() else sorted(p.rglob("*.md"))
        if deck.has("manuscript"):
            # A path inside the manuscript keeps its exclusions: an authoring brief is not copy.
            ms = Manuscript.for_deck(deck)
            kept = set(ms.files())
            files = [f for f in files if not f.is_relative_to(ms.dir) or f in kept]
        return [(f, _label(f, deck.root)) for f in files]
    ms = Manuscript.for_deck(deck)
    return [(f, _label(f, deck.root)) for f in ms.files(annex=False)]


def _label(path: Path, root: Path) -> str:
    try:
        return path.relative_to(root).as_posix()
    except ValueError:
        return str(path)


def phrasings(deck: DeckConfig) -> dict:
    declared = deck.get("jev.claims.phrasings")
    if declared is None:
        return PHRASINGS
    if (not isinstance(declared, dict) or len(declared) != 2
            or not all(isinstance(v, list) and len(v) == 2 and isinstance(v[1], dict) and "measured" in v[1]
                       for v in declared.values())):
        raise ConfigError(f"deck `{deck.name}` `jev.claims.phrasings` must hold two phrasings, each "
                          "[instructions, {kind: criterion}] with a `measured` kind")
    return {k: (v[0], v[1]) for k, v in declared.items()}


@dataclass
class Stats:
    questions: int = 0
    answers: int = 0
    errors: int = 0
    seconds: float = 0.0
    cost: float = 0.0

    def line(self) -> str:
        rate = self.answers / self.seconds if self.seconds > 0 else 0.0
        return (f"질문 {self.questions} · 답 {self.answers} · 오류 {self.errors} · "
                f"{self.seconds:.0f}초(초당 {rate:.0f}건) · ${self.cost:.2f}")


def classify(items: list[Item], client: Client, asked: dict, workers: int = 6,
             clock: Callable[[], float] = time.monotonic) -> Stats:
    """Ask every item every phrasing; the statistics come from what came back."""
    stats = Stats()
    jobs = [(item, name) for name in asked for item in items]
    stats.questions = len(jobs)

    def one(job: tuple[Item, str]) -> tuple[Item, str, Answer | None, str]:
        item, name = job
        instructions, criteria = asked[name]
        try:
            return item, name, client.ask({"쪽": item.page, "문장": item.text}, instructions, criteria), ""
        except JevError as e:
            return item, name, None, str(e)

    started = clock()
    with ThreadPoolExecutor(max(1, workers)) as pool:
        for item, name, answer, error in pool.map(one, jobs):
            if answer is None:
                item.errors[name] = error
                stats.errors += 1
            else:
                item.answers[name] = answer
                stats.answers += 1
                stats.cost += answer.cost
    stats.seconds = clock() - started
    return stats


def sort(items: list[Item], asked: dict) -> tuple[list[Item], list[Item]]:
    """(flagged, split) over the items both phrasings answered."""
    flags, splits = [], []
    for item in items:
        if len(item.answers) != len(asked):
            continue
        says = [a.kind == "measured" for a in item.answers.values()]
        if all(says) and not item.cited:
            flags.append(item)
        elif any(says) and not all(says):
            splits.append(item)
    return flags, splits


def show(tag: str, item: Item) -> None:
    a = list(item.answers.values())
    print(f"{tag}  measured {a[0].measured:.2f}/{a[1].measured:.2f}  {a[0].kind}/{a[1].kind}  {item.file}")
    print(f"       {item.text[:140]}")


def run(args: Namespace, deck: DeckConfig, client_factory: Callable[[DeckConfig], Client] | None = None) -> int:
    r = rules(deck)
    asked = phrasings(deck)
    items = [i for path, label in targets(deck, args.path) for i in items_of(path, label, r)]
    if args.dry_run:
        print(f"claims (dry run): {len(items)} lines with a number, {len(items) * len(asked)} "
              f"questions would be sent; nothing was sent")
        return 0
    client = (client_factory or gateway)(deck)
    stats = classify(items, client, asked, int(deck.get("jev.claims.workers", 6)))
    flags, splits = sort(items, asked)
    for item in flags:
        show("FLAG ", item)
    for item in splits:
        show("SPLIT", item)
    print(stats.line())
    print(f"claims: {len(items)} lines · flagged {len(flags)} · split {len(splits)} "
          "(probabilities, not verdicts: read each line and its source before editing)")
    if args.json:
        Path(args.json).write_text(json.dumps([
            {"file": i.file, "page": i.page, "text": i.text, "cited": i.cited,
             "answers": {k: {"kind": a.kind, "measured": a.measured} for k, a in i.answers.items()},
             "errors": i.errors} for i in items], ensure_ascii=False, indent=1), encoding="utf-8")
    return 1 if stats.errors else 0


def gateway(deck: DeckConfig) -> GatewayClient:
    env = deck.get("jev.keyEnv", KEY_ENV)
    key = os.environ.get(env, "").strip()
    if not key:
        raise ConfigError(f"${env} is not set; the Jev key is read from the environment only")
    return GatewayClient(key, deck.get("jev.url", URL), deck.get("jev.model", MODEL),
                         deck.get("jev.providers", PROVIDERS))


@cli.guarded
def main(argv: list[str] | None = None) -> int:
    ap = cli.parser(__doc__.splitlines()[0])
    ap.add_argument("path", nargs="?", help="a manuscript file or directory (default: the manuscript)")
    ap.add_argument("--json", help="write every answer to this file")
    ap.add_argument("--dry-run", action="store_true", help="count the questions; send nothing")
    args = ap.parse_args(argv)
    return run(args, cli.deck_config(args))


if __name__ == "__main__":
    sys.exit(main())
