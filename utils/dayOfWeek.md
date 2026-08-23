---
modified_at: 2026-07-19
---
```dataviewjs
(async () => {
    // Get the actual current file (not the template)
    const actualCurrentFile = app.workspace.getActiveFile();
    if (!actualCurrentFile) return;

    const noteTitle = actualCurrentFile.name;

    // Extract date in YYYY-MM-DD format
    const dateMatch = noteTitle.match(/(\d{4})-(\d{2})-(\d{2})/);

    if (!dateMatch) {
        dv.paragraph(`⚠️ No date found in "${noteTitle}". Please use YYYY-MM-DD format.`);
    } else {
        const year = parseInt(dateMatch[1]);
        const month = parseInt(dateMatch[2]) - 1; // JavaScript months are 0-indexed
        const day = parseInt(dateMatch[3]);

        // Create the date object
        const date = new Date(year, month, day);

        // Chinese day names
        const chineseDayNames = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
        const chineseDay = chineseDayNames[date.getDay()];

        // Display just the Chinese day
        dv.paragraph(chineseDay);

        // Update frontmatter only if day value is different
        const file = actualCurrentFile;
        const metadata = app.metadataCache.getFileCache(file);
        const currentDayValue = metadata?.frontmatter?.day;

        // Only update if the day is different or missing
        if (currentDayValue !== chineseDay) {
            await app.fileManager.processFrontMatter(file, (fm) => {
                fm.day = chineseDay;
            });
        }
    }
})();
```
