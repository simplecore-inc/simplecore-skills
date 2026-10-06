"""mdtwice, rfpwords, annexref, rfpcite and sharedvalues on small projects."""
import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE.parents[3] / "scripts"))

import annexref  # noqa: E402
import budget  # noqa: E402
import claims  # noqa: E402
import evaluation  # noqa: E402
import mdtwice  # noqa: E402
import rfpcite  # noqa: E402
import rfpwords  # noqa: E402
import sharedvalues  # noqa: E402
import volume  # noqa: E402
from bidkit.baseline import Baseline  # noqa: E402
from bidkit.config import ConfigError  # noqa: E402
from bidkit.tests.support import body, project, reader, recording  # noqa: E402

MS = {"dir": "proposal", "printed": "## 인쇄 원고", "page": "### ", "exclude": ["README.md"],
      "annex": ["10-별첨/**"], "caption": "^캡션: "}


def printed(*paras: str) -> str:
    return "# 장\n\n## 작성 기록\n\n- 메모는 인쇄되지 않는다.\n\n## 인쇄 원고\n\n### 가. 쪽\n\n" + "\n\n".join(paras) + "\n"


class Base(unittest.TestCase):
    extra: dict = {}

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "proposal" / "10-별첨").mkdir(parents=True)
        (self.root / "baselines").mkdir()
        self.deck = project(self.root, {"manuscript": dict(MS), "checks": {"baselines": "baselines"},
                                        **json.loads(json.dumps(self.extra))})

    def tearDown(self):
        self.tmp.cleanup()

    def md(self, rel: str, text: str) -> None:
        p = self.root / "proposal" / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")


REPEAT_A = "수집 노드는 장애가 나면 대기 노드가 같은 세션을 즉시 이어받아 유실 없이 계속 처리한다."
REPEAT_B = "수집 노드에 장애가 나면 대기 노드가 같은 세션을 즉시 이어받아 유실 없이 처리한다."


class MdTwiceTests(Base):
    def found(self, same=False):
        return mdtwice.pairs(mdtwice.collect(self.deck), 0.75, same)

    def test_second_copy_in_another_file_is_reported(self):
        self.md("03/a.md", printed(REPEAT_A, "다른 문장은 전혀 다른 내용을 설명하는 별개의 문장이다."))
        self.md("04/b.md", printed(REPEAT_B))
        found = self.found()
        self.assertEqual(len(found), 1)
        self.assertEqual((found[0].a_file, found[0].b_file), ("03/a.md", "04/b.md"))

    def test_records_tables_annex_and_same_file_are_not_compared(self):
        self.md("03/a.md", printed(REPEAT_A, REPEAT_B, "| " + REPEAT_A + " |"))
        self.md("03/b.md", "# 장\n\n## 작성 기록\n\n" + REPEAT_B + "\n\n## 인쇄 원고\n\n### 가. 쪽\n\n짧다.\n")
        self.md("10-별첨/c.md", REPEAT_B + "\n")
        self.assertEqual(self.found(), [])
        self.assertEqual(len(self.found(same=True)), 1)

    def test_baseline_reason_rules(self):
        self.md("03/a.md", printed(REPEAT_A))
        self.md("04/b.md", printed(REPEAT_B))
        found = self.found()
        key = found[0].key
        for reason, want in (("", (0, 1, 0)), ("both chapters answer their own requirement", (0, 0, 1))):
            (self.root / "baselines" / "mdtwice.json").write_text(json.dumps({key: reason}), encoding="utf-8")
            live, owed, held = mdtwice.judge(found, Baseline.for_check(self.deck, "mdtwice"))
            self.assertEqual((len(live), len(owed), held), want)


DIGEST = """# 요구사항

#### SFR-001 노드 상태 수집

<!-- l10n:quote 원문 -->
1. 클러스터 참여 노드의 상태를 수집하고 시건장치 상태를 조회하여야 한다.
2. 상태 변경 발생 시 알림을 발송하고 로그를 저장하여야 한다.
<!-- l10n:/quote -->

**검토 의견**

- 감사로그 와 무관한 검토 문구.

#### SFR-002 리더 선출

<!-- l10n:quote 원문 -->
합의알고리즘으로 신규 리더를 결정하여야 한다.
<!-- l10n:/quote -->
"""


class RfpWordsTests(Base):
    extra = {"requirements": {"source": "docs/req.md", "id": {"prefix": "[A-Z]{3}-", "digits": 3},
                              "quote": {"open": r"<!--\s*l10n:quote.*?-->", "close": r"<!--\s*l10n:/quote\s*-->"}}}

    def setUp(self):
        super().setUp()
        (self.root / "docs").mkdir()
        (self.root / "docs" / "req.md").write_text(DIGEST, encoding="utf-8")

    def miss(self, text: str):
        self.md("04/a.md", text)
        hay, _ = rfpwords.corpus(self.deck, None)
        return rfpwords.missing(self.deck, hay, [])

    def test_unwritten_noun_is_reported_under_its_id(self):
        got = self.miss("클러스터 노드 상태를 수집하고 알림과 로그를 남긴다. 합의 알고리즘으로 리더를 정한다.")
        self.assertEqual(got, {"SFR-001": ["시건장치"]})

    def test_spacing_particles_and_verbs_do_not_count_as_missing(self):
        got = self.miss("클러스터 시건 장치를 점검한다. 합의 알고리즘으로 리더를 정한다.")
        self.assertEqual(got, {})

    def test_review_prose_outside_the_quote_is_not_the_requirement(self):
        # 「감사로그」 sits in the review note, not in the quoted clause.
        self.assertNotIn("감사로그", str(self.miss("시건장치. 합의알고리즘.")))

    def test_without_the_quote_markers_the_review_prose_is_read(self):
        del self.deck.data["requirements"]["quote"]
        self.assertIn("감사로그", str(self.miss("시건장치. 합의알고리즘.")))

    def test_forms_peel_one_syllable_at_a_time(self):
        self.assertEqual(rfpwords.forms("응답속도"), ["응답속도", "응답속"])
        self.assertEqual(rfpwords.forms("수집하여야"), [])
        self.assertEqual(rfpwords.forms("발생했다"), [])


REFS = """| 번호 | 이름 |
| --- | --- |
| 기술 근거 1 | 표준 |
| 기술 근거 2 | 지침 |
| 법령 근거 1 | 법 |
"""


class AnnexRefTests(Base):
    extra = {"annex": {"references": {
        "annex": {"cite": r"별첨\s*(?P<id>\d{1,2})(?:\s*~\s*(?P<to>\d{1,2}))?(?!\d)", "notBefore": ["쪽", "건"],
                  "defined": {"deck": "pages/90-annex.xml", "pattern": r'no="별첨 (\d+)"'}},
        "source": {"cite": r"(?P<kind>기술|법령)\s*근거\s*(?P<list>[0-9][0-9·~,\s]*)", "notBefore": ["건"],
                   "defined": {"file": "proposal/00/refs.md",
                               "pattern": r"^\|\s*(?P<kind>기술|법령)\s*근거\s*(?P<id>\d+)\s*\|"}}}}}

    def setUp(self):
        super().setUp()
        self.md("00/refs.md", REFS)

    def run_on(self, md: str, page: str = ""):
        self.md("04/a.md", md)
        files = {"pages/41.xml": f'<Fragment><Use template="page" sub="{page}" /></Fragment>',
                 "pages/90-annex.xml": '<Fragment><Use template="annex-part" no="별첨 1" /><Use template="annex-part" no="별첨 2" /></Fragment>'}
        return annexref.check(self.deck, reader(self.deck, recording(files=files)))[2]

    def test_reference_to_an_annex_and_a_source_that_do_not_exist(self):
        bad = self.run_on("별첨 3 을 본다. 기술 근거 1·3 을 따른다.")
        self.assertEqual(len(bad), 2)
        self.assertIn("names 3", bad[0])
        self.assertIn("names 기술:3", bad[1])

    def test_range_member_missing_from_the_deck_page(self):
        bad = self.run_on("", page="별첨 1~3 을 참고한다")
        self.assertEqual(bad, ["deck:41.xml: annex 「별첨 1~3」 names 3, which the annex does not carry"])

    def test_counts_and_existing_references_are_quiet(self):
        self.assertEqual(self.run_on("별첨 2 와 기술 근거 2, 법령 근거 1 을 본다. 별첨 79쪽. 기술 근거 58건."), [])

    def test_definition_that_finds_nothing_is_an_error(self):
        self.md("00/refs.md", "empty\n")
        with self.assertRaises(ConfigError):
            self.run_on("기술 근거 1")


RFP_CH3 = "# Ⅲ. 제안요청 내용\n\n> 원본: 제안요청서 사업 개요\n\n## 1. 사업 범위\n\n## 2. 기능 요구\n\n수집 구간 정의.\n"
RFP_CH1 = "# Ⅰ. 사업 개요\n\n## 1. 추진 배경\n\n## 2. 사업 내용\n\n사업 개요 업무를 적는다.\n"


class RfpCiteTests(Base):
    extra = {"rfp": {"dir": "docs/rfp", "skipLines": ["^> 원본:"]}}

    def setUp(self):
        super().setUp()
        (self.root / "docs" / "rfp").mkdir(parents=True)
        (self.root / "docs" / "rfp" / "01.md").write_text(RFP_CH1, encoding="utf-8")
        (self.root / "docs" / "rfp" / "03.md").write_text(RFP_CH3, encoding="utf-8")

    def found(self, line: str):
        self.md("04/a.md", line + "\n")
        return [(lvl, msg) for _, lvl, msg in rfpcite.check(self.deck)[2]]

    def test_chapter_and_section_the_tender_does_not_carry(self):
        self.assertEqual(self.found("제안요청서 Ⅸ장을 따른다.")[0][0], "error")
        self.assertIn("no section 4", self.found("제안요청서 Ⅲ. 4. 일정")[0][1])

    def test_name_that_belongs_to_another_chapter(self):
        found = self.found("제안요청서 Ⅲ. 사업 내용 을 따른다")
        self.assertEqual(found, [("error", "「사업 내용」 is not in chapter Ⅲ; it is in Ⅰ")])

    def test_resolving_citations_are_quiet(self):
        self.assertEqual(self.found("제안요청서 Ⅲ. 2. 기능 요구 에 따라 제안요청서 Ⅲ. 1.의 범위와 제안요청서 Ⅰ장"), [])

    def test_provenance_line_does_not_make_every_chapter_match(self):
        # 「사업 개요」 is in Ⅲ only through the provenance line, which is skipped.
        self.assertEqual(self.found("제안요청서 Ⅲ. 사업 개요")[0][0], "error")
        self.deck.data["rfp"]["skipLines"] = []
        self.assertEqual(self.found("제안요청서 Ⅲ. 사업 개요"), [])


FACTS = """# 안내

## 5. 공유 사실

| 사실 | 인쇄할 문구 | 적는 쪽 |
| --- | --- | --- |
| 점검대상 | 점검대상 1,288,418건이다 | 3 · 5 |
| 절 번호 | 2.5절을 본다 | 3 |

## 6. 다음
"""


def marked_page(n: int, text: str) -> str:
    return f"# 장\n\n## 인쇄 원고\n\n> 쪽 {n} · 평가항목\n\n{text}\n"


class SharedValuesTests(Base):
    extra = {"manuscript": dict(MS, sharedValues={
        "file": "proposal/README.md", "section": "## 5. 공유 사실",
        "columns": {"fact": "사실", "wording": "인쇄할 문구", "pages": "적는 쪽"},
        "pages": {"marker": r"^> 쪽 (\d+)\b"}})}

    def setUp(self):
        super().setUp()
        self.md("README.md", FACTS)

    def test_value_missing_from_a_page_and_copied_onto_another(self):
        self.md("01/a.md", marked_page(3, "점검대상 1,288,418건."))
        self.md("01/b.md", marked_page(5, "점검대상은 따로 적는다."))
        self.md("01/c.md", marked_page(7, "합계 1,288,418건."))
        _, _, bad = sharedvalues.check(self.deck, None)
        self.assertEqual(bad, ["점검대상: 1,288,418 is not on page 5",
                               "점검대상: 1,288,418 is on page 7, which the row does not assign"])

    def test_assigned_pages_carry_it_and_section_numbers_are_not_distinctive(self):
        self.md("01/a.md", marked_page(3, "점검대상 1,288,418건. 2.5절."))
        self.md("01/b.md", marked_page(5, "1,288,418건.") + "\n## 검토\n\n1,288,418\n")
        self.assertEqual(sharedvalues.check(self.deck, None)[2], [])

    def test_deck_pages_by_page_id(self):
        self.deck.data["manuscript"]["sharedValues"]["pages"] = "deck"
        (self.root / "proposal" / "README.md").write_text(
            FACTS.replace("| 3 · 5 |", "| Ⅲ-1 01 |").replace("| 2.5절을 본다 | 3 |", "| 2.5절 | Ⅲ-1 02 |"),
            encoding="utf-8")
        slides = [body(1, 3, 1, texts=("점검대상 1,288,418건",)), body(2, 3, 1, texts=("또 1,288,418건",))]
        bad = sharedvalues.check(self.deck, reader(self.deck, recording(slides=slides)))[2]
        self.assertEqual(bad, ["점검대상: 1,288,418 is on page Ⅲ-1 02, which the row does not assign"])

    def test_missing_section_is_an_error(self):
        self.deck.data["manuscript"]["sharedValues"]["section"] = "## 9. 없음"
        with self.assertRaises(ConfigError):
            sharedvalues.check(self.deck, None)


class CommandLineTests(unittest.TestCase):
    """Every check's parser builds: a flag that collides with a shared one fails only at run time."""

    def test_help_of_every_check(self):
        for module in MODULES:
            with self.subTest(module.__name__), redirect_stdout(io.StringIO()):
                with self.assertRaises(SystemExit) as caught:
                    module.main(["--help"])
                self.assertEqual(caught.exception.code, 0)


MODULES = [annexref, budget, claims, evaluation, mdtwice, rfpcite, rfpwords, sharedvalues, volume]


if __name__ == "__main__":
    unittest.main()
