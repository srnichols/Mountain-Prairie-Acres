const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.join(__dirname, '..');
const context = { window: {} };
for (const name of ['site_grid', 'site_terrain', 'orchard_model', 'water_harvesting']) {
  vm.runInNewContext(fs.readFileSync(path.join(root, 'docs', 'data', name + '.js'), 'utf8'), context);
}
const model = context.window.OrchardModel;
const grid = context.window.SiteGrid;

test('Generated orchard model preserves current assignments and vacancies', () => {
  const { records, rows } = model.plan();
  const active = rows.flatMap(row => row.trees.filter(Boolean));
  assert.equal(records.length, 115);
  assert.equal(active.length, 111);
  assert.equal(active.filter(tree => !tree.rootstockOnly).length, 110);
  assert.equal(rows.filter(row => row.reserved).reduce((sum, row) => sum + row.reserved, 0), 13);
  for (const [r, c] of [[4, 9], [5, 9], [5, 10], [8, 3]]) assert.equal(rows[r - 1].trees[c - 1], null);
  assert.equal(rows[5].trees[2].id, 'i56-1');
  assert.equal(grid.siteRef(...grid.treeXY(6, 3)), 'B10-E33-S35');
  active.forEach(tree => {
    assert.ok(model.nearestPartners(tree, records).every(partner => !partner.donor.orchardUpdate && !partner.donor.rootstockOnly));
  });
});

test('Generated orchard model retains every windbreak, hedge, and guild rule', () => {
  const { rows } = model.plan();
  assert.equal(model.windbreakLayout(rows.length).reduce((sum, row) => sum + row.count, 0), 59);
  assert.equal(model.guildLayout(rows).bushes.length, 40);
  assert.equal(model.guildLayout(rows).spare.length, 1);
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
