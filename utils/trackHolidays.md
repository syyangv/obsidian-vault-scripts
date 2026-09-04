---
modified_at: 2026-09-03
---

```dataviewjs
(async () => {
    // ===== 解析宿主年度笔记（标题含 4 位年份）=====
    // 当前活动文件若是年度笔记 → 用它并记住；否则回退到上次记住的年度笔记，
    // 这样聚焦 yearly-glance 日历视图(无 active file)时也能继续渲染。
    const isYearNote = (f) => !!f && /\d{4}/.test(f.name || "");
    const _active = app.workspace.getActiveFile();
    if (isYearNote(_active)) window.__trackHolidaysYearNote = _active.path;

    let actualCurrentFile = isYearNote(_active) ? _active : null;
    if (!actualCurrentFile && window.__trackHolidaysYearNote) {
        actualCurrentFile = app.vault.getAbstractFileByPath(window.__trackHolidaysYearNote);
    }
    if (!actualCurrentFile) actualCurrentFile = _active; // 退路：任意活动文件（保留原行为）

    if (!actualCurrentFile) {
        dv.paragraph("⚠️ 请先打开年度笔记（如 2026）以加载休假统计。");
        return;
    }

    const containerId = 'track-holidays-' + actualCurrentFile.path;

    // If already running, skip this execution
    if (window[containerId + '_running']) {
        return;
    }

    // Set debounce timeout - only execute after 500ms of inactivity
    if (window[containerId + '_timeout']) {
        clearTimeout(window[containerId + '_timeout']);
    }

    await new Promise(resolve => {
        window[containerId + '_timeout'] = setTimeout(resolve, 500);
    });

    window[containerId + '_running'] = true;

    try {
        // Load shared config from HolidayConfig.md
        const _hcfgPage = dv.page("Helper/config/HolidayConfig");
        const hcfg = (_hcfgPage && _hcfgPage.file && _hcfgPage.file.frontmatter) ? _hcfgPage.file.frontmatter : null;
        const _fmField = (hcfg && hcfg.fmField) || '假期';
        const _planFile = (hcfg && hcfg.planFile) || '个人整理/请假计划.md';
        const _lineClr = (hcfg && hcfg.lineColor) || '#d65d0e';
        const _mixedDot = (hcfg && hcfg.mixedDot) || { color: '#27ae60', stroke: '#229954' };
        const _noHolDot = (hcfg && hcfg.noHolidayDot) || { color: 'white', stroke: '#d65d0e' };
        const _sickCfg = (hcfg && hcfg.types && hcfg.types.sick) || { name: '病假', color: '#e74c3c', bg: '#e74c3c20', dotColor: '#ff6b6b', dotStroke: '#e74c3c', stroke: '#e74c3c' };
        const _ptoCfg = (hcfg && hcfg.types && hcfg.types.pto) || { name: 'PTO', color: '#3498db', bg: '#3498db20', dotColor: '#3498db', dotStroke: '#2980b9' };
        const _pubCfg = (hcfg && hcfg.types && hcfg.types.public) || { name: '公共假期', color: '#f39c12', bg: '#f39c1220', dotColor: '#f1c40f', dotStroke: '#f39c12' };

        // Build match functions from config
        const _matchType = (val, typeKey) => {
            if (hcfg && hcfg.types && hcfg.types[typeKey]) {
                const tc = hcfg.types[typeKey];
                if (tc.fmValues && tc.fmValues.includes(val)) return true;
            }
            return false;
        };
        const _matchTag = (tag, typeKey) => {
            if (hcfg && hcfg.types && hcfg.types[typeKey]) {
                const tc = hcfg.types[typeKey];
                if (tc.tagValues && (tc.tagValues.includes(tag) || tc.tagValues.includes('#' + tag) || tc.tagValues.includes(tag.replace(/^#/, '')))) return true;
            }
            return false;
        };

        let actualCurrentPage;
        try {
            actualCurrentPage = dv.page(actualCurrentFile.path);
        } catch (e) {
            dv.paragraph("⚠️ Unable to read page data.");
            return;
        }
        
        if (!actualCurrentPage) {
            dv.paragraph("⚠️ Unable to read page data.");
            return;
        }

        // Get the year from the actual current note's title
        const noteTitle = actualCurrentFile.name || "";
        const yearMatch = noteTitle.match(/\d{4}/);
        const year = yearMatch ? yearMatch[0] : new Date().getFullYear().toString();

        // Get annual leave limit from the ACTUAL current file's frontmatter (with safe access)
        const annualLeaveLimit = Number(actualCurrentPage.annualPtoCount) || 0;

        // ========================================
        // 缓存工具函数 Cache Utility Functions
        // ========================================
        const CACHE_KEY = 'track-holidays-data-v3';
        const CACHE_TTL_MINUTES = 240;

        const loadFromCache = (forYear) => {
            try {
                const raw = localStorage.getItem(CACHE_KEY);
                if (!raw) return null;
                const data = JSON.parse(raw);
                if (data.year !== forYear) return null;
                const ageMinutes = (Date.now() - data.timestamp) / 60000;
                if (ageMinutes > CACHE_TTL_MINUTES) return null;
                return {
                    monthlyData: data.monthlyData,
                    monthlyDetails: data.monthlyDetails,
                    holidayRecords: data.holidayRecords,
                    cachedAt: new Date(data.timestamp)
                };
            } catch (e) { return null; }
        };

        const saveToCache = (forYear, mData, mDetails, hRecords) => {
            try {
                localStorage.setItem(CACHE_KEY, JSON.stringify({
                    timestamp: Date.now(),
                    year: forYear,
                    monthlyData: mData,
                    monthlyDetails: mDetails,
                    holidayRecords: hRecords
                }));
            } catch (e) {}
        };

        const PREV_CACHE_KEY = 'track-holidays-prev-v1';
        const clearCache = () => {
            try { localStorage.removeItem(CACHE_KEY); localStorage.removeItem(PREV_CACHE_KEY); } catch (e) {}
        };

        // Initialize monthly data structure for the specified year
        const months = Array.from({length: 12}, (_, i) => {
            const month = (i + 1).toString().padStart(2, '0');
            return `${year}-${month}`;
        });

        // Helper function to get type display name and color (used in both cached and non-cached paths)
        function getTypeInfo(type) {
            if (type === 'pto') return { name: _ptoCfg.name, color: _ptoCfg.color, bg: _ptoCfg.bg };
            if (type === 'public') return { name: _pubCfg.name, color: _pubCfg.color, bg: _pubCfg.bg };
            if (type === 'sick') return { name: _sickCfg.name, color: _sickCfg.color, bg: _sickCfg.bg };
            if (hcfg && hcfg.types && hcfg.types[type]) {
                const tc = hcfg.types[type];
                return { name: tc.name || type, color: tc.color || '#888', bg: tc.bg || '#88888820' };
            }
            return { name: type, color: '#888', bg: '#88888820' };
        }

        let monthlyData, monthlyDetails, holidayRecords;
        let cachedAt = null;

        const cached = loadFromCache(year);
        if (cached) {
            ({ monthlyData, monthlyDetails, holidayRecords, cachedAt } = cached);
        } else {

        // Get all pages from 日记 folder with date format for the specified year
        let pages = [];
        try {
            const allPages = dv.pages('"日记"');
            if (allPages && allPages.length > 0) {
                pages = allPages
                    .where(p => {
                        try {
                            return p && p.file && p.file.name &&
                                   typeof p.file.name === 'string' &&
                                   p.file.name.match(new RegExp(`^${year}-\\d{2}-\\d{2}`));
                        } catch (e) {
                            return false;
                        }
                    })
                    .sort(p => p.file.name);
            }
        } catch (e) {
            dv.paragraph("⚠️ Error reading diary folder. Make sure '日记' folder exists.");
            return;
        }

        monthlyData = {};

        // Initialize all months with 0
        months.forEach(month => {
            monthlyData[month] = 0;
        });

        // Count holidays by month and track types
        monthlyDetails = {};
        months.forEach(month => {
            monthlyDetails[month] = {
                total: 0,
                pto: 0,
                public: 0,
                sick: 0
            };
        });

        // Store individual holiday records for the list
        holidayRecords = [];

        // Day of week names
        const dayNames = ['日', '一', '二', '三', '四', '五', '六'];

        // Helper function to safely get string value
        function safeString(val) {
            if (val === null || val === undefined) return '';
            try {
                return String(val).trim();
            } catch (e) {
                return '';
            }
        }

        // Helper function to safely get array
        function safeArray(val) {
            if (val === null || val === undefined) return [];
            if (Array.isArray(val)) return val;
            try {
                return [val];
            } catch (e) {
                return [];
            }
        }

        // Helper function to get day of week (timezone-safe)
        function getDayOfWeek(dateStr) {
            try {
                // Parse date parts manually to avoid timezone issues
                const parts = dateStr.split('-');
                if (parts.length !== 3) return '?';
                const yr = parseInt(parts[0], 10);
                const mo = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
                const dy = parseInt(parts[2], 10);
                
                // Create date using local timezone
                const date = new Date(yr, mo, dy);
                if (isNaN(date.getTime())) return '?';
                return dayNames[date.getDay()];
            } catch (e) {
                return '?';
            }
        }

        // Helper function to normalize 假期 frontmatter to array
        function getHolidayTypes(page) {
            const holidayTypes = new Set();
            const typeKeys = hcfg && hcfg.types ? Object.keys(hcfg.types) : ['pto', 'public', 'sick'];
            
            try {
                // Check frontmatter field (configurable)
                const fmVal = page && page[_fmField];
                if (fmVal) {
                    const jiaqiArray = safeArray(fmVal);
                    jiaqiArray.forEach(val => {
                        const strVal = safeString(val);
                        for (const tk of typeKeys) {
                            if (_matchType(strVal, tk)) { holidayTypes.add(tk); return; }
                        }
                        // Fallback for no config
                        if (!hcfg) {
                            if (strVal === 'PTO' || strVal === '放假/PTO') holidayTypes.add('pto');
                            else if (strVal === '公共假期' || strVal === '放假/公共假期') holidayTypes.add('public');
                            else if (strVal === '病假' || strVal === '放假/病假') holidayTypes.add('sick');
                        }
                    });
                }
                
                // Check tags
                if (page && page.file && page.file.tags && Array.isArray(page.file.tags)) {
                    page.file.tags.forEach(tag => {
                        const strTag = safeString(tag);
                        for (const tk of typeKeys) {
                            if (_matchTag(strTag, tk)) { holidayTypes.add(tk); return; }
                        }
                        if (!hcfg) {
                            if (strTag === '#放假/PTO' || strTag === '放假/PTO') holidayTypes.add('pto');
                            else if (strTag === '#放假/公共假期' || strTag === '放假/公共假期') holidayTypes.add('public');
                            else if (strTag === '#放假/病假' || strTag === '放假/病假') holidayTypes.add('sick');
                        }
                    });
                }
            } catch (e) {}
            
            return holidayTypes;
        }

        // Process pages
        for (let page of pages) {
            try {
                // Skip malformed pages
                if (!page || !page.file || !page.file.name) {
                    continue;
                }
                
                const fileName = safeString(page.file.name);
                if (fileName.length < 10) continue; // YYYY-MM-DD is 10 chars
                
                const holidayTypes = getHolidayTypes(page);
                const month = fileName.substring(0, 7); // YYYY-MM
                const dateStr = fileName.substring(0, 10); // YYYY-MM-DD
                
                if (monthlyData[month] === undefined) continue;
                
                // Count each type only once per day (using Set ensures no duplicates)
                let holidayCount = 0;
                
                if (holidayTypes.has('pto')) {
                    monthlyDetails[month].pto++;
                    holidayCount++;
                    holidayRecords.push({
                        date: dateStr,
                        dayOfWeek: getDayOfWeek(dateStr),
                        type: 'pto',
                        filePath: page.file.path
                    });
                }
                if (holidayTypes.has('public')) {
                    monthlyDetails[month].public++;
                    holidayCount++;
                    holidayRecords.push({
                        date: dateStr,
                        dayOfWeek: getDayOfWeek(dateStr),
                        type: 'public',
                        filePath: page.file.path
                    });
                }
                if (holidayTypes.has('sick')) {
                    monthlyDetails[month].sick++;
                    holidayRecords.push({
                        date: dateStr,
                        dayOfWeek: getDayOfWeek(dateStr),
                        type: 'sick',
                        filePath: page.file.path
                    });
                }
                
                // Total holidays (PTO + public, not sick)
                monthlyData[month] += holidayCount;
                monthlyDetails[month].total += holidayCount;
            } catch (e) {
                // Skip problematic pages silently
                continue;
            }
        }

        // Sort holiday records by date
        holidayRecords.sort((a, b) => a.date.localeCompare(b.date));
        // 去重保险：同一 date+type 只保留一条（防御历史缓存或重复扫描）
        {
            const __seenRec = new Set();
            holidayRecords = holidayRecords.filter((r) => {
                const k = `${r.date}|${r.type}`;
                if (__seenRec.has(k)) return false;
                __seenRec.add(k);
                return true;
            });
        }
        const __actualDates = new Set(holidayRecords.map(r => r.date));

        // 依据去重后的记录重新校准各月统计，防止冲突/重复日记副本导致月度虚增
        months.forEach(m => {
            monthlyData[m] = 0;
            monthlyDetails[m] = { total: 0, pto: 0, public: 0, sick: 0 };
        });
        for (const r of holidayRecords) {
            const m = r.date.substring(0, 7);
            if (monthlyDetails[m] && monthlyDetails[m][r.type] !== undefined) {
                monthlyDetails[m][r.type]++;
                if (r.type === 'pto' || r.type === 'public') {
                    monthlyData[m]++;
                    monthlyDetails[m].total++;
                }
            }
        }

        saveToCache(year, monthlyData, monthlyDetails, holidayRecords);
        } // end of else (not cached)

        // ===== 去年同期轨迹 (Previous Year Trajectory) =====
        const prevYear = String(parseInt(year) - 1);
        let prevYearCumData = null;

        const _ss = v => (v == null ? '' : String(v).trim());
        const _sa = v => (v == null ? [] : Array.isArray(v) ? v : [v]);
        const _htTypeKeys = hcfg && hcfg.types ? Object.keys(hcfg.types) : null;
        const _ht = (page) => {
            const s = new Set();
            try {
                const fmVal = page && page[_fmField];
                if (fmVal) {
                    _sa(fmVal).forEach(v => {
                        const sv = _ss(v);
                        if (_htTypeKeys) {
                            for (const tk of _htTypeKeys) { if (_matchType(sv, tk)) { s.add(tk); return; } }
                        } else {
                            if (sv === 'PTO' || sv === '放假/PTO') s.add('pto');
                            else if (sv === '公共假期' || sv === '放假/公共假期') s.add('public');
                            else if (sv === '病假' || sv === '放假/病假') s.add('sick');
                        }
                    });
                }
                if (page && page.file && page.file.tags && Array.isArray(page.file.tags)) {
                    page.file.tags.forEach(t => {
                        const st = _ss(t);
                        if (_htTypeKeys) {
                            for (const tk of _htTypeKeys) { if (_matchTag(st, tk)) { s.add(tk); return; } }
                        } else {
                            if (st === '#放假/PTO' || st === '放假/PTO') s.add('pto');
                            else if (st === '#放假/公共假期' || st === '放假/公共假期') s.add('public');
                            else if (st === '#放假/病假' || st === '放假/病假') s.add('sick');
                        }
                    });
                }
            } catch (e) {}
            return s;
        };

        let prevYearSickCumData = null;

        const loadPrevCache = () => {
            try {
                const raw = localStorage.getItem(PREV_CACHE_KEY);
                if (!raw) return null;
                const data = JSON.parse(raw);
                if (data.year !== prevYear) return null;
                if ((Date.now() - data.timestamp) / 60000 > 1440) return null;
                return { cumData: data.cumData, sickCumData: data.sickCumData || null };
            } catch (e) { return null; }
        };

        const prevCached = loadPrevCache();
        if (prevCached) {
            prevYearCumData = prevCached.cumData;
            prevYearSickCumData = prevCached.sickCumData;
        }
        if (!prevYearCumData || !prevYearSickCumData) {
            const prevMonths = Array.from({length: 12}, (_, i) =>
                `${prevYear}-${(i + 1).toString().padStart(2, '0')}`);
            const prevMD = {};
            const prevSickMD = {};
            prevMonths.forEach(m => { prevMD[m] = 0; prevSickMD[m] = 0; });
            try {
                const pp = dv.pages('"日记"')
                    .where(p => p && p.file && p.file.name &&
                           typeof p.file.name === 'string' &&
                           p.file.name.startsWith(prevYear + '-'));
                const seenPrev = new Set();
                for (let page of pp) {
                    try {
                        if (!page?.file?.name) continue;
                        const fn = _ss(page.file.name);
                        if (fn.length < 10) continue;
                        const dateStr = fn.substring(0, 10);
                        const ht = _ht(page);
                        const mon = fn.substring(0, 7);
                        if (prevMD[mon] === undefined) continue;
                        for (const type of ht) {
                            const k = dateStr + '|' + type;
                            if (seenPrev.has(k)) continue;
                            seenPrev.add(k);
                            if (type === 'pto' || type === 'public') prevMD[mon]++;
                            if (type === 'sick') prevSickMD[mon]++;
                        }
                    } catch (e) { continue; }
                }
            } catch (e) {}
            let cum = 0;
            prevYearCumData = prevMonths.map(m => { cum += (prevMD[m] || 0); return cum; });
            let sickCum = 0;
            prevYearSickCumData = prevMonths.map(m => { sickCum += (prevSickMD[m] || 0); return sickCum; });
            try {
                localStorage.setItem(PREV_CACHE_KEY, JSON.stringify({
                    timestamp: Date.now(), year: prevYear,
                    cumData: prevYearCumData, sickCumData: prevYearSickCumData
                }));
            } catch (e) {}
        }
        const prevYearMax = prevYearCumData ? Math.max(...prevYearCumData) : 0;
        const prevYearSickMax = prevYearSickCumData ? Math.max(...prevYearSickCumData) : 0;

        // Calculate cumulative data with type information
        let cumulative = 0;
        const chartData = months.map(month => {
            cumulative += (monthlyData[month] || 0);
            const details = monthlyDetails[month] || { total: 0, pto: 0, public: 0, sick: 0 };
            
            // Determine dominant type for coloring
            let dominantType = 'none';
            if (details.pto > details.public) {
                dominantType = 'pto';
            } else if (details.public > details.pto) {
                dominantType = 'public';
            } else if (details.pto > 0 && details.public > 0) {
                dominantType = 'mixed';
            } else if (details.pto > 0) {
                dominantType = 'pto';
            } else if (details.public > 0) {
                dominantType = 'public';
            }
            
            return {
                month: month.substring(5), // Just MM
                monthFull: month,
                monthly: monthlyData[month] || 0,
                cumulative: cumulative,
                details: details,
                dominantType: dominantType
            };
        });

        // Calculate cumulative sick leave data
        let sickCumulative = 0;
        const sickChartData = months.map(month => {
            const sickDays = (monthlyDetails[month] && monthlyDetails[month].sick) || 0;
            sickCumulative += sickDays;
            return {
                month: month.substring(5), // Just MM
                monthFull: month,
                monthly: sickDays,
                cumulative: sickCumulative
            };
        });

        // ===== 计划请假投影（请假计划.md，仅未来 PTO；不进缓存，每次实时读取）=====
        const __todayIso = (() => {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        })();
        const plannedMainByMonth = {}; // PTO + 公共假期（计入主投影线，与主线 PTO+public 一致）
        let plannedPtoTotal = 0;       // 仅 PTO（年度额度摘要）
        let plannedMainTotal = 0;      // PTO + 公共假期（决定是否画虚线投影）
        const plannedRecords = []; // 未来计划（PTO + 病假 + 公共假期），用于明细列表（边框样式）
        // 自带星期计算：getDayOfWeek 定义在 cache-miss else 块内，命中缓存时不存在 → 这里独立实现，避免 ReferenceError 中断解析
        const __dow = (s) => { const p = String(s).split('-'); if (p.length !== 3) return '?'; const d = new Date(+p[0], +p[1] - 1, +p[2]); return isNaN(d.getTime()) ? '?' : ['日','一','二','三','四','五','六'][d.getDay()]; };
        const __existingDiaryDates = new Set(app.vault.getFiles().filter(f => f.path.startsWith('日记/' + year + '/') && f.extension === 'md').map(f => f.basename.substring(0, 10)));
        try {
            // adapter.read = 直读磁盘，绕过 Obsidian cachedRead（外部修改的文件 cachedRead 会返回旧内容）
            const planRaw = await app.vault.adapter.read(_planFile);
            if (planRaw) {
                for (const line of planRaw.split(/\r?\n/)) {
                    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
                    const dateCell = cells.find(c => /^\d{4}-\d{2}-\d{2}$/.test(c));
                    if (!dateCell || !dateCell.startsWith(year + '-') || dateCell <= __todayIso || __existingDiaryDates.has(dateCell)) continue;
                    const isPto = cells.some(c => c.toLowerCase() === 'pto');
                    const isSick = cells.some(c => c === '病假' || c.toLowerCase() === 'sick');
                    const isPublic = cells.some(c => c === '公共假期' || c.toLowerCase() === 'public');
                    if (!isPto && !isSick && !isPublic) continue;
                    const mon = dateCell.substring(0, 7);
                    const note = cells.find(c => c !== dateCell && !/^(pto|病假|sick|公共假期|public)$/i.test(c)) || '';
                    if (isPto) {
                        plannedMainByMonth[mon] = (plannedMainByMonth[mon] || 0) + 1;
                        plannedPtoTotal++;
                        plannedMainTotal++;
                        plannedRecords.push({ date: dateCell, dayOfWeek: __dow(dateCell), type: 'pto', planned: true, note });
                    }
                    if (isPublic) {
                        plannedMainByMonth[mon] = (plannedMainByMonth[mon] || 0) + 1;
                        plannedMainTotal++;
                        plannedRecords.push({ date: dateCell, dayOfWeek: __dow(dateCell), type: 'public', planned: true, note });
                    }
                    if (isSick) {
                        plannedRecords.push({ date: dateCell, dayOfWeek: __dow(dateCell), type: 'sick', planned: true, note });
                    }
                }
            }
        } catch (e) { /* 无计划文件 → 不投影 */ }
        plannedRecords.sort((a, b) => a.date.localeCompare(b.date));

        let __plannedCum = 0;
        const projData = chartData.map(d => {
            __plannedCum += (plannedMainByMonth[d.monthFull] || 0);
            return { projected: (d.cumulative || 0) + __plannedCum };
        });
        const projectedTotal = projData.length > 0 ? projData[projData.length - 1].projected : 0;

        // Calculate totals safely
        const totalDays = chartData.length > 0 ? (chartData[chartData.length - 1].cumulative || 0) : 0;
        const totalSickDays = sickChartData.length > 0 ? (sickChartData[sickChartData.length - 1].cumulative || 0) : 0;

        const maxCumulative = Math.max(
            projectedTotal || 0,
            ...chartData.map(d => d.cumulative || 0), 
            annualLeaveLimit || 1, 
            prevYearMax || 0,
            5
        );
        const maxSickCumulative = Math.max(
            ...sickChartData.map(d => d.cumulative || 0), 
            prevYearSickMax || 0,
            1
        );

        // Function to get dot color based on holiday type
        function getDotColor(type) {
            if (type === 'pto') return _ptoCfg.dotColor;
            if (type === 'public') return _pubCfg.dotColor;
            if (type === 'mixed') return _mixedDot.color;
            return _noHolDot.color;
        }

        function getDotStroke(type) {
            if (type === 'pto') return _ptoCfg.dotStroke;
            if (type === 'public') return _pubCfg.dotStroke;
            if (type === 'mixed') return _mixedDot.stroke;
            return _noHolDot.stroke;
        }

        // Chart dimensions
        const chartWidth = 500;
        const chartHeight = 300;
        const padding = 20;
        const sickChartWidth = 250;
        const sickChartHeight = 300;

        // Calculate SVG path coordinates for holiday chart
        const pathCoords = chartData.map((d, i) => {
            const x = padding + (i / Math.max(chartData.length - 1, 1)) * (chartWidth - 2 * padding);
            const y = chartHeight - padding - ((d.cumulative || 0) / maxCumulative) * (chartHeight - 2 * padding);
            return { x: x || padding, y: isNaN(y) ? (chartHeight - padding) : y, data: d };
        });

        // 计划投影坐标（虚线，与主线同 x 轴）
        const projCoords = projData.map((d, i) => {
            const x = padding + (i / Math.max(projData.length - 1, 1)) * (chartWidth - 2 * padding);
            const y = chartHeight - padding - ((d.projected || 0) / maxCumulative) * (chartHeight - 2 * padding);
            return { x: x || padding, y: isNaN(y) ? (chartHeight - padding) : y };
        });
        const projPathString = projCoords
            .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`)
            .join(' ');

        // 去年同期轨迹坐标（点线）
        const prevYearPathCoords = prevYearCumData ? prevYearCumData.map((cum, i) => {
            const x = padding + (i / Math.max(prevYearCumData.length - 1, 1)) * (chartWidth - 2 * padding);
            const y = chartHeight - padding - (cum / maxCumulative) * (chartHeight - 2 * padding);
            return { x: x || padding, y: isNaN(y) ? (chartHeight - padding) : y, cum };
        }) : [];
        const prevYearPathString = prevYearPathCoords
            .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`)
            .join(' ');

        // Calculate SVG path coordinates for sick leave chart
        const sickPathCoords = sickChartData.map((d, i) => {
            const x = padding + (i / Math.max(sickChartData.length - 1, 1)) * (sickChartWidth - 2 * padding);
            const y = sickChartHeight - padding - ((d.cumulative || 0) / maxSickCumulative) * (sickChartHeight - 2 * padding);
            return { x: x || padding, y: isNaN(y) ? (sickChartHeight - padding) : y, data: d };
        });

        // Create SVG path strings with validation
        const pathString = pathCoords
            .filter(coord => !isNaN(coord.x) && !isNaN(coord.y))
            .map((coord, i) => `${i === 0 ? 'M' : 'L'} ${coord.x} ${coord.y}`)
            .join(' ') || `M ${padding} ${chartHeight - padding}`;

        const sickPathString = sickPathCoords
            .filter(coord => !isNaN(coord.x) && !isNaN(coord.y))
            .map((coord, i) => `${i === 0 ? 'M' : 'L'} ${coord.x + chartWidth} ${coord.y}`)
            .join(' ') || `M ${chartWidth + padding} ${sickChartHeight - padding}`;

        // 去年同期病假轨迹坐标（点线）
        const prevYearSickPathString = prevYearSickCumData ? prevYearSickCumData.map((cum, i) => {
            const x = padding + (i / Math.max(prevYearSickCumData.length - 1, 1)) * (sickChartWidth - 2 * padding);
            const y = sickChartHeight - padding - (cum / maxSickCumulative) * (sickChartHeight - 2 * padding);
            const px = (x || padding) + chartWidth;
            const py = isNaN(y) ? (sickChartHeight - padding) : y;
            return `${i === 0 ? 'M' : 'L'} ${px} ${py}`;
        }).join(' ') : '';

        // Build grid lines HTML
        const gridLines = [0, 1, 2, 3, 4].map(i => {
            const y = padding + (i / 4) * (chartHeight - 2 * padding);
            const value = Math.round(maxCumulative * (4 - i) / 4);
            return `
                <line x1="${padding}" y1="${y}" x2="${chartWidth - padding}" y2="${y}" stroke="var(--background-modifier-border)" stroke-width="1" opacity="0.5"/>
                <text x="${padding - 5}" y="${y + 4}" text-anchor="end" fill="var(--text-muted)" font-size="12">${value}</text>
            `;
        }).join('');

        const sickGridLines = [0, 1, 2, 3, 4].map(i => {
            const y = padding + (i / 4) * (sickChartHeight - 2 * padding);
            const value = Math.round(maxSickCumulative * (4 - i) / 4);
            const xOffset = chartWidth;
            return `
                <line x1="${xOffset + padding}" y1="${y}" x2="${xOffset + sickChartWidth - padding}" y2="${y}" stroke="var(--background-modifier-border)" stroke-width="1" opacity="0.5"/>
                <text x="${xOffset + padding - 5}" y="${y + 4}" text-anchor="end" fill="var(--text-muted)" font-size="12">${value}</text>
            `;
        }).join('');

        // Build data points HTML with validation
        const dataPoints = pathCoords
            .filter(coord => !isNaN(coord.x) && !isNaN(coord.y))
            .map(coord => `
                <g>
                    <circle cx="${coord.x}" cy="${coord.y}" r="6" 
                            fill="${getDotColor(coord.data.dominantType)}" 
                            stroke="${getDotStroke(coord.data.dominantType)}" 
                            stroke-width="2"
                            style="cursor: pointer;">
                    </circle>
                    <text x="${coord.x}" y="${coord.y - 10}" text-anchor="middle" 
                          fill="var(--text-normal)" font-size="9" font-weight="bold">${coord.data.cumulative || 0}</text>
                </g>
            `).join('');

        const sickDataPoints = sickPathCoords
            .filter(coord => !isNaN(coord.x) && !isNaN(coord.y))
            .map(coord => `
                <g>
                    <circle cx="${coord.x + chartWidth}" cy="${coord.y}" r="6" 
                            fill="${_sickCfg.dotColor}" 
                            stroke="${_sickCfg.dotStroke}" 
                            stroke-width="2"
                            style="cursor: pointer;">
                    </circle>
                    <text x="${coord.x + chartWidth}" y="${coord.y - 10}" text-anchor="middle" 
                          fill="var(--text-normal)" font-size="9" font-weight="bold">${coord.data.cumulative || 0}</text>
                </g>
            `).join('');

        // Build X-axis labels
        const xAxisLabels = pathCoords
            .filter(coord => !isNaN(coord.x))
            .map(coord => `
                <text x="${coord.x}" y="${chartHeight - padding + 10}" text-anchor="middle" fill="var(--text-muted)" font-size="10">${coord.data.month || ''}</text>
            `).join('');

        const sickXAxisLabels = sickPathCoords
            .filter(coord => !isNaN(coord.x))
            .map(coord => `
                <text x="${coord.x + chartWidth}" y="${sickChartHeight - padding + 15}" text-anchor="middle" fill="var(--text-muted)" font-size="10">${coord.data.month || ''}</text>
            `).join('');

        // Annual leave limit line
        const limitLineY = chartHeight - padding - (annualLeaveLimit / maxCumulative) * (chartHeight - 2 * padding);
        const limitLine = (annualLeaveLimit > 0 && !isNaN(limitLineY)) ? `
            <line x1="${padding}" y1="${limitLineY}" 
                  x2="${chartWidth - padding}" y2="${limitLineY}" 
                  stroke="${_sickCfg.stroke}" stroke-width="3" stroke-dasharray="8,4" opacity="1"/>
            <text x="${chartWidth - padding - 5}" y="${limitLineY - 8}" 
                  text-anchor="end" fill="${_sickCfg.stroke}" font-size="10" font-weight="bold">Limit: ${annualLeaveLimit}</text>
        ` : '';

        // Summary text
        const remainingDays = Math.max(0, annualLeaveLimit - totalDays);
        const projectedRemaining = Math.max(0, annualLeaveLimit - (totalDays + plannedPtoTotal));
        const plannedText = plannedPtoTotal > 0
            ? ` | <strong>计划:</strong> +${plannedPtoTotal} → 预计剩余 ${projectedRemaining}`
            : '';
        const quotaText = annualLeaveLimit > 0 
            ? `<br><strong>Annual Leave Quota:</strong> ${annualLeaveLimit} days | <strong>Remaining:</strong> ${remainingDays} days${plannedText}`
            : '<br><strong>Annual Leave Quota:</strong> Not Set';

        // Build holiday list HTML in four columns
        let holidayListHtml;
        // 实际(背景填充) + 计划(同色边框) 合并，按日期排序
        const listRecords = [...holidayRecords, ...plannedRecords.filter(p => !__actualDates.has(p.date))]
            .sort((a, b) => a.date.localeCompare(b.date));
        // 编号按额度类别累计：PTO + 公共假期 共用年假额度(1..annualLeaveLimit)，病假单独从 1 重新开始
        { let __hc = 0, __sc = 0; for (const r of listRecords) { r.seq = (r.type === 'sick') ? ++__sc : ++__hc; } }

        const renderRecord = (record) => {
            const typeInfo = getTypeInfo(record.type);
            const boxStyle = record.planned
                ? `background: transparent; border: 1px solid ${typeInfo.color};`
                : `background: ${typeInfo.bg}; border: 1px solid transparent;`;
            return `
                <div style="display: flex; align-items: center; padding: 4px 8px; border-radius: 4px; ${boxStyle} margin: 2px 0;">
                    <span style="width: 25px; color: var(--text-muted); font-size: 11px;">${record.seq}.</span>
                    <a class="internal-link" data-href="${record.date}" href="${record.date}" style="color: var(--text-normal); text-decoration: none; font-family: monospace; font-size: 12px;">${record.date}</a>
                    <span style="margin: 0 8px; color: var(--text-muted); font-size: 12px;">周${record.dayOfWeek}</span>
                    <span style="padding: 2px 8px; border-radius: 3px; background: ${typeInfo.color}; color: white; font-size: 11px; font-weight: 500;">${typeInfo.name}</span>${record.note ? ` <span style="margin-left:6px; color: var(--text-muted); font-size: 11px;">${record.note}</span>` : ''}
                </div>
            `;
        };

        if (listRecords.length > 0) {
            const itemsPerColumn = Math.ceil(listRecords.length / 4);
            const columns = [
                listRecords.slice(0, itemsPerColumn),
                listRecords.slice(itemsPerColumn, itemsPerColumn * 2),
                listRecords.slice(itemsPerColumn * 2, itemsPerColumn * 3),
                listRecords.slice(itemsPerColumn * 3),
            ];
            const columnsHtml = columns
                .map((col) => {
                    const inner = col
                        .map((record) => renderRecord(record))
                        .join('');
                    return `<div style="flex: 1;">${inner}</div>`;
                })
                .join('');
            holidayListHtml = `
                <div style="display: flex; gap: 10px;">
                    ${columnsHtml}
                </div>
            `;
        } else {
            holidayListHtml = '<div style="color: var(--text-muted); text-align: center; padding: 10px;">暂无休假记录</div>';
        }

        // Cache status and refresh button
        const cacheBar = dv.container.createEl('div', {
            attr: { style: 'display:flex; align-items:center; gap:12px; margin-bottom:8px; font-size:0.85em; color:var(--text-muted);' }
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
            // 强制重新执行本 dataviewjs 块：rebuildView 重建视图 → 重跑脚本 → dv.io.load 读最新 请假计划.md
            const leaf = (app.workspace.getMostRecentLeaf && app.workspace.getMostRecentLeaf())
                || app.workspace.activeLeaf;
            if (leaf && typeof leaf.rebuildView === 'function') { leaf.rebuildView(); return; }
            const file = app.workspace.getActiveFile();
            if (leaf && file) await leaf.openFile(file, { active: true });
        });

        // Create chart HTML
        const container = dv.container.createEl('div');
        container.innerHTML = `
        <div style="width: 100%; border: 1px solid var(--background-modifier-border); border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="text-align: center; margin: 0 0 20px 0; color: var(--text-normal);">${year} 休假统计</h3>
            
            <div style="width: 100%; display: flex;">
                <svg width="100%" height="${chartHeight + 30}" style="border-radius: 4px;" viewBox="0 0 ${chartWidth + sickChartWidth} ${chartHeight + 30}">
                    <!-- Holiday Chart Grid -->
                    ${gridLines}
                    
                    <!-- Holiday Chart Axes -->
                    <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${chartHeight - padding}" stroke="var(--text-muted)" stroke-width="2"/>
                    <line x1="${padding}" y1="${chartHeight - padding}" x2="${chartWidth - padding}" y2="${chartHeight - padding}" stroke="var(--text-muted)" stroke-width="2"/>
                    
                    <!-- Holiday Main line -->
                    <path d="${pathString}" stroke="${_lineClr}" stroke-width="3" fill="none"/>
                    
                    <!-- Previous year trajectory (dotted) -->
                    ${prevYearPathString ? `<path d="${prevYearPathString}" stroke="#888" stroke-width="2" fill="none" stroke-dasharray="3,5" opacity="0.55"/>` : ''}
                    
                    <!-- Planned PTO projection (dashed) -->
                    ${plannedMainTotal > 0 ? `<path d="${projPathString}" stroke="${_lineClr}" stroke-width="2.5" fill="none" stroke-dasharray="6,4" opacity="0.85"/>` : ''}
                    
                    <!-- Annual leave limit line -->
                    ${limitLine}
                    
                    <!-- Holiday Data points -->
                    ${dataPoints}
                    
                    <!-- Holiday X-axis labels -->
                    ${xAxisLabels}
                    
                    <!-- Holiday Y-axis title -->
                    <text x="15" y="${chartHeight / 2}" text-anchor="middle" fill="var(--text-muted)" font-size="11" transform="rotate(-90, 15, ${chartHeight / 2})">Days</text>
                    
                    <!-- Sick Leave Chart Grid -->
                    ${sickGridLines}
                    
                    <!-- Sick Chart Axes -->
                    <line x1="${chartWidth + padding}" y1="${padding}" x2="${chartWidth + padding}" y2="${sickChartHeight - padding}" stroke="var(--text-muted)" stroke-width="2"/>
                    <line x1="${chartWidth + padding}" y1="${sickChartHeight - padding}" x2="${chartWidth + sickChartWidth - padding}" y2="${sickChartHeight - padding}" stroke="var(--text-muted)" stroke-width="2"/>
                    
                    <!-- Previous year sick leave trajectory (dotted) -->
                    ${prevYearSickPathString ? `<path d="${prevYearSickPathString}" stroke="#888" stroke-width="2" fill="none" stroke-dasharray="3,5" opacity="0.55"/>` : ''}
                    
                    <!-- Sick leave line -->
                    <path d="${sickPathString}" stroke="${_sickCfg.stroke}" stroke-width="3" fill="none"/>
                    
                    <!-- Sick Data points -->
                    ${sickDataPoints}
                    
                    <!-- Sick X-axis labels -->
                    ${sickXAxisLabels}
                    
                    <!-- Sick Y-axis title -->
                    <text x="${chartWidth + 10}" y="${sickChartHeight / 2}" text-anchor="middle" fill="var(--text-muted)" font-size="11" transform="rotate(-90, ${chartWidth + 10}, ${sickChartHeight / 2})">Days</text>
                </svg>
            </div>
            
            <!-- Legend -->
            <div style="display: flex; justify-content: center; gap: 10px; margin: 5px 0; padding: 5px; border-radius: 6px; font-size: 11px; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 4px;">
                    <div style="width: 10px; height: 10px; border-radius: 50%; background: ${_ptoCfg.dotColor}; border: 2px solid ${_ptoCfg.dotStroke};"></div>
                    <span style="color: var(--text-normal);">${_ptoCfg.name}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <div style="width: 10px; height: 10px; border-radius: 50%; background: ${_pubCfg.dotColor}; border: 2px solid ${_pubCfg.dotStroke};"></div>
                    <span style="color: var(--text-normal);">${_pubCfg.name}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <div style="width: 10px; height: 10px; border-radius: 50%; background: ${_mixedDot.color}; border: 2px solid ${_mixedDot.stroke};"></div>
                    <span style="color: var(--text-normal);">Mixed</span>
                </div>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <div style="width: 10px; height: 10px; border-radius: 50%; background: ${_noHolDot.color}; border: 2px solid ${_noHolDot.stroke};"></div>
                    <span style="color: var(--text-normal);">No Holiday</span>
                </div>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <div style="width: 10px; height: 10px; border-radius: 50%; background: ${_sickCfg.dotColor}; border: 2px solid ${_sickCfg.dotStroke};"></div>
                    <span style="color: var(--text-normal);">${_sickCfg.name}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <span style="width: 16px; border-top: 2.5px dashed ${_lineClr}; display: inline-block;"></span>
                    <span style="color: var(--text-normal);">计划 PTO</span>
                </div>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <span style="width: 16px; border-top: 2px dotted #888; display: inline-block;"></span>
                    <span style="color: var(--text-normal);">${prevYear}</span>
                </div>
            </div>
            
            <!-- Summary Stats -->
            <div style="text-align: center; margin-top: 5px; padding: 5px; border-radius: 6px; color: var(--text-normal);">
                <strong>Holiday Total:</strong> ${totalDays} days | 
                <strong>Sick Leave Total:</strong> ${totalSickDays} days |
                <strong>Average Holiday/Month:</strong> ${(totalDays / 12).toFixed(1)} days
                ${quotaText}
            </div>
            
            <!-- Holiday List -->
            <details style="margin-top: 15px; border: 1px solid var(--background-modifier-border); border-radius: 6px; padding: 10px;">
                <summary style="cursor: pointer; font-weight: 600; color: var(--text-normal); padding: 5px;">
                    📅 休假明细 (${holidayRecords.filter(r => r.type !== 'sick').length} 实际${plannedRecords.filter(r => r.type !== 'sick').length > 0 ? ` + ${plannedRecords.filter(r => r.type !== 'sick').length} 计划` : ''}${holidayRecords.filter(r => r.type === 'sick').length + plannedRecords.filter(r => r.type === 'sick').length > 0 ? ` · ${holidayRecords.filter(r => r.type === 'sick').length + plannedRecords.filter(r => r.type === 'sick').length} 病假` : ''})
                </summary>
                <div style="margin-top: 10px; max-height: 300px; overflow-y: auto;">
                    ${holidayListHtml}
                </div>
            </details>
        </div>
        `;
    } catch (e) {
        // Ultimate fallback - display error gracefully
        try {
            dv.paragraph(`⚠️ Error rendering holiday chart: ${e.message || 'Unknown error'}`);
        } catch (e2) {
            console.error("Holiday chart error:", e);
        }
    } finally {
        // Always clear running flag
        window[containerId + '_running'] = false;
    }
})();
```