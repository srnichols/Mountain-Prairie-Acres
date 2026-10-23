// The seven construction details of the workshop: wall assembly, roof assembly, pier and post base, rainscreen base, the eave (rainscreen vent-out),
// the loft door with hoist beam and deck, and the truss bearing. Layers are exaggerated where noted; callouts are letters or numbers that the
// page's legend tables explain. Part of WorkshopDraw; workshop_draw.js and workshop_elevations.js load first.
(function (root) {
'use strict';
const D = root.WorkshopDraw;
if (!D || !D.kit || !D.gradeOf) throw new Error('Load workshop_draw.js and workshop_elevations.js before workshop_details.js');
const { r2, rect, line, poly, polyline, circle, path, text, lines, turned, svg, dimH, dimV, tick, mk, arrow, feetInches } = D.kit;

// A callout: a leader from the object to a marker.
const call = (ox, oy, mx, my, label) => line(ox, oy, mx, my, 'l-ext') + mk(mx, my, label);

function detail1(m) {
  const k = 14, top = 90, bot = 350, o = [];
  const girt = m.girts.thick;
  const xs = 100, xc = xs + 5, xw = xc + 0.75 * k, xg = xw + 0.5 * k, xp = xg + girt * k, postY = 196, postH = 4.5 * k, joint = postY + postH / 2;
  o.push(text(230, 22, 'DETAIL 1 — WALL ASSEMBLY (horizontal section, layers exaggerated)', 't-title t-m'));
  o.push(text(xs - 6, 62, 'OUTSIDE', 't-s t-b'), text(xp + 7.25 * k + 12, 62, 'INSIDE', 't-s t-b t-e'));
  o.push(rect(xs, top, 5, bot - top, 'c-wall'), rect(xc, top, 0.75 * k, bot - top, 'c-cavity'));
  [112, 272].forEach(y => o.push(rect(xc, y, 0.75 * k, 3.5 * k, 'c-ptwood')));
  o.push(line(xw, top, xw, bot, 'l-wrb'), rect(xw, top, 0.5 * k, bot - top, 'c-osb'));
  // the girt runs along the whole face of the post; two boards meet over the post's center line, each screwed into the post
  o.push(rect(xg, top, girt * k, joint - top - 1, 'c-wood'), rect(xg, joint + 1, girt * k, bot - joint - 1, 'c-wood'));
  o.push(rect(xp, postY, 7.25 * k, postH, 'c-post'));
  [1, 2].forEach(i => o.push(line(xp, postY + i * 1.5 * k, xp + 7.25 * k, postY + i * 1.5 * k, 'l-ply')));
  [-1, 1].forEach(side => { const y = joint + side * postH / 4; o.push(line(xg + 4, y, xp + 2 * k, y, 'l-bolt'), rect(xg - 2, y - 3.5, 3, 7, 'c-bolt')); });
  o.push(arrow(xc + 5, 250, xc + 5, 190, 'l-arrow'));
  o.push(call(xs + 2, 102, 300, 102, 'A'), call(xc + 5, 134, 300, 140, 'B'), call(xw, 176, 300, 178, 'C'), call(xw + 3, 186, 300, 216, 'D'), call(xp + 70, postY + 30, 300, 254, 'E'), call(xg + 8, 300, 300, 300, 'F'));
  o.push(dimH(xs, xp + 7.25 * k, bot + 28, `≈ ${Math.round(m.wallInches * 4) / 4}″`, {}));
  o.push(lines(xs, bot + 54, ['The furring stands off the sheathing to make a ¾″ air space that drains and dries (arrow: air moving up).', 'The girt is a 2×6 laid flat on the post. Its joints fall on post center lines, and screws go through it into the post.'], 't-s', 13));
  return svg(560, 440, o, 'Detail 1, wall assembly');
}

function detail2(m) {
  const k = 16, x0 = 70, w = 360, o = [], y = 56;
  o.push(text(300, 22, 'DETAIL 2 — ROOF ASSEMBLY (section at a purlin, lower slope, shown flat)', 't-title t-m'));
  const rib = [[x0, y + 12]];
  for (let i = 0; i < 5; i++) { const x = x0 + i * 72; rib.push([x + 22, y + 12], [x + 30, y], [x + 44, y], [x + 52, y + 12], [x + 72, y + 12]); }
  o.push(polyline(rib, 'c-roofline', { 'stroke-width': 2.6 }), rect(x0, y + 14, w, 5, 'c-dripstop'));
  o.push(line(x0, y + 26, x0 + w, y + 26, 'l-under'), line(x0, y + 32, x0 + w, y + 32, 'l-iws'), rect(x0, y + 36, w, 10, 'c-osb'));
  [x0 + 36, x0 + 236].forEach(x => o.push(rect(x, y + 46, 5.5 * k, 1.5 * k, 'c-wood')));
  o.push(rect(x0, y + 46 + 1.5 * k, w, 7.25 * k, 'c-wood'));
  o.push(text(x0 + 200, y + 46 + 1.5 * k + 7.25 * k / 2 + 3, 'truss top chord, 2×8 (depth to scale)', 't-s t-m t-i'));
  o.push(text(x0 + 56 + 5.5 * k + 20, y + 46 + 12 + 4, '16–24″ OC', 't-s t-i'));
  const right = x0 + w;
  o.push(call(right, y + 6, 490, y + 6, 'A'), call(right, y + 26, 490, y + 40, 'B'), call(right, y + 32, 490, y + 74, 'C'), call(right, y + 41, 490, y + 108, 'D'), call(x0 + 36 + 88, y + 58, 490, y + 142, 'E'), call(right, y + 46 + 1.5 * k + 40, 490, y + 190, 'F'));
  o.push(text(x0, y + 46 + 1.5 * k + 7.25 * k + 28, `Layers are exaggerated. The lower slope is about ${Math.round(m.lowerAngle)}° and gets full ice and water shield; the upper slope (${Math.round(m.upperAngle)}°)`, 't-s'));
  o.push(text(x0, y + 46 + 1.5 * k + 7.25 * k + 41, 'gets it only at the pitch break and around penetrations. Dripstop on the steel’s underside controls condensation in the loft.', 't-s'));
  return svg(600, 370, o, 'Detail 2, roof assembly');
}

function detail3(m) {
  const X = i => 250 + i * 5, Z = i => 210 - i * 5, o = [];
  const p = m.pier;
  o.push(text(330, 22, 'DETAIL 3 — FOUNDATION: PIER, POST BASE, AND SLAB EDGE (vertical section)', 't-title t-m'));
  // ground: imported fill over native soil
  o.push(rect(0, Z(-24), 700, 600, 'c-native'), rect(0, Z(0), 700, 24 * 5, 'c-fill'), line(0, Z(0), 700, Z(0), 'l-wall', { 'stroke-width': 1 }));
  o.push(line(0, Z(-9), 700, Z(-9), 'l-dash'), text(692, Z(-9) - 3, 'south edge of the pad: fill 6″ to 1′', 't-s t-e'), text(692, Z(-24) - 4, 'north edge: almost 2′ of fill', 't-s t-e'));
  // pier: the 30 in pad at the bottom and the 18 in tube above it
  const pad = p.padInches / 2, tube = p.tubeInches / 2, depth = p.depthInches, padTop = depth - p.padThickInches;
  o.push(rect(X(-pad), Z(-padTop), p.padInches * 5, p.padThickInches * 5, 'c-conc'), rect(X(-tube), Z(0), p.tubeInches * 5, padTop * 5, 'c-conc'));
  [-3, 3].forEach(i => o.push(line(X(i), Z(-8), X(i), Z(-30), 'l-dim')));
  // bracket, post, and the layers outside it: the girt layer (the splash board and the base girt) and the sheathing, furring, and steel over it
  const floor = m.padToFloor * 12, girt = m.girts.thick, face = m.girts.face, splash = m.girts.splashInches;
  o.push(rect(X(-3.8), Z(3), 7.6 * 5, 11 * 5, 'c-steel'), rect(X(-3.6), Z(32), 7.25 * 5, 29 * 5, 'c-post'));
  o.push(rect(X(-3.6 - girt), Z(splash), girt * 5, splash * 5, 'c-ptwood'), rect(X(-3.6 - girt), Z(floor + face), girt * 5, face * 5, 'c-ptwood'));
  o.push(rect(X(-4.1 - girt), Z(32), 0.5 * 5, (32 - floor - face / 2) * 5, 'c-osb'), rect(X(-4.85 - girt), Z(32), 0.75 * 5, 20 * 5, 'c-cavity'), rect(X(-5.05 - girt), Z(32), 2, 20 * 5, 'c-wall'));
  // slab stack to the right of the post: 4 in gravel, 4 in foam, vapor barrier between, 5 in slab
  o.push(rect(X(4.4), Z(4), 46 * 5, 4 * 5, 'c-gravel'), rect(X(4.4), Z(8), 46 * 5, 4 * 5, 'c-foam'), line(X(4.4), Z(4), X(50.4), Z(4), 'l-dim', { 'stroke-width': 1.4 }), rect(X(4.4), Z(13), 46 * 5, 5 * 5, 'c-slab'));
  [14, 30, 46].forEach(i => o.push(circle(X(i), Z(10.5), 1.6, 'c-bolt')));
  o.push(rect(X(3.65), Z(13), 0.75 * 5, 10 * 5, 'c-foam'));
  // dimensions
  o.push(dimV(X(34), Z(0), Z(-depth), `${depth}″ below the pad surface`, { right: true }));
  o.push(dimH(X(-pad), X(pad), Z(-depth) + 26, `${p.padInches}″ Ø × ${p.padThickInches}″ pad`), dimH(X(-tube), X(tube), Z(-padTop) - 14, `${p.tubeInches}″ Ø tube`));
  o.push(lines(X(39), Z(-40), ['the pad bears on undisturbed native soil', '(or fill the engineer accepts as compacted)'], 't-s t-white t-i', 11));
  o.push(text(X(52), Z(14) - 4, 'pad surface (grade) = bottom of the gravel', 't-s t-e'));
  o.push(call(X(3.6), Z(26), X(14), Z(26), 'A'), call(X(-3.8), Z(-3), X(-28), Z(-3), 'B'), call(X(9), Z(-30), X(26), Z(-30), 'C'), call(X(-4.4), Z(splash / 2), X(-28), Z(5), 'D'), call(X(30), Z(15.5), X(52), Z(24), 'E'), call(X(30), Z(6), X(52), Z(-1.5), 'F'), call(X(-4.4), Z(floor + face / 2), X(-28), Z(16), 'I'));
  o.push(mk(X(-30), Z(-14), 'G'), mk(X(-30), Z(-36), 'H'));
  return svg(700, 560, o, 'Detail 3, pier and post base');
}

function detail4(m) {
  const k = 7, X = i => 250 + i * k, Z = i => 300 - i * k, o = [];
  const girt = m.girts.thick, shift = -girt, floor = m.padToFloor * 12, face = m.girts.face, splash = m.girts.splashInches;   // everything outside the girt layer stands one girt thickness out from the post
  o.push(text(300, 22, 'DETAIL 4 — RAINSCREEN BASE (vertical section at a post)', 't-title t-m'));
  o.push(text(X(-33), 52, 'OUTSIDE ←', 't-s t-b'), text(X(40), 52, '→ INSIDE', 't-s t-b t-e'));
  o.push(rect(0, Z(0), 600, 90, 'c-fill'), line(0, Z(0), X(-2 + shift), Z(0), 'l-wall', { 'stroke-width': 1 }));
  o.push(rect(X(0), Z(32), 7.25 * k, 32 * k, 'c-post'), rect(X(-girt), Z(splash), girt * k, splash * k, 'c-ptwood'), rect(X(-girt), Z(floor + face), girt * k, face * k, 'c-ptwood'), rect(X(-0.5 + shift), Z(32), 0.5 * k, (32 - floor - face / 2) * k, 'c-osb'));
  o.push(rect(X(-1.25 + shift), Z(32), 0.75 * k, 20.5 * k, 'c-cavity'), rect(X(-1.25 + shift), Z(32), 0.75 * k, 20.5 * k, 'c-ptwood', { opacity: 0.55 }));
  o.push(rect(X(-1.4 + shift), Z(32), 0.15 * k + 1.5, 21.5 * k, 'c-wall'));
  o.push(rect(X(-1.25 + shift), Z(11.5), 0.75 * k, 2.2 * k, 'c-screen'));
  o.push(polyline([[X(-0.55 + shift), Z(32)], [X(-0.55 + shift), Z(floor + face / 2)], [X(-girt - 0.1), Z(splash + 0.7)], [X(-girt - 0.1), Z(splash - 0.9)]], 'l-wrb'));
  o.push(polyline([[X(-1.4 + shift), Z(10.6)], [X(-1.4 + shift), Z(9.9)], [X(-2.2 + shift), Z(9.4)]], 'l-flash'));
  o.push(arrow(X(-10.5), Z(10.4), X(-1.7 + shift), Z(10.4), 'l-arrow'), arrow(X(-0.9 + shift), Z(14), X(-0.9 + shift), Z(24), 'l-arrow'), text(X(-7), Z(10.4) - 6, 'air in', 't-s t-m t-blue'));
  const sx = 7.75;
  o.push(rect(X(sx), Z(4), 36 * k, 4 * k, 'c-gravel'), rect(X(sx), Z(8), 36 * k, 4 * k, 'c-foam'), rect(X(sx), Z(13), 36 * k, 5 * k, 'c-slab'), rect(X(7.25), Z(13), 0.5 * k, 10 * k, 'c-foam'));
  o.push(text(X(-3 + shift), Z(0) + 14, 'pad surface (grade)', 't-s t-e'));
  o.push(call(X(-1.4 + shift), Z(30), X(-14), Z(30), 'A'), call(X(-1 + shift), Z(26), X(-14), Z(26), 'B'), call(X(-0.55 + shift), Z(22), X(-14), Z(22), 'C'), call(X(-0.25 + shift), Z(18), X(-14), Z(18), 'D'),
    call(X(-girt / 2), Z(floor + face / 2), X(-14), Z(14), 'E'), call(X(-1.9 + shift), Z(10.4), X(-14), Z(10), 'F'), call(X(-girt / 2), Z(splash / 2), X(-14), Z(5), 'G'), call(X(28), Z(15), X(28), Z(26), 'H'));
  o.push(lines(20, Z(0) + 40, ['The furring stops 2″ above the splash board. That slot, covered by the drip flashing', 'and an insect screen, is where air enters the cavity and starts up the wall.'], 't-s', 11));
  return svg(600, 410, o, 'Detail 4, rainscreen base');
}

// The eave, in inches: z = 0 is the top of the loft floor, which is the eave line; x = 0 is the outside face of the post (outside is negative).
function eave(m, mode) {
  const k = 6, ox = 130, oy = 190, o = [];
  const X = i => ox + i * k, Z = i => oy - i * k;
  const dx = m.knuckleRun / m.lowerLen, dz = m.knuckleRise / m.lowerLen;          // direction of the lower slope
  const nx = -dz, nz = dx;                                                        // its upward normal
  const roofAt = t => [-1.4 + t * dx, t * dz + 3];                                // the roof's upper surface, 3 in above the eave line at the wall, so the tail clears the post top
  const slab = pts => poly(pts.map(([a, b]) => [X(a), Z(b)]), 'c-wood');
  const bearing = mode === 'bearing';
  const g = m.girts.thick, topRow = m.girts.rows[m.girts.rows.length - 1], rowTop = (topRow.top - m.eave) * 12;   // the girt layer stands outside the post; the top row's top edge in inches below the eave line
  o.push(text(330, 22, bearing ? 'DETAIL 7 — TRUSS BEARING AT THE TOP OF A POST (transverse section)' : 'DETAIL 5 — EAVE: THE RAINSCREEN VENTS OUT (vertical section)', 't-title t-m'));
  o.push(text(X(-12), 52, 'OUTSIDE ←', 't-s t-b'), text(X(62), 52, '→ INSIDE (LOFT)', 't-s t-b t-e'));
  o.push(line(X(-14), Z(0), X(62), Z(0), 'l-dash'), text(X(62), Z(0) - 5, `+${m.eave}′-0″ eave line, top of the loft floor`, 't-s t-e'));
  // wall: steel, furring, sheathing, the top girt, and the post (the wall continues below the frame)
  o.push(rect(X(0), Z(-7.5), 7.25 * k, 36.5 * k, 'c-post'), rect(X(-g), Z(rowTop), g * k, m.girts.face * k, 'c-wood'));
  o.push(rect(X(-0.5 - g), Z(-12), 0.5 * k, 32 * k, 'c-osb'), rect(X(-1.25 - g), Z(-12), 0.75 * k, 32 * k, 'c-cavity'), rect(X(-1.25 - g), Z(-12), 0.75 * k, 32 * k, 'c-ptwood', { opacity: 0.55 }), rect(X(-1.4 - g), Z(-9), 2.2, 35 * k, 'c-wall'));
  // carrier, the bottom chord, and the loft floor
  o.push(rect(X(7.25), Z(-10), 5.25 * k, 9.25 * k, 'c-lvl'));
  o.push(rect(X(7.25), Z(-0.75), 56 * k, 9.25 * k, 'c-wood'));
  o.push(rect(X(7.25), Z(0), 56 * k, 0.75 * k, 'c-osb'));
  [-12.5, -14.8, -17].forEach(z => o.push(line(X(-0.5), Z(z), X(12.5), Z(z), 'l-bolt'), circle(X(-0.5), Z(z), 2.4, 'c-bolt'), circle(X(12.5), Z(z), 2.4, 'c-bolt')));
  // the top chord and its tail, the roof layers, the sub-fascia, and the soffit
  const t0 = -12.4, t1 = 24, c0 = roofAt(t0), c1 = roofAt(t1);
  const down = (p, d) => [p[0] - nx * d, p[1] - nz * d];
  o.push(slab([c0, c1, down(c1, 7.25), down(c0, 7.25)]));
  o.push(poly([[X(c0[0]), Z(c0[1])], [X(c1[0]), Z(c1[1])], [X(c1[0] + nx * 3), Z(c1[1] + nz * 3)], [X(c0[0] + nx * 3), Z(c0[1] + nz * 3)]], 'c-roof'));
  o.push(rect(X(c0[0] - 1.5), Z(c0[1] + 1), 1.5 * k, 5.5 * k, 'c-wood'));
  o.push(rect(X(-9.4), Z(-15.2), (8.4 - g) * k, 0.75 * k, 'c-roof'), line(X(-5), Z(-15.2) + 4, X(-1.5 - g), Z(-15.2) + 4, 'l-vent'));
  o.push(polyline([[X(-1.4 - g), Z(-9)], [X(-1.4 - g), Z(-12.5)], [X(-9.5), Z(-15.4)]], 'l-flash'));
  o.push(arrow(X(-0.9 - g), Z(-30), X(-0.9 - g), Z(-12), 'l-arrow'), arrow(X(-0.9 - g), Z(-12), X(-4.4), Z(-15.4), 'l-arrow'), text(X(-6), Z(-20), 'air out', 't-s t-e t-blue'));
  // hurricane ties, both sides of the chord's bearing
  if (bearing) o.push(polyline([[X(8.2), Z(-0.5)], [X(8.2), Z(-10)], [X(11.5), Z(-10)]], 'l-flash', { 'stroke-width': 2 }), polyline([[X(9.7), Z(-0.5)], [X(9.7), Z(-9)], [X(12.5), Z(-9)]], 'l-flash', { 'stroke-width': 2 }));
  // callouts
  const mid = roofAt(14);
  if (bearing) {
    o.push(call(X(3.6), Z(-30), X(48), Z(-38), '1'), call(X(10), Z(-15.5), X(48), Z(-26), '2'), call(X(30), Z(-5), X(48), Z(-14), '3'), call(X(34), Z(0.4), X(36), Z(10), '4'),
      call(X(mid[0]), Z(mid[1]), X(48), Z(22), '5'), call(X(8.4), Z(-4), X(48), Z(-2), '6'), call(X(c0[0] - 1), Z(c0[1] - 2), X(-12), Z(-16), '7'), call(X(-1.2 - g), Z(-9), X(-12), Z(-2), '8'),
      call(X(-0.8 - g), Z(-34), X(-12), Z(-34), '9'));
  } else {
    o.push(call(X(-1.3 - g), Z(-34), X(-12), Z(-38), 'A'), call(X(-1 - g), Z(-24), X(-12), Z(-28), 'B'), call(X(-5), Z(-15.2), X(-12), Z(-18), 'C'), call(X(-5), Z(-12.5), X(-12), Z(-6), 'D'),
      call(X(mid[0]), Z(mid[1]), X(48), Z(22), 'E'), call(X(30), Z(-5), X(48), Z(-8), 'F'), call(X(-g / 2), Z(rowTop - m.girts.face / 2), X(-12), Z(-22), 'G'));
  }
  o.push(lines(X(-12), Z(-49), bearing ? ['The truss bottom chord is the loft joist: it spans the full width on the carrier.', 'Member sizes here are placeholders; the truss designer and engineer set the real ones.'] : ['Air that entered at the splash board (Detail 4) rises through the rainscreen cavity', 'and leaves at the vented soffit closure. Without that vent the cavity traps moisture.'], 't-s', 11));
  return svg(660, 520, o, bearing ? 'Detail 7, truss bearing' : 'Detail 5, eave');
}
const detail5 = m => eave(m, 'vent');
const detail7 = m => eave(m, 'bearing');

function detail6(m) {
  const k = 14, ox = 190, o = [];
  const g = D.gradeOf(m), gy = 480;
  const X = x => ox + x * k, Z = z => gy - (z - g) * k;
  o.push(text(340, 22, 'DETAIL 6 — EAST GABLE AT THE LOFT: DOORS, HOIST BEAM, AND DECK (vertical section)', 't-title t-m'));
  o.push(text(X(-9), 52, 'INSIDE →', 't-s t-b'), text(X(13), 52, '← OUTSIDE', 't-s t-b t-e'));
  o.push(rect(0, Z(g), 700, 80, 'c-fill'), line(0, Z(g), 700, Z(g), 'l-wall', { 'stroke-width': 1 }));
  // the gable wall at the center line: below the loft doors the door header; above them the wall, with the hoist beam through it
  const ew = (z0, z1) => rect(X(-0.3), Z(z1), 0.6 * k, (z1 - z0) * k, 'c-wall');
  o.push(ew(m.mainDoor.height + 1, m.eave), ew(m.eave + m.loftDoor.height + 0.8, m.peakZ - 0.3));
  o.push(rect(X(-0.3), Z(m.mainDoor.height + 1), 0.6 * k, k, 'c-lvl'), rect(X(-0.3), Z(m.eave + m.loftDoor.height + 0.8), 0.6 * k, 0.8 * k, 'c-lvl'));
  o.push(rect(X(-0.3), Z(m.eave + m.loftDoor.height), 0.6 * k, m.loftDoor.height * k, 'c-door'));
  o.push(rect(X(-9.4), Z(m.eave), 9.1 * k, (m.chordInches + m.decking) / 12 * k, 'c-wood'), rect(X(-9.4), Z(m.eave), 9.1 * k, 3, 'c-osb'));
  // the hoist beam: through the wall, anchored to the truss inside, with a boot at the wall; one brace beyond the cut, from its shoe on the deck's end to the plate on the beam's tip;
  // and the chain fall just in from the tip
  const hz = m.hoistZ, tipX = m.hoist.out;
  const bs = m.hoistBraces[0], bf = [X(bs.foot[0] - m.length), Z(bs.foot[2])], bt = [X(bs.tip[0] - m.length), Z(bs.tip[2])];
  const bn = Math.hypot(bt[0] - bf[0], bt[1] - bf[1]), nx = (bf[1] - bt[1]) / bn * 3.5, ny = (bt[0] - bf[0]) / bn * 3.5, onBrace = t => [bf[0] + t * (bt[0] - bf[0]), bf[1] + t * (bt[1] - bf[1])];
  o.push(poly([[bf[0] + nx, bf[1] + ny], [bt[0] + nx, bt[1] + ny], [bt[0] - nx, bt[1] - ny], [bf[0] - nx, bf[1] - ny]], 'c-ptwood'));
  o.push(rect(X(-m.hoist.inside), Z(hz + 0.25), (m.hoist.inside + tipX) * k, 0.5 * k, 'c-steel'), rect(X(tipX), Z(hz + 0.45), 3, 1.25 * k, 'c-steel'), rect(X(m.deckX1 - m.length), Z(13.9), 4, 1.5 * k, 'c-steel'));
  o.push(rect(X(-m.hoist.inside) - 2, Z(hz + 1.2), 6, 2.4 * k, 'c-steel'), rect(X(-m.hoist.inside + 2), Z(hz + 0.9), 1.4 * k, 1.8 * k, 'c-wood'));
  o.push(poly([[X(-0.3) - 6, Z(hz) + 4], [X(-0.3), Z(hz) + 4], [X(-0.3), Z(hz) - 4], [X(-0.3) - 6, Z(hz) - 14]], 'c-boot'), poly([[X(0.3) + 6, Z(hz) + 4], [X(0.3), Z(hz) + 4], [X(0.3), Z(hz) - 4], [X(0.3) + 6, Z(hz) - 14]], 'c-boot'));
  const hx = X(m.hoistHookX - m.length);
  o.push(line(hx, Z(hz - 0.25), hx, Z(hz - 1.8), 'l-dim'), rect(hx - 4, Z(hz - 1.8), 8, 12, 'c-steel'), path(`M ${r2(hx - 3)} ${r2(Z(hz - 1.8) + 12)} q 0 6 3 6 q 3 0 3 -6`, 'l-dim', { fill: 'none' }));
  // the deck: 6×6 posts to grade, a doubled beam, 2×10 joists, decking, knee braces, and the 42 in rail
  const dk = m.deck, beam = 0.8, d0 = 0.5, d1 = dk.depth + 0.5;
  o.push(rect(X(d0), Z(m.eave), dk.depth * k, 1 / 12 * k + 1.5, 'c-deck'), rect(X(d0), Z(m.eave - 1 / 12), dk.depth * k, 9.25 / 12 * k, 'c-wood'));
  [d0 + 0.5, d1 - 0.5].forEach(x => {
    o.push(rect(X(x) - 3, Z(m.eave - beam - 0.5), 6, (m.eave - beam - 0.5 - g) * k, 'c-ptwood'), rect(X(x) - 5, Z(m.eave - beam), 10, 0.75 * k, 'c-wood'));
    o.push(rect(X(x) - 6, Z(g - 0.2), 12, 0.35 * k, 'c-steel'), rect(X(x) - 0.75 * k, Z(g), 1.5 * k, 5 * k, 'c-conc c-ghost'));
  });
  o.push(line(X(d0 + 0.5), Z(m.eave - beam - 4), X(d0 + 4.5), Z(m.eave - beam - 0.5), 'l-beam'), line(X(d1 - 0.5), Z(m.eave - beam - 4), X(d1 - 4.5), Z(m.eave - beam - 0.5), 'l-beam'));
  const rail = m.eave + dk.rail;
  o.push(line(X(d1), Z(m.eave), X(d1), Z(rail), 'l-rail'), line(X(d0), Z(rail), X(d1), Z(rail), 'l-rail'));
  for (let x = d0 + 0.5; x < d1; x += 0.5) o.push(line(X(x), Z(m.eave), X(x), Z(rail), 'l-joist'));
  // dimensions
  o.push(dimH(X(d0), X(d1), Z(g) + 40, `${dk.depth}′ deep deck`), dimV(X(d1) + 82, Z(m.eave), Z(hz), `${hz - m.eave}′ to the beam`, { right: true }));
  o.push(text(X(-9), Z(m.eave) + 40, `loft floor (${m.eave}′ above the floor)`, 't-s'));
  o.push(call(X(-0.3), Z(m.eave + 2.6), X(-5), Z(m.eave + 2.6), 'A'), call(X(-0.3), Z(m.eave + m.loftDoor.height + 0.4), X(-5), Z(m.eave + m.loftDoor.height + 0.4), 'B'), call(X(-4.5), Z(hz + 0.25), X(-4.5), Z(hz + 3.4), 'C'), call(X(0.3) + 4, Z(hz) - 6, X(1.6), Z(hz + 3.4), 'D'),
    call(X(-m.hoist.inside + 2.5), Z(hz + 0.9), X(-m.hoist.inside + 2.5), Z(hz + 3.4), 'E'), call(X(6), Z(m.eave - 0.5), X(6), Z(m.eave - 4.4), 'F'), call(X(d1 - 0.5) + 3, Z(8), X(d1 + 2.6), Z(8), 'G'), call(X(5.5), Z(rail), X(5.5), Z(rail + 2.2), 'H'), call(X(d0 + 2.5), Z(m.eave - 3), X(d0 + 2.5), Z(m.eave - 6.4), 'I'),
    call(...onBrace(0.62), X(d1 + 3.8), onBrace(0.62)[1] - 14, 'J'), call(X(tipX) + 3, Z(hz - 0.4), X(d1 + 3.8), Z(hz + 1.6), 'K'));
  return svg(700, 560, o, 'Detail 6, loft doors, hoist beam, and deck');
}

root.WorkshopDraw = Object.assign(root.WorkshopDraw, { detail1, detail2, detail3, detail4, detail5, detail6, detail7 });
})(typeof window !== 'undefined' ? window : globalThis);
