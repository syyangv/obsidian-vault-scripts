// Keeps recipe frontmatter current without rendering the recipe note.
// Save as: Helper/utils/recipeTrackerSync.js   (Templater user script)
// Installed by Helper/Templates/startup-recipeTracker.md.
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

    const linksOf = (file) => {
        const c = app.metadataCache.getFileCache(file) ?? {};
        return [...(c.links ?? []), ...(c.embeds ?? []), ...(c.frontmatterLinks ?? [])].map((l) =>
            recipeStats.parseLink(l.displayText && l.displayText !== l.link ? `${l.link}|${l.displayText}` : l.link)
        );
    };

    // A recipe is tracked when it embeds the tracker. Recipes.md (the index) carries
    // old tracker frontmatter but no embed, so it is left alone.
    const trackedRecipes = () =>
        app.vault.getMarkdownFiles().filter((f) => {
            const embeds = app.metadataCache.getFileCache(f)?.embeds ?? [];
            return embeds.some((e) => e.link.split('#')[0].trim().endsWith('recipeTracker'));
        });

    const dailyFiles = () =>
        app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(DIARY) && DATE_NAME.test(f.basename));

    async function refreshRecipe(recipe, diary) {
        const entries = diary
            .filter((d) => recipeStats.linksRecipe(d.links, recipe.basename))
            .map((d) => ({ name: d.file.basename, year: d.file.path.split('/')[1] }));
        const stats = recipeStats(entries, moment().format('YYYY-MM-DD'));
        const fm = app.metadataCache.getFileCache(recipe)?.frontmatter ?? {};
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

    // The tracked recipes a daily note links.
    function recipesLinkedBy(dailyFile) {
        if (!dailyFile.path.startsWith(DIARY) || !DATE_NAME.test(dailyFile.basename)) return [];
        const changed = linksOf(dailyFile);
        return trackedRecipes().filter((r) => recipeStats.linksRecipe(changed, r.basename));
    }

    // Tracked recipes whose own frontmatter names this date as first or last cooked.
    // Needs no memory: if the note at that date stopped linking the recipe, the
    // recipe's numbers are wrong, whatever the sync did or did not see before.
    const recipesDatedBy = (dailyFile) =>
        trackedRecipes().filter((r) => {
            const fm = app.metadataCache.getFileCache(r)?.frontmatter ?? {};
            return String(fm.last_cooked) === dailyFile.basename || String(fm.first_cooked) === dailyFile.basename;
        });

    // daily-note path -> the tracked recipes it linked when last seen. This is what
    // makes a REMOVED link visible: after the change the note no longer names the
    // recipe, so "who used to be linked" has to be remembered, not re-derived.
    const known = new Map();
    // Seeded at install AND again at catch-up: the metadata cache can still be
    // filling when Templater runs its startup templates, and a memory seeded from
    // a half-empty cache would miss every removal.
    const seedKnown = () => {
        for (const f of dailyFiles()) known.set(f.path, new Set(recipesLinkedBy(f).map((r) => r.path)));
    };
    seedKnown();

    async function refreshAll(recipes) {
        const diary = dailyFiles().map((file) => ({ file, links: linksOf(file) }));
        let written = 0;
        for (const recipe of recipes) {
            try {
                const summary = await refreshRecipe(recipe, diary);
                if (summary) {
                    written++;
                    status.writes++;
                    status.last = summary;
                    notify(`菜谱同步：${summary}`);
                }
            } catch (e) {
                log.error(`recipeTrackerSync: ${recipe.path}`, e); // one bad note must not stop the rest
                notify(`菜谱同步出错：${recipe.basename}（见控制台）`);
            }
        }
        return written;
    }

    async function handle(dailyFile) {
        const now = recipesLinkedBy(dailyFile);
        if (!dailyFile.path.startsWith(DIARY) || !DATE_NAME.test(dailyFile.basename)) return 0;
        const before = known.get(dailyFile.path) ?? new Set();
        known.set(dailyFile.path, new Set(now.map((r) => r.path)));
        const byPath = new Map(now.map((r) => [r.path, r]));
        for (const path of before) {
            if (!byPath.has(path)) {
                const gone = trackedRecipes().find((r) => r.path === path);
                if (gone) byPath.set(path, gone);
            }
        }
        for (const r of recipesDatedBy(dailyFile)) byPath.set(r.path, r);
        status.handled++;
        if (byPath.size > 0) {
            notify(`菜谱同步：${dailyFile.basename} 变更，检查 ${[...byPath.values()].map((r) => r.basename).join('、')}`);
        }
        return refreshAll([...byPath.values()]);
    }

    const schedule = (file) => {
        status.events++;
        clearTimeout(timers.get(file.path));
        timers.set(file.path, setTimeout(() => { timers.delete(file.path); handle(file); }, debounceMs));
    };

    // Several recent notes often link the same recipe; each recipe is refreshed once.
    async function catchUp() {
        seedKnown();
        const cutoff = Date.now() - catchUpDays * 86400000;
        const recipes = new Map();
        const recentDates = new Set();
        for (const f of dailyFiles()) {
            if (f.stat.mtime < cutoff) continue;
            recentDates.add(f.basename);
            for (const r of recipesLinkedBy(f)) recipes.set(r.path, r);
        }
        // A link removed while Obsidian was closed leaves no trace in the note, but
        // the recipe's own first/last cooked date still names it.
        for (const r of trackedRecipes()) {
            const fm = app.metadataCache.getFileCache(r)?.frontmatter ?? {};
            if (recentDates.has(String(fm.last_cooked)) || recentDates.has(String(fm.first_cooked))) {
                recipes.set(r.path, r);
            }
        }
        return refreshAll([...recipes.values()]);
    }

    const ref = app.metadataCache.on('changed', schedule);
    notify(`菜谱同步已启动（${trackedRecipes().length} 个菜谱，${dailyFiles().length} 篇日记）`);
    return { handle, catchUp, ref, status, pending: () => timers.size, forgetAll: () => known.clear() };
}

module.exports = recipeTrackerSync;
