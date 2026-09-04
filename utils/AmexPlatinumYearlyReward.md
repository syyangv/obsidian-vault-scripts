---
modified_at: 2026-09-03
---
```dataviewjs
(async () => {
    // ===== PREVENT MULTIPLE SIMULTANEOUS EXECUTIONS =====
    const activeFile = app.workspace.getActiveFile();

    if (!activeFile) {
        dv.paragraph("⚠️ No active file detected.");
        return;
    }

    const containerId = 'amex-platinum-reward-' + activeFile.path;

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
    const cfgPage = dv.page("Helper/config/AmexPlatinumRewardConfig");
    if (!cfgPage || !cfgPage.file || !cfgPage.file.frontmatter) {
        dv.paragraph("⚠️ Missing AmexPlatinumRewardConfig.md");
        return;
    }
    const cfg = cfgPage.file.frontmatter;
    const prefix = cfg.prefix;
    const rn = cfg.rowNames || {};
    const nonPct = cfg.nonPct || [];
    const mirror = cfg.mirror || [];

    const baseFolder = "年度记录";
    const dailyNotesFolder = "日记";

    const currentFileName = activeFile.basename || "";
    const yearMatch = currentFileName.match(/(\d{4})/);
    const selectedYear = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

    function parseVal(v) {
        if (typeof v === 'number' && !isNaN(v)) return v;
        if (typeof v === 'string') { const n = Number(v.replace(/[$,]/g, '')); if (!isNaN(n)) return n; }
        return null;
    }

    function collectTotals(pages) {
        const totals = {};
        for (let page of pages) {
            if (!page || !page.file) continue;
            const fm = page.file.frontmatter;
            if (!fm || typeof fm !== 'object') continue;
            for (const key of Object.keys(fm)) {
                if (!key.startsWith(prefix)) continue;
                const v = parseVal(fm[key]);
                if (v !== null) totals[key] = (totals[key] || 0) + v;
            }
        }
        return totals;
    }

    let expensePages;
    try { expensePages = dv.pages(`"${baseFolder}/${selectedYear}"`); }
    catch (e) { expensePages = []; }

    let dailyPages;
    try { dailyPages = dv.pages(`"${dailyNotesFolder}/${selectedYear}"`); }
    catch (e) { dailyPages = []; }

    const yearTotals = collectTotals(expensePages);
    const creditTotals = collectTotals(dailyPages);

    const allKeys = [...new Set([...Object.keys(yearTotals), ...Object.keys(creditTotals)])].sort();
    if (allKeys.length === 0) {
        dv.paragraph(`📄 No Amex Platinum data found for ${selectedYear}.`);
        return;
    }

    function camelToTitle(key) {
        let name = key.replace(new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), '');
        name = name.replace(/([A-Z])/g, ' $1');
        return (name.charAt(0).toUpperCase() + name.slice(1)).trim() || key;
    }

    function createProgressBar(percentage) {
        const pct = Math.min(100, Math.max(0, typeof percentage === 'number' && !isNaN(percentage) ? percentage : 0));
        const W = 200, H = 18, R = 9, filled = (pct / 100) * W;
        const color = pct >= 80 ? "#22c55e" : pct >= 60 ? "#eab308" : pct >= 40 ? "#f97316" : pct >= 20 ? "#ef4444" : "#b91c1c";
        const hId = "hl_" + Math.random().toString(36).slice(2, 7);
        const cId = "cp_" + Math.random().toString(36).slice(2, 7);
        return `<svg width="${W}" height="${H}" style="vertical-align:middle"><defs><linearGradient id="${hId}" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="white" stop-opacity="0.52"/><stop offset="38%" stop-color="white" stop-opacity="0.09"/><stop offset="39%" stop-color="black" stop-opacity="0.00"/><stop offset="100%" stop-color="black" stop-opacity="0.28"/></linearGradient><clipPath id="${cId}"><rect width="${W}" height="${H}" rx="${R}"/></clipPath></defs><rect width="${W}" height="${H}" rx="${R}" fill="#141414" stroke="#080808" stroke-width="1.5"/><g clip-path="url(#${cId})"><rect width="${filled}" height="${H}" fill="${color}"/><rect width="${filled}" height="${H}" fill="url(#${hId})"/></g></svg><span style="margin-left:9px;font-size:1.1em;">${Math.max(0, percentage).toFixed(1)}%</span>`;
    }

    function buildTable(container, headers, rows) {
        container.empty();
        const tbl = container.createEl("table", { cls: "dataview table-view-table" });
        const hrow = tbl.createEl("thead").createEl("tr");
        headers.forEach(h => hrow.createEl("th", { text: h }));
        const tbody = tbl.createEl("tbody");
        rows.forEach(row => {
            const tr = tbody.createEl("tr");
            row.forEach(cell => { const td = tr.createEl("td"); td.innerHTML = String(cell); });
        });
    }

    const rawRows = allKeys.map(key => {
        const displayName = rn[key] || camelToTitle(key);
        const credit = Math.round(creditTotals[key] || 0);
        const expense = mirror.includes(key) ? credit : Math.round(yearTotals[key] || 0);
        const isNP = nonPct.includes(key);
        const net = isNP ? 0 : expense - credit;
        const pct = expense > 0 ? (credit / expense) * 100 : 0;
        return { displayName, expense, credit, net, pct, isNP };
    });

    rawRows.sort((a, b) => {
        if (a.isNP !== b.isNP) return a.isNP ? 1 : -1;
        if (a.isNP && b.isNP) return b.credit - a.credit || a.displayName.localeCompare(b.displayName);

        const aDone = a.pct >= 100 || a.expense <= 0;
        const bDone = b.pct >= 100 || b.expense <= 0;

        if (aDone !== bDone) return aDone ? 1 : -1;

        if (!aDone) {
            if (Math.abs(a.pct - b.pct) > 0.01) return a.pct - b.pct;
            if (b.net !== a.net) return b.net - a.net;
            return a.displayName.localeCompare(b.displayName);
        } else {
            if (Math.abs(a.pct - b.pct) > 0.01) return a.pct - b.pct;
            return a.displayName.localeCompare(b.displayName);
        }
    });

    const rows = rawRows.map(r => [
        r.displayName,
        r.expense,
        r.credit,
        r.net,
        r.isNP ? `$${r.credit}` : createProgressBar(r.pct)
    ]);

    const totalExp = rows.reduce((s, r) => s + (typeof r[1] === 'number' ? r[1] : 0), 0);
    const totalCred = rows.reduce((s, r) => s + (typeof r[2] === 'number' ? r[2] : 0), 0);
    const totalNet = totalExp - totalCred;
    const totalPct = totalExp > 0 ? (totalCred / totalExp) * 100 : 0;
    rows.push(["**TOTAL**", totalExp, `<span style="color: red;">$${totalCred}</span>`, totalNet, createProgressBar(totalPct)]);

    buildTable(dv.container, ["Category", "Credit", "已用", "剩余", "Usage"], rows);

} catch (error) {
    console.error('Amex Platinum Reward Error:', error);
    dv.paragraph('⚠️ Error: ' + error.message);
} finally {
    // Always clear running flag
    window[containerId + '_running'] = false;
}
})();
```
