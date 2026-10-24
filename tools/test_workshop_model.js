const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const read = file => fs.readFileSync(file, 'utf8');
const readJson = file => JSON.parse(read(path.join(ROOT, file)));
// Arrays built inside the vm context have another realm's prototype, which strict deepEqual rejects.
const plain = value => JSON.parse(JSON.stringify(value));

// One browser-like context with the model, the drawings, and the site grid loaded, as a workshop page loads them.
const context = vm.createContext({ window: {} });
for (const file of ['workshop_model.js', 'workshop_draw.js', 'workshop_elevations.js', 'workshop_3d.js', 'workshop_sections.js', 'workshop_details.js', 'workshop_trusses.js', 'workshop_site.js',
  'data/site_grid.js', 'data/site_terrain.js', 'workshop_page.js']) vm.runInContext(read(path.join(DOCS, file)), context, { filename: file });
const { WorkshopModel: M, WorkshopDraw: D, WorkshopPage: P, SiteGrid } = context.window;
const model = M.create();
// A 44 ft building without windows: the length and layout of the owner's original estimate, used to check the bill-of-materials arithmetic.
const reference = M.create({ length: 44, windowSpec: null });

const PAGES = ['workshop_pole_barn.html', 'workshop_specs.html', 'workshop_plans.html', 'workshop_sections.html', 'workshop_trusses.html', 'workshop_materials.html'];
const FIGURES = ['floorPlan', 'loftPlan', 'eastElevation', 'westElevation', 'northElevation', 'southElevation', 'sidewallFraming', 'endwallFraming', 'framing3dSoutheast', 'framing3dNorthwest', 'sectionA', 'sectionB', 'foundationPlan', 'loftFramingPlan',
  'detail1', 'detail2', 'detail3', 'detail4', 'detail5', 'detail5Perspective', 'detail6', 'detail7', 'trussProfile', 'trussOptions', 'trussLayout', 'sitePlan'];

test('The workshop is 32 x 48 ft with six 8 ft sidewall bays and 19 piers', () => {
  assert.equal(model.width, 32);
  assert.equal(model.length, 48);
  assert.deepEqual(plain(model.bays), [8, 8, 8, 8, 8, 8]);
  assert.deepEqual(plain(model.postX), [0, 8, 16, 24, 32, 40, 48]);
  assert.equal(model.pierCount, 19);
  assert.equal(2 * model.postX.length + model.gableY.length + 2, 19);
  assert.deepEqual(plain(model.gableY), [8, 16, 24]);
  assert.equal(model.trussCount, 25);
  assert.equal(model.commonTrusses, 23);
  assert.equal(model.slabSqFt, 1536);
  assert.equal(model.eave, 14);
  assert.equal(model.peakZ, 24.5);
  assert.equal(model.knuckleZ, 22);
});

test('The same design at 44 ft has a 6-8-8-8-8-6 layout and 23 trusses', () => {
  assert.deepEqual(plain(reference.bays), [6, 8, 8, 8, 8, 6]);
  assert.equal(reference.pierCount, 19);
  assert.equal(reference.trussCount, 23);
  assert.equal(reference.slabSqFt, 1408);
  assert.equal(reference.concrete.total, 38);
  assert.equal(reference.trussCount * 4, 92);
  assert.deepEqual(plain(reference.windows), []);
});

test('At 46 ft the end bays are 7 ft and the interior bays are 8 ft', () => {
  const short = M.create({ length: 46 });
  assert.deepEqual(plain(short.bays), [7, 8, 8, 8, 8, 7]);
  assert.equal(short.trussCount, 24);
  assert.equal(short.pierCount, 19);
});

test('Bays must add up to the length and stay within the longest spacing', () => {
  assert.throws(() => M.create({ bays: [7, 8, 8, 8, 8, 8] }), /add up/);
  assert.throws(() => M.create({ bays: [24, 24] }), /longer than/);
  for (const length of [40, 44, 46, 48, 50]) assert.equal(M.create({ length, windowSpec: null }).bays.reduce((a, b) => a + b, 0), length);
});

test('The gambrel geometry: 49 and 16 degree slopes, 10½ ft of room at the ridge', () => {
  assert.ok(Math.abs(model.lowerAngle - 48.8) < 0.1);
  assert.ok(Math.abs(model.upperAngle - 15.5) < 0.1);
  assert.ok(Math.abs(Math.tan(model.upperAngle * Math.PI / 180) * 12 - 10 / 3) < 1e-9, 'the upper slope is 3⅓ in 12, above the 3 in 12 that exposed-fastener steel needs');
  assert.equal(model.headroomAt(7), 8);
  assert.equal(model.headroomAt(16), 10.5);
  assert.ok(Math.abs(model.usableWidth(7) - 19.75) < 1e-9);
});

test('The first story is sized for the camper: a 12 ft door under a 14 ft eave, and a roof under the county\'s 27 ft', () => {
  const rv = model.rv, doorHeight = model.mainDoor.height, poleBarn = M.COUNTY.poleBarn;
  // the listed size of the 2024 Rockwood Mini Lite 2517S: 25'-11" long, 8' wide, 10'-11" high
  assert.ok(Math.abs(rv.length - (25 + 11 / 12)) < 1e-9 && rv.width === 8 && Math.abs(rv.height - (10 + 11 / 12)) < 1e-9);
  assert.ok(model.rvClearDoor >= 1 && Math.abs(model.rvClearDoor - 13 / 12) < 1e-9, 'the door clears the camper by at least a foot');
  assert.ok(model.mainDoor.width >= rv.width + 4 && (model.mainDoor.width - rv.width) / 2 === 3, 'a door 4 ft wider than the camper, 3 ft each side at 14 ft');
  // the track needs the door head to clear the underside of the loft floor by 12 in (low headroom), and the header sits in that space
  assert.ok(Math.abs(model.underLoft - (14 - 10 / 12)) < 1e-9);
  assert.ok(Math.abs(model.doorHeadroom * 12 - 14) < 1e-9 && model.doorHeadroom * 12 >= 12);
  assert.ok(Math.abs(model.rvClearLoft - (model.underLoft - rv.height)) < 1e-9 && model.rvClearLoft > 2);
  // the county's pole barn guide: a side wall of 14 ft at most (from the floor) and a peak of 27 ft at most, from the pad as well
  assert.deepEqual(plain(poleBarn), { wall: 14, peak: 27, maxWidth: 50, maxLength: 80, ratio: 5 / 3, poleSpacing: 10, doorWall: 8, snow: 30, wind: 115 });
  assert.ok(model.eave <= poleBarn.wall);
  // the peak counts the purlins, deck, steel, and ridge cap on top of the trusses, and is measured from the pad: 8 in under the limit
  assert.ok(Math.abs(poleBarn.peak - model.heights.roofPeakAbovePad - 8 / 12) < 1e-9);
  assert.ok(Math.abs(model.heights.roofPeakAbovePad - model.heights.ridgeAbovePad - model.roofBuild) < 1e-9);
  // the overview says it would be over from the original ground, and that the upper slope is flat: keep those sentences true
  assert.ok(model.heights.roofPeakAbovePad + model.heights.avgFill > poleBarn.peak, 'from the original ground the peak is over 27 ft, which the overview says');
  assert.ok(model.heights.eaveAbovePad > poleBarn.wall && model.eave <= poleBarn.wall, 'the wall is 14 ft from the floor and more from the pad, which the table says');
  assert.ok(model.upperRise / model.upperRun * 12 >= 3, 'the upper slope is at least 3 in 12');
  const facts = M.facts(model);
  assert.deepEqual([facts.peakMarginIn, facts.peakOverGroundIn, facts.roofBuildIn, facts.avgFill, facts.upperPitch, facts.upperAngle], ['8', '8', '9', '1.3', '3.3', '16']);
  assert.ok(model.bayMax <= poleBarn.poleSpacing);
  assert.ok(model.loads.groundSnow > poleBarn.snow, 'at 120 psf the guide, which is for 30 psf, does not apply, which the pages say');
  // a taller door does not fit under this loft floor, and a taller eave leaves room for it
  assert.throws(() => M.create({ mainDoor: { width: 14, height: 14 } }), /do not fit under a loft floor/);
  assert.doesNotThrow(() => M.create({ eave: 16, mainDoor: { width: 14, height: 14 } }));
  assert.equal(M.create({ mainDoor: { width: 12, height: 12 } }).doorY0, 10);
  assert.equal(doorHeight, 12);
});

test('The stair keeps its headroom: the landing stands as high as the loft floor allows, and the opening covers the whole second flight', () => {
  const stair = model.stair, [first, second] = model.flights;
  assert.equal(model.stairRisers, 24);
  assert.equal(model.riserIn, 7);
  assert.deepEqual([first.risers, second.risers], [11, 13]);
  assert.deepEqual([first.treads, second.treads], [10, 12]);
  assert.equal(first.risers + second.risers, model.stairRisers);
  assert.ok(Math.abs(first.rise + second.rise - model.eave) < 1e-9, 'the two flights climb to the loft floor');
  assert.ok(Math.abs(model.landingZ - 77 / 12) < 1e-9);
  assert.equal(model.stairTreads, 22);
  // 6'-8" of headroom at the landing; one more riser in the first flight would take it below that
  const headroom = z => (model.underLoft - z) * 12;
  assert.ok(headroom(model.landingZ) >= stair.headroom);
  assert.ok(headroom(model.landingZ + model.riserIn / 12) < stair.headroom, 'the landing is as high as the headroom allows');
  // a stair under a floor needs the floor open wherever the nosings are within 6'-8" of it: the opening is the whole second flight
  assert.deepEqual(plain(model.loftOpening), { width: 4, length: 11, fromNorth: 17 });
  assert.equal(model.loftOpening.fromNorth + model.loftOpening.length, model.width - stair.landing);
  assert.ok(Math.abs(second.run - model.loftOpening.length) < 1e-9);
  assert.ok(first.run + stair.landing <= model.postX[2], 'the first flight stays behind the first two bays, where the south wall has no windows');
  for (const w of model.windows.filter(item => item.wall === 'S')) assert.ok(w.at - w.width / 2 > first.run + stair.landing, 'no south window sits over the first flight');
  // the zone with 7 ft of headroom loses only the part of the opening that falls inside it
  const zone0 = model.width / 2 - model.usableWidth(7) / 2, zone1 = model.width / 2 + model.usableWidth(7) / 2;
  const lost = model.loftOpening.width * (Math.min(model.loftOpening.fromNorth + model.loftOpening.length, zone1) - Math.max(model.loftOpening.fromNorth, zone0));
  assert.ok(Math.abs(model.loft7SqFt - (model.usableWidth(7) * model.length - lost)) < 1e-9);
  assert.throws(() => M.create({ eave: 8, windowSpec: null, mainDoor: { width: 14, height: 6 } }), /cannot keep 80 in of headroom/);
});

test('The design values agree with the site data and the county values', () => {
  const site = readJson('data/site.json');
  const feature = id => site.features.find(item => item.id === id);
  const shop = feature('workshop'), pad = feature('workshop_pad');
  assert.equal(shop.x1 - shop.x0, model.length, 'data/site.json must have the workshop as long as the model says');
  assert.equal(shop.y1 - shop.y0, model.width);
  assert.equal(pad.x1 - pad.x0, 56);
  assert.equal(pad.y1 - pad.y0, 42);
  // the building is centered on the pad: 4 ft left at each end and 5 ft along the long sides
  assert.equal(shop.x0 - pad.x0, model.padMarginX);
  assert.equal(pad.x1 - shop.x1, model.padMarginX);
  assert.equal(shop.y0 - pad.y0, model.padMarginY);
  assert.equal(pad.y1 - shop.y1, model.padMarginY);
  assert.deepEqual([model.padMarginX, model.padMarginY], [4, 5]);
  const baselines = readJson('data/site_baselines.json');
  const county = id => baselines.building.values.find(item => item.id === id).value;
  assert.equal(county('ground-snow-load'), model.loads.groundSnow);
  assert.equal(county('wind-speed'), model.loads.wind);
  assert.equal(county('frost-depth'), model.loads.frostZoneInches);
  assert.equal(county('seismic-zone'), model.loads.seismicZone);
  assert.equal(model.loads.footingInches, 2 * model.loads.frostZoneInches, 'the footing is 30 in below the frost line, which is 60 in from grade');
});

test('Every bill-of-materials line is its quantity times its price, and the totals add up', () => {
  const bom = M.bom(model);
  assert.equal(bom.phases.length, 21);
  assert.equal(bom.lineCount, 131);
  let low = 0, high = 0;
  for (const phase of bom.phases) {
    let phaseLow = 0, phaseHigh = 0;
    for (const item of phase.items) {
      assert.ok(Number.isFinite(item.qty) && item.qty > 0, `${item.item} needs a positive quantity`);
      assert.ok(item.low > 0 && item.high >= item.low, `${item.item} needs a price range`);
      assert.ok(M.SOURCES[item.src], `${item.item} needs a known source code`);
      const expectLow = item.lump ? item.lump[0] : item.qty * item.low, expectHigh = item.lump ? item.lump[1] : item.qty * item.high;
      assert.ok(Math.abs(item.totalLow - expectLow) < 0.01 && Math.abs(item.totalHigh - expectHigh) < 0.01, item.item);
      phaseLow += item.totalLow; phaseHigh += item.totalHigh;
    }
    assert.ok(Math.abs(phase.low - phaseLow) < 0.01 && Math.abs(phase.high - phaseHigh) < 0.01, phase.title);
    low += phase.low; high += phase.high;
  }
  assert.ok(Math.abs(bom.totals.low - low) < 0.01 && Math.abs(bom.totals.high - high) < 0.01);
  assert.ok(Math.abs(bom.totals.mid - (low + high) / 2) < 0.01);
  for (const key of ['low', 'likely', 'high']) {
    const b = bom.budget[key];
    const expected = (b.materials + b.tax + b.extras.reduce((a, c) => a + c, 0)) * (1 + M.CONTINGENCY);
    assert.ok(Math.abs(b.total - expected) < 0.01, key);
  }
});

test('The bill of materials follows the 14 ft first story: shorter posts, fewer girts, a 14 by 12 door, and stringers cut for the two flights', () => {
  const bom = M.bom(model), item = (phase, text) => bom.phases.find(p => p.num === phase).items.find(i => i.item.includes(text));
  const post = item(4, 'laminated');
  assert.match(post.item, /16 ft/);
  assert.deepEqual([post.low, post.high], [224, 360], 'a 16 ft post is priced at 16/20 of the 20 ft post');
  assert.equal(M.create({ eave: 16, mainDoor: { width: 14, height: 14 } }).postLength, 18);
  assert.equal(item(6, 'girts').qty, 48);
  assert.match(item(6, 'girts').notes, /6 rows above the base girt at 24″ OC/);
  assert.equal(item(6, 'east wall girts').qty, 6);
  assert.equal(item(6, 'base girts').qty, 10);
  assert.match(item(6, 'base girts').item, /2×6×16 PT/);
  assert.equal(item(6, 'structural screws').qty, 5);
  assert.equal(bom.phases.find(p => p.num === 6).items.some(i => /hanger/i.test(i.item)), false, 'the girts are screwed to the posts, so there are no girt hangers');
  assert.match(item(6, 'LVL header, 18').item, /14×12 OH door/);
  assert.match(item(13, 'sectional').item, /14′ × 12′ insulated sectional OH door, wind-rated, low-headroom track/);
  assert.match(item(13, 'sectional').notes, /clears it by 13 in/);
  assert.match(item(13, 'sectional').notes, /14 in above the door/);
  assert.match(item(15, 'first flight').item, /2×12×12 /);
  assert.match(item(15, 'second flight').item, /2×12×14 /);
  assert.deepEqual([item(15, 'first flight').low, item(15, 'second flight').low], [40, 47]);
  assert.equal(item(15, 'treads').qty, 12);
  assert.match(item(15, 'treads').notes, /24 treads/);
  assert.match(item(16, 'knee-braces').notes, /14 ft tall deck/);
  assert.match(item(16, 'deck legs').notes, /cut to about 14 ft/);
  assert.equal(M.bom(model).phases.find(p => p.num === 15).items.length, 6);
});

test('The girts are 2×6s laid flat on the posts: rows 2 ft apart, boards that end on posts, and joints that never line up in neighboring rows', () => {
  const g = model.girts;
  assert.deepEqual(plain(g.rows.map(row => row.role)), ['base', 'girt', 'girt', 'girt', 'girt', 'girt', 'girt']);
  assert.deepEqual(plain(g.rows.map(row => row.bottom)), [0, 2, 4, 6, 8, 10, 12], 'rows 24 in OC, with their bottom edges on even feet from the floor line');
  assert.ok(g.rows.every(row => Math.abs(row.top - row.bottom - 5.5 / 12) < 1e-9), 'a 2×6 laid flat shows 5½ in');
  assert.ok(model.eave - g.rows[g.rows.length - 1].top < 2, 'the highest row is less than 2 ft below the eave');
  assert.equal(M.facts(model).girtBaseAbovePad, '13', 'the base girt, at the floor line, is 13 in above the pad');
  for (const [key, wall] of Object.entries(g.walls)) {
    wall.rows.forEach((framed, i) => {
      framed.boards.forEach(board => {
        assert.ok(wall.posts.includes(board.a) && wall.posts.includes(board.b), `${key} row ${i}: a board must start and end on a post`);
        assert.ok(board.length <= g.board + 1e-9, `${key} row ${i}: a board is longer than ${g.board} ft`);
      });
      framed.joints.forEach(joint => assert.ok(wall.posts.includes(joint), `${key} row ${i}: a joint is off the posts`));
      const next = wall.rows[i + 1];
      if (next) assert.deepEqual(plain(framed.joints.filter(joint => next.joints.includes(joint))), [], `${key}: rows ${i} and ${i + 1} are joined over the same post`);
    });
  }
  const lengths = key => plain(g.walls[key].rows.map(framed => framed.boards.map(board => board.length)));
  const A = [16, 16, 16], B = [8, 16, 16, 8];
  assert.deepEqual(lengths('N'), [A, B, A, B, A, B, A]);
  assert.deepEqual(lengths('S'), lengths('N'));
  assert.deepEqual(lengths('W'), [[16, 16], [8, 16, 8], [16, 16], [8, 16, 8], [16, 16], [8, 16, 8], [16, 16]]);
  assert.deepEqual(lengths('E'), new Array(7).fill([9, 9]), 'the door jambs leave a 9 ft run on each side of the door in every row');
  assert.deepEqual(plain(g.walls.N.rows.map(framed => framed.joints)), [[16, 32], [8, 24, 40], [16, 32], [8, 24, 40], [16, 32], [8, 24, 40], [16, 32]]);
  // the openings cut the rows they cross: the 6′ row at a window, the first four rows at the walk door, every row at the east door
  const opening = (key, kind) => g.walls[key].openings.filter(o => o.kind === kind);
  assert.equal(opening('N', 'window').length, 3);
  assert.equal(opening('S', 'window').length, 3);
  for (const o of [...opening('N', 'window'), ...opening('S', 'window')]) assert.deepEqual(plain(o.rows), [3], 'a window at 5′ to 8′ cuts only the 6′ row');
  assert.deepEqual(plain(opening('S', 'walk door')[0].rows), [0, 1, 2, 3]);
  assert.deepEqual(plain(opening('E', 'main door')[0].rows), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(plain(g.walls.N.rows[3].boards.map(board => board.pieces.length)), [1, 2, 2, 2], 'each window cuts the board it crosses in two');
  assert.deepEqual(plain(g.walls.S.rows[0].boards[2].pieces), [{ a: 32, b: 43.5 }, { a: 46.5, b: 48 }], 'the base girt stops at the walk door');
});

test('Sixteen foot boards use the whole stick on 8 ft posts, and the east wall takes 18 ft boards cut in half', () => {
  const g = model.girts, wasteOf = layout => {
    const used = ['N', 'S', 'W'].reduce((total, key) => total + layout.walls[key].rows.slice(1).reduce((t, framed) => t + framed.boards.reduce((s, board) => s + board.length, 0), 0), 0);
    return layout.buy.side * layout.board - used;
  };
  assert.deepEqual(plain(g.buy), { side: 48, east: 6, base: 10 });
  assert.equal(g.eastBoard, 18);
  assert.equal(g.eastPiece, 9);
  assert.equal(wasteOf(g), 0, 'the sidewall and west boards are used end to end');
  const east = g.walls.E.rows.slice(1).reduce((total, framed) => total + framed.boards.length, 0);
  assert.equal(east, 2 * g.buy.east, 'two 9 ft pieces from each 18 ft board');
  assert.equal(g.screws, 457);
  // an 18 ft board on the sidewalls would end 2 ft past a post, so each one is cut down to 16 ft and loses 2 ft
  const eighteen = M.create({ girts: { ...M.DESIGN.girts, board: 18 } });
  assert.ok(wasteOf(eighteen.girts) > 0, 'an 18 ft stick wastes wood on 8 ft posts');
  assert.ok(Math.max(...['N', 'S', 'W'].flatMap(key => eighteen.girts.walls[key].rows.flatMap(framed => framed.boards.map(board => board.length)))) <= 16);
  // the layout follows the length, and the joints still stay off each other at 44 and 46 ft
  for (const length of [44, 46, 48]) {
    const layout = M.create({ length }).girts;
    for (const key of ['N', 'S', 'W', 'E']) layout.walls[key].rows.forEach((framed, i, rows) => {
      if (rows[i + 1]) assert.deepEqual(plain(framed.joints.filter(joint => rows[i + 1].joints.includes(joint))), [], `${length} ft, ${key}: neighboring rows share a joint post`);
    });
    assert.equal(layout.buy.base, 10);
  }
  assert.equal(M.create({ length: 44 }).girts.buy.side, 48);
});

test('The wall framing sheets draw every row, joint, and opening of the layout', () => {
  const count = (text, pattern) => (text.match(pattern) || []).length;
  const joints = keys => keys.reduce((total, key) => total + model.girts.walls[key].rows.reduce((t, framed) => t + framed.joints.length, 0), 0);
  assert.equal(joints(['N']), 17);
  const sides = D.sidewallFraming(model), ends = D.endwallFraming(model);
  // one tick in the key besides the ticks on the walls
  assert.equal(count(sides, /class="l-joint"/g), joints(['N', 'S']) + 1);
  assert.equal(count(ends, /class="l-joint"/g), joints(['W', 'E']) + 1);
  // base girts: three pieces on the north wall and four on the south (the walk door cuts one), two on each end wall, and one swatch in the key;
  // splash boards: one piece on the north and west walls and two where a door interrupts it (south and east)
  assert.equal(count(sides, /class="c-ptwood"/g), (3 + 4) + (1 + 2) + 1);
  assert.equal(count(ends, /class="c-ptwood"/g), (2 + 2) + (1 + 2) + 1);
  // three windows on each sidewall and the walk door, the main door, and one swatch in the key
  assert.equal(count(sides, /class="c-opening"/g), 3 + 3 + 1 + 1);
  assert.equal(count(ends, /class="c-opening"/g), 1 + 1);
  assert.equal(count(D.sidewallFraming(M.create({ windowSpec: null })), /class="c-opening"/g), 1 + 1, 'without windows only the walk door is cut');
  for (const text of [sides, ends]) {
    assert.match(text, />16</, 'the girt marker');
    assert.doesNotMatch(text, /c-winframe|c-winplan/, 'the framing sheets show openings, not window units');
  }
  assert.match(sides, />12′-0″</);
  assert.match(sides, />base girt</);
  assert.match(sides, />splash board</);
  assert.match(ends, /18′|>9′</);
});

test('The girts are outside the posts, so the pages say the inside needs strapping and the estimate does not price it', () => {
  const overview = read(path.join(DOCS, 'workshop_pole_barn.html'));
  assert.match(overview, /How will the inside walls be insulated and finished\?/);
  assert.match(overview, /<span data-m="strapFt">1,120<\/span> ft/);
  assert.equal(M.facts(model).strapFt, '1,120', '7 rows around the 160 ft perimeter');
  const finish = M.bom(model).phases.find(p => p.num === 20).items.find(i => /Interior finish/.test(i.item));
  assert.match(finish.notes, /strapping across the posts, which this list does not price/);
  const specs = read(path.join(DOCS, 'workshop_specs.html'));
  assert.match(specs, /laid flat on the outside face of the posts/);
  assert.doesNotMatch(specs + overview, /bookshelf|girt hangers|hung or notched/i);
});

test('The hoist beam reaches past the deck\'s outer edge and is braced to the deck\'s outer corners', () => {
  const h = model.hoist, tip = model.length + h.out;
  assert.deepEqual([model.deckX0, model.deckX1], [48.5, 58.5], 'the free-standing deck starts 6 in out from the wall line');
  assert.deepEqual(plain(model.deckPosts), [[49, 9], [49, 23], [58, 9], [58, 23]]);
  assert.equal(h.out, 12.5);
  assert.equal(model.hoistLength, 21.5);
  assert.equal(tip - model.deckX1, 2, 'the tip is 2 ft past the deck\'s outer edge');
  assert.ok(model.hoistHookX >= model.deckX1 + 1.25 && model.hoistHookX < tip, 'the hook hangs at least 1¼ ft clear of the deck, in from the tip');
  assert.equal(model.hoistLift, 25, 'the hook runs from the pad up to the beam');
  assert.equal(model.hoistBraces.length, 2);
  model.hoistBraces.forEach((brace, i) => {
    assert.deepEqual(plain(brace.tip), [tip, model.half, model.hoistZ - 0.25], 'both braces meet under the beam\'s tip');
    assert.equal(brace.foot[1], [model.deckY0, model.deckY1][i], 'one brace at each outer deck corner');
    assert.ok(brace.foot[0] > model.deckX1 && brace.foot[0] < tip, 'the foot is just outside the deck\'s edge');
    assert.ok(brace.length > 11.5 && brace.length <= 12, `a 12 ft 6×6 cuts each brace (${brace.length})`);
    // above the deck, the brace stays outside the rail, and the two stand 4 ft apart where a hanging load's top reaches
    const at = z => (z - brace.foot[2]) / (brace.tip[2] - brace.foot[2]);
    assert.ok(brace.foot[0] + at(model.eave + model.deck.rail) * (tip - brace.foot[0]) > model.deckX1, 'the brace clears the rail');
  });
  const [a, b] = model.hoistBraces, gap = z => Math.abs(a.foot[1] - b.foot[1]) * (1 - (z - a.foot[2]) / (a.tip[2] - a.foot[2]));
  assert.ok(gap(20) >= 4, `${gap(20)} ft between the braces at 20 ft`);
  assert.equal(M.facts(model).hoistOut, '12′-6″');
  assert.equal(M.facts(model).braceLength, '11′-9″');
  const items = M.bom(model).phases.find(p => p.num === 17).items;
  assert.match(items[0].item, /W6×12 steel I-beam, 21′-6″/);
  assert.deepEqual([items[1].qty, /6×6×12 PT/.test(items[1].item)], [2, true]);
  assert.ok(items.some(i => /end plate and brace shoes/.test(i.item)));
  assert.ok(items.some(i => /Chain fall hoist \(1-ton, 25 ft lift\)/.test(i.item)));
  // the pages say it too
  const overview = read(path.join(DOCS, 'workshop_pole_barn.html')), specs = read(path.join(DOCS, 'workshop_specs.html')), plans = read(path.join(DOCS, 'workshop_plans.html'));
  assert.match(overview, /past the deck's outer edge/);
  assert.match(specs, /<strong>Hoist braces:<\/strong>/);
  assert.match(plans, /<span class="nums">17<\/span>/);
  assert.doesNotMatch(overview + specs + plans, /\b3 ft (out|beyond|past|east)/, 'no page still describes the 3 ft stub');
  // the drawings carry the braces and the marker
  for (const name of ['loftPlan', 'eastElevation', 'northElevation', 'southElevation', 'sectionB', 'loftFramingPlan', 'detail6'])
    assert.match(D[name](model), /l-brace|c-ptwood/, `${name} draws a brace`);
  for (const name of ['loftPlan', 'eastElevation', 'northElevation', 'southElevation', 'sectionB', 'loftFramingPlan']) assert.match(D[name](model), />17</, `${name} marks the braces`);
});

test('The 3D framing views build every member from the model and sort them back to front without a ring', () => {
  const pieces = ['N', 'S', 'W', 'E'].reduce((total, key) => total + model.girts.walls[key].rows.reduce((t, row) => t + row.boards.reduce((u, board) => u + board.pieces.length, 0), 0), 0);
  const views = { southeast: D.framing3dCheck(model, 'southeast'), northwest: D.framing3dCheck(model, 'northwest') };
  for (const [name, view] of Object.entries(views)) {
    const c = view.counts;
    assert.equal(c.post, model.pierCount, `${name}: a post over every pier`);
    assert.equal(c.girt, pieces, `${name}: every girt piece of the layout`);
    assert.equal(c['truss-top'], 4 * model.trussCount);
    assert.equal(c['truss-bottom'], model.trussCount + 1, 'the loft joist at 2 ft is cut in two around the stair opening');
    assert.equal(c['truss-tie'], model.specialTrusses.tied.length, 'a collar tie on every truss but the hoist trusses');
    assert.equal(c.purlin, 20, 'five rows on each of four slopes');
    assert.equal(c.carrier, 6, 'three 16 ft LVL carriers on each sidewall');
    assert.deepEqual([c['deck-post'], c['deck-beam'], c['deck-joist'], c['hoist-beam'], c['hoist-brace']], [4, 2, 11, 1, 2]);
    assert.equal(c.window, model.windows.length);
    assert.ok(c.stud > 20 && c.splash === 6, `${name}: studs on the gable trusses and the splash boards`);
    assert.equal(view.forced, 0, `${name}: members hide each other in a ring`);
    assert.ok(view.polygons > 800 && view.polygons < 1600, `${name}: ${view.polygons} polygons`);
    assert.ok(view.bytes < 200 * 1024, `${name} is ${view.bytes} bytes`);
  }
  const svg = D.framing3dSoutheast(model);
  for (const marker of ['1', '2', '3', '9', '10', '11', '15', '16', '17']) assert.match(svg, new RegExp(`class="mk-t">${marker}<`), `the southeast view needs marker ${marker}`);
  assert.match(svg, /PT base girt and splash board/);
  assert.match(D.framing3dNorthwest(model), /class="mk-t">15</);
  // every color class the views use is defined in the style sheet
  const css = read(path.join(DOCS, 'workshop.css'));
  for (const cls of new Set(Array.from((svg + D.framing3dNorthwest(model)).matchAll(/class="(z[a-z]?[\w-]*)"/g), match => match[1]))) assert.ok(css.includes(`.dwg .${cls}`), `workshop.css does not define ${cls}`);
  // the frame follows the length: a 46 ft building has one truss fewer, and one tie fewer
  const short = D.framing3dCheck(M.create({ length: 46 }), 'southeast');
  assert.equal(short.counts['truss-top'], 4 * 24);
  assert.equal(short.counts['truss-tie'], model.specialTrusses.tied.length - 1);
  assert.equal(short.forced, 0);
  // each tie spans the underside of the upper chords at its height, and the west gable's studs stop at it instead of passing through
  const parts = D.framing3dParts(model), tie = model.truss.tie, ys = p => p.corners.map(c => -c[1]), zs = p => p.corners.map(c => c[2]);
  const near = (value, expected) => assert.ok(Math.abs(value - expected) < 1e-6, `${value} is not near ${expected}`);
  for (const p of parts.filter(part => part.tag === 'truss-tie')) {
    near(Math.min(...ys(p)), tie.from); near(Math.max(...ys(p)), model.width - tie.from); near(Math.min(...zs(p)), tie.z); near(Math.max(...zs(p)), tie.z + tie.deep);
  }
  const westStuds = parts.filter(p => p.tag === 'stud' && Math.max(...p.corners.map(c => c[0])) < 0.2);
  assert.ok(westStuds.length > 10);
  for (const stud of westStuds.filter(p => Math.max(...ys(p)) > tie.from && Math.min(...ys(p)) < model.width - tie.from))
    assert.ok(Math.max(...zs(stud)) <= tie.z + 1e-6 || Math.min(...zs(stud)) >= tie.z + tie.deep - 1e-6, 'a stud of the west gable passes through the collar tie');
});

test('The eave in perspective cuts the wall and the roof edge from the eave section, and the air has a way out through the vented strip', () => {
  const view = D.eave3dCheck(model), c = view.counts, es = model.eaveSection, parts = D.eave3dParts(model);
  assert.deepEqual(plain([c.post, c.girt, c.carrier, c.bolt, c.nut, c['vent strip'], c['vent slot'], c['truss-top'], c['truss-bottom'], c['sub-fascia'], c['eave trim'], c.purlin, c['heel block']]),
    [1, 1, 1, 3, 3, 1, 8, 2, 2, 1, 2, 1, 2], 'one post, the LVL carrier with its three bolts, the vented strip with its slots, two trusses with a heel block under each, the sub-fascia, and the trim');
  assert.equal(view.members, parts.length);
  assert.equal(view.forced, 0, 'members hide each other in a ring');
  assert.ok(view.polygons > 60 && view.polygons < 400 && view.bytes < 60 * 1024, `${view.polygons} polygons, ${view.bytes} bytes`);
  // the wall from the post outward, with the model's thicknesses; the strip is 3 in tall
  assert.ok(0 > -es.girt && -es.girt > es.sheathingOut && es.sheathingOut > es.wrapOut && es.wrapOut > es.furringOut && es.furringOut > es.steelOut);
  assert.equal(es.girt, model.girts.thick);
  assert.ok(Math.abs(es.sheathingOut + es.girt + model.wall.sheathing) < 1e-9 && Math.abs(es.furringOut - es.wrapOut + model.wall.furring) < 1e-9);
  assert.equal(es.ventTop - es.ventBottom, 3);
  // the air path is never over solid steel: the steel and the furring stop where the strip begins, and the strip is in line with the steel
  const part = tag => parts.find(p => p.tag === tag), zOf = p => p.corners.map(q => q[2]), top = p => Math.max(...zOf(p)), bottom = p => Math.min(...zOf(p)), out = p => Math.max(...p.corners.map(q => q[1]));
  const strip = part('vent strip');
  assert.ok(Math.abs(top(part('steel')) - bottom(strip)) < 1e-9 && Math.abs(top(part('furring')) - bottom(strip)) < 1e-9, 'the steel and the furring end at the bottom of the strip');
  assert.ok(Math.abs(out(strip) - out(part('steel'))) < 1e-9, 'the strip is in line with the steel');
  assert.ok(top(part('sheathing')) >= top(strip) - 1e-9, 'the sheathing runs up behind the strip');
  // and what is out in front of the strip leaves it open: the sub-fascia, the trim, and the level cut under the tail all end above the strip's top
  assert.ok(bottom(part('sub-fascia')) > top(strip), 'the sub-fascia clears the strip');
  assert.ok(parts.filter(p => p.tag === 'eave trim').every(p => bottom(p) > top(strip)), 'the trim clears the strip');
  assert.ok(es.levelZ > es.ventTop && es.fascia.x0 < es.steelOut, 'the tail is cut level above the strip and reaches out past the steel');
  // the heel: a block on the bottom chord under the top chord at the bearing, with the floor butting to it, and plates that lie on wood
  const heel = es.heel, blocks = parts.filter(p => p.tag === 'heel block'), postHalf = model.wall.post / 24, chordTopZ = model.eave - model.decking / 12;
  const undersideAt = x => es.lineZ(x, -es.depth);
  assert.ok(blocks.every(p => Math.abs(bottom(p) - chordTopZ) < 1e-9), 'the blocks stand on the bottom chord');
  assert.ok(Math.abs(heel.block[3][1] - undersideAt(heel.post)) < 1e-9 && Math.abs(heel.block[2][1] - undersideAt(heel.post + heel.wide)) < 1e-9, 'the top of the block follows the underside of the top chord');
  assert.ok(heel.block[0][1] < heel.block[3][1], 'and the top chord stands clear of the bottom chord at the bearing, which is the gap the block fills');
  assert.ok(heel.height >= 12, `the heel stands ${heel.height} in high, which is at least 12 in`);
  assert.ok(Math.abs(Math.max(...part('floor').corners.map(q => q[1])) + (postHalf + heel.wide / 12)) < 1e-9, 'the floor butts to the inside face of the block');
  assert.ok(heel.plate.every(([x, z]) => x >= heel.post && x <= heel.post + heel.wide && z >= -model.chordInches - model.decking && z <= es.lineZ(x, 0)), 'each plate corner is on wood: within the width of the block, from inside the bottom chord to inside the top chord');
  // the picture
  const svg = D.detail5Perspective(model);
  for (const letter of 'ABCDEFGHIJKL') assert.match(svg, new RegExp(`class="mk-t">${letter}<`), `the cutaway needs marker ${letter}`);
  assert.match(svg, /class="c-plate-behind"/, 'the plates are drawn dashed, behind the cut');
  assert.ok((svg.match(/class="[^"]*zcut/g) || []).length >= 10, 'the cut faces are marked');
  assert.match(svg, /class="l-air"/);
  for (const name of ['detail1', 'detail4', 'detail5']) assert.match(D[name](model), /class="l-air"/, `${name} draws the air as the same blue path`);
  assert.doesNotMatch(D.detail7(model), /class="l-air"/, 'Detail 7 is the bearing, so it draws no air');
  assert.match(svg, /THE WHOLE WALL/);
  assert.ok(svg.includes('Detail 4') && svg.includes('Detail 5'), 'the diagram ties the air inlet at the base (Detail 4) to the outlet at the eave (Detail 5)');
  const css = read(path.join(DOCS, 'workshop.css'));
  for (const cls of new Set(Array.from(svg.matchAll(/class="(z[a-z]?[\w-]*)"/g), match => match[1]))) assert.ok(css.includes(`.dwg .${cls}`), `workshop.css does not define ${cls}`);
  // the sections page carries it, with a legend for every marker, and no page still describes a soffit
  const sections = read(path.join(DOCS, 'workshop_sections.html')), block = sections.slice(sections.indexOf('id="detail-5-perspective"'), sections.indexOf('id="detail-6"'));
  assert.match(sections, /<script src="workshop_3d\.js"><\/script>/);
  assert.match(block, /data-fig="detail5Perspective"/);
  for (const letter of 'ABCDEFGHIJKL') assert.match(block, new RegExp(`<span class="nums">${letter}</span>`), `the legend needs a row for ${letter}`);
  assert.match(sections, /href="#detail-5-perspective"/);
  // Details 5 and 7 draw the heel block and name it, and the truss page's copy of Detail 7 does too
  for (const name of ['detail5', 'detail7']) assert.match(D[name](model), /class="c-plate-behind"/, `${name} draws the heel plates`);
  const detail5Legend = sections.slice(sections.indexOf('id="detail-5"'), sections.indexOf('id="detail-5-perspective"'));
  for (const letter of 'ABCDEFGH') assert.match(detail5Legend, new RegExp(`<span class="nums">${letter}</span>`), `Detail 5 needs a row for ${letter}`);
  assert.match(D.detail5(model), />H</);
  for (const file of ['workshop_sections.html', 'workshop_trusses.html']) {
    const page = read(path.join(DOCS, file)), detail7Legend = page.slice(page.indexOf('data-fig="detail7"'));
    assert.match(detail7Legend, /<span class="nums">10<\/span><\/td><td>Heel block/, `${file} lists the heel block in the Detail 7 legend`);
  }
  assert.match(D.detail7(model), />10</);
  for (const page of PAGES) assert.doesNotMatch(read(path.join(DOCS, page)), /soffit/i, `${page} still mentions a soffit`);
  assert.doesNotMatch(JSON.stringify(M.bom(model)), /soffit/i);
  // the eave follows the building, not the length
  assert.deepEqual(plain(D.eave3dCheck(M.create({ length: 46 })).counts), plain(c));
});

test('At 44 ft the model reproduces the original estimate\'s phase subtotals wherever that estimate was consistent', () => {
  const bom = M.bom(reference);
  // The original estimate's PHASE SUBTOTAL rows, low and high. Phases 1, 2, 8, 9, 11, and 14 differ on purpose: the model counts different quantities there.
  // Phases 4, 6, and 15 differ on purpose: the posts are sized for the 14 ft eave, the walls are framed with flat girts laid out row by row, and the stair follows the loft floor height.
  // Phase 17 differs on purpose: the hoist beam reaches past the deck on two braces, so it is longer, has a plate and shoes, and a taller chain fall.
  const expected = { 3: [2648, 4480], 5: [10910, 17435], 7: [1050, 1395], 10: [1349, 1912], 12: [375, 483], 13: [5700, 10450],
    16: [1306, 1815], 18: [4235, 7369], 19: [4220, 8150], 20: [3415, 5190], 21: [724, 1165] };
  for (const [num, [low, high]] of Object.entries(expected)) {
    const phase = bom.phases.find(p => p.num === Number(num));
    assert.equal(Math.round(phase.low), low, `phase ${num} low`);
    assert.equal(Math.round(phase.high), high, `phase ${num} high`);
  }
  const quantity = (phase, text) => bom.phases.find(p => p.num === phase).items.find(i => i.item.includes(text)).qty;
  assert.equal(quantity(1, 'XPS'), 44);
  assert.equal(quantity(1, 'crushed gravel'), 18);
  assert.equal(quantity(6, 'girts'), 48);
  assert.equal(quantity(4, 'laminated'), 19);
  assert.equal(quantity(7, 'purlins'), 60);
  assert.equal(quantity(10, 'furring'), 185);
  assert.equal(quantity(12, '2×10×16 PT'), 11);
});

test('Each foot of length costs about a thousand dollars of materials, and a longer building costs less per square foot', () => {
  const short = M.create({ length: 46 }), shortBom = M.bom(short), bom = M.bom(model);
  const materials = bom.totals.mid - shortBom.totals.mid, allIn = bom.budget.likely.total - shortBom.budget.likely.total;
  assert.ok(materials > 1000 && materials < 3000, `two more feet cost ${materials} in materials`);
  assert.ok(allIn > materials && allIn < 4000, `two more feet cost ${allIn} all in`);
  assert.ok(bom.totals.mid / model.floorSqFt < shortBom.totals.mid / short.floorSqFt, 'each square foot costs less in the longer building');
  // The piers' hardware, the doors and windows, the stair, the deck, and the hoist do not depend on the length.
  for (const num of [3, 13, 15, 16, 17]) {
    const phase = list => list.phases.find(p => p.num === num);
    assert.ok(Math.abs(phase(bom).low - phase(shortBom).low) < 0.01 && Math.abs(phase(bom).high - phase(shortBom).high) < 0.01, `phase ${num} must cost the same at both lengths`);
  }
  const facts = M.facts(model), dollars = text => Number(text.replace(/[$,]/g, ''));
  assert.ok(Math.abs(dollars(facts.lengthFoot) - materials / 2) <= 30, `a foot costs ${facts.lengthFoot}, against ${materials / 2} from the 46 ft building`);
  assert.ok(Math.abs(dollars(facts.lengthFootAllIn) - allIn / 2) <= 100, `a foot costs ${facts.lengthFootAllIn} all in, against ${allIn / 2}`);
  assert.equal(facts.materialsPerSqFt, '$' + Math.round(bom.totals.mid / model.floorSqFt));
});

test('The numbers quoted in the text are the model\'s numbers', () => {
  const facts = M.facts(model);
  assert.equal(facts.footprint, '32 × 48 ft');
  assert.equal(facts.bays, '8-8-8-8-8-8');
  assert.equal(facts.trusses, '25');
  assert.equal(facts.ties, '100');
  assert.equal(facts.footprintSqFt, '1,536');
  assert.equal(facts.slabSlope, '12');
  assert.equal(facts.rvClearDoor, '1′-1″');
  assert.equal(facts.rvClearLoft, '2′-3″');
  assert.equal(facts.rvSize, '25′-11″ × 8′ × 10′-11″');
  assert.equal(facts.rvHeight, '10′-11″');
  assert.equal(facts.doorSize, '14′ × 12′');
  assert.equal(facts.doorSide, '3′-0″');
  assert.equal(facts.doorHeadroom, '14″');
  assert.equal(facts.underLoft, '13′-2″');
  assert.deepEqual([facts.stairRisers, facts.flight1Risers, facts.flight2Risers], ['24', '11', '13']);
  assert.deepEqual([facts.landingHeight, facts.flight1Rise, facts.flight2Rise, facts.flight1Run, facts.flight2Run], ['6′-5″', '6′-5″', '7′-7″', '9′-2″', '11′-0″']);
  assert.equal(facts.openingSize, '4′ × 11′');
  assert.equal(facts.postLength, '16');
  assert.equal(facts.snow, '120');
  assert.equal(facts.windows, '7');
  assert.equal(facts.windowsNorth, '3');
  assert.equal(facts.windowsSouth, '3');
  assert.equal(facts.windowSize, '4′ × 3′');
  assert.equal(facts.windowSill, '5′');
  assert.equal(facts.loftWindowSize, '3′ × 4′');
});

test('The windows sit between the posts, clear of the walk door and the eave, and come out of the wall steel', () => {
  const on = wall => model.windows.filter(w => w.wall === wall);
  assert.deepEqual(plain(on('N').map(w => [w.bay, w.at])), [[2, 12], [4, 28], [6, 44]]);
  assert.deepEqual(plain(on('S').map(w => [w.bay, w.at])), [[3, 20], [4, 28], [5, 36]]);
  const loft = model.windows.find(w => w.loft);
  assert.deepEqual(plain({ wall: loft.wall, at: loft.at, width: loft.width, height: loft.height, sill: loft.sill }), { wall: 'W', at: 16, width: 3, height: 4, sill: 17 });
  assert.equal(model.windows.length, 7);
  assert.ok(on('N').length >= 2 && on('S').length >= 2, 'at least two windows in each long wall');
  for (const w of model.windows.filter(item => !item.loft)) {
    const left = model.postX[w.bay - 1], right = model.postX[w.bay];
    assert.ok(w.at - w.width / 2 - left >= 2 && right - (w.at + w.width / 2) >= 2, `the window in bay ${w.bay} must leave 2 ft of wall on each side`);
    assert.ok(w.sill + w.height <= model.eave - 1, 'a sidewall window must end a foot below the eave');
  }
  for (const w of on('S')) assert.ok(Math.abs(w.at - model.walkX) >= (w.width + model.walkDoor.width) / 2 + 1, `the south window in bay ${w.bay} is too close to the walk door`);
  assert.equal(model.windowArea, 6 * 4 * 3 + 3 * 4);
  const bare = M.create({ windowSpec: null });
  assert.deepEqual([bare.windows.length, bare.windowArea], [0, 0]);
  assert.ok(Math.abs(bare.wallNet - model.wallNet - model.windowArea) < 1e-9, 'the windows come out of the wall steel');
  const doors = list => list.phases.find(p => p.num === 13).items;
  assert.equal(doors(M.bom(model)).find(i => /slider/.test(i.item)).qty, 6);
  assert.equal(doors(M.bom(model)).find(i => /single-hung/.test(i.item)).qty, 1);
  assert.equal(doors(M.bom(bare)).filter(i => /window/i.test(i.item)).length, 0, 'a building without windows has no window lines');
  const facts = M.facts(model), dollars = text => Number(text.replace(/[$,]/g, ''));
  const cost = M.bom(model).totals.low - M.bom(bare).totals.low;
  assert.ok(cost > 1000 && cost < 3000 && Math.abs(dollars(facts.windowsLow) - cost) <= 50, `the windows add ${cost} to the low total`);
  assert.ok(dollars(facts.windowsHigh) > dollars(facts.windowsLow));
});

test('A window that does not fit is refused', () => {
  const spec = (side, loft) => ({ windowSpec: { side: { width: 4, height: 3, sill: 5, northBays: [2], southBays: [3], ...side }, loft: loft || { width: 3, height: 4, sill: 3 } } });
  assert.doesNotThrow(() => M.create(spec({})));
  assert.throws(() => M.create(spec({ width: 8 })), /does not fit in bay/);
  assert.throws(() => M.create(spec({ northBays: [9] })), /no bay 9/);
  assert.throws(() => M.create(spec({ height: 11 })), /below the eave/);
  assert.throws(() => M.create(spec({ southBays: [6] })), /too close to the walk door/);
  assert.throws(() => M.create(spec({}, { width: 3, height: 9, sill: 3 })), /does not fit the gable/);
});

test('The height is measured the way the county measures it: to the mid-point of the gable', () => {
  const h = model.heights, facts = M.facts(model);
  assert.ok(Math.abs(h.padToFloor - 13 / 12) < 1e-9, 'the floor is a 5 in slab on 8 in of foam and gravel above the pad');
  assert.ok(Math.abs(h.gableMidAbovePad - ((14 + 24.5) / 2 + 13 / 12)) < 1e-9);
  assert.ok(Math.abs(h.avgFill - 1.325) < 1e-9);
  assert.ok(Math.abs(h.gableMidAboveOldGround - h.gableMidAbovePad - h.avgFill) < 1e-9);
  // the gambrel's gable is fuller than a triangle, so its whole-shape average (222.5 sq ft over 32 ft = 6.95 ft above the eave) is higher than the mid-point
  assert.ok(Math.abs(h.gableAvgAbovePad - (14 + 13 / 12 + 222.5 / 32)) < 1e-9);
  assert.ok(h.gableAvgAbovePad > h.gableMidAbovePad);
  assert.deepEqual([facts.eaveAbovePad, facts.ridgeAbovePad, facts.roofPeakAbovePad, facts.peakMarginIn, facts.gableMid, facts.gableMidOldGround, facts.gableAverage],
    ['15′-1″', '25′-7″', '26′-4″', '8', '20′-4″', '21′-8″', '22.0']);
  const { poleBarn, ...ordinance } = plain(M.COUNTY);
  assert.deepEqual(ordinance, { accessoryHeight: 24, zoneHeight: 35, agStructureHeight: 80, frontYardSqFt: 1500, characterSqFt: 1500 });
  assert.equal(poleBarn.wall, 14);
  assert.ok(h.gableMidAbovePad < M.COUNTY.accessoryHeight && h.gableMidAboveOldGround < M.COUNTY.accessoryHeight && h.gableAvgAbovePad < M.COUNTY.accessoryHeight,
    'under the accessory limit from the pad, from the original ground, and averaging the whole gable');
  assert.ok(h.ridgeAbovePad < M.COUNTY.zoneHeight);
  assert.equal(facts.accessoryReading, 'under by 44″');
});

test('The county table gives the rules, this building\'s numbers, and the condition on the agricultural exemption', () => {
  const html = P.countyTable(model, SiteGrid);
  assert.doesNotMatch(html, /NaN|undefined|\[object/);
  assert.equal((html.match(/<tr>/g) || []).length, 1 + 8, 'a header row and eight rules');
  for (const text of ['35 ft', '80 ft', '1,500 sq ft', '1,320 sq ft', '1,536 sq ft', '2,640 sq ft', '40 × 66 ft', '20′-4″', '21′-8″', '25′-7″', 'under by 44″', 'under by 28″', 'about 22.0 ft'])
    assert.ok(html.includes(text), `the county table should say ${text}`);
  assert.deepEqual(['good', 'look', 'stop'].map(cls => (html.match(new RegExp(`<td class="${cls}">`, 'g')) || []).length), [2, 4, 2]);
  const rowOf = title => new RegExp(`<th scope="row">${title}[\\s\\S]*?</tr>`).exec(html)[0];
  for (const text of ['solely', 'notarized', 'personal', 'inspect', 'orchard equipment', 'Does not fit as drawn', '7-2-46', 'zoning approval', 'on a farm', 'setbacks and height'])
    assert.ok(rowOf('Agricultural building').includes(text), `the agricultural row should mention ${text}`);
  for (const text of ['residential district', 'taller than the house at all', 'average height (mid-point)']) assert.ok(rowOf('Height of an accessory building').includes(text), `the height row should mention ${text}`);
  assert.ok(rowOf('Matching the house').includes('architectural character'));
  assert.match(rowOf('Matching the house'), /over the size where the character rule starts/);
  // at 46 ft the building is under the size where the character rule starts
  assert.match(P.countyTable(M.create({ length: 46 }), SiteGrid), /under the size where the character rule starts/);
  assert.match(html, /a length of 46 ft \(1,472 sq ft\) would clear the 1,500 sq ft figure, and 41 ft \(1,312 sq ft\) would clear half the house/);
  // a shorter building clears the front-yard cap, and the row says so
  assert.match(P.countyTable(M.create({ length: 40, windowSpec: null }), SiteGrid), /<td class="good">Within the cap\./);
  // the county's pole barn guide is for 30 psf, so at 120 psf it does not apply and the building is engineered; its wall and peak limits are shown for reference
  for (const text of ['Pole Barn/Post and Beam Standards', '30 psf snow zone', 'a 120 psf area always needs engineering', 'must be designed by an Idaho engineer', 'registered design professional', 'no habitation',
    'the county required a neighbor’s building to be designed for it (owner, October 2026)', '1.50 to 1', 'at least 5 to 3', 'The guide does not apply: at 120 psf this is an engineered building', 'priced for 120 psf'])
    assert.ok(rowOf('Snow load and the engineer').includes(text), `the snow row should mention ${text}`);
  for (const text of ['Pole Barn/Post and Beam Standards', '14 ft above the floor, 15′-1″ above the pad surface', 'Roof peak: 26′-4″ above the pad surface', '24.5 ft above the floor', 'about 9 in of purlins, deck, steel, and ridge cap',
    'only decides whether a barn needs an engineer, and this one has one', 'if the Building Official accepts it', 'From the floor the wall is 14′-0″, and from the pad surface 15′-1″',
    '8 in under 27 ft from the pad surface', '8 in over 27 ft from the original ground', '1.3 ft lower under the east wall', 'where it takes grade'])
    assert.ok(rowOf('Wall and peak in the pole barn guide').includes(text), `the wall and peak row should mention ${text}`);
  // the rows follow the building: with a 16 ft eave the roof peak is over 27 ft from the pad, which the table marks as a stop
  const tall = P.countyTable(M.create({ eave: 16, mainDoor: { width: 14, height: 14 } }), SiteGrid);
  assert.match(tall, /<td class="stop">The wall limit only decides[^<]*16 in over 27 ft from the pad surface[^<]*32 in over 27 ft from the original ground/);
  assert.doesNotMatch(html, /<td class="stop">The wall limit/, 'this building is not over the peak limit');
});

test('The 120 psf snow load is the settled design load: no page asks which load applies or leaves it to confirm', () => {
  assert.equal(model.loads.groundSnow, 120);
  const hedges = [/which snow load applies/i, /\bsnow\b[^.<]{0,80}\b(confirm|unconfirmed)\b/i, /\b(confirm|unconfirmed)\b[^.<]{0,80}\bsnow\b/i, /snow load[^.<]{0,80}\bask\b/i, /5,000 ft/];
  const bomText = JSON.stringify(M.bom(model).phases.map(phase => phase.items.map(item => [item.item, item.notes])));
  const texts = [...PAGES.map(page => [page, read(path.join(DOCS, page))]), ['the county table', P.countyTable(model, SiteGrid)], ['the bill of materials', bomText]];
  for (const [name, text] of texts) for (const pattern of hedges) assert.doesNotMatch(text, pattern, `${name} still treats the snow load as unconfirmed (${pattern})`);
  // the pages say where the load comes from, and the trusses are specified for it
  const overview = read(path.join(DOCS, 'workshop_pole_barn.html')), specs = read(path.join(DOCS, 'workshop_specs.html'));
  assert.match(overview, /psf ground snow \(the county's zone for Prairie, and the load it required of a neighbor's building\)/);
  assert.match(overview, /The ground snow load is settled at 120 psf: the county required a neighbor's building to be designed for it\./);
  assert.match(overview, /the load the county required a neighbor's building to be designed for \(reported by the owner, October 23, 2026\)/);
  assert.match(overview, /Get stamped truss drawings<\/strong> for <span data-m="snow">120<\/span> psf ground snow/);
  assert.match(specs, /the county required a neighbor's building to be designed for it \(owner, October 2026\)/);
  assert.match(specs, /PE stamped for <span data-m="snow">120<\/span> psf ground snow/);
  assert.match(M.bom(model).phases.find(p => p.num === 5).items[0].notes, /120 psf ground snow \(the county's design load here\)/);
});

test('Every drawing is well-formed, finite, and keeps its labels inside the picture', () => {
  for (const name of FIGURES) {
    const svg = D[name](model);
    assert.match(svg, /^<svg class="dwg" viewBox="0 0 (\d+) (\d+)"/, name);
    assert.doesNotMatch(svg, /NaN|undefined|Infinity|\[object/, `${name} has a bad number or text`);
    const [, width, height] = /viewBox="0 0 (\d+) (\d+)"/.exec(svg).map(Number);
    const stack = [];
    for (const tag of svg.matchAll(/<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g)) {
      const [, closing, tagName, , selfClosing] = tag;
      if (selfClosing) continue;
      if (closing) assert.equal(stack.pop(), tagName, `${name}: a ${tagName} tag is not closed in order`);
      else stack.push(tagName);
    }
    assert.deepEqual(stack, [], `${name}: unclosed tags`);
    for (const label of svg.matchAll(/<text x="(-?[\d.]+)" y="(-?[\d.]+)"/g)) {
      assert.ok(label[1] >= 0 && label[1] <= width && label[2] >= 0 && label[2] <= height, `${name}: a label at ${label[1]},${label[2]} is outside the ${width} x ${height} picture`);
    }
  }
});

test('The drawings are drawn for 48 ft, with the right number of posts, trusses, and bays', () => {
  const dims = text => Array.from(text.matchAll(/>(\d+)′-0″/g), match => match[1]);
  for (const name of ['floorPlan', 'loftPlan', 'foundationPlan', 'loftFramingPlan']) assert.ok(dims(D[name](model)).includes('48'), `${name} must carry the 48 ft dimension`);
  for (const name of ['northElevation', 'southElevation', 'sectionB']) assert.match(D[name](model), />48′-0″ (sidewall length|gable to gable)</);
  for (const name of FIGURES.slice(0, -1)) assert.doesNotMatch(D[name](model), /4[46]′/, `${name} still mentions 44 or 46 ft`);
  const f2 = D.loftFramingPlan(model);
  assert.equal((f2.match(/class="l-chord/g) || []).length, 25 + 2, '25 truss chords, with the chord at 2 ft drawn in two pieces around the stair opening');
  const count = (text, pattern) => (text.match(pattern) || []).length;
  const floor = D.floorPlan(model), shortFloor = D.floorPlan(M.create({ length: 46 }));
  assert.deepEqual([count(floor, />8′</g), count(floor, />7′</g)], [6, 0], 'six 8 ft bay dimensions and no 7 ft bays');
  const f1 = D.foundationPlan(model);
  // 19 building piers and 4 deck piers, plus one swatch in the legend
  assert.equal((f1.match(/class="c-pier"/g) || []).length, model.pierCount + model.deckPosts.length + 1);
  assert.equal((f1.match(/class="c-post"/g) || []).length, model.pierCount + 1);
  // a 46 ft building redraws with different bays, so nothing is typed into the pictures
  assert.match(shortFloor, /46′-0″/);
  assert.deepEqual([count(shortFloor, />8′</g), count(shortFloor, />7′</g)], [4, 2]);
});

test('The site plan and the site table read the master grid', () => {
  const facts = P.siteFacts(model, SiteGrid);
  assert.equal(facts.centerRef, 'B18-E11-S13');
  assert.deepEqual(plain(facts.cells).sort(), ['A17', 'A18', 'B17', 'B18']);
  assert.deepEqual(plain(facts.corners.map(c => c.ref)), ['A17-E37-S47', 'B17-E35-S47', 'A18-E37-S29', 'B18-E35-S29']);
  const near = (value, expected) => assert.ok(Math.abs(value - expected) < 0.35, `${value} is not near ${expected}`);
  near(facts.gaps.pump_house, 28.5);
  near(facts.gaps.container_solar, 33.0);
  near(facts.gaps.water_tee_west, 11.0);
  near(facts.gaps.water_line_west, 16.4);
  near(facts.gaps.rv_pad, 9.5);
  near(facts.gaps.house, 53.5);
  const table = P.siteTable(model, SiteGrid);
  assert.match(table, /almost 2 ft over the original ground along the north edge/);
  assert.match(table, /B18-E11-S13/);
  assert.match(D.sitePlan(model, SiteGrid), /WORKSHOP 32 × 48/);
});

test('Each workshop page loads the menu first, links home, and asks only for numbers and drawings that exist', () => {
  const facts = M.facts(model);
  for (const page of PAGES) {
    const html = read(path.join(DOCS, page));
    assert.match(html, /<body>\s*<script src="site_nav\.js"><\/script>/, `${page} must load the menu first`);
    assert.match(html, /<a\s[^>]*href="index\.html"/, `${page} needs a link home`);
    assert.match(html, /<link rel="stylesheet" href="workshop\.css">/, page);
    for (const match of html.matchAll(/<span data-m="(\w+)">([^<]*)<\/span>/g)) {
      assert.ok(match[1] in facts, `${page} asks for the unknown number ${match[1]}`);
      assert.equal(match[2], facts[match[1]], `${page}: the fallback text for ${match[1]} is stale`);
    }
    for (const match of html.matchAll(/data-fig="(\w+)"/g)) assert.equal(typeof D[match[1]], 'function', `${page} asks for the unknown drawing ${match[1]}`);
    for (const match of html.matchAll(/data-bom="(\w+)"/g)) assert.ok(['summary', 'phases', 'budget'].includes(match[1]), `${page}: ${match[1]}`);
    for (const match of html.matchAll(/data-site="(\w+)"/g)) assert.ok(['table', 'county'].includes(match[1]), `${page}: ${match[1]}`);
    for (const match of html.matchAll(/data-truss="(\w+)"/g)) assert.doesNotThrow(() => P.trussTable(model, match[1]), `${page}: the unknown truss table ${match[1]}`);
    const hooks = Array.from(html.matchAll(/data-(?:bom|fig|site|truss)="\w+"/g), match => match[0]);
    assert.deepEqual(hooks.filter((hook, i) => hooks.indexOf(hook) !== i), [], `${page} draws the same table or drawing twice`);
    for (const match of html.matchAll(/<script src="([^"]+)">/g)) assert.ok(fs.existsSync(path.join(DOCS, match[1])), `${page} loads a missing script ${match[1]}`);
    assert.ok(html.includes('data-m=') || page === 'workshop_plans.html' || page === 'workshop_sections.html', page);
  }
});

test('The pages read as the current design: no history of earlier notes, lengths, or corrections', () => {
  const history = [
    /\bold\b/i, /\b(the|in the|from the|owner['’]s)( [\w-]+){0,3} notes\b/i, /\bnotes['’]/i,
    /\bconverted\b|\bcorrect(ed|ion|ions)\b|what changed|changed from|\bno longer\b|\bused to\b|\bpreviously\b|\boriginally\b|\bformerly\b|\bupgraded\b/i,
    /\b(site data|plan|notes|list) (had|said|counted|priced|named)\b/i, /\buntil the owner\b|\bwas (44|46) ft\b/i, /\bre-?checked\b/i
  ];
  const texts = new Map();
  for (const page of PAGES) texts.set(page, read(path.join(DOCS, page)).replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, ''));
  const bom = M.bom(model);
  texts.set('the materials tables', P.bomSummary(bom) + P.bomPhases(bom) + P.bomBudget(bom));
  texts.set('the site and county tables', P.siteTable(model, SiteGrid) + P.countyTable(model, SiteGrid));
  for (const name of FIGURES) texts.set(`the ${name} drawing`, D[name](model));
  texts.set('the quoted numbers', Object.values(M.facts(model)).join(' | '));
  // what the home page and the README say about the workshop
  const home = read(path.join(DOCS, 'index.html')), readme = read(path.join(ROOT, 'README.md'));
  const between = (text, start, end) => text.slice(text.indexOf(start), text.indexOf(end, text.indexOf(start)));
  texts.set('the home page card', between(home, '<h3><a href="workshop_pole_barn.html">', '</article>'));
  texts.set('the home page tracker row', between(home, '<tr><td>Workshop pole barn,', '</tr>'));
  texts.set('the home page log entry', between(home, 'Added the workshop pole barn', '</li>'));
  texts.set('the README tracker row', between(readme, '| Workshop pole barn,', '\n'));
  texts.set('the README log entry', between(readme, 'Added the workshop pole barn', '\n'));
  for (const [where, text] of texts) {
    assert.ok(text.length > 100, `${where} was not found`);
    for (const pattern of history) {
      const hit = pattern.exec(text);
      assert.equal(hit, null, `${where} talks about the past: "${hit && text.slice(Math.max(0, hit.index - 50), hit.index + 70).replace(/\s+/g, ' ')}"`);
    }
  }
});

test('Every link inside the package points at a page and an anchor that exist', () => {
  const pages = new Map(PAGES.map(page => [page, read(path.join(DOCS, page))]));
  for (const [page, html] of pages) {
    for (const match of html.matchAll(/href="(workshop_\w+\.html)?#([\w-]+)"/g)) {
      const target = match[1] || page;
      assert.ok(pages.has(target), `${page} links to a missing page ${target}`);
      assert.ok(pages.get(target).includes(`id="${match[2]}"`), `${page} links to ${target}#${match[2]}, which does not exist`);
    }
    for (const match of html.matchAll(/href="(workshop_\w+\.html)"/g)) assert.ok(pages.has(match[1]), `${page} links to a missing page ${match[1]}`);
  }
});

test('The materials page tables build from the model without leftovers', () => {
  const bom = M.bom(model);
  const html = P.bomSummary(bom) + P.bomPhases(bom) + P.bomBudget(bom);
  assert.doesNotMatch(html, /NaN|undefined|\[object/);
  assert.equal((html.match(/<h2 id="phase-/g) || []).length, 21);
});

test('The cost pages price no labor and assume no hired contractor: the family builds it', () => {
  const bom = M.bom(model), strip = html => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
  const pages = { materials: strip(read(path.join(DOCS, 'workshop_materials.html'))), overview: strip(read(path.join(DOCS, 'workshop_pole_barn.html'))), trusses: strip(read(path.join(DOCS, 'workshop_trusses.html'))) };
  const hired = /\blabor\b|\bhire[ds]?\b|contractor|installed quote|\(installed\)/i;
  const texts = new Map([['the materials page', pages.materials], ['the overview', pages.overview], ['the truss page', pages.trusses], ['the materials tables', P.bomSummary(bom) + P.bomPhases(bom) + P.bomBudget(bom)]]);
  for (const [where, text] of texts) {
    const hit = hired.exec(text);
    assert.equal(hit, null, `${where} talks about paid work: "${hit && text.slice(Math.max(0, hit.index - 50), hit.index + 70).replace(/\s+/g, ' ')}"`);
  }
  // every line of the budget is tax, an extra that is a fee, a rental, or a utility charge, or the contingency: none is a wage
  for (const extra of M.BUDGET_EXTRAS) assert.doesNotMatch(extra.join(' '), hired, `${extra[0]} reads as paid labor`);
  assert.match(pages.overview, /built with family/);
  assert.match(pages.overview, /Built by the owner with family/);
  const door = bom.phases.flatMap(p => p.items).find(i => /insulated sectional OH door/.test(i.item));
  assert.match(door.notes, /delivered; the family installs it/);
  assert.match(pages.materials, /track kit, delivered/);
});

test('Windows are drawn in the plans, the elevations, and Section B, and nowhere else', () => {
  const count = (text, pattern) => (text.match(pattern) || []).length;
  assert.equal(count(D.floorPlan(model), /class="c-winplan"/g), 6);
  assert.equal(count(D.loftPlan(model), /class="c-winplan"/g), 1);
  for (const [name, expected] of [['northElevation', 3], ['southElevation', 3], ['westElevation', 1], ['sectionB', 3], ['eastElevation', 0], ['sectionA', 0]])
    assert.equal(count(D[name](model), /class="c-winframe"/g), expected, `${name} should draw ${expected} windows`);
  for (const name of ['floorPlan', 'loftPlan', 'northElevation', 'southElevation', 'westElevation', 'sectionB']) assert.match(D[name](model), />15</, `${name} needs the window marker 15`);
  const bare = M.create({ windowSpec: null });
  for (const name of ['floorPlan', 'loftPlan', 'northElevation', 'southElevation', 'westElevation', 'sectionB']) assert.doesNotMatch(D[name](bare), /c-winplan"|c-winframe"/, `${name} drew a window the model does not have`);
});

test('Each workshop page has a PDF, links on the home page, and a menu entry', () => {
  const home = read(path.join(DOCS, 'index.html')), menu = read(path.join(DOCS, 'site_nav.js'));
  for (const page of PAGES) {
    const pdf = page.replace('.html', '.pdf'), file = path.join(DOCS, 'downloads', pdf);
    assert.ok(fs.existsSync(file), `${pdf} must be in docs/downloads`);
    assert.equal(fs.readFileSync(file).subarray(0, 5).toString('latin1'), '%PDF-', `${pdf} is not a PDF`);
    assert.ok(fs.statSync(file).size > 50 * 1024, `${pdf} is too small to be the whole page`);
    assert.ok(home.includes(`href="${page}"`), `the home page needs a link to ${page}`);
    assert.ok(home.includes(`href="downloads/${pdf}"`), `the home page needs a download link for ${pdf}`);
    assert.ok(menu.includes(`"href": "${page}"`), `${page} needs an entry in docs/site_nav.js`);
  }
});

// ------------------------------------------------------------------ the truss package

test('The truss geometry: the roof line, the clear room under 7¼″ chords, and its width at 7 ft and 5 ft', () => {
  const t = model.truss, near = (value, expected, tolerance = 0.01) => assert.ok(Math.abs(value - expected) < tolerance, `${value} is not near ${expected}`);
  assert.deepEqual(plain(t.outline.slice(1, 4)), [[0, 14], [7, 22], [16, 24.5]], 'the roof line passes through the wall line, the pitch break, and the ridge');
  assert.deepEqual(plain(t.outline[4]), [25, 22]);
  near(t.tailRun, 0.659); near(t.tailDrop, 0.753);
  near(t.clearAt(7), 7.083); near(t.clearAt(16), 9.873);
  near(t.clearWidth(7), 18.144); near(t.clearWidth(5), 21.644); near(t.clearFrom(0), 0.803);
  near(t.innerKnuckle[0], 7.336); near(t.innerKnuckle[1], 21.466);
  for (let y = 0; y <= 32; y += 0.5) {
    near(t.clearAt(y), t.clearAt(32 - y), 1e-9);
    if (y > 0 && y < 32) assert.ok(t.clearAt(y) < model.headroomAt(y), `the underside of the chords is below the roof line at ${y} ft`);
  }
  // the chord drops the headroom by its depth square to the slope: 7½″ at the ridge, 11″ at the pitch break
  near(model.headroomAt(16) - t.clearAt(16), 0.604 / Math.cos(model.upperAngle * Math.PI / 180));
  near(model.headroomAt(7) - t.clearAt(7), 11 / 12);
  // a deeper chord costs about an inch of headroom per inch of depth at the ridge
  const deeper = M.create({ topChordInches: 9.25 });
  near(t.clearAt(16) - deeper.truss.clearAt(16), 2 * 1.038 / 12);
  assert.ok(t.clearAt(7) - deeper.truss.clearAt(7) > 2 / 12, 'and more at the pitch break');
  // the four chords tile the roof line, and the hoist beam fits under the ridge with room for blocking
  assert.equal(t.chords.length, 4);
  assert.ok(t.innerRidge[1] - (model.hoistZ + 0.25) > 0.5, 'the hoist beam clears the underside of the ridge');
});

test('The bracing stays out of the open room: webs and kickers in the knee zones, plates on the chord faces, and a price for each step that comes into the room', () => {
  const t = model.truss, b = model.bracing, near = (value, expected, tolerance = 0.002) => assert.ok(Math.abs(value - expected) < tolerance, `${value} is not near ${expected}`);
  const count = (text, pattern) => (text.match(pattern) || []).length;
  // a vertical web and a kicker from its foot, both standing on the loft floor and ending on the underside of the lower chord
  const [v0, v1] = t.webs.vertical, [k0, k1] = t.webs.kicker;
  assert.deepEqual(plain([v0, k0]), [[b.webAt, model.eave], [b.webAt, model.eave]], 'both stand on the loft floor at the web line');
  near(v1[1], model.eave + t.clearAt(v1[0]), 1e-9);
  near(k1[1], model.eave + t.clearAt(k1[0]), 1e-9);
  assert.ok(k1[0] > b.webAt && k1[0] < model.knuckleRun, 'the kicker leans from the web line toward the pitch break');
  // each member's body, with its width, stays outside the pitch-break line (on the south side too), so none of it comes into the room
  const corners = ([a, c]) => {
    const dy = c[0] - a[0], dz = c[1] - a[1], len = Math.hypot(dy, dz), w = t.webs.wide / 2, nx = -dz / len * w, nz = dy / len * w;
    return [[a[0] + nx, a[1] + nz], [a[0] - nx, a[1] - nz], [c[0] + nx, c[1] + nz], [c[0] - nx, c[1] - nz]];
  };
  near(t.webs.wide, 3.5 / 12, 1e-9);
  for (const seg of [t.webs.vertical, t.webs.kicker]) for (const [y] of corners(seg)) {
    assert.ok(y <= model.knuckleRun + 1e-9, `a web corner at ${y} ft is inside the pitch-break line`);
    assert.ok(model.width - y >= model.width - model.knuckleRun - 1e-9, 'the south half mirrors it');
  }
  // the plates lie flat on the chords at the knee and the ridge, so every corner is within the outline of the chords
  const inside = ([y, z], polygon) => {
    let on = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [yi, zi] = polygon[i], [yj, zj] = polygon[j];
      if ((zi > z) !== (zj > z) && y < (yj - yi) * (z - zi) / (zj - zi) + yi) on = !on;
    }
    return on;
  };
  for (const key of ['knee', 'ridge']) t.plates[key].forEach(p => assert.ok(t.chords.some(chord => inside(p, chord)), `a ${key} plate corner at ${p} is off the chords`));
  // no kicker costs nothing; the kicker we accept costs about 6 in at the room's edge and 1′-6″ of the 7 ft width, and a longer one costs more
  const kicker = t.haunch(b.kickerLeg), longer = t.haunch(b.kickerLeg + 1);
  near(t.haunch(0).edgeClear, t.clearAt(model.knuckleRun), 1e-9);
  near(t.haunch(0).width7, t.clearWidth(7), 1e-9);
  near(kicker.edgeClear, 6.578); near(kicker.width7, 16.659);
  assert.ok(kicker.edgeClear < t.clearAt(model.knuckleRun) && kicker.width7 < t.clearWidth(7));
  assert.ok(longer.edgeClear < kicker.edgeClear && longer.width7 < kicker.width7, 'a longer kicker costs more');
  // the collar tie: 13′-6″ long at 8 ft (a lower one would be longer), its ends cut to the slope of the upper chords, and a plate across each end joint on the tie and the chord
  const tie = t.tie;
  near(t.clearWidth(b.tieAt), 13.485);
  assert.ok(t.clearWidth(b.tieAt - 1) > t.clearWidth(b.tieAt) && t.clearAt(model.half) > b.tieAt, 'the tie sits under the ridge');
  near(tie.z, model.eave + b.tieAt, 1e-9); near(tie.length, t.clearWidth(b.tieAt), 1e-9); near(tie.from, t.clearFrom(b.tieAt), 1e-9); near(tie.deep, b.tieDeep / 12, 1e-9);
  const [bl, br, tr, tl] = tie.body;
  near(bl[1], tie.z, 1e-9); near(br[1], tie.z, 1e-9); near(tr[1], tie.z + tie.deep, 1e-9); near(tl[1], tie.z + tie.deep, 1e-9);
  near(br[0], model.width - bl[0], 1e-9); near(tr[0], model.width - tl[0], 1e-9);
  for (const [y] of [bl, br]) near(model.eave + t.clearAt(y), tie.z, 1e-6);
  for (const [y] of [tl, tr]) near(model.eave + t.clearAt(y), tie.z + tie.deep, 1e-6);
  assert.equal(tie.plates.length, 2);
  tie.plates.forEach(plate => plate.forEach(p => assert.ok(inside(p, tie.body) || t.chords.some(chord => inside(p, chord)), `a tie plate corner at ${p} is off the wood`)));
  assert.deepEqual(plain(model.specialTrusses.tied.map(x => x.number)), Array.from({ length: 20 }, (_, i) => i + 1), 'a tie on T1 to T20, none on the hoist trusses');
  assert.deepEqual(['kickerLeg', 'kickerEdgeClear', 'kickerWidth7', 'tieAt', 'tieLength', 'tieFrom', 'tieTo', 'tieDeep', 'tieTrusses', 'tieCount', 'webAt', 'heelHeight', 'heelBlockWide'].map(key => M.facts(model)[key]),
    ['2′-0″', '6′-7″', '16′-8″', '8′-0″', '13′-6″', '9′-3″', '22′-9″', '5½″', 'T1 to T20', '20', '3′-6″', '13″', '5½″']);
  // the profile draws a web and a kicker in each knee zone, the plates, and the tie, and the page explains the tie and the six steps
  const profile = D.trussProfile(model);
  assert.equal(count(profile, /class="c-web"/g), 4);
  assert.equal(count(profile, /class="c-plate"/g), 5, 'a plate at each knee and at the ridge, and one at each end of the tie');
  for (const letter of 'JKL') assert.equal(count(profile, new RegExp(`>${letter}<`, 'g')), 1, `the profile needs marker ${letter}`);
  // the last step comes into the room and is drawn to scale: a kicker at each knee, under the tie, with the number of the table and the letter of the profile
  const options = D.trussOptions(model), f = M.facts(model);
  assert.equal(count(options, /class="c-opt"/g), 2, 'a kicker at each knee');
  assert.equal(count(options, /class="c-plate"/g), 2, 'a plate at each end of the tie');
  for (const mark of ['6', 'J']) assert.equal(count(options, new RegExp(`class="mk-t">${mark}<`, 'g')), 1, `${mark} is marked once`);
  for (const text of [`${f.kickerEdgeClear} clear`, `${f.tieLength} long, its underside ${f.tieAt} up`, `7′ clear for ${f.kickerWidth7}, not ${f.clear7Width}`, `${f.tieAt} clear under it, ${f.clearRidge} to the ridge`])
    assert.ok(options.includes(text), `the options drawing should say "${text}"`);
  const page = read(path.join(DOCS, 'workshop_trusses.html'));
  assert.match(page, /id="bracing"/);
  assert.match(page, /data-fig="trussOptions"/);
  for (let step = 1; step <= 6; step++) assert.match(page, new RegExp(`<td class="center">${step}</td>`), `step ${step} is in the bracing table`);
  assert.doesNotMatch(page, /<td class="center">7<\/td>/, 'the tie is in the design, so the steps stop at 6');
  for (const letter of 'JKL') assert.match(page, new RegExp(`<span class="nums">${letter}</span>`), `the bracing table needs the marker ${letter}`);
  // the collar tie is the first row, and the hoist trusses take none
  const steps = page.slice(page.indexOf('id="bracing"'), page.indexOf('id="bearing"'));
  assert.match(steps, /None on <span data-m="hoistTrusses">T21 to T25<\/span>/);
  assert.ok(steps.indexOf('Collar tie</strong>, in the design') < steps.indexOf('Webs and kickers') && steps.indexOf('Deeper chords') < steps.indexOf('A short kicker across each knee'));
});

test('The special trusses are numbered from the west end: the stair trusses are T1 to T3 with T2 cut, and the hoist trusses are the last five', () => {
  const numbers = list => plain(list.map(entry => entry.number)), facts = M.facts(model);
  assert.deepEqual(numbers(model.specialTrusses.stairEdge), [1, 2, 3]);
  assert.deepEqual(numbers(model.specialTrusses.stairCut), [2]);
  assert.deepEqual(numbers(model.specialTrusses.hoist), [21, 22, 23, 24, 25]);
  assert.deepEqual([facts.stairTrusses, facts.stairCutTruss, facts.hoistTrusses, facts.lastTruss, facts.hoistTrussCount, facts.hoistStart], ['T1 to T3', 'T2', 'T21 to T25', 'T25', '5', '39′-0″']);
  assert.ok(model.trussX[19] < model.length - model.hoist.inside && model.trussX[20] > model.length - model.hoist.inside, 'the beam starts between T20 and T21');
  const short = M.create({ length: 46 });
  assert.deepEqual(numbers(short.specialTrusses.hoist), [20, 21, 22, 23, 24], 'a 46 ft building has 24 trusses, and the hoist reaches the last five');
});

test('The truss figures draw the open room, every truss, and the five special cases', () => {
  const count = (text, pattern) => (text.match(pattern) || []).length, facts = M.facts(model);
  const profile = D.trussProfile(model);
  assert.equal(count(profile, /class="c-clear"/g), 1);
  assert.equal(count(profile, /class="c-knee"/g), 2);
  for (const letter of 'ABCDEFGHIJKL') assert.equal(count(profile, new RegExp(`>${letter}<`, 'g')), 1, `the profile needs marker ${letter}`);
  for (const text of [`${facts.clearKnuckle} clear`, `${facts.tieAt} clear under the tie`, `7′ clear for ${facts.clear7Width}`, `5′ clear for ${facts.clear5Width}`, `${facts.trussChord} bottom chord`, `${facts.roomWidth} open room`])
    assert.ok(profile.includes(text), `the profile should say "${text}"`);
  const layout = D.trussLayout(model);
  assert.ok(layout.includes(`Collar tie ${facts.tieAt} up on ${facts.tieTrusses};`) && layout.includes('none on the hoist trusses'), 'the key says which trusses carry a tie');
  for (let number = 1; number <= model.trussCount; number++) assert.equal(count(layout, new RegExp(`>T${number}<`, 'g')), 1, `T${number} is labeled once`);
  assert.equal(count(layout, />T26</g), 0);
  for (const mark of ['S1', 'S2', 'S3', 'S4']) assert.equal(count(layout, new RegExp(`>${mark}<`, 'g')), 1, `${mark} is marked once`);
  assert.equal(count(layout, />S5</g), 2, 'S5 marks both gable trusses');
  // the key in the corner has one swatch for each kind of line
  assert.equal(count(layout, /class="l-tr[ "]/g), model.trussCount + 1 + 4, 'every truss is a line, and the cut truss is two');
  assert.equal(count(layout, /class="l-tr l-tr-gable/g), 2 + 1);
  assert.equal(count(layout, /class="l-tr (l-tr-gable )?l-tr-stair"/g), 4 + 1, 'T1, the two pieces of T2, and T3');
  assert.equal(count(layout, /l-tr-hoist/g), 5 + 1);
  const short = D.trussLayout(M.create({ length: 46 }));
  assert.equal(count(short, />T24</g), 1);
  assert.equal(count(short, />T25</g), 0, 'a 46 ft building draws 24 trusses');
});

test('The truss tables are the model\'s numbers: the room outline, the roof line, and the headroom in from a wall', () => {
  const rows = html => Array.from(html.matchAll(/<tr><th scope="row">([^<]*)<\/th>((?:<td class="num">[^<]*<\/td>)+)<\/tr>/g), m => [m[1], ...Array.from(m[2].matchAll(/<td class="num">([^<]*)<\/td>/g), c => c[1])]);
  const stations = rows(P.trussTable(model, 'stations'));
  assert.deepEqual(stations.map(r => r[0]), ['1′-0″', '2′-0″', '3′-0″', '4′-0″', '5′-0″', '6′-0″', '7′-0″ (pitch break)', '8′-0″', '10′-0″', '12′-0″', '14′-0″', '16′-0″ (ridge)']);
  assert.deepEqual(stations.find(r => r[0].startsWith('7′')), ['7′-0″ (pitch break)', '8′-0″', '7′-1″'], 'the roof line is 8′-0″ at the pitch break and the clear height 7′-1″');
  assert.deepEqual(stations.find(r => r[0].startsWith('16′')), ['16′-0″ (ridge)', '10′-6″', '9′-10″']);
  assert.deepEqual(rows(P.trussTable(model, 'room')).map(r => r.slice(1)), [['0′-10″', '0′-0″'], ['7′-0″', '7′-1″'], ['7′-4″', '7′-6″'], ['9′-3″', '8′-0″'], ['16′-0″', '9′-10″']]);
  assert.equal(rows(P.trussTable(model, 'room'))[3][0], 'Collar tie underside, to 22′-9″', 'the tie is a point of the room, with the far end of its length');
  assert.deepEqual(rows(P.trussTable(model, 'outline')).map(r => r.slice(1)), [['8″ outside the wall line', '9″ below'], ['0′-0″', '0′-0″'], ['7′-0″', '8′-0″'], ['16′-0″', '10′-6″']]);
  assert.throws(() => P.trussTable(model, 'nothing'), /unknown truss table/);
  assert.equal(M.feetInchesQuarter(31.396), '31′-4¾″');
  assert.equal(M.feetInchesQuarter(32), '32′-0″');
  assert.equal(M.feetInchesQuarter(30.521), '30′-6¼″');
  assert.equal(M.inches(9.25), '9¼″');
});

test('The truss page is a brief for the plant: loads, geometry, and what to send back, with no prices and no paid work', () => {
  const html = read(path.join(DOCS, 'workshop_trusses.html')), text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
  assert.doesNotMatch(text, /\$|\bbudget\b|\bmidpoint\b/i, 'the truss page goes to a vendor, so it carries no prices or budget');
  for (const pattern of [/120<\/span> psf ground snow/, /115<\/span> mph/, /Exposure <span data-m="exposure">C<\/span>/, /Risk Category II/, /<span data-m="loftLive">40<\/span> psf/, /\(3\) 1¾″ × 9¼″ LVL/, /boom truck, as its own line/, /Idaho-licensed engineer/,
    /no webs or posts/, /crossed only by a <strong>collar tie<\/strong> on <span data-m="tieTrusses">T1 to T20<\/span>/, /data-fig="trussProfile"/, /data-fig="trussLayout"/, /data-fig="detail7"/, /data-truss="stations"/])
    assert.match(text, pattern);
  // every special case in the layout has a row in the page's table, and every anchor the page links to exists
  for (const mark of ['S1', 'S2', 'S3', 'S4', 'S5']) assert.match(text, new RegExp(`<span class="nums">${mark}</span>`), `${mark} needs a row`);
  for (const id of ['request', 'glance', 'loads', 'profile', 'headroom', 'bearing', 'special', 'send-back']) assert.ok(text.includes(`id="${id}"`), `the page needs the anchor ${id}`);
  // the loads on this page are the loads on the specs page
  const specs = read(path.join(DOCS, 'workshop_specs.html'));
  for (const key of ['snow', 'roofSnow', 'wind', 'loftLive']) assert.ok(text.includes(`data-m="${key}"`) && specs.includes(`data-m="${key}"`), `${key} appears on both pages`);
});

test('Every workshop page lists all six pages in its pager, and its own name is not a link', () => {
  const names = { 'workshop_pole_barn.html': 'Overview', 'workshop_specs.html': 'Specs', 'workshop_plans.html': 'Plans and elevations', 'workshop_sections.html': 'Sections and details', 'workshop_trusses.html': 'Trusses', 'workshop_materials.html': 'Materials and cost' };
  for (const page of PAGES) {
    const pager = /<p class="pager screen-only">([^]*?)<\/p>/.exec(read(path.join(DOCS, page)));
    assert.ok(pager, `${page} needs a pager`);
    for (const [other, name] of Object.entries(names)) {
      if (other === page) assert.ok(pager[1].includes(`<strong>${name}</strong>`) && !pager[1].includes(`href="${other}"`), `${page} shows its own name in bold, not as a link`);
      else assert.ok(pager[1].includes(`<a href="${other}">${name}</a>`), `${page} links to ${other}`);
    }
  }
});

test('The cost sheet keeps the boom-truck delivery and the same totals, and points the truss lines at the truss package', () => {
  const bom = M.bom(model), phase = num => bom.phases.find(p => p.num === num), item = (p, pattern) => phase(p).items.find(i => pattern.test(i.item));
  const boom = item(5, /boom truck/);
  assert.deepEqual([boom.qty, boom.low, boom.high, boom.src], [1, 400, 1000, 'Q']);
  assert.match(boom.notes, /own line on the quote/);
  assert.match(item(5, /Common gambrel attic truss/).notes, /truss package/);
  const insulation = item(20, /R-49/);
  assert.deepEqual([insulation.low, insulation.high], [500, 900], 'the roof insulation keeps its price until the method is chosen');
  assert.match(insulation.notes, /collar tie gives a flat ceiling only across the middle 13′-6″/);
  const facts = M.facts(model);
  assert.deepEqual([facts.budgetLow, facts.budgetMid, facts.budgetHigh], ['$103,600', '$137,600', '$176,700']);
  const materials = read(path.join(DOCS, 'workshop_materials.html')), overview = read(path.join(DOCS, 'workshop_pole_barn.html'));
  assert.match(materials, /href="workshop_trusses\.html">truss package<\/a>/);
  assert.match(overview, /How will the roof be insulated\?/);
  assert.match(overview, /href="workshop_trusses\.html">truss package<\/a>/);
});
