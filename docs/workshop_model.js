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
  eave: 16,                  // top of the sidewalls, and the loft floor
  knuckleRun: 7,             // gambrel lower slope: 7 ft in from each sidewall...
  knuckleRise: 8,            // ...and 8 ft up
  upperRise: 4,              // upper slope: 4 ft up over the remaining 9 ft to the ridge
  bayMax: 8,                 // longest post spacing on the sidewalls
  trussSpacing: 2,
  eaveTail: 1,               // truss tail beyond the wall, measured along the slope
  rakeOverhang: 1,           // roof beyond each gable
  mainDoor: Object.freeze({ width: 14, height: 14 }),
  walkDoor: Object.freeze({ width: 3, height: 7, fromEast: 3 }),     // on the south wall; fromEast is its center's distance from the east wall
  loftDoor: Object.freeze({ width: 5, height: 6 }),                  // on the east gable, bottom at the loft floor
  // Windows: sliders in the sidewalls, centered in the listed bays (counted from the west end, 1 is the west end bay), and one single-hung in the
  // west gable at the loft. The south wall skips the first two bays (the stair is behind them) and the last (the walk door). Use null for none.
  // The bay numbers go with the six-bay layout of a 42 to 48 ft building: for another length, list bays that exist and are at least a foot wider than the window.
  windowSpec: Object.freeze({
    side: Object.freeze({ width: 4, height: 3, sill: 5, northBays: Object.freeze([2, 4, 6]), southBays: Object.freeze([3, 4, 5]) }),
    loft: Object.freeze({ width: 3, height: 4, sill: 3 })            // sill measured up from the loft floor
  }),
  deck: Object.freeze({ width: 14, depth: 10, rail: 3.5, posts: 4, joistSpacing: 1, postInset: 0.5 }),   // posts stand on the door-jamb lines, 6 in in from the deck's ends
  apron: Object.freeze({ width: 14, depth: 15 }),                    // the estimate uses 15 ft; the plan shows 10 to 20
  hoist: Object.freeze({ out: 3, inside: 9, above: 9 }),             // W6 beam: 3 ft out past the east wall, 9 ft in, centerline 9 ft above the loft floor
  stair: Object.freeze({ width: 4, run: 12, rise: 8, landing: 4, tread: 11 }),
  loftOpening: Object.freeze({ width: 4, length: 8, fromNorth: 16 }),
  rv: Object.freeze({ width: 9, length: 25, height: 11 + 10 / 12 }), // the camper: footprint from data/site.json, roof height from the owner
  pad: Object.freeze({ length: 56, width: 42 }),   // the graded pad that is already built (workshop_pad in data/site.json); the building is centered on it
  fill: Object.freeze({ north: 1.9, south: 0.75 }),   // imported fill on the pad, from the owner: almost 2 ft at the north edge, 6 in to 1 ft at the south edge
  slabInches: 5,
  pier: Object.freeze({ tubeInches: 18, padInches: 30, padThickInches: 12, depthInches: 60 }),
  chordInches: 9.25,         // truss bottom chord depth used for the clearance under the loft (the truss designer sets the real one)
  decking: 0.75,             // loft floor, inches
  loads: Object.freeze({ groundSnow: 120, wind: 115, exposure: 'C', loftLive: 40, frostZoneInches: 30, footingInches: 60, seismicZone: 'C' })
});

// Elmore County's limits that bear on the size and height (Title 7, chapter 2, as published in October 2026; see the overview page).
const COUNTY = Object.freeze({
  accessoryHeight: 24,       // an accessory structure: the principal dwelling's height or this, whichever is greater (7-2-42 D)
  zoneHeight: 35,            // Ag, Rec, and RR/MU districts (table 7-2-27 A); an agricultural structure in the Ag district may go to 80 ft
  agStructureHeight: 80,
  frontYardSqFt: 1500,       // an accessory structure in the front yard: this or half the house's footprint, whichever is less (7-2-42 C)
  characterSqFt: 1500        // from this size up, a residential-district front-yard accessory structure must portray the house's character (7-2-42 E)
});

const sum = list => list.reduce((total, value) => total + value, 0);
const n = value => Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 });
const money = value => '$' + n(value);
const feetInches = feet => {
  const whole = Math.floor(feet + 1e-9), inches = Math.round((feet - whole) * 12);
  return inches === 12 ? `${whole + 1}′-0″` : `${whole}′-${inches}″`;
};

// Interior sidewall bays at the longest spacing, and whatever is left over split between the two end bays (46 ft is 7-8-8-8-8-7; 48 ft is all 8s).
function bayLayout(length, bayMax) {
  const bays = Math.max(2, Math.ceil(length / bayMax));
  const end = (length - bayMax * (bays - 2)) / 2;
  return [end, ...new Array(bays - 2).fill(bayMax), end];
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
  const lowerLen = Math.hypot(d.knuckleRun, d.knuckleRise);
  const upperLen = Math.hypot(upperRun, d.upperRise);

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

  const stairRisers = Math.ceil(d.stair.rise * 12 / 7);
  const loft7 = usableWidth(7) * L - d.loftOpening.width * d.loftOpening.length;

  // How tall the building is by Elmore County's definition: from the average ground at the front (east) wall to the average height (mid-point) of the highest gable.
  // The floor stands one slab, foam, and gravel stack above the pad surface. The pad is fill over the original ground, and the front wall runs north to
  // south across the whole wedge, so the average fill under it is the mean of the north and south thicknesses. The mid-point is halfway between eave and
  // ridge; a gambrel gable is fuller than a triangle, so averaging its whole shape (gableAvgAbovePad) reads higher.
  const padToFloor = (d.slabInches + 8) / 12;
  const eaveAbovePad = d.eave + padToFloor, ridgeAbovePad = peakZ + padToFloor;
  const gableMidAbovePad = (eaveAbovePad + ridgeAbovePad) / 2;
  const gableAvgAbovePad = eaveAbovePad + gableAboveEave / W;
  const avgFill = (d.fill.north + d.fill.south) / 2;
  const heights = { padToFloor, eaveAbovePad, ridgeAbovePad, gableMidAbovePad, gableAvgAbovePad, avgFill, gableMidAboveOldGround: gableMidAbovePad + avgFill };

  return Object.freeze({
    ...d, overrides: Object.freeze({ ...overrides }), bays, half, upperRun, knuckleZ, peakZ, lowerLen, upperLen,
    lowerAngle: Math.atan2(d.knuckleRise, d.knuckleRun) * 180 / Math.PI,
    upperAngle: Math.atan2(d.upperRise, upperRun) * 180 / Math.PI,
    postX, gableY, doorY0, doorY1, pierCount, postCount: pierCount,
    trussX, trussCount, commonTrusses: trussCount - 2,
    walkX,
    windows, windowArea,
    padMarginX: (d.pad.length - L) / 2, padMarginY: (d.pad.width - W) / 2,
    padToFloor, heights,
    loftDoorY0: (W - d.loftDoor.width) / 2, loftDoorY1: (W + d.loftDoor.width) / 2,
    deckY0: doorY0, deckY1: doorY1,
    deckPosts: [d.deck.postInset, d.deck.depth - d.deck.postInset].flatMap(x => [doorY0, doorY1].map(y => [L + x, y])),
    hoistZ: d.eave + d.hoist.above, hoistLength: d.hoist.out + d.hoist.inside,
    perimeter, gableAboveEave, wallGross, openings, wallNet: wallGross - openings,
    rakeLength, roofSqFt, lowerSlopeSqFt, slabSqFt, slabCuYd, floorSqFt: slabSqFt, loftSqFt: slabSqFt,
    loft7SqFt: loft7, loft7Width: usableWidth(7), headroomAt, usableWidth,
    concrete, rebar, pierCuFt,
    stairRisers, stairTreads: Math.floor(d.stair.run * 12 / d.stair.tread),
    underLoft: d.eave - (d.chordInches + d.decking) / 12,
    rvClearDoor: d.mainDoor.height - d.rv.height,
    rvClearLoft: d.eave - (d.chordInches + d.decking) / 12 - d.rv.height,
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
  const sideWindows = m.windows.filter(w => !w.loft), loftWindows = m.windows.filter(w => w.loft);
  const windowFeet = sum(m.windows.map(w => 3 * w.width));   // two header pieces and a sill, each as wide as the window
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
      line('3-ply 2×8 SPF laminated PT column, 20 ft', m.postCount, 'ea', 280, 450, 'Q', 'Pre-fab laminated from Perma-Column, Mid-States, or local truss supplier. Alternative: site-build with 3-ply 2×8 #2 SPF (bottom 4 ft PT for splash), full glue + nail per ICC ESR. Cost-cut: site-build saves ~$1,500 but takes 2 days labor.'),
      line('Construction adhesive (PL Premium, if site-laminating)', 12, 'tube', 8, 12, 'HD', 'Only if site-fabricating posts.')
    ] },
    { num: 5, title: 'Pre-Engineered Gambrel Attic Trusses', items: [
      line(`Common gambrel attic truss, ${m.width}′ span, ${m.trussSpacing}′ OC, PE stamped (${snow} psf ground snow, ${m.loads.loftLive} psf loft floor)`, m.commonTrusses, 'ea', 450, 700, 'Q',
        `Quote 3 suppliers: Western Truss (Caldwell), BMC Truss (Boise), Builders FirstSource. State explicitly: ${snow} psf ground snow (county zone, confirm), ${wind} mph wind Exp ${m.loads.exposure}, ${m.loads.loftLive} psf loft LL, gambrel attic with finished room space. The unit price is a placeholder: a ${m.width} ft attic truss for a loft floor and this snow load will likely price above an ordinary roof truss.`),
      line('Gable-end truss (drop-in)', 2, 'ea', 300, 500, 'Q', 'Solid-faced for siding nailers; outlooks for gable overhang.'),
      line('Truss delivery + crane / boom truck', 1, 'trip', 400, 1000, 'Q', 'Long-bed delivery + boom set is faster & safer than rolling in by hand.'),
      line('Truss-clip hurricane ties (Simpson H2.5A, box of 100)', c(m.trussCount * 4 / 100), 'box', 85, 110, 'HD', `2 per truss bearing × ${m.trussCount} trusses × 2 sides = ${m.trussCount * 4} ties needed.`),
      line('Truss-set blocking (2×6 SPF, 8 ft)', r(25 * (m.trussCount - 1) / 22), 'stick', 7, 9, 'HD', 'Between trusses at heel + ridge for stability.'),
      line('Permanent lateral bracing per truss design', 1, 'lot', 200, 400, 'HD', '2×4 SPF + framing nails per truss-design BCSI sheets.')
    ], notes: [['warn', '<strong>Critical:</strong> truss order needs <strong>4–8 week lead time</strong>. Get the quote &amp; place the deposit BEFORE you start the foundation so trusses arrive ready when walls are up.']] },
    { num: 6, title: 'Wall Framing (Girts & Blocking)', items: [
      line('2×6×16 SPF #2 (girts, bookshelf orientation)', r(75 * perimeterRatio), 'stick', 13, 16, 'HD', `~1,200 lin ft net. 8 horizontal rows × ${m.perimeter} ft perimeter, minus door openings.`),
      line('2×6×8 SPF #2 (blocking, headers)', r(30 * perimeterRatio), 'stick', 7, 9, 'HD', 'For door jacks, headers, blocking, gable infill.'),
      ...(m.windows.length ? [line('2×6×8 SPF #2 (window headers and sills)', c(windowFeet / 8), 'stick', 7, 9, 'HD',
        `${m.windows.length} windows: cut the girts at each opening, double the header, and add a sill, about ${n(windowFeet)} lin ft. Windows sit between posts, so the posts carry the wall.`)] : []),
      line('(2) 2×10 LVL header, 18 ft (over 14×14 OH door)', 2, 'ea', 120, 200, 'HD', 'LP / GP LVL 1¾×9¼. Placeholder: the specs call for (3) 2×12 LVL or a steel beam sized by the engineer. Truss bearing above goes onto the LVL via post-jacks.'),
      line('(2) 2×10 LVL header, 8 ft (loft doors + walk door)', 2, 'ea', 60, 95, 'HD', 'Loft door header + walk door header.'),
      line('Simpson LUS26 or LUS28 girt hangers (box of 50)', 2, 'box', 60, 85, 'HD', 'Hang girts off posts where not notched.')
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
      line('14′ × 14′ insulated sectional OH door, wind-rated (Wayne Dalton 9100 / Clopay 4053)', 1, 'ea', 3500, 6500, 'Q', `Wind rated to ≥${wind} mph + insulated. Get installed quote — install is tricky for 14×14 with high-lift track to clear OH obstruction.`),
      line('LiftMaster 8500W jackshaft opener (wall-mount, side-mount)', 1, 'ea', 450, 650, 'SP', 'Wall-mount opener preserves ceiling space for high-lift track.'),
      line('3070 insulated steel walk door, pre-hung w/ frame', 1, 'ea', 400, 800, 'HD', '9-lite or solid. Heavy-duty lockset extra.'),
      line('5′ × 6′ double exterior insulated door (loft, hinged out OR sliding barn-door)', 1, 'set', 1200, 2200, 'Q', 'Spec: weather-sealed, locking from inside, opens fully clear for hoist. Custom shop door OR pair of 30″ exterior pre-hung.'),
      ...(sideWindows.length ? [line(`Insulated vinyl window, ${sideWindows[0].width}′ × ${sideWindows[0].height}′ slider, low-E, DP-30 or better, with jamb extensions`, sideWindows.length, 'ea', 260, 480, 'HD',
        `Nail-fin windows in the north and south walls, sill ${sideWindows[0].sill}′ above the floor. Ask for the design-pressure (DP) rating the engineer gives for ${wind} mph, and order jamb extensions for the 5½″ girt wall (about 6¾″ with the sheathing and furring).`)] : []),
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
      line('2×12×12 SPF #1 (stringers)', 6, 'stick', 40, 55, 'HD', '3 stringers per flight × 2 flights.'),
      line('2×10×12 SPF (treads or sub-treads)', 14, 'stick', 22, 30, 'HD', `2 treads per stick. ~${2 * m.stairTreads + 2} treads total.`),
      line('2×4×8 SPF (handrail + landing frame)', 10, 'stick', 4, 6, 'HD', '—'),
      line('Pre-fab oak/poplar handrail + balusters (kit)', 1, 'kit', 200, 400, 'HD', 'Optional — code requires graspable handrail 34–38″ above nosing.'),
      line('LSC stringer connectors + joist hangers', 1, 'lot', 60, 100, 'HD', 'Simpson LSC adjustable stringer connector.')
    ] },
    { num: 16, title: `Landing Deck (${m.deck.width}′ × ${m.deck.depth}′, free-standing)`, items: [
      line('6×6×16 PT posts (deck legs, full height to ground)', m.deck.posts, 'stick', 55, 75, 'HD', '6×6 for lateral stability: the deck is 16 ft tall, so it needs the bigger leg.'),
      line('2×10×16 PT (beams & outer joists)', 4, 'stick', 30, 38, 'HD', 'Two doubled beams east-west on the post lines.'),
      line(`2×10×${m.deck.width} PT (joists @ 12″ OC)`, 10, 'stick', 25, 32, 'HD', 'Run north-south between the beams. Tighter spacing for snow load.'),
      line('5/4×6×12 PT decking', 26, 'stick', 10, 14, 'HD', `${m.deck.width * m.deck.depth} sq ft + waste. Alt: composite for ~3× cost.`),
      line('2×6×8 PT (diagonal knee-braces, 4 needed)', 4, 'stick', 8, 11, 'HD', 'Critical for lateral stability — a 16 ft tall deck WILL sway without these.'),
      line('2×4×8 PT (railing top + bottom + balusters)', 30, 'stick', 4, 6, 'HD', '42″ railing required for fall protection > 30″.'),
      line('Simpson joist hangers (LUS210, box of 25)', 1, 'box', 60, 85, 'HD', 'HDG for PT contact.'),
      line('Simpson hurricane ties for beam-to-post (H1)', 8, 'ea', 3, 5, 'HD', '—'),
      line('HDG structural screws (Headlok / GRK RSS, 4½″, 100 ct)', 2, 'box', 45, 65, 'HD', 'For beam to post connections.'),
      line('HDG #9 × 3″ deck screws (5 lb box)', 2, 'box', 35, 50, 'HD', 'Camo or face screws.'),
      line('Flashing and sealer at the wall', 1, 'lot', 60, 100, 'HD', 'The deck stands free of the wall (no ledger), so this is only for a brace tie-in if the engineer wants one.')
    ] },
    { num: 17, title: 'Hoist Beam & Trolley', items: [
      line('W6×9 or W6×12 steel I-beam, 12 ft (rated for 1,000 lb capacity)', 1, 'ea', 180, 280, 'SP', `Local steel yard (Idaho Steel Boise / Triumph Steel). About ${m.hoist.inside} ft inside + ${m.hoist.out} ft out past the wall.`),
      line('Beam trolley (1-ton capacity, fits W6 flange)', 1, 'ea', 60, 120, 'SP', 'Harbor Freight, Northern Tool, Grainger.'),
      line('Chain fall hoist (1-ton, 10 ft lift)', 1, 'ea', 80, 200, 'SP', '—'),
      line('Beam end-stop hardware (welded angles or bolt-on)', 1, 'lot', 30, 60, 'SP', 'Prevent trolley falling off the end.'),
      line('EPDM weather boot / flashing for beam penetration', 1, 'ea', 40, 80, 'HD', 'Custom-made from flat EPDM + butyl tape. CRITICAL detail.'),
      line('Anchor plate / bolt-through hardware (beam to truss)', 1, 'lot', 50, 120, 'HD', 'Coordinate with truss engineer for attachment.'),
      line('Blocking (2×6 + 2×8 between trusses to spread beam load)', 1, 'lot', 40, 80, 'HD', '—')
    ], notes: [['warn', '<strong>Engineering check:</strong> have the truss manufacturer review the hoist-beam attachment. A cantilevered beam with 1,000 lb at the tip creates a serious uplift load on the truss top chord. The truss may need an extra ply at that location or a reinforced web.']] },
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
      line('R-49 blown-in cellulose for upper loft ceiling (above flat upper-truss tie)', 1, 'lot', 500, 900, 'SP', 'Trusses commonly have a flat tie above loft creating an attic; blow cellulose on top.'),
      line('6 mil poly vapor barrier (interior side of walls)', 2, 'roll', 80, 120, 'HD', 'Cold-climate zone 6B. Verify with builder — kraft-face on batts may suffice.'),
      line('Interior finish — ½″ OSB or T1-11 (full shop interior)', r(60 * perimeterRatio), 'sheet', 18, 30, 'HD', 'Far more abuse-resistant than drywall in a shop. Alt: skip for now, install later.')
    ], notes: [['tip', '<strong>Phasing tip:</strong> build the shell first, conditioned later. The rainscreen + ½″ OSB sheathing makes the shell fully weather-tight even with no insulation or interior finish. Move in equipment, work in it for a winter, decide which areas need heat — then phase in mini-split + insulation only where you actually use it.']] },
    { num: 21, title: 'Fasteners & Miscellaneous Hardware', items: [
      line('16d common nails (50 lb box)', 1, 'box', 65, 90, 'HD', 'For framing.'),
      line('Bag of 1¾″ × 0.131 framing-nailer ring-shank coils', 2, 'box', 80, 120, 'HD', 'If using gun.'),
      line('3″ structural screws (Headlok, 100 ct)', 3, 'box', 50, 75, 'HD', 'Post-to-post, post-to-girt, etc.'),
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
  return {
    width: String(m.width), length: String(m.length), footprint: `${m.width} × ${m.length} ft`, footprintPrime: `${m.width}′ × ${m.length}′`,
    footprintSqFt: n(m.slabSqFt),
    eave: String(m.eave), knuckle: String(m.knuckleZ), peak: String(m.peakZ),
    eaveAbovePad: feetInches(m.heights.eaveAbovePad), ridgeAbovePad: feetInches(m.heights.ridgeAbovePad),
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
    lowerAngle: String(Math.round(m.lowerAngle)), upperAngle: String(Math.round(m.upperAngle)),
    rvClearLoft: feetInches(m.rvClearLoft), rvClearDoor: feetInches(m.rvClearDoor),
    materialsLow: hundred(t.low), materialsHigh: hundred(t.high), budgetLow: hundred(b.budget.low.total), budgetMid: hundred(b.budget.likely.total), budgetHigh: hundred(b.budget.high.total)
  };
}

root.WorkshopModel = { DESIGN, COUNTY, SOURCES, BUDGET_EXTRAS, SALES_TAX, CONTINGENCY, create, bayLayout, bom, facts, n, money, feetInches };
})(typeof window !== 'undefined' ? window : globalThis);
