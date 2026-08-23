---
aliases: []
tags: []
cssclasses:
  - hide-frontmatter
activity_tags: []
medical_tags:
day:
medication_long:
  - 吃药/Allegra
  - 吃药/Glycopyrrlate-1
  - 吃药/Junel1-20
  - 吃药/Acetylcysteine-NAC
  - 吃药/Zoloft-112.5mg
  - 吃药/Buspirone-15mg
Supplements:
  - 吃药/保健品/鱼油
  - 吃药/保健品/维生素D
  - 吃药/保健品/维生素K
  - 吃药/保健品/镁-2
  - 吃药/保健品/PsylliumHusk-3
medication:
体重:
起起体重:
假期:
location: <%*
  const defaultLoc = "jc";
  let loc = defaultLoc;
  const targetDate = tp.file.title;
  const travelPlanFile = app.vault.getAbstractFileByPath("个人整理/旅行计划.md");
  if (travelPlanFile) {
    const text = await app.vault.read(travelPlanFile);
    let colStart = -1, colEnd = -1, colLoc = -1, colDate = -1, headerFound = false;
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("|") || /^\|[-| :]+\|$/.test(trimmed)) continue;
      const cells = trimmed.split("|").map(c => c.trim()).filter(Boolean);
      if (cells.length === 0) continue;
      if (!headerFound) {
        const lower = cells.map(c => c.toLowerCase());
        colStart = lower.findIndex(c => c === "start date" || c === "start_date" || c === "start");
        colEnd = lower.findIndex(c => c === "end date" || c === "end_date" || c === "end");
        colDate = lower.findIndex(c => c === "date");
        colLoc = lower.findIndex(c => c === "location");
        if (colLoc === -1) colLoc = 0;
        if (colStart === -1 && colDate === -1) colStart = 1;
        headerFound = true;
        continue;
      }
      const rowLoc = (cells[colLoc] ?? "").toLowerCase();
      if (!rowLoc) continue;
      if (colStart !== -1) {
        const start = cells[colStart] ?? "";
        const end = (colEnd !== -1 ? cells[colEnd] : "") || start;
        if (start && targetDate >= start && targetDate <= end) {
          loc = rowLoc;
          break;
        }
      } else if (colDate !== -1) {
        const d = cells[colDate] ?? "";
        if (d === targetDate) {
          loc = rowLoc;
          break;
        }
      }
    }
  }
  tR += loc;
%>
今日甚好: false
noBuy: false
小饭桌: false
办公室: false
modified_at: <%* tR += tp.date.now("YYYY-MM-DD") %>
---
![[dayOfWeek|no-title]]
![[dailyNavigation]]
![[genTOC]]
![[Helper/utils/dayMentions]]
`BUTTON[add_task]` `BUTTON[addRefill]` `BUTTON[edit_体重]` `BUTTON[edit_起起体重]` `BUTTON[therapy]` `BUTTON[swimming]`

`BUTTON[qa_tv]` `BUTTON[qa_book]`

![[importantDates]]

![[Helper/utils/onThisDay]]

**🏮今日甚好🏮:** `INPUT[toggle(class(my-toggle)):今日甚好]`
**🪷今天没买🪷:** `INPUT[toggle(class(my-toggle)):noBuy]`
**🍱小饭桌🍱:** `INPUT[toggle(class(my-toggle)):小饭桌]` **🥡外卖🥡:** `INPUT[toggle(class(my-toggle)):外卖]` **🍴外食🍴:** `INPUT[toggle(class(my-toggle)):外食]`
**🏢办公室🏢:** `INPUT[toggle(class(my-toggle)):办公室]`

# 日总结 %% fold %%
**⚖️体重:** `VIEW[{体重}]` **🐾起起体重:** `VIEW[{起起体重}]`

**🎯 Activities:** `INPUT[inlineListSuggester(option(健身房), option(学习), option(下厨), option(看戏), option(出去玩), option(毛毛)):activity_tags]`
	- 🎾 `INPUT[toggle:activity_tennis]` 🏸`INPUT[toggle:activity_squash]` 🥊 `INPUT[toggle:activity_boxing]` 🏋️ `INPUT[toggle:activity_weights]`
	- 🎤 `INPUT[toggle:activity_singing]`
	- 🏊 `INPUT[toggle:activity_swimming]` 🧘🏻‍♀️ `INPUT[toggle:activity_pt]`

**🏥 Medical:** `INPUT[inlineListSuggester(option(Dermatologist), option(Psychiatrist), option(Gastroenterologist), option(Dentist), option(Ophthalmologist), option(PCP), option(UrgentCare), option(OBGYN), option(Allergist), option(Urologist), option(Podiatrist), option(ENT)):medical_tags]`

**💊长期Medication:** `INPUT[inlineListSuggester(option(吃药/Zoloft-112.5mg), option(吃药/Allegra), option(吃药/Glycopyrrlate-1), option(吃药/Junel1-20), option(吃药/Acetylcysteine-NAC), option(吃药/Buspirone-15mg)):medication_long]`

**🧪Supplements:** `INPUT[inlineListSuggester(option(吃药/保健品/鱼油), option(吃药/保健品/维生素D), option(吃药/保健品/维生素K), option(吃药/保健品/镁-2), option(吃药/保健品/PsylliumHusk-3)):Supplements]`

**😷吃药：**`INPUT[inlineListSuggester(option(吃药/Sudafed-Pseudoephedrine),option(吃药/泰诺)):medication]`

**🏖️假期：**`INPUT[inlineListSuggester(option(放假/PTO),option(放假/病假),option(放假/公共假期)):假期]`
## 🏠 家务任务
**🧹 地面清洁:** `INPUT[inlineListSuggester(option(吸尘), option(拖地)):hw_floor]`

**🛌 卧室:**`INPUT[inlineListSuggester(option(换床单), option(换被套)):hw_bedroom]`

**👚 衣物：**`INPUT[inlineListSuggester(option(洗衣服), option(整理/叠衣服/上衣), option(整理/叠衣服/下装), option(整理/叠衣服/毛巾床品), option(整理/卖Mercari)):hw_laundry]`

**🚿 浴室清洁：**`INPUT[inlineListSuggester(option(刷马桶), option(洗手台), option(浴室地面), option(替换/牙刷刷头)):hw_bathroom]`

**🔪 厨房清洁：**`INPUT[inlineListSuggester(option(厨房水池), option(整理/厨房台面), option(整理/冷藏), option(整理/冷冻), option(微波炉), option(灶台)):hw_kitchen]`

**:DoFullTrash:替换：**`INPUT[inlineListSuggester(option(替换/猫砂盆liner), option(替换/空调滤网), option(替换/空气净化器filter)):hw_renew]`

# 笔记

````columns
id: <%* tR += Math.random().toString(36).slice(2, 9) %>

===

![[dailyModify.base|ordered-list]]

===

![[日常工具-20250901.base#即将到期订阅]]

````

# Event

```columns
id: event-cols

===

![[eventNotes]]


===



```

```columns
id: radsagg

===
## 课程

`BUTTON[updateCourse]`

===
## 看电视
`BUTTON[addShow]`

===
## 读书
`BUTTON[addBook]`

```