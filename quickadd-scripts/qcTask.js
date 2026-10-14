module.exports = async (params) => {
    const { app, quickAddApi } = params;

    const taskText = await quickAddApi.inputPrompt("Task description");
    if (!taskText) return;

    // Only the three pools shown in 待办事项/待办事项.md may use inline capture.
    const syncPools = ["#Project/epaper", "#Project/Structured", "#Project/系统"];
    const inlineTags = syncPools.map(value => ({ label: `⚡ ${value.slice(1)}`, value }));
    const projectTags = app.vault.getFiles()
        .filter(f => f.parent?.path === "Projects" && f.extension === "md" && !f.name.endsWith(".excalidraw.md") && f.name !== "Projects.md")
        .map(f => ({ label: `📦 Project/${f.basename}`, value: `#Project/${f.basename}`, basename: f.basename }))
        .filter(t => !syncPools.includes(t.value))
        .sort((a, b) => a.value.localeCompare(b.value));
    const tagOptions = [...inlineTags, ...projectTags];

    const selectedTag = await quickAddApi.suggester(
        tagOptions.map(t => t.label),
        tagOptions.map(t => t.value)
    );
    if (selectedTag === null || selectedTag === undefined) return;

    const isSyncPool = syncPools.includes(selectedTag);
    const matchedProjectName = projectTags.find(t => t.value === selectedTag)?.basename;
    if (!isSyncPool && !matchedProjectName) return;

    // Helper to format date in local timezone (YYYY-MM-DD)
    const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    // Ask about scheduled date (use local timezone, not UTC)
    const today = new Date();
    const todayStr = formatDate(today);

    // Calculate tomorrow
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatDate(tomorrow);

    // Calculate next Monday
    const nextMonday = new Date(today);
    const daysUntilMonday = (8 - today.getDay()) % 7 || 7; // If today is Monday, go to next Monday
    nextMonday.setDate(today.getDate() + daysUntilMonday);
    const nextMondayStr = formatDate(nextMonday);

    // Calculate first of next month
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const nextMonthStr = formatDate(nextMonth);

    const scheduledDateChoice = await quickAddApi.suggester(
        [
            "No scheduled date",
            `Today (${todayStr})`,
            `Tomorrow (${tomorrowStr})`,
            `Next Monday (${nextMondayStr})`,
            `Next month (${nextMonthStr})`,
            "Pick a date"
        ],
        ["none", "today", "tomorrow", "nextmonday", "nextmonth", "pick"]
    );
    if (scheduledDateChoice === null || scheduledDateChoice === undefined) return;

    let scheduledDateStr = "";

    if (scheduledDateChoice === "today") {
        scheduledDateStr = todayStr;
    } else if (scheduledDateChoice === "tomorrow") {
        scheduledDateStr = tomorrowStr;
    } else if (scheduledDateChoice === "nextmonday") {
        scheduledDateStr = nextMondayStr;
    } else if (scheduledDateChoice === "nextmonth") {
        scheduledDateStr = nextMonthStr;
    } else if (scheduledDateChoice === "pick") {
        const dateInput = await quickAddApi.inputPrompt("Scheduled date (YYYY-MM-DD)");
        if (dateInput === null || dateInput === undefined) return;
        if (dateInput && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
            scheduledDateStr = dateInput;
        } else if (dateInput) {
            new Notice("Invalid date format, skipping scheduled date");
        }
    }

    if (!isSyncPool) {
        // --- Create Standalone TaskNote in TaskNotes/Tasks/ ---
        const taskFolder = "TaskNotes/Tasks";
        if (!app.vault.getAbstractFileByPath(taskFolder)) {
            await app.vault.createFolder(taskFolder);
        }

        const getTimezoneOffsetString = (d) => {
            const offset = -d.getTimezoneOffset();
            const sign = offset >= 0 ? "+" : "-";
            const pad = (num) => String(Math.floor(Math.abs(num))).padStart(2, "0");
            return `${sign}${pad(offset / 60)}:${pad(offset % 60)}`;
        };

        const now = new Date();
        const isoTimestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}.000${getTimezoneOffsetString(now)}`;

        // Sanitize title for filename
        const safeBase = taskText.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
        let fileName = safeBase || "Untitled Task";
        let targetPath = `${taskFolder}/${fileName}.md`;
        let counter = 1;
        while (app.vault.getAbstractFileByPath(targetPath)) {
            fileName = `${safeBase} ${counter}`;
            targetPath = `${taskFolder}/${fileName}.md`;
            counter++;
        }

        const frontmatterLines = [
            "---",
            `title: ${JSON.stringify(taskText)}`,
            "status: open",
            "priority: normal"
        ];

        if (scheduledDateStr) {
            frontmatterLines.push(`scheduled: ${scheduledDateStr}`);
        }

        frontmatterLines.push("projects:");
        frontmatterLines.push(`  - "[[${matchedProjectName}]]"`);
        frontmatterLines.push(`dateCreated: ${isoTimestamp}`);
        frontmatterLines.push(`dateModified: ${isoTimestamp}`);
        frontmatterLines.push("tags:");
        frontmatterLines.push("  - tasknotes");
        frontmatterLines.push(`modified_at: ${todayStr}`);
        frontmatterLines.push("---");
        frontmatterLines.push("");
        frontmatterLines.push(taskText + ".");
        frontmatterLines.push("");

        const fileContent = frontmatterLines.join("\n");
        await app.vault.create(targetPath, fileContent);
        new Notice("TaskNote created: " + fileName);
        return;
    }

    // Protected sync pools retain their existing Quick Capture destination and format.
    const tagPart = " " + selectedTag;
    const scheduledPart = scheduledDateStr ? " ⏳ " + scheduledDateStr : "";
    const taskLine = "- [ ] " + taskText + scheduledPart + " ✍️ " + todayStr + tagPart;

    const file = app.vault.getAbstractFileByPath("待办事项/Quick Capture.md")
        || app.metadataCache.getFirstLinkpathDest("Quick Capture", "");
    if (!file) {
        new Notice("Quick Capture.md not found");
        return;
    }

    let content = await app.vault.read(file);

    // Try to insert after the quick_capture_controls embed.
    let replaced = content.replace(
        /(!\[\[quick_capture_controls\]\]\n)/,
        "$1" + taskLine + "\n"
    );

    // Fall back to inserting after the BUTTON[add_task] line.
    if (replaced === content) {
        const markerText = "BUTTON[add_task]";
        const markerIndex = content.indexOf(markerText);
        if (markerIndex !== -1) {
            const lineEnd = content.indexOf("\n", markerIndex);
            if (lineEnd !== -1) {
                replaced = content.slice(0, lineEnd + 1) + taskLine + "\n" + content.slice(lineEnd + 1);
            }
        }
    }

    if (replaced === content) {
        const fmEnd = content.indexOf("\n---\n", 1);
        if (fmEnd !== -1) {
            const pos = fmEnd + 5;
            content = content.slice(0, pos) + taskLine + "\n" + content.slice(pos);
        } else {
            content = taskLine + "\n" + content;
        }
    } else {
        content = replaced;
    }

    await app.vault.modify(file, content);
    new Notice("Task added to Quick Capture");
};
