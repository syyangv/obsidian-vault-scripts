---
tags:
完成日期: 2025-09-29
modified_at: 2026-07-20
---

# Year^
```dataviewjs
(async () => {
    // ===== PREVENT MULTIPLE SIMULTANEOUS EXECUTIONS =====
    const actualCurrentFile = app.workspace.getActiveFile();

    if (!actualCurrentFile) {
        dv.paragraph("⚠️ No active file detected.");
        return;
    }

    const containerId = 'progress-bar-year-' + actualCurrentFile.path;

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

    const noteTitle = actualCurrentFile.name;
    const yearMatch = noteTitle.match(/(\d{4})/);

    if (!yearMatch) {
        dv.paragraph(`⚠️ No year found in "${noteTitle}". Please include a 4-digit year (e.g., '2024') in your note name.`);
        return;
    }

    const year = parseInt(yearMatch[1]);
    const now = new Date();
    const currentYear = now.getFullYear();

    // Calculate progress
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year + 1, 0, 1);
    const daysTotal = Math.ceil((yearEnd - yearStart) / (1000 * 60 * 60 * 24));

    let progress, daysPassed, daysRemaining;

    if (year < currentYear) {
        progress = 100;
        daysPassed = daysTotal;
        daysRemaining = 0;
    } else if (year > currentYear) {
        progress = 0;
        daysPassed = 0;
        daysRemaining = daysTotal;
    } else {
        daysPassed = Math.ceil((now - yearStart) / (1000 * 60 * 60 * 24));
        daysRemaining = daysTotal - daysPassed;
        progress = (daysPassed / daysTotal) * 100;
    }

    const progressBarWidth = Math.round(progress);

    // Pastel color palette
    const pastelColors = {
        primary: '#B4A7D6',
        secondary: '#A8D8EA',
        accent: '#FFB6B9',
        background: '#F7F0F5',
        gradient: 'linear-gradient(90deg, #B4A7D6, #A8D8EA, #FFB6B9)'
    };

    // Inject CSS for hover effects (only once)
    const styleId = 'year-progress-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .year-progress-month-link {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 0.75em;
                color: white;
                text-decoration: none;
                cursor: pointer;
                font-weight: bold;
                text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
                white-space: nowrap;
                transition: opacity 0.2s ease;
            }
            .year-progress-month-link:hover {
                opacity: 0.7;
            }
        `;
        document.head.appendChild(style);
    }

    const containerStyle = "max-width: 100%; margin: 0 auto;";
    const vaultName = app.vault.getName();

    // Week progress calculation
    const jan1 = new Date(year, 0, 1);
    const jan1DayOfWeek = jan1.getDay();

    let firstFullWeekStart;
    if (jan1DayOfWeek === 1) {
        firstFullWeekStart = new Date(year, 0, 1);
    } else if (jan1DayOfWeek === 0) {
        firstFullWeekStart = new Date(year, 0, 2);
    } else {
        const daysToNextMonday = 8 - jan1DayOfWeek;
        firstFullWeekStart = new Date(year, 0, 1 + daysToNextMonday);
    }

    const lastDayOfYear = new Date(year, 11, 31);
    const totalWeeks = Math.ceil((lastDayOfYear - firstFullWeekStart) / (7 * 24 * 60 * 60 * 1000)) + 1;

    let weeksPassed = 0;
    if (year < currentYear) {
        weeksPassed = totalWeeks;
    } else if (year > currentYear) {
        weeksPassed = 0;
    } else if (now >= firstFullWeekStart) {
        weeksPassed = Math.floor((now - firstFullWeekStart) / (7 * 24 * 60 * 60 * 1000)) + 1;
    }

    weeksPassed = Math.min(weeksPassed, totalWeeks);

    const weekProgressPercent = totalWeeks > 0 ? (weeksPassed / totalWeeks * 100).toFixed(2) : '0';
    const weekProgressWidth = totalWeeks > 0 ? (weeksPassed / totalWeeks * 100) : 0;
    const weeksRemaining = Math.max(totalWeeks - weeksPassed, 0);

    // Monthly progress calculation
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let monthSegments = '';
    
    for (let month = 0; month < 12; month++) {
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0);
        const monthDays = monthEnd.getDate();
        
        let monthProgress = 0;
        if (year < currentYear) {
            monthProgress = 100;
        } else if (year > currentYear) {
            monthProgress = 0;
        } else {
            const monthStartDay = Math.ceil((monthStart - yearStart) / (1000 * 60 * 60 * 24)) + 1;
            const monthEndDay = monthStartDay + monthDays - 1;
            
            if (daysPassed >= monthEndDay) {
                monthProgress = 100;
            } else if (daysPassed <= monthStartDay) {
                monthProgress = 0;
            } else {
                monthProgress = ((daysPassed - monthStartDay + 1) / monthDays) * 100;
            }
        }
        
        const monthNumber = (month + 1).toString().padStart(2, '0');
        const monthNoteLink = `${year}-${monthNumber}`;
        
        monthSegments += `<div style="flex: 1; background: #E8E8E8; position: relative; border-radius: 2px; overflow: hidden;">
            <div style="background: ${pastelColors.secondary}; height: 100%; width: ${monthProgress}%;"></div>
            <a href="obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(monthNoteLink)}" 
               class="year-progress-month-link">${monthNames[month]}</a>
        </div>`;
    }

    const monthsPassed = year < currentYear ? 12 : (year > currentYear ? 0 : now.getMonth() + 1);
    const monthsRemaining = 12 - (year > currentYear ? 0 : Math.min(monthsPassed, 12));

    // Build complete HTML
    const container = dv.container.createEl('div');
    container.innerHTML = `
    <div style="${containerStyle}">
        <div style="background: ${pastelColors.background}; border-radius: 8px; padding: 15px; border-left: 4px solid ${pastelColors.primary}; margin-bottom: 0px;">
            <div style="background: #E8E8E8; height: 32px; border-radius: 10px; overflow: hidden; margin-bottom: 4px;">
                <div style="background: ${pastelColors.gradient}; height: 100%; width: ${progressBarWidth}%; border-radius: 10px; display: flex; align-items: center; justify-content: flex-end; padding-right: 10px; color: white; font-size: 0.8em; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.3);">${progress.toFixed(2)}%---${daysPassed}/${daysTotal}</div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.9em; color: #8B7E9B;">
                <span>⏳ ${daysRemaining} days remaining</span>
            </div>
        </div>
    </div>

    <div style="${containerStyle}">
        <div style="background: ${pastelColors.background}; border-radius: 8px; padding: 15px; border-left: 4px solid ${pastelColors.secondary}; margin-bottom: 0px;">
            <div style="background: #E8E8E8; height: 32px; border-radius: 10px; overflow: hidden; display: flex; gap: 1px; margin-bottom: 4px; position: relative;">
                ${monthSegments}
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.9em; color: #8B7E9B;">
                <span>⏳ ${monthsRemaining} months remaining</span>
            </div>
        </div>
    </div>

    <div style="${containerStyle}">
        <div style="background: ${pastelColors.background}; border-radius: 8px; padding: 15px; border-left: 4px solid ${pastelColors.accent};">
            <div style="background: #E8E8E8; height: 32px; border-radius: 10px; overflow: hidden; margin-bottom: 4px;">
                <div style="background: ${pastelColors.accent}; height: 100%; width: ${weekProgressWidth}%; border-radius: 10px; display: flex; align-items: center; justify-content: flex-end; padding-right: 10px; color: white; font-size: 0.8em; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.3);">${weekProgressPercent}%---${weeksPassed}/${totalWeeks}</div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.9em; color: #8B7E9B;">
                <span>⏳ ${weeksRemaining} weeks remaining</span>
            </div>
        </div>
    </div>`;

} catch (error) {
    console.error('ProgressBar Error:', error);
    dv.paragraph('⚠️ Error: ' + error.message);
} finally {
    // Always clear running flag
    window[containerId + '_running'] = false;
}
})();
```
