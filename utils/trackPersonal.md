---
modified_at: 2026-09-03
---
```dataviewjs
(async () => {
    // ===== PREVENT MULTIPLE SIMULTANEOUS EXECUTIONS =====
    const activeFile = app.workspace.getActiveFile();
    const isYearNote = (f) => !!f && /\d{4}/.test(f.name || "");
    if (isYearNote(activeFile)) window.__trackPersonalYearNote = activeFile.path;

    let targetFile = isYearNote(activeFile) ? activeFile : null;
    if (!targetFile && window.__trackPersonalYearNote) {
        targetFile = app.vault.getAbstractFileByPath(window.__trackPersonalYearNote);
    }
    if (!targetFile) targetFile = activeFile;

    const currentFileName = targetFile ? (targetFile.basename || targetFile.name || "") : "";
    const yearMatch = currentFileName.match(/(\d{4})/);
    const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

    const containerId = 'track-personal-' + (targetFile ? targetFile.path : String(year));

    if (window[containerId + '_running']) return;
    if (window[containerId + '_timeout']) clearTimeout(window[containerId + '_timeout']);

    await new Promise(resolve => {
        window[containerId + '_timeout'] = setTimeout(resolve, 500);
    });

    window[containerId + '_running'] = true;

    try {
        // Load config from Helper/config/PersonalConfig.md
        const cfgPage = dv.page("Helper/config/PersonalConfig");
        const cfg = cfgPage?.file?.frontmatter || null;

        const ACTIVITIES = (cfg && Array.isArray(cfg.activities)) ? cfg.activities : [
            { emoji: '🎭', label: '看戏', tag: '看戏' },
            { emoji: '', label: '🎾', tag: '🎾', fm: 'activity_tennis' },
            { emoji: '🌸', label: '出去玩', tag: '出去玩' },
            { emoji: '🧸', label: 'Therapy', tag: 'therapy' },
            { emoji: '🎤', label: '', tag: '🎤', fm: 'activity_singing' },
            { emoji: '📖', label: '学习', tag: '学习', color: '#D946B8' },
            { emoji: '💪', label: '健身', tag: '健身房' },
        ];

        const CHARTS = (cfg && Array.isArray(cfg.charts)) ? cfg.charts.map(c => ({
            tag: c.tag || undefined,
            fm: c.fm || undefined,
            label: year + (c.labelSuffix || ''),
            color: c.color || '#10b981'
        })) : [
            { tag: '学习', label: year + '📖', color: '#D946B8' },
            { fm: '今日甚好', label: year + '今日甚好', color: 'crimson' },
        ];

        const LINK_MAP = {
            '看戏': 'Hobbies/Musical/Musical',
            '🎾': '兴趣班',
            'Therapy': 'Logistics/Therapy/Therapy',
            '健身': '兴趣班'
        };

        const diaryFiles = app.vault.getFiles()
            .filter(f => f.path.startsWith('日记/' + year + '/') && f.extension === 'md')
            .sort((a, b) => a.basename.localeCompare(b.basename));

        const hasMatch = (cache, tag, fmField) => {
            if (tag && cache.tags && cache.tags.some(t => t.tag === '#' + tag)) return true;
            if (cache.frontmatter) {
                const at = cache.frontmatter.activity_tags;
                if (tag && Array.isArray(at) && at.some(t => t && String(t).includes(tag))) return true;
                if (fmField && cache.frontmatter[fmField] === true) return true;
            }
            return false;
        };

        const counts = {};
        const series = {};
        for (const act of ACTIVITIES) counts[act.tag] = 0;
        for (const ch of CHARTS) series[ch.label] = [];

        // Deduplicate diary files by date (first 10 chars)
        const seenDates = new Set();
        for (const f of diaryFiles) {
            const dateKey = f.basename.substring(0, 10);
            if (seenDates.has(dateKey)) continue;
            seenDates.add(dateKey);

            const cache = app.metadataCache.getFileCache(f);
            if (!cache) continue;
            for (const act of ACTIVITIES) {
                if (hasMatch(cache, act.tag, act.fm)) counts[act.tag]++;
            }
            for (const ch of CHARTS) {
                const matched = ch.fm
                    ? (cache.frontmatter && cache.frontmatter[ch.fm] === true)
                    : hasMatch(cache, ch.tag, null);
                if (matched) {
                    series[ch.label].push(dateKey);
                }
            }
        }

        const wrap = dv.container.createDiv({ cls: 'track-personal-container' });
        wrap.style.cssText = 'display:flex;flex-direction:column;gap:12px;width:100%;';

        // Activities List (2 columns)
        const actGrid = wrap.createDiv({ cls: 'annual-columns-row' });
        actGrid.style.cssText = 'display:flex;gap:24px;flex-wrap:wrap;';

        const col1 = actGrid.createDiv({ cls: 'annual-columns-cell' });
        col1.style.cssText = 'flex:1;min-width:180px;';
        const col2 = actGrid.createDiv({ cls: 'annual-columns-cell' });
        col2.style.cssText = 'flex:1;min-width:180px;';

        const ul1 = col1.createEl('ul', { attr: { style: 'margin:0;padding-left:18px;list-style:disc;' } });
        const ul2 = col2.createEl('ul', { attr: { style: 'margin:0;padding-left:18px;list-style:disc;' } });

        const mid = Math.ceil(ACTIVITIES.length / 2);
        for (let i = 0; i < ACTIVITIES.length; i++) {
            const act = ACTIVITIES[i];
            const ul = i < mid ? ul1 : ul2;
            const li = ul.createEl('li', { attr: { style: 'margin:3px 0;font-size:0.95em;' } });
            const c = act.color || '#10b981';
            const emojiPart = act.emoji ? act.emoji + ' ' : '';
            let labelPart = act.label || '';
            const linkTarget = LINK_MAP[act.label];
            if (linkTarget) {
                labelPart = `<a class="internal-link" data-href="${linkTarget}" href="${linkTarget}">${act.label}</a>`;
            }
            li.innerHTML = `${emojiPart}${labelPart}共 <span style="color:${c};font-weight:bold;">${counts[act.tag]}</span> 次`;
        }

        // Cumulative SVG Charts
        const chartGrid = wrap.createDiv({ cls: 'annual-columns-row' });
        chartGrid.style.cssText = 'display:flex;gap:16px;flex-wrap:wrap;margin-top:4px;';

        const jan1 = new Date(year, 0, 1).getTime();
        const dec31 = new Date(year, 11, 31).getTime();
        const range = dec31 - jan1;

        for (const ch of CHARTS) {
            const dates = series[ch.label] || [];
            let cumulative = 0;
            const points = [{ x: 0, y: 0 }];
            for (const d of dates) {
                cumulative++;
                const t = new Date(d).getTime();
                const x = Math.max(0, Math.min(1, (t - jan1) / range));
                points.push({ x, y: cumulative });
            }
            const maxY = Math.max(cumulative, 1);

            const cell = chartGrid.createDiv({ cls: 'annual-columns-cell' });
            cell.style.cssText = 'flex:1;min-width:240px;display:flex;flex-direction:column;';

            const titleDiv = cell.createDiv();
            titleDiv.style.cssText = 'font-size:0.85em;font-weight:600;margin-bottom:2px;color:var(--text-normal);';
            titleDiv.textContent = ch.label;

            const svgWrap = cell.createDiv({ cls: 'annual-chart-svg-wrap' });
            svgWrap.style.cssText = 'flex:1;min-height:0;overflow:hidden;width:100%;display:flex;flex-direction:column;';

            const W = 360, H = 135;
            const pad = { top: 10, right: 8, bottom: 10, left: 24 };
            const plotW = W - pad.left - pad.right;
            const plotH = H - pad.top - pad.bottom;
            const toX = (xr) => pad.left + xr * plotW;
            const toY = (yr) => pad.top + plotH - (yr / maxY) * plotH;

            const pathParts = points.map((p, i) =>
                (i === 0 ? 'M' : 'L') + toX(p.x).toFixed(1) + ',' + toY(p.y).toFixed(1)
            );
            const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
            let monthLabels = '';
            const fontSize = 8;
            for (let m = 0; m < 12; m++) {
                const t = new Date(year, m, 15).getTime();
                const x = toX((t - jan1) / range);
                monthLabels += '<text x="' + x.toFixed(1) + '" y="' + (H - 2) + '" text-anchor="middle" fill="var(--text-muted)" font-size="' + fontSize + '">' + months[m] + '</text>';
            }
            let yTicks = '';
            const step = maxY <= 5 ? 1 : maxY <= 20 ? 5 : 10;
            for (let v = 0; v <= maxY; v += step) {
                const y = toY(v);
                yTicks += '<text x="' + (pad.left - 4) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end" fill="var(--text-muted)" font-size="' + fontSize + '">' + v + '</text>';
                yTicks += '<line x1="' + pad.left + '" y1="' + y.toFixed(1) + '" x2="' + (W - pad.right) + '" y2="' + y.toFixed(1) + '" stroke="var(--background-modifier-border)" stroke-width="0.5"/>';
            }
            const dotR = 2.5;
            const dotsSvg = points.slice(1).map(p =>
                '<circle cx="' + toX(p.x).toFixed(1) + '" cy="' + toY(p.y).toFixed(1) + '" r="' + dotR + '" fill="white" stroke="' + ch.color + '" stroke-width="1.5"/>'
            ).join('');

            const now = new Date();
            let todayLine = '';
            if (now.getFullYear() === Number(year)) {
                const todayRatio = Math.max(0, Math.min(1, (now.getTime() - jan1) / range));
                const todayX = toX(todayRatio);
                todayLine = '<line x1="' + todayX.toFixed(1) + '" y1="' + pad.top + '" x2="' + todayX.toFixed(1) + '" y2="' + (pad.top + plotH) + '" stroke="var(--interactive-accent, #7c3aed)" stroke-width="1.5" stroke-dasharray="3,3" opacity="0.85"><title>Today</title></line>';
            }

            svgWrap.innerHTML = '<svg width="100%" height="100%" viewBox="0 0 ' + W + ' ' + H + '" style="display:block;width:100%;height:100%;flex:1;max-height:160px;">'
                + yTicks + todayLine + monthLabels
                + '<path d="' + pathParts.join('') + '" fill="none" stroke="' + ch.color + '" stroke-width="2" stroke-linejoin="round"/>'
                + dotsSvg
                + '</svg>';
        }

    } catch (error) {
        console.error('TrackPersonal Error:', error);
        dv.paragraph('⚠️ Error: ' + error.message);
    } finally {
        window[containerId + '_running'] = false;
    }
})();
```
