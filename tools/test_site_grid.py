"""Tests for tools/site_grid.py and canonical data/. Run: python -m unittest discover -s tools"""
import contextlib
import io
import itertools
import math
import pathlib
import re
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from site_grid import SiteGrid, main  # noqa: E402


def _dist_to_line(p, pts):
    """Shortest distance from point p to a polyline."""
    best = math.inf
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        dx, dy = bx - ax, by - ay
        t = max(0.0, min(1.0, ((p[0] - ax) * dx + (p[1] - ay) * dy) / (dx * dx + dy * dy or 1)))
        best = min(best, math.hypot(p[0] - ax - t * dx, p[1] - ay - t * dy))
    return best


def _lines_cross(a, b):
    """True when two polylines cross or touch."""
    def side(p, q, r):
        return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
    return any(side(p, q, r) * side(p, q, s) <= 0 and side(r, s, p) * side(r, s, q) <= 0
               for p, q in zip(a, a[1:]) for r, s in zip(b, b[1:]))


class SiteGridTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.grid = SiteGrid()

    def test_cells(self):
        g = self.grid
        self.assertEqual(g.cell_of(0, 0), "A1")
        self.assertEqual(g.cell_of(49.9, 49.9), "A1")
        self.assertEqual(g.cell_of(50, 50), "B2")
        self.assertEqual(g.cell_of(63, 921), "B19")
        self.assertEqual(g.cell_of(331, 1291), "G26")
        self.assertIsNone(g.cell_of(-1, 10))
        self.assertIsNone(g.cell_of(10, -18))
        self.assertEqual(g.cell_bounds("b19"), (50, 900, 100, 950))
        self.assertEqual(g.cell_center("G26"), (325, 1275))
        for bad in ("H1", "A0", "A27", "19B", ""):
            with self.assertRaises(ValueError):
                g.cell_bounds(bad)

    def test_every_lot_point_has_a_cell(self):
        fence = self.grid.data["lot"]["fence"]
        for x in (0, fence["width"] / 2, fence["width"] - 0.01):
            for y in (0, fence["depth"] / 2, fence["depth"] - 0.01):
                self.assertIsNotNone(self.grid.cell_of(x, y))

    def test_site_ref_format(self):
        cases = [
            ((112, 818), "C17-E12-S18"),
            ((112.5, 818.25), "C17-E12.5-S18.25"),
            (self.grid.tree_xy(6, 3), "B11-E33-S0"),
            ((0, 0), "A1-E0-S0"),
            ((50, 800), "B17-E0-S0"),
            ((49.999, 799.999), "B17-E0-S0"),
            ((331.3, 1291.9), "G26-E31.3-S41.9"),
        ]
        for point, expected in cases:
            with self.subTest(point=point):
                self.assertEqual(self.grid.site_ref(*point), expected)

    def test_site_ref_parse(self):
        cases = [
            ("C17-E12-S18", (112, 818)),
            ("C17-E12.5-S18.25", (112.5, 818.25)),
            (" b19-e03.5-s07 ", (53.5, 907)),
            ("B11-E33-S0", self.grid.tree_xy(6, 3)),
            ("G26-E31.3-S41.9", (331.3, 1291.9)),
            ("PENDING", None),
            (" pending ", None),
        ]
        for code, expected in cases:
            with self.subTest(code=code):
                self.assertEqual(self.grid.from_site_ref(code), expected)

    def test_site_ref_invalid_input(self):
        points = [(-1, 1), (340, 1200), (100, 1300), (math.nan, 1), (1, math.inf),
                  (None, None), ("83", 485), (True, 485)]
        for point in points:
            with self.subTest(point=point), self.assertRaises(ValueError):
                self.grid.site_ref(*point)
        codes = ["", "H1-E1-S1", "A0-E0-S0", "A27-E0-S0", "C17-E50-S18", "C17-E12-S50",
                 "C17-E-1-S18", "C17-E12-N18", "C17-E12.123-S18", "G26-E40-S40",
                 "G26-E31.3-S42", "C17-E1e1-S18", "PENDING-E0-S0", None, 123]
        for code in codes:
            with self.subTest(code=code), self.assertRaises(ValueError):
                self.grid.from_site_ref(code)

    def test_site_ref_round_trip(self):
        points = [(0.004, 0.004), (49.999, 799.999), (112.345, 818.765), (331.3, 1291.9)]
        points += [self.grid.tree_xy(r, c) for r in range(1, 16) for c in range(1, 14)]
        for x, y in points:
            with self.subTest(point=(x, y)):
                code = self.grid.site_ref(x, y)
                px, py = self.grid.from_site_ref(code)
                self.assertLessEqual(abs(px - x), 0.005 + 1e-9)
                self.assertLessEqual(abs(py - y), 0.005 + 1e-9)
                self.assertEqual(self.grid.site_ref(px, py), code)

    def test_features_are_well_formed(self):
        ids = [f["id"] for f in self.grid.data["features"]]
        self.assertEqual(len(ids), len(set(ids)), "feature ids must be unique")
        for f in self.grid.data["features"]:
            self.assertIn(f["status"], ("existing", "planned"), f["id"])
            self.assertIn(f["group"], ("boundary", "access", "homestead", "planned", "utility", "orchard", "terrain"), f["id"])
            self.assertIn(f["shape"], ("rect", "circle", "polygon", "line", "point"), f["id"])
            if f["shape"] == "rect":
                self.assertLess(f["x0"], f["x1"], f["id"])
                self.assertLess(f["y0"], f["y1"], f["id"])

    def test_homestead_inside_the_fence(self):
        for f in self.grid.features("homestead") + self.grid.features("planned") + self.grid.features("utility"):
            x0, y0, x1, y1 = self.grid.bbox(f)
            if f["id"] == "water_pasture":
                # The centerline meets both fences. Its 3 ft width pads the box past the west fence.
                (cx0, cy0), (cx1, cy1) = f["pts"][0], f["pts"][-1]
                self.assertTrue(self.grid.in_lot(cx0, cy0) and self.grid.in_lot(cx1, cy1), f["id"])
                continue
            self.assertTrue(self.grid.in_lot(x0, y0) and self.grid.in_lot(x1, y1), f["id"])
        self.assertEqual(self.grid.feature("water_line_west")["group"], "utility", "the west trench is a water line, not a path")

    def test_water_lines_and_hydrants(self):
        g = self.grid
        pipes = {f["id"]: f for f in g.features("utility") if f.get("kind") == "water_pipe"}
        hydrants = [f for f in g.features("utility") if f.get("kind") == "hydrant"]
        self.assertEqual(len(hydrants), 10)
        self.assertTrue(all(f["shape"] == "line" and f["size_in"] in (1.5, 2) for f in pipes.values()))
        self.assertEqual({k for k, f in pipes.items() if f["size_in"] == 1.5},
                         {"water_tee_west", "water_line_west", "water_lateral_north"} | {f"water_lateral_row_{n}" for n in range(1, 9)},
                         "the line teed west, the line along the west fence, the north lateral, and the eight row laterals are 1.5 in; the rest is 2 in")
        main_pts = pipes["water_main"]["pts"]
        x0, y0, x1, y1 = g.bbox("pump_house")
        self.assertTrue(x0 - 2 <= main_pts[0][0] <= x1 + 2 and y0 - 2 <= main_pts[0][1] <= y1 + 2, "the 2 in main starts at the pump house")
        self.assertLess(main_pts[-1][1], 50, "the main runs to the north end of the lot")
        independent = {"water_pasture"}
        for fid, f in pipes.items():
            if fid not in ("water_main", "water_line_west") and fid not in independent:
                self.assertLess(_dist_to_line(f["pts"][0], main_pts), 0.5, f"{fid} comes off the main")
        self.assertTrue(_lines_cross(pipes["water_line_west"]["pts"], pipes["water_tee_west"]["pts"]), "the 1.5 in line feeds the west fence line")
        self.assertAlmostEqual(math.dist(*pipes["water_lateral_north"]["pts"]), 10, places=6)
        ends = [tuple(f["pts"][k]) for f in pipes.values() for k in (0, -1)]
        well_ends = [tuple(p) for f in g.features("utility") if f.get("kind") == "well_pipe" for p in (f["pts"][0], f["pts"][-1])]
        for h in hydrants:
            on_irrigation = min(math.dist((h["x"], h["y"]), e) for e in ends) < 0.5
            on_well_end = min(math.dist((h["x"], h["y"]), e) for e in well_ends) < 0.5
            on_well = any(_dist_to_line((h["x"], h["y"]), f["pts"]) < 0.5
                          for f in g.features("utility") if f.get("kind") == "well_pipe")
            self.assertTrue(on_irrigation or on_well_end or on_well, f"{h['id']} sits on a water line")
            if h["id"] in ("hydrant_well", "hydrant_shed_awning"):
                self.assertTrue(on_well and not on_irrigation, f"{h['id']} is on the well line, not the irrigation lines")

        # Every line ends at a hydrant, at a valve box, runs into another line, or starts at the pump house
        valve_boxes = [f for f in g.features("utility") if f.get("kind") == "valve_box"]

        def closed(p, fid):
            return (min(math.dist(p, (h["x"], h["y"])) for h in hydrants) < 0.5
                    or min(math.dist(p, (b["x"], b["y"])) for b in valve_boxes) < 0.5
                    or any(_dist_to_line(p, q["pts"]) < 0.5 for k, q in pipes.items() if k != fid)
                    or (x0 - 2 <= p[0] <= x1 + 2 and y0 - 2 <= p[1] <= y1 + 2))
        for fid, f in pipes.items():
            if fid == "water_pasture":
                continue
            for end in (f["pts"][0], f["pts"][-1]):
                self.assertTrue(closed(end, fid), f"{fid} has an open end at {end}")
        wl = pipes["water_line_west"]["pts"]
        self.assertTrue(all(15 < x < 25 for x, _ in wl), "the west fence line stays about 20 ft inside the fence")
        self.assertEqual([g.cell_of(*wl[0]), g.cell_of(*wl[-1])], ["A14", "A20"])
        west = g.feature("hydrant_west")
        self.assertEqual(g.cell_of(west["x"], west["y"]), "A18")
        self.assertLess(west["x"], 10, "the A18 hydrant stands right at the west fence, west of the buried line")

    def test_old_ditch_is_one_gentle_bend_on_the_slope_berm(self):
        g = self.grid
        ditch = g.feature("old_ditch")
        pipe = g.feature("water_pasture")
        self.assertEqual(ditch["pts"], pipe["pts"], "the 2 in pasture line lies in the old ditch")
        self.assertEqual(pipe["size_in"], 2)
        self.assertEqual(ditch["pts"], [[0, 926], [80, 921], [331, 846]],
                         "one gentle bend on the slope-chart berm, including under later buildings")

    def test_well_head_line_and_hydrants(self):
        g = self.grid
        pump = g.bbox("pump_house")
        well = g.feature("well")
        near = g.feature("hydrant_well")
        shed = g.feature("hydrant_shed_awning")
        line = g.feature("well_line")
        branch = g.feature("well_line_shed")
        mid_y = (pump[1] + pump[3]) / 2
        self.assertEqual((well["x"], well["y"]), (pump[2] + 18, mid_y), "the well head is 18 ft east of the pump house, on its midline")
        self.assertEqual(well["depth_ft"], 375)
        self.assertEqual(well["pump_set_ft"], 350)
        self.assertEqual(well["first_water_ft"], 200)
        self.assertEqual(well["production_ft"], 300)
        self.assertEqual(well["water_strikes_when"], "July 2021")
        self.assertEqual((near["x"], near["y"]), (well["x"] - 1, well["y"]), "the well hydrant is 1 ft west of the head")
        self.assertEqual(near["depth_ft"], 5)
        self.assertEqual(line["depth_ft"], 5)
        self.assertEqual([tuple(p) for p in line["pts"]], [(well["x"], well["y"]), (near["x"], near["y"]), (pump[2], mid_y)])
        shed_box = g.bbox("shed")
        pad = g.bbox("workshop_pad")
        self.assertEqual((shed["x"], shed["y"]), (shed_box[2] + 4, shed_box[1]), "the shed hydrant is 4 ft east of the mapped northeast corner")
        self.assertEqual(branch["pts"][0], [well["x"], well["y"]])
        self.assertEqual(branch["pts"][-1], [shed["x"], shed["y"]])
        self.assertTrue(all(p[0] > pad[2] for p in branch["pts"]), "the branch stays east of the workshop pad")
        self.assertGreater(branch["pts"][0][1], pad[3], "the branch starts in front of the workshop pad")
        self.assertTrue(any(a[0] == b[0] > pad[2] and min(a[1], b[1]) <= pad[1] and max(a[1], b[1]) >= pad[3]
                        for a, b in zip(branch["pts"], branch["pts"][1:])),
                        "the branch runs up the east side of the workshop pad")
        self.assertEqual(g.cell_of(well["x"], well["y"]), "B19")
        self.assertEqual(g.cell_of(shed["x"], shed["y"]), "C15")

    def test_row_laterals_head_stations_and_hydrant_valve_boxes(self):
        g = self.grid
        utility = g.features("utility")
        pipes = {f["id"]: f for f in utility if f.get("kind") == "water_pipe"}
        boxes = {f["id"]: f for f in utility if f.get("kind") == "valve_box"}
        hydrants = {f["id"]: f for f in utility if f.get("kind") == "hydrant"}
        main_pts = pipes["water_main"]["pts"]
        block_east = g.bbox("orchard_block")[2]

        # Eight 10 ft, 1.5 in laterals run west off the main, each ending in a 1 in riser into a head-station valve box
        stations = [boxes[f"head_station_{n}"] for n in range(1, 9)]
        for n, box in enumerate(stations, start=1):
            lateral = pipes[f"water_lateral_row_{n}"]
            (x0, y0), (x1, y1) = lateral["pts"]
            self.assertEqual(lateral["size_in"], 1.5, lateral["id"])
            self.assertAlmostEqual(math.dist((x0, y0), (x1, y1)), 10, places=6, msg=lateral["id"])
            self.assertEqual(y0, y1, f"{lateral['id']} runs due west")
            self.assertLess(x1, x0, f"{lateral['id']} runs west")
            self.assertLess(_dist_to_line((x0, y0), main_pts), 0.5, f"{lateral['id']} comes off the main")
            self.assertEqual((box["x"], box["y"]), (x1, y1), f"{box['id']} sits at the end of its lateral")
            self.assertEqual((box["lateral"], lateral["head_station"], box["riser_in"]), (lateral["id"], box["id"], 1))
            self.assertGreater(box["x"], block_east, f"{box['id']} stays east of the orchard block")
        # Spacing along the main, south to north: the five southern laterals about 60 ft apart, the northern ones about 70 ft
        ys = [box["y"] for box in stations]
        gaps = [a - b for a, b in zip(ys, ys[1:])]
        self.assertTrue(all(55 <= gap <= 65 for gap in gaps[:4]), f"the five southern laterals are about 60 ft apart: {gaps}")
        self.assertTrue(all(65 <= gap <= 80 for gap in gaps[4:]), f"the three northern laterals are about 70 ft apart: {gaps}")
        self.assertTrue(65 <= ys[-1] - hydrants["hydrant_north"]["y"] <= 80, "the last one is about 70 ft from the north hydrant lateral")
        self.assertEqual(sum(1 for f in pipes.values() if "head_station" in f), 8)

        # Seven of the eight hydrants have a valve box 4 ft back on the line that ends at it; the south end of the west fence line has none
        by_hydrant = {b["hydrant"]: b for b in boxes.values() if "hydrant" in b}
        self.assertEqual(set(by_hydrant), set(hydrants) - {"hydrant_fence_south", "hydrant_well", "hydrant_shed_awning"},
                         "every irrigation hydrant but the A20 one has exactly one valve box; the well hydrants have none")
        self.assertEqual(len(boxes), 15, "eight head stations and seven hydrant valve boxes")
        for hid, box in by_hydrant.items():
            h = hydrants[hid]
            self.assertEqual(box["setback_ft"], 4, box["id"])
            self.assertAlmostEqual(math.dist((box["x"], box["y"]), (h["x"], h["y"])), 4, delta=0.1, msg=box["id"])
            feeding = [p["pts"] for p in pipes.values() if min(math.dist(e, (h["x"], h["y"])) for e in (p["pts"][0], p["pts"][-1])) < 0.5]
            self.assertTrue(feeding, f"{hid} sits at the end of a line")
            self.assertLess(min(_dist_to_line((box["x"], box["y"]), pts) for pts in feeding), 0.1, f"{box['id']} sits on the line to {hid}")

    def test_structures_do_not_overlap(self):
        ids = ["shed", "outhouse", "container_solar", "container_storage", "irrigation_tank", "pump_house", "rv"]
        for a, b in itertools.combinations(ids, 2):
            ax0, ay0, ax1, ay1 = self.grid.bbox(a)
            bx0, by0, bx1, by1 = self.grid.bbox(b)
            overlap = min(ax1, bx1) - max(ax0, bx0) > 0.5 and min(ay1, by1) - max(ay0, by0) > 0.5
            self.assertFalse(overlap, f"{a} overlaps {b}")

    def test_planned_buildings_fit_their_pads(self):
        def inside(inner, outer):
            ix0, iy0, ix1, iy1 = self.grid.bbox(inner)
            ox0, oy0, ox1, oy1 = self.grid.bbox(outer)
            return ox0 <= ix0 and oy0 <= iy0 and ix1 <= ox1 and iy1 <= oy1
        self.assertTrue(inside("house", "house_pad"))
        self.assertTrue(inside("garage", "house_pad"))
        self.assertTrue(inside("workshop", "workshop_pad"))
        self.assertTrue(inside("rv", "rv_pad"))
        self.assertEqual(self.grid.size("house"), (66, 40))
        self.assertEqual(self.grid.size("workshop"), (48, 32))
        self.assertEqual(self.grid.size("container_solar"), (8, 40))
        self.assertEqual(self.grid.size("container_storage"), (40, 8))

    def test_planned_greenhouses_are_south_of_the_orchard_and_clear_of_everything_else(self):
        g = self.grid
        gothic, pit, orchard = g.feature("greenhouse_gothic"), g.feature("greenhouse_pit"), g.feature("orchard_area")
        for f in (gothic, pit):
            self.assertEqual((f["group"], f["status"]), ("planned", "planned"), f["id"])
        self.assertEqual(g.size("greenhouse_gothic"), (76, 27))
        self.assertEqual(g.size("greenhouse_pit"), (36, 20))
        self.assertEqual(g.cells("greenhouse_gothic"), ["A13", "B13", "C13"])
        east = g.feature("greenhouse_gothic_east")
        self.assertEqual(g.cells("greenhouse_pit"), ["E14", "F14"])
        self.assertEqual(g.center("greenhouse_pit")[0], g.center("greenhouse_gothic_east")[0], "the pit is centered on the east tunnel")
        self.assertEqual(pit["x0"] - east["x0"], east["x1"] - pit["x1"], "the pit is inset the same distance from both ends of the east tunnel")
        self.assertEqual(pit["y0"] - east["y1"], 33, "the pit keeps the same 33 ft gap south of the tunnel")
        self.assertGreater(pit["y0"], gothic["y1"], "the pit is south of the tunnels")
        self.assertEqual(gothic["y0"] - orchard["y1"], 20, "the tunnel stands 20 ft south of the orchard strip")
        block = g.feature("orchard_block")
        self.assertEqual((east["group"], east["status"]), ("planned", "planned"))
        self.assertEqual(g.size("greenhouse_gothic_east"), g.size("greenhouse_gothic"), "the east tunnel is the same 76 x 27 ft twin")
        self.assertEqual(east["y0"], gothic["y0"], "both tunnels stand on the same line, 20 ft south of R1")
        self.assertEqual(east["x1"], block["x1"], "the east tunnel lines up with the orchard block's east edge")
        self.assertEqual(g.cells("greenhouse_gothic_east"), ["D13", "E13", "F13"])
        pipes = [f for f in g.features("utility") if f.get("kind") == "water_pipe"]
        stands = [f for f in g.features("utility") if f.get("kind") in ("hydrant", "valve_box")]
        for f in (gothic, pit, east):
            x0, y0, x1, y1 = g.bbox(f)
            outline = [(x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0)]
            self.assertGreaterEqual(y0, orchard["y1"], f"{f['id']} stays out of the orchard strip")
            for pipe in pipes:
                inside = any(x0 <= x <= x1 and y0 <= y <= y1 for x, y in pipe["pts"])
                self.assertFalse(inside or _lines_cross(pipe["pts"], outline), f"{pipe['id']} runs through {f['id']}")
            for stand in stands:
                self.assertFalse(x0 <= stand["x"] <= x1 and y0 <= stand["y"] <= y1, f"{stand['id']} stands inside {f['id']}")

    def test_lot_midline_is_the_owners_october_24_tape(self):
        g = self.grid
        fence = g.data["lot"]["fence"]
        mid = g.feature("lot_midline")
        shed = g.feature("shed")
        hydrant = g.feature("hydrant_fence_north")
        box = g.feature("valve_box_hydrant_fence_north")
        self.assertEqual((mid["group"], mid["kind"], mid["shape"]), ("boundary", "midline", "line"))
        (wx, wy), (ex, ey) = mid["pts"]
        self.assertEqual((wx, ex), (0, fence["width"]), "the midline runs from the west fence to the east fence")
        self.assertEqual(wy, ey, "the midline is east-west")
        self.assertEqual(wy, 667, "the taped line is 79 ft north of the shed's north wall, not half the fence")
        self.assertAlmostEqual(wy - fence["depth"] / 2, 21.05, places=2)
        self.assertEqual((g.site_ref(wx, wy), g.site_ref(ex, ey)), ("A14-E0-S17", "G14-E31.3-S17"))
        self.assertEqual(g.cells("lot_midline"), ["A14", "B14", "C14", "D14", "E14", "F14", "G14"])
        self.assertEqual(shed["y0"] - wy, 79, "the shed's north building corner is 79 ft south of the middle line")
        self.assertEqual(hydrant["y"], wy, "the A14 hydrant sits on the middle line")
        self.assertEqual(g.cell_of(hydrant["x"], hydrant["y"]), "A14")
        self.assertAlmostEqual(box["y"] - hydrant["y"], 4, places=6, msg="the valve box stays 4 ft south on the pipe")
        self.assertEqual(g.data["orchard"]["r1_y"], wy - 67, "R1 trunks are 67 ft north of the middle line")
        self.assertEqual(shed["y0"] - (g.data["orchard"]["r1_y"] - 5), 151, "the top of R1, 5 ft north of the trunks, is 151 ft north of the shed")

    def test_front_gate_spans_the_driveway_at_the_northeast_corner(self):
        g = self.grid
        gate, drive, fence = g.feature("front_gate"), g.feature("driveway"), g.data["lot"]["fence"]
        self.assertEqual((gate["group"], gate["kind"], gate["shape"]), ("access", "gate", "line"))
        self.assertEqual((gate["leaves"], gate["leaf_ft"]), (2, 12))
        (wx, wy), (ex, ey) = gate["pts"]
        self.assertEqual(wy, ey, "the gate runs east-west across the driveway")
        self.assertEqual(ex - wx, gate["leaves"] * gate["leaf_ft"], "two 12 ft leaves make a 24 ft opening")
        self.assertEqual(g.cells("front_gate"), ["G1"])
        self.assertAlmostEqual(fence["width"] - ex, 5, delta=1, msg="the owner says the east post stands about 5 ft inside the east fence")
        (ax, ay), (bx, by) = drive["pts"][0], drive["pts"][1]
        mid = ax + (bx - ax) * (wy - ay) / (by - ay)
        self.assertLessEqual(wx, mid - drive["width"] / 2, "the opening clears the driveway's west edge")
        self.assertGreaterEqual(ex, mid + drive["width"] / 2, "the opening clears the driveway's east edge")

    def test_master_grid_pdf_has_the_two_printed_pages_the_page_text_promises(self):
        pdf = (pathlib.Path(__file__).resolve().parent.parent / "docs" / "downloads" / "site_master_grid.pdf").read_bytes()
        pages = len(re.findall(rb"/Type\s*/Page(?![A-Za-z])", pdf))
        self.assertEqual(pages, 2, "the page sends readers to the SiteRef guide on the second printed page; if a new feature pushes the "
                                   "feature table onto a third page, tighten the print layout in docs/site_master_grid.html and print again")

    def test_master_grid_page_can_print_just_the_map_on_one_tabloid_sheet(self):
        page = (pathlib.Path(__file__).resolve().parent.parent / "docs" / "site_master_grid.html").read_text(encoding="utf-8")
        self.assertRegex(page, r"@page map-sheet \{[^}]*size: 11in 17in;", "the map-only sheet is tabloid, 11 x 17 in")
        self.assertIn(".print-map-only .map { page: map-sheet; }", page, "the map prints on its own named sheet")
        self.assertIn(".print-map-only body *:not(.map, .map *, :has(.map)) { display: none !important; }", page,
                      "everything but the map is hidden while the map-only class is on")
        self.assertRegex(page, r'<button type="button" id="print-map"[^>]*>Print map only</button>')
        self.assertRegex(page, r"classList\.add\('print-map-only'\);[^}]*window\.print\(\);", "the class is on before the print dialog opens")
        self.assertRegex(page, r"addEventListener\('afterprint', done\)[^}]*window\.print\(\)", "the class comes off when the dialog closes")
        self.assertRegex(page, r"const done = \(\) => \{ root\.classList\.remove\('print-map-only'\);", "so a later Ctrl+P prints the whole page")

    def test_cells_a_feature_touches(self):
        g = self.grid
        self.assertEqual(g.cells("pump_house"), ["B19"])
        self.assertEqual(g.cells("rv_pad"), ["B18", "C18", "B19", "C19"])
        self.assertEqual(g.cells({"shape": "rect", "group": "x", "x0": 50, "y0": 900, "x1": 100, "y1": 950}), ["B19"])
        fence = g.cells("fence")
        self.assertIn("A1", fence)
        self.assertIn("G26", fence)
        self.assertNotIn("D13", fence, "the lot boundary only touches the edge cells")
        self.assertNotIn("fence", [f["id"] for f in g.features_in("B19")])
        self.assertIn("irrigation_tank", [f["id"] for f in g.features_in("b19")])

    def test_centers(self):
        self.assertEqual(self.grid.center("pump_house"), (73.25, 913.25))
        cx, cy = self.grid.center("fence")
        self.assertAlmostEqual(cx, 331.3 / 2, places=6)
        self.assertAlmostEqual(cy, 1291.9 / 2, places=6)
        x, y = self.grid.center({"shape": "line", "pts": [[0, 0], [0, 10], [10, 10]]})
        self.assertEqual((x, y), (0, 10))

    def test_latlon_round_trip_and_shed_pin(self):
        g = self.grid
        for x, y in ((0, 0), (331.3, 1291.9), (63, 921)):
            lat, lon = g.to_latlon(x, y)
            bx, by = g.from_latlon(lat, lon)
            self.assertLess(math.dist((x, y), (bx, by)), 0.01)
            ux, uy = g.from_utm(*g.to_utm(x, y))
            self.assertLess(math.dist((x, y), (ux, uy)), 0.001)
        lat, lon = g.to_latlon(0, 0)
        self.assertAlmostEqual(lat, 43.47545, places=4)
        self.assertAlmostEqual(lon, -115.59484, places=4)
        # The owner's Google Maps pin on the red shed should land on the shed.
        px, py = g.from_latlon(43.473383, -115.594507)
        self.assertLess(math.dist((px, py), g.center("shed")), 10)
        # North is up: moving south (larger y) lowers latitude; moving east raises longitude.
        self.assertLess(g.to_latlon(0, 100)[0], g.to_latlon(0, 0)[0])
        self.assertGreater(g.to_latlon(100, 0)[1], g.to_latlon(0, 0)[1])

    def test_elevations(self):
        g = self.grid
        low, high = g.elevation_ft(0, 50), g.elevation_ft(331, 835)
        self.assertTrue(4730 < low < high < 4770)
        self.assertGreater(high - low, 18)
        self.assertGreater(g.elevation_ft(165, 900), g.elevation_ft(165, 100), "the homestead sits above the north end")

    def test_orchard_tree_positions(self):
        g = self.grid
        self.assertEqual(g.tree_xy(1, 1), (38, 600))
        self.assertEqual(g.tree_xy(2, 1), (47, 580), "even rows sit half a spacing east")
        self.assertEqual(g.tree_xy(15, 13), (254, 320))
        self.assertEqual(g.cell_of(*g.tree_xy(1, 1)), "A13")
        x0, y0, x1, y1 = g.bbox("orchard_block")
        for r in range(1, 16):
            for c in range(1, 14):
                x, y = g.tree_xy(r, c)
                self.assertTrue(x0 < x < x1 and y0 < y < y1, f"R{r}-C{c} outside the orchard block")
        for bad in ((0, 1), (16, 1), (1, 14), (1.5, 2)):
            with self.assertRaises(ValueError):
                g.tree_xy(*bad)

    def test_cli(self):
        cases = [(["cell", "63", "921"], "B19"), (["where", "b19"], "pump_house"), (["feature", "irrigation_tank"], "3,000 gal"),
                 (["latlon", "0", "0"], "43.475452"), (["fromlatlon", "43.473383", "-115.594507"], "B16"),
                 (["dist", "irrigation_tank", "house"], "ft"), (["list", "planned"], "garage"), (["tree", "5", "3"], "B11"),
                 (["list", "utility"], "hydrant_north"), (["list", "utility"], "head_station_8"), (["where", "G17"], "hydrant_east"),
                 (["site-ref", "C17-E12-S18"], "x 112, y 818"),
                 (["site-ref", "B10-E33-S35"], "x 83, y 485"),
                 (["feature", "shed"], "dji_0073, dji_0065"),
                 (["where", "E14"], "greenhouse_pit"), (["list", "planned"], "greenhouse_gothic"),
                 (["site-ref", "PENDING"], "location not yet known")]
        for argv, expected in cases:
            out = io.StringIO()
            with contextlib.redirect_stdout(out):
                self.assertEqual(main(argv), 0)
            self.assertIn(expected, out.getvalue(), argv)


if __name__ == "__main__":
    unittest.main()
