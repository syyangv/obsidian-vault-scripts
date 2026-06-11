module.exports = async (params) => {
    const { app } = params;
    const targetFolder = "Bases"; // Change this to your desired folder name

    // Find .base files anywhere in the vault EXCEPT inside the target folder
    const basesFiles = app.vault.getAllLoadedFiles()
        .filter(file =>
            file.extension === 'base' &&
            !file.path.startsWith(targetFolder + '/')
        );

    if (basesFiles.length === 0) return;

    // Move each .base file into the target folder
    for (const file of basesFiles) {
        const newPath = `${targetFolder}/${file.name}`;
        await app.fileManager.renameFile(file, newPath);
    }

    new Notice(`Moved ${basesFiles.length} .base files to ${targetFolder} folder`);
};