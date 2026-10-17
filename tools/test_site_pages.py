"""Static checks on the published pages."""
import pathlib
import re
import unittest

DOCS = pathlib.Path(__file__).resolve().parents[1] / "docs"
HOME_LINK = re.compile(r'<a\s[^>]*href="(?:\./)?index\.html"')


class SitePagesTest(unittest.TestCase):
    def test_every_page_links_back_to_the_home_page(self):
        self.assertTrue((DOCS / "index.html").is_file())
        pages = sorted(path for path in DOCS.glob("*.html") if path.name != "index.html")
        self.assertGreaterEqual(len(pages), 10, "The published pages were not found")
        missing = [page.name for page in pages if not HOME_LINK.search(page.read_text(encoding="utf-8"))]
        self.assertEqual(missing, [], "These pages need a link back to index.html")


if __name__ == "__main__":
    unittest.main()
