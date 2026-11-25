// Keeps recipe frontmatter current without rendering the recipe note.
// Save as: Helper/utils/recipeTrackerSync.js   (Templater user script)
// Installed by Helper/Templates/startup-updateModified.md.
//
// When a daily note changes, every TRACKED recipe (one that embeds
// ![[recipeTracker]]) that the note links gets the same frontmatter the
// recipeTracker dataviewjs block would write. The block stays authoritative and
// still runs when a recipe is opened; this only removes the wait for that.
//
// A link REMOVED from a daily note (the PWA's 撤销) is handled too: the sync
// remembers which tracked recipes each daily note linked, so the recipe that lost
// its link is refreshed, and one with no links left has its cooking_* fields
// cleared exactly as the tracker clears them.
//
// Known limit, on purpose: nothing runs while Obsidian is closed. The catch-up on
// launch covers daily notes modified in the last few days, including recipes whose
// first/last cooked date is one of those notes (a link removed while closed).

const DIARY = '日记/';
const DATE_NAME = /^\d{4}-\d{2}-\d{2}$/;
const isDiary = (file) => file.path.startsWith(DIARY) && DATE_NAME.test(file.basename);

function recipeTrackerSync(app, moment, recipeStats, opts = {}) {
    const debounceMs = opts.debounceMs ?? 2000;
    const catchUpDays = opts.catchUpDays ?? 7;
    const log = opts.log ?? console;
    // A visible sign that the sync did something. Obsidian's Notice, passed in by
    // the startup template; a no-op in tests. It fires only when a daily note's
    // change concerns a tracked recipe, never on ordinary edits.
    const notifyFn = opts.notify ?? (() => {});
    const notify = (message) => {
        try {
            notifyFn(message);
        } catch (e) {
            log.error('recipeTrackerSync: notify failed', e); // a popup must never break the sync
        }
    };
    const timers = new Map();
    // Readable from the developer console: app._recipeTrackerSyncStatus
    const status = { installedAt: new Date().toISOString(), events: 0, handled: 0, writes: 0, last: null };

    const linksOf = (cache) =>
        [...(cache.links ?? []), ...(cache.embeds ?? []), ...(cache.frontmatterLinks ?? [])].map((l) =>
            recipeStats.parseLink(l.displayText && l.displayText !== l.link ? `${l.link}|${l.displayText}` : l.link)
        );

    function readSnapshot() {
        const daily = new Map();
        const tracked = new Map();
        for (const file of app.vault.getMarkdownFiles()) {
            const cache = app.metadataCache.getFileCache(file) ?? {};
            if (isDiary(file)) daily.set(file.path, { file, cache });
            // Recipes.md (the index) has tracker fields but no embed.
            if (cache.embeds?.some((e) => e.link.split('#')[0].trim().endsWith('recipeTracker'))) {
                tracked.set(file.path, { file, frontmatter: cache.frontmatter ?? {} });
            }
        }
        return { daily, tracked };
    }

    function matchDay(cache, recipes) {
        const links = linksOf(cache);
        const paths = new Set();
        for (const { file } of recipes.values()) {
            if (recipeStats.linksRecipe(links, file.basename)) paths.add(file.path);
        }
        return paths;
    }

    async function refreshRecipe({ file: recipe, frontmatter: fm }, entries) {
        const stats = recipeStats(entries, moment().format('YYYY-MM-DD'));
        if (!stats) {
            // No daily note links this recipe any more: clear what the tracker
            // would clear, and only if there is something to clear.
            if (!recipeStats.CLEAN_FIELDS.some((k) => fm[k] !== undefined)) return false;
            await app.fileManager.processFrontMatter(recipe, (f) => {
                for (const k of recipeStats.CLEAN_FIELDS) delete f[k];
                f.auto_updated = moment().format('YYYY-MM-DD HH:mm');
            });
            return `${recipe.basename}: 已清空`;
        }
        const needsUpdate =
            fm.last_cooked !== stats.last_cooked || fm.first_cooked !== stats.first_cooked ||
            fm.cooking_count !== stats.cooking_count || fm.cooking_frequency !== stats.cooking_frequency ||
            fm.favorite_season !== stats.favorite_season || fm.recent_activity !== stats.recent_activity;
        if (!needsUpdate) return false;
        await app.fileManager.processFrontMatter(recipe, (f) => {
            for (const [k, v] of Object.entries(stats)) if (v !== null) f[k] = v;
            f.auto_updated = moment().format('YYYY-MM-DD HH:mm');
        });
        return `${recipe.basename}: ${stats.cooking_count} 次`;
    }

    // Remember removed links, and reseed after startup because the install cache can be incomplete.
    const known = new Map();
    function seedKnown({ daily, tracked }) {
        const matches = new Map();
        for (const [path, { cache }] of daily) {
            const paths = matchDay(cache, tracked);
            matches.set(path, paths);
            known.set(path, paths);
        }
        return matches;
    }

    // Endpoint dates are the fallback for removals that happened while Obsidian was closed.
    function addDatedRecipes(recipes, tracked, dates) {
        for (const [path, recipe] of tracked) {
            const { first_cooked, last_cooked } = recipe.frontmatter;
            if (dates.has(String(first_cooked)) || dates.has(String(last_cooked))) recipes.set(path, recipe);
        }
    }

    async function refreshAll(daily, recipes, matches) {
        if (recipes.size === 0) return 0;
        const entries = new Map([...recipes.keys()].map((path) => [path, []]));
        for (const [path, { file, cache }] of daily) {
            // Catch-up already matched every day; live edits match only the remaining days.
            const paths = matches.get(path) ?? matchDay(cache, recipes);
            if (paths.size === 0) continue;
            const entry = { name: file.basename, year: file.path.split('/')[1] };
            for (const recipePath of paths) entries.get(recipePath)?.push(entry);
        }
        let written = 0;
        for (const [path, recipe] of recipes) {
            try {
                const summary = await refreshRecipe(recipe, entries.get(path));
                if (summary) {
                    written++;
                    status.writes++;
                    status.last = summary;
                    notify(`菜谱同步：${summary}`);
                }
            } catch (e) {
                log.error(`recipeTrackerSync: ${path}`, e); // one bad note must not stop the rest
                notify(`菜谱同步出错：${recipe.file.basename}（见控制台）`);
            }
        }
        return written;
    }

    async function handle(dailyFile) {
        if (!isDiary(dailyFile)) return 0;
        const { daily, tracked } = readSnapshot();
        const path = dailyFile.path;
        const cache = daily.get(path)?.cache ?? app.metadataCache.getFileCache(dailyFile) ?? {};
        const now = matchDay(cache, tracked);
        const before = known.get(path) ?? [];
        known.set(path, now);

        const recipes = new Map();
        for (const recipePath of [...now, ...before]) {
            const recipe = tracked.get(recipePath);
            if (recipe) recipes.set(recipePath, recipe);
        }
        addDatedRecipes(recipes, tracked, new Set([dailyFile.basename]));
        status.handled++;
        if (recipes.size === 0) return 0;
        const names = [...recipes.values()].map(({ file }) => file.basename);
        notify(`菜谱同步：${dailyFile.basename} 变更，检查 ${names.join('、')}`);
        return refreshAll(daily, recipes, new Map([[path, now]]));
    }

    const schedule = (file) => {
        status.events++;
        if (!isDiary(file)) return;
        clearTimeout(timers.get(file.path));
        timers.set(file.path, setTimeout(() => { timers.delete(file.path); handle(file); }, debounceMs));
    };

    async function catchUp() {
        const snapshot = readSnapshot();
        const matches = seedKnown(snapshot);
        const cutoff = Date.now() - catchUpDays * 86400000;
        const recipes = new Map();
        const recentDates = new Set();
        for (const [path, { file }] of snapshot.daily) {
            if (file.stat.mtime < cutoff) continue;
            recentDates.add(file.basename);
            for (const recipePath of matches.get(path)) recipes.set(recipePath, snapshot.tracked.get(recipePath));
        }
        addDatedRecipes(recipes, snapshot.tracked, recentDates);
        return refreshAll(snapshot.daily, recipes, matches);
    }

    const initial = readSnapshot();
    seedKnown(initial);
    const ref = app.metadataCache.on('changed', schedule);
    notify(`菜谱同步已启动（${initial.tracked.size} 个菜谱，${initial.daily.size} 篇日记）`);
    return { handle, catchUp, ref, status, pending: () => timers.size, forgetAll: () => known.clear() };
}

module.exports = recipeTrackerSync;
