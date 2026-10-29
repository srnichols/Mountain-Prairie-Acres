"""Static checks on the published pages."""
import html.parser
import pathlib
import re
import unittest

DOCS = pathlib.Path(__file__).resolve().parents[1] / "docs"
HOME_LINK = re.compile(r'<a\s[^>]*href="(?:\./)?index\.html"')
VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}


class _Ancestry(html.parser.HTMLParser):
    """Records the classes of every ancestor of each element that has an id."""

    def __init__(self):
        super().__init__()
        self.stack = []
        self.ancestor_classes = {}

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get("id"):
            self.ancestor_classes[attrs["id"]] = {name for _, names in self.stack for name in names}
        if tag not in VOID_TAGS:
            self.stack.append((tag, (attrs.get("class") or "").split()))

    def handle_endtag(self, tag):
        while self.stack and self.stack.pop()[0] != tag:
            pass


class SitePagesTest(unittest.TestCase):
    def test_every_page_links_back_to_the_home_page(self):
        self.assertTrue((DOCS / "index.html").is_file())
        pages = sorted(path for path in DOCS.glob("*.html") if path.name != "index.html")
        self.assertGreaterEqual(len(pages), 10, "The published pages were not found")
        missing = [page.name for page in pages if not HOME_LINK.search(page.read_text(encoding="utf-8"))]
        self.assertEqual(missing, [], "These pages need a link back to index.html")

    def test_orchard_page_can_print_just_its_three_maps(self):
        page = (DOCS / "orchard_pollination_grid.html").read_text(encoding="utf-8")
        parsed = _Ancestry()
        parsed.feed(page)
        for graphic in ("grid", "legend", "wb-plan", "wb-cross", "site-plan", "site-plan-note"):
            self.assertIn("print-map", parsed.ancestor_classes[graphic], f"#{graphic} belongs to a map that Print maps only keeps")
        for table in ("wb-table", "planting-checklist"):
            self.assertNotIn("print-map", parsed.ancestor_classes[table], f"#{table} is not a map, so Print maps only leaves it out")
        self.assertIn(".print-maps-only #map-note, .print-maps-only #wb-summary, .print-maps-only .site-notes { display: none; }", page,
                      "the narrative paragraphs inside the map blocks are left out too")
        self.assertEqual(page.count('class="print-map'), 3, "three blocks: the planting map, the windbreak figures, and the site plan")
        self.assertIn(".print-map { display: contents; }", page, "the wrappers add no box, so the normal page and its PDF are laid out as before")
        self.assertIn(".print-maps-only body *:not(.print-map, .print-map *, :has(.print-map)) { display: none !important; }", page,
                      "everything but the maps is hidden while the maps-only class is on")
        self.assertIn(".print-maps-only .print-map { display: block; break-before: page; }", page, "one map to a sheet")
        self.assertRegex(page, r'<button type="button" id="print-maps"[^>]*>Print maps only</button>')
        self.assertRegex(page, r"classList\.add\('print-maps-only'\);[^}]*window\.print\(\);", "the class is on before the print dialog opens")
        self.assertRegex(page, r"addEventListener\('afterprint', done\)[^}]*window\.print\(\)", "the class comes off when the dialog closes")
        self.assertRegex(page, r"const done = \(\) => \{ root\.classList\.remove\('print-maps-only'\);", "so a later Ctrl+P prints the whole page")


if __name__ == "__main__":
    unittest.main()
