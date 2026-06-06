---
title: Helper/utils 代码片段索引
type: index
created: 2026-06-04
tags:
  - meta/index
  - snippets
modified_at: 2026-06-06
---

# Helper/utils — Snippet & Script Index

> [!warning] 不要随意移动 / 重命名本文件夹内的文件
> - **`.md` 嵌入片段**：通过 `![[文件名]]` 引用（短路径匹配 basename），移动子文件夹不会断，但**改名会断**所有引用。
> - **`.js` QuickAdd 脚本**：QuickAdd 在 `.obsidian/plugins/quickadd/data.json` 里用**完整路径**绑定（如 `Helper/utils/qcTask.js`），移动或改名都会断，必须同步改配置。
> - **`.js` Templater 用户脚本**：`user_scripts_folder = Helper/utils`，按文件名暴露为 `tp.user.xxx`，递归子文件夹安全，但改名会断 `tp.user` 调用。
> - **Google Drive 冲突改名**（`qcTask 1.js`）会同时打断以上所有引用——批量改动后请检查重复文件。

**文件统计**：50 个 `.md` 嵌入片段 · 18 个 `.js` 脚本（+ `Helper/lib/DailyLog.js` CustomJS 共享类）· `holidays/` 子目录 · 3 个 `.bak`（可清理）

**列说明**
- **类型**：`md-embed`=dataviewjs 嵌入片段 · `js-quickadd`=QuickAdd 脚本 · `js-templater`=Templater 用户函数 · `js-metabind`=Meta Bind/JS Engine 动作 · `js-util`=纯 vault API 脚本
- **依赖**：运行所需的**插件 · 数据源/文件**。所有 `.md` 均依赖 **Dataview**（dataviewjs）插件，故只列额外数据源。`—`=自包含（仅靠当前笔记/日期，无外部数据源）
- **引用**：全库 `![[...]]` 嵌入或 `dv.view()` 路径引用次数；`—`=未找到，需人工确认是否废弃

---

## 1. 导航 Navigation

| 文件 | 类型 | 用途 | 依赖（插件 · 数据源） | 引用 |
|---|---|---|---|---|
| `dailyNavigation.md` | md-embed | 日记上一篇/下一篇导航 | DV · `周计划/` + 当前笔记 | 264 |
| `noteNav.md` | md-embed | 同文件夹兄弟笔记导航 | DV · 当前文件夹 | 171 |
| `weeklyNavigation.md` | md-embed | 周记导航 | DV · — (日期推算) | 15 |
| `monthlyNavigation.md` | md-embed | 月记导航 | DV · — (日期推算) | 8 |
| `todayLink.md` | md-embed | 跳转今日链接 | DV · — | — |
| `weeklyLink.md` | md-embed | 跳转本周链接 | DV · — | — |
| `goToHomepage.js` | js-quickadd | 跳转主页 | QuickAdd API | data.json |
| `createDailyNoteByDate.js` | js-quickadd | 按日期从模板建日记 | QuickAdd · `Helper/Templates/Daily Note.md` | data.json |
| `fixDailyNoteFlicker.js` | js-quickadd | 修复日记打开闪烁 | QuickAdd API | data.json |

## 2. 习惯追踪 Habit Trackers

| 文件 | 习惯 | 依赖（插件 · 数据源） |
|---|---|---|
| `habitTrackerWeights.md` | 举铁 | DV · `日记/` |
| `habitTrackerSwimming.md` | 游泳 | DV · `日记/` |
| `habitTrackerTennis.md` | 网球 | DV · `日记/` |
| `habitTrackerSinging.md` | 唱歌 | DV · `日记/` |
| `habitTrackerCooking.md` | 做饭 | DV · `日记/` + `食谱/` (recipeFolder) |
| `habitTracker小饭桌.md` | 小饭桌 | DV · `日记/` + `食谱/` |
| `habitTrackerTheatre.md` | 看剧 | DV · `日记/` |
| `habitTrackerTherapy.md` | 心理治疗 | DV · `日记/` |
| `habitTrackerAllergist.md` | 过敏门诊 | DV · `日记/` |
| `habitTrackerOut.md` | 外出 | DV · `日记/` |
| `habitTrackerNoBuy.md` | 不消费 | DV · 自定义 query |

> 全部 `md-embed`；共用 `CONFIG.dailyNotesFolder = 日记/`。引用 1–5。

## 3. 进度条与图表 Progress Bars & Charts

| 文件 | 类型 | 用途 | 依赖（插件 · 数据源） | 引用 |
|---|---|---|---|---|
| `genTOC.md` | md-embed | 自动生成目录（最高频）| DV · 当前笔记标题 | 345 |
| `dayOfWeek.md` | md-embed | 显示星期几 | DV · 笔记标题日期 | 262 |
| `tvProgress.md` | md-embed | 追剧集数进度 | DV · `日记/` | 50 |
| `bookProgress.md` | md-embed | 读书页数进度 | DV · `日记/` | 12 |
| `taskAgeBadges.md` | md-embed (dv.view) | 任务时长徽章 | DV · 当前笔记任务 | 11 |
| `ProgressBar.md` | md-embed | 通用年度进度条 | DV · — (日期推算) | 2 |
| `contributionGraph.md` | md-embed | 贡献热力图 | DV · `日记/{年}/` | 2 |
| `courseProgress.md` | md-embed | 课程进度 SVG | DV · `日记/` | — |

## 4. 日历网格与热力图 Calendar Grids & Heatmaps

| 文件 | 类型 | 用途 | 依赖（插件 · 数据源） | 引用 |
|---|---|---|---|---|
| `monthlyCalendarGrid.md` | md-embed | 月历网格 | DV · `日记/` (DIARY_FOLDER) | 8 |
| `plumbobCalendarGrid.md` | md-embed | Plumbob 主题月历 | DV · `日记/` + `Helper/utils/holidays/` + Weather API | 2 |

> **plumbobCalendarGrid 天气图标架构** (2026-06-05):
> - 数据源: `pwa-wardrobe.fly.dev/api/weather/forecast` (Tomorrow.io 代理), localStorage 缓存 8h (`plumbob_weather_v7`)
> - 图标: 12 个 Sims 4 风格 22×22 PNG (base64), 存于 `WX_IMG` 对象, 通过 `WEATHER_CODES` 映射 Tomorrow.io code → base64
> - 渲染: `<div class="pc-weather">` + `background-image:url('data:image/png;base64,...')`, 带 `rgba(80,120,160,0.45)` 底色确保 light mode 可见
> - 图标列表: sunny, mostly_clear, partly_cloudy, mostly_cloudy, cloudy, fog, light_rain, rain, snow, heavy_snow, freezing, thunderstorm
> - 生成脚本: `/tmp/gen_sims4_weather_v3.py` (v4 透明背景版), cloudy 单独调整为深灰后云+白前云
> - ⚠️ 修改 `WX_IMG` base64 时用 `(?<![a-z_])key:'...'` 正则避免子串匹配 (如 `cloudy` 匹配到 `mostly_cloudy`)
> - ⚠️ 修改图标后必须 bump cache key (如 `_v7` → `_v8`), 否则旧缓存会复用损坏数据
| `houseworkRoomHeatmap.md` | md-embed | 家务按房间热力图 | DV · `日记/` | 1 |
| `houseworkWeeklyGrid.md` | md-embed | 家务周网格 | DV · `日记/{年}` | 1 |
| `tickGrid.js` | js-templater | `tp.user.tickGrid` 打勾网格 | Templater · — | 模板内 |

## 5. 财务与花费 Finance & Spending

| 文件 | 类型 | 用途 | 依赖（插件 · 数据源） | 引用 |
|---|---|---|---|---|
| `monthlyAmount.md` | md-embed | 购物/食物/电费同比（标签页）| DV · `年度记录/` + `Logistics/购物/转运记录/` | 2 |
| `monthlyAmount-食物.md` | md-embed | 食物金额同比（`Recipes.md` 在用）| DV · `年度记录/` | 1 |
| `monthlyStats.md` | md-embed | 月度统计 | DV · `日记/{年}` | 10 |
| `转运月花费.md` | md-embed | 转运月花费 | DV · 转运记录文件夹 | — |
| `monthlyAmountEdit.js` | js-metabind | 编辑月度金额 | JS Engine · `年度记录/` | data.json |

### 信用卡年度权益 Credit-Card Yearly Rewards
| 文件 | 卡 | 依赖（插件 · 数据源） |
|---|---|---|
| `AmexPlatinumYearlyReward.md` | Amex Platinum | DV · 本卡文件夹/{年} + `日记/{年}` |
| `BiltYearlyReward.md` | Bilt | DV · 本卡文件夹/{年} + `日记/{年}` |
| `UnitedQuestYearlyReward.md` | United Quest | DV · 本卡文件夹/{年} + `日记/{年}` |
| `MaoMaoYearlyReward.md` | 猫猫卡 | DV · 本卡文件夹/{年} + `日记/{年}` |

> 均 `md-embed`，引用 1–2。

## 6. 媒体追踪 Media (TV / 书 / 课程)

| 文件 | 类型 | 用途 | 依赖（插件 · 数据源） | 引用 |
|---|---|---|---|---|
| `weeklyMedia.md` | md-embed | 周媒体汇总 | DV · `日记/` + `看电视/` | 15 |
| `tvSync.md` | md-embed (后台) | 追剧同步（dataviewjs 写回 `last_sync`）| DV · `看电视/` + `日记/` | **`Helper/quickadd-scripts/tv-sync.js`**（`BUTTON[sync-tv]` 后台打开本文件触发同步）|
| `dailyAddShow.js` | js-quickadd | 日记添加剧集 | QuickAdd · 今日`日记` + `看电视/`标题 | data.json |
| `dailyAddBook.js` | js-quickadd | 日记添加书 | QuickAdd API | data.json |
| `dailyUpdateCourse.js` | js-quickadd | 日记更新课程 | QuickAdd · 今日`日记`课程标题 | data.json |
| `moveAbandonedShows.js` | js-util | 移动弃剧 | vault API · `看电视/` → `看电视/弃` | data.json |
| `读书笔记-20260408.js` | js-quickadd | 生成读书笔记 | QuickAdd · `Helper/Templates/读书笔记.md` | data.json |

## 7. 健康与医疗 Health & Medical

| 文件 | 类型 | 用途 | 依赖（插件 · 数据源） | 引用 |
|---|---|---|---|---|
| `doctorTracker.md` | md-embed | 就诊记录追踪 widget | DV · `日记/`（被就诊笔记直接 `![[doctorTracker]]` 嵌入）| 10 |
| `dailyAddRefill.js` | js-quickadd | 日记添加药品续配 | QuickAdd · `Logistics/库存/药品.md` | data.json |
| `toggleDayActivity.js` | js-quickadd | 切换当日活动板块（游泳/心理治疗，参数化）| vault API · 当前笔记 + `params.settings` | data.json ×2 (Swimming/Therapy macro) |

## 8. 日期上下文组件 Day Context Widgets

| 文件 | 类型 | 用途 | 依赖（插件 · 数据源） | 引用 |
|---|---|---|---|---|
| `dayMentions.md` | md-embed (dv.view) | 当日被提及的链接 | DV · `Helper/` + vault read | 36 |
| `dayMentionsPlus.md` | md-embed (dv.view) | 增强版当日提及 | DV · `Helper/` + vault read | 20 |
| `eventNotes.md` | md-embed | 事件笔记列表 | DV · vault read 事件文件 | 28 |
| `monthlyEvents.md` | md-embed | 月度事件 | DV · `日记/{年}` + 嵌入 `eventNotes` | 10 |
| `onThisDay.md` | md-embed | 历史上的今天 | DV · vault read | — |
| `trackHolidays.md` | md-embed | 节假日追踪 | DV · `日记/` + `Helper/utils/holidays/` | 2 |
| `holidays/` | 数据目录 | 各月节假日数据 `YYYY-MM.md` | 无插件（被 `trackHolidays`/`plumbobCalendarGrid` 读取）| — |

## 9. QuickCapture / 任务 / 食材库

| 文件 | 类型 | 用途 | 依赖（插件 · 数据源） | 引用 |
|---|---|---|---|---|
| `quick_capture_controls.md` | md-embed | QuickCapture 控制面板 | DV · vault read 状态文件 | 2 |
| `pantry_controls.md` | md-embed | 食材库控制面板 | DV · vault read 食材库文件 | 2 |
| `qcTask.js` | js-quickadd | QuickCapture 任务处理 | QuickAdd API | data.json |

## 10. 库维护脚本 Vault Maintenance

| 文件 | 类型 | 用途 | 依赖（插件 · 数据源） | 引用 |
|---|---|---|---|---|
| `attachmentOrganizer.js` | js-util | 整理附件 | vault API · `Attachments/日记`、`日记/`、`看电视/` | data.json |
| `basesOrganizer.js` | js-util | 整理 Bases | vault API · `.base` 文件 | data.json |
| `noteToFolderNote.js` | js-util | 笔记转文件夹笔记 | vault API · 当前笔记 | data.json |
| `cleanupBakFiles.js` | js-util | 清理 `.bak` | vault API · 全库 `.bak` | data.json |

## 11. 编辑辅助 Editor Helpers

| 文件 | 类型 | 用途 | 依赖（插件 · 数据源） | 引用 |
|---|---|---|---|---|
| `editComment.md` | md-embed | 行内编辑评论 | DV · 当前笔记 | 87 |
| `recipeTracker.md` | md-embed | 食谱追踪 widget | DV · `日记/`（被食谱笔记直接 `![[recipeTracker]]` 嵌入）| 15 |

## 12. 杂项 / 一次性 Misc

| 文件 | 类型 | 用途 | 依赖（插件 · 数据源） | 引用 |
|---|---|---|---|---|

---

## ⚠️ 待确认 / 清理候选

**已部署**：`onThisDay.md` —— 已嵌入 `Daily Note.md` 模板（`![[importantDates]]` 之后），2026-06-06 验证通过。**无数据时自动隐藏 embed**（`dv.container` 加 `.otd-empty` 类 + 注入的 `:has()` CSS 规则；JS 在 render 阶段够不到 `.internal-embed`，故走 CSS）。
**待用户决定（未部署的功能）**：`courseProgress.md`（课程进度趋势图 + 自动同步；同步与 `dailyUpdateCourse.js` 重复，仅趋势图独有；课程笔记现用 `课程` 模板的内联进度条）
**已删（无引用 + 已验证取代）**：~~`todayLink.md`、`weeklyLink.md`~~（homepage 内联取代，删于 2026-06-06）、~~`转运月花费.md`~~（monthlyAmount 取代，删于 2026-06-06）、~~`monthlyAmount-购物.md`、`monthlyAmount-电费.md`~~（删于 2026-06-05）
> ⚠️ **`tvSync.md` 不是无引用**——被 `Helper/quickadd-scripts/tv-sync.js`（`BUTTON[sync-tv]`）按路径引用，2026-06-06 仍在同步。**之前误判源于 `grep -r` 跳过了 gitignore 的 `/Helper/`**（见 memory `feedback-grep-skips-helper-gitignore`）。本节"无引用"判断须用 `find -exec grep` 复核，非 `grep -r`。
> 这些未找到 `![[]]`、`[[]]` 或 `dv.view()` 引用（已用 `find -exec grep` 多向量复核：embed/base/脚本路径/定时任务/git 历史全部 0）。
> **各自的"死因"（2026-06-06 调查）**：
> - `todayLink.md` / `weeklyLink.md` —— 被 `个人主页.md` 第 17–18 行的**内联 `$=` dataview 表达式取代**（同样产出 `今日记录` / `本周内容` 链接），文件本身未被嵌入。删文件不影响 homepage。
> - `转运月花费.md` —— 已验证被 `monthlyAmount.md` 取代（读同一 `Logistics/购物/转运记录` 文件夹、同 filter，标题"含转运占比"）。**已删 2026-06-06。**
>
> **仍待决定（未部署的功能，自 2026-04 bulk import 后从未改动、从未嵌入）**：
> - `onThisDay.md`（455 行）—— "历史上的今天"：显示往年同一天的日记条目（`去年` / `N年前`），render-only，本应嵌入 Daily Note 模板。
> - `courseProgress.md` —— 课程进度 SVG 图 + 把日记里的进度**自动同步**回课程文件 `进度` frontmatter。⚠️ 其"同步"功能与 `dailyUpdateCourse.js`（按钮也写 `进度`）**重复**，只有"图表"是独有的。本应嵌入课程笔记。

**`.bak` 备份（可直接删，或交给 `cleanupBakFiles.js`）**：`1-Pantry-20260604.bak`、`2-Pantry-20260604.bak`、`Pantry-20260604.bak`

**带日期戳的文件**：`读书笔记-20260408.js`（~~`2026-W18-20260502.js` 已删 2026-06-06：是 addImportantDate 的旧版重复~~）
> 注意：这两个名字是 **hook 自动改名的产物**（新 `.js` 经 Write 直写会被改成 `<当前活动笔记>-<日期>.js`）。QuickAdd 用这个戳名路径绑定，**改名会断绑定**——保持原样，不要"统一"。新脚本一律先写 `/tmp/` 再 `cp` 进来即可避免。

**已知悬空引用**：QuickAdd 配置引用 `Helper/utils/openTodayNote.js`，但该文件不存在（可能已改名为 `goToHomepage.js`）——需在 QuickAdd 设置内修复。

## 共享依赖速查 Shared-Dependency Map

改动这些**数据源**会影响多个片段：

| 数据源 | 被依赖的片段（部分）|
|---|---|
| `日记/` | 几乎所有 habitTracker、monthlyStats、monthlyCalendarGrid、tvProgress、bookProgress、courseProgress、housework*、trackHolidays、weeklyMedia 等 20+ |
| `年度记录/` | monthlyAmount(全部)、monthlyAmountEdit |
| `看电视/` | tvSync、weeklyMedia、dailyAddShow、moveAbandonedShows |
| `食谱/` (recipeFolder) | habitTrackerCooking、habitTracker小饭桌 |
| `Helper/utils/holidays/` | trackHolidays、plumbobCalendarGrid |
| `Helper/Templates/` (读取模板文件) | createDailyNoteByDate（`Daily Note.md`）、读书笔记（`读书笔记.md`）|
| **Dataview 插件** | 全部 52 个 `.md` |
| **QuickAdd 插件** | 9 个 js-quickadd 脚本 |

## 🔗 连环嵌套 Nesting Chains

**核心结论：widget 之间没有直接互相嵌套**（没有任何 `.md` 片段在运行时 `![[]]` 另一个 `.md` 片段）。
→ 单独给某个 widget 改名，只会断它自己，不会连环崩。**所有真正的「连环嵌套」都经由笔记模板**（`Helper/Templates/*.md`）这个枢纽。

### 模板 = 嵌套枢纽（改 widget 名 → 断模板 + 所有用该模板建的笔记）

| 模板 | 嵌入的 utils widget | 影响面 |
|---|---|---|
| `Daily Note.md` | `dailyNavigation`、`dayOfWeek`、`genTOC`、`eventNotes`、`dayMentions` | **每一篇日记**（数百） |
| `Monthly Note.md` | `monthlyEvents`、`monthlyNavigation`、`monthlyStats`、`plumbobCalendarGrid` | 每篇月记 |
| `Weekly Note.md` | `genTOC`、`weeklyMedia`、`weeklyNavigation` | 每篇周记 |
| `Quarter Note.md` / `课程.md` | `genTOC`、`noteNav` | 季度/课程笔记 |
| `年度日记模板.md` | `contributionGraph` | 年度日记 |
| `Recipes.md` | `recipeTracker`、`noteNav` | 每个食谱 |
| `Doctor.md` | `doctorTracker`、`noteNav` | 每个就诊记录 |
| `电影/电视剧/综艺/Musical.md` | `editComment`、`noteNav` | 影视/音乐剧笔记 |
| 其余约 8 个模板 | `noteNav`（最广） | 几乎所有类型笔记 |

### 最深的运行时链（3 层）
```
月记笔记  →  ![[plumbobCalendarGrid]]  →  读取 Helper/utils/holidays/YYYY-MM.md
日记/月记  →  ![[trackHolidays]]        →  读取 Helper/utils/holidays/YYYY-MM.md
```
> 改 `holidays/` 目录名或文件名格式 → 断第 3 层；改 `plumbobCalendarGrid`/`trackHolidays` 名 → 断模板那一层。

### 唯一「脚本产出嵌套」
```
读书笔记-20260408.js  →  生成的读书笔记里写死 ![[noteNav]] + ![[bookProgress]]
```
> 这两个 widget 名写死在脚本字符串里；改 `noteNav`/`bookProgress` 名要同时改这个 `.js`。

### 高危「枢纽 widget」（被多个模板嵌入，改名波及最广）
按引用量排序，**改名前务必全局替换**：
`noteNav`(171) · `genTOC`(345) · `dayOfWeek`(262) · `dailyNavigation`(264) · `editComment`(87) · `eventNotes`(28)
> 它们的高引用数正是来自「被模板嵌入 → 每篇笔记继承」这条链，不是被单独引用 N 次。

## ⚠️ 风险评估 Risk Assessment

> 本文件夹无网络/密钥/外部输入，风险类别是**数据丢失 + GDrive 同步脆弱**，不是 Web 漏洞。
> 共 632 行会改动 vault 的 JS。审查日期 2026-06-04。

### 🔴 HIGH

**H1 · `cleanupBakFiles.js:44-46` — 全库永久删除，无确认**
`app.vault.delete()` **永久销毁**（绕过 Obsidian `.trash`），递归整个 vault root 一次删光所有 `.bak`，无 dry-run、无撤销。
→ 用户偏好：**不要确认弹窗**（`.bak` 视为可丢弃备份）。唯一可选加固是 `delete`→`vault.trash(file, true)` 让删除可恢复——但既然是一次性备份，保持现状（永久删）也可接受。无需修改，记录在案。

**H2 · 整文件重写模式 — `dailyAdd*` 家族**
`dailyAddBook/Show`、`dailyUpdateCourse`、`add*Section`、`2026-W18` 都用 `vault.modify(file, lines.join("\n"))` 从内存数组重建整篇笔记。索引逻辑一旦出错就静默覆盖整篇日记——正是 memory 里记录过的数据丢失类型。无快照、无 guard；GDrive 同步中途写入还会覆盖未同步的远端编辑。
→ `qcTask.js:90-118` 是该模式的**安全版**（仅正则插入，从不重建文件），应作为改造范本。

**H3 · 改名 / GDrive 脆弱性**（详见上文「连环嵌套」+ 顶部 warning）
QuickAdd 在 `data.json` 写死 15 条完整路径；GDrive 冲突改名（`qcTask 1.js`）静默打断绑定与模板链。已存在的悬空 `openTodayNote.js` 引用证明此事发生过一次。

### 🟡 MEDIUM

**M1 · `noteToFolderNote.js:36`** — 先建后删，但用 `vault.delete`（永久）而非 `trash`；若新文件内容写错则原文件不可恢复。→ 改 `trash` + 删前校验新文件大小。

**M2 · `attachmentOrganizer.js`** — 415 行 / 单个 QuickAdd 动作里 4 次 rename + 2 次 trash，复杂度与影响面最大（用 trash，可恢复，优于 H1）；无 dry-run，批量移动在 GDrive 上最易产生冲突副本。

**M3 · 缺错误处理** — `basesOrganizer.js`、`moveAbandonedShows.js` 无 try/catch，循环中途抛错会留下半完成状态。

### 🟢 LOW（卫生）
- 3 个孤立 `Pantry*.bak` 滞留本目录（且会被 H1 删除）。
- 日期戳一次性脚本混入库：`读书笔记-20260408.js`。
- 8 个零引用 widget（见「待确认/清理候选」）。
- `monthlyAmountEdit.js` 依赖 JS Engine 注入全局，无存在性 guard。

### 结论
无 critical/安全问题；危险集中且呈**个人数据丢失**形态。最低成本高价值的修复是 **H1**（最具破坏性的失控操作）；**H2** 最隐蔽（静默、渐进），值得按 `qcTask.js` 范式逐个加固。

## 🔧 重构机会 Consolidation

> 结构性约束：QuickAdd/Templater 用户脚本**没有 Node `require`/`import`**，无法把公共函数抽成一个被 import 的模块——这正是重复存在的根因。共享代码只有两条正路：**① CustomJS 插件**（`customJS.YourClass` 全局可用，当前未装，用户已同意引入）；**② 单个参数化脚本 + QuickAdd `variables`**（`createDailyNoteByDate.js` 已是此模式）。

### D1 · `addSwimmingSection.js` ≈ `addTherapySection.js`（~90% 相同，各 ~65 行）— 首选
逐字相同：add/remove 切换、"有笔记则保留 section"、改 frontmatter 后重读、"插在 `# Event` 前"、空行裁剪。仅差异：

| | Swimming | Therapy |
|---|---|---|
| Section 标题 | `# 游泳课` | `# Therapy` |
| 加的 tag | `健身房` + bool `activity_swimming` | `therapy` |
| 判定 | `fm.activity_swimming === true` | `activity_tags.includes("therapy")` |

→ **✅ 已完成（2026-06-04）**：合并为 `toggleDayActivity.js`，靠 QuickAdd UserScript `settings`（**第二个函数参数** `fn(params, settings)`，不是 `params.settings`）驱动；两个 macro（Swimming/Therapy，GUID 不变）传不同 settings。省 ~65 行，"插在 # Event 前 / 有笔记则保留" 逻辑只剩一处。旧脚本已删。

### D2 · `dailyAddBook` / `dailyAddShow` / `dailyUpdateCourse` 共享一段拷贝的「section upsert 引擎」（~40 行 × 3）
三者**连注释都逐字相同**：`/^##\s.*X/` 找 section → `=== / ``` / 下个 ## ` 找 section 尾 → 找已有 `- [[selected]] PROP:: ` 行替换、否则 splice 到尾部 → modify + Notice。
仅差异：过滤条件、属性名（`完成页数`/`看过集数`/`进度`）、section 关键词（`读书`/`看电视`/`课程`）、目标文件、（show 多一步改 FM 集数）。
> 拷贝漂移证据：`dailyAddBook` 是现代 `const`/箭头，`dailyAddShow`/`dailyUpdateCourse` 是旧 `var`/`function`——克隆后只改了一半。

→ **✅ 已完成（2026-06-05）**：建 `Helper/lib/DailyLog.js`（CustomJS 类，`window.customJS.DailyLog`），抽出 `sectionUpsert(app, file, keyword, prop, selected, value)`。`dailyAddShow/Book/UpdateCourse` 各只剩「过滤 + 取值 + 调用」，共省 ~98 行。Node 单测覆盖 `sectionUpsert` + `resolveDailyTarget`。
> **结构统一（2026-06-05）**：三脚本目标笔记解析统一为 `DailyLog.resolveDailyTarget(app)` = **当前笔记若是日记（`日记/…/YYYY-MM-DD`）则用之，否则今日日记**。book 归一化（去掉 replace-anywhere + append-to-end 特例），现与 show/course 同构（show 仅多 FM 集数 bump）。**三个 button 已 live-tested ✅（2026-06-06，在今日日记上确认 add/update + 落入正确 section）。**

### D3 · 重复的微型 helper（CustomJS）
- `formatDate(d)` 本地时区 `YYYY-MM-DD` —— `qcTask` 有，`dailyUpdateCourse` 内联重写，`createDailyNoteByDate` 自己切片
- 今日日记路径 `日记/${y}/${y}-${m}-${d}.md` —— `dailyUpdateCourse`、`createDailyNoteByDate` 各自内联
- 状态归一 `Array.isArray(x)?x.includes(v):x===v` —— `dailyAddBook`、`dailyUpdateCourse`（`dailyAddShow` 手写 tag 变体）
- `suggester → active-file guard → parseInt guard` 样板 —— book/show/course/refill

→ **✅ 部分完成（2026-06-05）**：`formatDate` / `todayDailyPath` / `fmHasValue` 已收进 `DailyLog`（被 course 使用）。`createDailyNoteByDate`、`qcTask`、`dailyAddRefill` 暂未迁移（低优先，各自仍内联）。

### D4 · `.md` widget 重复
- **✅ 已完成（2026-06-05）**：删除 0 引用的 `monthlyAmount-购物.md`、`monthlyAmount-电费.md`（被标签页版 `monthlyAmount.md` 取代）。保留 `monthlyAmount-食物.md`（`Recipes.md` 在用）。
- `habitTracker*.md`（11 个）共享一套 CONFIG 驱动的 dataviewjs 骨架，仅 config 不同。**有意为之**的每习惯副本（各自被独立模板嵌入）。可参数化成单一 `dv.view('habitTracker', {habit})`，但嵌在 11 处 → 重构大、链路风险高、ROI 低，**建议保留**。

### 推荐顺序（CustomJS 已批准）
1. **D1** —— 最小最安全，先做（需我改 2 个 QuickAdd macro 传 `variables`）。
2. 装 **CustomJS** → 建 `customJS.DailyLog` 共享类 → 重构 **D2 + D3**（book/show/course/refill 各瘦身 ~40 行）。
3. **D4** —— 删 3 个死的 `monthlyAmount-*`；`habitTracker*` 保留。
