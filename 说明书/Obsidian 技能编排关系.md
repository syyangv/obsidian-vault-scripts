---
tags:
  - meta/index
created: 2026-06-11
modified_at: 2026-06-11
---

# Obsidian 技能编排关系（Claude Code skills）

> 本图描述的是 **Claude Code 里 `~/.claude/skills/obsidian-*` 技能之间**的调用/分流关系，不是 Helper 里的脚本。脚本放哪见 [[Helper 脚本地图]] §0。
> 现状：**扁平 + 两个领域锚点**，没有顶层 Obsidian router（10 个左右的兄弟技能不需要）。

```mermaid
graph TD
    subgraph ANCHORS["★ 声明的入口（领域锚点）"]
        M["★ obsidian-macros<br/>脚本 &amp; 自动化<br/>QuickAdd · MetaBind · Templater · CustomJS"]
        V["★ obsidian-visual-design<br/>CSS · 主题 · snippets<br/>（改任何 CSS 前必先调用）"]
    end

    %% 实线 = 本会话新增的「声明式路由」
    M -->|CSS / 样式| V
    M -->|社区插件| PD["obsidian-plugin-dev"]
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

- **两个实线锚点** —— `obsidian-macros`（脚本/自动化）与 `obsidian-visual-design`（CSS）。只有这两个技能**声明**了自己是入口。
- **实线箭头** = 有意的分流路由（`macros` 在 2026-06-11 加的 hand-off）。
- **虚线箭头** = 各 SKILL 正文里既有的零散互相引用，是松散的网，不是真正的编排。
- **没有顶层 Obsidian router**，这是对的：~10 个兄弟技能，两个领域锚点足够。

## 路由速查（用户请求 → 该用哪个技能）

| 请求 | 入口技能 |
|---|---|
| 加按钮 / QuickAdd 宏 / Meta Bind / 任何 vault 脚本自动化 | `obsidian-macros` |
| 改 CSS / snippet / 主题 / 视觉样式 | `obsidian-visual-design`（**改 CSS 前必先调用**） |
| 做 / fork / 部署一个社区插件 | `obsidian-plugin-dev` |
| 笔记导航组件 | `obsidian-navigation` |
| 插件更新安全 | `obsidian-update-guard` · 冲突文件 → `obsidian-conflict-cleaner` |
| `.obsidian` 配置 Mac↔iPhone 同步 | `obsidian-mobile-sync` |
| Bases / Markdown 语法 / CLI | `obsidian-bases` · `obsidian-markdown` · `obsidian-cli` |
| 新脚本放进哪个文件夹 | [[Helper 脚本地图]] §0 |
