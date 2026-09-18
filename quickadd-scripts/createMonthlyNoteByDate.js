// QuickAdd user script: create a monthly 月计划 note from the Monthly Note template.
// Called via: app.plugins.plugins['quickadd'].api.executeChoice('createMonthlyNoteByDate', { path: '年度记录/2026/月计划/2026-10.md' })
// The path is derived and validated server-side; this script never computes the month itself.
module.exports = async (params) => {
    const { app, variables } = params;
    const relPath = variables?.path;
    if (!relPath || !/^年度记录\/\d{4}\/月计划\/\d{4}-\d{2}\.md$/.test(relPath)) return;

    if (app.vault.getAbstractFileByPath(relPath)) return;   // never let Templater append " 1"

    const folderPath = relPath.slice(0, relPath.lastIndexOf('/'));
    const noteName = relPath.slice(folderPath.length + 1, -3);

    if (!app.vault.getAbstractFileByPath(folderPath)) {
        await app.vault.createFolder(folderPath);
    }

    const templateFile = app.vault.getAbstractFileByPath('Helper/Templates/Monthly Note.md');
    const folder = app.vault.getAbstractFileByPath(folderPath);
    const templater = app.plugins.plugins['templater-obsidian'];

    if (templater && templateFile) {
        await templater.templater.create_new_note_from_template(templateFile, folder, noteName, false);
    } else {
        await app.vault.create(relPath, '');
    }
};
