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
from site_climate import parse_month_day
from site_grid import SiteGrid

ROOT = pathlib.Path(__file__).resolve().parents[1]


def plan_item(orchard, item_id):
    return next(item for item in orchard["rules"]["PLANTING_PLAN"]["items"] if item["id"] == item_id)


def add_plan_item_with_dayton_profile(orchard):
    item = copy.deepcopy(plan_item(orchard, "dayton"))
    item.update(id="dayton-two", code="DYT", quantity=1, spots=["R13-C1"])
    orchard["rules"]["PLANTING_PLAN"]["items"].append(item)


def late_spring_at_24_f(climate):
    """Put every 24 F spring date on Jun 30, keeping the frost-free days consistent so only the order between thresholds is wrong."""
    summary = climate["sources"][0]["frost"]["summary"]["24"]
    summary["last_spring"].update(earliest="06-30", p10="06-30", p50="06-30", p90="06-30", latest="06-30")
    shortest = parse_month_day(summary["first_fall"]["earliest"]) - parse_month_day("06-30")
    longest = parse_month_day(summary["first_fall"]["latest"]) - parse_month_day("06-30")
    summary["frost_free_days"].update(shortest=shortest, p10=shortest, p50=shortest, p90=longest, longest=longest)


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
        self.assertEqual(counts, {"open": 75, "planted": 107, "reserved": 13})
        root = query("SELECT * FROM current_plantings WHERE plant_id = 'i56-1'", self.root)[0]
        self.assertEqual(root["site_ref"], "B10-E33-S35")
        self.assertEqual(root["status"], "planted")
        self.assertIsNone(root["planted_on"], "The rootstock was reported planted with no date")
        pear = query("SELECT * FROM current_plantings WHERE plant_id = 'i94-1'", self.root)[0]
        self.assertEqual((pear["status"], pear["location_name"], pear["site_ref"]), ("planted", "R8-C3", "B9-E33-S45"))
        self.assertEqual(pear["planted_on"], "2026-10", "The owner gave the month, so no day is invented")
        self.assertEqual(query("SELECT state FROM orchard_spots WHERE name = 'R8-C1'", self.root)[0]["state"], "open")
        outside = query("SELECT * FROM current_plantings WHERE plant_group = 'outside-orchard'", self.root)
        self.assertEqual(len(outside), 3)
        self.assertTrue(all(r["site_ref"] == "PENDING" and r["location_id"] is None for r in outside))
        dead = query("SELECT * FROM current_plantings WHERE plant_id = 'i108-1'", self.root)[0]
        self.assertEqual(dead["status"], "dead")
        self.assertEqual(dead["site_ref"], "PENDING", "A vacant planned spot is not the dead plant's current location")
        for plant_id, spot in (("i80-1", "R9-C2"), ("i88-1", "R11-C10"), ("i84-1", "R11-C12"), ("i83-1", "R12-C11")):
            lost = query(f"SELECT status, health_status, site_ref FROM current_plantings WHERE plant_id = '{plant_id}'", self.root)[0]
            self.assertEqual((lost["status"], lost["health_status"], lost["site_ref"]), ("dead", "dead", "PENDING"), plant_id)
            self.assertEqual(query(f"SELECT state FROM orchard_spots WHERE name = '{spot}'", self.root)[0]["state"], "open")
        # Two Italian plums were moved (R11-C7 to R11-C6 and R12-C7 to R12-C5), which leaves their old spots open.
        for plant_id, spot, old_spot in (("i111-1", "R11-C6", "R11-C7"), ("i111-3", "R12-C5", "R12-C7")):
            moved = query(f"SELECT status, location_name, health_status FROM current_plantings WHERE plant_id = '{plant_id}'", self.root)[0]
            self.assertEqual((moved["status"], moved["location_name"], moved["health_status"]), ("planted", spot, "living"), plant_id)
            self.assertEqual(query(f"SELECT state FROM orchard_spots WHERE name = '{old_spot}'", self.root)[0]["state"], "open")
        self.assertEqual(query("SELECT location_name FROM current_plantings WHERE plant_id = 'i111-2'", self.root)[0]["location_name"], "R12-C6")
        vacancies = query("SELECT name, replacement_year, replacement_type FROM orchard_spots WHERE replacement_year IS NOT NULL", self.root)
        self.assertEqual({r["name"] for r in vacancies},
                         {"R4-C9", "R5-C9", "R5-C10", "R8-C1", "R9-C2", "R11-C7", "R11-C10", "R11-C12", "R12-C7", "R12-C11"})
        self.assertTrue(all(r["replacement_year"] == 2027 for r in vacancies))
        self.assertEqual({r["name"]: r["replacement_type"] for r in vacancies},
                         {"R4-C9": "Apple", "R5-C9": "Apple", "R5-C10": "Apple", "R8-C1": "Pear", "R9-C2": "Cherry", "R11-C7": "Plum",
                          "R11-C10": "Peach", "R11-C12": "Peach", "R12-C7": "Plum", "R12-C11": "Peach"})

    def test_every_orchard_fruit_tree_is_planted_in_october_2026(self):
        # The owner finished the last block on 2026-10-18 and gave only the month, so no day is invented.
        planted = query("SELECT plant_id, planted_on, notes FROM plantings WHERE status = 'planted' AND plant_id != 'i56-1' "
                        "AND location_id LIKE 'orchard-%'", self.root)
        self.assertEqual(len(planted), 106)
        self.assertEqual({r["planted_on"] for r in planted}, {"2026-10"})
        self.assertTrue(all("October 2026" in r["notes"] for r in planted))
        self.assertEqual(query("SELECT COUNT(*) AS n FROM plantings WHERE status = 'planned'", self.root)[0]["n"], 0)
        # The rootstock was reported planted earlier with no date; dead trees and the outside-orchard apples are not planted.
        self.assertIsNone(query("SELECT planted_on FROM plantings WHERE plant_id = 'i56-1'", self.root)[0]["planted_on"])
        dead = query("SELECT plant_id, planted_on FROM plantings WHERE status = 'dead'", self.root)
        self.assertEqual(sorted(r["plant_id"] for r in dead), ["i108-1", "i80-1", "i83-1", "i84-1", "i88-1"])
        self.assertTrue(all(r["planted_on"] is None for r in dead))
        outside = query("SELECT plant_id, planted_on FROM plantings WHERE status = 'outside-orchard'", self.root)
        self.assertEqual(sorted(r["plant_id"] for r in outside), ["i63-1", "i64-1", "i65-1"])
        self.assertTrue(all(r["planted_on"] is None for r in outside))

    def test_planting_dates_may_be_a_day_a_month_or_unknown(self):
        for planted_on in ("2026-10-18", "2026-10", None):
            data = copy.deepcopy(self.data)
            data["plantings"]["records"][0]["planted_on"] = planted_on
            with self.subTest(planted_on=planted_on):
                validate_data(data)

    def test_planting_plan_is_queryable_and_matches_the_open_spots(self):
        plan = self.data["orchard"]["rules"]["PLANTING_PLAN"]
        self.assertEqual((plan["year"], plan["covers_rows"]), (2027, 12))
        items = query("SELECT id, type, method, quantity, profile_id FROM planting_plan_items ORDER BY id", self.root)
        self.assertEqual(len(items), len(plan["items"]))
        self.assertEqual(len(items), 26)
        self.assertEqual(sum(r["quantity"] for r in items), 49)
        spots = query("SELECT spot, state, type, method, cultivar FROM planned_spots ORDER BY orchard_row, orchard_column", self.root)
        self.assertEqual(len(spots), 49)
        self.assertTrue(all(r["state"] in ("open", "reserved") for r in spots), "Planned spots are still empty")
        by_type = {}
        for r in spots:
            by_type[r["type"]] = by_type.get(r["type"], 0) + 1
        self.assertEqual(by_type, {"Apple": 26, "Pear": 2, "Cherry": 11, "Peach": 3, "Plum": 7})
        self.assertEqual({r["spot"]: r["cultivar"] for r in spots if r["spot"] in ("R8-C1", "R8-C13", "R9-C2", "R11-C7", "R11-C10", "R12-C7", "R12-C8")},
                         {"R8-C1": "Harrow Delight", "R8-C13": "Seckel", "R9-C2": "Black Gold", "R11-C7": "Mount Royal",
                          "R11-C10": "Intrepid", "R12-C7": "Stanley", "R12-C8": "Damson"})
        # The moved plums' new spots hold living trees, so the plan does not use them.
        self.assertFalse({r["spot"] for r in spots} & {"R11-C6", "R12-C5"})
        # Grafts go only in the 13 reserved spots of R1, and bought trees only in the others.
        self.assertEqual({(r["method"], r["state"]) for r in spots}, {("graft", "reserved"), ("buy", "open")})
        grafts = [r for r in spots if r["method"] == "graft"]
        self.assertEqual(sorted(r["spot"] for r in grafts), sorted(f"R1-C{c}" for c in range(1, 14)))
        # No hole is left in R1 to R12: every empty or reserved spot there has a planned cultivar; R13 to R15 stay open.
        holes = query("SELECT name FROM orchard_spots WHERE orchard_row <= 12 AND state IN ('open', 'reserved') "
                      "AND name NOT IN (SELECT spot FROM planned_spots)", self.root)
        self.assertEqual(holes, [])
        later = query("SELECT COUNT(*) AS n FROM orchard_spots WHERE orchard_row > 12 AND state = 'open' "
                      "AND name NOT IN (SELECT spot FROM planned_spots)", self.root)[0]["n"]
        self.assertEqual(later, 39)
        held = query("SELECT name FROM orchard_spots WHERE replacement_year = 2027 ORDER BY name", self.root)
        self.assertTrue({r["name"] for r in held} <= {r["spot"] for r in spots}, "Every held replacement spot has a planned cultivar")
        linked = query("SELECT COUNT(*) AS n FROM planting_plan_items i JOIN cultivar_profiles p ON p.id = i.profile_id "
                       "WHERE p.type = i.type", self.root)[0]["n"]
        self.assertEqual(linked, 26)
        validate_data(self.data)

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

    def test_site_climate_is_queryable(self):
        counts = {"climate_sources": 4, "temperature_months": 48, "frost_summary": 16, "frost_days": 48, "frost_years": 124,
                  "frost_thresholds": 4, "daylight_months": 12, "daylight_crossings": 4, "sun_key_dates": 4, "climate_site": 1}
        for table, expected in counts.items():
            with self.subTest(table=table):
                self.assertEqual(query(f"SELECT COUNT(*) AS n FROM {table}", self.root)[0]["n"], expected)
        primary = query("SELECT id, kind, hardiness_zone, mean_annual_extreme_min_f, record_low_f, period_start, period_end "
                        "FROM climate_sources WHERE role = 'primary'", self.root)
        self.assertEqual(primary, [{"id": "snotel-prairie", "kind": "station", "hardiness_zone": "5b", "mean_annual_extreme_min_f": -10.9,
                                    "record_low_f": -32.0, "period_start": 1991, "period_end": 2020}])
        months = query("SELECT * FROM site_climate_months ORDER BY month", self.root)
        self.assertEqual([m["month"] for m in months], list(range(1, 13)))
        july = months[6]
        self.assertEqual((july["high_f"], july["low_f"], july["daylight_hours"], july["precipitation_in"]), (86.4, 49.0, 15.03, 0.31))
        self.assertEqual(months[4]["frost_days_32f"], 10.0)
        # Freezes come in nearly every June and September, and in some Augusts, but almost never in July.
        self.assertEqual([m["years_with_32f_pct"] for m in months[5:9]], [89, 3, 15, 89])
        freeze = query("SELECT spring_p50, spring_p90, fall_p10, fall_p50, free_days_p10, free_days_p50, free_days_p90 FROM frost_summary "
                       "WHERE source_id = 'snotel-prairie' AND threshold_f = 32", self.root)[0]
        self.assertEqual(freeze, {"spring_p50": "06-17", "spring_p90": "06-24", "fall_p10": "08-31", "fall_p50": "09-09",
                                  "free_days_p10": 74, "free_days_p50": 90, "free_days_p90": 113})
        latest = query("SELECT year, last_spring, frost_free_days FROM frost_years WHERE source_id = 'snotel-prairie' AND threshold_f = 32 "
                       "ORDER BY last_spring_day DESC LIMIT 1", self.root)[0]
        self.assertEqual(latest, {"year": 2016, "last_spring": "2016-07-11", "frost_free_days": 64})
        shortest = query("SELECT MIN(frost_free_days) AS days, COUNT(frost_free_days) AS years FROM frost_years "
                         "WHERE source_id = 'snotel-prairie' AND threshold_f = 32", self.root)[0]
        self.assertEqual(shortest, {"days": 50, "years": 27})
        # The gridded models run warmer at night than the measured station, and the 1930s record runs colder.
        nights = query("SELECT source_id FROM temperature_months WHERE month = 1 ORDER BY low_f", self.root)
        self.assertEqual([r["source_id"] for r in nights], ["coop-prairie-historic", "snotel-prairie", "prism-lot", "daymet-lot"])
        sun = query("SELECT label, sunrise, sunset, day_length_hours, noon_altitude_deg FROM sun_key_dates ORDER BY date", self.root)
        self.assertEqual([r["label"] for r in sun], ["March equinox", "June solstice", "September equinox", "December solstice"])
        self.assertEqual((sun[1]["sunrise"], sun[1]["sunset"], sun[1]["day_length_hours"], sun[1]["noon_altitude_deg"]), ("06:02", "21:27", 15.42, 70.0))

    def test_database_allows_only_one_primary_climate_source(self):
        database = build(self.root, web=False)
        with contextlib.closing(sqlite3.connect(database)) as connection:
            with self.assertRaises(sqlite3.IntegrityError):
                connection.execute("UPDATE climate_sources SET role = 'primary' WHERE id = 'prism-lot'")

    def test_query_rebuilds_after_a_climate_change(self):
        path = self.root / "data" / "climate.json"
        climate = json.loads(path.read_text(encoding="utf-8"))
        climate["site"]["retrieved_on"] = "2026-10-19"
        path.write_text(json.dumps(climate), encoding="utf-8")
        self.assertEqual(query("SELECT retrieved_on FROM climate_site", self.root)[0]["retrieved_on"], "2026-10-19")

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
            ("plantings", lambda d: d["records"][0].update(planted_on="2026-13"), "planted_on must be YYYY-MM-DD, YYYY-MM, or null"),
            ("plantings", lambda d: d["records"][0].update(planted_on="2026-1"), "planted_on must be YYYY-MM-DD, YYYY-MM, or null"),
            ("plantings", lambda d: d["records"][0].update(planted_on="2026-10-32"), "planted_on must be YYYY-MM-DD, YYYY-MM, or null"),
            ("plantings", lambda d: d["records"][0].update(planted_on="0000-10"), "planted_on must be YYYY-MM-DD, YYYY-MM, or null"),
            ("plantings", lambda d: d["records"][0].update(planted_on="2026-00"), "planted_on must be YYYY-MM-DD, YYYY-MM, or null"),
            ("plantings", lambda d: d["records"][0].update(planted_on="\uff12\uff10\uff12\uff16-10"), "planted_on must be YYYY-MM-DD, YYYY-MM, or null"),
            ("plantings", lambda d: d["records"][0].update(planted_on=2026), "planted_on must be YYYY-MM-DD, YYYY-MM, or null"),
            ("plantings", lambda d: d["records"][0].update(planted_on="October 2026"), "planted_on must be YYYY-MM-DD, YYYY-MM, or null"),
            ("plantings", lambda d: d["records"][0].update(recorded_on="2026-10"), "recorded_on must be an ISO date or null|YYYY-MM-DD"),
            ("terrain", lambda d: d["grid"]["z"].pop(), "sample"),
            ("water_harvesting", lambda d: d["months"].pop(), "12"),
            ("water_harvesting", lambda d: d["months"].reverse(), "order"),
            ("water_harvesting", lambda d: d["catchments"][0].update(runoff_factor=1.5), "runoff"),
            ("climate", lambda d: d["site"].update(latitude=44.0), "match the lot center"),
            ("climate", lambda d: d["site"].update(normals_period=[2020, 1991]), "must not end before it starts"),
            ("climate", lambda d: d["frost"].update(thresholds_f=[32, 36, 28, 24]), "warmest to coldest"),
            ("climate", lambda d: d["frost"]["labels"].pop("24"), "one label"),
            ("climate", lambda d: d["sources"][1].update(role="primary"), "exactly one primary"),
            ("climate", lambda d: d["sources"][0].update(role="check"), "exactly one primary"),
            ("climate", lambda d: d["sources"][0].update(url="http://example.com"), "url must use https"),
            ("climate", lambda d: d["sources"][0].update(kind="guess"), "kind must be station or model"),
            ("climate", lambda d: d["sources"][3].update(period=[1941, 1926]), "must not end before it starts"),
            ("climate", lambda d: d["sources"][0]["temperature"]["low_f"].__setitem__(0, 90), "average low must be below"),
            ("climate", lambda d: d["sources"][0]["temperature"]["high_f"].pop(), "12 monthly values"),
            ("climate", lambda d: d["sources"][0]["annual_extreme_min"].update(zone="6a"), "hardiness zone does not match"),
            ("climate", lambda d: d["sources"][0]["annual_extreme_min"].update(coldest_on="2025-01-01"), "inside the source period"),
            ("climate", lambda d: d["sources"][0]["annual_extreme_min"].update(record_low_f=-5), "cannot be warmer"),
            ("climate", lambda d: d["sources"][0]["annual_extreme_min"].pop("record_low_on"), "go together"),
            ("climate", lambda d: d["sources"][1]["frost"]["summary"].pop("24"), "needs every threshold"),
            ("climate", lambda d: d["sources"][0]["frost"]["summary"]["32"]["first_fall"].update(p10="08-01"), "earliest to latest"),
            ("climate", lambda d: d["sources"][0]["frost"]["summary"]["32"]["last_spring"].update(p50="02-30"), "must be MM-DD"),
            ("climate", lambda d: d["sources"][0]["frost"]["summary"]["32"]["frost_free_days"].update(p50=10), "shortest to longest"),
            ("climate", lambda d: d["sources"][0]["frost"]["summary"]["32"]["last_spring"].update(p50="06-18"), "does not match the yearly dates"),
            ("climate", lambda d: d["sources"][0]["frost"]["summary"]["28"].update(years_both=99), "years_both cannot exceed"),
            ("climate", late_spring_at_24_f, "median last_spring dates must move"),
            ("climate", lambda d: d["sources"][0]["frost"]["years"][0]["last_spring"].update({"32": "1994-08-01"}), "must fall from"),
            ("climate", lambda d: d["sources"][0]["frost"]["years"][0]["first_fall"].update({"32": "1994-09-01"}), "disagree between thresholds"),
            ("climate", lambda d: d["sources"][0]["frost"]["years"][1].update(year=1994), "oldest first"),
            ("climate", lambda d: d["sources"][0]["frost"]["years"][0]["last_spring"].pop("24"), "needs every threshold"),
            ("climate", lambda d: d["sources"][0]["frost"].pop("years"), "missing fields"),
            ("climate", lambda d: d["sources"][0]["frost"]["monthly_days"]["28"]["avg_days"].__setitem__(0, 31.0), "colder threshold cannot have more"),
            ("climate", lambda d: d["sources"][0]["frost"]["monthly_days"]["32"]["avg_days"].__setitem__(6, 31.5), "more frost days or years than it can"),
            ("climate", lambda d: d["sources"][0]["frost"]["monthly_days"]["32"]["years_with_pct"].__setitem__(7, 0), "frost days but no year with one"),
            ("climate", lambda d: d["daylight"]["months"][5].update(mean_hours=14.0), "does not match the site latitude"),
            ("climate", lambda d: d["daylight"]["months"].reverse(), "January-to-December order"),
            ("climate", lambda d: d["daylight"]["crossings"].update({"14": ["04-01", "08-14"]}), "do not match the site latitude"),
            ("climate", lambda d: d["daylight"]["key_dates"][1].update(sunrise="07:30"), "does not match the site location"),
            ("climate", lambda d: d["daylight"]["key_dates"][1].update(day_length_hours=16.5), "does not match the site location"),
            ("climate", lambda d: d["daylight"]["key_dates"][1].update(date="2027-06-21"), "reference year"),
            ("climate", lambda d: d["daylight"]["key_dates"][1].update(sunrise="6:02"), "must be HH:MM"),
            ("climate", lambda d: d.update(notes=[]), "notes must be a list"),
            ("climate", lambda d: d.update(source_page=None), "source_page must be nonempty text"),
            ("climate", lambda d: d.update(site=None), "climate site must be an object"),
            ("climate", lambda d: d["site"].update(elevation_ft=47), "within 30 ft"),
            ("climate", lambda d: d["site"].update(normals_period=[1990, 2020]), "must match the site's normals period"),
            ("climate", lambda d: d["frost"].update(labels=None), "frost labels must be an object"),
            ("climate", lambda d: d["frost"].update(definitions=None), "frost definitions must be an object"),
            ("climate", lambda d: d["sources"].pop(1), "need prism-lot"),
            ("climate", lambda d: d["sources"][3].update(id="old-station"), "need coop-prairie-historic"),
            ("climate", lambda d: d["sources"][1].update(distance_from_site_mi=9.9), "distance_from_site_mi should be about"),
            ("climate", lambda d: d["sources"][0]["annual_extreme_min"].update(years=31), "more coldest-night years"),
            ("climate", lambda d: d["sources"][0]["frost"].update(summary=None), "frost summary must be an object"),
            ("climate", lambda d: d["sources"][1]["frost"]["summary"]["32"]["first_fall"].update(earliest="06-17"), "on or after Aug 1"),
            ("climate", lambda d: d["sources"][1]["frost"]["summary"]["32"]["last_spring"].update(latest="12-31"), "on or before Jul 31"),
            ("climate", lambda d: d["sources"][1]["frost"]["summary"]["32"]["frost_free_days"].update(longest=9999), "fit between the spring and fall dates"),
            ("climate", lambda d: d["sources"][1]["frost"]["summary"]["32"]["frost_free_days"].update(shortest=7), "fit between the spring and fall dates"),
            ("climate", lambda d: d["sources"][1]["frost"]["summary"]["32"].update(years_spring=99, years_fall=99, years_both=99), "more years with a freeze date"),
            ("climate", lambda d: d["sources"][1]["frost"]["summary"]["32"].update(years_both=7), "too few years with both dates"),
            ("climate", lambda d: d["daylight"].update(months=None), "months must be a list of records"),
            ("climate", lambda d: d["daylight"]["months"][3].pop("mean_hours"), "missing fields"),
            ("climate", lambda d: d["daylight"].update(crossings=None), "crossings must be an object"),
            ("climate", lambda d: d["daylight"]["crossings"].pop("15"), "need 15 hours"),
            ("climate", lambda d: d["daylight"].update(key_dates=None), "key dates must be a list"),
            ("climate", lambda d: d["daylight"]["key_dates"].pop(1), "need june-solstice"),
            ("climate", lambda d: d["daylight"]["key_dates"][3].update(id="midwinter"), "need december-solstice"),
            ("climate", lambda d: d["daylight"]["key_dates"][1].update(clock="MST"), "the lot keeps Mountain Time"),
            ("climate", lambda d: d["notes"].pop(), "at least three notes"),
            ("climate", lambda d: d["notes"].__setitem__(2, "Plant nothing before June."), "about cold air"),
            ("inventory", lambda d: d["records"][0].update(quantity=0), "quantity"),
            ("orchard", lambda d: d["rules"]["UNIDENTIFIED_APPLES"]["candidates"][2].update(slots=1), "slots disagree"),
            ("orchard", lambda d: d["rules"]["UNIDENTIFIED_APPLES"]["candidates"].pop(3), "omit"),
            ("orchard", lambda d: d["rules"]["UNIDENTIFIED_APPLES"]["candidates"][5].update(rows=[19]), "whole purchase group"),
            ("orchard", lambda d: d["rules"]["UNIDENTIFIED_APPLES"]["candidates"][0].update(vendors=["Costco"]), "vendors"),
            ("cultivar_library", lambda d: d["records"][0].update(ripening="Soon"), "ripening"),
            ("cultivar_library", lambda d: d["records"].pop(0), "without a cultivar profile"),
            ("cultivar_library", lambda d: d["records"][1].update(inventory_rows=d["records"][0]["inventory_rows"]), "linked to both"),
            ("cultivar_library", lambda d: d["records"][0].update(tagline="short"), "characters"),
            ("cultivar_library", lambda d: d["records"][0].update(sources=[["Example label", "http://example.com/page"]]), "https"),
            ("cultivar_library", lambda d: d["unprofiled"].update({"26": "Listed twice"}), "both profiled and unprofiled"),
            ("cultivar_library", lambda d: d["records"][0].update(basis="guess"), "basis"),
            ("cultivar_library", lambda d: d["records"][0].update(kind="cluster"), "kind"),
            ("cultivar_library", lambda d: d["records"][0].update(aliases=["Same name", "Same name"]), "aliases must be distinct"),
            ("cultivar_library", lambda d: d["records"][0].update(bark="too short"), "characters or null"),
            ("cultivar_library", lambda d: d["records"][0].pop("leaf"), "leaf"),
            ("cultivar_library", lambda d: d["unprofiled"].update({"19": "Douglas-fir listed twice"}), "both profiled and unprofiled"),
            ("cultivar_library", lambda d: d["group_notes"][0].update(bark="too short"), "bark must be 40"),
            ("cultivar_library", lambda d: d["group_notes"].append(copy.deepcopy(d["group_notes"][0])), "duplicated"),
            ("cultivar_library", lambda d: d["group_notes"][0].update(sources=[]), "at least one source"),
            ("cultivar_library", lambda d: next(r for r in d["records"] if r["id"] == "ash").update(seed_rows=[8]), "linked to both"),
            ("cultivar_library", lambda d: next(r for r in d["records"] if r["id"] == "ash").update(seed_rows=[1]), "missing or out-of-scope row 1"),
            ("cultivar_library", lambda d: next(r for r in d["records"] if r["id"] == "ash").pop("seed_rows"), "without a cultivar profile"),
            ("orchard", lambda d: d["rules"]["UNIDENTIFIED_STONE_FRUIT"]["lines"][0]["candidates"][0].update(slots=1), "slots disagree"),
            ("orchard", lambda d: d["rules"]["UNIDENTIFIED_STONE_FRUIT"]["lines"][1]["candidates"].pop(0), "omit"),
            ("orchard", lambda d: d["rules"]["UNIDENTIFIED_STONE_FRUIT"]["lines"][0].update(type="Apple"), "must be one of"),
            ("orchard", lambda d: d["rules"]["UNIDENTIFIED_STONE_FRUIT"]["lines"][2]["candidates"][0].update(compare_with=[81]), "compare_with must be other apricot"),
            ("orchard", lambda d: d["rules"]["UNIDENTIFIED_STONE_FRUIT"]["lines"][0].update(label="1 bad"), "label must be"),
            ("orchard", lambda d: d["rules"]["UNIDENTIFIED_STONE_FRUIT"]["lines"][0].pop("label"), "missing fields"),
            ("orchard", lambda d: d["rules"]["UNIDENTIFIED_STONE_FRUIT"]["lines"][1].update(label="Sweet"), "used by more than one line"),
            ("orchard", lambda d: d["rules"]["UNIDENTIFIED_STONE_FRUIT"]["lines"][0].update(label="UnKn"), "used by more than one line"),
            ("orchard", lambda d: d["rules"]["UNIDENTIFIED_STONE_FRUIT"]["lines"][0]["candidates"][0].update(compare_with=[73]), "repeats row 73"),
            ("orchard", lambda d: d["rules"]["UNIDENTIFIED_STONE_FRUIT"]["lines"].append(
                copy.deepcopy(d["rules"]["UNIDENTIFIED_STONE_FRUIT"]["lines"][0])), "listed twice"),
            ("orchard", lambda d: plan_item(d, "williams-pride").update(quantity=2), "quantity must equal"),
            ("orchard", lambda d: plan_item(d, "williams-pride")["spots"].__setitem__(0, "R6-C8"), "used twice"),
            ("orchard", lambda d: plan_item(d, "williams-pride")["spots"].__setitem__(0, "R1-C1"), "grafted trees go in reserved spots"),
            ("orchard", lambda d: plan_item(d, "williams-pride")["spots"].__setitem__(0, "R9-C2"), "disagrees with its recorded replacement"),
            ("orchard", lambda d: plan_item(d, "williams-pride")["spots"].__setitem__(0, "R20-C1"), "unknown orchard spot"),
            ("orchard", lambda d: plan_item(d, "williams-pride").update(profile="missing"), "or a place in the planting plan"),
            ("orchard", lambda d: plan_item(d, "williams-pride").update(code="wlp"), "unique 2 to 4 letter"),
            ("orchard", lambda d: plan_item(d, "williams-pride").update(colour="red"), "unknown fields"),
            ("orchard", lambda d: plan_item(d, "williams-pride").pop("flowering_group"), "flowering_group"),
            ("orchard", lambda d: plan_item(d, "dayton").update(type="Grape"), "type must be one of"),
            ("orchard", lambda d: plan_item(d, "harrow-delight").pop("self_fertile"), "self_fertile"),
            ("orchard", lambda d: plan_item(d, "harrow-delight").update(pear_bloom=["Mid"]), "pear_bloom"),
            ("orchard", lambda d: plan_item(d, "black-gold").update(cherry_chart={"group": None, "bloom": 9}), "cherry bloom must be 1 to 6"),
            ("orchard", lambda d: plan_item(d, "dayton").update(self_fertile=True), "unknown fields"),
            ("orchard", lambda d: plan_item(d, "harrow-delight").update(flowering_group=2), "unknown fields"),
            ("orchard", lambda d: plan_item(d, "harrow-delight").update(pear_bloom=["Mid", "Mid"]), "pear_bloom needs"),
            ("orchard", lambda d: plan_item(d, "black-gold").update(self_fertile="yes"), "self_fertile must be true or false"),
            ("orchard", add_plan_item_with_dayton_profile, "repeats a profile"),
            ("orchard", lambda d: plan_item(d, "dayton").update(method="seed"), "method must be one of"),
            ("orchard", lambda d: plan_item(d, "redfree").update(type="Pear"), "only apples are grafted"),
            ("orchard", lambda d: plan_item(d, "redfree")["spots"].__setitem__(0, "R13-C1"), "grafted trees go in reserved spots"),
            ("orchard", lambda d: d["rules"]["PLANTING_PLAN"].pop("graft_advice"), "graft_advice"),
            ("orchard", lambda d: d["rules"]["PLANTING_PLAN"].pop("covers_rows"), "covers_rows"),
            ("orchard", lambda d: d["rules"]["PLANTING_PLAN"].update(covers_rows=16), "more than the orchard has"),
            ("orchard", lambda d: plan_item(d, "surefire").update(self_fertile=False), "needs a cherry_chart"),
            ("orchard", lambda d: plan_item(d, "stanley").update(self_fertile=False), "cannot pair a plum"),
            ("orchard", lambda d: plan_item(d, "seckel").update(not_pollinated_by="Bartlett"), "not_pollinated_by must be a list"),
            ("orchard", lambda d: plan_item(d, "dayton").update(not_pollinated_by=[""]), "not_pollinated_by must be a list"),
            ("orchard", lambda d: plan_item(d, "seckel").update(not_pollinated_by=["Bartlett "]), "must not start or end with a space"),
            ("orchard", lambda d: plan_item(d, "seckel").update(not_pollinated_by=["Barlett", "Red Bartlett"]), "matches no living or planned pear"),
            ("orchard", lambda d: plan_item(d, "dayton").update(not_pollinated_by=["Kumquat"]), "matches no living or planned apple"),
            ("orchard", lambda d: plan_item(d, "dayton").update(not_pollinated_by=["Dayton"]), "matches no living or planned apple"),
            ("orchard", lambda d: plan_item(d, "seckel").update(not_pollinated_by=["Dayton"]), "matches no living or planned pear"),
            ("orchard", lambda d: (plan_item(d, "stanley")["spots"].pop(), plan_item(d, "stanley").update(quantity=2)),
             "have no planting plan item"),
            ("plants", lambda d: [p.update(health_status="dead") for p in d["records"] if p["id"] in ("i56-2", "i56-3")],
             "rootstocks are unplanted"),
            ("orchard", lambda d: d["rules"]["PLANTING_PLAN"].update(year=1999), "planting plan year"),
            ("cultivar_library", lambda d: next(r for r in d["records"] if r["id"] == "apple-dayton").update(type="Pear"), "disagrees with Apple"),
            ("locations", lambda d: next(r for r in d["records"] if r["name"] == "R13-C1").update(replacement_year=2027, replacement_type="Apple"),
             "without a planting plan item"),
        ]
        for collection, change, message in cases:
            data = copy.deepcopy(self.data)
            change(data[collection])
            with self.subTest(collection=collection, message=message), self.assertRaisesRegex(ValueError, message):
                validate_data(data)

    def test_malformed_climate_records_fail_with_a_clear_error_not_a_crash(self):
        def sampled_paths(node, prefix=()):
            """Every field, keeping only the first and last of a long list or of numbered keys (thresholds, hours), which behave alike."""
            yield prefix
            if isinstance(node, dict):
                keys = list(node)
                if len(keys) > 3 and all(key.isdigit() for key in keys):
                    keys = [keys[0], keys[-1]]
                children = [(key, node[key]) for key in keys]
            elif isinstance(node, list):
                indexes = range(len(node)) if len(node) <= 2 else (0, len(node) - 1)
                children = [(index, node[index]) for index in indexes]
            else:
                return
            for key, child in children:
                yield from sampled_paths(child, prefix + (key,))

        def at(climate, path):
            for step in path:
                climate = climate[step]
            return climate

        replacements = {"null": None, "string": "x", "empty object": {}, "empty list": []}
        tried = 0
        for path in sampled_paths(self.data["climate"]):
            if not path:
                continue
            container = isinstance(at(self.data["climate"], path), (dict, list))
            for kind in (("delete", *replacements) if container else ("delete", "null")):
                climate = copy.deepcopy(self.data["climate"])
                parent = at(climate, path[:-1])
                if kind == "delete":
                    parent.pop(path[-1])
                else:
                    parent[path[-1]] = copy.deepcopy(replacements[kind])
                tried += 1
                with self.subTest(path=path, kind=kind):
                    try:
                        validate_data({**self.data, "climate": climate})
                    except ValueError:
                        pass
        self.assertGreater(tried, 300, "The walk should reach most of the climate record")

    def test_not_pollinated_by_names_must_match_a_living_or_planned_cultivar(self):
        # The names the shipped plan relies on, in any letter case, and a planned cultivar's name all validate.
        for changes in ({"seckel": ["Bartlett", "Red Bartlett"]}, {"seckel": ["bartlett", "red bartlett", "COMICE"]},
                        {"dayton": ["priscilla", "Honeycrisp"]}):
            data = copy.deepcopy(self.data)
            for item_id, names in changes.items():
                plan_item(data["orchard"], item_id)["not_pollinated_by"] = names
            with self.subTest(changes=changes):
                validate_data(data)
        # A tree that is dead or outside the orchard is not a donor, so its name excludes nothing.
        data = copy.deepcopy(self.data)
        plan_item(data["orchard"], "seckel")["not_pollinated_by"] = ["Pineapple"]
        with self.assertRaisesRegex(ValueError, "matches no living or planned pear"):
            validate_data(data)

    def test_unidentified_apple_candidates_follow_purchases_and_inventory(self):
        info = self.data["orchard"]["rules"]["UNIDENTIFIED_APPLES"]
        unknown = next(r for r in self.data["inventory"]["records"] if r["source_row"] == info["inventory_row"])
        self.assertEqual((unknown["metal_tag"], unknown["quantity"]), ("AL-UnKn", 6))
        self.assertEqual(sum(c["slots"] for c in info["candidates"]), 11)
        self.assertEqual([c["rows"] for c in info["candidates"] if "long_shot" in c], [[13]])
        stored = query("SELECT json_extract(data_json, '$.rules.UNIDENTIFIED_APPLES.stated_on') AS stated "
                       "FROM source_documents WHERE name = 'orchard'", self.root)
        self.assertEqual(stored[0]["stated"], "2026-10-16")
        data = copy.deepcopy(self.data)
        next(r for r in data["inventory"]["records"] if r["source_row"] == 29)["quantity"] = 4
        with self.assertRaisesRegex(ValueError, "slots disagree"):
            validate_data(data)

    def test_unidentified_stone_fruit_candidates_follow_purchases_and_inventory(self):
        info = self.data["orchard"]["rules"]["UNIDENTIFIED_STONE_FRUIT"]
        inventory = {r["source_row"]: r for r in self.data["inventory"]["records"]}
        lines = {line["type"]: line for line in info["lines"]}
        self.assertEqual({kind: (inventory[line["inventory_row"]]["metal_tag"], inventory[line["inventory_row"]]["quantity"])
                          for kind, line in lines.items()},
                         {"Cherry": ("CR-Sweet", 3), "Peach": ("PC-Unk", 2), "Apricot": ("AT-Unk", 1)})
        self.assertEqual({kind: sum(c["slots"] for c in line["candidates"]) for kind, line in lines.items()},
                         {"Cherry": 4, "Peach": 4, "Apricot": 1})
        self.assertEqual(lines["Apricot"]["candidates"][0]["compare_with"], [70],
                         "Two trees are tagged Moorpark but one was bought, so those trees are compared too")
        stored = query("SELECT json_extract(data_json, '$.rules.UNIDENTIFIED_STONE_FRUIT.lines[0].type') AS type "
                       "FROM source_documents WHERE name = 'orchard'", self.root)
        self.assertEqual(stored[0]["type"], "Cherry")
        data = copy.deepcopy(self.data)
        next(r for r in data["inventory"]["records"] if r["source_row"] == 73)["quantity"] = 1
        with self.assertRaisesRegex(ValueError, "slots disagree"):
            validate_data(data)

    def test_seed_list_species_all_have_profiles(self):
        rows = query("SELECT source_row, species, profile_id FROM seed_list ORDER BY source_row", self.root)
        self.assertEqual(len(rows), 28)
        self.assertTrue(all(r["profile_id"] for r in rows), "Every species on the seed list has a profile")
        by_row = {r["source_row"]: r["profile_id"] for r in rows}
        self.assertEqual((by_row[7], by_row[13], by_row[30]), ("ash", "juniper-rocky-mountain", "serviceberry-western"))
        links = query("SELECT link_type, COUNT(*) AS n FROM cultivar_profile_links GROUP BY link_type", self.root)
        self.assertEqual({r["link_type"]: r["n"] for r in links}, {"inventory": 114, "purchase": 105, "seed": 28})
        self.assertEqual(len(self.data["catalog"]["fruit_records"]), 105, "Every purchase-list cultivar has a profile")
        build(self.root)
        generated = (self.root / "docs" / "data" / "orchard_model.js").read_text(encoding="utf-8")
        self.assertIn('"SEED_LIST":{"2":{"name":"Acer Japanese Maple"', generated)

    def test_blank_seed_list_cells_are_not_species(self):
        path = self.root / "data" / "catalog.json"
        catalog = json.loads(path.read_text(encoding="utf-8"))
        catalog["workbook_records"].append({"id": "Trees:Trees:31", "workbook": "Trees.xlsx", "sheet": "Trees",
                                            "source_row": 31, "values": {"B": " ", "F": " "}})
        path.write_text(json.dumps(catalog), encoding="utf-8")
        validate_data(load_data(self.root))
        self.assertEqual(query("SELECT COUNT(*) AS n FROM seed_list", self.root)[0]["n"], 28)

    def test_cultivar_library_is_queryable_and_covers_the_inventory(self):
        counts = query("SELECT COUNT(*) AS profiles, "
                       "(SELECT COUNT(*) FROM cultivar_profile_links WHERE link_type = 'inventory') AS inventory_links "
                       "FROM cultivar_profiles", self.root)[0]
        self.assertEqual((counts["profiles"], counts["inventory_links"]), (162, 114))
        cortland = query("SELECT profile_name, ripening FROM plant_profiles WHERE plant_id = 'i29-1'", self.root)[0]
        self.assertEqual((cortland["profile_name"], cortland["ripening"]), ("Cortland", "Mid"))
        unknown = query("SELECT profile_id FROM plant_profiles WHERE plant_id = 'i62-1'", self.root)[0]
        self.assertIsNone(unknown["profile_id"], "Unidentified apples have no profile")
        by_tag = query("SELECT DISTINCT profile_name FROM plant_profiles WHERE metal_tag = 'AL-Zestar'", self.root)
        self.assertEqual([r["profile_name"] for r in by_tag], ["Zestar!"])
        self.assertEqual(sorted(self.data["cultivar_library"]["unprofiled"], key=int), ["61", "62", "71", "81", "91"])
        self.assertEqual(query("SELECT COUNT(DISTINCT plant_id) AS n FROM plant_profiles WHERE profile_id IS NULL", self.root)[0]["n"], 13)

    def test_cultivar_library_covers_trees_perennials_traits_and_group_notes(self):
        fir = query("SELECT profile_id, bark, leaf FROM plant_profiles WHERE metal_tag = 'Dg. Fir'", self.root)
        self.assertEqual({r["profile_id"] for r in fir}, {"douglas-fir"})
        self.assertTrue(all(r["bark"] and r["leaf"] for r in fir), "Species profiles describe their own bark and leaves")
        groups = {r["plant_group"] for r in query("SELECT plant_group FROM cultivar_profiles", self.root)}
        self.assertTrue({"Evergreen", "Shade tree", "Perennial"} <= groups)
        rootstock = query("SELECT kind FROM cultivar_profiles WHERE id = 'rootstock-m111'", self.root)[0]
        self.assertEqual(rootstock["kind"], "rootstock")
        bare = query("SELECT id FROM cultivar_profiles WHERE kind <> 'cultivar' AND kind <> 'rootstock' "
                     "AND habit IS NULL AND bark IS NULL AND leaf IS NULL", self.root)
        self.assertEqual(bare, [], "A species or genus profile is the plant itself, so it needs some tree description")
        notes = query("SELECT plant_group FROM cultivar_group_notes ORDER BY plant_group", self.root)
        self.assertEqual([r["plant_group"] for r in notes], ["Apple", "Apricot", "Cherry", "Peach", "Pear", "Plum"])
        sources = query("SELECT COUNT(*) AS n FROM cultivar_group_note_sources WHERE url NOT LIKE 'https://%'", self.root)
        self.assertEqual(sources[0]["n"], 0)
        every_source = query("SELECT COUNT(*) AS n FROM cultivar_profile_sources WHERE url NOT LIKE 'https://%'", self.root)
        self.assertEqual(every_source[0]["n"], 0)

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
