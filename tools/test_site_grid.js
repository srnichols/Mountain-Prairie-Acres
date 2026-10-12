const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'docs', 'data', 'site_grid.js'), 'utf8'), context);
const grid = context.window.SiteGrid;

test('SiteRef formats cell offsets in feet', () => {
  const cases = [
    [[112, 818], 'C17-E12-S18'],
    [[112.5, 818.25], 'C17-E12.5-S18.25'],
    [grid.treeXY(6, 3), 'B10-E33-S35'],
    [[0, 0], 'A1-E0-S0'],
    [[50, 800], 'B17-E0-S0'],
    [[49.999, 799.999], 'B17-E0-S0'],
    [[331.3, 1291.9], 'G26-E31.3-S41.9']
  ];
  cases.forEach(([point, expected]) => assert.equal(grid.siteRef(...point), expected));
});

test('SiteRef parses codes and preserves unknown locations', () => {
  const cases = [
    ['C17-E12-S18', [112, 818]],
    ['C17-E12.5-S18.25', [112.5, 818.25]],
    [' b19-e03.5-s07 ', [53.5, 907]],
    ['B10-E33-S35', [83, 485]],
    ['G26-E31.3-S41.9', [331.3, 1291.9]]
  ];
  cases.forEach(([code, expected]) => assert.deepEqual(Array.from(grid.fromSiteRef(code)), expected));
  assert.equal(grid.fromSiteRef('PENDING'), null);
  assert.equal(grid.fromSiteRef(' pending '), null);
});

test('SiteRef rejects malformed, non-finite, and out-of-lot locations', () => {
  const points = [
    [-1, 1], [340, 1200], [100, 1300], [NaN, 1], [1, Infinity],
    [null, null], ['83', 485], [true, 485]
  ];
  points.forEach(point => assert.throws(() => grid.siteRef(...point)));
  const codes = [
    '', 'H1-E1-S1', 'A0-E0-S0', 'A27-E0-S0', 'C17-E50-S18', 'C17-E12-S50',
    'C17-E-1-S18', 'C17-E12-N18', 'C17-E12.123-S18', 'G26-E40-S40',
    'G26-E31.3-S42', 'C17-E1e1-S18', 'PENDING-E0-S0', null, 123
  ];
  codes.forEach(code => assert.throws(() => grid.fromSiteRef(code)));
});

test('SiteRef round trips every orchard spot within half a hundredth of a foot', () => {
  const points = [[0.004, 0.004], [49.999, 799.999], [112.345, 818.765], [331.3, 1291.9]];
  for (let r = 1; r <= 15; r++) {
    for (let c = 1; c <= 13; c++) points.push(grid.treeXY(r, c));
  }
  points.forEach(([x, y]) => {
    const code = grid.siteRef(x, y);
    const [px, py] = grid.fromSiteRef(code);
    assert.ok(Math.abs(px - x) <= 0.005 + 1e-9);
    assert.ok(Math.abs(py - y) <= 0.005 + 1e-9);
    assert.equal(grid.siteRef(px, py), code);
  });
});
