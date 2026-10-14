---
modified_at: 2026-10-07
---
<%*
// Guard: only register once per Obsidian session
if (!app._modifiedAtListenerActive) {
    const processing = new Set();

    const handler = async (file) => {
        // Only .md files
        if (!file.path.endsWith('.md')) return;
        // Skip if we're already writing this file (prevents write loop)
        if (processing.has(file.path)) return;

        const today = moment().format('YYYY-MM-DD');
        const cache = app.metadataCache.getFileCache(file);
        // Skip if already up to date
        if (cache?.frontmatter?.modified_at === today) return;

        processing.add(file.path);
        try {
            await app.fileManager.processFrontMatter(file, (fm) => {
                fm['modified_at'] = today;
            });
        } finally {
            processing.delete(file.path);
        }
    };

    app.vault.on('modify', handler);
    app._modifiedAtListenerActive = true;
}

// Recipe frontmatter sync: when a daily note links a recipe, refresh that recipe's
// cooking_* fields without opening it. Logic: Helper/utils/recipeTrackerSync.js.
// Own try/catch so a failure here cannot affect the listener above.
// TEMPORARY: every step is also appended to /tmp/recipeTrackerSync.log so a silent
// failure leaves evidence outside Obsidian. Remove once the sync is proven.
const trace = (m) => {
    try { window.require('fs').appendFileSync('/tmp/recipeTrackerSync.log', new Date().toISOString() + ' ' + m + '\n'); } catch (_) {}
};
trace('startup block reached; active=' + !!app._recipeTrackerSyncActive);
try {
    if (!app._recipeTrackerSyncActive) {
        trace('tp.user has: ' + Object.keys(tp.user || {}).filter((k) => /recipe/i.test(k)).join(',') +
            ' | recipeStats=' + typeof (tp.user && tp.user.recipeStats) +
            ' | recipeTrackerSync=' + typeof (tp.user && tp.user.recipeTrackerSync));
        // Each Notice is a popup, so a working sync is visible and a silent one is
        // conspicuous. Console: app._recipeTrackerSyncStatus.
        const Notice = tp.obsidian && tp.obsidian.Notice;
        trace('Notice=' + typeof Notice);
        const notify = (message) => { trace('notice: ' + message); new Notice(message, 6000); };
        const log = { error: (...a) => trace('ERROR ' + a.map((x) => (x && x.stack) || String(x)).join(' ')) };
        const sync = tp.user.recipeTrackerSync(app, moment, tp.user.recipeStats, { notify, log });
        app._recipeTrackerSyncActive = true;
        app._recipeTrackerSyncStatus = sync.status;
        trace('installed');
        // Notes modified while Obsidian was closed fire no event: let the metadata
        // cache settle, then re-check the last few days.
        setTimeout(() => {
            trace('catch-up starting');
            sync.catchUp().then((n) => trace('catch-up wrote ' + n), (e) => trace('catch-up ERROR ' + ((e && e.stack) || e)));
        }, 10000);
    }
} catch (e) {
    trace('FAILED to start: ' + ((e && e.stack) || e));
    console.error('recipeTrackerSync failed to start', e);
    try { new tp.obsidian.Notice('菜谱同步启动失败：' + (e && e.message ? e.message : e), 10000); } catch (_) {}
}
tR = '';
%>
