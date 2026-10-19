"""The site menu lists every page once, points at things that exist, and is loaded first by every page."""
import json
import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
SCRIPT_TAG = '<script src="site_nav.js"></script>'


def load_menu():
    text = (DOCS / "site_nav.js").read_text(encoding="utf-8")
    match = re.search(r"/\* BEGIN SITE_NAV JSON \*/\s*(\{.*?\})\s*/\* END SITE_NAV JSON \*/", text, re.S)
    if not match:
        raise AssertionError("docs/site_nav.js must keep its page list between the BEGIN and END SITE_NAV JSON markers")
    return json.loads(match.group(1)), text


class SiteNavTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.menu, cls.script = load_menu()
        cls.items = [item for group in cls.menu["groups"] for item in group["items"]]
        cls.pages = sorted(path.name for path in DOCS.glob("*.html"))

    def test_the_home_link_is_the_index_page(self):
        self.assertEqual(self.menu["home"]["href"], "index.html")
        self.assertIn("index.html", self.pages)
        self.assertTrue(self.menu["home"]["label"].strip())

    def test_every_page_is_in_the_menu_exactly_once(self):
        listed = sorted(item["href"] for item in self.items if "#" not in item["href"] and item["href"].endswith(".html"))
        self.assertEqual(listed, [name for name in self.pages if name != "index.html"],
                         "Each page in docs/ except the home page needs one entry in docs/site_nav.js, and nothing else may be listed")

    def test_every_link_points_at_something_that_exists(self):
        for item in self.items:
            target, _, anchor = item["href"].partition("#")
            path = DOCS / target
            with self.subTest(href=item["href"]):
                self.assertTrue(path.is_file(), f"{item['href']} does not exist in docs/")
                if anchor:
                    self.assertIn(f'id="{anchor}"', path.read_text(encoding="utf-8"), f"{target} has no element with id {anchor}")

    def test_ids_and_labels_are_filled_and_not_repeated(self):
        ids = [group["id"] for group in self.menu["groups"]]
        self.assertEqual(len(ids), len(set(ids)), "Group ids must be different")
        labels = [group["label"] for group in self.menu["groups"]] + [item["label"] for item in self.items]
        self.assertTrue(all(label.strip() for label in labels), "Every group and link needs a label")
        self.assertEqual(len(labels), len(set(labels)), "Labels must be different, so two menu entries are never confused")
        self.assertTrue(all(group["items"] for group in self.menu["groups"]), "A group with no links should be removed")
        hrefs = [item["href"] for item in self.items]
        self.assertEqual(len(hrefs), len(set(hrefs)), "A page or anchor is listed twice")

    def test_every_page_loads_the_menu_first_thing_in_the_body(self):
        for name in self.pages:
            text = (DOCS / name).read_text(encoding="utf-8")
            with self.subTest(page=name):
                self.assertEqual(text.count(SCRIPT_TAG), 1, f"{name} must load site_nav.js exactly once")
                self.assertRegex(text, r"<body>\s*" + re.escape(SCRIPT_TAG), f"{name} must load site_nav.js right after <body>")

    def test_pages_keep_a_plain_link_home_for_when_the_script_does_not_load(self):
        for name in self.pages:
            if name != "index.html":
                with self.subTest(page=name):
                    self.assertIn('href="index.html"', (DOCS / name).read_text(encoding="utf-8"))

    def test_the_menu_is_hidden_in_print_and_the_old_home_lines_are_hidden_on_screen(self):
        # The PDFs are printed from these pages, so the menu must never reach them.
        self.assertRegex(self.script, r"@media print \{ \.sn-nav \{ display: none !important; \} \}")
        self.assertIn(".home-link { display: none !important; }", self.script)


if __name__ == "__main__":
    unittest.main()
