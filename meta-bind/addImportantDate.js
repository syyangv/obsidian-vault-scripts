// Meta Bind js action — runs via JS Engine.
// Globals: app, engine, obsidian
// Code runs directly in the async context — no return/wrapper needed.

const date = await engine.prompt.text({
    title: "Date (MM-DD)",
    placeholder: "05-01",
});
if (!date) return;

const trimmedDate = date.trim();
if (!/^\d{2}-\d{2}$/.test(trimmedDate)) {
    new obsidian.Notice("❌ Date must be MM-DD (e.g. 05-01)");
    return;
}

const label = await engine.prompt.text({
    title: "Event label",
    placeholder: "Mom's Birthday",
});
if (!label) return;

const type = await engine.prompt.suggester({
    placeholder: "Event type",
    options: [
        { label: "🎂 Birthday",    value: "birthday" },
        { label: "💍 Anniversary", value: "anniversary" },
        { label: "🏖️ Holiday",     value: "holiday" },
    ],
});
if (!type) return;

let year = "";
if (type === "anniversary") {
    year = await engine.prompt.text({
        title: "Year (optional, e.g. 2020)",
        placeholder: "2020",
    }) || "";
}

const filePath = "个人整理/重要日期.md";
const file = app.vault.getAbstractFileByPath(filePath);
if (!file) {
    new obsidian.Notice("❌ 重要日期.md not found");
    return;
}

const content = await app.vault.read(file);
const lines = content.split('\n');

// Find header and separator rows
const headerIdx = lines.findIndex(l => l.trim().startsWith('|') && /Date/i.test(l));
const sepIdx = headerIdx + 1;

// Collect existing data rows
const dataRows = [];
for (let i = sepIdx + 1; i < lines.length; i++) {
    if (lines[i].trim().startsWith('|')) dataRows.push(i);
}

if (headerIdx === -1) {
    new obsidian.Notice("❌ Could not find table in 重要日期.md");
    return;
}

const headerCells = lines[headerIdx].split('|').map(c => c.trim().toLowerCase());
const hasYearCol = headerCells.includes('year');
const newRow = hasYearCol
    ? `| ${trimmedDate} | ${year.trim()} | ${label.trim()} | ${type} |`
    : `| ${trimmedDate} | ${label.trim()} | ${type} |`;

// Insert in sorted position by MM-DD
let insertIdx = dataRows.length > 0 ? dataRows[dataRows.length - 1] + 1 : sepIdx + 1;
for (const rowIdx of dataRows) {
    const rowDate = lines[rowIdx].split('|')[1]?.trim();
    if (rowDate && trimmedDate <= rowDate) {
        insertIdx = rowIdx;
        break;
    }
}

lines.splice(insertIdx, 0, newRow);
await app.vault.modify(file, lines.join('\n'));
new obsidian.Notice(`✅ Added: ${label.trim()} (${trimmedDate})`);
