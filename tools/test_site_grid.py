"""Tests for tools/site_grid.py and the shared data in docs/data. Run: python -m unittest discover -s tools"""
import contextlib
import io
import itertools
import math
import pathlib
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
            self.assertTrue(self.grid.in_lot(x0, y0) and self.grid.in_lot(x1, y1), f["id"])
        self.assertEqual(self.grid.feature("water_line_west")["group"], "utility", "the west trench is a water line, not a path")

    def test_water_lines_and_hydrants(self):
        g = self.grid
        pipes = {f["id"]: f for f in g.features("utility") if f.get("kind") == "water_pipe"}
        hydrants = [f for f in g.features("utility") if f.get("kind") == "hydrant"]
        self.assertEqual(len(hydrants), 8)
        self.assertTrue(all(f["shape"] == "line" and f["size_in"] in (1.5, 2) for f in pipes.values()))
        self.assertEqual({k for k, f in pipes.items() if f["size_in"] == 1.5}, {"water_tee_west", "water_line_west", "water_lateral_north"},
                         "the line teed west, the line along the west fence, and the north lateral are 1.5 in; the rest is 2 in")
        main_pts = pipes["water_main"]["pts"]
        x0, y0, x1, y1 = g.bbox("pump_house")
        self.assertTrue(x0 - 2 <= main_pts[0][0] <= x1 + 2 and y0 - 2 <= main_pts[0][1] <= y1 + 2, "the 2 in main starts at the pump house")
        self.assertLess(main_pts[-1][1], 50, "the main runs to the north end of the lot")
        for fid, f in pipes.items():
            if fid not in ("water_main", "water_line_west"):
                self.assertLess(_dist_to_line(f["pts"][0], main_pts), 0.5, f"{fid} comes off the main")
        self.assertTrue(_lines_cross(pipes["water_line_west"]["pts"], pipes["water_tee_west"]["pts"]), "the 1.5 in line feeds the west fence line")
        self.assertAlmostEqual(math.dist(*pipes["water_lateral_north"]["pts"]), 10, places=6)
        ends = [tuple(f["pts"][k]) for f in pipes.values() for k in (0, -1)]
        for h in hydrants:
            self.assertLess(min(math.dist((h["x"], h["y"]), e) for e in ends), 0.5, f"{h['id']} sits at the end of a water line")

        # Every line ends at a hydrant, runs into another line, or starts at the pump house
        def closed(p, fid):
            return (min(math.dist(p, (h["x"], h["y"])) for h in hydrants) < 0.5
                    or any(_dist_to_line(p, q["pts"]) < 0.5 for k, q in pipes.items() if k != fid)
                    or (x0 - 2 <= p[0] <= x1 + 2 and y0 - 2 <= p[1] <= y1 + 2))
        for fid, f in pipes.items():
            for end in (f["pts"][0], f["pts"][-1]):
                self.assertTrue(closed(end, fid), f"{fid} has an open end at {end}")
        wl = pipes["water_line_west"]["pts"]
        self.assertTrue(all(15 < x < 25 for x, _ in wl), "the west fence line stays about 20 ft inside the fence")
        self.assertEqual([g.cell_of(*wl[0]), g.cell_of(*wl[-1])], ["A14", "A20"])

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
        self.assertEqual(self.grid.size("workshop"), (46, 32))
        self.assertEqual(self.grid.size("container_solar"), (8, 40))
        self.assertEqual(self.grid.size("container_storage"), (40, 8))

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
        self.assertEqual(g.tree_xy(1, 1), (38, 585))
        self.assertEqual(g.tree_xy(2, 1), (47, 565), "even rows sit half a spacing east")
        self.assertEqual(g.tree_xy(15, 13), (254, 305))
        self.assertEqual(g.cell_of(*g.tree_xy(1, 1)), "A12")
        x0, y0, x1, y1 = g.bbox("orchard_block")
        for r in range(1, 16):
            for c in range(1, 14):
                x, y = g.tree_xy(r, c)
                self.assertTrue(x0 < x < x1 and y0 < y < y1, f"R{r}-C{c} outside the orchard block")
        for bad in ((0, 1), (16, 1), (1, 14), (1.5, 2)):
            with self.assertRaises(ValueError):
                g.tree_xy(*bad)

    def test_cli(self):
        cases = [(["cell", "63", "921"], "B19"), (["where", "b19"], "pump_house"), (["feature", "irrigation_tank"], "3,500 gal"),
                 (["latlon", "0", "0"], "43.475452"), (["fromlatlon", "43.473383", "-115.594507"], "B16"),
                 (["dist", "irrigation_tank", "house"], "ft"), (["list", "planned"], "garage"), (["tree", "5", "3"], "B11"),
                 (["list", "utility"], "hydrant_north"), (["where", "G17"], "hydrant_east")]
        for argv, expected in cases:
            out = io.StringIO()
            with contextlib.redirect_stdout(out):
                self.assertEqual(main(argv), 0)
            self.assertIn(expected, out.getvalue(), argv)


if __name__ == "__main__":
    unittest.main()
