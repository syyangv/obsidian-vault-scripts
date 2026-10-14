// Run with: node --test Helper/scripts/qcTask.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const helper = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(helper, 'quickadd-scripts/qcTask.js'), 'utf8');
const dashboard = fs.readFileSync(path.join(helper, '../待办事项/待办事项.md'), 'utf8');
const pools = ['#Project/epaper', '#Project/Structured', '#Project/系统'];
const projects = ['生活事务', '购物errand', '手工', '做饭', 'Obsidian UX', 'LLM'];
const capturePath = '待办事项/Quick Capture.md';
const originalCapture = '---\ntags: []\n---\n`BUTTON[add_task]`\n![[quick_capture_controls]]\n- [ ] Existing [id:: pool_existing] #Project/系统\n';

async function run(options = {}) {
    const { inputs = ['Regression task'], capture = originalCapture, folder = true, collision = false, missingCapture = false, fallback = false } = options;
    const selectedTag = Object.hasOwn(options, 'selectedTag') ? options.selectedTag : pools[0];
    const scheduled = Object.hasOwn(options, 'scheduled') ? options.scheduled : 'none';
    const files = new Map();
    const writes = [];
    const pickers = [];
    const notices = [];
    function add(p, content = '') {
        const name = p.split('/').at(-1);
        const file = { path: p, name, basename: name.replace(/\.md$/, ''), extension: 'md', parent: { path: p.slice(0, p.lastIndexOf('/')) }, content };
        files.set(p, file);
        return file;
    }
    projects.forEach(name => add(`Projects/${name}.md`, 'Project content must remain unchanged'));
    add('Projects/Projects.md');
    add('Projects/待办日历体系.excalidraw.md');
    add('Archive/CS.md');
    if (!missingCapture) add(capturePath, capture);
    if (folder) files.set('TaskNotes/Tasks', { path: 'TaskNotes/Tasks' });
    if (collision) add('TaskNotes/Tasks/Regression task.md', 'Existing card');
    const app = {
        vault: {
            getFiles: () => [...files.values()].filter(f => f.extension),
            getAbstractFileByPath: p => fallback && p === capturePath ? null : files.get(p),
            read: async f => f.content,
            modify: async (f, content) => { writes.push({ type: 'modify', path: f.path, content }); f.content = content; },
            create: async (p, content) => { assert.ok(!files.has(p)); writes.push({ type: 'create', path: p, content }); add(p, content); },
            createFolder: async p => { writes.push({ type: 'folder', path: p }); files.set(p, { path: p }); },
        },
        metadataCache: {
            getTags: () => ({ '#Project/CS': 1, '#Project/日常任务': 1, '#📺': 1, '#🎤': 1, '#起起': 1 }),
            getFirstLinkpathDest: () => files.get(capturePath),
        },
    };
    const quickAddApi = {
        inputPrompt: async () => inputs.shift(),
        suggester: async (labels, values) => {
            assert.equal(labels.length, values.length);
            pickers.push({ labels, values });
            assert.ok(pickers.length <= 2, 'No project mode-choice prompt');
            return pickers.length === 1 ? selectedTag : scheduled;
        },
    };
    const context = { module: { exports: {} }, Notice: class { constructor(message) { notices.push(message); } } };
    vm.runInNewContext(source, context);
    await context.module.exports({ app, quickAddApi });
    return { writes, pickers, files, notices };
}

test('picker contains exactly three protected pools and the six live projects, not historical tags', async () => {
    const { pickers } = await run({ selectedTag: undefined, inputs: [null] });
    assert.equal(pickers.length, 0);
    const result = await run();
    assert.deepEqual([...result.pickers[0].values].sort(), [...pools, ...projects.map(p => `#Project/${p}`)].sort());
    assert.equal(result.pickers[0].values.length, 9);
});

for (const tag of pools) test(`inline ${tag} stays in Quick Capture and matches its dashboard query`, async () => {
    const { writes, files } = await run({ selectedTag: tag, scheduled: 'today' });
    assert.equal(writes.length, 1);
    assert.equal(writes[0].type, 'modify');
    assert.equal(writes[0].path, capturePath);
    assert.match(writes[0].content, new RegExp(`- \\[ \\] Regression task ⏳ \\d{4}-\\d{2}-\\d{2} ✍️ \\d{4}-\\d{2}-\\d{2} ${tag}`));
    assert.ok(writes[0].content.endsWith('- [ ] Existing [id:: pool_existing] #Project/系统\n'));
    assert.ok(dashboard.includes(`description includes ${tag}`));
    projects.forEach(p => assert.equal(files.get(`Projects/${p}.md`).content, 'Project content must remain unchanged'));
});

for (const project of projects) test(`${project} creates only a recognized, linked TaskNotes card`, async () => {
    const { writes, files, pickers } = await run({ selectedTag: `#Project/${project}`, scheduled: 'today' });
    assert.equal(pickers.length, 2);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].type, 'create');
    assert.equal(writes[0].path, 'TaskNotes/Tasks/Regression task.md');
    assert.ok(writes[0].content.includes(`projects:\n  - "[[${project}]]"`));
    assert.ok(writes[0].content.includes('tags:\n  - tasknotes'));
    assert.match(writes[0].content, /status: open\npriority: normal/);
    assert.match(writes[0].content, /scheduled: \d{4}-\d{2}-\d{2}\n/);
    assert.match(writes[0].content, /dateCreated: \d{4}-\d{2}-\d{2}T/);
    assert.equal(files.get(capturePath).content, originalCapture);
    projects.forEach(p => assert.equal(files.get(`Projects/${p}.md`).content, 'Project content must remain unchanged'));
});

test('cancellation at every prompt writes nothing', async () => {
    for (const options of [
        { inputs: [null] },
        { selectedTag: undefined },
        { selectedTag: null },
        { scheduled: undefined },
        { scheduled: null },
        { scheduled: 'pick', inputs: ['Regression task', null] },
        { scheduled: 'pick', inputs: ['Regression task', undefined] },
    ]) {
        const result = await run(options);
        assert.equal(result.writes.length, 0);
    }
});

test('disallowed or stale tags cannot route to inline capture', async () => {
    for (const selectedTag of ['', '#📺', '#🎤', '#起起', '#Project/CS', '#Project/日常任务']) {
        const result = await run({ selectedTag });
        assert.equal(result.writes.length, 0);
    }
});

test('date choices retain their format and no-date capture omits scheduling', async () => {
    for (const scheduled of ['none', 'today', 'tomorrow', 'nextmonday', 'nextmonth', 'pick']) {
        const result = await run({ selectedTag: '#Project/LLM', scheduled, inputs: ['Regression task', '2026-11-19'] });
        const content = result.writes[0].content;
        if (scheduled === 'none') assert.ok(!content.includes('scheduled:'));
        else if (scheduled === 'pick') assert.ok(content.includes('scheduled: 2026-11-19\n'));
        else assert.match(content, /scheduled: \d{4}-\d{2}-\d{2}\n/);
    }
});

test('missing task folder and duplicate card names retain creation behavior', async () => {
    const result = await run({ selectedTag: '#Project/LLM', folder: false, collision: true });
    assert.equal(result.writes[0].type, 'folder');
    assert.equal(result.writes[1].path, 'TaskNotes/Tasks/Regression task 1.md');
    assert.equal(result.files.get('TaskNotes/Tasks/Regression task.md').content, 'Existing card');
});

test('inline insertion fallbacks and link lookup preserve existing content', async () => {
    for (const capture of [originalCapture, '`BUTTON[add_task]`\nExisting\n', '---\ntags: []\n---\nExisting\n', 'Existing\n']) {
        const { writes } = await run({ capture, fallback: true });
        assert.equal(writes.length, 1);
        assert.ok(writes[0].content.includes('Existing'));
        assert.ok(writes[0].content.includes('- [ ] Regression task'));
    }
    const result = await run({ missingCapture: true });
    assert.equal(result.writes.length, 0);
    assert.ok(result.notices.includes('Quick Capture.md not found'));
});

test('live vault project inventory and dashboard pool tags match the routing contract', () => {
    const projectNames = fs.readdirSync(path.join(helper, '../Projects'))
        .filter(name => name.endsWith('.md') && name !== 'Projects.md' && !name.endsWith('.excalidraw.md'))
        .map(name => name.slice(0, -3));
    assert.deepEqual(projectNames.sort(), [...projects].sort());
    const dashboardTags = [...dashboard.matchAll(/^description includes (#Project\/\S+)$/gm)].map(match => match[1]);
    assert.deepEqual(dashboardTags.sort(), [...pools].sort());
});
