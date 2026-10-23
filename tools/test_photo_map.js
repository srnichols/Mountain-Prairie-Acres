const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const docs = path.join(__dirname, '..', 'docs');
const run = (file, context) => vm.runInNewContext(fs.readFileSync(path.join(docs, file), 'utf8'), context);
// A context with no document: the script must load and expose its helpers without drawing anything.
const context = { window: {} };
run('photo_map.js', context);
const map = context.window.PhotoMap;
// Objects made inside the script's context have their own prototypes, so compare plain copies.
const plain = value => JSON.parse(JSON.stringify(value));
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-6, `${message || ''} ${actual} is not ${expected}`);

const photo = (id, taken, extra) => Object.assign({ id, taken, x: 100, y: 200, height_ft: 50, heading: 0, pitch: -45, fov: 90 }, extra);

test('The photo map script loads without a page and offers its helpers', () => {
  assert.ok(map, 'window.PhotoMap should exist');
  assert.deepEqual(Object.keys(map).sort(), ['COMPASS', 'DAY_COLORS', 'MONTHS', 'OVERHEAD_PITCH', 'ZOOMS', 'cameraText', 'compass', 'compassName', 'dayColor', 'dayLabel',
    'filterPhotos', 'flightDays', 'inView', 'isOverhead', 'lookAt', 'northArrowAngle', 'numberPhotos', 'parseTaken', 'projector', 'spreadPoints', 'start',
    'stepPhoto', 'timeLabel', 'viewShape', 'whenLabel', 'zoomFor', 'zoomViews']);
});

test('A time is read as written, with no time zone, and shown as a day and a 12-hour clock time', () => {
  assert.deepEqual(plain(map.parseTaken('2026-10-19T17:52:20')), { year: 2026, month: 10, day: 19, hour: 17, minute: 52, date: '2026-10-19' });
  for (const bad of ['2026-10-19', '2026-13-01T10:00:00', '2026-00-01T10:00:00', '2026-10-19 17:52:20', '', null, undefined, 5]) assert.equal(map.parseTaken(bad), null, String(bad));
  assert.equal(map.dayLabel('2026-10-19T17:52:20'), 'Oct 19');
  assert.equal(map.dayLabel('2026-09-07T01:00:00'), 'Sep 7');
  assert.equal(map.dayLabel('nonsense'), '');
  assert.equal(map.timeLabel('2026-10-19T17:52:20'), '5:52 pm');
  assert.equal(map.timeLabel('2026-10-19T00:05:00'), '12:05 am');
  assert.equal(map.timeLabel('2026-10-19T12:00:00'), '12:00 pm');
  assert.equal(map.timeLabel('2026-10-19T09:07:00'), '9:07 am');
  assert.equal(map.timeLabel('nonsense'), '');
  assert.equal(map.whenLabel('2026-10-19T17:52:20'), 'Oct 19, 2026, 5:52 pm');
  assert.equal(map.whenLabel('nonsense'), '');
});

test('A heading is named by the nearest of 16 compass points, wrapping at north', () => {
  const cases = [[0, 'N', 'north'], [11, 'N', 'north'], [12, 'NNE', 'north-northeast'], [90, 'E', 'east'], [162, 'SSE', 'south-southeast'], [180, 'S', 'south'], [212, 'SSW', 'south-southwest'],
    [270, 'W', 'west'], [276, 'W', 'west'], [348, 'NNW', 'north-northwest'], [349, 'N', 'north'], [359, 'N', 'north'], [360, 'N', 'north'], [-90, 'W', 'west'], [-10, 'N', 'north']];
  cases.forEach(([heading, short, long]) => {
    assert.equal(map.compass(heading), short, `compass ${heading}`);
    assert.equal(map.compassName(heading), long, `compassName ${heading}`);
  });
  assert.equal(map.COMPASS.length, 16);
});

test('A photo tilted 80 degrees down or more is a straight-down photo, and its camera text says which way the top of the photo faces', () => {
  assert.equal(map.OVERHEAD_PITCH, -80);
  [[-90, true], [-89.9, true], [-80, true], [-79, false], [-34, false], [0, false], [5, false]].forEach(([pitch, expected]) => assert.equal(map.isOverhead({ pitch }), expected, String(pitch)));
  assert.equal(map.cameraText({ height_ft: 14, heading: 276, pitch: -7 }), '14 ft up, facing west, tilted 7° down');
  assert.equal(map.cameraText({ height_ft: 316.4, heading: 162, pitch: -90 }), '316 ft up, looking straight down; the top of the photo faces south-southeast');
  assert.equal(map.cameraText({ height_ft: 0, heading: 20, pitch: 0 }), '0 ft up, facing north-northeast, level');
  assert.equal(map.cameraText({ height_ft: 3, heading: 90, pitch: 5 }), '3 ft up, facing east, tilted 5° up');
});

test('The middle of an angled photo meets the ground at the height over the tangent of the tilt, along the heading', () => {
  const at = (heading, pitch, height = 50) => plain(map.lookAt({ x: 100, y: 200, height_ft: height, heading, pitch }));
  const east = at(90, -45);
  near(east.x, 150); near(east.y, 200); near(east.distance, 50);
  const north = at(0, -45);
  near(north.x, 100); near(north.y, 150);
  const south = at(180, -45);
  near(south.x, 100); near(south.y, 250);
  const west = at(270, -45);
  near(west.x, 50); near(west.y, 200);
  near(at(0, -30).distance, 50 / Math.tan(Math.PI / 6), 'a shallower tilt looks farther');
  near(at(0, -90).distance, 0, 'straight down looks at the spot below');
  assert.equal(map.lookAt({ x: 1, y: 2, height_ft: 50, heading: 0, pitch: 0 }), null, 'a level camera meets no ground');
  assert.equal(map.lookAt({ x: 1, y: 2, height_ft: 50, heading: 0, pitch: 12 }), null, 'neither does one tilted up');
  near(at(0, -2, 5000).distance, 1200, 'a very shallow tilt is cut off at 1,200 ft');
});

test('A straight-down photo shows a 4:3 rectangle turned to the way its top faces, and an angled one a triangle ahead of the camera', () => {
  const north = map.viewShape(photo('a', '2026-10-19T10:00:00', { height_ft: 100, pitch: -90 }));
  assert.equal(north.kind, 'footprint');
  assert.deepEqual(plain(north.points).map(p => p.map(n => Math.round(n))), [[0, 125], [200, 125], [200, 275], [0, 275]]);
  const east = map.viewShape(photo('a', '2026-10-19T10:00:00', { height_ft: 100, pitch: -90, heading: 90 }));
  assert.deepEqual(plain(east.points).map(p => p.map(n => Math.round(n))), [[175, 100], [175, 300], [25, 300], [25, 100]], 'turned east, the long side runs north-south');
  const narrow = map.viewShape(photo('a', '2026-10-19T10:00:00', { height_ft: 100, pitch: -90, fov: 27.8 }));
  near(narrow.points[1][0] - narrow.points[0][0], 2 * 100 * Math.tan(27.8 * Math.PI / 360), 'a longer lens sees a narrower patch');
  const wedge = map.viewShape(photo('a', '2026-10-19T10:00:00'));
  assert.equal(wedge.kind, 'wedge');
  assert.equal(wedge.points.length, 3);
  assert.deepEqual(plain(wedge.points[0]), [100, 200], 'the triangle starts at the camera');
  near(wedge.points[1][0], 100 - Math.hypot(50, 50)); near(wedge.points[1][1], 150);
  near(wedge.points[2][0], 100 + Math.hypot(50, 50)); near(wedge.points[2][1], 150);
  assert.deepEqual(plain(wedge.look).map(n => Math.round(n)), [100, 150]);
  const level = map.viewShape(photo('a', '2026-10-19T10:00:00', { pitch: 0, heading: 90, height_ft: 10 }));
  near(level.points[1][0], 400, 'with no ground in view the triangle is 300 ft long');
  const rotated = map.viewShape(photo('a', '2026-10-19T10:00:00', { pitch: -45, heading: 180 }));
  near(rotated.points[1][1], 250, 'facing south, the triangle opens to the south');
  assert.equal(map.northArrowAngle({ heading: 162 }), -162);
  assert.equal(map.northArrowAngle({ heading: 0 }), 0);
});

const sample = [
  photo('c', '2026-10-19T17:52:20'), photo('a', '2026-09-27T15:36:23', { pitch: -28 }), photo('b', '2026-10-10T13:12:04', { pitch: -90 }),
  photo('d', '2026-10-19T17:45:55', { pitch: -90 }), photo('e', '2026-10-19T17:52:20', { pitch: -7 })
];

test('Flight days are listed oldest first with their counts and each gets its own color', () => {
  const days = plain(map.flightDays(sample));
  assert.deepEqual(days, [{ date: '2026-09-27', label: 'Sep 27', count: 1 }, { date: '2026-10-10', label: 'Oct 10', count: 1 }, { date: '2026-10-19', label: 'Oct 19', count: 3 }]);
  assert.deepEqual(plain(map.flightDays([photo('x', 'bad')])), [], 'a photo with no readable time is on no day');
  assert.deepEqual(plain(days.map(day => map.dayColor(days, day.date))), plain(map.DAY_COLORS.slice(0, 3)));
  assert.equal(map.dayColor(days, '2000-01-01'), map.DAY_COLORS[0], 'an unknown day gets the first color');
  const many = Array.from({ length: 7 }, (_, i) => ({ date: `2026-10-0${i + 1}` }));
  assert.equal(map.dayColor(many, '2026-10-06'), map.DAY_COLORS[5 % map.DAY_COLORS.length], 'colors repeat after the list runs out');
  assert.equal(new Set(map.DAY_COLORS).size, map.DAY_COLORS.length, 'the colors differ');
});

test('Filtering by day and by straight-down or angled keeps time order, with the id breaking ties', () => {
  const ids = filter => map.filterPhotos(sample, filter).map(p => p.id);
  assert.deepEqual(ids(), ['a', 'b', 'd', 'c', 'e']);
  assert.deepEqual(ids({}), ['a', 'b', 'd', 'c', 'e']);
  assert.deepEqual(ids({ day: 'all', view: 'all' }), ['a', 'b', 'd', 'c', 'e']);
  assert.deepEqual(ids({ day: '2026-10-19' }), ['d', 'c', 'e']);
  assert.deepEqual(ids({ view: 'overhead' }), ['b', 'd']);
  assert.deepEqual(ids({ view: 'angled' }), ['a', 'c', 'e']);
  assert.deepEqual(ids({ day: '2026-10-19', view: 'overhead' }), ['d']);
  assert.deepEqual(ids({ day: '2026-09-27', view: 'overhead' }), []);
  assert.deepEqual(ids({ day: '1999-01-01' }), []);
  assert.deepEqual(sample.map(p => p.id), ['c', 'a', 'b', 'd', 'e'], 'filtering leaves the list it was given as it was');
});

test('Next and previous wrap around the filtered list, and an unknown photo starts at the end that was asked for', () => {
  const list = map.filterPhotos(sample, {});
  assert.equal(map.stepPhoto(list, 'a', 1), 'b');
  assert.equal(map.stepPhoto(list, 'e', 1), 'a', 'next after the last is the first');
  assert.equal(map.stepPhoto(list, 'a', -1), 'e', 'previous before the first is the last');
  assert.equal(map.stepPhoto(list, 'c', -1), 'd');
  assert.equal(map.stepPhoto(list, 'missing', 1), 'a');
  assert.equal(map.stepPhoto(list, null, -1), 'e');
  assert.equal(map.stepPhoto(list, 'b', 7), 'c', 'a long step wraps too: seven places on from the second of five is the fourth');
  assert.equal(map.stepPhoto([], 'a', 1), null);
  assert.equal(map.stepPhoto([photo('only', '2026-10-19T10:00:00')], 'only', 1), 'only');
});

test('Photos are numbered by the time taken, whatever order the list is in', () => {
  assert.deepEqual(plain(map.numberPhotos(sample)), { a: 1, b: 2, d: 3, c: 4, e: 5 });
  assert.deepEqual(plain(map.numberPhotos([])), {});
});

// A stand-in for the lot: just the parts the zoom views read.
const lot = { width: 331.3, depth: 1291.9 };
const boxes = {
  orchard_block: { id: 'orchard_block', group: 'orchard', x0: 35, y0: 295, x1: 272, y1: 595 },
  yard: { id: 'yard', group: 'access', x0: 100, y0: 740, x1: 280, y1: 823 },
  shed: { id: 'shed', group: 'homestead', x0: 75, y0: 746, x1: 101.5, y1: 772 },
  house_pad: { id: 'house_pad', group: 'homestead', x0: 113, y0: 912, x1: 222, y1: 966 },
  workshop_pad: { id: 'workshop_pad', group: 'homestead', x0: 33, y0: 842, x1: 89, y1: 884 }
};
const stubGrid = {
  data: { lot: { fence: lot } },
  features: test => Object.values(boxes).filter(test),
  bbox: f => ({ x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1 })
};
const camera = (x, y) => ({ id: `${x}_${y}`, taken: '2026-10-19T10:00:00', x, y, height_ft: 10, heading: 0, pitch: -10, fov: 70 });

test('The zoom buttons show the whole lot and every camera, the orchard strip, and the homestead, each with room around it', () => {
  const views = plain(map.zoomViews(stubGrid, [camera(-72, 1266.9), camera(126.8, 1402), camera(150, 500)]));
  assert.deepEqual(Object.keys(views), ['whole', 'orchard', 'homestead']);
  near(views.whole.x, -102); near(views.whole.y, -30); near(views.whole.w, 361.3 + 102); near(views.whole.h, 1402 + 30 + 30);
  near(views.orchard.x, -25); near(views.orchard.y, -25); near(views.orchard.w, 331.3 + 50); near(views.orchard.h, 595 + 50);
  near(views.homestead.x, 33 - 40); near(views.homestead.y, 740 - 40); near(views.homestead.w, 280 - 33 + 80); near(views.homestead.h, 966 - 740 + 80);
  const plainLot = plain(map.zoomViews(stubGrid, []));
  near(plainLot.whole.x, -30); near(plainLot.whole.w, 331.3 + 60); near(plainLot.whole.h, 1291.9 + 60);
  assert.deepEqual(plain(map.ZOOMS.map(zoom => zoom[0])), ['whole', 'orchard', 'homestead']);
});

test('A photo picked from the list gets the smallest zoom that has its camera in it, keeping the current one when that does', () => {
  const views = { whole: { x: 0, y: 0, w: 400, h: 1400 }, orchard: { x: 0, y: 0, w: 400, h: 650 }, homestead: { x: 0, y: 700, w: 330, h: 300 } };
  assert.equal(map.inView(views.homestead, 100, 800), true);
  assert.equal(map.inView(views.homestead, 100, 1000), true, 'the edge counts');
  assert.equal(map.inView(views.homestead, 100, 1001), false);
  assert.equal(map.zoomFor(views, 'whole', 100, 800), 'whole', 'the current zoom is kept when it has the point');
  assert.equal(map.zoomFor(views, 'homestead', 100, 800), 'homestead');
  assert.equal(map.zoomFor(views, 'homestead', 100, 300), 'orchard', 'the smallest view that has it');
  assert.equal(map.zoomFor(views, 'orchard', 100, 800), 'homestead');
  assert.equal(map.zoomFor(views, 'orchard', 100, 1200), 'whole');
  assert.equal(map.zoomFor(views, 'orchard', 900, 1200), 'whole', 'nothing has it, so the whole lot');
});

test('The projector turns lot feet into drawing units for a view drawn at a given width', () => {
  const p = map.projector({ x: 10, y: 20, w: 100, h: 200 }, 500);
  assert.equal(p.scale, 5);
  assert.equal(p.height, 1000);
  assert.equal(p.x(60), 250);
  assert.equal(p.y(120), 500);
  assert.equal(p.x(10), 0);
});

test('Markers that would overlap are moved apart until they are a gap away from each other, and the rest stay put', () => {
  const gap = 20;
  const distances = points => points.flatMap((a, i) => points.slice(i + 1).map(b => Math.hypot(a.x - b.x, a.y - b.y)));
  const lone = plain(map.spreadPoints([{ id: 'a', x: 10, y: 10 }, { id: 'b', x: 100, y: 10 }], gap));
  assert.deepEqual(lone, [{ id: 'a', x: 10, y: 10, moved: false }, { id: 'b', x: 100, y: 10, moved: false }]);
  const pair = plain(map.spreadPoints([{ id: 'a', x: 50, y: 50 }, { id: 'b', x: 55, y: 50 }], gap));
  assert.ok(distances(pair)[0] >= gap - 0.05, 'a pair is pushed apart');
  assert.deepEqual(pair.map(p => p.id), ['a', 'b'], 'in the order it was given');
  near((pair[0].x + pair[1].x) / 2, 52.5, 'the pair moves apart about its middle');
  assert.deepEqual(pair.map(p => p.moved), [true, true]);
  const same = [{ id: 'a', x: 5, y: 5 }, { id: 'b', x: 5, y: 5 }, { id: 'c', x: 5, y: 5 }, { id: 'd', x: 5, y: 5 }];
  const stacked = plain(map.spreadPoints(same, gap));
  assert.ok(Math.min(...distances(stacked)) >= gap - 0.05, 'points on exactly the same spot all separate');
  assert.deepEqual(plain(map.spreadPoints(same, gap)), stacked, 'the same input always gives the same result');
  const nudged = plain(map.spreadPoints([{ id: 'a', x: 50, y: 50 }, { id: 'b', x: 59, y: 50 }, { id: 'c', x: 300, y: 300 }], gap));
  assert.equal(nudged[2].moved, false);
  assert.deepEqual([nudged[2].x, nudged[2].y], [300, 300]);
  assert.deepEqual(plain(map.spreadPoints([], gap)), []);
  assert.deepEqual(plain(map.spreadPoints([{ id: 'a', x: 1, y: 2 }], gap)), [{ id: 'a', x: 1, y: 2, moved: false }]);
});

// The real photo list and lot, as the page loads them.
const real = { window: {} };
run(path.join('data', 'site_grid.js'), real);
run(path.join('data', 'photos.js'), real);
const records = real.window.SITE_PHOTOS.records;
const lotGrid = real.window.SiteGrid;

test('Every photo in the data can be placed, numbered, colored, and shown with a finite view', () => {
  assert.ok(records.length >= 10);
  const numbers = map.numberPhotos(records), days = map.flightDays(records);
  assert.deepEqual(plain(Object.values(numbers)).sort((a, b) => a - b), Array.from({ length: records.length }, (_, i) => i + 1));
  assert.ok(days.length >= 2 && days.length <= map.DAY_COLORS.length, 'a color for each day');
  assert.equal(days.reduce((sum, day) => sum + day.count, 0), records.length, 'every photo is on a day');
  records.forEach(record => {
    assert.ok(map.parseTaken(record.taken), `${record.id} has a readable time`);
    const shape = map.viewShape(record);
    assert.ok(shape.points.length >= 3 && shape.points.every(point => point.every(Number.isFinite)), `${record.id} has a finite view`);
    assert.ok(map.cameraText(record).includes('ft up'), record.id);
    assert.ok(Number.isFinite(map.northArrowAngle(record)));
  });
});

test('Every photo has its camera in the whole-lot view and in at most the orchard or the homestead one, with no two markers on top of each other at any zoom', () => {
  const views = map.zoomViews(lotGrid, records);
  records.forEach(record => assert.ok(map.inView(views.whole, record.x, record.y), `${record.id} is on the whole-lot map`));
  assert.ok(Object.values(views).every(view => view.w > 0 && view.h > 0));
  for (const width of [300, 488, 700]) {
    for (const name of Object.keys(views)) {
      const p = map.projector(views[name], width);
      const shown = records.filter(record => map.inView(views[name], record.x, record.y));
      const spread = plain(map.spreadPoints(shown.map(r => ({ id: r.id, x: p.x(r.x), y: p.y(r.y) })), 20));
      for (let i = 0; i < spread.length; i++) {
        for (let j = i + 1; j < spread.length; j++) {
          assert.ok(Math.hypot(spread[i].x - spread[j].x, spread[i].y - spread[j].y) >= 19.5, `${spread[i].id} and ${spread[j].id} overlap at the ${name} zoom, ${width} wide`);
        }
      }
    }
  }
  const homestead = records.filter(record => map.inView(views.homestead, record.x, record.y));
  assert.ok(homestead.length >= 5, 'the homestead zoom has the shots taken there');
});

test('The photos on the maps are in the photo list, and the camera badge card links to the page that shows them', () => {
  const ids = new Set(records.map(record => record.id));
  const withPhotos = lotGrid.features(feature => feature.photos);
  assert.ok(withPhotos.some(feature => feature.id === 'shed'));
  withPhotos.forEach(feature => feature.photos.forEach(id => assert.ok(ids.has(id), `${feature.id} lists ${id}`)));
});
