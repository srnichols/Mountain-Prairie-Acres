// The four elevations of the workshop: the east gable (front) and west gable (back), and the north and south sidewalls.
// Part of WorkshopDraw (workshop_draw.js holds the drawing kit and must load first).
(function (root) {
'use strict';
const D = root.WorkshopDraw;
if (!D || !D.kit) throw new Error('Load workshop_draw.js before workshop_elevations.js');
const { r2, rect, line, poly, polyline, path, text, lines, svg, dimH, tick, mk, feetInches, windowView } = D.kit;

// The height of the gable wall (and of the roof's underside) at a distance y from the north wall.
function gableZ(m, y) {
  const d = Math.min(y, m.width - y);
  return d <= m.knuckleRun ? m.eave + m.knuckleRise * d / m.knuckleRun : m.knuckleZ + m.upperRise * (d - m.knuckleRun) / m.upperRun;
}
// The pad surface, below the slab top by the slab, the foam, and the gravel.
const gradeOf = m => -(m.slabInches + 8) / 12;
const SPLASH_TOP = -0.31;   // a 9¼″ splash board standing on the pad surface

// A small W6 beam end, a hook, and its chain: the hoist as seen from the front.
function hoistEnd(cx, cy) {
  return rect(cx - 5, cy - 5, 10, 2, 'c-steel') + rect(cx - 1, cy - 3, 2, 6, 'c-steel') + rect(cx - 5, cy + 3, 10, 2, 'c-steel')
    + line(cx, cy + 5, cx, cy + 22, 'l-dim') + path(`M ${r2(cx - 3)} ${r2(cy + 22)} q 0 6 3 6 q 3 0 3 -6`, 'l-dim', { fill: 'none' });
}

// The deck's railing, seen from the front or the side: a top rail, the end posts, and balusters every 6 in.
function railing(a, b, zFloor, zTop, Z, X) {
  const o = [line(X(a), Z(zTop), X(b), Z(zTop), 'l-rail'), line(X(a), Z(zFloor), X(a), Z(zTop), 'l-rail'), line(X(b), Z(zFloor), X(b), Z(zTop), 'l-rail')];
  for (let v = a + 0.5; v < b - 1e-9; v += 0.5) o.push(line(X(v), Z(zFloor), X(v), Z(zTop), 'l-joist'));
  return o.join('');
}

// The gable wall (front or back): ground, wall, siding seams, and rake trim.
function gableView(m, o) {
  const s = o.s, W = m.width, grade = gradeOf(m);
  const Y = o.flip ? y => o.ox + (W - y) * s : y => o.ox + y * s;
  const Z = z => o.gy - (z - grade) * s;
  const S = (y0, y1) => [Math.min(Y(y0), Y(y1)), Math.abs(Y(y1) - Y(y0))];
  const parts = [rect(0, Z(grade), o.width, o.height - Z(grade), 'c-ground')];
  parts.push(poly([[Y(0), Z(grade)], [Y(0), Z(m.eave)], [Y(m.knuckleRun), Z(m.knuckleZ)], [Y(m.half), Z(m.peakZ)], [Y(W - m.knuckleRun), Z(m.knuckleZ)], [Y(W), Z(m.eave)], [Y(W), Z(grade)]], 'c-wall'));
  for (let y = 3; y < W; y += 3) parts.push(line(Y(y), Z(SPLASH_TOP), Y(y), Z(gableZ(m, y)) + 4, 'l-seam'));
  const splash = (y0, y1) => { const [x, w] = S(y0, y1); return rect(x, Z(SPLASH_TOP), w, (SPLASH_TOP - grade) * s, 'c-ptwood'); };
  const tx = m.eaveTail * m.knuckleRun / m.lowerLen, tz = m.eaveTail * m.knuckleRise / m.lowerLen;
  const trim = polyline([[Y(-tx), Z(m.eave - tz)], [Y(0), Z(m.eave)], [Y(m.knuckleRun), Z(m.knuckleZ)], [Y(m.half), Z(m.peakZ)], [Y(W - m.knuckleRun), Z(m.knuckleZ)], [Y(W), Z(m.eave)], [Y(W + tx), Z(m.eave - tz)]], 'c-trim');
  return { Y, Z, S, parts, splash, trim, grade, s };
}
// Height marks (floor, eave, knuckle, peak) as a vertical dimension at x, with guide lines back to the building at fromX.
function heightMarks(m, Z, x, fromX, toLeft) {
  const o = [];
  [[0, 'floor 0′'], [m.eave, `${m.eave}′ eave (loft floor)`], [m.knuckleZ, `${m.knuckleZ}′ knuckle`], [m.peakZ, `${m.peakZ}′ peak`]].forEach(([z, label]) => {
    o.push(line(fromX, Z(z), x + (toLeft ? -4 : 4), Z(z), 'l-ext'), tick(x, Z(z)), text(x + (toLeft ? -8 : 8), Z(z) + 4, label, toLeft ? 't-s t-e' : 't-s'));
  });
  o.push(line(x, Z(0), x, Z(m.peakZ), 'l-dim'));
  return o.join('');
}

function eastElevation(m) {
  const s = 10, W = m.width, o = [];
  const v = gableView(m, { s, ox: 120, gy: 372, flip: true, width: 760, height: 440 });
  const { Y, Z, S, grade } = v;
  const edge = Y(0);   // the building's right-hand edge: the north wall is on the right when facing west
  o.push(text(380, 22, 'EAST ELEVATION (FRONT)', 't-title t-m'), ...v.parts, v.splash(0, m.doorY0), v.splash(m.doorY1, W));
  // main overhead door: five panels, the top one with lites
  const dw = m.mainDoor.width, dh = m.mainDoor.height, panel = dh / 5, [dx, dwpx] = S(m.doorY0, m.doorY1);
  o.push(rect(dx, Z(dh), dwpx, dh * s, 'c-door'));
  for (let k = 1; k < 5; k++) o.push(line(dx, Z(k * panel), dx + dwpx, Z(k * panel), 'l-seam-d'));
  for (let k = 0; k < 5; k++) o.push(rect(dx + 8 + k * (dwpx - 16) / 5, Z(dh) + 5, (dwpx - 16) / 5 - 6, panel * s - 10, 'c-glass'));
  o.push(text(dx + dwpx / 2, Z(6.5), `${dw}′ × ${dh}′`, 't-b t-m'), text(dx + dwpx / 2, Z(6.5) + 14, 'insulated overhead door', 't-s t-m'));
  // loft double doors above it, at the loft floor
  const ldh = m.loftDoor.height, [lx, lw] = S(m.loftDoorY0, m.loftDoorY1);
  o.push(rect(lx, Z(m.eave + ldh), lw, ldh * s, 'c-door'), line(lx + lw / 2, Z(m.eave), lx + lw / 2, Z(m.eave + ldh), 'l-seam-d'));
  o.push(rect(lx + 3, Z(m.eave + ldh) + 3, lw / 2 - 6, 15, 'c-glass'), rect(lx + lw / 2 + 3, Z(m.eave + ldh) + 3, lw / 2 - 6, 15, 'c-glass'));
  o.push(lines(lx - 8, Z(m.eave + ldh + 1.2), [`${m.loftDoor.width}′ × ${ldh}′`, 'loft doors'], 't-s t-e t-white', 11));
  // the free-standing deck: fascia, two posts with knee braces, and the 42 in rail
  const beam = 0.8, [kx, kw] = S(m.deckY0, m.deckY1);
  o.push(rect(kx, Z(m.eave), kw, beam * s, 'c-deck'));
  [m.deckY0, m.deckY1].forEach(y => {
    o.push(rect(Y(y) - 2.5, Z(m.eave - beam), 5, (m.eave - beam - grade) * s, 'c-ptwood'));
    const toward = y < m.half ? 1 : -1;
    o.push(line(Y(y), Z(m.eave - beam - 4), Y(y + toward * 4), Z(m.eave - beam), 'l-beam'));
  });
  const rail = m.eave + m.deck.rail;
  o.push(line(kx, Z(rail), kx + kw, Z(rail), 'l-rail'), line(kx, Z(m.eave), kx, Z(rail), 'l-rail'), line(kx + kw, Z(m.eave), kx + kw, Z(rail), 'l-rail'));
  for (let y = m.deckY0 + 0.5; y < m.deckY1 - 1e-9; y += 0.5) o.push(line(Y(y), Z(m.eave), Y(y), Z(rail), 'l-joist'));
  o.push(text(edge - 8, Z(m.eave - 1.1) + 4, `${m.deck.width}′ × ${m.deck.depth}′ deck`, 't-s t-e t-white'));
  o.push(hoistEnd(Y(m.half), Z(m.hoistZ)), v.trim);
  o.push(mk(dx + dwpx / 2, Z(10), '2'), mk(lx + lw / 2, Z(m.eave + 3.3) + 4, '9'), mk(kx + 20, Z(m.eave) + 26, '10'), mk(Y(m.half) + 22, Z(m.hoistZ) - 2, '11'));
  // dimensions
  o.push(heightMarks(m, Z, edge + 60, edge, false));
  o.push(dimH(Y(W), edge, Z(grade) + 32, `${feetInches(W)} gable width`, { bold: true }));
  o.push(text(edge + 6, Z(grade) + 13, 'pad surface (grade), 1′-1″ below the floor', 't-s'));
  return svg(760, 440, o, 'East elevation, the front gable');
}

function westElevation(m) {
  const s = 10, W = m.width, o = [];
  const v = gableView(m, { s, ox: 120, gy: 372, flip: false, width: 760, height: 440 });
  const { Y, Z, grade } = v;
  const edge = Y(W);
  o.push(text(380, 22, 'WEST ELEVATION (BACK)', 't-title t-m'), ...v.parts, v.splash(0, W));
  // mini-split condenser on its pad at the base (the owner picks the west or the south wall)
  o.push(rect(Y(5) - 3, Z(0.1), 3 * s + 6, 0.25 * s, 'c-conc'), rect(Y(5), Z(2.8), 3 * s, 2.7 * s, 'c-unit'), text(Y(6.5), Z(1.5) + 3, 'M-S', 't-s t-m t-white t-b'));
  o.push(mk(Y(6.5), Z(3.4) - 8, '8'));
  // the loft window, centered in the gable (the main floor has no openings on this end)
  const loftWin = m.windows.find(w => w.wall === 'W');
  if (loftWin) {
    const wx = Y(loftWin.at - loftWin.width / 2), ww = loftWin.width * s, zMid = loftWin.sill + loftWin.height / 2;
    o.push(windowView(wx, Z(loftWin.sill + loftWin.height), ww, loftWin.height * s, 'hung'));
    o.push(lines(wx - 8, Z(zMid) - 2, ['loft window', `${loftWin.width}′ × ${loftWin.height}′`], 't-s t-e t-white', 11), mk(wx + ww + 18, Z(zMid), '15'));
  }
  o.push(text(Y(W / 2), Z(8), 'no openings on the main floor', 't-m t-white t-i'));
  o.push(v.trim);
  o.push(heightMarks(m, Z, edge + 60, edge, false));
  o.push(dimH(Y(0), edge, Z(grade) + 32, `${feetInches(W)} gable width`, { bold: true }));
  o.push(text(edge + 6, Z(grade) + 13, 'pad surface (grade), 1′-1″ below the floor', 't-s'));
  return svg(760, 440, o, 'West elevation, the back gable');
}

// A sidewall. `south` is seen from the south (west on the left, with the walk door); otherwise from the north (east on the left).
function sideElevation(m, south) {
  const s = 10, L = m.length, o = [];
  const ox = 150, W = 800, H = 440;
  const grade = gradeOf(m), gy = 372;
  const X = south ? x => ox + x * s : x => ox + (L - x) * s;
  const Z = z => gy - (z - grade) * s;
  const S = (x0, x1) => [Math.min(X(x0), X(x1)), Math.abs(X(x1) - X(x0))];
  const tz = m.eaveTail * m.knuckleRise / m.lowerLen, rake = m.rakeOverhang;
  o.push(text(400, 22, south ? 'SOUTH ELEVATION (RIGHT SIDEWALL, SEEN FROM THE SOUTH)' : 'NORTH ELEVATION (LEFT SIDEWALL, SEEN FROM THE NORTH)', 't-title t-m'));
  o.push(rect(0, Z(grade), W, H - Z(grade), 'c-ground'));
  // apron and wall
  const [ax, aw] = S(L, L + 20);
  o.push(rect(ax, Z(grade), aw, 0.42 * s, 'c-conc'));
  const [wx, ww] = S(0, L);
  o.push(rect(wx, Z(m.eave), ww, (m.eave - grade) * s, 'c-wall'));
  for (let x = 3; x < L; x += 3) o.push(line(X(x), Z(SPLASH_TOP), X(x), Z(m.eave), 'l-seam'));
  const wx0 = m.walkX - m.walkDoor.width / 2, wx1 = m.walkX + m.walkDoor.width / 2;
  const splash = (x0, x1) => { const [x, w] = S(x0, x1); return rect(x, Z(SPLASH_TOP), w, (SPLASH_TOP - grade) * s, 'c-ptwood'); };
  if (south) o.push(splash(0, wx0), splash(wx1, L)); else o.push(splash(0, L));
  m.postX.forEach(x => o.push(line(X(x), Z(grade), X(x), Z(m.eave), 'l-post')));
  // the windows, centered in their bays, with one marker and a size under the middle one
  const wins = m.windows.filter(w => w.wall === (south ? 'S' : 'N'));
  wins.forEach(w => { const [wxp, wwp] = S(w.at - w.width / 2, w.at + w.width / 2); o.push(windowView(wxp, Z(w.sill + w.height), wwp, w.height * s)); });
  if (wins.length) {
    const mid = wins[1] || wins[0];
    o.push(mk(X(mid.at), Z(mid.sill + mid.height / 2), '15'), text(X(mid.at), Z(mid.sill) + 15, `${wins.length} windows, ${mid.width}′ × ${mid.height}′, sill ${mid.sill}′`, 't-s t-m t-white'));
  }
  // roof: the lower slope and the upper slope face the viewer, with the eave and the gable overhangs
  const [rx, rw] = S(-rake, L + rake);
  o.push(rect(rx, Z(m.knuckleZ), rw, (m.knuckleZ - (m.eave - tz)) * s, 'c-roof'), rect(rx, Z(m.peakZ), rw, (m.peakZ - m.knuckleZ) * s, 'c-roof2'));
  for (let x = -rake + 3; x < L + rake; x += 3) o.push(line(X(x), Z(m.eave - tz), X(x), Z(m.peakZ), 'l-seam-d'));
  o.push(line(rx, Z(m.knuckleZ), rx + rw, Z(m.knuckleZ), 'l-dim'), line(rx, Z(m.peakZ), rx + rw, Z(m.peakZ), 'l-wall'));
  o.push(text(rx + rw / 2, Z((m.eave - tz + m.knuckleZ) / 2) + 3, 'lower slope', 't-s t-m t-i'), text(rx + rw / 2, Z((m.knuckleZ + m.peakZ) / 2) + 3, 'upper slope', 't-s t-m t-i'));
  // the deck at the east end, with its posts, braces, rail, and the hoist beam outside the wall
  const beam = 0.8, [dx, dw] = S(L, L + m.deck.depth);
  o.push(rect(dx, Z(m.eave), dw, beam * s, 'c-deck'));
  [L + m.deck.postInset, L + m.deck.depth - m.deck.postInset].forEach((x, i) => {
    o.push(rect(X(x) - 2.5, Z(m.eave - beam), 5, (m.eave - beam - grade) * s, 'c-ptwood'));
    const toward = i === 0 ? 1 : -1;
    o.push(line(X(x), Z(m.eave - beam - 4), X(x + toward * 4), Z(m.eave - beam), 'l-beam'));
  });
  const rail = m.eave + m.deck.rail;
  o.push(railing(L, L + m.deck.depth, m.eave, rail, Z, X));
  const [hx, hw] = S(L, L + m.hoist.out);
  o.push(rect(hx, Z(m.hoistZ + 0.35), hw, 0.7 * s, 'c-steel'));
  const hookX = X(L + m.hoist.out - 0.4);
  o.push(line(hookX, Z(m.hoistZ - 0.35), hookX, Z(m.hoistZ - 2.4), 'l-dim'), path(`M ${r2(hookX - 3)} ${r2(Z(m.hoistZ - 2.4))} q 0 6 3 6 q 3 0 3 -6`, 'l-dim', { fill: 'none' }));
  const out = south ? 1 : -1;
  o.push(text(X(L + m.hoist.out) + out * 8, Z(m.hoistZ) + 4, 'W6 hoist beam', south ? 't-s' : 't-s t-e'));
  o.push(mk(X(L + m.deck.depth / 2), Z(m.eave) + 30, '10'), mk(X(L + m.hoist.out / 2), Z(m.hoistZ) - 20, '11'));
  if (south) {
    // the walk door, the snow guards on the lower slope above it, and the stair behind the wall
    const [dx, ddw] = S(wx0, wx1), dh = m.walkDoor.height;
    o.push(rect(dx, Z(dh), ddw, dh * s, 'c-door'), rect(dx + 5, Z(dh) + 6, ddw - 10, 16, 'c-glass'), rect(dx + ddw - 7, Z(3.4), 3, 6, 'c-steel'));
    o.push(text(dx + ddw + 4, Z(dh) - 6, `${m.walkDoor.width}′ × ${dh}′ walk door`, 't-s t-e t-white'));
    const zGuard = m.eave - tz + 2.5 * m.knuckleRise / m.lowerLen + 0.2;
    for (let x = m.walkX - 4.5; x <= m.walkX + 4.5 + 1e-9; x += 1.5) o.push(rect(X(x) - 2, Z(zGuard) - 3, 4, 6, 'c-steel'));
    o.push(text(X(m.walkX - 5.4), Z(zGuard) + 3, 'snow guards over the door', 't-s t-e'));
    o.push(mk(X(m.walkX), Z(dh) - 34, '3'), mk(X(m.walkX + 6.6), Z(zGuard), '14'));
    const tread = m.stair.tread / 12, n = m.stairTreads, ld = m.stair.landing;
    o.push(polyline([[X(ld + n * tread), Z(0)], [X(ld), Z(m.stair.rise)], [X(0), Z(m.stair.rise)], [X(0), Z(m.eave)], [X(m.stair.width), Z(m.eave)]], 'l-hidden', { stroke: '#e8d8d0' }));
    o.push(text(X(9.6), Z(4) + 4, 'stair inside (dashed)', 't-s t-white t-i'));
  }
  // dimensions: the post bays, the length, and the heights on the west end
  let at = 0;
  m.bays.forEach(bay => { o.push(dimH(X(at), X(at + bay), Z(grade) + 24, `${bay}′`)); at += bay; });
  o.push(dimH(X(0), X(L), Z(grade) + 42, `${feetInches(L)} sidewall length`, { bold: true }));
  const markX = south ? X(0) - 60 : X(0) + 60;
  o.push(heightMarks(m, Z, markX, south ? X(-rake) : X(-rake), south));
  return svg(W, H, o, south ? 'South elevation, the right sidewall' : 'North elevation, the left sidewall');
}

const northElevation = m => sideElevation(m, false);
const southElevation = m => sideElevation(m, true);

root.WorkshopDraw = Object.assign(root.WorkshopDraw, { eastElevation, westElevation, northElevation, southElevation, gableZ, gradeOf });
})(typeof window !== 'undefined' ? window : globalThis);
