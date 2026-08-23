// Meta Bind js action — runs via JS Engine.
// Globals: app, engine, obsidian
// Code runs directly in the async context — no return/wrapper needed.

const location = await engine.prompt.suggester({
    placeholder: "Location",
    options: [
        { label: "🌉 San Francisco (sf)", value: "sf" },
        { label: "🗼 Tokyo (tokyo)", value: "tokyo" },
        { label: "🏙️ Jersey City (jc - default)", value: "jc" },
    ],
});
if (!location) return;

const startDateInput = await engine.prompt.text({
    title: "Start Date (YYYY-MM-DD)",
    placeholder: "2026-08-22",
});
if (!startDateInput) return;

const startDate = startDateInput.trim();
if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    new obsidian.Notice("❌ Start Date must be YYYY-MM-DD (e.g. 2026-08-22)");
    return;
}

const endDateInput = await engine.prompt.text({
    title: "End Date (YYYY-MM-DD, leave blank if 1 day)",
    placeholder: startDate,
});

let endDate = (endDateInput || "").trim();
if (!endDate) {
    endDate = startDate;
} else if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    new obsidian.Notice("❌ End Date must be YYYY-MM-DD");
    return;
}

if (startDate > endDate) {
    new obsidian.Notice("❌ Start Date cannot be after End Date");
    return;
}

const noteInput = await engine.prompt.text({
    title: "Note (optional)",
    placeholder: "Trip / Vacation details",
});
const note = (noteInput || "").trim();

const filePath = "个人整理/旅行计划.md";
const file = app.vault.getAbstractFileByPath(filePath);
if (!file) {
    new obsidian.Notice("❌ 旅行计划.md not found");
    return;
}

const content = await app.vault.read(file);
const lines = content.split('\n');

// Find header and separator rows
const headerIdx = lines.findIndex(l => l.trim().startsWith('|') && /Location|Start Date|Date/i.test(l));
const sepIdx = headerIdx + 1;

if (headerIdx === -1) {
    new obsidian.Notice("❌ Could not find table in 旅行计划.md");
    return;
}

// Collect existing rows
const existingRows = [];
for (let i = sepIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length >= 3) {
        existingRows.push({
            location: cells[0],
            startDate: cells[1],
            endDate: cells[2],
            note: cells[3] || "",
        });
    }
}

// Add new trip row
existingRows.push({ location, startDate, endDate, note });

// Sort by Start Date
existingRows.sort((a, b) => a.startDate.localeCompare(b.startDate));

const headerLines = lines.slice(0, sepIdx + 1);
const newTableLines = existingRows.map(r => `| ${r.location} | ${r.startDate} | ${r.endDate} | ${r.note} |`);

const finalLines = [...headerLines, ...newTableLines];
await app.vault.modify(file, finalLines.join('\n'));
new obsidian.Notice(`✅ Added trip: ${location} (${startDate} ~ ${endDate})`);
