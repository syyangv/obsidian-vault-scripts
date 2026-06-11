module.exports = async (params) => {
    const { app, quickAddApi } = params;

    const taskText = await quickAddApi.inputPrompt("Task description");
    if (!taskText) return;

    const tagOptions = [
        { label: "No tag", value: "" },
        { label: "📺 TV/Watch", value: "#📺" },
        { label: "🎤 Karaoke", value: "#🎤" },
        { label: "起起", value: "#起起" },
        { label: "Project/日常任务", value: "#Project/日常任务" },
        { label: "Project/生活整理", value: "#Project/生活整理" },
        { label: "Project/Styling", value: "#Project/Styling" },
        { label: "Project/CS", value: "#Project/CS" },
        { label: "Project/LLM", value: "#Project/LLM" },
    ];

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

    // Build task line
    const tagPart = selectedTag ? " " + selectedTag : "";
    const startPart = startDateStr ? " 🛫 " + startDateStr : "";
    const taskLine = "- [ ] " + taskText + startPart + " ✍️ " + todayStr + tagPart;

    const file = app.vault.getAbstractFileByPath("Quick Capture.md");
    if (!file) {
        new Notice("Quick Capture.md not found");
        return;
    }

    let content = await app.vault.read(file);
    
    // Try to insert after the dataviewjs block (Quick Capture.md has hide/archive buttons there)
    let replaced = content.replace(
        /(```dataviewjs[\s\S]*?```\n)/,
        "$1" + taskLine + "\n"
    );

    // Fall back to inserting after the BUTTON[add_task] line (daily notes)
    if (replaced === content) {
        replaced = content.replace(
            /(`BUTTON\[add_task\]`\n+)/,
            "$1" + taskLine + "\n"
        );
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
