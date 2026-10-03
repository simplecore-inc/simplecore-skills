"""listrow, pageshape, rhythm and grade: how a page is composed, read from the printed model."""
import json
import tempfile
import unittest
from pathlib import Path

from fixtures import page, project, reader, recording, table, text, use

import grade
import listrow
import pageshape
import rhythm
from bidkit.baseline import Baseline


def items(n: int, mark: str = "") -> str:
    return json.dumps([{"text": f"항목 {i}이다.", **({"mark": mark} if mark else {})} for i in range(n)],
                      ensure_ascii=False)


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "baselines").mkdir()
        self.deck = project(self.root, {"checks": {"baselines": "baselines"}})

    def tearDown(self):
        self.tmp.cleanup()

    def read(self, slides, **kw):
        return reader(self.deck, recording(slides, **kw))


class ListRowTests(Base):
    def found(self, src, composed=()):
        self.deck.data.setdefault("checks", {})["listrow"] = {"composed": list(composed)}
        r = self.read([], files={"pages/a.xml": src})
        return listrow.find(r, self.deck)[1]

    WRAPPED = ('<Use template="section" head="t"><Slot name="default"><Use template="list">'
               '<Slot name="default"><Use template="list-row" text="a"/></Slot></Use></Slot></Use>')

    def test_a_bare_row_is_reported_and_a_wrapped_one_is_not(self):
        bare = '<Use template="section" head="t"><Slot name="default"><Use template="list-row" text="a"/></Slot></Use>'
        self.assertEqual(len(self.found(bare)), 1)
        self.assertEqual(self.found(self.WRAPPED), [])

    def test_a_typed_bullet_is_reported_and_an_index_mark_is_not(self):
        bullet = self.WRAPPED.replace('text="a"', 'text="a" mark="•"')
        index = self.WRAPPED.replace('text="a"', 'text="a" mark="1."')
        self.assertEqual(len(self.found(bullet)), 1)
        self.assertEqual(self.found(index), [])
        in_items = f'<Use template="list" items="{items(2, "·").replace(chr(34), "&quot;")}"/>'
        self.assertEqual(len(self.found(in_items)), 2)

    def test_an_index_in_a_label_row_and_a_label_that_is_a_word(self):
        self.assertEqual(len(self.found('<Use template="keyrow" label="1" value="v"/>')), 1)
        self.assertEqual(len(self.found('<Use template="keyrow" label="가." value="v"/>')), 1)
        self.assertEqual(self.found('<Use template="keyrow" label="처리량" value="v"/>'), [])

    def test_a_hand_stack_and_a_nested_container(self):
        hand = '<VStack gap="7">' + self.WRAPPED + '</VStack>'
        self.assertEqual(len(self.found(hand)), 1)
        self.assertEqual(self.found(hand, composed=["a.xml"]), [])
        nested = ('<Use template="list"><Slot name="default"><Use template="list"><Slot name="default">'
                  '<Use template="list-row" text="a"/></Slot></Use></Slot></Use>')
        self.assertEqual(len(self.found(nested)), 1)


class PageShapeTests(Base):
    def found(self, *blocks, files=None):
        r = self.read([page(1, *blocks)], files=files or {})
        return [why for _, why in pageshape.find(r, self.deck)[1]]

    def test_a_page_of_paragraphs_and_lists_has_no_shape(self):
        self.assertEqual(len(self.found(use("prose", {"text": "문단이다."}), use("list", {"items": items(3)}))), 1)
        self.assertEqual(self.found(use("prose", {"text": "문단이다."}), use("card", {"head": "h"}),
                                    use("list", {"items": items(3)})), [])

    def test_a_list_that_outruns_its_shapes(self):
        long_list = use("list", {"items": items(13)})
        self.assertEqual(len(self.found(use("card"), long_list)), 1)
        self.assertEqual(self.found(use("card"), use("pair-card"), use("figure"), long_list), [])

    def test_hand_rows_count_into_their_container(self):
        rows = use("list", {}, *[use("list-row", {"text": f"r{i}"}) for i in range(13)])
        self.assertEqual(len(self.found(use("card"), rows)), 1)

    def test_a_one_row_list(self):
        self.assertEqual(self.found(use("card"), use("list", {"items": items(1)})), ["a list of one row"])
        self.assertEqual(self.found(use("card"), use("list", {"items": items(2)})), [])

    def test_a_numbered_sequence_dealt_evenly_into_columns(self):
        def cols(a, b):
            slot = lambda name, nums: (f'<Slot name="{name}">'  # noqa: E731
                                       + "".join(f'<Use template="step-row" no="{n}" head="h"/>' for n in nums)
                                       + "</Slot>")
            return {"pages/a.xml": f'<Use template="cols2">{slot("a", a)}{slot("b", b)}</Use>'}
        self.assertEqual(len([w for w in self.found(use("card"), files=cols([1, 2], [3, 4])) if "deals" in w]), 1)
        self.assertEqual([w for w in self.found(use("card"), files=cols([1, 2, 3], [4])) if "deals" in w], [])


class RhythmTests(Base):
    def layout_of(self, *blocks):
        r = self.read([page(1, *blocks)])
        roles = rhythm.Roles(pageshape.Kit(r, self.deck, "rhythm"))
        return rhythm.layout(roles, r.body_pages()[0])

    def test_layout_families(self):
        fig = use("figure", {"src": "a.svg"})
        self.assertEqual(self.layout_of(fig, use("card")), "full")
        self.assertEqual(self.layout_of(use("card"), fig), "bottom")
        self.assertEqual(self.layout_of(use("fig-left", {}, fig, use("prose"))), "left")
        self.assertEqual(self.layout_of(use("cols2", {}, use("prose"), fig)), "right")
        self.assertEqual(self.layout_of(use("cols2", {}, fig, use("figure", {"src": "b.svg"}))), "pair")
        self.assertEqual(self.layout_of(use("card")), "none")

    def test_a_figure_with_columns_under_it_is_the_same_layout_as_one_with_cards(self):
        fig = use("figure", {"src": "a.svg"})
        slides = [page(1, fig, use("cols3", {}, use("card"), use("card"), use("card"))),
                  page(2, fig, use("card"), use("pair-card")),
                  page(3, fig, use("section", {"head": "h"}, use("axis-card")))]
        r = self.read(slides)
        _, rows, bad, _, _ = rhythm.find(r, self.deck)
        self.assertEqual([lay for _, lay, _ in rows], ["full", "full", "full"])
        self.assertEqual([label for label, why in bad if "3 pages" in why], ["Ⅲ-1 03"])
        varied = [slides[0], page(2, use("card"), fig), slides[2]]
        self.assertEqual([w for _, w in rhythm.find(self.read(varied), self.deck)[2] if "3 pages" in w], [])

    def test_a_side_figure_twice_on_the_same_side(self):
        side = use("fig-left", {}, use("figure", {"src": "a.svg"}), use("prose"))
        bad = rhythm.find(self.read([page(1, side), page(2, side)]), self.deck)[2]
        self.assertEqual([label for label, w in bad if "side figure" in w], ["Ⅲ-1 02"])

    def test_a_run_of_plain_stacks(self):
        stacks = [page(i, use("figure", {"src": "a.svg"}), use("card")) for i in range(1, 4)]
        bad = rhythm.find(self.read(stacks), self.deck)[2]
        self.assertEqual([label for label, w in bad if "consecutive" in w], ["Ⅲ-1 03"])
        self.assertTrue(any("plain stack on 3 of 3" in w for _, w in bad))
        split = [use("cols2", {}, use("card"), use("pair-card"))]
        mixed = [stacks[0], page(2, *split), page(3, use("rail", {}, use("card")))]
        bad = rhythm.find(self.read(mixed), self.deck)[2]
        self.assertEqual([w for _, w in bad if "plain stack" in w], [])

    def test_census_top_share(self):
        heavy = [page(i, *[use("card") for _ in range(9)], use("pair-card")) for i in range(1, 3)]
        parts = rhythm.find(self.read(heavy), self.deck)[3]
        self.assertTrue(any("card is 18 of 20" in w for w in parts[0][4]))


SPACE = """slide {n}  793×1122  root node#1 [0,0 793×1122]
node#1  VStack  [0,0 793×1122]  pad 0  inner [0,0 793×1122]  gap 0  children 1  extent 1122  slack 0
  node#2  VStack  [56,200 681×800]  pad 0  inner [56,200 681×800]  gap 0  children 2  extent 0  slack 0
    node#3  VStack  [56,200 681×100]  pad 0  inner [56,200 681×100]  gap 0  children 1  extent 100  slack 0
      node#4  Text  [56,200 681×100]  "a"  13.3px×1  box-lines 1
    node#5  HStack  [56,300 681×{h}]  pad 0  inner [56,300 681×{h}]  gap 0  children 2  extent 681  slack 0
      node#6  VStack  [56,300 330×{h}]  pad 0  inner [56,300 330×{h}]  gap 0  children 1  extent 0  slack 0
        node#7  Text  [56,300 330×{left}]  "b"  13.3px×1  box-lines 1
      node#8  VStack  [407,300 330×{h}]  pad 0  inner [407,300 330×{h}]  gap 0  children 1  extent 0  slack 0
        node#9  Text  [407,300 330×{h}]  "c"  13.3px×1  box-lines 1
"""


FULL = {1: SPACE.format(n=1, h=700, left=700)}


class GradeTests(Base):
    def record(self, h, left, extra_deck=None):
        blocks = (use("card", {}, key="node#3"), use("cols2", {}, use("card"), use("pair-card"), key="node#5"))
        if extra_deck:
            self.deck.project.data["decks"].update(extra_deck)
        r = self.read([page(1, *blocks)], spaces={1: SPACE.format(n=1, h=h, left=left)})
        self.deck.data["checks"]["grade"] = {"include": []}
        return grade.records(r, self.deck, Baseline.for_check(self.deck, "grade"))["Ⅲ-1 01"]

    def test_fill_and_columns_from_the_layout(self):
        full = self.record(h=700, left=700)
        self.assertEqual([w for _, w, _ in full["reasons"] if "fill" in w or "column" in w], [])
        short = self.record(h=540, left=540)
        self.assertIn("fill 80%", [w for _, w, _ in short["reasons"]])
        uneven = self.record(h=700, left=300)
        self.assertTrue(any("a column stops at 50%" in w for _, w, _ in uneven["reasons"]))

    def test_a_table_of_record_is_read_from_the_deck_being_checked(self):
        other = {"other": {"dir": "deck", "kind": "slides", "grade": {"tableOfRecord": ["Ⅲ-1 01"]}}}
        slides = [page(1, use("prose", {"text": "문단이다."}, key="node#3"), *table("tb", ["a", "b"], ["1", "2"]))]
        self.deck.project.data["decks"].update(other)
        self.deck.data["checks"]["grade"] = {"include": []}
        rec = grade.records(self.read(slides, spaces=FULL), self.deck, Baseline.for_check(self.deck, "grade"))
        self.assertEqual(rec["Ⅲ-1 01"]["reasons"][0][0], 1)          # not exempted by another deck
        self.deck.data["grade"] = {"tableOfRecord": ["Ⅲ-1 01"]}
        rec = grade.records(self.read(slides, spaces=FULL), self.deck, Baseline.for_check(self.deck, "grade"))
        self.assertEqual(rec["Ⅲ-1 01"]["reasons"][0][0], 3)

    def test_a_judged_reason_drops_to_tier_three_and_a_blank_one_stays(self):
        slides = [page(1, use("prose", {"text": "문단이다."}, key="node#3"))]
        self.deck.data["checks"]["grade"] = {"include": []}
        why = "Ⅲ-1 01\tno shape: paragraphs only (0 list rows)"
        for reason, tier in (("the page is a statement of principle", 3), ("", 1)):
            (self.root / "baselines" / "grade.json").write_text(json.dumps({why: reason}), encoding="utf-8")
            rec = grade.records(self.read(slides, spaces=FULL), self.deck, Baseline.for_check(self.deck, "grade"))
            self.assertEqual(rec["Ⅲ-1 01"]["reasons"][0][0], tier)


if __name__ == "__main__":
    unittest.main()
