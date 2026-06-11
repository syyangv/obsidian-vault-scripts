// Add a planned-leave row to 个人整理/请假计划.md
// Prompts: date (YYYY-MM-DD) -> type (PTO/病假/公共假期) -> optional note.
// Parses the | Date | Type | Note | table, dedups, re-sorts by date, writes once.
// Writing via app.vault.modify fires the plugin's vault.on("modify") watcher -> calendar refreshes.
module.exports = async (params) => {
    const { app, quickAddApi } = params;
    const PLAN_PATH = "个人整理/请假计划.md";
    const TYPES = ["PTO", "病假", "公共假期"];

    const file = app.vault.getAbstractFileByPath(PLAN_PATH);
    if (!file || file.children) { new Notice("找不到 请假计划.md"); return; }

    const fmt = (d) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    let date = await quickAddApi.inputPrompt("计划日期 (YYYY-MM-DD)", "YYYY-MM-DD", fmt(new Date()));
    if (date === null) return;
    date = String(date).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { new Notice("❌ 日期格式须为 YYYY-MM-DD"); return; }

    const type = await quickAddApi.suggester(TYPES, TYPES);
    if (type === undefined) return;

    let note = await quickAddApi.inputPrompt("备注（可选，可留空）", "", "");
    note = note === null ? "" : String(note).trim();

    const content = await app.vault.read(file);
    const lines = content.split("\n");
    const idx = lines.findIndex((l) => l.trim().startsWith("|"));
    const preamble = (idx === -1 ? lines : lines.slice(0, idx)).join("\n").replace(/\s+$/, "");

    const rows = [];
    for (const l of idx === -1 ? [] : lines.slice(idx)) {
        const inner = l.split("|").slice(1, -1).map((c) => c.trim());
        if (inner.length >= 2 && /^\d{4}-\d{2}-\d{2}$/.test(inner[0])) {
            rows.push({ date: inner[0], type: inner[1], note: inner[2] || "" });
        }
    }

    const existing = rows.find((r) => r.date === date && r.type === type);
    if (existing) {
        existing.note = note || existing.note; // update note if a new one was given
        new Notice(`ℹ️ ${date} ${type} 已存在，已更新备注`);
    } else {
        rows.push({ date, type, note });
    }
    rows.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));

    const table =
        "| Date | Type | Note |\n| --- | --- | --- |\n" +
        rows.map((r) => `| ${r.date} | ${r.type} | ${r.note} |`).join("\n");
    await app.vault.modify(file, `${preamble}\n\n${table}\n`);

    if (!existing) new Notice(`✅ 已添加计划：${date} ${type}${note ? " (" + note + ")" : ""}`);
};
