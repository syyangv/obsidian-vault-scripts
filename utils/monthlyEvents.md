---
modified_at: 2026-07-20
---
```dataviewjs
(async () => {
    // ===== PREVENT MULTIPLE SIMULTANEOUS EXECUTIONS =====
    const activeFile = app.workspace.getActiveFile();
    if (!activeFile) {
        dv.paragraph('⚠️ Cannot detect file');
        return;
    }

    const containerId = 'monthly-events-' + activeFile.path;

    // If already running, skip this execution
    if (window[containerId + '_running']) {
        return;
    }

    // Set debounce timeout - only execute after 500ms of inactivity
    if (window[containerId + '_timeout']) {
        clearTimeout(window[containerId + '_timeout']);
    }

    await new Promise(resolve => {
        window[containerId + '_timeout'] = setTimeout(resolve, 500);
    });

    window[containerId + '_running'] = true;

try {

    const monthlyNote = activeFile.basename;
    const match = monthlyNote.match(/^(\d{4})-(\d{2})$/);
    if (!match) {
        dv.paragraph('⚠️ Filename must be YYYY-MM format, got: ' + monthlyNote);
        return;
    }

    const year = match[1];
    const month = match[2];

    // Get all daily notes from the specified year folder
    let pages = [];
    try {
        pages = dv.pages(`"日记/${year}"`)
            .where(p => {
                const m = p?.file?.name?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                return m && m[1] === year && m[2] === month;
            });
    } catch (e) {
        console.error('Error querying pages:', e);
        return;
    }

    // Helper function to convert markdown links to HTML
    function processMarkdownLinks(text) {
        if (!text) return '';
        // Remove image embeds first (both wiki-style with optional size and markdown-style)
        text = text.replace(/!\[\[([^\|\]]+)(?:\|[^\]]+)?\]\]/g, '');
        text = text.replace(/!\[([^\]]*)\]\(([^\)]+)\)/g, '');
        // Convert regular links
        text = text.replace(/\[\[([^\|\]]+)\|([^\]]+)\]\]/g, '<a href="$1" class="internal-link">$2</a>');
        text = text.replace(/\[\[([^\]]+)\]\]/g, '<a href="$1" class="internal-link">$1</a>');
        text = text.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2">$1</a>');
        // Clean up extra whitespace
        text = text.replace(/\s+/g, ' ').trim();
        return text;
    }

    // Helper function to extract all images from text
    function extractAllImages(text) {
        if (!text) return [];
        const images = [];
        const wikiRegex = /!\[\[([^\|\]]+)(?:\|[^\]]+)?\]\]/g;
        let m;
        while ((m = wikiRegex.exec(text)) !== null) {
            images.push(m[1]);
        }
        const mdRegex = /!\[([^\]]*)\]\(([^\)]+)\)/g;
        while ((m = mdRegex.exec(text)) !== null) {
            images.push(m[2]);
        }
        return images;
    }

    // Helper function to get image URL (using cached activeFile reference)
    function getImageUrl(imagePath, sourceFile) {
        if (!imagePath) return null;

        try {
            // Handle different image path formats
            let file;

            // Try direct path
            file = app.vault.getAbstractFileByPath(imagePath);

            // Try resolving as link
            if (!file && sourceFile) {
                const linkedFile = app.metadataCache.getFirstLinkpathDest(imagePath, sourceFile.path);
                if (linkedFile) {
                    file = linkedFile;
                }
            }

            if (file) {
                return app.vault.adapter.getResourcePath(file.path);
            }
        } catch (e) {
            console.warn('Error resolving image:', imagePath, e);
        }

        return null;
    }

    // Process each page to extract events
    const events = [];

    for (let page of pages) {
        if (!page?.file?.path) continue;

        const file = app.vault.getAbstractFileByPath(page.file.path);
        if (!file) continue;

        let content = '';
        try {
            content = await app.vault.cachedRead(file);
        } catch (e) {
            console.warn('Could not read file:', page.file.path, e);
            continue;
        }

        const dayMatch = page.file.name.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!dayMatch) continue;

        const day = dayMatch[3];
        const hasHeartDay = page["今日甚好"] === true;

        const lines = content.split('\n');

        let inEventSection = false;
        let eventItems = [];
        let headingLevel = 0;
        let allImages = [];
        let inCodeBlock = false;
        let inColumnsBlock = false;
        let codeFence = '';

        for (let line of lines) {
            const eventHeadingMatch = line.match(/^(#+)\s*(\d+\.?)?\s*(事件|Event)\s*$/i);

            if (eventHeadingMatch) {
                inEventSection = true;
                headingLevel = eventHeadingMatch[1].length;
                inCodeBlock = false;
                codeFence = '';
                continue;
            }

            if (inEventSection && !inCodeBlock && line.match(/^#+\s+/)) {
                break;
            }

            if (inEventSection) {
                // Track fenced code blocks
                // columns blocks: read content (skip structural lines)
                // all other code blocks: skip entirely
                const fenceMatch = line.trim().match(/^(`{3,})(.*)/);
                if (fenceMatch) {
                    if (!inCodeBlock && !inColumnsBlock) {
                        const lang = fenceMatch[2].trim();
                        if (lang === 'columns') {
                            inColumnsBlock = true;
                        } else {
                            inCodeBlock = true;
                        }
                        codeFence = fenceMatch[1];
                    } else if (line.trim().startsWith(codeFence)) {
                        inCodeBlock = false;
                        inColumnsBlock = false;
                        codeFence = '';
                    }
                    continue;
                }

                if (inCodeBlock) continue;

                // In columns blocks: skip structural lines, pass text/images through
                if (inColumnsBlock) {
                    if (line.trim() === '===' || /^id:\s/.test(line.trim()) || /`BUTTON\[/.test(line) || /^#+\s/.test(line)) continue;
                }

                // Skip %% comment markers (text between them is still collected)
                if (line.trim() === '%%') continue;
                // Skip non-image embeds (widget refs like ![[eventNotes]]) but pass image embeds through
                if (/^!\[\[/.test(line.trim()) && !/!\[\[[^\]]*\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff?)(\|[^\]]+)?\]\]/i.test(line)) continue;

                if (line.trim() !== '') {
                    const cleaned = line.replace(/^[\s\-\*\+]+/, '').trim();
                    if (cleaned) {
                        allImages.push(...extractAllImages(cleaned));
                        eventItems.push(cleaned);
                    }
                }
            }
        }

        if (eventItems.length > 0) {
            const itemsText = eventItems.join(", ");
            const imageUrls = allImages.map(p => getImageUrl(p, activeFile)).filter(Boolean);

            // Compute textHeight and layout iteratively — converges in ≤2 passes
            // because useDoubleRow narrows the image strip, widening the text column,
            // which may lower textHeight enough to flip back to single row.
            let useDoubleRow = false;
            let textHeight = 0;
            for (let iter = 0; iter < 2; iter++) {
                const imgsPerRow = (useDoubleRow && imageUrls.length > 1)
                    ? Math.ceil(imageUrls.length / 2)
                    : imageUrls.length;
                const imgStripWidth = imageUrls.length > 0
                    ? imgsPerRow * 80 + Math.max(0, imgsPerRow - 1) * 4
                    : 0;
                const textColWidth = imgStripWidth > 0
                    ? Math.max(60, 370 - imgStripWidth - 10)
                    : 370;
                const charsPerLine = Math.max(8, Math.floor(textColWidth / 7));
                textHeight = 0;
                for (let item of eventItems) {
                    const textOnly = item
                        .replace(/!\[\[([^\|\]]+)(?:\|[^\]]+)?\]\]/g, '')
                        .replace(/!\[([^\]]*)\]\(([^\)]+)\)/g, '')
                        .replace(/\s+/g, ' ').trim();
                    if (textOnly.length > 0) {
                        textHeight += Math.max(1, Math.ceil(textOnly.length / charsPerLine)) * 20;
                    }
                }
                const next = imageUrls.length > 1 && textHeight > 80;
                if (next === useDoubleRow) break;
                useDoubleRow = next;
            }

            events.push({
                day: day,
                date: page.file.name,
                path: page.file.path,
                items: eventItems,
                length: itemsText.length,
                hasHeartDay: hasHeartDay,
                imageUrls: imageUrls,
                textHeight: textHeight,
                useDoubleRow: useDoubleRow
            });
        }
    }

    events.sort((a, b) => a.date.localeCompare(b.date));

    if (events.length === 0) {
        dv.paragraph("No events found for this month.");
        return;
    }

    // Balance by estimated visual height
    function getVisualWeight(event) {
        // Base overhead: day label, margins, padding, border
        let weight = 60;
        if (event.hasHeartDay) weight += 5;

        if (event.imageUrls.length > 0) {
            const imageRowHeight = event.useDoubleRow ? 164 : 80;
            weight += Math.max(imageRowHeight, event.textHeight);
        } else {
            weight += event.textHeight;
        }

        return weight;
    }

    // Calculate weights for all events (already sorted by date)
    const weights = events.map(e => getVisualWeight(e));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const targetWeight = totalWeight / 2;

    // Find optimal split point that keeps chronological order
    // Left: events[0..splitIndex-1], Right: events[splitIndex..end]
    let bestSplit = 1;
    let bestDiff = Infinity;

    let leftWeight = 0;
    for (let i = 0; i < events.length; i++) {
        leftWeight += weights[i];
        const rightWeight = totalWeight - leftWeight;
        const diff = Math.abs(leftWeight - rightWeight);

        // Must have at least 1 item in each column
        if (i < events.length - 1 && diff < bestDiff) {
            bestDiff = diff;
            bestSplit = i + 1;
        }
    }

    const leftColumn = events.slice(0, bestSplit);
    const rightColumn = events.slice(bestSplit);

    const h = [];
    h.push('<div style="display: grid; grid-template-columns: 1fr 3px 1fr; gap: 12px;">');

    // Left column
    h.push('<div>');
    for (let event of leftColumn) {
        const processedItems = event.items
            .map(item => processMarkdownLinks(item))
            .filter(item => item && item.trim().length > 0); // Filter out empty items
        const heartIcon = event.hasHeartDay ? '❤️ ' : '';
        const bgColor = event.hasHeartDay ? 'background: rgba(207, 255, 4, 0.4); padding: 8px; border-radius: 8px;' : '';

        h.push(`<div style="margin: 4px 0 8px 0; padding-bottom: 8px; border-bottom: 2px dashed rgba(180, 150, 220, 0.4); display: flex; gap: 10px; align-items: flex-start; ${bgColor}">`);

        if (event.imageUrls.length > 0) {
            const useDoubleRow = event.useDoubleRow;
            if (useDoubleRow) {
                const mid = Math.ceil(event.imageUrls.length / 2);
                const row1 = event.imageUrls.slice(0, mid);
                const row2 = event.imageUrls.slice(mid);
                h.push(`<div style="display: flex; flex-direction: column; gap: 4px; flex-shrink: 0;">`);
                for (let row of [row1, row2]) {
                    h.push(`<div style="display: flex; flex-direction: row; gap: 4px;">`);
                    for (let url of row) {
                        h.push(`<img src="${url}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" />`);
                    }
                    h.push(`</div>`);
                }
                h.push(`</div>`);
            } else {
                h.push(`<div style="display: flex; flex-direction: row; gap: 4px; flex-shrink: 0;">`);
                for (let url of event.imageUrls) {
                    h.push(`<img src="${url}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" />`);
                }
                h.push(`</div>`);
            }
        }

        h.push(`<div style="flex: 1; font-size: 0.9375rem; font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Source Han Sans SC', 'Segoe UI', Arial, sans-serif;">`);
        h.push(`<p style="margin: 0;"><a href="${event.date}" class="internal-link" style="color: var(--text-accent); font-weight: bold; text-decoration: none;">${heartIcon}${event.day}</a>${processedItems.length > 0 ? ' - ' : ''}${processedItems.join("<br> ")}</p>`);
        h.push(`</div>`);

        h.push(`</div>`);
    }
    h.push('</div>');

    // Middle separator
    h.push(`<div style="background: linear-gradient(to bottom,
        rgba(180, 150, 220, 0.3) 0%,
        rgba(150, 180, 220, 0.3) 25%,
        rgba(220, 180, 150, 0.3) 50%,
        rgba(150, 180, 220, 0.3) 75%,
        rgba(180, 150, 220, 0.3) 100%);
        width: 3px;
        border-radius: 2px;
        box-shadow: 0 0 8px rgba(180, 150, 220, 0.2);"></div>`);

    // Right column
    h.push('<div>');
    for (let event of rightColumn) {
        const processedItems = event.items
            .map(item => processMarkdownLinks(item))
            .filter(item => item && item.trim().length > 0); // Filter out empty items
        const heartIcon = event.hasHeartDay ? '❤️ ' : '';
        const bgColor = event.hasHeartDay ? 'background: rgba(207, 255, 4, 0.4); padding: 8px; border-radius: 8px;' : '';

        h.push(`<div style="margin: 4px 0 8px 0; padding-bottom: 8px; border-bottom: 2px dashed rgba(180, 150, 220, 0.4); display: flex; gap: 10px; align-items: flex-start; ${bgColor}">`);

        if (event.imageUrls.length > 0) {
            const useDoubleRow = event.useDoubleRow;
            if (useDoubleRow) {
                const mid = Math.ceil(event.imageUrls.length / 2);
                const row1 = event.imageUrls.slice(0, mid);
                const row2 = event.imageUrls.slice(mid);
                h.push(`<div style="display: flex; flex-direction: column; gap: 4px; flex-shrink: 0;">`);
                for (let row of [row1, row2]) {
                    h.push(`<div style="display: flex; flex-direction: row; gap: 4px;">`);
                    for (let url of row) {
                        h.push(`<img src="${url}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" />`);
                    }
                    h.push(`</div>`);
                }
                h.push(`</div>`);
            } else {
                h.push(`<div style="display: flex; flex-direction: row; gap: 4px; flex-shrink: 0;">`);
                for (let url of event.imageUrls) {
                    h.push(`<img src="${url}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" />`);
                }
                h.push(`</div>`);
            }
        }

        h.push(`<div style="flex: 1; font-size: 0.9375rem; font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Source Han Sans SC', 'Segoe UI', Arial, sans-serif;">`);
        h.push(`<p style="margin: 0;"><a href="${event.date}" class="internal-link" style="color: var(--text-accent); font-weight: bold; text-decoration: none;">${heartIcon}${event.day}</a>${processedItems.length > 0 ? ' - ' : ''}${processedItems.join("<br> ")}</p>`);
        h.push(`</div>`);

        h.push(`</div>`);
    }
    h.push('</div>');

    h.push('</div>');

    dv.paragraph(h.join(''));

} catch (error) {
    console.error('Events Error:', error);
    dv.paragraph('⚠️ Error: ' + error.message);
} finally {
    // Always clear running flag
    window[containerId + '_running'] = false;
}
})();
```
