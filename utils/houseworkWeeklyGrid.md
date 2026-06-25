---
modified_at: 2026-06-13
---
```dataviewjs
// =====================================================
// 家务 Weekly Grid Tracker
// Rows = tasks  |  Columns = weeks (newest = right)
// Styled like a GitHub contribution / habit tracker
// =====================================================
(async () => {

// ──────────────────── CONFIG ────────────────────────
const CELL     = 16;   // cell width & height (px)
const GAP      = 4;    // gap between cells
const STEP     = CELL + GAP;
const LABEL_W  = 196;  // width reserved for left labels
const TOP_PAD  = 36;   // height reserved for month labels
const GRP_GAP  = 0;    // no extra gap between groups — same spacing as within groups
const ICON_W   = 2 * CELL; // squircle pill width = 2 grid squares; height spans the full group band

const MONTH_NAMES = ['一月','二月','三月','四月','五月','六月',
                     '七月','八月','九月','十月','十一月','十二月'];

// Task groups — gradLight/gradDark drive the squircle icon gradient;
// icon is a 16×16-space SVG snippet rendered inside the squircle.
const GROUPS = [
    {
        room: '地面', color: '#fbbf24', gradLight: '#fef3c7', gradDark: '#b45309',
        icon: `<line x1="2.5" y1="5"   x2="13.5" y2="5"   stroke="white" stroke-width="1.8" stroke-linecap="round"/>
               <line x1="2.5" y1="8.5" x2="13.5" y2="8.5" stroke="white" stroke-width="1.8" stroke-linecap="round"/>
               <line x1="2.5" y1="12"  x2="13.5" y2="12"  stroke="white" stroke-width="1.8" stroke-linecap="round"/>`,
        tasks: [
            { key: '吸尘', fm: 'hw_floor', fmVals: ['吸尘'], label: '🌪️ 吸尘' },
            { key: '拖地', fm: 'hw_floor', fmVals: ['拖地'], label: '🧽 拖地' },
        ]
    },
    {
        room: '卧室', color: '#f472b6', gradLight: '#fce7f3', gradDark: '#be185d',
        icon: `<path d="M2 13v-4h12v4M1 13h14M4 9V7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                     stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
        tasks: [
            { key: '换床单', fm: 'hw_bedroom', fmVals: ['换床单'], label: '🛏️ 换床单' },
            { key: '换被套', fm: 'hw_bedroom', fmVals: ['换被套'], label: '🛏️ 换被套' },
        ]
    },
    {
        room: '衣物', color: '#a78bfa', gradLight: '#ede9fe', gradDark: '#6d28d9',
        icon: `<path d="M6 2.5L3.5 5.5L5.5 5.5V13h5V5.5l2 0L10 2.5Q8.5 4.5 8 4.5Q7.5 4.5 6 2.5Z"
                     stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
        tasks: [
            { key: '洗衣服',               fm: 'hw_laundry', fmVals: ['洗衣服'],                            label: '👔 洗衣服'    },
            { key: '整理/叠衣服/上衣',     fm: 'hw_laundry', fmVals: ['整理/叠衣服/上衣', '叠衣服'],       label: '👚 叠/上衣'   },
            { key: '整理/叠衣服/下装',     fm: 'hw_laundry', fmVals: ['整理/叠衣服/下装', '叠衣服'],       label: '👖 叠/下装'   },
            { key: '整理/叠衣服/毛巾床品', fm: 'hw_laundry', fmVals: ['整理/叠衣服/毛巾床品', '叠衣服'],   label: '🛏️ 叠/毛巾'   },
            { key: '整理/卖Mercari',       fm: 'hw_laundry', fmVals: ['整理/卖Mercari'],                   label: '🛍️ 卖Mercari' },
        ]
    },
    {
        room: '浴室', color: '#38bdf8', gradLight: '#e0f2fe', gradDark: '#0369a1',
        icon: `<path d="M8 2L12.5 8A4.5 4.5 0 0 1 8 14A4.5 4.5 0 0 1 3.5 8Z"
                     stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="rgba(255,255,255,0.2)"/>`,
        tasks: [
            { key: '刷马桶',         fm: 'hw_bathroom', fmVals: ['刷马桶'],         label: '🚽 刷马桶'  },
            { key: '洗手台',         fm: 'hw_bathroom', fmVals: ['洗手台'],         label: '🚰 洗手台'  },
            { key: '浴室地面',       fm: 'hw_bathroom', fmVals: ['浴室地面'],       label: '🧼 浴室地面' },
            { key: '替换/牙刷刷头', fm: 'hw_bathroom', fmVals: ['替换/牙刷刷头'], label: '🪥 牙刷刷头' },
        ]
    },
    {
        room: '厨房', color: '#34d399', gradLight: '#d1fae5', gradDark: '#065f46',
        icon: `<path d="M8.5 2Q9 5 11 5Q11 3.5 12.5 4Q12.5 8 10 10Q11 10 11 12Q11 14.5 8 14.5Q5 14.5 5 12Q5 10 6 10Q3.5 8 3.5 4Q5 3.5 5 5Q7 5 7.5 2Z"
                     stroke="white" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="rgba(255,255,255,0.18)"/>`,
        tasks: [
            { key: '厨房水池',       fm: 'hw_kitchen', fmVals: ['厨房水池'],       label: '🍽️ 厨房水池' },
            { key: '整理/厨房台面', fm: 'hw_kitchen', fmVals: ['整理/厨房台面'], label: '🧹 厨房台面' },
            { key: '整理/冷藏',     fm: 'hw_kitchen', fmVals: ['整理/冷藏'],     label: '🥬 冷藏'     },
            { key: '整理/冷冻',     fm: 'hw_kitchen', fmVals: ['整理/冷冻'],     label: '🧊 冷冻'     },
            { key: '微波炉',        fm: 'hw_kitchen', fmVals: ['微波炉'],         label: '📡 微波炉'   },
            { key: '灶台',          fm: 'hw_kitchen', fmVals: ['灶台'],           label: '🔥 灶台'     },
        ]
    },
    {
        room: '更换', color: '#fb923c', gradLight: '#ffedd5', gradDark: '#c2410c',
        icon: `<path d="M13.5 3.5Q10.5 1 7 2.5Q4 4 3.5 7.5M3.5 7.5L2 5.5M3.5 7.5L5.5 6.5"
                     stroke="white" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
               <path d="M2.5 12.5Q5.5 15 9 13.5Q12 12 12.5 8.5M12.5 8.5L14 10.5M12.5 8.5L10.5 9.5"
                     stroke="white" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
        tasks: [
            { key: '替换/猫砂盆liner',     fm: 'hw_renew', fmVals: ['替换/猫砂盆liner'],     label: '🐱 猫砂盆'  },
            { key: '替换/空调滤网',         fm: 'hw_renew', fmVals: ['替换/空调滤网'],         label: '❄️ 空调滤网' },
            { key: '替换/空气净化器filter', fm: 'hw_renew', fmVals: ['替换/空气净化器filter'], label: '💨 净化器'   },
        ]
    },
];

// Recommended repeat interval (days) per task — drives next-due indicators
const INTERVALS = {
    '吸尘': 7,  '拖地': 21,
    '换床单': 30, '换被套': 30,
    '洗衣服': 7,
    '整理/叠衣服/上衣': 14, '整理/叠衣服/下装': 14, '整理/叠衣服/毛巾床品': 14,
    '整理/卖Mercari': 90,
    '刷马桶': 21, '洗手台': 45, '浴室地面': 90, '替换/牙刷刷头': 90,
    '厨房水池': 45, '整理/厨房台面': 30, '整理/冷藏': 90, '整理/冷冻': 180,
    '微波炉': 90, '灶台': 90,
    '替换/猫砂盆liner': 90, '替换/空调滤网': 90, '替换/空气净化器filter': 180
};

// ──────────────────── DATE HELPERS ──────────────────
const getMonday = d => {
    const r = new Date(d); r.setHours(0,0,0,0);
    const day = r.getDay();
    r.setDate(r.getDate() - (day === 0 ? 6 : day - 1));
    return r;
};
const toWk = d => {
    const m = getMonday(d);
    return `${m.getFullYear()}-${String(m.getMonth()+1).padStart(2,'0')}-${String(m.getDate()).padStart(2,'0')}`;
};
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const fmtDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const parseLocalDate = s => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s ?? ''));
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(s);
};
const daysBetween = (from, to) => {
    const a = new Date(from); a.setHours(0,0,0,0);
    const b = new Date(to);   b.setHours(0,0,0,0);
    return Math.round((b - a) / 86400000);
};
const fieldValues = vals => {
    if (!vals) return [];
    if (Array.isArray(vals)) return vals;
    if (typeof vals.array === 'function') return vals.array();
    return [vals];
};

// ──────────────────── BUILD WEEK LIST (full year) ───
const today   = new Date();
const todayWk = toWk(today);

const noteName = dv.current()?.file?.name ?? '';
const yr = /^\d{4}$/.test(noteName) ? parseInt(noteName) : today.getFullYear();

const jan1  = new Date(yr, 0, 1);
const dec31 = new Date(yr, 11, 31);

const weeks = [];
let cur = getMonday(jan1); // may start in Dec of previous year — intentional
while (cur <= dec31) {
    weeks.push({ key: toWk(cur), mon: new Date(cur), sun: addDays(cur, 6) });
    cur = addDays(cur, 7);
}
const WEEKS = weeks.length;

// ──────────────────── SCAN NOTES ────────────────────
const allTasks = GROUPS.flatMap(g => g.tasks);
const done = {};
const lastDoneDate = {};
for (const t of allTasks) { done[t.key] = new Set(); lastDoneDate[t.key] = null; }

const farBack   = addDays(today, -185);
const scanFrom  = addDays(weeks[0].mon, -1);
const scanStart = farBack < scanFrom ? farBack : scanFrom;

let pages = [];
for (const y of [yr, yr - 1]) {
    try { pages = pages.concat([...dv.pages(`"日记/${y}"`)]); } catch(e) {}
}

for (const page of pages) {
    try {
        const fn = page?.file?.name;
        if (!fn) continue;
        const pd = parseLocalDate(fn);
        if (isNaN(pd.getTime()) || pd < scanStart || pd > today) continue;
        for (const task of allTasks) {
            const vals = fieldValues(page[task.fm]);
            if (!vals.some(v => task.fmVals.includes(v))) continue;
            if (!lastDoneDate[task.key] || pd > lastDoneDate[task.key]) {
                lastDoneDate[task.key] = new Date(pd);
            }
            if (pd >= scanFrom) done[task.key].add(toWk(pd));
        }
    } catch(e) {}
}

// ──────────────────── COMPUTE NEXT DUE ─────────────
const nextDue = {};
for (const task of allTasks) {
    const interval = INTERVALS[task.key];
    if (!interval) continue;
    const last      = lastDoneDate[task.key];
    const neverDone = !last;
    const nextDate  = neverDone ? today : addDays(last, interval);
    const isOverdue = nextDate <= today;
    nextDue[task.key] = {
        wk:          toWk(nextDate),
        lastDate:     last ? fmtDate(last) : null,
        nextDate:     fmtDate(nextDate),
        isOverdue,
        daysOverdue: isOverdue ? daysBetween(nextDate, today) : 0,
        daysUntil:   !isOverdue ? daysBetween(today, nextDate) : 0,
        neverDone
    };
}

// ──────────────────── LAYOUT ────────────────────────
let yPos = TOP_PAD;
const rows = [];
const bands = [];

for (const group of GROUPS) {
    const bandY = yPos;
    for (const task of group.tasks) {
        rows.push({ y: yPos, task, group });
        yPos += STEP;
    }
    bands.push({ group, y: bandY, h: group.tasks.length * STEP - GAP });
    yPos += GRP_GAP;
}
yPos -= GRP_GAP;

const SVG_H = yPos + 8;
const GRID_W = WEEKS * STEP - GAP + 30;

const pfx = 'hw' + Math.random().toString(36).slice(2, 7);

// Pre-compute month ranges & current week index
const monthRanges = [];
for (let wi = 0; wi < weeks.length; wi++) {
    const m = weeks[wi].mon.getMonth();
    if (!monthRanges.length || monthRanges[monthRanges.length - 1].m !== m) {
        monthRanges.push({ m, firstWi: wi, lastWi: wi });
    } else {
        monthRanges[monthRanges.length - 1].lastWi = wi;
    }
}
const cwi = weeks.findIndex(w => w.key === todayWk);

// ──────────────────── RENDER LABELS SVG ────────────
const lp = [];
lp.push(`<svg viewBox="0 0 ${LABEL_W} ${SVG_H}" width="${LABEL_W}" height="${SVG_H}" xmlns="http://www.w3.org/2000/svg" style="font-family:var(--font-text);display:block;">`);
lp.push(`<defs>`);
GROUPS.forEach((g, i) => {
    lp.push(`<linearGradient id="${pfx}L${i}" x1="0.2" y1="0" x2="0.8" y2="1">
        <stop offset="0%" stop-color="${g.gradLight}"/>
        <stop offset="100%" stop-color="${g.gradDark}"/>
    </linearGradient>`);
});
lp.push(`</defs>`);

GROUPS.forEach((group, gi) => {
    const { y, h } = bands[gi];
    lp.push(`<rect x="1" y="${y - 1}" width="${ICON_W}" height="${h + 2}" rx="5" fill="url(#${pfx}L${gi})" style="filter:drop-shadow(0 2px 5px rgba(0,0,0,0.35))"/>`);
    lp.push(`<rect x="2.5" y="${y}" width="${ICON_W - 3}" height="7" rx="3.5" fill="rgba(255,255,255,0.28)"/>`);
    const iconCY = y + Math.round(h / 2);
    const iSize = ICON_W - 8;
    const iScale = (iSize / 16).toFixed(3);
    const iLeft = 1 + 4;
    const iTop = iconCY - iSize / 2;
    lp.push(`<g transform="translate(${iLeft},${iTop}) scale(${iScale})">${group.icon}</g>`);
    lp.push(`<text x="${1 + ICON_W + 7}" y="${iconCY + 5}" font-size="13" fill="${group.color}" font-weight="600">${group.room}</text>`);
});

for (const { y, task, group } of rows) {
    const ndi = nextDue[task.key];
    const labelOverdue = ndi?.isOverdue && !done[task.key].has(todayWk);
    const redX = 1 + ICON_W + 7 + group.room.length * 13 + 6;
    if (labelOverdue) {
        lp.push(`<rect x="${redX}" y="${y}" width="${LABEL_W - redX - 6}" height="${CELL}" fill="rgba(239,68,68,0.18)" rx="3"/>`);
    }
    const labelX = labelOverdue ? (redX + LABEL_W - 6) / 2 : LABEL_W - 6;
    const labelAnchor = labelOverdue ? 'middle' : 'end';
    lp.push(`<text x="${labelX}" y="${y + CELL - 3}" font-size="11" fill="var(--text-muted)" text-anchor="${labelAnchor}">${task.label}</text>`);
}
lp.push(`</svg>`);

// ──────────────────── RENDER GRID SVG ──────────────
const gp = [];
gp.push(`<svg viewBox="0 0 ${GRID_W} ${SVG_H}" width="${GRID_W}" height="${SVG_H}" xmlns="http://www.w3.org/2000/svg" style="font-family:var(--font-text);display:block;">`);

for (let i = 1; i < monthRanges.length; i++) {
    const x = monthRanges[i].firstWi * STEP - 2;
    gp.push(`<line x1="${x}" y1="15" x2="${x}" y2="${SVG_H - 4}" stroke="var(--background-modifier-border)" stroke-width="1" opacity="0.6"/>`);
}

for (const { m, firstWi, lastWi } of monthRanges) {
    const x1 = firstWi * STEP;
    const x2 = lastWi * STEP + CELL;
    gp.push(`<text x="${(x1 + x2) / 2}" y="13" font-size="10" fill="var(--text-muted)" font-weight="500" text-anchor="middle">${MONTH_NAMES[m]}</text>`);
}

gp.push(`<line x1="0" y1="${TOP_PAD - 5}" x2="${GRID_W - 6}" y2="${TOP_PAD - 5}" stroke="var(--background-modifier-border)" stroke-width="0.8"/>`);

if (cwi >= 0) {
    const cx = cwi * STEP;
    gp.push(`<rect x="${cx}" y="${TOP_PAD - 5}" width="${CELL}" height="${SVG_H - TOP_PAD + 5}" fill="rgba(255,255,255,0.04)" rx="1"/>`);
    gp.push(`<text x="${cx + CELL/2}" y="${TOP_PAD - 8}" font-size="8" fill="var(--text-muted)" text-anchor="middle">今</text>`);
}

for (const { y, task, group } of rows) {
    const ndi = nextDue[task.key];
    for (let wi = 0; wi < weeks.length; wi++) {
        const { key, mon, sun } = weeks[wi];
        const x         = wi * STEP;
        const isDone    = done[task.key].has(key);
        const isCurrent = key === todayWk;
        const isFuture  = mon > today;

        const isOverdueCell   = ndi?.isOverdue  && isCurrent && !isDone;
        const isDueThisWeek   = ndi && !ndi.isOverdue && key === ndi.wk && isCurrent;
        const isUpcomingCell  = ndi && !ndi.isOverdue && key === ndi.wk && !isCurrent;

        const CURRENT_WK_STROKE = '#6b7280';
        let fill, stroke, sw, dash;
        if (isDone) {
            fill = group.color;                       stroke = 'none';                              sw = 0;   dash = '';
        } else if (isOverdueCell) {
            fill = 'rgba(239,68,68,0.20)';            stroke = '#ef4444';                           sw = 1.5; dash = '';
        } else if (isDueThisWeek) {
            fill = group.color + '28';                stroke = group.color;                         sw = 1.5; dash = '';
        } else if (isUpcomingCell) {
            fill = group.color + '28';                stroke = group.color;                         sw = 1.5; dash = 'stroke-dasharray="3 2"';
        } else if (isCurrent) {
            fill = 'var(--background-secondary)';     stroke = CURRENT_WK_STROKE;                   sw = 1.5; dash = '';
        } else if (isFuture) {
            fill = 'none';                            stroke = 'var(--background-modifier-border)'; sw = 0.8; dash = '';
        } else {
            fill = 'var(--background-secondary)';     stroke = 'none';                              sw = 0;   dash = '';
        }

        let tip;
        if (isDone)              tip = ndi?.lastDate ? `✅ 完成；上次 ${ndi.lastDate}；下次预计 ${ndi.nextDate}` : '✅ 完成';
        else if (isOverdueCell)  tip = ndi.neverDone ? '⚠️ 从未记录' : `⚠️ 逾期 ${ndi.daysOverdue} 天；上次 ${ndi.lastDate}；应在 ${ndi.nextDate}`;
        else if (isDueThisWeek)  tip = `📅 本周预计 ${ndi.nextDate} (+${ndi.daysUntil} 天)；上次 ${ndi.lastDate}`;
        else if (isUpcomingCell) tip = `📅 预计 ${ndi.nextDate} (+${ndi.daysUntil} 天)；上次 ${ndi.lastDate}`;
        else if (isFuture)       tip = '—';
        else                     tip = ndi?.lastDate ? `○ 未完成；上次 ${ndi.lastDate}；下次预计 ${ndi.nextDate}` : '○ 未完成';

        gp.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${dash}>`);
        gp.push(`<title>${task.label}  ${mon.getMonth()+1}/${mon.getDate()}–${sun.getMonth()+1}/${sun.getDate()}\n${tip}</title>`);
        gp.push(`</rect>`);

        if (isDone) {
            gp.push(`<circle cx="${x + CELL/2}" cy="${y + CELL/2}" r="2.5" fill="rgba(255,255,255,0.45)" pointer-events="none"/>`);
        } else if (isOverdueCell) {
            const label  = ndi.neverDone ? '∞' : ndi.daysOverdue >= 100 ? `${Math.floor(ndi.daysOverdue/30)}m` : `${ndi.daysOverdue}`;
            const fsize  = ndi.neverDone ? 20 : 10;
            gp.push(`<text x="${x + CELL/2}" y="${y + CELL/2}" font-size="${fsize}" font-weight="700" fill="#ef4444" text-anchor="middle" dominant-baseline="central" pointer-events="none">${label}</text>`);
        }
    }
}
gp.push(`</svg>`);

// ──────────────────── BUILD DOM ────────────────────
const wrapper = dv.container.createEl('div');

const bar = wrapper.createEl('div');
bar.style.cssText = 'display:flex;gap:5px;margin-bottom:8px;flex-wrap:wrap;align-items:center;';

const btnStyle = `padding:2px 10px;border-radius:4px;border:1px solid var(--background-modifier-border);
    background:var(--background-secondary);color:var(--text-muted);cursor:pointer;font-size:11px;line-height:1.6;`;
const btnActiveStyle = `padding:2px 10px;border-radius:4px;border:1px solid var(--interactive-accent);
    background:var(--interactive-accent);color:white;cursor:pointer;font-size:11px;line-height:1.6;`;

const allBtns = [];
const mkBtn = (label, fn) => {
    const b = bar.createEl('button');
    b.textContent = label;
    b.style.cssText = btnStyle;
    b.addEventListener('click', () => {
        allBtns.forEach(x => x.style.cssText = btnStyle);
        b.style.cssText = btnActiveStyle;
        fn();
    });
    allBtns.push(b);
    return b;
};

const scrollBox = wrapper.createEl('div');
scrollBox.style.cssText = 'overflow:auto;max-height:600px;border-radius:6px;';

const flexRow = scrollBox.createEl('div');
flexRow.style.cssText = 'display:flex;width:fit-content;align-items:flex-start;';

const labelPanel = flexRow.createEl('div');
labelPanel.style.cssText = 'position:sticky;left:0;z-index:2;flex-shrink:0;background:var(--background-primary);';
labelPanel.innerHTML = lp.join('');

const gridPanel = flexRow.createEl('div');
gridPanel.innerHTML = gp.join('');

const gridSvg = gridPanel.querySelector('svg');
const labelSvg = labelPanel.querySelector('svg');

let zoomLevel = 1;
const applyZoom = (z, scrollTargetX) => {
    zoomLevel = Math.max(0.5, Math.min(4, z));
    const gw = GRID_W * zoomLevel;
    const gh = SVG_H * zoomLevel;
    gridSvg.setAttribute('width', gw);
    gridSvg.setAttribute('height', gh);
    labelSvg.setAttribute('width', LABEL_W * zoomLevel);
    labelSvg.setAttribute('height', gh);
    if (scrollTargetX !== undefined) {
        scrollBox.scrollLeft = scrollTargetX * zoomLevel;
    }
};

mkBtn('−', () => {
    const cx = scrollBox.scrollLeft + scrollBox.clientWidth / 2;
    const ratio = cx / (GRID_W * zoomLevel);
    applyZoom(zoomLevel * 0.75);
    scrollBox.scrollLeft = ratio * GRID_W * zoomLevel - scrollBox.clientWidth / 2;
});
mkBtn('+', () => {
    const cx = scrollBox.scrollLeft + scrollBox.clientWidth / 2;
    const ratio = cx / (GRID_W * zoomLevel);
    applyZoom(zoomLevel * 1.33);
    scrollBox.scrollLeft = ratio * GRID_W * zoomLevel - scrollBox.clientWidth / 2;
});

const sep = bar.createEl('span');
sep.style.cssText = 'width:1px;height:16px;background:var(--background-modifier-border);margin:0 2px;';

const zoomToRecent = () => {
    const ago60 = addDays(today, -60);
    const si = Math.max(0, weeks.findIndex(w => w.mon >= ago60));
    const ei = Math.min(WEEKS, cwi + 4);
    const cw = (scrollBox.clientWidth || 600) - LABEL_W * zoomLevel;
    const rw = (ei - si) * STEP + 20;
    const z = Math.max(0.5, Math.min(1.2, cw / rw));
    applyZoom(z, si * STEP);
};
const recentBtn = mkBtn('近期', zoomToRecent);

mkBtn('近3月', () => {
    const ago = addDays(today, -90);
    const startIdx = Math.max(0, weeks.findIndex(w => w.mon >= ago));
    const containerW = (scrollBox.clientWidth || 600) - LABEL_W * zoomLevel;
    const rangeW = (WEEKS - startIdx) * STEP + 20;
    const z = Math.max(0.5, Math.min(4, containerW / rangeW));
    applyZoom(z, startIdx * STEP);
});

const quarters = [['Q1',0,13],['Q2',13,26],['Q3',26,39],['Q4',39,WEEKS]];
for (const [label, s, e] of quarters) {
    mkBtn(label, () => {
        const containerW = (scrollBox.clientWidth || 600) - LABEL_W * zoomLevel;
        const rangeW = (e - s) * STEP;
        const z = Math.max(0.5, Math.min(4, containerW / rangeW));
        applyZoom(z, s * STEP);
    });
}

mkBtn('全年', () => applyZoom(1, 0));

scrollBox.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const rect = scrollBox.getBoundingClientRect();
    const labelW = LABEL_W * zoomLevel;
    const mouseGridX = e.clientX - rect.left - labelW + scrollBox.scrollLeft;
    const ratio = mouseGridX / (GRID_W * zoomLevel);
    const factor = e.deltaY > 0 ? 0.85 : 1.18;
    const newZoom = Math.max(0.5, Math.min(4, zoomLevel * factor));
    applyZoom(newZoom);
    scrollBox.scrollLeft = ratio * GRID_W * zoomLevel - (e.clientX - rect.left - LABEL_W * zoomLevel);
}, { passive: false });

requestAnimationFrame(() => {
    zoomToRecent();
    recentBtn.style.cssText = btnActiveStyle;
});

})();
```
