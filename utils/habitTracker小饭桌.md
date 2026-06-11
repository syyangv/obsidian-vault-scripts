---
modified_at: 2026-03-16
---
```dataviewjs
// ========================================
// 🍳🍱 小饭桌 + 食谱记录 综合热力图
// Combined Cooking & Meal Prep Heatmap
// Different colors for each type
// ========================================

try {
    // ========================================
    // 配置区 Configuration
    // ========================================
    const CONFIG = {
        title: "🍳 下厨记录",
        dailyNotesFolder: "日记",
        recipeFolder: "Hobbies/做饭/Recipes",
        sectionHeading: "笔记",
        habitProperty: "小饭桌",
        cacheTTLMinutes: 240,  // Re-scan all diary files every 4 hours; lower if you log cooking same-day
        batchSize: 20,         // Concurrent file reads per batch
        colors: {
            xiaofanzhuo: ["#fce4ec", "#ec407a", "#c2185b"],  // Dark magenta for 小饭桌
            recipe: ["#b2dfdb", "#4db6ac", "#00897b"],       // Teal for recipes
            both: ["#c8e6c9", "#81c784", "#43a047"],         // Green for both
            waimai: ["#fffde7", "#ffd54f", "#f9a825"],        // Yellow-orange for 外卖
            waishi: ["#f8f4ff", "#cdb8f0", "#9b6fd4"]         // Pale, slightly muted lavender for 外食
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

    const isHabitCompleted = (value) => {
        try {
            return value === true ||
                   value === "true" ||
                   value === 1 ||
                   value === "1" ||
                   value === "yes" ||
                   value === "是";
        } catch (e) {
            return false;
        }
    };

    // ========================================
    // 缓存工具函数 Cache Utility Functions
    // ========================================
    const CACHE_KEY = 'cooking-heatmap-data-v2';

    const loadFromCache = () => {
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            const ageMinutes = (Date.now() - data.timestamp) / 60000;
            if (ageMinutes > CONFIG.cacheTTLMinutes) return null;
            return {
                xiaofanzhuoDates: new Set(data.xiaofanzhuoDates),
                recipeDates: new Set(data.recipeDates),
                bothDates: new Set(data.bothDates),
                waimaiDates: new Set(data.waimaiDates),
                waimaiAllDates: new Set(data.waimaiAllDates),
                waishiDates: new Set(data.waishiDates),
                waishiAllDates: new Set(data.waishiAllDates),
                yearsWithEvents: new Set(data.yearsWithEvents),
                cachedAt: new Date(data.timestamp)
            };
        } catch (e) { return null; }
    };

    const saveToCache = (sets) => {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                timestamp: Date.now(),
                xiaofanzhuoDates: [...sets.xiaofanzhuoDates],
                recipeDates: [...sets.recipeDates],
                bothDates: [...sets.bothDates],
                waimaiDates: [...sets.waimaiDates],
                waimaiAllDates: [...sets.waimaiAllDates],
                waishiDates: [...sets.waishiDates],
                waishiAllDates: [...sets.waishiAllDates],
                yearsWithEvents: [...sets.yearsWithEvents]
            }));
        } catch (e) {}
    };

    const clearCache = () => {
        try { localStorage.removeItem(CACHE_KEY); } catch (e) {}
    };

    // ========================================
    // 获取 Recipes 文件夹中所有笔记名称
    // ========================================
    const recipeNotes = new Set();
    try {
        const recipePages = dv.pages(`"${CONFIG.recipeFolder}"`);
        let recipeList = [];

        if (recipePages && recipePages.values) {
            recipeList = recipePages.values;
        } else if (recipePages && typeof recipePages[Symbol.iterator] === 'function') {
            recipeList = Array.from(recipePages);
        }

        for (let page of recipeList) {
            try {
                if (page?.file?.name) {
                    recipeNotes.add(page.file.name);
                }
            } catch (e) {
                continue;
            }
        }
    } catch (e) {
        console.error("Error fetching recipe notes:", e);
    }

    // ========================================
    // 检查日记中是否有食谱链接
    // ========================================
    const hasRecipeLink = async (page) => {
        try {
            if (!page?.file?.path) return false;

            const file = app.vault.getAbstractFileByPath(page.file.path);
            if (!file) return false;

            const content = await app.vault.cachedRead(file);
            if (!content || typeof content !== 'string') return false;

            const lines = content.split('\n');

            let inNotesSection = false;

            for (let line of lines) {
                try {
                    // Check for section heading
                    const headingMatch = line.match(/^(#+)\s*(\d+\.?\s*)?(.+)$/);
                    if (headingMatch) {
                        const headingText = headingMatch[3].trim();
                        if (headingText === CONFIG.sectionHeading || headingText.startsWith(CONFIG.sectionHeading)) {
                            inNotesSection = true;
                            continue;
                        } else if (inNotesSection) {
                            break;
                        }
                    }

                    if (inNotesSection) {
                        // Look for wiki links [[note]] or [[note|alias]]
                        const wikiLinkMatches = line.matchAll(/\[\[([^\|\]]+)(?:\|[^\]]+)?\]\]/g);
                        for (let match of wikiLinkMatches) {
                            const linkTarget = match[1].trim();
                            const linkName = linkTarget.includes('/') ? linkTarget.split('/').pop() : linkTarget;
                            if (recipeNotes.has(linkName) || recipeNotes.has(linkTarget)) {
                                return true;
                            }
                        }
                    }
                } catch (lineError) {
                    continue;
                }
            }

            return false;
        } catch (e) {
            return false;
        }
    };

    // ========================================
    // 收集所有年份和日记数据（带缓存）
    // ========================================

    let xiaofanzhuoDates, recipeDates, bothDates, waimaiDates, waimaiAllDates, waishiDates, waishiAllDates, yearsWithEvents;
    let cachedAt = null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentYear = today.getFullYear().toString();

    const cached = loadFromCache();
    if (cached) {
        ({ xiaofanzhuoDates, recipeDates, bothDates, waimaiDates, waimaiAllDates, waishiDates, waishiAllDates, yearsWithEvents, cachedAt } = cached);
    } else {
        xiaofanzhuoDates = new Set();
        recipeDates = new Set();
        bothDates = new Set();
        waimaiDates = new Set();
        waimaiAllDates = new Set();
        waishiDates = new Set();
        waishiAllDates = new Set();
        yearsWithEvents = new Set();

        try {
            const allNotes = dv.pages(`"${CONFIG.dailyNotesFolder}"`);
            let notesList = [];

            if (allNotes && allNotes.values) {
                notesList = allNotes.values;
            } else if (allNotes && typeof allNotes[Symbol.iterator] === 'function') {
                notesList = Array.from(allNotes);
            }

            // Filter to date-named notes only
            notesList = notesList.filter(p => p?.file?.name && /^\d{4}-\d{2}-\d{2}$/.test(p.file.name));

            // Process one page: reads frontmatter (sync) + file content (async)
            const processPage = async (page) => {
                try {
                    const fileName = page.file.name;
                    const year = fileName.slice(0, 4);

                    const hasHabit = isHabitCompleted(safeGetProperty(page, CONFIG.habitProperty));
                    const hasRecipe = await hasRecipeLink(page);
                    const hasWaimai = isHabitCompleted(safeGetProperty(page, '外卖'));
                    const hasWaishi = isHabitCompleted(safeGetProperty(page, '外食'));

                    if (hasWaimai) { waimaiAllDates.add(fileName); yearsWithEvents.add(year); }
                    if (hasWaishi) { waishiAllDates.add(fileName); yearsWithEvents.add(year); }

                    if (hasHabit && hasRecipe) {
                        bothDates.add(fileName); yearsWithEvents.add(year);
                    } else if (hasHabit) {
                        xiaofanzhuoDates.add(fileName); yearsWithEvents.add(year);
                    } else if (hasRecipe) {
                        recipeDates.add(fileName); yearsWithEvents.add(year);
                    } else if (hasWaishi) {
                        waishiDates.add(fileName);
                    } else if (hasWaimai) {
                        waimaiDates.add(fileName);
                    }
                } catch (e) {}
            };

            // Read CONFIG.batchSize files concurrently instead of one at a time
            for (let i = 0; i < notesList.length; i += CONFIG.batchSize) {
                await Promise.all(notesList.slice(i, i + CONFIG.batchSize).map(processPage));
            }
        } catch (e) {
            console.error("Error fetching daily notes:", e);
        }

        saveToCache({ xiaofanzhuoDates, recipeDates, bothDates, waimaiDates, waimaiAllDates, waishiDates, waishiAllDates, yearsWithEvents });
    }

    const yearsList = Array.from(yearsWithEvents).sort().reverse();

    if (yearsList.length === 0) {
        dv.paragraph("暂无下厨记录。在日记中将 **小饭桌** 设为 true，或在笔记区域链接食谱即可开始记录。");
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
    // 生成并渲染每年的热力图
    // ========================================

    const uid = 'cooking-combined-hm-' + Math.random().toString(36).substr(2, 9);

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
            border: 2px solid rgba(194, 24, 91, 0.5);
            background: transparent;
            color: var(--text-normal);
            cursor: pointer;
            border-radius: 5px;
            font-size: 14px;
            transition: all 0.2s;
        }
        .${uid}-btn:hover {
            background: rgba(194, 24, 91, 0.2);
            border-color: rgba(194, 24, 91, 0.8);
        }
        .${uid}-btn.active {
            background: rgba(194, 24, 91, 0.4);
            border-color: rgba(194, 24, 91, 1);
            font-weight: bold;
        }
        .${uid}-title {
            font-weight: bold;
            font-size: 1.2em;
            margin-bottom: 10px;
        }
        .${uid}-stats {
            font-size: 1.1em;
            margin-bottom: 15px;
            line-height: 1.6;
        }
        .${uid}-legend {
            display: flex;
            gap: 20px;
            margin-bottom: 15px;
            flex-wrap: wrap;
        }
        .${uid}-legend-item {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.9em;
        }
        .${uid}-legend-color {
            width: 12px;
            height: 12px;
            border-radius: 2px;
        }
    `;

    // Create title with Sims squircle icon (pot — coral)
    const titleRow = wrapper.createEl('div', { attr: { style: 'display:flex;align-items:center;gap:10px;margin-bottom:10px;' } });
    const iconEl = titleRow.createEl('span', { attr: { style: 'display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:28%;background:linear-gradient(145deg,#ff7060,#902010);box-shadow:inset 0 2px 0 rgba(255,255,255,.45),inset 0 -1px 0 rgba(0,0,0,.3),0 2px 5px rgba(0,0,0,.4);flex-shrink:0;' } });
    iconEl.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3L6 10Q6 13 12 13Q18 13 18 10L18 3"/><line x1="12" y1="13" x2="12" y2="20"/><line x1="8" y1="20" x2="16" y2="20"/><line x1="9" y1="3" x2="9" y2="8"/><line x1="12" y1="3" x2="12" y2="8"/><line x1="15" y1="3" x2="15" y2="8"/></svg>`;
    const titleDiv = titleRow.createEl('div', { cls: `${uid}-title`, attr: { style: 'margin-bottom:0;' } });
    titleDiv.textContent = '下厨记录';

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
        const filePath = dv.current().file.path;
        const tfile = app.vault.getAbstractFileByPath(filePath);
        if (!tfile) return;
        const leaf = app.workspace.getLeavesOfType('markdown')
            .find(l => l.view?.file?.path === filePath);
        if (leaf) await leaf.openFile(tfile);
    });

    // Filter state: tracks which color categories are currently visible
    let currentDisplayYear = null;
    const visibleColors = new Set(["xiaofanzhuo", "recipe", "both", "waishi", "waimai"]);

    // Create legend
    const legendDiv = wrapper.createEl('div', { cls: `${uid}-legend` });

    const legendItems = [
        { color: CONFIG.colors.xiaofanzhuo[2], label: "🍱 小饭桌", category: "xiaofanzhuo" },
        { color: CONFIG.colors.recipe[2], label: "🍳 食谱", category: "recipe" },
        { color: CONFIG.colors.waishi[2], label: "🍽️ 外食", category: "waishi" },
        { color: CONFIG.colors.waimai[2], label: "🥡 外卖", category: "waimai" }
    ];

    const legendElems = {};

    const updateLegendVisuals = () => {
        for (const [cat, el] of Object.entries(legendElems)) {
            const active = visibleColors.has(cat);
            el.item.style.opacity = active ? '1' : '0.3';
            el.span.style.textDecoration = active ? 'none' : 'line-through';
        }
    };

    for (const item of legendItems) {
        const legendItem = legendDiv.createEl('div', { cls: `${uid}-legend-item` });
        legendItem.style.cursor = 'pointer';
        legendItem.style.userSelect = 'none';
        legendItem.style.transition = 'opacity 0.2s';
        const colorBox = legendItem.createEl('div', { cls: `${uid}-legend-color` });
        colorBox.style.backgroundColor = item.color;
        const labelSpan = legendItem.createEl('span', { text: item.label });
        legendElems[item.category] = { item: legendItem, span: labelSpan };

        legendItem.addEventListener('click', () => {
            if (visibleColors.has(item.category)) {
                visibleColors.delete(item.category);
            } else {
                visibleColors.add(item.category);
            }
            // "both" (green) shows only when both cooking categories are active
            if (visibleColors.has("xiaofanzhuo") && visibleColors.has("recipe")) {
                visibleColors.add("both");
            } else {
                visibleColors.delete("both");
            }
            updateLegendVisuals();
            if (currentDisplayYear) renderYearHeatmap(currentDisplayYear);
        });
    }

    // Create stats display (will be updated when switching years)
    const statsDiv = wrapper.createEl('div', { cls: `${uid}-stats` });

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
            let xiaofanzhuoCount = 0;
            let recipeCount = 0;
            let bothCount = 0;
            let waimaiCount = 0;
            let waishiCount = 0;

            for (let month = 0; month < 12; month++) {
                const daysInMonth = new Date(parseInt(year), month + 1, 0).getDate();
                for (let day = 1; day <= daysInMonth; day++) {
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const dateObj = safeParseDate(dateStr);

                    if (!dateObj) continue;
                    if (dateObj > today) continue;

                    // Count all eating-out days in stats (including when cooking also happened)
                    if (waimaiAllDates.has(dateStr)) waimaiCount++;
                    if (waishiAllDates.has(dateStr)) waishiCount++;

                    // Heatmap display: cooking takes priority over 外卖
                    if (bothDates.has(dateStr)) {
                        entries.push({
                            date: dateStr,
                            intensity: 3,
                            color: "both"
                        });
                        bothCount++;
                    } else if (xiaofanzhuoDates.has(dateStr)) {
                        entries.push({
                            date: dateStr,
                            intensity: 3,
                            color: "xiaofanzhuo"
                        });
                        xiaofanzhuoCount++;
                    } else if (recipeDates.has(dateStr)) {
                        entries.push({
                            date: dateStr,
                            intensity: 3,
                            color: "recipe"
                        });
                        recipeCount++;
                    } else if (waishiDates.has(dateStr)) {
                        entries.push({
                            date: dateStr,
                            intensity: 3,
                            color: "waishi"
                        });
                    } else if (waimaiDates.has(dateStr)) {
                        entries.push({
                            date: dateStr,
                            intensity: 3,
                            color: "waimai"
                        });
                    }
                }
            }

            yearEntries[year] = entries;
            yearStats[year] = {
                xiaofanzhuo: xiaofanzhuoCount,
                recipe: recipeCount,
                both: bothCount,
                waimai: waimaiCount,
                waishi: waishiCount,
                total: xiaofanzhuoCount + recipeCount + bothCount + waimaiCount + waishiCount
            };
        } catch (e) {
            console.error(`Error processing year ${year}:`, e);
            yearEntries[year] = [];
            yearStats[year] = { xiaofanzhuo: 0, recipe: 0, both: 0, waimai: 0, waishi: 0, total: 0 };
        }
    }

    function renderYearHeatmap(year) {
        try {
            currentDisplayYear = year;
            contentContainer.innerHTML = '';

            const stats = yearStats[year] || { xiaofanzhuo: 0, recipe: 0, both: 0, waimai: 0, waishi: 0, total: 0 };
            const entries = (yearEntries[year] || []).filter(e => visibleColors.has(e.color));

            // Update the stats display
            statsDiv.innerHTML = `${year}年: <strong>${stats.total}</strong> 天 ` +
                `<span style="color: ${CONFIG.colors.xiaofanzhuo[2]};">(🍱 ${stats.xiaofanzhuo})</span> ` +
                `<span style="color: ${CONFIG.colors.recipe[2]};">(🍳 ${stats.recipe})</span> ` +
                `<span style="color: ${CONFIG.colors.waishi[2]};">(🍽️ ${stats.waishi})</span> ` +
                `<span style="color: ${CONFIG.colors.waimai[2]};">(🥡 ${stats.waimai})</span>`;

            const heatmapDiv = contentContainer.createEl('div');

            const calendarData = {
                year: parseInt(year),
                colors: {
                    xiaofanzhuo: CONFIG.colors.xiaofanzhuo,
                    recipe: CONFIG.colors.recipe,
                    both: CONFIG.colors.both,
                    waishi: CONFIG.colors.waishi,
                    waimai: CONFIG.colors.waimai
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
        console.error("下厨记录热力图错误:", error);
        try {
            const p = dv.container.createEl('p');
            p.style.cssText = 'padding:12px; border:1px solid rgba(220,150,150,0.5); border-radius:8px; background:rgba(220,150,150,0.1); color:var(--text-muted); margin:8px 0;';
            p.textContent = '⚠️ 发生错误: ' + (error.message || '未知错误');
        } catch (e) {}
    }
}
```
