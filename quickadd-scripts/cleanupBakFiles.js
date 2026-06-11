module.exports = async (params) => {
    const { app } = params;

    function isGoogleDocPlaceholderBak(fileName) {
        return fileName.endsWith('.gdoc.bak');
    }

    function findBakFiles(folder) {
        const result = { bakFiles: [], skippedGoogleDocPlaceholders: 0 };

        for (const child of folder.children) {
            if (child.children !== undefined) {
                // TFolder — recurse, skip hidden folders
                if (!child.name.startsWith('.')) {
                    const childResult = findBakFiles(child);
                    result.bakFiles.push(...childResult.bakFiles);
                    result.skippedGoogleDocPlaceholders += childResult.skippedGoogleDocPlaceholders;
                }
            } else if (child.name.endsWith('.bak')) {
                // TFile — keep Google Drive native-doc placeholders out of cleanup.
                // A `.gdoc` file is only a pointer to a Google Doc, not note content.
                if (isGoogleDocPlaceholderBak(child.name)) {
                    result.skippedGoogleDocPlaceholders += 1;
                } else {
                    result.bakFiles.push(child);
                }
            }
        }

        return result;
    }

    const root = app.vault.getRoot();
    const { bakFiles, skippedGoogleDocPlaceholders } = findBakFiles(root);

    if (bakFiles.length === 0) {
        const skippedMessage = skippedGoogleDocPlaceholders
            ? `; skipped ${skippedGoogleDocPlaceholders} .gdoc backup placeholder${skippedGoogleDocPlaceholders !== 1 ? 's' : ''}`
            : '';
        new Notice(`No .bak files found${skippedMessage}`);
        return;
    }

    for (const file of bakFiles) {
        await app.vault.delete(file);
    }

    const skippedMessage = skippedGoogleDocPlaceholders
        ? `; skipped ${skippedGoogleDocPlaceholders} .gdoc backup placeholder${skippedGoogleDocPlaceholders !== 1 ? 's' : ''}`
        : '';
    new Notice(`Deleted ${bakFiles.length} .bak file${bakFiles.length !== 1 ? 's' : ''}${skippedMessage}`);
};
