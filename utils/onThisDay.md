---
modified_at: 2026-06-06
---
```dataviewjs
(async () => {
    // Hide this embed unless there's content for today.
    // JS can't reach `.internal-embed` during render (detached fragment → closest() is null),
    // so we mark the reachable dv.container `.otd-empty` and let a CSS :has() rule (applied
    // post-attach) hide the wrapper. Marker is removed below only when content renders.
    if (!document.getElementById('otd-hide-style')) {
        const st = document.createElement('style');
        st.id = 'otd-hide-style';
        st.textContent = '.internal-embed[src*="onThisDay"]:has(.otd-empty){display:none!important;}';
        document.head.appendChild(st);
    }
    dv.container.classList.add('otd-empty');

    // ===== PREVENT MULTIPLE SIMULTANEOUS EXECUTIONS =====
    const activeFile = app.workspace.getActiveFile();

    if (!activeFile) {
        dv.paragraph("⚠️ No active file detected.");
        return;
    }

    const containerId = 'on-this-day-' + activeFile.path;

    // If already running, skip this execution
    if (window[containerId + '_running']) {
        return;
    }

    // Set debounce timeout - only execute after 500ms of inactivity
    if (window[containerId + '_timeout']) {
        clearTimeout(window[containerId + '_timeout']);
    }

    await new Promise(resolve => {
        window[containerId + '_timeout'] = setTimeout(resolve, 500);
    });

    window[containerId + '_running'] = true;

try {
    const diaryFolder = "日记";

    // Extract date from current filename (YYYY-MM-DD)
    const filename = activeFile.basename;
    const dateMatch = filename.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (!dateMatch) {
        dv.paragraph("⚠️ Not a daily note (expected format: YYYY-MM-DD)");
        return;
    }

    const currentYear = parseInt(dateMatch[1]);
    const month = dateMatch[2];
    const day = dateMatch[3];
    const targetDate = `${month}-${day}`;
    const cacheKey = `onThisDay_${targetDate}_${currentYear}`;

    // Check cache first (with version check)
    const cacheVersion = '7'; // Increment when HTML structure changes
    if (window[cacheKey] &&
        window[cacheKey].version === cacheVersion &&
        window[cacheKey].timestamp > Date.now() - 60000) {
        // Use cached data if less than 1 minute old and correct version
        const cached = window[cacheKey].data;
        if (cached.length === 0) {
            return;
        }

        // Render cached data immediately (HTML includes header and frame)
        dv.container.classList.remove('otd-empty');
        const container = dv.container;
        const wrapper = container.createDiv();
        wrapper.innerHTML = window[cacheKey].html;
        return;
    }

    // Build list of specific file paths to check (only years before current year)
    // Check up to 10 years back, or from 2020, whichever is more recent
    const startYear = Math.max(2020, currentYear - 10);
    const filesToCheck = [];
    for (let year = currentYear - 1; year >= startYear; year--) {
        filesToCheck.push(`${diaryFolder}/${year}/${year}-${month}-${day}.md`);
    }

    const eventsFromPreviousYears = [];

    // Check each specific file directly
    for (const filePath of filesToCheck) {
        const note = app.vault.getAbstractFileByPath(filePath);

        // Skip if file doesn't exist
        if (!note) continue;

        const noteMatch = note.basename.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!noteMatch) continue;

        const noteYear = parseInt(noteMatch[1]);

        // Read the note content
        try {
            const content = await app.vault.read(note);

            // Extract Event section content
            // Look for "# 3 Event" or any heading that contains "Event"
            const eventSectionRegex = /^#+ .*Event.*$/mi;
            const eventMatch = content.match(eventSectionRegex);

            if (!eventMatch) continue;

            // Find the position of the Event heading
            const eventHeadingPos = content.indexOf(eventMatch[0]);

            // Get content after the Event heading
            const afterEventContent = content.substring(eventHeadingPos + eventMatch[0].length);

            // Find the first subsection (##) or next top-level heading (#)
            const nextHeadingMatch = afterEventContent.match(/^##? /m);

            let eventContent;
            if (nextHeadingMatch) {
                const nextHeadingPos = afterEventContent.indexOf(nextHeadingMatch[0]);
                eventContent = afterEventContent.substring(0, nextHeadingPos).trim();
            } else {
                eventContent = afterEventContent.trim();
            }

            // Check if there's actual content
            if (eventContent.length > 0) {
                eventsFromPreviousYears.push({
                    year: noteYear,
                    content: eventContent,
                    notePath: note.basename // Use basename for internal links
                });
            }
        } catch (error) {
            console.warn(`Failed to read note ${note.path}:`, error);
        }
    }

    // Display results
    if (eventsFromPreviousYears.length === 0) {
        // Cache empty result to avoid repeated lookups
        window[cacheKey] = {
            version: '7',
            timestamp: Date.now(),
            data: [],
            html: ''
        };
        return; // Don't show anything if no events found
    }

    // Sort by year (most recent first)
    eventsFromPreviousYears.sort((a, b) => b.year - a.year);

    // Helper function to process markdown links in content
    function processMarkdownLinks(text) {
        if (!text) return '';

        // Convert wikilinks [[link]] or [[link|display]] to HTML
        text = text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, link, display) => {
            const displayText = display || link;
            return `<a href="${link}" class="internal-link">${displayText}</a>`;
        });

        // Convert markdown links [text](url) to HTML
        text = text.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, (match, text, url) => {
            return `<a href="${url}" class="external-link">${text}</a>`;
        });

        return text;
    }

    // Split events into two columns (alternating distribution)
    let leftColumn = [];
    let rightColumn = [];

    eventsFromPreviousYears.forEach((event, index) => {
        if (index % 2 === 0) {
            leftColumn.push(event);
        } else {
            rightColumn.push(event);
        }
    });

    // Build HTML with flame lily inspired wavy frame
    const h = [];

    // Container with wavy border inspired by flame lily petals
    h.push(`<div style="
        position: relative;
        padding: 28px;
        margin: 20px 0;
        border-radius: 16px;
        background:
            radial-gradient(ellipse at top, rgba(232, 178, 153, 0.08), transparent 60%),
            radial-gradient(ellipse at bottom, rgba(107, 142, 85, 0.06), transparent 60%),
            rgba(255, 253, 250, 0.4);
        box-shadow:
            0 3px 12px rgba(200, 120, 85, 0.1);
    ">`);

    // Wavy border overlay - top edge
    h.push(`
        <div style="
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: repeating-linear-gradient(90deg,
                rgba(200, 120, 85, 0.4) 0px,
                rgba(217, 145, 121, 0.5) 8px,
                rgba(232, 178, 153, 0.4) 16px,
                rgba(217, 145, 121, 0.5) 24px,
                rgba(200, 120, 85, 0.4) 32px);
            mask-image: radial-gradient(circle at 50% 0%, black 40%, transparent 70%);
        "></div>
    `);

    // Wavy border overlay - bottom edge
    h.push(`
        <div style="
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: repeating-linear-gradient(90deg,
                rgba(107, 142, 85, 0.4) 0px,
                rgba(126, 158, 105, 0.5) 8px,
                rgba(107, 142, 85, 0.4) 16px,
                rgba(126, 158, 105, 0.5) 24px,
                rgba(107, 142, 85, 0.4) 32px);
            mask-image: radial-gradient(circle at 50% 100%, black 40%, transparent 70%);
        "></div>
    `);

    // Wavy border overlay - left edge
    h.push(`
        <div style="
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 3px;
            background: repeating-linear-gradient(0deg,
                rgba(107, 142, 85, 0.4) 0px,
                rgba(126, 158, 105, 0.5) 8px,
                rgba(107, 142, 85, 0.4) 16px,
                rgba(126, 158, 105, 0.5) 24px,
                rgba(107, 142, 85, 0.4) 32px);
            mask-image: radial-gradient(circle at 0% 50%, black 40%, transparent 70%);
        "></div>
    `);

    // Wavy border overlay - right edge
    h.push(`
        <div style="
            position: absolute;
            right: 0;
            top: 0;
            bottom: 0;
            width: 3px;
            background: repeating-linear-gradient(0deg,
                rgba(200, 120, 85, 0.4) 0px,
                rgba(217, 145, 121, 0.5) 8px,
                rgba(232, 178, 153, 0.4) 16px,
                rgba(217, 145, 121, 0.5) 24px,
                rgba(200, 120, 85, 0.4) 32px);
            mask-image: radial-gradient(circle at 100% 50%, black 40%, transparent 70%);
        "></div>
    `);

    // Curled petal accent - top left with wavy edges
    h.push(`
        <div style="
            position: absolute;
            top: -15px;
            left: 8px;
            width: 45px;
            height: 70px;
            background: linear-gradient(155deg,
                rgba(200, 120, 85, 0.6) 0%,
                rgba(217, 145, 121, 0.7) 30%,
                rgba(232, 178, 153, 0.5) 60%,
                rgba(245, 210, 190, 0.3) 100%);
            clip-path: path('M 22,0 Q 15,8 13,18 C 11,25 10,35 8,42 Q 7,48 6,55 C 5,60 7,65 12,68 Q 18,70 25,68 C 30,66 33,62 35,56 Q 37,50 38,42 C 39,35 40,28 39,20 Q 38,10 32,4 Q 27,0 22,0 Z');
            transform: rotate(-15deg) scaleX(-1);
            transform-origin: bottom center;
            opacity: 0.75;
            filter: blur(0.4px);
        "></div>
    `);

    // Curled petal accent - top right
    h.push(`
        <div style="
            position: absolute;
            top: -15px;
            right: 8px;
            width: 45px;
            height: 70px;
            background: linear-gradient(205deg,
                rgba(200, 120, 85, 0.6) 0%,
                rgba(217, 145, 121, 0.7) 30%,
                rgba(232, 178, 153, 0.5) 60%,
                rgba(245, 210, 190, 0.3) 100%);
            clip-path: path('M 22,0 Q 15,8 13,18 C 11,25 10,35 8,42 Q 7,48 6,55 C 5,60 7,65 12,68 Q 18,70 25,68 C 30,66 33,62 35,56 Q 37,50 38,42 C 39,35 40,28 39,20 Q 38,10 32,4 Q 27,0 22,0 Z');
            transform: rotate(15deg);
            transform-origin: bottom center;
            opacity: 0.75;
            filter: blur(0.4px);
        "></div>
    `);

    // Green stem accent - left side
    h.push(`
        <div style="
            position: absolute;
            left: -8px;
            top: 50%;
            width: 20px;
            height: 90px;
            background: linear-gradient(180deg,
                rgba(107, 142, 85, 0.5) 0%,
                rgba(126, 158, 105, 0.6) 50%,
                rgba(107, 142, 85, 0.4) 100%);
            clip-path: path('M 10,0 Q 5,20 4,45 Q 5,70 10,90 Q 15,70 16,45 Q 15,20 10,0 Z');
            transform: translateY(-50%);
            opacity: 0.7;
            filter: blur(0.3px);
        "></div>
    `);

    // Green stem accent - right side
    h.push(`
        <div style="
            position: absolute;
            right: -8px;
            top: 50%;
            width: 20px;
            height: 90px;
            background: linear-gradient(180deg,
                rgba(107, 142, 85, 0.5) 0%,
                rgba(126, 158, 105, 0.6) 50%,
                rgba(107, 142, 85, 0.4) 100%);
            clip-path: path('M 10,0 Q 5,20 4,45 Q 5,70 10,90 Q 15,70 16,45 Q 15,20 10,0 Z');
            transform: translateY(-50%);
            opacity: 0.7;
            filter: blur(0.3px);
        "></div>
    `);

    // Elegant header with wavy underline
    h.push(`<div style="
        text-align: center;
        margin: 0 0 16px 0;
        padding-bottom: 14px;
        position: relative;
    ">
        <div style="
            display: inline-block;
            background: linear-gradient(90deg,
                rgba(107, 142, 85, 0.8) 0%,
                rgba(200, 120, 85, 0.85) 50%,
                rgba(107, 142, 85, 0.8) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            font-size: 1.2em;
            font-weight: 600;
            letter-spacing: 0.5px;
        ">
            📅 往年今日 (${month}月${day}日)
        </div>
        <div style="
            position: absolute;
            bottom: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 80%;
            height: 2px;
            background: linear-gradient(90deg,
                transparent 0%,
                rgba(107, 142, 85, 0.3) 20%,
                rgba(200, 120, 85, 0.4) 50%,
                rgba(107, 142, 85, 0.3) 80%,
                transparent 100%);
        "></div>
    </div>`);

    // Two-column grid
    h.push('<div style="display: grid; grid-template-columns: 1fr 3px 1fr; gap: 20px;">');

    // Left column
    h.push('<div>');
    for (let event of leftColumn) {
        const yearsAgo = currentYear - event.year;
        const yearLabel = yearsAgo === 1 ? '去年' : `${yearsAgo}年前`;
        const processedContent = processMarkdownLinks(event.content);

        h.push(`<div style="margin: 2px 0 4px 0; padding-bottom: 6px; border-bottom: 2px dashed rgba(180, 150, 220, 0.4);">`);
        h.push(`<div style="flex: 1; font-size: 0.9375rem; font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Source Han Sans SC', 'Segoe UI', Arial, sans-serif;">`);
        h.push(`<p style="margin: 0;"><a href="${event.notePath}" class="internal-link" style="color: var(--text-accent); font-weight: bold; text-decoration: none;">${event.year}年 (${yearLabel})</a></p>`);
        h.push(`<div style="margin-top: 4px; line-height: 1.5;">${processedContent}</div>`);
        h.push(`</div>`);
        h.push(`</div>`);
    }
    h.push('</div>');

    // Middle separator
    h.push(`<div style="background: linear-gradient(to bottom,
        rgba(180, 150, 220, 0.3) 0%,
        rgba(150, 180, 220, 0.3) 25%,
        rgba(220, 180, 150, 0.3) 50%,
        rgba(150, 180, 220, 0.3) 75%,
        rgba(180, 150, 220, 0.3) 100%);
        width: 3px;
        border-radius: 2px;
        box-shadow: 0 0 8px rgba(180, 150, 220, 0.2);"></div>`);

    // Right column
    h.push('<div>');
    for (let event of rightColumn) {
        const yearsAgo = currentYear - event.year;
        const yearLabel = yearsAgo === 1 ? '去年' : `${yearsAgo}年前`;
        const processedContent = processMarkdownLinks(event.content);

        h.push(`<div style="margin: 2px 0 4px 0; padding-bottom: 6px; border-bottom: 2px dashed rgba(180, 150, 220, 0.4);">`);
        h.push(`<div style="flex: 1; font-size: 0.9375rem; font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Source Han Sans SC', 'Segoe UI', Arial, sans-serif;">`);
        h.push(`<p style="margin: 0;"><a href="${event.notePath}" class="internal-link" style="color: var(--text-accent); font-weight: bold; text-decoration: none;">${event.year}年 (${yearLabel})</a></p>`);
        h.push(`<div style="margin-top: 4px; line-height: 1.5;">${processedContent}</div>`);
        h.push(`</div>`);
        h.push(`</div>`);
    }
    h.push('</div>');

    h.push('</div>'); // Close grid
    h.push('</div>'); // Close container frame

    const htmlOutput = h.join('');

    // Cache the results with version
    window[cacheKey] = {
        version: '7',
        timestamp: Date.now(),
        data: eventsFromPreviousYears,
        html: htmlOutput
    };

    // Render the HTML (using container to render raw HTML)
    dv.container.classList.remove('otd-empty');
    const container = dv.container;
    const wrapper = container.createDiv();
    wrapper.innerHTML = htmlOutput;

} catch (error) {
    console.error('On This Day Error:', error);
    dv.paragraph('⚠️ Error: ' + error.message);
} finally {
    // Always clear running flag
    window[containerId + '_running'] = false;
}
})();
```
