---
modified_at: 2026-11-05
---
```dataviewjs
const file = app.workspace.getActiveFile();
if (!file) { dv.paragraph('⚠️ No active file'); return; }

// --- Toggle hide completed ---
let isHiding = (app.metadataCache.getFileCache(file)?.frontmatter?.cssclasses ?? []).includes('hide-completed-tasks');
const toggleBtn = dv.container.createEl('button', { text: isHiding ? '👁 显示完成' : '🙈 隐藏完成' });
toggleBtn.addEventListener('click', async () => {
    isHiding = !isHiding;
    toggleBtn.textContent = isHiding ? '👁 显示完成' : '🙈 隐藏完成';
    await app.fileManager.processFrontMatter(file, (fm) => {
        fm.cssclasses = fm.cssclasses ?? [];
        const idx = fm.cssclasses.indexOf('hide-completed-tasks');
        if (isHiding && idx < 0) fm.cssclasses.push('hide-completed-tasks');
        else if (!isHiding && idx >= 0) fm.cssclasses.splice(idx, 1);
    });
});

// --- Archive completed tasks ---
const archiveBtn = dv.container.createEl('button', { text: '📦 归档完成' });
archiveBtn.style.marginLeft = '8px';
archiveBtn.addEventListener('click', async () => {
    archiveBtn.disabled = true;
    archiveBtn.textContent = '归档中...';
    try {
        const content = await app.vault.read(file);
        const lines = content.split('\n');
        const toArchive = {}; // year -> string[]
        const keep = new Array(lines.length).fill(true);

        let i = 0;
        while (i < lines.length) {
            if (/^- \[(?:x|-|>)\]/.test(lines[i])) {
                const m = lines[i].match(/[✅❌] (\d{4})-\d{2}-\d{2}/);
                const year = m ? m[1] : String(new Date().getFullYear());
                if (!toArchive[year]) toArchive[year] = [];
                toArchive[year].push(lines[i]);
                keep[i] = false;
                i++;
                // include indented subtasks
                while (i < lines.length && /^[\t ]/.test(lines[i])) {
                    toArchive[year].push(lines[i]);
                    keep[i] = false;
                    i++;
                }
            } else {
                i++;
            }
        }

        if (Object.keys(toArchive).length === 0) {
            new Notice('没有完成的任务需要归档');
            return;
        }

        const noteName = file.basename;
        const sectionHeader = `# ${noteName}`;

        for (const [year, archivedLines] of Object.entries(toArchive)) {
            const yearFolder = `Archive/${year}`;
            if (!app.vault.getAbstractFileByPath('Archive')) {
                await app.vault.createFolder('Archive');
            }
            if (!app.vault.getAbstractFileByPath(yearFolder)) {
                await app.vault.createFolder(yearFolder);
            }
            const archivePath = `${yearFolder}/tasks${year}.md`;
            const archiveFile = app.vault.getAbstractFileByPath(archivePath) || app.vault.getAbstractFileByPath(`Archive/tasks${year}.md`);
            const tasksText = archivedLines.join('\n');

            if (archiveFile) {
                let existing = await app.vault.read(archiveFile);
                // Ensure file ends with newline
                if (!existing.endsWith('\n')) existing += '\n';

                const sectionPattern = new RegExp(`(\\n${sectionHeader}\\n)`);
                const match = sectionPattern.exec('\n' + existing);
                if (match) {
                    // Section exists — insert before the next # heading or end of file
                    const sectionStart = match.index + 1; // position in existing (skip leading \n we added)
                    const afterHeader = sectionStart + sectionHeader.length + 1;
                    const nextSection = existing.indexOf('\n# ', afterHeader);
                    const insertPoint = nextSection >= 0 ? nextSection + 1 : existing.length;
                    existing = existing.slice(0, insertPoint) + tasksText + '\n' + existing.slice(insertPoint);
                } else {
                    // No section yet — append it
                    existing += sectionHeader + '\n' + tasksText + '\n';
                }
                await app.vault.modify(archiveFile, existing);
            } else {
                if (!app.vault.getAbstractFileByPath('Archive')) {
                    await app.vault.createFolder('Archive');
                }
                await app.vault.create(archivePath, sectionHeader + '\n' + tasksText + '\n');
            }
        }

        await app.vault.modify(file, lines.filter((_, j) => keep[j]).join('\n'));

        const count = Object.values(toArchive).flat().filter(l => /^- \[(?:x|-|>)\]/.test(l)).length;
        new Notice(`✅ 已归档 ${count} 个完成任务`);
    } catch (e) {
        new Notice('归档失败: ' + e.message);
        console.error(e);
    } finally {
        archiveBtn.disabled = false;
        archiveBtn.textContent = '📦 归档完成';
    }
});
```
