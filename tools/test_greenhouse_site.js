const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const DOCS = path.join(__dirname, '..', 'docs');
const read = file => fs.readFileSync(path.join(DOCS, file), 'utf8');

// The greenhouse model reads the grid, terrain, and climate data when it runs, so load them first, as a greenhouse page does.
const context = vm.createContext({ window: {} });
for (const file of ['data/site_grid.js', 'data/site_terrain.js', 'data/site_climate.js', 'greenhouse_model.js']) vm.runInContext(read(file), context, { filename: file });
const { Greenhouse: G, SiteGrid: grid } = context.window;
const rect = f => ({ x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1 });

test('The planned greenhouses on the site master grid are the footprints the greenhouse pages draw', () => {
  assert.deepEqual(rect(grid.feature('greenhouse_gothic')), rect(G.GOTHIC), 'move the tunnel in data/site.json and in GOTHIC in docs/greenhouse_model.js together');
  assert.deepEqual(rect(grid.feature('greenhouse_pit')), rect(G.PIT), 'move the pit greenhouse in data/site.json and in PIT in docs/greenhouse_model.js together');
});

test('The master grid page draws both greenhouses dashed with the other planned buildings', () => {
  const page = read('site_master_grid.html');
  assert.match(page, /\['house', 'garage', 'workshop', 'greenhouse_gothic', 'greenhouse_gothic_east', 'greenhouse_pit'\]\.forEach\(id => box\(F\(id\), \{[^}]*'stroke-dasharray'/);
  for (const id of ['greenhouse_gothic', 'greenhouse_gothic_east', 'greenhouse_pit']) assert.equal(grid.feature(id).group, 'planned', `${id} is listed with the planned buildings`);
});
