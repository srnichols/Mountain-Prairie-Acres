const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.join(__dirname, '..');
const context = { window: {} };
for (const name of ['site_grid', 'site_terrain', 'cultivar_library', 'orchard_model', 'water_harvesting', 'site_climate', 'site_baselines']) {
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

// A copy of the generated model whose data has no planting plan, to compare the living-tree results against.
function windowWithoutPlan() {
  const copy = { window: {} };
  for (const name of ['site_grid', 'site_terrain', 'cultivar_library']) {
    vm.runInNewContext(fs.readFileSync(path.join(root, 'docs', 'data', name + '.js'), 'utf8'), copy);
  }
  const source = fs.readFileSync(path.join(root, 'docs', 'data', 'orchard_model.js'), 'utf8');
  const codeStart = source.indexOf('\n(function (root) {');
  assert.ok(codeStart > 0, 'The generated model should start its code after the data statement');
  vm.runInNewContext(`${source.slice(0, codeStart)}\ndelete window.ORCHARD_DATA.PLANTING_PLAN;${source.slice(codeStart)}`, copy);
  return copy.window;
}

// The generated baselines helper over a changed copy of the data, to see what a new year or a tie would do to its answers.
function baselinesWith(change) {
  const copy = { window: {} };
  const source = fs.readFileSync(path.join(root, 'docs', 'data', 'site_baselines.js'), 'utf8');
  const codeStart = source.indexOf('\n(function (root) {');
  assert.ok(codeStart > 0, 'The generated baselines should start their code after the data statement');
  vm.runInNewContext(source.slice(0, codeStart), copy);
  change(copy.window.SITE_BASELINES);
  vm.runInNewContext(source.slice(codeStart), copy);
  return copy.window.SiteBaselines;
}
test('Generated orchard model preserves current assignments and vacancies', () => {
  const { records, rows } = model.plan();
  const active = rows.flatMap(row => row.trees.filter(Boolean));
  assert.equal(records.length, 115);
  assert.equal(active.length, 107);
  assert.equal(active.filter(tree => !tree.rootstockOnly).length, 106);
  assert.equal(rows.filter(row => row.reserved).reduce((sum, row) => sum + row.reserved, 0), 13);
  for (const [r, c] of [[4, 9], [5, 9], [5, 10], [8, 1], [9, 2], [11, 7], [11, 10], [11, 12], [12, 7], [12, 11]]) assert.equal(rows[r - 1].trees[c - 1], null);
  assert.deepEqual(Array.from(rows.flatMap(row => row.held).map(tree => tree.id).sort()),
    ['i108-1', 'i63-1', 'i64-1', 'i65-1', 'i80-1', 'i83-1', 'i84-1', 'i88-1']);
  assert.equal(rows[5].trees[2].id, 'i56-1');
  assert.equal(rows[7].trees[2].id, 'i94-1');
  assert.equal(rows[7].trees[0], null);
  // The three Italian plums sit where the owner moved them (R11-C7 to R11-C6 and R12-C7 to R12-C5).
  assert.deepEqual(Array.from([[11, 6], [12, 5], [12, 6]].map(([r, c]) => rows[r - 1].trees[c - 1].invRow)), [111, 111, 111]);
  // The owner finished planting in October 2026: every living orchard tree is planted, and each fruit tree carries the month
  // (the planted M-111 rootstock was reported earlier, with no date).
  const fruit = active.filter(tree => !tree.rootstockOnly);
  assert.ok(active.every(tree => tree.planted));
  assert.deepEqual(Array.from(new Set(fruit.map(tree => tree.plantedOn))), ['2026-10']);
  assert.equal(active.find(tree => tree.rootstockOnly).plantedOn, null);
  assert.equal(model.plantedWhen(fruit), 'October 2026');
  assert.equal(grid.siteRef(...grid.treeXY(6, 3)), 'B11-E33-S0');
  active.forEach(tree => {
    assert.ok(model.nearestPartners(tree, records).every(partner => !partner.donor.orchardUpdate && !partner.donor.rootstockOnly));
  });
});

test('A shared-row block can list the exact columns its trees were planted in', () => {
  // The plum block's alignment is "center", but the plums were planted just west of center (R11-C6, R12-C5, R12-C6); its columns list records that.
  const plums = context.window.ORCHARD_DATA.SHARED_ROWS[0].blocks.find(block => block.type === 'Plum');
  assert.deepEqual(JSON.parse(JSON.stringify(plums.columns)), [[6], [5, 6]]);
  const withColumns = columns => {
    const win = freshWindow();
    win.ORCHARD_DATA.SHARED_ROWS[0].blocks.find(block => block.type === 'Plum').columns = columns;
    return win.OrchardModel;
  };
  // The recorded plantings must match the template, so the old centered positions are rejected.
  assert.throws(() => withColumns([[7], [6, 7]]).plan(), /R11-C6 should be open in the row plan/);
  assert.throws(() => withColumns([[6]]).plan(), /columns must list each of the 2 shared rows/);
  assert.throws(() => withColumns([[6], [5]]).plan(), /needs 2 different columns from 1 to 13/);
  assert.throws(() => withColumns([[6], [5, 5]]).plan(), /needs 2 different columns from 1 to 13/);
  assert.throws(() => withColumns([[6], [5, 14]]).plan(), /needs 2 different columns from 1 to 13/);
  assert.throws(() => withColumns([[6], [1, 6]]).plan(), /overlaps/);
  // Without columns the block falls back to its alignment, which no longer matches the planted trees.
  assert.throws(() => withColumns(undefined).plan(), /should be open in the row plan/);
});

test('Planted marks follow the orchard spot, not the plant number or an outside planting', () => {
  const treeAt = (rows, locationId) => {
    const [, r, c] = /^orchard-r(\d+)-c(\d+)$/.exec(locationId);
    return rows[r - 1].trees[c - 1];
  };
  const planted = rows => rows.flatMap(row => row.trees).filter(tree => tree && tree.planted).map(tree => tree.id).sort();
  // Every tree is planted in the shipped records, so each case starts from a copy where nothing is planted yet.
  const nothingPlanted = () => {
    const win = freshWindow();
    Object.values(win.ORCHARD_DATA.PLANT_LOCATIONS).forEach(planting => { planting.status = 'planned'; planting.planted_on = null; });
    return win;
  };
  assert.equal(planted(nothingPlanted().OrchardModel.plan().rows).length, 0);

  // Trees under one tag are interchangeable: i62-4 recorded as planted where the layout puts i62-1 marks that spot only,
  // and the planting month follows the same spot.
  const swapped = nothingPlanted();
  const locations = swapped.ORCHARD_DATA.PLANT_LOCATIONS;
  const first = locations['i62-1'];
  const fourth = locations['i62-4'];
  locations['i62-4'] = { ...first, status: 'planted', planted_on: '2026-11' };
  locations['i62-1'] = { ...fourth };
  const { rows } = swapped.OrchardModel.plan();
  assert.equal(treeAt(rows, first.location_id).id, 'i62-1');
  assert.equal(treeAt(rows, first.location_id).planted, true);
  assert.equal(treeAt(rows, first.location_id).plantedOn, '2026-11');
  assert.equal(treeAt(rows, fourth.location_id).id, 'i62-4');
  assert.equal(treeAt(rows, fourth.location_id).planted, false);
  assert.equal(treeAt(rows, fourth.location_id).plantedOn, null);
  assert.deepEqual(Array.from(planted(rows)), ['i62-1']);

  // A tree planted outside the orchard leaves its old orchard spot open and unmarked.
  const outside = nothingPlanted();
  outside.ORCHARD_DATA.PLANT_LOCATIONS['i64-1'] = {
    status: 'planted', location_id: 'outside-c17', inventory_row: 64, site_ref: 'C17-E12-S18', x_ft: 112, y_ft: 818
  };
  const result = outside.OrchardModel.plan();
  assert.equal(result.records.find(tree => tree.id === 'i64-1').planted, false);
  assert.equal(result.rows[3].trees[8], null);
  assert.deepEqual(Array.from(planted(result.rows)), []);
});

test('Planting months are worded for the pages that summarize them', () => {
  const when = (...months) => model.plantedWhen(months.map(plantedOn => ({ plantedOn })));
  assert.equal(when('2026-10', '2026-10-18'), 'October 2026');
  assert.equal(when('2026-10', '2026-11-03'), 'October to November 2026');
  assert.equal(when('2026-12', '2027-01'), 'December 2026 to January 2027');
  assert.equal(when('2026-10', null), '', 'A tree with no date means the months are unknown');
  assert.equal(model.plantedWhen([]), '');
});

test('Dead plants are exported for the pages that count what is on hand', () => {
  const plants = JSON.parse(fs.readFileSync(path.join(root, 'data', 'plants.json'), 'utf8')).records;
  const dead = plants.filter(plant => plant.health_status === 'dead').map(plant => plant.id);
  assert.deepEqual(Array.from(context.window.ORCHARD_DATA.DEAD_PLANTS), dead);
  assert.deepEqual(dead, ['i24-1', 'i24-2', 'i80-1', 'i83-1', 'i84-1', 'i88-1', 'i108-1']);
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

test('Site climate helpers format dates and times and expose the dates to plan around', () => {
  const climate = context.window.SiteClimate;
  assert.equal(climate.monthDay('06-17'), 'Jun 17');
  assert.equal(climate.monthDay('12-01'), 'Dec 1');
  for (const bad of ['6-17', '13-01', '02-29', '04-31', '00-10', 'June 17', '']) assert.throws(() => climate.monthDay(bad), /calendar day/, bad);
  assert.equal(climate.dayNumber('01-01'), 1);
  assert.equal(climate.dayNumber('03-01'), 60);
  assert.equal(climate.dayNumber('06-17'), 168);
  assert.equal(climate.dayNumber('12-31'), 365);
  assert.equal(climate.hoursText(15.42), '15 h 25 m');
  assert.equal(climate.hoursText(8.95), '8 h 57 m');
  assert.equal(climate.hoursText(12), '12 h 0 m');
  assert.equal(climate.clock12('21:27'), '9:27 pm');
  assert.equal(climate.clock12('00:05'), '12:05 am');
  assert.equal(climate.clock12('12:30'), '12:30 pm');
  assert.equal(climate.clock12('06:02'), '6:02 am');
  assert.throws(() => climate.clock12('24:00'), /HH:MM/);

  const freeze = climate.planningDates(32);
  assert.deepEqual(
    [freeze.springRisk10, freeze.springMedian, freeze.fallRisk10, freeze.fallMedian, freeze.freeDays.p50],
    ['06-24', '06-17', '08-31', '09-09', 90]);
  // A colder threshold ends spring sooner and begins fall later.
  const hard = climate.planningDates(28);
  assert.ok(climate.dayNumber(hard.springMedian) < climate.dayNumber(freeze.springMedian));
  assert.ok(climate.dayNumber(hard.fallMedian) > climate.dayNumber(freeze.fallMedian));
  assert.throws(() => climate.summary(10), /No frost summary/);
  assert.throws(() => climate.source('nowhere'), /No climate source/);
  assert.equal(climate.source('snotel-prairie'), climate.primary);

  const months = climate.months();
  assert.equal(months.length, 12);
  assert.deepEqual(Array.from(months.map(month => month.name).slice(0, 3)), ['Jan', 'Feb', 'Mar']);
  assert.equal(months[6].high, 86.4);
  assert.equal(months[6].mean, 67.7);
  assert.equal(months[5].frostDays[32].yearsPct, 89);
  assert.equal(months[5].daylight.mean_hours, 15.36);
  assert.ok(months.every(month => month.high > month.low && month.mean > month.low && month.mean < month.high));

  // Risk lookups come straight from the yearly dates: a freeze after a spring date, or a first freeze before a fall date.
  // The expected counts were worked out separately in Python from the same yearly records.
  assert.equal(climate.springRiskAfter(32, '06-24'), 2 / 25);
  assert.equal(climate.springRiskAfter(32, '06-17'), 12 / 25);
  assert.equal(climate.springRiskAfter(28, '05-20'), 15 / 24);
  assert.equal(climate.springRiskAfter(24, '05-13'), 2 / 23);
  assert.equal(climate.springRiskAfter(32, '05-01'), 1);
  assert.equal(climate.fallRiskBefore(32, '09-01'), 4 / 26);
  assert.equal(climate.fallRiskBefore(28, '09-15'), 3 / 25);
  assert.equal(climate.fallRiskBefore(24, '10-10'), 11 / 23);
  // A freeze exactly on the date is not after it, in a leap year too. A plain day-of-year count would put 2000-06-20 (36 F),
  // 2012-06-20 (32 F), and 2016-05-10 (28 F) one day late and count each of them as after the date.
  assert.equal(climate.springRiskAfter(36, '06-20'), 20 / 25);
  assert.equal(climate.springRiskAfter(32, '06-20'), 6 / 25);
  assert.equal(climate.springRiskAfter(28, '05-10'), 17 / 24);
  assert.throws(() => climate.springRiskAfter(10, '06-01'), /No last_spring dates/);
  assert.throws(() => climate.fallRiskBefore(32, '13-01'), /calendar day/);
  // Years outside the summary period (2021 to 2025) are not counted.
  assert.equal(climate.summaryYears().length, 27);
  assert.deepEqual({ ...climate.extremeYear(32, 'last_spring', 'latest') }, { year: 2016, date: '07-11' });
  assert.deepEqual({ ...climate.extremeYear(32, 'last_spring', 'earliest') }, { year: 2015, date: '05-10' });
  assert.deepEqual({ ...climate.extremeYear(32, 'first_fall', 'earliest') }, { year: 1995, date: '08-09' });
  assert.deepEqual({ ...climate.extremeYear(24, 'first_fall', 'latest') }, { year: 2004, date: '10-31' });
  assert.equal(climate.isoDayNumber('2023-03-01'), 60);
  assert.equal(climate.isoDayNumber('2024-03-01'), 60);
  assert.equal(climate.isoDayNumber('2024-02-29'), 60);
  assert.equal(climate.isoDayNumber('2024-12-31'), 365);
  assert.throws(() => climate.isoDayNumber('6/17/2024'), /YYYY-MM-DD/);
});

test('Generated site climate data carries what the climate page draws', () => {
  const climate = context.window.SITE_CLIMATE;
  assert.equal(climate.sources.filter(source => source.role === 'primary').length, 1);
  assert.deepEqual(Array.from(climate.frost.thresholds_f), [36, 32, 28, 24]);
  for (const source of climate.sources) {
    assert.equal(source.temperature.high_f.length, 12, source.id);
    for (const threshold of climate.frost.thresholds_f) {
      const item = source.frost.summary[threshold];
      assert.ok(item.last_spring.earliest <= item.last_spring.p10 && item.last_spring.p10 <= item.last_spring.p50, `${source.id} ${threshold}`);
      assert.ok(item.last_spring.p50 <= item.last_spring.p90 && item.last_spring.p90 <= item.last_spring.latest, `${source.id} ${threshold}`);
      assert.ok(item.first_fall.earliest <= item.first_fall.p10 && item.first_fall.p90 <= item.first_fall.latest, `${source.id} ${threshold}`);
    }
  }
  // The measured season sits inside the NRCS range for this soil's setting, and the model estimates run longer.
  const [nrcsLow, nrcsHigh] = context.window.WATER_HARVESTING.soil.frostFree;
  const measured = context.window.SiteClimate.planningDates(32).freeDays;
  assert.ok(measured.p50 >= nrcsLow && measured.p50 <= nrcsHigh);
  assert.ok(context.window.SiteClimate.planningDates(32, context.window.SiteClimate.source('prism-lot')).freeDays.p50 > nrcsHigh);
  const days = climate.daylight.months.map(month => month.mean_hours);
  assert.equal(days.indexOf(Math.max(...days)), 5, 'June has the longest days');
  assert.equal(days.indexOf(Math.min(...days)), 11, 'December has the shortest days');
  assert.equal(climate.daylight.key_dates.length, 4);
  // The things still to check travel with the data, so the page lists them and the SQL table matches.
  assert.deepEqual(Array.from(climate.checks, item => item.id), ['usda-zone-map', 'bloom-dates', 'cold-air-drainage', 'minimum-thermometer',
    'wind-direction', 'county-snow-load', 'county-frost-depth', 'station-vs-baselines']);
  assert.ok(climate.checks.every(item => ['open', 'done'].includes(item.status) && (item.status === 'done') === (item.result !== null)));
});

test('Site baselines helpers read storms, snow, degree days, and wind from the generated data', () => {
  const b = context.window.SiteBaselines;
  const plain = value => JSON.parse(JSON.stringify(value));
  assert.equal(b.monthDay('02-20'), 'Feb 20');
  for (const bad of ['2-20', '13-01', '00-10', 'Feb 20', '']) assert.throws(() => b.monthDay(bad), /MM-DD/, bad);
  // A swale sized for a 25-year, 24-hour storm holds 2.55 inches of rain, and NOAA's 90 percent interval is 2.29 to 2.83.
  assert.equal(b.stormDepth('24-hr', 25), 2.55);
  assert.deepEqual([b.stormDepth('24-hr', 25, 'lower_in'), b.stormDepth('24-hr', 25, 'upper_in')], [2.29, 2.83]);
  assert.equal(b.stormDepth('60-min', 2), 0.476);
  assert.ok(Math.abs(b.stormRate('60-min', 10) - 0.946) < 1e-9, 'a one-hour storm falls at its own depth per hour');
  assert.ok(Math.abs(b.stormRate('24-hr', 25) - 2.55 / 24) < 1e-9);
  assert.throws(() => b.stormDepth('24-hr', 3), /return period/);
  assert.throws(() => b.stormDepth('1-hr', 25), /duration/);
  assert.throws(() => b.stormDepth('24-hr', 25, 'mean_in'), /table/);
  // The record's heaviest snowpack was 9.7 inches of water in 1999, about 50 pounds per square foot; the lightest was 1992.
  assert.deepEqual(plain(b.snowExtreme('peak_swe_in', 'max')), { year: 1999, value: 9.7 });
  assert.deepEqual(plain(b.snowExtreme('peak_swe_in', 'min')), { year: 1992, value: 0.9 });
  assert.equal(Math.round(b.snowPounds(9.7)), 50);
  assert.throws(() => b.snowExtreme('peak_swe_in', 'median'), /max or min/);
  assert.throws(() => b.snowExtreme('peak_on', 'max'), /No yearly snow measure/);
  // Degree days build up through summer and reach the year's total in December.
  const gdd50 = b.cumulativeDegreeDays(50);
  assert.equal(gdd50.length, 12);
  assert.equal(gdd50[11], 2051);
  assert.ok(gdd50.every((value, index) => index === 0 || value >= gdd50[index - 1]));
  assert.throws(() => b.cumulativeDegreeDays(40), /base 40/);
  // Chill: two winters in 21 had under 620 hours between 32 and 45 F, and none had under 2,400 hours at or below 45 F.
  assert.deepEqual(plain(b.chillWintersBelow(620)), { winters: 2, of: 21 });
  assert.deepEqual(plain(b.chillWintersBelow(2400, 'hours_45')), { winters: 0, of: 21 });
  assert.throws(() => b.chillWintersBelow(600, 'hours_ten'), /No chill measure/);
  // The model at the lot and Mountain Home put the winter wind in the east, and Pine Turnoff puts it in the west.
  const topSector = id => b.windTop(id, 'winter', 1)[0].sector;
  assert.deepEqual(['hrrr-lot', 'pine-turnoff-rwis', 'muo-asos'].map(topSector), ['E', 'W', 'E']);
  assert.equal(b.windRose('muo-asos', 'summer').length, 16);
  assert.deepEqual(plain(b.windTop('muo-asos', 'winter', 2).map(item => item.sector)), ['E', 'ESE']);
  assert.throws(() => b.windRose('muo-asos', 'monsoon'), /No season/);
  assert.throws(() => b.windSource('nowhere'), /No wind source/);
  // The county's values, and the hail near the lot.
  assert.deepEqual(['frost-depth', 'ground-snow-load', 'wind-speed', 'seismic-zone'].map(id => b.buildingValue(id).value), [30, 120, 115, 'C']);
  assert.throws(() => b.buildingValue('roof'), /No building value/);
  assert.deepEqual(plain(b.hailWithin(5).map(event => event.date)), ['2019-07-09', '2019-08-10']);
  assert.equal(b.hailWithin(25).length, 9);
  assert.equal(b.hailWithin(1).length, 0);
});

test('Snow years are ranked in words that stay right as years are added', () => {
  const b = context.window.SiteBaselines;
  const plain = value => JSON.parse(JSON.stringify(value));
  // Words up to tenth, then numbers with the right ending: 11th, 12th, and 13th are not 11st, 12nd, or 13rd.
  assert.deepEqual([1, 2, 3, 10].map(b.ordinal), ['first', 'second', 'third', 'tenth']);
  assert.deepEqual([11, 12, 13, 21, 22, 23, 24, 100, 101, 111, 112, 121].map(b.ordinal),
    ['11th', '12th', '13th', '21st', '22nd', '23rd', '24th', '100th', '101st', '111th', '112th', '121st']);
  for (const bad of [0, -1, 1.5, '2', NaN]) assert.throws(() => b.ordinal(bad), /whole number/, String(bad));
  // The first rank is the extreme itself, not "first lowest".
  assert.equal(b.rankWord(1, 'lowest'), 'lowest');
  assert.equal(b.rankWord(2, 'lowest'), 'second lowest');
  assert.equal(b.rankWord(24, 'highest'), '24th highest');
  // Water year 2026 peaked at 1.1 inches and only 1992 (0.9) peaked lower, so it was the second lowest of the 40 years on record.
  assert.deepEqual(plain(b.snowStanding(2026)), { lower: 1, higher: 38, tied: false, count: 40 });
  assert.deepEqual(plain(b.snowStanding(1992)), { lower: 0, higher: 39, tied: false, count: 40 });
  assert.deepEqual(plain(b.snowStanding(1999)), { lower: 39, higher: 0, tied: false, count: 40 });
  // 2013 and 2015 both peaked at 3.3 inches, which is a tie, not a rank.
  assert.deepEqual([2013, 2015].map(year => b.snowStanding(year).tied), [true, true]);
  assert.throws(() => b.snowStanding(1900), /No snow record/);
  // A new year is counted against the old ones: an ordinary year, a new record low, a tie with the old low, and a new record high.
  const withYear = peak => baselinesWith(data => data.snow.years.push({
    water_year: 2027, peak_swe_in: peak, peak_on: '2027-02-20', melt_out_on: '2027-03-30', last_snow_on: '2027-03-29', apr1_swe_in: 0, precip_in: 22 }));
  assert.deepEqual(plain(withYear(6.2).snowStanding(2027)), { lower: 25, higher: 15, tied: false, count: 41 });
  assert.deepEqual(plain(withYear(0.5).snowStanding(2027)), { lower: 0, higher: 40, tied: false, count: 41 });
  assert.deepEqual(plain(withYear(0.9).snowStanding(2027)), { lower: 0, higher: 39, tied: true, count: 41 });
  assert.deepEqual(plain(withYear(9.9).snowStanding(2027)), { lower: 40, higher: 0, tied: false, count: 41 });
  assert.equal(withYear(9.9).snowExtreme('peak_swe_in', 'max').year, 2027);
});

test('Generated site baselines carry what the baselines page draws', () => {
  const baselines = context.window.SITE_BASELINES;
  assert.equal(baselines.snow.years.length, 40);
  assert.equal(baselines.snow.years.filter(row => row.water_year >= 1991 && row.water_year <= 2020).length, baselines.snow.summary.years);
  assert.equal(baselines.storms.depth_in.length, baselines.storms.durations.length);
  assert.ok(baselines.storms.depth_in.every(row => row.length === baselines.storms.return_periods_years.length));
  for (const source of baselines.wind.sources) {
    for (const season of ['winter', 'spring', 'summer', 'fall']) {
      const total = source.rose_pct[season].reduce((sum, value) => sum + value, 0);
      assert.ok(Math.abs(total - 100) < 1, `${source.id} ${season} rose adds up to ${total}`);
    }
  }
  // Three independent solar sources agree on the year's sunshine, and the nearby station agrees with the model on humidity.
  const annual = baselines.sun.sources.map(source => source.annual);
  assert.ok(Math.max(...annual) / Math.min(...annual) < 1.15);
  const [model, station] = ['nasa-power', 'pine-turnoff-rwis'].map(id => baselines.humidity.sources.find(source => source.id === id).monthly);
  assert.ok(model.every((value, index) => Math.abs(value - station[index]) < 15));
  // Every number the page quotes about the county comes with the document that says it.
  const sources = new Set(baselines.building.sources.map(source => source.id));
  for (const item of baselines.building.values) assert.ok(item.source_ids.length > 0 && item.source_ids.every(id => sources.has(id)), item.id);
});

test('Generated browser records match the authoritative JSON', () => {
  const data = name => JSON.parse(fs.readFileSync(path.join(root, 'data', name + '.json'), 'utf8'));
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.SITE_GRID)), data('site'));
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.SITE_TERRAIN)), data('terrain'));
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.WATER_HARVESTING)), data('water_harvesting'));
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.SITE_CLIMATE)), data('climate'));
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.SITE_BASELINES)), data('site_baselines'));
  assert.equal(context.window.ORCHARD_DATA.INVENTORY.length, data('inventory').records.length);
  assert.equal(context.window.ORCHARD_DATA.FRUIT_SHEET.length, data('catalog').fruit_records.length);
});

test('Unidentified apple possibilities reconcile with purchases and planned spots', () => {
  const plain = value => JSON.parse(JSON.stringify(value));
  const apples = model.unidentifiedApples();
  assert.equal(apples.tag, 'AL-UnKn');
  assert.deepEqual(plain(apples.trees.map(tree => tree.id)), [1, 2, 3, 4, 5, 6].map(n => `i62-${n}`));
  assert.ok(apples.trees.every(tree => tree.status === 'planted' && tree.plantedOn === '2026-10' && /^R\d+-C\d+$/.test(tree.spot) && tree.siteRef));
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

test('Unidentified trees report a planting month only once they are planted', () => {
  const win = freshWindow();
  win.ORCHARD_DATA.PLANT_LOCATIONS['i62-1'].status = 'planned';
  const trees = win.OrchardModel.unidentifiedApples().trees;
  assert.equal(trees[0].status, 'planned');
  assert.equal(trees[0].plantedOn, null);
  assert.deepEqual(Array.from(new Set(trees.slice(1).map(tree => tree.plantedOn))), ['2026-10']);
  assert.equal(win.OrchardModel.plantedWhen(trees), '', 'One unplanted tree leaves the planting months unknown');
  assert.equal(win.OrchardModel.plantedWhen(trees.slice(1)), 'October 2026');
});

test('Unidentified stone fruit possibilities reconcile with purchases and planned spots', () => {
  const plain = value => JSON.parse(JSON.stringify(value));
  const { info, lines } = model.unidentifiedStoneFruit();
  assert.ok(typeof info.assumption === 'string' && info.assumption.length > 40, 'The unconfirmed arrival assumption is stated on the sheet');
  assert.deepEqual(plain(lines.map(line => [line.type, line.tag, line.trees.length])), [['Cherry', 'CR-Sweet', 3], ['Peach', 'PC-Unk', 2]]);
  assert.deepEqual(plain(lines.map(line => line.trees.map(tree => tree.label))), [['Sweet-1', 'Sweet-2', 'Sweet-3'], ['PcUnk-1', 'PcUnk-2']]);
  assert.deepEqual(plain(lines.map(line => line.pool)), [
    { main:4, longShot:0, trees:3, lostMin:1, lostMax:1 },
    { main:4, longShot:0, trees:2, lostMin:2, lostMax:2 }
  ]);
  const spots = lines.flatMap(line => line.trees.map(tree => tree.spot));
  assert.equal(new Set(spots).size, 5);
  for (const line of lines) {
    assert.ok(line.trees.every(tree => tree.status === 'planted' && tree.plantedOn === '2026-10' && /^R\d+-C\d+$/.test(tree.spot) && tree.siteRef), line.type);
    for (const candidate of line.candidates) {
      const purchased = candidate.rows.reduce((total, row) => total + model.fruitRecord(row).quantity, 0);
      assert.equal(candidate.slots, purchased - candidate.taggedQty, candidate.name);
      assert.ok(candidate.profile.sources.length && candidate.profile.sources.every(([, link]) => link.startsWith('https://')), candidate.name);
      assert.ok(candidate.profile.purchase_rows.every(row => candidate.rows.includes(row)), candidate.name);
    }
  }
  assert.deepEqual(plain(lines[0].candidates.filter(candidate => candidate.slots > 1).map(candidate => candidate.name)), ['Black Tartarian']);
  assert.deepEqual(plain(lines.flatMap(line => line.candidates.filter(candidate => !candidate.taggedQty).map(candidate => candidate.name))), ['Sam Sweet', 'Regina', 'Veteran']);
  assert.equal(model.inventoryLine(71)[5], 'Patterson');
  assert.equal(model.inventoryLine(71)[6], 'AT-Patterson');
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
  assert.equal(library.profiles.length, 162);
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

test('No library text calls this site alkaline; its soil pH is about 6.2', () => {
  assert.equal(context.window.WATER_HARVESTING.soil.ph, 6.2);
  const claim = /(alkaline|high-pH) (site|ground)|(dry|windy),? (windy,? )?(alkaline|high-pH)|which describes this site/i;
  const texts = [...context.window.CULTIVAR_LIBRARY.records, ...context.window.CULTIVAR_LIBRARY.group_notes]
    .flatMap(record => Object.values(record).filter(value => typeof value === 'string'));
  assert.deepEqual(texts.filter(text => claim.test(text)), []);
});

test('The 2027 planting plan fills every open spot in R1 to R12 and leaves living-tree pollination unchanged', () => {
  const { rows } = model.plan();
  const plan = context.window.ORCHARD_DATA.PLANTING_PLAN;
  const spots = model.plannedSpots();
  assert.equal(plan.year, 2027);
  assert.equal(plan.covers_rows, 12);
  assert.equal(spots.length, 49);
  assert.equal(new Set(spots.map(entry => entry.spot)).size, 49);
  const counts = {};
  spots.forEach(entry => { counts[entry.item.type] = (counts[entry.item.type] || 0) + 1; });
  assert.deepEqual(counts, { Apple: 26, Pear: 2, Cherry: 11, Peach: 4, Plum: 4, Apricot: 2 });
  spots.forEach(({ r, c, spot }) => assert.equal(rows[r - 1].trees[c - 1], null, `${spot} should be open`));
  rows.flatMap(row => row.held).forEach(tree => assert.ok(model.plannedAt(tree.r, tree.c), `R${tree.r}-C${tree.c} has no planned cultivar`));
  assert.equal(model.plannedAt(6, 4).item.cultivar, 'Dayton');
  // Spots left open by dead or moved trees are planned for the same fruit type; the moved plums' new spots are not planned.
  for (const [r, c, type] of [[11, 7, 'Plum'], [12, 7, 'Plum'], [11, 10, 'Peach'], [11, 12, 'Peach'], [12, 11, 'Peach'], [9, 2, 'Cherry'], [8, 1, 'Pear']]) {
    assert.equal(model.plannedAt(r, c).item.type, type, `R${r}-C${c}`);
  }
  // The other stone-fruit gap spots: two apricots in the higher spots of R11 beside the apricot block, plums beside the Italian plums,
  // and one more peach beside the peach block.
  for (const [r, c, type, cultivar] of [[11, 4, 'Apricot', 'Chinese (Mormon)'], [11, 5, 'Apricot', 'Harcot'], [12, 3, 'Plum', 'Stanley'],
                                        [12, 4, 'Plum', 'Damson'], [12, 8, 'Peach', 'Reliance']]) {
    const entry = model.plannedAt(r, c);
    assert.deepEqual([entry.item.type, entry.item.cultivar], [type, cultivar], `R${r}-C${c}`);
  }
  assert.equal(model.plannedAt(11, 6), null);
  assert.equal(model.plannedAt(12, 5), null);
  // No hole in R1 to R12: every position holds a living tree or has a planned cultivar.
  const holes = [];
  for (let r = 1; r <= plan.covers_rows; r++) {
    for (let c = 1; c <= model.GRID_COLUMNS; c++) if (!rows[r - 1].trees[c - 1] && !model.plannedAt(r, c)) holes.push(`R${r}-C${c}`);
  }
  assert.deepEqual(holes, []);
  // The grafts are exactly the 13 reserved spots of R1; bought trees are everywhere else; R13 to R15 are left for later.
  const grafts = spots.filter(entry => entry.item.method === 'graft');
  assert.deepEqual(Array.from(grafts.map(entry => entry.spot).sort()), Array.from({ length: 13 }, (_, i) => `R1-C${i + 1}`).sort());
  assert.ok(grafts.every(entry => entry.item.type === 'Apple' && entry.r === 1));
  assert.ok(spots.filter(entry => entry.item.method === 'buy').every(entry => entry.r > 1 && entry.r <= 12));
  assert.equal(spots.filter(entry => entry.r > 12).length, 0);
  assert.equal(model.plannedAt(1, 1).item.cultivar, 'Chestnut crabapple');
  assert.equal(model.plannedAt(13, 1), null);
  // Planned trees stand in for cultivars not bought yet, so every living tree keeps exactly the partners it has without the plan.
  const bare = windowWithoutPlan().OrchardModel;
  assert.equal(bare.plannedSpots().length, 0);
  const partnersOf = m => {
    const { records: trees } = m.plan();
    return Array.from(trees.filter(tree => tree.r != null).map(tree =>
      `${tree.id}: ` + m.nearestPartners(tree, trees).map(p => `${p.donor.id} ${p.distance.toFixed(2)} ${p.basis}`).join('; ')));
  };
  const withPlan = partnersOf(model);
  assert.ok(withPlan.length > 100 && withPlan.filter(line => !line.endsWith(': ')).length > 50, 'The comparison should cover real partner lists');
  assert.deepEqual(withPlan, partnersOf(bare));
});

test('Every planned cultivar has a library profile of the same fruit type with sources', () => {
  const library = context.window.CultivarLibrary;
  for (const item of context.window.ORCHARD_DATA.PLANTING_PLAN.items) {
    const profile = library.byId(item.profile);
    assert.ok(profile, item.id);
    assert.equal(profile.type, item.type, item.id);
    assert.ok(profile.sources.length >= 1 && profile.sources.every(([, link]) => link.startsWith('https://')), item.id);
    assert.ok(!/PLACEHOLDER/.test(JSON.stringify(profile)), `${item.id} still has a placeholder profile`);
    assert.ok(!/TEMPORARY|TMP/.test(JSON.stringify(item)), `${item.id} still has temporary text`);
  }
});

test('Planned apples have several pollination partners, even if a flowering group is one off', () => {
  const partnerCounts = win => {
    const { records } = win.OrchardModel.plan();
    return win.OrchardModel.plannedPollination(records).filter(entry => entry.tree.type === 'Apple').map(entry => entry.partners.length);
  };
  const base = partnerCounts(context.window);
  assert.equal(base.length, 26);
  assert.ok(Math.min(...base) >= 3, `fewest partners: ${Math.min(...base)}`);
  const shifted = (ids, step) => {
    const win = freshWindow();
    win.ORCHARD_DATA.PLANTING_PLAN.items.forEach(item => { if (ids.includes(item.id)) item.flowering_group += step; });
    return Math.min(...partnerCounts(win));
  };
  assert.ok(shifted(['williams-pride', 'pristine', 'redfree', 'chestnut-crab'], -1) >= 2, 'early cultivars one group earlier');
  assert.ok(shifted(['dayton', 'freedom'], 1) >= 3, 'group-3 cultivars one group later');
  assert.ok(shifted(['haralson'], -1) >= 3, 'Haralson in group 3, as another source says');
  assert.ok(shifted(['akane', 'novamac', 'sansa', 'pixie-crunch'], -1) >= 3, 'group-4 grafts one group earlier');
});

test('The planned pear, cherries, plums, apricots and peaches follow the pollination rules', () => {
  const { records } = model.plan();
  const planned = name => model.plannedPollination(records).find(entry => entry.tree.name === name);
  const pear = planned('Harrow Delight');
  assert.deepEqual(Array.from(pear.partners, partner => partner.donor.name), ['Red Bartlett']);
  assert.ok(pear.partners[0].distance <= model.LOCAL_RADIUS);
  // Seckel is not a suitable pollinator for Bartlett, so the Bartlett trees beside it are not counted.
  const seckel = planned('Seckel');
  assert.deepEqual(Array.from(seckel.partners, partner => partner.donor.name), ['Comice']);
  assert.ok(seckel.tree.avoid.includes('Bartlett') && seckel.tree.avoid.includes('Red Bartlett'));
  const bartlett = records.find(tree => tree.name === 'Bartlett');
  assert.equal(model.compatiblePair(seckel.tree, bartlett), null);
  assert.ok(model.compatiblePair({ ...seckel.tree, avoid: [] }, bartlett), 'Without the exclusion the bloom chart would count it');
  const cherry = planned('Black Gold').tree;
  assert.equal(cherry.selfFertile, true);
  assert.equal(planned('Intrepid').partners.length, 0, 'A self-fertile peach needs no partner');
  // Black Gold blooms later than Bing, so it adds no pollen for Bing; a chart step earlier would.
  const bing = records.find(tree => tree.name === 'Bing');
  assert.equal(model.compatiblePair(bing, cherry), null);
  assert.ok(model.compatiblePair(bing, { ...cherry, cherryChart: { group: null, bloom: 4 } }));
  // The new sweet cherries are self-fertile and bloom a period after Bing, and tart cherries, plums, apricots and peaches need no partner.
  for (const name of ['Skeena', 'WhiteGold']) assert.equal(planned(name).tree.selfFertile, true, name);
  for (const name of ['Surefire', 'Meteor', 'Carmine Jewel', 'Mount Royal', 'Stanley', 'Damson', 'Chinese (Mormon)', 'Harcot', 'Contender', 'Harrow Diamond', 'Reliance']) {
    const entry = planned(name);
    assert.equal(entry.tree.selfFertile, true, name);
    assert.equal(entry.partners.length, 0, `${name} is self-fertile and nothing is counted as its partner`);
  }
});

test('Every tree recorded as dead was lost in its pot, and no other record is flagged that way', () => {
  const updates = context.window.ORCHARD_DATA.ORCHARD_UPDATES;
  const dead = Object.values(updates).filter(update => update.status === 'dead');
  assert.equal(dead.length, 5, 'The pear, the cherry, and the three peaches');
  assert.ok(dead.every(update => update.lostBeforePlanting === true));
  const outside = Object.values(updates).filter(update => update.status === 'outside-orchard');
  assert.equal(outside.length, 3, 'The three Urban apples');
  assert.ok(outside.every(update => update.lostBeforePlanting === false));
  const { records } = model.plan();
  const lostInPots = records.filter(tree => tree.orchardUpdate && tree.orchardUpdate.status === 'dead');
  assert.equal(lostInPots.length, 5);
  assert.ok(lostInPots.every(tree => tree.orchardUpdate.lostBeforePlanting));
});
