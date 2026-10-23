// The photo map: where each drone photo was taken, drawn on the lot, with a viewer for the photo. The page (photo_map.html) loads data/site_grid.js,
// data/photos.js, site_photos.js, and this script, then calls PhotoMap.start(). Everything above start() needs no page, so tools/test_photo_map.js
// tests it on its own.
(function (root) {
'use strict';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const COMPASS_NAMES = ['north', 'north-northeast', 'northeast', 'east-northeast', 'east', 'east-southeast', 'southeast', 'south-southeast',
  'south', 'south-southwest', 'southwest', 'west-southwest', 'west', 'west-northwest', 'northwest', 'north-northwest'];
// One color for each day the drone flew, dark enough to carry a white number.
const DAY_COLORS = ['#B84F00', '#0059A0', '#00704F', '#8C3B8C', '#8A6D00'];
// Where the photo files are, relative to the page; data/photos.json names a photo by its file name only.
const PHOTO_DIR = 'images/';
// A photo tilted this far down or more counts as taken straight down.
const OVERHEAD_PITCH = -80;
// The farthest, in feet, the view of an angled photo is drawn, however shallow the tilt.
const LONGEST_VIEW_FT = 1200;
// The zoom buttons, in order, with the room kept around each view in feet.
const ZOOMS = [['whole', 'Whole lot', 30], ['orchard', 'Orchard', 25], ['homestead', 'Homestead', 40]];
const SVG_NS = 'http://www.w3.org/2000/svg';
const rad = degrees => degrees * Math.PI / 180;

// ---------- Times and directions ----------

// A local time like 2026-10-19T17:52:20 taken apart as written, with no time zone, or null when it is not one.
function parseTaken(taken) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):\d{2}$/.exec(String(taken));
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]), hour: Number(match[4]), minute: Number(match[5]), date: `${match[1]}-${match[2]}-${match[3]}` };
}
function dayLabel(taken) {
  const t = parseTaken(taken);
  return t ? `${MONTHS[t.month - 1]} ${t.day}` : '';
}
function timeLabel(taken) {
  const t = parseTaken(taken);
  if (!t) return '';
  return `${t.hour % 12 === 0 ? 12 : t.hour % 12}:${String(t.minute).padStart(2, '0')} ${t.hour < 12 ? 'am' : 'pm'}`;
}
function whenLabel(taken) {
  const t = parseTaken(taken);
  return t ? `${dayLabel(taken)}, ${t.year}, ${timeLabel(taken)}` : '';
}
const compassIndex = heading => Math.round((((heading % 360) + 360) % 360) / 22.5) % 16;
// A heading in degrees clockwise from north as a compass point: 162 is "SSE" and "south-southeast".
function compass(heading) { return COMPASS[compassIndex(heading)]; }
function compassName(heading) { return COMPASS_NAMES[compassIndex(heading)]; }

// ---------- What a photo shows ----------

function isOverhead(photo) { return photo.pitch <= OVERHEAD_PITCH; }

// How the camera was set: height above the take-off point, the way it faced, and its tilt.
function cameraText(photo) {
  const up = `${Math.round(photo.height_ft)} ft up`;
  if (isOverhead(photo)) return `${up}, looking straight down; the top of the photo faces ${compassName(photo.heading)}`;
  const tilt = Math.round(Math.abs(photo.pitch));
  const lean = tilt < 1 ? 'level' : photo.pitch > 0 ? `tilted ${tilt}° up` : `tilted ${tilt}° down`;
  return `${up}, facing ${compassName(photo.heading)}, ${lean}`;
}

// Where the middle of the photo meets the ground, in lot feet, and how far from the camera that is; null when the camera points at or above the horizon.
function lookAt(photo) {
  if (photo.pitch >= -1) return null;
  const distance = Math.min(photo.height_ft / Math.tan(rad(-photo.pitch)), LONGEST_VIEW_FT);
  const bearing = rad(photo.heading);
  return { x: photo.x + distance * Math.sin(bearing), y: photo.y - distance * Math.cos(bearing), distance };
}

// The ground a photo shows, as corners in lot feet: a rectangle for a photo taken straight down (turned to the way the top of the photo faced),
// and a long triangle for an angled one, from the camera to the width the photo spans where its middle meets the ground.
function viewShape(photo) {
  const bearing = rad(photo.heading), forward = [Math.sin(bearing), -Math.cos(bearing)], right = [Math.cos(bearing), Math.sin(bearing)];
  const half = Math.tan(rad(photo.fov) / 2);
  const toLot = (across, ahead, from) => [from.x + across * right[0] + ahead * forward[0], from.y + across * right[1] + ahead * forward[1]];
  if (isOverhead(photo)) {
    const middle = lookAt(photo), width = photo.height_ft * half, height = width * 0.75;
    return { kind: 'footprint', look: [middle.x, middle.y],
      points: [toLot(-width, height, middle), toLot(width, height, middle), toLot(width, -height, middle), toLot(-width, -height, middle)] };
  }
  const middle = lookAt(photo), distance = middle ? middle.distance : 300;
  const far = toLot(0, distance, photo), spread = Math.hypot(distance, photo.height_ft) * half;
  return { kind: 'wedge', look: far, points: [[photo.x, photo.y], toLot(-spread, distance, photo), toLot(spread, distance, photo)] };
}

// The turn, in degrees clockwise, that points an arrow at north in a photo whose top faces `heading`. (0 - n keeps a heading of 0 from giving -0.)
function northArrowAngle(photo) { return 0 - photo.heading; }

// ---------- The list of photos ----------

const byTime = (a, b) => (a.taken < b.taken ? -1 : a.taken > b.taken ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// The days photos were taken, oldest first, as { date, label, count }.
function flightDays(records) {
  const days = {};
  records.forEach(photo => {
    const t = parseTaken(photo.taken);
    if (!t) return;
    days[t.date] = days[t.date] || { date: t.date, label: dayLabel(photo.taken), count: 0 };
    days[t.date].count += 1;
  });
  return Object.keys(days).sort().map(date => days[date]);
}
function dayColor(days, date) {
  const index = days.findIndex(day => day.date === date);
  return DAY_COLORS[(index < 0 ? 0 : index) % DAY_COLORS.length];
}

// The photos that pass the filter, oldest first. day is "all" or a date like 2026-10-19; view is "all", "overhead", or "angled".
function filterPhotos(records, filter) {
  const day = (filter && filter.day) || 'all', view = (filter && filter.view) || 'all';
  return records.filter(photo => {
    const t = parseTaken(photo.taken);
    if (day !== 'all' && (!t || t.date !== day)) return false;
    return view === 'all' || (view === 'overhead') === isOverhead(photo);
  }).sort(byTime);
}

// The id of the photo `step` places on from `id` in the list, wrapping around the ends; the first (or last, going back) when `id` is not in it.
function stepPhoto(list, id, step) {
  if (!list.length) return null;
  const index = list.findIndex(photo => photo.id === id);
  if (index < 0) return list[step < 0 ? list.length - 1 : 0].id;
  return list[(((index + step) % list.length) + list.length) % list.length].id;
}

// Each photo's place in the whole list by time, starting at 1, so a number means the same photo on the map and in the thumbnails.
function numberPhotos(records) {
  const numbers = {};
  records.slice().sort(byTime).forEach((photo, index) => { numbers[photo.id] = index + 1; });
  return numbers;
}

// ---------- The map ----------

const union = boxes => ({ x0: Math.min(...boxes.map(b => b.x0)), y0: Math.min(...boxes.map(b => b.y0)), x1: Math.max(...boxes.map(b => b.x1)), y1: Math.max(...boxes.map(b => b.y1)) });
const grow = (box, by) => ({ x0: box.x0 - by, y0: box.y0 - by, x1: box.x1 + by, y1: box.y1 + by });
const asView = box => ({ x: box.x0, y: box.y0, w: box.x1 - box.x0, h: box.y1 - box.y0 });

// The part of the lot each zoom button shows, as { x, y, w, h } in lot feet: the whole lot and every camera, the orchard strip, and the homestead.
function zoomViews(grid, records) {
  const margin = Object.fromEntries(ZOOMS.map(([name, , room]) => [name, room]));
  const fence = grid.data.lot.fence, find = id => grid.features(f => f.id === id)[0];
  const block = find('orchard_block');
  const lot = { x0: 0, y0: 0, x1: fence.width, y1: fence.depth };
  const strip = { x0: 0, y0: 0, x1: fence.width, y1: block ? grid.bbox(block).y1 : fence.depth / 2 };
  const yard = grid.features(f => f.group === 'homestead' || f.id === 'yard').map(f => grid.bbox(f));
  return {
    whole: asView(grow(union([lot, ...records.map(p => ({ x0: p.x, y0: p.y, x1: p.x, y1: p.y }))]), margin.whole)),
    orchard: asView(grow(strip, margin.orchard)),
    homestead: asView(grow(union(yard.length ? yard : [lot]), margin.homestead))
  };
}
function inView(view, x, y) { return x >= view.x && x <= view.x + view.w && y >= view.y && y <= view.y + view.h; }
// The smallest zoom that has the point in it, starting from `current` when that already does.
function zoomFor(views, current, x, y) {
  if (views[current] && inView(views[current], x, y)) return current;
  const fits = Object.keys(views).filter(name => inView(views[name], x, y)).sort((a, b) => views[a].w * views[a].h - views[b].w * views[b].h);
  return fits[0] || 'whole';
}
// Lot feet to drawing units for a view drawn `width` units wide.
function projector(view, width) {
  const scale = width / view.w;
  return { scale, height: view.h * scale, x: x => (x - view.x) * scale, y: y => (y - view.y) * scale };
}

// Moves points (in drawing units) apart until none is closer than `gap` to another, so markers that sit on top of each other can all be reached.
// Takes [{ id, x, y }] and gives [{ id, x, y, moved }] in the same order; moved is true where a point ended up more than 2 units from where it began.
function spreadPoints(points, gap, rounds) {
  const out = points.map(p => ({ id: p.id, x: p.x, y: p.y, ox: p.x, oy: p.y }));
  for (let round = 0; round < (rounds || 80); round++) {
    let moved = false;
    for (let a = 0; a < out.length; a++) {
      for (let b = a + 1; b < out.length; b++) {
        let dx = out[b].x - out[a].x, dy = out[b].y - out[a].y, d = Math.hypot(dx, dy);
        if (d >= gap) continue;
        if (d < 1e-6) { dx = Math.cos((a + b) * 2.399963); dy = Math.sin((a + b) * 2.399963); d = 1; }
        const push = (gap - d) / 2 + 0.01, ux = dx / d, uy = dy / d;
        out[a].x -= ux * push; out[a].y -= uy * push;
        out[b].x += ux * push; out[b].y += uy * push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return out.map(p => ({ id: p.id, x: +p.x.toFixed(2), y: +p.y.toFixed(2), moved: Math.hypot(p.x - p.ox, p.y - p.oy) > 2 }));
}

root.PhotoMap = { MONTHS, COMPASS, DAY_COLORS, ZOOMS, OVERHEAD_PITCH, parseTaken, dayLabel, timeLabel, whenLabel, compass, compassName, isOverhead, cameraText,
  lookAt, viewShape, northArrowAngle, flightDays, dayColor, filterPhotos, stepPhoto, numberPhotos, zoomViews, inView, zoomFor, projector, spreadPoints, start };

// ---------- The page ----------

function svgNode(tag, attrs, text) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.keys(attrs || {}).forEach(key => node.setAttribute(key, attrs[key]));
  if (text !== undefined) node.textContent = text;
  return node;
}
function htmlNode(tag, className, text, attrs) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  Object.keys(attrs || {}).forEach(key => node.setAttribute(key, attrs[key]));
  return node;
}
const photoNumber = (numbers, photo) => numbers[photo.id];

// The lot as a quiet backdrop, in drawing units: roads, the orchard, the yard and pads, buildings, water lines, hydrants and valve boxes, the 50 ft grid
// with its cell names, and the fence. Photos are drawn over it, so it stays light.
function drawBase(parent, grid, P, view) {
  const find = id => grid.features(f => f.id === id)[0];
  const fence = grid.data.lot.fence, cols = grid.data.grid.columns, cell = grid.data.grid.cell;
  const at = (x, y) => `${P.x(x).toFixed(1)},${P.y(y).toFixed(1)}`;
  const route = points => points.map(([x, y], i) => `${i ? 'L' : 'M'}${at(x, y)}`).join('');
  const draw = (f, attrs) => {
    if (!f) return;
    let node = null;
    if (f.shape === 'rect') node = svgNode('rect', { x: P.x(f.x0), y: P.y(f.y0), width: (f.x1 - f.x0) * P.scale, height: (f.y1 - f.y0) * P.scale });
    else if (f.shape === 'circle') node = svgNode('circle', { cx: P.x(f.cx), cy: P.y(f.cy), r: f.r * P.scale });
    else if (f.shape === 'polygon') node = svgNode('path', { d: `${route(f.pts)}Z` });
    else if (f.shape === 'line') node = svgNode('path', { d: route(f.pts), fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': (f.width || 1) * P.scale });
    if (!node) return;
    Object.keys(attrs).forEach(key => node.setAttribute(key, attrs[key]));
    parent.append(node);
  };
  const label = (x, y, text, attrs) => {
    if (inView(view, x, y)) parent.append(svgNode('text', Object.assign({ x: P.x(x), y: P.y(y), class: 'pm-label-text' }, attrs), text));
  };
  draw({ shape: 'rect', x0: 0, y0: 0, x1: fence.width, y1: fence.depth }, { fill: '#F7F5EE' });
  ['road_north', 'road_south'].forEach(id => draw(find(id), { stroke: '#D9D6CE' }));
  draw(find('windbreak'), { fill: '#5E8F3E', 'fill-opacity': 0.2 });
  draw(find('orchard_block'), { fill: '#B07A3E', 'fill-opacity': 0.1, stroke: '#B07A3E', 'stroke-width': 1 });
  ['yard', 'driveway', 'loop_path', 'path_workshop', 'path_rv'].forEach(id => draw(find(id), { fill: find(id) && find(id).shape === 'line' ? 'none' : '#DDD0B8', stroke: '#DDD0B8' }));
  ['house_pad', 'workshop_pad', 'rv_pad'].forEach(id => draw(find(id), { fill: '#EEE4CF', stroke: '#A8906A', 'stroke-width': 0.8 }));
  grid.features(f => f.kind === 'water_pipe').forEach(f => draw(f, Object.assign({ stroke: '#1B4F9C', 'stroke-width': f.size_in >= 2 ? 1.5 : 1 }, f.size_in >= 2 ? {} : { 'stroke-dasharray': '3.5 1.8' })));
  [['shed', '#A9372B'], ['outhouse', '#2F6EB5'], ['container_solar', '#2F4A6E'], ['container_storage', '#BDBDB5'], ['pump_house', '#5D6D7E'], ['rv', '#FFFFFF'], ['irrigation_tank', '#1E1E1E']]
    .forEach(([id, fill]) => draw(find(id), { fill, stroke: '#3D3D3A', 'stroke-width': 0.5 }));
  grid.features(f => f.kind === 'hydrant').forEach(f => parent.append(svgNode('circle', { cx: P.x(f.x), cy: P.y(f.y), r: 2.6, fill: '#1B4F9C', stroke: '#fff', 'stroke-width': 0.8 })));
  grid.features(f => f.kind === 'valve_box').forEach(f => parent.append(svgNode('rect', { x: P.x(f.x) - 1.8, y: P.y(f.y) - 1.8, width: 3.6, height: 3.6, fill: '#1F9E89', stroke: '#fff', 'stroke-width': 0.7 })));
  const gridLines = [];
  for (let c = 1; c * cell < fence.width; c++) gridLines.push(`M${at(c * cell, 0)}L${at(c * cell, fence.depth)}`);
  for (let r = 1; r * cell < fence.depth; r++) gridLines.push(`M${at(0, r * cell)}L${at(fence.width, r * cell)}`);
  parent.append(svgNode('path', { d: gridLines.join(''), fill: 'none', stroke: 'rgba(40,40,40,0.2)', 'stroke-width': 0.6 }));
  for (let c = 0; c < cols.length; c++) {
    for (let r = 0; r < grid.data.grid.rows; r++) {
      const x = c * cell + 2, y = r * cell + 9;
      if (c * cell + 4 < fence.width && r * cell + 4 < fence.depth) label(x, y, `${cols[c]}${r + 1}`, { class: 'pm-cell-text' });
    }
  }
  parent.append(svgNode('rect', { x: P.x(0), y: P.y(0), width: fence.width * P.scale, height: fence.depth * P.scale, fill: 'none', stroke: '#6B5A45', 'stroke-width': 1.6 }));
  const block = find('orchard_block');
  if (block) label((block.x0 + block.x1) / 2, (block.y0 + block.y1) / 2, 'ORCHARD', { 'text-anchor': 'middle', class: 'pm-label-text pm-label-big' });
  const yard = grid.features(f => f.group === 'homestead').map(f => grid.bbox(f));
  if (yard.length) { const home = union(yard); label((home.x0 + home.x1) / 2, home.y0 - 8, 'HOMESTEAD', { 'text-anchor': 'middle', class: 'pm-label-text pm-label-big' }); }
  [['road_north', 'NORTH ROAD'], ['road_south', 'SOUTH ROAD']].forEach(([id, text]) => {
    const road = find(id);
    if (road) label(fence.width / 2, (road.pts[0][1] + road.pts[road.pts.length - 1][1]) / 2 + 2.5, text, { 'text-anchor': 'middle' });
  });
}

// A north arrow and a scale bar in the corners of the drawing, in drawing units. The arrow sits on a pale disc so it reads over the grid labels.
function drawFurniture(parent, P, width, height) {
  const arrow = svgNode('g', { transform: `translate(${width - 24} 30)`, 'aria-hidden': 'true' });
  arrow.append(svgNode('circle', { r: 16, cy: -3, fill: 'rgba(255,255,255,0.88)' }), svgNode('path', { d: 'M0,-13 L5,6 L0,2 L-5,6Z', fill: '#2C2C2A' }), svgNode('text', { y: -15, 'text-anchor': 'middle', class: 'pm-north-text' }, 'N'));
  const feet = [500, 200, 100, 50].find(f => f * P.scale <= width * 0.4) || 50, bar = feet * P.scale;
  const scale = svgNode('g', { transform: `translate(10 ${height - 16})`, 'aria-hidden': 'true' });
  scale.append(svgNode('path', { d: `M0,-4 V0 H${bar} V-4`, fill: 'none', stroke: '#2C2C2A', 'stroke-width': 1.4 }), svgNode('text', { x: bar / 2, y: -7, 'text-anchor': 'middle', class: 'pm-scale-text' }, `${feet} ft`));
  parent.append(arrow, scale);
}

function start(options) {
  const opt = Object.assign({ records: (root.SITE_PHOTOS || {}).records || [], grid: root.SiteGrid }, options);
  const grid = opt.grid, all = opt.records.slice().sort(byTime);
  const numbers = numberPhotos(all), days = flightDays(all), views = zoomViews(grid, all);
  const byId = {};
  all.forEach(photo => { byId[photo.id] = photo; });
  const host = id => document.getElementById(id);
  const mapHost = host('pm-map'), controlsHost = host('pm-controls'), viewerHost = host('pm-viewer'), thumbsHost = host('pm-thumbs'), statusHost = host('pm-status');
  const announceHost = host('pm-announce');
  const narrow = window.matchMedia('(max-width: 899px)');
  const smooth = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  const state = { day: 'all', view: 'all', zoom: narrow.matches ? 'homestead' : 'whole', selected: null, hot: null, opener: null };
  const refs = { dots: {}, thumbs: {}, width: 0, P: null, shapes: null, pos: {} };
  const colorOf = photo => dayColor(days, parseTaken(photo.taken).date);
  const visible = () => filterPhotos(all, state);
  const shownOnMap = () => visible().filter(photo => inView(views[state.zoom], photo.x, photo.y));
  const describe = photo => `Photo ${photoNumber(numbers, photo)} of ${all.length}, ${dayLabel(photo.taken)}, ${timeLabel(photo.taken)}. ${photo.caption}`;

  // ----- Controls -----
  function renderControls() {
    // Rebuilding the buttons would drop the keyboard focus, so put it back on the same button.
    const buttons = () => Array.from(controlsHost.querySelectorAll('button'));
    const kept = buttons().indexOf(document.activeElement);
    controlsHost.textContent = '';
    const group = (name, aria, buttons) => {
      const box = htmlNode('div', 'pm-group', undefined, { role: 'group', 'aria-label': aria });
      box.append(htmlNode('span', 'pm-group-name', name));
      buttons.forEach(b => {
        const button = htmlNode('button', 'pm-chip', undefined, { type: 'button', 'aria-pressed': String(b.on) });
        if (b.color) button.append(htmlNode('i', 'pm-swatch', undefined, { style: `background:${b.color}` }));
        button.append(document.createTextNode(`${b.text} `), htmlNode('span', 'pm-chip-count', `(${b.count})`));
        button.addEventListener('click', b.click);
        box.append(button);
      });
      return box;
    };
    const dayChoices = filterPhotos(all, { view: state.view }), viewChoices = filterPhotos(all, { day: state.day });
    controlsHost.append(
      group('Day', 'Show photos from one day', [{ text: 'All', count: dayChoices.length, on: state.day === 'all', click: () => setFilter('day', 'all') }]
        .concat(days.map(day => ({ text: day.label, count: dayChoices.filter(p => parseTaken(p.taken).date === day.date).length, on: state.day === day.date, color: dayColor(days, day.date), click: () => setFilter('day', day.date) })))),
      group('Shot', 'Show straight-down or angled photos', [['all', 'All'], ['overhead', 'Straight down'], ['angled', 'Angled']]
        .map(([value, text]) => ({ text, count: filterPhotos(viewChoices, { view: value }).length, on: state.view === value, click: () => setFilter('view', value) }))),
      group('Zoom', 'Zoom the map', ZOOMS.map(([name, text]) => ({ text, count: visible().filter(p => inView(views[name], p.x, p.y)).length, on: state.zoom === name, click: () => setZoom(name) })))
    );
    const list = visible();
    statusHost.textContent = list.length === all.length ? `${all.length} photos` : `${list.length} of ${all.length} photos`;
    if (kept >= 0 && buttons()[kept]) buttons()[kept].focus();
  }

  // ----- Map -----
  function renderMap() {
    const view = views[state.zoom], width = Math.max(260, Math.round(mapHost.clientWidth || 480));
    const P = projector(view, width), height = Math.round(P.height);
    const svg = svgNode('svg', { viewBox: `0 0 ${width} ${height}`, class: 'pm-svg', role: 'group', 'aria-label': 'Map of the lot with a marker where each photo was taken' });
    const base = svgNode('g', { 'aria-hidden': 'true' });
    drawBase(base, grid, P, view);
    refs.shapes = svgNode('g', { class: 'pm-shapes', 'aria-hidden': 'true' });
    refs.markers = svgNode('g', { class: 'pm-markers' });
    svg.append(base, refs.shapes, refs.markers);
    drawFurniture(svg, P, width, height);
    mapHost.textContent = '';
    mapHost.append(svg);
    refs.P = P;
    refs.width = width;
    renderMarkers();
  }

  const shapePath = photo => viewShape(photo).points.map(([x, y], i) => `${i ? 'L' : 'M'}${refs.P.x(x).toFixed(1)},${refs.P.y(y).toFixed(1)}`).join('') + 'Z';
  function drawShapes() {
    refs.shapes.textContent = '';
    [['hot', state.hot], ['selected', state.selected]].forEach(([kind, id]) => {
      const photo = id && byId[id];
      if (!photo || !refs.dots[id] || (kind === 'hot' && id === state.selected)) return;
      refs.shapes.append(svgNode('path', { d: shapePath(photo), class: `pm-view pm-view-${kind}`, fill: colorOf(photo), stroke: colorOf(photo) }));
    });
  }

  function renderMarkers() {
    refs.markers.textContent = '';
    refs.dots = {};
    const P = refs.P, shown = shownOnMap();
    const spread = spreadPoints(shown.map(photo => ({ id: photo.id, x: P.x(photo.x), y: P.y(photo.y) })), 20);
    refs.pos = {};
    spread.forEach(point => { refs.pos[point.id] = point; });
    shown.forEach(photo => {
      const point = refs.pos[photo.id];
      if (point.moved) {
        refs.markers.append(svgNode('path', { d: `M${P.x(photo.x).toFixed(1)},${P.y(photo.y).toFixed(1)}L${point.x},${point.y}`, class: 'pm-leader', fill: 'none' }),
          svgNode('circle', { cx: P.x(photo.x).toFixed(1), cy: P.y(photo.y).toFixed(1), r: 2, class: 'pm-true', fill: colorOf(photo) }));
      }
    });
    shown.forEach(photo => {
      const dot = marker(photo, refs.pos[photo.id]);
      refs.dots[photo.id] = dot;
      refs.markers.append(dot);
    });
    updateMarks();
    drawShapes();
  }

  function marker(photo, at) {
    const color = colorOf(photo);
    const dot = svgNode('g', { class: 'pm-dot', transform: `translate(${at.x} ${at.y})`, tabindex: 0, role: 'button', 'data-id': photo.id, 'aria-label': describe(photo) });
    dot.append(svgNode('circle', { class: 'pm-hit', r: 15 }), svgNode('circle', { class: 'pm-ring', r: 14, fill: 'none' }),
      svgNode('path', { d: 'M0,-17 L5.5,-8 L-5.5,-8Z', fill: color, transform: `rotate(${photo.heading})` }),
      isOverhead(photo) ? svgNode('rect', { class: 'pm-shape', x: -8, y: -8, width: 16, height: 16, rx: 3, fill: color, transform: `rotate(${photo.heading})` })
        : svgNode('circle', { class: 'pm-shape', r: 8.5, fill: color }),
      svgNode('text', { class: 'pm-num', y: 0.5, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, String(photoNumber(numbers, photo))));
    dot.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') setHot(photo.id, { x: event.clientX, y: event.clientY }); });
    dot.addEventListener('pointermove', event => { if (event.pointerType !== 'touch' && state.hot === photo.id) placeCard({ x: event.clientX, y: event.clientY }); });
    dot.addEventListener('pointerleave', () => setHot(null));
    dot.addEventListener('focus', () => { if (!refs.quiet && keyboardFocus(dot)) setHot(photo.id, centerOf(dot)); });
    dot.addEventListener('blur', () => setHot(null));
    dot.addEventListener('click', () => select(photo.id, { opener: dot }));
    dot.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      select(photo.id, { opener: dot });
    });
    return dot;
  }

  // Marks the chosen and the pointed-at marker and thumbnail without redrawing the map.
  function updateMarks() {
    Object.keys(refs.dots).forEach(id => {
      refs.dots[id].classList.toggle('pm-sel', id === state.selected);
      refs.dots[id].classList.toggle('pm-hot', id === state.hot);
      refs.dots[id].setAttribute('aria-pressed', String(id === state.selected));
    });
    Object.keys(refs.thumbs).forEach(id => {
      refs.thumbs[id].classList.toggle('pm-hot', id === state.hot);
      if (id === state.selected) refs.thumbs[id].setAttribute('aria-current', 'true'); else refs.thumbs[id].removeAttribute('aria-current');
    });
  }

  // ----- Hover card -----
  const card = htmlNode('div', 'pm-card', undefined, { role: 'presentation' });
  card.hidden = true;
  const cardImage = htmlNode('img', '', undefined, { alt: '', decoding: 'async' });
  const cardCaption = htmlNode('p', 'pm-card-caption'), cardMeta = htmlNode('p', 'pm-card-meta');
  card.append(cardImage, cardCaption, cardMeta);
  document.body.append(card);

  const centerOf = node => {
    const box = node.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  };
  // Focus that came from the keyboard, not from a click or tap.
  const keyboardFocus = node => {
    try { return node.matches(':focus-visible'); } catch (error) { return true; }
  };
  function placeCard(at) {
    const size = { width: card.offsetWidth, height: card.offsetHeight };
    const view = { left: 0, top: 0, right: document.documentElement.clientWidth, bottom: window.innerHeight };
    const spot = root.SitePhotos ? root.SitePhotos.cardPosition(at, size, view) : { left: at.x + 14, top: at.y + 14 };
    card.style.left = `${Math.round(spot.left)}px`;
    card.style.top = `${Math.round(spot.top)}px`;
  }
  function setHot(id, at) {
    state.hot = id;
    updateMarks();
    drawShapes();
    const photo = id && byId[id];
    if (!photo || !at || id === state.selected) { card.hidden = true; return; }
    cardImage.src = PHOTO_DIR + photo.thumb;
    cardCaption.textContent = photo.caption;
    cardMeta.textContent = `Photo ${photoNumber(numbers, photo)} · ${dayLabel(photo.taken)}, ${timeLabel(photo.taken)}`;
    card.hidden = false;
    placeCard(at);
  }

  // ----- Thumbnails -----
  function renderThumbs() {
    thumbsHost.textContent = '';
    refs.thumbs = {};
    visible().forEach(photo => {
      const item = htmlNode('li'), button = htmlNode('button', 'pm-thumb', undefined, { type: 'button', 'data-id': photo.id, 'aria-label': describe(photo) });
      const image = htmlNode('img', '', undefined, { src: PHOTO_DIR + photo.thumb, alt: '', loading: 'lazy', width: 160, height: 120 });
      button.append(image, htmlNode('span', 'pm-num-badge', String(photoNumber(numbers, photo)), { style: `background:${colorOf(photo)}` }),
        htmlNode('span', 'pm-when', `${dayLabel(photo.taken)} · ${timeLabel(photo.taken)}`));
      button.addEventListener('click', () => select(photo.id, { opener: button, reveal: true }));
      button.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') setHot(photo.id); });
      button.addEventListener('pointerleave', () => setHot(null));
      button.addEventListener('focus', () => setHot(photo.id));
      button.addEventListener('blur', () => setHot(null));
      item.append(button);
      thumbsHost.append(item);
      refs.thumbs[photo.id] = button;
    });
    if (!thumbsHost.firstChild) thumbsHost.append(htmlNode('li', 'pm-empty', 'No photos match these choices.'));
  }

  // ----- Viewer -----
  const viewer = {};
  function buildViewer() {
    viewerHost.textContent = '';
    viewer.close = htmlNode('button', 'pm-close', 'Close', { type: 'button' });
    viewer.close.addEventListener('click', () => deselect({ restoreFocus: true }));
    viewer.empty = htmlNode('p', 'pm-empty-viewer', 'Pick a numbered marker on the map, or a thumbnail below, to see its photo here. The color is the day it was taken.');
    viewer.body = htmlNode('div', 'pm-viewer-body');
    viewer.link = htmlNode('a', 'pm-photo-link', undefined, { target: '_blank', rel: 'noopener', title: 'Open the full-size photo in a new tab' });
    viewer.image = htmlNode('img', 'pm-photo', undefined, { decoding: 'async' });
    viewer.north = svgNode('svg', { class: 'pm-north', viewBox: '-22 -22 44 44', role: 'img', 'aria-label': 'Which way north points in this photo' });
    viewer.northGroup = svgNode('g');
    viewer.northGroup.append(svgNode('path', { d: 'M0,-15 L6,8 L0,3 L-6,8Z', fill: '#2C2C2A' }), svgNode('text', { y: -17, 'text-anchor': 'middle', class: 'pm-north-text' }, 'N'));
    viewer.north.append(svgNode('circle', { r: 21, fill: 'rgba(255,255,255,0.86)' }), viewer.northGroup);
    viewer.link.append(viewer.image);
    const figure = htmlNode('div', 'pm-figure');
    figure.append(viewer.link, viewer.north);
    viewer.caption = htmlNode('p', 'pm-caption');
    viewer.when = htmlNode('p', 'pm-meta');
    viewer.where = htmlNode('p', 'pm-meta');
    viewer.original = htmlNode('p', 'pm-meta pm-original');
    viewer.previous = htmlNode('button', 'pm-step', '← Previous', { type: 'button' });
    viewer.next = htmlNode('button', 'pm-step', 'Next →', { type: 'button' });
    viewer.position = htmlNode('span', 'pm-position');
    viewer.show = htmlNode('button', 'pm-step', 'Show on the map', { type: 'button' });
    viewer.full = htmlNode('a', 'pm-full', 'Open full size', { target: '_blank', rel: 'noopener' });
    viewer.previous.addEventListener('click', () => step(-1));
    viewer.next.addEventListener('click', () => step(1));
    viewer.show.addEventListener('click', () => showOnMap());
    const nav = htmlNode('div', 'pm-nav');
    nav.append(viewer.previous, viewer.position, viewer.next, viewer.show, viewer.full);
    viewer.body.append(figure, viewer.caption, viewer.when, viewer.where, viewer.original, nav);
    viewerHost.append(viewer.close, viewer.empty, viewer.body);
  }
  function updateViewer() {
    const photo = state.selected && byId[state.selected];
    viewer.empty.hidden = Boolean(photo);
    viewer.body.hidden = !photo;
    viewerHost.classList.toggle('pm-has-photo', Boolean(photo));
    if (!photo) return;
    // Drop the last photo first, so it never sits under the new caption while the new one loads; the small copy shows meanwhile.
    viewer.image.removeAttribute('src');
    viewer.image.style.backgroundImage = `url(${PHOTO_DIR + photo.thumb})`;
    viewer.image.alt = photo.alt;
    viewer.image.src = PHOTO_DIR + photo.file;
    viewer.link.href = viewer.full.href = PHOTO_DIR + photo.file;
    viewer.north.style.display = isOverhead(photo) ? '' : 'none';
    viewer.northGroup.setAttribute('transform', `rotate(${northArrowAngle(photo)})`);
    viewer.caption.textContent = photo.caption;
    viewer.when.textContent = `Photo ${photoNumber(numbers, photo)} of ${all.length} · ${whenLabel(photo.taken)}`;
    const cell = grid.cellOf(photo.x, photo.y);
    viewer.where.textContent = `${cameraText(photo)} · camera ${cell ? `in grid cell ${cell}` : 'outside the lot'}`;
    viewer.original.textContent = `Original file: ${photo.original}`;
    const list = visible(), index = list.findIndex(p => p.id === photo.id);
    viewer.position.textContent = index < 0 ? '' : `${index + 1} of ${list.length}`;
    viewer.previous.disabled = viewer.next.disabled = list.length < 2;
  }

  // ----- Choosing -----
  const overlay = () => narrow.matches;
  const focusable = () => Array.from(viewerHost.querySelectorAll('button, a[href]')).filter(node => !node.disabled && !node.hidden && node.offsetParent !== null);
  function setOverlay(open) {
    const wasOpen = viewerHost.classList.contains('pm-open');
    viewerHost.classList.toggle('pm-open', open);
    document.body.classList.toggle('pm-lock', open);
    // Open over the page the viewer is a dialog: it says so to a screen reader, and Tab stays inside it.
    viewerHost.setAttribute('role', open ? 'dialog' : 'region');
    if (open) viewerHost.setAttribute('aria-modal', 'true'); else viewerHost.removeAttribute('aria-modal');
    if (open && !wasOpen) viewer.close.focus();
  }
  function trapTab(event) {
    if (event.key !== 'Tab' || !viewerHost.classList.contains('pm-open')) return;
    const nodes = focusable(), first = nodes[0], last = nodes[nodes.length - 1];
    if (!first) return;
    if (!viewerHost.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
    else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  // The address names the photo shown, so a link to the page can open on it; a page opened from a file cannot rewrite its address, which is fine.
  function setAddress(hash) {
    try { window.history.replaceState(null, '', hash || window.location.pathname + window.location.search); } catch (error) { /* keep going without it */ }
  }
  // Scrolls the thumbnail list, and only that, so the chosen thumbnail is showing in it.
  function showThumb(button) {
    if (!button || thumbsHost.scrollHeight <= thumbsHost.clientHeight) return;
    const list = thumbsHost.getBoundingClientRect(), item = button.getBoundingClientRect();
    if (item.top < list.top) thumbsHost.scrollTop -= list.top - item.top + 4;
    else if (item.bottom > list.bottom) thumbsHost.scrollTop += item.bottom - list.bottom + 4;
  }
  function select(id, how) {
    const photo = byId[id];
    if (!photo) return;
    const options = how || {};
    let changed = false;
    if (!visible().some(p => p.id === id)) { state.day = 'all'; state.view = 'all'; renderThumbs(); changed = true; }
    const zoom = zoomFor(views, state.zoom, photo.x, photo.y);
    const redraw = zoom !== state.zoom || !refs.dots[id];
    changed = changed || zoom !== state.zoom;
    state.selected = id;
    state.zoom = zoom;
    if (options.opener) state.opener = options.opener;
    if (changed) renderControls();
    if (redraw) renderMap(); else { updateMarks(); drawShapes(); }
    card.hidden = true;
    updateViewer();
    if (announceHost) announceHost.textContent = describe(photo);
    if (overlay()) setOverlay(true); else showThumb(refs.thumbs[id]);
    if (options.reveal && !overlay()) scrollInto(refs.dots[id]);
    setAddress(`#${id}`);
  }
  // Brings a map marker into the page's view when it is off screen, so a photo picked from the list shows where it was taken.
  function scrollInto(node) {
    if (!node || !node.scrollIntoView) return;
    const box = node.getBoundingClientRect();
    if (box.top < 0 || box.bottom > window.innerHeight) node.scrollIntoView({ block: 'center', behavior: smooth });
  }
  function deselect(how) {
    state.selected = null;
    setOverlay(false);
    updateMarks();
    drawShapes();
    updateViewer();
    if (announceHost) announceHost.textContent = '';
    setAddress();
    if (how && how.restoreFocus && state.opener && document.contains(state.opener)) {
      refs.quiet = true;
      state.opener.focus();
      refs.quiet = false;
    }
  }
  function step(by) {
    const id = stepPhoto(visible(), state.selected, by);
    if (id) select(id, { reveal: true });
  }
  function showOnMap() {
    const dot = refs.dots[state.selected];
    if (overlay()) setOverlay(false);
    if (dot) { scrollInto(dot); refs.quiet = true; dot.focus({ preventScroll: true }); refs.quiet = false; }
  }
  function setFilter(key, value) {
    state[key] = value;
    if (state.selected && !visible().some(p => p.id === state.selected)) deselect();
    renderControls();
    renderThumbs();
    renderMarkers();
    updateViewer();
  }
  function setZoom(name) {
    state.zoom = name;
    renderControls();
    renderMap();
  }

  // ----- Start -----
  buildViewer();
  renderControls();
  renderThumbs();
  renderMap();
  updateViewer();
  window.addEventListener('keydown', event => {
    trapTab(event);
    if (event.altKey || event.ctrlKey || event.metaKey || /^(INPUT|SELECT|TEXTAREA)$/.test((event.target || {}).tagName || '')) return;
    if (event.key === 'Escape' && state.selected) { deselect({ restoreFocus: true }); return; }
    if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && state.selected && !(event.target.closest && event.target.closest('a'))) {
      event.preventDefault();
      step(event.key === 'ArrowLeft' ? -1 : 1);
    }
  });
  window.addEventListener('scroll', () => { card.hidden = true; }, { passive: true });
  const fromHash = () => {
    let id = '';
    try { id = decodeURIComponent((window.location.hash || '').slice(1)); } catch (error) { id = ''; }
    if (byId[id]) select(id, { reveal: true }); else if (state.selected && !id) deselect();
  };
  window.addEventListener('hashchange', fromHash);
  if (window.ResizeObserver) {
    new window.ResizeObserver(() => {
      const width = Math.max(260, Math.round(mapHost.clientWidth || 480));
      if (Math.abs(width - refs.width) > 2) renderMap();
    }).observe(mapHost);
  }
  narrow.addEventListener && narrow.addEventListener('change', () => { if (!narrow.matches) setOverlay(false); });
  fromHash();
  return { state, select, deselect };
}
})(typeof window !== 'undefined' ? window : globalThis);
