"""notespeech: numbers and names in speaker notes are written as they are read."""
import unittest

# fixtures puts the checks and the plugin's scripts on sys.path
import fixtures  # noqa: F401

import notespeech as ns

NATIVE = ns.native_pattern(ns.COUNTERS)


class NoteSpeechTests(unittest.TestCase):
    def test_a_digit_before_a_native_counter_is_found(self):
        for s in ("게이트웨이 11대", "6명이", "4시간 안에", "2개 모듈", "6 명"):
            self.assertTrue(ns.findings(s, NATIVE, latin=False), s)

    def test_sino_korean_counters_and_ratios_keep_their_digits(self):
        for s in ("10만 건", "15개월 차", "3초", "3회 반복", "발주사 1 대 제안사 3", "1대3", "열한 대"):
            self.assertEqual(ns.findings(s, NATIVE, latin=False), [], s)

    def test_latin_letters_are_found_and_hangul_passes(self):
        self.assertEqual(ns.findings("Apache Ignite 3를 쓴다", NATIVE), ["Apache Ignite 3"])
        self.assertEqual(ns.findings("아파치 이그나이트 쓰리를 쓴다", NATIVE), [])

    def test_a_banned_spoken_phrase_is_found_and_its_replacement_passes(self):
        banned = {"에이비씨": "전체 용어"}
        self.assertEqual(ns.findings("에이비씨 저장까지", NATIVE, banned=banned),
                         ["에이비씨」 → 「전체 용어"])
        self.assertEqual(ns.findings("전체 용어 저장까지", NATIVE, banned=banned), [])
        self.assertEqual(ns.findings("에이비씨 저장까지", NATIVE), [])

    def test_notes_are_collected_per_slide(self):
        content = [{"slide": 1, "blocks": [{"role": "use", "children": [{"role": "notes", "text": "가"}]}]},
                   {"slide": 2, "blocks": []}]
        self.assertEqual(ns.notes_of(content), {1: "가", 2: ""})


if __name__ == "__main__":
    unittest.main()
