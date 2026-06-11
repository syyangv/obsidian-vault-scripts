module.exports = async (params) => {
    const { app, quickAddApi } = params;

    // Read canonical supplement list from 药品.md
    const medFile = app.vault.getMarkdownFiles().find(f => f.path === 'Logistics/库存/药品.md');
    if (!medFile) {
        new Notice("找不到 Logistics/库存/药品.md");
        return;
    }
    const medFm = app.metadataCache.getFileCache(medFile)?.frontmatter;
    if (!medFm) {
        new Notice("药品.md 没有 frontmatter");
        return;
    }

    const medList = Object.keys(medFm)
        .filter(k => k.startsWith('unit_dose_'))
        .map(k => k.replace('unit_dose_', ''))
        .sort();
    const selected = await quickAddApi.suggester(medList, medList);
    if (!selected) return;

    const countStr = await quickAddApi.inputPrompt(`补充 ${selected} 多少粒？`);
    if (!countStr) return;

    const count = parseInt(countStr);
    if (isNaN(count) || count <= 0) {
        new Notice("请输入有效的数量");
        return;
    }

    const file = app.workspace.getActiveFile();
    if (!file) {
        new Notice("请先打开一个笔记");
        return;
    }

    const key = `refill_${selected}_pills`;
    await app.fileManager.processFrontMatter(file, (fm) => {
        fm[key] = count;
    });

    new Notice(`✅ 已记录：${key} = ${count}`);
};
