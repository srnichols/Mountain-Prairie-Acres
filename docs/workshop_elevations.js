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
  // the two hoist braces meet at the bottom flange of the beam's tip
  const apex = Z(m.hoistZ) + 5, bl = m.hoistBraces[1];
  m.hoistBraces.forEach(b => o.push(line(Y(b.foot[1]), Z(b.foot[2]), Y(b.tip[1]), apex, 'l-brace')));
  o.push(hoistEnd(Y(m.half), Z(m.hoistZ)), v.trim);
  o.push(mk(dx + dwpx / 2, Z(10), '2'), mk(lx + lw / 2, Z(m.eave + 3.3) + 4, '9'), mk(kx + 20, Z(m.eave) + 26, '10'), mk(Y(m.half) + 22, Z(m.hoistZ) - 2, '11'), mk((Y(bl.foot[1]) + Y(bl.tip[1])) / 2, (Z(bl.foot[2]) + apex) / 2, '17'));
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
  // the deck at the east end, with its posts, braces, rail, and the hoist beam and its brace outside the wall
  const beam = 0.8, [dx, dw] = S(m.deckX0, m.deckX1);
  o.push(rect(dx, Z(m.eave), dw, beam * s, 'c-deck'));
  [m.deckX0 + m.deck.postInset, m.deckX1 - m.deck.postInset].forEach((x, i) => {
    o.push(rect(X(x) - 2.5, Z(m.eave - beam), 5, (m.eave - beam - grade) * s, 'c-ptwood'));
    const toward = i === 0 ? 1 : -1;
    o.push(line(X(x), Z(m.eave - beam - 4), X(x + toward * 4), Z(m.eave - beam), 'l-beam'));
  });
  const rail = m.eave + m.deck.rail;
  o.push(railing(m.deckX0, m.deckX1, m.eave, rail, Z, X));
  const [hx, hw] = S(L, L + m.hoist.out);
  o.push(rect(hx, Z(m.hoistZ + 0.35), hw, 0.7 * s, 'c-steel'));
  const bs = m.hoistBraces[0], onBrace = t => [X(bs.foot[0] + t * (bs.tip[0] - bs.foot[0])), Z(bs.foot[2] + t * (bs.tip[2] - bs.foot[2]))];
  o.push(line(...onBrace(0), ...onBrace(1), 'l-brace'));
  const hookX = X(m.hoistHookX);
  o.push(line(hookX, Z(m.hoistZ - 0.35), hookX, Z(m.hoistZ - 2.4), 'l-dim'), path(`M ${r2(hookX - 3)} ${r2(Z(m.hoistZ - 2.4))} q 0 6 3 6 q 3 0 3 -6`, 'l-dim', { fill: 'none' }));
  o.push(text(X(L + m.hoist.out / 2), Z(m.hoistZ + 0.35) - 8, 'W6 hoist beam', 't-s t-m'));
  o.push(mk(X((m.deckX0 + m.deckX1) / 2), Z(m.eave) + 30, '10'), mk(X(L + 3), Z(m.hoistZ) + 20, '11'), mk(...onBrace(0.45), '17'));
  if (south) {
    // the walk door, the snow guards on the lower slope above it, and the stair behind the wall
    const [dx, ddw] = S(wx0, wx1), dh = m.walkDoor.height;
    o.push(rect(dx, Z(dh), ddw, dh * s, 'c-door'), rect(dx + 5, Z(dh) + 6, ddw - 10, 16, 'c-glass'), rect(dx + ddw - 7, Z(3.4), 3, 6, 'c-steel'));
    o.push(text(dx + ddw + 4, Z(dh) - 6, `${m.walkDoor.width}′ × ${dh}′ walk door`, 't-s t-e t-white'));
    const zGuard = m.eave - tz + 2.5 * m.knuckleRise / m.lowerLen + 0.2;
    for (let x = m.walkX - 4.5; x <= m.walkX + 4.5 + 1e-9; x += 1.5) o.push(rect(X(x) - 2, Z(zGuard) - 3, 4, 6, 'c-steel'));
    o.push(text(X(m.walkX - 5.4), Z(zGuard) + 3, 'snow guards over the door', 't-s t-e'));
    o.push(mk(X(m.walkX), Z(dh) - 34, '3'), mk(X(m.walkX + 6.6), Z(zGuard), '14'));
    const ld = m.stair.landing, [f1] = m.flights;
    o.push(polyline([[X(ld + f1.run), Z(0)], [X(ld), Z(m.landingZ)], [X(0), Z(m.landingZ)], [X(0), Z(m.eave)], [X(m.stair.width), Z(m.eave)]], 'l-hidden', { stroke: '#e8d8d0' }));
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

// ------------------------------------------------------------------ wall framing: the girts

// Feet and inches to the half inch: 13′-6½″.
const ftIn = z => {
  const half = Math.round(z * 24), ft = Math.floor(half / 24), rest = (half - ft * 24) / 2;
  return `${ft}′-${Number.isInteger(rest) ? rest : `${Math.floor(rest)}½`}″`;
};
const plainFeet = v => (Number.isInteger(v) ? `${v}′` : feetInches(v));

// One wall's framing as seen from outside with the steel, furring, and sheathing taken off: the posts behind, the girts in front, and the openings cut through
// the rows they cross. `o` is { ox, oy, s, flip, caption }: the left edge of the wall, the eave line, pixels per foot, whether plan positions run right to left.
function framedWall(m, key, o) {
  const g = m.girts, wall = g.walls[key], s = o.s, face = g.face / 12, pad = -m.padToFloor, jack = g.thick / 12;
  const X = t => (o.flip ? o.ox + (wall.length - t) * s : o.ox + t * s);
  const Z = z => o.oy + (m.eave - z) * s;
  const S = (a, b) => [Math.min(X(a), X(b)), Math.abs(X(b) - X(a))];
  const right = o.ox + wall.length * s, out = [];
  out.push(text(o.ox, o.oy - 40, o.caption, 't-b'));
  wall.posts.slice(1).forEach((p, i) => out.push(dimH(X(wall.posts[i]), X(p), o.oy - 22, plainFeet(p - wall.posts[i]))));
  // the pad, the floor, and the openings (doors reach down to the pad)
  out.push(line(o.ox - 6, Z(pad), right + 6, Z(pad), 'l-wall', { 'stroke-width': 1 }), line(o.ox - 6, Z(0), right + 6, Z(0), 'l-dash'));
  out.push(text(right + 8, Z(pad) + 3, 'pad', 't-s'), text(right + 8, Z(0) + 3, 'floor', 't-s'));
  wall.openings.forEach(op => { const [x, w] = S(op.a, op.b); out.push(rect(x, Z(op.z1), w, (op.z1 - op.z0) * s, 'c-opening')); });
  wall.posts.forEach(p => { const [x, w] = S(p - 2.25 / 12, p + 2.25 / 12); out.push(rect(x, Z(m.eave), w, (m.eave - pad - 0.1) * s, 'c-post c-ghost')); });
  // the splash board, a treated 2×10 on the posts at the foot of the wall, stopping at the doors
  const splash = g.splashInches / 12, cuts = wall.openings.filter(op => op.z0 <= pad + 1e-9).map(op => [op.a, op.b]).sort((x, y) => x[0] - y[0]);
  let from = 0;
  [...cuts, [wall.length, wall.length]].forEach(([a, b]) => {
    if (a > from + 1e-9) { const [x, w] = S(from, a); out.push(rect(x, Z(pad + splash), w, splash * s, 'c-ptwood')); }
    from = Math.max(from, b);
  });
  out.push(text(o.ox - 8, Z(pad + splash / 2) + 3, 'splash board', 't-s t-e'));
  // the girts, row by row: each piece is a rectangle, each butt joint over a post gets a tick, and each uncut board is labeled with its length
  g.rows.forEach(row => {
    const framed = wall.rows[row.index];
    framed.boards.forEach(board => {
      board.pieces.forEach(p => { const [x, w] = S(p.a, p.b); out.push(rect(x, Z(row.top), w, face * s, row.role === 'base' ? 'c-ptwood' : 'c-wood')); });
      if (board.pieces.length === 1 && board.length >= 3) {
        const next = wall.posts.find(p => p > board.a + 1e-9);
        out.push(text(X((board.a + Math.min(next, board.b)) / 2), Z(row.bottom + face / 2) + 3, plainFeet(board.length), 't-s t-m halo'));   // in the first bay, clear of the posts and the joints
      }
    });
    framed.joints.forEach(j => out.push(line(X(j), Z(row.top) - 2.5, X(j), Z(row.bottom) + 2.5, 'l-joint')));
    out.push(text(o.ox - 8, Z(row.bottom + face / 2) + 3, row.role === 'base' ? 'base girt' : ftIn(row.bottom), 't-s t-e'));
  });
  // each opening's framing and label: a window gets a sill and two jack studs under the girt that is its header; doors get jacks and an LVL header
  wall.openings.forEach(op => {
    const [cx, cy] = [X((op.a + op.b) / 2), Z((Math.max(op.z0, pad) + op.z1) / 2)];
    const header = (a, b, z0, z1) => { const [x, w] = S(a, b); out.push(rect(x, Z(z1), w, (z1 - z0) * s, 'c-lvl')); };
    const jacks = (z0, z1) => [[op.a - jack, op.a], [op.b, op.b + jack]].forEach(([a, b]) => { const [x, w] = S(a, b); out.push(rect(x, Z(z1), w, (z1 - z0) * s, 'c-wood')); });
    if (op.kind === 'window') {
      const [x, w] = S(op.a - jack, op.b + jack);
      out.push(rect(x, Z(op.z0), w, face * s, 'c-wood'));
      jacks(op.z0, op.z1);
      out.push(text(cx, cy + 3, `${plainFeet(op.b - op.a)} × ${plainFeet(op.z1 - op.z0)}`, 't-s t-m'));
    } else if (op.kind === 'walk door') {
      jacks(op.z0, op.z1);
      header(op.a - jack, op.b + jack, op.z1, op.z1 + 9.25 / 12);
      out.push(lines(cx, cy - 3, [`${plainFeet(op.b - op.a)} × ${plainFeet(op.z1)}`, 'door'], 't-s t-m', 11));
    } else {
      header(op.a, op.b, m.mainDoor.height, m.underLoft);
      out.push(text(cx, Z(m.underLoft) + (m.underLoft - m.mainDoor.height) * s / 2 + 3, 'LVL header', 't-s t-m'));
      const [bx, bw] = S(op.a, op.b);
      out.push(rect(bx, Z(m.eave), bw, (m.eave - m.underLoft) * s, 'c-wood'));
      out.push(lines(cx, cy, [`${plainFeet(op.b - op.a)} × ${plainFeet(m.mainDoor.height)} overhead door`, 'girt rows stop at the jambs'], 't-s t-m', 11));
    }
  });
  return out;
}

// The key to the colors and marks the framing sheets share.
function framingKey(x, y) {
  const items = [['c-wood', '2×6 girt, laid flat'], ['c-ptwood', 'PT base girt, splash board'], ['joint', 'joint over a post'], ['c-post c-ghost', 'post behind'], ['c-lvl', 'LVL header'], ['c-opening', 'opening']];
  const out = [];
  let at = x;
  items.forEach(([cls, label]) => {
    out.push(cls === 'joint' ? line(at + 6, y - 7, at + 6, y + 3, 'l-joint') : rect(at, y - 6, 14, 8, cls));
    out.push(text(at + 20, y + 2, label, 't-s'));
    at += 28 + label.length * 5;
  });
  return out.join('');
}

// The north and south walls, one above the other: 24 in OC rows, 16 ft boards, and the two row patterns that keep neighboring joints on different posts.
function sidewallFraming(m) {
  const s = 13, ox = 80, oy = 96, block = (m.eave + m.padToFloor) * s + 62, L = m.length;
  const width = ox + L * s + 44, o = [];
  o.push(text(width / 2, 20, 'SIDEWALL FRAMING: 2×6 GIRTS SCREWED TO THE POSTS (SEEN FROM OUTSIDE, STEEL AND SHEATHING OFF)', 't-title t-m'), framingKey(ox, 42));
  o.push(...framedWall(m, 'N', { ox, oy, s, flip: true, caption: 'NORTH WALL (east on the left)' }));
  o.push(...framedWall(m, 'S', { ox, oy: oy + block, s, flip: false, caption: 'SOUTH WALL (west on the left)' }));
  const rowY = Z => oy + (m.eave - Z) * s;
  o.push(line(ox + L * s + 2, rowY(m.girts.rows[2].top - 0.23), ox + L * s + 14, rowY(m.girts.rows[2].top - 0.23), 'l-ext'), mk(ox + L * s + 22, rowY(m.girts.rows[2].top - 0.23), '16'));
  return svg(width, Math.ceil(oy + block + (m.eave + m.padToFloor) * s + 14), o, 'Sidewall framing, the girts on the north and south walls');
}

// The west and east walls side by side.
function endwallFraming(m) {
  const s = 11, W = m.width, ox1 = 74, ox2 = ox1 + W * s + 118, oy = 96;
  const width = ox2 + W * s + 44, o = [];
  o.push(text(width / 2, 20, 'END WALL FRAMING: 2×6 GIRTS SCREWED TO THE POSTS (SEEN FROM OUTSIDE, STEEL AND SHEATHING OFF)', 't-title t-m'), framingKey(ox1, 42));
  o.push(...framedWall(m, 'W', { ox: ox1, oy, s, flip: false, caption: 'WEST WALL (north on the left)' }));
  o.push(...framedWall(m, 'E', { ox: ox2, oy, s, flip: true, caption: 'EAST WALL (north on the right)' }));
  const y = oy + (m.eave - (m.girts.rows[2].top - 0.23)) * s;
  o.push(line(ox1 + W * s + 2, y, ox1 + W * s + 14, y, 'l-ext'), mk(ox1 + W * s + 22, y, '16'));
  return svg(Math.ceil(width), Math.ceil(oy + (m.eave + m.padToFloor) * s + 14), o, 'End wall framing, the girts on the west and east walls');
}

root.WorkshopDraw = Object.assign(root.WorkshopDraw, { eastElevation, westElevation, northElevation, southElevation, sidewallFraming, endwallFraming, gableZ, gradeOf });
})(typeof window !== 'undefined' ? window : globalThis);
