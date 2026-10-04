"""wordbreak: the wrap replayed on a built table cell, broken and fixed forms."""
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE.parents[4] / "scripts"))

import wordbreak  # noqa: E402
from bidkit.pptxread import Built  # noqa: E402

EMU_PER_PX = 9525


def width_of(text: str, size: float) -> float:
    """Advance in px: a syllable is one em, a Latin character or digit 0.6, a space or mark 0.3."""
    def em(ch: str) -> float:
        if wordbreak.is_cjk(ch):
            return 1.0
        return 0.6 if ch.isalnum() else 0.3
    return sum(em(ch) for ch in text) * size


def fits(text: str, size: float, bold: bool, width: float) -> bool:
    return width_of(text, size) <= width + 1e-6


def built() -> Built:
    b = Built.__new__(Built)
    b.emu_per_px = EMU_PER_PX
    return b


def run(text: str, lang: str = ' lang="ko-KR"') -> str:
    return f'<a:r><a:rPr{lang} sz="900"/><a:t>{text}</a:t></a:r>'


def table(col_px: list[float], cells: list[str]) -> str:
    """One row; each cell is a paragraph body. Margins 5 px a side."""
    grid = "".join(f'<a:gridCol w="{int(w * EMU_PER_PX)}"/>' for w in col_px)
    tcs = "".join(f'<a:tc><a:txBody><a:bodyPr/><a:p>{c}</a:p></a:txBody>'
                  f'<a:tcPr marL="{5 * EMU_PER_PX}" marR="{5 * EMU_PER_PX}"/></a:tc>' for c in cells)
    return (f'<p:graphicFrame><p:cNvPr id="1" name="node#7"/><a:graphic><a:graphicData><a:tbl>'
            f'<a:tblGrid>{grid}</a:tblGrid><a:tr h="1">{tcs}</a:tr></a:tbl></a:graphicData></a:graphic>'
            f'</p:graphicFrame>')


def found(xml: str) -> list[str]:
    return [f[4] for f in wordbreak.find({1: xml}, {1: "Ⅵ-2 02"}, built(), fits, wordbreak.Rules())]


SIZE = 12.0     # 9 pt


class WordBreakTests(unittest.TestCase):
    def test_word_wider_than_its_column_is_cut_and_reported(self):
        # 「연령학력」 is 4 em = 48 px; a 40 px column (30 px inside) cuts it.
        broken = found(table([40], [run("연령학력")]))
        self.assertEqual(broken, ["inside a word: 「연령 / 학력」"])

    def test_the_same_word_in_a_wide_enough_column_is_quiet(self):
        self.assertEqual(found(table([60], [run("연령학력")])), [])

    def test_a_latin_token_is_cut_inside(self):
        # 「COMTRADE」: 8 × 0.6 em = 57.6 px; a 30 px measure holds four letters.
        self.assertEqual(found(table([40], [run("COMTRADE", "")])), ["inside a word: 「COMT / RADE」"])
        self.assertEqual(found(table([70], [run("COMTRADE", "")])), [])

    def test_breaks_at_spaces_and_after_marks_are_quiet(self):
        # A run of words that each fit: every break falls at a space.
        self.assertEqual(found(table([50], [run("수행 기간 수행 역할 발주 기관")])), [])
        # One long word cut right after 「·」 is a permitted break.
        self.assertEqual(found(table([40], [run("성명·연령")])), [])

    def test_short_label_stranding_one_character_is_a_scrap(self):
        # 「전 구간」 in a 30 px measure: 「전」 then 「구간」.
        self.assertEqual(found(table([40], [run("전 구간")])), ["scrap line 「전」 of 「전 / 구간」"])
        self.assertEqual(found(table([60], [run("전 구간")])), [])

    def test_page_id_split_at_its_space_is_a_scrap(self):
        broken = found(table([45], [run("IV-2 03", "")]))
        self.assertEqual(broken, ["scrap line 「03」 of 「IV-2 / 03」"])
        self.assertEqual(found(table([70], [run("IV-2 03", "")])), [])

    def test_two_syllable_word_wrapping_at_a_space_is_ordinary(self):
        self.assertEqual(found(table([65], [run("클러스터 관리")])), [])

    def test_closing_mark_hangs_rather_than_opening_a_line(self):
        # 「후보)」 is 2.3 em = 27.6 px; the measure is 24 px. The mark hangs.
        self.assertEqual(found(table([34], [run("후보)")])), [])

    def test_explicit_break_is_where_the_line_ends(self):
        # Each piece fits; an author's <a:br/> is never a wrap.
        self.assertEqual(found(table([40], [run("연령") + "<a:br/>" + run("학력")])), [])

    def test_non_korean_run_breaks_between_syllables(self):
        # Without ko-KR every Hangul syllable is breakable: 「가나다라」 fills
        # a 30 px measure at 「가나」 and breaks between two syllables.
        self.assertEqual(found(table([40], [run("가나다라", "")])), ["inside a word: 「가나 / 다라」"])

    def test_merged_cell_takes_both_columns(self):
        xml = table([30, 30], [run("연령학력"), ""]).replace("<a:tc>", '<a:tc gridSpan="2">', 1)
        xml = xml.replace("<a:tc><a:txBody>", '<a:tc hMerge="1"><a:txBody>', 1)
        self.assertEqual(found(xml), [])

    def test_wrap_reports_how_each_line_ended(self):
        seg = wordbreak.Segment("t", 30.0, [wordbreak.Run("연령학력 기간", SIZE, False, True)])
        self.assertEqual(wordbreak.wrap(seg, fits), [("연령", "inside"), ("학력", "space"), ("기간", "end")])


class ServerFitsTests(unittest.TestCase):
    class Session:
        """Answers text_measure as a measurer that needs `need` px for every text."""
        def __init__(self, need):
            self.need, self.calls = need, 0

        def call(self, tool, args):
            self.calls += 1
            return {"structuredContent": {"lines": 1 if args["width"] >= self.need else 2}}

    def test_a_word_short_by_a_fraction_of_a_pixel_fits(self):
        self.assertTrue(wordbreak.ServerFits(self.Session(68.02))("COMTRADE", 12, True, 67.82))

    def test_a_word_short_by_more_than_the_slack_does_not(self):
        self.assertFalse(wordbreak.ServerFits(self.Session(97.02))("Linux(Ubuntu·RH", 12, True, 95.09))

    def test_answers_are_cached(self):
        session = self.Session(10)
        fits = wordbreak.ServerFits(session)
        fits("가", 12, False, 20)
        fits("가", 12, False, 20)
        self.assertEqual(session.calls, 1)


if __name__ == "__main__":
    unittest.main()
