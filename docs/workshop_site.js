// The workshop on the homestead: a plan of the pad and its surroundings drawn from the site grid (data/site.json), with the building from the model.
// Part of WorkshopDraw; workshop_draw.js loads first, and the page loads data/site_grid.js so that SiteGrid exists.
(function (root) {
'use strict';
const D = root.WorkshopDraw;
if (!D || !D.kit) throw new Error('Load workshop_draw.js before workshop_site.js');
const { rect, line, poly, polyline, circle, path, text, lines, svg, dimV, dimH, mk, arrow, compass, scaleBar } = D.kit;

// The part of the lot that is drawn, in lot feet.
const WINDOW = Object.freeze({ x0: 0, x1: 150, y0: 828, y1: 934 });

function sitePlan(m, grid = root.SiteGrid) {
  if (!grid) throw new Error('Load data/site_grid.js before drawing the site plan');
  const s = 6, ox = 36, oy = 78, o = [];
  const X = x => ox + (x - WINDOW.x0) * s, Y = y => oy + (y - WINDOW.y0) * s;
  const F = id => grid.feature(id);
  const box = (f, cls, a = {}) => rect(X(f.x0), Y(f.y0), (f.x1 - f.x0) * s, (f.y1 - f.y0) * s, cls, a);
  const stroke = (f, color) => polyline(f.pts.map(p => [X(p[0]), Y(p[1])]), 'c-road-line', { stroke: color, 'stroke-width': f.width * s });
  const W = (WINDOW.x1 - WINDOW.x0) * s, H = (WINDOW.y1 - WINDOW.y0) * s;
  o.push(text(ox + W / 2, 22, 'WHERE THE WORKSHOP GOES — THE PAD AND ITS SURROUNDINGS', 't-title t-m'));
  o.push(`<defs><clipPath id="ws-site-clip"><rect x="${ox}" y="${oy}" width="${W}" height="${H}"/></clipPath></defs>`, '<g clip-path="url(#ws-site-clip)">');
  o.push(rect(ox, oy, W, H, 'c-ground'));
  // the 50 ft master grid with its cell names
  for (let x = Math.ceil(WINDOW.x0 / 50) * 50; x <= WINDOW.x1; x += 50) o.push(line(X(x), oy, X(x), oy + H, 'c-grid'));
  for (let y = Math.ceil(WINDOW.y0 / 50) * 50; y <= WINDOW.y1; y += 50) o.push(line(ox, Y(y), ox + W, Y(y), 'c-grid'));
  for (let x = 0; x < WINDOW.x1; x += 50) for (let y = Math.floor(WINDOW.y0 / 50) * 50; y < WINDOW.y1; y += 50) {
    o.push(text(Math.max(X(x), ox) + 4, Math.max(Y(y), oy) + 11, grid.cellOf(x + 1, y + 1), 't-s t-faint'));
  }
  // drives and paths, the yard, and the house pad
  ['loop_path', 'path_workshop', 'path_rv'].forEach(id => o.push(stroke(F(id), '#DDD0B8')));
  o.push(poly(F('house_pad').pts.map(p => [X(p[0]), Y(p[1])]), 'c-pad'));
  o.push(box(F('workshop_pad'), 'c-pad'), box(F('rv_pad'), 'c-pad'));
  // water lines and the hydrant
  [F('water_tee_west'), F('water_main')].forEach(f => o.push(polyline(f.pts.map(p => [X(p[0]), Y(p[1])]), f.size_in >= 2 ? 'c-water2' : 'c-water')));
  const hyd = F('hydrant_west');
  o.push(circle(X(hyd.x), Y(hyd.y), 6, 'c-water2', { fill: '#1B4F9C' }), text(X(hyd.x), Y(hyd.y) + 3, 'H', 't-s t-m t-white t-b'));
  o.push(text(X(30), Y(890) - 4, '1.5″ water line, buried', 't-s t-blue'), text(X(96), Y(886) + 12, '2″ main', 't-s t-blue'));
  // the buildings that are there: containers, pump house, tank, the RV
  o.push(box(F('container_solar'), 'c-solar'), box(F('pump_house'), 'c-pump'));
  const tank = F('irrigation_tank');
  o.push(circle(X(tank.cx), Y(tank.cy), tank.r * s, 'c-tank'), box(F('rv'), 'c-vehicle', { rx: 2 }));
  o.push(text(X(43.5), Y(932) - 4, 'solar container', 't-s t-m'), text(X(73), Y(913) - 5, 'pump house', 't-s t-m'), text(X(63), Y(925) + 18, 'tank', 't-s t-m'), text(X(103.5), Y(900) + 3, 'RV', 't-s t-m'));
  const rvPad = F('rv_pad');
  o.push(text(X(104), Y(rvPad.y1) + 12, 'RV pad', 't-s t-m'));
  // the planned house and garage
  ['house', 'garage'].forEach(id => o.push(box(F(id), 'c-planned')));
  o.push(text(X(F('house').x0) + 6, Y(F('house').y0) + 13, 'house (planned)', 't-s'));
  // the workshop: walls, ridge, the east door, the apron, the deck, and the hoist
  const ws = F('workshop'), cy = (ws.y0 + ws.y1) / 2;
  const dy0 = ws.y0 + m.doorY0, dy1 = ws.y0 + m.doorY1;
  o.push(rect(X(ws.x1), Y(dy0), 20 * s, (dy1 - dy0) * s, 'c-conc', { opacity: 0.85 }));
  o.push(box(ws, 'c-wall'), line(X(ws.x0), Y(cy), X(ws.x1), Y(cy), 'c-ridge'));
  o.push(rect(X(ws.x1), Y(dy0), m.deck.depth * s, (dy1 - dy0) * s, 'c-deck'), line(X(ws.x1), Y(dy0), X(ws.x1), Y(dy1), 'l-door'));
  o.push(text(X(ws.x0 + m.length / 2), Y(cy) - 5, `WORKSHOP ${m.width} × ${m.length}`, 't-m t-b t-white'), text(X(ws.x0 + m.length / 2), Y(cy) + 9, 'planned for 2028', 't-s t-m t-white'));
  o.push(lines(X(ws.x1 + 11), Y(cy) - 3, ['apron'], 't-s'));
  // the pad's fill: almost 2 ft at the north edge and 6 in to 1 ft at the south edge
  const pad = F('workshop_pad');
  o.push(text(X(pad.x0) + 4, Y(pad.y0) - 5, 'level pad of imported fill: almost 2′ thick on this north edge', 't-s t-b'));
  o.push(text(X(pad.x0) + 4, Y(pad.y1) + 12, '6″ to 1′ of fill on this south edge', 't-s t-b'));
  // distances to the neighbors
  const south = ws.y1, px = 72.5;
  o.push(dimV(X(px), Y(south), Y(F('pump_house').y0), `${(F('pump_house').y0 - south).toFixed(1)} ft`, { right: true }));
  o.push(dimV(X(44), Y(south), Y(F('container_solar').y0), `${(F('container_solar').y0 - south).toFixed(0)} ft`, {}));
  o.push(dimV(X(20), Y(pad.y0), Y(pad.y1), `${pad.y1 - pad.y0} ft pad`, {}));
  o.push(dimH(X(pad.x0), X(pad.x1), Y(pad.y0) - 30, `${pad.x1 - pad.x0} ft pad`, {}));
  // how the camper gets in: along the RV path to the apron and west into the door
  o.push(arrow(X(104), Y(cy) + 2, X(ws.x1 + 17), Y(cy) + 2, 'l-arrow'), text(X(104) + 4, Y(cy) - 4, 'camper drives in from the east', 't-s t-red'));
  o.push(text(X(97), Y(850) - 3, 'path to the workshop pad', 't-s t-i'));
  o.push('</g>');
  // the west fence, true north, and the scale
  o.push(line(ox, oy, ox, oy + H, 'l-wall'), text(ox + 4, oy + H + 14, 'west fence (x = 0)', 't-s'));
  o.push(rect(ox, oy, W, H, 'l-wall', { fill: 'none', 'stroke-width': 1 }));
  o.push(compass(ox + W + 46, oy + 40), scaleBar(ox + W - 90, oy + H + 26, s, 10));
  return svg(ox + W + 100, oy + H + 56, o, 'Site plan of the workshop pad on the homestead');
}

root.WorkshopDraw = Object.assign(root.WorkshopDraw, { sitePlan, SITE_WINDOW: WINDOW });
})(typeof window !== 'undefined' ? window : globalThis);
