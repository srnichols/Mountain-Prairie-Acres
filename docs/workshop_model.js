// The workshop pole barn design: the dimensions, the geometry and quantities that follow from them, and the cost estimate.
// Every workshop page and drawing reads this one model, so a change such as the length is made here once (and in data/site.json, which
// tools/test_workshop_model.js checks it against, with data/site_baselines.json).
// Units: feet, square feet, and cubic yards unless a name says otherwise. Plan coordinates: x runs east from the west wall, y runs south from the
// north wall, and z is the height above the slab.
(function (root) {
'use strict';

const DESIGN = Object.freeze({
  width: 32,                 // north-south, wall to wall: the truss span
  length: 48,                // east-west, gable to gable: six 8 ft bays
  eave: 14,                  // top of the sidewalls, and the loft floor: the most Elmore County allows a side wall without an engineer, and what a 12 ft door and its track need
  knuckleRun: 7,             // gambrel lower slope: 7 ft in from each sidewall...
  knuckleRise: 8,            // ...and 8 ft up
  upperRise: 2.5,            // upper slope: 2½ ft up over the remaining 9 ft to the ridge (3⅓ in 12), which keeps the roof under the county's 27 ft peak limit
  roofBuild: 0.75,           // the purlins, deck, steel, and vented ridge cap stand about 9 in above the top of the trusses at the ridge
  bayMax: 8,                 // longest post spacing on the sidewalls
  trussSpacing: 2,
  eaveTail: 1,               // truss tail beyond the wall, measured along the slope
  rakeOverhang: 1,           // roof beyond each gable
  mainDoor: Object.freeze({ width: 14, height: 12 }),                // 12 ft clears the camper's roof by 13 in; 14 ft leaves 3 ft each side of its 8 ft width for backing a trailer in
  walkDoor: Object.freeze({ width: 3, height: 7, fromEast: 3 }),     // on the south wall; fromEast is its center's distance from the east wall
  loftDoor: Object.freeze({ width: 5, height: 6 }),                  // on the east gable, bottom at the loft floor
  // Windows: sliders in the sidewalls, centered in the listed bays (counted from the west end, 1 is the west end bay), and one single-hung in the
  // west gable at the loft. The south wall skips the first two bays (the stair is behind them) and the last (the walk door). Use null for none.
  // The bay numbers go with the six-bay layout of a 42 to 48 ft building: for another length, list bays that exist and are at least a foot wider than the window.
  windowSpec: Object.freeze({
    side: Object.freeze({ width: 4, height: 3, sill: 5, northBays: Object.freeze([2, 4, 6]), southBays: Object.freeze([3, 4, 5]) }),
    loft: Object.freeze({ width: 3, height: 4, sill: 3 })            // sill measured up from the loft floor
  }),
  // The deck stands free of the wall: `gap` is how far its inner edge is out from the wall's center line (about an inch clear of the siding). Its posts stand on the
  // door-jamb lines, `postInset` in from the deck's ends.
  deck: Object.freeze({ width: 14, depth: 10, rail: 3.5, posts: 4, joistSpacing: 1, postInset: 0.5, gap: 0.5 }),
  apron: Object.freeze({ width: 14, depth: 15 }),                    // the estimate uses 15 ft; the plan shows 10 to 20
  // The hoist: a W6 beam through the east gable. It reaches beyondDeck past the deck's outer edge, so a load is lifted from the ground clear of the deck and carried in
  // over the rail; it runs `inside` into the loft, and its centerline is `above` the loft floor. The hook hangs `hook` in from the tip, where the trolley stops.
  // Two raking struts from the outer corners of the deck meet at the tip.
  hoist: Object.freeze({ beyondDeck: 2, inside: 9, above: 9, hook: 0.75 }),
  stair: Object.freeze({ width: 4, landing: 4, riser: 7, tread: 11, headroom: 80 }),   // feet, except the riser, tread, and headroom (inches); the flights and the loft opening follow from the loft floor height
  rv: Object.freeze({ width: 8, length: 25 + 11 / 12, height: 10 + 11 / 12 }),         // the camper, a 2024 Forest River Rockwood Mini Lite 2517S: the manufacturer's listed exterior size
  pad: Object.freeze({ length: 56, width: 42 }),   // the graded pad that is already built (workshop_pad in data/site.json); the building is centered on it
  fill: Object.freeze({ north: 1.9, south: 0.75 }),   // imported fill on the pad, from the owner: almost 2 ft at the north edge, 6 in to 1 ft at the south edge
  slabInches: 5,
  pier: Object.freeze({ tubeInches: 18, padInches: 30, padThickInches: 12, depthInches: 60 }),
  wall: Object.freeze({ furring: 0.75, sheathing: 0.5, post: 7.25 }),   // the wall layers, in inches, outside to inside: steel, furring, sheathing, girt (below), post
  // The girts: 2×6s laid flat on the outside face of the posts and screwed to them, so each is 5½ in tall and 1½ in thick. Rows are 2 ft apart, 24 in OC, from the
  // floor line up; the lowest is pressure-treated. The posts are 8 ft apart and a board is 16 ft, so every joint falls on a post; neighboring rows start with a board
  // of a different length to keep their joints on different posts. Beside the east door, where the runs are 9 ft, 18 ft boards are cut in half.
  girts: Object.freeze({ spacing: 2, face: 5.5, thick: 1.5, board: 16, endBoard: 18, firstRow: 0, splashInches: 9.25, screwsPerPost: 3, screwsPerEnd: 2 }),
  chordInches: 9.25,         // truss bottom chord depth used for the clearance under the loft (the truss designer sets the real one)
  topChordInches: 7.25,      // truss top chord depth used for the clear room under the roof: a 2×8 (the truss designer sets the real one)
  carrier: Object.freeze({ wide: 5.25, tall: 9.25 }),   // the truss carrier on the inside face of each post: (3) 1¾″ × 9¼″ LVL, in inches; the bottom chord bears on its top
  postTopBelowEave: 7.5,     // the post top stands this many inches under the loft floor line, below the truss heel
  heelBlock: 5.5,            // the heel block between the top and bottom chords at the bearing: a 2×6 on end, in inches
  decking: 0.75,             // loft floor, inches
  // The bracing the truss plant may add, in feet. `webAt` is where the vertical web in each knee zone stands, in from the wall line, with a kicker from its foot up to the pitch
  // break; `webWide` is the width of a web in inches (a 2×4 on its wide face); `plateKnee` and `plateRidge` are how far the plates reach along each chord from the knee and the
  // ridge; `kickerLeg` is the longest kicker we accept across the knee, measured along each chord from the inside of the pitch break. The collar tie is part of the design (the
  // owner's choice, to help the roof carry the snow): `tieAt` is the height of its underside above the loft floor, and `tieDeep` its depth in inches (a 2×6 is assumed: the truss
  // plant sizes it).
  bracing: Object.freeze({ webAt: 3.5, webWide: 3.5, plateKnee: 1.5, plateRidge: 1.25, kickerLeg: 2, tieAt: 8, tieDeep: 5.5 }),
  loads: Object.freeze({ groundSnow: 120, wind: 115, exposure: 'C', loftLive: 40, frostZoneInches: 30, footingInches: 60, seismicZone: 'C' })   // 120 psf: the county's snow zone for Prairie, and the load it required of a neighbor's building (owner, October 23, 2026)
});

// Elmore County's limits that bear on the size and height (Title 7, chapter 2, as published in October 2026; see the overview page).
const COUNTY = Object.freeze({
  accessoryHeight: 24,       // an accessory structure: the principal dwelling's height or this, whichever is greater (7-2-42 D)
  zoneHeight: 35,            // Ag, Rec, and RR/MU districts (table 7-2-27 A); an agricultural structure in the Ag district may go to 80 ft
  agStructureHeight: 80,
  frontYardSqFt: 1500,       // an accessory structure in the front yard: this or half the house's footprint, whichever is less (7-2-42 C)
  characterSqFt: 1500,       // from this size up, a residential-district front-yard accessory structure must portray the house's character (7-2-42 E)
  // The Pole Barn/Post and Beam Standards (approved July 19, 2021): the county's guide that lets a simple pole barn skip an engineer. It is for the 30 psf snow
  // zone only, so it does not apply at 120 psf, where a building is always engineered; its limits are the county's usual ones, kept here for reference.
  // Past 14 ft of side wall a barn needs engineering, and the peak may not pass 27 ft unless the Building Official accepts a stamped alternate design.
  poleBarn: Object.freeze({ wall: 14, peak: 27, maxWidth: 50, maxLength: 80, ratio: 5 / 3, poleSpacing: 10, doorWall: 8, snow: 30, wind: 115 })
});

const sum = list => list.reduce((total, value) => total + value, 0);
const n = value => Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 });
const money = value => '$' + n(value);
// Inches to the nearest quarter, as the drawings and the text write them: 9¼″.
const inches = value => {
  const quarters = Math.round(value * 4), whole = Math.floor(quarters / 4), part = ['', '¼', '½', '¾'][quarters % 4];
  return `${whole}${part}″`;
};
const feetInches = feet => {
  const whole = Math.floor(feet + 1e-9), inches = Math.round((feet - whole) * 12);
  return inches === 12 ? `${whole + 1}′-0″` : `${whole}′-${inches}″`;
};
// Feet and inches to the nearest quarter inch: 31′-4¾″.
const feetInchesQuarter = feet => {
  const quarters = Math.round(feet * 48), whole = Math.floor(quarters / 48);
  return `${whole}′-${inches((quarters - whole * 48) / 4)}`;
};

// Interior sidewall bays at the longest spacing, and whatever is left over split between the two end bays (46 ft is 7-8-8-8-8-7; 48 ft is all 8s).
function bayLayout(length, bayMax) {
  const bays = Math.max(2, Math.ceil(length / bayMax));
  const end = (length - bayMax * (bays - 2)) / 2;
  return [end, ...new Array(bays - 2).fill(bayMax), end];
}

// ------------------------------------------------------------------ the girts

// Boards along a run of posts, with every joint over a post. A row is either 'A', which starts with a board as long as the stock allows, or 'B', which starts
// with a board one bay long, so the joints of neighboring rows fall on different posts.
function girtBoards(posts, stagger, stock) {
  const boards = [];
  let i = 0, first = stagger === 'B';
  while (i < posts.length - 1) {
    let j = i + 1;
    if (!first) while (j + 1 < posts.length && posts[j + 1] - posts[i] <= stock + 1e-9) j++;
    boards.push({ a: posts[i], b: posts[j], length: posts[j] - posts[i] });
    first = false;
    i = j;
  }
  return boards;
}
// The runs of posts a row covers: it does not cross an opening that spans from one post to another (the east door).
function girtRuns(posts, gaps) {
  const runs = [];
  let run = [posts[0]];
  for (let i = 1; i < posts.length; i++) {
    if (gaps.some(([a, b]) => posts[i - 1] >= a - 1e-9 && posts[i] <= b + 1e-9)) { if (run.length > 1) runs.push(run); run = [posts[i]]; }
    else run.push(posts[i]);
  }
  if (run.length > 1) runs.push(run);
  return runs;
}
// What is left of a board after the notches (windows and the walk door, which sit between posts) are cut out of it.
function girtPieces(board, notches) {
  let pieces = [{ a: board.a, b: board.b }];
  notches.forEach(([na, nb]) => {
    pieces = pieces.flatMap(p => (nb <= p.a + 1e-9 || na >= p.b - 1e-9) ? [p]
      : [{ a: p.a, b: Math.min(p.b, na) }, { a: Math.max(p.a, nb), b: p.b }].filter(q => q.b - q.a > 1e-9));
  });
  return pieces;
}
// How many boards of one stock length the pieces are cut from, longest first.
function boardsFor(lengths, stock) {
  const bins = [];
  [...lengths].sort((x, y) => y - x).forEach(length => {
    if (length > stock + 1e-9) throw new Error(`A ${length} ft girt is longer than the ${stock} ft board`);
    const bin = bins.find(left => left.room >= length - 1e-9);
    if (bin) bin.room -= length; else bins.push({ room: stock - length });
  });
  return bins.length;
}

// The girt rows, the boards in each row on each wall, and what to buy. Rows are 2 ft apart from the floor line up: the lowest is the treated base girt, and the
// highest is 2 ft or less below the eave. Positions run along the wall: x from the west on the north and south walls, y from the north on the west and east walls.
// Heights are above the floor. `geo` carries the post positions, the openings, and the pad.
function girtLayout(d, geo) {
  const spec = d.girts, face = spec.face / 12, pad = -geo.padToFloor;
  const rows = [];
  for (let z = spec.firstRow; z <= d.eave - spec.spacing + 1e-9; z += spec.spacing) rows.push({ bottom: z, role: rows.length ? 'girt' : 'base' });
  rows.forEach((row, index) => Object.assign(row, { index, top: row.bottom + face, stagger: index % 2 ? 'B' : 'A' }));

  const sideWindows = wall => geo.windows.filter(w => w.wall === wall && !w.loft).map(w => ({ kind: 'window', a: w.at - w.width / 2, b: w.at + w.width / 2, z0: w.sill, z1: w.sill + w.height }));
  const walls = {
    N: { name: 'north', length: d.length, posts: geo.postX, openings: sideWindows('N') },
    S: { name: 'south', length: d.length, posts: geo.postX, openings: [{ kind: 'walk door', a: geo.walkX - d.walkDoor.width / 2, b: geo.walkX + d.walkDoor.width / 2, z0: pad, z1: d.walkDoor.height }, ...sideWindows('S')] },
    W: { name: 'west', length: d.width, posts: [0, ...geo.gableY, d.width], openings: [] },
    // The main door and its header fill the opening from the pad to the loft floor, so no row crosses it.
    E: { name: 'east', length: d.width, posts: [0, geo.doorY0, geo.doorY1, d.width], openings: [{ kind: 'main door', a: geo.doorY0, b: geo.doorY1, z0: pad, z1: d.eave }] }
  };
  const eastPiece = Math.max(geo.doorY0, d.width - geo.doorY1);
  const eastBoard = 2 * eastPiece <= spec.endBoard + 1e-9 ? spec.endBoard : spec.board;   // two pieces from one 18 ft board, if they fit
  let screws = 0;
  Object.values(walls).forEach(wall => {
    const onPost = at => wall.posts.some(p => Math.abs(p - at) < 1e-9);
    wall.openings.forEach(o => { o.rows = rows.filter(row => o.z0 < row.top - 1e-9 && o.z1 > row.bottom + 1e-9).map(row => row.index); o.betweenPosts = onPost(o.a) && onPost(o.b); });
    wall.rows = rows.map(row => {
      const crossing = wall.openings.filter(o => o.rows.includes(row.index));
      const gaps = crossing.filter(o => o.betweenPosts).map(o => [o.a, o.b]), notches = crossing.filter(o => !o.betweenPosts).map(o => [o.a, o.b]);
      const boards = girtRuns(wall.posts, gaps).flatMap(run => girtBoards(run, row.stagger, spec.board));
      boards.forEach(board => {
        board.pieces = girtPieces(board, notches);
        wall.posts.filter(p => p >= board.a - 1e-9 && p <= board.b + 1e-9).forEach(p => { screws += Math.abs(p - board.a) < 1e-9 || Math.abs(p - board.b) < 1e-9 ? spec.screwsPerEnd : spec.screwsPerPost; });
      });
      const joints = boards.slice(1).filter((board, i) => Math.abs(board.a - boards[i].b) < 1e-9).map(board => board.a);
      return { row: row.index, boards, joints };
    });
  });
  // What to buy: the sidewall and west boards, the east wall boards, and the treated base boards, each cut from stock of one length.
  const lengthsOf = (keys, pick) => keys.flatMap(key => walls[key].rows.filter(r => pick(rows[r.row])).flatMap(r => r.boards.map(board => board.length)));
  const above = row => row.role !== 'base', base = row => row.role === 'base';
  const eastApart = eastBoard !== spec.board;
  const buy = {
    side: boardsFor([...lengthsOf(['N', 'S', 'W'], above), ...(eastApart ? [] : lengthsOf(['E'], above))], spec.board),
    east: eastApart ? boardsFor(lengthsOf(['E'], above), eastBoard) : 0,
    base: boardsFor(lengthsOf(['N', 'S', 'W', 'E'], base), spec.board)
  };
  return { ...spec, rows, walls, eastBoard, eastPiece, buy, screws };
}

// ------------------------------------------------------------------ the truss

// The gambrel truss as it stands across the building: y runs south from the north wall line and z is the height above the main floor. `outline` is the top
// of the top chords from the north tail to the south tail. The `room` line is the underside of top chords `topChordInches` deep, the highest the underside of
// the roof framing can be, and the headroom the loft keeps is measured from the loft floor up to it. The truss plant sets the real chord size; each extra inch of
// depth costs about an inch of headroom, and more at the pitch break.
function trussGeometry(d, g) {
  const { W, half, knuckleZ, peakZ } = g;
  const depth = d.topChordInches / 12;
  const dir = (a, b) => { const h = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / h, (b[1] - a[1]) / h]; };
  const wall = [0, d.eave], knuckle = [d.knuckleRun, knuckleZ], ridge = [half, peakZ];
  const lowerDir = dir(wall, knuckle), upperDir = dir(knuckle, ridge);
  const tail = [-d.eaveTail * lowerDir[0], d.eave - d.eaveTail * lowerDir[1]];
  // a chord's underside is its top line moved down, square to the slope, by the chord depth
  const under = (p, v) => [p[0] + v[1] * depth, p[1] - v[0] * depth];
  const tailIn = under(tail, lowerDir), lowerIn = under(wall, lowerDir), upperIn = under(knuckle, upperDir);
  const lowerSlope = lowerDir[1] / lowerDir[0], upperSlope = upperDir[1] / upperDir[0];
  const lowerAt = y => lowerIn[1] + (y - lowerIn[0]) * lowerSlope, upperAt = y => upperIn[1] + (y - upperIn[0]) * upperSlope;
  // the two undersides cross at the room line's pitch break, a little in from the roof line's
  const kY = (upperIn[1] - lowerIn[1] + lowerIn[0] * lowerSlope - upperIn[0] * upperSlope) / (lowerSlope - upperSlope);
  const innerKnuckle = [kY, lowerAt(kY)], innerRidge = [half, upperAt(half)];
  const roomZ = y => { const toWall = Math.min(y, W - y); return toWall <= kY ? lowerAt(toWall) : upperAt(toWall); };
  const clearAt = y => Math.max(0, roomZ(y) - d.eave);
  // how far in from a wall the clear height reaches h, and how wide the loft is where it is at least h
  const clearFrom = h => (h <= innerKnuckle[1] - d.eave ? lowerIn[0] + (d.eave + h - lowerIn[1]) / lowerSlope : upperIn[0] + (d.eave + h - upperIn[1]) / upperSlope);
  const clearWidth = h => Math.max(0, W - 2 * clearFrom(h));
  const mirror = ([y, z]) => [W - y, z];
  // The bracing the plant may add (DESIGN.bracing). The knee zones take webs: a vertical web `webAt` in from the wall line, and a kicker from its foot up to the underside of the
  // lower chord, landing far enough short of the pitch-break line that its body stays outside the open room. Both end on the lower chord. The plates lie flat on the faces of the
  // chords at the knee and the ridge, so they take no headroom. The north half is given; the south half mirrors it.
  const br = d.bracing, floor = d.eave, webHalf = br.webWide / 24;
  const toward = (p, v, s) => [p[0] + v[0] * s, p[1] + v[1] * s];
  const shrunk = (pts, k) => { const c = [sum(pts.map(p => p[0])) / pts.length, sum(pts.map(p => p[1])) / pts.length]; return pts.map(p => [c[0] + (p[0] - c[0]) * k, c[1] + (p[1] - c[1]) * k]); };
  const kickerTilt = Math.atan2(lowerAt(d.knuckleRun) - floor, d.knuckleRun - br.webAt), kickerTop = d.knuckleRun - 1.1 * webHalf / Math.sin(kickerTilt);
  const webs = { wide: br.webWide / 12, vertical: [[br.webAt, floor], [br.webAt, lowerAt(br.webAt)]], kicker: [[br.webAt, floor], [kickerTop, lowerAt(kickerTop)]] };
  const plates = {
    knee: shrunk([toward(knuckle, lowerDir, -br.plateKnee), knuckle, toward(knuckle, upperDir, br.plateKnee), toward(innerKnuckle, upperDir, br.plateKnee), innerKnuckle, toward(innerKnuckle, lowerDir, -br.plateKnee)], 0.86),
    ridge: shrunk([toward(ridge, upperDir, -br.plateRidge), ridge, mirror(toward(ridge, upperDir, -br.plateRidge)), mirror(toward(innerRidge, upperDir, -br.plateRidge)), innerRidge, toward(innerRidge, upperDir, -br.plateRidge)], 0.86)
  };
  // The collar tie joins the two upper top chords, its underside `tieAt` above the loft floor. Its ends are cut to the slope of the chords, so its body is a little wider at the
  // bottom than at the top, and a plate lies across each end joint, on the tie and the chord. Under the tie the clear height is `tieAt`, over its `length`: the loft's tallest headroom.
  const tieZ = floor + br.tieAt, tieDeep = br.tieDeep / 12, tieFrom = clearFrom(br.tieAt), tieTopFrom = clearFrom(br.tieAt + tieDeep);
  const tieEnd = [[tieFrom + 0.25, tieZ + 0.04], [tieTopFrom, tieZ + 0.04], [tieTopFrom, tieZ + tieDeep + 0.12], [tieFrom + 0.25, tieZ + tieDeep + 0.12]];
  const tie = { z: tieZ, deep: tieDeep, from: tieFrom, length: clearWidth(br.tieAt), body: [[tieFrom, tieZ], [W - tieFrom, tieZ], [W - tieTopFrom, tieZ + tieDeep], [tieTopFrom, tieZ + tieDeep]], plates: [tieEnd, tieEnd.map(mirror)] };
  // What a kicker across the knee costs the open room: legs `leg` and `up` long along the undersides of the lower and upper chords, from the inside of the pitch break. The ceiling
  // there becomes the straight line between the leg ends. This gives its height above the loft floor at the pitch-break line and the width of the loft that keeps 7 ft of clear height.
  const haunch = (leg, up = leg) => {
    if (!(leg > 0 && up > 0)) return { a: innerKnuckle, b: innerKnuckle, edgeClear: clearAt(d.knuckleRun), clearFrom7: clearFrom(7), width7: clearWidth(7) };
    const a = toward(innerKnuckle, lowerDir, -leg), b = toward(innerKnuckle, upperDir, up), slope = (b[1] - a[1]) / (b[0] - a[0]);
    const reaches7 = floor + 7 >= a[1] && floor + 7 <= b[1], from7 = reaches7 ? a[0] + (floor + 7 - a[1]) / slope : clearFrom(7);
    return { a, b, edgeClear: a[1] + (d.knuckleRun - a[0]) * slope - floor, clearFrom7: from7, width7: W - 2 * from7 };
  };
  return {
    depth: d.topChordInches,
    outline: [tail, wall, knuckle, ridge, mirror(knuckle), mirror(wall), mirror(tail)],
    room: [[clearFrom(0), d.eave], innerKnuckle, innerRidge, mirror(innerKnuckle), [W - clearFrom(0), d.eave]],
    chords: [[tail, knuckle, innerKnuckle, tailIn], [knuckle, ridge, innerRidge, innerKnuckle], [ridge, mirror(knuckle), mirror(innerKnuckle), innerRidge],
      [mirror(knuckle), mirror(tail), mirror(tailIn), mirror(innerKnuckle)]],
    tailRun: -tail[0], tailDrop: d.eave - tail[1], innerKnuckle, innerRidge, lowerSlope, upperSlope,
    clearAt, clearWidth, clearFrom, webs, plates, tie, haunch
  };
}

// ------------------------------------------------------------------ the eave

// Where the wall meets the roof, in inches: x runs inward from the post's outside face, so the outside is negative, and z runs up from the loft floor line. Details 5 and 7 and
// the eave in perspective all draw from it. From the post outward the wall is the girt, the sheathing, the housewrap, the furring that makes the rainscreen cavity, and the steel.
// The steel stops under a vented closure strip that crosses the top of the cavity. The truss tail passes over the strip with a plumb cut at its end, for the sub-fascia, and
// a level cut under it, so the air leaves into the open under the overhang.
function eaveSection(d, g) {
  const girt = d.girts.thick, sheathing = d.wall.sheathing, wrap = 0.1, furring = d.wall.furring, steel = 0.25;   // the housewrap and the steel are drawn thicker than they are
  const sheathingOut = -(girt + sheathing), wrapOut = sheathingOut - wrap, furringOut = wrapOut - furring, steelOut = furringOut - steel;
  const ventBottom = -13, ventTop = -10;                                          // the closure strip is 3 in tall
  const dx = d.knuckleRun / g.lowerLen, dz = d.knuckleRise / g.lowerLen;           // direction of the lower slope
  const origin = [-1.4, 3];                                                       // the chord's top surface passes 3 in over the loft floor line, 1.4 in out from the post
  const depth = d.topChordInches, roof = { purlin: 1.5, deck: 0.625, membrane: 0.125, underlayment: 0.125, steel: 0.625 };   // the layers on the chord, 3 in in all
  const along = (t, o = 0) => [origin[0] + t * dx - o * dz, origin[1] + t * dz + o * dx];   // the point t in along the chord's top surface, moved o in square to the slope
  const lineZ = (x, o = 0) => origin[1] + (x - origin[0]) * dz / dx + o / dx;     // the height at x of the chord's top surface moved o in square to the slope
  const tail = along(-12.4);                                                      // the top corner at the tail's end
  const fasciaTop = lineZ(tail[0], roof.purlin), fascia = { x0: tail[0] - 1.5, x1: tail[0], z0: fasciaTop - 5.5, z1: fasciaTop };   // a 2×6 on edge, up to the roof deck
  const under = along(0, -depth);                                                 // a point on the chord's underside
  const levelX = under[0] + (fascia.z0 - under[1]) * dx / dz;                     // where the level cut under the tail meets the underside
  // The heel: the bottom chord ends at the post's inside face, and there the top chord's underside stands above the top of the chord. A block fills the gap, on the chord under the top
  // chord, with steel plates pressed over it on both faces (the section is cut through the middle of the truss, so the plates are behind the cut). The heel's height is the top of the
  // top chord above the loft floor at the bearing's outer edge.
  const post = d.wall.post, blockEnd = post + d.heelBlock, chordTop = -d.decking, underAt = x => lineZ(x, -depth);
  const plateIn = post + 0.4, plateOut = blockEnd - 0.4;                          // a plate must lie on wood, so it stays within the block's width where it spans the gap
  const heel = {
    block: [[post, chordTop], [blockEnd, chordTop], [blockEnd, underAt(blockEnd)], [post, underAt(post)]],
    plate: [[plateIn, -5.5], [plateOut, -5.5], [plateOut, underAt(plateOut) + 4], [plateIn, underAt(plateIn) + 4]],
    height: lineZ(post, 0), wide: d.heelBlock, post
  };
  return Object.freeze({ girt, sheathingOut, wrapOut, furringOut, steelOut, ventBottom, ventTop, dx, dz, heel, depth, roof, along, lineZ, tail, fascia, levelZ: fascia.z0, levelX });
}

function create(overrides = {}) {
  const d = { ...DESIGN, ...overrides };
  const W = d.width, L = d.length;
  const bays = d.bays || bayLayout(L, d.bayMax);
  if (Math.abs(sum(bays) - L) > 1e-9) throw new Error(`The bays ${bays.join('-')} must add up to the length ${L}`);
  if (bays.some(bay => bay > d.bayMax + 1e-9)) throw new Error(`No bay may be longer than ${d.bayMax} ft`);
  const half = W / 2;
  const upperRun = half - d.knuckleRun;
  const knuckleZ = d.eave + d.knuckleRise;
  const peakZ = knuckleZ + d.upperRise;
  const underLoft = d.eave - (d.chordInches + d.decking) / 12;   // clear height under the loft floor
  if (d.mainDoor.height + 1 > underLoft) throw new Error(`A ${d.mainDoor.height} ft door and a 1 ft header do not fit under a loft floor whose underside is ${underLoft.toFixed(2)} ft up`);
  const lowerLen = Math.hypot(d.knuckleRun, d.knuckleRise);
  const upperLen = Math.hypot(upperRun, d.upperRise);
  const truss = trussGeometry(d, { W, half, knuckleZ, peakZ });

  const postX = bays.reduce((list, bay) => [...list, list[list.length - 1] + bay], [0]);
  const gableY = [];
  for (let y = 8; y < W - 1e-9; y += 8) gableY.push(y);
  const doorY0 = (W - d.mainDoor.width) / 2, doorY1 = (W + d.mainDoor.width) / 2;
  const pierCount = 2 * postX.length + gableY.length + 2;

  const trussCount = Math.floor(L / d.trussSpacing + 1e-9) + 1 + (L % d.trussSpacing ? 1 : 0);
  const trussX = Array.from({ length: trussCount }, (_, i) => Math.min(i * d.trussSpacing, L));

  const gableAboveEave = 2 * (d.knuckleRun * d.knuckleRise / 2 + upperRun * (d.knuckleRise + d.knuckleRise + d.upperRise) / 2);
  const perimeter = 2 * (W + L);
  const wallGross = perimeter * d.eave + 2 * gableAboveEave;

  // Windows. `at` is the center along the wall (x for the north and south walls, y for the west gable) and `sill` is the height of the sill above the main floor.
  const walkX = L - d.walkDoor.fromEast;
  const windows = [];
  const win = d.windowSpec;
  if (win && win.side) {
    const { width, height, sill } = win.side;
    const add = (wall, list) => list.forEach(number => {
      const bay = bays[number - 1];
      if (!bay) throw new Error(`There is no bay ${number} to put a window in`);
      if (width + 1 > bay) throw new Error(`A ${width} ft window does not fit in bay ${number}, which is ${bay} ft`);
      windows.push({ wall, bay: number, at: postX[number - 1] + bay / 2, width, height, sill });
    });
    add('N', win.side.northBays);
    add('S', win.side.southBays);
    if (sill + height > d.eave - 1) throw new Error('The sidewall windows must end at least a foot below the eave');
    windows.filter(w => w.wall === 'S').forEach(w => {
      if (Math.abs(w.at - walkX) < (w.width + d.walkDoor.width) / 2 + 1) throw new Error(`The south window in bay ${w.bay} is too close to the walk door`);
    });
  }
  if (win && win.loft) {
    const { width, height, sill } = win.loft;
    const heightAt = y => { const t = Math.abs(y - half); return t <= upperRun ? d.knuckleRise + d.upperRise * (upperRun - t) / upperRun : d.knuckleRise * (half - t) / d.knuckleRun; };
    const room = Math.min(heightAt(half - width / 2), heightAt(half + width / 2));
    if (sill + height > room - 0.5) throw new Error(`The loft window (head ${sill + height} ft above the loft floor) does not fit the gable, which is ${room} ft high at its edges`);
    windows.push({ wall: 'W', loft: true, at: half, width, height, sill: d.eave + sill });
  }
  const windowArea = sum(windows.map(w => w.width * w.height));
  const openings = d.mainDoor.width * d.mainDoor.height + d.walkDoor.width * d.walkDoor.height + d.loftDoor.width * d.loftDoor.height + windowArea;
  const rakeLength = L + 2 * d.rakeOverhang;
  const roofSqFt = (2 * (lowerLen + upperLen) + 2 * d.eaveTail) * rakeLength;
  const lowerSlopeSqFt = 2 * (lowerLen + d.eaveTail) * rakeLength;
  const slabSqFt = W * L;

  // Headroom above the loft floor at a distance from a sidewall, and the width of the loft that has at least a given headroom.
  const headroomAt = distance => {
    const dd = Math.min(distance, W - distance);
    if (dd <= 0) return 0;
    return dd <= d.knuckleRun ? d.knuckleRise * dd / d.knuckleRun : d.knuckleRise + d.upperRise * (dd - d.knuckleRun) / upperRun;
  };
  const distanceForHeadroom = h => (h <= d.knuckleRise ? d.knuckleRun * h / d.knuckleRise : d.knuckleRun + upperRun * (h - d.knuckleRise) / d.upperRise);
  const usableWidth = h => Math.max(0, W - 2 * distanceForHeadroom(h));

  const pierCuFt = Math.PI * Math.pow(d.pier.tubeInches / 24, 2) * ((d.pier.depthInches - d.pier.padThickInches) / 12)
    + Math.PI * Math.pow(d.pier.padInches / 24, 2) * (d.pier.padThickInches / 12);
  const slabCuYd = slabSqFt * d.slabInches / 12 / 27;
  const concrete = {
    slab: Math.round(slabCuYd * 1.1),
    piers: Math.round(pierCount * pierCuFt / 27 * 1.1),
    apron: Math.round(d.apron.width * d.apron.depth * d.slabInches / 12 / 27),
    deck: Math.round(d.deck.posts * pierCuFt / 27)
  };
  concrete.total = concrete.slab + concrete.piers + concrete.apron + concrete.deck;
  const rebarGrid = (w, l) => (Math.floor(w * 12 / 16) + 1) * l + (Math.floor(l * 12 / 16) + 1) * w;
  const rebar = {
    slab: Math.ceil(rebarGrid(W, L) / 20),
    piers: Math.ceil((pierCount + d.deck.posts) * 15 / 20),
    apron: Math.ceil(rebarGrid(d.apron.width, d.apron.depth) / 20)
  };
  rebar.total = rebar.slab + rebar.piers + rebar.apron;

  // The stair has two flights and a landing. The landing may stand only as high as still leaves the required headroom under the loft floor, which fixes how
  // many risers the first flight has. The second flight climbs through an opening in the loft floor as long as the flight itself.
  const stairRisers = Math.round(d.eave * 12 / d.stair.riser);
  const riserIn = d.eave * 12 / stairRisers;
  const firstRisers = Math.floor((underLoft * 12 - d.stair.headroom) / riserIn + 1e-9);
  if (firstRisers < 1 || firstRisers >= stairRisers) throw new Error(`The stair cannot keep ${d.stair.headroom} in of headroom under a loft floor ${d.eave} ft up`);
  const flights = [firstRisers, stairRisers - firstRisers].map(risers => ({ risers, treads: risers - 1, run: (risers - 1) * d.stair.tread / 12, rise: risers * riserIn / 12 }));
  const loftOpening = { width: d.stair.width, length: flights[1].run, fromNorth: W - d.stair.landing - flights[1].run };
  // The part of the opening that falls in the loft's 7 ft headroom zone comes out of that zone's floor area.
  const zone = [distanceForHeadroom(7), W - distanceForHeadroom(7)];
  const openingInZone = loftOpening.width * Math.max(0, Math.min(loftOpening.fromNorth + loftOpening.length, zone[1]) - Math.max(loftOpening.fromNorth, zone[0]));
  const loft7 = usableWidth(7) * L - openingInZone;

  // How tall the building is by Elmore County's definition: from the average ground at the front (east) wall to the average height (mid-point) of the highest gable.
  // The floor stands one slab, foam, and gravel stack above the pad surface. The pad is fill over the original ground, and the front wall runs north to
  // south across the whole wedge, so the average fill under it is the mean of the north and south thicknesses. The mid-point is halfway between eave and
  // ridge; a gambrel gable is fuller than a triangle, so averaging its whole shape (gableAvgAbovePad) reads higher.
  const padToFloor = (d.slabInches + 8) / 12;
  const eaveAbovePad = d.eave + padToFloor, ridgeAbovePad = peakZ + padToFloor;
  const gableMidAbovePad = (eaveAbovePad + ridgeAbovePad) / 2;
  const gableAvgAbovePad = eaveAbovePad + gableAboveEave / W;
  const avgFill = (d.fill.north + d.fill.south) / 2;
  const heights = { padToFloor, eaveAbovePad, ridgeAbovePad, roofPeakAbovePad: ridgeAbovePad + d.roofBuild, gableMidAbovePad, gableAvgAbovePad, avgFill, gableMidAboveOldGround: gableMidAbovePad + avgFill };
  // A laminated post stands on its bracket just above the pad surface and runs up to the truss carrier at the eave; it is sold in 2 ft lengths.
  const postLength = 2 * Math.ceil((d.eave + padToFloor - 0.1) / 2);
  const girts = girtLayout(d, { postX, gableY, doorY0, doorY1, walkX, windows, padToFloor });
  const wallInches = d.wall.furring + d.wall.sheathing + d.girts.thick + d.wall.post;   // from the steel to the inside face of the posts
  // The deck's inner and outer edges, measured east from the building's west end.
  const deckX0 = L + d.deck.gap, deckX1 = deckX0 + d.deck.depth;
  // The hoist beam passes the deck's outer edge, and two raking struts brace its tip: each runs from a steel shoe on the outer end of a deck beam, at the level just under
  // the decking, up to the tip. They meet the beam only there, so the trolley stops short of the tip and never has to pass them.
  const hoist = { ...d.hoist, out: deckX1 - L + d.hoist.beyondDeck };
  const hoistZ = d.eave + d.hoist.above;
  const braceTip = [L + hoist.out, half, hoistZ - 0.25];
  const braceFootX = deckX1 + 0.25, braceFootZ = d.eave - 0.5;
  const hoistBraces = [doorY0, doorY1].map(y => ({ foot: [braceFootX, y, braceFootZ], tip: braceTip, length: Math.hypot(braceTip[0] - braceFootX, braceTip[1] - y, braceTip[2] - braceFootZ) }));
  const hoistLift = 5 * Math.ceil((hoistZ - 0.25 - 1 + padToFloor) / 5);   // the hook runs from the pad up to the trolley, less the trolley's own height; chain falls come in 5 ft steps
  // The trusses, numbered from the west end (T1 is the west gable truss), that the stair opening and the hoist beam reach.
  const trussesIn = (from, to) => trussX.map((x, i) => ({ x, number: i + 1 })).filter(t => t.x >= from - 1e-9 && t.x <= to + 1e-9);
  const specialTrusses = Object.freeze({
    stairEdge: trussesIn(0, loftOpening.width),                                                  // the gable truss, the cut truss, and the trimmer
    stairCut: trussesIn(0, loftOpening.width).filter(t => t.x > 0.1 && t.x < loftOpening.width - 0.1),
    hoist: trussesIn(L - hoist.inside, L),                                                       // the trusses over the beam, ending at the east gable truss
    tied: trussesIn(0, L - hoist.inside - 1e-6)                                                  // the trusses with a collar tie: all but those over the beam, whose trolley runs under it
  });

  return Object.freeze({
    ...d, overrides: Object.freeze({ ...overrides }), bays, half, upperRun, knuckleZ, peakZ, lowerLen, upperLen,
    lowerAngle: Math.atan2(d.knuckleRise, d.knuckleRun) * 180 / Math.PI,
    upperAngle: Math.atan2(d.upperRise, upperRun) * 180 / Math.PI,
    postX, gableY, doorY0, doorY1, pierCount, postCount: pierCount,
    trussX, trussCount, commonTrusses: trussCount - 2, truss, specialTrusses, eaveSection: eaveSection(d, { lowerLen }),
    walkX,
    windows, windowArea,
    padMarginX: (d.pad.length - L) / 2, padMarginY: (d.pad.width - W) / 2,
    padToFloor, heights,
    girts, wallInches,
    loftDoorY0: (W - d.loftDoor.width) / 2, loftDoorY1: (W + d.loftDoor.width) / 2,
    deckY0: doorY0, deckY1: doorY1, deckX0, deckX1,
    deckPosts: [d.deck.postInset, d.deck.depth - d.deck.postInset].flatMap(x => [doorY0, doorY1].map(y => [deckX0 + x, y])),
    hoist, hoistZ, hoistLength: hoist.out + hoist.inside, hoistHookX: L + hoist.out - hoist.hook, hoistBraces, hoistBraceLength: hoistBraces[0].length, hoistLift,
    perimeter, gableAboveEave, wallGross, openings, wallNet: wallGross - openings,
    rakeLength, roofSqFt, lowerSlopeSqFt, slabSqFt, slabCuYd, floorSqFt: slabSqFt, loftSqFt: slabSqFt,
    loft7SqFt: loft7, loft7Width: usableWidth(7), headroomAt, usableWidth,
    concrete, rebar, pierCuFt,
    stairRisers, riserIn, flights, landingZ: flights[0].rise, loftOpening, stairTreads: flights[0].treads + flights[1].treads, postLength,
    underLoft,
    doorHeadroom: underLoft - d.mainDoor.height,
    rvClearDoor: d.mainDoor.height - d.rv.height,
    rvClearLoft: underLoft - d.rv.height,
    roofSnowPsf: 0.7 * d.loads.groundSnow
  });
}

// ------------------------------------------------------------------ the bill of materials

const line = (item, qty, unit, low, high, src, notes, lump) => ({ item, qty, unit, low, high, src, notes, lump });
const SOURCES = Object.freeze({ HD: 'Home Depot', LO: "Lowe's", SP: 'Specialty supplier', Q: 'Vendor quote required' });

function phases(m) {
  const c = Math.ceil, r = Math.round;
  const perimeterRatio = m.perimeter / 152, lengthRatio = m.length / 44;
  const loftSheets = c(m.loftSqFt * 1.05 / 32);
  const wallSheets = c(m.wallNet * 1.1 / 32), roofSheets = c(m.roofSqFt * 1.1 / 32);
  const roofSqFt = r(m.roofSqFt / 10) * 10, wallSqFt = r(m.wallNet / 10) * 10;
  const foam = c(m.slabSqFt / 32);
  const iwSqFt = m.lowerSlopeSqFt + 2 * 3 * m.rakeLength + 50;
  const snow = m.loads.groundSnow, wind = m.loads.wind;
  const tiedTrusses = `T${m.specialTrusses.tied[0].number} to T${m.specialTrusses.tied[m.specialTrusses.tied.length - 1].number}`, tieHeight = feetInches(m.bracing.tieAt), tieLength = feetInches(m.truss.tie.length);
  const sideWindows = m.windows.filter(w => !w.loft), loftWindows = m.windows.filter(w => w.loft);
  const windowFeet = sum(m.windows.map(w => 3 * w.width));   // a sill and two jack studs, about as much 2×6 as three times the window's width
  const gi = m.girts, rowsAbove = gi.rows.length - 1;
  const braceStock = 2 * c(m.hoistBraceLength / 2);                                // the struts come from the next even foot of 6×6 stock
  const doorHeadroomIn = r(m.doorHeadroom * 12), rvDoorClearIn = r(m.rvClearDoor * 12);
  const stringer = flight => 2 * c(Math.hypot(flight.rise, flight.run) / 2);       // stock length of a stringer: the diagonal, to the next even foot
  return [
    { num: 1, title: 'Site Work & Slab Sub-Base', items: [
      line('¾″ minus crushed gravel base, compacted 4″', c(m.slabSqFt * 4 / 12 / 27), 'cu yd', 28, 45, 'SP', 'Local gravel pit — much cheaper than HD bagged. It goes on the compacted pad fill.'),
      line('10 mil black poly vapor barrier 20×100', c(m.slabSqFt * 1.15 / 2000), 'roll', 130, 180, 'HD', 'Husky brand, sealed seams with poly tape.'),
      line('4″ XPS rigid foam 4×8 (R-20 under slab)', foam, 'sheet', 60, 80, 'HD', `${n(m.slabSqFt)} sq ft slab area. Owens Corning Foamular 250 or equiv.`),
      line('Erosion control / silt fence', 1, 'lot', 80, 150, 'HD', 'Per permit.'),
      line('Layout supplies (stakes, mason line, marking paint)', 1, 'lot', 50, 100, 'HD', '—')
    ], notes: [['tip', `Cost-cut options here: drop under-slab foam to 2″ (R-10) saves ~${money(r(foam * 60 / 2 / 100) * 100)}; skip foam entirely if you will never heat above 50 °F (saves ~${money(r(foam * 60 / 100) * 100)} but you lose comfort and the slab will sweat in summer).`]] },
    { num: 2, title: 'Concrete (Piers, Slab, Apron, Deck Footings)', items: [
      line('Ready-mix 4,000 psi w/ fiber mesh', m.concrete.total, 'cu yd', 170, 210, 'SP', `Includes ~${m.concrete.slab} yd slab + ${m.concrete.piers} yd piers + ${m.concrete.apron} yd apron + ${m.concrete.deck} yd deck footings.`),
      line('Short-load surcharge (2 trucks)', 2, 'trip', 75, 150, 'SP', 'Likely needed for pier-pour + slab-pour separately.'),
      line('Sonotube 18″Ø × 12 ft (building piers)', m.pierCount, 'ea', 80, 100, 'HD', 'Cut to length on site. One 12 ft tube cuts into two piers, so ask whether half as many will do.'),
      line('Sonotube 18″Ø × 12 ft (deck piers)', m.deck.posts, 'ea', 80, 100, 'HD', 'Landing deck piers; the engineer sizes them.'),
      line('#4 rebar 20 ft (slab + piers + apron)', m.rebar.total, 'stick', 10, 13, 'HD', `Slab grid 16″ OC EW = ~${m.rebar.slab} sticks. Piers ~${m.rebar.piers}, apron ~${m.rebar.apron}. Buy ahead, cut on site.`),
      line('Rebar chairs / plastic bolsters (bag of 50)', c(m.slabSqFt / 176), 'bag', 12, 18, 'HD', 'To hold slab rebar at mid-depth.'),
      line('Rebar tie wire + tie tool / pliers', 1, 'lot', 40, 80, 'HD', '—'),
      line('Concrete sealer (Foundation Armor or equiv)', r(2 * m.slabSqFt / 1408), '5-gal', 130, 200, 'HD', 'Penetrating sealer for slab. Apply after 28-day cure.'),
      line('Saw-cut control joints (rental + blades)', 1, 'day', 120, 200, 'HD', 'Cut joints in a pattern of about 11 ft panels within 12 hours of pour.')
    ] },
    { num: 3, title: 'Foundation Hardware', items: [
      line('Sturdi-Wall Plus / Perma-Column wet-set bracket (sized for 3-ply 2×8)', m.pierCount, 'ea', 130, 220, 'SP', 'Order from Perma-Column or Mid-States. Set in wet concrete during pier pour.'),
      line('Deck post bases (Simpson ABU, hot-dipped, 6×6 size)', m.deck.posts, 'ea', 32, 45, 'HD', 'Wet-set in the deck pier pour; sized for the 6×6 deck legs.'),
      line('Galvanized anchor bolts / threaded rod stock', 1, 'lot', 50, 120, 'HD', 'Bracket hardware usually included; this is overage.')
    ] },
    { num: 4, title: 'Laminated Posts (3-ply 2×8)', items: [
      line(`3-ply 2×8 SPF laminated PT column, ${m.postLength} ft`, m.postCount, 'ea', r(280 * m.postLength / 20), r(450 * m.postLength / 20), 'Q', `Pre-fab laminated from Perma-Column, Mid-States, or local truss supplier. Each post runs from its bracket, just above the pad surface, to the truss carrier at the ${m.eave} ft eave. Alternative: site-build with 3-ply 2×8 #2 SPF (bottom 4 ft PT for splash), full glue + nail per ICC ESR. Cost-cut: site-build saves ~${money(r(1500 * m.postLength / 20 / 100) * 100)} but takes about 2 more days of work.`),
      line('Construction adhesive (PL Premium, if site-laminating)', 12, 'tube', 8, 12, 'HD', 'Only if site-fabricating posts.')
    ] },
    { num: 5, title: 'Pre-Engineered Gambrel Attic Trusses', items: [
      line(`Common gambrel attic truss, ${m.width}′ span, ${m.trussSpacing}′ OC, PE stamped (${snow} psf ground snow, ${m.loads.loftLive} psf loft floor)`, m.commonTrusses, 'ea', 450, 700, 'Q',
        `Quote 3 suppliers: Western Truss (Caldwell), BMC Truss (Boise), Builders FirstSource.         State explicitly: ${snow} psf ground snow (the county's design load here), ${wind} mph wind Exp ${m.loads.exposure}, ${m.loads.loftLive} psf loft LL, gambrel attic with the room between the pitch-break lines left open under a collar tie ${tieHeight} above the loft floor (${tiedTrusses}; none on the hoist trusses). Send the truss package page (or its PDF): it has the shape, the open room and its tie, the bracing, the loads, and the special trusses. The unit price is a placeholder: a ${m.width} ft attic truss for a loft floor and this snow load will likely price above an ordinary roof truss.`),
      line('Gable-end truss (drop-in)', 2, 'ea', 300, 500, 'Q', 'Solid-faced for siding nailers; outlooks for gable overhang.'),
              line('Truss delivery + crane / boom truck', 1, 'trip', 400, 1000, 'Q', "The plant's boom truck delivers the trusses and can set them on the walls: ask for delivery and boom time as their own line on the quote (the truss package lists what to include). Faster and safer than rolling them in by hand."),
      line('Truss-clip hurricane ties (Simpson H2.5A, box of 100)', c(m.trussCount * 4 / 100), 'box', 85, 110, 'HD', `2 per truss bearing × ${m.trussCount} trusses × 2 sides = ${m.trussCount * 4} ties needed.`),
      line('Truss-set blocking (2×6 SPF, 8 ft)', r(25 * (m.trussCount - 1) / 22), 'stick', 7, 9, 'HD', 'Between trusses at heel + ridge for stability.'),
      line('Permanent lateral bracing per truss design', 1, 'lot', 200, 400, 'HD', '2×4 SPF + framing nails per truss-design BCSI sheets.')
    ], notes: [['warn', '<strong>Critical:</strong> truss order needs <strong>4–8 week lead time</strong>. Get the quote &amp; place the deposit BEFORE you start the foundation so trusses arrive ready when walls are up.']] },
    { num: 6, title: 'Wall Framing (Girts & Blocking)', items: [
      line(`2×6×${gi.board} SPF #2 (girts: north, south, and west walls)`, gi.buy.side, 'stick', 13, 16, 'HD',
        `Laid flat on the outside face of the posts and screwed to each one: ${rowsAbove} rows above the base girt at 24″ OC. Every joint lands on a post, and neighboring rows start with boards of different lengths so their joints fall on different posts. The pieces cut out at the windows and the walk door make the sills and jack studs.`),
      ...(gi.buy.east ? [line(`2×6×${gi.eastBoard} SPF #2 (east wall girts, each cut in half)`, gi.buy.east, 'stick', 17, 22, 'HD',
        `The door jambs leave a ${gi.eastPiece} ft run on each side of the door in every row, so one ${gi.eastBoard} ft board makes both pieces with no waste. Not every yard stocks ${gi.eastBoard} footers: ask.`)] : []),
      line(`2×6×${gi.board} PT (base girts, ground contact)`, gi.buy.base, 'stick', 20, 26, 'HD',
        `The lowest row, its bottom edge at the floor line (${Math.round((m.padToFloor + gi.firstRow) * 12)}″ above the pad). It is pressure-treated because it is the row closest to the ground and the slab, and it backs the lower edge of the sheathing. It stops at the doors, so each of the east wall's two ${gi.eastPiece} ft pieces takes a board of its own. The splash board below it (phase 12) is screwed to the posts.`),
      line('3½″ structural screws, girts to posts (100 ct)', c(gi.screws / 100), 'box', 55, 80, 'HD',
        `${n(gi.screws)} screws: ${gi.screwsPerPost} at each post a board crosses and ${gi.screwsPerEnd} at each board end. The county's minimum is four 20d nails per girt at each post, so the engineer confirms the screw schedule.`),
      line('2×6×8 SPF #2 (blocking, headers)', r(30 * perimeterRatio), 'stick', 7, 9, 'HD', 'For door jacks, headers, blocking, gable infill.'),
      ...(m.windows.length ? [line('2×6×8 SPF #2 (window sills and jack studs)', c(windowFeet / 8), 'stick', 7, 9, 'HD',
        `${m.windows.length} windows, about ${n(windowFeet)} lin ft. The girt above a sidewall window is its header, so each opening needs only a sill and two jack studs once the girt row across it is cut. Windows sit between posts, so the posts carry the wall.`)] : []),
      line(`(2) 2×10 LVL header, 18 ft (over the ${m.mainDoor.width}×${m.mainDoor.height} OH door)`, 2, 'ea', 120, 200, 'HD', `LP / GP LVL 1¾×9¼. Placeholder: the specs call for (3) 2×12 LVL or a steel beam sized by the engineer, no deeper than 12 in, because it must fit in the ${doorHeadroomIn} in between the door head and the underside of the loft floor. Truss bearing above goes onto the LVL via post-jacks.`),
      line('(2) 2×10 LVL header, 8 ft (loft doors + walk door)', 2, 'ea', 60, 95, 'HD', 'Loft door header + walk door header.')
    ] },
    { num: 7, title: 'Roof Framing (Purlins & Roof Blocking)', items: [
      line('2×6×16 SPF #2 (purlins on top of truss chords)', c(60 * lengthRatio), 'stick', 13, 16, 'HD', `~${n(c(950 * lengthRatio / 10) * 10)} lin ft purlins on 4 slopes at 24″ OC.`),
      line('Simpson H1 / TC clips (purlin to truss)', 2, 'box of 100', 70, 95, 'HD', '1 clip per purlin-truss intersection ~200 clips.'),
      line('OSB H-clips for roof deck (bag of 250)', 1, 'bag', 30, 45, 'HD', '1 per panel edge between purlins.'),
      line('Ridge / gambrel-break blocking (2×6 cut to suit)', 1, 'lot', 100, 200, 'HD', 'For ridge cap nailing + steel termination at pitch break.')
    ] },
    { num: 8, title: 'Sheathing', items: [
      line('½″ OSB 4×8 sheathing (walls + gable infill)', wallSheets, 'sheet', 18, 26, 'HD', `~${n(wallSqFt)} sq ft net wall + gable area, +10% waste. APA Exposure 1.`),
      line('⅝″ OSB 4×8 roof deck', roofSheets, 'sheet', 26, 36, 'HD', `~${n(roofSqFt)} sq ft roof (with a 1 ft eave and gable overhang) + 10% waste. APA Exposure 1.`),
      line('8d ring-shank framing nails (30 lb box)', 2, 'box', 50, 65, 'HD', 'For OSB to framing.')
    ] },
    { num: 9, title: 'Weather Barrier & Underlayments', items: [
      line('Tyvek CommercialWrap 9′ × 100′', c(m.wallNet * 1.2 / 900), 'roll', 230, 280, 'HD', `${n(wallSqFt)} wall sq ft, +20% lap = ${n(r(wallSqFt * 1.2 / 100) * 100)} sq ft, 900/roll. CommercialWrap is the more durable version & appropriate for an unconditioned shop.`),
      line('Tyvek tape (1.88″ × 165′)', 4, 'roll', 22, 28, 'HD', 'Seam & flashing tape — buy Tyvek brand, not generic.'),
      line('Grace Ice & Water Shield 36″ × 66.7′ (200 sq ft)', c(iwSqFt / 184), 'roll', 115, 145, 'HD', `Full lower slope (~${n(r(m.lowerSlopeSqFt / 10) * 10)} sq ft) + pitch break + penetrations. Most critical detail for a snow climate.`),
      line('Synthetic underlayment 48″ × 250′ (1,000 sq ft)', c(m.roofSqFt * 1.1 / 1000), 'roll', 130, 170, 'HD', 'Titanium UDL30, Grip-Rite, etc. Full roof, with laps.'),
      line('Plastic cap nails for underlayment (5 lb box)', 2, 'box', 30, 45, 'HD', '—')
    ] },
    { num: 10, title: 'Rainscreen (Furring & Flashings)', items: [
      line('1×4×8 PT furring strips', m.perimeter + 33, 'stick', 5, 7, 'HD', `${m.perimeter / 2} furring runs at 16 ft each = ${m.perimeter} sticks for walls (use 2 per 16 ft run). Plus gables ~33 sticks.`),
      line('Insect screen / drip-edge strip (Cor-A-Vent SV-3 or equiv)', r(8 * perimeterRatio), '10 ft pc', 18, 26, 'SP', 'At base of walls + eave vent. Buy from siding distributor.'),
      line('Aluminum drip-edge flashing (10 ft)', c(m.perimeter / 10), 'stick', 10, 14, 'HD', `~${m.perimeter} lin ft for splash board top, +bug screen.`),
      line('Coil stock for window/door flashings (8″ × 50′)', 1, 'roll', 60, 95, 'HD', 'Color-matched coil for custom bends.'),
      line('2½″ stainless ring-shank nails for furring (5 lb box)', 2, 'box', 30, 45, 'HD', 'SS prevents tannin streaks through PT.')
    ] },
    { num: 11, title: 'Steel Package (Roof + Walls + Trim)', items: [
      line('26 ga steel roof panel (beige w/ Dripstop)', roofSqFt, 'sq ft', 1.9, 2.9, 'Q', 'Bare-roll prices; cut to exact slope length.'),
      line('26 ga steel wall panel (barn red)', wallSqFt, 'sq ft', 1.8, 2.7, 'Q', 'Bare-roll prices; vertical orientation, cut to full wall height.'),
      line('Trim package — corner, base, eave, gambrel-break, ridge cap, J-channel', 1, 'pkg', 900, 1500, 'Q', 'Have supplier itemize; ridge cap MUST be vented for moisture relief.'),
      line('Snow guards (twin-rail or pad-style)', 20, 'ea', 10, 20, 'SP', 'On the lower slope over the walk door and any other doorway under a roof edge. The east gable has no roof slope above it. SnowTrapper, S-5! brand.'),
      line('#10 × 1½″ hex roofing screws w/ EPDM (250 ct, color-matched)', c((roofSqFt + wallSqFt) * 0.75 / 250), 'box', 40, 55, 'HD', 'Two colors needed (beige + red). Calculated at about ¾ screw per sq ft of panel.'),
      line('Closure strips (foam, inside & outside profile)', 1, 'lot', 150, 250, 'Q', 'At ridge cap and eaves — keeps wind-driven snow out.')
    ], notes: [['info', '<strong>Get an itemized package quote</strong> from a regional steel supplier (e.g. <em>Idaho Steel Products – Caldwell</em>, <em>Boise Steel Roofing</em>, <em>R-Panel/Metal Sales – Twin Falls</em>). Buying loose at HD/Lowe\'s costs ~50–80% more.<br>Specify: 26 ga / Galvalume painted / 2-color (beige roof + barn red walls) / factory Dripstop on roof / 50-year paint warranty / vented ridge cap.']] },
    { num: 12, title: 'Splash Board', items: [
      line('2×10×16 PT (.40 or .60 ground contact)', r(11 * perimeterRatio), 'stick', 30, 38, 'HD', `${m.perimeter} lin ft perimeter at base of wall (less the door openings), lapped over piers.`),
      line('HD hot-dipped galvanized 3″ deck screws (5 lb box)', 1, 'box', 45, 65, 'HD', 'Fasten splash board to posts/blocking. NEVER use bright/EG with PT.')
    ] },
    { num: 13, title: 'Doors & Windows', items: [
      line(`${m.mainDoor.width}′ × ${m.mainDoor.height}′ insulated sectional OH door, wind-rated, low-headroom track (Wayne Dalton 9100 / Clopay 4053)`, 1, 'ea', 3500, 6500, 'Q', `Wind rated to ≥${wind} mph + insulated. Priced as the door and its track kit, delivered; the family installs it, and the torsion springs are wound as the maker directs. The camper is ${feetInches(m.rv.height)} tall, so a ${m.mainDoor.height}′ door clears it by ${rvDoorClearIn} in. The loft floor leaves ${doorHeadroomIn} in above the door, so ask for a low-headroom track kit that needs 12 in or less.`),
      line('LiftMaster 8500W jackshaft opener (wall-mount, side-mount)', 1, 'ea', 450, 650, 'SP', 'A wall-mount opener keeps the space under the loft floor free for the low-headroom track.'),
      line('3070 insulated steel walk door, pre-hung w/ frame', 1, 'ea', 400, 800, 'HD', '9-lite or solid. Heavy-duty lockset extra.'),
      line('5′ × 6′ double exterior insulated door (loft, hinged out OR sliding barn-door)', 1, 'set', 1200, 2200, 'Q', 'Spec: weather-sealed, locking from inside, opens fully clear for hoist. Custom shop door OR pair of 30″ exterior pre-hung.'),
      ...(sideWindows.length ? [line(`Insulated vinyl window, ${sideWindows[0].width}′ × ${sideWindows[0].height}′ slider, low-E, DP-30 or better, with jamb extensions`, sideWindows.length, 'ea', 260, 480, 'HD',
        `Nail-fin windows in the north and south walls, sill ${sideWindows[0].sill}′ above the floor. Ask for the design-pressure (DP) rating the engineer gives for ${wind} mph, and order jamb extensions deep enough to reach the inside face of the posts, ${inches(m.wall.sheathing + gi.thick + m.wall.post)} behind the face of the sheathing.`)] : []),
      ...(loftWindows.length ? [line(`Insulated vinyl window, ${loftWindows[0].width}′ × ${loftWindows[0].height}′ single-hung, low-E, DP-30 or better (west loft wall)`, loftWindows.length, 'ea', 240, 440, 'HD',
        'Centered in the west gable, sill ' + (loftWindows[0].sill - m.eave) + '′ above the loft floor, so it lights the loft and the stair arrival.')] : []),
      ...(m.windows.length ? [
        line('Window flashing: self-adhered sill pans and flashing tape', 1, 'lot', 60, 120, 'HD', 'Sill pan, then jamb tape, then head tape, lapped under the wrap above and over the wrap below.'),
        line('Steel J-trim and head flashing for the windows', m.windows.length, 'ea', 20, 40, 'SP', 'Color-matched; ask the steel supplier to cut it with the trim package.')] : []),
      line('Door hardware — locks, dead-bolts, weather strip, exterior pulls', 1, 'lot', 150, 300, 'HD', '—')
    ] },
    { num: 14, title: 'Loft Floor Decking', items: [
      line('¾″ T&G Sturd-I-Floor OSB 4×8 (Advantech preferred)', loftSheets, 'sheet', 30, 45, 'HD', `${n(m.loftSqFt)} sq ft floor + 5% waste = ${n(r(m.loftSqFt * 1.05 / 10) * 10)} sq ft. Advantech ($45) much better moisture resistance during build.`),
      line('Subfloor adhesive (PL400, 28 oz)', r(12 * loftSheets / 48), 'tube', 7, 10, 'HD', 'Glue + screw — silences floor squeaks.'),
      line('2½″ deck screws for subfloor (5 lb box)', 2, 'box', 30, 45, 'HD', '—')
    ] },
    { num: 15, title: 'Interior Loft Stairs (L-shape)', items: [
      line(`2×12×${stringer(m.flights[0])} SPF #1 (stringers, first flight)`, 3, 'stick', r(40 * stringer(m.flights[0]) / 12), r(55 * stringer(m.flights[0]) / 12), 'HD', `${m.flights[0].risers} risers, ${feetInches(m.flights[0].rise)} up over ${feetInches(m.flights[0].run)} of run, to the landing.`),
      line(`2×12×${stringer(m.flights[1])} SPF #1 (stringers, second flight)`, 3, 'stick', r(40 * stringer(m.flights[1]) / 12), r(55 * stringer(m.flights[1]) / 12), 'HD', `${m.flights[1].risers} risers, ${feetInches(m.flights[1].rise)} up over ${feetInches(m.flights[1].run)} of run, to the loft floor.`),
      line('2×10×12 SPF (treads or sub-treads)', c((m.stairTreads + 2) / 2), 'stick', 22, 30, 'HD', `2 treads per stick. ~${m.stairTreads + 2} treads total.`),
      line('2×4×8 SPF (handrail + landing frame)', 10, 'stick', 4, 6, 'HD', '—'),
      line('Pre-fab oak/poplar handrail + balusters (kit)', 1, 'kit', 200, 400, 'HD', 'Optional — code requires graspable handrail 34–38″ above nosing.'),
      line('LSC stringer connectors + joist hangers', 1, 'lot', 60, 100, 'HD', 'Simpson LSC adjustable stringer connector.')
    ] },
    { num: 16, title: `Landing Deck (${m.deck.width}′ × ${m.deck.depth}′, free-standing)`, items: [
      line('6×6×16 PT posts (deck legs, full height to ground)', m.deck.posts, 'stick', 55, 75, 'HD', `6×6 for lateral stability: the deck is ${m.eave} ft tall, so it needs the bigger leg. 16 ft is the stock length; each leg is cut to about ${r(m.eave - 1.3 + m.padToFloor)} ft.`),
      line('2×10×16 PT (beams & outer joists)', 4, 'stick', 30, 38, 'HD', 'Two doubled beams east-west on the post lines.'),
      line(`2×10×${m.deck.width} PT (joists @ 12″ OC)`, 10, 'stick', 25, 32, 'HD', 'Run north-south between the beams. Tighter spacing for snow load.'),
      line('5/4×6×12 PT decking', 26, 'stick', 10, 14, 'HD', `${m.deck.width * m.deck.depth} sq ft + waste. Alt: composite for ~3× cost.`),
      line('2×6×8 PT (diagonal knee-braces, 4 needed)', 4, 'stick', 8, 11, 'HD', `Critical for lateral stability — a ${m.eave} ft tall deck WILL sway without these.`),
      line('2×4×8 PT (railing top + bottom + balusters)', 30, 'stick', 4, 6, 'HD', '42″ railing required for fall protection > 30″.'),
      line('Simpson joist hangers (LUS210, box of 25)', 1, 'box', 60, 85, 'HD', 'HDG for PT contact.'),
      line('Simpson hurricane ties for beam-to-post (H1)', 8, 'ea', 3, 5, 'HD', '—'),
      line('HDG structural screws (Headlok / GRK RSS, 4½″, 100 ct)', 2, 'box', 45, 65, 'HD', 'For beam to post connections.'),
      line('HDG #9 × 3″ deck screws (5 lb box)', 2, 'box', 35, 50, 'HD', 'Camo or face screws.'),
      line('Flashing and sealer at the wall', 1, 'lot', 60, 100, 'HD', 'The deck stands free of the wall (no ledger), so this is only for a brace tie-in if the engineer wants one.')
    ] },
    { num: 17, title: 'Hoist Beam, Braces & Trolley', items: [
      line(`W6×12 steel I-beam, ${feetInches(m.hoistLength)} (braced at the tip by two struts, rated for 1,000 lb at the hook)`, 1, 'ea', r(15 * m.hoistLength), r(23.3 * m.hoistLength), 'SP', `Local steel yard (Idaho Steel Boise / Triumph Steel), cut to length. ${m.hoist.inside} ft inside + ${feetInches(m.hoist.out)} out past the wall, which is ${m.hoist.beyondDeck} ft beyond the deck's outer edge. The engineer picks the size; a W6×15 is the likely next step up.`),
      line(`6×6×${braceStock} PT (hoist braces: two raking struts)`, 2, 'ea', r(55 * braceStock / 16), r(75 * braceStock / 16), 'HD', `From a steel shoe on the outer end of each outer deck beam to the tip of the hoist beam, each about ${feetInches(m.hoistBraceLength)} long. Steel tube is the alternative if the engineer prefers it.`),
      line('Beam-tip end plate and brace shoes (fabricated, galvanized)', 1, 'lot', 120, 260, 'SP', 'A plate on the end of the beam with ears for the two struts, which is also the trolley\'s outer stop, and a steel shoe on the end of each outer deck beam to seat a strut. A welder or the steel yard makes them.'),
      line('Beam trolley (1-ton capacity, fits W6 flange)', 1, 'ea', 60, 120, 'SP', 'Harbor Freight, Northern Tool, Grainger.'),
      line(`Chain fall hoist (1-ton, ${m.hoistLift} ft lift)`, 1, 'ea', r(80 + 4 * (m.hoistLift - 10)), r(200 + 8 * (m.hoistLift - 10)), 'SP', `The hook runs from the ground up to the beam, about ${m.hoistLift} ft. A hand chain fall that long is a special order; an electric hoist is the alternative.`),
      line('Beam inner end-stop hardware (welded angles or bolt-on)', 1, 'lot', 30, 60, 'SP', 'Keeps the trolley from running off the inside end; the tip plate stops it at the outer end.'),
      line('EPDM weather boot / flashing for beam penetration', 1, 'ea', 40, 80, 'HD', 'Custom-made from flat EPDM + butyl tape. CRITICAL detail.'),
      line('Anchor plate / bolt-through hardware (beam to truss)', 1, 'lot', 50, 120, 'HD', 'Coordinate with truss engineer for attachment.'),
      line('Blocking (2×6 + 2×8 between trusses to spread beam load)', 1, 'lot', 40, 80, 'HD', '—')
    ], notes: [['warn', `<strong>Engineering check:</strong> have the truss manufacturer review the hoist-beam attachment, and the engineer size the beam, the two braces, and the deck posts and piers that carry them. A beam that reaches ${feetInches(m.hoist.out)} past the wall with 1,000 lb at its tip makes a serious uplift load on the truss top chord inside; the truss may need an extra ply at that location or a reinforced web. The braces take much of the tip load down into the deck, so the deck is part of the hoist.`]] },
    { num: 18, title: 'Electrical', items: [
      line('200 A main-lug sub-panel (Square D HOM, 42 space)', 1, 'ea', 220, 380, 'HD', 'Square D Homeline or Eaton BR. Main-lug, fed from the pump house or the house (feed source to settle).'),
      line('Breakers — 15/20 A (10 ea), 30 A (3: RV, compressor, mini-split), 50 A (1: welder)', 14, 'ea', 8, 45, 'HD', '15/20 A standard, 30 A for the RV outlet, the compressor, and the mini-split (check its nameplate), 50 A for the welder.', [200, 400]),
      line('4/0 AL feeder cable, wet-rated, in conduit (per ft)', 200, 'ft', 8, 13, 'HD', 'Pulled through the 2″ PVC conduit from the pump house (about 29 ft south) or the house. 200 ft is a generous allowance: check distance + voltage drop. Alt: 2/0 CU for shorter runs.'),
      line('2″ Schedule 40 PVC conduit 10 ft (sleeve in/out of building)', 6, 'stick', 14, 18, 'HD', 'Sweep + sleeve at panel entry.'),
      line('12 AWG NM-B Romex (250 ft roll, yellow)', 3, 'roll', 95, 140, 'HD', '20 A general circuits.'),
      line('14 AWG NM-B Romex (250 ft, white) — lighting', 2, 'roll', 70, 110, 'HD', '15 A lighting circuits only.'),
      line('10 AWG NM-B 250 ft (30 A circuits)', 1, 'roll', 160, 220, 'HD', 'For RV TT-30 outlet + mini-split.'),
      line('6/3 AWG (welder 50 A 6-50R run)', 50, 'ft', 5, 7, 'HD', '—'),
      line('20 A duplex outlets (15 ea) + 20 A GFCI (6 ea)', 21, 'ea', 3, 22, 'HD', 'Mix standard + GFCI (where required).', [150, 280]),
      line('NEMA 6-50R outlet (welder)', 1, 'ea', 25, 40, 'HD', '—'),
      line('NEMA TT-30R outlet (RV)', 1, 'ea', 25, 40, 'HD', 'Weather-resistant in WP cover.'),
      line('Wall switches (single + 3-way)', 12, 'ea', 3, 8, 'HD', '—'),
      line('Steel handy boxes / 4″ square boxes', 40, 'ea', 2, 4, 'HD', 'Exposed conduit-mount.'),
      line('EMT ½″ conduit + couplings + clamps (exposed runs)', 1, 'lot', 300, 500, 'HD', 'Exposed conduit looks cleanest in shop.'),
      line('LED high-bay light 150 W (5000 K, ~22,000 lm)', 6, 'ea', 60, 150, 'HD', 'Lithonia / Hyperikon. Mount at loft floor level.'),
      line('Exterior LED wall pack w/ photocell', 3, 'ea', 40, 85, 'HD', 'Above OH door, walk door, deck.'),
      line('Misc — wire nuts, lugs, ground rod & clamp, in-use covers', 1, 'lot', 200, 400, 'HD', '—')
    ] },
    { num: 19, title: 'HVAC (Mini-Split + Wood Stove)', items: [
      line('Mini-split heat pump 2-zone (1× 12k + 1× 9k indoor, Mr Cool or Senville)', 1, 'system', 2000, 3500, 'SP', 'DIY pre-charged lines = no HVAC trade required. Mr Cool DIY series. Shoulder-season heat + summer cool.'),
      line('Wood stove (Drolet HT3000 / Englander 30-NC, EPA cert)', 1, 'ea', 1200, 2800, 'HD', 'Hearth/clearance per UL listing — won\'t go on slab without insulated pad.'),
      line('Class A double-wall insulated chimney 6″ (DuraVent DVL / Simpson Dura-Plus, kit)', 1, 'kit', 700, 1200, 'SP', 'Through-the-wall or through-the-roof — through-wall typically lower cost & safer for a tall building.'),
      line('Stove hearth pad (UL-listed, R-1.6 min)', 1, 'ea', 120, 250, 'HD', '—'),
      line('Stovepipe + storm collar + rain cap + thimble', 1, 'lot', 200, 400, 'HD', '—')
    ] },
    { num: 20, title: 'Insulation (Phase 2 — when conditioning)', items: [
      line('R-23 fiberglass batts 5½″ × 16 OC (kraft-faced)', r(25 * perimeterRatio), 'bag', 45, 60, 'HD', `Walls — install behind drywall/OSB interior finish. ~${n(r(2000 * perimeterRatio / 10) * 10)} sq ft of wall area to insulate.`),
      line('R-30 batts (loft floor between joists)', r(10 * m.loftSqFt / 1408), 'bag', 55, 75, 'HD', 'If loft floor is over unconditioned space — but ours is conditioned both sides, so OPTIONAL.'),
      line('R-49 blown-in cellulose for the upper loft ceiling (placeholder)', 1, 'lot', 500, 900, 'SP', `The collar tie gives a flat ceiling only across the middle ${tieLength} of the loft, and the rest of the roof has none to blow this onto, so the roof needs another insulation method (see the overview's open questions). The price stands until it is chosen.`),
      line('6 mil poly vapor barrier (interior side of walls)', 2, 'roll', 80, 120, 'HD', 'Cold-climate zone 6B. Verify with builder — kraft-face on batts may suffice.'),
      line('Interior finish — ½″ OSB or T1-11 (full shop interior)', r(60 * perimeterRatio), 'sheet', 18, 30, 'HD', 'Far more abuse-resistant than drywall in a shop. Alt: skip for now, install later. It is screwed to horizontal strapping across the posts, which this list does not price.')
    ], notes: [['tip', '<strong>Phasing tip:</strong> build the shell first, conditioned later. The rainscreen + ½″ OSB sheathing makes the shell fully weather-tight even with no insulation or interior finish. Move in equipment, work in it for a winter, decide which areas need heat — then phase in mini-split + insulation only where you actually use it.']] },
    { num: 21, title: 'Fasteners & Miscellaneous Hardware', items: [
      line('16d common nails (50 lb box)', 1, 'box', 65, 90, 'HD', 'For framing.'),
      line('Bag of 1¾″ × 0.131 framing-nailer ring-shank coils', 2, 'box', 80, 120, 'HD', 'If using gun.'),
      line('3″ structural screws (Headlok, 100 ct)', 3, 'box', 50, 75, 'HD', 'Post-to-post and miscellaneous framing (the girt screws are in phase 6).'),
      line('Construction adhesive (PL Premium, 28 oz)', 12, 'tube', 7, 10, 'HD', 'Multi-use.'),
      line('Caulks & sealants (DAP DynaFlex 230, butyl, NP1)', 1, 'lot', 80, 150, 'HD', '—'),
      line('Hurricane / strap-tie variety pack', 1, 'lot', 80, 150, 'HD', 'Simpson assortment.'),
      line('Spray-on house wrap sealant (Stretch & Seal)', 1, 'can', 25, 40, 'HD', 'For seams/corners.'),
      line('Misc safety (gloves, glasses, ear plugs, N95)', 1, 'lot', 80, 150, 'HD', '—')
    ] }
  ];
}

// The extras that turn the materials into a budget. Each is [low, midpoint, high].
const BUDGET_EXTRAS = Object.freeze([
  ['Permits, plan review, engineering', 1500, 2500, 4000, 'County permit, the Idaho engineer\'s stamp on the plans and the trusses, and the electrical permit.'],
  ['Pier holes, compaction testing, and any extra dirt work', 1500, 3000, 5000, 'The pad itself is already built (imported fill), so this is mostly drilling the pier holes and testing the fill.'],
  ['Utility hookup (power feeder)', 1500, 4000, 10000, 'The specs call for no plumbing, so this is the feeder trench and the service connection; the cable and conduit are in phase 18. Wildly site-dependent; the feeder source is not settled.'],
  ['Equipment rental (lift, telehandler, concrete tools)', 1500, 3000, 4500, 'About $1,500–4,000 for a scissor lift and a man-lift on truss-set day.']
]);
const SALES_TAX = 0.06, CONTINGENCY = 0.15;

function bom(m) {
  const list = phases(m).map(phase => {
    const items = phase.items.map(item => {
      const low = item.lump ? item.lump[0] : Math.round(item.qty * item.low * 100) / 100;
      const high = item.lump ? item.lump[1] : Math.round(item.qty * item.high * 100) / 100;
      return { ...item, totalLow: low, totalHigh: high };
    });
    return { ...phase, items, low: sum(items.map(i => i.totalLow)), high: sum(items.map(i => i.totalHigh)) };
  });
  const low = sum(list.map(p => p.low)), high = sum(list.map(p => p.high));
  const mid = (low + high) / 2;
  const column = (materials, which) => {
    const extras = BUDGET_EXTRAS.map(row => row[which]);
    const tax = materials * SALES_TAX;
    const before = materials + tax + sum(extras);
    const contingency = before * CONTINGENCY;
    return { materials, tax, extras, contingency, total: before + contingency };
  };
  return {
    phases: list,
    totals: { low, mid, high },
    budget: { low: column(low, 1), likely: column(mid, 2), high: column(high, 3) },
    lineCount: sum(list.map(p => p.items.length))
  };
}

// The numbers the pages quote in their text, as strings: a page marks a place with <span data-m="name">fallback</span> and the script fills it in.
function facts(m) {
  const b = bom(m), t = b.totals, hundred = value => money(Math.round(value / 100) * 100);
  const sideWindow = m.windows.find(w => !w.loft), loftWindow = m.windows.find(w => w.loft);
  const count = wall => String(m.windows.filter(w => w.wall === wall).length);
  // The same building without its windows, and two feet shorter, at the same prices: what the windows add and what a foot of length costs.
  // Both leave the windows out, because they cost the same at either length.
  const withoutWindows = length => bom(create({ ...m.overrides, windowSpec: null, length }));
  const bare = withoutWindows(m.length), shorter = withoutWindows(m.length - 2);
  const perFoot = (bare.totals.mid - shorter.totals.mid) / 2, perFootAllIn = (bare.budget.likely.total - shorter.budget.likely.total) / 2;
  const marginIn = Math.round((COUNTY.accessoryHeight - m.heights.gableMidAbovePad) * 12);
  const kicker = m.truss.haunch(m.bracing.kickerLeg);
  return {
    width: String(m.width), length: String(m.length), footprint: `${m.width} × ${m.length} ft`, footprintPrime: `${m.width}′ × ${m.length}′`,
    footprintSqFt: n(m.slabSqFt),
    eave: String(m.eave), knuckle: String(m.knuckleZ), peak: String(m.peakZ),
    eaveAbovePad: feetInches(m.heights.eaveAbovePad), ridgeAbovePad: feetInches(m.heights.ridgeAbovePad), roofPeakAbovePad: feetInches(m.heights.roofPeakAbovePad),
    peakMarginIn: String(Math.round((COUNTY.poleBarn.peak - m.heights.roofPeakAbovePad) * 12)),
    peakOverGroundIn: String(Math.round((m.heights.roofPeakAbovePad + m.heights.avgFill - COUNTY.poleBarn.peak) * 12)),
    roofBuildIn: String(Math.round(m.roofBuild * 12)), avgFill: m.heights.avgFill.toFixed(1),
    gableMid: feetInches(m.heights.gableMidAbovePad), gableMidOldGround: feetInches(m.heights.gableMidAboveOldGround), gableAverage: m.heights.gableAvgAbovePad.toFixed(1),
    accessoryHeight: String(COUNTY.accessoryHeight), zoneHeight: String(COUNTY.zoneHeight), yardCap: n(COUNTY.frontYardSqFt),
    accessoryMarginIn: String(Math.abs(marginIn)),
    accessoryReading: marginIn >= 0 ? `under by ${marginIn}″` : `over by ${-marginIn}″`,
    slabSlope: Number.isInteger(m.length / 4) ? String(m.length / 4) : `${Math.floor(m.length / 4)}½`,
    windows: String(m.windows.length), windowsNorth: count('N'), windowsSouth: count('S'),
    windowSize: sideWindow ? `${sideWindow.width}′ × ${sideWindow.height}′` : '', windowSill: sideWindow ? `${sideWindow.sill}′` : '',
    loftWindowSize: loftWindow ? `${loftWindow.width}′ × ${loftWindow.height}′` : '',
    windowsLow: hundred(t.low - bare.totals.low), windowsHigh: hundred(t.high - bare.totals.high),
    lengthFoot: money(Math.round(perFoot / 10) * 10), lengthFootAllIn: hundred(perFootAllIn), materialsPerSqFt: money(Math.round(t.mid / m.floorSqFt)),
    floorSqFt: n(m.floorSqFt), loftSqFt: n(m.loftSqFt), loft7SqFt: n(Math.round(m.loft7SqFt / 10) * 10), loft7Gross: n(Math.round(m.loft7Width * m.length / 10) * 10),
    loft7Width: String(Math.round(m.loft7Width * 4) / 4),
    bays: m.bays.join('-'), bayCount: String(m.bays.length), postsPerSide: String(m.postX.length),
    posts: String(m.postCount), piers: String(m.pierCount), sidePosts: String(2 * m.postX.length), gablePosts: String(m.gableY.length),
    trusses: String(m.trussCount), commonTrusses: String(m.commonTrusses),
    ties: String(m.trussCount * 4), slabCuYd: n(m.concrete.slab), concreteCuYd: String(m.concrete.total),
    wallSqFt: n(Math.round(m.wallNet / 10) * 10), roofSqFt: n(Math.round(m.roofSqFt / 10) * 10),
    snow: String(m.loads.groundSnow), roofSnow: String(Math.round(m.roofSnowPsf)), wind: String(m.loads.wind), loftLive: String(m.loads.loftLive),
    footing: String(m.loads.footingInches), frostZone: String(m.loads.frostZoneInches),
    lowerAngle: String(Math.round(m.lowerAngle)), upperAngle: String(Math.round(m.upperAngle)), upperPitch: (Math.round(m.upperRise / m.upperRun * 120) / 10).toFixed(1),
    rvClearLoft: feetInches(m.rvClearLoft), rvClearDoor: feetInches(m.rvClearDoor),
    doorSize: `${m.mainDoor.width}′ × ${m.mainDoor.height}′`, doorHeight: String(m.mainDoor.height), doorWidth: String(m.mainDoor.width),
    doorSide: feetInches((m.mainDoor.width - m.rv.width) / 2), doorHeadroom: `${Math.round(m.doorHeadroom * 12)}″`, underLoft: feetInches(m.underLoft),
    rvSize: `${feetInches(m.rv.length)} × ${m.rv.width}′ × ${feetInches(m.rv.height)}`, rvHeight: feetInches(m.rv.height), rvWidth: `${m.rv.width}′`, rvLength: feetInches(m.rv.length),
    landingHeight: feetInches(m.landingZ), flight1Risers: String(m.flights[0].risers), flight2Risers: String(m.flights[1].risers),
    flight1Rise: feetInches(m.flights[0].rise), flight2Rise: feetInches(m.flights[1].rise), flight1Run: feetInches(m.flights[0].run), flight2Run: feetInches(m.flights[1].run),
    stairRisers: String(m.stairRisers), openingSize: `${m.loftOpening.width}′ × ${m.loftOpening.length}′`,
    postLength: String(m.postLength), siteBuildSaving: hundred(1500 * m.postLength / 20),
    girtRows: String(m.girts.rows.length), girtBoard: String(m.girts.board), girtEndBoard: String(m.girts.eastBoard), girtEastPiece: String(m.girts.eastPiece),
    girtBaseAbovePad: String(Math.round((m.padToFloor + m.girts.firstRow) * 12)), girtBuySide: String(m.girts.buy.side), girtBuyEast: String(m.girts.buy.east), girtBuyBase: String(m.girts.buy.base), strapFt: n(Math.round(m.girts.rows.length * m.perimeter / 10) * 10),
    hoistOut: feetInches(m.hoist.out), hoistInside: String(m.hoist.inside), hoistBeyondDeck: String(m.hoist.beyondDeck), hoistAbove: String(m.hoist.above), hoistLength: feetInches(m.hoistLength), hoistLift: String(m.hoistLift),
    braceLength: feetInches(m.hoistBraceLength), braceStock: String(2 * Math.ceil(m.hoistBraceLength / 2)),
    // the truss package
    trussSpacing: feetInches(m.trussSpacing), trussSpacingIn: String(m.trussSpacing * 12), trussChord: feetInchesQuarter(m.width - m.wall.post / 12), lastTruss: `T${m.trussCount}`,
    span: feetInches(m.width), halfSpan: feetInches(m.half), openingWide: feetInches(m.loftOpening.width),
    bottomChord: inches(m.chordInches), topChord: inches(m.topChordInches), floorDepth: inches(m.chordInches + m.decking), floorTop: feetInches(m.eave),
    knuckleRun: feetInches(m.knuckleRun), knuckleRise: feetInches(m.knuckleRise), upperRun: feetInches(m.upperRun), upperRise: feetInches(m.upperRise),
    ridgeRise: feetInches(m.peakZ - m.eave), lowerPitch: (Math.round(m.knuckleRise / m.knuckleRun * 120) / 10).toFixed(1),
    carrierWide: inches(m.carrier.wide), carrierTall: inches(m.carrier.tall), clearSpan: feetInchesQuarter(m.width - 2 * (m.wall.post / 24 + m.carrier.wide / 12)),
    eaveTail: feetInches(m.eaveTail), tailRun: inches(m.truss.tailRun * 12), exposure: m.loads.exposure,
    roomWidth: feetInches(m.width - 2 * m.knuckleRun), clearKnuckle: feetInches(m.truss.clearAt(m.knuckleRun)), clearRidge: feetInches(m.truss.clearAt(m.half)),
    chordDropKnuckle: inches((m.headroomAt(m.knuckleRun) - m.truss.clearAt(m.knuckleRun)) * 12), chordDropRidge: inches((m.headroomAt(m.half) - m.truss.clearAt(m.half)) * 12), rakeOverhang: feetInches(m.rakeOverhang),
    clear7Width: feetInches(m.truss.clearWidth(7)), clear5Width: feetInches(m.truss.clearWidth(5)),
    heelHeight: inches(m.eaveSection.heel.height), heelBlockWide: inches(m.heelBlock),
    webAt: feetInches(m.bracing.webAt), kickerLeg: feetInches(m.bracing.kickerLeg), kickerEdgeClear: feetInches(kicker.edgeClear), kickerWidth7: feetInches(kicker.width7),
    tieAt: feetInches(m.bracing.tieAt), tieLength: feetInches(m.truss.tie.length), tieFrom: feetInches(m.truss.tie.from), tieTo: feetInches(m.width - m.truss.tie.from), tieDeep: inches(m.bracing.tieDeep),
    tieTrusses: `T${m.specialTrusses.tied[0].number} to T${m.specialTrusses.tied[m.specialTrusses.tied.length - 1].number}`, tieCount: String(m.specialTrusses.tied.length),
    openingNorth: feetInches(m.loftOpening.fromNorth), openingSouth: feetInches(m.loftOpening.fromNorth + m.loftOpening.length),
    stairTrusses: `T${m.specialTrusses.stairEdge[0].number} to T${m.specialTrusses.stairEdge[m.specialTrusses.stairEdge.length - 1].number}`,
    stairCutTruss: m.specialTrusses.stairCut.map(t => `T${t.number}`).join(', '), stairCutX: m.specialTrusses.stairCut.map(t => feetInches(t.x)).join(', '),
    hoistTrusses: `T${m.specialTrusses.hoist[0].number} to T${m.specialTrusses.hoist[m.specialTrusses.hoist.length - 1].number}`, hoistTrussCount: String(m.specialTrusses.hoist.length),
    hoistStart: feetInches(m.length - m.hoist.inside), hoistHeight: feetInches(m.hoistZ), hoistGap: inches((m.truss.innerRidge[1] - (m.hoistZ + 0.25)) * 12),
    loftDoorRough: `${feetInches(m.loftDoor.width + 0.5)} × ${feetInches(m.loftDoor.height + 0.5)}`, loftDoorFrom: feetInches(m.loftDoorY0 - 0.25), loftDoorTo: feetInches(m.loftDoorY1 + 0.25),
    loftDoorOpenTo: feetInches(m.loftDoor.height + 0.5 + 9.25 / 12),
    loftWindowFrom: loftWindow ? feetInches(loftWindow.at - loftWindow.width / 2) : '', loftWindowTo: loftWindow ? feetInches(loftWindow.at + loftWindow.width / 2) : '',
    loftWindowSill: loftWindow ? `${loftWindow.sill - m.eave}′` : '',
    girtScrews: n(m.girts.screws), wallThickness: inches(m.wallInches), behindSheathing: inches(m.wall.sheathing + m.girts.thick + m.wall.post), girtTopRow: feetInches(m.girts.rows[m.girts.rows.length - 1].bottom),
    materialsLow: hundred(t.low), materialsHigh: hundred(t.high), budgetLow: hundred(b.budget.low.total), budgetMid: hundred(b.budget.likely.total), budgetHigh: hundred(b.budget.high.total)
  };
}

root.WorkshopModel = { DESIGN, COUNTY, SOURCES, BUDGET_EXTRAS, SALES_TAX, CONTINGENCY, create, bayLayout, bom, facts, n, money, inches, feetInches, feetInchesQuarter };
})(typeof window !== 'undefined' ? window : globalThis);
