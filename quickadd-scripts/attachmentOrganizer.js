module.exports = async (params) => {
    const { app } = params;

    // Define target folders and file extensions
    const imageFolder = "Attachments";
    const pdfFolder = "Attachments/pdf";
    const diaryFolder = "日记";
    const diaryAttachmentFolder = "Attachments/日记";
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'mov'];
    const pdfExtension = 'pdf';

    // Media content folders/notes mapping.
    // source can be a folder path (matches all notes inside) or a note path without .md extension (matches that single note).
    const mediaFolders = [
        { source: "知识库/读书笔记", target: "Attachments/cover/书", types: null },
        { source: "看电视", target: "Attachments/cover/电视剧", types: ["电视剧"] },
        { source: "看电视", target: "Attachments/cover/剧场", types: ["剧场"] },
        { source: "看电视", target: "Attachments/cover/电影", types: ["电影"] },
        { source: "Hobbies/Musical", target: "Attachments/cover/剧场", types: null },
        { source: "知识库/编程工具箱/设计", target: "Attachments/设计", types: null }
    ];

    // Get all files
    const allFiles = app.vault.getAllLoadedFiles()
        .filter(file => file.extension); // Only files with extensions

    // Separate image and PDF files
    const imageFiles = allFiles.filter(file =>
        imageExtensions.includes(file.extension.toLowerCase())
    );
    const pdfFiles = allFiles.filter(file =>
        file.extension.toLowerCase() === pdfExtension
    );

    // ===== Build map of images referenced in daily notes =====
    const imageToYearMap = new Map(); // Maps image filename to year

    // Get all daily notes
    const dailyNotes = app.vault.getMarkdownFiles()
        .filter(file => file.path.startsWith(diaryFolder + '/'));

    for (const note of dailyNotes) {
        // Extract year from path (日记/YYYY/...)
        const yearMatch = note.path.match(/日记\/(\d{4})\//);
        if (!yearMatch) continue;

        const year = yearMatch[1];

        // Read note content
        try {
            const content = await app.vault.read(note);

            // Find all image references: ![[image.jpg]] or ![[image.jpg|300]]
            const wikiImageRegex = /!\[\[([^\|\]]+)(?:\|[^\]]+)?\]\]/g;
            let match;

            while ((match = wikiImageRegex.exec(content)) !== null) {
                const imageName = match[1];

                // Extract just filename if it includes path
                const filename = imageName.includes('/') ? imageName.split('/').pop() : imageName;

                // Map this image to this year (only if not already mapped)
                if (!imageToYearMap.has(filename)) {
                    imageToYearMap.set(filename, year);
                }
            }

            // Also find markdown-style images: ![](image.jpg)
            const markdownImageRegex = /!\[([^\]]*)\]\(([^\)]+)\)/g;
            while ((match = markdownImageRegex.exec(content)) !== null) {
                const imagePath = match[2];
                const filename = imagePath.includes('/') ? imagePath.split('/').pop() : imagePath;

                if (!imageToYearMap.has(filename)) {
                    imageToYearMap.set(filename, year);
                }
            }
        } catch (error) {
            console.warn(`Failed to read note ${note.path}:`, error);
        }
    }

    // ===== Build map of images referenced in media content folders =====
    const imageToMediaMap = new Map(); // Maps image filename to target folder

    for (const mediaFolder of mediaFolders) {
        const mediaNotes = app.vault.getMarkdownFiles()
            .filter(file =>
                file.path.startsWith(mediaFolder.source + '/') ||
                file.path === mediaFolder.source + '.md'
            );

        for (const note of mediaNotes) {
            try {
                const content = await app.vault.read(note);
                const cache = app.metadataCache.getFileCache(note);

                // For 看电视 folder, check if the note matches the required type
                if (mediaFolder.types && cache?.frontmatter?.种类) {
                    const noteTypes = Array.isArray(cache.frontmatter.种类)
                        ? cache.frontmatter.种类
                        : [cache.frontmatter.种类];

                    const hasMatchingType = mediaFolder.types.some(type =>
                        noteTypes.some(noteType => String(noteType).includes(type))
                    );

                    if (!hasMatchingType) {
                        continue; // Skip this note if it doesn't match the type
                    }
                }

                // Check all frontmatter fields for image references
                if (cache?.frontmatter) {
                    for (const [key, value] of Object.entries(cache.frontmatter)) {
                        if (typeof value === 'string') {
                            // Strip quotes and wikilink syntax [[...]]
                            let cleanValue = value.trim();
                            cleanValue = cleanValue.replace(/^["']|["']$/g, ''); // Remove surrounding quotes
                            cleanValue = cleanValue.replace(/^\[\[|\]\]$/g, ''); // Remove wikilink brackets
                            cleanValue = cleanValue.split('|')[0].trim(); // Strip alias/scaling e.g. |300

                            // Check if the value looks like an image file
                            const lowerValue = cleanValue.toLowerCase();
                            if (imageExtensions.some(ext => lowerValue.endsWith('.' + ext))) {
                                const filename = cleanValue.includes('/') ? cleanValue.split('/').pop() : cleanValue;
                                if (!imageToMediaMap.has(filename)) {
                                    imageToMediaMap.set(filename, mediaFolder.target);
                                }
                            }
                        } else if (Array.isArray(value)) {
                            // Handle array values (e.g., multiple images)
                            for (const item of value) {
                                if (typeof item === 'string') {
                                    // Strip quotes and wikilink syntax
                                    let cleanItem = item.trim();
                                    cleanItem = cleanItem.replace(/^["']|["']$/g, '');
                                    cleanItem = cleanItem.replace(/^\[\[|\]\]$/g, '');
                                    cleanItem = cleanItem.split('|')[0].trim(); // Strip alias/scaling e.g. |300

                                    const lowerItem = cleanItem.toLowerCase();
                                    if (imageExtensions.some(ext => lowerItem.endsWith('.' + ext))) {
                                        const filename = cleanItem.includes('/') ? cleanItem.split('/').pop() : cleanItem;
                                        if (!imageToMediaMap.has(filename)) {
                                            imageToMediaMap.set(filename, mediaFolder.target);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Find all wikilink image references: ![[...]]
                const wikiImageRegex = /!\[\[([^\|\]]+)(?:\|[^\]]+)?\]\]/g;
                let match;

                while ((match = wikiImageRegex.exec(content)) !== null) {
                    const imageName = match[1];
                    const filename = imageName.includes('/') ? imageName.split('/').pop() : imageName;

                    if (!imageToMediaMap.has(filename)) {
                        imageToMediaMap.set(filename, mediaFolder.target);
                    }
                }

                // Find markdown-style images: ![](...)
                const markdownImageRegex = /!\[([^\]]*)\]\(([^\)]+)\)/g;
                while ((match = markdownImageRegex.exec(content)) !== null) {
                    const imagePath = match[2];
                    const filename = imagePath.includes('/') ? imagePath.split('/').pop() : imagePath;

                    if (!imageToMediaMap.has(filename)) {
                        imageToMediaMap.set(filename, mediaFolder.target);
                    }
                }

                // Find HTML img tags: <img src=...>
                const htmlImageRegex = /<img[^>]+src\s*=\s*["']?([^"'>]+)["']?[^>]*>/gi;
                while ((match = htmlImageRegex.exec(content)) !== null) {
                    const imagePath = match[1];
                    const filename = imagePath.includes('/') ? imagePath.split('/').pop() : imagePath;

                    if (!imageToMediaMap.has(filename)) {
                        imageToMediaMap.set(filename, mediaFolder.target);
                    }
                }
            } catch (error) {
                console.warn(`Failed to read note ${note.path}:`, error);
            }
        }
    }

    // ===== Build comprehensive set of all filenames referenced anywhere in the vault =====
    const allReferencedFilenames = new Set();

    for (const note of app.vault.getMarkdownFiles()) {
        try {
            const content = await app.vault.read(note);
            const cache = app.metadataCache.getFileCache(note);
            let match;

            // Wikilinks: [[file]] and ![[file]], with optional alias/heading
            const wikiRegex = /!?\[\[([^\|\]#]+)(?:[|#][^\]]+)?\]\]/g;
            while ((match = wikiRegex.exec(content)) !== null) {
                const ref = match[1].trim();
                allReferencedFilenames.add(ref.includes('/') ? ref.split('/').pop() : ref);
            }

            // Markdown images: ![alt](path)
            const mdImgRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
            while ((match = mdImgRegex.exec(content)) !== null) {
                const ref = match[1].trim();
                allReferencedFilenames.add(ref.includes('/') ? ref.split('/').pop() : ref);
            }

            // HTML img tags: <img src="...">
            const htmlImgRegex = /<img[^>]+src=["']?([^"'\s>]+)/gi;
            while ((match = htmlImgRegex.exec(content)) !== null) {
                const ref = match[1];
                allReferencedFilenames.add(ref.includes('/') ? ref.split('/').pop() : ref);
            }

            // Frontmatter values (covers book/tv cover images stored as properties)
            if (cache?.frontmatter) {
                for (const value of Object.values(cache.frontmatter)) {
                    const vals = Array.isArray(value) ? value : [value];
                    for (const v of vals) {
                        if (typeof v === 'string') {
                            let clean = v.trim().replace(/^["']|["']$/g, '').replace(/^\[\[|\]\]$/g, '');
                            clean = clean.split('|')[0].trim(); // strip alias/scaling e.g. |300
                            allReferencedFilenames.add(clean.includes('/') ? clean.split('/').pop() : clean);
                        }
                    }
                }
            }
        } catch (e) {
            console.warn(`Reference scan failed for ${note.path}:`, e);
        }
    }

    // Scan canvas files — nodes with type "file" reference vault files
    for (const cf of app.vault.getAllLoadedFiles().filter(f => f.extension === 'canvas')) {
        try {
            const data = JSON.parse(await app.vault.read(cf));
            for (const node of data.nodes || []) {
                if (node.file) {
                    allReferencedFilenames.add(node.file.includes('/') ? node.file.split('/').pop() : node.file);
                }
            }
        } catch (e) { /* malformed canvas, skip */ }
    }

    // Create base folders if they don't exist
    if (!app.vault.getAbstractFileByPath(imageFolder)) {
        await app.vault.createFolder(imageFolder);
    }
    if (!app.vault.getAbstractFileByPath(pdfFolder)) {
        await app.vault.createFolder(pdfFolder);
    }
    if (!app.vault.getAbstractFileByPath(diaryAttachmentFolder)) {
        await app.vault.createFolder(diaryAttachmentFolder);
    }

    // Create media cover folders if they don't exist
    for (const mediaFolder of mediaFolders) {
        if (!app.vault.getAbstractFileByPath(mediaFolder.target)) {
            await app.vault.createFolder(mediaFolder.target);
        }
    }

    // Move image files
    let movedImageCount = 0;
    let movedDiaryImageCount = 0;
    let movedMediaImageCount = 0;
    let skippedCount = 0;

    console.log(`Total images found: ${imageFiles.length}`);
    console.log(`Media image map size: ${imageToMediaMap.size}`);
    console.log(`Diary image map size: ${imageToYearMap.size}`);

    // Log some sample entries from the maps for debugging
    if (imageToMediaMap.size > 0) {
        console.log('Sample media map entries:', Array.from(imageToMediaMap.entries()).slice(0, 5));
    }
    if (imageToYearMap.size > 0) {
        console.log('Sample diary map entries:', Array.from(imageToYearMap.entries()).slice(0, 5));
    }

    for (const file of imageFiles) {
        // Priority 1: Check if this image is referenced in a media content folder
        const mediaTarget = imageToMediaMap.get(file.name);

        if (mediaTarget) {
            // Skip if already in the correct media folder
            if (file.path.startsWith(`${mediaTarget}/`)) {
                console.log(`Skipping ${file.name}: already in correct location ${mediaTarget}`);
                skippedCount++;
                continue;
            }

            const newPath = `${mediaTarget}/${file.name}`;

            // Check if target file already exists
            const existingFile = app.vault.getAbstractFileByPath(newPath);
            if (existingFile) {
                console.warn(`Target file already exists: ${newPath}, skipping ${file.path}`);
                skippedCount++;
                continue;
            }

            try {
                console.log(`Moving media image: ${file.path} -> ${newPath}`);
                await app.fileManager.renameFile(file, newPath);
                movedMediaImageCount++;
            } catch (error) {
                console.error(`Failed to move ${file.name} to ${newPath}:`, error);
            }
            continue;
        }

        // Priority 2: Check if this image is referenced in a daily note
        const year = imageToYearMap.get(file.name);

        if (year) {
            console.log(`Found diary image ${file.name} for year ${year}, current path: ${file.path}`);
            // Move to year-specific diary attachments folder
            const yearFolder = `${diaryAttachmentFolder}/${year}`;

            // Skip if already in the correct diary year folder
            if (file.path.startsWith(`${yearFolder}/`)) {
                continue;
            }

            // Create year folder if it doesn't exist
            if (!app.vault.getAbstractFileByPath(yearFolder)) {
                await app.vault.createFolder(yearFolder);
            }

            const newPath = `${yearFolder}/${file.name}`;
            try {
                await app.fileManager.renameFile(file, newPath);
                movedDiaryImageCount++;
            } catch (error) {
                console.error(`Failed to move ${file.name} to ${newPath}:`, error);
            }
        } else {
            // Move to general Attachments folder (but skip if already there and not in special subfolders)
            if (file.path.startsWith(imageFolder + '/') &&
                !file.path.startsWith(diaryAttachmentFolder + '/') &&
                !mediaFolders.some(mf => file.path.startsWith(mf.target + '/'))) {
                console.log(`Skipping ${file.name}: already in general Attachments folder at ${file.path}`);
                continue;
            }

            console.log(`Moving unmatched image ${file.name} from ${file.path} to general Attachments folder`);
            const newPath = `${imageFolder}/${file.name}`;
            try {
                await app.fileManager.renameFile(file, newPath);
                movedImageCount++;
            } catch (error) {
                console.error(`Failed to move ${file.name}:`, error);
            }
        }
    }

    // Move PDF files
    let movedPdfCount = 0;
    for (const file of pdfFiles) {
        if (!file.path.startsWith(pdfFolder + '/')) {
            const newPath = `${pdfFolder}/${file.name}`;
            try {
                await app.fileManager.renameFile(file, newPath);
                movedPdfCount++;
            } catch (error) {
                console.error(`Failed to move ${file.name}:`, error);
            }
        }
    }

    // ===== Remove any folder notes auto-created inside Attachments =====
    // Folder Notes plugin may create .md files when folders are created; attachment folders are media-only.
    for (const note of app.vault.getMarkdownFiles().filter(f => f.path.startsWith(imageFolder + '/'))) {
        try {
            console.log(`Removing folder note from attachments: ${note.path}`);
            await app.vault.trash(note, true);
        } catch (e) {
            console.error(`Failed to remove folder note ${note.path}:`, e);
        }
    }

    // ===== Trash unreferenced attachments =====
    // Run after all moves so files are in their final locations
    const attachmentExtensions = new Set([...imageExtensions, pdfExtension]);
    const unreferencedFiles = app.vault.getAllLoadedFiles().filter(f =>
        f.extension &&
        f.path.startsWith(imageFolder + '/') &&
        attachmentExtensions.has(f.extension.toLowerCase()) &&
        !allReferencedFilenames.has(f.name)
    );

    let deletedCount = 0;
    for (const file of unreferencedFiles) {
        try {
            console.log(`Trashing unreferenced attachment: ${file.path}`);
            await app.vault.trash(file, true);
            deletedCount++;
        } catch (e) {
            console.error(`Failed to trash ${file.path}:`, e);
        }
    }

    // Show notification
    new Notice(`Moved ${movedImageCount} general images, ${movedDiaryImageCount} diary images, ${movedMediaImageCount} media covers, and ${movedPdfCount} PDFs\nTrashed ${deletedCount} unreferenced attachments`);
};