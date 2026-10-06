// Mountain Prairie Acres: master site grid, feature inventory, and coordinate helpers.
// Lot feet: x = feet east of the west fence, y = feet south of the north fence (origin at the NW fence corner).
// Edit the JSON between the markers (it must stay strict JSON); tools/site_grid.py reads the same block.
// Pages: <script src="data/site_grid.js"></script>, then use window.SiteGrid (see site_master_grid.html).
window.SITE_GRID = /* BEGIN SITE_GRID JSON */
{
 "name": "Mountain Prairie Acres",
 "updated": "2026-10-06",
 "units": "ft",
 "frame": {
  "origin": "NW fence corner",
  "x": "feet east of the west fence, along the north fence",
  "y": "feet south of the north fence, along the west fence",
  "alignment": "The fences run within 0.2 degrees of true north-south and east-west, so +x is east and +y is south."
 },
 "lot": {
  "fence": {
   "width": 331.3,
   "depth": 1291.9,
   "acres": 9.83,
   "fit_rms_ft": 0.5
  },
  "parcel_likely": {
   "x0": 0,
   "x1": 331.3,
   "y0": -18,
   "y1": 1305,
   "note": "Likely 10-acre legal parcel (330 x 1,320 ft) measured to the road centerlines; not surveyed."
  }
 },
 "grid": {
  "cell": 50,
  "columns": "ABCDEFG",
  "rows": 26,
  "how": "Column letter A-G west to east, row number 1-26 north to south, 50 ft cells. Example: B19 is x 50-100, y 900-950."
 },
 "georef": {
  "datum": "NAD83 (same as WGS84 / GPS to within about 1 m here)",
  "lat": [
   43.47545236651602,
   6.234383475193465e-09,
   -2.744090386632063e-06
  ],
  "lon": [
   -115.59483926111005,
   3.7679768842894716e-06,
   8.560582907541764e-09
  ],
  "formula": "lat = lat[0] + lat[1]*x + lat[2]*y; lon = lon[0] + lon[1]*x + lon[2]*y (x, y in feet; exact to under 1 cm across the lot)",
  "utm": {
   "zone": "11N",
   "epsg": 26911,
   "origin": [
    613645.913,
    4814574.108
   ],
   "theta": -0.0191549885406381,
   "formula": "E = E0 + 0.3048*(x*cos t - y*sin t); N = N0 - 0.3048*(x*sin t + y*cos t)"
  },
  "x_axis_true_bearing_deg": 89.87,
  "accuracy_ft": 10,
  "check": "The owner's Google Maps pin on the red shed falls 5 ft from the shed roof center measured on USGS imagery.",
  "source": "Lot frame fitted to the four fence lines on USGS NAIP imagery (0.52 m pixels, UTM zone 11N)."
 },
 "orchard": {
  "source": "orchard_pollination_grid.html (the owner's planting plan)",
  "rows": 15,
  "columns": 13,
  "r1_y": 585,
  "row_spacing": 20,
  "c1_x": 38,
  "tree_spacing": 18,
  "even_row_offset": 9,
  "how": "Tree R(r)-C(c) stands at x = c1_x + (c - 1) * tree_spacing, plus even_row_offset in even rows, and y = r1_y - (r - 1) * row_spacing."
 },
 "features": [
  {
   "id": "fence",
   "name": "Fence (lot line)",
   "group": "boundary",
   "status": "existing",
   "shape": "polygon",
   "pts": [
    [
     0,
     0
    ],
    [
     331.3,
     0
    ],
    [
     331.3,
     1291.9
    ],
    [
     0,
     1291.9
    ]
   ],
   "notes": "Fenced lot, 331 x 1,292 ft (9.83 acres)."
  },
  {
   "id": "road_north",
   "name": "North road",
   "group": "access",
   "status": "existing",
   "shape": "line",
   "width": 24,
   "pts": [
    [
     -40,
     -19.1
    ],
    [
     380,
     -17.3
    ]
   ],
   "notes": "Gravel county road; centerline about 18 ft north of the north fence."
  },
  {
   "id": "road_south",
   "name": "South road",
   "group": "access",
   "status": "existing",
   "shape": "line",
   "width": 24,
   "pts": [
    [
     -40,
     1303.3
    ],
    [
     380,
     1307.4
    ]
   ],
   "notes": "Road along the south line; centerline about 13 ft south of the south fence."
  },
  {
   "id": "driveway_entrance",
   "name": "Driveway entrance",
   "group": "access",
   "status": "existing",
   "shape": "point",
   "x": 317.6,
   "y": -18,
   "notes": "Where the driveway leaves the north road; use for directions."
  },
  {
   "id": "driveway",
   "key": "9",
   "name": "Driveway",
   "group": "access",
   "status": "existing",
   "shape": "line",
   "width": 14,
   "pts": [
    [
     317.6,
     -18
    ],
    [
     316.5,
     40
    ],
    [
     311.8,
     280
    ],
    [
     303.9,
     520
    ],
    [
     300.2,
     639
    ],
    [
     298,
     700
    ],
    [
     295,
     720
    ],
    [
     291,
     740
    ],
    [
     283,
     760
    ],
    [
     272,
     780
    ],
    [
     258,
     800
    ],
    [
     251,
     820
    ],
    [
     245,
     840
    ],
    [
     240,
     860
    ],
    [
     233,
     880
    ],
    [
     224,
     900
    ],
    [
     218,
     912
    ]
   ],
   "notes": "Road-mix driveway down the east side to the yard and the house pad, about 12-16 ft wide.",
   "accuracy_ft": 5
  },
  {
   "id": "yard",
   "key": "9",
   "name": "Yard and turnaround",
   "group": "access",
   "status": "existing",
   "shape": "polygon",
   "pts": [
    [
     100,
     757
    ],
    [
     115,
     754
    ],
    [
     128,
     749
    ],
    [
     142,
     743
    ],
    [
     155,
     740
    ],
    [
     168,
     742
    ],
    [
     182,
     748
    ],
    [
     196,
     753
    ],
    [
     212,
     756
    ],
    [
     232,
     758
    ],
    [
     250,
     761
    ],
    [
     266,
     764
    ],
    [
     280,
     760
    ],
    [
     270,
     780
    ],
    [
     258,
     798
    ],
    [
     246,
     808
    ],
    [
     232,
     813
    ],
    [
     215,
     820
    ],
    [
     198,
     823
    ],
    [
     182,
     822
    ],
    [
     168,
     819
    ],
    [
     158,
     814
    ],
    [
     152,
     804
    ],
    [
     150,
     790
    ],
    [
     146,
     779
    ],
    [
     138,
     773
    ],
    [
     125,
     771
    ],
    [
     112,
     773
    ],
    [
     103,
     772
    ]
   ],
   "notes": "Road-mix work yard between the shed and the driveway (patchy weeds).",
   "accuracy_ft": 8
  },
  {
   "id": "loop_path",
   "key": "9",
   "name": "Loop drive around the island",
   "group": "access",
   "status": "existing",
   "shape": "line",
   "width": 9,
   "pts": [
    [
     104,
     768
    ],
    [
     98,
     780
    ],
    [
     95.5,
     800
    ],
    [
     95.5,
     820
    ],
    [
     98.5,
     835
    ],
    [
     106,
     845
    ],
    [
     118,
     848
    ],
    [
     130,
     843
    ],
    [
     142,
     833
    ],
    [
     152,
     822
    ],
    [
     160,
     815
    ]
   ],
   "notes": "Road-mix loop around the planted island south of the yard.",
   "accuracy_ft": 6
  },
  {
   "id": "path_workshop",
   "key": "9",
   "name": "Path to the workshop pad",
   "group": "access",
   "status": "existing",
   "shape": "line",
   "width": 10,
   "pts": [
    [
     112,
     848
    ],
    [
     100,
     856
    ],
    [
     89,
     860
    ]
   ],
   "accuracy_ft": 8
  },
  {
   "id": "path_rv",
   "key": "9",
   "name": "Path to the RV pad",
   "group": "access",
   "status": "existing",
   "shape": "line",
   "width": 9,
   "pts": [
    [
     108,
     850
    ],
    [
     103,
     864
    ],
    [
     103,
     882
    ]
   ],
   "accuracy_ft": 8
  },
  {
   "id": "water_line_west",
   "name": "Buried water line",
   "group": "utility",
   "status": "existing",
   "shape": "line",
   "width": 3,
   "pts": [
    [
     23,
     677
    ],
    [
     19.5,
     790
    ],
    [
     20.5,
     875
    ],
    [
     21.5,
     935
    ],
    [
     23,
     998
    ]
   ],
   "notes": "Covered trench of a buried water line about 20 ft inside the west fence, traced from the drone photo from y 677 to the photo edge near y 1000 (ends not traced). Keep digging, posts, and tree holes off this line.",
   "accuracy_ft": 6
  },
  {
   "id": "shed",
   "key": "1",
   "name": "Red shed",
   "group": "homestead",
   "status": "existing",
   "shape": "rect",
   "x0": 75,
   "y0": 746,
   "x1": 101.5,
   "y1": 772,
   "notes": "Main building about 18 x 26 ft with an 8 ft lean-to on the west side; ridge about 14 ft high.",
   "accuracy_ft": 3
  },
  {
   "id": "outhouse",
   "key": "2",
   "name": "Outhouse",
   "group": "homestead",
   "status": "existing",
   "shape": "rect",
   "x0": 83,
   "y0": 811,
   "x1": 87,
   "y1": 815,
   "notes": "Blue outhouse south of the shed.",
   "accuracy_ft": 3
  },
  {
   "id": "container_solar",
   "key": "3",
   "name": "Solar container",
   "group": "homestead",
   "status": "existing",
   "shape": "rect",
   "x0": 39.5,
   "y0": 912,
   "x1": 47.5,
   "y1": 952,
   "notes": "8 x 40 shipping container, runs north-south, solar panels on the roof.",
   "accuracy_ft": 3
  },
  {
   "id": "container_storage",
   "key": "3",
   "name": "Storage container",
   "group": "homestead",
   "status": "existing",
   "shape": "rect",
   "x0": 39.5,
   "y0": 959.5,
   "x1": 79.5,
   "y1": 967.5,
   "notes": "8 x 40 shipping container (white), runs east-west; forms the L with the solar container.",
   "accuracy_ft": 3
  },
  {
   "id": "house_pad",
   "key": "4",
   "name": "House pad",
   "group": "homestead",
   "status": "existing",
   "shape": "polygon",
   "pts": [
    [
     113,
     914
    ],
    [
     220,
     912
    ],
    [
     222,
     940
    ],
    [
     222,
     966
    ],
    [
     116,
     966
    ],
    [
     114,
     940
    ]
   ],
   "notes": "Graded pad, about 108 x 53 ft; the driveway arrives at its northeast corner.",
   "accuracy_ft": 5
  },
  {
   "id": "house",
   "key": "4",
   "name": "House (planned)",
   "group": "planned",
   "status": "planned",
   "shape": "rect",
   "x0": 120,
   "y0": 919.5,
   "x1": 186,
   "y1": 959.5,
   "notes": "KIT Custom Homebuilders Pinehurst (model 2512): 40 x 66 ft, 2,399 sq ft, 4 bed / 3 bath. Placement on the pad is approximate."
  },
  {
   "id": "garage",
   "key": "4",
   "name": "Garage (planned)",
   "group": "planned",
   "status": "planned",
   "shape": "rect",
   "x0": 186,
   "y0": 933.5,
   "x1": 216,
   "y1": 959.5,
   "notes": "2.5-car garage on the east (driveway) end, flush with the south wall of the house; about 30 x 26 ft placeholder until the size is set."
  },
  {
   "id": "irrigation_tank",
   "key": "5",
   "name": "Irrigation tank",
   "group": "homestead",
   "status": "existing",
   "shape": "circle",
   "cx": 63,
   "cy": 921,
   "r": 4.5,
   "notes": "3,500 gal black poly tank, about 9 ft across, beside the pump house.",
   "accuracy_ft": 3
  },
  {
   "id": "pump_house",
   "key": "6",
   "name": "Pump house",
   "group": "homestead",
   "status": "existing",
   "shape": "rect",
   "x0": 67.5,
   "y0": 907.5,
   "x1": 79,
   "y1": 919,
   "notes": "Well, irrigation pumps, solar inverters, and batteries; about 11 x 11 ft.",
   "accuracy_ft": 3
  },
  {
   "id": "workshop_pad",
   "key": "7",
   "name": "Workshop pad",
   "group": "homestead",
   "status": "existing",
   "shape": "rect",
   "x0": 33,
   "y0": 842,
   "x1": 89,
   "y1": 884,
   "notes": "Graded pad north of the containers and pump house, about 56 x 42 ft (edges approximate).",
   "accuracy_ft": 6
  },
  {
   "id": "workshop",
   "key": "7",
   "name": "Workshop (planned)",
   "group": "planned",
   "status": "planned",
   "shape": "rect",
   "x0": 38,
   "y0": 847,
   "x1": 84,
   "y1": 879,
   "notes": "32 x 46 ft shop, long side east-west, centered on its pad."
  },
  {
   "id": "rv_pad",
   "key": "8",
   "name": "RV pad",
   "group": "homestead",
   "status": "existing",
   "shape": "rect",
   "x0": 94,
   "y0": 882,
   "x1": 114,
   "y1": 920,
   "notes": "Pad for the RV camper (edges approximate).",
   "accuracy_ft": 6
  },
  {
   "id": "rv",
   "key": "8",
   "name": "RV camper",
   "group": "homestead",
   "status": "existing",
   "shape": "rect",
   "x0": 99,
   "y0": 889,
   "x1": 108,
   "y1": 914,
   "notes": "About 9 x 25 ft, parked north-south.",
   "accuracy_ft": 4
  },
  {
   "id": "orchard_area",
   "name": "Orchard strip",
   "group": "orchard",
   "status": "planned",
   "shape": "rect",
   "x0": 35,
   "y0": 0,
   "x1": 272,
   "y1": 600,
   "notes": "North 600 ft set aside for the orchard (dashed on the site maps)."
  },
  {
   "id": "orchard_block",
   "name": "Orchard block R1-R15",
   "group": "orchard",
   "status": "planned",
   "shape": "rect",
   "x0": 35,
   "y0": 295,
   "x1": 272,
   "y1": 595,
   "notes": "Tree rows R15 (y 305) to R1 (y 585), 20 ft apart, per the pollination grid."
  },
  {
   "id": "windbreak",
   "name": "Windbreak",
   "group": "orchard",
   "status": "planned",
   "shape": "rect",
   "x0": 0,
   "y0": 299,
   "x1": 35,
   "y1": 591,
   "notes": "Mulberry line at x 5 and hazelnut line at x 20, beside the orchard block."
  },
  {
   "id": "high_point",
   "name": "High point",
   "group": "terrain",
   "status": "existing",
   "shape": "point",
   "x": 331,
   "y": 835,
   "notes": "Highest ground inside the fence (lidar): about 1451.4 m (4,762 ft), at the east fence."
  },
  {
   "id": "low_point",
   "name": "Low point",
   "group": "terrain",
   "status": "existing",
   "shape": "point",
   "x": 0,
   "y": 50,
   "notes": "Lowest ground inside the fence (lidar): about 1444.5 m (4,739 ft), at the west fence near the NW corner."
  },
  {
   "id": "old_ditch",
   "name": "Old ditch line",
   "group": "terrain",
   "status": "existing",
   "shape": "line",
   "width": 8,
   "pts": [
    [
     0,
     950.3
    ],
    [
     30,
     942.3
    ],
    [
     110,
     931.2
    ],
    [
     130,
     925.4
    ],
    [
     150,
     915.6
    ],
    [
     170,
     910.5
    ],
    [
     210,
     892.9
    ],
    [
     260,
     890.2
    ],
    [
     300,
     886.4
    ],
    [
     330,
     893.6
    ]
   ],
   "notes": "Shallow ditch, berm on its north side, in the lidar (before the pads were graded). It carries water west past the containers; check it on the ground."
  }
 ]
}
/* END SITE_GRID JSON */;

(function (root) {
  'use strict';
  var G = root.SITE_GRID, CELL = G.grid.cell, COLS = G.grid.columns, M_TO_FT = 3.28084;
  var byId = {};
  G.features.forEach(function (f) { byId[f.id] = f; });

  function cellOf(x, y) {
    var c = Math.floor(x / CELL), r = Math.floor(y / CELL);
    return c >= 0 && c < COLS.length && r >= 0 && r < G.grid.rows ? COLS.charAt(c) + (r + 1) : null;
  }
  function cellBounds(ref) {
    var m = /^\s*([A-Za-z])\s*(\d{1,2})\s*$/.exec(String(ref));
    var c = m ? COLS.indexOf(m[1].toUpperCase()) : -1, r = m ? Number(m[2]) - 1 : -1;
    if (c < 0 || r < 0 || r >= G.grid.rows) throw new Error('Not a grid reference: ' + ref);
    return { x0: c * CELL, y0: r * CELL, x1: (c + 1) * CELL, y1: (r + 1) * CELL };
  }
  function cellCenter(ref) { var b = cellBounds(ref); return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2]; }
  function ref(x, y) { return (cellOf(x, y) || 'off grid') + ' (x ' + Math.round(x) + ', y ' + Math.round(y) + ')'; }
  function inLot(x, y) { return x >= 0 && y >= 0 && x <= G.lot.fence.width && y <= G.lot.fence.depth; }

  function feature(id) {
    if (!byId[id]) throw new Error('Unknown feature: ' + id);
    return byId[id];
  }
  function features(test) {
    return G.features.filter(function (f) {
      return !test || (typeof test === 'function' ? test(f) : Object.keys(test).every(function (k) { return f[k] === test[k]; }));
    });
  }
  function pointsOf(f) {
    if (f.shape === 'rect') return [[f.x0, f.y0], [f.x1, f.y0], [f.x1, f.y1], [f.x0, f.y1]];
    if (f.shape === 'circle') return [[f.cx - f.r, f.cy - f.r], [f.cx + f.r, f.cy + f.r]];
    if (f.shape === 'point') return [[f.x, f.y]];
    return f.pts;
  }
  function bbox(f) {
    f = typeof f === 'string' ? feature(f) : f;
    var p = pointsOf(f), xs = p.map(function (q) { return q[0]; }), ys = p.map(function (q) { return q[1]; });
    var pad = f.shape === 'line' ? (f.width || 0) / 2 : 0;
    return { x0: Math.min.apply(null, xs) - pad, y0: Math.min.apply(null, ys) - pad, x1: Math.max.apply(null, xs) + pad, y1: Math.max.apply(null, ys) + pad };
  }
  function center(f) {
    f = typeof f === 'string' ? feature(f) : f;
    if (f.shape === 'rect') return [(f.x0 + f.x1) / 2, (f.y0 + f.y1) / 2];
    if (f.shape === 'circle') return [f.cx, f.cy];
    if (f.shape === 'point') return [f.x, f.y];
    var p = f.pts, i, a, b;
    if (f.shape === 'polygon') {
      var A = 0, cx = 0, cy = 0;
      for (i = 0; i < p.length; i++) {
        a = p[i]; b = p[(i + 1) % p.length];
        var k = a[0] * b[1] - b[0] * a[1];
        A += k; cx += (a[0] + b[0]) * k; cy += (a[1] + b[1]) * k;
      }
      return [cx / (3 * A), cy / (3 * A)];
    }
    var total = 0, seg = [];
    for (i = 1; i < p.length; i++) { seg.push(Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1])); total += seg[i - 1]; }
    for (i = 1, a = total / 2; i < p.length; i++) {
      if (a <= seg[i - 1]) { var t = a / (seg[i - 1] || 1); return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t]; }
      a -= seg[i - 1];
    }
    return p[p.length - 1];
  }
  function inside(x, y, p) {
    var hit = false;
    for (var i = 0, j = p.length - 1; i < p.length; j = i++) {
      if ((p[i][1] > y) !== (p[j][1] > y) && x < p[i][0] + (y - p[i][1]) * (p[j][0] - p[i][0]) / (p[j][1] - p[i][1])) hit = !hit;
    }
    return hit;
  }
  // Grid cells a feature touches, in reading order. Lines and the lot boundary count only the cells they pass
  // through; other polygons count the cells they cover.
  function cellsOf(f) {
    f = typeof f === 'string' ? feature(f) : f;
    var s = [], i, k, b = bbox(f);
    if (f.shape === 'line' || (f.shape === 'polygon' && f.group === 'boundary')) {
      var p = f.shape === 'polygon' ? f.pts.concat([f.pts[0]]) : f.pts;
      for (i = 1; i < p.length; i++) {
        var n = Math.max(1, Math.ceil(Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1])));
        for (k = 0; k <= n; k++) s.push([p[i - 1][0] + (p[i][0] - p[i - 1][0]) * k / n, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * k / n]);
      }
    } else if (f.shape === 'polygon') {
      s = f.pts.slice();
      for (var x = b.x0; x <= b.x1; x += 2.5) for (var y = b.y0; y <= b.y1; y += 2.5) if (inside(x, y, f.pts)) s.push([x, y]);
    } else {
      var x1 = Math.max(b.x0, b.x1 - 1e-6), y1 = Math.max(b.y0, b.y1 - 1e-6), xs = [b.x0, x1], ys = [b.y0, y1];
      for (k = Math.ceil(b.x0 / CELL) * CELL; k < x1; k += CELL) xs.push(k);
      for (k = Math.ceil(b.y0 / CELL) * CELL; k < y1; k += CELL) ys.push(k);
      xs.forEach(function (x) { ys.forEach(function (y) { s.push([x, y]); }); });
    }
    var seen = {};
    s.forEach(function (q) { var c = cellOf(q[0], q[1]); if (c) seen[c] = true; });
    return Object.keys(seen).sort(function (a, c) { return (+a.slice(1) - +c.slice(1)) || (a < c ? -1 : a > c ? 1 : 0); });
  }
  // Orchard tree position R(r)-C(c) from the planting plan, in lot feet.
  function treeXY(r, c) {
    var o = G.orchard;
    if (!(r >= 1 && r <= o.rows && c >= 1 && c <= o.columns && r % 1 === 0 && c % 1 === 0)) throw new Error('No orchard position R' + r + '-C' + c);
    return [o.c1_x + (c - 1) * o.tree_spacing + (r % 2 === 0 ? o.even_row_offset : 0), o.r1_y - (r - 1) * o.row_spacing];
  }
  function size(f) {
    f = typeof f === 'string' ? feature(f) : f;
    if (f.shape === 'rect') return [f.x1 - f.x0, f.y1 - f.y0];
    if (f.shape === 'circle') return [2 * f.r, 2 * f.r];
    var b = bbox(f); return [b.x1 - b.x0, b.y1 - b.y0];
  }

  function toLatLon(x, y) {
    var g = G.georef;
    return [g.lat[0] + g.lat[1] * x + g.lat[2] * y, g.lon[0] + g.lon[1] * x + g.lon[2] * y];
  }
  function fromLatLon(lat, lon) {
    var g = G.georef, a = g.lat[1], b = g.lat[2], c = g.lon[1], d = g.lon[2], det = a * d - b * c;
    var u = lat - g.lat[0], v = lon - g.lon[0];
    return [(d * u - b * v) / det, (a * v - c * u) / det];
  }
  function toUTM(x, y) {
    var u = G.georef.utm, t = u.theta;
    return [u.origin[0] + 0.3048 * (x * Math.cos(t) - y * Math.sin(t)), u.origin[1] - 0.3048 * (x * Math.sin(t) + y * Math.cos(t))];
  }
  function fromUTM(E, N) {
    var u = G.georef.utm, t = u.theta, dx = (E - u.origin[0]) / 0.3048, dy = (N - u.origin[1]) / 0.3048;
    return [dx * Math.cos(t) - dy * Math.sin(t), -dx * Math.sin(t) - dy * Math.cos(t)];
  }
  function mapsLink(x, y) {
    var ll = toLatLon(x, y);
    return 'https://www.google.com/maps/search/?api=1&query=' + ll[0].toFixed(6) + ',' + ll[1].toFixed(6);
  }

  // Ground elevation from data/site_terrain.js (load that file too); NaN when it is not loaded.
  function elevationM(x, y) {
    var T = root.SITE_TERRAIN;
    if (!T) return NaN;
    var g = T.grid, fx = Math.min(Math.max((x - g.x0) / g.step, 0), g.nx - 1.001), fy = Math.min(Math.max((y - g.y0) / g.step, 0), g.ny - 1.001);
    var j = Math.floor(fx), i = Math.floor(fy), tx = fx - j, ty = fy - i, z = g.z, n = g.nx;
    return g.base + (z[i * n + j] * (1 - tx) * (1 - ty) + z[i * n + j + 1] * tx * (1 - ty) + z[(i + 1) * n + j] * (1 - tx) * ty + z[(i + 1) * n + j + 1] * tx * ty) / 100;
  }
  function elevationFt(x, y) { return elevationM(x, y) * M_TO_FT; }

  root.SiteGrid = {
    data: G, cell: CELL, cellOf: cellOf, cellBounds: cellBounds, cellCenter: cellCenter, ref: ref, inLot: inLot,
    feature: feature, features: features, bbox: bbox, center: center, size: size, cellsOf: cellsOf, treeXY: treeXY,
    toLatLon: toLatLon, fromLatLon: fromLatLon, toUTM: toUTM, fromUTM: fromUTM, mapsLink: mapsLink,
    elevationM: elevationM, elevationFt: elevationFt
  };
})(typeof window !== 'undefined' ? window : globalThis);
