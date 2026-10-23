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
for (const file of ['workshop_model.js', 'workshop_draw.js', 'workshop_elevations.js', 'workshop_sections.js', 'workshop_details.js', 'workshop_site.js',
  'data/site_grid.js', 'data/site_terrain.js', 'workshop_page.js']) vm.runInContext(read(path.join(DOCS, file)), context, { filename: file });
const { WorkshopModel: M, WorkshopDraw: D, WorkshopPage: P, SiteGrid } = context.window;
const model = M.create();
// A 44 ft building without windows: the length and layout of the owner's original estimate, used to check the bill-of-materials arithmetic.
const reference = M.create({ length: 44, windowSpec: null });

const PAGES = ['workshop_pole_barn.html', 'workshop_specs.html', 'workshop_plans.html', 'workshop_sections.html', 'workshop_materials.html'];
const FIGURES = ['floorPlan', 'loftPlan', 'eastElevation', 'westElevation', 'northElevation', 'southElevation', 'sectionA', 'sectionB', 'foundationPlan', 'loftFramingPlan',
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
  assert.equal(model.peakZ, 28);
  assert.equal(model.knuckleZ, 24);
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

test('The gambrel geometry: 49 and 24 degree slopes, 12 ft of room at the ridge', () => {
  assert.ok(Math.abs(model.lowerAngle - 48.8) < 0.1);
  assert.ok(Math.abs(model.upperAngle - 24.0) < 0.1);
  assert.equal(model.headroomAt(7), 8);
  assert.equal(model.headroomAt(16), 12);
  assert.ok(Math.abs(model.usableWidth(7) - 19.75) < 1e-9);
  assert.ok(Math.abs(model.rvClearDoor - 26 / 12) < 1e-9);
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
  assert.equal(bom.lineCount, 126);
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

test('At 44 ft the model reproduces the original estimate\'s phase subtotals wherever that estimate was consistent', () => {
  const bom = M.bom(reference);
  // The original estimate's PHASE SUBTOTAL rows, low and high. Phases 1, 2, 8, 9, 11, and 14 differ on purpose: the model counts different quantities there.
  const expected = { 3: [2648, 4480], 4: [5416, 8694], 5: [10910, 17435], 6: [1665, 2230], 7: [1050, 1395], 10: [1349, 1912], 12: [375, 483], 13: [5700, 10450],
    15: [848, 1310], 16: [1306, 1815], 17: [480, 940], 18: [4235, 7369], 19: [4220, 8150], 20: [3415, 5190], 21: [724, 1165] };
  for (const [num, [low, high]] of Object.entries(expected)) {
    const phase = bom.phases.find(p => p.num === Number(num));
    assert.equal(Math.round(phase.low), low, `phase ${num} low`);
    assert.equal(Math.round(phase.high), high, `phase ${num} high`);
  }
  const quantity = (phase, text) => bom.phases.find(p => p.num === phase).items.find(i => i.item.includes(text)).qty;
  assert.equal(quantity(1, 'XPS'), 44);
  assert.equal(quantity(1, 'crushed gravel'), 18);
  assert.equal(quantity(6, 'girts'), 75);
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
  assert.equal(facts.rvClearDoor, '2′-2″');
  assert.equal(facts.rvClearLoft, '3′-4″');
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
  assert.deepEqual(plain({ wall: loft.wall, at: loft.at, width: loft.width, height: loft.height, sill: loft.sill }), { wall: 'W', at: 16, width: 3, height: 4, sill: 19 });
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
  assert.ok(Math.abs(h.gableMidAbovePad - ((16 + 28) / 2 + 13 / 12)) < 1e-9);
  assert.ok(Math.abs(h.avgFill - 1.325) < 1e-9);
  assert.ok(Math.abs(h.gableMidAboveOldGround - h.gableMidAbovePad - h.avgFill) < 1e-9);
  // the gambrel's gable is fuller than a triangle, so its whole-shape average (236 sq ft over 32 ft = 7.375 ft above the eave) is higher than the mid-point
  assert.ok(Math.abs(h.gableAvgAbovePad - (16 + 13 / 12 + 236 / 32)) < 1e-9);
  assert.ok(h.gableAvgAbovePad > h.gableMidAbovePad && h.gableAvgAbovePad > M.COUNTY.accessoryHeight, 'a strict average reads over 24 ft from the pad, which the page says');
  assert.deepEqual([facts.eaveAbovePad, facts.ridgeAbovePad, facts.gableMid, facts.gableMidOldGround, facts.gableAverage], ['17′-1″', '29′-1″', '23′-1″', '24′-5″', '24.5']);
  assert.deepEqual(plain(M.COUNTY), { accessoryHeight: 24, zoneHeight: 35, agStructureHeight: 80, frontYardSqFt: 1500, characterSqFt: 1500 });
  assert.ok(h.gableMidAbovePad < M.COUNTY.accessoryHeight, 'under the accessory limit from the pad');
  assert.ok(h.gableMidAboveOldGround > M.COUNTY.accessoryHeight, 'a little over it from the original ground, which the page says');
  assert.ok(h.ridgeAbovePad < M.COUNTY.zoneHeight);
  assert.equal(facts.accessoryReading, 'under by 11″');
});

test('The county table gives the rules, this building\'s numbers, and the condition on the agricultural exemption', () => {
  const html = P.countyTable(model, SiteGrid);
  assert.doesNotMatch(html, /NaN|undefined|\[object/);
  assert.equal((html.match(/<tr>/g) || []).length, 1 + 7, 'a header row and seven rules');
  for (const text of ['35 ft', '80 ft', '1,500 sq ft', '1,320 sq ft', '1,536 sq ft', '2,640 sq ft', '40 × 66 ft', '23′-1″', '24′-5″', '29′-1″', 'under by 11″', 'over by 5″', 'about 24.5 ft'])
    assert.ok(html.includes(text), `the county table should say ${text}`);
  assert.deepEqual(['good', 'look', 'stop'].map(cls => (html.match(new RegExp(`<td class="${cls}">`, 'g')) || []).length), [1, 4, 2]);
  const rowOf = title => new RegExp(`<th scope="row">${title}[\\s\\S]*?</tr>`).exec(html)[0];
  for (const text of ['solely', 'notarized', 'personal', 'inspect', 'orchard equipment', 'Does not fit as drawn', '7-2-46', 'zoning approval', 'on a farm', 'setbacks and height'])
    assert.ok(rowOf('Agricultural building').includes(text), `the agricultural row should mention ${text}`);
  for (const text of ['residential district', 'taller than the house at all', 'average height (mid-point)']) assert.ok(rowOf('Height of an accessory building').includes(text), `the height row should mention ${text}`);
  assert.ok(rowOf('Matching the house').includes('architectural character'));
  assert.match(rowOf('Matching the house'), /over the size where the character rule starts/);
  // at 46 ft the building is under the size where the character rule starts
  assert.match(P.countyTable(M.create({ length: 46 }), SiteGrid), /under the size where the character rule starts/);
  assert.match(html, /A 14 ft wall and a 27 ft peak[\s\S]*not found/);
  assert.match(html, /a length of 46 ft \(1,472 sq ft\) would clear the 1,500 sq ft figure, and 41 ft \(1,312 sq ft\) would clear half the house/);
  // a shorter building clears the front-yard cap, and the row says so
  assert.match(P.countyTable(M.create({ length: 40, windowSpec: null }), SiteGrid), /<td class="good">Within the cap\./);
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
