"""Validate canonical JSON, rebuild local SQLite, generate browser data, and run read-only SQL."""
import argparse
import datetime
import hashlib
import json
import math
import pathlib
import re
import sqlite3
import sys
import tempfile

from site_climate import (FALL_FIRST_DAY, SPRING_LAST_DAY, clock_time, day_of_year, daylight_crossings, daylight_months, distance_miles,
                          frost_summary, hardiness_zone, parse_month_day, sun_day)
from site_grid import M_TO_FT, SiteGrid

ROOT = pathlib.Path(__file__).resolve().parents[1]
DOCUMENTS = (
    "site", "terrain", "inventory", "catalog", "orchard", "plants", "locations",
    "plantings", "plant_events", "water_harvesting", "cultivar_library", "climate",
)
INVENTORY_FIELDS = (
    "source_row", "quantity", "category", "subcategory", "type", "variety", "metal_tag",
    "pseudomonas", "pseudomonas_quantity", "place", "relocation_date", "notes",
)
FRUIT_FIELDS = (
    "source_row", "quantity", "type", "variety", "code", "rootstock", "fertility",
    "pollen_quality", "ploidy", "flowering_group", "pollenizers",
)
MONTH_NAMES = ("January", "February", "March", "April", "May", "June", "July", "August",
               "September", "October", "November", "December")


def _unique_keys(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def _invalid_constant(value):
    raise ValueError(f"Non-finite JSON number: {value}")


def load_data(root=ROOT):
    root = pathlib.Path(root)
    unexpected = {p.stem for p in (root / "data").glob("*.json")} - set(DOCUMENTS)
    if unexpected:
        raise ValueError(f"Unregistered JSON collections: {sorted(unexpected)}; add their schema/import rules first")
    documents = {}
    for name in DOCUMENTS:
        path = root / "data" / (name + ".json")
        try:
            documents[name] = json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=_unique_keys,
                                         parse_constant=_invalid_constant)
        except (json.JSONDecodeError, ValueError) as error:
            raise ValueError(f"{path.name}: {error}") from error
    return documents


def _number(value, name, minimum=None):
    if not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value):
        raise ValueError(f"{name} must be a finite number")
    if minimum is not None and value < minimum:
        raise ValueError(f"{name} must be at least {minimum}")


def _integer(value, name, minimum=0):
    _number(value, name, minimum)
    if not isinstance(value, int):
        raise ValueError(f"{name} must be an integer")


def _text(value, name, allow_empty=True):
    if not isinstance(value, str) or (not allow_empty and not value.strip()):
        raise ValueError(f"{name} must be {'nonempty ' if not allow_empty else ''}text")


def _date(value, name):
    if value is not None:
        if not isinstance(value, str):
            raise ValueError(f"{name} must be an ISO date or null")
        try:
            parsed = datetime.date.fromisoformat(value)
        except ValueError as error:
            raise ValueError(f"{name} must be an ISO date or null") from error
        if parsed.isoformat() != value:
            raise ValueError(f"{name} must use YYYY-MM-DD")


def _month_or_date(value, name):
    """A planting date the owner gave only as a month is stored as YYYY-MM, so no day is invented."""
    month = re.fullmatch(r"([0-9]{4})-(0[1-9]|1[0-2])", value) if isinstance(value, str) else None
    try:
        if month:
            datetime.date(int(month.group(1)), int(month.group(2)), 1)
        else:
            _date(value, name)
    except ValueError as error:
        raise ValueError(f"{name} must be YYYY-MM-DD, YYYY-MM, or null") from error


def _index(records, label, key="id"):
    if not isinstance(records, list):
        raise ValueError(f"{label} records must be an array")
    result = {}
    for record in records:
        if not isinstance(record, dict) or key not in record:
            raise ValueError(f"{label} record needs {key}")
        value = record[key]
        if key == "id":
            _text(value, label + " id", False)
        else:
            _integer(value, label + " " + key, 1)
        if value in result:
            raise ValueError(f"duplicate {label} {key}: {value}")
        result[value] = record
    return result


def _require(record, keys, label):
    if not isinstance(record, dict):
        raise ValueError(f"{label} must be an object")
    missing = set(keys) - record.keys()
    if missing:
        raise ValueError(f"{label} missing fields: {sorted(missing)}")


def _keys(value, label):
    """The key names of a JSON object, with a clear error when the value is not one."""
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be an object")
    return set(value)


def _point(point, label):
    if not isinstance(point, list) or len(point) != 2:
        raise ValueError(f"{label} must contain x and y")
    for v in point:
        _number(v, label)


RIPENING_BANDS = ("Early", "Mid", "Late", "Very late")
PLAN_TYPES = ("Apple", "Pear", "Cherry", "Peach", "Plum", "Apricot")
# A planned tree is either bought as a tree or grafted onto one of the owner's reserved rootstocks.
PLAN_METHODS = ("buy", "graft")
# Optional fields each fruit type may carry; the pollination rules read them.
PLAN_TYPE_FIELDS = {"Apple": {"flowering_group", "ploidy", "not_pollinated_by"},
                    "Pear": {"self_fertile", "pear_bloom", "not_pollinated_by"},
                    "Cherry": {"self_fertile", "cherry_chart", "not_pollinated_by"}, "Peach": {"self_fertile"},
                    "Plum": {"self_fertile"}, "Apricot": {"self_fertile"}}
# The pollination rules pair only apples, pears, and cherries, so these must not need a partner.
PLAN_SELF_FERTILE_ONLY = ("Peach", "Plum", "Apricot")
PEAR_BLOOM_PERIODS = ("early", "mid", "late")
LIBRARY_GROUPS = ("Apple", "Pear", "Cherry", "Peach", "Apricot", "Plum", "Berry", "Nut", "Evergreen", "Shade tree", "Perennial")
LIBRARY_KINDS = ("cultivar", "species", "genus", "rootstock")
LIBRARY_USES = ("fresh", "cooking", "cider", "perry", "juice", "jelly", "canning", "drying", "storage", "pollinizer",
                "ornamental", "nuts", "windbreak", "wildlife", "shade", "timber", "syrup", "herb", "mulch", "rootstock")
LIBRARY_TEXT = {"tagline": (15, 70), "summary": (40, 240), "appearance": (30, 320), "flavor_use": (30, 320),
                "id_cues": (30, 320), "ripening_note": (0, 140), "hardiness": (0, 80)}
# Tree habit, bark, and leaf notes are null when no source describes them for that plant.
LIBRARY_TRAITS = {"habit": (20, 300), "bark": (20, 300), "leaf": (20, 300)}
LIBRARY_GROUP_TEXT = {"habit": (40, 400), "bark": (40, 400), "leaf": (40, 400)}


def _validate_sources(sources, label):
    if not isinstance(sources, list) or not sources:
        raise ValueError(f"{label}: needs at least one source")
    for source in sources:
        if not isinstance(source, list) or len(source) != 2:
            raise ValueError(f"{label}: sources must be [label, link] pairs")
        _text(source[0], f"{label} source label", False)
        _text(source[1], f"{label} source link", False)
        if not source[1].startswith("https://"):
            raise ValueError(f"{label}: source links must use https")


# Columns of the owner's seed list (the Trees sheet), which names species the owner is starting from seed.
SEED_COLUMNS = {"B": "name", "C": "code", "D": "zones", "E": "growth", "F": "size", "G": "type", "H": "germination",
                "I": "sowing", "J": "notes"}


def _seed_list(workbook_records):
    seeds = {}
    for record in workbook_records:
        if record["sheet"] != "Trees" or record["source_row"] == 1:
            continue
        values = record["values"]
        entry = {label: str(values[column]).strip() for column, label in SEED_COLUMNS.items() if str(values.get(column, "")).strip()}
        if "name" in entry:
            seeds[record["source_row"]] = entry
    return seeds


def _validate_cultivar_library(data, inventory, fruit, workbook):
    library = data["cultivar_library"]
    _require(library, ("unprofiled", "records", "group_notes"), "cultivar library")
    matches = data["orchard"]["rules"]["INVENTORY_MATCH"]
    profiles = _index(library["records"], "cultivar profile")
    in_scope = set(inventory)
    seeds = _seed_list(workbook.values())
    plan = data["orchard"]["rules"].get("PLANTING_PLAN")
    # Cultivars the owner plans to buy have no inventory or purchase row yet; the planting plan is their link.
    planned = ({item["profile"] for item in plan["items"] if isinstance(item, dict) and isinstance(item.get("profile"), str)}
               if isinstance(plan, dict) and isinstance(plan.get("items"), list) else set())
    inventory_links, purchase_links, seed_links = {}, {}, {}
    for profile in profiles.values():
        label = profile["id"]
        _require(profile, ("group", "type", "kind", "name", "aliases", "inventory_rows", "purchase_rows", *LIBRARY_TEXT,
                           *LIBRARY_TRAITS, "uses", "ripening", "sources", "basis", "reviewed_on"), "cultivar profile " + label)
        if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", label):
            raise ValueError(f"Cultivar profile id must be a lowercase slug: {label}")
        if profile["group"] not in LIBRARY_GROUPS:
            raise ValueError(f"{label}: group must be one of {LIBRARY_GROUPS}")
        if profile["kind"] not in LIBRARY_KINDS:
            raise ValueError(f"{label}: kind must be one of {LIBRARY_KINDS}")
        _text(profile["type"], f"{label} type", False)
        _text(profile["name"], f"{label} name", False)
        if not isinstance(profile["aliases"], list):
            raise ValueError(f"{label}: aliases must be a list")
        for alias in profile["aliases"]:
            _text(alias, f"{label} alias", False)
        if len(set(profile["aliases"])) != len(profile["aliases"]):
            raise ValueError(f"{label}: aliases must be distinct")
        for key, links, valid in (("inventory_rows", inventory_links, in_scope), ("purchase_rows", purchase_links, fruit),
                                  ("seed_rows", seed_links, seeds)):
            rows = profile.get(key, []) if key == "seed_rows" else profile[key]
            if not isinstance(rows, list):
                raise ValueError(f"{label}: {key} must be a list")
            for source in rows:
                _integer(source, f"{label} {key}", 1)
                if source not in valid:
                    raise ValueError(f"{label}: {key} references missing or out-of-scope row {source}")
                if source in links:
                    raise ValueError(f"{key} row {source} is linked to both {links[source]} and {label}")
                links[source] = label
        if not (profile["inventory_rows"] or profile["purchase_rows"] or profile.get("seed_rows") or label in planned):
            raise ValueError(f"{label}: needs at least one inventory, purchase, or seed-list row, or a place in the planting plan")
        for row in profile["inventory_rows"]:
            if not set(matches.get(str(row), {}).get("rows", [])) <= set(profile["purchase_rows"]):
                raise ValueError(f"{label}: purchase rows must include the purchase match of inventory row {row}")
        for key, (low, high) in LIBRARY_TEXT.items():
            _text(profile[key], f"{label} {key}")
            if not low <= len(profile[key]) <= high:
                raise ValueError(f"{label}: {key} must be {low} to {high} characters")
        for key, (low, high) in LIBRARY_TRAITS.items():
            if profile[key] is not None:
                _text(profile[key], f"{label} {key}", False)
                if not low <= len(profile[key]) <= high:
                    raise ValueError(f"{label}: {key} must be {low} to {high} characters or null")
        if profile.get("note") is not None:
            _text(profile["note"], f"{label} note", False)
        if (not isinstance(profile["uses"], list) or not profile["uses"] or len(set(profile["uses"])) != len(profile["uses"])
                or not set(profile["uses"]) <= set(LIBRARY_USES)):
            raise ValueError(f"{label}: uses must be distinct values from {LIBRARY_USES}")
        if profile["ripening"] is not None and profile["ripening"] not in RIPENING_BANDS:
            raise ValueError(f"{label}: ripening must be one of {RIPENING_BANDS} or null")
        if profile["basis"] not in ("sourced", "general"):
            raise ValueError(f"{label}: basis must be sourced or general")
        _date(profile["reviewed_on"], f"{label} reviewed_on")
        if profile["reviewed_on"] is None:
            raise ValueError(f"{label}: reviewed_on is required")
        _validate_sources(profile["sources"], label)
    unprofiled = library["unprofiled"]
    if not isinstance(unprofiled, dict):
        raise ValueError("Unprofiled inventory rows must be an object")
    for key, reason in unprofiled.items():
        _text(reason, f"unprofiled reason {key}", False)
        if not key.isdigit() or int(key) not in in_scope:
            raise ValueError(f"Unprofiled row {key} is not an inventory line")
        if int(key) in inventory_links:
            raise ValueError(f"Inventory row {key} cannot be both profiled and unprofiled")
    missing = sorted(in_scope - set(inventory_links) - {int(key) for key in unprofiled})
    if missing:
        raise ValueError(f"Inventory lines without a cultivar profile: {missing}")
    unlinked = sorted(set(seeds) - set(seed_links))
    if unlinked:
        raise ValueError(f"Seed-list species without a cultivar profile: {unlinked}")
    notes = library["group_notes"]
    if not isinstance(notes, list):
        raise ValueError("Group notes must be a list")
    present = {profile["group"] for profile in profiles.values()}
    seen = set()
    for note in notes:
        _require(note, ("group", *LIBRARY_GROUP_TEXT, "sources", "reviewed_on"), "group note")
        label = f"group note {note['group']}"
        if note["group"] not in present:
            raise ValueError(f"{label}: no cultivar profile belongs to this group")
        if note["group"] in seen:
            raise ValueError(f"{label}: duplicated")
        seen.add(note["group"])
        for key, (low, high) in LIBRARY_GROUP_TEXT.items():
            _text(note[key], f"{label} {key}", False)
            if not low <= len(note[key]) <= high:
                raise ValueError(f"{label}: {key} must be {low} to {high} characters")
        _date(note["reviewed_on"], f"{label} reviewed_on")
        if note["reviewed_on"] is None:
            raise ValueError(f"{label}: reviewed_on is required")
        _validate_sources(note["sources"], label)
    return {source: profiles[label] for source, label in purchase_links.items()}


STONE_FRUIT_TYPES = ("Apricot", "Cherry", "Peach", "Plum")


def _living_donor_names(data):
    """Names the pollination model gives the living orchard trees, by fruit type: the purchase-sheet cultivar, or the match name."""
    rules = data["orchard"]["rules"]
    fruit = {record["source_row"]: record for record in data["catalog"]["fruit_records"]}
    types = {record["source_row"]: record["type"] for record in data["inventory"]["records"]}
    names = {}
    for plant in data["plants"]["records"]:
        if plant["group"] != "orchard" or plant["health_status"] != "living":
            continue
        match = rules["INVENTORY_MATCH"][str(plant["inventory_row"])]
        name = fruit[match["rows"][0]]["variety"] if match["rows"] else match.get("name")
        if name:
            names.setdefault(types[plant["inventory_row"]], set()).add(name)
    return names


def _validate_planting_plan(data, locations, active_spots):
    """Check PLANTING_PLAN: the cultivars recommended for the open spots of one planting year."""
    rules = data["orchard"]["rules"]
    plan = rules.get("PLANTING_PLAN")
    if plan is None:
        return
    _require(plan, ("year", "covers_rows", "status", "summary", "rootstock_advice", "shipping_note", "items"), "planting plan")
    _integer(plan["year"], "planting plan year", 2000)
    _integer(plan["covers_rows"], "planting plan covers_rows", 1)
    if plan["covers_rows"] > rules["ORCHARD_ROWS"]:
        raise ValueError("Planting plan covers_rows is more than the orchard has")
    for key in ("status", "summary", "rootstock_advice", "shipping_note"):
        _text(plan[key], "planting plan " + key, False)
    if not isinstance(plan["items"], list) or not plan["items"]:
        raise ValueError("The planting plan needs at least one item")
    profiles = {record["id"]: record for record in data["cultivar_library"]["records"]}
    spots = {location["name"]: location for location in locations.values() if location["orchard_row"] is not None}
    required = ("id", "type", "method", "cultivar", "code", "profile", "quantity", "spots", "rootstock", "role", "caution")
    seen_ids, seen_codes, seen_spots, seen_profiles = set(), set(), set(), set()
    grafts = 0
    for item in plan["items"]:
        if not isinstance(item, dict):
            raise ValueError("Each planting plan item must be an object")
        _require(item, required, "planting plan item")
        label = item["id"]
        if item["type"] not in PLAN_TYPES:
            raise ValueError(f"Planting plan item {label}: type must be one of {PLAN_TYPES}")
        if item["method"] not in PLAN_METHODS:
            raise ValueError(f"Planting plan item {label}: method must be one of {PLAN_METHODS}")
        if item["method"] == "graft" and item["type"] != "Apple":
            raise ValueError(f"Planting plan item {label}: only apples are grafted onto the reserved rootstocks")
        if extra := set(item) - set(required) - PLAN_TYPE_FIELDS[item["type"]]:
            raise ValueError(f"Planting plan item {label} has unknown fields for a {item['type'].lower()}: {sorted(extra)}")
        if not isinstance(label, str) or not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", label) or label in seen_ids:
            raise ValueError(f"Planting plan item id must be a unique lowercase slug: {label}")
        seen_ids.add(label)
        for key in ("cultivar", "rootstock", "role", "caution"):
            _text(item[key], f"planting plan {label} {key}", False)
        if not isinstance(item["code"], str) or not re.fullmatch(r"[A-Z]{2,4}", item["code"]) or item["code"] in seen_codes:
            raise ValueError(f"Planting plan item {label}: code must be a unique 2 to 4 letter capital code")
        seen_codes.add(item["code"])
        profile = profiles.get(item["profile"]) if isinstance(item["profile"], str) else None
        if profile is None:
            raise ValueError(f"Planting plan item {label} references a missing cultivar profile")
        if profile["type"] != item["type"]:
            raise ValueError(f"Planting plan item {label}: profile type {profile['type']} disagrees with {item['type']}")
        if item["profile"] in seen_profiles:
            raise ValueError(f"Planting plan item {label} repeats a profile; list each cultivar once")
        seen_profiles.add(item["profile"])
        _integer(item["quantity"], f"planting plan {label} quantity", 1)
        if not isinstance(item["spots"], list) or len(item["spots"]) != item["quantity"]:
            raise ValueError(f"Planting plan item {label}: quantity must equal the number of spots")
        if item["method"] == "graft":
            grafts += item["quantity"]
        for name in item["spots"]:
            location = spots.get(name) if isinstance(name, str) else None
            if location is None:
                raise ValueError(f"Planting plan item {label} names an unknown orchard spot: {name}")
            if name in seen_spots:
                raise ValueError(f"Planting plan spot {name} is used twice")
            seen_spots.add(name)
            if location["id"] in active_spots:
                raise ValueError(f"Planting plan spot {name} already holds an active planting")
            if (location["reserved_for"] is not None) != (item["method"] == "graft"):
                raise ValueError(f"Planting plan spot {name}: grafted trees go in reserved spots and bought trees in the others")
            if location["replacement_year"] is not None and (
                    location["replacement_year"] != plan["year"] or location["replacement_type"] not in (item["type"], "Tree")):
                raise ValueError(f"Planting plan spot {name} disagrees with its recorded replacement")
        if item["type"] == "Apple":
            _integer(item.get("flowering_group"), f"planting plan {label} flowering_group", 1)
            if item["flowering_group"] > 5 or item.get("ploidy") not in ("Diploid", "Triploid"):
                raise ValueError(f"Planting plan item {label}: apples need a flowering group of 1 to 5 and a ploidy")
        elif not isinstance(item.get("self_fertile"), bool):
            raise ValueError(f"Planting plan item {label}: self_fertile must be true or false")
        elif item["type"] in PLAN_SELF_FERTILE_ONLY and not item["self_fertile"]:
            raise ValueError(f"Planting plan item {label}: the pollination rules cannot pair a {item['type'].lower()}; "
                             "choose a self-fertile cultivar")
        avoid = item.get("not_pollinated_by", [])
        if not isinstance(avoid, list) or any(not isinstance(name, str) or not name.strip() for name in avoid):
            raise ValueError(f"Planting plan item {label}: not_pollinated_by must be a list of cultivar names")
        if any(name != name.strip() for name in avoid):
            raise ValueError(f"Planting plan item {label}: not_pollinated_by names must not start or end with a space")
        if item["type"] == "Pear":
            bloom = item.get("pear_bloom")
            if (not isinstance(bloom, list) or len(bloom) < 2 or not isinstance(bloom[0], str) or not bloom[0]
                    or any(period not in PEAR_BLOOM_PERIODS for period in bloom[1:])):
                raise ValueError(f"Planting plan item {label}: pear_bloom needs a label and bloom periods from {PEAR_BLOOM_PERIODS}")
        if item["type"] == "Cherry":
            chart = item.get("cherry_chart")
            if chart is None:
                if not item["self_fertile"]:
                    raise ValueError(f"Planting plan item {label}: a cherry that is not self-fertile needs a cherry_chart")
            else:
                if not isinstance(chart, dict) or set(chart) != {"group", "bloom"} or not (
                        chart["group"] is None or isinstance(chart["group"], str)):
                    raise ValueError(f"Planting plan item {label}: cherry_chart needs group and bloom")
                _integer(chart["bloom"], f"planting plan {label} cherry bloom", 1)
                if chart["bloom"] > 6:
                    raise ValueError(f"Planting plan item {label}: cherry bloom must be 1 to 6")
    # The model drops a donor whose name starts with an entry (any case), so an entry that starts no name would do nothing.
    donors = _living_donor_names(data)
    for item in plan["items"]:
        names = donors.get(item["type"], set()) | {other["cultivar"] for other in plan["items"]
                                                    if other is not item and other["type"] == item["type"]}
        for avoided in item.get("not_pollinated_by", []):
            if not any(name.lower().startswith(avoided.lower()) for name in names):
                raise ValueError(f"Planting plan item {item['id']}: not_pollinated_by {avoided!r} matches no living or "
                                 f"planned {item['type'].lower()} cultivar, so it would exclude nothing")
    if grafts:
        _text(plan.get("graft_advice"), "planting plan graft_advice", False)
        rootstocks = {p["id"] for p in data["plants"]["records"] if p["group"] == "rootstock" and p["health_status"] == "living"}
        planted = {a["plant_id"] for a in data["plantings"]["records"] if a["status"] == "planted"}
        if grafts > len(rootstocks - planted):
            raise ValueError(f"The planting plan grafts {grafts} trees but only {len(rootstocks - planted)} rootstocks are unplanted")
    elif "graft_advice" in plan:
        raise ValueError("graft_advice belongs only to a plan with grafted items")
    unplanned = sorted((spot["orchard_row"], spot["orchard_column"]) for name, spot in spots.items()
                       if spot["orchard_row"] <= plan["covers_rows"] and spot["id"] not in active_spots and name not in seen_spots)
    if unplanned:
        raise ValueError("Orchard spots in rows 1 to {} have no planting plan item: {}".format(
            plan["covers_rows"], [f"R{r}-C{c}" for r, c in unplanned]))
    held = {name for name, location in spots.items() if location["replacement_year"] == plan["year"]}
    if held - seen_spots:
        raise ValueError(f"Open replacement spots without a planting plan item: {sorted(held - seen_spots)}")


def _validate_unidentified_apples(rules, inventory, fruit, workbook, profile_by_purchase_row):
    info = rules["UNIDENTIFIED_APPLES"]
    _require(info, ("inventory_row", "stated_on", "owner_statement", "candidates"), "unidentified apples")
    _date(info["stated_on"], "unidentified apples stated_on")
    if info["stated_on"] is None:
        raise ValueError("Unidentified apples need a stated_on date")
    _text(info["owner_statement"], "unidentified apples owner_statement", False)
    _validate_unidentified_line(info, "Apple", rules, inventory, fruit, workbook, profile_by_purchase_row)


def _validate_unidentified_stone_fruit(rules, inventory, fruit, workbook, profile_by_purchase_row):
    info = rules["UNIDENTIFIED_STONE_FRUIT"]
    _require(info, ("assumption", "lines"), "unidentified stone fruit")
    _text(info["assumption"], "unidentified stone fruit assumption", False)
    if not isinstance(info["lines"], list) or not info["lines"]:
        raise ValueError("Unidentified stone fruit needs at least one inventory line")
    listed = set()
    labels = {rules["UNIDENTIFIED_APPLES"].get("label", "UnKn")}
    for line in info["lines"]:
        _require(line, ("inventory_row", "type", "label", "candidates"), "unidentified stone fruit line")
        if line["type"] not in STONE_FRUIT_TYPES:
            raise ValueError(f"Unidentified stone fruit type must be one of {STONE_FRUIT_TYPES}")
        if line["inventory_row"] in listed:
            raise ValueError(f"Unidentified inventory row {line['inventory_row']} is listed twice")
        listed.add(line["inventory_row"])
        _validate_unidentified_line(line, line["type"], rules, inventory, fruit, workbook, profile_by_purchase_row)
        # Labels are the number tags written on the trees, so no two unidentified lines may share one.
        if line["label"] in labels:
            raise ValueError(f"Unidentified tree label {line['label']} is used by more than one line")
        labels.add(line["label"])


def _validate_unidentified_line(info, fruit_type, rules, inventory, fruit, workbook, profile_by_purchase_row):
    """One unidentified inventory line: its candidates must be the purchases that no tagged tree accounts for."""
    noun = fruit_type.lower()
    row, matches = info["inventory_row"], rules["INVENTORY_MATCH"]
    if row not in inventory or inventory[row]["type"] != fruit_type or matches[str(row)]["rows"]:
        raise ValueError(f"Unidentified {noun} lines must reference a {noun} inventory row with no purchase match")
    if "label" in info and not re.fullmatch(r"[A-Za-z][A-Za-z0-9]{1,9}", str(info["label"])):
        raise ValueError(f"Unidentified {noun} label must be 2 to 10 letters or digits, starting with a letter")
    # Purchase rows that share a tagged inventory line form one group; what the group bought minus what is tagged is unmatched.
    parent = {source: source for source, record in fruit.items() if record["type"] == fruit_type}

    def find(source):
        while parent[source] != source:
            parent[source] = parent[parent[source]]
            source = parent[source]
        return source

    for match in matches.values():
        linked = [source for source in match["rows"] if source in parent]
        for source in linked[1:]:
            parent[find(source)] = find(linked[0])
    members = {}
    for source in parent:
        members.setdefault(find(source), []).append(source)
    tagged = dict.fromkeys(members, 0)
    tagged_lines = {group: set() for group in members}
    for line, match in matches.items():
        linked = [source for source in match["rows"] if source in parent]
        if linked and int(line) != row:
            tagged[find(linked[0])] += inventory[int(line)]["quantity"]
            tagged_lines[find(linked[0])].add(int(line))
    unmatched = {group: sum(fruit[source]["quantity"] for source in rows) - tagged[group] for group, rows in members.items()}
    unmatched = {group: count for group, count in unmatched.items() if count > 0}
    candidates = info["candidates"]
    if not isinstance(candidates, list) or not candidates:
        raise ValueError(f"Unidentified {noun}s need a candidate list")
    listed = set()
    for candidate in candidates:
        _require(candidate, ("rows", "slots", "vendors"), f"unidentified {noun} candidate")
        rows = candidate["rows"]
        if not isinstance(rows, list) or not rows or any(source not in parent for source in rows):
            raise ValueError(f"Unidentified {noun} candidate rows must be {noun} purchase rows")
        group = find(rows[0])
        if sorted(rows) != sorted(members[group]):
            raise ValueError(f"Unidentified {noun} candidate rows {rows} must list the whole purchase group {sorted(members[group])}")
        if group in listed:
            raise ValueError(f"Duplicate unidentified {noun} candidate for purchase rows {rows}")
        listed.add(group)
        _integer(candidate["slots"], f"unidentified {noun} candidate slots", 1)
        if candidate["slots"] != unmatched.get(group, 0):
            raise ValueError(f"Unidentified {noun} candidate slots disagree with purchases minus tagged trees for rows {rows}")
        sellers = set()
        for source in rows:
            purchase = workbook.get(f"Trees:Fruit:{source}")
            if purchase is None:
                raise ValueError(f"Fruit row {source} is missing from the workbook records")
            sellers.add(purchase["values"].get("A"))
        vendors = candidate["vendors"]
        if not isinstance(vendors, list) or not vendors or not set(vendors) <= sellers:
            raise ValueError(f"Unidentified {noun} candidate vendors must be vendors of purchase rows {rows}")
        for key in ("note", "long_shot"):
            if key in candidate:
                _text(candidate[key], f"unidentified {noun} " + key, False)
        # Tagged lines worth comparing besides the ones matched to this purchase (for example a tag that may be wrong).
        compare = candidate.get("compare_with", [])
        if not isinstance(compare, list) or len(set(map(str, compare))) != len(compare):
            raise ValueError(f"Unidentified {noun} candidate compare_with must be a list of distinct inventory rows")
        for source in compare:
            _integer(source, f"unidentified {noun} compare_with row", 1)
            if source == row or source not in inventory or inventory[source]["type"] != fruit_type:
                raise ValueError(f"Unidentified {noun} candidate compare_with must be other {noun} inventory rows")
            if source in tagged_lines[group]:
                raise ValueError(f"Unidentified {noun} candidate compare_with repeats row {source}, which is already tagged for rows {rows}")
        profile = profile_by_purchase_row.get(rows[0])
        if profile is None or sorted(profile["purchase_rows"]) != sorted(rows):
            raise ValueError(f"Unidentified {noun} candidate rows {rows} need a cultivar profile for exactly those purchase rows")
    omitted = set(unmatched) - listed
    if omitted:
        raise ValueError(f"Unidentified {noun} candidates omit unmatched purchases: " +
                         ", ".join(str(sorted(members[group])) for group in omitted))
    if sum(candidate["slots"] for candidate in candidates) < inventory[row]["quantity"]:
        raise ValueError(f"Unidentified {noun} candidates cannot cover every unidentified tree")


FROST_DATE_STATS = ("earliest", "p10", "p50", "p90", "latest")
FREE_DAY_STATS = ("shortest", "p10", "p50", "p90", "longest")
LONGEST_MONTHS = (31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)
# What the site climate page looks up by name, so the data cannot drop it without breaking the page.
CLIMATE_CHECK_SOURCES = ("prism-lot", "daymet-lot", "coop-prairie-historic")
CLIMATE_KEY_DATES = ("march-equinox", "june-solstice", "september-equinox", "december-solstice")
CLIMATE_CROSSINGS = ("10", "12", "14", "15")
MOUNTAIN_CLOCKS = {"MST": -7, "MDT": -6}


def _year_range(value, label):
    if not isinstance(value, list) or len(value) != 2:
        raise ValueError(f"{label} must be [first year, last year]")
    for year in value:
        _integer(year, label + " year", 1800)
    if value[0] > value[1]:
        raise ValueError(f"{label} must not end before it starts")
    return value[0], value[1]


def _twelve(values, label, minimum=None):
    if not isinstance(values, list) or len(values) != 12:
        raise ValueError(f"{label} needs 12 monthly values")
    for value in values:
        _number(value, label, minimum)


def _clock_minutes(text, label):
    match = re.fullmatch(r"([01][0-9]|2[0-3]):([0-5][0-9])", text) if isinstance(text, str) else None
    if not match:
        raise ValueError(f"{label} must be HH:MM")
    return int(match.group(1)) * 60 + int(match.group(2))


def _required_date(value, label):
    _date(value, label)
    if value is None:
        raise ValueError(f"{label} is required")
    return datetime.date.fromisoformat(value)


def _validate_frost_summary(item, label, span):
    """Check one threshold's summary; span is the number of years in the source's period."""
    _require(item, ("last_spring", "first_fall", "frost_free_days", "years_spring", "years_fall", "years_both"), label)
    days = {}
    for season in ("last_spring", "first_fall"):
        if _keys(item[season], f"{label}: {season}") != set(FROST_DATE_STATS):
            raise ValueError(f"{label}: {season} needs {', '.join(FROST_DATE_STATS)}")
        days[season] = [parse_month_day(item[season][name]) for name in FROST_DATE_STATS]
        if days[season] != sorted(days[season]):
            raise ValueError(f"{label}: {season} dates must run from earliest to latest")
    if days["last_spring"][-1] > SPRING_LAST_DAY:
        raise ValueError(f"{label}: last spring freeze dates must fall on or before Jul 31")
    if days["first_fall"][0] < FALL_FIRST_DAY:
        raise ValueError(f"{label}: first fall freeze dates must fall on or after Aug 1")
    if _keys(item["frost_free_days"], f"{label}: frost_free_days") != set(FREE_DAY_STATS):
        raise ValueError(f"{label}: frost_free_days needs {', '.join(FREE_DAY_STATS)}")
    counts = [item["frost_free_days"][name] for name in FREE_DAY_STATS]
    for count in counts:
        _integer(count, label + " frost-free days", 0)
    if counts != sorted(counts):
        raise ValueError(f"{label}: frost-free days must run from shortest to longest")
    # A year's frost-free days are its first fall freeze less its last spring freeze, so no year can lie outside the dates.
    if counts[0] < days["first_fall"][0] - days["last_spring"][-1] or counts[-1] > days["first_fall"][-1] - days["last_spring"][0]:
        raise ValueError(f"{label}: frost-free days must fit between the spring and fall dates")
    for key in ("years_spring", "years_fall", "years_both"):
        _integer(item[key], f"{label} {key}", 1)
    if item["years_both"] > min(item["years_spring"], item["years_fall"]):
        raise ValueError(f"{label}: years_both cannot exceed the years with a spring or a fall date")
    if max(item["years_spring"], item["years_fall"]) > span:
        raise ValueError(f"{label}: more years with a freeze date than the source's period has")
    if item["years_both"] < item["years_spring"] + item["years_fall"] - span:
        raise ValueError(f"{label}: too few years with both dates for the years with each")


def _validate_frost_years(years, thresholds, label):
    if not isinstance(years, list) or not years:
        raise ValueError(f"{label}: needs yearly frost dates")
    keys = {str(threshold) for threshold in thresholds}
    previous = None
    for record in years:
        _require(record, ("year", "last_spring", "first_fall"), label + " year")
        year = record["year"]
        _integer(year, label + " year", 1800)
        if previous is not None and year <= previous:
            raise ValueError(f"{label}: years must be listed once each, oldest first")
        previous = year
        windows = (("last_spring", datetime.date(year, 1, 1), datetime.date(year, 7, 31), True),
                   ("first_fall", datetime.date(year, 8, 1), datetime.date(year, 12, 31), False))
        for season, first, last, falling in windows:
            if _keys(record[season], f"{label} {year}: {season}") != keys:
                raise ValueError(f"{label} {year}: {season} needs every threshold")
            dates = []
            for threshold in thresholds:
                text = record[season][str(threshold)]
                if text is None:
                    continue
                date = _required_date(text, f"{label} {year} {season}")
                if not first <= date <= last:
                    raise ValueError(f"{label} {year}: {season} {text} must fall from {first} to {last}")
                dates.append(date)
            # Colder thresholds end spring earlier and begin fall later, so the dates must be ordered along the list.
            for earlier, later in zip(dates, dates[1:]):
                if (falling and earlier < later) or (not falling and earlier > later):
                    raise ValueError(f"{label} {year}: {season} dates disagree between thresholds")
    return years


def _validate_monthly_frost_days(monthly, thresholds, label):
    if _keys(monthly, f"{label}: monthly_days") != {str(threshold) for threshold in thresholds}:
        raise ValueError(f"{label}: monthly_days needs every threshold")
    warmer = None
    for threshold in thresholds:
        item = monthly[str(threshold)]
        _require(item, ("avg_days", "years_with_pct"), f"{label} {threshold} F monthly days")
        _twelve(item["avg_days"], f"{label} frost days", 0)
        _twelve(item["years_with_pct"], f"{label} share of years", 0)
        for month in range(12):
            days, share = item["avg_days"][month], item["years_with_pct"][month]
            _integer(share, f"{label} share of years", 0)
            if days > LONGEST_MONTHS[month] or share > 100:
                raise ValueError(f"{label}: month {month + 1} has more frost days or years than it can")
            if days > 0 and share == 0:
                raise ValueError(f"{label}: month {month + 1} has frost days but no year with one")
            if warmer and (days > warmer["avg_days"][month] or share > warmer["years_with_pct"][month]):
                raise ValueError(f"{label}: a colder threshold cannot have more frost days than a warmer one")
        warmer = item


def _validate_climate_source(source, thresholds, site):
    label = f"climate source {source['id']}"
    _require(source, ("role", "kind", "label", "latitude", "longitude", "elevation_ft", "distance_from_site_mi", "period", "url",
                      "retrieved_from", "note", "temperature", "annual_extreme_min", "frost"), label)
    if source["role"] not in ("primary", "check"):
        raise ValueError(f"{label}: role must be primary or check")
    if source["kind"] not in ("station", "model"):
        raise ValueError(f"{label}: kind must be station or model")
    for key in ("label", "retrieved_from", "note"):
        _text(source[key], f"{label} {key}", False)
    if not isinstance(source["url"], str) or not source["url"].startswith("https://"):
        raise ValueError(f"{label}: url must use https")
    for key in ("latitude", "longitude"):
        _number(source[key], f"{label} {key}")
    _number(source["elevation_ft"], label + " elevation", 0)
    _number(source["distance_from_site_mi"], label + " distance", 0)
    away = distance_miles(site["latitude"], site["longitude"], source["latitude"], source["longitude"])
    if abs(away - source["distance_from_site_mi"]) > 0.1:
        raise ValueError(f"{label}: distance_from_site_mi should be about {away:.1f} miles from its coordinates")
    start, end = _year_range(source["period"], label + " period")
    span = end - start + 1
    temperature = source["temperature"]
    _require(temperature, ("high_f", "low_f"), label + " temperature")
    _twelve(temperature["high_f"], label + " average highs")
    _twelve(temperature["low_f"], label + " average lows")
    if any(low >= high for low, high in zip(temperature["low_f"], temperature["high_f"])):
        raise ValueError(f"{label}: every month's average low must be below its average high")
    extremes = source["annual_extreme_min"]
    _require(extremes, ("years", "mean_f", "zone", "coldest_f", "coldest_on", "mildest_f"), label + " coldest nights")
    _integer(extremes["years"], label + " coldest-night years", 1)
    if extremes["years"] > span:
        raise ValueError(f"{label}: more coldest-night years than the source's period has")
    for key in ("mean_f", "coldest_f", "mildest_f"):
        _number(extremes[key], f"{label} {key}")
    if not extremes["coldest_f"] <= extremes["mean_f"] <= extremes["mildest_f"]:
        raise ValueError(f"{label}: the average coldest night must lie between the coldest and mildest years")
    if extremes["zone"] != hardiness_zone(extremes["mean_f"]):
        raise ValueError(f"{label}: hardiness zone does not match the average coldest night")
    coldest = _required_date(extremes["coldest_on"], label + " coldest night date")
    if not start <= coldest.year <= end:
        raise ValueError(f"{label}: the coldest night must fall inside the source period")
    if ("record_low_f" in extremes) != ("record_low_on" in extremes):
        raise ValueError(f"{label}: record_low_f and record_low_on go together")
    if "record_low_f" in extremes:
        _number(extremes["record_low_f"], label + " record low")
        _required_date(extremes["record_low_on"], label + " record low date")
        if extremes["record_low_f"] > extremes["coldest_f"]:
            raise ValueError(f"{label}: the record low cannot be warmer than the coldest year")
    frost = source["frost"]
    _require(frost, ("summary",), label + " frost")
    keys = {str(threshold) for threshold in thresholds}
    if _keys(frost["summary"], label + " frost summary") != keys:
        raise ValueError(f"{label}: the frost summary needs every threshold")
    for threshold in thresholds:
        _validate_frost_summary(frost["summary"][str(threshold)], f"{label} {threshold} F", span)
    for season, colder_is_later in (("last_spring", False), ("first_fall", True)):
        medians = [parse_month_day(frost["summary"][str(threshold)][season]["p50"]) for threshold in thresholds]
        if any((a > b) if colder_is_later else (a < b) for a, b in zip(medians, medians[1:])):
            raise ValueError(f"{label}: median {season} dates must move with the threshold (colder is earlier in spring, later in fall)")
    if source["role"] == "primary":
        _require(frost, ("monthly_days", "years"), label + " frost")
    if "monthly_days" in frost:
        _validate_monthly_frost_days(frost["monthly_days"], thresholds, label)
    if "years" in frost:
        years = _validate_frost_years(frost["years"], thresholds, label)
        if frost_summary(years, thresholds, start, end) != frost["summary"]:
            raise ValueError(f"{label}: the frost summary does not match the yearly dates")


def _validate_climate(data, grid):
    climate = data["climate"]
    _require(climate, ("source_page", "site", "frost", "sources", "daylight", "notes"), "climate")
    _text(climate["source_page"], "climate source_page", False)
    site = climate["site"]
    _require(site, ("name", "latitude", "longitude", "elevation_ft", "elevation_note", "time_zone", "normals_period", "retrieved_on"), "climate site")
    for key in ("name", "elevation_note", "time_zone"):
        _text(site[key], "climate site " + key, False)
    for key in ("latitude", "longitude"):
        _number(site[key], "climate site " + key)
    _number(site["elevation_ft"], "climate site elevation", 0)
    _required_date(site["retrieved_on"], "climate retrieval date")
    normals = _year_range(site["normals_period"], "climate normals period")
    fence = grid.data["lot"]["fence"]
    lot_latitude, lot_longitude = grid.to_latlon(fence["width"] / 2, fence["depth"] / 2)
    if abs(site["latitude"] - lot_latitude) > 0.001 or abs(site["longitude"] - lot_longitude) > 0.001:
        raise ValueError("Climate site coordinates must match the lot center")
    lot_elevation = grid.elevation_ft(fence["width"] / 2, fence["depth"] / 2)
    if abs(site["elevation_ft"] - lot_elevation) > 30:
        raise ValueError(f"Climate site elevation must be within 30 ft of the lot center's lidar elevation ({lot_elevation:.0f} ft)")

    frost = climate["frost"]
    _require(frost, ("thresholds_f", "labels", "definitions"), "climate frost")
    thresholds = frost["thresholds_f"]
    if not isinstance(thresholds, list) or not thresholds:
        raise ValueError("Frost thresholds must be a list")
    for threshold in thresholds:
        _integer(threshold, "frost threshold", -50)
    if sorted(set(thresholds), reverse=True) != thresholds:
        raise ValueError("Frost thresholds must be different and listed from warmest to coldest")
    if _keys(frost["labels"], "frost labels") != {str(threshold) for threshold in thresholds}:
        raise ValueError("Every frost threshold needs one label")
    for text in frost["labels"].values():
        _text(text, "frost label", False)
    definition_keys = ("last_spring", "first_fall", "frost_free_days", "dates", "incomplete_years")
    _require(frost["definitions"], definition_keys, "frost definitions")
    for key in definition_keys:
        _text(frost["definitions"][key], "frost definition " + key, False)

    sources = _index(climate["sources"], "climate source")
    if sum(1 for source in sources.values() if source.get("role") == "primary") != 1:
        raise ValueError("Climate needs exactly one primary source")
    missing = [name for name in CLIMATE_CHECK_SOURCES if name not in sources]
    if missing:
        raise ValueError(f"Climate sources need {', '.join(missing)}, which the site climate page compares")
    for source in sources.values():
        _validate_climate_source(source, thresholds, site)
    primary = next(source for source in sources.values() if source["role"] == "primary")
    if tuple(primary["period"]) != normals:
        raise ValueError("The primary climate source's period must match the site's normals period")

    daylight = climate["daylight"]
    _require(daylight, ("method", "reference_year", "months", "crossings", "key_dates"), "climate daylight")
    _text(daylight["method"], "daylight method", False)
    year = daylight["reference_year"]
    _integer(year, "daylight reference year", 1900)
    latitude, longitude = site["latitude"], site["longitude"]
    months = daylight["months"]
    if not isinstance(months, list) or not all(isinstance(month, dict) for month in months):
        raise ValueError("Daylight months must be a list of records")
    if [month.get("month") for month in months] != list(range(1, 13)):
        raise ValueError("Daylight needs all 12 months in January-to-December order")
    for stored, computed in zip(months, daylight_months(latitude, longitude, year)):
        _require(stored, ("mean_hours", "shortest_hours", "longest_hours"), f"daylight month {stored['month']}")
        for key in ("mean_hours", "shortest_hours", "longest_hours"):
            _number(stored[key], f"daylight {key}", 0)
            if abs(stored[key] - computed[key]) > 0.006:
                raise ValueError(f"Daylight {key} for month {stored['month']} does not match the site latitude")
    crossings = daylight["crossings"]
    missing = [hours for hours in CLIMATE_CROSSINGS if hours not in _keys(crossings, "Daylight crossings")]
    if missing:
        raise ValueError(f"Daylight crossings need {', '.join(missing)} hours, which the site climate page quotes")
    for hours_text, dates in crossings.items():
        try:
            hours = int(hours_text)
        except ValueError as error:
            raise ValueError(f"Daylight crossing {hours_text!r} must be a whole number of hours") from error
        if dates != daylight_crossings(latitude, longitude, year, hours):
            raise ValueError(f"Daylight crossing dates for {hours} hours do not match the site latitude")
    if not isinstance(daylight["key_dates"], list):
        raise ValueError("Daylight key dates must be a list")
    key_ids = set()
    for item in daylight["key_dates"]:
        _require(item, ("id", "label", "date", "clock", "utc_offset_hours", "sunrise", "solar_noon", "sunset", "day_length_hours",
                        "noon_altitude_deg", "sunrise_azimuth_deg", "sunset_azimuth_deg"), "daylight key date")
        for key in ("id", "label", "clock"):
            _text(item[key], "daylight key date " + key, False)
        if item["id"] in key_ids:
            raise ValueError(f"duplicate daylight key date: {item['id']}")
        key_ids.add(item["id"])
        _number(item["utc_offset_hours"], "daylight UTC offset")
        if MOUNTAIN_CLOCKS.get(item["clock"]) != item["utc_offset_hours"]:
            raise ValueError(f"Daylight key date {item['id']}: the lot keeps Mountain Time, so the clock must be MST (-7) or MDT (-6) to match its UTC offset")
        date = _required_date(item["date"], "daylight key date")
        if date.year != year:
            raise ValueError("Daylight key dates must fall in the reference year")
        sun = sun_day(latitude, longitude, date)
        for key, field in (("sunrise", "sunrise_utc_minutes"), ("solar_noon", "solar_noon_utc_minutes"), ("sunset", "sunset_utc_minutes")):
            stored = _clock_minutes(item[key], f"daylight {key}")
            expected = _clock_minutes(clock_time(sun[field], item["utc_offset_hours"]), key)
            if min(abs(stored - expected), 1440 - abs(stored - expected)) > 1:
                raise ValueError(f"Daylight {key} on {item['date']} does not match the site location")
        for key, value, tolerance in (("day_length_hours", sun["day_length_hours"], 0.006), ("noon_altitude_deg", sun["noon_altitude_deg"], 0.06),
                                      ("sunrise_azimuth_deg", sun["sunrise_azimuth_deg"], 0.06), ("sunset_azimuth_deg", sun["sunset_azimuth_deg"], 0.06)):
            _number(item[key], "daylight " + key)
            if abs(item[key] - value) > tolerance:
                raise ValueError(f"Daylight {key} on {item['date']} does not match the site location")
    missing = [name for name in CLIMATE_KEY_DATES if name not in key_ids]
    if missing:
        raise ValueError(f"Daylight key dates need {', '.join(missing)}, which the site climate page quotes")
    notes = climate["notes"]
    if not isinstance(notes, list) or len(notes) < 3:
        raise ValueError("Climate notes must be a list of at least three notes")
    for note in notes:
        _text(note, "climate note", False)
    if "cold air" not in notes[2].lower():
        raise ValueError("The third climate note must be about cold air, which the site climate page quotes")


def validate_data(data):
    if set(data) != set(DOCUMENTS):
        raise ValueError("Missing or unexpected canonical collections")
    for name, document in data.items():
        if not isinstance(document, dict):
            raise ValueError(f"{name} must be an object")
        if name not in ("site", "terrain") and document.get("schema_version") != 1:
            raise ValueError(f"Unsupported {name} schema_version")
    site, terrain = data["site"], data["terrain"]
    _require(site, ("grid", "lot", "georef", "orchard", "features"), "site")
    for key in ("width", "depth"):
        _number(site["lot"]["fence"][key], "lot " + key, 1)
    _integer(site["grid"]["cell"], "cell size", 1)
    _integer(site["grid"]["rows"], "grid rows", 1)
    _text(site["grid"]["columns"], "grid columns", False)
    columns = site["grid"]["columns"]
    if len(set(columns)) != len(columns) or not columns.isalpha() or columns != columns.upper():
        raise ValueError("Grid columns must be unique uppercase letters")
    for axis in ("lat", "lon"):
        if len(site["georef"][axis]) != 3:
            raise ValueError(f"georef {axis} needs three coefficients")
        for v in site["georef"][axis]:
            _number(v, "georef " + axis)
    grid = SiteGrid(data=site, terrain=terrain)
    features = _index(site["features"], "feature")
    for feature in features.values():
        _require(feature, ("name", "group", "status", "shape"), "feature")
        for key in ("name", "group", "status", "shape"):
            _text(feature[key], "feature " + key, False)
        shape = feature["shape"]
        if feature["status"] not in ("existing", "planned"):
            raise ValueError("Invalid feature status")
        if shape == "rect":
            for key in ("x0", "x1", "y0", "y1"):
                _number(feature[key], "feature " + key)
            if feature["x1"] <= feature["x0"] or feature["y1"] <= feature["y0"]:
                raise ValueError("Invalid feature rectangle")
        elif shape == "circle":
            for key in ("cx", "cy", "r"):
                _number(feature[key], "feature " + key)
            if feature["r"] <= 0:
                raise ValueError("Invalid feature radius")
        elif shape == "point":
            _point([feature["x"], feature["y"]], "feature point")
        elif shape in ("line", "polygon"):
            if len(feature["pts"]) < (2 if shape == "line" else 3):
                raise ValueError("Feature geometry needs more points")
            for point in feature["pts"]:
                _point(point, "feature geometry")
        else:
            raise ValueError(f"Unknown feature shape: {shape}")
    inventory = _index(data["inventory"]["records"], "inventory", "source_row")
    for record in inventory.values():
        _require(record, (*INVENTORY_FIELDS, "zone"), "inventory")
        _integer(record["quantity"], "inventory quantity", 1)
        _integer(record["pseudomonas_quantity"], "pseudomonas quantity")
        if record["pseudomonas_quantity"] > record["quantity"]:
            raise ValueError("Pseudomonas quantity exceeds inventory quantity")
        for key in INVENTORY_FIELDS[2:]:
            if key != "pseudomonas_quantity":
                _text(record[key], "inventory " + key)
    fruit = _index(data["catalog"]["fruit_records"], "cultivar", "source_row")
    for record in fruit.values():
        _require(record, FRUIT_FIELDS, "cultivar")
        _integer(record["quantity"], "cultivar quantity")
        if record["flowering_group"] is not None:
            _integer(record["flowering_group"], "flowering group", 1)
        for key in FRUIT_FIELDS[2:]:
            if key != "flowering_group":
                _text(record[key], "cultivar " + key)
    workbook = _index(data["catalog"]["workbook_records"], "workbook")
    for record in workbook.values():
        _require(record, ("workbook", "sheet", "source_row", "values"), "workbook")
        _integer(record["source_row"], "workbook source row", 1)
        if not isinstance(record["values"], dict):
            raise ValueError("Workbook values must be a cell object")
    rules = data["orchard"]["rules"]
    for key in ("ORCHARD_ROWS", "GRID_COLUMNS", "INVENTORY_MATCH", "WINDBREAK", "C1_GUILDS", "EAST_HEDGE",
                "ROOTSTOCK_LABELS", "GENERATED_CODES", "APPLE_BLOOM_RESEARCH", "PEAR_BLOOM", "CHERRY_CHART", "UNIDENTIFIED_APPLES",
                "UNIDENTIFIED_STONE_FRUIT"):
        if key not in rules:
            raise ValueError(f"Orchard rules missing {key}")
    if rules["ORCHARD_ROWS"] != site["orchard"]["rows"] or rules["GRID_COLUMNS"] != site["orchard"]["columns"]:
        raise ValueError("Orchard dimensions disagree with master grid")
    if rules["TREE_SPACING"] != site["orchard"]["tree_spacing"] or rules["ROW_SPACING"] != site["orchard"]["row_spacing"]:
        raise ValueError("Orchard spacing disagrees with master grid")
    if rules["WINDBREAK"]["width"] + rules["ORCHARD_WEST_SETBACK"] != site["orchard"]["c1_x"]:
        raise ValueError("Orchard west setback disagrees with master grid")
    if rules["TREE_SPACING"] / 2 != site["orchard"]["even_row_offset"]:
        raise ValueError("Orchard staggered-row offset disagrees with master grid")
    for row, match in rules["INVENTORY_MATCH"].items():
        if int(row) not in inventory:
            raise ValueError(f"Inventory match references missing row {row}")
        if any(source not in fruit for source in match["rows"]):
            raise ValueError(f"Inventory match {row} references a missing cultivar")
    profile_by_purchase_row = _validate_cultivar_library(data, inventory, fruit, workbook)
    _validate_unidentified_apples(rules, inventory, fruit, workbook, profile_by_purchase_row)
    _validate_unidentified_stone_fruit(rules, inventory, fruit, workbook, profile_by_purchase_row)
    for source_row, research in rules["APPLE_BLOOM_RESEARCH"].items():
        record = fruit.get(int(source_row))
        if record is None or record["type"] != "Apple" or research["fg"] != record["flowering_group"]:
            raise ValueError(f"Apple flowering-group research disagrees with cultivar row {source_row}")
    plants = _index(data["plants"]["records"], "plant")
    counts = {row: [] for row in inventory}
    for plant in plants.values():
        _require(plant, ("inventory_row", "instance", "group", "health_status"), "plant")
        row = plant["inventory_row"]
        if row not in inventory:
            raise ValueError(f"Plant {plant['id']} references missing inventory row {row}")
        _integer(plant["instance"], "plant instance", 1)
        if plant["id"] != f"i{row}-{plant['instance']}":
            raise ValueError("Plant ID must preserve its inventory-row/instance identity")
        counts[row].append(plant["instance"])
        if plant["health_status"] not in ("living", "dead"):
            raise ValueError("Invalid plant health_status")
        if plant["group"] not in ("orchard", "rootstock", "outside-orchard", "windbreak", "guild", "east-hedge", "elsewhere", "nut", "other"):
            raise ValueError("Invalid plant group")
        if plant["group"] in ("orchard", "outside-orchard"):
            match = rules["INVENTORY_MATCH"].get(str(row))
            if not match:
                raise ValueError("Orchard plant has no cultivar reconciliation")
            if match["rows"] and fruit[match["rows"][0]]["type"] != inventory[row]["type"]:
                raise ValueError("Orchard cultivar fruit type disagrees with its inventory group")
    for row, instances in counts.items():
        if sorted(instances) != list(range(1, inventory[row]["quantity"] + 1)):
            raise ValueError(f"Inventory quantity/individual plant mismatch at row {row}")
    locations = _index(data["locations"]["records"], "location")
    orchard_positions = set()
    for location in locations.values():
        _require(location, ("name", "x_ft", "y_ft", "orchard_row", "orchard_column",
                            "reserved_for", "replacement_year", "replacement_type"), "location")
        _text(location["name"], "location name", False)
        for key in ("x_ft", "y_ft"):
            _number(location[key], "location " + key)
        if not grid.in_lot(location["x_ft"], location["y_ft"]):
            raise ValueError(f"Location {location['id']} is outside the fenced lot")
        row, column = location["orchard_row"], location["orchard_column"]
        if (row is None) != (column is None):
            raise ValueError("A location needs both orchard row and column or neither")
        if row is not None:
            if (row, column) in orchard_positions:
                raise ValueError("duplicate orchard location")
            orchard_positions.add((row, column))
            expected = grid.tree_xy(row, column)
            if math.dist(expected, (location["x_ft"], location["y_ft"])) > 0.001:
                raise ValueError(f"Orchard location {location['name']} differs from master-grid coordinates")
        if location["reserved_for"] not in (None, "grafted_rootstock_apple"):
            raise ValueError("Invalid location reservation")
        if (location["replacement_year"] is None) != (location["replacement_type"] is None):
            raise ValueError("Replacement needs both year and type")
        if location["replacement_year"] is not None:
            _integer(location["replacement_year"], "replacement year", 2000)
            _text(location["replacement_type"], "replacement type", False)
    expected_positions = {(r, c) for r in range(1, rules["ORCHARD_ROWS"] + 1) for c in range(1, rules["GRID_COLUMNS"] + 1)}
    if orchard_positions != expected_positions:
        raise ValueError("Orchard locations must cover every grid position")
    plantings = _index(data["plantings"]["records"], "planting")
    active_plants, active_spots = set(), set()
    for planting in plantings.values():
        _require(planting, ("plant_id", "location_id", "status", "planted_on", "recorded_on", "notes"), "planting")
        if planting["plant_id"] not in plants:
            raise ValueError(f"Planting {planting['id']} references missing plant")
        if planting["location_id"] not in locations:
            raise ValueError(f"Planting {planting['id']} references missing location")
        if planting["status"] not in ("planned", "planted", "dead", "outside-orchard", "vacated"):
            raise ValueError("Invalid planting status")
        for key in ("planted_on", "recorded_on"):
            (_month_or_date if key == "planted_on" else _date)(planting[key], "planting " + key)
        _text(planting["notes"], "planting notes")
        if planting["status"] in ("planned", "planted"):
            if planting["plant_id"] in active_plants or planting["location_id"] in active_spots:
                raise ValueError("duplicate active plant/spot assignment")
            if plants[planting["plant_id"]]["health_status"] != "living":
                raise ValueError("A dead plant cannot occupy an active location")
            if locations[planting["location_id"]]["reserved_for"] is not None:
                raise ValueError("A reserved location cannot hold an active planting")
            active_plants.add(planting["plant_id"])
            active_spots.add(planting["location_id"])
        if planting["status"] == "dead" and plants[planting["plant_id"]]["health_status"] != "dead":
            raise ValueError("Death record disagrees with plant health")
        if planting["status"] == "outside-orchard" and plants[planting["plant_id"]]["group"] != "outside-orchard":
            raise ValueError("Outside-orchard record disagrees with plant group")
    for event in _index(data["plant_events"]["records"], "plant event").values():
        _require(event, ("plant_id", "event_type", "recorded_on", "occurred_on", "notes"), "plant event")
        if event["plant_id"] not in plants:
            raise ValueError("Plant event references missing plant")
        _text(event["event_type"], "event type", False)
        _text(event["notes"], "event notes")
        for key in ("recorded_on", "occurred_on"):
            _date(event[key], "event date")
    _validate_planting_plan(data, locations, active_spots)
    _require(terrain, ("grid", "contours", "flows", "flows_fine", "split", "ridge", "ditch", "drainage_ac"), "terrain")
    mesh = terrain["grid"]
    if mesh.get("unit") != "cm above base (m)":
        raise ValueError("Terrain sample unit must be cm above base (m)")
    for key in ("nx", "ny"):
        _integer(mesh[key], "terrain " + key, 2)
    for key in ("x0", "y0", "base"):
        _number(mesh[key], "terrain " + key)
    _number(mesh["step"], "terrain step", 0.001)
    if len(mesh["z"]) != mesh["nx"] * mesh["ny"]:
        raise ValueError("Terrain sample count does not match its mesh")
    for value in mesh["z"]:
        _integer(value, "terrain sample", -1000000)
    for line in terrain["contours"]:
        _number(line["m"], "contour elevation")
        for point in line["p"]:
            _point(point, "terrain contour")
    for key in ("flows", "flows_fine", "split"):
        for line in terrain[key]:
            for point in line:
                _point(point, "terrain " + key)
    for key in ("ridge", "ditch"):
        for point in terrain[key]:
            _point(point, "terrain " + key)
    for area in terrain["drainage_ac"].values():
        _number(area, "drainage acres", 0)
    water = data["water_harvesting"]
    months = _index(water["months"], "climate month", "month")
    if set(months) != set(range(1, 13)):
        raise ValueError("Climate needs all 12 months")
    if [month["month"] for month in water["months"]] != list(range(1, 13)):
        raise ValueError("Climate months must be in January-to-December order")
    for month in months.values():
        _number(month["precipitation_in"], "precipitation", 0)
        _number(month["et0_in"], "ET0", 0)
    for key in ("gallons_per_sqft_in", "mature_canopy_factor"):
        _number(water["assumptions"][key], "water " + key, 0)
    for depth in water["assumptions"]["root_depth_ft"]:
        _number(depth, "root depth", 0.01)
    previous_bottom = 0
    for layer in water["soil"]["layers"]:
        for key in ("top", "bottom", "clay", "awc"):
            _number(layer[key], "soil " + key, 0)
        if layer["top"] != previous_bottom or layer["bottom"] <= layer["top"]:
            raise ValueError("Soil layers must be contiguous and increasing")
        if len(layer["ksat"]) != 3:
            raise ValueError("Soil ksat needs low, typical, and high")
        for rate in layer["ksat"]:
            _number(rate, "soil ksat", 0)
        previous_bottom = layer["bottom"]
    for technique in _index(water["techniques"], "water technique").values():
        for key in ("zone", "work", "specifications", "reference", "timing"):
            _text(technique[key], "water technique " + key)
    for catchment in _index(water["catchments"], "catchment").values():
        _number(catchment["runoff_factor"], "runoff factor", 0)
        if catchment["runoff_factor"] > 1:
            raise ValueError("runoff factor must not exceed 1")
        if catchment["area_sqft"] is not None:
            _number(catchment["area_sqft"], "catchment area", 0)
    for observation in _index(water["observations"], "water observation").values():
        _require(observation, ("location_id", "observed_on", "observation_type", "value", "unit", "notes"), "water observation")
        if observation["location_id"] is not None and observation["location_id"] not in locations:
            raise ValueError("Water observation references missing location")
        _date(observation["observed_on"], "observation date")
        if observation["observed_on"] is None:
            raise ValueError("Water observation needs an observed date")
        if observation["value"] is not None:
            _number(observation["value"], "observed value")
            _text(observation["unit"], "observation unit", False)
        elif observation["unit"] is not None:
            _text(observation["unit"], "observation unit", False)
        _text(observation["observation_type"], "observation type", False)
        _text(observation["notes"], "observation notes")
    _validate_climate(data, grid)


def _json(value):
    return json.dumps(value, ensure_ascii=True, allow_nan=False, separators=(",", ":"))


def source_digest(root):
    root = pathlib.Path(root)
    sources = [(f"data/{name}.json", root / "data" / (name + ".json")) for name in DOCUMENTS]
    sources.append(("database/schema.sql", root / "database" / "schema.sql"))
    sources += [(f"web/{p.name}", p) for p in sorted((root / "web").glob("*.js"))]
    sources += [("compiler/property_data.py", pathlib.Path(__file__)), ("compiler/site_grid.py", pathlib.Path(__file__).with_name("site_grid.py")),
                ("compiler/site_climate.py", pathlib.Path(__file__).with_name("site_climate.py"))]
    digest = hashlib.sha256()
    for name, path in sources:
        digest.update(name.encode("utf-8") + b"\0" + path.read_bytes().replace(b"\r\n", b"\n") + b"\0")
    return digest.hexdigest()


def _insert(connection, table, columns, rows):
    connection.executemany(
        f"INSERT INTO {table} ({','.join(columns)}) VALUES ({','.join('?' for _ in columns)})", rows
    )


def _populate(connection, data, digest):
    grid = SiteGrid(data=data["site"], terrain=data["terrain"])
    _insert(connection, "build_metadata", ("key", "value"), [("source_digest", digest), ("schema_version", "1")])
    _insert(connection, "source_documents", ("name", "data_json"), [(name, _json(document)) for name, document in data.items()])
    cells = []
    fence = grid.data["lot"]["fence"]
    for c, letter in enumerate(grid.columns):
        for r in range(grid.rows):
            x0, y0 = c * grid.cell, r * grid.cell
            if x0 >= fence["width"] or y0 >= fence["depth"]:
                continue
            latitude, longitude = grid.to_latlon(x0, y0)
            cells.append((f"{letter}{r+1}", x0, y0, min(x0+grid.cell, fence["width"]),
                          min(y0+grid.cell, fence["depth"]), latitude, longitude))
    _insert(connection, "grid_cells", ("cell", "x0_ft", "y0_ft", "x1_ft", "y1_ft", "latitude", "longitude"), cells)
    inventory = data["inventory"]["records"]
    columns = ("source_row", "quantity", "category", "subcategory", "type", "variety", "metal_tag",
               "place", "pseudomonas", "pseudomonas_quantity", "relocation_date", "notes", "zone")
    _insert(connection, "inventory_batches", columns, [tuple(row[key] for key in columns) for row in inventory])
    _insert(connection, "cultivars", ("id", *FRUIT_FIELDS),
            [(f"fruit-{row['source_row']}", *(row[key] for key in FRUIT_FIELDS)) for row in data["catalog"]["fruit_records"]])
    purchases, workbook_rows = [], []
    for row in data["catalog"]["workbook_records"]:
        values, sheet = row["values"], row["sheet"]
        workbook_rows.append((row["id"], row["workbook"], sheet, row["source_row"], _json(values)))
        if sheet not in ("Fruit", "Berry", "Herbs") or row["source_row"] == 1:
            continue
        vendor = values.get("A" if sheet == "Fruit" else "B") if sheet in ("Fruit", "Berry", "Herbs") else None
        quantity = values.get("B" if sheet == "Fruit" else "C") if sheet in ("Fruit", "Berry", "Herbs") else None
        purchases.append((row["id"], row["workbook"], sheet, row["source_row"],
                          str(vendor) if vendor is not None else None,
                          str(quantity) if quantity is not None else None,
                          quantity if isinstance(quantity, (int, float)) else None,
                          values.get("C" if sheet == "Fruit" else "D"), values.get("D" if sheet == "Fruit" else "E"), None))
    _insert(connection, "workbook_rows", ("id", "workbook", "sheet", "source_row", "values_json"), workbook_rows)
    _insert(connection, "purchases", ("id", "workbook", "sheet", "source_row", "vendor", "quantity_text",
                                      "quantity_numeric", "item_type", "variety", "purchased_on"), purchases)
    matches = data["orchard"]["rules"]["INVENTORY_MATCH"]
    plants = []
    for row in data["plants"]["records"]:
        source_rows = matches.get(str(row["inventory_row"]), {}).get("rows", [])
        plants.append((row["id"], row["inventory_row"], row["instance"],
                       f"fruit-{source_rows[0]}" if source_rows else None, row["group"], row["health_status"]))
    _insert(connection, "plants", ("id", "inventory_row", "instance", "cultivar_id", "plant_group", "health_status"), plants)
    for document, table, columns in [
        ("locations", "locations", ("id", "name", "x_ft", "y_ft", "orchard_row", "orchard_column", "reserved_for", "replacement_year", "replacement_type")),
        ("plantings", "plantings", ("id", "plant_id", "location_id", "status", "planted_on", "recorded_on", "notes")),
        ("plant_events", "plant_events", ("id", "plant_id", "event_type", "recorded_on", "occurred_on", "notes")),
    ]:
        _insert(connection, table, columns, [tuple(row[key] for key in columns) for row in data[document]["records"]])
    profiles = data["cultivar_library"]["records"]
    _insert(connection, "cultivar_profiles",
            ("id", "plant_group", "type", "kind", "name", "tagline", "summary", "appearance", "flavor_use", "ripening",
             "ripening_note", "id_cues", "habit", "bark", "leaf", "hardiness", "basis", "note", "reviewed_on"),
            [(p["id"], p["group"], p["type"], p["kind"], p["name"], p["tagline"], p["summary"], p["appearance"], p["flavor_use"],
              p["ripening"], p["ripening_note"], p["id_cues"], p["habit"], p["bark"], p["leaf"], p["hardiness"], p["basis"],
              p.get("note"), p["reviewed_on"])
             for p in profiles])
    _insert(connection, "cultivar_profile_links", ("profile_id", "link_type", "source_row"),
            [(p["id"], "inventory", row) for p in profiles for row in p["inventory_rows"]] +
            [(p["id"], "purchase", row) for p in profiles for row in p["purchase_rows"]] +
            [(p["id"], "seed", row) for p in profiles for row in p.get("seed_rows", [])])
    _insert(connection, "cultivar_profile_aliases", ("profile_id", "alias"), [(p["id"], a) for p in profiles for a in p["aliases"]])
    _insert(connection, "cultivar_profile_uses", ("profile_id", "use"), [(p["id"], u) for p in profiles for u in p["uses"]])
    _insert(connection, "cultivar_profile_sources", ("profile_id", "position", "label", "url"),
            [(p["id"], index, source[0], source[1]) for p in profiles for index, source in enumerate(p["sources"])])
    notes = data["cultivar_library"]["group_notes"]
    _insert(connection, "cultivar_group_notes", ("plant_group", "habit", "bark", "leaf", "reviewed_on"),
            [(n["group"], n["habit"], n["bark"], n["leaf"], n["reviewed_on"]) for n in notes])
    _insert(connection, "cultivar_group_note_sources", ("plant_group", "position", "label", "url"),
            [(n["group"], index, source[0], source[1]) for n in notes for index, source in enumerate(n["sources"])])
    plan = data["orchard"]["rules"].get("PLANTING_PLAN")
    if plan:
        spot_ids = {location["name"]: location["id"] for location in data["locations"]["records"]}
        _insert(connection, "planting_plan_items",
                ("id", "plan_year", "type", "cultivar", "method", "code", "profile_id", "quantity", "rootstock",
                 "flowering_group", "ploidy", "self_fertile", "role", "caution"),
                [(i["id"], plan["year"], i["type"], i["cultivar"], i["method"], i["code"], i["profile"], i["quantity"], i["rootstock"],
                  i.get("flowering_group"), i.get("ploidy"), None if i.get("self_fertile") is None else int(i["self_fertile"]),
                  i["role"], i["caution"]) for i in plan["items"]])
        _insert(connection, "planting_plan_spots", ("item_id", "location_id"),
                [(i["id"], spot_ids[spot]) for i in plan["items"] for spot in i["spots"]])
    features, points = [], []
    for feature in grid.data["features"]:
        x, y = grid.center(feature)
        features.append((feature["id"], feature["name"], feature["group"], feature["status"], feature["shape"],
                         feature.get("kind"), x, y, _json(feature), feature.get("notes", "")))
        points += [(feature["id"], i, x, y) for i, (x, y) in enumerate(grid.points(feature))]
    _insert(connection, "site_features", ("id", "name", "feature_group", "status", "shape", "kind",
                                          "center_x_ft", "center_y_ft", "geometry_json", "notes"), features)
    _insert(connection, "feature_points", ("feature_id", "point_index", "x_ft", "y_ft"), points)
    terrain = data["terrain"]
    mesh = terrain["grid"]
    samples = []
    for r in range(mesh["ny"]):
        for c in range(mesh["nx"]):
            x, y = mesh["x0"] + c * mesh["step"], mesh["y0"] + r * mesh["step"]
            elevation = mesh["base"] + mesh["z"][r * mesh["nx"] + c] / 100
            samples.append((r, c, x, y, grid.cell_of(x, y), elevation, elevation * M_TO_FT, int(grid.in_lot(x, y))))
    _insert(connection, "terrain_samples", ("row_index", "column_index", "x_ft", "y_ft", "cell", "elevation_m", "elevation_ft", "in_lot"), samples)
    lines, vertices = [], []
    for layer in ("contours", "flows", "flows_fine", "split", "ridge", "ditch"):
        parts = [terrain[layer]] if layer in ("ridge", "ditch") else terrain[layer]
        for i, part in enumerate(parts):
            line_id = f"{layer}-{i+1}"
            lines.append((line_id, layer, part["m"] if layer == "contours" else None))
            path = part["p"] if layer == "contours" else part
            vertices += [(line_id, j, x, y) for j, (x, y) in enumerate(path)]
    _insert(connection, "terrain_lines", ("id", "layer", "elevation_m"), lines)
    _insert(connection, "terrain_points", ("line_id", "point_index", "x_ft", "y_ft"), vertices)
    _insert(connection, "drainage_areas", ("name", "acres"), list(terrain["drainage_ac"].items()))
    water = data["water_harvesting"]
    _insert(connection, "climate_months", ("month", "precipitation_in", "et0_in"),
            [(row["month"], row["precipitation_in"], row["et0_in"]) for row in water["months"]])
    _insert(connection, "soil_layers", ("horizon", "top_in", "bottom_in", "texture", "clay_percent",
                                         "ksat_low_in_hr", "ksat_typical_in_hr", "ksat_high_in_hr", "available_water_in_per_in", "notes"),
            [(r["hz"], r["top"], r["bottom"], r["texture"], r["clay"], *r["ksat"], r["awc"], r["note"]) for r in water["soil"]["layers"]])
    for section, table, columns in [
        ("techniques", "water_techniques", ("id", "zone", "work", "specifications", "reference", "timing")),
        ("calendar", "water_calendar", ("season", "conditions", "work")),
        ("catchments", "water_catchments", ("id", "name", "area_sqft", "runoff_factor", "notes")),
        ("observations", "water_observations", ("id", "location_id", "observed_on", "observation_type", "value", "unit", "notes")),
    ]:
        _insert(connection, table, columns, [tuple(r[key] for key in columns) for r in water[section]])
    _populate_climate(connection, data["climate"])


def _populate_climate(connection, climate):
    site = climate["site"]
    _insert(connection, "climate_site", ("name", "latitude", "longitude", "elevation_ft", "elevation_note", "time_zone",
                                         "normals_start", "normals_end", "retrieved_on"),
            [(site["name"], site["latitude"], site["longitude"], site["elevation_ft"], site["elevation_note"], site["time_zone"],
              *site["normals_period"], site["retrieved_on"])])
    thresholds = climate["frost"]["thresholds_f"]
    _insert(connection, "frost_thresholds", ("threshold_f", "label"), [(t, climate["frost"]["labels"][str(t)]) for t in thresholds])
    sources, temperatures, summaries, days, years = [], [], [], [], []
    for source in climate["sources"]:
        extremes, frost = source["annual_extreme_min"], source["frost"]
        sources.append((source["id"], source["role"], source["kind"], source["label"], source["latitude"], source["longitude"],
                        source["elevation_ft"], source["distance_from_site_mi"], *source["period"], source["url"], source["retrieved_from"],
                        source["note"], extremes["years"], extremes["mean_f"], extremes["zone"], extremes["coldest_f"], extremes["coldest_on"],
                        extremes["mildest_f"], extremes.get("record_low_f"), extremes.get("record_low_on")))
        temperatures += [(source["id"], month + 1, source["temperature"]["high_f"][month], source["temperature"]["low_f"][month])
                         for month in range(12)]
        for threshold in thresholds:
            item = frost["summary"][str(threshold)]
            summaries.append((source["id"], threshold, *(item["last_spring"][name] for name in FROST_DATE_STATS),
                              *(item["first_fall"][name] for name in FROST_DATE_STATS),
                              *(item["frost_free_days"][name] for name in FREE_DAY_STATS),
                              item["years_spring"], item["years_fall"], item["years_both"]))
            if "monthly_days" in frost:
                monthly = frost["monthly_days"][str(threshold)]
                days += [(source["id"], threshold, month + 1, monthly["avg_days"][month], monthly["years_with_pct"][month]) for month in range(12)]
        for record in frost.get("years", []):
            for threshold in thresholds:
                spring, fall = record["last_spring"][str(threshold)], record["first_fall"][str(threshold)]
                # Day numbers count as in a non-leap year, so they compare across years and give the frost-free days.
                spring_day = day_of_year(datetime.date.fromisoformat(spring)) if spring else None
                fall_day = day_of_year(datetime.date.fromisoformat(fall)) if fall else None
                free = fall_day - spring_day if spring_day is not None and fall_day is not None else None
                years.append((source["id"], record["year"], threshold, spring, fall, spring_day, fall_day, free))
    _insert(connection, "climate_sources", ("id", "role", "kind", "label", "latitude", "longitude", "elevation_ft", "distance_from_site_mi",
                                            "period_start", "period_end", "url", "retrieved_from", "note", "coldest_night_years",
                                            "mean_annual_extreme_min_f", "hardiness_zone", "coldest_f", "coldest_on", "mildest_f",
                                            "record_low_f", "record_low_on"), sources)
    _insert(connection, "temperature_months", ("source_id", "month", "high_f", "low_f"), temperatures)
    _insert(connection, "frost_summary",
            ("source_id", "threshold_f", *(f"spring_{name}" for name in FROST_DATE_STATS), *(f"fall_{name}" for name in FROST_DATE_STATS),
             *(f"free_days_{name}" for name in FREE_DAY_STATS), "years_spring", "years_fall", "years_both"), summaries)
    _insert(connection, "frost_days", ("source_id", "threshold_f", "month", "avg_days", "years_with_pct"), days)
    _insert(connection, "frost_years", ("source_id", "year", "threshold_f", "last_spring", "first_fall", "last_spring_day", "first_fall_day",
                                        "frost_free_days"), years)
    daylight = climate["daylight"]
    _insert(connection, "daylight_months", ("month", "mean_hours", "shortest_hours", "longest_hours"),
            [(m["month"], m["mean_hours"], m["shortest_hours"], m["longest_hours"]) for m in daylight["months"]])
    _insert(connection, "daylight_crossings", ("hours", "first_date", "last_date"),
            [(int(hours), dates[0], dates[1]) for hours, dates in daylight["crossings"].items() if dates])
    key_columns = ("id", "label", "date", "clock", "utc_offset_hours", "sunrise", "solar_noon", "sunset", "day_length_hours",
                   "noon_altitude_deg", "sunrise_azimuth_deg", "sunset_azimuth_deg")
    _insert(connection, "sun_key_dates", key_columns, [tuple(item[key] for key in key_columns) for item in daylight["key_dates"]])


def orchard_constants(data):
    rules = dict(data["orchard"]["rules"])
    rules["FRUIT_SHEET"] = [[record[key] for key in FRUIT_FIELDS] for record in data["catalog"]["fruit_records"]]
    rules["INVENTORY"] = [[record[key] for key in INVENTORY_FIELDS] for record in data["inventory"]["records"]]
    row_plan = [[None] * rules["GRID_COLUMNS"] for _ in range(rules["ORCHARD_ROWS"])]
    locations = {r["id"]: r for r in data["locations"]["records"]}
    plants = {r["id"]: r for r in data["plants"]["records"]}
    inventory = {r["source_row"]: r for r in data["inventory"]["records"]}
    updates, rootstocks, current = {}, [], {}
    grid = SiteGrid(data=data["site"], terrain=data["terrain"])
    for location in locations.values():
        if location["orchard_row"] is not None and location["reserved_for"] is not None:
            row_plan[location["orchard_row"]-1][location["orchard_column"]-1] = "R"
    for planting in data["plantings"]["records"]:
        plant = plants[planting["plant_id"]]
        location = locations[planting["location_id"]]
        if planting["status"] in ("planned", "planted"):
            current[plant["id"]] = {
                "status": planting["status"], "location_id": location["id"],
                "inventory_row": plant["inventory_row"],
                "site_ref": grid.site_ref(location["x_ft"], location["y_ft"]),
                "x_ft": location["x_ft"], "y_ft": location["y_ft"],
                "planted_on": planting["planted_on"],
            }
        r, c = location["orchard_row"], location["orchard_column"]
        if r is None or planting["status"] == "vacated":
            continue
        if row_plan[r-1][c-1] is not None:
            raise ValueError(f"Cannot export multiple original planting records for R{r}-C{c}")
        row_plan[r-1][c-1] = plant["inventory_row"]
        if planting["status"] in ("dead", "outside-orchard"):
            recorded = planting["recorded_on"]
            if recorded:
                parsed = datetime.date.fromisoformat(recorded)
                date = f"{MONTH_NAMES[parsed.month - 1]} {parsed.day}, {parsed.year}"
            else:
                date = "date not supplied"
            updates[plant["id"]] = {
                "r": r, "c": c, "status": planting["status"], "reported": date,
                "replacementType": location["replacement_type"], "replacementYear": location["replacement_year"],
            }
        if planting["status"] == "planted" and "rootstock" in inventory[plant["inventory_row"]]["variety"].lower():
            rootstocks.append({"invRow": plant["inventory_row"], "instance": plant["instance"], "r": r, "c": c})
    rules.update(ROW_PLAN=row_plan, ORCHARD_UPDATES=updates, PLANTED_ROOTSTOCKS=rootstocks, PLANT_LOCATIONS=current,
                 DEAD_PLANTS=[plant["id"] for plant in data["plants"]["records"] if plant["health_status"] == "dead"],
                 SEED_LIST=_seed_list(data["catalog"]["workbook_records"]))
    return rules


def generated_outputs(data, root, digest):
    root = pathlib.Path(root)
    heading = "// Generated by tools/property_data.py build. Edit canonical JSON in data/, not this file.\n"
    site = heading + "window.SITE_GRID = /* BEGIN SITE_GRID JSON */\n" + _json(data["site"]) + "\n/* END SITE_GRID JSON */;\n"
    site += (root / "web" / "site_grid_helpers.js").read_text(encoding="utf-8")
    terrain = heading + "window.SITE_TERRAIN = /* BEGIN SITE_TERRAIN JSON */"
    terrain += "\n" + _json(data["terrain"]) + "\n/* END SITE_TERRAIN JSON */;\n"
    orchard = heading + "window.ORCHARD_DATA = " + _json(orchard_constants(data)) + ";\n"
    orchard += (root / "web" / "orchard_model.js").read_text(encoding="utf-8")
    library = heading + "window.CULTIVAR_LIBRARY = " + _json(data["cultivar_library"]) + ";\n"
    library += (root / "web" / "cultivar_library.js").read_text(encoding="utf-8")
    water = heading + "window.WATER_HARVESTING = " + _json(data["water_harvesting"]) + ";\n"
    climate = heading + "window.SITE_CLIMATE = " + _json(data["climate"]) + ";\n"
    climate += (root / "web" / "site_climate.js").read_text(encoding="utf-8")
    checklist = heading + (root / "web" / "planting_checklist.js").read_text(encoding="utf-8")
    manifest = json.dumps({"schema_version": 1, "source_digest": digest,
                           "plants": len(data["plants"]["records"]), "orchard_spots": len(data["locations"]["records"]),
                           "terrain_samples": len(data["terrain"]["grid"]["z"]),
                           "cultivar_profiles": len(data["cultivar_library"]["records"])}, indent=2) + "\n"
    return {name: text.encode("utf-8") for name, text in {
        "site_grid.js": site, "site_terrain.js": terrain, "orchard_model.js": orchard,
        "water_harvesting.js": water, "site_climate.js": climate, "planting_checklist.js": checklist, "cultivar_library.js": library, "manifest.json": manifest,
    }.items()}


def _write_atomic(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, prefix=path.stem + "-", suffix=".tmp", delete=False) as file:
        temporary = pathlib.Path(file.name)
        file.write(content)
    try:
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def build(root=ROOT, *, db_path=None, web=True, force=False):
    root = pathlib.Path(root)
    digest = source_digest(root)
    data = load_data(root)
    validate_data(data)
    if source_digest(root) != digest:
        raise ValueError("Source records changed during validation; rerun the command")
    outputs = generated_outputs(data, root, digest) if web else {}
    database = pathlib.Path(db_path) if db_path is not None else root / "build" / "property.sqlite"
    fresh = False
    if database.exists() and not force:
        connection = sqlite3.connect(database.resolve().as_uri() + "?mode=ro", uri=True)
        try:
            row = connection.execute("SELECT value FROM build_metadata WHERE key = 'source_digest'").fetchone()
            fresh = row is not None and row[0] == digest
        finally:
            connection.close()
    if not fresh:
        database.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=database.parent, prefix="property-", suffix=".tmp", delete=False) as file:
            temporary = pathlib.Path(file.name)
        try:
            connection = sqlite3.connect(temporary)
            try:
                connection.executescript((root / "database" / "schema.sql").read_text(encoding="utf-8"))
                with connection:
                    _populate(connection, data, digest)
                foreign_keys = connection.execute("PRAGMA foreign_key_check").fetchall()
                integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
                if foreign_keys or integrity != "ok":
                    raise ValueError(f"Database integrity failed: {foreign_keys or integrity}")
            finally:
                connection.close()
            if source_digest(root) != digest:
                raise ValueError("Source records changed during rebuild; database was not replaced")
            temporary.replace(database)
        finally:
            temporary.unlink(missing_ok=True)
    for name, content in outputs.items():
        path = root / "docs" / "data" / name
        if not path.exists() or path.read_bytes() != content:
            _write_atomic(path, content)
    return database


def _readonly(action, arg1, arg2, database, trigger):
    allowed = {sqlite3.SQLITE_SELECT, sqlite3.SQLITE_READ, sqlite3.SQLITE_FUNCTION, sqlite3.SQLITE_RECURSIVE}
    if action not in allowed or (action == sqlite3.SQLITE_FUNCTION and (arg2 or "").lower() == "load_extension"):
        return sqlite3.SQLITE_DENY
    return sqlite3.SQLITE_OK


def query(sql, root=ROOT, *, db_path=None, params=()):
    database = build(root, db_path=db_path, web=False)
    connection = sqlite3.connect(database.resolve().as_uri() + "?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    try:
        connection.execute("PRAGMA query_only = ON")
        connection.set_authorizer(_readonly)
        cursor = connection.execute(sql, params)
        return [dict(row) for row in cursor]
    finally:
        connection.close()


def check(root=ROOT):
    root = pathlib.Path(root)
    digest = source_digest(root)
    data = load_data(root)
    validate_data(data)
    connection = sqlite3.connect(":memory:")
    try:
        connection.executescript((root / "database" / "schema.sql").read_text(encoding="utf-8"))
        with connection:
            _populate(connection, data, digest)
        if connection.execute("PRAGMA foreign_key_check").fetchall():
            raise ValueError("Database foreign-key check failed")
    finally:
        connection.close()
    for name, expected in generated_outputs(data, root, digest).items():
        path = root / "docs" / "data" / name
        if not path.exists() or path.read_bytes() != expected:
            raise ValueError(f"Generated website data is stale: {name}; run python tools/property_data.py build")


def main(argv=None):
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=pathlib.Path, default=ROOT, help="Project root (defaults to this repository)")
    commands = parser.add_subparsers(dest="command", required=True)
    builder = commands.add_parser("build", help="Validate, rebuild SQLite if needed, and generate browser data")
    builder.add_argument("--force", action="store_true")
    commands.add_parser("check", help="Validate records, SQLite schema, and committed generated-file freshness")
    commands.add_parser("summary", help="Print record and table counts")
    sql_parser = commands.add_parser("query", help="Rebuild stale SQLite and execute one read-only SQL statement")
    source = sql_parser.add_mutually_exclusive_group(required=True)
    source.add_argument("sql", nargs="?")
    source.add_argument("--file", type=pathlib.Path)
    sql_parser.add_argument("--params", default="[]", help="JSON array of SQL parameter values")
    sql_parser.add_argument("--format", choices=("table", "json"), default="table")
    args = parser.parse_args(argv)
    try:
        if args.command == "build":
            path = build(args.root, force=args.force)
            print(f"Validated JSON; database ready: {path}; generated browser data is current.")
        elif args.command == "check":
            check(args.root)
            print("Canonical JSON, SQLite integrity, and generated browser data are valid and current.")
        elif args.command == "summary":
            names = query("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name", args.root)
            for row in names:
                name = row["name"]
                count = query(f'SELECT COUNT(*) AS n FROM "{name}"', args.root)[0]["n"]
                print(f"{name:24} {count:8}")
        else:
            sql = args.file.read_text(encoding="utf-8") if args.file else args.sql
            params = json.loads(args.params)
            if not isinstance(params, list):
                raise ValueError("--params must be a JSON array")
            rows = query(sql, args.root, params=params)
            if args.format == "json":
                print(json.dumps(rows, indent=2, ensure_ascii=True))
            elif not rows:
                print("0 rows")
            else:
                names = list(rows[0])
                values = [[("NULL" if row[name] is None else str(row[name])) for name in names] for row in rows]
                widths = [max(len(name), *(len(row[i]) for row in values)) for i, name in enumerate(names)]
                print(" | ".join(name.ljust(width) for name, width in zip(names, widths)))
                print("-+-".join("-" * width for width in widths))
                for row in values:
                    print(" | ".join(value.ljust(width) for value, width in zip(row, widths)))
                print(f"{len(rows)} row(s)")
    except (ValueError, KeyError, OSError, sqlite3.Error) as error:
        parser.exit(1, f"Property data error: {error}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
