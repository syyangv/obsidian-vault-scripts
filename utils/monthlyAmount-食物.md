---
modified_at: 2026-07-19
---
```dataviewjs
// 食物金额 Year-over-Year Comparison

try {
const currentYear = new Date().getFullYear();
const lastYear = currentYear - 1;

const months = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

let food_currentYear = new Array(12).fill(null);
let food_lastYear = new Array(12).fill(null);

const pages = dv.pages('"年度记录"')
    .where(p => p.食物金额 !== undefined);

for (let page of pages) {
    const fileName = page.file.name;
    const match = fileName.match(/^(\d{4})-(\d{2})$/);

    if (match) {
        const year = parseInt(match[1]);
        const month = parseInt(match[2]) - 1;

        if (year === currentYear && month >= 0 && month < 12) {
            food_currentYear[month] = page.食物金额;
        } else if (year === lastYear && month >= 0 && month < 12) {
            food_lastYear[month] = page.食物金额;
        }
    }
}

const container = this.container;
container.empty();

const chartDiv = container.createEl('div');
chartDiv.style.maxWidth = '850px';
chartDiv.style.maxHeight = '280px';

const chartData = {
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
        maintainAspectRatio: false,
        plugins: {
            title: { display: true, text: '食物金额 年度对比' },
            legend: { position: 'top' }
        },
        scales: {
            y: { beginAtZero: true, title: { display: true, text: '金额' } }
        }
    }
};

window.renderChart(chartData, chartDiv);

} catch (error) {
    console.error('Food Chart Error:', error);
    dv.paragraph('⚠️ Error: ' + error.message);
}
```
