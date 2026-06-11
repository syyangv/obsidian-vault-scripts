module.exports = async (params) => {
    const { app } = params;

    const homepageFile = app.vault.getAbstractFileByPath("个人主页.md");

    if (!homepageFile) {
        new Notice("找不到个人主页文件");
        return;
    }

    // Check if file is already open
    const leaves = app.workspace.getLeavesOfType("markdown");
    let targetLeaf = null;

    for (const leaf of leaves) {
        if (leaf.view.file?.path === homepageFile.path) {
            app.workspace.setActiveLeaf(leaf, { focus: true });
            targetLeaf = leaf;
            break;
        }
    }

    // If not already open, open it
    if (!targetLeaf) {
        const leaf = app.workspace.getLeaf(false);
        await leaf.openFile(homepageFile, { active: true });
        targetLeaf = leaf;
    }

    // Pin the leaf
    if (targetLeaf) {
        targetLeaf.setPinned(true);
    }

    new Notice("已打开并固定个人主页");
};
