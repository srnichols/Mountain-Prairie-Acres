"""Sun geometry and frost-date statistics for the site climate records.

Day length and sun angles use the NOAA General Solar Position formulas (Meeus), with the usual
-0.833 degree allowance for refraction and the sun's radius at sunrise and sunset, over a flat horizon.
Frost dates are summarized with day-of-year numbers from a non-leap year, so every year lines up.
"""
import calendar
import datetime
import math

# USDA plant hardiness half zones: the lower edge of each, in degrees F, from the average annual coldest night.
HARDINESS_ZONES = (
    ("3a", -40), ("3b", -35), ("4a", -30), ("4b", -25), ("5a", -20), ("5b", -15), ("6a", -10), ("6b", -5),
    ("7a", 0), ("7b", 5), ("8a", 10), ("8b", 15), ("9a", 20),
)
REFRACTION_ZENITH = 90.833
EARTH_RADIUS_MILES = 3958.8
SPRING_LAST_DAY = 212  # Jul 31, the last day a spring freeze can be dated
FALL_FIRST_DAY = 213  # Aug 1, the first day a fall freeze can be dated


def distance_miles(latitude_a, longitude_a, latitude_b, longitude_b):
    """Great-circle distance in miles between two latitude and longitude points in degrees."""
    phi_a, phi_b = math.radians(latitude_a), math.radians(latitude_b)
    half_dphi, half_dlambda = (phi_b - phi_a) / 2, math.radians(longitude_b - longitude_a) / 2
    haversine = math.sin(half_dphi) ** 2 + math.cos(phi_a) * math.cos(phi_b) * math.sin(half_dlambda) ** 2
    return 2 * EARTH_RADIUS_MILES * math.asin(math.sqrt(haversine))


def round_half_up(value):
    return int(math.floor(value + 0.5))


def day_of_year(date):
    """Day number counted as in a non-leap year (Mar 1 is always day 60)."""
    number = date.timetuple().tm_yday
    return number - 1 if calendar.isleap(date.year) and date.month > 2 else number


def month_day(number):
    """MM-DD text for a non-leap day number."""
    date = datetime.date(2001, 1, 1) + datetime.timedelta(days=int(number) - 1)
    return f"{date.month:02d}-{date.day:02d}"


def parse_month_day(text):
    """Day number for MM-DD text; raises ValueError for anything that is not a real calendar day."""
    digits = text[:2] + text[3:] if isinstance(text, str) and len(text) == 5 and text[2] == "-" else ""
    if not (digits.isascii() and digits.isdigit()):
        raise ValueError(f"{text!r} must be MM-DD")
    try:
        return day_of_year(datetime.date(2001, int(digits[:2]), int(digits[2:])))
    except ValueError as error:
        raise ValueError(f"{text!r} must be MM-DD") from error


def quantile(values, fraction):
    """Linear-interpolated quantile (the usual 'type 7' definition) of a list of numbers."""
    ordered = sorted(values)
    if not ordered:
        raise ValueError("Cannot take a quantile of no values")
    position = (len(ordered) - 1) * fraction
    low, high = math.floor(position), math.ceil(position)
    return ordered[low] + (ordered[high] - ordered[low]) * (position - low)


def hardiness_zone(mean_annual_extreme_min_f):
    zone = None
    for name, lower in HARDINESS_ZONES:
        if mean_annual_extreme_min_f >= lower:
            zone = name
    if zone is None:
        raise ValueError("Average coldest night is below the hardiness zones this helper knows")
    return zone


def _distribution(values, names):
    """The shortest, 10%, median, 90%, and longest values, rounded to whole numbers."""
    fractions = (0.0, 0.1, 0.5, 0.9, 1.0)
    return {name: round_half_up(quantile(values, fraction)) for name, fraction in zip(names, fractions)}


def frost_summary(years, thresholds, start, end):
    """Summarize yearly last-spring and first-fall dates for the years start..end.

    years: records like {"year": 1994, "last_spring": {"32": "1994-06-17"}, "first_fall": {"32": "1994-09-11"}},
    where a date of None means the year's record was too incomplete to date that freeze.
    """
    summary = {}
    for threshold in thresholds:
        key = str(threshold)
        springs, falls, free = [], [], []
        for record in years:
            if not start <= record["year"] <= end:
                continue
            spring = record["last_spring"].get(key)
            fall = record["first_fall"].get(key)
            spring_day = day_of_year(datetime.date.fromisoformat(spring)) if spring else None
            fall_day = day_of_year(datetime.date.fromisoformat(fall)) if fall else None
            if spring_day is not None:
                springs.append(spring_day)
            if fall_day is not None:
                falls.append(fall_day)
            if spring_day is not None and fall_day is not None:
                free.append(fall_day - spring_day)
        dates = ("earliest", "p10", "p50", "p90", "latest")
        summary[key] = {
            "last_spring": {name: month_day(value) for name, value in _distribution(springs, dates).items()},
            "first_fall": {name: month_day(value) for name, value in _distribution(falls, dates).items()},
            "frost_free_days": _distribution(free, ("shortest", "p10", "p50", "p90", "longest")),
            "years_spring": len(springs), "years_fall": len(falls), "years_both": len(free),
        }
    return summary


def _sun_at_noon(longitude, date):
    """Declination (degrees) and equation of time (minutes) near local solar noon on the date."""
    julian_day = date.toordinal() + 1721424.5 + 0.5 - longitude / 360
    t = (julian_day - 2451545.0) / 36525
    mean_longitude = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360
    mean_anomaly = 357.52911 + t * (35999.05029 - 0.0001537 * t)
    eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t)
    anomaly = math.radians(mean_anomaly)
    center = (math.sin(anomaly) * (1.914602 - t * (0.004817 + 0.000014 * t))
              + math.sin(2 * anomaly) * (0.019993 - 0.000101 * t) + math.sin(3 * anomaly) * 0.000289)
    omega = math.radians(125.04 - 1934.136 * t)
    apparent = math.radians(mean_longitude + center - 0.00569 - 0.00478 * math.sin(omega))
    arcseconds = 21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))
    obliquity = math.radians(23 + (26 + arcseconds / 60) / 60 + 0.00256 * math.cos(omega))
    declination = math.degrees(math.asin(math.sin(obliquity) * math.sin(apparent)))
    y = math.tan(obliquity / 2) ** 2
    l0 = math.radians(mean_longitude)
    equation = 4 * math.degrees(
        y * math.sin(2 * l0) - 2 * eccentricity * math.sin(anomaly)
        + 4 * eccentricity * y * math.sin(anomaly) * math.cos(2 * l0)
        - 0.5 * y * y * math.sin(4 * l0) - 1.25 * eccentricity ** 2 * math.sin(2 * anomaly))
    return declination, equation


def sun_day(latitude, longitude, date):
    """Day length, sunrise and sunset (UTC minutes after midnight), and sun angles for one date.

    Longitude is positive east, so western Idaho is negative. Raises ValueError where the sun does not rise or set.
    """
    declination, equation = _sun_at_noon(longitude, date)
    phi, delta = math.radians(latitude), math.radians(declination)
    cos_hour_angle = math.cos(math.radians(REFRACTION_ZENITH)) / (math.cos(phi) * math.cos(delta)) - math.tan(phi) * math.tan(delta)
    if not -1 <= cos_hour_angle <= 1:
        raise ValueError("The sun does not rise or set on this date at this latitude")
    hour_angle = math.degrees(math.acos(cos_hour_angle))
    noon = 720 - 4 * longitude - equation
    horizon = math.radians(90 - REFRACTION_ZENITH)
    cos_azimuth = (math.sin(delta) - math.sin(phi) * math.sin(horizon)) / (math.cos(phi) * math.cos(horizon))
    rise_azimuth = math.degrees(math.acos(max(-1, min(1, cos_azimuth))))
    return {
        "day_length_hours": 2 * hour_angle / 15,
        "sunrise_utc_minutes": noon - 4 * hour_angle,
        "solar_noon_utc_minutes": noon,
        "sunset_utc_minutes": noon + 4 * hour_angle,
        "noon_altitude_deg": 90 - abs(latitude - declination),
        "sunrise_azimuth_deg": rise_azimuth,
        "sunset_azimuth_deg": 360 - rise_azimuth,
        "declination_deg": declination,
    }


def clock_time(utc_minutes, utc_offset_hours):
    """HH:MM on a 24-hour clock that runs utc_offset_hours from UTC, rounded to the nearest minute."""
    minutes = round_half_up(utc_minutes + 60 * utc_offset_hours) % 1440
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def daylight_months(latitude, longitude, year):
    """Mean, shortest, and longest day length (hours) for each month of the year."""
    months = []
    for month in range(1, 13):
        lengths = [sun_day(latitude, longitude, datetime.date(year, month, day))["day_length_hours"]
                   for day in range(1, calendar.monthrange(year, month)[1] + 1)]
        months.append({"month": month, "mean_hours": sum(lengths) / len(lengths),
                       "shortest_hours": min(lengths), "longest_hours": max(lengths)})
    return months


def daylight_crossings(latitude, longitude, year, hours):
    """First and last date (MM-DD) of the year with at least this many hours of daylight."""
    days = [datetime.date(year, 1, 1) + datetime.timedelta(days=n) for n in range(365 if not calendar.isleap(year) else 366)]
    long_days = [day for day in days if sun_day(latitude, longitude, day)["day_length_hours"] >= hours]
    if not long_days:
        return None
    return [f"{long_days[0].month:02d}-{long_days[0].day:02d}", f"{long_days[-1].month:02d}-{long_days[-1].day:02d}"]
