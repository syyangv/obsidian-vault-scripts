---
modified_at: 2026-07-19
---
```dataviewjs
const activeFile = app.workspace.getActiveFile();
if (!activeFile) {
    dv.paragraph("⚠️ 无法获取当前文件");
} else {
    // Get current value from frontmatter
    const metadata = dv.page(activeFile.path);
    const currentValue = metadata.短评 || '';

    // Create container
    const container = dv.el('div', '', {
        attr: { style: 'margin: 10px 0;' }
    });

    // Create textarea
    const textarea = container.createEl('textarea', {
        attr: {
            style: `
                width: 100%;
                min-height: 80px;
                padding: 8px 12px;
                border: 1px solid var(--background-modifier-border);
                border-radius: 6px;
                background: var(--background-primary);
                color: var(--text-normal);
                font-family: var(--font-interface);
                font-size: 14px;
                resize: vertical;
                margin-bottom: 8px;
            `,
            placeholder: '输入短评...'
        }
    });
    textarea.value = currentValue;

    // Create button container
    const buttonContainer = container.createEl('div', {
        attr: { style: 'display: flex; gap: 8px; align-items: center;' }
    });

    // Create sync button
    const syncButton = buttonContainer.createEl('button', {
        text: '💾 保存短评',
        attr: {
            style: `
                padding: 6px 14px;
                border: 1px solid var(--background-modifier-border);
                border-radius: 6px;
                background: var(--interactive-accent);
                color: var(--text-on-accent);
                font-size: 13px;
                cursor: pointer;
                font-weight: 500;
            `
        }
    });

    // Status indicator
    const status = buttonContainer.createEl('span', {
        attr: { style: 'font-size: 12px; color: var(--text-muted);' }
    });

    // Sync button click handler
    syncButton.addEventListener('click', async () => {
        const newValue = textarea.value;
        const file = app.vault.getAbstractFileByPath(activeFile.path);

        try {
            await app.fileManager.processFrontMatter(file, (fm) => {
                fm.短评 = newValue;
            });
            status.textContent = '✅ 已保存';
            status.style.color = 'var(--text-success)';
            setTimeout(() => {
                status.textContent = '';
            }, 2000);
        } catch (error) {
            status.textContent = '❌ 保存失败';
            status.style.color = 'var(--text-error)';
            console.error('Failed to save comment:', error);
        }
    });

    // Track unsaved changes
    textarea.addEventListener('input', () => {
        const hasChanges = textarea.value !== currentValue;
        if (hasChanges) {
            status.textContent = '● 未保存';
            status.style.color = 'var(--text-warning)';
        } else {
            status.textContent = '';
        }
    });
}
```
