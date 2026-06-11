module.exports = async (params) => {
    const { app, quickAddApi } = params;

    const courses = app.vault.getMarkdownFiles()
        .filter(f => {
            const cache = app.metadataCache.getFileCache(f);
            const fm = cache && cache.frontmatter;
            if (!fm) return false;
            const status = fm['任务状态'];
            if (Array.isArray(status)) return status.includes('进行中');
            return status === '进行中';
        })
        .map(f => f.basename)
        .sort();

    if (courses.length === 0) {
        new Notice("没有找到进行中的课程");
        return;
    }

    const selected = await quickAddApi.suggester(courses, courses);
    if (!selected) return;

    const courseFile = app.vault.getMarkdownFiles().find(f => f.basename === selected);
    const courseFm = courseFile && app.metadataCache.getFileCache(courseFile)?.frontmatter;
    const lastProgress = courseFm?.进度;
    const progressPrompt = lastProgress != null && lastProgress !== 0 ? `当前进度（集/节数）（上次：${lastProgress}）` : "当前进度（集/节数）";

    const input = await quickAddApi.inputPrompt(progressPrompt);
    if (input === null || input === undefined || input === '') return;

    const progressNum = parseInt(input, 10);
    if (isNaN(progressNum)) {
        new Notice("请输入有效数字");
        return;
    }

    // Update 进度 frontmatter in the course file
    if (!courseFile) {
        new Notice("找不到课程文件: " + selected);
        return;
    }
    await app.fileManager.processFrontMatter(courseFile, (fm) => {
        fm['进度'] = progressNum;
    });

    // Log to the daily note (active daily note if viewing one, else today) under 课程
    const cjs = window.customJS;
    if (!cjs?.DailyLog) {
        new Notice("✅ 已更新课程进度，但 CustomJS DailyLog 未加载");
        return;
    }

    const dailyFile = cjs.DailyLog.resolveDailyTarget(app);
    if (!dailyFile) {
        new Notice("✅ 已更新课程进度，但找不到今日日记");
        return;
    }

    const result = await cjs.DailyLog.sectionUpsert(app, dailyFile, "课程", "进度", selected, progressNum);
    if (result === "no-section") {
        new Notice("✅ 已更新课程进度，但日记中没有找到课程标题");
        return;
    }
    new Notice((result === "updated" ? "✅ 已更新: " : "✅ 已记录: ") + selected + " 进度 → " + progressNum);
};
