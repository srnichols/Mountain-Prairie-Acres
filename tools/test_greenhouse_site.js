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

test('The unheated four-layer tunnels are given a longer shoulder than the outdoor frost dates', () => {
  const s = G.tunnelSeason();
  const C = context.window.SiteClimate;
  assert.equal(s.glazing, '6 mm four-layer polycarbonate, vendor R-2.2');
  assert.ok(C.dayNumber(s.cold.start) < C.dayNumber(s.outdoor.spring28), 'cold crops start before the typical last 28°F night');
  assert.ok(C.dayNumber(s.cold.end) > C.dayNumber(s.outdoor.fall24), 'cold crops run past the typical first 24°F night');
  assert.ok(C.dayNumber(s.tender.set) < C.dayNumber(s.outdoor.spring32), 'tender crops are set before the typical last 32°F night');
  assert.equal(s.tender.end, s.outdoor.fall24, 'a night near 24°F outside still ends tomatoes');
  assert.match(read('gothic_greenhouse_plan.html'), /id="season-heading"/);
  assert.match(read('greenhouse_site_plan.html'), /id="u-cold-start"/);
  const pit = G.pitSeason();
  assert.ok(C.dayNumber(pit.hardyStarts) < C.dayNumber(s.cold.start), 'the pit opens before the tunnels');
  assert.ok(C.dayNumber(pit.tenderStarts) < C.dayNumber(s.tender.set), 'tender starts are raised before they are set in a tunnel');
  assert.ok(C.dayNumber(pit.cold.end) > C.dayNumber(s.cold.end), 'the pit stays open after the tunnels close');
  assert.ok(C.dayNumber(pit.tenderEnd) > C.dayNumber(s.tender.end), 'late fruit finishes in the pit');
  assert.match(read('pit_greenhouse_plan.html'), /id="season-heading"/);
  assert.match(read('pit_greenhouse_plan.html'), /four-layer polycarbonate/);
});

test('The Finch-style option is a 96 ft reconstruction and does not hold a January night on tubes alone', () => {
  const g = G.finchGeometry();
  const heat = G.finchHeat();
  assert.equal(G.FINCH.length, 96);
  assert.equal(G.FINCH.width, 17);
  assert.equal(g.bays, 16);
  assert.equal(g.tubes, 16);
  assert.equal(g.pipeFt, 4000);
  assert.ok(Math.abs(g.run + g.northCap - 17) < 1e-9, 'the glass run and the north cap fill the 17 ft width');
  assert.equal(g.rockClear, 2);
  assert.ok(heat.soil.januaryLow < heat.balanceOut, 'an average January night is colder than the tube balance point');
  assert.ok(heat.lossAtRecord > 70000 && heat.lossAtRecord < 80000, 'the record-night load stays inside the 80,000 BTU/hr heater step');
  const page = read('finch_greenhouse_plan.html');
  assert.match(page, /id="verdict-heading"/);
  assert.match(page, /not a copy of the Greenhouse in the Snow build manual/);
  assert.match(page, /id="s-eq"/);
  assert.match(read('greenhouse_model.js'), /march-equinox/);
  assert.match(read('greenhouse_model.js'), /september-equinox/);
  assert.match(read('site_nav.js'), /finch_greenhouse_plan\.html/);
});

test('The master grid page draws both greenhouses dashed with the other planned buildings', () => {
  const page = read('site_master_grid.html');
  assert.match(page, /\['house', 'garage', 'workshop', 'greenhouse_gothic', 'greenhouse_gothic_east', 'greenhouse_pit'\]\.forEach\(id => box\(F\(id\), \{[^}]*'stroke-dasharray'/);
  for (const id of ['greenhouse_gothic', 'greenhouse_gothic_east', 'greenhouse_pit']) assert.equal(grid.feature(id).group, 'planned', `${id} is listed with the planned buildings`);
});
