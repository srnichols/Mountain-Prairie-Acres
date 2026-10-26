// Shared numbers, geometry, and drawings for the three greenhouse pages: the site plan, the gothic tunnel, and the pit greenhouse.
// The pages take every figure from the constants and functions below, so their text, tables, and drawings cannot drift apart.
// Load data/site_grid.js, data/site_terrain.js, and data/site_climate.js first. This file is ASCII only; \u escapes stand for the symbols.
(function (root) {
'use strict';

const SVG_NS = 'http://www.w3.org/2000/svg';
const D2R = Math.PI / 180;
const M_TO_FT = 3.28084;
const SYM = { times: '\u00d7', deg: '\u00b0', minus: '\u2212', ndash: '\u2013', arrow: '\u2192', half: '\u00bd' };

const SWELL = 1.25;            // loose soil takes about 25 percent more room than soil in the ground
const ORCHARD_EDGE_Y = root.SiteGrid.feature('orchard_area').y1; // planned south edge of the orchard strip (lot feet)
const R1_Y = root.SiteGrid.data.orchard.r1_y;                    // the R1 trunks, from the same site data the maps use
// Ground that drains toward the pit's uphill sides: lidar flow paths (D8, depressions filled) on the 5 ft cells that enter the open cut
// or a 10 ft margin around it, where the diversion swale runs, from the south or east. Rough: it moves by a few thousand sq ft with the margin.
const UPSLOPE_SQFT = 14600;
const ALLEY = { x0: 25, x1: 32 };   // the windbreak's tractor alley: the hazelnut row's edge (x 20 + 5) to the C1 limb line (trunks at x 38, less a 6 ft allowance), from data/orchard.json
const SWALE = {                      // schematic routes, not a survey: the toe swale along the tunnel's south wall and the uphill diversion swale that carries both to the windbreak's south end
  toe: [[141, 655], [100, 655], [60, 654.5], [44, 655], [35, 658], [28, 664]],
  diversion: [[178, 722], [130, 721], [92, 720], [60, 720], [44, 718], [34, 710], [30, 698], [29, 680], [28, 664], [26, 645], [21, 622], [17, 601]]
};

/* ---------- design numbers, in feet; lot coordinates are x east of the west fence and y south of the north fence ---------- */
const GOTHIC = {
  x0: 37, x1: 113, y0: 620, y1: 647,      // 76 ft long east to west, 27 ft wide north to south; the west end stands 37 ft off the west fence, beside the alley
  peak: 12, baseAngleDeg: 78,             // peak height and the angle of the hoop at the ground (read from the vendor's end-wall drawing)
  kitLength: 38, hoopSpacingIn: [45.5, 80], doorIn: 80, chordFt: 7, kitPriceUsd: 10500
};
GOTHIC.length = GOTHIC.x1 - GOTHIC.x0;
GOTHIC.span = GOTHIC.y1 - GOTHIC.y0;
GOTHIC.centerX = (GOTHIC.x0 + GOTHIC.x1) / 2;
const EAST = root.SiteGrid.feature('greenhouse_gothic_east'); // the pit is centered on this twin, not on GOTHIC
GOTHIC.ridgeY = (GOTHIC.y0 + GOTHIC.y1) / 2;
GOTHIC.footprint = GOTHIC.length * GOTHIC.span;

// The vendor's two end-wall drawings, scaled to the 27 ft span and the 12 ft peak. Only the 80 in door height and the 3.5 ft vent width are written on them,
// so every other size here is good to a few inches. Posts stand about 3.5 ft apart from the center line and the rails about 3 ft apart.
const ENDWALL = {
  post: 3.5, rail: 3,
  wide: { w: 7, h: 7 },                                    // the wide door fills the center bay, between post lines 3.5 ft either side of the center line
  standard: { w: 3.3, h: GOTHIC.doorIn / 12, from: 3.6 },  // the standard door stands in the next bay, 3.6 to 6.9 ft off the center line
  vent: { w: 3.5, h: 3.3, bottom: 7.3 },                   // one peak vent in each end wall, centered in the center bay, 7.3 to 10.6 ft up
  ends: { west: 'wide', east: 'wide' }                     // this draft's choice: the wide door at both ends, so a cart can run the full length and leave by the other end
};
ENDWALL.ventTop = ENDWALL.vent.bottom + ENDWALL.vent.h;

// Bed layout rules, in feet. Only people and carts go inside the tunnel: no tractor, so no lane wider than a cart needs.
// UGA Extension plans adult beds 4 ft wide so no one has to step in, calls 18 to 24 in paths ideal and 12 in the absolute minimum, and allows 4 ft between beds for carts, wheelbarrows, and wheelchairs.
// Purdue's Indiana High Tunnel Handbook shows 24 to 36 in beds, 12 to 24 in walkways, and a 3 ft alley along each end wall. A bed against the wall is reached from one side only, so it gets half the 4 ft.
const BEDS = {
  edge: 2, inner: 4, bedMin: 2,                  // widest bed against a wall, widest bed with a walking row on each side, narrowest bed
  row: 1.5, endAisle: 3, cart: 4,                // narrowest walking row, the cross aisle along each end wall, the cart lane on the center line
  gap: 0.25, step: 0.25, tries: [3, 10]          // least gap between a wall and the first bed, bed widths in quarter-foot steps, numbers of beds tried
};
BEDS.length = GOTHIC.length - 2 * BEDS.endAisle; // the beds stop at the end aisles

// Where an end door stands across the width, as distances from the north wall (kind is 'wide' or 'standard')
function endDoorSpan(kind) {
  const half = GOTHIC.span / 2, E = ENDWALL;
  return kind === 'wide' ? [half - E.wide.w / 2, half + E.wide.w / 2] : [half + E.standard.from, half + E.standard.from + E.standard.w];
}

const PIT = {
  x0: 216, x1: 252, y0: 680, y1: 700,     // y0 is the north (berm) wall and y1 the south wall; centered on the east gothic tunnel (both on x 234), 20 ft in from each end
  eave: 0.5, rise: 10, run: 19.5, ventAbove: 4,
  depth: { bed: 4, walk: 6, sink: 6, post: 8 },                    // below the original grade; the owner's depths: beds 4 ft, the cold zone in front 6 ft; the posts end 2 ft below the lowest floor
  northStrip: 2, bedWidth: 12, southWalk: 2, sinkWidth: 4,         // north to south, 20 ft in all
  endWalk: 2, bedLength: 15, centerWalk: 2,                        // west to east, 36 ft in all
  postSpacing: 4, drums: 15, drumGal: 55
};
PIT.length = PIT.x1 - PIT.x0;
PIT.width = PIT.y1 - PIT.y0;
PIT.northHeight = PIT.eave + PIT.rise;                // the roof at the north wall, above grade
PIT.ventTop = PIT.northHeight + PIT.ventAbove;
PIT.angleDeg = Math.atan2(PIT.rise, PIT.run) / D2R;
PIT.roofLength = Math.hypot(PIT.rise, PIT.run);
PIT.postRows = Math.round(PIT.width / PIT.postSpacing) + 1;
PIT.postColumns = Math.round(PIT.length / PIT.postSpacing) + 1;
PIT.centerX = (PIT.x0 + PIT.x1) / 2;
PIT.stair = (function () {                              // from grade to the floor: rises no taller than 7.75 in, treads 10 in deep
  const dropIn = PIT.depth.sink * 12, steps = Math.ceil(dropIn / 7.75);
  return { steps, riseIn: dropIn / steps, treadIn: 10, runFt: (steps - 1) * 10 / 12 };
})();

const BERM = { crest: PIT.northHeight, top: 2, slope: 2, wall: 3, wallThick: 1 };   // slope is feet across for each foot up; a retaining wall of height wall holds the berm's foot, so the slope stops at the top of the wall instead of running out to the ground
BERM.run = BERM.slope * (BERM.crest - BERM.wall);                // the sloped face runs from the flat top down to the top of the wall
BERM.toeY = PIT.y0 - BERM.top - BERM.run;                        // the berm's foot, the outer face of the wall
BERM.endX0 = PIT.x0 - BERM.run;
BERM.endX1 = PIT.x1 + BERM.run;
BERM.wallLength = PIT.length + Math.PI * BERM.run + 2 * BERM.top;   // along the north face, around the two quarter-circle ends, and back along each end to the pit's north wall line

const SECTION_X = GOTHIC.centerX;      // the north-south section is cut along the tunnel's middle line, which is also the pit's

const SOIL = { frostIn: 30, boundaryIn: 42, rockFt: 10 };        // county frost depth, clay loam over sandy loam (NRCS), rock depth (owner's note)
const CUT = { type: { A: 0.75, B: 1, C: 1.5 } };                 // OSHA Appendix B: feet across for each foot of depth

/* ---------- small helpers ---------- */
function svgNode(tag, attrs = {}, text) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  if (text !== undefined) node.textContent = text;
  return node;
}
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = text;
  if (className) node.className = className;
  return node;
}
const fmt = (value, digits = 0) => Number(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const num = value => String(+Number(value).toFixed(2));          // 3.75 -> "3.75", 1.50 -> "1.5", 3 -> "3"
const feet = value => `${fmt(value, Math.abs(value % 1) > 0.05 ? 1 : 0)} ft`;
const groundFt = (x, y) => root.SiteGrid.elevationFt(x, y);
function setText(values) {
  Object.entries(values).forEach(([id, value]) => {
    const node = document.getElementById(id);
    if (!node) throw new Error(`The page has no element with id ${id}`);
    node.textContent = value;
  });
}

/* ---------- the gothic hoop: two circular arcs meeting at the peak ---------- */
const ARCH = (function () {
  const half = GOTHIC.span / 2, tb = GOTHIC.baseAngleDeg * D2R, s = Math.sin(tb), c = Math.cos(tb);
  const radius = (half * half + GOTHIC.peak * GOTHIC.peak) / (2 * half * s - 2 * GOTHIC.peak * c);
  const cx = -half + radius * s, cy = -radius * c;      // centre of the arc that springs from the near wall, measured from the centre line and the floor
  function height(d) {                                    // height above the floor at d feet from the nearer side wall
    const t = Math.min(Math.max(Math.min(d, GOTHIC.span - d), 0), half);
    const u = (t - half) - cx;
    return cy + Math.sqrt(Math.max(radius * radius - u * u, 0));
  }
  const N = 2000;
  let length = 0, area = 0, prev = [0, height(0)];
  for (let i = 1; i <= N; i++) {
    const d = GOTHIC.span * i / N, h = height(d);
    length += Math.hypot(d - prev[0], h - prev[1]);
    area += (h + prev[1]) / 2 * (d - prev[0]);
    prev = [d, h];
  }
  return { radius, height, length, area, glazing: length * GOTHIC.length, volume: area * GOTHIC.length, meanHeight: area / GOTHIC.span };
})();
// How far in from the nearer side wall the hoop reaches height v, and the lowest and highest roof over a strip between two distances from the north wall
function archReach(v) {
  let lo = 0, hi = GOTHIC.span / 2;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (ARCH.height(mid) < v) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
function roofRange(v0, v1) {
  const half = GOTHIC.span / 2;
  return [Math.min(ARCH.height(v0), ARCH.height(v1)), v0 < half && v1 > half ? GOTHIC.peak : Math.max(ARCH.height(v0), ARCH.height(v1))];
}

/* ---------- sun and shadow ---------- */
const SUN_DATES = { dec21: { label: 'Dec 21', key: 'december-solstice' }, feb1: { label: 'Feb 1', declination: -17.5 }, mar1: { label: 'Mar 1', declination: -8 }, mar21: { label: 'Mar 21', key: 'march-equinox' } };
function latitude() { return root.SiteClimate.data.site.latitude; }
function declinationOf(date) {                // the sun's declination from the climate page's noon altitude: altitude = 90 - latitude + declination
  const entry = SUN_DATES[date];
  if (entry.declination !== undefined) return entry.declination;
  return root.SiteClimate.data.daylight.key_dates.find(item => item.id === entry.key).noon_altitude_deg + latitude() - 90;
}
function sunPosition(declinationDeg, solarHour) {   // az is measured from due south, positive toward the west
  const H = 15 * (solarHour - 12) * D2R, phi = latitude() * D2R, dl = declinationDeg * D2R;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dl) + Math.cos(phi) * Math.cos(dl) * Math.cos(H));
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dl) * Math.cos(phi));
  return { alt: alt / D2R, az: az / D2R, bearing: (180 + az / D2R + 360) % 360 };
}
const tanNorthSouth = sun => Math.tan(sun.alt * D2R) / Math.cos(sun.az * D2R);   // how steeply the sun's rays fall as seen from the east
let SITE_CACHE = null;
function site() {
  if (!SITE_CACHE) {
    const ground = u => groundFt(SECTION_X, u);
    const pad = padCutFill(GOTHIC.x0, GOTHIC.x1, GOTHIC.y0, GOTHIC.y1);
    SITE_CACHE = { ground, pad, zTunnel: pad.mean, zPit: (ground(PIT.y0) + ground(PIT.y1)) / 2, southSlope: (ground(PIT.y1) - ground(GOTHIC.y0)) / (PIT.y1 - GOTHIC.y0) };
  }
  return SITE_CACHE;
}
// Where a ray from (u, v) lands on the ground when it runs north (decreasing u) falling t feet for each foot; the ground is read along the section line.
function shadowTip(u, v, t, ground) {
  for (let w = u; w > u - 140; w -= 0.1) if (v - t * (u - w) <= ground(w)) return w;
  return u - 140;
}
function tunnelShadowTip(sun) {
  const s = site(), t = tanNorthSouth(sun);
  let best = Infinity;
  for (let d = 0; d <= GOTHIC.span / 2 + 1e-9; d += 0.25) best = Math.min(best, shadowTip(GOTHIC.y0 + d, s.zTunnel + ARCH.height(d), t, s.ground));
  return best;
}
function bermShadowTip(sun) {
  const s = site();
  return shadowTip(PIT.y0 - BERM.top, s.zPit + BERM.crest, tanNorthSouth(sun), s.ground);   // the north edge of the flat top casts the shadow: every ray that clears that edge has already cleared the rest of the top
}
// A crest position for the berm: where its foot (the face of the retaining wall) lands at a given slope, how much room is left to the tunnel wall, and where the Dec 21 noon shadow ends.
function bermOption(crestY, slope = 2) {
  const s = site(), sun = sunPosition(declinationOf('dec21'), 12);
  const toe = crestY - BERM.top - slope * (BERM.crest - BERM.wall);
  const crestZ = s.zPit + s.ground(crestY) - s.ground(PIT.y0) + BERM.crest;      // the crest stands BERM.crest above the pit's level, moved with the lie of the land
  return { crestY, southWall: crestY + PIT.width, toe, clear: toe - GOTHIC.y1, noonTip: shadowTip(crestY - BERM.top, crestZ, tanNorthSouth(sun), s.ground) };
}
// Shadows slide sideways as the sun swings: a shadow that has run dy feet north lands dy * tan(azimuth) feet east of its source, so west in the morning and east in the afternoon.
const slide = (sun, dy) => dy * Math.tan(sun.az * D2R);
const overlap = (a0, a1, b0, b1) => { const lo = Math.max(a0, b0), hi = Math.min(a1, b1); return hi > lo ? [lo, hi] : null; };
function shadowRow(date, hour) {
  const sun = sunPosition(declinationOf(date), hour), tunnelTip = tunnelShadowTip(sun), bermTip = bermShadowTip(sun);
  const crestN = PIT.y0 - BERM.top;
  const wallShift = slide(sun, crestN - EAST.y1), r1Shift = slide(sun, GOTHIC.ridgeY - R1_Y);
  const wallX = bermTip < EAST.y1 ? overlap(PIT.x0 + wallShift, PIT.x1 + wallShift, EAST.x0, EAST.x1) : null;   // where the berm's shadow lies on the east tunnel's south wall, if it does
  return { date, hour, sun, tunnelTip, tunnelReach: GOTHIC.y0 - tunnelTip, bermTip, bermReach: crestN - bermTip, wallX, bermOnTunnel: wallX ? EAST.y1 - bermTip : 0,
    r1X: [GOTHIC.x0 + r1Shift, GOTHIC.x1 + r1Shift] };
}
// On Dec 21, the solar hours around noon between which the berm's shadow stays off the tunnel's south wall.
function bermClearWindow() {
  const hours = [];
  for (let k = 8 * 12; k <= 16 * 12; k++) if (sunPosition(declinationOf('dec21'), k / 12).alt >= 3) hours.push(k / 12);
  const clear = hours.map(h => shadowRow('dec21', h).bermOnTunnel === 0);
  let a = hours.findIndex(h => h >= 12), b = a;
  while (a > 0 && clear[a - 1]) a--;
  while (b < hours.length - 1 && clear[b + 1]) b++;
  return { from: hours[a], to: hours[b] };
}
// On Dec 21, the solar hours up to which, and from which, the tunnel's shadow reaches the R1 trunks.
function r1ShadeHours() {
  let before = null, after = null;
  for (let k = 8 * 12; k <= 16 * 12; k++) {
    const h = k / 12, sun = sunPosition(declinationOf('dec21'), h);
    if (sun.alt < 3 || tunnelShadowTip(sun) > R1_Y) continue;
    if (h < 12) before = h; else if (after === null) after = h;
  }
  return { before, after };
}
const clock = hour => `${Math.floor(hour)}:${String(Math.round((hour % 1) * 60)).padStart(2, '0')}`;
// Share of the direct beam that a surface tilted tiltDeg (facing south) catches, against one square to the sun.
const beamShare = (tiltDeg, altDeg) => Math.max(Math.cos(((90 - tiltDeg) - altDeg) * D2R), 0);

/* ---------- ground, earthwork, and water ---------- */
function fitPlane(x0, x1, y0, y1, step = 2) {
  const pts = [];
  for (let x = x0; x <= x1 + 1e-9; x += step) for (let y = y0; y <= y1 + 1e-9; y += step) pts.push([x, y, groundFt(x, y)]);
  const n = pts.length, mx = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + p[1], 0) / n, mz = pts.reduce((a, p) => a + p[2], 0) / n;
  let sxx = 0, syy = 0, sxz = 0, syz = 0;
  pts.forEach(([x, y, z]) => { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxz += (x - mx) * (z - mz); syz += (y - my) * (z - mz); });
  const zs = pts.map(p => p[2]);
  return { east: sxz / sxx, south: syz / syy, mean: mz, low: Math.min(...zs), high: Math.max(...zs) };   // slopes are feet per foot; positive means the ground rises that way
}
function padCutFill(x0, x1, y0, y1, step = 1) {
  const zs = [];
  for (let x = x0; x <= x1 + 1e-9; x += step) for (let y = y0; y <= y1 + 1e-9; y += step) zs.push(groundFt(x, y));
  const mean = zs.reduce((a, b) => a + b, 0) / zs.length;
  return { mean, cutCuYd: zs.reduce((a, z) => a + Math.max(z - mean, 0), 0) * step * step / 27, high: Math.max(...zs) - mean, low: mean - Math.min(...zs) };
}
function pitExcavation() {
  const L = PIT.length, d = PIT.depth;
  const parts = [
    ['Cold zone', L * PIT.sinkWidth, d.sink], ['South walk', L * PIT.southWalk, d.walk], ['North strip (drums)', L * PIT.northStrip, d.walk],
    ['Center walk', PIT.centerWalk * PIT.bedWidth, d.walk], ['End walks (two)', 2 * PIT.endWalk * PIT.bedWidth, d.walk], ['Beds (two)', 2 * PIT.bedLength * PIT.bedWidth, d.bed]
  ].map(([name, area, depth]) => ({ name, area, depth, cuFt: area * depth }));
  const cuFt = parts.reduce((a, p) => a + p.cuFt, 0);
  return { parts, cuFt, cuYd: cuFt / 27, looseCuYd: cuFt / 27 * SWELL };
}
// The berm: a flat top along the north wall with its north face and both ends sloping down at BERM.slope to the top of the retaining wall at its foot.
// Pass wall = 0 for the berm that would taper all the way to the ground, to see how much soil the wall saves.
function bermVolume(step = 0.1, wall = BERM.wall) {
  const { crest, top, slope } = BERM, run = slope * (crest - wall), xa = PIT.x0, xb = PIT.x1, yc = PIT.y0;
  let cuFt = 0, prism = 0;
  for (let y = yc - top - run; y < yc; y += step) for (let x = xa - run; x < xb + run; x += step) {
    const px = x + step / 2, py = y + step / 2;
    const dist = Math.hypot(Math.max(xa - px, 0, px - xb), Math.max((yc - top) - py, 0));
    const h = dist <= run ? crest - dist / slope : 0;
    cuFt += h * step * step;
    if (px >= xa && px <= xb) prism += h * step * step;
  }
  return { cuFt, cuYd: cuFt / 27, straightCuYd: prism / 27, endsCuYd: (cuFt - prism) / 27 };
}
// The berm's outline on the ground, which is the line of the retaining wall: the 2 ft returns at the pit's north wall line, the quarter-circle ends, and the north face.
function bermOutline(arcSteps = 30) {
  const R = BERM.run, cy = PIT.y0 - BERM.top, pts = [[BERM.endX0, PIT.y0], [BERM.endX0, cy]];
  for (let k = 1; k <= arcSteps; k++) { const a = k / arcSteps * Math.PI / 2; pts.push([PIT.x0 - R * Math.cos(a), cy - R * Math.sin(a)]); }
  for (let k = 0; k <= arcSteps; k++) { const a = k / arcSteps * Math.PI / 2; pts.push([PIT.x1 + R * Math.sin(a), cy - R * Math.cos(a)]); }
  pts.push([BERM.endX1, cy], [BERM.endX1, PIT.y0]);
  return pts;
}
function openCut(type = 'C') {
  const k = CUT.type[type], d = PIT.depth;
  return { south: k * d.sink, other: k * d.walk, x0: PIT.x0 - k * d.walk, x1: PIT.x1 + k * d.walk, y0: PIT.y0 - k * d.walk, y1: PIT.y1 + k * d.sink };
}
// How close the retaining wall's line comes to the top edge of the open cut (at the cut's two north corners).
function wallToCut() {
  const cut = openCut('C');
  return Math.min(...bermOutline(90).map(([x, y]) => Math.hypot(Math.max(cut.x0 - x, 0, x - cut.x1), Math.max(cut.y0 - y, 0, y - cut.y1))));
}
// The least distances from the diversion swale's schematic route to the tunnel, the open cut, the berm's foot, and the hydrant.
function swaleClearance() {
  const cut = openCut('C'), h = root.SiteGrid.feature('hydrant_fence_north'), berm = bermOutline();
  const boxDist = (x, y, b) => Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.y0 - y, 0, y - b.y1));
  const segDist = (x, y, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
  };
  const least = { tunnel: Infinity, cut: Infinity, berm: Infinity, hydrant: Infinity };
  SWALE.diversion.slice(1).forEach((b, i) => {
    const a = SWALE.diversion[i], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2);
    for (let k = 0; k <= n; k++) {
      const x = a[0] + (b[0] - a[0]) * k / n, y = a[1] + (b[1] - a[1]) * k / n;
      least.tunnel = Math.min(least.tunnel, boxDist(x, y, GOTHIC));
      least.cut = Math.min(least.cut, boxDist(x, y, cut));
      least.hydrant = Math.min(least.hydrant, Math.hypot(x - h.x, y - h.y));
      for (let m = 1; m < berm.length; m++) least.berm = Math.min(least.berm, segDist(x, y, berm[m - 1], berm[m]));
    }
  });
  return least;
}
function runoffInches(rainIn, curveNumber) {            // SCS curve number method
  const s = 1000 / curveNumber - 10, ia = 0.2 * s;
  return rainIn <= ia ? 0 : (rainIn - ia) ** 2 / (rainIn + 0.8 * s);
}
const gallons = (areaSqFt, inches) => areaSqFt * inches / 12 * 7.48052;
function annualRainIn() { return root.WATER_HARVESTING.months.reduce((a, m) => a + m.precipitation_in, 0); }

/* ---------- drawing ---------- */
const C = {
  ground: '#F6F3EA', neighbor: '#ECE9DF', contour: '#9A8670', grid: 'rgba(60,60,60,0.28)', gridLabel: '#9A988F', fence: '#6B5A45',
  orchardFill: '#EEF5E8', orchardEdge: '#888780', tree: '#CFE3C0', treeEdge: '#7BA15A',
  glass: '#1D6F96', glassFill: 'rgba(80,160,200,0.18)', earth: '#D9C7A0', earthEdge: '#A8906A', crest: '#C2A972', cut: '#B59B6A', wall: '#4D4B45',
  water: '#2B8FD6', waterLine: '#1B4F9C', sun: '#D9822B', shed: '#A9372B', road: '#DDD0B8', roadEdge: '#B6A385', flag: '#C2412F',
  post: '#5C3F22', sunk: '#8A8A84', drum: '#4F6F87', bed: '#7BA05B', sink: '#A9D0E1', walk: '#C4A574', soil: '#E6DCC3', soilLine: '#B49C74', ink: '#2C2C2A'
};
function canvas(opts) {
  const { u0, u1, v0, v1, scale: S, margin: m = { l: 8, r: 8, t: 8, b: 8 }, up = false, title } = opts;
  const W = (u1 - u0) * S + m.l + m.r, H = (v1 - v0) * S + m.t + m.b;
  const X = u => +(m.l + (u - u0) * S).toFixed(2);
  const Y = v => +(m.t + (up ? (v1 - v) : (v - v0)) * S).toFixed(2);
  const svg = svgNode('svg', { viewBox: `0 0 ${+W.toFixed(1)} ${+H.toFixed(1)}`, class: 'diagram', role: 'img', 'aria-label': title });
  svg.append(svgNode('title', {}, title));
  const defs = svgNode('defs');
  svg.append(defs);
  const add = (node, parent = svg) => { parent.append(node); return node; };
  const d = pts => pts.map(([u, v], i) => `${i ? 'L' : 'M'}${X(u)},${Y(v)}`).join('');
  return {
    svg, defs, X, Y, S, W, H, add, d,
    line: (pts, a = {}, p) => add(svgNode('path', { d: d(pts), fill: 'none', ...a }), p),
    poly: (pts, a = {}, p) => add(svgNode('path', { d: `${d(pts)}Z`, ...a }), p),
    rect: (ua, va, ub, vb, a = {}, p) => {
      const xa = X(Math.min(ua, ub)), xb = X(Math.max(ua, ub)), ya = Math.min(Y(va), Y(vb)), yb = Math.max(Y(va), Y(vb));
      return add(svgNode('rect', { x: xa, y: ya, width: +(xb - xa).toFixed(2), height: +(yb - ya).toFixed(2), ...a }), p);
    },
    circle: (u, v, r, a = {}, p) => add(svgNode('circle', { cx: X(u), cy: Y(v), r: +(r * S).toFixed(2), ...a }), p),
    text: (u, v, str, a = {}, p) => add(svgNode('text', { x: X(u), y: Y(v), ...a }, str), p)
  };
}
function hatchPattern(id, color, gap = 6) {
  const pattern = svgNode('pattern', { id, patternUnits: 'userSpaceOnUse', width: gap, height: gap, patternTransform: 'rotate(45)' });
  pattern.append(svgNode('line', { x1: 0, y1: 0, x2: 0, y2: gap, stroke: color, 'stroke-width': 1.5 }));
  return pattern;
}
function arrowMarker(id, color) {
  const marker = svgNode('marker', { id, orient: 'auto', markerWidth: 9, markerHeight: 9, refX: 7, refY: 4.5, markerUnits: 'userSpaceOnUse' });
  marker.append(svgNode('path', { d: 'M0,0 L9,4.5 L0,9 Z', fill: color }));
  return marker;
}
const pathLength = pts => pts.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
/* Contours from the lidar grid: marching squares, then chained into polylines */
function contourLines(levelM, box) {
  const g = root.SITE_TERRAIN.grid, segs = [], v = (i, j) => g.base + g.z[i * g.nx + j] / 100;
  const j0 = Math.max(0, Math.floor((box.x0 - g.x0) / g.step)), j1 = Math.min(g.nx - 1, Math.ceil((box.x1 - g.x0) / g.step));
  const i0 = Math.max(0, Math.floor((box.y0 - g.y0) / g.step)), i1 = Math.min(g.ny - 1, Math.ceil((box.y1 - g.y0) / g.step));
  for (let i = i0; i < i1; i++) for (let j = j0; j < j1; j++) {
    const x0 = g.x0 + j * g.step, y0 = g.y0 + i * g.step, x1 = x0 + g.step, y1 = y0 + g.step, pts = [];
    const cross = (z1, z2, ax, ay, bx, by) => {
      if ((z1 < levelM) !== (z2 < levelM)) { const t = (levelM - z1) / (z2 - z1); pts.push([ax + (bx - ax) * t, ay + (by - ay) * t]); }
    };
    const a = v(i, j), b = v(i, j + 1), c = v(i + 1, j + 1), d = v(i + 1, j);
    cross(a, b, x0, y0, x1, y0); cross(b, c, x1, y0, x1, y1); cross(c, d, x1, y1, x0, y1); cross(d, a, x0, y1, x0, y0);
    if (pts.length === 2) segs.push(pts);
    else if (pts.length === 4) segs.push([pts[0], pts[1]], [pts[2], pts[3]]);
  }
  const key = p => `${p[0].toFixed(3)},${p[1].toFixed(3)}`, ends = new Map();
  segs.forEach((s, k) => s.forEach(p => { const kk = key(p); if (!ends.has(kk)) ends.set(kk, []); ends.get(kk).push(k); }));
  const used = new Array(segs.length).fill(false), lines = [];
  for (let k = 0; k < segs.length; k++) {
    if (used[k]) continue;
    used[k] = true;
    const line = [segs[k][0], segs[k][1]];
    [true, false].forEach(forward => {
      for (;;) {
        const tip = forward ? line[line.length - 1] : line[0];
        const next = (ends.get(key(tip)) || []).find(m => !used[m]);
        if (next === undefined) break;
        used[next] = true;
        const [p, q] = segs[next], np = key(p) === key(tip) ? q : p;
        if (forward) line.push(np); else line.unshift(np);
      }
    });
    lines.push(line);
  }
  return lines;
}

/* ---------- Figure: plan view of the site ---------- */
function siteMap(host) {
  const SG = root.SiteGrid, F = id => SG.feature(id), site0 = site();
  const V = { x0: -6, x1: 290, y0: 556, y1: 772 }, K = 1.4;   // K enlarges the type for the size the figure is shown at; x1 clears the east tunnel and the pit's berm
  const cv = canvas({ u0: V.x0, u1: V.x1, v0: V.y0, v1: V.y1, scale: 4.4, margin: { l: 3, r: 3, t: 3, b: 3 },
    title: 'Plan view, north up, of the greenhouses south of the orchard: the west gothic tunnel in cells A13 to C13 beside the windbreak alley, the east gothic tunnel lined up with the orchard edge, and the pit greenhouse centered on the east tunnel with its earth berm between them, plus the west swales and one-foot lidar contours.' });
  const { svg, defs, X, Y, S, add, line, poly, rect, circle, text } = cv;
  const clip = svgNode('clipPath', { id: 'gh-map-clip' });
  clip.append(svgNode('rect', { x: X(V.x0), y: Y(V.y0), width: (V.x1 - V.x0) * S, height: (V.y1 - V.y0) * S }));
  defs.append(clip, hatchPattern('gh-hatch', '#7A7970'), arrowMarker('gh-arrow-blue', C.water), arrowMarker('gh-arrow-gray', '#5F7F95'));
  const g = add(svgNode('g', { 'clip-path': 'url(#gh-map-clip)' }));
  const label = (u, v, str, cls = '', size = 11, extra = {}) => text(u, v, str, { class: `halo ${cls}`.trim(), 'font-size': +(size * K).toFixed(1), ...extra }, g);
  const vlabel = (u, v, str, cls, size) => { const x = X(u), y = Y(v); return add(svgNode('text', { x, y, transform: `rotate(-90 ${x} ${y})`, 'text-anchor': 'middle', 'font-size': +(size * K).toFixed(1), class: `halo ${cls}` }, str), g); };

  rect(V.x0, V.y0, V.x1, V.y1, { fill: C.ground }, g);
  rect(V.x0, V.y0, 0, V.y1, { fill: C.neighbor }, g);

  // One-foot contours from the lidar, labelled where they cross the east edge
  const box = { x0: V.x0, x1: V.x1, y0: V.y0, y1: V.y1 }, zs = [];
  for (let y = V.y0; y <= V.y1; y += 5) for (let x = 0; x <= V.x1; x += 5) zs.push(SG.elevationFt(x, y));
  const contourLabels = [];
  for (let ft = Math.ceil(Math.min(...zs)); ft <= Math.floor(Math.max(...zs)); ft++) {
    const lines = contourLines(ft / M_TO_FT, box);
    lines.forEach(pts => {
      line(pts, { stroke: C.contour, 'stroke-width': ft % 5 === 0 ? 1.4 : 0.8, opacity: 0.85 }, g);
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        if ((a[0] - 186) * (b[0] - 186) <= 0 && a[0] !== b[0]) { contourLabels.push([ft, a[1] + (b[1] - a[1]) * (186 - a[0]) / (b[0] - a[0])]); break; }
      }
    });
  }
  contourLabels.forEach(([ft, y]) => label(186, y + 2.6, fmt(ft), '', 8.5, { 'text-anchor': 'middle', style: 'fill:#6E5A44;font-weight:600' }));

  // The cells the buildings occupy: the west tunnel in A13 to C13, the east tunnel in D13 to F13, and the pit in E14 to F14
  const inBlock = (x, y) => (y >= 600 && y < 650 && x < 300) || (y >= 650 && y < 700 && x >= 200 && x < 300);
  rect(0, 600, 150, 650, { fill: 'rgba(24,95,165,0.07)', stroke: 'rgba(24,95,165,0.6)', 'stroke-width': 1.6 }, g);
  rect(150, 600, 300, 650, { fill: 'rgba(24,95,165,0.07)', stroke: 'rgba(24,95,165,0.6)', 'stroke-width': 1.6 }, g);
  rect(200, 650, 300, 700, { fill: 'rgba(24,95,165,0.07)', stroke: 'rgba(24,95,165,0.6)', 'stroke-width': 1.6 }, g);
  for (let x = 0; x <= V.x1; x += 50) line([[x, V.y0], [x, V.y1]], { stroke: C.grid, 'stroke-width': 0.9 }, g);
  for (let y = Math.ceil(V.y0 / 50) * 50; y <= V.y1; y += 50) line([[0, y], [V.x1, y]], { stroke: C.grid, 'stroke-width': 0.9 }, g);
  const drawCellLabels = () => {
    for (let x = 0; x < V.x1; x += 50) for (let y = Math.floor(V.y0 / 50) * 50; y < V.y1; y += 50) {
      const ref = SG.cellOf(x + 1, y + 1), block = inBlock(x, y);
      if (ref) label(x + 2, Math.max(y, V.y0) + 7.2, ref, '', block ? 11.5 : 9, { style: block ? 'fill:#185FA5;font-weight:700' : `fill:${C.gridLabel}` });
    }
  };
  line([[0, V.y0], [0, V.y1]], { stroke: C.fence, 'stroke-width': 2.6 }, g);

  // Orchard, west windbreak with its tractor alley, and the first three rows
  rect(35, V.y0, V.x1, R1_Y + 10, { fill: C.orchardFill, stroke: C.orchardEdge, 'stroke-width': 1, 'stroke-dasharray': '5 3' }, g);
  rect(0, V.y0, 35, F('windbreak').y1, { fill: '#CFE3C0', opacity: 0.8 }, g);
  rect(ALLEY.x0, V.y0, ALLEY.x1, F('windbreak').y1, { fill: C.road, opacity: 0.95 }, g);
  vlabel(13, 573, 'west windbreak', 't-note', 9.5);
  vlabel((ALLEY.x0 + ALLEY.x1) / 2 + 0.4, 574, 'tractor alley', 't-note', 9);
  for (let r = 1; r <= 2; r++) {
    for (let c = 1; c <= 13; c++) { const [x, y] = SG.treeXY(r, c); if (x < V.x1 - 2) circle(x, y, 3.2, { fill: C.tree, stroke: C.treeEdge, 'stroke-width': 1 }, g); }
    label(190.5, SG.treeXY(r, 1)[1] + 3, `R${r}`, 't-note', 10, { 'text-anchor': 'end' });
  }
  line([[35, ORCHARD_EDGE_Y], [V.x1, ORCHARD_EDGE_Y]], { stroke: '#77766F', 'stroke-width': 1.3, 'stroke-dasharray': '2 3' }, g);
  label(122, ORCHARD_EDGE_Y + (Math.abs(R1_Y - ORCHARD_EDGE_Y) < 0.5 ? 8 : -2.2),
    Math.abs(R1_Y - ORCHARD_EDGE_Y) < 0.5 ? `R1 trunks on the planned orchard edge, y ${ORCHARD_EDGE_Y}` : `planned orchard edge, y ${ORCHARD_EDGE_Y}`,
    't-note', 10, { 'text-anchor': 'middle' });

  // Yard, water line, hydrant, and the red shed (the nearest power)
  poly(F('yard').pts, { fill: C.road, stroke: C.roadEdge, 'stroke-width': 1.2 }, g);
  line(F('water_line_west').pts, { stroke: C.waterLine, 'stroke-width': 2, 'stroke-dasharray': '8 3' }, g);
  const h = F('hydrant_fence_north');
  circle(h.x, h.y, 2.3, { fill: C.waterLine, stroke: '#fff', 'stroke-width': 1.2 }, g);
  text(h.x, h.y + 1.2, 'H', { 'text-anchor': 'middle', 'font-size': 9.5, style: 'fill:#fff;font-weight:700' }, g);
  label(h.x - 3.6, h.y + 1.2, 'hydrant', 't-water', 9.5, { 'text-anchor': 'end' });
  const sh = F('shed');
  rect(sh.x0, sh.y0, sh.x1, sh.y1, { fill: C.shed, stroke: '#5E1D16', 'stroke-width': 1 }, g);
  text((sh.x0 + sh.x1) / 2, (sh.y0 + sh.y1) / 2 + 2, 'Red shed', { 'text-anchor': 'middle', 'font-size': 14.5, class: 't-white' }, g);
  label(122, 764, 'yard (road mix)', 't-note', 9.5, { 'text-anchor': 'middle' });

  // The tunnel's shadow at solar noon on Dec 21, then the tunnel
  const noon = shadowRow('dec21', 12);
  rect(GOTHIC.x0, GOTHIC.y0, GOTHIC.x1, noon.tunnelTip, { fill: 'url(#gh-hatch)', opacity: 0.5 }, g);
  rect(GOTHIC.x0, GOTHIC.y0, GOTHIC.x1, GOTHIC.y1, { fill: C.glassFill, stroke: C.glass, 'stroke-width': 2.6 }, g);
  line([[GOTHIC.x0, GOTHIC.ridgeY], [GOTHIC.x1, GOTHIC.ridgeY]], { stroke: C.glass, 'stroke-width': 1.1, 'stroke-dasharray': '6 3' }, g);
  line([[GOTHIC.centerX, GOTHIC.y0], [GOTHIC.centerX, GOTHIC.y1]], { stroke: C.glass, 'stroke-width': 0.9, 'stroke-dasharray': '1.5 3' }, g);
  [GOTHIC.x0, GOTHIC.x1].forEach(x => rect(x - 1.4, GOTHIC.ridgeY - 3, x + 1.4, GOTHIC.ridgeY + 3, { fill: '#fff', stroke: C.glass, 'stroke-width': 1.3 }, g));
  label(GOTHIC.centerX, GOTHIC.ridgeY - 3.4, `Gothic tunnel ${GOTHIC.span} ${SYM.times} ${GOTHIC.length} ft`, 't-glass', 13.5, { 'text-anchor': 'middle' });
  label(GOTHIC.centerX, GOTHIC.ridgeY + 8.6, `${GOTHIC.peak} ft peak, two ${GOTHIC.kitLength} ft bays, unheated`, 't-note', 10.5, { 'text-anchor': 'middle' });
  label(GOTHIC.centerX, 612.6, `${GOTHIC.y0 - ORCHARD_EDGE_Y} ft gap: spreader, snow slide, access`, 't-note', 10.5, { 'text-anchor': 'middle' });
  rect(EAST.x0, EAST.y0, EAST.x1, EAST.y1, { fill: 'none', stroke: C.glass, 'stroke-width': 2.2, 'stroke-dasharray': '8 4' }, g);
  label((EAST.x0 + EAST.x1) / 2, EAST.ridgeY || (EAST.y0 + EAST.y1) / 2 - 2, 'East gothic tunnel', 't-glass', 12, { 'text-anchor': 'middle' });

  // The pit's earth berm held by a retaining wall at its foot, the open cut, and the pit itself
  const R = BERM.run, yc = PIT.y0;
  add(svgNode('path', { d: `M${X(BERM.endX0)},${Y(yc)}L${X(BERM.endX0)},${Y(yc - BERM.top)}A${R * S},${R * S} 0 0 1 ${X(PIT.x0)},${Y(BERM.toeY)}L${X(PIT.x1)},${Y(BERM.toeY)}A${R * S},${R * S} 0 0 1 ${X(BERM.endX1)},${Y(yc - BERM.top)}L${X(BERM.endX1)},${Y(yc)}Z`,
    fill: C.earth, stroke: 'none' }), g);
  rect(PIT.x0, yc - BERM.top, PIT.x1, yc, { fill: C.crest, stroke: C.earthEdge, 'stroke-width': 1 }, g);
  line(bermOutline(), { stroke: C.wall, 'stroke-width': 3.6, 'stroke-linejoin': 'round' }, g);
  const cut = openCut('C');
  rect(cut.x0, cut.y0, cut.x1, cut.y1, { fill: 'none', stroke: C.cut, 'stroke-width': 1.4, 'stroke-dasharray': '6 4' }, g);
  rect(PIT.x0, PIT.y0, PIT.x1, PIT.y1, { fill: '#F1E7D2', stroke: '#6B4A2B', 'stroke-width': 2.4 }, g);
  rect(PIT.x0, PIT.y1 - PIT.sinkWidth, PIT.x1, PIT.y1, { fill: C.sink, stroke: '#6B4A2B', 'stroke-width': 1 }, g);
  label(PIT.centerX, 688, 'Pit greenhouse', 't-earth', 12.5, { 'text-anchor': 'middle' });
  label(PIT.centerX, 693.2, `${PIT.width} ${SYM.times} ${PIT.length} ft, ${PIT.depth.sink} ft deep`, 't-note', 10, { 'text-anchor': 'middle' });
  label(PIT.centerX, 670.4, 'Earth berm', 't-earth', 12.5, { 'text-anchor': 'middle' });
  label(PIT.centerX, 674.9, `${fmt(BERM.crest, 1)} ft at the crest, ${BERM.slope}:1 slopes`, 't-note', 9.5, { 'text-anchor': 'middle' });
  label(PIT.centerX, BERM.toeY - 1.8, `${BERM.wall} ft retaining wall at its foot`, 't-wall', 9.5, { 'text-anchor': 'middle' });
  label(PIT.x1 - 6, 706.8, 'open cut', 't-note', 9.5, { 'text-anchor': 'middle' });

  drawCellLabels();

  // Swales (schematic) and the way the ground falls
  line(SWALE.toe, { stroke: C.water, 'stroke-width': 1.8, 'stroke-dasharray': '7 3.5' }, g);
  line(SWALE.diversion, { stroke: C.water, 'stroke-width': 2.6, 'stroke-dasharray': '9 4', 'marker-end': 'url(#gh-arrow-blue)' }, g);
  label(110, 726.5, 'uphill diversion swale (schematic)', 't-water', 10.5, { 'text-anchor': 'middle' });
  label(2, 597.6, 'to the windbreak', 't-water', 9.5);
  label(GOTHIC.centerX, 650.6, `${BERM.toeY - GOTHIC.y1} ft clear: toe swale and snow-slide room`, 't-water', 9.5, { 'text-anchor': 'middle' });
  [[176, 626], [180, 670], [150, 712], [168, 748], [9, 640], [128, 748]].forEach(([x, y]) => {
    const gx = (SG.elevationFt(x + 8, y) - SG.elevationFt(x - 8, y)) / 16, gy = (SG.elevationFt(x, y + 8) - SG.elevationFt(x, y - 8)) / 16, n = Math.hypot(gx, gy);
    line([[x + 7 * gx / n, y + 7 * gy / n], [x - 7 * gx / n, y - 7 * gy / n]], { stroke: '#5F7F95', 'stroke-width': 2, 'marker-end': 'url(#gh-arrow-gray)' }, g);
  });
  label(146, 766.8, 'ground falls to the NW', 't-note', 9.5, { 'text-anchor': 'middle' });

  // The weather plan's WS90 pole site stands 33 ft east of the tunnel's east end
  const ws = [146, 640];
  poly([[ws[0], ws[1] - 3.6], [ws[0] + 3.6, ws[1]], [ws[0], ws[1] + 3.6], [ws[0] - 3.6, ws[1]]], { fill: '#185FA5', stroke: C.flag, 'stroke-width': 2 }, g);
  label(150.5, 639.2, 'WS90 pole site in the', 't-warn', 9.5);
  label(150.5, 644.2, `weather plan: ${ws[0] - GOTHIC.x1} ft off`, 't-warn', 9.5);
  line([[GOTHIC.x1 + 0.6, ws[1]], [ws[0] - 4.4, ws[1]]], { stroke: C.flag, 'stroke-width': 1, 'stroke-dasharray': '2 2' }, g);
  // Scale bar and north arrow
  line([[5, 765], [55, 765]], { stroke: C.ink, 'stroke-width': 2.4 }, g);
  [5, 30, 55].forEach(x => line([[x, 763], [x, 767]], { stroke: C.ink, 'stroke-width': 1.4 }, g));
  label(5, 761.6, '0', '', 9, { 'text-anchor': 'middle' });
  label(55, 761.6, '50 ft', '', 9, { 'text-anchor': 'middle' });
  poly([[181, 746], [185, 760], [181, 757.5], [177, 760]], { fill: C.ink }, g);
  label(181, 770, 'N', 't-b', 10, { 'text-anchor': 'middle' });

  host.replaceChildren(svg);
}

/* ---------- Figure: north-south section along the middle line of both buildings ---------- */
function siteSection(host) {
  const s0 = site(), ground = s0.ground, zT = s0.zTunnel, G0 = s0.zPit;
  const u0 = 566, u1 = 734;
  let gmin = Infinity;
  for (let u = u0; u <= u1; u += 2) gmin = Math.min(gmin, ground(u));
  const v0 = Math.floor(gmin - 12), v1 = Math.ceil(G0 + PIT.ventTop + 9);
  const cv = canvas({ u0, u1, v0, v1, scale: 6, up: true, margin: { l: 56, r: 12, t: 12, b: 66 },
    title: 'North-south section through the middle of both greenhouses, looking east, drawn to one scale: the orchard edge, the gothic tunnel, the clear strip, the earth berm, and the pit, with the winter-solstice noon shadows.' });
  const { svg, defs, X, Y, S, add, line, poly, rect, text } = cv;
  const label = (u, v, str, cls = '', size = 12, extra = {}) => text(u, v, str, { class: `halo ${cls}`.trim(), 'font-size': +(size * 1.18).toFixed(1), ...extra });
  const profile = (from, to, step = 2) => { const pts = []; for (let u = from; u <= to + 1e-9; u += step) pts.push([u, ground(u)]); return pts; };
  const below = depth => profile(u0, u1).map(([u, v]) => [u, v - depth]);

  // Elevation scale and light grid
  for (let v = Math.ceil(v0 / 5) * 5; v <= v1; v += 5) {
    line([[u0, v], [u1, v]], { stroke: '#ECE9DF', 'stroke-width': 1 });
    text(u0 - 1.2, v + 0.5, fmt(v), { 'text-anchor': 'end', 'font-size': 12.5, class: 't-note' });
  }
  text(u0 - 1.2, v1 + 0.6, 'ft', { 'text-anchor': 'end', 'font-size': 12.5, class: 't-note' });

  // Ground, soil layers, and the 10 ft rock line from the owner's note
  poly([[u0, v0], ...profile(u0, u1), [u1, v0]], { fill: C.soil });
  line(below(SOIL.frostIn / 12), { stroke: '#2B8FD6', 'stroke-width': 1.3, 'stroke-dasharray': '2 3' });
  line(below(SOIL.boundaryIn / 12), { stroke: C.soilLine, 'stroke-width': 1.2, 'stroke-dasharray': '6 3' });
  line(below(SOIL.rockFt), { stroke: '#6E6E68', 'stroke-width': 1.5, 'stroke-dasharray': '10 4' });
  label(606, ground(606) - SOIL.frostIn / 12 + 0.5, `${SOIL.frostIn} in frost depth (county)`, 't-water', 10.5, { 'text-anchor': 'start' });
  label(u0 + 1, ground(u0) - SOIL.boundaryIn / 12 - 1.1, 'clay loam above, sandy loam below 42 in', 't-note', 10.5);
  label(u1 - 1, ground(u1) - SOIL.rockFt - 1.1, `rock about ${SOIL.rockFt} ft (owner's note)`, 't-note', 10.5, { 'text-anchor': 'end' });

  // The earth berm, held at its foot by the retaining wall, and the open pit
  const toeV = ground(BERM.toeY);
  poly([[PIT.y0, G0 + BERM.crest], [PIT.y0 - BERM.top, G0 + BERM.crest], [BERM.toeY, toeV + BERM.wall], [BERM.toeY, toeV], [PIT.y0, ground(PIT.y0)]], { fill: C.earth, stroke: C.earthEdge, 'stroke-width': 1.4 });
  rect(BERM.toeY, toeV, BERM.toeY + BERM.wallThick, toeV + BERM.wall, { fill: '#8F8D85', stroke: C.wall, 'stroke-width': 1.6 });
  line([[BERM.toeY - 0.8, toeV + BERM.wall + 6.0], [BERM.toeY, toeV + BERM.wall + 0.2]], { stroke: C.wall, 'stroke-width': 1.1 });
  label(BERM.toeY - 0.8, toeV + BERM.wall + 6.4, `${BERM.wall} ft wall`, 't-wall', 10.5, { 'text-anchor': 'end' });
  const d = PIT.depth, floorAt = { n: G0 - d.walk, bed: G0 - d.bed, walk: G0 - d.walk, sink: G0 - d.sink };
  const bedN = PIT.y0 + PIT.northStrip, bedS = bedN + PIT.bedWidth, sinkN = PIT.y1 - PIT.sinkWidth;
  poly([[PIT.y0, ground(PIT.y0)], [PIT.y0, floorAt.n], [bedN, floorAt.n], [bedN, floorAt.bed], [bedS, floorAt.bed], [bedS, floorAt.walk], [sinkN, floorAt.walk], [sinkN, floorAt.sink], [PIT.y1, floorAt.sink], [PIT.y1, ground(PIT.y1)]], { fill: '#fff', stroke: C.soilLine, 'stroke-width': 1.2 });
  rect(bedN, floorAt.bed, bedS, floorAt.bed - 0.7, { fill: C.bed, opacity: 0.8 });
  rect(PIT.y0, floorAt.n, PIT.y0 + 2, floorAt.n + 2.8, { fill: C.drum, stroke: '#2E4559', 'stroke-width': 1 });
  const roofAt = u => G0 + PIT.eave + Math.min(PIT.y1 - u, PIT.run) * PIT.rise / PIT.run;
  for (let k = 0; k < PIT.postRows; k++) {
    const u = PIT.y1 - k * PIT.postSpacing, floor = u <= bedN ? floorAt.n : u < bedS ? floorAt.bed : u < sinkN + 0.01 ? floorAt.walk : floorAt.sink;
    const top = k === PIT.postRows - 1 ? G0 + PIT.ventTop : roofAt(u);
    line([[u, G0 - d.post], [u, floor]], { stroke: C.sunk, 'stroke-width': 3 });
    line([[u, floor], [u, top]], { stroke: C.post, 'stroke-width': 3 });
  }
  line([[PIT.y1, G0 + PIT.eave], [PIT.y0 + 0.5, G0 + PIT.northHeight]], { stroke: C.glass, 'stroke-width': 4 });
  line([[PIT.y1, floorAt.sink], [PIT.y1, G0 + PIT.eave]], { stroke: C.glass, 'stroke-width': 1.4 });
  line([[PIT.y0 + 0.5, floorAt.n], [PIT.y0 + 0.5, G0 + PIT.northHeight]], { stroke: C.glass, 'stroke-width': 1.4 });

  // The gothic tunnel on its level pad
  const pts = []; for (let k = 0; k <= 54; k++) { const dd = k * GOTHIC.span / 54; pts.push([GOTHIC.y0 + dd, zT + ARCH.height(dd)]); }
  poly(pts, { fill: C.glassFill, stroke: C.glass, 'stroke-width': 3 });
  line([[GOTHIC.y0 - 1, zT], [GOTHIC.y1 + 1, zT]], { stroke: '#444', 'stroke-width': 1.6 });

  // Orchard markers
  const trunksOnEdge = Math.abs(R1_Y - ORCHARD_EDGE_Y) < 0.5;
  line([[R1_Y, ground(R1_Y)], [R1_Y, ground(R1_Y) + (trunksOnEdge ? 16 : 9)]], { stroke: '#5B8A3A', 'stroke-width': 2.6 });
  if (!trunksOnEdge) line([[ORCHARD_EDGE_Y, ground(ORCHARD_EDGE_Y)], [ORCHARD_EDGE_Y, ground(ORCHARD_EDGE_Y) + 16]], { stroke: '#77766F', 'stroke-width': 1.3, 'stroke-dasharray': '2 3' });
  label(trunksOnEdge ? R1_Y + 1 : R1_Y - 1.5, ground(R1_Y) + (trunksOnEdge ? 17.4 : 10.6), trunksOnEdge ? 'R1 trunks, on the planned orchard edge' : 'R1 trunks', 't-note', 10.5, trunksOnEdge ? { 'text-anchor': 'start' } : { 'text-anchor': 'middle' });
  if (!trunksOnEdge) label(ORCHARD_EDGE_Y + 1, ground(ORCHARD_EDGE_Y) + 17.4, 'planned orchard edge', 't-note', 10.5, { 'text-anchor': 'start' });

  // Winter-solstice noon rays that just clear the tunnel's arch and the berm crest, and where their shadows end
  const noon = shadowRow('dec21', 12), t = tanNorthSouth(noon.sun);
  [[noon.tunnelTip, 'tunnel'], [noon.bermTip, 'berm']].forEach(([tip]) => {
    const gv = ground(tip);
    line([[tip, gv], [tip + (v1 - gv) / t, v1]], { stroke: C.sun, 'stroke-width': 1.7 });
    add(svgNode('circle', { cx: X(tip), cy: Y(gv), r: 4.5, fill: C.sun, stroke: '#fff', 'stroke-width': 1.5 }));
  });
  const rayTop = tip => tip + (v1 - ground(tip)) / t;
  label(rayTop(noon.tunnelTip) + 1.4, v1 - 1.5, `tunnel shadow ends at y ${fmt(noon.tunnelTip, 0)}`, 't-sun', 10.5, { 'text-anchor': 'start' });
  label(rayTop(noon.bermTip) - 14, v1 - 4.4, `berm shadow ends at y ${fmt(noon.bermTip, 0)}`, 't-sun', 10.5, { 'text-anchor': 'end' });
  label(u0 + 22, v1 - 1.5, `Dec 21 at solar noon, sun ${fmt(noon.sun.alt, 0)}${SYM.deg} high`, 't-sun', 10.5, { 'text-anchor': 'start' });

  // Labels
  label(GOTHIC.ridgeY, zT + GOTHIC.peak + 2.4, `Gothic tunnel: ${GOTHIC.span} ft wide, ${GOTHIC.peak} ft peak`, 't-glass', 12, { 'text-anchor': 'middle' });
  label((GOTHIC.y1 + BERM.toeY) / 2, ground((GOTHIC.y1 + BERM.toeY) / 2) + 5.9, `${BERM.toeY - GOTHIC.y1} ft`, '', 11, { 'text-anchor': 'middle' });
  label((GOTHIC.y1 + BERM.toeY) / 2, ground((GOTHIC.y1 + BERM.toeY) / 2) + 3.8, 'clear', '', 10.5, { 'text-anchor': 'middle' });
  label(PIT.y0 - 3, G0 + BERM.crest + 1.6, `berm crest ${fmt(BERM.crest, 1)} ft`, 't-earth', 11, { 'text-anchor': 'end' });
  label(PIT.y0 - 3, G0 + PIT.ventTop + 1.1, `vent post +${fmt(PIT.ventTop, 1)} ft`, 't-earth', 11, { 'text-anchor': 'end' });
  label(PIT.y1 + 6, G0 + 10.8, 'Pit greenhouse (roof faces south)', 't-earth', 12, { 'text-anchor': 'middle' });
  label(PIT.y1 + 2, ground(PIT.y1) + 1.2, 'uphill swale', 't-water', 10.5, { 'text-anchor': 'start' });
  label((GOTHIC.y1 + BERM.toeY) / 2, ground((GOTHIC.y1 + BERM.toeY) / 2) + 1.9, 'toe swale', 't-water', 10, { 'text-anchor': 'middle' });
  [[(GOTHIC.y1 + BERM.toeY) / 2 + 1.8], [PIT.y1 + 17]].forEach(([u]) => poly([[u - 2.6, ground(u) + 0.9], [u + 2.6, ground(u) + 0.9], [u, ground(u) - 0.3]], { fill: C.water, opacity: 0.85 }));
  label(u1 - 2, ground(u1 - 2) + 6, 'ground rises about 2% to the south', 't-note', 10.5, { 'text-anchor': 'end' });
  text(u0 + 0.8, v1 - 1.2, 'NORTH', { 'font-size': 15, class: 't-b' });
  text(u1 - 0.8, v1 - 1.2, 'SOUTH', { 'font-size': 15, class: 't-b', 'text-anchor': 'end' });

  // Distance scale along the bottom: lot y, then the stack of dimensions
  const yAxis = Y(v0);
  line([[u0, v0], [u1, v0]], { stroke: C.ink, 'stroke-width': 1.2 });
  for (let u = Math.ceil(u0 / 10) * 10; u <= u1; u += 10) {
    add(svgNode('path', { d: `M${X(u)},${yAxis}v5`, stroke: C.ink, 'stroke-width': 1 }));
    add(svgNode('text', { x: X(u), y: yAxis + 18, 'text-anchor': 'middle', 'font-size': 12, class: 't-note' }, String(u)));
  }
  add(svgNode('text', { x: X(u0), y: yAxis + 33, 'font-size': 12, class: 't-note' }, 'lot y, feet south of the north fence'));
  const dims = [[ORCHARD_EDGE_Y, GOTHIC.y0, 'gap'], [GOTHIC.y0, GOTHIC.y1, 'tunnel'], [GOTHIC.y1, BERM.toeY, 'clear'], [BERM.toeY, PIT.y0, 'berm'], [PIT.y0, PIT.y1, 'pit']];
  const yDim = yAxis + 46;
  dims.forEach(([a, b, name]) => {
    add(svgNode('path', { d: `M${X(a)},${yDim}H${X(b)}M${X(a)},${yDim - 4}V${yDim + 4}M${X(b)},${yDim - 4}V${yDim + 4}`, stroke: C.ink, 'stroke-width': 1.1, fill: 'none' }));
    add(svgNode('text', { x: (X(a) + X(b)) / 2, y: yDim - 6, 'text-anchor': 'middle', 'font-size': 12, class: 't-b' }, `${b - a} ft ${name}`));
  });

  host.replaceChildren(svg);
}

/* ---------- shared drawing helpers for the detailed figures ---------- */
// A six-foot person standing on the floor line at u, for the end and cross-section views (v up)
function drawPerson(cv, u) {
  cv.circle(u, 5.55, 0.32, { fill: 'none', stroke: '#555', 'stroke-width': 2 });
  cv.line([[u, 5.2], [u, 2.8], [u - 0.5, 0], [u, 2.8], [u + 0.5, 0], [u, 4.7], [u - 0.8, 3.4], [u, 4.7], [u + 0.8, 3.4]], { stroke: '#555', 'stroke-width': 2 });
}
function dimH(cv, ua, ub, v, str, size = 12, below = false) {
  const y = cv.Y(v), xa = cv.X(ua), xb = cv.X(ub);
  cv.add(svgNode('path', { d: `M${xa},${y}H${xb}M${xa},${y - 4}V${y + 4}M${xb},${y - 4}V${y + 4}`, stroke: C.ink, 'stroke-width': 1.2, fill: 'none' }));
  cv.add(svgNode('text', { x: (xa + xb) / 2, y: below ? y + size + 3 : y - 6, 'text-anchor': 'middle', 'font-size': size, class: 't-b halo' }, str));
}
function dimV(cv, u, va, vb, str, size = 12, side = 'right') {
  const x = cv.X(u), ya = cv.Y(va), yb = cv.Y(vb);
  cv.add(svgNode('path', { d: `M${x},${ya}V${yb}M${x - 4},${ya}H${x + 4}M${x - 4},${yb}H${x + 4}`, stroke: C.ink, 'stroke-width': 1.2, fill: 'none' }));
  cv.add(svgNode('text', { x: side === 'right' ? x + 7 : x - 7, y: (ya + yb) / 2 + size / 3, 'text-anchor': side === 'right' ? 'start' : 'end', 'font-size': size, class: 't-b halo' }, str));
}
// A numbered marker at (u, v) with a thin leader to the thing it points at (tu, tv); the page lists what each number means.
function callout(cv, n, u, v, tu, tv, color = '#8A3B12') {
  cv.line([[u, v], [tu, tv]], { stroke: color, 'stroke-width': 1.3 });
  cv.add(svgNode('circle', { cx: cv.X(tu), cy: cv.Y(tv), r: 2.6, fill: color }));
  cv.add(svgNode('circle', { cx: cv.X(u), cy: cv.Y(v), r: 10.5, fill: '#fff', stroke: color, 'stroke-width': 1.6 }));
  cv.add(svgNode('text', { x: cv.X(u), y: cv.Y(v) + 4.4, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700, style: `fill:${color}` }, String(n)));
}

/* ---------- Figure: pit greenhouse floor plan ---------- */
function pitPlan(host) {
  const L = PIT.length, W = PIT.width, z = PIT;
  const cv = canvas({ u0: -7, u1: L + 7, v0: -9, v1: W + 8, scale: 17, margin: { l: 4, r: 4, t: 4, b: 4 },
    title: `Floor plan of the pit greenhouse, ${L} by ${W} feet, north up: the earth berm on the north, a strip for water drums, two growing beds, the walks, the cold zone on the south, the post grid, the stair, and the optional east door.` });
  const { defs, add, line, rect, circle, text } = cv;
  defs.append(hatchPattern('pp-hatch', '#A8906A', 7), arrowMarker('pp-arrow', C.flag));
  const label = (u, v, str, cls = '', size = 12, extra = {}) => text(u, v, str, { class: `halo ${cls}`.trim(), 'font-size': size, ...extra });
  const yBed0 = z.northStrip, yBed1 = yBed0 + z.bedWidth, ySouth1 = yBed1 + z.southWalk;

  rect(-4, -7.5, L + 4, 0, { fill: C.earth, stroke: C.earthEdge, 'stroke-width': 1.4 });
  rect(-4, -7.5, L + 4, 0, { fill: 'url(#pp-hatch)', opacity: 0.4 });
  label(L / 2, -3, 'north earth berm: dirt up to the roof, only the vent posts stand out of it', 't-earth', 12.5, { 'text-anchor': 'middle' });
  rect(0, 0, L, W, { fill: C.walk });
  rect(0, 0, L, z.northStrip, { fill: '#B9C5CF' });
  [[z.endWalk, z.endWalk + z.bedLength], [z.endWalk + z.bedLength + z.centerWalk, L - z.endWalk]].forEach(([a, b], i) => {
    rect(a, yBed0, b, yBed1, { fill: C.bed, opacity: 0.85, stroke: '#4F7A34', 'stroke-width': 1.2 });
    label((a + b) / 2, yBed0 + 5.4, i ? 'EAST BED' : 'WEST BED', 't-b', 14, { 'text-anchor': 'middle' });
    label((a + b) / 2, yBed0 + 7.3, `${z.bedLength} ${SYM.times} ${z.bedWidth} ft, soil ${z.depth.bed} ft below grade`, 't-note', 11, { 'text-anchor': 'middle' });
  });
  rect(0, ySouth1, L, W, { fill: C.sink });
  // Water drums: one fits between each pair of posts along the north wall
  for (let k = 0; k < PIT.postColumns - 1; k++) circle(k * z.postSpacing + z.postSpacing / 2, 1, 0.96, { fill: C.drum, stroke: '#2E4559', 'stroke-width': 1.2 });
  // Stair and the optional east door
  const steps = PIT.stair.steps, st = { x0: 34.5 - PIT.stair.runFt, x1: 34.5, y0: 16.5, y1: 19.5 };
  rect(st.x0, st.y0, st.x1, st.y1, { fill: '#F9E7DA', stroke: C.flag, 'stroke-width': 1.8 });
  for (let i = 1; i < steps; i++) line([[st.x0 + (st.x1 - st.x0) * i / steps, st.y0], [st.x0 + (st.x1 - st.x0) * i / steps, st.y1]], { stroke: C.flag, 'stroke-width': 0.8 });
  line([[st.x1 - 0.5, 18], [st.x0 + 0.9, 18]], { stroke: C.flag, 'stroke-width': 1.8, 'marker-end': 'url(#pp-arrow)' });
  rect(L, 14.2, L + 1.7, 15.8, { fill: '#fff', stroke: C.flag, 'stroke-width': 1.6, 'stroke-dasharray': '3 2' });
  label(L + 2.1, 14.4, 'east door,', 't-warn', 10.5);
  label(L + 2.1, 15.9, '2nd exit', 't-warn', 10.5);
  circle(3, 18.1, 0.85, { fill: '#5A8FAE', stroke: '#2E5A75', 'stroke-width': 1.3 });
  // Posts on the 4 ft grid: the ones on the walls are dark, the ones standing in the room are light
  for (let i = 0; i < PIT.postColumns; i++) for (let k = 0; k < PIT.postRows; k++) {
    const edge = i === 0 || i === PIT.postColumns - 1 || k === 0 || k === PIT.postRows - 1;
    circle(i * PIT.postSpacing, k * PIT.postSpacing, 0.45, { fill: edge ? C.post : '#B08D63', stroke: '#2F1E0E', 'stroke-width': 1 });
  }
  rect(0, 0, L, W, { fill: 'none', stroke: '#4A3320', 'stroke-width': 3 });
  // Labels
  label(18, 8.3, 'center walk', 't-note', 10.5, { 'text-anchor': 'middle', transform: `rotate(-90 ${cv.X(18)} ${cv.Y(8.3)})` });
  label(11, 15.3, `south walk, ${z.southWalk} ft, ${z.depth.walk} ft below grade`, 't-note', 11, { 'text-anchor': 'middle' });
  label(12.5, 18.5, `cold zone, ${z.sinkWidth} ft wide, floor ${z.depth.sink} ft below grade`, 't-b', 11.5, { 'text-anchor': 'middle' });
  label(2.5, 19.9, 'sump', 't-water', 10.5, { 'text-anchor': 'middle' });
  label((st.x0 + st.x1) / 2, 21.2, `stair: ${steps} steps, ${fmt(PIT.stair.riseIn, 1)} in rise, ${fmt(PIT.stair.runFt, 1)} ft run`, 't-warn', 11, { 'text-anchor': 'middle' });
  // Dimensions and north arrow
  [[0, 12], [12, 24], [24, 36]].forEach(([a, b]) => dimH(cv, a, b, W + 2.6, `${b - a} ft bay`, 11.5));
  dimH(cv, 0, L, W + 4.6, `${L} ft east to west`, 12.5);
  dimV(cv, -1.6, 0, W, `${W} ft`, 12.5, 'left');
  cv.add(svgNode('path', { d: `M${cv.X(-4.8)},${cv.Y(5.4)}L${cv.X(-3.6)},${cv.Y(2.6)}L${cv.X(-4.8)},${cv.Y(3.3)}L${cv.X(-6)},${cv.Y(2.6)}Z`, fill: C.ink }));
  label(-4.8, 7.3, 'N', 't-b', 13, { 'text-anchor': 'middle' });
  host.replaceChildren(cv.svg);
}

/* ---------- Figure: pit greenhouse section, north on the left, drawn to one scale ---------- */
function pitSection(host) {
  const d = PIT.depth, W = PIT.width, z = PIT;
  const u0 = -27, u1 = W + 17, v0 = -15.2, v1 = PIT.ventTop + 3.6;
  const cv = canvas({ u0, u1, v0, v1, scale: 17.5, up: true, margin: { l: 6, r: 6, t: 6, b: 6 },
    title: 'North-south section of the pit greenhouse, looking east, drawn to one scale, with the earth berm and its 3 ft retaining wall on the left: the stepped floors, posts, roof, vent, drums, and the soil layers.' });
  const { defs, add, line, poly, rect, text } = cv;
  defs.append(arrowMarker('ps-arrow', C.sun));
  const label = (u, v, str, cls = '', size = 12, extra = {}) => text(u, v, str, { class: `halo ${cls}`.trim(), 'font-size': size, ...extra });
  const bedN = z.northStrip, bedS = bedN + z.bedWidth, sinkN = W - z.sinkWidth;
  const roofAt = u => z.eave + Math.min(W - u, z.run) * z.rise / z.run;

  rect(u0, v0, u1, 0, { fill: C.soil });
  line([[u0, -SOIL.frostIn / 12], [u1, -SOIL.frostIn / 12]], { stroke: '#2B8FD6', 'stroke-width': 1.2, 'stroke-dasharray': '2 3' });
  line([[u0, -SOIL.boundaryIn / 12], [u1, -SOIL.boundaryIn / 12]], { stroke: C.soilLine, 'stroke-width': 1.2, 'stroke-dasharray': '6 3' });
  line([[u0, -SOIL.rockFt], [u1, -SOIL.rockFt]], { stroke: '#6E6E68', 'stroke-width': 1.5, 'stroke-dasharray': '10 4' });
  label(u0 + 0.6, -SOIL.frostIn / 12 + 0.25, `${SOIL.frostIn} in frost depth (county)`, 't-water', 11, { 'text-anchor': 'start' });
  label(u0 + 0.6, -SOIL.boundaryIn / 12 - 0.9, 'clay loam above, sandy loam below 42 in', 't-note', 11, { 'text-anchor': 'start' });
  label(u0 + 0.6, -SOIL.rockFt - 0.9, `rock about ${SOIL.rockFt} ft (owner's note), ${SOIL.rockFt - d.post} ft below the post bottoms`, 't-note', 11, { 'text-anchor': 'start' });
  // The berm: a flat top and a 2:1 slope that stops at the top of the retaining wall at its foot, instead of running out to the ground
  const footU = -BERM.top - BERM.run;
  poly([[0, BERM.crest], [-BERM.top, BERM.crest], [footU, BERM.wall], [footU, 0], [0, 0]], { fill: C.earth, stroke: C.earthEdge, 'stroke-width': 1.6 });
  rect(footU, 0, footU + BERM.wallThick, BERM.wall, { fill: '#8F8D85', stroke: C.wall, 'stroke-width': 2 });
  label(footU - 0.7, 1.0, `${BERM.wall} ft retaining wall`, 't-wall', 11.5, { 'text-anchor': 'end' });
  poly([[0, 0], [0, -d.walk], [bedN, -d.walk], [bedN, -d.bed], [bedS, -d.bed], [bedS, -d.walk], [sinkN, -d.walk], [sinkN, -d.sink], [W, -d.sink], [W, 0]], { fill: '#fff', stroke: C.soilLine, 'stroke-width': 1.3 });
  rect(bedN, -d.bed, bedS, -d.bed - 0.7, { fill: C.bed, opacity: 0.85 });
  rect(0.05, -d.walk, 1.97, -d.walk + 2.8, { fill: C.drum, stroke: '#2E4559', 'stroke-width': 1.3 });
  rect(sinkN + 0.6, -d.sink, sinkN + 1.4, -d.sink - 0.9, { fill: '#5A8FAE', stroke: '#2E5A75' });
  for (let k = 0; k < PIT.postRows; k++) {
    const u = k * z.postSpacing, floor = u <= bedN ? -d.walk : u < bedS ? -d.bed : u <= sinkN ? -d.walk : -d.sink;
    const top = k === 0 ? PIT.ventTop : roofAt(u);
    line([[u, -d.post], [u, floor]], { stroke: C.sunk, 'stroke-width': 5 });
    line([[u, floor], [u, top]], { stroke: C.post, 'stroke-width': 5 });
  }
  line([[W, z.eave], [0.5, PIT.northHeight]], { stroke: C.glass, 'stroke-width': 6 });
  line([[W, -d.sink], [W, z.eave]], { stroke: C.glass, 'stroke-width': 1.8 });
  line([[0.5, -d.walk], [0.5, PIT.northHeight]], { stroke: C.glass, 'stroke-width': 1.8 });
  line([[0, 0], [0, -d.walk]], { stroke: C.glass, 'stroke-width': 1.8 });
  line([[-4, 0], [-1, 0]], { stroke: C.ink, 'stroke-width': 1, 'stroke-dasharray': '2 2' });

  // Noon sun on Dec 21 and Mar 21 reaching the roof
  [['dec21', 9.5], ['mar21', 5.5]].forEach(([date, uHit], i) => {
    const sun = sunPosition(declinationOf(date), 12), a = sun.alt * D2R, uh = uHit, vh = roofAt(uh), len = i ? 7 : 7.5;
    line([[uh + len * Math.cos(a), vh + len * Math.sin(a)], [uh + 0.35 * Math.cos(a), vh + 0.35 * Math.sin(a)]], { stroke: C.sun, 'stroke-width': 2, 'marker-end': 'url(#ps-arrow)' });
    label(uh + len * Math.cos(a) + 0.5, vh + len * Math.sin(a), `${SUN_DATES[date].label} noon: sun ${fmt(sun.alt, 0)}${SYM.deg}, ${fmt(beamShare(z.angleDeg, sun.alt) * 100, 0)}% of the beam`, 't-sun', 11, { 'text-anchor': 'start' });
  });

  // Depth scale on the right
  const xs = W + 9;
  const floors = d.sink === d.walk ? [[-d.walk, `${SYM.minus}${d.walk} walks, cold zone`, 0]] : [[-d.walk, `${SYM.minus}${d.walk} walks`, 0], [-d.sink, `${SYM.minus}${d.sink} cold zone`, 0]];
  [[PIT.ventTop, `+${fmt(PIT.ventTop, 1)} vent post top`, 0], [PIT.northHeight, `+${fmt(PIT.northHeight, 1)} roof at the berm`, 0], [z.eave, `+${fmt(z.eave, 1)} south eave`, 0.45], [0, '0 original grade', -0.7],
    [-d.bed, `${SYM.minus}${d.bed} bed top`, 0], ...floors, [-d.post, `${SYM.minus}${d.post} post bottoms`, 0]].forEach(([v, str, dy]) => {
    line([[xs - 0.35, v], [xs + 0.35, v]], { stroke: C.ink, 'stroke-width': 1.3 });
    label(xs + 0.7, v - 0.28 + dy, str, 't-b', 11, { 'text-anchor': 'start' });
  });
  line([[xs, PIT.ventTop], [xs, -d.post]], { stroke: C.ink, 'stroke-width': 1.1 });
  dimH(cv, footU, 0, -13.7, `berm: ${BERM.run + BERM.top} ft from its foot to the pit wall`, 11.5);
  dimH(cv, 0, W, -13.7, `${W} ft`, 12);
  text(u0 + 0.5, v1 - 0.9, 'NORTH', { 'font-size': 14, class: 't-b' });
  text(u1 - 0.3, v1 - 0.9, 'SOUTH', { 'font-size': 14, class: 't-b', 'text-anchor': 'end' });

  // Numbered callouts; the page lists what each number means
  callout(cv, 1, -15, 10.4, -9, 5.2);
  callout(cv, 2, 6, -9.4, 4, -7.2);
  callout(cv, 3, -2.6, -4.2, 0, -3);
  callout(cv, 4, 12.2, 9.3, 10.5, roofAt(10.5) + 0.2);
  callout(cv, 5, 3.4, 14.9, 0, PIT.ventTop - 0.5);
  callout(cv, 6, 1, -1.7, 1, -d.walk + 2.8);
  callout(cv, 7, 8, -1.6, 8, -d.bed);
  callout(cv, 8, 15, -1.6, 15, -d.walk);
  callout(cv, 9, 18.2, -4.6, 18, -d.sink);
  callout(cv, 10, 17.6, -9.2, sinkN + 1, -d.sink - 0.45);
  host.replaceChildren(cv.svg);
}

/* ---------- Figure: gothic tunnel cross-section ---------- */
function gothicSection(host) {
  const span = GOTHIC.span, half = span / 2, peak = GOTHIC.peak;
  const cv = canvas({ u0: -5, u1: span + 4.6, v0: -6.2, v1: peak + 3.4, scale: 26, up: true, margin: { l: 6, r: 6, t: 6, b: 6 },
    title: `Cross-section of the gothic tunnel: a ${span} ft span and a ${peak} ft peak, the hoop drawn as two arcs, the tube-truss chord about ${GOTHIC.chordFt} ft up, a six-foot person for scale, and the frost depth.` });
  const { add, line, poly, rect, circle, text } = cv;
  const label = (u, v, str, cls = '', size = 12.5, extra = {}) => text(u, v, str, { class: `halo ${cls}`.trim(), 'font-size': +(size * 1.2).toFixed(1), ...extra });
  rect(-5, -6.2, span + 4.6, 0, { fill: C.soil });
  line([[-5, -SOIL.frostIn / 12], [span + 4.6, -SOIL.frostIn / 12]], { stroke: '#2B8FD6', 'stroke-width': 1.3, 'stroke-dasharray': '2 3' });
  label(span / 2, -SOIL.frostIn / 12 + 0.3, `${SOIL.frostIn} in frost depth (county)`, 't-water', 12, { 'text-anchor': 'middle' });
  [0, span].forEach(u => line([[u, 0], [u, -4.5]], { stroke: C.sunk, 'stroke-width': 7 }));
  label(span / 2, -3.9, 'posts in the ground (depth to confirm)', 't-note', 12, { 'text-anchor': 'middle' });
  line([[-5, 0], [span + 4.6, 0]], { stroke: C.ink, 'stroke-width': 1.6 });
  const pts = []; for (let k = 0; k <= 80; k++) { const dd = k * span / 80; pts.push([dd, ARCH.height(dd)]); }
  poly(pts, { fill: C.glassFill, stroke: C.glass, 'stroke-width': 5 });
  // Truss chord about 7 ft up, with two braces up to the arch (the vendor's tube-truss drawing)
  let lo = 0, hi = half; for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (ARCH.height(mid) < GOTHIC.chordFt) lo = mid; else hi = mid; }
  const d1 = (lo + hi) / 2;
  line([[d1, GOTHIC.chordFt], [span - d1, GOTHIC.chordFt]], { stroke: C.glass, 'stroke-width': 3.2 });
  [half - 4, half + 4].forEach(dd => line([[half, GOTHIC.chordFt], [dd, ARCH.height(dd)]], { stroke: C.glass, 'stroke-width': 2.6 }));
  // A six-foot person for scale
  const px = 4.6;
  circle(px, 5.55, 0.32, { fill: 'none', stroke: '#555', 'stroke-width': 2 });
  line([[px, 5.2], [px, 2.8], [px - 0.5, 0], [px, 2.8], [px + 0.5, 0], [px, 4.7], [px - 0.8, 3.4], [px, 4.7], [px + 0.8, 3.4]], { stroke: '#555', 'stroke-width': 2 });
  label(px + 0.9, 0.7, '6 ft person', 't-note', 11.5, { 'text-anchor': 'start' });
  // Dimensions and notes
  dimH(cv, 0, span, -5.5, `${span} ft wide`, 14);
  dimV(cv, span + 1.6, 0, peak, `${peak} ft peak`, 14, 'right');
  const apex = Math.atan((ARCH.height(half) - ARCH.height(half - 0.5)) / 0.5) / D2R;
  label(half, peak + 1.3, `two arcs of about ${fmt(ARCH.radius, 1)} ft radius: ${GOTHIC.baseAngleDeg}${SYM.deg} at the ground, about ${fmt(apex, 0)}${SYM.deg} at the peak`, 't-glass', 11.5, { 'text-anchor': 'middle' });
  label(half, GOTHIC.chordFt - 1.1, `truss chord about ${GOTHIC.chordFt} ft up`, 't-glass', 11.5, { 'text-anchor': 'middle' });
  host.replaceChildren(cv.svg);
}

/* ---------- the end-wall openings: sizes in sq ft and their place beside the floor area and the extension yardstick ---------- */
function endwallOpenings() {
  const E = ENDWALL, floor = GOTHIC.footprint;
  const wide = E.wide.w * E.wide.h, standard = E.standard.w * E.standard.h, vent = E.vent.w * E.vent.h;
  const end = kind => (kind === 'wide' ? wide : standard) + vent;
  return { floor, wide, standard, vent, oneWide: end('wide'), oneStandard: end('standard'), bothWide: 2 * end('wide'), bothStandard: 2 * end('standard'),
    draft: end(E.ends.west) + end(E.ends.east), vents: 2 * vent, yardLow: 0.15 * floor, yardHigh: 0.2 * floor };   // the yardstick: 15 to 20 percent of the floor for each of the ridge vents and the side vents
}

/* ---------- bed layouts: beds and walking rows across the width ---------- */
// Tries 3 to 10 beds across the width and keeps the layout with the most bed width. lane is the width of one cart lane on the center line, or 0 for none.
// Inner beds are as wide as the rest of the width allows, cut down to a quarter-foot step; the walking rows stay at their narrowest and the wall gaps take what is left over.
function bedLayout(lane = 0) {
  const usable = GOTHIC.span - 2 * BEDS.gap;
  let best = null;
  for (let n = BEDS.tries[0]; n <= BEDS.tries[1]; n++) {
    if (lane && n % 2) continue;                                                    // a lane on the center line sits between two beds
    const inner = n - 2, rows = n - 1 - (lane ? 1 : 0);
    const room = (usable - lane - 2 * BEDS.edge - rows * BEDS.row) / inner;         // inner bed width if every walking row is at its narrowest
    const innerWidth = Math.min(Math.floor(room / BEDS.step + 1e-9) * BEDS.step, BEDS.inner);
    if (innerWidth < BEDS.bedMin) continue;
    const width = 2 * BEDS.edge + inner * innerWidth;
    if (!best || width > best.width + 1e-9) best = { n, inner, rows, innerWidth, width };
  }
  if (!best) throw new Error('No bed layout fits the rules in BEDS');
  const gap = (GOTHIC.span - lane - best.width - best.rows * BEDS.row) / 2;         // the wall gaps take what the beds and rows leave
  const strips = []; let v = gap;
  for (let i = 0; i < best.n; i++) {
    const edge = i === 0 || i === best.n - 1, w = edge ? BEDS.edge : best.innerWidth;
    strips.push({ kind: 'bed', edge, w, v0: v, v1: v + w }); v += w;
    if (i < best.n - 1) {
      const isLane = lane > 0 && i === best.n / 2 - 1, rw = isLane ? lane : BEDS.row;
      strips.push({ kind: isLane ? 'lane' : 'row', w: rw, v0: v, v1: v + rw }); v += rw;
    }
  }
  const area = best.width * BEDS.length;
  return { lane, n: best.n, rows: best.rows, strips, gap, innerWidth: best.innerWidth, width: best.width, length: BEDS.length, area, share: area / GOTHIC.footprint, linearFeet: best.n * BEDS.length };
}
function bedOptions() {
  return [['A', 'most', 'Most beds', 0], ['B', 'cart', `${feet(BEDS.cart)} cart lane`, BEDS.cart]]
    .map(([letter, id, name, lane]) => ({ letter, id, name, ...bedLayout(lane) }));
}

/* ---------- Figure: the two end-wall layouts, seen from outside ---------- */
function gothicEndwalls(host) {
  const span = GOTHIC.span, half = span / 2, peak = GOTHIC.peak, E = ENDWALL, off2 = span + 11, times = SYM.times;
  const cv = canvas({ u0: -4, u1: off2 + span + 5.2, v0: -5.8, v1: peak + 4.2, scale: 12, up: true, margin: { l: 4, r: 4, t: 4, b: 4 },
    title: `The tunnel's two end-wall layouts seen from outside, each ${span} ft wide and ${peak} ft at the peak: on the left the wide center door, about ${E.wide.w} by ${E.wide.h} ft, with the peak vent above it; on the right the standard ${GOTHIC.doorIn} in door beside the center line with the same vent. A six-foot person stands in the left-hand bay of each wall for scale.` });
  const { line, poly, rect, text } = cv;
  const label = (u, v, str, cls = '', size = 12, extra = {}) => text(u, v, str, { class: `halo ${cls}`.trim(), 'font-size': size, ...extra });
  const frame = { stroke: C.glass, 'stroke-width': 1.3, opacity: 0.8 };

  function drawEnd(off, kind) {
    const U = u => u + off, wide = kind === 'wide';
    rect(U(-3.4), -0.6, U(span + 3.4), 0, { fill: C.soil });
    line([[U(-3.4), 0], [U(span + 3.4), 0]], { stroke: C.ink, 'stroke-width': 1.6 });
    const outline = [[U(0), 0]]; for (let k = 0; k <= 80; k++) { const dd = k * span / 80; outline.push([U(dd), ARCH.height(dd)]); }
    outline.push([U(span), 0]);
    poly(outline, { fill: C.glassFill, stroke: C.glass, 'stroke-width': 4 });
    // Posts every 3.5 ft from the center line: the wide door takes the center bay, and the standard layout keeps a center post under the vent
    [-3, -2, -1, 0, 1, 2, 3].forEach(k => {
      if (wide && k === 0) return;
      const d = half + k * E.post;
      line([[U(d), 0], [U(d), k === 0 ? E.vent.bottom : ARCH.height(d)]], frame);
    });
    // Rails every 3 ft, broken where a door or the vent stands
    [1, 2, 3].forEach(n => {
      const v = n * E.rail, reachD = half - archReach(v);
      let runs = [[-reachD, reachD]];
      const cut = (a, b) => { runs = runs.flatMap(([s, e]) => (b <= s || a >= e) ? [[s, e]] : [[s, Math.min(e, a)], [Math.max(s, b), e]].filter(([p, q]) => q - p > 1e-6)); };
      if (wide) cut(-E.post, E.post);
      else {
        if (v < E.standard.h) cut(E.standard.from - 0.1, E.standard.from + E.standard.w + 0.1);
        if (v > E.vent.bottom && v < E.ventTop) cut(-E.post, E.post);
      }
      runs.forEach(([s, e]) => line([[U(half + s), v], [U(half + e), v]], frame));
    });
    // The door and the peak vent
    const doorStyle = { fill: '#FFF6E6', stroke: C.post, 'stroke-width': 2.4 };
    const d0 = wide ? half - E.wide.w / 2 : half + E.standard.from, d1 = wide ? half + E.wide.w / 2 : half + E.standard.from + E.standard.w, doorH = wide ? E.wide.h : E.standard.h;
    rect(U(d0), 0, U(d1), doorH, doorStyle);
    rect(U(half - E.vent.w / 2), E.vent.bottom, U(half + E.vent.w / 2), E.ventTop, { fill: '#E9F4FB', stroke: C.water, 'stroke-width': 2.4 });
    line([[U(half), peak + 0.55], [U(half), E.ventTop]], { stroke: C.water, 'stroke-width': 1.2 });
    label(U(half), peak + 1.15, `peak vent: ${feet(E.vent.w)} ${times} ${feet(E.vent.h)}, ${fmt(E.vent.bottom, 1)} to ${fmt(E.ventTop, 1)} ft up`, 't-water', 11.5, { 'text-anchor': 'middle' });
    label(U((d0 + d1) / 2), 4.6, wide ? 'wide door' : 'door', 't-b', 13, { 'text-anchor': 'middle' });
    label(U((d0 + d1) / 2), 3.3, wide ? `about ${E.wide.w} ${times} ${E.wide.h} ft` : `${GOTHIC.doorIn} in`, 't-note', 11, { 'text-anchor': 'middle' });
    // A six-foot person in the left-hand bay
    const px = U(half - 5.25);
    drawPerson(cv, px);
    if (wide) label(px - 0.9, 0.8, '6 ft person', 't-note', 11, { 'text-anchor': 'end' });
    // Dimensions
    [d0, d1].forEach(d => line([[U(d), 0], [U(d), -2.6]], { stroke: '#999', 'stroke-width': 0.8, 'stroke-dasharray': '2 2' }));
    dimH(cv, U(d0), U(d1), -2.6, `about ${feet(d1 - d0)}`, 11.5);
    dimH(cv, U(0), U(span), -5, `${span} ft wide`, 12.5);
    dimV(cv, U(span + 1.4), 0, peak, `${peak} ft`, 12.5, 'right');
    label(U(half), peak + 3.1, wide ? 'A. Wide-door end wall' : 'B. Standard end wall', 't-b', 14, { 'text-anchor': 'middle' });
  }
  drawEnd(0, 'wide');
  drawEnd(off2, 'standard');
  host.replaceChildren(cv.svg);
}

/* ---------- Figure: the bed floor plans, the most bed width (A) and with a cart lane (B) ---------- */
function gothicBeds(host) {
  const L = GOTHIC.length, W = GOTHIC.span, E = BEDS.endAisle, plans = bedOptions(), pitch = W + 7, cx = L + 1.5;
  const cv = canvas({ u0: -2, u1: L + 11, v0: -9.6, v1: pitch + W + 6, scale: 10.5, margin: { l: 4, r: 4, t: 4, b: 4 },
    title: `Floor plans of the two bed layouts, north up: ${plans.map(p => `${p.letter}, ${p.name.toLowerCase()}, ${p.n} long beds and ${fmt(p.area)} sq ft of bed`).join('; ')}. Each has a ${E} ft cross aisle at both ends where the doors open and strips along the walls where the roof is under 6 ft; layout B has a ${feet(BEDS.cart)} cart lane on the center line, door to door.` });
  const { defs, line, rect, text } = cv;
  const ROUTE = '#8A3B12', LANE = { fill: '#C9D8E3', stroke: '#6F8EA3' };
  defs.append(hatchPattern('bp-hatch', '#7A7970', 6), arrowMarker('bp-arrow', ROUTE));
  const label = (u, v, str, cls = '', size = 12, extra = {}) => text(u, v, str, { class: `halo ${cls}`.trim(), 'font-size': size, ...extra });
  const low = archReach(6), doors = [[0, ENDWALL.ends.west], [L, ENDWALL.ends.east]];

  plans.forEach((lay, k) => {
    const V = v => v + k * pitch, beds = lay.strips.filter(s => s.kind === 'bed'), lane = lay.strips.find(s => s.kind === 'lane');
    rect(0, V(0), L, V(W), { fill: C.walk, opacity: 0.55 });
    [[0, E], [L - E, L]].forEach(([a, b]) => rect(a, V(0), b, V(W), { fill: '#EADCB9' }));
    if (lane) rect(E, V(lane.v0), L - E, V(lane.v1), { ...LANE, 'stroke-width': 1.2 });
    beds.forEach(s => rect(E, V(s.v0), L - E, V(s.v1), { fill: C.bed, opacity: 0.85, stroke: '#4F7A34', 'stroke-width': 1.2 }));
    [[0, low], [W - low, W]].forEach(([a, b]) => rect(0, V(a), L, V(b), { fill: 'url(#bp-hatch)', opacity: 0.42 }));
    rect(0, V(0), L, V(W), { fill: 'none', stroke: C.glass, 'stroke-width': 3 });
    doors.forEach(([u, kind]) => { const [a, b] = endDoorSpan(kind); rect(u - 0.9, V(a), u + 0.9, V(b), { fill: '#fff', stroke: C.glass, 'stroke-width': 2 }); });
    // The cart route runs straight down the lane from one door to the other
    if (lane) {
      const vm = V((lane.v0 + lane.v1) / 2);
      [[L / 2 - 11, -0.3], [L / 2 + 11, L + 0.3]].forEach(([a, b]) => line([[a, vm], [b, vm]], { stroke: ROUTE, 'stroke-width': 2.4, 'stroke-dasharray': '9 4', 'marker-end': 'url(#bp-arrow)' }));
    }
    // Each bed with its width and the roof height over it, the center strip, and the end aisles
    beds.forEach((s, i) => {
      const [r0, r1] = roofRange(s.v0, s.v1);
      label(L / 2, V((s.v0 + s.v1) / 2 + 0.4), `bed ${i + 1}: ${num(s.w)} ft wide, roof ${fmt(r0, 0)} to ${fmt(r1, 0)} ft up`, 't-b', 13, { 'text-anchor': 'middle' });
    });
    const mid = lay.strips[Math.floor(lay.strips.length / 2)];
    label(L / 2, V((mid.v0 + mid.v1) / 2 + 0.35), `${mid.kind === 'lane' ? 'cart lane' : 'walking row'}, ${num(mid.w)} ft (${fmt(mid.w * 12)} in)`, 't-note', 12, { 'text-anchor': 'middle' });
    [E / 2, L - E / 2].forEach(u => label(u + 0.4, V(5), `end aisle, ${E} ft`, 't-note', 12, { 'text-anchor': 'middle', transform: `rotate(-90 ${cv.X(u + 0.4)} ${cv.Y(V(5))})` }));
    // The widths across, in feet, down the east side
    line([[cx, V(0)], [cx, V(W)]], { stroke: C.ink, 'stroke-width': 1.2 });
    [0, ...lay.strips.map(s => s.v1), W].forEach(v => line([[cx - 0.35, V(v)], [cx + 0.35, V(v)]], { stroke: C.ink, 'stroke-width': 1.2 }));
    lay.strips.forEach(s => label(cx + 1.1, V((s.v0 + s.v1) / 2 + 0.38), `${num(s.w)} ft ${s.kind}`, s.kind === 'bed' ? 't-b' : 't-note', 12.5));
    label(cx + 1.1, V(-0.8), 'north', 't-note', 12);
    label(cx + 1.1, V(W + 1.7), 'south', 't-note', 12);
    label(0, V(k ? -2.6 : -8), `${lay.letter}. ${lay.name}: ${fmt(lay.area)} sq ft of bed, ${fmt(100 * lay.share, 0)}% of the floor`, 't-b', 14.5);
  });
  // Dimensions along the top of the first plan
  dimH(cv, 0, E, -2.4, `${E} ft`, 12);
  dimH(cv, E, L - E, -2.4, `${plans[0].length} ft of bed`, 13);
  dimH(cv, L - E, L, -2.4, `${E} ft`, 12);
  dimH(cv, 0, L, -5.4, `${L} ft east to west`, 13);
  // Legend
  let lu = 0;
  const ly = pitch + W + 2, doorName = doors.every(([, kind]) => kind === 'wide') ? 'wide door' : 'door';
  [['bed', { fill: C.bed, opacity: 0.85, stroke: '#4F7A34' }], ['walking row', { fill: C.walk, opacity: 0.55 }], ['cart lane', LANE], ['end aisle', { fill: '#EADCB9' }],
   ['roof under 6 ft', { fill: 'url(#bp-hatch)', stroke: '#9A988F' }], [doorName, { fill: '#fff', stroke: C.glass }], ['cart route', null]].forEach(([name, attrs]) => {
    if (attrs) rect(lu, ly, lu + 2.6, ly + 1.5, { 'stroke-width': 1, ...attrs });
    else line([[lu, ly + 0.75], [lu + 2.4, ly + 0.75]], { stroke: ROUTE, 'stroke-width': 2.4, 'stroke-dasharray': '6 3', 'marker-end': 'url(#bp-arrow)' });
    label(lu + 3.3, ly + 1.35, name, 't-note', 12);
    lu += 3.3 + name.length * 0.62 + 2.2;
  });
  host.replaceChildren(cv.svg);
}

/* ---------- Figure: the bed layouts across the tunnel, seen from the end ---------- */
function gothicBedSections(host) {
  const span = GOTHIC.span, half = span / 2, peak = GOTHIC.peak, opts = bedOptions(), gap = 5, step = span + gap;
  const cv = canvas({ u0: -1.5, u1: opts.length * span + (opts.length - 1) * gap + 1.5, v0: -4.6, v1: peak + 4.6, scale: 14, up: true, margin: { l: 4, r: 4, t: 4, b: 4 },
    title: `The bed layouts across the ${span} ft width, seen from the end under the hoop: ${opts.map(o => `${o.letter}, ${o.name.toLowerCase()}, ${fmt(o.area)} sq ft of beds`).join('; ')}. A six-foot person stands in the first walking row of each.` });
  const { line, poly, rect, text } = cv;
  const label = (u, v, str, cls = '', size = 12, extra = {}) => text(u, v, str, { class: `halo ${cls}`.trim(), 'font-size': size, ...extra });
  const d7 = archReach(GOTHIC.chordFt);

  opts.forEach((o, i) => {
    const U = u => u + i * step;
    rect(U(-0.8), -1.6, U(span + 0.8), 0, { fill: C.soil });
    line([[U(-0.8), 0], [U(span + 0.8), 0]], { stroke: C.ink, 'stroke-width': 1.4 });
    const pts = [[U(0), 0]]; for (let k = 0; k <= 80; k++) { const dd = k * span / 80; pts.push([U(dd), ARCH.height(dd)]); }
    pts.push([U(span), 0]);
    poly(pts, { fill: C.glassFill, stroke: C.glass, 'stroke-width': 3 });
    line([[U(d7), GOTHIC.chordFt], [U(span - d7), GOTHIC.chordFt]], { stroke: C.glass, 'stroke-width': 1.3, 'stroke-dasharray': '5 3' });
    o.strips.forEach(s => {
      if (s.kind === 'bed') rect(U(s.v0), 0, U(s.v1), 0.7, { fill: C.bed, opacity: 0.9, stroke: '#4F7A34', 'stroke-width': 1 });
      if (s.kind === 'lane') rect(U(s.v0), -1.6, U(s.v1), 0, { fill: '#9FB6C7' });
      if (s.kind !== 'row') label(U((s.v0 + s.v1) / 2), -0.98, num(s.w), 't-b', 12, { 'text-anchor': 'middle' });
    });
    const lane = o.strips.find(s => s.kind === 'lane'), row1 = o.strips[1], c1 = (row1.v0 + row1.v1) / 2;
    if (lane) label(U(half), 2.1, `${feet(o.lane)} cart lane`, 't-b', 12, { 'text-anchor': 'middle' });
    drawPerson(cv, U(c1));
    if (i === 0) {
      label(U(c1) + 1.1, 3.2, '6 ft person', 't-note', 11.5, { 'text-anchor': 'start' });
      label(U(half), GOTHIC.chordFt + 0.45, `truss chord ${GOTHIC.chordFt} ft`, 't-glass', 11.5, { 'text-anchor': 'middle' });
    }
    dimH(cv, U(0), U(span), -3.5, `${span} ft`, 11.5);
    label(U(half), peak + 3.4, `${o.letter}. ${o.name}`, 't-b', 14, { 'text-anchor': 'middle' });
    label(U(half), peak + 1.9, `${fmt(o.area)} sq ft of beds, ${fmt(100 * o.share, 0)}% of the floor`, 't-note', 12.5, { 'text-anchor': 'middle' });
  });
  host.replaceChildren(cv.svg);
}

/* ---------- Figure: gothic tunnel plan with the post rows ---------- */
function gothicPosts(host) {
  const Lg = GOTHIC.length, W = GOTHIC.span, bays = Math.round(Lg * 12 / GOTHIC.hoopSpacingIn[0]), step = Lg / bays;
  const cv = canvas({ u0: -6, u1: Lg + 6, v0: -7, v1: W + 6, scale: 12, margin: { l: 4, r: 4, t: 4, b: 4 },
    title: `Plan of the gothic tunnel, ${Lg} by ${W} feet, north up: two rows of ${bays + 1} posts about ${fmt(step * 12, 1)} inches apart, the joint between the two ${GOTHIC.kitLength} ft bays, and a door in each end wall.` });
  const { line, rect, circle, text } = cv;
  const label = (u, v, str, cls = '', size = 12, extra = {}) => text(u, v, str, { class: `halo ${cls}`.trim(), 'font-size': size, ...extra });
  rect(0, 0, Lg, W, { fill: C.glassFill, stroke: C.glass, 'stroke-width': 3 });
  for (let i = 0; i <= bays; i++) line([[i * step, 0], [i * step, W]], { stroke: C.glass, 'stroke-width': 0.9, opacity: 0.55 });
  line([[GOTHIC.kitLength, -0.8], [GOTHIC.kitLength, W + 0.8]], { stroke: '#8A3B12', 'stroke-width': 2, 'stroke-dasharray': '6 3' });
  for (let i = 0; i <= bays; i++) [0, W].forEach(v => circle(i * step, v, 0.4, { fill: C.post, stroke: '#2F1E0E', 'stroke-width': 1 }));
  // The end doors, as the layout in ENDWALL.ends draws them: the wide door centered, the standard door in the bay beside the center line
  [[0, ENDWALL.ends.west], [Lg, ENDWALL.ends.east]].forEach(([u, kind]) => { const [a, b] = endDoorSpan(kind); rect(u - 0.9, a, u + 0.9, b, { fill: '#fff', stroke: C.glass, 'stroke-width': 2 }); });
  line([[0, W / 2], [Lg, W / 2]], { stroke: C.glass, 'stroke-width': 1.3, 'stroke-dasharray': '8 4' });
  label(Lg / 4, W / 2 - 1, `bay 1: ${GOTHIC.kitLength} ft (one standard kit)`, 't-glass', 12.5, { 'text-anchor': 'middle' });
  label(Lg * 3 / 4, W / 2 - 1, `bay 2: ${GOTHIC.kitLength} ft (a second kit)`, 't-glass', 12.5, { 'text-anchor': 'middle' });
  label(Lg / 4, W / 2 + 2.6, `${bays + 1} posts a row at about ${fmt(step * 12, 1)} in: ${2 * (bays + 1)} in all`, 't-note', 12, { 'text-anchor': 'middle' });
  label(Lg * 3 / 4, W / 2 + 2.6, 'ridge line (dashed)', 't-note', 12, { 'text-anchor': 'middle' });
  label(1.2, endDoorSpan(ENDWALL.ends.west)[0] - 0.7, ENDWALL.ends.west === 'wide' ? 'wide door' : 'door', 't-note', 11, { 'text-anchor': 'start' });
  label(Lg - 1.2, endDoorSpan(ENDWALL.ends.east)[0] - 0.7, ENDWALL.ends.east === 'wide' ? 'wide door' : 'door', 't-note', 11, { 'text-anchor': 'end' });
  dimH(cv, 0, GOTHIC.kitLength, -3.6, `${GOTHIC.kitLength} ft`, 12.5);
  dimH(cv, GOTHIC.kitLength, Lg, -3.6, `${GOTHIC.kitLength} ft`, 12.5);
  dimH(cv, 0, Lg, -5.6, `${Lg} ft east to west`, 13);
  dimV(cv, -1.8, 0, W, `${W} ft`, 13, 'left');
  cv.add(svgNode('path', { d: `M${cv.X(Lg + 3.2)},${cv.Y(5.4)}L${cv.X(Lg + 4.2)},${cv.Y(2.4)}L${cv.X(Lg + 3.2)},${cv.Y(3.2)}L${cv.X(Lg + 2.2)},${cv.Y(2.4)}Z`, fill: C.ink }));
  label(Lg + 3.2, 7.3, 'N', 't-b', 13, { 'text-anchor': 'middle' });
  host.replaceChildren(cv.svg);
}

// Planning season for both unheated CatchSunlight tunnels: 6 mm four-layer polycarbonate, vendor R-2.2, a tight base, and a row cover on cold nights.
// Offsets are allowances against the Prairie SNOTEL medians, not measured temperatures inside the tunnel.
// Cold crops open 4 weeks before the typical last 28°F night and run 2 weeks past the typical first 24°F night.
// Tender crops are set 3 weeks before the typical last 32°F night. A night near 24°F outside still ends them.
function addDays(monthDay, days) {
  const lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let n = root.SiteClimate.dayNumber(monthDay) + days, month = 1;
  while (n > lengths[month - 1]) { n -= lengths[month - 1]; month += 1; }
  return `${String(month).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
}
function tunnelSeason() {
  const C = root.SiteClimate;
  const f32 = C.planningDates(32), f28 = C.planningDates(28), f24 = C.planningDates(24);
  return {
    glazing: '6 mm four-layer polycarbonate, vendor R-2.2',
    outdoor: { spring32: f32.springMedian, fall32: f32.fallMedian, free32: f32.freeDays.p50, spring28: f28.springMedian, fall24: f24.fallMedian },
    cold: { start: addDays(f28.springMedian, -28), end: addDays(f24.fallMedian, 14) },
    tender: { set: addDays(f32.springMedian, -21), end: f24.fallMedian }
  };
}
// The pit uses the same roof panels, and the berm, the sunk floor, and the water drums hold night heat the tunnels cannot.
// It opens 6 weeks before the tunnels' cold crops, raises tender starts 8 weeks before they are set in a tunnel, and runs 4 weeks past the tunnels' cold-crop close.
// A night in the teens can still freeze a flat, so starts get a cover. December through February is still not a production season: the 27° roof is a weak winter collector.
function pitSeason() {
  const tunnel = tunnelSeason();
  return {
    glazing: tunnel.glazing,
    mass: '6 ft sunk floor, earth berm to the roof line, water drums on the north wall',
    hardyStarts: addDays(tunnel.cold.start, -42),
    tenderStarts: addDays(tunnel.tender.set, -56),
    cold: { start: addDays(tunnel.cold.start, -42), end: addDays(tunnel.cold.end, 28) },
    tenderEnd: addDays(tunnel.tender.end, 21),
    tunnel
  };
}

root.Greenhouse = {
  SYM, GOTHIC, ENDWALL, BEDS, PIT, BERM, SOIL, CUT, ARCH, SWELL, ORCHARD_EDGE_Y, R1_Y, SECTION_X, UPSLOPE_SQFT, ALLEY, SWALE, C,
  fmt, num, feet, clock, setText, svgNode, element, canvas, groundFt, site, latitude, declinationOf, sunPosition, shadowRow, bermOption, bermClearWindow, r1ShadeHours, beamShare,
  fitPlane, padCutFill, pitExcavation, bermVolume, bermOutline, openCut, wallToCut, swaleClearance, runoffInches, gallons, annualRainIn, endwallOpenings, endDoorSpan, bedLayout, bedOptions, archReach, roofRange,
  siteMap, siteSection, pitPlan, pitSection, gothicSection, gothicEndwalls, gothicBeds, gothicBedSections, gothicPosts,
  tunnelSeason, pitSeason, SUN_DATES
};
})(typeof window !== 'undefined' ? window : globalThis);
