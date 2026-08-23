---
modified_at: 2026-07-20
---
```dataviewjs
// 购物金额 & 食物金额 & 电费 Year-over-Year Comparison with Tabs

try {
const currentYear = new Date().getFullYear();
const lastYear = currentYear - 1;

const months = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

// Initialize data arrays
let shopping_currentYear = new Array(12).fill(null);
let shopping_lastYear = new Array(12).fill(null);
let food_currentYear = new Array(12).fill(null);
let food_lastYear = new Array(12).fill(null);
let electricity_currentYear = new Array(12).fill(null);
let electricity_lastYear = new Array(12).fill(null);

// Query monthly notes from 年度记录/YYYY/月计划 folders
const pages = dv.pages('"年度记录"')
    .where(p => p.购物金额 !== undefined || p.食物金额 !== undefined || p.电费 !== undefined);

for (let page of pages) {
    const fileName = page.file.name;
    const match = fileName.match(/^(\d{4})-(\d{2})$/);

    if (match) {
        const year = parseInt(match[1]);
        const month = parseInt(match[2]) - 1;

        if (year === currentYear && month >= 0 && month < 12) {
            if (page.购物金额 !== undefined) shopping_currentYear[month] = page.购物金额;
            if (page.食物金额 !== undefined) food_currentYear[month] = page.食物金额;
            if (page.电费 !== undefined) electricity_currentYear[month] = page.电费;
        } else if (year === lastYear && month >= 0 && month < 12) {
            if (page.购物金额 !== undefined) shopping_lastYear[month] = page.购物金额;
            if (page.食物金额 !== undefined) food_lastYear[month] = page.食物金额;
            if (page.电费 !== undefined) electricity_lastYear[month] = page.电费;
        }
    }
}

// Create container
const container = this.container;
container.empty();

// Create unique ID for this instance
const uniqueId = 'chart-tabs-' + Math.random().toString(36).substr(2, 9);

// Create tab structure
const tabContainer = container.createEl('div', { cls: 'chart-tab-container' });
tabContainer.setAttribute('id', uniqueId);

// Tab buttons
const tabButtons = tabContainer.createEl('div', { cls: 'chart-tab-buttons' });
const shoppingTab = tabButtons.createEl('button', { text: '🛍️ 购物金额', cls: 'chart-tab-btn active' });
const foodTab = tabButtons.createEl('button', { text: '🍔 食物金额', cls: 'chart-tab-btn' });
const electricityTab = tabButtons.createEl('button', { text: '⚡ 电费', cls: 'chart-tab-btn' });

// Chart containers
const shoppingChartDiv = tabContainer.createEl('div', { cls: 'chart-content active' });
const foodChartDiv = tabContainer.createEl('div', { cls: 'chart-content' });
const electricityChartDiv = tabContainer.createEl('div', { cls: 'chart-content' });

// Styles
const style = container.createEl('style');
style.textContent = `
    #${uniqueId} .chart-tab-buttons {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
    }
    #${uniqueId} .chart-tab-btn {
        padding: 6px 16px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        background: var(--background-secondary);
        color: var(--text-muted);
        transition: all 0.2s ease;
    }
    #${uniqueId} .chart-tab-btn:hover {
        background: var(--background-modifier-hover);
    }
    #${uniqueId} .chart-tab-btn.active {
        background: rgba(183, 225, 205, 0.5);
        color: var(--text-normal);
        font-weight: 500;
    }
    #${uniqueId} .chart-content {
        display: none;
        max-width: 700px;
        max-height: 350px;
    }
    #${uniqueId} .chart-content.active {
        display: block;
    }
`;

// Tab switching logic - using array for cleaner management
const tabs = [
    { btn: shoppingTab, div: shoppingChartDiv },
    { btn: foodTab, div: foodChartDiv },
    { btn: electricityTab, div: electricityChartDiv }
];

tabs.forEach((tab, index) => {
    tab.btn.addEventListener('click', () => {
        tabs.forEach(t => {
            t.btn.classList.remove('active');
            t.div.classList.remove('active');
        });
        tab.btn.classList.add('active');
        tab.div.classList.add('active');
    });
});

// Forwarding expense calculation (amortized over order span)
const fwPages = dv.pages('"Logistics/购物/转运记录"')
    .where(p => p.file.name !== "转运记录" && p.打包时间);
const today = dv.date("today");
const fwRecords = [];
for (const p of fwPages) {
    const startDate = p.打包时间;
    let endDate = (startDate > today) ? startDate : (p.收到时间 || today);
    const total = (p["商品金额($)"] || 0) + (p["运费($)"] || 0);
    if (startDate && total > 0) {
        fwRecords.push({ start: new Date(startDate.ts), end: new Date(endDate.ts), total });
    }
}
function calcForwarding(year) {
    return Array.from({length: 12}, (_, mi) => {
        const ms = new Date(year, mi, 1), me = new Date(year, mi + 1, 0);
        let t = 0;
        for (const r of fwRecords) {
            const od = Math.ceil((r.end - r.start) / 86400000) + 1;
            const os = new Date(Math.max(r.start, ms)), oe = new Date(Math.min(r.end, me));
            if (os <= oe) t += (r.total / od) * (Math.ceil((oe - os) / 86400000) + 1);
        }
        return t > 0 ? parseFloat(t.toFixed(2)) : null;
    });
}
const fw_lastYear = calcForwarding(lastYear);
const fw_currentYear = calcForwarding(currentYear);

// If forwarding > shopping for a month, carry the excess back to prior months.
// Process Jan→Dec so earlier months claim prior capacity first; each month
// then cascades its remaining excess further back, skipping null months.
function applyCarryBack(fw, shopping) {
    const f = fw.map(v => v || 0);
    for (let i = 0; i <= 11; i++) {
        if (shopping[i] === null) continue;
        if (f[i] > shopping[i]) {
            let excess = parseFloat((f[i] - shopping[i]).toFixed(2));
            f[i] = shopping[i];
            // Distribute excess to prior months with shopping data, in order,
            // filling each up to its shopping cap before moving further back.
            for (let j = i - 1; j >= 0 && excess > 0; j--) {
                if (shopping[j] === null) continue;
                const room = parseFloat((shopping[j] - f[j]).toFixed(2));
                if (room > 0) {
                    const absorb = parseFloat(Math.min(excess, room).toFixed(2));
                    f[j] = parseFloat((f[j] + absorb).toFixed(2));
                    excess = parseFloat((excess - absorb).toFixed(2));
                }
            }
        }
    }
    return f;
}
const adj_fw_lastYear = applyCarryBack(fw_lastYear, shopping_lastYear);
const adj_fw_currentYear = applyCarryBack(fw_currentYear, shopping_currentYear);

// Shopping chart data (stacked: other shopping + forwarding)
const shoppingChartData = {
    type: 'bar',
    data: {
        labels: months,
        datasets: [
            {
                label: `${lastYear}年 转运`,
                data: shopping_lastYear.map((v, i) => { const fw = adj_fw_lastYear[i] || 0; if (!fw) return null; return v === null ? parseFloat(fw.toFixed(2)) : parseFloat(Math.min(fw, v).toFixed(2)); }),
                backgroundColor: 'rgba(251, 113, 133, 0.85)',
                borderColor: 'rgba(225, 29, 72, 1)',
                borderWidth: 1,
                stack: `${lastYear}`
            },
            {
                label: `${lastYear}年 其他购物`,
                data: shopping_lastYear.map((v, i) => v === null ? null : parseFloat(Math.max(0, v - (adj_fw_lastYear[i] || 0)).toFixed(2))),
                backgroundColor: 'rgba(255, 154, 162, 0.8)',
                borderColor: 'rgba(255, 154, 162, 1)',
                borderWidth: 1,
                stack: `${lastYear}`
            },
            {
                label: `${currentYear}年 转运`,
                data: shopping_currentYear.map((v, i) => { const fw = adj_fw_currentYear[i] || 0; if (!fw) return null; return v === null ? parseFloat(fw.toFixed(2)) : parseFloat(Math.min(fw, v).toFixed(2)); }),
                backgroundColor: 'rgba(34, 197, 94, 0.85)',
                borderColor: 'rgba(21, 128, 61, 1)',
                borderWidth: 1,
                stack: `${currentYear}`
            },
            {
                label: `${currentYear}年 其他购物`,
                data: shopping_currentYear.map((v, i) => v === null ? null : parseFloat(Math.max(0, v - (adj_fw_currentYear[i] || 0)).toFixed(2))),
                backgroundColor: 'rgba(183, 225, 205, 0.8)',
                borderColor: 'rgba(183, 225, 205, 1)',
                borderWidth: 1,
                stack: `${currentYear}`
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            title: { display: true, text: '购物金额 年度对比（含转运占比）' },
            legend: {
                position: 'top',
                labels: {
                    generateLabels: (chart) => [
                        { text: `${lastYear}年`,    fillStyle: 'rgba(255,154,162,0.8)', strokeStyle: 'rgba(255,154,162,1)', lineWidth: 1, hidden: !chart.isDatasetVisible(0) && !chart.isDatasetVisible(1), datasetIndex: 0 },
                        { text: `${currentYear}年`, fillStyle: 'rgba(183,225,205,0.8)', strokeStyle: 'rgba(183,225,205,1)', lineWidth: 1, hidden: !chart.isDatasetVisible(2) && !chart.isDatasetVisible(3), datasetIndex: 2 },
                    ]
                },
                onClick: (e, item, legend) => {
                    const chart = legend.chart;
                    const isLast = item.text === `${lastYear}年`;
                    const [a, b] = isLast ? [0, 1] : [2, 3];
                    const vis = chart.isDatasetVisible(a);
                    chart.setDatasetVisibility(a, !vis);
                    chart.setDatasetVisibility(b, !vis);
                    chart.update();
                }
            },
            tooltip: {
                callbacks: {
                    label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(2) ?? '-'}`
                }
            }
        },
        scales: {
            x: { stacked: true },
            y: { stacked: true, beginAtZero: true, title: { display: true, text: '金额' } }
        }
    }
};

// Food chart data
const foodChartData = {
    type: 'bar',
    data: {
        labels: months,
        datasets: [
            {
                label: `${lastYear}年`,
                data: food_lastYear,
                backgroundColor: 'rgba(255, 154, 162, 0.8)',
                borderColor: 'rgba(255, 154, 162, 1)',
                borderWidth: 1
            },
            {
                label: `${currentYear}年`,
                data: food_currentYear,
                backgroundColor: 'rgba(183, 225, 205, 0.8)',
                borderColor: 'rgba(183, 225, 205, 1)',
                borderWidth: 1
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            title: { display: true, text: '食物金额 年度对比' },
            legend: { position: 'top' }
        },
        scales: {
            y: { beginAtZero: true, title: { display: true, text: '金额' } }
        }
    }
};

// Electricity chart data
const electricityChartData = {
    type: 'bar',
    data: {
        labels: months,
        datasets: [
            {
                label: `${lastYear}年`,
                data: electricity_lastYear,
                backgroundColor: 'rgba(255, 154, 162, 0.8)',
                borderColor: 'rgba(255, 154, 162, 1)',
                borderWidth: 1
            },
            {
                label: `${currentYear}年`,
                data: electricity_currentYear,
                backgroundColor: 'rgba(183, 225, 205, 0.8)',
                borderColor: 'rgba(183, 225, 205, 1)',
                borderWidth: 1
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            title: { display: true, text: '电费 年度对比' },
            legend: { position: 'top' }
        },
        scales: {
            y: { beginAtZero: true, title: { display: true, text: '金额' } }
        }
    }
};

// Render charts
window.renderChart(shoppingChartData, shoppingChartDiv);
window.renderChart(foodChartData, foodChartDiv);
window.renderChart(electricityChartData, electricityChartDiv);

} catch (error) {
    console.error('Monthly Amount Chart Error:', error);
    dv.paragraph('⚠️ Error: ' + error.message);
}
```
