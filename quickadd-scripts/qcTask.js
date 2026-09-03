module.exports = async (params) => {
    const { app, quickAddApi } = params;

    const taskText = await quickAddApi.inputPrompt("Task description");
    if (!taskText) return;

    const staticTags = [
        { label: "No tag", value: "" },
        { label: "📺 TV/Watch", value: "#📺" },
        { label: "🎤 Karaoke", value: "#🎤" },
        { label: "起起", value: "#起起" },
    ];

    const allTags = Object.keys(app.metadataCache.getTags());
    const projectTags = allTags
        .filter(t => t.startsWith("#Project/"))
        .sort((a, b) => a.localeCompare(b))
        .map(t => ({ label: t.slice(1), value: t }));

    const tagOptions = [...staticTags, ...projectTags];

    const selectedTag = await quickAddApi.suggester(
        tagOptions.map(t => t.label),
        tagOptions.map(t => t.value)
    );
    if (selectedTag === undefined) return;

    // Helper to format date in local timezone (YYYY-MM-DD)
    const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    // Ask about start date (use local timezone, not UTC)
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

    const startDateChoice = await quickAddApi.suggester(
        [
            "No start date",
            `Today (${todayStr})`,
            `Tomorrow (${tomorrowStr})`,
            `Next Monday (${nextMondayStr})`,
            `Next month (${nextMonthStr})`,
            "Pick a date"
        ],
        ["none", "today", "tomorrow", "nextmonday", "nextmonth", "pick"]
    );
    if (startDateChoice === undefined) return;

    let startDateStr = "";

    if (startDateChoice === "today") {
        startDateStr = todayStr;
    } else if (startDateChoice === "tomorrow") {
        startDateStr = tomorrowStr;
    } else if (startDateChoice === "nextmonday") {
        startDateStr = nextMondayStr;
    } else if (startDateChoice === "nextmonth") {
        startDateStr = nextMonthStr;
    } else if (startDateChoice === "pick") {
        const dateInput = await quickAddApi.inputPrompt("Start date (YYYY-MM-DD)");
        if (dateInput && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
            startDateStr = dateInput;
        } else if (dateInput) {
            new Notice("Invalid date format, skipping start date");
        }
    }

    // Auto-structured-sync pools (epaper, Structured, 系统) must always remain inline
    const syncPools = ["#Project/epaper", "#Project/Structured", "#Project/系统"];
    const isSyncPool = syncPools.includes(selectedTag);

    // Check if the selected tag matches an existing project note in Projects/
    let matchedProjectName = "";
    if (selectedTag.startsWith("#Project/")) {
        const projName = selectedTag.replace("#Project/", "");
        const projectFile = app.vault.getAbstractFileByPath(`Projects/${projName}.md`);
        if (projectFile) {
            matchedProjectName = projName;
        }
    }

 let taskMode = "inline";
 let taskDescription = taskText;
    if (matchedProjectName && !isSyncPool) {
        // Offer choice between Project checkbox only or Project checkbox + TaskNote
        const modeChoice = await quickAddApi.suggester(
            [
                "⚡ Project checkbox (Project/" + matchedProjectName + ")",
                "📦 Project checkbox + TaskNote (" + taskText.slice(0, 30) + "...)",
            ],
            ["inline", "tasknote"]
        );
        if (modeChoice === undefined) return;
        taskMode = modeChoice;
    }

    if (taskMode === "tasknote" && matchedProjectName) {
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

        if (startDateStr) {
            frontmatterLines.push(`scheduled: ${startDateStr}`);
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
 taskDescription = "[[TaskNotes/Tasks/" + targetPath.replace(/\.md$/, "") + "|" + taskText + "]]"
 new Notice("TaskNote created: " + fileName);
    }

    // --- Project-tagged inline tasks belong in Projects/<project>.md. ---
    // No-project and protected sync-pool captures retain the Quick Capture
    // fallback below.
    const tagPart = selectedTag ? " " + selectedTag : "";
    const startPart = startDateStr ? " 🛫 " + startDateStr : "";
 const createdPart = matchedProjectName ? " ➕ " + todayStr : "";
 const taskLine = "- [ ] " + taskDescription + startPart + " ✍️ " + todayStr + createdPart + tagPart;

    const projectFile = matchedProjectName
        ? app.vault.getAbstractFileByPath("Projects/" + matchedProjectName + ".md")
        : null;
    const file = projectFile
        || app.vault.getAbstractFileByPath("待办事项/Quick Capture.md")
        || app.metadataCache.getFirstLinkpathDest("Quick Capture", "");
    if (!file) {
        new Notice("Quick Capture.md not found");
        return;
    }

    let content = await app.vault.read(file);

    if (projectFile) {
        const tasksHeading = "\n## Tasks";
        const headingIndex = content.indexOf(tasksHeading);
        if (headingIndex !== -1) {
            content = content.slice(0, headingIndex + 1) + taskLine + "\n" + content.slice(headingIndex + 1);
        } else {
            content = content.trimEnd() + "\n\n" + taskLine + "\n";
        }
        await app.vault.modify(file, content);
        new Notice("Task added to Projects/" + matchedProjectName);
        return;
    }

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
