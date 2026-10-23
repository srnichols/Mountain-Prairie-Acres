const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'docs', 'site_nav.js'), 'utf8');
// A context with no document: the script must load, expose its helpers, and draw nothing.
const context = { window: {} };
vm.runInNewContext(source, context);
const nav = context.window.SiteNav;

test('The menu script loads without a page and offers its list and helpers', () => {
  assert.ok(nav, 'window.SiteNav should exist');
  assert.deepEqual(Object.keys(nav).sort(), ['data', 'fileOf', 'groupOf', 'stepIndex']);
  assert.equal(nav.data.home.href, 'index.html');
  assert.equal(nav.data.groups.length, 5);
});

test('A URL path is matched to its page file, and a folder is the home page', () => {
  assert.equal(nav.fileOf('/Mountain-Prairie-Acres/site_climate.html'), 'site_climate.html');
  assert.equal(nav.fileOf('/Mountain-Prairie-Acres/'), 'index.html');
  assert.equal(nav.fileOf('/E:/GitHub/Mountain-Prairie-Acres/docs/index.html'), 'index.html');
  assert.equal(nav.fileOf(''), 'index.html');
});

test('Each listed page belongs to its own group, and the home page and strangers to none', () => {
  for (const group of nav.data.groups) {
    for (const item of group.items.filter(entry => !entry.href.includes('#'))) assert.equal(nav.groupOf(item.href), group.id, item.href);
  }
  assert.equal(nav.groupOf('site_baselines.html'), 'climate');
  assert.equal(nav.groupOf('orchard_water_harvesting_plan.html'), 'land');
  assert.equal(nav.groupOf('index.html'), null);
  assert.equal(nav.groupOf('nowhere.html'), null);
});

test('Arrow keys step through a dropdown and wrap around', () => {
  assert.equal(nav.stepIndex(-1, 'ArrowDown', 4), 0);
  assert.equal(nav.stepIndex(0, 'ArrowDown', 4), 1);
  assert.equal(nav.stepIndex(3, 'ArrowDown', 4), 0);
  assert.equal(nav.stepIndex(-1, 'ArrowUp', 4), 3);
  assert.equal(nav.stepIndex(0, 'ArrowUp', 4), 3);
  assert.equal(nav.stepIndex(2, 'ArrowUp', 4), 1);
  assert.equal(nav.stepIndex(2, 'Home', 4), 0);
  assert.equal(nav.stepIndex(1, 'End', 4), 3);
  assert.equal(nav.stepIndex(1, 'Tab', 4), 1, 'other keys leave the focus where it is');
  assert.equal(nav.stepIndex(0, 'ArrowDown', 0), -1, 'an empty list has nothing to focus');
});
