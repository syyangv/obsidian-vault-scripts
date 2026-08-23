---
modified_at: 2026-07-20
---
```dataviewjs
(async () => {
    // ===== PREVENT MULTIPLE SIMULTANEOUS EXECUTIONS =====
    const actualCurrentFile = app.workspace.getActiveFile();
    if (!actualCurrentFile) return;

    const containerId = 'tv-progress-' + actualCurrentFile.path;

    // If already running, skip this execution
    if (window[containerId + '_running']) return;

    // Set debounce timeout - only execute after 500ms of inactivity
    if (window[containerId + '_timeout']) {
        clearTimeout(window[containerId + '_timeout']);
    }

    await new Promise(resolve => {
        window[containerId + '_timeout'] = setTimeout(resolve, 500);
    });

    // Skip rendering if user is actively editing an input field
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
        return;
    }

    window[containerId + '_running'] = true;

try {
    const showName = actualCurrentFile.basename;
    const metadata = dv.page(actualCurrentFile.path);
    const totalEpisodes = metadata.总集数;
    const startDate = metadata.开始看日期;

    if (!startDate) {
    dv.paragraph("⚠️ 请在frontmatter中添加 `开始看日期` 字段");
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
            const regex = new RegExp(`##\\s+(?:\\d+(?:\\.\\d+)?\\s+)?看电视[\\s\\S]*?\\[\\[${showName}\\]\\].*?看过集数::\\s*(\\d+)`);
            const match = regex.exec(content);
            if (match) {
                const episodes = parseInt(match[1]);
                let dateStr;
                if (note.file.day.toFormat) {
                    dateStr = note.file.day.toFormat("yyyy-MM-dd");
                } else if (typeof note.file.day === 'string') {
                    dateStr = note.file.day.split('T')[0];
                } else {
                    dateStr = note.file.day.toString().split('T')[0];
                }
                progressData.push({ date: dateStr, episodes: episodes });
                if (totalEpisodes && episodes >= totalEpisodes) break;
            }
        } catch (e) {}
    }

    if (progressData.length === 0) {
        dv.paragraph("📝 还没有在日记中记录观看进度");
    } else {
        const latestProgress = progressData[progressData.length - 1].episodes;
        const currentInFrontmatter = metadata.看过集数 || 0;
        const isFinished = totalEpisodes && latestProgress >= totalEpisodes;
        const isAbandoned = metadata.file.tags && metadata.file.tags.includes('#弃剧');

        dv.paragraph(`**当前进度**: 第 ${latestProgress} 集 / ${totalEpisodes || '?'} 集 ${isFinished ? '🎉 已完成!' : ''}`);

        // Create custom timeline chart
        const firstDate = new Date(progressData[0].date);
        const lastProgressDate = new Date(progressData[progressData.length - 1].date);
        const today = new Date();
        // Extend to today if show isn't finished/abandoned, otherwise end at last progress
        const lastDate = (isFinished || isAbandoned) ? lastProgressDate : (today > lastProgressDate ? today : lastProgressDate);
        const totalDays = Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)) + 1;
        const maxEpisodes = totalEpisodes || latestProgress;

        const chartWidth = 800;
        const chartHeight = 400;
        const padding = { top: 40, right: 40, bottom: 120, left: 60 };
        const plotWidth = chartWidth - padding.left - padding.right;
        const plotHeight = chartHeight - padding.top - padding.bottom;

        // Check if viewing spans multiple years
        const spansMultipleYears = firstDate.getFullYear() !== lastDate.getFullYear();

        // Generate bars for each viewing session
        let bars = '';
        let xAxisLabels = '';

        for (let i = 0; i < progressData.length; i++) {
            const current = progressData[i];
            const previous = i > 0 ? progressData[i - 1] : { episodes: 0 };
            const currentDate = new Date(current.date);

            // Calculate bar start and width based on time span
            const daysSinceStart = Math.ceil((currentDate - firstDate) / (1000 * 60 * 60 * 24));

            // Calculate how long until next viewing (or to today if last)
            const nextDate = i < progressData.length - 1
                ? new Date(progressData[i + 1].date)
                : ((isFinished || isAbandoned) ? currentDate : today);
            const daysToNext = Math.max(1, Math.ceil((nextDate - currentDate) / (1000 * 60 * 60 * 24)));

            const xStart = padding.left + (daysSinceStart / totalDays) * plotWidth;
            const barWidth = (daysToNext / totalDays) * plotWidth;

            const yBottom = padding.top + plotHeight - (previous.episodes / maxEpisodes) * plotHeight;
            const yTop = padding.top + plotHeight - (current.episodes / maxEpisodes) * plotHeight;
            const barHeight = yBottom - yTop;

            // Bar
            const isLast = i === progressData.length - 1;
            const reachedEnd = totalEpisodes && current.episodes >= totalEpisodes;
            const barColor = reachedEnd ? '#ffd4e5' : '#d4c5f9';
            const nextDateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;
            bars += `<rect x="${xStart}" y="${yTop}" width="${barWidth}" height="${barHeight}" fill="${barColor}" stroke="#9f7aea" stroke-width="2" rx="3">
                <title>${current.date} → ${nextDateStr}: 第${previous.episodes}→${current.episodes}集 (${daysToNext}天)</title>
            </rect>`;

            // Episode count label on bar
            const episodesWatched = current.episodes - previous.episodes;
            if (barWidth > 30 && barHeight > 15) {
                bars += `<text x="${xStart + barWidth/2}" y="${yTop + barHeight/2 + 4}" text-anchor="middle" font-size="11" font-weight="600" fill="#ffffff">+${episodesWatched}</text>`;
            }

            // X-axis label at session date
            const xLabel = padding.left + (Math.ceil((currentDate - firstDate) / (1000 * 60 * 60 * 24)) / totalDays) * plotWidth;
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

            xAxisLabels += `<line x1="${xLabel}" y1="${chartHeight - padding.bottom}" x2="${xLabel}" y2="${chartHeight - padding.bottom + 5}" stroke="var(--text-muted)" stroke-width="1"/>`;
            const labelY = chartHeight - padding.bottom + 15;
            xAxisLabels += `<text x="${xLabel}" y="${labelY}" text-anchor="end" font-size="10" fill="var(--text-muted)" transform="rotate(-45, ${xLabel}, ${labelY})">${label}</text>`;
        }

        // Y-axis labels
        let yAxisLabels = '';
        const ySteps = 5;
        for (let i = 0; i <= ySteps; i++) {
            const episodes = Math.round((maxEpisodes / ySteps) * i);
            const y = padding.top + plotHeight - (episodes / maxEpisodes) * plotHeight;
            yAxisLabels += `<text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="var(--text-muted)">${episodes}</text>`;
            yAxisLabels += `<line x1="${padding.left}" y1="${y}" x2="${chartWidth - padding.right}" y2="${y}" stroke="var(--background-modifier-border)" stroke-dasharray="3,3" opacity="0.3"/>`;
        }

        // Year separators
        let yearSeparators = '';
        if (spansMultipleYears) {
            const years = new Set();
            for (let d = new Date(firstDate); d <= lastDate; d.setDate(d.getDate() + 1)) {
                years.add(d.getFullYear());
            }

            for (let year of Array.from(years).sort()) {
                const yearStart = new Date(year, 0, 1);
                if (yearStart <= firstDate) continue;
                if (yearStart > lastDate) break;

                const daysSinceStart = Math.ceil((yearStart - firstDate) / (1000 * 60 * 60 * 24));
                const x = padding.left + (daysSinceStart / totalDays) * plotWidth;

                yearSeparators += `<line x1="${x}" y1="${padding.top}" x2="${x}" y2="${chartHeight - padding.bottom}" stroke="var(--text-accent)" stroke-width="2" stroke-dasharray="8,4" opacity="0.4"/>`;
                yearSeparators += `<text x="${x + 5}" y="${padding.top + 15}" font-size="12" font-weight="600" fill="var(--text-accent)" opacity="0.6">${year}</text>`;
            }
        }

        const html = `
<div style="width: 100%; overflow-x: auto; padding: 20px 0;">
    <svg width="${chartWidth}" height="${chartHeight}" style="font-family: var(--font-interface);">
        <text x="${chartWidth / 2}" y="20" text-anchor="middle" font-size="16" font-weight="600" fill="var(--text-normal)">${showName} 观看时间线</text>

        ${yAxisLabels}
        ${xAxisLabels}
        ${yearSeparators}

        ${totalEpisodes ? `<line x1="${padding.left}" y1="${padding.top}" x2="${chartWidth - padding.right}" y2="${padding.top}" stroke="#ffd4e5" stroke-width="2" stroke-dasharray="5,5" opacity="0.6"/>` : ''}

        ${bars}

        <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${chartHeight - padding.bottom}" stroke="var(--text-muted)" stroke-width="1"/>
        <line x1="${padding.left}" y1="${chartHeight - padding.bottom}" x2="${chartWidth - padding.right}" y2="${chartHeight - padding.bottom}" stroke="var(--text-muted)" stroke-width="1"/>

        <text x="${chartWidth / 2}" y="${chartHeight - 5}" text-anchor="middle" font-size="12" fill="var(--text-muted)">日期</text>
        <text x="20" y="${chartHeight / 2}" text-anchor="middle" font-size="12" fill="var(--text-muted)" transform="rotate(-90, 20, ${chartHeight / 2})">集数</text>
    </svg>
</div>`;

        const container = dv.container.createEl('div');
        container.innerHTML = html;
    }
}
} catch (error) {
    console.error("tvProgress error:", error);
} finally {
    window[containerId + '_running'] = false;
}
})();
```
