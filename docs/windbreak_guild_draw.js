// The windbreak mock-up drawings, drawn from the layouts in windbreak_guild_model.js so that a new pattern redraws every figure.
// Each function takes a layout and returns an SVG string; the pages put it in a figure. Colors and line styles come from docs/windbreak_guild.css
// and match the windbreak figures on the orchard pollination grid: south up and west on the right in the plan, west on the right in the profile.
(function (root) {
'use strict';

const r2 = value => { const x = Math.round(value * 100) / 100; return x === 0 ? 0 : x; };
const esc = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Every distance the drawings and the pages write is a whole number of feet: the nearest foot, and a half goes up, so the plan's own 12.5 ft reads 13.
const num = value => String(Math.round(value));
function el(name, attrs, inner) {
  const text = Object.keys(attrs).filter(key => attrs[key] !== undefined && attrs[key] !== null && attrs[key] !== false && attrs[key] !== '')
    .map(key => ` ${key}="${esc(typeof attrs[key] === 'number' ? r2(attrs[key]) : attrs[key])}"`).join('');
  return inner === undefined ? `<${name}${text}/>` : `<${name}${text}>${inner}</${name}>`;
}
const rect = (x, y, width, height, cls, a = {}) => el('rect', { x, y, width, height, class: cls, ...a });
const line = (x1, y1, x2, y2, cls, a = {}) => el('line', { x1, y1, x2, y2, class: cls, ...a });
const circle = (cx, cy, r, cls, a = {}) => el('circle', { cx, cy, r, class: cls, ...a });
const ellipse = (cx, cy, rx, ry, cls, a = {}) => el('ellipse', { cx, cy, rx, ry, class: cls, ...a });
const text = (x, y, content, cls, a = {}) => el('text', { x, y, class: cls, ...a }, esc(content));
const group = (parts, a = {}) => el('g', a, parts.join(''));
const turned = (x, y, content, cls, a = {}) => text(x, y, content, cls, { 'text-anchor': 'middle', transform: `rotate(-90 ${r2(x)} ${r2(y)})`, ...a });
function svg(width, height, body, label, cls) {
  return `<svg class="diagram ${cls}" viewBox="0 0 ${r2(width)} ${r2(height)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title>${body.join('')}</svg>`;
}

const BUSH_STROKE = '#4E8A26';
const CANOPY_OPACITY = { M: 0.13, H: 0.3 };

// The first two neighbors of a kind that both sit inside [from, to] ft, as [y1, y2], or null.
function neighbors(layout, kind, from, to) {
  const list = layout.plants.filter(plant => plant.kind === kind);
  for (let index = 0; index + 1 < list.length; index++) if (list[index].y >= from && list[index + 1].y <= to) return [list[index].y, list[index + 1].y];
  return null;
}

// The 1 ft grid: blocks one foot on a side, with heavier lines every 5 ft and every 10 ft. One path per weight, so a figure carries three
// grid elements, not a hundred.
const weight = n => (n % 10 === 0 ? 10 : n % 5 === 0 ? 5 : 1);
const feet = (from, to) => Array.from({ length: Math.max(0, Math.floor(to) - Math.ceil(from) + 1) }, (_, index) => Math.ceil(from) + index);
function gridPaths(xs, ys, vertical, horizontal) {
  const lines = { 1: [], 5: [], 10: [] };
  xs.forEach(x => lines[weight(x)].push(vertical(x)));
  ys.forEach(y => lines[weight(y)].push(horizontal(y)));
  return [1, 5, 10].map(w => el('path', { d: lines[w].join(''), class: `g-grid g${w}` })).join('');
}
// A tape-measure edge: a tick on every foot, longer on 5 and 10, and a label wherever `label(n)` gives one. `point(n)` is foot n on the edge
// and `out` is the way the ticks point.
function tape(list, point, out, label) {
  return list.flatMap(n => {
    const [px, py] = point(n), length = n % 10 === 0 ? 9 : n % 5 === 0 ? 6 : 3;
    const mark = line(px, py, px + out[0] * length, py + out[1] * length, 'g-ruler');
    const words = label(n);
    return words ? [mark, words] : [mark];
  });
}

// Plan view to scale: a stretch of the strip along the west fence, with the alley and the first orchard trees. With `grid` (the default) it
// has 1 ft blocks and a ruler along the top (feet from the fence) and the left edge (feet north of the R1 line).
function planView(layout, o = {}) {
  const ctx = layout.ctx, K = layout.kinds, S = o.scale || 10, compact = Boolean(o.compact), grid = o.grid !== false;
  const y0 = o.y0 === undefined ? -12 : o.y0, y1 = o.y1 === undefined ? 48 : o.y1;
  const xWest = o.xWest === undefined ? -10 : o.xWest;
  const xEast = o.xEast === undefined ? ctx.orchardX0 + ctx.treeSpacing / 2 + ctx.limb + 3 : o.xEast;
  const padL = grid ? 38 : 0, padR = grid ? 14 : 0;
  const head = (compact ? 30 : 40) + (grid ? 20 : 0), foot = compact ? 46 : 48;
  const X = x => padL + (xEast - x) * S, Y = y => head + (y - y0) * S;
  const width = padL + (xEast - xWest) * S + padR, height = head + (y1 - y0) * S + foot;
  const clip = `${o.idPrefix || 'plan'}-${layout.id}-clip`;
  const inside = (y, margin) => y >= y0 - margin && y <= y1 + margin;
  const alley = layout.alley, lane = layout.lane;

  const field = [
    rect(X(ctx.stripWidth), Y(y0), ctx.stripWidth * S, (y1 - y0) * S, 'd-strip'),
    rect(X(alley.east), Y(y0), (alley.east - alley.west) * S, (y1 - y0) * S, 'd-alley'),
    line(X(ctx.stripWidth), Y(y0), X(ctx.stripWidth), Y(y1), 'd-plot')
  ];
  if (grid) field.push(gridPaths(feet(xWest, xEast), feet(y0, y1), x => `M${r2(X(x))},${r2(Y(y0))}V${r2(Y(y1))}`, y => `M${r2(X(xEast))},${r2(Y(y))}H${r2(X(xWest))}`));
  ['M', 'H'].forEach(kind => layout.plants.filter(plant => plant.kind === kind && inside(plant.y, K[kind].managedWidth / 2)).forEach(plant => {
    const color = K[kind].color, r = K[kind].managedWidth / 2 * S;
    field.push(plant.planted ? circle(X(plant.x), Y(plant.y), r, 'c-canopy', { fill: color, 'fill-opacity': CANOPY_OPACITY[kind], stroke: color, 'stroke-opacity': 0.45 })
      : circle(X(plant.x), Y(plant.y), r, 'd-future', { stroke: color }));
  }));
  ctx.c1.filter(tree => inside(tree.y, ctx.limb)).forEach(tree => {
    field.push(tree.state === 'tree' ? circle(X(tree.x), Y(tree.y), ctx.limb * S, 'd-orchard-crown')
      : circle(X(tree.x), Y(tree.y), (tree.state === 'reserved' ? ctx.limb : 3) * S, tree.state === 'reserved' ? 'd-reserved' : 'd-open'));
    field.push(circle(X(tree.x), Y(tree.y), 0.6 * S, 'd-trunk'));
    if (!compact) field.push(text(X(tree.x), Y(tree.y) + 20, tree.label, 'halo t-title', { 'text-anchor': 'middle', 'font-size': 11 }));
  });
  layout.berries.filter(bush => inside(bush.y, bush.width / 2)).forEach(bush => {
    const r = bush.width / 2 * S;
    if (!bush.planted) { field.push(circle(X(bush.x), Y(bush.y), r, 'd-future', { stroke: BUSH_STROKE })); return; }
    field.push(circle(X(bush.x), Y(bush.y), r, 'c-berry', { fill: K.B.color, 'fill-opacity': 0.6, stroke: BUSH_STROKE, 'stroke-width': 1.5 }));
    if (!compact) field.push(text(X(bush.x), Y(bush.y) + 4, bush.group.code, 'halo t-title', { 'text-anchor': 'middle', 'font-size': 11 }));
  });
  ['M', 'H'].forEach(kind => layout.plants.filter(plant => plant.kind === kind && plant.planted && inside(plant.y, 0.5))
    .forEach(plant => field.push(circle(X(plant.x), Y(plant.y), 0.6 * S, 'c-trunk', { fill: K[kind].color }))));
  field.push(line(X(0), Y(y0), X(0), Y(y1), 'd-fence'));
  const middle = Y((y0 + y1) / 2);
  field.push(turned(X((alley.west + alley.east) / 2), middle, `Tractor alley · ${num(alley.clear)} ft clear`, 't-title'));
  field.push(turned(X((lane.west + lane.east) / 2), Y(y0 + (y1 - y0) * 0.62), `${lane.name} · ${num(lane.width)} ft`, 'halo t-title'));

  const parts = [
    `<defs><clipPath id="${clip}">${rect(X(xEast), Y(y0), (xEast - xWest) * S, (y1 - y0) * S)}</clipPath></defs>`,
    group(field, { 'clip-path': `url(#${clip})` }),
    rect(X(xEast), Y(y0), (xEast - xWest) * S, (y1 - y0) * S, 'd-frame')
  ];
  // Dimensions: the spacing along the fence, written along a line west of the fence for each row, and the widths of the alley and the lane across the strip.
  const dimV = (x, a, b, label) => {
    parts.push(line(X(x), Y(a), X(x), Y(b), 'd-dim'), line(X(x) - 6, Y(a), X(x) + 6, Y(a), 'd-dim'), line(X(x) - 6, Y(b), X(x) + 6, Y(b), 'd-dim'));
    parts.push(turned(X(x) + 14, (Y(a) + Y(b)) / 2, label, 'halo t-title', { 'font-size': 12 }));
  };
  const dimH = (a, b, y, label) => {
    parts.push(line(X(a), Y(y), X(b), Y(y), 'd-dim'), line(X(a), Y(y) - 6, X(a), Y(y) + 6, 'd-dim'), line(X(b), Y(y) - 6, X(b), Y(y) + 6, 'd-dim'));
    parts.push(text(X((a + b) / 2), Y(y) - 8, label, 'halo t-title', { 'text-anchor': 'middle', 'font-size': 12 }));
  };
  const tall = neighbors(layout, 'M', y0 + 0.5, y1 - 0.5), low = neighbors(layout, 'H', y0 + 0.5, y1 - 0.5);
  const guild = layout.pattern ? ' · 1 guild' : '';
  if (tall) dimV(-2.5, tall[0], tall[1], `Mulberry ${num(tall[1] - tall[0])} ft${guild}`);
  if (low) dimV(-6, low[0], low[1], `Hazelnut ${num(low[1] - low[0])} ft`);
  dimH(alley.west, alley.east, y0 + 2.5, `${num(alley.clear)} ft`);
  dimH(lane.west, lane.east, y0 + 2.5, `${num(lane.width)} ft`);

  const names = layout.pattern
    ? [[0, 'Fence'], [layout.rows[0].x, 'Guild row'], [layout.berryRow.x, 'Berries'], [(alley.west + alley.east) / 2, 'Alley'], [ctx.orchardX0 + ctx.treeSpacing / 2, 'Orchard']]
    : [[0, 'Fence'], [layout.rows[0].x, 'Mulberry'], [layout.rows[1].x, 'Hazelnut'], [(alley.west + alley.east) / 2, 'Alley'], [ctx.orchardX0 + ctx.treeSpacing / 2, 'Orchard']];
  const nameY = Y(y0) - (grid ? 32 : 10);
  names.forEach(([x, label]) => parts.push(text(X(x), nameY, label, 't-title', { 'text-anchor': 'middle', 'font-size': 12 })));
  parts.push(text(4, nameY, '▲ South', 't-title', { 'font-size': 12 }));
  if (grid) {
    const every = compact ? 10 : 5;
    parts.push(...tape(feet(xWest, xEast), n => [X(n), Y(y0)], [0, -1], n => (n % every === 0 ? text(X(n), Y(y0) - 13, num(n), 'g-ruler-t', { 'text-anchor': 'middle', 'font-size': 9 }) : '')));
    parts.push(...tape(feet(y0, y1), n => [X(xEast), Y(n)], [-1, 0], n => (n % every === 0 ? text(X(xEast) - 12, Y(n) + 3, num(n), 'g-ruler-t', { 'text-anchor': 'end', 'font-size': 9 }) : '')));
    parts.push(turned(7, Y((y0 + y1) / 2), 'ft north of the R1 line', 'g-ruler-t', { 'font-size': 10 }));
  }
  const ticks = [...new Set([0, ...layout.rows.map(row => row.x), lane.west, lane.east, alley.west, alley.east, ctx.stripWidth, ctx.orchardX0, ctx.orchardX0 + ctx.treeSpacing / 2])];
  ticks.forEach(x => parts.push(line(X(x), Y(y1), X(x), Y(y1) + 10, 'd-tick'), text(X(x), Y(y1) + 26, num(x), '', { 'text-anchor': 'middle', 'font-size': 11 })));
  parts.push(text(X(xWest) - 4, Y(y1) + (compact ? 42 : 26), 'ft from fence', '', { 'text-anchor': 'end', 'font-size': 11 }));
  const label = `Plan view, to scale, south up and west on the right: ${layout.title}. ${layout.counts.M.planted} red mulberries, ${layout.counts.H.planted} hazelnuts, and ${layout.counts.berries.planted} small berries ${layout.counts.berries.place}; `
    + `a ${num(lane.width)} ft ${lane.name.toLowerCase()} and a tractor alley ${num(alley.clear)} ft clear, ${num(y1 - y0)} ft of the fence shown.${grid ? ' The grid blocks are 1 ft by 1 ft.' : ''}`;
  return svg(width, height, parts, label, 'plan-view');
}

// Profile looking south, west on the right: the heights of the plants, the lane, the alley, and the first orchard trees. With `grid` (the default)
// it has 1 ft blocks and a ruler along the top (feet from the fence) and the left edge (feet above the ground).
function profileView(layout, o = {}) {
  const ctx = layout.ctx, K = layout.kinds, S = o.scale || 10, grid = o.grid !== false;
  const left = o.left === undefined ? -22 : o.left, right = o.right === undefined ? ctx.orchardX0 + 20 : o.right;
  const top = o.top === undefined ? 58 : o.top, bottom = o.bottom === undefined ? -14 : o.bottom;
  const padL = grid ? 38 : 0, padR = grid ? 14 : 0, padT = grid ? 24 : 0;
  const X = x => padL + (right - x) * S, Y = h => padT + (top - h) * S;
  const alley = layout.alley, lane = layout.lane;
  const id = `${o.idPrefix || 'profile'}-${layout.id}`;
  const parts = [
    `<defs><marker id="${id}-wind" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#2F7FC1"/></marker></defs>`,
    rect(X(ctx.stripWidth), Y(top), ctx.stripWidth * S, top * S, 'd-strip'),
    rect(X(alley.east), Y(top), (alley.east - alley.west) * S, top * S, 'd-alley')
  ];
  if (grid) {
    parts.push(gridPaths(feet(left, right), feet(0, top), x => `M${r2(X(x))},${r2(Y(top))}V${r2(Y(0))}`, h => `M${r2(X(right))},${r2(Y(h))}H${r2(X(left))}`));
    parts.push(rect(X(right), Y(top), (right - left) * S, top * S, 'd-frame'));
  }
  parts.push(
    line(X(ctx.stripWidth), Y(top), X(ctx.stripWidth), Y(0), 'd-plot'),
    rect(X(0.35), Y(5), 0.7 * S, 5 * S, 'd-post'),
    text(X(-0.8), Y(1.4), 'Fence', '', { 'text-anchor': 'start', 'font-size': 12 })
  );
  // One crown of each kind stands for the whole row: from the side, the plants of a row overlap. `dx` and `dy` move a label clear of a neighbor.
  const standIn = layout.pattern ? [['M', layout.rows[0].x, 0, 0], ['H', layout.rows[1].x, 7.5, 0], ['B', layout.berryRow.x, 3, 0]]
    : [['M', layout.rows[0].x, 0, 0], ['H', layout.rows[1].x, 0, 0]];
  standIn.forEach(([kind, x, dx]) => {
    const spec = K[kind], p = spec.profile;
    parts.push(rect(X(x + 0.35), Y(p.trunk), 0.7 * S, p.trunk * S, 'c-trunk'));
    parts.push(ellipse(X(x), Y(p.crownMid), spec.managedWidth / 2 * S, p.crownHalfHeight * S, 'c-crown', { fill: spec.color, 'fill-opacity': kind === 'M' ? 0.5 : 0.55, stroke: spec.color, 'stroke-width': 1.5 }));
    const base = p.crownMid + p.crownHalfHeight + 1.2;
    parts.push(text(X(x + dx), Y(base + 2), p.label, 't-title halo', { 'text-anchor': 'middle', 'font-size': 13 }));
    parts.push(text(X(x + dx), Y(base), p.size, 'halo', { 'text-anchor': 'middle', 'font-size': 12 }));
  });
  const crown = ctx.limb, c1 = ctx.orchardX0;
  parts.push(rect(X(c1 + 0.4), Y(5), 0.8 * S, 5 * S, 'c-trunk'), circle(X(c1), Y(5 + crown), crown * S, 'd-orchard-crown'));
  parts.push(text(X(ctx.stripWidth + 0.8), Y(5 + 2 * crown + 3.2), 'First orchard trees', 't-title', { 'text-anchor': 'end', 'font-size': 13 }));
  parts.push(text(X(ctx.stripWidth + 0.8), Y(5 + 2 * crown + 1.2), `C1; limbs kept ${num(crown)} ft from trunk`, '', { 'text-anchor': 'end', 'font-size': 12 }));
  if (!layout.pattern) {
    const near = layout.berries.filter(bush => bush.r % 2 === 1).reduce((best, bush) => (best && best.x <= bush.x ? best : bush), null);
    if (near) {
      parts.push(ellipse(X(near.x), Y(2.6), near.width / 2 * S, 2.5 * S, 'c-crown', { fill: K.B.color, 'fill-opacity': 0.7, stroke: BUSH_STROKE, 'stroke-width': 1.5 }));
      parts.push(text(X(alley.east - 0.4), Y(3.7), 'Berry guild', 'halo t-title', { 'text-anchor': 'start', 'font-size': 12 }), text(X(alley.east - 0.4), Y(2), '4–6 ft', 'halo', { 'text-anchor': 'start', 'font-size': 12 }));
    }
  }
  parts.push(line(X(left), Y(0), X(right), Y(0), 'd-ground'));
  [5, 17, 32].forEach(h => parts.push(line(X(left + 1), Y(h), X(-8), Y(h), 'd-wind', { 'marker-end': `url(#${id}-wind)` })));
  parts.push(el('path', { d: `M${r2(X(left + 1))},${r2(Y(44))} C${r2(X(0))},${r2(Y(57))} ${r2(X(24))},${r2(Y(56))} ${r2(X(right - 1))},${r2(Y(30))}`, class: 'd-wind-lift', 'marker-end': `url(#${id}-wind)` }));
  parts.push(text(X(left + 1), Y(40), 'Prevailing west wind', 't-title', { 'text-anchor': 'end', 'font-size': 13 }));
  const mid = (alley.west + alley.east) / 2;
  parts.push(text(X(mid), Y(30), 'Tractor', 't-title', { 'text-anchor': 'middle', 'font-size': 12 }), text(X(mid), Y(28.2), 'alley', 't-title', { 'text-anchor': 'middle', 'font-size': 12 }),
    text(X(mid), Y(26.4), `${num(alley.clear)} ft clear`, '', { 'text-anchor': 'middle', 'font-size': 12 }));
  if (!layout.pattern) {
    const laneMid = (lane.west + lane.east) / 2;
    parts.push(text(X(laneMid), Y(5.6), lane.name, 't-title', { 'text-anchor': 'middle', 'font-size': 12 }), text(X(laneMid), Y(3.8), `${num(lane.width)} ft`, '', { 'text-anchor': 'middle', 'font-size': 12 }));
  }
  // Below the ground: distances from the fence, then the widths that matter.
  const ticks = [...new Set([0, ...layout.rows.map(row => row.x), lane.west, lane.east, alley.west, alley.east, ctx.stripWidth, c1])];
  ticks.forEach(x => parts.push(line(X(x), Y(0), X(x), Y(-1.6), 'd-tick'), text(X(x), Y(-3.3), num(x), '', { 'text-anchor': 'middle', 'font-size': 12 })));
  parts.push(text(X(left + 1), Y(-3.3), 'ft from fence', '', { 'text-anchor': 'end', 'font-size': 12 }));
  const span = (a, b, h, label, anchor = 'middle') => {
    parts.push(line(X(a), Y(h), X(b), Y(h), 'd-tick'), line(X(a), Y(h) - 4, X(a), Y(h) + 4, 'd-tick'), line(X(b), Y(h) - 4, X(b), Y(h) + 4, 'd-tick'));
    parts.push(text(X(anchor === 'middle' ? (a + b) / 2 : a), Y(h - 2), label, '', { 'text-anchor': anchor, 'font-size': 12 }));
  };
  span(0, layout.band, -5.2, `Strip used — ${num(layout.band)} ft`);
  span(alley.west, alley.east, -5.2, `Alley — ${num(alley.clear)} ft clear`);
  span(lane.west, lane.east, -9.6, `${lane.name} — ${num(lane.width)} ft`, 'start');
  if (grid) {
    parts.push(...tape(feet(left, right), n => [X(n), Y(top)], [0, -1], n => (n % 5 === 0 ? text(X(n), Y(top) - 13, num(n), 'g-ruler-t', { 'text-anchor': 'middle', 'font-size': 9 }) : '')));
    parts.push(...tape(feet(0, top), n => [X(right), Y(n)], [-1, 0], n => (n % 5 === 0 ? text(X(right) - 12, Y(n) + 3, num(n), 'g-ruler-t', { 'text-anchor': 'end', 'font-size': 9 }) : '')));
    parts.push(turned(7, Y(top / 2), 'ft above the ground', 'g-ruler-t', { 'font-size': 10 }));
  }
  const label = `Profile looking south, west on the right: ${layout.title}. West fence at 0 ft; ${layout.rows.map(row => `${K[row.kind].profile.label.toLowerCase()} ${num(row.x)} ft from the fence`).join('; ')}; `
    + `${lane.name.toLowerCase()} ${num(lane.west)} to ${num(lane.east)} ft; tractor alley ${num(alley.west)} to ${num(alley.east)} ft; first orchard trunks ${num(c1)} ft from the fence.${grid ? ' The grid blocks are 1 ft by 1 ft.' : ''}`;
  return svg(padL + (right - left) * S + padR, padT + (top - bottom) * S, parts, label, 'profile-view');
}

root.WindbreakGuildDraw = { num, planView, profileView };
})(typeof window !== 'undefined' ? window : globalThis);
