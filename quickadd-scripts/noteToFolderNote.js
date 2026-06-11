module.exports = async (params) => {
    const { app } = params;

    const file = app.workspace.getActiveFile();
    if (!file) {
        new Notice('No active file');
        return;
    }

    const fileName = file.basename;
    const parentPath = file.parent?.path || '';
    const newFolderPath = parentPath ? `${parentPath}/${fileName}` : fileName;
    const newFilePath = `${newFolderPath}/${fileName}.md`;

    // Check if folder already exists
    const existingFolder = app.vault.getAbstractFileByPath(newFolderPath);
    if (existingFolder) {
        new Notice(`Folder "${fileName}" already exists`);
        return;
    }

    try {
        // Read content first
        const content = await app.vault.read(file);
        const oldPath = file.path;

        // Create the new folder
        await app.vault.createFolder(newFolderPath);

        // Create new file with content
        await app.vault.create(newFilePath, content);

        // Delete old file
        const oldFile = app.vault.getAbstractFileByPath(oldPath);
        if (oldFile) {
            await app.vault.delete(oldFile);
        }

        // Open the new file
        const newFile = app.vault.getAbstractFileByPath(newFilePath);
        if (newFile) {
            await app.workspace.getLeaf().openFile(newFile);
        }

        new Notice(`Created folder note: ${newFolderPath}`);
    } catch (error) {
        new Notice(`Error: ${error.message}`);
    }
};
