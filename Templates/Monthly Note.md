---
aliases: []
cssclasses:
  - hide-frontmatter
tags: []
theme:
AmexPlatinum_subscription: 25
AmexPlatinum_Uber: 15
AmexPlatinum_walmart: 13.81
UnitedQuest_rideshare: 8
购物金额:
食物金额:
电费:
<%* tR += "modified_at: " + tp.date.now("YYYY-MM-DD") %>
毛毛_交通卡: 50
---

![[monthlyNavigation]]
 
# 本月金额汇总 %% fold %%
**🛍️本月[[购物]]:** `VIEW[{购物金额}]` **🍜本月吃饭:** `VIEW[{食物金额}]` **⚡️本月电费:** `VIEW[{电费}]`

```meta-bind-button
style: default
label: "✏️ 更新金额"
actions:
  - type: js
    file: Helper/quickadd-scripts/monthlyAmountEdit.js
```
# 本月主题^
<font color="#92d050">**<center><span style="font-size: 20px;">🎯 </span></center>**</font></font>

# BUJO
[[<% window.moment(tp.file.title, "YYYY-MM").format("YYYY[Q]Q") %>#<% window.moment(tp.file.title, "YYYY-MM").format("YYYY年M月") %> 事件Planning]]

![[plumbobCalendarGrid]]
# 其他统计
![[monthlyStats]]

# Events
![[monthlyEvents]]
# 本月书影音
![[月度书影音.base]]
