// The workshop drawings, drawn from the WorkshopModel so that a change of length or height redraws every plan, elevation, and section.
// Each function takes the model and returns an SVG string; the pages put it in a figure. Long descriptions live in the HTML legends beside
// the drawings, so the drawings carry only short labels. Colors and line styles come from docs/workshop.css.
(function (root) {
'use strict';

const r2 = value => { const x = Math.round(value * 100) / 100; return x === 0 ? 0 : x; };
const esc = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function el(name, attrs, inner) {
  const text = Object.keys(attrs).filter(key => attrs[key] !== undefined && attrs[key] !== null && attrs[key] !== false)
    .map(key => ` ${key}="${esc(typeof attrs[key] === 'number' ? r2(attrs[key]) : attrs[key])}"`).join('');
  return inner === undefined ? `<${name}${text}/>` : `<${name}${text}>${inner}</${name}>`;
}
const rect = (x, y, w, h, cls, a = {}) => el('rect', { x, y, width: w, height: h, class: cls, ...a });
const line = (x1, y1, x2, y2, cls, a = {}) => el('line', { x1, y1, x2, y2, class: cls, ...a });
const points = list => list.map(p => `${r2(p[0])},${r2(p[1])}`).join(' ');
const poly = (list, cls, a = {}) => el('polygon', { points: points(list), class: cls, ...a });
const polyline = (list, cls, a = {}) => el('polyline', { points: points(list), class: cls, fill: 'none', ...a });
const circle = (cx, cy, r, cls, a = {}) => el('circle', { cx, cy, r, class: cls, ...a });
const path = (d, cls, a = {}) => el('path', { d, class: cls, ...a });
const text = (x, y, content, cls = 't', a = {}) => el('text', { x, y, class: cls, ...a }, esc(content));
const group = (inner, a = {}) => el('g', a, Array.isArray(inner) ? inner.join('') : inner);
// Several lines of text, one element each, `step` pixels apart.
const lines = (x, y, list, cls = 't', step = 12, a = {}) => list.map((content, i) => text(x, y + i * step, content, cls, a)).join('');
const turned = (x, y, content, cls) => text(x, y, content, cls, { transform: `rotate(-90 ${r2(x)} ${r2(y)})` });

function svg(width, height, body, label) {
  return `<svg class="dwg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title>${Array.isArray(body) ? body.join('') : body}</svg>`;
}

const tick = (x, y) => line(x - 3, y + 3, x + 3, y - 3, 'l-dim');
// A dimension line between two x positions at height y, with its label above (or below).
function dimH(x1, x2, y, label, o = {}) {
  return group([line(x1, y, x2, y, 'l-dim'), tick(x1, y), tick(x2, y),
    text((x1 + x2) / 2, y + (o.below ? 12 : -4), label, 't-s t-m' + (o.bold ? ' t-b' : ''))]);
}
// The same, vertical, with its label turned to read upward beside the line.
function dimV(x, y1, y2, label, o = {}) {
  const cx = x + (o.right ? 13 : -5), cy = (y1 + y2) / 2;
  return group([line(x, y1, x, y2, 'l-dim'), tick(x, y1), tick(x, y2), turned(cx, cy, label, 't-s t-m' + (o.bold ? ' t-b' : ''))]);
}
const mk = (x, y, label) => group([circle(x, y, 8.5, 'mk-c'), text(x, y + 3.5, label, 'mk-t')], { class: 'mk' });
function arrow(x1, y1, x2, y2, cls = 'l-arrow') {
  const a = Math.atan2(y2 - y1, x2 - x1), h = 6, w = 3.2;
  const p1 = [x2 - h * Math.cos(a) + w * Math.sin(a), y2 - h * Math.sin(a) - w * Math.cos(a)];
  const p2 = [x2 - h * Math.cos(a) - w * Math.sin(a), y2 - h * Math.sin(a) + w * Math.cos(a)];
  return group([line(x1, y1, x2 - h * 0.6 * Math.cos(a), y2 - h * 0.6 * Math.sin(a), cls), poly([[x2, y2], p1, p2], 'c-arrow')]);
}
function compass(x, y) {
  return group([circle(x, y, 20, 'c-compass'), poly([[x, y - 15], [x + 4, y], [x, y + 15], [x - 4, y]], 'c-needle'),
    text(x, y - 25, 'N', 't-s t-m t-b'), text(x, y + 35, 'S', 't-s t-m'), text(x + 29, y + 3, 'E', 't-s t-m'), text(x - 29, y + 3, 'W', 't-s t-m')]);
}
// A 10 ft scale bar at s pixels per foot.
function scaleBar(x, y, s, feet = 10) {
  const half = feet / 2 * s;
  return group([rect(x, y, half, 4, 'c-bar1'), rect(x + half, y, half, 4, 'c-bar2'),
    text(x, y + 15, '0', 't-s t-m'), text(x + half, y + 15, `${feet / 2}′`, 't-s t-m'), text(x + 2 * half, y + 15, `${feet}′`, 't-s t-m')]);
}
function feetInches(value) {
  const whole = Math.floor(value + 1e-9), inches = Math.round((value - whole) * 12);
  return inches === 12 ? `${whole + 1}′-0″` : `${whole}′-${inches}″`;
}
// A window in an elevation: the frame, the glass, and the sash line (vertical for a slider, horizontal for a single-hung). x, y, w, h are in pixels.
function windowView(x, y, w, h, kind = 'slider') {
  const f = 2.4;
  return rect(x, y, w, h, 'c-winframe') + rect(x + f, y + f, w - 2 * f, h - 2 * f, 'c-glass')
    + (kind === 'slider' ? line(x + w / 2, y + f, x + w / 2, y + h - f, 'l-sash') : line(x + f, y + h / 2, x + w - f, y + h / 2, 'l-sash'));
}

// ------------------------------------------------------------------ plans

function floorPlan(m) {
  const s = 12, ox = 74, oy = 80, W = m.width, L = m.length;
  const X = ft => ox + ft * s, Y = ft => oy + ft * s;
  const o = [];
  const apron = 20;
  o.push(text(480, 20, 'FLOOR PLAN — MAIN LEVEL', 't-title t-m'));
  // concrete apron and the deck overhead
  o.push(rect(X(L), Y(m.doorY0), apron * s, (m.doorY1 - m.doorY0) * s, 'c-conc'));
  o.push(line(X(L + 10), Y(m.doorY0), X(L + 10), Y(m.doorY1), 'l-dash'));
  o.push(rect(X(m.deckX0), Y(m.deckY0), m.deck.depth * s, (m.deckY1 - m.deckY0) * s, 'c-above'));
  m.deckPosts.forEach(([x, y]) => o.push(rect(X(x) - 4, Y(y) - 4, 8, 8, 'c-ptwood')));
  o.push(text(X(m.deckX0 + m.deck.depth / 2), Y(m.doorY0) + 14, 'deck above', 't-s t-m'));
  o.push(lines(X(L + 15), Y(16) - 4, ['CONCRETE APRON', '14′ × 10–20′'], 't-s t-m', 11));
  // slab and walls
  o.push(rect(X(0), Y(0), L * s, W * s, 'c-slab'));
  o.push(rect(X(0.5), Y(0.5), (L - 1) * s, (W - 1) * s, 'l-hidden', { fill: 'none' }));
  const wx0 = m.walkX - m.walkDoor.width / 2, wx1 = m.walkX + m.walkDoor.width / 2;
  o.push(line(X(0), Y(0), X(L), Y(0), 'l-wall'), line(X(0), Y(0), X(0), Y(W), 'l-wall'));
  o.push(line(X(0), Y(W), X(wx0), Y(W), 'l-wall'), line(X(wx1), Y(W), X(L), Y(W), 'l-wall'));
  o.push(line(X(L), Y(0), X(L), Y(m.doorY0), 'l-wall'), line(X(L), Y(m.doorY1), X(L), Y(W), 'l-wall'));
  o.push(line(X(L), Y(m.doorY0), X(L), Y(m.doorY1), 'l-door'));
  // stairs: first flight along the south wall, landing at the southwest corner, second flight along the west wall
  const tread = m.stair.tread / 12, [f1, f2] = m.flights, sw = m.stair.width, ld = m.stair.landing;
  o.push(rect(X(ld), Y(W - sw), f1.run * s, sw * s, 'c-stair'));
  for (let k = 0; k <= f1.treads; k++) o.push(line(X(ld + k * tread), Y(W - sw), X(ld + k * tread), Y(W), 'l-tread'));
  o.push(rect(X(0), Y(W - sw), ld * s, sw * s, 'c-landing'));
  o.push(rect(X(0), Y(W - ld - f2.run), sw * s, f2.run * s, 'c-stair'));
  for (let k = 0; k <= f2.treads; k++) o.push(line(X(0), Y(W - ld - k * tread), X(sw), Y(W - ld - k * tread), 'l-tread'));
  o.push(arrow(X(ld + f1.run - 1), Y(W - sw / 2), X(ld + 1), Y(W - sw / 2)));
  o.push(text(X(ld + f1.run / 2 + 1), Y(W - sw / 2) - 6, `UP ${feetInches(f1.rise)}`, 't-b t-m'));
  o.push(arrow(X(sw / 2 + 0.7), Y(W - ld - 1), X(sw / 2 + 0.7), Y(W - ld - f2.run + 1)));
  o.push(turned(X(0.9), Y(W - ld - f2.run / 2), `UP ${feetInches(f2.rise)}`, 't-b t-m'));
  o.push(rect(X(0), Y(m.loftOpening.fromNorth), m.loftOpening.width * s, m.loftOpening.length * s, 'c-open'));
  // equipment
  const stove = [L - 11.5, 24];
  o.push(circle(X(stove[0]), Y(stove[1]), 1.5 * s, 'c-stove'), text(X(stove[0]), Y(stove[1]) + 3.5, 'STOVE', 't-s t-m t-b'), text(X(stove[0]), Y(stove[1]) + 2.4 * s + 2, 'location TBD', 't-s t-m'));
  o.push(rect(X(L) - 11, Y(25.2), 8, 2.4 * s, 'c-panel'), text(X(L) - 15, Y(26.4) + 3, '200 A panel', 't-s t-e'));
  o.push(path(`M ${r2(X(L - 6))} ${r2(Y(W) + 56)} V ${r2(Y(29.2))} H ${r2(X(L) - 7)} V ${r2(Y(27.6))}`, 'l-cond'));
  o.push(lines(X(L - 6) - 6, Y(W) + 36, ['sub-feed conduit from the south', '(pump house, about 29 ft)'], 't-s t-e t-blue', 11));
  o.push(rect(X(0) - 26, Y(5), 24, 3 * s, 'c-unit'), lines(X(0) - 30, Y(5) + 14, ['mini-split', 'condenser'], 't-s t-e', 11));
  // walk door and its swing
  o.push(line(X(wx0), Y(W), X(wx0), Y(W) + m.walkDoor.width * s, 'l-leaf'));
  o.push(path(`M ${r2(X(wx1))} ${r2(Y(W))} A ${m.walkDoor.width * s} ${m.walkDoor.width * s} 0 0 1 ${r2(X(wx0))} ${r2(Y(W) + m.walkDoor.width * s)}`, 'l-swing'));
  // windows: a glazed gap in the wall with the sash line down its middle
  m.windows.filter(w => w.wall !== 'W').forEach(w => {
    const y = w.wall === 'N' ? 0 : W;
    o.push(rect(X(w.at - w.width / 2), Y(y) - 2.5, w.width * s, 5, 'c-winplan'), line(X(w.at - w.width / 2), Y(y), X(w.at + w.width / 2), Y(y), 'l-sash'));
  });
  // posts
  const post = (x, y) => rect(X(x) - 6, Y(y) - 6, 12, 12, 'c-post');
  m.postX.forEach(x => { o.push(post(x, 0), post(x, W)); });
  m.gableY.forEach(y => o.push(post(0, y)));
  o.push(post(L, m.doorY0), post(L, m.doorY1));
  // dimensions
  o.push(dimH(X(0), X(L), 46, `${feetInches(L)}`, { bold: true }));
  let at = 0;
  m.bays.forEach(bay => { o.push(dimH(X(at), X(at + bay), 64, `${bay}′`)); at += bay; });
  o.push(dimV(X(L + 22.5), Y(0), Y(m.doorY0), '9′', { right: true }), dimV(X(L + 22.5), Y(m.doorY0), Y(m.doorY1), `${m.mainDoor.width}′ DOOR`, { right: true }), dimV(X(L + 22.5), Y(m.doorY1), Y(W), '9′', { right: true }));
  o.push(dimV(X(L + 26), Y(0), Y(W), `${feetInches(W)}`, { right: true, bold: true }));
  // markers
  o.push(mk(X(m.postX[3]), Y(2.4), '1'), mk(X(L - 2.2), Y(16), '2'), mk(X(L) + 14, Y(W) + 18, '3'), mk(X(2), Y(W - 2), '4'),
    mk(X(5.4), Y(20), '5'), mk(X(stove[0]), Y(stove[1]) - 2.2 * s, '6'), mk(X(L) - 84, Y(26.4), '7'), mk(X(0) - 14, Y(5) - 12, '8'),
    mk(X(L + 5), Y(16) + 2, '10'), mk(X(L + 15), Y(19) + 6, '12'), mk(X(L - 6) + 16, Y(W) + 56, '13'));
  const north = m.windows.filter(w => w.wall === 'N'), south = m.windows.filter(w => w.wall === 'S');
  if (north.length) o.push(mk(X(north[0].at), Y(2.4), '15'), text(X(north[0].at) + 14, Y(2.4) + 3.5, 'windows', 't-s'));
  if (south.length) {
    const mid = south[1] || south[0];
    o.push(mk(X(mid.at), Y(W - 2.4), '15'), text(X(mid.at) + 14, Y(W - 2.4) + 3.5, 'windows', 't-s'));
  }
  o.push(text(X(6.6), Y(20) + 3, 'loft opening above', 't-s'));
  o.push(compass(X(L + 22), Y(W) + 62), scaleBar(X(0), Y(W) + 70, s));
  return svg(Math.max(960, X(L + 29)), 590, o, `Floor plan, main level, ${m.width} by ${m.length} feet`);
}

function loftPlan(m) {
  const s = 12, ox = 74, oy = 80, W = m.width, L = m.length;
  const X = ft => ox + ft * s, Y = ft => oy + ft * s;
  const o = [];
  const k = m.knuckleRun;
  o.push(text(480, 20, 'LOFT PLAN', 't-title t-m'));
  o.push(rect(X(0), Y(0), L * s, W * s, 'c-loft'));
  o.push(rect(X(0), Y(0), L * s, k * s, 'c-low'), rect(X(0), Y(W - k), L * s, k * s, 'c-low'));
  m.trussX.forEach(x => o.push(line(X(x), Y(0), X(x), Y(W), 'l-truss')));
  // headroom lines
  [5, 7].forEach(h => {
    const d = m.knuckleRun * h / m.knuckleRise, west = h === 7;
    o.push(line(X(0), Y(d), X(L), Y(d), 'l-head'), line(X(0), Y(W - d), X(L), Y(W - d), 'l-head'));
    const tx = west ? X(m.loftOpening.width + 0.4) : X(L - 0.4), cls = west ? 't-s' : 't-s t-e';
    o.push(text(tx, Y(d) - 2, `${h}′ headroom`, cls), text(tx, Y(W - d) + 10, `${h}′ headroom`, cls));
  });
  o.push(line(X(0), Y(k), X(L), Y(k), 'l-knuckle'), line(X(0), Y(W - k), X(L), Y(W - k), 'l-knuckle'));
  o.push(text(X(L / 2), Y(k) - 4, `pitch break (knuckle), ${m.knuckleRise}′ of headroom, ${k}′ in from each wall`, 't-s t-m'));
  o.push(text(X(L / 2), Y(W - k) + 12, `pitch break (knuckle), ${m.knuckleRise}′ of headroom, ${k}′ in from each wall`, 't-s t-m'));
  o.push(text(X(L / 2), Y(2.6), `headroom slopes from ${m.knuckleRise}′ at the break to 0 at the wall`, 't-s t-m t-i'));
  o.push(text(X(L / 2), Y(W - 1.8), `headroom slopes from ${m.knuckleRise}′ at the break to 0 at the wall`, 't-s t-m t-i'));
  o.push(lines(X(L / 2 - 2), Y(16) - 10, ['LOFT FLOOR · ¾″ T&G PLYWOOD', `${m.loads.loftLive} psf live load (the truss plant designs to it)`], 't-m t-faint', 14));
  o.push(lines(X(L / 2 - 2), Y(16) + 26, [`FULL HEADROOM ZONE — ${r2(W - 2 * k)}′ wide, ${m.peakZ - m.eave}′ at the ridge`, `7′ or more of headroom: ${r2(m.loft7Width)}′ wide`], 't-s t-m t-red t-b', 12));
  // stair opening with guard
  const lo = m.loftOpening;
  o.push(rect(X(0), Y(lo.fromNorth), lo.width * s, lo.length * s, 'c-open'));
  o.push(line(X(lo.width), Y(lo.fromNorth), X(lo.width), Y(lo.fromNorth + lo.length), 'l-rail'), line(X(0), Y(lo.fromNorth + lo.length), X(lo.width), Y(lo.fromNorth + lo.length), 'l-rail'));
  o.push(lines(X(lo.width / 2), Y(lo.fromNorth + 3), ['STAIR', 'OPENING'], 't-s t-m t-red t-b', 11));
  // walls
  o.push(rect(X(0), Y(0), L * s, W * s, 'l-wall', { fill: 'none' }));
  // the window in the west wall
  m.windows.filter(w => w.wall === 'W').forEach(w => {
    o.push(rect(X(0) - 2.5, Y(w.at - w.width / 2), 5, w.width * s, 'c-winplan'), line(X(0), Y(w.at - w.width / 2), X(0), Y(w.at + w.width / 2), 'l-sash'));
    o.push(mk(X(2.2), Y(w.at - w.width / 2 - 3.2), '15'), text(X(2.2) + 14, Y(w.at - w.width / 2 - 3.2) + 3.5, 'window', 't-s'));
  });
  // loft doors, deck, hoist
  const d0 = m.loftDoorY0, d1 = m.loftDoorY1;
  o.push(rect(X(L) - 2, Y(d0), 4, (d1 - d0) * s, 'c-gap'));
  o.push(path(`M ${r2(X(L))} ${r2(Y(d0))} A ${m.loftDoor.width / 2 * s} ${m.loftDoor.width / 2 * s} 0 0 1 ${r2(X(L + 2.5))} ${r2(Y(d0 + 2.5))}`, 'l-swing'),
    path(`M ${r2(X(L))} ${r2(Y(d1))} A ${m.loftDoor.width / 2 * s} ${m.loftDoor.width / 2 * s} 0 0 0 ${r2(X(L + 2.5))} ${r2(Y(d1 - 2.5))}`, 'l-swing'));
  const dk = m.deck, dx0 = m.deckX0, dx1 = m.deckX1;
  o.push(rect(X(dx0), Y(m.deckY0), dk.depth * s, (m.deckY1 - m.deckY0) * s, 'c-deck'));
  for (let j = 0; j <= dk.depth; j += dk.joistSpacing) o.push(line(X(dx0 + j), Y(m.deckY0), X(dx0 + j), Y(m.deckY1), 'l-joist'));
  o.push(line(X(dx0), Y(m.deckY0), X(dx1), Y(m.deckY0), 'l-beam'), line(X(dx0), Y(m.deckY1), X(dx1), Y(m.deckY1), 'l-beam'));
  o.push(polyline([[X(dx0), Y(m.deckY0 + 0.25)], [X(dx1 - 0.25), Y(m.deckY0 + 0.25)], [X(dx1 - 0.25), Y(m.deckY1 - 0.25)], [X(dx0), Y(m.deckY1 - 0.25)]], 'l-rail'));
  m.deckPosts.forEach(([x, y]) => o.push(rect(X(x) - 4, Y(y) - 4, 8, 8, 'c-ptwood')));
  const hx0 = L - m.hoist.inside, hx1 = L + m.hoist.out, hy = m.half;
  o.push(rect(X(hx0), Y(hy) - 3, (hx1 - hx0) * s, 6, 'c-steel c-above-line'));
  m.hoistBraces.forEach(b => o.push(line(X(b.foot[0]), Y(b.foot[1]), X(b.tip[0]), Y(b.tip[1]), 'l-brace')));
  o.push(lines(X(L + 14), Y(m.deckY0) + 14, [`DECK ${dk.width}′ × ${dk.depth}′, free-standing`, '42″ rail · 2×10 joists', `${dk.joistSpacing * 12}″ OC, north-south`], 't-s', 11));
  o.push(lines(X(L + 14), Y(hy) + 26, ['W6 hoist beam, above the floor:', `${feetInches(m.hoist.out)} out past the wall, ${m.hoist.inside}′ in`, `(${m.hoist.beyondDeck}′ past the deck's edge)`, 'two braces rise from the deck\'s', 'outer corners to its tip'], 't-s', 11));
  const bn = m.hoistBraces[0], bx = (bn.foot[0] + bn.tip[0]) / 2, by = (bn.foot[1] + bn.tip[1]) / 2;
  o.push(mk(X(2), Y(lo.fromNorth) - 12, '5'), mk(X(L) - 14, Y(d0) - 12, '9'), mk(X(dx0 + 5), Y(m.deckY0 + 5), '10'), mk(X(hx1) + 14, Y(hy), '11'), mk(X(bx), Y(by), '17'));
  // dimensions
  o.push(dimH(X(0), X(L), 46, feetInches(L), { bold: true }), dimV(X(0) - 12, Y(0), Y(W), feetInches(W), { bold: true }));
  o.push(compass(X(L + 22), Y(W) - 8), scaleBar(X(0), Y(W) + 30, s));
  return svg(Math.max(960, X(L + 29)), 530, o, `Loft plan, ${m.width} by ${m.length} feet`);
}

root.WorkshopDraw = Object.assign(root.WorkshopDraw || {}, {
  kit: { r2, esc, el, rect, line, poly, polyline, circle, path, text, lines, turned, group, svg, dimH, dimV, tick, mk, arrow, compass, scaleBar, feetInches, windowView },
  floorPlan, loftPlan
});
})(typeof window !== 'undefined' ? window : globalThis);
