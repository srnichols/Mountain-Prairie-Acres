const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'docs', 'income_plan.js'), 'utf8'), context);
const plan = context.window.IncomePlan;

test('every line has a yield for every stage', () => {
  for (const line of plan.LINES) {
    for (const stage of plan.STAGES) {
      assert.equal(typeof line.yield[stage.id], 'number', line.id + ' ' + stage.id);
      assert.ok(line.yield[stage.id] >= 0);
    }
    assert.ok(line.sold > 0 && line.sold <= 1);
    assert.ok(line.price > 0);
  }
});

test('the orchard and tunnels add nothing before they exist', () => {
  const now = plan.project('now');
  for (const id of ['tunnel-fruit', 'tunnel-greens', 'pit-crops', 'starts', 'trees', 'scion', 'apples', 'pears', 'stone', 'cider', 'hazel', 'mulberry']) {
    assert.equal(now.lines.find(line => line.id === id).gross, 0, id);
  }
  assert.ok(now.lines.find(line => line.id === 'hens').gross > 0);
  assert.ok(now.total > 0);
});

test('cider gallons are not also counted as fresh apples', () => {
  const coming = plan.project('coming');
  const cider = coming.lines.find(line => line.id === 'cider');
  const apples = coming.lines.find(line => line.id === 'apples');
  assert.equal(cider.amount, 80);
  assert.equal(cider.gross, 80 * 10 * 0.6);
  assert.equal(apples.units, 40);
  assert.ok(apples.gross > 0);
});

test('turning a line off removes only that line', () => {
  const base = plan.project('coming');
  const hens = base.lines.find(line => line.id === 'hens').gross;
  const off = plan.project('coming', { on: { hens: false } });
  assert.equal(off.lines.find(line => line.id === 'hens').gross, 0);
  assert.equal(Math.round(off.total * 100), Math.round((base.total - hens) * 100));
});

test('shares of the lines that are on add to one', () => {
  const result = plan.project('mature');
  const share = result.lines.reduce((sum, line) => sum + line.share, 0);
  assert.ok(Math.abs(share - 1) < 1e-9);
  assert.equal(result.lines.find(line => line.id === 'honey').on, false);
  assert.equal(result.lines.find(line => line.id === 'honey').gross, 0);
});

test('the mature year is larger than the first years', () => {
  const totals = plan.totalsByStage();
  const byId = Object.fromEntries(totals.map(item => [item.id, item.total]));
  assert.ok(byId.now < byId.covered);
  assert.ok(byId.covered < byId.coming);
  assert.ok(byId.coming < byId.mature);
});
