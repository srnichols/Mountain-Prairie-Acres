// Photos on the maps. An item in data/site.json with a "photos" list (ids from data/photos.json) gets a small camera badge on the maps that load
// this script: hovering it (or tabbing to it) previews its photos, and a click, tap, or Enter keeps them open. The files live in docs/images/.
// A page loads data/photos.js, calls SitePhotos.attach(svg, SiteGrid, options) once its map is drawn, and SitePhotos.hint(host) once the map is in the page.
(function (root) {
'use strict';
// Where the photo files are, relative to the pages; data/photos.json names a photo by its file name only.
const PHOTO_DIR = 'images/';
// The page that shows where each photo was taken; a card kept open links to it.
const PHOTO_MAP = 'photo_map.html';
// How many photos the hover preview shows; a click or tap shows them all.
const PREVIEW_COUNT = 2;
const SVG_NS = 'http://www.w3.org/2000/svg';

// The photos of one feature as { id, src, thumb, caption, alt }, in the order the feature lists them. `records` is the photo list from
// data/photos.js; an id it does not have is skipped, and a feature without any photos gives an empty list. src is the large photo and thumb the small one.
function photoList(feature, records) {
  const byId = {};
  (records || []).forEach(record => { if (record && record.id) byId[record.id] = record; });
  return ((feature && feature.photos) || []).map(id => byId[id]).filter(Boolean)
    .map(record => ({ id: record.id, src: PHOTO_DIR + record.file, thumb: PHOTO_DIR + record.thumb, caption: record.caption || '', alt: record.alt || record.caption || '' }));
}

// The box that answers the pointer for a feature: its extent in feet (bbox) turned into drawing units by toSvg, and grown to `min` units
// across when it is smaller, so a hydrant is as easy to hit as a building.
function hitBox(bbox, toSvg, min) {
  const [ax, ay] = toSvg(bbox.x0, bbox.y0), [bx, by] = toSvg(bbox.x1, bbox.y1);
  const width = Math.max(Math.abs(bx - ax), min), height = Math.max(Math.abs(by - ay), min);
  const cx = (ax + bx) / 2, cy = (ay + by) / 2;
  return { x: +(cx - width / 2).toFixed(2), y: +(cy - height / 2).toFixed(2), width: +width.toFixed(2), height: +height.toFixed(2) };
}

// Where to put a card of `size` next to a pointer at `at`: below and to the right by default, flipped to the other side of the pointer where it
// would run off `view` ({ left, top, right, bottom }), and never closer than `margin` to an edge, even when it is larger than the view.
function cardPosition(at, size, view, gap = 14, margin = 8) {
  let left = at.x + gap, top = at.y + gap;
  if (left + size.width > view.right - margin) left = at.x - gap - size.width;
  if (top + size.height > view.bottom - margin) top = at.y - gap - size.height;
  const clamp = (value, low, high) => Math.min(Math.max(value, low), Math.max(high, low));
  return {
    left: clamp(left, view.left + margin, view.right - size.width - margin),
    top: clamp(top, view.top + margin, view.bottom - size.height - margin)
  };
}
root.SitePhotos = { PHOTO_DIR, PHOTO_MAP, PREVIEW_COUNT, photoList, hitBox, cardPosition, attach, hint };

const STYLE = `
.sp-hit { fill: transparent; stroke: none; cursor: pointer; pointer-events: all; outline: none; }
.sp-hit:hover, .sp-hit:focus { fill: rgba(24, 95, 165, 0.14); stroke: #185FA5; stroke-width: 1.2; }
.sp-hit:focus-visible { stroke-width: 2; stroke-dasharray: 4 2; }
.sp-badge { pointer-events: none; }
.sp-hint { display: flex; align-items: center; gap: 6px; margin: 0 0 4px; font-size: 12px; font-weight: 400; color: #5F5E5A; }
.sp-hint svg.sp-icon { display: inline-block; flex: none; width: 16px; height: 16px; }
.sp-card { position: absolute; z-index: 1100; box-sizing: border-box; width: max-content; max-width: min(calc(100vw - 16px), 700px); padding: 8px;
  background: #fff; border: 1px solid #d3d1c7; border-radius: 8px; box-shadow: 0 10px 28px rgba(44, 44, 42, 0.24); pointer-events: none;
  color: #2C2C2A; font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
.sp-card[hidden] { display: none; }
.sp-card.sp-open { pointer-events: auto; max-width: min(calc(100vw - 16px), 1000px); }
.sp-card:focus { outline: none; }
.sp-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0 0 6px; }
.sp-name { font-size: 13px; }
.sp-close { display: none; margin: 0; padding: 2px 8px; background: #f5f4f0; border: 1px solid #d3d1c7; border-radius: 6px; color: inherit; font: inherit; line-height: 1.3; cursor: pointer; }
.sp-open .sp-close { display: inline-block; }
.sp-close:hover { background: #eae8e1; }
.sp-close:focus-visible, .sp-photo a:focus-visible { outline: 2px solid #185FA5; outline-offset: 1px; }
.sp-photos { display: flex; flex-wrap: wrap; gap: 8px; }
.sp-photo { flex: 1 1 260px; max-width: 336px; margin: 0; }
.sp-open .sp-photo { max-width: 480px; }
.sp-photo a { display: block; }
.sp-photo img { display: block; width: 100%; height: auto; min-height: 90px; background: #eceae3; border-radius: 4px; }
.sp-photo figcaption { margin: 3px 0 0; font-size: 12px; font-weight: 400; color: #5F5E5A; }
.sp-where { margin: 3px 0 0; font-size: 11px; }
.sp-where a { color: #185FA5; }
.sp-where a:focus-visible { outline: 2px solid #185FA5; outline-offset: 1px; }
.sp-note { margin: 6px 0 0; font-size: 11px; color: #888780; }
@media print { .sp-hit, .sp-badge, .sp-hint, .sp-card { display: none !important; } }
`;

function svgNode(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.keys(attrs).forEach(key => node.setAttribute(key, attrs[key]));
  return node;
}
function htmlNode(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function ensureStyle() {
  if (document.getElementById('sp-style')) return;
  const style = htmlNode('style', '', STYLE);
  style.id = 'sp-style';
  document.head.appendChild(style);
}

// A white camera on a blue disc, drawn around (0, 0) with a radius of `r` drawing units. The lens is cut out of the body so the disc shows through.
function cameraGlyph(r) {
  const group = svgNode('g', { transform: `scale(${+(r * 0.075).toFixed(3)})` });
  group.appendChild(svgNode('path', { d: 'M-8,-4.5 h4.5 l1.3,-2.6 h4.4 l1.3,2.6 h4.5 v11 h-16 z M0,-2.3 a3.3,3.3 0 1 0 0.01,0 z', fill: '#fff', 'fill-rule': 'evenodd' }));
  return group;
}
function cameraBadge(cx, cy, r) {
  const badge = svgNode('g', { class: 'sp-badge', transform: `translate(${cx} ${cy})`, 'aria-hidden': 'true' });
  badge.appendChild(svgNode('circle', { r, fill: '#185FA5', stroke: '#fff', 'stroke-width': +(r * 0.18).toFixed(2) }));
  badge.appendChild(cameraGlyph(r));
  return badge;
}

// One card for the whole page, filled for whichever item is showing. `hit` stays set after the card closes so focus can go back to it.
// `quiet` is true while focus is handed back to an item, so that does not open its preview again.
const state = { card: null, entry: null, pinned: false, at: { x: 0, y: 0 }, hit: null, quiet: false };

function returnFocus(hit) {
  if (!hit) return;
  state.quiet = true;
  hit.focus();
  state.quiet = false;
}

function ensureCard() {
  if (state.card) return state.card;
  const card = htmlNode('div', 'sp-card');
  card.id = 'sp-card';
  card.hidden = true;
  card.tabIndex = -1;
  card.setAttribute('role', 'dialog');
  document.body.appendChild(card);
  window.addEventListener('resize', () => { if (state.entry) place(); });
  // Anything clicked outside the open card and its item closes it, and so does Escape (which hands focus back to the item).
  document.addEventListener('pointerdown', event => {
    if (state.pinned && !card.contains(event.target) && !(event.target.closest && event.target.closest('.sp-hit'))) closeCard();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !state.entry) return;
    const hit = state.hit, hadFocus = card.contains(document.activeElement);
    closeCard();
    if (hadFocus) returnFocus(hit);
  });
  state.card = card;
  return card;
}

function fill(entry, all) {
  const card = state.card;
  card.textContent = '';
  card.setAttribute('aria-label', `Photos of ${entry.name}`);
  const head = htmlNode('div', 'sp-head');
  const closeButton = htmlNode('button', 'sp-close', 'Close');
  closeButton.type = 'button';
  closeButton.addEventListener('click', () => {
    const hit = state.hit;
    closeCard();
    returnFocus(hit);
  });
  head.append(htmlNode('strong', 'sp-name', entry.name), closeButton);
  const photos = htmlNode('div', 'sp-photos');
  const shown = all ? entry.photos : entry.photos.slice(0, PREVIEW_COUNT);
  shown.forEach(photo => {
    const figure = htmlNode('figure', 'sp-photo');
    const img = htmlNode('img');
    img.alt = photo.alt;
    img.decoding = 'async';
    img.addEventListener('load', () => { if (state.entry === entry) place(); });
    img.addEventListener('error', () => { img.style.display = 'none'; });
    // The preview loads the small copy; a card kept open loads the large one.
    img.src = all ? photo.src : photo.thumb;
    // A card kept open links each photo to its file, to open full size in a new tab.
    if (all) {
      const link = htmlNode('a');
      link.href = photo.src;
      link.target = '_blank';
      link.rel = 'noopener';
      link.append(img);
      figure.append(link);
    } else {
      figure.append(img);
    }
    figure.append(htmlNode('figcaption', '', photo.caption));
    if (all) {
      const where = htmlNode('p', 'sp-where');
      const map = htmlNode('a', '', 'Where was this taken? Show it on the photo map');
      map.href = `${PHOTO_MAP}#${photo.id}`;
      where.append(map);
      figure.append(where);
    }
    photos.append(figure);
  });
  card.append(head, photos);
  if (!all) {
    const more = entry.photos.length - shown.length;
    card.append(htmlNode('p', 'sp-note', more > 0 ? `${more} more photo${more > 1 ? 's' : ''}: click to see all.` : 'Click to keep this open and enlarge the photos.'));
  }
}

// The card sits in page coordinates, so a card kept open scrolls away with the map instead of floating over the page.
function place() {
  const card = state.card;
  const box = card.getBoundingClientRect();
  const view = { left: 0, top: 0, right: document.documentElement.clientWidth, bottom: window.innerHeight };
  const spot = cardPosition(state.at, { width: box.width, height: box.height }, view);
  card.style.left = `${Math.round(spot.left + window.pageXOffset)}px`;
  card.style.top = `${Math.round(spot.top + window.pageYOffset)}px`;
}

function open(entry, hit, pinned, at) {
  const card = ensureCard();
  if (state.hit && state.hit !== hit) state.hit.removeAttribute('aria-describedby');
  state.entry = entry;
  state.hit = hit;
  state.pinned = pinned;
  state.at = at;
  fill(entry, pinned);
  card.classList.toggle('sp-open', pinned);
  card.hidden = false;
  hit.setAttribute('aria-describedby', 'sp-card');
  place();
}

function closeCard() {
  const card = state.card;
  if (!card) return;
  if (state.hit) state.hit.removeAttribute('aria-describedby');
  card.hidden = true;
  card.classList.remove('sp-open');
  state.entry = null;
  state.pinned = false;
}

function centerOf(node) {
  const box = node.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

// Focus that came from the keyboard, not from a click or tap on the item.
function keyboardFocus(node) {
  try { return node.matches(':focus-visible'); } catch (error) { return true; }
}

function wire(hit, entry) {
  hit.addEventListener('pointerenter', event => {
    if (event.pointerType === 'touch' || state.pinned) return;
    open(entry, hit, false, { x: event.clientX, y: event.clientY });
  });
  hit.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || state.pinned || state.entry !== entry) return;
    state.at = { x: event.clientX, y: event.clientY };
    place();
  });
  hit.addEventListener('pointerleave', () => { if (!state.pinned && state.entry === entry) closeCard(); });
  hit.addEventListener('focus', () => { if (!state.quiet && !state.pinned && state.entry !== entry && keyboardFocus(hit)) open(entry, hit, false, centerOf(hit)); });
  hit.addEventListener('blur', () => { if (!state.pinned && state.entry === entry) closeCard(); });
  hit.addEventListener('click', event => {
    if (state.pinned && state.entry === entry) { closeCard(); return; }
    open(entry, hit, true, { x: event.clientX, y: event.clientY });
  });
  hit.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (state.pinned && state.entry === entry) { closeCard(); return; }
    open(entry, hit, true, centerOf(hit));
    state.card.focus();
  });
}

// Draws a camera badge and an invisible, focusable hit box over every feature that has photos, and wires them to the card. Returns how many.
// options: toSvg(x, y) turns lot feet into the map's drawing units (required), minHit is the smallest hit box and badge the badge radius in
// those units, within ({ x0, y0, x1, y1 } in feet) skips features outside the part of the lot the map shows, and photos is the photo list
// (window.SITE_PHOTOS.records, from data/photos.js, by default).
function attach(svg, grid, options) {
  const opt = Object.assign({ minHit: 14, badge: 5, within: null, photos: (root.SITE_PHOTOS || {}).records || [] }, options);
  if (typeof opt.toSvg !== 'function') throw new Error('SitePhotos.attach needs a toSvg(x, y) function');
  ensureStyle();
  const layer = svgNode('g', { class: 'sp-layer' });
  let count = 0;
  grid.features(f => photoList(f, opt.photos).length > 0).forEach(f => {
    const extent = grid.bbox(f), w = opt.within;
    if (w && (extent.x1 < w.x0 || extent.x0 > w.x1 || extent.y1 < w.y0 || extent.y0 > w.y1)) return;
    const entry = { name: f.name, photos: photoList(f, opt.photos) };
    const box = hitBox(extent, opt.toSvg, opt.minHit);
    const hit = svgNode('rect', Object.assign({ class: 'sp-hit', rx: 2, tabindex: 0, role: 'button',
      'aria-label': `${f.name}: ${entry.photos.length} photo${entry.photos.length > 1 ? 's' : ''}` }, box));
    layer.appendChild(hit);
    layer.appendChild(cameraBadge(box.x + box.width, box.y, opt.badge));
    wire(hit, entry);
    count += 1;
  });
  if (count) {
    svg.appendChild(layer);
    // The map now has buttons in it, so it is a group of them and not one flat image.
    svg.setAttribute('role', 'group');
  }
  return count;
}

// A line above the map saying what the badges mean, drawn only when the map has some. It never prints.
function hint(host) {
  if (!host || host.querySelector('.sp-hint') || !host.querySelector('.sp-hit')) return null;
  ensureStyle();
  const line = htmlNode('p', 'sp-hint');
  const icon = svgNode('svg', { class: 'sp-icon', viewBox: '-9 -9 18 18', 'aria-hidden': 'true' });
  icon.appendChild(cameraBadge(0, 0, 8.6));
  line.append(icon, document.createTextNode('Items with a camera badge have photos: hover over one, or tap it, to see them.'));
  host.insertBefore(line, host.firstChild);
  return line;
}
})(typeof window !== 'undefined' ? window : globalThis);
