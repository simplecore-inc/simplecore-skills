"""naming: a name slot holding a sentence, and a region title its first head repeats."""
import json
import tempfile
import unittest
from pathlib import Path

from fixtures import project, recording
from runmain import run

import naming


def q(value) -> str:
    s = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
    return s.replace("&", "&amp;").replace('"', "&quot;")


class NamingTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.deck = project(Path(self.tmp.name), {"checks": {}})

    def tearDown(self):
        self.tmp.cleanup()

    def found(self, src: str):
        rec = recording([], files={"pages/a.xml": src})
        from fixtures import reader
        return [(t, slot, why) for _, t, slot, _, why in naming.names(reader(self.deck, rec), self.deck)]

    def code(self, src: str) -> tuple[int, str]:
        return run(naming, self.deck, recording([], files={"pages/a.xml": src}))

    def test_a_question_a_sentence_and_a_clause_in_name_slots(self):
        self.assertEqual(self.found('<Use template="section" head="무엇을 재고 무엇을 통과로 보는가"/>'),
                         [("section", "head", "a question")])
        self.assertEqual(self.found('<Use template="keyrow" label="결과를 기록한다" value="x"/>'),
                         [("keyrow", "label", "a sentence")])
        self.assertEqual(self.found('<Use template="section" head="장애가 날 때"/>'),
                         [("section", "head", "a subordinate clause")])

    def test_names_pass_and_sentence_slots_are_not_read(self):
        for src in ('<Use template="section" head="1) 사업의 성격"/>', '<Use template="keyrow" label="가다랑어"/>',
                    '<Use template="section" head="테스트 커버리지"/>',
                    '<Use template="keyrow" label="처리량" value="30만 건/초를 실측한다."/>'):
            self.assertEqual(self.found(src), [], src)

    def test_json_item_names_and_table_header_cells(self):
        items = q([{"term": "결과를 기록한다", "definition": "기록한다."}])
        self.assertEqual(self.found(f'<Use template="deflist" items="{items}"/>'),
                         [("deflist", "items.term", "a sentence")])
        rows = q([["구분", "무엇을 보는가"], ["가", "기록한다"]])
        self.assertEqual(self.found(f'<Use template="table" rows="{rows}"/>'),
                         [("table", "rows[0]", "a question")])

    def test_a_comment_is_not_printed(self):
        self.assertEqual(self.found('<!-- <Use template="section" head="결과를 기록한다"/> -->'), [])

    def test_an_unlisted_component_is_read_through_the_head_arguments_when_declared(self):
        src = '<Use template="card" head="결과를 기록한다" body="기록한다."/>'
        self.assertEqual(self.found(src), [])
        self.deck.data["checks"]["naming"] = {"fallback": True}
        self.assertEqual(self.found(src), [("card", "head", "a sentence")])

    def test_region_title_repeated_by_the_first_head_under_it(self):
        src = ('<Use template="page" title="가. 쪽"><Slot name="body">'
               '<Use template="section" head="1) 사업의 성격"><Slot name="default">'
               '<Use template="prose" text="문단이다."/><Use template="card" head="사업의 성격" body="기록한다."/>'
               '</Slot></Use></Slot></Use>')
        self.assertEqual(self.code(src)[0], 0)
        self.deck.data["checks"]["naming"] = {"regionEcho": True}
        code, out = self.code(src)
        self.assertEqual(code, 1)
        self.assertIn("「사업의 성격」", out)
        listed = src.replace('head="1) 사업의 성격"', 'head="1) 사업의 성격 · 범위 · 일정"')
        code, out = self.code(listed)
        self.assertEqual(code, 0)
        self.assertIn("· a.xml: under", out)
        # A new page closes the region: the head on the next page is not under it.
        apart = ('<Use template="section" head="1) 사업의 성격"/>'
                 '<Use template="page" title="나. 쪽"/><Use template="card" head="사업의 성격" body="x"/>')
        self.assertEqual(self.code(apart)[0], 0)


if __name__ == "__main__":
    unittest.main()
