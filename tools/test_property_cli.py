"""End-to-end command-line flows against isolated, real SQLite databases."""
import json
import pathlib
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]


class PropertyCliTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = pathlib.Path(self.temp.name)
        for name in ("data", "database", "web"):
            shutil.copytree(ROOT / name, self.root / name)

    def run_cli(self, *args):
        return subprocess.run([sys.executable, "-B", str(ROOT / "tools" / "property_data.py"),
                               "--root", str(self.root), *args], capture_output=True, encoding="utf-8")

    def test_build_check_and_parameterized_query_flow(self):
        built = self.run_cli("build")
        self.assertEqual(built.returncode, 0, built.stderr)
        self.assertTrue((self.root / "build" / "property.sqlite").exists())
        result = self.run_cli("query", "SELECT site_ref FROM current_plantings WHERE plant_id = ?",
                              "--params", '["i56-1"]', "--format", "json")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout), [{"site_ref": "B11-E33-S0"}])
        checked = self.run_cli("check")
        self.assertEqual(checked.returncode, 0, checked.stderr)

    def test_edit_json_then_query_rebuilds_without_website_publish(self):
        self.assertEqual(self.run_cli("build").returncode, 0)
        path = self.root / "data" / "water_harvesting.json"
        water = json.loads(path.read_text(encoding="utf-8"))
        water["catchments"][0]["area_sqft"] = 1000
        path.write_text(json.dumps(water), encoding="utf-8")
        result = self.run_cli("query", "SELECT gallons_per_inch FROM water_budget WHERE id = 'catchment-1'",
                              "--format", "json")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertAlmostEqual(json.loads(result.stdout)[0]["gallons_per_inch"], 560.7)
        stale = self.run_cli("check")
        self.assertNotEqual(stale.returncode, 0)
        self.assertIn("stale", stale.stderr)
        self.assertEqual(self.run_cli("build").returncode, 0)
        self.assertEqual(self.run_cli("check").returncode, 0)

    def test_invalid_record_and_sql_write_fail_with_explicit_errors(self):
        self.assertEqual(self.run_cli("build").returncode, 0)
        denied = self.run_cli("query", "DELETE FROM plants")
        self.assertNotEqual(denied.returncode, 0)
        self.assertIn("Property data error", denied.stderr)
        path = self.root / "data" / "locations.json"
        locations = json.loads(path.read_text(encoding="utf-8"))
        locations["records"][0]["y_ft"] = -1
        path.write_text(json.dumps(locations), encoding="utf-8")
        failed = self.run_cli("query", "SELECT COUNT(*) FROM plants")
        self.assertNotEqual(failed.returncode, 0)
        self.assertIn("outside", failed.stderr)
        locations["records"][0]["y_ft"] = 600
        path.write_text(json.dumps(locations), encoding="utf-8")
        restored = self.run_cli("query", "SELECT COUNT(*) AS n FROM plants", "--format", "json")
        self.assertEqual(restored.returncode, 0, restored.stderr)
        self.assertEqual(json.loads(restored.stdout)[0]["n"], 432)

    def test_unicode_query_output_is_not_lost_to_windows_terminal_encoding(self):
        result = self.run_cli("query", "SELECT char(8594) AS direction")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("\u2192", result.stdout)


if __name__ == "__main__":
    unittest.main()
