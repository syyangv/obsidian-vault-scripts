---
modified_at: 2026-07-20
---
```dataviewjs
(async () => {
    const activeFile = app.workspace.getActiveFile();
    if (!activeFile) {
        dv.paragraph("⚠️ 无法获取当前文件");
        return;
    }

    const content = await app.vault.read(activeFile);
    const lines = content.split('\n');

    // Find # Event heading
    let eventHeadingLine = -1;
    for (let i = 0; i < lines.length; i++) {
        if (/^#+\s*(?:\d+\.?)?\s*Event\s*$/i.test(lines[i])) {
            eventHeadingLine = i;
            break;
        }
    }
    if (eventHeadingLine === -1) {
        dv.paragraph("⚠️ 找不到 Event 标题");
        return;
    }

    // Find this widget's embed line — look inside columns blocks, stop at other fences/headings
    let embedLine = -1;
    let searchInCols = false, searchColsFence = '';
    for (let i = eventHeadingLine + 1; i < lines.length; i++) {
        const t = lines[i].trim();
        const fenceMatch = t.match(/^(`{3,})(.*)/);
        if (fenceMatch) {
            if (!searchInCols) {
                if (fenceMatch[2].trim() === 'columns') {
                    searchInCols = true; searchColsFence = fenceMatch[1];
                } else {
                    break; // non-columns fence — stop searching
                }
            } else if (t.startsWith(searchColsFence)) {
                searchInCols = false; searchColsFence = '';
            }
            continue;
        }
        if (!searchInCols && /^#+\s/.test(lines[i])) break;
        if (lines[i].includes('![[eventNotes]]')) { embedLine = i; break; }
    }
    if (embedLine === -1) {
        dv.paragraph("⚠️ 找不到 eventNotes embed");
        return;
    }

    // Section boundary: === (columns separator), code fence, or heading
    let textEnd = lines.length;
    for (let i = embedLine + 1; i < lines.length; i++) {
        const t = lines[i].trim();
        if (t === '===' || /^#+\s/.test(lines[i]) || /^`{3,}/.test(t)) {
            textEnd = i;
            break;
        }
    }

    // Read from %% block if present, otherwise fall back to plain text (legacy)
    const rawRange = lines.slice(embedLine + 1, textEnd).join('\n');
    const commentMatch = rawRange.match(/%%\n([\s\S]*?)\n%%/);
    const currentText = commentMatch ? commentMatch[1].trim() : rawRange.trim();

    // UI: text textarea + save button
    const container = dv.el('div', '', { attr: { style: 'margin:4px 0 8px 0; display:flex; flex-direction:column; gap:6px;' } });

    const noteTextarea = container.createEl('textarea', {
        attr: {
            style: 'width:100%; min-height:80px; padding:8px 12px; border:1px solid var(--background-modifier-border); border-radius:6px; background:var(--background-primary); color:var(--text-normal); font-family:var(--font-interface); font-size:14px; resize:vertical; box-sizing:border-box;',
            placeholder: '今日事件...'
        }
    });
    noteTextarea.value = currentText;

    const buttonRow = container.createEl('div', { attr: { style: 'display:flex; gap:8px; align-items:center;' } });

    const saveBtn = buttonRow.createEl('button', {
        text: '💾 保存',
        attr: { style: 'padding:6px 14px; border:1px solid var(--background-modifier-border); border-radius:6px; background:var(--interactive-accent); color:var(--text-on-accent); font-size:13px; cursor:pointer; font-weight:500;' }
    });

    const status = buttonRow.createEl('span', { attr: { style: 'font-size:12px; color:var(--text-muted);' } });

    saveBtn.addEventListener('click', async () => {
        const newText = noteTextarea.value.trim();
        const file = app.vault.getAbstractFileByPath(activeFile.path);
        const fresh = await app.vault.read(file);
        const freshLines = fresh.split('\n');

        // Re-locate boundaries (=== counts as section end here too)
        let freshEmbed = -1, freshEnd = freshLines.length;
        let inEvent = false;
        for (let i = 0; i < freshLines.length; i++) {
            if (/^#+\s*(?:\d+\.?)?\s*Event\s*$/i.test(freshLines[i])) { inEvent = true; continue; }
            if (!inEvent) continue;
            if (freshEmbed === -1 && freshLines[i].includes('![[eventNotes]]')) { freshEmbed = i; continue; }
            if (freshEmbed !== -1) {
                const t = freshLines[i].trim();
                if (t === '===' || /^#+\s/.test(freshLines[i]) || /^`{3,}/.test(t)) {
                    freshEnd = i; break;
                }
            }
        }

        if (freshEmbed === -1) {
            status.textContent = '❌ 找不到位置';
            status.style.color = 'var(--text-error)';
            return;
        }

        // Find and replace %% block only; preserve other content
        let freshCommentStart = -1, freshCommentEnd = -1;
        for (let i = freshEmbed + 1; i < freshEnd; i++) {
            if (freshLines[i].trim() === '%%') {
                if (freshCommentStart === -1) freshCommentStart = i;
                else { freshCommentEnd = i; break; }
            }
        }

        let updated;
        if (freshCommentStart !== -1 && freshCommentEnd !== -1) {
            const newBlock = newText ? ['%%', ...newText.split('\n'), '%%'] : [];
            updated = [
                ...freshLines.slice(0, freshCommentStart),
                ...newBlock,
                ...freshLines.slice(freshCommentEnd + 1)
            ];
        } else {
            const newBlock = newText ? ['', '%%', ...newText.split('\n'), '%%'] : [];
            updated = [
                ...freshLines.slice(0, freshEmbed + 1),
                ...newBlock,
                ...freshLines.slice(freshEmbed + 1)
            ];
        }

        try {
            await app.vault.modify(file, updated.join('\n'));
            status.textContent = '✅ 已保存';
            status.style.color = 'var(--text-success)';
            setTimeout(() => { status.textContent = ''; }, 2000);
        } catch (e) {
            status.textContent = '❌ 保存失败';
            status.style.color = 'var(--text-error)';
            console.error(e);
        }
    });

    noteTextarea.addEventListener('input', () => {
        const hasChanges = noteTextarea.value.trim() !== currentText;
        status.textContent = hasChanges ? '● 未保存' : '';
        status.style.color = hasChanges ? 'var(--text-warning)' : '';
    });
})();
```
