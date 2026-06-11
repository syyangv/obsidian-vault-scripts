---
modified_at: 2026-03-03
---
```dataviewjs
// ========================================
// 🛡️ 防崩溃版 - 食谱记录热力图
// Crash-Proof Recipe Heatmap
// ========================================

try {
    // ========================================
    // 配置区 Configuration
    // ========================================
    const CONFIG = {
        title: "🍳 食谱记录",
        dailyNotesFolder: "日记",
        recipeFolder: "Hobbies/做饭/Recipes",
        sectionHeading: "笔记",
        cacheTTLMinutes: 240,
        colors: {
            practiced: ["#ffd699", "#ffb347", "#ff8c00"],
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
                    // Check for section heading - handles formats like:
                    // # 笔记
                    // ## 笔记
                    // # 2 笔记
                    // ## 2. 笔记
                    const headingMatch = line.match(/^(#+)\s*(\d+\.?\s*)?(.+)$/);
                    if (headingMatch) {
                        const headingText = headingMatch[3].trim();
                        if (headingText === CONFIG.sectionHeading || headingText.startsWith(CONFIG.sectionHeading)) {
                            inNotesSection = true;
                            continue;
                        } else if (inNotesSection) {
                            // Left the section
                            break;
                        }
                    }

                    if (inNotesSection) {
                        // Look for wiki links [[note]] or [[note|alias]]
                        const wikiLinkMatches = line.matchAll(/\[\[([^\|\]]+)(?:\|[^\]]+)?\]\]/g);
                        for (let match of wikiLinkMatches) {
                            const linkTarget = match[1].trim();
                            // Check if link target matches a recipe note
                            // Handle both full path and just note name
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
    // 缓存工具函数 Cache Utility Functions
    // ========================================
    const CACHE_KEY = 'cooking-only-heatmap-data-v1';

    const loadFromCache = () => {
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            const ageMinutes = (Date.now() - data.timestamp) / 60000;
            if (ageMinutes > CONFIG.cacheTTLMinutes) return null;
            return {
                recipeDates: new Set(data.recipeDates),
                yearsWithEvents: new Set(data.yearsWithEvents),
                cachedAt: new Date(data.timestamp)
            };
        } catch (e) { return null; }
    };

    const saveToCache = (sets) => {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                timestamp: Date.now(),
                recipeDates: [...sets.recipeDates],
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

    let recipeDates, yearsWithEvents;
    let cachedAt = null;

    const cached = loadFromCache();
    if (cached) {
        ({ recipeDates, yearsWithEvents, cachedAt } = cached);
    } else {
        recipeDates = new Set();
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

                    if (await hasRecipeLink(page)) {
                        recipeDates.add(fileName);
                        yearsWithEvents.add(year);
                    }
                } catch (e) {
                    continue;
                }
            }
        } catch (e) {
            console.error("Error fetching daily notes:", e);
        }

        saveToCache({ recipeDates, yearsWithEvents });
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
    
    const uid = 'recipe-hm-' + Math.random().toString(36).substr(2, 9);

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
            border: 2px solid rgba(255, 179, 71, 0.5);
            background: transparent;
            color: var(--text-normal);
            cursor: pointer;
            border-radius: 5px;
            font-size: 14px;
            transition: all 0.2s;
        }
        .${uid}-btn:hover {
            background: rgba(255, 179, 71, 0.2);
            border-color: rgba(255, 179, 71, 0.8);
        }
        .${uid}-btn.active {
            background: rgba(255, 179, 71, 0.4);
            border-color: rgba(255, 179, 71, 1);
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

    // Create title with Sims squircle icon (flame — amber)
    const titleRow = wrapper.createEl('div', { attr: { style: 'display:flex;align-items:center;gap:10px;margin-bottom:10px;' } });
    const iconEl = titleRow.createEl('span', { attr: { style: 'display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:28%;background:linear-gradient(145deg,#e89040,#804010);box-shadow:inset 0 2px 0 rgba(255,255,255,.45),inset 0 -1px 0 rgba(0,0,0,.3),0 2px 5px rgba(0,0,0,.4);flex-shrink:0;' } });
    iconEl.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3Q10 6 12 9Q14 12 12 15"/><path d="M7 5Q5 8 7 11Q9 14 7 17"/><path d="M17 5Q15 8 17 11Q19 14 17 17"/><line x1="4" y1="20" x2="20" y2="20"/></svg>`;
    const titleDiv = titleRow.createEl('div', { cls: `${uid}-title`, attr: { style: 'margin-bottom:0;' } });
    titleDiv.textContent = '食谱记录';

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
                    
                    if (recipeDates.has(dateStr)) {
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
        console.error("食谱记录热力图错误:", error);
        dv.paragraph(`<div style="padding: 20px; border: 1px solid rgba(220, 150, 150, 0.5); border-radius: 8px; background: rgba(220, 150, 150, 0.1);">
            <p style="margin: 0; color: var(--text-muted);">⚠️ 发生错误: ${error.message || '未知错误'}</p>
        </div>`);
    }
}
```