---
modified_at: 2026-06-25
---
```dataviewjs
const active = app.workspace.getActiveFile();
const p = active ? dv.page(active.path) : dv.current();
const startStr = String(p["开始日期（周日）"]).slice(0, 10);
const start = window.moment(startStr, "YYYY-MM-DD");

const GOAL = 3;
const WEEKDAYS = ["周一", "周二", "周三", "周四", "周五"];

const holidayDates = new Map();
try {
  const raw = await app.vault.adapter.read(".obsidian/plugins/yearly-glance/data.json");
  const yg = JSON.parse(raw);
  for (const h of (yg.data?.holidays ?? [])) {
    for (const d of (h.dateArr ?? [])) holidayDates.set(d, h.text);
  }
} catch (e) {}

let officeCount = 0;
let leaveCount = 0;
const dayStatuses = [];

for (let i = 1; i <= 5; i++) {
  const d = start.clone().day(i);
  const dateStr = d.format("YYYY-MM-DD");
  const page = dv.page(`日记/${d.format("YYYY")}/${dateStr}`);

  let status = "—";
  const inOffice = page && (page["办公室"] === true || page["办公室"] === "true");

  if (inOffice) {
    status = "🏢";
    officeCount++;
  } else if (holidayDates.has(dateStr)) {
    status = "🎉";
    leaveCount++;
  } else if (page) {
    const leave = page["假期"];
    const hasLeave = Array.isArray(leave) ? leave.length > 0
      : (leave != null && leave !== "" && leave !== false);
    if (hasLeave) {
      const label = Array.isArray(leave) ? leave[0] : String(leave);
      if (label.includes("PTO")) status = "🏖️";
      else if (label.includes("病假")) status = "🤒";
      else status = "📅";
      leaveCount++;
    }
  }
  dayStatuses.push({ day: WEEKDAYS[i - 1], date: dateStr, status, holiday: holidayDates.get(dateStr) });
}

const credited = officeCount + leaveCount;
const met = credited >= GOAL;
const remaining = Math.max(0, GOAL - credited);

const logged = dayStatuses.filter(d => d.status !== "—");
const lights = [];
for (let i = 0; i < GOAL; i++) {
  if (i < logged.length) {
    lights.push(`<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:#4caf50;box-shadow:0 0 6px rgba(76,175,80,.5);margin:0 3px;font-size:16px;font-weight:bold;color:#fff;">✓</span>`);
  } else {
    lights.push(`<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:var(--background-modifier-border);margin:0 3px;font-size:14px;color:var(--text-muted);">✗</span>`);
  }
}

const label = met ? "✅" : `还差 ${remaining} 天`;
const detail = logged.map(d => {
  const extra = d.holiday ? ` ${d.holiday}` : "";
  return `${d.day} ${d.status}${extra}`;
}).join("　");

dv.paragraph(`<span style="display:inline-flex;align-items:center;gap:6px;">🏢 <strong>办公室</strong> ${lights.join("")} <span style="font-size:0.9em;color:var(--text-muted);">${label}</span></span>`);
if (detail) dv.paragraph(`<span style="font-size:0.85em;color:var(--text-muted);">${detail}</span>`);
```
