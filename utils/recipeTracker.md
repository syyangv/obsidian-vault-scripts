---
modified_at: 2026-07-20
---

```dataviewjs
// Recipe Tracker Template - Save as "Templates/recipe-tracker.md"
// Usage: ![[Templates/recipe-tracker]] or {{embed [[Templates/recipe-tracker]]}}

// Enhanced smart auto-updating recipe tracker (template version)
// Get the embedding file, not the template file
let targetFile;
let recipe;

// Method 1: Try to get the active file (works when viewing the embedding page)
const activeFile = app.workspace.getActiveFile();
if (activeFile && !activeFile.path.includes('Templates/recipe-tracker')) {
    targetFile = activeFile;
    recipe = activeFile.basename;
} else {
    // Method 2: Fallback - look for the embedding context
    // This is a more robust approach that checks the current view
    const activeView = app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView && activeView.file && !activeView.file.path.includes('Templates/recipe-tracker')) {
        targetFile = activeView.file;
        recipe = activeView.file.basename;
    } else {
        // Method 3: Last resort - use dv.current() but warn
        targetFile = dv.current().file;
        recipe = targetFile.name;
        if (targetFile.path.includes('Templates/recipe-tracker')) {
            dv.span("⚠️ 模板需要被嵌入到菜谱文件中使用");
            return;
        }
    }
}

// You can customize the diary folder path here if needed
const DIARY_FOLDER = '"日记"'; // Change this if your diary is in a different folder

const cooking = dv.pages(DIARY_FOLDER)
    .where(p => p.file.outlinks.some(l => 
        l.path.includes(recipe) || l.display === recipe
    ));

if (cooking.length > 0) {
    const dates = cooking.sort(p => p.file.name, 'desc');
    const years = [...new Set(dates.map(p => p.file.folder.split('/')[1]))];
    
    const firstDate = dates[dates.length-1].file.name;
    const lastDate = dates[0].file.name;
    const totalCount = dates.length;
    
    // Calculate enhanced statistics
    const firstDateObj = moment(firstDate);
    const lastDateObj = moment(lastDate);
    const daysBetween = lastDateObj.diff(firstDateObj, 'days') + 1;
    const frequency = totalCount > 1 ? Math.round(daysBetween / totalCount) : 0;
    
    // Recent cooking activity (last 30 days)
    const recentCooking = dates.filter(p => 
        moment().diff(moment(p.file.name), 'days') <= 30
    ).length;
    
    // Seasonal analysis
    const seasonCounts = {
        春季: dates.filter(p => [3,4,5].includes(moment(p.file.name).month() + 1)).length,
        夏季: dates.filter(p => [6,7,8].includes(moment(p.file.name).month() + 1)).length,
        秋季: dates.filter(p => [9,10,11].includes(moment(p.file.name).month() + 1)).length,
        冬季: dates.filter(p => [12,1,2].includes(moment(p.file.name).month() + 1)).length
    };
    const favoriteSeason = Object.keys(seasonCounts).reduce((a, b) => 
        seasonCounts[a] > seasonCounts[b] ? a : b
    );
    
    // Create a container with custom CSS class for styling
    dv.container.className += ' recipe-tracker-widget';
    
    // Display the enhanced info
    dv.span(`📅 首次: [[${firstDate}]]  `);
    dv.span(`📅 最近: [[${lastDate}]]  `);
    dv.span(`🔢 ${totalCount} 次  `);
    
    if (recentCooking > 0) {
        dv.span(`🔥 近30天: ${recentCooking}次  `);
    }
    
    if (frequency > 0) {
        dv.span(`⏱️ 平均${frequency}天一次  `);
    }
    
    if (totalCount >= 4) {
        const seasonEmojis = { 春季: '🌸', 夏季: '☀️', 秋季: '🍂', 冬季: '❄️' };
        dv.span(`${seasonEmojis[favoriteSeason]} 偏爱${favoriteSeason}  `);
    }
    
    dv.span(`📊 ${years.length === 1 ? years[0] + '年' : years.sort().join('-') + '年'}  `);
    
    // Enhanced auto-update - this will update the EMBEDDING page's frontmatter
    const currentFrontmatter = targetFile.frontmatter || {};
    const needsUpdate = 
        !currentFrontmatter.last_cooked || 
        currentFrontmatter.last_cooked !== lastDate ||
        currentFrontmatter.first_cooked !== firstDate ||
        currentFrontmatter.cooking_count !== totalCount ||
        currentFrontmatter.cooking_frequency !== frequency ||
        currentFrontmatter.favorite_season !== favoriteSeason ||
        currentFrontmatter.recent_activity !== recentCooking;
    
    if (needsUpdate) {
        // Auto-update with comprehensive metadata
        setTimeout(async () => {
            // Use the targetFile (embedding page) for updates
            if (targetFile) {
                await app.fileManager.processFrontMatter(targetFile, (frontmatter) => {
                    frontmatter.first_cooked = firstDate;
                    frontmatter.last_cooked = lastDate;
                    frontmatter.cooking_count = totalCount;
                    frontmatter.cooking_frequency = frequency;
                    frontmatter.favorite_season = favoriteSeason;
                    frontmatter.recent_activity = recentCooking;
                    frontmatter.cooking_years = years;
                    frontmatter.auto_updated = moment().format('YYYY-MM-DD HH:mm');
                    
                    // Add cooking pattern tags
                    const patterns = [];
                    if (recentCooking >= 3) patterns.push('频繁制作');
                    if (frequency <= 7) patterns.push('常做菜品');
                    if (totalCount >= 10) patterns.push('经典菜谱');
                    if (years.length >= 2) patterns.push('长期收藏');
                    
                    if (patterns.length > 0) {
                        frontmatter.cooking_patterns = patterns;
                    }
                });
            }
        }, 100);
        
        dv.span(` 🔄 *智能更新中...*`);
    } else {
        // Enhanced status display
        const fm = currentFrontmatter;
        if (fm.auto_updated) {
            dv.span(` ✅ *已同步 (${fm.auto_updated})*`);
            
            // Show cooking patterns if available
            if (fm.cooking_patterns && fm.cooking_patterns.length > 0) {
                dv.span(`<br>🏷️ ${fm.cooking_patterns.join(' · ')}`);
            }
        }
    }
    
    // Optional: Show detailed cooking history with bar chart (collapsible)
    if (totalCount >= 3) {
        // Determine starting month: either first cooking date or 12 months ago, whichever is later
        const firstCookingMonth = moment(firstDate);
        const twelveMonthsAgo = moment().subtract(11, 'months').startOf('month');
        const startMonth = moment.max(firstCookingMonth.startOf('month'), twelveMonthsAgo);
        
        // Calculate how many months to show (max 12, but could be less if recipe is newer)
        const monthsToShow = Math.min(12, moment().diff(startMonth, 'months') + 1);
        
        // Generate months data for bar chart
        const chartMonths = [];
        const monthlyData = {};
        
        // Initialize months with 0 counts
        for (let i = monthsToShow - 1; i >= 0; i--) {
            const monthMoment = moment().subtract(i, 'months');
            const monthKey = monthMoment.format('YYYY-MM');
            const monthLabel = monthMoment.format('MM月');
            chartMonths.push({
                key: monthKey,
                label: monthLabel,
                count: 0,
                dates: []
            });
            monthlyData[monthKey] = { count: 0, dates: [] };
        }
        
        // Count actual cooking dates
        dates.forEach(d => {
            const monthKey = moment(d.file.name).format('YYYY-MM');
            if (monthlyData[monthKey]) {
                monthlyData[monthKey].count++;
                monthlyData[monthKey].dates.push(d.file.name);
            }
        });
        
        // Update the chartMonths array with actual counts
        chartMonths.forEach(month => {
            if (monthlyData[month.key]) {
                month.count = monthlyData[month.key].count;
                month.dates = monthlyData[month.key].dates;
            }
        });
        
        // Find max count for scaling
        const maxCount = Math.max(...chartMonths.map(m => m.count), 1);

        // Chart title and scale with dynamic period
        const startMonthName = startMonth.format('YYYY年MM月');
        const currentMonthName = moment().format('YYYY年MM月');
        const periodText = monthsToShow === 12 ? '近12个月' : `${startMonthName}至今`;
        
        dv.span(`<div style="margin-bottom: 8px; font-weight: bold;">${periodText}制作频率</div>`);
        dv.span(`<div style="margin-bottom: 10px; color: var(--text-muted); font-size: 0.8em;">最高: ${maxCount}次 | 显示: ${monthsToShow}个月</div>`);
        
        // Generate bars
        chartMonths.forEach(month => {
            const barWidth = maxCount > 0 ? Math.round((month.count / maxCount) * 2) : 0;
            const bar = '🟩'.repeat(barWidth);
            //+ '⬛'.repeat(Math.max(0, 10 - barWidth));
            const isCurrentMonth = moment().format('YYYY-MM') === month.key;
            const monthStyle = isCurrentMonth ? 'font-weight: bold; color: var(--text-accent);' : '';
            
            dv.span(`<div style="display: flex; align-items: center; margin: 2px 0;">`);
            dv.span(`<span style="width: 35px; text-align: right; margin-right: 8px; ${monthStyle}">${month.label}</span>`);
            dv.span(`<span style="color: var(--text-accent); margin-right: 8px;">${bar}</span>`);
            dv.span(`<span style="color: var(--text-muted); font-size: 0.9em;">${month.count}次</span>`);
            dv.span(`</div>`);
        });
        
        dv.span(`</div>`);
        
        dv.span(`</details>`);
    }
    
} else {
    dv.span("还没有制作记录");
    
    // Clear outdated frontmatter for the embedding page
    const currentFrontmatter = targetFile.frontmatter || {};
    const fieldsToClean = ['last_cooked', 'first_cooked', 'cooking_count', 
                          'cooking_frequency', 'favorite_season', 'recent_activity', 
                          'cooking_years', 'cooking_patterns'];
    
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