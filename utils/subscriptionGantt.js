/* subscriptionGantt.js — shared dv.view widget for 订阅花费 / 兴趣班花费 Gantt charts.
 * Lives in Helper/utils/ (canonical source; notes carry inline copies).
 *
 * Call from a dataviewjs block:
 *   await dv.view("Helper/utils/subscriptionGantt", { include: "#订阅", exclude: "#订阅/兴趣班" })
 *   await dv.view("Helper/utils/subscriptionGantt", { include: "#订阅/兴趣班", barScale: 0.08 })
 *
 * input: include (tag to gather), exclude (optional nested tag to drop).
 * Source of truth = [$] tasks: 🛫 start (req) · 🛬 end (absent = ongoing → projected forward)
 *   · 💵 price · 💳 包月(monthly rate)|包年(annual total, amortized).
 * Bar height ∝ monthly rate (no cap) → area = total period spend. Color by status.
 * Controls: ◀ / 今天 / ▶ pan, [12月] / [10天] zoom. Monthly-sum chart shown when window ≥ ~2mo.
 */
const includeTag = input?.include ?? "#订阅";
const excludeTag = input?.exclude ?? null;

const dayMs = 864e5;
const noon = d => { d.setHours(12, 0, 0, 0); return d.getTime(); };
const todayTs = noon(new Date());
const toTs = s => { if (!s) return null; const d = new Date(s + "T12:00:00"); return Number.isNaN(d.getTime()) ? null : d.getTime(); };
const field = (t, re) => { const m = t.match(re); return m ? m[1] : null; };
const parsePrice = t => { const m = t.match(/💵\s*\$?\s*([\d.,]+)/); return m ? parseFloat(m[1].replace(/,/g, "")) : 0; };
const fmtMD = ts => { const d = new Date(ts); return `${d.getMonth() + 1}/${d.getDate()}`; };

const statusConfig = {
    "🟢": { color: "#4ade80", label: "进行中" },
    "🟠": { color: "#fbbf24", label: "即将到期" },
    "⚫": { color: "#1a1a1a", label: "已过期" },
    "⚪": { color: "#9ca3af", label: "未开始" }
};

const records = [];
let skipped = 0;
for (const p of dv.pages(includeTag)) {
    if (excludeTag && (p.file.tags ?? []).includes(excludeTag)) continue;
    for (const t of (p.file.tasks ?? [])) {
        if (t.status !== "$") continue;
        const txt = t.text || "";
        const start = field(txt, /🛫\s*(\d{4}-\d{2}-\d{2})/);
        if (!start) { skipped++; continue; }
        const end = field(txt, /🛬\s*(\d{4}-\d{2}-\d{2})/);
        const cycle = field(txt, /💳\s*(包年|包月|一次性)/) || "包月";
        records.push({ note: p.file.name, startTs: toTs(start), endTs: end ? toTs(end) : null, cycle, price: parsePrice(txt) });
    }
}

const spanDaysOf = r => r.endTs && r.startTs ? Math.max(1, (r.endTs - r.startTs) / dayMs) : 1;
const monthlyCost = r => r.cycle === "一次性" ? r.price / spanDaysOf(r) * 30.44 : r.cycle === "包年" ? r.price / 12 : r.price;
const dailyRate = r => r.cycle === "一次性" ? r.price / spanDaysOf(r) : r.cycle === "包年" ? r.price / 365.25 : r.price * 12 / 365.25;
const priceLabel = r => r.price ? (r.cycle === "一次性" ? `$${r.price}` : `$${r.price}/${r.cycle === "包年" ? "年" : "月"}`) : "";
const FAR = todayTs + 6 * 365 * dayMs;
const effEnd = r => r.endTs ?? FAR;
function statusOf(r) {
    if (r.startTs > todayTs) return "⚪";
    if (r.endTs == null) return "🟢";
    if (r.endTs < todayTs) return "⚫";
    return (r.endTs - todayTs) / dayMs <= 30 ? "🟠" : "🟢";
}
for (const r of records) r.status = statusOf(r);

const root = dv.el("div", "");
const labelWidth = 120;
let spanDays = 365;
let anchorEnd = todayTs + Math.round(spanDays / 2) * dayMs;

const mkBtn = (act, label, active) =>
    `<button data-act="${act}" style="font-size:11px; padding:2px 9px; border-radius:6px; cursor:pointer; border:1px solid var(--background-modifier-border); background:${active ? "var(--interactive-accent)" : "var(--background-secondary)"}; color:${active ? "var(--text-on-accent)" : "var(--text-normal)"};">${label}</button>`;

function render() {
    const windowEnd = anchorEnd;
    const windowStart = anchorEnd - spanDays * dayMs;
    const totalMs = windowEnd - windowStart;
    const showMonthly = spanDays >= 60;
    const xOf = ts => (Math.max(windowStart, Math.min(windowEnd, ts)) - windowStart) / totalMs * 100;

    const inWin = [];
    for (const r of records) {
        const rEnd = effEnd(r);
        if (rEnd < windowStart || r.startTs > windowEnd) continue;
        inWin.push({ ...r, xStart: xOf(r.startTs), xEnd: xOf(rEnd) });
    }

    let html = `<div style="font-family: var(--font-interface); padding: 6px 10px 10px 0;">`;
    html += `<div style="display:flex; align-items:center; gap:6px; margin-bottom:10px;">`;
    html += mkBtn("back", "◀");
    html += mkBtn("today", "今天");
    html += mkBtn("fwd", "▶");
    html += `<span style="width:6px;"></span>`;
    html += mkBtn("z12", "12月", spanDays === 365);
    html += mkBtn("z10", "10天", spanDays === 10);
    html += `<span style="margin-left:auto; font-size:10px; color:var(--text-muted);">${fmtMD(windowStart)} – ${fmtMD(windowEnd)}</span>`;
    html += `</div>`;

    if (inWin.length === 0) {
        html += `<div style="color:var(--text-muted); font-size:12px;">此时间窗口内无订阅记录。</div></div>`;
        root.innerHTML = html; attach(); return;
    }

    inWin.sort((a, b) => a.startTs - b.startTs);
    const noteOrder = [];
    const byNote = new Map();
    for (const r of inWin) {
        if (!byNote.has(r.note)) { byNote.set(r.note, []); noteOrder.push(r.note); }
        byNote.get(r.note).push(r);
    }
    for (const rows of byNote.values()) {
        const laneEnds = [];
        for (const r of rows) {
            const rEnd = effEnd(r);
            let placed = false;
            for (let i = 0; i < laneEnds.length; i++) {
                if (r.startTs >= laneEnds[i]) { r.lane = i; laneEnds[i] = rEnd; placed = true; break; }
            }
            if (!placed) { r.lane = laneEnds.length; laneEnds.push(rEnd); }
        }
    }
    const barScale = input?.barScale ?? 0.6;          // 兴趣班花费-Gantt passes 0.08 (smaller bars)
const barHpx = r => Math.max(3, monthlyCost(r) * barScale);
    const laneGap = 1;
    const maxMonthly = Math.max(...inWin.map(monthlyCost), 1);
    const todayPct = (todayTs >= windowStart && todayTs <= windowEnd) ? xOf(todayTs) : null;

    const months = [];
    let cm = new Date(windowStart); cm.setDate(1); cm.setHours(12, 0, 0, 0);
    if (cm.getTime() < windowStart) { cm.setMonth(cm.getMonth() + 1); }
    while (cm.getTime() <= windowEnd) {
        const next = new Date(cm); next.setMonth(next.getMonth() + 1);
        months.push({ startTs: cm.getTime(), endTs: next.getTime(), label: `${cm.getMonth() + 1}月`, pct: xOf(cm.getTime()) });
        cm = next;
    }
    const dayTicks = [];
    if (!showMonthly) {
        let dt = new Date(windowStart); dt.setHours(12, 0, 0, 0);
        while (dt.getTime() <= windowEnd) { dayTicks.push({ pct: xOf(dt.getTime()), label: `${dt.getMonth() + 1}/${dt.getDate()}` }); dt.setDate(dt.getDate() + 1); }
    }
    const ticks = showMonthly ? months : dayTicks;

    html += `<div style="display:flex; margin-bottom:6px;">`;
    html += `<div style="width:${labelWidth}px; flex-shrink:0;"></div>`;
    html += `<div style="flex:1; position:relative; height:20px; border-bottom:1px solid var(--background-modifier-border);">`;
    for (const t of ticks) html += `<span style="position:absolute; left:${t.pct}%; font-size:10px; color:var(--text-muted); transform:translateX(-50%);">${t.label}</span>`;
    if (todayPct != null) html += `<span style="position:absolute; left:${todayPct}%; font-size:9px; color:var(--color-red); transform:translateX(-50%); font-weight:600;">今天</span>`;
    html += `</div></div>`;

    html += `<div style="position:relative;">`;
    if (todayPct != null) html += `<div style="position:absolute; top:0; bottom:0; left:calc(${labelWidth}px + (100% - ${labelWidth}px) * ${todayPct} / 100); width:2px; background:#ef4444; opacity:0.7; z-index:5; pointer-events:none;"></div>`;
    for (const note of noteOrder) {
        const row = byNote.get(note);
        const laneCount = Math.max(...row.map(r => r.lane)) + 1;
        const laneHs = Array.from({length: laneCount}, (_, i) => Math.max(...row.filter(r => r.lane === i).map(barHpx)));
        const rowH = laneHs.reduce((s, h) => s + h, 0) + (laneCount - 1) * laneGap;
        const laneTop = laneHs.map((_, i) => laneHs.slice(0, i).reduce((s, h) => s + h + laneGap, 0));
        html += `<div style="display:flex; align-items:center; margin-bottom:2px;">`;
        html += `<div style="width:${labelWidth}px; flex-shrink:0; font-size:11px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding-right:8px;"><a class="internal-link" href="${note}" data-href="${note}" title="${note}" style="text-decoration:none;">${note}</a></div>`;
        html += `<div style="flex:1; position:relative; height:${rowH}px;">`;
        for (const t of ticks) html += `<div style="position:absolute; left:${t.pct}%; top:0; bottom:0; width:1px; background:var(--background-modifier-border); opacity:0.45; pointer-events:none;"></div>`;
        for (const r of row) {
            const bh = barHpx(r);
            const topOffset = laneTop[r.lane] + (laneHs[r.lane] - bh) / 2;
            const scale = monthlyCost(r) / maxMonthly;
            const fontSize = 9 + 4 * scale;
            const barW = r.xEnd - r.xStart;
            const color = statusConfig[r.status].color;
            const border = r.status === "⚫" ? `inset 0 0 0 1px rgba(255,255,255,0.35)` : `inset 0 0 0 1px rgba(255,255,255,0.3), 0 1px 3px rgba(0,0,0,0.18)`;
            const lbl = priceLabel(r);
            html += `<div title="${r.note} · ${r.cycle} · ${lbl || "$0"}" style="position:absolute; left:${r.xStart}%; width:${barW}%; top:${topOffset}px; height:${bh}px; background:${color}; opacity:0.88; border-radius:4px; display:flex; align-items:center; justify-content:center; z-index:2; box-shadow:${border}; overflow:hidden;">`;
            if (lbl && barW > 4) html += `<span style="font-size:${fontSize}px; color:#fff; font-weight:600; text-shadow:0 1px 3px rgba(0,0,0,0.6); white-space:nowrap;">${lbl}</span>`;
            html += `</div>`;
        }
        html += `</div></div>`;
    }
    html += `</div>`;

    if (showMonthly) {
        for (const m of months) m.spend = 0;
        for (const r of inWin) {
            const monthly = monthlyCost(r);                 // 包月 flat rate / 包年 = price/12; NOT day-prorated
            for (const m of months) {
                if (r.startTs < m.endTs && effEnd(r) > m.startTs) m.spend += monthly; // active any day this month -> full month
            }
        }
        const maxSpend = Math.max(1, ...months.map(m => m.spend));
        const yMax = Math.max(50, Math.ceil(maxSpend / 50) * 50);
        const barChartHeight = 80, yTicks = 4, yStep = yMax / yTicks;
        html += `<div style="display:flex; margin-top:16px;">`;
        html += `<div style="width:${labelWidth}px; flex-shrink:0; font-size:9px; color:var(--text-muted); position:relative;">`;
        for (let i = 0; i <= yTicks; i++) { const v = yStep * i, yPct = 100 - v / yMax * 100; html += `<span style="position:absolute; right:8px; top:${yPct}%; transform:translateY(-50%);">$${v.toFixed(0)}</span>`; }
        html += `</div>`;
        html += `<div style="flex:1; position:relative; height:${barChartHeight}px; border-bottom:1px solid var(--background-modifier-border); border-left:1px solid var(--background-modifier-border);">`;
        for (let i = 1; i <= yTicks; i++) { const yPct = 100 - yStep * i / yMax * 100; html += `<div style="position:absolute; left:0; right:0; top:${yPct}%; height:1px; background:var(--background-modifier-border); opacity:0.3;"></div>`; }
        for (const m of months) html += `<div style="position:absolute; left:${m.pct}%; top:0; bottom:0; width:1px; background:var(--background-modifier-border); opacity:0.5;"></div>`;
        if (todayPct != null) html += `<div style="position:absolute; left:${todayPct}%; top:0; bottom:0; width:2px; background:#ef4444; opacity:0.7; z-index:2;"></div>`;
        for (let i = 0; i < months.length; i++) {
            const m = months[i];
            const xEnd = i + 1 < months.length ? months[i + 1].pct : xOf(windowEnd);
            const w = (xEnd - m.pct) * 0.86, off = (xEnd - m.pct) * 0.07;
            const bh = Math.min(100, m.spend / yMax * 100);
            html += `<div style="position:absolute; left:${m.pct + off}%; width:${w}%; bottom:0; height:${bh}%; background:linear-gradient(to top, rgba(147,197,253,0.4), rgba(191,219,254,0.25)); border:1px solid rgba(147,197,253,0.5); border-bottom:none; box-sizing:border-box; display:flex; align-items:flex-start; justify-content:center; padding-top:2px;">`;
            if (m.spend > 0 && bh > 14) html += `<span style="font-size:9px; color:var(--text-muted); font-weight:500;">$${m.spend.toFixed(0)}</span>`;
            html += `</div>`;
        }
        html += `</div></div>`;
        html += `<div style="display:flex;"><div style="width:${labelWidth}px; flex-shrink:0;"></div><div style="flex:1; position:relative; height:18px;">`;
        for (const m of months) html += `<span style="position:absolute; left:${m.pct}%; font-size:9px; color:var(--text-muted); transform:translateX(-50%);">${m.label}</span>`;
        html += `</div></div>`;
    }

    html += `<div style="display:flex; flex-wrap:wrap; gap:12px; margin-top:14px; padding-top:10px; border-top:1px solid var(--background-modifier-border); font-size:11px;">`;
    for (const [emoji, cfg] of Object.entries(statusConfig)) html += `<div style="display:flex; align-items:center; gap:4px;"><div style="width:12px; height:12px; background:${cfg.color}; opacity:0.88; border-radius:2px;"></div>${emoji} ${cfg.label}</div>`;
    html += `<div style="display:flex; align-items:center; gap:4px;"><div style="width:2px; height:12px; background:#ef4444; opacity:0.7;"></div>今天</div>`;
    if (showMonthly) html += `<div style="display:flex; align-items:center; gap:4px;"><div style="width:12px; height:12px; background:linear-gradient(to top, rgba(147,197,253,0.4), rgba(191,219,254,0.25)); border:1px solid rgba(147,197,253,0.5); border-radius:2px;"></div>月度总额</div>`;
    html += `<div style="color:var(--text-muted); margin-left:8px;">｜条形面积 = 期间总花费${skipped ? `｜${skipped} 条缺 🛫 被跳过` : ""}</div>`;
    html += `</div></div>`;

    root.innerHTML = html;
    attach();
}

function attach() {
    const srcPath = dv.current()?.file?.path ?? "";
    root.querySelectorAll("a.internal-link").forEach(a => {
        a.addEventListener("click", evt => { evt.preventDefault(); app.workspace.openLinkText(a.dataset.href, srcPath, evt.ctrlKey || evt.metaKey); });
    });
    root.querySelectorAll("button[data-act]").forEach(b => {
        b.addEventListener("click", () => {
            const step = Math.max(1, Math.round(spanDays / 2)) * dayMs;
            switch (b.dataset.act) {
                case "back": anchorEnd -= step; break;
                case "fwd": anchorEnd += step; break;
                case "today": anchorEnd = todayTs + Math.round(spanDays / 2) * dayMs; break;
                case "z12": spanDays = 365; anchorEnd = todayTs + Math.round(365 / 2) * dayMs; break;
                case "z10": spanDays = 10; anchorEnd = todayTs + 5 * dayMs; break;
            }
            render();
        });
    });
}

render();
