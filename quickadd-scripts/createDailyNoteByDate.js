// QuickAdd user script: create a daily note for a specific date from the Daily Note template.
// Called via: app.plugins.plugins['quickadd'].api.executeChoice('createDailyNoteByDate', { date: 'YYYY-MM-DD' })
module.exports = async (params) => {
    const { app, variables } = params;
    const dateStr = variables?.date;
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;

    const year = dateStr.slice(0, 4);
    const folderPath = `日记/${year}`;
    const fullPath = `${folderPath}/${dateStr}.md`;

    if (!app.vault.getAbstractFileByPath(folderPath)) {
        await app.vault.createFolder(folderPath);
    }

    const templateFile = app.vault.getAbstractFileByPath('Helper/Templates/Daily Note.md');
    const folder = app.vault.getAbstractFileByPath(folderPath);
    const templater = app.plugins.plugins['templater-obsidian'];

    if (templater && templateFile) {
        await templater.templater.create_new_note_from_template(templateFile, folder, dateStr, true);
    } else {
        const file = await app.vault.create(fullPath, '');
        await app.workspace.getLeaf().openFile(file);
    }
};
