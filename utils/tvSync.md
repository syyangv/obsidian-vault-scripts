---
last_sync: 2026-06-10
modified_at: 2026-06-08
---

```dataviewjs
(async () => {
    // Use dv.current().file.path so this always references tvSync.md itself,
    // even when opened as a background tab (active: false)
    const syncFilePath = dv.current().file.path;
    const syncFile = app.vault.getAbstractFileByPath(syncFilePath);
    if (!syncFile) return;
    if (window['tv-sync-running']) return;
    window['tv-sync-running'] = true;
    window['tv-sync-done'] = false;

    const container = dv.container;

    async function runSync(fullSync = false) {
        container.empty();

        const syncMeta = dv.page(syncFilePath);
        const lastSyncRaw = syncMeta.last_sync;
        const lastSyncDate = lastSyncRaw?.toFormat ? lastSyncRaw : dv.date(String(lastSyncRaw));

        // Shows to process: has 总集数, not complete, not abandoned
        const showPages = dv.pages('"看电视"').where(p => {
            if (!p.总集数) return false;
            if (p.file.tags && p.file.tags.values && p.file.tags.values.some(t => t === '#弃剧' || t === '弃剧')) return false;
            const watched = p.看过集数 || 0;
            if (watched >= p.总集数) return false;
            return true;
        });

        // Stats for skipped shows
        const all = dv.pages('"看电视"');
        const skippedComplete = all.where(p => p.总集数 && (p.看过集数 || 0) >= p.总集数).length;
        const skippedNoTotal = all.where(p => !p.总集数).length;
        const skippedAbandoned = all.where(p => p.file.tags && p.file.tags.values && p.file.tags.values.some(t => t === '#弃剧' || t === '弃剧')).length;

        const modeLabel = fullSync ? '全量同步' : '增量同步';
        const statusEl = container.createEl('p');
        statusEl.textContent = `🔄 ${modeLabel}: 正在处理 ${showPages.length} 部剧...`;

        const updated = [];
        const upToDate = [];
        let i = 0;

        for (const show of showPages) {
            i++;
            const showName = show.file.basename ?? show.file.name?.replace(/\.md$/, '');
            statusEl.textContent = `🔄 ${modeLabel} (${i}/${showPages.length}): ${showName ?? '???'}`;

            if (!showName) {
                console.warn('TV sync: skipping page with undefined basename', show.file?.path);
                continue;
            }
            const startDate = show.开始看日期;
            if (!startDate) { upToDate.push(showName); continue; }

            // Incremental: scan from max(开始看日期, last_sync); Full: scan from 开始看日期
            let scanFrom = startDate;
            if (!fullSync && lastSyncDate && lastSyncDate > startDate) {
                scanFrom = lastSyncDate;
            }

            const dailyNotes = dv.pages('"日记"')
                .where(p => {
                    const folderMatch = p.file.folder.match(/^日记\/\d{4}$/);
                    return folderMatch && p.file.day && p.file.day >= scanFrom;
                })
                .sort(p => p.file.day, 'asc');

            let latestProgress = null;

            // Escape show name for use in regex
            const escapedName = showName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            for (const note of dailyNotes) {
                try {
                    const content = await dv.io.load(note.file.path);
                    const regex = new RegExp(
                        `##\\s+(?:\\d+(?:\\.\\d+)?\\s+)?看电视[\\s\\S]*?\\[\\[${escapedName}\\]\\].*?看过集数::\\s*(\\d+)`
                    );
                    const match = regex.exec(content);
                    if (match) {
                        latestProgress = parseInt(match[1]);
                        if (latestProgress >= show.总集数) break;
                    }
                } catch (e) {}
            }

            if (latestProgress !== null) {
                const current = Number(show.看过集数 || 0);
                if (latestProgress !== current) {
                    const showFile = app.vault.getAbstractFileByPath(show.file.path);
                    await app.fileManager.processFrontMatter(showFile, fm => {
                        fm.看过集数 = latestProgress;
                    });
                    updated.push({ name: showName, from: current, to: latestProgress, total: show.总集数 });
                } else {
                    upToDate.push(showName);
                }
            } else {
                upToDate.push(showName);
            }
        }

        // Update last_sync to today
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
        await app.fileManager.processFrontMatter(syncFile, fm => {
            fm.last_sync = todayStr;
        });

        statusEl.remove();

        // Results
        if (updated.length > 0) {
            container.createEl('p').innerHTML = `<strong>✅ 已更新 (${updated.length} 部)</strong>`;
            for (const u of updated) {
                const finished = u.to >= u.total ? ' 🎉 已完成!' : '';
                container.createEl('p', { text: `  ${u.name}: 第 ${u.from} → ${u.to} 集 / ${u.total} 集${finished}` });
            }
        } else {
            container.createEl('p', { text: '✅ 所有剧集均已同步，无需更新' });
        }

        container.createEl('p', {
            text: `— 无变化: ${upToDate.length} 部 | 已完成跳过: ${skippedComplete} 部 | 无总集数跳过: ${skippedNoTotal} 部 | 弃剧跳过: ${skippedAbandoned} 部`
        });
        container.createEl('p', { text: `上次同步: ${todayStr}` });

        if (!fullSync) {
            const btn = container.createEl('button', { text: '🔄 全量同步（从开始看日期重新扫描）' });
            btn.style.cssText = 'margin-top: 8px; padding: 4px 12px; cursor: pointer;';
            btn.addEventListener('click', async () => {
                btn.disabled = true;
                window['tv-sync-running'] = false;
                await runSync(true);
            });
        }

        // Signal completion for external scripts (e.g. QuickAdd macro)
        window['tv-sync-done'] = true;
    }

    try {
        await runSync(false);
    } catch (error) {
        console.error('TV sync error:', error);
        dv.paragraph(`❌ 同步出错: ${error.message}`);
    } finally {
        window['tv-sync-running'] = false;
    }
})();
```
