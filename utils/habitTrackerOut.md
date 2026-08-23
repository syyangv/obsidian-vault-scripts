---
modified_at: 2026-07-20
---
```dataviewjs
// ========================================
// 🛡️ 防崩溃版 - 出去玩记录热力图
// Crash-Proof Outings Heatmap
// ========================================

try {
    // ========================================
    // 配置区 Configuration
    // ========================================
    const CONFIG = {
        title: "🌳 出去玩记录",
        dailyNotesFolder: "日记",
        cacheTTLMinutes: 240,
        colors: {
            practiced: ["#ffd1dc", "#ffb6c1", "#f8a1b0"],
            notPracticed: ["#2d2d2d", "#2d2d2d", "#2d2d2d"]
        }
    };

    // ========================================
    // 注入 CSS 使方块变成正方形
    // ========================================
    // Plugin renders <ul class="heatmap-calendar-boxes"><li> — NOT SVG rects.
    const staleStyle = document.getElementById('heatmap-square-fix');
    if (staleStyle) staleStyle.remove();
    const fixStyle = document.createElement('style');
    fixStyle.id = 'heatmap-square-fix';
    fixStyle.textContent = `
        .heatmap-calendar-graph {
            width: 100% !important;
            grid-template-columns: auto 1fr !important;
            margin-top: 0 !important;
            margin-bottom: 3px !important;
            padding-top: 0 !important;
            padding-bottom: 0 !important;
        }
        .heatmap-calendar-boxes {
            display: grid !important;
            grid-template-columns: repeat(54, 1fr) !important;
            row-gap: 1.5px !important;
            column-gap: 1.5px !important;
        }
        .heatmap-calendar-boxes li { aspect-ratio: 1 !important; border-radius: 2px !important; }
    `;
    document.head.appendChild(fixStyle);

    // ========================================
    // 安全工具函数 Safe Utility Functions
    // ========================================
    
    const safeParseDate = (dateStr) => {
        try {
            if (!dateStr || typeof dateStr !== 'string') return null;
            const date = new Date(dateStr);
            return isNaN(date.getTime()) ? null : date;
        } catch (e) {
            return null;
        }
    };

    const safeGetProperty = (page, prop) => {
        try {
            if (!page || !prop) return undefined;
            return page[prop];
        } catch (e) {
            return undefined;
        }
    };

    // Check if outing occurred on a given page
    const hasOuting = (page) => {
        try {
            if (!page) return false;

            // Check tags for 出去玩
            const tags = safeGetProperty(page, 'tags');
            if (tags) {
                const tagArray = Array.isArray(tags) ? tags : [tags];
                for (let tag of tagArray) {
                    try {
                        if (tag && typeof tag === 'string' && tag.includes('出去玩')) {
                            return true;
                        }
                        if (tag && typeof tag === 'object' && tag.path && tag.path.includes('出去玩')) {
                            return true;
                        }
                    } catch (e) {
                        continue;
                    }
                }
            }

            // Check activity_tags for 出去玩
            const activityTags = safeGetProperty(page, 'activity_tags');
            if (activityTags) {
                const activityTagArray = Array.isArray(activityTags) ? activityTags : [activityTags];
                for (let tag of activityTagArray) {
                    try {
                        if (tag && typeof tag === 'string' && tag.includes('出去玩')) {
                            return true;
                        }
                        if (tag && typeof tag === 'object' && tag.path && tag.path.includes('出去玩')) {
                            return true;
                        }
                    } catch (e) {
                        continue;
                    }
                }
            }

            return false;
        } catch (e) {
            return false;
        }
    };

    // ========================================
    // 缓存工具函数 Cache Utility Functions
    // ========================================
    const CACHE_KEY = 'outings-heatmap-data-v1';

    const loadFromCache = () => {
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            const ageMinutes = (Date.now() - data.timestamp) / 60000;
            if (ageMinutes > CONFIG.cacheTTLMinutes) return null;
            return {
                outingDates: new Set(data.outingDates),
                yearsWithEvents: new Set(data.yearsWithEvents),
                cachedAt: new Date(data.timestamp)
            };
        } catch (e) { return null; }
    };

    const saveToCache = (sets) => {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                timestamp: Date.now(),
                outingDates: [...sets.outingDates],
                yearsWithEvents: [...sets.yearsWithEvents]
            }));
        } catch (e) {}
    };

    const clearCache = () => {
        try { localStorage.removeItem(CACHE_KEY); } catch (e) {}
    };

    // ========================================
    // 收集所有年份和日记数据
    // ========================================

    let outingDates, yearsWithEvents;
    let cachedAt = null;

    const cached = loadFromCache();
    if (cached) {
        ({ outingDates, yearsWithEvents, cachedAt } = cached);
    } else {
        outingDates = new Set();
        yearsWithEvents = new Set();

        try {
            const allNotes = dv.pages(`"${CONFIG.dailyNotesFolder}"`);
            let notesList = [];

            if (allNotes && allNotes.values) {
                notesList = allNotes.values;
            } else if (allNotes && typeof allNotes[Symbol.iterator] === 'function') {
                notesList = Array.from(allNotes);
            }

            for (let page of notesList) {
                try {
                    const fileName = page?.file?.name;
                    if (!fileName) continue;

                    const dateMatch = fileName.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                    if (!dateMatch) continue;

                    const year = dateMatch[1];

                    if (hasOuting(page)) {
                        outingDates.add(fileName);
                        yearsWithEvents.add(year);
                    }
                } catch (e) {
                    continue;
                }
            }
        } catch (e) {
            console.error("Error fetching daily notes:", e);
        }

        saveToCache({ outingDates, yearsWithEvents });
    }

    const yearsList = Array.from(yearsWithEvents).sort().reverse();

    if (yearsList.length === 0) {
        dv.paragraph("No daily notes found in 日记 folder.");
        throw new Error("EXIT_EARLY");
    }

    // ========================================
    // 检查热力图插件是否可用
    // ========================================
    if (typeof renderHeatmapCalendar !== 'function') {
        dv.span("⚠️ 热力图插件未加载。请确保已安装 Heatmap Calendar 插件。");
        throw new Error("Heatmap Calendar plugin not available");
    }

    // ========================================
    // 计算统计数据
    // ========================================
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentYear = today.getFullYear().toString();

    // ========================================
    // 生成并渲染每年的热力图
    // ========================================
    
    const uid = 'outings-hm-' + Math.random().toString(36).substr(2, 9);

    const container = dv.container;
    if (!container) {
        throw new Error("Container not available");
    }

    const wrapper = container.createEl('div');

    const style = wrapper.createEl('style');
    style.textContent = `
        .${uid}-btn {
            padding: 8px 16px;
            margin: 5px;
            border: 2px solid rgba(255, 182, 193, 0.5);
            background: transparent;
            color: var(--text-normal);
            cursor: pointer;
            border-radius: 5px;
            font-size: 14px;
            transition: all 0.2s;
        }
        .${uid}-btn:hover {
            background: rgba(255, 182, 193, 0.2);
            border-color: rgba(255, 182, 193, 0.8);
        }
        .${uid}-btn.active {
            background: rgba(255, 182, 193, 0.4);
            border-color: rgba(255, 182, 193, 1);
            font-weight: bold;
        }
        .${uid}-title {
            font-weight: bold;
            font-size: 1.2em;
            margin-bottom: 10px;
        }
        .${uid}-count {
            font-size: 1.1em;
            margin-bottom: 15px;
        }
    `;

    // Create title with Sims squircle icon (sun — sage)
    const titleRow = wrapper.createEl('div', { attr: { style: 'display:flex;align-items:center;gap:10px;margin-bottom:10px;' } });
    const iconEl = titleRow.createEl('span', { attr: { style: 'display:inline-flex;width:32px;height:32px;flex-shrink:0;background-image:url(\'data:image/png;base64,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\');background-size:contain;background-repeat:no-repeat;background-position:center;' } });
    const titleDiv = titleRow.createEl('div', { cls: `${uid}-title`, attr: { style: 'margin-bottom:0;' } });
    titleDiv.textContent = '出去玩记录';

    // Cache status and refresh button
    const cacheBar = wrapper.createEl('div', {
        attr: { style: 'display:flex; align-items:center; gap:12px; margin-bottom:10px; font-size:0.85em; color:var(--text-muted);' }
    });
    if (cachedAt) {
        const ageMinutes = Math.round((Date.now() - cachedAt.getTime()) / 60000);
        const ageText = ageMinutes < 60 ? `${ageMinutes}分钟前` : `${Math.round(ageMinutes / 60)}小时前`;
        cacheBar.createEl('span', { text: `📦 缓存于${ageText}` });
    }
    const refreshBtn = cacheBar.createEl('button', { text: '↺ 刷新数据' });
    refreshBtn.style.cssText = 'padding:2px 10px; border-radius:4px; cursor:pointer; border:1px solid var(--background-modifier-border); background:var(--background-secondary); color:var(--text-normal); font-size:0.85em;';
    refreshBtn.addEventListener('click', async () => {
        clearCache();
        const file = app.workspace.getActiveFile();
        await app.workspace.activeLeaf.openFile(file, { active: true });
    });

    // Create count display (will be updated when switching years)
    const countDiv = wrapper.createEl('div', { cls: `${uid}-count` });

    const tabsContainer = wrapper.createEl('div');
    tabsContainer.style.display = 'flex';
    tabsContainer.style.flexWrap = 'wrap';
    tabsContainer.style.gap = '5px';
    tabsContainer.style.marginBottom = '20px';

    const contentContainer = wrapper.createEl('div');

    const buttons = {};

    // Pre-generate entries for each year
    const yearEntries = {};
    const yearStats = {};

    for (let year of yearsList) {
        try {
            const entries = [];
            let practicedCount = 0;

            for (let month = 0; month < 12; month++) {
                const daysInMonth = new Date(parseInt(year), month + 1, 0).getDate();
                for (let day = 1; day <= daysInMonth; day++) {
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const dateObj = safeParseDate(dateStr);

                    if (!dateObj) continue;
                    if (dateObj > today) continue;

                    if (outingDates.has(dateStr)) {
                        entries.push({
                            date: dateStr,
                            intensity: 3,
                            color: "practiced"
                        });
                        practicedCount++;
                    }
                }
            }

            yearEntries[year] = entries;
            yearStats[year] = { practiced: practicedCount };
        } catch (e) {
            console.error(`Error processing year ${year}:`, e);
            yearEntries[year] = [];
            yearStats[year] = { practiced: 0 };
        }
    }

    function renderYearHeatmap(year) {
        try {
            contentContainer.innerHTML = '';

            const stats = yearStats[year] || { practiced: 0 };
            const entries = yearEntries[year] || [];

            // Update the count display
            countDiv.innerHTML = `${year}年: <strong>${stats.practiced}</strong> 天`;

            const heatmapDiv = contentContainer.createEl('div');

            const calendarData = {
                year: parseInt(year),
                colors: {
                    practiced: CONFIG.colors.practiced,
                    notPracticed: CONFIG.colors.notPracticed
                },
                showCurrentDayBorder: true,
                defaultEntryIntensity: 1,
                entries: entries
            };

            renderHeatmapCalendar(heatmapDiv, calendarData);
        } catch (e) {
            console.error(`Error rendering heatmap for year ${year}:`, e);
            contentContainer.innerHTML = `<p style="color: var(--text-muted);">⚠️ 渲染${year}年热力图时出错</p>`;
        }
    }

    function switchToYear(year) {
        try {
            for (let y of yearsList) {
                if (buttons[y]) {
                    buttons[y].classList.remove('active');
                }
            }
            if (buttons[year]) {
                buttons[year].classList.add('active');
            }

            renderYearHeatmap(year);
        } catch (e) {
            console.error("Error switching year:", e);
            contentContainer.innerHTML = `<p style="color: var(--text-muted);">Error switching years.</p>`;
        }
    }

    const defaultYear = yearsList.includes(currentYear) ? currentYear : yearsList[0];

    for (let year of yearsList) {
        try {
            const btn = tabsContainer.createEl('button', {
                text: year,
                cls: `${uid}-btn` + (year === defaultYear ? ' active' : '')
            });

            buttons[year] = btn;

            btn.addEventListener('click', () => {
                switchToYear(year);
            });
        } catch (btnError) {
            continue;
        }
    }

    renderYearHeatmap(defaultYear);

} catch (error) {
    if (error.message !== "EXIT_EARLY") {
        console.error("出去玩记录热力图错误:", error);
        dv.paragraph(`<div style="padding: 20px; border: 1px solid rgba(220, 150, 150, 0.5); border-radius: 8px; background: rgba(220, 150, 150, 0.1);">
            <p style="margin: 0; color: var(--text-muted);">⚠️ 发生错误: ${error.message || '未知错误'}</p>
        </div>`);
    }
}
```