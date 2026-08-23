---
modified_at: 2026-07-19
---
```dataviewjs
(async () => {
    // ===== PREVENT MULTIPLE SIMULTANEOUS EXECUTIONS =====
    const activeFile = app.workspace.getActiveFile();
    if (!activeFile) {
        dv.span('⚠️ Cannot detect file');
        return;
    }

    const containerId = 'monthly-stats-' + activeFile.path;

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
    
    const fileName = activeFile.basename;
    const match = fileName.match(/^(\d{4})-(\d{2})$/);
    if (!match) {
        dv.span('⚠️ Filename must be YYYY-MM format');
        return;
    }
    
    const year = parseInt(match[1]);
    const month = parseInt(match[2]);
    
    let dailyNotes = [];
    try {
        dailyNotes = dv.pages('"日记/' + year + '"')
            .where(p => p?.file?.day?.month === month && p?.file?.day?.year === year);
    } catch (e) {
        console.error('Error querying pages:', e);
    }
    
    const startDate = dv.luxon.DateTime.local(year, month, 1);
    const endDate = startDate.endOf('month');
    
    let workdaysWithoutHoliday = 0;
    let ptoDays = 0;
    let holidayDays = 0;
    let sickLeaveDays = 0;
    let goodDays = 0;
    
    for (let d = startDate; d <= endDate; d = d.plus({days: 1})) {
        const pageForDate = dailyNotes.find(p => p?.file?.day?.hasSame?.(d, 'day'));
        
        // Get 假期 frontmatter field (convert to array if needed)
        const 假期Raw = pageForDate?.["假期"];
        const 假期 = 假期Raw ? (Array.isArray(假期Raw) ? 假期Raw : [假期Raw]) : [];
        
        // Helper to check if a specific holiday type exists
        const hasHolidayType = (type) => {
            return 假期.some(h => String(h) === type || String(h).endsWith('/' + type.split('/').pop()));
        };
        
        // Check for 今日甚好 on any day
        if (pageForDate?.["今日甚好"] === true) {
            goodDays++;
        }
        
        // Weekday checks (Luxon: Saturday = 6, Sunday = 7)
        if (d.weekday !== 6 && d.weekday !== 7) {
            const hasAnyHoliday = 假期.length > 0;
            const hasPTO = 假期.some(h => String(h) === "放假/PTO");
            const hasPublicHoliday = 假期.some(h => String(h) === "放假/公共假期");
            const hasSickLeave = 假期.some(h => String(h) === "放假/病假");
            
            if (hasPTO) ptoDays++;
            if (hasPublicHoliday) holidayDays++;
            if (hasSickLeave) sickLeaveDays++;
            if (!pageForDate || !hasAnyHoliday) workdaysWithoutHoliday++;
        }
    }
    
    dv.span("**💼工作天数：**" + workdaysWithoutHoliday + " | **🏖️PTO天数：**" + ptoDays + " | **🎉公休天数：**" + holidayDays + " | **🤒病假天数：**" + sickLeaveDays + " | **❤️今日甚好：**" + goodDays);
} catch (error) {
    console.error('Work Stats Error:', error);
    dv.span('⚠️ Error: ' + error.message);
} finally {
    // Always clear running flag
    window[containerId + '_running'] = false;
}
})();
```