// The workshop's framing in perspective: every post, girt, truss chord, purlin, deck joist, and the hoist is a solid member built from the design model,
// and the views draw the members back to front, so the near wall's girts hide what is behind them the way the frame looks from the yard.
// Part of WorkshopDraw (workshop_draw.js must load first). Model coordinates run x east, y south, z up; the drawing works in east-north-up.
(function (root) {
'use strict';
const D = root.WorkshopDraw;
if (!D || !D.kit) throw new Error('Load workshop_draw.js before workshop_3d.js');
const { r2, text, line, svg, mk, arrow } = D.kit;

// ------------------------------------------------------------------ vectors and solids

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => mul(a, 1 / Math.hypot(a[0], a[1], a[2]));
const mul2 = (a, k) => [a[0] * k, a[1] * k];
const world = (x, y, z) => [x, -y, z];   // model (x east, y south, z up) to east-north-up

// Every member is a convex solid of eight corners: four around one end, then the same four around the other. Its six faces get outward normals.
const FACES = [[0, 1, 2, 3], [7, 6, 5, 4], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
function solid(corners, tag, kind) {
  const c = corners.reduce((sum, p) => add(sum, p), [0, 0, 0]).map(v => v / 8);
  const faces = FACES.map(idx => {
    const p = idx.map(i => corners[i]);
    let n = cross(sub(p[1], p[0]), sub(p[3], p[0]));
    if (Math.hypot(...n) < 1e-9) return null;
    n = unit(n);
    let d = dot(n, p[0]);
    if (dot(n, c) > d) { n = mul(n, -1); d = -d; }
    return { idx, n, d };
  }).filter(Boolean);
  return { corners, c, faces, tag, kind };
}
const box = (x0, x1, y0, y1, z0, z1, tag, kind) => {
  const ring = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  return solid([...ring.map(([x, y]) => world(x, y, z0)), ...ring.map(([x, y]) => world(x, y, z1))], tag, kind);
};
// A member whose end faces are the four [y, z] corners in `section`, running from x0 to x1.
const extrude = (section, x0, x1, tag, kind) => solid([...section.map(([y, z]) => world(x0, y, z)), ...section.map(([y, z]) => world(x1, y, z))], tag, kind);
// A straight square member from model point a to model point b.
function strut(a, b, size, tag, kind) {
  const A = world(...a), B = world(...b), d = unit(sub(B, A));
  const u = unit(cross(d, [0, 0, 1])), v = cross(u, d), h = size / 2;
  const ring = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([s, t]) => add(mul(u, s * h), mul(v, t * h)));
  return solid([...ring.map(r => add(A, r)), ...ring.map(r => add(B, r))], tag, kind);
}

// ------------------------------------------------------------------ the members

const meet = (p, d, q, e) => {   // where the line from p along d crosses the line from q along e, in [y, z]
  const s = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / (d[0] * e[1] - d[1] * e[0]);
  return [p[0] + s * d[0], p[1] + s * d[1]];
};

// The truss outline: the top edge of the top chords, raised a quarter foot over the eave line so the tails clear the post tops (as in Detail 5), and the line under
// the chords. Both are [y, z] points from the north eave to the south eave.
function trussShape(m) {
  const lift = 0.25, t = m.wall.post / 12, W = m.width;
  const t1 = [0, m.eave + lift], t2 = [m.knuckleRun, m.knuckleZ], t3 = [m.half, m.peakZ], t4 = [W - m.knuckleRun, m.knuckleZ], t5 = [W, m.eave + lift];
  const dir = (a, b) => { const h = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / h, (b[1] - a[1]) / h]; };
  const tail = dir(t1, t2), t0 = [t1[0] - tail[0] * m.eaveTail, t1[1] - tail[1] * m.eaveTail], t6 = [t5[0] + tail[0] * m.eaveTail, t5[1] - tail[1] * m.eaveTail];
  const outer = [t0, t2, t3, t4, t6];
  const dirs = outer.slice(1).map((p, i) => dir(outer[i], p)), normals = dirs.map(d => [-d[1], d[0]]);
  const base = outer.slice(0, 4).map((p, i) => [p[0] - normals[i][0] * t, p[1] - normals[i][1] * t]);
  const inner = [base[0], meet(base[0], dirs[0], base[1], dirs[1]), meet(base[1], dirs[1], base[2], dirs[2]), meet(base[2], dirs[2], base[3], dirs[3]),
    [t6[0] - normals[3][0] * t, t6[1] - normals[3][1] * t]];
  const under = y => {   // the height of the underside of the roof framing at y
    for (let i = 1; i < inner.length; i++) if (y <= inner[i][0] + 1e-9) { const [a, b] = [inner[i - 1], inner[i]]; return a[1] + (b[1] - a[1]) * (y - a[0]) / (b[0] - a[0]); }
    return inner[inner.length - 1][1];
  };
  return { t1, t2, t3, t4, t5, outer, dirs, normals, inner, under, quads: [0, 1, 2, 3].map(i => [outer[i], outer[i + 1], inner[i + 1], inner[i]]) };
}

// The pieces of a vertical stud from z0 to z1 that are left after the openings (each [y0, y1, z0, z1]) are cut out of it.
function studPieces(y, z0, z1, openings) {
  let pieces = [[z0, z1]];
  openings.filter(([a, b]) => y > a && y < b).forEach(([, , lo, hi]) => {
    pieces = pieces.flatMap(([p, q]) => (hi <= p || lo >= q) ? [[p, q]] : [[p, Math.min(q, lo)], [Math.max(p, hi), q]].filter(([u, v]) => v - u > 1e-9));
  });
  return pieces.filter(([p, q]) => q - p > 0.3);
}

// All the members of the framing, each a solid with a tag (what it is) and a kind (its material, which sets its color).
function framingParts(m) {
  const L = m.length, W = m.width, pad = -m.padToFloor, half = m.wall.post / 24, pw = 4.5 / 12, g = m.girts.thick / 12, face = m.girts.face / 12, layer = half + g;
  const parts = [], bx = (...args) => parts.push(box(...args));
  const top = m.eave - 7.5 / 12, foot = pad + 0.3, carrierZ0 = m.underLoft - 9.25 / 12, chordTop = m.eave - m.decking / 12, shape = trussShape(m), lo = m.loftOpening;
  // the floor stack and the apron
  bx(0.35, L - 0.35, 0.35, W - 0.35, pad, 0, 'slab', 'c');
  bx(L + 0.35, L + m.apron.depth, m.doorY0, m.doorY1, pad, pad + 0.42, 'apron', 'c');
  // posts: the sidewall posts run to the truss carriers, the gable posts to the gable trusses
  m.postX.forEach(x => { bx(x - pw / 2, x + pw / 2, -half, half, foot, top, 'post', 'p'); bx(x - pw / 2, x + pw / 2, W - half, W + half, foot, top, 'post', 'p'); });
  m.gableY.forEach(y => bx(-half, half, y - pw / 2, y + pw / 2, foot, m.underLoft, 'post', 'p'));
  [m.doorY0, m.doorY1].forEach(y => bx(L - half, L + half, y - pw / 2, y + pw / 2, foot, m.underLoft, 'post', 'p'));
  // girts on the outside face of the posts: the sidewalls wrap the corners, the end walls butt the sidewall girts
  Object.entries(m.girts.walls).forEach(([key, wall]) => wall.rows.forEach(r => {
    const row = m.girts.rows[r.row], kind = row.role === 'base' ? 't' : 'g';
    r.boards.forEach(board => board.pieces.forEach(p => {
      if (key === 'N' || key === 'S') {
        const a = p.a < 1e-9 ? -layer : p.a, b = p.b > L - 1e-9 ? L + layer : p.b;
        bx(a, b, key === 'N' ? -layer : W + half, key === 'N' ? -half : W + layer, row.bottom, row.top, 'girt', kind);
      } else {
        const a = p.a < 1e-9 ? -half : p.a, b = p.b > W - 1e-9 ? W + half : p.b;
        bx(key === 'W' ? -layer : L + half, key === 'W' ? -half : L + layer, a, b, row.bottom, row.top, 'girt', kind);
      }
    }));
  }));
  // the openings in the sidewalls: sills and jack studs at the windows, jacks and an LVL header at the walk door
  ['N', 'S'].forEach(key => m.girts.walls[key].openings.forEach(op => {
    const y0 = key === 'N' ? -layer : W + half, y1 = key === 'N' ? -half : W + layer;
    if (op.kind === 'window') {
      bx(op.a - g, op.b + g, y0, y1, op.z0 - face, op.z0, 'sill', 'g');
      bx(op.a - g, op.a, y0, y1, op.z0, op.z1, 'jack', 'g'); bx(op.b, op.b + g, y0, y1, op.z0, op.z1, 'jack', 'g');
      const inset = key === 'N' ? [-half - 0.06, -half - 0.02] : [W + half + 0.02, W + half + 0.06];
      bx(op.a, op.b, inset[0], inset[1], op.z0, op.z1, 'window', 'w');
    } else if (op.kind === 'walk door') {
      bx(op.a - g, op.a, y0, y1, op.z0, op.z1, 'jack', 'g'); bx(op.b, op.b + g, y0, y1, op.z0, op.z1, 'jack', 'g');
      bx(op.a - g, op.b + g, y0, y1, op.z1, op.z1 + 9.25 / 12, 'header', 'l');
    }
  }));
  // the splash board, a treated 2×10 along the foot of each wall, left out at the doors
  const splash = m.girts.splashInches / 12, walk = m.girts.walls.S.openings.find(o => o.kind === 'walk door');
  bx(-layer, L + layer, -layer, -half, pad, pad + splash, 'splash', 't');
  bx(-layer, walk.a - g, W + half, W + layer, pad, pad + splash, 'splash', 't'); bx(walk.b + g, L + layer, W + half, W + layer, pad, pad + splash, 'splash', 't');
  bx(-layer, -half, -half, W + half, pad, pad + splash, 'splash', 't');
  bx(L + half, L + layer, -half, m.doorY0, pad, pad + splash, 'splash', 't'); bx(L + half, L + layer, m.doorY1, W + half, pad, pad + splash, 'splash', 't');
  // the east gable: the LVL header over the main door, and the loft doors' header and jacks
  bx(L + half, L + half + 0.25, m.doorY0, m.doorY1, m.mainDoor.height, m.underLoft, 'header', 'l');
  const doorTop = m.eave + m.loftDoor.height, headTop = doorTop + 0.8;
  bx(L + half, L + half + 0.25, m.loftDoorY0 - g, m.loftDoorY1 + g, doorTop, headTop, 'header', 'l');
  bx(L + half, L + layer, m.loftDoorY0 - g, m.loftDoorY0, m.eave, doorTop, 'jack', 'g'); bx(L + half, L + layer, m.loftDoorY1, m.loftDoorY1 + g, m.eave, doorTop, 'jack', 'g');
  // the LVL truss carriers on the inside face of the sidewall posts, in 16 ft pieces
  for (let x = 0; x < L - 1e-9; x += m.girts.board) {
    const x1 = Math.min(x + m.girts.board, L);
    bx(x + 0.02, x1 - 0.02, half, half + 5.25 / 12, carrierZ0, m.underLoft, 'carrier', 'l');
    bx(x + 0.02, x1 - 0.02, W - half - 5.25 / 12, W - half, carrierZ0, m.underLoft, 'carrier', 'l');
  }
  // the trusses: the bottom chord is the loft joist (cut around the stair opening), and four top chords with mitered ends
  const tw = 1.5 / 24;
  m.trussX.forEach(x => {
    const cut = x > 0.1 && x < lo.width - 0.1;
    if (cut) { bx(x - tw, x + tw, half, lo.fromNorth, m.underLoft, chordTop, 'truss-bottom', 'r'); bx(x - tw, x + tw, lo.fromNorth + lo.length, W - half, m.underLoft, chordTop, 'truss-bottom', 'r'); }
    else bx(x - tw, x + tw, half, W - half, m.underLoft, chordTop, 'truss-bottom', 'r');
    shape.quads.forEach(q => parts.push(extrude(q, x - tw, x + tw, 'truss-top', 'r')));
  });
  // the solid-faced gable trusses carry studs at 2 ft, cut around the loft doors and the beam on the east, and the loft window on the west
  const loftWindow = m.windows.find(w => w.wall === 'W');
  const gables = [
    [0, loftWindow ? [[loftWindow.at - loftWindow.width / 2 - 0.15, loftWindow.at + loftWindow.width / 2 + 0.15, loftWindow.sill, loftWindow.sill + loftWindow.height]] : []],
    [L, [[m.loftDoorY0 - 0.3, m.loftDoorY1 + 0.3, m.eave, headTop], [m.half - 0.6, m.half + 0.6, m.hoistZ - 0.7, m.hoistZ + 0.7]]]
  ];
  gables.forEach(([gx, openings]) => {
    for (let y = 2; y < W - 1e-9; y += 2) studPieces(y, chordTop, shape.under(y) - 0.02, openings).forEach(([z0, z1]) => bx(gx - tw, gx + tw, y - 0.145, y + 0.145, z0, z1, 'stud', 'r'));
  });
  if (loftWindow) bx(-0.03, 0.03, loftWindow.at - loftWindow.width / 2, loftWindow.at + loftWindow.width / 2, loftWindow.sill, loftWindow.sill + loftWindow.height, 'window', 'w');
  // purlins: 2×6 flat on the top chords, five rows on each of the four slopes, measured up from the eave or the knuckle, running past the gables by the rake
  const rows = { lower: [0.6, 2.75, 4.9, 7.05, 9.2], upper: [0.5, 2.55, 4.6, 6.65, 8.7] }, pw6 = m.girts.face / 12, pt = m.girts.thick / 12;
  const slopes = [[shape.t1, shape.dirs[0], shape.normals[0], 'lower'], [shape.t2, shape.dirs[1], shape.normals[1], 'upper'],
    [shape.t4, mul2(shape.dirs[2], -1), shape.normals[2], 'upper'], [shape.t5, mul2(shape.dirs[3], -1), shape.normals[3], 'lower']];
  slopes.forEach(([from, d, n, row]) => rows[row].forEach(s => {
    const c = [from[0] + d[0] * s, from[1] + d[1] * s], a = [c[0] - d[0] * pw6 / 2, c[1] - d[1] * pw6 / 2], b = [c[0] + d[0] * pw6 / 2, c[1] + d[1] * pw6 / 2];
    parts.push(extrude([a, b, [b[0] + n[0] * pt, b[1] + n[1] * pt], [a[0] + n[0] * pt, a[1] + n[1] * pt]], -m.rakeOverhang, L + m.rakeOverhang, 'purlin', 'u'));
  }));
  // the landing deck: free-standing on four posts, doubled beams, joists at 12 in, a rail, and knee braces; its decking is left off to show the frame
  const joistZ1 = m.eave - 1 / 12, beamZ1 = joistZ1 - 9.25 / 12, beamZ0 = beamZ1 - 9.25 / 12, rail = m.eave + m.deck.rail;
  m.deckPosts.forEach(([x, y]) => bx(x - 0.25, x + 0.25, y - 0.25, y + 0.25, pad, beamZ0, 'deck-post', 't'));
  [m.deckY0, m.deckY1].forEach(y => bx(m.deckX0, m.deckX1, y - 0.125, y + 0.125, beamZ0, beamZ1, 'deck-beam', 'd'));
  for (let x = m.deckX0; x < m.deckX1 + 1e-9; x += m.deck.joistSpacing) bx(x - 0.0625, x + 0.0625, m.deckY0 - 0.125, m.deckY1 + 0.125, beamZ1, joistZ1, 'deck-joist', 'd');
  m.deckPosts.forEach(([x, y]) => {
    const toward = x < (m.deckX0 + m.deckX1) / 2 ? 1 : -1;
    parts.push(strut([x, y, beamZ0 - 4], [x + toward * 4, y, beamZ0], 0.12, 'deck-knee', 'd'));
  });
  const railX = [m.deckX0, m.deckX0 + m.deck.depth / 2, m.deckX1 - 0.15];
  [m.deckY0 + 0.15, m.deckY1 - 0.15].forEach(y => railX.forEach(x => bx(x - 0.145, x + 0.145, y - 0.145, y + 0.145, joistZ1, rail, 'rail-post', 't')));
  [(m.deckY0 + m.deckY1) / 2].forEach(y => bx(m.deckX1 - 0.3, m.deckX1, y - 0.145, y + 0.145, joistZ1, rail, 'rail-post', 't'));
  [rail - 0.2, rail - 1.6].forEach(z => {
    [m.deckY0 + 0.15, m.deckY1 - 0.15].forEach(y => bx(m.deckX0, m.deckX1 - 0.15, y - 0.06, y + 0.06, z, z + 0.15, 'rail', 't'));
    bx(m.deckX1 - 0.21, m.deckX1 - 0.09, m.deckY0 + 0.15, m.deckY1 - 0.15, z, z + 0.15, 'rail', 't');
  });
  // the hoist: the beam through the east gable, a plate on its tip and one on the inner end, two braces to the deck's corners, and the trolley, chain, and hook
  const bz0 = m.hoistZ - 0.25, bz1 = m.hoistZ + 0.25, tipX = L + m.hoist.out, hy = m.half, hookX = m.hoistHookX;
  bx(L - m.hoist.inside, tipX, hy - 0.25, hy + 0.25, bz0, bz1, 'hoist-beam', 's');
  bx(tipX, tipX + 0.04, hy - 0.3, hy + 0.3, bz0 - 0.55, bz1 + 0.2, 'hoist-plate', 's');
  bx(L - m.hoist.inside - 0.12, L - m.hoist.inside, hy - 0.4, hy + 0.4, bz0 - 1.2, bz1 + 1.2, 'hoist-plate', 's');
  m.hoistBraces.forEach(b => {
    const d = unit(sub(world(...b.tip), world(...b.foot))), back = mul(d, 0.3);
    parts.push(strut(b.foot, [b.tip[0] - back[0], b.tip[1] + back[1], b.tip[2] - back[2]], 0.5, 'hoist-brace', 't'));
  });
  bx(hookX - 0.3, hookX + 0.3, hy - 0.3, hy + 0.3, bz0 - 0.4, bz0, 'trolley', 's');
  bx(hookX - 0.03, hookX + 0.03, hy - 0.03, hy + 0.03, bz0 - 2.2, bz0 - 0.4, 'chain', 's');
  bx(hookX - 0.12, hookX + 0.12, hy - 0.12, hy + 0.12, bz0 - 2.7, bz0 - 2.2, 'hook', 's');
  return parts;
}

// ------------------------------------------------------------------ the view

const EPS = 1e-6;
// Whether member a must be drawn before b (-1) or after it (+1) from the camera, judged by a face plane that separates them; 0 when none does (they touch or cross).
function between(a, b, cam) {
  for (const f of a.faces) if (b.corners.every(p => dot(f.n, p) >= f.d - EPS)) return dot(f.n, cam) > f.d ? -1 : 1;
  for (const f of b.faces) if (a.corners.every(p => dot(f.n, p) >= f.d - EPS)) return dot(f.n, cam) > f.d ? 1 : -1;
  return 0;
}

// The camera looks at `target` from `distance` feet away, `az` degrees from south toward east, `el` degrees above the horizon.
function camera(view) {
  const az = view.az * Math.PI / 180, el = view.el * Math.PI / 180;
  const target = world(...view.target), aim = [Math.sin(az) * Math.cos(el), -Math.cos(az) * Math.cos(el), Math.sin(el)];
  const eye = add(target, mul(aim, view.distance)), fwd = unit(sub(target, eye)), right = unit(cross(fwd, [0, 0, 1])), up = cross(right, fwd);
  const project = p => { const v = sub(p, eye), z = dot(v, fwd); return [dot(v, right) / z, -dot(v, up) / z]; };
  return { eye, fwd, right, up, project };
}

// The outline a member makes on the page: the convex hull of its projected corners.
function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]), turn = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const build = list => { const h = []; list.forEach(q => { while (h.length > 1 && turn(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop(); h.push(q); }); h.pop(); return h; };
  return [...build(p), ...build(p.reverse())];
}
// Whether two outlines share some area (touching along an edge does not count).
function overlap(a, b) {
  for (const poly of [a, b]) for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], n = [q[1] - p[1], p[0] - q[0]], len = Math.hypot(n[0], n[1]);
    if (len < 1e-12) continue;
    const span = pts => { const v = pts.map(r => (r[0] * n[0] + r[1] * n[1]) / len); return [Math.min(...v), Math.max(...v)]; };
    const [a0, a1] = span(a), [b0, b1] = span(b);
    if (a1 <= b0 + 1e-7 || b1 <= a0 + 1e-7) return false;
  }
  return true;
}

// Sort the members back to front, and draw the faces that look toward the camera.
function layout(parts, cam) {
  const n = parts.length, screen = parts.map(s => s.corners.map(cam.project)), outline = screen.map(hull);
  const box2 = screen.map(pts => [Math.min(...pts.map(p => p[0])), Math.max(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[1]))]);
  const after = Array.from({ length: n }, () => []), waiting = new Array(n).fill(0);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = box2[i], b = box2[j];
    if (a[1] < b[0] || b[1] < a[0] || a[3] < b[2] || b[3] < a[2] || !overlap(outline[i], outline[j])) continue;
    const r = between(parts[i], parts[j], cam.eye);
    if (r < 0) { after[i].push(j); waiting[j]++; } else if (r > 0) { after[j].push(i); waiting[i]++; }
  }
  const far = parts.map(s => Math.hypot(...sub(s.c, cam.eye)));
  const order = [], left = new Set(parts.keys());
  let forced = 0;
  while (left.size) {
    let pick = -1, best = -Infinity;
    for (const i of left) if (waiting[i] === 0 && far[i] > best) { best = far[i]; pick = i; }
    if (pick < 0) {   // members that hide each other in a ring: take the one with the fewest still waiting on it
      forced++;
      let fewest = Infinity;
      for (const i of left) if (waiting[i] < fewest || (waiting[i] === fewest && far[i] > far[pick])) { fewest = waiting[i]; pick = i; }
    }
    order.push(pick); left.delete(pick);
    after[pick].forEach(j => waiting[j]--);
  }
  return { order, screen, forced };
}

// Lighting, as a direction toward the light fixed to the view: from the top, the left, and the viewer, so the faces turned to each side read differently.
const TONES = [0.4, 0.55, 0.72, 0.88];
function lighting(cam) {
  const toward = unit([-cam.fwd[0], -cam.fwd[1], 0]);
  return unit(add(add(mul(toward, 0.4), mul(cam.right, -0.45)), [0, 0, 0.8]));
}
const toneOf = shade => TONES.filter(t => shade >= t).length;

const VIEWS = {
  southeast: { az: 38, el: 23, distance: 230, target: [29, 16, 9], title: 'FRAMING IN PERSPECTIVE, FROM THE SOUTHEAST', sub: 'the south wall and the east gable, with the deck and the hoist' },
  northwest: { az: 212, el: 23, distance: 230, target: [24, 16, 9], title: 'FRAMING IN PERSPECTIVE, FROM THE NORTHWEST', sub: 'the north wall and the west gable, with the loft window' }
};

function figure(m, name) {
  const view = VIEWS[name], parts = framingParts(m), cam = camera(view), { order, screen, forced } = layout(parts, cam);
  const light = lighting(cam), w = 960, margin = 34;
  // fit the members to the page, with room above for the title and below for the key
  const xs = screen.flatMap(pts => pts.map(p => p[0])), ys = screen.flatMap(pts => pts.map(p => p[1]));
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), k = (w - 2 * margin) / (x1 - x0), top = 86;
  const P = p => { const q = cam.project(p); return [margin + (q[0] - x0) * k, top + (q[1] - y0) * k]; };
  const height = Math.ceil(top + (y1 - y0) * k + 74);
  const at = (x, y, z) => P(world(x, y, z));
  // the ground and the pad, drawn first
  const flat = (xa, xb, ya, yb, z, cls) => `<polygon class="${cls}" points="${[[xa, ya], [xb, ya], [xb, yb], [xa, yb]].map(([x, y]) => at(x, y, z).map(r2).join(',')).join(' ')}"/>`;
  const pad = -m.padToFloor, ground = [flat(-16, m.length + 24, -18, m.width + 16, pad, 'z3-ground'), flat(-m.padMarginX, m.length + m.padMarginX, -m.padMarginY, m.width + m.padMarginY, pad, 'z3-pad')];
  // the members, back to front
  const faces = [];
  order.forEach(i => {
    const s = parts[i];
    s.faces.forEach(f => {
      if (dot(f.n, cam.eye) <= f.d + 1e-9) return;
      const shade = 0.28 + 0.72 * Math.max(0, dot(f.n, light));
      faces.push(`<polygon class="z${s.kind}${toneOf(shade)}" points="${f.idx.map(j => screen[i][j]).map(([px, py]) => `${r2(margin + (px - x0) * k)},${r2(top + (py - y0) * k)}`).join(' ')}"/>`);
    });
  });
  const o = [text(w / 2, 24, view.title, 't-title t-m'), text(w / 2, 42, view.sub, 't-s t-m t-i'), ...ground, `<g class="z3d">${faces.join('')}</g>`];
  o.push(...annotate(m, name, at, height));
  // north, drawn along the ground direction it points on the page
  const n0 = cam.project(world(0, 0, 0)), n1 = cam.project(world(0, -10, 0)), dx = n1[0] - n0[0], dy = n1[1] - n0[1], len = Math.hypot(dx, dy), cx = w - 60, cy = height - 36;
  o.push(arrow(cx, cy, cx + dx / len * 24, cy + dy / len * 24 * 0.5), text(cx + dx / len * 34, cy + dy / len * 17 + 3, 'N', 't-s t-b t-m'));
  return { svg: svg(w, height, o, `The framing in perspective, ${view.sub}`), members: parts.length, polygons: faces.length, forced };
}

// ------------------------------------------------------------------ the markers

// Markers use the numbers of the build legend on the plans page; a few short labels name the members that have none.
function annotate(m, name, at, height) {
  const W = m.width, half = m.wall.post / 24, layer = half + m.girts.thick / 12, pad = -m.padToFloor, o = [], shape = trussShape(m);
  const marker = (p, label) => mk(...at(...p), label);
  // the text sits at (tx, ty) and the leader runs from the member to the near end of the text
  const note = (p, tx, ty, label, end) => {
    const [px, py] = at(...p), reach = label.length * 4.9 + 6;
    return line(px, py, end ? tx - reach : tx + reach, ty - 3, 'l-dim') + text(tx, ty, label, 't-s t-b halo' + (end ? ' t-e' : ''));
  };
  // a point just outside the roof framing, `s` feet up a slope from its start; i is the slope, and sign -1 measures from the far end
  const roof = (x, i, from, sign, s) => [x, from[0] + sign * shape.dirs[i][0] * s + shape.normals[i][0] * 0.2, from[1] + sign * shape.dirs[i][1] * s + shape.normals[i][1] * 0.2];
  const walk = m.girts.walls.S.openings.find(op => op.kind === 'walk door'), south = m.windows.filter(x => x.wall === 'S'), north = m.windows.filter(x => x.wall === 'N'), loft = m.windows.find(x => x.wall === 'W');
  if (name === 'southeast') {
    const b = m.hoistBraces[0], [ax, ay] = at(m.length + 12, m.width / 2 + 2, pad + 0.42);
    o.push(marker([m.postX[3], W + layer, 3.2], '1'), marker([m.postX[1] + 3, W + layer, 8.23], '16'), marker([(walk.a + walk.b) / 2, W + layer, 3.5], '3'),
      marker([m.length + layer, m.half, 6], '2'), marker([m.length + layer, m.half, m.eave + 3], '9'), marker([(m.deckX0 + m.deckX1) / 2, m.deckY1, 13.6], '10'),
      marker([m.length + 5, m.half, m.hoistZ + 0.3], '11'), marker([(b.foot[0] + b.tip[0]) / 2, (b.foot[1] + b.tip[1]) / 2, (b.foot[2] + b.tip[2]) / 2], '17'));
    if (south[1]) o.push(marker([south[1].at, W + layer, south[1].sill + south[1].height / 2], '15'));
    o.push(note(roof(6, 3, shape.t5, -1, 4.9), 24, 98, 'purlins, 2×6 laid flat'), note([4, shape.t4[0], shape.t4[1] + 0.05], 24, 122, 'trusses at 2′ OC'),
      note([8, W + layer, pad + 0.4], 24, height - 110, 'PT base girt and splash board'), text(ax, ay + 3, 'concrete apron', 't-s t-m t-i'));
  } else {
    o.push(marker([m.postX[3], -layer, 3.2], '1'), marker([m.postX[2] - 4, -layer, 8.23], '16'), marker([-layer, m.gableY[1], 3.2], '1'));
    if (north[1]) o.push(marker([north[1].at, -layer, north[1].sill + north[1].height / 2], '15'));
    if (loft) o.push(marker([0, loft.at, loft.sill + loft.height / 2], '15'));
    o.push(note(roof(3, 0, shape.t1, 1, 4.9), 936, 98, 'purlins, 2×6 laid flat', true), note([6, shape.t2[0], shape.t2[1] + 0.05], 936, 122, 'trusses at 2′ OC', true),
      note([4, -layer, pad + 0.4], 936, height - 110, 'PT base girt and splash board', true));
  }
  return o;
}

// Counts for the tests: how many members of each tag, how many polygons, and how many times the sort had to break a ring.
function framingCheck(m, name) {
  const parts = framingParts(m), counts = {};
  parts.forEach(s => { counts[s.tag] = (counts[s.tag] || 0) + 1; });
  const out = figure(m, name);
  return { counts, members: out.members, polygons: out.polygons, forced: out.forced, bytes: out.svg.length };
}

root.WorkshopDraw = Object.assign(root.WorkshopDraw, {
  framing3dSoutheast: m => figure(m, 'southeast').svg,
  framing3dNorthwest: m => figure(m, 'northwest').svg,
  framing3dCheck: framingCheck,
  framing3dParts: framingParts
});
})(typeof window !== 'undefined' ? window : globalThis);
