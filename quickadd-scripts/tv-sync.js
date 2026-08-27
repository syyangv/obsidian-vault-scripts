module.exports = async (params) => {
    const { app } = params;

    const dv = app.plugins.plugins['dataview']?.api;
    if (!dv) {
        new Notice('❌ Dataview plugin not found');
        return;
    }

    const SYNC_FILE_PATH = 'Helper/utils/tvSync.md';
    const DAILY_FOLDER = '"日记"';

    const toNumber = (value, fallback = 0) => {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    };

    const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const formatDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    // Scan a rolling 5-day window so recent backfilled/deleted daily-note edits are
    // picked up without rescanning older daily notes on every sync.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fiveDayCutoff = new Date(today);
    fiveDayCutoff.setDate(fiveDayCutoff.getDate() - 5);
    const cutoffDate = dv.date(formatDate(fiveDayCutoff));

    // Pre-read daily notes in the 5-day window once into memory so scanning shows/books is instant
    const allDailyNotes = dv.pages(DAILY_FOLDER)
        .where(p => p.file.folder.match(/^日记\/\d{4}$/) && p.file.day && p.file.day >= cutoffDate)
        .sort(p => p.file.day, 'asc')
        .array();

    const noteCache = [];
    for (const note of allDailyNotes) {
        const noteFile = app.vault.getAbstractFileByPath(note.file.path);
        if (!noteFile) continue;
        const content = await app.vault.read(noteFile);
        noteCache.push({ day: note.file.day, content });
    }

    const findLatestProgress = ({ name, startDate, field }) => {
        if (!startDate) return null;
        const scanFrom = startDate > cutoffDate ? startDate : cutoffDate;
        const escapedName = escapeRegex(name);
        const escapedField = escapeRegex(field);
        const regex = new RegExp(`##\\s+(?:\\d+(?:\\.\\d+)?\\s+)?(?:读书|[^\\n]*)[\\s\\S]*?\\[\\[(?:[^\\]\\|]+\\|)?${escapedName}\\]\\].*?${escapedField}::\\s*(\\d+)`);
        let latestProgress = null;

        for (const note of noteCache) {
            if (note.day < scanFrom) continue;
            const match = regex.exec(note.content);
            if (match) latestProgress = parseInt(match[1], 10);
        }

        return latestProgress;
    };

    // Include completed shows: a deleted or corrected daily entry can require a
    // rollback (for example, 7 -> 4), so completion is not a reason to skip sync.
    const showPages = dv.pages('"看电视"').where(p => {
        if (!p.总集数) return false;
        if (p.file.tags?.values?.some(t => t === '#弃剧' || t === '弃剧')) return false;
        return true;
    }).array();

    const bookPages = dv.pages('"知识库/读书笔记"').where(p => {
        const status = p.status;
        const isReading = Array.isArray(status?.values)
            ? status.values.includes('在看')
            : Array.isArray(status)
                ? status.includes('在看')
                : status === '在看';
        if (!isReading) return false;
        if (!p.开始日期) return false;
        if (p.totalPage && toNumber(p.完成页数) >= toNumber(p.totalPage)) return false;
        return true;
    }).array();

    const notice = new Notice(`🔄 同步进度中... (TV 0/${showPages.length}, 书 0/${bookPages.length})`, 0);
    const updatedShows = [];
    const updatedBooks = [];
    const upToDate = [];

    let i = 0;
    for (const show of showPages) {
        i++;
        const showName = show.file.basename ?? show.file.name?.replace(/\.md$/, '');
        if (!showName) {
            console.warn('TV sync: skipping page with undefined basename', show.file?.path);
            continue;
        }

        notice.setMessage(`🔄 同步 TV (${i}/${showPages.length}): ${showName}`);

        const latestProgress = await findLatestProgress({
            name: showName,
            startDate: show.开始看日期,
            field: '看过集数',
        });

        if (latestProgress === null) {
            upToDate.push(showName);
            continue;
        }

        const current = toNumber(show.看过集数);
        if (latestProgress !== current) {
            const showFile = app.vault.getAbstractFileByPath(show.file.path);
            await app.fileManager.processFrontMatter(showFile, fm => {
                fm.看过集数 = latestProgress;
            });
            updatedShows.push({ name: showName, from: current, to: latestProgress, total: show.总集数 });
        } else {
            upToDate.push(showName);
        }
    }

    i = 0;
    for (const book of bookPages) {
        i++;
        const bookName = book.file.basename ?? book.file.name?.replace(/\.md$/, '');
        if (!bookName) {
            console.warn('Book sync: skipping page with undefined basename', book.file?.path);
            continue;
        }

        notice.setMessage(`🔄 同步读书 (${i}/${bookPages.length}): ${bookName}`);

        const latestProgress = await findLatestProgress({
            name: bookName,
            startDate: book.开始日期,
            field: '完成页数',
        });

        if (latestProgress === null) {
            upToDate.push(bookName);
            continue;
        }

        const current = toNumber(book.完成页数);
        if (latestProgress !== current) {
            const bookFile = app.vault.getAbstractFileByPath(book.file.path);
            await app.fileManager.processFrontMatter(bookFile, fm => {
                fm.完成页数 = latestProgress;
            });
            updatedBooks.push({ name: bookName, from: current, to: latestProgress, total: book.totalPage || '?' });
        } else {
            upToDate.push(bookName);
        }
    }

    const todayStr = formatDate(today);
    const syncFile = app.vault.getAbstractFileByPath(SYNC_FILE_PATH);
    if (syncFile) {
        await app.fileManager.processFrontMatter(syncFile, fm => {
            fm.last_sync = todayStr;
        });
    }

    notice.hide();

    const updated = [...updatedShows.map(u => ({ ...u, kind: '📺', unit: '集' })), ...updatedBooks.map(u => ({ ...u, kind: '📖', unit: '页' }))];
    if (updated.length > 0) {
        const lines = updated.map(u => {
            const finished = u.total !== '?' && u.to >= u.total ? ' 🎉' : '';
            return `${u.kind} ${u.name}: ${u.from} → ${u.to} / ${u.total} ${u.unit}${finished}`;
        }).join('\n');
        new Notice(`✅ 已更新 ${updated.length} 项:\n${lines}`, 10000);
    } else {
        new Notice(`✅ 无需更新 (共 ${upToDate.length} 项已同步)`, 5000);
    }
};
