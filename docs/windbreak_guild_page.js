// Fills the two windbreak guild-row mock-up pages from the model: the cards, the figures, the tables, and the numbers quoted in the text
// (<span data-m="name">). The view functions return HTML strings so tests can run them without a browser; mockup() and options() are what
// the pages call once their scripts have loaded.
(function (root) {
'use strict';
const G = root.WindbreakGuild, D = root.WindbreakGuildDraw;
const num = D.num;
const esc = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five'];
const ORDINALS = ['', 'first', 'second', 'third', 'fourth', 'fifth'];
const spacingText = value => `${num(value)} ft`;
const pct = value => `${Math.round(value * 100)}%`;
const hours = value => value.toFixed(1);
const sqft = value => String(Math.round(value / 10) * 10).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const nsLabel = (y, ctx) => (y < 0 ? `${num(-y)} ft south of the R1 line` : y > ctx.span ? `${num(y - ctx.span)} ft north of the R${ctx.rowCount} line` : `${num(y)} ft north of the R1 line`);
const crownBase = spec => spec.profile.crownMid - spec.profile.crownHalfHeight;
const spareText = count => count.toAdd ? `${count.toAdd} more to add` : count.spare ? `${count.spare} of the ${count.stock} on hand spare` : `all ${count.stock} on hand used`;
const cap = text => `${text[0].toUpperCase()}${text.slice(1)}`;
const stockText = ctx => ctx.stock.berries.map(entry => `${entry.group.name} ${entry.count}`).join(', ');

function addCard(label, value, sub) {
  return `<div class="spec"><div class="label">${label}</div><div class="value">${value}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;
}

// The cards across the top: what changes, in the figures the pages quote.
function specCards(now, proposed, cmp, light) {
  const nowKept = light.now.kept.hazel.season.mean, nowSpread = light.now.spread.hazel.season.mean;
  const newKept = light.proposed.kept.hazel.season.mean, newSpread = light.proposed.spread.hazel.season.mean;
  return [
    addCard('Strip used', `${num(now.band)} → ${num(proposed.band)} ft`, 'from the fence to the last row of plants'),
    addCard('Tractor alley', `${num(now.alley.clear)} → ${num(proposed.alley.clear)} ft clear`, `${num(cmp.alley.nowFull)} → ${num(cmp.alley.proposedFull)} ft if every plant reaches its full width`),
    addCard('Ground freed', `about ${sqft(cmp.area.saved)} sq ft`, `${num(cmp.band.saved)} ft along ${num(cmp.area.length)} ft of fence, all of it added to the alley`),
    addCard('Red mulberry', `${now.counts.M.planted} → ${proposed.counts.M.planted}`, spareText(proposed.counts.M)),
    addCard('Hazelnut', `${now.counts.H.planted} → ${proposed.counts.H.planted}`, spareText(proposed.counts.H)),
    addCard('Small berries in the strip', `0 → ${proposed.counts.berries.planted}`, `the bushes now planned around the C1 trees; ${proposed.counts.berries.toAdd} more places open`),
    addCard('Sun on the hazelnuts', `${pct(nowKept)} → ${pct(newKept)}`, `${pct(nowSpread)} → ${pct(newSpread)} if the mulberries are left to spread`)
  ].join('');
}

// ------------------------------------------------------------------ the layers table

function plantCell(spec, sub) {
  return `<strong>${esc(spec.name)}</strong><div class="source-note">${esc(sub || spec.latin)}</div>`;
}
function countCell(count, extra) {
  const parts = [`${count.planted}${count.toAdd ? ` planted + ${count.toAdd} to add` : ''}`];
  if (extra) parts.push(`<span class="src">${esc(extra)}</span>`);
  else if (count.spare || count.toAdd) parts.push(`<span class="src">${esc(spareText(count))}</span>`);
  return parts.join('');
}
function lastCell(row, ctx) {
  return row.toAdd ? `${nsLabel(row.plantedEnd, ctx)} (last planted); open places to ${nsLabel(row.end, ctx)}` : nsLabel(row.end, ctx);
}

function layerRows(proposed, light) {
  const K = proposed.kinds, ctx = proposed.ctx, size = proposed.pattern.sequence.length;
  const [tall, low, berry] = proposed.rows;
  const gap = tall.spacing - K.M.managedWidth;
  const hazelWithin = low.spacing >= 6 && low.spacing <= 9;
  const overhang = tall.x + K.M.managedWidth / 2 - proposed.berryRow.west;
  const sun = (which, crown) => pct(light[which][crown].hazel.season.mean);
  const notes = {
    M: `The main wind barrier, now in every ${ORDINALS[size]} place along the row, ${num(tall.spacing)} ft apart: ${tall.spacing <= 15 ? 'inside' : 'wider than'} the 6–15 ft in-row range UNL gives for deciduous windbreak trees, but the hazelnuts and berries fill the space between, and ${gap <= 0 ? 'the crowns still meet' : `the crowns leave ${num(gap)} ft gaps that the hazelnuts fill below`}. Keep the plan's pruning and keep it up: one trunk, limbs from about ${num(crownBase(K.M))} ft, and the east side cut back to about ${num(K.M.managedWidth / 2)} ft from the trunk, so the crown ${overhang > 0 ? `hangs over only the nearest ${num(overhang)} ft of the berry row, ${num(crownBase(K.M))} ft or more up` : 'stays clear of the berry row'} (the light check on the options page shows why). Seedlings are usually male or female, so expect some fruitless trees (MOBOT).`,
    H: `${cap(WORDS[proposed.pattern.between])} between each pair of mulberries, ${num(low.spacing)} ft apart${hazelWithin ? ', inside the 6–9 ft UMHDI gives for nut production' : ', wider than the 6–9 ft UMHDI gives for nut production, so each bush has room'}. Each stands ${num(proposed.step)} ft from the next place in the row, so the hazelnut beside a mulberry is ${num(proposed.step)} ft from its trunk. They no longer stand ${num(ctx.shadeGap)} ft from the mulberries, the gap the USDA hybrid hazelnut guide keeps so the hazels are not shaded. The light check puts them at ${sun('proposed', 'kept')} of the season's sun with the mulberries kept as planned, against ${sun('now', 'kept')} in two rows, and ${sun('proposed', 'spread')} against ${sun('now', 'spread')} if the mulberries spread. Pick from the pick lane on their east side, and layer low stems into any gaps.`,
    B: `One bush stands in front of every gap between two places in the row, ${num(berry.spacing)} ft apart and ${num(berry.spacing / 2)} ft out of line with the trunks, so each bush is between two trunks. Each kind stands in a run, south to north, in the order the C1 guilds use (${ctx.stock.berries.map(entry => entry.group.name).join(', ')}): the honeyberries need another cultivar to set fruit, so they stay one group, and one net covers a run. Josta is 5–8 ft tall and wide (cultivar library). These are the ${proposed.counts.berries.stock} bushes now planned around the C1 trees; ${berry.toAdd} more places stay open at the north end. Honeyberry, currant, gooseberry, and aronia are smaller and could stand closer.`
  };
  const row = cells => `<tr>${cells.map(cell => `<td>${cell}</td>`).join('')}</tr>`;
  return [
    row(['1. Tall layer in the guild row', plantCell(K.M), countCell(proposed.counts.M), `${num(tall.x)} ft`, `${spacingText(tall.spacing)}, every ${ORDINALS[size]} place`,
      nsLabel(tall.start, ctx), lastCell(tall, ctx), `${esc(K.M.height)} tall; ${esc(K.M.spread)}`, notes.M]),
    row(['2. Shrub layer in the same row', plantCell(K.H), countCell(proposed.counts.H), `${num(low.x)} ft`, spacingText(low.spacing),
      nsLabel(low.start, ctx), lastCell(low, ctx), `${esc(K.H.height)} tall; ${esc(K.H.spread)}`, notes.H]),
    row(['3. Berry row in front', plantCell(K.B, stockText(ctx)), countCell(proposed.counts.berries, `${proposed.counts.berries.stock} on hand`), `${num(berry.x)} ft`, `${spacingText(berry.spacing)}, between the trunks`,
      nsLabel(berry.start, ctx), lastCell(berry, ctx), `${esc(K.B.height)} tall; ${esc(K.B.spread)}`, notes.B]),
    `<tr><td colspan="9">The east elderberry hedge is not part of this mock-up and stays as planned.</td></tr>`
  ].join('');
}

// ------------------------------------------------------------------ the other small plants

// What to do with each small plant on the inventory sheet that the plan does not place, by the sheet's name. A plant not listed
// here still gets a row, so a new line on the sheet does not break the page.
const OTHER_ORDER = ['comfrey', 'rhubarb', 'sea berry', 'blackberry', 'rasberry?', 'hardy kiwi', 'mint'];
const OTHER_ADVICE = {
  'comfrey': item => ({
    where: 'A bed of its own, in ground you will not dig again. To have its mulch close to the berries, put the bed just past the north end of the row.',
    why: `A clump that passes 3 ft, from a deep, thick root system that resprouts, so it is hard to remove. It does not belong beside the pick lane or the alley, where you may dig or reshape the ground. ${/sterile/i.test(item.note)
      ? 'The sheet says yours is the sterile-seed kind, so it sows no seedlings and there is no need to cut the flower stalks; it spreads only from roots that are cut or dug up (UMN).'
      : 'The variety is not recorded: common comfrey also spreads by seed, so cut the flower stalks.'} Not for eating (cultivar library).`
  }),
  'rhubarb': () => ({
    where: 'A garden bed.',
    why: 'A 3 ft clump that stays 10 to 15 years or more and likes moist, well-drained soil. It would take front-row places a berry could use. Cut off the leaf blades: they are toxic.'
  }),
  'sea berry': () => ({
    where: 'A block of its own in the open, well away from the alley and the orchard.',
    why: '10 to 15 ft tall and 8 to 10 ft wide, armed with thorns, and it suckers into thickets: wrong beside a tractor alley and a pick lane. Only the females fruit, and the mix of sexes on hand is not recorded.'
  }),
  'blackberry': () => ({
    where: 'A bed with a trellis wire, away from the alley.',
    why: 'The canes sprawl and sucker into what is beside them, thorns depend on the cultivar (not recorded), and the Idaho bulletin calls trailing types risky here; erect types are hardier.'
  }),
  'rasberry?': () => ({
    where: 'In the bramble bed, to see what it is.',
    why: 'One plant of an unknown kind. Brambles sucker into what is beside them.'
  }),
  'hardy kiwi': item => ({
    where: 'A trellis or pergola near the house or the garden.',
    why: `A twining vine that can add about 30 ft in a year and needs a sturdy trellis. Fruit needs a male and a female, and the sex and species of the ${item.qty} on hand are not recorded.`
  }),
  'mint': item => ({
    where: 'Where it is.',
    why: `${item.note ? `The sheet says: ${item.note}. ` : ''}Mint runs, so keep it out of the strip.`
  })
};
const otherRank = item => { const rank = OTHER_ORDER.indexOf(item.name.toLowerCase()); return rank < 0 ? OTHER_ORDER.length : rank; };

function otherRows(proposed) {
  const ctx = proposed.ctx;
  const row = cells => `<tr>${cells.map(cell => `<td>${cell}</td>`).join('')}</tr>`;
  const out = [];
  const honey = ctx.stock.berries.find(entry => entry.group.code === 'HB');
  if (honey) {
    const bought = honey.match && /\(([^)]*)\)/.exec(honey.match.berry || '');
    out.push(row([
      `<strong>Honeyberry</strong><div class="source-note">${esc(bought ? `bought: ${bought[1]}` : 'berry')}</div>`, String(honey.count), 'Yes, as one group',
      'In the front row, as the first run at the south end, with the varieties mixed.',
      `${esc(honey.match ? honey.match.note : '')} The flowers open very early and tolerate frost to about 19–20°F, the bushes scorch in summer heat, so the row's afternoon shade suits them, and birds are the main pest, so one run takes one net.`
    ]));
  }
  [...ctx.others].sort((a, b) => otherRank(a) - otherRank(b)).forEach(item => {
    const advice = (OTHER_ADVICE[item.name.toLowerCase()] || (() => ({ where: 'Not assessed yet.', why: 'This line of the sheet is new to the mock-up.' })))(item);
    const kind = item.subcategory === 'Perennial' ? 'perennial, not a bush' : item.variety && item.type ? esc(item.variety) : 'berry';
    out.push(row([`<strong>${esc(item.name)}</strong><div class="source-note">${kind}</div>`, String(item.qty), 'No', esc(advice.where), esc(advice.why)]));
  });
  return out.join('');
}

// ------------------------------------------------------------------ the numbers quoted in the text

// The sizes quoted in the text, from the plan's own crowns.
function sizeValues(K) {
  const top = spec => spec.profile.crownMid + spec.profile.crownHalfHeight;
  return {
    mulberryHeight: K.M.height, mulberryTrunk: num(K.M.profile.trunk), mulberryBase: num(crownBase(K.M)), mulberryTop: num(top(K.M)),
    mulberryWidth: num(K.M.managedWidth), mulberryEast: num(K.M.managedWidth / 2),
    hazelWidth: num(K.H.managedWidth), hazelTop: String(Math.round(top(K.H))),
    berryWidth: num(K.B.managedWidth), berryTop: String(Math.round(top(K.B)))
  };
}
const crownText = (id, K) => G.crownDetail(G.MULBERRY_CROWNS.find(entry => entry.id === id), K);
const countOf = (ctx, code) => { const entry = ctx.stock.berries.find(item => item.group.code === code); return entry ? entry.count : 0; };

function values(now, proposed, cmp, light) {
  const between = proposed.pattern.between, ctx = proposed.ctx;
  return {
    ...sizeValues(proposed.kinds),
    pattern: `${proposed.pattern.id} (${proposed.pattern.short})`,
    betweenWords: `${WORDS[between]} hazelnut${between > 1 ? 's' : ''}`,
    step: num(proposed.step), module: num(proposed.module), rowX: num(proposed.rows[0].x),
    band: num(proposed.band), bandNow: num(now.band),
    alley: num(proposed.alley.clear), alleyNow: num(now.alley.clear),
    alleyFull: num(proposed.alley.clearFull), alleyFullNow: num(now.alley.clearFull),
    sqft: sqft(cmp.area.saved), length: num(cmp.area.length),
    laneNow: num(now.lane.width), pickLane: num(proposed.lane.width), berryX: num(proposed.berryRow.x),
    mulberries: String(proposed.counts.M.planted), mulberriesNow: String(now.counts.M.planted),
    hazels: String(proposed.counts.H.planted), hazelsNow: String(now.counts.H.planted),
    berryTotal: String(ctx.stock.berryTotal), honeyberries: String(countOf(ctx, 'HB')), gooseberries: String(countOf(ctx, 'GB')),
    mulberryNote: spareText(proposed.counts.M), hazelNote: spareText(proposed.counts.H),
    keptDetail: crownText('kept', proposed.kinds), spreadDetail: crownText('spread', proposed.kinds),
    keptNow: pct(light.now.kept.hazel.season.mean), keptProp: pct(light.proposed.kept.hazel.season.mean),
    spreadNow: pct(light.now.spread.hazel.season.mean), spreadProp: pct(light.proposed.spread.hazel.season.mean),
    berryKept: pct(light.proposed.kept.berries.season.mean),
    shadeGap: num(ctx.shadeGap)
  };
}

function plainValues(now, options, light) {
  const ctx = now.ctx, reach = layout => num(-layout.plants[0].y);
  return {
    ...sizeValues(now.kinds),
    mulberryStock: String(ctx.stock.M), hazelStock: String(ctx.stock.H), berryTotal: String(ctx.stock.berryTotal),
    keptDetail: crownText('kept', now.kinds), spreadDetail: crownText('spread', now.kinds),
    k: `${Math.round(G.LIGHT.k * 100)}%`, latitude: String(G.SITE.latitude), step: num(G.STEP), pickLane: num(G.PICK_LANE),
    alley: num(options.B.alley.clear), alleyNow: num(now.alley.clear), band: num(options.B.band), bandNow: num(now.band),
    shadeGap: num(ctx.shadeGap),
    reachNow: num(-now.rows[0].start), reachA: reach(options.A), reachB: reach(options.B), reachC: reach(options.C),
    aMulberries: String(options.A.counts.M.positions), cMulberries: String(options.C.counts.M.positions), cHazels: String(options.C.counts.H.positions),
    daylight: hours(light.kept.daylight)
  };
}

// ------------------------------------------------------------------ the options page

// The four plans side by side are drawn smaller than the one on the mock-up page. They reach 11 ft west of the fence, like the full plan, so the spacing
// of the mulberries, the hazelnuts, and the berry bushes, written west of the fence, is inside the frame.
const COMPACT_PLAN = { compact: true, xWest: -11, xEast: 40, idPrefix: 'opt' };

function planFigures(now, options, drawing = {}) {
  const view = layout => D.planView(layout, { ...COMPACT_PLAN, grid: drawing.grid !== false });
  const link = layout => `<a href="windbreak_guild_mockup.html#pattern=${layout.id}">Open in the mock-up</a>`;
  const figure = (layout, caption, extra) => `<figure class="wg-figure"><figcaption>${caption} <span>${extra}</span></figcaption>${view(layout)}</figure>`;
  return figure(now, 'Current plan', `two rows, a ${num(now.lane.width)} ft lane, a ${num(now.alley.clear)} ft alley`)
    + options.map(layout => figure(layout, `Pattern ${layout.pattern.id}: ${layout.pattern.short}`,
      `${esc(layout.pattern.label.toLowerCase())}. ${link(layout)}`)).join('');
}

function optionRows(now, options) {
  const all = [now, ...options];
  const cell = (text, picked) => `<td class="num${picked ? ' picked' : ''}">${text}</td>`;
  const row = (label, make) => `<tr><th scope="row">${label}</th>${all.map((layout, index) => cell(make(layout), layout.id === G.DEFAULT_PATTERN && index > 0)).join('')}</tr>`;
  const group = label => `<tr class="group"><th colspan="${all.length + 1}">${label}</th></tr>`;
  const ctx = now.ctx;
  const planted = count => `${count.planted}${count.toAdd ? ` + ${count.toAdd} to add` : ''}${count.spare ? `<span class="src">${count.spare} spare</span>` : ''}`;
  return [
    group('The row'),
    row('Pattern along the fence', layout => layout.pattern ? layout.pattern.short : 'two rows'),
    row('Mulberry to mulberry', layout => spacingText(layout.rows[0].spacing)),
    row('Hazelnut to hazelnut', layout => spacingText(layout.rows[1].spacing)),
    group(`Plants (on hand: ${ctx.stock.M} mulberries, ${ctx.stock.H} hazelnuts, ${ctx.stock.berryTotal} berry bushes)`),
    row('Red mulberry', layout => planted(layout.counts.M)),
    row('Hazelnut', layout => planted(layout.counts.H)),
    row('Small berries', layout => layout.pattern ? `${planted(layout.counts.berries)}<span class="src">in the front row</span>` : `${layout.counts.berries.planted + layout.counts.berries.spare}<span class="src">around the C1 trees</span>`),
    group('Space'),
    row('Strip used (fence to last row)', layout => `${num(layout.band)} ft`),
    row('Tractor alley, clear', layout => `${num(layout.alley.clear)} ft<span class="src">${num(layout.alley.clearFull)} ft at full width</span>`),
    row('Lane between the rows', layout => `${num(layout.lane.width)} ft<span class="src">${layout.lane.name.toLowerCase()}</span>`)
  ].join('');
}

// The table head shared by the two comparison tables: the current plan and each pattern.
function headRow(now, options) {
  return `<tr><th></th><th class="num">Current plan</th>${options.map(layout => `<th class="num${layout.id === G.DEFAULT_PATTERN ? ' picked' : ''}">${layout.pattern.id} · ${esc(layout.pattern.short)}</th>`).join('')}</tr>`;
}

function lightRows(now, options, byLayout) {
  const all = [now, ...options];
  const cell = (inner, layout, index) => `<td class="num${layout.id === G.DEFAULT_PATTERN && index > 0 ? ' picked' : ''}">${inner}</td>`;
  const bar = share => `<span class="bar" style="width:${Math.round(share * 100)}%"></span>`;
  const out = [];
  G.MULBERRY_CROWNS.forEach(entry => {
    out.push(`<tr class="group"><th colspan="${all.length + 1}">${esc(entry.label)} (${esc(G.crownDetail(entry, now.kinds))})</th></tr>`);
    out.push(`<tr><th scope="row">Share of the season's direct sun on the hazelnuts</th>${all.map((layout, index) => {
      const season = byLayout[layout.id][entry.id].hazel.season;
      return cell(`${pct(season.mean)}${bar(season.mean)}<span class="src">${pct(season.min)}–${pct(season.max)} across the row</span>`, layout, index);
    }).join('')}</tr>`);
    out.push(`<tr><th scope="row">Hours on June 21 with at least half the sun</th>${all.map((layout, index) =>
      cell(hours(byLayout[layout.id][entry.id].hazel.fullHours.mean), layout, index)).join('')}</tr>`);
    out.push(`<tr><th scope="row">Share of the season's sun on the berry row</th>${all.map((layout, index) => {
      const berries = byLayout[layout.id][entry.id].berries;
      return cell(berries ? pct(berries.season.mean) : '—', layout, index);
    }).join('')}</tr>`);
  });
  return out.join('');
}

// ------------------------------------------------------------------ wiring

function fill(scope, map) {
  scope.querySelectorAll('[data-m]').forEach(node => {
    const key = node.getAttribute('data-m');
    if (!(key in map)) throw new Error(`The page asks for "${key}", which the mock-up does not supply`);
    node.textContent = map[key];
  });
}
const put = (id, html) => { document.getElementById(id).innerHTML = html; };

function guard(work) {
  const notice = document.getElementById('data-error');
  try {
    if (!root.OrchardModel) throw new Error('data/orchard_model.js did not load');
    work();
  } catch (error) {
    notice.textContent = `The mock-up could not be drawn: ${error.message}`;
    notice.hidden = false;
    throw error;
  }
}

// "Print graphics only" puts .print-graphics-only on <html> for one print, so only the drawing sheets print. The class comes off when the print
// dialog closes, so a later Ctrl+P prints the whole page. The button stays disabled until the drawings are on the page.
function wirePrint() {
  const button = document.getElementById('print-graphics'), page = document.documentElement;
  const done = () => { page.classList.remove('print-graphics-only'); root.removeEventListener('afterprint', done); };
  button.disabled = false;
  button.addEventListener('click', () => {
    page.classList.add('print-graphics-only');
    root.addEventListener('afterprint', done);
    root.print();
  });
}

function mockup() {
  guard(() => {
    const OM = root.OrchardModel, ctx = G.context(OM), now = G.currentLayout(OM, ctx);
    const nowLight = G.lightByCrown(now), proposedLight = new Map();
    const asked = /pattern=([A-Z])/.exec(root.location ? root.location.hash : '');
    let chosen = asked && G.PATTERNS.some(entry => entry.id === asked[1]) ? asked[1] : G.DEFAULT_PATTERN;
    const choices = document.getElementById('pattern-choice');
    choices.innerHTML = G.PATTERNS.map(entry => `<label class="choice"><input type="radio" name="pattern" value="${entry.id}"><span><span class="name">${entry.id} · ${esc(entry.short)}</span><span class="what">${esc(entry.label)}</span></span></label>`).join('');
    const gridBox = document.getElementById('grid-toggle');
    const show = () => {
      const proposed = G.proposedLayout(OM, { pattern: chosen }, ctx), cmp = G.compare(now, proposed), drawing = { grid: gridBox.checked };
      if (!proposedLight.has(chosen)) proposedLight.set(chosen, G.lightByCrown(proposed));
      const light = { now: nowLight, proposed: proposedLight.get(chosen) };
      put('wg-specs', specCards(now, proposed, cmp, light));
      put('plan-now', D.planView(now, drawing));
      put('plan-new', D.planView(proposed, drawing));
      put('profile-now', D.profileView(now, drawing));
      put('profile-new', D.profileView(proposed, drawing));
      document.getElementById('plan-new-caption').innerHTML = `Proposed: pattern ${esc(proposed.pattern.id)}, ${esc(proposed.pattern.label.toLowerCase())} <span>(${esc(proposed.pattern.short)})</span>`;
      document.getElementById('profile-new-caption').innerHTML = `Proposed: pattern ${esc(proposed.pattern.id)} <span>(${esc(proposed.pattern.short)}), one row and a berry row</span>`;
      put('layer-table', layerRows(proposed, light));
      put('others-table', otherRows(proposed));
      document.getElementById('berry-codes').textContent = ctx.stock.berries.map(entry => `${entry.group.code} ${entry.group.name}`).join(', ');
      fill(document.body, values(now, proposed, cmp, light));
      choices.querySelectorAll('.choice').forEach(label => {
        const input = label.querySelector('input');
        input.checked = input.value === chosen;
        label.classList.toggle('on', input.checked);
      });
    };
    choices.addEventListener('change', event => {
      chosen = event.target.value;
      if (root.history && root.history.replaceState) root.history.replaceState(null, '', `#pattern=${chosen}`);
      show();
    });
    gridBox.addEventListener('change', show);
    show();
    wirePrint();
  });
}

function options() {
  guard(() => {
    const OM = root.OrchardModel, ctx = G.context(OM), now = G.currentLayout(OM, ctx);
    const layouts = G.PATTERNS.map(entry => G.proposedLayout(OM, { pattern: entry.id }, ctx));
    const byLayout = { now: G.lightByCrown(now) };
    layouts.forEach(layout => { byLayout[layout.id] = G.lightByCrown(layout); });
    const byId = Object.fromEntries(layouts.map(layout => [layout.id, layout]));
    const gridBox = document.getElementById('grid-toggle');
    const drawPlans = () => put('options-plans', planFigures(now, layouts, { grid: gridBox.checked }));
    gridBox.addEventListener('change', drawPlans);
    drawPlans();
    put('options-head', headRow(now, layouts));
    put('light-head', headRow(now, layouts));
    put('options-table', optionRows(now, layouts));
    put('light-table', lightRows(now, layouts, byLayout));
    fill(document.body, plainValues(now, byId, byLayout.now));
    wirePrint();
  });
}

root.WindbreakGuildPage = { values, plainValues, specCards, layerRows, otherRows, headRow, optionRows, lightRows, planFigures, COMPACT_PLAN, mockup, options, sqft, spacingText, nsLabel };
})(typeof window !== 'undefined' ? window : globalThis);
