---
modified_at: 2026-07-20
---
```dataviewjs
// Doctor Visit Tracker Template - Save as "Templates/doctor-visit-tracker.md"
// Usage: Embed in doctor note files: ![[Templates/doctor-visit-tracker]]

// Smart auto-updating doctor visit tracker
let targetFile;
let doctorType;

// Method 1: Try to get the active file (works when viewing the embedding page)
const activeFile = app.workspace.getActiveFile();
if (activeFile && !activeFile.path.includes('Templates/doctor-visit-tracker')) {
    targetFile = activeFile;
    doctorType = activeFile.basename;
} else {
    // Method 2: Fallback - look for the embedding context
    const activeView = app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView && activeView.file && !activeView.file.path.includes('Templates/doctor-visit-tracker')) {
        targetFile = activeView.file;
        doctorType = activeView.file.basename;
    } else {
        // Method 3: Last resort - use dv.current() but warn
        targetFile = dv.current().file;
        doctorType = targetFile.name;
        if (targetFile.path.includes('Templates/doctor-visit-tracker')) {
            dv.span('<span style="font-variant-emoji:text;">⚠️</span> 模板需要被嵌入到医生档案文件中使用');
            return;
        }
    }
}

// Customize the diary folder path here
// This will search in all year subfolders: 日记/2025, 日记/2026, etc.
const DIARY_FOLDER = '"日记"'; // Parent folder containing year subfolders

// Find all daily notes that have this doctor type in medical_tags frontmatter
const visits = dv.pages(DIARY_FOLDER)
    .where(p => {
        // Get medical_tags from frontmatter
        const medicalTags = p.medical_tags;
        
        if (!medicalTags) return false;
        
        // Handle both array and single value formats
        const tagsArray = Array.isArray(medicalTags) ? medicalTags : [medicalTags];
        
        if (tagsArray.length === 0) return false;
        
        // Check if any tag matches the doctor type (case-insensitive)
        // Tags might be in format "#Psychiatrist" or just "Psychiatrist"
        return tagsArray.some(tag => {
            const tagStr = String(tag).toLowerCase().replace(/^#/, '');
            const doctorStr = doctorType.toLowerCase();
            return tagStr === doctorStr || tagStr.includes(doctorStr);
        });
    });

// Debug info - remove this section after troubleshooting
console.log("Doctor type:", doctorType);
console.log("Total diary pages:", dv.pages(DIARY_FOLDER).length);
console.log("Visits found:", visits.length);
if (dv.pages(DIARY_FOLDER).length > 0) {
    const samplePage = dv.pages(DIARY_FOLDER)[0];
    console.log("Sample page medical_tags:", samplePage.medical_tags);
}

if (visits.length > 0) {
    const sortedVisits = visits.sort(p => p.file.name, 'desc');
    const years = [...new Set(sortedVisits.map(p => p.file.folder.split('/')[1]))];
    
    const firstVisit = sortedVisits[sortedVisits.length-1].file.name;
    const lastVisit = sortedVisits[0].file.name;
    const totalVisits = sortedVisits.length;
    
    // Calculate visit statistics
    const firstVisitDate = moment(firstVisit);
    const lastVisitDate = moment(lastVisit);
    const daysBetween = lastVisitDate.diff(firstVisitDate, 'days') + 1;
    const avgFrequency = totalVisits > 1 ? Math.round(daysBetween / totalVisits) : 0;
    
    // Recent visit activity (last 90 days)
    const recentVisits = sortedVisits.filter(p => 
        moment().diff(moment(p.file.name), 'days') <= 90
    ).length;
    
    // Days since last visit
    const daysSinceLastVisit = moment().diff(moment(lastVisit), 'days');
    
    // Quarterly analysis
    const quarterCounts = {};
    sortedVisits.forEach(v => {
        const date = moment(v.file.name);
        const year = date.year();
        const quarter = Math.ceil((date.month() + 1) / 3);
        const key = `${year}Q${quarter}`;
        quarterCounts[key] = (quarterCounts[key] || 0) + 1;
    });
    
    // Most active quarter
    const mostActiveQuarter = Object.keys(quarterCounts).reduce((a, b) => 
        quarterCounts[a] > quarterCounts[b] ? a : b, Object.keys(quarterCounts)[0]
    );
    
    // Create a container with custom CSS class for styling
    dv.container.className += ' doctor-visit-tracker-widget';
    
    // Display the visit information
    dv.span(`<span style="font-variant-emoji:text;">🏥</span> 首次就诊: [[${firstVisit}]]  `);
    dv.span(`<span style="font-variant-emoji:text;">🏥</span> 最近就诊: [[${lastVisit}]]  `);
    dv.span(`<span style="font-variant-emoji:text;">🔢</span> 共 ${totalVisits} 次  `);
    
    // Days since last visit with urgency indicator
    const urgencyColor = daysSinceLastVisit <= 30 ? '#4caf50'
        : daysSinceLastVisit <= 90 ? '#ff9800'
        : daysSinceLastVisit <= 180 ? '#ff5722'
        : '#f44336';
    dv.span(`<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${urgencyColor};margin-right:4px;vertical-align:middle;"></span>${daysSinceLastVisit}天前  `);
    
    if (recentVisits > 0) {
        dv.span(`<span style="font-variant-emoji:text;">📊</span> 近90天: ${recentVisits}次  `);
    }
    
    if (avgFrequency > 0) {
        dv.span(`<span style="font-variant-emoji:text;">⏱️</span> 平均${avgFrequency}天一次  `);
    }
    
    if (totalVisits >= 4 && mostActiveQuarter) {
        dv.span(`<span style="font-variant-emoji:text;">📈</span> 活跃期: ${mostActiveQuarter}  `);
    }
    
    dv.span(`<span style="font-variant-emoji:text;">📅</span> ${years.length === 1 ? years[0] + '年' : years.sort().join('-') + '年'}  `);
    
    // Enhanced auto-update - updates the EMBEDDING page's frontmatter
    const currentFrontmatter = targetFile.frontmatter || {};
    const needsUpdate = 
        !currentFrontmatter.last_visit || 
        currentFrontmatter.last_visit !== lastVisit ||
        currentFrontmatter.first_visit !== firstVisit ||
        currentFrontmatter.total_visits !== totalVisits ||
        currentFrontmatter.visit_frequency !== avgFrequency ||
        currentFrontmatter.recent_visits !== recentVisits ||
        currentFrontmatter.days_since_visit !== daysSinceLastVisit;
    
    if (needsUpdate) {
        // Auto-update with comprehensive metadata
        setTimeout(async () => {
            if (targetFile) {
                await app.fileManager.processFrontMatter(targetFile, (frontmatter) => {
                    frontmatter.first_visit = firstVisit;
                    frontmatter.last_visit = lastVisit;
                    frontmatter.total_visits = totalVisits;
                    frontmatter.visit_frequency = avgFrequency;
                    frontmatter.recent_visits = recentVisits;
                    frontmatter.days_since_visit = daysSinceLastVisit;
                    frontmatter.visit_years = years;
                    frontmatter.most_active_quarter = mostActiveQuarter;
                    frontmatter.auto_updated = moment().format('YYYY-MM-DD HH:mm');
                    
                    // Add visit pattern tags
                    const patterns = [];
                    if (recentVisits >= 3) patterns.push('频繁就诊');
                    if (avgFrequency <= 30) patterns.push('定期复诊');
                    if (totalVisits >= 10) patterns.push('长期患者');
                    if (years.length >= 2) patterns.push('多年记录');
                    if (daysSinceLastVisit > 180) patterns.push('需要预约');
                    
                    if (patterns.length > 0) {
                        frontmatter.visit_patterns = patterns;
                    }
                    
                    // Add urgency level
                    if (daysSinceLastVisit <= 30) {
                        frontmatter.visit_status = '最近就诊';
                    } else if (daysSinceLastVisit <= 90) {
                        frontmatter.visit_status = '近期就诊';
                    } else if (daysSinceLastVisit <= 180) {
                        frontmatter.visit_status = '需要关注';
                    } else {
                        frontmatter.visit_status = '建议预约';
                    }
                });
            }
        }, 100);
        
        dv.span(` <span style="font-variant-emoji:text;">🔄</span> *智能更新中...*`);
    } else {
        // Enhanced status display
        const fm = currentFrontmatter;
        if (fm.auto_updated) {
            dv.span(`<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#4caf50;margin-right:4px;vertical-align:middle;"></span>*已同步 (${fm.auto_updated})*`);
            
            // Show visit patterns if available
            if (fm.visit_patterns && fm.visit_patterns.length > 0) {
                dv.span(`<br><span style="font-variant-emoji:text;">🏷️</span> ${fm.visit_patterns.join(' · ')}`);
            }
        }
    }
    
    // Optional: Show detailed visit history with dot timeline (for 3+ visits)
    if (totalVisits >= 3) {
        // Get all years with visits
        const allYears = [...new Set(sortedVisits.map(v => moment(v.file.name).year()))].sort((a, b) => b - a);
        const currentYear = moment().year();
        
        // Create unique ID for this tracker instance
        const trackerId = `tracker-${Math.random().toString(36).substr(2, 9)}`;
        
        dv.span(`<div style="margin-top: 15px;" id="${trackerId}">`);
        
        // Year selector dropdown - build as complete HTML string
        let dropdownHtml = '<div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">';
        dropdownHtml += '<label style="font-weight: bold;">选择年份:</label>';
        dropdownHtml += `<select id="${trackerId}-year-select" style="padding: 4px 8px; border-radius: 4px; border: 1px solid var(--background-modifier-border); background: var(--background-primary); color: var(--text-normal); min-width: 100px;">`;
        
        allYears.forEach(year => {
            const selected = year === currentYear ? 'selected' : '';
            dropdownHtml += `<option value="${year}" ${selected}>${year}年</option>`;
        });
        
        dropdownHtml += '</select>';
        dropdownHtml += '</div>';
        
        dv.span(dropdownHtml);
        
        // Function to render timeline for a specific year
        function renderTimelineForYear(year) {
            // Generate all 12 months for the selected year
            const months = [];
            const monthlyData = {};
            
            for (let month = 1; month <= 12; month++) {
                const monthKey = `${year}-${String(month).padStart(2, '0')}`;
                const monthLabel = `${String(month).padStart(2, '0')}月`;
                months.push({
                    key: monthKey,
                    label: monthLabel,
                    month: month,
                    count: 0,
                    dates: []
                });
                monthlyData[monthKey] = { count: 0, dates: [] };
            }
            
            // Count visits for this year
            sortedVisits.forEach(v => {
                const visitDate = v.file.name;
                const visitYear = parseInt(visitDate.substring(0, 4));
                if (visitYear === parseInt(year)) {
                    const monthKey = visitDate.substring(0, 7);
                    if (monthlyData[monthKey]) {
                        monthlyData[monthKey].count++;
                        monthlyData[monthKey].dates.push(visitDate);
                    }
                }
            });
            
            // Update months with actual counts
            months.forEach(month => {
                if (monthlyData[month.key]) {
                    month.count = monthlyData[month.key].count;
                    month.dates = monthlyData[month.key].dates;
                }
            });
            
            return months;
        }
        
        // Render initial timeline for current year
        const initialMonths = renderTimelineForYear(currentYear);
        
        // Build entire timeline as one HTML block for perfect alignment
        let timelineHtml = `<div id="${trackerId}-timeline">`;
        timelineHtml += `<div style="margin-bottom: 12px;">`;
        timelineHtml += `<div style="font-weight: bold; margin-bottom: 8px;">${currentYear}年就诊时间线</div>`;
        
        // Month labels row
        timelineHtml += `<div style="display: flex; gap: 4px; margin-bottom: 4px;">`;
        initialMonths.forEach(month => {
            const isCurrentMonth = (currentYear === moment().year() && month.month === moment().month() + 1);
            const monthStyle = isCurrentMonth ? 'font-weight: bold; color: var(--text-accent);' : 'color: var(--text-muted);';
            timelineHtml += `<span style="width: 40px; text-align: center; font-size: 0.85em; ${monthStyle}">${month.label}</span>`;
        });
        timelineHtml += `</div>`;
        
        // Dots row
        timelineHtml += `<div style="display: flex; gap: 4px; margin-bottom: 8px;">`;
        initialMonths.forEach(month => {
            const hasVisit = month.count > 0;
            const title = hasVisit ? `${month.count}次: ${month.dates.join(', ')}` : '无就诊';
            const dotStyle = hasVisit
                ? 'display:inline-block;width:14px;height:14px;border-radius:50%;background:#4a9eff;'
                : 'display:inline-block;width:14px;height:14px;border-radius:50%;background:var(--background-modifier-border);';
            timelineHtml += `<span style="width:40px;display:inline-flex;justify-content:center;align-items:center;" title="${title}"><span style="${dotStyle}"></span></span>`;
        });
        timelineHtml += `</div>`;
        
        // Visit details
        const monthsWithVisits = initialMonths.filter(m => m.count > 0);
        if (monthsWithVisits.length > 0) {
            timelineHtml += `<div style="color: var(--text-muted); font-size: 0.85em; margin-top: 8px;">`;
            monthsWithVisits.forEach((month, idx) => {
                const dateLinks = month.dates.map(d => `<a href="${d}" class="internal-link" data-href="${d}">[[${d}]]</a>`).join(', ');
                timelineHtml += `${month.label}: ${dateLinks}`;
                if (idx < monthsWithVisits.length - 1) {
                    timelineHtml += ` · `;
                }
            });
            timelineHtml += `</div>`;
        }
        
        timelineHtml += `</div>`; // Close month details div
        timelineHtml += `</div>`; // Close timeline div
        
        dv.span(timelineHtml);
        
        // Add event listener using setTimeout to ensure DOM is ready
        setTimeout(() => {
            const selectElement = document.getElementById(`${trackerId}-year-select`);
            const timelineDiv = document.getElementById(`${trackerId}-timeline`);
            
            if (selectElement && timelineDiv) {
                selectElement.addEventListener('change', function() {
                    const selectedYear = parseInt(this.value);
                    const months = renderTimelineForYear(selectedYear);
                    
                    // Build new timeline HTML
                    let html = '<div style="margin-bottom: 12px;">';
                    html += `<div style="font-weight: bold; margin-bottom: 8px;">${selectedYear}年就诊时间线</div>`;
                    
                    // Month labels
                    html += '<div style="display: flex; gap: 4px; margin-bottom: 4px;">';
                    months.forEach(month => {
                        const isCurrentMonth = (selectedYear === new Date().getFullYear() && month.month === new Date().getMonth() + 1);
                        const monthStyle = isCurrentMonth ? 'font-weight: bold; color: var(--text-accent);' : 'color: var(--text-muted);';
                        html += `<span style="width: 40px; text-align: center; font-size: 0.85em; ${monthStyle}">${month.label}</span>`;
                    });
                    html += '</div>';
                    
                    // Dots
                    html += '<div style="display: flex; gap: 4px; margin-bottom: 8px;">';
                    months.forEach(month => {
                        const hasVisit = month.count > 0;
                        const title = hasVisit ? `${month.count}次: ${month.dates.join(', ')}` : '无就诊';
                        const dotStyle = hasVisit
                            ? 'display:inline-block;width:14px;height:14px;border-radius:50%;background:#4a9eff;'
                            : 'display:inline-block;width:14px;height:14px;border-radius:50%;background:var(--background-modifier-border);';
                        html += `<span style="width:40px;display:inline-flex;justify-content:center;align-items:center;" title="${title}"><span style="${dotStyle}"></span></span>`;
                    });
                    html += '</div>';
                    
                    // Visit details
                    const monthsWithVisits = months.filter(m => m.count > 0);
                    if (monthsWithVisits.length > 0) {
                        html += '<div style="color: var(--text-muted); font-size: 0.85em; margin-top: 8px;">';
                        monthsWithVisits.forEach((month, idx) => {
                            const dateLinks = month.dates.map(d => `<a href="${d}" class="internal-link" data-href="${d}">[[${d}]]</a>`).join(', ');
                            html += `${month.label}: ${dateLinks}`;
                            if (idx < monthsWithVisits.length - 1) {
                                html += ' · ';
                            }
                        });
                        html += '</div>';
                    }
                    
                    html += '</div>';
                    timelineDiv.innerHTML = html;
                });
            }
        }, 100);
        
        dv.span(`</div>`); // Close main tracker div
    }
    
} else {
    dv.span("还没有就诊记录");
    
    // Clear outdated frontmatter for the embedding page
    const currentFrontmatter = targetFile.frontmatter || {};
    const fieldsToClean = ['last_visit', 'first_visit', 'total_visits', 
                          'visit_frequency', 'recent_visits', 'days_since_visit',
                          'visit_years', 'visit_patterns', 'most_active_quarter', 'visit_status'];
    
    const hasOutdatedData = fieldsToClean.some(field => currentFrontmatter[field] !== undefined);
    
    if (hasOutdatedData) {
        setTimeout(async () => {
            if (targetFile) {
                await app.fileManager.processFrontMatter(targetFile, (frontmatter) => {
                    fieldsToClean.forEach(field => delete frontmatter[field]);
                    frontmatter.auto_updated = moment().format('YYYY-MM-DD HH:mm');
                });
            }
        }, 100);
        
        dv.span(` 🧹 *清理过期数据...*`);
    }
}
```