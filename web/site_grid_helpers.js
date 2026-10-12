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

  function siteRef(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('SiteRef coordinates must be finite numbers');
    if (!inLot(x, y)) throw new Error('SiteRef coordinates are outside the fenced lot');
    var x100 = Math.round(x * 100), y100 = Math.round(y * 100);
    var cell = cellOf(x100 / 100, y100 / 100), b = cellBounds(cell);
    return cell + '-E' + (x100 - b.x0 * 100) / 100 + '-S' + (y100 - b.y0 * 100) / 100;
  }
  function fromSiteRef(code) {
    if (typeof code !== 'string') throw new Error('Not a SiteRef: ' + code);
    if (code.trim().toUpperCase() === 'PENDING') return null;
    var m = /^\s*([A-Za-z]\d{1,2})-E(\d+(?:\.\d{1,2})?)-S(\d+(?:\.\d{1,2})?)\s*$/i.exec(code);
    if (!m) throw new Error('Not a SiteRef: ' + code);
    var b = cellBounds(m[1]), east = Number(m[2]), south = Number(m[3]);
    if (east >= CELL || south >= CELL) throw new Error('SiteRef offsets must be less than ' + CELL + ' ft');
    var x = b.x0 + east, y = b.y0 + south;
    if (!inLot(x, y)) throw new Error('SiteRef is outside the fenced lot: ' + code);
    return [x, y];
  }

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
    siteRef: siteRef, fromSiteRef: fromSiteRef,
    feature: feature, features: features, bbox: bbox, center: center, size: size, cellsOf: cellsOf, treeXY: treeXY,
    toLatLon: toLatLon, fromLatLon: fromLatLon, toUTM: toUTM, fromUTM: fromUTM, mapsLink: mapsLink,
    elevationM: elevationM, elevationFt: elevationFt
  };
})(typeof window !== 'undefined' ? window : globalThis);
