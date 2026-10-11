"""An explicit glyph-to-body gap must preserve wrapping and hanging indents."""
import unittest
import xml.etree.ElementTree as ET
from helpers import Project, figconfig

MODULE = '''from common import canvas, card, save, BODY, CHIP
c = canvas(1200, 400)
card(c, 24, 24, 190, c.blue, "Body", ["first line followed by a continuation", "second item"], size=BODY)
card(c, 240, 24, 190, c.blue, "Chip", ["first line followed by a continuation", "second item"], size=CHIP)
save(c, "bullets")
'''
NS = '{http://www.w3.org/2000/svg}'

class BulletGap(unittest.TestCase):
    def build(self, **config):
        p = Project(**config)
        try:
            p.write('figs/a.py', MODULE)
            run = p.run('build.py')
            self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
            return ET.parse(p.root / 'figures/bullets.svg').getroot()
        finally:
            p.close()

    def test_explicit_gap_changes_only_bullet_alignment(self):
        old = self.build()
        text = lambda root: [t for t in root.iter(NS+'text') if t.text != '•']
        for gap in (0.25, 0.5):
            with self.subTest(gap=gap):
                new = self.build(bulletGapEm=gap)
                self.assertEqual([ET.tostring(t) for t in text(old)],
                                 [ET.tostring(t) for t in text(new)])
                # The same wrapped continuation lines and content-sized boxes survive.
                self.assertEqual([ET.tostring(r) for r in old.iter(NS+'rect')],
                                 [ET.tostring(r) for r in new.iter(NS+'rect')])
                self.assertGreater(len(text(new)), 6)
                for b in [t for t in new.iter(NS+'text') if t.text == '•']:
                    self.assertEqual(b.get('text-anchor'), 'end')
                    size = float(b.get('font-size'))
                    body = next(t for t in text(new) if t.get('y') == b.get('y')
                                and 0 < float(t.get('x'))-float(b.get('x')) < 40)
                    # Canvas text coordinates round to tenths of a source unit.
                    self.assertAlmostEqual(float(body.get('x'))-float(b.get('x')),
                                           size*gap, delta=0.051)

    def test_default_retains_old_alignment(self):
        root=self.build()
        for b in [t for t in root.iter(NS+'text') if t.text=='•']:
            self.assertEqual(b.get('text-anchor'),'start')

    def test_invalid_gap_is_refused(self):
        for value in [-1, 0, True, 'half', float('inf')]:
            with self.subTest(value=value):
                p=Project(bulletGapEm=value)
                try:
                    with self.assertRaisesRegex(figconfig.ConfigError,'bulletGapEm'):
                        p.cfg()
                finally:p.close()
