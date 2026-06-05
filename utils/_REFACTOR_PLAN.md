---
title: Helper/utils 重构实施计划
type: plan
created: 2026-06-04
status: approved
tags:
  - meta/plan
  - snippets
modified_at: 2026-06-05
---

# Helper/utils 重构实施计划 (Consolidation)

配套文档：[[_INDEX]]（分类 / 依赖 / 嵌套链 / 风险评估 / 重构机会）

## 已确认决策 Decisions
1. **删除文件 → 移到系统 trash**（可恢复），不永久删。
2. **保留 `monthlyAmount-食物.md`**（仍被 `Recipes.md` 嵌入）；不 repoint 到标签页版（标签页会把购物+电费也带进食谱笔记）。只删 0 引用的 `-购物` / `-电费`。
3. **QuickAdd `data.json` 由 Claude 在 Obsidian 关闭时手改**（避免运行中被覆盖）。

## 地面真相 Ground Truth（决定每一步）
| 约束 | 后果 |
|---|---|
| QuickAdd/Templater 脚本无 `require`/`import` | 共享代码只能靠 **CustomJS** 或 **参数化脚本** |
| QuickAdd `UserScript` 命令带 per-macro `settings:{}` | D1 的参数化通道（一脚本两 macro 不同 settings） |
| **CustomJS 未安装**（仅 templater + dataview 启用） | Phase 2 须先装并验证 |
| Templater `user_scripts_folder = Helper/utils` 会把该目录每个 `.js` 当 `tp.user.*` 加载 | **CustomJS lib 必须放在 `Helper/utils` 之外**（→ `Helper/lib/`） |
| `.obsidian/` 被 gitignore | `data.json` + CustomJS 安装**不在版本控制**内 → 手动备份 + 在 vault 笔记里记录配置 |
| `Helper/` 工作树已 dirty（无关改动：templates、habitTracker、cleanupBakFiles.js） | 逐文件 stage，**禁止 `git add -A`** |
| `monthlyAmount-食物` 被 `Recipes.md` 嵌入 | D4 只删 `-购物`+`-电费`，**保留 食物** |
| `data.json` 运行中改会被覆盖 | **关 Obsidian 后**改 + 备份 |
| Vault 在 Google Drive | 同步安静时操作；靠备份不靠时机 |
| **新 `.js` 用 Write 工具直写会被 hook 改名**为 `<当前活动笔记>-<YYYYMMDD>.js` | 所有新 vault 文件**必须先写 `/tmp/` 再用 Bash `cp` 进来**；Edit 改已有文件不受影响（已验证 toggleDayActivity.js 被改成 `2026-06-20260604.js`，已 `mv` 回） |

---

## Phase 0 — 准备 & 探针（无行为变化）
- **0.1 备份** → 复制到 `Helper/utils/_backup_20260604/`：5 个目标脚本 + `.obsidian/plugins/quickadd/data.json`。
- **0.2 测试 fixture** → 建 `日记/_scratch-test.md`（含 frontmatter + `## 读书`/`## 看电视`/`## 课程` section + `# Event` 锚）。所有手测只在此跑，绝不碰真实日记。
- **0.3 CustomJS 可达性探针（决策门）**：装 CustomJS（Obsidian UI），跑探针 QuickAdd 脚本：
  ```js
  module.exports = async () => {
    const cjs = window.customJS;
    new Notice(cjs ? "customJS OK: " + Object.keys(cjs).join(",") : "customJS NOT reachable");
  };
  ```
  **若 QuickAdd 脚本里取不到 `customJS`** → 退路：D2 改用参数化脚本，D3 保持重复。此探针必须在 Phase 2 前通过。

---

## Phase 1 — D1：合并两个 `*Section` 脚本（不依赖 CustomJS）

**1.1 新建 `Helper/utils/toggleDayActivity.js`**（靠 `params.settings` 统一 swimming+therapy）：
```js
// QuickAdd UserScript — toggle a per-day activity section + frontmatter tag/flag.
// 每个 macro 经 settings 配置: { sectionTitle, anchor, tagsCsv, flagKey }
module.exports = async (params) => {
  const { app, settings } = params;
  const sectionTitle = settings.sectionTitle;          // "# 游泳课" / "# Therapy"
  const anchor       = settings.anchor || "# Event";
  const tags         = (settings.tagsCsv || "").split(",").map(s => s.trim()).filter(Boolean);
  const flagKey      = settings.flagKey || "";          // 可选 bool fm key（仅游泳）

  const file = app.workspace.getActiveFile();
  if (!file) { new Notice("No active file"); return; }

  const fm = app.metadataCache.getFileCache(file)?.frontmatter;
  const curTags = Array.isArray(fm?.activity_tags) ? fm.activity_tags
                : fm?.activity_tags ? [fm.activity_tags] : [];
  const present = flagKey ? fm?.[flagKey] === true : tags.every(t => curTags.includes(t));

  if (present) {                                         // ---- REMOVE ----
    await app.fileManager.processFrontMatter(file, (fm) => {
      if (Array.isArray(fm.activity_tags))
        fm.activity_tags = fm.activity_tags.filter(t => !tags.includes(t));
      if (flagKey) fm[flagKey] = false;
    });
    const lines = (await app.vault.read(file)).split("\n");
    const start = lines.findIndex(l => l.trim() === sectionTitle.trim());
    if (start !== -1) {
      let end = lines.length;
      for (let i = start + 1; i < lines.length; i++) if (/^# /.test(lines[i])) { end = i; break; }
      if (lines.slice(start + 1, end).some(l => l.trim() !== "")) {
        new Notice(`${sectionTitle} removed from log — section kept (has notes)`); return;
      }
      while (end > start && lines[end - 1].trim() === "") end--;
      lines.splice(start, end - start);
      await app.vault.modify(file, lines.join("\n"));
    }
    new Notice(`${sectionTitle} removed`);
  } else {                                               // ---- ADD ----
    await app.fileManager.processFrontMatter(file, (fm) => {
      if (!fm.activity_tags) fm.activity_tags = [];
      for (const t of tags) if (!fm.activity_tags.includes(t)) fm.activity_tags.push(t);
      if (flagKey) fm[flagKey] = true;
    });
    const content = await app.vault.read(file);
    if (content.includes(`\n${sectionTitle}\n`)) { new Notice(`${sectionTitle} logged`); return; }
    const lines = content.split("\n");
    const at = lines.findIndex(l => l.trim() === anchor.trim());
    if (at === -1) { new Notice(`Could not find ${anchor} section`); return; }
    lines.splice(at, 0, sectionTitle, "", "");
    await app.vault.modify(file, lines.join("\n"));
    new Notice(`${sectionTitle} logged + section added`);
  }
};

module.exports.settings = {
  name: "Toggle Day Activity", author: "syang",
  options: {
    sectionTitle: { type: "text", defaultValue: "" },
    anchor:       { type: "text", defaultValue: "# Event" },
    tagsCsv:      { type: "text", defaultValue: "" },
    flagKey:      { type: "text", defaultValue: "" },
  },
};
```

**1.2 测试**：scratch note 上临时 macro 跑 swimming 配置、therapy 配置，验证 add→remove→add-with-notes。

**1.3 改两个 macro**（关 Obsidian 后改 `data.json`；delta）：
```jsonc
// "Add Swimming Section" 的 command:
{ "name":"toggleDayActivity", "type":"UserScript", "id":"<保留>",
  "path":"Helper/utils/toggleDayActivity.js",
  "settings": { "sectionTitle":"# 游泳课", "anchor":"# Event", "tagsCsv":"健身房", "flagKey":"activity_swimming" } }
// "Add Therapy Section" 的 command:
{ "name":"toggleDayActivity", "type":"UserScript", "id":"<保留>",
  "path":"Helper/utils/toggleDayActivity.js",
  "settings": { "sectionTitle":"# Therapy", "anchor":"# Event", "tagsCsv":"therapy", "flagKey":"" } }
```
**1.4 验证** 两个真实 macro。**1.5** 删 `addSwimmingSection.js` + `addTherapySection.js`（→ trash）；`git -C Helper add` 三个文件并 commit。**1.6** 更新 `_INDEX.md`（两行并一行）。

---

## Phase 2 — CustomJS 基座（0.3 通过后才做）
**2.1 `Helper/lib/DailyLog.js`**（放 `utils/` 之外躲开 Templater）：
```js
class DailyLog {
  formatDate(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  todayDailyPath() { const d = new Date(); const s = this.formatDate(d); return `日记/${d.getFullYear()}/${s}.md`; }
  fmHasValue(fm, key, val) { const x = fm?.[key]; return Array.isArray(x) ? x.includes(val) : x === val; }

  // Upsert "- [[selected]] prop:: value" 进 "## …keyword" section。返回 'updated'|'added'|'no-section'。
  async sectionUpsert(app, file, keyword, prop, selected, value) {
    const lines = (await app.vault.read(file)).split("\n");
    let start = lines.findIndex(l => new RegExp(`^##\\s.*${keyword}`).test(l));
    if (start === -1) return 'no-section';
    let end = lines.length;
    for (let j = start + 1; j < lines.length; j++) {
      const t = lines[j].trim();
      if (t === '===' || t === '```' || /^#{1,2} /.test(lines[j])) { end = j; break; }
    }
    const entry = `- [[${selected}]] ${prop}:: ${value}`;
    const search = `- [[${selected}]] ${prop}:: `;
    let idx = -1;
    for (let k = start + 1; k < end; k++) if (lines[k].startsWith(search)) { idx = k; break; }
    if (idx !== -1) { lines[idx] = entry; await app.vault.modify(file, lines.join("\n")); return 'updated'; }
    lines.splice(end, 0, entry); await app.vault.modify(file, lines.join("\n")); return 'added';
  }
}
```
**2.2** CustomJS 设置里注册 `Helper/lib/DailyLog.js`。**2.3** 探针确认 `customJS.DailyLog` 存在。把 CustomJS 配置记进 vault 笔记（`.obsidian` 不在 git）。

---

## Phase 3 — D2/D3：`dailyAdd*` 接到 `DailyLog`
各脚本保留独有部分（过滤 / 取值 / 目标文件解析 / show 的 FM bump），共享引擎委托出去。骨架（book）：
```js
module.exports = async (params) => {
  const { app, quickAddApi } = params;
  const { DailyLog } = window.customJS;
  // … 现有 book 过滤 + suggester + pages 提示 …
  const file = app.workspace.getActiveFile();
  if (!file) { new Notice("请先打开一个笔记"); return; }
  const r = await DailyLog.sectionUpsert(app, file, "读书", "完成页数", selected, pages);
  if (r === 'no-section') { /* book 的兜底：append 到文件末尾 */ }
  new Notice(r === 'updated' ? `✏️ 已更新: ${selected} - ${pages}页` : `✅ 已添加: ${selected} - ${pages}页`);
};
```
- **3.1 book** → 如上（保留无 section 时 append 末尾的兜底）。
- **3.2 show** → `sectionUpsert(..., "看电视", "看过集数", ...)` + 保留 `更新集数/总集数` FM bump。
- **3.3 course** → 用 `DailyLog.todayDailyPath()` 解析目标；保留 course 文件 `进度` 写入；`sectionUpsert(..., "课程", "进度", ...)`。
- **3.4 refill** → 视情况用 `fmHasValue`（低优先）。
- 顺手把全部统一成 `const`/箭头（消除 var 风格漂移）。
- **逐个 scratch 测试；逐脚本 commit**（`git -C Helper add utils/<one>.js`）。

---

## Phase 4 — D4 清理
- **4.1** 删 `monthlyAmount-购物.md`、`monthlyAmount-电费.md`（0 引用）→ trash；commit。
- **4.2** **保留** `monthlyAmount-食物.md`（`Recipes.md` 在用）。
- **4.3** 更新 `_INDEX.md` 清理 + 重构机会段落。

---

## 测试协议（每次脚本改动）
1. 备份文件。2. 只在 `日记/_scratch-test.md` 跑。3. 检查：add 路径、就地 update 路径、no-section 兜底、（toggle）remove-保留-有笔记 路径。4. 用 properties 面板确认 frontmatter 副作用（tags/flags/counts）。5. 全绿后才删旧文件 + commit。

## 回滚
- 每 phase = `Helper/` 一次 commit → `git -C Helper revert <sha>`。
- `data.json` / CustomJS 配置不在 git → 从 Phase-0 备份恢复。

## 工作量 & 顺序
| Phase | 工作量 | 风险 | 依赖 |
|---|---|---|---|
| 0 准备+探针 | 20m | — | — |
| 1 D1 | 30m | 低 | 0 |
| 2 CustomJS | 20m | 低 | 0.3 通过 |
| 3 D2/D3 | 60m | 中（动写文件脚本） | 2 |
| 4 D4 | 10m | 低 | — |

推荐顺序：**0 → 1 → 4 →（0.3 门）→ 2 → 3**。D1、D4 立即见效且不依赖 CustomJS，先做。

## 前置条件 Preconditions（执行前）
- [x] 用户关闭 Obsidian（Claude 才能安全改 `data.json`）。 ✍️ 2026-06-04
- [x] CustomJS 已装并启用（Phase 2/3 前）。 ✍️ 2026-06-04 ✅ 2026-06-05
- [ ] Google Drive 同步已静默。 ✍️ 2026-06-04
