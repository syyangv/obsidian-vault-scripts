module.exports = async (params) => {
    const { app, quickAddApi } = params;
    
    // Get all books with status "在看"
    const books = app.vault.getMarkdownFiles()
        .filter(f => {
            // Check if file is in the 知识库/读书笔记 folder
            if (!f.path.startsWith('知识库/读书笔记/')) return false;
            
            const cache = app.metadataCache.getFileCache(f);
            const fm = cache?.frontmatter;
            
            // Handle both array and string status
            if (Array.isArray(fm?.status)) {
                return fm.status.includes('在看');
            }
            return fm?.status === '在看';
        })
        .map(f => f.basename)
        .sort();

    if (books.length === 0) {
        new Notice("没有找到正在阅读的书籍");
        return;
    }

    const selected = await quickAddApi.suggester(books, books);
    if (!selected) return;

    const bookFile = app.vault.getMarkdownFiles().find(f => f.basename === selected);
    const bookFm = bookFile && app.metadataCache.getFileCache(bookFile)?.frontmatter;
    const lastPages = bookFm?.完成页数;
    const pagesPrompt = lastPages != null && lastPages !== 0 ? `完成页数（上次：${lastPages}）` : "完成页数";

    const pages = await quickAddApi.inputPrompt(pagesPrompt);
    if (!pages) return;

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

    const result = await cjs.DailyLog.sectionUpsert(app, target, "读书", "完成页数", selected, pages);
    if (result === "no-section") {
        new Notice("日记中没有找到读书标题");
        return;
    }
    new Notice(result === "updated" ? `✏️ 已更新: ${selected} - ${pages}页` : `✅ 已添加: ${selected} - ${pages}页`);
};