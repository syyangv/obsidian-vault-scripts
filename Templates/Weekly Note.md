---
aliases:
tags:
  - 手帐/周记
开始日期（周日）: <% window.moment(tp.file.title, "GGGG-[W]WW").day(0).format("YYYY-MM-DD") %>
结束日期（周六）: <% window.moment(tp.file.title, "GGGG-[W]WW").day(6).format("YYYY-MM-DD") %>
cssclasses:
  - hide-frontmatter
modified_at: 2026-06-04
---

![[weeklyNavigation]]

[[信息intake]]
![[genTOC]]

# 1 Tasks
## 1.1 Upcoming
````columns
id: upcoming-<% tp.file.title %>

===
### Regular
```tasks
not done
filter by function task.status.symbol !== '>'
path does not include 播客
path does not include 周计划
path does not include Logistics/库存/Pantry
happens after <% window.moment(tp.file.title, "GGGG-[W]WW").day(0).subtract(1, 'day').format("YYYY-MM-DD") %>
happens before <% window.moment(tp.file.title, "GGGG-[W]WW").day(6).add(1, 'day').format("YYYY-MM-DD") %>
sort by due
```

===
### [[Pantry]] older than 3 days
```tasks
not done
filter by function task.status.symbol !== '>'
path includes Logistics/库存/Pantry
filter by function ['冰箱', '冷藏', '水果', '冷藏饮料', '冷冻', '冷冻肉&海鲜', '冷冻蔬果', '冷冻主食&点心', '冷冻甜品'].some(h => (task.heading ?? task.precedingHeader ?? '').includes(h))
created before 3 days ago
sort by function task.heading ?? task.precedingHeader ?? ''
sort by created
hide backlink
```
```dataviewjs
// Count + total 💵 cash value of the Pantry tasks shown above (Tasks plugin can't sum a custom field)
const HEADINGS = ['冰箱','冷藏','水果','冷藏饮料','冷冻','冷冻肉&海鲜','冷冻蔬果','冷冻主食&点心','冷冻甜品'];
const cutoff = dv.luxon.DateTime.now().startOf('day').minus({ days: 3 });
const page = dv.page('Logistics/库存/Pantry.md');
let n = 0, total = 0;
for (const t of (page?.file?.tasks ?? [])) {
  if (t.completed) continue;                       // not done
  if (t.status === '>') continue;                  // exclude migrated
  const h = (t.header?.subpath ?? t.section?.subpath ?? '');
  if (!HEADINGS.some(x => h.includes(x))) continue;
  let created = t.created ?? null;                 // ➕ date (dataview-parsed or regex fallback)
  if (!created) { const m = t.text.match(/➕\s*(\d{4}-\d{2}-\d{2})/); if (m) created = dv.date(m[1]); }
  if (!created || created >= cutoff) continue;      // created before 3 days ago
  n++;
  const pm = t.text.match(/💵\s*\$?([\d,]+(?:\.\d+)?)/);   // sum the 💵 field
  if (pm) total += parseFloat(pm[1].replace(/,/g, ''));
}
dv.paragraph(`**📋 ${n} 项 · 💵 $${total.toFixed(2)}**`);
```

````

## 1.2 Done this week
````columns
id: done-this-week-<% tp.file.title %>

===
### Regular
```tasks
done after <% window.moment(tp.file.title, "GGGG-[W]WW").day(0).subtract(1, 'day').format("YYYY-MM-DD") %>
done before <% window.moment(tp.file.title, "GGGG-[W]WW").day(6).add(1, 'day').format("YYYY-MM-DD") %>
path does not include 播客
path does not include 周计划
path does not include Logistics/库存/Pantry
path does not include Archive/pantry
```

===
### [[Pantry]]
```tasks
done after <% window.moment(tp.file.title, "GGGG-[W]WW").day(0).subtract(1, 'day').format("YYYY-MM-DD") %>
done before <% window.moment(tp.file.title, "GGGG-[W]WW").day(6).add(1, 'day').format("YYYY-MM-DD") %>
filter by function task.file.path.includes('Logistics/库存/Pantry') || /^archive\/pantry/i.test(task.file.path)
hide backlink
```
```dataviewjs
// Count + total 💵 cash value of the Pantry tasks done this week (Tasks plugin can't sum a custom field)
const p = dv.current();
const start = dv.luxon.DateTime.fromISO(String(p["开始日期（周日）"]).slice(0,10)).startOf('day');
const end = dv.luxon.DateTime.fromISO(String(p["结束日期（周六）"]).slice(0,10)).endOf('day');
const tasks = dv.pages('"Logistics/库存/Pantry" or "Archive"').file.tasks
  .where(t => t.path.includes('Logistics/库存/Pantry') || /archive\/pantry/i.test(t.path));
let n = 0, total = 0;
for (const t of tasks) {
  if (t.status !== 'x' && t.status !== 'X') continue;     // done
  let done = t.completion ?? null;                        // ✅ date (dataview-parsed or regex fallback)
  if (!done) { const m = t.text.match(/✅\s*(\d{4}-\d{2}-\d{2})/); if (m) done = dv.date(m[1]); }
  if (!done || done < start || done > end) continue;       // done this week
  n++;
  const pm = t.text.match(/💵\s*\$?([\d,]+(?:\.\d+)?)/);    // sum the 💵 field
  if (pm) total += parseFloat(pm[1].replace(/,/g, ''));
}
dv.paragraph(`**📋 ${n} 项 · 💵 $${total.toFixed(2)}**`);
```

````

# 2 信息feed
## 2.1 本周更新
```dataviewjs
const p      = dv.current();
const start  = window.moment(String(p["开始日期（周日）"]).slice(0,10), "YYYY-MM-DD");
const end    = window.moment(String(p["结束日期（周六）"]).slice(0,10), "YYYY-MM-DD");

const tasks = dv.pages("#RSS")
    .file.tasks
    .where(t => !t.completed && t.written)
    .where(t => {
        const written = window.moment(String(t.written).slice(0, 10), "YYYY-MM-DD");
        return written.isSameOrAfter(start, 'day') && written.isSameOrBefore(end, 'day');
    });

dv.taskList(tasks);
```

## 2.2 本周已处理
```dataviewjs
const p      = dv.current();
const start  = window.moment(String(p["开始日期（周日）"]).slice(0,10), "YYYY-MM-DD");
const end    = window.moment(String(p["结束日期（周六）"]).slice(0,10), "YYYY-MM-DD");

const tasks = dv.pages("#RSS")
    .file.tasks
    .where(t => ['x', '-', '>'].includes(t.status))
    .where(t => {
        const date = t.completion ?? t.cancelled;
        if (!date) return false;
        const d = window.moment(String(date).slice(0, 10), "YYYY-MM-DD");
        return d.isSameOrAfter(start, 'day') && d.isSameOrBefore(end, 'day');
    });

dv.taskList(tasks);
```

# 3 本周书影音
![[weeklyMedia]]
