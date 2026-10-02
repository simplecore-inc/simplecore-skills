"""reqid: cited requirement ids against the headings that issue them."""
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE.parents[3] / "scripts"))

import reqid  # noqa: E402
from bidkit.config import ConfigError  # noqa: E402
from bidkit.tests.support import project, reader, recording  # noqa: E402

DIGEST = """# 요구사항

PER-007 은 제안요청서에 없다.

#### PER-001 처리량
#### PER-002 지연
#### PER-003 유실
#### PER-004 중복
#### PER-005 복구
#### PER-006 확장
#### PER-008 자원
#### QUR_001 품질
"""


class ReqIdTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "docs").mkdir()
        (self.root / "docs" / "requirements.md").write_text(DIGEST, encoding="utf-8")
        (self.root / "proposal").mkdir()
        self.deck = project(self.root, {"manuscript": "proposal", "requirements": {
            "source": "docs/requirements.md", "id": {"prefix": "[A-Z]{3}[-_]", "digits": 3},
            "absence": "제안요청서에 (?:없다|없음|없습니다)"}})

    def tearDown(self):
        self.tmp.cleanup()

    def bad(self, md: str = "", deck_text: str = ""):
        (self.root / "proposal" / "01.md").write_text(md, encoding="utf-8")
        files = {"pages/a.xml": f'<Fragment><!-- PER-099 in a comment --><Use template="page" '
                                f'refTitle="{deck_text}" /></Fragment>'}
        _, _, bad = reqid.check(reader(self.deck, recording(files=files)), self.deck)
        return bad

    def test_underscore_id_is_issued(self):
        self.assertEqual(self.bad("품질은 QUR_001 로 본다.", "QUR_001"), [])

    def test_underscore_range_is_checked_too(self):
        # A hyphen-only id shape never sees QUR_, so this range would pass unread.
        self.assertEqual(self.bad("QUR_001~002 를 충족한다."), [("proposal/01.md", "QUR_002", True)])

    def test_range_over_a_gap_claims_an_unissued_id(self):
        self.assertEqual(self.bad("PER-001~008 을 충족한다."), [("proposal/01.md", "PER-007", True)])
        self.assertEqual(self.bad(deck_text="PER-001 ~ 008"), [("deck:a.xml", "PER-007", True)])

    def test_absence_sentence_is_exempt_and_others_are_not(self):
        self.assertEqual(self.bad("PER-007 은 제안요청서에 없다."), [])
        self.assertEqual(self.bad("PER-007 은 제안요청서에 없다. PER-007 을 충족한다."),
                         [("proposal/01.md", "PER-007", False)])

    def test_model_name_is_an_id_until_declared_not_one(self):
        self.assertEqual(self.bad("지원 기종 TTP-244 와 AES-256"), [("proposal/01.md", "TTP-244", False)])
        self.deck.data["requirements"]["notAnId"] = ["TTP"]
        self.assertEqual(self.bad("지원 기종 TTP-244 와 AES-256"), [])

    def test_commented_deck_id_is_not_read(self):
        self.assertEqual(self.bad(), [])

    def test_source_missing_or_defining_nothing_is_an_error(self):
        (self.root / "docs" / "requirements.md").write_text("no headings\n", encoding="utf-8")
        with self.assertRaises(ConfigError):
            self.bad()
        (self.root / "docs" / "requirements.md").unlink()
        with self.assertRaises(ConfigError):
            self.bad()
        del self.deck.data["requirements"]["id"]
        (self.root / "docs" / "requirements.md").write_text(DIGEST, encoding="utf-8")
        with self.assertRaises(ConfigError):
            self.bad()


if __name__ == "__main__":
    unittest.main()
