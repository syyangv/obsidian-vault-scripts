// Run with: node --test Helper/scripts/maomaoReward.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../utils/MaoMaoYearlyReward.md'), 'utf8')
  .match(/```dataviewjs\s*\n([\s\S]*?)```/)[1];

async function render({ today = '2026-11-06', year = 2026, allowance = {}, usage = {} } = {}) {
  const rows = [];
  const errors = [];
  function element(tag) {
    const result = { createEl: element };
    if (tag === 'tr') {
      const cells = [];
      rows.push(cells);
      result.createEl = () => ({ set innerHTML(value) { cells.push(value); } });
    }
    return result;
  }
  const page = frontmatter => ({ file: { frontmatter } });
  const config = { prefix: '毛毛_', recurringMonthly: {
    毛毛_Dunkin: { amount: 7, startMonth: '2026-11' },
  } };
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [`${today}T12:00:00`])); }
  }
  await vm.runInNewContext(source, {
    Date: Clock, window: {}, setTimeout: callback => { callback(); return 1; }, clearTimeout() {},
    app: { workspace: { getActiveFile: () => ({ path: `${year}.md`, basename: `${year}` }) } },
    console: { error: (...args) => errors.push(args) },
    dv: {
      page: () => page(config),
      pages: folder => folder.includes('年度记录') ? [page(allowance)] : [page(usage)],
      paragraph: message => errors.push(message),
      container: { empty() {}, createEl: element },
    },
  });
  assert.deepEqual(errors, []);
  return rows.filter(row => row.length);
}

test('November Dunkin allowance matches the synced seven-dollar usage', async () => {
  const rows = await render({ usage: { 毛毛_Dunkin: 7 } });
  assert.deepEqual(rows.find(row => row[0] === 'Dunkin').slice(0, 4), ['Dunkin', '7', '7', '0']);
});

test('allowance accrues monthly, without double-counting note-based allowance', async () => {
  const rows = await render({ today: '2026-12-01', allowance: { 毛毛_Dunkin: 7 }, usage: { 毛毛_Dunkin: 7 } });
  assert.deepEqual(rows.find(row => row[0] === 'Dunkin').slice(0, 4), ['Dunkin', '14', '7', '7']);
});

test('before activation there is no Dunkin allowance; existing transit totals stay unchanged', async () => {
  const rows = await render({ today: '2026-10-31', allowance: { 毛毛_交通卡: 50 }, usage: { 毛毛_交通卡: 8 } });
  assert.equal(rows.some(row => row[0] === 'Dunkin'), false);
  assert.deepEqual(rows.find(row => row[0] === '交通卡').slice(0, 4), ['交通卡', '50', '8', '42']);
});

test('historical year stops at December; next year starts with its own allowance', async () => {
  const previous = await render({ today: '2027-01-01', year: 2026, usage: { 毛毛_Dunkin: 7 } });
  assert.equal(previous.find(row => row[0] === 'Dunkin')[1], '14');
  const current = await render({ today: '2027-01-01', year: 2027 });
  assert.deepEqual(current.find(row => row[0] === 'Dunkin').slice(0, 4), ['Dunkin', '7', '0', '7']);
});

test('future years do not get allowances before they begin', async () => {
  const rows = await render({ year: 2027, allowance: { 毛毛_交通卡: 50 } });
  assert.equal(rows.some(row => row[0] === 'Dunkin'), false);
});
