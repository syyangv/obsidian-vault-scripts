---
modified_at: 2026-07-20
---

```dataviewjs
(async () => {
    const activeFile = app.workspace.getActiveFile();
    if (!activeFile) { dv.paragraph('⚠️ No active file'); return; }

    const containerId = 'daily-nav-' + activeFile.path;
    if (window[containerId + '_running']) return;
    if (window[containerId + '_timeout']) clearTimeout(window[containerId + '_timeout']);
    await new Promise(resolve => { window[containerId + '_timeout'] = setTimeout(resolve, 500); });
    window[containerId + '_running'] = true;

    try {
        const noteTitle = activeFile.name;
        const dateMatch = noteTitle.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (!dateMatch) { dv.paragraph('⚠️ Cannot create navigation links - no date in note name'); return; }

        const currentDate = new Date(parseInt(dateMatch[1]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[3]));
        const currentYear = parseInt(dateMatch[1]);
        const currentMonth = dateMatch[2];

        // Previous day
        const previousDate = new Date(currentDate);
        previousDate.setDate(currentDate.getDate() - 1);
        const prevYear = previousDate.getFullYear();
        const prevMonth = (previousDate.getMonth() + 1).toString().padStart(2, '0');
        const prevDay = previousDate.getDate().toString().padStart(2, '0');
        const previousDateString = `${prevYear}-${prevMonth}-${prevDay}`;

        // Next day
        const nextDate = new Date(currentDate);
        nextDate.setDate(currentDate.getDate() + 1);
        const nextYear = nextDate.getFullYear();
        const nextMonth = (nextDate.getMonth() + 1).toString().padStart(2, '0');
        const nextDay = nextDate.getDate().toString().padStart(2, '0');
        const nextDateString = `${nextYear}-${nextMonth}-${nextDay}`;

        const monthString = `${currentYear}-${currentMonth}`;
        const monthNumber = parseInt(currentMonth);

        // Find the weekly note whose date range contains this day
        const currentMoment = window.moment(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`, 'YYYY-MM-DD');
        let weekPage = null;
        for (const p of dv.pages('"周计划"').where(p => p["开始日期（周日）"] && p["结束日期（周六）"])) {
            const sv = p["开始日期（周日）"];
            const ev = p["结束日期（周六）"];
            const startStr = sv && sv.toFormat ? sv.toFormat('yyyy-MM-dd') : String(sv).slice(0, 10);
            const endStr   = ev && ev.toFormat ? ev.toFormat('yyyy-MM-dd') : String(ev).slice(0, 10);
            const start = window.moment(startStr, 'YYYY-MM-DD');
            const end   = window.moment(endStr,   'YYYY-MM-DD');
            if (currentMoment.isSameOrAfter(start, 'day') && currentMoment.isSameOrBefore(end, 'day')) {
                weekPage = p;
                break;
            }
        }

        // Styling — matches weeklyNavigation palette + day-chip colors
        const P = { text: '#8B7E9B', muted: '#C9B8D4' };
        const past    = { bg: '#E2EEF8', fg: '#6A8AAA' };
        const current = { bg: '#D8F4E4', fg: '#4A8A62' };
        const future  = { bg: '#FFFAE0', fg: '#9A8A40' };

        const wrap = dv.container.createEl('div', {
            attr: { style: `color:${P.text}; line-height:1.8; text-align:center;` }
        });

        function pill(parent, label, path, scheme) {
            const a = parent.createEl('a', {
                text: label, cls: 'internal-link',
                attr: { style: `color:${scheme.fg}; background:${scheme.bg}; text-decoration:none; font-weight:600; cursor:pointer; padding:2px 10px; border-radius:4px;` }
            });
            a.addEventListener('click', e => { e.preventDefault(); app.workspace.openLinkText(path, activeFile.path); });
        }

        function datePill(parent, label, path, dateStr, year, scheme) {
            const a = parent.createEl('a', {
                text: label, cls: 'internal-link',
                attr: { style: `color:${scheme.fg}; background:${scheme.bg}; text-decoration:none; font-weight:600; cursor:pointer; padding:2px 10px; border-radius:4px;` }
            });
            a.addEventListener('click', async e => {
                e.preventDefault();
                const fullPath = `日记/${year}/${dateStr}.md`;
                if (!app.vault.getAbstractFileByPath(fullPath)) {
                    const qapi = app.plugins.plugins['quickadd']?.api;
                    if (qapi) {
                        await qapi.executeChoice('createDailyNoteByDate', { date: dateStr });
                        return;
                    }
                }
                app.workspace.openLinkText(path, activeFile.path);
            });
        }

        function sep(parent) {
            parent.createEl('span', { text: '·', attr: { style: `color:${P.muted};` } });
        }

        // Sims-style squircle icon button
        function simNavBtn(parent, svgPoints, clickFn) {
            const btn = parent.createEl('span', {
                attr: { style: 'display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:28%;background:linear-gradient(145deg,#3aa4c2,#094a63);box-shadow:inset 0 2px 0 rgba(255,255,255,.45),inset 0 -1px 0 rgba(0,0,0,.3),0 2px 5px rgba(0,0,0,.4);cursor:pointer;flex-shrink:0;' }
            });
            const NS = 'http://www.w3.org/2000/svg';
            const svg = document.createElementNS(NS, 'svg');
            svg.setAttribute('width', '14'); svg.setAttribute('height', '14');
            svg.setAttribute('viewBox', '0 0 18 18'); svg.setAttribute('fill', 'none');
            svg.setAttribute('stroke', 'white'); svg.setAttribute('stroke-width', '2.2');
            svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
            const pl = document.createElementNS(NS, 'polyline');
            pl.setAttribute('points', svgPoints);
            svg.appendChild(pl);
            btn.appendChild(svg);
            btn.addEventListener('click', clickFn);
            return btn;
        }

        // Row 1: [←] prev date · year · month · next date [→]
        const navRow = wrap.createEl('div', {
            attr: { style: 'display:flex; gap:8px; align-items:center; justify-content:center;' }
        });

        simNavBtn(navRow, '11,4 6,9 11,14', async e => {
            e.preventDefault();
            const fullPath = `日记/${prevYear}/${previousDateString}.md`;
            if (!app.vault.getAbstractFileByPath(fullPath)) {
                const qapi = app.plugins.plugins['quickadd']?.api;
                if (qapi) { await qapi.executeChoice('createDailyNoteByDate', { date: previousDateString }); return; }
            }
            app.workspace.openLinkText(`日记/${prevYear}/${previousDateString}`, activeFile.path);
        });

        navRow.createEl('span', { text: previousDateString, attr: { style: `color:${P.muted};` } });
        sep(navRow);
        pill(navRow, `${currentYear}年`, `年度记录/${currentYear}/${currentYear}`, current);
        sep(navRow);
        pill(navRow, `${monthNumber}月`, `年度记录/${currentYear}/月计划/${monthString}`, current);
        sep(navRow);
        navRow.createEl('span', { text: nextDateString, attr: { style: `color:${P.muted};` } });

        simNavBtn(navRow, '7,4 12,9 7,14', async e => {
            e.preventDefault();
            const fullPath = `日记/${nextYear}/${nextDateString}.md`;
            if (!app.vault.getAbstractFileByPath(fullPath)) {
                const qapi = app.plugins.plugins['quickadd']?.api;
                if (qapi) { await qapi.executeChoice('createDailyNoteByDate', { date: nextDateString }); return; }
            }
            app.workspace.openLinkText(`日记/${nextYear}/${nextDateString}`, activeFile.path);
        });

        // Row 2: weekly note link
        if (weekPage) {
            const weekPath = weekPage.file.path.replace(/\.md$/, '');
            const weekName = weekPath.split('/').pop().replace(/^\d{4}-/, '');
            const weekRow = wrap.createEl('div', {
                attr: { style: 'display:flex; gap:8px; align-items:center; justify-content:center; margin-top:4px;' }
            });
            pill(weekRow, weekName, weekPath, current);
        }

    } catch (err) {
        dv.paragraph('⚠️ ' + err.message);
    } finally {
        window[containerId + '_running'] = false;
    }
})();
```
