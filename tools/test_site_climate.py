"""Tests for tools/site_climate.py. Run: python -m unittest discover -s tools"""
import datetime
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import site_climate as sc  # noqa: E402

# The lot center, as used to query the U.S. Naval Observatory sunrise and sunset service.
LATITUDE, LONGITUDE = 43.47368, -115.59421
# Local clock times from the U.S. Naval Observatory for that point: date, UTC offset, sunrise, sunset.
USNO = (
    (datetime.date(2026, 1, 15), -7, "08:12", "17:32"),
    (datetime.date(2026, 4, 15), -6, "07:00", "20:26"),
    (datetime.date(2026, 6, 21), -6, "06:02", "21:27"),
    (datetime.date(2026, 8, 15), -6, "06:48", "20:45"),
    (datetime.date(2026, 10, 15), -6, "07:57", "18:59"),
    (datetime.date(2026, 12, 21), -7, "08:12", "17:09"),
)


def minutes(clock):
    hours, mins = clock.split(":")
    return int(hours) * 60 + int(mins)


class SunTest(unittest.TestCase):
    def test_sunrise_and_sunset_match_the_naval_observatory_within_a_minute(self):
        for date, offset, sunrise, sunset in USNO:
            sun = sc.sun_day(LATITUDE, LONGITUDE, date)
            with self.subTest(date=date):
                self.assertLessEqual(abs(minutes(sc.clock_time(sun["sunrise_utc_minutes"], offset)) - minutes(sunrise)), 1)
                self.assertLessEqual(abs(minutes(sc.clock_time(sun["sunset_utc_minutes"], offset)) - minutes(sunset)), 1)

    def test_solstices_and_equinoxes(self):
        june = sc.sun_day(LATITUDE, LONGITUDE, datetime.date(2026, 6, 21))
        december = sc.sun_day(LATITUDE, LONGITUDE, datetime.date(2026, 12, 21))
        march = sc.sun_day(LATITUDE, LONGITUDE, datetime.date(2026, 3, 20))
        self.assertAlmostEqual(june["day_length_hours"], 15.42, delta=0.02)
        self.assertAlmostEqual(december["day_length_hours"], 8.95, delta=0.02)
        # The sun at noon stands 90 degrees minus the latitude at the equinox, plus or minus the 23.4 degree tilt at the solstices.
        self.assertAlmostEqual(june["noon_altitude_deg"], 90 - LATITUDE + 23.44, delta=0.1)
        self.assertAlmostEqual(december["noon_altitude_deg"], 90 - LATITUDE - 23.44, delta=0.1)
        self.assertAlmostEqual(march["noon_altitude_deg"], 90 - LATITUDE, delta=0.5)
        # Refraction and the sun's width make the day a little longer than 12 hours at the equinox.
        self.assertTrue(12.1 < march["day_length_hours"] < 12.25)
        self.assertAlmostEqual(june["sunrise_azimuth_deg"] + june["sunset_azimuth_deg"], 360)
        self.assertLess(june["sunrise_azimuth_deg"], 60)
        self.assertGreater(december["sunrise_azimuth_deg"], 120)

    def test_the_sun_can_fail_to_rise(self):
        with self.assertRaisesRegex(ValueError, "does not rise or set"):
            sc.sun_day(80.0, -115.0, datetime.date(2026, 6, 21))

    def test_clock_time_wraps_and_rounds(self):
        self.assertEqual(sc.clock_time(-30, 0), "23:30")
        self.assertEqual(sc.clock_time(1440 + 5.4, 0), "00:05")
        self.assertEqual(sc.clock_time(1440 + 5.5, 0), "00:06")
        self.assertEqual(sc.clock_time(13 * 60 + 41, -6), "07:41")

    def test_monthly_daylight_follows_the_seasons(self):
        months = sc.daylight_months(LATITUDE, LONGITUDE, 2026)
        self.assertEqual([m["month"] for m in months], list(range(1, 13)))
        means = [m["mean_hours"] for m in months]
        self.assertEqual(max(means), means[5], "June has the longest days")
        self.assertEqual(min(means), means[11], "December has the shortest days")
        for m in months:
            self.assertLessEqual(m["shortest_hours"], m["mean_hours"])
            self.assertLessEqual(m["mean_hours"], m["longest_hours"])
        self.assertAlmostEqual(sum(means) / 12, 12.2, delta=0.2)

    def test_daylight_crossings(self):
        spring, fall = sc.daylight_crossings(LATITUDE, LONGITUDE, 2026, 12)
        self.assertTrue("03-14" <= spring <= "03-20", spring)
        self.assertTrue("09-22" <= fall <= "09-28", fall)
        self.assertEqual(sc.daylight_crossings(LATITUDE, LONGITUDE, 2026, 20), None)
        spring14, fall14 = sc.daylight_crossings(LATITUDE, LONGITUDE, 2026, 14)
        self.assertTrue(spring14 < "05-15" and fall14 > "08-01")


class FrostStatisticsTest(unittest.TestCase):
    def test_day_numbers_line_up_in_leap_years(self):
        self.assertEqual(sc.day_of_year(datetime.date(2023, 3, 1)), 60)
        self.assertEqual(sc.day_of_year(datetime.date(2024, 3, 1)), 60)
        self.assertEqual(sc.day_of_year(datetime.date(2024, 2, 29)), 60)
        self.assertEqual(sc.day_of_year(datetime.date(2024, 12, 31)), 365)
        self.assertEqual(sc.month_day(60), "03-01")
        self.assertEqual(sc.month_day(168), "06-17")
        self.assertEqual(sc.parse_month_day("06-17"), 168)

    def test_month_day_text_must_be_a_real_calendar_day(self):
        for text in ("6-17", "06-1", "13-01", "06-31", "02-29", "00-10", "June 17", "\uff10\uff16-17", "06/17", None, 617):
            with self.subTest(text=text), self.assertRaises(ValueError):
                sc.parse_month_day(text)

    def test_quantiles_interpolate_like_the_usual_definition(self):
        self.assertEqual(sc.quantile([5, 1, 3, 2, 4], 0.5), 3)
        self.assertAlmostEqual(sc.quantile([1, 2, 3, 4, 5], 0.1), 1.4)
        self.assertAlmostEqual(sc.quantile([1, 2, 3, 4, 5], 0.9), 4.6)
        self.assertEqual(sc.quantile([7], 0.9), 7)
        with self.assertRaises(ValueError):
            sc.quantile([], 0.5)
        self.assertEqual(sc.round_half_up(2.5), 3)
        self.assertEqual(sc.round_half_up(-2.5), -2)

    def test_hardiness_zone_bands(self):
        for value, zone in ((-10.9, "5b"), (-10.0, "6a"), (-15.0, "5b"), (-15.1, "5a"), (-22.5, "4b"), (-6.3, "6a"), (0, "7a"), (9.9, "7b")):
            with self.subTest(value=value):
                self.assertEqual(sc.hardiness_zone(value), zone)
        with self.assertRaises(ValueError):
            sc.hardiness_zone(-60)

    def test_distance_between_points_in_miles(self):
        self.assertEqual(sc.distance_miles(43.5, -115.6, 43.5, -115.6), 0)
        # A degree of latitude is 69.09 miles on a 3,958.8-mile sphere; a degree of longitude shrinks with the cosine of the latitude.
        self.assertAlmostEqual(sc.distance_miles(43.0, -115.0, 44.0, -115.0), 69.09, places=2)
        self.assertAlmostEqual(sc.distance_miles(43.0, -115.0, 43.0, -114.0), 69.09 * 0.7314, places=1)
        self.assertAlmostEqual(sc.distance_miles(43.0, -115.0, 44.0, -116.0), sc.distance_miles(44.0, -116.0, 43.0, -115.0))
        # The Prairie SNOTEL, at the NRCS station coordinates, is about 2.4 miles from the lot center.
        self.assertAlmostEqual(sc.distance_miles(LATITUDE, LONGITUDE, 43.50513, -115.573), 2.4, places=1)

    def test_frost_summary_percentiles_counts_and_period(self):
        springs = ["2000-05-10", "2001-05-20", "2002-05-30", "2003-06-09", "2004-06-19"]
        falls = ["2000-09-01", "2001-09-05", "2002-09-21", "2003-10-01", "2004-10-21"]
        years = [{"year": 2000 + n, "last_spring": {"32": springs[n]}, "first_fall": {"32": falls[n]}} for n in range(5)]
        # A year outside the period, and a year whose spring could not be dated, must not disturb the dates they do not belong to.
        years.append({"year": 1999, "last_spring": {"32": "1999-07-01"}, "first_fall": {"32": "1999-08-02"}})
        years.append({"year": 2005, "last_spring": {"32": None}, "first_fall": {"32": "2005-09-30"}})
        summary = sc.frost_summary(years, [32], 2000, 2004)["32"]
        self.assertEqual(summary["last_spring"], {"earliest": "05-10", "p10": "05-14", "p50": "05-30", "p90": "06-15", "latest": "06-19"})
        self.assertEqual(summary["first_fall"], {"earliest": "09-01", "p10": "09-03", "p50": "09-21", "p90": "10-13", "latest": "10-21"})
        self.assertEqual((summary["years_spring"], summary["years_fall"], summary["years_both"]), (5, 5, 5))
        # Frost-free days are 114, 108, 114, 114 and 124 (2000 is a leap year, but the day numbers still line up).
        self.assertEqual(summary["frost_free_days"], {"shortest": 108, "p10": 110, "p50": 114, "p90": 120, "longest": 124})
        # 1999 is outside the period and ignored. In 2005 only the fall date is known, so it adds a fall date but no spring date
        # and no frost-free count.
        longer = sc.frost_summary(years, [32], 2000, 2005)["32"]
        self.assertEqual(longer["last_spring"], summary["last_spring"])
        self.assertEqual(longer["first_fall"], {"earliest": "09-01", "p10": "09-03", "p50": "09-26", "p90": "10-11", "latest": "10-21"})
        self.assertEqual((longer["years_spring"], longer["years_fall"], longer["years_both"]), (5, 6, 5))
        self.assertEqual(longer["frost_free_days"], summary["frost_free_days"])
        narrow = sc.frost_summary(years, [32], 2001, 2003)["32"]
        self.assertEqual(narrow["last_spring"]["earliest"], "05-20")
        self.assertEqual(narrow["years_both"], 3)


class BaselineHelpersTest(unittest.TestCase):
    def test_water_year_days_count_from_october_first_and_ignore_leap_days(self):
        self.assertEqual(sc.water_year_day(datetime.date(2025, 10, 1)), 1)
        self.assertEqual(sc.water_year_day(datetime.date(2025, 12, 31)), 92)
        self.assertEqual(sc.water_year_day(datetime.date(2026, 1, 1)), 93)
        self.assertEqual(sc.water_year_day(datetime.date(2026, 9, 30)), 365)
        # March 1 is day 152 in every water year, so a leap year's later dates still line up with an ordinary year's.
        self.assertEqual(sc.water_year_day(datetime.date(2026, 3, 1)), 152)
        self.assertEqual(sc.water_year_day(datetime.date(2024, 3, 1)), 152)
        self.assertEqual(sc.water_year_day(datetime.date(2024, 9, 30)), 365)
        self.assertEqual(sc.water_year_day(datetime.date(2024, 2, 28)), 151)
        # A leap year's Feb 29 shares day 152 with Mar 1, so a database cannot require a later day number for the day after a Feb 29.
        self.assertEqual(sc.water_year_day(datetime.date(2024, 2, 29)), 152)
        for number in (1, 92, 93, 152, 365):
            text = sc.water_year_month_day(number)
            month, day = int(text[:2]), int(text[3:])
            self.assertEqual(sc.water_year_day(datetime.date(2001 if month >= 10 else 2002, month, day)), number)
        self.assertEqual([sc.water_year_month_day(n) for n in (1, 92, 93, 152, 365)], ["10-01", "12-31", "01-01", "03-01", "09-30"])

    def test_series_and_date_summaries_round_half_up(self):
        values = [3.0, 1.0, 5.0, 2.0, 4.0]
        self.assertEqual(sc.series_summary(values, 1), {"min": 1.0, "p10": 1.4, "p50": 3.0, "p90": 4.6, "max": 5.0, "mean": 3.0})
        # An exact half rounds up: 0.5 becomes 1 and 1.5 becomes 2.
        self.assertEqual(sc.series_summary([0.5, 1.5], 0), {"min": 1.0, "p10": 1.0, "p50": 1.0, "p90": 1.0, "max": 2.0, "mean": 1.0})
        self.assertEqual(sc.series_summary([1659, 2263], 0)["mean"], 1961)
        self.assertEqual(sc.date_summary([93, 120, 152, 168, 190], sc.water_year_month_day),
                         {"earliest": "01-01", "p10": "01-12", "p50": "03-01", "p90": "03-30", "latest": "04-08"})
        with self.assertRaises(ValueError):
            sc.series_summary([], 1)

    def test_extraterrestrial_sunshine_follows_the_seasons(self):
        # Checked against a minute-by-minute integration of the solar constant at this latitude: 41.94 and 11.40 MJ per square meter.
        self.assertAlmostEqual(sc.extraterrestrial_mj(LATITUDE, datetime.date(2026, 6, 21)), 41.94, delta=0.2)
        self.assertAlmostEqual(sc.extraterrestrial_mj(LATITUDE, datetime.date(2026, 12, 21)), 11.40, delta=0.1)
        months = sc.extraterrestrial_months(LATITUDE)
        self.assertEqual([round(month, 1) for month in months], [13.2, 18.3, 25.9, 33.7, 39.4, 41.7, 40.4, 35.6, 28.4, 20.4, 14.2, 11.6])
        self.assertEqual(months.index(max(months)), 5)
        self.assertEqual(months.index(min(months)), 11)
        # Under a polar night the sun never rises, and the formula must give zero, not an error.
        self.assertEqual(sc.extraterrestrial_mj(85, datetime.date(2026, 12, 21)), 0)

    def test_bearing_points_along_the_compass(self):
        self.assertAlmostEqual(sc.bearing_degrees(43, -115, 44, -115), 0, places=3)
        self.assertAlmostEqual(sc.bearing_degrees(43, -115, 43, -114), 90, delta=0.5)
        self.assertAlmostEqual(sc.bearing_degrees(43, -115, 42, -115), 180, places=3)
        self.assertAlmostEqual(sc.bearing_degrees(43, -115, 43, -116), 270, delta=0.5)
        # Pine Turnoff lies south-east of the lot and Mountain Home Air Force Base south-south-west.
        self.assertAlmostEqual(sc.bearing_degrees(LATITUDE, LONGITUDE, 43.3136, -115.2667), 124, delta=1)
        self.assertAlmostEqual(sc.bearing_degrees(LATITUDE, LONGITUDE, 43.0436, -115.8724), 205, delta=1)


if __name__ == "__main__":
    unittest.main()
