"""markecho: a label that repeats the opening word of the prose it names."""
import json
import tempfile
import unittest
from pathlib import Path

from fixtures import page, project, reader, recording, table, use
from runmain import run

import markecho


class MarkEchoTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "baselines").mkdir()
        self.deck = project(self.root, {"checks": {"baselines": "baselines"}})

    def tearDown(self):
        self.tmp.cleanup()

    def found(self, *blocks):
        return [q for _, _, q in markecho.find(reader(self.deck, recording([page(1, *blocks)])))]

    def keyrow(self, label: str, value: str) -> dict:
        return use("keyrow", {"label": label, "value": value})

    def test_the_label_is_the_proses_opening(self):
        self.assertEqual(self.found(self.keyrow("출입", "출입은 승인 인원과 시간으로 제한한다.")),
                         ["keyrow label=「출입」: value repeats 「출입은」"])
        self.assertEqual(len(self.found(self.keyrow("코드 검토자", "코드 검토자는 변경을 승인한다."))), 1)
        self.assertEqual(len(self.found(self.keyrow("보완", "취약점 보완 · 재시험"))), 1)
        self.assertEqual(len(self.found(self.keyrow("큐", "큐는 재전송을 맡는다."))), 1)
        self.assertEqual(self.found(self.keyrow("통제", "출입은 승인 인원과 시간으로 제한한다.")), [])
        self.assertEqual(self.found(self.keyrow("1", "1 단계에서 시작한다.")), [])

    def test_the_closing_word_of_every_item(self):
        self.assertEqual(self.found(self.keyrow("대장", "결정 · 위험 대장 · 이슈 대장")),
                         ["keyrow label=「대장」: value is the closing word of the items"])

    def test_item_lists_pair_item_by_item_and_rows_below_the_header(self):
        items = json.dumps([{"term": "임무", "definition": "임무는 수집이다."},
                            {"term": "범위", "definition": "세 계층이다."}], ensure_ascii=False)
        self.assertEqual(self.found(use("deflist", {"items": items})),
                         ["deflist items[].term=「임무」: items[].definition repeats 「임무는」"])
        rows = table("tb", ["결재", "결재 상태"], ["결재", "결재 중"], ["청구", "제출"])
        self.assertEqual(self.found(*rows), ["row first cell=「결재」: next cell repeats 「결재」"])

    def test_a_judged_place_keeps_its_reason_and_a_stale_one_fails(self):
        rec = recording([page(1, self.keyrow("출입", "출입은 승인 인원으로 제한한다."))])
        path = self.root / "baselines" / "markecho.json"
        key = "Ⅲ-1 01\tkeyrow\tlabel\t1"
        self.assertEqual(run(markecho, self.deck, rec)[0], 1)
        path.write_text(json.dumps({key: {"quote": "q", "why": ""}}), encoding="utf-8")
        self.assertEqual(run(markecho, self.deck, rec)[0], 1)
        path.write_text(json.dumps({key: {"quote": "q", "why": "고유명사다"}}, ensure_ascii=False), encoding="utf-8")
        self.assertEqual(run(markecho, self.deck, rec)[0], 0)
        fixed = recording([page(1, self.keyrow("통제", "출입은 승인 인원으로 제한한다."))])
        code, out = run(markecho, self.deck, fixed)
        self.assertEqual(code, 1)
        self.assertIn("⚠ retired, and the place no longer repeats", out)

    def test_a_vocabulary_without_marks_is_refused(self):
        (self.root / "v.json").write_text(json.dumps({"slots": {}}), encoding="utf-8")
        self.deck.data["vocabulary"] = {"file": "v.json"}
        code, _ = run(markecho, self.deck, recording([page(1)]))
        self.assertEqual(code, 2)


if __name__ == "__main__":
    unittest.main()
