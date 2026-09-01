---
tags:
  - meta/index
created: 2026-06-11
modified_at: 2026-07-19
---

# Obsidian 技能编排关系（Claude Code skills）

> 本图描述的是 **Claude Code 里 `~/.claude/skills/obsidian-*` 与 hooks 编排器之间**的调用/分流关系，不是 Helper 里的脚本。脚本放哪见 [[Helper 脚本地图]] §0。
> 现状：**两大功能域编排器**（`yearly-glance-calendar`、`obsidian-task-skill-orchestrator`）向下统领与拼用**基础设施锚点技能**（`obsidian-macros`=脚本、`obsidian-visual-design`=CSS、`obsidian-plugin-dev`=插件）。

```mermaid
graph TD
    subgraph FEATURE["▣ 功能域编排（向下统领基础设施技能）"]
        YG["▣ yearly-glance-calendar<br/>年度日历 + 请假/假期系统<br/>请假计划.md · 假期 frontmatter · trackHolidays · plumbob 月格"]
        TO["▣ obsidian-task-skill-orchestrator<br/>全库任务与待办系统<br/>TaskNotes · Tasks 插件 · 复选框三态 · Bases 视图 · 状态流转"]
    end
    subgraph ANCHORS["★ 基础设施入口（领域锚点）"]
        M["★ obsidian-macros<br/>脚本 &amp; 自动化<br/>QuickAdd · MetaBind · Templater · CustomJS"]
        V["★ obsidian-visual-design<br/>CSS · 主题 · snippets<br/>（改任何 CSS 前必先调用）"]
        PD["★ obsidian-plugin-dev<br/>插件开发 &amp; 配置调试<br/>TaskNotes · Tasks fork · 社区插件"]
    end

    %% 功能技能向下委派给基础设施技能（实线 = 声明式）
    YG -->|QuickAdd 脚本/widget<br/>addLeavePlanRow · trackHolidays · syncCssclass| M
    YG -->|plumbob 日历 CSS/主题| V
    YG -->|fork 插件 yearly-glance-custom| PD

    TO -->|复选框样式 / Plumbob 主题 / 三态 CSS / Badge| V
    TO -->|TaskNotes 插件配置 / Tasks 行为 / 排除规则| PD
    TO -->|QuickAdd 任务录入 / Meta Bind 状态按钮 / Dataview 脚本| M

    %% 基础设施锚点之间的声明式路由
    M -->|CSS / 样式| V
    M -->|社区插件| PD
    M -->|脚本放哪| S0["Helper 脚本地图 §0"]

    %% 虚线 = SKILL 正文里既有的零散「see also」引用
    PD -.-> V
    UG["obsidian-update-guard"] -.-> V
    MS["obsidian-mobile-sync"] -.-> PD
    V -.-> MS
    NAV["obsidian-navigation"] -.-> CLI["obsidian-cli"]
    NAV -.-> MD["obsidian-markdown"]
    NAV -.-> PD
    CC["obsidian-conflict-cleaner"] -.-> NAV
```

## 怎么读

- **功能域编排（▣）= 上层统领入口**：
  - `obsidian-task-skill-orchestrator`：统领全库任务相关的所有技能与边界约束（TaskNotes 架构、Pantry/结构化池隔离、Tasks 插件、复选框生命周期），向下编排 `visual-design`、`plugin-dev`、`macros`。
  - `yearly-glance-calendar`：年度日历、请假与假期系统，向下委派：脚本→`macros`、日历 CSS→`visual-design`、fork 插件→`plugin-dev`。
- **三大基础设施锚点（★）** —— `obsidian-macros`（脚本/自动化）、`obsidian-visual-design`（CSS/主题）、`obsidian-plugin-dev`（插件与配置）。
- **实线箭头** = 有意、声明式的分流路由与编排。
- **虚线箭头** = 各 SKILL 正文里既有的零散互相引用。

## 路由速查（用户请求 → 该用哪个技能）

| 请求 | 入口技能 |
|---|---|
| 任务管理 / TaskNotes / Tasks 插件 / 复选框生命周期 / 待办流转 / 任务看板与日历视图 | `obsidian-task-skill-orchestrator`（统领任务域，向下联动 visual-design·plugin-dev·macros） |
| 年度日历 / 请假计划 / PTO·病假·公共假期 / 假期为什么不显示 / trackHolidays / plumbob 月格 / 编辑 yearly-glance-custom fork | `yearly-glance-calendar`（功能入口，向下用 macros·visual-design·plugin-dev） |
| 加按钮 / QuickAdd 宏 / Meta Bind / 任何 vault 脚本自动化 | `obsidian-macros` |
| 改 CSS / snippet / 主题 / 视觉样式 | `obsidian-visual-design`（**改 CSS 前必先调用**） |
| 做 / fork / 部署一个社区插件 | `obsidian-plugin-dev` |
| 笔记导航组件 | `obsidian-navigation` |
| 插件更新安全 | `obsidian-update-guard` · 冲突文件 → `obsidian-conflict-cleaner` |
| `.obsidian` 配置 Mac↔iPhone 同步 | `obsidian-mobile-sync` |
| Bases / Markdown 语法 / CLI | `obsidian-bases` · `obsidian-markdown` · `obsidian-cli` |
| 新脚本放进哪个文件夹 | [[Helper 脚本地图]] §0 |

