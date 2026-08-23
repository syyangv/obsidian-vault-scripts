---
modified_at: 2026-07-20
---
```dataviewjs
const actualCurrentFile = app.workspace.getActiveFile();
const courseName = actualCurrentFile.basename;
const metadata = dv.page(actualCurrentFile.path);
const totalLessons = metadata['课时数'];
const startDate = metadata['开始日期'];

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
            const escaped = courseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\[\\[${escaped}\\]\\]\\s*进度::\\s*(\\d+)`);
            const match = regex.exec(content);
            if (match) {
                const lessons = parseInt(match[1]);
                let dateStr;
                if (note.file.day.toFormat) {
                    dateStr = note.file.day.toFormat("yyyy-MM-dd");
                } else if (typeof note.file.day === 'string') {
                    dateStr = note.file.day.split('T')[0];
                } else {
                    dateStr = note.file.day.toString().split('T')[0];
                }
                progressData.push({ date: dateStr, lessons: lessons });
                if (totalLessons && lessons >= totalLessons) break;
            }
        } catch (e) {}
    }

    if (progressData.length === 0) {
        dv.container.innerHTML = `<span>📝 还没有在日记中记录课程进度</span>`;
    } else {
        const latestProgress = progressData[progressData.length - 1].lessons;
        const currentInFrontmatter = metadata['进度'] || 0;
        const isFinished = totalLessons && latestProgress >= totalLessons;

        if (latestProgress !== currentInFrontmatter) {
            const file = app.vault.getAbstractFileByPath(actualCurrentFile.path);
            await app.fileManager.processFrontMatter(file, (fm) => {
                fm['进度'] = latestProgress;
            });
            const msgEl1 = dv.container.createEl('div');
            msgEl1.innerHTML = `<span>✅ <strong>已自动同步</strong>: 更新为第 ${latestProgress} 节 / ${totalLessons || '?'} 节 ${isFinished ? '🎉 已完成!' : ''}</span>`;
        } else {
            const msgEl2 = dv.container.createEl('div');
            msgEl2.innerHTML = `<span><strong>当前进度</strong>: 第 ${latestProgress} 节 / ${totalLessons || '?'} 节 ${isFinished ? '🎉 已完成!' : ''}</span>`;
        }

        const firstDate = new Date(progressData[0].date);
        const lastDate = new Date(progressData[progressData.length - 1].date);
        const totalDays = Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)) + 1;
        const maxLessons = totalLessons || latestProgress;

        const chartWidth = 800;
        const chartHeight = 400;
        const padding = { top: 40, right: 40, bottom: 120, left: 60 };
        const plotWidth = chartWidth - padding.left - padding.right;
        const plotHeight = chartHeight - padding.top - padding.bottom;

        let pathData = '';
        let points = [];

        for (let i = 0; i < progressData.length; i++) {
            const current = progressData[i];
            const currentDate = new Date(current.date);
            const daysSinceStart = Math.ceil((currentDate - firstDate) / (1000 * 60 * 60 * 24));
            const x = padding.left + (daysSinceStart / Math.max(totalDays, 1)) * plotWidth;
            const y = padding.top + plotHeight - (current.lessons / maxLessons) * plotHeight;
            points.push({ x, y, date: current.date, lessons: current.lessons });
            if (i === 0) {
                pathData += `M ${x} ${y}`;
            } else {
                pathData += ` L ${x} ${y}`;
            }
        }

        const spansMultipleYears = firstDate.getFullYear() !== lastDate.getFullYear();

        let xAxisLabels = '';
        for (let i = 0; i < progressData.length; i++) {
            const current = progressData[i];
            const currentDate = new Date(current.date);
            const daysSinceStart = Math.ceil((currentDate - firstDate) / (1000 * 60 * 60 * 24));
            const x = padding.left + (daysSinceStart / Math.max(totalDays, 1)) * plotWidth;
            let label;
            if (spansMultipleYears) {
                const prevDate = i > 0 ? new Date(progressData[i - 1].date) : null;
                const yearChanged = !prevDate || prevDate.getFullYear() !== currentDate.getFullYear();
                label = (yearChanged || i === 0) ? current.date : current.date.substring(5);
            } else {
                label = current.date.substring(5);
            }
            xAxisLabels += `<line x1="${x}" y1="${chartHeight - padding.bottom}" x2="${x}" y2="${chartHeight - padding.bottom + 5}" stroke="var(--text-muted)" stroke-width="1"/>`;
            const labelY = chartHeight - padding.bottom + 15;
            xAxisLabels += `<text x="${x}" y="${labelY}" text-anchor="end" font-size="10" fill="var(--text-muted)" transform="rotate(-45, ${x}, ${labelY})">${label}</text>`;
        }

        let yAxisLabels = '';
        const ySteps = 5;
        for (let i = 0; i <= ySteps; i++) {
            const lessons = Math.round((maxLessons / ySteps) * i);
            const y = padding.top + plotHeight - (lessons / maxLessons) * plotHeight;
            yAxisLabels += `<text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="var(--text-muted)">${lessons}</text>`;
            yAxisLabels += `<line x1="${padding.left}" y1="${y}" x2="${chartWidth - padding.right}" y2="${y}" stroke="var(--background-modifier-border)" stroke-dasharray="3,3" opacity="0.3"/>`;
        }

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
                const x = padding.left + (daysSinceStart / Math.max(totalDays, 1)) * plotWidth;
                yearSeparators += `<line x1="${x}" y1="${padding.top}" x2="${x}" y2="${chartHeight - padding.bottom}" stroke="var(--text-accent)" stroke-width="2" stroke-dasharray="8,4" opacity="0.4"/>`;
                yearSeparators += `<text x="${x + 5}" y="${padding.top + 15}" font-size="12" font-weight="600" fill="var(--text-accent)" opacity="0.6">${year}</text>`;
            }
        }

        const html = `
<div style="width: 100%; overflow-x: auto; padding: 20px 0;">
    <svg width="${chartWidth}" height="${chartHeight}" style="font-family: var(--font-interface);">
        <text x="${chartWidth / 2}" y="20" text-anchor="middle" font-size="16" font-weight="600" fill="var(--text-normal)">${courseName} 课程进度</text>
        ${yAxisLabels}
        ${xAxisLabels}
        ${yearSeparators}
        ${totalLessons ? `<line x1="${padding.left}" y1="${padding.top}" x2="${chartWidth - padding.right}" y2="${padding.top}" stroke="#ffd4e5" stroke-width="2" stroke-dasharray="5,5" opacity="0.6"/>` : ''}
        <path d="${pathData}" fill="none" stroke="#a8d8b9" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        ${points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="5" fill="#52b788" stroke="#ffffff" stroke-width="2"><title>${p.date}: 第${p.lessons}节</title></circle>`).join('')}
        <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${chartHeight - padding.bottom}" stroke="var(--text-muted)" stroke-width="1"/>
        <line x1="${padding.left}" y1="${chartHeight - padding.bottom}" x2="${chartWidth - padding.right}" y2="${chartHeight - padding.bottom}" stroke="var(--text-muted)" stroke-width="1"/>
        <text x="${chartWidth / 2}" y="${chartHeight - 5}" text-anchor="middle" font-size="12" fill="var(--text-muted)">日期</text>
        <text x="20" y="${chartHeight / 2}" text-anchor="middle" font-size="12" fill="var(--text-muted)" transform="rotate(-90, 20, ${chartHeight / 2})">节数</text>
    </svg>
</div>`;

        const container = dv.container.createEl('div');
        container.innerHTML = html;
    }
}
```
