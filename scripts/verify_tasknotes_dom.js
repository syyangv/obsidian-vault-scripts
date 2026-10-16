(() => {
    // Read-only probe: never manufacture target elements or change plugin state.
    const surfaces = __SURFACES__;
    const settings = app.plugins.plugins.tasknotes?.settings;
    if (app.vault.getName() !== "syang" || !settings) {
        return JSON.stringify({probe: "tasknotes-css-v1", results: surfaces.map(surface =>
            ({surface, state: "UNVERIFIED", detail: "Wrong vault or TaskNotes not loaded"}))});
    }
    const query = selector => Array.from(document.querySelectorAll(selector));
    const hidden = el => {
        for (let node = el; node instanceof Element; node = node.parentElement) {
            const style = getComputedStyle(node);
            if (style.display === "none" || style.visibility === "hidden"
                || style.visibility === "collapse" || style.opacity === "0") return true;
        }
        return false;
    };
    const report = (surface, state, detail) => ({surface, state, detail});
    const inspect = surface => {
        let targets = [], context = [];
        if (surface === "ribbon") {
            targets = query('.workspace-ribbon.mod-primary [aria-label]').filter(el =>
                /pomodoro|番茄|помодоро|ポモドーロ|뽀모도로/i.test(el.getAttribute("aria-label")));
            // A hidden/collapsed entire ribbon must not disguise a broken rule.
            if (targets.length < 2) return report(surface, "UNVERIFIED", "Expected timer AND statistics buttons; inspect new labels/DOM");
            const broken = targets.filter(el => getComputedStyle(el).display !== "none");
            return report(surface, broken.length ? "FAIL" : "PASS", `${targets.length} Pomodoro buttons; ${broken.length} lack display:none`);
        }
        if (surface === "status") {
            if (settings.showPomodoroInStatusBar !== false || settings.showTrackedTasksInStatusBar !== false)
                return report(surface, "FAIL", "Runtime status-bar settings must both be false");
            targets = query('.status-bar .tasknotes-status-bar');
            const shown = targets.filter(el => !hidden(el));
            return report(surface, shown.length ? "FAIL" : "PASS", `${shown.length} visible TaskNotes status items (absence allowed by disabled settings)`);
        }
        if (surface === "date-picker") {
            context = query('.modal:has(.date-time-picker-modal__date-input)').filter(el => !hidden(el));
            targets = context.flatMap(el => Array.from(el.querySelectorAll('.date-time-picker-modal__time-field, .date-time-picker-modal__time-input')));
            if (!targets.length) return report(surface, "UNVERIFIED", "Open TaskNotes date picker; if already open, inspect selector drift");
        }
        if (surface === "task-modal") {
            context = query('.modal.mod-tasknotes:has(.tn-task-modal__action-bar)').filter(el => !hidden(el));
            if (!context.length) return report(surface, "UNVERIFIED", "Open TaskNotes create/edit modal; inspect DOM if already open");
            const field = settings.modalFieldsConfig?.fields?.find(f => f.id === "time-estimate");
            if (field?.enabled !== false) return report(surface, "FAIL", "Runtime time-estimate must be disabled");
            targets = context.flatMap(el => Array.from(el.querySelectorAll('.tn-task-modal__time-estimate, [data-field-id="time-estimate"]')));
        }
        if (surface === "task-cards") {
            context = query('.tasknotes-plugin .task-card').filter(el => !hidden(el));
            if (!context.length) return report(surface, "UNVERIFIED", "Open a TaskNotes view with task cards; inspect new card DOM if already open");
            targets = context.flatMap(el => Array.from(el.querySelectorAll('.task-card__metadata-property--totalTrackedTime, .task-card__metadata-property--timeEstimate, [data-event-type="timeEntry"]')));
            if (!targets.length) return report(surface, "UNVERIFIED", "No tracking controls sampled; inspect a card with existing tracking data (do not create data for this test)");
        }
        const shown = targets.filter(el => !hidden(el));
        return report(surface, shown.length ? "FAIL" : "PASS", `${targets.length} targets; ${shown.length} visible (also visually inspect for renamed controls)`);
    };
    return JSON.stringify({probe: "tasknotes-css-v1", results: surfaces.map(inspect)});
})()
