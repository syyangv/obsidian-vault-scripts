module.exports = async (params) => {
    const { app, quickAddApi } = params;
    
    const shows = app.vault.getMarkdownFiles()
        .filter(function(f) {
            const cache = app.metadataCache.getFileCache(f);
            const fm = cache && cache.frontmatter;
            
            // Check if file has the 弃剧 tag
            const tags = [];
            // Get tags from frontmatter
            if (fm && fm.tags) {
                if (Array.isArray(fm.tags)) {
                    tags.push.apply(tags, fm.tags);
                } else if (typeof fm.tags === 'string') {
                    tags.push(fm.tags);
                }
            }
            // Get inline tags from cache
            if (cache && cache.tags) {
                for (var i = 0; i < cache.tags.length; i++) {
                    tags.push(cache.tags[i].tag.replace(/^#/, ''));
                }
            }
            
            // Check if 弃剧 tag exists
            var hasDroppedTag = false;
            for (var j = 0; j < tags.length; j++) {
                if (tags[j] === '弃剧') {
                    hasDroppedTag = true;
                    break;
                }
            }
            
            return fm && fm.总集数 && fm.开始看日期 && !fm.看过日期 && !hasDroppedTag;
        })
        .map(function(f) { return f.basename; })
        .sort();

    if (shows.length === 0) {
        new Notice("没有找到正在观看的电视剧");
        return;
    }

    const selected = await quickAddApi.suggester(shows, shows);
    if (!selected) return;

    const showFile = app.vault.getMarkdownFiles().find(f => f.basename === selected);
    const showFm = showFile && app.metadataCache.getFileCache(showFile)?.frontmatter;
    const lastEpisodes = showFm?.看过集数;
    const episodePrompt = lastEpisodes != null ? `看过集数（上次：${lastEpisodes}）` : "看过集数";

    const episodes = await quickAddApi.inputPrompt(episodePrompt);
    if (!episodes) return;

    const cjs = window.customJS;
    if (!cjs?.DailyLog) {
        new Notice("CustomJS DailyLog 未加载");
        return;
    }

    const target = cjs.DailyLog.resolveDailyTarget(app);
    if (!target) {
        new Notice("找不到今日日记");
        return;
    }

    const result = await cjs.DailyLog.sectionUpsert(app, target, "看电视", "看过集数", selected, episodes);
    if (result === "no-section") {
        new Notice("没有找到看电视标题");
        return;
    }
    new Notice((result === "updated" ? "已更新: " : "已添加: ") + selected + " - " + episodes + "集");

    // If new episode count > 更新集数, bump 更新集数 on the show file
    const newEpNum = parseInt(episodes);
    const currentUpdateCount = showFm?.更新集数;
    const currentTotalCount = showFm?.总集数;
    const needsUpdateCount = !isNaN(newEpNum) && (currentUpdateCount == null || newEpNum > currentUpdateCount);
    const needsTotalCount = !isNaN(newEpNum) && (currentTotalCount == null || newEpNum > currentTotalCount);
    if (needsUpdateCount || needsTotalCount) {
        await app.fileManager.processFrontMatter(showFile, (fm) => {
            if (needsUpdateCount) fm['更新集数'] = newEpNum;
            if (needsTotalCount) fm['总集数'] = newEpNum;
        });
    }
};