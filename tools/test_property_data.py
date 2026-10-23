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
from site_climate import bearing_degrees, distance_miles, parse_month_day
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


def swap_storm_rows(baselines):
    """Swap the 60-minute and 2-hour depths, so a longer storm has less rain than a shorter one."""
    table = baselines["storms"]["depth_in"]
    table[4], table[5] = table[5], table[4]


def distort_january_and_december_sun(baselines):
    """Move 5 MJ from December to January: the yearly average holds, but both months become physically impossible."""
    months = baselines["sun"]["sources"][0]["monthly"]
    months[0] += 5
    months[11] -= 5


def swap_first_two_hail_events(baselines):
    events = baselines["hail"]["events"]
    events[0], events[1] = events[1], events[0]


def named(sources, name):
    return next(source for source in sources if source["id"] == name)


def shed_photos(site):
    return next(f for f in site["features"] if f["id"] == "shed")["photos"]


def drop_storm_duration(baselines, name):
    storms = baselines["storms"]
    index = storms["durations"].index(name)
    del storms["durations"][index], storms["duration_hours"][index]


def scale_monthly(source, key, factor):
    source[key] = [value * factor for value in source[key]]


def scale_solar_source(baselines, name, factor):
    """Scale a solar source's months and its annual average together, so only the spread between the sources is wrong."""
    source = named(baselines["sun"]["sources"], name)
    scale_monthly(source, "monthly", factor)
    source["annual"] *= factor


def shrink_five_minute_storms(baselines):
    """Make the 5-minute depths so small that their rate in inches per hour is below the 10-minute rate, while every depth still rises."""
    baselines["storms"]["depth_in"][0] = [0.001 * (index + 1) for index in range(10)]


def move_wind_source(baselines, site, name, latitude, longitude):
    """Move a wind source and restate its distance and bearing, so only the rule about how far the model's cell may be can fail."""
    named(baselines["wind"]["sources"], name).update(
        latitude=latitude, longitude=longitude, bearing_deg=int(bearing_degrees(site["latitude"], site["longitude"], latitude, longitude)),
        distance_mi=round(distance_miles(site["latitude"], site["longitude"], latitude, longitude), 1))


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
        self.assertEqual(len(items), 29)
        self.assertEqual(sum(r["quantity"] for r in items), 49)
        spots = query("SELECT spot, state, type, method, cultivar FROM planned_spots ORDER BY orchard_row, orchard_column", self.root)
        self.assertEqual(len(spots), 49)
        self.assertTrue(all(r["state"] in ("open", "reserved") for r in spots), "Planned spots are still empty")
        by_type = {}
        for r in spots:
            by_type[r["type"]] = by_type.get(r["type"], 0) + 1
        self.assertEqual(by_type, {"Apple": 26, "Pear": 2, "Cherry": 11, "Peach": 4, "Plum": 4, "Apricot": 2})
        wanted = ("R8-C1", "R8-C13", "R9-C2", "R11-C4", "R11-C5", "R11-C7", "R11-C10", "R12-C3", "R12-C4", "R12-C7", "R12-C8")
        self.assertEqual({r["spot"]: r["cultivar"] for r in spots if r["spot"] in wanted},
                         {"R8-C1": "Harrow Delight", "R8-C13": "Seckel", "R9-C2": "Black Gold", "R11-C4": "Chinese (Mormon)", "R11-C5": "Harcot",
                          "R11-C7": "Mount Royal", "R11-C10": "Intrepid", "R12-C3": "Stanley", "R12-C4": "Damson", "R12-C7": "Mount Royal",
                          "R12-C8": "Reliance"})
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
        self.assertEqual(linked, 29)
        validate_data(self.data)

    def test_features_terrain_water_and_gps_are_queryable(self):
        self.assertEqual(query("SELECT COUNT(*) AS n FROM site_features", self.root)[0]["n"], 69)
        self.assertEqual(query("SELECT COUNT(*) AS n FROM site_features WHERE kind = 'valve_box'", self.root)[0]["n"], 15)
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
        counts = {"climate_sources": 4, "temperature_months": 48, "frost_summary": 16, "frost_days": 48, "frost_years": 124, "climate_checks": 8,
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

    def test_things_still_to_check_are_queryable_and_can_be_settled(self):
        checks = query("SELECT id, status, resolved_on, result FROM climate_checks ORDER BY position", self.root)
        self.assertEqual([r["id"] for r in checks], ["usda-zone-map", "bloom-dates", "cold-air-drainage", "minimum-thermometer", "wind-direction",
                                                     "county-snow-load", "county-frost-depth", "station-vs-baselines"])
        # The official USDA map was read on 2026-10-18 and the county snow load was settled on 2026-10-23; the other six wait on the lot's own seasons,
        # the county, or a year of station readings.
        by_id = {r["id"]: r for r in checks}
        self.assertEqual((by_id["usda-zone-map"]["status"], by_id["usda-zone-map"]["resolved_on"]), ("done", "2026-10-18"))
        self.assertIn("zone 6a", by_id["usda-zone-map"]["result"])
        self.assertIn("-6.6 F", by_id["usda-zone-map"]["result"])
        self.assertEqual((by_id["county-snow-load"]["status"], by_id["county-snow-load"]["resolved_on"]), ("done", "2026-10-23"))
        self.assertIn("120 pounds per square foot", by_id["county-snow-load"]["result"])
        self.assertIn("neighbor", by_id["county-snow-load"]["result"])
        self.assertTrue(all(r["status"] == "open" and r["resolved_on"] is None and r["result"] is None
                            for r in checks if r["id"] not in ("usda-zone-map", "county-snow-load")))
        # Settling a check means a status, a date, and what was found; the database follows the JSON.
        path = self.root / "data" / "climate.json"
        climate = json.loads(path.read_text(encoding="utf-8"))
        climate["checks"][1].update(status="done", resolved_on="2027-05-10", result="First bloom was on April 29.")
        path.write_text(json.dumps(climate), encoding="utf-8")
        settled = query("SELECT id, status, resolved_on, result FROM climate_checks WHERE status = 'done' ORDER BY position", self.root)
        self.assertEqual([r["id"] for r in settled], ["usda-zone-map", "bloom-dates", "county-snow-load"])
        self.assertEqual(settled[1], {"id": "bloom-dates", "status": "done", "resolved_on": "2027-05-10", "result": "First bloom was on April 29."})
        validate_data(load_data(self.root))

    def test_site_baselines_are_queryable(self):
        # A swale or spillway is sized from a design storm; the 90 percent interval says how sure NOAA is of the depth.
        storm = query("SELECT depth_in, lower_in, upper_in FROM design_storms WHERE duration = '24-hr' AND return_years = 25", self.root)[0]
        self.assertEqual((storm["depth_in"], storm["lower_in"], storm["upper_in"]), (2.55, 2.29, 2.83))
        self.assertEqual(query("SELECT COUNT(*) AS n FROM design_storms", self.root)[0]["n"], 19 * 10)
        # The two driest snow years on record are 1992 and 2026, and the station's median peak is Feb 20.
        lowest = query("SELECT water_year FROM snow_years ORDER BY peak_swe_in, water_year LIMIT 2", self.root)
        self.assertEqual([row["water_year"] for row in lowest], [1992, 2026])
        peak = query("SELECT years, p10, p50, p90, maximum FROM baseline_summary WHERE topic = 'snow' AND measure = 'peak_swe_in'", self.root)[0]
        self.assertEqual(peak, {"years": 30, "p10": 3.2, "p50": 5.8, "p90": 8.5, "maximum": 9.7})
        self.assertEqual(query("SELECT p50 FROM snow_date_summary WHERE measure = 'peak_on'", self.root)[0]["p50"], "02-20")
        # A water year whose peak came in December (day numbers count from October 1) sorts before one that peaked in February.
        order = query("SELECT water_year FROM snow_years WHERE water_year IN (1997, 2026) ORDER BY peak_day", self.root)
        self.assertEqual([row["water_year"] for row in order], [1997, 2026])
        # The month-by-month view lines the station's rain up beside the PRISM model's and the other baselines.
        months = query("SELECT * FROM site_baseline_months ORDER BY month", self.root)
        self.assertEqual([row["month"] for row in months], list(range(1, 13)))
        self.assertAlmostEqual(sum(row["snotel_precip_in"] for row in months), 21.54, places=2)
        self.assertLess(max(abs(row["snotel_precip_in"] - row["prism_precip_in"]) for row in months), 0.15)
        july = months[6]
        self.assertEqual((july["gdd_50"], july["gdd_43"], july["solar_mj"], july["humidity_pct"]), (591, 799, 28.09, 37.0))
        self.assertTrue(all(row[key] is not None for row in months for key in row))
        # Degree days from hourly readings come out well above the daily-average shortcut.
        gdd = {row["measure"]: row["p50"] for row in query("SELECT measure, p50 FROM baseline_summary WHERE topic = 'gdd'", self.root)}
        self.assertEqual((gdd["hourly_50"], gdd["daily_average_50"], gdd["hourly_43"], gdd["daily_average_43"]), (2104, 1806, 3190, 2952))
        chill = query("SELECT years, minimum, p50, maximum FROM baseline_summary WHERE topic = 'chill' AND measure = 'hours_32_45'", self.root)[0]
        self.assertEqual(chill, {"years": 21, "minimum": 612, "p50": 872, "maximum": 1338})
        # The stations and the model disagree about winter wind: east at the model and Mountain Home, west at Pine Turnoff.
        top = {row["source_id"]: row["sector"] for row in query(
            "SELECT source_id, sector FROM wind_rose r WHERE season = 'winter' AND pct = "
            "(SELECT MAX(pct) FROM wind_rose WHERE source_id = r.source_id AND season = 'winter')", self.root)}
        self.assertEqual(top, {"hrrr-lot": "E", "pine-turnoff-rwis": "W", "muo-asos": "E"})
        self.assertEqual(query("SELECT COUNT(*) AS n FROM wind_rose", self.root)[0]["n"], 3 * 4 * 16)
        # The county's values carry their numbers, the documents they came from, and the caution about each.
        values = {row["id"]: row for row in query("SELECT id, value, numeric_value, unit FROM building_values", self.root)}
        self.assertEqual([values[key]["numeric_value"] for key in ("frost-depth", "ground-snow-load", "wind-speed")], [30, 120, 115])
        self.assertEqual((values["seismic-zone"]["value"], values["seismic-zone"]["numeric_value"]), ("C", None))
        snow_sources = query("SELECT s.id FROM building_value_sources v JOIN building_sources s ON s.id = v.source_id "
                             "WHERE v.value_id = 'ground-snow-load' ORDER BY s.id", self.root)
        self.assertEqual([row["id"] for row in snow_sources], ["permit-application", "permit-requirements", "snow-load-map"])
        # The only hail within 5 miles was reported at Prairie in 2019, and the 25-mile list is every report the source has.
        near = query("SELECT date, size_in FROM hail_events WHERE distance_mi < 5 ORDER BY date", self.root)
        self.assertEqual(near, [{"date": "2019-07-09", "size_in": 1.25}, {"date": "2019-08-10", "size_in": 1.75}])
        self.assertEqual(query("SELECT COUNT(*) AS n FROM hail_events", self.root)[0]["n"], 9)
        # Every source is listed once per topic, and exactly one source per single-source topic is primary.
        sources = query("SELECT topic, COUNT(*) AS n, SUM(is_primary) AS primaries FROM baseline_sources GROUP BY topic ORDER BY topic", self.root)
        self.assertEqual({row["topic"]: (row["n"], row["primaries"]) for row in sources},
                         {"snow": (1, 1), "storms": (1, 1), "growth": (1, 1), "wind": (4, 0), "sun": (3, 1), "humidity": (2, 1), "hail": (1, 1)})
        notes = query("SELECT COUNT(*) AS n FROM baseline_notes WHERE topic = 'snow'", self.root)[0]["n"]
        self.assertEqual(notes, 8)

    def test_a_new_snow_year_changes_the_summary_only_when_it_is_in_the_normals(self):
        # The rows 1987 to 1990 and 2021 to 2026 are context; the summary covers the 30 water years 1991 to 2020 only.
        path = self.root / "data" / "site_baselines.json"
        baselines = json.loads(path.read_text(encoding="utf-8"))
        baselines["snow"]["years"][0]["peak_swe_in"] = 3.5
        path.write_text(json.dumps(baselines), encoding="utf-8")
        validate_data(load_data(self.root))
        baselines["snow"]["years"][10]["peak_swe_in"] = 3.5
        path.write_text(json.dumps(baselines), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "snow summary does not match"):
            validate_data(load_data(self.root))

    def test_a_new_water_year_is_added_without_changing_the_normals(self):
        # The yearly refresh the data guide describes: append the finished water year; the 1991 to 2020 summary stays as it is.
        path = self.root / "data" / "site_baselines.json"
        baselines = json.loads(path.read_text(encoding="utf-8"))
        baselines["snow"]["years"].append({"water_year": 2027, "peak_swe_in": 6.2, "peak_on": "2027-02-20", "melt_out_on": "2027-03-30",
                                           "last_snow_on": "2027-03-29", "apr1_swe_in": 0.0, "precip_in": 22.0})
        path.write_text(json.dumps(baselines), encoding="utf-8")
        self.assertEqual(query("SELECT COUNT(*) AS years, MAX(water_year) AS latest FROM snow_years", self.root)[0], {"years": 41, "latest": 2027})
        self.assertEqual(query("SELECT years FROM baseline_summary WHERE topic = 'snow' AND measure = 'peak_swe_in'", self.root)[0]["years"], 30)

    def test_a_snow_pack_that_peaks_on_a_leap_day_and_melts_out_the_next_day_builds(self):
        # A leap year's Feb 29 and Mar 1 share a day number, so the table must accept a melt-out the day after a Feb 29 peak.
        path = self.root / "data" / "site_baselines.json"
        baselines = json.loads(path.read_text(encoding="utf-8"))
        row = next(item for item in baselines["snow"]["years"] if item["water_year"] == 2024)
        row.update(peak_swe_in=0.5, peak_on="2024-02-29", melt_out_on="2024-03-01", last_snow_on="2024-02-29", apr1_swe_in=0.0)
        path.write_text(json.dumps(baselines), encoding="utf-8")
        validate_data(load_data(self.root))
        days = query("SELECT peak_day, melt_out_day FROM snow_years WHERE water_year = 2024", self.root)[0]
        self.assertEqual(days["peak_day"], days["melt_out_day"])

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

    def test_event_vocabulary_and_the_pot_losses_are_queryable(self):
        groups = {r["event_group"]: r["n"] for r in query("SELECT event_group, COUNT(*) AS n FROM event_types GROUP BY event_group", self.root)}
        self.assertEqual(groups, {"history": 6, "stage": 10, "condition": 10})
        stages = query("SELECT id FROM event_types WHERE event_group = 'stage' ORDER BY stage_order", self.root)
        self.assertEqual([r["id"] for r in stages][:5], ["bud_swell", "bud_break", "leaf_out", "first_bloom", "full_bloom"])
        # Every tree recorded as dead died in its pot: none was ever in the ground at Prairie.
        dead = {r["plant_id"] for r in query("SELECT id AS plant_id FROM plants WHERE health_status = 'dead'", self.root)}
        lost = {r["plant_id"] for r in query("SELECT plant_id FROM plant_events WHERE event_type = 'lost_before_planting'", self.root)}
        self.assertEqual(lost, dead)
        self.assertEqual(len(dead), 7)
        self.assertEqual(query("SELECT COUNT(*) AS n FROM plant_events WHERE event_type = 'lost_in_ground'", self.root)[0]["n"], 0)
        self.assertEqual(query("SELECT COUNT(*) AS n FROM stage_observations", self.root)[0]["n"], 0, "No stage has been logged yet")

    def test_logged_stages_roll_up_by_cultivar_and_meet_the_frost_record(self):
        path = self.root / "data" / "plant_events.json"
        events = json.loads(path.read_text(encoding="utf-8"))

        def stage(plant, kind, date):
            return {"id": f"test-{plant}-{kind}-{date}", "plant_id": plant, "event_type": kind, "recorded_on": date, "occurred_on": date,
                    "notes": "Test fixture only"}
        # Two Reliance peaches (i90-1 and i90-2) are planted; 2028 is a leap year, so May 4 is its 125th day but still day 124 here.
        events["records"] += [stage("i90-1", "first_bloom", "2027-04-28"), stage("i90-2", "first_bloom", "2027-04-30"),
                              stage("i90-1", "full_bloom", "2027-05-04"), stage("i90-2", "full_bloom", "2027-05-06"),
                              stage("i90-1", "full_bloom", "2028-05-04")]
        path.write_text(json.dumps(events), encoding="utf-8")
        rows = query("SELECT stage, year, trees, observations, earliest, latest, earliest_day, latest_day, average_day FROM stage_by_cultivar "
                     "WHERE cultivar = 'Reliance' ORDER BY year, stage_order", self.root)
        self.assertEqual([(r["year"], r["stage"], r["trees"], r["observations"], r["earliest_day"], r["latest_day"], r["average_day"]) for r in rows],
                         [(2027, "first_bloom", 2, 2, 118, 120, 119.0), (2027, "full_bloom", 2, 2, 124, 126, 125.0),
                          (2028, "full_bloom", 1, 1, 124, 124, 124.0)])
        observation = query("SELECT spot, day_number, year FROM stage_observations WHERE plant_id = 'i90-2' AND stage = 'full_bloom'", self.root)
        self.assertEqual(observation, [{"spot": "R12-C9", "day_number": 126, "year": 2027}])
        # The chance a freeze still followed each bloom date comes from the Prairie record, worked out here from the calendar dates.
        climate = self.data["climate"]
        primary = next(source for source in climate["sources"] if source["role"] == "primary")
        first, last = climate["site"]["normals_period"]

        def later_share(threshold, month, day):
            dates = [y["last_spring"][str(threshold)] for y in primary["frost"]["years"] if first <= y["year"] <= last and y["last_spring"][str(threshold)]]
            return int(100 * sum((int(d[5:7]), int(d[8:10])) > (month, day) for d in dates) / len(dates) + 0.5)
        risk = query("SELECT plant_id, year, threshold_f, later_freeze_pct FROM bloom_frost_risk WHERE stage = 'full_bloom' AND plant_id = 'i90-1' "
                     "ORDER BY year, threshold_f", self.root)
        self.assertEqual(len(risk), 8, "Two full-bloom dates times four thresholds")
        for row in risk:
            self.assertEqual(row["later_freeze_pct"], later_share(row["threshold_f"], 5, 4), f"{row['year']} {row['threshold_f']} F")
        by_threshold = {r["threshold_f"]: r["later_freeze_pct"] for r in risk if r["year"] == 2027}
        self.assertEqual(by_threshold, {24: 48, 28: 88, 32: 100, 36: 100})
        self.assertEqual(by_threshold, {r["threshold_f"]: r["later_freeze_pct"] for r in risk if r["year"] == 2028})

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
        data["months"][0]["et0_in"] = 4
        path.write_text(json.dumps(data), encoding="utf-8")
        self.assertEqual(query("SELECT et0_in FROM climate_months WHERE month = 1", self.root)[0]["et0_in"], 4)
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
            ("plant_events", lambda d: d["records"][0].update(event_type="bloom_obsrved"), "Unknown plant event type"),
            ("site", lambda d: shed_photos(d).clear(), "photos must be a nonempty list"),
            ("site", lambda d: next(f for f in d["features"] if f["id"] == "shed").update(photos="dji_0073"), "photos must be a nonempty list"),
            ("site", lambda d: shed_photos(d).append("dji_9999"), "lists an unknown photo: dji_9999"),
            ("site", lambda d: shed_photos(d).append(shed_photos(d)[0]), "lists the photo dji_0073 twice"),
            ("site", lambda d: shed_photos(d).append({"file": "dji_0073.webp"}), "must be photo ids"),
            ("site", lambda d: shed_photos(d).append(["dji_0073"]), "must be photo ids"),
            ("site", lambda d: shed_photos(d).append(None), "must be photo ids"),
            ("photos", lambda d: d["records"].__delitem__(next(i for i, r in enumerate(d["records"]) if r["id"] == "dji_0073")), "lists an unknown photo: dji_0073"),
            ("photos", lambda d: d.pop("source"), "missing fields"),
            ("photos", lambda d: d.update(source_page=" "), "source page must be nonempty text"),
            ("photos", lambda d: d.update(source=3), "source must be nonempty text"),
            ("photos", lambda d: d.update(records=None), "photo records must be an array"),
            ("photos", lambda d: d["records"].append(copy.deepcopy(d["records"][0])), "duplicate photo id: dji_0003"),
            ("photos", lambda d: d["records"][0].update(id="Dji_0003"), "id must be lowercase letters, digits, and underscores"),
            ("photos", lambda d: d["records"][0].update(id="dji 0003"), "id must be lowercase letters, digits, and underscores"),
            ("photos", lambda d: d["records"][0].update(file="../dji_0003.webp"), "file must be a lowercase .webp file name"),
            ("photos", lambda d: d["records"][0].update(file="images/dji_0003.webp"), "file must be a lowercase .webp file name"),
            ("photos", lambda d: d["records"][0].update(file="DJI_0003.webp"), "file must be a lowercase .webp file name"),
            ("photos", lambda d: d["records"][0].update(file="dji_0003.jpg"), "file must be a lowercase .webp file name"),
            ("photos", lambda d: d["records"][0].update(file=None), "file must be a lowercase .webp file name"),
            ("photos", lambda d: d["records"][0].update(thumb="dji_0003_t.png"), "thumb must be a lowercase .webp file name"),
            ("photos", lambda d: d["records"][0].update(file=d["records"][1]["file"]), "dji_0010.webp is already used by photo dji_0003"),
            ("photos", lambda d: d["records"][0].update(thumb=d["records"][0]["file"]), "is already used by photo dji_0003"),
            ("photos", lambda d: d["records"][0].update(original="photos/DJI_0003.JPG"), "original must be a file name"),
            ("photos", lambda d: d["records"][0].update(original=""), "original must be nonempty text"),
            ("photos", lambda d: d["records"][0].update(taken="2026-09-27"), "taken must be a local time like"),
            ("photos", lambda d: d["records"][0].update(taken="2026-09-27 15:36:23"), "taken must be a local time like"),
            ("photos", lambda d: d["records"][0].update(taken="2026-13-27T15:36:23"), "taken must be a real date and time"),
            ("photos", lambda d: d["records"][0].update(x=2000), "x is more than 600 ft from the lot"),
            ("photos", lambda d: d["records"][0].update(y=-700), "y is more than 600 ft from the lot"),
            ("photos", lambda d: d["records"][0].update(y=1291.9 + 601), "y is more than 600 ft from the lot"),
            ("photos", lambda d: d["records"][0].update(x="141.6"), "x must be a finite number"),
            ("photos", lambda d: d["records"][0].update(height_ft=-5), "height must be at least 0"),
            ("photos", lambda d: d["records"][0].update(height_ft=5001), "height must be no more than 5,000 ft"),
            ("photos", lambda d: d["records"][0].update(heading=360), "heading must be a compass heading from 0 to 359"),
            ("photos", lambda d: d["records"][0].update(heading=-1), "heading must be at least 0"),
            ("photos", lambda d: d["records"][0].update(heading=12.5), "heading must be an integer"),
            ("photos", lambda d: d["records"][0].update(pitch=-91), "pitch must be at least -90"),
            ("photos", lambda d: d["records"][0].update(pitch=91), "pitch must be between -90 and 90 degrees"),
            ("photos", lambda d: d["records"][0].update(fov=4), "field of view must be at least 5"),
            ("photos", lambda d: d["records"][0].update(fov=121), "field of view must be between 5 and 120 degrees"),
            ("photos", lambda d: d["records"][0].update(caption=" "), "caption must be nonempty text"),
            ("photos", lambda d: d["records"][0].update(caption="x" * 241), "caption must be no longer than 240 characters"),
            ("photos", lambda d: d["records"][0].update(alt=""), "alt must be nonempty text"),
            ("photos", lambda d: d["records"][0].update(alt="x" * 401), "alt must be no longer than 400 characters"),
            ("photos", lambda d: d["records"][0].pop("alt"), "missing fields"),
            ("photos", lambda d: d["records"][0].update(credit="drone"), "has unknown fields"),
            ("plant_events", lambda d: d["records"][0].update(event_type="bloom_obsrved"), "Unknown plant event type"),
            ("plant_events", lambda d: d["records"].append({"id": "x", "plant_id": "i90-1", "event_type": "full_bloom", "recorded_on": "2027-05-04",
                                                            "occurred_on": None, "notes": "No date given"}), "needs the date it happened"),
            ("plant_events", lambda d: d["records"].append({"id": "x", "plant_id": "i90-1", "event_type": "lost_in_ground", "recorded_on": "2027-05-04",
                                                            "occurred_on": None, "notes": "Still alive"}), "is for a dead plant"),
            ("plant_events", lambda d: d["records"][-1].update(plant_id="i90-1"), "is for a dead plant"),
            ("plant_events", lambda d: d.pop("event_types"), "needs an event_types list"),
            ("plant_events", lambda d: d["event_types"].append(copy.deepcopy(d["event_types"][0])), "unique lowercase word"),
            ("plant_events", lambda d: d["event_types"][0].update(id="Planting-Reported"), "unique lowercase word"),
            ("plant_events", lambda d: d["event_types"][0].update(group="weather"), "group must be one of"),
            ("plant_events", lambda d: d["event_types"][0].update(order=3), "only stage types have an order"),
            ("plant_events", lambda d: d["event_types"][0].update(color="red"), "unknown fields"),
            ("plant_events", lambda d: next(t for t in d["event_types"] if t["id"] == "bud_swell").pop("order"), "missing fields"),
            ("plant_events", lambda d: next(t for t in d["event_types"] if t["id"] == "bud_break").update(order=1), "stage order 1 is used twice"),
            ("climate", lambda d: d.pop("checks"), "missing fields"),
            ("climate", lambda d: d.update(checks=[]), "checks must be a list"),
            ("climate", lambda d: d["checks"][0].update(status="stuck"), "status must be one of"),
            ("climate", lambda d: d["checks"][1].update(status="done"), "is done, so it needs resolved_on and a result"),
            ("climate", lambda d: d["checks"][0].update(result=None), "is done, so it needs resolved_on and a result"),
            ("climate", lambda d: d["checks"][1].update(resolved_on="2027-05-01", result="First bloom was April 29."), "is open, so resolved_on and result must be null"),
            ("climate", lambda d: d["checks"][0].update(status="open"), "is open, so resolved_on and result must be null"),
            ("climate", lambda d: d["checks"][1].update(status="done", resolved_on="yesterday", result="First bloom was April 29."), "must be an ISO date or null"),
            ("climate", lambda d: d["checks"][1].update(id="usda-zone-map"), "unique lowercase slug"),
            ("climate", lambda d: d["checks"][0].update(id="USDA Zone"), "unique lowercase slug"),
            ("climate", lambda d: d["checks"][0].update(how=""), "nonempty text"),
            ("climate", lambda d: d["checks"][0].update(color="red"), "unknown fields"),
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
            ("orchard", lambda d: (plan_item(d, "mount-royal")["spots"].pop(), plan_item(d, "mount-royal").update(quantity=1)),
             "have no planting plan item"),
            ("plants", lambda d: [p.update(health_status="dead") for p in d["records"] if p["id"] in ("i56-2", "i56-3")],
             "rootstocks are unplanted"),
            ("orchard", lambda d: d["rules"]["PLANTING_PLAN"].update(year=1999), "planting plan year"),
            ("cultivar_library", lambda d: next(r for r in d["records"] if r["id"] == "apple-dayton").update(type="Pear"), "disagrees with Apple"),
            ("locations", lambda d: next(r for r in d["records"] if r["name"] == "R13-C1").update(replacement_year=2027, replacement_type="Apple"),
             "without a planting plan item"),
            ("site_baselines", lambda d: d["snow"]["years"][5].update(peak_swe_in=9.0), "snow summary does not match"),
            ("site_baselines", lambda d: d["snow"]["years"][0].update(melt_out_on="1987-01-15"), "melt-out and the last snow must come after the peak"),
            ("site_baselines", lambda d: d["snow"]["years"][0].update(apr1_swe_in=5.0), "April 1 snow cannot exceed the peak"),
            ("site_baselines", lambda d: d["snow"]["years"].pop(10), "must be consecutive"),
            ("site_baselines", lambda d: d["snow"]["monthly_precip_in"].__setitem__(0, 6.0), "must add up to the average water-year total"),
            ("site_baselines", lambda d: d["snow"]["monthly_precip_in"].append(d["snow"]["monthly_precip_in"].pop(0)), "disagrees with the PRISM months"),
            ("site_baselines", swap_storm_rows, "depths must rise with the duration"),
            ("site_baselines", lambda d: d["storms"]["lower_in"][9].__setitem__(3, 2.19), "between its lower and upper bound"),
            ("site_baselines", lambda d: d["storms"].update(latitude=44.0), "must be for the lot center"),
            ("site_baselines", lambda d: d["storms"]["return_periods_years"].remove(25), "Storms need 25-year"),
            ("site_baselines", lambda d: d["growth"]["gdd"]["years"][5]["hourly"].update({"50": 1700}), "degree-day summary does not match"),
            ("site_baselines", lambda d: d["growth"]["gdd"]["years"][0].update(hours_recorded=8000), "at least 99% of the year's hours"),
            ("site_baselines", lambda d: d["growth"]["gdd"]["monthly_mean"]["50"].__setitem__(6, 900), "monthly degree days at base 50 must add up"),
            ("site_baselines", lambda d: d["growth"]["gdd"]["years"][0]["hourly"].update({"43": 100}), "a lower base cannot have fewer degree days"),
            ("site_baselines", lambda d: d["growth"]["chill"]["winters"][0].update(hours_32_45=3000), "cannot exceed hours at or below 45 F"),
            ("site_baselines", lambda d: d["growth"]["chill"]["winters"][3].update(hours_32_45=700), "chill summary does not match"),
            ("site_baselines", lambda d: d["growth"]["chill"]["winters"][0].update(hours_recorded=2000), "at least 97% of the winter's hours"),
            ("site_baselines", lambda d: d["wind"]["sources"][1]["rose_pct"]["winter"].__setitem__(0, 12.3), "winter rose must add up to 100 percent"),
            ("site_baselines", lambda d: d["wind"]["sources"][1].update(bearing_deg=300), "bearing_deg should be about"),
            ("site_baselines", lambda d: d["wind"]["sources"][2].update(distance_mi=12.0), "distance_mi should be about"),
            ("site_baselines", lambda d: d["wind"]["sources"].pop(2), "Wind sources need muo-asos"),
            ("site_baselines", lambda d: d["wind"]["sector_names"].reverse(), "16 compass directions"),
            ("site_baselines", lambda d: d["wind"]["sources"][0]["rose_hours"].update(winter=1000), "rose hours must equal the hours that were not calm"),
            ("site_baselines", lambda d: d["wind"]["sources"][0]["pct_hours_at_or_above_mph"].update({"25": 30.0}), "share of hours at 10 mph must be at least"),
            ("site_baselines", lambda d: d["sun"]["sources"][0]["monthly"].__setitem__(0, 20.0), "annual figure should be about"),
            ("site_baselines", distort_january_and_december_sun, "of the sunshine above the atmosphere"),
            ("site_baselines", lambda d: d["sun"].update(primary="nowhere"), "primary solar source must be one of the sources"),
            ("site_baselines", lambda d: d["humidity"]["sources"][0]["monthly"].__setitem__(0, 101.0), "above 0 and at most 100 percent"),
            ("site_baselines", lambda d: d["humidity"]["sources"][1]["monthly"].__setitem__(0, 60.0), "agree within 15 points of humidity"),
            ("site_baselines", lambda d: d["building"]["values"].pop(1), "Building values need ground-snow-load"),
            ("site_baselines", lambda d: d["building"]["values"][0].update(value=300), "outside the 12 to 72 range"),
            ("site_baselines", lambda d: d["building"]["values"][0].update(source_ids=["nowhere"]), "source_ids must name one or more different building sources"),
            ("site_baselines", lambda d: d["building"]["values"][3].update(value="G"), "letter from A to F"),
            ("site_baselines", lambda d: d["hail"]["events"][4].update(distance_mi=9.0), "distance_mi should be about"),
            ("site_baselines", swap_first_two_hail_events, "must be listed oldest first"),
            ("site_baselines", lambda d: d["hail"].update(radius_mi=1), "farther than the 1 mile radius"),
            ("site_baselines", lambda d: d["hail"]["events"][0].update(event_id=d["hail"]["events"][1]["event_id"]), "duplicate hail event"),
            ("site_baselines", lambda d: d["storms"]["source"].update(url="http://example.com"), "url must use https"),
            # What the page and the database view look up by name cannot be dropped or retyped.
            *[("site_baselines", lambda d, name=name: drop_storm_duration(d, name), f"Storms need {name}") for name in ("3-hr", "12-hr", "10-day")],
            *[("site_baselines", lambda d, years=years: d["storms"]["return_periods_years"].remove(years), f"Storms need {years}-year") for years in (5, 50)],
            ("site_baselines", lambda d: d["growth"]["gdd"]["bases_f"].remove(43), "Degree days need bases 43"),
            ("site_baselines", lambda d: named(d["humidity"]["sources"], "nasa-power").update(kind="station"), "nasa-power must be a model"),
            ("site_baselines", lambda d: named(d["wind"]["sources"], "pine-turnoff-rwis").update(kind="model"), "must be measured stations"),
            ("site_baselines", lambda d: named(d["wind"]["sources"], "hrrr-lot").update(kind="station"), "hrrr-lot wind source must be a model cell within 2 miles"),
            ("site_baselines", lambda d: move_wind_source(d, self.data["climate"]["site"], "hrrr-lot", 43.5237, -115.5942),
             "hrrr-lot wind source must be a model cell within 2 miles"),
            ("site_baselines", lambda d: d["wind"]["coarse_model"].update(id="hrrr-lot"), "needs an id of its own"),
            # The database stores a whole number of degrees for the bearing, and the id of a coarse model must not repeat a wind source's.
            ("site_baselines", lambda d: named(d["wind"]["sources"], "pine-turnoff-rwis").update(bearing_deg=124.4), "bearing must be an integer"),
            ("site_baselines", lambda d: named(d["wind"]["sources"], "pine-turnoff-rwis").update(bearing_deg=360), "whole number of degrees from 0 to 359"),
            # A unit slip in a monthly series: knots for one station, meters per second for the coarse model, and a source scaled to the wrong size.
            ("site_baselines", lambda d: scale_monthly(named(d["wind"]["sources"], "pine-turnoff-rwis"), "monthly_mean_mph", 0.869),
             "within 0.3 mph of the average of the monthly means"),
            ("site_baselines", lambda d: scale_monthly(d["wind"]["coarse_model"], "monthly_mean_mph", 0.447), "within 25 percent of the mean speed at the lot"),
            ("site_baselines", lambda d: scale_solar_source(d, "nasa-power", 1.12), "agree within 15 percent on the annual average"),
            # Storm depths must rise with the return period, and the rate of rain must fall as a storm lasts longer.
            ("site_baselines", lambda d: d["storms"]["depth_in"][3].__setitem__(4, d["storms"]["depth_in"][3][3]), "must be positive and rise with the return period"),
            ("site_baselines", shrink_five_minute_storms, "rate of rain in inches per hour must fall as the duration grows"),
            # A snow year's dates stay inside its water year, and its peak cannot exceed its precipitation.
            ("site_baselines", lambda d: d["snow"]["years"][0].update(precip_in=2.0), "the peak cannot exceed the year's precipitation"),
            ("site_baselines", lambda d: d["snow"]["years"][0].update(last_snow_on=d["snow"]["years"][0]["melt_out_on"]), "cannot be the last day with snow"),
            ("site_baselines", lambda d: d["snow"]["years"][0].update(peak_on="1986-09-30"), "must fall from 1986-10-01 to 1987-07-31"),
            ("site_baselines", lambda d: d["snow"]["years"][0].update(last_snow_on="1987-08-01"), "must fall from 1986-10-01 to 1987-07-31"),
            # Years stay in order, and absurd numbers fail with a message instead of overflowing.
            ("site_baselines", lambda d: d["growth"]["gdd"]["years"].reverse(), "oldest first"),
            ("site_baselines", lambda d: d["growth"]["chill"]["winters"].reverse(), "oldest first"),
            ("site_baselines", lambda d: d["snow"]["years"][-1].update(water_year=10 ** 11), "no later than 2200"),
            ("site_baselines", lambda d: d["growth"]["gdd"]["years"][-1].update(year=10 ** 11), "no later than 2200"),
            ("site_baselines", lambda d: d["growth"]["chill"]["winters"][-1].update(winter=10 ** 11), "no later than 2200"),
            ("site_baselines", lambda d: d["snow"]["years"][0].update(peak_swe_in=1e308), "no larger than one trillion"),
            ("site_baselines", lambda d: d["snow"]["years"][0].update(peak_swe_in=10 ** 400), "no larger than one trillion"),
            ("climate", lambda d: d["sources"][0].update(id="other-station"), "same station as the climate record's primary source"),
        ]
        for collection, change, message in cases:
            data = copy.deepcopy(self.data)
            change(data[collection])
            with self.subTest(collection=collection, message=message), self.assertRaisesRegex(ValueError, message):
                validate_data(data)

    def malformed_records_raise_value_errors(self, name, minimum, middle=False, numbers=False):
        """Delete or mistype every sampled field of one collection; each must raise ValueError, never crash with another error.

        With numbers=True every number is also replaced by values that once overflowed or slipped past a check: a huge integer, a huge float,
        a negative, and a fraction.
        """
        def sampled_paths(node, prefix=()):
            """Every field, keeping only the first and last (and optionally the middle) of a long list or of numbered keys, which behave alike."""
            yield prefix
            if isinstance(node, dict):
                keys = list(node)
                if len(keys) > 3 and all(key.isdigit() for key in keys):
                    keys = [keys[0], keys[-1]]
                children = [(key, node[key]) for key in keys]
            elif isinstance(node, list):
                indexes = range(len(node)) if len(node) <= 2 else (0, len(node) // 2, len(node) - 1) if middle else (0, len(node) - 1)
                children = [(index, node[index]) for index in indexes]
            else:
                return
            for key, child in children:
                yield from sampled_paths(child, prefix + (key,))

        def at(document, path):
            for step in path:
                document = document[step]
            return document

        replacements = {"null": None, "string": "x", "empty object": {}, "empty list": []}
        number_replacements = {"huge integer": 10 ** 400, "huge float": 1e308, "negative": -1, "fraction": 0.5}
        tried = 0
        for path in sampled_paths(self.data[name]):
            if not path:
                continue
            original = at(self.data[name], path)
            kinds = ("delete", *replacements) if isinstance(original, (dict, list)) else ("delete", "null", "empty list")
            if numbers and isinstance(original, (int, float)) and not isinstance(original, bool):
                kinds += tuple(number_replacements)
            for kind in kinds:
                document = copy.deepcopy(self.data[name])
                parent = at(document, path[:-1])
                if kind == "delete":
                    parent.pop(path[-1])
                else:
                    parent[path[-1]] = copy.deepcopy({**replacements, **number_replacements}[kind])
                tried += 1
                with self.subTest(collection=name, path=path, kind=kind):
                    try:
                        validate_data({**self.data, name: document})
                    except ValueError:
                        pass
        self.assertGreater(tried, minimum, f"The walk should reach most of the {name} record")

    def test_malformed_climate_records_fail_with_a_clear_error_not_a_crash(self):
        self.malformed_records_raise_value_errors("climate", 300, numbers=True)

    def test_malformed_site_baselines_fail_with_a_clear_error_not_a_crash(self):
        self.malformed_records_raise_value_errors("site_baselines", 1000, numbers=True)

    def test_malformed_plant_events_fail_with_a_clear_error_not_a_crash(self):
        # The middle of the vocabulary is a growth stage, so its order field is exercised too.
        self.malformed_records_raise_value_errors("plant_events", 50, middle=True)

    def test_malformed_photos_fail_with_a_clear_error_not_a_crash(self):
        self.malformed_records_raise_value_errors("photos", 150, middle=True, numbers=True)

    def test_the_photo_list_reaches_sqlite_and_the_website_data(self):
        count = len(self.data["photos"]["records"])
        photos = query("SELECT id, cell, taken, height_ft FROM photos ORDER BY taken, id", self.root)
        self.assertEqual(len(photos), count)
        self.assertEqual({p["taken"][:10] for p in photos}, {"2026-09-27", "2026-10-10", "2026-10-19"})
        by_id = {p["id"]: p for p in photos}
        self.assertEqual(by_id["dji_0073"]["cell"], "D16")
        self.assertIsNone(by_id["dji_0013"]["cell"], "A photo taken from outside the fence has no grid cell")
        links = query("SELECT feature_id, photo_id FROM feature_photos ORDER BY feature_id, position", self.root)
        self.assertEqual([(link["feature_id"], link["photo_id"]) for link in links],
                         [("outhouse", "dji_0071"), ("shed", "dji_0073"), ("shed", "dji_0065")])
        self.assertEqual(query("SELECT COUNT(*) AS n FROM source_documents WHERE name = 'photos'", self.root)[0]["n"], 1)
        build(self.root)
        generated = (self.root / "docs" / "data" / "photos.js").read_text(encoding="utf-8")
        self.assertTrue(generated.startswith("// Generated by tools/property_data.py build."))
        self.assertIn('window.SITE_PHOTOS = {"schema_version":1,', generated)
        manifest = json.loads((self.root / "docs" / "data" / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["photos"], count)

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
