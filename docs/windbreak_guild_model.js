// Mock-up numbers for the west windbreak as one guild row: red mulberries, hazelnuts, and a row of small berries in front of them,
// in place of the two separate rows and the walking lane. Nothing here is saved to the data files. The current plan is read from
// the orchard model (docs/data/orchard_model.js); the choices of the proposal are the constants below. Distances are feet:
// x east of the west fence, y north of the R1 line, z above the ground.
(function (root) {
'use strict';

// data/climate.json, site.latitude
const SITE = { latitude: 43.4737 };
// The step along the row. It is a whole, even number of feet, so every plant stands on a whole foot and so does every berry bush, half a step (3 ft) out of line
// with the trunks. The mulberries of pattern A are 12 ft apart, near the 12.5 ft of the plan today.
const STEP = 6;
// Clear ground between the hazelnuts' managed edge and the berry row's, wide enough to walk and pick.
const PICK_LANE = 3;
const MIN_PICK_LANE = 2;
// Josta is 5 to 8 ft tall and wide (docs/data/cultivar_library.js); the other small berries are smaller.
const BERRY = {
  kind: 'B', key: 'berries', name: 'Small berries', latin: 'Honeyberry, currant, gooseberry, aronia, and Josta', color: '#7CC242',
  managedWidth: 6, fullWidth: 8, height: '5–8 ft', spread: '5–8 ft; keep about 6 ft',
  profile: { trunk: 0.5, crownMid: 3.6, crownHalfHeight: 3.2, label: 'Josta and small berries', size: '5–8 ft' }
};
const PATTERNS = [
  { id: 'A', sequence: 'MH', label: 'One hazelnut between mulberries' },
  { id: 'B', sequence: 'MHH', label: 'Two hazelnuts between mulberries' },
  { id: 'C', sequence: 'MHHH', label: 'Three hazelnuts between mulberries' }
].map(pattern => ({ ...pattern, between: pattern.sequence.length - 1, short: pattern.sequence.split('').join('–') }));
const DEFAULT_PATTERN = 'B';

// How much of the sun a crown lets through: a beam that crosses `k` per ft of crown keeps exp(-k * feet), about a fifth along 20 ft.
// The season is the leaf-on months of both species, May 15 to September 30, sampled on the dates listed.
const LIGHT = {
  k: 0.08, minAltitude: 3, minutes: 15, reach: 120,
  season: [[5, 15], [6, 1], [6, 15], [7, 1], [7, 15], [8, 1], [8, 15], [9, 1], [9, 15], [9, 30]],
  midsummer: [6, 21]
};
// The two ways a mulberry can grow. "Kept" is the plan as drawn (the model's own crown). "Spread" is the open-grown habit the plan's notes
// warn of, between the 20 ft it is kept to and the 35 to 40 ft it reaches naturally, with limbs from 8 ft.
const MULBERRY_CROWNS = [
  { id: 'kept', label: 'Mulberries kept as the plan assumes', crown: null },
  { id: 'spread', label: 'Mulberries left to spread', crown: { width: 30, base: 8, top: 42 } }
];

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const RAD = Math.PI / 180;
const r2 = value => Math.round(value * 100) / 100;

function pattern(id) {
  const found = PATTERNS.find(entry => entry.id === id);
  if (!found) throw new Error(`Pattern ${id} is not one of ${PATTERNS.map(entry => entry.id).join(', ')}`);
  return found;
}

function kindsOf(OM) {
  const [tall, shrub] = OM.WINDBREAK.rows;
  const copy = (row, kind) => ({
    kind, key: row.key, name: row.name, latin: row.latin, color: row.color, managedWidth: row.managedWidth,
    fullWidth: row.fullWidth || row.managedWidth, height: row.height, spread: row.spread, profile: row.profile, invRows: row.invRows
  });
  return { M: copy(tall, 'M'), H: copy(shrub, 'H'), B: { ...BERRY, color: OM.C1_GUILDS.color } };
}

// What the planting records hold: mulberries, hazelnuts, and the berry bushes that are planned for the C1 guilds today. Each berry group
// carries the inventory sheet's own note about it (the honeyberries' says to plant them as one group and mix the varieties).
function stockOf(OM, kinds) {
  const berries = OM.C1_GUILDS.groups.map(group => ({ group, count: OM.lineCount(group.invRows), match: OM.INVENTORY_MATCH[group.invRows[0]] || null }));
  return { M: OM.lineCount(kinds.M.invRows), H: OM.lineCount(kinds.H.invRows), berries, berryTotal: berries.reduce((sum, entry) => sum + entry.count, 0) };
}

// The small plants on the inventory sheet that the plan does not place: the berries, brambles, and vines left over, and the perennials
// grown with them. `note` is the sheet's own note for the line.
const OTHER_SUBCATEGORIES = ['Berry', 'Perennial'];
function othersOf(OM) {
  return OM.INVENTORY.filter(line => OM.placementOf(line) === 'other' && OTHER_SUBCATEGORIES.includes(line[3])).map(line => {
    const [row, qty, , subcategory, type, variety, , , , , , note] = line;
    return { row, qty, subcategory, type, variety, name: type || variety, note: note || '' };
  });
}

// The orchard beside the strip, shared by every layout: the first-column trees, the alley limb edge, and the planting records.
function context(OM) {
  const { rows } = OM.plan();
  const W = OM.WINDBREAK;
  const kinds = kindsOf(OM);
  const span = (rows.length - 1) * OM.ROW_SPACING;
  const c1 = rows.map(row => {
    const tree = row.trees[0] || null;
    const reserved = !tree && row.reserved > 0;
    return {
      r: row.r, x: OM.ORCHARD_X0 + (row.off ? OM.TREE_SPACING / 2 : 0), y: (row.r - 1) * OM.ROW_SPACING,
      state: tree ? 'tree' : reserved ? 'reserved' : 'open',
      label: tree ? `${tree.code} (R${row.r}-C1)` : reserved ? `RS (R${row.r}-C1)` : 'open'
    };
  });
  return {
    rows, rowCount: rows.length, span, target: span + 2 * W.endMargin, stripWidth: W.width, orchardX0: OM.ORCHARD_X0, limb: W.orchardLimbAllowance,
    limbEdge: OM.ORCHARD_X0 - W.orchardLimbAllowance, minAlley: W.minAlley, shadeGap: W.shadeGap, rowSpacing: OM.ROW_SPACING,
    treeSpacing: OM.TREE_SPACING, c1, kinds, stock: stockOf(OM, kinds), others: othersOf(OM)
  };
}

// The berry groups in runs, south to north, in the order the C1 guilds use (honeyberry first). A kind stands together: the honeyberries,
// which need another cultivar to set fruit, are one group, and one net covers a run.
function runsOf(entries) {
  return entries.flatMap(entry => Array(entry.count).fill(entry.group));
}

function tally(plants, kind, have) {
  const positions = plants.filter(plant => plant.kind === kind).length;
  return { positions, planted: Math.min(positions, have), toAdd: Math.max(0, positions - have), spare: Math.max(0, have - positions), stock: have };
}

function rowSummary(plants, kind, x, spacing) {
  const list = plants.filter(plant => plant.kind === kind);
  const planted = list.filter(plant => plant.planted);
  return {
    kind, x, spacing, count: planted.length, toAdd: list.length - planted.length,
    start: list[0].y, end: list[list.length - 1].y, plantedEnd: planted.length ? planted[planted.length - 1].y : null
  };
}

// The plan as it stands: the mulberry row, a walking lane, the hazelnut row, the tractor alley, and the berries around the C1 trees.
function currentLayout(OM, ctx = context(OM)) {
  const wb = OM.windbreakLayout(ctx.rowCount);
  const alley = OM.alleyGeometry(), lane = OM.laneGeometry(), guilds = OM.guildLayout(ctx.rows);
  const byKey = { mulberry: 'M', hazelnut: 'H' };
  const plants = wb.flatMap(row => row.plants.map(plant => ({ kind: byKey[row.key], x: plant.x, y: plant.y, planted: true })));
  const berries = guilds.bushes.map(bush => ({ x: bush.x, y: bush.y, width: OM.C1_GUILDS.bushWidth, group: bush.group, planted: true, r: bush.r }));
  const shrub = ctx.kinds.H;
  const rows = wb.map(row => rowSummary(plants, byKey[row.key], row.x, row.spacing));
  return {
    id: 'now', title: 'Current plan', pattern: null, ctx, kinds: ctx.kinds, plants, berries, rows,
    band: alley.hedgeEdge, length: ctx.target,
    alley: { west: alley.hedgeEdge, east: alley.limbEdge, clear: alley.clear, ground: alley.ground, clearFull: alley.limbEdge - (wb[1].x + shrub.fullWidth / 2) },
    lane: { west: lane.west, east: lane.east, width: lane.width, name: 'Walking lane' },
    berryRow: null,
    counts: {
      M: tally(plants, 'M', ctx.stock.M), H: tally(plants, 'H', ctx.stock.H),
      berries: { positions: berries.length, planted: berries.length, toAdd: 0, spare: guilds.spare.length, stock: ctx.stock.berryTotal, place: 'around the C1 trees' }
    }
  };
}

// The guild row: the pattern repeats along the fence in `step` ft places, and one berry bush stands in front of every gap between two places.
function proposedLayout(OM, options = {}, ctx = context(OM)) {
  const chosen = pattern(options.pattern || DEFAULT_PATTERN);
  const step = options.step || STEP;
  const pickLane = options.pickLane === undefined ? PICK_LANE : options.pickLane;
  // Whole feet only: an even step puts every plant, and every berry bush half a step out of line, on a whole foot.
  if (!Number.isInteger(step) || step % 2 !== 0) throw new Error(`The step is ${step} ft: it must be an even number of whole feet`);
  if (!Number.isInteger(pickLane)) throw new Error(`The pick lane is ${pickLane} ft: it must be a whole number of feet`);
  if (pickLane < MIN_PICK_LANE) throw new Error(`A ${pickLane} ft pick lane is narrower than ${MIN_PICK_LANE} ft`);
  const K = ctx.kinds, size = chosen.sequence.length;
  const x = OM.WINDBREAK.rows[0].offset;
  // Whole patterns, so the row starts and ends with a mulberry, long enough to pass R1 and the last row by the end margin.
  const gaps = Math.ceil(Math.ceil(ctx.target / step - 1e-9) / size) * size;
  const length = gaps * step, start = ctx.span / 2 - length / 2;
  const hazelEdge = x + K.H.managedWidth / 2;
  const berryX = hazelEdge + pickLane + K.B.managedWidth / 2;
  const berryEdge = berryX + K.B.managedWidth / 2;
  const clear = ctx.limbEdge - berryEdge;
  if (clear < ctx.minAlley) throw new Error(`The tractor alley would be ${clear} ft, less than the ${ctx.minAlley} ft minimum`);

  const seen = { M: 0, H: 0 };
  const plants = Array.from({ length: gaps + 1 }, (_, index) => {
    const kind = chosen.sequence[index % size];
    return { kind, x, y: start + index * step, planted: seen[kind]++ < ctx.stock[kind] };
  });
  const mix = runsOf(ctx.stock.berries);
  const berries = Array.from({ length: gaps }, (_, index) => ({
    x: berryX, y: start + step / 2 + index * step, width: K.B.managedWidth, group: mix[index] || null, planted: index < mix.length
  }));
  const placed = Math.min(berries.length, mix.length);
  const rows = [
    rowSummary(plants, 'M', x, size * step), rowSummary(plants, 'H', x, chosen.between === 1 ? size * step : step),
    { kind: 'B', x: berryX, spacing: step, count: placed, toAdd: berries.length - placed,
      start: berries[0].y, end: berries[berries.length - 1].y, plantedEnd: placed ? berries[placed - 1].y : null }
  ];
  return {
    id: chosen.id, title: `Pattern ${chosen.id}: ${chosen.short}`, pattern: chosen, step, module: size * step, ctx, kinds: K, plants, berries, rows,
    band: berryEdge, length: ctx.target, rowLength: length,
    alley: { west: berryEdge, east: ctx.limbEdge, clear, ground: ctx.orchardX0 - berryEdge, clearFull: ctx.limbEdge - (berryX + K.B.fullWidth / 2) },
    lane: { west: hazelEdge, east: hazelEdge + pickLane, width: pickLane, name: 'Pick lane' },
    berryRow: { x: berryX, west: berryX - K.B.managedWidth / 2, east: berryEdge },
    counts: {
      M: tally(plants, 'M', ctx.stock.M), H: tally(plants, 'H', ctx.stock.H),
      berries: { positions: berries.length, planted: placed, toAdd: berries.length - placed, spare: mix.length - placed, stock: ctx.stock.berryTotal, place: 'in the front row' }
    }
  };
}

// What the proposal changes against the current plan, in the figures the pages quote.
function compare(now, proposed) {
  const length = now.length;
  return {
    band: { now: now.band, proposed: proposed.band, saved: now.band - proposed.band },
    alley: {
      now: now.alley.clear, proposed: proposed.alley.clear, gain: proposed.alley.clear - now.alley.clear,
      nowFull: now.alley.clearFull, proposedFull: proposed.alley.clearFull
    },
    ground: { now: now.alley.ground, proposed: proposed.alley.ground },
    area: { length, saved: (now.band - proposed.band) * length, alleyNow: now.alley.clear * length, alleyProposed: proposed.alley.clear * length },
    counts: Object.fromEntries(['M', 'H', 'berries'].map(key => [key, { now: now.counts[key].planted, proposed: proposed.counts[key].planted }]))
  };
}

// ------------------------------------------------------------------ sun and shade

function dayOfYear(month, day) {
  return MONTH_DAYS.slice(0, month - 1).reduce((sum, days) => sum + days, 0) + day;
}

// Declination in radians for a day of the year (Spencer's series, within half a degree).
function declination(dayNumber) {
  const b = 2 * Math.PI * (dayNumber - 1) / 365;
  return 0.006918 - 0.399912 * Math.cos(b) + 0.070257 * Math.sin(b) - 0.006758 * Math.cos(2 * b) + 0.000907 * Math.sin(2 * b)
    - 0.002697 * Math.cos(3 * b) + 0.00148 * Math.sin(3 * b);
}

// The sun's steps through one day in solar time (noon is the middle of the day, so the clock and the date's offsets do not matter).
// Each step has its length in hours, its altitude in degrees, and the unit vector toward the sun in x east, y north, z up.
function sunSteps(month, day, latitude = SITE.latitude, minutes = LIGHT.minutes) {
  const phi = latitude * RAD, delta = declination(dayOfYear(month, day));
  const hours = minutes / 60, steps = [];
  for (let at = -12; at < 12; at += hours) {
    const hourAngle = (at + hours / 2) * 15 * RAD;
    const sine = Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(hourAngle);
    const altitude = Math.asin(sine);
    if (altitude < LIGHT.minAltitude * RAD) continue;
    const fromSouth = Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(phi) - Math.tan(delta) * Math.cos(phi));
    steps.push({ hours, altitude: altitude / RAD, dir: [-Math.sin(fromSouth) * Math.cos(altitude), -Math.cos(fromSouth) * Math.cos(altitude), sine] });
  }
  return steps;
}

// Feet of crown on the straight line from a point toward the sun. A crown is an ellipsoid: `a` ft out from its middle, `c` ft up and down.
function crownPath(point, dir, crown) {
  const ux = (point.x - crown.x) / crown.a, uy = (point.y - crown.y) / crown.a, uz = (point.z - crown.z) / crown.c;
  const dx = dir[0] / crown.a, dy = dir[1] / crown.a, dz = dir[2] / crown.c;
  const A = dx * dx + dy * dy + dz * dz, B = ux * dx + uy * dy + uz * dz, C = ux * ux + uy * uy + uz * uz - 1;
  const disc = B * B - A * C;
  if (disc <= 0) return 0;
  const root = Math.sqrt(disc), enter = (-B - root) / A, leave = (-B + root) / A;
  return leave <= 0 ? 0 : leave - Math.max(enter, 0);
}

function crownOf(plant, kinds) {
  const spec = kinds[plant.kind];
  return { x: plant.x, y: plant.y, z: spec.profile.crownMid, a: spec.managedWidth / 2, c: spec.profile.crownHalfHeight };
}

// The share of the sun that reaches a point over the days given, weighted by the sun's height (the beam on level ground), and the
// hours of one day in which at least half of it arrives.
function exposure(point, crowns, season, midsummer) {
  const reach = crowns.filter(crown => Math.abs(crown.y - point.y) <= LIGHT.reach);
  const through = step => Math.exp(-LIGHT.k * reach.reduce((sum, crown) => sum + crownPath(point, step.dir, crown), 0));
  let all = 0, lit = 0, fullHours = 0;
  season.forEach(steps => steps.forEach(step => {
    const weight = step.dir[2] * step.hours;
    all += weight;
    lit += weight * through(step);
  }));
  midsummer.forEach(step => { if (through(step) >= 0.5) fullHours += step.hours; });
  return { share: lit / all, fullHours };
}

function summarize(values) {
  return { mean: values.reduce((sum, value) => sum + value, 0) / values.length, min: Math.min(...values), max: Math.max(...values) };
}

// A copy of the kinds with the mulberry's crown replaced by `crown` ({ width, base, top } in ft), or the kinds as they are.
function withMulberryCrown(kinds, crown) {
  if (!crown) return kinds;
  const profile = { ...kinds.M.profile, crownMid: (crown.base + crown.top) / 2, crownHalfHeight: (crown.top - crown.base) / 2 };
  return { ...kinds, M: { ...kinds.M, managedWidth: crown.width, profile } };
}

// How a mulberry crown is put in words, for the kept crown the plan's own size.
function crownDetail(entry, kinds) {
  const width = entry.crown ? entry.crown.width : kinds.M.managedWidth;
  const base = entry.crown ? entry.crown.base : kinds.M.profile.crownMid - kinds.M.profile.crownHalfHeight;
  return `${Math.round(width)} ft wide, limbs from ${Math.round(base)} ft`;
}

// Sun on the hazelnuts (and the berry row, where there is one) once every crown is full size: the share of the season's direct sun,
// and the hours of June 21 with at least half of it. A crown is its managed width, so a mulberry kept to 20 ft counts as 20 ft.
function light(layout, options = {}) {
  const latitude = options.latitude || SITE.latitude;
  const season = LIGHT.season.map(([month, day]) => sunSteps(month, day, latitude));
  const midsummer = sunSteps(LIGHT.midsummer[0], LIGHT.midsummer[1], latitude);
  const kinds = withMulberryCrown(layout.kinds, options.mulberry);
  const crowns = layout.plants.map(plant => ({ plant, crown: crownOf(plant, kinds) }));
  const measure = (targets, kind) => {
    if (!targets.length) return null;
    const z = kinds[kind].profile.crownMid;
    const results = targets.map(target => exposure({ x: target.x, y: target.y, z },
      crowns.filter(entry => entry.plant !== target).map(entry => entry.crown), season, midsummer));
    return { count: results.length, season: summarize(results.map(result => result.share)), fullHours: summarize(results.map(result => result.fullHours)) };
  };
  return {
    hazel: measure(layout.plants.filter(plant => plant.kind === 'H'), 'H'),
    berries: layout.pattern ? measure(layout.berries, 'B') : null,
    daylight: midsummer.reduce((sum, step) => sum + step.hours, 0)
  };
}

// The light on a layout's hazelnuts and berries for each way the mulberries can grow.
function lightByCrown(layout) {
  return Object.fromEntries(MULBERRY_CROWNS.map(entry => [entry.id, light(layout, { mulberry: entry.crown })]));
}

root.WindbreakGuild = {
  SITE, STEP, PICK_LANE, MIN_PICK_LANE, BERRY, PATTERNS, DEFAULT_PATTERN, LIGHT, MULBERRY_CROWNS, pattern, context, runsOf,
  currentLayout, proposedLayout, compare, dayOfYear, declination, sunSteps, crownPath, crownDetail, light, lightByCrown
};
})(typeof window !== 'undefined' ? window : globalThis);
