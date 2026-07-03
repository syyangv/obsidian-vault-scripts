---
modified_at: 2026-07-03
---
```dataviewjs
(async () => {
    const activeFile = app.workspace.getActiveFile();
    if (!activeFile) { dv.paragraph('⚠️ No active file'); return; }

    const containerId = 'monthly-nav-' + activeFile.path;
    if (window[containerId + '_running']) return;
    if (window[containerId + '_timeout']) clearTimeout(window[containerId + '_timeout']);
    await new Promise(resolve => { window[containerId + '_timeout'] = setTimeout(resolve, 500); });
    window[containerId + '_running'] = true;

    try {
        const noteTitle = activeFile.basename;
        const dateMatch = noteTitle.match(/^(\d{4})-(\d{2})$/);
        if (!dateMatch) { dv.paragraph('⚠️ Filename must be YYYY-MM format, got: ' + noteTitle); return; }

        const currentYear = parseInt(dateMatch[1]);
        const currentMonth = parseInt(dateMatch[2]);

        // Previous month
        let prevYear = currentYear, prevMonth = currentMonth - 1;
        if (prevMonth < 1) { prevMonth = 12; prevYear = currentYear - 1; }
        const prevMonthString = prevYear + '-' + prevMonth.toString().padStart(2, '0');

        // Next month
        let nextYear = currentYear, nextMonth = currentMonth + 1;
        if (nextMonth > 12) { nextMonth = 1; nextYear = currentYear + 1; }
        const nextMonthString = nextYear + '-' + nextMonth.toString().padStart(2, '0');

        // Styling — matches dailyNavigation palette
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

        function sep(parent) {
            parent.createEl('span', { text: '·', attr: { style: `color:${P.muted};` } });
        }

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
            svg.appendChild(pl); btn.appendChild(svg);
            btn.addEventListener('click', clickFn);
            return btn;
        }

        // Row: [←] prev month · year · next month [→]
        const navRow = wrap.createEl('div', {
            attr: { style: 'display:flex; gap:8px; align-items:center; justify-content:center;' }
        });
        async function openOrCreateMonthly(year, monthStr) {
            const fullPath = `年度记录/${year}/月计划/${monthStr}.md`;
            if (!app.vault.getAbstractFileByPath(fullPath)) {
                const tmplFile = app.vault.getAbstractFileByPath('Helper/Templates/Monthly Note.md');
                if (tmplFile) {
                    let tmpl = await app.vault.read(tmplFile);
                    tmpl = tmpl.replace(/modified_at:\s*\d{4}-\d{2}-\d{2}/, 'modified_at: ' + window.moment().format('YYYY-MM-DD'));
                    const folder = app.vault.getAbstractFileByPath(`年度记录/${year}/月计划`);
                    if (!folder) await app.vault.createFolder(`年度记录/${year}/月计划`);
                    await app.vault.create(fullPath, tmpl);
                }
            }
            app.workspace.openLinkText(fullPath.replace(/\.md$/, ''), activeFile.path);
        }

        simNavBtn(navRow, '11,4 6,9 11,14', async e => {
            e.preventDefault();
            await openOrCreateMonthly(prevYear, prevMonthString);
        });
        navRow.createEl('span', { text: prevMonthString, attr: { style: `color:${P.muted};` } });
        sep(navRow);
        pill(navRow, `${currentYear}年`, `年度记录/${currentYear}/${currentYear}`, current);
        sep(navRow);
        navRow.createEl('span', { text: nextMonthString, attr: { style: `color:${P.muted};` } });
        simNavBtn(navRow, '7,4 12,9 7,14', async e => {
            e.preventDefault();
            await openOrCreateMonthly(nextYear, nextMonthString);
        });

    } catch (err) {
        dv.paragraph('⚠️ ' + err.message);
    } finally {
        window[containerId + '_running'] = false;
    }
})();
```