// Run with: node --test scripts/recipeTrackerSync.test.cjs
// For a before/after benchmark, set RECIPE_TRACKER_BENCHMARK_BASE to a pre-refactor git ref.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const recipeStats = require('../utils/recipeStats.js');

const helper = join(__dirname, '..');
const source = readFileSync(join(helper, 'utils/recipeTrackerSync.js'), 'utf8');
const DAY = 86400000;
const TODAY = '2026-11-24';
const NOW = Date.parse(TODAY + 'T12:00:00Z');
const moment = () => ({ format: (format) => (format.endsWith('HH:mm') ? TODAY + ' 12:00' : TODAY) });
const link = (target, displayText) => ({ link: target, displayText });
const tracker = (frontmatter = {}) => ({ embeds: [link('Helper/utils/recipeTracker#section')], frontmatter });

function mockVault() {
    const files = [];
    const caches = new Map();
    const writes = [];
    const notices = [];
    const counts = { scans: 0, cacheReads: 0, parses: 0, matches: 0 };
    const timers = new Map();
    const listeners = {};
    let timerId = 0;
    const setTimeout = (callback, delay) => {
        timers.set(++timerId, { callback, delay });
        return timerId;
    };
    const setCache = (file, cache) => caches.set(file.path, cache);
    function add(path, cache, mtime = NOW) {
        const file = { path, basename: path.split('/').at(-1).slice(0, -3), stat: { mtime } };
        files.push(file);
        setCache(file, cache);
        return file;
    }
    const day = (name, cache, mtime) => add(`日记/${name.slice(0, 4)}/${name}.md`, cache, mtime);
    const recipe = (name, frontmatter) => add(`Recipes/${name}.md`, tracker(frontmatter));
    const app = {
        vault: {
            getMarkdownFiles() {
                counts.scans++;
                return files.slice();
            },
            on: (event, callback) => { listeners[event] = callback; },
        },
        metadataCache: {
            getFileCache(file) {
                counts.cacheReads++;
                return caches.get(file.path);
            },
            on: (event, callback) => { listeners[event] = callback; },
        },
        fileManager: {
            async processFrontMatter(file, update) {
                writes.push(file.path);
                const cache = caches.get(file.path);
                const frontmatter = { ...cache?.frontmatter };
                update(frontmatter);
                setCache(file, { ...cache, frontmatter });
            },
        },
    };
    const stats = Object.assign(recipeStats.bind(null), {
        ...recipeStats,
        parseLink(raw) {
            counts.parses++;
            return recipeStats.parseLink(raw);
        },
        linksRecipe(links, name) {
            counts.matches++;
            return recipeStats.linksRecipe(links, name);
        },
    });
    function load(code = source) {
        const module = { exports: {} };
        vm.runInNewContext(code, {
            module, setTimeout, clearTimeout: (id) => timers.delete(id),
            Date: class extends Date { static now() { return NOW; } },
        }, { filename: 'recipeTrackerSync.js' });
        return module.exports;
    }
    return {
        add, day, recipe, app, listeners, timers, setTimeout, setCache, writes, notices, counts, stats, load,
        frontmatter: (file) => caches.get(file.path)?.frontmatter,
        resetCounts: () => { for (const key of Object.keys(counts)) counts[key] = 0; },
        install: (code) => load(code)(app, moment, stats, {
            notify: (message) => notices.push(message),
            log: { error: (...args) => assert.fail(args.join(' ')) },
        }),
    };
}

test('live link addition retains substring, display-name, embeds and frontmatter matching over full history', async () => {
    const h = mockVault();
    const soup = h.recipe('Soup');
    const untracked = h.add('Recipes/Recipes.md', { frontmatter: { cooking_count: 99 } });
    h.day('2024-08-01', { embeds: [link('Recipes/Tomato Soup#Directions')] }, NOW - 60 * DAY);
    const today = h.day(TODAY, {});
    const sync = h.install();
    h.setCache(today, {
        links: [link('Recipes/Recipes'), link('Recipes/Miso', 'soup')],
        frontmatterLinks: [link('Recipes/Miso', 'Soup'), link('Recipes/Miso#Steps', 'Soup')],
    });
    h.listeners.changed(today);
    h.listeners.changed(today);
    assert.equal(sync.pending(), 1, 'repeated events coalesce');
    const [[id, timer]] = h.timers;
    h.timers.delete(id);
    timer.callback();
    await new Promise(setImmediate);
    assert.equal(sync.pending(), 0);
    assert.equal(sync.status.handled, 1);
    assert.equal(h.frontmatter(soup).cooking_count, 2, 'two links in a day still count as one cook');
    assert.equal(h.frontmatter(soup).first_cooked, '2024-08-01');
    assert.equal(h.frontmatter(soup).last_cooked, TODAY);
    assert.equal(h.frontmatter(untracked).cooking_count, 99);
    assert.deepEqual(h.writes, [soup.path]);
});

test('live removal of the last link clears tracker fields via the install seed, even without stored endpoint dates', async () => {
    const h = mockVault();
    const stew = h.recipe('Stew', { cooking_count: 1, cooking_years: ['2026'], keep: 'untouched' });
    const diary = h.day(TODAY, { links: [link('Recipes/Stew')] });
    const sync = h.install();
    h.setCache(diary, {});
    assert.equal(await sync.handle(diary), 1);
    for (const key of recipeStats.CLEAN_FIELDS) assert.equal(h.frontmatter(stew)[key], undefined, key);
    assert.equal(h.frontmatter(stew).auto_updated, TODAY + ' 12:00');
    assert.equal(h.frontmatter(stew).keep, 'untouched');
    assert.deepEqual(h.writes, [stew.path]);
});

test('catch-up uses the seven-day mtime window (inclusive), including endpoint removals while closed', async () => {
    const h = mockVault();
    const soup = h.recipe('Soup');
    const ramen = h.recipe('Ramen', { last_cooked: TODAY, first_cooked: TODAY, cooking_count: 1 });
    const beans = h.recipe('Beans');
    const exact = h.recipe('Exact');
    h.day('2025-06-01', { links: [link('Recipes/Soup')] }, NOW - 8 * DAY);
    h.day('2025-06-02', { links: [link('Recipes/Beans')] }, NOW - 7 * DAY - 1);
    h.day('2025-07-01', { links: [link('Recipes/Soup'), link('Recipes/Exact')] }, NOW - 7 * DAY);
    h.day('2025-07-02', { links: [link('Recipes/Soup')] }, NOW - 2 * DAY);
    h.day(TODAY, {}, NOW - 3 * DAY);
    const sync = h.install();
    assert.equal(await sync.catchUp(), 3);
    assert.deepEqual(h.writes, [soup.path, exact.path, ramen.path]);
    assert.equal(h.frontmatter(soup).cooking_count, 3);
    assert.equal(h.frontmatter(soup).last_cooked, '2025-07-02');
    assert.equal(h.frontmatter(ramen).cooking_count, undefined);
    assert.equal(h.frontmatter(beans).cooking_count, undefined);
    assert.equal(h.frontmatter(exact).cooking_count, 1, 'a note exactly at the cutoff qualifies');
});

test('catch-up reseeds middle-day links that were missing from the install cache', async () => {
    const h = mockVault();
    const soup = h.recipe('Soup');
    const soupLinks = { links: [link('Recipes/Soup')] };
    h.day('2026-11-01', soupLinks, NOW - 24 * DAY);
    const middle = h.day('2026-11-02', undefined, NOW - 24 * DAY);
    h.day(TODAY, soupLinks);
    const sync = h.install();
    h.setCache(middle, soupLinks);
    assert.equal(await sync.catchUp(), 1);
    assert.equal(h.frontmatter(soup).cooking_count, 3);
    h.setCache(middle, {});
    assert.equal(await sync.handle(middle), 1);
    assert.equal(h.frontmatter(soup).cooking_count, 2);
});

test('startup leaves Quick Capture and Pantry untouched and preserves its delayed catch-up', async () => {
    const h = mockVault();
    const soup = h.recipe('Soup');
    const cache = { frontmatter: { modified_at: '2025-01-01' }, links: [link('Recipes/Soup')] };
    const files = [
        h.add('待办事项/Quick Capture.md', cache),
        h.add('Logistics/库存/Pantry.md', cache),
        h.add(`Misc/${TODAY}.md`, cache),
        h.add('日记/2026/Index.md', cache),
    ];
    const traces = [];
    const template = readFileSync(join(helper, 'Templates/startup-updateModified.md'), 'utf8');
    const runTemplate = vm.runInNewContext(`(async () => {${template.split('<%*')[1].split('%>')[0]}})`, {
        app: h.app, moment, setTimeout: h.setTimeout,
        tp: { user: { recipeTrackerSync: h.load(), recipeStats: h.stats }, obsidian: { Notice: class {} } },
        window: { require: () => ({ appendFileSync: (_path, line) => traces.push(line) }) },
    });
    await runTemplate();
    assert.ok(traces.some((line) => line.includes(' installed\n')));
    assert.deepEqual([...h.timers.values()].map((t) => t.delay), [10000]);
    h.resetCounts();
    for (const file of files.slice(0, 2)) await h.listeners.modify(file);
    for (const file of files) h.listeners.changed(file);
    assert.deepEqual(h.writes, []);
    assert.equal(h.frontmatter(soup).cooking_count, undefined);
    assert.equal(h.app._recipeTrackerSyncStatus.events, 4);
    assert.deepEqual([...h.timers.values()].map((t) => t.delay), [10000], 'non-diary changes must not enqueue timers');
    assert.equal(h.counts.scans, 0);
    for (const file of files.slice(0, 2)) assert.equal(h.frontmatter(file).modified_at, '2025-01-01');
    await h.listeners.modify(files[2]);
    assert.deepEqual(h.writes, [files[2].path]);
    assert.equal(h.frontmatter(files[2]).modified_at, TODAY);

    const [[id, timer]] = h.timers;
    h.timers.delete(id);
    timer.callback();
    await new Promise(setImmediate);
    assert.ok(traces.some((line) => line.includes(' catch-up starting\n')));
    assert.ok(traces.some((line) => line.includes(' catch-up wrote 0\n')));
});

test('install and catch-up enumerate once, read each cache once and reuse per-day matches', async () => {
    const h = mockVault();
    h.recipe('Soup');
    h.recipe('Stew', { last_cooked: TODAY, cooking_count: 1 });
    h.add('Misc/Note.md');
    h.day('2025-01-01', { links: [link('Recipes/Soup')] }, NOW - 8 * DAY);
    h.day(TODAY, { links: [link('Recipes/Soup'), link('Unrelated')] });
    const sync = h.install();
    const installCounts = { ...h.counts };
    h.resetCounts();
    assert.equal(await sync.catchUp(), 2);
    const expected = { scans: 1, cacheReads: 5, parses: 3, matches: 4 };
    assert.deepEqual(installCounts, expected, 'install counts');
    assert.deepEqual(h.counts, expected, 'catch-up counts');
    assert.match(h.notices[0], /2 个菜谱，2 篇日记/);
});

test('unrelated diary event avoids rebuilding parsed history', async () => {
    const h = mockVault();
    h.recipe('Soup');
    h.day('2025-01-01', { links: [link('Recipes/Soup')] }, NOW - 8 * DAY);
    const today = h.day(TODAY, { links: [link('Misc/Other')] });
    const sync = h.install();
    h.resetCounts();
    assert.equal(await sync.handle(today), 0);
    assert.deepEqual(h.counts, { scans: 1, cacheReads: 3, parses: 1, matches: 1 });
    assert.equal(sync.status.handled, 1);
    assert.deepEqual(h.writes, []);
});

test('one diary event refreshes all removed recipes from one fresh snapshot', async () => {
    const h = mockVault();
    const soup = h.recipe('Soup', { cooking_count: 1 });
    const stew = h.recipe('Stew', { cooking_count: 1 });
    h.day('2025-01-01', { links: [link('Misc/Other')] }, NOW - 8 * DAY);
    const today = h.day(TODAY, { links: [link('Recipes/Soup'), link('Recipes/Stew')] });
    const sync = h.install();
    h.setCache(today, { links: [link('Misc/New')] });
    h.resetCounts();
    assert.equal(await sync.handle(today), 2);
    assert.deepEqual(h.writes, [soup.path, stew.path]);
    assert.deepEqual(h.counts, { scans: 1, cacheReads: 4, parses: 2, matches: 4 });
});

const baselineRef = process.env.RECIPE_TRACKER_BENCHMARK_BASE;
test('synthetic vault benchmark (2,518 Markdown files, 864 diaries, 52 recipes)', { skip: !baselineRef }, async (t) => {
    const baseline = execFileSync('git', ['show', '--end-of-options', `${baselineRef}:utils/recipeTrackerSync.js`], { cwd: helper, encoding: 'utf8' });
    const fileCount = 2518;
    const diaries = 864;
    const recipes = 52;
    async function measure(code) {
        const h = mockVault();
        for (let i = 0; i < recipes; i++) h.recipe(`Recipe-${String(i).padStart(2, '0')}`);
        for (let i = 0; i < diaries; i++) {
            h.day(new Date(NOW - i * DAY).toISOString().slice(0, 10), {
                links: [link(`Recipes/Recipe-${String(i % recipes).padStart(2, '0')}`), link('Misc/Other')],
            });
        }
        for (let i = diaries + recipes; i < fileCount; i++) h.add(`Misc/Note-${i}.md`);
        const factory = h.load(code);
        const start = performance.now();
        const sync = factory(h.app, moment, h.stats);
        const install = { ms: performance.now() - start, ...h.counts };
        h.resetCounts();
        const catchUpStart = performance.now();
        const writes = await sync.catchUp();
        const catchUp = { ms: performance.now() - catchUpStart, ...h.counts };
        return { install, catchUp, writes };
    }
    const before = [], after = [];
    for (let i = 0; i < 5; i++) {
        before.push(await measure(baseline));
        after.push(await measure(source));
    }
    for (const run of [...before, ...after]) assert.equal(run.writes, recipes);
    const median = (series, phase) => series.map((run) => run[phase].ms).sort((a, b) => a - b)[2].toFixed(1);
    for (const phase of ['install', 'catchUp']) {
        const old = before[0][phase], next = after[0][phase];
        assert.ok(old.scans >= diaries);
        assert.equal(next.scans, 1);
        assert.equal(next.cacheReads, fileCount);
        assert.equal(next.parses, 2 * diaries);
        t.diagnostic(`${phase} median of 5: ${median(before, phase)} → ${median(after, phase)} ms; ` +
            `vault scans ${old.scans} → ${next.scans}; cache reads ${old.cacheReads} → ${next.cacheReads}; ` +
            `link parses ${old.parses} → ${next.parses}; match checks ${old.matches} → ${next.matches}`);
    }
});
