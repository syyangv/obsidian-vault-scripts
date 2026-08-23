---
modified_at: 2026-07-20
---
```dataviewjs
(async () => {
    const activeFile = app.workspace.getActiveFile();
    if (!activeFile) return;

    const containerId = 'weekly-media-' + activeFile.path;
    if (window[containerId + '_running']) return;
    if (window[containerId + '_timeout']) clearTimeout(window[containerId + '_timeout']);
    await new Promise(resolve => { window[containerId + '_timeout'] = setTimeout(resolve, 500); });
    window[containerId + '_running'] = true;

    const CONFIG   = { cacheTTLMinutes: 240 };
    const CACHE_KEY = 'weekly-media-data-v3-' + activeFile.basename;

    function loadFromCache() {
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            const { ts, data } = JSON.parse(raw);
            if (Date.now() - ts > CONFIG.cacheTTLMinutes * 60 * 1000) return null;
            return data;
        } catch { return null; }
    }
    function saveToCache(data) {
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {}
    }
    function clearCache() {
        try { localStorage.removeItem(CACHE_KEY); } catch {}
    }

    try {
        const meta      = dv.page(activeFile.path);
        const weekStart = window.moment(String(meta["开始日期（周日）"]).slice(0, 10), "YYYY-MM-DD");
        const weekEnd   = window.moment(String(meta["结束日期（周六）"]).slice(0, 10), "YYYY-MM-DD");
        const tvCutoff  = weekStart.clone().subtract(365, 'days');
        const longCutoff= weekStart.clone().subtract(365, 'days');

        const wrap = dv.container.createEl('div');

        // Refresh button
        const refreshBtn = wrap.createEl('button', {
            text: '↺ 刷新数据',
            attr: { style: 'font-size:.8em; margin-bottom:6px; cursor:pointer; opacity:.6;' }
        });
        refreshBtn.addEventListener('click', () => {
            clearCache();
            app.workspace.trigger('dataview:refresh-views');
        });

        // name -> { baseline, thisWeek (latest), weekMin (minimum seen this week) }
        let shows, books, courses, movies, theatre, specials;

        const cached = loadFromCache();
        if (cached) {
            shows   = new Map(cached.shows);
            books   = new Map(cached.books);
            courses = new Map(cached.courses);
            movies  = cached.movies   ?? [];
            theatre = cached.theatre  ?? [];
            specials= cached.specials ?? [];
        } else {
            shows   = new Map();
            books   = new Map();
            courses = new Map();
            specials= [];

            function ensure(map, name) {
                if (!map.has(name)) map.set(name, { baseline: null, thisWeek: null, weekMin: null });
            }

            function parseAll(content, re, map, setBaseline, setThisWeek) {
                let m;
                while ((m = re.exec(content)) !== null) {
                    const [, name, rawVal] = m;
                    const val = parseInt(rawVal);
                    ensure(map, name);
                    const e = map.get(name);
                    if (setBaseline && e.baseline === null) e.baseline = val;
                    if (setThisWeek) {
                        e.thisWeek = val;
                        e.weekMin  = e.weekMin === null ? val : Math.min(e.weekMin, val);
                    }
                }
            }

            // ── Pass 1: scan week forwards → thisWeek + weekMin ──────────
            const weekNotes = dv.pages('"日记"')
                .where(p => p.file.folder.match(/^日记\/\d{4}$/) && p.file.day)
                .filter(p => {
                    const d = window.moment(String(p.file.day).slice(0, 10), "YYYY-MM-DD");
                    return d.isSameOrAfter(weekStart) && d.isSameOrBefore(weekEnd);
                })
                .sort(p => p.file.day, 'asc');

            for (const note of weekNotes) {
                let content;
                try { content = await dv.io.load(note.file.path); } catch { continue; }
                parseAll(content, /\[\[([^\]]+)\]\][^\n]*看过集数::\s*(\d+)/g,  shows,   false, true);
                parseAll(content, /\[\[([^\]]+)\]\][^\n]*完成页数::\s*(\d+)/g,  books,   false, true);
                parseAll(content, /\[\[([^\]]+)\]\]\s*进度::\s*(\d+)/g,         courses, false, true);
            }

            // ── Pass 2: scan backwards → baseline ────────────────────────
            // Shows: max 14 days; books & courses: max 365 days
            const priorNotes = dv.pages('"日记"')
                .where(p => p.file.folder.match(/^日记\/\d{4}$/) && p.file.day)
                .filter(p => {
                    const d = window.moment(String(p.file.day).slice(0, 10), "YYYY-MM-DD");
                    return d.isBefore(weekStart) && d.isSameOrAfter(longCutoff);
                })
                .sort(p => p.file.day, 'desc'); // newest first → stop early

            for (const note of priorNotes) {
                const d = window.moment(String(note.file.day).slice(0, 10), "YYYY-MM-DD");
                const inTvWindow = d.isSameOrAfter(tvCutoff);

                const needTv   = inTvWindow && [...shows.entries()].some(([,e]) => e.thisWeek != null && e.weekMin !== 1 && e.baseline === null);
                const needLong = [...books.entries()]  .some(([,e]) => e.thisWeek != null && e.weekMin !== 1 && e.baseline === null)
                              || [...courses.entries()].some(([,e]) => e.thisWeek != null && e.weekMin !== 1 && e.baseline === null);

                if (!needTv && !needLong) break;

                let content;
                try { content = await dv.io.load(note.file.path); } catch { continue; }

                if (needTv) parseAll(content, /\[\[([^\]]+)\]\][^\n]*看过集数::\s*(\d+)/g, shows,   true, false);
                            parseAll(content, /\[\[([^\]]+)\]\][^\n]*完成页数::\s*(\d+)/g, books,   true, false);
                            parseAll(content, /\[\[([^\]]+)\]\]\s*进度::\s*(\d+)/g,        courses, true, false);
            }

            // ── Movies: direct frontmatter query ─────────────────────────
            function inWeek(dateVal) {
                if (!dateVal) return false;
                const d = window.moment(String(dateVal).slice(0, 10), "YYYY-MM-DD");
                return d.isSameOrAfter(weekStart) && d.isSameOrBefore(weekEnd);
            }
            movies = dv.pages('"看电视"')
                .where(p => {
                    const types = p["种类"];
                    const isMovie = Array.isArray(types) ? types.includes("电影") : types === "电影";
                    return isMovie && (inWeek(p["看过日期"]) || inWeek(p["完成日期"]));
                })
                .map(p => ({ name: p.file.name, rating: p["个人评分"] ?? null }))
                .array();

            // ── Specials (stand-up etc): direct frontmatter query ─────────
            specials = dv.pages('"看电视"')
                .where(p => {
                    const types = p["种类"];
                    const isSpecial = Array.isArray(types) ? types.includes("专场") : types === "专场";
                    return isSpecial && (inWeek(p["看过日期"]) || inWeek(p["完成日期"]));
                })
                .map(p => ({ name: p.file.name, rating: p["个人评分"] ?? null }))
                .array();

            // ── Theatre shows: direct frontmatter query ───────────────────
            theatre = dv.pages('"Hobbies/Musical"')
                .where(p => inWeek(p["看过日期"]) || inWeek(p["完成日期"]))
                .map(p => ({ name: p.file.name, rating: p["个人评分"] ?? null }))
                .array();

            // Cache the results (serialize Maps as arrays)
            saveToCache({
                shows:   [...shows.entries()],
                books:   [...books.entries()],
                courses: [...courses.entries()],
                movies,
                theatre,
                specials,
            });
        }

        // ── Render ────────────────────────────────────────────────────
        let hasAny = false;

        function renderSection(icon, map, unit, barColor, useSquares, isFinished = () => false, iconHtml = null) {
            const items = [...map.entries()]
                .map(([name, d]) => {
                    const baseline = (d.weekMin === 1 || d.baseline === null) ? 0 : d.baseline;
                    return { name, delta: (d.thisWeek ?? 0) - baseline };
                })
                .filter(x => x.delta > 0)
                .sort((a, b) => b.delta - a.delta);
            if (!items.length) return;
            hasAny = true;
            const maxDelta = items[0].delta;
            const table = wrap.createEl('div', { attr: { style: 'margin:4px 0 8px 0; width:80%;' } });
            for (const item of items) {
                const row = table.createEl('div', { attr: { style: 'display:flex; align-items:center; gap:8px; margin:2px 0;' } });
                const nameWrap = row.createEl('div', { attr: { style: 'min-width:120px; flex-shrink:0; display:flex; align-items:center; gap:3px;' } });
                if (iconHtml !== null) {
                    const iconEl = nameWrap.createEl('span');
                    iconEl.innerHTML = iconHtml;
                }
                const label = nameWrap.createEl('a', { text: (iconHtml !== null ? '' : icon + ' ') + item.name, cls: 'internal-link',
                    attr: { style: 'cursor:pointer; font-size:.9em;' } });
                label.addEventListener('click', e => { e.preventDefault(); app.workspace.openLinkText(item.name, activeFile.path); });
                const finished = isFinished(item.name);
                if (useSquares) {
                    const squaresWrap = row.createEl('div', { attr: { style: 'display:flex; flex-wrap:wrap; gap:2px; align-items:center;' } });
                    for (let i = 0; i < item.delta; i++) {
                        squaresWrap.createEl('div', { attr: { style: `width:12px; height:12px; background:${barColor}; border-radius:2px;` } });
                    }
                    squaresWrap.createEl('span', { text: ` +${item.delta} ${unit}${finished ? ' ✔' : ''}`, attr: { style: 'font-size:.85em; color:var(--text-muted); margin-left:4px;' } });
                } else {
                    const barAndText = row.createEl('div', { attr: { style: 'display:flex; align-items:center; gap:6px;' } });
                    barAndText.createEl('div', { attr: { style: `width:${Math.round(item.delta / maxDelta * 200)}px; height:10px; background:${barColor}; border-radius:3px; flex-shrink:0;` } });
                    barAndText.createEl('span', { text: `+${item.delta} ${unit}${finished ? ' ✔' : ''}`, attr: { style: 'font-size:.85em; color:var(--text-muted);' } });
                }
            }
        }

        function renderListSection(icon, items) {
            if (!items.length) return;
            hasAny = true;
            const table = wrap.createEl('div', { attr: { style: 'margin:4px 0 8px 0; width:80%;' } });
            for (const item of items) {
                const row = table.createEl('div', { attr: { style: 'display:flex; align-items:center; gap:8px; margin:2px 0;' } });
                const label = row.createEl('a', { text: icon + ' ' + item.name, cls: 'internal-link',
                    attr: { style: 'min-width:120px; flex-shrink:0; cursor:pointer; font-size:.9em;' } });
                label.addEventListener('click', e => { e.preventDefault(); app.workspace.openLinkText(item.name, activeFile.path); });
                if (item.rating !== null && item.rating > 0) {
                    row.createEl('span', { text: '★'.repeat(item.rating), attr: { style: 'color:#f0b429; font-size:.85em;' } });
                }
            }
        }

        // Remove shows tagged 弃剧
        const abandoned = [...shows.keys()].filter(name => {
            const p = dv.page(name);
            return p?.file?.tags?.some(t => t === '#弃剧' || t === '弃剧');
        });
        abandoned.forEach(name => shows.delete(name));

        renderSection('📺', shows,   '集', '#A8D8EA', true, name => !!dv.page(name)?.["看过日期"], '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" style="vertical-align:middle;fill:currentColor;margin-right:2px"><rect x="2" y="3" width="20" height="14" rx="2"/><rect x="8" y="17" width="8" height="2"/><rect x="5" y="19" width="14" height="2" rx="1"/></svg>');
        renderSection('📚', books,   '页', '#B5E8C8', false);
        renderSection('🎓', courses, '节', '#F7C5A0', true);
        renderListSection('🎬', movies);
        renderListSection('🎤', specials);
        renderListSection('🎭', theatre);

        if (!hasAny) wrap.createEl('p', { text: '本周无记录', attr: { style: 'color:var(--text-muted);' } });

    } catch (err) {
        dv.paragraph('⚠️ ' + err.message);
    } finally {
        window[containerId + '_running'] = false;
    }
})();
```
