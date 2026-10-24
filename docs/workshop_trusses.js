// The truss package drawings: one gambrel truss in profile with its loft floor and the room it must leave open, and the layout of all the
// trusses with the few that differ from the common one. Part of WorkshopDraw; workshop_draw.js loads first.
(function (root) {
'use strict';
const D = root.WorkshopDraw;
if (!D || !D.kit) throw new Error('Load workshop_draw.js before workshop_trusses.js');
const { rect, line, poly, polyline, circle, text, lines, svg, dimH, dimV, tick, mk, arrow, compass, scaleBar, feetInches } = D.kit;

const call = (px, py, mx, my, label) => line(px, py, mx, my, 'l-ext') + circle(px, py, 1.8, 'c-bolt') + mk(mx, my, label);
// A label with a paper-colored patch behind it, so lines drawn under it do not run through the letters.
const tag = (x, y, content, cls = 't-s t-m', chars = content.length) => rect(x - chars * 2.5 - 2, y - 9, chars * 5 + 4, 12, 'c-gap') + text(x, y, content, cls);

// ------------------------------------------------------------------ the profile

// One truss across the width, looking east: north on the left, as in Section A. Everything is to scale. The top chords are the 7¼″ ones the headroom is measured under.
function trussProfile(m) {
  const s = 22, W = m.width, ox = 92, gy = 628, o = [];
  const X = y => ox + y * s, Z = z => gy - z * s;
  const px = list => list.map(([y, z]) => [X(y), Z(z)]);
  const mirror = ([y, z]) => [W - y, z];
  const t = m.truss, floor = m.eave, half = m.wall.post / 24;
  const chordTop = floor - m.decking / 12, chordBottom = chordTop - m.chordInches / 12;
  const lvlWide = m.carrier.wide / 12, lvlTall = m.carrier.tall / 12, lvlBottom = chordBottom - lvlTall;
  const edge = m.knuckleRun, clearEdge = t.clearAt(edge);
  const [kx, kz] = t.innerKnuckle;
  const lowerRoofAt = y => floor + y * m.knuckleRise / m.knuckleRun, upperRoofAt = y => m.knuckleZ + (y - m.knuckleRun) * m.upperRise / m.upperRun;

  o.push(text(480, 22, 'TRUSS PROFILE — ONE GAMBREL TRUSS WITH ITS LOFT FLOOR, LOOKING EAST', 't-title t-m'), text(X(0) - 4, 52, 'N ◀', 't-b t-red t-m'), text(X(W) + 4, 52, '▶ S', 't-b t-red t-m'));

  // the room the truss leaves open, between the two pitch-break lines, and the knee zones outside them
  const knee = [[t.clearFrom(0), floor], [edge, floor], [edge, floor + clearEdge]];
  o.push(poly(px(knee), 'c-knee'), poly(px(knee.map(mirror)), 'c-knee'));
  o.push(poly(px([[edge, floor], [edge, floor + clearEdge], t.innerKnuckle, t.innerRidge, mirror(t.innerKnuckle), [W - edge, floor + clearEdge], [W - edge, floor]]), 'c-clear'));

  // the posts, cut to the underside of the top chord, and the carriers on their inside faces
  const postTop = floor - m.postTopBelowEave / 12, postBase = 11.4;
  const under = y => kz + (y - kx) * t.lowerSlope;
  const bevel = kx + (postTop - kz) / t.lowerSlope;
  const post = [[-half, postBase], [-half, Math.min(postTop, under(-half))], ...(bevel < half ? [[bevel, postTop], [half, postTop]] : [[half, under(half)]]), [half, postBase]];
  o.push(poly(px(post), 'c-post'), poly(px(post.map(mirror)), 'c-post'));
  [-half, half].forEach(y => o.push(line(X(y), Z(postBase), X(y), Z(postBase - 0.9), 'l-post'), line(X(W - y), Z(postBase), X(W - y), Z(postBase - 0.9), 'l-post')));
  o.push(rect(X(half), Z(chordBottom), lvlWide * s, lvlTall * s, 'c-lvl'), rect(X(W - half - lvlWide), Z(chordBottom), lvlWide * s, lvlTall * s, 'c-lvl'));

  // the webs and kickers the plant may add in the knee zones, indicative: 3½″ lumber, dashed, standing on the loft floor and ending in the underside of the lower chord, which is
  // drawn over their upper ends. They stay outside the open room.
  const wide = t.webs.wide;
  const member = ([a, b]) => {
    const dy = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dy, dz), end = [b[0] + dy / len * 0.2, b[1] + dz / len * 0.2];
    const nx = -dz / len * wide / 2, nz = dy / len * wide / 2;
    return poly(px([[a[0] + nx, a[1] + nz], [end[0] + nx, end[1] + nz], [end[0] - nx, end[1] - nz], [a[0] - nx, a[1] - nz]]), 'c-web');
  };
  [t.webs.vertical, t.webs.kicker].forEach(seg => o.push(member(seg), member(seg.map(mirror))));

  // the bottom chord with the loft floor on it, then the top chords
  o.push(rect(X(half), Z(chordTop), (W - 2 * half) * s, m.chordInches / 12 * s, 'c-wood'), rect(X(half), Z(floor), (W - 2 * half) * s, m.decking / 12 * s + 0.8, 'c-osb'));
  t.chords.forEach(quad => o.push(poly(px(quad), 'c-wood')));
  // the collar tie joins the two upper top chords, with its ends cut to their slope
  o.push(poly(px(t.tie.body), 'c-wood'));
  // the plates lie flat on the faces of the chords at the knee and the ridge and across the ends of the tie, so they take no headroom
  o.push(poly(px(t.plates.knee), 'c-plate'), poly(px(t.plates.knee.map(mirror)), 'c-plate'), poly(px(t.plates.ridge), 'c-plate'), ...t.tie.plates.map(p => poly(px(p), 'c-plate')));
  o.push(polyline(t.outline.map(([y, z]) => [X(y), Z(z) - 4]), 'c-roofline'));
  o.push(text(X(25.4), Z(25.7), 'roof framing and steel stand about', 't-s t-i t-m'), text(X(25.4), Z(25.7) + 11, `${Math.round(m.roofBuild * 12)}″ above the truss, not part of it`, 't-s t-i t-m'));

  // dimensions: across, below the floor
  const rowOne = Z(postBase) + 40, rowTwo = rowOne + 30;
  [[0, rowTwo, postBase - 0.9], [W, rowTwo, postBase - 0.9], [edge, rowOne, chordBottom], [W - edge, rowOne, chordBottom]].forEach(([y, to, from]) => o.push(line(X(y), Z(from) + 2, X(y), to + 4, 'l-ext')));
  o.push(dimH(X(0), X(edge), rowOne, feetInches(edge)), dimH(X(edge), X(W - edge), rowOne, `${feetInches(W - 2 * edge)} open room`, { bold: true }), dimH(X(W - edge), X(W), rowOne, feetInches(edge)));
  o.push(dimH(X(0), X(W), rowTwo, `${feetInches(W)} wall line to wall line`, { bold: true }));
  o.push(line(X(half), Z(chordBottom) + 2, X(half), Z(12.0) + 4, 'l-ext'), line(X(W - half), Z(chordBottom) + 2, X(W - half), Z(12.0) + 4, 'l-ext'));
  o.push(dimH(X(half), X(W - half), Z(12.0), `${root.WorkshopModel.feetInchesQuarter(W - 2 * half)} bottom chord, post face to post face`));
  // dimensions: heights above the loft floor, on the right
  const dx = X(W) + 46;
  o.push(line(X(W) + 6, Z(floor), dx + 48, Z(floor), 'l-ext'), line(X(W - edge) + 4, Z(m.knuckleZ), dx + 4, Z(m.knuckleZ), 'l-ext'), line(X(m.half) + 6, Z(m.peakZ) - 4, dx + 48, Z(m.peakZ) - 4, 'l-ext'));
  o.push(dimV(dx, Z(floor), Z(m.knuckleZ), feetInches(m.knuckleRise), { right: true }), dimV(dx, Z(m.knuckleZ), Z(m.peakZ), feetInches(m.upperRise), { right: true }));
  o.push(dimV(dx + 44, Z(floor), Z(m.peakZ), `${feetInches(m.peakZ - floor)} to the ridge`, { right: true, bold: true }), text(dx + 52, Z(floor) + 12, 'loft floor', 't-s'));
  // the clear height under the chords, and how wide the loft is at a given clear height
  const across = (h, label) => {
    const from = t.clearFrom(h), z = Z(floor + h);
    return line(X(from), z, X(W - from), z, 'l-dim') + tick(X(from), z) + tick(X(W - from), z) + text(X(11.6), z - 4, label, 't-s t-m');
  };
  o.push(across(7, `7′ clear for ${feetInches(t.clearWidth(7))}`), across(5, `5′ clear for ${feetInches(t.clearWidth(5))}`));
  o.push(dimV(X(edge), Z(floor), Z(floor + clearEdge), `${feetInches(clearEdge)} clear`, { right: true, bold: true }), dimV(X(W - edge), Z(floor), Z(floor + clearEdge), `${feetInches(clearEdge)} clear`, { bold: true }));
  o.push(dimV(X(m.half), Z(floor), Z(t.tie.z), `${feetInches(m.bracing.tieAt)} clear under the tie`, { right: true, bold: true }));
  o.push(text(X(22.4), Z(16.6), 'OPEN ROOM', 't-b t-m'), text(X(22.4), Z(16.6) + 11, 'no webs or posts', 't-s t-m'));
  o.push(lines(X(-half) - 7, Z(postBase - 0.3), ['post runs down', 'to its pier'], 't-s t-i t-e', 11), lines(X(W + half) + 7, Z(postBase - 0.3), ['post runs down', 'to its pier'], 't-s t-i', 11));

  // markers
  o.push(call(X(9.5), Z(chordBottom), X(9.5), Z(10.9), 'A'), call(X(half + lvlWide / 2), Z(lvlBottom), X(2.6), Z(11.2), 'B'));
  o.push(call(X(3.2), Z(lowerRoofAt(3.2)) - 6, X(0.3), Z(21.2), 'C'), call(X(m.knuckleRun), Z(m.knuckleZ) - 6, X(4.8), Z(24.3), 'D'));
  o.push(call(X(11.5), Z(upperRoofAt(11.5)) - 6, X(10.4), Z(26.1), 'E'), call(X(m.half), Z(m.peakZ) - 6, X(m.half), Z(26.5), 'F'));
  o.push(mk(X(19.2), Z(17.3), 'G'), mk(X(2.3), Z(floor + 0.62), 'H'));
  o.push(call(X(18.4), Z(t.tie.z) + 3, X(17.8), Z(floor + 6.1), 'J'));
  const kick = t.webs.kicker, kickAt = [(kick[0][0] + kick[1][0]) / 2, (kick[0][1] + kick[1][1]) / 2];
  o.push(call(X(kickAt[0]), Z(kickAt[1]), X(5.9), Z(floor + 1.0), 'K'));
  const kneeAt = t.plates.knee.reduce((c, p) => [c[0] + p[0] / t.plates.knee.length, c[1] + p[1] / t.plates.knee.length], [0, 0]);
  o.push(call(X(kneeAt[0]), Z(kneeAt[1]), X(7.7), Z(25.2), 'L'));
  o.push(call(X(-t.tailRun) + 2, Z(floor - t.tailDrop), X(-2.5), Z(12.0), 'I'));
  return svg(960, 490, o, 'The gambrel truss in profile, with the open room under its top chords');
}

// ------------------------------------------------------------------ the last step

// The last step of the bracing, to scale: a short kicker across each knee, under the collar tie that is in the design, and what the kicker takes out of the open room.
function trussOptions(m) {
  const s = 27, W = m.width, ox = 48, gy = 346, o = [];
  const t = m.truss, b = m.bracing, floor = m.eave, edge = m.knuckleRun, clearEdge = t.clearAt(edge), tie = t.tie;
  const X = y => ox + y * s, Z = h => gy - h * s;                           // y in from the north wall line, h above the loft floor
  const px = list => list.map(([y, z]) => [X(y), Z(z - floor)]);
  const mirror = ([y, z]) => [W - y, z];
  o.push(text(480, 22, 'THE LAST STEP, TO SCALE: A KICKER ACROSS EACH KNEE, UNDER THE COLLAR TIE', 't-title t-m'));
  const knee = [[t.clearFrom(0), floor], [edge, floor], [edge, floor + clearEdge]];
  o.push(poly(px(knee), 'c-knee'), poly(px(knee.map(mirror)), 'c-knee'));
  o.push(poly(px([[edge, floor], [edge, floor + clearEdge], t.innerKnuckle, t.innerRidge, mirror(t.innerKnuckle), [W - edge, floor + clearEdge], [W - edge, floor]]), 'c-clear'));
  o.push(rect(X(0), Z(0), W * s, m.chordInches / 12 * s, 'c-wood'));
  t.chords.forEach(quad => o.push(poly(px(quad), 'c-wood')));
  // the collar tie is in the design
  o.push(poly(px(tie.body), 'c-wood'), ...tie.plates.map(p => poly(px(p), 'c-plate')));
  o.push(dimH(X(tie.from), X(W - tie.from), Z(b.tieAt) + 16, `${feetInches(tie.length)} long, its underside ${feetInches(b.tieAt)} up`, { below: true }));
  // step 6: a kicker across each knee cuts the corner of the room along the line between its leg ends
  const k = t.haunch(b.kickerLeg), wedge = [k.a, t.innerKnuckle, k.b];
  o.push(poly(px(wedge), 'c-opt'), poly(px(wedge.map(mirror)), 'c-opt'));
  o.push(dimV(X(edge), Z(0), Z(k.edgeClear), `${feetInches(k.edgeClear)} clear`, { right: true, bold: true }));
  // notes: the step number of the table, and the letter of the profile for the tie
  const wedgeAt = [(k.a[0] + k.b[0] + t.innerKnuckle[0]) / 3, (k.a[1] + k.b[1] + t.innerKnuckle[1]) / 3 - floor], noteZ = 10.5;
  o.push(call(X(wedgeAt[0]), Z(wedgeAt[1]), X(2.6), Z(noteZ), '6'), call(X(tie.from + tie.length * 0.8), Z(b.tieAt + tie.deep / 2), X(W - 2.6), Z(noteZ), 'J'));
  o.push(lines(X(2.6) + 16, Z(noteZ) - 1, [`Kicker across each knee, legs of ${feetInches(b.kickerLeg)}`, `7′ clear for ${feetInches(k.width7)}, not ${feetInches(t.clearWidth(7))}`], 't-s', 12));
  o.push(lines(X(W - 2.6) - 16, Z(noteZ) - 1, ['Collar tie, in the design', `${feetInches(b.tieAt)} clear under it, ${feetInches(t.clearAt(m.half))} to the ridge`], 't-s t-e', 12));
  return svg(960, 400, o, 'The kicker across each knee, drawn to scale under the collar tie');
}

// ------------------------------------------------------------------ the layout

// The loft floor from above, north at the top: every truss as a line, numbered from the west end. The trusses that differ from the common one are marked S1 to S5.
function trussLayout(m) {
  const s = 12, L = m.length, W = m.width, ox = 62, oy = 90, o = [];
  const X = x => ox + x * s, Y = y => oy + y * s;
  const t = m.truss, half = m.wall.post / 24, lvlWide = m.carrier.wide / 12, edge = m.knuckleRun, open = m.loftOpening;
  const stair = new Set(m.specialTrusses.stairEdge.map(k => k.number)), hoist = new Set(m.specialTrusses.hoist.map(k => k.number));
  const kneeDepth = edge - t.clearFrom(0);

  o.push(text(480, 22, 'TRUSS LAYOUT — THE LOFT FLOOR FROM ABOVE, NORTH AT THE TOP', 't-title t-m'));
  // the room zones run the whole length
  o.push(rect(X(0), Y(t.clearFrom(0)), L * s, kneeDepth * s, 'c-knee'), rect(X(0), Y(W - edge), L * s, kneeDepth * s, 'c-knee'), rect(X(0), Y(edge), L * s, (W - 2 * edge) * s, 'c-clear'));
  // the deck, the hoist beam and its braces outside the east wall
  o.push(rect(X(m.deckX0), Y(m.deckY0), m.deck.depth * s, (m.deckY1 - m.deckY0) * s, 'c-above'), text(X(m.deckX0 + m.deck.depth / 2), Y(m.deckY0) + 14, 'deck, below the beam', 't-s t-m'));
  m.hoistBraces.forEach(b => o.push(line(X(b.foot[0]), Y(b.foot[1]), X(b.tip[0]), Y(b.tip[1]), 'l-brace')));
  // walls, posts, and the carriers on the posts' inside faces
  o.push(rect(X(0), Y(0), L * s, W * s, 'l-wall', { fill: 'none' }));
  o.push(rect(X(0), Y(half), L * s, lvlWide * s, 'c-lvl'), rect(X(0), Y(W - half - lvlWide), L * s, lvlWide * s, 'c-lvl'));
  m.postX.forEach(x => [0, W].forEach(y => o.push(rect(X(x) - 2.4, Y(y) - half * s, 4.8, 2 * half * s, 'c-post'))));
  // the trusses: T1 at the west gable to the last at the east gable
  const last = m.trussCount;
  m.trussX.forEach((x, i) => {
    const number = i + 1, kind = [number === 1 || number === last ? 'l-tr-gable' : '', stair.has(number) ? 'l-tr-stair' : '', hoist.has(number) ? 'l-tr-hoist' : ''].filter(Boolean).join(' ');
    const cls = `l-tr ${kind}`.trim(), cut = m.specialTrusses.stairCut.some(k => k.number === number);
    if (cut) o.push(line(X(x), Y(half), X(x), Y(open.fromNorth), cls), line(X(x), Y(open.fromNorth + open.length), X(x), Y(W - half), cls));
    else o.push(line(X(x), Y(half), X(x), Y(W - half), cls));
    o.push(text(X(x), Y(0) - 10, `T${number}`, number === 1 || number === last ? 't-s t-m t-b' : 't-s t-m'));
  });
  // the stair opening, with its two headers
  o.push(rect(X(0), Y(open.fromNorth), open.width * s, open.length * s, 'c-open'));
  [open.fromNorth, open.fromNorth + open.length].forEach(y => o.push(line(X(0), Y(y), X(open.width), Y(y), 'l-joint', { 'stroke-width': 3.2 })));
  o.push(tag(X(open.width / 2), Y(open.fromNorth) + 15, `${m.specialTrusses.stairCut.map(k => `T${k.number}`).join(', ')} cut`, 't-s t-m', 6));
  // the loft doors on the east gable and the loft window on the west gable, drawn just inside the gable trusses
  o.push(rect(X(L) - 9, Y(m.loftDoorY0), 5, (m.loftDoorY1 - m.loftDoorY0) * s, 'c-opening'));
  const win = m.windows.find(w => w.loft);
  if (win) o.push(rect(X(0) + 4, Y(win.at - win.width / 2), 5, win.width * s, 'c-glass'));
  // the beam
  o.push(rect(X(L - m.hoist.inside), Y(m.half) - 2.5, m.hoistLength * s, 5, 'c-steel'));
  o.push(tag(X(L + 5.5), Y(m.half) - 14, `W6 hoist beam, ${feetInches(m.hoistLength)} long`, 't-s t-m', 26));
  o.push(lines(X(L + m.hoist.out) + 9, Y(m.half) - 2, ['beam tip,', `${feetInches(m.hoist.beyondDeck)} past`, 'the deck'], 't-s', 11));
  // what the zones are
  o.push(tag(X(20), Y(11.5), `OPEN ROOM, ${feetInches(W - 2 * edge)} wide: no webs or posts`, 't-s t-m t-b', 41));
  [(t.clearFrom(0) + edge) / 2, W - (t.clearFrom(0) + edge) / 2].forEach(y => o.push(tag(X(14), Y(y), 'KNEE ZONE: webs allowed', 't-s t-m', 23)));
  // dimensions
  o.push(dimH(X(0), X(L), Y(W) + 30, `${m.trussCount - 1} spaces at ${feetInches(m.trussSpacing)} OC, ${m.trussCount} trusses, ${feetInches(L)}`, { bold: true }));
  o.push(dimV(X(0) - 28, Y(0), Y(W), feetInches(W), { bold: true }));
  // markers
  o.push(mk(X(2), Y(open.fromNorth + 7), 'S1'), call(X(43), Y(m.half) - 2.5, X(43), Y(m.half) - 22, 'S2'));
  o.push(call(X(L) - 6.5, Y(m.loftDoorY1), X(L - 1), Y(m.loftDoorY1) + 20, 'S3'));
  if (win) o.push(call(X(0) + 6.5, Y(win.at), X(1), Y(win.at) - 24, 'S4'));
  o.push(call(X(L) - 1.8, Y(6), X(L - 1), Y(6), 'S5'), call(X(0) + 1.8, Y(6), X(1), Y(6), 'S5'));
  // the key to the truss lines, a compass, and a scale
  const upTo = set => `T${Math.min(...set)} to T${Math.max(...set)}`;
  [['l-tr', 'common truss'], ['l-tr l-tr-gable', 'heavy line: gable-end truss'], ['l-tr l-tr-stair', `stair trusses, ${upTo(stair)}`], ['l-tr l-tr-hoist', `hoist trusses, ${upTo(hoist)}`]]
    .forEach(([cls, label], i) => o.push(line(790, 200 + i * 18, 816, 200 + i * 18, cls), text(824, 203 + i * 18, label, 't-s')));
  o.push(lines(790, 436, [`Collar tie ${feetInches(m.bracing.tieAt)} up on ${upTo(new Set(m.specialTrusses.tied.map(k => k.number)))};`, 'none on the hoist trusses'], 't-s', 11));
  o.push(compass(900, 120), scaleBar(790, 470, s, 10));
  return svg(960, 520, o, 'The layout of the trusses on the loft floor, with the special trusses marked');
}

root.WorkshopDraw = Object.assign(root.WorkshopDraw, { trussProfile, trussOptions, trussLayout });
})(typeof window !== 'undefined' ? window : globalThis);
