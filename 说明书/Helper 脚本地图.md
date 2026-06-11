---
tags:
  - meta/index
modified_at: 2026-06-11
---

# Helper 脚本地图（文件夹 · 用途 · 重组就绪度）

> 配套：[[_INDEX]]（`utils/` 内部详表）· [[Obsidian 技能编排关系]]（用哪个 Claude 技能创建/管理脚本的分流图）。本文是 `Helper/` **整体**总览，按**用途**而非当前文件夹组织，供潜在重组参考。
> ⚠️ 查引用一律用 `find … -exec grep`，**不要用 `grep -r`**（`/Helper/` 被外层 vault `.gitignore` 排除，`grep -r` 会整树跳过）。详见 memory `feedback-grep-skips-helper-gitignore`。

## 0. 新脚本放哪？— 决策（先问「怎么被调用」，文件夹是**被插件配置钉死的**，不是偏好）

| 脚本是… | 被谁调用 | → 放进 | 形式 | 约束 |
|---|---|---|---|---|
| **QuickAdd 脚本** | QuickAdd macro / 命令面板 / 按钮 QuickAdd 动作 | `quickadd-scripts/` | `.js`，`module.exports = async (params) => {}` | 必须在 `quickadd/data.json` 注册完整路径（**关 Obsidian 后**改，退出时会回写） |
| **Templater 函数** | `tp.user.x` | `utils/`（**强制**） | `.js` | 被 `user_scripts_folder = Helper/utils` 钉死，挪出即断 |
| **CustomJS 类** | `window.customJS.X` | `lib/`（**强制**） | `.js` | 被 `jsFolder = Helper/lib` 钉死 |
| **Meta Bind / JS Engine 动作** | 笔记按钮 `file:` → `engine` | `meta-bind/` | `.js` | 调用方笔记里写死路径，改路径要同步改笔记 |
| **dataviewjs widget** | `![[名字]]` 嵌入 | `utils/` | `.md` | 按 basename 匹配，**移动 OK、改名断** |
| **dv.view widget** | `dv.view("路径")` | `utils/` | `.js` | 按路径；Drive vault 上 dv.view 看不到外部新建 .js → 笔记用 INLINE 副本（见 `subscriptionGantt.js`） |
| **数据 / 笔记模板** | 被读取 / folder-template | `holidays/`(数据) · `Templates/`(模板) · `Banners/` | `.md` | — |

**两条横切铁律：**
1. **改 `quickadd/data.json` 必须先关 Obsidian**（运行中退出会用内存里的旧版覆盖你的改动）。
2. **`.obsidian/` 被 gitignore** → `data.json` + 插件配置不在版本控制内；改了要在 vault 笔记里记一笔，并先备份。
3. 新建 `.js` 用 Bash（`/tmp` 写好再 `cp`，或 `git mv`），别用编辑器直写到 vault 根活动笔记旁——历史上 `paste-image-rename` 插件会把新 `.js` 改名成 `<活动笔记>-<日期>.js`（**2026-06-11 已加 `excludeExtensionPattern` 修复**，此条为防御纵深）。

## 1. 文件夹一览

> ✅ **2026-06-11 已重组**：所有 QuickAdd 脚本已集中到 `quickadd-scripts/`（15 个从 `utils/` 迁入 + 早前 `syncCssclass` 从 `meta-bind/`）。`读书笔记-20260408.js` 已改名 `qaNewBook.js`。`subscriptionGantt.js`（订阅 Gantt dv.view widget）已从 `个人整理/日常工具/` 归入 `utils/` 并对账重建为权威源（参数化 include/exclude/barScale）。已删：`organizeQuickCapture` 坏宏 + `任务视图-20260123` 坏链 + `editWeightField` 重复孤儿。**根因修复**：`.js` 被改名为 `<活动笔记>-<日期>.js` 是 `obsidian-paste-image-rename` 插件（`handleAllAttachments` + 空 `excludeExtensionPattern`）所致，已加排除 `js|mjs|cjs|ts|jsx|tsx|css|json|html`。`utils/` 现仅余 dataviewjs widget + Templater 函数 + `holidays/` 数据。

| 文件夹 | 文件数 | 是什么 | 关键文件 |
|---|---|---|---|
| `Templates/` | 20 | 笔记模板（嵌入 widget 的「枢纽」）| Daily/Weekly/Monthly Note、课程、电影/电视剧/综艺 等 |
| `utils/` | ~93 | dataviewjs widget(`.md`) + Templater 函数(`.js`，钉死在此) + `holidays/` 数据 + 文档（**QuickAdd 脚本已迁出**）| `tickGrid.js`、`subscriptionGantt.js`、`subscriptionTimeline.md`，见 [[_INDEX]] |
| `quickadd-scripts/` | 18 | **全部 QuickAdd 脚本**（集中地）| `tv-sync.js`、`monthlyAmountEdit.js`、`qaNewBook.js` 等 |
| `meta-bind/` | 2 | JS Engine 动作 | `addImportantDate.js` |
| `lib/` | 1 | CustomJS 共享类 | `DailyLog.js` |
| `Banners/` | 1 | banner 图定义（pretty-properties）| `banners-heidelberg.md` |
| `说明书/` | 11 | 本文档区（Obsidian 使用手册 MOC）| `说明书.md` + Dataview/Tracker/… |

## 2. 按用途分类（真正的「purpose」轴）+ 锚点

每个脚本被**什么**绑定到当前位置 = 移动时会断的东西（anchor）。

| 用途类型 | 如何被调用 | Anchor（移动成本）| 文件（跨文件夹）|
|---|---|---|---|
| **dataviewjs widget** (`.md`) | `![[name]]` 嵌入 | 短路径 basename → **移动 OK，改名断** | 全在 `utils/`（~50）|
| **QuickAdd 脚本** (`module.exports`) | QuickAdd macro | **`quickadd/data.json` 里写死完整路径** → 移动须改 data.json | **全在 `quickadd-scripts/`(19)**（2026-06-11 集中完毕）|
| **Templater 函数** (`tp.user.*`) | `tp.user.tickGrid` | **`user_scripts_folder = Helper/utils`** → 挪出 utils 即断 | `utils/tickGrid.js`（**钉死在 utils**）|
| **CustomJS 类** | `window.customJS.DailyLog` | **`jsFolder = Helper/lib`** → 钉死在 lib | `lib/DailyLog.js` |
| **JS Engine 动作** | 笔记按钮里 `engine` 调用，按路径 | 调用方笔记里的路径串 | `meta-bind/addImportantDate.js`（从 `重要日期.md`）、`quickadd-scripts/monthlyAmountEdit.js`（从 `Monthly Note.md` + 月计划，路径已同步更新）|
| **数据 / 文档** | 被读取 / 导航 | basename / MOC 链接 | `utils/holidays/`、`Banners/`、各文件夹笔记 |

## 3. 跨文件夹依赖图

```
Templates/*.md ──![[ ]]──▶ utils/*.md widgets（noteNav, genTOC, dayOfWeek, onThisDay …）
quickadd-scripts/tv-sync.js ──路径──▶ utils/tvSync.md（写回 last_sync）
utils/createDailyNoteByDate.js ──▶ Templates/Daily Note.md
utils/读书笔记-*.js ──▶ Templates/读书笔记.md
utils/dailyAdd{Book,Show},UpdateCourse.js ──window.customJS──▶ lib/DailyLog.js
utils/monthlyAmountEdit.js ◀──engine── Templates/Monthly Note.md, 年度记录/月计划/*
meta-bind/addImportantDate.js ◀──engine── 个人整理/重要日期.md
```

## 4. 位置 vs 用途 不一致（重组候选）

1. **QuickAdd 脚本散落 3 个文件夹** —— `utils/`(15) + `quickadd-scripts/`(2) + `meta-bind/`(1)。文件夹名 `quickadd-scripts` 暗示该放全部 QuickAdd 脚本，但绝大多数在 `utils/`。
2. ✅ **已修** `syncCssclassEventsToYearlyGlance.js` 错放 —— 它其实是 **QuickAdd 脚本**（绑在 `quickadd/data.json`），不是 Meta Bind 动作。已从 `meta-bind/` 移到 `quickadd-scripts/`，`data.json` 路径已同步更新。
3. **`utils/` 是大杂烩** —— widget + 脚本 + Templater 函数 + JS Engine 动作混在一起。
4. **日期戳乱名**（renamer 受害者，见 memory）：`任务视图-20260123.js`、`读书笔记-20260408.js`、`Claude Code…-20260406.js`。改名会断 QuickAdd 绑定，**不要乱改**。

## 5. 重组可行性 & 风险

| 想做的重组 | 成本 / 风险 |
|---|---|
| 把所有 QuickAdd 脚本集中到 `quickadd-scripts/` | 改 ~16 条 `data.json` 路径（**Obsidian 关闭时**改）+ rename-watcher/GDrive 风险。中等成本 |
| 把 widget(.md) 与脚本(.js) 分家 | widget 移动 OK（basename），但 **Templater 函数钉死 utils**、QuickAdd 脚本要改 data.json → 拆不干净 |
| 统一 JS Engine 动作到 `meta-bind/` | 改调用方笔记里的路径串（散在多个笔记）|

**结论**：「按执行模型彻底重组」可行但要 ~20+ 处绑定更新 + 踩 rename-watcher/GDrive，个人 vault **ROI 低**。`utils/` 的大杂烩本质是 **Templater 单一 `user_scripts_folder` 约束**的副产物——只要 Templater 函数必须在 utils，QuickAdd 脚本也倾向留在那。

## 6. 低风险即时清理（建议先做这些）

- ✅ **`2026-W18-20260502.js` 已删（2026-06-06，两份）** —— 调查确认是 `meta-bind/addImportantDate.js` 的**旧版重复**（append 到表尾、无排序；live 版按 MM-DD 排序插入，被 `重要日期.md` 调用）。仅被本文档/`_INDEX` 提及，无功能引用。
- 📁 **`syncCssclassEventsToYearlyGlance.js`** —— 若要整理，移到 `quickadd-scripts/` 并改 `quickadd/data.json` 那一条路径（1 处，Obsidian 关闭时改）。
- 📌 日期戳乱名文件：保持原样（改名断 QuickAdd），仅在 [[_INDEX]] 记录其真实用途。
