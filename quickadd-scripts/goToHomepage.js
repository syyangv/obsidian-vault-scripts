// Notes and views that stay open and pinned on startup; every other main-area tab is closed.
const PINNED_NOTES = [
    "待办事项/待办事项.md",
    "TaskNotes/Views/kanban-default.base",
    "个人主页.md",
];
// Views that are not files, matched by view type
const PINNED_VIEWS = ["ai-dashboard-v15"];
const FOCUS_NOTE = "个人主页.md";

module.exports = async (params) => {
    const { app } = params;

    // A tab's identity is its view type for listed views, else its file path.
    // The saved view state carries both even for tabs that are not loaded yet.
    const keyOf = (leaf) => {
        const state = leaf.getViewState();
        return PINNED_VIEWS.includes(state.type) ? state.type : state.state?.file;
    };
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
    const wanted = [...PINNED_NOTES.filter((p) => !missing.includes(p)), ...PINNED_VIEWS];

    // Keep the first tab per wanted entry
    const kept = new Map();
    for (const leaf of rootLeaves()) {
        const key = keyOf(leaf);
        if (wanted.includes(key) && !kept.has(key)) kept.set(key, leaf);
    }

    // Open missing entries before closing anything so the main area is never left empty.
    // A new tab is kept only if it ends up showing its entry; otherwise the sweep
    // below closes it, so an empty tab is never pinned.
    const created = [];
    for (const key of wanted) {
        if (kept.has(key)) continue;
        const leaf = app.workspace.getLeaf("tab");
        created.push(leaf);
        try {
            if (PINNED_VIEWS.includes(key)) {
                await leaf.setViewState({ type: key });
            } else {
                await leaf.openFile(app.vault.getAbstractFileByPath(key));
            }
        } catch (error) {
            new Notice(`打开失败: ${key}`);
        }
        if (keyOf(leaf) === key) kept.set(key, leaf);
    }
    // Never close everything when nothing wanted could be shown
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

    // Bases views opened during startup (e.g. kanban-default.base) may render before
    // delayed plugins like TaskNotes register custom view types (tasknotesKanban),
    // leaving a sticky "Unknown view type" error because BasesView has no .refresh().
    // Poll briefly until the custom view factory is registered, then clear & re-render.
    const recoverBasesLeaves = (attempt = 0) => {
        let pending = false;
        for (const leaf of pinned) {
            if (leaf.view?.getViewType?.() !== "bases") continue;
            const ctrl = leaf.view.controller;
            if (!ctrl || ctrl.error !== "view") continue;
            const cfg = ctrl.query?.getViewConfig?.(ctrl.viewName);
            if (cfg?.type && ctrl.plugin?.getViewFactory?.(cfg.type)) {
                ctrl.clearError();
                ctrl.queryState = "";
                ctrl.update();
            } else {
                pending = true;
            }
        }
        if (pending && attempt < 20) {
            setTimeout(() => recoverBasesLeaves(attempt + 1), 500);
        }
    };
    recoverBasesLeaves();

    app.workspace.setActiveLeaf(
        pinned.find((leaf) => keyOf(leaf) === FOCUS_NOTE) ?? pinned[0],
        { focus: true }
    );

    new Notice(`已固定 ${pinned.length} 个标签页，关闭 ${attached.length - pinned.length} 个标签页`);
};
