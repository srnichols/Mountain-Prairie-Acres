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
for (const file of ['workshop_model.js', 'workshop_draw.js', 'workshop_elevations.js', 'workshop_3d.js', 'workshop_sections.js', 'workshop_details.js', 'workshop_site.js',
  'data/site_grid.js', 'data/site_terrain.js', 'workshop_page.js']) vm.runInContext(read(path.join(DOCS, file)), context, { filename: file });
const { WorkshopModel: M, WorkshopDraw: D, WorkshopPage: P, SiteGrid } = context.window;
const model = M.create();
// A 44 ft building without windows: the length and layout of the owner's original estimate, used to check the bill-of-materials arithmetic.
const reference = M.create({ length: 44, windowSpec: null });

const PAGES = ['workshop_pole_barn.html', 'workshop_specs.html', 'workshop_plans.html', 'workshop_sections.html', 'workshop_materials.html'];
const FIGURES = ['floorPlan', 'loftPlan', 'eastElevation', 'westElevation', 'northElevation', 'southElevation', 'sidewallFraming', 'endwallFraming', 'framing3dSoutheast', 'framing3dNorthwest', 'sectionA', 'sectionB', 'foundationPlan', 'loftFramingPlan',
  'detail1', 'detail2', 'detail3', 'detail4', 'detail5', 'detail6', 'detail7', 'sitePlan'];

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
  // the frame follows the length: a 46 ft building has one truss fewer
  const short = D.framing3dCheck(M.create({ length: 46 }), 'southeast');
  assert.equal(short.counts['truss-top'], 4 * 24);
  assert.equal(short.forced, 0);
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
    const hooks = Array.from(html.matchAll(/data-(?:bom|fig|site)="\w+"/g), match => match[0]);
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
