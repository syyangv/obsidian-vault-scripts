// JS Engine script — app, engine, obsidian injected as globals
module.exports = async () => {}; // Templater compat: valid export, no top-level execution

if (typeof engine !== 'undefined') (async () => {
    const { Modal, Setting, Notice } = obsidian;

    const file = app.workspace.getActiveFile();
    if (!file) { new Notice("No active file"); return; }

    const fm = app.metadataCache.getFileCache(file)?.frontmatter || {};

    await new Promise((resolve) => {
        const modal = new Modal(app);
        modal.titleEl.setText("更新月度金额");

        let 购物 = String(fm.购物金额 ?? "");
        let 食物 = String(fm.食物金额 ?? "");
        let 电费 = String(fm.电费 ?? "");

        new Setting(modal.contentEl)
            .setName("🛍️ 本月购物金额")
            .addText(t => t.setValue(购物).onChange(v => 购物 = v));

        new Setting(modal.contentEl)
            .setName("🍜 本月吃饭金额")
            .addText(t => t.setValue(食物).onChange(v => 食物 = v));

        new Setting(modal.contentEl)
            .setName("⚡️ 本月电费")
            .addText(t => t.setValue(电费).onChange(v => 电费 = v));

        new Setting(modal.contentEl)
            .addButton(btn => btn.setButtonText("保存").setCta().onClick(async () => {
                modal.close();
                await app.fileManager.processFrontMatter(file, (frontmatter) => {
                    const v购物 = parseFloat(购物);
                    const v食物 = parseFloat(食物);
                    const v电费 = parseFloat(电费);
                    if (!isNaN(v购物)) frontmatter.购物金额 = v购物;
                    if (!isNaN(v食物)) frontmatter.食物金额 = v食物;
                    if (!isNaN(v电费)) frontmatter.电费 = v电费;
                });
                new Notice("✅ 月度金额已更新");
                resolve();
            }))
            .addButton(btn => btn.setButtonText("取消").onClick(() => {
                modal.close();
                resolve();
            }));

        modal.open();
    });
})();
