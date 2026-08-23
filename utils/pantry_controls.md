---
modified_at: 2026-07-20
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

        const sectionHeader = `# ${file.basename}`;

        for (const [year, archivedLines] of Object.entries(toArchive)) {
            const archivePath = `Archive/pantry${year}.md`;
            const archiveFile = app.vault.getAbstractFileByPath(archivePath);
            const tasksText = archivedLines.join('\n');

            if (archiveFile) {
                let existing = await app.vault.read(archiveFile);
                if (!existing.endsWith('\n')) existing += '\n';

                const sectionPattern = new RegExp(`(\\n${sectionHeader}\\n)`);
                const match = sectionPattern.exec('\n' + existing);
                if (match) {
                    const sectionStart = match.index + 1;
                    const afterHeader = sectionStart + sectionHeader.length + 1;
                    const nextSection = existing.indexOf('\n# ', afterHeader);
                    const insertPoint = nextSection >= 0 ? nextSection + 1 : existing.length;
                    existing = existing.slice(0, insertPoint) + tasksText + '\n' + existing.slice(insertPoint);
                } else {
                    existing += sectionHeader + '\n' + tasksText + '\n';
                }
                await app.vault.modify(archiveFile, existing);
            } else {
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

// --- Sort tasks by start date ---
const sortBtn = dv.container.createEl('button', { text: '🔃 按日期排序' });
sortBtn.style.marginLeft = '8px';
sortBtn.addEventListener('click', async () => {
    sortBtn.disabled = true;
    sortBtn.textContent = '排序中...';
    try {
        const content = await app.vault.read(file);
        const lines = content.split('\n');

        function getStartDate(line) {
            const m = line.match(/🛫 (\d{4}-\d{2}-\d{2})/);
            return m ? m[1] : '9999-99-99'; // no date → sort to end
        }

        const result = [];
        let i = 0;
        let inCodeBlock = false;

        while (i < lines.length) {
            const line = lines[i];

            // Track code blocks — never sort inside them
            if (/^```/.test(line)) {
                inCodeBlock = !inCodeBlock;
                result.push(line);
                i++;
                continue;
            }
            if (inCodeBlock) {
                result.push(line);
                i++;
                continue;
            }

            // Collect a consecutive run of top-level tasks (each with indented children)
            if (/^- \[/.test(line)) {
                const groups = [];
                while (i < lines.length && /^- \[/.test(lines[i])) {
                    const group = [lines[i++]];
                    while (i < lines.length && /^[\t ]/.test(lines[i])) {
                        group.push(lines[i++]);
                    }
                    groups.push(group);
                }
                groups.sort((a, b) => getStartDate(a[0]).localeCompare(getStartDate(b[0])));
                for (const g of groups) for (const l of g) result.push(l);
            } else {
                result.push(line);
                i++;
            }
        }

        await app.vault.modify(file, result.join('\n'));
        new Notice('✅ 已按开始日期排序');
    } catch (e) {
        new Notice('排序失败: ' + e.message);
        console.error(e);
    } finally {
        sortBtn.disabled = false;
        sortBtn.textContent = '🔃 按日期排序';
    }
});

// --- Show age for Pantry tasks ---

// Walk up from a task element through list nesting to the first el-* block div,
// then scan backward for the nearest heading — used to detect section (冷藏 vs 冷冻).
function getPantryTaskSection(taskEl) {
    let node = taskEl;
    while (node && !node.className?.startsWith?.('el-')) {
        node = node.parentElement;
    }
    if (!node) return '';
    let sib = node.previousElementSibling;
    while (sib) {
        const h = sib.querySelector('h1,h2,h3,h4,h5,h6');
        if (h) return h.textContent || '';
        sib = sib.previousElementSibling;
    }
    return '';
}

function installPantryTaskAgeBadges() {
    if (file.path !== 'Logistics/库存/Pantry.md') return;

    const styleId = 'pantry-task-age-style';
    const existing = document.getElementById(styleId);
    if (existing) existing.remove();
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        .pantry-task-age {
            display: inline-flex;
            align-items: center;
            margin: 0 0.5em 0 0;
            padding: 0 0.45em;
            border-radius: 999px;
            font-size: 0.78em;
            font-weight: 700;
            line-height: 1.45;
            white-space: nowrap;
        }
        .pantry-task-age.age-green {
            color: #2f7d45 !important;
            background: #dff5e6 !important;
            border: 1px solid #9bd8aa !important;
        }
        .pantry-task-age.age-yellow {
            color: #8a6a00 !important;
            background: #fff1b8 !important;
            border: 1px solid #e3c957 !important;
        }
        .pantry-task-age.age-red {
            color: #9b2f2f !important;
            background: #ffd9d9 !important;
            border: 1px solid #e39a9a !important;
        }
        .pantry-task-age.is-ended {
            opacity: 0.72;
        }
    `;
    document.head.appendChild(style);

    const today = window.moment().startOf('day');

    // Scope to the active leaf only — using `document` also picks up tasks from
    // other open panes, which caused double-badging when the same note was open
    // in more than one leaf.
    const activeRoot = app.workspace.activeLeaf?.view?.containerEl ?? document;

    activeRoot.querySelectorAll('.task-list-item').forEach((taskEl) => {
        // data attribute guard is O(1) and survives nested-element confusion
        if (taskEl.dataset.pantryBadged) return;

        const text = taskEl.innerText ?? '';
        const createdMatch = text.match(/➕\s*(\d{4}-\d{2}-\d{2})/);
        if (!createdMatch) return;

        const created = window.moment(createdMatch[1], 'YYYY-MM-DD').startOf('day');
        if (!created.isValid()) return;

        const endedMatch = text.match(/[✅❌]\s*(\d{4}-\d{2}-\d{2})/);
        const ended = endedMatch ? window.moment(endedMatch[1], 'YYYY-MM-DD').startOf('day') : null;
        const end = ended?.isValid() ? ended : today;
        const days = Math.max(0, end.diff(created, 'days'));

        // Frozen items stay good much longer — use a wider colour band.
        const section = getPantryTaskSection(taskEl);
        const isFrozen = section.includes('冷冻');
        let ageClass;
        if (isFrozen) {
            ageClass = days <= 14 ? 'age-green' : days <= 30 ? 'age-yellow' : 'age-red';
        } else {
            ageClass = days <= 4 ? 'age-green' : days <= 7 ? 'age-yellow' : 'age-red';
        }

        const ageColors = {
            'age-green': { color: '#2f7d45', background: '#dff5e6', border: '#9bd8aa' },
            'age-yellow': { color: '#8a6a00', background: '#fff1b8', border: '#e3c957' },
            'age-red': { color: '#9b2f2f', background: '#ffd9d9', border: '#e39a9a' }
        };
        const badge = document.createElement('span');
        badge.className = `pantry-task-age ${ageClass}` + (ended ? ' is-ended' : '');
        badge.textContent = `${days}d`;
        badge.style.setProperty('color', ageColors[ageClass].color, 'important');
        badge.style.setProperty('background-color', ageColors[ageClass].background, 'important');
        badge.style.setProperty('border', `1px solid ${ageColors[ageClass].border}`, 'important');
        badge.title = isFrozen
            ? (ended
                ? `${days} days from frozen to ${text.includes('❌') ? 'cancelled' : 'completed'} (scale: 0–14d green, 15–30d yellow, 30d+ red)`
                : `${days} days since frozen (scale: 0–14d green, 15–30d yellow, 30d+ red)`)
            : (ended
                ? `${days} days from created to ${text.includes('❌') ? 'cancelled' : 'completed'}`
                : `${days} days since created`);

        const checkbox = taskEl.querySelector('input.task-list-item-checkbox, input[type="checkbox"]');
        if (checkbox) {
            checkbox.insertAdjacentElement('afterend', badge);
        } else {
            taskEl.prepend(badge);
        }

        taskEl.dataset.pantryBadged = '1';
    });
}

// Tasks and embeds can render after this helper; retry briefly so badges attach reliably.
for (const delay of [0, 100, 300, 800, 1500, 3000]) {
    setTimeout(installPantryTaskAgeBadges, delay);
}

// Re-apply after Obsidian/Tasks re-renders the note.
if (!window._pantryTaskAgeObserver) {
    window._pantryTaskAgeObserver = new MutationObserver(() => {
        clearTimeout(window._pantryTaskAgeObserverTimer);
        window._pantryTaskAgeObserverTimer = setTimeout(installPantryTaskAgeBadges, 150);
    });
    const observeRoot = app.workspace.activeLeaf?.view?.containerEl;
    if (observeRoot) window._pantryTaskAgeObserver.observe(observeRoot, { childList: true, subtree: true });
}

```
