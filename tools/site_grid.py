#!/usr/bin/env python3
"""Master-grid helper for Mountain Prairie Acres (lot feet).

Reads the same data the web pages use: docs/data/site_grid.js (grid, features, georeference)
and docs/data/site_terrain.js (lidar elevation grid). Coordinates are lot feet: x = feet east of
the west fence, y = feet south of the north fence. Grid cells are 50 ft: columns A-G west to east,
rows 1-26 north to south (B19 = x 50-100, y 900-950).

Usage:
  python tools/site_grid.py cell X Y              grid cell for a point, e.g. B19
  python tools/site_grid.py where REF             a cell's bounds, center, and the features in it
  python tools/site_grid.py feature ID            one feature: center, size, cells, elevation, lat/long
  python tools/site_grid.py list [GROUP]          all features, or one group (homestead, planned, ...)
  python tools/site_grid.py elev X Y              ground elevation from the lidar grid
  python tools/site_grid.py latlon X Y            lot feet to latitude, longitude
  python tools/site_grid.py fromlatlon LAT LON    latitude, longitude to lot feet and cell
  python tools/site_grid.py dist A B              distance between two features or points ("x,y")
  python tools/site_grid.py tree ROW COL          orchard position, e.g. tree 5 3 for R5-C3

In code:
  from site_grid import SiteGrid
  grid = SiteGrid()
  grid.cell_of(63, 921)            # 'B19'
  grid.center("pump_house")        # (73.25, 913.25)
  grid.elevation_ft(63, 921)       # about 4,759 ft
"""
import argparse
import json
import math
import pathlib
import re
import sys

DATA_DIR = pathlib.Path(__file__).resolve().parents[1] / "docs" / "data"
M_TO_FT = 3.28084


def read_block(path, name):
    """Return the strict-JSON block between /* BEGIN name JSON */ and /* END name JSON */ in a .js file."""
    text = pathlib.Path(path).read_text(encoding="utf-8")
    match = re.search(r"/\* BEGIN %s JSON \*/(.*?)/\* END %s JSON \*/" % (name, name), text, re.S)
    if not match:
        raise ValueError(f"{path}: no {name} JSON block")
    return json.loads(match.group(1))


class SiteGrid:
    def __init__(self, data_dir=DATA_DIR):
        data_dir = pathlib.Path(data_dir)
        self.data = read_block(data_dir / "site_grid.js", "SITE_GRID")
        terrain = data_dir / "site_terrain.js"
        self.terrain = read_block(terrain, "SITE_TERRAIN") if terrain.exists() else None
        grid = self.data["grid"]
        self.cell, self.columns, self.rows = grid["cell"], grid["columns"], grid["rows"]
        self.by_id = {f["id"]: f for f in self.data["features"]}

    # Grid cells
    def cell_of(self, x, y):
        c, r = math.floor(x / self.cell), math.floor(y / self.cell)
        if 0 <= c < len(self.columns) and 0 <= r < self.rows:
            return f"{self.columns[c]}{r + 1}"
        return None

    def cell_bounds(self, ref):
        match = re.fullmatch(r"\s*([A-Za-z])\s*(\d{1,2})\s*", str(ref))
        c = self.columns.find(match.group(1).upper()) if match else -1
        r = int(match.group(2)) - 1 if match else -1
        if c < 0 or not 0 <= r < self.rows:
            raise ValueError(f"not a grid reference: {ref!r}")
        return (c * self.cell, r * self.cell, (c + 1) * self.cell, (r + 1) * self.cell)

    def cell_center(self, ref):
        x0, y0, x1, y1 = self.cell_bounds(ref)
        return ((x0 + x1) / 2, (y0 + y1) / 2)

    def ref(self, x, y):
        return f"{self.cell_of(x, y) or 'off grid'} (x {round(x)}, y {round(y)})"

    def in_lot(self, x, y):
        fence = self.data["lot"]["fence"]
        return 0 <= x <= fence["width"] and 0 <= y <= fence["depth"]

    # Features
    def feature(self, fid):
        if isinstance(fid, dict):
            return fid
        if fid not in self.by_id:
            raise KeyError(f"unknown feature: {fid}")
        return self.by_id[fid]

    def features(self, group=None):
        return [f for f in self.data["features"] if group is None or f["group"] == group]

    def points(self, f):
        f = self.feature(f)
        if f["shape"] == "rect":
            return [(f["x0"], f["y0"]), (f["x1"], f["y0"]), (f["x1"], f["y1"]), (f["x0"], f["y1"])]
        if f["shape"] == "circle":
            return [(f["cx"] - f["r"], f["cy"] - f["r"]), (f["cx"] + f["r"], f["cy"] + f["r"])]
        if f["shape"] == "point":
            return [(f["x"], f["y"])]
        return [tuple(p) for p in f["pts"]]

    def bbox(self, f):
        f = self.feature(f)
        pts = self.points(f)
        pad = f.get("width", 0) / 2 if f["shape"] == "line" else 0
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        return (min(xs) - pad, min(ys) - pad, max(xs) + pad, max(ys) + pad)

    def center(self, f):
        f = self.feature(f)
        shape = f["shape"]
        if shape == "rect":
            return ((f["x0"] + f["x1"]) / 2, (f["y0"] + f["y1"]) / 2)
        if shape == "circle":
            return (f["cx"], f["cy"])
        if shape == "point":
            return (f["x"], f["y"])
        pts = f["pts"]
        if shape == "polygon":
            area = cx = cy = 0.0
            for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]):
                k = x1 * y2 - x2 * y1
                area += k
                cx += (x1 + x2) * k
                cy += (y1 + y2) * k
            return (cx / (3 * area), cy / (3 * area))
        lengths = [math.dist(a, b) for a, b in zip(pts, pts[1:])]
        half = sum(lengths) / 2
        for (a, b), length in zip(zip(pts, pts[1:]), lengths):
            if half <= length:
                t = half / length if length else 0
                return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
            half -= length
        return tuple(pts[-1])

    def size(self, f):
        f = self.feature(f)
        if f["shape"] == "rect":
            return (f["x1"] - f["x0"], f["y1"] - f["y0"])
        if f["shape"] == "circle":
            return (2 * f["r"], 2 * f["r"])
        x0, y0, x1, y1 = self.bbox(f)
        return (x1 - x0, y1 - y0)

    def cells(self, f):
        """Grid cells a feature touches, in reading order. Lines and the lot boundary count only the
        cells they pass through; other polygons count the cells they cover."""
        f = self.feature(f)
        samples = []
        if f["shape"] == "line" or (f["shape"] == "polygon" and f["group"] == "boundary"):
            pts = f["pts"] + (f["pts"][:1] if f["shape"] == "polygon" else [])
            for (ax, ay), (bx, by) in zip(pts, pts[1:]):
                n = max(1, math.ceil(math.dist((ax, ay), (bx, by))))
                samples += [(ax + (bx - ax) * k / n, ay + (by - ay) * k / n) for k in range(n + 1)]
        elif f["shape"] == "polygon":
            x0, y0, x1, y1 = self.bbox(f)
            samples = [tuple(p) for p in f["pts"]]
            samples += [(x0 + i * 2.5, y0 + j * 2.5) for i in range(int((x1 - x0) / 2.5) + 1)
                        for j in range(int((y1 - y0) / 2.5) + 1) if _inside(x0 + i * 2.5, y0 + j * 2.5, f["pts"])]
        else:
            x0, y0, x1, y1 = self.bbox(f)
            x1, y1 = max(x0, x1 - 1e-6), max(y0, y1 - 1e-6)
            samples = [(x, y) for x in (x0, *range(math.ceil(x0 / self.cell) * self.cell, math.ceil(x1), self.cell), x1)
                       for y in (y0, *range(math.ceil(y0 / self.cell) * self.cell, math.ceil(y1), self.cell), y1)]
        found = {self.cell_of(x, y) for x, y in samples} - {None}
        return sorted(found, key=lambda ref: (int(ref[1:]), ref[0]))

    def features_in(self, ref):
        return [f for f in self.data["features"] if ref.strip().upper() in self.cells(f)]

    # Orchard planting positions (from the pollination grid plan)
    def tree_xy(self, r, c):
        """Lot feet of orchard position R(r)-C(c): even rows sit half a tree spacing east."""
        o = self.data["orchard"]
        if not (isinstance(r, int) and isinstance(c, int) and 1 <= r <= o["rows"] and 1 <= c <= o["columns"]):
            raise ValueError(f"no orchard position R{r}-C{c}")
        return (o["c1_x"] + (c - 1) * o["tree_spacing"] + (o["even_row_offset"] if r % 2 == 0 else 0),
                o["r1_y"] - (r - 1) * o["row_spacing"])

    # Georeference
    def to_latlon(self, x, y):
        g = self.data["georef"]
        return (g["lat"][0] + g["lat"][1] * x + g["lat"][2] * y, g["lon"][0] + g["lon"][1] * x + g["lon"][2] * y)

    def from_latlon(self, lat, lon):
        g = self.data["georef"]
        a, b, c, d = g["lat"][1], g["lat"][2], g["lon"][1], g["lon"][2]
        u, v, det = lat - g["lat"][0], lon - g["lon"][0], a * d - b * c
        return ((d * u - b * v) / det, (a * v - c * u) / det)

    def to_utm(self, x, y):
        u = self.data["georef"]["utm"]
        t, (e0, n0) = u["theta"], u["origin"]
        return (e0 + 0.3048 * (x * math.cos(t) - y * math.sin(t)), n0 - 0.3048 * (x * math.sin(t) + y * math.cos(t)))

    def from_utm(self, easting, northing):
        u = self.data["georef"]["utm"]
        t, (e0, n0) = u["theta"], u["origin"]
        dx, dy = (easting - e0) / 0.3048, (northing - n0) / 0.3048
        return (dx * math.cos(t) - dy * math.sin(t), -dx * math.sin(t) - dy * math.cos(t))

    # Terrain
    def elevation_m(self, x, y):
        if not self.terrain:
            raise RuntimeError("docs/data/site_terrain.js is missing")
        g = self.terrain["grid"]
        fx = min(max((x - g["x0"]) / g["step"], 0), g["nx"] - 1.001)
        fy = min(max((y - g["y0"]) / g["step"], 0), g["ny"] - 1.001)
        j, i = math.floor(fx), math.floor(fy)
        tx, ty, z, n = fx - j, fy - i, g["z"], g["nx"]
        cm = (z[i * n + j] * (1 - tx) * (1 - ty) + z[i * n + j + 1] * tx * (1 - ty)
              + z[(i + 1) * n + j] * (1 - tx) * ty + z[(i + 1) * n + j + 1] * tx * ty)
        return g["base"] + cm / 100

    def elevation_ft(self, x, y):
        return self.elevation_m(x, y) * M_TO_FT


def _inside(x, y, pts):
    """Even-odd point-in-polygon test."""
    hit = False
    for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]):
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            hit = not hit
    return hit


def _point(grid, text):
    if "," in text:
        x, y = (float(v) for v in text.split(","))
        return (x, y), f"({x:g}, {y:g})"
    return grid.center(text), grid.feature(text)["name"]


def _describe(grid, f):
    cx, cy = grid.center(f)
    lat, lon = grid.to_latlon(cx, cy)
    w, h = grid.size(f)
    lines = [f"{f['name']} [{f['id']}]  {f['group']}, {f['status']}",
             f"  center   x {cx:.1f}, y {cy:.1f}  cell {grid.cell_of(cx, cy) or 'off grid'}",
             f"  extent   {w:.1f} ft east-west x {h:.1f} ft north-south; cells {', '.join(grid.cells(f)) or 'none'}",
             f"  lat/long {lat:.6f}, {lon:.6f}"]
    if grid.terrain and grid.in_lot(cx, cy):
        lines.append(f"  ground   {grid.elevation_ft(cx, cy):,.1f} ft ({grid.elevation_m(cx, cy):.2f} m), lidar")
    if f.get("notes"):
        lines.append(f"  notes    {f['notes']}")
    return "\n".join(lines)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = parser.add_subparsers(dest="cmd", required=True)
    for name, args in [("cell", ["x", "y"]), ("elev", ["x", "y"]), ("latlon", ["x", "y"]),
                       ("fromlatlon", ["lat", "lon"]), ("where", ["ref"]), ("feature", ["id"]), ("dist", ["a", "b"])]:
        p = sub.add_parser(name)
        for a in args:
            p.add_argument(a, type=str if a in ("ref", "id", "a", "b") else float)
    sub.add_parser("list").add_argument("group", nargs="?")
    tree = sub.add_parser("tree")
    tree.add_argument("row", type=int)
    tree.add_argument("col", type=int)
    args = parser.parse_args(argv)
    grid = SiteGrid()

    if args.cmd == "tree":
        x, y = grid.tree_xy(args.row, args.col)
        lat, lon = grid.to_latlon(x, y)
        print(f"R{args.row}-C{args.col}: x {x:g}, y {y:g}  cell {grid.cell_of(x, y)}  ground {grid.elevation_ft(x, y):,.1f} ft  {lat:.6f}, {lon:.6f}")
    elif args.cmd == "cell":
        print(grid.cell_of(args.x, args.y) or "off grid")
    elif args.cmd == "where":
        x0, y0, x1, y1 = grid.cell_bounds(args.ref)
        print(f"{args.ref.strip().upper()}: x {x0}-{x1}, y {y0}-{y1}, center ({(x0 + x1) / 2:g}, {(y0 + y1) / 2:g})")
        for f in grid.features_in(args.ref):
            print(f"  {f['id']:18s} {f['name']}")
    elif args.cmd == "feature":
        print(_describe(grid, grid.feature(args.id)))
    elif args.cmd == "list":
        for f in grid.features(args.group):
            cx, cy = grid.center(f)
            print(f"{f['id']:18s} {grid.cell_of(cx, cy) or 'off grid':8s} ({cx:6.1f}, {cy:7.1f})  {f['name']}")
    elif args.cmd == "elev":
        print(f"{grid.elevation_ft(args.x, args.y):,.1f} ft ({grid.elevation_m(args.x, args.y):.2f} m) at {grid.ref(args.x, args.y)}")
    elif args.cmd == "latlon":
        lat, lon = grid.to_latlon(args.x, args.y)
        print(f"{lat:.6f}, {lon:.6f}")
    elif args.cmd == "fromlatlon":
        x, y = grid.from_latlon(args.lat, args.lon)
        print(f"x {x:.1f}, y {y:.1f}  {grid.ref(x, y)}{'' if grid.in_lot(x, y) else '  (outside the fence)'}")
    elif args.cmd == "dist":
        (ax, ay), an = _point(grid, args.a)
        (bx, by), bn = _point(grid, args.b)
        line = f"{an} to {bn}: {math.dist((ax, ay), (bx, by)):,.1f} ft"
        if grid.terrain and grid.in_lot(ax, ay) and grid.in_lot(bx, by):
            line += f", ground {grid.elevation_ft(bx, by) - grid.elevation_ft(ax, ay):+.1f} ft"
        print(line)
    return 0


if __name__ == "__main__":
    sys.exit(main())
