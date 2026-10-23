const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'docs', 'site_photos.js'), 'utf8');
// A context with no document: the script must load and expose its helpers without drawing anything.
const context = { window: {} };
vm.runInNewContext(source, context);
const photos = context.window.SitePhotos;
// Objects made inside the script's context have their own prototypes, so compare plain copies.
const plain = value => JSON.parse(JSON.stringify(value));

test('The photo script loads without a page and offers its helpers', () => {
  assert.ok(photos, 'window.SitePhotos should exist');
  assert.deepEqual(Object.keys(photos).sort(), ['PHOTO_DIR', 'PHOTO_MAP', 'PREVIEW_COUNT', 'attach', 'cardPosition', 'hint', 'hitBox', 'photoList']);
  assert.equal(photos.PHOTO_DIR, 'images/');
  assert.equal(photos.PHOTO_MAP, 'photo_map.html');
  assert.equal(photos.hint(null), null, 'a missing host is ignored');
});

const records = [
  { id: 'dji_0073', file: 'dji_0073.webp', thumb: 'dji_0073_t.webp', caption: 'East side', alt: 'The east side' },
  { id: 'dji_0065', file: 'dji_0065.webp', thumb: 'dji_0065_t.webp', caption: 'North side' }
];

test('A feature names its photos by id, and gets them in its own order with the large and small copy under images/', () => {
  assert.deepEqual(plain(photos.photoList({ photos: ['dji_0065', 'dji_0073'] }, records)), [
    { id: 'dji_0065', src: 'images/dji_0065.webp', thumb: 'images/dji_0065_t.webp', caption: 'North side', alt: 'North side' },
    { id: 'dji_0073', src: 'images/dji_0073.webp', thumb: 'images/dji_0073_t.webp', caption: 'East side', alt: 'The east side' }
  ], 'the caption stands in for missing alt text');
  assert.deepEqual(plain(photos.photoList({ photos: ['missing', 'dji_0073'] }, records)).map(photo => photo.id), ['dji_0073'], 'an id the list lacks is skipped');
  assert.deepEqual(plain(photos.photoList({ photos: ['dji_0073'] })), [], 'with no photo list there are no photos');
  assert.deepEqual(plain(photos.photoList({ photos: ['dji_0073'] }, [null, { caption: 'no id' }])), []);
  assert.deepEqual(plain(photos.photoList({}, records)), []);
  assert.deepEqual(plain(photos.photoList(null, records)), []);
  assert.deepEqual(plain(photos.photoList({ photos: [] }, records)), []);
});

test('A hit box covers the feature, centered, and grows to the smallest size a finger or pointer can hit', () => {
  const toSvg = (x, y) => [(x + 10) * 2, (y - 100) * 2];
  assert.deepEqual(plain(photos.hitBox({ x0: 0, y0: 110, x1: 30, y1: 140 }, toSvg, 14)), { x: 20, y: 20, width: 60, height: 60 });
  // A point-sized feature is still 14 units across, centered on it
  assert.deepEqual(plain(photos.hitBox({ x0: 5, y0: 120, x1: 5, y1: 120 }, toSvg, 14)), { x: 23, y: 33, width: 14, height: 14 });
  // Only the short side grows
  assert.deepEqual(plain(photos.hitBox({ x0: 0, y0: 100, x1: 20, y1: 102 }, toSvg, 14)), { x: 20, y: -5, width: 40, height: 14 });
});

test('A card opens below and right of the pointer, flips at the edges, and stays on screen', () => {
  const view = { left: 0, top: 0, right: 1000, bottom: 700 };
  const size = { width: 300, height: 200 };
  assert.deepEqual(plain(photos.cardPosition({ x: 100, y: 100 }, size, view)), { left: 114, top: 114 });
  assert.deepEqual(plain(photos.cardPosition({ x: 900, y: 100 }, size, view)), { left: 586, top: 114 }, 'flips to the left of the pointer');
  assert.deepEqual(plain(photos.cardPosition({ x: 100, y: 600 }, size, view)), { left: 114, top: 386 }, 'flips above the pointer');
  assert.deepEqual(plain(photos.cardPosition({ x: 990, y: 690 }, size, view)), { left: 676, top: 476 }, 'flips both ways in the corner');
  // A card wider or taller than the view hugs the top left margin instead of going off screen
  assert.deepEqual(plain(photos.cardPosition({ x: 500, y: 300 }, { width: 1200, height: 900 }, view)), { left: 8, top: 8 });
  // A pointer near the top left never pushes the card past the margin either
  assert.deepEqual(plain(photos.cardPosition({ x: -50, y: -50 }, size, view, 14, 8)), { left: 8, top: 8 });
});
