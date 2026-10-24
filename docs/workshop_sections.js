// Cross-sections and framing plans of the workshop: Section A (across the width), Section B (along the length), Plan F1 (foundation and base
// framing), and Plan F2 (loft floor framing). Part of WorkshopDraw; workshop_draw.js and workshop_elevations.js load first.
(function (root) {
'use strict';
const D = root.WorkshopDraw;
if (!D || !D.kit || !D.gableZ) throw new Error('Load workshop_draw.js and workshop_elevations.js before workshop_sections.js');
const { r2, rect, line, poly, polyline, circle, path, text, lines, turned, svg, dimH, dimV, tick, mk, arrow, compass, scaleBar, feetInches, windowView } = D.kit;
const gradeOf = D.gradeOf;

// The imported fill on the pad, from the owner's report: almost 2 ft over the original ground at the north edge, 6 in to 1 ft at the south edge.
const FILL = root.WorkshopModel.DESIGN.fill;
const fillAt = (m, y) => FILL.north + (FILL.south - FILL.north) * Math.min(Math.max(y / m.width, 0), 1);

// The slab, foam, vapor barrier, and gravel under the floor, as bands from the pad surface up to the floor.
function slabStack(m, X, Z, x0, x1) {
  const g = gradeOf(m), t = 4 / 12;
  return rect(X(x0), Z(g + t), (x1 - x0) * (X(1) - X(0)), t * (Z(0) - Z(1)), 'c-gravel')
    + rect(X(x0), Z(g + 2 * t), (x1 - x0) * (X(1) - X(0)), t * (Z(0) - Z(1)), 'c-foam')
    + line(X(x0), Z(g + t), X(x1), Z(g + t), 'l-dim', { 'stroke-width': 1.4 })
    + rect(X(x0), Z(0), (x1 - x0) * (X(1) - X(0)), m.slabInches / 12 * (Z(0) - Z(1)), 'c-slab');
}
// One concrete pier: an 18 in tube on a 30 in pad, 60 in below the pad surface, with its bracket on top. x is the pier's center in feet.
function pier(m, X, Z, x, solid) {
  const g = gradeOf(m), p = m.pier, tube = p.tubeInches / 12, pad = p.padInches / 12, top = g, mid = g - (p.depthInches - p.padThickInches) / 12, bot = g - p.depthInches / 12;
  const s = Z(0) - Z(1), cls = solid ? 'c-conc' : 'c-conc c-ghost';
  return rect(X(x - pad / 2), Z(mid), pad * s, p.padThickInches / 12 * s, cls) + rect(X(x - tube / 2), Z(top), tube * s, (top - mid) * s, cls)
    + rect(X(x - 0.3), Z(top + 0.3), 0.6 * s, 0.4 * s, 'c-steel');
}

function sectionA(m) {
  const s = 11, W = m.width, ox = 150, gy = 372, o = [];
  const X = y => ox + y * s, Z = z => gy - z * s;
  const g = gradeOf(m), tx = m.eaveTail * m.knuckleRun / m.lowerLen, tz = m.eaveTail * m.knuckleRise / m.lowerLen;
  const bottom = Z(g - 5.6);
  o.push(text(380, 22, 'SECTION A — ACROSS THE WIDTH, LOOKING EAST', 't-title t-m'), text(ox - 30, 52, 'N ◀', 't-b t-red t-m'), text(X(W) + 30, 52, '▶ S', 't-b t-red t-m'));
  // ground: imported fill over native soil, with the fill's shoulders at the pad edge
  const edge = m.padMarginY, run = 2;
  o.push(rect(0, Z(g - FILL.south), 760, 760, 'c-native'));
  o.push(poly([[X(-edge - run * FILL.north), Z(g - FILL.north)], [X(-edge), Z(g)], [X(W + edge), Z(g)], [X(W + edge + run * FILL.south), Z(g - FILL.south)], [X(W), Z(g - FILL.south)], [X(0), Z(g - FILL.north)]], 'c-fill'));
  o.push(poly([[0, Z(g - FILL.north)], [X(-edge - run * FILL.north), Z(g - FILL.north)], [X(-edge), Z(g)], [0, Z(g)]], 'c-ground'),
    poly([[760, Z(g - FILL.south)], [X(W + edge + run * FILL.south), Z(g - FILL.south)], [X(W + edge), Z(g)], [760, Z(g)]], 'c-ground'));
  o.push(line(X(-edge), Z(g), X(W + edge), Z(g), 'l-wall', { 'stroke-width': 1 }));
  o.push(slabStack(m, X, Z, 0, W));
  o.push(pier(m, X, Z, 0, true), pier(m, X, Z, W, true));
  // posts, the girts and wall layers outside them, and the splash board (layers are exaggerated)
  [0, W].forEach(y => {
    o.push(rect(X(y) - 3.3, Z(m.eave + 0.2), 6.6, (m.eave + 0.2 - (g + 0.3)) * s, 'c-post'));
    const out = y === 0 ? -1 : 1, at = (from, to) => Math.min(X(y) + out * from, X(y) + out * to);
    m.girts.rows.forEach(row => o.push(rect(at(3.3, 6.3), Z(row.top), 3, m.girts.face / 12 * s, row.role === 'base' ? 'c-ptwood' : 'c-wood')));
    o.push(rect(at(9.3, 12.3), Z(m.eave), 3, (m.eave - SPLASH) * s, 'c-wall'), rect(at(6.3, 9.3), Z(m.eave), 3, m.eave * s, 'c-osb'));
    o.push(rect(at(3.3, 6.3), Z(SPLASH), 3, (SPLASH - g) * s, 'c-ptwood'));
  });
  // the truss: bottom chord with the loft floor, the top chords, the collar tie, and the roof on them
  const chord = m.chordInches / 12, deck = m.decking / 12, tie = m.truss.tie;
  o.push(rect(X(0), Z(m.eave - deck), W * s, chord * s + 0.5, 'c-wood'), rect(X(0), Z(m.eave), W * s, deck * s + 1, 'c-osb'));
  const px = list => list.map(([y, z]) => [X(y), Z(z)]);
  m.truss.chords.forEach(quad => o.push(poly(px(quad), 'c-wood')));
  o.push(poly(px(tie.body), 'c-wood'));
  const top = [[X(-tx), Z(m.eave - tz)], [X(0), Z(m.eave)], [X(m.knuckleRun), Z(m.knuckleZ)], [X(m.half), Z(m.peakZ)], [X(W - m.knuckleRun), Z(m.knuckleZ)], [X(W), Z(m.eave)], [X(W + tx), Z(m.eave - tz)]];
  o.push(polyline(top, 'c-chord'), polyline(top.map(p => [p[0], p[1] - 4]), 'c-roofline'));
  [m.knuckleRun, W - m.knuckleRun].forEach(y => o.push(line(X(y), Z(m.eave), X(y), Z(m.knuckleZ), 'l-post')));
  o.push(lines(X(7.4) + 4, Z(21), ['truss', '(schematic)'], 't-s t-i', 11));
  o.push(text(X(W / 2), Z(tie.z) + 14, `collar tie, ${feetInches(m.bracing.tieAt)} up`, 't-s t-m'));
  // behind the cut: the main door, the loft doors, and the hoist beam on the east gable
  const dh = m.mainDoor.height;
  o.push(rect(X(m.doorY0), Z(dh), m.mainDoor.width * s, dh * s, 'c-ghost-box'), rect(X(m.loftDoorY0), Z(m.eave + m.loftDoor.height), m.loftDoor.width * s, m.loftDoor.height * s, 'c-ghost-box'));
  o.push(text(X(m.half), Z(dh) - 5, `${m.mainDoor.width}′ × ${dh}′ door`, 't-s t-m t-i'));
  o.push(rect(X(m.half) - 6, Z(m.hoistZ + 0.25), 12, 0.5 * s, 'c-steel'));
  // the camper in the door, with the clearances
  const rv = m.rv, rx0 = m.half - rv.width / 2, rx1 = m.half + rv.width / 2;
  o.push(rect(X(rx0), Z(rv.height), rv.width * s, rv.height * s, 'c-rv', { rx: 6 }), rect(X(rx0) + 6, Z(rv.height) + 6, rv.width * s - 12, 2.2 * s, 'c-glass'));
  o.push(text(X(m.half), Z(5), `camper, ${rv.width}′ wide × ${feetInches(rv.height)} high`, 't-s t-m'), text(X(m.half), Z(5) + 11, '(Rockwood Mini Lite 2517S)', 't-s t-m t-i'));
  const side = (m.mainDoor.width - rv.width) / 2, under = m.eave - (m.chordInches + m.decking) / 12;
  o.push(dimH(X(m.doorY0), X(rx0), Z(1.6), feetInches(side)), dimH(X(rx1), X(m.doorY1), Z(1.6), feetInches(side)));
  o.push(dimV(X(rx1) + 9, Z(dh), Z(rv.height), '', {}), lines(X(m.doorY1) + 8, Z((dh + rv.height) / 2) - 2, [feetInches(m.rvClearDoor), 'at the door head'], 't-s', 11));
  o.push(dimV(X(rx0) - 9, Z(under), Z(rv.height), '', {}), text(X(m.doorY0) - 8, Z((under + rv.height) / 2) + 3, `${feetInches(m.rvClearLoft)} under the loft`, 't-s t-e'));
  // dimensions and marks
  const mx = X(W) + 70;
  [[g, `pad surface −${feetInches(-g)}`], [0, 'floor 0′'], [m.eave, `${m.eave}′ eave (loft floor)`], [m.knuckleZ, `${m.knuckleZ}′ knuckle`], [m.peakZ, `${m.peakZ}′ peak`]].forEach(([z, label]) => {
    o.push(line(X(W) + 12, Z(z), mx + 4, Z(z), 'l-ext'), tick(mx, Z(z)), text(mx + 8, Z(z) + 4, label, 't-s'));
  });
  o.push(line(mx, Z(g), mx, Z(m.peakZ), 'l-dim'));
  o.push(dimH(X(0), X(W), bottom + 22, `${feetInches(W)} wall to wall`, { bold: true }));
  o.push(lines(14, Z(g - 3.3) - 3, ['imported fill:', 'almost 2′ thick', 'at the north edge'], 't-s t-white t-i', 11), text(746, Z(g - 3.3), '6″ to 1′ at the south edge', 't-s t-white t-i t-e'));
  o.push(text(X(W / 2), Z(g - 3.4), 'native soil', 't-m t-white t-i'));
  o.push(mk(X(8), Z(g - 0.8), 'b'), mk(X(W - 6), Z(g + 0.34) - 18, 'a'), mk(X(W - 6), Z(g - 3.8), 'c'));
  o.push(mk(X(0) - 18, Z(8), '1'), mk(X(W / 4) + 8, Z(m.eave) - 14, '5'));
  return svg(760, 500, o, 'Section A, across the width, looking east');
}
const SPLASH = -0.31;

function sectionB(m) {
  const s = 11, L = m.length, ox = 130, gy = 372, o = [];
  const X = x => ox + x * s, Z = z => gy - z * s;
  const g = gradeOf(m), W = m.width;
  o.push(text(420, 22, 'SECTION B — ALONG THE LENGTH, LOOKING NORTH', 't-title t-m'), text(X(0) + 10, 52, 'W ◀', 't-b t-red'), text(X(L) - 10, 52, '▶ E', 't-b t-red t-e'));
  // ground
  const mid = fillAt(m, m.half);
  o.push(rect(0, Z(g - mid), 840, 760, 'c-native'), rect(0, Z(g - mid), 840, mid * s, 'c-fill'), line(0, Z(g), 840, Z(g), 'l-wall', { 'stroke-width': 1 }));
  o.push(slabStack(m, X, Z, 0, L));
  m.postX.forEach(x => o.push(pier(m, X, Z, x, x === 0)));
  // the interior of the north wall and the loft room
  o.push(rect(X(0.3), Z(m.eave), (L - 0.6) * s, m.eave * s, 'c-room'), rect(X(0.3), Z(m.peakZ - 0.4), (L - 0.6) * s, (m.peakZ - 0.4 - m.eave) * s, 'c-room2'));
  m.girts.rows.filter(row => row.bottom >= 0).forEach(row => o.push(line(X(0.3), Z(row.bottom + m.girts.face / 24), X(L - 0.3), Z(row.bottom + m.girts.face / 24), 'l-girt')));
  m.trussX.forEach(x => o.push(line(X(x), Z(m.eave), X(x), Z(m.peakZ - 0.4), 'l-truss')));
  m.postX.forEach(x => o.push(rect(X(x) - 3.3, Z(m.eave), 6.6, m.eave * s, 'c-post c-ghost')));
  // the windows in the north wall, between the posts
  const wins = m.windows.filter(w => w.wall === 'N');
  wins.forEach(w => o.push(windowView(X(w.at - w.width / 2), Z(w.sill + w.height), w.width * s, w.height * s)));
  if (wins.length) { const mid = wins[1] || wins[0]; o.push(mk(X(mid.at), Z(mid.sill + mid.height / 2), '15')); }
  // the loft floor, cut: chords end-on under the plywood
  m.trussX.forEach(x => o.push(rect(X(x) - 0.8, Z(m.eave - m.decking / 12), 1.6, m.chordInches / 12 * s, 'c-wood')));
  o.push(rect(X(0.3), Z(m.eave), (L - 0.6) * s, m.decking / 12 * s + 1, 'c-osb'));
  // the collar ties, cut at the center line, one on each truss but the hoist trusses
  const tie = m.truss.tie, tied = m.specialTrusses.tied;
  tied.forEach(({ x }) => o.push(rect(X(x) - 0.8, Z(tie.z + tie.deep), 1.6, tie.deep * s, 'c-wood')));
  o.push(text(X(tied[tied.length - 1].x / 2), Z(tie.z) + 14, `collar ties, T${tied[0].number} to T${tied[tied.length - 1].number}, ${feetInches(m.bracing.tieAt)} above the loft floor`, 't-s t-m t-i'));
  // the roof at the ridge, cut
  o.push(rect(X(-m.rakeOverhang), Z(m.peakZ + 0.3), (L + 2 * m.rakeOverhang) * s, 0.7 * s, 'c-roof'));
  // the end walls at the center line: the west gable is solid; the east gable has the door, the header, and the loft doors
  o.push(rect(X(-0.3), Z(m.peakZ), 0.6 * s, (m.peakZ - g) * s, 'c-wall'));
  const ew = (z0, z1) => rect(X(L - 0.3), Z(z1), 0.6 * s, (z1 - z0) * s, 'c-wall');
  o.push(ew(g, 0), ew(m.mainDoor.height + 1, m.eave), ew(m.eave + m.loftDoor.height + 0.8, m.peakZ));
  o.push(rect(X(L - 0.3), Z(m.mainDoor.height + 1), 0.6 * s, 1 * s, 'c-lvl'), rect(X(L - 0.3), Z(m.eave + m.loftDoor.height + 0.8), 0.6 * s, 0.8 * s, 'c-lvl'));
  o.push(rect(X(-0.3) + 0.6 * s - 3.3, Z(m.eave), 6.6, m.eave * s, 'c-post'));
  // the hoist beam through the east wall, one of its two braces, and the free-standing deck with its posts and rail
  const hx0 = L - m.hoist.inside, hx1 = L + m.hoist.out;
  o.push(rect(X(hx0), Z(m.hoistZ + 0.25), (hx1 - hx0) * s, 0.5 * s, 'c-steel'));
  const bs = m.hoistBraces[0], onBrace = t => [X(bs.foot[0] + t * (bs.tip[0] - bs.foot[0])), Z(bs.foot[2] + t * (bs.tip[2] - bs.foot[2]))];
  o.push(line(...onBrace(0), ...onBrace(1), 'l-brace'));
  const hook = X(m.hoistHookX);
  o.push(line(hook, Z(m.hoistZ - 0.25), hook, Z(m.hoistZ - 2.4), 'l-dim'), path(`M ${r2(hook - 3)} ${r2(Z(m.hoistZ - 2.4))} q 0 6 3 6 q 3 0 3 -6`, 'l-dim', { fill: 'none' }));
  const beam = 0.8;
  o.push(rect(X(m.deckX0), Z(m.eave), m.deck.depth * s, beam * s, 'c-deck'));
  m.deckPosts.filter(p => p[1] === m.deckY0).forEach(([x]) => o.push(rect(X(x) - 2.5, Z(m.eave - beam), 5, (m.eave - beam - g) * s, 'c-ptwood')));
  const rail = m.eave + m.deck.rail;
  o.push(line(X(m.deckX0), Z(rail), X(m.deckX1), Z(rail), 'l-rail'), line(X(m.deckX1), Z(m.eave), X(m.deckX1), Z(rail), 'l-rail'));
  for (let x = m.deckX0 + 0.5; x < m.deckX1; x += 0.5) o.push(line(X(x), Z(m.eave), X(x), Z(rail), 'l-joist'));
  // the stair behind the cut, south of the center line
  const ld = m.stair.landing, [f1] = m.flights;
  o.push(polyline([[X(ld + f1.run), Z(0)], [X(ld), Z(m.landingZ)], [X(0.3), Z(m.landingZ)], [X(0.3), Z(m.eave)], [X(m.stair.width), Z(m.eave)], [X(m.stair.width), Z(m.landingZ)]], 'l-hidden', { stroke: '#7a6b45' }));
  o.push(lines(X(8), Z(3.2), ['stair, south of the cut', '(first flight, landing, second flight)'], 't-s t-i', 10));
  o.push(text(X(11), Z(g - mid / 2) + 3, 'imported fill', 't-s t-m'), text(X(11), Z(g - mid - 1.4), 'native soil', 't-s t-m t-white t-i'));
  o.push(text(X(L / 2), Z(m.eave + 5), 'trusses at 2′ OC, seen edge-on', 't-s t-m t-i'), text(X(L / 2), Z(9.8), 'north wall seen from inside: the posts, the 2×6 girts behind them, and the windows', 't-s t-m t-i'));
  // dimensions and marks
  const markX = X(0) - 44;
  [[0, '0′ floor'], [m.eave, `${m.eave}′ eave`], [m.knuckleZ, `${m.knuckleZ}′ knuckle`], [m.peakZ, `${m.peakZ}′ peak`]].forEach(([z, label]) => {
    o.push(line(markX, Z(z), X(-0.3), Z(z), 'l-ext'), tick(markX, Z(z)), text(markX - 6, Z(z) + 4, label, 't-s t-e'));
  });
  o.push(line(markX, Z(0), markX, Z(m.peakZ), 'l-dim'));
  let at = 0;
  m.bays.forEach(bay => { o.push(dimH(X(at), X(at + bay), Z(g - 5.6) + 22, `${bay}′`)); at += bay; });
  o.push(dimH(X(0), X(L), Z(g - 5.6) + 42, `${feetInches(L)} gable to gable`, { bold: true }));
  o.push(mk(X(m.postX[3]), Z(12), '1'), mk(X(L) + 14, Z(7), '2'), mk(X(L) + 14, Z(m.eave + 3), '9'), mk(X((m.deckX0 + m.deckX1) / 2), Z(m.eave) + 26, '10'), mk(X(hx1) + 14, Z(m.hoistZ), '11'), mk(...onBrace(0.4), '17'));
  o.push(text(X(L - 2), Z(2.2), 'main door', 't-s t-e'), text(X(L - 2), Z(m.eave + 3) + 3, 'loft doors', 't-s t-e'));
  return svg(840, 500, o, 'Section B, along the length, looking north');
}

function foundationPlan(m) {
  const s = 11, L = m.length, W = m.width, ox = 90, oy = 132, o = [];
  const X = x => ox + x * s, Y = y => oy + y * s, ex = m.padMarginX, ey = m.padMarginY;
  o.push(text(470, 20, 'PLAN F1 — FOUNDATION AND BASE FRAMING, AT GRADE', 't-title t-m'));
  o.push(rect(X(-ex), Y(-ey), (L + 2 * ex) * s, (W + 2 * ey) * s, 'c-pad'));
  o.push(text(X(-ex) + 6, Y(-ey) + 11, `pad: level, imported fill, about ${m.pad.length} × ${m.pad.width} ft · almost 2′ of fill at this north edge`, 't-s'));
  o.push(text(X(-ex) + 6, Y(W + ey) - 5, 'pad: 6″ to 1′ of fill at this south edge', 't-s'));
  o.push(rect(X(L), Y(m.doorY0), 20 * s, (m.doorY1 - m.doorY0) * s, 'c-conc'), text(X(L + 12), Y(16) + 4, 'apron', 't-s t-m'));
  o.push(rect(X(0), Y(0), L * s, W * s, 'c-slab'));
  [1, 2, 3].forEach(k => o.push(line(X(L * k / 4), Y(0), X(L * k / 4), Y(W), 'l-dash')));
  [1, 2].forEach(k => o.push(line(X(0), Y(W * k / 3), X(L), Y(W * k / 3), 'l-dash')));
  o.push(text(X(L / 4) + 4, Y(W / 3) - 4, 'slab control joint (sawcut)', 't-s t-i'));
  // splash board around the base, left out at the doors
  const wx0 = m.walkX - m.walkDoor.width / 2, wx1 = m.walkX + m.walkDoor.width / 2;
  const sb = (x0, y0, x1, y1) => line(X(x0), Y(y0), X(x1), Y(y1), 'l-splash');
  o.push(sb(0, 0, L, 0), sb(0, 0, 0, W), sb(0, W, wx0, W), sb(wx1, W, L, W), sb(L, 0, L, m.doorY0), sb(L, m.doorY1, L, W));
  // piers (the 30 in pads), the deck piers, and the posts on them
  const posts = [];
  m.postX.forEach(x => posts.push([x, 0], [x, W]));
  m.gableY.forEach(y => posts.push([0, y]));
  posts.push([L, m.doorY0], [L, m.doorY1]);
  posts.forEach(([x, y]) => o.push(circle(X(x), Y(y), m.pier.padInches / 24 * s, 'c-pier')));
  m.deckPosts.forEach(([x, y]) => o.push(circle(X(x), Y(y), m.pier.padInches / 24 * s, 'c-pier')));
  posts.forEach(([x, y]) => o.push(rect(X(x) - 5, Y(y) - 5, 10, 10, 'c-post')));
  m.deckPosts.forEach(([x, y]) => o.push(rect(X(x) - 4, Y(y) - 4, 8, 8, 'c-ptwood')));
  o.push(lines(X(L + 7), Y(m.doorY1) + 26, ['4 deck piers', '(18″ tube, 6×6 post)'], 't-s', 10));
  o.push(text(X(L) - 10, Y(m.doorY0) - 10, 'door-jamb piers', 't-s t-e'), text(X(m.walkX), Y(W) + 18, 'walk door', 't-s t-m'));
  // dimensions
  o.push(dimH(X(0), X(L), 44, feetInches(L), { bold: true }));
  let at = 0;
  m.bays.forEach(bay => { o.push(dimH(X(at), X(at + bay), 64, `${bay}′`)); at += bay; });
  o.push(dimV(X(L + 24), Y(0), Y(W), feetInches(W), { right: true, bold: true }));
  o.push(dimV(X(L + 22), Y(m.doorY0), Y(m.doorY1), `${m.mainDoor.width}′ door`, { right: true }));
  // key
  const ky = Y(W + ey) + 28;
  o.push(rect(X(0), ky - 8, 10, 10, 'c-post'), text(X(0) + 16, ky, `post on its bracket: ${m.pierCount} piers in all (${2 * m.postX.length} on the sidewalls, ${m.gableY.length} on the west gable, 2 door jambs)`, 't-s'));
  o.push(circle(X(0) + 5, ky + 18, 6, 'c-pier'), text(X(0) + 16, ky + 22, `pier pad, ${m.pier.padInches}″ Ø × ${m.pier.padThickInches}″, bottom ${m.pier.depthInches}″ below the pad surface; 18″ tube above`, 't-s'));
  o.push(line(X(0), ky + 38, X(0) + 10, ky + 38, 'l-splash'), text(X(0) + 16, ky + 42, '2×10 PT splash board around the base, left out at the doors', 't-s'));
  o.push(compass(X(L + 28) - 10, Y(W) + 40));
  o.push(scaleBar(X(L + 12), Y(W + ey) + 20, s));
  return svg(960, 680, o, 'Plan F1, foundation and base framing');
}

function loftFramingPlan(m) {
  const s = 11, L = m.length, W = m.width, ox = 90, oy = 100, o = [];
  const X = x => ox + x * s, Y = y => oy + y * s, lo = m.loftOpening;
  o.push(text(470, 20, `PLAN F2 — LOFT FLOOR FRAMING, AT +${m.eave}′-0″`, 't-title t-m'));
  o.push(rect(X(0), Y(0), L * s, W * s, 'c-loft'));
  // the truss bottom chords are the loft joists; the chord at 2 ft is cut by the stair opening
  m.trussX.forEach((x, i) => {
    const heavy = i === 0 || i === m.trussX.length - 1;
    if (x > 0 && x < lo.width + 1e-9 && x > 0.1 && x < lo.width - 0.1) {
      o.push(line(X(x), Y(0), X(x), Y(lo.fromNorth), 'l-chord'), line(X(x), Y(lo.fromNorth + lo.length), X(x), Y(W), 'l-chord'));
    } else o.push(line(X(x), Y(0), X(x), Y(W), heavy ? 'l-chord l-chord-h' : 'l-chord'));
  });
  // LVL truss carriers on the posts along both sidewalls
  o.push(rect(X(0), Y(0.1), L * s, 4, 'c-lvl'), rect(X(0), Y(W - 0.1) - 4, L * s, 4, 'c-lvl'));
  m.postX.forEach(x => o.push(rect(X(x) - 3, Y(0) - 3, 6, 6, 'c-post'), rect(X(x) - 3, Y(W) - 3, 6, 6, 'c-post')));
  // blocking row at mid-span
  o.push(line(X(lo.width + 0.4), Y(m.half), X(L - 2), Y(m.half), 'l-dash'), text(X(lo.width + 1), Y(m.half) - 4, '2×4 blocking row at mid-span (typical)', 't-s t-i'));
  // the stair opening with its headers and trimmer
  o.push(rect(X(0), Y(lo.fromNorth), lo.width * s, lo.length * s, 'c-open'));
  o.push(line(X(0), Y(lo.fromNorth), X(lo.width), Y(lo.fromNorth), 'l-lvl-line'), line(X(0), Y(lo.fromNorth + lo.length), X(lo.width), Y(lo.fromNorth + lo.length), 'l-lvl-line'), line(X(lo.width), Y(lo.fromNorth), X(lo.width), Y(lo.fromNorth + lo.length), 'l-lvl-line'));
  o.push(lines(X(lo.width / 2), Y(lo.fromNorth + 3), ['STAIR', 'OPENING', `${lo.width}′ × ${lo.length}′`], 't-s t-m t-red t-b', 11));
  o.push(text(X(lo.width) + 6, Y(lo.fromNorth + lo.length) + 14, '(2) 2×10 LVL header at each end of the opening', 't-s'));
  // east wall: the loft doors and their header
  o.push(rect(X(L) - 5, Y(m.loftDoorY0), 5, (m.loftDoorY1 - m.loftDoorY0) * s, 'c-lvl'));
  o.push(text(X(L) - 10, Y(m.loftDoorY0) - 6, `${m.loftDoor.width}′ × ${m.loftDoor.height}′ loft doors, (2) 2×10 LVL header`, 't-s t-e'));
  // walls and the deck framing
  o.push(rect(X(0), Y(0), L * s, W * s, 'l-wall', { fill: 'none' }));
  const dk = m.deck, dx0 = m.deckX0, dx1 = m.deckX1;
  o.push(rect(X(dx0), Y(m.deckY0), dk.depth * s, (m.deckY1 - m.deckY0) * s, 'c-deck'));
  for (let j = 0.5; j < dk.depth; j += dk.joistSpacing) o.push(line(X(dx0 + j), Y(m.deckY0), X(dx0 + j), Y(m.deckY1), 'l-joist'));
  o.push(line(X(dx0), Y(m.deckY0), X(dx1), Y(m.deckY0), 'l-beam'), line(X(dx0), Y(m.deckY1), X(dx1), Y(m.deckY1), 'l-beam'));
  m.deckPosts.forEach(([x, y]) => o.push(rect(X(x) - 4, Y(y) - 4, 8, 8, 'c-ptwood')));
  o.push(lines(X(dx0), Y(m.deckY1) + 18, [`DECK ${dk.width}′ × ${dk.depth}′`, 'free-standing: 2×10 beams east-west,', '2×10 joists 12″ OC north-south,', 'diagonal knee braces to the posts'], 't-s', 11));
  // the hoist beam above, and the two braces that rise from the deck's outer corners to its tip
  const hx0 = L - m.hoist.inside, hx1 = L + m.hoist.out;
  o.push(rect(X(hx0), Y(m.half) - 3, (hx1 - hx0) * s, 6, 'c-steel c-above-line'));
  o.push(text(X(hx0) - 6, Y(m.half) - 7, 'W6 hoist beam (above)', 't-s t-e'));
  m.hoistBraces.forEach(b => o.push(line(X(b.foot[0]), Y(b.foot[1]), X(b.tip[0]), Y(b.tip[1]), 'l-brace')));
  const bn = m.hoistBraces[0];
  // dimensions
  o.push(dimH(X(0), X(L), 44, `${feetInches(L)} · ${m.trussCount} attic trusses at ${m.trussSpacing}′-0″ OC`, { bold: true }));
  o.push(dimV(X(0) - 14, Y(0), Y(W), `${feetInches(W)} truss span`, { bold: true }));
  o.push(mk(X(2) + 12, Y(lo.fromNorth) - 18, '5'), mk(X(L) - 14, Y(m.loftDoorY1) + 16, '9'), mk(X(dx0 + 5), Y(m.deckY1) - 12, '10'), mk(X(hx1) + 14, Y(m.half), '11'), mk(X((bn.foot[0] + bn.tip[0]) / 2), Y((bn.foot[1] + bn.tip[1]) / 2), '17'));
  // key
  const ky = Y(W) + 34;
  o.push(line(X(0), ky - 4, X(0) + 16, ky - 4, 'l-chord'), text(X(0) + 22, ky, 'truss bottom chord = loft joist, spanning the full width with no bearing between the walls', 't-s'));
  o.push(rect(X(0), ky + 6, 16, 4, 'c-lvl'), text(X(0) + 22, ky + 12, '(3) 1¾″ × 9¼″ LVL truss carrier, side-bolted to the posts (Detail 7)', 't-s'));
  o.push(compass(X(L + 24), Y(W) - 6));
  return svg(960, 540, o, 'Plan F2, loft floor framing');
}

root.WorkshopDraw = Object.assign(root.WorkshopDraw, { sectionA, sectionB, foundationPlan, loftFramingPlan, FILL, fillAt });
})(typeof window !== 'undefined' ? window : globalThis);
