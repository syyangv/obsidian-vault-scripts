---
modified_at: 2026-07-20
---
```dataviewjs
(async () => {
    const activeFile = app.workspace.getActiveFile();
    if (!activeFile) { dv.paragraph('⚠️ No active file'); return; }

    const containerId = 'weekly-nav-' + activeFile.path;
    if (window[containerId + '_running']) return;
    if (window[containerId + '_timeout']) clearTimeout(window[containerId + '_timeout']);
    await new Promise(resolve => { window[containerId + '_timeout'] = setTimeout(resolve, 500); });
    window[containerId + '_running'] = true;

    try {
        const basename = activeFile.basename;
        const weekMatch = basename.match(/^(\d{4})-W(\d{1,2})$/);
        if (!weekMatch) { dv.paragraph('⚠️ Filename must be YYYY-Www'); return; }

        const year   = parseInt(weekMatch[1]);
        const week   = parseInt(weekMatch[2]);
        const monday = window.moment().isoWeekYear(year).isoWeek(week).startOf('isoWeek');
        const sunday = monday.clone().subtract(1, 'day');
        const today  = window.moment().startOf('day');

        const prevMon = sunday.clone().subtract(6, 'days');
        const nextMon = sunday.clone().add(8, 'days');
        const prevStr = prevMon.format('YYYY') + '-W' + prevMon.format('WW');
        const nextStr = nextMon.format('YYYY') + '-W' + nextMon.format('WW');

        const P = { purple:'#B4A7D6', text:'#8B7E9B', muted:'#C9B8D4' };
        const dayNames = ['S','M','T','W','T','F','S'];

        const wrap = dv.container.createEl('div', {
            attr: { style: 'font-size:.92em; color:' + P.text + '; line-height:1.8;' }
        });

        // Nav row
        const navRow = wrap.createEl('div', {
            attr: { style: 'display:flex; gap:8px; align-items:center; justify-content:center; margin-bottom:4px;' }
        });
        function navLink(parent, label, path) {
            const a = parent.createEl('a', { text: label, cls: 'internal-link',
                attr: { style: 'color:' + P.purple + '; text-decoration:none; font-weight:600; cursor:pointer;' }
            });
            a.addEventListener('click', e => { e.preventDefault(); app.workspace.openLinkText(path, activeFile.path); });
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

        simNavBtn(navRow, '11,4 6,9 11,14', e => {
            e.preventDefault();
            app.workspace.openLinkText('周计划/' + prevMon.format('YYYY') + '/' + prevStr, activeFile.path);
        });
        navRow.createEl('span', { text: prevStr, attr: { style: 'color:' + P.muted + ';' } });
        navRow.createEl('span', { text: '·', attr: { style: 'color:' + P.muted + ';' } });
        navLink(navRow, year + '年', '年度记录/' + year + '/' + year);
        navRow.createEl('span', { text: '·', attr: { style: 'color:' + P.muted + ';' } });
        const saturday   = sunday.clone().add(6, 'days');
        const startMonth = sunday.format('YYYY-MM');
        const endMonth   = saturday.format('YYYY-MM');
        navLink(navRow, sunday.format('M') + '月', '年度记录/' + sunday.format('YYYY') + '/月计划/' + startMonth);
        if (endMonth !== startMonth) {
            navRow.createEl('span', { text: '/', attr: { style: 'color:' + P.muted + ';' } });
            navLink(navRow, saturday.format('M') + '月', '年度记录/' + saturday.format('YYYY') + '/月计划/' + endMonth);
        }
        navRow.createEl('span', { text: '·', attr: { style: 'color:' + P.muted + ';' } });
        navRow.createEl('span', { text: nextStr, attr: { style: 'color:' + P.muted + ';' } });
        simNavBtn(navRow, '7,4 12,9 7,14', e => {
            e.preventDefault();
            app.workspace.openLinkText('周计划/' + nextMon.format('YYYY') + '/' + nextStr, activeFile.path);
        });

        // Day chips row
        const daysRow = wrap.createEl('div', {
            attr: { style: 'display:flex; gap:6px; flex-wrap:nowrap; justify-content:center;' }
        });

        for (let i = 0; i < 7; i++) {
            const day     = sunday.clone().add(i, 'days');
            const isToday = day.isSame(today, 'day');
            const isPast  = day.isBefore(today, 'day');
            const dateStr = day.format('YYYY-MM-DD');
            const dayYear = day.format('YYYY');

            const bg    = isToday ? '#D8F4E4' : isPast ? '#E2EEF8' : '#FFFAE0';
            const color = isToday ? '#4A8A62' : isPast ? '#6A8AAA' : '#9A8A40';
            const fw    = isToday ? '700' : '400';

            const chip = daysRow.createEl('div', {
                attr: { style: [
                    'display:flex; flex-direction:column; align-items:center;',
                    'padding:4px 9px; border-radius:4px; cursor:pointer; white-space:nowrap;',
                    'background:' + bg + '; color:' + color + '; font-weight:' + fw + ';',
                ].join(' ') }
            });
            chip.createEl('span', { text: dayNames[i] });
            chip.createEl('span', { text: day.format('M/D'), attr: { style: 'font-size:.85em; opacity:.8;' } });
            chip.addEventListener('click', () => {
                app.workspace.openLinkText('日记/' + dayYear + '/' + dateStr, activeFile.path);
            });
        }

    } catch (err) {
        dv.paragraph('⚠️ ' + err.message);
    } finally {
        window[containerId + '_running'] = false;
    }
})();
```
