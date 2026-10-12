"""Canonical-record, SQLite, freshness, and website-export tests."""
import copy
import contextlib
import json
import pathlib
import shutil
import sqlite3
import tempfile
import unittest

from property_data import build, check, load_data, query, source_digest, validate_data
from site_grid import SiteGrid

ROOT = pathlib.Path(__file__).resolve().parents[1]


class PropertyDataTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = load_data(ROOT)

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = pathlib.Path(self.temp.name)
        for folder in ("data", "database", "web"):
            shutil.copytree(ROOT / folder, self.root / folder)

    def test_inventory_is_lossless_and_individual(self):
        self.assertEqual(len(self.data["inventory"]["records"]), 119)
        self.assertEqual(len(self.data["plants"]["records"]), 432)
        self.assertEqual(len({p["id"] for p in self.data["plants"]["records"]}), 432)
        self.assertEqual(sum(r["quantity"] for r in self.data["inventory"]["records"]), 432)
        self.assertEqual(len(self.data["catalog"]["fruit_records"]), 105)
        self.assertTrue(any(r["sheet"] == "Berry" for r in self.data["catalog"]["workbook_records"]))
        self.assertFalse(any(r["sheet"] == "Notes" for r in self.data["catalog"]["workbook_records"]))
        validate_data(self.data)

    def test_current_orchard_and_open_spots(self):
        rows = query("SELECT state, COUNT(*) AS n FROM orchard_spots GROUP BY state", self.root)
        counts = {r["state"]: r["n"] for r in rows}
        self.assertEqual(counts, {"open": 71, "planned": 110, "planted": 1, "reserved": 13})
        root = query("SELECT * FROM current_plantings WHERE plant_id = 'i56-1'", self.root)[0]
        self.assertEqual(root["site_ref"], "B10-E33-S35")
        self.assertEqual(root["status"], "planted")
        self.assertIsNone(root["planted_on"], "Do not invent a planting date from a report date")
        outside = query("SELECT * FROM current_plantings WHERE plant_group = 'outside-orchard'", self.root)
        self.assertEqual(len(outside), 3)
        self.assertTrue(all(r["site_ref"] == "PENDING" and r["location_id"] is None for r in outside))
        dead = query("SELECT * FROM current_plantings WHERE plant_id = 'i108-1'", self.root)[0]
        self.assertEqual(dead["status"], "dead")
        self.assertEqual(dead["site_ref"], "PENDING", "A vacant planned spot is not the dead plant's current location")
        vacancies = query("SELECT name, replacement_year FROM orchard_spots WHERE replacement_year IS NOT NULL", self.root)
        self.assertEqual({r["name"] for r in vacancies}, {"R4-C9", "R5-C9", "R5-C10", "R8-C3"})
        self.assertTrue(all(r["replacement_year"] == 2027 for r in vacancies))

    def test_features_terrain_water_and_gps_are_queryable(self):
        self.assertEqual(query("SELECT COUNT(*) AS n FROM site_features", self.root)[0]["n"], 44)
        self.assertEqual(query("SELECT COUNT(*) AS n FROM terrain_samples", self.root)[0]["n"], 18009)
        self.assertEqual(query("SELECT COUNT(*) AS n FROM climate_months", self.root)[0]["n"], 12)
        self.assertEqual(query("SELECT COUNT(*) AS n FROM soil_layers", self.root)[0]["n"], 3)
        self.assertEqual(query("SELECT COUNT(*) AS n FROM water_techniques", self.root)[0]["n"], 10)
        self.assertEqual(query("SELECT COUNT(*) AS n FROM water_calendar", self.root)[0]["n"], 6)
        self.assertEqual(query("SELECT COUNT(*) AS n FROM drainage_areas", self.root)[0]["n"], 8)
        cell = query("SELECT * FROM grid_cells WHERE cell = 'C17'", self.root)[0]
        self.assertAlmostEqual(cell["latitude"], 43.47325771764506)
        self.assertAlmostEqual(cell["longitude"], -115.5944556149553)
        roof = query("SELECT * FROM water_budget WHERE id = 'catchment-1'", self.root)[0]
        self.assertIsNone(roof["area_sqft"])
        self.assertIsNone(roof["annual_gallons"], "Unknown roof area must not become zero or a guessed footprint")
        sample = query("SELECT * FROM terrain_samples WHERE x_ft = 0 AND y_ft = 50", self.root)[0]
        self.assertAlmostEqual(sample["elevation_m"], 1444.52)

    def test_database_foreign_keys_and_integrity(self):
        database = build(self.root, web=False)
        with contextlib.closing(sqlite3.connect(database)) as connection:
            self.assertEqual(connection.execute("PRAGMA integrity_check").fetchone()[0], "ok")
            self.assertEqual(connection.execute("PRAGMA foreign_key_check").fetchall(), [])

    def test_source_digest_is_portable_across_line_endings(self):
        before = source_digest(self.root)
        for path in (self.root / "data").glob("*.json"):
            path.write_bytes(path.read_bytes().replace(b"\r\n", b"\n").replace(b"\n", b"\r\n"))
        self.assertEqual(source_digest(self.root), before)

    def test_query_rebuilds_after_json_change(self):
        database = build(self.root, web=False)
        before = query("SELECT value FROM build_metadata WHERE key = 'source_digest'", self.root)[0]["value"]
        path = self.root / "data" / "water_harvesting.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        data["months"][0]["precipitation_in"] = 4
        path.write_text(json.dumps(data), encoding="utf-8")
        self.assertEqual(query("SELECT precipitation_in FROM climate_months WHERE month = 1", self.root)[0]["precipitation_in"], 4)
        after = query("SELECT value FROM build_metadata WHERE key = 'source_digest'", self.root)[0]["value"]
        self.assertNotEqual(before, after)
        self.assertEqual(build(self.root, web=False), database)

    def test_failed_rebuild_preserves_last_database(self):
        database = build(self.root, web=False)
        original = database.read_bytes()
        path = self.root / "data" / "locations.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        data["records"][0]["x_ft"] = -10
        path.write_text(json.dumps(data), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "outside"):
            build(self.root, web=False)
        self.assertEqual(database.read_bytes(), original)

    def test_sql_queries_cannot_modify_or_attach(self):
        for sql in ("DELETE FROM plants", "DROP TABLE plants", "ATTACH ':memory:' AS other",
                    "PRAGMA user_version=99", "SELECT load_extension('anything')"):
            with self.subTest(sql=sql), self.assertRaises(sqlite3.DatabaseError):
                query(sql, self.root)
        self.assertEqual(query("SELECT COUNT(*) AS n FROM plants", self.root)[0]["n"], 432)

    def test_all_location_refs_match_shared_helpers(self):
        grid = SiteGrid(data=self.data["site"], terrain=self.data["terrain"])
        for row in query("SELECT * FROM location_refs", self.root):
            self.assertEqual(row["site_ref"], grid.site_ref(row["x_ft"], row["y_ft"]))

    def test_precise_location_refs_use_shared_rounding_even_at_boundaries(self):
        path = self.root / "data" / "locations.json"
        locations = json.loads(path.read_text(encoding="utf-8"))
        for index, x in enumerate((1.005, 83.005, 112.345, 49.999)):
            locations["records"].append({
                "id": f"precise-{index}", "name": "Precision test", "x_ft": x, "y_ft": 818,
                "orchard_row": None, "orchard_column": None, "reserved_for": None,
                "replacement_year": None, "replacement_type": None,
            })
        path.write_text(json.dumps(locations), encoding="utf-8")
        grid = SiteGrid(data=self.data["site"], terrain=self.data["terrain"])
        for row in query("SELECT * FROM location_refs WHERE id LIKE 'precise-%'", self.root):
            self.assertEqual(row["site_ref"], grid.site_ref(row["x_ft"], row["y_ft"]))
            _, east, south = row["site_ref"].split("-")
            self.assertAlmostEqual(row["east_offset_ft"], float(east[1:]))
            self.assertAlmostEqual(row["south_offset_ft"], float(south[1:]))

    def test_water_observation_addition_and_removal_rebuild_cleanly(self):
        path = self.root / "data" / "water_harvesting.json"
        water = json.loads(path.read_text(encoding="utf-8"))
        water["observations"].append({
            "id": "test-perc", "location_id": "orchard-r6-c3", "observed_on": "2026-10-12",
            "observation_type": "infiltration", "value": 1.25, "unit": "in/hr", "notes": "Test fixture only",
        })
        path.write_text(json.dumps(water), encoding="utf-8")
        measured = query("SELECT value, unit FROM water_observations WHERE id='test-perc'", self.root)[0]
        self.assertEqual(measured, {"value": 1.25, "unit": "in/hr"})
        water["observations"] = []
        path.write_text(json.dumps(water), encoding="utf-8")
        self.assertEqual(query("SELECT COUNT(*) AS n FROM water_observations", self.root)[0]["n"], 0)

    def test_outside_location_can_be_added_without_reusing_old_spot(self):
        path = self.root / "data" / "locations.json"
        locations = json.loads(path.read_text(encoding="utf-8"))
        locations["records"].append({
            "id": "outside-c17", "name": "Outside test location", "x_ft": 112, "y_ft": 818,
            "orchard_row": None, "orchard_column": None, "reserved_for": None,
            "replacement_year": None, "replacement_type": None,
        })
        path.write_text(json.dumps(locations), encoding="utf-8")
        path = self.root / "data" / "plantings.json"
        plantings = json.loads(path.read_text(encoding="utf-8"))
        plantings["records"].append({
            "id": "outside-i64-1", "plant_id": "i64-1", "location_id": "outside-c17",
            "status": "planned", "planted_on": None, "recorded_on": "2026-10-12", "notes": "Test fixture only",
        })
        path.write_text(json.dumps(plantings), encoding="utf-8")
        result = query("SELECT site_ref FROM current_plantings WHERE plant_id='i64-1'", self.root)[0]
        self.assertEqual(result["site_ref"], "C17-E12-S18")
        self.assertEqual(query("SELECT state FROM orchard_spots WHERE name='R4-C9'", self.root)[0]["state"], "open")
        build(self.root)
        generated = (self.root / "docs" / "data" / "orchard_model.js").read_text(encoding="utf-8")
        self.assertIn('"i64-1":{"status":"planned","location_id":"outside-c17"', generated)

    def test_referential_and_shape_errors_are_explicit(self):
        cases = [
            ("plants", lambda d: d["records"].append(copy.deepcopy(d["records"][0])), "duplicate"),
            ("plantings", lambda d: d["records"][0].update(plant_id="missing"), "plant"),
            ("plantings", lambda d: d["records"][0].update(location_id="missing"), "location"),
            ("locations", lambda d: d["records"][0].update(x_ft=float("nan")), "finite"),
            ("plant_events", lambda d: d["records"][0].update(recorded_on="yesterday"), "date"),
            ("terrain", lambda d: d["grid"]["z"].pop(), "sample"),
            ("water_harvesting", lambda d: d["months"].pop(), "12"),
            ("water_harvesting", lambda d: d["months"].reverse(), "order"),
            ("water_harvesting", lambda d: d["catchments"][0].update(runoff_factor=1.5), "runoff"),
            ("inventory", lambda d: d["records"][0].update(quantity=0), "quantity"),
        ]
        for collection, change, message in cases:
            data = copy.deepcopy(self.data)
            change(data[collection])
            with self.subTest(collection=collection, message=message), self.assertRaisesRegex(ValueError, message):
                validate_data(data)

    def test_generated_outputs_are_repeatable_and_checkable(self):
        build(self.root)
        folder = self.root / "docs" / "data"
        first = {p.name: p.read_bytes() for p in folder.iterdir()}
        build(self.root)
        self.assertEqual({p.name: p.read_bytes() for p in folder.iterdir()}, first)
        check(self.root)
        target = folder / "orchard_model.js"
        target.write_text("stale output", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "stale"):
            check(self.root)


if __name__ == "__main__":
    unittest.main()
