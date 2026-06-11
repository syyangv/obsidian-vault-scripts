---
modified_at: 2026-03-03
---
```dataviewjs
// ========================================
// 🛡️ 防崩溃版 - 过敏科就诊热力图
// Crash-Proof Allergist Visit Heatmap
// ========================================

try {
    // ========================================
    // 配置区 Configuration
    // ========================================
    const CONFIG = {
        title: "🤧 过敏科就诊记录",
        dailyNotesFolder: "日记",
        colors: {
            practiced: ["#a8d8c8", "#5fbfa0", "#2e9e7a"],
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

    // Check if allergist visit occurred on a given page
    const hasAllergistVisit = (page) => {
        try {
            if (!page) return false;

            // Check medical_tags for allergist
            const medicalTags = safeGetProperty(page, 'medical_tags');
            if (medicalTags) {
                const tagArray = Array.isArray(medicalTags) ? medicalTags : [medicalTags];
                for (let tag of tagArray) {
                    try {
                        if (tag && typeof tag === 'string' && tag.toLowerCase().includes('allergist')) {
                            return true;
                        }
                        if (tag && typeof tag === 'object' && tag.path && tag.path.toLowerCase().includes('allergist')) {
                            return true;
                        }
                    } catch (e) {
                        continue;
                    }
                }
            }

            // Check tags for allergist
            const tags = safeGetProperty(page, 'tags');
            if (tags) {
                const tagArray = Array.isArray(tags) ? tags : [tags];
                for (let tag of tagArray) {
                    try {
                        if (tag && typeof tag === 'string' && tag.toLowerCase().includes('allergist')) {
                            return true;
                        }
                        if (tag && typeof tag === 'object' && tag.path && tag.path.toLowerCase().includes('allergist')) {
                            return true;
                        }
                    } catch (e) {
                        continue;
                    }
                }
            }

            // Check activity_tags for allergist
            const activityTags = safeGetProperty(page, 'activity_tags');
            if (activityTags) {
                const activityTagArray = Array.isArray(activityTags) ? activityTags : [activityTags];
                for (let tag of activityTagArray) {
                    try {
                        if (tag && typeof tag === 'string' && tag.toLowerCase().includes('allergist')) {
                            return true;
                        }
                        if (tag && typeof tag === 'object' && tag.path && tag.path.toLowerCase().includes('allergist')) {
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
    // 收集所有年份和日记数据
    // ========================================

    const availableYears = new Set();
    const allergistDates = new Set();
    const yearsWithEvents = new Set();

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
                availableYears.add(year);

                if (hasAllergistVisit(page)) {
                    allergistDates.add(fileName);
                    yearsWithEvents.add(year);
                }
            } catch (e) {
                continue;
            }
        }
    } catch (e) {
        console.error("Error fetching daily notes:", e);
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

    const uid = 'allergist-hm-' + Math.random().toString(36).substr(2, 9);

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
            border: 2px solid rgba(95, 191, 160, 0.5);
            background: transparent;
            color: var(--text-normal);
            cursor: pointer;
            border-radius: 5px;
            font-size: 14px;
            transition: all 0.2s;
        }
        .${uid}-btn:hover {
            background: rgba(95, 191, 160, 0.2);
            border-color: rgba(95, 191, 160, 0.8);
        }
        .${uid}-btn.active {
            background: rgba(95, 191, 160, 0.4);
            border-color: rgba(95, 191, 160, 1);
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

    // Create title with Sims squircle icon (medical cross)
    const titleRow = wrapper.createEl('div', {
        attr: { style: 'display:flex; align-items:center; gap:10px; margin-bottom:10px;' }
    });
    const iconEl = titleRow.createEl('span', {
        attr: { style: 'display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:28%;background:linear-gradient(145deg,#3aa4c2,#094a63);box-shadow:inset 0 2px 0 rgba(255,255,255,.45),inset 0 -1px 0 rgba(0,0,0,.3),0 2px 5px rgba(0,0,0,.4);flex-shrink:0;' }
    });
    const NS_a = 'http://www.w3.org/2000/svg';
    const svg_a = document.createElementNS(NS_a, 'svg');
    svg_a.setAttribute('width', '18'); svg_a.setAttribute('height', '18');
    svg_a.setAttribute('viewBox', '0 0 18 18'); svg_a.setAttribute('fill', 'white');
    const crossH = document.createElementNS(NS_a, 'rect');
    crossH.setAttribute('x', '3'); crossH.setAttribute('y', '7.5');
    crossH.setAttribute('width', '12'); crossH.setAttribute('height', '3'); crossH.setAttribute('rx', '1');
    const crossV = document.createElementNS(NS_a, 'rect');
    crossV.setAttribute('x', '7.5'); crossV.setAttribute('y', '3');
    crossV.setAttribute('width', '3'); crossV.setAttribute('height', '12'); crossV.setAttribute('rx', '1');
    svg_a.appendChild(crossH); svg_a.appendChild(crossV); iconEl.appendChild(svg_a);
    const titleDiv = titleRow.createEl('div', { cls: `${uid}-title`, attr: { style: 'margin-bottom:0;' } });
    titleDiv.textContent = '过敏科就诊记录';

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

                    if (allergistDates.has(dateStr)) {
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
            countDiv.innerHTML = `${year}年: <strong>${stats.practiced}</strong> 次就诊`;

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
        console.error("过敏科就诊热力图错误:", error);
        dv.paragraph(`<div style="padding: 20px; border: 1px solid rgba(220, 150, 150, 0.5); border-radius: 8px; background: rgba(220, 150, 150, 0.1);">
            <p style="margin: 0; color: var(--text-muted);">⚠️ 发生错误: ${error.message || '未知错误'}</p>
        </div>`);
    }
}
```
