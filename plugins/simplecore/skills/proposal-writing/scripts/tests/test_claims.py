"""claims: Jev triage of numbered lines, with the client injected (no network)."""
import io
import sys
import tempfile
import unittest
from argparse import Namespace
from contextlib import redirect_stdout
from pathlib import Path
from urllib.error import URLError

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE.parents[3] / "scripts"))

import claims  # noqa: E402
from bidkit.config import ConfigError  # noqa: E402
from bidkit.tests.support import project  # noqa: E402

MD = """# 성능

## 인쇄 원고

### 가. 처리율

지속 처리율은 125,764행/초로 측정했다.

목표 처리율은 30만 건/초다.

| 항목 | 값 |
| --- | --- |
| 유입 | 90,040 건/초 |

증빙 2의 시험 결과다.

| 표시 문구 | 3노드 |
"""


class FakeClient:
    """Answers by sentence: {text fragment: (kind for A, kind for B)}; records every question."""

    def __init__(self, table: dict, fail: str | None = None):
        self.table, self.fail, self.asked = table, fail, []
        self.phrasing = {claims.PHRASINGS[k][0]: i for i, k in enumerate(claims.PHRASINGS)}

    def ask(self, state, instructions, criteria):
        self.asked.append(state["문장"])
        if self.fail and self.fail in state["문장"]:
            raise claims.JevError("timed out")
        for fragment, kinds in self.table.items():
            if fragment in state["문장"]:
                kind = kinds[self.phrasing[instructions]]
                return claims.Answer(kind, 0.9 if kind == "measured" else 0.1, 0.01)
        return claims.Answer("target", 0.1, 0.01)


class ClaimsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "proposal").mkdir()
        (self.root / "proposal" / "05.md").write_text(MD, encoding="utf-8")
        (self.root / "proposal" / "10-별첨").mkdir()
        (self.root / "proposal" / "10-별첨" / "r.md").write_text("측정값 12,345행/초를 얻었다.\n", encoding="utf-8")
        self.deck = project(self.root, {
            "manuscript": {"dir": "proposal", "annex": ["10-별첨/**"]},
            "jev": {"claims": {"evidence": "별첨|증빙|실측", "skipRow": r"\|\s*(표시 문구)\s*\|"}}})

    def tearDown(self):
        self.tmp.cleanup()

    def run_on(self, client, dry=False):
        out = io.StringIO()
        with redirect_stdout(out):
            code = claims.run(Namespace(path=None, json=None, dry_run=dry), self.deck, lambda d: client)
        return code, out.getvalue()

    def test_measured_without_evidence_is_flagged_and_cited_one_is_not(self):
        client = FakeClient({"125,764": ("measured", "measured"), "90,040": ("measured", "measured"),
                             "30만": ("target", "measured")})
        code, out = self.run_on(client)
        self.assertEqual(code, 0)
        flags = [l for l in out.splitlines() if l.startswith("FLAG")]
        splits = [l for l in out.splitlines() if l.startswith("SPLIT")]
        # The table row's evidence is in the line under the table, so it is cited.
        self.assertEqual(len(flags), 1)
        self.assertIn("measured 0.90/0.90", flags[0])
        self.assertIn("125,764", out.split(flags[0])[1].splitlines()[1])
        self.assertEqual(len(splits), 1)

    def test_plan_rows_annex_and_short_lines_are_not_asked(self):
        client = FakeClient({})
        self.run_on(client)
        self.assertEqual(sorted(set(client.asked)),
                         sorted({"지속 처리율은 125,764행/초로 측정했다.", "목표 처리율은 30만 건/초다.",
                                 "| 유입 | 90,040 건/초 |", "증빙 2의 시험 결과다."}))

    def test_stats_line_is_collected_from_the_answers(self):
        client = FakeClient({}, fail="30만")
        code, out = self.run_on(client)
        line = [l for l in out.splitlines() if l.startswith("질문")][0]
        self.assertRegex(line, r"^질문 8 · 답 6 · 오류 2 · \d+초\(초당 \d+건\) · \$0\.06$")
        self.assertEqual(code, 1)          # an unanswered question is not a clean run

    def test_a_path_inside_the_manuscript_keeps_its_exclusions(self):
        (self.root / "proposal" / "README.md").write_text("작성 안내 문장 12개를 둔다.\n", encoding="utf-8")
        self.deck.data["manuscript"]["exclude"] = ["README.md"]
        client = FakeClient({})
        out = io.StringIO()
        with redirect_stdout(out):
            claims.run(Namespace(path=str(self.root / "proposal"), json=None, dry_run=False), self.deck,
                       lambda d: client)
        self.assertNotIn("작성 안내 문장 12개를 둔다.", client.asked)
        self.assertIn("측정값 12,345행/초를 얻었다.", client.asked)     # an explicit path reads the annex

    def test_stats_format(self):
        s = claims.Stats(694, 694, 0, 63.0, 0.031)
        self.assertEqual(s.line(), "질문 694 · 답 694 · 오류 0 · 63초(초당 11건) · $0.03")

    def test_dry_run_sends_nothing(self):
        client = FakeClient({})
        code, out = self.run_on(client, dry=True)
        self.assertEqual((code, client.asked), (0, []))
        self.assertIn("8 questions would be sent", out)

    def test_parse_reads_the_gateway_cost(self):
        answer = claims.parse({"answers": {"kind": {"choice": "measured",
                                                    "probabilities": {"measured": 1, "target": 0}}},
                               "providerMetadata": {"gateway": {"cost": "0.000014574"}}})
        self.assertEqual((answer.kind, answer.measured, answer.cost), ("measured", 1.0, 0.000014574))
        with self.assertRaises(claims.JevError):
            claims.parse({"answers": {}})

    def test_gateway_client_retries_then_gives_up_without_a_network(self):
        slept = []
        client = claims.GatewayClient("k", url="http://127.0.0.1:9/never", sleep=slept.append)
        calls = []

        def refuse(*a, **k):
            calls.append(a)
            raise URLError("refused")
        original = claims.urlopen
        claims.urlopen = refuse
        try:
            with self.assertRaises(claims.JevError):
                client.ask({"문장": "x"}, "q", {"measured": "m"})
        finally:
            claims.urlopen = original
        self.assertEqual((len(calls), slept), (claims.RETRIES, [1, 2, 4, 8]))
        body = client.payload({"문장": "x"}, "q", {"measured": "m"})
        self.assertEqual(body["providerOptions"], {"gateway": {"only": ["typesafe-ai"]}})

    def test_missing_key_and_missing_evidence_rule_are_errors(self):
        self.deck.data["jev"]["keyEnv"] = "CLAIMS_TEST_UNSET_VARIABLE"
        claims.os.environ.pop("CLAIMS_TEST_UNSET_VARIABLE", None)
        with self.assertRaises(ConfigError):
            claims.gateway(self.deck)
        del self.deck.data["jev"]["claims"]["evidence"]
        with self.assertRaises(ConfigError):
            claims.rules(self.deck)


if __name__ == "__main__":
    unittest.main()
