---
modified_at: 2026-06-05
---
%% 订阅时间线 — 在任意「工具」note 里用 ![[subscriptionTimeline]] 嵌入。
   读取宿主 note 自己的 [$] 订阅记录，实时派生状态。无写盘。
   依赖：task-date-recorder 插件 + dataview-subscription-fields.py patch（t.end / t.billing）。%%
```dataviewjs
(function () {
  try {
    const today = dv.luxon.DateTime.now().startOf("day");

    // 嵌入时 dv.current() 指向本 Helper note，需取真正的宿主 note
    const selfPath = "Helper/utils/subscriptionTimeline";
    const activePath = app.workspace.getActiveFile()?.path;
    const host = (activePath && !activePath.includes(selfPath)) ? dv.page(activePath) : dv.current();
    const subs = (host?.file?.tasks ?? dv.array([])).where(t => t.status === "$");

    // 状态派生：未开始 → ⚪；无结束日 → ♾️ 长期；≤10 天 → 即将到期
    const deriveStatus = (start, end) => {
      if (start && today < start) return "⚪ 未开始";
      if (!end) return "♾️ 长期";
      const days = Math.round(end.diff(today, "days").days);
      if (days < 0)   return "🔴 已过期";
      if (days <= 10) return "🟠 即将到期";
      return "🟢 进行中";
    };
    const plan  = t => t.text.replace(/\s*(💵|💳|🛫|🛬|✍️|➕|📅|⏰|❌|✅).*$/u, "").trim() || "—";
    const price = t => (t.text.match(/💵\s*\$?[\d.,]+/u)?.[0]) ?? "—";

    if (!subs.length) {
      dv.paragraph("*无订阅记录（用 `- [$] …` 添加）*");
      return;
    }
    dv.table(["计划", "状态", "周期", "价格", "开始", "结束"],
      subs.map(t => [
        plan(t),
        deriveStatus(t.start ?? null, t.end ?? null),
        t.billing ?? "—",
        price(t),
        t.start ? t.start.toFormat("yyyy-MM-dd") : "—",
        t.end   ? t.end.toFormat("yyyy-MM-dd")   : "—",
      ]).array()
    );
  } catch (e) {
    dv.paragraph("⚠️ subscriptionTimeline 出错: " + (e && e.message ? e.message : e));
  }
})();
```
