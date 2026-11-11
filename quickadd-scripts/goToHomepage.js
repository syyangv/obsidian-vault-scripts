// Notes that stay open and pinned on startup; every other main-area tab is closed.
const PINNED_NOTES = [
    "待办事项/待办事项.md",
    "TaskNotes/Views/kanban-default.base",
    "个人主页.md",
];
const FOCUS_NOTE = "个人主页.md";

module.exports = async (params) => {
    const { app } = params;

    // The saved view state carries the path even for tabs that are not loaded yet
    const pathOf = (leaf) => leaf.getViewState().state?.file;
    const rootLeaves = () => {
        const leaves = [];
        // Block body: a truthy callback return value would stop the iteration
        app.workspace.iterateRootLeaves((leaf) => {
            leaves.push(leaf);
        });
        return leaves;
    };

    const missing = PINNED_NOTES.filter((p) => !app.vault.getAbstractFileByPath(p));
    if (missing.length) {
        new Notice(`找不到固定笔记: ${missing.join(", ")}`);
    }
    const notes = PINNED_NOTES.filter((p) => !missing.includes(p));

    // Keep the first tab per listed note
    const kept = new Map();
    for (const leaf of rootLeaves()) {
        const path = pathOf(leaf);
        if (notes.includes(path) && !kept.has(path)) kept.set(path, leaf);
    }

    // Open missing notes before closing anything so the main area is never left empty.
    // A new tab is kept only if it ends up showing its note; otherwise the sweep
    // below closes it, so an empty tab is never pinned.
    const created = [];
    for (const path of notes) {
        if (kept.has(path)) continue;
        const leaf = app.workspace.getLeaf("tab");
        created.push(leaf);
        try {
            await leaf.openFile(app.vault.getAbstractFileByPath(path));
        } catch (error) {
            new Notice(`打开失败: ${path}`);
        }
        if (pathOf(leaf) === path) kept.set(path, leaf);
    }
    // Never close everything when no listed note could be shown
    if (kept.size === 0) {
        const attached = rootLeaves();
        created.filter((leaf) => attached.includes(leaf)).forEach((leaf) => leaf.detach());
        return;
    }

    // Sweep: close every tab that is not kept (old pins, empty leftovers), pin the rest
    const keep = new Set(kept.values());
    const attached = rootLeaves();
    for (const leaf of attached) {
        if (!keep.has(leaf)) leaf.detach();
    }
    const pinned = attached.filter((leaf) => keep.has(leaf));
    for (const leaf of pinned) {
        leaf.setPinned(true);
    }
    app.workspace.setActiveLeaf(
        pinned.find((leaf) => pathOf(leaf) === FOCUS_NOTE) ?? pinned[0],
        { focus: true }
    );

    new Notice(`已固定 ${pinned.length} 个笔记，关闭 ${attached.length - pinned.length} 个标签页`);
};
