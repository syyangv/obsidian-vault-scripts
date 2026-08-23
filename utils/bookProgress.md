---
modified_at: 2026-07-20
---
```dataviewjs
const actualCurrentFile = app.workspace.getActiveFile();
const bookName = actualCurrentFile.basename;
const metadata = dv.page(actualCurrentFile.path);
const totalPages = metadata.totalPage;
const startDate = metadata.开始日期;

if (!startDate) {
    dv.container.innerHTML = `<span>⚠️ 请在frontmatter中添加 开始日期 字段</span>`;
} else {
    const dailyNotes = dv.pages('"日记"')
        .where(p => {
            const folderMatch = p.file.folder.match(/^日记\/\d{4}$/);
            return folderMatch && p.file.day && p.file.day >= startDate;
        })
        .sort(p => p.file.day, 'asc');

    let progressData = [];

    for (let note of dailyNotes) {
        try {
            const content = await dv.io.load(note.file.path);
            const regex = new RegExp(`##\\s+(?:\\d+(?:\\.\\d+)?\\s+)?读书[\\s\\S]*?\\[\\[${bookName}\\]\\].*?完成页数::\\s*(\\d+)`);
            const match = regex.exec(content);
            if (match) {
                const pages = parseInt(match[1]);
                let dateStr;
                if (note.file.day.toFormat) {
                    dateStr = note.file.day.toFormat("yyyy-MM-dd");
                } else if (typeof note.file.day === 'string') {
                    dateStr = note.file.day.split('T')[0];
                } else {
                    dateStr = note.file.day.toString().split('T')[0];
                }
                progressData.push({ date: dateStr, pages: pages });
                if (totalPages && pages >= totalPages) break;
            }
        } catch (e) {}
    }

    if (progressData.length === 0) {
        dv.container.innerHTML = `<span>📝 还没有在日记中记录阅读进度</span>`;
    } else {
        const latestProgress = progressData[progressData.length - 1].pages;
        const currentInFrontmatter = metadata.完成页数 || 0;
        const isFinished = totalPages && latestProgress >= totalPages;

        if (latestProgress !== currentInFrontmatter) {
            const file = app.vault.getAbstractFileByPath(actualCurrentFile.path);
            await app.fileManager.processFrontMatter(file, (fm) => {
                fm.完成页数 = latestProgress;
            });
            const msgEl1 = dv.container.createEl('div');
            msgEl1.innerHTML = `<span>✅ <strong>已自动同步</strong>: 更新为第 ${latestProgress} 页 / ${totalPages || '?'} 页 ${isFinished ? '🎉 已完成!' : ''}</span>`;
        } else {
            const msgEl2 = dv.container.createEl('div');
            msgEl2.innerHTML = `<span><strong>当前进度</strong>: 第 ${latestProgress} 页 / ${totalPages || '?'} 页 ${isFinished ? '🎉 已完成!' : ''}</span>`;
        }

        // Create custom chart with proper date spacing
        const firstDate = new Date(progressData[0].date);
        const lastDate = new Date(progressData[progressData.length - 1].date);
        const totalDays = Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)) + 1;
        const maxPages = totalPages || latestProgress;

        const chartWidth = 800;
        const chartHeight = 400;
        const padding = { top: 40, right: 40, bottom: 120, left: 60 };
        const plotWidth = chartWidth - padding.left - padding.right;
        const plotHeight = chartHeight - padding.top - padding.bottom;

        // Generate SVG path
        let pathData = '';
        let points = [];

        for (let i = 0; i < progressData.length; i++) {
            const current = progressData[i];
            const currentDate = new Date(current.date);
            const daysSinceStart = Math.ceil((currentDate - firstDate) / (1000 * 60 * 60 * 24));

            const x = padding.left + (daysSinceStart / totalDays) * plotWidth;
            const y = padding.top + plotHeight - (current.pages / maxPages) * plotHeight;

            points.push({ x, y, date: current.date, pages: current.pages });

            if (i === 0) {
                pathData += `M ${x} ${y}`;
            } else {
                pathData += ` L ${x} ${y}`;
            }
        }

        // Check if reading spans multiple years
        const spansMultipleYears = firstDate.getFullYear() !== lastDate.getFullYear();

        // Generate x-axis labels - show all reading dates
        let xAxisLabels = '';
        for (let i = 0; i < progressData.length; i++) {
            const current = progressData[i];
            const currentDate = new Date(current.date);
            const daysSinceStart = Math.ceil((currentDate - firstDate) / (1000 * 60 * 60 * 24));
            const x = padding.left + (daysSinceStart / totalDays) * plotWidth;

            // Include year if spanning multiple years, or if it's the first label, or year changed
            let label;
            if (spansMultipleYears) {
                const prevDate = i > 0 ? new Date(progressData[i - 1].date) : null;
                const yearChanged = !prevDate || prevDate.getFullYear() !== currentDate.getFullYear();
                if (yearChanged || i === 0) {
                    label = current.date; // YYYY-MM-DD
                } else {
                    label = current.date.substring(5); // MM-DD
                }
            } else {
                label = current.date.substring(5); // MM-DD
            }

            // Add tick mark
            xAxisLabels += `<line x1="${x}" y1="${chartHeight - padding.bottom}" x2="${x}" y2="${chartHeight - padding.bottom + 5}" stroke="var(--text-muted)" stroke-width="1"/>`;
            // Add label with rotation (positioned higher to avoid cutoff)
            const labelY = chartHeight - padding.bottom + 15;
            xAxisLabels += `<text x="${x}" y="${labelY}" text-anchor="end" font-size="10" fill="var(--text-muted)" transform="rotate(-45, ${x}, ${labelY})">${label}</text>`;
        }

        // Generate y-axis labels
        let yAxisLabels = '';
        const ySteps = 5;
        for (let i = 0; i <= ySteps; i++) {
            const pages = Math.round((maxPages / ySteps) * i);
            const y = padding.top + plotHeight - (pages / maxPages) * plotHeight;
            yAxisLabels += `<text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="var(--text-muted)">${pages}</text>`;
            yAxisLabels += `<line x1="${padding.left}" y1="${y}" x2="${chartWidth - padding.right}" y2="${y}" stroke="var(--background-modifier-border)" stroke-dasharray="3,3" opacity="0.3"/>`;
        }

        // Generate year separator lines if spanning multiple years
        let yearSeparators = '';
        if (spansMultipleYears) {
            const years = new Set();
            for (let d = new Date(firstDate); d <= lastDate; d.setDate(d.getDate() + 1)) {
                years.add(d.getFullYear());
            }

            for (let year of Array.from(years).sort()) {
                // Find first day of this year that's after the start date
                const yearStart = new Date(year, 0, 1);
                if (yearStart <= firstDate) continue; // Skip if year started before reading
                if (yearStart > lastDate) break; // Stop if year starts after reading ended

                const daysSinceStart = Math.ceil((yearStart - firstDate) / (1000 * 60 * 60 * 24));
                const x = padding.left + (daysSinceStart / totalDays) * plotWidth;

                // Vertical line
                yearSeparators += `<line x1="${x}" y1="${padding.top}" x2="${x}" y2="${chartHeight - padding.bottom}" stroke="var(--text-accent)" stroke-width="2" stroke-dasharray="8,4" opacity="0.4"/>`;
                // Year label at top
                yearSeparators += `<text x="${x + 5}" y="${padding.top + 15}" font-size="12" font-weight="600" fill="var(--text-accent)" opacity="0.6">${year}</text>`;
            }
        }

        const html = `
<div style="width: 100%; overflow-x: auto; padding: 20px 0;">
    <svg width="${chartWidth}" height="${chartHeight}" style="font-family: var(--font-interface);">
        <!-- Title -->
        <text x="${chartWidth / 2}" y="20" text-anchor="middle" font-size="16" font-weight="600" fill="var(--text-normal)">${bookName} 阅读进度</text>

        <!-- Grid and labels -->
        ${yAxisLabels}
        ${xAxisLabels}

        <!-- Year separators -->
        ${yearSeparators}

        <!-- Target line -->
        ${totalPages ? `<line x1="${padding.left}" y1="${padding.top}" x2="${chartWidth - padding.right}" y2="${padding.top}" stroke="#ffd4e5" stroke-width="2" stroke-dasharray="5,5" opacity="0.6"/>` : ''}

        <!-- Progress line -->
        <path d="${pathData}" fill="none" stroke="#d4c5f9" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>

        <!-- Data points -->
        ${points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="5" fill="#9f7aea" stroke="#ffffff" stroke-width="2">
            <title>${p.date}: ${p.pages}页</title>
        </circle>`).join('')}

        <!-- Axes -->
        <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${chartHeight - padding.bottom}" stroke="var(--text-muted)" stroke-width="1"/>
        <line x1="${padding.left}" y1="${chartHeight - padding.bottom}" x2="${chartWidth - padding.right}" y2="${chartHeight - padding.bottom}" stroke="var(--text-muted)" stroke-width="1"/>

        <!-- Axis labels -->
        <text x="${chartWidth / 2}" y="${chartHeight - 5}" text-anchor="middle" font-size="12" fill="var(--text-muted)">日期</text>
        <text x="20" y="${chartHeight / 2}" text-anchor="middle" font-size="12" fill="var(--text-muted)" transform="rotate(-90, 20, ${chartHeight / 2})">页数</text>
    </svg>
</div>`;

        const container = dv.container.createEl('div');
        container.innerHTML = html;
    }
}
```