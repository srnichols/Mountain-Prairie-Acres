const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.join(__dirname, '..');
const context = { window: {} };
for (const name of ['site_grid', 'site_terrain', 'cultivar_library', 'orchard_model', 'water_harvesting']) {
  vm.runInNewContext(fs.readFileSync(path.join(root, 'docs', 'data', name + '.js'), 'utf8'), context);
}
const model = context.window.OrchardModel;
const grid = context.window.SiteGrid;

// A separate copy of the generated model, so a test can change planting records without touching the shared one.
function freshWindow() {
  const copy = { window: {} };
  for (const name of ['site_grid', 'site_terrain', 'cultivar_library', 'orchard_model']) {
    vm.runInNewContext(fs.readFileSync(path.join(root, 'docs', 'data', name + '.js'), 'utf8'), copy);
  }
  return copy.window;
}
test('Generated orchard model preserves current assignments and vacancies', () => {
  const { records, rows } = model.plan();
  const active = rows.flatMap(row => row.trees.filter(Boolean));
  assert.equal(records.length, 115);
  assert.equal(active.length, 109);
  assert.equal(active.filter(tree => !tree.rootstockOnly).length, 108);
  assert.equal(rows.filter(row => row.reserved).reduce((sum, row) => sum + row.reserved, 0), 13);
  for (const [r, c] of [[4, 9], [5, 9], [5, 10], [8, 1], [9, 2], [11, 10]]) assert.equal(rows[r - 1].trees[c - 1], null);
  assert.deepEqual(Array.from(rows.flatMap(row => row.held).map(tree => tree.id).sort()), ['i108-1', 'i63-1', 'i64-1', 'i65-1', 'i80-1', 'i88-1']);
  assert.equal(rows[5].trees[2].id, 'i56-1');
  assert.equal(rows[7].trees[2].id, 'i94-1');
  assert.equal(rows[7].trees[2].planted, true);
  assert.equal(rows[7].trees[0], null);
  assert.deepEqual(Array.from(active.filter(tree => tree.planted).map(tree => tree.id).sort()), ['i56-1', 'i94-1']);
  assert.equal(grid.siteRef(...grid.treeXY(6, 3)), 'B10-E33-S35');
  active.forEach(tree => {
    assert.ok(model.nearestPartners(tree, records).every(partner => !partner.donor.orchardUpdate && !partner.donor.rootstockOnly));
  });
});

test('Planted marks follow the orchard spot, not the plant number or an outside planting', () => {
  const treeAt = (rows, locationId) => {
    const [, r, c] = /^orchard-r(\d+)-c(\d+)$/.exec(locationId);
    return rows[r - 1].trees[c - 1];
  };
  const planted = rows => rows.flatMap(row => row.trees).filter(tree => tree && tree.planted).map(tree => tree.id).sort();

  // Trees under one tag are interchangeable: i62-4 recorded as planted where the layout puts i62-1 marks that spot only.
  const swapped = freshWindow();
  const locations = swapped.ORCHARD_DATA.PLANT_LOCATIONS;
  const first = locations['i62-1'];
  const fourth = locations['i62-4'];
  locations['i62-4'] = { ...first, status: 'planted' };
  locations['i62-1'] = { ...fourth };
  const { rows } = swapped.OrchardModel.plan();
  assert.equal(treeAt(rows, first.location_id).id, 'i62-1');
  assert.equal(treeAt(rows, first.location_id).planted, true);
  assert.equal(treeAt(rows, fourth.location_id).id, 'i62-4');
  assert.equal(treeAt(rows, fourth.location_id).planted, false);
  assert.deepEqual(Array.from(planted(rows)), ['i56-1', 'i62-1', 'i94-1']);

  // A tree planted outside the orchard leaves its old orchard spot open and unmarked.
  const outside = freshWindow();
  outside.ORCHARD_DATA.PLANT_LOCATIONS['i64-1'] = {
    status: 'planted', location_id: 'outside-c17', inventory_row: 64, site_ref: 'C17-E12-S18', x_ft: 112, y_ft: 818
  };
  const result = outside.OrchardModel.plan();
  assert.equal(result.records.find(tree => tree.id === 'i64-1').planted, false);
  assert.equal(result.rows[3].trees[8], null);
  assert.deepEqual(Array.from(planted(result.rows)), ['i56-1', 'i94-1']);
});

test('Dead plants are exported for the pages that count what is on hand', () => {
  const plants = JSON.parse(fs.readFileSync(path.join(root, 'data', 'plants.json'), 'utf8')).records;
  const dead = plants.filter(plant => plant.health_status === 'dead').map(plant => plant.id);
  assert.deepEqual(Array.from(context.window.ORCHARD_DATA.DEAD_PLANTS), dead);
  assert.deepEqual(dead, ['i24-1', 'i24-2', 'i80-1', 'i88-1', 'i108-1']);
});

test('Generated orchard model retains every windbreak, hedge, and guild rule', () => {
  const { rows } = model.plan();
  assert.equal(model.windbreakLayout(rows.length).reduce((sum, row) => sum + row.count, 0), 59);
  assert.equal(model.guildLayout(rows).bushes.length, 40);
  assert.equal(model.guildLayout(rows).spare.length, 1);
  assert.ok(model.guildLayout(rows).bushes.some(bush => bush.r === 8), 'A C1 spot held for a 2027 replacement keeps its guild positions');
  assert.equal(model.eastHedgeLayout(rows.length, 332).count, 19);
  assert.equal(model.ORCHARD_X0, 38);
  assert.equal(model.C1_GUILDS.groups.length, 5);
});

test('Generated browser records match the authoritative JSON', () => {
  const data = name => JSON.parse(fs.readFileSync(path.join(root, 'data', name + '.json'), 'utf8'));
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.SITE_GRID)), data('site'));
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.SITE_TERRAIN)), data('terrain'));
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.WATER_HARVESTING)), data('water_harvesting'));
  assert.equal(context.window.ORCHARD_DATA.INVENTORY.length, data('inventory').records.length);
  assert.equal(context.window.ORCHARD_DATA.FRUIT_SHEET.length, data('catalog').fruit_records.length);
});

test('Unidentified apple possibilities reconcile with purchases and planned spots', () => {
  const plain = value => JSON.parse(JSON.stringify(value));
  const apples = model.unidentifiedApples();
  assert.equal(apples.tag, 'AL-UnKn');
  assert.deepEqual(plain(apples.trees.map(tree => tree.id)), [1, 2, 3, 4, 5, 6].map(n => `i62-${n}`));
  assert.ok(apples.trees.every(tree => tree.status === 'planned' && /^R\d+-C\d+$/.test(tree.spot) && tree.siteRef));
  assert.equal(new Set(apples.trees.map(tree => tree.spot)).size, 6);
  assert.deepEqual(plain(apples.pool), { main:10, longShot:1, trees:6, lostMin:4, lostMax:5 });
  for (const candidate of apples.candidates) {
    const purchased = candidate.rows.reduce((total, row) => total + model.fruitRecord(row).quantity, 0);
    assert.equal(candidate.slots, purchased - candidate.taggedQty, candidate.name);
    assert.ok(candidate.profile.sources.length && candidate.profile.sources.every(([, link]) => link.startsWith('https://')), candidate.name);
  }
  assert.deepEqual(plain(apples.candidates.filter(candidate => !candidate.taggedQty).map(candidate => candidate.name)), ['Golden Russet', 'Empire']);
  assert.deepEqual(plain(apples.candidates.filter(candidate => candidate.slots > 1).map(candidate => candidate.name)), ['Cortland']);
  assert.deepEqual(plain(apples.candidates.filter(candidate => candidate.longShot).map(candidate => candidate.name)), ['Dolgo crabapple']);
});

test('Unidentified stone fruit possibilities reconcile with purchases and planned spots', () => {
  const plain = value => JSON.parse(JSON.stringify(value));
  const { info, lines } = model.unidentifiedStoneFruit();
  assert.ok(typeof info.assumption === 'string' && info.assumption.length > 40, 'The unconfirmed arrival assumption is stated on the sheet');
  assert.deepEqual(plain(lines.map(line => [line.type, line.tag, line.trees.length])), [['Cherry', 'CR-Sweet', 3], ['Peach', 'PC-Unk', 2], ['Apricot', 'AT-Unk', 1]]);
  assert.deepEqual(plain(lines.map(line => line.trees.map(tree => tree.label))), [['Sweet-1', 'Sweet-2', 'Sweet-3'], ['PcUnk-1', 'PcUnk-2'], ['AtUnk-1']]);
  assert.deepEqual(plain(lines.map(line => line.pool)), [
    { main:4, longShot:0, trees:3, lostMin:1, lostMax:1 },
    { main:4, longShot:0, trees:2, lostMin:2, lostMax:2 },
    { main:1, longShot:0, trees:1, lostMin:0, lostMax:0 }
  ]);
  const spots = lines.flatMap(line => line.trees.map(tree => tree.spot));
  assert.equal(new Set(spots).size, 6);
  for (const line of lines) {
    assert.ok(line.trees.every(tree => tree.status === 'planned' && /^R\d+-C\d+$/.test(tree.spot) && tree.siteRef), line.type);
    for (const candidate of line.candidates) {
      const purchased = candidate.rows.reduce((total, row) => total + model.fruitRecord(row).quantity, 0);
      assert.equal(candidate.slots, purchased - candidate.taggedQty, candidate.name);
      assert.ok(candidate.profile.sources.length && candidate.profile.sources.every(([, link]) => link.startsWith('https://')), candidate.name);
      assert.ok(candidate.profile.purchase_rows.every(row => candidate.rows.includes(row)), candidate.name);
    }
  }
  const patterson = lines[2].candidates[0];
  assert.equal(patterson.name, 'Patterson');
  assert.deepEqual(plain(patterson.tagged), []);
  assert.deepEqual(plain(patterson.compareWith), [{ invRow:70, tag:'AT-moorpark', qty:2 }]);
  assert.deepEqual(plain(lines[0].candidates.filter(candidate => candidate.slots > 1).map(candidate => candidate.name)), ['Black Tartarian']);
  assert.deepEqual(plain(lines.flatMap(line => line.candidates.filter(candidate => !candidate.taggedQty).map(candidate => candidate.name))), ['Sam Sweet', 'Regina', 'Veteran', 'Patterson']);
});

test('Cultivar library covers every inventory line and its links resolve', () => {
  const library = context.window.CultivarLibrary;
  const unprofiled = new Set(Object.keys(context.window.CULTIVAR_LIBRARY.unprofiled).map(Number));
  for (const line of context.window.ORCHARD_DATA.INVENTORY) {
    assert.ok(library.forInventoryRow(line[0]) || unprofiled.has(line[0]), `inventory row ${line[0]} has no profile`);
  }
  for (const row of model.FRUIT_BY_ROW.keys()) assert.ok(library.forPurchaseRow(row), `purchase row ${row} has no profile`);
  const seedRows = Object.keys(context.window.ORCHARD_DATA.SEED_LIST).map(Number);
  assert.equal(seedRows.length, 28);
  for (const row of seedRows) assert.ok(library.forSeedRow(row), `seed-list row ${row} has no profile`);
  assert.equal(library.forSeedRow(13).id, 'juniper-rocky-mountain');
  assert.equal(library.forSeedRow(12), library.forInventoryRow(20), 'Eastern red cedar is both on hand and on the seed list');
  assert.equal(library.forInventoryRow(21).id, 'juniper', 'The unconfirmed juniper line stays at genus level');
  assert.equal(library.forInventoryRow(29).name, 'Cortland');
  assert.equal(library.forPurchaseRow(10).id, 'apple-cortland');
  assert.equal(library.forInventoryRow(62), null);
  assert.equal(library.forInventoryRow(19).id, 'douglas-fir');
  assert.equal(library.byId('apple-cortland').inventory_rows[0], 29);
  assert.ok(library.tooltip(library.byId('apple-cortland')).startsWith('Cortland: '));
  assert.equal(library.guideHref(library.byId('apple-cortland')), 'cultivar_guide.html#apple-cortland');
  assert.equal(library.profiles.length, 137);
  assert.equal(library.GROUPS.length, 11);
  assert.ok(library.profiles.every(profile => library.GROUPS.includes(profile.group)));
});

test('Cultivar library describes habit, bark, and leaves only where a source does', () => {
  const library = context.window.CultivarLibrary;
  for (const profile of library.profiles) {
    for (const key of ['habit', 'bark', 'leaf']) {
      assert.ok(profile[key] === null || (typeof profile[key] === 'string' && profile[key].length >= 20), `${profile.id} ${key}`);
    }
  }
  const fir = library.byId('douglas-fir');
  assert.deepEqual(Array.from(library.traits(fir), ([label]) => label), ['Habit', 'Bark and twigs', 'Leaves']);
  assert.equal(library.barkLabel('Perennial'), 'Stems');
  assert.equal(library.barkLabel('Berry'), 'Stems and bark');
  assert.deepEqual(Array.from(library.traits({ group: 'Apple', habit: null, bark: null, leaf: null })), []);
  assert.deepEqual(Array.from(context.window.CULTIVAR_LIBRARY.group_notes, note => note.group), ['Apple', 'Pear', 'Cherry', 'Peach', 'Apricot', 'Plum']);
  assert.equal(library.groupNote('Apple').group, 'Apple');
  assert.equal(library.groupNote('Nut'), null);
  assert.ok(library.groupNote('Cherry').sources.length >= 2);
});
