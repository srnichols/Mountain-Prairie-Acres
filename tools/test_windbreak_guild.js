const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const DOCS = path.join(__dirname, '..', 'docs');
const read = file => fs.readFileSync(path.join(DOCS, file), 'utf8');
const near = (value, expected, tolerance, message) => assert.ok(Math.abs(value - expected) <= tolerance, `${message || ''} ${value} is not within ${tolerance} of ${expected}`);
// Arrays and objects made by the page scripts come from another realm, so they are copied before a deep comparison.
const plain = value => JSON.parse(JSON.stringify(value));

// The scripts the pages load, in the order the pages load them.
function load(extra = {}) {
  const context = { window: {}, ...extra };
  for (const file of ['data/orchard_model.js', 'windbreak_guild_model.js', 'windbreak_guild_draw.js', 'windbreak_guild_page.js']) {
    vm.runInNewContext(read(file), context);
  }
  return context;
}
const context = load();
const OM = context.window.OrchardModel, G = context.window.WindbreakGuild, D = context.window.WindbreakGuildDraw, P = context.window.WindbreakGuildPage;
const ctx = G.context(OM);
const now = G.currentLayout(OM, ctx);
const patterns = Object.fromEntries(G.PATTERNS.map(entry => [entry.id, G.proposedLayout(OM, { pattern: entry.id }, ctx)]));
const light = { now: G.lightByCrown(now), ...Object.fromEntries(Object.entries(patterns).map(([id, layout]) => [id, G.lightByCrown(layout)])) };
const kept = id => light[id].kept.hazel.season.mean, spread = id => light[id].spread.hazel.season.mean;

test('The current plan is read from the orchard model, not copied', () => {
  const wb = OM.windbreakLayout(ctx.rowCount);
  assert.equal(now.counts.M.planted, wb[0].count);
  assert.equal(now.counts.H.planted, wb[1].count);
  assert.deepEqual([now.counts.M.planted, now.counts.H.planted], [25, 34]);
  assert.equal(now.alley.clear, OM.alleyGeometry().clear);
  assert.equal(now.alley.clear, 7);
  assert.equal(now.band, 25, 'the hazelnut row ends 25 ft from the fence');
  assert.equal(now.lane.width, OM.laneGeometry().width);
  assert.equal(now.alley.clearFull, 6, 'the alley at the hazelnuts\' full 12 ft width');
  assert.equal(ctx.limbEdge, 32);
  assert.equal(ctx.stock.M, 25);
  assert.equal(ctx.stock.H, 34);
  assert.equal(ctx.stock.berryTotal, 41);
  assert.equal(now.counts.berries.planted + now.counts.berries.spare, 41, 'every berry bush is in a C1 guild or spare');
});

test('Each pattern repeats whole patterns along the fence, from a mulberry to a mulberry, past R1 and the last row', () => {
  assert.ok(Number.isInteger(G.STEP) && G.STEP % 2 === 0, 'the step is a whole, even number of feet, so the berry bushes half a step out of line are on whole feet too');
  for (const layout of Object.values(patterns)) {
    const sequence = layout.pattern.sequence, plants = layout.plants;
    assert.equal(plants[0].kind, 'M');
    assert.equal(plants[plants.length - 1].kind, 'M');
    plants.forEach((plant, index) => {
      assert.equal(plant.kind, sequence[index % sequence.length], `${layout.id} place ${index}`);
      assert.equal(plant.x, 5, 'the row stays where the mulberries are today');
      if (index) assert.equal(plant.y - plants[index - 1].y, G.STEP);
    });
    assert.ok(plants[0].y <= -OM.WINDBREAK.endMargin && plants[plants.length - 1].y >= ctx.span + OM.WINDBREAK.endMargin, `${layout.id} reaches the end margin`);
    near((plants[0].y + plants[plants.length - 1].y) / 2, ctx.span / 2, 1e-9, 'centered on the orchard');
    assert.equal(layout.module, sequence.length * G.STEP);
    for (const spot of [...plants, ...layout.berries]) assert.ok(Number.isInteger(spot.x) && Number.isInteger(spot.y), `${layout.id}: a plant at ${spot.x}, ${spot.y} is on a whole foot`);
    for (const row of layout.rows) assert.ok([row.x, row.spacing, row.start, row.end].every(Number.isInteger), `${layout.id} ${row.kind} row is in whole feet`);
  }
  assert.deepEqual(plain(Object.values(patterns).map(layout => [layout.module, layout.plants[0].y, layout.rowLength])), [[12, -10, 300], [18, -13, 306], [24, -16, 312]],
    'a guild is 12, 18, or 24 ft; each row is a whole number of guilds, reaching 10, 13, or 16 ft past R1');
});

test('The counts for each pattern, and what that leaves of the plants on hand', () => {
  const summary = layout => ['M', 'H'].map(kind => [layout.counts[kind].positions, layout.counts[kind].planted, layout.counts[kind].spare, layout.counts[kind].toAdd]);
  assert.deepEqual(summary(patterns.A), [[26, 25, 0, 1], [25, 25, 9, 0]]);
  assert.deepEqual(summary(patterns.B), [[18, 18, 7, 0], [34, 34, 0, 0]]);
  assert.deepEqual(summary(patterns.C), [[14, 14, 11, 0], [39, 34, 0, 5]]);
  const berries = layout => [layout.counts.berries.positions, layout.counts.berries.planted, layout.counts.berries.toAdd, layout.counts.berries.spare];
  assert.deepEqual([berries(patterns.A), berries(patterns.B), berries(patterns.C)], [[50, 41, 9, 0], [51, 41, 10, 0], [52, 41, 11, 0]], 'a bush in front of every gap between two places');
  for (const layout of Object.values(patterns)) assert.equal(layout.plants.filter(plant => plant.planted).length, layout.counts.M.planted + layout.counts.H.planted);
  // Pattern A is the same 300 ft row as today, from the same first mulberry to the same last, with the mulberries 12 ft apart where today's are 12.5 ft.
  const [todayM] = now.rows, [aM] = patterns.A.rows;
  assert.deepEqual([aM.start, aM.end, aM.spacing], [todayM.start, todayM.end, 12]);
  assert.equal(todayM.spacing, 12.5);
});

test('The berry row stands in runs by kind, honeyberries first as one group, and marks the rest of its places open', () => {
  const row = patterns.B.berries;
  const placed = row.filter(bush => bush.planted);
  assert.equal(placed.length, 41);
  assert.ok(row.slice(41).every(bush => !bush.planted && bush.group === null));
  // One run for each kind, in the order the C1 guilds use, each as long as the bushes of that kind on hand.
  const runs = [];
  placed.forEach(bush => { if (runs.length && runs[runs.length - 1].group === bush.group) runs[runs.length - 1].length++; else runs.push({ group: bush.group, length: 1 }); });
  assert.deepEqual(plain(runs.map(run => run.group.code)), plain(ctx.stock.berries.map(entry => entry.group.code)));
  assert.deepEqual(plain(runs.map(run => run.length)), plain(ctx.stock.berries.map(entry => entry.count)));
  assert.equal(runs[0].group.code, 'HB', 'the honeyberries come first');
  assert.equal(runs[0].length, 11, 'and are one group of all 11');
  assert.match(ctx.stock.berries[0].match.note, /plant them as one group and mix the varieties/, 'the sheet says so');
  assert.deepEqual(plain(G.runsOf([{ group: 'a', count: 2 }, { group: 'b', count: 1 }])), ['a', 'a', 'b']);
  row.forEach((bush, index) => {
    assert.equal(bush.x, 16);
    assert.equal(bush.y, patterns.B.plants[0].y + G.STEP / 2 + index * G.STEP, 'each bush is between two places of the row');
  });
});

test('The small plants on the inventory sheet that the plan leaves out are found from the model', () => {
  assert.deepEqual(plain(ctx.others.map(item => [item.row, item.name, item.qty, item.subcategory])), [
    [2, 'Blackberry', 3, 'Berry'], [6, 'Hardy Kiwi', 4, 'Berry'], [12, 'Sea Berry', 11, 'Berry'], [14, 'Rasberry?', 1, 'Berry'],
    [16, 'Comfrey', 25, 'Perennial'], [17, 'Mint', 18, 'Perennial'], [18, 'Rhubarb', 15, 'Perennial']
  ]);
  assert.equal(ctx.others.find(item => item.name === 'Mint').note, 'all planted');
  assert.ok(!ctx.others.some(item => /honey|josta|currant|gooseberry|viking/i.test(item.name)), 'the guild berries are in the row, not left out');
  const table = P.otherRows(patterns.B);
  assert.equal((table.match(/<tr>/g) || []).length, 8, 'honeyberry and the seven left out');
  for (const name of ['Honeyberry', 'Comfrey', 'Rhubarb', 'Sea Berry', 'Blackberry', 'Rasberry?', 'Hardy Kiwi', 'Mint']) assert.match(table, new RegExp(`<strong>${name.replace('?', '\\?')}</strong>`), name);
  assert.ok(table.indexOf('Comfrey') < table.indexOf('Rhubarb') && table.indexOf('Honeyberry') < table.indexOf('Comfrey'), 'honeyberry first, then comfrey, then the rest');
  assert.match(table, /Yes, as one group/);
  assert.match(table, /plant them as one group and mix the varieties/);
  assert.match(table, /bought: Blue Diamond ×3, Blue Palm ×3, Indigo Treat ×2, Cinderella ×2, Maxine, Sunrise/);
  assert.match(table, /deep, thick root system that resprouts, so it is hard to remove/);
  assert.match(table, /The sheet says: all planted/);
  assert.match(table, /sex and species of the 4 on hand/);
  assert.doesNotMatch(table, /NaN|undefined/);
  // A plant the page has no advice for still gets a row.
  const unknown = { ...patterns.B, ctx: { ...ctx, others: [{ row: 99, qty: 2, subcategory: 'Berry', type: 'Blueberry', variety: '', name: 'Blueberry', note: '' }] } };
  assert.match(P.otherRows(unknown), /<strong>Blueberry<\/strong>[\s\S]*Not assessed yet/);
});

test('The strip ends at the berry row, and the alley takes the room', () => {
  const layout = patterns.B, cmp = G.compare(now, layout);
  assert.equal(layout.lane.west, 10, 'the hazelnuts\' managed edge');
  assert.equal(layout.lane.width, 3);
  assert.equal(layout.berryRow.x, 16);
  assert.equal(layout.band, 19);
  assert.equal(layout.alley.clear, 13);
  assert.equal(layout.alley.ground, 19);
  assert.equal(layout.alley.clearFull, 12);
  assert.equal(cmp.band.saved, 6);
  assert.equal(cmp.alley.gain, 6);
  assert.equal(cmp.area.saved, 6 * ctx.target);
  assert.equal(cmp.counts.M.proposed, 18);
  for (const other of Object.values(patterns)) assert.deepEqual(plain(other.alley), plain(layout.alley), 'the pattern does not change the room it takes');
  assert.throws(() => G.proposedLayout(OM, { pattern: 'Z' }, ctx), /Pattern Z/);
  assert.throws(() => G.proposedLayout(OM, { pickLane: 1 }, ctx), /narrower than 2 ft/);
  assert.throws(() => G.proposedLayout(OM, { pickLane: 11 }, ctx), /less than the 6 ft minimum/);
  assert.equal(G.proposedLayout(OM, { pickLane: 10 }, ctx).alley.clear, 6, 'the narrowest alley the plan allows');
  assert.equal(G.proposedLayout(OM, { pickLane: 4 }, ctx).alley.clear, 12);
  // Whole feet only: a step or a lane that is not, or a step that would put a berry bush on a half foot, is refused.
  assert.throws(() => G.proposedLayout(OM, { step: 6.25 }, ctx), /must be an even number of whole feet/);
  assert.throws(() => G.proposedLayout(OM, { step: 7 }, ctx), /must be an even number of whole feet/);
  assert.throws(() => G.proposedLayout(OM, { pickLane: 3.5 }, ctx), /must be a whole number of feet/);
  const eight = G.proposedLayout(OM, { step: 8 }, ctx);
  for (const spot of [...eight.plants, ...eight.berries]) assert.ok(Number.isInteger(spot.y), 'any even whole step stays on whole feet');
});

test('The sun: its height and direction at the lot, and the shadow a crown casts', () => {
  const day = (month, dayOfMonth) => G.sunSteps(month, dayOfMonth);
  const highest = steps => steps.reduce((best, step) => (step.altitude > best.altitude ? step : best));
  near(highest(day(9, 22)).altitude, 90 - G.SITE.latitude, 1, 'equinox noon');
  near(highest(day(6, 21)).altitude, 90 - G.SITE.latitude + 23.44, 0.8, 'June 21 noon');
  near(highest(day(12, 21)).altitude, 90 - G.SITE.latitude - 23.44, 1.5, 'December 21 noon');
  assert.equal(G.dayOfYear(6, 21), 172);
  near(G.declination(172) * 180 / Math.PI, 23.44, 0.5);
  const noon = highest(day(6, 21)).dir;
  near(noon[0], 0, 0.05, 'due south at noon');
  assert.ok(noon[1] < 0, 'the noon sun is south of the lot');
  const steps = day(6, 21);
  assert.ok(steps[0].dir[0] > 0 && steps[steps.length - 1].dir[0] < 0, 'it rises in the east and sets in the west');
  for (const step of steps) near(Math.hypot(...step.dir), 1, 1e-9, 'a unit vector');
  near(steps.reduce((sum, step) => sum + step.hours, 0), 14.5, 0.3, 'hours above 3 degrees on June 21');

  const crown = { x: 0, y: 0, z: 10, a: 5, c: 5 };
  near(G.crownPath({ x: 0, y: 0, z: 10 }, [1, 0, 0], crown), 5, 1e-9, 'out of the middle');
  near(G.crownPath({ x: 0, y: 0, z: 0 }, [0, 0, 1], crown), 10, 1e-9, 'straight through from below');
  assert.equal(G.crownPath({ x: 20, y: 0, z: 10 }, [1, 0, 0], crown), 0, 'walking away from it');
  assert.equal(G.crownPath({ x: 0, y: 20, z: 0 }, [0, 0, 1], crown), 0, 'a miss');
  assert.equal(G.crownPath({ x: 0, y: 0, z: 0 }, [0, 0, -1], crown), 0, 'the crown is behind');
});

test('The light check: an open bush gets all of it, and the results hold the order the pages describe', () => {
  const lone = { ...patterns.B, plants: patterns.B.plants.filter(plant => plant.kind === 'H').slice(0, 1) };
  const open = G.light(lone);
  near(open.hazel.season.mean, 1, 1e-9);
  near(open.hazel.fullHours.mean, open.daylight, 1e-9);
  for (const id of ['now', 'A', 'B', 'C']) {
    for (const crown of ['kept', 'spread']) {
      const result = light[id][crown];
      assert.ok(result.hazel.season.mean > 0.05 && result.hazel.season.mean < 1, `${id} ${crown}`);
      assert.ok(result.hazel.season.min <= result.hazel.season.mean && result.hazel.season.mean <= result.hazel.season.max);
    }
  }
  // Kept as the plan assumes, the guild row costs the hazelnuts little; pattern C, with its mulberries farthest apart, is as sunny as today.
  for (const id of ['A', 'B']) assert.ok(kept('now') - kept(id) < 0.1, `${id} stays within ten points of two rows`);
  assert.ok(kept('now') - kept('B') < 0.05, 'and B within a few points');
  assert.ok(kept('A') < kept('B') && kept('B') < kept('C'), 'more mulberries, less light');
  assert.ok(kept('C') >= kept('now') - 0.02);
  // Left to spread, it costs much more, and two rows lose sun as well.
  for (const id of ['A', 'B', 'C']) assert.ok(spread('now') - spread(id) > 0.08, `${id} loses more than two rows do`);
  assert.ok(spread('A') < spread('B') && spread('B') < spread('C'));
  assert.ok(spread('now') < kept('now') - 0.1);
  for (const id of ['A', 'B', 'C']) {
    assert.ok(light[id].kept.berries.season.mean > 0.5, 'the berry row keeps most of the sun');
    assert.ok(light[id].spread.berries.season.mean > 0.35);
  }
  assert.equal(light.now.kept.berries, null);
  assert.ok(light.now.kept.hazel.season.max > light.now.kept.hazel.season.min, 'the ends of a row get more sun');
});

test('The drawings match the layouts and carry no stray numbers', () => {
  const stretch = { y0: -12, y1: 48 };
  for (const layout of [now, ...Object.values(patterns)]) {
    const plan = D.planView(layout), profile = D.profileView(layout), compact = D.planView(layout, { ...P.COMPACT_PLAN });
    for (const [name, markup] of [['plan', plan], ['profile', profile], ['compact', compact]]) {
      assert.match(markup, /^<svg class="diagram [a-z-]+" viewBox="0 0 [\d.]+ [\d.]+" [^>]*role="img" aria-label="[^"]+"><title>/, `${layout.id} ${name}`);
      assert.ok(markup.endsWith('</svg>'));
      assert.doesNotMatch(markup, /NaN|undefined|null|Infinity/, `${layout.id} ${name}`);
      for (const tag of ['g', 'text', 'defs', 'clipPath', 'marker', 'title']) {
        assert.equal((markup.match(new RegExp(`<${tag}[ >]`, 'g')) || []).length, (markup.match(new RegExp(`</${tag}>`, 'g')) || []).length, `${layout.id} ${name} <${tag}>`);
      }
    }
    assert.match(plan, new RegExp(`Tractor alley · ${layout.alley.clear} ft clear`));
    assert.match(plan, new RegExp(`${layout.lane.name} · ${layout.lane.width} ft`));
    assert.match(profile, new RegExp(`Strip used — ${layout.band} ft`));
    assert.match(profile, new RegExp(`${layout.lane.name} — ${layout.lane.width} ft`));
    const counted = (markup, pattern) => (markup.match(pattern) || []).length;
    const inside = (y, margin) => y >= stretch.y0 - margin && y <= stretch.y1 + margin;
    assert.equal(counted(plan, /class="c-berry"/g), layout.berries.filter(bush => bush.planted && inside(bush.y, bush.width / 2)).length, `${layout.id} berries drawn`);
    assert.equal(counted(plan, /class="c-trunk"/g), layout.plants.filter(plant => plant.planted && inside(plant.y, 0.5)).length, `${layout.id} trunks drawn`);
    assert.equal(counted(plan, /class="c-canopy"|class="d-future" stroke="#(5B2A86|6E6B2F)"/g), layout.plants.filter(plant => inside(plant.y, layout.kinds[plant.kind].managedWidth / 2)).length, `${layout.id} canopies drawn`);
    assert.equal(counted(profile, /class="c-crown"/g), 3, `${layout.id} crowns in the profile`);
  }
  assert.match(D.planView(patterns.B), /1 guild/);
  assert.doesNotMatch(D.planView(now), /1 guild/);
  assert.match(D.profileView(patterns.B), /Josta and small berries/);
  assert.match(D.profileView(now), /Berry guild/);
});

test('The 1 ft grid: a block on every foot, firmer every 5 and 10 ft, a ruler on two edges, and off when asked', () => {
  const segments = (markup, weight) => {
    const found = new RegExp(`<path d="([^"]*)" class="g-grid g${weight}"`).exec(markup);
    assert.ok(found, `a path for the ${weight} ft lines`);
    return (found[1].match(/M/g) || []).length;
  };
  // Every line of every weight, as the figure draws it: a vertical line is at one x, a horizontal line at one y.
  const across = (markup, direction) => [1, 5, 10]
    .flatMap(weight => [...new RegExp(`<path d="([^"]*)" class="g-grid g${weight}"`).exec(markup)[1].matchAll(/M([\d.]+),([\d.]+)(V|H)([\d.]+)/g)])
    .filter(found => found[3] === direction).map(found => Number(found[direction === 'V' ? 1 : 2])).sort((a, b) => a - b);
  // The plan: a vertical line on each whole foot from 10 ft west of the fence to 56 ft east of it, a horizontal line on each whole foot from 12 ft south of R1 to 48 ft north.
  const plan = D.planView(patterns.B);
  assert.equal(segments(plan, 1) + segments(plan, 5) + segments(plan, 10), 67 + 61);
  assert.equal(segments(plan, 10), 7 + 6, 'every 10 ft: x of -10, 0, 10 ... 50 and y of -10, 0, 10 ... 40 (R1 is the 0 line)');
  assert.equal(segments(plan, 5), 7 + 6, 'every 5 ft but not 10');
  const verticals = across(plan, 'V'), horizontals = across(plan, 'H');
  assert.deepEqual([verticals.length, horizontals.length], [67, 61]);
  for (let index = 1; index < verticals.length; index++) near(verticals[index] - verticals[index - 1], 10, 0.02, 'one foot is 10 units across, so a block is square');
  for (let index = 1; index < horizontals.length; index++) near(horizontals[index] - horizontals[index - 1], 10, 0.02, 'and 10 units along');
  assert.equal((plan.match(/class="g-ruler"/g) || []).length, 67 + 61, 'a tick on every foot of both rulers');
  for (const label of ['-10', '5', '25', '55', '45', 'ft north of the R1 line']) assert.match(plan, new RegExp(`class="g-ruler-t"[^>]*>${label}</text>`), label);
  assert.match(plan, /The grid blocks are 1 ft by 1 ft/);
  // The profile: whole feet from 22 ft west of the fence to 58 ft east of it, and from the ground to 58 ft up.
  const profile = D.profileView(patterns.B);
  assert.equal(segments(profile, 1) + segments(profile, 5) + segments(profile, 10), 81 + 59);
  const profileAcross = across(profile, 'V'), profileUp = across(profile, 'H');
  assert.deepEqual([profileAcross.length, profileUp.length], [81, 59]);
  for (let index = 1; index < profileAcross.length; index++) near(profileAcross[index] - profileAcross[index - 1], 10, 0.02, 'the profile is drawn at the same scale across');
  for (let index = 1; index < profileUp.length; index++) near(profileUp[index] - profileUp[index - 1], 10, 0.02, 'and up, so a foot of height is a foot of width');
  assert.equal((profile.match(/class="g-ruler"/g) || []).length, 81 + 59);
  for (const label of ['55', '20', 'ft above the ground']) assert.match(profile, new RegExp(`class="g-ruler-t"[^>]*>${label}</text>`), label);
  // The compact figures label every 10 ft, and anything can be drawn without the grid and its margins.
  const compact = D.planView(patterns.B, { ...P.COMPACT_PLAN, grid: true });
  assert.doesNotMatch(compact, /class="g-ruler-t"[^>]*>5<\/text>/);
  assert.match(compact, /class="g-ruler-t"[^>]*>10<\/text>/);
  for (const bare of [D.planView(patterns.B, { grid: false }), D.profileView(patterns.B, { grid: false }), D.planView(now, { grid: false, compact: true })]) {
    assert.doesNotMatch(bare, /g-grid|g-ruler|1 ft by 1 ft/);
  }
  const width = markup => Number(/viewBox="0 0 ([\d.]+) /.exec(markup)[1]);
  assert.ok(width(plan) > width(D.planView(patterns.B, { grid: false })), 'the grid adds margins for the rulers');
});

test('The spacing of the mulberries and of the hazelnuts along the fence is measured on every plan, the full-size ones and the four on the options page', () => {
  const layouts = [now, patterns.A, patterns.B, patterns.C];
  const figures = P.planFigures(now, [patterns.A, patterns.B, patterns.C]).split('<figure ').slice(1);
  assert.equal(figures.length, 4);
  const frame = markup => { const size = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(markup); return { width: Number(size[1]), right: Number(size[1]) - 14 }; };
  // The vertical dimension lines: one at a time x, running along the fence.
  const along = markup => [...markup.matchAll(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)" class="d-dim"\/>/g)]
    .filter(found => found[1] === found[3] && Math.abs(found[4] - found[2]) > 20).map(found => ({ x: Number(found[1]), length: Math.abs(found[4] - found[2]) }));
  layouts.forEach((layout, index) => {
    const mulberries = layout.rows[0].spacing, hazelnuts = layout.rows[1].spacing, guild = layout.pattern ? ' · 1 guild' : '';
    // The line is as long as the spacing is on the ground; the label is the whole number of feet nearest to it.
    const labels = [`Mulberry ${Math.round(mulberries)} ft${guild}`, `Hazelnut ${Math.round(hazelnuts)} ft`];
    for (const [name, markup] of [['full-size', D.planView(layout)], ['on the options page', figures[index]]]) {
      for (const label of labels) assert.match(markup, new RegExp(`>${label}</text>`), `${layout.id} ${name}: ${label}`);
      const lines = along(markup), lengths = lines.map(line => line.length).sort((a, b) => a - b), wanted = [mulberries * 10, hazelnuts * 10].sort((a, b) => a - b);
      assert.equal(lines.length, 2, `${layout.id} ${name}: one line for each row`);
      lengths.forEach((length, at) => near(length, wanted[at], 0.02, `${layout.id} ${name}: a line as long as the spacing, at 10 units a foot`));
      for (const line of lines) assert.ok(frame(markup).right - line.x >= 30, `${layout.id} ${name}: room inside the frame for the label beside the line`);
    }
  });
  assert.deepEqual(plain(layouts.map(layout => [layout.rows[0].spacing, layout.rows[1].spacing])), [[12.5, 9], [12, 12], [18, 6], [24, 6]], 'the spacing the figures draw');
  assert.match(D.planView(now), />Mulberry 13 ft</, 'the current plan\'s 12.5 ft is written 13');
});

test('Every distance the drawings and pages write is a whole number of feet: no decimals, no fractions, no inches', () => {
  // Decimal feet, feet and inches, fraction signs, "half a step", and a bare decimal. The sun results (the latitude, the hours of sun) are not distances.
  const notWhole = /\d\.\d+\s*(?:ft|in|sq ft)\b|\b\d+ ft \d+ in\b|[½¼¾⅓⅔⅛]|\bhalf (?:a|an) (?:foot|step|inch)\b|(?:^|\s)-?\d+\.\d+(?=\s|$)/;
  const visible = markup => `${markup.replace(/<[^>]+>/g, ' ')} ${[...markup.matchAll(/aria-label="([^"]*)"/g)].map(found => found[1]).join(' ')}`;
  const check = (markup, what) => { const found = notWhole.exec(visible(markup)); assert.ok(!found, `${what} writes "${found && found[0]}"`); };
  const everyLayout = [now, ...Object.values(patterns)];
  for (const layout of everyLayout) {
    for (const grid of [true, false]) {
      check(D.planView(layout, { grid }), `${layout.id} plan, grid ${grid}`);
      check(D.planView(layout, { ...P.COMPACT_PLAN, grid }), `${layout.id} compact plan, grid ${grid}`);
      check(D.profileView(layout, { grid }), `${layout.id} profile, grid ${grid}`);
    }
  }
  for (const id of ['A', 'B', 'C']) {
    const lights = { now: light.now, proposed: light[id] };
    check(P.specCards(now, patterns[id], G.compare(now, patterns[id]), lights), `${id} cards`);
    check(P.layerRows(patterns[id], lights), `${id} layers`);
  }
  check(P.optionRows(now, Object.values(patterns)), 'the options table');
  check(P.otherRows(patterns.B), 'the other plants');
  check(read('windbreak_guild_mockup.html'), 'the mock-up page');
  check(read('windbreak_guild_options.html'), 'the options page');
  // And the pages as they fill themselves in: every quoted number and every table, for each pattern.
  const notDistances = ['latitude', 'daylight'];
  for (const [file, hash, draw] of [['windbreak_guild_mockup.html', '#pattern=A', 'mockup'], ['windbreak_guild_mockup.html', '#pattern=B', 'mockup'], ['windbreak_guild_mockup.html', '#pattern=C', 'mockup'], ['windbreak_guild_options.html', '', 'options']]) {
    const view = fakeDocument(file, hash);
    view.page[draw]();
    for (const span of view.spans.filter(entry => !notDistances.includes(entry.key))) check(span.textContent, `${file} ${hash} data-m="${span.key}"`);
    for (const [id, node] of view.nodes) if (id !== 'light-table') check(`${node.innerHTML} ${node.textContent}`, `${file} ${hash} #${id}`);
  }
});

test('The cards, the layers table, and the options tables say what the model says', () => {
  const layout = patterns.B, cmp = G.compare(now, layout), lights = { now: light.now, proposed: light.B };
  const cards = P.specCards(now, layout, cmp, lights);
  assert.match(cards, /25 → 19 ft/);
  assert.match(cards, /7 → 13 ft clear/);
  assert.match(cards, /6 → 12 ft if every plant reaches its full width/);
  assert.match(cards, /about 1,750 sq ft/);
  assert.match(cards, /25 → 18/);
  assert.match(cards, /34 → 34/);
  assert.match(cards, /0 → 41/);
  assert.match(cards, /all 34 on hand used/);
  const table = P.layerRows(layout, lights);
  assert.equal((table.match(/<tr>/g) || []).length, 4);
  assert.match(table, /18 ft, every third place/);
  assert.match(table, /13 ft south of the R1 line/, 'the first mulberry');
  assert.match(table, /13 ft north of the R15 line/, 'the last mulberry');
  assert.match(table, /7 ft south of the R1 line/, 'the first hazelnut');
  assert.match(table, /10 ft south of the R1 line/, 'the first berry bush');
  assert.match(table, /230 ft north of the R1 line \(last planted\); open places to 10 ft north of the R15 line/);
  assert.match(table, /41 planted \+ 10 to add/);
  assert.match(table, /3 ft out of line with the trunks/);
  assert.match(table, /honeyberry 11, red currant 7, gooseberry 3, Viking aronia 2, jostaberry 18/, 'the kinds in the order of the runs');
  assert.match(table, /hangs over only the nearest 2 ft of the berry row, 14 ft or more up/);
  assert.match(table, /puts them at 70% of the season's sun with the mulberries kept as planned, against 74% in two rows, and 38% against 55% if the mulberries spread/);
  assert.match(P.layerRows(patterns.C, { now: light.now, proposed: light.C }), /puts them at 75% of the season's sun/, 'pattern C is as sunny as two rows, and its note says so');
  assert.doesNotMatch(table, /NaN|undefined/);
  const options = P.optionRows(now, Object.values(patterns));
  assert.match(options, /on hand: 25 mulberries, 34 hazelnuts, 41 berry bushes/);
  assert.match(options, /34 \+ 5 to add/);
  const across = label => new RegExp(`${label}</th><td class="num">(\\d+) ft</td><td class="num">(\\d+) ft</td><td class="num picked">(\\d+) ft</td><td class="num">(\\d+) ft</td>`).exec(options).slice(1).map(Number);
  assert.deepEqual(across('Mulberry to mulberry'), [13, 12, 18, 24], 'the current plan\'s 12.5 ft is written 13');
  assert.deepEqual(across('Hazelnut to hazelnut'), [9, 12, 6, 6]);
  assert.equal((options.match(/picked/g) || []).length, (options.match(/<th scope="row">/g) || []).length, 'pattern B is outlined in every row');
  const lightTable = P.lightRows(now, Object.values(patterns), light);
  assert.match(lightTable, /Mulberries kept as the plan assumes \(20 ft wide, limbs from 14 ft\)/);
  assert.match(lightTable, /Mulberries left to spread \(30 ft wide, limbs from 8 ft\)/);
  assert.equal((lightTable.match(/<tr>/g) || []).length, 6);
  assert.doesNotMatch(lightTable + options + cards, /NaN|undefined/);
  assert.match(P.headRow(now, Object.values(patterns)), /B · M–H–H/);
  assert.equal(P.sqft(1752), '1,750');
  assert.equal(P.nsLabel(-10, ctx), '10 ft south of the R1 line');
  assert.equal(P.nsLabel(290, ctx), '10 ft north of the R15 line');
  assert.equal(P.nsLabel(243.125, ctx), '243 ft north of the R1 line');
  assert.equal(P.nsLabel(2.5, ctx), '3 ft north of the R1 line', 'a half goes up');
  assert.equal(P.nsLabel(-12.5, ctx), '13 ft south of the R1 line', 'and the same to the south');
  assert.equal(P.spacingText(12.5), '13 ft');
  assert.equal(P.spacingText(6), '6 ft');
});

// A page's text with no browser: the elements that have an id, the numbers quoted in the text, the pattern buttons, the grid box, and a print dialog that
// records what the page's classes are when it opens and lets the test close it.
function fakeDocument(file, hash) {
  const html = read(file), nodes = new Map(), saved = [], classes = new Set(), prints = [], afterprint = [];
  const spans = [...html.matchAll(/data-m="([A-Za-z]+)"/g)].map(found => ({ key: found[1], textContent: '', getAttribute: () => found[1] }));
  const makeNode = id => ({
    id, innerHTML: '', textContent: '', hidden: /id="data-error"[^>]*hidden/.test(html) && id === 'data-error', listeners: {},
    checked: new RegExp(`id="${id}"[^>]*\\schecked`).test(html),
    disabled: new RegExp(`id="${id}"[^>]*\\sdisabled`).test(html),
    addEventListener(type, handler) { this.listeners[type] = handler; },
    querySelectorAll(selector) {
      if (selector !== '.choice') return [];
      this.lastChoices = [...this.innerHTML.matchAll(/<input type="radio" name="pattern" value="(\w)">/g)].map(found => {
        const input = { value: found[1], checked: false };
        const choice = { on: false, input, querySelector: () => input, classList: { toggle: (name, on) => { choice.on = on; } } };
        return choice;
      });
      return this.lastChoices;
    }
  });
  const document = {
    getElementById: id => (html.includes(`id="${id}"`) ? (nodes.has(id) ? nodes.get(id) : nodes.set(id, makeNode(id)).get(id)) : null),
    body: { querySelectorAll: selector => (selector === '[data-m]' ? spans : []) },
    documentElement: { classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) } }
  };
  const loaded = load({ document });
  loaded.window.location = { hash };
  loaded.window.history = { replaceState: (_state, _title, url) => saved.push(url) };
  loaded.window.print = () => prints.push([...classes]);
  loaded.window.addEventListener = (type, handler) => { if (type === 'afterprint') afterprint.push(handler); };
  loaded.window.removeEventListener = (type, handler) => { const at = afterprint.indexOf(handler); if (type === 'afterprint' && at >= 0) afterprint.splice(at, 1); };
  const closeDialog = () => [...afterprint].forEach(handler => handler());
  return { document, spans, nodes, saved, classes, prints, afterprint, closeDialog, page: loaded.window.WindbreakGuildPage };
}

test('The mock-up page draws from its own HTML: every id exists, every quoted number is supplied, and the buttons redraw it', () => {
  const view = fakeDocument('windbreak_guild_mockup.html', '');
  view.page.mockup();
  assert.equal(view.nodes.get('data-error').hidden, true);
  for (const id of ['wg-specs', 'plan-now', 'plan-new', 'profile-now', 'profile-new', 'layer-table', 'others-table', 'pattern-choice']) assert.ok(view.nodes.get(id).innerHTML.length > 100, id);
  assert.ok(view.spans.length > 20);
  for (const span of view.spans) assert.ok(span.textContent.length > 0, `data-m="${span.key}" is empty`);
  assert.match(view.nodes.get('plan-new-caption').innerHTML, /pattern B/);
  assert.match(view.nodes.get('berry-codes').textContent, /JO jostaberry/);
  const chooser = view.nodes.get('pattern-choice');
  assert.equal((chooser.innerHTML.match(/type="radio"/g) || []).length, 3);
  chooser.listeners.change({ target: { value: 'C' } });
  assert.deepEqual(view.saved, ['#pattern=C']);
  assert.match(view.nodes.get('plan-new-caption').innerHTML, /pattern C/);
  assert.match(view.nodes.get('layer-table').innerHTML, /24 ft, every fourth place/);
  assert.equal(view.spans.find(span => span.key === 'mulberries').textContent, '14');
  assert.equal(view.spans.find(span => span.key === 'alley').textContent, '13');
  assert.deepEqual(chooser.lastChoices.map(choice => choice.input.checked), [false, false, true]);
  assert.deepEqual(chooser.lastChoices.map(choice => choice.on), [false, false, true], 'the chosen button is marked');
  // The grid is on when the page opens, and its box takes it off the plan and the profile and puts it back.
  const gridBox = view.nodes.get('grid-toggle');
  assert.equal(gridBox.checked, true);
  for (const id of ['plan-now', 'plan-new', 'profile-now', 'profile-new']) assert.match(view.nodes.get(id).innerHTML, /g-grid g1/, id);
  gridBox.checked = false;
  gridBox.listeners.change();
  for (const id of ['plan-now', 'plan-new', 'profile-now', 'profile-new']) assert.doesNotMatch(view.nodes.get(id).innerHTML, /g-grid|g-ruler/, id);
  assert.match(view.nodes.get('plan-new-caption').innerHTML, /pattern C/, 'the pattern stays as it was chosen');
  gridBox.checked = true;
  gridBox.listeners.change();
  assert.match(view.nodes.get('profile-new').innerHTML, /g-grid g10/);
});

test('The mock-up opens on the pattern named in the link', () => {
  for (const [hash, expected] of [['#pattern=A', 'A'], ['#pattern=C', 'C'], ['', 'B'], ['#pattern=Q', 'B'], ['#something', 'B']]) {
    const view = fakeDocument('windbreak_guild_mockup.html', hash);
    view.page.mockup();
    assert.match(view.nodes.get('plan-new-caption').innerHTML, new RegExp(`pattern ${expected}`), hash);
  }
});

test('The options page draws from its own HTML', () => {
  const view = fakeDocument('windbreak_guild_options.html', '');
  view.page.options();
  assert.equal(view.nodes.get('data-error').hidden, true);
  assert.equal((view.nodes.get('options-plans').innerHTML.match(/<svg /g) || []).length, 4);
  assert.match(view.nodes.get('options-plans').innerHTML, /windbreak_guild_mockup\.html#pattern=C/);
  for (const id of ['options-head', 'options-table', 'light-head', 'light-table']) assert.ok(view.nodes.get(id).innerHTML.length > 100, id);
  for (const span of view.spans) assert.ok(span.textContent.length > 0, `data-m="${span.key}" is empty`);
  assert.equal(view.spans.find(span => span.key === 'latitude').textContent, '43.4737');
  const gridBox = view.nodes.get('grid-toggle');
  assert.equal(gridBox.checked, true);
  assert.match(view.nodes.get('options-plans').innerHTML, /g-grid g5/);
  gridBox.checked = false;
  gridBox.listeners.change();
  assert.doesNotMatch(view.nodes.get('options-plans').innerHTML, /g-grid|g-ruler/);
  assert.equal((view.nodes.get('options-plans').innerHTML.match(/<svg /g) || []).length, 4, 'still the four figures');
});

test('A page that cannot load the orchard model says so instead of drawing', () => {
  const view = fakeDocument('windbreak_guild_mockup.html', '');
  const empty = vm.createContext({ window: {}, document: view.document });
  for (const file of ['windbreak_guild_model.js', 'windbreak_guild_draw.js', 'windbreak_guild_page.js']) vm.runInContext(read(file), empty);
  assert.throws(() => empty.window.WindbreakGuildPage.mockup(), /orchard_model\.js did not load/);
  assert.equal(view.nodes.get('data-error').hidden, false);
  assert.match(view.nodes.get('data-error').textContent, /could not be drawn/);
  assert.equal(view.document.getElementById('print-graphics').disabled, true, 'and the print button stays off, with nothing to print');
});

test('The latitude is the one in the climate data, and the pages are in the menu and load their scripts in order', () => {
  const climate = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'climate.json'), 'utf8'));
  assert.equal(G.SITE.latitude, climate.site.latitude);
  const menu = {};
  vm.runInNewContext(read('site_nav.js'), { window: menu });
  for (const page of ['windbreak_guild_mockup.html', 'windbreak_guild_options.html']) {
    assert.equal(menu.SiteNav.groupOf(page), 'orchard', `${page} is in the Orchard menu`);
    const html = read(page);
    const scripts = [...html.matchAll(/<script src="([^"]+)">/g)].map(found => found[1]);
    assert.deepEqual(scripts, ['site_nav.js', 'data/orchard_model.js', 'windbreak_guild_model.js', 'windbreak_guild_draw.js', 'windbreak_guild_page.js']);
    assert.match(html, /<link rel="stylesheet" href="windbreak_guild\.css">/);
    assert.match(html, /<script>WindbreakGuildPage\.(mockup|options)\(\);<\/script>\s*<\/body>/);
    assert.match(html, /<strong>Mock-up only\.<\/strong>/);
    for (const link of html.matchAll(/href="([a-z_]+\.html)(#[^"]*)?"/g)) assert.ok(fs.existsSync(path.join(DOCS, link[1])), `${page} links to ${link[1]}`);
  }
});

// ------------------------------------------------------------------ printing

// The ids and classes of every ancestor of each element that has an id, read from a page's own HTML ('#id' for an ancestor's id).
function ancestry(html) {
  const voids = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
  const stack = [], found = {};
  for (const [, closing, tag, attrs] of html.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g)) {
    const name = tag.toLowerCase();
    if (closing) {
      while (stack.length && stack.pop().name !== name) { /* pop to the matching open tag */ }
      continue;
    }
    const id = /\sid="([^"]+)"/.exec(attrs), cls = /\sclass="([^"]*)"/.exec(attrs);
    if (id) found[id[1]] = stack.flatMap(entry => [...entry.classes, ...(entry.id ? [`#${entry.id}`] : [])]);
    if (!voids.has(name) && !/\/\s*$/.test(attrs)) stack.push({ name, id: id && id[1], classes: cls ? cls[1].split(/\s+/) : [] });
  }
  return found;
}

const PRINTED = {
  'windbreak_guild_mockup.html': { sheets: { 'sheet-plan': ['wg-specs', 'plan-now', 'plan-new'], 'sheet-profile': ['profile-now', 'profile-new'] }, text: ['layer-table', 'others-table'], pdf: 'windbreak_guild_mockup.pdf', pages: 4, draw: 'mockup' },
  'windbreak_guild_options.html': { sheets: { 'sheet-options': ['options-plans'] }, text: ['options-table', 'light-table'], pdf: 'windbreak_guild_options.pdf', pages: 3, draw: 'options' }
};

test('Each page prints on Tabloid sheets, the drawings first and one to a sheet, and nothing but a button for them is added to the screen', () => {
  const css = read('windbreak_guild.css');
  assert.match(css, /@page \{\s*size: 17in 11in;\s*margin: 10mm;/, 'Tabloid landscape, like the windbreak figures on the pollination grid');
  assert.match(css, /@bottom-left \{ content: "[^"]*not the planting plan\)"/, 'every printed sheet says it is a mock-up');
  assert.match(css, /@bottom-right \{ content: "Page " counter\(page\) " of " counter\(pages\)/);
  assert.ok(css.includes('.print-sheet { display: contents; }'), 'on screen a sheet adds no box, so the page is laid out as it was');
  assert.ok(css.includes('.print-sheet { display: block; break-after: page; }'), 'in print each sheet is a page');
  assert.ok(css.includes('.home-link, .print-help, fieldset.choice-set, .toggle { display: none; }'), 'the controls do not print');
  assert.ok(css.includes('.print-graphics-only body *:not(.print-sheet, .print-sheet *, :has(.print-sheet)) { display: none !important; }'),
    'everything but the sheets is hidden while the graphics-only class is on');
  for (const [file, expected] of Object.entries(PRINTED)) {
    const html = read(file), parents = ancestry(html);
    assert.equal((html.match(/class="print-sheet"/g) || []).length, Object.keys(expected.sheets).length, `${file}: one block for each sheet`);
    for (const [sheet, ids] of Object.entries(expected.sheets)) {
      for (const id of ids) assert.ok(parents[id].includes(`#${sheet}`) && parents[id].includes('print-sheet'), `${file}: #${id} is on ${sheet}`);
      assert.ok(html.indexOf(`id="${sheet}"`) < html.indexOf(`id="${expected.text[0]}"`), `${file}: ${sheet} comes before the tables`);
    }
    for (const id of expected.text) assert.ok(!parents[id].includes('print-sheet'), `${file}: #${id} is text, which "Print graphics only" leaves out`);
    assert.match(html, /<button type="button" id="print-graphics" disabled>Print graphics only<\/button>/);
    assert.match(html, /<div class="notice print-help" role="note"><strong>Print setup:<\/strong> Tabloid \/ Ledger \(11 × 17 in\), landscape, 100% scale\./);
    assert.ok(html.includes(`<a href="downloads/${expected.pdf}" download>`), `${file} links its PDF`);
  }
  assert.deepEqual(plain(Object.values(PRINTED).map(entry => Object.keys(entry.sheets).length)), [2, 1], 'the plan and the profile on the mock-up, the four plans on the options page');
});

test('"Print graphics only" starts off, comes on with the drawings, marks the page for one print, and lets go when the dialog closes', () => {
  for (const [file, expected] of Object.entries(PRINTED)) {
    const view = fakeDocument(file, '');
    const button = view.document.getElementById('print-graphics');
    assert.equal(button.disabled, true, `${file}: off until the drawings are on the page`);
    view.page[expected.draw]();
    assert.equal(button.disabled, false, `${file}: on once they are`);
    button.listeners.click();
    assert.deepEqual(plain(view.prints), [['print-graphics-only']], 'the class is on when the print dialog opens');
    assert.equal(view.afterprint.length, 1);
    view.closeDialog();
    assert.equal(view.classes.size, 0, 'and off when the dialog closes, so a later Ctrl+P prints the whole page');
    assert.equal(view.afterprint.length, 0, 'with no listener left behind');
    button.listeners.click();
    view.closeDialog();
    assert.equal(view.prints.length, 2, 'it prints again the same way');
  }
});

test('Each page has a Tabloid PDF with the sheets the page promises, linked from the home page and the README', () => {
  const home = read('index.html'), readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
  for (const [file, expected] of Object.entries(PRINTED)) {
    const bytes = fs.readFileSync(path.join(DOCS, 'downloads', expected.pdf)), text = bytes.toString('latin1');
    assert.equal(text.slice(0, 5), '%PDF-', `${expected.pdf} is not a PDF`);
    assert.ok(bytes.length > 100 * 1024, `${expected.pdf} is too small to be the whole page`);
    const sheets = (text.match(/\/Type\s*\/Page(?![A-Za-z])/g) || []).length;
    assert.equal(sheets, expected.pages, `${expected.pdf} should print on ${expected.pages} sheets: the drawings first, then the tables and notes. If a change pushes the `
      + `page onto another sheet, tighten the print layout in docs/windbreak_guild.css, print ${file} again, and update this count`);
    const boxes = text.match(/\/MediaBox\s*\[[^\]]*\]/g) || [];
    assert.ok(boxes.length >= 1);
    for (const box of boxes) assert.match(box, /\[\s*0\s+0\s+1224(\.0+)?\s+792(\.0+)?\s*\]/, `${expected.pdf}: every sheet is 17 x 11 in`);
    assert.ok(home.includes(`href="downloads/${expected.pdf}"`), `the home page needs a download link for ${expected.pdf}`);
    assert.ok(readme.includes(`(docs/downloads/${expected.pdf})`), `the README needs a link to ${expected.pdf}`);
  }
});
